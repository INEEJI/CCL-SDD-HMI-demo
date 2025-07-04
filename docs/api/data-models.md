# 데이터 모델

CCL SDD 시스템에서 사용되는 데이터 모델들의 상세 명세입니다.

## 📊 주요 엔티티

### 1. Schedule (생산 스케줄)
```json
{
  "id": 1,
  "coil_id": "COIL_2024_001",
  "customer_id": 1,
  "customer_name": "삼성전자",
  "bom_id": 2,
  "status": "in_progress",
  "start_time": "2024-01-15T09:00:00Z",
  "end_time": "2024-01-15T17:00:00Z",
  "progress_percentage": 45,
  "created_at": "2024-01-14T10:00:00Z",
  "updated_at": "2024-01-15T14:30:00Z"
}
```

#### 필드 설명
| 필드 | 타입 | 설명 | 제약사항 |
|------|------|------|----------|
| id | integer | 스케줄 고유 ID | Primary Key, Auto Increment |
| coil_id | string | 코일 ID | Unique, 최대 50자 |
| customer_id | integer | 고객사 ID | Foreign Key |
| customer_name | string | 고객사 명 | 조인 결과 |
| bom_id | integer | BOM ID | Foreign Key, Nullable |
| status | string | 스케줄 상태 | scheduled, in_progress, completed, cancelled |
| start_time | string | 시작 시간 | ISO 8601 형식 |
| end_time | string | 종료 시간 | ISO 8601 형식 |
| progress_percentage | integer | 진행률 | 0-100 |
| created_at | string | 생성 시간 | ISO 8601 형식 |
| updated_at | string | 수정 시간 | ISO 8601 형식 |

---

### 2. DefectDetection (결함 검출 결과)
```json
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
  "image_path": "/images/labeled/1642234200000_labeled_image.jpg",
  "detection_time": "2024-01-15T10:30:00Z",
  "created_at": "2024-01-15T10:30:05Z"
}
```

#### 필드 설명
| 필드 | 타입 | 설명 | 제약사항 |
|------|------|------|----------|
| id | integer | 결함 검출 고유 ID | Primary Key, Auto Increment |
| schedule_id | integer | 스케줄 ID | Foreign Key |
| model_id | integer | AI 모델 ID | Foreign Key, Nullable |
| defect_type | string | 결함 유형 | 최대 50자 |
| defect_size_width | decimal | 결함 가로 크기 (mm) | 소수점 2자리 |
| defect_size_height | decimal | 결함 세로 크기 (mm) | 소수점 2자리 |
| defect_position_x | decimal | X 좌표 (픽셀) | 소수점 2자리 |
| defect_position_y | decimal | Y 좌표 (픽셀) | 소수점 2자리 |
| defect_position_meter | decimal | 코일 길이 방향 위치 (mm) | 소수점 2자리 |
| confidence_score | decimal | 신뢰도 점수 | 0.0-1.0, 소수점 4자리 |
| image_path | string | 이미지 경로 | 최대 255자 |
| detection_time | string | 검출 시간 | ISO 8601 형식 |
| created_at | string | 생성 시간 | ISO 8601 형식 |

#### 결함 유형 (defect_type)
| 값 | 설명 | 영문명 |
|----|------|--------|
| scratch | 스크래치 | Scratch |
| dent | 찌그러짐 | Dent |
| hole | 구멍 | Hole |
| stain | 얼룩 | Stain |
| crack | 균열 | Crack |
| bubble | 기포 | Bubble |
| wrinkle | 주름 | Wrinkle |
| edge_damage | 가장자리 손상 | Edge Damage |

---

### 3. AIModel (AI 모델)
```json
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
```

