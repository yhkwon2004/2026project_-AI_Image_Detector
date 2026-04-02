/* ═══════════════════════════════════════════════════════════════
   FACT MAZE v6 — Application Logic
   물리적 특성 + GAN 판별자 + 외부검증 + 전쟁DB + 빅데이터 학습
   ═══════════════════════════════════════════════════════════════ */

window._app = (() => {

  // ── STATE ──
  const state = {
    currentPage: 'home',
    pageHistory: ['home'],
    currentFile: null,
    reportId: null,
    analysis: null,
    externalChecks: null,
    ws: null,
    wsRetries: 0
  };

  const PAGE_ORDER = ['home', 'analyze', 'learning', 'algorithm', 'about'];

  // 분석 단계 목록 (10단계 v5)
  const ANALYSIS_STEPS = [
    'EXIF & AI 메타데이터 분석',
    '휘도 추출 (BT.709) & 히스토그램',
    'Sobel 그라디언트 & 공분산 행렬',
    'ELA — 압축 오류 레벨 분석',
    'DCT 주파수 스펙트럼',
    'PRNU 카메라 센서 노이즈',
    'GAN 아티팩트 탐지',
    '확산 모델(Diffusion) 특성',
    '채도 & 블록 주파수',
    'GAN 판별자 최종 판정'
  ];

  // ══════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
    initOverlay();
    initNav();
    initDrop();
    initCursorGlow();
    initHeroCanvas();
    initCounters();
    initScrollHint();
    initScrollReveal();
    initWebSocket();
    initHeaderScroll();
    initChatQuickReplies();
    fetchServerStatus();
    fetchGANStatus();
    setInterval(fetchServerStatus, 10000);
    setInterval(fetchGANStatus, 15000);
    setInterval(pollMLStatus, 20000);

    const homePage = document.getElementById('page-home');
    if (homePage) { homePage.style.display = 'block'; homePage.classList.add('active'); }

    // 알고리즘 페이지 캔버스
    setTimeout(initAlgorithmCanvases, 500);
  });

  // ══════════════════════════════════════════════
  //  PAGE TRANSITION
  // ══════════════════════════════════════════════
  function initOverlay() {
    if (document.getElementById('page-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'page-transition-overlay';
    overlay.id = 'page-overlay';
    document.body.appendChild(overlay);
  }

  function initNav() {
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.nav));
    });
  }

  function navigateTo(pageName) {
    if (pageName === state.currentPage) return;
    const oldPage = document.getElementById(`page-${state.currentPage}`);
    const newPage = document.getElementById(`page-${pageName}`);
    if (!newPage) return;

    const oldIdx = PAGE_ORDER.indexOf(state.currentPage);
    const newIdx = PAGE_ORDER.indexOf(pageName);
    const direction = newIdx > oldIdx ? 'slide-left' : 'slide-right';

    const overlay = document.getElementById('page-overlay');
    if (overlay) { overlay.classList.add('flash'); setTimeout(() => overlay.classList.remove('flash'), 300); }

    if (oldPage) {
      oldPage.classList.add(direction === 'slide-left' ? 'exit-left' : 'exit-right');
      setTimeout(() => { oldPage.style.display = 'none'; oldPage.classList.remove('active','exit-left','exit-right'); }, 300);
    }
    state.currentPage = pageName;
    state.pageHistory.push(pageName);
    document.querySelectorAll('.nv').forEach(b => b.classList.toggle('active', b.dataset.nav === pageName));
    newPage.style.display = 'block';
    newPage.classList.add(direction === 'slide-left' ? 'enter-right' : 'enter-left');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        newPage.classList.add('active');
        newPage.classList.remove('enter-right','enter-left');
      });
    });
    window.scrollTo(0, 0);
    if (pageName === 'algorithm') setTimeout(initAlgorithmCanvases, 200);
    if (pageName === 'learning')  setTimeout(initLearningPage, 200);
  }

  // ══════════════════════════════════════════════
  //  DROP ZONE
  // ══════════════════════════════════════════════
  function initDrop() {
    const dz       = document.getElementById('dz');
    const fileIn   = document.getElementById('file-in');
    const btnChoose= document.getElementById('btn-choose');
    const btnRm    = document.getElementById('btn-rm');

    if (!dz) return;

    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files[0]) handleFile(files[0]);
    });
    dz.addEventListener('click', e => {
      if (!e.target.closest('#btn-rm') && !e.target.closest('#btn-choose') && !e.target.closest('#dz-preview')) {
        fileIn.click();
      }
    });
    if (btnChoose) btnChoose.addEventListener('click', e => { e.stopPropagation(); fileIn.click(); });
    if (btnRm) btnRm.addEventListener('click', e => { e.stopPropagation(); clearFile(); });
    if (fileIn) fileIn.addEventListener('change', () => { if (fileIn.files[0]) handleFile(fileIn.files[0]); });
  }

  function handleFile(file) {
    const ALLOWED = ['image/jpeg','image/png','image/webp','image/gif'];
    if (!ALLOWED.includes(file.type)) { showToast('❌ JPG·PNG·WebP·GIF 파일만 지원됩니다'); return; }
    if (file.size > 30 * 1024 * 1024)  { showToast('❌ 파일 크기가 30MB를 초과합니다'); return; }
    state.currentFile = file;

    const idle    = document.getElementById('dz-idle');
    const preview = document.getElementById('dz-preview');
    const img     = document.getElementById('prev-img');
    const name    = document.getElementById('prev-name');
    const size    = document.getElementById('prev-size');

    const reader = new FileReader();
    reader.onload = e => { if (img) img.src = e.target.result; };
    reader.readAsDataURL(file);

    if (name) name.textContent = file.name;
    if (size) size.textContent = (file.size / 1024).toFixed(1) + ' KB';
    if (idle) idle.style.display = 'none';
    if (preview) preview.style.display = 'flex';

    const btn = document.getElementById('btn-analyze');
    if (btn) btn.disabled = false;
  }

  function clearFile() {
    state.currentFile = null;
    const idle    = document.getElementById('dz-idle');
    const preview = document.getElementById('dz-preview');
    if (idle) idle.style.display = 'block';
    if (preview) preview.style.display = 'none';
    const fileIn = document.getElementById('file-in');
    if (fileIn) fileIn.value = '';
    const btn = document.getElementById('btn-analyze');
    if (btn) btn.disabled = true;
  }

  // ══════════════════════════════════════════════
  //  ANALYZE — 메인 분석 함수
  // ══════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-analyze');
    if (btn) btn.addEventListener('click', runAnalysis);
  });

  async function runAnalysis() {
    if (!state.currentFile) return;
    const baLoad = document.getElementById('ba-load');
    const baTxt  = document.getElementById('ba-txt');
    const btn    = document.getElementById('btn-analyze');
    if (baLoad) baLoad.style.display = 'flex';
    if (baTxt)  baTxt.style.display  = 'none';
    if (btn)    btn.disabled          = true;

    showProgress();

    const fd = new FormData();
    fd.append('image', state.currentFile);

    try {
      const res  = await fetch('/api/analyze', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '분석 실패');
      state.reportId       = data.reportId;
      state.analysis       = data.analysis;
      state.externalChecks = data.externalChecks || [];
      showResults(data.analysis, data.externalChecks);

      // 키워드가 있으면 자동 팩트체크
      const qInput = document.getElementById('qinput');
      if (qInput?.value.trim()) runWebVerify(qInput.value.trim());
    } catch(err) {
      showToast('❌ 분석 오류: ' + err.message);
      hideProgress();
    } finally {
      if (baLoad) baLoad.style.display = 'none';
      if (baTxt)  baTxt.style.display  = 'flex';
      if (btn)    btn.disabled          = false;
    }
  }

  // ── 진행 화면 표시 ──
  function showProgress() {
    document.getElementById('az-empty')?.style.setProperty('display','none');
    document.getElementById('az-results')?.style.setProperty('display','none');
    const prog = document.getElementById('az-progress');
    if (prog) prog.style.display = 'block';

    const stepsEl = document.getElementById('prog-steps');
    if (stepsEl) {
      stepsEl.innerHTML = ANALYSIS_STEPS.map((s, i) =>
        `<div class="prog-step-item" id="psi-${i}">
          <div class="prog-step-dot"></div>
          <span>${i+1}. ${s}</span>
        </div>`
      ).join('');
    }

    let current = 0;
    const interval = setInterval(() => {
      if (current < ANALYSIS_STEPS.length) {
        if (current > 0) {
          const prev = document.getElementById(`psi-${current-1}`);
          if (prev) prev.className = 'prog-step-item done';
        }
        const cur = document.getElementById(`psi-${current}`);
        if (cur) cur.className = 'prog-step-item active';
        const pct = Math.round((current / ANALYSIS_STEPS.length) * 90);
        const fill = document.getElementById('pb-fill');
        if (fill) fill.style.width = pct + '%';
        const label = document.getElementById('prog-label');
        if (label) label.textContent = `단계 ${current+1}/${ANALYSIS_STEPS.length}: ${ANALYSIS_STEPS[current]}...`;
        current++;
      } else {
        clearInterval(interval);
      }
    }, 280);
    state._progressInterval = interval;
  }

  function hideProgress() {
    if (state._progressInterval) clearInterval(state._progressInterval);
    document.getElementById('az-progress')?.style.setProperty('display','none');
  }

  // ══════════════════════════════════════════════
  //  RESULTS DISPLAY
  // ══════════════════════════════════════════════
  function showResults(analysis, externalChecks) {
    hideProgress();
    // 완료 진행 표시
    const fill = document.getElementById('pb-fill');
    if (fill) fill.style.width = '100%';
    ANALYSIS_STEPS.forEach((_, i) => {
      const el = document.getElementById(`psi-${i}`);
      if (el) el.className = 'prog-step-item done';
    });

    setTimeout(() => {
      document.getElementById('az-progress')?.style.setProperty('display','none');
      const res = document.getElementById('az-results');
      if (res) res.style.display = 'block';

      renderVerdict(analysis);
      renderSteps(analysis);
      renderMetrics(analysis);
      renderGANTab(analysis);
      renderExternalChecks(externalChecks);
      renderReport(analysis);

      // 외부 검증 탭으로 자동 이동 (AI 확정 시)
      if (analysis.scores?.verdict === 'CONFIRMED_AI') {
        setTimeout(() => switchTab('external'), 800);
      }
    }, 500);
  }

  // ── 판정 배너 ──
  function renderVerdict(analysis) {
    const s = analysis.scores;
    const prob = parseInt(s.aiProbability);
    const verdict = s.verdict;

    const vrdEl = document.getElementById('verdict');
    if (vrdEl) {
      vrdEl.className = 'verdict';
      if (verdict === 'CONFIRMED_AI') vrdEl.classList.add('confirmed-ai');
      else if (verdict === 'LIKELY_AI') vrdEl.classList.add('likely-ai');
      else if (verdict === 'UNCERTAIN') vrdEl.classList.add('uncertain');
      else vrdEl.classList.add('likely-real');
    }

    const icons = { CONFIRMED_AI: '🔴', LIKELY_AI: '🟠', UNCERTAIN: '🟡', LIKELY_REAL: '🟢' };
    const titles = {
      CONFIRMED_AI: 'AI 생성 확정',
      LIKELY_AI: 'AI 생성 가능성 높음',
      UNCERTAIN: '불확실 — 추가 검증 필요',
      LIKELY_REAL: '실제 사진 가능성 높음'
    };
    const subs = {
      CONFIRMED_AI: `메타데이터에 AI 도구 시그니처 확인됨 | AI 확률 ${prob}% | 신뢰도: ${s.confidence}`,
      LIKELY_AI: `복수 물리 지표에서 AI 생성 패턴 탐지 | AI 확률 ${prob}% | GAN 판별자: ${s.ganProbability}%`,
      UNCERTAIN: `복합적 신호 — 외부 검증 권장 | AI 확률 ${prob}% | 근거 ${s.totalIndicators}개`,
      LIKELY_REAL: `자연 이미지 물리 특성 감지 | AI 확률 ${prob}% | GAN 판별자: ${s.ganProbability}%`
    };

    const icon  = document.getElementById('vrd-icon');
    const title = document.getElementById('vrd-title');
    const sub   = document.getElementById('vrd-sub');
    if (icon)  icon.textContent  = icons[verdict]  || '❓';
    if (title) title.textContent = titles[verdict] || verdict;
    if (sub)   sub.textContent   = subs[verdict]   || '';

    // AI 확정 배너 표시
    if (analysis.aiMetaSigs?.isConfirmedAI && analysis.aiMetaSigs.detected?.length > 0) {
      const detectedTools = analysis.aiMetaSigs.detected.map(d => d.tool).join(', ');
      if (sub) sub.innerHTML = `<span class="meta-ai-badge">⚠️ ${detectedTools} 감지됨</span> 메타데이터에서 AI 도구 직접 확인`;
    }

    // 게이지 애니메이션
    const gvNum = document.getElementById('gv-num');
    const gaugeArc = document.getElementById('gauge-arc');
    if (gvNum && gaugeArc) {
      const circumference = 2 * Math.PI * 58; // r=58
      let current = 0;
      const interval = setInterval(() => {
        current = Math.min(current + 2, prob);
        gvNum.textContent = current;
        const offset = circumference * (1 - current / 100);
        gaugeArc.style.strokeDasharray = circumference;
        gaugeArc.style.strokeDashoffset = offset;
        const hue = 120 - (current * 1.2);
        gaugeArc.style.stroke = `hsl(${hue}, 90%, 55%)`;
        if (current >= prob) clearInterval(interval);
      }, 20);
    }
  }

  // ── 10단계 분석 목록 ──
  function renderSteps(analysis) {
    const el = document.getElementById('step-list');
    if (!el) return;
    el.innerHTML = (analysis.steps || []).map(s => {
      const signalClass = s.aiSignal || 'LOW';
      const signalLabel = { HIGH: '🚨 HIGH', MEDIUM: '⚠️ MED', LOW: '✅ LOW' }[signalClass] || '';
      return `
        <div class="step-item">
          <div class="si-num">STEP ${s.step}</div>
          <div class="si-content">
            <div class="si-name">
              ${s.name}
              <span class="step-signal ${signalClass}">${signalLabel}</span>
            </div>
            <div class="si-detail">${s.detail}</div>
            <div class="si-src">📚 ${s.source}</div>
          </div>
        </div>`;
    }).join('');

    // 판정 근거
    const reasonsEl = document.getElementById('reasons-box');
    if (reasonsEl) {
      const reasons = analysis.scores?.reasons || [];
      if (reasons.length > 0) {
        reasonsEl.innerHTML = `
          <div class="rb-title">🔍 판정 근거 (${reasons.length}개 지표)</div>
          ${reasons.map(r => `<div class="rb-item">${r}</div>`).join('')}`;
      }
    }
  }

  // ── 물리 지표 탭 ──
  function renderMetrics(analysis) {
    const el = document.getElementById('metrics-g');
    if (!el) return;

    const metrics = [
      { label: 'AI 확률', val: analysis.scores?.aiProbability + '%', color: getScoreColor(parseInt(analysis.scores?.aiProbability)), bar: parseInt(analysis.scores?.aiProbability) },
      { label: 'GAN 판별자', val: analysis.scores?.ganProbability + '%', color: getScoreColor(parseInt(analysis.scores?.ganProbability)), bar: parseInt(analysis.scores?.ganProbability) },
      { label: 'Trace(C)', val: analysis.covariance?.trace, color: parseFloat(analysis.covariance?.trace) < 500 ? '#ff3366' : parseFloat(analysis.covariance?.trace) < 1200 ? '#ff9900' : '#00ff88', bar: Math.min(100, parseFloat(analysis.covariance?.trace) / 50) },
      { label: '이방성', val: analysis.covariance?.anisotropy, color: analysis.covariance?.anisotropy, bar: parseFloat(analysis.covariance?.anisotropy) },
      { label: 'ELA 평균', val: analysis.ela?.mean?.toFixed ? analysis.ela.mean.toFixed(3) : analysis.ela?.mean, color: parseFloat(analysis.ela?.mean) < 1 ? '#ff3366' : '#00ff88', bar: Math.min(100, parseFloat(analysis.ela?.mean) * 20) },
      { label: 'DCT 고주파', val: analysis.dct ? (analysis.dct.highRatio * 100).toFixed(1) + '%' : '—', color: analysis.dct?.highRatio < 0.05 ? '#ff3366' : '#00ff88', bar: analysis.dct ? analysis.dct.highRatio * 100 * 5 : 50 },
      { label: 'PRNU 첨도', val: analysis.prnu?.kurtosis, color: parseFloat(analysis.prnu?.kurtosis) > 6 ? '#ff9900' : '#00ff88', bar: Math.min(100, parseFloat(analysis.prnu?.kurtosis) * 10) },
      { label: '채도 σ', val: analysis.saturation?.std, color: parseFloat(analysis.saturation?.std) < 0.06 ? '#ff3366' : '#00ff88', bar: parseFloat(analysis.saturation?.std) * 500 },
      { label: '블록 불규칙', val: analysis.blockFreq, color: parseFloat(analysis.blockFreq) < 5 ? '#ff9900' : '#00ff88', bar: Math.min(100, parseFloat(analysis.blockFreq) * 3) },
      { label: '히스토그램 χ²', val: analysis.luminance?.histChi2, color: parseFloat(analysis.luminance?.histChi2) > 5000 ? '#ff9900' : '#00ff88', bar: Math.min(100, parseFloat(analysis.luminance?.histChi2) / 100) },
      { label: '밝기 Mean', val: analysis.luminance?.mean, color: '#00d4ff', bar: parseFloat(analysis.luminance?.mean) / 2.55 },
      { label: '밝기 σ', val: analysis.luminance?.std, color: '#7b2fff', bar: parseFloat(analysis.luminance?.std) }
    ];

    el.innerHTML = metrics.map(m => `
      <div class="metric-card">
        <div class="mc-label">${m.label}</div>
        <div class="mc-val" style="color:${m.color || '#00d4ff'}">${m.val ?? '—'}</div>
        <div class="mc-track">
          <div class="mc-fill" style="width:${Math.max(0,Math.min(100,m.bar||0)).toFixed(1)}%;background:${m.color||'#00d4ff'}"></div>
        </div>
      </div>`).join('');

    // 공분산 행렬 시각화
    const matEl = document.getElementById('matrix-vis');
    if (matEl && analysis.covariance) {
      const c = analysis.covariance;
      matEl.innerHTML = `
        <div class="mv-title">공분산 행렬 C = (1/N)·MᵀM</div>
        <div class="mv-matrix">
          <div class="mv-row">
            <div class="mv-cell" title="수평 그라디언트 분산">C₀₀ = ${c.C00}</div>
            <div class="mv-cell" title="교차 공분산">C₀₁ = ${c.C01}</div>
          </div>
          <div class="mv-row">
            <div class="mv-cell" title="교차 공분산">C₁₀ = ${c.C01}</div>
            <div class="mv-cell" title="수직 그라디언트 분산">C₁₁ = ${c.C11}</div>
          </div>
        </div>
        <div class="mv-eigen">
          <span>λ₁ = <strong>${c.lambda1}</strong></span>
          <span>λ₂ = <strong>${c.lambda2}</strong></span>
          <span>Trace = <strong>${c.trace}</strong></span>
          <span>이방성 = <strong>${c.anisotropy}</strong></span>
        </div>`;
    }

    // 레이더 차트
    drawRadarChart(analysis);
  }

  // ── 레이더 차트 ──
  function drawRadarChart(analysis) {
    const canvas = document.getElementById('radar-chart');
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    const cx = 150, cy = 150, r = 110;

    const indicators = [
      { label: 'Trace', val: Math.min(1, 1 - parseFloat(analysis.covariance?.trace || 2500) / 5000) },
      { label: '이방성', val: Math.min(1, 1 - parseFloat(analysis.covariance?.anisotropy || '50') / 100) },
      { label: 'ELA', val: Math.min(1, 1 - parseFloat(analysis.ela?.mean || 3) / 5) },
      { label: 'DCT', val: Math.min(1, 1 - (analysis.dct?.highRatio || 0.1) * 10) },
      { label: 'PRNU', val: Math.min(1, parseFloat(analysis.prnu?.kurtosis || 3) / 10) },
      { label: '채도', val: Math.min(1, 1 - parseFloat(analysis.saturation?.std || 0.1) * 5) },
      { label: 'GAN', val: analysis.ganArtifacts?.isCheckerboard ? 0.9 : 0.2 },
      { label: '확산', val: (analysis.diffusion?.isLowColorDiversity ? 0.5 : 0) + (analysis.diffusion?.isUniformTexture ? 0.5 : 0) }
    ];
    const n = indicators.length;

    ctx.clearRect(0, 0, 300, 300);

    // 배경 그리드
    for (let ring = 1; ring <= 5; ring++) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const x = cx + r * (ring / 5) * Math.cos(angle);
        const y = cy + r * (ring / 5) * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 축선
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      ctx.strokeStyle = 'rgba(255,255,255,.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 레이블
      const lx = cx + (r + 18) * Math.cos(angle);
      const ly = cy + (r + 18) * Math.sin(angle);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(indicators[i].label, lx, ly);
    }

    // AI 신호 영역
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const val   = Math.max(0, Math.min(1, indicators[i].val));
      const x = cx + r * val * Math.cos(angle);
      const y = cy + r * val * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    const avgVal = indicators.reduce((a, b) => a + b.val, 0) / n;
    const hue    = 120 - avgVal * 120;
    ctx.fillStyle   = `hsla(${hue},80%,55%,.25)`;
    ctx.strokeStyle = `hsla(${hue},80%,65%,.8)`;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // 점
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const val   = Math.max(0, Math.min(1, indicators[i].val));
      ctx.beginPath();
      ctx.arc(cx + r * val * Math.cos(angle), cy + r * val * Math.sin(angle), 4, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue},80%,65%,1)`;
      ctx.fill();
    }
  }

  // ── GAN 학습 탭 ──
  function renderGANTab(analysis) {
    const ganLearning = analysis.ganLearning;
    if (!ganLearning) return;

    const rounds   = document.getElementById('gan-rounds');
    const acc      = document.getElementById('gan-acc');
    const lrVal    = document.getElementById('gan-lr-val');
    const discProb = document.getElementById('gan-disc-prob');

    if (rounds)   rounds.textContent   = ganLearning.lastRound?.roundsCompleted || 0;
    if (acc)      acc.textContent      = ganLearning.lastRound?.accuracy || '—';
    if (lrVal)    lrVal.textContent    = ganLearning.lastRound?.learningRate || '—';
    if (discProb) discProb.textContent = ganLearning.discriminatorProb || '—';

    // 가중치 시각화
    const wEl = document.getElementById('gan-weights-vis');
    if (wEl && ganLearning.weights) {
      const w = ganLearning.weights;
      const entries = [
        { key: 'traceWeight',       label: 'Trace(C)       ', color: '#ff3366' },
        { key: 'anisoWeight',       label: '이방성          ', color: '#ff6633' },
        { key: 'gradStdWeight',     label: 'Grad σ         ', color: '#ff9900' },
        { key: 'elaWeight',         label: 'ELA            ', color: '#ffcc00' },
        { key: 'dctHighWeight',     label: 'DCT 고주파      ', color: '#00d4ff' },
        { key: 'prnu_kurtWeight',   label: 'PRNU 첨도       ', color: '#7b2fff' },
        { key: 'ganArtifactWeight', label: 'GAN 아티팩트    ', color: '#ff3399' },
        { key: 'diffusionWeight',   label: '확산 모델       ', color: '#33ccff' },
        { key: 'metadataWeight',    label: '메타데이터      ', color: '#00ff88' }
      ];
      wEl.innerHTML = entries.map(e => {
        const val = parseFloat(w[e.key] || 0);
        const pct = (val * 100).toFixed(1);
        return `
          <div class="gwv-row">
            <div class="gwv-label">${e.label}</div>
            <div class="gwv-track">
              <div class="gwv-fill" style="width:${pct}%;background:${e.color}"></div>
            </div>
            <div class="gwv-val" style="color:${e.color}">${val.toFixed(3)}</div>
          </div>`;
      }).join('');
    }

    // 사이드바 GAN 패널 업데이트
    const gspRounds = document.getElementById('gsp-rounds');
    const gspAcc    = document.getElementById('gsp-acc');
    const gspLr     = document.getElementById('gsp-lr');
    const gspW      = document.getElementById('gsp-weights');
    if (gspRounds) gspRounds.textContent = ganLearning.lastRound?.roundsCompleted || 0;
    if (gspAcc)    gspAcc.textContent    = ganLearning.lastRound?.accuracy || '—';
    if (gspLr)     gspLr.textContent     = parseFloat(ganLearning.lastRound?.learningRate || 0.05).toFixed(4);

    if (gspW && ganLearning.weights) {
      const topWeights = [
        { key: 'metadataWeight',    label: 'Meta' },
        { key: 'traceWeight',       label: 'Trace' },
        { key: 'diffusionWeight',   label: 'Diffusion' },
        { key: 'ganArtifactWeight', label: 'GAN' }
      ];
      gspW.innerHTML = topWeights.map(e => {
        const val = parseFloat(ganLearning.weights[e.key] || 0);
        return `
          <div class="gsp-weight-bar">
            <div class="gsp-w-label">${e.label}</div>
            <div class="gsp-w-track"><div class="gsp-w-fill" style="width:${(val*100).toFixed(0)}%"></div></div>
            <div class="gsp-w-val">${val.toFixed(3)}</div>
          </div>`;
      }).join('');
    }
  }

  // ── 외부 검증 사이트 탭 ──
  function renderExternalChecks(checks) {
    const el = document.getElementById('ext-results');
    if (!el) return;

    if (!checks || checks.length === 0) {
      el.innerHTML = '<div class="ext-placeholder">외부 검증 사이트 정보를 불러오는 중...</div>';
      return;
    }

    const icons = {
      'Hive AI Moderation':          '🐝',
      'FotoForensics ELA':           '🔬',
      'Illuminarty':                  '💡',
      'AI or Not':                    '🤖',
      'Google SynthID Checker':      '🌐',
      'Content Credentials Verify':  '🔏',
      'Hugging Face — AI Image Detector': '🤗',
      'DuckDuckGo 역방향 이미지 검색': '🦆',
      'TinEye 역방향 검색':           '🔍',
      'GDELT 전지구 미디어 DB':       '📰'
    };

    const aiProb    = parseInt(state.analysis?.scores?.aiProbability || 0);
    const isConfirmed = state.analysis?.scores?.verdict === 'CONFIRMED_AI';

    el.innerHTML = `
      <div style="margin-bottom:14px;padding:10px 14px;background:rgba(0,212,255,.07);border:1px solid rgba(0,212,255,.2);border-radius:10px;font-size:12px;color:var(--c1)">
        💡 <strong>내부 분석 결과:</strong> AI 확률 ${aiProb}% ${isConfirmed ? '🔴 <strong>AI 생성 확정</strong> — 메타데이터 시그니처 발견' : ''}<br/>
        아래 전문 사이트에서 교차 검증을 통해 정확도를 높이세요.
      </div>
      ${checks.map(c => {
        const icon = icons[c.service] || '🔗';
        const isAI = isConfirmed;
        return `
          <div class="ext-card ${isAI ? 'confirmed-ai' : ''}">
            <div class="ext-card-icon">${icon}</div>
            <div class="ext-card-body">
              <div class="ext-card-name">${c.service}</div>
              <div class="ext-card-desc">${c.description}</div>
              ${c.instruction ? `<div class="ext-card-note">${c.instruction}</div>` : ''}
              ${c.note ? `<div class="ext-card-note ${isAI ? 'ai-confirmed' : ''}">${c.note}</div>` : ''}
              ${c.relatedNews ? `
                <div style="margin-top:6px">
                  ${c.relatedNews.slice(0,2).map(n => `<div style="font-size:10px;color:var(--t3);margin-top:3px">📰 <a href="${n.url}" target="_blank" style="color:var(--c1)">${n.title?.slice(0,80)}</a></div>`).join('')}
                </div>` : ''}
              <a href="${c.url}" target="_blank" class="ext-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                사이트 열기
              </a>
            </div>
          </div>`;
      }).join('')}`;
  }

  // ── 보고서 탭 ──
  function renderReport(analysis) {
    const el = document.getElementById('report-body');
    if (!el) return;

    const s = analysis.scores;
    const ts = new Date().toLocaleString('ko-KR');

    el.innerHTML = `
      <div class="rb-sec">
        <div class="rbs-title">📋 분석 요약</div>
        <div class="rbs-row"><span>분석 시각</span><span>${ts}</span></div>
        <div class="rbs-row"><span>원본 해상도</span><span>${analysis.dimensions?.width}×${analysis.dimensions?.height} (${analysis.dimensions?.format?.toUpperCase()})</span></div>
        <div class="rbs-row"><span>분석 해상도</span><span>${analysis.dimensions?.analyzed}</span></div>
        <div class="rbs-row"><span>AI 확률</span><span style="color:${getScoreColor(parseInt(s?.aiProbability))};font-weight:700">${s?.aiProbability}%</span></div>
        <div class="rbs-row"><span>GAN 판별자</span><span>${s?.ganProbability}%</span></div>
        <div class="rbs-row"><span>판정</span><span style="font-weight:700">${s?.verdictLabel || s?.verdict}</span></div>
        <div class="rbs-row"><span>신뢰도</span><span>${s?.confidence}</span></div>
        <div class="rbs-row"><span>메타데이터 AI 확인</span><span style="color:${analysis.aiMetaSigs?.isConfirmedAI?'#ff3366':'#00ff88'}">${analysis.aiMetaSigs?.isConfirmedAI ? '⚠️ 예' : '✅ 아니오'}</span></div>
      </div>

      <div class="rb-sec">
        <div class="rbs-title">🔢 핵심 수치</div>
        <div class="rbs-row"><span>Trace(C)</span><span>${analysis.covariance?.trace}</span></div>
        <div class="rbs-row"><span>이방성</span><span>${analysis.covariance?.anisotropy}</span></div>
        <div class="rbs-row"><span>ELA 평균</span><span>${analysis.ela?.mean?.toFixed ? analysis.ela.mean.toFixed(4) : analysis.ela?.mean}</span></div>
        <div class="rbs-row"><span>DCT 고주파 비율</span><span>${analysis.dct ? (analysis.dct.highRatio*100).toFixed(2)+'%' : '—'}</span></div>
        <div class="rbs-row"><span>PRNU 첨도</span><span>${analysis.prnu?.kurtosis}</span></div>
        <div class="rbs-row"><span>PRNU 공간상관</span><span>${analysis.prnu?.spatialCorr}</span></div>
        <div class="rbs-row"><span>색상 다양성</span><span>${analysis.diffusion?.colorDiversity}</span></div>
        <div class="rbs-row"><span>채도 σ</span><span>${analysis.saturation?.std}</span></div>
        <div class="rbs-row"><span>블록 불규칙성</span><span>${analysis.blockFreq}</span></div>
      </div>

      ${analysis.aiMetaSigs?.detected?.length > 0 ? `
      <div class="rb-sec" style="border-color:rgba(255,51,102,.3)">
        <div class="rbs-title" style="color:var(--red)">🔴 AI 메타데이터 시그니처 감지</div>
        ${analysis.aiMetaSigs.detected.map(d => `
          <div class="rbs-row" style="color:var(--red)">
            <span>${d.tool}</span><span>"${d.signature}" 감지</span>
          </div>`).join('')}
      </div>` : ''}

      <div class="rb-sec">
        <div class="rbs-title">🔍 판정 근거 (${s?.reasons?.length || 0}개)</div>
        ${(s?.reasons || []).map(r => `<div style="font-size:11px;padding:4px 0;border-bottom:1px solid var(--bd);color:var(--t2)">${r}</div>`).join('')}
      </div>`;
  }

  // ══════════════════════════════════════════════
  //  WEB VERIFY
  // ══════════════════════════════════════════════
  async function runWebVerify(query) {
    const input = document.getElementById('wc-input');
    if (!query) query = input?.value.trim();
    if (!query) return;

    const container = document.getElementById('wc-results');
    if (container) container.innerHTML = '<div class="wc-loading"><div class="spin"></div> 검색 중...</div>';

    try {
      const res  = await fetch('/api/webverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, reportId: state.reportId })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      renderWebResults(data.results, query);
    } catch(err) {
      if (container) container.innerHTML = `<div style="color:var(--red);padding:20px;text-align:center">검색 실패: ${err.message}</div>`;
    }
  }

  function renderWebResults(results, query) {
    const el = document.getElementById('wc-results');
    if (!el) return;

    if (!results || results.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t3)">검색 결과가 없습니다</div>';
      return;
    }

    const typeColors = { factcheck:'#ff3366', research:'#7b2fff', official:'#00d4ff', news:'#ff9900', tool:'#00ff88', investigation:'#ff6633', human_rights:'#ff3399', standard:'#00ccff', technology:'#33ffcc' };
    const typeLabels = { factcheck:'팩트체크', research:'연구', official:'공식기관', news:'뉴스', tool:'도구', investigation:'조사', human_rights:'인권', standard:'표준', technology:'기술' };

    el.innerHTML = `
      <div class="wc-query-info">🔍 "${query}" — ${results.length}개 결과</div>
      ${results.map(r => `
        <div class="wc-item">
          <div class="wci-top">
            <a href="${r.url}" target="_blank" class="wci-title">${r.title}</a>
            <div style="display:flex;gap:5px;align-items:center;flex-shrink:0">
              ${r.type ? `<span class="wci-type" style="background:${(typeColors[r.type]||'#666')}22;color:${typeColors[r.type]||'#aaa'};border:1px solid ${(typeColors[r.type]||'#666')}44">${typeLabels[r.type]||r.type}</span>` : ''}
              ${r.reliability === 'high' ? '<span class="wci-rel">✓ 신뢰</span>' : ''}
            </div>
          </div>
          <div class="wci-src">${r.source} ${r.lang ? '· '+r.lang : ''} ${r.country ? '· '+r.country : ''}</div>
          <div class="wci-snip">${r.snippet}</div>
          ${r.relatedNews ? r.relatedNews.map(n=>`<div class="wci-news">📰 <a href="${n.url}" target="_blank">${n.title?.slice(0,80)}</a></div>`).join('') : ''}
        </div>`).join('')}`;
  }

  // ── 웹 검증 초기화 ──
  document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('btn-search');
    if (searchBtn) searchBtn.addEventListener('click', () => runWebVerify());

    const wcInput = document.getElementById('wc-input');
    if (wcInput) wcInput.addEventListener('keydown', e => { if (e.key === 'Enter') runWebVerify(); });

    document.querySelectorAll('.wt').forEach(tag => {
      tag.addEventListener('click', () => {
        const q = tag.dataset.q;
        const inp = document.getElementById('wc-input');
        if (inp) inp.value = q;
        runWebVerify(q);
        switchTab('webcheck');
      });
    });
  });

  // ══════════════════════════════════════════════
  //  CHAT
  // ══════════════════════════════════════════════
  async function sendChat() {
    const input = document.getElementById('chat-input');
    if (!input?.value.trim()) return;
    const msg = input.value.trim();
    input.value = '';

    addChatMsg(msg, 'user');

    try {
      const res  = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, reportId: state.reportId })
      });
      const data = await res.json();
      if (data.success) addChatMsg(data.response, 'bot');
    } catch(err) {
      addChatMsg('연결 오류가 발생했습니다.', 'bot');
    }
  }

  function addChatMsg(text, role) {
    const msgs = document.getElementById('chat-msgs');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    const formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');
    div.innerHTML = `
      <div class="cm-avatar">${role === 'bot' ? '🔍' : '👤'}</div>
      <div class="cm-bubble">${formatted}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function initChatQuickReplies() {
    document.querySelectorAll('.cq-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.q;
        const input = document.getElementById('chat-input');
        if (input) input.value = q;
        sendChat();
        switchTab('chat');
      });
    });
  }

  // ══════════════════════════════════════════════
  //  TABS
  // ══════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.rt').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  });

  function switchTab(tabName) {
    document.querySelectorAll('.rt').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const pane = document.getElementById(`tab-${tabName}`);
    if (pane) pane.classList.add('active');
  }

  // ══════════════════════════════════════════════
  //  SERVER STATUS & GAN STATUS
  // ══════════════════════════════════════════════
  async function fetchServerStatus() {
    try {
      const res  = await fetch('/api/health');
      const data = await res.json();
      updateStatusBadge(data.status === 'online', data.uptime, data.analyses, data.activeSessions);
    } catch(e) {
      updateStatusBadge(false, 0, 0, 0);
    }
  }

  async function fetchGANStatus() {
    try {
      const res  = await fetch('/api/gan-status');
      const data = await res.json();

      const gspRounds = document.getElementById('gsp-rounds');
      const gspAcc    = document.getElementById('gsp-acc');
      const gspLr     = document.getElementById('gsp-lr');
      if (gspRounds) gspRounds.textContent = data.roundsCompleted || 0;
      if (gspAcc)    gspAcc.textContent    = data.accuracy || '—';
      if (gspLr)     gspLr.textContent     = parseFloat(data.learningRate || 0.05).toFixed(4);
    } catch(e) {}
  }

  function updateStatusBadge(online, uptime, analyses, sessions) {
    const dot   = document.getElementById('srv-dot');
    const label = document.getElementById('srv-label');
    const sub   = document.getElementById('srv-sub');
    const stats = document.getElementById('srv-stats');
    const lsAn  = document.getElementById('ls-analyses');
    const lsUp  = document.getElementById('ls-uptime');

    if (dot)   dot.className   = `srv-dot ${online ? 'online' : 'offline'}`;
    if (label) label.textContent = online ? '서버 온라인' : '서버 오프라인';
    if (sub)   sub.textContent   = online ? `${Math.floor(uptime/60)}분 운영 중` : '연결 끊김';
    if (stats) stats.innerHTML  = `<span id="stat-analyses">${analyses}</span> 분석 <span id="stat-sessions">${sessions}</span> 접속`;
    if (lsAn)  lsAn.textContent  = analyses;
    if (lsUp)  lsUp.textContent  = online ? `${Math.floor(uptime/60)}분` : '—';
  }

  // ══════════════════════════════════════════════
  //  EXPORT / COPY
  // ══════════════════════════════════════════════
  function exportReport() {
    if (!state.reportId) { showToast('먼저 이미지를 분석하세요'); return; }
    window.open(`/api/export/${state.reportId}`, '_blank');
  }

  function copyLink() {
    const url = `${location.origin}/api/report/${state.reportId}`;
    navigator.clipboard.writeText(url).then(() => showToast('✅ 링크가 클립보드에 복사되었습니다'));
  }

  // ══════════════════════════════════════════════
  //  WEBSOCKET
  // ══════════════════════════════════════════════
  function initWebSocket() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${location.host}`;
    try {
      state.ws = new WebSocket(wsUrl);
      state.ws.onmessage = e => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'analysis_complete') {
            showToast(`✅ 분석 완료 — ${msg.verdict} (AI ${msg.aiProb}%)`);
          }
        } catch(err) {}
      };
      state.ws.onerror = () => {};
      state.ws.onclose = () => {
        if (state.wsRetries < 3) {
          state.wsRetries++;
          setTimeout(initWebSocket, 3000);
        }
      };
    } catch(e) {}
  }

  // ══════════════════════════════════════════════
  //  HERO CANVAS
  // ══════════════════════════════════════════════
  function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - .5) * .6,
      vy: (Math.random() - .5) * .6,
      r: Math.random() * 2 + .5,
      color: Math.random() < .5 ? '#00D4FF' : Math.random() < .5 ? '#7B2FFF' : '#FF3366'
    }));

    (function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + '88';
        ctx.fill();
      });
      // 연결선
      particles.forEach((a, i) => {
        particles.slice(i+1).forEach(b => {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 80) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(0,212,255,${.15 * (1 - d/80)})`;
            ctx.lineWidth = .5;
            ctx.stroke();
          }
        });
      });
      requestAnimationFrame(loop);
    })();
  }

  // ══════════════════════════════════════════════
  //  CURSOR GLOW
  // ══════════════════════════════════════════════
  function initCursorGlow() {
    const glow = document.createElement('div');
    glow.id = 'cursor-glow';
    glow.style.cssText = 'position:fixed;pointer-events:none;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(0,212,255,.06),transparent 70%);transform:translate(-50%,-50%);z-index:1;transition:opacity .3s';
    document.body.appendChild(glow);
    document.addEventListener('mousemove', e => {
      glow.style.left = e.clientX + 'px';
      glow.style.top  = e.clientY + 'px';
    });
  }

  // ══════════════════════════════════════════════
  //  COUNTERS
  // ══════════════════════════════════════════════
  function initCounters() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el     = e.target;
        const target = parseInt(el.dataset.target);
        let current  = 0;
        const step   = target / 60;
        const timer  = setInterval(() => {
          current = Math.min(current + step, target);
          el.textContent = Math.floor(current);
          if (current >= target) clearInterval(timer);
        }, 16);
        observer.unobserve(el);
      });
    });
    document.querySelectorAll('[data-target]').forEach(el => observer.observe(el));
  }

  // ══════════════════════════════════════════════
  //  SCROLL REVEAL
  // ══════════════════════════════════════════════
  function initScrollReveal() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: .1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  function initScrollHint() {
    const hint = document.getElementById('scroll-hint');
    if (!hint) return;
    window.addEventListener('scroll', () => { if (window.scrollY > 50) hint.classList.add('hidden'); });
  }

  function initHeaderScroll() {
    window.addEventListener('scroll', () => {
      const hdr = document.getElementById('hdr');
      if (hdr) hdr.classList.toggle('scrolled', window.scrollY > 30);
    });
  }

  // ══════════════════════════════════════════════
  //  ALGORITHM CANVASES
  // ══════════════════════════════════════════════
  function initAlgorithmCanvases() {
    drawLumCanvas('c-lum-real', true);
    drawLumCanvas('c-lum-fake', false);
    drawGradCanvas('c-grad-real', true);
    drawGradCanvas('c-grad-fake', false);
    drawExifCanvas('c-exif-real', true);
    drawExifCanvas('c-exif-fake', false);
  }

  function drawLumCanvas(id, isReal) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    canvas.width = 240; canvas.height = 100;
    const ctx = canvas.getContext('2d');

    if (isReal) {
      // 자연 이미지 — 다양한 밝기 분포
      for (let x = 0; x < 240; x++) {
        const noise = (Math.sin(x * 0.1) * 30 + Math.sin(x * 0.3) * 20 + Math.random() * 40 + 80);
        ctx.fillStyle = `rgba(0,212,255,${noise/200})`;
        ctx.fillRect(x, 100 - noise/2, 1, noise/2);
      }
    } else {
      // AI 이미지 — 균일한 분포
      const base = 60;
      for (let x = 0; x < 240; x++) {
        const noise = base + Math.random() * 10;
        ctx.fillStyle = `rgba(255,51,102,${noise/200})`;
        ctx.fillRect(x, 100 - noise/2, 1, noise/2);
      }
    }
  }

  function drawGradCanvas(id, isReal) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    canvas.width = 240; canvas.height = 100;
    const ctx = canvas.getContext('2d');

    for (let x = 0; x < 240; x++) {
      for (let y = 0; y < 100; y++) {
        const v = isReal
          ? Math.abs(Math.sin(x * 0.2) * 60 + Math.random() * 40)
          : Math.random() * 20 + 10;
        ctx.fillStyle = `rgba(${isReal?'0,212,255':'255,51,102'},${Math.min(v/80, .8)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  function drawExifCanvas(id, isReal) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    canvas.width = 240; canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = isReal ? 'rgba(0,212,255,.05)' : 'rgba(255,51,102,.05)';
    ctx.fillRect(0, 0, 240, 100);

    const fields = isReal
      ? ['Make: Canon', 'Model: EOS R5', 'ISO: 400', 'f/2.8', '1/500s', 'GPS: 37.5°N']
      : ['Software: Stable Diffusion', 'AI-Generated', 'No GPS', 'No Camera', 'EXIF: N/A', 'Seed: 48291'];
    const color = isReal ? '#00D4FF' : '#FF3366';
    ctx.fillStyle = color;
    ctx.font = '9px monospace';
    fields.forEach((f, i) => ctx.fillText(f, 8, 14 + i * 14));
  }

  // ══════════════════════════════════════════════
  //  TOAST
  // ══════════════════════════════════════════════
  function showToast(msg) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.style.cssText = 'background:#1E2832;border:1px solid rgba(0,212,255,.3);border-radius:10px;padding:12px 16px;font-size:13px;color:#fff;box-shadow:0 4px 24px rgba(0,0,0,.5);animation:slideUp .3s ease;max-width:320px';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  // ══════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════
  function getScoreColor(prob) {
    if (prob >= 75) return '#ff3366';
    if (prob >= 40) return '#ff9900';
    return '#00ff88';
  }

  // ══════════════════════════════════════════════
  //  LEARNING PAGE
  // ══════════════════════════════════════════════

  const lp = {
    page:        1,
    perPage:     15,
    filter:      'all',
    labelFile:   null,
    initialized: false,
    logEntries:  []
  };

  function initLearningPage() {
    if (!document.getElementById('page-learning')) return;
    if (!lp.initialized) {
      setupLabelDropZone();
      setupLabelButtons();
      setupPipelineControls();
      setupTrainButton();
      setupDatasetBrowser();
      setupLogClear();
      lp.initialized = true;
    }
    refreshMLStatus();
    refreshDataset();
  }

  // ── ML Status ───────────────────────────────
  function refreshMLStatus() {
    fetch('/api/ml/status')
      .then(r => r.json())
      .then(data => {
        const st  = data.learning_state || {};
        const ds  = data;
        el('ml-status-dot').textContent    = data.ml_engine_ready !== false ? '🟢' : '🔴';
        el('ml-labeled-cnt').textContent   = st.labeled_samples || 0;
        el('ml-train-rounds').textContent  = st.training_rounds  || 0;
        const acc = st.accuracy || 0;
        el('ml-accuracy').textContent      = acc > 0 ? acc + '%' : '—';
        // dataset stats
        const fetched = data.fetch_stats || {};
        el('ml-real-cnt').textContent = fetched.real_fetched || 0;
        el('ml-ai-cnt').textContent   = fetched.ai_fetched   || 0;
        // pipeline log
        const logLines = (st.pipeline_log || []).slice(-10).reverse();
        if (logLines.length) {
          logLines.forEach(e => addLearningLog(e.event, JSON.stringify(e.detail || ''), 'info'));
        }
      })
      .catch(() => {
        el('ml-status-dot').textContent = '🔴';
      });
  }

  function pollMLStatus() {
    if (state.currentPage === 'learning') refreshMLStatus();
  }

  // ── Pipeline Controls ────────────────────────
  function setupPipelineControls() {
    const realSlider = document.getElementById('pipe-real');
    const aiSlider   = document.getElementById('pipe-ai');
    const realVal    = document.getElementById('pipe-real-val');
    const aiVal      = document.getElementById('pipe-ai-val');

    if (realSlider) realSlider.addEventListener('input', () => { realVal.textContent = realSlider.value; });
    if (aiSlider)   aiSlider.addEventListener('input',   () => { aiVal.textContent   = aiSlider.value; });

    const btn = document.getElementById('btn-run-pipeline');
    if (btn) btn.addEventListener('click', runPipeline);

    const refreshBtn = document.getElementById('btn-ml-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => {
      refreshMLStatus();
      refreshDataset();
    });
  }

  function runPipeline() {
    const btn       = document.getElementById('btn-run-pipeline');
    const realCount = parseInt(document.getElementById('pipe-real')?.value || '10');
    const aiCount   = parseInt(document.getElementById('pipe-ai')?.value   || '10');
    const autoTrain = document.getElementById('pipe-autotrain')?.checked    ?? true;

    if (btn) btn.disabled = true;
    addPipelineLog(`🚀 파이프라인 시작: 실제 ${realCount}개 + AI ${aiCount}개 수집 중...`, 'info');
    addLearningLog('pipeline', `파이프라인 시작 (real=${realCount}, ai=${aiCount}, train=${autoTrain})`, 'pipeline');

    fetch('/api/ml/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ real_count: realCount, ai_count: aiCount, auto_train: autoTrain })
    })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        addPipelineLog(`❌ 오류: ${data.error}`, 'error');
        addLearningLog('pipeline', `오류: ${data.error}`, 'error');
      } else {
        addPipelineLog(`✅ ${data.message}`, 'success');
        addLearningLog('pipeline', data.message, 'pipeline');
        // Poll for completion
        pollPipelineStatus(btn);
      }
    })
    .catch(e => {
      addPipelineLog(`❌ 요청 실패: ${e.message}`, 'error');
      if (btn) btn.disabled = false;
    });
  }

  function pollPipelineStatus(btn) {
    let polls = 0;
    const interval = setInterval(() => {
      polls++;
      fetch('/api/ml/status')
        .then(r => r.json())
        .then(data => {
          const st = data.learning_state || {};
          if (!st.is_training || polls > 30) {
            clearInterval(interval);
            if (btn) btn.disabled = false;
            const log = (st.pipeline_log || []).slice(-1)[0];
            if (log && log.event === 'pipeline_complete') {
              const d = log.detail || {};
              addPipelineLog(`✅ 완료: 실제 ${d.real_count||0}개 + AI ${d.ai_count||0}개 수집, ${d.features_extracted||0}개 특성 추출`, 'success');
              if (d.training_result) {
                addPipelineLog(`🎯 학습 완료: 배치 정확도 ${d.training_result.batch_accuracy}%`, 'success');
              }
            } else {
              addPipelineLog(`⚠️ 파이프라인 상태 확인 완료`, 'warn');
            }
            refreshMLStatus();
            refreshDataset();
          } else {
            addPipelineLog(`⏳ 처리 중... (${polls * 2}s)`, 'info');
          }
        })
        .catch(() => clearInterval(interval));
    }, 2000);
  }

  function addPipelineLog(msg, type) {
    const log  = document.getElementById('pipeline-log');
    if (!log) return;
    const empty = log.querySelector('.log-empty');
    if (empty) empty.remove();
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString('ko-KR')}] ${msg}`;
    log.insertBefore(line, log.firstChild);
    while (log.children.length > 50) log.removeChild(log.lastChild);
  }

  // ── Label Drop Zone ──────────────────────────
  function setupLabelDropZone() {
    const zone  = document.getElementById('label-drop-zone');
    const input = document.getElementById('label-file-input');
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) setLabelFile(file);
    });
    input.addEventListener('change', () => {
      if (input.files[0]) setLabelFile(input.files[0]);
    });
  }

  function setLabelFile(file) {
    lp.labelFile = file;
    const preview = document.getElementById('label-preview-wrap');
    const img     = document.getElementById('label-preview-img');
    const info    = document.getElementById('label-preview-info');
    if (preview) preview.style.display = 'flex';
    if (img)  img.src = URL.createObjectURL(file);
    if (info) info.innerHTML = `<strong>${file.name}</strong>${(file.size/1024).toFixed(1)} KB · ${file.type}`;
    el('btn-label-real').disabled = false;
    el('btn-label-ai').disabled   = false;
    el('label-result').textContent = '';
    el('label-result').className   = 'label-result';
  }

  // ── Label Buttons ────────────────────────────
  function setupLabelButtons() {
    const btnReal = document.getElementById('btn-label-real');
    const btnAI   = document.getElementById('btn-label-ai');
    if (btnReal) btnReal.addEventListener('click', () => submitLabel('real'));
    if (btnAI)   btnAI.addEventListener('click',   () => submitLabel('ai_generated'));
  }

  function submitLabel(label) {
    if (!lp.labelFile) return;
    const resultDiv = document.getElementById('label-result');
    const btnReal   = document.getElementById('btn-label-real');
    const btnAI     = document.getElementById('btn-label-ai');

    btnReal.disabled = true;
    btnAI.disabled   = true;
    resultDiv.className   = 'label-result';
    resultDiv.textContent = '⏳ 라벨링 & 특성 추출 중...';

    const fd = new FormData();
    fd.append('image', lp.labelFile);
    fd.append('label', label);
    fd.append('source', 'manual_upload');

    fetch('/api/ml/label_image', { method: 'POST', body: fd })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          resultDiv.className   = 'label-result error';
          resultDiv.textContent = `❌ 오류: ${data.error}`;
        } else {
          resultDiv.className   = 'label-result success';
          const trainInfo = data.training_result
            ? ` | 학습: ${data.training_result.batch_accuracy}% 정확도`
            : '';
          resultDiv.textContent = `✅ 라벨링 완료 (${label === 'real' ? '실제' : 'AI 생성'}) · 총 ${data.total_labeled}개${trainInfo}`;
          addLearningLog('label', `${label} 라벨 추가 → 총 ${data.total_labeled}개`, 'label');
          if (data.training_result) {
            addLearningLog('train', `자동 학습: ${data.training_result.batch_accuracy}% 정확도`, 'train');
          }
          lp.labelFile = null;
          // Reset preview
          const preview = document.getElementById('label-preview-wrap');
          if (preview) preview.style.display = 'none';
          const inp = document.getElementById('label-file-input');
          if (inp) inp.value = '';
          refreshMLStatus();
          refreshDataset();
        }
        btnReal.disabled = false;
        btnAI.disabled   = false;
      })
      .catch(e => {
        resultDiv.className   = 'label-result error';
        resultDiv.textContent = `❌ 요청 실패: ${e.message}`;
        btnReal.disabled = false;
        btnAI.disabled   = false;
      });
  }

  // ── Train Button ─────────────────────────────
  function setupTrainButton() {
    const btn = document.getElementById('btn-train-all');
    if (!btn) return;
    btn.addEventListener('click', () => {
      btn.disabled = true;
      const progress = document.getElementById('train-progress');
      const fill     = document.getElementById('tp-fill');
      const msg      = document.getElementById('tp-msg');
      const result   = document.getElementById('train-result');

      if (progress) progress.style.display = 'block';
      if (fill)     fill.style.width = '30%';
      if (msg)      msg.textContent  = '학습 요청 중...';
      result.className   = 'train-result';
      result.textContent = '';

      addLearningLog('train', '전체 데이터 재학습 시작', 'train');

      fetch('/api/ml/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all' })
      })
      .then(r => r.json())
      .then(data => {
        if (fill) fill.style.width = '70%';
        if (msg)  msg.textContent  = '학습 진행 중...';
        if (data.error) {
          result.className   = 'train-result error';
          result.textContent = `❌ ${data.error}`;
          if (progress) progress.style.display = 'none';
          btn.disabled = false;
          return;
        }
        // Poll for completion
        setTimeout(() => {
          fetch('/api/ml/status')
            .then(r => r.json())
            .then(status => {
              const st = status.learning_state || {};
              if (fill) fill.style.width = '100%';
              if (progress) setTimeout(() => { progress.style.display = 'none'; fill.style.width = '0%'; }, 1000);
              result.className = 'train-result success';
              result.textContent = `✅ 학습 완료 | 라운드: ${st.training_rounds} | 정확도: ${st.accuracy || '—'}%`;
              addLearningLog('train', `학습 완료: 정확도 ${st.accuracy}%`, 'train');
              refreshMLStatus();
              btn.disabled = false;
            })
            .catch(() => { btn.disabled = false; if (progress) progress.style.display = 'none'; });
        }, 3000);
      })
      .catch(e => {
        result.className   = 'train-result error';
        result.textContent = `❌ 요청 실패: ${e.message}`;
        if (progress) progress.style.display = 'none';
        btn.disabled = false;
      });
    });
  }

  // ── Dataset Browser ──────────────────────────
  function setupDatasetBrowser() {
    document.querySelectorAll('.db-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.db-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        lp.filter = btn.dataset.filter === 'manual' ? null : (btn.dataset.filter === 'all' ? 'all' : btn.dataset.filter);
        lp._manual = btn.dataset.filter === 'manual';
        lp.page = 1;
        refreshDataset();
      });
    });

    document.getElementById('db-prev')?.addEventListener('click', () => {
      if (lp.page > 1) { lp.page--; refreshDataset(); }
    });
    document.getElementById('db-next')?.addEventListener('click', () => {
      lp.page++; refreshDataset();
    });
  }

  function refreshDataset() {
    const params = new URLSearchParams({ page: lp.page, per_page: lp.perPage });
    if (lp.filter && lp.filter !== 'all') params.append('label', lp.filter);

    fetch(`/api/ml/labeled?${params}`)
      .then(r => r.json())
      .then(data => {
        const tbody    = document.getElementById('dataset-tbody');
        const pageInfo = document.getElementById('db-page-info');
        const prevBtn  = document.getElementById('db-prev');
        const nextBtn  = document.getElementById('db-next');

        if (!tbody) return;
        tbody.innerHTML = '';

        let items = data.items || [];
        if (lp._manual) items = items.filter(i => !i.auto_labeled);

        if (items.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="table-empty">데이터가 없습니다</td></tr>';
        } else {
          items.forEach(item => {
            const tr = document.createElement('tr');
            const isManual  = !item.auto_labeled;
            const timeStr   = item.timestamp ? new Date(item.timestamp).toLocaleString('ko-KR') : '—';
            const labelBadge = `<span class="label-badge ${item.label}">${item.label === 'real' ? '실제' : 'AI'}</span>`;
            const typeBadge  = `<span class="type-badge ${isManual?'manual':''}">${isManual ? '수동' : '자동'}</span>`;
            tr.innerHTML = `
              <td style="font-family:monospace;font-size:.72rem">${item.id}</td>
              <td>${labelBadge}</td>
              <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.source || '—'}</td>
              <td>${typeBadge}</td>
              <td style="white-space:nowrap">${timeStr}</td>
              <td><button class="btn-delete-row" data-id="${item.id}">🗑</button></td>
            `;
            tbody.appendChild(tr);
          });

          // Delete handlers
          tbody.querySelectorAll('.btn-delete-row').forEach(btn => {
            btn.addEventListener('click', () => deleteDatasetItem(btn.dataset.id));
          });
        }

        const totalPages = Math.max(1, Math.ceil((data.total || 0) / lp.perPage));
        if (pageInfo) pageInfo.textContent = `${lp.page} / ${totalPages}  (${data.real_count||0}실제 / ${data.ai_count||0}AI)`;
        if (prevBtn) prevBtn.disabled = lp.page <= 1;
        if (nextBtn) nextBtn.disabled = lp.page >= totalPages;
      })
      .catch(() => {
        const tbody = document.getElementById('dataset-tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-empty">ML 엔진 연결 중...</td></tr>';
      });
  }

  function deleteDatasetItem(id) {
    if (!confirm(`샘플 ${id}를 삭제하시겠습니까?`)) return;
    fetch(`/api/ml/labeled/${id}`, { method: 'DELETE' })
      .then(r => r.json())
      .then(data => {
        addLearningLog('label', `샘플 ${id} 삭제 (남은 수: ${data.remaining})`, 'label');
        refreshDataset();
        refreshMLStatus();
      })
      .catch(console.error);
  }

  // ── Learning Log ─────────────────────────────
  function addLearningLog(type, msg, cssType) {
    const log = document.getElementById('learning-log');
    if (!log) return;
    const empty = log.querySelector('.log-empty');
    if (empty) empty.remove();
    const entry = document.createElement('div');
    entry.className = 'll-entry';
    const time = new Date().toLocaleTimeString('ko-KR');
    entry.innerHTML = `
      <span class="ll-time">${time}</span>
      <span class="ll-type ${cssType}">${type.toUpperCase()}</span>
      <span class="ll-msg">${msg}</span>
    `;
    log.insertBefore(entry, log.firstChild);
    while (log.children.length > 100) log.removeChild(log.lastChild);
    lp.logEntries.push({ time, type, msg });
  }

  function setupLogClear() {
    const btn = document.getElementById('btn-log-clear');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const log = document.getElementById('learning-log');
      if (log) { log.innerHTML = '<div class="log-empty">로그가 지워졌습니다.</div>'; }
      const plog = document.getElementById('pipeline-log');
      if (plog) { plog.innerHTML = '<div class="log-empty">파이프라인을 실행하면 로그가 표시됩니다.</div>'; }
    });
  }

  // ── WebSocket ML events ──────────────────────
  // (Hook into existing WS message handler)
  const _origWSMsg = window._wsMessageHandler;
  window._wsMessageHandler = function(data) {
    if (data.type === 'pipeline_started') {
      addLearningLog('pipeline', `파이프라인 시작: real=${data.real_count}, ai=${data.ai_count}`, 'pipeline');
    } else if (data.type === 'pipeline_complete') {
      addLearningLog('pipeline', '파이프라인 완료', 'pipeline');
      refreshMLStatus(); refreshDataset();
    } else if (data.type === 'label_added') {
      addLearningLog('label', `라벨 추가: ${data.label}`, 'label');
    } else if (data.type === 'training_started') {
      addLearningLog('train', '학습 시작', 'train');
    } else if (data.type === 'ml_engine_ready') {
      addLearningLog('info', 'ML 엔진 온라인', 'info');
      refreshMLStatus();
    }
    if (_origWSMsg) _origWSMsg(data);
  };

  // Helper: safe el()
  function el(id) { return document.getElementById(id) || { textContent: '', className: '', disabled: false }; }

  // ══════════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════════
  return { navigateTo, sendChat, exportReport, copyLink, runWebVerify, switchTab, initLearningPage };

})();
