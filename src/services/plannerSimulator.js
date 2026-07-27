/**
 * plannerSimulator.js
 * RWCS Planner 배치계획 시뮬레이션 엔진 (정교화 버전 v4)
 *
 * 두 가지 모드를 지원합니다:
 *
 * [1] 시뮬레이션 모드 (useActualPlan = false)
 *     Config 파라미터 기반 Lookback 랭킹 알고리즘으로 품목을 재선정하여
 *     "이 Config였다면 피킹율이 얼마였을까?"를 역산합니다.
 *
 * [2] 실제 배치계획 검증 모드 (useActualPlan = true)
 *     실제 batch_plans 데이터의 ItemId/TargetPalletQuantity를 그대로 사용하여
 *     "실제 계획이 100% 완벽하게 실행되었다면 피킹율이 얼마였을까?"를 산출합니다.
 *     결과와 실제 피킹율의 차이 = 순수 운영 손실(로봇 실패, 타이밍 지연 등)
 *
 * [공통 로직 — LocationId 기반 피킹율 계산]
 * 실제 시스템과 동일: LocationId가 야드인 것만 야드 피킹으로 산정
 *   Case 1: LocationId ∈ yardIds → 무조건 야드 피킹
 *   Case 2: LocationId ≠ yard 이지만 ItemId가 배치계획에 포함 & 야드 재고 잔량 있음 → 야드 전환
 *   Case 3: 그 외 → 랙 출고
 */

import { parseDateValue } from './dataProcessor';

// ─── 시뮬레이션 모드용 SKU 랭킹 ───────────────────────────────────

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

// ─── 시뮬레이션 모드: 용량/재고 제약 기반 야드 배치 결정 ─────────────

function determinePlannedSkus(skuList, plannerConfig, yardCapacity, availInvMap) {
  const { palletLimit, topRankPercent, topRankMargin, bottomRankCutoff, palletOption } = plannerConfig;

  if (skuList.length === 0) return new Map();

  const planned = new Map();
  let totalAllocated = 0;
  const itemsPerPallet = 50;
  const hasInventoryData = availInvMap && availInvMap.size > 0;

  for (let i = 0; i < skuList.length; i++) {
    const sku = skuList[i];
    if (bottomRankCutoff > 0 && sku.rankPercent > (100 - bottomRankCutoff)) continue;

    let requiredPallets = 1;
    if (palletOption === 'avg') {
      requiredPallets = Math.ceil(sku.avgDailyQty / itemsPerPallet);
    } else if (palletOption === 'max') {
      requiredPallets = Math.ceil(sku.maxDailyQty / itemsPerPallet);
    } else {
      requiredPallets = 1;
    }
    requiredPallets = Math.max(1, requiredPallets);

    let limit = palletLimit;
    if (sku.rankPercent <= topRankPercent) {
      limit = Math.ceil(palletLimit * (1 + topRankMargin / 100));
    }

    let required = requiredPallets;
    if (hasInventoryData) {
      const availQty = availInvMap.get(sku.itemId) || 0;
      if (availQty <= 0) continue;
      const maxAvailPallets = Math.ceil(availQty / itemsPerPallet);
      required = Math.min(limit, requiredPallets, maxAvailPallets);
    } else {
      required = Math.min(limit, requiredPallets);
    }

    const alloc = Math.min(required, yardCapacity - totalAllocated);
    if (alloc > 0) {
      planned.set(sku.itemId, alloc);
      totalAllocated += alloc;
    }

    if (totalAllocated >= yardCapacity) break;
  }

  return planned;
}

// ─── 실제 배치계획 검증 모드: batch_plans 데이터로 야드 배치 결정 ─────

