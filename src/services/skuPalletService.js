import * as XLSX from 'xlsx';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const SKU_CACHE_KEY = 'SKU_AVG_PALLET_QTY_CACHE';
const SKU_PERIOD_KEY = 'SKU_AVG_PERIOD_INFO_CACHE';

/**
 * 6월 1일부터 현재까지의 재고현황 및 피킹오더 데이터를 이용하여 SKU별 통계를 연산
 */
export function calculateSkuPalletAverages(inventoryRows = [], pickingRows = []) {
  if (!inventoryRows || inventoryRows.length === 0) {
    return { list: [], map: new Map(), periodInfo: { minDate: '', maxDate: '', totalDaysCount: 0 } };
  }

  const skuMap = new Map();
  const allDatesSet = new Set();

  // 1. 재고 데이터 집계 (재고 보유 일수, 총 수량, 파레트 수)
  inventoryRows.forEach(inv => {
    const sku = (inv.ItemId || inv.itemId || inv.itemid || inv.ItemID || inv.SKU || '').toString().trim();
    const palletId = (inv.PalletId || inv.palletId || inv.palletID || inv.PalletID || '').toString().trim();
    const qty = Number(inv.PiecesOnhand || inv.piecesOnhand || inv.piecesonhand || inv.Qty || inv.QTY) || 0;
    
    let dateVal = (inv.Date || inv.CreateTime || inv.ReceiveTime || '').toString().split(' ')[0].trim();
    if (dateVal.length === 5 && !isNaN(dateVal)) {
      // Excel serial date fallback (e.g. 46174 -> 2026-06-01)
      const jsDate = new Date((Number(dateVal) - (25567 + 2)) * 86400 * 1000);
      dateVal = jsDate.toISOString().slice(0, 10);
    }

    if (!sku) return;
    if (dateVal && dateVal.length >= 8) {
      allDatesSet.add(dateVal);
    }

    if (!skuMap.has(sku)) {
      skuMap.set(sku, {
        sku,
        totalPieces: 0,
        palletsSet: new Set(),
        daysSet: new Set(),
        pickingOrderCount: 0,
        totalPickQty: 0
      });
    }

    const item = skuMap.get(sku);
    item.totalPieces += qty;
    if (palletId) item.palletsSet.add(palletId);
    if (dateVal) item.daysSet.add(dateVal);
  });

  // 2. 피킹오더 데이터 집계 (오더 횟수, 총 피킹 수량)
  if (pickingRows && pickingRows.length > 0) {
    pickingRows.forEach(pk => {
      const sku = (pk.ItemId || pk.itemId || pk.SKU || pk.ItemCode || '').toString().trim();
      const qty = Number(pk.ItemQty || pk.Qty || pk.Quantity) || 0;
      if (!sku) return;

      if (!skuMap.has(sku)) {
        skuMap.set(sku, {
          sku,
          totalPieces: 0,
          palletsSet: new Set(),
          daysSet: new Set(),
          pickingOrderCount: 0,
          totalPickQty: 0
        });
      }

      const item = skuMap.get(sku);
      item.pickingOrderCount += 1;
      item.totalPickQty += qty;
    });
  }

  // 날짜 기간 정보 추출
  const sortedDates = Array.from(allDatesSet).sort();
  const minDate = sortedDates.length > 0 ? sortedDates[0] : '';
  const maxDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : '';
  const totalDaysCount = sortedDates.length;

  const periodInfo = {
    minDate,
    maxDate,
    totalDaysCount
  };

  const nowStr = new Date().toISOString();
  const resultList = [];
  const map = new Map();

  skuMap.forEach((val, sku) => {
    const totalPallets = val.palletsSet.size;
    const avgQtyPerPallet = totalPallets > 0 && val.totalPieces > 0 
      ? Math.round(val.totalPieces / totalPallets) 
      : 35; // default fallback

    const record = {
      sku,
      inventoryDaysCount: val.daysSet.size,
      totalPieces: val.totalPieces,
      totalPallets: totalPallets,
      avgQtyPerPallet: avgQtyPerPallet,
      pickingOrderCount: val.pickingOrderCount,
      totalPickQty: val.totalPickQty,
      updatedAt: nowStr
    };

    resultList.push(record);
    map.set(sku, avgQtyPerPallet);
  });

  // SKU순 정렬
  resultList.sort((a, b) => a.sku.localeCompare(b.sku));

  return { list: resultList, map, periodInfo };
}

/**
 * 계산된 SKU별 파레트 평균 적재량 데이터를 DB / LocalStorage에 저장
 */
export async function saveSkuPalletAverages(skuAvgList = [], periodInfo = {}) {
  if (!skuAvgList || skuAvgList.length === 0) return false;

  // 1. LocalStorage 캐시 저장
  try {
    localStorage.setItem(SKU_CACHE_KEY, JSON.stringify(skuAvgList));
    if (periodInfo && periodInfo.minDate) {
      localStorage.setItem(SKU_PERIOD_KEY, JSON.stringify(periodInfo));
    }
  } catch (err) {
    console.warn("Failed to cache SKU averages in LocalStorage:", err);
  }

  // 2. Supabase DB 저장 시도 (테이블이 있는 경우)
  if (isSupabaseConfigured && supabase) {
    try {
      const payload = skuAvgList.map(item => ({
        sku_id: item.sku,
        inventory_days_count: item.inventoryDaysCount,
        total_pieces: item.totalPieces,
        total_pallets: item.totalPallets,
        avg_qty_per_pallet: item.avgQtyPerPallet,
        picking_order_count: item.pickingOrderCount,
        total_pick_qty: item.totalPickQty,
        updated_at: item.updatedAt
      }));

      const { error } = await supabase
        .from('sku_avg_pallet_qty')
        .upsert(payload, { onConflict: 'sku_id' });

      if (error) {
        console.warn("Supabase upsert for sku_avg_pallet_qty skipped or failed:", error.message);
      }
    } catch (err) {
      console.warn("Supabase SKU save error:", err);
    }
  }

  return true;
}

