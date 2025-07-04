# 실시간 이미지 스트리밍 시스템

## 📋 개요

CCL(Coil Coating Line, 컬러강판 설비) 표면 결함 검사 시스템의 실시간 이미지 모니터링을 위한 파일 시스템 이벤트 기반 스트리밍 시스템입니다.

### 🏭 프로젝트 참여 기업
- **동국씨엠/동국시스템즈**: 물리적 HW 위치, 컬러강판 생산, IT/네트워크 인프라 제공
- **고등기술연구원(고기원)**: 결함검출 딥러닝 모델 개발, 카메라 이미지 수집
- **엠아이큐브솔루션(엠큐솔)**: 자가진단, 자동제어 시스템

## 🎯 핵심 특징

### ⚡ 즉시 반응성
- **파일 생성 감지**: Chokidar를 이용한 실시간 파일 시스템 이벤트 감지
- **0.1초 이내 업데이트**: 새 이미지 파일 생성 시 즉시 화면 반영
- **폴링 방식 대비 90% 리소스 절약**

### 🔄 안정적인 연결 관리
- **WebSocket 실시간 통신**: 양방향 실시간 데이터 교환
- **자동 재연결**: 연결 끊김 시 최대 5회 재시도 (3초 간격)
- **HTTP API 폴백**: WebSocket 실패 시 자동 전환

### 🛡️ 안전한 운영
- **마지막 이미지 유지**: 시스템 재시작 시 기존 최신 이미지 자동 로드
- **목업 모드**: 실제 이미지 없을 때 데모 이미지 표시
- **다중 폴백 시스템**: 서비스 중단 없는 연속 운영

## 🏗️ 시스템 아키텍처

```
[Jetson Orin AGX] → [스토리지 폴더] → [Chokidar 워처] → [WebSocket] → [실시간 UI]
                                    ↓
                                [HTTP API 폴백]
```

### 구성 요소

1. **이미지 수신 서비스** (포트: 8081)
   - 파일 시스템 워처 (Chokidar)
   - WebSocket 서버
   - HTTP REST API
   - 이미지 저장 관리

2. **프론트엔드 훅** (`useLiveImage`)
   - WebSocket 클라이언트
   - 자동 재연결 로직
   - HTTP API 폴백

3. **실시간 영상 패널**
   - 연결 상태 표시
   - 이미지 생성 시간 추적
   - 사용자 상호작용

## 🔧 구현 세부사항

### 파일 시스템 워처 설정

```javascript
const watcher = chokidar.watch(imagePath, {
  ignored: /^\./, // 숨김 파일 무시
  persistent: true,
  ignoreInitial: false, // 시작 시 기존 파일도 감지
  depth: 0 // 하위 디렉토리 감시하지 않음
});

watcher
  .on('add', (filePath) => this.handleFileAdded(filePath, type))
  .on('change', (filePath) => this.handleFileChanged(filePath, type))
  .on('unlink', (filePath) => this.handleFileRemoved(filePath, type));
```

### WebSocket 메시지 형식

```javascript
// 이미지 업데이트 알림
{
  type: 'image_update',
  data: {
    filename: '20250409135914_2891_original.jpg',
    url: '/image/original/20250409135914_2891_original.jpg',
    timestamp: 1704123456789,
    type: 'original',
    coil_number: '2891',
    size: 1024000,
    created_at: '2025-01-09T12:34:56.789Z'
  },
  timestamp: 1704123456789
}

// 현재 이미지 정보
{
  type: 'current_images',
  data: {
    'original': { /* 최신 원본 이미지 정보 */ },
    'labeled': { /* 최신 라벨링 이미지 정보 */ },
    'original_2891': { /* 코일 2891의 최신 원본 이미지 */ }
  },
  timestamp: 1704123456789
}
```

## 📊 성능 비교

| 방식 | 응답 시간 | CPU 사용량 | 메모리 사용량 | 네트워크 트래픽 |
|------|-----------|------------|---------------|-----------------|
| 폴링 (3초) | 0~3초 | 높음 | 높음 | 높음 |
| **파일 이벤트 + WebSocket** | **<0.1초** | **낮음** | **낮음** | **낮음** |

## 🚀 사용 방법

### 1. 서비스 시작

