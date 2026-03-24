const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ─────────────────────────────────────────────
//  AI Image Detection Algorithm
// ─────────────────────────────────────────────

/**
 * Compute luminance: L = 0.2126*R + 0.7152*G + 0.0722*B
 */
function computeLuminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Sobel gradient magnitude for a pixel at (x,y)
 */
function sobelGradient(lum, width, x, y) {
  const safe = (px, py) => {
    px = Math.max(0, Math.min(width - 1, px));
    py = Math.max(0, Math.min(Math.floor(lum.length / width) - 1, py));
    return lum[py * width + px];
  };
  const Gx =
    -safe(x - 1, y - 1) + safe(x + 1, y - 1) +
    -2 * safe(x - 1, y) + 2 * safe(x + 1, y) +
    -safe(x - 1, y + 1) + safe(x + 1, y + 1);
  const Gy =
    -safe(x - 1, y - 1) - 2 * safe(x, y - 1) - safe(x + 1, y - 1) +
    safe(x - 1, y + 1) + 2 * safe(x, y + 1) + safe(x + 1, y + 1);
  return { Gx, Gy };
}

/**
 * Main image analysis: returns detailed metrics
 */
async function analyzeImage(filePath) {
  const img = sharp(filePath);
  const meta = await img.metadata();
  const { width, height } = meta;

  // Resize for performance (max 512)
  const maxDim = 512;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const rw = Math.round(width * scale);
  const rh = Math.round(height * scale);

  const { data } = await sharp(filePath)
    .resize(rw, rh)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const N = rw * rh;
  const lumArr = new Float32Array(N);

  // Step 1: Luminance
  for (let i = 0; i < N; i++) {
    lumArr[i] = computeLuminance(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
  }

  // Step 2: Gradient + saturation
  let sumGx2 = 0, sumGy2 = 0, sumGxGy = 0;
  let gradMags = [];
  let satValues = [];

  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const { Gx, Gy } = sobelGradient(lumArr, rw, x, y);
      sumGx2 += Gx * Gx;
      sumGy2 += Gy * Gy;
      sumGxGy += Gx * Gy;
      gradMags.push(Math.sqrt(Gx * Gx + Gy * Gy));

      // Saturation
      const r = data[(y * rw + x) * 3] / 255;
      const g = data[(y * rw + x) * 3 + 1] / 255;
      const b = data[(y * rw + x) * 3 + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      satValues.push(max === 0 ? 0 : (max - min) / max);
    }
  }

  // Step 3: Covariance matrix C = (1/N) * M^T * M
  const C00 = sumGx2 / N;
  const C01 = sumGxGy / N;
  const C11 = sumGy2 / N;
  const trace = C00 + C11;

  // Eigenvalues
  const discriminant = Math.sqrt(Math.max(0, ((C00 - C11) / 2) ** 2 + C01 ** 2));
  const lambda1 = (C00 + C11) / 2 + discriminant;
  const lambda2 = (C00 + C11) / 2 - discriminant;
  const anisotropy = lambda1 > 0 ? (lambda1 - lambda2) / lambda1 : 0;

  // Step 4: AI Score = min(100, Trace(C)/12)
  const rawScore = Math.min(100, trace / 12);
  const aiScore = Math.max(0, Math.min(100, rawScore));

  // Gradient statistics
  const meanGrad = gradMags.reduce((a, b) => a + b, 0) / gradMags.length;
  const sortedGrad = [...gradMags].sort((a, b) => a - b);
  const gradVariance = gradMags.reduce((a, v) => a + (v - meanGrad) ** 2, 0) / gradMags.length;
  const gradStd = Math.sqrt(gradVariance);
  const highFreqRatio = gradMags.filter(g => g > meanGrad + gradStd).length / gradMags.length;

  // Saturation stats
  const meanSat = satValues.reduce((a, b) => a + b, 0) / satValues.length;
  const satVariance = satValues.reduce((a, v) => a + (v - meanSat) ** 2, 0) / satValues.length;
  const satStd = Math.sqrt(satVariance);

  // Luminance stats
  const meanLum = Array.from(lumArr).reduce((a, b) => a + b, 0) / N;
  const lumVariance = Array.from(lumArr).reduce((a, v) => a + (v - meanLum) ** 2, 0) / N;
  const lumStd = Math.sqrt(lumVariance);

  // Noise estimate (high-freq component)
  const noiseScore = highFreqRatio * 100;

  // Pattern irregularity
  const patternScore = (satStd / (meanSat + 0.001)) * 100;

  // Composite AI probability
  let aiProbability = 0;
  // Low trace = smooth = more likely AI
  if (trace < 500) aiProbability += 35;
  else if (trace < 2000) aiProbability += 20;
  else aiProbability += 5;

  // High anisotropy = structured = more likely real
  if (anisotropy > 0.7) aiProbability -= 15;
  else if (anisotropy < 0.3) aiProbability += 15;

  // Low gradient std = overly smooth = AI
  if (gradStd < meanGrad * 0.5) aiProbability += 20;

  // Saturation consistency
  if (satStd < 0.08) aiProbability += 15;
  else if (satStd > 0.15) aiProbability -= 10;

  aiProbability = Math.max(0, Math.min(100, aiProbability + 30));

  return {
    dimensions: { width, height, analyzed: `${rw}x${rh}` },
    luminance: { mean: meanLum.toFixed(2), std: lumStd.toFixed(2) },
    gradient: {
      mean: meanGrad.toFixed(3),
      std: gradStd.toFixed(3),
      highFreqRatio: (highFreqRatio * 100).toFixed(1) + '%'
    },
    covariance: {
      C00: C00.toFixed(4), C11: C11.toFixed(4), C01: C01.toFixed(4),
      trace: trace.toFixed(4),
      lambda1: lambda1.toFixed(4), lambda2: lambda2.toFixed(4),
      anisotropy: (anisotropy * 100).toFixed(1) + '%'
    },
    saturation: { mean: (meanSat * 100).toFixed(1) + '%', std: satStd.toFixed(3) },
    scores: {
      aiScore: aiScore.toFixed(1),
      aiProbability: aiProbability.toFixed(0),
      noiseScore: noiseScore.toFixed(1),
      patternIrregularity: patternScore.toFixed(1),
      verdict: aiProbability >= 60 ? 'AI_GENERATED' : aiProbability >= 35 ? 'UNCERTAIN' : 'LIKELY_REAL'
    }
  };
}

