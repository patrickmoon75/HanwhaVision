import React, { useState, useEffect } from 'react';
import HeaderMasterKPI from './components/HeaderMasterKPI';
import PickingTrendView from './components/PickingTrendView';
import RootCauseIsolationView from './components/RootCauseIsolationView';
import DailyDefenseReportView from './components/DailyDefenseReportView';
import SlottingSimulatorModal from './components/SlottingSimulatorModal';
import ExceptionAlertBanner from './components/ExceptionAlertBanner';
import PlannerSimulatorView from './components/PlannerSimulatorView';
import { loadAndProcessData, processRawDatasets } from './services/dataProcessor';
import * as XLSX from 'xlsx';
import { Upload, Sparkles } from 'lucide-react';
import './styles/dashboard.css';

const DEFAULT_RACK_PATH = 'c:\\Users\\bosel\\Desktop\\한화비전 분석 프로그램\\Rack_20260720_수정.xlsx';
const DEFAULT_INVENTORY_PATH = 'c:\\Users\\bosel\\Desktop\\한화비전 분석 프로그램\\창고데이터_수정.xlsx';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('2026-06-29');
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState('2026-07-09');
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [simPickingRows, setSimPickingRows] = useState([]);
  const [simYardIds, setSimYardIds] = useState(new Set());

  const [rackFileInfo, setRackFileInfo] = useState({
    name: 'Rack_20260720_수정.xlsx',
    path: DEFAULT_RACK_PATH,
    isDefault: true
  });

  const [inventoryFileInfo, setInventoryFileInfo] = useState({
    name: '창고데이터_수정.xlsx',
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
          setSelectedDate(result.dates.includes('2026-06-29') ? '2026-06-29' : result.dates[0]);
          setStartDate(result.dates[0]);
          setEndDate(result.dates[result.dates.length - 1]);
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
          setSelectedDate(result.dates[0]);
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
          updatedInventoryFile = {
            name: file.name,
            path: file.path || file.name,
            isDefault: false
          };
        }
      }

      const newRaw = { rackRows, planRows, missionRows, inventoryRows, pickingRows };
      setRawDatasets(newRaw);

      const result = processRawDatasets(newRaw);
      setData(result);
      if (result.pickingRows) setSimPickingRows(result.pickingRows);
      if (result.yardIds) setSimYardIds(result.yardIds);
      setRackFileInfo(updatedRackFile);
      setInventoryFileInfo(updatedInventoryFile);

      if (result.dates && result.dates.length > 0) {
        setSelectedDate(result.dates[0]);
        setStartDate(result.dates[0]);
        setEndDate(result.dates[result.dates.length - 1]);
      }
    } catch (err) {
      alert("파일 파싱 중 오류가 발생했습니다: " + err.message);
    } finally {
      setLoading(false);
    }
  };

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
      />

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
      />

      {/* 7. Slotting Engine Feedback Simulator Modal */}
      <SlottingSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        dateInfo={currentDateInfo}
      />
    </div>
  );
}