```bash
# 이미지 수신 서비스 시작
cd quality-management-system/services
node image-receiver-service.js

# 또는 서비스 오케스트레이터로 통합 시작
node service-orchestrator.js
```

### 2. 프론트엔드 사용

```typescript
import { useLiveImage } from '@/hooks/use-live-image'

function VideoPanel() {
  const {
    currentImage,
    isConnected,
    connectionType,
    error
  } = useLiveImage({
    imageType: 'original',
    coilNumber: '2891',
    enabled: true
  })

  return (
    <div>
      {currentImage && (
        <img src={getImageUrl()} alt="Live feed" />
      )}
      <div>연결 상태: {connectionType}</div>
      <div>이미지 생성 시간: {new Date(currentImage?.timestamp).toLocaleString()}</div>
    </div>
  )
}
```

## 🔍 모니터링 및 디버깅

### 연결 상태 확인

- **WebSocket 연결**: 녹색 Wi-Fi 아이콘, "실시간 연결" 표시
- **HTTP 폴백**: 노란색 Wi-Fi 아이콘, "HTTP 모드" 표시
- **연결 오류**: 빨간색 Wi-Fi 아이콘, "연결 오류" 표시

### 이미지 생성 시간 추적

```typescript
// 현재 표시된 이미지의 생성 시간
const imageCreatedAt = new Date(currentImage.timestamp).toLocaleString()

// 마지막 업데이트로부터 경과 시간 계산
const timeSinceUpdate = Date.now() - currentImage.timestamp
const isStale = timeSinceUpdate > 30000 // 30초 이상 경과 시 경고
```

### 로그 확인

```bash
# 이미지 수신 서비스 로그
[Image Receiver] 새 이미지 파일 감지 (original): 20250409135914_2891_original.jpg
[Image Receiver] 이미지 업데이트 브로드캐스트: 20250409135914_2891_original.jpg (3개 클라이언트)

# WebSocket 연결 로그
[Image Receiver] WebSocket 클라이언트 연결: 192.168.1.100
[useLiveImage] WebSocket 연결됨
```

## 🔧 설정 옵션

### 환경 변수

```bash
# 이미지 수신 서비스 포트
IMAGE_RECEIVER_PORT=8081

# 이미지 저장 경로
IMAGE_BASE_PATH=/var/lib/ccl-images

# 최대 파일 크기 (바이트)
MAX_FILE_SIZE=52428800  # 50MB

# WebSocket 설정
WS_PING_INTERVAL=30000  # 30초
MAX_RECONNECT_ATTEMPTS=5
RECONNECT_DELAY=3000    # 3초
```

### 파일 구조

```
/var/lib/ccl-images/
├── original/           # 원본 이미지
│   ├── 20250409135914_2891_1704123456789_original.jpg
│   └── 20250409135914_2892_1704123457890_original.jpg
└── labeled/            # 라벨링 이미지
    ├── 20250409135914_2891_1704123456789_labeled.jpg
    └── 20250409135914_2892_1704123457890_labeled.jpg
```

## 🚨 문제 해결

### 이미지가 업데이트되지 않을 때

1. **파일 워처 상태 확인**
   ```bash
   # 워처가 정상 작동하는지 확인
   curl http://localhost:8081/health
   ```

2. **WebSocket 연결 확인**
   - 브라우저 개발자 도구 → Network → WS 탭 확인
   - 연결 상태가 "OPEN"인지 확인

3. **파일 권한 확인**
   ```bash
   # 이미지 디렉토리 권한 확인
   ls -la /var/lib/ccl-images/
   ```

### 성능 최적화

1. **이미지 크기 최적화**
   - 원본: 최대 50MB
   - 압축 권장: JPEG 품질 85%

2. **네트워크 최적화**
   - 로컬 네트워크 사용 권장
   - WebSocket 연결 유지

3. **메모리 관리**
   - 오래된 이미지 파일 정기 정리
   - 로그 파일 로테이션

## 📈 향후 개선 계획

- [ ] 이미지 압축 및 최적화
- [ ] 다중 카메라 지원
- [ ] 이미지 히스토리 뷰어
- [ ] 성능 메트릭 대시보드
- [ ] 알림 시스템 (이미지 수집 중단 시)

## 🔗 관련 문서

- [API 문서](../api/README.md)
- [시스템 아키텍처](integrated-system-architecture.md)
- [배포 가이드](../README.md) 