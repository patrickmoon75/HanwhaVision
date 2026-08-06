import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PieChart as PieIcon, AlertOctagon, ShieldCheck, BarChart2 } from 'lucide-react';
import { formatWithDayOfWeek } from '../services/dataProcessor';

export default function RootCauseIsolationView({ selectedDate, dateInfo }) {
  const [useTodayStock, setUseTodayStock] = useState(false);
  
  if (!dateInfo) return null;

  const totalLoss = (100 - Number(dateInfo.yardPickingRate || 0)).toFixed(2);
  const prevMissions = dateInfo.prevCompletedMissions ?? 0;
  const pickQty = dateInfo.totalPickQty ?? 0;
  const algoDynamicDesc = `${dateInfo.pickingDate}의 전체 피킹 손실(${totalLoss}%) 중, 당일 실제 발생한 인프라 차단 손실(${dateInfo.infraLossRate}%)과 현장 파레트 에러(${dateInfo.opErrorLossRate}%), 그리고 전날(${dateInfo.prevDate}) 지게차 완료 미션 부족(${prevMissions}건 / 기준 150건 대비 부족)에 따른 야드플랜 미실행 요인(${dateInfo.yardPlanLossRate ?? 0}%)을 제하고 남은 순수한 배치 계획상 오차(${dateInfo.algoLossRate}%)입니다. 당일 피킹 지시 오더 ${pickQty}건 및 전일 지게차 적치 데이터를 종합 분석하여 최종 판정하였습니다.`;

  const level5Loss = Number(dateInfo.level5LossRate || 0);
  const infraLoss = Math.max(0, Number(dateInfo.infraLossRate || dateInfo.blockedPickRate || 0) - level5Loss);

  const pieData = [
    { name: '1. 5단 갇힘 손실 (Level 5 Hard Blocked, 고객사 100% 책임)', value: Number(level5Loss.toFixed(2)), color: '#ef4444' },
    { name: '2. 1~4단 인프라 차단 손실 (고객사 책임)', value: Number(infraLoss.toFixed(2)), color: '#ff0844' },
    { name: '3. 현장 파레트 부실 (고객사 책임)', value: dateInfo.opErrorLossRate, color: '#ffb199' },
    { name: '4. 배치계획 오차 (RWCS 영역)', value: dateInfo.algoLossRate, color: '#00f2fe' },
    { name: '5. 야드플랜 미실행 (RWCS/운영 책임)', value: dateInfo.yardPlanLossRate ?? 0, color: '#ffd600' }
  ];

  // 단수별 Soft Reset 카운트: 전일(prevLevelCounts) vs 당일(levelCounts)
  const levelBarData = [
    { level: '1단 (저단)', prevCount: dateInfo.prevLevelCounts?.[1] ?? 0, currCount: dateInfo.levelCounts?.[1] ?? 0 },
    { level: '2단 (저단)', prevCount: dateInfo.prevLevelCounts?.[2] ?? 0, currCount: dateInfo.levelCounts?.[2] ?? 0 },
    { level: '3단 (저단)', prevCount: dateInfo.prevLevelCounts?.[3] ?? 0, currCount: dateInfo.levelCounts?.[3] ?? 0 },
    { level: '4단 (고단)', prevCount: dateInfo.prevLevelCounts?.[4] ?? 0, currCount: dateInfo.levelCounts?.[4] ?? 0 },
    { level: '5단 (고단)', prevCount: dateInfo.prevLevelCounts?.[5] ?? 0, currCount: dateInfo.levelCounts?.[5] ?? 0 }
  ];

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const name = data.name;
      const val = data.value;
      
      let description = '';
      let title = '';
      const color = data.color || '#fff';
      
      if (name.includes('1.') || name.includes('인프라')) {
        title = '1. 인프라 차단 손실 (고객사)';
        description = '진입 불가 구역(Blocked 랙)에 적치된 물량 때문에 무인지게차(AGF)가 물리적으로 접근하지 못해 발생한 피킹 손실입니다. 고객사 측의 차단 구역 해제 조치가 필요합니다.';
      } else if (name.includes('2.') || name.includes('파레트')) {
        title = '2. 현장 파레트 부실 (고객사)';
        description = '파레트 적치 비뚤어짐이나 흔들림이 감지되어 AGF 로봇 센서가 안전 모드로 정지 후 자동 리셋(Soft Reset)되어 발생한 시간 손실입니다. 파레트 품질 정비가 요구됩니다.';
      } else if (name.includes('3.') || name.includes('배치계획')) {
        title = '3. 배치계획 오차 (RWCS)';
        description = algoDynamicDesc;
      } else if (name.includes('4.') || name.includes('야드플랜')) {
        title = '4. 야드플랜 미실행 (RWCS/운영)';
        description = '전날 완료된 지게차 미션 수 부족으로 인해 당일 출고를 위한 야드 적재 재고가 미리 채워지지 않아 야드가 비게 됨으로써 연쇄적으로 발생한 피킹율 하락 손실입니다.';
      }

      return (
        <div style={{
          background: 'rgba(17, 24, 39, 0.95)',
          border: `1px solid ${color}`,
          borderRadius: '10px',
          padding: '12px 16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          color: '#fff',
          maxWidth: '280px',
          whiteSpace: 'normal',
          wordBreak: 'keep-all',
          lineHeight: 1.4
        }}>
          <p style={{ fontWeight: 700, color, fontSize: '0.9rem', marginBottom: '4px' }}>{title}</p>
          <p style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            원인 비율: <span style={{ color }}>{val}%</span>
          </p>
          <p style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.4' }}>
            {description}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid-3col">
      {/* 1. Pie Chart: 4대 원인 분리 */}
      <div className="glass-card">
        <div className="section-title" style={{ fontSize: '1rem', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieIcon color="var(--accent-rose)" size={20} />
            <span>4대 책임 소재 분리 (상대값임)</span>
          </div>
          {/* 우상단: 선택 날짜 + 피킹율 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', background: 'rgba(255, 255, 255, 0.05)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>{formatWithDayOfWeek(dateInfo.pickingDate)}</span>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-rose)', fontFamily: 'Outfit', lineHeight: 1 }}>{dateInfo.yardPickingRate}%</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>피킹율</span>
          </div>
        </div>

        {/* 파이 차트 + 미스피킹율 오버레이 */}
        <div style={{ position: 'relative', height: 210, width: '100%' }}>
          {/* 좌측 A: 미스피킹율 라벨 */}
          <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '22%', zIndex: 2 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.03em' }}>미스피킹율</span>
          </div>
          {/* 중앙 B: 미스피킹율 수치 (파이차트 중앙) */}
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2, pointerEvents: 'none' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-rose)', fontFamily: 'Outfit', lineHeight: 1 }}>
              {(100 - Number(dateInfo.yardPickingRate || 0)).toFixed(2)}%
            </span>
          </div>

          {/* 파이 차트 (absolute 오버레이와 같은 relative wrapper 안에 배치) */}
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
              <Tooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', marginTop: '4px' }}>
          {/* 1. 인프라 차단 손실 */}
          <div 
            className="tooltip-trigger"
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              position: 'relative',
              cursor: 'help',
              padding: '4px 0'
            }}
          >
            <span style={{ color: '#ff0844', fontWeight: 600 }}>● 1. 인프라 차단 손실 (고객사)</span>
            <strong style={{ fontSize: '0.95rem' }}>{dateInfo.infraLossRate}%</strong>
            <div className="custom-tooltip-box" style={{ borderColor: '#ff0844' }}>
              <strong style={{ color: '#ff0844', fontSize: '0.85rem' }}>1. 인프라 차단 손실 (고객사)</strong>
              <p style={{ marginTop: '6px', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.4', fontWeight: 'normal' }}>
                진입 불가 구역(Blocked 랙)에 적치된 물량 때문에 무인지게차(AGF)가 물리적으로 접근하지 못해 발생한 피킹 손실입니다. 고객사 측의 차단 구역 해제 조치가 필요합니다.
              </p>
            </div>
          </div>

          {/* 2. 현장 파레트 부실 */}
          <div 
            className="tooltip-trigger"
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              position: 'relative',
              cursor: 'help',
              padding: '4px 0'
            }}
          >
            <span style={{ color: '#ffb199', fontWeight: 600 }}>● 2. 현장 파레트 부실 (고객사)</span>
            <strong style={{ fontSize: '0.95rem' }}>{dateInfo.opErrorLossRate}%</strong>
            <div className="custom-tooltip-box" style={{ borderColor: '#ffb199' }}>
              <strong style={{ color: '#ffb199', fontSize: '0.85rem' }}>2. 현장 파레트 부실 (고객사)</strong>
              <p style={{ marginTop: '6px', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.4', fontWeight: 'normal' }}>
                파레트 적치가 비뚤어지거나 흔들림이 감지되어 AGF 로봇 센서가 작동(Soft Reset)하고 일시 대기한 운영 손실입니다. 현장 파레트 적치 품질 개선이 필요합니다.
              </p>
            </div>
          </div>

          {/* 3. 배치계획 오차 */}
          <div 
            className="tooltip-trigger"
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              position: 'relative',
              cursor: 'help',
              padding: '4px 0'
            }}
          >
            <span style={{ color: '#00f2fe', fontWeight: 600 }}>● 3. 배치계획 오차 (RWCS)</span>
            <strong style={{ fontSize: '0.95rem' }}>{dateInfo.algoLossRate}%</strong>
            <div className="custom-tooltip-box" style={{ borderColor: '#00f2fe' }}>
              <strong style={{ color: '#00f2fe', fontSize: '0.85rem' }}>3. 배치계획 오차 (RWCS)</strong>
              <p style={{ marginTop: '6px', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.4', fontWeight: 'normal' }}>
                {algoDynamicDesc}
              </p>
            </div>
          </div>

          {/* 4. 야드플랜 미실행 */}
          <div 
            className="tooltip-trigger"
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              position: 'relative',
              cursor: 'help',
              padding: '4px 0'
            }}
          >
            <span style={{ color: '#ffd600', fontWeight: 600 }}>● 4. 야드플랜 미실행 (RWCS/운영)</span>
            <strong style={{ fontSize: '0.95rem' }}>{dateInfo.yardPlanLossRate ?? 0}%</strong>
            <div className="custom-tooltip-box" style={{ borderColor: '#ffd600' }}>
              <strong style={{ color: '#ffd600', fontSize: '0.85rem' }}>4. 야드플랜 미실행 (RWCS/운영)</strong>
              <p style={{ marginTop: '6px', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.4', fontWeight: 'normal' }}>
                전날 지게차 로봇의 완료 미션 수가 부족(또는 미실행)하여 야드에 적재 재고가 채워지지 않아 발생한 피킹 지연 요인입니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 미션로그 결과 분석 */}
      <div className="glass-card">
        <div className="section-title" style={{ fontSize: '1rem', marginBottom: '10px' }}>
          <AlertOctagon color="var(--accent-amber)" size={20} />
          <span>미션로그 결과 분석</span>
        </div>

        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          {/* 좌측: 전일 (prevDate) */}
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '4px', marginBottom: '8px', fontWeight: 700 }}>
              전일 ({dateInfo.prevDate || '—'})
            </div>
            {dateInfo.prevTotalMissionCount == null ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>데이터 없음</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px', marginBottom: '2px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>총 생성 미션:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{dateInfo.prevTotalMissionCount ?? 0}건</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>완료:</span>
                  <strong style={{ color: '#4ade80' }}>{dateInfo.prevMissionCompleted ?? 0}건</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Aborted:</span>
                  <strong style={{ color: '#ff0844' }}>{dateInfo.prevMissionAborted ?? 0}건</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Canceled:</span>
                  <strong style={{ color: '#ffb199' }}>{dateInfo.prevMissionCanceled ?? 0}건</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Deleted:</span>
                  <strong style={{ color: '#00f2fe' }}>{dateInfo.prevMissionDeleted ?? 0}건</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Soft Reset:</span>
                  <strong style={{ color: '#ff4b72' }}>{dateInfo.prevMissionSoftReset ?? 0}건</strong>
                </div>
              </div>
            )}
          </div>

          {/* 우측: 당일 (pickingDate) */}
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '4px', marginBottom: '8px', fontWeight: 700 }}>
              당일 ({dateInfo.pickingDate || '—'})
            </div>
            {!dateInfo.totalMissionCount && dateInfo.totalMissionCount !== 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>데이터 없음</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px', marginBottom: '2px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>총 생성 미션:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{dateInfo.totalMissionCount ?? 0}건</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>완료:</span>
                  <strong style={{ color: '#4ade80' }}>{dateInfo.completedCount ?? 0}건</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Aborted:</span>
                  <strong style={{ color: '#ff0844' }}>{dateInfo.abortedCount ?? 0}건</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Canceled:</span>
                  <strong style={{ color: '#ffb199' }}>{dateInfo.canceledCount ?? 0}건</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Deleted:</span>
                  <strong style={{ color: '#00f2fe' }}>{dateInfo.deletedCount ?? 0}건</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Soft Reset:</span>
                  <strong style={{ color: '#ff4b72' }}>{dateInfo.softResetCount ?? 0}건</strong>
                </div>
              </div>
            )}
          </div>
        </div>


        {/* 단수별 바 차트 (전일 vs 당일 비교) */}
        <div style={{ height: 190, width: '100%', marginTop: '16px' }}>
          <div style={{ 
            display: 'flex', 
            justify: 'space-between', 
            alignItems: 'center', 
            marginBottom: '10px',
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <span style={{ fontSize: '0.92rem', color: '#f1f5f9', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <BarChart2 size={16} color="var(--accent-cyan)" />
              <span>단수별 Soft Reset 발생 분포 비교</span>
            </span>
            <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: 'linear-gradient(135deg, #ffb199, #ff0844)', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--text-secondary)' }}>전일 ({dateInfo.prevDate || '—'})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: 'linear-gradient(135deg, #00f2fe, #4facfe)', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--text-secondary)' }}>당일 ({dateInfo.pickingDate || '—'})</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={levelBarData} barGap={4} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="level" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderColor: 'rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#f1f5f9' }}
                labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
              />
              <Bar dataKey="prevCount" name={`전일 (${dateInfo.prevDate || '—'})`} fill="url(#prevBarGradient)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="currCount" name={`당일 (${dateInfo.pickingDate || '—'})`} fill="url(#currBarGradient)" radius={[4, 4, 0, 0]} />
              <defs>
                <linearGradient id="prevBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffb199" />
                  <stop offset="100%" stopColor="#ff0844" />
                </linearGradient>
                <linearGradient id="currBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f2fe" />
                  <stop offset="100%" stopColor="#4facfe" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>


      {/* 3. Capacity & Fallback Proof */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div className="section-title" style={{ fontSize: '1rem', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck color="var(--accent-green)" size={20} />
              <span>야드 만재율</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={useTodayStock}
                onChange={(e) => setUseTodayStock(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--accent-green)' }}
              />
              당일 재고 기준 계산
            </label>
          </div>

          {(() => {
            const displayPrevYardOccupancyRate = useTodayStock ? dateInfo.prevYardOccupancyRateToday : dateInfo.prevYardOccupancyRate;
            const displayPrevOccupiedYardCount = useTodayStock ? dateInfo.prevOccupiedYardCountToday : dateInfo.prevOccupiedYardCount;
            const displayYardOccupancyRate = useTodayStock ? dateInfo.yardOccupancyRateToday : dateInfo.yardOccupancyRate;
            const displayOccupiedYardCount = useTodayStock ? dateInfo.occupiedYardCountToday : dateInfo.occupiedYardCount;

            return (
              <div style={{ display: 'flex', gap: '12px', width: '100%', marginBottom: '12px' }}>
                {/* 좌측: 전일 */}
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '4px', fontWeight: 600 }}>
                    전일 ({formatWithDayOfWeek(dateInfo.prevDate) || '데이터 없음'})
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>야드플랜 완료 미션</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {dateInfo.prevCompletedCount ?? 0} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>건</span>
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>최종 야드 만재율</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'Outfit' }}>
                      {(displayPrevYardOccupancyRate === null || displayPrevYardOccupancyRate === undefined) ? '데이터 없음' : `${displayPrevYardOccupancyRate}%`}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginTop: '4px', fontWeight: 500 }}>
                      {(displayPrevYardOccupancyRate === null || displayPrevYardOccupancyRate === undefined) ? '-' : `805개 중 ${displayPrevOccupiedYardCount}개 셀 (빈 셀: ${805 - displayPrevOccupiedYardCount}개)`}
                    </span>
                  </div>
                </div>

                {/* 우측: 당일 */}
                <div style={{ flex: 1, background: 'rgba(0, 230, 118, 0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(0, 230, 118, 0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--accent-green)', borderBottom: '1px solid rgba(0, 230, 118, 0.15)', paddingBottom: '4px', fontWeight: 600 }}>
                    당일 ({formatWithDayOfWeek(dateInfo.pickingDate) || '데이터 없음'})
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>야드플랜 완료 미션</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {dateInfo.completedCount ?? 0} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>건</span>
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>최종 야드 만재율</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'Outfit' }}>
                      {(displayYardOccupancyRate === null || displayYardOccupancyRate === undefined) ? '데이터 없음' : `${displayYardOccupancyRate}%`}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginTop: '4px', fontWeight: 500 }}>
                      {(displayYardOccupancyRate === null || displayYardOccupancyRate === undefined) ? '-' : `805개 중 ${displayOccupiedYardCount}개 셀 (빈 셀: ${805 - displayOccupiedYardCount}개)`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>


      </div>
    </div>
  );
}