#### 필드 설명
| 필드 | 타입 | 설명 | 제약사항 |
|------|------|------|----------|
| id | integer | 모델 고유 ID | Primary Key, Auto Increment |
| model_name | string | 모델명 | 최대 100자 |
| version | string | 버전 | 최대 20자 |
| model_type | string | 모델 타입 | 최대 50자 |
| file_path | string | 파일 경로 | 최대 255자 |
| file_size | bigint | 파일 크기 (bytes) | |
| checksum | string | 체크섬 | 최대 64자 |
| description | text | 설명 | |
| is_active | boolean | 활성 상태 | 기본값: true |
| is_deployed | boolean | 배포 상태 | 기본값: false |
| accuracy_score | decimal | 정확도 점수 | 0.0-1.0, 소수점 4자리 |
| created_by | integer | 생성자 ID | Foreign Key |
| created_by_name | string | 생성자 명 | 조인 결과 |
| created_at | string | 생성 시간 | ISO 8601 형식 |
| updated_at | string | 수정 시간 | ISO 8601 형식 |

---

### 4. ImageFile (이미지 파일)
```json
{
  "id": 789,
  "original_filename": "labeled_coil_123_frame_001.jpg",
  "stored_filename": "1642234200000_labeled_coil_123_frame_001.jpg",
  "file_path": "/images/labeled/1642234200000_labeled_coil_123_frame_001.jpg",
  "file_size": 2048576,
  "mime_type": "image/jpeg",
  "schedule_id": 123,
  "defect_detection_id": 1001,
  "upload_time": "2024-01-15T10:30:00Z",
  "created_at": "2024-01-15T10:30:05Z"
}
```

#### 필드 설명
| 필드 | 타입 | 설명 | 제약사항 |
|------|------|------|----------|
| id | integer | 이미지 파일 고유 ID | Primary Key, Auto Increment |
| original_filename | string | 원본 파일명 | 최대 255자 |
| stored_filename | string | 저장된 파일명 | 최대 255자 |
| file_path | string | 파일 경로 | 최대 500자 |
| file_size | bigint | 파일 크기 (bytes) | |
| mime_type | string | MIME 타입 | 최대 100자 |
| schedule_id | integer | 스케줄 ID | Foreign Key |
| defect_detection_id | integer | 결함 검출 ID | Foreign Key, Nullable |
| upload_time | string | 업로드 시간 | ISO 8601 형식 |
| created_at | string | 생성 시간 | ISO 8601 형식 |

---

