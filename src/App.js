import { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc,
  query,
  orderBy,
  updateDoc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from './firebase';
import * as XLSX from 'xlsx';

import LoginPage from './LoginPage';
import DashboardPage from './DashboardPage';
import ChartPage from './ChartPage';

//import toast, { Toaster } from 'react-hot-toast';


function App() {
  const [currentPage, setCurrentPage] = useState('대시보드');
  const [stocks, setStocks] = useState([]);
  const [exchangeRate, setExchangeRate] = useState(1380);
  const [exchangeUpdateTime, setExchangeUpdateTime] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // 🔥 1. 인증 상태 감지 (하나만!)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('👤 인증 상태:', currentUser?.email || '로그아웃');
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 🔥 2. 윈도우 리사이즈
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 768;

  // 🔥 3. Firebase에서 데이터 불러오기
  const loadStocks = async () => {
    if (!user) return;

    try {
      const q = query(collection(db, `users/${user.uid}/stocks`), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const loadedStocks = [];
      querySnapshot.forEach((document) => {
        loadedStocks.push({ 
          id: document.id, 
          ...document.data() 
        });
      });
      setStocks(loadedStocks);
      console.log('✅ 내 종목 로드:', loadedStocks.length, '개');
    } catch (error) {
      console.error('❌ 데이터 로드 실패:', error);
    }
  };

  // 🔥 매달 스냅샷 자동 저장 (App.js에 추가)
useEffect(() => {
  const saveMonthlySnapshot = async () => {
    if (!user || stocks.length === 0) return;
    
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    // 총 연배당 계산
    const totalAnnualDividend = stocks.reduce((sum, stock) => {
      const annualDiv = stock.assetType === '주식'
        ? stock.currentPrice * stock.shares * stock.dividendRate / 100
        : stock.faceValue * stock.shares * stock.dividendRate / 100;
      return sum + annualDiv;
    }, 0);
    
    const monthlyDividend = totalAnnualDividend / 12;
    
    try {
      // 🔥 Firestore에 스냅샷 저장
      await setDoc(doc(db, `users/${user.uid}/snapshots`, monthKey), {
        totalAnnualDividend,
        monthlyDividend,
        stockCount: stocks.length,
        timestamp: new Date(),
        month: monthKey
      }, { merge: true });  // merge: 기존 데이터 덮어쓰기
      
      console.log('✅ 스냅샷 저장:', monthKey);
    } catch (error) {
      console.error('❌ 스냅샷 저장 실패:', error);
    }
  };
  
  // 종목이 추가/수정/삭제될 때마다 저장
  if (stocks.length > 0) {
    saveMonthlySnapshot();
  }
}, [stocks, user]);  // stocks 변경 시 자동 저장


  // 🔥 4. 실시간 환율
  const fetchExchangeRate = async () => {
    try {
      const url = 'https://api.exchangerate-api.com/v4/latest/USD';
      console.log('🔄 환율 API 호출 중...');
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data.rates && data.rates.KRW) {
        const rate = data.rates.KRW;
        setExchangeRate(rate);
        setExchangeUpdateTime(new Date().toLocaleTimeString('ko-KR'));
        console.log('✅ 환율 업데이트:', rate.toFixed(2), '원/USD');
      }
    } catch (error) {
      console.error('❌ 환율 API 오류:', error);
    }
  };

  // 🔥 5. 실시간 주가
  const fetchStockPrice = async (ticker) => {
    try {
      const API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;
      
      if (!API_KEY) {
        console.log('⚠️ Finnhub API 키가 없습니다.');
        return null;
      }

      const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.c && data.c > 0) {
        console.log('✅ 주가:', ticker, '=', data.c);
        return data.c;
      }
      return null;
    } catch (error) {
      console.error('❌ 주가 API 오류:', ticker, error);
      return null;
    }
  };

  // 🔥 6. 사용자 로그인 후 데이터 로드
  useEffect(() => {
    if (!user) return;
    loadStocks();
  }, [user]);

  // 🔥 7. 환율 업데이트 (사용자 무관)
  useEffect(() => {
    fetchExchangeRate();
    const interval = setInterval(fetchExchangeRate, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { name: '대시보드', icon: 'fa-brands fa-dashcube' },
    { name: '포트폴리오', icon: 'fa-solid fa-file-pen' },
    { name: '배당 캘린더', icon: 'fa-regular fa-calendar-days' },
    { name: '종목별 배당', icon: 'fa-solid fa-circle-dollar-to-slot' },     
    { name: '목표 달성률', icon: 'fa-solid fa-ranking-star' },
    { name: '차트 분석', icon: 'fa-solid fa-chart-line' },
    { name: '세금 계산기', icon: 'fa-solid fa-calculator' },
    { name: '인기 배당주', icon: 'fa-solid fa-egg' },
    { name: '투자 거장', icon: 'fa-solid fa-user-tie' },
    { name: '배당 뉴스', icon: 'fa-solid fa-newspaper' },
    { name: '설정', icon: 'fa-solid fa-gear' },
    { name: '정보', icon: 'fa-solid fa-circle-info' }
  ];

  // 🔥 로딩 중
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#f5f6fa'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#667eea' }}>💰</h2>
          <p style={{ color: '#666' }}>로딩 중...</p>
        </div>
      </div>
    );
  }

  // 🔥 로그인 안 했으면
  if (!user) {
    return <LoginPage />;
  }

  // 🔥 로그인 했으면 앱 화면 (return은 하나만!)
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      
      {/* 모바일 헤더 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        background: '#2c3e50',
        color: 'white',
        display: isMobile ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 1000,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
      className="mobile-header">
        <h1 style={{ 
          margin: 0, 
          fontSize: '18px', 
          fontWeight: 'bold',
          color: 'white'
        }}>
          💰 배당 포트폴리오
        </h1>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '28px',
            cursor: 'pointer',
            padding: '5px',
            lineHeight: 1
          }}
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* 사이드바 */}
      <div 
        style={{
          width: '250px',
          background: '#2c3e50',
          color: 'white',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          position: isMobile ? 'fixed' : 'relative',
          top: isMobile ? 0 : 'auto',
          left: isMobile ? 0 : 'auto',
          zIndex: 999,
          transition: 'transform 0.3s ease',
          transform: isMobile 
            ? (isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)') 
            : 'none'
        }}
        className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}
      >
        {/* 헤더 */}
        <div style={{ padding: '30px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>💰 배당 포트폴리오</h1>
          <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#95a5a6' }}>
            US Stocks & Bonds
          </p>
        </div>

        {/* 프로필 */}
        {user && (
          <div style={{
            padding: '15px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <img 
              src={user.photoURL || 'https://via.placeholder.com/40'} 
              alt="프로필"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.2)'
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ 
                margin: 0, 
                fontSize: '14px', 
                fontWeight: '600',
                color: 'white',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {user.displayName || '사용자'}
              </p>
              <p style={{ 
                margin: '2px 0 0 0', 
                fontSize: '11px', 
                color: '#95a5a6',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {user.email}
              </p>
            </div>
          </div>
        )}

        {/* 메뉴 */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setCurrentPage(item.name);
                setIsMobileMenuOpen(false);
              }}
              style={{
                width: '100%',
                padding: '15px 20px',
                background: currentPage === item.name ? '#34495e' : 'transparent',
                color: 'white',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '15px',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
              onMouseEnter={(e) => {
                if (currentPage !== item.name) {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== item.name) {
                  e.target.style.background = 'transparent';
                }
              }}
            >
               {/* 🔥 아이콘 (Font Awesome) */}
  <i 
    className={item.icon}
    style={{ 
      fontSize: '16px',
      width: '18px',
      textAlign: 'center'
    }}
  ></i>
  
  {/* 🔥 메뉴 이름 */}
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        {/* 환율 */}
        <div style={{ 
          padding: '20px', 
          borderTop: '1px solid rgba(255,255,255,0.1)',
          fontSize: '12px',
          color: '#95a5a6'
        }}>
          <p style={{ margin: '0 0 8px 0' }}>
            💱 환율: ₩{exchangeRate.toFixed(2)}
          </p>
          {exchangeUpdateTime && (
            <p style={{ margin: 0, fontSize: '11px' }}>
              {exchangeUpdateTime} 업데이트
            </p>
          )}
        </div>

        {/* 로그아웃 */}
        <div style={{ padding: '15px 20px' }}>
          <button
            onClick={async () => {
              if (window.confirm('로그아웃 하시겠습니까?')) {
                try {
                  await signOut(auth);
                } catch (error) {
                  alert('로그아웃 실패: ' + error.message);
                }
              }
            }}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(231, 76, 60, 0.1)',
              color: '#e74c3c',
              border: '1px solid rgba(231, 76, 60, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#e74c3c';
              e.target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(231, 76, 60, 0.1)';
              e.target.style.color = '#e74c3c';
            }}
          >
            🚪 로그아웃
          </button>
        </div>
      </div>

    {/* 🔥 모바일 오버레이 (메뉴 열렸을 때 배경 어둡게) */}
    {isMobileMenuOpen && (
      <div
        onClick={() => setIsMobileMenuOpen(false)}
        style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 998
        }}
        className="mobile-overlay"
      />
    )}

    {/* 메인 콘텐츠 */}
    <div style={{
      flex: 1,
      padding: windowWidth <= 768 ? '20px' : '40px',
      paddingTop: windowWidth <= 768 ? '100px' : '40px', 
      overflowY: 'auto',
      background: '#ecf0f1'

    }}
    className="main-content">
     {currentPage === '대시보드' && <DashboardPage stocks={stocks} user={user} exchangeRate={exchangeRate} />}
      {currentPage === '포트폴리오' && (
        <PortfolioPage 
          stocks={stocks} 
          setStocks={setStocks} 
          loadStocks={loadStocks}
          fetchStockPrice={fetchStockPrice}
          db={db}
          user={user}
        />
      )}
      {currentPage === '차트 분석' && <ChartPage stocks={stocks} exchangeRate={exchangeRate} />} 
      {currentPage === '배당 캘린더' && <CalendarPage stocks={stocks} />}
      {currentPage === '종목별 배당' && <StockDividendPage stocks={stocks} />}
      {currentPage === '세금 계산기' && <TaxCalculatorPage exchangeRate={exchangeRate} />}
      {currentPage === '목표 달성률' && <GoalTrackerPage stocks={stocks} />}
      {currentPage === '배당 뉴스' && <DividendNewsPage />}
      {currentPage === '인기 배당주' && <PopularDividendStocksPage />}
      {currentPage === '투자 거장' && <InvestorLegendsPage />}
      {currentPage === '설정' && <SettingsPage setStocks={setStocks} db={db} user={user} />}
      {currentPage === '정보' && <LegalPages />}
    </div>
  </div>
);
}

