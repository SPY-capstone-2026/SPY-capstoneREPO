# Moni AI Engine

소비 예측 및 데일리 챌린지 생성 엔진. 백엔드 FastAPI에서 호출하는 단일 진입점을 제공한다.

## 구조

```
ai/
├─ moni_engine/
│  ├─ __init__.py
│  ├─ preprocessing.py    # Transactions → ds, y 시계열
│  ├─ prediction.py       # 월말 예상 지출, 예산 압박도
│  ├─ challenge.py        # 챌린지 유형/난이도/문구 생성
│  └─ engine.py           # 통합 진입점 (BE 호출)
├─ notebooks/
│  └─ moni_pipeline_demo.ipynb
├─ seed_data/
│  ├─ generate_seed.py
│  ├─ seed_transactions.csv
│  ├─ seed_users.csv
│  └─ seed_category_settings.csv
├─ tests/
│  └─ test_engine.py
├─ requirements.txt
└─ README.md  ← 이 파일
```

## 백엔드 호출 방법

```python
from datetime import date
from moni_engine.engine import get_today_challenge

result = get_today_challenge(
    transactions_df=transactions_df,           # Transactions 테이블 결과 (DataFrame)
    user_profile=user_profile,                  # Users 테이블 단일 row (dict)
    category_settings_df=category_settings_df,  # User_Category_Settings 결과 (DataFrame)
    target_date=date(2026, 5, 14),              # KST 기준 date
)
```

### 반환값

정상 시 dict, 챌린지 불가 시 `None` (다음 케이스):
- `is_daily_challenge=True` 카테고리가 하나도 없음
- 모든 카테고리에 거래 데이터가 전혀 없음

### 반환 dict 구조

```python
{
    # Daily_Challenges 컬럼에 직접 INSERT
    "user_id": "user-111",
    "category_name": "카페",
    "challenge_date": "2026-05-14",
    "challenge_type": "금지형",
    "challenge_text": "오늘은 카페 지출 없이 하루를 보내보세요.",
    "difficulty": "Hard",
    "status": "PENDING",
    "xp_reward": 30,

    # ai_metadata JSON 컬럼에 저장
    "ai_metadata": {
        "schema_version": "1.0",
        "budget_limit": 30000.0,
        "predicted_monthly_spend": 70000.0,
        "month_to_date_actual": 42000.0,
        "predicted_remaining_spend": 28000.0,
        "forecast_lower": 62000.0,
        "forecast_upper": 79000.0,
        "budget_pressure": 2.3333,
        "model_used": "prophet",                  # "prophet" | "simple_average" | "no_data"
        "data_points_used": 365,
        "nonzero_ratio": 0.72,
        "month_start_date": "2026-05-01",
        "month_end_date": "2026-05-31",
        "days_remaining_in_month": 17,
        "month_progress_ratio": 0.4516,
        "category_correction_applied": true,
        "reason": "예상 월 카페 지출 70,000원이 월 예산 30,000원 대비 233.3% 수준입니다.",
        "evaluated_categories": [
            {"category_name": "카페", "budget_pressure": 2.33, "model_used": "prophet"},
            {"category_name": "식비", "budget_pressure": 1.04, "model_used": "prophet"}
        ]
    }
}
```

## 입력 데이터 스키마

### transactions_df
| 컬럼 | 사용 여부 |
|---|---|
| user_id | ✅ 필수 |
| tx_date | ✅ 필수 |
| amount | ✅ 필수 |
| final_category | ✅ 필수 |
| is_user_corrected | ⚪ 메타데이터용 (없어도 됨) |
| tx_time, merchant_name, mydata_category, tx_id | ⬜ AI 엔진은 사용 안 함 |

### user_profile (dict)
| 키 | 사용 여부 |
|---|---|
| user_id | ✅ 필수 |
| valid_data_start_date | ⚪ 있으면 그 이전 데이터 제외 |
| spend_profile, payday | ⬜ MVP 미사용 (후속 확장) |

### category_settings_df
| 컬럼 | 사용 여부 |
|---|---|
| user_id | ✅ 필수 |
| category_name | ✅ 필수 |
| budget_limit | ✅ 필수 |
| is_daily_challenge | ✅ 필수 (True만 평가 대상) |
| alert_threshold | ⬜ MVP 미사용 |

## 핵심 정책

- **월 정의**: 캘린더 월 (1일~말일). `payday` 기반은 후속 확장.
- **타임존**: `target_date`는 KST 기준 `date` 객체 권장.
- **모델 선택**:
  - `data_points >= 30 AND nonzero_ratio >= 0.15` → Prophet
  - 그 외 (sparse 카테고리, 데이터 부족) → simple_average
- **카테고리 선택 tie-breaking**: pressure desc → budget_limit asc → category_name asc
- **압박도 4구간**:
  - `< 0.8` → 유지형 / Easy / XP 12
  - `0.8 ~ 1.1` → 제한형 / Medium / XP 20
  - `1.1 ~ 1.5` → 강한 제한형 / Medium-Hard / XP 25
  - `≥ 1.5` → 금지형 / Hard / XP 30

## 실행 및 테스트

```bash
# 의존성 설치
pip install -r requirements.txt

# 시드 데이터 생성
cd seed_data && python generate_seed.py && cd ..

# 통합 테스트 실행
python tests/test_engine.py

# 데모 노트북 실행
jupyter notebook notebooks/moni_pipeline_demo.ipynb
```

## 후속 작업 (MVP 이후)

- payday 기반 월 계산
- 카테고리 로테이션 (같은 카테고리 연속 챌린지 방지)
- AI_Daily_Features 테이블 도입 (배치 + 응답 속도 최적화)
- spend_profile 기반 민감도 튜닝
- 카테고리 보정 신호 기반 정확도 개선
