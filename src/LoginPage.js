import React from 'react';
import { signInWithGoogle } from './firebase';

const C = {
  dark:   '#1a1a2e',
  green:  '#22c55e',
  greenL: '#86D293',
  orange: '#fb923c',
  white:  '#ffffff',
  text:   '#1a1a2e',
  sub:    '#94a3b8',
  border: '#e2e8f0',
};

function LoginPage() {
  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') {
        alert('로그인이 취소되었습니다.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // 무시
      } else {
        alert('로그인 실패: ' + error.message);
      }
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: C.dark,
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* 배경 장식 원 */}
      <div style={{
        position: 'absolute', top: '-120px', right: '-120px',
        width: '400px', height: '400px', borderRadius: '50%',
        background: `${C.green}12`, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-100px', left: '-100px',
        width: '300px', height: '300px', borderRadius: '50%',
        background: `${C.orange}10`, pointerEvents: 'none',
      }} />

      {/* 메인 카드 */}
      <div style={{
        background: '#ffffff',
        padding: '48px 44px',
        borderRadius: '24px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
        textAlign: 'center',
        maxWidth: '420px',
        width: '100%',
        position: 'relative',
        zIndex: 1,
        border: `1px solid ${C.green}22`,
      }}>

        {/* 아이콘 */}
        <div style={{
          width: '72px', height: '72px', borderRadius: '20px',
          background: '#f0fdf4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          border: `2px solid ${C.green}33`,
        }}>
          <span style={{ fontSize: '36px' }}>💰</span>
        </div>

        {/* 타이틀 */}
        <h1 style={{ margin: '0 0 8px 0', fontSize: '26px', fontWeight: 'bold', color: C.text }}>
          배당 포트폴리오
        </h1>
        <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: C.sub }}>
          US Stocks & Bonds Manager
        </p>

        {/* 구분선 */}
        <div style={{ height: '1px', background: C.border, margin: '24px 0' }} />

        {/* 기능 요약 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '28px', flexWrap: 'wrap' }}>
          {[
            { icon: '📅', label: '배당 캘린더' },
            { icon: '🎯', label: '목표 달성률' },
            { icon: '📊', label: '차트 분석' },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '22px', marginBottom: '4px' }}>{item.icon}</div>
              <p style={{ margin: 0, fontSize: '11px', color: C.sub, fontWeight: '600' }}>{item.label}</p>
            </div>
          ))}
        </div>

        {/* 구글 로그인 버튼 */}
        <button
          onClick={handleGoogleLogin}
          style={{
            width: '100%', padding: '14px 20px',
            fontSize: '15px', fontWeight: '600',
            background: C.dark, color: C.white,
            border: 'none', borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            transition: 'all 0.2s',
            boxShadow: `0 4px 14px ${C.dark}40`,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = `0 8px 20px ${C.dark}60`;
            e.currentTarget.style.background = '#0f0f1a';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 4px 14px ${C.dark}40`;
            e.currentTarget.style.background = C.dark;
          }}
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google" width="18" height="18"
          />
          Google 계정으로 시작하기
        </button>

        {/* 또는 구분 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
          <div style={{ flex: 1, height: '1px', background: C.border }} />
          <span style={{ fontSize: '12px', color: C.sub }}>안전한 로그인</span>
          <div style={{ flex: 1, height: '1px', background: C.border }} />
        </div>

        {/* 보안 배지 */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap',
        }}>
          {['🔒 암호화', '☁️ 클라우드 저장', '🔄 기기 동기화'].map((item, i) => (
            <span key={i} style={{
              fontSize: '12px', color: C.sub, fontWeight: '500',
              background: '#f8fafc', padding: '5px 10px', borderRadius: '20px',
              border: `1px solid ${C.border}`,
            }}>
              {item}
            </span>
          ))}
        </div>

        {/* 안내 문구 */}
        <p style={{ margin: '20px 0 0 0', fontSize: '12px', color: C.sub, lineHeight: '1.6' }}>
          로그인하면 모든 기기에서<br />데이터를 안전하게 동기화할 수 있어요
        </p>
      </div>

      {/* 하단 태그 */}
      <div style={{
        marginTop: '28px', display: 'flex', gap: '16px',
        flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1,
      }}>
        {['✨ 완전 무료', '🚫 광고 없음', '🛡️ 데이터 보호'].map((item, i) => (
          <span key={i} style={{
            fontSize: '13px', color: 'rgba(255,255,255,0.7)',
            background: 'rgba(255,255,255,0.08)',
            padding: '6px 14px', borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.12)',
          }}>
            {item}
          </span>
        ))}
      </div>

      {/* 그린 포인트 라인 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '3px',
        background: `linear-gradient(90deg, ${C.green}, ${C.orange}, ${C.green})`,
      }} />
    </div>
  );
}

export default LoginPage;