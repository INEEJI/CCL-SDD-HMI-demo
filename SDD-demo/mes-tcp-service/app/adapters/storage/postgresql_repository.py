"""
PostgreSQL 데이터베이스 어댑터
기존 파이썬 MES TCP 서비스와 PostgreSQL 연동
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
import asyncpg
from asyncpg import Pool

from app.domain.model import TCData, TCType
from app.ports.output_port import StoragePort


logger = logging.getLogger(__name__)


class PostgreSQLRepository(StoragePort):
    """PostgreSQL 데이터베이스 리포지토리"""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.pool: Optional[Pool] = None
        
    async def connect(self) -> None:
        """데이터베이스 연결 풀 생성"""
        try:
            self.pool = await asyncpg.create_pool(
                self.connection_string,
                min_size=2,
                max_size=10,
                command_timeout=60
            )
            logger.info("PostgreSQL 연결 풀 생성 완료")
        except Exception as e:
            logger.error(f"PostgreSQL 연결 실패: {e}")
            raise
    
    async def disconnect(self) -> None:
        """데이터베이스 연결 풀 해제"""
        if self.pool:
            await self.pool.close()
            logger.info("PostgreSQL 연결 풀 해제 완료")
    
    async def save_tc_data(self, tc_data: TCData) -> bool:
        """TC 데이터 저장"""
        if not self.pool:
            logger.error("데이터베이스 연결이 없습니다")
            return False
        
        try:
            async with self.pool.acquire() as conn:
                if tc_data.tc_type == TCType.TC_4000:
                    await self._save_tc_4000(conn, tc_data)
                elif tc_data.tc_type == TCType.TC_4001:
                    await self._save_tc_4001(conn, tc_data)
                elif tc_data.tc_type == TCType.TC_4002:
                    await self._save_tc_4002(conn, tc_data)
                elif tc_data.tc_type == TCType.TC_4003:
                    await self._save_tc_4003(conn, tc_data)
                else:
                    logger.warning(f"알 수 없는 TC 타입: {tc_data.tc_type}")
                    return False
                    
            logger.debug(f"TC 데이터 저장 완료: {tc_data.tc_type.value}")
            return True
            
        except Exception as e:
            logger.error(f"TC 데이터 저장 실패: {e}")
            return False
    
    async def _save_tc_4000(self, conn, tc_data: TCData) -> None:
        """TC 4000 (스케줄) 데이터 저장"""
        query = """
            INSERT INTO tc_4000_schedule (
                line_code, sequence_no, length, date, time, spare,
                coil_number, mo_number, product_group, material_code, 
                customer_name, ccl_bom, thickness, width, weight, 
                length_value, through_plate, sequence_order, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        """
        
        # TC 4000 데이터 파싱
        data = tc_data.data
        values = [
            data.get('line_code', ''),
            data.get('sequence_no', ''),
            int(data.get('length', 0)),
            data.get('date', ''),
            data.get('time', ''),
            data.get('spare', ''),
            data.get('coil_number', ''),
            data.get('mo_number', ''),
            data.get('product_group', ''),
            data.get('material_code', ''),
            data.get('customer_name', ''),
            data.get('ccl_bom', ''),
            float(data.get('thickness', 0)),
            int(data.get('width', 0)),
            int(data.get('weight', 0)),
            int(data.get('length_value', 0)),
            data.get('through_plate', ''),
            int(data.get('sequence_order', 0)),
            datetime.now()
        ]
        
        await conn.execute(query, *values)
    
    async def _save_tc_4001(self, conn, tc_data: TCData) -> None:
        """TC 4001 (출측 CUT) 데이터 저장"""
        query = """
            INSERT INTO tc_4001_cut (
                line_code, sequence_no, length, date, time, spare,
                coil_number, cut_mode, winding_length, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        """
        
        data = tc_data.data
        values = [
            data.get('line_code', ''),
            data.get('sequence_no', ''),
            int(data.get('length', 0)),
            data.get('date', ''),
            data.get('time', ''),
            data.get('spare', ''),
            data.get('coil_number', ''),
            int(data.get('cut_mode', 0)),
            int(data.get('winding_length', 0)),
            datetime.now()
        ]
        
        await conn.execute(query, *values)
    
    async def _save_tc_4002(self, conn, tc_data: TCData) -> None:
        """TC 4002 (WPD pass) 데이터 저장"""
        query = """
            INSERT INTO tc_4002_wpd (
                line_code, sequence_no, length, date, time, spare,
                coil_number, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """
        
        data = tc_data.data
        values = [
            data.get('line_code', ''),
            data.get('sequence_no', ''),
            int(data.get('length', 0)),
            data.get('date', ''),
            data.get('time', ''),
            data.get('spare', ''),
            data.get('coil_number', ''),
            datetime.now()
        ]
        
        await conn.execute(query, *values)
    
    async def _save_tc_4003(self, conn, tc_data: TCData) -> None:
        """TC 4003 (Line Speed) 데이터 저장"""
        query = """
            INSERT INTO tc_4003_speed (
                line_code, sequence_no, length, date, time, spare,
                line_speed, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """
        
        data = tc_data.data
        values = [
            data.get('line_code', ''),
            data.get('sequence_no', ''),
            int(data.get('length', 0)),
            data.get('date', ''),
            data.get('time', ''),
            data.get('spare', ''),
            int(data.get('line_speed', 0)),
            datetime.now()
        ]
        
        await conn.execute(query, *values)
    
    async def get_tc_data_by_type(self, tc_type: TCType, limit: int = 100) -> List[Dict[str, Any]]:
        """TC 타입별 데이터 조회"""
        if not self.pool:
            return []
        
        try:
            async with self.pool.acquire() as conn:
                if tc_type == TCType.TC_4000:
                    table_name = "tc_4000_schedule"
                elif tc_type == TCType.TC_4001:
                    table_name = "tc_4001_cut"
                elif tc_type == TCType.TC_4002:
                    table_name = "tc_4002_wpd"
                elif tc_type == TCType.TC_4003:
                    table_name = "tc_4003_speed"
                else:
                    return []
                
                query = f"""
                    SELECT * FROM {table_name}
                    ORDER BY created_at DESC
                    LIMIT $1
                """
                
                rows = await conn.fetch(query, limit)
                return [dict(row) for row in rows]
                
        except Exception as e:
            logger.error(f"TC 데이터 조회 실패: {e}")
            return []
    
    async def get_latest_tc_data_by_coil(self, coil_number: str) -> Dict[str, Any]:
        """코일번호별 최신 TC 데이터 조회"""
        if not self.pool:
            return {}
        
        try:
            async with self.pool.acquire() as conn:
                # 각 TC 테이블에서 해당 코일의 최신 데이터 조회
                results = {}
                
                # TC 4000 (스케줄)
                query = """
                    SELECT * FROM tc_4000_schedule 
                    WHERE coil_number = $1 
                    ORDER BY created_at DESC 
                    LIMIT 1
                """
                row = await conn.fetchrow(query, coil_number)
                if row:
                    results['schedule'] = dict(row)
                
                # TC 4001 (CUT)
                query = """
                    SELECT * FROM tc_4001_cut 
                    WHERE coil_number = $1 
                    ORDER BY created_at DESC 
                    LIMIT 1
                """
                row = await conn.fetchrow(query, coil_number)
                if row:
                    results['cut'] = dict(row)
                
                # TC 4002 (WPD)
                query = """
                    SELECT * FROM tc_4002_wpd 
                    WHERE coil_number = $1 
                    ORDER BY created_at DESC 
                    LIMIT 1
                """
                row = await conn.fetchrow(query, coil_number)
                if row:
                    results['wpd'] = dict(row)
                
                # TC 4003 (Speed) - 최근 10개 데이터
                query = """
                    SELECT * FROM tc_4003_speed 
                    WHERE created_at >= (
                        SELECT created_at FROM tc_4000_schedule 
                        WHERE coil_number = $1 
                        ORDER BY created_at DESC 
                        LIMIT 1
                    )
                    ORDER BY created_at DESC 
                    LIMIT 10
                """
                rows = await conn.fetch(query, coil_number)
                if rows:
                    results['speeds'] = [dict(row) for row in rows]
                
                return results
                
        except Exception as e:
            logger.error(f"코일별 TC 데이터 조회 실패: {e}")
            return {}
    
    async def get_connection_stats(self) -> Dict[str, Any]:
        """연결 풀 상태 정보 조회"""
        if not self.pool:
            return {"status": "disconnected"}
        
        return {
            "status": "connected",
            "size": self.pool.get_size(),
            "max_size": self.pool.get_max_size(),
            "min_size": self.pool.get_min_size(),
        }
    
    async def health_check(self) -> bool:
        """데이터베이스 연결 상태 확인"""
        if not self.pool:
            return False
        
        try:
            async with self.pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            return True
        except Exception as e:
            logger.error(f"데이터베이스 헬스체크 실패: {e}")
            return False 