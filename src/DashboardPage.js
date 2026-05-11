import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// ── 디자인 토큰 ──
const C = {
  dark:    '#1a1a2e',
  green:   '#22c55e',
  greenL:  '#86D293',
  orange:  '#fb923c',
  purple:  '#667eea',
  bg:      '#f5f5f0',
  white:   '#ffffff',
  card:    '#ffffff',
  sub:     '#94a3b8',
  text:    '#1a1a2e',
  warn:    '#fff7ed',
  warnB:   '#fb923c',
};

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

  const totalAssets = stocks.reduce((sum, s) => sum + s.currentPrice * s.shares, 0);
  const totalInvestment = stocks.reduce((sum, s) => sum + s.purchasePrice * s.shares, 0);
  const totalProfitRate = totalInvestment > 0
    ? ((totalAssets - totalInvestment) / totalInvestment * 100).toFixed(2) : 0;

  const totalAnnualDividend = stocks.reduce((sum, s) => {
    const price = parseFloat(s.currentPrice) || 0;
    const shares = parseFloat(s.shares) || 0;
    const rate = parseFloat(s.dividendRate) || 0;
    const d = price * shares * rate / 100;
    return sum + (isNaN(d) ? 0 : d);
  }, 0);

  const thisMonth = new Date().getMonth() + 1;
  const thisMonthDividends = stocks.filter(s => {
    if (!s.dividendMonths) return false;
    if (s.dividendMonths.includes('매월')) return true;
    return s.dividendMonths.split(',').map(m => parseInt(m.trim())).includes(thisMonth);
  });

  const thisMonthAmount = thisMonthDividends.reduce((sum, s) => {
    const price = parseFloat(s.currentPrice) || 0;
    const shares = parseFloat(s.shares) || 0;
    const rate = parseFloat(s.dividendRate) || 0;
    const annualDiv = price * shares * rate / 100;
    let freq = 12;
    if (s.dividendMonths && !s.dividendMonths.includes('매월')) {
      const cnt = s.dividendMonths.split(',').filter(m => m.trim()).length;
      freq = cnt > 0 ? cnt : 12;
    }
    return sum + annualDiv / freq;
  }, 0);

  const recentStocks = [...stocks]
    .sort((a, b) => {
      const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dB - dA;
    }).slice(0, 3);

  const getTimeDiff = (date) => {
    const d = date?.toDate ? date.toDate() : new Date(date);
    const diff = Math.floor(Math.abs(new Date() - d) / 86400000);
    if (diff === 0) return '오늘';
    if (diff === 1) return '어제';
    if (diff < 7) return `${diff}일 전`;
    if (diff < 30) return `${Math.floor(diff / 7)}주일 전`;
    return `${Math.floor(diff / 30)}개월 전`;
  };

  const monthlyGoal = parseFloat(localStorage.getItem('monthlyGoal')) || 500000;
  const currentMonthlyKRW = Math.round((totalAnnualDividend / 12) * exchangeRate);
  const achievementRate = monthlyGoal > 0
    ? ((currentMonthlyKRW / monthlyGoal) * 100).toFixed(1) : '0';

  const shareToClipboard = () => {
    const text = `💰 내 배당 포트폴리오 현황\n\n📊 총 자산: $${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n📈 수익률: ${totalProfitRate >= 0 ? '+' : ''}${totalProfitRate}%\n💵 연 배당: $${totalAnnualDividend.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n🎯 보유 종목: ${stocks.length}개\n\n주요 종목: ${stocks.slice(0, 5).map(s => s.ticker).join(', ')}\n\n배당으로 월급 목표 달성! 🚀\n#배당투자 #미국주식 #파이어족 #경제적자유`;
    navigator.clipboard.writeText(text)
      .then(() => alert('✅ 클립보드에 복사되었습니다!\n\nSNS에 붙여넣기 하세요'))
      .catch(() => alert('❌ 복사 실패. 브라우저 권한을 확인해주세요.'));
  };

  const shareToTwitter = () => {
    const text = `💰 내 배당 포트폴리오\n📊 자산: $${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n📈 수익률: ${totalProfitRate >= 0 ? '+' : ''}${totalProfitRate}%\n💵 연 배당: $${totalAnnualDividend.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n\n배당으로 경제적 자유! 🚀\n#배당투자 #미국주식 #FIRE`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'width=600,height=400');
  };

  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent('배당 포트폴리오 관리 중! 💰📈')}`, '_blank', 'width=600,height=400');
  };

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoadingSnapshots(true);
      try {
        const q = query(collection(db, `users/${user.uid}/snapshots`), orderBy('timestamp', 'asc'));
        const snap = await getDocs(q);
        setSnapshots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingSnapshots(false);
      }
    };
    load();
  }, [user]);

  const chartData = snapshots.map(s => ({
    month: s.month,
    연배당USD: parseFloat((parseFloat(s.totalAnnualDividend) || 0).toFixed(0)),
    월배당KRW: Math.round((parseFloat(s.monthlyDividend) || 0) * exchangeRate),
  }));

  const calculateGrowth = () => {
    if (snapshots.length < 2) return null;
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    return {
      totalGrowth: ((last.totalAnnualDividend - first.totalAnnualDividend) / first.totalAnnualDividend * 100).toFixed(1),
      monthsPassed: snapshots.length - 1,
      firstAmount: first.totalAnnualDividend,
      lastAmount: last.totalAnnualDividend,
    };
  };
  const growth = calculateGrowth();

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: C.white, padding: '12px 16px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: C.text, fontSize: '13px' }}>{payload[0].payload.month}</p>
        <p style={{ margin: '0 0 4px 0', color: C.orange, fontSize: '14px', fontWeight: '600' }}>연 배당: ${payload[0].value.toLocaleString()}</p>
        <p style={{ margin: 0, color: C.green, fontSize: '14px', fontWeight: '600' }}>월 배당: ₩{payload[1].value.toLocaleString()}</p>
      </div>
    );
  };

  // ── 공통 카드 스타일 ──
  const card = {
    background: C.white,
    borderRadius: '16px',
    padding: isMobile ? '20px' : '28px',
    marginBottom: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
  };

  const cardTitle = (icon, text) => (
    <h2 style={{ margin: '0 0 20px 0', color: C.text, fontSize: isMobile ? '17px' : '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: C.green }}>{icon}</span> {text}
    </h2>
  );

  const statBox = (label, value, valueColor = C.text) => (
    <div style={{ background: C.bg, padding: isMobile ? '14px' : '18px', borderRadius: '10px', textAlign: 'center' }}>
      <p style={{ margin: '0 0 8px 0', color: C.sub, fontSize: isMobile ? '12px' : '13px' }}>{label}</p>
      <p style={{ margin: 0, fontSize: isMobile ? '22px' : '26px', fontWeight: 'bold', color: valueColor }}>{value}</p>
    </div>
  );

  const shareBtn = (onClick, bg, icon, textColor = 'white') => (
    <button onClick={onClick} style={{
      width: isMobile ? '36px' : '40px', height: isMobile ? '36px' : '40px',
      background: bg, color: textColor, border: 'none', borderRadius: '8px',
      fontSize: isMobile ? '14px' : '16px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.filter = 'brightness(1.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = 'brightness(1)'; }}
    >{icon}</button>
  );

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: isMobile ? '16px' : '24px' }}>

      {/* ── 헤더 ── */}
      <div style={{
        background: C.dark,
        borderRadius: '20px',
        padding: isMobile ? '24px 20px' : '32px 28px',
        marginBottom: '24px',
        borderWidth: 1, borderStyle: 'solid', borderColor: '#22c55e33',
      }}>
        <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: C.sub }}>안녕하세요 👋</p>
        <h1 style={{ margin: '0 0 8px 0', fontSize: isMobile ? '22px' : '28px', fontWeight: 'bold', color: C.white }}>
          {user?.displayName || '투자자'}님의 대시보드
        </h1>
        <p style={{ margin: 0, color: C.green, fontSize: isMobile ? '13px' : '14px' }}>
          오늘도 배당 투자 화이팅! 🚀
        </p>
      </div>

      {/* ── SNS 공유 ── */}
      <div style={{
        background: C.white, borderRadius: '14px', padding: isMobile ? '14px 16px' : '16px 20px',
        marginBottom: '24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        borderLeft: `4px solid ${C.orange}`,
      }}>
        <span style={{ fontSize: isMobile ? '12px' : '13px', color: C.sub, fontWeight: '600' }}>
          <i className='fa-solid fa-mobile-screen' style={{ marginRight: '6px', color: C.orange }}></i>공유하기
        </span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {shareBtn(shareToClipboard, C.dark, <i className="fa-regular fa-copy"></i>)}
          {shareBtn(() => { shareToClipboard(); alert('✅ 클립보드에 복사! 인스타그램에 붙여넣기 하세요 📸'); },
            'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', <i className="fa-brands fa-instagram"></i>)}
          {shareBtn(shareToTwitter, '#000', <i className="fa-brands fa-x-twitter"></i>)}
          {shareBtn(shareToFacebook, '#1877F2', <i className="fa-brands fa-facebook-f"></i>)}
          {shareBtn(() => { shareToClipboard(); alert('✅ 클립보드에 복사! 카카오톡에 붙여넣기 하세요 💬'); },
            '#FEE500', <i className="fa-solid fa-comment"></i>, '#3C1E1E')}
        </div>
      </div>

      {/* ── 포트폴리오 요약 ── */}
      <div style={card}>
        {cardTitle(<i className='fa-regular fa-file-zipper'></i>, '나의 포트폴리오 요약')}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: isMobile ? '10px' : '16px' }}>
          {statBox('총 자산', `$${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}`)}
          {statBox('총 수익률', `${totalProfitRate >= 0 ? '+' : ''}${totalProfitRate}%`, parseFloat(totalProfitRate) >= 0 ? C.green : '#ef4444')}
          {statBox('보유 종목', `${stocks.length}개`)}
          {statBox('연 배당액', `$${totalAnnualDividend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, C.green)}
        </div>
      </div>

      {/* ── 이번 달 배당 ── */}
      <div style={card}>
        {cardTitle(<i className='fa-solid fa-face-grin-beam'></i>, `이번 달 배당 (${thisMonth}월)`)}
        {thisMonthDividends.length > 0 ? (
          <div style={{ background: '#f0fdf4', padding: isMobile ? '16px' : '20px', borderRadius: '12px', borderLeft: `4px solid ${C.green}` }}>
            <p style={{ margin: '0 0 8px 0', fontSize: isMobile ? '13px' : '14px', color: C.sub }}>
              배당 종목: {thisMonthDividends.length}개
            </p>
            <p style={{ margin: '0 0 12px 0', fontSize: isMobile ? '14px' : '15px', fontWeight: '600', color: C.text, wordBreak: 'break-word' }}>
              {thisMonthDividends.map(s => s.ticker).join(', ')}
            </p>
            <p style={{ margin: 0, fontSize: isMobile ? '13px' : '14px', color: C.sub }}>
              예상 배당:{' '}
              <strong style={{ fontSize: isMobile ? '20px' : '24px', color: C.green }}>
                ${thisMonthAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </strong>
            </p>
          </div>
        ) : (
          <div style={{ background: C.bg, padding: '30px', borderRadius: '12px', textAlign: 'center', color: C.sub }}>
            이번 달에는 배당이 없어요 😢
          </div>
        )}
      </div>

      {/* ── 금융소득세 안내 ── */}
      <div style={card}>
        {cardTitle(<i className="fa-solid fa-circle-info"></i>, '금융소득세 안내')}
        {(() => {
          const annualKRW = Math.round(totalAnnualDividend * exchangeRate);
          const threshold = 20000000;
          const over = annualKRW >= threshold;
          const remaining = threshold - annualKRW;
          const excess = annualKRW - threshold;

          return (
            <div style={{
              background: over
                ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                : 'linear-gradient(135deg,#22c55e,#16a34a)',
              padding: isMobile ? '20px' : '24px', borderRadius: '14px', color: C.white,
            }}>
              {/* 현재 배당액 */}
              <div style={{ marginBottom: '18px', paddingBottom: '18px', borderBottom: '1px solid rgba(255,255,255,0.3)' }}>
                <p style={{ margin: '0 0 6px 0', fontSize: '12px', opacity: 0.9 }}>연간 예상 배당 (원화)</p>
                <p style={{ margin: 0, fontSize: isMobile ? '28px' : '34px', fontWeight: 'bold' }}>
                  ₩{annualKRW.toLocaleString()}
                </p>
                <p style={{ margin: '6px 0 0 0', fontSize: '11px', opacity: 0.8 }}>
                  (${totalAnnualDividend.toLocaleString(undefined, { maximumFractionDigits: 0 })} × ₩{exchangeRate.toFixed(2)})
                </p>
              </div>

              {/* 프로그레스 */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>기준: ₩20,000,000</span>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>{((annualKRW / threshold) * 100).toFixed(1)}%</span>
                </div>
                <div style={{ height: '10px', background: 'rgba(255,255,255,0.3)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(annualKRW / threshold * 100, 100)}%`, background: C.white, transition: 'width 1s ease' }} />
                </div>
              </div>

              {/* 상태 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <i className={over ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-circle-check"} style={{ fontSize: '18px' }}></i>
                <p style={{ margin: 0, fontSize: isMobile ? '15px' : '17px', fontWeight: 'bold' }}>
                  {over ? '금융소득종합과세 대상' : '분리과세 대상 (안전)'}
                </p>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: isMobile ? '13px' : '14px', lineHeight: '1.6', opacity: 0.95 }}>
                {over
                  ? <>기준을 <strong>₩{excess.toLocaleString()}</strong> 초과했어요. 종합소득세 신고 대상입니다.</>
                  : <>기준까지 <strong>₩{remaining.toLocaleString()}</strong> 여유가 있어요. 배당소득세 15.4% 원천징수로 종결됩니다.</>}
              </p>

              <div style={{ background: 'rgba(0,0,0,0.12)', padding: '14px', borderRadius: '10px', fontSize: '12px', lineHeight: '1.6' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>{over ? '📌 금융소득종합과세란?' : '💡 현재 과세 방식'}</p>
                <ul style={{ margin: 0, paddingLeft: '18px' }}>
                  {over ? <>
                    <li>이자·배당소득 합계 연 2천만원 초과 시 적용</li>
                    <li>다른 소득과 합산하여 6~45% 누진세율</li>
                    <li>다음 해 5월 종합소득세 신고 필수</li>
                  </> : <>
                    <li>미국 배당소득세 15% 원천징수</li>
                    <li>국내 배당소득세 15.4% (지방세 포함)</li>
                    <li>별도 신고 불필요 (분리과세)</li>
                  </>}
                </ul>
              </div>

              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.3)', fontSize: '11px', opacity: 0.8 }}>
                <i className="fa-solid fa-lightbulb" style={{ marginRight: '6px' }}></i>
                참고용이며 정확한 세금은 세무사와 상담하시기 바랍니다.
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── 목표 달성률 ── */}
      <div style={card}>
        {cardTitle(<i className='fa-solid fa-bullseye'></i>, '목표 달성률')}
        <div style={{ background: C.bg, padding: isMobile ? '16px' : '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: isMobile ? '12px' : '13px', color: C.sub }}>현재: {currentMonthlyKRW.toLocaleString()}원/월</span>
            <span style={{ fontSize: isMobile ? '12px' : '13px', color: C.sub }}>목표: {monthlyGoal.toLocaleString()}원/월</span>
          </div>
          <div style={{ height: isMobile ? '28px' : '34px', background: '#e2e8f0', borderRadius: '17px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(parseFloat(achievementRate), 100)}%`,
              background: parseFloat(achievementRate) >= 100
                ? `linear-gradient(90deg,${C.green},#16a34a)`
                : `linear-gradient(90deg,${C.orange},#ea580c)`,
              transition: 'width 1s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '12px',
              color: C.white, fontWeight: 'bold', fontSize: isMobile ? '12px' : '13px',
            }}>
              {parseFloat(achievementRate) > 10 && `${achievementRate}%`}
            </div>
          </div>
          <p style={{ margin: '12px 0 0 0', textAlign: 'center', fontSize: isMobile ? '13px' : '14px', color: parseFloat(achievementRate) >= 100 ? C.green : C.sub }}>
            {parseFloat(achievementRate) >= 100
              ? '🎉 목표 달성!'
              : `목표까지 ${(monthlyGoal - currentMonthlyKRW).toLocaleString()}원 남음`}
          </p>
        </div>
      </div>

      {/* ── 최근 추가 종목 ── */}
      {recentStocks.length > 0 && (
        <div style={card}>
          {cardTitle(<i className='fa-solid fa-clock-rotate-left'></i>, '최근 추가 종목')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentStocks.map(s => (
              <div key={s.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: isMobile ? '12px' : '14px', background: C.bg, borderRadius: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    background: s.assetType === '주식' ? '#f0fdf4' : '#fff7ed',
                    color: s.assetType === '주식' ? C.green : C.orange,
                    padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold',
                  }}>
                    {s.assetType === '주식' ? '📈 주식' : '📜 채권'}
                  </span>
                  <strong style={{ fontSize: isMobile ? '14px' : '15px', color: C.text }}>{s.ticker}</strong>
                </div>
                <span style={{ fontSize: isMobile ? '12px' : '13px', color: C.sub }}>{getTimeDiff(s.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 배당 성장 추이 ── */}
      <div style={card}>
        {cardTitle('💹', '배당 성장 추이')}

        {loadingSnapshots ? (
          <div style={{ padding: '40px', textAlign: 'center', color: C.sub }}>데이터 불러오는 중...</div>
        ) : snapshots.length === 0 ? (
          <div style={{ background: C.bg, padding: isMobile ? '30px 20px' : '50px 40px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', margin: '0 0 16px 0', opacity: 0.3 }}>📊</div>
            <h3 style={{ margin: '0 0 10px 0', color: C.text, fontSize: isMobile ? '16px' : '18px' }}>아직 기록된 데이터가 없어요</h3>
            <p style={{ margin: 0, color: C.sub, fontSize: isMobile ? '12px' : '13px', lineHeight: '1.6' }}>
              종목을 추가하면 매달 자동으로 배당 성장 기록이 쌓여요.
            </p>
          </div>
        ) : (
          <>
            {growth && (
              <div style={{
                background: C.dark,
                padding: isMobile ? '20px' : '24px', borderRadius: '14px',
                marginBottom: '20px', color: C.white,
                border: `1px solid ${C.green}33`,
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? '16px' : '20px' }}>
                  {[
                    { label: '총 성장률', value: `${growth.totalGrowth >= 0 ? '+' : ''}${growth.totalGrowth}%`, color: C.green },
                    { label: '기간', value: `${growth.monthsPassed}개월`, color: C.orange },
                    { label: '증가액', value: `$${(growth.lastAmount - growth.firstAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: C.white },
                  ].map((item, i) => (
                    <div key={i}>
                      <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: C.sub }}>{item.label}</p>
                      <p style={{ margin: 0, fontSize: isMobile ? '22px' : '28px', fontWeight: 'bold', color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: isMobile ? 10 : 12, fill: C.sub }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: isMobile ? 10 : 12, fill: C.sub }} axisLine={false} tickLine={false}
                  label={{ value: 'USD', position: 'insideLeft', style: { fontSize: 11, fill: C.sub } }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: isMobile ? 10 : 12, fill: C.sub }} axisLine={false} tickLine={false}
                  label={{ value: 'KRW', position: 'insideRight', style: { fontSize: 11, fill: C.sub } }} />
                <Tooltip content={<CustomTooltip />} />
                <Line yAxisId="left" type="monotone" dataKey="연배당USD" stroke={C.orange} strokeWidth={3} dot={{ fill: C.orange, r: 4 }} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="monotone" dataKey="월배당KRW" stroke={C.green} strokeWidth={3} dot={{ fill: C.green, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;