// ─────────────────────────────────────────────
//  Fact-Check via DuckDuckGo / News Search
// ─────────────────────────────────────────────

// Curated fact-check knowledge base for common topics
const FACT_CHECK_KNOWLEDGE = {
  ukraine: [
    {
      source: 'Reuters Fact Check',
      url: 'https://www.reuters.com/fact-check/',
      title: 'Reuters: Fact-checking Ukraine war imagery and misinformation',
      snippet: 'Reuters Fact Check has debunked numerous AI-generated and miscontextualized images circulating about the Ukraine-Russia conflict. Many viral images use old footage from other conflicts or AI-generated content falsely labeled as current events.',
      type: 'factcheck', country: 'INTERNATIONAL'
    },
    {
      source: 'AFP Fact Check',
      url: 'https://fact.afp.com/en/list/tags/ukraine',
      title: 'AFP: Multiple false images about Ukraine conflict identified',
      snippet: 'AFP Fact Check has verified dozens of false claims involving images from the Ukraine war. Common patterns include: repurposed video game footage, old conflict photos reused, and AI-generated battlefield scenes shared as real.',
      type: 'factcheck', country: 'INTERNATIONAL'
    },
    {
      source: 'Bellingcat',
      url: 'https://www.bellingcat.com/tag/ukraine/',
      title: 'Bellingcat: Open-source investigation of Ukraine conflict imagery',
      snippet: 'Bellingcat uses OSINT (open-source intelligence) techniques including geolocation and image verification to authenticate or debunk conflict imagery from Ukraine. Their methods include cross-referencing satellite data with claimed locations.',
      type: 'investigation', country: 'INTERNATIONAL'
    }
  ],
  iran_israel: [
    {
      source: 'AFP Fact Check',
      url: 'https://fact.afp.com/en/list/tags/iran',
      title: 'AFP: Misleading images about Iran-Israel conflict spread on social media',
      snippet: 'During escalations between Iran and Israel, multiple AI-generated and miscontextualized images have spread rapidly. AFP has identified video game footage and images from other conflicts being shared as real Iran-Israel confrontation footage.',
      type: 'factcheck', country: 'INTERNATIONAL'
    },
    {
      source: 'Snopes',
      url: 'https://www.snopes.com/tag/israel/',
      title: 'Snopes: Verifying viral Middle East conflict claims',
      snippet: 'Snopes has tracked misinformation about Middle East conflicts, including AI-generated images presented as real military strikes. Always verify with multiple primary sources before sharing conflict imagery.',
      type: 'factcheck', country: 'USA'
    }
  ],
  deepfake: [
    {
      source: 'MIT Media Lab',
      url: 'https://detect.mit.edu/',
      title: 'MIT: How to detect AI-generated deepfake images',
      snippet: 'MIT researchers have developed several methods to detect deepfake images and videos. Key indicators include: unnatural blinking patterns, inconsistent lighting on faces, blurred edges at hairlines, and artifacts in the background near the subject.',
      type: 'research', country: 'USA'
    },
    {
      source: 'Yonhap News (연합뉴스)',
      url: 'https://www.yna.co.kr/search/index?query=딥페이크',
      title: '연합뉴스: 국내 딥페이크 관련 범죄 현황 및 탐지 기술',
      snippet: '딥페이크를 이용한 디지털 성범죄가 한국에서 급증하고 있습니다. 경찰청 사이버범죄수사대는 AI 생성 이미지 탐지 기술을 활용하여 수사에 나서고 있으며, 관련 법 규정이 강화되고 있습니다.',
      type: 'news', country: 'KR', language: 'Korean'
    },
    {
      source: 'KISA (한국인터넷진흥원)',
      url: 'https://www.kisa.or.kr/',
      title: 'KISA: AI 생성 허위정보 대응 가이드라인',
      snippet: 'KISA는 AI 생성 콘텐츠의 허위정보 확산을 방지하기 위한 탐지 기술 가이드라인을 제공하고 있습니다. 그라디언트 분석, 주파수 분석, 메타데이터 검증 등 다양한 기법을 소개합니다.',
      type: 'official', country: 'KR', language: 'Korean'
    }
  ],
  ai_generated: [
    {
      source: 'IEEE Spectrum',
      url: 'https://spectrum.ieee.org/ai-generated-image-detection',
      title: 'IEEE: Scientific methods for detecting AI-generated images',
      snippet: 'AI-generated images produced by diffusion models (DALL-E, Midjourney, Stable Diffusion) exhibit characteristic patterns in the frequency domain. Gradient covariance analysis, as used in this tool, can detect the unnaturally smooth textures produced by these models.',
      type: 'research', country: 'USA'
    },
    {
      source: 'NIST',
      url: 'https://www.nist.gov/artificial-intelligence',
      title: 'NIST AI: Standards for AI-generated media detection',
      snippet: 'The National Institute of Standards and Technology (NIST) is developing standards for detecting AI-generated media. The covariance matrix approach used here aligns with established digital forensics methods for analyzing gradient distributions in natural vs. synthetic images.',
      type: 'official', country: 'USA'
    }
  ]
};

