# 듀오 메이트 배포 가이드

전남대 메일(@jnu.ac.kr)로 가입한 학생끼리 1주일 1:1 공부 듀오를 맺는 웹앱입니다.
빌드 과정이 없는 정적 사이트라서 **GitHub에 올리고 Vercel에 연결하면 끝**입니다. 데이터와 로그인은 Firebase가 맡습니다.

```
학생 ── Vercel(화면) ── Firebase Auth(전남대 메일 인증)
                     └─ Firestore(신청서 · 매칭 · 공부 상태 · 신고)
```

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 구조 |
| `styles.css` | 디자인 |
| `app.js` | 로그인, 신청, 매칭, 타이머, 신고, 운영진 보드 |
| `sprites.js` | 캐릭터 10종 × 4상태 이미지 |
| `firebase-config.js` | **직접 고칠 곳** — Firebase 키, 운영진 메일 |
| `firestore.rules` | **직접 붙여넣을 곳** — 데이터 보안 규칙 |
| `vercel.json` | Vercel 설정 |

---

## 1단계 · Firebase 만들기 (15분)

1. https://console.firebase.google.com → **프로젝트 추가** → 이름 `duomate` (애널리틱스는 꺼도 됨)
2. **빌드 → Authentication → 시작하기 → 로그인 방법 → 이메일/비밀번호 → 사용 설정** → 저장
   - "이메일 링크(비밀번호 없는 로그인)"는 켜지 않아도 됩니다.
3. **Authentication → 템플릿 → 이메일 주소 인증** → 연필 아이콘 → 언어를 **한국어**로, 보내는 사람 이름을 `듀오메이트`로
4. **빌드 → Firestore Database → 데이터베이스 만들기** → 위치 `asia-northeast3 (서울)` → **프로덕션 모드**
5. Firestore → **규칙** 탭 → `firestore.rules` 내용을 통째로 붙여넣기
   - `운영진아이디@jnu.ac.kr` 를 **내 전남대 메일**로 바꾸고 → **게시**
6. 프로젝트 설정(톱니바퀴) → **내 앱 → 웹(</>)** → 앱 이름 `duomate-web` → 등록
   - 나오는 `firebaseConfig` 값을 `firebase-config.js` 에 붙여넣기
   - 같은 파일의 `ADMIN_EMAILS` 도 내 메일로 바꾸기 (5번과 똑같이)

## 2단계 · GitHub에 올리기 (5분)

**방법 A — 웹에서 (Git 몰라도 됨)**
1. https://github.com/new → 저장소 이름 `duomate` → Public 또는 Private → **Create repository**
2. 화면의 **uploading an existing file** 클릭 → 이 폴더 안의 파일들을 전부 끌어다 놓기 → **Commit changes**

**방법 B — 터미널에서**
```bash
cd duomate-deploy
git init
git add .
git commit -m "듀오메이트 첫 배포"
git branch -M main
git remote add origin https://github.com/내아이디/duomate.git
git push -u origin main
```

## 3단계 · Vercel에 연결하기 (3분)

1. https://vercel.com → **GitHub로 로그인**
2. **Add New → Project** → `duomate` 저장소 **Import**
3. Framework Preset: **Other**, Build Command·Output Directory는 **비워 두기** → **Deploy**
4. 1분 뒤 `https://duomate-xxxx.vercel.app` 주소가 생깁니다.
   - Settings → Domains 에서 `duomate.vercel.app` 처럼 원하는 이름으로 바꿀 수 있어요.

## 4단계 · Firebase에 Vercel 주소 허용하기 (1분) ← 빼먹기 쉬움

Firebase → Authentication → **설정 → 승인된 도메인 → 도메인 추가** → `duomate-xxxx.vercel.app` 입력.
이걸 안 하면 인증 메일 링크가 Vercel로 돌아오지 못합니다.

## 5단계 · 테스트

1. 배포 주소 접속 → 회원가입 → 내 전남대 메일로 온 인증 링크 클릭 → **인증했어요**
2. 하단에 **★ 운영** 탭이 보이면 운영진 설정 성공
3. 다른 전남대 메일 2개로 가입해 각각 신청서 제출 → 운영 탭에 **추천 매칭**이 뜨는지 확인 → 확정
4. 두 폰에서 동시에 **집중 시작** → 서로 화면에 **버닝 모드**가 뜨는지 확인
5. 홈의 **파트너 신고하기** → 운영 탭 **미처리 신고**에 뜨는지 확인

---

## 이후 수정하는 법

GitHub의 파일을 고치고 커밋하면 **Vercel이 자동으로 다시 배포**합니다 (약 30초).

## 자주 막히는 곳

| 증상 | 해결 |
|---|---|
| 인증 메일이 안 옴 | 학교 메일 스팸함 확인. 그래도 없으면 학교 메일이 외부 메일을 막는 것일 수 있어요 → 정보전산원 문의 |
| 로그인은 되는데 신청 저장 실패 | `firestore.rules` 를 게시했는지, 메일 인증을 했는지 확인 |
| 운영 탭이 안 보임 | `firebase-config.js` 와 `firestore.rules` 의 운영진 메일이 같은지 확인 |
| 인증 링크 누르면 오류 | 4단계 승인된 도메인 추가 |

## 출시 전 확인할 것

- **계약금**: 지금은 앱에서 돈을 받지 않고 운영진이 따로 처리합니다. 실패자의 돈을 성공자에게 나눠 주는 구조는 사행성·선불금 보관 이슈가 생길 수 있으니 창업지원단이나 법률 상담을 먼저 받으세요.
- **개인정보**: 학교 메일·카카오톡 ID를 모으므로, 개인정보 처리방침(수집 항목, 목적, 보관 기간=학기 종료 후 파기, 문의처)을 페이지로 만들어 링크해 두세요.
- **Firebase 요금**: 무료(Spark) 요금제로 학생 수백 명까지 충분합니다.
