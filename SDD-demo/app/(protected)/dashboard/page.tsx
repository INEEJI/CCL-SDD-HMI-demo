"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  AlertTriangle, 
  Activity, 
  Zap, 
  Settings, 
  Bell, 
  Power, 
  Video, 
  CircuitBoard, 
  Info,
  Volume2,
  VolumeX,
  Camera,
  Lightbulb,
  Gauge,
  TrendingUp,
  Clock,
  History,
  Target,
  Thermometer,
  Wind,
  BarChart3,
  PieChart,
  Wifi,
  WifiOff
} from "lucide-react"
import CoilMapChart from "@/components/coil-map-chart"
import { useScheduleStore } from "@/lib/stores/scheduleStore"
import { mockSchedules } from "@/lib/data/mockSchedules"
import { toast } from "sonner"
import { 
  SettingsApi, 
  SensitivitySettings, 
  HardwareSettings, 
  NotificationSettings, 
  PeriodicPatternSettings 
} from "@/lib/api/settingsApi"
import { useWebSocket, useSettingsSync, useDefectDetection } from "@/hooks/use-websocket"

interface Defect {
  position: number;
  type: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  confidence: number;
}

interface PeriodicPattern {
  type: string;
  interval: number;
  count: number;
  lastDetected: Date;
  enabled: boolean;
}

