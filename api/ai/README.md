# Moni AI Engine (v0.2)

소비 예측 및 데일리 챌린지 생성 엔진. 백엔드 FastAPI에서 호출하는 단일 진입점을 제공한다.

## v0.2 변경점 (BE 연동 시 주의)

- **반환 형태가 단건 dict → list[dict]로 변경됨** (가장 중요)
- 챌린지가 하루 최대 4개 생성됨: 압박도 상위 3개 + streak 보너스 1개
- `streak형` 챌린지 추가 (무지출 연속 시 보너스)
- BE 직장인 더미데이터(`user-office-001`) 적용
- 카테고리: 카페 / 식비 / 의류 / 화장품 / 가전

## 구조

```
ai/
├─ moni_engine/
│  ├─ __init__.py
│  ├─ preprocessing.py    # Transactions → ds, y 시계열 + streak 계산
│  ├─ prediction.py       # 월말 예상 지출, 예산 압박도
│  ├─ challenge.py        # 압박도 챌린지 + streak 챌린지 생성
│  └─ engine.py           # 통합 진입점 (BE 호출)
├─ notebooks/
│  └─ moni_pipeline_demo.ipynb
├─ seed_data/
│  ├─ generate_seed.py             # BE 직장인 패턴 + AI 테스트용 시드
│  ├─ seed_transactions.csv
│  ├─ seed_users.csv
│  └─ seed_category_settings.csv
├─ tests/
│  └─ test_engine.py
├─ requirements.txt
└─ README.md
```

## 백엔드 호출 방법

```python
from datetime import date
from moni_engine.engine import get_today_challenges  # 주의: 복수형

results = get_today_challenges(
    transactions_df=transactions_df,           # Transactions 테이블 결과 (DataFrame)
    user_profile=user_profile,                  # Users 테이블 단일 row (dict)
    category_settings_df=category_settings_df,  # User_Category_Settings 결과 (DataFrame)
    target_date=date(2025, 11, 15),             # KST 기준 date
)

# results는 list (0~4개). 비어있으면 챌린지 없음.
for challenge in results:
    daily_row = {k: v for k, v in challenge.items() if k != "ai_metadata"}
    ai_metadata = challenge["ai_metadata"]
    # INSERT INTO Daily_Challenges (...) VALUES (...) + ai_metadata 컬럼에 JSON 저장
```

### 반환값

`list[dict]`. 각 dict는 `Daily_Challenges` row 하나. 다음 경우 **빈 리스트** `[]`:
- `is_daily_challenge=True` 카테고리가 하나도 없음
- 모든 카테고리에 거래 데이터가 전혀 없음

### 챌린지 구성 (C안)

```text
압박도 상위 3개 카테고리 → 압박도 챌린지 각 1개 (최대 3개)
+ streak 자격 카테고리 중 streak 가장 긴 1개 → 보너스 챌린지 1개
= 하루 최대 4개
```

### 각 챌린지 dict 구조

```python
{
    # Daily_Challenges 컬럼에 직접 INSERT
    "user_id": "user-office-001",
    "category_name": "카페",
    "challenge_date": "2025-11-15",
    "challenge_type": "금지형",        # 유지형 | 제한형 | 강한 제한형 | 금지형 | streak형
    "challenge_text": "오늘은 카페 지출 없이 하루를 보내보세요.",
    "difficulty": "Hard",              # Easy | Medium | Medium-Hard | Hard | Special
    "status": "PENDING",
    "xp_reward": 30,

    # ai_metadata JSON 컬럼에 저장
    "ai_metadata": {
        "schema_version": "1.1",
        "challenge_origin": "pressure",  # "pressure" | "streak"
        "budget_limit": 100000.0,
        "predicted_monthly_spend": 202452.0,
        "month_to_date_actual": 95000.0,
        "predicted_remaining_spend": 107452.0,
        "forecast_lower": 180000.0,
        "forecast_upper": 230000.0,
        "budget_pressure": 2.0245,
        "model_used": "prophet",          # prophet | simple_average | no_data
        "data_points_used": 178,
        "nonzero_ratio": 0.8933,
        "no_spend_streak": 0,
        "month_start_date": "2025-11-01",
        "month_end_date": "2025-11-30",
        "days_remaining_in_month": 15,
        "month_progress_ratio": 0.5,
        "category_correction_applied": true,
        "reason": "예상 월 카페 지출 202,452원이 월 예산 100,000원 대비 202.5% 수준입니다.",
        "evaluated_categories": [        # 첫 챌린지에만 첨부 (후보 비교용)
            {"category_name": "카페", "budget_pressure": 2.02, "no_spend_streak": 0, "model_used": "prophet"},
            {"category_name": "식비", "budget_pressure": 1.43, "no_spend_streak": 0, "model_used": "prophet"}
        ]
    }
}
```

