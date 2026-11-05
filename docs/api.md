# Moni API 문서

Moni의 Expo Web·모바일·외부 클라이언트 연동을 위한 API 명세입니다. 라우터, 입력 스키마, 응답 직렬화 코드를 기준으로 작성했습니다. 아래 JSON의 ID·날짜·금액은 설명용 예시이며 실제 테스트 결과가 아닙니다.

## Base URL

### 로컬 개발 서버

```text
http://localhost:8000
```

### 배포 서버

저장소 프론트 배포 설정에 기재된 주소입니다. 실제 가동·배포 버전은 별도로 확인합니다.

```text
https://spy-capstonerepo.onrender.com
```

## 인증 방식

회원가입·로그인·루트 상태 확인을 제외한 사용자 API는 JWT Bearer 토큰을 요구합니다.

```http
Authorization: Bearer {access_token}
```

`POST /login`에서 토큰을 받습니다. 내부 정산 API는 사용자 JWT가 아니라 `X-Cron-Secret`을 사용합니다. `CRON_SECRET`을 프론트에 저장하거나 공개하지 않습니다.

## 공통 응답 형식

대부분은 `status`와 `data`를 사용하지만 로그인, 회원가입, `GET /me` 등은 구조가 다릅니다. 각 엔드포인트 예시가 우선합니다.

```json
{"status":"success","data":{}}
```

```json
{"status":"success","count":0,"data":[]}
```

일반 오류는 `{"detail":"..."}`이며, 입력 스키마 검증 오류(422)의 `detail`은 배열일 수 있습니다. 500은 서버 로그와 DB 상태를 확인해야 하며, 브라우저에 CORS 문구가 함께 표시될 수도 있습니다.

| 코드 | 대표 의미 |
|---|---|
| 400 | 업무 규칙 위반, 미지원 파일, 분류 실패, 잘못된 날짜 범위 |
| 401 | 토큰/로그인/내부 정산 인증 실패 |
| 403 | 다른 사용자 소유 데이터의 수정·삭제 시도 |
| 404 | 대상 리소스 또는 경로 없음 |
| 409 | 중복 닉네임·요청, 확정 상태 변경, 동시 파일 등록 충돌 등 |
| 422 | 요청 형식·필수 필드·타입 검증 실패 |
| 500 | 예기치 않은 서버 예외; UI의 네트워크 메시지만으로 원인 확정 불가 |

---

# 1. 회원가입

## `POST /signup`

계정과 기본 카테고리 설정을 생성합니다.

### 인증

필요 없음.

### Request

```json
{
  "email": "user@example.com",
  "password": "example-password",
  "nickname": "모니테스트",
  "income_type": "STUDENT",
  "payday": 25,
  "spend_profile": "IMPULSIVE"
}
```

### Request Fields

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| email | string | 필수 | 이메일 |
| password | string | 필수 | 비밀번호; 실제 비밀값을 문서에 넣지 않음 |
| nickname | string 또는 null | 선택 | 2~12자 규칙·중복 검사; 생략 가능 |
| income_type | string | 선택 | 기본 STUDENT |
| payday | integer | 선택 | 기본 25; 1~31 |
| spend_profile | string | 선택 | 기본 IMPULSIVE |

### Response Example

```json
{
  "status": "success",
  "user_id": "demo-user"
}
```

### Notes

응답은 로그인 토큰이 아닙니다. 현재 프론트 회원가입 화면에는 닉네임 입력이 없고 마이페이지에서 설정합니다. 기존 DB에 모델의 `nickname` 컬럼이 없으면 사용자 조회 단계부터 실패할 수 있습니다.

---

# 2. 로그인

## `POST /login`

JSON으로 이메일·비밀번호를 보내 토큰을 발급받습니다.

### 인증

필요 없음.

### Request

```json
{
  "email": "user@example.com",
  "password": "example-password"
}
```

### Response Example

```json
{
  "access_token": "<access_token>",
  "token_type": "bearer"
}
```

### Notes

잘못된 계정 정보는 401입니다. 로그인 뒤 프론트는 `/me`도 조회하므로 두 요청의 결과를 분리해서 확인합니다.

---

# 3. 내 정보 조회

## `GET /me`

현재 사용자 프로필·성장 상태를 반환합니다.

### 인증

필요.

### Response Example

```json
{
  "user_id": "demo-user",
  "email": "user@example.com",
  "nickname": "모니테스트",
  "income_type": "STUDENT",
  "payday": 25,
  "spend_profile": "IMPULSIVE",
  "total_xp": 20,
  "current_level": 1,
  "current_points": 0,
  "created_at": "2026-11-01T10:00:00"
}
```

### Notes

`GET /me`는 `data` 래퍼 없이 프로필을 바로 반환합니다. 현재 serializer는 `valid_data_start_date`를 프로필 응답에 넣지 않습니다.

---

# 4. 내 정보 수정

## `PATCH /me`

프로필과 닉네임을 수정합니다.

### 인증

필요.

### Request

```json
{
  "nickname": "새모니",
  "email": "new@example.com",
  "income_type": "EMPLOYEE",
  "payday": 10,
  "spend_profile": "STEADY"
}
```

### Request Fields

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| nickname | string | 선택 | 정규화·길이/문자·중복 검사; 단순 빈 문자열 삭제 기능 아님 |
| email | string | 선택 | 비어 있지 않아야 하며 중복 검사 |
| income_type | string | 선택 | 수입 유형 |
| payday | integer | 선택 | 1~31 |
| spend_profile | string | 선택 | 소비 성향 |

### Response Example

