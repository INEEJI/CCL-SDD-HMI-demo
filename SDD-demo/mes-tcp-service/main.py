"""
인이지 TCP 서비스 메인 실행 파일 - PostgreSQL 연동 추가
"""

import asyncio
import logging
import os
import signal
from typing import Dict, Any

from app.application.use_case import (
    DataProcessingUseCase, 
    ConnectionManagementUseCase,
    DataQueryUseCase
)
from app.adapters.storage.memory_repository import MemoryRepository
from app.adapters.storage.postgresql_repository import PostgreSQLRepository
from app.adapters.tcp.tcp_receiver import TCPReceiver
from app.adapters.tcp.tcp_sender import TCPSender
from app.domain.service import DataParsingService
from app.config.settings import get_settings


# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class IneijiTCPService:
    """인이지 TCP 서비스 메인 클래스 - PostgreSQL 연동 포함"""
    
    def __init__(self):
        self.settings = get_settings()
        self.running = False
        
        # 저장소 초기화
        self.memory_storage = MemoryRepository()
        self.postgresql_storage = PostgreSQLRepository(
            connection_string=self._get_postgresql_connection_string()
        )
        
        # 서비스 초기화
        self.parsing_service = DataParsingService()
        self.tcp_sender = TCPSender()
        
        # UseCase 초기화
        self.data_processing_use_case = DataProcessingUseCase(
            storage=self.memory_storage,
            postgresql_storage=self.postgresql_storage,
            data_sender=self.tcp_sender,
            parsing_service=self.parsing_service
        )
        
        self.connection_management_use_case = ConnectionManagementUseCase(
            postgresql_storage=self.postgresql_storage
        )
        
        self.data_query_use_case = DataQueryUseCase(
            postgresql_storage=self.postgresql_storage
        )
        
        # TCP 수신기들
        self.tcp_receivers = {}
        
    def _get_postgresql_connection_string(self) -> str:
        """PostgreSQL 연결 문자열 생성"""
        db_host = os.getenv('DB_HOST', 'localhost')
        db_port = os.getenv('DB_PORT', '5432')
        db_name = os.getenv('DB_NAME', 'ccl_sdd_system')
        db_user = os.getenv('DB_USER', 'postgres')
        db_password = os.getenv('DB_PASSWORD', 'password')
        
        return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    
    async def initialize(self) -> bool:
        """서비스 초기화"""
        try:
            logger.info("인이지 TCP 서비스 초기화 시작...")
            
            # 1. 데이터베이스 연결 초기화
            if not await self.connection_management_use_case.initialize_connections():
                logger.error("데이터베이스 연결 초기화 실패")
                return False
            
            # 2. TCP 수신기 초기화
            await self._initialize_tcp_receivers()
            
            # 3. TCP 송신기 초기화
            await self.tcp_sender.initialize()
            
            logger.info("인이지 TCP 서비스 초기화 완료")
            return True
            
        except Exception as e:
            logger.error(f"서비스 초기화 실패: {e}")
            return False
    
    async def _initialize_tcp_receivers(self) -> None:
        """TCP 수신기들 초기화"""
        # 동국으로부터 데이터 수신 (포트 9304)
        self.tcp_receivers['dongkook'] = TCPReceiver(
            host=self.settings.INEIJI_HOST,
            port=self.settings.INEIJI_SERVER1_PORT,
            data_handler=self._handle_dongkook_data
        )
        
        # 고기원으로부터 ACK 수신 (포트 9306)
        self.tcp_receivers['gogi_ack'] = TCPReceiver(
            host=self.settings.INEIJI_HOST,
            port=self.settings.INEIJI_SERVER2_PORT,
            data_handler=self._handle_gogi_ack
        )
    
    async def _handle_dongkook_data(self, data: str, client_info: Dict[str, Any]) -> None:
        """동국 데이터 처리"""
        try:
            success = await self.data_processing_use_case.process_received_data(
                raw_data=data, 
                source=f"dongkook_{client_info.get('address', 'unknown')}"
            )
            
            if success:
                logger.debug(f"동국 데이터 처리 완료: {len(data)} bytes")
            else:
                logger.warning(f"동국 데이터 처리 실패: {data[:100]}...")
                
        except Exception as e:
            logger.error(f"동국 데이터 처리 중 오류: {e}")
    
    async def _handle_gogi_ack(self, data: str, client_info: Dict[str, Any]) -> None:
        """고기원 ACK 처리 (기존 로직 유지)"""
        try:
            logger.debug(f"고기원 ACK 수신: {data}")
            # ACK 처리 로직 (필요시 구현)
        except Exception as e:
            logger.error(f"고기원 ACK 처리 중 오류: {e}")
    
    async def start(self) -> None:
        """서비스 시작"""
        try:
            if not await self.initialize():
                raise RuntimeError("서비스 초기화 실패")
            
            self.running = True
            logger.info("인이지 TCP 서비스 시작됨")
            
            # TCP 수신기들 시작
            tasks = []
            for name, receiver in self.tcp_receivers.items():
                task = asyncio.create_task(receiver.start())
                tasks.append(task)
                logger.info(f"TCP 수신기 '{name}' 시작됨 - 포트 {receiver.port}")
            
            # 상태 모니터링 태스크 시작
            monitor_task = asyncio.create_task(self._monitor_status())
            tasks.append(monitor_task)
            
            # 모든 태스크 대기
            await asyncio.gather(*tasks, return_exceptions=True)
            
        except Exception as e:
            logger.error(f"서비스 시작 실패: {e}")
            raise
    
    async def _monitor_status(self) -> None:
        """서비스 상태 모니터링"""
        while self.running:
            try:
                # 30초마다 상태 체크
                await asyncio.sleep(30)
                
                # 처리 통계 조회
                stats = await self.data_processing_use_case.get_processing_stats()
                logger.info(f"처리 통계: {stats}")
                
                # 헬스체크
                health = await self.data_processing_use_case.health_check()
                if not all(health.values()):
                    logger.warning(f"헬스체크 실패: {health}")
                
            except Exception as e:
                logger.error(f"상태 모니터링 오류: {e}")
    
    async def stop(self) -> None:
        """서비스 중지"""
        try:
            logger.info("인이지 TCP 서비스 중지 시작...")
            self.running = False
            
            # TCP 수신기들 중지
            for name, receiver in self.tcp_receivers.items():
                await receiver.stop()
                logger.info(f"TCP 수신기 '{name}' 중지됨")
            
            # TCP 송신기 중지
            await self.tcp_sender.cleanup()
            
            # 데이터베이스 연결 정리
            await self.connection_management_use_case.cleanup_connections()
            
            logger.info("인이지 TCP 서비스 중지 완료")
            
        except Exception as e:
            logger.error(f"서비스 중지 중 오류: {e}")
    
    async def get_service_info(self) -> Dict[str, Any]:
        """서비스 정보 조회"""
        try:
            stats = await self.data_processing_use_case.get_processing_stats()
            health = await self.data_processing_use_case.health_check()
            
            return {
                'service_name': 'Ineiji TCP Service',
                'status': 'running' if self.running else 'stopped',
                'tcp_receivers': {
                    name: {
                        'host': receiver.host,
                        'port': receiver.port,
                        'running': receiver.running
                    }
                    for name, receiver in self.tcp_receivers.items()
                },
                'processing_stats': stats,
                'health_check': health,
                'settings': {
                    'host': self.settings.INEIJI_HOST,
                    'server1_port': self.settings.INEIJI_SERVER1_PORT,
                    'server2_port': self.settings.INEIJI_SERVER2_PORT,
                }
            }
        except Exception as e:
            logger.error(f"서비스 정보 조회 실패: {e}")
            return {'error': str(e)}


# 전역 서비스 인스턴스
service_instance: IneijiTCPService = None


async def main():
    """메인 실행 함수"""
    global service_instance
    
    try:
        # 서비스 인스턴스 생성
        service_instance = IneijiTCPService()
        
        # 시그널 핸들러 등록
        def signal_handler(signum, frame):
            logger.info(f"시그널 {signum} 수신됨. 서비스 종료 중...")
            if service_instance:
                asyncio.create_task(service_instance.stop())
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # 서비스 시작
        await service_instance.start()
        
    except KeyboardInterrupt:
        logger.info("사용자에 의한 서비스 종료")
    except Exception as e:
        logger.error(f"서비스 실행 중 오류: {e}")
    finally:
        if service_instance:
            await service_instance.stop()


if __name__ == "__main__":
    asyncio.run(main()) 