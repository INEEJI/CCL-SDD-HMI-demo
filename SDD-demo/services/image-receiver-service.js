const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { Pool } = require('pg');
const chokidar = require('chokidar');
const WebSocket = require('ws');
const http = require('http');

// PostgreSQL 연결 설정
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ccl_sdd_system',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// 이미지 수신 서비스 클래스
class ImageReceiverService {
  constructor() {
    this.app = express();
    this.port = process.env.IMAGE_RECEIVER_PORT || 8081;
    this.imageBasePath = process.env.IMAGE_BASE_PATH || '/var/lib/ccl-images';
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    
    // HTTP 서버 및 WebSocket 서버
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.clients = new Set();
    
    // 파일 워처
    this.watchers = new Map();
    this.currentImages = new Map(); // 타입별 현재 이미지 저장
    
    // 통계 정보
    this.stats = {
      totalImages: 0,
      originalImages: 0,
      labeledImages: 0,
      errors: 0,
      totalSize: 0,
      lastImageTime: null,
      connectedClients: 0
    };

    this.setupDirectories();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupFileWatcher();
  }

  // 디렉토리 설정
  async setupDirectories() {
    try {
      const directories = [
        path.join(this.imageBasePath, 'original'),
        path.join(this.imageBasePath, 'labeled'),
        path.join(this.imageBasePath, 'temp')
      ];

      for (const dir of directories) {
        try {
          await fs.access(dir);
        } catch (error) {
          await fs.mkdir(dir, { recursive: true });
          console.log(`[Image Receiver] 디렉토리 생성: ${dir}`);
        }
      }
    } catch (error) {
      console.error('[Image Receiver] 디렉토리 설정 오류:', error);
    }
  }

  // 미들웨어 설정
  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

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