```json
{
  "status": "success",
  "data": {
    "user_id": "demo-user",
    "email": "new@example.com",
    "nickname": "새모니",
    "income_type": "EMPLOYEE",
    "payday": 10,
    "spend_profile": "STEADY",
    "total_xp": 20,
    "current_level": 1,
    "current_points": 0,
    "created_at": "2026-11-01T10:00:00"
  }
}
```

### Notes

닉네임은 공개 프로필과 친구 검색에 사용됩니다. 중복 닉네임/이메일은 409로 처리합니다.

---

# 5. 지출 목록 조회

## `GET /transactions`

현재 사용자 거래를 날짜·시간 내림차순으로 반환합니다.

### 인증

필요.

### Response Example

```json
{
  "status": "success",
  "count": 1,
  "data": [
    {
      "tx_id": "demo-tx-001",
      "user_id": "demo-user",
      "tx_date": "2026-11-05",
      "tx_time": "14:30",
      "amount": 5800,
      "merchant_name": "테스트카페",
      "mydata_category": "직접 입력",
      "final_category": "카페",
      "is_user_corrected": true,
      "memo": "친구와 만남",
      "is_imported": false
    }
  ]
}
```

### Notes

`tx_date`는 YYYY-MM-DD, 응답 `tx_time`은 HH:MM 또는 null입니다. `memo`는 문자열 또는 null이며 `is_imported`는 파일 가져오기 키가 있으면 true입니다. 원본 가져오기 키는 일반 거래 응답에 노출하지 않습니다.

---

# 6. 지출 추가

## `POST /transactions`

지출을 저장하고 영향을 받는 리포트 캐시를 무효화합니다.

### 인증

필요.

### Request

```json
{
  "tx_date": "2026-11-05",
  "tx_time": "14:30",
  "amount": 5800,
  "merchant_name": "테스트카페",
  "final_category": "카페",
  "memo": "친구와 만남"
}
```

### Request Fields

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| tx_date | date | 필수 | YYYY-MM-DD |
| tx_time | time 또는 null | 선택 | 생략하면 서버에서 시각 보완 |
| amount | integer | 필수 | 원 단위 지출액; 화면에서는 양수로 입력 |
| merchant_name | string | 필수 | 결제처 |
| mydata_category | string | 선택 | 기본 직접 입력 |
| final_category | string 또는 null | 선택 | 생략/null/빈 값이면 거래처로 자동 분류 |
| is_user_corrected | boolean | 선택 | 기본 true; 자동 분류 저장은 false |
| memo | string 또는 null | 선택 | 공백 정리 후 최대 200자 |

### Response Example

```json
{
  "status": "success",
  "data": {
    "tx_id": "demo-tx-001",
    "user_id": "demo-user",
    "tx_date": "2026-11-05",
    "tx_time": "14:30",
    "amount": 5800,
    "merchant_name": "테스트카페",
    "mydata_category": "직접 입력",
    "final_category": "카페",
    "is_user_corrected": true,
    "memo": "친구와 만남",
    "is_imported": false
  }
}
```

### Notes

자동 추천이 없으면 400이며 사용자가 직접 카테고리를 선택해야 합니다. 사용자에게 없는 카테고리도 400입니다. 추천은 사용자별 저장 규칙·거래처 키워드 기반이며 AI 시계열 예측과 다른 기능입니다.

---

# 7. 지출 수정

## `PATCH /transactions/{tx_id}`

본인 거래의 선택 필드를 수정합니다.

### 인증

필요.

### Request

```json
{
  "tx_date": "2026-11-04",
  "amount": 7000,
  "merchant_name": "메가커피",
  "final_category": "카페",
  "is_user_corrected": true,
  "memo": ""
}
```

### Request Fields

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| tx_date | date | 선택 | 변경 전후 날짜의 리포트 캐시 무효화 |
| tx_time | time | 선택 | 시간 수정 |
| amount | integer | 선택 | 금액 수정 |
| merchant_name | string | 선택 | 거래처 수정 |
| mydata_category | string | 선택 | 원본 분류 |
| final_category | string | 선택 | 변경 시 사용자 보유 카테고리 검사 |
| is_user_corrected | boolean | 선택 | 사용자 보정 여부 |
| memo | string 또는 null | 선택 | 빈 문자열은 삭제; 생략/null은 변경하지 않음 |

### Response Example

```json
{
  "status": "success",
  "data": {
    "tx_id": "demo-tx-001",
    "user_id": "demo-user",
    "tx_date": "2026-11-04",
    "tx_time": "14:30",
    "amount": 7000,
    "merchant_name": "메가커피",
    "mydata_category": "직접 입력",
    "final_category": "카페",
    "is_user_corrected": true,
    "memo": null,
    "is_imported": false
  }
}
```

### Notes

`POST`의 자동 분류와 달리 `PATCH`에서 빈 카테고리를 보내 자동 분류를 요청한다고 가정하지 않습니다. 소유권 위반 403, 없는 거래 404입니다.

---

# 8. 지출 삭제

## `DELETE /transactions/{tx_id}`

본인 거래를 삭제하고 관련 기간 리포트 캐시를 무효화합니다.

### 인증

필요.

### Response Example

```json
{
  "status": "success",
  "deleted_id": "demo-tx-001"
}
```

### Notes

이미 확정된 챌린지의 성공/보상은 거래 삭제만으로 자동 재판정하거나 회수하지 않습니다.

---

# 9. 카테고리 예산 조회

## `GET /categories`

카테고리별 예산을 반환하며, 설정이 없으면 기본 설정을 보완합니다.

### 인증

필요.

### Response Example

```json
{
  "status": "success",
  "count": 1,
  "data": [
    {
      "id": "demo-category",
      "user_id": "demo-user",
      "category_name": "카페",
      "budget_limit": 30000,
      "is_daily_challenge": true,
      "alert_threshold": 80
    }
  ]
}
```

