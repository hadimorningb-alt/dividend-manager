import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

const firebaseConfig = {
   apiKey: "AIzaSyAdRnLsy8GXq44_IVnJmK5acz-mteEc2es",
  authDomain: "dividend-manager-4b0a3.firebaseapp.com",
  projectId: "dividend-manager-4b0a3",
  storageBucket: "dividend-manager-4b0a3.firebasestorage.app",
  messagingSenderId: "196278182947",
  appId: "1:196278182947:web:6707a87a5c23e67a01bd96"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// 🔥 구글 로그인 함수
export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'  // 항상 계정 선택 창 표시
  });
  
  try {
    const result = await signInWithPopup(auth, provider);
    console.log('✅ 로그인 성공:', result.user.email);
    return result.user;
  } catch (error) {
    console.error('❌ 로그인 실패:', error);
    throw error;
  }
};

// 🔥 로그아웃 함수
export const logout = async () => {
  try {
    await signOut(auth);
    console.log('✅ 로그아웃 완료');
  } catch (error) {
    console.error('❌ 로그아웃 실패:', error);
    throw error;
  }
};

// 익명 로그인 (기존 - 나중에 삭제 예정)
export const anonymousSignIn = () => {
  return signInAnonymously(auth);
};

// 🔥 인증 상태 변화 감지 (export 추가)
export { onAuthStateChanged, signOut };