import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { 
  Database, Play, Calendar, Download, RefreshCw, Search, Terminal, Settings, 
  ShoppingCart, CalendarCheck, Clock, AlarmClock, Save, FileJson, FileSpreadsheet,
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function WmsDoReceiverView() {
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [cachedData, setCachedData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Stats & Config
  const [totalOrders, setTotalOrders] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);
  const [lastTime, setLastTime] = useState('-');
  const [cronSchedule, setCronSchedule] = useState('설정되지 않음');
  const [scheduleTime, setScheduleTime] = useState('14:00');
  
  // Configuration
  const [serviceRoleKey, setServiceRoleKey] = useState(() => {
    return localStorage.getItem('supabase_wms_service_role_key') || '';
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Terminal Console Overlay
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [consoleActionActive, setConsoleActionActive] = useState(false);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      fetchTableData();
      fetchCronSchedule();
    }
  }, []);

  useEffect(() => {
    applyFilters();
  }, [cachedData, selectedDate, searchQuery]);

  // Data Fetching
  const fetchTableData = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setTableLoading(true);
    try {
      const { data, error } = await supabase
        .from('pending_orders')
        .select('*')
        .order('collected_at', { ascending: false });

      if (error) throw error;
      
      const rows = data || [];
      setCachedData(rows);
      updateStats(rows);
    } catch (e) {
      console.error("WMS DO Data fetch failed:", e);
    } finally {
      setTableLoading(false);
    }
  };

  const fetchCronSchedule = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const { data, error } = await supabase.rpc('get_wms_cron_schedule');
      if (error) throw error;
      
      if (data) {
        setCronSchedule(formatCronToKst(data));
      } else {
        setCronSchedule('설정되지 않음');
      }
    } catch (e) {
      console.warn("Could not retrieve pg_cron schedule via RPC:", e);
      setCronSchedule('설정되지 않음');
    }
  };

  const updateStats = (data) => {
    setTotalOrders(data.length);

    const todayKst = new Date().toLocaleDateString('ko-KR');
    const todayCount = data.filter(d => {
      const dateKst = new Date(d.collected_at).toLocaleDateString('ko-KR');
      return dateKst === todayKst;
    }).length;
    setTodayOrders(todayCount);

    if (data.length > 0) {
      const latest = new Date(data[0].collected_at);
      setLastTime(latest.toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }));
    } else {
      setLastTime('기록 없음');
    }
  };

  // Helper date parsing/mapping
  const getUniqueDates = () => {
    const dates = new Set();
    cachedData.forEach(d => {
      const formatted = new Date(d.collected_at).toLocaleDateString('ko-KR');
      dates.add(formatted);
    });
    return Array.from(dates).sort((a, b) => new Date(b) - new Date(a));
  };

  const applyFilters = () => {
    let result = [...cachedData];
    
    if (selectedDate) {
      result = result.filter(row => {
        const rowDateStr = new Date(row.collected_at).toLocaleDateString('ko-KR');
        return rowDateStr === selectedDate;
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(row => {
        const orderMatch = row.order_id && row.order_id.toLowerCase().includes(q);
        const itemMatch = row.item_id && row.item_id.toLowerCase().includes(q);
        const whMatch = row.warehouse_id && row.warehouse_id.toLowerCase().includes(q);
        return orderMatch || itemMatch || whMatch;
      });
    }

    setFilteredData(result);
    setCurrentPage(1);
  };

  // Export functions
  const exportJSON = () => {
    if (filteredData.length === 0) {
      alert("내보낼 데이터가 없습니다.");
      return;
    }
    const dataStr = JSON.stringify(filteredData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const fileName = `wms_pending_orders_${new Date().toISOString().slice(0, 10)}.json`;

    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', fileName);
    link.click();
  };

  const exportExcel = () => {
    if (filteredData.length === 0) {
      alert("내보낼 데이터가 없습니다.");
      return;
    }
    const formatted = filteredData.map(row => ({
      "수집일시": new Date(row.collected_at).toLocaleString(),
      "창고 ID": row.warehouse_id,
      "화주 ID": row.owner_id,
      "주문 번호": row.order_id,
      "출고 차수": row.release_num || "",
      "품목 ID": row.item_id,
      "피킹 수량": row.pieces_to_pick
    }));

    const worksheet = XLSX.utils.json_to_sheet(formatted);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pending Orders");
    const fileName = `wms_pending_orders_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Run Collector Edge Function
  const handleTriggerCollection = async () => {
    if (!isSupabaseConfigured) {
      alert("Supabase 연결 설정이 완료되지 않았습니다.");
      return;
    }
    if (!serviceRoleKey) {
      alert("Edge Function 호출을 위해 우측 상단의 API 설정을 통해 Service Role Key를 입력해 주세요.");
      setIsConfigOpen(true);
      return;
    }

    setConsoleOpen(true);
    setConsoleActionActive(true);
    setConsoleLogs([]);

    const log = (text, type = '') => {
      setConsoleLogs(prev => [...prev, { text, type, time: new Date().toLocaleTimeString() }]);
    };

    log(">> Supabase Edge Function 접속 중...", 'info');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    log(`>> Endpoint: ${supabaseUrl}/functions/v1/fetch-wms-orders`);
    log(">> Authorization: Bearer Service_Role_Key");

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/fetch-wms-orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      const bodyData = await res.json();

      if (bodyData.logs && Array.isArray(bodyData.logs)) {
        bodyData.logs.forEach(logLine => {
          if (logLine.includes("Error") || logLine.includes("failed")) {
            log(logLine, 'error');
          } else if (logLine.includes("warn") || logLine.includes("Retry")) {
            log(logLine, 'warning');
          } else {
            log(logLine);
          }
        });
      }

      if (res.ok && bodyData.success) {
        log(`\n>> 성공: ${bodyData.count}건의 오더 동기화 완료 및 DB 저장 완료.`, 'success');
        fetchTableData();
      } else {
        log(`\n>> 실패: ${bodyData.error || '알 수 없는 오류'}`, 'error');
      }
    } catch (err) {
      log(`\n>> 에러: Edge Function 호출 중 네트워크 오류 발생.`, 'error');
      log(err.message, 'error');
    } finally {
      setConsoleActionActive(false);
    }
  };

  // pg_cron Schedule updates
  const handleUpdateCronSchedule = async () => {
    if (!isSupabaseConfigured || !supabase) {
      alert("먼저 Supabase 프로젝트가 연결되어야 합니다.");
      return;
    }
    if (!serviceRoleKey) {
      alert("스케줄을 변경하기 위해서는 우측 상단의 API 설정을 통해 Service Role Key를 필수로 입력해야 합니다.");
      setIsConfigOpen(true);
      return;
    }

    setLoading(true);
    const cronExpr = convertKstToCron(scheduleTime);
    let projectRef = '';
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const parsed = new URL(supabaseUrl);
      projectRef = parsed.hostname.split('.')[0];
    } catch (e) {
      alert("올바르지 않은 Supabase URL 형식입니다.");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('update_wms_cron_schedule', {
        cron_expr: cronExpr,
        project_ref: projectRef,
        service_role_key: serviceRoleKey
      });

      if (error) throw error;
      alert(`스케줄 변경 완료!\nKST 실행시간: ${scheduleTime}\nCron 표현식: ${cronExpr}\n\n결과: ${data}`);
      fetchCronSchedule();
    } catch (e) {
      console.error("Scheduler update failed", e);
      alert(`스케줄 업데이트 실패: ${e.message}\n\n데이터베이스에 'update_wms_cron_schedule' 함수가 올바르게 정의되어 있는지 확인하세요.`);
    } finally {
      setLoading(false);
    }
  };

  // Local storage management
  const handleSaveConfig = () => {
    localStorage.setItem('supabase_wms_service_role_key', serviceRoleKey.trim());
    setIsConfigOpen(false);
    alert("Service Role Key가 브라우저에 안전하게 저장되었습니다.");
  };

  // Convert Time helper functions
  const convertKstToCron = (timeString) => {
    const [hourStr, minStr] = timeString.split(':');
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minStr, 10);
    
    let utcHour = hour - 9;
    if (utcHour < 0) utcHour += 24;
    return `${minute} ${utcHour} * * *`;
  };

  const formatCronToKst = (cronStr) => {
    const parts = cronStr.split(' ');
    if (parts.length >= 2) {
      const minute = parseInt(parts[0], 10);
      const utcHour = parseInt(parts[1], 10);
      
      let kstHour = utcHour + 9;
      if (kstHour >= 24) kstHour -= 24;
      
      const kstHourStr = String(kstHour).padStart(2, '0');
      const kstMinStr = String(minute).padStart(2, '0');
      return `${kstHourStr}:${kstMinStr} (매일)`;
    }
    return cronStr;
  };

  // Pagination indexing
  const startIndex = (currentPage - 1) * itemsPerPage;
  const pageData = filteredData.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
      
      {/* Configuration Slider Panel */}
      {isConfigOpen && (
        <div style={{
          position: 'fixed', right: 0, top: 0, width: '420px', height: '100%',
          backgroundColor: '#0d1322', borderLeft: '1px solid var(--border-color)',
          zIndex: 1050, padding: '24px', display: 'flex', flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', transition: 'all 0.3s'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={20} color="var(--accent-cyan)" /> WMS API 보안 설정
            </h3>
            <button onClick={() => setIsConfigOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              자동 수집 스케줄 설정(pg_cron RPC) 및 실시간 즉시 수집(Edge Function 호출)을 작동하려면 **Service Role Key**가 필요합니다. 이 비밀 키는 외부로 유출되지 않으며, 오직 브라우저의 로컬 보안 저장소(`localStorage`)에만 저장됩니다.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Supabase Service Role Key (비밀키)</label>
              <input 
                type="password" 
                value={serviceRoleKey} 
                onChange={(e) => setServiceRoleKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1Ni..." 
                style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '0.85rem', outline: 'none'
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button onClick={() => setIsConfigOpen(false)} className="btn-secondary" style={{ flex: 1, padding: '10px', justifyContent: 'center' }}>취소</button>
            <button onClick={handleSaveConfig} className="btn-primary" style={{ flex: 1, padding: '10px', justifyContent: 'center' }}>저장</button>
          </div>
        </div>
      )}

      {/* Terminal Console Overlay */}
      {consoleOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          zIndex: 1060, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            width: '640px', maxWidth: '90%', backgroundColor: '#090d16',
            border: '1px solid var(--border-highlight)', borderRadius: '12px',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.03)', padding: '12px 18px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={16} color="var(--accent-cyan)" /> WMS Order Sync Console
              </h3>
              <button 
                onClick={() => setConsoleOpen(false)} 
                disabled={consoleActionActive}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: consoleActionActive ? 'not-allowed' : 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{
              padding: '16px', height: '320px', overflowY: 'auto', display: 'flex',
              flexDirection: 'column', gap: '6px', fontFamily: 'monospace', fontSize: '0.8rem',
              color: '#38bdf8', backgroundColor: '#05070b'
            }}>
              {consoleLogs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>연결을 대기하고 있습니다...</div>
              ) : (
                consoleLogs.map((l, i) => (
                  <div key={i} style={{ 
                    color: l.type === 'success' ? 'var(--accent-green)' : l.type === 'error' ? 'var(--accent-rose)' : l.type === 'warning' ? 'var(--accent-amber)' : '#38bdf8' 
                  }}>
                    [{l.time}] {l.text}
                  </div>
                ))
              )}
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <button 
                onClick={() => setConsoleOpen(false)} 
                disabled={consoleActionActive}
                className="btn-secondary"
                style={{ padding: '6px 16px', fontSize: '0.8rem' }}
              >
                콘솔 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Stats Row */}
      <div className="kpi-grid">
        
        <div className="kpi-card glass-card" style={{ '--card-accent': 'var(--accent-cyan)' }}>
          <div className="kpi-icon-wrapper">
            <ShoppingCart size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">누적 수집된 주문 수</span>
            <span className="kpi-value">{totalOrders.toLocaleString()} 건</span>
            <span className="kpi-sub">Supabase Database 누적</span>
          </div>
        </div>

        <div className="kpi-card glass-card" style={{ '--card-accent': 'var(--accent-green)' }}>
          <div className="kpi-icon-wrapper" style={{ color: 'var(--accent-green)' }}>
            <CalendarCheck size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">오늘 수집된 주문 수</span>
            <span className="kpi-value" style={{ color: 'var(--accent-green)' }}>{todayOrders.toLocaleString()} 건</span>
            <span className="kpi-sub">오늘 자정(KST) 이후 수집 기준</span>
          </div>
        </div>

        <div className="kpi-card glass-card" style={{ '--card-accent': 'var(--accent-blue)' }}>
          <div className="kpi-icon-wrapper" style={{ color: 'var(--accent-blue)' }}>
            <Clock size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">마지막 수집 일시</span>
            <span className="kpi-value" style={{ fontSize: '1.05rem', marginTop: '6px', fontWeight: 600 }}>{lastTime}</span>
            <span className="kpi-sub">최근 배치 동기화 타임스탬프</span>
          </div>
        </div>

        <div className="kpi-card glass-card" style={{ '--card-accent': 'var(--accent-amber)' }}>
          <div className="kpi-icon-wrapper" style={{ color: 'var(--accent-amber)' }}>
            <AlarmClock size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">자동 수집 스케줄 (KST)</span>
            <span className="kpi-value" style={{ color: 'var(--accent-amber)' }}>{cronSchedule}</span>
            <span className="kpi-sub">pg_cron 스케줄러 동기화 주기</span>
          </div>
        </div>

      </div>

      {/* 2. Controls & List Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px' }}>
        
        {/* Left Side: Table & Filters */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={20} color="var(--accent-cyan)" /> WMS 주문 수집 기록
            </h2>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px' }} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="주문 번호, 품목 ID..."
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)',
                    borderRadius: '8px', padding: '6px 12px 6px 30px', color: '#fff', fontSize: '0.85rem', outline: 'none'
                  }}
                />
              </div>

              <select 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', padding: '6px 12px', color: '#fff', fontSize: '0.85rem', outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="" style={{ background: '#111827' }}>수집일 전체</option>
                {getUniqueDates().map(d => (
                  <option key={d} value={d} style={{ background: '#111827' }}>{d}</option>
                ))}
              </select>

              <button 
                onClick={fetchTableData} 
                disabled={tableLoading}
                className="btn-secondary" 
                style={{ padding: '8px', borderRadius: '8px' }}
                title="새로고침"
              >
                <RefreshCw size={14} className={tableLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={exportJSON} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px', gap: '6px' }}>
                <FileJson size={14} color="var(--accent-blue)" /> JSON 내보내기
              </button>
              <button onClick={exportExcel} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px', gap: '6px' }}>
                <FileSpreadsheet size={14} color="var(--accent-green)" /> XLSX 내보내기
              </button>
              <button onClick={() => setIsConfigOpen(true)} className="btn-secondary" style={{ padding: '8px', borderRadius: '8px' }} title="보안 API 설정">
                <Settings size={14} />
              </button>
            </div>
          </div>

          {/* Records Table */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px', color: '#fff' }}>수집일시</th>
                  <th style={{ padding: '12px 16px', color: '#fff' }}>창고 ID</th>
                  <th style={{ padding: '12px 16px', color: '#fff' }}>화주 ID</th>
                  <th style={{ padding: '12px 16px', color: '#fff' }}>주문 번호</th>
                  <th style={{ padding: '12px 16px', color: '#fff' }}>출고 차수</th>
                  <th style={{ padding: '12px 16px', color: '#fff' }}>품목 ID</th>
                  <th style={{ padding: '12px 16px', color: '#fff', textAlign: 'right' }}>피킹 수량</th>
                </tr>
              </thead>
              <tbody>
                {tableLoading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '48px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '24px', height: '24px', border: '3px solid rgba(255,255,255,0.05)', borderRadius: '50%', borderTopColor: 'var(--accent-cyan)', animation: 'spin 1s linear infinite' }}></div>
                        <span style={{ color: 'var(--text-secondary)' }}>데이터 조회 중...</span>
                      </div>
                    </td>
                  </tr>
                ) : pageData.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      수집된 데이터 기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  pageData.map((row, i) => (
                    <tr key={row.id || i} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="table-row-hover">
                      <td style={{ padding: '10px 16px' }}>{new Date(row.collected_at).toLocaleString()}</td>
                      <td style={{ padding: '10px 16px' }}><span style={{ color: 'var(--accent-cyan)', background: 'rgba(0, 242, 254, 0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>{row.warehouse_id}</span></td>
                      <td style={{ padding: '10px 16px' }}><span style={{ color: 'var(--accent-blue)', background: 'rgba(79, 172, 254, 0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>{row.owner_id}</span></td>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: '#fff' }}>{row.order_id}</td>
                      <td style={{ padding: '10px 16px' }}>{row.release_num || '-'}</td>
                      <td style={{ padding: '10px 16px' }}><code style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{row.item_id}</code></td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#fff' }}>{row.pieces_to_pick.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                전체 {filteredData.length}건 중 {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredData.length)} 표시
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                  disabled={currentPage === 1}
                  className="btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <ChevronLeft size={14} /> 이전
                </button>
                <span style={{ alignSelf: 'center', fontSize: '0.85rem', color: '#fff', fontWeight: 600, padding: '0 8px' }}>
                  {currentPage} / {totalPages}
                </span>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                  disabled={currentPage === totalPages}
                  className="btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  다음 <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Side: Execution Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Panel 1: Trigger manually */}
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
              <Play size={18} color="var(--accent-green)" /> 수집 수동 실행
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              WMS API 서버로부터 현재 시점의 대기 중인 오더 데이터를 수집하여 Supabase DB에 적재합니다.
            </p>
            <button 
              onClick={handleTriggerCollection}
              className="btn-primary" 
              style={{ width: '100%', padding: '10px', justifyContent: 'center', marginTop: '8px' }}
            >
              <Play size={14} /> 즉시 수집 실행
            </button>
          </div>

          {/* Panel 2: Cron Schedule Settings */}
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
              <Calendar size={18} color="var(--accent-blue)" /> 스케줄러 설정
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              매일 설정된 시각(한국 시간 기준)에 백그라운드 데이터 수집기가 동작하는 <strong>pg_cron</strong> 배치를 스케줄링합니다.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>배치 자동 실행 시각 (KST)</label>
              <input 
                type="time" 
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', padding: '8px', color: '#fff', fontSize: '0.95rem', outline: 'none', width: '100%'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3, marginTop: '2px' }}>
                * 한국 시간 {scheduleTime} = UTC {(() => {
                  const [h, m] = scheduleTime.split(':');
                  let utch = parseInt(h, 10) - 9;
                  if (utch < 0) utch += 24;
                  return `${String(utch).padStart(2, '0')}:${m}`;
                })()} (매일 자동으로 수집 실행)
              </span>
            </div>
            <button 
              onClick={handleUpdateCronSchedule}
              disabled={loading}
              className="btn-secondary" 
              style={{ width: '100%', padding: '10px', justifyContent: 'center', marginTop: '12px', background: 'rgba(79, 172, 254, 0.1)', borderColor: 'rgba(79, 172, 254, 0.2)' }}
            >
              <Save size={14} color="var(--accent-blue)" /> 스케줄 설정 적용
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
