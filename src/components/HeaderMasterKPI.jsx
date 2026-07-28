import React from 'react';
import { ShieldAlert, Server, AlertTriangle, Layers, Calendar, Cpu, Database, FileSpreadsheet, FolderOpen, FileCheck } from 'lucide-react';

export default function HeaderMasterKPI({ 
  masterKPI, 
  selectedDate, 
  dates, 
  onSelectDate, 
  onOpenSimulator,
  rackFileInfo,
  inventoryFileInfo,
  onReplaceRackFile,
  onReplaceInventoryFile,
  dataSource,
  onConnectDB,
  onConnectExcel
}) {
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
              한화비전 운영 분석 및 시뮬레이션 시스템
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

      {/* File Status & Source File Switcher Bar */}
      <div className="file-status-bar-container">
        <div className="file-status-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {dataSource === 'supabase' ? <Database size={16} color="#10b981" /> : <FileSpreadsheet size={16} color="var(--accent-cyan)" />}
            <span style={{ fontSize: '0.85rem' }}>현재 데이터소스: <strong style={{ color: dataSource === 'supabase' ? '#10b981' : 'var(--accent-cyan)' }}>{dataSource === 'supabase' ? 'Supabase Database (실시간 연동)' : '로컬 엑셀 파일 정보'}</strong></span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {dataSource === 'supabase' ? (
              <>
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  background: 'rgba(16, 185, 129, 0.15)', 
                  color: '#10b981', 
                  padding: '4px 10px', 
                  borderRadius: '12px', 
                  fontSize: '0.75rem', 
                  fontWeight: 'bold',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  boxShadow: '0 0 8px rgba(16,185,129,0.1)'
                }}>
                  <span style={{ 
                    width: '6px', 
                    height: '6px', 
                    backgroundColor: '#10b981', 
                    borderRadius: '50%', 
                    display: 'inline-block',
                    boxShadow: '0 0 4px #10b981'
                  }}></span>
                  DB 연결됨
                </span>
                <button 
                  onClick={onConnectExcel} 
                  className="btn-secondary" 
                  style={{ 
                    padding: '4px 10px', 
                    fontSize: '0.75rem', 
                    borderRadius: '8px',
                    borderColor: 'rgba(0, 242, 254, 0.3)',
                    height: '26px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <FileSpreadsheet size={12} />
                  로컬 엑셀로 전환
                </button>
              </>
            ) : (
              <>
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  background: 'rgba(0, 242, 254, 0.1)', 
                  color: 'var(--accent-cyan)', 
                  padding: '4px 10px', 
                  borderRadius: '12px', 
                  fontSize: '0.75rem', 
                  fontWeight: 'bold',
                  border: '1px solid rgba(0, 242, 254, 0.2)'
                }}>
                  엑셀 모드
                </span>
                <button 
                  onClick={onConnectDB} 
                  className="btn-primary" 
                  style={{ 
                    padding: '4px 10px', 
                    fontSize: '0.75rem', 
                    borderRadius: '8px',
                    color: '#0b0f19',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)',
                    border: 'none',
                    cursor: 'pointer',
                    height: '26px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                >
                  <Database size={12} />
                  Supabase DB 연결
                </button>
              </>
            )}
          </div>
        </div>
        <div className="file-status-grid">
          {/* Rack File Info Chip */}
          <div className="file-info-chip">
            <div className="file-chip-icon rack">
              <Database size={18} />
            </div>
            <div className="file-chip-body">
              <div className="file-chip-header">
                <span className="file-type-name">1. 랙 정보 파일</span>
                <span className={`file-badge ${rackFileInfo?.isDefault ? 'badge-default' : 'badge-custom'}`}>
                  {rackFileInfo?.isDefault ? '기본 파일 경로' : '사용자 지정 교체됨'}
                </span>
              </div>
              <div className="file-path-text" title={rackFileInfo?.path || 'c:\\Users\\bosel\\Desktop\\한화비전 분석 프로그램\\Rack_20260720_수정.xlsx'}>
                {rackFileInfo?.path || 'c:\\Users\\bosel\\Desktop\\한화비전 분석 프로그램\\Rack_20260720_수정.xlsx'}
              </div>
            </div>
            <label className="btn-file-change">
              <FolderOpen size={14} />
              <span>파일 교체</span>
              <input 
                type="file" 
                accept=".xlsx" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onReplaceRackFile(e.target.files[0]);
                  }
                }}
                style={{ display: 'none' }} 
              />
            </label>
          </div>

          {/* Inventory Data File Info Chip */}
          <div className="file-info-chip">
            <div className="file-chip-icon inventory">
              <FileSpreadsheet size={18} />
            </div>
            <div className="file-chip-body">
              <div className="file-chip-header">
                <span className="file-type-name">2. 재고 (창고) 정보 파일</span>
                <span className={`file-badge ${inventoryFileInfo?.isDefault ? 'badge-default' : 'badge-custom'}`}>
                  {inventoryFileInfo?.isDefault ? '기본 파일 경로' : '사용자 지정 교체됨'}
                </span>
              </div>
              <div className="file-path-text" title={inventoryFileInfo?.path || 'c:\\Users\\bosel\\Desktop\\한화비전 분석 프로그램\\창고데이터_수정.xlsx'}>
                {inventoryFileInfo?.path || 'c:\\Users\\bosel\\Desktop\\한화비전 분석 프로그램\\창고데이터_수정.xlsx'}
              </div>
            </div>
            <label className="btn-file-change">
              <FolderOpen size={14} />
              <span>파일 교체</span>
              <input 
                type="file" 
                accept=".xlsx" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onReplaceInventoryFile(e.target.files[0]);
                  }
                }}
                style={{ display: 'none' }} 
              />
            </label>
          </div>
        </div>
      </div>

      {/* Master KPI Row */}
      <div className="kpi-grid">
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
