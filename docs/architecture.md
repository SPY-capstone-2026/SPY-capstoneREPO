# Moni Architecture

이 문서는 Moni의 전체 시스템 구조, 데이터 흐름, 프론트엔드·백엔드·분석 엔진의 역할을 설명합니다. 코드가 존재하는 것과 배포 환경에서 정상 동작하는 것은 구분합니다.

---

## 1. 전체 구조

```text
사용자
  ↕
React Native / Expo Web Frontend
  ↕ HTTP API · JSON · JWT
FastAPI Backend
  ├─ 기능별 routers / services
  ├─ 내부 AI Engine: 전처리 → ARIMA/평균 예측 → 규칙 기반 챌린지
  │      ↔ 외부 OpenAI API: 코칭 문구·리포트 총평
  └─ SQLModel / SQLAlchemy ↔ PostgreSQL / SQLite
  ↑
GitHub Actions → 보호된 정산 API
```

현재 프론트 개발 및 확인은 Expo Web 기준입니다. DB가 AI 서버를 직접 호출하는 구조가 아니며, 백엔드가 DB 데이터를 조회한 뒤 내부 분석 함수를 호출합니다.

---

## 2. 구성 요소별 역할

| 영역 | 역할 |
|---|---|
| Frontend | 소비·예산·챌린지·리포트·꾸미기·친구 화면과 입력 검증 |
| Backend | 인증·거래·예산·생성·검증·보상·상점·소셜 API |
| Database | 계정, 거래, 분류 규칙, 예산 변경, 챌린지, 보상·아이템·친구 관계 |
| AI Engine | 소비 시계열, ARIMA/평균 예측, 압박도·목표 산정 |
| External LLM | 서버가 계산한 목표·통계를 자연어로 표현 |
| Scheduler | GitHub Actions가 정산 API를 주기적으로 호출 |
| Docs | 구현 명세·사용 절차·검증 계획과 알려진 불일치 기록 |

---

## 3. 핵심 서비스 흐름

```text
소비 기록·예산 설정
→ 카테고리별 소비 시계열 생성
→ 월말 예상 지출·예산 압박도 계산
→ 소비 전 참고할 하루 챌린지 제안
→ 사용자가 완료 표시 (VERIFYING)
→ 다음 날 해당 날짜의 실제 등록 지출과 비교
→ SUCCESS/FAILED 확정
→ 성공 XP 누적 · 레벨업 시 포인트와 보상
```

소비 전 개입은 결제 차단이나 실시간 계좌 감시가 아니라 사전에 목표를 제안하는 방식입니다. 은행 API의 실시간 계좌 연동은 현재 구현 범위로 확인되지 않았습니다.

---

## 4. 주요 데이터 흐름

### 4.1 회원가입 / 로그인

```text
회원가입 입력 → POST /signup → 계정·기본 카테고리 생성 → user_id 반환
로그인 입력 → POST /login → access_token 반환 → 프론트 토큰 저장
→ GET /me → 홈 화면
```

회원가입 응답 자체는 토큰이 아닙니다. 인증이 필요한 요청은 다음 헤더를 사용합니다.

```http
Authorization: Bearer {access_token}
```

서버는 회원가입에 선택적 `nickname`을 지원하지만 현재 회원가입 화면에는 닉네임 입력이 없으며, 마이페이지의 내 정보 수정에서 `PATCH /me`로 설정합니다.

### 4.2 지출 기록 흐름

```text
날짜·거래처·금액·카테고리·메모
→ POST /transactions
→ 카테고리 검사 또는 거래처 기반 추천
→ DB 저장·해당 기간 리포트 캐시 무효화
→ 거래 목록 재조회
```

`final_category`가 비어 있으면 저장된 사용자 분류 규칙과 키워드로 추천합니다. 추천이 없거나 사용자가 보유하지 않은 카테고리이면 400을 반환합니다. 현재 분류 로직은 별도의 학습 모델이 아니라 사용자 규칙·키워드 기반입니다.

