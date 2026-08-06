import { supabase, isSupabaseConfigured } from './supabaseClient';

export async function logLogin(username) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // 동일 사용자의 미종료(logout_time IS NULL) 세션이 있다면 자동 마감 처리
    const { data: openSessions } = await supabase
      .from('access_logs')
      .select('id, login_time')
      .eq('username', username)
      .is('logout_time', null);

    if (openSessions && openSessions.length > 0) {
      for (const sess of openSessions) {
        const loginTime = new Date(sess.login_time);
        const durationSeconds = Math.max(0, Math.round((now - loginTime) / 1000));
        await supabase
          .from('access_logs')
          .update({
            logout_time: nowIso,
            duration_seconds: durationSeconds,
            logout_type: 'auto_closed'
          })
          .eq('id', sess.id);
      }
    }

    // 신규 세션 생성
    const { data, error } = await supabase
      .from('access_logs')
      .insert([{ username, login_time: nowIso, logout_type: 'active' }])
      .select('id')
      .single();
    if (error) throw error;
    return data?.id ?? null;
  } catch (e) {
    console.warn('[accessLogger] logLogin failed:', e.message);
    return null;
  }
}

export async function logLogout(sessionId, logoutType = 'manual') {
  if (!isSupabaseConfigured || !supabase || !sessionId) return;
  try {
    const { data: row, error: fetchErr } = await supabase
      .from('access_logs')
      .select('login_time')
      .eq('id', sessionId)
      .single();
    if (fetchErr) throw fetchErr;
    const loginTime = new Date(row.login_time);
    const logoutTime = new Date();
    const durationSeconds = Math.round((logoutTime - loginTime) / 1000);
    const { error: updateErr } = await supabase
      .from('access_logs')
      .update({ logout_time: logoutTime.toISOString(), duration_seconds: durationSeconds, logout_type: logoutType })
      .eq('id', sessionId);
    if (updateErr) throw updateErr;
  } catch (e) {
    console.warn('[accessLogger] logLogout failed:', e.message);
  }
}

export async function getAccessLogs() {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from('access_logs')
      .select('*')
      .order('login_time', { ascending: false })
      .limit(300);
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('[accessLogger] getAccessLogs failed:', e.message);
    return [];
  }
}

export async function getUserStats() {
  const logs = await getAccessLogs();
  const statsMap = {};
  logs.forEach((row) => {
    if (!statsMap[row.username]) statsMap[row.username] = { username: row.username, count: 0, totalSeconds: 0 };
    statsMap[row.username].count += 1;
    if (row.duration_seconds) statsMap[row.username].totalSeconds += row.duration_seconds;
  });
  return Object.values(statsMap).sort((a, b) => b.totalSeconds - a.totalSeconds);
}

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0분';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return h + '시간 ' + m + '분';
  if (m > 0) return m + '분 ' + s + '초';
  return s + '초';
}
