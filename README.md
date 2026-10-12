# 데일리 건강 코치 — Firebase + Gemini 웹앱 (베타)

기존 `허리90 코치.html`의 핵심 구상인 개인 건강·운동·음식 기록을 일반 사용자용으로 새로 구성한 웹앱입니다. 기존 UI와 코드를 그대로 이식한 것이 아니라 다중 사용자용으로 재구현한 1차 베타입니다.

## 제공하는 기능

- Google 계정 로그인(Firebase Authentication)
- 사용자별 개인 프로필, 일일 체중·허리둘레·걸음·물·컨디션 기록(Cloud Firestore)
- 걷기·러닝·홈트·근력·자전거·요가 등 운동 기록
- Gemini AI 음식 사진/글 분석 및 식사 기록(Firebase AI Logic)
- 체중 그래프, 최근 기록, CSV 백업, 건강 데이터 삭제

## 준비할 것

1. https://console.firebase.google.com 에서 프로젝트 생성, **Spark(무료) 요금제** 유지.
2. Authentication → Sign-in method → Google 사용 설정.
3. Firestore Database 생성. **테스트 모드를 공개 상태로 방치하지 마세요.** `firestore.rules` 보안 규칙을 게시하세요.
4. 프로젝트 설정 → 웹 앱 등록. **웹용 Firebase 구성 객체** 확인.
5. Firebase 콘솔 → AI Logic 시작 → **Gemini Developer API** 선택 → 안내를 따라 활성화. **Gemini 비밀 API 키를 웹 소스에 넣지 않습니다.**
6. Firebase App Check → 웹 앱용 reCAPTCHA v3 등록 및 AI Logic 적용. 사이트 키를 복사하세요. Firebase AI Logic은 App Check 검증이 강제될 수 있으므로 이 단계를 건너뛰면 AI가 작동하지 않습니다.
7. 터미널에서 `cp src/config.example.js src/config.js` (Windows에서는 파일 탐색기에서 복사·이름변경 가능) 후 `src/config.js`에 **본인 Firebase 웹 구성 객체**와 App Check **공개 사이트 키** 입력. 설정 파일은 .gitignore로 GitHub 업로드에서 제외됨.
8. Node.js 설치 후 프로젝트 폴더 터미널에서 `npm install`, `npm run dev`. 로컬 AI 테스트는 App Check 디버그 토큰 등록이 필요할 수 있습니다. Firebase 공식 가이드를 참고하세요.
9. Firebase CLI 설치 `npm install -g firebase-tools`, `firebase login` 후 `firebase use --add` (또는 `firebase --project YOUR_PROJECT_ID ...`), `firebase deploy --only firestore:rules`.
10. `npm run build`, `firebase deploy --only hosting` 후 Firebase Hosting URL에서 검증. Authentication → Settings → Authorized domains에 배포 도메인이 등록됐는지 확인하세요.

**중요:** `src/config.js`를 GitHub에 올리지 않도록 `.gitignore`에 넣었습니다. 하지만 이는 Firebase의 *웹 앱 식별 구성*이고 일반적으로 비밀 자체는 아닙니다. 실제 Gemini API 키, 서비스 계정 JSON, 비밀번호는 절대 클라이언트 파일이나 GitHub에 올리지 마세요. Firebase AI Logic 프록시가 Gemini 키를 보호합니다.

## GitHub에 올릴 때

`git init`, `git add .`, `git commit -m "Initial health coach beta"`, `git branch -M main`, `git remote add origin <본인 저장소 URL>`, `git push -u origin main`.

배포는 현재 **로컬에서 CLI를 통해** 합니다. GitHub에 올리는 것만으로 자동 배포되지는 않습니다. GitHub Actions 연동은 나중에 추가 가능합니다. 빌드용 `src/config.js`가 저장소에 없으므로 CI/CD에는 별도 안전한 구성 주입 작업이 필요합니다.

## 주의 / 추후 개선

- 실서비스 전에 개인정보처리방침·동의 절차·운영자 연락처, 삭제 요청 처리, 접근성·보안 점검을 진행하세요.
- 별도 백엔드 호출 제한 없이 AI Logic을 사용하는 베타입니다. App Check·AI Logic 인당 제한 및 Firebase 프로젝트 사용량을 확인하세요.
- 회원정보 **Google Auth 계정 삭제**는 현 버전에 구현되지 않았습니다. 건강 데이터 삭제와 계정 탈퇴는 다른 기능입니다.
- 기본 Firestore 조회는 최근 180일만 로딩합니다. 과거 데이터 전체 이관/관리 기능은 추가 개발 대상입니다.
- 이미지는 AI 분석을 위해 전송되지만 Firebase Storage에 원본을 보관하지 않습니다. AI 분석 텍스트 기록만 Firestore에 남습니다.
- `Gemini` 무료 티어의 모델 및 요청량 제한은 변경될 수 있습니다. AI Logic / Gemini API의 현재 할당량 확인이 필요합니다.
- 심박수/칼로리 추정치 등은 진단용이 아닙니다. 사용자의 의학적 상태별 운동 처방을 하지 않습니다.
- 프로필 등 최소 정보로 시작했고, 연령·체중·신체 지표를 취급하므로 법적 개인정보 보호 요구사항을 서비스 공개 전 점검해야 합니다.

## 공식 문서

- https://firebase.google.com/docs/ai-logic/get-started?platform=web
- https://firebase.google.com/docs/app-check/web/recaptcha-provider
- https://firebase.google.com/docs/firestore/security/get-started
- https://firebase.google.com/docs/hosting
