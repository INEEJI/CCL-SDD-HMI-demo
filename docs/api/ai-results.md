# AI 결과 수신 API

외부 AI 모델 서버로부터 결함 검출 결과를 수신하는 핵심 API입니다.

## 📋 엔드포인트 목록

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| POST | `/ai-results` | AI 결함 검출 결과 수신 |
| GET | `/ai-results` | AI 처리 결과 조회 |

---

## POST /ai-results

**⭐ 핵심 API**: AI 모델 서버에서 결함 검출이 완료되면 이 엔드포인트로 결과를 전송합니다.

### 요청 본문

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| scheduleId | integer | 예 | 생산 스케줄 ID |
| modelId | integer | 아니오 | 사용된 AI 모델 ID |
| originalImagePath | string | 아니오 | 원본 이미지 경로 |
| labeledImageBase64 | string | 아니오 | 라벨링된 이미지 (Base64 인코딩) |
| labeledImageFilename | string | 아니오 | 라벨링된 이미지 파일명 |
| detections | array | 예 | 결함 검출 결과 배열 |

#### detections 배열 요소

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| defectType | string | 예 | 결함 유형 |
| defectSizeWidth | number | 아니오 | 결함 가로 크기 (mm) |
| defectSizeHeight | number | 아니오 | 결함 세로 크기 (mm) |
| defectPositionX | number | 아니오 | X 좌표 (픽셀) |
| defectPositionY | number | 아니오 | Y 좌표 (픽셀) |
| defectPositionMeter | number | 아니오 | 코일 길이 방향 위치 (mm) |
| confidenceScore | number | 아니오 | 신뢰도 점수 (0.0-1.0) |
| detectionTime | string | 아니오 | 검출 시간 (ISO 8601) |

#### 지원하는 결함 유형 (defectType)
- `scratch`: 스크래치
- `dent`: 찌그러짐
- `hole`: 구멍
- `stain`: 얼룩
- `crack`: 균열
- `bubble`: 기포
- `wrinkle`: 주름
- `edge_damage`: 가장자리 손상

### 요청 예시

#### 단일 결함 검출
```http
POST /api/ai-results
Content-Type: application/json

{
  "scheduleId": 123,
  "modelId": 45,
  "originalImagePath": "/input/images/coil_123_frame_001.jpg",
  "labeledImageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "labeledImageFilename": "labeled_coil_123_frame_001.jpg",
  "detections": [
    {
      "defectType": "scratch",
      "defectSizeWidth": 15.5,
      "defectSizeHeight": 3.2,
      "defectPositionX": 120.0,
      "defectPositionY": 85.0,
      "defectPositionMeter": 1250.5,
      "confidenceScore": 0.95,
      "detectionTime": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### 다중 결함 검출
```http
POST /api/ai-results
Content-Type: application/json

