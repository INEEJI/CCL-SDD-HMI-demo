-- ==========================================
-- CCL SDD System - Core Database Schema
-- 코드에서 실제 사용하는 핵심 테이블들만 포함
-- ==========================================

-- 기존 테이블들 정리 (안전장치)
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS defect_detections CASCADE;
DROP TABLE IF EXISTS ai_models CASCADE;
DROP TABLE IF EXISTS image_files CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS boms CASCADE;
DROP TABLE IF EXISTS setting_backups CASCADE;
DROP TABLE IF EXISTS setting_restore_logs CASCADE;

-- ==========================================
-- 1. 사용자 관리 테이블
-- ==========================================

-- 사용자 테이블 (로그인 API 요구사항에 맞춤)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer',
    email VARCHAR(100) UNIQUE,
    full_name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 세션 테이블 (로그인 세션 관리)
CREATE TABLE sessions (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

-- ==========================================
-- 2. 시스템 설정 테이블
-- ==========================================

-- 시스템 설정 테이블 (settings API에서 사용)
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    key VARCHAR(100) NOT NULL,
    value TEXT,
    description TEXT,
    data_type VARCHAR(20) DEFAULT 'string',
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category, key)
);

-- ==========================================
-- 3. 고객사 및 BOM 관리
-- ==========================================

-- 고객사 테이블
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    contact_person VARCHAR(100),
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- BOM 테이블
CREATE TABLE boms (
    id SERIAL PRIMARY KEY,
    bom_id VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    material_type VARCHAR(50),
    thickness DECIMAL(8,2),
    width DECIMAL(10,2),
    length DECIMAL(10,2),
    specifications TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 4. 생산 스케줄 및 검사 데이터
-- ==========================================

-- 스케줄 테이블 (data-management API에서 사용)
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    coil_id VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    bom_id INTEGER REFERENCES boms(id),
    status VARCHAR(20) DEFAULT 'scheduled',
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    progress_percentage INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled'))
);

-- AI 모델 테이블 (models API에서 사용)
CREATE TABLE ai_models (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL,
    model_type VARCHAR(50) DEFAULT 'CNN',
    file_path TEXT,
    file_size BIGINT,
    description TEXT,
    accuracy_score DECIMAL(6,4),
    precision_score DECIMAL(6,4),
    recall_score DECIMAL(6,4),
    f1_score DECIMAL(6,4),
    is_deployed BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(model_name, version)
);

-- 결함 검출 테이블
CREATE TABLE defect_detections (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    model_id INTEGER REFERENCES ai_models(id),
    defect_type VARCHAR(50) NOT NULL,
    confidence_score DECIMAL(6,4) NOT NULL,
    position_x DECIMAL(10,2),
    position_y DECIMAL(10,2),
    width DECIMAL(10,2),
    height DECIMAL(10,2),
    severity_level VARCHAR(20) DEFAULT 'medium',
    is_false_positive BOOLEAN DEFAULT false,
    detection_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    CHECK (severity_level IN ('low', 'medium', 'high', 'critical'))
);