### Notes

카테고리 목록은 이 응답을 사용합니다. `alert_threshold=80`은 80%이며 0.8이 아닙니다. 응답의 `count`는 실제 항목 수와 같습니다.

---

# 10. 카테고리 예산 수정

## `PATCH /categories/{category_id}`

월 예산·알림 기준·챌린지 대상 여부를 수정합니다.

### 인증

필요.

### Request

```json
{
  "budget_limit": 50000,
  "alert_threshold": 80,
  "is_daily_challenge": true
}
```

### Request Fields

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| budget_limit | integer | 선택 | 0 이상 |
| alert_threshold | integer | 선택 | 1~100의 퍼센트 |
| is_daily_challenge | boolean | 선택 | 챌린지 후보 여부 |

### Response Example

```json
{
  "status": "success",
  "data": {
    "id": "demo-category",
    "user_id": "demo-user",
    "category_name": "카페",
    "budget_limit": 50000,
    "is_daily_challenge": true,
    "alert_threshold": 80
  },
  "challenge_refresh_scheduled": true
}
```

### Notes

실제 예산 변경 시 이력을 저장합니다. 예산이 증가하고 챌린지 대상인 경우 오늘의 `PENDING` 챌린지 재생성을 예약합니다. 완료 대기·확정 항목의 즉시 재작성이나 즉시 생성 완료를 의미하지 않습니다. 현 프론트의 0% 허용 검사는 서버의 최소 1% 조건과 불일치합니다.

---

# 11. 월간 리포트 조회

## `GET /reports/monthly`

조회 월의 소비·예산·챌린지 성과와 총평을 반환합니다.

### 인증

필요.

### Query Parameters

| 이름 | 타입 | 설명 |
| --- | --- | --- |
| target_date | date, 선택 | 기본 서버 오늘; 조회할 달에 속한 날짜, 미래 월은 400 |

### Response Example

```json
{
  "status": "success",
  "data": {
    "month": "2026-11",
    "is_current_month": true,
    "monthly_summary": {
      "total_spend": 50000,
      "budget_limit": 300000,
      "predicted_monthly_spend": 300000,
      "budget_pressure": 1.0,
      "transaction_count": 5,
      "xp_earned": 20,
      "challenges_total": 3,
      "challenges_completed": 1
    },
    "weekly_trend": [],
    "weekly_breakdown": [],
    "evaluated_categories": [],
    "category_overrun": [],
    "budget_changes": [],
    "comment": "이번 달 소비와 예산을 점검해 보세요.",
    "comment_source": "llm"
  }
}
```

### Notes

배열은 이 예시에서 생략했습니다. 월말 전망은 `calculate_projected_amount`의 지출 속도 기반 계산이며 챌린지 ARIMA 예측값이 아닙니다. 종료 월은 실제 총합을 반환하고 종료 기간은 캐시 우선입니다. `comment_source`의 실제 값은 총평 생성 결과를 그대로 사용하며 해당 예시의 문자열을 클라이언트의 유일한 허용값으로 제한하지 않습니다.

---

# 12. 오늘의 챌린지 조회

## `GET /challenges/today`

KST 오늘의 저장된 챌린지를 조회합니다.

### 인증

필요.

### Response Example

```json
{
  "status": "success",
  "count": 1,
  "data": [
    {
      "challenge_id": 10,
      "user_id": "demo-user",
      "category_name": "카페",
      "challenge_date": "2026-11-05",
      "challenge_type": "제한형",
      "challenge_text": "오늘은 카페 지출을 3500원 이하로 유지해보세요.",
      "difficulty": "Medium",
      "status": "PENDING",
      "xp_reward": 20,
      "ai_metadata": {
        "schema_version": "1.2",
        "challenge_origin": "pressure",
        "budget_limit": 150000,
        "predicted_monthly_spend": 150000,
        "predicted_today": 5000,
        "month_to_date_actual": 25000,
        "predicted_remaining_spend": 125000,
        "budget_pressure": 1.0,
        "daily_limit": 3500,
        "pressure_reduction": 0.7,
        "budget_reduction": 1.0,
        "final_reduction": 0.7,
        "limit_source": "normal",
        "model_used": "arima",
        "data_points_used": 120,
        "nonzero_ratio": 0.5,
        "text_source": "rule_fallback"
      },
      "reward_snapshot": null,
      "completed_at": null,
      "verification_result": null
    }
  ]
}
```

### Notes

조회 전에 밀린 검증을 보정합니다. 조회 자체가 오늘의 새 챌린지를 반드시 생성하지는 않으며, 현재 프론트는 빈 목록일 때 생성 API를 호출합니다. `reward_snapshot`, `verification_result`, `completed_at`은 확정 전 null일 수 있습니다.

---

# 13. 오늘의 챌린지 생성

## `POST /challenges/generate`

현재 사용자·KST 날짜의 챌린지를 생성하거나 기존 결과를 재사용합니다.

### 인증

필요.

### Response Example

```json
{
  "status": "success",
  "count": 1,
  "data": [
    {
      "challenge_id": 10,
      "user_id": "demo-user",
      "category_name": "카페",
      "challenge_date": "2026-11-05",
      "challenge_type": "제한형",
      "challenge_text": "오늘은 카페 지출을 3500원 이하로 유지해보세요.",
      "difficulty": "Medium",
      "status": "PENDING",
      "xp_reward": 20,
      "ai_metadata": {
        "schema_version": "1.2",
        "challenge_origin": "pressure",
        "budget_limit": 150000,
        "predicted_monthly_spend": 150000,
        "predicted_today": 5000,
        "month_to_date_actual": 25000,
        "predicted_remaining_spend": 125000,
        "budget_pressure": 1.0,
        "daily_limit": 3500,
        "pressure_reduction": 0.7,
        "budget_reduction": 1.0,
        "final_reduction": 0.7,
        "limit_source": "normal",
        "model_used": "arima",
        "data_points_used": 120,
        "nonzero_ratio": 0.5,
        "text_source": "rule_fallback"
      },
      "reward_snapshot": null,
      "completed_at": null,
      "verification_result": null
    }
  ]
}
```

