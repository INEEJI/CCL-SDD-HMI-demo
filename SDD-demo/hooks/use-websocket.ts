import { useEffect, useRef, useState, useCallback } from 'react';
import { createWebSocketClient, getWebSocketClient, WebSocketClient, WebSocketMessage, WebSocketEventListener } from '@/lib/websocket/client';

// WebSocket 상태 타입
export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionState: string;
  sessionId: string | null;
  error: string | null;
}

// WebSocket Hook 옵션
export interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

// WebSocket Hook
export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    url,
    autoConnect = true,
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options;

  console.log('[WebSocket Hook] 초기화:', { url, autoConnect })

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    connectionState: 'DISCONNECTED',
    sessionId: null,
    error: null
  });

  const clientRef = useRef<WebSocketClient | null>(null);
  const listenersRef = useRef<Map<string, WebSocketEventListener>>(new Map());

  // WebSocket 클라이언트 초기화
  const initializeClient = useCallback(() => {
    console.log('[WebSocket Hook] 클라이언트 초기화 시도')
    if (typeof window === 'undefined') {
      console.log('[WebSocket Hook] 서버 사이드 환경 - 클라이언트 초기화 건너뜀')
      return null;
    }
    
    if (!clientRef.current) {
      console.log('[WebSocket Hook] 새 WebSocket 클라이언트 생성')
      clientRef.current = createWebSocketClient(url);
    } else {
      console.log('[WebSocket Hook] 기존 WebSocket 클라이언트 재사용')
    }
    return clientRef.current;
  }, [url]);

  // 상태 업데이트
  const updateState = useCallback(() => {
    const client = clientRef.current;
    if (client) {
      const newState = {
        isConnected: client.isConnected(),
        connectionState: client.getConnectionState(),
        sessionId: client.getSessionId(),
        isConnecting: client.getConnectionState() === 'CONNECTING'
      };
      
      console.log('[WebSocket Hook] 상태 업데이트:', newState);
      
      setState(prev => ({
        ...prev,
        ...newState
      }));
    }
  }, []);

  // 연결
  const connect = useCallback(async () => {
    console.log('[WebSocket Hook] 연결 시도 시작')
    const client = initializeClient();
    if (!client) {
      console.log('[WebSocket Hook] 클라이언트가 없어 연결 중단')
      return;
    }

    try {
      setState(prev => ({ ...prev, isConnecting: true, error: null }));
      console.log('[WebSocket Hook] 클라이언트 연결 중...')
      await client.connect();
      updateState();
      console.log('[WebSocket Hook] 연결 성공!')
      onConnect?.();
    } catch (error) {
      console.error('[WebSocket Hook] 연결 실패:', error)
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        error: error instanceof Error ? error.message : '연결 오류' 
      }));
      onError?.(error);
    }
  }, [initializeClient, updateState, onConnect, onError]);

  // 연결 해제
  const disconnect = useCallback(() => {
    console.log('[WebSocket Hook] 연결 해제 시도')
    const client = clientRef.current;
    if (client) {
      client.disconnect();
      updateState();
      console.log('[WebSocket Hook] 연결 해제 완료')
      onDisconnect?.();
    }
  }, [updateState, onDisconnect]);

  // 메시지 전송
  const sendMessage = useCallback((message: Omit<WebSocketMessage, 'timestamp'>) => {
    console.log('[WebSocket Hook] 메시지 전송 시도:', message)
    const client = clientRef.current;
    if (client && client.isConnected()) {
      const result = client.send(message);
      console.log('[WebSocket Hook] 메시지 전송 결과:', result)
      return result;
    } else {
      console.warn('[WebSocket Hook] 클라이언트가 연결되지 않아 메시지 전송 실패')
      return false;
    }
  }, []);

  // 이벤트 리스너 등록
  const addEventListener = useCallback((eventType: string, listener: WebSocketEventListener) => {
    console.log('[WebSocket Hook] 이벤트 리스너 등록:', eventType)
    const client = clientRef.current;
    if (client) {
      client.on(eventType, listener);
      listenersRef.current.set(`${eventType}_${Date.now()}`, listener);
    }
  }, []);

  // 이벤트 리스너 제거
  const removeEventListener = useCallback((eventType: string, listener: WebSocketEventListener) => {
    console.log('[WebSocket Hook] 이벤트 리스너 제거:', eventType)
    const client = clientRef.current;
    if (client) {
      client.off(eventType, listener);
    }
  }, []);

  // 설정 업데이트 알림
  const notifySettingsUpdate = useCallback((category: string, settings: any) => {
    console.log('[WebSocket Hook] 설정 업데이트 알림 전송:', { category, settings })
    return sendMessage({
      type: 'settings_update',
      payload: { category, settings }
    });
  }, [sendMessage]);

  // 시스템 상태 알림
  const notifySystemStatus = useCallback((status: any) => {
    console.log('[WebSocket Hook] 시스템 상태 알림 전송:', status)
    return sendMessage({
      type: 'system_status',
      payload: status
    });
  }, [sendMessage]);

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    console.log('[WebSocket Hook] useEffect 실행 - 컴포넌트 마운트')
    if (typeof window === 'undefined') {
      console.log('[WebSocket Hook] 서버 사이드 환경 - useEffect 종료')
      return;
    }

    const client = initializeClient();
    if (!client) {
      console.log('[WebSocket Hook] 클라이언트 초기화 실패 - useEffect 종료')
      return;
    }

    // 전역 메시지 리스너 등록
    const globalListener: WebSocketEventListener = (message) => {
      console.log('[WebSocket Hook] 전역 메시지 수신:', message)
      updateState();
      onMessage?.(message);
    };

    console.log('[WebSocket Hook] 전역 리스너 등록')
    client.on('*', globalListener);

    // 자동 연결
    if (autoConnect) {
      console.log('[WebSocket Hook] 자동 연결 시작')
      connect();
    }

    // 상태 업데이트 인터벌
    const stateUpdateInterval = setInterval(() => {
      // 너무 많은 로그를 방지하기 위해 주석 처리
      // console.log('[WebSocket Hook] 정기 상태 업데이트')
      updateState();
    }, 1000);

    return () => {
      console.log('[WebSocket Hook] cleanup 함수 실행')
      clearInterval(stateUpdateInterval);
      client.off('*', globalListener);
      
      // 등록된 리스너들 정리
      listenersRef.current.forEach((listener, key) => {
        const [eventType] = key.split('_');
        client.off(eventType, listener);
      });
      listenersRef.current.clear();
      console.log('[WebSocket Hook] cleanup 완료')
    };
  }, [initializeClient, autoConnect, connect, updateState, onMessage]);

  return {
    // 상태
    ...state,
    
    // 메서드
    connect,
    disconnect,
    sendMessage,
    addEventListener,
    removeEventListener,
    
    // 유틸리티
    notifySettingsUpdate,
    notifySystemStatus,
    
    // 클라이언트 참조 (고급 사용)
    client: clientRef.current
  };
};

