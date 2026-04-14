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

// 🔥 Service Worker 등록 (수정)
//if ('serviceWorker' in navigator) {
  //window.addEventListener('load', () => {
    //const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;
    
    //navigator.serviceWorker
      //.register(swUrl)
      //.then((registration) => {
        //console.log('✅ Service Worker 등록 성공:', registration.scope);
      //})
      //.catch((error) => {
        //console.error('❌ Service Worker 등록 실패:', error);
      //});
  //});
//}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
