import { toast } from 'sonner';

// WebSocket 메시지 타입 정의
export interface WebSocketMessage {
  type: 'settings_update' | 'defect_detected' | 'system_status' | 'user_connected' | 'user_disconnected';
  payload: any;
  timestamp: string;
  userId?: string;
  sessionId?: string;
}

// 이벤트 리스너 타입
export type WebSocketEventListener = (message: WebSocketMessage) => void;

// WebSocket 클라이언트 관리자
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 1초
  private listeners = new Map<string, Set<WebSocketEventListener>>();
  private isConnecting = false;
  private isManuallyDisconnected = false;
  private sessionId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private url: string = 'ws://localhost:8080') {
    this.setupEventListeners();
  }

  // 연결 시작
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error('이미 연결 시도 중입니다.'));
        return;
      }

      this.isConnecting = true;
      this.isManuallyDisconnected = false;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket 연결됨');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          toast.success('실시간 업데이트 연결됨');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('WebSocket 메시지 파싱 오류:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket 연결 해제됨:', event.code, event.reason);
          this.isConnecting = false;
          this.stopHeartbeat();

          if (!this.isManuallyDisconnected) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket 오류:', error);
          this.isConnecting = false;
          toast.error('실시간 업데이트 연결 오류');
          reject(error);
        };

        // 연결 타임아웃 (10초)
        setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false;
            this.ws?.close();
            reject(new Error('연결 타임아웃'));
          }
        }, 10000);

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // 연결 해제
  disconnect() {
    this.isManuallyDisconnected = true;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, '사용자가 연결을 해제했습니다.');
      this.ws = null;
    }
    
    toast.info('실시간 업데이트 연결 해제됨');
  }

  // 메시지 전송
  send(message: Omit<WebSocketMessage, 'timestamp'>): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        const fullMessage: WebSocketMessage = {
          ...message,
          timestamp: new Date().toISOString()
        };
        this.ws.send(JSON.stringify(fullMessage));
        return true;
      } catch (error) {
        console.error('메시지 전송 오류:', error);
        return false;
      }
    }
    return false;
  }

  // 이벤트 리스너 등록
  on(eventType: string, listener: WebSocketEventListener) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
  }

  // 이벤트 리스너 제거
  off(eventType: string, listener: WebSocketEventListener) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  // 모든 이벤트 리스너 제거
  removeAllListeners(eventType?: string) {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // 연결 상태 반환
  getConnectionState(): string {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'CONNECTED';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'DISCONNECTED';
      default: return 'UNKNOWN';
    }
  }

  // 세션 ID 반환
  getSessionId(): string | null {
    return this.sessionId;
  }

  // 메시지 처리
  private handleMessage(message: WebSocketMessage) {
    // 세션 ID 저장
    if (message.type === 'user_connected' && message.payload.sessionId) {
      this.sessionId = message.payload.sessionId;
    }

    // 타입별 이벤트 리스너 호출
    const listeners = this.listeners.get(message.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(message);
        } catch (error) {
          console.error(`이벤트 리스너 오류 (${message.type}):`, error);
        }
      });
    }

    // 전체 메시지 리스너 호출
    const allListeners = this.listeners.get('*');
    if (allListeners) {
      allListeners.forEach(listener => {
        try {
          listener(message);
        } catch (error) {
          console.error('전체 메시지 리스너 오류:', error);
        }
      });
    }
  }

  // 재연결 시도
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('최대 재연결 시도 횟수 초과');
      toast.error('실시간 업데이트 재연결 실패');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 지수 백오프

    console.log(`${delay}ms 후 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isManuallyDisconnected) {
        this.connect().catch(error => {
          console.error('재연결 실패:', error);
        });
      }
    }, delay);
  }

  // 하트비트 시작
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'system_status',
          payload: { type: 'heartbeat' }
        });
      }
    }, 30000); // 30초마다 하트비트
  }

  // 하트비트 중지
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // 기본 이벤트 리스너 설정
  private setupEventListeners() {
    // 설정 업데이트 처리
    this.on('settings_update', (message) => {
      const { category, settings, updatedBy } = message.payload;
      console.log(`설정 업데이트 수신: ${category}`, settings);
      
      if (updatedBy !== this.sessionId) {
        toast.info(`다른 사용자가 ${this.getCategoryDisplayName(category)} 설정을 변경했습니다.`);
      }
    });

    // 결함 감지 알림
    this.on('defect_detected', (message) => {
      const defect = message.payload;
      console.log('새로운 결함 감지:', defect);
      
      if (defect.severity === 'high') {
        toast.error(`심각한 ${defect.type} 결함 감지! 위치: ${defect.position}m`);
      }
    });

    // 시스템 상태 변경
    this.on('system_status', (message) => {
      const status = message.payload;
      if (status.type !== 'heartbeat') {
        console.log('시스템 상태 변경:', status);
      }
    });

    // 사용자 연결/해제
    this.on('user_connected', (message) => {
      console.log('사용자 연결됨:', message.payload);
    });

    this.on('user_disconnected', (message) => {
      console.log('사용자 연결 해제됨:', message.payload);
    });
  }

  // 카테고리 표시명 반환
  private getCategoryDisplayName(category: string): string {
    const displayNames: { [key: string]: string } = {
      sensitivity: '민감도',
      hardware: '하드웨어',
      notifications: '알림',
      periodicPatterns: '주기성 패턴',
      system: '시스템',
      quality: '품질 관리',
      ai: 'AI 모델',
      security: '보안',
      logging: '로깅'
    };
    
    return displayNames[category] || category;
  }
}

// 전역 WebSocket 클라이언트 인스턴스
let globalWebSocketClient: WebSocketClient | null = null;

// WebSocket 클라이언트 팩토리
export const createWebSocketClient = (url?: string): WebSocketClient => {
  if (typeof window !== 'undefined' && !globalWebSocketClient) {
    globalWebSocketClient = new WebSocketClient(url);
  }
  return globalWebSocketClient!;
};

// 전역 WebSocket 클라이언트 반환
export const getWebSocketClient = (): WebSocketClient | null => {
  return globalWebSocketClient;
};

// WebSocket 유틸리티 함수들
export const webSocketUtils = {
  // 설정 변경 알림 전송
  notifySettingsUpdate: (category: string, settings: any) => {
    const client = getWebSocketClient();
    if (client?.isConnected()) {
      client.send({
        type: 'settings_update',
        payload: { category, settings }
      });
    }
  },

  // 시스템 상태 변경 알림 전송
  notifySystemStatus: (status: any) => {
    const client = getWebSocketClient();
    if (client?.isConnected()) {
      client.send({
        type: 'system_status',
        payload: status
      });
    }
  },

  // 연결 상태 확인
  isConnected: (): boolean => {
    const client = getWebSocketClient();
    return client?.isConnected() || false;
  },

  // 연결 시작
  connect: async (): Promise<void> => {
    const client = getWebSocketClient() || createWebSocketClient();
    return client.connect();
  },

  // 연결 해제
  disconnect: () => {
    const client = getWebSocketClient();
    if (client) {
      client.disconnect();
    }
  }
};

export default WebSocketClient; 