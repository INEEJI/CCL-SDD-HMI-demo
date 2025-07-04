# 스케줄 관리 API

생산 스케줄 관리를 위한 API 엔드포인트입니다.

## 📋 엔드포인트 목록

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | `/schedules` | 스케줄 목록 조회 |
| POST | `/schedules` | 새 스케줄 생성 |
| GET | `/schedules/{id}` | 스케줄 상세 조회 |
| PUT | `/schedules/{id}` | 스케줄 수정 |
| DELETE | `/schedules/{id}` | 스케줄 삭제 |

---

## GET /schedules

스케줄 목록을 조회합니다.

### 요청 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| page | integer | 아니오 | 1 | 페이지 번호 |
| limit | integer | 아니오 | 10 | 페이지 크기 (최대 100) |
| status | string | 아니오 | - | 스케줄 상태 필터 |
| customerId | integer | 아니오 | - | 고객사 ID 필터 |

#### status 값
- `scheduled`: 예정됨
- `in_progress`: 진행 중
- `completed`: 완료됨
- `cancelled`: 취소됨

### 요청 예시
```http
GET /api/schedules?page=1&limit=10&status=in_progress
```

### 응답 예시
```json
{
  "data": [
    {
      "id": 1,
      "coil_id": "COIL_2024_001",
      "customer_id": 1,
      "customer_name": "삼성전자",
      "bom_id": "BOM_001",
      "status": "in_progress",
      "start_time": "2024-01-15T09:00:00Z",
      "end_time": "2024-01-15T17:00:00Z",
      "progress_percentage": 45,
      "created_at": "2024-01-14T10:00:00Z",
      "updated_at": "2024-01-15T14:30:00Z"
    }
  ],
  "totalCount": 25,
  "page": 1,
  "limit": 10,
  "totalPages": 3
}
```

---

## POST /schedules

새로운 스케줄을 생성합니다.

### 요청 본문

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| coilId | string | 예 | 코일 ID (고유값) |
| customerId | integer | 예 | 고객사 ID |
| bomId | integer | 아니오 | BOM ID |
| startTime | string | 아니오 | 시작 시간 (ISO 8601) |
| endTime | string | 아니오 | 종료 시간 (ISO 8601) |

### 요청 예시
```http
POST /api/schedules
Content-Type: application/json

{
  "coilId": "COIL_2024_002",
  "customerId": 1,
  "bomId": 2,
  "startTime": "2024-01-16T09:00:00Z",
  "endTime": "2024-01-16T17:00:00Z"
}
```

### 응답 예시
```json
{
  "message": "스케줄이 성공적으로 생성되었습니다.",
  "data": {
    "id": 26,
    "coil_id": "COIL_2024_002",
    "customer_id": 1,
    "bom_id": 2,
    "status": "scheduled",
    "start_time": "2024-01-16T09:00:00Z",
    "end_time": "2024-01-16T17:00:00Z",
    "progress_percentage": 0,
    "created_at": "2024-01-15T15:30:00Z",
    "updated_at": "2024-01-15T15:30:00Z"
  }
}
```

---

## GET /schedules/{id}

특정 스케줄의 상세 정보를 조회합니다.

### 경로 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| id | integer | 예 | 스케줄 ID |

### 요청 예시
```http
GET /api/schedules/1
```

### 응답 예시
```json
{
  "data": {
    "id": 1,
    "coil_id": "COIL_2024_001",
    "customer_id": 1,
    "customer_name": "삼성전자",
    "bom_id": "BOM_001",
    "status": "in_progress",
    "start_time": "2024-01-15T09:00:00Z",
    "end_time": "2024-01-15T17:00:00Z",
    "progress_percentage": 45,
    "created_at": "2024-01-14T10:00:00Z",
    "updated_at": "2024-01-15T14:30:00Z",
    "defect_count": 3,
    "last_detection_time": "2024-01-15T14:25:00Z"
  }
}
```

---

## PUT /schedules/{id}

스케줄 정보를 수정합니다.

### 경로 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| id | integer | 예 | 스케줄 ID |

### 요청 본문

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| status | string | 아니오 | 스케줄 상태 |
| startTime | string | 아니오 | 시작 시간 |
| endTime | string | 아니오 | 종료 시간 |
| progressPercentage | integer | 아니오 | 진행률 (0-100) |

### 요청 예시
```http
PUT /api/schedules/1
Content-Type: application/json

{
  "status": "completed",
  "progressPercentage": 100
}
```

### 응답 예시
```json
{
  "message": "스케줄이 성공적으로 수정되었습니다.",
  "data": {
    "id": 1,
    "coil_id": "COIL_2024_001",
    "status": "completed",
    "progress_percentage": 100,
    "updated_at": "2024-01-15T17:00:00Z"
  }
}
```

---

## DELETE /schedules/{id}

스케줄을 삭제합니다.

### 경로 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| id | integer | 예 | 스케줄 ID |

### 요청 예시
```http
DELETE /api/schedules/26
```

### 응답 예시
```json
{
  "message": "스케줄이 성공적으로 삭제되었습니다."
}
```

---

## 에러 응답

### 400 Bad Request
```json
{
  "error": "코일 ID와 고객사 ID는 필수입니다.",
  "code": "VALIDATION_ERROR"
}
```

### 404 Not Found
```json
{
  "error": "스케줄을 찾을 수 없습니다.",
  "code": "NOT_FOUND"
}
```

### 409 Conflict
```json
{
  "error": "이미 존재하는 코일 ID입니다.",
  "code": "CONFLICT"
}
```

---

## 사용 예시

### JavaScript
```javascript
// 스케줄 목록 조회
const schedules = await fetch('/api/schedules?status=in_progress')
  .then(res => res.json());

// 새 스케줄 생성
const newSchedule = await fetch('/api/schedules', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    coilId: 'COIL_2024_003',
    customerId: 1,
    startTime: '2024-01-17T09:00:00Z'
  })
}).then(res => res.json());

// 스케줄 상태 업데이트
const updated = await fetch('/api/schedules/1', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'completed',
    progressPercentage: 100
  })
}).then(res => res.json());
```

### Python
```python
import requests

# 스케줄 목록 조회
response = requests.get('http://localhost:3000/api/schedules', 
                       params={'status': 'in_progress'})
schedules = response.json()

# 새 스케줄 생성
new_schedule_data = {
    'coilId': 'COIL_2024_003',
    'customerId': 1,
    'startTime': '2024-01-17T09:00:00Z'
}

response = requests.post('http://localhost:3000/api/schedules',
                        json=new_schedule_data)
new_schedule = response.json()
``` 