-- 이미지 파일 테이블
CREATE TABLE image_files (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    defect_detection_id INTEGER REFERENCES defect_detections(id) ON DELETE SET NULL,
    upload_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 5. 백업 관리 (settings 백업용)
-- ==========================================

-- 설정 백업 테이블
CREATE TABLE setting_backups (
    id SERIAL PRIMARY KEY,
    backup_id VARCHAR(100) UNIQUE NOT NULL,
    backup_data JSONB NOT NULL,
    file_size BIGINT,
    checksum VARCHAR(64),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 백업 복원 로그 테이블
CREATE TABLE setting_restore_logs (
    id SERIAL PRIMARY KEY,
    backup_id VARCHAR(100) NOT NULL,
    restored_settings_count INTEGER DEFAULT 0,
    restored_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- ==========================================
-- 인덱스 생성
-- ==========================================

-- 사용자 관련 인덱스
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_sessions_expire ON sessions(expire);

-- 시스템 설정 인덱스
CREATE INDEX idx_system_settings_category ON system_settings(category);
CREATE INDEX idx_system_settings_key ON system_settings(key);
CREATE INDEX idx_system_settings_category_key ON system_settings(category, key);

-- 고객사 및 BOM 인덱스
CREATE INDEX idx_customers_code ON customers(code);
CREATE INDEX idx_customers_is_active ON customers(is_active);
CREATE INDEX idx_boms_bom_id ON boms(bom_id);
CREATE INDEX idx_boms_customer_id ON boms(customer_id);

-- 스케줄 관련 인덱스
CREATE INDEX idx_schedules_coil_id ON schedules(coil_id);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedules_customer_id ON schedules(customer_id);

-- 결함 검출 관련 인덱스
CREATE INDEX idx_defect_detections_schedule_id ON defect_detections(schedule_id);
CREATE INDEX idx_defect_detections_defect_type ON defect_detections(defect_type);
CREATE INDEX idx_defect_detections_detection_time ON defect_detections(detection_time);
CREATE INDEX idx_image_files_schedule_id ON image_files(schedule_id);

-- AI 모델 관련 인덱스
CREATE INDEX idx_ai_models_is_deployed ON ai_models(is_deployed);
CREATE INDEX idx_ai_models_is_active ON ai_models(is_active);

-- 백업 관련 인덱스
CREATE INDEX idx_setting_backups_backup_id ON setting_backups(backup_id);
CREATE INDEX idx_setting_backups_created_at ON setting_backups(created_at);

-- ==========================================
-- 트리거 함수 및 트리거 생성
-- ==========================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at 
    BEFORE UPDATE ON system_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_boms_updated_at 
    BEFORE UPDATE ON boms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at 
    BEFORE UPDATE ON schedules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_models_updated_at 
    BEFORE UPDATE ON ai_models 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 백업 파일 크기 계산 함수
CREATE OR REPLACE FUNCTION calculate_backup_size()
RETURNS TRIGGER AS $$
BEGIN
    NEW.file_size = LENGTH(NEW.backup_data::text);
    NEW.checksum = MD5(NEW.backup_data::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 백업 크기 계산 트리거
CREATE TRIGGER backup_size_trigger
    BEFORE INSERT OR UPDATE ON setting_backups
    FOR EACH ROW EXECUTE FUNCTION calculate_backup_size();

-- ==========================================
-- 기본 데이터 삽입
-- ==========================================

-- 기본 사용자 생성 (bcryptjs로 해시된 'password')
INSERT INTO users (username, password_hash, role, full_name, email) VALUES
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', '시스템 관리자', 'admin@company.com'),
('operator', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'operator', '검사원', 'operator@company.com'),
('viewer', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'viewer', '뷰어', 'viewer@company.com')
ON CONFLICT (username) DO NOTHING;

-- 기본 시스템 설정
INSERT INTO system_settings (category, key, value, data_type, description, is_public) VALUES
('system', 'name', 'CCL SDD System', 'string', '시스템 이름', true),
('system', 'version', '1.0.0', 'string', '시스템 버전', true),
('upload', 'max_image_size', '10485760', 'number', '최대 이미지 크기 (bytes)', false),
('auth', 'session_timeout', '86400', 'number', '세션 타임아웃 (초)', false),
('detection', 'defect_types', '["scratch", "dent", "hole", "stain", "crack", "bubble", "wrinkle", "edge_damage"]', 'json', '지원하는 결함 유형', true)
ON CONFLICT (category, key) DO NOTHING;

-- 기본 고객사 데이터
INSERT INTO customers (name, code, contact_person, contact_email, contact_phone, address) VALUES
('삼성전자', 'SEC', '김철수', 'kim@samsung.com', '02-1234-5678', '서울시 강남구'),
('LG전자', 'LGE', '이영희', 'lee@lg.com', '02-2345-6789', '서울시 서초구'),
('현대자동차', 'HMC', '박민수', 'park@hyundai.com', '02-3456-7890', '서울시 종로구')
ON CONFLICT (code) DO NOTHING;

-- 기본 BOM 데이터
INSERT INTO boms (bom_id, customer_id, material_type, thickness, width, length, specifications) VALUES
('BOM_SEC_001', 1, '강판', 0.5, 1200.0, 2000.0, '고장력 강판, 표면처리: 아연도금'),
('BOM_LGE_001', 2, '알루미늄', 0.8, 1000.0, 1500.0, '알루미늄 합금, 표면처리: 양극산화'),
('BOM_HMC_001', 3, '강판', 1.0, 1500.0, 2500.0, '자동차용 강판, 표면처리: 전기아연도금')
ON CONFLICT (bom_id) DO NOTHING;

-- 기본 AI 모델 데이터
INSERT INTO ai_models (model_name, version, model_type, file_path, file_size, description, accuracy_score, created_by) VALUES
('DefectNet', '1.0.0', 'CNN', '/models/defectnet_v1.0.pth', 524288000, '기본 결함 검출 모델', 0.9123, 1),
('DefectNet', '2.0.0', 'CNN', '/models/defectnet_v2.0.pth', 536870912, '개선된 결함 검출 모델', 0.9456, 1),
('DefectNet', '2.1.0', 'CNN', '/models/defectnet_v2.1.pth', 524288000, '최신 결함 검출 모델', 0.9542, 1)
ON CONFLICT (model_name, version) DO NOTHING;

-- 현재 배포된 모델 설정
UPDATE ai_models SET is_deployed = true WHERE model_name = 'DefectNet' AND version = '2.1.0';

-- 스키마 생성 완료 메시지
SELECT 'CCL SDD System Core Database Schema Created Successfully' as result;
