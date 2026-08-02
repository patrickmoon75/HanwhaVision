/**
 * plannerSimulator.js
 * RWCS Planner 배치계획 시뮬레이션 엔진 (안티그래비티 고도화 v5)
 *
 * 주요 고도화 기능:
 * 1. 동적 파렛트 적재량(AvgQtyPerPallet_i) 역산 연동 (Fallback: 100 EA)
 * 2. 2단계 하이브리드 배치 알고리즘 (확정 DO 최우선 100% 선할당 + 잔여 셀 Knapsack 한계효용 배분)
 * 3. Level 5 (5단 Hard Blocked) 및 Blocked==TRUE 100% 차감 Hard Constraint
 * 4. Stochastic Realism Bridge (이론상 최상 피킹률 & 현장 예측 피킹률 Range Target ± 3.5%)
 */

import { parseDateValue, buildAvgQtyPerPalletMap } from './dataProcessor';

// ─── KST (UTC+9) 타임존 필터링 및 D-1 17:00 ~ 23:59:59 검증 헬퍼 ─────────

function parseToKstDateTime(dateVal) {
  if (!dateVal) return null;

  if (typeof dateVal === 'number') {
    // 엑셀 일련번호 (46233.79274 등)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + dateVal * 86400000);
    if (isNaN(d.getTime())) return null;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const hours = d.getHours();
    const hasTimeComponent = dateVal % 1 !== 0;
    return { dateStr, hours, hasTimeComponent };
  }

  let str = String(dateVal).trim();
  if (!str) return null;

  // 한글 오전/오후 정제
  let isPm = false;
  let isAm = false;
  if (str.includes('오후')) {
    isPm = true;
    str = str.replace('오후', '').trim();
  } else if (str.includes('오전')) {
    isAm = true;
    str = str.replace('오전', '').trim();
  }

  // 연, 월, 일 매칭: 2026. 7. 28. 또는 2026-07-28 또는 2026/07/28
  const dateMatch = str.match(/(\d{4})[\.\-\/]\s*(\d{1,2})[\.\-\/]\s*(\d{1,2})/);
  if (!dateMatch) {
    // ISO 표준 포맷 파싱 시도
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const hours = d.getHours();
      const hasTimeComponent = str.includes(':') || str.includes('T');
      return { dateStr, hours, hasTimeComponent };
    }
    return null;
  }

  const year = dateMatch[1];
  const month = String(dateMatch[2]).padStart(2, '0');
  const day = String(dateMatch[3]).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // 시간 파싱
  let hours = 0;
  let hasTimeComponent = false;
  const timeMatch = str.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (timeMatch) {
    hasTimeComponent = true;
    let h = parseInt(timeMatch[1], 10);
    if (isPm && h < 12) h += 12;
    if (isAm && h === 12) h = 0;
    hours = h;
  }

  return { dateStr, hours, hasTimeComponent };
}

function isPrevDayKst17to24Order(dateVal, targetDate) {
  const parsed = parseToKstDateTime(dateVal);
  if (!parsed) return false;

  // D-1 날짜 계산
  const tDate = new Date(targetDate);
  tDate.setDate(tDate.getDate() - 1);
  const prevDateStr = tDate.toISOString().split('T')[0];

  if (parsed.dateStr !== prevDateStr) return false;

  // 수집 시간 정보가 포함되어 있는 경우 KST 17시~23시 (17:00:00 ~ 23:59:59) 필터링
  if (parsed.hasTimeComponent) {
    return parsed.hours >= 17 && parsed.hours <= 23;
  }

  return true;
}

// ─── 시뮬레이션 모드용 SKU 랭킹 (동적 Lookback 반영) ─────────────────

