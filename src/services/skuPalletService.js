import * as XLSX from 'xlsx';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const SKU_CACHE_KEY = 'SKU_AVG_PALLET_QTY_CACHE';

/**
 * 6월 1일부터 현재까지의 재고현황 데이터를 이용하여 SKU별 파레트 평균 적재량을 연산
 */
export function calculateSkuPalletAverages(inventoryRows = []) {
  if (!inventoryRows || inventoryRows.length === 0) return { list: [], map: new Map() };

  const skuMap = new Map();

  inventoryRows.forEach(inv => {
    const sku = (inv.ItemId || inv.itemId || inv.itemid || inv.ItemID || inv.SKU || '').toString().trim();
    const palletId = (inv.PalletId || inv.palletId || inv.palletID || inv.PalletID || '').toString().trim();
    const qty = Number(inv.PiecesOnhand || inv.piecesOnhand || inv.piecesonhand || inv.Qty || inv.QTY) || 0;

    if (!sku) return;

    if (!skuMap.has(sku)) {
      skuMap.set(sku, {
        sku,
        totalPieces: 0,
        palletsSet: new Set(),
      });
    }

    const item = skuMap.get(sku);
    item.totalPieces += qty;
    if (palletId) {
      item.palletsSet.add(palletId);
    }
  });

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
      totalPieces: val.totalPieces,
      totalPallets: totalPallets,
      avgQtyPerPallet: avgQtyPerPallet,
      updatedAt: nowStr
    };

    resultList.push(record);
    map.set(sku, avgQtyPerPallet);
  });

  // SKU순 정렬
  resultList.sort((a, b) => a.sku.localeCompare(b.sku));

  return { list: resultList, map };
}

/**
 * 계산된 SKU별 파레트 평균 적재량 데이터를 DB / LocalStorage에 저장
 */
export async function saveSkuPalletAverages(skuAvgList = []) {
  if (!skuAvgList || skuAvgList.length === 0) return false;

  // 1. LocalStorage 캐시 저장
  try {
    localStorage.setItem(SKU_CACHE_KEY, JSON.stringify(skuAvgList));
  } catch (err) {
    console.warn("Failed to cache SKU averages in LocalStorage:", err);
  }

  // 2. Supabase DB 저장 시도 (테이블이 있는 경우)
  if (isSupabaseConfigured && supabase) {
    try {
      const payload = skuAvgList.map(item => ({
        sku_id: item.sku,
        total_pieces: item.totalPieces,
        total_pallets: item.totalPallets,
        avg_qty_per_pallet: item.avgQtyPerPallet,
        updated_at: item.updatedAt
      }));

      const { error } = await supabase
        .from('sku_avg_pallet_qty')
        .upsert(payload, { onConflict: 'sku_id' });

      if (error) {
        console.warn("Supabase upsert for sku_avg_pallet_qty skipped or failed:", error.message);
      } else {
        console.log(`Saved ${skuAvgList.length} SKU pallet averages to Supabase DB.`);
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
  // 1. Supabase DB 조회 시도
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('sku_avg_pallet_qty')
        .select('*');

      if (!error && data && data.length > 0) {
        const list = data.map(d => ({
          sku: d.sku_id || d.sku,
          totalPieces: Number(d.total_pieces) || 0,
          totalPallets: Number(d.total_pallets) || 0,
          avgQtyPerPallet: Number(d.avg_qty_per_pallet) || 35,
          updatedAt: d.updated_at
        }));

        const map = new Map(list.map(item => [item.sku, item.avgQtyPerPallet]));
        return { list, map };
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
      return { list, map };
    }
  } catch (err) {
    console.warn("LocalStorage SKU load error:", err);
  }

  return { list: [], map: new Map() };
}

/**
 * SKU별 평균 적재량 리스트를 엑셀(.xlsx) 파일로 다운로드
 */
export function downloadSkuPalletExcel(skuAvgList = []) {
  if (!skuAvgList || skuAvgList.length === 0) {
    alert("다운로드할 SKU 평균 적재량 데이터가 없습니다. 먼저 'SKU업데이트'를 실행해 주세요.");
    return;
  }

  const exportData = skuAvgList.map((item, idx) => ({
    'No': idx + 1,
    'SKU (품목코드)': item.sku,
    '총 재고 수량 (EA)': item.totalPieces,
    '총 적재 파레트 수': item.totalPallets,
    '파레트 당 평균 적재량 (EA/Pallet)': item.avgQtyPerPallet,
    '업데이트 시각': item.updatedAt ? item.updatedAt.replace('T', ' ').substring(0, 19) : ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'SKU별_파레트_평균적재량');

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(workbook, `SKU별_파레트_평균적재량_${todayStr}.xlsx`);
}
