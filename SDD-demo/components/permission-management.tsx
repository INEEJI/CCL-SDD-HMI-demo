'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Users, 
  Shield, 
  Settings, 
  Eye, 
  Edit, 
  Trash2, 
  Plus, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  Search
} from 'lucide-react'

// 타입 정의
interface UserRole {
  role_id: number;
  role_name: string;
  role_description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Permission {
  permission_id: number;
  permission_name: string;
  permission_description: string;
  resource_type: string;
  resource_category: string | null;
  action_type: string;
  is_active: boolean;
}

interface UserPermission {
  user_id: number;
  username: string;
  role_name: string;
  permissions: Permission[];
}

interface RolePermission {
  role_id: number;
  role_name: string;
  permissions: Permission[];
}

interface UserRoleAssignment {
  assignment_id: number;
  user_id: number;
  username: string;
  role_id: number;
  role_name: string;
  assigned_at: string;
  assigned_by: number;
  expires_at: string | null;
  is_active: boolean;
}

interface PermissionOverride {
  override_id: number;
  user_id: number;
  username: string;
  permission_id: number;
  permission_name: string;
  is_granted: boolean;
  override_reason: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

// 권한 관리 메인 컴포넌트
export default function PermissionManagement() {
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState<UserPermission[]>([])
  const [roles, setRoles] = useState<UserRole[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [userRoleAssignments, setUserRoleAssignments] = useState<UserRoleAssignment[]>([])
  const [permissionOverrides, setPermissionOverrides] = useState<PermissionOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedResourceType, setSelectedResourceType] = useState<string>('all')

  // 데이터 로드
  useEffect(() => {
    loadPermissionData()
  }, [])

  const loadPermissionData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 병렬로 데이터 로드
      const [usersRes, rolesRes, permissionsRes, assignmentsRes, overridesRes] = await Promise.all([
        fetch('/api/permissions/users'),
        fetch('/api/permissions/roles'),
        fetch('/api/permissions/permissions'),
        fetch('/api/permissions/assignments'),
        fetch('/api/permissions/overrides')
      ])

      if (!usersRes.ok || !rolesRes.ok || !permissionsRes.ok || !assignmentsRes.ok || !overridesRes.ok) {
        throw new Error('권한 데이터 로드에 실패했습니다.')
      }

      const [usersData, rolesData, permissionsData, assignmentsData, overridesData] = await Promise.all([
        usersRes.json(),
        rolesRes.json(),
        permissionsRes.json(),
        assignmentsRes.json(),
        overridesRes.json()
      ])

      setUsers(usersData.data || [])
      setRoles(rolesData.data || [])
      setPermissions(permissionsData.data || [])
      setUserRoleAssignments(assignmentsData.data || [])
      setPermissionOverrides(overridesData.data || [])

    } catch (err) {
      console.error('권한 데이터 로드 오류:', err)
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 필터링된 데이터
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredPermissions = permissions.filter(permission => {
    const matchesSearch = permission.permission_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         permission.permission_description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesResourceType = selectedResourceType === 'all' || permission.resource_type === selectedResourceType
    return matchesSearch && matchesResourceType
  })

  const resourceTypes = [...new Set(permissions.map(p => p.resource_type))]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">권한 데이터를 로드하는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={loadPermissionData}
          >
            다시 시도
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">권한 관리</h2>
          <p className="text-muted-foreground">
            사용자별 설정 접근 권한을 관리합니다.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button onClick={loadPermissionData} variant="outline">
            새로고침
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 사용자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              활성 사용자 수
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">역할</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
            <p className="text-xs text-muted-foreground">
              정의된 역할 수
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">권한</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permissions.length}</div>
            <p className="text-xs text-muted-foreground">
              총 권한 수
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오버라이드</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permissionOverrides.length}</div>
            <p className="text-xs text-muted-foreground">
              개별 권한 설정
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users">사용자</TabsTrigger>
          <TabsTrigger value="roles">역할</TabsTrigger>
          <TabsTrigger value="permissions">권한</TabsTrigger>
          <TabsTrigger value="assignments">할당</TabsTrigger>
          <TabsTrigger value="overrides">오버라이드</TabsTrigger>
        </TabsList>

