'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Calendar,
  User,
  Shield,
  Settings,
  AlertTriangle,
  Info,
  Eye,
  Trash2,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

// 타입 정의
interface AuditLog {
  logId: number;
  timestamp: string;
  user: {
    id: number;
    username: string;
    role: string;
  };
  sessionId: string;
  action: string;
  resource: {
    type: string;
    id: string;
    name: string;
  };
  changes: {
    oldValues: any;
    newValues: any;
    changedFields: string[];
  };
  request: {
    ipAddress: string;
    userAgent: string;
    method: string;
    url: string;
  };
  result: {
    status: string;
    errorMessage?: string;
    executionTimeMs: number;
  };
  metadata: {
    category: string;
    severity: string;
    tags: string[];
    additionalData: any;
  };
  settingsChange?: {
    changeId: number;
    category: string;
    key: string;
    path: string;
    oldValue: string;
    newValue: string;
    changeType: string;
    impactLevel: string;
    requiresRestart: boolean;
    affectsComponents: string[];
    validationStatus: string;
    validationMessage?: string;
  };
  securityEvent?: {
    eventId: number;
    eventType: string;
    threatLevel: string;
    attemptedUsername?: string;
    authenticationMethod?: string;
    requestedResource?: string;
    requiredPermission?: string;
    actionTaken: string;
  };
  userActivity?: {
    activityId: number;
    activityType: string;
    pageUrl?: string;
    deviceType?: string;
    browserName?: string;
    sessionDuration?: number;
  };
}

interface AuditLogFilters {
  userId?: string;
  username?: string;
  action?: string;
  resourceType?: string;
  category?: string;
  severity?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  ipAddress?: string;
  search?: string;
}

interface AuditLogStatistics {
  totalLogs: number;
  uniqueUsers: number;
  activeDays: number;
  createActions: number;
  updateActions: number;
  deleteActions: number;
  loginActions: number;
  logoutActions: number;
  settingsChanges: number;
  userChanges: number;
  backupActions: number;
  permissionChanges: number;
  infoLogs: number;
  warningLogs: number;
  errorLogs: number;
  criticalLogs: number;
  successfulActions: number;
  failedActions: number;
  avgExecutionTimeMs: number;
  maxExecutionTimeMs: number;
  lastActivity: string;
}

interface AuditLogResponse {
  success: boolean;
  data: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: AuditLogFilters;
  sorting: {
    sortBy: string;
    sortOrder: string;
  };
  statistics?: AuditLogStatistics;
}

export default function AuditLogViewer() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [statistics, setStatistics] = useState<AuditLogStatistics | null>(null);
  
  // 필터 상태
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [includeStats, setIncludeStats] = useState(false);
  
  // 정렬 상태
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // 선택된 로그 상세 보기
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // 감사 로그 조회
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
        includeStats: includeStats.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        )
      });
      
      const response = await fetch(`/api/audit-logs?${params}`);
      
      if (!response.ok) {
        throw new Error('감사 로그 조회 실패');
      }
      
      const data: AuditLogResponse = await response.json();
      
      setAuditLogs(data.data);
      setPagination(data.pagination);
      if (data.statistics) {
        setStatistics(data.statistics);
      }
    } catch (error) {
      console.error('감사 로그 조회 오류:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      toast.error('감사 로그 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters, sortBy, sortOrder, includeStats]);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // 필터 적용
  const applyFilters = (newFilters: AuditLogFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // 페이지 변경
  const changePage = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // 정렬 변경
  const changeSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // 심각도 배지 색상
  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'error': return 'destructive';
      case 'warning': return 'default';
      case 'info': return 'secondary';
      default: return 'outline';
    }
  };

  // 상태 배지 색상
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'success': return 'default';
      case 'failed': return 'destructive';
      case 'partial': return 'secondary';
      default: return 'outline';
    }
  };

  // 액션 아이콘
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login': return <User className="h-4 w-4" />;
      case 'logout': return <User className="h-4 w-4" />;
      case 'create': return <Settings className="h-4 w-4" />;
      case 'update': return <Settings className="h-4 w-4" />;
      case 'delete': return <Trash2 className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  // 감사 로그 정리
  const cleanupAuditLogs = async (retentionDays: number) => {
    if (!confirm(`${retentionDays}일 이전의 감사 로그를 삭제하시겠습니까?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/audit-logs?retentionDays=${retentionDays}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('감사 로그 정리 실패');
      }
      
      const result = await response.json();
      toast.success(`감사 로그 정리 완료: ${result.result.summary}`);
      fetchAuditLogs(); // 목록 새로고침
    } catch (error) {
      console.error('감사 로그 정리 오류:', error);
      toast.error('감사 로그 정리 실패');
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">감사 로그</h2>
          <p className="text-muted-foreground">
            시스템 활동 및 설정 변경 이력을 조회하고 분석합니다
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIncludeStats(!includeStats)}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            통계 {includeStats ? '숨기기' : '보기'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            필터
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAuditLogs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={() => cleanupAuditLogs(365)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            정리 (1년)
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 로그</CardTitle>
              <Info className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.totalLogs.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                활성 사용자: {statistics.uniqueUsers}명
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">설정 변경</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.settingsChanges.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                생성: {statistics.createActions} / 수정: {statistics.updateActions}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">보안 이벤트</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.loginActions + statistics.logoutActions}</div>
              <p className="text-xs text-muted-foreground">
                로그인: {statistics.loginActions} / 로그아웃: {statistics.logoutActions}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">오류 로그</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {statistics.errorLogs + statistics.criticalLogs}
              </div>
              <p className="text-xs text-muted-foreground">
                에러: {statistics.errorLogs} / 치명적: {statistics.criticalLogs}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 필터 패널 - 다음 부분에서 계속 */}
    </div>
  );
}
