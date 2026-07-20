import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PieChart as PieIcon, AlertOctagon, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function RootCauseIsolationView({ selectedDate, dateInfo }) {
  if (!dateInfo) return null;

  const pieData = [
    { name: '1. 인프라 차단 손실 (고객사 책임)', value: dateInfo.infraLossRate, color: '#ff0844' },
    { name: '2. 현장 파레트 불량 (고객사 책임)', value: dateInfo.opErrorLossRate, color: '#ffb199' },
    { name: '3. 배치계획 오차 (RWCS 영역)', value: dateInfo.algoLossRate, color: '#00f2fe' }
  ];

  const levelBarData = [
    { level: '1단 (저단)', count: dateInfo.levelCounts[1] ?? 0 },
    { level: '2단 (저단)', count: dateInfo.levelCounts[2] ?? 0 },
    { level: '3단 (저단)', count: dateInfo.levelCounts[3] ?? 0 },
    { level: '4단 (고단)', count: dateInfo.levelCounts[4] ?? 0 },
    { level: '5단 (고단)', count: dateInfo.levelCounts[5] ?? 0 }
  ];

  return (
    <div className="grid-3col">
      {/* 1. Pie Chart: 3대 원인 분리 */}
      <div className="glass-card">
        <div className="section-title" style={{ fontSize: '1rem', marginBottom: '12px' }}>
          <PieIcon color="var(--accent-rose)" size={20} />
          <span>3대 책임 소재 분리 (Root Cause Isolation)</span>
        </div>

        <div style={{ height: 210, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(val) => `${val}%`} 
                contentStyle={{ backgroundColor: '#111827', borderColor: 'rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#f1f5f9' }}
                itemStyle={{ color: '#00f2fe' }}
                labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', marginTop: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#ff0844', fontWeight: 600 }}>● 1. 인프라 차단 손실 (고객사)</span>
            <strong style={{ fontSize: '0.95rem' }}>{dateInfo.infraLossRate}%</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#ffb199', fontWeight: 600 }}>● 2. 현장 파레트 부실 (고객사)</span>
            <strong style={{ fontSize: '0.95rem' }}>{dateInfo.opErrorLossRate}%</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#00f2fe', fontWeight: 600 }}>● 3. 배치계획 오차 (RWCS)</span>
            <strong style={{ fontSize: '0.95rem' }}>{dateInfo.algoLossRate}%</strong>
          </div>
        </div>
      </div>

      {/* 2. Bar Chart: 랙 단수별 Soft Reset 빈도 */}
      <div className="glass-card">
        <div className="section-title" style={{ fontSize: '1rem', marginBottom: '10px' }}>
          <AlertOctagon color="var(--accent-amber)" size={20} />
          <span>단수별 Soft Reset 빈도 (고단 랙 품질 문제)</span>
        </div>

        {/* 미션 상태별 예외 건수 키 : 값 표시 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '6px 12px',
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          marginBottom: '10px',
          fontSize: '0.8rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Aborted :</span>
            <strong style={{ color: '#ff0844', fontWeight: 700 }}>{dateInfo.abortedCount ?? dateInfo.totalAbortedMissions ?? 0}건</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Canceled :</span>
            <strong style={{ color: '#ffb199', fontWeight: 700 }}>{dateInfo.canceledCount ?? 0}건</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Deleted :</span>
            <strong style={{ color: '#00f2fe', fontWeight: 700 }}>{dateInfo.deletedCount ?? 0}건</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Soft Reset :</span>
            <strong style={{ color: '#ff4b72', fontWeight: 700 }}>{dateInfo.softResetCount ?? 0}건</strong>
          </div>
        </div>

        <div style={{ height: 210, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={levelBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="level" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111827', borderColor: 'rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#f1f5f9' }}
                itemStyle={{ color: '#ffb199' }}
                labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
              />
              <Bar dataKey="count" name="Soft Reset 건수" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffb199" />
                  <stop offset="100%" stopColor="#ff0844" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'rgba(255, 177, 153, 0.1)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.78rem', color: '#ffb199', marginTop: '6px' }}>
          ⚠️ <strong>고단(4~5단) 집중 원인:</strong> 파레트 적치 비뚤어짐/흔들림으로 인해 AGF 로봇 센서가 작동(Soft Reset). 저단 대비 고단 발생률이 <strong>{(dateInfo.highLevelSoftResets / (dateInfo.lowLevelSoftResets || 1)).toFixed(1)}배</strong> 높음.
        </div>
      </div>

      {/* 3. Capacity & Fallback Proof */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div className="section-title" style={{ fontSize: '1rem', marginBottom: '12px' }}>
            <ShieldCheck color="var(--accent-green)" size={20} />
            <span>야드 만재율 & Fallback 복구 증명</span>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>익일 아침 출고 직전 야드 만재율</span>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'Outfit', margin: '4px 0' }}>
              {dateInfo.yardOccupancyRate}%
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              가용 야드 805개 중 {dateInfo.occupiedYardCount}개 셀 가득 차 있음
            </div>
          </div>
        </div>

        <div style={{ background: 'rgba(0, 230, 118, 0.08)', border: '1px solid rgba(0, 230, 118, 0.2)', padding: '12px', borderRadius: '10px', marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-green)', fontWeight: 700, fontSize: '0.85rem' }}>
            <CheckCircle2 size={16} />
            <span>실시간 복구 제어(Fallback) 입증</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
            에러(Aborted) 발생 시 RWCS가 차선순위 미션을 자동 배치하여 밤새 야드를 상시 <strong style={{ color: 'var(--accent-green)' }}>{dateInfo.yardOccupancyRate}%</strong> 수준의 만재 상태로 유지했습니다. 피킹율 하락은 가동률 부실이 아닙니다.
          </p>
        </div>
      </div>
    </div>
  );
}
