import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, Area, ComposedChart, Bar, BarChart, Cell, LabelList
} from 'recharts';
import { FlaskConical, Play, RotateCcw, ChevronDown, ChevronUp, TrendingUp, Info, X, Upload, FileSpreadsheet, Save, Trash2, FolderOpen, Edit2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { runPlannerSimulation } from '../services/plannerSimulator';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { formatWithDayOfWeek } from '../services/dataProcessor';

// ── 기본 Config (RWCS 고도화 설정값) ─────────────────────────────────
const DEFAULT_CONFIG = {
  lookbackPeriod: 90,
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
      minWidth: '240px',
    }}>
      <p style={{ fontWeight: 700, color: '#a78bfa', marginBottom: '6px' }}>{formatWithDayOfWeek(data.fullDate)}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ color: '#94a3b8' }}>실제 피킹율:</span>
          <strong style={{ color: '#00f2fe' }}>
            {data.actualRate !== null ? `${data.actualRate}%` : '데이터 없음'}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ color: '#94a3b8' }}>DO반영 알고리즘 시뮬 피킹율:</span>
          <strong style={{ color: '#a78bfa' }}>
            {data.simRate !== null ? `${data.simRate}%` : '—'}
          </strong>
        </div>
        {data.actualPlanRate !== null && data.actualPlanRate !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ color: '#94a3b8' }}>실제 배치계획 피킹율:</span>
            <strong style={{ color: '#f59e0b' }}>
              {`${data.actualPlanRate}%`}
            </strong>
          </div>
        )}
        {data.diff !== null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '4px', marginTop: '2px' }}>
            <span style={{ color: '#94a3b8' }}>알고리즘 개선 효과:</span>
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
export default function PlannerSimulatorView({ 
  pickingRows, 
  yardIds, 
  dates, 
  dailyAnalytics,
  selectedDate,
  onSelectDate,
  startDate,
  endDate,
  onRangeChange,
  inventoryRows,
  rackRows,
  planRows,
  rawDatasets,
  pendingOrderRows,
  dataSource
}) {
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG });
  const [lineVisibility, setLineVisibility] = useState({
    actualRate: true,
    simRate: true,
    actualPlanRate: true,
  });

  const toggleLine = (key) => {
    setLineVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const [simResults, setSimResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTopSkus, setShowTopSkus] = useState(null); // 선택된 날짜
  const [showConfig, setShowConfig] = useState(true);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [useActualPlan, setUseActualPlan] = useState(false); // 실제 배치계획 검증 모드
  const [useDoPriority, setUseDoPriority] = useState(true); // 1단계 확정 DO 최우선 선할당 토글
  const [customDoRows, setCustomDoRows] = useState(null); // 사용자가 직접 입력/업로드한 DO (pending_orders)
  const [customDoFileName, setCustomDoFileName] = useState('');
  const doFileInputRef = useRef(null);

  // Supabase History States
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // 이력 목록 조회
  const fetchHistory = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('simulation_history')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to fetch simulation history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      fetchHistory();
    }
  }, [fetchHistory]);

  // 시뮬레이션 설정 및 결과 저장
  const saveCurrentSimulation = async () => {
    if (!isSupabaseConfigured || !supabase) {
      alert("Supabase 데이터베이스가 설정되지 않았습니다.");
      return;
    }
    if (!stats) {
      alert("저장할 시뮬레이션 결과가 없습니다. 먼저 시뮬레이션을 수행해 주세요.");
      return;
    }

    const memo = prompt("시뮬레이션 설정을 식별할 메모를 입력해 주세요:", `시뮬레이션 - ${new Date().toLocaleDateString('ko-KR')}`);
    if (memo === null) return; // 취소

    setSavingHistory(true);
    try {
      const { error } = await supabase
        .from('simulation_history')
        .insert({
          memo: memo.trim() || `시뮬레이션 - ${new Date().toLocaleDateString('ko-KR')}`,
          config_json: config,
          results_summary_json: stats,
          start_date: startDate,
          end_date: endDate
        });
      if (error) throw error;
      alert("시뮬레이션 설정 및 결과가 성공적으로 저장되었습니다.");
      fetchHistory();
    } catch (err) {
      console.error('Failed to save simulation history:', err);
      alert('저장 실패: ' + err.message);
    } finally {
      setSavingHistory(false);
    }
  };

  // 이력 설정 불러오기
  const loadHistoryConfig = (historyItem) => {
    if (!historyItem) return;
    setConfig(historyItem.config_json);
    if (onRangeChange) {
      onRangeChange(historyItem.start_date, historyItem.end_date);
    }
    alert(`"${historyItem.memo}" 설정이 로드되었습니다.\n[시뮬레이션 실행] 버튼을 눌러 결과를 다시 계산할 수 있습니다.`);
  };

  // 이력 삭제
  const deleteHistoryItem = async (id) => {
    if (!isSupabaseConfigured || !supabase) return;
    if (!confirm("해당 시뮬레이션 이력을 정말 삭제하시겠습니까?")) return;
    try {
      const { error } = await supabase
        .from('simulation_history')
        .delete()
        .eq('id', id);
      if (error) throw error;
      alert("성공적으로 삭제되었습니다.");
      fetchHistory();
    } catch (err) {
      console.error('Failed to delete history item:', err);
      alert('삭제 실패: ' + err.message);
    }
  };

  // 이력 메모 수정
  const updateHistoryMemo = async (id, currentMemo) => {
    if (!isSupabaseConfigured || !supabase) return;
    const newMemo = prompt("수정할 메모 내용을 입력해 주세요:", currentMemo);
    if (newMemo === null) return; // 취소
    
    try {
      const { error } = await supabase
        .from('simulation_history')
        .update({ memo: newMemo.trim() || '이름 없음' })
        .eq('id', id);
      if (error) throw error;
      alert("메모가 수정되었습니다.");
      fetchHistory();
    } catch (err) {
      console.error('Failed to update history memo:', err);
      alert('메모 수정 실패: ' + err.message);
    }
  };

  const handleDoFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.Sheets['미출고DO'] || workbook.Sheets['미출고오더'] || workbook.Sheets['PendingDO'] || workbook.Sheets['PendingOrders'] || workbook.Sheets['pending_orders'] || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (!rows || rows.length === 0) {
          alert("선택하신 파일에서 데이터 행을 파싱하지 못했습니다.");
          return;
        }

        setCustomDoRows(rows);
        setCustomDoFileName(file.name);
        alert(`DO(Pending Orders) 파일 '${file.name}' (${rows.length.toLocaleString()}건)이 수집되었습니다!\nDB/기본 데이터 대신 이 입력 파일으로 분석합니다.`);
      } catch (err) {
        alert("DO 파일 파싱 중 오류가 발생했습니다: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleClearCustomDo = () => {
    setCustomDoRows(null);
    setCustomDoFileName('');
  };

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

    // 사용자가 입력한 커스텀 DO 파일 데이터가 최우선 순위
    const pendingOrders = customDoRows || pendingOrderRows || rawDatasets?.pendingOrderRows || [];

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
          inventoryRows,
          rackRows,
          planRows,
          pendingOrderRows: pendingOrders,
          useActualPlan,
          useDoPriority
        });
        setSimResults(results);
      } catch (err) {
        console.error('Simulation error:', err);
        alert('시뮬레이션 연산 중 오류가 발생했습니다: ' + err.message);
      } finally {
        setRunning(false);
        setProgress(100);
      }
    }, 50);
  }, [pickingRows, yardIds, dates, dailyAnalytics, config, inventoryRows, rackRows, planRows, customDoRows, pendingOrderRows, rawDatasets, useActualPlan, useDoPriority]);

  const handleReset = () => {
    setConfig({ ...DEFAULT_CONFIG });
    setSimResults(null);
    setProgress(0);
  };

  // 차트 데이터 (조회 기간 startDate ~ endDate 로 필터링)
  const chartData = useMemo(() => {
    if (!simResults) return [];
    return simResults
      .filter(r => r.date >= startDate && r.date <= endDate)
      .map(r => ({
        date: r.date.slice(5), // '06-01'
        fullDate: r.date,
        actualRate: r.actualRate,
        simRate: r.simRate,
        actualPlanRate: r.actualPlanRate,
        diff: r.diff,
        totalQty: r.totalQty,
        simYardQty: r.simYardQty,
        actualYardQty: r.actualYardQty,
        actualPlanYardQty: r.actualPlanYardQty,
        plannedSkuCount: r.plannedSkuCount,
        totalSkuCount: r.totalSkuCount,
        pickOrderCount: r.pickOrderCount,
      }));
  }, [simResults, startDate, endDate]);

  // 3종 그래프별로 데이터가 있는 날만 추출하여 기간 평균 피킹율 계산 (가중평균: 총야드출고량 / 총전체출고량)
  const periodAvgStats = useMemo(() => {
    if (!simResults || simResults.length === 0) return { avgActual: '0.00', avgSim: '0.00', avgPlan: '0.00' };
    const filteredResults = simResults.filter(r => r.date >= startDate && r.date <= endDate);

    // 1. 실제 피킹율 평균
    const actualValid = filteredResults.filter(r => r.actualRate !== null);
    const totalActualYard = actualValid.reduce((s, r) => s + (r.actualYardQty || 0), 0);
    const totalActualQty = actualValid.reduce((s, r) => s + (r.totalQty || 0), 0);
    const avgActual = totalActualQty > 0 ? ((totalActualYard / totalActualQty) * 100).toFixed(2) : '0.00';

    // 2. 알고리즘 시뮬 피킹율 평균
    const simValid = filteredResults.filter(r => r.simRate !== null);
    const totalSimYard = simValid.reduce((s, r) => s + (r.simYardQty || 0), 0);
    const totalSimQty = simValid.reduce((s, r) => s + (r.totalQty || 0), 0);
    const avgSim = totalSimQty > 0 ? ((totalSimYard / totalSimQty) * 100).toFixed(2) : '0.00';

    // 3. 실제 배치계획 피킹율 평균
    const planValid = filteredResults.filter(r => r.actualPlanRate !== null && r.actualPlanRate !== undefined);
    const totalPlanYard = planValid.reduce((s, r) => s + (r.actualPlanYardQty || 0), 0);
    const totalPlanQty = planValid.reduce((s, r) => s + (r.totalQty || 0), 0);
    const avgPlan = totalPlanQty > 0 ? ((totalPlanYard / totalPlanQty) * 100).toFixed(2) : '0.00';

    return { avgActual, avgSim, avgPlan };
  }, [simResults, startDate, endDate]);

  // 집계 통계 (조회 기간 startDate ~ endDate 로 필터링)
  const stats = useMemo(() => {
    if (!simResults || simResults.length === 0) return null;
    const filteredResults = simResults.filter(r => r.date >= startDate && r.date <= endDate);
    const valid = filteredResults.filter(r => r.actualRate !== null && r.simRate !== null);
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

    return { 
      avgActual, 
      avgSim, 
      avgDiff, 
      improved, 
      worse, 
      same, 
      totalDays: valid.length,
      totalQtyAll,
      totalActualYard,
      totalSimYard
    };
  }, [simResults, startDate, endDate]);

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

      {/* ── 실행 버튼 및 기간 연동 컨트롤 영역 ─────────────────────────────────── */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px', 
        flexWrap: 'wrap',
        gap: '12px' 
      }}>
        {/* 실행 버튼 */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
            {running ? `시뮬 실행 중... (${progress}%)` : '시뮬레이션 실행'}
          </button>
          {/* 확정 DO 우선 배치 토글 */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            padding: '8px 14px',
            background: useDoPriority ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)',
            border: useDoPriority ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            transition: 'all 0.2s'
          }}>
            <input
              type="checkbox"
              checked={useDoPriority}
              onChange={(e) => setUseDoPriority(e.target.checked)}
              style={{ accentColor: '#a78bfa', width: '16px', height: '16px' }}
            />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: useDoPriority ? '#a78bfa' : 'var(--text-secondary)' }}>
              확정 DO 우선 배치
            </span>
          </label>

          {/* Supabase / 로컬 엑셀 / 사용자 직접 입력 Pending Orders 수집 연동 상태 표시 배지 */}
          {(() => {
            const pendingOrders = customDoRows || pendingOrderRows || rawDatasets?.pendingOrderRows || [];
            const count = pendingOrders.length;
            const isCustom = customDoRows !== null;
            const hasData = count > 0;
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: isCustom ? 'rgba(16, 185, 129, 0.2)' : (hasData ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.1)'),
                  border: isCustom ? '1px solid rgba(16, 185, 129, 0.6)' : (hasData ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.2)'),
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: isCustom ? '#34d399' : (hasData ? '#10b981' : '#94a3b8')
                }}
                title={isCustom ? `사용자가 직접 입력한 DO 파일(${customDoFileName}) 데이터 ${count.toLocaleString()}건으로 분석 중` : (hasData ? `Supabase DB 또는 로컬 엑셀 시트('미출고DO' / 'PendingDO')에서 ${count.toLocaleString()}건 수집됨` : 'Supabase DB 또는 엑셀에 미출고 DO 데이터가 없어 당일 오더 데이터를 Fallback으로 사용합니다.')}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isCustom ? '#34d399' : (hasData ? '#10b981' : '#94a3b8'), display: 'inline-block' }}></span>
                <span>
                  {isCustom 
                    ? `DO 파일 적용됨 (${count.toLocaleString()}건)`
                    : (hasData ? `Pending Orders 연동됨 (${count.toLocaleString()}건)` : 'Pending Orders 미연동 (Fallback 사용)')}
                </span>
              </div>
            );
          })()}

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
          <button 
            onClick={() => setIsInfoOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: 'rgba(167, 139, 250, 0.1)',
              border: '1px solid rgba(167, 139, 250, 0.25)',
              borderRadius: '8px',
              color: '#a78bfa',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(167, 139, 250, 0.18)';
              e.currentTarget.style.boxShadow = '0 0 10px rgba(167, 139, 250, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(167, 139, 250, 0.1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Info size={14} />
            상세 설명
          </button>

          {/* DO (Pending Orders) 전용 파일 직접 입력 버튼 & Hidden Input */}
          <input
            type="file"
            ref={doFileInputRef}
            onChange={handleDoFileUpload}
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
          />

          {customDoRows ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                background: 'rgba(16, 185, 129, 0.18)',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                borderRadius: '8px',
                color: '#34d399',
                fontSize: '0.85rem',
                fontWeight: 700,
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.2)'
              }}
            >
              <FileSpreadsheet size={16} />
              <span>DO 파일: {customDoFileName} ({customDoRows.length.toLocaleString()}건)</span>
              <button
                onClick={handleClearCustomDo}
                title="업로드된 DO 파일 제거 및 기본 DB/데이터로 원복"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  color: '#34d399',
                  cursor: 'pointer',
                  padding: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: '4px'
                }}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => doFileInputRef.current?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(167, 139, 250, 0.2))',
                border: '1px solid rgba(56, 189, 248, 0.5)',
                borderRadius: '8px',
                color: '#38bdf8',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(56, 189, 248, 0.2)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.35), rgba(167, 139, 250, 0.35))';
                e.currentTarget.style.boxShadow = '0 0 14px rgba(56, 189, 248, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(167, 139, 250, 0.2))';
                e.currentTarget.style.boxShadow = '0 2px 10px rgba(56, 189, 248, 0.2)';
              }}
              title="DB 대신 시뮬레이션에 사용할 미출고 DO (pending orders) 엑셀/CSV 파일을 직접 첨부합니다."
            >
              <Upload size={15} />
              📁 DO 파일 입력 (Pending Orders)
            </button>
          )}
          {running && (
            <div style={{ width: '120px' }}>
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

        {/* 우측: 조회 기간 셀렉터 및 평균 피킹율 정보 요약 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            fontSize: '0.85rem'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>조회 기간:</span>
            <select
              value={startDate}
              onChange={(e) => onRangeChange && onRangeChange(e.target.value, endDate)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '0.83rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {dates.map(d => (
                <option key={`sim-start-${d}`} value={d} disabled={endDate && d > endDate} style={{ background: '#111827', color: '#fff' }}>
                  {formatWithDayOfWeek(d)}
                </option>
              ))}
            </select>
            <span style={{ color: 'var(--text-secondary)' }}>~</span>
            <select
              value={endDate}
              onChange={(e) => onRangeChange && onRangeChange(startDate, e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '0.83rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {dates.map(d => (
                <option key={`sim-end-${d}`} value={d} disabled={startDate && d < startDate} style={{ background: '#111827', color: '#fff' }}>
                  {formatWithDayOfWeek(d)}
                </option>
              ))}
            </select>
          </div>

          <div style={{
            background: 'rgba(167, 139, 250, 0.1)',
            border: '1px solid rgba(167, 139, 250, 0.25)',
            borderRadius: '8px',
            padding: '6px 14px',
            fontSize: '0.82rem',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>선택 기간 평균 피킹율:</span>
            {stats ? (
              <>
                <span style={{ color: '#00f2fe', fontWeight: 800 }}>실제 {stats.avgActual}%</span>
                <span style={{ color: 'var(--text-muted)' }}>|</span>
                <span style={{ color: '#a78bfa', fontWeight: 800 }}>시뮬 {stats.avgSim}%</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  (야드 {stats.totalActualYard.toLocaleString()} → {stats.totalSimYard.toLocaleString()} / 전체 {stats.totalQtyAll.toLocaleString()} EA)
                </span>
              </>
            ) : (
              (() => {
                const filteredDates = dates.filter(d => d >= startDate && d <= endDate);
                const totalPeriodYardQty = filteredDates.reduce((sum, d) => sum + (dailyAnalytics[d]?.yardPickQty || 0), 0);
                const totalPeriodPickQty = filteredDates.reduce((sum, d) => sum + (dailyAnalytics[d]?.totalPickQty || 0), 0);
                const periodAvgRate = totalPeriodPickQty > 0
                  ? ((totalPeriodYardQty / totalPeriodPickQty) * 100).toFixed(2)
                  : '0.00';
                return (
                  <>
                    <span style={{ color: '#00f2fe', fontWeight: 800 }}>실제 {periodAvgRate}%</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      (야드 {totalPeriodYardQty.toLocaleString()} / 전체 {totalPeriodPickQty.toLocaleString()} EA)
                    </span>
                  </>
                );
              })()
            )}
          </div>
        </div>
      </div>

      {/* ── 시뮬 결과 ─────────────────────────────────────────────────── */}
      {simResults && stats && (
        <>
          {/* Supabase 시뮬레이션 이력 제어 툴바 */}
          {isSupabaseConfigured && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button 
                onClick={saveCurrentSimulation}
                disabled={savingHistory}
                className="btn-primary"
                style={{ 
                  padding: '6px 14px', 
                  fontSize: '0.8rem', 
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: savingHistory ? 'not-allowed' : 'pointer'
                }}
              >
                <Save size={14} />
                <span>{savingHistory ? '저장 중...' : '시뮬레이션 이력 저장'}</span>
              </button>
              <button 
                onClick={() => setShowHistoryPanel(v => !v)}
                className="btn-secondary"
                style={{ 
                  padding: '6px 14px', 
                  fontSize: '0.8rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  borderColor: 'rgba(167, 139, 250, 0.3)',
                  color: '#a78bfa',
                  cursor: 'pointer'
                }}
              >
                <FolderOpen size={14} />
                <span>저장된 이력 불러오기 ({history.length}건)</span>
                {showHistoryPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          )}

          {/* 이력 목록 패널 */}
          {isSupabaseConfigured && showHistoryPanel && (
            <div className="glass-card" style={{ 
              padding: '20px', 
              marginBottom: '20px', 
              background: 'rgba(0,0,0,0.3)', 
              border: '1px solid rgba(167, 139, 250, 0.2)',
              borderRadius: '12px'
            }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#a78bfa', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FolderOpen size={16} />
                Supabase 시뮬레이션 설정/결과 이력
              </h3>
              {loadingHistory ? (
                <div style={{ padding: '30px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  데이터베이스에서 이력을 가져오는 중...
                </div>
              ) : history.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  저장된 시뮬레이션 이력이 없습니다.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse', color: '#f1f5f9' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '10px 8px', textAlign: 'left' }}>저장 일시</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left' }}>메모</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left' }}>분석 대상 기간</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>실제 평균</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>시뮬 평균</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>개선 효과</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>동작</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(item => {
                        const summary = item.results_summary_json || {};
                        const isPositive = Number(summary.avgDiff) >= 0;
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', transition: 'background-color 0.2s' }}>
                            <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>
                              {new Date(item.created_at).toLocaleString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td style={{ padding: '10px 8px', fontWeight: 700, color: '#f1f5f9' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{item.memo}</span>
                                <button
                                  type="button"
                                  onClick={() => updateHistoryMemo(item.id, item.memo)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#a78bfa',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '2px',
                                    opacity: 0.6,
                                    transition: 'opacity 0.2s, transform 0.2s'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.15)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.transform = 'scale(1)'; }}
                                  title="메모 수정"
                                >
                                  <Edit2 size={12} />
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '10px 8px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                              {formatWithDayOfWeek(item.start_date)} ~ {formatWithDayOfWeek(item.end_date)}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', color: '#00f2fe', fontWeight: 600 }}>{summary.avgActual}%</td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', color: '#a78bfa', fontWeight: 600 }}>{summary.avgSim}%</td>
                            <td style={{ 
                              padding: '10px 8px', 
                              textAlign: 'center', 
                              color: isPositive ? '#4ade80' : '#ff0844', 
                              fontWeight: 700 
                            }}>
                              {isPositive ? '+' : ''}{summary.avgDiff}%p
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button 
                                  onClick={() => loadHistoryConfig(item)}
                                  className="btn-secondary"
                                  style={{ 
                                    padding: '2px 8px', 
                                    fontSize: '0.72rem', 
                                    height: '24px', 
                                    borderRadius: '4px',
                                    borderColor: 'rgba(0, 242, 254, 0.4)',
                                    color: 'var(--accent-cyan)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  불러오기
                                </button>
                                <button 
                                  onClick={() => deleteHistoryItem(item.id)}
                                  className="btn-secondary"
                                  style={{ 
                                    padding: '2px 8px', 
                                    fontSize: '0.72rem', 
                                    height: '24px', 
                                    borderRadius: '4px',
                                    borderColor: 'rgba(239, 68, 68, 0.3)',
                                    color: '#ef4444',
                                    cursor: 'pointer'
                                  }}
                                >
                                  삭제
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

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

            {/* Stochastic Realism Bridge 카드 */}
            <div style={{
              flex: 1.4,
              minWidth: '230px',
              background: 'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(168,85,247,0.12))',
              border: '1px solid rgba(56,189,248,0.35)',
              borderRadius: '10px',
              padding: '14px 18px',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🎯 Stochastic Realism Bridge</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9', fontFamily: 'Outfit' }}>
                {Math.max(0, Number(stats.avgSim) - 4.5).toFixed(1)}% ~ {Math.min(100, Number(stats.avgSim) - 1.5).toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '4px' }}>
                이론상 최대 <strong style={{ color: '#a78bfa' }}>{stats.avgSim}%</strong> (현장 예측 Range ±3.5%)
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

          {/* 선택일 상세 시뮬레이션 결과 */}
          {(() => {
            const selectedResult = simResults.find(r => r.date === selectedDate);
            if (!selectedResult) return null;
            const diffVal = selectedResult.diff;
            return (
              <div style={{
                background: 'rgba(167, 139, 250, 0.08)',
                border: '1px solid rgba(167, 139, 250, 0.25)',
                borderRadius: '10px',
                padding: '12px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>선택된 날짜:</span>
                  <strong style={{ fontSize: '1.05rem', color: '#a78bfa', marginLeft: '6px' }}>{formatWithDayOfWeek(selectedDate)}</strong>
                </div>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                  <div>실제 피킹율: <strong style={{ color: '#00f2fe' }}>{selectedResult.actualRate !== null ? `${selectedResult.actualRate}%` : '—'}</strong></div>
                  <div>시뮬 피킹율: <strong style={{ color: '#a78bfa' }}>{selectedResult.simRate !== null ? `${selectedResult.simRate}%` : '—'}</strong></div>
                  <div>개선 효과: <strong style={{ color: diffVal >= 0 ? '#4ade80' : '#ff0844' }}>{diffVal !== null ? `${diffVal >= 0 ? '+' : ''}${diffVal}%p` : '—'}</strong></div>
                  <div>출고 정보: <span style={{ color: 'var(--text-secondary)' }}>야드출고 {selectedResult.simYardQty.toLocaleString()} EA / 총출고 {selectedResult.totalQty.toLocaleString()} EA</span></div>
                  <div>배치 SKU: <span style={{ color: 'var(--text-secondary)' }}>{selectedResult.plannedSkuCount.toLocaleString()}개 / 전체 {selectedResult.totalSkuCount.toLocaleString()}개</span></div>
                </div>
              </div>
            );
          })()}

          {/* 비교 차트 */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={15} />
                  피킹율 3종 비교 그래프
                </div>
                
                {/* 범례 클릭 온/오프 토글 바 */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.78rem' }}>
                  <button
                    onClick={() => toggleLine('actualRate')}
                    style={{
                      background: lineVisibility.actualRate ? 'rgba(0,242,254,0.18)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${lineVisibility.actualRate ? '#00f2fe' : 'rgba(255,255,255,0.15)'}`,
                      color: lineVisibility.actualRate ? '#00f2fe' : '#64748b',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '2px',
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#00f2fe' }}></span>
                      실제 피킹율
                    </div>
                    {periodAvgStats && (
                      <span style={{ fontSize: '0.8rem', marginLeft: '13px', fontWeight: 800 }}>
                        (평균 {periodAvgStats.avgActual}%)
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => toggleLine('simRate')}
                    style={{
                      background: lineVisibility.simRate ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${lineVisibility.simRate ? '#a78bfa' : 'rgba(255,255,255,0.15)'}`,
                      color: lineVisibility.simRate ? '#a78bfa' : '#64748b',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '2px',
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#a78bfa' }}></span>
                      DO반영 알고리즘 시뮬 피킹율
                    </div>
                    {periodAvgStats && (
                      <span style={{ fontSize: '0.8rem', marginLeft: '13px', fontWeight: 800 }}>
                        (평균 {periodAvgStats.avgSim}%)
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => toggleLine('actualPlanRate')}
                    style={{
                      background: lineVisibility.actualPlanRate ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${lineVisibility.actualPlanRate ? '#f59e0b' : 'rgba(255,255,255,0.15)'}`,
                      color: lineVisibility.actualPlanRate ? '#f59e0b' : '#64748b',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '2px',
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span>
                      실제 배치계획 피킹율
                    </div>
                    {periodAvgStats && (
                      <span style={{ fontSize: '0.8rem', marginLeft: '13px', fontWeight: 800 }}>
                        (평균 {periodAvgStats.avgPlan}%)
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div style={{
                fontSize: '0.76rem',
                color: '#fbbf24',
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.28)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontWeight: 500,
                lineHeight: 1.45,
                maxWidth: '680px'
              }}>
                <div style={{ fontWeight: 700, marginBottom: '2px', color: '#f59e0b' }}>
                  💡 (참고)
                </div>
                <div>1. 알고리즘 시뮬 피킹율이 높은 것은 과거 출고통계를 기반으로 과거 피킹율을 분석하였기 때문에 기본적으로 높음.</div>
                <div>2. 실제 배치계획 피킹율은 실제 해당일의 재고상황이 반영되지 않고 계획대로 야드수만큼 배치한다고 가정하고 있음.</div>
              </div>
            </div>
            <div style={{ height: 320, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart 
                  data={chartData} 
                  margin={{ top: 24, right: 30, left: 0, bottom: 8 }}
                  onClick={(e) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      const clickedDate = e.activePayload[0].payload.fullDate;
                      onSelectDate && onSelectDate(clickedDate);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
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
                  {lineVisibility.simRate && (
                    <Area
                      type="monotone"
                      dataKey="simRate"
                      fill="url(#simAreaGradient)"
                      stroke="none"
                      dot={false}
                      activeDot={false}
                    />
                  )}

                  {/* 1. 실제 피킹율 */}
                  {lineVisibility.actualRate && (
                    <Line
                      type="monotone"
                      dataKey="actualRate"
                      stroke="#00f2fe"
                      strokeWidth={2.5}
                      activeDot={{ r: 9, fill: '#00f2fe' }}
                      name="실제 피킹율"
                      connectNulls={true}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        if (!payload || payload.actualRate === null || cx === undefined || cy === undefined) return null;
                        const isSel = payload.fullDate === selectedDate;
                        return (
                          <circle
                            key={`act-${payload.fullDate}`}
                            cx={cx}
                            cy={cy}
                            r={isSel ? 7 : 3.5}
                            fill={isSel ? '#00f2fe' : '#4facfe'}
                            stroke={isSel ? '#ffffff' : '#000000'}
                            strokeWidth={isSel ? 3 : 1}
                            style={{ cursor: 'pointer' }}
                            onClick={() => onSelectDate && onSelectDate(payload.fullDate)}
                          />
                        );
                      }}
                    >
                      <LabelList
                        dataKey="actualRate"
                        position="bottom"
                        formatter={(v) => (v !== null && v !== undefined ? `${v}%` : '')}
                        style={{ fill: '#00f2fe', fontSize: 9.5, fontWeight: 700 }}
                        offset={6}
                      />
                    </Line>
                  )}

                  {/* 2. 알고리즘 시뮬 피킹율 */}
                  {lineVisibility.simRate && (
                    <Line
                      type="monotone"
                      dataKey="simRate"
                      stroke="#a78bfa"
                      strokeWidth={2.5}
                      strokeDasharray="6 3"
                      activeDot={{ r: 9, fill: '#a78bfa' }}
                      name="DO반영 알고리즘 시뮬 피킹율"
                      connectNulls={true}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        if (!payload || payload.simRate === null || cx === undefined || cy === undefined) return null;
                        const isSel = payload.fullDate === selectedDate;
                        return (
                          <circle
                            key={`sim-${payload.fullDate}`}
                            cx={cx}
                            cy={cy}
                            r={isSel ? 7 : 3.5}
                            fill={isSel ? '#a78bfa' : '#7c3aed'}
                            stroke={isSel ? '#ffffff' : '#000000'}
                            strokeWidth={isSel ? 3 : 1}
                            style={{ cursor: 'pointer' }}
                            onClick={() => onSelectDate && onSelectDate(payload.fullDate)}
                          />
                        );
                      }}
                    >
                      <LabelList
                        dataKey="simRate"
                        position="top"
                        formatter={(v) => (v !== null && v !== undefined ? `${v}%` : '')}
                        style={{ fill: '#a78bfa', fontSize: 9.5, fontWeight: 700 }}
                        offset={6}
                      />
                    </Line>
                  )}

                  {/* 3. 실제 배치계획 검증 피킹율 */}
                  {lineVisibility.actualPlanRate && (
                    <Line
                      type="monotone"
                      dataKey="actualPlanRate"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      strokeDasharray="3 3"
                      activeDot={{ r: 9, fill: '#f59e0b' }}
                      name="실제 배치계획 피킹율"
                      connectNulls={true}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        if (!payload || payload.actualPlanRate === null || payload.actualPlanRate === undefined || cx === undefined || cy === undefined) return null;
                        const isSel = payload.fullDate === selectedDate;
                        return (
                          <circle
                            key={`plan-${payload.fullDate}`}
                            cx={cx}
                            cy={cy}
                            r={isSel ? 7 : 3.5}
                            fill={isSel ? '#f59e0b' : '#d97706'}
                            stroke={isSel ? '#ffffff' : '#000000'}
                            strokeWidth={isSel ? 3 : 1}
                            style={{ cursor: 'pointer' }}
                            onClick={() => onSelectDate && onSelectDate(payload.fullDate)}
                          />
                        );
                      }}
                    >
                      <LabelList
                        dataKey="actualPlanRate"
                        position="top"
                        formatter={(v) => (v !== null && v !== undefined ? `${v}%` : '')}
                        style={{ fill: '#f59e0b', fontSize: 9.5, fontWeight: 700 }}
                        offset={6}
                      />
                    </Line>
                  )}

                  <Legend
                    iconType="line"
                    onClick={(o) => {
                      if (o && o.dataKey) toggleLine(o.dataKey);
                    }}
                    wrapperStyle={{ fontSize: '0.82rem', paddingTop: '8px', cursor: 'pointer' }}
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
                <BarChart 
                  data={chartData} 
                  margin={{ top: 4, right: 30, left: 0, bottom: 4 }}
                  onClick={(e) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      const clickedDate = e.activePayload[0].payload.fullDate;
                      onSelectDate && onSelectDate(clickedDate);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
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
                    {chartData.map((entry, idx) => {
                      const isSel = entry.fullDate === selectedDate;
                      return (
                        <Cell
                          key={idx}
                          fill={entry.diff !== null ? (entry.diff >= 0 ? '#4ade80' : '#ff0844') : '#94a3b8'}
                          stroke={isSel ? '#ffffff' : 'none'}
                          strokeWidth={isSel ? 2 : 0}
                          style={{ cursor: 'pointer' }}
                          onClick={() => onSelectDate && onSelectDate(entry.fullDate)}
                        />
                      );
                    })}
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
                  <tr style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    {['날짜', '피킹오더', '총출고량', '확정DO건수', '확정 SKU수', '확정DO 수량', '확정DO 개선율', '실제 야드', '시뮬 야드', '실제율', '시뮬율', '개선폭', '배치SKU', '전체SKU'].map(h => (
                      <th 
                        key={h} 
                        style={{ 
                          padding: '9px 10px', 
                          textAlign: 'center', 
                          color: h.includes('확정') ? '#38bdf8' : '#a78bfa', 
                          fontWeight: 700, 
                          whiteSpace: 'nowrap', 
                          background: '#1b172a',
                          borderBottom: '2px solid rgba(167,139,250,0.35)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                          position: 'sticky',
                          top: 0,
                          zIndex: 10
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {simResults
                    .filter(r => r.date >= startDate && r.date <= endDate)
                    .map((r, idx) => {
                      const isSel = r.date === selectedDate;
                      return (
                        <tr
                          key={r.date}
                          style={{
                            background: isSel 
                              ? 'rgba(167, 139, 250, 0.15)' 
                              : (idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'),
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            cursor: 'pointer',
                            fontWeight: isSel ? 'bold' : 'normal'
                          }}
                          onClick={() => onSelectDate && onSelectDate(r.date)}
                        >
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: isSel ? '#a78bfa' : '#f1f5f9', fontWeight: 600 }}>{formatWithDayOfWeek(r.date)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{r.pickOrderCount}건</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{r.totalQty.toLocaleString()}</td>
                          
                          {/* 확정DO건수 */}
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: r.doOrderCount != null ? '#38bdf8' : 'var(--text-muted)', fontWeight: r.doOrderCount != null ? 700 : 400 }}>
                            {r.doOrderCount != null ? `${r.doOrderCount.toLocaleString()}건` : '데이터 없음'}
                          </td>

                          {/* 확정 SKU수 */}
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: r.doSkuCount != null ? '#38bdf8' : 'var(--text-muted)', fontWeight: r.doSkuCount != null ? 700 : 400 }}>
                            {r.doSkuCount != null ? `${r.doSkuCount.toLocaleString()}개` : '데이터 없음'}
                          </td>

                          {/* 확정DO 수량 */}
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: r.doTotalQty != null ? '#38bdf8' : 'var(--text-muted)', fontWeight: r.doTotalQty != null ? 700 : 400 }}>
                            {r.doTotalQty != null ? `${r.doTotalQty.toLocaleString()} EA` : '데이터 없음'}
                          </td>
                          
                          {/* 확정DO 개선율 */}
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: r.doGainRate != null ? (r.doGainRate >= 0 ? '#4ade80' : '#ff0844') : 'var(--text-muted)', fontWeight: r.doGainRate != null ? 700 : 400 }}>
                            {r.doGainRate != null ? `${r.doGainRate >= 0 ? '+' : ''}${r.doGainRate}%p` : '데이터 없음'}
                          </td>

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
                      );
                    })}
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

      <SimulationInfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </section>
  );
}

// ── 시뮬레이션 상세 설명 모달 컴포넌트 ─────────────────────────────────────────
function SimulationInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(3, 7, 18, 0.85)',
      backdropFilter: 'blur(12px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(17, 24, 39, 0.95)',
        border: '1px solid rgba(167, 139, 250, 0.3)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '750px',
        maxHeight: '85vh',
        boxShadow: '0 25px 50px -12px rgba(167, 139, 250, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#f1f5f9'
      }}>
        {/* 모달 헤더 */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.08), rgba(0, 0, 0, 0))'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#a78bfa', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={20} color="#a78bfa" />
            배치계획 시뮬레이션 엔진 연산 메커니즘
          </h3>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
          >
            <X size={18} />
          </button>
        </div>

        {/* 모달 바디 (스크롤 가능) */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          fontSize: '0.88rem',
          lineHeight: '1.6',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* 개요 */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderLeft: '3px solid #a78bfa', padding: '12px 16px', borderRadius: '4px' }}>
            이 시뮬레이션은 <strong>"특정 분석일(Day D)에 설정값(Config)을 다르게 설계하여 전진 배치를 진행했다면, 실제 대비 야드 피킹 효율이 어떻게 변화했는가?"</strong>를 시계열적으로 역산하여 성능 향상 한계선을 검증하는 분석 도구입니다.
          </div>

          {/* 핵심 전제 조건 */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px' }}>📌 핵심 전제 조건 (Optimistic Ceiling)</h4>
            <ul style={{ paddingLeft: '20px', listStyleType: 'disc', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>시뮬레이터가 선정한 전진배치 품목(SKU)이 당일 출고 요청을 받으면, <strong>해당 품목 주문의 100%를 야드(가용 구역)에서 출고 처리할 수 있다</strong>고 가정합니다.</li>
              <li>현장의 실재고 수량은 충분하며, 지게차 및 AGF 등의 이송 지연이나 실패율(로봇 오류)은 발생하지 않는다는 시스템 이상 상태를 기준으로 한 최대 효율을 산정합니다.</li>
            </ul>
          </div>

          {/* 단계별 프로세스 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>⚙️ 일자별(Day D) 세부 계산 알고리즘</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>1단계: 과거 피킹 이력 집계 (Lookback)</div>
                <div>Day D의 배치 계획을 결정하기 위해 과거 60일(<code>lookbackPeriod</code>) 동안 발생한 누적 피킹오더 수량을 SKU 단위로 추적하여 <strong>주문 건수(Order Count)</strong>와 <strong>총 출고 수량(Outbound Qty)</strong>을 집계합니다.</div>
              </div>

              <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>2단계: 가중치 점수(Priority Score) 연산 & 정렬</div>
                <div>두 집계 수치를 최댓값 기준 0~1 값으로 정규화한 뒤, 설정값(예: 주문 건수 비율 70%, 수량 비율 30%)에 맞춰 최종 스코어를 도출합니다.
                  <div style={{ fontFamily: 'Outfit, monospace', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px', margin: '8px 0', fontSize: '0.8rem', color: '#00f2fe', textAlign: 'center', border: '1px dashed rgba(0, 242, 254, 0.2)' }}>
                    Score = (정규화 주문건수 × 주문비율) + (정규화 출고량 × 수량비율)
                  </div>
                  점수를 기준으로 전체 SKU를 내림차순 정렬하여 백분위 순위를 지정합니다.
                </div>
              </div>

              <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>3단계: 마진 적용 및 전진배치 품목(plannedSkus) 확정</div>
                <div>최하위 점수군(<code>bottomRankCutoff</code>)은 전진 배치에서 탈락시키고, 최상위 고빈도 순위군(예: 상위 10%)은 설정된 파레트 수량 한도(<code>palletLimit</code>)에 마진비율(예: +30%)을 상향 부여하여 보관 슬롯 공간을 최종 확정합니다.</div>
              </div>

              <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>4단계: 가상 야드 출고량 및 피킹율 도출</div>
                <div>실제 발생한 Day D 당일의 피킹오더 중, 3단계에서 선정한 <strong>시뮬레이션 전진배치 대상품목(Planned SKUs)</strong>이거나 <strong>이미 야드 내에 보관 중인 품목(Yard Layout)</strong>에 지시된 수량을 합산하여 <strong>가상 야드 출고량</strong>을 도출합니다.
                  <div style={{ fontFamily: 'Outfit, monospace', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px', margin: '8px 0', fontSize: '0.8rem', color: '#a78bfa', textAlign: 'center', border: '1px dashed rgba(167, 139, 250, 0.2)' }}>
                    시뮬레이션 피킹율(%) = (가상 야드 출고 수량 ÷ 당일 총 출고 수량) × 100
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 기간 가중 평균 */}
          <div>
            <h4 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px' }}>📊 기간 가중 평균 피킹율 산식</h4>
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '8px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span>차트 상단의 평균 피킹율 지표는 개별 일자별 효율의 산술평균이 아닌, <strong>조회 기간 전체의 누적 출고 수량 합계</strong>를 기준으로 분율 계산됩니다.</span>
              <div style={{ fontSize: '0.81rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>• <strong>실제 평균 피킹율</strong> = 조회기간 누적 실제 야드 출고량 ÷ 조회기간 누적 총 출고량 × 100</div>
                <div>• <strong>시뮬 평균 피킹율</strong> = 조회기간 누적 가상 야드 출고량 ÷ 조회기간 누적 총 출고량 × 100</div>
                <div>• <strong>평균 개선 효과</strong> = 시뮬레이션 평균 피킹율(%) - 실제 평균 피킹율(%)</div>
              </div>
            </div>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button 
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: 700,
              padding: '8px 24px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(167,139,250,0.3)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.boxShadow = '0 6px 20px rgba(167,139,250,0.4)'}
            onMouseLeave={(e) => e.target.style.boxShadow = '0 4px 16px rgba(167,139,250,0.3)'}
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
}