// 특정 이벤트 타입만 수신하는 Hook
export const useWebSocketEvent = (
  eventType: string,
  listener: WebSocketEventListener,
  dependencies: any[] = []
) => {
  const { addEventListener, removeEventListener } = useWebSocket({ autoConnect: false });

  useEffect(() => {
    addEventListener(eventType, listener);
    return () => removeEventListener(eventType, listener);
  }, [eventType, ...dependencies]);
};

// 설정 업데이트 전용 Hook
export const useSettingsSync = () => {
  const [lastUpdate, setLastUpdate] = useState<{
    category: string;
    settings: any;
    timestamp: string;
    updatedBy?: string;
  } | null>(null);

  const { notifySettingsUpdate, addEventListener, removeEventListener } = useWebSocket();

  useEffect(() => {
    const settingsListener: WebSocketEventListener = (message) => {
      if (message.type === 'settings_update') {
        setLastUpdate({
          category: message.payload.category,
          settings: message.payload.settings,
          timestamp: message.timestamp,
          updatedBy: message.payload.updatedBy
        });
      }
    };

    addEventListener('settings_update', settingsListener);
    return () => removeEventListener('settings_update', settingsListener);
  }, [addEventListener, removeEventListener]);

  return {
    lastUpdate,
    notifySettingsUpdate,
    clearLastUpdate: () => setLastUpdate(null)
  };
};

// 결함 감지 전용 Hook
export const useDefectDetection = () => {
  const [latestDefect, setLatestDefect] = useState<any>(null);
  const [defectCount, setDefectCount] = useState(0);

  const { addEventListener, removeEventListener } = useWebSocket();

  useEffect(() => {
    const defectListener: WebSocketEventListener = (message) => {
      if (message.type === 'defect_detected') {
        setLatestDefect(message.payload);
        setDefectCount(prev => prev + 1);
      }
    };

    addEventListener('defect_detected', defectListener);
    return () => removeEventListener('defect_detected', defectListener);
  }, [addEventListener, removeEventListener]);

  return {
    latestDefect,
    defectCount,
    clearLatestDefect: () => setLatestDefect(null),
    resetDefectCount: () => setDefectCount(0)
  };
};

export default useWebSocket; 