export default function DashboardPage() {
  const [isSystemOn, setIsSystemOn] = useState(true)
  const [sensitivity, setSensitivity] = useState<SensitivitySettings>({
    scratch: 80,
    dent: 75,
    stain: 70,
    crack: 90,
    global: 80
  })
  const [defects, setDefects] = useState<Defect[]>([])
  const [periodicAlert, setPeriodicAlert] = useState<string | null>(null)
  const [periodicPatterns, setPeriodicPatterns] = useState<PeriodicPattern[]>([
    { type: 'Scratch', interval: 50, count: 3, lastDetected: new Date(), enabled: true },
    { type: 'Dent', interval: 100, count: 2, lastDetected: new Date(), enabled: true },
    { type: 'Stain', interval: 75, count: 4, lastDetected: new Date(), enabled: false }
  ])
  const [systemSettings, setSystemSettings] = useState<HardwareSettings>({
    cameraSpeed: 50,
    lighting: 80,
    temperature: 22,
    airPressure: 1.2,
    autoAdjustment: true
  })
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    soundEnabled: true,
    volume: 70,
    periodicAlerts: true,
    criticalAlerts: true,
    emailNotifications: false
  })
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showNotificationHistory, setShowNotificationHistory] = useState(false)
  const [notificationHistory, setNotificationHistory] = useState<Array<{
    id: string;
    type: 'periodic' | 'critical' | 'warning';
    message: string;
    timestamp: Date;
    acknowledged: boolean;
  }>>([])
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  
  const { selectedSchedule, setSchedules, selectSchedule } = useScheduleStore()
  const coilLength = 2000
  const lastNotificationTime = useRef(0)
  const [realTimeStats, setRealTimeStats] = useState({
    defectsPerHour: 0,
    averageConfidence: 0,
    systemUptime: 0,
    processedLength: 0
  })

  // WebSocket 실시간 동기화
  const { 
    isConnected, 
    isConnecting, 
    notifySettingsUpdate,
    notifySystemStatus 
  } = useWebSocket({
    autoConnect: true,
    onConnect: () => {
      console.log('대시보드 WebSocket 연결됨')
      toast.success('실시간 동기화 연결됨')
    },
    onDisconnect: () => {
      console.log('대시보드 WebSocket 연결 해제됨')
      toast.info('실시간 동기화 연결 해제됨')
    },
    onError: (error) => {
      console.error('대시보드 WebSocket 오류:', error)
    }
  })

  // 실시간 설정 동기화
  const { lastUpdate, clearLastUpdate } = useSettingsSync()

  // 실시간 결함 감지
  const { latestDefect, defectCount, clearLatestDefect } = useDefectDetection()

  // 백엔드에서 설정 로드
  const loadSettings = async () => {
    console.log('[대시보드] 설정 로드 시작')
    setIsLoadingSettings(true)
    try {
      console.log('[대시보드] API 호출 시작')
      const [
        sensitivityData,
        hardwareData,
        notificationData,
        periodicPatternData
      ] = await Promise.all([
        SettingsApi.getSensitivitySettings(),
        SettingsApi.getHardwareSettings(),
        SettingsApi.getNotificationSettings(),
        SettingsApi.getPeriodicPatternSettings()
      ])

      console.log('[대시보드] API 응답 받음:', {
        sensitivityData,
        hardwareData,
        notificationData,
        periodicPatternData
      })

      // 민감도 설정 적용
      console.log('[대시보드] 민감도 설정 적용 중:', sensitivityData)
      setSensitivity(sensitivityData)

      // 하드웨어 설정 적용
      console.log('[대시보드] 하드웨어 설정 적용 중:', hardwareData)
      setSystemSettings(hardwareData)

      // 알림 설정 적용
      console.log('[대시보드] 알림 설정 적용 중:', notificationData)
      setNotificationSettings(notificationData)

      // 주기성 패턴 설정 적용
      console.log('[대시보드] 주기성 패턴 설정 적용 중:', periodicPatternData)
      setPeriodicPatterns([
        { 
          type: 'Scratch', 
          interval: periodicPatternData.scratch.interval, 
          count: periodicPatternData.scratch.count, 
          lastDetected: new Date(), 
          enabled: periodicPatternData.scratch.enabled 
        },
        { 
          type: 'Dent', 
          interval: periodicPatternData.dent.interval, 
          count: periodicPatternData.dent.count, 
          lastDetected: new Date(), 
          enabled: periodicPatternData.dent.enabled 
        },
        { 
          type: 'Stain', 
          interval: periodicPatternData.stain.interval, 
          count: periodicPatternData.stain.count, 
          lastDetected: new Date(), 
          enabled: periodicPatternData.stain.enabled 
        },
        { 
          type: 'Crack', 
          interval: periodicPatternData.crack.interval, 
          count: periodicPatternData.crack.count, 
          lastDetected: new Date(), 
          enabled: periodicPatternData.crack.enabled 
        }
      ])

      console.log('[대시보드] 설정 로드 완료')
      toast.success('설정을 성공적으로 로드했습니다.')
    } catch (error) {
      console.error('[대시보드] 설정 로드 실패:', error)
      console.error('[대시보드] 오류 스택:', error instanceof Error ? error.stack : 'No stack trace')
      toast.error('설정을 로드하는데 실패했습니다.')
    } finally {
      setIsLoadingSettings(false)
      console.log('[대시보드] 설정 로드 프로세스 종료')
    }
  }

  // 설정 저장
  const saveSettings = async () => {
    console.log('[대시보드] 설정 저장 시작')
    setIsSavingSettings(true)
    try {
      console.log('[대시보드] 저장할 설정들:', {
        sensitivity,
        systemSettings,
        notificationSettings,
        periodicPatterns
      })

      await Promise.all([
        SettingsApi.updateSensitivitySettings(sensitivity),
        SettingsApi.updateHardwareSettings(systemSettings),
        SettingsApi.updateNotificationSettings(notificationSettings),
        SettingsApi.updatePeriodicPatternSettings({
          scratch: { 
            interval: periodicPatterns.find(p => p.type === 'Scratch')?.interval || 50,
            count: periodicPatterns.find(p => p.type === 'Scratch')?.count || 3,
            enabled: periodicPatterns.find(p => p.type === 'Scratch')?.enabled || true
          },
          dent: { 
            interval: periodicPatterns.find(p => p.type === 'Dent')?.interval || 100,
            count: periodicPatterns.find(p => p.type === 'Dent')?.count || 2,
            enabled: periodicPatterns.find(p => p.type === 'Dent')?.enabled || true
          },
          stain: { 
            interval: periodicPatterns.find(p => p.type === 'Stain')?.interval || 75,
            count: periodicPatterns.find(p => p.type === 'Stain')?.count || 4,
            enabled: periodicPatterns.find(p => p.type === 'Stain')?.enabled || false
          },
          crack: { 
            interval: periodicPatterns.find(p => p.type === 'Crack')?.interval || 100,
            count: periodicPatterns.find(p => p.type === 'Crack')?.count || 2,
            enabled: periodicPatterns.find(p => p.type === 'Crack')?.enabled || true
          }
        })
      ])

      console.log('[대시보드] 설정 저장 완료')
      toast.success('설정이 성공적으로 저장되었습니다.')
    } catch (error) {
      console.error('[대시보드] 설정 저장 실패:', error)
      console.error('[대시보드] 오류 스택:', error instanceof Error ? error.stack : 'No stack trace')
      toast.error('설정을 저장하는데 실패했습니다.')
    } finally {
      setIsSavingSettings(false)
      console.log('[대시보드] 설정 저장 프로세스 종료')
    }
  }

  // 모의 데이터 초기화 및 설정 로드
  useEffect(() => {
    console.log('[대시보드] 컴포넌트 마운트 - 초기화 시작')
    try {
      console.log('[대시보드] 스케줄 데이터 설정 중:', mockSchedules)
      setSchedules(mockSchedules)
      if (mockSchedules.length > 0) {
        console.log('[대시보드] 첫 번째 스케줄 선택:', mockSchedules[0])
        selectSchedule(mockSchedules[0])
      }
      
      // 백엔드에서 설정 로드
      console.log('[대시보드] 설정 로드 시작')
      loadSettings()
    } catch (error) {
      console.error('[대시보드] 초기화 중 오류:', error)
      console.error('[대시보드] 오류 스택:', error instanceof Error ? error.stack : 'No stack trace')
    }
  }, []) // 의존성 배열을 비워서 마운트 시에만 실행

  // 실시간 통계 업데이트
  useEffect(() => {
    console.log('[대시보드] 실시간 통계 업데이트 시작')
    const interval = setInterval(() => {
      if (isSystemOn) {
        setRealTimeStats(prev => {
          const newStats = {
            defectsPerHour: defects.length > 0 ? Math.round((defects.length / (prev.systemUptime + 1)) * 3600) : 0,
            averageConfidence: defects.length > 0 ? Math.round(defects.reduce((sum, d) => sum + d.confidence, 0) / defects.length) : 0,
            systemUptime: prev.systemUptime + 1,
            processedLength: prev.processedLength + 0.5
          }
          // 5초마다 로그 (너무 많은 로그 방지)
          if (newStats.systemUptime % 5 === 0) {
            console.log('[대시보드] 실시간 통계 업데이트:', newStats)
          }
          return newStats
        })
      }
    }, 1000)

    return () => {
      console.log('[대시보드] 실시간 통계 업데이트 정리')
      clearInterval(interval)
    }
  }, [isSystemOn, defects])

  // 실시간 설정 업데이트 처리
  useEffect(() => {
    if (lastUpdate) {
      console.log('[대시보드] 실시간 설정 업데이트 수신:', lastUpdate)
      
      try {
        // 설정 카테고리에 따라 상태 업데이트
        switch (lastUpdate.category) {
          case 'sensitivity':
            console.log('[대시보드] 민감도 설정 업데이트:', lastUpdate.settings)
            setSensitivity(prev => ({ ...prev, ...lastUpdate.settings }))
            toast.info('민감도 설정이 업데이트되었습니다.')
            break
          case 'hardware':
            console.log('[대시보드] 하드웨어 설정 업데이트:', lastUpdate.settings)
            setSystemSettings(prev => ({ ...prev, ...lastUpdate.settings }))
            toast.info('하드웨어 설정이 업데이트되었습니다.')
            break
          case 'notifications':
            console.log('[대시보드] 알림 설정 업데이트:', lastUpdate.settings)
            setNotificationSettings(prev => ({ ...prev, ...lastUpdate.settings }))
            toast.info('알림 설정이 업데이트되었습니다.')
            break
          case 'periodicPatterns':
            console.log('[대시보드] 주기성 패턴 설정 업데이트:', lastUpdate.settings)
            // 주기성 패턴 업데이트
            const patterns = lastUpdate.settings
            setPeriodicPatterns([
              { 
                type: 'Scratch', 
                interval: patterns.scratch?.interval || 50, 
                count: patterns.scratch?.count || 3, 
                lastDetected: new Date(), 
                enabled: patterns.scratch?.enabled ?? true 
              },
              { 
                type: 'Dent', 
                interval: patterns.dent?.interval || 100, 
                count: patterns.dent?.count || 2, 
                lastDetected: new Date(), 
                enabled: patterns.dent?.enabled ?? true 
              },
              { 
                type: 'Stain', 
                interval: patterns.stain?.interval || 75, 
                count: patterns.stain?.count || 4, 
                lastDetected: new Date(), 
                enabled: patterns.stain?.enabled ?? false 
              },
              { 
                type: 'Crack', 
                interval: patterns.crack?.interval || 60, 
                count: patterns.crack?.count || 2, 
                lastDetected: new Date(), 
                enabled: patterns.crack?.enabled ?? true 
              }
            ])
            toast.info('주기성 패턴 설정이 업데이트되었습니다.')
            break
          default:
            console.warn('[대시보드] 알 수 없는 설정 카테고리:', lastUpdate.category)
        }
        
        clearLastUpdate()
      } catch (error) {
        console.error('[대시보드] 실시간 설정 업데이트 처리 중 오류:', error)
        console.error('[대시보드] 오류 스택:', error instanceof Error ? error.stack : 'No stack trace')
      }
    }
  }, [lastUpdate, clearLastUpdate])

  // 실시간 결함 감지 처리
  useEffect(() => {
    if (latestDefect) {
      console.log('[대시보드] 새로운 결함 감지:', latestDefect)
      
      try {
        // 결함 목록에 추가
        const newDefect: Defect = {
          position: latestDefect.position || Math.random() * coilLength,
          type: latestDefect.type || 'Unknown',
          severity: latestDefect.severity || 'medium',
          timestamp: new Date(),
          confidence: latestDefect.confidence || 0.8
        }
        
        console.log('[대시보드] 새로운 결함 객체 생성:', newDefect)
        setDefects(prev => [...prev, newDefect])
        
        // 주기성 패턴 감지
        console.log('[대시보드] 주기성 패턴 감지 시작')
        detectPeriodicPatterns([newDefect])
        
        // 실시간 통계 업데이트
        setRealTimeStats(prev => ({
          ...prev,
          defectsPerHour: prev.defectsPerHour + 1,
          averageConfidence: (prev.averageConfidence + newDefect.confidence) / 2
        }))
        
        clearLatestDefect()
        console.log('[대시보드] 결함 감지 처리 완료')
      } catch (error) {
        console.error('[대시보드] 결함 감지 처리 중 오류:', error)
        console.error('[대시보드] 오류 스택:', error instanceof Error ? error.stack : 'No stack trace')
      }
    }
  }, [latestDefect]) // 의존성 배열 최소화

  // 알림 추가 함수 (useCallback으로 최적화)
  const addNotification = useCallback((type: 'periodic' | 'critical' | 'warning', message: string) => {
    console.log('[대시보드] 알림 추가:', { type, message })
    try {
      const notification = {
        id: Date.now().toString(),
        type,
        message,
        timestamp: new Date(),
        acknowledged: false
      }
      setNotificationHistory(prev => [notification, ...prev.slice(0, 49)]) // 최대 50개 유지
      
      if (notificationSettings.soundEnabled) {
        // 실제 환경에서는 사운드 재생
        console.log('[대시보드] 🔊 알림 사운드 재생:', message)
      }
    } catch (error) {
      console.error('[대시보드] 알림 추가 중 오류:', error)
    }
  }, [notificationSettings.soundEnabled])

  // 주기성 패턴 감지 개선 (useCallback으로 최적화)
  const detectPeriodicPatterns = useCallback((newDefects: Defect[]) => {
    console.log('[대시보드] 주기성 패턴 감지:', { newDefects, periodicPatterns })
    try {
      periodicPatterns.forEach(pattern => {
        if (!pattern.enabled) return
        
        const typeDefects = newDefects.filter(d => d.type === pattern.type).slice(-pattern.count)
        console.log('[대시보드] 패턴 분석:', { pattern: pattern.type, typeDefects })
        
        if (typeDefects.length >= pattern.count) {
          const intervals = []
          for (let i = 1; i < typeDefects.length; i++) {
            intervals.push(Math.abs(typeDefects[i].position - typeDefects[i-1].position))
          }
          
          const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
          const tolerance = pattern.interval * 0.2 // 20% 허용 오차
          
          console.log('[대시보드] 패턴 분석 결과:', { 
            avgInterval, 
            expectedInterval: pattern.interval, 
            tolerance,
            difference: Math.abs(avgInterval - pattern.interval)
          })
          
          if (Math.abs(avgInterval - pattern.interval) < tolerance) {
            const alertMessage = `주기성 ${pattern.type} 결함 감지! 약 ${Math.round(avgInterval)}m 간격으로 ${pattern.count}회 연속 발생`
            console.log('[대시보드] 주기성 패턴 감지됨:', alertMessage)
            toast.error(alertMessage)
            setPeriodicAlert(alertMessage)
            addNotification('periodic', alertMessage)
            setTimeout(() => setPeriodicAlert(null), 8000)
          }
        }
      })
    } catch (error) {
      console.error('[대시보드] 주기성 패턴 감지 중 오류:', error)
    }
  }, [periodicPatterns, addNotification]) // 의존성 배열 추가

  // 시스템 설정 업데이트 (백엔드 연동)
  const updateSystemSettings = async (key: keyof HardwareSettings, value: number | boolean) => {
    console.log('[대시보드] 시스템 설정 업데이트 시작:', { key, value })
    setSystemSettings(prev => ({ ...prev, [key]: value }))
    
    try {
      const updatedSettings = { ...systemSettings, [key]: value }
      console.log('[대시보드] 업데이트할 하드웨어 설정:', updatedSettings)
      
      await SettingsApi.updateHardwareSettings(updatedSettings)
      
      // WebSocket으로 실시간 설정 변경 알림
      if (isConnected) {
        console.log('[대시보드] WebSocket으로 하드웨어 설정 변경 알림 전송')
        notifySettingsUpdate('hardware', updatedSettings)
      }
      
      console.log('[대시보드] 시스템 설정 업데이트 완료:', key)
      toast.success(`${key} 설정이 업데이트되었습니다.`)
    } catch (error) {
      console.error('[대시보드] 시스템 설정 업데이트 실패:', error)
      console.error('[대시보드] 오류 스택:', error instanceof Error ? error.stack : 'No stack trace')
      toast.error('시스템 설정 업데이트에 실패했습니다.')
    }
  }

  // 민감도 설정 업데이트 (백엔드 연동)
  const updateSensitivity = async (type: keyof SensitivitySettings, value: number) => {
    console.log('[대시보드] 민감도 설정 업데이트 시작:', { type, value })
    let updatedSensitivity = { ...sensitivity, [type]: value }
    
    if (type === 'global') {
      console.log('[대시보드] 전역 민감도 변경 - 모든 타입에 적용')
      // 전역 민감도 변경 시 모든 타입에 적용
      updatedSensitivity = {
        ...sensitivity,
        scratch: value,
        dent: value,
        stain: value,
        crack: value,
        global: value
      }
    }
    
    console.log('[대시보드] 업데이트할 민감도 설정:', updatedSensitivity)
    setSensitivity(updatedSensitivity)
    
    try {
      await SettingsApi.updateSensitivitySettings(updatedSensitivity)
      
      // WebSocket으로 실시간 설정 변경 알림
      if (isConnected) {
        console.log('[대시보드] WebSocket으로 민감도 설정 변경 알림 전송')
        notifySettingsUpdate('sensitivity', updatedSensitivity)
      }
      
      console.log('[대시보드] 민감도 설정 업데이트 완료:', type)
      toast.success(`${type} 민감도가 업데이트되었습니다.`)
    } catch (error) {
      console.error('[대시보드] 민감도 설정 업데이트 실패:', error)
      console.error('[대시보드] 오류 스택:', error instanceof Error ? error.stack : 'No stack trace')
      toast.error('민감도 설정 업데이트에 실패했습니다.')
    }
  }

  // 알림 설정 업데이트 (백엔드 연동)
  const updateNotificationSettings = async (key: keyof NotificationSettings, value: boolean | number) => {
    console.log('[대시보드] 알림 설정 업데이트 시작:', { key, value })
    const updatedSettings = { ...notificationSettings, [key]: value }
    console.log('[대시보드] 업데이트할 알림 설정:', updatedSettings)
    setNotificationSettings(updatedSettings)
    
    try {
      await SettingsApi.updateNotificationSettings(updatedSettings)
      
      // WebSocket으로 실시간 설정 변경 알림
      if (isConnected) {
        console.log('[대시보드] WebSocket으로 알림 설정 변경 알림 전송')
        notifySettingsUpdate('notifications', updatedSettings)
      }
      
      console.log('[대시보드] 알림 설정 업데이트 완료:', key)
      toast.success(`알림 설정이 업데이트되었습니다.`)
    } catch (error) {
      console.error('[대시보드] 알림 설정 업데이트 실패:', error)
      console.error('[대시보드] 오류 스택:', error instanceof Error ? error.stack : 'No stack trace')
      toast.error('알림 설정 업데이트에 실패했습니다.')
    }
  }

  // 주기성 패턴 설정 업데이트 (백엔드 연동)
  const updatePeriodicPattern = async (type: string, key: 'interval' | 'count' | 'enabled', value: number | boolean) => {
    console.log('[대시보드] 주기성 패턴 설정 업데이트 시작:', { type, key, value })
    const updatedPatterns = periodicPatterns.map(pattern => 
      pattern.type === type ? { ...pattern, [key]: value } : pattern
    )
    console.log('[대시보드] 업데이트된 패턴 목록:', updatedPatterns)
    setPeriodicPatterns(updatedPatterns)
    
    try {
      const patternsForAPI: PeriodicPatternSettings = {
        scratch: updatedPatterns.find(p => p.type === 'Scratch') || { interval: 50, count: 3, enabled: true },
        dent: updatedPatterns.find(p => p.type === 'Dent') || { interval: 100, count: 2, enabled: true },
        stain: updatedPatterns.find(p => p.type === 'Stain') || { interval: 75, count: 4, enabled: false },
        crack: updatedPatterns.find(p => p.type === 'Crack') || { interval: 100, count: 2, enabled: true }
      }
      
      console.log('[대시보드] API로 전송할 패턴 설정:', patternsForAPI)
      await SettingsApi.updatePeriodicPatternSettings(patternsForAPI)
      
      // WebSocket으로 실시간 설정 변경 알림
      if (isConnected) {
        console.log('[대시보드] WebSocket으로 주기성 패턴 설정 변경 알림 전송')
        notifySettingsUpdate('periodicPatterns', patternsForAPI)
      }
      
      console.log('[대시보드] 주기성 패턴 설정 업데이트 완료:', { type, key })
      toast.success(`${type} 주기성 패턴이 업데이트되었습니다.`)
    } catch (error) {
      console.error('[대시보드] 주기성 패턴 설정 업데이트 실패:', error)
      console.error('[대시보드] 오류 스택:', error instanceof Error ? error.stack : 'No stack trace')
      toast.error('주기성 패턴 설정 업데이트에 실패했습니다.')
    }
  }

  const systemStats = [
    { label: "검출된 결함", value: defects.length, icon: AlertTriangle, color: "text-red-400" },
    { label: "시간당 결함", value: realTimeStats.defectsPerHour, icon: Clock, color: "text-orange-400" },
    { label: "평균 신뢰도", value: `${realTimeStats.averageConfidence}%`, icon: Target, color: "text-green-400" },
    { label: "시스템 가동시간", value: `${Math.floor(realTimeStats.systemUptime / 3600)}h ${Math.floor((realTimeStats.systemUptime % 3600) / 60)}m`, icon: Activity, color: "text-blue-400" },
    { label: "처리된 길이", value: `${realTimeStats.processedLength.toFixed(1)}m`, icon: TrendingUp, color: "text-purple-400" },
    { label: "전역 민감도", value: `${sensitivity.global}%`, icon: Zap, color: "text-yellow-400" }
  ]

  const getDefectColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'high': return '높음'
      case 'medium': return '중간'
      case 'low': return '낮음'
      default: return '알 수 없음'
    }
  }

  // 로딩 상태 체크
  if (isLoadingSettings) {
    return (
      <div className="min-h-screen aurora-bg p-6 flex items-center justify-center">
        <div className="glass-panel rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">설정을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen aurora-bg p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="glass-panel rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">실시간 결함 모니터링 대시보드</h1>
              <p className="text-white/80">CCL 표면 결함 검사 시스템 - 고도화 버전</p>
            </div>
            <div className="flex items-center gap-4">
              <Badge className={`px-4 py-2 ${isSystemOn ? 'bg-green-500' : 'bg-red-500'}`}>
                {isSystemOn ? "시스템 가동 중" : "시스템 중지"}
              </Badge>
              {/* WebSocket 연결 상태 표시 */}
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <Wifi className="w-4 h-4 text-green-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-400" />
                )}
                <Badge variant="outline" className={`text-white border-white/20 ${
                  isConnected ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                  {isConnecting ? '연결 중...' : isConnected ? '실시간 동기화' : '연결 해제됨'}
                </Badge>
              </div>
              <Dialog open={showNotificationHistory} onOpenChange={setShowNotificationHistory}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-white border-white/20">
                    <History className="h-4 w-4 mr-2" />
                    알림 이력 ({notificationHistory.filter(n => !n.acknowledged).length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>알림 이력</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    {notificationHistory.map(notification => (
                      <div 
                        key={notification.id} 
                        className={`p-3 rounded-lg border ${
                          notification.acknowledged ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={
                                notification.type === 'critical' ? 'destructive' :
                                notification.type === 'periodic' ? 'default' : 'secondary'
                              }>
                                {notification.type === 'critical' ? '심각' :
                                 notification.type === 'periodic' ? '주기성' : '경고'}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {notification.timestamp.toLocaleString('ko-KR')}
                              </span>
                            </div>
                            <p className="text-sm">{notification.message}</p>
                          </div>
                          {!notification.acknowledged && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setNotificationHistory(prev => 
                                  prev.map(n => n.id === notification.id ? {...n, acknowledged: true} : n)
                                )
                              }}
                            >
                              확인
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {notificationHistory.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        알림 이력이 없습니다.
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* 주기성 결함 알림 */}
        {periodicAlert && (
          <Alert className="bg-red-500/20 border-red-500/50 glass-panel">
            <Bell className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-400 font-semibold">{periodicAlert}</AlertDescription>
          </Alert>
        )}

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {systemStats.map((stat, index) => (
            <Card key={index} className="glass-card border-white/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-xs">{stat.label}</p>
                    <p className="text-lg font-bold text-white mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg bg-white/10`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 flex flex-col gap-6">
            {/* 실시간 영상 스트림 */}
            <Card className="glass-card border-white/20 flex-grow-[3] flex flex-col">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <div className="flex items-center">
                    <Video className="text-blue-400 mr-2" />
                    실시간 영상 스트림
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-white border-white/20">
                      {systemSettings.cameraSpeed}% 속도
                    </Badge>
                    <Badge variant="outline" className="text-white border-white/20">
                      조명 {systemSettings.lighting}%
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow bg-gray-900 rounded-b-lg flex items-center justify-center text-white p-4">
                {isSystemOn ? (
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
                    <p>카메라 스트림 연결 중...</p>
                    <p className="text-sm text-white/60 mt-2">
                      온도: {systemSettings.temperature}°C | 압력: {systemSettings.airPressure}bar
                    </p>
                  </div>
                ) : (
                  <p>시스템이 중지되었습니다</p>
                )}
              </CardContent>
            </Card>

            {/* 코일별 결함 시각화 차트 */}
            <Card className="glass-card border-white/20 flex-grow-[2] flex flex-col">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <div className="flex items-center">
                    <CircuitBoard className="text-purple-400 mr-2" />
                    코일별 결함 시각화
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-white border-white/20">
                      총 {defects.length}개 결함
                    </Badge>
                    {selectedSchedule && (
                      <Badge variant="outline" className="text-white border-white/20">
                        {selectedSchedule.coilId}
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex-grow">
                <CoilMapChart 
                  coilLength={coilLength} 
                  defects={defects.map(defect => ({
                    ...defect,
                    id: Math.random() // 임시 ID
                  }))}
                  coilId={selectedSchedule?.coilId || "COIL-001"}
                  onDefectClick={(defect) => {
                    toast.info(`결함 정보: ${defect.type} (위치: ${defect.position}m, 신뢰도: ${defect.confidence}%)`)
                  }}
                  height={400}
                />
              </CardContent>
            </Card>
          </div>

          {/* 운영 제어판 */}
          <div className="xl:col-span-1 space-y-6">
            {/* 시스템 제어 */}
            <Card className="glass-card border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <div className="flex items-center">
                    <Settings className="text-green-400 mr-2" />
                    시스템 제어
                  </div>
                  <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-white">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>고급 시스템 설정</DialogTitle>
                      </DialogHeader>
                      <Tabs defaultValue="sensitivity" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="sensitivity">민감도</TabsTrigger>
                          <TabsTrigger value="system">시스템</TabsTrigger>
                          <TabsTrigger value="patterns">패턴</TabsTrigger>
                          <TabsTrigger value="notifications">알림</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="sensitivity" className="space-y-4">
                          <div className="space-y-4">
                            <div>
                              <Label>전역 민감도 (모든 결함 유형)</Label>
                              <div className="flex items-center space-x-4 mt-2">
                                <Slider 
                                  value={[sensitivity.global]} 
                                  onValueChange={([value]) => updateSensitivity('global', value)}
                                  max={100} 
                                  step={1} 
                                  className="flex-1" 
                                />
                                <span className="text-sm font-bold w-12">{sensitivity.global}%</span>
                              </div>
                            </div>
                            
                            {Object.entries(sensitivity).filter(([key]) => key !== 'global').map(([type, value]) => (
                              <div key={type}>
                                <Label className="capitalize">{type} 민감도</Label>
                                <div className="flex items-center space-x-4 mt-2">
                                  <Slider 
                                    value={[value]} 
                                    onValueChange={([newValue]) => updateSensitivity(type as keyof SensitivitySettings, newValue)}
                                    max={100} 
                                    step={1} 
                                    className="flex-1" 
                                  />
                                  <span className="text-sm font-bold w-12">{value}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="system" className="space-y-4">
                          <div className="space-y-4">
                            <div>
                              <Label>카메라 속도</Label>
                              <div className="flex items-center space-x-4 mt-2">
                                <Slider 
                                  value={[systemSettings.cameraSpeed]} 
                                  onValueChange={([value]) => updateSystemSettings('cameraSpeed', value)}
                                  max={100} 
                                  step={5} 
                                  className="flex-1" 
                                />
                                <span className="text-sm font-bold w-12">{systemSettings.cameraSpeed}%</span>
                              </div>
                            </div>
                            
                            <div>
                              <Label>조명 밝기</Label>
                              <div className="flex items-center space-x-4 mt-2">
                                <Slider 
                                  value={[systemSettings.lighting]} 
                                  onValueChange={([value]) => updateSystemSettings('lighting', value)}
                                  max={100} 
                                  step={5} 
                                  className="flex-1" 
                                />
                                <span className="text-sm font-bold w-12">{systemSettings.lighting}%</span>
                              </div>
                            </div>
                            
                            <div>
                              <Label>시스템 온도 (°C)</Label>
                              <div className="flex items-center space-x-4 mt-2">
                                <Slider 
                                  value={[systemSettings.temperature]} 
                                  onValueChange={([value]) => updateSystemSettings('temperature', value)}
                                  min={15}
                                  max={30} 
                                  step={1} 
                                  className="flex-1" 
                                />
                                <span className="text-sm font-bold w-12">{systemSettings.temperature}°C</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <Label>자동 조정</Label>
                              <Switch 
                                checked={systemSettings.autoAdjustment}
                                onCheckedChange={(checked) => updateSystemSettings('autoAdjustment', checked)}
                              />
                            </div>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="patterns" className="space-y-4">
                          <div className="space-y-4">
                            {periodicPatterns.map((pattern, index) => (
                              <div key={index} className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="font-semibold">{pattern.type} 패턴</Label>
                                  <Switch 
                                    checked={pattern.enabled}
                                    onCheckedChange={(checked) => {
                                      updatePeriodicPattern(pattern.type, 'enabled', checked)
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">간격 (m)</Label>
                                  <Input 
                                    type="number" 
                                    value={pattern.interval}
                                    onChange={(e) => {
                                      updatePeriodicPattern(pattern.type, 'interval', Number(e.target.value))
                                    }}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">감지 횟수</Label>
                                  <Input 
                                    type="number" 
                                    value={pattern.count}
                                    onChange={(e) => {
                                      updatePeriodicPattern(pattern.type, 'count', Number(e.target.value))
                                    }}
                                    className="mt-1"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="notifications" className="space-y-4">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label>음성 알림</Label>
                              <Switch 
                                checked={notificationSettings.soundEnabled}
                                onCheckedChange={(checked) => 
                                  updateNotificationSettings('soundEnabled', checked)
                                }
                              />
                            </div>
                            
                            {notificationSettings.soundEnabled && (
                              <div>
                                <Label>음량</Label>
                                <div className="flex items-center space-x-4 mt-2">
                                  <Slider 
                                    value={[notificationSettings.volume]} 
                                    onValueChange={([value]) => 
                                      updateNotificationSettings('volume', value)
                                    }
                                    max={100} 
                                    step={5} 
                                    className="flex-1" 
                                  />
                                  <span className="text-sm font-bold w-12">{notificationSettings.volume}%</span>
                                </div>
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between">
                              <Label>주기성 결함 알림</Label>
                              <Switch 
                                checked={notificationSettings.periodicAlerts}
                                onCheckedChange={(checked) => 
                                  updateNotificationSettings('periodicAlerts', checked)
                                }
                              />
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <Label>심각한 결함 알림</Label>
                              <Switch 
                                checked={notificationSettings.criticalAlerts}
                                onCheckedChange={(checked) => 
                                  updateNotificationSettings('criticalAlerts', checked)
                                }
                              />
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <Label>이메일 알림</Label>
                              <Switch 
                                checked={notificationSettings.emailNotifications}
                                onCheckedChange={(checked) => 
                                  updateNotificationSettings('emailNotifications', checked)
                                }
                              />
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                      
                      {/* 설정 관리 버튼들 */}
                      <div className="flex justify-between items-center pt-4 border-t">
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={loadSettings}
                            disabled={isLoadingSettings || isSavingSettings}
                          >
                            {isLoadingSettings ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                                로드 중...
                              </>
                            ) : (
                              '설정 다시 로드'
                            )}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              if (confirm('모든 설정을 초기값으로 되돌리시겠습니까?')) {
                                try {
                                  await loadSettings()
                                  toast.success('설정이 초기화되었습니다.')
                                } catch (error) {
                                  toast.error('설정 초기화에 실패했습니다.')
                                }
                              }
                            }}
                            disabled={isLoadingSettings || isSavingSettings}
                          >
                            초기화
                          </Button>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setShowSettingsDialog(false)}
                            disabled={isLoadingSettings || isSavingSettings}
                          >
                            취소
                          </Button>
                          <Button 
                            size="sm"
                            onClick={async () => {
                              await saveSettings()
                              setShowSettingsDialog(false)
                            }}
                            disabled={isLoadingSettings || isSavingSettings}
                          >
                            {isSavingSettings ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                저장 중...
                              </>
                            ) : (
                              '설정 저장'
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 시스템 전원 */}
                <div className="space-y-2">
                  <Label className="text-white text-sm font-semibold">시스템 전원</Label>
                  <button
                    onClick={() => setIsSystemOn(!isSystemOn)}
                    className={`w-full flex items-center justify-center px-4 py-3 rounded-md font-bold text-white transition-colors shadow-sm ${isSystemOn ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                  >
                    <Power className="w-4 h-4 mr-2" />
                    {isSystemOn ? '시스템 중지' : '시스템 시작'}
                  </button>
                </div>

                {/* 빠른 민감도 조절 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-white">전역 민감도</Label>
                    <span className="text-blue-400 font-bold text-lg">{sensitivity.global}%</span>
                  </div>
                  <Slider 
                    value={[sensitivity.global]} 
                    onValueChange={([value]) => updateSensitivity('global', value)}
                    max={100} 
                    step={1} 
                    className="w-full" 
                  />
                </div>

                {/* 시스템 상태 */}
                <div className="space-y-2">
                  <Label className="text-white text-sm font-semibold">시스템 상태</Label>
                  <div className="bg-white/5 p-3 rounded-md border border-white/10 space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80 flex items-center">
                        <Thermometer className="w-3 h-3 mr-1" />
                        온도:
                      </span>
                      <span className="text-white font-semibold">{systemSettings.temperature}°C</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80 flex items-center">
                        <Wind className="w-3 h-3 mr-1" />
                        압력:
                      </span>
                      <span className="text-white font-semibold">{systemSettings.airPressure}bar</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80 flex items-center">
                        <Camera className="w-3 h-3 mr-1" />
                        카메라:
                      </span>
                      <span className="text-white font-semibold">{systemSettings.cameraSpeed}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80 flex items-center">
                        <Lightbulb className="w-3 h-3 mr-1" />
                        조명:
                      </span>
                      <span className="text-white font-semibold">{systemSettings.lighting}%</span>
                    </div>
                  </div>
                </div>

                {/* 현재 코일 정보 */}
                <div className="space-y-2">
                  <Label className="text-white text-sm font-semibold">현재 코일 정보</Label>
                  {selectedSchedule ? (
                    <div className="bg-white/5 p-3 rounded-md border border-white/10 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-white/80">코일 ID:</span>
                        <span className="text-white font-mono font-semibold">{selectedSchedule.coilId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/80">고객사:</span>
                        <span className="text-white font-semibold">{selectedSchedule.customerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/80">BOM ID:</span>
                        <span className="text-white font-mono font-semibold">{selectedSchedule.bomId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/80">진행률:</span>
                        <span className="text-white font-semibold">{Math.round((realTimeStats.processedLength / coilLength) * 100)}%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/5 p-4 rounded-md border border-white/10 text-center text-sm text-white/60">
                      <Info className="mx-auto h-6 w-6 mb-2" />
                      선택된 코일 없음
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 최근 결함 */}
            <Card className="glass-card border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span>최근 검출된 결함</span>
                  <div className="flex items-center">
                    {notificationSettings.soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {defects.slice(-5).reverse().map((defect, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{defect.type}</p>
                        <p className="text-white/60 text-xs">
                          위치: {defect.position}m | 신뢰도: {defect.confidence}%
                        </p>
                        <p className="text-white/40 text-xs">
                          {defect.timestamp.toLocaleTimeString('ko-KR')}
                        </p>
                      </div>
                      <Badge className={getDefectColor(defect.severity)}>
                        {getSeverityLabel(defect.severity)}
                      </Badge>
                    </div>
                  ))}
                  {defects.length === 0 && (
                    <div className="text-center text-white/60 text-sm py-4">
                      검출된 결함이 없습니다
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 결함 통계 */}
            <Card className="glass-card border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <BarChart3 className="text-blue-400 mr-2" />
                  결함 유형별 통계
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['Scratch', 'Dent', 'Stain', 'Crack'].map(type => {
                    const count = defects.filter(d => d.type === type).length
                    const percentage = defects.length > 0 ? Math.round((count / defects.length) * 100) : 0
                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-white">{type}</span>
                          <span className="text-white/80">{count}개 ({percentage}%)</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