### Notes

요청 body는 없습니다. 정상 엔진은 최대 4개를 반환하며 결과 없음·엔진 오류 시 서버 기본 챌린지가 사용될 수 있습니다. 같은 날짜의 기존 결과가 있으면 재사용하므로 거래를 추가한 뒤 호출했다고 새 예측으로 갱신된다고 가정하지 않습니다. ARIMA 선택과 평균 대체 조건은 AI README를 참고합니다.

---

# 14. 챌린지 상태 수정

## `PATCH /challenges/{challenge_id}/status`

당일 챌린지의 완료 표시·표시 취소·포기를 처리합니다.

### 인증

필요.

### Request

```json
{
  "status": "SUCCESS"
}
```

### Request Fields

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| status | string | 필수 | PENDING, VERIFYING, SUCCESS, FAILED 중 하나; SUCCESS는 완료 대기 요청으로 해석 |

### Response Example

```json
{
  "status": "success",
  "data": {
    "challenge": {
      "challenge_id": 10,
      "user_id": "demo-user",
      "category_name": "카페",
      "challenge_date": "2026-11-05",
      "challenge_type": "제한형",
      "challenge_text": "오늘은 카페 지출을 3500원 이하로 유지해보세요.",
      "difficulty": "Medium",
      "status": "VERIFYING",
      "xp_reward": 20,
      "ai_metadata": {
        "schema_version": "1.2",
        "challenge_origin": "pressure",
        "budget_limit": 150000,
        "predicted_monthly_spend": 150000,
        "predicted_today": 5000,
        "month_to_date_actual": 25000,
        "predicted_remaining_spend": 125000,
        "budget_pressure": 1.0,
        "daily_limit": 3500,
        "pressure_reduction": 0.7,
        "budget_reduction": 1.0,
        "final_reduction": 0.7,
        "limit_source": "normal",
        "model_used": "arima",
        "data_points_used": 120,
        "nonzero_ratio": 0.5,
        "text_source": "rule_fallback"
      },
      "reward_snapshot": null,
      "completed_at": null,
      "verification_result": null
    },
    "user_progress": {
      "user_id": "demo-user",
      "total_xp": 20,
      "current_level": 1,
      "current_points": 0
    },
    "level_result": null,
    "reversal_result": null
  }
}
```

### Notes

`SUCCESS` 또는 `VERIFYING` 요청은 `VERIFYING`으로 저장되며 즉시 보상은 없습니다. 취소는 `{"status":"PENDING"}`입니다. `FAILED`는 포기 요청입니다. 변경은 당일에 한하며 최종 확정 항목은 일반적으로 수정할 수 없습니다(409); 동일 최종 상태의 재요청에 대한 멱등 처리와 구분합니다. 검증 성공으로만 XP를 지급하고 포인트는 레벨업 시 지급합니다.

---

# 15. 주간 리포트 조회

## `GET /reports/weekly`

월요일부터 일요일까지의 주간 소비와 지난주 대비 변화를 반환합니다.

### 인증

필요.

### Query Parameters

| 이름 | 타입 | 설명 |
| --- | --- | --- |
| target_date | date, 선택 | 조회 주에 속한 날짜; 기본 서버 오늘 |

### Response Example

```json
{
  "status": "success",
  "data": {
    "week_start": "2026-11-02",
    "week_end": "2026-11-08",
    "weekly_summary": {
      "total_spend": 30000,
      "last_week_total_spend": 40000,
      "change_amount": -10000,
      "change_percent": -25.0,
      "transaction_count": 3,
      "xp_earned": 20,
      "challenges_total": 3,
      "challenges_completed": 1
    },
    "daily_trend": [],
    "category_comparison": [],
    "budget_changes": [],
    "comment": "지난주보다 지출이 줄었습니다.",
    "comment_source": "llm"
  }
}
```

### Notes

종료된 주는 캐시 우선, 진행 중인 주는 현재 데이터로 계산합니다. LLM 총평과 통계 계산은 분리되어 있습니다. `comment_source`는 서버 반환값 그대로 처리합니다.

---

# 16. 예산 변경 이력

## `GET /categories/budget-history`

사용자의 예산 증감 이력을 조회합니다.

### 인증

필요.

### Query Parameters

| 이름 | 타입 | 설명 |
| --- | --- | --- |
| start_date | date, 선택 | 조회 시작 |
| end_date | date, 선택 | 조회 종료 |
| category_name | string, 선택 | 카테고리 필터 |

### Response Example

```json
{
  "status": "success",
  "count": 1,
  "data": [
    {
      "category_name": "카페",
      "old_limit": 30000,
      "new_limit": 50000,
      "direction": "증액",
      "changed_at": "2026-11-05T10:00:00"
    }
  ]
}
```

---

# 17. 챌린지 통계

## `GET /challenges/stats`

인증이 필요합니다. 선택적 `category_name`을 받아 이번 주 성공 개수와 연속 성공 일수를 반환합니다. `weekly`는 전체 주간 성공 수이며 `category_name`은 연속 성공 계산에 전달됩니다.

```json
{"status":"success","data":{"weekly":{"week_start":"2026-11-02","week_end":"2026-11-08","completed_count":2},"streak":{"current_streak":2,"last_completed_date":"2026-11-04"}}}
```

## `GET /challenges/stats/by-category`