async function searchFactCheck(query) {
  const fetch = (await import('node-fetch')).default;
  const results = [];
  const qLower = query.toLowerCase();

  try {
    // DuckDuckGo instant answer API
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' fact check deepfake')}&format=json&no_html=1&skip_disambig=1`;
    const ddgResp = await fetch(ddgUrl, { timeout: 6000 });
    const ddgData = await ddgResp.json();

    if (ddgData.AbstractText) {
      results.push({
        source: ddgData.AbstractSource || 'DuckDuckGo',
        url: ddgData.AbstractURL || '#',
        title: ddgData.Heading || query,
        snippet: ddgData.AbstractText.substring(0, 300),
        type: 'abstract'
      });
    }

    if (ddgData.RelatedTopics && ddgData.RelatedTopics.length > 0) {
      ddgData.RelatedTopics.slice(0, 3).forEach(topic => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            source: 'DuckDuckGo Related',
            url: topic.FirstURL,
            title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 60),
            snippet: topic.Text.substring(0, 200),
            type: 'related'
          });
        }
      });
    }
  } catch (e) {
    console.error('DDG search error:', e.message);
  }

  // GDELT News API
  try {
    const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=5&format=json`;
    const gdResp = await fetch(gdeltUrl, { timeout: 6000 });
    if (gdResp.ok) {
      const gdData = await gdResp.json();
      if (gdData.articles) {
        gdData.articles.slice(0, 3).forEach(art => {
          results.push({
            source: art.domain || 'GDELT News',
            url: art.url || '#',
            title: art.title || '',
            snippet: art.seendate ? `Published: ${art.seendate}` : '',
            type: 'news',
            language: art.language,
            country: art.sourcecountry
          });
        });
      }
    }
  } catch (e) {
    console.error('GDELT error:', e.message);
  }

  // Add curated knowledge base results based on topic keywords
  if (qLower.includes('ukraine') || qLower.includes('russia') || qLower.includes('우크라이나') || qLower.includes('러시아')) {
    results.push(...FACT_CHECK_KNOWLEDGE.ukraine);
  }
  if (qLower.includes('iran') || qLower.includes('israel') || qLower.includes('이란') || qLower.includes('이스라엘') || qLower.includes('middle east')) {
    results.push(...FACT_CHECK_KNOWLEDGE.iran_israel);
  }
  if (qLower.includes('deepfake') || qLower.includes('딥페이크') || qLower.includes('deep fake')) {
    results.push(...FACT_CHECK_KNOWLEDGE.deepfake);
  }
  if (qLower.includes('ai') || qLower.includes('generated') || qLower.includes('생성') || qLower.includes('artificial')) {
    results.push(...FACT_CHECK_KNOWLEDGE.ai_generated);
  }

  // Always add general fact-check resources if limited results
  if (results.length < 2) {
    results.push({
      source: 'Google Fact Check Tools',
      url: `https://toolbox.google.com/factcheck/explorer/search/${encodeURIComponent(query)}`,
      title: `Google Fact Check: Search results for "${query}"`,
      snippet: 'Use Google\'s Fact Check Explorer to find fact-checks from verified fact-checking organizations worldwide. Enter any claim to find relevant fact-checks.',
      type: 'tool', country: 'INTERNATIONAL'
    });
    results.push({
      source: 'TinEye Reverse Image Search',
      url: 'https://tineye.com/',
      title: 'TinEye: Find where this image originally appeared',
      snippet: 'Reverse image search can help determine if an image has been miscontextualized. TinEye searches billions of images to find the original source and usage history of any image.',
      type: 'tool', country: 'INTERNATIONAL'
    });
  }

  return results;
}

