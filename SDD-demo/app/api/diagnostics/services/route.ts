import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth, requireAdmin } from '@/lib/auth-middleware';

// GET /api/diagnostics/services - 외부 진단 서비스 목록 조회
export async function GET(request: NextRequest) {
  // 인증 확인 (모든 사용자 접근 가능)
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get('type');
    const isActive = searchParams.get('active');

    let query = `
      SELECT 
        ds.*,
        u.username as created_by_name,
        u2.username as updated_by_name
      FROM diagnostic_services ds
      LEFT JOIN users u ON ds.created_by = u.id
      LEFT JOIN users u2 ON ds.updated_by = u2.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (serviceType) {
      query += ` AND ds.service_type = $${paramIndex}`;
      params.push(serviceType);
      paramIndex++;
    }

    if (isActive !== null) {
      query += ` AND ds.is_active = $${paramIndex}`;
      params.push(isActive === 'true');
      paramIndex++;
    }

    query += ` ORDER BY ds.service_name ASC`;

    const result = await pool.query(query, params);

    // 설정 정보에서 민감한 정보 제거 (API 키 등)
    const services = result.rows.map((service: any) => {
      const { configuration, ...serviceData } = service;
      let sanitizedConfig: Record<string, any> = {};
      
      if (configuration) {
        try {
          const config = typeof configuration === 'string' 
            ? JSON.parse(configuration) 
            : configuration;
          
          // API 키나 비밀번호 등 민감한 정보 마스킹
          Object.keys(config).forEach(key => {
            if (key.toLowerCase().includes('key') || 
                key.toLowerCase().includes('password') || 
                key.toLowerCase().includes('secret')) {
              sanitizedConfig[key] = '***';
            } else {
              sanitizedConfig[key] = config[key];
            }
          });
        } catch (error) {
          console.error('Configuration 파싱 오류:', error);
        }
      }

      return {
        ...serviceData,
        configuration: sanitizedConfig
      };
    });

    return NextResponse.json({
      success: true,
      data: services
    });

  } catch (error) {
    console.error('외부 진단 서비스 목록 조회 중 오류:', error);
    return NextResponse.json(
      { error: '외부 진단 서비스 목록 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// POST /api/diagnostics/services - 새 외부 진단 서비스 등록
export async function POST(request: NextRequest) {
  // 인증 확인 (관리자 권한 필요)
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  try {
    const body = await request.json();
    const {
      service_name,
      service_type,
      service_url,
      iframe_url,
      description,
      configuration,
      supported_diagnostics,
      is_active
    } = body;

    // 필수 필드 검증
    if (!service_name || !service_type || !service_url) {
      return NextResponse.json(
        { error: '서비스명, 서비스 유형, 서비스 URL은 필수입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 서비스 유형 검증
    const allowedTypes = ['camera_calibration', 'equipment_monitoring', 'test_automation', 'system_health', 'comprehensive'];
    if (!allowedTypes.includes(service_type)) {
      return NextResponse.json(
        { error: '지원되지 않는 서비스 유형입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 중복 서비스명 확인
    const existingService = await pool.query(
      'SELECT id FROM diagnostic_services WHERE service_name = $1',
      [service_name]
    );

    if (existingService.rows.length > 0) {
      return NextResponse.json(
        { error: '이미 존재하는 서비스명입니다.', code: 'CONFLICT' },
        { status: 409 }
      );
    }

    // 새 서비스 등록
    const insertQuery = `
      INSERT INTO diagnostic_services (
        service_name, service_type, service_url, iframe_url, description,
        configuration, supported_diagnostics, is_active, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      service_name,
      service_type,
      service_url,
      iframe_url || null,
      description || null,
      configuration ? JSON.stringify(configuration) : null,
      supported_diagnostics ? JSON.stringify(supported_diagnostics) : null,
      is_active !== undefined ? is_active : true,
      user.id
    ]);

    // 생성된 서비스 정보 조회 (사용자 정보 포함)
    const selectQuery = `
      SELECT 
        ds.*,
        u.username as created_by_name
      FROM diagnostic_services ds
      LEFT JOIN users u ON ds.created_by = u.id
      WHERE ds.id = $1
    `;

    const selectResult = await pool.query(selectQuery, [result.rows[0].id]);

    return NextResponse.json({
      success: true,
      message: '외부 진단 서비스가 성공적으로 등록되었습니다.',
      data: selectResult.rows[0]
    }, { status: 201 });

  } catch (error) {
    console.error('외부 진단 서비스 등록 중 오류:', error);
    return NextResponse.json(
      { error: '외부 진단 서비스 등록 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 