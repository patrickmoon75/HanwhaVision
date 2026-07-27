import React, { useState, useCallback, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, Area, ComposedChart, Bar, BarChart, Cell
} from 'recharts';
import { FlaskConical, Play, RotateCcw, ChevronDown, ChevronUp, TrendingUp, Info } from 'lucide-react';
import { runPlannerSimulation } from '../services/plannerSimulator';

// ── 기본 Config (RWCS 현재 설정값과 동일) ─────────────────────────────────
const DEFAULT_CONFIG = {
  lookbackPeriod: 60,
  palletOption: 'max',
  palletLimit: 10,
  topRankPercent: 10,
  topRankMargin: 30,
  bottomRankCutoff: 0,
  orderCountRatio: 70,
  outboundQtyRatio: 30,
};

// ── 숫자 입력 컴포넌트 ────────────────────────────────────────────────────
function NumberInput({ label, value, onChange, min = 0, max = 100, step = 1, unit = '' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width: '72px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '6px',
            color: '#f1f5f9',
            padding: '5px 8px',
            fontSize: '0.85rem',
            outline: 'none',
          }}
        />
        {unit && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
    </div>
  );
}

// ── 커스텀 툴팁 ──────────────────────────────────────────────────────────
function SimTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div style={{
      background: 'rgba(17, 24, 39, 0.97)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '10px',
      padding: '12px 16px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
      color: '#fff',
      minWidth: '220px',
    }}>
      <p style={{ fontWeight: 700, color: '#a78bfa', marginBottom: '6px' }}>{data.date}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ color: '#94a3b8' }}>실제 피킹율:</span>
          <strong style={{ color: '#00f2fe' }}>
            {data.actualRate !== null ? `${data.actualRate}%` : '데이터 없음'}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ color: '#94a3b8' }}>시뮬 피킹율:</span>
          <strong style={{ color: '#a78bfa' }}>
            {data.simRate !== null ? `${data.simRate}%` : '—'}
          </strong>
        </div>
        {data.diff !== null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '4px', marginTop: '2px' }}>
            <span style={{ color: '#94a3b8' }}>개선 효과:</span>
            <strong style={{ color: data.diff >= 0 ? '#4ade80' : '#ff0844' }}>
              {data.diff >= 0 ? '+' : ''}{data.diff}%p
            </strong>
          </div>
        )}
        <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px', color: '#94a3b8', fontSize: '0.78rem' }}>
          <div>시뮬 배치 SKU: {data.plannedSkuCount?.toLocaleString()}개 / 전체 {data.totalSkuCount?.toLocaleString()}개</div>
          <div>총 출고량: {data.totalQty?.toLocaleString()} EA</div>
          <div>시뮬 야드 출고량: {data.simYardQty?.toLocaleString()} EA</div>
        </div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────
