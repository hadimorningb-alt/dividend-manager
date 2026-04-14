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
import { onAuthStateChanged } from 'firebase/auth';
//import toast, { Toaster } from 'react-hot-toast';


function App() {
  const [currentPage, setCurrentPage] = useState('포트폴리오');
  const [stocks, setStocks] = useState([]);
  const [exchangeRate, setExchangeRate] = useState(1380);
  const [exchangeUpdateTime, setExchangeUpdateTime] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

 
// 🔥 Firebase에서 데이터 불러오기 (수정)
const loadStocks = async () => {
  if (!user) return;  // 🔥 추가: 로그인 전에는 실행 안 함

  try {
    // 🔥 수정: users/{userId}/stocks
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


// 🔥 실시간 환율 가져오기 (ExchangeRate-API 사용)
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
    } else {
      console.log('⚠️ 환율 데이터 없음, 기본값 유지');
    }
  } catch (error) {
    console.error('❌ 환율 API 오류:', error);
    console.log('기본값 사용:', exchangeRate);
  }
};

  // 🔥 실시간 주가 가져오기
  const fetchStockPrice = async (ticker) => {
    try {
      const API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;
      
      if (!API_KEY) {
        console.log('⚠️ Finnhub API 키가 없습니다. .env 파일을 확인하세요.');
        return null;
      }

      const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_KEY}`;
      
      console.log('🔄 주가 조회 중:', ticker);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.c && data.c > 0) {
        console.log('✅ 주가:', ticker, '=', data.c);
        return data.c;
      } else {
        console.log('⚠️ 주가 데이터 없음:', ticker);
        return null;
      }
    } catch (error) {
      console.error('❌ 주가 API 오류:', ticker, error);
      return null;
    }
  };

  //사용자 인증 체크
  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
    if (currentUser) {
      console.log('✅ 사용자 ID:', currentUser.uid);
      setUser(currentUser);
    }
    setLoading(false);
  });

  return () => unsubscribe();
}, []);


  // 앱 시작 시 실행
// 🔥 사용자 로그인 후 데이터 로드
useEffect(() => {
  if (!user) return;  // 🔥 추가
  
  loadStocks();
}, [user]);  // 🔥 의존성 변경: [] → [user]

// 환율은 별도로 (사용자 무관)
useEffect(() => {
  fetchExchangeRate();
  
  // 10분마다 환율 업데이트
  const interval = setInterval(fetchExchangeRate, 10 * 60 * 1000);
  return () => clearInterval(interval);
}, []);


  const menuItems = [
    { name: '포트폴리오', icon: '📊' },
    { name: '배당 캘린더', icon: '📅' },
    { name: '종목별 배당', icon: '💵' },
    { name: '세금 계산기', icon: '💸' },
    { name: '목표 달성률', icon: '🎯' },  // 🔥 새로 추가
    { name: '배당 뉴스', icon: '📰' },   // 🔥 새로 추가
    { name: '인기 배당주', icon: '🔥' },  // 🔥 새로 추가
    { name: '투자 거장', icon: '👔' },   // 🔥 새로 추가
    { name: '설정', icon: '⚙️' },
    { name: '정보', icon: 'ℹ️' }  // 🔥 새로 추가 (법적 페이지)
  ];

// 🔥 로딩 중 화면 (새로 추가)
if (loading) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '20px',
      color: '#3498db'
    }}>
      ⏳ 로딩 중...
    </div>
  );
}

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      
{/* 왼쪽 사이드바 */}
<div style={{
  width: '250px',
  background: '#2c3e50',
  color: 'white',
  padding: '20px',
  boxShadow: 'none',
  position: 'relative',
  borderRight: '1px solid #dfe6e9',
  display: 'flex',
  flexDirection: 'column',
  height: '100vh'
}}>
  
  {/* 로고 */}
  <div style={{ 
    marginBottom: '40px', 
    paddingBottom: '20px', 
    borderBottom: '1px solid rgba(255,255,255,0.2)' 
  }}>
    <h1 style={{ margin: 0, fontSize: '24px' }}>💰 모닝비의 배당관리</h1>
    <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: 0.8 }}>
      육아맘의 똑똑한 투자
    </p>
  </div>

  {/* 🔥 메뉴 리스트 - 정보 제외 */}
  <div style={{ flex: 1, overflowY: 'auto' }}>
    {menuItems.filter(item => item.name !== '정보').map(item => (
      <div 
        key={item.name}
        onClick={() => setCurrentPage(item.name)}
        style={{
          padding: '15px 20px',
          marginBottom: '10px',
          borderRadius: '5px',
          cursor: 'pointer',
          background: currentPage === item.name ? '#34495e' : 'transparent',
          transition: 'background 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderLeft: currentPage === item.name ? '3px solid #3498db' : '3px solid transparent'
        }}
        onMouseEnter={(e) => {
          if (currentPage !== item.name) {
            e.currentTarget.style.background = '#34495e';
          }
        }}
        onMouseLeave={(e) => {
          if (currentPage !== item.name) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <span style={{ fontSize: '20px' }}>{item.icon}</span>
        <span style={{ fontSize: '14px', fontWeight: currentPage === item.name ? '600' : '400' }}>
          {item.name}
        </span>
      </div>
    ))}
  </div>

  {/* 🔥 하단 정보 (환율, 종목 수) */}
  <div style={{
    padding: '15px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '10px',
    fontSize: '13px',
    marginBottom: '15px'
  }}>
    <p style={{ margin: 0 }}>총 종목: {stocks.length}개</p>
    <p style={{ margin: '5px 0 0 0', opacity: 0.8 }}>
      💱 ₩{exchangeRate.toFixed(2)}/USD
    </p>
    {exchangeUpdateTime && (
      <p style={{ margin: '5px 0 0 0', opacity: 0.6, fontSize: '11px' }}>
        {exchangeUpdateTime} 갱신
      </p>
    )}
  </div>

  {/* 🔥 Legal 페이지 버튼 (맨 하단) */}
  <div style={{
    borderTop: '1px solid rgba(255,255,255,0.1)',
    paddingTop: '15px'
  }}>
    <div
      onClick={() => setCurrentPage('정보')}
      style={{
        padding: '15px 20px',
        borderRadius: '5px',
        cursor: 'pointer',
        background: currentPage === '정보' ? '#34495e' : 'transparent',
        transition: 'background 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        borderLeft: currentPage === '정보' ? '3px solid #3498db' : '3px solid transparent'
      }}
      onMouseEnter={(e) => {
        if (currentPage !== '정보') {
          e.currentTarget.style.background = '#34495e';
        }
      }}
      onMouseLeave={(e) => {
        if (currentPage !== '정보') {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span style={{ fontSize: '20px' }}>ℹ️</span>
      <span style={{ fontSize: '14px', fontWeight: currentPage === '정보' ? '600' : '400' }}>
        정보
      </span>
    </div>
  </div>

</div>


      
      {/* 메인 컨텐츠 */}
      <div style={{ 
        flex: 1, 
        background: '#f5f5f5', 
        overflowY: 'auto',
        padding: '40px'
      }}>
        {currentPage === '포트폴리오' && (
          <PortfolioPage 
            stocks={stocks} 
            setStocks={setStocks}
            fetchStockPrice={fetchStockPrice}
            loadStocks={loadStocks} //수동
            db={db} //수동
            user={user}
          />
        )}
        {currentPage === '배당 캘린더' && <CalendarPage stocks={stocks} />}
        {currentPage === '종목별 배당' && <StockDividendPage stocks={stocks} />}
        {currentPage === '목표 달성률' && <GoalTrackerPage stocks={stocks} />}
        {currentPage === '배당 뉴스' && <DividendNewsPage />}
        {currentPage === '인기 배당주' && <PopularDividendStocksPage />}
        {currentPage === '투자 거장' && <InvestorLegendsPage />}
        {currentPage === '세금 계산기' && <TaxCalculatorPage exchangeRate={exchangeRate} />}
       {currentPage === '설정' && <SettingsPage user={user} />}
        {currentPage === '정보' && <LegalPages />}
      </div>
    </div>
  );
}

// ============================================
// 📊 포트폴리오 페이지
// ============================================
function PortfolioPage({ stocks, setStocks, fetchStockPrice, user }) {
  const [assetType, setAssetType] = useState('주식');
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [dividendRate, setDividendRate] = useState('');
  const [dividendMonths, setDividendMonths] = useState('');
  const [faceValue, setFaceValue] = useState('10000');
  const [couponRate, setCouponRate] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  // 🔥 티커 검증 함수 (강화)
  const validateTicker = async (ticker) => {
    try {
      const API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;
      
      if (!API_KEY) {
        console.log('⚠️ API 키 없음, 검증 생략');
        return { valid: true, price: null };
      }

      const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_KEY}`;
      
      console.log('🔍 티커 검증 중:', ticker);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log('❌ API 응답 오류');
        return { valid: false, price: null };
      }

      const data = await response.json();
      
      console.log('API 응답:', data);
      
      // 🔥 핵심: 현재가(c)가 0보다 크면 유효한 티커
      if (data.c && data.c > 0) {
        console.log('✅ 유효한 티커:', ticker, '현재가:', data.c);
        return { valid: true, price: data.c };
      } else {
        console.log('❌ 존재하지 않는 티커:', ticker, '데이터:', data);
        return { valid: false, price: null };
      }
    } catch (error) {
      console.error('❌ 티커 검증 오류:', error);
      return { valid: false, price: null };
    }
  };

  // 🔥 종목 추가
  const addStock = async () => {
    if (!ticker || !shares || !purchasePrice) {
      alert('필수 항목을 입력해주세요!');
      return;
    }

    setIsValidating(true);

    try {
      let currentPrice = parseFloat(purchasePrice);
      
      // 🔥 주식인 경우 티커 검증 (필수!)
      if (assetType === '주식') {
        console.log('🔍 주식 티커 검증 시작:', ticker.toUpperCase());
        
        const validation = await validateTicker(ticker.toUpperCase());
        
        if (!validation.valid) {
          alert(`❌ "${ticker.toUpperCase()}"는 존재하지 않는 주식 종목입니다!\n\n올바른 티커를 입력해주세요.\n\n예시: AAPL, MSFT, GOOGL, KO, JNJ`);
          setIsValidating(false);
          return; // 🔥 여기서 중단!
        }
        
        // 검증 통과하면 실시간 주가 사용
        if (validation.price) {
          currentPrice = validation.price;
          console.log('✅ 실시간 주가 적용:', currentPrice);
        }
      } else if (assetType === '채권') {
        // 채권은 검증 없이 매수가를 현재가로
        console.log('📜 채권: 매수가를 현재가로 설정');
        currentPrice = parseFloat(purchasePrice);
      }

      const newStock = {
        assetType,
        ticker: ticker.toUpperCase(),
        shares: Number(shares),
        purchasePrice: parseFloat(purchasePrice),
        currentPrice,
        dividendRate: assetType === '주식' ? parseFloat(dividendRate || 0) : parseFloat(couponRate || 0),
        dividendMonths,
        faceValue: assetType === '채권' ? parseFloat(faceValue) : null,
        createdAt: new Date(),
        lastUpdated: new Date()
      };
      //firebase캐시삭제 
      await deleteDoc(doc(db, 'cache', 'dividendData'));
console.log('캐시 삭제 완료!');
      // Firebase에 저장
      const docRef = await addDoc(collection(db, `users/${user.uid}/stocks`), newStock);
      console.log('✅ Firebase에 저장 완료! ID:', docRef.id);
      
      setStocks([{ id: docRef.id, ...newStock }, ...stocks]);
      
      // 초기화
      setTicker('');
      setShares('');
      setPurchasePrice('');
      setDividendRate('');
      setDividendMonths('');
      setCouponRate('');
      
      alert(`✅ ${ticker.toUpperCase()} 추가 완료!\n현재가: $${currentPrice.toFixed(2)}`);
    } catch (error) {
      console.error('❌ 저장 실패:', error);
      alert('저장 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsValidating(false);
    }
  };

  // 🔥 종목 삭제
  const deleteStock = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, `users/${user.uid}/stocks`, id));
      console.log('✅ Firebase에서 삭제 완료! ID:', id);
      
      setStocks(stocks.filter(stock => stock.id !== id));
      alert('✅ 종목이 삭제되었습니다!');
    } catch (error) {
      console.error('❌ 삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 🔥 개별 주가 업데이트
  const updateStockPrice = async (stockId, ticker) => {
    try {
      const API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;
      
      if (!API_KEY) {
        alert('Finnhub API 키가 설정되지 않았습니다.');
        return;
      }

      const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.c && data.c > 0) {
        const newPrice = data.c;
        
        await updateDoc(doc(db, `users/${user.uid}/stocks`, stockId), {
          currentPrice: newPrice,
          lastUpdated: new Date()
        });
        
        setStocks(stocks.map(stock => 
          stock.id === stockId 
            ? { ...stock, currentPrice: newPrice }
            : stock
        ));
        
        console.log('✅ 주가 업데이트:', ticker, newPrice);
        alert(`${ticker} 주가가 $${newPrice.toFixed(2)}로 업데이트되었습니다!`);
      } else {
        alert('주가를 가져올 수 없습니다. 티커를 확인해주세요.');
      }
    } catch (error) {
      console.error('주가 업데이트 실패:', error);
      alert('주가 업데이트 중 오류가 발생했습니다.');
    }
  };

  // 🔥 모든 주식 주가 업데이트
  const updateAllPrices = async () => {
    const stocksOnly = stocks.filter(s => s.assetType === '주식');
    
    if (stocksOnly.length === 0) {
      alert('업데이트할 주식 종목이 없습니다.');
      return;
    }

    if (!window.confirm(`${stocksOnly.length}개 주식의 주가를 업데이트할까요?\n(API 제한으로 인해 ${stocksOnly.length}초 정도 걸립니다)`)) {
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const stock of stocksOnly) {
      try {
        await updateStockPrice(stock.id, stock.ticker);
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        failCount++;
        console.error('주가 업데이트 실패:', stock.ticker, error);
      }
    }

    alert(`완료!\n성공: ${successCount}개\n실패: ${failCount}개`);
  };

  // 🔥 채권 가격 수동 업데이트
  const updateBondPrice = async (stockId, newPrice) => {
    if (!newPrice || isNaN(newPrice)) {
      alert('올바른 가격을 입력해주세요.');
      return;
    }

    try {
      await updateDoc(doc(db, `users/${user.uid}/stocks`, stockId), {
        currentPrice: parseFloat(newPrice),
        lastUpdated: new Date()
      });
      
      setStocks(stocks.map(stock => 
        stock.id === stockId 
          ? { ...stock, currentPrice: parseFloat(newPrice) }
          : stock
      ));
      
      alert('✅ 가격이 업데이트되었습니다!');
    } catch (error) {
      console.error('가격 업데이트 실패:', error);
      alert('업데이트 중 오류가 발생했습니다.');
    }
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 30px 0', color: '#333' }}>내 포트폴리오</h1>

      {/* 종목 추가 카드 */}
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '15px',
        marginBottom: '30px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#667eea' }}>자산 추가</h2>
        
        {/* 자산 유형 선택 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px', color: '#666', fontWeight: 'bold' }}>
            자산 유형
          </label>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button
              onClick={() => setAssetType('주식')}
              style={{
                padding: '12px 30px',
                background: assetType === '주식' ? '#667eea' : '#e0e0e0',
                color: assetType === '주식' ? 'white' : '#666',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                transition: 'all 0.3s'
              }}
            >
              📈 주식
            </button>
            <button
              onClick={() => setAssetType('채권')}
              style={{
                padding: '12px 30px',
                background: assetType === '채권' ? '#667eea' : '#e0e0e0',
                color: assetType === '채권' ? 'white' : '#666',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                transition: 'all 0.3s'
              }}
            >
              📜 채권
            </button>
          </div>

          {/* 🔥 채권 안내 멘트 추가 */}
{assetType === '채권' && (
  <div style={{
    background: '#e8f4f8',
    border: '1px solid #b3d9e6',
    borderRadius: '8px',
    padding: '12px 15px',
    marginBottom: '20px',
    margintop: '20px',
    fontSize: '13px',
    color: '#0c5460',
    lineHeight: '1.6'
  }}>
    <strong style={{ display: 'block', marginBottom: '5px' }}>💡 채권 가격 안내</strong>
    채권은 실시간 시세 조회가 불가능하여 매수가격이 현재가로 유지됩니다. 
    시장 가격 변동 시 '가격 업데이트' 버튼으로 수동 조정해주세요.
  </div>
)}
        </div>

        {/* 입력 폼 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#666', fontSize: '14px' }}>
              {assetType === '주식' ? '티커' : '종목명'}
            </label>
            <input 
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder={assetType === '주식' ? "예: AAPL, MSFT" : "예: 미국10년물"}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
            {assetType === '주식' && (
              <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#999' }}>
                ✓ 실제 존재하는 티커만 입력 가능
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#666', fontSize: '14px' }}>
              {assetType === '주식' ? '보유 수량' : '보유 장수'}
            </label>
            <input 
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder={assetType === '주식' ? "예: 50" : "예: 10"}
              type="number"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#666', fontSize: '14px' }}>
              매수 가격 ($)
            </label>
            <input 
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder={assetType === '주식' ? "예: 180" : "예: 95.5"}
              type="number"
              step="0.01"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
          {assetType === '주식' ? (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#666', fontSize: '14px' }}>
                  배당률 (%)
                </label>
                <input 
                  value={dividendRate}
                  onChange={(e) => setDividendRate(e.target.value)}
                  placeholder="예: 0.52"
                  type="number"
                  step="0.01"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#666', fontSize: '14px' }}>
                  배당 지급월
                </label>
                <input 
                  value={dividendMonths}
                  onChange={(e) => setDividendMonths(e.target.value)}
                  placeholder="예: 2,5,8,11 또는 매월"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#666', fontSize: '14px' }}>
                  액면가 ($)
                </label>
                <input 
                  value={faceValue}
                  onChange={(e) => setFaceValue(e.target.value)}
                  placeholder="예: 10000"
                  type="number"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#666', fontSize: '14px' }}>
                  쿠폰률 (%)
                </label>
                <input 
                  value={couponRate}
                  onChange={(e) => setCouponRate(e.target.value)}
                  placeholder="예: 4.5"
                  type="number"
                  step="0.01"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#666', fontSize: '14px' }}>
                  이자 지급월
                </label>
                <input 
                  value={dividendMonths}
                  onChange={(e) => setDividendMonths(e.target.value)}
                  placeholder="예: 6월,12월"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button 
              onClick={addStock}
              disabled={isValidating}
              style={{
                width: '100%',
                padding: '12px',
                background: isValidating ? '#ccc' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: isValidating ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                if (!isValidating) e.target.style.background = '#5568d3';
              }}
              onMouseLeave={(e) => {
                if (!isValidating) e.target.style.background = '#667eea';
              }}
            >
              {isValidating ? '검증 중...' : '+ 추가'}
            </button>
          </div>
        </div>
      </div>

      {/* 종목 리스트 */}
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '15px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#667eea' }}>
            보유 자산 ({stocks.length})
          </h2>
          
          {stocks.filter(s => s.assetType === '주식').length > 0 && (
            <button
              onClick={updateAllPrices}
              style={{
                padding: '12px 24px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#45a049'}
              onMouseLeave={(e) => e.target.style.background = '#4caf50'}
            >
              🔄 모든 주가 업데이트
            </button>
          )}
        </div>

        {stocks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
            <p style={{ fontSize: '48px', margin: 0 }}>📊</p>
            <p style={{ fontSize: '18px', margin: '20px 0 0 0' }}>
              자산을 추가해보세요!
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#666' }}>유형</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#666' }}>티커</th>
                  <th style={{ padding: '15px', textAlign: 'right', color: '#666' }}>수량</th>
                  <th style={{ padding: '15px', textAlign: 'right', color: '#666' }}>매수가</th>
                  <th style={{ padding: '15px', textAlign: 'right', color: '#666' }}>현재가</th>
                  <th style={{ padding: '15px', textAlign: 'right', color: '#666' }}>수익률</th>
                  <th style={{ padding: '15px', textAlign: 'right', color: '#666' }}>배당률</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#666' }}>배당월</th>
                  <th style={{ padding: '15px', textAlign: 'right', color: '#666' }}>연배당</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#666' }}>갱신</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#666' }}>삭제</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map(stock => {
                  const profitRate = ((stock.currentPrice - stock.purchasePrice) / stock.purchasePrice * 100);
                  const annualDividend = stock.assetType === '주식'
                    ? stock.currentPrice * stock.shares * stock.dividendRate / 100
                    : stock.faceValue * stock.shares * stock.dividendRate / 100;
                  
                  return (
                    <tr key={stock.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '15px' }}>
                        <span style={{
                          background: stock.assetType === '주식' ? '#e3f2fd' : '#fff3e0',
                          color: stock.assetType === '주식' ? '#1976d2' : '#f57c00',
                          padding: '5px 10px',
                          borderRadius: '5px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {stock.assetType === '주식' ? '📈 주식' : '📜 채권'}
                        </span>
                      </td>
                      <td style={{ padding: '15px', fontWeight: 'bold', color: '#667eea' }}>
                        {stock.ticker}
                      </td>
                      <td style={{ padding: '15px', textAlign: 'right' }}>
                        {stock.shares.toLocaleString()}{stock.assetType === '주식' ? '주' : '장'}
                      </td>
                      <td style={{ padding: '15px', textAlign: 'right' }}>
                        ${stock.purchasePrice.toLocaleString()}
                      </td>
                      <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold' }}>
                        ${stock.currentPrice.toFixed(2)}
                      </td>
                      <td style={{ 
                        padding: '15px', 
                        textAlign: 'right',
                        color: profitRate >= 0 ? '#4caf50' : '#ff4757',
                        fontWeight: 'bold'
                      }}>
                        {profitRate >= 0 ? '+' : ''}{profitRate.toFixed(2)}%
                      </td>
                      <td style={{ padding: '15px', textAlign: 'right' }}>
                        {stock.dividendRate}%
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center', fontSize: '12px' }}>
                        {stock.dividendMonths || '-'}
                      </td>
                      <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#4caf50' }}>
                        ${annualDividend.toFixed(0)}
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        {stock.assetType === '주식' ? (
                          <button
                            onClick={() => updateStockPrice(stock.id, stock.ticker)}
                            style={{
                              background: '#2196F3',
                              color: 'white',
                              border: 'none',
                              padding: '8px 15px',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                            title="실시간 주가로 업데이트"
                          >
                            🔄
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const newPrice = prompt('새 가격을 입력하세요 (예: 96.5):', stock.currentPrice);
                              if (newPrice) {
                                updateBondPrice(stock.id, newPrice);
                              }
                            }}
                            style={{
                              background: '#FF9800',
                              color: 'white',
                              border: 'none',
                              padding: '8px 15px',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                            title="가격 수동 입력"
                          >
                            ✏️
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        <button
                          onClick={() => deleteStock(stock.id)}
                          style={{
                            background: '#ff4757',
                            color: 'white',
                            border: 'none',
                            padding: '8px 15px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// 📅 배당 캘린더
// ============================================
function CalendarPage({ stocks }) {
  const months = Array.from({length: 12}, (_, i) => i + 1);
  
  const getMonthlyDividend = (month) => {
    return stocks.filter(stock => {
      if (!stock.dividendMonths) return false;
      if (stock.dividendMonths === '매월') return true;

      // 🔥 수정: 정확한 월 매칭
      const monthStr = stock.dividendMonths;
        // "1월,6월,12월" 형식
      if (monthStr.includes('월')) {
        const monthsArray = monthStr.split(',').map(m => m.trim());
        return monthsArray.includes(`${month}월`);
      }
      
      // "1,6,12" 형식
      const monthsArray = monthStr.split(',').map(m => m.trim());
      return monthsArray.includes(String(month));

      //return stock.dividendMonths.includes(String(month)); //???
    });
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 30px 0', color: '#333' }}>배당 캘린더</h1>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px'
      }}>
        {months.map(month => {
          const monthStocks = getMonthlyDividend(month);
          const totalDividend = monthStocks.reduce((sum, stock) => {
            const dividend = stock.assetType === '주식'
              ? stock.currentPrice * stock.shares * stock.dividendRate / 100 / 12
              : stock.faceValue * stock.shares * stock.dividendRate / 100 / 12;
            return sum + dividend;
          }, 0);

          return (
            <div key={month} style={{
              background: 'white',
              padding: '30px',
              borderRadius: '15px',
              textAlign: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              transition: 'transform 0.3s',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <h3 style={{ margin: '0 0 15px 0', color: '#667eea' }}>{month}월</h3>
              <p style={{ fontSize: '40px', margin: '10px 0' }}>
                {monthStocks.length > 0 ? '💰' : ' '}
              </p>
              <p style={{ color: monthStocks.length > 0 ? '#4caf50' : '#999', fontSize: '14px', margin: '5px 0', fontWeight: 'bold' }}>
                ${totalDividend.toFixed(0)}
              </p>
              <p style={{ color: '#999', fontSize: '12px', margin: '5px 0 0 0' }}>
                {monthStocks.length}개 종목
              </p>
            </div>
          );
        })}
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
                  ${((stock.assetType === '주식' 
                    ? stock.currentPrice * stock.shares * stock.dividendRate / 100
                    : stock.faceValue * stock.shares * stock.dividendRate / 100
                  )).toLocaleString()}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '10px' }}>
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
                  }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>{month}월</p>
                    <p style={{ margin: '5px 0 0 0', fontSize: '20px' }}>
                      {hasDividend ? '💰' : '-'}
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
  
const dividendKRW = Math.round(Number(dividendUSD) * exchangeRate);
const foreignTax = Math.round(dividendKRW * 0.15);
const domesticTax = Math.round((dividendKRW - foreignTax) * 0.154);
const actualIncome = Math.round(dividendKRW - foreignTax - domesticTax);

  return (
    <div>
      <h1 style={{ margin: '0 0 30px 0', color: '#333' }}>배당 세금 계산기</h1>

      {/* 환율 정보 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px 30px',
        borderRadius: '15px',
        marginBottom: '30px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>💱 실시간 환율</p>
          <p style={{ margin: '5px 0 0 0', fontSize: '32px', fontWeight: 'bold' }}>
            ₩{exchangeRate.toFixed(2)}/USD
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>
            {new Date().toLocaleDateString('ko-KR')}
          </p>
        </div>
      </div>

      {/* 입력 */}
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '15px',
        marginBottom: '30px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '10px', 
          color: '#667eea',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          💵 배당금 입력 (달러)
        </label>
        <input 
          type="number"
          value={dividendUSD}
          onChange={(e) => setDividendUSD(e.target.value)}
          placeholder="예: 1000"
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '24px',
            border: '2px solid #667eea',
            borderRadius: '10px',
            boxSizing: 'border-box',
            fontWeight: 'bold'
          }}
        />
        {dividendUSD && (
          <p style={{ margin: '15px 0 0 0', color: '#666', fontSize: '16px' }}>
            = {dividendKRW.toLocaleString()}원 (오늘 환율 기준)
          </p>
        )}
      </div>

      {/* 결과 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white',
          padding: '30px',
          borderRadius: '15px'
        }}>
          <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>해외 원천징수세 (15%)</p>
          <p style={{ margin: '10px 0 0 0', fontSize: '32px', fontWeight: 'bold' }}>
            -{foreignTax.toLocaleString()}원
          </p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
          color: '#333',
          padding: '30px',
          borderRadius: '15px'
        }}>
          <p style={{ margin: 0, fontSize: '14px' }}>국내 배당소득세 (15.4%)</p>
          <p style={{ margin: '10px 0 0 0', fontSize: '32px', fontWeight: 'bold' }}>
            -{domesticTax.toLocaleString()}원
          </p>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        color: 'white',
        padding: '40px',
        borderRadius: '15px',
        textAlign: 'center'
      }}>
        <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>💰 실제 수령액</p>
        <p style={{ margin: '15px 0', fontSize: '48px', fontWeight: 'bold' }}>
          {actualIncome.toLocaleString()}원
        </p>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
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

  // 현재 월 배당 계산
  const currentMonthlyDividend = stocks.reduce((sum, stock) => {
    const annualDividend = stock.assetType === '주식'
      ? stock.currentPrice * stock.shares * stock.dividendRate / 100
      : stock.faceValue * stock.shares * stock.dividendRate / 100;
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
        padding: '30px',
        borderRadius: '8px',
        marginBottom: '30px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#34495e' }}>월 배당 목표</h2>
        
        {isEditing ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="number"
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(e.target.value)}
              style={{
                padding: '12px',
                fontSize: '18px',
                border: '2px solid #3498db',
                borderRadius: '5px',
                width: '200px'
              }}
            />
            <span style={{ fontSize: '18px' }}>원</span>
            <button
              onClick={saveGoal}
              style={{
                padding: '12px 24px',
                background: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              저장
            </button>
            <button
              onClick={() => setIsEditing(false)}
              style={{
                padding: '12px 24px',
                background: '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              취소
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#2c3e50' }}>
              {parseFloat(monthlyGoal).toLocaleString()}원
            </p>
            <button
              onClick={() => setIsEditing(true)}
              style={{
                padding: '10px 20px',
                background: '#ecf0f1',
                color: '#2c3e50',
                border: '1px solid #dfe6e9',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              ✏️ 수정
            </button>
          </div>
        )}
      </div>

      {/* 달성률 카드 */}
      <div style={{
        background: parseFloat(achievementRate) >= 100 ? '#2ecc71' : '#3498db',
        color: 'white',
        padding: '40px',
        borderRadius: '8px',
        marginBottom: '30px',
        textAlign: 'center'
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '24px' }}>현재 달성률</h2>
        <p style={{ margin: '0 0 10px 0', fontSize: '72px', fontWeight: 'bold' }}>
          {achievementRate}%
        </p>
        <p style={{ margin: 0, fontSize: '18px', opacity: 0.9 }}>
          {parseFloat(achievementRate) >= 100 ? '🎉 목표 달성!' : `목표까지 ${(goalKRW - currentMonthlyKRW).toLocaleString()}원 남음`}
        </p>
      </div>

      {/* 현황 상세 */}
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '8px',
        marginBottom: '30px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#34495e' }}>월 배당 현황</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
          <div style={{ padding: '20px', background: '#ecf0f1', borderRadius: '5px' }}>
            <p style={{ margin: '0 0 10px 0', color: '#7f8c8d', fontSize: '14px' }}>현재 월 배당</p>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#2c3e50' }}>
                {Math.round(currentMonthlyKRW).toLocaleString()}원
            </p>
            <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#7f8c8d' }}>
              (${currentMonthlyDividend.toFixed(2)})
            </p>
          </div>

          <div style={{ padding: '20px', background: '#ecf0f1', borderRadius: '5px' }}>
            <p style={{ margin: '0 0 10px 0', color: '#7f8c8d', fontSize: '14px' }}>목표까지</p>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: parseFloat(achievementRate) >= 100 ? '#2ecc71' : '#e74c3c' }}>
              {parseFloat(achievementRate) >= 100 ? '+' : ''}{Math.round(currentMonthlyKRW - goalKRW).toLocaleString()}원
            </p>
          </div>
        </div>
      </div>

      {/* 진행 바 */}
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#34495e' }}>목표까지의 여정</h2>
        
        <div style={{
          height: '40px',
          background: '#ecf0f1',
          borderRadius: '20px',
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
            paddingRight: '15px',
            color: 'white',
            fontWeight: 'bold'
          }}>
            {achievementRate}%
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
          <span style={{ fontSize: '14px', color: '#7f8c8d' }}>0원</span>
          <span style={{ fontSize: '14px', color: '#7f8c8d' }}>{goalKRW.toLocaleString()}원</span>
        </div>
      </div>

      {/* 종목별 기여도 */}
      {stocks.length > 0 && (
        <div style={{
          background: 'white',
          padding: '30px',
          borderRadius: '8px',
          marginTop: '30px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ margin: '0 0 20px 0', color: '#34495e' }}>종목별 기여도</h2>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ecf0f1' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: '#7f8c8d' }}>종목</th>
                <th style={{ padding: '12px', textAlign: 'right', color: '#7f8c8d' }}>월 배당</th>
                <th style={{ padding: '12px', textAlign: 'right', color: '#7f8c8d' }}>기여율</th>
              </tr>
            </thead>
            <tbody>
              {stocks
                .map(stock => {
                  const annualDiv = stock.assetType === '주식'
                    ? stock.currentPrice * stock.shares * stock.dividendRate / 100
                    : stock.faceValue * stock.shares * stock.dividendRate / 100;
                  const monthlyDiv = Math.round(annualDiv / 12 * 1380);
                  const contribution = (monthlyDiv / currentMonthlyKRW * 100).toFixed(1);
                  return { ...stock, monthlyDiv, contribution };
                })
                .sort((a, b) => b.monthlyDiv - a.monthlyDiv)
                .map(stock => (
                  <tr key={stock.id} style={{ borderBottom: '1px solid #ecf0f1' }}>
                    <td style={{ padding: '12px', fontWeight: '600', color: '#2c3e50' }}>
                      {stock.ticker}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#2c3e50' }}>
                      {stock.monthlyDiv.toLocaleString()}원
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <span style={{
                        background: '#3498db',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '13px',
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
      )}
    </div>
  );
}



// ============================================
// 📰 배당 뉴스 페이지 (실제 API 버전)
// ============================================
function DividendNewsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [newsData, setNewsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 🔥 실제 뉴스 가져오기
  const fetchNews = async () => {
    setLoading(true);
    setError(null);

    try {
      const API_KEY = process.env.REACT_APP_NEWS_API_KEY;
      
      if (!API_KEY) {
        throw new Error('NewsAPI 키가 설정되지 않았습니다.');
      }

      // 검색 키워드 설정
      let keyword = 'dividend stocks';
      if (selectedCategory === 'dividend-increase') keyword = 'dividend increase';
      if (selectedCategory === 'dividend-cut') keyword = 'dividend cut';
      if (selectedCategory === 'high-yield') keyword = 'high yield dividend';
      if (selectedCategory === 'tax') keyword = 'dividend tax';

      const url = `https://newsapi.org/v2/everything?q=${keyword}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${API_KEY}`;

      console.log('🔄 뉴스 API 호출 중...', keyword);

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'ok') {
        // API 데이터를 우리 형식으로 변환
        const formattedNews = data.articles.map((article, index) => ({
          id: index,
          category: selectedCategory === 'all' ? 'market-analysis' : selectedCategory,
          title: article.title,
          summary: article.description || article.content?.substring(0, 150) + '...',
          date: new Date(article.publishedAt).toISOString().split('T')[0],
          source: article.source.name,
          ticker: null,
          image: article.urlToImage ? '📰' : '📄',
          url: article.url
        }));

        setNewsData(formattedNews);
        console.log('✅ 뉴스 로드 완료:', formattedNews.length, '개');
      } else {
        throw new Error(data.message || '뉴스를 가져올 수 없습니다.');
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
                  {/* 아이콘 */}
                  <div style={{
                    fontSize: '48px',
                    flexShrink: 0
                  }}>
                    {news.image}
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
          💡 <strong>NewsAPI 무료 플랜:</strong> 하루 100개 요청 제한. 
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
          📅 데이터 기준: 2026년 4월 10일
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
          📈 연속증배
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
  burry: {
    name: '마이클 버리',
    company: 'Scion Asset Management',
    strategy: '역발상 투자, 가치주',
    description: '2008 금융위기를 예측한 투자자. 영화 "빅쇼트"의 실제 주인공',
    totalValue: 340000000, // $340M
    quarter: '2025 Q4',
    lastUpdated: '2026-02-14',
    holdings: [
      { ticker: 'BABA', name: 'Alibaba', value: 78000000, percent: 22.9, shares: 980000, change: 8.5 },
      { ticker: 'JD', name: 'JD.com', value: 62000000, percent: 18.2, shares: 2100000, change: 5.2 },
      { ticker: 'GEO', name: 'GEO Group', value: 48000000, percent: 14.1, shares: 3500000, change: 12.3 },
      { ticker: 'HCA', name: 'HCA Healthcare', value: 42000000, percent: 12.4, shares: 125000, change: 3.1 },
      { ticker: 'EXPE', name: 'Expedia', value: 38000000, percent: 11.2, shares: 280000, change: 4.5 },
      { ticker: 'BP', name: 'BP plc', value: 35000000, percent: 10.3, shares: 950000, change: 2.8 },
      { ticker: 'GOOG', name: 'Alphabet', value: 37000000, percent: 10.9, shares: 215000, change: -1.5 }
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
                display: 'flex',
                alignItems: 'center',
                padding: '18px',
                background: '#f8f9fa',
                borderRadius: '8px',
                transition: 'transform 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateX(5px)';
                e.currentTarget.style.background = '#e9ecef';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.background = '#f8f9fa';
              }}
            >
              {/* 순위 */}
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: index === 0 ? '#f39c12' : index < 3 ? '#95a5a6' : '#bdc3c7',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '14px',
                marginRight: '15px',
                flexShrink: 0
              }}>
                {index + 1}
              </div>

              {/* 종목 정보 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '16px', color: '#2c3e50' }}>
                    {holding.ticker}
                  </strong>
                  <span style={{ color: '#7f8c8d', fontSize: '14px' }}>
                    {holding.name}
                  </span>
                  {holding.change !== 0 && (
                    <span style={{
                      fontSize: '12px',
                      color: holding.change > 0 ? '#2ecc71' : '#e74c3c',
                      fontWeight: '600'
                    }}>
                      {holding.change > 0 ? '▲' : '▼'} {Math.abs(holding.change)}%
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#95a5a6' }}>
                  {holding.shares.toLocaleString()} 주
                </div>
              </div>

              {/* 비중 */}
              <div style={{ textAlign: 'right', marginRight: '20px', minWidth: '80px' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2c3e50' }}>
                  {holding.percent}%
                </div>
                <div style={{ fontSize: '11px', color: '#7f8c8d' }}>
                  비중
                </div>
              </div>

              {/* 가치 */}
              <div style={{ textAlign: 'right', minWidth: '100px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2ecc71' }}>
                  ${(holding.value / 1000000000).toFixed(2)}B
                </div>
                <div style={{ fontSize: '11px', color: '#7f8c8d' }}>
                  보유 가치
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
          🗑️ 모든 데이터 삭제
        </button>
        
        <p style={{ marginTop: '15px', color: '#999', fontSize: '14px' }}>
          ⚠️ 이 작업은 되돌릴 수 없습니다.
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
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        lineHeight: '1.8'
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
      <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>💰 배당관리자 소개</h2>
      
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#34495e' }}>우리의 미션</h3>
        <p>
          배당관리자는 개인 투자자들이 배당 포트폴리오를 쉽고 보기 쉽게 관리할 수 있는 도구입니다.<br/>
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
          블로그: blog.naver.com/00morningb<br/>
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
        <p>모닝비 배당관리자는 다음과 같은 정보를 수집합니다:</p>
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
          개인정보 관련 문의: hadimorningb@gmail.com
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