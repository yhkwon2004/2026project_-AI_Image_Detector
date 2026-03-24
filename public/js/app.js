/* ═══════════════════════════════════════════════
   FACT MAZE — Client Application Logic
   ═══════════════════════════════════════════════ */

// ─── State ───
let currentFile = null;
let currentReportId = null;
let currentAnalysis = null;
let ws = null;

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  initDragDrop();
  initWebSocket();
  // Pre-fill FC query from landing input
  const fcQ = document.getElementById('fc-query');
  const fcSearch = document.getElementById('fc-search-input');
  if (fcQ && fcSearch) {
    fcQ.addEventListener('input', () => { fcSearch.value = fcQ.value; });
  }
});

// ─── WebSocket ───
function initWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${proto}//${location.host}`;
  try {
    ws = new WebSocket(wsUrl);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'connected') {
        console.log('WS connected:', data.message);
      }
    };
    ws.onerror = () => {}; // silent fail
  } catch (e) {}
}

// ─── Section Navigation ───
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`section-${name}`)?.classList.add('active');
  document.querySelector(`[data-section="${name}"]`)?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Drag & Drop ───
function initDragDrop() {
  const zone = document.getElementById('dropzone');
  if (!zone) return;

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setFile(file);
    } else {
      showToast('이미지 파일만 업로드 가능합니다', 'error');
    }
  });
  zone.addEventListener('click', (e) => {
    if (!e.target.closest('.drop-preview') && !e.target.closest('.btn-clear')) {
      document.getElementById('file-input')?.click();
    }
  });
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) setFile(file);
}

