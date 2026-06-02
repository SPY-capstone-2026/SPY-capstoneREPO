# Moni Frontend

Moni 모바일 프론트엔드는 사용자의 지출 기록, 예산 상태, 월간 리포트, 오늘의 챌린지를 확인하고 조작할 수 있는 React Native + Expo 기반 앱입니다.

현재 개발 및 확인은 **Expo Web 기준**으로 진행합니다.

---

## 기술 스택

| 영역        | 기술                      |
| --------- | ----------------------- |
| Framework | React Native            |
| Runtime   | Expo                    |
| Language  | TypeScript              |
| Routing   | Expo Router             |
| Styling   | React Native StyleSheet |
| Icons     | lucide-react-native     |
| API       | FastAPI 백엔드 연동          |
| 실행 기준     | Expo Web                |

---

## 실행 기준

Expo Go에서는 환경에 따라 로딩 문제가 발생할 수 있어, 현재 프론트 개발과 확인은 Expo Web으로 진행합니다.

```bash
npx expo start --web --clear
```

---

## 설치 및 실행

### 1. 프론트 폴더로 이동

```bash
cd frontend/mobile
```

### 2. 패키지 설치

```bash
npm install
```

### 3. 환경 변수 설정

`frontend/mobile/.env.local` 파일을 생성하고 API Base URL을 설정합니다.

로컬 백엔드 사용 시:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

Railway 배포 서버 사용 시:

```env
EXPO_PUBLIC_API_BASE_URL=https://spy-capstonerepo-production.up.railway.app
```

### 4. 실행

```bash
npx expo start --web --clear
```

웹 브라우저에서 Expo Web 화면이 열리면 정상입니다.

---

## 백엔드 실행 필요

프론트는 실제 API와 연결되어 있으므로, 로컬 백엔드를 사용할 경우 백엔드 서버가 먼저 실행되어 있어야 합니다.

```bash
cd ../../api
uvicorn main:app --reload
```

백엔드 Swagger 문서는 아래에서 확인할 수 있습니다.

```text
http://localhost:8000/docs
```

---

## 주요 화면

### 인증 화면

* 로그인
* 회원가입
* 회원가입 시 수입 유형, 수입일, 소비 성향 입력

### 홈

* 이번 달 현재 지출
* 월말 예상 지출
* 예산 대비 상태
* 오늘의 챌린지 요약
* 지출 데이터가 없을 때 안내 문구 표시

### 소비

* 지출 추가
* 지출 수정
* 지출 삭제
* 지출 날짜 직접 지정
* 최근 지출 목록 표시
* 카테고리별 예산 상태 표시
* 카테고리별 월 예산 수정
* 알림 기준 수정
* 오늘의 미션 후보 포함 여부 수정

### 챌린지

* 오늘의 챌린지 조회
* 오늘의 챌린지 생성
* 챌린지 완료
* 챌린지 완료 취소
* XP 및 레벨 반영

### 리포트

* 이번 달 현재 지출
* 월말 예상 지출
* 예산 압박도
* 요일별 소비 리듬
* 카테고리별 예산 상태
* 지출 데이터가 없을 때 빈 상태 안내 표시

### 마이페이지

* 사용자 이메일 표시
* 수입 유형 표시 및 수정
* 수입일 표시 및 수정
* 소비 성향 표시 및 수정
* XP 및 레벨 표시

---

## 현재 API 연동 상태

현재 프론트는 주요 화면에서 실제 백엔드 API를 사용합니다.

### 인증 / 사용자

* `POST /signup`
* `POST /login`
* `GET /me`
* `PATCH /me`

### 지출

* `GET /transactions`
* `POST /transactions`
* `PATCH /transactions/{tx_id}`
* `DELETE /transactions/{tx_id}`

### 카테고리 / 예산

* `GET /categories`
* `PATCH /categories/{category_id}`

### 리포트

* `GET /reports/monthly`

### 챌린지

* `GET /challenges/today`
* `POST /challenges/generate`
* `PATCH /challenges/{challenge_id}/status`

