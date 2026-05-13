import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ✅ Service Worker 등록 활성화
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.log('✅ Service Worker 등록 성공:', registration.scope);
      })
      .catch((error) => {
        console.error('❌ Service Worker 등록 실패:', error);
      });
  });
}

reportWebVitals();