import React from 'react';
import { X, Cpu, TrendingUp, Sliders, CheckCircle, ArrowRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function SlottingSimulatorModal({ isOpen, onClose, dateInfo }) {
  if (!isOpen || !dateInfo) return null;

  // 시뮬레이션 데이터: 기존 피킹율 vs Executable Score 보정 피킹율
  const origRate = dateInfo.yardPickingRate;
  const simulatedRate = Math.min(96.5, Number((origRate + dateInfo.infraLossRate * 0.75).toFixed(2)));

  const simComparisonData = [
    { name: '현재 배치 기준 (기존 Score)', pickingRate: origRate },
    { name: '보정 Score 시뮬레이션 (Executable)', pickingRate: simulatedRate }
  ];

  // 야드 Cap 수량 조정 추천 가이드 데이터 (잔량 SKU 감지 분석)
  const capRecommendations = [
    { itemId: 'XNP-A9314R/VEX', currentTarget: 10, recommendedCap: 4, status: 'Over-stocked', reason: '익일 오더 미발생 잔량 누적' },
    { itemId: 'SBA-245WB/VEX', currentTarget: 12, recommendedCap: 6, status: 'Over-stocked', reason: '야드 피킹률 저하 유발 SKU' },
    { itemId: 'SKK-CSA29/US', currentTarget: 8, recommendedCap: 5, status: 'Optimal', reason: '회전율 양호' },
    { itemId: 'XNV-A8014R/VEX', currentTarget: 15, recommendedCap: 7, status: 'Over-stocked', reason: 'Blocked 랙 비중 높음 (Score 감점 대상)' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(0, 242, 254, 0.15)', padding: '8px', borderRadius: '10px', color: 'var(--accent-cyan)' }}>
              <Cpu size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', color: '#fff' }}>RWCS 배치기준 (Slotting Engine) 보완 시뮬레이터</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                실행 가능 점수(Executable Score) 도입 및 야드 Cap 수량 상한선 유기적 조정 가이드
              </p>
            </div>
          </div>

          <button className="btn-secondary" onClick={onClose} style={{ padding: '6px 10px' }}>
            <X size={20} />
          </button>
        </div>

        {/* 1. Formula & Simulator Explanation */}
        <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px' }}>
            <Sliders size={18} />
            <span>실행 가능 점수 (Executable Score) 필터링 산식</span>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '10px 16px', borderRadius: '8px', fontFamily: 'monospace', color: '#00f2fe', fontSize: '0.9rem' }}>
            보정 Score = 기존 Score × ( 접근 가능 랙(Blocked=False) 내 SKU 재고량 / 전체 SKU 재고량 )
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            배치계획 수립 시 Blocked==TRUE 랙에 잠긴 재고 비율만큼 원본 Score를 감점(Penalty)하여 이송 불가능 미션 생성을 사전에 방지합니다.
          </p>
        </div>

        {/* 2. Simulation Chart */}
        <div className="grid-2col" style={{ marginBottom: '20px' }}>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp color="var(--accent-green)" size={18} />
              보정 Score 반영 시 예상 피킹율 상승 비교
            </h4>
            <div style={{ height: 180, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={simComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis domain={[0, 100]} stroke="var(--text-secondary)" tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="pickingRate" name="야드 피킹율 (%)" fill="url(#simGrad)" radius={[8, 8, 0, 0]} />
                  <defs>
                    <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00e676" />
                      <stop offset="100%" stopColor="#00f2fe" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'rgba(0, 230, 118, 0.08)', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '20px', borderRadius: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>시뮬레이션 진단 결과</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-green)', margin: '8px 0' }}>
              +{ (simulatedRate - origRate).toFixed(2) }%P 피킹율 상승 예상
            </div>
            <p style={{ fontSize: '0.82rem', color: '#e2e8f0', lineHeight: 1.6 }}>
              Blocked 랙 필터링 및 Executable Score를 적용할 경우, 허수 미션이 제거되어 <strong>야드 피킹율이 {origRate}%에서 {simulatedRate}%로 획기적으로 개선</strong>됩니다.
            </p>
          </div>
        </div>

        {/* 3. Yard Cap Guide Table */}
        <h4 style={{ fontSize: '0.95rem', marginBottom: '10px', color: 'var(--accent-cyan)' }}>
          📋 야드 배치 제한 수량 (Cap) 조정 가이드 추천
        </h4>
        <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 14px' }}>SKU (ItemId)</th>
                <th style={{ padding: '10px 14px' }}>기존 계획 수량</th>
                <th style={{ padding: '10px 14px' }}>추천 Cap 상한선</th>
                <th style={{ padding: '10px 14px' }}>상태 진단</th>
                <th style={{ padding: '10px 14px' }}>조정 권고 이유</th>
              </tr>
            </thead>
            <tbody>
              {capRecommendations.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#fff' }}>{row.itemId}</td>
                  <td style={{ padding: '10px 14px' }}>{row.currentTarget} Pallets</td>
                  <td style={{ padding: '10px 14px', color: 'var(--accent-green)', fontWeight: 700 }}>
                    {row.recommendedCap} Pallets
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      background: row.status === 'Over-stocked' ? 'rgba(255,8,68,0.2)' : 'rgba(0,230,118,0.2)',
                      color: row.status === 'Over-stocked' ? '#ff0844' : '#00e676',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem'
                    }}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn-primary" onClick={onClose}>
            <CheckCircle size={18} />
            시뮬레이션 가이드 적용
          </button>
        </div>
      </div>
    </div>
  );
}