function buildSkuRanking(pickingRows, targetDate, lookbackDays, scoreConfig) {
  const { orderCountRatio, outboundQtyRatio } = scoreConfig;

  const toDate = new Date(targetDate);
  toDate.setDate(toDate.getDate() - 1);
  const fromDate = new Date(targetDate);
  fromDate.setDate(fromDate.getDate() - lookbackDays);

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  const skuMap = new Map();
  const skuDailyMap = new Map();

  pickingRows.forEach(p => {
    const dateStr = parseDateValue(p.ReceiveTime);
    if (!dateStr || dateStr < fromStr || dateStr > toStr) return;

    const itemId = p.ItemId || p.Itemid || p.itemId || p.ItemID;
    if (!itemId) return;

    const qty = Number(p.ItemQty) || 0;
    if (!skuMap.has(itemId)) {
      skuMap.set(itemId, { itemId, orderCount: 0, totalQty: 0 });
      skuDailyMap.set(itemId, new Map());
    }
    const entry = skuMap.get(itemId);
    entry.orderCount += 1;
    entry.totalQty += qty;

    const daily = skuDailyMap.get(itemId);
    daily.set(dateStr, (daily.get(dateStr) || 0) + qty);
  });

  if (skuMap.size === 0) return [];

  let maxOrderCount = 0;
  let maxTotalQty = 0;
  skuMap.forEach(v => {
    if (v.orderCount > maxOrderCount) maxOrderCount = v.orderCount;
    if (v.totalQty > maxTotalQty) maxTotalQty = v.totalQty;
  });

  const skuList = [];
  skuMap.forEach((v, itemId) => {
    const daily = skuDailyMap.get(itemId);
    let maxDailyQty = 0;
    daily.forEach(q => { if (q > maxDailyQty) maxDailyQty = q; });

    const normalizedOrder = maxOrderCount > 0 ? v.orderCount / maxOrderCount : 0;
    const normalizedQty = maxTotalQty > 0 ? v.totalQty / maxTotalQty : 0;
    const score =
      normalizedOrder * (orderCountRatio / 100) +
      normalizedQty * (outboundQtyRatio / 100);

    skuList.push({
      ...v,
      score,
      maxDailyQty,
      avgDailyQty: v.totalQty / lookbackDays
    });
  });

  skuList.sort((a, b) => b.score - a.score);
  skuList.forEach((s, idx) => {
    s.rank = idx + 1;
    s.rankPercent = ((idx + 1) / skuList.length) * 100;
  });

  return skuList;
}

// ─── 2단계 하이브리드 배치 알고리즘 (확정 DO + Knapsack 한계효용) ─────────────

