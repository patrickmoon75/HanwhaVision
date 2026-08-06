import React, { useState, useEffect, useRef, useCallback } from 'react';
import HeaderMasterKPI from './components/HeaderMasterKPI';
import PickingTrendView from './components/PickingTrendView';
import RootCauseIsolationView from './components/RootCauseIsolationView';
import DailyDefenseReportView from './components/DailyDefenseReportView';
import SlottingSimulatorModal from './components/SlottingSimulatorModal';
import ExceptionAlertBanner from './components/ExceptionAlertBanner';
import PlannerSimulatorView from './components/PlannerSimulatorView';
import WmsDoReceiverView from './components/WmsDoReceiverView';
import LoginScreen from './components/LoginScreen';
import AccessLogModal from './components/AccessLogModal';
import { loadAndProcessData, processRawDatasets, fetchSupabaseData, fetchExcelData } from './services/dataProcessor';
import { logLogin, logLogout } from './services/accessLogger';
import * as XLSX from 'xlsx';
import { Upload, Sparkles } from 'lucide-react';
import './styles/dashboard.css';

const DEFAULT_RACK_PATH = 'c:\\Users\\bosel\\Desktop\\한화비전 분석 프로그램\\Rack_20260720_수정.xlsx';
const DEFAULT_INVENTORY_PATH = 'c:\\Users\\bosel\\Desktop\\한화비전 분석 프로그램\\★창고데이터(분석용).xlsx';

