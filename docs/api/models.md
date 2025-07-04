# AI 모델 관리 API

AI 모델의 등록, 관리, 배포를 위한 API 엔드포인트입니다.

## 📋 엔드포인트 목록

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | `/models` | 모델 목록 조회 |
| POST | `/models` | 새 모델 등록 |
| GET | `/models/{id}` | 모델 상세 조회 |
| PUT | `/models/{id}` | 모델 정보 수정 |
| DELETE | `/models/{id}` | 모델 삭제 |
| PUT | `/models/{id}/deploy` | 모델 배포/해제 |
| GET | `/models/{id}/deploy` | 모델 배포 상태 조회 |

---

## GET /models

AI 모델 목록을 조회합니다.

### 요청 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| page | integer | 아니오 | 1 | 페이지 번호 |
| limit | integer | 아니오 | 10 | 페이지 크기 (최대 100) |
| isActive | boolean | 아니오 | - | 활성 상태 필터 |
| isDeployed | boolean | 아니오 | - | 배포 상태 필터 |
| modelType | string | 아니오 | - | 모델 타입 필터 |

### 요청 예시
```http
GET /api/models?isActive=true&isDeployed=true&page=1&limit=10
```

### 응답 예시
```json
{
  "data": [
    {
      "id": 45,
      "model_name": "DefectNet_v2.1",
      "version": "2.1.0",
      "model_type": "CNN",
      "file_path": "/models/defectnet_v2.1.pth",
      "file_size": 524288000,
      "checksum": "a1b2c3d4e5f6...",
      "description": "고성능 결함 검출 모델",
      "is_active": true,
      "is_deployed": true,
      "accuracy_score": 0.9542,
      "created_by": 1,
      "created_by_name": "admin",
      "created_at": "2024-01-10T09:00:00Z",
      "updated_at": "2024-01-15T14:30:00Z"
    }
  ],
  "totalCount": 8,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

---

## POST /models

새로운 AI 모델을 등록합니다.

### 요청 본문

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| modelName | string | 예 | 모델명 (최대 100자) |
| version | string | 예 | 버전 (최대 20자) |
| modelType | string | 아니오 | 모델 타입 (CNN, RNN, Transformer 등) |
| filePath | string | 예 | 모델 파일 경로 |
| fileSize | integer | 아니오 | 파일 크기 (bytes) |
| checksum | string | 아니오 | 파일 체크섬 |
| description | string | 아니오 | 모델 설명 |
| accuracyScore | number | 아니오 | 정확도 점수 (0.0-1.0) |
| createdBy | integer | 예 | 생성자 사용자 ID |

### 요청 예시
```http
POST /api/models
Content-Type: application/json

