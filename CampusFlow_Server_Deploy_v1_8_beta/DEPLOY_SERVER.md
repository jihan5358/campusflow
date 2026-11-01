# CampusFlow 1.8 공개 베타 · 서버 업로드 안내

이 묶음은 Android APK가 아니라 Render 서버 배포용 소스입니다. 기존 PC용 server/.env를 복사해 넣지 마세요. 실제 로그인·Gemini 호출·Render 실행·APK 빌드는 아직 사용자 계정에서 검증하지 않았습니다.

## 1. GitHub 업로드
ZIP을 새 폴더에 압축 해제합니다. GitHub의 비공개 campusflow 저장소 → Add file → Upload files에서 압축 해제된 `server` 폴더와 `www` 폴더, 이 안내 파일을 업로드합니다. ZIP 자체 또는 이들을 담은 바깥 폴더를 업로드하지 마세요. 기존 .gitignore는 유지하세요. 서버에는 테스트용 가짜 자격증명만 있고 실제 비밀 키는 없습니다.

업로드 후 저장소 최상위 구조:
```
.gitignore
server/
  server.mjs
  public-security.mjs
  pdf-source.mjs
  package.json
  package-lock.json
  tests/
www/
  privacy.html
DEPLOY_SERVER.md
```
server/.env.example은 값 입력 예시일 뿐입니다. 이 파일에 실제 키를 입력해서 GitHub에 올리지 마세요. 브라우저 수동 업로드는 .gitignore를 무조건 준수하지 않으므로 파일 목록을 직접 확인하세요.

## 2. Render 서비스 생성
Render → New → Web Service → GitHub 저장소 연결 → campusflow 선택.
- Name: campusflow-ai (사용 가능한 다른 이름도 가능)
- Language/Runtime: Node
- Branch: main (저장소 실제 기본 브랜치)
- Region: 무료 사용 가능한 지역, 가능하면 Upstash와 가까운 지역
- Root Directory: server
- Build Command: npm ci --omit=dev
- Start Command: npm start
- Instance Type: Free
- Health Check Path (항목이 있으면): /health
- Node: package.json에서 22.x 사용을 지정했습니다.

## 3. Render Environment Variables에 직접 입력
값에 따옴표를 붙이지 마세요. 아래 이름만 정확히 쓰고 값은 본인의 것으로 입력합니다. 비밀 값이 보이는 화면을 공유하지 마세요.

| Key | 넣을 값 |
|---|---|
| GEMINI_API_KEY | 기존 Google AI Studio Gemini API 키 |
| FIREBASE_WEB_API_KEY | Firebase 웹 앱 firebaseConfig 안의 apiKey |
| FIREBASE_PROJECT_ID | firebaseConfig 안의 projectId (표시 이름이 아니라 ID) |
| UPSTASH_REDIS_REST_URL | Upstash HTTPS REST URL |
| UPSTASH_REDIS_REST_TOKEN | Upstash REST 토큰 (읽기 전용 토큰 아님) |
| RATE_LIMIT_SALT | 본인 PC에서 새로 만든 임의의 32자 이상 문자열 |
| ALLOWED_MODELS | gemini-3.8-flash |
| ALLOWED_ORIGINS | https://localhost |

RATE_LIMIT_SALT 만들기: 본인 Windows PowerShell에서 아래 명령을 한 번 실행하고 출력된 값을 Render에 직접 넣습니다. Gemini 키나 비밀번호를 대신 쓰지 마세요.
```powershell
([guid]::NewGuid().ToString('N')) + ([guid]::NewGuid().ToString('N'))
```
PORT/HOST는 직접 넣지 않아도 됩니다. Render가 PORT를 제공합니다.
기본 제한은 계정당 하루 5회, 전체 하루 50회, 계정당 분당 1회, 전체 분당 5회입니다. 날짜 리셋은 UTC 00:00(한국 오전 9시)입니다. AI 처리 전에 호출량을 예약하므로 분석 실패·외부 모델 오류도 횟수에 포함될 수 있습니다. 인증이나 제한 저장소 장애 시 요청은 차단됩니다.

## 4. 무료 운영 주의
Firebase Spark, Upstash Free, Render Free 및 Gemini 무료 등급을 본인 계정에서 확인합니다. 이 코드의 호출 횟수 제한은 요금제 설정을 대신하지 않으며 무과금 보증이 아닙니다. 유료 결제를 활성화하면 제공자 설정에 따라 과금될 수 있습니다. 무료 모델의 이용권한·사용량·요금은 변경될 수 있습니다. 기본 모델은 2026-11-01 공식 요금표에서 무료 등급을 확인했으나 사용자 계정에서 실제 호출은 미검증입니다.
무료 서버는 절전/한도 중단이 있을 수 있습니다. 다중 계정, 자동화 가입, 분산 공격을 완전히 막지 않습니다. 공개 베타 최소 보호 구성이지 상시 운영 보장이나 보안 인증을 받은 제품은 아닙니다. 가입·인증 메일은 Firebase 자체 한도도 적용됩니다.

## 5. 배포 후 확인
Deploy Web Service를 누르고 Live가 되면 Render의 HTTPS 주소에 /health를 붙여 브라우저로 접속합니다. 예: https://실제서버이름.onrender.com/health
`{"ok":true,"version":"1.8.0-public-beta"}`가 보이면 서버 기동 확인입니다. 이 결과만으로 인증·Redis·Gemini 전체 연결이 검증된 것은 아닙니다.
홈 주소(/)에서 Not found가 나와도 앱 웹사이트를 제공하지 않는 API 서버라 정상입니다. /api/models는 로그인 없이 접속하면 거부됩니다. 실제 AI 로그인·분석 검증은 다음 Android 클라이언트 연결 단계에서 합니다.
공유해도 되는 것은 Render HTTPS 서버 주소와 비밀 값이 가려진 오류 로그입니다. 키·토큰·.env·로그인 토큰은 보내지 마세요.

## 6. APK 공개 전
이 ZIP에는 APK나 로그인 화면이 들어 있지 않습니다. 로그인 포함 Android 클라이언트에 서버 주소를 연결하고 빌드해야 합니다. www/privacy.html은 운영자·연락처·시행일 등이 비어 있는 초안입니다. 불특정 다수에게 APK를 배포하기 전에 실제 운영 조건에 맞춰 완성하고 서비스별 데이터 처리·동의·보안과 본인/다른 계정·실제 기기 동작을 확인하세요. 운영자 정보와 문의 경로 없이 공개하지 마세요.

## 검증 범위
서버 문법 검사 및 33개 모의 자동 테스트 통과. 로그인 유무, 이메일 인증, 다른 프로젝트 토큰, 만료 토큰, 한도 초과·저장소 장애, 모델 허용목록, CORS, 입력 제한, 모의 분석 응답, 혼잡 안내 등. 실제 Firebase/Upstash/Gemini 네트워크 연결, Redis Lua 실행, 실 PDF 처리, Windows/Android 및 Render 실행은 이 배포 묶음으로 아직 실환경 검증하지 않았습니다.

## 참고
- https://render.com/docs/deploy-node-express-app
- https://render.com/docs/free
- https://firebase.google.com/docs/auth/web/password-auth
- https://upstash.com/docs/redis/overall/getstarted
- https://ai.google.dev/gemini-api/docs/pricing
