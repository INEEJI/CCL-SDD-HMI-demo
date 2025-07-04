import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth } from '@/lib/auth-middleware';

// 결함 유형 목록 조회
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // 시스템 설정에서 결함 유형 목록 조회
    const settingsQuery = `
      SELECT setting_value 
      FROM system_settings 
      WHERE setting_key = 'defect_types'
    `;

    const settingsResult = await pool.query(settingsQuery);

    let defectTypes = [];

    if (settingsResult.rows.length > 0) {
      try {
        defectTypes = JSON.parse(settingsResult.rows[0].setting_value);
      } catch (error) {
        console.error('결함 유형 설정 파싱 오류:', error);
      }
    }

    // 기본 결함 유형 (설정이 없는 경우)
    if (defectTypes.length === 0) {
      defectTypes = [
        'scratch',
        'dent',
        'hole',
        'stain',
        'crack',
        'bubble',
        'wrinkle',
        'edge_damage'
      ];
    }

    // 실제 사용 중인 결함 유형도 포함 (DB에서 조회)
    const usedTypesQuery = `
      SELECT DISTINCT defect_type 
      FROM customer_defect_rules 
      WHERE is_active = true
      ORDER BY defect_type
    `;

    const usedTypesResult = await pool.query(usedTypesQuery);
    const usedTypes = usedTypesResult.rows.map((row: any) => row.defect_type);

    // 중복 제거하고 합치기
    const allTypes = [...new Set([...defectTypes, ...usedTypes])];

    // 결함 유형별 한국어 이름 매핑
    const defectTypeNames: Record<string, string> = {
      scratch: '스크래치',
      dent: '덴트',
      hole: '홀',
      stain: '얼룩',
      crack: '균열',
      bubble: '기포',
      wrinkle: '주름',
      edge_damage: '가장자리 손상',
      corrosion: '부식',
      contamination: '오염',
      deformation: '변형',
      coating_defect: '코팅 결함'
    };

    const result = allTypes.map(type => ({
      value: type,
      label: defectTypeNames[type] || type,
      korean_name: defectTypeNames[type] || type
    }));

    return NextResponse.json({
      success: true,
      data: result,
      total: result.length
    });

  } catch (error) {
    console.error('결함 유형 목록 조회 중 오류:', error);
    return NextResponse.json(
      { error: '결함 유형 목록 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 