export default function PlannerSimulatorView({ pickingRows, yardIds, dates, dailyAnalytics }) {
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG });
  const [simResults, setSimResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTopSkus, setShowTopSkus] = useState(null); // 선택된 날짜
  const [showConfig, setShowConfig] = useState(true);

  const setField = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  // Score Ratio 합계가 100이 되도록 연동
  const setOrderCountRatio = (val) => {
    const clamped = Math.min(100, Math.max(0, val));
    setConfig(prev => ({ ...prev, orderCountRatio: clamped, outboundQtyRatio: 100 - clamped }));
  };
  const setOutboundQtyRatio = (val) => {
    const clamped = Math.min(100, Math.max(0, val));
    setConfig(prev => ({ ...prev, outboundQtyRatio: clamped, orderCountRatio: 100 - clamped }));
  };

  const handleRun = useCallback(() => {
    if (!pickingRows?.length || !dates?.length) return;
    setRunning(true);
    setProgress(0);
    setSimResults(null);

    // setTimeout으로 UI 블로킹 방지
    setTimeout(() => {
      try {
        const results = runPlannerSimulation({
          pickingRows,
          yardIds,
          dates,
          dailyAnalytics,
          plannerConfig: config,
          onProgress: setProgress,
        });
        setSimResults(results);
      } catch (err) {
        console.error('Simulation error:', err);
      } finally {
        setRunning(false);
        setProgress(100);
      }
    }, 50);
  }, [pickingRows, yardIds, dates, dailyAnalytics, config]);

  const handleReset = () => {
    setConfig({ ...DEFAULT_CONFIG });
    setSimResults(null);
    setProgress(0);
  };

  // 차트 데이터
  const chartData = useMemo(() => {
    if (!simResults) return [];
    return simResults.map(r => ({
      date: r.date.slice(5), // '06-01'
      fullDate: r.date,
      actualRate: r.actualRate,
      simRate: r.simRate,
      diff: r.diff,
      totalQty: r.totalQty,
      simYardQty: r.simYardQty,
      actualYardQty: r.actualYardQty,
      plannedSkuCount: r.plannedSkuCount,
      totalSkuCount: r.totalSkuCount,
      pickOrderCount: r.pickOrderCount,
    }));
  }, [simResults]);

  // 집계 통계
  const stats = useMemo(() => {
    if (!simResults || simResults.length === 0) return null;
    const valid = simResults.filter(r => r.actualRate !== null && r.simRate !== null);
    if (valid.length === 0) return null;

    const totalActualYard = valid.reduce((s, r) => s + r.actualYardQty, 0);
    const totalSimYard = valid.reduce((s, r) => s + r.simYardQty, 0);
    const totalQtyAll = valid.reduce((s, r) => s + r.totalQty, 0);

    const avgActual = totalQtyAll > 0 ? ((totalActualYard / totalQtyAll) * 100).toFixed(2) : 0;
    const avgSim = totalQtyAll > 0 ? ((totalSimYard / totalQtyAll) * 100).toFixed(2) : 0;
    const avgDiff = (Number(avgSim) - Number(avgActual)).toFixed(2);

    const improved = valid.filter(r => r.diff > 0).length;
    const worse = valid.filter(r => r.diff < 0).length;
    const same = valid.filter(r => r.diff === 0).length;

    return { avgActual, avgSim, avgDiff, improved, worse, same, totalDays: valid.length };
  }, [simResults]);

  return (
    <section className="glass-card" style={{ marginTop: '12px' }}>
      {/* 섹션 타이틀 */}
      <div className="section-title" style={{ marginBottom: '16px' }}>
        <FlaskConical color="var(--accent-purple, #a78bfa)" size={22} />
        <span style={{ color: '#a78bfa' }}>Planner 배치계획 시뮬레이터</span>
        <span style={{
          marginLeft: '8px',
          fontSize: '0.72rem',
          background: 'rgba(167,139,250,0.15)',
          color: '#a78bfa',
          padding: '2px 8px',
          borderRadius: '20px',
          border: '1px solid rgba(167,139,250,0.3)',
          fontWeight: 600
        }}>BETA</span>
      </div>

      {/* 안내 배너 */}
      <div style={{
        background: 'rgba(167,139,250,0.08)',
        border: '1px solid rgba(167,139,250,0.2)',
        borderRadius: '8px',
        padding: '8px 14px',
        fontSize: '0.8rem',
        color: '#cbd5e1',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        marginBottom: '16px',
      }}>
        <Info size={14} color="#a78bfa" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          <strong style={{ color: '#a78bfa' }}>낙관적 상한선 시뮬레이션</strong>: 배치계획에 포함된 SKU의 당일 피킹오더 전량이 야드에서 처리 가능하다는 조건으로 계산합니다.
          실제 결과는 재고 가용성 및 로봇 미션 완료율에 따라 달라질 수 있습니다.
        </span>
      </div>

      {/* ── Config 패널 ─────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '0',
        marginBottom: '16px',
        overflow: 'hidden',
      }}>
        {/* Config 헤더 (토글 가능) */}
        <div
          onClick={() => setShowConfig(v => !v)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            cursor: 'pointer',
            background: 'rgba(167,139,250,0.06)',
            borderBottom: showConfig ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚙️ Planner Config 파라미터 설정
          </span>
          {showConfig ? <ChevronUp size={16} color="#a78bfa" /> : <ChevronDown size={16} color="#a78bfa" />}
        </div>

        {showConfig && (
          <div style={{ padding: '16px' }}>
            {/* Planner Automation */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                Planner Automation
              </div>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <NumberInput
                  label="Lookback Period (일)"
                  value={config.lookbackPeriod}
                  onChange={v => setField('lookbackPeriod', Math.max(1, v))}
                  min={1} max={365} step={1} unit="일"
                />
              </div>
            </div>

            {/* Planner Options */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                Planner Options
              </div>

              {/* Pallet Option 라디오 */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Pallet Option</label>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {[
                    { val: 'max', label: 'Max Daily Outbound' },
                    { val: 'avg', label: 'Avg Daily Outbound' },
                    { val: 'target', label: 'Target Pallet Count' },
                  ].map(opt => (
                    <label key={opt.val} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem' }}>
                      <input
                        type="radio"
                        name="palletOption"
                        value={opt.val}
                        checked={config.palletOption === opt.val}
                        onChange={() => setField('palletOption', opt.val)}
                        style={{ accentColor: '#a78bfa' }}
                      />
                      <span style={{ color: config.palletOption === opt.val ? '#a78bfa' : 'var(--text-secondary)' }}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <NumberInput label="Pallet Limit" value={config.palletLimit} onChange={v => setField('palletLimit', Math.max(1, v))} min={1} max={100} />
                <NumberInput label="Top Rank Margin (%)" value={config.topRankMargin} onChange={v => setField('topRankMargin', v)} min={0} max={200} unit="%" />
                <NumberInput label="Top Rank Percent (%)" value={config.topRankPercent} onChange={v => setField('topRankPercent', v)} min={0} max={100} unit="%" />
                <NumberInput label="Bottom Rank Cutoff (%)" value={config.bottomRankCutoff} onChange={v => setField('bottomRankCutoff', v)} min={0} max={99} unit="%" />
              </div>
            </div>

            {/* Score Ratio */}
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                Score Ratio <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', fontSize: '0.75rem', color: 'var(--text-muted)' }}>(합계 = {config.orderCountRatio + config.outboundQtyRatio}%, 100이어야 함)</span>
              </div>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <NumberInput label="Order Count Ratio (%)" value={config.orderCountRatio} onChange={setOrderCountRatio} min={0} max={100} unit="%" />
                <NumberInput label="Outbound Quantity Ratio (%)" value={config.outboundQtyRatio} onChange={setOutboundQtyRatio} min={0} max={100} unit="%" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Item Volume Ratio (%)</label>
                  <div style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    0% (고정)
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 실행 버튼 ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleRun}
          disabled={running}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 24px',
            background: running ? 'rgba(167,139,250,0.3)' : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: running ? 'not-allowed' : 'pointer',
            boxShadow: running ? 'none' : '0 4px 16px rgba(167,139,250,0.4)',
            transition: 'all 0.2s',
          }}
        >
          <Play size={16} />
          {running ? `시뮬 실행 중... (${progress}%)` : '▶ 시뮬레이션 실행'}
        </button>
        <button
          onClick={handleReset}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={14} />
          기본값 초기화
        </button>
        {running && (
          <div style={{ flex: 1, maxWidth: '300px' }}>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                borderRadius: '3px',
                transition: 'width 0.2s',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ── 시뮬 결과 ─────────────────────────────────────────────────── */}
      {simResults && stats && (
        <>
          {/* KPI 요약 배지 */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div style={{
              flex: 1,
              minWidth: '180px',
              background: 'linear-gradient(135deg, rgba(0,242,254,0.1), rgba(79,172,254,0.1))',
              border: '1px solid rgba(0,242,254,0.25)',
              borderRadius: '10px',
              padding: '14px 18px',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>실제 평균 피킹율</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#00f2fe', fontFamily: 'Outfit' }}>{stats.avgActual}%</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.5rem', color: 'var(--text-muted)' }}>→</div>
            <div style={{
              flex: 1,
              minWidth: '180px',
              background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(124,58,237,0.1))',
              border: '1px solid rgba(167,139,250,0.3)',
              borderRadius: '10px',
              padding: '14px 18px',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>시뮬 평균 피킹율</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#a78bfa', fontFamily: 'Outfit' }}>{stats.avgSim}%</div>
            </div>
            <div style={{
              flex: 1,
              minWidth: '180px',
              background: Number(stats.avgDiff) >= 0
                ? 'linear-gradient(135deg, rgba(74,222,128,0.1), rgba(16,185,129,0.08))'
                : 'linear-gradient(135deg, rgba(255,8,68,0.1), rgba(255,100,100,0.05))',
              border: Number(stats.avgDiff) >= 0 ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,8,68,0.3)',
              borderRadius: '10px',
              padding: '14px 18px',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>평균 개선 효과</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: Number(stats.avgDiff) >= 0 ? '#4ade80' : '#ff0844', fontFamily: 'Outfit' }}>
                {Number(stats.avgDiff) >= 0 ? '+' : ''}{stats.avgDiff}%p
              </div>
            </div>
            <div style={{
              flex: 1,
              minWidth: '180px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              padding: '14px 18px',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>일자별 개선/악화</div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: '#4ade80', fontWeight: 700 }}>▲ {stats.improved}일</span>
                <span style={{ color: '#ff0844', fontWeight: 700 }}>▼ {stats.worse}일</span>
                <span style={{ color: '#94a3b8', fontWeight: 700 }}>— {stats.same}일</span>
              </div>
            </div>
          </div>

          {/* 비교 차트 */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a78bfa', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={15} />
              실제 피킹율 vs 시뮬레이션 피킹율 비교
            </div>
            <div style={{ height: 280, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 16, right: 30, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="simAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} stroke="var(--text-secondary)" tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip content={<SimTooltip />} />
                  {/* 개선 효과 영역 */}
                  <Area
                    type="monotone"
                    dataKey="simRate"
                    fill="url(#simAreaGradient)"
                    stroke="none"
                    dot={false}
                    activeDot={false}
                  />
                  {/* 실제 피킹율 */}
                  <Line
                    type="monotone"
                    dataKey="actualRate"
                    stroke="#00f2fe"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#00f2fe', stroke: '#000', strokeWidth: 1 }}
                    activeDot={{ r: 7, fill: '#00f2fe' }}
                    name="실제 피킹율"
                    connectNulls={true}
                  />
                  {/* 시뮬 피킹율 */}
                  <Line
                    type="monotone"
                    dataKey="simRate"
                    stroke="#a78bfa"
                    strokeWidth={2.5}
                    strokeDasharray="6 3"
                    dot={{ r: 3, fill: '#a78bfa', stroke: '#000', strokeWidth: 1 }}
                    activeDot={{ r: 7, fill: '#a78bfa' }}
                    name="시뮬 피킹율"
                    connectNulls={true}
                  />
                  <Legend
                    iconType="line"
                    wrapperStyle={{ fontSize: '0.82rem', paddingTop: '8px' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 개선폭(diff) 막대 차트 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
              일자별 Config 변경 개선 효과 (시뮬 - 실제, %p)
            </div>
            <div style={{ height: 130, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 30, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
                  <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 10 }} unit="%p" />
                  <Tooltip
                    contentStyle={{ background: '#111827', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '8px', color: '#f1f5f9', fontSize: '0.82rem' }}
                    formatter={(val) => [`${val >= 0 ? '+' : ''}${val}%p`, '개선 효과']}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                  <Bar
                    dataKey="diff"
                    name="개선 효과"
                    radius={[3, 3, 0, 0]}
                    label={false}
                  >
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.diff !== null ? (entry.diff >= 0 ? '#4ade80' : '#ff0844') : '#94a3b8'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 일자별 상세 테이블 */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', marginBottom: '8px' }}>일자별 상세 비교 테이블</div>
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '320px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(167,139,250,0.1)', position: 'sticky', top: 0, zIndex: 1 }}>
                    {['날짜', '피킹오더', '총출고량', '실제 야드', '시뮬 야드', '실제율', '시뮬율', '개선폭', '배치SKU', '전체SKU'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'center', color: '#a78bfa', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: '1px solid rgba(167,139,250,0.2)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {simResults.map((r, idx) => (
                    <tr
                      key={r.date}
                      style={{
                        background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: '#f1f5f9', fontWeight: 600 }}>{r.date}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{r.pickOrderCount}건</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{r.totalQty.toLocaleString()}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: '#00f2fe' }}>{r.actualYardQty.toLocaleString()}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: '#a78bfa' }}>{r.simYardQty.toLocaleString()}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: '#00f2fe', fontWeight: 700 }}>
                        {r.actualRate !== null ? `${r.actualRate}%` : '—'}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: '#a78bfa', fontWeight: 700 }}>
                        {r.simRate !== null ? `${r.simRate}%` : '—'}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: r.diff === null ? '#94a3b8' : r.diff > 0 ? '#4ade80' : r.diff < 0 ? '#ff0844' : '#94a3b8' }}>
                        {r.diff !== null ? `${r.diff >= 0 ? '+' : ''}${r.diff}%p` : '—'}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{r.plannedSkuCount.toLocaleString()}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{r.totalSkuCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 실행 전 안내 */}
      {!simResults && !running && (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          color: 'var(--text-muted)',
          border: '2px dashed rgba(167,139,250,0.2)',
          borderRadius: '12px',
        }}>
          <FlaskConical size={40} color="rgba(167,139,250,0.3)" style={{ marginBottom: '12px' }} />
          <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#a78bfa', opacity: 0.6 }}>
            Config 파라미터를 설정하고 시뮬레이션을 실행하세요
          </p>
          <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>
            과거 {dates?.length || 0}일치 데이터를 기반으로 배치계획을 재시뮬레이션합니다
          </p>
        </div>
      )}
    </section>
  );
}
