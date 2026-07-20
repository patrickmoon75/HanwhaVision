import React, { useState } from 'react';
import { AlertTriangle, ChevronRight, X, ShieldAlert } from 'lucide-react';

export default function ExceptionAlertBanner({ invalidMissions = [], startDate, endDate }) {
  const [showModal, setShowModal] = useState(false);

  if (!invalidMissions || invalidMissions.length === 0) return null;

  const dateRangeText = startDate && endDate ? ` (조회 기간: ${startDate} ~ ${endDate})` : '';

  return (
    <>
      <div className="alert-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={20} />
          <div>
            <strong>RWCS 미션 오설정 예외 경고:</strong> 선택 조회 기간 내 진입 불가(Blocked == TRUE) 랙을 대상(From/To)으로 발주된 비정상 미션 
            <strong style={{ color: '#fff', marginLeft: '4px', textDecoration: 'underline' }}>{invalidMissions.length}건</strong>이 탐지되었습니다.
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginLeft: '6px' }}>{dateRangeText}</span>
          </div>
        </div>

        <button className="btn-secondary" style={{ borderColor: 'rgba(255,8,68,0.4)', color: '#ff4b72' }} onClick={() => setShowModal(true)}>
          상세 예외 로그 보기
          <ChevronRight size={16} />
        </button>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={24} color="#ff0844" />
                <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>RWCS 미션 오설정 예외 상세 로그</h3>
              </div>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              진입 불가 구역(Blocked 랙)에 무인지게차(AGF) 이동 지시가 전달되어 발생한 미션 생성 예외 로그 리스트입니다.
            </p>

            <div style={{ overflowY: 'auto', maxHeight: '450px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 12px' }}>Mission ID</th>
                    <th style={{ padding: '8px 12px' }}>Robot ID</th>
                    <th style={{ padding: '8px 12px' }}>From &rarr; To</th>
                    <th style={{ padding: '8px 12px' }}>Target Item</th>
                    <th style={{ padding: '8px 12px' }}>Blocked 사유</th>
                    <th style={{ padding: '8px 12px' }}>State</th>
                  </tr>
                </thead>
                <tbody>
                  {invalidMissions.slice(0, 30).map((m, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>{m.MissionId}</td>
                      <td style={{ padding: '8px 12px' }}>{m.RobotId || 'N/A'}</td>
                      <td style={{ padding: '8px 12px' }}>{m.FromLocation} → {m.ToLocation}</td>
                      <td style={{ padding: '8px 12px' }}>{m.TargetItem}</td>
                      <td style={{ padding: '8px 12px', color: '#ff4b72', fontWeight: 600 }}>{m.blockedReason}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ background: 'rgba(255,8,68,0.2)', color: '#ff0844', padding: '2px 6px', borderRadius: '4px' }}>
                          {m.State}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '14px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              총 {invalidMissions.length}건 중 상위 30건 표기 (미션 발주 알고리즘 사전 필터링 필요)
            </div>
          </div>
        </div>
      )}
    </>
  );
}
