# Moni API 문서

이 문서는 Moni 앱의 Android / 외부 클라이언트 연동을 위한 API 명세입니다.

Moni는 사용자의 소비 기록과 카테고리별 예산을 기반으로 월말 예상 지출, 예산 압박도, 오늘의 지출 제한형 챌린지를 제공합니다.

## Base URL

### 로컬 개발 서버

```text
http://localhost:8000
```

### 배포 서버

```text
https://spy-capstonerepo-production.up.railway.app
```

## 인증 방식

회원가입과 로그인을 제외한 대부분의 API는 JWT Bearer 토큰이 필요합니다.

```http
Authorization: Bearer {access_token}
```

`access_token`은 `POST /login` 응답에서 받을 수 있습니다.

## 공통 응답 형식

API에 따라 응답 구조는 조금씩 다를 수 있지만, 대체로 아래 형태를 사용합니다.

```json
{
  "status": "success",
  "data": {}
}
```

목록 응답은 `count`와 `data` 배열을 포함합니다.

```json
{
  "status": "success",
  "count": 1,
  "data": []
}
```

오류 응답은 FastAPI 기본 형식을 따릅니다.

```json
{
  "detail": "오류 메시지"
}
```

---

# 1. 회원가입

## `POST /signup`

새 사용자를 생성합니다.

### 인증

필요 없음.

### Request

```json
{
  "email": "user@example.com",
  "password": "1234",
  "income_type": "STUDENT",
  "payday": 25,
  "spend_profile": "IMPULSIVE"
}
```

### Request Fields

| 필드            |     타입 | 필수 | 설명      |
| ------------- | -----: | -: | ------- |
| email         | string |  O | 사용자 이메일 |
| password      | string |  O | 비밀번호    |
| income_type   | string |  O | 수입 유형   |
| payday        | number |  O | 수입일     |
| spend_profile | string |  O | 소비 성향   |

### Response Example

```json
{
  "status": "success",
  "user_id": "bcf7c867-bdca-449d-a4fc-88bf09d6730d"
}
```

### Notes

회원가입 후 기본 카테고리 예산 항목이 생성됩니다.

---

# 2. 로그인

## `POST /login`

이메일과 비밀번호로 로그인하고 JWT 토큰을 발급받습니다.

### 인증

필요 없음.

### Request

```json
{
  "email": "user@example.com",
  "password": "1234"
}
```

