const express = require('express');
const { Pool } = require('pg');
const http = require('http');
const WebSocket = require('ws');

// PostgreSQL 연결 설정
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ccl_sdd_system',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Express 앱 설정
const app = express();
const port = process.env.MES_SOCKET_PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS 설정
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// HTTP 서버 생성
const server = http.createServer(app);

// WebSocket 서버 생성
const wss = new WebSocket.Server({ server });

// 연결된 클라이언트 관리
const clients = new Set();

// WebSocket 연결 처리
wss.on('connection', (ws, req) => {
  console.log(`[WebSocket] 새 클라이언트 연결: ${req.socket.remoteAddress}`);
  clients.add(ws);

  // 연결 확인 메시지 전송
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'WebSocket 연결이 성공했습니다.',
    timestamp: new Date().toISOString()
  }));

  // 클라이언트로부터 메시지 수신
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`[WebSocket] 메시지 수신:`, data);
      
      // 메시지 타입에 따른 처리
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;
        case 'subscribe':
          // 구독 요청 처리
          ws.send(JSON.stringify({
            type: 'subscribed',
            channel: data.channel,
            message: `${data.channel} 채널 구독이 완료되었습니다.`,
            timestamp: new Date().toISOString()
          }));
          break;
        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: '알 수 없는 메시지 타입입니다.',
            timestamp: new Date().toISOString()
          }));
      }
    } catch (error) {
      console.error('[WebSocket] 메시지 파싱 오류:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: '메시지 형식이 올바르지 않습니다.',
        timestamp: new Date().toISOString()
      }));
    }
  });

  // 연결 종료 처리
  ws.on('close', () => {
    console.log(`[WebSocket] 클라이언트 연결 종료`);
    clients.delete(ws);
  });

  // 에러 처리
  ws.on('error', (error) => {
    console.error('[WebSocket] 클라이언트 오류:', error);
    clients.delete(ws);
  });
});

// 모든 클라이언트에게 메시지 브로드캐스트
function broadcastMessage(message) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// 주기적으로 더미 데이터 전송 (테스트용)
setInterval(() => {
  if (clients.size > 0) {
    broadcastMessage({
      type: 'realtime_data',
      data: {
        temperature: 20 + Math.random() * 10,
        humidity: 40 + Math.random() * 20,
        defectCount: Math.floor(Math.random() * 5),
        productionRate: 80 + Math.random() * 20
      },
      timestamp: new Date().toISOString()
    });
  }
}, 5000); // 5초마다 전송

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'MES Socket Service',
    port: port,
    websocket: {
      enabled: true,
      connectedClients: clients.size
    },
    timestamp: new Date().toISOString()
  });
});

// 통계 정보 조회
app.get('/stats', (req, res) => {
  res.json({
    totalMessages: 0,
    connectedClients: clients.size,
    mesConnections: 0,
    errors: 0,
    uptime: Date.now(),
    timestamp: new Date().toISOString()
  });
});

// MES 연결 상태 조회
app.get('/mes/connections', (req, res) => {
  res.json({
    totalConnections: clients.size,
    connections: Array.from(clients).map((client, index) => ({
      id: index,
      readyState: client.readyState,
      connected: client.readyState === WebSocket.OPEN
    }))
  });
});

// MES 메시지 전송
app.post('/mes/send', async (req, res) => {
  try {
    const { message, target } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '메시지가 필요합니다.' });
    }

    // WebSocket 클라이언트들에게 메시지 브로드캐스트
    broadcastMessage({
      type: 'mes_message',
      message: message,
      target: target,
      timestamp: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      result: {
        sent: true,
        message: '메시지가 전송되었습니다.',
        clientCount: clients.size,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('MES 메시지 전송 오류:', error);
    res.status(500).json({ error: '메시지 전송에 실패했습니다.' });
  }
});

// 서버 시작
server.listen(port, () => {
  console.log(`[MES Socket] 서비스가 포트 ${port}에서 실행 중입니다.`);
  console.log(`[WebSocket] 서버가 ws://localhost:${port}에서 실행 중입니다.`);
});

// 에러 핸들링
server.on('error', (error) => {
  console.error('[MES Socket] 서버 오류:', error);
});

// 종료 신호 처리
process.on('SIGINT', () => {
  console.log('\n[MES Socket] 종료 신호 수신...');
  
  // 모든 WebSocket 연결 종료
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });
  
  server.close(() => {
    console.log('[MES Socket] 서비스가 종료되었습니다.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[MES Socket] 종료 신호 수신...');
  
  // 모든 WebSocket 연결 종료
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });
  
  server.close(() => {
    console.log('[MES Socket] 서비스가 종료되었습니다.');
    process.exit(0);
  });
});

module.exports = { app, server, wss };