상세 API 명세는 루트 문서의 `docs/api.md`를 참고합니다.

---

## AI / 챌린지 연결 상태

챌린지 생성은 백엔드의 `POST /challenges/generate`를 통해 호출됩니다.

현재 확인된 상태:

* 인증 토큰 기반 호출 성공
* 챌린지 생성 성공
* 응답에 `ai_metadata` 포함
* 테스트 결과 `model_version: fallback-v1` 확인

`fallback-v1`은 소비 데이터가 부족하거나 AI 추천 결과가 비어 있을 때 기본 챌린지를 생성하는 fallback 흐름입니다.

프론트에서는 fallback 여부를 개발자용 문구로 노출하지 않고, 사용자에게 자연스러운 챌린지 형태로 표시합니다.

---

## 폴더 구조

```text
frontend/mobile/
├─ app/
│  ├─ (tabs)/
│  │  ├─ index.tsx          # 홈
│  │  ├─ challenge.tsx      # 챌린지
│  │  ├─ report.tsx         # 리포트
│  │  ├─ transactions.tsx   # 소비
│  │  ├─ budget.tsx         # 예산 관련 라우트 또는 이전 구조
│  │  └─ mypage.tsx         # 마이페이지
│  ├─ auth/
│  │  ├─ login.tsx          # 로그인
│  │  └─ signup.tsx         # 회원가입
│  └─ _layout.tsx
│
├─ components/
│  ├─ AnimatedButton.tsx
│  ├─ AnimatedProgressBar.tsx
│  ├─ AppScreenHeader.tsx
│  ├─ EmptyState.tsx
│  ├─ GlassCard.tsx
│  └─ JellySegmentedControl.tsx
│
├─ constants/
│  ├─ colors.ts
│  ├─ typography.ts
│  ├─ mockAiResult.ts
│  └─ mockTypes.ts
│
├─ contexts/
│  └─ ToastContext.tsx
│
├─ services/
│  ├─ apiClient.ts
│  ├─ authService.ts
│  ├─ categoryService.ts
│  ├─ challengeService.ts
│  ├─ reportService.ts
│  └─ transactionService.ts
│
├─ types/
│  └─ api.ts
│
├─ utils/
│  ├─ aiFormat.ts
│  ├─ budgetStatus.ts
│  └─ categoryMeta.ts
│
├─ .env.local
├─ package.json
└─ README.md
```

파일명은 실제 브랜치 상태에 따라 일부 다를 수 있습니다. 라우트와 서비스 구조를 확인할 때는 `app/`, `services/`, `types/`를 우선 확인합니다.

---

## 주요 데이터 흐름

### 로그인

```text
사용자 입력
→ POST /login
→ access_token 저장
→ GET /me
→ 홈 또는 탭 화면 진입
```

### 지출 추가

```text
소비 탭 입력
→ POST /transactions
→ 최근 지출 목록 갱신
→ 이번 달 지출 합계 갱신
→ 홈 / 리포트 재진입 시 월간 리포트 갱신
```

### 지출 수정

```text
기존 지출 선택
→ 날짜 / 금액 / 결제처 / 카테고리 수정
→ PATCH /transactions/{tx_id}
→ 목록 재조회
→ 월간 리포트 기준 변경
```

### 예산 수정

```text
카테고리 선택
→ 월 예산 / 알림 기준 / 미션 포함 여부 수정
→ PATCH /categories/{category_id}
→ 소비 탭 게이지 즉시 반영
→ 홈 / 리포트 재진입 시 예산 상태 반영
```

### 챌린지 완료

```text
챌린지 완료 클릭
→ PATCH /challenges/{challenge_id}/status
→ status: SUCCESS
→ XP / 레벨 반영
```

### 챌린지 완료 취소

```text
완료된 챌린지 다시 클릭
→ PATCH /challenges/{challenge_id}/status
→ status: PENDING
→ XP / 레벨 재반영
```

---

## 계산 기준

### 월말 예상 지출

월말 예상 지출은 예산이 아니라 실제 지출 속도를 기반으로 계산됩니다.

