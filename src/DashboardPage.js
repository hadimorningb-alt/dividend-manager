import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function DashboardPage({ stocks, user, exchangeRate }) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [snapshots, setSnapshots] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 480;

  // 🔥 총 자산 계산
  const totalAssets = stocks.reduce((sum, stock) => {
    return sum + (stock.currentPrice * stock.shares);
  }, 0);

  const totalInvestment = stocks.reduce((sum, stock) => {
    return sum + (stock.purchasePrice * stock.shares);
  }, 0);

  const totalProfitRate = totalInvestment > 0 
    ? ((totalAssets - totalInvestment) / totalInvestment * 100).toFixed(2)
    : 0;

  const totalAnnualDividend = stocks.reduce((sum, stock) => {
    const annualDiv = stock.assetType === '주식'
      ? stock.currentPrice * stock.shares * stock.dividendRate / 100
      : stock.faceValue * stock.shares * stock.dividendRate / 100;
    return sum + annualDiv;
  }, 0);

  const thisMonth = new Date().getMonth() + 1;
  const thisMonthDividends = stocks.filter(stock => {
    if (!stock.dividendMonths) return false;
    if (stock.dividendMonths.includes('매월')) return true;
    const months = stock.dividendMonths.split(',').map(m => parseInt(m.trim()));
    return months.includes(thisMonth);
  });

  const thisMonthAmount = thisMonthDividends.reduce((sum, stock) => {
    const annualDiv = stock.assetType === '주식'
      ? stock.currentPrice * stock.shares * stock.dividendRate / 100
      : stock.faceValue * stock.shares * stock.dividendRate / 100;
    
    let frequency = 12;
    if (stock.dividendMonths.includes('매월')) {
      frequency = 12;
    } else {
      const monthCount = stock.dividendMonths.split(',').length;
      frequency = monthCount;
    }
    
    return sum + (annualDiv / frequency);
  }, 0);

  const recentStocks = [...stocks]
    .sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB - dateA;
    })
    .slice(0, 3);

  const getTimeDiff = (date) => {
    const createdDate = date?.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now - createdDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주일 전`;
    return `${Math.floor(diffDays / 30)}개월 전`;
  };

  const monthlyGoal = parseFloat(localStorage.getItem('monthlyGoal') || '500000');
  const currentMonthlyKRW = Math.round((totalAnnualDividend / 12) * exchangeRate);
  const achievementRate = ((currentMonthlyKRW / monthlyGoal) * 100).toFixed(1);

  // 🔥 SNS 공유 함수들
  const shareToClipboard = () => {
    const text = `💰 내 배당 포트폴리오 현황

📊 총 자산: $${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}
📈 수익률: ${totalProfitRate >= 0 ? '+' : ''}${totalProfitRate}%
💵 연 배당: $${totalAnnualDividend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
🎯 보유 종목: ${stocks.length}개

주요 종목: ${stocks.slice(0, 5).map(s => s.ticker).join(', ')}

배당으로 경제적 자유 달성! 🚀
#배당투자 #미국주식 #파이어족 #경제적자유`;

    navigator.clipboard.writeText(text)
      .then(() => {
        alert('✅ 클립보드에 복사되었습니다!\n\n인스타, 카톡, 페북 어디든 붙여넣기 하세요! 📱');
      })
      .catch(() => {
        alert('❌ 복사 실패. 브라우저 권한을 확인해주세요.');
      });
  };

  const shareToTwitter = () => {
    const text = `💰 내 배당 포트폴리오

📊 자산: $${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}
📈 수익률: ${totalProfitRate >= 0 ? '+' : ''}${totalProfitRate}%
💵 연 배당: $${totalAnnualDividend.toLocaleString(undefined, { maximumFractionDigits: 0 })}

배당으로 경제적 자유! 🚀
#배당투자 #미국주식 #FIRE`;

    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=600,height=400');
  };

  const shareToFacebook = () => {
    const text = '배당 포트폴리오 관리 중! 💰📈';
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=600,height=400');
  };

  // 🔥 스냅샷 불러오기
  useEffect(() => {
    const loadSnapshots = async () => {
      if (!user) return;
      
      setLoadingSnapshots(true);
      try {
        const q = query(
          collection(db, `users/${user.uid}/snapshots`),
          orderBy('timestamp', 'asc')
        );
        const querySnapshot = await getDocs(q);
        
        const data = [];
        querySnapshot.forEach((doc) => {
          data.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        setSnapshots(data);
        console.log('✅ 스냅샷 로드:', data.length, '개');
      } catch (error) {
        console.error('❌ 스냅샷 로드 실패:', error);
      } finally {
        setLoadingSnapshots(false);
      }
    };
    
    loadSnapshots();
  }, [user]);

  // 🔥 차트 데이터 가공
  const chartData = snapshots.map(snapshot => ({
    month: snapshot.month,
    연배당USD: parseFloat(snapshot.totalAnnualDividend.toFixed(0)),
    월배당KRW: Math.round(snapshot.monthlyDividend * exchangeRate)
  }));

  // 🔥 성장률 계산
  const calculateGrowth = () => {
    if (snapshots.length < 2) return null;
    
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    
    const growth = ((last.totalAnnualDividend - first.totalAnnualDividend) / first.totalAnnualDividend * 100).toFixed(1);
    const monthsPassed = snapshots.length - 1;
    
    return {
      totalGrowth: growth,
      monthsPassed,
      firstAmount: first.totalAnnualDividend,
      lastAmount: last.totalAnnualDividend
    };
  };

  const growth = calculateGrowth();

  // 🔥 커스텀 Tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(255, 255, 255, 0.98)',
          padding: '12px 16px',
          border: 'none',
          borderRadius: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#2c3e50', fontSize: '13px' }}>
            {payload[0].payload.month}
          </p>
          <p style={{ margin: '0 0 4px 0', color: '#667eea', fontSize: '14px', fontWeight: '600' }}>
            연 배당: ${payload[0].value.toLocaleString()}
          </p>
          <p style={{ margin: 0, color: '#4caf50', fontSize: '14px', fontWeight: '600' }}>
            월 배당: ₩{payload[1].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 30px 0', color: '#333' }}> 대시보드</h1>

      {/* 환영 메시지 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: isMobile ? '20px' : '30px',
        borderRadius: '15px',
        marginBottom: '30px'
      }}>
        <h2 style={{ 
          margin: '0 0 10px 0', 
          fontSize: isMobile ? '20px' : '24px'
        }}>
           안녕하세요, {user?.displayName || '투자자'}님!
        </h2>
        <p style={{ 
          margin: 0, 
          opacity: 0.9, 
          fontSize: isMobile ? '13px' : '14px'
        }}>
          오늘도 배당 투자 화이팅! 🚀
        </p>
      </div>

      {/* 🔥 SNS 공유 섹션 */}
      <div style={{
        background: '#f8f9fa',
        padding: isMobile ? '12px 16px' : '14px 20px',
        borderRadius: '10px',
        marginBottom: '20px',
        border: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <span style={{ 
          fontSize: isMobile ? '12px' : '13px',
          color: '#666',
          fontWeight: '500',
          whiteSpace: 'nowrap'
        }}>
          <i className='fa-solid fa-mobile-screen'></i> 공유하기
        </span>
        
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={shareToClipboard}
            title="텍스트 복사"
            style={{
              width: isMobile ? '36px' : '40px',
              height: isMobile ? '36px' : '40px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#5568d3';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#667eea';
              e.target.style.transform = 'scale(1)';
            }}
          >
            <i className="fa-regular fa-copy"></i>
          </button>

          <button
            onClick={() => {
              shareToClipboard();
              alert('✅ 클립보드에 복사되었습니다!\n\n인스타그램 앱을 열고 게시물/스토리에 붙여넣기 하세요! 📸');
            }}
            title="Instagram용 복사"
            style={{
              width: isMobile ? '36px' : '40px',
              height: isMobile ? '36px' : '40px',
              background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.target.style.filter = 'brightness(1.1)';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.filter = 'brightness(1)';
              e.target.style.transform = 'scale(1)';
            }}
          >
            <i className="fa-brands fa-instagram"></i>
          </button>

          <button
            onClick={shareToTwitter}
            title="X (Twitter)에 공유"
            style={{
              width: isMobile ? '36px' : '40px',
              height: isMobile ? '36px' : '40px',
              background: '#000000',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#333333';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#000000';
              e.target.style.transform = 'scale(1)';
            }}
          >
            <i className="fa-brands fa-x-twitter"></i>
          </button>

          <button
            onClick={shareToFacebook}
            title="Facebook에 공유"
            style={{
              width: isMobile ? '36px' : '40px',
              height: isMobile ? '36px' : '40px',
              background: '#1877F2',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#0c63d4';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#1877F2';
              e.target.style.transform = 'scale(1)';
            }}
          >
            <i className="fa-brands fa-facebook-f"></i>
          </button>

          <button
            onClick={() => {
              shareToClipboard();
              alert('✅ 클립보드에 복사되었습니다!\n\n카카오톡 앱을 열고 붙여넣기 하세요! 💬');
            }}
            title="카카오톡으로 공유"
            style={{
              width: isMobile ? '36px' : '40px',
              height: isMobile ? '36px' : '40px',
              background: '#FEE500',
              color: '#3C1E1E',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f5dc00';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#FEE500';
              e.target.style.transform = 'scale(1)';
            }}
          >
            <i className="fa-solid fa-comment"></i>
          </button>
        </div>
      </div>

      {/* 포트폴리오 요약 */}
      <div style={{
        background: 'white',
        padding: isMobile ? '20px' : '30px',
        borderRadius: '15px',
        marginBottom: '30px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          color: '#667eea',
          fontSize: isMobile ? '18px' : '24px'
        }}>
          <i className='fa-regular fa-file-zipper'></i> 나의 포트폴리오 요약
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: isMobile ? '12px' : '20px'
        }}>
          <div style={{
            background: '#f8f9fa',
            padding: isMobile ? '15px' : '20px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <p style={{ 
              margin: '0 0 10px 0', 
              color: '#666', 
              fontSize: isMobile ? '12px' : '14px'
            }}>
              총 자산
            </p>
            <p style={{ 
              margin: 0, 
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 'bold', 
              color: '#2c3e50' 
            }}>
              ${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div style={{
            background: '#f8f9fa',
            padding: isMobile ? '15px' : '20px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <p style={{ 
              margin: '0 0 10px 0', 
              color: '#666', 
              fontSize: isMobile ? '12px' : '14px'
            }}>
              총 수익률
            </p>
            <p style={{ 
              margin: 0, 
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 'bold',
              color: totalProfitRate >= 0 ? '#4caf50' : '#ff4757'
            }}>
              {totalProfitRate >= 0 ? '+' : ''}{totalProfitRate}%
            </p>
          </div>

          <div style={{
            background: '#f8f9fa',
            padding: isMobile ? '15px' : '20px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <p style={{ 
              margin: '0 0 10px 0', 
              color: '#666', 
              fontSize: isMobile ? '12px' : '14px'
            }}>
              보유 종목
            </p>
            <p style={{ 
              margin: 0, 
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 'bold', 
              color: '#2c3e50' 
            }}>
              {stocks.length}개
            </p>
          </div>

          <div style={{
            background: '#f8f9fa',
            padding: isMobile ? '15px' : '20px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <p style={{ 
              margin: '0 0 10px 0', 
              color: '#666', 
              fontSize: isMobile ? '12px' : '14px'
            }}>
              연 배당액
            </p>
            <p style={{ 
              margin: 0, 
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 'bold', 
              color: '#4caf50' 
            }}>
              ${totalAnnualDividend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      {/* 이번 달 배당 */}
      <div style={{
        background: 'white',
        padding: isMobile ? '20px' : '30px',
        borderRadius: '15px',
        marginBottom: '30px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          color: '#667eea',
          fontSize: isMobile ? '18px' : '24px'
        }}>
          <i className='fa-solid fa-face-grin-beam'></i> 이번 달 배당 ({new Date().getMonth() + 1}월)
        </h2>
        
        {thisMonthDividends.length > 0 ? (
          <>
            <div style={{
              background: '#e8f5e9',
              padding: isMobile ? '15px' : '20px',
              borderRadius: '10px',
              marginBottom: '15px'
            }}>
              <p style={{ 
                margin: '0 0 10px 0', 
                fontSize: isMobile ? '13px' : '14px',
                color: '#666' 
              }}>
                배당 종목: {thisMonthDividends.length}개
              </p>
              <p style={{ 
                margin: '0 0 15px 0', 
                fontSize: isMobile ? '14px' : '16px',
                fontWeight: '600', 
                color: '#2c3e50',
                wordBreak: 'break-word'
              }}>
                {thisMonthDividends.map(s => s.ticker).join(', ')}
              </p>
              <p style={{ 
                margin: 0, 
                fontSize: isMobile ? '13px' : '14px',
                color: '#666' 
              }}>
                예상 배당: <strong style={{ 
                  fontSize: isMobile ? '18px' : '20px',
                  color: '#4caf50' 
                }}>
                  ${thisMonthAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </strong>
              </p>
            </div>
          </>
        ) : (
          <div style={{
            background: '#f8f9fa',
            padding: isMobile ? '30px' : '40px',
            borderRadius: '10px',
            textAlign: 'center',
            color: '#999'
          }}>
            <p style={{ 
              margin: 0, 
              fontSize: isMobile ? '14px' : '16px'
            }}>
              이번 달에는 배당이 없어요 😢
            </p>
          </div>
        )}
      </div>


{/* 🔥 금융소득세 안내 */}
<div style={{
  background: 'white',
  padding: isMobile ? '20px' : '30px',
  borderRadius: '15px',
  marginBottom: '30px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
}}>
  <h2 style={{ 
    margin: '0 0 20px 0', 
    color: '#667eea',
    fontSize: isMobile ? '18px' : '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  }}>
    <i className="fa-solid fa-circle-info"></i>
    금융소득세 안내
  </h2>
  
  {(() => {
    // 🔥 연간 배당 KRW 계산
    const annualDividendKRW = Math.round(totalAnnualDividend * exchangeRate);
    const threshold = 20000000; // 2천만원
    const isOverThreshold = annualDividendKRW >= threshold;
    const remaining = threshold - annualDividendKRW;
    const excess = annualDividendKRW - threshold;
    
    return (
      <div style={{
        background: isOverThreshold 
          ? 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)'
          : 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
        padding: isMobile ? '20px' : '24px',
        borderRadius: '12px',
        color: 'white'
      }}>
        {/* 현재 배당액 */}
        <div style={{ 
          marginBottom: '20px',
          paddingBottom: '20px',
          borderBottom: '1px solid rgba(255,255,255,0.3)'
        }}>
          <p style={{ 
            margin: '0 0 8px 0', 
            fontSize: isMobile ? '12px' : '13px',
            opacity: 0.9 
          }}>
            연간 예상 배당 (원화)
          </p>
          <p style={{ 
            margin: 0, 
            fontSize: isMobile ? '28px' : '36px',
            fontWeight: 'bold' 
          }}>
            ₩{annualDividendKRW.toLocaleString()}
          </p>
          <p style={{ 
            margin: '8px 0 0 0', 
            fontSize: isMobile ? '11px' : '12px',
            opacity: 0.8 
          }}>
            (${totalAnnualDividend.toLocaleString(undefined, { maximumFractionDigits: 0 })} × ₩{exchangeRate.toFixed(2)})
          </p>
        </div>

        {/* 기준선 대비 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '10px'
          }}>
            <span style={{ fontSize: isMobile ? '12px' : '13px', opacity: 0.9 }}>
              기준: ₩20,000,000
            </span>
            <span style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '600' }}>
              {((annualDividendKRW / threshold) * 100).toFixed(1)}%
            </span>
          </div>
          
          {/* 프로그레스 바 */}
          <div style={{
            height: '12px',
            background: 'rgba(255,255,255,0.3)',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min((annualDividendKRW / threshold) * 100, 100)}%`,
              background: 'white',
              transition: 'width 1s ease',
              boxShadow: isOverThreshold ? '0 0 10px rgba(255,255,255,0.5)' : 'none'
            }}></div>
          </div>
        </div>

        {/* 상태 메시지 */}
        {isOverThreshold ? (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: isMobile ? '18px' : '20px' }}></i>
              <p style={{ 
                margin: 0, 
                fontSize: isMobile ? '15px' : '17px',
                fontWeight: 'bold' 
              }}>
                금융소득종합과세 대상
              </p>
            </div>
            
            <p style={{ 
              margin: '0 0 12px 0', 
              fontSize: isMobile ? '13px' : '14px',
              lineHeight: '1.6',
              opacity: 0.95 
            }}>
              연간 배당소득이 2천만원을 <strong>₩{excess.toLocaleString()}</strong> 초과했어요.
              <br />
              종합소득세 신고 대상이며, 다른 소득과 합산하여 과세됩니다.
            </p>

            {/* 세부 정보 */}
            <div style={{
              background: 'rgba(0,0,0,0.1)',
              padding: isMobile ? '12px' : '14px',
              borderRadius: '8px',
              fontSize: isMobile ? '12px' : '13px',
              lineHeight: '1.6'
            }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>
                📌 금융소득종합과세란?
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>이자소득 + 배당소득 합계가 연 2천만원 초과 시 적용</li>
                <li>근로소득 등 다른 소득과 합산하여 6~45% 누진세율 적용</li>
                <li>다음 해 5월 종합소득세 신고 필수</li>
              </ul>
            </div>
          </div>
        ) : (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: isMobile ? '18px' : '20px' }}></i>
              <p style={{ 
                margin: 0, 
                fontSize: isMobile ? '15px' : '17px',
                fontWeight: 'bold' 
              }}>
                분리과세 대상 (안전)
              </p>
            </div>
            
            <p style={{ 
              margin: '0 0 12px 0', 
              fontSize: isMobile ? '13px' : '14px',
              lineHeight: '1.6',
              opacity: 0.95 
            }}>
              기준까지 <strong>₩{remaining.toLocaleString()}</strong> 여유가 있어요.
              <br />
              배당소득세 15.4% 원천징수로 종결됩니다.
            </p>

            {/* 세부 정보 */}
            <div style={{
              background: 'rgba(0,0,0,0.1)',
              padding: isMobile ? '12px' : '14px',
              borderRadius: '8px',
              fontSize: isMobile ? '12px' : '13px',
              lineHeight: '1.6'
            }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>
                💡 현재 과세 방식
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>미국 배당소득세 15% 원천징수 (미국)</li>
                <li>국내 배당소득세 15.4% (지방세 포함)</li>
                <li>별도 신고 불필요 (분리과세)</li>
              </ul>
            </div>
          </div>
        )}

        {/* 추가 안내 */}
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.3)',
          fontSize: isMobile ? '11px' : '12px',
          opacity: 0.8,
          lineHeight: '1.5'
        }}>
          <i className="fa-solid fa-lightbulb" style={{ marginRight: '6px' }}></i>
          세율 계산 시 환율 변동과 실제 지급 배당금이 다를 수 있으니 참고용으로만 활용하세요.
          정확한 세금은 세무사와 상담하시기 바랍니다.
        </div>
      </div>
    );
  })()}
</div>


      {/* 목표 달성률 */}
      <div style={{
        background: 'white',
        padding: isMobile ? '20px' : '30px',
        borderRadius: '15px',
        marginBottom: '30px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          color: '#667eea',
          fontSize: isMobile ? '18px' : '24px'
        }}>
          <i className='fa-solid fa-forward'></i> 목표 달성률
        </h2>
        
        <div style={{
          background: '#f8f9fa',
          padding: isMobile ? '15px' : '20px',
          borderRadius: '10px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            gap: isMobile ? '8px' : '0',
            marginBottom: '15px'
          }}>
            <span style={{ 
              fontSize: isMobile ? '13px' : '14px',
              color: '#666',
              textAlign: isMobile ? 'center' : 'left'
            }}>
              현재: {currentMonthlyKRW.toLocaleString()}원/월
            </span>
            <span style={{ 
              fontSize: isMobile ? '13px' : '14px',
              color: '#666',
              textAlign: isMobile ? 'center' : 'right'
            }}>
              목표: {monthlyGoal.toLocaleString()}원/월
            </span>
          </div>
          
          <div style={{
            height: isMobile ? '25px' : '30px',
            background: '#e0e0e0',
            borderRadius: '15px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(parseFloat(achievementRate), 100)}%`,
              background: parseFloat(achievementRate) >= 100
                ? 'linear-gradient(90deg, #2ecc71 0%, #27ae60 100%)'
                : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              transition: 'width 1s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: isMobile ? '12px' : '14px'
            }}>
              {parseFloat(achievementRate) > 10 && achievementRate + '%'}
            </div>
          </div>
          
          <p style={{ 
            margin: '15px 0 0 0', 
            textAlign: 'center', 
            fontSize: isMobile ? '13px' : '14px',
            color: parseFloat(achievementRate) >= 100 ? '#4caf50' : '#666',
            wordBreak: 'keep-all'
          }}>
            {parseFloat(achievementRate) >= 100 
              ? '🎉 목표 달성!' 
              : `목표까지 ${(monthlyGoal - currentMonthlyKRW).toLocaleString()}원 남음`}
          </p>
        </div>
      </div>

      {/* 최근 추가 종목 */}
      {recentStocks.length > 0 && (
        <div style={{
          background: 'white',
          padding: isMobile ? '20px' : '30px',
          borderRadius: '15px',
          marginBottom: '30px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ 
            margin: '0 0 20px 0', 
            color: '#667eea',
            fontSize: isMobile ? '18px' : '24px'
          }}>
            <i className='fa-solid fa-clone'></i> 최근 추가 종목
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentStocks.map(stock => (
              <div
                key={stock.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: isMobile ? '12px' : '15px',
                  background: '#f8f9fa',
                  borderRadius: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    background: stock.assetType === '주식' ? '#e3f2fd' : '#fff3e0',
                    color: stock.assetType === '주식' ? '#1976d2' : '#f57c00',
                    padding: '4px 8px',
                    borderRadius: '5px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    {stock.assetType === '주식' ? '📈' : '📜'}
                  </span>
                  <strong style={{ 
                    fontSize: isMobile ? '14px' : '16px',
                    color: '#2c3e50' 
                  }}>
                    {stock.ticker}
                  </strong>
                </div>
                <span style={{ 
                  fontSize: isMobile ? '12px' : '13px',
                  color: '#999' 
                }}>
                  {getTimeDiff(stock.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      

      {/* 🔥 배당 성장률 섹션 */}
      <div style={{
        background: 'white',
        padding: isMobile ? '20px' : '30px',
        borderRadius: '15px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          color: '#667eea',
          fontSize: isMobile ? '18px' : '24px'
        }}>
          <i className='fa-solid fa-arrow-trend-up'></i> 배당 성장률
        </h2>

        {loadingSnapshots ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#999'
          }}>
            <p>데이터 불러오는 중...</p>
          </div>
        ) : snapshots.length === 0 ? (
          <div style={{
            background: '#f8f9fa',
            padding: isMobile ? '30px 20px' : '50px 40px',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', margin: '0 0 16px 0', opacity: 0.3 }}>📊</div>
            <h3 style={{ 
              margin: '0 0 10px 0', 
              color: '#2c3e50', 
              fontSize: isMobile ? '16px' : '18px' 
            }}>
              아직 기록된 데이터가 없어요
            </h3>
            <p style={{ 
              margin: 0, 
              color: '#999', 
              fontSize: isMobile ? '12px' : '13px',
              lineHeight: '1.6' 
            }}>
              종목을 추가하면 매달 자동으로 배당 성장 기록이 쌓여요.<br />
              최소 2개월 이상의 데이터가 있어야 성장률을 확인할 수 있습니다.
            </p>
          </div>
        ) : (
          <>
            {/* 성장률 요약 */}
            {growth && (
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: isMobile ? '20px' : '28px',
                borderRadius: '12px',
                marginBottom: '20px',
                color: 'white'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                  gap: isMobile ? '16px' : '20px'
                }}>
                  <div>
                    <p style={{ 
                      margin: '0 0 6px 0', 
                      fontSize: isMobile ? '11px' : '12px',
                      opacity: 0.9 
                    }}>
                      총 성장률
                    </p>
                    <p style={{ 
                      margin: 0, 
                      fontSize: isMobile ? '24px' : '32px',
                      fontWeight: 'bold' 
                    }}>
                      {growth.totalGrowth >= 0 ? '+' : ''}{growth.totalGrowth}%
                    </p>
                  </div>
                  
                  <div>
                    <p style={{ 
                      margin: '0 0 6px 0', 
                      fontSize: isMobile ? '11px' : '12px',
                      opacity: 0.9 
                    }}>
                      기간
                    </p>
                    <p style={{ 
                      margin: 0, 
                      fontSize: isMobile ? '24px' : '32px',
                      fontWeight: 'bold' 
                    }}>
                      {growth.monthsPassed}개월
                    </p>
                  </div>
                  
                  <div>
                    <p style={{ 
                      margin: '0 0 6px 0', 
                      fontSize: isMobile ? '11px' : '12px',
                      opacity: 0.9 
                    }}>
                      증가액
                    </p>
                    <p style={{ 
                      margin: 0, 
                      fontSize: isMobile ? '18px' : '22px',
                      fontWeight: 'bold' 
                    }}>
                      ${(growth.lastAmount - growth.firstAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 차트 */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{
                margin: '0 0 16px 0',
                color: '#2c3e50',
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '600'
              }}>
                <i className='fa-solid fa-water'></i> 배당 성장 추이
              </h3>
              
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: isMobile ? 10 : 12, fill: '#7f8c8d' }}
                    axisLine={{ stroke: '#ecf0f1' }}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="left"
                    tick={{ fontSize: isMobile ? 10 : 12, fill: '#7f8c8d' }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'USD', position: 'insideLeft', style: { fontSize: 11, fill: '#999' } }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: isMobile ? 10 : 12, fill: '#7f8c8d' }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'KRW', position: 'insideRight', style: { fontSize: 11, fill: '#999' } }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="연배당USD" 
                    stroke="#667eea" 
                    strokeWidth={3}
                    dot={{ fill: '#667eea', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="월배당KRW" 
                    stroke="#4caf50" 
                    strokeWidth={3}
                    dot={{ fill: '#4caf50', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 월별 데이터 테이블 */}
            <div>
              <h3 style={{
                margin: '0 0 12px 0',
                color: '#2c3e50',
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '600'
              }}>
                <i className='fa-solid fa-fish'></i> 월별 기록
              </h3>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: isMobile ? '12px' : '14px'
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                      <th style={{ padding: isMobile ? '10px 6px' : '12px 8px', textAlign: 'left', color: '#666' }}>월</th>
                      <th style={{ padding: isMobile ? '10px 6px' : '12px 8px', textAlign: 'right', color: '#666' }}>연 배당</th>
                      <th style={{ padding: isMobile ? '10px 6px' : '12px 8px', textAlign: 'right', color: '#666' }}>월 배당</th>
                      <th style={{ padding: isMobile ? '10px 6px' : '12px 8px', textAlign: 'center', color: '#666' }}>종목</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((snapshot) => (
                      <tr key={snapshot.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: isMobile ? '10px 6px' : '12px 8px', fontWeight: '600' }}>
                          {snapshot.month}
                        </td>
                        <td style={{ padding: isMobile ? '10px 6px' : '12px 8px', textAlign: 'right', color: '#667eea', fontWeight: '600' }}>
                          ${snapshot.totalAnnualDividend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: isMobile ? '10px 6px' : '12px 8px', textAlign: 'right', color: '#4caf50', fontWeight: '600' }}>
                          ₩{Math.round(snapshot.monthlyDividend * exchangeRate).toLocaleString()}
                        </td>
                        <td style={{ padding: isMobile ? '10px 6px' : '12px 8px', textAlign: 'center' }}>
                          {snapshot.stockCount}개
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;