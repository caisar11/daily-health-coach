// Firebase Console → 프로젝트 설정 → 내 앱 → 웹 앱 구성에서 복사하세요.
// 이 Firebase 웹 구성 apiKey는 Gemini 비밀키가 아닙니다.
export const firebaseConfig = {
  apiKey: 'REPLACE_FIREBASE_WEB_API_KEY',
  authDomain: 'REPLACE_PROJECT_ID.firebaseapp.com',
  projectId: 'REPLACE_PROJECT_ID',
  appId: 'REPLACE_FIREBASE_APP_ID'
};
// Firebase App Check에 등록한 reCAPTCHA v3 공개 사이트 키
export const recaptchaSiteKey = 'REPLACE_RECAPTCHA_V3_SITE_KEY';
// Firebase AI Logic에서 사용 가능한 모델명을 확인해 주세요.
export const geminiModel = 'gemini-3.1-flash-lite';