인증이 필요합니다. `period=week`(기본) 또는 `all`, 선택적 `start_date`, `end_date`를 받습니다. 명시된 날짜 조건이 있으면 이를 사용합니다.

```json
{"status":"success","data":{"period":"week","start_date":"2026-11-02","end_date":"2026-11-08","categories":[{"category_name":"카페","total_count":3,"completed_count":0,"completion_rate":0,"xp_earned":0}]}}
```

달성은 `SUCCESS`만 집계합니다. 날짜 기준은 챌린지의 `challenge_date`이며 검증 실행 시각 기준이 아닙니다. 무지출 streak(거래가 0인 날)와 성공 챌린지 streak(성공 항목이 있는 날)는 서로 다른 지표입니다.

---

# 18. 지난 챌린지 이력

## `GET /challenges/history`

날짜별 결과와 개별 검증·보상 스냅샷을 조회합니다.

### 인증

필요.

### Query Parameters

| 이름 | 타입 | 설명 |
| --- | --- | --- |
| start_date | date, 선택 | 기본 종료일 포함 최근 30일의 첫날 |
| end_date | date, 선택 | 기본 어제; 오늘까지 허용, 미래는 400 |
| result | string, 선택 | SUCCESS,FAILED,VERIFYING,MISSED,PENDING을 쉼표로 선택 |
| category_name | string, 선택 | 카테고리 필터 |

### Response Example

```json
{
  "status": "success",
  "start_date": "2026-10-06",
  "end_date": "2026-11-04",
  "count": 1,
  "data": [
    {
      "date": "2026-11-04",
      "summary": {
        "total": 1,
        "success": 1,
        "failed": 0,
        "missed": 0,
        "verifying": 0,
        "xp_earned": 20
      },
      "challenges": [
        {
          "challenge_id": 10,
          "user_id": "demo-user",
          "category_name": "카페",
          "challenge_date": "2026-11-04",
          "challenge_type": "제한형",
          "challenge_text": "오늘은 카페 지출을 3500원 이하로 유지해보세요.",
          "difficulty": "Medium",
          "status": "SUCCESS",
          "xp_reward": 20,
          "ai_metadata": {
            "schema_version": "1.2",
            "challenge_origin": "pressure",
            "budget_limit": 150000,
            "predicted_monthly_spend": 150000,
            "predicted_today": 5000,
            "month_to_date_actual": 25000,
            "predicted_remaining_spend": 125000,
            "budget_pressure": 1.0,
            "daily_limit": 3500,
            "pressure_reduction": 0.7,
            "budget_reduction": 1.0,
            "final_reduction": 0.7,
            "limit_source": "normal",
            "model_used": "arima",
            "data_points_used": 120,
            "nonzero_ratio": 0.5,
            "text_source": "rule_fallback"
          },
          "reward_snapshot": {
            "leveled_up": false,
            "old_level": 1,
            "new_level": 1,
            "points_earned": 0,
            "current_points": 0,
            "unlocked_items": [],
            "unlocked_item_ids": []
          },
          "completed_at": "2026-11-05T00:05:00",
          "verification_result": {
            "result": "SUCCESS",
            "mode": "limit",
            "target_date": "2026-11-04",
            "category": "카페",
            "spent": 3000,
            "limit": 3500,
            "unverifiable_policy": null,
            "verified_at": "2026-11-05T00:05:00+09:00"
          },
          "result": "SUCCESS"
        }
      ]
    }
  ]
}
```

### Notes

조회 기간은 최대 93일이며 최신 날짜부터 반환합니다. `count`는 날짜 그룹 수가 아니라 반환된 챌린지 수입니다. 미체크 과거 항목은 `result=MISSED`이지만 DB `status=PENDING`을 유지합니다. 요약에는 포인트 합계가 없으므로 실제 지급 포인트·아이템은 성공 항목의 `reward_snapshot`을 사용합니다. 현재 `/challenges/settlements` 경로는 서버에 없습니다.

---

# 19. 거래처 카테고리 추천

## `POST /transactions/classify`

거래처명을 사용자 규칙·키워드로 분류합니다.

### 인증

필요.

### Request

```json
{
  "merchant_names": [
    "스타벅스",
    "알수없는거래처"
  ]
}
```

### Request Fields

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| merchant_names | string[] | 필수 | 중복·빈 이름 제거 후 최대 500개 |

### Response Example

```json
{
  "status": "success",
  "data": [
    {
      "merchant_name": "스타벅스",
      "normalized_name": "스타벅스",
      "suggested_category": "카페",
      "source": "KEYWORD"
    },
    {
      "merchant_name": "알수없는거래처",
      "normalized_name": "알수없는거래처",
      "suggested_category": null,
      "source": "NONE"
    }
  ]
}
```

### Notes

사용자의 과거 수정 규칙(`USER_RULE`)을 우선하고 키워드(`KEYWORD`)를 적용합니다. 사용자 카테고리로 매핑할 수 없으면 추천은 null입니다. 직접 입력 화면의 사전 추천 호출은 선택 기능이며, 빈 분류의 등록 시 서버 분류와 구분합니다.

---

# 20. 거래내역 파일 미리보기

## `POST /transactions/import/preview`

파일을 파싱하고 추천·제외 여부를 반환합니다. 이 단계는 거래를 DB에 저장하지 않습니다.

### 인증

필요.

### Request Fields

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| file | multipart 파일 | 필수 | 폼 필드 이름은 file; CSV 또는 XLSX |

### Response Example

