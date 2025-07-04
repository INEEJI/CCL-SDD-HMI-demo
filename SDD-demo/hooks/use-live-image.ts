import { useState, useEffect, useCallback, useRef } from 'react'

interface LiveImage {
  filename: string
  url: string
  timestamp: number
  type: string
  coil_number: string
  size?: number
  created_at?: Date
}

interface LiveImageResponse {
  success: boolean
  image: LiveImage
  total_images: number
  is_mock?: boolean
  is_file_watcher?: boolean
}

interface WebSocketMessage {
  type: 'image_update' | 'current_images'
  data: LiveImage | Record<string, LiveImage> | { type: string; deleted: boolean }
  timestamp: number
}

interface UseLiveImageOptions {
  imageType?: 'original' | 'labeled'
  coilNumber?: string
  enabled?: boolean
  websocketUrl?: string
}

export function useLiveImage(options: UseLiveImageOptions = {}) {
  const {
    imageType = 'original',
    coilNumber,
    enabled = true,
    websocketUrl = 'ws://localhost:8081'
  } = options

  const [currentImage, setCurrentImage] = useState<LiveImage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMock, setIsMock] = useState(false)
  const [totalImages, setTotalImages] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 3000

  // WebSocket 연결 설정
  const connectWebSocket = useCallback(() => {
    if (!enabled) return

    try {
      setIsLoading(true)
      setError(null)

      const ws = new WebSocket(websocketUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[useLiveImage] WebSocket 연결됨')
        setIsConnected(true)
        setIsLoading(false)
        setError(null)
        reconnectAttempts.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          handleWebSocketMessage(message)
        } catch (err) {
          console.error('[useLiveImage] WebSocket 메시지 파싱 오류:', err)
        }
      }

      ws.onclose = (event) => {
        console.log('[useLiveImage] WebSocket 연결 해제:', event.code, event.reason)
        setIsConnected(false)
        wsRef.current = null

        // 자동 재연결 (정상 종료가 아닌 경우)
        if (enabled && event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++
          console.log(`[useLiveImage] 재연결 시도 ${reconnectAttempts.current}/${maxReconnectAttempts}`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket()
          }, reconnectDelay * reconnectAttempts.current)
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setError('WebSocket 연결 실패: 최대 재연결 시도 횟수 초과')
          // 폴백으로 HTTP API 사용
          fallbackToHttpApi()
        }
      }

      ws.onerror = (error) => {
        console.error('[useLiveImage] WebSocket 오류:', error)
        setError('WebSocket 연결 오류')
        setIsLoading(false)
      }

    } catch (err) {
      console.error('[useLiveImage] WebSocket 연결 생성 오류:', err)
      setError('WebSocket 연결 생성 실패')
      setIsLoading(false)
      // 폴백으로 HTTP API 사용
      fallbackToHttpApi()
    }
  }, [enabled, websocketUrl])

  // WebSocket 메시지 처리
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'current_images':
        // 서버에서 현재 이미지 정보 수신
        const currentImagesData = message.data as Record<string, LiveImage>
        const searchKey = coilNumber ? `${imageType}_${coilNumber}` : imageType
        let image = currentImagesData[searchKey] || currentImagesData[imageType]
        
        if (image) {
          setCurrentImage(image)
          setIsMock(false)
          setTotalImages(Object.keys(currentImagesData).filter(key => 
            key.startsWith(imageType + '_') || key === imageType
          ).length)
        } else {
          // 실제 이미지가 없으면 폴백
          fallbackToHttpApi()
        }
        break

      case 'image_update':
        // 새 이미지 업데이트 수신
        const imageData = message.data as LiveImage | { type: string; deleted: boolean }
        
        if ('deleted' in imageData) {
          // 이미지 삭제됨
          if (imageData.type === imageType) {
            setCurrentImage(null)
            fallbackToHttpApi()
          }
        } else {
          // 새 이미지 추가/업데이트
          const newImage = imageData as LiveImage
          
          // 현재 설정에 맞는 이미지인지 확인
          const isRelevant = newImage.type === imageType && 
            (!coilNumber || newImage.coil_number === coilNumber)
          
          if (isRelevant) {
            setCurrentImage(newImage)
            setIsMock(false)
            setError(null)
          }
        }
        break
    }
  }, [imageType, coilNumber])

  // HTTP API 폴백
  const fallbackToHttpApi = useCallback(async () => {
    try {
      setIsLoading(true)
      
      const params = new URLSearchParams()
      if (coilNumber) {
        params.append('coil_number', coilNumber)
      }

      const url = `http://localhost:8081/latest/${imageType}?${params.toString()}`
      
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP API 조회 실패: ${response.status}`)
      }

      const data: LiveImageResponse = await response.json()

      if (data.success) {
        setCurrentImage(data.image)
        setTotalImages(data.total_images)
        setIsMock(data.is_mock || false)
        setError(null)
      } else {
        throw new Error('HTTP API 조회 실패')
      }

    } catch (err) {
      console.error('[useLiveImage] HTTP API 폴백 오류:', err)
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setIsLoading(false)
    }
  }, [imageType, coilNumber])

  // WebSocket 연결 해제
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Component unmounting')
      wsRef.current = null
    }

    setIsConnected(false)
  }, [])

  // 수동 새로고침
  const refreshImage = useCallback(() => {
    if (isConnected && wsRef.current) {
      // WebSocket이 연결되어 있으면 서버에서 현재 이미지 재요청
      // 실제로는 서버가 자동으로 최신 이미지를 보내므로 별도 액션 불필요
      console.log('[useLiveImage] WebSocket 연결됨 - 자동 업데이트 중')
    } else {
      // WebSocket이 연결되지 않았으면 HTTP API 사용
      fallbackToHttpApi()
    }
  }, [isConnected, fallbackToHttpApi])

  // 컴포넌트 마운트/언마운트 시 WebSocket 관리
  useEffect(() => {
    if (enabled) {
      connectWebSocket()
    } else {
      disconnectWebSocket()
    }

    return () => {
      disconnectWebSocket()
    }
  }, [enabled, connectWebSocket, disconnectWebSocket])

  // 옵션 변경 시 WebSocket 재연결
  useEffect(() => {
    if (enabled && isConnected) {
      // 이미 연결되어 있으면 현재 이미지 다시 요청
      fallbackToHttpApi()
    }
  }, [imageType, coilNumber])

  return {
    // 데이터
    currentImage,
    totalImages,
    isMock,
    
    // 상태
    isLoading,
    error,
    isConnected,
    
    // 액션
    refreshImage,
    connectWebSocket,
    disconnectWebSocket,
    
    // 유틸리티
    getImageUrl: (baseUrl?: string) => {
      if (!currentImage) return null
      
      // 목업 이미지인 경우 그대로 반환
      if (isMock) {
        return currentImage.url
      }
      
      // 실제 이미지인 경우 이미지 수신 서비스 URL 사용
      const imageServiceUrl = baseUrl || 'http://localhost:8081'
      return `${imageServiceUrl}${currentImage.url}`
    },
    
    // WebSocket 연결 상태
    connectionType: isConnected ? 'websocket' : (currentImage ? 'http' : 'none')
  }
}

// 이미지 목록 조회를 위한 별도 훅 (HTTP API 사용)
export function useImageList(options: UseLiveImageOptions & {
  page?: number
  limit?: number
  fromDate?: string
  toDate?: string
} = {}) {
  const {
    imageType = 'original',
    coilNumber,
    page = 1,
    limit = 20,
    fromDate,
    toDate,
    enabled = true
  } = options

  const [images, setImages] = useState<LiveImage[]>([])
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_images: 0,
    images_per_page: 20
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMock, setIsMock] = useState(false)

  const fetchImageList = useCallback(async () => {
    if (!enabled) return

    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })

      if (coilNumber) params.append('coil_number', coilNumber)
      if (fromDate) params.append('from_date', fromDate)
      if (toDate) params.append('to_date', toDate)

      const url = `http://localhost:8081/list/${imageType}?${params.toString()}`
      
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`이미지 목록 조회 실패: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setImages(data.images)
        setPagination(data.pagination)
        setIsMock(data.is_mock || false)
        setError(null)
      } else {
        throw new Error('이미지 목록 조회 실패')
      }

    } catch (err) {
      console.error('[useImageList] 이미지 목록 조회 오류:', err)
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setIsLoading(false)
    }
  }, [imageType, coilNumber, page, limit, fromDate, toDate, enabled])

  useEffect(() => {
    fetchImageList()
  }, [fetchImageList])

  return {
    images,
    pagination,
    isMock,
    isLoading,
    error,
    refreshList: fetchImageList
  }
} 