### Response Example

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "token_type": "bearer"
}
```

### Notes

이후 인증이 필요한 API에서는 아래 형식의 헤더를 사용합니다.

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

---

# 3. 내 정보 조회

## `GET /me`

현재 로그인한 사용자의 정보를 조회합니다.

### 인증

필요.

### Header

```http
Authorization: Bearer {access_token}
```

### Response Example

```json
{
  "user_id": "bcf7c867-bdca-449d-a4fc-88bf09d6730d",
  "email": "user@example.com",
  "income_type": "STUDENT",
  "payday": 25,
  "spend_profile": "IMPULSIVE",
  "valid_data_start_date": null,
  "total_xp": 10,
  "current_level": 1,
  "created_at": "2026-06-02T00:00:00"
}
```

---

# 4. 내 정보 수정

## `PATCH /me`

사용자의 계정 정보를 수정합니다.

### 인증

필요.

### Header

```http
Authorization: Bearer {access_token}
```

### Request

```json
{
  "email": "new@example.com",
  "income_type": "EMPLOYEE",
  "payday": 10,
  "spend_profile": "STEADY"
}
```

### Request Fields

| 필드            |     타입 | 필수 | 설명        |
| ------------- | -----: | -: | --------- |
| email         | string | 선택 | 변경할 이메일   |
| income_type   | string | 선택 | 변경할 수입 유형 |
| payday        | number | 선택 | 변경할 수입일   |
| spend_profile | string | 선택 | 변경할 소비 성향 |

### Response Example

```json
{
  "status": "success",
  "data": {
    "user_id": "bcf7c867-bdca-449d-a4fc-88bf09d6730d",
    "email": "new@example.com",
    "income_type": "EMPLOYEE",
    "payday": 10,
    "spend_profile": "STEADY",
    "total_xp": 10,
    "current_level": 1
  }
}
```

---

# 5. 지출 목록 조회

## `GET /transactions`

현재 사용자의 지출 내역을 조회합니다.

### 인증

필요.

### Header

```http
Authorization: Bearer {access_token}
```

### Response Example

```json
{
  "status": "success",
  "count": 1,
  "data": [
    {
      "tx_id": "a9990310-49ba-4506-86e2-f48a579b7ec4",
      "user_id": "bcf7c867-bdca-449d-a4fc-88bf09d6730d",
      "tx_date": "2026-06-02",
      "tx_time": "14:30",
      "amount": 5800,
      "merchant_name": "테스트카페",
      "mydata_category": "직접 입력",
      "final_category": "카페",
      "is_user_corrected": true
    }
  ]
}
```

### Response Fields

| 필드                |      타입 | 설명                  |
| ----------------- | ------: | ------------------- |
| tx_id             |  string | 지출 ID               |
| user_id           |  string | 사용자 ID              |
| tx_date           |  string | 지출 날짜, `YYYY-MM-DD` |
| tx_time           |  string | 지출 시간, `HH:MM`      |
| amount            |  number | 지출 금액               |
| merchant_name     |  string | 결제처                 |
| mydata_category   |  string | 원본 또는 입력 카테고리       |
| final_category    |  string | 최종 카테고리             |
| is_user_corrected | boolean | 사용자가 직접 수정했는지 여부    |

---

# 6. 지출 추가

## `POST /transactions`

지출 내역을 새로 추가합니다.

### 인증

필요.

### Header

```http
Authorization: Bearer {access_token}
```

### Request

```json
{
  "tx_date": "2026-06-02",
  "tx_time": "14:30",
  "amount": 5800,
  "merchant_name": "테스트카페",
  "mydata_category": "직접 입력",
  "final_category": "카페",
  "is_user_corrected": true
}
```

### Request Fields

| 필드                |      타입 | 필수 | 설명                  |
| ----------------- | ------: | -: | ------------------- |
| tx_date           |  string |  O | 지출 날짜, `YYYY-MM-DD` |
| tx_time           |  string |  O | 지출 시간, `HH:MM`      |
| amount            |  number |  O | 지출 금액               |
| merchant_name     |  string |  O | 결제처                 |
| mydata_category   |  string |  O | 원본 또는 입력 카테고리       |
| final_category    |  string |  O | 최종 카테고리             |
| is_user_corrected | boolean |  O | 사용자 수정 여부           |

### Response Example

```json
{
  "status": "success",
  "data": {
    "tx_id": "a9990310-49ba-4506-86e2-f48a579b7ec4",
    "user_id": "bcf7c867-bdca-449d-a4fc-88bf09d6730d",
    "tx_date": "2026-06-02",
    "tx_time": "14:30",
    "amount": 5800,
    "merchant_name": "테스트카페",
    "mydata_category": "직접 입력",
    "final_category": "카페",
    "is_user_corrected": true
  }
}
```

---

# 7. 지출 수정

## `PATCH /transactions/{tx_id}`

기존 지출 내역을 수정합니다.

### 인증

필요.

### Header

```http
Authorization: Bearer {access_token}
```

### Path Parameters

| 이름    |     타입 | 설명        |
| ----- | -----: | --------- |
| tx_id | string | 수정할 지출 ID |

### Request

```json
{
  "tx_date": "2026-06-01",
  "amount": 7000,
  "merchant_name": "메가커피",
  "mydata_category": "직접 입력",
  "final_category": "카페",
  "is_user_corrected": true
}
```

### Request Fields

| 필드                |      타입 | 필수 | 설명                  |
| ----------------- | ------: | -: | ------------------- |
| tx_date           |  string | 선택 | 지출 날짜, `YYYY-MM-DD` |
| tx_time           |  string | 선택 | 지출 시간, `HH:MM`      |
| amount            |  number | 선택 | 지출 금액               |
| merchant_name     |  string | 선택 | 결제처                 |
| mydata_category   |  string | 선택 | 원본 또는 입력 카테고리       |
| final_category    |  string | 선택 | 최종 카테고리             |
| is_user_corrected | boolean | 선택 | 사용자 수정 여부           |

### Response Example

```json
{
  "status": "success",
  "data": {
    "tx_id": "a9990310-49ba-4506-86e2-f48a579b7ec4",
    "user_id": "bcf7c867-bdca-449d-a4fc-88bf09d6730d",
    "tx_date": "2026-06-01",
    "tx_time": "14:30",
    "amount": 7000,
    "merchant_name": "메가커피",
    "mydata_category": "직접 입력",
    "final_category": "카페",
    "is_user_corrected": true
  }
}
```

### Notes

* `tx_date`를 수정하면 해당 지출이 월간 리포트에서 반영되는 월도 바뀝니다.
* 날짜 형식은 `YYYY-MM-DD`입니다.
* 시간 형식은 `HH:MM`입니다.

---

# 8. 지출 삭제

## `DELETE /transactions/{tx_id}`

기존 지출 내역을 삭제합니다.

### 인증

필요.

### Header

```http
Authorization: Bearer {access_token}
```

### Path Parameters

| 이름    |     타입 | 설명        |
| ----- | -----: | --------- |
| tx_id | string | 삭제할 지출 ID |

### Response Example

```json
{
  "status": "success"
}
```

---

# 9. 카테고리 예산 조회

## `GET /categories`

사용자의 카테고리별 예산 설정을 조회합니다.

### 인증

필요.

### Header

```http
Authorization: Bearer {access_token}
```

### Response Example

```json
{
  "status": "success",
  "count": 4,
  "data": [
    {
      "id": "1",
      "user_id": "bcf7c867-bdca-449d-a4fc-88bf09d6730d",
      "category_name": "카페",
      "budget_limit": 30000,
      "is_daily_challenge": true,
      "alert_threshold": 80
    }
  ]
}
```

### Response Fields

| 필드                 |      타입 | 설명              |
| ------------------ | ------: | --------------- |
| id                 |  string | 카테고리 설정 ID      |
| user_id            |  string | 사용자 ID          |
| category_name      |  string | 카테고리 이름         |
| budget_limit       |  number | 월 예산            |
| is_daily_challenge | boolean | 오늘의 미션 후보 포함 여부 |
| alert_threshold    |  number | 알림 기준 퍼센트       |

---

# 10. 카테고리 예산 수정

## `PATCH /categories/{category_id}`

카테고리별 월 예산, 알림 기준, 미션 후보 포함 여부를 수정합니다.

### 인증

필요.

### Header

```http
Authorization: Bearer {access_token}
```

### Path Parameters

| 이름          |     타입 | 설명         |
| ----------- | -----: | ---------- |
| category_id | string | 카테고리 설정 ID |

### Request

```json
{
  "budget_limit": 50000,
  "is_daily_challenge": true,
  "alert_threshold": 80
}
```

### Request Fields

| 필드                 |      타입 | 필수 | 설명              |
| ------------------ | ------: | -: | --------------- |
| budget_limit       |  number | 선택 | 월 예산            |
| is_daily_challenge | boolean | 선택 | 오늘의 미션 후보 포함 여부 |
| alert_threshold    |  number | 선택 | 알림 기준 퍼센트       |

### Response Example

```json
{
  "status": "success",
  "data": {
    "id": "1",
    "user_id": "bcf7c867-bdca-449d-a4fc-88bf09d6730d",
    "category_name": "카페",
    "budget_limit": 50000,
    "is_daily_challenge": true,
    "alert_threshold": 80
  }
}
```

---

# 11. 월간 리포트 조회

## `GET /reports/monthly`

이번 달 소비 요약, 월말 예상 지출, 요일별 소비 리듬, 카테고리별 예산 상태를 조회합니다.

### 인증

필요.

### Header

```http
Authorization: Bearer {access_token}
```

### Response Example

```json
{
  "status": "success",
  "data": {
    "month": "2026-06",
    "monthly_summary": {
      "total_spend": 50000,
      "budget_limit": 300000,
      "predicted_monthly_spend": 250000,
      "budget_pressure": 0.83,
      "transaction_count": 5
    },
    "weekly_trend": [
      {
        "label": "월",
        "amount": 12000
      },
      {
        "label": "화",
        "amount": 8000
      }
    ],
    "evaluated_categories": [
      {
        "category_name": "카페",
        "actual_spend": 15000,
        "budget_limit": 30000,
        "predicted_monthly_spend": 45000,
        "budget_pressure": 1.5
      }
    ]
  }
}
```

### Response Fields

| 필드                                      |     타입 | 설명                   |
| --------------------------------------- | -----: | -------------------- |
| month                                   | string | 리포트 기준 월             |
| monthly_summary.total_spend             | number | 이번 달 현재까지 기록된 총 지출   |
| monthly_summary.budget_limit            | number | 카테고리별 월 예산 합계        |
| monthly_summary.predicted_monthly_spend | number | 현재 지출 속도 기반 월말 예상 지출 |
| monthly_summary.budget_pressure         | number | 월말 예상 지출 / 월 예산      |
| monthly_summary.transaction_count       | number | 이번 달 지출 기록 수         |
| weekly_trend                            |  array | 요일별 지출 합계            |
| evaluated_categories                    |  array | 카테고리별 예산 상태          |

### Notes

* 월말 예상 지출은 예산이 아니라 실제 지출 속도 기반으로 계산됩니다.
* 예산을 수정해도 `predicted_monthly_spend` 자체가 바로 바뀌는 것은 아닙니다.
* 예산 변경 시 바뀌는 값은 `budget_pressure`, 예산 게이지, 초과/여유 상태입니다.

---

# 12. 오늘의 챌린지 조회

## `GET /challenges/today`

오늘 날짜의 챌린지를 조회합니다.

### 인증

필요.

### Header

```http
Authorization: Bearer {access_token}
```

### Response Example

```json
{
  "status": "success",
  "count": 1,
  "data": [
    {
      "challenge_id": 10,
      "user_id": "bcf7c867-bdca-449d-a4fc-88bf09d6730d",
      "category_name": "카페",
      "challenge_date": "2026-06-02",
      "challenge_type": "절약형",
      "challenge_text": "오늘은 카페 지출을 줄여보세요.",
      "difficulty": "Easy",
      "status": "PENDING",
      "xp_reward": 10,
      "ai_metadata": {
        "model_version": "fallback-v1",
        "generated_at": "2026-06-02T11:43:23.507593",
        "budget_limit": 30000,
        "month_to_date_actual": 0,
        "predicted_remaining_spend": 0,
        "predicted_monthly_spend": 0,
        "budget_pressure": 1,
        "evaluated_categories": []
      }
    }
  ]
}
```

### Challenge Fields

| 필드             |     타입 | 설명                       |
| -------------- | -----: | ------------------------ |
| challenge_id   | number | 챌린지 ID                   |
| user_id        | string | 사용자 ID                   |
| category_name  | string | 챌린지 대상 카테고리              |
| challenge_date | string | 챌린지 날짜                   |
| challenge_type | string | 챌린지 유형                   |
| challenge_text | string | 사용자에게 보여줄 챌린지 문구         |
| difficulty     | string | 난이도                      |
| status         | string | 챌린지 상태                   |
| xp_reward      | number | 완료 시 지급 XP               |
| ai_metadata    | object | 챌린지 생성 근거 또는 fallback 정보 |

---

# 13. 오늘의 챌린지 생성

## `POST /challenges/generate`

오늘의 챌린지를 생성합니다.

### 인증

필요.

### Header

```http
Authorization: Bearer {access_token}
```

### Request Body

없음.

### Response Example

```json
{
  "status": "success",
  "count": 1,
  "data": [
    {
      "challenge_id": 10,
      "user_id": "bcf7c867-bdca-449d-a4fc-88bf09d6730d",
      "category_name": "카페",
      "challenge_date": "2026-06-02",
      "challenge_type": "절약형",
      "challenge_text": "오늘은 카페 지출을 줄여보세요.",
      "difficulty": "Easy",
      "status": "PENDING",
      "xp_reward": 10,
      "ai_metadata": {
        "model_version": "fallback-v1",
        "generated_at": "2026-06-02T11:43:23.507593",
        "budget_limit": 30000,
        "month_to_date_actual": 0,
        "predicted_remaining_spend": 0,
        "predicted_monthly_spend": 0,
        "budget_pressure": 1,
        "evaluated_categories": []
      }
    }
  ]
}
```

### AI Metadata Notes

현재 테스트에서 확인된 값은 다음과 같습니다.

```text
model_version: fallback-v1
```

`fallback-v1`은 소비 데이터가 부족하거나 AI 추천 결과가 비어 있을 때 기본 챌린지를 생성했다는 의미입니다.

현재 확인된 상태:

```text
API 연결 성공
인증 성공
챌린지 생성 성공
ai_metadata 포함
fallback 챌린지 생성 확인
```

---

# 14. 챌린지 상태 수정

## `PATCH /challenges/{challenge_id}/status`

챌린지를 완료하거나 완료 취소합니다.

### 인증

필요.

### Header

```http
Authorization: Bearer {access_token}
```

### Path Parameters

| 이름           |     타입 | 설명         |
| ------------ | -----: | ---------- |
| challenge_id | number | 수정할 챌린지 ID |

### 완료 Request

```json
{
  "status": "SUCCESS"
}
```

### 완료 취소 Request

```json
{
  "status": "PENDING"
}
```

### Response Example

```json
{
  "status": "success",
  "data": {
    "challenge": {
      "challenge_id": 10,
      "status": "SUCCESS"
    },
    "user_progress": {
      "user_id": "bcf7c867-bdca-449d-a4fc-88bf09d6730d",
      "total_xp": 10,
      "current_level": 1
    }
  }
}
```

### Notes

* `SUCCESS`로 변경하면 챌린지 완료 처리됩니다.
* `PENDING`으로 변경하면 완료 취소 처리됩니다.
* 완료 / 취소에 따라 XP와 레벨이 다시 반영됩니다.

---

# 상태값 정리

## Challenge Status

| 값       | 의미   |
| ------- | ---- |
| PENDING | 진행 중 |
| SUCCESS | 완료   |

## Difficulty

| 값      | 의미  |
| ------ | --- |
| Easy   | 쉬움  |
| Normal | 보통  |
| Hard   | 어려움 |

## 주요 카테고리 예시

현재 프론트에서 사용하는 대표 카테고리 예시는 다음과 같습니다.

| 값   | 설명      |
| --- | ------- |
| 카페  | 카페 / 음료 |
| 식비  | 식사 / 외식 |
| 쇼핑  | 쇼핑      |
| 편의점 | 편의점     |
| 교통  | 교통비     |

실제 카테고리 목록은 `GET /categories` 응답을 기준으로 사용합니다.

---

# PowerShell 테스트 예시

Swagger Authorize가 JSON 로그인 방식과 맞지 않을 수 있으므로, PowerShell로 테스트할 수 있습니다.

## 1. 회원가입

```powershell
$signupBody = @{
  email = "aaa@aaa.com"
  password = "1234"
  income_type = "STUDENT"
  payday = 25
  spend_profile = "IMPULSIVE"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/signup" `
  -ContentType "application/json" `
  -Body $signupBody
```

## 2. 로그인

```powershell
$loginBody = @{
  email = "aaa@aaa.com"
  password = "1234"
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/login" `
  -ContentType "application/json" `
  -Body $loginBody

$token = $login.access_token
```

## 3. 인증 API 호출

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8000/me" `
  -Headers @{
    Authorization = "Bearer $token"
    Accept = "application/json"
  }
```

## 4. 챌린지 생성 확인

```powershell
$generated = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/challenges/generate" `
  -Headers @{
    Authorization = "Bearer $token"
    Accept = "application/json"
  }

$generated.data[0] | ConvertTo-Json -Depth 10
```

---

# Android 연동 시 주의사항

1. 회원가입과 로그인을 제외한 API는 `Authorization: Bearer {access_token}` 헤더가 필요합니다.
2. `POST /challenges/generate`는 request body가 없습니다.
3. 지출 날짜는 `YYYY-MM-DD` 형식입니다.
4. 지출 시간은 `HH:MM` 형식입니다.
5. 챌린지 완료는 `status: "SUCCESS"`를 보냅니다.
6. 챌린지 완료 취소는 `status: "PENDING"`을 보냅니다.
7. 월말 예상 지출은 예산이 아니라 실제 지출 속도 기반입니다.
8. 예산 변경 시 주로 바뀌는 값은 `budget_pressure`, 게이지, 초과/여유 상태입니다.
9. 현재 챌린지 생성 API는 정상 연결되어 있으며, 테스트 결과 `ai_metadata.model_version`에서 `fallback-v1`이 확인되었습니다.
