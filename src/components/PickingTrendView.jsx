import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, LabelList, ReferenceLine } from 'recharts';
import { TrendingDown, MousePointerClick, Info, Calendar } from 'lucide-react';

export default function PickingTrendView({ 
  dates = [], 
  dailyAnalytics = {}, 
  selectedDate, 
  onSelectDate,
  startDate: parentStart,
  endDate: parentEnd,
  onRangeChange
}) {
  const [startDate, setStartDate] = useState(parentStart || dates[0] || '');
  const [endDate, setEndDate] = useState(parentEnd || dates[dates.length - 1] || '');

  useEffect(() => {
    if (parentStart) setStartDate(parentStart);
    if (parentEnd) setEndDate(parentEnd);
  }, [parentStart, parentEnd]);

  const handleStartChange = (val) => {
    setStartDate(val);
    if (onRangeChange) onRangeChange(val, endDate);
  };

  const handleEndChange = (val) => {
    setEndDate(val);
    if (onRangeChange) onRangeChange(startDate, val);
  };
  
  // (A)~(D) 항목별 보이거나 숨김 토글 상태 (기본값: 모두 보기)
  const [visibleMetrics, setVisibleMetrics] = useState({
    A: true,
    B: true,
    C: true,
    D: true
  });

  const toggleMetric = (key) => {
    setVisibleMetrics(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activeCount = Object.values(visibleMetrics).filter(Boolean).length;

  useEffect(() => {
    if (dates && dates.length > 0) {
      if (!startDate || !dates.includes(startDate)) setStartDate(dates[0]);
      if (!endDate || !dates.includes(endDate)) setEndDate(dates[dates.length - 1]);
    }
  }, [dates]);

  const filteredDates = dates.filter(d => {
    const start = startDate || dates[0];
    const end = endDate || dates[dates.length - 1];
    return d >= start && d <= end;
  });

  const chartData = filteredDates.map(d => {
    const info = dailyAnalytics[d] || {};
    const totalQty = info.totalPickQty || 0;
    const yardQty = info.yardPickQty || 0;
    const nonYardQty = info.nonYardPickQty ?? Math.max(0, totalQty - yardQty);
    const yardRate = info.yardPickingRate || 0;
    const nonYardRate = info.nonYardPickingRate ?? (totalQty > 0 ? ((nonYardQty / totalQty) * 100).toFixed(2) : '0.00');

    return {
      date: d.slice(5), // '06-01'
      fullDate: d,
      pickingRate: yardRate,
      totalQty,
      yardQty,
      nonYardQty,
      nonYardRate,
      pickOrderCount: info.pickOrderCount || 0,
      isSelected: d === selectedDate
    };
  });

  // Calculate Period Weighted Average Picking Rate (Total Yard Pick Qty / Total Pick Qty * 100)
  const totalPeriodYardQty = filteredDates.reduce((sum, d) => sum + (dailyAnalytics[d]?.yardPickQty || 0), 0);
  const totalPeriodPickQty = filteredDates.reduce((sum, d) => sum + (dailyAnalytics[d]?.totalPickQty || 0), 0);
  const periodAvgRate = totalPeriodPickQty > 0
    ? ((totalPeriodYardQty / totalPeriodPickQty) * 100).toFixed(2)
    : '0.00';

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          background: 'rgba(17, 24, 39, 0.95)',
          border: '1px solid var(--border-highlight)',
          borderRadius: '10px',
          padding: '12px 16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          color: '#fff'
        }}>
          <p style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{data.fullDate}</p>
          <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>
            야드 피킹율: <strong style={{ color: '#00f2fe', fontSize: '1.1rem' }}>{data.pickingRate}%</strong>
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            (A) 피킹오더수: <strong>{data.pickOrderCount}건</strong><br />
            (B) 총출고량: <strong>{data.totalQty.toLocaleString()} EA</strong><br />
            (C) 접근불가 랙 출고량: <strong style={{ color: '#ffb199' }}>{data.nonYardQty.toLocaleString()} EA ({data.nonYardRate}%)</strong><br />
            (D) 접근가능 랙 출고량: <strong style={{ color: '#00e676' }}>{data.yardQty.toLocaleString()} EA ({data.pickingRate}%)</strong>
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', marginTop: '6px' }}>
            💡 클릭 시 해당 일자 상세 원인 진단으로 전환
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = (props) => {
    const { x, y, value, index } = props;
    const itemData = chartData[index];
    if (!itemData || value === undefined || value === null) return null;
    const isSel = itemData.fullDate === selectedDate;

    return (
      <text
        x={x}
        y={y - 9}
        fill={isSel ? '#00f2fe' : '#94a3b8'}
        fontSize={isSel ? '11px' : '9.5px'}
        fontWeight={isSel ? '800' : '600'}
        textAnchor="middle"
      >
        {value}%
      </text>
    );
  };

  const CustomSubLabel = (props) => {
    const { x, y, index } = props;
    const itemData = chartData[index];
    if (!itemData) return null;
    const isSel = itemData.fullDate === selectedDate;
    const mainColor = isSel ? '#00f2fe' : '#94a3b8';

    const items = [];
    if (visibleMetrics.A) items.push({ key: 'A', text: `(A)${itemData.pickOrderCount}건`, fill: mainColor, size: '8.5px' });
    if (visibleMetrics.B) items.push({ key: 'B', text: `(B)${itemData.totalQty.toLocaleString()}`, fill: mainColor, size: '8.5px' });
    if (visibleMetrics.C) items.push({ key: 'C', text: `(C)${itemData.nonYardQty.toLocaleString()}(${itemData.nonYardRate}%)`, fill: '#ffb199', size: '8px' });
    if (visibleMetrics.D) items.push({ key: 'D', text: `(D)${itemData.yardQty.toLocaleString()}(${itemData.pickingRate}%)`, fill: '#00e676', size: '8px' });

    if (items.length === 0) return null;

    return (
      <g transform={`translate(${x}, ${y + 14})`}>
        {items.map((item, idx) => (
          <text
            key={item.key}
            x={0}
            y={idx * 11}
            fill={item.fill}
            fontSize={item.size}
            fontWeight="600"
            textAnchor="middle"
          >
            {item.text}
          </text>
        ))}
      </g>
    );
  };

  return (
    <section className="glass-card">
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div className="section-title">
          <TrendingDown color="var(--accent-cyan)" size={22} />
          <span>일자별 야드 피킹율 추이 (Yard Picking Rate Trend)</span>
        </div>

        {/* Date Range Selector & Period Average KPI Badge */}
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
            <Calendar size={15} color="var(--accent-cyan)" />
            <span style={{ color: 'var(--text-secondary)' }}>조회 기간:</span>
            <select
              value={startDate}
              onChange={(e) => handleStartChange(e.target.value)}
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
                <option key={`start-${d}`} value={d} disabled={endDate && d > endDate} style={{ background: '#111827', color: '#fff' }}>
                  {d}
                </option>
              ))}
            </select>
            <span style={{ color: 'var(--text-secondary)' }}>~</span>
            <select
              value={endDate}
              onChange={(e) => handleEndChange(e.target.value)}
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
                <option key={`end-${d}`} value={d} disabled={startDate && d < startDate} style={{ background: '#111827', color: '#fff' }}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.15), rgba(79, 172, 254, 0.15))',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>선택 기간 평균 피킹율:</span>
            <strong style={{ color: '#00f2fe', fontSize: '1rem', fontWeight: 800 }}>{periodAvgRate}%</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              (야드 {totalPeriodYardQty.toLocaleString()} / 전체 {totalPeriodPickQty.toLocaleString()} EA)
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
        <MousePointerClick size={15} style={{ marginRight: '4px' }} />
        <span>차트의 일자 포인트를 클릭하면 하단 상세 진단 모드가 변경됩니다</span>
      </div>

      <div style={{ height: activeCount > 0 ? 290 + activeCount * 14 : 290, width: '100%', marginTop: '4px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData} 
            margin={{ top: 22, right: 20, left: 0, bottom: activeCount * 12 }}
            onClick={(e) => {
              if (e && e.activePayload && e.activePayload[0]) {
                onSelectDate(e.activePayload[0].payload.fullDate);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} stroke="var(--text-secondary)" tick={{ fontSize: 12 }} unit="%" />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine 
              y={Number(periodAvgRate)} 
              stroke="#00f2fe" 
              strokeDasharray="5 5" 
              strokeWidth={2}
              label={{ 
                value: `기간 평균: ${periodAvgRate}%`, 
                fill: '#00f2fe', 
                fontSize: 12, 
                fontWeight: 700, 
                position: 'insideTopRight',
                dy: -12
              }} 
            />
            <Line
              type="monotone"
              dataKey="pickingRate"
              stroke="url(#lineGradient)"
              strokeWidth={3}
              dot={(props) => {
                const { cx, cy, payload } = props;
                const isSel = payload.fullDate === selectedDate;
                const isDrop = payload.fullDate === '2026-06-29';
                return (
                  <circle
                    key={payload.fullDate}
                    cx={cx}
                    cy={cy}
                    r={isSel ? 7 : isDrop ? 6 : 4}
                    fill={isSel ? '#00f2fe' : isDrop ? '#ff0844' : '#4facfe'}
                    stroke={isSel ? '#ffffff' : '#000000'}
                    strokeWidth={isSel ? 3 : 1}
                    style={{ cursor: 'pointer' }}
                  />
                );
              }}
              activeDot={{ r: 9, fill: '#00f2fe' }}
            >
              <LabelList content={<CustomLabel />} />
              <LabelList content={<CustomSubLabel />} />
            </Line>
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4facfe" />
                <stop offset="50%" stopColor="#00f2fe" />
                <stop offset="100%" stopColor="#ff0844" />
              </linearGradient>
            </defs>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 하단 피킹율 산식 정보 및 (A)~(D) 항목 체크박스 범례 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1 }}>
          <Info size={16} color="var(--accent-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>피킹율 산식:</strong> (야드 구역 처리 오더 수량 / 전체 피킹 오더 수량) × 100%. 
            선택된 분석일: <strong style={{ color: '#fff' }}>{selectedDate}</strong> (해당일 피킹율: <strong style={{ color: 'var(--accent-cyan)' }}>{dailyAnalytics[selectedDate]?.yardPickingRate}%</strong>)
          </span>
        </div>

        {/* (A)~(D) 항목 체크박스 범례 박스 */}
        <div style={{
          background: 'rgba(17, 24, 39, 0.95)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '0.78rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <span>📌 차트 점 아래 항목 표시 설정</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>체크 시 점 아래에 선택된 항목 표시</span>
          </div>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={visibleMetrics.A}
                onChange={() => toggleMetric('A')}
                style={{ accentColor: '#00f2fe', cursor: 'pointer' }}
              />
              <span style={{ color: visibleMetrics.A ? '#fff' : 'var(--text-secondary)', fontWeight: visibleMetrics.A ? 700 : 400 }}>
                <strong>(A)</strong> 피킹 오더 수
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={visibleMetrics.B}
                onChange={() => toggleMetric('B')}
                style={{ accentColor: '#4facfe', cursor: 'pointer' }}
              />
              <span style={{ color: visibleMetrics.B ? '#fff' : 'var(--text-secondary)', fontWeight: visibleMetrics.B ? 700 : 400 }}>
                <strong>(B)</strong> 총 출고량
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={visibleMetrics.C}
                onChange={() => toggleMetric('C')}
                style={{ accentColor: '#ffb199', cursor: 'pointer' }}
              />
              <span style={{ color: visibleMetrics.C ? '#ffb199' : 'var(--text-secondary)', fontWeight: visibleMetrics.C ? 700 : 400 }}>
                <strong>(C)</strong> 접근불가 랙 출고량(비율)
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={visibleMetrics.D}
                onChange={() => toggleMetric('D')}
                style={{ accentColor: '#00e676', cursor: 'pointer' }}
              />
              <span style={{ color: visibleMetrics.D ? '#00e676' : 'var(--text-secondary)', fontWeight: visibleMetrics.D ? 700 : 400 }}>
                <strong>(D)</strong> 접근가능 랙(야드) 출고량(비율)
              </span>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
