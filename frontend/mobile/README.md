# Moni Frontend

Moni 프론트엔드는 소비 기록·예산·챌린지·리포트·캐릭터·친구 기능을 제공하는 React Native + Expo 앱입니다. 실제 API를 사용하는 화면과 아직 계약을 맞춰야 하는 화면을 구분하여 설명합니다.

현재 개발 및 확인은 **Expo Web 기준**이며 작업 브랜치는 기존 `feature/frontend`를 사용합니다.

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Framework | React Native 0.81.5 / React 19.1.0 |
| Runtime | Expo 54 |
| Language | TypeScript 5.9 계열, strict 설정 |
| Routing | Expo Router 6 |
| Styling | React Native StyleSheet / 공통 테마 Context |
| Icons | lucide-react-native |
| API | FastAPI / JSON / multipart 파일 요청 |
| 실행 기준 | Expo Web |

버전은 저장소 `package.json`의 선언 기준입니다. 설치된 정확한 버전은 lockfile과 로컬 환경으로 확인합니다.

---

## 실행 기준

Expo Go 초기 로딩 문제를 고려해 개발 및 확인은 기존 Expo Web 실행 방식을 유지합니다.

```powershell
cd C:\Users\espar\SPY-capstoneREPO\frontend\mobile
npx tsc --noEmit
npx expo start --web --clear
```

---

## 설치 및 실행

### 1. 프론트 폴더로 이동

```powershell
cd C:\Users\espar\SPY-capstoneREPO\frontend\mobile
```

### 2. 패키지 설치

의존성이 없는 새 환경이나 lockfile 변경 시에만 설치합니다.

```powershell
npm ci
```

### 3. 환경 변수 설정

`EXPO_PUBLIC_API_BASE_URL`이 설정되어 있으면 `services/apiConfig.ts`의 localhost 기본값보다 우선합니다. `.env.local`의 다른 항목은 보존합니다.

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

저장소의 배포 설정 주소:

```env
EXPO_PUBLIC_API_BASE_URL=https://spy-capstonerepo.onrender.com
```

### 4. 실행

```powershell
npx tsc --noEmit
npx expo start --web --clear
```

일반적인 웹 주소는 `http://localhost:8081`입니다. 다른 포트로 실행됐다면 서버 허용 Origin과 일치하는지 확인합니다.

---

## 백엔드 실행 필요

별도 터미널에서 기존 방식으로 실행합니다.

```powershell
cd C:\Users\espar\SPY-capstoneREPO\api
python -m uvicorn main:app --reload
```

```text
http://localhost:8000/docs
```

현재 DB에 필요한 컬럼이 없으면 서버가 켜져 있어도 `/signup`, `/login`, `/me` 등이 500으로 실패할 수 있습니다. 프론트 패치에서 서버 코드나 DB를 임의로 변경하지 않습니다.

---

## 주요 화면

### 인증 화면

* JSON 기반 로그인·회원가입과 토큰 저장
* 회원가입 시 수입 유형·수입일·소비 성향 입력
* 현재 회원가입 UI에는 닉네임 입력이 없음; 마이페이지에서 설정

### 홈

* 이번 달 현재 지출·리포트 전망·예산 상태
* 오늘의 챌린지 요약·레벨·포인트
* 장착 아이템을 반영한 캐릭터 방 및 주요 기능 이동
* 리포트 전망은 현재 서버의 선형 지출 속도 계산이며 ARIMA 결과와 구분

### 소비

* 날짜 선택·거래처·금액·카테고리·메모 입력
* 지출 추가·수정·삭제와 자동 분류 요청
* 새 지출 영역 아래 파일로 소비내역 등록 UI
* 파일 미리보기의 행 선택·카테고리 지정·제외 항목 접기
* 같은 화면의 항목별 예산: 월 예산·알림 기준·챌린지 대상 설정
* 별도 예산 탭은 노출하지 않음

### 챌린지

* 오늘의 챌린지 자동 조회 및 빈 목록일 때 생성 요청
* 유형·난이도·목표·예상 XP와 완료 대기/확정 상태 표시
* 완료 표시 및 당일 표시 취소; 즉시 XP 지급 안내 없음
* 캐릭터와 진행도 영역 분리, 좁은 화면에서 세로 배치
* 현재 예산 안내는 경고 카드와 소비 화면 이동으로 구현됨; 모든 초과 상황에서 목록을 대체하는 명세와 동일하다고 단정하지 않음

