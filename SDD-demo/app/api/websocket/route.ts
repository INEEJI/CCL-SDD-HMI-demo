import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

let wss: WebSocketServer | null = null;

// WebSocket 메시지 타입 정의
interface WebSocketMessage {
  type: 'settings_update' | 'defect_detected' | 'system_status' | 'user_connected' | 'user_disconnected';
  payload: Record<string, unknown>;
  timestamp: string;
  userId?: string;
  sessionId?: string;
}

// 클라이언트 정보 타입 정의
interface ClientInfo {
  ws: WebSocket;
  userId?: string;
  sessionId: string;
  connectedAt: Date;
  lastActivity: Date;
}

// 연결된 클라이언트 관리
const clients = new Map<string, ClientInfo>();

// WebSocket 서버 초기화
function initializeWebSocket() {
  if (wss) return wss;

  wss = new WebSocketServer({ 
    port: 8080,
    verifyClient: (info: { origin: string; secure: boolean; req: IncomingMessage }) => {
      // 간단한 인증 검증 (실제 환경에서는 더 강화된 인증 필요)
      const origin = info.origin;
      return true; // 개발 환경에서는 모든 연결 허용
    }
  });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const sessionId = generateSessionId();
    const clientInfo: ClientInfo = {
      ws,
      sessionId,
      connectedAt: new Date(),
      lastActivity: new Date()
    };

    clients.set(sessionId, clientInfo);
    console.log(`클라이언트 연결됨: ${sessionId} (총 ${clients.size}개 연결)`);

    // 연결 확인 메시지 전송
    sendToClient(sessionId, {
      type: 'user_connected',
      payload: { 
        sessionId,
        message: '실시간 업데이트 연결이 성공했습니다.',
        connectedClients: clients.size
      },
      timestamp: new Date().toISOString()
    });

    // 클라이언트로부터 메시지 수신
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        handleClientMessage(sessionId, message);
        
        // 활동 시간 업데이트
        const client = clients.get(sessionId);
        if (client) {
          client.lastActivity = new Date();
        }
      } catch (error) {
        console.error('WebSocket 메시지 파싱 오류:', error);
      }
    });

    // 연결 해제 처리
    ws.on('close', () => {
      clients.delete(sessionId);
      console.log(`클라이언트 연결 해제됨: ${sessionId} (남은 연결: ${clients.size}개)`);
      
      // 다른 클라이언트들에게 연결 해제 알림
      broadcastToAll({
        type: 'user_disconnected',
        payload: { 
          sessionId,
          connectedClients: clients.size
        },
        timestamp: new Date().toISOString()
      }, sessionId);
    });

    // 에러 처리
    ws.on('error', (error: Error) => {
      console.error(`WebSocket 에러 (${sessionId}):`, error);
      clients.delete(sessionId);
    });

    // Ping/Pong으로 연결 상태 확인
    ws.on('pong', () => {
      const client = clients.get(sessionId);
      if (client) {
        client.lastActivity = new Date();
      }
    });
  });

  // 주기적으로 연결 상태 확인 (30초마다)
  setInterval(() => {
    const now = new Date();
    clients.forEach((client, sessionId) => {
      const timeSinceLastActivity = now.getTime() - client.lastActivity.getTime();
      
      if (timeSinceLastActivity > 60000) { // 60초 이상 비활성
        console.log(`비활성 클라이언트 제거: ${sessionId}`);
        client.ws.terminate();
        clients.delete(sessionId);
      } else {
        // Ping 전송
        try {
          client.ws.ping();
        } catch (error) {
          console.error(`Ping 전송 실패 (${sessionId}):`, error);
          clients.delete(sessionId);
        }
      }
    });
  }, 30000);

  console.log('WebSocket 서버가 포트 8080에서 시작되었습니다.');
  return wss;
}

// 세션 ID 생성
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 특정 클라이언트에게 메시지 전송
function sendToClient(sessionId: string, message: WebSocketMessage) {
  const client = clients.get(sessionId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`메시지 전송 실패 (${sessionId}):`, error);
      clients.delete(sessionId);
    }
  }
}

// 모든 클라이언트에게 브로드캐스트
function broadcastToAll(message: WebSocketMessage, excludeSessionId?: string) {
  clients.forEach((client, sessionId) => {
    if (sessionId !== excludeSessionId) {
      sendToClient(sessionId, message);
    }
  });
}

// 특정 사용자에게만 전송
function sendToUser(userId: string, message: WebSocketMessage) {
  clients.forEach((client, sessionId) => {
    if (client.userId === userId) {
      sendToClient(sessionId, message);
    }
  });
}

// 클라이언트 메시지 처리
function handleClientMessage(sessionId: string, message: WebSocketMessage) {
  const client = clients.get(sessionId);
  if (!client) return;

  switch (message.type) {
    case 'settings_update':
      // 설정 변경을 다른 클라이언트들에게 브로드캐스트
      broadcastToAll({
        type: 'settings_update',
        payload: message.payload,
        timestamp: new Date().toISOString(),
        sessionId
      }, sessionId);
      break;

    case 'system_status':
      // 시스템 상태 변경 브로드캐스트
      broadcastToAll({
        type: 'system_status',
        payload: message.payload,
        timestamp: new Date().toISOString(),
        sessionId
      }, sessionId);
      break;

    default:
      console.log(`알 수 없는 메시지 타입: ${message.type}`);
  }
}

// 외부에서 호출할 수 있는 함수들
export function notifySettingsUpdate(category: string, settings: Record<string, unknown>) {
  broadcastToAll({
    type: 'settings_update',
    payload: { category, settings },
    timestamp: new Date().toISOString()
  });
}

export function notifyDefectDetected(defectData: Record<string, unknown>) {
  broadcastToAll({
    type: 'defect_detected',
    payload: defectData,
    timestamp: new Date().toISOString()
  });
}

export function notifySystemStatus(status: Record<string, unknown>) {
  broadcastToAll({
    type: 'system_status',
    payload: status,
    timestamp: new Date().toISOString()
  });
}

export function getConnectedClients() {
  return Array.from(clients.entries()).map(([sessionId, client]) => ({
    sessionId,
    userId: client.userId,
    connectedAt: client.connectedAt,
    lastActivity: client.lastActivity
  }));
}

// HTTP 엔드포인트들
export async function GET(request: NextRequest) {
  // WebSocket 서버 초기화
  const server = initializeWebSocket();
  
  return new Response(JSON.stringify({
    success: true,
    message: 'WebSocket 서버가 실행 중입니다.',
    port: 8080,
    connectedClients: clients.size,
    clients: getConnectedClients()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, payload, userId } = body;

    if (!type || !payload) {
      return new Response(JSON.stringify({
        success: false,
        error: 'type과 payload가 필요합니다.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // WebSocket 서버 초기화
    initializeWebSocket();

    // 메시지 타입에 따라 처리
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date().toISOString()
    };

    if (userId) {
      sendToUser(userId, message);
    } else {
      broadcastToAll(message);
    }

    return new Response(JSON.stringify({
      success: true,
      message: '메시지가 성공적으로 전송되었습니다.',
      sentTo: userId ? `사용자 ${userId}` : '모든 클라이언트'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('WebSocket 메시지 전송 오류:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '메시지 전송에 실패했습니다.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 서버 시작 시 WebSocket 초기화
if (typeof window === 'undefined') {
  // 서버 사이드에서만 실행
  setTimeout(() => {
    initializeWebSocket();
  }, 1000);
} 