"""
기존 UseCase에 PostgreSQL 연동 기능 추가
"""

import logging
from typing import Dict, Any, Optional
from app.domain.model import TCData, TCType
from app.domain.service import DataParsingService
from app.ports.input_port import DataReceiverPort
from app.ports.output_port import StoragePort, DataSenderPort
from app.adapters.storage.postgresql_repository import PostgreSQLRepository


logger = logging.getLogger(__name__)


class DataProcessingUseCase:
    """데이터 처리 유스케이스 - PostgreSQL 연동 포함"""
    
    def __init__(
        self, 
        storage: StoragePort,
        postgresql_storage: PostgreSQLRepository,
        data_sender: DataSenderPort,
        parsing_service: DataParsingService
    ):
        self.storage = storage  # 기존 메모리 저장소
        self.postgresql_storage = postgresql_storage  # PostgreSQL 저장소
        self.data_sender = data_sender
        self.parsing_service = parsing_service
        self.stats = {
            'total_received': 0,
            'total_saved': 0,
            'postgresql_saved': 0,
            'errors': 0
        }
    
    async def process_received_data(self, raw_data: str, source: str) -> bool:
        """수신된 데이터 처리 - PostgreSQL 저장 포함"""
        try:
            self.stats['total_received'] += 1
            logger.info(f"데이터 수신: {source} - {len(raw_data)} bytes")
            
            # 1. 데이터 파싱
            tc_data = self.parsing_service.parse_tc_data(raw_data)
            if not tc_data:
                logger.warning(f"데이터 파싱 실패: {raw_data[:100]}...")
                self.stats['errors'] += 1
                return False
            
            # 2. 기존 메모리 저장소에 저장
            memory_saved = await self.storage.save_tc_data(tc_data)
            if memory_saved:
                self.stats['total_saved'] += 1
            
            # 3. PostgreSQL에 저장
            postgresql_saved = await self.postgresql_storage.save_tc_data(tc_data)
            if postgresql_saved:
                self.stats['postgresql_saved'] += 1
                logger.info(f"PostgreSQL 저장 완료: {tc_data.tc_type.value} - {tc_data.data.get('coil_number', 'N/A')}")
            else:
                logger.error(f"PostgreSQL 저장 실패: {tc_data.tc_type.value}")
            
            # 4. 고기원으로 데이터 전달 (기존 로직 유지)
            if tc_data.tc_type in [TCType.TC_4000, TCType.TC_4002, TCType.TC_4003]:
                await self._forward_to_gogi(tc_data)
            
            return memory_saved and postgresql_saved
            
        except Exception as e:
            logger.error(f"데이터 처리 중 오류: {e}")
            self.stats['errors'] += 1
            return False
    
    async def _forward_to_gogi(self, tc_data: TCData) -> None:
        """고기원으로 데이터 전달 (기존 로직)"""
        try:
            # 고기원 서버별 포트 매핑
            port_mapping = {
                TCType.TC_4000: 9308,  # 스케줄
                TCType.TC_4002: 9309,  # WPD pass
                TCType.TC_4003: 9310,  # Line Speed
            }
            
            target_port = port_mapping.get(tc_data.tc_type)
            if target_port:
                await self.data_sender.send_data(tc_data.raw_data, target_port)
                logger.debug(f"고기원 전달 완료: {tc_data.tc_type.value} -> 포트 {target_port}")
            
        except Exception as e:
            logger.error(f"고기원 데이터 전달 실패: {e}")
    
    async def get_processing_stats(self) -> Dict[str, Any]:
        """처리 통계 조회"""
        db_stats = await self.postgresql_storage.get_connection_stats()
        
        return {
            **self.stats,
            'postgresql_connection': db_stats,
            'success_rate': (
                self.stats['postgresql_saved'] / max(self.stats['total_received'], 1) * 100
            )
        }
    
    async def get_coil_data(self, coil_number: str) -> Dict[str, Any]:
        """코일번호별 데이터 조회"""
        try:
            return await self.postgresql_storage.get_latest_tc_data_by_coil(coil_number)
        except Exception as e:
            logger.error(f"코일 데이터 조회 실패: {e}")
            return {}
    
    async def health_check(self) -> Dict[str, bool]:
        """서비스 상태 확인"""
        return {
            'memory_storage': True,  # 메모리 저장소는 항상 사용 가능
            'postgresql_storage': await self.postgresql_storage.health_check(),
            'data_sender': True  # 기본적으로 사용 가능
        }


class ConnectionManagementUseCase:
    """연결 관리 유스케이스"""
    
    def __init__(self, postgresql_storage: PostgreSQLRepository):
        self.postgresql_storage = postgresql_storage
    
    async def initialize_connections(self) -> bool:
        """모든 연결 초기화"""
        try:
            await self.postgresql_storage.connect()
            logger.info("모든 데이터베이스 연결 초기화 완료")
            return True
        except Exception as e:
            logger.error(f"연결 초기화 실패: {e}")
            return False
    
    async def cleanup_connections(self) -> None:
        """모든 연결 정리"""
        try:
            await self.postgresql_storage.disconnect()
            logger.info("모든 데이터베이스 연결 정리 완료")
        except Exception as e:
            logger.error(f"연결 정리 실패: {e}")


class DataQueryUseCase:
    """데이터 조회 유스케이스"""
    
    def __init__(self, postgresql_storage: PostgreSQLRepository):
        self.postgresql_storage = postgresql_storage
    
    async def get_recent_tc_data(self, tc_type: TCType, limit: int = 100) -> list:
        """최근 TC 데이터 조회"""
        try:
            return await self.postgresql_storage.get_tc_data_by_type(tc_type, limit)
        except Exception as e:
            logger.error(f"TC 데이터 조회 실패: {e}")
            return []
    
    async def get_coil_summary(self, coil_number: str) -> Dict[str, Any]:
        """코일 요약 정보 조회"""
        try:
            data = await self.postgresql_storage.get_latest_tc_data_by_coil(coil_number)
            
            summary = {
                'coil_number': coil_number,
                'has_schedule': 'schedule' in data,
                'has_cut': 'cut' in data,
                'has_wpd': 'wpd' in data,
                'speed_records': len(data.get('speeds', [])),
                'last_updated': None
            }
            
            # 최근 업데이트 시간 찾기
            timestamps = []
            for key in ['schedule', 'cut', 'wpd']:
                if key in data and 'created_at' in data[key]:
                    timestamps.append(data[key]['created_at'])
            
            if timestamps:
                summary['last_updated'] = max(timestamps)
            
            return summary
            
        except Exception as e:
            logger.error(f"코일 요약 조회 실패: {e}")
            return {'coil_number': coil_number, 'error': str(e)} 