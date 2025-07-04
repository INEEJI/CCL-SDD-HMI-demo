"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CalendarIcon, 
  ClockIcon, 
  PlayIcon, 
  PauseIcon, 
  EditIcon, 
  TrashIcon, 
  PlusIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  BarChart3Icon,
  SettingsIcon,
  BellIcon,
  DatabaseIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// 타입 정의
interface BackupSchedule {
  schedule_id: number;
  schedule_name: string;
  schedule_description: string;
  cron_expression: string;
  timezone: string;
  is_enabled: boolean;
  backup_type: 'full' | 'incremental' | 'differential';
  backup_categories: string[] | null;
  max_backup_count: number;
  retention_days: number;
  compression_enabled: boolean;
  encryption_enabled: boolean;
  created_by_username: string;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  next_run_at: string | null;
  
  // 실행 통계
  last_execution_status: string | null;
  last_execution_time: string | null;
  last_execution_duration: number | null;
  last_error_message: string | null;
  last_backup_id: string | null;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  success_rate_percentage: number | null;
  seconds_until_next_run: number | null;
  notification_count: number;
}

interface BackupExecution {
  execution_id: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  backup_id: string | null;
  error_message: string | null;
  execution_type: string;
  retry_count: number;
}

interface BackupNotification {
  notification_id: number;
  notification_type: string;
  is_enabled: boolean;
  notify_on_success: boolean;
  notify_on_failure: boolean;
  recipient_emails: string[];
  webhook_url: string | null;
}