```json
{
  "status": "success",
  "data": {
    "source_format": "GENERIC",
    "categories": [
      "카페",
      "식비"
    ],
    "summary": {
      "total_rows": 1,
      "included": 1,
      "expense": 1,
      "refund": 0,
      "transfer": 0,
      "other_out": 0,
      "income": 0,
      "benefit_reversal": 0,
      "invalid": 0,
      "duplicate": 0
    },
    "rows": [
      {
        "row_no": 2,
        "import_key": "<preview에서 반환한 값>",
        "occurred_at": "2026-11-05T14:30:00",
        "kind": "EXPENSE",
        "tx_type": "",
        "summary": "테스트카페",
        "merchant_name": "테스트카페",
        "amount": 5800,
        "memo": "친구와 만남",
        "suggested_category": "카페",
        "suggestion_source": "FILE",
        "importable": true,
        "include": true,
        "duplicate": false,
        "error": null,
        "warning": null,
        "refunded_by_row": null,
        "refunds_row": null,
        "refunds_tx_id": null
      }
    ]
  }
}
```

### Notes

`multipart/form-data` 요청이며 브라우저에서 `FormData` 사용 시 boundary가 붙도록 Content-Type을 직접 고정하지 않습니다.

| 항목 | 서버 제한·동작 |
|---|---|
| 확장자 | `.csv`, `.xlsx`만 지원; `.xls` 미지원 |
| 크기·행 수 | 최대 5 MiB, 최대 10,000행 |
| CSV | UTF-8(BOM 포함)/CP949 순으로 읽기 시도 |
| XLSX | 첫 워크시트를 읽으며 암호화 파일은 해제 후 저장 필요 |
| 형식 | `TOSS`(토스뱅크 거래내역) 또는 `GENERIC`(날짜·금액·결제처 표) |
| 일반 표 | 날짜·금액·결제처 필수, 카테고리·시간·메모 선택; 시간 없으면 12:00 |

| `kind` | 기본 처리 |
|---|---|
| EXPENSE | 유효하고 중복/환불 상쇄가 없으면 기본 포함 |
| TRANSFER | 가져오기 가능하지만 기본 제외; 사용자가 선택 가능 |
| OTHER_OUT | 추천 카테고리가 있으면 기본 포함 |
| REFUND | 거래로 저장하지 않고 대응 결제 상쇄 후보로 제공 |
| INCOME / BENEFIT_REVERSAL | 지출 등록 대상에서 제외 |
| INVALID | 읽을 수 없는 행; `error`와 함께 제외 |

프론트는 `kind`, `importable`, `include`, `duplicate`, `refunded_by_row`를 함께 반영해야 합니다. `occurred_at`이 날짜·시간 원본이며 서버 미리보기는 `tx_date`를 별도로 반환하지 않습니다.

---

# 21. 거래내역 파일 등록 확정

## `POST /transactions/import/confirm`

선택한 행을 하나의 DB 트랜잭션으로 등록합니다.

### 인증

필요.

### Request

```json
{
  "source_format": "GENERIC",
  "rows": [
    {
      "import_key": "<preview에서 반환한 값>",
      "occurred_at": "2026-11-05T14:30:00",
      "merchant_name": "테스트카페",
      "amount": 5800,
      "final_category": "카페",
      "memo": "친구와 만남",
      "tx_type": ""
    }
  ],
  "cancel_tx_ids": []
}
```

### Request Fields

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| source_format | string | 필수 | 미리보기의 TOSS/GENERIC 그대로 |
| rows | ImportRow[] | 필수 | 선택한 등록 대상 행 |
| rows[].import_key | string | 필수 | 미리보기 키 그대로; 임의 재생성하지 않음 |
| rows[].occurred_at | datetime | 필수 | 미리보기 일시 그대로 |
| rows[].merchant_name | string | 필수 | 비어 있지 않은 결제처 |
| rows[].amount | integer | 필수 | 0보다 큰 지출액 |
| rows[].final_category | string | 업무상 필수 | 현재 사용자 카테고리; null/미지정은 400 |
| rows[].memo | string 또는 null | 선택 | 메모 |
| rows[].tx_type | string 또는 null | 선택 | 원 거래 유형 |
| cancel_tx_ids | string[] | 선택 | 기본 []; 기존 가져온 거래의 환불 취소 대상 ID |

### Response Example

```json
{
  "status": "success",
  "data": {
    "inserted": 1,
    "skipped_duplicate": 0,
    "cancelled": 0,
    "dates": [
      "2026-11-05"
    ]
  }
}
```

### Notes

등록 결과는 `inserted`, `skipped_duplicate`, `cancelled`입니다. `imported_count` 등으로 임의 가정하면 안 됩니다. 없는 카테고리·금액 오류 시 전체 등록을 중단합니다. 사용자의 기존 `import_key`는 건너뛰며 동시 등록의 고유 제약 충돌은 409입니다. 취소 ID는 본인이 파일로 가져온 거래만 처리합니다. 프론트 토스트에는 서버 확정 중복 수와 미리보기에서 제외한 중복 수를 구분해 합산 여부를 결정합니다. API를 직접 호출하는 잘못된 데이터까지 모두 정리된다는 뜻은 아닙니다.

---

# 22. 소셜 API

모든 항목에 사용자 JWT가 필요합니다. 공개 사용자 필드는 `user_id`, `nickname`, `current_level`, `total_xp`, `character`, `equipped_items`입니다. 공개 아이템 필드는 `item_id`, `name`, `category`, `image_url`, `rarity`입니다.

개인 거래·예산·이메일·수입일·소비 성향·보유 포인트는 공개 응답에 포함하지 않습니다. 이름 검색은 정확한 닉네임 기준입니다.