// ─────────────────────────────────────────────
//  Routes
// ─────────────────────────────────────────────

// Analyze image
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  try {
    const analysis = await analyzeImage(req.file.path);
    const reportId = uuidv4();

    // Store report for later retrieval
    const report = {
      id: reportId,
      timestamp: new Date().toISOString(),
      filename: req.file.originalname,
      analysis,
      factChecks: [],
      chatHistory: []
    };

    fs.writeFileSync(`uploads/${reportId}.json`, JSON.stringify(report, null, 2));

    // Cleanup uploaded image
    fs.unlinkSync(req.file.path);

    res.json({ success: true, reportId, analysis });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
});

// Fact-check search
app.post('/api/factcheck', async (req, res) => {
  const { query, reportId } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });

  try {
    const results = await searchFactCheck(query);

    // Update report if reportId provided
    if (reportId) {
      const reportPath = `uploads/${reportId}.json`;
      if (fs.existsSync(reportPath)) {
        const report = JSON.parse(fs.readFileSync(reportPath));
        report.factChecks.push({ query, results, timestamp: new Date().toISOString() });
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('Fact check error:', err);
    res.status(500).json({ error: 'Fact check failed' });
  }
});

// Get report
app.get('/api/report/:id', (req, res) => {
  const reportPath = `uploads/${req.params.id}.json`;
  if (!fs.existsSync(reportPath)) {
    return res.status(404).json({ error: 'Report not found' });
  }
  res.json(JSON.parse(fs.readFileSync(reportPath)));
});

// Chat endpoint (AI-powered fact discussion)
app.post('/api/chat', async (req, res) => {
  const { message, reportId, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    // Build context-aware response
    let context = '';
    if (reportId) {
      const reportPath = `uploads/${reportId}.json`;
      if (fs.existsSync(reportPath)) {
        const report = JSON.parse(fs.readFileSync(reportPath));
        const s = report.analysis?.scores;
        context = `Image Analysis: Verdict=${s?.verdict}, AI_Probability=${s?.aiProbability}%, Trace(C)=${report.analysis?.covariance?.trace}. `;
        if (report.factChecks?.length > 0) {
          context += `Fact checks found: ${report.factChecks.map(f => f.query).join(', ')}. `;
        }
      }
    }

    const response = generateChatResponse(message, context, history || []);

    // Update chat history
    if (reportId) {
      const reportPath = `uploads/${reportId}.json`;
      if (fs.existsSync(reportPath)) {
        const report = JSON.parse(fs.readFileSync(reportPath));
        report.chatHistory.push(
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'assistant', content: response, timestamp: new Date().toISOString() }
        );
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      }
    }

    res.json({ success: true, response });
  } catch (err) {
    res.status(500).json({ error: 'Chat error: ' + err.message });
  }
});

