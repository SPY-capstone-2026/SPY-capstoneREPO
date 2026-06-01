# Moni

> 사용자의 과거 소비 패턴을 분석해 미래 지출을 예측하고, 그 결과를 바탕으로 **오늘 바로 실천할 수 있는 개인화 지출 제한형 챌린지**를 생성하는 소비 습관 코칭 앱

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.11x-009688?logo=fastapi&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-Expo-000020?logo=expo&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-DB-4169E1?logo=postgresql&logoColor=white)
![Prophet](https://img.shields.io/badge/Forecast-Prophet-2D6CDF)

---

## 프로젝트 소개

### 해결하려는 문제

기존 가계부·소비 관리 서비스는 사용자가 **얼마를 썼는지 기록하고 통계를 보여주는 것**에는 강하지만, 실제로 **오늘 어떤 소비 행동을 해야 하는지 알려주지 못하는 경우**가 많습니다.

많은 사람들이 예산을 세우지만 실제 행동으로 이어가지 못합니다.
"카페를 너무 자주 간다", "충동구매를 줄여야 한다"는 사실은 알고 있어도, 정작 **오늘 어떻게 행동해야 할지**는 알기 어렵습니다.

기존 소비 관리 앱은 대체로 아래에 머무릅니다.

- 소비 기록
- 월간/주간 통계 제공
- 카테고리별 지출 요약

이 구조는 **쓴 뒤에 확인하는 사후 분석**에는 유용하지만, 소비하려는 순간에는 개입하지 못합니다. 그 결과 사용자는 자신의 소비 습관을 인지는 하더라도, 개선하는 것에 어려움을 겪습니다.

> 핵심 문제: 소비 습관은 월간 통계가 아니라 **오늘의 행동**으로 결정된다. 기존 앱은 기록 도구일 뿐, 행동 변화 도구가 아니다.

### 기술 솔루션

사용자의 과거 소비 패턴을 분석해 **향후 소비를 예측**하고, 예측 결과와 예산 대비 압박도를 반영해 **당일 맞춤형 챌린지**를 생성합니다. 이 엔진을 FastAPI 백엔드에 통합하고, React Native 모바일 앱에서 사용자가 직접 챌린지를 받아볼 수 있도록 구성했습니다.

### 기대 효과

사용자는 단순히 월말에 반성하는 것이 아니라, **소비 전 개입을 받고**, 작은 실천을 반복하며 최종적으로 소비 습관을 바꿀 수 있습니다.

- 월말 통계를 기다리지 않고 **오늘 바로 행동할 수 있는 목표**를 받습니다.
- 예산 압박도에 따라 다른 수준의 챌린지를 받아 **개인화된 개입**을 경험합니다.
- 챌린지와 XP 구조를 통해 **지속적인 실천 동기**를 얻습니다.
- 향후 주간 리포트, 캐릭터 성장, 소셜 기능과 연결하면 더 확장성 있는 행동 변화 서비스로 발전할 수 있습니다.

---

## 기존 서비스와의 차이

| 구분 | 토스 / 뱅크샐러드 | Moni |
|------|------------------|------|
| 데이터 방식 | 쓴 돈을 기록하고 보여줌 | 쓸 돈을 예측하고 미리 개입 |
| 개입 시점 | 이미 쓴 후 (후행적) | 쓰기 전 (선제적) |
| 동기부여 | 통계 및 그래프 제공 | 캐릭터 + 데일리 챌린지 |
| 개인화 | 전체 소비 분석 | 선택한 카테고리 집중 |
| 행동 제안 | 없음 | 오늘 바로 실천할 챌린지 제시 |

---

## 시스템 아키텍처

<img width="3200" height="1800" alt="Moni_아키텍처_흰배경" src="https://github.com/user-attachments/assets/7b4967b5-f6aa-4418-bd14-c7ae835de296" />
요청 흐름: Android 앱 → API 요청 → Railway URL → FastAPI → Prophet 엔진 → DB → 결과 반환 → Android 앱

### 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React Native (Expo), TypeScript |
| Backend | FastAPI, SQLAlchemy, JWT 인증 |
| Database | PostgreSQL |
| AI / 예측 | Prophet, pandas, numpy, scikit-learn |
| 배포 | Railway (백엔드), Vercel (랜딩 페이지) |

---

## 핵심 기능

1. **소비 예측** — 과거 소비 패턴으로 향후 카테고리별 지출을 예측합니다. ("이 페이스면 카페에 8만원 쓸 것 같아요")
2. **데일리 챌린지** — 예산 압박도, 어제 소비, 무지출 streak를 반영해 하루 최대 4개의 챌린지를 자동 생성합니다.
3. **캐릭터 성장 (예정)** — 챌린지 달성 시 XP 획득 및 레벨업.
4. **주간 소비 리포트 (예정)** — 한 주간 소비 패턴과 챌린지 달성률 분석.

---

## AI 엔진: 예측 기반 챌린지 생성

MVP의 핵심은 **예측 기반 소비 코칭 엔진**입니다. AI 엔진은 4개 모듈로 분리되어 백엔드에서 단일 진입점으로 호출됩니다.

### 입력 (Backend → AI)

- 일별 소비 금액, 날짜, 카테고리 (Transactions)
- 카테고리별 월 예산, 챌린지 대상 여부 (User_Category_Settings)
- 사용자 정보 (Users)

### 출력 (AI → Backend)

- `projected_30d_total` — 향후 30일 예측 총 소비액
- `budget_pressure` — 예산 대비 압박도 (예: 1.20 = 예산의 120%)
- `challenge_type` — 금지형 / 강한 제한형 / 제한형 / streak형 / 유지형
- `challenge_text` — 오늘의 챌린지 문구
- `reward_xp` — 달성 보상 XP
- `reasons` — 챌린지 생성 이유 목록
- forecast metrics — MAE / RMSE / MAPE

### 압박도 구간별 챌린지

| 압박도 | 유형 | 난이도 | XP |
|--------|------|--------|-----|
| < 0.8 | 유지형 | Easy | 12 |
| 0.8 ~ 1.1 | 제한형 | Medium | 20 |
| 1.1 ~ 1.5 | 강한 제한형 | Medium-Hard | 25 |
| ≥ 1.5 | 금지형 | Hard | 30 |

여기에 무지출 streak가 2일 이상 이어진 자주 쓰는 카테고리에는 **streak 보너스 챌린지**가 추가로 생성됩니다.

### 대표 예시

```text
[압박도 높음] 카페 │ 금지형 │ Hard │ XP 30
오늘은 카페 지출 없이 하루를 보내보세요.
압박도 2.02 (예상 202,452원 / 예산 100,000원)

[압박도 중간] 식비 │ 제한형 │ Medium │ XP 20
오늘 식비 5,000원 이하로 유지하기

[streak] 카페 무지출 4일 연속 중! │ Special │ XP 35
오늘도 이어가서 5일째 달성해볼까요?
```

---

## 현재 구현 현황

### ✅ 완료

- **AI 엔진** — preprocessing / prediction / challenge / engine 4개 모듈 분리, 통합 테스트 8종 통과
- **백엔드** — FastAPI 구조 완성 (회원가입 / 로그인 / JWT 토큰 인증)
- **AI–백엔드 연동** — Prophet 엔진을 백엔드에 통합, 챌린지 자동 생성 동작
- **데이터베이스** — PostgreSQL 연결
- **프론트엔드 UI** — React Native(Expo) 모바일 앱 화면 구현 (홈 / 챌린지 / 리포트 / 마이페이지 / 거래내역 / 로그인·회원가입)
- **재현 가능한 합성 소비 데이터** — 직장인 패턴 시드 데이터 생성기

### 🔄 진행 중

- **백엔드 클라우드 배포** — Railway 배포 마무리 단계 (완료 시 HTTPS URL 발급)
- **프론트–백엔드 연동** — 현재 프론트는 mock 데이터로 동작, 배포 URL 연결 예정

### 📋 예정

- 카테고리별 예측 모델 분리, Prophet / ARIMA / LSTM 비교 실험
- 캐릭터 성장 시스템, 주간 리포트 연동
- 챌린지 텍스트 다양화

---

## 저장소 구조

```text
SPY-capstoneREPO/
├─ README.md
├─ Procfile                      # 배포 설정
├─ .gitignore
│
├─ api/                          # 백엔드 (FastAPI)
│  ├─ main.py                    # API 진입점
│  ├─ auth.py                    # 회원가입 / 로그인 / JWT
│  ├─ models.py                  # DB 모델
│  ├─ seed_db.py                 # 시드 데이터 주입
│  ├─ requirements.txt
│  └─ ai/                        # AI 엔진
│     ├─ moni_engine/
│     │  ├─ preprocessing.py     # 거래 → 일 단위 시계열 + streak
│     │  ├─ prediction.py        # 월말 예상 지출 + 예산 압박도
│     │  ├─ challenge.py         # 챌린지 유형 / 난이도 / 문구 / XP
│     │  └─ engine.py            # 백엔드 호출용 단일 진입점
│     ├─ seed_data/              # 합성 소비 데이터 + 생성기
│     ├─ tests/                  # 통합 테스트 8종
│     ├─ notebooks/              # 시연용 데모 노트북
│     ├─ moni_pipeline.ipynb     # 전체 파이프라인 노트북
│     ├─ requirements.txt
│     └─ README.md               # AI–백엔드 연동 명세
│
├─ frontend/                     # 프론트엔드
│  ├─ index.html                 # 랜딩 페이지
│  └─ mobile/                    # React Native (Expo) 앱
│     ├─ app/                    # 화면 (tabs, auth)
│     ├─ components/             # 공용 컴포넌트
│     ├─ constants/              # 테마 / mock 데이터
│     └─ ...
│
└─ docs/                         # 기획 문서
   ├─ PMF.md
   ├─ Team_Ground_Rule.md
   └─ elevator_speech.md
```

---

## 실행 방법

### 1. AI 엔진 단독 실행 / 테스트

```bash
cd api/ai
pip install -r requirements.txt
python tests/test_engine.py        # 통합 테스트 8종
```

전체 파이프라인을 한 번에 보고 싶다면 `api/ai/moni_pipeline.ipynb`를 Colab/Jupyter에서 열고 상단 설정 셀의 `PROFILE`과 `SEED`를 지정한 뒤 전체 셀을 실행합니다.

```python
PROFILE = "balanced"   # "careful" / "balanced" / "overspend" / "custom"
SEED = None            # None: 매번 다른 결과 / 정수: 재현 가능
```

### 2. 백엔드 실행

```bash
cd api
pip install -r requirements.txt
python seed_db.py                  # 시드 데이터 주입
uvicorn main:app --reload          # http://localhost:8000
```

API 문서는 실행 후 `http://localhost:8000/docs`에서 확인할 수 있습니다.

### 3. 프론트엔드 (모바일 앱) 실행

```bash
cd frontend/mobile
npm install
npx expo start
```

---

## 팀

| 역할 | 담당 |
|------|------|
| AI / 예측 엔진 | 신희조 |
| Backend | 윤수연 |
| Frontend (Mobile) | 박은수 |

---

## 한 줄 요약

이 저장소는 **과거 소비 패턴을 예측하고, 그 결과를 오늘의 맞춤형 소비 챌린지로 연결하는 소비 습관 코칭 앱**의 풀스택 구현(React Native + FastAPI + Prophet + PostgreSQL)을 담고 있습니다.
