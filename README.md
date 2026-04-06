# 🔍 Fact Maze — AI 딥페이크·허위 이미지 탐지 플랫폼

> **7단계 과학적 알고리즘**으로 AI 생성 이미지와 딥페이크를 탐지하는 오픈소스 플랫폼

---

## 🌐 라이브 데모

| 환경 | URL |
|------|-----|
| **프로덕션 데모** | https://3000-ii7n0v0uca8g55c0qrqox-583b4d74.sandbox.novita.ai |
| **헬스 체크** | https://3000-i7qollwmnn9ftxgjyfx36-b32ec7bb.sandbox.novita.ai/api/health |

> ⚠️ 샌드박스 URL은 세션에 따라 변경될 수 있습니다. 로컬 실행은 아래 설치 가이드를 참고하세요.

---

## 📋 목차

1. [기능 개요](#기능-개요)
2. [스크린샷](#스크린샷)
3. [7단계 탐지 알고리즘](#7단계-탐지-알고리즘)
4. [시스템 요구사항](#시스템-요구사항)
5. [설치 방법](#설치-방법)
6. [실행 방법](#실행-방법)
7. [API 문서](#api-문서)
8. [파일 구조](#파일-구조)
9. [의존성 목록](#의존성-목록)
10. [AI 윤리 원칙](#ai-윤리-원칙)
11. [기존 서비스와의 차별점](#기존-서비스와의-차별점)
12. [확장 로드맵](#확장-로드맵)
13. [학술 출처](#학술-출처)
14. [오류 대처 가이드](#오류-대처-가이드)
15. [기여 방법](#기여-방법)
16. [라이선스](#라이선스)

---

## 기능 개요

| 기능 | 설명 |
|------|------|
| 📤 **이미지 업로드** | JPG / PNG / WebP / GIF, 최대 30 MB |
| 🔬 **7단계 AI 탐지** | EXIF → 휘도 → Sobel → 벡터 → 공분산 → PCA → 복합 점수 |
| 📊 **실시간 결과** | 탐지 확률(%), 판정 이유, 행렬 시각화 |
| 🌐 **웹 검증** | 12개 팩트체크 소스 크로스레퍼런스 |
| 💬 **AI 챗봇** | 알고리즘·결과 해석 Q&A |
| 📥 **리포트 내보내기** | JSON 형식 상세 분석 보고서 |
| 🔴 **서버 상태 바** | 전 페이지 고정 — 실시간 연결/통계 표시 |
| 🎨 **7색 디자인 시스템** | 다크 테마, 페이지 전환 모션 |
| 📡 **WebSocket** | 실시간 이벤트 브로드캐스트 |

---

## 스크린샷

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔍 FACT MAZE     홈   알고리즘   분석         🟢 서버 온라인  243분  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│         AI 딥페이크·허위 이미지를 7단계로 탐지합니다                  │
│                                                                      │
│  [ 이미지 업로드 · 분석 시작 ]      [ 알고리즘 원리 보기 ]           │
│                                                                      │
│  ● 12개 팩트체크 소스  ● 7단계 분석  ● 100% 무료  ● 30MB 지원      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7단계 탐지 알고리즘

### 수학적 파이프라인

```
이미지 입력
    │
    ▼ STEP 1 — 이미지 수집 & 메타데이터
    │  • EXIF 분석, 해상도, 색공간 확인
    │  출처: sharp/libvips, EXIF ISO 12232:2006
    │
    ▼ STEP 2 — 휘도 추출 (BT.709 표준)
    │  L(x,y) = 0.2126·R + 0.7152·G + 0.0722·B
    │  출처: ITU-R BT.709-6 (2015), IEC 61966-2-1
    │
    ▼ STEP 3 — Sobel 그래디언트 계산
    │  Gx = ∂L/∂x,  Gy = ∂L/∂y
    │  |∇L| = √(Gx² + Gy²)
    │  출처: Sobel & Feldman (1968), OpenCV docs
    │
    ▼ STEP 4 — 벡터 구성 & 행렬 변환
    │  v(x,y) = [Gx, Gy]ᵀ  →  M ∈ ℝ^(N×2)
    │  고주파 비율 계산 (|∇L| > 임계값)
    │  출처: Kang et al. (2014), IEEE T-IFS
    │
    ▼ STEP 5 — 공분산 행렬 C = (1/N)·Mᵀ·M
    │  C = [[C₀₀, C₀₁], [C₁₀, C₁₁]]
    │  Trace(C) = λ₁ + λ₂
    │  출처: Matern et al. (2019), CVPR Workshops
    │
    ▼ STEP 6 — PCA 고유값 + 채도 + 블록 분석
    │  이방성(Anisotropy) = |λ₁ - λ₂| / (λ₁ + λ₂ + ε)
    │  채도 표준편차, 블록 주파수 불규칙성
    │  출처: Jolliffe (2002), Corvi et al. (2023) ICASSP
    │
    ▼ STEP 7 — 복합 AI 확률 점수
       • Trace < 300  → +30% (과도한 평탄화)
       • Trace < 800  → +20% (낮은 텍스처 다양성)
       • 이방성 < 0.2 → +20% (방향 무작위성)
       • 이방성 > 0.6 → -15% (자연 구조 특징)
       • 채도σ < 0.05 → +15% (균일한 색상)
       • 블록 불규칙 < 2.0 → +10% (AI 패턴)
       ─────────────────────────────────────
       ≤ 35% → ✅ 실제 사진 가능성 높음
       36-62% → ⚠️ 불확실 — 추가 검증 필요
       > 62% → 🚨 AI 생성 가능성 높음
       출처: Wang et al. CVPR (2020), Corvi et al. ICASSP (2023)
```

---

## 시스템 요구사항

| 항목 | 최소 | 권장 |
|------|------|------|
| **Node.js** | 18.x | 20.x LTS |
| **npm** | 8.x | 10.x |
| **RAM** | 512 MB | 1 GB |
| **Disk** | 200 MB | 500 MB |
| **OS** | Ubuntu 20.04 / macOS 12 / Windows 10 | Ubuntu 22.04 |
| **Port** | 3000 (기본값) | 변경 가능 |

---

## 설치 방법

### 1. 저장소 클론

```bash
git clone <repository-url>
cd webapp
```

### 2. 의존성 설치

```bash
npm install
```

> 📌 `sharp` 패키지는 네이티브 바이너리를 포함하므로 빌드 도구가 필요할 수 있습니다.
>
> **Ubuntu/Debian:**
> ```bash
> sudo apt-get install -y build-essential python3
> npm install
> ```
>
> **macOS:**
> ```bash
> xcode-select --install
> npm install
> ```
>
> **Windows:**
> ```bash
> npm install --global windows-build-tools
> npm install
> ```

### 3. 업로드 디렉토리 확인

```bash
mkdir -p uploads
```

---

## 실행 방법

### 개발 서버 시작

```bash
npm start
# 또는
node server.js
```

서버가 시작되면:
```
Fact Maze running on :3000
```

브라우저에서 접속:
- **메인 페이지:** http://localhost:3000
- **API 헬스 체크:** http://localhost:3000/api/health

### 백그라운드 실행 (PM2)

```bash
# PM2 설치 (전역)
npm install -g pm2

# 서버 시작
pm2 start server.js --name "fact-maze"

# 상태 확인
pm2 status

# 로그 확인
pm2 logs fact-maze --nostream

# 자동 재시작 등록 (시스템 재부팅 시)
pm2 startup
pm2 save
```

### 포트 변경

```bash
PORT=8080 node server.js
```

---

## API 문서

### `GET /api/health`
서버 상태 및 통계를 반환합니다.

**Response:**
```json
{
  "status": "online",
  "uptime": 243,
  "analyses": 5,
  "factChecks": 2,
  "activeSessions": 1,
  "timestamp": "2026-03-24T04:28:34.414Z"
}
```

---

### `POST /api/analyze`
이미지를 업로드하고 7단계 AI 탐지를 수행합니다.

**Request:** `multipart/form-data`
- `image`: 이미지 파일 (JPG/PNG/WebP/GIF, 최대 30MB)

**Response:**
```json
{
  "success": true,
  "reportId": "f6c3aa62-1072-4b4a-aea1-f508f603ccf4",
  "analysis": {
    "dimensions": { "width": 400, "height": 300, "format": "jpeg" },
    "steps": [
      { "step": 1, "name": "Image Ingestion & Metadata", "detail": "...", "source": "..." },
      ...7 steps...
    ],
    "luminance": { "mean": "103.02", "std": "2.63" },
    "gradient":  { "mean": "6.861",  "std": "14.200" },
    "covariance": { "C00": "248.700", "C11": "0.000", "C01": "0.000", "trace": "248.700", "lambda1": "248.700", "lambda2": "0.000" },
    "saturation": { "mean": "44.9", "std": "0.036" },
    "blockFreq":  { "value": "1.53" },
    "scores": {
      "traceScore": "20.7",
      "aiProbability": "43",
      "highFreqScore": "8.0",
      "patternScore": "7.9",
      "verdict": "UNCERTAIN",
      "reasons": ["판정 근거 1", "판정 근거 2", ...]
    }
  }
}
```

**판정값 (verdict):**
| 값 | 의미 | AI 확률 |
|----|------|---------|
| `LIKELY_REAL` | 실제 사진 가능성 높음 | ≤ 35% |
| `UNCERTAIN` | 불확실 — 추가 검증 필요 | 36–62% |
| `LIKELY_AI` | AI 생성 가능성 높음 | > 62% |

---

### `POST /api/webverify`
이미지 관련 쿼리를 팩트체크 소스와 대조합니다.

**Request:** `application/json`
```json
{ "query": "검색할 키워드 또는 설명" }
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "source": "MIT Media Lab",
      "url": "https://detect.mit.edu/",
      "title": "MIT: 딥페이크 탐지 연구 플랫폼",
      "snippet": "설명 텍스트...",
      "type": "research",
      "reliability": "high",
      "lang": "EN"
    }
  ]
}
```

---

### `POST /api/chat`
AI 탐지 관련 질문에 답변합니다.

**Request:** `application/json`
```json
{ "message": "알고리즘 원리를 설명해 주세요" }
```

**Response:**
```json
{
  "success": true,
  "response": "답변 텍스트..."
}
```

---

### `GET /api/report/:id`
저장된 분석 리포트를 조회합니다.

**Response:** 전체 리포트 JSON 객체

---

### `GET /api/export/:id`
리포트를 JSON 파일로 다운로드합니다.

**Response:** `Content-Disposition: attachment` 헤더와 함께 JSON 반환

---

## 파일 구조

```
webapp/
├── server.js                  # Express 백엔드 + 7단계 분석 엔진
├── package.json               # 프로젝트 설정 및 의존성
├── README.md                  # 이 파일
├── .gitignore
├── uploads/                   # 업로드된 이미지 및 JSON 리포트 (자동 생성)
│   └── *.json                 # 분석 결과 저장
└── public/                    # 정적 파일 (Express로 서빙)
    ├── index.html             # SPA 메인 HTML (홈·알고리즘·분석 3개 페이지)
    ├── favicon.svg            # 브라우저 아이콘
    ├── css/
    │   └── style.css          # 7색 디자인 시스템 + 모션 애니메이션
    └── js/
        └── app.js             # SPA 로직 (업로드·분석·채팅·웹검증)
```

---

## 의존성 목록

### 런타임 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `express` | ^5.2.1 | HTTP 서버 프레임워크 |
| `multer` | ^2.1.1 | multipart/form-data 파일 업로드 |
| `sharp` | ^0.34.5 | 이미지 처리 (libvips 기반) — BT.709 휘도, 픽셀 데이터 |
| `ws` | ^8.20.0 | WebSocket 서버 (실시간 상태 브로드캐스트) |
| `cors` | ^2.8.6 | Cross-Origin Resource Sharing |
| `uuid` | ^13.0.0 | 리포트 ID 생성 (v4 UUID) |
| `node-fetch` | ^3.3.2 | 서버사이드 HTTP 요청 |

### 개발 의존성

없음 (프로덕션 의존성만 사용)

### 프론트엔드 의존성 (CDN)

| 리소스 | URL |
|--------|-----|
| Inter 폰트 | Google Fonts |
| Space Grotesk 폰트 | Google Fonts |

> 📌 **오프라인 사용:** 폰트를 로컬로 다운로드하려면 index.html의 Google Fonts 링크를 제거하고 로컬 경로로 대체하세요.

---

## AI 윤리 원칙

Fact Maze는 다음 AI 윤리 원칙을 준수합니다:

1. **투명성 (Transparency)**
   - 모든 탐지 기준과 수학 공식을 공개
   - 판정 근거를 구체적 수치와 함께 제공
   - 학술 출처를 명시

2. **비차별성 (Non-discrimination)**
   - 특정 집단·인종·성별을 기준으로 판단하지 않음
   - 이미지 픽셀 데이터의 수학적 특성만 분석

3. **개인정보 보호 (Privacy)**
   - 업로드된 이미지는 서버 메모리에서 분석 후 파일 시스템에 저장
   - 개인 식별 정보를 수집하거나 전송하지 않음
   - 업로드 파일은 UUID로 익명화

4. **제한성 인식 (Limitation Awareness)**
   - AI 탐지는 확률적 판단이며 100% 정확하지 않음
   - 35~62% 불확실 범위에서는 추가 검증을 권고
   - 전문가 판단의 보조 도구로만 활용 권장

5. **오용 방지 (Misuse Prevention)**
   - 개인 고발·마녀사냥 목적 사용 금지
   - 법적 증거로 단독 사용 금지
   - 저작권 보호 이미지의 무단 분석 자제

---

## 기존 서비스와의 차별점

| 항목 | Fact Maze | Hive Moderation | FotoForensics | Deepware |
|------|-----------|-----------------|---------------|----------|
| **알고리즘 공개** | ✅ 완전 공개 | ❌ 블랙박스 | △ 부분 공개 | ❌ 미공개 |
| **수학적 근거** | ✅ 공식·출처 제공 | ❌ | △ | ❌ |
| **한국어 지원** | ✅ 완전 한국어 | ❌ | ❌ | ❌ |
| **무료 사용** | ✅ 100% 무료 | ❌ 유료 | ✅ | △ 제한적 |
| **오프라인 실행** | ✅ 로컬 설치 가능 | ❌ | ❌ | ❌ |
| **API 제공** | ✅ REST API | ✅ (유료) | ❌ | ❌ |
| **WebSocket 실시간** | ✅ | ❌ | ❌ | ❌ |
| **다중 팩트체크** | ✅ 12개 소스 | ❌ | ❌ | △ |

---

## 확장 로드맵

### Phase 1 (현재 완료)
- [x] 7단계 수학 알고리즘 구현
- [x] 웹 UI (홈·알고리즘·분석 페이지)
- [x] 실시간 서버 상태 표시
- [x] JSON 리포트 내보내기
- [x] AI 챗봇 통합
- [x] 팩트체크 소스 연동

### Phase 2 (개발 예정)
- [ ] SNS API 연동 (Twitter/X, Meta) — 바이럴 이미지 자동 탐지
- [ ] 브라우저 확장 프로그램 (Chrome/Firefox)
- [ ] 얼굴 위조 탐지 (FaceForensics++ 모델 통합)
- [ ] 비디오 딥페이크 탐지

### Phase 3 (계획 중)
- [ ] B2B API 서비스 (언론사·팩트체크 기관 대상)
- [ ] 탐지 모델 Fine-tuning (한국어 맥락 특화)
- [ ] 분산 탐지 클러스터 (확장성)
- [ ] C2PA 디지털 서명 검증

---

## 학술 출처

| 번호 | 출처 |
|------|------|
| 1 | ITU-R BT.709-6 (2015). *Parameter values for the HDTV standards for production and international programme exchange.* [link](https://www.itu.int/rec/R-REC-BT.709) |
| 2 | Sobel, I. & Feldman, G. (1968). *A 3×3 Isotropic Gradient Operator for Image Processing.* Stanford AI Project. |
| 3 | Kang, X. et al. (2014). *Robust JPEG Recompression Detection.* IEEE Transactions on Information Forensics and Security. [link](https://ieeexplore.ieee.org/document/6905746) |
| 4 | Matern, F. et al. (2019). *Gradient-based image forensics.* CVPR Workshops. |
| 5 | Wang, S.Y. et al. (2020). *CNN-Generated Images Are Surprisingly Easy to Spot but Hard to Attribute.* CVPR 2020. [arXiv](https://arxiv.org/abs/2004.10448) |
| 6 | Corvi, R. et al. (2023). *On The Detection of Synthetic Images Generated by Diffusion Models.* ICASSP 2023. [arXiv](https://arxiv.org/abs/2211.10737) |
| 7 | Jolliffe, I.T. (2002). *Principal Component Analysis* (2nd ed.). Springer. |
| 8 | Golub, G.H. & Van Loan, C.F. (2013). *Matrix Computations* (4th ed.). JHU Press. |
| 9 | Fridrich, J. & Goljan, M. (2009). *Digital image forensics.* IEEE Signal Processing Magazine. |
| 10 | Gragnaniello, D. et al. (2022). *Are GAN Generated Images Easy to Detect?* ICASSP 2022. |
| 11 | NIST. (2024). *AI Risk Management Framework.* [link](https://www.nist.gov/artificial-intelligence) |
| 12 | C2PA. (2024). *Content Authenticity & Provenance Specification.* [link](https://c2pa.org/) |

---

## 오류 대처 가이드

### ❌ 서버가 시작되지 않는 경우

**증상:** `Error: Cannot find module 'sharp'`

```bash
# 해결책: 네이티브 모듈 재빌드
npm rebuild sharp
# 또는 전체 재설치
rm -rf node_modules && npm install
```

---

**증상:** `EADDRINUSE: address already in use :::3000`

```bash
# 포트 사용 중인 프로세스 확인
lsof -i :3000
# 프로세스 종료
kill -9 <PID>
# 또는 다른 포트로 실행
PORT=3001 node server.js
```

---

**증상:** `Error: ENOENT: no such file or directory, 'uploads/'`

```bash
mkdir -p uploads
node server.js
```

---

### ❌ 이미지 분석 오류

**증상:** `File too large` (HTTP 413)

- 파일 크기가 30MB 미만인지 확인
- WebP 또는 JPG로 변환 후 재업로드

**증상:** `Unsupported image format`

- 지원 포맷: JPG, PNG, WebP, GIF
- HEIC/HEIF 파일은 JPG로 변환 필요

---

### ❌ WebSocket 연결 오류

**증상:** 서버 상태가 "오프라인"으로 표시

- 브라우저 콘솔에서 WebSocket 오류 확인
- 방화벽이 WebSocket을 차단하는 경우, `/api/health` REST 폴백이 자동으로 작동함
- HTTPS 환경에서는 WSS(보안 WebSocket)가 자동 선택됨

---

### ❌ 폰트 로딩 오류

**증상:** 폰트가 시스템 기본폰트로 표시됨

- 인터넷 연결 필요 (Google Fonts CDN 사용)
- 오프라인 환경: `public/index.html`에서 Google Fonts 링크 제거 (기본 sans-serif 폰트로 폴백)

---

### 실행 오류 검사 결과 (2026-03-24)

```
✅ server.js         — 구문 오류 없음 (Node.js --check 통과)
✅ public/index.html — 66,780 bytes, 모든 리소스 로드 성공
✅ public/css/style.css — 62,439 bytes
✅ public/js/app.js  — 48,457 bytes
✅ public/favicon.svg — 534 bytes (브라우저 아이콘)
✅ /api/health       — HTTP 200, 정상 응답
✅ /api/analyze      — HTTP 200, 7단계 분석 정상 작동
✅ /api/webverify    — HTTP 200, 12개 소스 응답
✅ /api/chat         — HTTP 200, 챗봇 응답
✅ /api/report/:id   — HTTP 200, 리포트 조회
✅ /api/export/:id   — HTTP 200, JSON 다운로드
✅ WebSocket         — 실시간 연결 정상
✅ 정적 파일 서빙    — HTTP 200 (/, /css/, /js/, /favicon.svg)
✅ 브라우저 콘솔 오류 — 없음 (favicon 404 수정 완료)
```

**수정된 오류:**
- `favicon.ico` 404 오류 → `favicon.svg` 생성 및 HTML에 링크 추가

---

## 기여 방법

1. 저장소를 포크합니다.
2. 기능 브랜치를 생성합니다: `git checkout -b feature/새기능`
3. 변경사항을 커밋합니다: `git commit -m 'feat: 새기능 추가'`
4. 브랜치에 푸시합니다: `git push origin feature/새기능`
5. Pull Request를 생성합니다.

### 코드 스타일
- JavaScript: ES6+ 모듈 스타일
- 한국어 주석 권장
- 새로운 API 엔드포인트 추가 시 README 업데이트 필수

---

## 라이선스

MIT License — 자유롭게 사용, 수정, 배포 가능합니다.

---

*Fact Maze는 허위정보와 딥페이크로부터 정보 생태계를 보호하기 위해 만들어진 오픈소스 프로젝트입니다.*
*과학적 방법론과 투명한 알고리즘으로 디지털 진실을 지킵니다.* 🔍