| 메서드·경로 | 요청·기능 | 응답의 주요 필드 |
|---|---|---|
| `GET /users/search` | query `nickname` | `data`: 공개 사용자 + `friendship_status` |
| `GET /users/{target_user_id}/profile` | 대상 ID | `data`: 공개 사용자 + 관계 상태 |
| `POST /friends/requests` | JSON `{"nickname":"모니친구"}` | `data`: 요청 정보 + `auto_accepted` |
| `GET /friends/requests` | `direction=received`(기본) 또는 `sent` | `count`, `data[]`: 요청 목록 |
| `POST /friends/requests/{request_id}/accept` | body 없음 | `data.request_id`, `data.status` |
| `POST /friends/requests/{request_id}/reject` | body 없음 | `data.request_id` |
| `DELETE /friends/requests/{request_id}` | 보낸 요청 취소 | `data.request_id` |
| `GET /friends` | 친구 목록 | `count`, `data[]`: 공개 사용자 |
| `GET /friends/ranking` | `period=week`(기본), `month`, `all` | 기간, 순위, 달성 개수와 공개 사용자 |
| `DELETE /friends/{friend_user_id}` | 친구 삭제 | `data.user_id` |

### Response Example
```json
{
  "status": "success",
  "data": {
    "user_id": "friend-user",
    "nickname": "모니친구",
    "current_level": 2,
    "total_xp": 35,
    "character": null,
    "equipped_items": [],
    "friendship_status": "FRIEND"
  }
}
```

### Notes

관계 상태는 `SELF`, `NONE`, `FRIEND`, `REQUEST_SENT`, `REQUEST_RECEIVED`를 사용합니다. 요청 객체에는 `request_id`, `direction`(SENT/RECEIVED), `status`, `created_at`, 상대 `user`가 있습니다. 서로 보낸 요청이 만나면 자동 수락될 수 있습니다.

랭킹 응답은 `status`, `period`, `start_date`, `end_date`, `count`, `data[]`이며 각 행은 `rank`, `is_me`, `completed_count`, `user`를 포함합니다. 현재 프론트 소셜 화면에는 이 랭킹 API 호출이 연결되어 있지 않습니다. 요청 수락/거절/취소 권한과 친구 삭제 권한은 서버에서 확인합니다.

---

# 23. 상점·인벤토리 API

모든 항목에 사용자 JWT가 필요합니다.

| 메서드·경로 | 요청 | 주요 응답 |
|---|---|---|
| `GET /shop/items` | 선택적 `category` | `status`, `count`, `data[]` |
| `POST /shop/purchase/{item_id}` | body 없음 | `data.item`, `data.current_points` |
| `GET /shop/inventory` | body 없음 | `status`, `count`, `data[]` |
| `PATCH /shop/inventory/{item_id}/equip` | `{"equip":true}` 또는 false | `data`: 인벤토리 항목 |

### Response Fields

| 객체 | 필드 |
|---|---|
| ShopItem | `item_id`, `name`, `description`, `category`, `price`, `image_url`, `is_purchasable`, `is_repeatable`, `rarity`, `unlock_level` |
| InventoryItem | `id`, `item_id`, `item`, `acquired_type`, `is_equipped`, `acquired_at` |

### Notes

장착 경로는 인벤토리 행의 `id`가 아니라 상점 아이템의 `item_id`를 사용합니다. 구매는 포인트 차감·포인트 이력·인벤토리 추가를 같은 트랜잭션에서 처리합니다. 포인트 부족 또는 구매 불가 항목은 400, 비반복 아이템 중복 소유는 409입니다. 장착은 보유 여부를 검사하며, 프론트의 카테고리별 교체 규칙과 서버 단일 장착 플래그 변경을 구분합니다.

---

# 24. 내부 챌린지 정산

## `POST /internal/challenges/verify`

### 인증

일반 사용자 JWT로 호출하는 API가 아닙니다. 서버 `CRON_SECRET`과 같은 값을 `X-Cron-Secret`에 넣습니다. 설정 누락은 503, 인증 실패는 401입니다.

### Query Parameters

| 이름 | 타입 | 설명 |
|---|---|---|
| `as_of` | date, 선택 | 수동 테스트 기준일; 일반 예약 호출에서는 생략 |
| `user_id` | string, 선택 | 특정 사용자만 정산 |

### Notes

GitHub Actions는 매일 00:05 KST(`5 15 * * *` UTC) 호출을 예약합니다. 실제 실행 시각은 지연될 수 있습니다. 조회 API의 보정 정산은 KST 날짜를 기준으로 하므로 **00:05 이전 실행을 금지하는 조건은 없습니다.**

검증은 과거 날짜의 `VERIFYING`을 대상으로 합니다. 실제 등록 지출과 한도를 비교하고 성공 XP와 레벨업 보상을 같은 트랜잭션으로 처리합니다. 수치 한도가 없는 기본 챌린지는 현재 승인 정책이 적용될 수 있습니다. 동일 정산 재실행 시 이미 확정된 항목은 지급 대상에서 제외합니다.

운영 DB에서 `as_of`로 미래 정산을 시연하지 않습니다. 과거의 사용자 기록이나 보상이 바뀔 수 있으므로 별도 테스트 DB에서만 사용합니다. 현재 문서에 정산 성공 건수를 기재한 실행 결과는 포함하지 않습니다.

---

# 25. 서버 상태 확인

## `GET /`

인증 없이 서버 인사 메시지를 반환합니다. `/docs` 또는 `/openapi.json`은 자동 API 문서입니다. 루트/문서의 200 응답만으로 DB 조회·회원가입·파일 등록이 정상이라는 결론을 내릴 수 없습니다.

---

# 상태값 정리

## Challenge Status

| 값 | 의미 |
|---|---|
| PENDING | 아직 완료 표시하지 않음 |
| VERIFYING | 완료 표시 후 서버 검증 대기; 보상 없음 |
| SUCCESS | 검증 성공·보상 처리 완료 |
| FAILED | 검증 실패 또는 포기 |
| MISSED | 이력 조회의 `result`에서만 사용; 날짜가 지난 미체크 PENDING |

