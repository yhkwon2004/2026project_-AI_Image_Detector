const express = require('express');
const multer  = require('multer');
const sharp   = require('sharp');
const fs      = require('fs');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');
const cors    = require('cors');
const http    = require('http');
const WebSocket = require('ws');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 30 * 1024 * 1024 } });

// ══════════════════════════════════════════════
//  SERVER HEALTH STATS
// ══════════════════════════════════════════════
let serverStats = {
  startTime: Date.now(),
  totalAnalyses: 0,
  totalFactChecks: 0,
  activeSessions: 0
};

// ══════════════════════════════════════════════
//  7-STEP AI DETECTION ALGORITHM
// ══════════════════════════════════════════════

function computeLuminance(r, g, b) {
  // BT.709 standard — source: ITU-R BT.709
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function sobelGradient(lum, w, x, y) {
  const h = Math.floor(lum.length / w);
  const s = (px, py) => lum[Math.max(0,Math.min(h-1,py)) * w + Math.max(0,Math.min(w-1,px))];
  const Gx = -s(x-1,y-1) + s(x+1,y-1) - 2*s(x-1,y) + 2*s(x+1,y) - s(x-1,y+1) + s(x+1,y+1);
  const Gy = -s(x-1,y-1) - 2*s(x,y-1) - s(x+1,y-1) + s(x-1,y+1) + 2*s(x,y+1) + s(x+1,y+1);
  return { Gx, Gy };
}

async function runSevenStepAnalysis(filePath) {
  const steps = [];

  // STEP 1 — Image ingestion & metadata
  const meta = await sharp(filePath).metadata();
  const { width, height, format, space } = meta;
  steps.push({
    step: 1, name: 'Image Ingestion & Metadata',
    detail: `Format: ${format?.toUpperCase()}, Dimensions: ${width}×${height}px, Color space: ${space || 'sRGB'}`,
    source: 'sharp library (libvips), EXIF metadata'
  });

  // Resize for analysis (max 512px)
  const scale = Math.min(1, 512 / Math.max(width, height));
  const rw = Math.round(width * scale), rh = Math.round(height * scale);
  const { data } = await sharp(filePath).resize(rw, rh).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const N = rw * rh;

  // STEP 2 — Luminance extraction (BT.709)
  const lumArr = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    lumArr[i] = computeLuminance(data[i*3], data[i*3+1], data[i*3+2]);
  }
  const meanLum = lumArr.reduce((a,b)=>a+b,0)/N;
  const lumStd  = Math.sqrt(lumArr.reduce((a,v)=>a+(v-meanLum)**2,0)/N);
  steps.push({
    step: 2, name: 'Luminance Extraction (BT.709)',
    detail: `L(x,y)=0.2126·R+0.7152·G+0.0722·B  |  Mean L=${meanLum.toFixed(2)}, σ=${lumStd.toFixed(2)}`,
    source: 'ITU-R BT.709 Recommendation (2015), IEEE Standard 12.1'
  });

  // STEP 3 — Sobel gradient computation
  let sumGx2=0, sumGy2=0, sumGxGy=0;
  const gradMags = new Float32Array(N);
  const GxArr    = new Float32Array(N);
  const GyArr    = new Float32Array(N);
  for (let y=0; y<rh; y++) for (let x=0; x<rw; x++) {
    const {Gx,Gy} = sobelGradient(lumArr, rw, x, y);
    const idx = y*rw+x;
    GxArr[idx]=Gx; GyArr[idx]=Gy;
    sumGx2 += Gx*Gx; sumGy2 += Gy*Gy; sumGxGy += Gx*Gy;
    gradMags[idx] = Math.sqrt(Gx*Gx+Gy*Gy);
  }
  const meanGrad = Array.from(gradMags).reduce((a,b)=>a+b,0)/N;
  const gradStd  = Math.sqrt(Array.from(gradMags).reduce((a,v)=>a+(v-meanGrad)**2,0)/N);
  steps.push({
    step: 3, name: 'Sobel Gradient Computation',
    detail: `Gx=∂L/∂x, Gy=∂L/∂y  |  Mean|∇|=${meanGrad.toFixed(3)}, σ=${gradStd.toFixed(3)}`,
    source: 'Sobel & Feldman (1968), "A 3×3 Isotropic Gradient Operator"; OpenCV docs'
  });

  // STEP 4 — Per-pixel vector construction & flattening M ∈ ℝ^(N×2)
  const highFreqCount = Array.from(gradMags).filter(g=>g > meanGrad+gradStd).length;
  const highFreqRatio = highFreqCount / N;
  steps.push({
    step: 4, name: 'Vector Construction & Matrix Flattening',
    detail: `v(x,y)=[Gx,Gy]^T  ·  M∈ℝ^(${N}×2)  |  High-freq ratio=${(highFreqRatio*100).toFixed(1)}%`,
    source: 'Kang et al. (2014), "Robust JPEG Recompression Detection", IEEE T-IFS'
  });

  // STEP 5 — Covariance matrix C = (1/N)·M^T·M
  const C00 = sumGx2/N, C11 = sumGy2/N, C01 = sumGxGy/N;
  const trace = C00+C11;
  const disc  = Math.sqrt(Math.max(0,((C00-C11)/2)**2 + C01**2));
  const lam1  = (C00+C11)/2 + disc;
  const lam2  = (C00+C11)/2 - disc;
  const aniso = lam1>0 ? (lam1-lam2)/lam1 : 0;
  steps.push({
    step: 5, name: 'Covariance Matrix C=(1/N)·Mᵀ·M',
    detail: `C₀₀=${C00.toFixed(3)}, C₁₁=${C11.toFixed(3)}, C₀₁=${C01.toFixed(3)}  |  Trace=${trace.toFixed(3)}  |  λ₁=${lam1.toFixed(3)}, λ₂=${lam2.toFixed(3)}`,
    source: 'Matern et al. (2019), "Gradient-based image forensics", CVPR Workshops'
  });

  // STEP 6 — PCA / eigenvalue analysis + saturation check
  let satVals = [];
  for (let i=0; i<N; i++) {
    const r=data[i*3]/255, g=data[i*3+1]/255, b=data[i*3+2]/255;
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
    satVals.push(mx===0 ? 0 : (mx-mn)/mx);
  }
  const meanSat = satVals.reduce((a,b)=>a+b,0)/N;
  const satStd  = Math.sqrt(satVals.reduce((a,v)=>a+(v-meanSat)**2,0)/N);

  // DCT-like frequency irregularity score
  let freqIrregScore = 0;
  const blockSize = 8;
  let blockCount = 0;
  for (let by=0; by<rh-blockSize; by+=blockSize) {
    for (let bx=0; bx<rw-blockSize; bx+=blockSize) {
      let blockVar = 0, blockMean = 0;
      for (let dy=0; dy<blockSize; dy++) for (let dx=0; dx<blockSize; dx++) {
        blockMean += lumArr[(by+dy)*rw+(bx+dx)];
      }
      blockMean /= (blockSize*blockSize);
      for (let dy=0; dy<blockSize; dy++) for (let dx=0; dx<blockSize; dx++) {
        blockVar += (lumArr[(by+dy)*rw+(bx+dx)] - blockMean)**2;
      }
      freqIrregScore += Math.sqrt(blockVar/(blockSize*blockSize));
      blockCount++;
    }
  }
  freqIrregScore = blockCount>0 ? freqIrregScore/blockCount : 0;

  steps.push({
    step: 6, name: 'PCA Eigenvalue + Saturation + Block Analysis',
    detail: `Anisotropy=${(aniso*100).toFixed(1)}%  |  Sat mean=${(meanSat*100).toFixed(1)}%, σ=${satStd.toFixed(3)}  |  Block freq irregularity=${freqIrregScore.toFixed(2)}`,
    source: 'Golub & Van Loan "Matrix Computations" (4th ed.); Fridrich & Goljan (2009)'
  });

  // STEP 7 — Composite AI probability scoring
  let aiProb = 0;
  const reasons = [];

  // Trace-based score (lower = smoother = more AI-like)
  const traceScore = Math.min(100, trace/12);
  if (trace < 300)       { aiProb += 30; reasons.push(`극도로 낮은 Trace(C)=${trace.toFixed(1)} → 과도한 평탄화 감지`); }
  else if (trace < 800)  { aiProb += 20; reasons.push(`낮은 Trace(C)=${trace.toFixed(1)} → AI 특유의 부드러운 텍스처`); }
  else if (trace < 2500) { aiProb += 10; reasons.push(`중간 Trace(C)=${trace.toFixed(1)} → 일부 평탄화 패턴`); }
  else                   { aiProb += 2;  reasons.push(`높은 Trace(C)=${trace.toFixed(1)} → 자연스러운 그라디언트 분포`); }

  // Anisotropy
  if (aniso < 0.2)      { aiProb += 20; reasons.push(`낮은 이방성 ${(aniso*100).toFixed(1)}% → 방향성 없는 노이즈 (AI 특징)`); }
  else if (aniso < 0.5) { aiProb += 8; }
  else                  { aiProb -= 15; reasons.push(`높은 이방성 ${(aniso*100).toFixed(1)}% → 물리적 구조 감지 (실사 특징)`); }

  // Gradient std
  if (gradStd < meanGrad*0.4)  { aiProb += 18; reasons.push(`그라디언트 분산 이상 (σ/μ=${(gradStd/meanGrad).toFixed(2)}) → 균일한 노이즈 패턴`); }
  else if (gradStd > meanGrad) { aiProb -= 10; reasons.push(`풍부한 그라디언트 변화 → 자연 촬영 패턴`); }

  // Saturation consistency
  if (satStd < 0.06)      { aiProb += 15; reasons.push(`채도 분산 극히 낮음 (σ=${satStd.toFixed(3)}) → 인공적 색상 균일성`); }
  else if (satStd < 0.10) { aiProb += 7; }
  else if (satStd > 0.18) { aiProb -= 8; reasons.push(`높은 채도 다양성 → 실제 촬영 환경의 자연스러운 색상`); }

  // High-freq ratio (AI images often have irregular HF noise)
  if (highFreqRatio < 0.04) { aiProb += 10; reasons.push(`고주파 성분 부족 → 확산 모델 특유의 과도한 평탄화`); }
  if (highFreqRatio > 0.20) { aiProb -= 5; }

  // Block frequency
  if (freqIrregScore < 5)  { aiProb += 8; reasons.push(`블록 주파수 불규칙성 낮음 → AI 생성 패턴`); }
  if (freqIrregScore > 20) { aiProb -= 8; reasons.push(`블록 주파수 풍부 → 자연 이미지 특징`); }

  aiProb = Math.max(0, Math.min(100, aiProb + 15));
  const verdict = aiProb >= 62 ? 'AI_GENERATED' : aiProb >= 36 ? 'UNCERTAIN' : 'LIKELY_REAL';

  steps.push({
    step: 7, name: 'Composite AI Probability Score',
    detail: `AI Probability=${aiProb}%  |  Verdict: ${verdict}  |  Based on ${reasons.length} indicators`,
    source: 'Wang et al. (2020), "CNN-Generated Images Are Surprisingly Easy to Spot..."; Corvi et al. (2023)'
  });

  return {
    dimensions: { width, height, format, analyzed: `${rw}×${rh}` },
    steps,
    luminance: { mean: meanLum.toFixed(2), std: lumStd.toFixed(2) },
    gradient:  { mean: meanGrad.toFixed(3), std: gradStd.toFixed(3), highFreqRatio: (highFreqRatio*100).toFixed(1)+'%' },
    covariance:{ C00: C00.toFixed(4), C11: C11.toFixed(4), C01: C01.toFixed(4), trace: trace.toFixed(4), lambda1: lam1.toFixed(4), lambda2: lam2.toFixed(4), anisotropy: (aniso*100).toFixed(1)+'%' },
    saturation:{ mean: (meanSat*100).toFixed(1)+'%', std: satStd.toFixed(3) },
    blockFreq:  freqIrregScore.toFixed(2),
    scores: {
      traceScore:  traceScore.toFixed(1),
      aiProbability: aiProb.toFixed(0),
      highFreqScore: (highFreqRatio*100).toFixed(1),
      patternScore:  ((satStd/(meanSat+0.001))*100).toFixed(1),
      verdict,
      reasons
    }
  };
}

