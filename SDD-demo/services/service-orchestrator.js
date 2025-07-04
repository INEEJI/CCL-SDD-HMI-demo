const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const express = require('express');

// 서비스 오케스트레이터 클래스
class ServiceOrchestrator {
  constructor() {
    this.services = new Map();
    this.app = express();
    this.port = process.env.ORCHESTRATOR_PORT || 9000;
    this.logDir = process.env.LOG_DIR || './logs';
    
    // 서비스 정의
    this.serviceConfigs = {
      'ui-service': {
        name: 'UI Service',
        command: 'npm',
        args: ['run', 'dev'],
        cwd: path.resolve(__dirname, '..'),
        port: 3000,
        healthCheck: 'http://localhost:3000/api/auth/me',
        autoRestart: true,
        restartDelay: 5000
      },
      'mes-tcp-service': {
        name: 'MES TCP Service (Python)',
        command: 'python',
        args: ['main.py'],
        cwd: path.resolve(__dirname, '../mes-tcp-service'),
        port: 9304,
        healthCheck: null, // TCP 서비스는 HTTP 헬스체크 없음
        autoRestart: true,
        restartDelay: 5000
      },
      'image-receiver': {
        name: 'Image Receiver Service',
        command: 'node',
        args: ['services/image-receiver-service.js'],
        cwd: path.resolve(__dirname, '..'),
        port: 8081,
        healthCheck: 'http://localhost:8081/health',
        autoRestart: true,
        restartDelay: 3000
      },
      'defect-data-receiver': {
        name: 'Defect Data Receiver Service',
        command: 'node',
        args: ['services/defect-data-receiver-service.js'],
        cwd: path.resolve(__dirname, '..'),
        port: 8082,
        healthCheck: 'http://localhost:8082/health',
        autoRestart: true,
        restartDelay: 3000
      }
    };

    this.setupLogDirectory();
    this.setupAPI();
  }

  // 로그 디렉토리 설정
  async setupLogDirectory() {
    try {
      await fs.access(this.logDir);
    } catch (error) {
      await fs.mkdir(this.logDir, { recursive: true });
      console.log(`[Orchestrator] 로그 디렉토리 생성: ${this.logDir}`);
    }
  }

