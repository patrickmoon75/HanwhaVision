import React, { useState, useEffect } from 'react';
import HeaderMasterKPI from './components/HeaderMasterKPI';
import PickingTrendView from './components/PickingTrendView';
import RootCauseIsolationView from './components/RootCauseIsolationView';
import DailyDefenseReportView from './components/DailyDefenseReportView';
import SlottingSimulatorModal from './components/SlottingSimulatorModal';
import ExceptionAlertBanner from './components/ExceptionAlertBanner';
import { loadAndProcessData, processRawDatasets } from './services/dataProcessor';
import * as XLSX from 'xlsx';
import { Upload, RefreshCw, Sparkles } from 'lucide-react';
import './styles/dashboard.css';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('2026-06-29');
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    async function initData() {
      try {
        const result = await loadAndProcessData();
        setData(result);
        if (result.dates && result.dates.includes('2026-06-29')) {
          setSelectedDate('2026-06-29');
        } else if (result.dates && result.dates.length > 0) {
          setSelectedDate(result.dates[0]);
        }
      } catch (err) {
        console.error("Default fetch failed, listening for manual file uploads:", err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  // Handle Drag and Drop Excel Uploads
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
      let rackRows = [];
      let planRows = [];
      let missionRows = [];
      let inventoryRows = [];
      let pickingRows = [];

      for (const file of files) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        
        if (file.name.includes('Rack')) {
          rackRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        } else {
          if (wb.Sheets['배치계획']) planRows = XLSX.utils.sheet_to_json(wb.Sheets['배치계획']);
          if (wb.Sheets['미션로그']) missionRows = XLSX.utils.sheet_to_json(wb.Sheets['미션로그']);
          if (wb.Sheets['재고현황']) inventoryRows = XLSX.utils.sheet_to_json(wb.Sheets['재고현황']);
          if (wb.Sheets['피킹오더']) pickingRows = XLSX.utils.sheet_to_json(wb.Sheets['피킹오더']);
        }
      }

      const result = processRawDatasets({ rackRows, planRows, missionRows, inventoryRows, pickingRows });
      setData(result);
      if (result.dates && result.dates.length > 0) {
        setSelectedDate(result.dates[0]);
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
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Rack 마스터 8,260개 및 미션/재고 현황 조인 엔진 구동 중</span>
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
      />

      {/* 2. RWCS Exception Alert Banner */}
      <ExceptionAlertBanner invalidMissions={data.invalidMissions} />

      {/* 3. Top Trend View */}
      <PickingTrendView
        dates={data.dates}
        dailyAnalytics={data.dailyAnalytics}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
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

      {/* 6. Slotting Engine Feedback Simulator Modal */}
      <SlottingSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        dateInfo={currentDateInfo}
      />
    </div>
  );
}
