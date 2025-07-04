# CCL SDD 시스템 (Coil Coating Line Surface Defect Detection System)

## 📋 프로젝트 개요
CCL(Coil Coating Line) 표면 결함 검사 시스템은 철강 코일의 표면 결함을 실시간으로 검출하고 분석하는 품질 관리 시스템입니다.

## 🏗️ 시스템 아키텍처

### 마이크로서비스 구성
- **UI Service** (포트 3000): Next.js 14 기반 웹 인터페이스
- **PostgreSQL** (포트 5432): 메인 데이터베이스
- **MES Socket Service** (포트 8080): MES 시스템 연동 및 WebSocket 통신
- **Image Receiver Service** (포트 8081): 이미지 수신 및 저장
- **Defect Data Receiver Service** (포트 8082): 결함 데이터 수신 및 처리
- **Service Orchestrator** (포트 9000): 서비스 간 통신 조율

### 기술 스택
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js, PostgreSQL
- **Infrastructure**: Docker, Docker Compose
- **Authentication**: bcryptjs, express-session
- **Real-time Communication**: WebSocket (ws)

## 📁 디렉토리 구조

```
SDD-demo/
├── app/                          # Next.js App Router
│   ├── (protected)/             # 보호된 라우트
│   │   ├── dashboard/           # 대시보드
│   │   ├── data-management/     # 데이터 관리
│   │   ├── history/             # 이력 조회
│   │   ├── diagnostics/         # 진단
│   │   ├── model-management/    # 모델 관리
│   │   ├── customer-rules/      # 고객사 규칙
│   │   └── settings/            # 설정
│   ├── api/                     # API 라우트
│   │   ├── auth/               # 인증 API
│   │   ├── settings/           # 설정 API
│   │   ├── schedules/          # 스케줄 API
│   │   ├── defects/            # 결함 API
│   │   └── models/             # 모델 API
│   ├── login/                   # 로그인 페이지
│   ├── globals.css              # 전역 스타일
│   ├── layout.tsx               # 루트 레이아웃
│   ├── middleware.ts            # ❌ 잘못된 위치 (프로젝트 루트로 이동 필요)
│   └── page.tsx                 # 홈 페이지
├── components/                   # UI 컴포넌트
│   ├── ui/                      # 기본 UI 컴포넌트
│   ├── layout/                  # 레이아웃 컴포넌트
│   ├── coil-map-chart.tsx       # 코일 맵 차트
│   └── real-time-video-panel.tsx # 실시간 비디오 패널
├── lib/                         # 라이브러리 및 유틸리티
│   ├── api/                     # API 클라이언트
│   ├── database/                # 데이터베이스 연결
│   ├── stores/                  # 상태 관리
│   └── utils.ts                 # 유틸리티 함수
├── services/                    # 백엔드 서비스
│   ├── mes-socket-service.js    # MES 소켓 서비스
│   ├── image-receiver-service.js # 이미지 수신 서비스
│   ├── defect-data-receiver-service.js # 결함 데이터 수신 서비스
│   └── service-orchestrator.js  # 서비스 조율기
├── database/                    # 데이터베이스 스키마
│   └── 01_core_schema.sql       # 핵심 스키마
├── contexts/                    # React 컨텍스트
├── hooks/                       # 커스텀 훅
├── public/                      # 정적 파일
├── styles/                      # 스타일 파일
├── docker-compose.yml           # Docker Compose 설정
├── Dockerfile                   # UI 서비스 Dockerfile
├── Dockerfile.service           # 백엔드 서비스 Dockerfile
├── middleware.ts                # ⭕ 여기에 위치해야 함 (현재 누락)
└── package.json                 # 의존성 관리
```

## 🔧 현재 상태 및 문제점

### ✅ 해결된 문제
1. **데이터베이스 스키마 정리**: 14개의 불필요한 SQL 파일 삭제, 핵심 스키마만 유지
2. **MES Socket 서비스 구현**: 누락된 서비스 파일 생성
3. **WebSocket 지원 추가**: 실시간 통신 기능 구현
4. **설정 API 수정**: 권한 시스템 단순화, 기본 설정 데이터 제공