### 5. Customer (고객사)
```json
{
  "id": 1,
  "name": "삼성전자",
  "code": "SEC",
  "contact_person": "김철수",
  "contact_email": "kim@samsung.com",
  "contact_phone": "02-1234-5678",
  "address": "서울시 강남구",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 필드 설명
| 필드 | 타입 | 설명 | 제약사항 |
|------|------|------|----------|
| id | integer | 고객사 고유 ID | Primary Key, Auto Increment |
| name | string | 고객사명 | 최대 100자 |
| code | string | 고객사 코드 | Unique, 최대 20자 |
| contact_person | string | 담당자명 | 최대 50자 |
| contact_email | string | 담당자 이메일 | 최대 100자 |
| contact_phone | string | 담당자 전화번호 | 최대 20자 |
| address | text | 주소 | |
| is_active | boolean | 활성 상태 | 기본값: true |
| created_at | string | 생성 시간 | ISO 8601 형식 |
| updated_at | string | 수정 시간 | ISO 8601 형식 |

---

### 6. BOM (Bill of Materials)
```json
{
  "id": 2,
  "bom_id": "BOM_001",
  "customer_id": 1,
  "material_type": "강판",
  "thickness": 0.5,
  "width": 1200.0,
  "length": 2000.0,
  "specifications": "고장력 강판, 표면처리: 아연도금",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### 필드 설명
| 필드 | 타입 | 설명 | 제약사항 |
|------|------|------|----------|
| id | integer | BOM 고유 ID | Primary Key, Auto Increment |
| bom_id | string | BOM ID | Unique, 최대 50자 |
| customer_id | integer | 고객사 ID | Foreign Key |
| material_type | string | 소재 타입 | 최대 50자 |
| thickness | decimal | 두께 (mm) | 소수점 2자리 |
| width | decimal | 폭 (mm) | 소수점 2자리 |
| length | decimal | 길이 (mm) | 소수점 2자리 |
| specifications | text | 사양 | |
| is_active | boolean | 활성 상태 | 기본값: true |
| created_at | string | 생성 시간 | ISO 8601 형식 |
| updated_at | string | 수정 시간 | ISO 8601 형식 |

---

## 🔗 엔티티 관계도 (ERD)

```
customers (고객사)
    ↓ 1:N
schedules (생산 스케줄) ← boms (BOM)
    ↓ 1:N                    ↑ N:1
defect_detections (결함 검출) ← ai_models (AI 모델)
    ↓ 1:1                    ↑ N:1
image_files (이미지 파일)     users (사용자)
```

### 관계 설명
- **Customer → Schedule**: 한 고객사는 여러 스케줄을 가질 수 있음
- **BOM → Schedule**: 한 BOM은 여러 스케줄에서 사용될 수 있음
- **Schedule → DefectDetection**: 한 스케줄에서 여러 결함이 검출될 수 있음
- **AIModel → DefectDetection**: 한 모델이 여러 결함을 검출할 수 있음
- **DefectDetection → ImageFile**: 한 결함 검출에 하나의 라벨링된 이미지가 연결됨
- **User → AIModel**: 한 사용자가 여러 모델을 생성할 수 있음

---

## 📝 API 요청/응답 공통 형식

### 페이지네이션 응답
```json
{
  "data": [...],
  "totalCount": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

### 에러 응답
```json
{
  "error": "에러 메시지",
  "code": "ERROR_CODE",
  "details": {
    "field": "필드명",
    "message": "상세 에러 메시지"
  }
}
```

### 성공 응답 (생성/수정)
```json
{
  "message": "성공 메시지",
  "data": { ... }
}
```

---

## 🎯 데이터 검증 규칙

### 1. 스케줄 (Schedule)
- `coil_id`: 필수, 고유값, 영숫자와 언더스코어만 허용
- `customer_id`: 필수, 존재하는 고객사 ID
- `status`: 정의된 상태값만 허용
- `progress_percentage`: 0-100 범위

### 2. 결함 검출 (DefectDetection)
- `schedule_id`: 필수, 존재하는 스케줄 ID
- `defect_type`: 필수, 정의된 결함 유형만 허용
- `confidence_score`: 0.0-1.0 범위
- `defect_position_*`: 음수 불허

### 3. AI 모델 (AIModel)
- `model_name` + `version`: 조합으로 고유값
- `file_path`: 필수, 유효한 파일 경로
- `accuracy_score`: 0.0-1.0 범위

### 4. 이미지 파일 (ImageFile)
- `file_size`: 최대 10MB (10,485,760 bytes)
- `mime_type`: image/jpeg, image/png만 허용
- `file_path`: 유효한 파일 경로

---

## 📊 인덱스 전략

### 성능 최적화를 위한 인덱스
- `schedules.coil_id`: 고유 인덱스
- `schedules.status`: 상태별 조회 최적화
- `defect_detections.schedule_id`: 스케줄별 결함 조회
- `defect_detections.detection_time`: 시간순 정렬
- `defect_detections.defect_type`: 결함 유형별 필터링
- `image_files.schedule_id`: 스케줄별 이미지 조회

---

## 🔄 데이터 생명주기

### 1. 스케줄 생성 → 진행 → 완료
```
scheduled → in_progress → completed
         ↘ cancelled
```

### 2. AI 모델 등록 → 배포 → 사용
```
등록 (is_active: true, is_deployed: false)
  ↓
배포 (is_deployed: true)
  ↓
결함 검출에 사용
```

### 3. 결함 검출 플로우
```
AI 모델 서버에서 검출
  ↓
/api/ai-results로 전송
  ↓
DefectDetection + ImageFile 생성
  ↓
웹 인터페이스에서 확인
``` 