function setFile(file) {
  currentFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('preview-name').textContent = `${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    document.getElementById('drop-inner').style.display = 'none';
    document.getElementById('drop-preview').style.display = 'block';
    document.getElementById('btn-analyze').disabled = false;
  };
  reader.readAsDataURL(file);
  // Sync FC query
  const q = document.getElementById('fc-query').value;
  if (q) document.getElementById('fc-search-input').value = q;
}

function clearImage() {
  currentFile = null;
  document.getElementById('file-input').value = '';
  document.getElementById('drop-inner').style.display = 'flex';
  document.getElementById('drop-preview').style.display = 'none';
  document.getElementById('btn-analyze').disabled = true;
}

// ─── Main Analysis ───
async function startAnalysis() {
  if (!currentFile) return;

  const btn = document.getElementById('btn-analyze');
  btn.querySelector('.btn-text').style.display = 'none';
  btn.querySelector('.btn-loader').style.display = 'flex';
  btn.disabled = true;

  showToast('🔬 이미지 분석 중...', 'info');

  try {
    const formData = new FormData();
    formData.append('image', currentFile);

    const resp = await fetch('/api/analyze', { method: 'POST', body: formData });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();

    currentReportId = data.reportId;
    currentAnalysis = data.analysis;

    // Show results
    document.getElementById('result-empty').style.display = 'none';
    document.getElementById('result-panel').style.display = 'block';

    renderVerdictBanner(data.analysis);
    renderMetrics(data.analysis);
    renderReport(data.analysis, data.reportId);

    showToast('✅ 분석 완료! 결과를 확인하세요', 'success');

    // Auto-run fact check if query provided
    const q = document.getElementById('fc-query').value.trim();
    if (q) {
      document.getElementById('fc-search-input').value = q;
      setTimeout(() => runFactCheck(), 500);
    }

    // Add AI suspicion warning if needed
    const prob = parseInt(data.analysis.scores.aiProbability);
    if (prob >= 60) {
      setTimeout(() => addChatMessage('assistant',
        `⚠️ <strong>경고:</strong> 이 이미지는 AI 생성 가능성이 <strong>${prob}%</strong>로 높습니다. ` +
        `Trace(C) = ${data.analysis.covariance.trace}, 방향 이방성 = ${data.analysis.covariance.anisotropy}. ` +
        `팩트체크 탭에서 추가 검증을 진행하세요.`
      ), 800);
    } else if (prob >= 35) {
      setTimeout(() => addChatMessage('assistant',
        `⚡ 분석 결과 AI 확률이 <strong>${prob}%</strong>로 불확실합니다. ` +
        `추가적인 소스 검증이 필요합니다. 팩트체크 탭을 이용해보세요.`
      ), 800);
    }

  } catch (err) {
    showToast('❌ 분석 실패: ' + err.message, 'error');
    console.error(err);
  } finally {
    btn.querySelector('.btn-text').style.display = 'flex';
    btn.querySelector('.btn-loader').style.display = 'none';
    btn.disabled = false;
  }
}

// ─── Render Verdict ───
function renderVerdictBanner(analysis) {
  const { verdict, aiProbability } = analysis.scores;
  const banner = document.getElementById('verdict-banner');
  const icon = document.getElementById('verdict-icon');
  const title = document.getElementById('verdict-title');
  const desc = document.getElementById('verdict-desc');
  const scoreNum = document.getElementById('score-num');
  const ringFill = document.getElementById('ring-fill');

  banner.className = 'verdict-banner';
  const prob = parseInt(aiProbability);

  if (verdict === 'LIKELY_REAL') {
    banner.classList.add('is-real');
    icon.textContent = '✅';
    title.textContent = '실제 사진으로 판단됨';
    title.style.color = 'var(--green)';
    desc.textContent = `AI 확률 ${prob}% — 자연스러운 그라디언트 패턴과 물리적 특성이 감지됨`;
    ringFill.style.stroke = 'var(--green)';
  } else if (verdict === 'UNCERTAIN') {
    banner.classList.add('is-uncertain');
    icon.textContent = '⚠️';
    title.textContent = '불확실 — 추가 검증 필요';
    title.style.color = 'var(--orange)';
    desc.textContent = `AI 확률 ${prob}% — 일부 비자연적 패턴 감지. 다중 소스 교차 검증을 권장합니다`;
    ringFill.style.stroke = 'var(--orange)';
  } else {
    banner.classList.add('is-ai');
    icon.textContent = '🚨';
    title.textContent = 'AI 생성 가능성 높음';
    title.style.color = 'var(--red)';
    desc.textContent = `AI 확률 ${prob}% — 비정상적 그라디언트 분포, 과도한 평탄화 패턴 감지`;
    ringFill.style.stroke = 'var(--red)';
  }

  // Animate score counter
  animateCount(scoreNum, 0, prob, 1200);

  // Animate ring
  const circumference = 314;
  const offset = circumference - (prob / 100) * circumference;
  setTimeout(() => {
    ringFill.style.strokeDashoffset = offset;
  }, 100);
}

function animateCount(el, from, to, duration) {
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * ease);
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ─── Render Metrics ───
function renderMetrics(analysis) {
  const { covariance, gradient, saturation, luminance, scores } = analysis;

  // Trace
  const trace = parseFloat(covariance.trace);
  const traceNorm = Math.min(100, trace / 50);
  setMetric('trace', trace.toFixed(2), traceNorm, covariance.trace < 500 ? 'var(--red)' : 'var(--green)');

  // Gradient mean
  const gMean = parseFloat(gradient.mean);
  const gNorm = Math.min(100, gMean / 3);
  setMetric('grad', gradient.mean, gNorm, gMean < 1 ? 'var(--red)' : 'var(--green)');

  // Anisotropy
  const aniso = parseFloat(covariance.anisotropy);
  setMetric('aniso', covariance.anisotropy, aniso, aniso > 60 ? 'var(--green)' : 'var(--red)');

  // Saturation std
  const satS = parseFloat(saturation.std);
  const satNorm = Math.min(100, satS * 400);
  setMetric('sat', saturation.std, satNorm, satS > 0.1 ? 'var(--green)' : 'var(--red)');

  // High freq ratio
  const hf = parseFloat(gradient.highFreqRatio);
  setMetric('hf', gradient.highFreqRatio, hf, null);

  // Luminance std
  const lumS = parseFloat(luminance.std);
  const lumNorm = Math.min(100, lumS / 1.5);
  setMetric('lum', luminance.std, lumNorm, lumS > 50 ? 'var(--green)' : 'var(--red)');

  // Matrix
  document.getElementById('c00').textContent = covariance.C00;
  document.getElementById('c01').textContent = covariance.C01;
  document.getElementById('c10').textContent = covariance.C01; // symmetric
  document.getElementById('c11').textContent = covariance.C11;
  document.getElementById('lambda1').textContent = covariance.lambda1;
  document.getElementById('lambda2').textContent = covariance.lambda2;
  document.getElementById('trace-val').textContent = covariance.trace;
}

function setMetric(id, value, normPct, color) {
  const valEl = document.getElementById(`m-${id}`);
  const barEl = document.getElementById(`mb-${id}`);
  if (valEl) valEl.textContent = value;
  if (barEl) {
    setTimeout(() => {
      barEl.style.width = `${Math.min(100, Math.max(0, normPct))}%`;
      if (color) barEl.style.background = color;
    }, 200);
  }
}

// ─── Tabs ───
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${name}`)?.classList.add('active');
  event.target.classList.add('active');
}