{
  "modelName": "DefectNet_v2.2",
  "version": "2.2.0",
  "modelType": "CNN",
  "filePath": "/models/defectnet_v2.2.pth",
  "fileSize": 528482304,
  "checksum": "b2c3d4e5f6a7...",
  "description": "개선된 결함 검출 모델 - 정확도 향상",
  "accuracyScore": 0.9687,
  "createdBy": 1
}
```

### 응답 예시
```json
{
  "message": "AI 모델이 성공적으로 등록되었습니다.",
  "data": {
    "id": 46,
    "model_name": "DefectNet_v2.2",
    "version": "2.2.0",
    "model_type": "CNN",
    "file_path": "/models/defectnet_v2.2.pth",
    "file_size": 528482304,
    "checksum": "b2c3d4e5f6a7...",
    "description": "개선된 결함 검출 모델 - 정확도 향상",
    "is_active": true,
    "is_deployed": false,
    "accuracy_score": 0.9687,
    "created_by": 1,
    "created_at": "2024-01-16T10:00:00Z",
    "updated_at": "2024-01-16T10:00:00Z"
  }
}
```

---

## GET /models/{id}

특정 AI 모델의 상세 정보를 조회합니다.

### 경로 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| id | integer | 예 | 모델 ID |

### 요청 예시
```http
GET /api/models/45
```

### 응답 예시
```json
{
  "data": {
    "id": 45,
    "model_name": "DefectNet_v2.1",
    "version": "2.1.0",
    "model_type": "CNN",
    "file_path": "/models/defectnet_v2.1.pth",
    "file_size": 524288000,
    "checksum": "a1b2c3d4e5f6...",
    "description": "고성능 결함 검출 모델",
    "is_active": true,
    "is_deployed": true,
    "accuracy_score": 0.9542,
    "created_by": 1,
    "created_by_name": "admin",
    "created_at": "2024-01-10T09:00:00Z",
    "updated_at": "2024-01-15T14:30:00Z",
    "usage_count": 1247,
    "last_used_at": "2024-01-15T16:45:00Z"
  }
}
```

---

## PUT /models/{id}

AI 모델 정보를 수정합니다.

### 경로 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| id | integer | 예 | 모델 ID |

### 요청 본문

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| modelName | string | 아니오 | 모델명 |
| version | string | 아니오 | 버전 |
| modelType | string | 아니오 | 모델 타입 |
| description | string | 아니오 | 모델 설명 |
| accuracyScore | number | 아니오 | 정확도 점수 |
| isActive | boolean | 아니오 | 활성 상태 |

### 요청 예시
```http
PUT /api/models/45
Content-Type: application/json

{
  "description": "고성능 결함 검출 모델 - 성능 검증 완료",
  "accuracyScore": 0.9589,
  "isActive": true
}
```

### 응답 예시
```json
{
  "message": "AI 모델 정보가 성공적으로 수정되었습니다.",
  "data": {
    "id": 45,
    "model_name": "DefectNet_v2.1",
    "description": "고성능 결함 검출 모델 - 성능 검증 완료",
    "accuracy_score": 0.9589,
    "is_active": true,
    "updated_at": "2024-01-16T11:30:00Z"
  }
}
```

---

## DELETE /models/{id}

AI 모델을 삭제합니다.

### 경로 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| id | integer | 예 | 모델 ID |

### 요청 예시
```http
DELETE /api/models/46
```

### 응답 예시
```json
{
  "message": "AI 모델이 성공적으로 삭제되었습니다."
}
```

---

## PUT /models/{id}/deploy

AI 모델을 배포하거나 배포를 해제합니다.

### 경로 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| id | integer | 예 | 모델 ID |

### 요청 본문

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| deploy | boolean | 예 | 배포 여부 (true: 배포, false: 해제) |

### 요청 예시 - 배포
```http
PUT /api/models/46/deploy
Content-Type: application/json

{
  "deploy": true
}
```

### 응답 예시 - 배포 성공
```json
{
  "message": "AI 모델이 성공적으로 배포되었습니다.",
  "data": {
    "id": 46,
    "model_name": "DefectNet_v2.2",
    "version": "2.2.0",
    "is_deployed": true,
    "deployed_at": "2024-01-16T12:00:00Z"
  }
}
```

### 요청 예시 - 배포 해제
```http
PUT /api/models/45/deploy
Content-Type: application/json

