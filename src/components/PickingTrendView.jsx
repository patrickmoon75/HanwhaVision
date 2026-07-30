import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, LabelList, ReferenceLine } from 'recharts';
import { TrendingDown, MousePointerClick, Info, Calendar, Database, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react';
import { extractDataAvailabilitySets } from '../services/dataProcessor';

export default function PickingTrendView({ 
  dates = [], 
  dailyAnalytics = {}, 
  rawDatasets = {},
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
  
  // (A)~(E) 항목별 보이거나 숨김 토글 상태 (기본값: B(총출고량) 활성화)
  const [visibleMetrics, setVisibleMetrics] = useState({
    A: false,
    B: true,
    C: false,
    D: false,
    E: false
  });
  const [hoveredLine, setHoveredLine] = useState(null);

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

  // 4가지 데이터셋(배치계획, 미션로그, 재고현황, 피킹오더) 존재 여부 세트
  const availabilitySets = useMemo(() => {
    return extractDataAvailabilitySets(rawDatasets);
  }, [rawDatasets]);

  const chartData = filteredDates.map(d => {
    const info = dailyAnalytics[d] || {};
    const pickOrderCount = info.pickOrderCount || 0;
    const totalQty = info.totalPickQty || 0;
    const yardQty = info.yardPickQty || 0;
    const blockedQty = info.blockedRackPickQty || 0;
    const availQty = info.availRackPickQty || 0;
    
    // 피킹오더 건수가 0이면 야드 피킹율을 null로 설정하여 차트에서 0%로 내려가지 않고 끊기도록 처리
    const hasPickOrders = pickOrderCount > 0;
    const yardRate = hasPickOrders ? Number(info.yardPickingRate || 0) : null;
    const blockedRate = hasPickOrders ? Number(info.blockedPickRate || 0) : null;
    const availRate = hasPickOrders ? Number(info.availPickRate || 0) : null;

    return {
      date: d.slice(5), // '06-01'
      fullDate: d,
      hasPickOrders,
      pickingRate: yardRate, // (C) 야드 피킹율 (%)
      totalQty,              // (B) 총출고량
      yardQty,               // (C) 야드에서 출고량
      blockedQty,            // (D) 접근불가 랙 출고량
      blockedRate,           // (D) 접근불가 비율 (%)
      availQty,              // (E) 접근가능 랙 출고량
      availRate,             // (E) 접근가능 비율 (%)
      pickOrderCount,        // (A) 피킹오더수 (Unique PickTaskId)
      completedCount: info.completedCount || 0,
      abortedCount: info.abortedCount || 0,
      canceledCount: info.canceledCount || 0,
      totalMissions: info.dayMissions?.length || 0,
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
      
      if (hoveredLine === 'completedCount') {
        return (
          <div style={{
            background: 'rgba(17, 24, 39, 0.95)',
            border: '1px solid #10b981',
            borderRadius: '10px',
            padding: '12px 16px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            color: '#fff'
          }}>
            <p style={{ fontWeight: 700, color: '#10b981' }}>{data.fullDate} (지게차 미션)</p>
            <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>
              총 생성 미션 수: <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{data.totalMissions}건</strong>
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              완료 미션 수: <strong style={{ color: '#10b981' }}>{data.completedCount}건</strong><br />
              취소 미션 수: <strong style={{ color: '#ffb199' }}>{data.canceledCount}건</strong><br />
              중단 미션 수: <strong style={{ color: '#ff0844' }}>{data.abortedCount}건</strong>
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', marginTop: '6px' }}>
              💡 클릭 시 해당 일자 상세 원인 진단으로 전환
            </p>
          </div>
        );
      }

      const hasOrders = data.hasPickOrders;

      return (
        <div style={{
          background: 'rgba(17, 24, 39, 0.95)',
          border: '1px solid var(--border-highlight)',
          borderRadius: '10px',
          padding: '12px 16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          color: '#fff'
        }}>
          <p style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{data.fullDate} (피킹 효율)</p>
          <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>
            야드 피킹율:{' '}
            {hasOrders ? (
              <strong style={{ color: '#00f2fe', fontSize: '1.1rem' }}>{data.pickingRate}%</strong>
            ) : (
              <strong style={{ color: '#94a3b8', fontSize: '0.95rem' }}>피킹오더 데이터 없음</strong>
            )}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            (A) 피킹오더수: <strong>{data.pickOrderCount}건</strong><br />
            (B) 총출고량: <strong>{data.totalQty.toLocaleString()} EA</strong><br />
            {hasOrders ? (
              <>
                (C) 야드에서 출고량: <strong style={{ color: '#00f2fe' }}>{data.yardQty.toLocaleString()} EA ({data.pickingRate}%)</strong><br />
                (D) 접근불가 랙 출고량: <strong style={{ color: '#ffb199' }}>{data.blockedQty.toLocaleString()} EA ({data.blockedRate}%)</strong><br />
                (E) 야드 외 출고량: <strong style={{ color: '#00e676' }}>{data.availQty.toLocaleString()} EA ({data.availRate}%)</strong>
              </>
            ) : (
              <span style={{ color: '#94a3b8', display: 'inline-block', margin: '4px 0' }}>
                ℹ️ 해당 일자는 발생된 피킹오더 데이터가 없습니다
              </span>
            )}
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
      <g>
        {/* (B) 총출고량 라벨을 피킹율 수치 위에 표시 */}
        {visibleMetrics.B && (
          <text
            x={x}
            y={y - 21}
            fill={isSel ? '#00f2fe' : '#94a3b8'}
            fontSize={isSel ? '10px' : '8.5px'}
            fontWeight="700"
            textAnchor="middle"
          >
            (B){itemData.totalQty.toLocaleString()}
          </text>
        )}
        <text
          x={x}
          y={y - 8}
          fill={isSel ? '#00f2fe' : '#94a3b8'}
          fontSize={isSel ? '11px' : '9.5px'}
          fontWeight={isSel ? '800' : '600'}
          textAnchor="middle"
        >
          {value}%
        </text>
      </g>
    );
  };

  const CustomMissionLabel = (props) => {
    const { x, y, value, index } = props;
    const itemData = chartData[index];
    if (!itemData || value === undefined || value === null) return null;
    const isSel = itemData.fullDate === selectedDate;

    return (
      <text
        x={x}
        y={y + 16}
        fill={isSel ? '#34d399' : '#10b981'}
        fontSize={isSel ? '10.5px' : '9px'}
        fontWeight={isSel ? '800' : '600'}
        textAnchor="middle"
      >
        {value}건
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
    // B(총출고량)는 이제 피킹율 위에 표시되므로 하단 서브 라벨 목록에서 제외합니다.
    if (visibleMetrics.C && itemData.hasPickOrders) items.push({ key: 'C', text: `(C)야드:${itemData.yardQty.toLocaleString()}(${itemData.pickingRate}%)`, fill: '#00f2fe', size: '8px' });
    if (visibleMetrics.D && itemData.hasPickOrders) items.push({ key: 'D', text: `(D)접근불가:${itemData.blockedQty.toLocaleString()}(${itemData.blockedRate}%)`, fill: '#ffb199', size: '8px' });
    if (visibleMetrics.E && itemData.hasPickOrders) items.push({ key: 'E', text: `(E)야드외:${itemData.availQty.toLocaleString()}(${itemData.availRate}%)`, fill: '#00e676', size: '8px' });

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
          <span>일자별 야드 미션/피킹율 추이</span>
        </div>

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

      {/* 날짜별 4가지 수집 데이터 연동/존재 현황 표 (Data Availability Matrix) */}
      <div style={{
        margin: '12px 0 16px 0',
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '10px',
        padding: '12px 14px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          marginBottom: '8px',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#f3f4f6' }}>
            <Database size={15} color="var(--accent-cyan)" />
            <span>일자별 수집 데이터 연동 현황</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
              (배치계획, 미션로그, 재고현황, 피킹오더 존재 여부)
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
              <CheckCircle2 size={13} /> 존재 (O)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f87171' }}>
              <XCircle size={13} /> 미존재 (X)
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.04)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', minWidth: '90px', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', left: 0, background: '#111827', zIndex: 2 }}>
                  데이터 항목
                </th>
                {filteredDates.map(d => {
                  const isSel = d === selectedDate;
                  return (
                    <th 
                      key={`head-${d}`} 
                      onClick={() => onSelectDate && onSelectDate(d)}
                      style={{
                        padding: '6px 8px',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        cursor: 'pointer',
                        color: isSel ? '#00f2fe' : 'var(--text-secondary)',
                        fontWeight: isSel ? 700 : 500,
                        background: isSel ? 'rgba(0, 242, 254, 0.12)' : 'transparent',
                        transition: 'all 0.2s'
                      }}
                      title="클릭 시 이 날짜로 상세 분석 선택"
                    >
                      {d.slice(5)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'plan', label: '배치계획', set: availabilitySets.planDatesSet, tooltip: 'PlanId의 첫 영문자 뒤 8자리 기준' },
                { key: 'mission', label: '미션로그', set: availabilitySets.missionDatesSet, tooltip: 'CreateTime/StartTime 기준' },
                { key: 'inventory', label: '재고현황', set: availabilitySets.inventoryDatesSet, tooltip: 'Date 필드 기준' },
                { key: 'picking', label: '피킹오더', set: availabilitySets.pickingDatesSet, tooltip: 'ReceiveTime 기준' }
              ].map((row, rIdx) => (
                <tr key={row.key} style={{ borderBottom: rIdx < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <td style={{
                    padding: '6px 10px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: '#e2e8f0',
                    position: 'sticky',
                    left: 0,
                    background: '#111827',
                    borderRight: '1px solid rgba(255,255,255,0.08)',
                    zIndex: 2
                  }} title={row.tooltip}>
                    {row.label}
                  </td>
                  {filteredDates.map(d => {
                    const hasData = row.set.has(d);
                    const isSel = d === selectedDate;
                    return (
                      <td
                        key={`${row.key}-${d}`}
                        onClick={() => onSelectDate && onSelectDate(d)}
                        style={{
                          padding: '5px 8px',
                          background: isSel 
                            ? (hasData ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)')
                            : 'transparent',
                          cursor: 'pointer'
                        }}
                      >
                        {hasData ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: 'rgba(16, 185, 129, 0.18)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.35)'
                          }}>
                            O
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-block',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.25)'
                          }}>
                            X
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
            margin={{ top: 22, right: 50, left: 0, bottom: activeCount * 12 }}
            onClick={(e) => {
              if (e && e.activePayload && e.activePayload[0]) {
                onSelectDate(e.activePayload[0].payload.fullDate);
              }
            }}
            onMouseLeave={() => setHoveredLine(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} stroke="var(--text-secondary)" tick={{ fontSize: 12 }} unit="%" />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="#10b981" 
              tick={{ fontSize: 12 }} 
              domain={[0, 'auto']} 
              unit="건"
            />
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
              connectNulls={true}
              stroke="url(#lineGradient)"
              strokeWidth={3}
              onMouseEnter={() => setHoveredLine('pickingRate')}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (!payload || payload.pickingRate === null || cx === undefined || cy === undefined) return null;
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
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      setHoveredLine('pickingRate');
                    }}
                  />
                );
              }}
              activeDot={(props) => {
                const { payload } = props;
                if (!payload || payload.pickingRate === null) return null;
                return <circle {...props} r={9} fill="#00f2fe" />;
              }}
            >
              <LabelList content={<CustomLabel />} />
              <LabelList content={<CustomSubLabel />} />
            </Line>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="completedCount"
              stroke="#10b981"
              strokeWidth={2.5}
              onMouseEnter={() => setHoveredLine('completedCount')}
              dot={(props) => {
                const { cx, cy, payload } = props;
                const isSel = payload.fullDate === selectedDate;
                return (
                  <circle
                    key={`comp-${payload.fullDate}`}
                    cx={cx}
                    cy={cy}
                    r={isSel ? 6 : 4}
                    fill="#10b981"
                    stroke={isSel ? '#ffffff' : '#000000'}
                    strokeWidth={isSel ? 2 : 1}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      setHoveredLine('completedCount');
                    }}
                  />
                );
              }}
              activeDot={{ r: 8, fill: '#10b981' }}
            >
              <LabelList content={<CustomMissionLabel />} />
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
        <div style={{ fontSize: '0.81rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <span>ℹ️ <strong>피킹율 산식</strong>: (야드 구역 처리 오더 수량 / 전체 피킹 오더 수량) × 100%. 선택된 분석일: <strong>{selectedDate}</strong> (해당일 피킹율: <strong>{(dailyAnalytics[selectedDate]?.totalPickQty > 0) ? `${dailyAnalytics[selectedDate]?.yardPickingRate}%` : '피킹오더 없음'}</strong>)</span>
        </div>

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
                style={{ accentColor: '#00f2fe', cursor: 'pointer' }}
              />
              <span style={{ color: visibleMetrics.C ? '#00f2fe' : 'var(--text-secondary)', fontWeight: visibleMetrics.C ? 700 : 400 }}>
                <strong>(C)</strong> 야드에서 출고량(비율)
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={visibleMetrics.D}
                onChange={() => toggleMetric('D')}
                style={{ accentColor: '#ffb199', cursor: 'pointer' }}
              />
              <span style={{ color: visibleMetrics.D ? '#ffb199' : 'var(--text-secondary)', fontWeight: visibleMetrics.D ? 700 : 400 }}>
                <strong>(D)</strong> 접근불가 랙 출고량(비율)
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={visibleMetrics.E}
                onChange={() => toggleMetric('E')}
                style={{ accentColor: '#00e676', cursor: 'pointer' }}
              />
              <span style={{ color: visibleMetrics.E ? '#00e676' : 'var(--text-secondary)', fontWeight: visibleMetrics.E ? 700 : 400 }}>
                <strong>(E)</strong> 야드 외 출고량(비율)
              </span>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
