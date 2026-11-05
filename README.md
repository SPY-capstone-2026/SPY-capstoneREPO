# Moni

> 사용자의 과거 소비 패턴을 분석해 미래 지출을 예측하고, 예산 상황에 맞는 **오늘의 소비 개선 챌린지**를 제안하는 소비 습관 코칭 앱

🔗 **웹 배포 설정 주소:** https://spy-capstone-repo.vercel.app  
📖 **Self demo 가이드:** [self_demo.md](./self_demo.md)

![Python](https://img.shields.io/badge/Python-Backend-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.136.1-009688?logo=fastapi&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-Expo-000020?logo=expo&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-DB-4169E1?logo=postgresql&logoColor=white)
![ARIMA](https://img.shields.io/badge/Forecast-ARIMA-2D6CDF)

---

## 빠르게 확인하기

| 항목 | 링크 |
|---|---|
| 웹 데모 설정 주소 | https://spy-capstone-repo.vercel.app |
| Self demo 가이드 | [self_demo.md](./self_demo.md) |
| API 문서 | [docs/api.md](./docs/api.md) |
| 프론트엔드 문서 | [frontend/mobile/README.md](./frontend/mobile/README.md) |

배포 주소는 저장소 설정에서 확인한 값입니다. 이 문서 갱신 과정에서 배포 서비스의 가동 상태나 계정 존재 여부를 확인한 것은 아닙니다.

### 시연용 계정

```text
이메일: student@moni.app
비밀번호: moni1234
```

### 핵심 흐름

소비 기록·예산 설정  
→ 카테고리별 예상 지출·예산 압박도 계산  
→ 소비 전에 참고할 맞춤형 챌린지 제안  
→ 사용자의 완료 표시(`VERIFYING`, 보상 없음)  
→ 다음 날 등록된 지출로 달성 검증  
→ 성공 시 XP 누적, 레벨업 시 포인트·지정 보상 반영

---

## 프로젝트 소개

### 해결하려는 문제

소비 내역과 통계를 확인하는 것만으로는 **오늘 어떤 소비를 조절해야 하는지** 결정하기 어렵습니다. Moni는 기록을 구체적인 하루 목표로 연결하고, 반복적인 소비 관리에 성장과 꾸미기의 동기를 더하는 것을 목표로 합니다.

기존 금융 앱도 예산 설정, 알림, 추천과 보상을 제공합니다. 따라서 차별점은 다른 서비스에 기능이 전혀 없다는 것이 아니라, **지출 예측 → 목표 제안 → 기록 기반 검증 → 성장 보상**을 하나의 흐름으로 연결하는 데 있습니다.

> 소비 전 개입은 결제를 차단하거나 모든 거래를 실시간 감지한다는 뜻이 아닙니다. 사용자가 소비하기 전에 확인하고 실천할 수 있는 목표를 제공합니다.

### 기술 솔루션

카테고리별 소비 시계열을 만들고 **statsmodels 기반 ARIMA** 또는 평균 기반 대체 예측으로 월말 예상 지출을 계산합니다. 서버가 예산 압박도와 남은 예산을 반영해 한도·유형·난이도·XP를 산정하고, 외부 LLM은 정해진 목표의 안내 문구와 리포트 총평을 생성합니다.

FastAPI 서버 내부에 분석 모듈을 두며, React Native·Expo 클라이언트가 HTTP API로 결과를 조회합니다.

### 기대 효과

- 소비하기 전에 구체적인 하루 목표를 확인할 수 있습니다.
- 예산과 소비 기록에 맞는 개인화된 목표를 제안합니다.
- 경험치·레벨업·꾸미기와 친구 교류를 통해 지속적인 참여를 지원합니다.
- 주간·월간 리포트로 소비 변화와 챌린지 성과를 돌아볼 수 있습니다.

실제 소비 감소, 유지율 개선, 예측 정확도 향상은 별도의 실험으로 검증할 기대효과입니다. 코드 구현만으로 입증된 성과로 표시하지 않습니다.

---

## 기존 서비스와의 차이

| 구분 | 가계부·통합 금융 앱의 대표 기능 | Moni의 중점 |
|------|----------------------------|-------------|
| 소비 파악 | 거래 기록, 자산 조회, 예산과 통계 확인 | 예측을 하루 실천 목표에 연결 |
| 소비 전 지원 | 예산 설정, 예정 지출 확인, 알림·추천 등 | 예상 지출·남은 예산에 따른 챌린지 |
| 실천 확인 | 서비스별 관리·참여 방식 제공 | 완료 표시 후 등록된 지출로 검증 |
| 동기부여 | 서비스별 정보·혜택·포인트 제공 | XP·레벨업·캐릭터와 방 꾸미기 |
| 사용자 경험 | 자신의 금융 현황을 이해하고 관리 | 오늘의 목표를 실천하고 성장 확인 |

각 서비스의 기능 부재를 단정하는 비교가 아닙니다. 구체적인 앱 비교와 근거는 [docs/PMF.md](./docs/PMF.md)를 참고합니다.

---

## 시스템 아키텍처

```text
React Native / Expo Web 클라이언트
             ↕ HTTP API / JSON / JWT
FastAPI 서버
 ├─ 인증·거래·예산·챌린지·리포트·상점·소셜 API
 ├─ 내부 분석 모듈: Pandas / NumPy / statsmodels ARIMA
 ├─ 규칙 기반 목표 산정·검증·보상 처리
 ├────────↔ 외부 OpenAI API (코칭 문구·리포트 총평)
 └────────↔ SQLModel / SQLAlchemy ↔ PostgreSQL 또는 SQLite
             ↑ 보호된 검증 API 호출
GitHub Actions (매일 00:05 KST로 예약)
```

AI 엔진은 별도 네트워크 서버가 아니라 백엔드에서 Python 함수로 호출하는 내부 모듈입니다. 스케줄 예약 시각과 실제 작업 실행 시각은 다를 수 있습니다.

### 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React Native, Expo, TypeScript, Expo Router |
| Backend | Python, FastAPI, SQLModel / SQLAlchemy, JWT |
| Database | `DATABASE_URL`로 지정한 DB, 기본 로컬값 SQLite |
| AI / 예측 | Pandas, NumPy, statsmodels ARIMA, 평균 기반 대체 예측 |
| 문구 생성 | OpenAI API, 규칙 기반 대체 문구 |
| 파일 처리 | CSV 파서, openpyxl(XLSX), python-multipart |
| 배포·정산 설정 | Vercel 프론트, Render 백엔드 주소, GitHub Actions |

> `frontend/mobile`은 실제 Expo 앱입니다. `frontend/index.html`은 README를 보여주는 별도의 정적 페이지이며 서비스 화면이 아닙니다. 실제 배포 여부·DB 제공자는 실행 환경을 별도로 확인해야 합니다.

---

## 핵심 기능

1. **소비 예측** — 챌린지 엔진이 과거 소비와 이번 달 실지출을 바탕으로 카테고리별 월말 지출을 추정합니다.
2. **예산 압박도 분석** — 예상 지출을 월 예산과 비교하여 조절이 필요한 카테고리를 선정합니다.
3. **데일리 챌린지** — 압박도 상위 최대 3개와 조건부 무지출 보너스 최대 1개를 생성합니다.
4. **검증과 성장** — 완료 표시는 대기 상태이며, 검증 성공 시 XP와 레벨업 보상이 처리됩니다.
5. **주간·월간 리포트** — 기간별 지출, 변화량, 예산·챌린지 성과와 AI 총평을 제공합니다. 리포트의 월말 전망은 현재 ARIMA가 아닌 지출 속도 기반 계산입니다.
6. **소비 기록과 예산** — 날짜·거래처·금액·카테고리·메모를 관리하고 소비 화면에서 카테고리별 예산을 조정합니다.
7. **파일 가져오기** — CSV/XLSX 미리보기·중복 방지·등록 API와 프론트 UI가 있습니다. 현재 요청·응답 매핑 보완이 필요합니다.
8. **캐릭터·상점·소셜** — 아이템 구매·장착, 방 꾸미기, 친구 요청과 공개 프로필을 제공합니다.
9. **테마** — 기본 버터색을 사용하며 장착한 캐릭터 컬러 스킨을 공통 테마에 반영합니다.

---

## AI 엔진: 예측 기반 챌린지 생성

`api/ai/moni_engine/`의 전처리·예측·목표 산정·통합·LLM·리포트 모듈이 역할을 나눕니다. 운영 진입점은 `engine.get_today_challenges()`입니다.

### 입력 (Backend → AI)

- 거래의 사용자 ID, 날짜, 금액, 최종 카테고리
- 카테고리별 월 예산과 챌린지 대상 여부
- 사용자 ID와 유효 데이터 시작일

수입일과 소비 성향은 계정 정보로 저장하지만, 현재 엔진의 월 구간이나 한도 계산에 직접 사용하지 않습니다.

### 출력 (AI → Backend)

- `list[dict]`: 0~4개 챌린지
- `challenge_type`, `challenge_text`, `difficulty`, `xp_reward`
- `ai_metadata`: `schema_version`, `model_used`, 예상 지출, 압박도, 한도·조정계수, 생성 이유 등
- `reward_snapshot`, `verification_result`: 생성 시점의 예측값이 아니라 이후 검증·보상 과정에서 저장하는 기록

현재 응답은 요청별 MAE/RMSE/MAPE 측정치를 자동으로 제공하지 않습니다.

### 압박도 구간별 챌린지

압박도는 기본 조정계수를 정합니다. 실제 유형·XP는 **남은 예산까지 고려한 최종 계수**와 최소 한도 규칙으로 결정됩니다.

| 압박도 | 기본 조정계수 |
|--------|-------------:|
| 0.8 미만 | 1.0 |
| 0.8 이상 1.1 미만 | 0.7 |
| 1.1 이상 1.5 미만 | 0.4 |
| 1.5 이상 | 0.0 |

| 최종 계수 | 기본 유형 | 난이도 | XP |
|-----------|----------|--------|---:|
| 0.8 이상 | 유지형 | Easy | 10 |
| 0.55 이상 0.8 미만 | 제한형 | Medium | 20 |
| 0.3 이상 0.55 미만 | 강한 제한형 | Medium-Hard | 25 |
| 0 이상 0.3 미만 | 금지형 | Hard | 30 |

오늘 한도는 예상 하루 지출에 최종 계수를 곱해 500원 단위로 반올림합니다. 남은 예산이 없거나 계산된 한도가 최소 기준(2,000원)에 미달하면 금지형 처리 규칙이 적용됩니다. 무지출 보너스는 연속 2일 이상·비영 지출일 비율 0.4 이상인 카테고리를 대상으로 하며 XP는 `min(15 + 연속일수 × 5, 60)`입니다.

### 대표 예시

```text
카페 │ 금지형 │ Hard │ 검증 성공 시 30 XP
오늘은 카페 지출 없이 하루를 보내보세요.

식비 │ 제한형 │ Medium │ 검증 성공 시 20 XP
오늘은 식비 지출을 5,000원 이하로 유지해보세요.

카페 │ streak형 │ Special │ 검증 성공 시 35 XP
카페 무지출 4일 연속 중! 오늘도 이어가서 5일째 달성해볼까요?
```

---

## 현재 구현 현황

### 구현 위치 요약

| 기능 | 코드에서 확인한 내용 | 주요 코드 위치 |
|---|---|---|
| 인증·프로필 | JWT, 회원가입, 닉네임 조회·수정 | `api/routers/auth_router.py`, `users_router.py` |
| 지출·파일 | CRUD, 메모, 분류 추천, CSV/XLSX 파싱·확정 | `api/routers/transactions_router.py`, `api/services/transaction_import_service.py` |
| 예산 | 예산 변경 이력, 조건부 미완료 챌린지 재생성 | `api/routers/categories_router.py` |
| 리포트 | 주간·월간 통계, 총평, 종료 기간 캐시 | `api/routers/reports_router.py` |
| 챌린지 | 생성·완료 대기·검증·이력·통계 | `api/routers/challenges_router.py`, `api/services/challenge_verification_service.py` |
| AI 엔진 | ARIMA와 평균 대체 예측, 규칙 기반 목표, LLM 문구 | `api/ai/moni_engine/` |
| 성장·꾸미기 | XP·레벨업·상점·인벤토리 | `api/services/leveling.py`, `shop_service.py` |
| 소셜 | 친구 요청·공개 프로필·랭킹 API | `api/routers/social_router.py` |
| 테마·화면 | 공통 테마, 닉네임 수정, 소비 내 예산 통합 | `frontend/mobile/contexts/MoniThemeContext.tsx`, `app/(tabs)/` |

### ✅ 완료

아래는 **구현 코드가 존재하는 범위**입니다. 이번 문서 갱신에서 실제 서비스 테스트가 통과했다는 의미는 아닙니다.

* ARIMA 예측 함수와 메인 의존성의 statsmodels 반영
* 기본·무지출 챌린지 생성, 완료 대기 상태와 서버 검증·보상 로직
* 주간·월간 리포트, 예산 변경 이력과 소비 CRUD
* 거래 분류, CSV/XLSX 미리보기·등록 API
* 캐릭터·방·상점·보유 아이템·친구 공개 프로필 구현
* 기본 버터 및 캐릭터 스킨 기반 공통 테마, 예산 탭 숨김·소비 화면 연결

### 🔄 현재 상태

* 프론트 확인 기준은 Expo Web입니다.
* **정산 팝업:** 프론트는 `/challenges/settlements?days=14`를 호출하지만 현재 서버는 `/challenges/history`를 제공합니다. 요청 경로와 응답 변환을 수정해야 합니다.
* **파일 등록:** 프론트 확정 요청에 서버 필수값 `source_format`이 빠져 있으며, 날짜·제외 상태·등록 결과 필드 매핑도 보완 대상입니다.
* **업로드 제한:** 서버는 `.csv/.xlsx`, 5 MiB를 허용하지만 프론트 선택 UI는 `.xls`와 15 MiB도 허용하여 불일치합니다.
* **정산 시각:** Actions 예약은 00:05 KST입니다. 조회 API의 보정 정산은 날짜가 바뀌면 실행되므로 00:05 이전 실행을 막는 조건은 없습니다.
* **친구 랭킹:** 서버 API는 있으나 현재 소셜 화면에서 연결한 랭킹 UI는 확인되지 않습니다.
* **실행 환경:** 기존 DB의 `nickname`, `memo`, `import_key` 등은 별도 마이그레이션 확인이 필요합니다. `create_all()`은 기존 테이블의 누락 컬럼을 추가하지 않습니다.
* **AI 설정 정리:** `api/ai/requirements.txt`와 일부 주석·상수명·예제는 이전 모델 기준이 남아 있습니다. 서버용 의존성은 `api/requirements.txt`를 기준으로 확인합니다.

### 📋 향후 개선

* 정산 이력·파일 가져오기 프론트/백엔드 계약 일치 및 회귀 테스트
* ARIMA 분기 상수명·대체 예측의 `model_used` 표기 정리
* 실제 소비 데이터 기반 모델 재평가 및 구간 예측 검증
* 00:05 정산 정책과 접속 시 보정 정책의 일치 여부 결정
* 화면 전체 스킨 적용, 모바일 파일 선택, 접근성·레이아웃 검증
* 친구 랭킹 UI와 알림 전송 기능의 범위 결정
* 사용자 실험으로 챌린지 효과·참여 지속성 평가

---

## 저장소 구조

```text
SPY-capstoneREPO/
├─ README.md
├─ self_demo.md
├─ Procfile
├─ .github/workflows/verify-challenges.yml
├─ api/
│  ├─ main.py / auth.py / models.py / schemas.py / serializers.py
│  ├─ routers/                  # 기능별 API
│  ├─ services/                 # 검증·보상·가져오기·소셜·캐시
│  ├─ migrations/               # 기존 DB 스키마 갱신
│  ├─ seed_all.py               # 파괴적 초기화: 일반 실행에서 제외
│  ├─ generate_seed.py / seed_transactions.csv
│  ├─ requirements.txt
│  ├─ test/ / conftest.py
│  └─ ai/
│     ├─ moni_engine/
│     │  ├─ preprocessing.py / prediction.py / challenge.py
│     │  └─ engine.py / llm_client.py / report.py
│     ├─ tests/ / notebooks/ / moni_pipeline.ipynb
│     ├─ requirements.txt       # 이전 모델 의존성 잔존, 정리 필요
│     └─ README.md
├─ frontend/
│  ├─ index.html                # README 뷰어
│  └─ mobile/
│     ├─ app/ / components/ / contexts/
│     ├─ services/ / constants/ / types/ / utils/
│     ├─ package.json / vercel.json
│     └─ README.md
└─ docs/
   ├─ api.md / architecture.md / test-scenario.md
   ├─ PMF.md / elevator_speech.md / Team_Ground_Rule.md
   ├─ AI 예측모델 비교리포트.md
   └─ 2026-2-meetings.md
```

### 주요 폴더 설명

| 경로 | 설명 |
|---|---|
| `api/` | FastAPI 서버·모델·마이그레이션 |
| `api/ai/` | 챌린지용 예측·문구 생성 및 리포트 총평 |
| `frontend/index.html` | README를 보여주는 정적 페이지 |
| `frontend/mobile/` | 실제 React Native / Expo 앱 |
| `frontend/mobile/app/` | 화면과 라우팅 |
| `frontend/mobile/components/` | 공통 화면 요소 |
| `frontend/mobile/contexts/` | 테마·토스트 등 공유 상태 |
| `frontend/mobile/services/` | API 호출·응답 가공 |
| `docs/` | API·아키텍처·기획·테스트·회의 기록 |
| `self_demo.md` | 시연 절차와 제한 사항 |

---

## 실행 방법

### 1. 백엔드 실행

기존 개발 환경에서는 다음 방식으로 실행합니다.

```powershell
cd C:\Users\espar\SPY-capstoneREPO\api
python -m uvicorn main:app --reload
```

의존성을 처음 설치하거나 갱신할 때만 같은 Python으로 `python -m pip install -r requirements.txt`를 실행합니다. `/docs`의 Swagger UI가 열리는 것은 서버 기동 확인이며, 모든 API·DB가 정상이라는 뜻은 아닙니다.

```text
http://localhost:8000/docs
```

**DB를 삭제하거나 시드로 초기화하지 않습니다.** 기존 DB를 변경할 때는 먼저 백업하고 실제 `DATABASE_URL`, 마이그레이션 기록, 스키마를 백엔드 담당자와 확인합니다.

### 2. 프론트엔드 (모바일 앱) 실행

```powershell
cd C:\Users\espar\SPY-capstoneREPO\frontend\mobile
npx tsc --noEmit
npx expo start --web --clear
```

타입 검사에 오류가 있으면 먼저 해결합니다. 의존성 설치가 필요한 최초 환경에서만 `npm ci`를 별도로 실행합니다.

로컬 백엔드:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

저장소의 배포 설정 주소:

```env
EXPO_PUBLIC_API_BASE_URL=https://spy-capstonerepo.onrender.com
```

### 3. AI 엔진 단독 실행 / 테스트

서버용 의존성과 별도로 테스트 도구가 준비된 환경에서 실행합니다.

```powershell
cd C:\Users\espar\SPY-capstoneREPO\api\ai
python tests/test_engine.py
```

기존 테스트와 노트북에는 이전 모델·시드 경로를 전제로 한 부분이 남을 수 있습니다. 실행 성공·실패 및 사용 입력을 기록하고, 테스트 통과와 모델 정확도 검증을 구분합니다. AI별 `requirements.txt`를 그대로 설치해 현재 운영 의존성이 맞는다고 가정하지 않습니다.

---

## 테스트 및 검증

### AI 엔진 테스트

ARIMA 진입 조건, 적합 실패·상한 가드 시 평균 대체 예측, 무지출·빈 데이터, 월말 잔여 0일을 각각 확인합니다. 모델 수치 실험은 [AI 비교 리포트](./docs/AI%20예측모델%20비교리포트.md)의 과거 결과와 분리해 기록합니다.

### 백엔드 문법 확인

```powershell
cd C:\Users\espar\SPY-capstoneREPO\api
python -m compileall -q routers services ai/moni_engine
```

### 프론트엔드 타입 체크

```powershell
cd C:\Users\espar\SPY-capstoneREPO\frontend\mobile
npx tsc --noEmit
```

### 로컬 검증 시나리오

1. DB 스키마·API 주소를 확인하고 기존 방식으로 서버와 Expo Web을 실행합니다.
2. 로그인·`GET /me`·닉네임 저장을 확인합니다.
3. 소비 CRUD와 메모 삭제, 카테고리 추천, 예산 변경을 확인합니다.
4. 주간·월간 리포트와 챌린지 생성의 계산 기준을 구분해 확인합니다.
5. 완료 표시/취소 시 XP가 변하지 않는지 확인합니다.
6. 다음 날 검증과 중복 호출 시 보상 중복 지급 여부를 테스트 DB에서 확인합니다.
7. 소셜·구매·장착·스킨 변경과 파일 가져오기를 점검하고, 알려진 연동 미완료 항목은 실패/보류로 기록합니다.

---

## 추가 문서

| 문서 | 설명 |
|---|---|
| [docs/api.md](./docs/api.md) | 현재 라우터·스키마·직렬화 기준 API 명세 |
| [docs/architecture.md](./docs/architecture.md) | 시스템 구조·처리 흐름·설계 한계 |
| [docs/test-scenario.md](./docs/test-scenario.md) | 통합 점검 절차와 미완료 확인 항목 |
| [frontend/mobile/README.md](./frontend/mobile/README.md) | 프론트 실행·화면·테마·연동 상태 |
| [api/ai/README.md](./api/ai/README.md) | ARIMA·목표 산정·LLM 모듈 명세 |
| [self_demo.md](./self_demo.md) | 시연 절차 |

---

## 팀

| 역할 | 담당 |
|------|------|
| AI / 예측 엔진 | 신희조 |
| Backend | 윤수연, 박은수 |
| Frontend (Mobile) | 박은수 |

---

## 한 줄 요약

Moni는 **소비 예측을 실천 목표로, 검증된 실천을 캐릭터 성장으로 연결하는 소비 습관 코칭 서비스**입니다. 현재 핵심 구성은 React Native·Expo, FastAPI, statsmodels ARIMA, 관계형 DB, 외부 LLM 연동입니다.

---

> 코드 근거: [api/ai/moni_engine/prediction.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/ai/moni_engine/prediction.py) · [api/routers/challenges_router.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/routers/challenges_router.py) · [api/routers/reports_router.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/routers/reports_router.py) · [api/requirements.txt](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/requirements.txt) · [frontend/mobile/components/ChallengeSettlementPopup.tsx](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/frontend/mobile/components/ChallengeSettlementPopup.tsx) · [frontend/mobile/services/transactionImportApi.ts](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/frontend/mobile/services/transactionImportApi.ts)
