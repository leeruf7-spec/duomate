// ① Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹) → "SDK 설정 및 구성"에서 복사해 붙여넣으세요.
//    이 값들은 공개돼도 괜찮은 값입니다. 보안은 firestore.rules가 지킵니다.
export const firebaseConfig = {
  apiKey: "AIzaSyDF_UEw68SiuOWRGy5DMXp4DV30SOJOZ-s",
  authDomain: "study-1e38c.firebaseapp.com",
  projectId: "study-1e38c",
  storageBucket: "study-1e38c.firebasestorage.app",
  messagingSenderId: "80133855214",
  appId: "1:80133855214:web:7428e36bbbd710cbbaa0ff"
};

// ② 가입을 허용할 학교 메일 도메인
export const ALLOWED_DOMAINS = ["jnu.ac.kr"];

// ③ 운영진 메일 (운영 탭이 보이는 사람). firestore.rules 의 isAdmin() 목록과 똑같이 맞춰 주세요.
export const ADMIN_EMAILS = ["haemin060621@jnu.ac.kr"];
