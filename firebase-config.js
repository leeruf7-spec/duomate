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
export const ADMIN_EMAILS = ["haemin060621@jnu.ac.kr", "leeruf7@gmail.com", "admin@jnumir.kr"];

// ④ 참가비 입금 계좌 (앱 안에 표시됩니다)
export const BANK = { name: "토스뱅크", no: "100222472778", holder: "" };  // name=은행명, holder=예금주를 채워 주세요

// ⑤ 운영 탭 잠금 비밀번호 (SHA-256). 화면 가림용일 뿐 보안은 firestore.rules 의 운영진 메일이 지킵니다.
export const ADMIN_PIN_SHA256 = "41fb13379f751067eff5f55626e61db4863976a27f0211daec3fa2af1641f86d";

// ⑥ 하단 문구
// 운영진 공용 로그인용 계정 (Firebase 콘솔에서 직접 만든 계정). 비밀번호는 코드에 없습니다.
export const ADMIN_LOGIN_EMAIL = "admin@jnumir.kr";

export const CREDIT = "전남대학교 여수캠퍼스 공식 창업동아리 미르 · 실험실특화형창업선도대학 사업단 동아리 관리자 편승훈 위원 · 전남대학교 창업보육센터 소속 광주캠퍼스 동아리 담당자 · 여수캠퍼스 창업보육센터 구병우 실장님 — 도움에 감사드립니다.";

// ⑦ 참가비·상품 설정 (원)
export const FEE_WON = 2000;        // 참가비 (환급 없음)
export const OPS_RATE = 0.08;       // 참가비 중 운영비로 쓰는 비율 (10% 미만)
export const PRIZE_BASE = 50000;    // 후원·동아리 예산으로 마련한 기본 상품 총액
export const PRIZE_MAX = 5000;      // 달성자 1인당 기프티콘 상한