// ─── Fact Check ───
function setFCQuery(q) {
  document.getElementById('fc-search-input').value = q;
  document.getElementById('fc-query').value = q;
  runFactCheck();
}

async function runFactCheck() {
  const query = document.getElementById('fc-search-input').value.trim();
  if (!query) { showToast('검색어를 입력해주세요', 'warning'); return; }

  const container = document.getElementById('fc-results');
  container.innerHTML = `
    <div class="fc-loading">
      <div class="spinner"></div>
      <span>실시간 뉴스 및 팩트체크 검색 중: "${query}"</span>
    </div>`;

  // Switch to fact-check tab
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-factcheck')?.classList.add('active');
  document.querySelectorAll('.rtab')[1]?.classList.add('active');

  try {
    const resp = await fetch('/api/factcheck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, reportId: currentReportId })
    });
    const data = await resp.json();

    renderFactCheckResults(data.results, query);
  } catch (err) {
    container.innerHTML = `<div class="fc-warn">❌ 팩트체크 검색 실패: ${err.message}</div>`;
  }
}

function renderFactCheckResults(results, query) {
  const container = document.getElementById('fc-results');

  // Add AI warning for conflict-related queries
  const isConflict = /ukraine|russia|iran|israel|war|분쟁|전쟁|우크라이나|러시아|이란|이스라엘/i.test(query);

  let html = '';

  if (isConflict) {
    html += `
      <div class="fc-warn">
        ⚠️ <strong>분쟁 지역 관련 검색:</strong> 
        전쟁·분쟁 관련 이미지는 허위정보 확산 위험이 높습니다. 
        반드시 복수의 공신력 있는 언론사 소스를 교차 확인하세요.
      </div>`;
  }

  if (!results || results.length === 0) {
    html += `
      <div class="fc-empty">
        "${query}"에 대한 검색 결과가 없습니다.<br/>
        다른 키워드로 검색하거나 직접 신뢰할 수 있는 언론사 사이트를 확인하세요.
      </div>`;
  } else {
    results.forEach((r, i) => {
      const typeLabel = r.type === 'news' ? '📰 뉴스' : r.type === 'abstract' ? '📖 요약' : '🔗 관련';
      html += `
        <div class="fc-result-item" style="animation: fadeIn 0.3s ease ${i * 0.08}s both">
          <div class="fc-result-header">
            <a href="${r.url}" target="_blank" rel="noopener" class="fc-result-title">${escapeHtml(r.title || '제목 없음')}</a>
            <span class="fc-result-source">${typeLabel} · ${escapeHtml(r.source)}</span>
          </div>
          ${r.snippet ? `<p class="fc-result-snippet">${escapeHtml(r.snippet)}</p>` : ''}
          <div class="fc-result-meta">
            ${r.country ? `<span>🌍 ${r.country}</span>` : ''}
            ${r.language ? `<span>🗣 ${r.language}</span>` : ''}
            <span>🔗 <a href="${r.url}" target="_blank" style="color:var(--cyan);font-size:11px">${r.url.substring(0,60)}${r.url.length > 60 ? '...' : ''}</a></span>
          </div>
        </div>`;
    });
  }

  // Add fact-check resources
  html += `
    <div class="fc-result-item" style="border-color: rgba(0,212,255,0.2)">
      <div class="fc-result-header">
        <span class="fc-result-title" style="color:var(--text2)">📌 신뢰할 수 있는 팩트체크 기관</span>
      </div>
      <div class="fc-result-meta" style="flex-wrap:wrap;gap:8px;margin-top:8px">
        <a href="https://www.snopes.com/search/${encodeURIComponent(query)}" target="_blank" class="fc-tag">Snopes</a>
        <a href="https://fact.afp.com/en" target="_blank" class="fc-tag">AFP Fact Check</a>
        <a href="https://www.factcheck.org" target="_blank" class="fc-tag">FactCheck.org</a>
        <a href="https://www.reuters.com/fact-check/" target="_blank" class="fc-tag">Reuters Fact Check</a>
        <a href="https://news.sbs.co.kr/news/newsVodMain.do?menuType=13" target="_blank" class="fc-tag">SBS 팩트체크</a>
        <a href="https://www.yonhapnewstv.co.kr/newsdetail/main" target="_blank" class="fc-tag">연합뉴스</a>
      </div>
      <p style="font-size:12px;color:var(--text3);margin-top:8px">* 출처: 국제팩트체킹네트워크(IFCN) 인증 기관들입니다</p>
    </div>`;

  container.innerHTML = html;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Chat ───
function addChatMessage(role, content) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <div class="msg-avatar">${role === 'user' ? '👤' : '🔍'}</div>
    <div class="msg-content">${content}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg assistant msg-typing';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-avatar">🔍</div>
    <div class="msg-content">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() {
  document.getElementById('typing-indicator')?.remove();
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  addChatMessage('user', escapeHtml(message));
  showTyping();

  // Switch to chat tab
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-chat')?.classList.add('active');
  document.querySelectorAll('.rtab')[2]?.classList.add('active');

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        reportId: currentReportId,
        history: []
      })
    });
    const data = await resp.json();
    removeTyping();
    if (data.response) addChatMessage('assistant', data.response);
  } catch (err) {
    removeTyping();
    addChatMessage('assistant', '죄송합니다, 응답 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
}

// ─── Report Generation ───
function renderReport(analysis, reportId) {
  const container = document.getElementById('report-container');
  const { scores, covariance, gradient, saturation, luminance, dimensions } = analysis;
  const prob = parseInt(scores.aiProbability);

  const verdictColor = scores.verdict === 'LIKELY_REAL' ? 'var(--green)' :
                       scores.verdict === 'UNCERTAIN' ? 'var(--orange)' : 'var(--red)';
  const verdictKo = scores.verdict === 'LIKELY_REAL' ? '실제 사진 가능성 높음' :
                    scores.verdict === 'UNCERTAIN' ? '불확실 — 추가 검증 필요' : 'AI 생성 가능성 높음';

  container.innerHTML = `
    <div class="report-header">
      <div>
        <div class="report-logo">🔍 Fact Maze</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px">AI 허위 이미지 탐지 보고서</div>
      </div>
      <div class="report-meta">
        <div>보고서 ID: <strong>${reportId.slice(0,8).toUpperCase()}</strong></div>
        <div>분석 시각: ${new Date().toLocaleString('ko-KR')}</div>
        <div>분석 해상도: ${dimensions.analyzed}</div>
        <div>데이터 출처: Luminance/Gradient PCA 알고리즘</div>
      </div>
    </div>

    <div class="report-section">
      <h3>최종 판정</h3>
      <div class="report-verdict-box" style="background:${verdictColor}22;border:1px solid ${verdictColor};color:${verdictColor}">
        ${scores.verdict === 'LIKELY_REAL' ? '✅' : scores.verdict === 'UNCERTAIN' ? '⚠️' : '🚨'} 
        ${verdictKo}
        <span style="margin-left:16px;font-size:24px">${prob}% AI 확률</span>
      </div>
    </div>

    <div class="report-section">
      <h3>공분산 행렬 분석 (핵심 지표)</h3>
      <table class="report-table">
        <tr><td>공분산 C₀₀ (Gx 분산)</td><td>${covariance.C00}</td></tr>
        <tr><td>공분산 C₁₁ (Gy 분산)</td><td>${covariance.C11}</td></tr>
        <tr><td>공분산 C₀₁ (교차 분산)</td><td>${covariance.C01}</td></tr>
        <tr><td>Trace(C) = C₀₀ + C₁₁</td><td><strong>${covariance.trace}</strong></td></tr>
        <tr><td>고유값 λ₁</td><td>${covariance.lambda1}</td></tr>
        <tr><td>고유값 λ₂</td><td>${covariance.lambda2}</td></tr>
        <tr><td>방향 이방성</td><td>${covariance.anisotropy}</td></tr>
      </table>
    </div>

    <div class="report-section">
      <h3>그라디언트 분석</h3>
      <table class="report-table">
        <tr><td>평균 그라디언트</td><td>${gradient.mean}</td></tr>
        <tr><td>그라디언트 표준편차</td><td>${gradient.std}</td></tr>
        <tr><td>고주파 비율</td><td>${gradient.highFreqRatio}</td></tr>
        <tr><td>밝기 평균 (Luminance)</td><td>${luminance.mean}</td></tr>
        <tr><td>밝기 표준편차</td><td>${luminance.std}</td></tr>
      </table>
    </div>

    <div class="report-section">
      <h3>색상 분석</h3>
      <table class="report-table">
        <tr><td>평균 채도</td><td>${saturation.mean}</td></tr>
        <tr><td>채도 표준편차</td><td>${saturation.std}</td></tr>
      </table>
    </div>

    <div class="report-section">
      <h3>점수 요약</h3>
      <table class="report-table">
        <tr><td>AI 의심도 점수</td><td>${scores.aiScore}%</td></tr>
        <tr><td>AI 생성 확률 (종합)</td><td><strong style="color:${verdictColor}">${scores.aiProbability}%</strong></td></tr>
        <tr><td>노이즈 점수</td><td>${scores.noiseScore}%</td></tr>
        <tr><td>패턴 불규칙성</td><td>${scores.patternIrregularity}%</td></tr>
      </table>
    </div>

    <div style="font-size:11px;color:var(--text3);border-top:1px solid var(--border);padding-top:16px;margin-top:8px;line-height:1.8">
      <strong>면책 조항:</strong> 본 보고서는 알고리즘 기반 분석 결과이며 최종 판단의 참고 자료입니다. 
      이미지 조작 여부의 최종 확인은 전문가 검토 및 다중 소스 검증이 필요합니다.<br/>
      <strong>알고리즘 출처:</strong> Luminance 변환(BT.709), Sobel Gradient, 공분산 행렬 PCA 분석<br/>
      <strong>뉴스 데이터:</strong> GDELT Project, DuckDuckGo Instant Answers API<br/>
      <strong>팩트체크 기관:</strong> IFCN(국제팩트체킹네트워크) 인증 기관 링크 제공
    </div>
  `;
}

// ─── Export ───
async function exportReport() {
  if (!currentReportId) { showToast('먼저 이미지를 분석하세요', 'warning'); return; }
  window.open(`/api/export/${currentReportId}`, '_blank');
  showToast('📥 보고서 다운로드 시작', 'success');
}

function copyReportLink() {
  if (!currentReportId) { showToast('먼저 이미지를 분석하세요', 'warning'); return; }
  const url = `${location.origin}/api/report/${currentReportId}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('🔗 보고서 링크가 복사되었습니다', 'success');
  }).catch(() => {
    showToast('링크: ' + url, 'info');
  });
}

// ─── Toast ───
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// ─── Add fadeIn animation ───
const style = document.createElement('style');
style.textContent = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;
document.head.appendChild(style);