streak 챌린지의 `ai_metadata`는 더 가볍다:

```python
{
    "schema_version": "1.1",
    "challenge_origin": "streak",
    "no_spend_streak": 4,
    "nonzero_ratio": 0.89,
    "model_used": "prophet",
    "reason": "카페 4일 연속 무지출을 이어가는 중입니다. ..."
}
```

## 입력 데이터 스키마

### transactions_df
| 컬럼 | 사용 여부 |
|---|---|
| user_id | 필수 |
| tx_date | 필수 |
| amount | 필수 |
| final_category | 필수 |
| is_user_corrected | 메타데이터용 (없어도 됨) |
| tx_time, merchant_name, mydata_category, tx_id | AI 엔진은 사용 안 함 |

`final_category` 값과 `category_settings_df`의 `category_name` 값은 **정확히 같은 문자열**이어야 한다.
(예: 둘 다 "카페". 한쪽이 "카페", 다른 쪽이 "CAFE"면 매칭 실패)

### user_profile (dict)
| 키 | 사용 여부 |
|---|---|
| user_id | 필수 |
| valid_data_start_date | 있으면 그 이전 데이터 제외 |
| spend_profile, payday | MVP 미사용 (후속 확장) |

### category_settings_df
| 컬럼 | 사용 여부 |
|---|---|
| user_id | 필수 |
| category_name | 필수 |
| budget_limit | 필수 |
| is_daily_challenge | 필수 (True만 평가 대상) |
| alert_threshold | MVP 미사용 |

## 핵심 정책

- **월 정의**: 캘린더 월 (1일~말일). payday 기반은 후속 확장.
- **타임존**: `target_date`는 KST 기준 `date` 객체 권장.
- **모델 선택**: `data_points >= 30 AND nonzero_ratio >= 0.15` → Prophet, 그 외 → simple_average
- **카테고리 선택 tie-breaking**: pressure desc → budget_limit asc → category_name asc
- **압박도 4구간**:
  - `< 0.8` → 유지형 / Easy / XP 12
  - `0.8 ~ 1.1` → 제한형 / Medium / XP 20
  - `1.1 ~ 1.5` → 강한 제한형 / Medium-Hard / XP 25
  - `≥ 1.5` → 금지형 / Hard / XP 30
- **streak 보너스** (challenge.py 상수로 튜닝 가능):
  - 발동 조건: 연속 무지출 `>= 2일` AND 평소 자주 쓰는 카테고리(`nonzero_ratio >= 0.4`)
  - XP: `15 + streak일수 * 5` (상한 60)
  - 하루 최대 1개 (C안)

## 실행 및 테스트

```bash
pip install -r requirements.txt

# 시드 데이터 생성
cd seed_data && python generate_seed.py && cd ..

# 통합 테스트 (8종)
python tests/test_engine.py

# 데모 노트북
jupyter notebook notebooks/moni_pipeline_demo.ipynb
```

## 알려진 특성 / 후속 논의

- **sparse 카테고리(의류/화장품/가전)**: 월급날에만 가끔 발생. 해당 월에 거래가 없으면 예측이 0원으로 나옴 (정상 동작). 이들 카테고리에 챌린지를 줄지, budget을 어떻게 잡을지는 팀 논의 필요.
- **streak 발동 빈도**: 직장인 데이터는 카페를 거의 매일 마셔서 streak이 잘 안 생긴다. streak 발동 조건(`STREAK_MIN_DAYS`, `STREAK_MIN_NONZERO_RATIO`)은 challenge.py 상수로 조정 가능.
- **챌린지 텍스트 다양화**: 현재 유형별 단일 템플릿. 같은 유형 반복 시 지루할 수 있어 템플릿 풀 추가 검토 중.

## 후속 작업 (MVP 이후)

- payday 기반 월 계산
- 카테고리 로테이션 (같은 카테고리 연속 챌린지 방지)
- AI_Daily_Features 테이블 도입 (배치 + 응답 속도 최적화)
- spend_profile 기반 민감도 튜닝
- 챌린지 텍스트 템플릿 다양화
