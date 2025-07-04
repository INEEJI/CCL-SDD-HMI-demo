import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// PostgreSQL 연결 설정
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sdd_system',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// GET: 특정 설정 키 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const key = params.key;

    if (!category) {
      return NextResponse.json(
        { 
          success: false, 
          error: '카테고리가 필요합니다.',
          code: 'MISSING_CATEGORY'
        },
        { status: 400 }
      );
    }

    const result = await pool.query(`
      SELECT id, category, key, value, data_type, description, 
             min_value, max_value, allowed_values, is_sensitive,
             created_at, updated_at
      FROM system_settings 
      WHERE category = $1 AND key = $2
    `, [category, key]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '설정을 찾을 수 없습니다.',
          code: 'SETTING_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    let value = row.value;

    // 데이터 타입에 따른 변환
    switch (row.data_type) {
      case 'number':
        value = parseFloat(value);
        break;
      case 'boolean':
        value = value === 'true' || value === true;
        break;
      case 'json':
        try {
          value = JSON.parse(value);
        } catch {
          value = row.value;
        }
        break;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        category: row.category,
        key: row.key,
        value,
        dataType: row.data_type,
        description: row.description,
        minValue: row.min_value,
        maxValue: row.max_value,
        allowedValues: row.allowed_values,
        isSensitive: row.is_sensitive,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });

  } catch (error) {
    console.error('설정 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '설정을 조회하는데 실패했습니다.',
        code: 'SETTING_FETCH_ERROR'
      },
      { status: 500 }
    );
  }
}

// PUT: 특정 설정 키 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const body = await request.json();
    const { category, value, description } = body;
    const key = params.key;

    if (!category || value === undefined) {
      return NextResponse.json(
        { 
          success: false, 
          error: '카테고리와 값이 필요합니다.',
          code: 'MISSING_REQUIRED_FIELDS'
        },
        { status: 400 }
      );
    }

    // 데이터 타입 결정
    let dataType: string;
    let stringValue: string;

    if (typeof value === 'boolean') {
      dataType = 'boolean';
      stringValue = value.toString();
    } else if (typeof value === 'number') {
      dataType = 'number';
      stringValue = value.toString();
    } else if (typeof value === 'object') {
      dataType = 'json';
      stringValue = JSON.stringify(value);
    } else {
      dataType = 'string';
      stringValue = value.toString();
    }

    const result = await pool.query(`
      INSERT INTO system_settings (category, key, value, data_type, description, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (category, key) 
      DO UPDATE SET 
        value = EXCLUDED.value,
        data_type = EXCLUDED.data_type,
        description = COALESCE(EXCLUDED.description, system_settings.description),
        updated_at = NOW()
      RETURNING *
    `, [category, key, stringValue, dataType, description]);

    return NextResponse.json({
      success: true,
      message: '설정이 성공적으로 업데이트되었습니다.',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('설정 업데이트 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '설정을 업데이트하는데 실패했습니다.',
        code: 'SETTING_UPDATE_ERROR'
      },
      { status: 500 }
    );
  }
}

// DELETE: 특정 설정 키 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const key = params.key;

    if (!category) {
      return NextResponse.json(
        { 
          success: false, 
          error: '카테고리가 필요합니다.',
          code: 'MISSING_CATEGORY'
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      'DELETE FROM system_settings WHERE category = $1 AND key = $2',
      [category, key]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '삭제할 설정을 찾을 수 없습니다.',
          code: 'SETTING_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '설정이 성공적으로 삭제되었습니다.',
      data: { deletedCount: result.rowCount }
    });

  } catch (error) {
    console.error('설정 삭제 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '설정을 삭제하는데 실패했습니다.',
        code: 'SETTING_DELETE_ERROR'
      },
      { status: 500 }
    );
  }
} 