# 결함 검출 결과 API

결함 검출 결과를 관리하는 API 엔드포인트입니다.

## 📋 엔드포인트 목록

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | `/defects` | 결함 검출 결과 조회 |
| POST | `/defects` | 결함 검출 결과 저장 |
| GET | `/defects/{id}` | 결함 상세 조회 |
| PUT | `/defects/{id}` | 결함 정보 수정 |
| DELETE | `/defects/{id}` | 결함 정보 삭제 |

---

## GET /defects

결함 검출 결과 목록을 조회합니다.

### 요청 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| page | integer | 아니오 | 1 | 페이지 번호 |
| limit | integer | 아니오 | 10 | 페이지 크기 (최대 100) |
| scheduleId | integer | 아니오 | - | 스케줄 ID 필터 |
| defectType | string | 아니오 | - | 결함 유형 필터 |
| modelId | integer | 아니오 | - | AI 모델 ID 필터 |
| minConfidence | number | 아니오 | - | 최소 신뢰도 점수 |
| startDate | string | 아니오 | - | 검출 시작 날짜 (ISO 8601) |
| endDate | string | 아니오 | - | 검출 종료 날짜 (ISO 8601) |

### 요청 예시
```http
GET /api/defects?scheduleId=123&defectType=scratch&minConfidence=0.8&page=1&limit=20
```

### 응답 예시
```json
{
  "data": [
    {
      "id": 1001,
      "schedule_id": 123,
      "coil_id": "COIL_2024_001",
      "model_id": 45,
      "model_name": "DefectNet_v2.1",
      "defect_type": "scratch",
      "defect_size_width": 15.5,
      "defect_size_height": 3.2,
      "defect_position_x": 120.0,
      "defect_position_y": 85.0,
      "defect_position_meter": 1250.5,
      "confidence_score": 0.95,
      "image_path": "/images/labeled/1642234200000_labeled_image.jpg",
      "detection_time": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-15T10:30:05Z"
    }
  ],
  "totalCount": 45,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

---

## POST /defects

새로운 결함 검출 결과를 저장합니다.

### 요청 본문

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| scheduleId | integer | 예 | 스케줄 ID |
| modelId | integer | 아니오 | AI 모델 ID |
| defectType | string | 예 | 결함 유형 |
| defectSizeWidth | number | 아니오 | 결함 가로 크기 (mm) |
| defectSizeHeight | number | 아니오 | 결함 세로 크기 (mm) |
| defectPositionX | number | 아니오 | X 좌표 (픽셀) |
| defectPositionY | number | 아니오 | Y 좌표 (픽셀) |
| defectPositionMeter | number | 아니오 | 코일 길이 방향 위치 (mm) |
| confidenceScore | number | 아니오 | 신뢰도 점수 (0.0-1.0) |
| imagePath | string | 아니오 | 이미지 경로 |
| detectionTime | string | 아니오 | 검출 시간 (ISO 8601) |

### 요청 예시
```http
POST /api/defects
Content-Type: application/json

