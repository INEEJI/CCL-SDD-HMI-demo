import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://your-api-server.com/api', // 실제 백엔드 서버 주소로 교체해야 합니다.
  timeout: 10000, // 10초 타임아웃
  headers: {
    'Content-Type': 'application/json',
    // 'Authorization': `Bearer ${your_token}` // 로그인 구현 후 토큰 추가
  },
});

// 요청 인터셉터 (필요 시 사용)
apiClient.interceptors.request.use(
  (config) => {
    // 요청을 보내기 전에 수행할 작업 (예: 토큰 추가)
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 (필요 시 사용)
apiClient.interceptors.response.use(
  (response) => {
    // 응답 데이터 가공
    return response;
  },
  (error) => {
    // 2xx 범위 외의 상태 코드로 인한 오류 처리
    return Promise.reject(error);
  }
);

export default apiClient; 