```text
현재까지의 이번 달 지출 ÷ 오늘 날짜 × 이번 달 전체 일수
```

따라서 카테고리별 예산을 수정해도 월말 예상 지출 자체는 바로 바뀌지 않습니다.

예산 수정 시 바뀌는 값은 다음과 같습니다.

* 예산 사용 게이지
* 예산 대비 상태
* 초과 예상 / 여유 예상
* 예산 압박도

### 소비 탭 예산 게이지

소비 탭의 카테고리별 예산 게이지는 실제 거래 내역과 실제 카테고리 예산을 기준으로 계산합니다.

```text
카테고리별 월말 예상 지출 ÷ 카테고리 월 예산
```

---

## 타입 체크

수정 후 TypeScript 오류를 확인합니다.

```bash
npx tsc --noEmit
```

오류가 없으면 프론트 타입 기준은 통과한 것입니다.

---

## 테스트 시나리오

### 1. 인증

1. 새 이메일로 회원가입
2. 로그인
3. 마이페이지에서 사용자 정보 확인
4. 개인정보 수정 후 반영 확인

### 2. 소비 기록

1. 소비 탭 이동
2. 지출 추가
3. 날짜, 결제처, 금액, 카테고리 입력
4. 최근 지출에 반영 확인
5. 기존 지출 수정
6. 기존 지출 삭제

### 3. 예산

1. 소비 탭의 항목별 예산 상태 확인
2. 카테고리 선택
3. 월 예산 수정
4. 알림 기준 수정
5. 오늘의 미션 후보 포함 여부 수정
6. 저장 후 새로고침해도 값 유지 확인

### 4. 리포트

1. 홈 / 소비 / 리포트의 이번 달 지출 수치 비교
2. 지출이 없을 때 빈 상태 안내 확인
3. 지출 추가 후 요일별 소비 그래프 표시 확인
4. 카테고리별 예산 상태 반영 확인

### 5. 챌린지

1. 챌린지 탭 이동
2. 오늘의 챌린지 조회
3. 챌린지가 없을 경우 생성
4. 챌린지 완료
5. XP 증가 확인
6. 완료 취소
7. XP 반영 확인

---

## 자주 발생한 문제

### Expo Go에서 화면이 무한 로딩됨

현재 프로젝트는 Expo Web 기준으로 확인합니다.

```bash
npx expo start --web --clear
```

### API 요청이 CORS로 막힘

프론트가 배포 서버를 직접 호출할 때 CORS 설정이 맞지 않으면 브라우저에서 차단될 수 있습니다. 로컬 개발 중에는 `.env.local`의 API 주소를 로컬 백엔드로 맞춰 확인합니다.

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 로그인은 되지만 인증 API가 401을 반환함

토큰 저장 또는 Authorization 헤더 전달을 확인합니다.

인증 API에는 아래 헤더가 필요합니다.

```text
Authorization: Bearer {access_token}
```

### 지출 수정이 500으로 실패함

백엔드의 날짜 처리에서 `tx_date`가 문자열 또는 date 객체로 들어올 수 있습니다. 백엔드에서 두 경우를 모두 처리해야 합니다.

### Swagger Authorize가 422를 반환함

현재 로그인 API는 JSON body 기반입니다. Swagger의 OAuth2 Authorize 창은 form 방식으로 토큰을 요청하므로 맞지 않을 수 있습니다.

이 경우 PowerShell 또는 프론트 로그인 흐름으로 토큰을 발급받아 테스트합니다.

---

## 문서 위치

프로젝트 전체 설명:

```text
../../README.md
```

Android / API 상세 명세:

```text
../../docs/api.md
```

AI 엔진 상세 설명:

```text
../../api/ai/README.md
```

---

## 개발 기준

* 화면 확인은 Expo Web 기준
* API Base URL은 `.env.local`에서 관리
* 사용자에게 보이는 화면에는 `mock`, `fallback`, `임시` 같은 개발자용 문구를 노출하지 않음
* 지출 / 예산 / 챌린지 흐름은 실제 API 기준으로 확인
* 변경 후 `npx tsc --noEmit` 실행