export default function BackupScheduleManagement() {
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<BackupSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEnabled, setFilterEnabled] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [executionHistory, setExecutionHistory] = useState<BackupExecution[]>([]);
  const [notifications, setNotifications] = useState<BackupNotification[]>([]);
  const { toast } = useToast();

  // 폼 상태
  const [formData, setFormData] = useState({
    schedule_name: '',
    schedule_description: '',
    cron_expression: '0 2 * * *',
    timezone: 'Asia/Seoul',
    is_enabled: true,
    backup_type: 'full' as 'full' | 'incremental' | 'differential',
    backup_categories: [] as string[],
    max_backup_count: 10,
    retention_days: 30,
    compression_enabled: true,
    encryption_enabled: false
  });

  // 데이터 로드
  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/backup-schedules');
      const result = await response.json();

      if (result.success) {
        setSchedules(result.data.schedules);
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError('백업 스케줄 로드에 실패했습니다.');
      console.error('백업 스케줄 로드 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  // 스케줄 상세 정보 로드
  const loadScheduleDetail = async (scheduleId: number) => {
    try {
      const response = await fetch(`/api/backup-schedules/${scheduleId}`);
      const result = await response.json();

      if (result.success) {
        setSelectedSchedule(result.data.schedule);
        setExecutionHistory(result.data.schedule.recent_executions || []);
        setNotifications(result.data.schedule.notifications || []);
        setShowDetailDialog(true);
      } else {
        toast({
          title: "오류",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "오류",
        description: "스케줄 상세 정보 로드에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 스케줄 생성
  const createSchedule = async () => {
    try {
      const response = await fetch('/api/backup-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "성공",
          description: "백업 스케줄이 생성되었습니다.",
        });
        setShowCreateDialog(false);
        resetForm();
        loadSchedules();
      } else {
        toast({
          title: "오류",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "오류",
        description: "백업 스케줄 생성에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 스케줄 수정
  const updateSchedule = async () => {
    if (!selectedSchedule) return;

    try {
      const response = await fetch(`/api/backup-schedules/${selectedSchedule.schedule_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "성공",
          description: "백업 스케줄이 수정되었습니다.",
        });
        setShowEditDialog(false);
        resetForm();
        loadSchedules();
      } else {
        toast({
          title: "오류",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "오류",
        description: "백업 스케줄 수정에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 스케줄 삭제
  const deleteSchedule = async (scheduleId: number) => {
    if (!confirm('정말로 이 백업 스케줄을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/backup-schedules/${scheduleId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "성공",
          description: "백업 스케줄이 삭제되었습니다.",
        });
        loadSchedules();
      } else {
        toast({
          title: "오류",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "오류",
        description: "백업 스케줄 삭제에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 수동 백업 실행
  const executeBackup = async (scheduleId: number) => {
    try {
      const response = await fetch(`/api/backup-schedules/${scheduleId}/execute`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "성공",
          description: "백업 실행이 시작되었습니다.",
        });
        loadSchedules();
      } else {
        toast({
          title: "오류",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "오류",
        description: "백업 실행에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      schedule_name: '',
      schedule_description: '',
      cron_expression: '0 2 * * *',
      timezone: 'Asia/Seoul',
      is_enabled: true,
      backup_type: 'full',
      backup_categories: [],
      max_backup_count: 10,
      retention_days: 30,
      compression_enabled: true,
      encryption_enabled: false
    });
  };

  // 편집 모드 시작
  const startEdit = (schedule: BackupSchedule) => {
    setSelectedSchedule(schedule);
    setFormData({
      schedule_name: schedule.schedule_name,
      schedule_description: schedule.schedule_description,
      cron_expression: schedule.cron_expression,
      timezone: schedule.timezone,
      is_enabled: schedule.is_enabled,
      backup_type: schedule.backup_type,
      backup_categories: schedule.backup_categories || [],
      max_backup_count: schedule.max_backup_count,
      retention_days: schedule.retention_days,
      compression_enabled: schedule.compression_enabled,
      encryption_enabled: schedule.encryption_enabled
    });
    setShowEditDialog(true);
  };

  // 필터링된 스케줄
  const filteredSchedules = schedules.filter(schedule => {
    const matchesSearch = schedule.schedule_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         schedule.schedule_description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterEnabled === 'all' || 
                         (filterEnabled === 'enabled' && schedule.is_enabled) ||
                         (filterEnabled === 'disabled' && !schedule.is_enabled);

    return matchesSearch && matchesFilter;
  });

  // 상태 배지 렌더링
  const renderStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary">미실행</Badge>;

    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircleIcon className="w-3 h-3 mr-1" />성공</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircleIcon className="w-3 h-3 mr-1" />실패</Badge>;
      case 'running':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><RefreshCwIcon className="w-3 h-3 mr-1 animate-spin" />실행중</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // 다음 실행 시간 포맷
  const formatNextRun = (seconds: number | null) => {
    if (!seconds) return '예정 없음';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}일 후`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분 후`;
    } else {
      return `${minutes}분 후`;
    }
  };

  // 크론 표현식 설명
  const getCronDescription = (cronExpr: string) => {
    const descriptions: { [key: string]: string } = {
      '0 2 * * *': '매일 오전 2시',
      '0 1 * * 0': '매주 일요일 오전 1시',
      '0 0 1 * *': '매월 1일 자정',
      '0 */6 * * *': '6시간마다',
      '0 */12 * * *': '12시간마다'
    };
    
    return descriptions[cronExpr] || cronExpr;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCwIcon className="w-6 h-6 animate-spin mr-2" />
        로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">백업 스케줄 관리</h2>
          <p className="text-muted-foreground">자동 백업 스케줄을 관리하고 모니터링합니다.</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <PlusIcon className="w-4 h-4 mr-2" />
          새 스케줄 생성
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 스케줄</CardTitle>
            <DatabaseIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 스케줄</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {schedules.filter(s => s.is_enabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">성공률 (30일)</CardTitle>
            <BarChart3Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.length > 0 
                ? Math.round(schedules.reduce((acc, s) => acc + (s.success_rate_percentage || 0), 0) / schedules.length)
                : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">알림 설정</CardTitle>
            <BellIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.reduce((acc, s) => acc + s.notification_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 및 검색 */}
      <div className="flex items-center space-x-4">
        <Input
          placeholder="스케줄 이름 또는 설명으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filterEnabled} onValueChange={setFilterEnabled}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="enabled">활성</SelectItem>
            <SelectItem value="disabled">비활성</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={loadSchedules}>
          <RefreshCwIcon className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 스케줄 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>백업 스케줄 목록</CardTitle>
          <CardDescription>
            {filteredSchedules.length}개의 스케줄이 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>스케줄 이름</TableHead>
                <TableHead>크론 표현식</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>최근 실행</TableHead>
                <TableHead>성공률</TableHead>
                <TableHead>다음 실행</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchedules.map((schedule) => (
                <TableRow key={schedule.schedule_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{schedule.schedule_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {schedule.schedule_description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <Badge variant="outline">{schedule.cron_expression}</Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {getCronDescription(schedule.cron_expression)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {schedule.is_enabled ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">활성</Badge>
                      ) : (
                        <Badge variant="secondary">비활성</Badge>
                      )}
                      {renderStatusBadge(schedule.last_execution_status)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {schedule.last_execution_time ? (
                      <div>
                        <div className="text-sm">
                          {new Date(schedule.last_execution_time).toLocaleString()}
                        </div>
                        {schedule.last_execution_duration && (
                          <div className="text-xs text-muted-foreground">
                            {schedule.last_execution_duration}초 소요
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">미실행</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {schedule.success_rate_percentage !== null ? (
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {schedule.success_rate_percentage}%
                        </div>
                        <Progress 
                          value={schedule.success_rate_percentage} 
                          className="w-16 h-2"
                        />
                        <div className="text-xs text-muted-foreground">
                          {schedule.successful_executions}/{schedule.total_executions}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {schedule.is_enabled && schedule.seconds_until_next_run ? (
                      <div className="text-sm">
                        <ClockIcon className="w-3 h-3 inline mr-1" />
                        {formatNextRun(schedule.seconds_until_next_run)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">예정 없음</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadScheduleDetail(schedule.schedule_id)}
                      >
                        <BarChart3Icon className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => executeBackup(schedule.schedule_id)}
                        disabled={schedule.last_execution_status === 'running'}
                      >
                        <PlayIcon className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(schedule)}
                      >
                        <EditIcon className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteSchedule(schedule.schedule_id)}
                      >
                        <TrashIcon className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 스케줄 생성 다이얼로그 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>새 백업 스케줄 생성</DialogTitle>
            <DialogDescription>
              자동 백업을 위한 새 스케줄을 생성합니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schedule_name">스케줄 이름</Label>
                <Input
                  id="schedule_name"
                  value={formData.schedule_name}
                  onChange={(e) => setFormData({...formData, schedule_name: e.target.value})}
                  placeholder="예: 일일 백업"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cron_expression">크론 표현식</Label>
                <Select 
                  value={formData.cron_expression} 
                  onValueChange={(value) => setFormData({...formData, cron_expression: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0 2 * * *">매일 오전 2시</SelectItem>
                    <SelectItem value="0 1 * * 0">매주 일요일 오전 1시</SelectItem>
                    <SelectItem value="0 0 1 * *">매월 1일 자정</SelectItem>
                    <SelectItem value="0 */6 * * *">6시간마다</SelectItem>
                    <SelectItem value="0 */12 * * *">12시간마다</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="schedule_description">설명</Label>
              <Textarea
                id="schedule_description"
                value={formData.schedule_description}
                onChange={(e) => setFormData({...formData, schedule_description: e.target.value})}
                placeholder="백업 스케줄에 대한 설명을 입력하세요..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="backup_type">백업 타입</Label>
                <Select 
                  value={formData.backup_type} 
                  onValueChange={(value: 'full' | 'incremental' | 'differential') => 
                    setFormData({...formData, backup_type: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">전체 백업</SelectItem>
                    <SelectItem value="incremental">증분 백업</SelectItem>
                    <SelectItem value="differential">차등 백업</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_backup_count">최대 백업 개수</Label>
                <Input
                  id="max_backup_count"
                  type="number"
                  value={formData.max_backup_count}
                  onChange={(e) => setFormData({...formData, max_backup_count: parseInt(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retention_days">보존 일수</Label>
                <Input
                  id="retention_days"
                  type="number"
                  value={formData.retention_days}
                  onChange={(e) => setFormData({...formData, retention_days: parseInt(e.target.value)})}
                />
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_enabled"
                  checked={formData.is_enabled}
                  onCheckedChange={(checked) => setFormData({...formData, is_enabled: checked})}
                />
                <Label htmlFor="is_enabled">활성화</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="compression_enabled"
                  checked={formData.compression_enabled}
                  onCheckedChange={(checked) => setFormData({...formData, compression_enabled: checked})}
                />
                <Label htmlFor="compression_enabled">압축</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="encryption_enabled"
                  checked={formData.encryption_enabled}
                  onCheckedChange={(checked) => setFormData({...formData, encryption_enabled: checked})}
                />
                <Label htmlFor="encryption_enabled">암호화</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              취소
            </Button>
            <Button onClick={createSchedule}>생성</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 스케줄 수정 다이얼로그 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>백업 스케줄 수정</DialogTitle>
            <DialogDescription>
              백업 스케줄 설정을 수정합니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_schedule_name">스케줄 이름</Label>
                <Input
                  id="edit_schedule_name"
                  value={formData.schedule_name}
                  onChange={(e) => setFormData({...formData, schedule_name: e.target.value})}
                  placeholder="예: 일일 백업"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_cron_expression">크론 표현식</Label>
                <Select 
                  value={formData.cron_expression} 
                  onValueChange={(value) => setFormData({...formData, cron_expression: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0 2 * * *">매일 오전 2시</SelectItem>
                    <SelectItem value="0 1 * * 0">매주 일요일 오전 1시</SelectItem>
                    <SelectItem value="0 0 1 * *">매월 1일 자정</SelectItem>
                    <SelectItem value="0 */6 * * *">6시간마다</SelectItem>
                    <SelectItem value="0 */12 * * *">12시간마다</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit_schedule_description">설명</Label>
              <Textarea
                id="edit_schedule_description"
                value={formData.schedule_description}
                onChange={(e) => setFormData({...formData, schedule_description: e.target.value})}
                placeholder="백업 스케줄에 대한 설명을 입력하세요..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_backup_type">백업 타입</Label>
                <Select 
                  value={formData.backup_type} 
                  onValueChange={(value: 'full' | 'incremental' | 'differential') => 
                    setFormData({...formData, backup_type: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">전체 백업</SelectItem>
                    <SelectItem value="incremental">증분 백업</SelectItem>
                    <SelectItem value="differential">차등 백업</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_max_backup_count">최대 백업 개수</Label>
                <Input
                  id="edit_max_backup_count"
                  type="number"
                  value={formData.max_backup_count}
                  onChange={(e) => setFormData({...formData, max_backup_count: parseInt(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_retention_days">보존 일수</Label>
                <Input
                  id="edit_retention_days"
                  type="number"
                  value={formData.retention_days}
                  onChange={(e) => setFormData({...formData, retention_days: parseInt(e.target.value)})}
                />
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_enabled"
                  checked={formData.is_enabled}
                  onCheckedChange={(checked) => setFormData({...formData, is_enabled: checked})}
                />
                <Label htmlFor="edit_is_enabled">활성화</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_compression_enabled"
                  checked={formData.compression_enabled}
                  onCheckedChange={(checked) => setFormData({...formData, compression_enabled: checked})}
                />
                <Label htmlFor="edit_compression_enabled">압축</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_encryption_enabled"
                  checked={formData.encryption_enabled}
                  onCheckedChange={(checked) => setFormData({...formData, encryption_enabled: checked})}
                />
                <Label htmlFor="edit_encryption_enabled">암호화</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              취소
            </Button>
            <Button onClick={updateSchedule}>수정</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 스케줄 상세 다이얼로그 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedSchedule?.schedule_name} - 상세 정보
            </DialogTitle>
            <DialogDescription>
              백업 스케줄의 실행 이력과 통계를 확인합니다.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">개요</TabsTrigger>
                <TabsTrigger value="history">실행 이력</TabsTrigger>
                <TabsTrigger value="notifications">알림 설정</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                {selectedSchedule && (
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">기본 정보</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div><strong>이름:</strong> {selectedSchedule.schedule_name}</div>
                        <div><strong>설명:</strong> {selectedSchedule.schedule_description}</div>
                        <div><strong>크론 표현식:</strong> {selectedSchedule.cron_expression}</div>
                        <div><strong>백업 타입:</strong> {selectedSchedule.backup_type}</div>
                        <div><strong>상태:</strong> {selectedSchedule.is_enabled ? '활성' : '비활성'}</div>
                        <div><strong>생성자:</strong> {selectedSchedule.created_by_username}</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">실행 통계</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div><strong>총 실행:</strong> {selectedSchedule.total_executions}회</div>
                        <div><strong>성공:</strong> {selectedSchedule.successful_executions}회</div>
                        <div><strong>실패:</strong> {selectedSchedule.failed_executions}회</div>
                        <div><strong>성공률:</strong> {selectedSchedule.success_rate_percentage || 0}%</div>
                        <div><strong>마지막 실행:</strong> {
                          selectedSchedule.last_execution_time 
                            ? new Date(selectedSchedule.last_execution_time).toLocaleString()
                            : '없음'
                        }</div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="history" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>최근 실행 이력</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>실행 ID</TableHead>
                          <TableHead>타입</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>시작 시간</TableHead>
                          <TableHead>소요 시간</TableHead>
                          <TableHead>백업 ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {executionHistory.map((execution) => (
                          <TableRow key={execution.execution_id}>
                            <TableCell>{execution.execution_id}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{execution.execution_type}</Badge>
                            </TableCell>
                            <TableCell>{renderStatusBadge(execution.status)}</TableCell>
                            <TableCell>
                              {new Date(execution.started_at).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {execution.duration_seconds ? `${execution.duration_seconds}초` : '-'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {execution.backup_id || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="notifications" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>알림 설정</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {notifications.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>타입</TableHead>
                            <TableHead>상태</TableHead>
                            <TableHead>성공 알림</TableHead>
                            <TableHead>실패 알림</TableHead>
                            <TableHead>수신자</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {notifications.map((notification) => (
                            <TableRow key={notification.notification_id}>
                              <TableCell>
                                <Badge variant="outline">{notification.notification_type}</Badge>
                              </TableCell>
                              <TableCell>
                                {notification.is_enabled ? (
                                  <Badge variant="default">활성</Badge>
                                ) : (
                                  <Badge variant="secondary">비활성</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {notification.notify_on_success ? '✓' : '✗'}
                              </TableCell>
                              <TableCell>
                                {notification.notify_on_failure ? '✓' : '✗'}
                              </TableCell>
                              <TableCell>
                                {notification.recipient_emails.join(', ') || notification.webhook_url || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        설정된 알림이 없습니다.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 