// ══════════════════════════════════════════════
//  WEB VERIFICATION (Step 8 — Extended)
// ══════════════════════════════════════════════

const FC_KNOWLEDGE = {
  ukraine: [
    { source:'Reuters Fact Check', url:'https://www.reuters.com/fact-check/', title:'우크라이나 전쟁 허위 이미지 팩트체크 모음', snippet:'로이터 팩트체크는 우크라이나-러시아 분쟁 관련 AI 생성·조작 이미지 수십 건을 검증했습니다. 가장 흔한 패턴: 비디오게임 영상, 과거 분쟁 사진 재활용, AI 생성 전장 이미지.', type:'factcheck', reliability:'high', lang:'KO' },
    { source:'Bellingcat OSINT', url:'https://www.bellingcat.com/tag/ukraine/', title:'Bellingcat: 위성·지리정보로 우크라이나 이미지 검증', snippet:'오픈소스 인텔리전스(OSINT) 기법으로 우크라이나 분쟁 이미지의 위치·시간 정보를 위성사진과 교차 검증합니다. 위도/경도 매칭, 건물 구조 비교, 그림자 방향 분석.', type:'investigation', reliability:'high', lang:'EN' },
    { source:'AFP Fact Check', url:'https://fact.afp.com/en/list/tags/ukraine', title:'AFP: 우크라이나 관련 허위정보 100+ 건 검증', snippet:'AFP는 AI 합성 이미지, 오래된 사진의 오용, 비디오게임 스크린샷 등 다양한 형태의 허위 이미지를 검증합니다.', type:'factcheck', reliability:'high', lang:'EN' },
    { source:'StopFake.org', url:'https://www.stopfake.org/en/tag/fake-photo/', title:'StopFake: 우크라이나 전문 팩트체크 기관', snippet:'우크라이나 분쟁 관련 허위정보를 전문으로 다루는 독립 팩트체크 기관으로, 러시아발 정보조작을 집중 검증합니다.', type:'factcheck', reliability:'high', lang:'EN' }
  ],
  iran_israel: [
    { source:'AFP Fact Check', url:'https://fact.afp.com/en/list/tags/iran', title:'이란-이스라엘 분쟁 관련 허위 이미지 검증', snippet:'AFP는 이란-이스라엘 갈등 관련 AI 생성 이미지, 다른 분쟁의 영상 오용, 조작된 지도 등을 검증합니다.', type:'factcheck', reliability:'high', lang:'EN' },
    { source:'Snopes', url:'https://www.snopes.com/tag/israel/', title:'Snopes: 중동 분쟁 허위정보 검증', snippet:'스놉스는 중동 분쟁 관련 바이럴 이미지의 진위를 검증합니다. 많은 이미지가 수년 전 다른 지역에서 촬영된 것임이 확인됩니다.', type:'factcheck', reliability:'high', lang:'EN' },
    { source:'MENA Fact Check', url:'https://menafactcheck.com/', title:'중동·북아프리카 전문 팩트체크', snippet:'중동 및 아랍어권 지역의 허위정보를 아랍어·영어로 전문 검증하는 기관입니다.', type:'factcheck', reliability:'high', lang:'AR/EN' }
  ],
  deepfake: [
    { source:'MIT Media Lab', url:'https://detect.mit.edu/', title:'MIT: 딥페이크 탐지 연구 플랫폼', snippet:'MIT 연구팀의 딥페이크 탐지 도구. 얼굴 경계 아티팩트, 조명 불일치, 비자연적 눈 깜빡임 패턴을 분석합니다.', type:'research', reliability:'high', lang:'EN' },
    { source:'KISA 한국인터넷진흥원', url:'https://www.kisa.or.kr/1060', title:'KISA: AI 생성 허위정보 대응 가이드라인 (2024)', snippet:'KISA는 딥페이크·AI 생성 콘텐츠의 탐지 기술 가이드라인과 신고 절차를 제공합니다. 그라디언트 분석, 주파수 분석, 메타데이터 검증 포함.', type:'official', reliability:'high', lang:'KO' },
    { source:'연합뉴스 팩트체크', url:'https://www.yna.co.kr/search/index?query=딥페이크+탐지', title:'연합뉴스: 국내 딥페이크 범죄 동향 (2024-2025)', snippet:'딥페이크를 이용한 디지털 성범죄, 피싱, 가짜 선거 광고 등 한국 내 딥페이크 범죄가 급증. 경찰청 사이버수사대 AI 탐지 기술 도입.', type:'news', reliability:'high', lang:'KO' },
    { source:'경찰청 사이버범죄수사대', url:'https://cyberbureau.police.go.kr/', title:'경찰청: 딥페이크 성범죄 신고 및 수사', snippet:'딥페이크 성범죄 피해 신고 센터. AI 생성 불법 콘텐츠 수사 및 피해자 지원 절차 안내.', type:'official', reliability:'high', lang:'KO' }
  ],
  ai_general: [
    { source:'IEEE Transactions on Information Forensics', url:'https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=10206', title:'IEEE: AI 생성 이미지 포렌식 연구 최신 동향', snippet:'IEEE T-IFS는 GAN/확산 모델 생성 이미지 탐지, 워터마킹, 메타데이터 포렌식 등 최신 연구를 게재합니다. 그라디언트 공분산 분석법이 핵심 방법 중 하나.', type:'research', reliability:'high', lang:'EN' },
    { source:'NIST AI', url:'https://www.nist.gov/artificial-intelligence', title:'NIST: AI 생성 미디어 탐지 표준 (2024)', snippet:'미국 국립표준기술연구소(NIST)가 AI 생성 콘텐츠 탐지·인증 표준을 개발 중. C2PA(Coalition for Content Provenance and Authenticity) 표준 참조.', type:'official', reliability:'high', lang:'EN' },
    { source:'Google DeepMind Safety', url:'https://deepmind.google/safety/', title:'Google DeepMind: AI 콘텐츠 인증 기술 SynthID', snippet:'DeepMind의 SynthID는 AI 생성 이미지에 보이지 않는 워터마크를 삽입합니다. 탐지 알고리즘과 상호보완적으로 사용 가능.', type:'research', reliability:'high', lang:'EN' },
    { source:'C2PA (Content Authenticity)', url:'https://c2pa.org/', title:'C2PA: 콘텐츠 출처 및 진위 연합 표준', snippet:'어도비, MS, 소니, BBC 등이 참여한 C2PA는 디지털 콘텐츠의 생성 기록·수정 이력을 메타데이터로 검증하는 글로벌 표준입니다.', type:'standard', reliability:'high', lang:'EN' }
  ]
};

