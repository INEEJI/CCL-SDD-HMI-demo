# CCL SDD System (표면 결함 검사 시스템)

CCL(Coil Coating Line, 컬러강판 설비) 표면 결함 검사 및 품질 관리 시스템입니다.

## 🚀 프로젝트 구조

```
CCL_SDD_system/
├── quality-management-system/   # 메인 애플리케이션 (Next.js)
│   ├── app/                    # Next.js App Router
│   ├── components/             # React 컴포넌트
│   ├── lib/                    # 유틸리티 및 설정
│   ├── database/               # 데이터베이스 스키마
│   └── public/                 # 정적 파일
├── ai-models/                  # Python AI 모델 (향후)
├── docs/                       # 프로젝트 문서
└── README.md                   # 이 파일
```

## 📋 주요 기능

### 1. 실시간 모니터링 대시보드
- 실시간 결함 검출 시뮬레이션
- 코일 전도 시각화 (CoilMapChart)
- 주기성 결함 감지 및 알림
- 시스템 제어 및 민감도 조절

### 2. 데이터 관리
- 생산 스케줄 선택 및 관리
- 이미지 파일명 일괄 변경
- 실제 테스트 이미지 갤러리

### 3. 결함 이력 관리
- 결함 검출 결과 조회 및 필터링
- 고급 검색 기능
- 결함 상세 정보 및 이미지 뷰어

### 4. AI 모델 관리 (향후 구현)
- 모델 버전 관리
- 모델 배포 및 관리
- 예측 결과 저장

## 🛠️ 기술 스택

### Frontend
- **Next.js 15** - React 프레임워크
- **React 19** - UI 라이브러리
- **TypeScript** - 타입 안전성
- **Tailwind CSS** - 스타일링
- **shadcn/ui** - UI 컴포넌트
- **Zustand** - 상태 관리
- **Chart.js** - 데이터 시각화

### Backend
- **Next.js API Routes** - RESTful API
- **PostgreSQL** - 관계형 데이터베이스
- **Node.js** - 서버 런타임

### AI/ML (향후 확장)
- **Python** - 예측 모델
- **FastAPI** - AI 모델 서버

## 🚀 빠른 시작

### 1. 메인 애플리케이션 실행

```bash
# 메인 프로젝트로 이동
cd quality-management-system

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 편집하여 데이터베이스 설정

# 개발 서버 시작
npm run dev
```

### 2. Docker를 사용한 전체 시스템 실행

```bash
# Docker Compose로 전체 시스템 실행
docker-compose up -d

# 브라우저에서 확인
open http://localhost:3000
```

## 📡 API 설계

### RESTful API 엔드포인트

#### 스케줄 관리
- `GET /api/schedules` - 스케줄 목록 조회
- `POST /api/schedules` - 새 스케줄 생성
- `GET /api/schedules/[id]` - 스케줄 상세 조회
- `PUT /api/schedules/[id]` - 스케줄 수정
- `DELETE /api/schedules/[id]` - 스케줄 삭제

#### 결함 검출 결과
- `GET /api/defects` - 결함 검출 결과 조회
- `POST /api/defects` - 새 결함 검출 결과 저장
- `GET /api/defects/[id]` - 결함 상세 조회
- `PUT /api/defects/[id]` - 결함 정보 수정
- `DELETE /api/defects/[id]` - 결함 정보 삭제

#### AI 모델 관리 (향후)
- `GET /api/models` - 모델 목록 조회
- `POST /api/models` - 새 모델 업로드
- `PUT /api/models/[id]/deploy` - 모델 배포
- `DELETE /api/models/[id]` - 모델 삭제

## 🗄️ 데이터베이스 설계

### 주요 테이블
- `users` - 사용자 관리
- `customers` - 고객사 정보
- `schedules` - 생산 스케줄
- `defect_detections` - 결함 검출 결과
- `ai_models` - AI 모델 관리
- `image_files` - 이미지 파일 관리

## 📁 프로젝트 구조 상세

```
quality-management-system/
├── app/                    # Next.js App Router
│   ├── api/               # API 라우트
│   │   ├── schedules/     # 스케줄 관리 API
│   │   └── defects/       # 결함 검출 API
│   ├── (protected)/       # 보호된 페이지
│   │   ├── dashboard/     # 대시보드
│   │   ├── history/       # 결함 이력
│   │   ├── data-management/ # 데이터 관리
│   │   └── model-management/ # 모델 관리
│   └── globals.css        # 전역 스타일
├── components/            # React 컴포넌트
│   ├── ui/               # shadcn/ui 컴포넌트
│   ├── layout/           # 레이아웃 컴포넌트
│   └── coil-map-chart.tsx # 코일 맵 차트
├── lib/                   # 유틸리티 및 설정
│   ├── api/              # API 클라이언트
│   ├── database/         # 데이터베이스 연결
│   └── stores/           # Zustand 스토어
├── database/             # 데이터베이스 스키마
│   └── schema.sql        # PostgreSQL 스키마
└── public/               # 정적 파일
    └── images/           # 테스트 이미지
```

## 🔧 개발 가이드

### 코드 스타일
- TypeScript 사용
- ESLint + Prettier 설정
- 컴포넌트별 파일 분리
- API 응답 타입 정의

### 환경 설정
- Node.js 18+ 필요
- PostgreSQL 15+ 필요
- Docker (선택사항)

## 📝 변경 이력

### v2.0.0 (현재)
- Next.js 기반으로 전체 시스템 재구축
- PostgreSQL 데이터베이스 연동
- RESTful API 구현
- Docker 컨테이너화

### v1.0.0 (이전)
- Vite + React 기반 demo-app
- 모의 데이터 사용
- 프론트엔드만 구현

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해 주세요.

---

**참고**: 이전 버전의 demo-app은 별도 저장소로 이동되었습니다. 