"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Camera,
  Wifi,
  Database,
  Lightbulb,
  Cpu,
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle,
  Settings,
  RefreshCw,
  Stethoscope,
  Play,
  History,
  ExternalLink,
  Clock,
  XCircle,
  AlertCircle,
  Monitor,
  TestTube,
  Network,
  Loader2
} from "lucide-react"
import {
  SystemDiagnostic,
  DiagnosticService,
  DiagnosticType,
  DiagnosticStatus,
  diagnosticsApi,
  diagnosticServicesApi,
  diagnosticsUtils,
  DIAGNOSTIC_TYPE_OPTIONS,
  DIAGNOSTIC_STATUS_OPTIONS
} from "@/lib/api/diagnosticsApi"

// 진단 유형별 아이콘 매핑
const DIAGNOSTIC_ICONS = {
  camera_calibration: Camera,
  equipment_status: Monitor,
  test_pattern: TestTube,
  system_health: Activity,
  network_test: Network
}

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostic[]>([])
  const [services, setServices] = useState<DiagnosticService[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<DiagnosticService | null>(null)
  const [iframeDialogOpen, setIframeDialogOpen] = useState(false)
  const [currentDiagnostic, setCurrentDiagnostic] = useState<SystemDiagnostic | null>(null)
  
  // 필터 상태
  const [filters, setFilters] = useState({
    type: '' as DiagnosticType | '',
    status: '' as DiagnosticStatus | '',
    page: 1,
    limit: 10
  })

  // 데이터 로드
  useEffect(() => {
    loadData()
  }, [filters])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 진단 이력과 서비스 목록을 병렬로 로드
      const [diagnosticsResult, servicesResult] = await Promise.all([
        diagnosticsApi.getDiagnostics({
          page: filters.page,
          limit: filters.limit,
          type: filters.type || undefined,
          status: filters.status || undefined
        }),
        diagnosticServicesApi.getServices({ active: true })
      ])

      if (diagnosticsResult.success) {
        setDiagnostics(diagnosticsResult.data)
      }

      if (servicesResult.success && servicesResult.data) {
        setServices(servicesResult.data)
      }
    } catch (err) {
      console.error('데이터 로드 중 오류:', err)
      setError('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 진단 시작
  const startDiagnostic = async (diagnosticType: DiagnosticType, service?: DiagnosticService) => {
    try {
      const response = await diagnosticsApi.createDiagnostic({
        diagnostic_type: diagnosticType,
        description: `${diagnosticsUtils.getDiagnosticTypeLabel(diagnosticType)} 진단`,
        external_service_url: service?.iframe_url || service?.service_url,
        parameters: service?.configuration
      })

      if (response.success && response.data) {
        setCurrentDiagnostic(response.data)
        
        // 외부 서비스가 있으면 iframe으로 열기
        if (service?.iframe_url) {
          setSelectedService(service)
          setIframeDialogOpen(true)
        }
        
        // 진단 목록 새로고침
        loadData()
      }
    } catch (err) {
      console.error('진단 시작 중 오류:', err)
      setError('진단을 시작하는 중 오류가 발생했습니다.')
    }
  }

  // 진단 완료 처리
  const completeDiagnostic = async (diagnosticId: number, results?: any) => {
    try {
      await diagnosticsApi.updateDiagnostic(diagnosticId, {
        status: 'completed',
        results: results
      })
      
      setIframeDialogOpen(false)
      setCurrentDiagnostic(null)
      loadData()
    } catch (err) {
      console.error('진단 완료 처리 중 오류:', err)
      setError('진단 완료 처리 중 오류가 발생했습니다.')
    }
  }

  // 상태별 아이콘 및 색상
  const getStatusIcon = (status: DiagnosticStatus) => {
    switch (status) {
      case 'in_progress':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-gray-500" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">데이터를 불러오는 중...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">시스템 진단</h1>
        <Button variant="outline" onClick={() => loadData()}>
          새로고침
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="diagnostics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="diagnostics">진단 실행</TabsTrigger>
          <TabsTrigger value="history">진단 이력</TabsTrigger>
          <TabsTrigger value="services">외부 서비스</TabsTrigger>
        </TabsList>

        {/* 진단 실행 탭 */}
        <TabsContent value="diagnostics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DIAGNOSTIC_TYPE_OPTIONS.map((option) => {
              const Icon = DIAGNOSTIC_ICONS[option.value]
              const relatedService = services.find(s => 
                s.supported_diagnostics?.includes(option.value) || 
                s.service_type === option.value
              )

              return (
                <Card key={option.value} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <Icon className="h-8 w-8 text-blue-500" />
                      <div>
                        <CardTitle className="text-lg">{option.label}</CardTitle>
                        {relatedService && (
                          <p className="text-sm text-gray-500 mt-1">
                            {relatedService.service_name} 연동
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        {option.value === 'camera_calibration' && '카메라 교정 및 정렬 상태를 확인합니다.'}
                        {option.value === 'equipment_status' && '장비의 전반적인 상태를 점검합니다.'}
                        {option.value === 'test_pattern' && '테스트 패턴을 사용하여 검사 정확도를 확인합니다.'}
                        {option.value === 'system_health' && '시스템 전반의 건강 상태를 진단합니다.'}
                        {option.value === 'network_test' && '네트워크 연결 상태를 테스트합니다.'}
                      </p>
                      <Button 
                        onClick={() => startDiagnostic(option.value, relatedService)}
                        className="w-full"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        진단 시작
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* 진단 이력 탭 */}
        <TabsContent value="history" className="space-y-4">
          {/* 필터 */}
          <Card>
            <CardHeader>
              <CardTitle>필터</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="type-filter">진단 유형</Label>
                  <Select 
                    value={filters.type} 
                    onValueChange={(value) => setFilters({...filters, type: value as DiagnosticType | '', page: 1})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">전체</SelectItem>
                      {DIAGNOSTIC_TYPE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status-filter">상태</Label>
                  <Select 
                    value={filters.status} 
                    onValueChange={(value) => setFilters({...filters, status: value as DiagnosticStatus | '', page: 1})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">전체</SelectItem>
                      {DIAGNOSTIC_STATUS_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button onClick={() => setFilters({type: '', status: '', page: 1, limit: 10})}>
                    필터 초기화
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 진단 이력 테이블 */}
          <Card>
            <CardHeader>
              <CardTitle>진단 이력</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>진단 유형</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>실행자</TableHead>
                    <TableHead>시작 시간</TableHead>
                    <TableHead>소요 시간</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diagnostics.map((diagnostic) => (
                    <TableRow key={diagnostic.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {(() => {
                            const Icon = DIAGNOSTIC_ICONS[diagnostic.diagnostic_type]
                            return <Icon className="h-4 w-4" />
                          })()}
                          <span>{diagnosticsUtils.getDiagnosticTypeLabel(diagnostic.diagnostic_type)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          diagnostic.status === 'completed' ? 'default' :
                          diagnostic.status === 'failed' ? 'destructive' :
                          diagnostic.status === 'in_progress' ? 'secondary' : 'outline'
                        }>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(diagnostic.status)}
                            <span>{diagnosticsUtils.getDiagnosticStatusLabel(diagnostic.status)}</span>
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>{diagnostic.performed_by_name}</TableCell>
                      <TableCell>{new Date(diagnostic.started_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {diagnosticsUtils.getDiagnosticDuration(diagnostic.started_at, diagnostic.completed_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {diagnostic.external_service_url && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                // 외부 서비스 URL로 이동
                                window.open(diagnostic.external_service_url, '_blank')
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          {diagnostic.status === 'in_progress' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => completeDiagnostic(diagnostic.id)}
                            >
                              완료
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 외부 서비스 탭 */}
        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>등록된 외부 진단 서비스</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((service) => (
                  <Card key={service.id} className="border-l-4 border-l-blue-500">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{service.service_name}</CardTitle>
                        <Badge variant={service.is_active ? 'default' : 'secondary'}>
                          {service.is_active ? '활성' : '비활성'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {diagnosticsUtils.getServiceTypeLabel(service.service_type)}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {service.description && (
                          <p className="text-sm text-gray-700">{service.description}</p>
                        )}
                        
                        {service.supported_diagnostics && service.supported_diagnostics.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">지원 진단:</p>
                            <div className="flex flex-wrap gap-1">
                              {service.supported_diagnostics.map((type) => (
                                <Badge key={type} variant="outline" className="text-xs">
                                  {diagnosticsUtils.getDiagnosticTypeLabel(type)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(service.service_url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            서비스 열기
                          </Button>
                          
                          {service.iframe_url && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedService(service)
                                setIframeDialogOpen(true)
                              }}
                            >
                              <Monitor className="h-4 w-4 mr-1" />
                              통합 실행
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 외부 서비스 iframe 다이얼로그 */}
      <Dialog open={iframeDialogOpen} onOpenChange={setIframeDialogOpen}>
        <DialogContent className="max-w-6xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedService?.service_name} - 진단 서비스
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {selectedService?.iframe_url && (
              <iframe
                src={selectedService.iframe_url}
                className="w-full h-full border-0 rounded-lg"
                title={selectedService.service_name}
                allow="fullscreen"
              />
            )}
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIframeDialogOpen(false)}>
              닫기
            </Button>
            {currentDiagnostic && (
              <Button onClick={() => completeDiagnostic(currentDiagnostic.id)}>
                진단 완료
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
