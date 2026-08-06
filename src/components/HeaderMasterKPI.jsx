import { ShieldAlert, Server, AlertTriangle, Layers, Calendar, Cpu, Database, FileSpreadsheet, FolderOpen, FileCheck, Download, LogOut, ClipboardList, RefreshCw } from 'lucide-react';
import { formatWithDayOfWeek } from '../services/dataProcessor';

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
  onDownloadExcel,
  dataSource,
  onConnectDB,
  onConnectExcel,
  activeView,
  onChangeView,
  onLogout,
  username,
  onShowAccessLog,
  onUpdateSkuPalletAvg,
  onDownloadSkuPalletExcel,
  isUpdatingSku
}) {
  if (!masterKPI) return null;

  return (
    <header className="header-bar glass-card">
      <div className="header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '12px' }}>
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

        {/* ── 상단 우측: 접속자 · 접속로그보기 · 로그아웃 ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {username && (
            <div style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              접속자: <strong style={{ color: 'var(--accent-cyan)' }}>{username}</strong> 님
            </div>
          )}

          {onShowAccessLog && (
            <button
              className="btn-secondary"
              onClick={onShowAccessLog}
              style={{
                background: 'rgba(167,139,250,0.1)',
                borderColor: 'rgba(167,139,250,0.3)',
                color: '#a78bfa',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="접속 로그 보기"
            >
              <ClipboardList size={16} />
              접속로그보기
            </button>
          )}

          {onLogout && (
            <button
              className="btn-secondary"
              onClick={onLogout}
              style={{
                background: 'rgba(255, 8, 68, 0.1)',
                borderColor: 'rgba(255, 8, 68, 0.3)',
                color: '#ff4b72',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="로그아웃"
            >
              <LogOut size={16} />
              로그아웃
            </button>
          )}
        </div>
      </div>

      {/* 컨트롤 줄: 날짜 · 시뮬레이터 · WMS · SKU업데이트 · SKU다운로드 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>

        {/* ── 좌측 그룹 ── */}
        <div className="date-selector-group">
          <Calendar size={18} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>분석 일자 (Day N+1):</span>
          <select value={selectedDate} onChange={(e) => onSelectDate(e.target.value)}>
            {dates.map(d => (
              <option key={d} value={d} style={{ background: '#111827', color: '#fff' }}>
                {formatWithDayOfWeek(d)} {d === '2026-06-29' ? '⚠️ (피킹율 급락일)' : ''}
              </option>
            ))}
          </select>
        </div>

        <button className="btn-primary" onClick={onOpenSimulator}>
          <Cpu size={18} />
          슬로팅 보정 시뮬레이터
        </button>

        {activeView === 'analytics' ? (
          <button className="btn-secondary" onClick={() => onChangeView('wms_do')} style={{ border: '1px solid var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={18} color="var(--accent-cyan)" />
            WMS 수집 제어판
          </button>
        ) : (
          <button className="btn-secondary" onClick={() => onChangeView('analytics')} style={{ border: '1px solid var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} color="var(--accent-blue)" />
            운영 분석 대시보드
          </button>
        )}

        {/* ── SKU별 파레트 평균 적재량 관리 버튼 그룹 ── */}
        <button 
          className="btn-secondary" 
          onClick={onUpdateSkuPalletAvg}
          disabled={isUpdatingSku}
          title="6월 1일부터 현재까지의 재고 데이터를 이용하여 SKU별 파레트 평균 적재량을 업데이트하고 DB/캐시에 저장합니다"
          style={{ border: '1px solid #3b82f6', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={16} className={isUpdatingSku ? 'spin' : ''} />
          {isUpdatingSku ? 'SKU계산중...' : 'SKU업데이트'}
        </button>

        <button 
          className="btn-secondary" 
          onClick={onDownloadSkuPalletExcel}
          title="계산된 SKU별 파레트 평균 적재량 데이터 엑셀 파일 다운로드"
          style={{ border: '1px solid #10b981', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <FileSpreadsheet size={16} />
          SKU다운로드
        </button>
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
            {onDownloadExcel && (
              <button 
                type="button" 
                className="btn-file-download" 
                onClick={onDownloadExcel}
                title="WMS 재고 및 피킹오더 데이터 다운로드 (XLSX)"
              >
                <Download size={14} />
                <span>다운로드</span>
              </button>
            )}
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
