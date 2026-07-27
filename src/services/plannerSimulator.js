/**
 * plannerSimulator.js
 * RWCS Planner 배치계획 시뮬레이션 엔진
 *
 * Config 파라미터를 입력받아, 과거 피킹오더 이력 기반으로
 * "이 Config였다면 각 날짜의 야드 피킹율이 얼마였을까?"를 역산합니다.
 *
 * [전제 조건 (낙관적 상한선)]
 * - 배치계획에 SKU가 포함되면 해당 SKU의 당일 피킹오더 전량이 야드에서 처리 가능하다고 가정
 * - 재고 충분 가정, 로봇 미션 100% 완료 가정
 */

import { parseDateValue } from './dataProcessor';

/**
 * 날짜 D 기준으로 Lookback N일 범위의 피킹오더를 집계하여 SKU 랭킹 생성
 */
function buildSkuRanking(pickingRows, targetDate, lookbackDays, scoreConfig) {
  const { orderCountRatio, outboundQtyRatio } = scoreConfig;

  // targetDate 이전 lookbackDays 일 범위
  const toDate = new Date(targetDate);
  toDate.setDate(toDate.getDate() - 1);
  const fromDate = new Date(targetDate);
  fromDate.setDate(fromDate.getDate() - lookbackDays);

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  // SKU(LocationId)별 집계
  const skuMap = new Map();

  pickingRows.forEach(p => {
    const dateStr = parseDateValue(p.ReceiveTime);
    if (!dateStr || dateStr < fromStr || dateStr > toStr) return;

    const locId = p.LocationId;
    if (!locId) return;

    const qty = Number(p.ItemQty) || 0;
    if (!skuMap.has(locId)) {
      skuMap.set(locId, { locationId: locId, orderCount: 0, totalQty: 0 });
    }
    const entry = skuMap.get(locId);
    entry.orderCount += 1;
    entry.totalQty += qty;
  });

  if (skuMap.size === 0) return [];

  // 정규화 (0~1): 최대값으로 나눔
  let maxOrderCount = 0;
  let maxTotalQty = 0;
  skuMap.forEach(v => {
    if (v.orderCount > maxOrderCount) maxOrderCount = v.orderCount;
    if (v.totalQty > maxTotalQty) maxTotalQty = v.totalQty;
  });

  const skuList = [];
  skuMap.forEach(v => {
    const normalizedOrder = maxOrderCount > 0 ? v.orderCount / maxOrderCount : 0;
    const normalizedQty = maxTotalQty > 0 ? v.totalQty / maxTotalQty : 0;
    const score =
      normalizedOrder * (orderCountRatio / 100) +
      normalizedQty * (outboundQtyRatio / 100);
    skuList.push({ ...v, score });
  });

  // 점수 내림차순 정렬
  skuList.sort((a, b) => b.score - a.score);

  // 랭킹 부여
  skuList.forEach((s, idx) => {
    s.rank = idx + 1;
    s.rankPercent = ((idx + 1) / skuList.length) * 100; // 낮을수록 상위
  });

  return skuList;
}

/**
 * SKU 랭킹을 기반으로 "배치계획에 포함될 SKU 집합" 결정
 */
function determinePlannedSkus(skuList, plannerConfig) {
  const { palletLimit, topRankPercent, topRankMargin, bottomRankCutoff } = plannerConfig;

  if (skuList.length === 0) return new Set();

  const planned = new Set();

  skuList.forEach(sku => {
    // Bottom Rank Cutoff: 하위 X% 제외 (rankPercent > 100 - cutoff 이면 하위)
    if (bottomRankCutoff > 0 && sku.rankPercent > (100 - bottomRankCutoff)) return;

    // Top Rank Margin: 상위 topRankPercent% SKU는 팔레트 기준에 마진 추가
    let effectivePalletLimit = palletLimit;
    if (sku.rankPercent <= topRankPercent) {
      effectivePalletLimit = Math.ceil(palletLimit * (1 + topRankMargin / 100));
    }

    if (effectivePalletLimit > 0) {
      planned.add(sku.locationId);
    }
  });

  return planned;
}

/**
 * 특정 날짜의 시뮬레이션 야드 피킹율 계산
 */
function calcSimDayRate(targetDate, pickingRows, yardIds, plannedSkus) {
  const dayPickings = pickingRows.filter(p => parseDateValue(p.ReceiveTime) === targetDate);

  const totalQty = dayPickings.reduce((s, p) => s + (Number(p.ItemQty) || 0), 0);
  if (totalQty === 0) return { simYardQty: 0, totalQty: 0, simRate: null, plannedSkuCount: plannedSkus.size };

  // 배치계획 SKU에 포함된 피킹오더 수량 집계
  // (실제 야드 위치는 이미 배치계획에 포함될 것이므로 union으로 처리)
  let simYardQty = 0;
  dayPickings.forEach(p => {
    const locId = p.LocationId;
    const qty = Number(p.ItemQty) || 0;
    if (plannedSkus.has(locId) || yardIds.has(locId)) {
      simYardQty += qty;
    }
  });

  // simYardQty가 totalQty를 초과할 수 없음
  simYardQty = Math.min(simYardQty, totalQty);

  const simRate = Number(((simYardQty / totalQty) * 100).toFixed(2));

  return { simYardQty, totalQty, simRate, plannedSkuCount: plannedSkus.size };
}

/**
 * 전체 날짜 범위에 대해 시뮬레이션 실행 (메인 엔트리 포인트)
 *
 * @param {Object} params
 * @param {Array}  params.pickingRows     - 전체 피킹오더 배열
 * @param {Set}    params.yardIds         - 야드 LocationId 집합
 * @param {Array}  params.dates           - 분석 대상 날짜 배열
 * @param {Object} params.dailyAnalytics  - 실제 분석 데이터
 * @param {Object} params.plannerConfig   - 플래너 Config 파라미터
 * @param {Function} params.onProgress    - 진행률 콜백 (optional)
 * @returns {Array} 날짜별 시뮬레이션 결과
 */
export function runPlannerSimulation({ pickingRows, yardIds, dates, dailyAnalytics, plannerConfig, onProgress }) {
  const results = [];
  const total = dates.length;

  dates.forEach((date, idx) => {
    const actual = dailyAnalytics[date] || {};
    const actualRate = actual.totalPickQty > 0 ? Number(actual.yardPickingRate) : null;

    // Lookback N일 피킹오더로 SKU 랭킹 생성
    const skuList = buildSkuRanking(
      pickingRows,
      date,
      plannerConfig.lookbackPeriod,
      {
        orderCountRatio: plannerConfig.orderCountRatio,
        outboundQtyRatio: plannerConfig.outboundQtyRatio,
      }
    );

    const plannedSkus = determinePlannedSkus(skuList, plannerConfig);

    const { simYardQty, totalQty, simRate, plannedSkuCount } = calcSimDayRate(
      date,
      pickingRows,
      yardIds,
      plannedSkus
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
        locationId: s.locationId,
        score: s.score.toFixed(4),
        orderCount: s.orderCount,
        totalQty: s.totalQty,
        rank: s.rank,
      })),
    });

    if (onProgress) onProgress(Math.round(((idx + 1) / total) * 100));
  });

  return results;
}
