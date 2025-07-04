#!/bin/bash

# CCL SDD 시스템 서비스 중지 스크립트

echo "🛑 CCL SDD 시스템 서비스 중지 중..."

# 환경 변수 설정
export LOG_DIR=./logs
export ORCHESTRATOR_PORT=9000

# 서비스 오케스트레이터를 통한 모든 서비스 중지
echo "🎯 서비스 오케스트레이터를 통한 서비스 중지 중..."
curl -X POST http://localhost:$ORCHESTRATOR_PORT/stop-all 2>/dev/null || echo "오케스트레이터를 통한 중지 실패"

# 대기 시간
sleep 5

# 오케스트레이터 프로세스 중지
echo "🔧 오케스트레이터 프로세스 중지 중..."
if [ -f $LOG_DIR/orchestrator.pid ]; then
    ORCHESTRATOR_PID=$(cat $LOG_DIR/orchestrator.pid)
    if kill -0 $ORCHESTRATOR_PID 2>/dev/null; then
        echo "오케스트레이터 PID $ORCHESTRATOR_PID 중지 중..."
        kill $ORCHESTRATOR_PID
        sleep 3
        
        # 강제 종료가 필요한 경우
        if kill -0 $ORCHESTRATOR_PID 2>/dev/null; then
            echo "오케스트레이터 강제 종료 중..."
            kill -9 $ORCHESTRATOR_PID
        fi
    fi
    rm -f $LOG_DIR/orchestrator.pid
fi

# 남은 프로세스 정리
echo "🧹 남은 프로세스 정리 중..."
pkill -f "node services/" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "python main.py" 2>/dev/null || true
pkill -f "mes-tcp-service" 2>/dev/null || true

# 포트 사용 중인 프로세스 확인 및 정리
echo "🔍 포트 사용 중인 프로세스 확인 중..."
PORTS=(3000 8081 8082 9000 9304 9306 9308 9309 9310)

for port in "${PORTS[@]}"; do
    PID=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$PID" ]; then
        echo "포트 $port 사용 중인 프로세스 $PID 중지 중..."
        kill $PID 2>/dev/null || true
        sleep 1
        
        # 강제 종료가 필요한 경우
        if kill -0 $PID 2>/dev/null; then
            echo "프로세스 $PID 강제 종료 중..."
            kill -9 $PID 2>/dev/null || true
        fi
    fi
done

# 서비스 상태 확인
echo "🔍 서비스 상태 확인 중..."
for port in "${PORTS[@]}"; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "⚠️  포트 $port 여전히 사용 중"
    else
        echo "✅ 포트 $port 해제됨"
    fi
done

# 임시 파일 정리
echo "🧹 임시 파일 정리 중..."
rm -f $LOG_DIR/*.pid 2>/dev/null || true

echo ""
echo "✅ CCL SDD 시스템 서비스 중지 완료!"
echo ""
echo "📊 중지된 서비스:"
echo "  - UI 서비스 (포트 3000)"
echo "  - MES TCP 서비스 (포트 9304, 9306, 9308, 9309, 9310)"
echo "  - 이미지 수신 서비스 (포트 8081)"
echo "  - 결함 데이터 수신 서비스 (포트 8082)"
echo "  - 서비스 오케스트레이터 (포트 9000)"
echo ""
echo "🔄 시스템 재시작: ./scripts/start-services.sh"
echo "" 