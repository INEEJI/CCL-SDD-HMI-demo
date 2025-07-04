# AI 모델 서버 통합 가이드

이 문서는 외부 AI 모델 서버와 CCL SDD 시스템 간의 통신 방법을 설명합니다.

## 🔄 통신 플로우

```
AI 모델 서버 → CCL SDD 시스템 → 데이터베이스/스토리지
```

## 📡 API 엔드포인트

### 1. 결함 검출 결과 전송
**POST** `/api/ai-results`

AI 모델 서버에서 결함 검출이 완료되면 이 엔드포인트로 결과를 전송합니다.

#### 요청 예시
```json
{
  "scheduleId": 123,
  "modelId": 45,
  "originalImagePath": "/path/to/original/image.jpg",
  "labeledImageBase64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "labeledImageFilename": "labeled_image.jpg",
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

#### 응답 예시
```json
{
  "message": "결함 검출 결과가 성공적으로 저장되었습니다.",
  "data": {
    "imageFileId": 789,
    "detections": [
      {
        "id": 1001,
        "defect_type": "scratch",
        "confidence_score": 0.95,
        "detection_time": "2024-01-15T10:30:00Z"
      }
    ],
    "labeledImagePath": "/images/labeled/1642234200000_labeled_image.jpg"
  }
}
```

## 🎯 데이터 구조

### 입력 데이터 (AI 모델 → CCL SDD)
- **scheduleId**: 생산 스케줄 ID
- **modelId**: 사용된 AI 모델 ID
- **originalImagePath**: 원본 이미지 경로
- **labeledImageBase64**: 라벨링된 이미지 (Base64 인코딩)
- **labeledImageFilename**: 라벨링된 이미지 파일명
- **detections**: 검출된 결함 목록

### 결함 검출 정보
- **defectType**: 결함 유형 (scratch, dent, hole, stain 등)
- **defectSizeWidth**: 결함 가로 크기 (mm)
- **defectSizeHeight**: 결함 세로 크기 (mm)
- **defectPositionX**: X 좌표 (픽셀)
- **defectPositionY**: Y 좌표 (픽셀)
- **defectPositionMeter**: 코일 길이 방향 위치 (mm)
- **confidenceScore**: 신뢰도 점수 (0.0-1.0)
- **detectionTime**: 검출 시간 (ISO 8601 형식)

## 🔧 구현 예시

### Python (AI 모델 서버)
```python
import requests
import base64
import json
from datetime import datetime

def send_detection_results(schedule_id, model_id, detections, labeled_image_path):
    """결함 검출 결과를 CCL SDD 시스템으로 전송"""
    
    # 라벨링된 이미지를 Base64로 인코딩
    with open(labeled_image_path, 'rb') as image_file:
        image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
    
    payload = {
        "scheduleId": schedule_id,
        "modelId": model_id,
        "labeledImageBase64": image_base64,
        "labeledImageFilename": f"labeled_{schedule_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg",
        "detections": detections
    }
    
    response = requests.post(
        "http://ccl-sdd-system:3000/api/ai-results",
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 201:
        print("결함 검출 결과 전송 성공")
        return response.json()
    else:
        print(f"전송 실패: {response.status_code} - {response.text}")
        return None

# 사용 예시
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

send_detection_results(123, 45, detections, "/path/to/labeled_image.jpg")
```

### Node.js (AI 모델 서버)
```javascript
const fs = require('fs');
const axios = require('axios');

async function sendDetectionResults(scheduleId, modelId, detections, labeledImagePath) {
    try {
        // 라벨링된 이미지를 Base64로 인코딩
        const imageBuffer = fs.readFileSync(labeledImagePath);
        const imageBase64 = imageBuffer.toString('base64');
        
        const payload = {
            scheduleId,
            modelId,
            labeledImageBase64: imageBase64,
            labeledImageFilename: `labeled_${scheduleId}_${Date.now()}.jpg`,
            detections
        };
        
        const response = await axios.post(
            'http://ccl-sdd-system:3000/api/ai-results',
            payload,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('결함 검출 결과 전송 성공:', response.data);
        return response.data;
    } catch (error) {
        console.error('전송 실패:', error.response?.data || error.message);
        return null;
    }
}
```

## 🛡️ 보안 고려사항

### 1. API 인증
- 향후 API 키 또는 JWT 토큰 기반 인증 구현 예정
- 현재는 내부 네트워크 통신으로 가정

### 2. 데이터 검증
- 모든 입력 데이터에 대한 유효성 검사 수행
- 이미지 파일 크기 및 형식 제한

### 3. 에러 처리
- 네트워크 오류 시 재시도 로직 구현
- 실패한 요청에 대한 로깅 및 알림

## 📊 모니터링

### 성능 지표
- API 응답 시간
- 처리된 이미지 수
- 검출된 결함 수
- 에러 발생률

### 로그 수집
- 모든 API 호출 로그 기록
- 결함 검출 결과 통계
- 시스템 리소스 사용량

## 🔄 향후 확장

### 1. 실시간 스트리밍
- WebSocket 기반 실시간 결과 전송
- 대용량 이미지 처리 최적화

### 2. 배치 처리
- 다중 이미지 일괄 처리
- 비동기 처리 큐 시스템

### 3. 모델 관리
- 자동 모델 업데이트
- A/B 테스트 지원
- 성능 모니터링 및 알림 