// ============================================
// 📊 포트폴리오 페이지
// ============================================
function PortfolioPage({ stocks, setStocks, fetchStockPrice, user }) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [dividendRate, setDividendRate] = useState('');
  const [dividendMonths, setDividendMonths] = useState('');
  const [loading, setLoading] = useState(false);
  const [updatingAll, setUpdatingAll] = useState(false);
  
  // 🔥 단순 유형 구분 (표시용)
  const [isStock, setIsStock] = useState(true);
  
  const [editingStock, setEditingStock] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 480;

  // 폼 초기화
  const resetForm = () => {
    setTicker('');
    setShares('');
    setPurchasePrice('');
    setDividendRate('');
    setDividendMonths('');
    setIsStock(true);
    setEditingStock(null);
    setIsEditMode(false);
  };

  // 수정 모드 활성화
  const handleEdit = (stock) => {
    setIsEditMode(true);
    setEditingStock(stock);
    setIsStock(stock.assetType === '주식');
    setTicker(stock.ticker);
    setShares(stock.shares.toString());
    setPurchasePrice(stock.purchasePrice.toString());
    setDividendRate(stock.dividendRate.toString());
    setDividendMonths(stock.dividendMonths || '');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 🔥 종목 추가/수정 (모든 종목 동일하게 처리)
  const handleAddOrUpdateStock = async () => {
    if (!ticker || !shares || !purchasePrice || !dividendRate || !dividendMonths) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      let currentPrice = parseFloat(purchasePrice);

      // 🔥 모든 종목 API 조회 시도
      try {
        const apiPrice = await fetchStockPrice(ticker);
        if (apiPrice !== null && apiPrice > 0) {
          currentPrice = apiPrice;
        }
      } catch (error) {
        console.log(`⚠️ ${ticker} API 조회 실패 - 매수가 사용`);
      }

      const stockData = {
        assetType: isStock ? '주식' : '채권',  // 🔥 단순 워딩/표시용
        ticker: ticker.toUpperCase(),
        shares: parseFloat(shares),
        purchasePrice: parseFloat(purchasePrice),
        currentPrice,
        dividendRate: parseFloat(dividendRate),
        dividendMonths,
        lastUpdated: new Date()
      };

      // 수정 모드
      if (isEditMode && editingStock) {
        stockData.id = editingStock.id;
        stockData.createdAt = editingStock.createdAt;

        await setDoc(doc(db, `users/${user.uid}/stocks`, editingStock.id), stockData);
        setStocks(stocks.map(s => s.id === editingStock.id ? { ...stockData, id: editingStock.id } : s));

        alert(`✅ ${ticker.toUpperCase()} 종목이 수정되었습니다!`);
      } 
      // 신규 추가
      else {
        const isDuplicate = stocks.some(s => s.ticker === ticker.toUpperCase());
        if (isDuplicate) {
          alert(`❌ ${ticker.toUpperCase()}는 이미 포트폴리오에 있습니다.\n수정하려면 "수정" 버튼을 클릭하세요.`);
          setLoading(false);
          return;
        }

        const newId = `${ticker.toUpperCase()}_${Date.now()}`;
        stockData.id = newId;
        stockData.createdAt = new Date();

        await setDoc(doc(db, `users/${user.uid}/stocks`, newId), stockData);
        setStocks([...stocks, { ...stockData, id: newId }]);

        alert(`✅ ${ticker.toUpperCase()} 종목이 추가되었습니다!`);
      }

      resetForm();
    } catch (error) {
      console.error('❌ 저장 실패:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 모든 종목 가격 업데이트
  const handleUpdateAllPrices = async () => {
    if (stocks.length === 0) {
      alert('업데이트할 종목이 없습니다.');
      return;
    }

    const confirmed = window.confirm(
      `${stocks.length}개 종목의 가격을 업데이트하시겠습니까?\n\n` +
      `종목: ${stocks.map(s => s.ticker).join(', ')}`
    );
    
    if (!confirmed) return;

    setUpdatingAll(true);
    let successCount = 0;
    let failCount = 0;

    for (const stock of stocks) {
      try {
        const newPrice = await fetchStockPrice(stock.ticker);
        if (newPrice !== null && newPrice > 0) {
          const updatedStock = { ...stock, currentPrice: newPrice, lastUpdated: new Date() };
          await setDoc(doc(db, `users/${user.uid}/stocks`, stock.id), updatedStock);
          
          setStocks(prevStocks => 
            prevStocks.map(s => s.id === stock.id ? updatedStock : s)
          );
          
          successCount++;
        } else {
          failCount++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`${stock.ticker} 업데이트 실패:`, error);
        failCount++;
      }
    }

    setUpdatingAll(false);
    alert(
      `✅ 업데이트 완료!\n\n` +
      `성공: ${successCount}개\n` +
      `실패: ${failCount}개`
    );
  };

  // 종목 삭제
  const handleDeleteStock = async (stockId) => {
    const confirmed = window.confirm('정말 이 종목을 삭제하시겠습니까?');
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, `users/${user.uid}/stocks`, stockId));
      setStocks(stocks.filter(s => s.id !== stockId));
      alert('✅ 종목이 삭제되었습니다.');
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // Excel 내보내기
  const handleExport = () => {
    const exportData = stocks.map(stock => ({
      '자산유형': stock.assetType,
      '티커': stock.ticker,
      '수량': stock.shares,
      '매수가': stock.purchasePrice,
      '현재가': stock.currentPrice,
      '배당률': stock.dividendRate + '%',
      '배당월': stock.dividendMonths,
      '평가액': (stock.currentPrice * stock.shares).toFixed(2),
      '수익률': (((stock.currentPrice - stock.purchasePrice) / stock.purchasePrice) * 100).toFixed(2) + '%',
      '연배당': (stock.currentPrice * stock.shares * stock.dividendRate / 100).toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Portfolio');
    XLSX.writeFile(wb, `배당_포트폴리오_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 30px 0', color: '#333' }}>
        <i className="fa-solid fa-chart-pie" style={{ marginRight: '12px', color: '#667eea' }}></i>
        포트폴리오
      </h1>

      {/* 수정 모드 알림 */}
      {isEditMode && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: isMobile ? '12px 16px' : '14px 20px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-pen-to-square" style={{ fontSize: '18px' }}></i>
            <span style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '600' }}>
              {editingStock?.ticker} 종목 수정 중
            </span>
          </div>
          <button
            onClick={resetForm}
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: isMobile ? '12px' : '13px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            취소
          </button>
        </div>
      )}

      {/* 종목 추가/수정 폼 */}
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
          {isEditMode ? '✏️ 종목 수정' : '➕ 종목 추가'}
        </h2>

        {/* 🔥 간단한 안내 */}
        <div style={{
          background: '#f0f7ff',
          border: '2px solid #667eea',
          borderRadius: '10px',
          padding: isMobile ? '12px 14px' : '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <i className="fa-solid fa-circle-info" style={{ 
            color: '#667eea', 
            fontSize: '18px',
            marginTop: '2px',
            flexShrink: 0
          }}></i>
          <p style={{ 
            margin: 0, 
            color: '#2c3e50', 
            fontSize: isMobile ? '12px' : '13px',
            lineHeight: '1.6'
          }}>
            일부 종목은 실시간 가격 조회가 불가능할 수 있습니다. (장외거래, 일부 ETN등)
            조회 실패 시 매수가가 현재가로 사용되며, <strong>수정 버튼</strong>으로 언제든 업데이트 가능합니다.<br/>
            배당률은 주가에 따라 변동되니 주기적으로 업데이트 해주세요.
          </p>
        </div>

        {/* 🔥 입력 필드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: '15px'
        }}>
          {/* 🔥 유형 선택 */}
          <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
            <label style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: isMobile ? '12px' : '14px',
              background: '#f8f9fa',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: '600',
              border: '2px solid #e0e0e0'
            }}>
              <input
                type="checkbox"
                checked={isStock}
                onChange={(e) => setIsStock(e.target.checked)}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer'
                }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isStock ? (
                  <>
                    <i className="fa-solid fa-chart-line" style={{ color: '#1976d2', fontSize: '18px' }}></i>
                    <span style={{ color: '#1976d2' }}>주식으로 표시</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-file-invoice-dollar" style={{ color: '#f57c00', fontSize: '18px' }}></i>
                    <span style={{ color: '#f57c00' }}>채권으로 표시</span>
                  </>
                )}
              </span>
            </label>
          </div>

          {/* 티커 */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              fontSize: isMobile ? '13px' : '14px'
            }}>
              티커
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="예: AAPL"
              disabled={isEditMode}
              style={{
                width: '100%',
                padding: isMobile ? '10px' : '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: isMobile ? '13px' : '14px',
                opacity: isEditMode ? 0.6 : 1,
                cursor: isEditMode ? 'not-allowed' : 'text',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 수량 */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              fontSize: isMobile ? '13px' : '14px'
            }}>
              수량
            </label>
            <input
              type="number"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="보유 수량"
              style={{
                width: '100%',
                padding: isMobile ? '10px' : '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: isMobile ? '13px' : '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 매수가 */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              fontSize: isMobile ? '13px' : '14px'
            }}>
              매수가 ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="평균 매수가"
              style={{
                width: '100%',
                padding: isMobile ? '10px' : '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: isMobile ? '13px' : '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 배당률 */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              fontSize: isMobile ? '13px' : '14px'
            }}>
              배당률 (%)
            </label>
            <input
              type="number"
              step="0.01"
              value={dividendRate}
              onChange={(e) => setDividendRate(e.target.value)}
              placeholder="예: 4.5"
              style={{
                width: '100%',
                padding: isMobile ? '10px' : '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: isMobile ? '13px' : '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 배당 지급월 */}
          <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              fontSize: isMobile ? '13px' : '14px'
            }}>
              배당 지급월
            </label>
            <input
              type="text"
              value={dividendMonths}
              onChange={(e) => setDividendMonths(e.target.value)}
              placeholder="예: 2,5,8,11 또는 매월"
              style={{
                width: '100%',
                padding: isMobile ? '10px' : '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: isMobile ? '13px' : '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* 추가/수정 버튼 */}
        <button
          onClick={handleAddOrUpdateStock}
          disabled={loading}
          style={{
            width: '100%',
            padding: isMobile ? '12px' : '14px',
            background: loading ? '#ccc' : '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s',
            marginTop: '15px'
          }}
        >
          {loading ? '처리 중...' : isEditMode ? '✅ 수정 완료' : '➕ 종목 추가'}
        </button>
      </div>

      {/* 상단 버튼 */}
      {stocks.length > 0 && (
        <div style={{ 
          marginBottom: '20px', 
          display: 'flex', 
          gap: '10px',
          justifyContent: 'flex-end',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleUpdateAllPrices}
            disabled={updatingAll}
            style={{
              padding: isMobile ? '10px 16px' : '12px 20px',
              background: updatingAll ? '#ccc' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: 'bold',
              cursor: updatingAll ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-rotate"></i>
            {updatingAll ? '업데이트 중...' : '모든 종목 업데이트'}
          </button>

          <button
            onClick={handleExport}
            style={{
              padding: isMobile ? '10px 16px' : '12px 20px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-download"></i>
            Excel 다운로드
          </button>
        </div>
      )}

      {/* 포트폴리오 목록 */}
      {stocks.length === 0 ? (
        <div style={{
          background: 'white',
          padding: isMobile ? '40px 20px' : '60px 40px',
          borderRadius: '15px',
          textAlign: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.3 }}>📊</div>
          <h3 style={{ margin: '0 0 10px 0', color: '#999', fontSize: isMobile ? '16px' : '18px' }}>
            아직 종목이 없어요
          </h3>
          <p style={{ margin: 0, color: '#ccc', fontSize: isMobile ? '13px' : '14px' }}>
            첫 번째 종목을 추가해보세요!
          </p>
        </div>
      ) : (
        <>
          {/* 데스크톱 테이블 */}
          {!isMobile && (
            <div style={{
              background: 'white',
              padding: '30px',
              borderRadius: '15px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              overflowX: 'auto'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#666', fontSize: '13px' }}>유형</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#666', fontSize: '13px' }}>티커</th>
                    <th style={{ padding: '12px', textAlign: 'right', color: '#666', fontSize: '13px' }}>수량</th>
                    <th style={{ padding: '12px', textAlign: 'right', color: '#666', fontSize: '13px' }}>매수가</th>
                    <th style={{ padding: '12px', textAlign: 'right', color: '#666', fontSize: '13px' }}>현재가</th>
                    <th style={{ padding: '12px', textAlign: 'right', color: '#666', fontSize: '13px' }}>수익률</th>
                    <th style={{ padding: '12px', textAlign: 'right', color: '#666', fontSize: '13px' }}>배당률</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: '#666', fontSize: '13px' }}>배당월</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: '#666', fontSize: '13px' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map(stock => {
                    const profitRate = ((stock.currentPrice - stock.purchasePrice) / stock.purchasePrice * 100).toFixed(2);
                    return (
                      <tr key={stock.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px' }}>
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
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold', fontSize: '14px' }}>{stock.ticker}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>{stock.shares}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>${stock.purchasePrice.toFixed(2)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>${stock.currentPrice.toFixed(2)}</td>
                        <td style={{ 
                          padding: '12px', 
                          textAlign: 'right',
                          color: profitRate >= 0 ? '#4caf50' : '#ff4757',
                          fontWeight: '600'
                        }}>
                          {profitRate >= 0 ? '+' : ''}{profitRate}%
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>{stock.dividendRate}%</td>
                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                          {stock.dividendMonths}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleEdit(stock)}
                              title="수정"
                              style={{
                                padding: '6px 10px',
                                background: '#667eea',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}
                            >
                              <i className="fa-solid fa-pen-to-square"></i>
                            </button>

                            <button
                              onClick={() => handleDeleteStock(stock.id)}
                              title="삭제"
                              style={{
                                padding: '6px 10px',
                                background: '#ff4757',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 모바일 카드 */}
          {isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stocks.map(stock => {
                const profitRate = ((stock.currentPrice - stock.purchasePrice) / stock.purchasePrice * 100).toFixed(2);
                return (
                  <div
                    key={stock.id}
                    style={{
                      background: 'white',
                      padding: '16px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #f0f0f0'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                        <strong style={{ fontSize: '16px' }}>{stock.ticker}</strong>
                      </div>
                      <span style={{
                        color: profitRate >= 0 ? '#4caf50' : '#ff4757',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}>
                        {profitRate >= 0 ? '+' : ''}{profitRate}%
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', lineHeight: '1.8', color: '#666' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>수량:</span>
                        <strong>{stock.shares}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>매수가:</span>
                        <strong>${stock.purchasePrice.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>현재가:</span>
                        <strong style={{ color: '#2c3e50' }}>${stock.currentPrice.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>배당률:</span>
                        <strong>{stock.dividendRate}%</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>배당월:</span>
                        <strong>{stock.dividendMonths}</strong>
                      </div>
                    </div>

                    <div style={{ 
                      display: 'flex', 
                      gap: '6px', 
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid #f0f0f0'
                    }}>
                      <button
                        onClick={() => handleEdit(stock)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          background: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                        수정
                      </button>

                      <button
                        onClick={() => handleDeleteStock(stock.id)}
                        style={{
                          padding: '8px 12px',
                          background: '#ff4757',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );

}

// ============================================
// 📅 배당 캘린더
// ============================================
function CalendarPage({ stocks }) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const months = Array.from({length: 12}, (_, i) => i + 1);
  
  const getMonthlyDividend = (month) => {
    return stocks.filter(stock => {
      if (!stock.dividendMonths) return false;
      if (stock.dividendMonths === '매월') return true;

      const monthStr = stock.dividendMonths;
      if (monthStr.includes('월')) {
        const monthsArray = monthStr.split(',').map(m => m.trim());
        return monthsArray.includes(`${month}월`);
      }
      
      const monthsArray = monthStr.split(',').map(m => m.trim());
      return monthsArray.includes(String(month));
    });
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 30px 0', color: '#333' }}>
        📅 배당 캘린더
      </h1>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: windowWidth <= 480 
          ? 'repeat(3, 1fr)' 
          : 'repeat(4, 1fr)',
        gap: windowWidth <= 480 ? '10px' : '20px'
      }}
      className="calendar-grid">
        {months.map(month => {
          const monthStocks = getMonthlyDividend(month);
          
          // 🔥 수정된 배당 계산
          const totalDividend = monthStocks.reduce((sum, stock) => {
            // 🔥 안전한 값 추출
            const price = parseFloat(stock.currentPrice) || 0;
            const shares = parseFloat(stock.shares) || 0;
            const rate = parseFloat(stock.dividendRate) || 0;
            
            // 🔥 연간 배당액 계산 (모든 종목 동일하게)
            const annualDividend = price * shares * rate / 100;
            
            // 🔥 지급 횟수 계산
            let frequency = 12;
            if (stock.dividendMonths && stock.dividendMonths !== '매월') {
              const monthsArray = stock.dividendMonths.split(',').filter(m => m.trim());
              frequency = monthsArray.length > 0 ? monthsArray.length : 12;
            }
            
            // 🔥 이번 달 배당
            const monthlyDividend = annualDividend / frequency;
            
            return sum + (isNaN(monthlyDividend) ? 0 : monthlyDividend);
          }, 0);

          return (
            <div
              key={month}
              style={{
                background: monthStocks.length > 0 ? '#e8f5e9' : 'white',
                padding: windowWidth <= 480 ? '15px' : '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                textAlign: 'center',
                transition: 'all 0.3s',
                border: monthStocks.length > 0 ? '2px solid #4caf50' : '2px solid #e0e0e0',
                cursor: monthStocks.length > 0 ? 'pointer' : 'default'
              }}
              onMouseEnter={(e) => {
                if (monthStocks.length > 0) {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
            >
              <h3 style={{
                margin: '0 0 12px 0',
                color: monthStocks.length > 0 ? '#4caf50' : '#999',
                fontSize: windowWidth <= 480 ? '16px' : '20px',
                fontWeight: 'bold'
              }}>
                {month}월
              </h3>

              {monthStocks.length > 0 && (
                <div style={{
                  fontSize: windowWidth <= 480 ? '24px' : '20px',
                  margin: '10px 0'
                }}>
                  🐷
                </div>
              )}

              <p style={{
                margin: '8px 0',
                fontSize: windowWidth <= 480 ? '18px' : '22px',
                fontWeight: 'bold',
                color: monthStocks.length > 0 ? '#2e7d32' : '#999'
              }}>
                ${(totalDividend || 0).toFixed(0)}
              </p>

              <p style={{
                margin: '4px 0 0 0',
                fontSize: windowWidth <= 480 ? '11px' : '13px',
                color: '#666'
              }}>
                {monthStocks.length > 0 ? `${monthStocks.length}개 종목` : '0개 종목'}
              </p>

              {monthStocks.length > 0 && (
                <div style={{
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(76, 175, 80, 0.3)',
                  fontSize: windowWidth <= 480 ? '10px' : '11px',
                  color: '#666',
                  lineHeight: '1.4'
                }}>
                  {monthStocks.map(s => s.ticker).join(', ')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 🔥 연간 배당 요약 */}
      <div style={{
        background: 'white',
        padding: windowWidth <= 480 ? '20px' : '30px',
        borderRadius: '15px',
        marginTop: '30px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{
          margin: '0 0 20px 0',
          color: '#667eea',
          fontSize: windowWidth <= 480 ? '18px' : '24px'
        }}>
          📊 연간 배당 요약
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: windowWidth <= 480 ? '1fr' : 'repeat(4, 1fr)',
          gap: windowWidth <= 480 ? '12px' : '20px'
        }}>
          {/* 연간 총 배당 */}
          <div style={{
            background: '#f8f9fa',
            padding: windowWidth <= 480 ? '15px' : '20px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <p style={{
              margin: '0 0 8px 0',
              fontSize: windowWidth <= 480 ? '12px' : '14px',
              color: '#666'
            }}>
              연간 총 배당
            </p>
            <p style={{
              margin: 0,
              fontSize: windowWidth <= 480 ? '24px' : '28px',
              fontWeight: 'bold',
              color: '#4caf50'
            }}>
              ${(() => {
                const total = months.reduce((sum, month) => {
                  const monthStocks = getMonthlyDividend(month);
                  const monthlyTotal = monthStocks.reduce((s, stock) => {
                    const price = parseFloat(stock.currentPrice) || 0;
                    const shares = parseFloat(stock.shares) || 0;
                    const rate = parseFloat(stock.dividendRate) || 0;
                    const annualDiv = price * shares * rate / 100;
                    
                    let frequency = 12;
                    if (stock.dividendMonths && stock.dividendMonths !== '매월') {
                      frequency = stock.dividendMonths.split(',').filter(m => m.trim()).length || 12;
                    }
                    
                    return s + (annualDiv / frequency);
                  }, 0);
                  return sum + monthlyTotal;
                }, 0);
                return (total || 0).toFixed(0);
              })()}
            </p>
          </div>

          {/* 이번 달 배당 */}
          <div style={{
            background: '#f8f9fa',
            padding: windowWidth <= 480 ? '15px' : '20px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <p style={{
              margin: '0 0 8px 0',
              fontSize: windowWidth <= 480 ? '12px' : '14px',
              color: '#666'
            }}>
              이번 달 배당
            </p>
            <p style={{
              margin: 0,
              fontSize: windowWidth <= 480 ? '24px' : '28px',
              fontWeight: 'bold',
              color: '#667eea'
            }}>
              ${(() => {
                const currentMonth = new Date().getMonth() + 1;
                const thisMonthStocks = stocks.filter(stock => {
                  if (!stock.dividendMonths) return false;
                  if (stock.dividendMonths === '매월') return true;
                  
                  const monthStr = stock.dividendMonths;
                  if (monthStr.includes('월')) {
                    const monthsArray = monthStr.split(',').map(m => m.trim());
                    return monthsArray.includes(`${currentMonth}월`);
                  }
                  
                  const monthsArray = monthStr.split(',').map(m => m.trim());
                  return monthsArray.includes(String(currentMonth));
                });

                const total = thisMonthStocks.reduce((sum, stock) => {
                  const price = parseFloat(stock.currentPrice) || 0;
                  const shares = parseFloat(stock.shares) || 0;
                  const rate = parseFloat(stock.dividendRate) || 0;
                  const annualDiv = price * shares * rate / 100;
                  
                  let frequency = 12;
                  if (stock.dividendMonths && stock.dividendMonths !== '매월') {
                    frequency = stock.dividendMonths.split(',').filter(m => m.trim()).length || 12;
                  }
                  
                  return sum + (annualDiv / frequency);
                }, 0);

                return (total || 0).toFixed(0);
              })()}
            </p>
          </div>

          {/* 평균 월 배당 */}
          <div style={{
            background: '#f8f9fa',
            padding: windowWidth <= 480 ? '15px' : '20px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <p style={{
              margin: '0 0 8px 0',
              fontSize: windowWidth <= 480 ? '12px' : '14px',
              color: '#666'
            }}>
              평균 월 배당
            </p>
            <p style={{
              margin: 0,
              fontSize: windowWidth <= 480 ? '24px' : '28px',
              fontWeight: 'bold',
              color: '#ff9800'
            }}>
              ${(() => {
                const total = stocks.reduce((sum, stock) => {
                  const price = parseFloat(stock.currentPrice) || 0;
                  const shares = parseFloat(stock.shares) || 0;
                  const rate = parseFloat(stock.dividendRate) || 0;
                  return sum + (price * shares * rate / 100);
                }, 0);
                return ((total / 12) || 0).toFixed(0);
              })()}
            </p>
          </div>

          {/* 배당 지급 월 */}
          <div style={{
            background: '#f8f9fa',
            padding: windowWidth <= 480 ? '15px' : '20px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <p style={{
              margin: '0 0 8px 0',
              fontSize: windowWidth <= 480 ? '12px' : '14px',
              color: '#666'
            }}>
              배당 지급 월
            </p>
            <p style={{
              margin: 0,
              fontSize: windowWidth <= 480 ? '24px' : '28px',
              fontWeight: 'bold',
              color: '#2c3e50'
            }}>
              {months.filter(month => getMonthlyDividend(month).length > 0).length}개월
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 💵 종목별 배당 (수정)
// ============================================
function StockDividendPage({ stocks }) {
  return (
    <div>
      <h1 style={{ margin: '0 0 30px 0', color: '#333' }}>종목별 배당 스케줄</h1>

      {stocks.length === 0 ? (
        <div style={{
          background: 'white',
          padding: '60px',
          borderRadius: '15px',
          textAlign: 'center',
          color: '#999'
        }}>
          <p style={{ fontSize: '48px', margin: 0 }}>📅</p>
          <p style={{ fontSize: '18px', margin: '20px 0 0 0' }}>
            종목을 추가하면 배당 스케줄을 확인할 수 있어요!
          </p>
        </div>
      ) : (
        stocks.map(stock => (
          <div key={stock.id} style={{
            background: 'white',
            padding: '30px',
            borderRadius: '15px',
            marginBottom: '20px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#667eea' }}>{stock.ticker}</h2>
                <p style={{ margin: '5px 0 0 0', color: '#999' }}>
                  {stock.assetType} | 배당률: {stock.dividendRate}%
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>연간 예상 배당</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>
                  ${(() => {
                    const price = parseFloat(stock.currentPrice) || 0;
                    const shares = parseFloat(stock.shares) || 0;
                    const rate = parseFloat(stock.dividendRate) || 0;
                    const annualDiv = price * shares * rate / 100;
                    return (annualDiv || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
                  })()}
                </p>
              </div>
            </div>

            {/* 🔥 className 추가 */}
            <div style={{ display: 'grid', 
  gridTemplateColumns: window.innerWidth <= 768 
    ? (window.innerWidth <= 480 ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)')
    : 'repeat(12, 1fr)',
  gap: window.innerWidth <= 768 ? '8px' : '10px'
}}
className="dividend-months-grid">
              {Array.from({length: 12}, (_, i) => i + 1).map(month => {
                // 🔥 수정: 정확한 월 매칭
                let hasDividend = false;
                
                if (stock.dividendMonths === '매월') {
                  hasDividend = true;
                } else if (stock.dividendMonths) {
                  const monthStr = stock.dividendMonths;
                  
                  // "1월,6월,12월" 형식
                  if (monthStr.includes('월')) {
                    const monthsArray = monthStr.split(',').map(m => m.trim());
                    hasDividend = monthsArray.includes(`${month}월`);
                  } else {
                    // "1,6,12" 형식
                    const monthsArray = monthStr.split(',').map(m => m.trim());
                    hasDividend = monthsArray.includes(String(month));
                  }
                }
                
                return (
                  <div key={month} style={{
                    background: hasDividend ? '#e8f5e9' : '#f5f5f5',
                    padding: '15px 10px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: hasDividend ? '2px solid #4caf50' : '1px solid #e0e0e0'
                  }}
                  className="month-box">  {/* 🔥 className 추가 */}
                    <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>{month}월</p>
                    <p style={{ margin: '5px 0 0 0', fontSize: '20px' }}>
                      {hasDividend ? <i className="fa-solid fa-circle-dollar-to-slot"></i> : '-'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ============================================
// 💸 세금 계산기
// ============================================
function TaxCalculatorPage({ exchangeRate }) {
  const [dividendUSD, setDividendUSD] = useState('');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);  // 🔥 추가

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 480;  // 🔥 추가
  
  const dividendKRW = Math.round(Number(dividendUSD) * exchangeRate);
  const foreignTax = Math.round(dividendKRW * 0.15);
  const domesticTax = Math.round((dividendKRW - foreignTax) * 0.154);
  const actualIncome = Math.round(dividendKRW - foreignTax - domesticTax);

  return (
    <div>
      <h1 style={{ margin: '0 0 30px 0', color: '#333' }}>배당 세금 계산기</h1>

      {/* 🔥 환율 정보 - 한 줄로 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: isMobile ? '20px' : '30px',
        borderRadius: '15px',
        marginBottom: '30px',
        textAlign: 'center'  // 🔥 변경
      }}>
        <p style={{ 
          margin: '0 0 10px 0', 
          fontSize: isMobile ? '12px' : '14px',
          opacity: 0.9,
          display: 'flex',  // 🔥 추가
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          flexWrap: 'wrap'  // 🔥 필요시 줄바꿈
        }}>
          <span> 실시간 환율</span>
          <span style={{ fontSize: isMobile ? '10px' : '12px' }}>
            {new Date().toLocaleDateString('ko-KR')}
          </span>
        </p>
        <p style={{ 
          margin: 0, 
          fontSize: isMobile ? '28px' : '32px',
          fontWeight: 'bold' 
        }}>
          ₩{exchangeRate.toFixed(2)}/USD
        </p>
      </div>

      {/* 입력 */}
      <div style={{
        background: 'white',
        padding: isMobile ? '20px' : '30px',
        borderRadius: '15px',
        marginBottom: '30px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '10px', 
          color: '#667eea',
          fontSize: isMobile ? '16px' : '18px',
          fontWeight: 'bold'
        }}>
          배당금 입력 (달러)
        </label>
        <input 
          type="number"
          value={dividendUSD}
          onChange={(e) => setDividendUSD(e.target.value)}
          placeholder="예: 1000"
          style={{
            width: '100%',
            padding: isMobile ? '12px' : '15px',
            fontSize: isMobile ? '20px' : '24px',
            border: '2px solid #667eea',
            borderRadius: '10px',
            boxSizing: 'border-box',
            fontWeight: 'bold'
          }}
        />
        {dividendUSD && (
          <p style={{ 
            margin: '15px 0 0 0', 
            color: '#666', 
            fontSize: isMobile ? '14px' : '16px'
          }}>
            = {dividendKRW.toLocaleString()}원 (오늘 환율 기준)
          </p>
        )}
      </div>

      {/* 🔥 결과 - 모바일에서 세로 배치 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',  // 🔥 모바일 1열
        gap: isMobile ? '15px' : '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white',
          padding: isMobile ? '25px' : '30px',
          borderRadius: '15px',
          textAlign: 'center'
        }}>
          <p style={{ 
            margin: 0, 
            fontSize: isMobile ? '13px' : '14px',
            opacity: 0.9,
            whiteSpace: isMobile ? 'nowrap' : 'normal'  // 🔥 한 줄 유지
          }}>
            해외 원천징수세 (15%)
          </p>
          <p style={{ 
            margin: '10px 0 0 0', 
            fontSize: isMobile ? '28px' : '32px',
            fontWeight: 'bold' 
          }}>
            -{foreignTax.toLocaleString()}원
          </p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
          color: '#333',
          padding: isMobile ? '25px' : '30px',
          borderRadius: '15px',
          textAlign: 'center'
        }}>
          <p style={{ 
            margin: 0, 
            fontSize: isMobile ? '13px' : '14px',
            whiteSpace: isMobile ? 'nowrap' : 'normal'  // 🔥 한 줄 유지
          }}>
            국내 배당소득세 (15.4%)
          </p>
          <p style={{ 
            margin: '10px 0 0 0', 
            fontSize: isMobile ? '28px' : '32px',
            fontWeight: 'bold' 
          }}>
            -{domesticTax.toLocaleString()}원
          </p>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        color: 'white',
        padding: isMobile ? '30px' : '40px',
        borderRadius: '15px',
        textAlign: 'center'
      }}>
        <p style={{ 
          margin: 0, 
          fontSize: isMobile ? '14px' : '16px',
          opacity: 0.9 
        }}>
         실제 수령액
        </p>
        <p style={{ 
          margin: '15px 0', 
          fontSize: isMobile ? '36px' : '48px',
          fontWeight: 'bold' 
        }}>
          {actualIncome.toLocaleString()}원
        </p>
        <p style={{ 
          margin: 0, 
          fontSize: isMobile ? '12px' : '14px',
          opacity: 0.8 
        }}>
          실효세율: {dividendKRW > 0 ? ((foreignTax + domesticTax) / dividendKRW * 100).toFixed(2) : 0}%
        </p>
      </div>
    </div>
  );
}

// ============================================
// 🎯 목표 달성률 페이지
// ============================================
function GoalTrackerPage({ stocks }) {
  const [monthlyGoal, setMonthlyGoal] = useState(
    localStorage.getItem('monthlyGoal') || '500000'
  );
  const [isEditing, setIsEditing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);  // 🔥 추가

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 480;  // 🔥 추가

  // 현재 월 배당 계산
const currentMonthlyDividend = stocks.reduce((sum, stock) => {
  const price = parseFloat(stock.currentPrice) || 0;
  const shares = parseFloat(stock.shares) || 0;
  const rate = parseFloat(stock.dividendRate) || 0;
  const annualDividend = price * shares * rate / 100;
  return sum + (annualDividend / 12);
}, 0);

  // 환율 적용 (대략 1380원)
  const currentMonthlyKRW = Math.round(currentMonthlyDividend * 1380);
  const goalKRW = Math.round(parseFloat(monthlyGoal));
  const achievementRate = (currentMonthlyKRW / goalKRW * 100).toFixed(1);

  const saveGoal = () => {
    localStorage.setItem('monthlyGoal', monthlyGoal);
    setIsEditing(false);
    alert('목표가 저장되었습니다!');
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 30px 0', color: '#2c3e50' }}>목표 달성률</h1>

      {/* 목표 설정 카드 */}
      <div style={{
        background: 'white',
        padding: isMobile ? '20px' : '30px',
        borderRadius: '8px',
        marginBottom: '30px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          color: '#34495e',
          fontSize: isMobile ? '18px' : '24px'
        }}>
          월 배당 목표
        </h2>
        
        {isEditing ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            gap: '10px', 
            alignItems: isMobile ? 'stretch' : 'center'
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="number"
                value={monthlyGoal}
                onChange={(e) => setMonthlyGoal(e.target.value)}
                style={{
                  padding: isMobile ? '10px' : '12px',
                  fontSize: isMobile ? '16px' : '18px',
                  border: '2px solid #3498db',
                  borderRadius: '5px',
                  flex: 1,
                  minWidth: 0
                }}
              />
              <span style={{ fontSize: isMobile ? '16px' : '18px' }}>원</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={saveGoal}
                style={{
                  flex: 1,
                  padding: isMobile ? '10px 20px' : '12px 24px',
                  background: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: isMobile ? '14px' : '16px'
                }}
              >
                저장
              </button>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  flex: 1,
                  padding: isMobile ? '10px 20px' : '12px 24px',
                  background: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: isMobile ? '14px' : '16px'
                }}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            gap: '15px', 
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <p style={{ 
              margin: 0, 
              fontSize: isMobile ? '28px' : '32px',
              fontWeight: 'bold', 
              color: '#2c3e50' 
            }}>
              {parseFloat(monthlyGoal).toLocaleString()}원
            </p>
            <button
              onClick={() => setIsEditing(true)}
              style={{
                padding: '8px 15px',
                background: '#ecf0f1',
                color: '#2c3e50',
                border: '1px solid #dfe6e9',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: isMobile ? '13px' : '14px'
              }}
            >
              <i className="fa-regular fa-pen-to-square"></i> 수정
            </button>
          </div>
        )}
      </div>

      {/* 달성률 카드 */}
      <div style={{
        background: parseFloat(achievementRate) >= 100 ? '#2ecc71' : '#3498db',
        color: 'white',
        padding: isMobile ? '30px 20px' : '40px',
        borderRadius: '8px',
        marginBottom: '30px',
        textAlign: 'center'
      }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          fontSize: isMobile ? '20px' : '24px'
        }}>
          현재 달성률
        </h2>
        <p style={{ 
          margin: '0 0 10px 0', 
          fontSize: isMobile ? '56px' : '72px',
          fontWeight: 'bold' 
        }}>
          {achievementRate}%
        </p>
        <p style={{ 
          margin: 0, 
          fontSize: isMobile ? '14px' : '18px',
          opacity: 0.9 
        }}>
          {parseFloat(achievementRate) >= 100 
            ? '🎉 목표 달성!' 
            : `목표까지 ${(goalKRW - currentMonthlyKRW).toLocaleString()}원 남음`}
        </p>
      </div>

      {/* 🔥 현황 상세 - 모바일 세로 배치 */}
      <div style={{
        background: 'white',
        padding: isMobile ? '20px' : '30px',
        borderRadius: '8px',
        marginBottom: '30px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          color: '#34495e',
          fontSize: isMobile ? '18px' : '24px'
        }}>
          평균 월 배당 현황 (세전)
        </h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',  // 🔥 모바일 1열
          gap: isMobile ? '15px' : '20px'
        }}>
          <div style={{ 
            padding: isMobile ? '18px' : '20px',
            background: '#ecf0f1', 
            borderRadius: '5px',
            textAlign: 'center'
          }}>
            <p style={{ 
              margin: '0 0 10px 0', 
              color: '#7f8c8d', 
              fontSize: isMobile ? '12px' : '14px'
            }}>
              현재 월 배당 (12개월/연간 금액)
            </p>
            <p style={{ 
              margin: 0, 
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 'bold', 
              color: '#2c3e50' 
            }}>
              {Math.round(currentMonthlyKRW).toLocaleString()}원
            </p>
            <p style={{ 
              margin: '5px 0 0 0', 
              fontSize: isMobile ? '12px' : '14px',
              color: '#7f8c8d' 
            }}>
              (${currentMonthlyDividend.toFixed(2)})
            </p>
          </div>

          <div style={{ 
            padding: isMobile ? '18px' : '20px',
            background: '#ecf0f1', 
            borderRadius: '5px',
            textAlign: 'center'
          }}>
            <p style={{ 
              margin: '0 0 10px 0', 
              color: '#7f8c8d', 
              fontSize: isMobile ? '12px' : '14px'
            }}>
              목표까지
            </p>
            <p style={{ 
              margin: 0, 
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 'bold', 
              color: parseFloat(achievementRate) >= 100 ? '#2ecc71' : '#e74c3c' 
            }}>
              {parseFloat(achievementRate) >= 100 ? '+' : ''}{Math.round(currentMonthlyKRW - goalKRW).toLocaleString()}원
            </p>
          </div>
        </div>
      </div>

      {/* 진행 바 */}
      <div style={{
        background: 'white',
        padding: isMobile ? '20px' : '30px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          color: '#34495e',
          fontSize: isMobile ? '18px' : '24px'
        }}>
          목표까지의 여정
        </h2>
        
        <div style={{
          height: isMobile ? '30px' : '40px',
          background: '#ecf0f1',
          borderRadius: isMobile ? '15px' : '20px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(parseFloat(achievementRate), 100)}%`,
            background: parseFloat(achievementRate) >= 100 
              ? 'linear-gradient(90deg, #2ecc71 0%, #27ae60 100%)' 
              : 'linear-gradient(90deg, #3498db 0%, #2980b9 100%)',
            transition: 'width 1s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: isMobile ? '10px' : '15px',
            color: 'white',
            fontWeight: 'bold',
            fontSize: isMobile ? '12px' : '14px'
          }}>
            {parseFloat(achievementRate) > 10 && achievementRate + '%'}
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: '10px' 
        }}>
          <span style={{ 
            fontSize: isMobile ? '11px' : '14px',
            color: '#7f8c8d' 
          }}>
            0원
          </span>
          <span style={{ 
            fontSize: isMobile ? '11px' : '14px',
            color: '#7f8c8d' 
          }}>
            {goalKRW.toLocaleString()}원
          </span>
        </div>
      </div>

      {/* 종목별 기여도 */}
      {stocks.length > 0 && (
        <div style={{
          background: 'white',
          padding: isMobile ? '20px' : '30px',
          borderRadius: '8px',
          marginTop: '30px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ 
            margin: '0 0 20px 0', 
            color: '#34495e',
            fontSize: isMobile ? '18px' : '24px'
          }}>
            종목별 기여도
          </h2>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: isMobile ? '13px' : '16px'
            }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ecf0f1' }}>
                  <th style={{ 
                    padding: isMobile ? '10px 8px' : '12px',
                    textAlign: 'left', 
                    color: '#7f8c8d',
                    fontSize: isMobile ? '12px' : '14px'
                  }}>
                    종목
                  </th>
                  <th style={{ 
                    padding: isMobile ? '10px 8px' : '12px',
                    textAlign: 'right', 
                    color: '#7f8c8d',
                    fontSize: isMobile ? '12px' : '14px'
                  }}>
                    월 배당
                  </th>
                  <th style={{ 
                    padding: isMobile ? '10px 8px' : '12px',
                    textAlign: 'right', 
                    color: '#7f8c8d',
                    fontSize: isMobile ? '12px' : '14px'
                  }}>
                    기여율
                  </th>
                </tr>
              </thead>
              <tbody>
                {stocks
                  .map(stock => {
  const price = parseFloat(stock.currentPrice) || 0;
  const shares = parseFloat(stock.shares) || 0;
  const rate = parseFloat(stock.dividendRate) || 0;
  const annualDiv = price * shares * rate / 100;
  const monthlyDiv = Math.round(annualDiv / 12 * 1380);
  const contribution = currentMonthlyKRW > 0 
    ? (monthlyDiv / currentMonthlyKRW * 100).toFixed(1)
    : '0.0';
  return { ...stock, monthlyDiv, contribution };
})
                  .sort((a, b) => b.monthlyDiv - a.monthlyDiv)
                  .map(stock => (
                    <tr key={stock.id} style={{ borderBottom: '1px solid #ecf0f1' }}>
                      <td style={{ 
                        padding: isMobile ? '10px 8px' : '12px',
                        fontWeight: '600', 
                        color: '#2c3e50',
                        fontSize: isMobile ? '13px' : '16px'
                      }}>
                        {stock.ticker}
                      </td>
                      <td style={{ 
                        padding: isMobile ? '10px 8px' : '12px',
                        textAlign: 'right', 
                        color: '#2c3e50',
                        fontSize: isMobile ? '13px' : '16px'
                      }}>
                        {stock.monthlyDiv.toLocaleString()}원
                      </td>
                      <td style={{ 
                        padding: isMobile ? '10px 8px' : '12px',
                        textAlign: 'right' 
                      }}>
                        <span style={{
                          background: '#3498db',
                          color: 'white',
                          padding: isMobile ? '3px 10px' : '4px 12px',
                          borderRadius: '12px',
                          fontSize: isMobile ? '11px' : '13px',
                          fontWeight: '600'
                        }}>
                          {stock.contribution}%
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}



// ============================================
// 📰 배당 뉴스 페이지
// ============================================
function DividendNewsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [newsData, setNewsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

    return (
    <div>
      <h1 style={{ margin: '0 0 30px 0', color: '#2c3e50' }}>배당 뉴스</h1>
      <div style={{
        background: '#fff3cd',
        padding: '40px',
        borderRadius: '8px',
        textAlign: 'center',
        border: '1px solid #ffc107'
      }}>
        <p style={{ margin: '0 0 15px 0', fontSize: '48px' }}>📰</p>
        <p style={{ margin: 0, color: '#856404', fontSize: '16px', lineHeight: '1.6' }}>
          <strong>배당 뉴스 기능은 준비 중입니다.</strong><br/><br/>
          Restrict News API Delivery Policy<br/>
          
        </p>
      </div>
    </div>
  );

  // 🔥 GNews API로 뉴스 가져오기
  const fetchNews = async () => {
    setLoading(true);
    setError(null);

    try {
      const API_KEY = process.env.REACT_APP_GNEWS_API_KEY;  // 🔥 변경
      
      if (!API_KEY) {
        throw new Error('GNews API 키가 설정되지 않았습니다.');
      }

      // 검색 키워드 설정
      let keyword = 'dividend stocks';
      if (selectedCategory === 'dividend-increase') keyword = 'dividend increase';
      if (selectedCategory === 'dividend-cut') keyword = 'dividend cut';
      if (selectedCategory === 'high-yield') keyword = 'high yield dividend';
      if (selectedCategory === 'tax') keyword = 'dividend tax';

      // 🔥 GNews API URL
      const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(keyword)}&lang=en&max=20&apikey=${API_KEY}`;

      console.log('🔄 GNews API 호출 중...', keyword);

      const response = await fetch(url);
      const data = await response.json();

      console.log('GNews 응답:', data);

      // 🔥 GNews는 data.articles로 바로 접근
      if (data.articles && Array.isArray(data.articles)) {
        // API 데이터를 우리 형식으로 변환
        const formattedNews = data.articles.map((article, index) => ({
          id: index,
          category: selectedCategory === 'all' ? 'market-analysis' : selectedCategory,
          title: article.title,
          summary: article.description || article.content?.substring(0, 150) + '...',
          date: new Date(article.publishedAt).toISOString().split('T')[0],
          source: article.source?.name || 'Unknown',  // 🔥 안전한 접근
          ticker: null,
          image: article.image ? '📰' : '📄',  // 🔥 image 필드 사용
          imageUrl: article.image,  // 🔥 실제 이미지 URL
          url: article.url
        }));

        setNewsData(formattedNews);
        console.log('✅ 뉴스 로드 완료:', formattedNews.length, '개');
      } else if (data.errors) {
        // 🔥 GNews 에러 처리
        throw new Error(data.errors[0] || '뉴스를 가져올 수 없습니다.');
      } else {
        throw new Error('뉴스를 가져올 수 없습니다.');
      }
    } catch (err) {
      console.error('❌ 뉴스 API 오류:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 로드 시 + 카테고리 변경 시 뉴스 가져오기
  useEffect(() => {
    fetchNews();
  }, [selectedCategory]);

  const categories = [
    { id: 'all', name: '전체', icon: '📰' },
    { id: 'dividend-increase', name: '배당 증액', icon: '📈' },
    { id: 'dividend-cut', name: '배당 감축', icon: '📉' },
    { id: 'high-yield', name: '고배당주', icon: '💰' },
    { id: 'tax', name: '세금/절세', icon: '💸' }
  ];

  // 검색 필터링
  const filteredNews = newsData.filter(news => {
    const matchSearch = news.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       news.summary.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
  });

  return (
    <div>
      <h1 style={{ margin: '0 0 30px 0', color: '#2c3e50' }}>배당 뉴스</h1>

      {/* 검색 및 필터 */}
      <div style={{
        background: 'white',
        padding: '25px',
        borderRadius: '8px',
        marginBottom: '30px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        {/* 검색창 */}
        <input
          type="text"
          placeholder="🔍 뉴스 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '15px',
            border: '2px solid #ecf0f1',
            borderRadius: '8px',
            fontSize: '16px',
            marginBottom: '20px',
            boxSizing: 'border-box'
          }}
        />

        {/* 카테고리 필터 */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: selectedCategory === cat.id ? '#3498db' : '#ecf0f1',
                color: selectedCategory === cat.id ? 'white' : '#2c3e50',
                border: 'none',
                borderRadius: '20px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s',
                opacity: loading ? 0.5 : 1
              }}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div style={{
          background: 'white',
          padding: '60px',
          borderRadius: '8px',
          textAlign: 'center',
          color: '#3498db'
        }}>
          <p style={{ fontSize: '48px', margin: 0 }}>⏳</p>
          <p style={{ fontSize: '18px', margin: '20px 0 0 0' }}>
            뉴스를 불러오는 중...
          </p>
        </div>
      )}

      {/* 에러 상태 */}
      {error && (
        <div style={{
          background: '#fee',
          padding: '30px',
          borderRadius: '8px',
          marginBottom: '30px',
          border: '2px solid #e74c3c'
        }}>
          <p style={{ margin: 0, color: '#c0392b', fontWeight: 'bold' }}>
            ❌ 오류: {error}
          </p>
          <button
            onClick={fetchNews}
            style={{
              marginTop: '15px',
              padding: '10px 20px',
              background: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 뉴스 리스트 */}
      {!loading && !error && (
        <div style={{ display: 'grid', gap: '20px' }}>
          {filteredNews.length === 0 ? (
            <div style={{
              background: 'white',
              padding: '60px',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#95a5a6'
            }}>
              <p style={{ fontSize: '48px', margin: 0 }}>📰</p>
              <p style={{ fontSize: '18px', margin: '20px 0 0 0' }}>
                검색 결과가 없습니다
              </p>
            </div>
          ) : (
            filteredNews.map(news => (
              <div
                key={news.id}
                onClick={() => window.open(news.url, '_blank')}
                style={{
                  background: 'white',
                  padding: '25px',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ display: 'flex', gap: '20px' }}>
                  {/* 아이콘/이미지 */}
                  <div style={{
                    fontSize: '48px',
                    flexShrink: 0
                  }}>
                    {news.imageUrl ? (
                      <img 
                        src={news.imageUrl} 
                        alt={news.title}
                        style={{
                          width: '80px',
                          height: '80px',
                          objectFit: 'cover',
                          borderRadius: '8px'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.textContent = '📰';
                        }}
                      />
                    ) : (
                      news.image
                    )}
                  </div>

                  {/* 내용 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: '10px' }}>
                      <span style={{
                        background: '#3498db',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {categories.find(c => c.id === news.category)?.name || '뉴스'}
                      </span>
                    </div>

                    <h3 style={{
                      margin: '0 0 10px 0',
                      color: '#2c3e50',
                      fontSize: '18px',
                      lineHeight: '1.4'
                    }}>
                      {news.title}
                    </h3>

                    <p style={{
                      margin: '0 0 15px 0',
                      color: '#7f8c8d',
                      lineHeight: '1.6',
                      fontSize: '14px'
                    }}>
                      {news.summary}
                    </p>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '13px',
                      color: '#95a5a6'
                    }}>
                      <span>{news.source}</span>
                      <span>{news.date}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* API 정보 */}
      <div style={{
        background: '#d1ecf1',
        padding: '20px',
        borderRadius: '8px',
        marginTop: '30px',
        border: '1px solid #bee5eb'
      }}>
        <p style={{ margin: 0, color: '#0c5460' }}>
          💡 <strong>GNews API 무료 플랜:</strong> 하루 100개 요청 제한. 
          실시간 뉴스가 표시됩니다. 뉴스를 클릭하면 원문으로 이동합니다.
        </p>
      </div>
    </div>
  );
}

// ============================================
// 🔥 인기 배당주 TOP 30 (수동 데이터 버전)
// ============================================
function PopularDividendStocksPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [sortBy, setSortBy] = useState('yield');

  // 🔥 TOP 30 배당주 (2026년 4월 기준 - 수동 데이터)
  const topStocksList = [
    // 기술주
    { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', dividendYield: 0.52, rating: 5, dividendMonths: [2, 5, 8, 11], consecutiveYears: 12 },
    { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology', dividendYield: 0.73, rating: 5, dividendMonths: [2, 5, 8, 11], consecutiveYears: 21 },
    { ticker: 'AVGO', name: 'Broadcom', sector: 'Technology', dividendYield: 1.8, rating: 4, dividendMonths: [3, 6, 9, 12], consecutiveYears: 13 },
    { ticker: 'CSCO', name: 'Cisco', sector: 'Technology', dividendYield: 3.1, rating: 4, dividendMonths: [1, 4, 7, 10], consecutiveYears: 12 },
    { ticker: 'IBM', name: 'IBM', sector: 'Technology', dividendYield: 3.8, rating: 4, dividendMonths: [3, 6, 9, 12], consecutiveYears: 28 },
    
    // 헬스케어
    { ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', dividendYield: 3.1, rating: 5, dividendMonths: [3, 6, 9, 12], consecutiveYears: 62 },
    { ticker: 'ABBV', name: 'AbbVie', sector: 'Healthcare', dividendYield: 3.5, rating: 5, dividendMonths: [2, 5, 8, 11], consecutiveYears: 11 },
    { ticker: 'PFE', name: 'Pfizer', sector: 'Healthcare', dividendYield: 5.9, rating: 4, dividendMonths: [3, 6, 9, 12], consecutiveYears: 14 },
    { ticker: 'MRK', name: 'Merck', sector: 'Healthcare', dividendYield: 2.8, rating: 4, dividendMonths: [1, 4, 7, 10], consecutiveYears: 13 },
    { ticker: 'BMY', name: 'Bristol Myers', sector: 'Healthcare', dividendYield: 4.2, rating: 4, dividendMonths: [2, 5, 8, 11], consecutiveYears: 15 },
    
    // 생필품
    { ticker: 'KO', name: 'Coca-Cola', sector: 'Consumer Staples', dividendYield: 3.05, rating: 5, dividendMonths: [1, 4, 7, 10], consecutiveYears: 63 },
    { ticker: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', dividendYield: 2.42, rating: 5, dividendMonths: [2, 5, 8, 11], consecutiveYears: 68 },
    { ticker: 'PEP', name: 'PepsiCo', sector: 'Consumer Staples', dividendYield: 2.9, rating: 5, dividendMonths: [1, 3, 6, 9], consecutiveYears: 51 },
    { ticker: 'PM', name: 'Philip Morris', sector: 'Consumer Staples', dividendYield: 5.1, rating: 4, dividendMonths: [1, 4, 7, 10], consecutiveYears: 15 },
    { ticker: 'MO', name: 'Altria', sector: 'Consumer Staples', dividendYield: 8.2, rating: 4, dividendMonths: [1, 4, 7, 10], consecutiveYears: 54 },
    
    // 금융
    { ticker: 'JPM', name: 'JPMorgan Chase', sector: 'Financials', dividendYield: 2.3, rating: 5, dividendMonths: [1, 4, 7, 10], consecutiveYears: 13 },
    { ticker: 'BAC', name: 'Bank of America', sector: 'Financials', dividendYield: 2.5, rating: 4, dividendMonths: [3, 6, 9, 12], consecutiveYears: 11 },
    { ticker: 'WFC', name: 'Wells Fargo', sector: 'Financials', dividendYield: 2.7, rating: 4, dividendMonths: [3, 6, 9, 12], consecutiveYears: 12 },
    { ticker: 'GS', name: 'Goldman Sachs', sector: 'Financials', dividendYield: 2.4, rating: 4, dividendMonths: [3, 6, 9, 12], consecutiveYears: 9 },
    
    // 에너지
    { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy', dividendYield: 3.4, rating: 5, dividendMonths: [3, 6, 9, 12], consecutiveYears: 41 },
    { ticker: 'CVX', name: 'Chevron', sector: 'Energy', dividendYield: 3.8, rating: 5, dividendMonths: [3, 6, 9, 12], consecutiveYears: 37 },
    { ticker: 'COP', name: 'ConocoPhillips', sector: 'Energy', dividendYield: 3.2, rating: 4, dividendMonths: [3, 6, 9, 12], consecutiveYears: 33 },
    
    // 통신/유틸리티
    { ticker: 'VZ', name: 'Verizon', sector: 'Telecom', dividendYield: 6.5, rating: 4, dividendMonths: [2, 5, 8, 11], consecutiveYears: 18 },
    { ticker: 'T', name: 'AT&T', sector: 'Telecom', dividendYield: 4.8, rating: 3, dividendMonths: [2, 5, 8, 11], consecutiveYears: 40 },
    { ticker: 'NEE', name: 'NextEra Energy', sector: 'Utilities', dividendYield: 2.6, rating: 5, dividendMonths: [3, 6, 9, 12], consecutiveYears: 29 },
    { ticker: 'DUK', name: 'Duke Energy', sector: 'Utilities', dividendYield: 4.1, rating: 4, dividendMonths: [3, 6, 9, 12], consecutiveYears: 18 },
    
    // 리츠
    { ticker: 'O', name: 'Realty Income', sector: 'REITs', dividendYield: 5.2, rating: 4, dividendMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], consecutiveYears: 29 },
    { ticker: 'STAG', name: 'Stag Industrial', sector: 'REITs', dividendYield: 4.3, rating: 4, dividendMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], consecutiveYears: 12 },
    { ticker: 'WPC', name: 'W.P. Carey', sector: 'REITs', dividendYield: 5.8, rating: 4, dividendMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], consecutiveYears: 27 },
    { ticker: 'MPW', name: 'Medical Properties', sector: 'REITs', dividendYield: 9.5, rating: 3, dividendMonths: [1, 4, 7, 10], consecutiveYears: 11 }
  ];

  // 정렬
  const sortedStocks = [...topStocksList].sort((a, b) => {
    if (sortBy === 'yield') return b.dividendYield - a.dividendYield;
    if (sortBy === 'growth') return b.consecutiveYears - a.consecutiveYears;
    if (sortBy === 'popularity') return a.rating - b.rating;
    return 0;
  });

  // 해당 월에 배당 지급하는 종목
  const monthStocks = sortedStocks.filter(stock => 
    stock.dividendMonths && stock.dividendMonths.includes(selectedMonth)
  );

  const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  return (
    <div>
      {/* 헤더 */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>인기 배당주 TOP 30</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#95a5a6' }}>
          <i className='fa-solid fa-calendar-check'></i> 데이터 기준: 2026년 4월 10일
        </p>
      </div>

      {/* 정렬 옵션 */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '30px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        display: 'flex',
        gap: '15px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <span style={{ color: '#2c3e50', fontWeight: '600' }}>정렬:</span>
        <button
          onClick={() => setSortBy('yield')}
          style={{
            padding: '10px 20px',
            background: sortBy === 'yield' ? '#3498db' : '#ecf0f1',
            color: sortBy === 'yield' ? 'white' : '#2c3e50',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          💰 배당률
        </button>
        <button
          onClick={() => setSortBy('growth')}
          style={{
            padding: '10px 20px',
            background: sortBy === 'growth' ? '#3498db' : '#ecf0f1',
            color: sortBy === 'growth' ? 'white' : '#2c3e50',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          📈 연속증가
        </button>
        <button
          onClick={() => setSortBy('popularity')}
          style={{
            padding: '10px 20px',
            background: sortBy === 'popularity' ? '#3498db' : '#ecf0f1',
            color: sortBy === 'popularity' ? 'white' : '#2c3e50',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          ⭐ 평점
        </button>
      </div>

      {/* 종목 카드 그리드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '40px'
      }}>
        {sortedStocks.map((stock, index) => (
          <div
            key={stock.ticker}
            style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              position: 'relative',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}
          >
            {/* 순위 배지 */}
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: index < 5 ? '#f39c12' : '#95a5a6',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              #{index + 1}
            </div>

            {/* 종목명 */}
            <h3 style={{ margin: '0 0 5px 0', color: '#2c3e50', fontSize: '18px' }}>
              {stock.ticker}
            </h3>
            <p style={{ margin: '0 0 8px 0', color: '#7f8c8d', fontSize: '13px' }}>
              {stock.name}
            </p>
            <span style={{
              display: 'inline-block',
              padding: '3px 8px',
              background: '#ecf0f1',
              borderRadius: '10px',
              fontSize: '11px',
              color: '#2c3e50',
              marginBottom: '15px'
            }}>
              {stock.sector}
            </span>

            {/* 주요 지표 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '12px',
              marginBottom: '15px'
            }}>
              {/* 배당률 */}
              <div style={{
                padding: '12px',
                background: '#e8f5e9',
                borderRadius: '8px'
              }}>
                <p style={{ margin: '0 0 3px 0', fontSize: '11px', color: '#2c3e50', fontWeight: '600' }}>
                  💰 배당률
                </p>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#2ecc71' }}>
                  {stock.dividendYield}%
                </p>
              </div>

              {/* 연속 증배 - 주석 처리
              <div>
                <p style={{ margin: '0 0 3px 0', fontSize: '11px', color: '#7f8c8d' }}>연속 증배</p>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#e67e22' }}>
                  {stock.consecutiveYears}년
                </p>
              </div>
              */}

              {/* 현재가 - 주석 처리
              <div>
                <p style={{ margin: '0 0 3px 0', fontSize: '11px', color: '#7f8c8d' }}>현재가</p>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#2c3e50' }}>
                  -
                </p>
              </div>
              */}
            </div>

            {/* 배당 지급월 */}
            <div style={{ marginBottom: '12px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#7f8c8d', fontWeight: '600' }}>
                📅 배당 지급월
              </p>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {stock.dividendMonths && stock.dividendMonths.length > 0 ? (
                  stock.dividendMonths.length === 12 ? (
                    <span style={{
                      padding: '5px 10px',
                      background: '#2ecc71',
                      color: 'white',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      💰 매월 배당
                    </span>
                  ) : (
                    stock.dividendMonths.map(month => (
                      <span
                        key={month}
                        style={{
                          padding: '4px 8px',
                          background: '#3498db',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '600'
                        }}
                      >
                        {month}월
                      </span>
                    ))
                  )
                ) : (
                  <span style={{ color: '#95a5a6', fontSize: '11px' }}>-</span>
                )}
              </div>
            </div>

            {/* 평점 */}
            <div style={{
              paddingTop: '12px',
              borderTop: '1px solid #ecf0f1',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '16px' }}>
                {'⭐'.repeat(stock.rating)}{'☆'.repeat(5 - stock.rating)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 월별 배당 캘린더 */}
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>월별 배당 캘린더</h2>
        
        {/* 월 선택 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {months.map((month, index) => (
            <button
              key={index}
              onClick={() => setSelectedMonth(index + 1)}
              style={{
                padding: '8px 16px',
                background: selectedMonth === index + 1 ? '#3498db' : '#ecf0f1',
                color: selectedMonth === index + 1 ? 'white' : '#2c3e50',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px'
              }}
            >
              {month}
            </button>
          ))}
        </div>

        {/* 해당 월 종목 리스트 */}
        <h3 style={{ margin: '0 0 15px 0', color: '#34495e', fontSize: '16px' }}>
          {months[selectedMonth - 1]} 배당 지급 ({monthStocks.length}개)
        </h3>
        
        {monthStocks.length === 0 ? (
          <p style={{ color: '#95a5a6', textAlign: 'center', padding: '30px' }}>
            이 달에 배당을 지급하는 종목이 없습니다.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {monthStocks.map(stock => (
              <div
                key={stock.ticker}
                style={{
                  padding: '12px',
                  background: '#f8f9fa',
                  borderRadius: '5px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <strong style={{ color: '#2c3e50', fontSize: '14px' }}>
                    {stock.ticker}
                  </strong>
                  <span style={{ marginLeft: '8px', color: '#7f8c8d', fontSize: '13px' }}>
                    {stock.name}
                  </span>
                  <div style={{ marginTop: '4px', fontSize: '11px', color: '#95a5a6' }}>
                    {stock.sector} • {stock.consecutiveYears}년 연속 증배
                  </div>
                </div>
                <span style={{ color: '#2ecc71', fontWeight: 'bold', fontSize: '14px' }}>
                  {stock.dividendYield}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 데이터 안내 */}
      
    <div style={{
        background: '#fff3cd',
        padding: '20px',
        borderRadius: '8px',
        marginTop: '30px',
        border: '1px solid #ffc107'
        }}>
        <p style={{ margin: '0 0 8px 0', color: '#856404', fontWeight: 'bold', fontSize: '14px' }}>
          📊 데이터 안내
        </p>
        <p style={{ margin: 0, color: '#856404', fontSize: '13px', lineHeight: '1.6' }}>
          • 배당률 및 배당 지급월은 2026년 4월 10일 기준입니다.<br/>
          • 실제 배당 금액 및 지급일은 기업 공시를 확인하세요.<br/>
          • 배당 지급월은 일반적인 패턴이며 변경될 수 있습니다.
        </p>
      </div>
    </div>
  );
}

// ============================================
// 👔 투자 거장 포트폴리오 (2025 Q1 기준)
// ============================================
function InvestorLegendsPage() {
  const [selectedInvestor, setSelectedInvestor] = useState('buffett');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 480;

  // 🔥 투자 거장 데이터 (분기별 수동 업데이트)
  const investors = {
    buffett: {
    name: '워렌 버핏',
    company: 'Berkshire Hathaway',
    strategy: '가치 투자, 장기 보유',
    description: '세계에서 가장 성공한 투자자. "영원히 보유할 기업이 아니면 10분도 보유하지 마라"',
    totalValue: 385000000000, // $385B (2025 Q4)
    quarter: '2025 Q4',
    lastUpdated: '2026-02-14',
    holdings: [
      { ticker: 'AAPL', name: 'Apple Inc.', value: 182000000000, percent: 47.3, shares: 915560000, change: 0 },
      { ticker: 'BAC', name: 'Bank of America', value: 31200000000, percent: 8.1, shares: 1032852000, change: 0.5 },
      { ticker: 'AXP', name: 'American Express', value: 28500000000, percent: 7.4, shares: 151610000, change: 0.8 },
      { ticker: 'KO', name: 'Coca-Cola', value: 25600000000, percent: 6.6, shares: 400000000, change: 0 },
      { ticker: 'CVX', name: 'Chevron', value: 21800000000, percent: 5.7, shares: 132100000, change: 0.3 },
      { ticker: 'OXY', name: 'Occidental Petroleum', value: 15200000000, percent: 3.9, shares: 248500000, change: 2.1 },
      { ticker: 'KHC', name: 'Kraft Heinz', value: 11800000000, percent: 3.1, shares: 325634818, change: 0 },
      { ticker: 'MCO', name: "Moody's", value: 9400000000, percent: 2.4, shares: 24669778, change: 0 },
      { ticker: 'HPQ', name: 'HP Inc.', value: 5200000000, percent: 1.4, shares: 104476508, change: 0.7 },
      { ticker: 'CHTR', name: 'Charter Communications', value: 4800000000, percent: 1.2, shares: 7456000, change: -0.3 }
    ]
  },
  ackman: {
    name: '빌 애크먼',
    company: 'Pershing Square',
    strategy: '집중 투자, 행동주의',
    description: '대형주 집중 투자. 평균 보유 기간 5-7년의 장기 투자자',
    totalValue: 14200000000, // $14.2B
    quarter: '2025 Q4',
    lastUpdated: '2026-02-14',
    holdings: [
      { ticker: 'CMG', name: 'Chipotle', value: 3800000000, percent: 26.8, shares: 1845220, change: 1.2 },
      { ticker: 'HLT', name: 'Hilton', value: 3100000000, percent: 21.8, shares: 12346789, change: 0.8 },
      { ticker: 'QSR', name: 'Restaurant Brands', value: 2200000000, percent: 15.5, shares: 28500000, change: 0 },
      { ticker: 'LOW', name: "Lowe's", value: 1900000000, percent: 13.4, shares: 6234567, change: 0.5 },
      { ticker: 'BRK.B', name: 'Berkshire Hathaway', value: 1600000000, percent: 11.3, shares: 3500000, change: 3.2 },
      { ticker: 'HHH', name: 'Howard Hughes', value: 1000000000, percent: 7.0, shares: 11234567, change: 0 },
      { ticker: 'PSH', name: 'Pershing Square Holdings', value: 600000000, percent: 4.2, shares: 15000000, change: 0 }
    ]
  },
  dalio: {
    name: '레이 달리오',
    company: 'Bridgewater Associates',
    strategy: '올웨더 포트폴리오, 분산 투자',
    description: '세계 최대 헤지펀드 운용. "성공은 실패에서 배우는 능력에서 온다"',
    totalValue: 112000000000, // $112B
    quarter: '2025 Q4',
    lastUpdated: '2026-02-14',
    holdings: [
      { ticker: 'SPY', name: 'SPDR S&P 500 ETF', value: 9800000000, percent: 8.8, shares: 18500000, change: 1.2 },
      { ticker: 'VWO', name: 'Vanguard Emerging Markets', value: 7800000000, percent: 7.0, shares: 176000000, change: 0.8 },
      { ticker: 'EEM', name: 'iShares Emerging Markets', value: 7100000000, percent: 6.3, shares: 158000000, change: 0.5 },
      { ticker: 'GLD', name: 'SPDR Gold Trust', value: 6500000000, percent: 5.8, shares: 30500000, change: 3.2 },
      { ticker: 'TLT', name: 'iShares 20+ Treasury', value: 5200000000, percent: 4.6, shares: 53000000, change: 0.8 },
      { ticker: 'NVDA', name: 'NVIDIA', value: 4100000000, percent: 3.7, shares: 28500000, change: 5.6 },
      { ticker: 'PG', name: 'Procter & Gamble', value: 3600000000, percent: 3.2, shares: 20800000, change: 0 },
      { ticker: 'JNJ', name: 'Johnson & Johnson', value: 3300000000, percent: 2.9, shares: 19200000, change: 0 },
      { ticker: 'KO', name: 'Coca-Cola', value: 2900000000, percent: 2.6, shares: 45600000, change: 0 },
      { ticker: 'WMT', name: 'Walmart', value: 2700000000, percent: 2.4, shares: 14300000, change: 0.3 }
    ]
  },
  siegel: {
    name: '제레미 시겔',
    company: 'Wharton School',
    strategy: '배당성장 투자, 장기 복리',
    description: '배당재투자의 복리효과를 강조한 『주식에 장기투자하라』 저자. "배당은 거짓말을 하지 않는다"',
    totalValue: 50000000000, // 추정 $50B (교육 포트폴리오 모델)
    quarter: '2025 Q4',
    lastUpdated: '2026-02-14',
    holdings: [
      { ticker: 'JNJ', name: 'Johnson & Johnson', value: 8500000000, percent: 17.0, shares: 52800000, change: 0 },
      { ticker: 'PG', name: 'Procter & Gamble', value: 7200000000, percent: 14.4, shares: 45600000, change: 0.2 },
      { ticker: 'KO', name: 'Coca-Cola', value: 6800000000, percent: 13.6, shares: 106250000, change: 0 },
      { ticker: 'MCD', name: "McDonald's", value: 6000000000, percent: 12.0, shares: 22200000, change: 0.3 },
      { ticker: 'XOM', name: 'Exxon Mobil', value: 5500000000, percent: 11.0, shares: 47400000, change: 0.5 },
      { ticker: 'T', name: 'AT&T', value: 4200000000, percent: 8.4, shares: 210000000, change: -0.8 },
      { ticker: 'VZ', name: 'Verizon', value: 3800000000, percent: 7.6, shares: 95000000, change: 0 },
      { ticker: 'PEP', name: 'PepsiCo', value: 3500000000, percent: 7.0, shares: 20588000, change: 0.2 },
      { ticker: 'MO', name: 'Altria Group', value: 2500000000, percent: 5.0, shares: 50000000, change: 0 },
      { ticker: 'CVX', name: 'Chevron', value: 2000000000, percent: 4.0, shares: 12100000, change: 0.3 }
    ]
  }
};

  const current = investors[selectedInvestor];

  return (
    <div>
      <h1 style={{ margin: '0 0 30px 0', color: '#2c3e50' }}>투자 거장 포트폴리오</h1>

      {/* 투자자 선택 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '30px'
      }}>
        {Object.entries(investors).map(([key, investor]) => (
          <button
            key={key}
            onClick={() => setSelectedInvestor(key)}
            style={{
              padding: '20px',
              background: selectedInvestor === key ? '#3498db' : 'white',
              color: selectedInvestor === key ? 'white' : '#2c3e50',
              border: selectedInvestor === key ? 'none' : '2px solid #ecf0f1',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              transition: 'all 0.2s',
              boxShadow: selectedInvestor === key ? '0 4px 12px rgba(52,152,219,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
              textAlign: 'left'
            }}
          >
            <div style={{ fontSize: '16px', marginBottom: '5px' }}>{investor.name}</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>
              {investor.company}
            </div>
          </button>
        ))}
      </div>

      {/* 투자자 프로필 */}
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '8px',
        marginBottom: '30px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
              {current.name}
            </h2>
            <p style={{ margin: '0 0 5px 0', color: '#7f8c8d', fontSize: '14px' }}>
              {current.company}
            </p>
            <p style={{ margin: '0 0 15px 0', color: '#3498db', fontWeight: '600', fontSize: '14px' }}>
              💡 {current.strategy}
            </p>
            <p style={{ margin: 0, color: '#34495e', fontSize: '14px', fontStyle: 'italic', lineHeight: '1.6' }}>
              "{current.description}"
            </p>
          </div>
          <div style={{ textAlign: 'right', marginLeft: '30px' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#7f8c8d' }}>
              총 포트폴리오 가치
            </p>
            <p style={{ margin: '0 0 15px 0', fontSize: '32px', fontWeight: 'bold', color: '#2c3e50' }}>
              ${(current.totalValue / 1000000000).toFixed(1)}B
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#95a5a6' }}>
              📅 {current.quarter} 기준<br/>
              갱신: {current.lastUpdated}
            </p>
          </div>
        </div>
      </div>

      {/* 보유 종목 */}
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>
          TOP 보유 종목 ({current.holdings.length}개)
        </h2>

        <div style={{ display: 'grid', gap: '12px' }}>
         {current.holdings.map((holding, index) => (
  <div
    key={holding.ticker}
    style={{
      padding: '15px',
      background: '#f8f9fa',
      borderRadius: '8px',
      transition: 'all 0.2s',
      cursor: 'pointer'
    }}
    className="investor-holding-card"
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.background = '#e9ecef';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.background = '#f8f9fa';
    }}
  >
    {/* 🔥 첫 번째 줄: 순위 + 종목 정보 */}
    <div style={{
      display: 'flex',
      alignItems: 'center',
      marginBottom: '12px'
    }}>
      {/* 순위 배지 */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: index === 0 ? '#f39c12' : index < 3 ? '#95a5a6' : '#bdc3c7',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '13px',
        marginRight: '12px',
        flexShrink: 0
      }}>
        {index + 1}
      </div>

      {/* 종목 정보 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          flexWrap: 'wrap',
          marginBottom: '4px' 
        }}>
          <strong style={{ fontSize: '15px', color: '#2c3e50' }}>
            {holding.ticker}
          </strong>
          <span style={{ color: '#7f8c8d', fontSize: '13px' }}>
            {holding.name}
          </span>
          {holding.change !== 0 && (
            <span style={{
              fontSize: '11px',
              color: holding.change > 0 ? '#2ecc71' : '#e74c3c',
              fontWeight: '600'
            }}>
              {holding.change > 0 ? '▲' : '▼'} {Math.abs(holding.change)}%
            </span>
          )}
        </div>
        <div style={{ fontSize: '11px', color: '#95a5a6' }}>
          {holding.shares.toLocaleString()} 주
        </div>
      </div>
    </div>

    {/* 🔥 두 번째 줄: 비중 + 보유 가치 */}
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      paddingTop: '12px',
      borderTop: '1px solid #e0e0e0'
    }}>
      {/* 비중 */}
      <div>
        <div style={{ fontSize: '11px', color: '#7f8c8d', marginBottom: '4px' }}>
          비중
        </div>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3e50' }}>
          {holding.percent}%
        </div>
      </div>

      {/* 보유 가치 */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '11px', color: '#7f8c8d', marginBottom: '4px' }}>
          보유 가치
        </div>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2ecc71' }}>
          ${(holding.value / 1000000000).toFixed(2)}B
        </div>
      </div>
    </div>
  </div>
))}
        </div>
      </div>

      {/* 데이터 출처 안내 */}
      <div style={{
        background: '#d1ecf1',
        padding: '20px',
        borderRadius: '8px',
        marginTop: '30px',
        border: '1px solid #bee5eb'
      }}>
        <p style={{ margin: '0 0 10px 0', color: '#0c5460', fontWeight: 'bold', fontSize: '14px' }}>
          📊 데이터 출처 및 업데이트
        </p>
        <p style={{ margin: 0, color: '#0c5460', fontSize: '13px', lineHeight: '1.6' }}>
          • SEC 13F 보고서 (분기별 공시)<br/>
          • 출처: SEC EDGAR, WhaleWisdom, Dataroma<br/>
          • 업데이트: 분기 종료 후 45일 이내 (2월, 5월, 8월, 11월)<br/>
          • 실제 포트폴리오는 보고서 제출 시점과 다를 수 있습니다
        </p>
      </div>
    </div>
  );
}
// ============================================
// ⚙️ 설정
// ============================================
function SettingsPage({user}) {
  const deleteAllStocks = async () => {
    if (!window.confirm('⚠️ 정말 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다!')) {
      return;
    }

    try {
      const querySnapshot = await getDocs(collection(db, `users/${user.uid}/stocks`));
      const deletePromises = [];
      
      querySnapshot.forEach((document) => {
        deletePromises.push(deleteDoc(doc(db, `users/${user.uid}/stocks`, document.id)));
      });
      
      await Promise.all(deletePromises);
      
      console.log('✅ 모든 데이터 삭제 완료!');
      alert('모든 데이터가 삭제되었습니다.');
      window.location.reload();
    } catch (error) {
      console.error('❌ 삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 30px 0', color: '#333' }}>설정</h1>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '15px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ color: '#667eea', marginBottom: '20px' }}>데이터 관리</h2>
        
        <button
          onClick={deleteAllStocks}
          style={{
            padding: '15px 30px',
            background: '#ff4757',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => e.target.style.background = '#e84118'}
          onMouseLeave={(e) => e.target.style.background = '#ff4757'}
        >
          <i className="fa-solid fa-trash-can" style={{ fontSize: '16px' }}></i> 모든 데이터 삭제
        </button>
        
        <p style={{ marginTop: '15px', color: '#999', fontSize: '14px' }}>
           <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '14px' }}></i>이 작업은 되돌릴 수 없습니다.
        </p>
      </div>
    </div>
  );
}


// ============================================
// ℹ️ 법적 페이지
// ============================================
function LegalPages() {
  const [currentTab, setCurrentTab] = useState('about');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

   useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 480;

  const tabs = [
    { id: 'about', name: '소개', icon: '👋' },
    { id: 'privacy', name: '개인정보처리방침', icon: '🔒' },
    { id: 'terms', name: '이용약관', icon: '📋' },
    
  ];

  return (
    <div>
      <h1 style={{ margin: '0 0 30px 0', color: '#2c3e50' }}>사이트 정보</h1>

      {/* 탭 메뉴 */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '30px',
        borderBottom: '2px solid #ecf0f1'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id)}
            style={{
              padding: '15px 25px',
              background: currentTab === tab.id ? '#3498db' : 'transparent',
              color: currentTab === tab.id ? 'white' : '#2c3e50',
              border: 'none',
              borderBottom: currentTab === tab.id ? '3px solid #3498db' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: currentTab === tab.id ? '600' : '400',
              transition: 'all 0.2s'
            }}
          >
            {tab.icon} {tab.name}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div style={{
        background: 'white',
         padding: isMobile ? '20px' : '40px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        lineHeight: '1.8',
        fontSize: isMobile ? '13px' : '14px'
      }}>
        {currentTab === 'about' && <AboutPage />}
        {currentTab === 'privacy' && <PrivacyPage />}
        {currentTab === 'terms' && <TermsPage />}

      </div>
    </div>
  );
}

// 소개 페이지
function AboutPage() {
  return (
    <div>
      <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>미국 배당주 관리하기 시스템 소개(beta)</h2>
      
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#34495e' }}>우리의 목표</h3>
        <p>
          배당관리자는 개인 투자자들이 미국 배당주식 포트폴리오를 쉽고 보기 쉽게 관리할 수 있는 도구입니다.<br/>
          안정적인 현금 흐름과 월배당의 목표를 달성하기 위한 투자자들을 위해 만들어졌습니다.
        </p>
      </section>

        <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#34495e' }}>사용 안내</h3>
        <p>
          현재 로그인 기능이 없습니다.(개발 전)<br/>
          브라우저마다 고유 캐시 생성으로 내 종목이 저장되며 <br/>
          브라우저 캐시삭제, 시크릿창 사용, 기기 이동 시 데이터 저장이 불가합니다
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#34495e' }}>주요 기능</h3>
        <ul style={{ paddingLeft: '20px' }}>
          <li>주식과 채권 통합 관리</li>
          <li>실시간 주가 및 환율 연동</li>
          <li>월별 배당 캘린더 자동 생성</li>
          <li>배당세금 자동 계산</li>
          <li>목표 달성률 추적</li>
          <li>전문가 포트폴리오 추천</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#34495e' }}>문의 및 만든이</h3>
        <p>
          이메일: hadimorningb@gmail.com<br/>
          네이버 블로그 : 24시간이 모자란데요⏰ / 모닝비 <br/>
        </p>
      </section>

      <section>
        <h3 style={{ color: '#34495e' }}>면책 조항</h3>
        <p style={{ fontSize: '14px', color: '#7f8c8d' }}>
          본 사이트에서 제공하는 정보는 참고용이며, 투자 권유나 조언이 아닙니다. 
          모든 투자 결정은 본인의 책임 하에 이루어져야 하며, 투자로 인한 손실에 대해 
          당사는 책임지지 않습니다.
        </p>
      </section>
    </div>
  );
}

// 개인정보처리방침
function PrivacyPage() {
  return (
    <div>
      <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>🔒 개인정보처리방침</h2>
      
      <p style={{ fontSize: '14px', color: '#7f8c8d', marginBottom: '30px' }}>
        시행일: 2025년 1월 1일
      </p>

      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#34495e' }}>1. 수집하는 개인정보</h3>
        <p>배당관리자 사이트 관리자는 다음과 같은 정보를 수집합니다:</p>
        <ul style={{ paddingLeft: '20px' }}>
          <li>이메일 주소 (관리자에게 메일 문의 시)</li>
          <li>포트폴리오 데이터 (종목, 수량 등 - 로컬 저장)</li>
          <li>웹사이트 이용 기록 (Google Analytics)</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#34495e' }}>2. 개인정보의 이용 목적</h3>
        <ul style={{ paddingLeft: '20px' }}>
          <li>서비스 제공 및 개선</li>
          <li>사용자 문의 및 개선</li>
          <li>뉴스레터 발송 (기능 개발중)</li>
          <li>통계 분석 및 서비스 개선</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#34495e' }}>3. 개인정보의 보유 기간</h3>
        <p>
          현재 로그인 기능이 없으므로 사용자 계정은 보유 하지 않습니다.
          종목 리스트에 추가된 정보는 정보 삭제시까지 저장됩니다
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#34495e' }}>4. 개인정보의 제3자 제공</h3>
        <p>
          배당관리자는 사용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 
          단, 법령에 의해 요구되는 경우 예외로 합니다.
        </p>
      </section>

      <section>
        <h3 style={{ color: '#34495e' }}>5. 문의처</h3>
        <p>
          시스템 관련 문의: hadimorningb@gmail.com
        </p>
      </section>
    </div>
  );
}

// 이용약관
function TermsPage() {
  return (
    <div>
      <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>📋 이용약관</h2>
      
      <p style={{ fontSize: '14px', color: '#7f8c8d', marginBottom: '30px' }}>
        시행일: 2025년 1월 1일
      </p>

      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#34495e' }}>제1조 (목적)</h3>
        <p>
          이 약관은 배당관리자(이하 "서비스")가 제공하는 모든 서비스의 이용과 관련하여 
          서비스와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#34495e' }}>제2조 (서비스의 제공)</h3>
        <p>서비스는 다음과 같은 기능을 제공합니다:</p>
        <ul style={{ paddingLeft: '20px' }}>
          <li>배당 포트폴리오 관리</li>
          <li>배당금 계산 및 세금 시뮬레이션</li>
          <li>투자 정보 및 교육 콘텐츠</li>
          <li>기타 배당 투자 관련 도구</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#34495e' }}>제3조 (서비스의 변경 및 중단)</h3>
        <p>
          서비스는 운영상, 기술상의 필요에 따라 제공하고 있는 서비스를 변경하거나 
          중단할 수 있습니다. 이 경우 사전에 공지합니다.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#34495e' }}>제4조 (면책 조항)</h3>
        <ul style={{ paddingLeft: '20px' }}>
          <li>서비스는 투자 권유나 조언을 제공하지 않습니다.</li>
          <li>모든 투자 결정은 이용자 본인의 책임입니다.</li>
          <li>서비스 이용으로 발생한 손실에 대해 책임지지 않습니다.</li>
          <li>제공되는 정보의 정확성을 보장하지 않습니다.</li>
        </ul>
      </section>

      <section>
        <h3 style={{ color: '#34495e' }}>제5조 (문의)</h3>
        <p>
          약관에 대한 문의: hadimorningb@gmail.com
        </p>
      </section>
    </div>
  );
}




export default App;