{
  "scheduleId": 124,
  "modelId": 45,
  "labeledImageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "labeledImageFilename": "labeled_coil_124_frame_002.jpg",
  "detections": [
    {
      "defectType": "scratch",
      "defectSizeWidth": 15.5,
      "defectSizeHeight": 3.2,
      "defectPositionX": 120.0,
      "defectPositionY": 85.0,
      "defectPositionMeter": 1250.5,
      "confidenceScore": 0.95,
      "detectionTime": "2024-01-15T10:30:00Z"
    },
    {
      "defectType": "dent",
      "defectSizeWidth": 8.0,
      "defectSizeHeight": 8.0,
      "defectPositionX": 200.0,
      "defectPositionY": 150.0,
      "defectPositionMeter": 1250.5,
      "confidenceScore": 0.87,
      "detectionTime": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### 응답 예시

#### 성공 응답 (201 Created)
```json
{
  "message": "결함 검출 결과가 성공적으로 저장되었습니다.",
  "data": {
    "imageFileId": 789,
    "detections": [
      {
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
        "detection_time": "2024-01-15T10:30:00Z",
        "image_path": "/images/labeled/1642234200000_labeled_coil_123_frame_001.jpg",
        "created_at": "2024-01-15T10:30:05Z"
      }
    ],
    "labeledImagePath": "/images/labeled/1642234200000_labeled_coil_123_frame_001.jpg"
  }
}
```

---

## GET /ai-results

AI 모델 처리 결과를 조회합니다.

### 요청 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| scheduleId | integer | 아니오 | - | 스케줄 ID 필터 |
| modelId | integer | 아니오 | - | 모델 ID 필터 |
| limit | integer | 아니오 | 10 | 결과 개수 제한 |

### 요청 예시
```http
GET /api/ai-results?scheduleId=123&limit=5
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
      "version": "2.1.0",
      "defect_type": "scratch",
      "defect_size_width": 15.5,
      "defect_size_height": 3.2,
      "defect_position_x": 120.0,
      "defect_position_y": 85.0,
      "defect_position_meter": 1250.5,
      "confidence_score": 0.95,
      "image_path": "/images/labeled/1642234200000_labeled_coil_123_frame_001.jpg",
      "original_filename": "labeled_coil_123_frame_001.jpg",
      "detection_time": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-15T10:30:05Z"
    }
  ],
  "count": 1
}
```

---

## 에러 응답

### 400 Bad Request - 필수 필드 누락
```json
{
  "error": "스케줄 ID와 결함 검출 결과는 필수입니다.",
  "code": "VALIDATION_ERROR"
}
```

### 400 Bad Request - 잘못된 데이터 형식
```json
{
  "error": "detections는 배열이어야 합니다.",
  "code": "VALIDATION_ERROR"
}
```

### 404 Not Found - 존재하지 않는 스케줄
```json
{
  "error": "해당 스케줄을 찾을 수 없습니다.",
  "code": "NOT_FOUND"
}
```

### 413 Payload Too Large - 이미지 크기 초과
```json
{
  "error": "이미지 파일 크기가 너무 큽니다. (최대 10MB)",
  "code": "PAYLOAD_TOO_LARGE"
}
```

### 500 Internal Server Error - 서버 오류
```json
{
  "error": "AI 결과 저장 중 오류가 발생했습니다.",
  "code": "INTERNAL_ERROR"
}
```

---

## 구현 예시

### Python (AI 모델 서버)
```python
import requests
import base64
import json
from datetime import datetime

class CCLSDDClient:
    def __init__(self, base_url="http://localhost:3000/api"):
        self.base_url = base_url
    
    def send_detection_results(self, schedule_id, model_id, detections, labeled_image_path=None):
        """결함 검출 결과를 CCL SDD 시스템으로 전송"""
        
        payload = {
            "scheduleId": schedule_id,
            "modelId": model_id,
            "detections": detections
        }
        
        # 라벨링된 이미지가 있는 경우 Base64로 인코딩
        if labeled_image_path:
            try:
                with open(labeled_image_path, 'rb') as image_file:
                    image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
                    payload["labeledImageBase64"] = image_base64
                    payload["labeledImageFilename"] = f"labeled_{schedule_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            except Exception as e:
                print(f"이미지 인코딩 실패: {e}")
        
        try:
            response = requests.post(
                f"{self.base_url}/ai-results",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 201:
                print("결함 검출 결과 전송 성공")
                return response.json()
            else:
                print(f"전송 실패: {response.status_code} - {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"네트워크 오류: {e}")
            return None

# 사용 예시
client = CCLSDDClient()

# 단일 결함 전송
detections = [
    {
        "defectType": "scratch",
        "defectSizeWidth": 15.5,
        "defectSizeHeight": 3.2,
        "defectPositionX": 120.0,
        "defectPositionY": 85.0,
        "defectPositionMeter": 1250.5,
        "confidenceScore": 0.95,
        "detectionTime": datetime.now().isoformat()
    }
]

result = client.send_detection_results(
    schedule_id=123,
    model_id=45,
    detections=detections,
    labeled_image_path="/path/to/labeled_image.jpg"
)

# 다중 결함 전송
multi_detections = [
    {
        "defectType": "scratch",
        "defectSizeWidth": 15.5,
        "defectSizeHeight": 3.2,
        "defectPositionX": 120.0,
        "defectPositionY": 85.0,
        "defectPositionMeter": 1250.5,
        "confidenceScore": 0.95,
        "detectionTime": datetime.now().isoformat()
    },
    {
        "defectType": "dent",
        "defectSizeWidth": 8.0,
        "defectSizeHeight": 8.0,
        "defectPositionX": 200.0,
        "defectPositionY": 150.0,
        "defectPositionMeter": 1250.5,
        "confidenceScore": 0.87,
        "detectionTime": datetime.now().isoformat()
    }
]

result = client.send_detection_results(
    schedule_id=124,
    model_id=45,
    detections=multi_detections,
    labeled_image_path="/path/to/multi_labeled_image.jpg"
)
```

### Node.js (AI 모델 서버)
```javascript
const axios = require('axios');
const fs = require('fs').promises;

class CCLSDDClient {
    constructor(baseUrl = 'http://localhost:3000/api') {
        this.baseUrl = baseUrl;
    }
    
    async sendDetectionResults(scheduleId, modelId, detections, labeledImagePath = null) {
        try {
            const payload = {
                scheduleId,
                modelId,
                detections
            };
            
            // 라벨링된 이미지가 있는 경우 Base64로 인코딩
            if (labeledImagePath) {
                try {
                    const imageBuffer = await fs.readFile(labeledImagePath);
                    const imageBase64 = imageBuffer.toString('base64');
                    payload.labeledImageBase64 = imageBase64;
                    payload.labeledImageFilename = `labeled_${scheduleId}_${Date.now()}.jpg`;
                } catch (error) {
                    console.error('이미지 인코딩 실패:', error);
                }
            }
            
            const response = await axios.post(
                `${this.baseUrl}/ai-results`,
                payload,
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000
                }
            );
            
            console.log('결함 검출 결과 전송 성공:', response.data);
            return response.data;
            
        } catch (error) {
            if (error.response) {
                console.error('전송 실패:', error.response.status, error.response.data);
            } else {
                console.error('네트워크 오류:', error.message);
            }
            return null;
        }
    }
}

// 사용 예시
const client = new CCLSDDClient();

const detections = [
    {
        defectType: 'scratch',
        defectSizeWidth: 15.5,
        defectSizeHeight: 3.2,
        defectPositionX: 120.0,
        defectPositionY: 85.0,
        defectPositionMeter: 1250.5,
        confidenceScore: 0.95,
        detectionTime: new Date().toISOString()
    }
];

client.sendDetectionResults(123, 45, detections, '/path/to/labeled_image.jpg');
```

---

## 데이터 처리 플로우

```
1. AI 모델 서버에서 이미지 분석 완료
2. 결함 검출 결과 + 라벨링된 이미지 준비
3. POST /api/ai-results 호출
4. CCL SDD 시스템에서 데이터 검증
5. 라벨링된 이미지를 파일 시스템에 저장
6. 결함 검출 결과를 데이터베이스에 저장
7. 이미지 파일 정보를 데이터베이스에 저장
8. 성공 응답 반환
```

---

## 중요 고려사항

### 1. 이미지 처리
- **최대 파일 크기**: 10MB
- **지원 형식**: JPEG, PNG
- **Base64 인코딩 필수**
- **파일명 자동 생성**: `timestamp_filename` 형식

### 2. 트랜잭션 안전성
- 모든 데이터 저장이 트랜잭션으로 처리됨
- 실패 시 모든 변경사항 롤백
- 데이터 일관성 보장

### 3. 성능 최적화
- 비동기 이미지 저장
- 데이터베이스 연결 풀 사용
- 적절한 타임아웃 설정

### 4. 에러 처리
- 상세한 에러 메시지 제공
- 재시도 가능한 오류 구분
- 로그 기록 및 모니터링 