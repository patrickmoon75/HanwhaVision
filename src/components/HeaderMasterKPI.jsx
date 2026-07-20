import React from 'react';
import { ShieldAlert, Server, AlertTriangle, Layers, Calendar, Cpu } from 'lucide-react';

export default function HeaderMasterKPI({ masterKPI, selectedDate, dates, onSelectDate, onOpenSimulator }) {
  if (!masterKPI) return null;

  return (
    <header className="header-bar glass-card">
      <div className="header-top">
        <div className="brand-section">
          <img 
            src="/images/Hanwha_logo.jpg" 
            alt="한화비전 로고" 
            style={{ 
              height: '42px', 
              borderRadius: '6px', 
              objectFit: 'contain',
              background: '#ffffff',
              padding: '3px 8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }} 
          />
          <div>
            <h1 className="brand-title">RWCS Analytics & Simulator</h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              한화비전 대고객 방어용 운영 분석 및 물리 인프라 제약 격리(Isolation) 시스템
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="date-selector-group">
            <Calendar size={18} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>분석 일자 (Day N+1):</span>
            <select value={selectedDate} onChange={(e) => onSelectDate(e.target.value)}>
              {dates.map(d => (
                <option key={d} value={d} style={{ background: '#111827', color: '#fff' }}>
                  {d} {d === '2026-06-29' ? '⚠️ (피킹율 급락일)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button className="btn-primary" onClick={onOpenSimulator}>
            <Cpu size={18} />
            슬로팅 보정 시뮬레이터
          </button>
        </div>
      </div>

      {/* Master KPI Row */}
      <div className="kpi-grid" style={{ marginTop: '8px' }}>
        <div className="kpi-card glass-card" style={{ '--card-accent': 'var(--accent-cyan)' }}>
          <div className="kpi-icon-wrapper">
            <Server size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">야드(Yard) 가용 현황</span>
            <span className="kpi-value">{masterKPI.availYard} / {masterKPI.totalYard} 셀</span>
            <span className="kpi-sub">가용률 {masterKPI.yardAvailRate}% (접근불가 {masterKPI.blockedYard}개)</span>
          </div>
        </div>

        <div className="kpi-card glass-card" style={{ '--card-accent': 'var(--accent-blue)' }}>
          <div className="kpi-icon-wrapper">
            <Layers size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">일반 랙(Rack) 가용 현황</span>
            <span className="kpi-value">{masterKPI.availRack} / {masterKPI.totalRack} 셀</span>
            <span className="kpi-sub">가용률 {masterKPI.rackAvailRate}% (접근불가 {masterKPI.blockedRack}개)</span>
          </div>
        </div>

        <div className="kpi-card glass-card" style={{ '--card-accent': 'var(--accent-rose)' }}>
          <div className="kpi-icon-wrapper" style={{ color: 'var(--accent-rose)' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">창고 인프라 차단율 (Blocked)</span>
            <span className="kpi-value" style={{ color: 'var(--accent-rose)' }}>
              {masterKPI.overallBlockedRate}%
            </span>
            <span className="kpi-sub">총 8,260개 중 2,532개 셀 진입 불가</span>
          </div>
        </div>

        <div className="kpi-card glass-card" style={{ '--card-accent': 'var(--accent-green)' }}>
          <div className="kpi-icon-wrapper" style={{ color: 'var(--accent-green)' }}>
            <ShieldAlert size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">방어 진단 모드</span>
            <span className="kpi-value" style={{ color: 'var(--accent-green)', fontSize: '1.2rem' }}>
              인프라 손실 정량 분리
            </span>
            <span className="kpi-sub">책임 소재 팩트 데이터 매핑 중</span>
          </div>
        </div>
      </div>
    </header>
  );
}
