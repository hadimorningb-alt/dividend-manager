import React from 'react';
import { signInWithGoogle } from './firebase';

function LoginPage() {
  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
      // 로그인 성공하면 자동으로 App.js에서 감지됨
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') {
        alert('로그인이 취소되었습니다.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // 팝업이 이미 열려있을 때 무시
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
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      {/* 로고 영역 */}
      <div style={{
        background: 'white',
        padding: '60px 80px',
        borderRadius: '20px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        <h1 style={{ 
          margin: '0 0 10px 0', 
          fontSize: '36px',
          color: '#2c3e50'
        }}>
          💰 배당 포트폴리오
        </h1>
        <p style={{ 
          margin: '0 0 40px 0', 
          fontSize: '14px',
          color: '#7f8c8d'
        }}>
          US Stocks & Bonds Manager
        </p>

        {/* 구글 로그인 버튼 */}
        <button
          onClick={handleGoogleLogin}
          style={{
            width: '100%',
            padding: '15px 20px',
            fontSize: '16px',
            fontWeight: '600',
            background: 'white',
            color: '#444',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google" 
            width="18"
            height="18"
          />
          Google 계정으로 시작하기
        </button>

        {/* 안내 문구 */}
        <p style={{ 
          margin: '30px 0 0 0', 
          fontSize: '12px',
          color: '#95a5a6',
          lineHeight: '1.6'
        }}>
          로그인하면 모든 기기에서<br/>
          데이터를 안전하게 동기화할 수 있어요
        </p>
      </div>

      {/* 하단 안내 */}
      <p style={{ 
        margin: '30px 0 0 0', 
        fontSize: '13px',
        color: 'rgba(255,255,255,0.9)'
      }}>
        ✨ 완전 무료 • 광고 없음 • 데이터 보호
      </p>
    </div>
  );
}

export default LoginPage;