수정은 `PATCH /transactions/{tx_id}`, 삭제는 `DELETE /transactions/{tx_id}`입니다. 날짜 변경 시 이전 날짜와 새 날짜가 포함된 캐시를 무효화합니다. `memo: ""`는 메모 삭제이며 응답의 `is_imported`는 `import_key` 존재 여부입니다.

### 4.3 예산 관리 흐름

```text
소비 화면의 항목별 예산
→ 월 예산·알림 기준(1~100%)·챌린지 대상 여부 수정
→ PATCH /categories/{category_id}
→ 변경 이력 저장
→ 예산이 증가하고 챌린지 대상이면 오늘 PENDING 챌린지 재생성 예약
→ 프론트 재조회
```

예산은 예측 시계열 자체를 바꾸지 않습니다. 예상 지출과의 비교, 하루 한도, 화면의 사용률에 영향을 줍니다. 재생성은 백그라운드 작업이며 `challenge_refresh_scheduled`로 예약 여부를 알립니다. 완료 대기·확정 챌린지를 임의로 다시 작성하지 않습니다.

### 4.4 월간 리포트 흐름

```text
GET /reports/monthly?target_date=YYYY-MM-DD
→ 해당 월 거래·예산·성과·예산 변경 조회
→ 합계·지출 속도 기반 전망·카테고리/주차 통계
→ 요약 사실을 규칙으로 선별
→ LLM 총평 또는 대체 문구
→ 응답 (종료 기간은 캐시 우선)
```

| 항목 | 설명 |
|---|---|
| 현재 지출 | 조회 월에 등록된 거래 금액의 합계 |
| 월말 전망 | 현재 월은 지출 속도 기반, 종료 월은 실제 합계 |
| 카테고리 비교 | 실제 지출·월 예산·전망값·초과 여부 |
| 소비 추이 | 요일별 합계와 주차별 집계 |
| 실천 성과 | 해당 기간의 챌린지 생성·달성 수와 성공 XP |
| 총평 | 계산된 통계와 예산 변경을 설명하는 문장 |

`GET /reports/weekly`는 해당 주·지난주 합계, 변화량, 카테고리 비교, 일별 흐름과 총평을 제공합니다. 보고서의 `target_date` 기본 처리는 `date.today()`를 사용하므로 서버 타임존도 별도로 점검합니다.

### 4.5 챌린지 생성 흐름

```text
GET /challenges/today
→ 밀린 정산 보정 → KST 오늘의 챌린지 조회
→ 없으면 POST /challenges/generate
→ 사용자·카테고리·거래 데이터로 내부 AI 함수 호출
→ list[dict] 생성 또는 fallback
→ DB 저장 → 목록 표시
```

사용자·날짜 단위 생성 직렬화와 기존 결과 재사용으로 중복 생성을 방지합니다. 거래를 추가했다고 같은 날 생성 API가 기존 챌린지를 모두 재생성하는 것은 아닙니다.

```text
완료 표시: SUCCESS 또는 VERIFYING 요청 → VERIFYING 저장 → XP/포인트 변화 없음
표시 취소: 당일 PENDING 요청 → 체크 해제 → XP/포인트 변화 없음
다음 날 검증: 과거 VERIFYING → 지출 비교 → SUCCESS 또는 FAILED
```

최종 확정 후 변경은 제한되며, 같은 상태의 재요청과 변경 요청을 구분합니다. 성공 후 거래를 수정해도 기존 검증을 자동으로 되돌리지 않습니다.

### 4.6 파일 가져오기 흐름

```text
CSV/XLSX 선택
→ POST /transactions/import/preview (multipart file)
→ 형식 판별·카테고리 추천·중복/환불/수입 분류 (DB 저장 없음)
→ 사용자가 행·카테고리 확인
→ POST /transactions/import/confirm
→ 원자적 등록·중복 건너뜀·선택 취소 처리
→ inserted / skipped_duplicate / cancelled 응답
```

서버 확정 요청은 `source_format`, `rows`가 필수이며 행에는 `import_key`, `occurred_at`, `merchant_name`, `amount`, `final_category`를 사용합니다. 소유자별 거래 키의 DB 고유 제약으로 중복 저장을 방지합니다.