### ❌ 현재 문제점
1. **bcryptjs 모듈 해결 실패**: Docker 빌드 시 bcryptjs 모듈을 찾을 수 없음
   ```
   Module not found: Can't resolve 'bcryptjs'
   ```
2. **미들웨어 위치 문제**: `middleware.ts` 파일이 `app/` 디렉토리 내부에 위치하여 Next.js에서 인식하지 못함
3. **Docker 빌드 실패**: UI 서비스 빌드 과정에서 지속적인 실패

### 🚨 긴급 수정 필요 사항
1. **미들웨어 위치 수정**: `app/middleware.ts` → `middleware.ts` (프로젝트 루트로 이동)
2. **의존성 재설치**: bcryptjs 모듈 정상 설치 확인
3. **Docker 캐시 클리어**: 빌드 캐시 문제 해결

## 🔑 기본 로그인 정보
- **관리자**: `admin` / `password`
- **운영자**: `operator` / `password`
- **뷰어**: `viewer` / `password`

## 🚀 실행 방법

### 로컬 개발 환경
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

### Docker 환경
```bash
# 컨테이너 중지 및 정리
docker-compose down

# 이미지 재빌드 및 실행
docker-compose up -d --build
```

### 데이터베이스 초기화
```bash
# PostgreSQL 컨테이너 접속
docker exec -it ccl-postgres psql -U postgres -d ccl_sdd_system

# 스키마 확인
\dt
```

## 📊 데이터베이스 스키마

### 핵심 테이블
- **users**: 사용자 정보 및 인증
- **sessions**: 세션 관리
- **system_settings**: 시스템 설정
- **schedules**: 생산 스케줄
- **defect_detections**: 결함 검출 데이터
- **ai_models**: AI 모델 관리
- **image_files**: 이미지 파일 관리
- **customers**: 고객사 정보
- **boms**: BOM(Bill of Materials) 관리

## 🔍 트러블슈팅

### 1. bcryptjs 모듈 오류
```bash
# package.json에 bcryptjs가 있는지 확인
cat package.json | grep bcryptjs

# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
```

### 2. 미들웨어 인식 문제
- `middleware.ts` 파일이 프로젝트 루트에 있어야 함
- `app/middleware.ts`가 아닌 `middleware.ts`로 위치 수정 필요

### 3. Docker 빌드 실패
```bash
# Docker 캐시 클리어
docker system prune -a

# 개별 이미지 재빌드
docker-compose build --no-cache ui-service
```

## 📈 개발 진행 상황

### 완료된 기능
- [x] 사용자 인증 시스템
- [x] 데이터베이스 스키마 설계
- [x] 기본 UI 컴포넌트
- [x] 실시간 WebSocket 통신
- [x] 설정 관리 시스템
- [x] Docker 컨테이너 구성

### 진행 중인 작업
- [ ] 미들웨어 위치 수정
- [ ] bcryptjs 모듈 문제 해결
- [ ] Docker 빌드 안정화
- [ ] 로그인 플로우 완성

### 향후 개발 계획
- [ ] 실시간 결함 검출 알고리즘 구현
- [ ] 이미지 처리 및 분석 기능
- [ ] 리포트 생성 시스템
- [ ] 성능 최적화 및 모니터링

## 🛠️ 개발 환경 설정

### 필수 소프트웨어
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Git

### 환경 변수
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ccl_sdd_system
DB_USER=postgres
DB_PASSWORD=password
NODE_ENV=development
```

## 📝 개발 규칙
- 안정성을 최우선으로 고려한 개발
- 모든 코드 변경 시 타입 안전성 검증
- 철저한 에러 처리 및 예외 상황 처리
- 단계별 검증 후 다음 단계 진행

## 📞 문의사항
프로젝트 관련 문의사항이 있으시면 개발팀에 연락해주세요.

---
*마지막 업데이트: 2025-01-04* 