function determineActualPlannedSkus(planRows, targetDate) {
  // PlanId 형식: A20260601 → 2026-06-01 날짜의 배치계획
  // targetDate (피킹일)의 전날 배치계획을 사용
  const prevDate = new Date(targetDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const compactPrevDate = prevDate.toISOString().split('T')[0].replace(/-/g, '');

  const dayPlans = planRows.filter(p => {
    if (!p.PlanId) return false;
    const m = String(p.PlanId).match(/A(\d{8})/);
    return m && m[1] === compactPrevDate;
  });

  if (dayPlans.length === 0) return { planned: new Map(), totalPlanCount: 0, dayPlanRows: [] };

  const planned = new Map();
  dayPlans.forEach(p => {
    const itemId = p.ItemId || p.itemId;
    if (!itemId) return;

    const targetPallets = Number(p.TargetPalletQuantity) || 1;
    // 동일 ItemId가 여러 행에 있으면 합산
    planned.set(itemId, (planned.get(itemId) || 0) + targetPallets);
  });

  return { planned, totalPlanCount: dayPlans.length, dayPlanRows: dayPlans };
}

// ─── LocationId 기반 시뮬레이션 피킹율 계산 (공통) ─────────────────

function calcSimDayRate(targetDate, pickingRows, yardIds, plannedSkusMap) {
  const dayPickings = pickingRows.filter(p => parseDateValue(p.ReceiveTime) === targetDate);

  const totalQty = dayPickings.reduce((s, p) => s + (Number(p.ItemQty) || 0), 0);
  if (totalQty === 0) return { simYardQty: 0, totalQty: 0, simRate: null, plannedSkuCount: plannedSkusMap.size };

  const itemsPerPallet = 50;
  const yardStock = new Map();
  plannedSkusMap.forEach((pallets, itemId) => {
    yardStock.set(itemId, pallets * itemsPerPallet);
  });

  let simYardQty = 0;

  dayPickings.forEach(p => {
    const locId = p.LocationId;
    const itemId = p.ItemId || p.Itemid || p.itemId || p.ItemID;
    const qty = Number(p.ItemQty) || 0;

    if (yardIds.has(locId)) {
      // Case 1: 원래 야드 로케이션 → 무조건 야드 피킹
      simYardQty += qty;
    } else if (plannedSkusMap.has(itemId)) {
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

  return { simYardQty, totalQty, simRate, plannedSkuCount: plannedSkusMap.size };
}

// ─── 메인 엔트리 포인트 ──────────────────────────────────────────

export function runPlannerSimulation({ pickingRows, yardIds, dates, dailyAnalytics, plannerConfig, onProgress, inventoryRows, rackRows, planRows, useActualPlan }) {
  const results = [];
  const total = dates.length;

  const rackMap = new Map(rackRows?.map(r => [r.RackId, r]) || []);
  const yardCapacity = rackRows?.filter(r => r.RackType === 'Yard' && !r.Blocked)?.length || 805;

  dates.forEach((date, idx) => {
    const actual = dailyAnalytics[date] || {};
    const actualRate = actual.totalPickQty > 0 ? Number(actual.yardPickingRate) : null;

    let plannedSkusMap;
    let skuList = [];
    let planCount = 0;

    if (useActualPlan && planRows?.length > 0) {
      // ───── 실제 배치계획 검증 모드 ─────
      const { planned, totalPlanCount } = determineActualPlannedSkus(planRows, date);
      plannedSkusMap = planned;
      planCount = totalPlanCount;

      // topSkus 표시를 위해 배치계획 데이터에서 간이 스키 리스트 생성
      const prevDate = new Date(date);
      prevDate.setDate(prevDate.getDate() - 1);
      const compactPrevDate = prevDate.toISOString().split('T')[0].replace(/-/g, '');
      const dayPlans = planRows.filter(p => {
        if (!p.PlanId) return false;
        const m = String(p.PlanId).match(/A(\d{8})/);
        return m && m[1] === compactPrevDate;
      });
      skuList = dayPlans
        .map(p => ({
          itemId: p.ItemId || p.itemId,
          score: Number(p.Score) || 0,
          orderCount: Number(p.OrderCount) || 0,
          totalQty: Number(String(p.OutboundQuantity || '0').replace(/,/g, '')) || 0,
          rank: Number(p.Rank) || 0,
          targetPallets: Number(p.TargetPalletQuantity) || 1,
        }))
        .sort((a, b) => a.rank - b.rank);
    } else {
      // ───── 시뮬레이션 모드 (Lookback 기반) ─────

      // D-1 날짜 계산
      const prevDate = new Date(date);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split('T')[0];

      // D-1에 가장 근접한 재고 스냅샷 날짜 탐색
      let targetInvDate = prevDateStr;
      if (inventoryRows && inventoryRows.length > 0) {
        const availableInvDates = Array.from(new Set(inventoryRows.map(r => parseDateValue(r.Date || r.date))));
        availableInvDates.sort((a, b) => b.localeCompare(a));
        const closestDate = availableInvDates.find(d => d && d <= prevDateStr);
        if (closestDate) targetInvDate = closestDate;
      }

      // D-1 가용 재고 집계 (Blocked 랙 제외)
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
          if (isBlocked) return;

          const qty = Number(inv.piecesOnhand || inv.piecesonhand || inv.PiecesOnHand) || 0;
          availInvMap.set(itemId, (availInvMap.get(itemId) || 0) + qty);
        });
      }

      // Lookback 기간 피킹오더 기반 SKU 랭킹
      skuList = buildSkuRanking(
        pickingRows,
        date,
        plannerConfig.lookbackPeriod,
        {
          orderCountRatio: plannerConfig.orderCountRatio,
          outboundQtyRatio: plannerConfig.outboundQtyRatio,
        }
      );

      // 용량 + 재고 제약 적용한 전진배치 품목 선정
      plannedSkusMap = determinePlannedSkus(skuList, plannerConfig, yardCapacity, availInvMap);
    }

    // LocationId 기반 시뮬레이션 피킹율 계산
    const { simYardQty, totalQty, simRate, plannedSkuCount } = calcSimDayRate(
      date,
      pickingRows,
      yardIds,
      plannedSkusMap
    );

    const actualYardQty = actual.yardPickQty || 0;
    const diff =
      simRate !== null && actualRate !== null
        ? Number((simRate - actualRate).toFixed(2))
        : null;

    results.push({
      date,
      actualRate,
      simRate,
      diff,
      totalQty,
      actualYardQty,
      simYardQty,
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
