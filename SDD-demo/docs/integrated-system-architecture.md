# CCL SDD System 통합 시스템 아키텍처 (기존 파이썬 MES 서비스 연동)

## 🏗️ 시스템 개요

CCL(Coil Coating Line, 컬러강판 설비) 표면 결함 검사 시스템은 동국씨엠 내부폐쇄망에서 모든 서비스가 통합 운영되는 구조입니다.
기존에 개발된 파이썬 MES TCP 서비스를 활용하여 PostgreSQL과 연동합니다.

## 🖥️ 물리적운영서버 구성

```
물리적운영서버 (단일 서버)
├── UI 서비스 (Next.js) - 포트 3000
├── 기존 파이썬 MES TCP 서비스 - 포트 9304, 9306, 9308, 9309, 9310
├── 이미지 수신 서비스 - 포트 8081  
├── 결함검출 데이터 수신 서비스 - 포트 8082
├── 서비스 오케스트레이터 - 포트 9000
├── PostgreSQL 데이터베이스 - 포트 5432
└── 이미지 저장소 (/var/lib/ccl-images/)
```

## 🔄 데이터 흐름

### 1. MES 데이터 수신 흐름
```
동국씨엠 MES → Socket(EUC-KR) → 파이썬 MES TCP 서비스 → PostgreSQL
                                          ↓
                                    고기원 서버 (포트 9308, 9309, 9310)
```

### 2. 이미지 처리 흐름
```
카메라 → Jetson Orin AGX → AI 결함검출 → 물리적운영서버
                                    ├── 이미지저장 (/var/lib/ccl-images/)
                                    └── 결함데이터 저장 (PostgreSQL)
```

### 3. 웹 UI 데이터 흐름
```
웹 브라우저 → UI 서비스 → PostgreSQL → 실시간 대시보드
```

## 🛠️ 서비스 구성

### 1. UI 서비스 (포트 3000)
- **기술**: Next.js, React, TypeScript
- **기능**: 웹 기반 사용자 인터페이스
- **특징**: 
  - 실시간 대시보드
  - 결함 이미지 뷰어
  - 공정 데이터 모니터링
  - 사용자 인증 및 권한 관리

### 2. 파이썬 MES TCP 서비스 (포트 9304, 9306, 9308, 9309, 9310)
- **기술**: Python, AsyncIO, TCP Socket
- **기능**: 동국씨엠 MES 데이터 수신 및 고기원 데이터 전달
- **특징**:
  - EUC-KR 인코딩 처리
  - TC Code 4000/4001/4002/4003 파싱
  - PostgreSQL 실시간 저장
  - 고기원 서버로 데이터 전달
  - 헥사고날 아키텍처 적용
- **포트 구성**:
  - 9304: 동국에서 데이터 수신
  - 9306: 고기원에서 ACK 수신
  - 9308: 고기원 스케줄 전송
  - 9309: 고기원 WPD pass 전송
  - 9310: 고기원 Line Speed 전송

### 3. 이미지 수신 서비스 (포트 8081)
- **기술**: Node.js, Express, Multer
- **기능**: Jetson Orin AGX에서 이미지 수신
- **특징**:
  - 원본/라벨링 이미지 분리 저장
  - 코일번호 기반 파일명 관리
  - 이미지 메타데이터 관리
  - REST API 제공

### 4. 결함검출 데이터 수신 서비스 (포트 8082)
- **기술**: Node.js, Express
- **기능**: AI 결함검출 결과 수신
- **특징**:
  - 단일/배치 결함 데이터 처리
  - 신뢰도 기반 품질 관리
  - AI 모델 성능 추적
  - 결함 통계 생성

### 5. 서비스 오케스트레이터 (포트 9000)
- **기술**: Node.js, Process Management
- **기능**: 모든 서비스 통합 관리
- **특징**:
  - 서비스 상태 모니터링
  - 자동 재시작
  - 로그 관리
  - 원격 제어 API

## 🗄️ 데이터베이스 구조

### TC Code 기반 공정 데이터 테이블
- `tc_4000_schedule`: 스케줄 정보
- `tc_4001_cut`: 출측 CUT 정보
- `tc_4002_wpd`: WPD pass 정보
- `tc_4003_speed`: Line Speed 정보

### 결함 검출 테이블
- `defect_detections`: 결함 검출 결과
- `ai_models`: AI 모델 정보

### 시스템 관리 테이블
- `users`: 사용자 정보
- `audit_logs`: 감사 로그
- `system_settings`: 시스템 설정

## 📁 이미지 저장 구조

```
/var/lib/ccl-images/
├── original/          # 원본 이미지
│   └── [코일번호]_[타임스탬프]_original.jpg
├── labeled/           # 라벨링 이미지
│   └── [코일번호]_[타임스탬프]_labeled.jpg
└── temp/             # 임시 파일
```

## 🐍 **파이썬 MES TCP 서비스 구조**