### 리포트

* 주간·월간 선택과 기간 이동
* 총지출·카테고리 비교·지출 추이·예산 상태
* 챌린지 성과·예산 변경·서버 총평
* 빈 데이터·부분 조회 실패 표시

### 마이페이지

* 닉네임·이메일·수입 유형·수입일·소비 성향 수정
* 누적 XP·레벨·포인트 표시
* 알림 선호 토글과 로그아웃
* 선호 저장은 실제 푸시 알림 전송 구현을 뜻하지 않음

### 소셜

* 본인 닉네임·레벨·캐릭터 방 요약
* 닉네임 검색, 친구 요청·수락·거절·취소·삭제
* 친구 프로필·캐릭터·장착 아이템·가구와 방 조회
* 닉네임 변경은 내 정보 수정으로 이동; 소셜에서 직접 수정하지 않음
* 서버 친구 랭킹 API는 있으나 현재 화면의 랭킹 연결은 미구현

### 캐릭터·상점·소지품

* 캐릭터 방과 클릭 반응
* 아이템 목록·포인트 구매·보유 목록·장착/해제
* 캐릭터 컬러·액세서리·벽지·바닥·가구·소품 표시
* 상점은 독립 하단 탭이 아니라 화면 내 경로로 진입

---

## 현재 API 연동 상태

실제 호출 코드가 있다는 것과 최신 서버 계약에 맞는 것은 별개입니다.

### 인증 / 사용자

`POST /signup`, `POST /login`, `GET /me`, `PATCH /me`를 사용합니다. 닉네임은 `/me` 수정 요청으로 저장합니다.

### 지출

CRUD 외에 `/transactions/import/preview`, `/transactions/import/confirm` 호출과 `memo` 전송 코드가 있습니다. 서버 분류는 `final_category`를 생략한 등록에서 사용됩니다. 별도 사전 분류 API는 `/transactions/classify`입니다.

**현재 가져오기 계약 보완 사항**

| 항목 | 서버 | 프론트 보완 내용 |
|---|---|---|
| 형식 | `source_format` | 확정 요청에 전달 |
| 날짜 | `occurred_at` | 미리보기 표시용 날짜·시간으로 변환 |
| 제외 여부 | `kind`, `importable`, `include`, 환불 상태 | 정확한 체크박스 기본값과 제외 이유 |
| 결과 | `inserted`, `skipped_duplicate`, `cancelled` | 토스트·후속 새로고침 결과 매핑 |
| 파일 제한 | CSV/XLSX, 5 MiB | 현재 XLS/15 MiB 허용 UI 수정 |

### 카테고리 / 예산

`GET /categories`, `PATCH /categories/{category_id}`, 리포트의 `/categories/budget-history`를 사용합니다. 서버 알림 기준은 **1~100%**이므로 프론트의 0% 허용 검사는 보완해야 합니다.

### 리포트

`GET /reports/weekly`, `GET /reports/monthly`, 챌린지 통계·예산 이력 응답을 사용합니다. 통계 수치나 AI 총평을 클라이언트가 별도로 확정하지 않습니다.

### 챌린지

`GET /challenges/today`, `POST /challenges/generate`, `PATCH /challenges/{challenge_id}/status`를 사용합니다.

정산 팝업 컴포넌트는 현재 `/challenges/settlements?days=14`를 호출하지만 해당 서버 경로는 없습니다. `/challenges/history`의 날짜별 `summary`, `challenges`, `reward_snapshot`을 변환하는 연결 작업이 필요합니다. 팝업 UI가 있다는 이유로 정산 결과 표시가 완료됐다고 기록하지 않습니다.

### 소셜 / 상점

친구 검색·프로필·요청·목록·삭제와 상점·구매·인벤토리·장착 API를 사용합니다. 공개 프로필은 금융 내역을 포함하지 않습니다.

상세 계약은 [docs/api.md](../../docs/api.md)를 기준으로 합니다.

---

## AI / 챌린지 연결 상태

프론트는 예측 모델을 직접 실행하지 않습니다. 서버의 `get_today_challenges()` 결과를 사용합니다.

