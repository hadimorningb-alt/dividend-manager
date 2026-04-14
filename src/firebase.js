import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';  // 🔥 추가

const firebaseConfig = {
  apiKey: "AIzaSyAdRnLsy8GXq44_IVnJmK5acz-mteEc2es",
  authDomain: "dividend-manager-4b0a3.firebaseapp.com",
  projectId: "dividend-manager-4b0a3",
  storageBucket: "dividend-manager-4b0a3.firebasestorage.app",
  messagingSenderId: "196278182947",
  appId: "1:196278182947:web:6707a87a5c23e67a01bd96"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);  // 🔥 추가

// 🔥 자동 익명 로그인
signInAnonymously(auth)
  .then(() => console.log('✅ 익명 로그인 성공'))
  .catch((error) => console.error('❌ 로그인 실패:', error));

export { db, auth };  // 🔥 auth 추가