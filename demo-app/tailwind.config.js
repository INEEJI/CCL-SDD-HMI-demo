/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 새로운 색상 팔레트 (전반적으로 차분하면서도 포인트가 되도록 조정)
        'body-bg': '#0D1117', // GitHub 스타일의 깊은 네이비 색상
        surface: 'rgba(22, 27, 34, 0.7)', // Glassmorphism을 위한 반투명 표면
        'surface-elevated': 'rgba(34, 39, 46, 0.8)',
        border: 'rgba(48, 54, 61, 0.8)', // 은은한 테두리
        
        primary: '#58A6FF',   // 주요 상호작용 및 하이라이트 (밝은 파랑)
        secondary: '#8B949E', // 보조 텍스트 (회색)
        accent: '#3FB950',    // 시스템 ON, 성공 (생동감 있는 녹색)
        danger: '#F85149',    // 시스템 OFF, 경고 (선명한 빨강)
        warning: '#D29922',   // 주의, 결함 수치 (앰버)
        
        'text-primary': '#C9D1D9', // 기본 텍스트
        'text-secondary': '#8B949E', // 보조 텍스트
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // 부드러운 그림자 효과
        'main': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'card': '0 4px 12px 0 rgba(0, 0, 0, 0.25)',
      },
      backdropBlur: {
        // 다양한 블러 효과
        'xl': '24px',
      }
    },
  },
  plugins: [],
}