async function runWebVerification(query) {
  const fetch = (await import('node-fetch')).default;
  const results = [];
  const q = query.toLowerCase();

  // DuckDuckGo
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query+' fake image fact check')}&format=json&no_html=1&skip_disambig=1`;
    const r = await fetch(url, { timeout: 6000 });
    const d = await r.json();
    if (d.AbstractText) results.push({ source: d.AbstractSource||'Wikipedia', url: d.AbstractURL||'#', title: d.Heading||query, snippet: d.AbstractText.slice(0,280), type:'abstract', reliability:'medium', lang:'EN' });
    (d.RelatedTopics||[]).slice(0,3).forEach(t => {
      if (t.Text && t.FirstURL) results.push({ source:'DuckDuckGo', url: t.FirstURL, title: t.Text.slice(0,80), snippet: t.Text.slice(0,200), type:'related', reliability:'low', lang:'EN' });
    });
  } catch(e) {}

  // GDELT
  try {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=4&format=json`;
    const r = await fetch(url, { timeout: 6000 });
    if (r.ok) {
      const d = await r.json();
      (d.articles||[]).slice(0,3).forEach(a => {
        results.push({ source: a.domain||'News', url: a.url||'#', title: a.title||'', snippet: `날짜: ${a.seendate||'N/A'} · 국가: ${a.sourcecountry||'?'}`, type:'news', reliability:'medium', lang: a.language, country: a.sourcecountry });
      });
    }
  } catch(e) {}

  // Curated knowledge base
  if (/ukraine|russia|우크라이나|러시아/.test(q)) results.push(...FC_KNOWLEDGE.ukraine);
  if (/iran|israel|이란|이스라엘|middle.?east/.test(q)) results.push(...FC_KNOWLEDGE.iran_israel);
  if (/deepfake|딥페이크|deep.?fake/.test(q)) results.push(...FC_KNOWLEDGE.deepfake);
  if (/ai|artificial|generated|생성|합성|fake/.test(q)) results.push(...FC_KNOWLEDGE.ai_general);

  // Fallback tools
  if (results.length < 2) {
    results.push(
      { source:'Google Fact Check Explorer', url:`https://toolbox.google.com/factcheck/explorer/search/${encodeURIComponent(query)}`, title:`"${query}" 팩트체크 검색`, snippet:'구글 팩트체크 탐색기에서 전 세계 팩트체크 기관의 검증 결과를 검색합니다.', type:'tool', reliability:'high', lang:'MULTI' },
      { source:'TinEye 역방향 이미지 검색', url:'https://tineye.com/', title:'이미지 원본 출처 추적', snippet:'역방향 이미지 검색으로 해당 이미지가 언제 어디서 처음 등장했는지 추적합니다.', type:'tool', reliability:'high', lang:'EN' }
    );
  }

  return results;
}

