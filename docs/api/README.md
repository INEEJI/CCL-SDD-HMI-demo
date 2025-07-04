# CCL SDD System API 설계서

CCL(Coil Coating Line, 컬러강판 설비) 표면 결함 검사 시스템의 RESTful API 명세서입니다.

## 📖 목차

1. [개요](#개요)
2. [인증 및 보안](#인증-및-보안)
3. [공통 응답 형식](#공통-응답-형식)
4. [에러 코드](#에러-코드)
5. [API 엔드포인트](#api-엔드포인트)
   - [스케줄 관리](#스케줄-관리)
   - [결함 검출 결과](#결함-검출-결과)
   - [AI 모델 관리](#ai-모델-관리)
   - [AI 결과 수신](#ai-결과-수신)
6. [데이터 모델](#데이터-모델)
7. [사용 예시](#사용-예시)
8. [변경 이력](#변경-이력)

## 개요

### 기본 정보
- **Base URL**: `http://localhost:3000/api` (개발), `https://your-domain.com/api` (운영)
- **API 버전**: v1.0
- **프로토콜**: HTTP/HTTPS
- **데이터 형식**: JSON
- **문자 인코딩**: UTF-8

### 지원 HTTP 메서드
- `GET`: 데이터 조회
- `POST`: 데이터 생성
- `PUT`: 데이터 수정
- `DELETE`: 데이터 삭제

## 인증 및 보안

### 현재 상태
- **인증 방식**: 현재 미구현 (내부 네트워크 통신 가정)
- **향후 계획**: JWT 토큰 기반 인증 구현 예정

### 보안 헤더
```http
Content-Type: application/json
Accept: application/json
```

### 향후 인증 헤더 (계획)
```http
Authorization: Bearer <JWT_TOKEN>
X-API-Key: <API_KEY>
```

## 공통 응답 형식

### 성공 응답
```json
{
  "data": <응답 데이터>,
  "message": "성공 메시지",
  "totalCount": <전체 개수> (페이지네이션 시),
  "page": <현재 페이지> (페이지네이션 시),
  "limit": <페이지 크기> (페이지네이션 시),
  "totalPages": <전체 페이지 수> (페이지네이션 시)
}
```

### 에러 응답
```json
{
  "error": "에러 메시지",
  "code": "ERROR_CODE",
  "details": <상세 정보> (선택적)
}
```

## 에러 코드

| HTTP 상태 | 코드 | 설명 |
|-----------|------|------|
| 400 | BAD_REQUEST | 잘못된 요청 |
| 401 | UNAUTHORIZED | 인증 실패 |
| 403 | FORBIDDEN | 권한 없음 |
| 404 | NOT_FOUND | 리소스를 찾을 수 없음 |
| 409 | CONFLICT | 리소스 충돌 |
| 422 | VALIDATION_ERROR | 데이터 검증 실패 |
| 500 | INTERNAL_ERROR | 서버 내부 오류 |

## API 엔드포인트

### 📋 전체 엔드포인트 목록

| 분류 | 메서드 | 엔드포인트 | 설명 |
|------|--------|------------|------|
| **스케줄** | GET | `/schedules` | 스케줄 목록 조회 |
| | POST | `/schedules` | 새 스케줄 생성 |
| | GET | `/schedules/{id}` | 스케줄 상세 조회 |
| | PUT | `/schedules/{id}` | 스케줄 수정 |
| | DELETE | `/schedules/{id}` | 스케줄 삭제 |
| **결함 검출** | GET | `/defects` | 결함 검출 결과 조회 |
| | POST | `/defects` | 결함 검출 결과 저장 |
| | GET | `/defects/{id}` | 결함 상세 조회 |
| | PUT | `/defects/{id}` | 결함 정보 수정 |
| | DELETE | `/defects/{id}` | 결함 정보 삭제 |
| **AI 모델** | GET | `/models` | 모델 목록 조회 |
| | POST | `/models` | 새 모델 등록 |
| | GET | `/models/{id}` | 모델 상세 조회 |
| | PUT | `/models/{id}` | 모델 정보 수정 |
| | DELETE | `/models/{id}` | 모델 삭제 |
| | PUT | `/models/{id}/deploy` | 모델 배포/해제 |
| | GET | `/models/{id}/deploy` | 모델 배포 상태 조회 |
| **AI 결과** | POST | `/ai-results` | AI 결과 수신 |
| | GET | `/ai-results` | AI 결과 조회 |

### 📄 상세 문서
각 API 그룹별 상세 문서는 다음 파일에서 확인할 수 있습니다:

- [스케줄 관리 API](./schedules.md)
- [결함 검출 결과 API](./defects.md)
- [AI 모델 관리 API](./models.md)
- [AI 결과 수신 API](./ai-results.md)

## 데이터 모델

### 주요 엔티티
- **Schedule**: 생산 스케줄
- **DefectDetection**: 결함 검출 결과
- **AIModel**: AI 모델 정보
- **ImageFile**: 이미지 파일 정보

상세한 데이터 모델은 [데이터 모델 문서](./data-models.md)를 참조하세요.

## 사용 예시

### JavaScript/Node.js
```javascript
// 스케줄 목록 조회
const response = await fetch('/api/schedules?page=1&limit=10');
const data = await response.json();

// 결함 검출 결과 저장
const defectData = {
  scheduleId: 123,
  defectType: "scratch",
  defectSizeWidth: 15.5,
  defectSizeHeight: 3.2,
  confidenceScore: 0.95
};

const result = await fetch('/api/defects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(defectData)
});
```

### Python
```python
import requests

# AI 결과 전송
payload = {
    "scheduleId": 123,
    "detections": [{
        "defectType": "scratch",
        "confidenceScore": 0.95
    }]
}

response = requests.post(
    "http://localhost:3000/api/ai-results",
    json=payload
)
```

## 협의 사항

### 고객사/사용자와의 협의 필요 항목

#### 1. 인증 및 보안
- API 키 발급 방식
- JWT 토큰 갱신 주기
- IP 화이트리스트 설정

#### 2. 데이터 형식
- 결함 유형 표준화 (scratch, dent, hole, stain 등)
- 좌표계 정의 (픽셀 vs 물리적 단위)
- 이미지 형식 및 크기 제한

#### 3. 성능 요구사항
- API 응답 시간 SLA
- 동시 요청 처리 한계
- 데이터 보관 기간

#### 4. 알림 및 모니터링
- 장애 발생 시 알림 방식
- 시스템 상태 모니터링 접근 권한
- 로그 데이터 공유 범위

## 변경 이력

| 버전 | 날짜 | 변경 내용 | 담당자 |
|------|------|-----------|--------|
| 1.0.0 | 2024-01-15 | 초기 API 설계서 작성 | 개발팀 |
| | | - 스케줄, 결함, AI 모델 API 정의 | |
| | | - AI 결과 수신 API 추가 | |

---

## 📞 문의 및 지원

- **기술 문의**: jaeman@ineeji.com
- **API 키 발급**: jaeman@ineeji.com
- **장애 신고**: jaeman@ineeji.com

---

**참고**: 이 문서는 지속적으로 업데이트됩니다. 최신 버전은 항상 이 문서를 확인해 주세요. 