**현 상태:** 화면과 서버가 존재하지만 프론트의 필드 변환·확정 요청·결과 개수 매핑이 서버 계약과 다릅니다. 자세한 불일치는 API 문서에 기록합니다.

### 4.7 정산 결과·성장·소셜 흐름

서버의 지난 결과 조회는 `/challenges/history`입니다. 날짜별 요약과 `verification_result`, `reward_snapshot`을 반환하며, 과거 미체크 항목은 조회용 `result=MISSED`로 구분합니다.

검증 성공 → XP 누적 → 레벨 계산 → 레벨업 포인트·마일스톤 아이템 지급 순서입니다. 일반 레벨업은 50P이며 5의 배수 레벨은 추가 100P와 지정 아이템이 적용될 수 있습니다. 구매한 아이템의 소유·장착 상태를 조회해 캐릭터와 방에 반영합니다.

친구 공개 응답에는 닉네임·레벨·XP·캐릭터·장착 아이템만 포함하며 개인의 거래·예산·이메일·보유 포인트는 노출하지 않습니다. 공개 프로필 조회는 현재 인증된 사용자에게 제공되며, 친구에게만 접근을 제한한다고 문서화하지 않습니다.

---

## 5. 월간 리포트 월말 예상 지출 계산 기준

월간 리포트 API는 현재 다음 지출 속도 기반 계산을 사용합니다.

```text
리포트 전망 = 해당 월 현재 지출 ÷ 기준일의 일자 × 해당 월 전체 일수
```

예시: 30일인 달의 10일에 100,000원을 기록했다면 전망은 300,000원입니다. 종료된 달은 기준일이 말일이므로 실제 총합과 같습니다.

챌린지 엔진은 다른 방식입니다.

```text
챌린지용 예상 월 지출 = 이번 달 누적 실제 지출 + 남은 기간 ARIMA/평균 예측
```

**두 계산은 같은 값이 아닙니다.** 홈·리포트에 표시된 모든 전망을 ARIMA 결과라고 설명하면 안 됩니다. 예산 수정은 비교 기준과 챌린지 한도를 바꾸지만 예측 함수의 거래 입력을 바꾸지 않습니다.

---

## 6. 예산 압박도 기준

```text
예산 압박도 = 예상 월 지출 ÷ 월 예산
```

| 압박도 | 기본 계수 | 해석 |
|---|---:|---|
| 0.8 미만 | 1.0 | 상대적 여유 |
| 0.8 이상 1.1 미만 | 0.7 | 목표 조절 |
| 1.1 이상 1.5 미만 | 0.4 | 더 강한 조절 |
| 1.5 이상 | 0.0 | 무지출 목표 |

최종 계수는 위 계수와 `남은 예산 / 남은 기간 예상 소비` 중 작은 값입니다. 유형·난이도·XP는 최종 계수와 최소 한도·예산 소진 규칙으로 결정합니다. 리포트 총 예산 0 처리와 AI 예산 0 처리도 서로 다르므로 경계 조건을 테스트합니다.

---

## 7. AI Engine 구조

| 파일 | 역할 |
|---|---|
| `preprocessing.py` | 사용자·카테고리·기간 필터, 일별 합계, 누락 날짜 0 채움, streak |
| `prediction.py` | statsmodels ARIMA·평균 대체 예측과 압박도 |
| `challenge.py` | 하루 한도·유형·난이도·XP의 규칙 계산 |
| `engine.py` | 카테고리 평가·우선순위·0~4개 챌린지 조립 |
| `llm_client.py` | 외부 LLM 호출 및 규칙 문구 대체 |
| `report.py` | 리포트 사실 선별·표현·대체 총평 |

```text
거래·예산 → 전처리 → ARIMA/평균 예측 → 압박도/한도 계산
→ LLM 문구 또는 규칙 문구 → 챌린지 결과 → 백엔드 저장
```