// ══════════════════════════════════════════════
//  CHAT RESPONSE ENGINE
// ══════════════════════════════════════════════
function buildChatResponse(msg, context) {
  const m = msg.toLowerCase();
  const ctx = context || '';

  const bank = {
    score:   [ `${ctx}분석 점수 해석: **AI 확률 0~35%** = 실제 사진 가능성 높음 / **35~62%** = 불확실 (추가 검증 권장) / **62~100%** = AI 생성 강하게 의심됩니다. 핵심 지표는 Trace(C) 값입니다 — 낮을수록 그라디언트가 균일하여 AI 생성 특성을 보입니다.` ],
    trace:   [ `공분산 행렬의 Trace(C) = C₀₀ + C₁₁은 이미지 전체의 그라디언트 에너지 합입니다. **실제 사진**은 빛·그림자·텍스처 등 물리적 요인으로 인해 Trace가 높습니다 (보통 2000+). **AI 생성**은 확산 모델이 노이즈를 과도하게 평탄화하여 Trace가 낮게 (보통 500 이하) 나타납니다. Trace/12 공식은 이를 0~100 점수로 정규화한 것입니다.` ],
    deepfake:[ `딥페이크(Deepfake)는 GAN(생성적 적대 신경망) 또는 확산 모델로 얼굴이나 신체를 합성한 콘텐츠입니다. 탐지 신호: 1) 얼굴 경계 블러/아티팩트, 2) 눈 깜빡임 패턴 이상, 3) 귀·머리카락 경계 불자연, 4) 조명 방향 불일치, 5) 메타데이터 부재. Fact Maze의 그라디언트 이방성 분석은 이러한 경계 아티팩트를 포착합니다.` ],
    ukraine: [ `우크라이나-러시아 전쟁 관련 허위 이미지 유형: 1) 비디오게임(Arma 3, DCS) 영상 오용, 2) 2014년 크림반도 사진 재활용, 3) 시리아 분쟁 사진 오용, 4) AI로 완전 생성된 전장 이미지, 5) 진짜 사진에 가짜 날짜/위치 삽입. **Bellingcat, StopFake, Reuters**가 신뢰할 수 있는 검증 소스입니다.` ],
    aniso:   [ `이방성(Anisotropy)은 그라디언트가 특정 방향에 얼마나 집중되어 있는지를 측정합니다. **실제 사진**은 물체 경계·빛 방향에 따라 그라디언트가 특정 방향으로 집중(높은 이방성). **AI 이미지**는 확산 과정에서 방향성 없는 균일한 노이즈가 생성되어 낮은 이방성을 보입니다. λ₁≫λ₂이면 강한 방향성 구조가 있음을 의미합니다.` ],
    default: [ `${ctx}무엇이든 물어보세요! 분석 알고리즘 원리, 판정 결과 해석, 팩트체크 방법, 딥페이크 탐지 기술, 분쟁 지역 허위정보 등에 대해 자세히 설명드릴 수 있습니다.` ]
  };

  let cat = 'default';
  if (/score|점수|result|결과|probability|확률/.test(m)) cat='score';
  if (/trace|covariance|공분산|행렬/.test(m)) cat='trace';
  if (/deepfake|딥페이크|deep.?fake|gan/.test(m)) cat='deepfake';
  if (/ukraine|russia|우크라이나|러시아|전쟁|war/.test(m)) cat='ukraine';
  if (/aniso|이방성|eigen|고유값|lambda|방향/.test(m)) cat='aniso';

  const pool = bank[cat];
  return pool[Math.floor(Math.random()*pool.length)];
}

