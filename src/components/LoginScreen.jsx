import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

// 지정된 5개 비밀번호 목록 (내부 검증용)
export const ALLOWED_PASSWORDS = [
  'hanwha2026!',
  'vision1234#',
  'rwcs8888$',
  'ags7777%',
  'admin5555*'
];

export default function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState(() => localStorage.getItem('rwcs_saved_username') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleUsernameChange = (e) => {
    const val = e.target.value;
    if (/[a-zA-Z0-9]/.test(val)) {
      alert('한글 이름만 입력할 수 있습니다');
      const filtered = val.replace(/[a-zA-Z0-9]/g, '');
      setUsername(filtered);
      return;
    }
    setUsername(val);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = username.trim();
    if (!trimmedName) {
      setErrorMsg('접속자 이름을 입력해 주세요.');
      return;
    }
    // 한글 2~4자 검증
    const koreanNameRegex = /^[가-힣]{2,4}$/;
    if (!koreanNameRegex.test(trimmedName)) {
      setErrorMsg('접속자 이름은 2자에서 4자 사이의 한글로만 입력해 주세요.');
      return;
    }
    if (!password.trim()) {
      setErrorMsg('비밀번호를 입력해 주세요.');
      return;
    }

    if (ALLOWED_PASSWORDS.includes(password.trim())) {
      sessionStorage.setItem('rwcs_authenticated', 'true');
      localStorage.setItem('rwcs_saved_username', trimmedName);
      setErrorMsg('');
      onLoginSuccess(trimmedName);
    } else {
      setErrorMsg('비밀번호가 올바르지 않습니다. 정확한 비밀번호를 입력해 주세요.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.95) 0%, rgba(11, 15, 25, 0.98) 100%)'
    }}>
      <div className="glass-card" style={{
        maxWidth: '420px',
        width: '100%',
        padding: '36px 32px',
        borderRadius: '20px',
        border: '1px solid rgba(0, 242, 254, 0.25)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 242, 254, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px'
      }}>
        {/* Header Section */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: '#ffffff',
            padding: '8px 16px',
            borderRadius: '10px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img 
              src="/images/Hanwha_logo.jpg" 
              alt="한화비전 로고" 
              style={{ height: '38px', objectFit: 'contain' }} 
            />
          </div>
          <div>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              color: '#f1f5f9',
              marginTop: '4px',
              fontFamily: 'Outfit, sans-serif'
            }}>
              RWCS-AGS 보안 로그인
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              한화비전 물류 운영 분석 및 시뮬레이션 시스템
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Name Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={15} color="var(--accent-cyan)" />
              접속자 이름 입력
            </label>
            <input
              type="text"
              value={username}
              onChange={handleUsernameChange}
              placeholder="이름을 입력하세요 (예: 홍길동)"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: errorMsg && !username.trim() ? '1px solid #ff4b72' : '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'all 0.2s',
                imeMode: 'active'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={15} color="var(--accent-cyan)" />
              접근 비밀번호 입력
            </label>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="발급받으신 비밀번호를 입력하세요"
                style={{
                  width: '100%',
                  padding: '12px 42px 12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: errorMsg && !password.trim() && username.trim() ? '1px solid #ff4b72' : (errorMsg && ALLOWED_PASSWORDS.includes(password.trim()) === false ? '1px solid #ff4b72' : '1px solid rgba(255, 255, 255, 0.15)'),
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'all 0.2s',
                  imeMode: 'disabled'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {errorMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff4b72', fontSize: '0.8rem', marginTop: '4px' }}>
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              justifyContent: 'center',
              fontSize: '1rem',
              marginTop: '4px',
              borderRadius: '10px'
            }}
          >
            <ShieldCheck size={18} />
            시스템 접속하기
          </button>
        </form>

        {/* Novatek Logo at the bottom of login card */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '24px' }}>
          <img 
            src="/images/Novatek_logo.png" 
            alt="Novatek 로고" 
            style={{ 
              height: '32px', 
              objectFit: 'contain'
            }} 
          />
        </div>
      </div>
    </div>
  );
}
