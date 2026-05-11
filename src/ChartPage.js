import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
};

// 그린/오렌지 계열 차트 색상
const COLORS = [
  '#22c55e',
  '#fb923c',
  '#86D293',
  '#f59e0b',
  '#16a34a',
  '#ea580c',
  '#4ade80',
  '#fbbf24',
  '#15803d',
  '#c2410c',
];

function ChartPage({ stocks, exchangeRate }) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const isMobile = windowWidth <= 480;

  // ── 1. 자산 배분 ──
  const assetTypeData = stocks.reduce((acc, stock) => {
    const value = stock.currentPrice * stock.shares;
    const existing = acc.find(item => item.name === stock.assetType);
    if (existing) { existing.value += value; }
    else { acc.push({ name: stock.assetType, value }); }
    return acc;
  }, []);

  // ── 2. 종목별 비중 ──
  const stockDistribution = stocks
    .map(s => ({ name: s.ticker, value: s.currentPrice * s.shares }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // ── 3. 월별 배당 ──
  const monthlyDividends = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthStocks = stocks.filter(s => {
      if (!s.dividendMonths) return false;
      if (s.dividendMonths.includes('매월')) return true;
      return s.dividendMonths.split(',').map(m => parseInt(m.trim())).includes(month);
    });
    const amount = monthStocks.reduce((sum, s) => {
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
    return {
      month: `${month}월`,
      amount: parseFloat((amount || 0).toFixed(0)),
      amountKRW: Math.round((amount || 0) * exchangeRate),
    };
  });

  // ── 4. 수익률 TOP5 ──
  const profitRateTop5 = stocks
    .map(s => ({ name: s.ticker, rate: parseFloat(((s.currentPrice - s.purchasePrice) / s.purchasePrice * 100).toFixed(2)) }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  // ── 5. 배당률 TOP5 ──
  const dividendRateTop5 = stocks
    .map(s => ({ name: s.ticker, rate: s.dividendRate }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  // ── 커스텀 Tooltip ──
  const CustomTooltip = ({ active, payload, label, valueType = 'usd' }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: C.white, padding: '12px 16px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: `1px solid ${C.border}` }}>
        <p style={{ margin: '0 0 6px 0', fontWeight: '600', color: C.text, fontSize: '13px' }}>{label || payload[0].name}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ margin: 0, color: entry.color, fontSize: '14px', fontWeight: '600' }}>
            {valueType === 'usd' && `$${entry.value.toLocaleString()}`}
            {valueType === 'krw' && `₩${entry.value.toLocaleString()}`}
            {valueType === 'percent' && `${entry.value}%`}
          </p>
        ))}
      </div>
    );
  };

  const card = {
    background: C.white,
    padding: isMobile ? '20px' : '28px',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
  };

  const cardTitle = (text) => (
    <h2 style={{ margin: '0 0 20px 0', color: C.text, fontSize: isMobile ? '16px' : '18px', fontWeight: '700', paddingLeft: '12px', borderLeft: `4px solid ${C.green}` }}>
      {text}
    </h2>
  );

  const axisStyle = { fontSize: isMobile ? 11 : 13, fill: C.sub };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

      {/* 헤더 */}
      <div style={{ background: C.dark, borderRadius: '20px', padding: isMobile ? '24px 20px' : '28px', marginBottom: '24px', border: `1px solid ${C.green}33` }}>
        <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: C.sub }}>포트폴리오 시각화</p>
        <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: C.white }}>
          📊 차트 분석
        </h1>
      </div>

      {stocks.length === 0 ? (
        <div style={{ ...card, padding: '80px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', margin: '0 0 20px 0', opacity: 0.2 }}>📊</div>
          <p style={{ fontSize: '16px', margin: 0, color: C.sub }}>종목을 추가하면 차트가 표시됩니다</p>
        </div>
      ) : (
        <>
          {/* 1행: 자산배분 + 종목별 비중 */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: isMobile ? '16px' : '20px', marginBottom: isMobile ? '16px' : '20px' }}>

            {/* 자산 배분 */}
            <div style={card}>
              {cardTitle('🏦 자산 배분')}
              <ResponsiveContainer width="100%" height={isMobile ? 260 : 300}>
                <PieChart>
                  <Pie
                    data={assetTypeData}
                    cx="50%" cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={isMobile ? 90 : 110}
                    innerRadius={isMobile ? 50 : 60}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {assetTypeData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip valueType="usd" />} />
                </PieChart>
              </ResponsiveContainer>

              {/* 범례 */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
                {assetTypeData.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                    <span style={{ fontSize: '12px', color: C.sub }}>{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 종목별 비중 */}
            <div style={card}>
              {cardTitle('📈 종목별 비중 (TOP 10)')}
              <ResponsiveContainer width="100%" height={isMobile ? 260 : 300}>
                <PieChart>
                  <Pie
                    data={stockDistribution}
                    cx="50%" cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                    outerRadius={isMobile ? 90 : 110}
                    innerRadius={isMobile ? 50 : 60}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {stockDistribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip valueType="usd" />} />
                </PieChart>
              </ResponsiveContainer>

              {/* 범례 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px', justifyContent: 'center' }}>
                {stockDistribution.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                    <span style={{ fontSize: '11px', color: C.sub }}>{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 월별 배당 수령액 */}
          <div style={{ ...card, marginBottom: isMobile ? '16px' : '20px' }}>
            {cardTitle('💰 월별 배당 수령액')}

            {/* 요약 뱃지 */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[
                { label: '연간 총계', value: `$${monthlyDividends.reduce((s, m) => s + m.amount, 0).toLocaleString()}` , color: C.green },
                { label: '월 평균', value: `$${(monthlyDividends.reduce((s, m) => s + m.amount, 0) / 12).toFixed(0)}`, color: C.orange },
              ].map((item, i) => (
                <div key={i} style={{ background: C.bg, borderRadius: '10px', padding: '10px 16px', borderLeft: `3px solid ${item.color}` }}>
                  <p style={{ margin: '0 0 2px 0', fontSize: '11px', color: C.sub }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={isMobile ? 260 : 300}>
              <BarChart data={monthlyDividends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={axisStyle} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip valueType="usd" />} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={60}>
                  {monthlyDividends.map((entry, i) => (
                    <Cell key={i} fill={entry.amount > 0 ? C.green : C.border} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 2행: 수익률 TOP5 + 배당률 TOP5 */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: isMobile ? '16px' : '20px' }}>

            {/* 수익률 TOP5 */}
            <div style={card}>
              {cardTitle('📈 수익률 TOP 5')}
              <ResponsiveContainer width="100%" height={isMobile ? 260 : 300}>
                <BarChart data={profitRateTop5} layout="vertical" margin={{ top: 5, right: 24, left: 10, bottom: 5 }}>
                  <XAxis type="number" tick={axisStyle} axisLine={{ stroke: C.border }} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={axisStyle} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<CustomTooltip valueType="percent" />} />
                  <Bar dataKey="rate" radius={[0, 8, 8, 0]} maxBarSize={40}>
                    {profitRateTop5.map((entry, i) => (
                      <Cell key={i} fill={entry.rate >= 0 ? C.green : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* 수익률 리스트 */}
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {profitRateTop5.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: C.bg, borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.rate >= 0 ? C.green : '#ef4444' }} />
                      <span style={{ fontWeight: '600', fontSize: '13px', color: C.text }}>{item.name}</span>
                    </div>
                    <span style={{ fontWeight: 'bold', fontSize: '13px', color: item.rate >= 0 ? C.green : '#ef4444' }}>
                      {item.rate >= 0 ? '+' : ''}{item.rate}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 배당률 TOP5 */}
            <div style={card}>
              {cardTitle('💵 배당률 TOP 5')}
              <ResponsiveContainer width="100%" height={isMobile ? 260 : 300}>
                <BarChart data={dividendRateTop5} layout="vertical" margin={{ top: 5, right: 24, left: 10, bottom: 5 }}>
                  <XAxis type="number" tick={axisStyle} axisLine={{ stroke: C.border }} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={axisStyle} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<CustomTooltip valueType="percent" />} />
                  <Bar dataKey="rate" radius={[0, 8, 8, 0]} maxBarSize={40}>
                    {dividendRateTop5.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* 배당률 리스트 */}
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dividendRateTop5.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: C.bg, borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                      <span style={{ fontWeight: '600', fontSize: '13px', color: C.text }}>{item.name}</span>
                    </div>
                    <span style={{ fontWeight: 'bold', fontSize: '13px', color: COLORS[i % COLORS.length] }}>
                      {item.rate}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ChartPage;