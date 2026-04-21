import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function ChartPage({ stocks, exchangeRate }) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 480;

  // 🔥 세련된 차트 색상 (톤다운)
  const COLORS = [
    '#667eea', // 보라
    '#764ba2', // 진한 보라
    '#f093fb', // 연한 핑크
    '#4facfe', // 하늘색
    '#43e97b', // 민트
    '#fa709a', // 핑크
    '#feca57', // 노란색
    '#48dbfb', // 청록
    '#ff6b6b', // 연한 빨강
    '#ee5a6f'  // 진한 핑크
  ];

  // ==================== 1. 자산 배분 (주식 vs 채권) ====================
  const assetTypeData = stocks.reduce((acc, stock) => {
    const value = stock.currentPrice * stock.shares;
    const existing = acc.find(item => item.name === stock.assetType);
    if (existing) {
      existing.value += value;
    } else {
      acc.push({ name: stock.assetType, value });
    }
    return acc;
  }, []);

  // ==================== 2. 종목별 비중 ====================
  const stockDistribution = stocks
    .map(stock => ({
      name: stock.ticker,
      value: stock.currentPrice * stock.shares
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // ==================== 3. 월별 배당 수령액 ====================
  const monthlyDividends = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthStocks = stocks.filter(stock => {
      if (!stock.dividendMonths) return false;
      if (stock.dividendMonths.includes('매월')) return true;
      const months = stock.dividendMonths.split(',').map(m => parseInt(m.trim()));
      return months.includes(month);
    });

    const amount = monthStocks.reduce((sum, stock) => {
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

    return {
      month: `${month}월`,
      amount: parseFloat(amount.toFixed(0)),
      amountKRW: Math.round(amount * exchangeRate)
    };
  });

  // ==================== 4. 수익률 TOP 5 ====================
  const profitRateTop5 = stocks
    .map(stock => ({
      name: stock.ticker,
      rate: parseFloat(((stock.currentPrice - stock.purchasePrice) / stock.purchasePrice * 100).toFixed(2))
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  // ==================== 5. 배당률 TOP 5 ====================
  const dividendRateTop5 = stocks
    .map(stock => ({
      name: stock.ticker,
      rate: stock.dividendRate
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  // ==================== 커스텀 Tooltip ====================
  const CustomTooltip = ({ active, payload, label, valueType = 'usd' }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(255, 255, 255, 0.98)',
          padding: '12px 16px',
          border: 'none',
          borderRadius: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <p style={{ margin: 0, fontWeight: '600', marginBottom: '6px', color: '#2c3e50', fontSize: '13px' }}>
            {label || payload[0].name}
          </p>
          {payload.map((entry, index) => (
            <p key={index} style={{ margin: 0, color: entry.color, fontSize: '14px', fontWeight: '600' }}>
              {valueType === 'usd' && `$${entry.value.toLocaleString()}`}
              {valueType === 'krw' && `₩${entry.value.toLocaleString()}`}
              {valueType === 'percent' && `${entry.value}%`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // 🔥 카드 스타일 (공통)
  const cardStyle = {
    background: 'white',
    padding: isMobile ? '24px' : '32px',
    borderRadius: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    border: '1px solid rgba(0,0,0,0.04)'
  };

  const titleStyle = {
    margin: '0 0 24px 0',
    color: '#2c3e50',
    fontSize: isMobile ? '17px' : '20px',
    fontWeight: '600',
    letterSpacing: '-0.3px'
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ 
        margin: '0 0 32px 0', 
        color: '#2c3e50',
        fontSize: isMobile ? '24px' : '28px',
        fontWeight: '700'
      }}>
        📊 차트 분석
      </h1>

      {stocks.length === 0 ? (
        <div style={{
          ...cardStyle,
          padding: '80px 40px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '64px', margin: '0 0 20px 0', opacity: 0.3 }}>📊</div>
          <p style={{ fontSize: '18px', margin: 0, color: '#95a5a6' }}>
            종목을 추가하면 차트가 표시됩니다
          </p>
        </div>
      ) : (
        <>
          {/* 🔥 1행: 자산배분 + 종목별비중 (데스크톱 2열 / 모바일 1열) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: isMobile ? '20px' : '24px',
            marginBottom: isMobile ? '20px' : '24px'
          }}>
            {/* 자산 배분 */}
            <div style={cardStyle}>
              <h2 style={titleStyle}> 자산 배분</h2>
              <ResponsiveContainer width="100%" height={isMobile ? 280 : 320}>
                <PieChart>
                  <Pie
                    data={assetTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={isMobile ? 90 : 110}
                    innerRadius={isMobile ? 50 : 60}
                    fill="#f5c55d"
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {assetTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip valueType="usd" />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 종목별 비중 */}
            <div style={cardStyle}>
              <h2 style={titleStyle}> 종목별 비중 (TOP 10)</h2>
              <ResponsiveContainer width="100%" height={isMobile ? 280 : 320}>
                <PieChart>
                  <Pie
                    data={stockDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                    outerRadius={isMobile ? 90 : 110}
                    innerRadius={isMobile ? 50 : 60}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={1}
                  >
                    {stockDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip valueType="usd" />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 월별 배당 수령액 */}
          <div style={{ ...cardStyle, marginBottom: isMobile ? '20px' : '24px' }}>
            <h2 style={titleStyle}> 월별 배당 수령액</h2>
            <ResponsiveContainer width="100%" height={isMobile ? 280 : 320}>
              <BarChart data={monthlyDividends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: isMobile ? 11 : 13, fill: '#7f8c8d' }}
                  axisLine={{ stroke: '#ecf0f1' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: isMobile ? 11 : 13, fill: '#7f8c8d' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip valueType="usd" />} />
                <Bar 
                  dataKey="amount" 
                  fill="#f1f1ca" 
                  radius={[8, 8, 0, 0]}
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 🔥 2행: 수익률 TOP5 + 배당률 TOP5 (데스크톱 2열 / 모바일 1열) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: isMobile ? '20px' : '24px'
          }}>
            {/* 수익률 TOP 5 */}
            <div style={cardStyle}>
              <h2 style={titleStyle}> 수익률 TOP 5</h2>
              <ResponsiveContainer width="100%" height={isMobile ? 280 : 320}>
                <BarChart data={profitRateTop5} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: isMobile ? 11 : 13, fill: '#7f8c8d' }}
                    axisLine={{ stroke: '#ecf0f1' }}
                    tickLine={false}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fontSize: isMobile ? 11 : 13, fill: '#7f8c8d' }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip content={<CustomTooltip valueType="percent" />} />
                  <Bar 
                    dataKey="rate" 
                    fill="#af704c" 
                    radius={[0, 8, 8, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 배당률 TOP 5 */}
            <div style={cardStyle}>
              <h2 style={titleStyle}> 배당률 TOP 5</h2>
              <ResponsiveContainer width="100%" height={isMobile ? 280 : 320}>
                <BarChart data={dividendRateTop5} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: isMobile ? 11 : 13, fill: '#7f8c8d' }}
                    axisLine={{ stroke: '#ecf0f1' }}
                    tickLine={false}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fontSize: isMobile ? 11 : 13, fill: '#7f8c8d' }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip content={<CustomTooltip valueType="percent" />} />
                  <Bar 
                    dataKey="rate" 
                    fill="#88a4f0" 
                    radius={[0, 8, 8, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ChartPage;