* 메인 예측 경로는 statsmodels ARIMA와 평균 기반 대체 예측입니다.
* 서버가 한도·유형·난이도·XP를 계산하고 LLM은 문구만 만듭니다.
* 데이터가 없으면 서버 기본 챌린지가 반환될 수 있습니다.
* 생성 상태는 PENDING, 완료 표시 후 VERIFYING이며 보상은 검증에서 처리됩니다.
* 안내의 00:05는 예약 작업 기준입니다. 실제 서버는 날짜 변경 이후 접속 시 보정 정산도 수행합니다.

이번 문서 갱신에서는 토큰 발급·생성·배포 테스트를 실제로 수행하지 않았습니다.

---

## 폴더 구조

```text
frontend/mobile/
├─ app/
│  ├─ (tabs)/
│  │  ├─ _layout.tsx
│  │  ├─ home.tsx / challenge.tsx / social.tsx
│  │  ├─ report.tsx / transactions.tsx / mypage.tsx
│  │  ├─ character.tsx      # 숨김 탭 경로
│  │  └─ budget.tsx         # 소비 화면으로 리다이렉트
│  ├─ auth/login.tsx / auth/signup.tsx
│  ├─ social/[userId].tsx
│  ├─ shop.tsx / inventory.tsx
│  └─ _layout.tsx / index.tsx
├─ components/
│  ├─ AppTabBar.tsx / GlassCard.tsx / CharacterRoom.tsx
│  ├─ CsvImportCard.tsx / TransactionDatePicker.tsx
│  ├─ ChallengeSettlementPopup.tsx
│  └─ mascot/ / 기타 공통·기존 컴포넌트
├─ contexts/
│  ├─ MoniThemeContext.tsx / ToastContext.tsx
│  └─ MissionContext.tsx
├─ constants/              # 색상·테마·타이포그래피·기존 mock 자산
├─ services/
│  ├─ apiClient.ts / apiConfig.ts / tokenStorage.ts
│  ├─ authApi.ts / authService.ts
│  ├─ categoryApi.ts / categoryService.ts
│  ├─ challengeApi.ts / challengeService.ts
│  ├─ reportApi.ts / reportService.ts
│  ├─ transactionApi.ts / transactionService.ts
│  ├─ transactionImportApi.ts / socialApi.ts / publicInventory.ts
│  └─ shopApi.ts / shopService.ts / shopCatalog.ts / roomLayout.ts
├─ types/api.ts / types/report.ts / types/transactionImport.ts
├─ utils/
├─ package.json / package-lock.json / vercel.json
└─ README.md
```

## 공용 컴포넌트

| 컴포넌트 | 역할 | 사용/상태 |
|---|---|---|
| `AppTabBar` | 현재 하단 탭 UI | 탭 레이아웃에서 사용 |
| `GlassCard` | 외곽선 없는 공통 카드 | tone 호환, delay는 기존 호출 호환 용도 |
| `CharacterRoom` | 캐릭터·장착 가구·방 표시 | 본인·친구 화면 |
| `MoniMascot` / `WanderingMascot` | 캐릭터 표현·움직임 | 방·홈·챌린지 등 |
| `CsvImportCard` | CSV/XLSX 선택·미리보기 | 서버 계약 보완 필요 |
| `TransactionDatePicker` | 지출 날짜 선택 | 소비 등록·수정 |
| `ChallengeSettlementPopup` | 지난 정산 결과 모달 | 이력 API로 연결 보완 필요 |
| `AppToast` / `AppScreenHeader` | 알림·상단 제목 | 공통 |
| `EmptyState` / `EmptyStateCard` | 데이터 없음 표현 | 공통 |
| `AnimatedButton` / `AnimatedProgressBar` | 버튼·진행률 표현 | 기존 호출부 |

`JellyTabBar`, `GlassTopHeader`, `MotionCard` 등 파일이 남아 있는 것만으로 현재 모든 화면의 활성 컴포넌트라고 판단하지 않습니다.

## API 레이어 구조

* `*Api.ts`는 경로와 요청 형태를 캡슐화합니다.
* `*Service.ts`는 일부 기능에서 응답을 화면용으로 변환합니다.
* 일부 화면은 `apiRequest`를 직접 사용하며, 파일 가져오기는 multipart용 호출 함수를 사용합니다.
* 토큰 저장은 `loginApi()`에서 처리하며, `signupUser()`가 회원가입 토큰을 저장하는 구조가 아닙니다.

