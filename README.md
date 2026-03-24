# Fact Maze — AI 허위 이미지 탐지 시스템

> **팩트를 만들어 가는 사람들**

## 개요

**Fact Maze**는 딥페이크 및 AI 생성 이미지를 과학적 알고리즘으로 탐지하고, 실시간 다중 팩트체크를 통해 허위정보를 검증하는 웹 애플리케이션입니다.

이란-이스라엘, 러시아-우크라이나 등 분쟁 지역에서 확산되는 AI 합성 이미지, SNS를 통해 빠르게 퍼지는 허위정보, 딥페이크를 활용한 악성 범죄 등을 빠르게 검증합니다.

## 주요 기능

### 🔬 AI 이미지 탐지 알고리즘 (7단계)
1. **Luminance 변환**: `L = 0.2126·R + 0.7152·G + 0.0722·B`
2. **Sobel Gradient 계산**: `Gx = ∂L/∂x, Gy = ∂L/∂y`
3. **2D 벡터 구성**: `v(x,y) = [Gx, Gy]^T`
4. **행렬 평탄화**: `M ∈ ℝ^(N×2)`
5. **공분산 행렬**: `C = (1/N)·M^T·M`
6. **PCA 분석**: `Trace(C) = C₀₀ + C₁₁`
7. **AI 점수**: `Score = min(100, Trace(C)/12)`

### 🌐 실시간 팩트체크
- DuckDuckGo Instant Answers API
- GDELT 글로벌 뉴스 데이터베이스
- 주제별 큐레이션 팩트체크 소스 (Reuters, AFP, Bellingcat, KISA 등)
- IFCN 인증 팩트체크 기관 링크 제공

### 💬 AI 채팅 팩트체크
- 분석 결과 기반 대화형 팩트체크
- 알고리즘 원리 설명
- 딥페이크/분쟁 이미지 관련 정보 제공

### 📄 상세 분석 보고서
- 공분산 행렬 전체 수치 포함
- JSON 형식 다운로드
- 데이터 출처 명시

## 컬러 시스템 (7색)

| 색상 | 코드 | 용도 |
|------|------|------|
| Near Black | `#0D1117` | 배경 |
| Dark Surface | `#151B23` | 카드/패널 |
| Cyan | `#00D4FF` | 주요 색상 |
| Purple | `#7B2FFF` | 보조 색상 |
| Red | `#FF3366` | 경고/위험 |
| Orange | `#FF9900` | 주의/불확실 |
| Green | `#22C55E` | 안전/실제 |

## 기술 스택

- **Backend**: Node.js + Express.js
- **이미지 처리**: Sharp (고성능 이미지 분석)
- **실시간 통신**: WebSocket (ws)
- **파일 업로드**: Multer
- **외부 API**: DuckDuckGo, GDELT, 큐레이션 팩트체크 DB

## 설치 및 실행

```bash
npm install
npm start
```

서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/analyze` | 이미지 AI 탐지 분석 |
| POST | `/api/factcheck` | 키워드 팩트체크 검색 |
| POST | `/api/chat` | AI 채팅 팩트체크 |
| GET | `/api/report/:id` | 분석 보고서 조회 |
| GET | `/api/export/:id` | 보고서 JSON 다운로드 |

## 심사 기준 부합성

| 항목 | 내용 | 배점 |
|------|------|------|
| 적합성 | AI 허위정보로 인한 사회적 피해 문제 해결 | 20 |
| 안전성 | 개인정보 미수집, 서버측 이미지 즉시 삭제, IFCN 인증 소스만 사용 | 20 |
| 창의성 | 물리적 특징 기반 탐지 + 실시간 팩트체크 + 대화형 검증 결합 | 30 |
| 실현 가능성 | Node.js + Sharp 기반 완전 구현, 외부 API 통합 | 10 |
| 확장성 | 모바일 앱, 브라우저 확장, SNS 플랫폼 API 연동 가능 | 20 |

## 라이선스

팩트체크 소스 데이터 출처:
- Reuters Fact Check
- AFP Fact Check  
- Bellingcat (OSINT)
- KISA 한국인터넷진흥원
- MIT Media Lab
- NIST
- Yonhap News 연합뉴스
- Google Fact Check Tools
- IFCN 국제팩트체킹네트워크