function determineHybridPlannedSkus(
  skuList,
  plannerConfig,
  yardCapacity,
  availInvMap,
  avgQtyPerPalletMap,
  targetDate,
  pickingRows,
  pendingOrderRows = [],
  useDoPriority = true
) {
  const { palletLimit, topRankPercent, topRankMargin, bottomRankCutoff, palletOption } = plannerConfig;

  const planned = new Map();
  let totalAllocated = 0;
  let doTotalQty = 0;
  let doOrderCount = 0;
  let doSkuCount = 0;
  const doPlannedSkusMap = new Map();

  // ─────────────────────────────────────────────────────────────
  // 1단계: 미출고 확정 DO (pending_orders / 입력 DO 파일) 100% 최우선 선할당
  // (스펙 1~4: D-1 KST 17:00:00 ~ 23:59:59 수집 필터링, DO 미입력 시 '데이터 없음' 처리)
  // ─────────────────────────────────────────────────────────────
  if (useDoPriority && pendingOrderRows && pendingOrderRows.length > 0) {
    const doQtyMap = new Map();

    // 이미지/엑셀 한글 헤더 포함 컬럼명 파싱 헬퍼
    const getRowFields = (p) => {
      const receiveTime = p['수집일시'] || p['수집 일시'] || p['수집일자'] || p.collected_at || p.created_at || p.CreatedTime || p.ReceiveTime || p.Date || p.date || p.order_date;
      const itemId = p['품목 ID'] || p['품목ID'] || p['품목 명'] || p['품목명'] || p.item_id || p.itemId || p.item_code || p.itemCode || p.ItemId || p.ItemID;
      const qty = Number(p['피킹 수량'] ?? p['피킹수량'] ?? p['수량'] ?? p.pieces_to_pick ?? p.piecesToPick ?? p.qty ?? p.ItemQty ?? 0);
      return { receiveTime, itemId, qty };
    };

    // 배치 대상일 당일(targetDate) 날짜 오더 100% 전체 필터링
    // (새벽/자정 직후 수집되어 당일 낮 출고 picking_orders와 동일 날짜 D로 매칭)
    const targetDoRows = pendingOrderRows.filter(p => {
      const { receiveTime } = getRowFields(p);
      if (!receiveTime) return true; // 시간 정보가 없거나 모호한 경우 누락 없이 포함
      const parsed = parseToKstDateTime(receiveTime);
      if (!parsed) return true;

      return parsed.dateStr === targetDate;
    });

    const doOrderSet = new Set();
    const doSkuSet = new Set();

    targetDoRows.forEach(p => {
      const { itemId, qty } = getRowFields(p);
      const orderNo = p['주문 번호'] || p['주문번호'] || p['주문_번호'] || p['주문 차수'] || p['출고 차수'] || p['주문 번호 '] || p['주문번호 '] || p.order_number || p.order_id || p.orderNo || p.OrderNo || p.order_no || p.Order_No || p.Order;
      if (!itemId || qty <= 0) return;

      doQtyMap.set(itemId, (doQtyMap.get(itemId) || 0) + qty);
      if (orderNo) doOrderSet.add(orderNo);
      doSkuSet.add(itemId);
    });

    doOrderCount = doOrderSet.size > 0 ? doOrderSet.size : targetDoRows.length;
    doSkuCount = doSkuSet.size;

    doQtyMap.forEach((doQty, itemId) => {
      doTotalQty += doQty;
      const itemsPerPallet = avgQtyPerPalletMap.get(itemId) || 100; // Fallback: 100 EA
      let requiredPallets = Math.ceil(doQty / itemsPerPallet);

      // Hard Constraint: D-1 가용재고(Level 5 & Blocked 제외) 범위 초과 금지
      if (availInvMap && availInvMap.has(itemId)) {
        const availQty = availInvMap.get(itemId) || 0;
        const maxAvailPallets = Math.ceil(availQty / itemsPerPallet);
        requiredPallets = Math.min(requiredPallets, maxAvailPallets);
      } else if (availInvMap && availInvMap.size > 0) {
        requiredPallets = 0; // 가용 재고 없으면 0
      }

      const alloc = Math.min(requiredPallets, yardCapacity - totalAllocated);
      if (alloc > 0) {
        planned.set(itemId, (planned.get(itemId) || 0) + alloc);
        doPlannedSkusMap.set(itemId, (doPlannedSkusMap.get(itemId) || 0) + alloc);
        totalAllocated += alloc;
      }
    });

    if (doTotalQty <= 0) {
      doOrderCount = 0;
      doSkuCount = 0;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2단계: 잔여 셀 C_rem Knapsack 한계효용 (Marginal Utility) 배분
  // ─────────────────────────────────────────────────────────────
  const cRem = yardCapacity - totalAllocated;
  if (cRem <= 0 || skuList.length === 0) {
    return {
      planned,
      doTotalQty: doTotalQty > 0 ? doTotalQty : null,
      doOrderCount: doTotalQty > 0 ? doOrderCount : null,
      doSkuCount: doTotalQty > 0 ? doSkuCount : null,
      doPlannedSkusMap
    };
  }

  // 잔여 파렛트 할당용 한계효용 Priority Queue 생성
  const candidates = [];

  for (let i = 0; i < skuList.length; i++) {
    const sku = skuList[i];
    if (bottomRankCutoff > 0 && sku.rankPercent > (100 - bottomRankCutoff)) continue;

    const itemsPerPallet = avgQtyPerPalletMap.get(sku.itemId) || 100; // Fallback 100 EA

    let targetPallets = 1;
    if (palletOption === 'avg') {
      targetPallets = Math.ceil(sku.avgDailyQty / itemsPerPallet);
    } else if (palletOption === 'max') {
      targetPallets = Math.ceil(sku.maxDailyQty / itemsPerPallet);
    } else {
      targetPallets = 1;
    }
    targetPallets = Math.max(1, targetPallets);

    let limit = palletLimit;
    if (sku.rankPercent <= topRankPercent) {
      limit = Math.ceil(palletLimit * (1 + topRankMargin / 100));
    }

    let maxAllowed = Math.min(limit, targetPallets);

    // Hard Constraint: 가용 재고 한도
    if (availInvMap && availInvMap.size > 0) {
      const availQty = availInvMap.get(sku.itemId) || 0;
      if (availQty <= 0) continue;
      const maxAvailPallets = Math.ceil(availQty / itemsPerPallet);
      maxAllowed = Math.min(maxAllowed, maxAvailPallets);
    }

    const alreadyAllocated = planned.get(sku.itemId) || 0;
    const remainingNeeded = Math.max(0, maxAllowed - alreadyAllocated);

    if (remainingNeeded > 0) {
      // 파렛트 1개 추가할 때마다의 한계효용 (Marginal Utility) = Score / PalletCount
      const marginalUtility = (sku.score * itemsPerPallet) / (alreadyAllocated + 1);
      candidates.push({
        itemId: sku.itemId,
        remainingNeeded,
        marginalUtility,
        score: sku.score
      });
    }
  }

  // 한계효용(Marginal Utility) 내림차순 정렬 (Max-Heap 역할)
  candidates.sort((a, b) => b.marginalUtility - a.marginalUtility);

  let cRemAvailable = cRem;
  for (const cand of candidates) {
    if (cRemAvailable <= 0) break;

    const currentAlloc = planned.get(cand.itemId) || 0;
    const addAlloc = Math.min(cand.remainingNeeded, cRemAvailable);

    if (addAlloc > 0) {
      planned.set(cand.itemId, currentAlloc + addAlloc);
      totalAllocated += addAlloc;
      cRemAvailable -= addAlloc;
    }
  }

  return {
    planned,
    doTotalQty: doTotalQty > 0 ? doTotalQty : null,
    doOrderCount: doTotalQty > 0 ? doOrderCount : null,
    doSkuCount: doTotalQty > 0 ? doSkuCount : null,
    doPlannedSkusMap
  };
}

// ─── 실제 배치계획 검증 모드: batch_plans 데이터로 야드 배치 결정 ─────

function determineActualPlannedSkus(planRows, targetDate, yardCapacity = 805) {
  if (!planRows || planRows.length === 0) return { planned: new Map(), totalPlanCount: 0, dayPlanRows: [] };

  const prevDate = new Date(targetDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().split('T')[0];
  const compactPrevDate = prevDateStr.replace(/-/g, '');
  const compactTargetDate = targetDate.replace(/-/g, '');

  const dayPlans = planRows.filter(p => {
    const planId = String(p.PlanId || p.planId || p.PlanID || p['배치계획ID'] || p['PlanId'] || '');
    const planDateStr = parseDateValue(p.PlanDate || p.planDate || p.Date || p.date || p.created_at || p.CreatedTime || p['생성일시'] || p['계획일자'] || '');

    // 1) PlanId 내 8자리 날짜 매칭 (예: A20260727 또는 20260727)
    if (planId) {
      const m = planId.match(/(\d{8})/);
      if (m && (m[1] === compactPrevDate || m[1] === compactTargetDate)) return true;
    }

    // 2) PlanDate 날짜 매칭 (D-1 또는 D 당일)
    if (planDateStr) {
      if (planDateStr === prevDateStr || planDateStr === targetDate) return true;
    }

    return false;
  });

  if (dayPlans.length === 0) return { planned: new Map(), totalPlanCount: 0, dayPlanRows: [] };

  // Rank 오름차순 정렬 (Rank 1위부터 순차적 배치)
  const sortedPlans = [...dayPlans].sort((a, b) => {
    const rankA = Number(a.Rank ?? a.rank ?? a['순위'] ?? 999999);
    const rankB = Number(b.Rank ?? b.rank ?? b['순위'] ?? 999999);
    return rankA - rankB;
  });

  let currentAllocatedPallets = 0;
  const planned = new Map();

  for (const p of sortedPlans) {
    if (currentAllocatedPallets >= yardCapacity) break;

    const itemId = p.ItemId || p.itemId || p.ItemID || p['품목 ID'] || p['품목ID'] || p['품목명'] || p['품목 명'];
    if (!itemId) continue;

    const targetPallets = Number(p.TargetPalletQuantity || p.targetPalletQuantity || p.PalletQty || p['목표 파렛트 수'] || 1) || 1;
    
    // 야드 총 용량 (805개 셀) 하드제약 범위 내 배치
    const allocPallets = Math.min(targetPallets, yardCapacity - currentAllocatedPallets);
    if (allocPallets > 0) {
      planned.set(itemId, (planned.get(itemId) || 0) + allocPallets);
      currentAllocatedPallets += allocPallets;
    }
  }

  return {
    planned,
    totalPlanCount: sortedPlans.length,
    allocatedPallets: currentAllocatedPallets,
    dayPlanRows: sortedPlans
  };
}

// ─── LocationId 기반 시뮬레이션 피킹율 계산 (공통) ─────────────────

function calcSimDayRate(targetDate, pickingRows, yardIds, plannedSkusMap, avgQtyPerPalletMap) {
  const dayPickings = (pickingRows || []).filter(p => parseDateValue(p.ReceiveTime) === targetDate);
  const plannedMap = plannedSkusMap instanceof Map ? plannedSkusMap : new Map();
  const safeYardIds = yardIds instanceof Set ? yardIds : new Set(yardIds || []);

  const totalQty = dayPickings.reduce((s, p) => s + (Number(p.ItemQty) || 0), 0);
  if (totalQty === 0) return { simYardQty: 0, totalQty: 0, simRate: null, plannedSkuCount: plannedMap.size };

  const yardStock = new Map();
  plannedMap.forEach((pallets, itemId) => {
    const itemsPerPallet = avgQtyPerPalletMap?.get(itemId) || 100; // Fallback: 100 EA
    yardStock.set(itemId, (pallets || 0) * itemsPerPallet);
  });

  let simYardQty = 0;

  dayPickings.forEach(p => {
    const locId = p.LocationId;
    const itemId = p.ItemId || p.Itemid || p.itemId || p.ItemID;
    const qty = Number(p.ItemQty) || 0;

    if (safeYardIds.has(locId)) {
      // Case 1: 원래 야드 로케이션 → 무조건 야드 피킹
      simYardQty += qty;
    } else if (plannedMap.has(itemId)) {
      // Case 2: 배치계획 품목 → 야드 재고 잔량 내에서 전환
      const remaining = yardStock.get(itemId) || 0;
      if (remaining >= qty) {
        simYardQty += qty;
        yardStock.set(itemId, remaining - qty);
      } else if (remaining > 0) {
        simYardQty += remaining;
        yardStock.set(itemId, 0);
      }
    }
  });

  simYardQty = Math.min(simYardQty, totalQty);
  const simRate = Number(((simYardQty / totalQty) * 100).toFixed(2));

  return { simYardQty, totalQty, simRate, plannedSkuCount: plannedMap.size };
}

// ─── 메인 엔트리 포인트 ──────────────────────────────────────────

export function runPlannerSimulation({
  pickingRows,
  yardIds,
  dates,
  dailyAnalytics,
  plannerConfig,
  onProgress,
  inventoryRows,
  rackRows,
  planRows,
  pendingOrderRows = [],
  useActualPlan,
  useDoPriority = true
}) {
  const results = [];
  const total = dates.length;

  const rackMap = new Map(rackRows?.map(r => [r.RackId, r]) || []);
  const yardCapacity = rackRows?.filter(r => r.RackType === 'Yard' && !r.Blocked)?.length || 805;

  // 동적 AvgQtyPerPallet_i 역산 맵 생성
  const avgQtyPerPalletMap = buildAvgQtyPerPalletMap(inventoryRows);

  dates.forEach((date, idx) => {
    const actual = dailyAnalytics[date] || {};
    const actualRate = actual.totalPickQty > 0 ? Number(actual.yardPickingRate) : null;

    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];

    let targetInvDate = prevDateStr;
    if (inventoryRows && inventoryRows.length > 0) {
      const availableInvDates = Array.from(new Set(inventoryRows.map(r => parseDateValue(r.Date || r.date))));
      availableInvDates.sort((a, b) => b.localeCompare(a));
      const closestDate = availableInvDates.find(d => d && d <= prevDateStr);
      if (closestDate) targetInvDate = closestDate;
    }

    // Hard Constraint: Level 5 및 Blocked==TRUE 재고 100% 차감 (0 처리)
    const availInvMap = new Map();
    if (inventoryRows && inventoryRows.length > 0) {
      inventoryRows.forEach(inv => {
        const invDate = parseDateValue(inv.Date || inv.date);
        if (invDate !== targetInvDate) return;

        const locId = inv.locationId || inv.LocationId;
        const itemId = inv.itemId || inv.ItemId || inv.itemid || inv.ItemID;
        if (!itemId) return;

        const rack = rackMap.get(locId);
        const isBlocked = rack && (rack.Blocked === true || String(rack.Blocked).toUpperCase() === 'TRUE');
        const isLevel5 = (rack && Number(rack.Level) === 5) || String(locId || '').endsWith('0') || String(locId || '').endsWith('5');

        if (isBlocked || isLevel5) return;

        const qty = Number(inv.piecesOnhand || inv.piecesonhand || inv.PiecesOnHand) || 0;
        availInvMap.set(itemId, (availInvMap.get(itemId) || 0) + qty);
      });
    }

    // SKU 랭킹 산출
    const skuList = buildSkuRanking(
      pickingRows,
      date,
      plannerConfig.lookbackPeriod || 90,
      {
        orderCountRatio: plannerConfig.orderCountRatio,
        outboundQtyRatio: plannerConfig.outboundQtyRatio,
      }
    );

    // 1) 알고리즘 하이브리드 배치 시뮬레이션 연산
    const hybridRes = determineHybridPlannedSkus(
      skuList,
      plannerConfig,
      yardCapacity,
      availInvMap,
      avgQtyPerPalletMap,
      date,
      pickingRows,
      pendingOrderRows,
      useDoPriority
    );
    const plannedSkusMap = hybridRes.planned;
    let doTotalQty = hybridRes.doTotalQty;

    // LocationId 기반 시뮬레이션 피킹율 계산 (알고리즘)
    const { simYardQty, totalQty, simRate, plannedSkuCount } = calcSimDayRate(
      date,
      pickingRows,
      yardIds,
      plannedSkusMap,
      avgQtyPerPalletMap
    );

    // 2) 실제 배치계획 검증 피킹율 연산 (planRows 연동)
    let actualPlanRate = null;
    let actualPlanYardQty = 0;
    if (planRows && planRows.length > 0) {
      const actualPlanRes = determineActualPlannedSkus(planRows, date, yardCapacity);
      if (actualPlanRes.planned && actualPlanRes.planned.size > 0) {
        const actualPlanDayRes = calcSimDayRate(
          date,
          pickingRows,
          yardIds,
          actualPlanRes.planned,
          avgQtyPerPalletMap
        );
        actualPlanRate = actualPlanDayRes.simRate;
        actualPlanYardQty = actualPlanDayRes.simYardQty;
      }
    }

    let doGainRate = null;
    if (useDoPriority && doTotalQty !== null && doTotalQty > 0 && totalQty > 0 && hybridRes?.doPlannedSkusMap?.size > 0) {
      const { simYardQty: doOnlySimYardQty } = calcSimDayRate(
        date,
        pickingRows,
        yardIds,
        hybridRes.doPlannedSkusMap,
        avgQtyPerPalletMap
      );
      const doOnlyRate = Number(((doOnlySimYardQty / totalQty) * 100).toFixed(2));
      doGainRate = actualRate !== null ? Number((doOnlyRate - actualRate).toFixed(2)) : doOnlyRate;
    } else {
      doTotalQty = null;
      doGainRate = null;
    }

    let doOrderCount = null;
    let doSkuCount = null;
    if (useDoPriority && hybridRes && hybridRes.doTotalQty !== null && hybridRes.doTotalQty > 0) {
      doOrderCount = hybridRes.doOrderCount;
      doSkuCount = hybridRes.doSkuCount;
    }

    const actualYardQty = actual.yardPickQty || 0;
    const diff =
      simRate !== null && actualRate !== null
        ? Number((simRate - actualRate).toFixed(2))
        : null;

    // Stochastic Realism Bridge (예상 실측 피킹률 Range Target ± 3.5%)
    const lossRate = Number(actual.blockedPickRate || 0) + Number(actual.softResetCount ? 1.5 : 0);
    const expectedCenter = simRate !== null ? Math.max(0, simRate - lossRate) : null;
    const expectedRateMin = expectedCenter !== null ? Number(Math.max(0, expectedCenter - 3.5).toFixed(2)) : null;
    const expectedRateMax = expectedCenter !== null ? Number(Math.min(100, expectedCenter + 3.5).toFixed(2)) : null;

    results.push({
      date,
      actualRate,        // 1. 실제 피킹율
      simRate,           // 2. 알고리즘 시뮬 피킹율
      actualPlanRate,    // 3. 실제 배치계획 피킹율 (검증용)
      expectedRateMin,
      expectedRateMax,
      diff,
      totalQty,
      actualYardQty,
      simYardQty,
      actualPlanYardQty,
      doTotalQty,
      doOrderCount,
      doSkuCount,
      doGainRate,
      plannedSkuCount,
      totalSkuCount: skuList.length,
      pickOrderCount: actual.pickOrderCount || 0,
      topSkus: skuList.slice(0, 10).map(s => ({
        locationId: s.itemId,
        score: typeof s.score === 'number' ? s.score.toFixed(4) : String(s.score || 0),
        orderCount: s.orderCount,
        totalQty: s.totalQty,
        rank: s.rank,
      })),
    });

    if (onProgress) onProgress(Math.round(((idx + 1) / total) * 100));
  });

  return results;
}