현재 외부 분기는 **90일 이상 AND (비영 지출일 비율 0.2 이상 OR 원본 거래 50건 이상) AND 잔여일수 > 0**일 때 ARIMA 함수를 호출합니다. 함수 내부의 최소 40개 관측값 방어 조건과 혼동하지 않습니다. ARIMA(7,0,1) 적합 실패 시 (1,0,0)을 재시도하고 필요하면 평균 예측으로 전환합니다.

---

## 8. fallback 챌린지 흐름

```text
소비 데이터 없음 / 엔진 결과 없음 / 엔진 오류
→ 서버 fallback 챌린지
→ 사용자에게 기본 실천 과제 표시
```

예측 모델의 평균 대체, LLM의 규칙 문구 대체, 서버의 기본 챌린지는 서로 다른 fallback입니다. 현재 숫자 한도가 없어 검증할 수 없는 챌린지는 `UNVERIFIABLE_POLICY="approve"`에 따라 완료 표시를 신뢰하여 성공 처리할 수 있습니다. 따라서 모든 챌린지가 금액으로 엄격하게 검증된다고 표현하지 않습니다.

---

## 9. 주요 API와 화면 연결

| 화면 | 사용하는 API·상태 |
|---|---|
| 로그인·회원가입 | `/login`, `/signup`, `/me` |
| 홈 | `/me`, `/reports/monthly`, `/challenges/today`, `/shop/inventory` |
| 소비 | `/transactions`, `/categories`, 분류·가져오기 API |
| 리포트 | `/reports/weekly`, `/reports/monthly`, 챌린지 통계, 예산 변경 이력 |
| 챌린지 | 오늘 조회·생성·상태 변경 |
| 정산 팝업 | 현재 `/challenges/settlements` 호출: 서버 `/challenges/history`로 연결 보완 필요 |
| 소셜 | 친구 검색·요청·목록·공개 프로필; 랭킹 API는 UI 미연결 |
| 캐릭터·상점·소지품 | `/shop/items`, `/shop/purchase/{item_id}`, `/shop/inventory`, 장착 API |
| 마이페이지 | `/me` 조회·수정, 로컬 설정 저장 |

상세 요청·응답은 [api.md](./api.md)를 참고합니다.

---

## 10. 프론트엔드 구조

| 경로 | 역할 |
|---|---|
| `app/(tabs)/` | 홈·챌린지·소셜·리포트·소비·마이페이지 |
| `app/(tabs)/character.tsx` | 숨김 탭 경로의 캐릭터 화면 |
| `app/(tabs)/budget.tsx` | 기존 링크 호환용 소비 화면 리다이렉트 |
| `app/auth/`, `app/social/[userId].tsx` | 인증·친구 상세 |
| `app/shop.tsx`, `app/inventory.tsx` | 상점·보유 아이템 |
| `components/` | 카드·탭바·방·파일 미리보기·달력·팝업 |
| `contexts/` | MoniThemeProvider, ToastProvider 등 |
| `services/`, `types/` | API 호출·형식 변환·타입 |
| `constants/`, `utils/` | 공통 스타일·색상·표현 유틸 |

흰 배경·외곽선 없는 카드·기본 버터색이 UI 방향입니다. 장착한 `CHARACTER` 색상만 앱 테마를 변경합니다. 공통 토큰 밖의 직접 지정 색상과 네이티브 화면 적용은 별도 검증이 필요합니다.

---

## 11. 백엔드 구조

| 경로 | 역할 |
|---|---|
| `main.py` | FastAPI 앱·라우터·CORS·시작 시 테이블 생성 |
| `auth.py` | 비밀번호 해시·JWT 발급/검사 |
| `models.py`, `schemas.py`, `serializers.py` | DB 모델·입력·응답 계약 |
| `routers/` | 기능별 HTTP 엔드포인트 |
| `services/` | 업무 로직·검증·보상·가져오기·캐시 |
| `migrations/` | 기존 DB 스키마 변경 이력 |
| `seed_all.py` | 기존 데이터 삭제 후 시드 생성; 운영 실행 금지 |
| `ai/` | 내부 분석 모듈·테스트·과거 노트북 |
| `test/`, `conftest.py` | 임시 DB와 AI 대역을 사용하는 API 테스트 |