        {/* 사용자 탭 */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>사용자 권한 현황</CardTitle>
              <CardDescription>
                각 사용자의 역할과 권한을 확인할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>사용자명</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>권한 수</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role_name}</Badge>
                      </TableCell>
                      <TableCell>{user.permissions.length}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          활성
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 역할 탭 */}
        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>역할 관리</CardTitle>
                  <CardDescription>
                    시스템 역할을 관리하고 권한을 할당합니다.
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  새 역할 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>역할명</TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>생성일</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.role_id}>
                      <TableCell className="font-medium">{role.role_name}</TableCell>
                      <TableCell>{role.role_description}</TableCell>
                      <TableCell>
                        <Badge variant={role.is_active ? "secondary" : "destructive"}>
                          {role.is_active ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              활성
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              비활성
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(role.created_at).toLocaleDateString('ko-KR')}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 권한 탭 */}
        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>권한 목록</CardTitle>
                  <CardDescription>
                    시스템의 모든 권한을 확인할 수 있습니다.
                  </CardDescription>
                </div>
                <Select value={selectedResourceType} onValueChange={setSelectedResourceType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="리소스 타입" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 타입</SelectItem>
                    {resourceTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>권한명</TableHead>
                      <TableHead>설명</TableHead>
                      <TableHead>리소스 타입</TableHead>
                      <TableHead>카테고리</TableHead>
                      <TableHead>액션</TableHead>
                      <TableHead>상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPermissions.map((permission) => (
                      <TableRow key={permission.permission_id}>
                        <TableCell className="font-medium">{permission.permission_name}</TableCell>
                        <TableCell>{permission.permission_description}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{permission.resource_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {permission.resource_category && (
                            <Badge variant="secondary">{permission.resource_category}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              permission.action_type === 'read' ? 'default' :
                              permission.action_type === 'write' ? 'secondary' :
                              permission.action_type === 'delete' ? 'destructive' :
                              'outline'
                            }
                          >
                            {permission.action_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={permission.is_active ? "secondary" : "destructive"}>
                            {permission.is_active ? '활성' : '비활성'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 할당 탭 */}
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>사용자 역할 할당</CardTitle>
                  <CardDescription>
                    사용자에게 할당된 역할을 관리합니다.
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  새 할당 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>사용자명</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>할당일</TableHead>
                    <TableHead>만료일</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRoleAssignments.map((assignment) => (
                    <TableRow key={assignment.assignment_id}>
                      <TableCell className="font-medium">{assignment.username}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{assignment.role_name}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {new Date(assignment.assigned_at).toLocaleDateString('ko-KR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        {assignment.expires_at ? (
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                            {new Date(assignment.expires_at).toLocaleDateString('ko-KR')}
                          </div>
                        ) : (
                          <span className="text-gray-500">무제한</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={assignment.is_active ? "secondary" : "destructive"}>
                          {assignment.is_active ? '활성' : '비활성'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 오버라이드 탭 */}
        <TabsContent value="overrides" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>권한 오버라이드</CardTitle>
                  <CardDescription>
                    개별 사용자의 특별 권한 설정을 관리합니다.
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  새 오버라이드 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>사용자명</TableHead>
                    <TableHead>권한</TableHead>
                    <TableHead>허용/거부</TableHead>
                    <TableHead>사유</TableHead>
                    <TableHead>생성일</TableHead>
                    <TableHead>만료일</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionOverrides.map((override) => (
                    <TableRow key={override.override_id}>
                      <TableCell className="font-medium">{override.username}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{override.permission_name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={override.is_granted ? "secondary" : "destructive"}>
                          {override.is_granted ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              허용
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              거부
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{override.override_reason}</TableCell>
                      <TableCell>
                        {new Date(override.created_at).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        {override.expires_at ? (
                          new Date(override.expires_at).toLocaleDateString('ko-KR')
                        ) : (
                          <span className="text-gray-500">무제한</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 