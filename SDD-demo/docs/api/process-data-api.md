# 공정데이터 API 문서

## 개요
CCL SDD 시스템의 공정데이터 관리를 위한 API입니다. 동국씨엠 MES에서 수신되는 TC Code 기반 데이터를 처리합니다.

## 데이터 구조

### TC Code 분류
- **TC 4000**: 스케줄 정보 (스케줄 이벤트 발생시)
- **TC 4001**: 출측 CUT 정보
- **TC 4002**: WPD pass 정보
- **TC 4003**: Line speed (3초 주기)

### 주요 연결키
- `coil_number`: 모든 공정데이터와 결함검출 결과를 연결하는 주요 키

## API 엔드포인트

### 1. 공정데이터 통합 조회
**GET** `/api/process-data`

공정데이터를 통합 조회합니다. 코일번호를 기준으로 모든 관련 정보를 조합하여 반환합니다.

#### 요청 파라미터
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `coil_number` | string | 아니오 | 코일번호 (부분 검색 가능) |
| `customer_name` | string | 아니오 | 고객사명 (부분 검색 가능) |
| `date_from` | string | 아니오 | 시작일 (YYYYMMDD) |
| `date_to` | string | 아니오 | 종료일 (YYYYMMDD) |
| `page` | number | 아니오 | 페이지 번호 (기본값: 1) |
| `limit` | number | 아니오 | 페이지 크기 (기본값: 20) |

#### 응답 예시
```json
{
  "success": true,
  "data": [
    {
      "coil_number": "H477707",
      "customer_name": "이알텍㈜",
      "ccl_bom": "H7850B",
      "material_code": "F37EA4M-49RE6A",
      "thickness": 0.372,
      "width": 1212,
      "weight": 7950,
      "length_value": 3449,
      "product_group": "3",
      "mo_number": "C401005",
      "through_plate": "Z",
      "sequence_order": 1,
      "schedule_date": "20250703",
      "schedule_time": "152906",
      "schedule_created_at": "2025-07-03T15:29:06.000Z",
      "cut_mode": 0,
      "winding_length": 3559,
      "cut_date": "20250703",
      "cut_time": "153046",
      "cut_created_at": "2025-07-03T15:30:46.000Z",
      "wpd_date": "20250703",
      "wpd_time": "153222",
      "wpd_created_at": "2025-07-03T15:32:22.000Z",
      "line_speed": 75,
      "speed_updated_at": "2025-07-03T15:32:54.000Z",
      "defect_count": 2,
      "defect_types": "scratch, dent"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 10,
    "totalPages": 1
  }
}
```

### 2. 특정 코일 상세 정보 조회
**POST** `/api/process-data`

특정 코일의 모든 히스토리 정보를 상세 조회합니다.

#### 요청 본문
```json
{
  "coil_number": "H477707"
}
```

#### 응답 예시
```json
{
  "success": true,
  "data": {
    "schedule": {
      "coil_number": "H477707",
      "customer_name": "이알텍㈜",
      "ccl_bom": "H7850B",
      "material_code": "F37EA4M-49RE6A",
      "thickness": 0.372,
      "width": 1212,
      "weight": 7950,
      "length_value": 3449,
      "product_group": "3",
      "mo_number": "C401005",
      "through_plate": "Z",
      "sequence_order": 1,
      "date": "20250703",
      "time": "152906",
      "created_at": "2025-07-03T15:29:06.000Z"
    },
    "cut_history": [
      {
        "coil_number": "H477707",
        "cut_mode": 0,
        "winding_length": 3559,
        "date": "20250703",
        "time": "153046",
        "created_at": "2025-07-03T15:30:46.000Z"
      }
    ],
    "wpd_history": [
      {
        "coil_number": "H477707",
        "date": "20250703",
        "time": "153222",
        "created_at": "2025-07-03T15:32:22.000Z"
      }
    ],
    "defects": [
      {
        "id": 1,
        "coil_number": "H477707",
        "defect_type": "scratch",
        "defect_position_x": 245,
        "defect_position_y": 156,
        "defect_position_meter": 125.5,
        "defect_size_width": 12,
        "defect_size_height": 8,
        "confidence_score": 0.9234,
        "detection_time": "2025-07-03T15:32:15.000Z",
        "original_image_path": "/var/lib/ccl-images/original/H477707_001.jpg",
        "labeled_image_path": "/var/lib/ccl-images/labeled/H477707_001_labeled.jpg",
        "model_name": "DefectDetectionModel",
        "model_version": "v1.0"
      }
    ],
    "speed_history": [
      {
        "line_speed": 75,
        "date": "20250703",
        "time": "153254",
        "created_at": "2025-07-03T15:32:54.000Z"
      }
    ]
  }
}
```

