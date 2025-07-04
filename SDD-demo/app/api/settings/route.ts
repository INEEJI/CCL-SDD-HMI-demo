import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';

// 기본 설정 데이터 - 대시보드가 기대하는 구조에 맞게 수정
const DEFAULT_SETTINGS = {
  sensitivity: {
    threshold: 0.8,
    minDefectSize: 5,
    scratch: 80,
    dent: 75,
    stain: 70,
    crack: 90,
    global: 80
  },
  hardware: {
    cameraResolution: '1920x1080',
    frameRate: 30,
    lightingIntensity: 80,
    cameraSpeed: 50,
    lighting: 80,
    temperature: 22,
    airPressure: 1.2,
    autoAdjustment: true
  },
  notifications: {
    emailNotifications: true,
    soundAlerts: true,
    emailServer: 'smtp.example.com',
    soundEnabled: true,
    volume: 70,
    periodicAlerts: true,
    criticalAlerts: true
  },
  periodicPatterns: {
    scratch: {
      interval: 50,
      count: 3,
      enabled: true
    },
    dent: {
      interval: 100,
      count: 2,
      enabled: true
    },
    stain: {
      interval: 75,
      count: 4,
      enabled: false
    },
    crack: {
      interval: 100,
      count: 2,
      enabled: true
    }
  }
};

// 설정 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    console.log('[설정 API] GET 요청 시작');

    // 세션 검증
    const session = await validateSession(request);
    if (!session) {
      console.log('[설정 API] 세션 검증 실패');
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.',
        code: 'UNAUTHORIZED'
      }, { status: 401 });
    }

    console.log('[설정 API] 세션 검증 성공:', session.username);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    console.log('[설정 API] 요청된 카테고리:', category);

    // 특정 카테고리 요청 시
    if (category && category in DEFAULT_SETTINGS) {
      console.log('[설정 API] 특정 카테고리 반환:', category);
      return NextResponse.json({
        success: true,
        data: { [category]: DEFAULT_SETTINGS[category as keyof typeof DEFAULT_SETTINGS] }
      });
    }
    
    // 전체 설정 반환
    console.log('[설정 API] 전체 설정 반환');
    return NextResponse.json({
      success: true,
      data: DEFAULT_SETTINGS
    });

  } catch (error) {
    console.error('[설정 API] 오류 발생:', error);
    
    return NextResponse.json({
      success: false,
      error: '설정을 불러오는 중 오류가 발생했습니다.',
      code: 'SETTINGS_LOAD_ERROR'
    }, { status: 500 });
  }
}

// 설정 업데이트 (POST)
export async function POST(request: NextRequest) {
  try {
    console.log('[설정 API] POST 요청 시작');

    // 세션 검증
    const session = await validateSession(request);
    if (!session) {
      console.log('[설정 API] 세션 검증 실패');
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.',
        code: 'UNAUTHORIZED'
      }, { status: 401 });
    }

    console.log('[설정 API] 세션 검증 성공:', session.username);
    
    const requestData = await request.json();
    const { category, settings } = requestData;

    console.log('[설정 API] 업데이트 요청:', { category, settings });

    if (!category || !settings) {
      return NextResponse.json({
        success: false,
        error: '카테고리와 설정 데이터가 필요합니다.',
        code: 'MISSING_REQUIRED_PARAMS'
      }, { status: 400 });
    }

    // 임시로 성공 응답 반환
    return NextResponse.json({
      success: true,
      message: '설정이 성공적으로 업데이트되었습니다.',
      data: settings
    });

  } catch (error) {
    console.error('[설정 API] POST 오류:', error);
    
    return NextResponse.json({
      success: false,
      error: '설정 업데이트 중 오류가 발생했습니다.',
      code: 'SETTINGS_UPDATE_ERROR'
    }, { status: 500 });
  }
}

// PUT 메서드도 POST와 동일하게 처리
export async function PUT(request: NextRequest) {
  return POST(request);
}

// 설정 삭제 (DELETE)
export async function DELETE(request: NextRequest) {
  try {
    console.log('[설정 API] DELETE 요청 시작');

    // 세션 검증
    const session = await validateSession(request);
    if (!session) {
      console.log('[설정 API] 세션 검증 실패');
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.',
        code: 'UNAUTHORIZED'
      }, { status: 401 });
    }

    console.log('[설정 API] 세션 검증 성공:', session.username);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const key = searchParams.get('key');

    console.log('[설정 API] 삭제 요청:', { category, key });

    if (!category) {
      return NextResponse.json({
        success: false,
        error: '카테고리가 필요합니다.',
        code: 'MISSING_REQUIRED_PARAMS'
      }, { status: 400 });
    }

    // 임시로 성공 응답 반환
    return NextResponse.json({
      success: true,
      message: '설정이 임시로 삭제되었습니다.',
      data: { category, key: key || null }
    });

  } catch (error) {
    console.error('[설정 API] DELETE 오류:', error);
    
    return NextResponse.json({
      success: false,
      error: '설정 삭제 중 오류가 발생했습니다.',
      code: 'SETTINGS_DELETE_ERROR'
    }, { status: 500 });
  }
} 