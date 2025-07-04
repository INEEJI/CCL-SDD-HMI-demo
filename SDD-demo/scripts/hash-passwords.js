const bcrypt = require('bcryptjs');

async function hashPasswords() {
  const saltRounds = 10;
  const password = 'password'; // 기본 비밀번호
  
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('===========================================');
    console.log('기본 비밀번호 해시 생성 완료');
    console.log('===========================================');
    console.log('원본 비밀번호:', password);
    console.log('해시된 비밀번호:', hash);
    console.log('===========================================');
    console.log('데이터베이스 초기화 SQL 업데이트:');
    console.log(`UPDATE users SET password_hash = '${hash}' WHERE username IN ('admin', 'operator', 'viewer');`);
    console.log('===========================================');
  } catch (error) {
    console.error('비밀번호 해시 생성 실패:', error);
  }
}

// 테스트용 비밀번호 검증
async function testPassword() {
  const password = 'password';
  const hash = '$2b$10$rOzJqQZ5Gp8KQr5Gp8KQr5Gp8KQr5Gp8KQr5Gp8KQr5Gp8KQr5Gp8K';
  
  try {
    const isValid = await bcrypt.compare(password, hash);
    console.log('비밀번호 검증 테스트:', isValid ? '성공' : '실패');
  } catch (error) {
    console.error('비밀번호 검증 실패:', error);
  }
}

if (require.main === module) {
  hashPasswords();
  testPassword();
}

module.exports = { hashPasswords }; 