---

## 주요 데이터 흐름

### 로그인

```text
입력 → POST /login → access_token 저장 → GET /me → 홈
```

### 지출 추가

```text
소비 입력 → POST /transactions → 서버 분류/검사·저장 → 거래 재조회
→ 홈·리포트 재진입 시 최신 집계 조회
```

### 지출 수정

```text
수정 입력 → PATCH /transactions/{tx_id} → 캐시 무효화 → 목록 재조회
```

메모 빈 문자열은 삭제입니다. 날짜 변경 시 이전·새 기간 집계를 함께 확인합니다.

### 예산 수정

```text
항목별 예산 수정 → PATCH /categories/{category_id} → 화면 재조회
→ 조건 충족 시 서버의 PENDING 챌린지 재생성 예약
```

### 챌린지 완료

```text
완료 표시 → SUCCESS 요청 → 서버 VERIFYING 반환
→ 완료 대기 표시 → 다음 날 검증 성공 시 XP 반영
```

### 챌린지 완료 취소

```text
당일 VERIFYING 항목 선택 → PENDING 요청 → 표시 취소
→ 보상 지급 전이므로 XP 회수 없음
```

확정 SUCCESS/FAILED 항목은 일반 체크 토글로 되돌리지 않습니다.

---

## 계산 기준

### 월말 예상 지출

홈·리포트가 사용하는 월간 API 전망은 다음 기준입니다.

```text
해당 월 지출 합계 ÷ 기준일 일자 × 해당 월 일수
```

챌린지용 ARIMA 예상 지출과 동일한 값이라고 표시하지 않습니다. 종료 월은 실제 합계입니다.

### 소비 탭 예산 게이지

```text
카테고리별 이번 달 실제 지출 ÷ 해당 카테고리 월 예산
```

이는 예상 지출 사용률이 아닙니다. 예산 0·초과 지출 시 게이지와 문구를 별도로 점검합니다.

### 테마 적용

기본은 버터색입니다. 로그인 사용자의 **장착된 CHARACTER 컬러 아이템**을 기준으로 공통 테마를 결정하며 가구·벽지는 앱 테마를 바꾸지 않습니다. 공통 Context와 토큰을 사용하지 않는 직접 지정 색상은 별도 점검합니다. 친구의 캐릭터 색을 보더라도 본인의 전역 테마가 상대 색으로 바뀌면 안 됩니다.

---

## 타입 체크

```powershell
npx tsc --noEmit
```

타입 검사 통과는 서버 응답·업로드·정산·시각적 배치의 정상 작동을 보장하지 않습니다.

---

## 테스트 시나리오

### 1. 인증

회원가입 → 로그인 → 내 정보 조회 → 닉네임 변경 → 재로그인 후 저장 확인. DB 컬럼 누락 500과 계정 오류 401을 구분합니다.

### 2. 소비 기록

새 지출·과거 날짜·수정·삭제·메모 삭제·자동 분류·없는 카테고리 400을 확인합니다.

### 3. 예산

항목별 예산 저장·1~100% 알림 기준·챌린지 대상 변경·예산 증액 후 예약 결과를 확인합니다. 독립 예산 탭이 없는지 확인합니다.

### 4. 리포트

주간·월간·종료 기간·빈 데이터·기간 이동·날짜 변경 후 캐시 무효화를 확인합니다.

### 5. 챌린지

생성 → 완료 대기 → 체크 취소 시 보상 없음 → 다음 날 검증 → 중복 보상 없음 순으로 점검합니다. UI와 이력 API 연결 문제는 별도 실패로 기록합니다.

### 6. 소셜·꾸미기

별도 테스트 계정 두 개로 친구 요청·수락·거절·취소·삭제와 공개 프로필을 확인합니다. 아이템 장착 후 본인/친구 방에 동일한 상태가 보이는지 확인합니다.

### 7. 파일 가져오기

서버 계약 수정 후 토스 XLSX와 일반 CSV를 사용합니다. 수입·환불·중복·잘못된 행·분류 없음·재업로드·취소 거래를 포함해 저장 데이터까지 검증합니다. 현 상태를 정상 완료로 기록하지 않습니다.