{
  "scheduleId": 123,
  "modelId": 45,
  "defectType": "scratch",
  "defectSizeWidth": 15.5,
  "defectSizeHeight": 3.2,
  "defectPositionX": 120.0,
  "defectPositionY": 85.0,
  "defectPositionMeter": 1250.5,
  "confidenceScore": 0.95,
  "imagePath": "/images/labeled/1642234200000_labeled_image.jpg",
  "detectionTime": "2024-01-15T10:30:00Z"
}
```

### 응답 예시
```json
{
  "message": "결함 검출 결과가 성공적으로 저장되었습니다.",
  "data": {
    "id": 1001,
    "schedule_id": 123,
    "model_id": 45,
    "defect_type": "scratch",
    "defect_size_width": 15.5,
    "defect_size_height": 3.2,
    "defect_position_x": 120.0,
    "defect_position_y": 85.0,
    "defect_position_meter": 1250.5,
    "confidence_score": 0.95,
    "image_path": "/images/labeled/1642234200000_labeled_image.jpg",
    "detection_time": "2024-01-15T10:30:00Z",
    "created_at": "2024-01-15T10:30:05Z"
  }
}
```

---

## GET /defects/{id}

특정 결함 검출 결과의 상세 정보를 조회합니다.

### 경로 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| id | integer | 예 | 결함 검출 ID |

### 요청 예시
```http
GET /api/defects/1001
```

### 응답 예시
```json
{
  "data": {
    "id": 1001,
    "schedule_id": 123,
    "coil_id": "COIL_2024_001",
    "customer_name": "삼성전자",
    "model_id": 45,
    "model_name": "DefectNet_v2.1",
    "model_version": "2.1.0",
    "defect_type": "scratch",
    "defect_size_width": 15.5,
    "defect_size_height": 3.2,
    "defect_position_x": 120.0,
    "defect_position_y": 85.0,
    "defect_position_meter": 1250.5,
    "confidence_score": 0.95,
    "image_path": "/images/labeled/1642234200000_labeled_image.jpg",
    "image_file_size": 2048576,
    "detection_time": "2024-01-15T10:30:00Z",
    "created_at": "2024-01-15T10:30:05Z"
  }
}
```

---

## PUT /defects/{id}

결함 검출 결과 정보를 수정합니다.

### 경로 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| id | integer | 예 | 결함 검출 ID |

### 요청 본문

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| defectType | string | 아니오 | 결함 유형 |
| defectSizeWidth | number | 아니오 | 결함 가로 크기 (mm) |
| defectSizeHeight | number | 아니오 | 결함 세로 크기 (mm) |
| defectPositionX | number | 아니오 | X 좌표 (픽셀) |
| defectPositionY | number | 아니오 | Y 좌표 (픽셀) |
| defectPositionMeter | number | 아니오 | 코일 길이 방향 위치 (mm) |
| confidenceScore | number | 아니오 | 신뢰도 점수 (0.0-1.0) |

### 요청 예시
```http
PUT /api/defects/1001
Content-Type: application/json

{
  "defectType": "dent",
  "confidenceScore": 0.89
}
```

### 응답 예시
```json
{
  "message": "결함 검출 결과가 성공적으로 수정되었습니다.",
  "data": {
    "id": 1001,
    "defect_type": "dent",
    "confidence_score": 0.89,
    "updated_at": "2024-01-15T15:45:00Z"
  }
}
```

---

## DELETE /defects/{id}

결함 검출 결과를 삭제합니다.

### 경로 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| id | integer | 예 | 결함 검출 ID |

### 요청 예시
```http
DELETE /api/defects/1001
```

### 응답 예시
```json
{
  "message": "결함 검출 결과가 성공적으로 삭제되었습니다."
}
```

---

## 에러 응답

### 400 Bad Request
```json
{
  "error": "스케줄 ID와 결함 유형은 필수입니다.",
  "code": "VALIDATION_ERROR"
}
```

### 404 Not Found
```json
{
  "error": "결함 검출 결과를 찾을 수 없습니다.",
  "code": "NOT_FOUND"
}
```

### 422 Unprocessable Entity
```json
{
  "error": "신뢰도 점수는 0.0과 1.0 사이의 값이어야 합니다.",
  "code": "VALIDATION_ERROR"
}
```

---

## 사용 예시

### JavaScript
```javascript
// 결함 검출 결과 조회
const defects = await fetch('/api/defects?scheduleId=123&defectType=scratch')
  .then(res => res.json());

// 새 결함 검출 결과 저장
const newDefect = await fetch('/api/defects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scheduleId: 123,
    defectType: 'scratch',
    confidenceScore: 0.95,
    defectSizeWidth: 15.5,
    defectSizeHeight: 3.2
  })
}).then(res => res.json());

// 결함 정보 수정
const updated = await fetch('/api/defects/1001', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    defectType: 'dent',
    confidenceScore: 0.89
  })
}).then(res => res.json());
```

### Python
```python
import requests

# 결함 검출 결과 조회
response = requests.get('http://localhost:3000/api/defects', 
                       params={'scheduleId': 123, 'defectType': 'scratch'})
defects = response.json()

# 새 결함 검출 결과 저장
defect_data = {
    'scheduleId': 123,
    'defectType': 'scratch',
    'confidenceScore': 0.95,
    'defectSizeWidth': 15.5,
    'defectSizeHeight': 3.2
}

response = requests.post('http://localhost:3000/api/defects',
                        json=defect_data)
new_defect = response.json()
```

---

## 통계 및 분석

### 결함 유형별 통계
```http
GET /api/defects?groupBy=defectType&scheduleId=123
```

### 시간대별 결함 발생 현황
```http
GET /api/defects?startDate=2024-01-01&endDate=2024-01-31&groupBy=date
```

### 신뢰도 점수 분포
```http
GET /api/defects?minConfidence=0.8&maxConfidence=1.0&scheduleId=123
``` 