const AUTO_LOGOUT_MS = 30 * 60 * 1000;   // 30분
const WARN_BEFORE_MS = 5 * 60 * 1000;    // 남은 5분 전 경고

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('rwcs_authenticated') === 'true');
  const [username, setUsername] = useState(() => sessionStorage.getItem('rwcs_username') || '');
  const [activeView, setActiveView] = useState('analytics');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('2026-06-29');
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState('2026-07-09');
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [simPickingRows, setSimPickingRows] = useState([]);
  const [simYardIds, setSimYardIds] = useState(new Set());
  const [showAccessLog, setShowAccessLog] = useState(false);
  const [showAutoLogoutWarn, setShowAutoLogoutWarn] = useState(false);

  const sessionIdRef = useRef(null);           // Supabase access_logs row id
  const autoLogoutTimerRef = useRef(null);
  const warnTimerRef = useRef(null);

  const performLogout = useCallback(async (type = 'manual') => {
    if (sessionIdRef.current) {
      await logLogout(sessionIdRef.current, type);
      sessionIdRef.current = null;
    }
    clearTimeout(autoLogoutTimerRef.current);
    clearTimeout(warnTimerRef.current);
    setShowAutoLogoutWarn(false);
    sessionStorage.removeItem('rwcs_authenticated');
    sessionStorage.removeItem('rwcs_username');
    setIsAuthenticated(false);
    setUsername('');
  }, []);

  const handleLogout = useCallback(() => performLogout('manual'), [performLogout]);

  // 무활동 자동 로그아웃 타이머 리셋
  const resetAutoLogoutTimer = useCallback(() => {
    if (!isAuthenticated) return;
    clearTimeout(autoLogoutTimerRef.current);
    clearTimeout(warnTimerRef.current);
    setShowAutoLogoutWarn(false);
    // 25분 후 경고 토스트
    warnTimerRef.current = setTimeout(() => setShowAutoLogoutWarn(true), AUTO_LOGOUT_MS - WARN_BEFORE_MS);
    // 30분 후 자동 로그아웃
    autoLogoutTimerRef.current = setTimeout(() => performLogout('auto'), AUTO_LOGOUT_MS);
  }, [isAuthenticated, performLogout]);

  // 브라우저/탭 종료 시 미종료 세션 로그아웃 마감 시도
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionIdRef.current) {
        logLogout(sessionIdRef.current, 'browser_close');
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // 인증된 동안 활동 이벤트 감지
  useEffect(() => {
    if (!isAuthenticated) return;
    resetAutoLogoutTimer();
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(ev => window.addEventListener(ev, resetAutoLogoutTimer, { passive: true }));
    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetAutoLogoutTimer));
      clearTimeout(autoLogoutTimerRef.current);
      clearTimeout(warnTimerRef.current);
    };
  }, [isAuthenticated, resetAutoLogoutTimer]);

  const [rackFileInfo, setRackFileInfo] = useState({
    name: 'Rack_20260720_수정.xlsx',
    path: DEFAULT_RACK_PATH,
    isDefault: true
  });

  const [inventoryFileInfo, setInventoryFileInfo] = useState({
    name: '★창고데이터(분석용).xlsx',
    path: DEFAULT_INVENTORY_PATH,
    isDefault: true
  });

  const [rawDatasets, setRawDatasets] = useState({
    rackRows: [],
    planRows: [],
    missionRows: [],
    inventoryRows: [],
    pickingRows: []
  });

  useEffect(() => {
    async function initData() {
      try {
        const result = await loadAndProcessData();
        setData(result);
        if (result.rawDatasets) {
          setRawDatasets(result.rawDatasets);
        }
        if (result.pickingRows) setSimPickingRows(result.pickingRows);
        if (result.yardIds) setSimYardIds(result.yardIds);
        if (result.dates && result.dates.length > 0) {
          setSelectedDate(result.dates[result.dates.length - 1]);
          setStartDate(result.dates[0]);
          setEndDate(result.dates[result.dates.length - 1]);
        }
        if (result.dataSource === 'supabase') {
          setInventoryFileInfo({
            name: 'Supabase Database',
            path: 'Live Database Connection: Rest API ( resolution=merge-duplicates )',
            isDefault: false
          });
        }
      } catch (err) {
        console.error("Default fetch failed, listening for manual file uploads:", err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  // 랙 정보 파일 개별 교체
  const handleReplaceRackFile = async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const rackRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

      const newRaw = { ...rawDatasets, rackRows };
      setRawDatasets(newRaw);

      const result = processRawDatasets(newRaw);
      setData(result);
      if (result.pickingRows) setSimPickingRows(result.pickingRows);
      if (result.yardIds) setSimYardIds(result.yardIds);

      setRackFileInfo({
        name: file.name,
        path: file.path || file.name,
        isDefault: false
      });
    } catch (err) {
      alert("랙 정보 파일 파싱 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 재고 정보 파일 개별 교체
  const handleReplaceInventoryFile = async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      const planRows = wb.Sheets['배치계획'] ? XLSX.utils.sheet_to_json(wb.Sheets['배치계획']) : rawDatasets.planRows;
      const missionRows = wb.Sheets['미션로그'] ? XLSX.utils.sheet_to_json(wb.Sheets['미션로그']) : rawDatasets.missionRows;
      const inventoryRows = wb.Sheets['재고현황'] ? XLSX.utils.sheet_to_json(wb.Sheets['재고현황']) : rawDatasets.inventoryRows;
      const pickingRows = wb.Sheets['피킹오더'] ? XLSX.utils.sheet_to_json(wb.Sheets['피킹오더']) : rawDatasets.pickingRows;

      const newRaw = { ...rawDatasets, planRows, missionRows, inventoryRows, pickingRows };
      setRawDatasets(newRaw);

      const result = processRawDatasets(newRaw);
      setData(result);
      if (result.pickingRows) setSimPickingRows(result.pickingRows);
      if (result.yardIds) setSimYardIds(result.yardIds);

      if (result.dates && result.dates.length > 0) {
        if (!result.dates.includes(selectedDate)) {
          setSelectedDate(result.dates[result.dates.length - 1]);
        }
        setStartDate(result.dates[0]);
        setEndDate(result.dates[result.dates.length - 1]);
      }

      setInventoryFileInfo({
        name: file.name,
        path: file.path || file.name,
        isDefault: false
      });
    } catch (err) {
      alert("재고 정보 파일 파싱 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // DB 실시간 연동
  const handleConnectDB = async () => {
    setLoading(true);
    try {
      const result = await fetchSupabaseData();
      setData(result);
      if (result.rawDatasets) {
        setRawDatasets(result.rawDatasets);
      }
      if (result.pickingRows) setSimPickingRows(result.pickingRows);
      if (result.yardIds) setSimYardIds(result.yardIds);
      if (result.dates && result.dates.length > 0) {
        setSelectedDate(result.dates[result.dates.length - 1]);
        setStartDate(result.dates[0]);
        setEndDate(result.dates[result.dates.length - 1]);
      }
      setInventoryFileInfo({
        name: 'Supabase Database',
        path: 'Live Database Connection: Rest API ( resolution=merge-duplicates )',
        isDefault: false
      });
      setRackFileInfo({
        name: 'Rack_20260720_수정.xlsx',
        path: DEFAULT_RACK_PATH,
        isDefault: true
      });
    } catch (err) {
      alert("DB 연결 실패:\n" + err.message + "\n\n환경 변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) 설정을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  // 로컬 엑셀 데이터 연동
  const handleConnectExcel = async () => {
    setLoading(true);
    try {
      const result = await fetchExcelData();
      setData(result);
      if (result.rawDatasets) {
        setRawDatasets(result.rawDatasets);
      }
      if (result.pickingRows) setSimPickingRows(result.pickingRows);
      if (result.yardIds) setSimYardIds(result.yardIds);
      if (result.dates && result.dates.length > 0) {
        setSelectedDate(result.dates[result.dates.length - 1]);
        setStartDate(result.dates[0]);
        setEndDate(result.dates[result.dates.length - 1]);
      }
      setRackFileInfo({
        name: 'Rack_20260720_수정.xlsx',
        path: DEFAULT_RACK_PATH,
        isDefault: true
      });
      setInventoryFileInfo({
        name: '★창고데이터(분석용).xlsx',
        path: DEFAULT_INVENTORY_PATH,
        isDefault: true
      });
    } catch (err) {
      alert("엑셀 데이터 로드 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 현재 활성화된 WMS 데이터 (Supabase 혹은 로컬 엑셀)를 XLSX 파일로 다운로드
  const handleDownloadExcel = () => {
    try {
      if (!rawDatasets) {
        alert("다운로드할 데이터가 존재하지 않습니다.");
        return;
      }

      const wb = XLSX.utils.book_new();
      let hasData = false;

      if (rawDatasets.planRows && rawDatasets.planRows.length > 0) {
        const wsPlan = XLSX.utils.json_to_sheet(rawDatasets.planRows);
        XLSX.utils.book_append_sheet(wb, wsPlan, '배치계획');
        hasData = true;
      }
      if (rawDatasets.missionRows && rawDatasets.missionRows.length > 0) {
        const wsMission = XLSX.utils.json_to_sheet(rawDatasets.missionRows);
        XLSX.utils.book_append_sheet(wb, wsMission, '미션로그');
        hasData = true;
      }
      if (rawDatasets.inventoryRows && rawDatasets.inventoryRows.length > 0) {
        const wsInv = XLSX.utils.json_to_sheet(rawDatasets.inventoryRows);
        XLSX.utils.book_append_sheet(wb, wsInv, '재고현황');
        hasData = true;
      }
      if (rawDatasets.pickingRows && rawDatasets.pickingRows.length > 0) {
        const wsPick = XLSX.utils.json_to_sheet(rawDatasets.pickingRows);
        XLSX.utils.book_append_sheet(wb, wsPick, '피킹오더');
        hasData = true;
      }
      if (rawDatasets.pendingOrderRows && rawDatasets.pendingOrderRows.length > 0) {
        const wsPending = XLSX.utils.json_to_sheet(rawDatasets.pendingOrderRows);
        XLSX.utils.book_append_sheet(wb, wsPending, '미출고DO');
        hasData = true;
      }

      if (!hasData) {
        alert("시트에 작성할 유효한 데이터가 존재하지 않습니다.");
        return;
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `WMS_DB_Data_${timestamp}.xlsx`);
    } catch (err) {
      console.error('Download failed:', err);
      alert('엑셀 다운로드 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // Drag & Drop / 통합 파일 업로드 파싱
  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      await parseUploadedFiles(files);
    }
  };

  const parseUploadedFiles = async (files) => {
    setLoading(true);
    try {
      let rackRows = rawDatasets.rackRows;
      let planRows = rawDatasets.planRows;
      let missionRows = rawDatasets.missionRows;
      let inventoryRows = rawDatasets.inventoryRows;
      let pickingRows = rawDatasets.pickingRows;
      let pendingOrderRows = rawDatasets.pendingOrderRows || [];

      let updatedRackFile = rackFileInfo;
      let updatedInventoryFile = inventoryFileInfo;

      for (const file of files) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        
        if (file.name.includes('Rack') || file.name.includes('랙')) {
          rackRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          updatedRackFile = {
            name: file.name,
            path: file.path || file.name,
            isDefault: false
          };
        } else {
          if (wb.Sheets['배치계획']) planRows = XLSX.utils.sheet_to_json(wb.Sheets['배치계획']);
          if (wb.Sheets['미션로그']) missionRows = XLSX.utils.sheet_to_json(wb.Sheets['미션로그']);
          if (wb.Sheets['재고현황']) inventoryRows = XLSX.utils.sheet_to_json(wb.Sheets['재고현황']);
          if (wb.Sheets['피킹오더']) pickingRows = XLSX.utils.sheet_to_json(wb.Sheets['피킹오더']);
          
          const pendingSheet = wb.Sheets['미출고DO'] || wb.Sheets['미출고오더'] || wb.Sheets['PendingDO'] || wb.Sheets['PendingOrders'] || wb.Sheets['pending_orders'] || wb.Sheets['미출고_DO'];
          if (pendingSheet) {
            pendingOrderRows = XLSX.utils.sheet_to_json(pendingSheet);
          }

          updatedInventoryFile = {
            name: file.name,
            path: file.path || file.name,
            isDefault: false
          };
        }
      }

      const newRaw = { rackRows, planRows, missionRows, inventoryRows, pickingRows, pendingOrderRows };
      setRawDatasets(newRaw);

      const result = processRawDatasets(newRaw);
      setData(result);
      if (result.pickingRows) setSimPickingRows(result.pickingRows);
      if (result.yardIds) setSimYardIds(result.yardIds);
      setRackFileInfo(updatedRackFile);
      setInventoryFileInfo(updatedInventoryFile);

      if (result.dates && result.dates.length > 0) {
        setSelectedDate(result.dates[result.dates.length - 1]);
        setStartDate(result.dates[0]);
        setEndDate(result.dates[result.dates.length - 1]);
      }
    } catch (err) {
      alert("파일 파싱 중 오류가 발생했습니다: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <LoginScreen 
        onLoginSuccess={async (name, pwNo) => {
          sessionStorage.setItem('rwcs_authenticated', 'true');
          sessionStorage.setItem('rwcs_username', name);
          sessionStorage.setItem('rwcs_pw_no', String(pwNo || 1));
          setIsAuthenticated(true);
          setUsername(name);
          // Supabase access_logs에 로그인 기록 INSERT (비밀번호 번호 포함)
          const sid = await logLogin(name, pwNo || 1);
          sessionIdRef.current = sid;
        }} 
      />
    );
  }

  if (loading) {
    return (
      <div className="loading-box">
        <div className="spinner"></div>
        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>RWCS-AGS 엑셀 파이프라인 데이터 파싱 중...</p>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Rack 마스터 및 미션/재고 현황 조인 엔진 구동 중</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dashboard-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '40px' }}>
          <Upload size={48} color="var(--accent-cyan)" style={{ marginBottom: '16px' }} />
          <h2>RWCS-AGS 데이터 로더</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px' }}>
            "Rack_20260720_수정.xlsx" 및 "창고데이터_수정.xlsx" 드래그 앤 드롭 업로드
          </p>
          <input
            type="file"
            multiple
            accept=".xlsx"
            onChange={(e) => parseUploadedFiles(Array.from(e.target.files))}
            style={{ display: 'none' }}
            id="excel-file-input"
          />
          <label htmlFor="excel-file-input" className="btn-primary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
            <Sparkles size={18} />
            엑셀 파일 선택하기
          </label>
        </div>
      </div>
    );
  }

  const currentDateInfo = data.dailyAnalytics[selectedDate] || {};

  // Filter Invalid Missions by Selected Date Range (startDate ~ endDate)
  const filteredInvalidMissions = (data.invalidMissions || []).filter(m => {
    if (!m.date) return true;
    const start = startDate || (data.dates?.[0]);
    const end = endDate || (data.dates?.[data.dates?.length - 1]);
    return m.date >= start && m.date <= end;
  });

  return (
    <div
      className="dashboard-container"
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      {/* 1. Header & Physical Master KPI */}
      <HeaderMasterKPI
        masterKPI={data.masterKPI}
        selectedDate={selectedDate}
        dates={data.dates}
        onSelectDate={setSelectedDate}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        rackFileInfo={rackFileInfo}
        inventoryFileInfo={inventoryFileInfo}
        onReplaceRackFile={handleReplaceRackFile}
        onReplaceInventoryFile={handleReplaceInventoryFile}
        onDownloadExcel={handleDownloadExcel}
        dataSource={data.dataSource || 'excel'}
        onConnectDB={handleConnectDB}
        onConnectExcel={handleConnectExcel}
        activeView={activeView}
        onChangeView={setActiveView}
        onLogout={handleLogout}
        username={username}
        onShowAccessLog={() => setShowAccessLog(true)}
      />

      {activeView === 'analytics' ? (
        <>
          {/* 2. RWCS Exception Alert Banner (Filtered by Date Range) */}
          <ExceptionAlertBanner 
            invalidMissions={filteredInvalidMissions} 
            startDate={startDate}
            endDate={endDate}
          />

          {/* 3. Top Trend View */}
          <PickingTrendView
            dates={data.dates}
            dailyAnalytics={data.dailyAnalytics}
            rawDatasets={rawDatasets}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            startDate={startDate}
            endDate={endDate}
            onRangeChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
          />

          {/* 4. Middle Root Cause Isolation View */}
          <RootCauseIsolationView
            selectedDate={selectedDate}
            dateInfo={currentDateInfo}
          />

          {/* 5. Bottom Daily Defense Report */}
          <DailyDefenseReportView
            selectedDate={selectedDate}
            dateInfo={currentDateInfo}
          />

          {/* 6. Planner 배치계획 시뮬레이터 */}
          <PlannerSimulatorView
            pickingRows={simPickingRows}
            yardIds={simYardIds}
            dates={data.dates}
            dailyAnalytics={data.dailyAnalytics}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            startDate={startDate}
            endDate={endDate}
            onRangeChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
            inventoryRows={rawDatasets.inventoryRows}
            rackRows={rawDatasets.rackRows}
            planRows={rawDatasets.planRows}
            rawDatasets={rawDatasets}
            pendingOrderRows={rawDatasets.pendingOrderRows}
            dataSource={data.dataSource || 'excel'}
          />
        </>
      ) : (
        <WmsDoReceiverView />
      )}

      {/* 7. Slotting Engine Feedback Simulator Modal */}
      <SlottingSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        dateInfo={currentDateInfo}
      />

      {/* 8. Access Log Modal */}
      {showAccessLog && <AccessLogModal onClose={() => setShowAccessLog(false)} />}

      {/* 9. Auto Logout Warning Toast */}
      {showAutoLogoutWarn && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9998,
          background: 'linear-gradient(135deg, rgba(245,158,11,0.95), rgba(239,68,68,0.9))',
          border: '1px solid rgba(245,158,11,0.6)',
          borderRadius: '12px', padding: '14px 20px',
          color: '#fff', fontSize: '0.9rem', fontWeight: 600,
          boxShadow: '0 8px 30px rgba(245,158,11,0.4)',
          display: 'flex', alignItems: 'center', gap: '10px',
          animation: 'pulse 1.5s infinite'
        }}>
          ⚠️ 5분 후 자동 로그아웃됩니다. 계속 사용하시려면 화면을 클릭하세요.
          <button onClick={resetAutoLogoutTimer} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: '6px', padding: '4px 10px', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>계속 사용</button>
        </div>
      )}
    </div>
  );
}