## 데이터 필드 설명

### TC 4000 (스케줄 정보)
| 필드 | 타입 | 설명 |
|------|------|------|
| `coil_number` | string | 코일번호 (주요 연결키) |
| `customer_name` | string | 수요가명 (고객사명) |
| `ccl_bom` | string | CCL-BOM |
| `material_code` | string | Material Code |
| `thickness` | decimal | 두께 |
| `width` | integer | 폭 |
| `weight` | integer | 중량 |
| `length_value` | integer | 길이 |
| `product_group` | string | 제품군 |
| `mo_number` | string | MO번호 |
| `through_plate` | string | 통판유무 |
| `sequence_order` | integer | 순서 |

### TC 4001 (출측 CUT)
| 필드 | 타입 | 설명 |
|------|------|------|
| `coil_number` | string | 코일번호 |
| `cut_mode` | integer | CUTMODE |
| `winding_length` | integer | 권취길이 |

### TC 4002 (WPD pass)
| 필드 | 타입 | 설명 |
|------|------|------|
| `coil_number` | string | 코일번호 |

### TC 4003 (Line speed)
| 필드 | 타입 | 설명 |
|------|------|------|
| `line_speed` | integer | 라인 속도 |

### 결함검출 결과
| 필드 | 타입 | 설명 |
|------|------|------|
| `coil_number` | string | 코일번호 |
| `defect_type` | string | 결함 유형 |
| `defect_position_x` | integer | 결함 위치 X |
| `defect_position_y` | integer | 결함 위치 Y |
| `defect_position_meter` | decimal | 결함 위치 (미터) |
| `defect_size_width` | integer | 결함 크기 (폭) |
| `defect_size_height` | integer | 결함 크기 (높이) |
| `confidence_score` | decimal | 신뢰도 점수 |
| `detection_time` | timestamp | 검출 시간 |
| `original_image_path` | string | 원본 이미지 경로 |
| `labeled_image_path` | string | 라벨링 이미지 경로 |

## 인증
모든 API는 세션 기반 인증이 필요합니다. 로그인 후 발급받은 세션 쿠키를 포함하여 요청해야 합니다.

## 오류 응답
```json
{
  "error": "오류 메시지",
  "code": "ERROR_CODE"
}
```

### 일반적인 오류 코드
- `401`: 인증 실패
- `403`: 권한 없음
- `404`: 리소스 없음
- `500`: 서버 오류

## 사용 예시

### 1. 특정 고객사의 최근 코일 조회
```bash
curl -X GET "http://localhost:3000/api/process-data?customer_name=이알텍&page=1&limit=10" \
  -H "Cookie: ccl_sdd_session=SESSION_ID"
```

### 2. 코일번호로 상세 정보 조회
```bash
curl -X POST "http://localhost:3000/api/process-data" \
  -H "Content-Type: application/json" \
  -H "Cookie: ccl_sdd_session=SESSION_ID" \
  -d '{"coil_number": "H477707"}'
```

### 3. 날짜 범위로 조회
```bash
curl -X GET "http://localhost:3000/api/process-data?date_from=20250703&date_to=20250704" \
  -H "Cookie: ccl_sdd_session=SESSION_ID"
``` 