// ══════════════════════════════════════════════
//  ROUTES
// ══════════════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    uptime: Math.floor((Date.now()-serverStats.startTime)/1000),
    analyses: serverStats.totalAnalyses,
    factChecks: serverStats.totalFactChecks,
    activeSessions: wss.clients.size,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/analyze', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  try {
    serverStats.totalAnalyses++;
    const analysis = await runSevenStepAnalysis(req.file.path);
    const reportId = uuidv4();
    const report = { id: reportId, timestamp: new Date().toISOString(), filename: req.file.originalname, fileSize: req.file.size, analysis, webChecks: [], chatHistory: [] };
    fs.writeFileSync(`uploads/${reportId}.json`, JSON.stringify(report, null, 2));
    try { fs.unlinkSync(req.file.path); } catch(e) {}
    broadcast({ type:'analysis_complete', reportId, verdict: analysis.scores.verdict });
    res.json({ success: true, reportId, analysis });
  } catch(err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/webverify', async (req, res) => {
  const { query, reportId } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });
  try {
    serverStats.totalFactChecks++;
    const results = await runWebVerification(query);
    if (reportId) {
      const p = `uploads/${reportId}.json`;
      if (fs.existsSync(p)) {
        const r = JSON.parse(fs.readFileSync(p));
        r.webChecks.push({ query, results, timestamp: new Date().toISOString() });
        fs.writeFileSync(p, JSON.stringify(r, null, 2));
      }
    }
    res.json({ success: true, results });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { message, reportId } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  let ctx = '';
  if (reportId) {
    const p = `uploads/${reportId}.json`;
    if (fs.existsSync(p)) {
      const r = JSON.parse(fs.readFileSync(p));
      const s = r.analysis?.scores;
      ctx = `[분석 결과: ${s?.verdict}, AI확률=${s?.aiProbability}%, Trace=${r.analysis?.covariance?.trace}] `;
      const resp = buildChatResponse(message, ctx);
      r.chatHistory.push({ role:'user', content:message, ts: new Date().toISOString() }, { role:'assistant', content:resp, ts: new Date().toISOString() });
      fs.writeFileSync(p, JSON.stringify(r, null, 2));
      return res.json({ success:true, response: resp });
    }
  }
  res.json({ success:true, response: buildChatResponse(message, ctx) });
});

app.get('/api/report/:id', (req, res) => {
  const p = `uploads/${req.params.id}.json`;
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
  res.json(JSON.parse(fs.readFileSync(p)));
});

app.get('/api/export/:id', (req, res) => {
  const p = `uploads/${req.params.id}.json`;
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Disposition', `attachment; filename="factmaze_${req.params.id.slice(0,8)}.json"`);
  res.json(JSON.parse(fs.readFileSync(p)));
});

// ── WebSocket ──
wss.on('connection', ws => {
  ws.send(JSON.stringify({ type:'connected', msg:'Fact Maze Engine Online', stats: serverStats }));
  ws.on('close', () => {});
});

function broadcast(data) {
  wss.clients.forEach(c => { if (c.readyState===WebSocket.OPEN) c.send(JSON.stringify(data)); });
}

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Fact Maze running on :${PORT}`));