{
  "deploy": false
}
```

### 응답 예시 - 배포 해제 성공
```json
{
  "message": "AI 모델 배포가 성공적으로 해제되었습니다.",
  "data": {
    "id": 45,
    "model_name": "DefectNet_v2.1",
    "version": "2.1.0",
    "is_deployed": false,
    "undeployed_at": "2024-01-16T12:00:00Z"
  }
}
```

---

## GET /models/{id}/deploy

AI 모델의 배포 상태를 조회합니다.

### 경로 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| id | integer | 예 | 모델 ID |

### 요청 예시
```http
GET /api/models/46/deploy
```

### 응답 예시
```json
{
  "data": {
    "id": 46,
    "model_name": "DefectNet_v2.2",
    "version": "2.2.0",
    "is_deployed": true,
    "deployed_at": "2024-01-16T12:00:00Z",
    "deployment_status": "active",
    "usage_count_since_deploy": 45,
    "last_used_at": "2024-01-16T15:30:00Z"
  }
}
```

---

## 에러 응답

### 400 Bad Request - 필수 필드 누락
```json
{
  "error": "모델명, 버전, 파일 경로는 필수입니다.",
  "code": "VALIDATION_ERROR"
}
```

### 404 Not Found - 존재하지 않는 모델
```json
{
  "error": "AI 모델을 찾을 수 없습니다.",
  "code": "NOT_FOUND"
}
```

### 409 Conflict - 중복 모델
```json
{
  "error": "동일한 모델명과 버전이 이미 존재합니다.",
  "code": "CONFLICT"
}
```

### 409 Conflict - 배포 중인 모델 삭제 시도
```json
{
  "error": "배포 중인 모델은 삭제할 수 없습니다. 먼저 배포를 해제해주세요.",
  "code": "CONFLICT"
}
```

### 409 Conflict - 다중 배포 시도
```json
{
  "error": "이미 다른 모델이 배포 중입니다. 먼저 기존 모델의 배포를 해제해주세요.",
  "code": "CONFLICT"
}
```

---

## 사용 예시

### JavaScript
```javascript
// 모델 목록 조회
const models = await fetch('/api/models?isActive=true')
  .then(res => res.json());

// 새 모델 등록
const newModel = await fetch('/api/models', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    modelName: 'DefectNet_v2.3',
    version: '2.3.0',
    modelType: 'CNN',
    filePath: '/models/defectnet_v2.3.pth',
    fileSize: 532676608,
    accuracyScore: 0.9724,
    createdBy: 1
  })
}).then(res => res.json());

// 모델 배포
const deployResult = await fetch('/api/models/46/deploy', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ deploy: true })
}).then(res => res.json());

// 배포 상태 확인
const deployStatus = await fetch('/api/models/46/deploy')
  .then(res => res.json());
```

### Python
```python
import requests

# 모델 목록 조회
response = requests.get('http://localhost:3000/api/models', 
                       params={'isActive': True})
models = response.json()

# 새 모델 등록
model_data = {
    'modelName': 'DefectNet_v2.3',
    'version': '2.3.0',
    'modelType': 'CNN',
    'filePath': '/models/defectnet_v2.3.pth',
    'fileSize': 532676608,
    'accuracyScore': 0.9724,
    'createdBy': 1
}

response = requests.post('http://localhost:3000/api/models',
                        json=model_data)
new_model = response.json()

# 모델 배포
deploy_data = {'deploy': True}
response = requests.put('http://localhost:3000/api/models/46/deploy',
                       json=deploy_data)
deploy_result = response.json()
```

---

## 모델 생명주기 관리

### 1. 모델 등록 → 검증 → 배포
```
등록 (is_active: true, is_deployed: false)
  ↓
성능 검증 및 테스트
  ↓
배포 (is_deployed: true)
  ↓
운영 환경에서 사용
```

### 2. 모델 버전 관리
- 동일한 모델명에 대해 여러 버전 관리
- 배포는 한 번에 하나의 모델만 가능
- 새 버전 배포 시 기존 버전 자동 해제

### 3. 모델 성능 추적
- 사용 횟수 (usage_count)
- 마지막 사용 시간 (last_used_at)
- 정확도 점수 (accuracy_score)

---

## 배포 전략

### 1. Blue-Green 배포
```
1. 새 모델 등록
2. 성능 검증
3. 기존 모델 배포 해제
4. 새 모델 배포
5. 모니터링
```

### 2. 롤백 전략
```
1. 문제 발생 시 즉시 배포 해제
2. 이전 안정 버전으로 복구
3. 문제 분석 후 재배포
``` 