/**
 * DB 또는 LocalStorage 캐시에서 저장된 SKU 평균 적재량 데이터 불러오기
 */
export async function loadSavedSkuPalletAverages() {
  let periodInfo = { minDate: '', maxDate: '', totalDaysCount: 0 };
  try {
    const cachedPeriod = localStorage.getItem(SKU_PERIOD_KEY);
    if (cachedPeriod) periodInfo = JSON.parse(cachedPeriod);
  } catch (err) {
    console.warn("Period info load err:", err);
  }

  // 1. Supabase DB 조회 시도
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('sku_avg_pallet_qty')
        .select('*');

      if (!error && data && data.length > 0) {
        const list = data.map(d => ({
          sku: d.sku_id || d.sku,
          inventoryDaysCount: Number(d.inventory_days_count) || 0,
          totalPieces: Number(d.total_pieces) || 0,
          totalPallets: Number(d.total_pallets) || 0,
          avgQtyPerPallet: Number(d.avg_qty_per_pallet) || 35,
          pickingOrderCount: Number(d.picking_order_count) || 0,
          totalPickQty: Number(d.total_pick_qty) || 0,
          updatedAt: d.updated_at
        }));

        const map = new Map(list.map(item => [item.sku, item.avgQtyPerPallet]));
        return { list, map, periodInfo };
      }
    } catch (err) {
      console.warn("Supabase SKU load fallback:", err);
    }
  }

  // 2. LocalStorage 캐시 조회
  try {
    const cached = localStorage.getItem(SKU_CACHE_KEY);
    if (cached) {
      const list = JSON.parse(cached);
      const map = new Map(list.map(item => [item.sku, item.avgQtyPerPallet]));
      return { list, map, periodInfo };
    }
  } catch (err) {
    console.warn("LocalStorage SKU load error:", err);
  }

  return { list: [], map: new Map(), periodInfo };
}

/**
 * SKU별 평균 적재량 및 피킹 통계 리스트를 엑셀(.xlsx) 파일로 다운로드
 */
export function downloadSkuPalletExcel(skuAvgList = [], periodInfo = {}) {
  if (!skuAvgList || skuAvgList.length === 0) {
    alert("다운로드할 SKU 통계 데이터가 없습니다. 대시보드 데이터 로드 후 다시 시도해 주세요.");
    return;
  }

  const minDate = periodInfo?.minDate || '2026-06-01';
  const maxDate = periodInfo?.maxDate || '2026-08-04';
  const totalDaysCount = periodInfo?.totalDaysCount || 29;

  // 1. 헤더 안내 행
  const periodHeaderRow = [
    `📌 분석 기간: ${minDate} ~ ${maxDate} (총 ${totalDaysCount}일분 재고현황 데이터 기반)`
  ];

  // 2. 데이터 표 생성
  const exportData = skuAvgList.map((item, idx) => ({
    'No': idx + 1,
    'SKU (품목코드)': item.sku,
    '재고 보유 일수 (일)': item.inventoryDaysCount ?? 0,
    '총 재고 수량 (EA)': item.totalPieces,
    '총 적재 파레트 수': item.totalPallets,
    '파레트 당 평균 적재량 (EA/Pallet)': item.avgQtyPerPallet,
    '피킹 오더 횟수 (건)': item.pickingOrderCount ?? 0,
    '총 피킹 출고 수량 (EA)': item.totalPickQty ?? 0,
    '업데이트 시각': item.updatedAt ? item.updatedAt.replace('T', ' ').substring(0, 19) : ''
  }));

  const worksheet = XLSX.utils.aoa_to_sheet([periodHeaderRow, []]);
  XLSX.utils.sheet_add_json(worksheet, exportData, { origin: 'A3' });

  // 열 너비 자동 맞춤
  worksheet['!cols'] = [
    { wch: 6 },   // No
    { wch: 25 },  // SKU
    { wch: 18 },  // 재고 보유 일수
    { wch: 18 },  // 총 재고 수량
    { wch: 18 },  // 총 적재 파레트 수
    { wch: 30 },  // 파레트 당 평균 적재량
    { wch: 20 },  // 피킹 오더 횟수
    { wch: 22 },  // 총 피킹 출고 수량
    { wch: 22 }   // 업데이트 시각
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'SKU_Avg_Pallet_Qty');

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `SKU_Pallet_Avg_Qty_${todayStr}.xlsx`;

  try {
    XLSX.writeFile(workbook, filename);
  } catch (err) {
    console.warn("XLSX.writeFile fallback to binary blob:", err);
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });
    function s2ab(s) {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
      return buf;
    }
    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
