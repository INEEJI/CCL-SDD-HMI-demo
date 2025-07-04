# AI Models Directory

이 디렉토리는 CCL SDD 시스템의 AI 모델들을 관리하는 공간입니다.

## 📁 구조

```
ai-models/
├── models/              # 학습된 모델 파일들
├── scripts/             # 모델 학습 및 평가 스크립트
├── data/                # 학습 데이터
├── requirements.txt     # Python 의존성
└── README.md           # 이 파일
```

## 🎯 목적

- **모델 버전 관리**: 다양한 버전의 AI 모델 파일 저장
- **모델 배포**: Next.js 애플리케이션에서 사용할 모델 제공
- **예측 서비스**: FastAPI 기반 예측 서버 구축

## 🔄 예상 출력

AI 모델은 다음 4가지 정보를 제공합니다:

1. **결함유형** (defect_type)
2. **결함크기** (defect_size_width, defect_size_height)
3. **결함위치** (defect_position_x, defect_position_y, defect_position_meter)
4. **결함발생시간** (detection_time)

## 🚀 향후 구현 계획

- FastAPI 기반 예측 서버
- 모델 성능 모니터링
- 자동 모델 업데이트
- A/B 테스트 지원

---

*현재는 준비 단계입니다. 실제 모델 파일과 스크립트는 향후 추가될 예정입니다.* 