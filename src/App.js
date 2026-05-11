import { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  query, orderBy, updateDoc, getDoc, setDoc
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from './firebase';
import * as XLSX from 'xlsx';
import LoginPage from './LoginPage';
import DashboardPage from './DashboardPage';
import ChartPage from './ChartPage';

// ── 디자인 토큰 ──
const C = {
  dark:   '#1a1a2e',
  green:  '#22c55e',
  greenL: '#86D293',
  orange: '#fb923c',
  bg:     '#f5f5f0',
  white:  '#ffffff',
  text:   '#1a1a2e',
  sub:    '#94a3b8',
  border: '#e2e8f0',
  red:    '#ef4444',
};

// ── 공통 컴포넌트 ──
function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '28px' }}>
      <h3 style={{ color: C.text, fontSize: '15px', fontWeight: '700', marginBottom: '10px', paddingLeft: '12px', borderLeft: `4px solid ${C.green}` }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function BodyText({ children, color }) {
  return <p style={{ margin: '0 0 8px 0', color: color || '#475569', lineHeight: '1.8', fontSize: '14px' }}>{children}</p>;
}

function BulletList({ items }) {
  return (
    <ul style={{ paddingLeft: '20px', margin: '8px 0 0 0' }}>
      {items.map((item, i) => (
        <li key={i} style={{ color: '#475569', lineHeight: '1.8', fontSize: '14px', marginBottom: '4px' }}>{item}</li>
      ))}
    </ul>
  );
}

// ── 메인 App ──
function App() {
  const [currentPage, setCurrentPage] = useState('대시보드');
  const [stocks, setStocks] = useState([]);
  const [exchangeRate, setExchangeRate] = useState(1380);
  const [exchangeUpdateTime, setExchangeUpdateTime] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 768;

  const loadStocks = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, `users/${user.uid}/stocks`), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setStocks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    }
  };

  useEffect(() => {
    const saveMonthlySnapshot = async () => {
      if (!user || stocks.length === 0) return;
      const today = new Date();
      const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const totalAnnualDividend = stocks.reduce((sum, s) => {
        const annualDiv = s.assetType === '주식'
          ? s.currentPrice * s.shares * s.dividendRate / 100
          : s.faceValue * s.shares * s.dividendRate / 100;
        return sum + annualDiv;
      }, 0);
      try {
        await setDoc(doc(db, `users/${user.uid}/snapshots`, monthKey), {
          totalAnnualDividend,
          monthlyDividend: totalAnnualDividend / 12,
          stockCount: stocks.length,
          timestamp: new Date(),
          month: monthKey
        }, { merge: true });
      } catch (e) { console.error(e); }
    };
    if (stocks.length > 0) saveMonthlySnapshot();
  }, [stocks, user]);

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await res.json();
      if (data?.rates?.KRW) {
        setExchangeRate(data.rates.KRW);
        setExchangeUpdateTime(new Date().toLocaleTimeString('ko-KR'));
      }
    } catch (e) { console.error(e); }
  };

  const fetchStockPrice = async (ticker) => {
    try {
      const API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;
      if (!API_KEY) return null;
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_KEY}`);
      const data = await res.json();
      return data.c > 0 ? data.c : null;
    } catch (e) { return null; }
  };

  useEffect(() => { if (user) loadStocks(); }, [user]);
  useEffect(() => {
    fetchExchangeRate();
    const interval = setInterval(fetchExchangeRate, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { name: '대시보드',   icon: 'fa-brands fa-dashcube' },
    { name: '포트폴리오', icon: 'fa-solid fa-file-pen' },
    { name: '배당 캘린더', icon: 'fa-regular fa-calendar-days' },
    { name: '종목별 배당', icon: 'fa-solid fa-circle-dollar-to-slot' },
    { name: '목표 달성률', icon: 'fa-solid fa-ranking-star' },
    { name: '차트 분석',  icon: 'fa-solid fa-chart-line' },
    { name: '세금 계산기', icon: 'fa-solid fa-calculator' },
    { name: '인기 배당주', icon: 'fa-solid fa-egg' },
    { name: '투자 거장',  icon: 'fa-solid fa-user-tie' },
    { name: '배당 뉴스',  icon: 'fa-solid fa-newspaper' },
    { name: '설정',       icon: 'fa-solid fa-gear' },
    { name: '정보',       icon: 'fa-solid fa-circle-info' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: C.bg }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💰</div>
          <p style={{ color: C.green, fontWeight: '600', fontSize: '16px' }}>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>

      {/* 모바일 헤더 */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '60px',
        background: C.dark, color: C.white,
        display: isMobile ? 'flex' : 'none',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        borderBottom: `2px solid ${C.green}33`,
      }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: C.white }}>
          💰 배당 포트폴리오
        </h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          style={{ background: 'none', border: 'none', color: C.white, fontSize: '24px', cursor: 'pointer' }}>
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* 사이드바 */}
      <div style={{
        width: '240px', background: C.dark, color: C.white,
        height: '100vh', display: 'flex', flexDirection: 'column',
        position: isMobile ? 'fixed' : 'relative',
        top: 0, left: 0, zIndex: 999,
        transition: 'transform 0.3s ease',
        transform: isMobile ? (isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        borderRight: `1px solid ${C.green}22`,
      }}>
        {/* 로고 */}
        <div style={{ padding: '28px 20px 20px', borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: C.white }}>
            💰 배당 포트폴리오
          </h1>
          <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: C.sub }}>US Stocks & Bonds</p>
        </div>

        {/* 프로필 */}
        {user && (
          <div style={{ padding: '14px 20px', borderBottom: `1px solid rgba(255,255,255,0.08)`, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={user.photoURL || 'https://via.placeholder.com/36'}
              alt="프로필"
              style={{ width: '36px', height: '36px', borderRadius: '50%', border: `2px solid ${C.green}` }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.displayName || '사용자'}
              </p>
              <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </p>
            </div>
          </div>
        )}

        {/* 메뉴 */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {menuItems.map((item) => {
            const active = currentPage === item.name;
            return (
              <button key={item.name}
                onClick={() => { setCurrentPage(item.name); setIsMobileMenuOpen(false); }}
                style={{
                  width: '100%', padding: '12px 20px',
                  background: active ? `${C.green}20` : 'transparent',
                  color: active ? C.green : C.sub,
                  border: 'none', borderLeft: active ? `3px solid ${C.green}` : '3px solid transparent',
                  textAlign: 'left', cursor: 'pointer', fontSize: '14px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  transition: 'all 0.2s', fontWeight: active ? '600' : '400',
                }}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = C.white; } }}
                onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.sub; } }}
              >
                <i className={item.icon} style={{ fontSize: '14px', width: '16px', textAlign: 'center' }}></i>
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* 환율 */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid rgba(255,255,255,0.08)` }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: C.green, fontWeight: '600' }}>
            💱 ₩{exchangeRate.toFixed(2)} / USD
          </p>
          {exchangeUpdateTime && (
            <p style={{ margin: 0, fontSize: '10px', color: C.sub }}>{exchangeUpdateTime} 업데이트</p>
          )}
        </div>

        {/* 로그아웃 */}
        <div style={{ padding: '12px 20px 20px' }}>
          <button
            onClick={async () => { if (window.confirm('로그아웃 하시겠습니까?')) { try { await signOut(auth); } catch (e) { alert('로그아웃 실패: ' + e.message); } } }}
            style={{
              width: '100%', padding: '10px',
              background: 'rgba(239,68,68,0.1)', color: C.red,
              border: `1px solid rgba(239,68,68,0.3)`, borderRadius: '8px',
              cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.red; e.currentTarget.style.color = C.white; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = C.red; }}
          >
            🚪 로그아웃
          </button>
        </div>
      </div>

      {/* 모바일 오버레이 */}
      {isMobileMenuOpen && (
        <div onClick={() => setIsMobileMenuOpen(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 998 }} />
      )}

      {/* 메인 콘텐츠 */}
      <div style={{
        flex: 1, padding: isMobile ? '20px' : '36px',
        paddingTop: isMobile ? '80px' : '36px',
        overflowY: 'auto', background: C.bg,
      }}>
        {currentPage === '대시보드'   && <DashboardPage stocks={stocks} user={user} exchangeRate={exchangeRate} />}
        {currentPage === '포트폴리오' && <PortfolioPage stocks={stocks} setStocks={setStocks} loadStocks={loadStocks} fetchStockPrice={fetchStockPrice} db={db} user={user} />}
        {currentPage === '차트 분석'  && <ChartPage stocks={stocks} exchangeRate={exchangeRate} />}
        {currentPage === '배당 캘린더' && <CalendarPage stocks={stocks} />}
        {currentPage === '종목별 배당' && <StockDividendPage stocks={stocks} />}
        {currentPage === '세금 계산기' && <TaxCalculatorPage exchangeRate={exchangeRate} />}
        {currentPage === '목표 달성률' && <GoalTrackerPage stocks={stocks} />}
        {currentPage === '배당 뉴스'  && <DividendNewsPage />}
        {currentPage === '인기 배당주' && <PopularDividendStocksPage />}
        {currentPage === '투자 거장'  && <InvestorLegendsPage />}
        {currentPage === '설정'       && <SettingsPage setStocks={setStocks} db={db} user={user} />}
        {currentPage === '정보'       && <LegalPages />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// 📊 포트폴리오 페이지
// ══════════════════════════════════════════
function PortfolioPage({ stocks, setStocks, fetchStockPrice, user }) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [dividendRate, setDividendRate] = useState('');
  const [dividendMonths, setDividendMonths] = useState('');
  const [loading, setLoading] = useState(false);
  const [updatingAll, setUpdatingAll] = useState(false);
  const [isStock, setIsStock] = useState(true);
  const [editingStock, setEditingStock] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const isMobile = windowWidth <= 480;

  const resetForm = () => {
    setTicker(''); setShares(''); setPurchasePrice('');
    setDividendRate(''); setDividendMonths('');
    setIsStock(true); setEditingStock(null); setIsEditMode(false);
  };

  const handleEdit = (stock) => {
    setIsEditMode(true); setEditingStock(stock);
    setIsStock(stock.assetType === '주식');
    setTicker(stock.ticker); setShares(stock.shares.toString());
    setPurchasePrice(stock.purchasePrice.toString());
    setDividendRate(stock.dividendRate.toString());
    setDividendMonths(stock.dividendMonths || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddOrUpdateStock = async () => {
    if (!ticker || !shares || !purchasePrice || !dividendRate || !dividendMonths) {
      alert('모든 필드를 입력해주세요.'); return;
    }
    setLoading(true);
    try {
      let currentPrice = parseFloat(purchasePrice);
      try {
        const apiPrice = await fetchStockPrice(ticker);
        if (apiPrice !== null && apiPrice > 0) currentPrice = apiPrice;
      } catch (e) {}

      const stockData = {
        assetType: isStock ? '주식' : '채권',
        ticker: ticker.toUpperCase(),
        shares: parseFloat(shares),
        purchasePrice: parseFloat(purchasePrice),
        currentPrice,
        dividendRate: parseFloat(dividendRate),
        dividendMonths,
        lastUpdated: new Date(),
      };

      if (isEditMode && editingStock) {
        stockData.id = editingStock.id;
        stockData.createdAt = editingStock.createdAt;
        await setDoc(doc(db, `users/${user.uid}/stocks`, editingStock.id), stockData);
        setStocks(stocks.map(s => s.id === editingStock.id ? { ...stockData, id: editingStock.id } : s));
        alert(`✅ ${ticker.toUpperCase()} 종목이 수정되었습니다!`);
      } else {
        if (stocks.some(s => s.ticker === ticker.toUpperCase())) {
          alert(`❌ ${ticker.toUpperCase()}는 이미 포트폴리오에 있습니다.`);
          setLoading(false); return;
        }
        const newId = `${ticker.toUpperCase()}_${Date.now()}`;
        stockData.id = newId; stockData.createdAt = new Date();
        await setDoc(doc(db, `users/${user.uid}/stocks`, newId), stockData);
        setStocks([...stocks, { ...stockData, id: newId }]);
        alert(`✅ ${ticker.toUpperCase()} 종목이 추가되었습니다!`);
      }
      resetForm();
    } catch (e) {
      console.error(e); alert('저장 중 오류가 발생했습니다.');
    } finally { setLoading(false); }
  };

  const handleUpdateAllPrices = async () => {
    if (stocks.length === 0) { alert('업데이트할 종목이 없습니다.'); return; }
    if (!window.confirm(`${stocks.length}개 종목의 가격을 업데이트하시겠습니까?`)) return;
    setUpdatingAll(true);
    let successCount = 0, failCount = 0;
    for (const stock of stocks) {
      try {
        const newPrice = await fetchStockPrice(stock.ticker);
        if (newPrice !== null && newPrice > 0) {
          const updated = { ...stock, currentPrice: newPrice, lastUpdated: new Date() };
          await setDoc(doc(db, `users/${user.uid}/stocks`, stock.id), updated);
          setStocks(prev => prev.map(s => s.id === stock.id ? updated : s));
          successCount++;
        } else failCount++;
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) { failCount++; }
    }
    setUpdatingAll(false);
    alert(`✅ 업데이트 완료!\n성공: ${successCount}개\n실패: ${failCount}개`);
  };

  const handleDeleteStock = async (stockId) => {
    if (!window.confirm('정말 이 종목을 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/stocks`, stockId));
      setStocks(stocks.filter(s => s.id !== stockId));
      alert('✅ 종목이 삭제되었습니다.');
    } catch (e) { alert('삭제 중 오류가 발생했습니다.'); }
  };

  const handleExport = () => {
    const data = stocks.map(s => ({
      '자산유형': s.assetType, '티커': s.ticker, '수량': s.shares,
      '매수가': s.purchasePrice, '현재가': s.currentPrice,
      '배당률': s.dividendRate + '%', '배당월': s.dividendMonths,
      '평가액': (s.currentPrice * s.shares).toFixed(2),
      '수익률': (((s.currentPrice - s.purchasePrice) / s.purchasePrice) * 100).toFixed(2) + '%',
      '연배당': (s.currentPrice * s.shares * s.dividendRate / 100).toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Portfolio');
    XLSX.writeFile(wb, `배당_포트폴리오_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const inputStyle = {
    width: '100%', padding: isMobile ? '10px' : '12px',
    border: `2px solid ${C.border}`, borderRadius: '8px',
    fontSize: isMobile ? '13px' : '14px', boxSizing: 'border-box',
    outline: 'none', color: C.text,
  };

  const card = { background: C.white, padding: isMobile ? '20px' : '28px', borderRadius: '16px', marginBottom: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' };

  return (
    <div>
      {/* 헤더 */}
      <div style={{ background: C.dark, borderRadius: '20px', padding: isMobile ? '24px 20px' : '28px', marginBottom: '24px', border: `1px solid ${C.green}33` }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: C.white }}>
          <i className="fa-solid fa-chart-pie" style={{ marginRight: '10px', color: C.green }}></i>포트폴리오
        </h1>
      </div>

      {/* 수정 모드 알림 */}
      {isEditMode && (
        <div style={{ background: C.dark, color: C.white, padding: '14px 20px', borderRadius: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${C.orange}` }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: C.orange }}>
            <i className="fa-solid fa-pen-to-square" style={{ marginRight: '8px' }}></i>{editingStock?.ticker} 종목 수정 중
          </span>
          <button onClick={resetForm} style={{ background: 'rgba(255,255,255,0.1)', color: C.white, border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>
            취소
          </button>
        </div>
      )}

      {/* 종목 추가/수정 폼 */}
      <div style={card}>
        <h2 style={{ margin: '0 0 20px 0', color: C.text, fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>
          {isEditMode ? '✏️ 종목 수정' : '➕ 종목 추가'}
        </h2>

        <div style={{ background: '#f0fdf4', border: `2px solid ${C.green}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <i className="fa-solid fa-circle-info" style={{ color: C.green, fontSize: '16px', marginTop: '2px' }}></i>
          <p style={{ margin: 0, color: '#166534', fontSize: isMobile ? '12px' : '13px', lineHeight: '1.6' }}>
            일부 종목은 실시간 가격 조회가 불가능할 수 있습니다. 조회 실패 시 매수가가 현재가로 사용됩니다.
            배당률은 주기적으로 업데이트 해주세요.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: '14px' }}>
          {/* 유형 선택 */}
          <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: C.bg, borderRadius: '10px', cursor: 'pointer', border: `2px solid ${C.border}` }}>
              <input type="checkbox" checked={isStock} onChange={e => setIsStock(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600' }}>
                {isStock
                  ? <><i className="fa-solid fa-chart-line" style={{ color: C.green }}></i><span style={{ color: C.green }}>주식으로 표시</span></>
                  : <><i className="fa-solid fa-file-invoice-dollar" style={{ color: C.orange }}></i><span style={{ color: C.orange }}>채권으로 표시</span></>}
              </span>
            </label>
          </div>

          {[
            { label: '티커', value: ticker, onChange: e => setTicker(e.target.value.toUpperCase()), placeholder: '예: AAPL', type: 'text', disabled: isEditMode },
            { label: '수량', value: shares, onChange: e => setShares(e.target.value), placeholder: '보유 수량', type: 'number' },
            { label: '매수가 ($)', value: purchasePrice, onChange: e => setPurchasePrice(e.target.value), placeholder: '평균 매수가', type: 'number', step: '0.01' },
            { label: '배당률 (%)', value: dividendRate, onChange: e => setDividendRate(e.target.value), placeholder: '예: 4.5', type: 'number', step: '0.01' },
          ].map((field, i) => (
            <div key={i}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: C.text }}>{field.label}</label>
              <input {...field} style={{ ...inputStyle, opacity: field.disabled ? 0.6 : 1, cursor: field.disabled ? 'not-allowed' : 'text' }} />
            </div>
          ))}

          <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: C.text }}>배당 지급월</label>
            <input type="text" value={dividendMonths} onChange={e => setDividendMonths(e.target.value)} placeholder="예: 2,5,8,11 또는 매월" style={inputStyle} />
          </div>
        </div>

        <button onClick={handleAddOrUpdateStock} disabled={loading}
          style={{ width: '100%', padding: '14px', background: loading ? C.sub : C.green, color: C.white, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '16px', transition: 'all 0.2s' }}>
          {loading ? '처리 중...' : isEditMode ? '✅ 수정 완료' : '➕ 종목 추가'}
        </button>
      </div>

      {/* 상단 버튼 */}
      {stocks.length > 0 && (
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {[
            { label: updatingAll ? '업데이트 중...' : '모든 종목 업데이트', icon: 'fa-solid fa-rotate', bg: C.dark, onClick: handleUpdateAllPrices, disabled: updatingAll },
            { label: 'Excel 다운로드', icon: 'fa-solid fa-download', bg: C.green, onClick: handleExport },
          ].map((btn, i) => (
            <button key={i} onClick={btn.onClick} disabled={btn.disabled}
              style={{ padding: isMobile ? '10px 14px' : '12px 18px', background: btn.disabled ? C.sub : btn.bg, color: C.white, border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: btn.disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className={btn.icon}></i>{btn.label}
            </button>
          ))}
        </div>
      )}

      {/* 포트폴리오 목록 */}
      {stocks.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.2 }}>📊</div>
          <h3 style={{ margin: '0 0 8px 0', color: C.sub }}>아직 종목이 없어요</h3>
          <p style={{ margin: 0, color: C.border, fontSize: '14px' }}>첫 번째 종목을 추가해보세요!</p>
        </div>
      ) : !isMobile ? (
        <div style={{ ...card, overflowX: 'auto', padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['유형','티커','수량','매수가','현재가','수익률','배당률','배당월','관리'].map(h => (
                  <th key={h} style={{ padding: '14px 12px', textAlign: h === '관리' ? 'center' : h === '수량' || h === '매수가' || h === '현재가' || h === '수익률' || h === '배당률' ? 'right' : 'left', color: C.sub, fontSize: '12px', fontWeight: '600', borderBottom: `2px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stocks.map(stock => {
                const profitRate = ((stock.currentPrice - stock.purchasePrice) / stock.purchasePrice * 100).toFixed(2);
                return (
                  <tr key={stock.id} style={{ borderBottom: `1px solid ${C.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = C.bg}
                    onMouseLeave={e => e.currentTarget.style.background = C.white}>
                    <td style={{ padding: '12px' }}>
                      <span style={{ background: stock.assetType === '주식' ? '#f0fdf4' : '#fff7ed', color: stock.assetType === '주식' ? C.green : C.orange, padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                        {stock.assetType === '주식' ? '📈' : '📜'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 'bold', fontSize: '14px', color: C.text }}>{stock.ticker}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: C.sub }}>{stock.shares}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: C.sub }}>${stock.purchasePrice.toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: C.text }}>${stock.currentPrice.toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: parseFloat(profitRate) >= 0 ? C.green : C.red }}>
                      {profitRate >= 0 ? '+' : ''}{profitRate}%
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: C.sub }}>{stock.dividendRate}%</td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: C.sub }}>{stock.dividendMonths}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        {[
                          { icon: 'fa-solid fa-pen-to-square', bg: C.dark, onClick: () => handleEdit(stock) },
                          { icon: 'fa-solid fa-trash-can', bg: C.red, onClick: () => handleDeleteStock(stock.id) },
                        ].map((btn, i) => (
                          <button key={i} onClick={btn.onClick}
                            style={{ padding: '6px 10px', background: btn.bg, color: C.white, border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                            <i className={btn.icon}></i>
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {stocks.map(stock => {
            const profitRate = ((stock.currentPrice - stock.purchasePrice) / stock.purchasePrice * 100).toFixed(2);
            return (
              <div key={stock.id} style={{ background: C.white, padding: '16px', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '12px', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: stock.assetType === '주식' ? '#f0fdf4' : '#fff7ed', color: stock.assetType === '주식' ? C.green : C.orange, padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                      {stock.assetType === '주식' ? '📈' : '📜'}
                    </span>
                    <strong style={{ fontSize: '16px', color: C.text }}>{stock.ticker}</strong>
                  </div>
                  <span style={{ color: parseFloat(profitRate) >= 0 ? C.green : C.red, fontWeight: 'bold', fontSize: '14px' }}>
                    {profitRate >= 0 ? '+' : ''}{profitRate}%
                  </span>
                </div>
                <div style={{ fontSize: '13px', lineHeight: '1.8', color: C.sub }}>
                  {[['수량', stock.shares], ['매수가', `$${stock.purchasePrice.toFixed(2)}`], ['현재가', `$${stock.currentPrice.toFixed(2)}`], ['배당률', `${stock.dividendRate}%`], ['배당월', stock.dividendMonths]].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{k}:</span><strong style={{ color: C.text }}>{v}</strong>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>
                  <button onClick={() => handleEdit(stock)}
                    style={{ flex: 1, padding: '8px', background: C.dark, color: C.white, border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <i className="fa-solid fa-pen-to-square"></i> 수정
                  </button>
                  <button onClick={() => handleDeleteStock(stock.id)}
                    style={{ padding: '8px 14px', background: C.red, color: C.white, border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// 📅 배당 캘린더
// ══════════════════════════════════════════
function CalendarPage({ stocks }) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const isMobile = windowWidth <= 480;
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentMonth = new Date().getMonth() + 1;

  const getMonthlyStocks = (month) => stocks.filter(s => {
    if (!s.dividendMonths) return false;
    if (s.dividendMonths === '매월') return true;
    const arr = s.dividendMonths.split(',').map(m => m.trim());
    return arr.includes(`${month}월`) || arr.includes(String(month));
  });

  const getMonthlyDividend = (monthStocks) => monthStocks.reduce((sum, s) => {
    const price = parseFloat(s.currentPrice) || 0;
    const shares = parseFloat(s.shares) || 0;
    const rate = parseFloat(s.dividendRate) || 0;
    const annualDiv = price * shares * rate / 100;
    let freq = 12;
    if (s.dividendMonths && s.dividendMonths !== '매월') {
      const arr = s.dividendMonths.split(',').filter(m => m.trim());
      freq = arr.length > 0 ? arr.length : 12;
    }
    return sum + annualDiv / freq;
  }, 0);

  const card = { background: C.white, padding: isMobile ? '20px' : '28px', borderRadius: '16px', marginBottom: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' };

  const annualTotal = months.reduce((sum, m) => sum + getMonthlyDividend(getMonthlyStocks(m)), 0);
  const thisMonthTotal = getMonthlyDividend(getMonthlyStocks(currentMonth));
  const avgMonthly = stocks.reduce((sum, s) => {
    const price = parseFloat(s.currentPrice) || 0;
    const shares = parseFloat(s.shares) || 0;
    const rate = parseFloat(s.dividendRate) || 0;
    return sum + (price * shares * rate / 100);
  }, 0) / 12;
  const activeMths = months.filter(m => getMonthlyStocks(m).length > 0).length;

  return (
    <div>
      <div style={{ background: C.dark, borderRadius: '20px', padding: isMobile ? '24px 20px' : '28px', marginBottom: '24px', border: `1px solid ${C.green}33` }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: C.white }}>📅 배당 캘린더</h1>
      </div>

      {/* 월별 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3,1fr)' : 'repeat(4,1fr)', gap: isMobile ? '10px' : '16px', marginBottom: '24px' }}>
        {months.map(month => {
          const monthStocks = getMonthlyStocks(month);
          const dividend = getMonthlyDividend(monthStocks);
          const isActive = monthStocks.length > 0;
          const isCurrent = month === currentMonth;

          return (
            <div key={month} style={{
              background: isActive ? '#f0fdf4' : C.white,
              padding: isMobile ? '14px 10px' : '18px',
              borderRadius: '12px',
              textAlign: 'center',
              border: isCurrent ? `2.5px solid ${C.greenL}` : isActive ? `2px solid ${C.green}` : `2px solid ${C.border}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              transition: 'all 0.2s', cursor: isActive ? 'pointer' : 'default',
            }}
              onMouseEnter={e => { if (isActive) { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 6px 16px ${C.green}33`; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
            >
              <h3 style={{ margin: '0 0 8px 0', color: isActive ? C.green : C.sub, fontSize: isMobile ? '14px' : '18px', fontWeight: 'bold' }}>
                {month}월
              </h3>
              {isActive && <div style={{ fontSize: isMobile ? '20px' : '18px', margin: '6px 0' }}></div>}
              <p style={{ margin: '6px 0', fontSize: isMobile ? '16px' : '20px', fontWeight: 'bold', color: isActive ? C.text : C.sub }}>
                ${(dividend || 0).toFixed(0)}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: isMobile ? '10px' : '12px', color: C.sub }}>
                {monthStocks.length}개 종목
              </p>
              {isActive && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${C.green}33`, fontSize: isMobile ? '9px' : '10px', color: C.sub, lineHeight: '1.4' }}>
                  {monthStocks.map(s => s.ticker).join(', ')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 연간 요약 */}
      <div style={card}>
        <h2 style={{ margin: '0 0 18px 0', color: C.text, fontSize: isMobile ? '17px' : '20px', fontWeight: 'bold' }}>📊 연간 배당 요약</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4,1fr)', gap: isMobile ? '10px' : '16px' }}>
          {[
            { label: '연간 총 배당', value: `$${annualTotal.toFixed(0)}`, color: C.green },
            { label: '이번 달 배당', value: `$${thisMonthTotal.toFixed(0)}`, color: C.orange },
            { label: '평균 월 배당', value: `$${avgMonthly.toFixed(0)}`, color: C.text },
            { label: '배당 지급 월', value: `${activeMths}개월`, color: C.text },
          ].map((item, i) => (
            <div key={i} style={{ background: C.bg, padding: isMobile ? '14px' : '18px', borderRadius: '10px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: isMobile ? '12px' : '13px', color: C.sub }}>{item.label}</p>
              <p style={{ margin: 0, fontSize: isMobile ? '22px' : '26px', fontWeight: 'bold', color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// 💵 종목별 배당
// ══════════════════════════════════════════
function StockDividendPage({ stocks }) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const isMobile = windowWidth <= 480;

  return (
    <div>
      <div style={{ background: C.dark, borderRadius: '20px', padding: isMobile ? '24px 20px' : '28px', marginBottom: '24px', border: `1px solid ${C.green}33` }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: C.white }}>💵 종목별 배당 스케줄</h1>
      </div>

      {stocks.length === 0 ? (
        <div style={{ background: C.white, padding: '60px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
          <p style={{ fontSize: '48px', margin: 0, opacity: 0.3 }}>📅</p>
          <p style={{ fontSize: '16px', margin: '20px 0 0 0', color: C.sub }}>종목을 추가하면 배당 스케줄을 확인할 수 있어요!</p>
        </div>
      ) : (
        stocks.map(stock => {
          const annualDiv = (parseFloat(stock.currentPrice) || 0) * (parseFloat(stock.shares) || 0) * (parseFloat(stock.dividendRate) || 0) / 100;
          return (
            <div key={stock.id} style={{ background: C.white, padding: isMobile ? '18px' : '24px', borderRadius: '16px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                <div>
                  <h2 style={{ margin: 0, color: C.green, fontSize: isMobile ? '18px' : '22px' }}>{stock.ticker}</h2>
                  <p style={{ margin: '4px 0 0 0', color: C.sub, fontSize: '13px' }}>{stock.assetType} | 배당률: {stock.dividendRate}%</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: C.sub }}>연간 예상 배당</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: C.green }}>
                    ${(annualDiv || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth <= 480 ? 'repeat(3,1fr)' : window.innerWidth <= 768 ? 'repeat(4,1fr)' : 'repeat(12,1fr)', gap: isMobile ? '6px' : '8px' }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                  let hasDividend = false;
                  if (stock.dividendMonths === '매월') { hasDividend = true; }
                  else if (stock.dividendMonths) {
                    const arr = stock.dividendMonths.includes('월')
                      ? stock.dividendMonths.split(',').map(m => m.trim())
                      : stock.dividendMonths.split(',').map(m => m.trim());
                    hasDividend = stock.dividendMonths.includes('월')
                      ? arr.includes(`${month}월`)
                      : arr.includes(String(month));
                  }
                  return (
                    <div key={month} style={{
                      background: hasDividend ? '#f0fdf4' : C.bg,
                      padding: '12px 6px', borderRadius: '8px', textAlign: 'center',
                      border: hasDividend ? `2px solid ${C.green}` : `1px solid ${C.border}`,
                    }}>
                      <p style={{ margin: 0, fontSize: '11px', color: hasDividend ? C.green : C.sub, fontWeight: hasDividend ? '600' : '400' }}>{month}월</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '16px', color: hasDividend ? C.green : C.sub }}>
                        {hasDividend ? <i className="fa-solid fa-circle-dollar-to-slot"></i> : '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// 💸 세금 계산기
// ══════════════════════════════════════════
function TaxCalculatorPage({ exchangeRate }) {
  const [dividendUSD, setDividendUSD] = useState('');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const isMobile = windowWidth <= 480;

  const dividendKRW = Math.round(Number(dividendUSD) * exchangeRate);
  const foreignTax = Math.round(dividendKRW * 0.15);
  const domesticTax = Math.round((dividendKRW - foreignTax) * 0.154);
  const actualIncome = Math.round(dividendKRW - foreignTax - domesticTax);
  const effectiveTaxRate = dividendKRW > 0 ? ((foreignTax + domesticTax) / dividendKRW * 100).toFixed(2) : 0;

  const card = { background: C.white, padding: isMobile ? '20px' : '28px', borderRadius: '16px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' };

  return (
    <div>
      <div style={{ background: C.dark, borderRadius: '20px', padding: isMobile ? '24px 20px' : '28px', marginBottom: '24px', border: `1px solid ${C.orange}33` }}>
        <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: C.sub }}>미국 주식 배당</p>
        <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: C.white }}>🧾 배당 세금 계산기</h1>
      </div>

      {/* 환율 카드 */}
      <div style={{ background: C.dark, borderRadius: '16px', padding: isMobile ? '18px' : '22px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${C.orange}44` }}>
        <div>
          <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: C.sub }}>실시간 환율</p>
          <p style={{ margin: 0, fontSize: '11px', color: C.sub }}>{new Date().toLocaleDateString('ko-KR')} 기준</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: isMobile ? '24px' : '28px', fontWeight: 'bold', color: C.orange }}>₩{exchangeRate.toFixed(2)}</p>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: C.sub }}>/ USD</p>
        </div>
      </div>

      {/* 입력 */}
      <div style={card}>
        <label style={{ display: 'block', marginBottom: '10px', color: C.text, fontSize: isMobile ? '15px' : '16px', fontWeight: 'bold' }}>
          💵 배당금 입력 (달러)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', border: `2px solid ${C.green}`, borderRadius: '12px', padding: '0 16px', height: '56px' }}>
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: C.green, marginRight: '8px' }}>$</span>
          <input type="number" value={dividendUSD} onChange={e => setDividendUSD(e.target.value)} placeholder="0"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: isMobile ? '22px' : '26px', fontWeight: 'bold', color: C.text }} />
          <span style={{ fontSize: '13px', color: C.sub, fontWeight: '600' }}>USD</span>
        </div>
        {dividendUSD && Number(dividendUSD) > 0 && (
          <div style={{ marginTop: '12px', padding: '12px 14px', background: '#f0fdf4', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: C.green }}>≈ ₩{dividendKRW.toLocaleString()}</span>
            <span style={{ fontSize: '12px', color: C.sub }}>오늘 환율 기준</span>
          </div>
        )}
      </div>

      {/* 세금 분석 */}
      <div style={card}>
        <h2 style={{ margin: '0 0 16px 0', color: C.text, fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold' }}>📊 세금 분석</h2>
        {[
          { label: '총 배당금', desc: '환율 적용 전체 금액', amount: `+${dividendKRW.toLocaleString()}원`, color: C.green, dot: C.green },
          { label: '해외 원천징수세', desc: '미국 세율 15%', amount: `-${foreignTax.toLocaleString()}원`, color: C.red, dot: C.red },
          { label: '국내 배당소득세', desc: '차감 후 15.4%', amount: `-${domesticTax.toLocaleString()}원`, color: C.orange, dot: C.orange },
        ].map((item, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingVertical: '12px', padding: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.dot }} />
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: C.text }}>{item.label}</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: C.sub }}>{item.desc}</p>
                </div>
              </div>
              <span style={{ fontSize: '15px', fontWeight: 'bold', color: item.color }}>{item.amount}</span>
            </div>
            {i < 2 && <div style={{ height: '1px', background: C.border }} />}
          </div>
        ))}
        <div style={{ height: '8px', background: C.bg, borderRadius: '4px', overflow: 'hidden', marginTop: '14px' }}>
          <div style={{ height: '100%', width: `${Math.min(parseFloat(effectiveTaxRate), 100)}%`, background: C.orange, borderRadius: '4px', transition: 'width 0.5s' }} />
        </div>
        <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: C.sub, textAlign: 'right' }}>실효세율 {effectiveTaxRate}%</p>
      </div>

      {/* 실제 수령액 */}
      <div style={{ background: C.dark, borderRadius: '20px', padding: isMobile ? '24px' : '32px', marginBottom: '20px', border: `1px solid ${C.green}33` }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: C.sub }}>💰 실제 수령액</p>
        <p style={{ margin: '0 0 6px 0', fontSize: isMobile ? '36px' : '44px', fontWeight: 'bold', color: C.white }}>
          {actualIncome.toLocaleString()}<span style={{ fontSize: '20px', color: C.sub, fontWeight: 'normal' }}>원</span>
        </p>
        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: C.green }}>${dividendUSD || '0'} → 세금 차감 후</p>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px' }}>
          {[
            { label: '총 세금', value: `${(foreignTax + domesticTax).toLocaleString()}원` },
            { label: '실효세율', value: `${effectiveTaxRate}%` },
            { label: '세후 비율', value: `${dividendKRW > 0 ? ((actualIncome / dividendKRW) * 100).toFixed(1) : '0.0'}%` },
          ].map((item, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: C.sub }}>{item.label}</p>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: C.white }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 안내 */}
      <div style={{ background: '#fff7ed', borderRadius: '14px', padding: '16px 18px', borderLeft: `4px solid ${C.orange}` }}>
        <p style={{ margin: '0 0 10px 0', fontWeight: '700', color: '#c2410c', fontSize: '13px' }}>📌 계산 기준 안내</p>
        <BulletList items={['미국 주식 배당소득세: 미국에서 15% 원천징수', '국내 배당소득세: 원천징수 후 잔액의 15.4%', '금융소득 2,000만원 초과 시 종합과세 대상', '실제 세액은 개인 상황에 따라 다를 수 있어요']} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// 🎯 목표 달성률
// ══════════════════════════════════════════
function GoalTrackerPage({ stocks }) {
  const [monthlyGoal, setMonthlyGoal] = useState(localStorage.getItem('monthlyGoal') || '500000');
  const [isEditing, setIsEditing] = useState(false);
  const [inputGoal, setInputGoal] = useState(localStorage.getItem('monthlyGoal') || '500000');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const isMobile = windowWidth <= 480;

  const currentMonthlyDividend = stocks.reduce((sum, s) => {
    const price = parseFloat(s.currentPrice) || 0;
    const shares = parseFloat(s.shares) || 0;
    const rate = parseFloat(s.dividendRate) || 0;
    return sum + (price * shares * rate / 100 / 12);
  }, 0);

  const currentMonthlyKRW = Math.round(currentMonthlyDividend * 1380);
  const goalKRW = Math.round(parseFloat(monthlyGoal));
  const achievementRate = goalKRW > 0 ? parseFloat(((currentMonthlyKRW / goalKRW) * 100).toFixed(1)) : 0;
  const isAchieved = achievementRate >= 100;

  const saveGoal = () => {
    localStorage.setItem('monthlyGoal', inputGoal);
    setMonthlyGoal(inputGoal);
    setIsEditing(false);
    alert('목표가 저장되었습니다!');
  };

  const stocksWithContribution = stocks.map(s => {
    const price = parseFloat(s.currentPrice) || 0;
    const shares = parseFloat(s.shares) || 0;
    const rate = parseFloat(s.dividendRate) || 0;
    const monthlyDiv = Math.round(price * shares * rate / 100 / 12 * 1380);
    return { ...s, monthlyDiv, contribution: currentMonthlyKRW > 0 ? (monthlyDiv / currentMonthlyKRW * 100).toFixed(1) : '0.0' };
  }).sort((a, b) => b.monthlyDiv - a.monthlyDiv);

  const card = { background: C.white, padding: isMobile ? '20px' : '24px', borderRadius: '16px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' };

  return (
    <div>
      <div style={{ background: C.dark, borderRadius: '20px', padding: isMobile ? '24px 20px' : '28px', marginBottom: '24px', border: `1px solid ${C.green}33` }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: C.white }}>🎯 목표 달성률</h1>
      </div>

      {/* 메인 달성률 카드 */}
      <div style={{ background: C.dark, borderRadius: '20px', padding: isMobile ? '22px' : '28px', marginBottom: '20px', border: `1px solid ${C.green}33` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: C.sub }}>현재 월 배당</p>
            <p style={{ margin: 0, fontSize: isMobile ? '28px' : '34px', fontWeight: 'bold', color: C.white }}>
              {currentMonthlyKRW.toLocaleString()}<span style={{ fontSize: '16px', color: C.sub }}>원</span>
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: C.green }}>${currentMonthlyDividend.toFixed(2)}</p>
          </div>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: isAchieved ? C.green : C.orange, alignItems: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: C.white }}>{achievementRate}%</span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)' }}>달성</span>
          </div>
        </div>
        <div style={{ height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden', marginBottom: '8px' }}>
          <div style={{ height: '100%', width: `${Math.min(achievementRate, 100)}%`, background: isAchieved ? C.green : C.orange, borderRadius: '5px', transition: 'width 1s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: C.sub }}>0원</span>
          <span style={{ fontSize: '11px', color: isAchieved ? C.green : C.orange }}>목표 {goalKRW.toLocaleString()}원</span>
        </div>
        <div style={{ marginTop: '14px', padding: '12px', background: isAchieved ? 'rgba(34,197,94,0.15)' : 'rgba(251,146,60,0.15)', borderRadius: '10px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: isAchieved ? C.green : C.orange }}>
            {isAchieved ? '🎉 목표 달성!' : `목표까지 ${(goalKRW - currentMonthlyKRW).toLocaleString()}원 남음`}
          </p>
        </div>
      </div>

      {/* 목표 설정 */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isEditing ? '16px' : 0 }}>
          <h2 style={{ margin: 0, color: C.text, fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold' }}>💰 월 배당 목표</h2>
          {!isEditing && (
            <button onClick={() => { setInputGoal(monthlyGoal); setIsEditing(true); }}
              style={{ padding: '7px 14px', background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
              ✏️ 수정
            </button>
          )}
        </div>
        {isEditing ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <input type="number" value={inputGoal} onChange={e => setInputGoal(e.target.value)} autoFocus
                style={{ flex: 1, height: '48px', border: `2px solid ${C.green}`, borderRadius: '10px', padding: '0 14px', fontSize: '18px', color: C.text, outline: 'none' }} />
              <span style={{ fontSize: '16px', fontWeight: '600', color: C.text }}>원</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={saveGoal} style={{ flex: 1, height: '44px', background: C.green, color: C.white, border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>저장</button>
              <button onClick={() => setIsEditing(false)} style={{ flex: 1, height: '44px', background: C.sub, color: C.white, border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>취소</button>
            </div>
          </div>
        ) : (
          <p style={{ margin: '12px 0 0 0', fontSize: isMobile ? '24px' : '28px', fontWeight: 'bold', color: C.text }}>{goalKRW.toLocaleString()}원</p>
        )}
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: '연간 예상 배당', value: `${(currentMonthlyKRW * 12).toLocaleString()}원`, icon: '📈', border: C.green },
          { label: '목표까지', value: isAchieved ? '달성!' : `${(goalKRW - currentMonthlyKRW).toLocaleString()}원`, icon: '🏆', border: C.orange, color: isAchieved ? C.green : C.orange },
        ].map((item, i) => (
          <div key={i} style={{ flex: 1, background: C.white, borderRadius: '14px', padding: '16px', borderLeft: `4px solid ${item.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '20px' }}>{item.icon}</p>
            <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: C.sub }}>{item.label}</p>
            <p style={{ margin: 0, fontSize: isMobile ? '14px' : '16px', fontWeight: 'bold', color: item.color || C.text }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* 종목별 기여도 */}
      {stocks.length > 0 && (
        <div style={card}>
          <h2 style={{ margin: '0 0 16px 0', color: C.text, fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold' }}>📊 종목별 기여도</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? '13px' : '14px' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  {['종목', '월 배당', '기여율'].map(h => (
                    <th key={h} style={{ padding: isMobile ? '10px 8px' : '12px', textAlign: h === '종목' ? 'left' : 'right', color: C.sub, fontSize: '12px', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stocksWithContribution.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: isMobile ? '10px 8px' : '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: i === 0 ? C.green : i < 3 ? C.greenL : C.border }} />
                        <strong style={{ color: C.text }}>{s.ticker}</strong>
                      </div>
                    </td>
                    <td style={{ padding: isMobile ? '10px 8px' : '12px', textAlign: 'right', color: C.text }}>{s.monthlyDiv.toLocaleString()}원</td>
                    <td style={{ padding: isMobile ? '10px 8px' : '12px', textAlign: 'right' }}>
                      <span style={{ background: parseFloat(s.contribution) >= 30 ? C.dark : parseFloat(s.contribution) >= 15 ? C.orange : C.green, color: C.white, padding: isMobile ? '3px 10px' : '4px 12px', borderRadius: '12px', fontSize: isMobile ? '11px' : '12px', fontWeight: '600' }}>
                        {s.contribution}%
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

// ══════════════════════════════════════════
// 📰 배당 뉴스
// ══════════════════════════════════════════
function DividendNewsPage() {
  return (
    <div>
      <div style={{ background: C.dark, borderRadius: '20px', padding: '28px', marginBottom: '24px', border: `1px solid ${C.green}33` }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: C.white }}>📰 배당 뉴스</h1>
      </div>
      <div style={{ background: C.white, padding: '60px 40px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', borderLeft: `4px solid ${C.orange}` }}>
        <p style={{ margin: '0 0 16px 0', fontSize: '48px', opacity: 0.4 }}>📰</p>
        <p style={{ margin: 0, color: C.sub, fontSize: '15px', lineHeight: '1.6' }}>
          <strong style={{ color: C.text }}>배당 뉴스 기능은 준비 중입니다.</strong><br /><br />
          Restrict News API Delivery Policy
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// 🏆 인기 배당주 TOP 30
// ══════════════════════════════════════════
function PopularDividendStocksPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [sortBy, setSortBy] = useState('yield');

  const topStocksList = [
    { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', dividendYield: 0.52, rating: 5, dividendMonths: [2,5,8,11], consecutiveYears: 12 },
    { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology', dividendYield: 0.73, rating: 5, dividendMonths: [2,5,8,11], consecutiveYears: 21 },
    { ticker: 'AVGO', name: 'Broadcom', sector: 'Technology', dividendYield: 1.8, rating: 4, dividendMonths: [3,6,9,12], consecutiveYears: 13 },
    { ticker: 'CSCO', name: 'Cisco', sector: 'Technology', dividendYield: 3.1, rating: 4, dividendMonths: [1,4,7,10], consecutiveYears: 12 },
    { ticker: 'IBM', name: 'IBM', sector: 'Technology', dividendYield: 3.8, rating: 4, dividendMonths: [3,6,9,12], consecutiveYears: 28 },
    { ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', dividendYield: 3.1, rating: 5, dividendMonths: [3,6,9,12], consecutiveYears: 62 },
    { ticker: 'ABBV', name: 'AbbVie', sector: 'Healthcare', dividendYield: 3.5, rating: 5, dividendMonths: [2,5,8,11], consecutiveYears: 11 },
    { ticker: 'PFE', name: 'Pfizer', sector: 'Healthcare', dividendYield: 5.9, rating: 4, dividendMonths: [3,6,9,12], consecutiveYears: 14 },
    { ticker: 'MRK', name: 'Merck', sector: 'Healthcare', dividendYield: 2.8, rating: 4, dividendMonths: [1,4,7,10], consecutiveYears: 13 },
    { ticker: 'BMY', name: 'Bristol Myers', sector: 'Healthcare', dividendYield: 4.2, rating: 4, dividendMonths: [2,5,8,11], consecutiveYears: 15 },
    { ticker: 'KO', name: 'Coca-Cola', sector: 'Consumer Staples', dividendYield: 3.05, rating: 5, dividendMonths: [1,4,7,10], consecutiveYears: 63 },
    { ticker: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', dividendYield: 2.42, rating: 5, dividendMonths: [2,5,8,11], consecutiveYears: 68 },
    { ticker: 'PEP', name: 'PepsiCo', sector: 'Consumer Staples', dividendYield: 2.9, rating: 5, dividendMonths: [1,3,6,9], consecutiveYears: 51 },
    { ticker: 'PM', name: 'Philip Morris', sector: 'Consumer Staples', dividendYield: 5.1, rating: 4, dividendMonths: [1,4,7,10], consecutiveYears: 15 },
    { ticker: 'MO', name: 'Altria', sector: 'Consumer Staples', dividendYield: 8.2, rating: 4, dividendMonths: [1,4,7,10], consecutiveYears: 54 },
    { ticker: 'JPM', name: 'JPMorgan Chase', sector: 'Financials', dividendYield: 2.3, rating: 5, dividendMonths: [1,4,7,10], consecutiveYears: 13 },
    { ticker: 'BAC', name: 'Bank of America', sector: 'Financials', dividendYield: 2.5, rating: 4, dividendMonths: [3,6,9,12], consecutiveYears: 11 },
    { ticker: 'WFC', name: 'Wells Fargo', sector: 'Financials', dividendYield: 2.7, rating: 4, dividendMonths: [3,6,9,12], consecutiveYears: 12 },
    { ticker: 'GS', name: 'Goldman Sachs', sector: 'Financials', dividendYield: 2.4, rating: 4, dividendMonths: [3,6,9,12], consecutiveYears: 9 },
    { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy', dividendYield: 3.4, rating: 5, dividendMonths: [3,6,9,12], consecutiveYears: 41 },
    { ticker: 'CVX', name: 'Chevron', sector: 'Energy', dividendYield: 3.8, rating: 5, dividendMonths: [3,6,9,12], consecutiveYears: 37 },
    { ticker: 'COP', name: 'ConocoPhillips', sector: 'Energy', dividendYield: 3.2, rating: 4, dividendMonths: [3,6,9,12], consecutiveYears: 33 },
    { ticker: 'VZ', name: 'Verizon', sector: 'Telecom', dividendYield: 6.5, rating: 4, dividendMonths: [2,5,8,11], consecutiveYears: 18 },
    { ticker: 'T', name: 'AT&T', sector: 'Telecom', dividendYield: 4.8, rating: 3, dividendMonths: [2,5,8,11], consecutiveYears: 40 },
    { ticker: 'NEE', name: 'NextEra Energy', sector: 'Utilities', dividendYield: 2.6, rating: 5, dividendMonths: [3,6,9,12], consecutiveYears: 29 },
    { ticker: 'DUK', name: 'Duke Energy', sector: 'Utilities', dividendYield: 4.1, rating: 4, dividendMonths: [3,6,9,12], consecutiveYears: 18 },
    { ticker: 'O', name: 'Realty Income', sector: 'REITs', dividendYield: 5.2, rating: 4, dividendMonths: [1,2,3,4,5,6,7,8,9,10,11,12], consecutiveYears: 29 },
    { ticker: 'STAG', name: 'Stag Industrial', sector: 'REITs', dividendYield: 4.3, rating: 4, dividendMonths: [1,2,3,4,5,6,7,8,9,10,11,12], consecutiveYears: 12 },
    { ticker: 'WPC', name: 'W.P. Carey', sector: 'REITs', dividendYield: 5.8, rating: 4, dividendMonths: [1,2,3,4,5,6,7,8,9,10,11,12], consecutiveYears: 27 },
    { ticker: 'MPW', name: 'Medical Properties', sector: 'REITs', dividendYield: 9.5, rating: 3, dividendMonths: [1,4,7,10], consecutiveYears: 11 },
  ];

  const SECTOR_COLORS = { Technology: '#667eea', Healthcare: C.green, 'Consumer Staples': C.orange, Financials: '#f59e0b', Energy: C.red, Telecom: '#8b5cf6', Utilities: '#06b6d4', REITs: '#ec4899' };
  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

  const sortedStocks = [...topStocksList].sort((a, b) => {
    if (sortBy === 'yield') return b.dividendYield - a.dividendYield;
    if (sortBy === 'growth') return b.consecutiveYears - a.consecutiveYears;
    return b.rating - a.rating;
  });

  const monthStocks = sortedStocks.filter(s => s.dividendMonths?.includes(selectedMonth));

  return (
    <div>
      <div style={{ background: C.dark, borderRadius: '20px', padding: '28px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', border: `1px solid ${C.green}33` }}>
        <div>
          <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: C.sub }}>2026년 4월 기준</p>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: C.white }}>🏆 인기 배당주 TOP 30</h1>
        </div>
        <span style={{ background: '#f59e0b', color: C.white, padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>수동업데이트</span>
      </div>

      {/* 정렬 */}
      <div style={{ background: C.white, padding: '14px 16px', borderRadius: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: C.text, marginRight: '4px' }}>정렬</span>
        {[{ key: 'yield', label: '💰 배당률' }, { key: 'growth', label: '📈 연속증가' }, { key: 'rating', label: '⭐ 평점' }].map(item => (
          <button key={item.key} onClick={() => setSortBy(item.key)}
            style={{ padding: '8px 14px', background: sortBy === item.key ? C.dark : C.bg, color: sortBy === item.key ? C.white : C.sub, border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', transition: 'all 0.2s' }}>
            {item.label}
          </button>
        ))}
      </div>

      {/* 종목 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '16px', marginBottom: '32px' }}>
        {sortedStocks.map((stock, index) => {
          const sectorColor = SECTOR_COLORS[stock.sector] || C.sub;
          return (
            <div key={stock.ticker} style={{ background: C.white, padding: '18px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', position: 'relative', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)'; }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ background: sectorColor + '20', color: sectorColor, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>{stock.sector}</span>
                <span style={{ background: index < 5 ? '#f59e0b' : C.sub, color: C.white, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>#{index + 1}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold', color: C.text }}>{stock.ticker}</h3>
                  <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: C.sub }}>{stock.name}</p>
                  <span style={{ fontSize: '13px' }}>{'⭐'.repeat(stock.rating)}{'☆'.repeat(5 - stock.rating)}</span>
                </div>
                <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '10px 14px', textAlign: 'center', border: `1px solid ${C.green}44` }}>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: C.green }}>{stock.dividendYield}%</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: C.sub }}>배당률</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: C.orange, fontWeight: '600' }}>{stock.consecutiveYears}년 연속</p>
                </div>
              </div>
              <div style={{ paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: C.sub, fontWeight: '600' }}>📅 배당 지급월</p>
                {stock.dividendMonths.length === 12 ? (
                  <span style={{ background: C.green, color: C.white, padding: '4px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}>💰 매월 배당</span>
                ) : (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {stock.dividendMonths.map(m => (
                      <span key={m} style={{ background: sectorColor, color: C.white, padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold' }}>{m}월</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 월별 캘린더 */}
      <div style={{ background: C.white, padding: '24px', borderRadius: '16px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
        <h2 style={{ margin: '0 0 16px 0', color: C.text, fontSize: '18px', fontWeight: 'bold' }}>📅 월별 배당 캘린더</h2>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {months.map((m, i) => (
            <button key={i} onClick={() => setSelectedMonth(i + 1)}
              style={{ padding: '7px 14px', background: selectedMonth === i + 1 ? C.dark : C.bg, color: selectedMonth === i + 1 ? C.white : C.sub, border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', fontSize: '12px', transition: 'all 0.2s' }}>
              {m}
            </button>
          ))}
        </div>
        <h3 style={{ margin: '0 0 12px 0', color: C.text, fontSize: '15px' }}>{months[selectedMonth - 1]} 배당 종목 ({monthStocks.length}개)</h3>
        {monthStocks.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: C.sub }}>이 달에 배당을 지급하는 종목이 없습니다.</div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {monthStocks.map(stock => (
              <div key={stock.ticker} style={{ padding: '12px 16px', background: C.bg, borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: C.text, fontSize: '14px' }}>{stock.ticker}</strong>
                  <span style={{ marginLeft: '8px', color: C.sub, fontSize: '13px' }}>{stock.name}</span>
                  <div style={{ marginTop: '3px', fontSize: '11px', color: C.sub }}>{stock.sector} · {stock.consecutiveYears}년 연속 증배</div>
                </div>
                <span style={{ color: C.green, fontWeight: 'bold', fontSize: '15px' }}>{stock.dividendYield}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: '#fff7ed', padding: '18px', borderRadius: '14px', borderLeft: `4px solid ${C.orange}` }}>
        <p style={{ margin: '0 0 8px 0', color: '#c2410c', fontWeight: 'bold', fontSize: '13px' }}>📊 데이터 안내</p>
        <BulletList items={['배당률 및 배당 지급월은 2026년 4월 10일 기준입니다.', '실제 배당 금액 및 지급일은 기업 공시를 확인하세요.', '배당 지급월은 일반적인 패턴이며 변경될 수 있습니다.']} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// 👑 투자 거장 포트폴리오
// ══════════════════════════════════════════
function InvestorLegendsPage() {
  const [selectedInvestor, setSelectedInvestor] = useState('buffett');

  const investors = {
    buffett: { name: '워렌 버핏', emoji: '🦁', company: 'Berkshire Hathaway', strategy: '가치 투자, 장기 보유', description: '영원히 보유할 기업이 아니면 10분도 보유하지 마라', totalValue: 385000000000, quarter: '2025 Q4', lastUpdated: '2026-02-14', color: C.green,
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
        { ticker: 'CHTR', name: 'Charter Communications', value: 4800000000, percent: 1.2, shares: 7456000, change: -0.3 },
      ]},
    ackman: { name: '빌 애크먼', emoji: '🦅', company: 'Pershing Square', strategy: '집중 투자, 행동주의', description: '대형주 집중 투자. 평균 보유 기간 5-7년의 장기 투자자', totalValue: 14200000000, quarter: '2025 Q4', lastUpdated: '2026-02-14', color: C.orange,
      holdings: [
        { ticker: 'CMG', name: 'Chipotle', value: 3800000000, percent: 26.8, shares: 1845220, change: 1.2 },
        { ticker: 'HLT', name: 'Hilton', value: 3100000000, percent: 21.8, shares: 12346789, change: 0.8 },
        { ticker: 'QSR', name: 'Restaurant Brands', value: 2200000000, percent: 15.5, shares: 28500000, change: 0 },
        { ticker: 'LOW', name: "Lowe's", value: 1900000000, percent: 13.4, shares: 6234567, change: 0.5 },
        { ticker: 'BRK.B', name: 'Berkshire Hathaway', value: 1600000000, percent: 11.3, shares: 3500000, change: 3.2 },
        { ticker: 'HHH', name: 'Howard Hughes', value: 1000000000, percent: 7.0, shares: 11234567, change: 0 },
        { ticker: 'PSH', name: 'Pershing Square Holdings', value: 600000000, percent: 4.2, shares: 15000000, change: 0 },
      ]},
    dalio: { name: '레이 달리오', emoji: '🌊', company: 'Bridgewater Associates', strategy: '올웨더 포트폴리오, 분산 투자', description: '성공은 실패에서 배우는 능력에서 온다', totalValue: 112000000000, quarter: '2025 Q4', lastUpdated: '2026-02-14', color: '#667eea',
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
        { ticker: 'WMT', name: 'Walmart', value: 2700000000, percent: 2.4, shares: 14300000, change: 0.3 },
      ]},
    siegel: { name: '제레미 시겔', emoji: '📚', company: 'Wharton School', strategy: '배당성장 투자, 장기 복리', description: '배당은 거짓말을 하지 않는다', totalValue: 50000000000, quarter: '2025 Q4', lastUpdated: '2026-02-14', color: '#f59e0b',
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
        { ticker: 'CVX', name: 'Chevron', value: 2000000000, percent: 4.0, shares: 12100000, change: 0.3 },
      ]},
  };

  const current = investors[selectedInvestor];

  return (
    <div>
      <div style={{ background: C.dark, borderRadius: '20px', padding: '28px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', border: `1px solid ${C.green}33` }}>
        <div>
          <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: C.sub }}>SEC 13F 보고서 기준</p>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: C.white }}>👑 투자 거장 포트폴리오</h1>
        </div>
        <span style={{ background: '#f59e0b', color: C.white, padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>2025 Q4</span>
      </div>

      {/* 투자자 선택 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px', marginBottom: '24px' }}>
        {Object.entries(investors).map(([key, inv]) => (
          <button key={key} onClick={() => setSelectedInvestor(key)}
            style={{ padding: '18px', background: selectedInvestor === key ? inv.color : C.white, color: selectedInvestor === key ? C.white : C.text, border: `2px solid ${selectedInvestor === key ? inv.color : C.border}`, borderRadius: '14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>{inv.emoji}</div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '4px' }}>{inv.name}</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>{inv.company}</div>
          </button>
        ))}
      </div>

      {/* 프로필 카드 */}
      <div style={{ background: C.white, borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', borderLeft: `5px solid ${current.color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '32px' }}>{current.emoji}</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: C.text }}>{current.name}</h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: C.sub }}>{current.company}</p>
              </div>
            </div>
            <span style={{ background: current.color + '20', color: current.color, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
              💡 {current.strategy}
            </span>
          </div>
          <div style={{ textAlign: 'right', marginLeft: '16px' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: C.sub }}>포트폴리오 규모</p>
            <p style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 'bold', color: current.color }}>${(current.totalValue / 1000000000).toFixed(1)}B</p>
            <p style={{ margin: 0, fontSize: '10px', color: C.sub }}>{current.quarter}</p>
          </div>
        </div>
        <div style={{ background: current.color + '10', borderRadius: '10px', padding: '14px', borderLeft: `3px solid ${current.color}` }}>
          <p style={{ margin: 0, fontSize: '13px', fontStyle: 'italic', color: current.color, fontWeight: '600', lineHeight: '1.6' }}>"{current.description}"</p>
        </div>
      </div>

      {/* 보유 종목 */}
      <div style={{ background: C.white, borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
        <h2 style={{ margin: '0 0 16px 0', color: C.text, fontSize: '18px', fontWeight: 'bold' }}>📊 TOP 보유 종목 ({current.holdings.length}개)</h2>
        <div style={{ display: 'grid', gap: '10px' }}>
          {current.holdings.map((holding, index) => (
            <div key={holding.ticker} style={{ background: C.bg, borderRadius: '12px', padding: '14px', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.border; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.transform = 'translateY(0)'; }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: index === 0 ? '#f59e0b' : index < 3 ? C.sub : C.border, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', marginRight: '12px', flexShrink: 0 }}>
                  {index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                    <strong style={{ fontSize: '14px', color: C.text }}>{holding.ticker}</strong>
                    <span style={{ fontSize: '12px', color: C.sub }}>{holding.name}</span>
                    {holding.change !== 0 && (
                      <span style={{ fontSize: '11px', color: holding.change > 0 ? C.green : C.red, fontWeight: '600' }}>
                        {holding.change > 0 ? '▲' : '▼'} {Math.abs(holding.change)}%
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: C.sub }}>{holding.shares.toLocaleString()}주</p>
                </div>
              </div>
              <div style={{ height: '6px', background: C.border, borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
                <div style={{ height: '100%', width: `${Math.min(holding.percent, 100)}%`, background: current.color, borderRadius: '3px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: C.sub }}>비중</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: current.color }}>{holding.percent}%</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: C.sub }}>보유 가치</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: C.text }}>${(holding.value / 1000000000).toFixed(2)}B</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 출처 안내 */}
      <div style={{ background: '#eff6ff', borderRadius: '14px', padding: '18px', borderLeft: `4px solid #667eea` }}>
        <p style={{ margin: '0 0 10px 0', color: '#1e40af', fontWeight: 'bold', fontSize: '13px' }}>📋 데이터 출처 및 안내</p>
        <BulletList items={['SEC 13F 보고서 (분기별 공시)', '출처: SEC EDGAR, WhaleWisdom, Dataroma', '업데이트: 분기 종료 후 45일 이내', '실제 포트폴리오는 보고서 제출 시점과 다를 수 있습니다']} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// ⚙️ 설정
// ══════════════════════════════════════════
function SettingsPage({ user }) {
  const deleteAllStocks = async () => {
    if (!window.confirm('⚠️ 정말 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다!')) return;
    try {
      const snap = await getDocs(collection(db, `users/${user.uid}/stocks`));
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db, `users/${user.uid}/stocks`, d.id))));
      alert('모든 데이터가 삭제되었습니다.');
      window.location.reload();
    } catch (e) { alert('삭제 중 오류가 발생했습니다.'); }
  };

  return (
    <div>
      <div style={{ background: C.dark, borderRadius: '20px', padding: '28px', marginBottom: '24px', border: `1px solid ${C.green}33` }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: C.white }}>⚙️ 설정</h1>
      </div>
      <div style={{ background: C.white, padding: '28px', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
        <h2 style={{ color: C.text, marginBottom: '20px', fontSize: '18px', fontWeight: 'bold', paddingLeft: '12px', borderLeft: `4px solid ${C.orange}` }}>데이터 관리</h2>
        <button onClick={deleteAllStocks}
          style={{ padding: '14px 28px', background: C.red, color: C.white, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.transform = 'scale(1.02)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.transform = 'scale(1)'; }}>
          <i className="fa-solid fa-trash-can"></i> 모든 데이터 삭제
        </button>
        <p style={{ marginTop: '12px', color: C.sub, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ color: C.orange }}></i> 이 작업은 되돌릴 수 없습니다.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// ℹ️ 법적 페이지
// ══════════════════════════════════════════
function LegalPages() {
  const [currentTab, setCurrentTab] = useState('about');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const isMobile = windowWidth <= 480;

  const tabs = [
    { id: 'about', name: '소개', emoji: '👋' },
    { id: 'privacy', name: isMobile ? '개인정보' : '개인정보처리방침', emoji: '🔒' },
    { id: 'terms', name: '이용약관', emoji: '📋' },
  ];

  return (
    <div>
      <div style={{ background: C.dark, borderRadius: '20px', padding: isMobile ? '24px 20px' : '28px', marginBottom: '24px', border: `1px solid ${C.green}33` }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: C.white }}>⚙️ 정보 & 설정</h1>
      </div>

      <div style={{ background: C.white, borderRadius: '14px', padding: '6px', marginBottom: '16px', display: 'flex', gap: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        {tabs.map(tab => {
          const active = currentTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setCurrentTab(tab.id)}
              style={{ flex: 1, padding: isMobile ? '10px 6px' : '12px 16px', background: active ? C.dark : 'transparent', color: active ? C.white : C.sub, border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px', fontWeight: active ? '700' : '500', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span>{tab.emoji}</span><span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      <div style={{ background: C.white, borderRadius: '16px', padding: isMobile ? '20px' : '36px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', lineHeight: '1.8' }}>
        {currentTab === 'about' && <AboutPage />}
        {currentTab === 'privacy' && <PrivacyPage />}
        {currentTab === 'terms' && <TermsPage />}
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px', paddingBottom: '8px' }}>
        <p style={{ margin: 0, fontSize: '12px', color: C.sub }}>배당 포트폴리오 v1.0.0 (Beta)</p>
        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: C.border }}>Made with ❤️ by 모닝비</p>
      </div>
    </div>
  );
}

function AboutPage() {
  return (
    <div>
      <h2 style={{ color: C.text, marginBottom: '24px', fontSize: '20px', fontWeight: 'bold' }}>
        미국 배당주 관리하기 시스템 소개 <span style={{ fontSize: '13px', color: C.orange, fontWeight: '600' }}>Beta</span>
      </h2>
      <Section title="🎯 우리의 목표">
        <BodyText>배당관리자는 개인 투자자들이 미국 배당주식 포트폴리오를 쉽고 보기 쉽게 관리할 수 있는 도구입니다. 안정적인 현금 흐름과 월배당의 목표를 달성하기 위한 투자자들을 위해 만들어졌습니다.</BodyText>
      </Section>
      <Section title="📱 사용 안내">
        <div style={{ background: '#fff7ed', borderRadius: '10px', padding: '14px 16px', borderLeft: `4px solid ${C.orange}` }}>
          <BodyText color="#92400e">현재 로그인 기능이 없습니다. (개발 전)<br />브라우저마다 고유 캐시 생성으로 내 종목이 저장되며, 브라우저 캐시 삭제, 시크릿창 사용, 기기 이동 시 데이터 저장이 불가합니다.</BodyText>
        </div>
      </Section>
      <Section title="⚡ 주요 기능">
        <BulletList items={['주식과 채권 통합 관리', '실시간 주가 및 환율 연동', '월별 배당 캘린더 자동 생성', '배당세금 자동 계산', '목표 달성률 추적', '전문가 포트폴리오 추천']} />
      </Section>
      <Section title="📬 문의 및 만든이">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: C.orange }}>✉️</span>
            <a href="mailto:hadimorningb@gmail.com" style={{ color: C.green, fontWeight: '600', textDecoration: 'none', fontSize: '14px' }}>hadimorningb@gmail.com</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: C.orange }}>📝</span>
            <BodyText>네이버 블로그: 24시간이 모자란데요⏰ / 모닝비</BodyText>
          </div>
        </div>
      </Section>
      <div style={{ background: '#fff7ed', borderRadius: '12px', padding: '16px 18px', borderLeft: `4px solid ${C.orange}` }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: '700', color: '#c2410c', fontSize: '14px' }}>⚠️ 면책 조항</p>
        <BodyText color="#92400e">본 사이트에서 제공하는 정보는 참고용이며, 투자 권유나 조언이 아닙니다. 모든 투자 결정은 본인의 책임 하에 이루어져야 하며, 투자로 인한 손실에 대해 당사는 책임지지 않습니다.</BodyText>
      </div>
    </div>
  );
}

function PrivacyPage() {
  return (
    <div>
      <h2 style={{ color: C.text, marginBottom: '8px', fontSize: '20px', fontWeight: 'bold' }}>🔒 개인정보처리방침</h2>
      <p style={{ fontSize: '13px', color: C.sub, marginBottom: '28px' }}>시행일: 2025년 1월 1일</p>
      <Section title="1. 수집하는 개인정보">
        <BulletList items={['이메일 주소 (관리자에게 메일 문의 시)', '포트폴리오 데이터 (종목, 수량 등 - 로컬 저장)', '웹사이트 이용 기록 (Google Analytics)']} />
      </Section>
      <Section title="2. 개인정보의 이용 목적">
        <BulletList items={['서비스 제공 및 개선', '사용자 문의 및 개선', '뉴스레터 발송 (기능 개발중)', '통계 분석 및 서비스 개선']} />
      </Section>
      <Section title="3. 개인정보의 보유 기간">
        <BodyText>현재 로그인 기능이 없으므로 사용자 계정은 보유하지 않습니다. 종목 리스트에 추가된 정보는 정보 삭제 시까지 저장됩니다.</BodyText>
      </Section>
      <Section title="4. 개인정보의 제3자 제공">
        <BodyText>배당관리자는 사용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 단, 법령에 의해 요구되는 경우 예외로 합니다.</BodyText>
      </Section>
      <Section title="5. 문의처">
        <BodyText>시스템 관련 문의: <a href="mailto:hadimorningb@gmail.com" style={{ color: C.green, fontWeight: '600' }}>hadimorningb@gmail.com</a></BodyText>
      </Section>
    </div>
  );
}

function TermsPage() {
  return (
    <div>
      <h2 style={{ color: C.text, marginBottom: '8px', fontSize: '20px', fontWeight: 'bold' }}>📋 이용약관</h2>
      <p style={{ fontSize: '13px', color: C.sub, marginBottom: '28px' }}>시행일: 2025년 1월 1일</p>
      <Section title="제1조 (목적)">
        <BodyText>이 약관은 배당관리자(이하 "서비스")가 제공하는 모든 서비스의 이용과 관련하여 서비스와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</BodyText>
      </Section>
      <Section title="제2조 (서비스의 제공)">
        <BulletList items={['배당 포트폴리오 관리', '배당금 계산 및 세금 시뮬레이션', '투자 정보 및 교육 콘텐츠', '기타 배당 투자 관련 도구']} />
      </Section>
      <Section title="제3조 (서비스의 변경 및 중단)">
        <BodyText>운영상, 기술상의 필요에 따라 서비스를 변경하거나 중단할 수 있습니다. 이 경우 사전에 공지합니다.</BodyText>
      </Section>
      <Section title="제4조 (면책 조항)">
        <BulletList items={['서비스는 투자 권유나 조언을 제공하지 않습니다.', '모든 투자 결정은 이용자 본인의 책임입니다.', '서비스 이용으로 발생한 손실에 대해 책임지지 않습니다.', '제공되는 정보의 정확성을 보장하지 않습니다.']} />
      </Section>
      <Section title="제5조 (문의)">
        <BodyText>약관에 대한 문의: <a href="mailto:hadimorningb@gmail.com" style={{ color: C.green, fontWeight: '600' }}>hadimorningb@gmail.com</a></BodyText>
      </Section>
    </div>
  );
}

export default App;