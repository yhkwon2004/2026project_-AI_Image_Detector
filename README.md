# Fact Maze v7 — AI 딥페이크·허위 이미지 탐지 플랫폼

> **빅데이터 파이프라인 · 실시간 라벨링 · 온라인 학습 · 17개 기관 교차검증**  
> 7단계 물리 특성 분석 + GAN 판별자 + 확산모델 탐지 + 메타데이터 포렌식

---

## 📋 목차

- [시스템 아키텍처](#-시스템-아키텍처)
- [데이터 수집·처리 흐름](#-데이터-수집처리-흐름)
- [7단계 분석 알고리즘](#-7단계-분석-알고리즘)
- [물리적 특성 vs AI 생성 패턴](#-물리적-특성-vs-ai-생성-패턴)
- [교차검증 시스템](#-교차검증-시스템-17개-기관)
- [빅데이터 + 실시간 학습](#-빅데이터--실시간-학습)
- [API 레퍼런스](#-api-레퍼런스)
- [설치 및 실행](#-설치-및-실행)

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       FACT MAZE v7 — 전체 아키텍처                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [브라우저 클라이언트]                                                    │
│    ├── 홈 페이지        (히어로 + 통계)                                  │
│    ├── 이미지 분석 페이지 (드래그&드롭 + 10단계 토글)                      │
│    │    ├── 🖼️ 이미지 분석    ─→ 원본 + 4개 처리 맵 시각화               │
│    │    ├── 📊 단계별 분석    ─→ 10단계 AI 신호 (HIGH/MEDIUM/LOW)        │
│    │    ├── 🔢 물리 지표      ─→ 14개 물리 특성값 + 레이더 차트           │
│    │    ├── 🌐 17기관 교차검증 ─→ IFCN + OSINT + 국내기관 실시간         │
│    │    ├── 🧠 GAN 학습       ─→ 가중치 + 학습 진행 시각화               │
│    │    ├── 🔗 외부 검증      ─→ 전문 검증 사이트 크로스체크             │
│    │    ├── 📰 팩트체크 DB    ─→ GDELT + DuckDuckGo + Wikipedia          │
│    │    ├── 💬 AI 채팅        ─→ 분석 결과 기반 대화                     │
│    │    └── 📄 보고서         ─→ JSON 내보내기                           │
│    ├── 🧠 AI 학습 페이지    (ML 엔진 + 빅데이터 파이프라인)               │
│    ├── 🔀 시스템 흐름도     (데이터 흐름 + 아키텍처 시각화)               │
│    ├── ⚙️ 알고리즘 페이지   (7단계 수학적 파이프라인 설명)                │
│    └── ℹ️ 서비스 소개     (기술 스택 + 팀 정보)                          │
│                                                                         │
│  [Node.js 서버 — server.js, PORT 3000]                                  │
│    ├── POST /api/analyze          ← 이미지 10단계 분석 + GAN              │
│    ├── POST /api/visualize        ← 물리 맵 생성 (휘도/그라디언트/ELA/PRNU)│
│    ├── POST /api/crossverify      ← 17개 기관 실시간 교차검증             │
│    ├── POST /api/webverify        ← 팩트체크 DB 검색                     │
│    ├── POST /api/chat             ← 분석 기반 AI 채팅                    │
│    ├── GET  /api/report/:id       ← 보고서 조회                          │
│    ├── GET  /api/export/:id       ← 보고서 JSON 내보내기                 │
│    ├── GET  /api/gan-status       ← GAN 학습 상태                       │
│    ├── GET  /api/agencies         ← 팩트체크 기관 목록                   │
│    ├── GET  /api/ml/status        ← ML 엔진 상태 (proxy → Python:5001)   │
│    ├── GET  /api/ml/health        ← ML 헬스체크                          │
│    ├── GET  /api/ml/dataset/stats ← 데이터셋 통계                        │
│    ├── GET  /api/ml/labeled       ← 라벨링 목록                          │
│    ├── POST /api/ml/label_image   ← 이미지 업로드 + 라벨링               │
│    ├── POST /api/ml/label         ← 특성값으로 라벨링                    │
│    ├── POST /api/ml/train         ← 수동 학습 트리거                     │
│    ├── POST /api/ml/pipeline      ← 빅데이터 파이프라인 실행             │
│    ├── POST /api/ml/predict       ← ML 모델 예측                         │
│    └── WebSocket ws://            ← 실시간 이벤트 브로드캐스트            │
│                                                                         │
│  [Python ML 엔진 — ml_engine.py, PORT 5001]                             │
│    ├── 14개 물리 특성 추출 (PIL + NumPy)                                 │
│    ├── SGDClassifier 온라인 증분 학습                                     │
│    ├── StandardScaler 정규화                                             │
│    ├── 빅데이터 파이프라인 (Picsum Photos, simulated AI)                  │
│    └── 모델 영속화 (joblib)                                              │
│                                                                         │
│  [외부 데이터 소스]                                                       │
│    ├── RSS: Reuters, Snopes, FactCheck.org, Bellingcat, StopFake, Yonhap│
│    ├── GDELT API: 전지구 뉴스 실시간 검색                                │
│    ├── DuckDuckGo Instant API: 웹 검색                                   │
│    └── Wikipedia REST API: 개념 설명                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 데이터 수집·처리 흐름

```
[이미지 입력]
     │
     ▼
[Sharp 전처리]
  • 512×512 리사이즈 (비율 유지)
  • RAW RGB 픽셀 추출 (채널 3)
  • EXIF 메타데이터 파싱
     │
     ├──────────────────────────────────────────────┐
     │                                              │
     ▼                                              ▼
[물리 특성 분석 파이프라인]                    [ML 엔진 예측]
  STEP 1: EXIF·메타데이터 분석                  14개 특성 → SGD → P(AI)
  STEP 2: BT.709 휘도·히스토그램 χ²
  STEP 3: Sobel 그라디언트·공분산 행렬 C
  STEP 4: ELA (Error Level Analysis)
  STEP 5: DCT 주파수 스펙트럼
  STEP 6: PRNU 센서 노이즈 핑거프린트
  STEP 7: GAN 체커보드 아티팩트 탐지
  STEP 8: 확산 모델 텍스처 평탄화
  STEP 9: 채도 σ + 블록 주파수
  STEP 10: GAN 판별자 최종 복합 판정
     │
     ▼
[AI 확률 계산 + 판정]
  P(AI) = Σ(단계별 기여) + GAN 가중합
  CONFIRMED_AI  ≥ 75% | LIKELY_AI  ≥ 45%
  UNCERTAIN     ≥ 30% | LIKELY_REAL < 30%
     │
     ├───────────────────────┐
     │                       │
     ▼                       ▼
[이미지 시각화 맵]       [교차검증]
  • 원본 이미지            17개 기관 접속
  • 휘도 맵 (BT.709)       RSS 실시간 수집
  • Sobel 그라디언트 맵     GDELT 뉴스 검색
  • ELA 오류 레벨 맵        DuckDuckGo 검색
  • PRNU 센서 노이즈 맵     Wikipedia 참조
     │
     ▼
[보고서 생성 (JSON)]
  reportId = UUID v4
  uploads/<id>.json
  WebSocket 브로드캐스트
```

---

## 🔬 7단계 분석 알고리즘

### 핵심 개념
> **AI 생성 이미지 = 노이즈 기반 확률 합성** (GAN 역전파 또는 확산 모델 반복 노이즈 제거)  
> **실제 이미지 = 물리 법칙 기반 특성 보유** (빛·렌즈·센서·대기 등 자연 현상)

### STEP 1 — EXIF & 메타데이터 분석

```
탐지 항목: Software 필드, 13종 AI 도구 시그니처
AI 도구:   Stable Diffusion, Midjourney, DALL-E, ComfyUI, Adobe Firefly,
           Runway, Imagen, Kling, Flux, Pika, SeaArt, NightCafe, Leonardo

결과:
  실제 이미지: Make=Canon, Model=EOS R5, ISO=400, GPS 포함
  AI 이미지:   Software="Stable Diffusion", EXIF 없음, GPS 없음
```

### STEP 2 — BT.709 휘도 추출 (ITU-R BT.709-6)

```
공식: L(x,y) = 0.2126·R + 0.7152·G + 0.0722·B

지표:
  • 평균 휘도 (mean L)
  • 표준편차 σ(L)
  • 히스토그램 χ² 균일성 검정

임계값:
  σ(L) < 15  → AI 신호 (균일한 밝기)
  χ² > 8000  → HIGH (과도 평탄화)
  χ² < 5000  → LOW  (자연 분포)
```

### STEP 3 — Sobel 그라디언트 & 공분산 행렬

```
Sobel 연산자:
  Gx = [-1,0,+1; -2,0,+2; -1,0,+1] * I
  Gy = [-1,-2,-1; 0,0,0; +1,+2,+1] * I

공분산 행렬:
  M ∈ ℝ^(N×2)  (모든 픽셀의 Gx, Gy)
  C = (1/N) · MᵀM = [[C₀₀, C₀₁], [C₀₁, C₁₁]]

고유값 분해:
  λ₁ ≥ λ₂ (PCA 주성분)
  Trace(C) = λ₁ + λ₂  (총 그라디언트 에너지)
  이방성 = (λ₁ - λ₂) / λ₁  (방향성 강도)

임계값:
  Trace < 300 → HIGH (AI 등방성 노이즈)
  Trace > 800 → LOW  (강한 방향성 경계)
```

### STEP 4 — ELA (Error Level Analysis)

```
공식: ELA(x,y) = |I_orig(x,y) - I_75%(x,y)|

8×8 블록 단위 압축 오류 분포 분석

임계값:
  ELA mean < 1.0 → HIGH  (AI: 처음부터 렌더링, 재압축 흔적 없음)
  ELA mean < 1.5 → MEDIUM
  ELA mean > 1.5 → LOW   (실제: 카메라 → JPEG 인코딩 흔적)
```

### STEP 5 — DCT 주파수 스펙트럼

```
8×8 블록 DCT 분석:
  저주파  (DC + 저역)  = 윤곽·색상
  중주파  (중역)       = 질감·세부
  고주파  (고역)       = 엣지·미세 노이즈

AI 생성 패턴:
  확산 모델: 고주파 < 3%  (평탄화)
  실제 이미지: 고주파 > 6% (자연 노이즈)

임계값:
  highRatio < 0.03 → HIGH  (+12% AI 확률)
  highRatio < 0.06 → MEDIUM
```

### STEP 6 — PRNU 센서 노이즈

```
Wiener 필터 기반 노이즈 추출:
  Noise(x,y) = I(x,y) - μ_local(3×3)

분석 지표:
  • 분산 (카메라 센서 강도)
  • 첨도 kurtosis > 6 → 비정상
  • 공간 상관 corr(row_i, row_{i+1})

임계값:
  spatialCorr < 0.05 → HIGH (카메라 PRNU 없음)
  kurtosis > 6       → HIGH (비정상 노이즈 분포)
```

### STEP 7 — GAN 아티팩트 & 확산 모델

```
GAN 체커보드:
  주기적 패턴 비율 > 0.03 → 감지됨
  행 분산 variance < 0.5  → 의심

확산 모델:
  색상 다양성 score
  텍스처 분산 score
  → 둘 다 낮음 → CONFIRMED DIFFUSION
```

---

## ⚖️ 물리적 특성 vs AI 생성 패턴

| 특성 | 실제 이미지 | AI 생성 이미지 |
|------|------------|----------------|
| **EXIF 메타데이터** | 카메라 모델·GPS·셔터속도 존재 | 없음 또는 AI 소프트웨어명 |
| **BT.709 휘도 σ** | σ > 40 (다양한 밝기) | σ < 15 (균일 밝기) |
| **Sobel Trace(C)** | > 2000 (강한 엣지) | < 300 (약한 등방성) |
| **ELA 평균** | > 1.5 (압축 흔적) | ≈ 0 (최초 렌더링) |
| **DCT 고주파** | > 6% (자연 노이즈) | < 3% (확산 평탄화) |
| **PRNU 공간상관** | > 0.05 (센서 핑거프린트) | < 0.05 (없음) |
| **채도 σ** | > 0.20 (다채로운 색상) | < 0.05 (균일 채도) |
| **블록 불규칙성** | > 25 (자연 변동) | < 3 (GAN 패턴) |

---

## 🌐 교차검증 시스템 (17개 기관)

### 국제 IFCN 인증 기관
| 기관 | URL | 접근 방식 |
|------|-----|----------|
| Reuters Fact Check | https://www.reuters.com/fact-check/ | RSS 실시간 |
| AFP Fact Check | https://fact.afp.com/ | 참조 |
| Snopes | https://www.snopes.com/ | RSS 실시간 |
| FactCheck.org | https://www.factcheck.org/ | RSS 실시간 |
| Bellingcat OSINT | https://www.bellingcat.com/ | RSS 실시간 |
| StopFake | https://www.stopfake.org/en/tag/fake-photo/ | RSS 실시간 |
| MENA Fact Check | https://menafactcheck.com/ | 참조 |

### 국내 기관
| 기관 | URL | 비고 |
|------|-----|------|
| 연합뉴스 팩트체크 | https://www.yna.co.kr/factcheck | RSS 실시간 |
| SBS 팩트체크 | https://news.sbs.co.kr/news/newsMain.do?plink=FACTCHECK | 참조 |
| KISA 한국인터넷진흥원 | https://www.kisa.or.kr/1060 | AI 딥페이크 가이드라인 |
| 경찰청 사이버수사대 | https://cyberbureau.police.go.kr/ | 딥페이크 신고 182 |

### 연구·표준·기술 기관
| 기관 | URL | 비고 |
|------|-----|------|
| MIT Media Lab Detect | https://detect.mit.edu/ | 얼굴 딥페이크 전용 |
| NIST AI RMF | https://www.nist.gov/artificial-intelligence | RSS 실시간 |
| Google DeepMind SynthID | https://deepmind.google/technologies/synthid/ | 워터마크 |
| C2PA 콘텐츠 인증 연합 | https://c2pa.org/ | 콘텐츠 자격증명 |
| GDELT 글로벌 뉴스 DB | https://gdeltproject.org/ | 실시간 뉴스 API |
| Wikipedia/Wikidata | https://en.wikipedia.org/ | REST API |

### 교차검증 점수 계산
```
finalAIProb = baseAIProb
  + (metatdataConfirmed ? +15 : 0)
  + (gdeltArticles > 3 ? +5 : 0)

신뢰도:
  liveSourcesChecked ≥ 4 → HIGH
  liveSourcesChecked ≥ 2 → MEDIUM
  otherwise              → LOW
```

---

## 🤖 빅데이터 + 실시간 학습

### ML 엔진 구조 (ml_engine.py)

```
[빅데이터 파이프라인]
  실제 이미지: Picsum Photos (https://picsum.photos/)
  AI 이미지:   시뮬레이션 생성 (균일 노이즈 패턴)
     │
     ▼
[14개 물리 특성 추출]
  lum_mean, lum_std, hist_entropy,
  sobel_mean, sobel_std, high_freq_ratio,
  ela_mean, ela_max,
  dct_low, dct_mid, dct_high,
  prnu_variance, prnu_kurtosis, prnu_spatial_corr

     │
     ▼
[StandardScaler 정규화]
  z = (x - μ) / σ  (온라인 증분 업데이트)

     │
     ▼
[SGDClassifier (log_loss)]
  partial_fit(X, y, classes=['real','ai_generated'])
  compute_class_weight('balanced') 로 클래스 불균형 처리

     │
     ▼
[모델 영속화]
  ml_models/model.pkl  (joblib)
  ml_data/labeled_db.json (라벨링 DB)
```

### 실시간 라벨링 API

```
POST /api/ml/label_image
  body: FormData { image: File, label: "real"|"ai_generated", source: str }
  → 특성 추출 → 라벨 저장 → 즉시 partial_fit (최근 10개)

POST /api/ml/label
  body: { sample_id: str, label: str, features: [] }
  → 라벨만 저장 → 5개마다 자동 배치 학습

POST /api/ml/train
  → 전체 라벨 데이터로 재학습

POST /api/ml/pipeline
  body: { real_count: int, ai_count: int, auto_train: bool }
  → 빅데이터 수집 → 특성 추출 → 라벨링 → 학습
```

---

## 📡 API 레퍼런스

### 이미지 분석

```
POST /api/analyze
Content-Type: multipart/form-data
body: { image: File }

Response: {
  success: true,
  reportId: "uuid-v4",
  analysis: {
    dimensions: { width, height, format, analyzed },
    luminance:  { mean, std, histChi2 },
    covariance: { trace, c00, c11, c01, anisotropy, lambda1, lambda2 },
    ela:        { mean, max },
    dct:        { lowRatio, midRatio, highRatio },
    prnu:       { variance, kurtosis, spatialCorr },
    saturation: { mean, std },
    blockFreq:  <number>,
    ganArtifacts: { isCheckerboard, periodicRatio, rowVariance },
    diffusion:  { colorDiversity, isLowColorDiversity, isUniformTexture },
    aiMetaSigs: { isConfirmedAI, detected: [{ tool, signature }] },
    ganLearning: { roundsCompleted, accuracy, learningRate, weights },
    steps:      [{ step, name, aiSignal, details, formula, methodology }],
    scores: {
      aiProbability, ganProbability, confidence,
      verdict: "CONFIRMED_AI"|"LIKELY_AI"|"UNCERTAIN"|"LIKELY_REAL",
      verdictLabel, totalIndicators, metadataConfirmed, reasons
    }
  },
  externalChecks: [{ service, url, description, instruction, note }]
}
```

### 이미지 시각화

```
POST /api/visualize
Content-Type: multipart/form-data
body: { image: File }

Response: {
  success: true,
  width: 400, height: 300,
  maps: {
    luminance: "data:image/png;base64,...",  // BT.709 휘도 그레이스케일
    gradient:  "data:image/png;base64,...",  // Sobel 히트맵 (빨강=강, 파랑=약)
    ela:       "data:image/png;base64,...",  // ELA 오렌지 히트맵
    prnu:      "data:image/png;base64,..."   // PRNU 보라색 노이즈 맵
  }
}
```

### 교차검증

```
POST /api/crossverify
Content-Type: application/json
body: { reportId?: string, query?: string }

Response: {
  success: true,
  result: {
    timestamp, query,
    agencies: [{ id, name, url, type, region, status, liveItems, relevance }],
    liveData: {
      gdelt: [{ title, url, snippet, source }],
      duckduckgo: [{ title, url, snippet }],
      wikipedia: { title, snippet, url }
    },
    crossScore: {
      finalAIProb, liveSourcesChecked, totalAgencies,
      gdeltArticles, verdict, confidence
    }
  }
}
```

---

## 🚀 설치 및 실행

### 요구사항
- Node.js ≥ 18
- Python ≥ 3.10
- pip packages: flask, flask-cors, scikit-learn, Pillow, numpy, requests, joblib

### 설치

```bash
# Node.js 의존성
npm install

# Python 의존성
pip install flask flask-cors scikit-learn pillow numpy requests joblib
```

### 실행

```bash
# 서버 시작 (Node.js + Python ML 엔진 자동 실행)
node server.js

# 접속
http://localhost:3000
```

### 환경 변수

```bash
PORT=3000          # Node.js 서버 포트 (기본: 3000)
ML_ENGINE_URL=http://localhost:5001  # Python ML 엔진 URL
ML_PORT=5001       # Python ML 엔진 포트
```

---

## 📁 프로젝트 구조

```
webapp/
├── server.js              # 메인 서버 (Node.js + Express + WebSocket)
├── ml_engine.py           # ML 학습 엔진 (Python + Flask + scikit-learn)
├── package.json           # Node.js 의존성
├── public/
│   ├── index.html         # 싱글페이지 앱 (6개 페이지)
│   ├── css/style.css      # 전체 스타일시트
│   └── js/app.js          # 프론트엔드 로직
├── uploads/               # 임시 업로드 + 분석 보고서 (JSON)
├── ml_data/
│   ├── labeled_db.json    # 라벨링 데이터베이스
│   └── datasets/          # 수집된 이미지 캐시
├── ml_models/
│   └── model.pkl          # 훈련된 SGD 모델 (joblib)
└── README.md              # 이 문서
```

---

## 📚 참고 문헌

- ITU-R BT.709-6 (2015) — *Parameter values for the HDTV standards*
- Fridrich, J. (2009) — *Steganography in Digital Media: Principles, Algorithms, and Applications*
- Wang, S.Y. et al. (2020) — *CNN-generated images are surprisingly easy to spot...* (CVPR 2020)
- Corvi, R. et al. (2023) — *Intriguing properties of synthetic images: from GAN to diffusion models* (CVPR 2023)
- Gragnaniello, D. et al. (2022) — *Are GAN generated images easy to detect?*
- Goodfellow, I. et al. (2014) — *Generative Adversarial Networks* (NeurIPS 2014)
- Ricker, J. et al. (2022) — *Towards the detection of diffusion model deepfakes*

---

## 🔒 법적 고지

본 플랫폼은 교육·연구 목적으로 개발되었으며, 허위정보 확산 방지를 위한 공익적 도구입니다.  
딥페이크 관련 신고: **경찰청 사이버수사대 182** / **KISA 불법스팸대응센터 118**

---

*Fact Maze v7 — Built with ❤️ for truth and media integrity*