    // 멀터 설정 (이미지 업로드)
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const imageType = req.body.image_type || 'original';
        const destPath = path.join(this.imageBasePath, imageType);
        cb(null, destPath);
      },
      filename: (req, file, cb) => {
        const coilNumber = req.body.coil_number || 'unknown';
        const timestamp = Date.now();
        const imageType = req.body.image_type || 'original';
        const extension = path.extname(file.originalname) || '.jpg';
        
        // 파일명 형식: 코일번호_타임스탬프_타입.확장자
        const filename = `${coilNumber}_${timestamp}_${imageType}${extension}`;
        cb(null, filename);
      }
    });

    this.upload = multer({
      storage: storage,
      limits: {
        fileSize: this.maxFileSize,
        files: 10 // 최대 10개 파일 동시 업로드
      },
      fileFilter: (req, file, cb) => {
        // 이미지 파일만 허용
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('지원하지 않는 이미지 형식입니다.'), false);
        }
      }
    });
  }

  // 라우트 설정
  setupRoutes() {
    // 헬스 체크
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'Image Receiver Service',
        timestamp: new Date().toISOString(),
        stats: this.stats
      });
    });

    // 최신 이미지 조회 (실시간 스트리밍용)
    this.app.get('/latest/:type?', async (req, res) => {
      try {
        await this.getLatestImage(req, res);
      } catch (error) {
        console.error('[Image Receiver] 최신 이미지 조회 오류:', error);
        res.status(500).json({ error: '최신 이미지 조회 중 오류가 발생했습니다.' });
      }
    });

    // 이미지 목록 조회 (페이지네이션 지원)
    this.app.get('/list/:type?', async (req, res) => {
      try {
        await this.getImageList(req, res);
      } catch (error) {
        console.error('[Image Receiver] 이미지 목록 조회 오류:', error);
        res.status(500).json({ error: '이미지 목록 조회 중 오류가 발생했습니다.' });
      }
    });

    // 이미지 쌍 업로드 (원본 + 라벨링)
    this.app.post('/upload/pair', this.upload.fields([
      { name: 'original_image', maxCount: 1 },
      { name: 'labeled_image', maxCount: 1 }
    ]), async (req, res) => {
      try {
        await this.handlePairImageUpload(req, res);
      } catch (error) {
        console.error('[Image Receiver] 이미지 쌍 업로드 오류:', error);
        this.stats.errors++;
        res.status(500).json({ error: '이미지 쌍 업로드 중 오류가 발생했습니다.' });
      }
    });

    // 이미지 조회
    this.app.get('/image/:type/:filename', async (req, res) => {
      try {
        await this.serveImage(req, res);
      } catch (error) {
        console.error('[Image Receiver] 이미지 조회 오류:', error);
        res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
      }
    });

    // 통계 조회
    this.app.get('/stats', (req, res) => {
      res.json({
        ...this.stats,
        uptime: Date.now() - this.startTime
      });
    });
  }

  // 이미지 쌍 업로드 처리 (원본 + 라벨링)
  async handlePairImageUpload(req, res) {
    const files = req.files;
    const { coil_number, defect_data } = req.body;

    if (!files.original_image || !files.labeled_image) {
      return res.status(400).json({ error: '원본 이미지와 라벨링 이미지가 모두 필요합니다.' });
    }

    if (!coil_number) {
      return res.status(400).json({ error: '코일번호가 필요합니다.' });
    }

    const originalFile = files.original_image[0];
    const labeledFile = files.labeled_image[0];

    // 파일 이름 동기화 (같은 타임스탬프 사용)
    const timestamp = Date.now();
    const originalPath = path.join(this.imageBasePath, 'original', `${coil_number}_${timestamp}_original.jpg`);
    const labeledPath = path.join(this.imageBasePath, 'labeled', `${coil_number}_${timestamp}_labeled.jpg`);

    try {
      // 파일 이름 변경
      await fs.rename(originalFile.path, originalPath);
      await fs.rename(labeledFile.path, labeledPath);

      // 결함 데이터가 있으면 데이터베이스에 저장
      if (defect_data) {
        await this.saveDefectData(coil_number, defect_data, originalPath, labeledPath);
      }

      // 통계 업데이트
      this.updateStats('original', originalFile.size);
      this.updateStats('labeled', labeledFile.size);

      console.log(`[Image Receiver] 이미지 쌍 수신: ${coil_number}`);

      res.json({
        success: true,
        message: '이미지 쌍 업로드 완료',
        data: {
          coil_number: coil_number,
          original_image: {
            filename: path.basename(originalPath),
            path: originalPath,
            size: originalFile.size
          },
          labeled_image: {
            filename: path.basename(labeledPath),
            path: labeledPath,
            size: labeledFile.size
          },
          upload_time: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('[Image Receiver] 파일 처리 오류:', error);
      throw error;
    }
  }

  // 결함 데이터 저장
  async saveDefectData(coilNumber, defectData, originalPath, labeledPath) {
    try {
      const defects = Array.isArray(defectData) ? defectData : [defectData];

      for (const defect of defects) {
        const query = `
          INSERT INTO defect_detections (
            coil_number, defect_type, defect_position_x, defect_position_y, defect_position_meter,
            defect_size_width, defect_size_height, confidence_score, detection_time,
            original_image_path, labeled_image_path, model_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;

        const values = [
          coilNumber,
          defect.defect_type || 'unknown',
          parseInt(defect.defect_position_x) || 0,
          parseInt(defect.defect_position_y) || 0,
          parseFloat(defect.defect_position_meter) || 0,
          parseInt(defect.defect_size_width) || 0,
          parseInt(defect.defect_size_height) || 0,
          parseFloat(defect.confidence_score) || 0,
          new Date(),
          originalPath,
          labeledPath,
          parseInt(defect.model_id) || 1
        ];

        await pool.query(query, values);
      }

      console.log(`[Image Receiver] 결함 데이터 저장 완료: ${coilNumber}`);

    } catch (error) {
      console.error('[Image Receiver] 결함 데이터 저장 오류:', error);
      throw error;
    }
  }

  // 이미지 서빙
  async serveImage(req, res) {
    const { type, filename } = req.params;
    const imagePath = path.join(this.imageBasePath, type, filename);

    try {
      await fs.access(imagePath);
      res.sendFile(path.resolve(imagePath));
    } catch (error) {
      res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
    }
  }

  // 최신 이미지 조회 (실시간 스트리밍용) - 파일 워처 기반
  async getLatestImage(req, res) {
    const { type = 'original' } = req.params;
    const { coil_number } = req.query;

    try {
      // 코일번호별 조회 또는 전체 타입의 최신 이미지 조회
      const searchKey = coil_number ? `${type}_${coil_number}` : type;
      let latestImage = this.currentImages.get(searchKey);

      // 코일번호별 이미지가 없으면 해당 타입의 전체 최신 이미지 반환
      if (!latestImage && coil_number) {
        latestImage = this.currentImages.get(type);
      }

      if (latestImage) {
        res.json({
          success: true,
          image: latestImage,
          total_images: this.getTotalImageCount(type),
          is_file_watcher: true
        });
      } else {
        // 실제 이미지가 없으면 목업 이미지 반환
        return this.getMockLatestImage(req, res);
      }

    } catch (error) {
      console.error('[Image Receiver] 최신 이미지 조회 오류:', error);
      // 오류 시 목업 이미지 반환
      return this.getMockLatestImage(req, res);
    }
  }

  // 타입별 총 이미지 개수 계산
  getTotalImageCount(type) {
    return Array.from(this.currentImages.keys())
      .filter(key => key.startsWith(type + '_') || key === type)
      .length;
  }

  // 통계 업데이트
  updateStats(imageType, fileSize) {
    this.stats.totalImages++;
    this.stats.totalSize += fileSize;
    this.stats.lastImageTime = new Date();
    
    if (imageType === 'original') {
      this.stats.originalImages++;
    } else if (imageType === 'labeled') {
      this.stats.labeledImages++;
    }
  }

  // 서버 시작
  start() {
    this.startTime = Date.now();
    
    // HTTP 서버 시작 (WebSocket 포함)
    this.server.listen(this.port, () => {
      console.log(`[Image Receiver] 서비스 시작 - 포트: ${this.port}`);
      console.log(`[Image Receiver] WebSocket 서버 활성화`);
      console.log(`[Image Receiver] 이미지 저장 경로: ${this.imageBasePath}`);
      console.log(`[Image Receiver] 파일 워처 활성화됨`);
    });

    return this.server;
  }

  // 서버 중지
  stop() {
    console.log('[Image Receiver] 서비스 중지 중...');
    
    // WebSocket 서버 종료
    this.wss.close(() => {
      console.log('[Image Receiver] WebSocket 서버 종료됨');
    });

    // 파일 워처 종료
    this.watchers.forEach((watcher, type) => {
      watcher.close();
      console.log(`[Image Receiver] 파일 워처 종료됨 (${type})`);
    });
    this.watchers.clear();

    // HTTP 서버 종료
    this.server.close(() => {
      console.log('[Image Receiver] HTTP 서버 종료됨');
    });
  }

  // WebSocket 설정
  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      console.log('[Image Receiver] WebSocket 클라이언트 연결:', req.socket.remoteAddress);
      
      this.clients.add(ws);
      this.stats.connectedClients = this.clients.size;

      // 연결 시 현재 이미지 정보 전송
      this.sendCurrentImages(ws);

      ws.on('close', () => {
        console.log('[Image Receiver] WebSocket 클라이언트 연결 해제');
        this.clients.delete(ws);
        this.stats.connectedClients = this.clients.size;
      });

      ws.on('error', (error) => {
        console.error('[Image Receiver] WebSocket 오류:', error);
        this.clients.delete(ws);
        this.stats.connectedClients = this.clients.size;
      });

      // Ping/Pong으로 연결 상태 유지
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);

      ws.on('pong', () => {
        // 클라이언트가 살아있음을 확인
      });
    });
  }

  // 파일 워처 설정
  setupFileWatcher() {
    const imageTypes = ['original', 'labeled'];
    
    imageTypes.forEach(type => {
      const watchPath = path.join(this.imageBasePath, type);
      
      // 디렉토리가 존재하지 않으면 생성
      fs.mkdir(watchPath, { recursive: true }).catch(console.error);
      
      const watcher = chokidar.watch(watchPath, {
        ignored: /^\./, // 숨김 파일 무시
        persistent: true,
        ignoreInitial: false, // 시작 시 기존 파일도 감지
        depth: 0 // 하위 디렉토리 감시하지 않음
      });

      watcher
        .on('add', (filePath) => this.handleFileAdded(filePath, type))
        .on('change', (filePath) => this.handleFileChanged(filePath, type))
        .on('unlink', (filePath) => this.handleFileRemoved(filePath, type))
        .on('error', (error) => {
          console.error(`[Image Receiver] 파일 워처 오류 (${type}):`, error);
        });

      this.watchers.set(type, watcher);
      console.log(`[Image Receiver] 파일 워처 시작: ${watchPath}`);
    });

    // 시작 시 기존 최신 이미지 로드
    this.loadExistingLatestImages();
  }

  // 파일 추가 이벤트 처리
  async handleFileAdded(filePath, imageType) {
    try {
      const filename = path.basename(filePath);
      
      // 이미지 파일인지 확인
      if (!/\.(jpg|jpeg|png|bmp)$/i.test(filename)) {
        return;
      }

      console.log(`[Image Receiver] 새 이미지 파일 감지 (${imageType}): ${filename}`);

      const stats = await fs.stat(filePath);
      const timestamp = this.extractTimestampFromFilename(filename);
      const coilNumber = this.extractCoilNumberFromFilename(filename);

      const imageInfo = {
        filename: filename,
        url: `/image/${imageType}/${filename}`,
        timestamp: timestamp,
        type: imageType,
        coil_number: coilNumber,
        size: stats.size,
        created_at: stats.birthtime
      };

      // 현재 이미지 업데이트 (가장 최신 이미지만 유지)
      const currentKey = `${imageType}_${coilNumber}`;
      const currentImage = this.currentImages.get(currentKey);
      
      if (!currentImage || timestamp > currentImage.timestamp) {
        this.currentImages.set(currentKey, imageInfo);
        this.currentImages.set(imageType, imageInfo); // 전체 타입의 최신 이미지도 업데이트
        
        // 통계 업데이트
        this.updateStats(imageType, stats.size);
        
        // WebSocket으로 실시간 알림
        this.broadcastImageUpdate(imageInfo);
      }

    } catch (error) {
      console.error('[Image Receiver] 파일 추가 처리 오류:', error);
    }
  }

  // 파일 변경 이벤트 처리
  async handleFileChanged(filePath, imageType) {
    // 파일이 변경되면 추가와 동일하게 처리
    await this.handleFileAdded(filePath, imageType);
  }

  // 파일 삭제 이벤트 처리
  handleFileRemoved(filePath, imageType) {
    const filename = path.basename(filePath);
    console.log(`[Image Receiver] 이미지 파일 삭제 감지 (${imageType}): ${filename}`);
    
    // 삭제된 파일이 현재 이미지인 경우 다른 최신 이미지로 업데이트
    this.updateCurrentImageAfterDeletion(filename, imageType);
  }

  // 기존 최신 이미지 로드
  async loadExistingLatestImages() {
    const imageTypes = ['original', 'labeled'];
    
    for (const type of imageTypes) {
      try {
        const imageDir = path.join(this.imageBasePath, type);
        
        try {
          const files = await fs.readdir(imageDir);
          
          const imageFiles = files
            .filter(file => /\.(jpg|jpeg|png|bmp)$/i.test(file))
            .map(file => {
              const timestamp = this.extractTimestampFromFilename(file);
              const coilNumber = this.extractCoilNumberFromFilename(file);
              return {
                filename: file,
                url: `/image/${type}/${file}`,
                timestamp: timestamp,
                type: type,
                coil_number: coilNumber
              };
            })
            .sort((a, b) => b.timestamp - a.timestamp);

          if (imageFiles.length > 0) {
            const latestImage = imageFiles[0];
            this.currentImages.set(type, latestImage);
            console.log(`[Image Receiver] 기존 최신 이미지 로드 (${type}): ${latestImage.filename}`);
          }
          
        } catch (error) {
          console.log(`[Image Receiver] 디렉토리 없음 (${type}): ${imageDir}`);
        }
        
      } catch (error) {
        console.error(`[Image Receiver] 기존 이미지 로드 오류 (${type}):`, error);
      }
    }
  }

  // 삭제 후 현재 이미지 업데이트
  async updateCurrentImageAfterDeletion(deletedFilename, imageType) {
    try {
      const imageDir = path.join(this.imageBasePath, imageType);
      const files = await fs.readdir(imageDir);
      
      const imageFiles = files
        .filter(file => /\.(jpg|jpeg|png|bmp)$/i.test(file))
        .map(file => {
          const timestamp = this.extractTimestampFromFilename(file);
          const coilNumber = this.extractCoilNumberFromFilename(file);
          return {
            filename: file,
            url: `/image/${imageType}/${file}`,
            timestamp: timestamp,
            type: imageType,
            coil_number: coilNumber
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);

      if (imageFiles.length > 0) {
        const newLatestImage = imageFiles[0];
        this.currentImages.set(imageType, newLatestImage);
        this.broadcastImageUpdate(newLatestImage);
      } else {
        // 이미지가 없으면 제거
        this.currentImages.delete(imageType);
        this.broadcastImageUpdate({ type: imageType, deleted: true });
      }
      
    } catch (error) {
      console.error('[Image Receiver] 삭제 후 이미지 업데이트 오류:', error);
    }
  }

  // WebSocket으로 이미지 업데이트 브로드캐스트
  broadcastImageUpdate(imageInfo) {
    const message = JSON.stringify({
      type: 'image_update',
      data: imageInfo,
      timestamp: Date.now()
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('[Image Receiver] WebSocket 전송 오류:', error);
          this.clients.delete(client);
        }
      }
    });

    console.log(`[Image Receiver] 이미지 업데이트 브로드캐스트: ${imageInfo.filename || 'deleted'} (${this.clients.size}개 클라이언트)`);
  }

  // 현재 이미지 정보 전송
  sendCurrentImages(ws) {
    const currentImagesData = {
      type: 'current_images',
      data: Object.fromEntries(this.currentImages),
      timestamp: Date.now()
    };

    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(currentImagesData));
      } catch (error) {
        console.error('[Image Receiver] 현재 이미지 전송 오류:', error);
      }
    }
  }

  // 파일명에서 타임스탬프 추출
  extractTimestampFromFilename(filename) {
    // 파일명 형식: 코일번호_타임스탬프_타입.확장자 또는 20250409135914_코일번호_crop_번호.jpg
    const timestampMatch = filename.match(/(\d{13,})/); // 13자리 이상 숫자 (타임스탬프)
    if (timestampMatch) {
      return parseInt(timestampMatch[1]);
    }
    
    // 날짜 형식 파싱 (20250409135914)
    const dateMatch = filename.match(/^(\d{14})/);
    if (dateMatch) {
      const dateStr = dateMatch[1];
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(dateStr.substring(8, 10));
      const minute = parseInt(dateStr.substring(10, 12));
      const second = parseInt(dateStr.substring(12, 14));
      
      return new Date(year, month, day, hour, minute, second).getTime();
    }
    
    return Date.now(); // 기본값
  }

  // 파일명에서 코일번호 추출
  extractCoilNumberFromFilename(filename) {
    // 파일명에서 코일번호 추출
    const parts = filename.split('_');
    if (parts.length >= 2) {
      return parts[1]; // 두 번째 부분이 코일번호
    }
    return 'unknown';
  }

  // 목업 이미지 반환 (개발/테스트용)
  async getMockLatestImage(req, res) {
    const mockImages = [
      '20250409135914_2891_crop_5.jpg',
      '20250409135914_2890_crop_4.jpg', 
      '20250409135914_2889_crop_3.jpg',
      '20250409135914_1909_crop_5.jpg',
      '20250409135914_1908_crop_4.jpg'
    ];

    // 랜덤하게 하나 선택하되, 시간에 따라 순차적으로 변경
    const index = Math.floor(Date.now() / 3000) % mockImages.length;
    const selectedImage = mockImages[index];
    
    res.json({
      success: true,
      image: {
        filename: selectedImage,
        url: `/images/${selectedImage}`,
        timestamp: Date.now(),
        type: 'mock',
        coil_number: this.extractCoilNumberFromFilename(selectedImage)
      },
      total_images: mockImages.length,
      is_mock: true
    });
  }

  // 이미지 목록 조회 (페이지네이션 지원)
  async getImageList(req, res) {
    const { type = 'original' } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      coil_number,
      from_date,
      to_date 
    } = req.query;

    try {
      const imageDir = path.join(this.imageBasePath, type);
      
      // 디렉토리가 존재하지 않으면 목업 이미지 목록 반환
      try {
        await fs.access(imageDir);
      } catch (error) {
        return this.getMockImageList(req, res);
      }

      const files = await fs.readdir(imageDir);
      
      if (files.length === 0) {
        return this.getMockImageList(req, res);
      }

      // 필터링 및 정렬
      let imageFiles = files
        .filter(file => /\.(jpg|jpeg|png|bmp)$/i.test(file))
        .filter(file => coil_number ? file.includes(coil_number) : true)
        .map(file => {
          const timestamp = this.extractTimestampFromFilename(file);
          return {
            filename: file,
            url: `/image/${type}/${file}`,
            timestamp: timestamp,
            date: new Date(timestamp),
            type: type,
            coil_number: this.extractCoilNumberFromFilename(file)
          };
        });

      // 날짜 필터링
      if (from_date) {
        const fromDate = new Date(from_date);
        imageFiles = imageFiles.filter(img => img.date >= fromDate);
      }
      
      if (to_date) {
        const toDate = new Date(to_date);
        imageFiles = imageFiles.filter(img => img.date <= toDate);
      }

      // 최신순 정렬
      imageFiles.sort((a, b) => b.timestamp - a.timestamp);

      // 페이지네이션
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedImages = imageFiles.slice(startIndex, endIndex);

      res.json({
        success: true,
        images: paginatedImages,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(imageFiles.length / limit),
          total_images: imageFiles.length,
          images_per_page: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('[Image Receiver] 이미지 목록 조회 오류:', error);
      return this.getMockImageList(req, res);
    }
  }

  // 목업 이미지 목록 반환
  async getMockImageList(req, res) {
    const mockImages = [
      '20250409135914_2891_crop_5.jpg',
      '20250409135914_2891_crop_4.jpg',
      '20250409135914_2891_crop_3.jpg',
      '20250409135914_2890_crop_5.jpg',
      '20250409135914_2890_crop_4.jpg',
      '20250409135914_2890_crop_3.jpg',
      '20250409135914_2889_crop_5.jpg',
      '20250409135914_2889_crop_4.jpg',
      '20250409135914_2889_crop_3.jpg',
      '20250409135914_2888_crop_5.jpg'
    ];

    const { page = 1, limit = 20 } = req.query;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    const paginatedImages = mockImages.slice(startIndex, endIndex).map(filename => ({
      filename,
      url: `/images/${filename}`,
      timestamp: Date.now() - Math.random() * 86400000, // 랜덤 타임스탬프
      type: 'mock',
      coil_number: this.extractCoilNumberFromFilename(filename)
    }));

    res.json({
      success: true,
      images: paginatedImages,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(mockImages.length / limit),
        total_images: mockImages.length,
        images_per_page: parseInt(limit)
      },
      is_mock: true
    });
  }
}

// 서비스 시작
if (require.main === module) {
  const imageReceiverService = new ImageReceiverService();
  imageReceiverService.start();
}

module.exports = ImageReceiverService; 