### 헥사고날 아키텍처
```
app/
├── domain/                  # 비즈니스 로직 (순수 계층)
│   ├── model.py             # 데이터 모델 정의
│   └── service.py           # 도메인 서비스 (파싱 등)
│
├── application/             # UseCase 흐름 정의
│   └── use_case.py          # 애플리케이션 유스케이스 (PostgreSQL 연동 포함)
│
├── ports/                   # Port (Interface) 정의
│   ├── input_port.py        # 인바운드 포트 인터페이스
│   └── output_port.py       # 아웃바운드 포트 인터페이스
│
├── adapters/                # 실제 Adapter 구현 (TCP 등)
│   ├── tcp/
│   │   ├── tcp_receiver.py  # TCP 서버(수신기) 구현
│   │   └── tcp_sender.py    # TCP 클라이언트(송신기) 구현
│   └── storage/
│       ├── memory_repository.py     # 메모리 기반 저장소
│       └── postgresql_repository.py # PostgreSQL 저장소 (새로 추가)
│
├── config/
│   └── settings.py          # 호스트/포트 설정
│
└── main.py                  # 서비스 실행 진입점 (PostgreSQL 연동 포함)
```

### PostgreSQL 연동 기능
- **실시간 저장**: TC Code 데이터를 실시간으로 PostgreSQL에 저장
- **이중 저장**: 기존 메모리 저장소와 PostgreSQL 동시 저장
- **연결 풀**: AsyncPG를 이용한 비동기 연결 풀 관리
- **에러 처리**: 데이터베이스 연결 실패 시 자동 재연결
- **모니터링**: 저장 통계 및 헬스체크 제공

## 🔧 배포 및 운영

### 시작 명령어
```bash
# 전체 시스템 시작
./scripts/start-services.sh

# 개별 서비스 관리
curl -X POST http://localhost:9000/start/[service-id]
curl -X POST http://localhost:9000/stop/[service-id]
curl -X POST http://localhost:9000/restart/[service-id]

# MES TCP 서비스 재시작
curl -X POST http://localhost:9000/restart/mes-tcp-service
```

### 중지 명령어
```bash
# 전체 시스템 중지
./scripts/stop-services.sh

# 모든 서비스 중지
curl -X POST http://localhost:9000/stop-all
```

### 상태 확인
```bash
# 전체 서비스 상태
curl http://localhost:9000/status

# 개별 서비스 상태
curl http://localhost:9000/status/[service-id]
```

## 🔍 모니터링 및 로그

### 로그 파일 위치
```
./logs/
├── orchestrator.log          # 오케스트레이터 로그
├── ui-service.log            # UI 서비스 로그
├── mes-tcp-service.log       # 파이썬 MES TCP 서비스 로그
├── image-receiver.log        # 이미지 수신 로그
└── defect-data-receiver.log  # 결함 데이터 수신 로그
```

### 로그 조회
```bash
# 서비스별 로그 조회
curl http://localhost:9000/logs/[service-id]

# 실시간 로그 모니터링
tail -f ./logs/[service-name].log
```

## 🚨 장애 대응

### 자동 복구 기능
- 서비스 비정상 종료 시 자동 재시작
- 데이터베이스 연결 끊김 시 자동 재연결
- 네트워크 장애 시 재시도 로직
- TCP 연결 끊김 시 자동 재연결

### 수동 복구 절차
1. 서비스 상태 확인: `curl http://localhost:9000/status`
2. 문제 서비스 재시작: `curl -X POST http://localhost:9000/restart/[service-id]`
3. 로그 확인: `curl http://localhost:9000/logs/[service-id]`
4. 전체 시스템 재시작: `./scripts/stop-services.sh && ./scripts/start-services.sh`

### MES TCP 서비스 특별 관리
```bash
# MES TCP 서비스만 재시작
curl -X POST http://localhost:9000/restart/mes-tcp-service

# 파이썬 환경 재설정
cd mes-tcp-service
source .venv/bin/activate
uv pip install -e .
```

## 🔐 보안 고려사항

### 네트워크 보안
- 내부망 환경에서만 운영
- 포트별 방화벽 설정
- 서비스 간 통신 암호화

### 데이터 보안
- 세션 기반 인증
- 사용자 권한별 접근 제어
- 민감 데이터 암호화 저장

### 시스템 보안
- 정기적인 보안 업데이트
- 로그 기반 보안 모니터링
- 백업 및 복구 절차

## 📊 성능 최적화

### 데이터베이스 최적화
- timestamp 기반 인덱스
- coil_number 기반 빠른 조회
- 비동기 연결 풀 관리
- 정기적인 통계 업데이트

### MES TCP 서비스 최적화
- 비동기 I/O 처리
- 연결 풀 재사용
- 메모리 기반 캐싱
- 배치 처리 최적화

### 이미지 처리 최적화
- 로컬 SSD 저장
- 이미지 압축 및 최적화
- 캐시 기반 빠른 조회

## 🔄 확장 가능성

### 수평 확장
- 로드 밸런서 추가
- 데이터베이스 복제
- 이미지 저장소 분산
- MES TCP 서비스 다중화

### 수직 확장
- 서버 리소스 증설
- 데이터베이스 성능 향상
- 네트워크 대역폭 확장

## 📈 모니터링 지표

### 시스템 지표
- CPU, 메모리, 디스크 사용률
- 네트워크 트래픽
- 서비스 응답 시간

### 비즈니스 지표
- 결함 검출 정확도
- 처리 속도 (이미지/초)
- 시스템 가용성
- MES 데이터 처리량

### MES TCP 서비스 지표
- TCP 연결 상태
- 데이터 처리 성공률
- PostgreSQL 저장 성공률
- 고기원 전달 성공률

### 알림 설정
- 서비스 다운 알림
- 리소스 임계값 알림
- 결함 검출 임계값 알림
- MES 데이터 처리 실패 알림 