### 8. 테마·레이아웃

스킨 미장착 버터 → 장착 색상 → 해제 버터를 확인합니다. 좁은 화면의 챌린지 캐릭터·진행도, 카드 외곽선, 팝업 및 닉네임 수정 위치를 점검합니다.

---

## 자주 발생한 문제

### Expo Go에서 화면이 무한 로딩됨

기존 Expo Web 실행 방식으로 확인합니다. 재설치나 다른 실행 환경 변경부터 시작하지 않습니다.

### API 요청이 CORS로 막힘

Network에서 실제 Origin·Request URL·상태를 먼저 확인합니다. 500 응답에 CORS 헤더가 없어 같은 문구가 표시될 수 있으므로, `/signup` 500을 무조건 프론트 주소 문제로 판단하지 않습니다.

### 로그인은 되지만 인증 API가 401을 반환함

로그인 이후 `/me` 요청의 Authorization과 토큰 저장 상태를 확인합니다. 민감한 토큰을 로그·이슈에 붙이지 않습니다.

### 지출 수정이 500으로 실패함

Traceback을 확인하고 DB 스키마·실행 중인 서버 버전·입력 형식을 대조합니다. 현재 schema는 date/time을 파싱하므로 예전 날짜 문자열 문제라고 일괄 단정하지 않습니다.

### Swagger Authorize가 422를 반환함

JSON 기반 `/login`과 Swagger OAuth2 form 인증 방식이 다를 수 있습니다. JSON 요청으로 토큰을 발급받아 인증 헤더로 확인합니다.

### 파일 업로드 라우트에서 서버 기동 실패

현재 서버 의존성에는 `python-multipart`와 `openpyxl`이 있습니다. 설치 누락은 백엔드 담당 환경에서 같은 Python의 pip로 확인합니다. 프론트 코드 변경으로 해결할 문제가 아닙니다.

### 테마 컴포넌트 타입 오류

`GlassCard`의 기존 `tone`/`delay` 호환과 `useMoniUi()` 호출 범위를 확인합니다. 다른 컴포넌트 안에서 선언한 `themedUi`를 자식 함수에서 사용할 수 없습니다.

---

## 문서 위치

| 문서 | 경로 |
|---|---|
| 프로젝트 전체 | [../../README.md](../../README.md) |
| API 명세 | [../../docs/api.md](../../docs/api.md) |
| AI 엔진 | [../../api/ai/README.md](../../api/ai/README.md) |
| 통합 테스트 | [../../docs/test-scenario.md](../../docs/test-scenario.md) |

---

## 개발 기준

* `feature/frontend`에서 작업 후 커밋·푸시·main 대상 PR을 진행합니다.
* 프론트 작업은 `frontend/mobile/`로 제한하며 백엔드·DB 변경이 필요하면 담당자와 별도로 합의합니다.
* 사용자 화면에 mock·fallback·임시 구현 안내 등 개발용 표현을 노출하지 않습니다.
* 기능을 만들 때 서버 경로·필수 필드·응답·오류 코드를 먼저 대조합니다.
* 변경 후 `npx tsc --noEmit`과 Expo Web 기능·화면 점검을 수행합니다.
* 테스트하지 않은 항목은 PR에서 확인 필요/보류로 남깁니다.

---

> 코드 근거: [frontend/mobile/package.json](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/frontend/mobile/package.json) · [frontend/mobile/app/(tabs)/_layout.tsx](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/frontend/mobile/app/%28tabs%29/_layout.tsx) · [frontend/mobile/app/(tabs)/transactions.tsx](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/frontend/mobile/app/%28tabs%29/transactions.tsx) · [frontend/mobile/app/(tabs)/social.tsx](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/frontend/mobile/app/%28tabs%29/social.tsx) · [frontend/mobile/contexts/MoniThemeContext.tsx](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/frontend/mobile/contexts/MoniThemeContext.tsx) · [frontend/mobile/components/ChallengeSettlementPopup.tsx](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/frontend/mobile/components/ChallengeSettlementPopup.tsx) · [frontend/mobile/services/transactionImportApi.ts](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/frontend/mobile/services/transactionImportApi.ts)
