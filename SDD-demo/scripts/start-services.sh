#!/bin/bash

# CCL SDD 시스템 서비스 시작 스크립트
# 물리적운영서버에서 모든 서비스를 시작합니다.

echo "🚀 CCL SDD 시스템 서비스 시작 중..."

# 환경 변수 설정
export NODE_ENV=production
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=ccl_sdd_system
export DB_USER=postgres
export DB_PASSWORD=password

# 서비스 포트 설정
export NEXT_PUBLIC_PORT=3000
export IMAGE_RECEIVER_PORT=8081
export DEFECT_DATA_PORT=8082
export ORCHESTRATOR_PORT=9000

# 이미지 저장 경로
export IMAGE_BASE_PATH=/var/lib/ccl-images
export LOG_DIR=./logs

# 필요한 디렉토리 생성
echo "📁 디렉토리 설정 중..."
mkdir -p $IMAGE_BASE_PATH/original
mkdir -p $IMAGE_BASE_PATH/labeled
mkdir -p $LOG_DIR

# 권한 설정
sudo chown -R $(whoami):$(whoami) $IMAGE_BASE_PATH
sudo chown -R $(whoami):$(whoami) $LOG_DIR

# PostgreSQL 서비스 확인
echo "🗄️ PostgreSQL 서비스 확인 중..."
if ! systemctl is-active --quiet postgresql; then
    echo "PostgreSQL 서비스를 시작합니다..."
    sudo systemctl start postgresql
    sleep 5
fi

# 데이터베이스 초기화 (필요한 경우)
echo "🔧 데이터베이스 초기화 확인 중..."
if ! psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1 FROM users LIMIT 1;" > /dev/null 2>&1; then
    echo "데이터베이스 초기화를 실행합니다..."
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f database/schema-redesign.sql
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f database/mockup-data.sql
fi

# Node.js 의존성 설치
echo "📦 Node.js 의존성 설치 중..."
npm install

# Python 의존성 설치 (MES TCP 서비스)
echo "🐍 Python 의존성 설치 중..."
cd mes-tcp-service
if command -v uv &> /dev/null; then
    echo "uv를 사용하여 Python 환경 설정..."
    uv venv
    source .venv/bin/activate
    uv pip install -e .
else
    echo "pip를 사용하여 Python 의존성 설치..."
    pip install -e .
fi
cd ..

# 서비스 오케스트레이터 시작
echo "🎯 서비스 오케스트레이터 시작 중..."
nohup node services/service-orchestrator.js > $LOG_DIR/orchestrator.log 2>&1 &
ORCHESTRATOR_PID=$!
echo "서비스 오케스트레이터 PID: $ORCHESTRATOR_PID"

# 서비스 시작 대기
echo "⏳ 서비스 시작 대기 중..."
sleep 15

# 서비스 상태 확인
echo "🔍 서비스 상태 확인 중..."
curl -s http://localhost:$ORCHESTRATOR_PORT/status | jq '.' || echo "오케스트레이터 상태 확인 실패"

# 서비스 상태 출력
echo ""
echo "🎉 CCL SDD 시스템이 시작되었습니다!"
echo ""
echo "📊 서비스 포트 정보:"
echo "  - UI 서비스: http://localhost:3000"
echo "  - MES TCP 서비스: 포트 9304, 9306, 9308, 9309, 9310"
echo "  - 이미지 수신: http://localhost:8081"
echo "  - 결함 데이터 수신: http://localhost:8082"
echo "  - 서비스 관리: http://localhost:9000"
echo ""
echo "📁 이미지 저장 경로: $IMAGE_BASE_PATH"
echo "📄 로그 디렉토리: $LOG_DIR"
echo ""
echo "🔧 서비스 관리 명령어:"
echo "  - 상태 확인: curl http://localhost:9000/status"
echo "  - 모든 서비스 중지: curl -X POST http://localhost:9000/stop-all"
echo "  - 모든 서비스 시작: curl -X POST http://localhost:9000/start-all"
echo "  - MES TCP 서비스 재시작: curl -X POST http://localhost:9000/restart/mes-tcp-service"
echo ""
echo "🛑 시스템 중지: ./scripts/stop-services.sh"
echo ""

# PID 파일 저장
echo $ORCHESTRATOR_PID > $LOG_DIR/orchestrator.pid

echo "✅ 서비스 시작 완료!" 