## Difficulty

| 값 | 화면 의미 | 기본 XP 정책 |
|---|---|---|
| Easy | 쉬움·유지형 | 10 |
| Medium | 보통·제한형 | 20 |
| Medium-Hard | 조금 어려움·강한 제한형 | 25 |
| Hard | 어려움·금지형 | 30 |
| Special | 무지출 보너스 | `min(15 + streak × 5, 60)` |

개별 화면은 서버 `xp_reward`를 우선합니다. XP 누적에 따른 일반 레벨업은 50P, 5의 배수 레벨은 추가 100P와 지정 아이템 보상 대상입니다.

## 주요 카테고리 예시

| 예시 값 | 설명 |
|---|---|
| 카페 | 카페·음료 |
| 식비 | 식사·외식 |
| 쇼핑 | 쇼핑 분류 |
| 교통 | 교통비 |

시드 사용자는 의류·화장품 등 다른 설정을 가질 수 있습니다. 허용 목록을 하드코딩하지 말고 `GET /categories` 또는 미리보기 `categories`를 사용합니다.

---

# PowerShell 테스트 예시

테스트 계정·테스트 DB에서만 실행합니다. 회원가입은 데이터를 생성하는 요청입니다. Swagger OAuth2 Authorize 창의 form 요청과 JSON 로그인은 다를 수 있습니다.

## 1. 회원가입

```powershell
$base = "http://localhost:8000"
$signupBody = @{
  email = "moni-doc-test@example.com"
  password = "replace-with-test-password"
  income_type = "STUDENT"
  payday = 25
  spend_profile = "IMPULSIVE"
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/signup" `
  -ContentType "application/json" -Body $signupBody
```

## 2. 로그인

```powershell
$loginBody = @{
  email = "moni-doc-test@example.com"
  password = "replace-with-test-password"
} | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$base/login" `
  -ContentType "application/json" -Body $loginBody
$headers = @{ Authorization = "Bearer $($login.access_token)"; Accept = "application/json" }
```

## 3. 인증 API 호출

```powershell
Invoke-RestMethod -Method Get -Uri "$base/me" -Headers $headers
Invoke-RestMethod -Method Get -Uri "$base/categories" -Headers $headers
Invoke-RestMethod -Method Get -Uri "$base/challenges/history" -Headers $headers
```

## 4. 챌린지 생성 확인

```powershell
$generated = Invoke-RestMethod -Method Post `
  -Uri "$base/challenges/generate" -Headers $headers
$generated.data | ConvertTo-Json -Depth 15
```

생성은 오늘의 결과를 저장하거나 재사용합니다. 테스트 종료 후 자격 증명·토큰을 로그·PR에 게시하지 않습니다.

---

# Android 연동 시 주의사항

1. JSON API와 multipart 파일 API를 구분합니다. 현재 파일 선택 UI는 Expo Web 중심입니다.
2. 로그인 토큰은 인증 요청 헤더로 전달합니다. 정산 비밀키는 앱에 넣지 않습니다.
3. 생성 API body는 없으며, 완료 SUCCESS 요청은 대기 VERIFYING으로 반환됩니다.
4. `tx_date`, `tx_time`과 파일 가져오기의 `occurred_at`을 구분합니다.
5. 로컬 PC 서버에 접근할 때 실제 기기에서의 `localhost`는 PC를 뜻하지 않습니다. 네이티브 연결 설정은 별도 확인합니다.
6. 오류를 성공 빈 목록으로 바꾸지 말고 상태 코드와 `detail`을 확인합니다.
7. CORS 문구와 500이 함께 발생하면 서버 예외·DB 스키마도 확인합니다.

## 현재 프론트와의 계약 불일치

| 항목 | 서버 명세 | 현재 프론트 확인 사항 |
|---|---|---|
| 정산 팝업 | `/challenges/history`, 날짜별 summary/challenges | `/challenges/settlements?days=14` 호출·다른 응답 구조 |
| 파일 확정 | `source_format` 필수 | 프론트 확정 payload에서 누락 |
| 파일 일시 | `occurred_at` | 표시용 `tx_date`/`tx_time` 변환 보완 필요 |
| 제외 항목 | `kind`, `importable`, `include`, 환불 매핑 | status/type 중심 매핑으로 계약 보완 필요 |
| 등록 개수 | `inserted`, `skipped_duplicate`, `cancelled` | 다른 개수 필드명을 기대하는 변환 코드 |
| 파일 제한 | CSV/XLSX, 최대 5 MiB | `.xls`와 최대 15 MiB 선택 허용 |
| 예산 알림 기준 | 1~100 | 프론트가 0도 허용 |
| 친구 랭킹 | `/friends/ranking` 존재 | 소셜 화면 호출·표시 미연결 |

이 표는 수정 요청 목록이며 이번 문서 패치로 실행 코드가 바뀌지는 않습니다.

---

> 코드 근거: [api/main.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/main.py) · [api/schemas.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/schemas.py) · [api/serializers.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/serializers.py) · [api/routers/auth_router.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/routers/auth_router.py) · [api/routers/transactions_router.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/routers/transactions_router.py) · [api/routers/challenges_router.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/routers/challenges_router.py) · [api/routers/social_router.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/routers/social_router.py) · [api/routers/shop_router.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/routers/shop_router.py) · [api/routers/categories_router.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/routers/categories_router.py) · [api/routers/internal_router.py](https://github.com/SPY-capstone-2026/SPY-capstoneREPO/blob/bdc23f9c05c1c827ffdd0ccfe6e8889ba9b8948c/api/routers/internal_router.py)
