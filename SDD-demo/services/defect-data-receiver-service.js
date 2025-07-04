const express = require('express');
const { Pool } = require('pg');

// PostgreSQL 연결 설정
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ccl_sdd_system',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// 결함검출 데이터 수신 서비스 클래스
class DefectDataReceiverService {
  constructor() {
    this.app = express();
    this.port = process.env.DEFECT_DATA_PORT || 8082;
    
    // 통계 정보
    this.stats = {
      totalDefects: 0,
      defectsByType: {},
      errors: 0,
      lastDefectTime: null,
      averageConfidence: 0
    };

    this.setupMiddleware();
    this.setupRoutes();
  }

  // 미들웨어 설정
  setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // CORS 설정 (Jetson Orin AGX에서 접근 허용)
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // 요청 로깅
    this.app.use((req, res, next) => {
      console.log(`[Defect Data] ${req.method} ${req.path} - ${new Date().toISOString()}`);
      next();
    });
  }

  // 라우트 설정
  setupRoutes() {
    // 헬스 체크
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'Defect Data Receiver Service',
        timestamp: new Date().toISOString(),
        stats: this.stats
      });
    });

    // 단일 결함 데이터 수신
    this.app.post('/defect/single', async (req, res) => {
      try {
        await this.handleSingleDefect(req, res);
      } catch (error) {
        console.error('[Defect Data] 단일 결함 처리 오류:', error);
        this.stats.errors++;
        res.status(500).json({ error: '결함 데이터 처리 중 오류가 발생했습니다.' });
      }
    });

    // 배치 결함 데이터 수신
    this.app.post('/defect/batch', async (req, res) => {
      try {
        await this.handleBatchDefects(req, res);
      } catch (error) {
        console.error('[Defect Data] 배치 결함 처리 오류:', error);
        this.stats.errors++;
        res.status(500).json({ error: '배치 결함 데이터 처리 중 오류가 발생했습니다.' });
      }
    });

    // AI 모델 성능 업데이트
    this.app.post('/model/performance', async (req, res) => {
      try {
        await this.handleModelPerformance(req, res);
      } catch (error) {
        console.error('[Defect Data] 모델 성능 업데이트 오류:', error);
        this.stats.errors++;
        res.status(500).json({ error: '모델 성능 업데이트 중 오류가 발생했습니다.' });
      }
    });

    // 통계 조회
    this.app.get('/stats', (req, res) => {
      res.json({
        ...this.stats,
        uptime: Date.now() - this.startTime
      });
    });

    // 최근 결함 조회
    this.app.get('/defects/recent', async (req, res) => {
      try {
        await this.getRecentDefects(req, res);
      } catch (error) {
        console.error('[Defect Data] 최근 결함 조회 오류:', error);
        res.status(500).json({ error: '최근 결함 조회 중 오류가 발생했습니다.' });
      }
    });
  }

  // 단일 결함 데이터 처리
  async handleSingleDefect(req, res) {
    const defectData = req.body;

    // 필수 필드 검증
    const requiredFields = ['coil_number', 'defect_type', 'confidence_score'];
    for (const field of requiredFields) {
      if (!defectData[field]) {
        return res.status(400).json({ error: `필수 필드가 누락되었습니다: ${field}` });
      }
    }

    try {
      const defectId = await this.saveDefectData(defectData);
      
      // 통계 업데이트
      this.updateStats(defectData);

      console.log(`[Defect Data] 결함 저장 완료: ${defectData.coil_number} - ${defectData.defect_type}`);

      res.json({
        success: true,
        message: '결함 데이터 저장 완료',
        data: {
          defect_id: defectId,
          coil_number: defectData.coil_number,
          defect_type: defectData.defect_type,
          confidence_score: defectData.confidence_score,
          processed_time: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('[Defect Data] 결함 저장 오류:', error);
      throw error;
    }
  }

  // 배치 결함 데이터 처리
  async handleBatchDefects(req, res) {
    const { defects, coil_number, batch_info } = req.body;

    if (!Array.isArray(defects) || defects.length === 0) {
      return res.status(400).json({ error: '결함 데이터 배열이 필요합니다.' });
    }

    if (!coil_number) {
      return res.status(400).json({ error: '코일번호가 필요합니다.' });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    try {
      // 트랜잭션 시작
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        for (const defect of defects) {
          try {
            // 코일번호 설정
            defect.coil_number = coil_number;
            
            const defectId = await this.saveDefectData(defect, client);
            this.updateStats(defect);
            
            results.push({
              success: true,
              defect_id: defectId,
              defect_type: defect.defect_type
            });
            
            successCount++;

          } catch (error) {
            console.error(`[Defect Data] 개별 결함 저장 오류:`, error);
            results.push({
              success: false,
              error: error.message,
              defect_type: defect.defect_type
            });
            errorCount++;
          }
        }

        await client.query('COMMIT');
        
        console.log(`[Defect Data] 배치 처리 완료: ${coil_number}, 성공: ${successCount}, 실패: ${errorCount}`);

        res.json({
          success: true,
          message: `배치 결함 데이터 처리 완료`,
          data: {
            coil_number: coil_number,
            total_defects: defects.length,
            success_count: successCount,
            error_count: errorCount,
            results: results,
            processed_time: new Date().toISOString()
          }
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('[Defect Data] 배치 처리 오류:', error);
      throw error;
    }
  }

  // AI 모델 성능 업데이트
  async handleModelPerformance(req, res) {
    const { model_id, performance_data } = req.body;

    if (!model_id || !performance_data) {
      return res.status(400).json({ error: '모델 ID와 성능 데이터가 필요합니다.' });
    }

    try {
      const query = `
        UPDATE ai_models 
        SET 
          accuracy_score = COALESCE($2, accuracy_score),
          precision_score = COALESCE($3, precision_score),
          recall_score = COALESCE($4, recall_score),
          f1_score = COALESCE($5, f1_score),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const values = [
        model_id,
        performance_data.accuracy_score,
        performance_data.precision_score,
        performance_data.recall_score,
        performance_data.f1_score
      ];

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '모델을 찾을 수 없습니다.' });
      }

      console.log(`[Defect Data] 모델 성능 업데이트 완료: Model ID ${model_id}`);

      res.json({
        success: true,
        message: '모델 성능 업데이트 완료',
        data: {
          model: result.rows[0],
          updated_time: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('[Defect Data] 모델 성능 업데이트 오류:', error);
      throw error;
    }
  }

  // 최근 결함 조회
  async getRecentDefects(req, res) {
    const limit = parseInt(req.query.limit) || 20;
    const hours = parseInt(req.query.hours) || 24;

    try {
      const query = `
        SELECT 
          d.*,
          s.customer_name,
          s.ccl_bom,
          m.name as model_name
        FROM defect_detections d
        LEFT JOIN tc_4000_schedule s ON d.coil_number = s.coil_number
        LEFT JOIN ai_models m ON d.model_id = m.id
        WHERE d.detection_time >= NOW() - INTERVAL '${hours} hours'
        ORDER BY d.detection_time DESC
        LIMIT $1
      `;

      const result = await pool.query(query, [limit]);

      res.json({
        success: true,
        data: {
          defects: result.rows,
          count: result.rows.length,
          period_hours: hours,
          retrieved_time: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('[Defect Data] 최근 결함 조회 오류:', error);
      throw error;
    }
  }

  // 결함 데이터 저장
  async saveDefectData(defectData, client = null) {
    const dbClient = client || pool;

    const query = `
      INSERT INTO defect_detections (
        coil_number, defect_type, defect_position_x, defect_position_y, defect_position_meter,
        defect_size_width, defect_size_height, confidence_score, detection_time,
        original_image_path, labeled_image_path, model_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `;

    const values = [
      defectData.coil_number,
      defectData.defect_type || 'unknown',
      parseInt(defectData.defect_position_x) || 0,
      parseInt(defectData.defect_position_y) || 0,
      parseFloat(defectData.defect_position_meter) || 0,
      parseInt(defectData.defect_size_width) || 0,
      parseInt(defectData.defect_size_height) || 0,
      parseFloat(defectData.confidence_score) || 0,
      defectData.detection_time ? new Date(defectData.detection_time) : new Date(),
      defectData.original_image_path || null,
      defectData.labeled_image_path || null,
      parseInt(defectData.model_id) || 1
    ];

    const result = await dbClient.query(query, values);
    return result.rows[0].id;
  }

  // 통계 업데이트
  updateStats(defectData) {
    this.stats.totalDefects++;
    this.stats.lastDefectTime = new Date();

    // 결함 유형별 통계
    const defectType = defectData.defect_type || 'unknown';
    if (!this.stats.defectsByType[defectType]) {
      this.stats.defectsByType[defectType] = 0;
    }
    this.stats.defectsByType[defectType]++;

    // 평균 신뢰도 계산
    const confidence = parseFloat(defectData.confidence_score) || 0;
    const currentTotal = this.stats.averageConfidence * (this.stats.totalDefects - 1);
    this.stats.averageConfidence = (currentTotal + confidence) / this.stats.totalDefects;
  }

  // 서버 시작
  start() {
    this.server = this.app.listen(this.port, () => {
      console.log(`[Defect Data] 서버가 포트 ${this.port}에서 시작되었습니다.`);
    });

    this.startTime = Date.now();
  }

  // 서버 중지
  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('[Defect Data] 서버가 중지되었습니다.');
      });
    }
  }
}

// 서비스 시작
if (require.main === module) {
  const defectDataService = new DefectDataReceiverService();
  defectDataService.start();
}

module.exports = DefectDataReceiverService; 