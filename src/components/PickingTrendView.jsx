import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { TrendingDown, MousePointerClick, Info } from 'lucide-react';

export default function PickingTrendView({ dates, dailyAnalytics, selectedDate, onSelectDate }) {
  const chartData = dates.map(d => {
    const info = dailyAnalytics[d] || {};
    return {
      date: d.slice(5), // '06-01'
      fullDate: d,
      pickingRate: info.yardPickingRate || 0,
      totalQty: info.totalPickQty || 0,
      yardQty: info.yardPickQty || 0,
      isSelected: d === selectedDate
    };
  });

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
            야드 피킹 수량: {data.yardQty} / 전체 {data.totalQty} EA
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', marginTop: '6px' }}>
            💡 클릭 시 해당 일자 상세 원인 진단으로 전환
          </p>
        </div>
      );
    };
    return null;
  };

  return (
    <section className="glass-card">
      <div className="section-header">
        <div className="section-title">
          <TrendingDown color="var(--accent-cyan)" size={22} />
          <span>일자별 야드 피킹율 추이 (Yard Picking Rate Trend)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--accent-cyan)' }}>
          <MousePointerClick size={16} />
          <span>차트의 일자 포인트를 클릭하면 하단 상세 진단 모드가 변경됩니다</span>
        </div>
      </div>

      <div style={{ height: 280, width: '100%', marginTop: '8px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} onClick={(e) => {
            if (e && e.activePayload && e.activePayload[0]) {
              onSelectDate(e.activePayload[0].payload.fullDate);
            }
          }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} stroke="var(--text-secondary)" tick={{ fontSize: 12 }} unit="%" />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={50} stroke="rgba(255, 8, 68, 0.4)" strokeDasharray="4 4" label={{ value: '목표 피킹율 50%', fill: '#ff4b72', fontSize: 11 }} />
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
            />
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

      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <Info size={16} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
        <span>
          <strong>피킹율 산식:</strong> (야드 구역 처리 오더 수량 / 전체 피킹 오더 수량) × 100%. 
          선택된 분석일: <strong style={{ color: '#fff' }}>{selectedDate}</strong> (해당일 피킹율: <strong style={{ color: 'var(--accent-cyan)' }}>{dailyAnalytics[selectedDate]?.yardPickingRate}%</strong>)
        </span>
      </div>
    </section>
  );
}