  // API 설정
  setupAPI() {
    this.app.use(express.json());

    // 전체 서비스 상태 조회
    this.app.get('/status', (req, res) => {
      const status = {};
      for (const [serviceId, service] of this.services) {
        status[serviceId] = {
          name: service.config.name,
          status: service.status,
          pid: service.process ? service.process.pid : null,
          port: service.config.port,
          startTime: service.startTime,
          restartCount: service.restartCount,
          lastError: service.lastError,
          uptime: service.startTime ? Date.now() - service.startTime : 0
        };
      }
      res.json({ services: status, timestamp: new Date().toISOString() });
    });

    // 개별 서비스 상태 조회
    this.app.get('/status/:serviceId', (req, res) => {
      const service = this.services.get(req.params.serviceId);
      if (!service) {
        return res.status(404).json({ error: '서비스를 찾을 수 없습니다.' });
      }

      res.json({
        serviceId: req.params.serviceId,
        name: service.config.name,
        status: service.status,
        pid: service.process ? service.process.pid : null,
        port: service.config.port,
        startTime: service.startTime,
        restartCount: service.restartCount,
        lastError: service.lastError,
        uptime: service.startTime ? Date.now() - service.startTime : 0,
        timestamp: new Date().toISOString()
      });
    });

    // 서비스 시작
    this.app.post('/start/:serviceId', async (req, res) => {
      try {
        const result = await this.startService(req.params.serviceId);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 서비스 중지
    this.app.post('/stop/:serviceId', async (req, res) => {
      try {
        const result = await this.stopService(req.params.serviceId);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 서비스 재시작
    this.app.post('/restart/:serviceId', async (req, res) => {
      try {
        const result = await this.restartService(req.params.serviceId);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 모든 서비스 시작
    this.app.post('/start-all', async (req, res) => {
      try {
        const results = await this.startAllServices();
        res.json({ results, timestamp: new Date().toISOString() });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 모든 서비스 중지
    this.app.post('/stop-all', async (req, res) => {
      try {
        const results = await this.stopAllServices();
        res.json({ results, timestamp: new Date().toISOString() });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 로그 조회
    this.app.get('/logs/:serviceId', async (req, res) => {
      try {
        const logs = await this.getServiceLogs(req.params.serviceId);
        res.json({ serviceId: req.params.serviceId, logs });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  // 서비스 시작
  async startService(serviceId) {
    const config = this.serviceConfigs[serviceId];
    if (!config) {
      throw new Error(`서비스 설정을 찾을 수 없습니다: ${serviceId}`);
    }

    // 이미 실행 중인지 확인
    const existingService = this.services.get(serviceId);
    if (existingService && existingService.status === 'running') {
      return { message: '서비스가 이미 실행 중입니다.', serviceId, status: 'running' };
    }

    try {
      console.log(`[Orchestrator] ${config.name} 시작 중...`);

      // 로그 파일 스트림 생성
      const logFile = path.join(this.logDir, `${serviceId}.log`);
      const logStream = await fs.open(logFile, 'a');

      // 프로세스 실행
      const process = spawn(config.command, config.args, {
        cwd: config.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      // 서비스 정보 저장
      const serviceInfo = {
        config,
        process,
        status: 'starting',
        startTime: Date.now(),
        restartCount: existingService ? existingService.restartCount : 0,
        lastError: null,
        logStream
      };

      this.services.set(serviceId, serviceInfo);

      // 프로세스 이벤트 처리
      process.stdout.on('data', (data) => {
        const logEntry = `[${new Date().toISOString()}] [STDOUT] ${data}`;
        logStream.write(logEntry);
        console.log(`[${serviceId}] ${data.toString().trim()}`);
      });

      process.stderr.on('data', (data) => {
        const logEntry = `[${new Date().toISOString()}] [STDERR] ${data}`;
        logStream.write(logEntry);
        console.error(`[${serviceId}] ERROR: ${data.toString().trim()}`);
      });

      process.on('exit', (code) => {
        console.log(`[Orchestrator] ${config.name} 종료됨 (코드: ${code})`);
        serviceInfo.status = 'stopped';
        serviceInfo.exitCode = code;

        if (code !== 0) {
          serviceInfo.lastError = `프로세스가 비정상 종료됨 (코드: ${code})`;
        }

        // 자동 재시작
        if (config.autoRestart && code !== 0) {
          setTimeout(() => {
            console.log(`[Orchestrator] ${config.name} 자동 재시작 시도...`);
            serviceInfo.restartCount++;
            this.startService(serviceId).catch(console.error);
          }, config.restartDelay);
        }
      });

      // 시작 완료 대기
      setTimeout(() => {
        if (serviceInfo.status === 'starting') {
          serviceInfo.status = 'running';
          console.log(`[Orchestrator] ${config.name} 시작 완료`);
        }
      }, 2000);

      return {
        message: '서비스 시작됨',
        serviceId,
        name: config.name,
        pid: process.pid,
        status: 'starting'
      };

    } catch (error) {
      console.error(`[Orchestrator] ${config.name} 시작 실패:`, error);
      throw error;
    }
  }

  // 서비스 중지
  async stopService(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`서비스를 찾을 수 없습니다: ${serviceId}`);
    }

    if (service.status === 'stopped') {
      return { message: '서비스가 이미 중지되어 있습니다.', serviceId, status: 'stopped' };
    }

    try {
      console.log(`[Orchestrator] ${service.config.name} 중지 중...`);

      // 프로세스 종료
      if (service.process) {
        service.process.kill('SIGTERM');
        
        // 강제 종료 타이머
        setTimeout(() => {
          if (service.process && !service.process.killed) {
            console.log(`[Orchestrator] ${service.config.name} 강제 종료`);
            service.process.kill('SIGKILL');
          }
        }, 10000);
      }

      service.status = 'stopping';

      // 로그 스트림 닫기
      if (service.logStream) {
        await service.logStream.close();
      }

      return {
        message: '서비스 중지됨',
        serviceId,
        name: service.config.name,
        status: 'stopping'
      };

    } catch (error) {
      console.error(`[Orchestrator] ${service.config.name} 중지 실패:`, error);
      throw error;
    }
  }

  // 서비스 재시작
  async restartService(serviceId) {
    await this.stopService(serviceId);
    
    // 중지 완료 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return await this.startService(serviceId);
  }

  // 모든 서비스 시작
  async startAllServices() {
    const results = [];
    
    for (const serviceId of Object.keys(this.serviceConfigs)) {
      try {
        const result = await this.startService(serviceId);
        results.push({ serviceId, success: true, result });
        
        // 서비스 간 시작 간격
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        results.push({ serviceId, success: false, error: error.message });
      }
    }
    
    return results;
  }

  // 모든 서비스 중지
  async stopAllServices() {
    const results = [];
    
    for (const serviceId of Object.keys(this.serviceConfigs)) {
      try {
        const result = await this.stopService(serviceId);
        results.push({ serviceId, success: true, result });
      } catch (error) {
        results.push({ serviceId, success: false, error: error.message });
      }
    }
    
    return results;
  }

  // 서비스 로그 조회
  async getServiceLogs(serviceId, lines = 100) {
    const logFile = path.join(this.logDir, `${serviceId}.log`);
    
    try {
      const data = await fs.readFile(logFile, 'utf8');
      const logLines = data.split('\n').slice(-lines);
      return logLines.join('\n');
    } catch (error) {
      throw new Error(`로그 파일을 읽을 수 없습니다: ${error.message}`);
    }
  }

  // 오케스트레이터 시작
  start() {
    this.server = this.app.listen(this.port, () => {
      console.log(`[Orchestrator] 서비스 오케스트레이터가 포트 ${this.port}에서 시작되었습니다.`);
      console.log(`[Orchestrator] 관리 대시보드: http://localhost:${this.port}/status`);
    });

    // 프로세스 종료 시 모든 서비스 정리
    process.on('SIGINT', async () => {
      console.log('\n[Orchestrator] 시스템 종료 중...');
      await this.stopAllServices();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n[Orchestrator] 시스템 종료 중...');
      await this.stopAllServices();
      process.exit(0);
    });
  }

  // 오케스트레이터 중지
  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('[Orchestrator] 오케스트레이터가 중지되었습니다.');
      });
    }
  }
}

// 서비스 시작
if (require.main === module) {
  const orchestrator = new ServiceOrchestrator();
  orchestrator.start();
  
  // 자동으로 모든 서비스 시작
  setTimeout(() => {
    console.log('[Orchestrator] 모든 서비스 자동 시작...');
    orchestrator.startAllServices().catch(console.error);
  }, 2000);
}

module.exports = ServiceOrchestrator; 