import React, { useState, useEffect } from 'react';
import { X, Clock, Users, LogIn, LogOut, RefreshCw, Key } from 'lucide-react';
import { getAccessLogs, getUserStats, formatDuration } from '../services/accessLogger';

const getPwBadge = (no) => {
  const num = no || 1;
  const pwColors = {
    1: { label: '비번 1번', bg: 'rgba(0, 242, 254, 0.15)', border: 'rgba(0, 242, 254, 0.35)', color: '#00f2fe' },
    2: { label: '비번 2번', bg: 'rgba(167, 139, 250, 0.15)', border: 'rgba(167, 139, 250, 0.35)', color: '#a78bfa' },
    3: { label: '비번 3번', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)', color: '#f59e0b' },
    4: { label: '비번 4번', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.35)', color: '#ec4899' },
    5: { label: '비번 5번', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)', color: '#10b981' }
  };
  return pwColors[num] || pwColors[1];
};

export default function AccessLogModal({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [userStats, setUserStats] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [logsData, statsData] = await Promise.all([getAccessLogs(), getUserStats()]);
    setLogs(logsData);
    setUserStats(statsData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const formatDateTime = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return mm + '/' + dd + ' ' + hh + ':' + min + ':' + ss;
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    const days = ['일','월','화','수','목','금','토'];
    return (d.getMonth()+1) + '/' + d.getDate() + ' (' + days[d.getDay()] + ')';
  };

  const getStatusBadge = (row) => {
    if (!row.logout_time) return { label: '이용중', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)' };
    if (row.clean_logout_type === 'auto') return { label: '자동로그아웃', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
    return { label: '완료', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)' };
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: '#111827',
        border: '1px solid rgba(0,242,254,0.25)',
        borderRadius: '16px',
        padding: '28px',
        width: '940px',
        maxWidth: '95vw',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
        overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={22} color="var(--accent-cyan)" />
            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f1f5f9', fontFamily: 'Outfit' }}>시스템 접속 로그</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={fetchData} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 10px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
              <RefreshCw size={14} /> 새로고침
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
              <X size={22} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>로딩 중...</div>
        ) : (
          <>
            {/* 사용자별 누적 통계 */}
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                사용자별 누적 이용 현황
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {userStats.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '10px' }}>기록 없음</div>
                )}
                {userStats.map(stat => {
                  const pwBadge = getPwBadge(stat.latestPwNo);
                  return (
                    <div key={stat.username} style={{
                      background: 'linear-gradient(135deg, rgba(0,242,254,0.08), rgba(79,172,254,0.06))',
                      border: '1px solid rgba(0,242,254,0.2)',
                      borderRadius: '10px',
                      padding: '12px 18px',
                      minWidth: '175px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'Outfit' }}>{stat.username}</span>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '5px',
                          background: pwBadge.bg,
                          border: `1px solid ${pwBadge.border}`,
                          color: pwBadge.color,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <Key size={10} />
                          {pwBadge.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                        총 <strong style={{ color: '#f1f5f9' }}>{stat.count}회</strong> 접속
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#a78bfa', marginTop: '3px', fontWeight: 600 }}>
                        <Clock size={11} style={{ display: 'inline', marginRight: '3px' }} />
                        {formatDuration(stat.totalSeconds)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 구분선 */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

            {/* 전체 접속 기록 테이블 */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                전체 접속 기록 (최신순)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {['날짜', '사용 비번', '접속자', '로그인 시각', '로그아웃 시각', '이용시간', '상태'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>접속 기록이 없습니다.</td></tr>
                  )}
                  {logs.map((row, idx) => {
                    const badge = getStatusBadge(row);
                    const pwBadge = getPwBadge(row.password_no);
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{formatDate(row.login_time)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: pwBadge.color,
                            background: pwBadge.bg,
                            border: `1px solid ${pwBadge.border}`
                          }}>
                            <Key size={10} />
                            {pwBadge.label}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--accent-cyan)', fontWeight: 600 }}>{row.username}</td>
                        <td style={{ padding: '8px 12px', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <LogIn size={12} color="#10b981" />{formatDateTime(row.login_time)}
                        </td>
                        <td style={{ padding: '8px 12px', color: row.logout_time ? '#f1f5f9' : 'var(--text-muted)' }}>
                          {row.logout_time ? <><LogOut size={12} color="#ff4b72" style={{ display: 'inline', marginRight: '5px' }} />{formatDateTime(row.logout_time)}</> : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#a78bfa', fontWeight: 600 }}>
                          {row.duration_seconds ? formatDuration(row.duration_seconds) : '—'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, color: badge.color, background: badge.bg, border: '1px solid ' + badge.border }}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