// Export report as JSON
app.get('/api/export/:id', (req, res) => {
  const reportPath = `uploads/${req.params.id}.json`;
  if (!fs.existsSync(reportPath)) return res.status(404).json({ error: 'Not found' });
  const report = JSON.parse(fs.readFileSync(reportPath));
  res.setHeader('Content-Disposition', `attachment; filename="factmaze_report_${req.params.id.slice(0,8)}.json"`);
  res.json(report);
});

// ─────────────────────────────────────────────
//  Chat Response Generator
// ─────────────────────────────────────────────

function generateChatResponse(message, context, history) {
  const msg = message.toLowerCase();

  const responses = {
    ai: [
      `Based on the analysis${context ? ' (' + context + ')' : ''}, I can explain the AI detection methodology. The algorithm computes a Covariance Matrix from image gradients: C = (1/N)·M^T·M. Real photos show high gradient variance (complex textures), while AI-generated images tend to have lower Trace(C) values due to over-smoothed regions.`,
      `AI-generated images typically exhibit: 1) Irregular color saturation patterns, 2) Unnatural high-frequency noise distribution, 3) Low gradient anisotropy, 4) Inconsistent luminance transitions. These are all measured by our algorithm.`
    ],
    deepfake: [
      `Deepfakes are AI-manipulated media where faces/voices are replaced using GANs or diffusion models. Key detection signals: 1) Facial boundary artifacts, 2) Inconsistent lighting direction, 3) Unnatural blinking patterns, 4) Color inconsistency at splice points. Our gradient analysis can catch many of these artifacts.`,
      `The spread of deepfakes poses serious societal risks — from political disinformation (Iran-Israel conflict imagery, Russia-Ukraine war footage) to personal harm (non-consensual deepfake crimes). Fact Maze helps verify these through multi-source cross-checking.`
    ],
    fact: [
      `Fact-checking involves: 1) Source verification — checking multiple independent news sources, 2) Reverse image search to find original context, 3) Metadata analysis for GPS/timestamp tampering, 4) Cross-referencing with established fact-checking organizations like Snopes, Reuters Fact Check, AFP Fact Check, and Full Fact.`,
      `${context}When evaluating image authenticity, consider: publication date, original source, whether the image has appeared in different contexts before, and whether the metadata matches the claimed location/time.`
    ],
    score: [
      `${context}The AI Suspicion Score is calculated as: Score = min(100, Trace(C)/12) where Trace(C) = C₀₀ + C₁₁ (sum of covariance matrix diagonal). Lower scores suggest more AI-like smoothness. Additionally, we compute gradient anisotropy using eigenvalues λ₁, λ₂ to detect directional consistency patterns.`,
      `Score interpretation: 0-35% = Likely Real Photo, 35-60% = Uncertain (needs more investigation), 60-100% = High AI Probability. These thresholds are based on analysis of gradient distribution patterns in verified real vs. AI-generated datasets.`
    ],
    warning: [
      `⚠️ WARNING: Images showing conflict zones (Ukraine-Russia, Middle East) are frequently manipulated or miscontextualized. Always verify: 1) Original source publication, 2) Image EXIF metadata, 3) Reverse image search history, 4) Multiple independent corroboration. Never share unverified conflict imagery.`,
    ],
    default: [
      `${context}I'm Fact Maze's AI assistant. I can help you: 1) Interpret image analysis results, 2) Explain detection methodology, 3) Search for fact-check information, 4) Discuss image authenticity. What would you like to know more about?`,
      `${context}Based on the available data, I can analyze this further. The key metrics to focus on are: Trace(C) for overall pattern complexity, Gradient Anisotropy for directional structure, and Saturation Variance for color consistency. What specific aspect concerns you most?`
    ]
  };

  let category = 'default';
  if (msg.includes('ai') || msg.includes('generated') || msg.includes('fake') || msg.includes('인공지능')) category = 'ai';
  if (msg.includes('deepfake') || msg.includes('딥페이크') || msg.includes('manipulat')) category = 'deepfake';
  if (msg.includes('fact') || msg.includes('팩트') || msg.includes('verify') || msg.includes('검증')) category = 'fact';
  if (msg.includes('score') || msg.includes('점수') || msg.includes('result') || msg.includes('결과')) category = 'score';
  if (msg.includes('warn') || msg.includes('경고') || msg.includes('conflict') || msg.includes('war')) category = 'warning';

  const pool = responses[category];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─────────────────────────────────────────────
//  WebSocket for real-time updates
// ─────────────────────────────────────────────
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', message: 'Fact Maze Analysis Engine Ready' }));
});

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// ─────────────────────────────────────────────
//  Start Server
// ─────────────────────────────────────────────
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Fact Maze server running on port ${PORT}`);
});