---

## 12. 데이터 저장 구조

| 데이터 | 설명 |
|---|---|
| `User` | 계정·닉네임·수입 설정·누적 XP·레벨·포인트 |
| `Transaction` | 날짜·금액·거래처·분류·메모·가져오기 키 |
| `MerchantCategoryRule` | 사용자별 거래처 분류 선택 |
| `UserCategorySetting` / `BudgetChangeLog` | 월 예산·챌린지 대상·알림 기준·변경 이력 |
| `DailyChallenge` | 목표·상태·AI 근거·검증 결과·보상 스냅샷 |
| `PointTransaction` | 포인트 증감 이력 |
| `ShopItem` / `UserInventory` | 아이템 정의·소유·장착 상태 |
| `GeneratedReport` | 종료된 기간의 리포트 캐시 |
| `Friendship` | 요청자·수신자·정규화된 쌍 키·수락 상태 |

실제 테이블명·컬럼은 모델과 마이그레이션을 기준으로 확인합니다. 테이블 생성과 기존 테이블 변경은 별도 작업입니다.

---

## 13. 배포 구조

```text
Frontend: Expo Web 정적 빌드 → Vercel 설정
Backend: FastAPI → Render 주소 설정
Database: DATABASE_URL로 연결 (기본 로컬 SQLite)
Scheduler: GitHub Actions → /internal/challenges/verify
```

```env
EXPO_PUBLIC_API_BASE_URL=https://spy-capstonerepo.onrender.com
```

로컬 개발:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

정산 호출은 JWT가 아닌 서버 측 `CRON_SECRET`과 `X-Cron-Secret`으로 보호합니다. 이 비밀값을 프론트 환경 변수나 앱 번들에 넣지 않습니다. 배포 설정과 실제 배포·DB 연결 상태는 별도 확인 대상입니다.

---

## 14. 설계상 중요한 판단

### 1. 소비 예측은 행동 개입을 위한 수단이다

예측값 자체보다 하루 목표와 실천 검증으로 연결하는 흐름이 핵심입니다. 수치 판단은 서버가, 자연어 표현은 LLM이 맡습니다.

### 2. 예산은 목표 기준이고, 지출 예측은 실제 행동 기준이다

예산과 예상 지출은 서로 다른 입력·출력입니다. 리포트의 속도 기반 전망과 챌린지의 ARIMA 예측도 구분합니다.

### 3. fallback은 초기 사용자 경험을 위한 안전 장치다

예측 부족·외부 API 실패 시 대체 경로가 있습니다. 대체 경로의 사용과 검증 한계를 숨겨 성능이나 신뢰성을 과장하지 않습니다.

### 4. 프론트는 실제 API 기준으로 구성한다

새 화면을 만들기 전에 서버 경로·요청·응답 계약을 대조합니다. 정산 팝업과 파일 가져오기는 이 계약의 불일치가 남아 있으며, 문서 갱신만으로 기능이 수정되지는 않습니다.

---

## 15. 향후 확장 방향

* 정산 이력과 업로드 프론트 계약 일치 및 엔드투엔드 검증
* 00:05 예약·KST 날짜 보정 정책 정리
* ARIMA 분기 상수명·실제 대체 모델 표기·예측 구간 평가 개선
* 친구 랭킹 UI와 알림 전송 구현 범위 확정
* 운영 DB 마이그레이션·테스트 DB 분리 및 비밀값 관리
* 타입 검사·API 테스트·문서 계약 확인의 CI 확장
* 사용자 실험으로 소비 변화와 참여 지속성 평가

---

> 코드 근거: [api/main.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/main.py) · [api/routers/reports_router.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/routers/reports_router.py) · [api/routers/categories_router.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/routers/categories_router.py) · [api/ai/moni_engine/prediction.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/ai/moni_engine/prediction.py) · [api/services/challenge_verification_service.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/services/challenge_verification_service.py) · [api/services/challenge_history_service.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/services/challenge_history_service.py) · [.github/workflows/verify-challenges.yml](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/.github/workflows/verify-challenges.yml)
