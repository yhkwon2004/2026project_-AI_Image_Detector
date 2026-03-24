/* ═══════════════════════════════════════════════
   FACT MAZE v4 — Application Logic
   Enhanced: Page transitions, image analysis display,
   scroll reveal, improved UX
   ═══════════════════════════════════════════════ */

window._app = (() => {

  // ── STATE ──
  const state = {
    currentPage: 'home',
    pageHistory: ['home'],
    currentFile: null,
    reportId: null,
    analysis: null,
    ws: null,
    wsRetries: 0
  };

  // Page order for directional transitions
  const PAGE_ORDER = ['home', 'analyze', 'algorithm', 'about'];

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
    setInterval(fetchServerStatus, 10000);
    // Start home page active
    const homePage = document.getElementById('page-home');
    if (homePage) {
      homePage.style.display = 'block';
      homePage.classList.add('active');
    }
  });

  // ══════════════════════════════════════════════
  //  PAGE TRANSITION OVERLAY
  // ══════════════════════════════════════════════
  function initOverlay() {
    if (document.getElementById('page-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'page-transition-overlay';
    overlay.id = 'page-overlay';
    document.body.appendChild(overlay);
  }

  // ══════════════════════════════════════════════
  //  NAVIGATION & PAGE TRANSITIONS
  // ══════════════════════════════════════════════
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

    // Determine direction for slide animation
    const oldIdx = PAGE_ORDER.indexOf(state.currentPage);
    const newIdx = PAGE_ORDER.indexOf(pageName);
    const direction = newIdx > oldIdx ? 'slide-left' : 'slide-right';

    // Show overlay flash
    const overlay = document.getElementById('page-overlay');
    if (overlay) {
      overlay.classList.add('show');
      setTimeout(() => overlay.classList.remove('show'), 200);
    }

    // Exit current page with animation
    if (oldPage) {
      oldPage.classList.add('exit');
      setTimeout(() => {
        oldPage.classList.remove('active', 'exit');
        oldPage.style.display = 'none';
        oldPage.style.opacity = '';
        oldPage.style.transform = '';
      }, 300);
    }

    // Enter new page
    setTimeout(() => {
      newPage.style.display = 'block';
      newPage.classList.remove('active', 'slide-left', 'slide-right', 'exit');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          newPage.classList.add('active', direction);
          // Trigger scroll reveal on new page
          setTimeout(() => triggerRevealOnPage(newPage), 100);
        });
      });
    }, 180);

    state.currentPage = pageName;
    state.pageHistory.push(pageName);

    // Update nav active state with animation
    document.querySelectorAll('.nv').forEach(b => {
      b.classList.toggle('active', b.dataset.nav === pageName);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function initHeaderScroll() {
    const hdr = document.getElementById('hdr');
    if (!hdr) return;
    window.addEventListener('scroll', () => {
      hdr.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  // ══════════════════════════════════════════════
  //  SCROLL REVEAL ANIMATION
  // ══════════════════════════════════════════════
  function initScrollReveal() {
    // Add reveal class to eligible elements
    const targets = document.querySelectorAll(
      '.card-target, .eth-card, .exp-card, .flow-step, .ac, .src-item, .ep, .sog, .amv'
    );
    targets.forEach((el, i) => {
      el.classList.add('reveal');
      if (i % 4 === 1) el.classList.add('reveal-delay-1');
      else if (i % 4 === 2) el.classList.add('reveal-delay-2');
      else if (i % 4 === 3) el.classList.add('reveal-delay-3');
    });

    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  }

  function triggerRevealOnPage(page) {
    page.querySelectorAll('.reveal:not(.visible)').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight) {
        el.classList.add('visible');
      }
    });
  }

  // ══════════════════════════════════════════════
  //  CURSOR GLOW
  // ══════════════════════════════════════════════
  function initCursorGlow() {
    const cg = document.getElementById('cg');
    if (!cg) return;
    let mx = 0, my = 0, cx = 0, cy = 0;
    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
    (function tick() {
      cx += (mx - cx) * 0.075;
      cy += (my - cy) * 0.075;
      cg.style.left = cx + 'px';
      cg.style.top  = cy + 'px';
      requestAnimationFrame(tick);
    })();
  }

  // ══════════════════════════════════════════════
  //  HERO CANVAS (enhanced particle network)
  // ══════════════════════════════════════════════
  function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, nodes = [], raf;
    const NUM = 60;

    function resize() {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }
    function createNodes() {
      nodes = Array.from({ length: NUM }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .30, vy: (Math.random() - .5) * .30,
        r: Math.random() * 2 + .5,
        color: Math.random() > .55 ? '0,212,255' : Math.random() > .5 ? '123,47,255' : '255,51,102',
        alpha: Math.random() * .2 + .1
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Draw connections
      for (let i = 0; i < NUM; i++) {
        for (let j = i + 1; j < NUM; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx*dx + dy*dy);
          if (d < 140) {
            const alpha = (1 - d/140) * .09;
            ctx.strokeStyle = `rgba(0,212,255,${alpha})`;
            ctx.lineWidth = .7;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${n.color},${n.alpha})`;
        ctx.fill();
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      });
      raf = requestAnimationFrame(draw);
    }
    resize(); createNodes(); draw();
    window.addEventListener('resize', () => { resize(); createNodes(); }, { passive: true });
  }

  // ══════════════════════════════════════════════
  //  COUNTER ANIMATION
  // ══════════════════════════════════════════════
  function initCounters() {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target;
          animNum(el, 0, parseInt(el.dataset.target), 1800);
          obs.unobserve(el);
        }
      });
    }, { threshold: .5 });
    document.querySelectorAll('[data-target]').forEach(el => obs.observe(el));
  }

  function animNum(el, from, to, dur) {
    const start = performance.now();
    const tick = now => {
      const p = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * ease);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function initScrollHint() {
    const hint = document.getElementById('scroll-hint');
    if (!hint) return;
    window.addEventListener('scroll', () => {
      hint.style.opacity = window.scrollY > 60 ? '0' : '1';
    }, { passive: true });
  }

  // ══════════════════════════════════════════════
  //  SERVER STATUS (WebSocket + REST fallback)
  // ══════════════════════════════════════════════
  function initWebSocket() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      state.ws = new WebSocket(`${proto}//${location.host}`);
      state.ws.onopen = () => {
        setServerDot('online', '서버 연결됨');
        state.wsRetries = 0;
      };
      state.ws.onclose = () => {
        setServerDot('offline', '연결 끊김');
        if (state.wsRetries < 5) {
          const delay = Math.min(10000, 3000 * (state.wsRetries + 1));
          setTimeout(() => { state.wsRetries++; initWebSocket(); }, delay);
        }
      };
      state.ws.onerror = () => {};
      state.ws.onmessage = e => {
        try {
          const d = JSON.parse(e.data);
          if (d.type === 'analysis_complete') {
            toast(`✅ 분석 완료: ${d.verdict}`, 'success');
          }
        } catch {}
      };
    } catch(e) {}
  }

  function setServerDot(st, label) {
    const dot = document.getElementById('srv-dot');
    const lbl = document.getElementById('srv-label');
    if (dot) { dot.className = 'srv-dot ' + st; }
    if (lbl) lbl.textContent = label;
  }

  async function fetchServerStatus() {
    try {
      const r = await fetch('/api/health');
      const d = await r.json();
      setServerDot('online', '온라인');
      const up = d.uptime;
      const h = Math.floor(up/3600), m = Math.floor((up%3600)/60);
      const sub = document.getElementById('srv-sub');
      const sa  = document.getElementById('stat-analyses');
      const ss  = document.getElementById('stat-sessions');
      const lsA = document.getElementById('ls-analyses');
      const lsU = document.getElementById('ls-uptime');
      if (sub) sub.textContent = `업타임 ${h}h ${m}m`;
      if (sa)  sa.textContent  = d.analyses;
      if (ss)  ss.textContent  = d.activeSessions;
      if (lsA) lsA.textContent = d.analyses;
      if (lsU) lsU.textContent = `${h}h ${m}m`;
    } catch(e) {
      setServerDot('offline', '오프라인');
      const sub = document.getElementById('srv-sub');
      if (sub) sub.textContent = '재연결 시도 중...';
    }
  }

  // ══════════════════════════════════════════════
  //  DRAG & DROP / FILE UPLOAD
  // ══════════════════════════════════════════════
  function initDrop() {
    const dz     = document.getElementById('dz');
    const fin    = document.getElementById('file-in');
    const choose = document.getElementById('btn-choose');
    const rmBtn  = document.getElementById('btn-rm');
    if (!dz) return;

    dz.addEventListener('click', e => {
      if (!e.target.closest('#dz-preview') && !e.target.closest('#btn-rm') && !e.target.closest('#btn-choose')) {
        fin.click();
      }
    });
    choose?.addEventListener('click', e => { e.stopPropagation(); fin.click(); });
    fin?.addEventListener('change', e => { if (e.target.files[0]) setFile(e.target.files[0]); });
    rmBtn?.addEventListener('click', clearFile);

    dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('over'); }, { passive: false });
    dz.addEventListener('dragleave', ()  => dz.classList.remove('over'));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        setFile(file);
      } else {
        toast('이미지 파일만 업로드 가능합니다 (JPG·PNG·WebP·GIF)', 'error');
      }
    });

    document.getElementById('btn-analyze')?.addEventListener('click', startAnalysis);
    document.getElementById('btn-search')?.addEventListener('click', runWebVerify);
    document.getElementById('wc-input')?.addEventListener('keydown', e => { if(e.key==='Enter') runWebVerify(); });

    document.querySelectorAll('.wt').forEach(t => {
      t.addEventListener('click', () => {
        const inp = document.getElementById('wc-input');
        if (inp) inp.value = t.dataset.q;
        runWebVerify();
      });
    });

    document.querySelectorAll('.rt').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.rt').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${tab}`)?.classList.add('active');
      });
    });
  }

  function initChatQuickReplies() {
    document.querySelectorAll('.cq-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const inp = document.getElementById('chat-input');
        if (inp) {
          inp.value = btn.dataset.q;
          sendChat();
        }
      });
    });
  }

  function setFile(file) {
    // Validate file size
    if (file.size > 30 * 1024 * 1024) {
      toast('파일 크기는 30MB 이하여야 합니다', 'error');
      return;
    }

    state.currentFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.getElementById('prev-img');
      img.src = e.target.result;
      img.style.opacity = '0';
      img.onload = () => {
        img.style.transition = 'opacity .3s ease';
        img.style.opacity = '1';
      };

      document.getElementById('prev-name').textContent = file.name;
      const kb = file.size / 1024;
      document.getElementById('prev-size').textContent =
        kb > 1024 ? `${(kb/1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;

      const dzIdle = document.getElementById('dz-idle');
      const dzPrev = document.getElementById('dz-preview');
      dzIdle.style.opacity = '0';
      setTimeout(() => {
        dzIdle.style.display = 'none';
        dzPrev.style.display = 'flex';
        dzPrev.style.opacity = '0';
        requestAnimationFrame(() => {
          dzPrev.style.transition = 'opacity .3s ease';
          dzPrev.style.opacity = '1';
        });
      }, 150);

      const btn = document.getElementById('btn-analyze');
      btn.disabled = false;
      btn.style.animation = 'scaleInBounce .4s ease';
      setTimeout(() => btn.style.animation = '', 400);

      // Sync query field
      const q = document.getElementById('qinput')?.value?.trim();
      const wci = document.getElementById('wc-input');
      if (q && wci) wci.value = q;

      toast('📸 이미지 업로드 완료. 7단계 AI 분석을 시작하세요!', 'success');
    };
    reader.readAsDataURL(file);
  }

  function clearFile() {
    state.currentFile = null;
    document.getElementById('file-in').value = '';
    const dzIdle = document.getElementById('dz-idle');
    const dzPrev = document.getElementById('dz-preview');
    dzPrev.style.opacity = '0';
    setTimeout(() => {
      dzPrev.style.display = 'none';
      dzIdle.style.display = 'flex';
      dzIdle.style.opacity = '0';
      requestAnimationFrame(() => {
        dzIdle.style.transition = 'opacity .3s ease';
        dzIdle.style.opacity = '1';
      });
    }, 200);
    document.getElementById('btn-analyze').disabled = true;
    state.reportId = null;
    state.analysis = null;
  }

  // ══════════════════════════════════════════════
  //  7-STEP ANALYSIS
  // ══════════════════════════════════════════════
  const STEP_NAMES = [
    'Metadata & Image Ingestion',
    'Luminance Extraction (BT.709)',
    'Sobel Gradient Computation',
    'Vector Construction M∈ℝ^(N×2)',
    'Covariance Matrix C=(1/N)·MᵀM',
    'PCA Eigenvalue Analysis (λ₁,λ₂)',
    'Composite AI Probability Score'
  ];

  const STEP_DESCRIPTIONS = [
    'EXIF 메타데이터 추출 — 포맷, 해상도, 색공간 분석',
    'BT.709 밝기 변환 — L=0.2126R+0.7152G+0.0722B',
    'Sobel 필터 적용 — 수평·수직 그라디언트 계산',
    '픽셀별 벡터화 — N×2 행렬 M 구성',
    '공분산 행렬 C = (1/N)·MᵀM 계산',
    'PCA 고유값 분석 — 이방성 λ₁,λ₂ 추출',
    '5개 지표 종합 — AI 확률 P(AI) 산출'
  ];

  async function startAnalysis() {
    if (!state.currentFile) return;
    const btn = document.getElementById('btn-analyze');
    document.getElementById('ba-txt').style.display = 'none';
    document.getElementById('ba-load').style.display = 'flex';
    btn.disabled = true;

    const dz = document.getElementById('dz');
    dz?.classList.add('analyzing');

    // Hide previous results
    const emptyEl = document.getElementById('az-empty');
    const resultsEl = document.getElementById('az-results');
    emptyEl.style.opacity = '0';
    setTimeout(() => { emptyEl.style.display = 'none'; }, 200);
    resultsEl.style.display = 'none';

    // Show progress
    const prog = document.getElementById('az-progress');
    prog.style.display = 'block';
    prog.style.opacity = '0';
    requestAnimationFrame(() => {
      prog.style.transition = 'opacity .3s ease';
      prog.style.opacity = '1';
    });
    renderProgressSteps();

    let stepIdx = 0;
    // Realistic timing: faster at start, slower toward end
    const stepDelays = [250, 280, 310, 300, 340, 360, 0];

    const progressInterval = setInterval(() => {
      stepIdx++;
      updateProgressStep(stepIdx);
      const pct = Math.round((stepIdx / 7) * 95); // Max 95% until server responds
      document.getElementById('pb-fill').style.width = pct + '%';
      document.getElementById('prog-label').textContent =
        stepIdx < 7 ? `Step ${stepIdx}/7: ${STEP_DESCRIPTIONS[stepIdx-1]}` : '결과 처리 중...';
      if (stepIdx >= 7) clearInterval(progressInterval);
    }, 290);

    try {
      const form = new FormData();
      form.append('image', state.currentFile);

      const resp = await fetch('/api/analyze', { method: 'POST', body: form });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      state.reportId = data.reportId;
      state.analysis  = data.analysis;

      clearInterval(progressInterval);
      // Mark all steps done
      for (let i = 1; i <= 7; i++) {
        setTimeout(() => updateProgressStep(i + 0.1), i * 40); // slight stagger
      }
      document.getElementById('pb-fill').style.width = '100%';
      document.getElementById('prog-label').textContent = '✅ 7단계 분석 완료! 결과를 로드합니다...';

      await delay(700);

      // Transition: hide progress, show results
      prog.style.transition = 'opacity .3s ease';
      prog.style.opacity = '0';
      await delay(300);
      prog.style.display = 'none';
      prog.style.opacity = '';
      dz?.classList.remove('analyzing');

      renderResults(data.analysis, data.reportId);
      resultsEl.style.opacity = '0';
      resultsEl.style.display = 'block';
      requestAnimationFrame(() => {
        resultsEl.style.transition = 'opacity .45s ease';
        resultsEl.style.opacity = '1';
      });

      toast('✅ 7단계 AI 분석 완료! 결과를 확인하세요.', 'success');

      // Auto-run web verify if query entered
      const q = document.getElementById('qinput')?.value?.trim();
      if (q) {
        const wci = document.getElementById('wc-input');
        if (wci) wci.value = q;
        setTimeout(runWebVerify, 1000);
      }

      // Auto chat message
      const prob = parseInt(data.analysis.scores.aiProbability);
      setTimeout(() => {
        if (prob >= 62) {
          addChat('bot', `🚨 <strong>경고:</strong> AI 생성 확률이 <strong>${prob}%</strong>로 높습니다.<br/><strong>주요 근거:</strong> Trace(C)=${data.analysis.covariance.trace} (낮은 값 = AI 평탄화 패턴), 이방성=${data.analysis.covariance.anisotropy}.<br/>팩트체크 탭에서 다중 소스 교차 검증을 강력히 권장합니다.`);
        } else if (prob >= 36) {
          addChat('bot', `⚠️ AI 확률 <strong>${prob}%</strong> — 불확실 구간입니다. 단독 판단을 피하고 팩트체크 탭에서 추가 검증을 진행해주세요.<br/>Trace(C)=${data.analysis.covariance.trace}, 이방성=${data.analysis.covariance.anisotropy}.`);
        } else {
          addChat('bot', `✅ AI 확률 <strong>${prob}%</strong> — 자연스러운 물리적 패턴이 감지됩니다.<br/>Trace(C)=${data.analysis.covariance.trace} (높은 값 = 실제 사진 특성), 이방성=${data.analysis.covariance.anisotropy}. 실제 촬영 사진의 특성과 일치합니다.`);
        }
      }, 1000);

    } catch(err) {
      clearInterval(progressInterval);
      prog.style.display = 'none';
      dz?.classList.remove('analyzing');
      emptyEl.style.display = 'flex';
      emptyEl.style.opacity = '0';
      requestAnimationFrame(() => {
        emptyEl.style.transition = 'opacity .3s ease';
        emptyEl.style.opacity = '1';
      });
      toast('❌ 분석 실패: ' + err.message, 'error');
    } finally {
      document.getElementById('ba-txt').style.display = 'flex';
      document.getElementById('ba-load').style.display = 'none';
      btn.disabled = false;
    }
  }

  function renderProgressSteps() {
    const container = document.getElementById('prog-steps');
    container.innerHTML = STEP_NAMES.map((n, i) => `
      <div class="ps-item" id="ps-${i+1}">
        <div class="ps-icon">${i+1}</div>
        <div>
          <div style="font-size:12px;font-weight:500">${n}</div>
          <div style="font-size:10px;color:var(--t3);margin-top:2px">${STEP_DESCRIPTIONS[i]}</div>
        </div>
      </div>`).join('');
  }

  function updateProgressStep(idx) {
    const roundIdx = Math.floor(idx);
    for (let i = 1; i <= 7; i++) {
      const el = document.getElementById(`ps-${i}`);
      if (!el) continue;
      el.classList.remove('active', 'done');
      const icon = el.querySelector('.ps-icon');
      if (i < roundIdx)      { el.classList.add('done');   icon.textContent = '✓' }
      else if (i === roundIdx) { el.classList.add('active'); icon.textContent = i  }
      else                   { icon.textContent = i }
    }
  }

  const delay = ms => new Promise(r => setTimeout(r, ms));

  // ══════════════════════════════════════════════
  //  RENDER RESULTS
  // ══════════════════════════════════════════════
  function renderResults(analysis, reportId) {
    renderVerdict(analysis);
    renderStepList(analysis);
    renderMetrics(analysis);
    renderMatrix(analysis);
    renderReport(analysis, reportId);
  }

  function renderVerdict(analysis) {
    const { verdict, aiProbability } = analysis.scores;
    const prob = parseInt(aiProbability);
    const vrd = document.getElementById('verdict');
    vrd.className = 'verdict';
    vrd.style.animation = '';
    requestAnimationFrame(() => { vrd.style.animation = 'scaleIn .4s ease'; });

    let icon, title, sub, color, strokeColor;
    if (verdict === 'LIKELY_REAL') {
      icon='✅'; title='실제 사진으로 판단됨'; color='var(--grn)'; strokeColor='#22C55E';
      sub=`AI 확률 ${prob}% — 자연스러운 그라디언트 구조·물리적 패턴 감지. 추가 팩트체크 권장.`;
      vrd.classList.add('vreal');
    } else if (verdict === 'UNCERTAIN') {
      icon='⚠️'; title='판정 불확실 — 추가 검증 필요'; color='var(--org)'; strokeColor='#FF9900';
      sub=`AI 확률 ${prob}% — 일부 비자연적 패턴 감지. 다중 소스 교차 검증 필수.`;
      vrd.classList.add('vuncertain');
    } else {
      icon='🚨'; title='AI 생성 이미지 가능성 높음'; color='var(--red)'; strokeColor='#FF3366';
      sub=`AI 확률 ${prob}% — 비정상적 그라디언트 분포·과도 평탄화 패턴 감지. 공유 전 검증 필수.`;
      vrd.classList.add('vai');
    }

    document.getElementById('vrd-icon').textContent = icon;
    const vrdTitle = document.getElementById('vrd-title');
    vrdTitle.textContent = title;
    vrdTitle.style.color = color;
    document.getElementById('vrd-sub').textContent = sub;

    const arc = document.getElementById('gauge-arc');
    arc.style.stroke = strokeColor;
    arc.style.strokeDashoffset = '364';
    const circumference = 364;
    setTimeout(() => {
      arc.style.strokeDashoffset = String(circumference - (prob / 100) * circumference);
    }, 200);

    const numEl = document.getElementById('gv-num');
    numEl.textContent = '0';
    setTimeout(() => animNum(numEl, 0, prob, 1500), 200);
  }

  function renderStepList(analysis) {
    const container = document.getElementById('step-list');
    container.innerHTML = analysis.steps.map((s, i) => `
      <div class="sl-item" style="animation-delay:${i * 0.07}s">
        <div class="sl-num">${s.step}</div>
        <div class="sl-content">
          <div class="sl-name">${escHtml(s.name)}</div>
          <div class="sl-detail">${escHtml(s.detail)}</div>
          <div class="sl-src">📚 출처: ${escHtml(s.source)}</div>
        </div>
      </div>`).join('');

    const reasons = analysis.scores.reasons || [];
    const rb = document.getElementById('reasons-box');
    rb.innerHTML = `
      <h4>
        🔎 탐지 근거 지표
        <span style="font-size:11px;color:var(--c1);font-weight:500;text-transform:none;letter-spacing:0">${reasons.length}개 신호 감지</span>
      </h4>` +
      (reasons.length === 0
        ? `<div style="font-size:12px;color:var(--t3);padding:8px">유의미한 AI 특성 신호가 감지되지 않았습니다.</div>`
        : reasons.map((r, i) => `
            <div class="reason-item" style="animation-delay:${i * 0.06}s">
              <div class="ri-dot"></div>
              <span>${escHtml(r)}</span>
            </div>`).join('')
      );
  }

  function renderMetrics(analysis) {
    const { covariance: c, gradient: g, saturation: s, luminance: l, scores, blockFreq } = analysis;
    const traceVal = parseFloat(c.trace);
    const anisoStr = c.anisotropy; // e.g. "45.2%"
    const anisoVal = parseFloat(anisoStr);

    const items = [
      {
        label: 'Trace(C)', val: parseFloat(c.trace).toFixed(1),
        pct: Math.min(100, traceVal / 60),
        color: traceVal < 300 ? 'var(--red)' : traceVal < 800 ? 'var(--org)' : 'var(--grn)',
        desc: 'C₀₀+C₁₁ · 낮을수록 AI 평탄화 패턴'
      },
      {
        label: '그라디언트 μ', val: g.mean,
        pct: Math.min(100, parseFloat(g.mean) / 3),
        color: 'var(--txt)',
        desc: '픽셀간 밝기 변화율 평균'
      },
      {
        label: '이방성 (λ₁−λ₂)/λ₁', val: c.anisotropy,
        pct: anisoVal,
        color: anisoVal > 60 ? 'var(--grn)' : anisoVal < 25 ? 'var(--red)' : 'var(--org)',
        desc: '방향성 구조 강도 · 높을수록 실사'
      },
      {
        label: '채도 분산 σ', val: s.std,
        pct: Math.min(100, parseFloat(s.std) * 600),
        color: parseFloat(s.std) < 0.06 ? 'var(--red)' : 'var(--txt)',
        desc: '색상 다양성 · 낮으면 인공적 균일성'
      },
      {
        label: '고주파 비율', val: g.highFreqRatio,
        pct: parseFloat(g.highFreqRatio),
        color: 'var(--txt)',
        desc: '고주파 성분 비율 · 낮으면 과도 평탄화'
      },
      {
        label: '블록 주파수', val: blockFreq,
        pct: Math.min(100, parseFloat(blockFreq) * 4),
        color: parseFloat(blockFreq) < 5 ? 'var(--red)' : 'var(--txt)',
        desc: '8×8 블록 텍스처 복잡도'
      },
    ];

    document.getElementById('metrics-g').innerHTML = items.map((m, i) => `
      <div class="mg-card" style="animation-delay:${i * .07}s">
        <div class="mg-label">${m.label}</div>
        <div class="mg-val" style="color:${m.color}">${m.val}</div>
        <div class="mg-bar"><div class="mg-bf" data-width="${Math.min(100, Math.max(0, m.pct))}"></div></div>
        <div class="mg-desc">${m.desc}</div>
      </div>`).join('');

    // Animate bars after render
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.querySelectorAll('.mg-bf[data-width]').forEach(bar => {
          const w = bar.dataset.width;
          requestAnimationFrame(() => { bar.style.width = w + '%'; });
        });
      }, 100);
    });
  }

  function renderMatrix(analysis) {
    const c = analysis.covariance;
    const traceVal = parseFloat(c.trace);
    const traceColor = traceVal < 300 ? 'var(--red)' : traceVal < 800 ? 'var(--org)' : 'var(--grn)';

    document.getElementById('matrix-vis').innerHTML = `
      <div class="mv-title">공분산 행렬 &nbsp; C = (1/N)·M<sup>T</sup>M</div>
      <div class="mv-matrix">
        <div class="mv-bracket">[</div>
        <div class="mv-cells">
          <div class="mv-row">
            <div class="mv-cell" style="color:var(--c1)" title="수평 그라디언트 분산 (∑Gx²/N)">
              <div style="font-size:9px;color:var(--t3);margin-bottom:3px">C₀₀</div>
              ${c.C00}
            </div>
            <div class="mv-cell" style="color:var(--t2)" title="교차 공분산 (∑GxGy/N)">
              <div style="font-size:9px;color:var(--t3);margin-bottom:3px">C₀₁</div>
              ${c.C01}
            </div>
          </div>
          <div class="mv-row">
            <div class="mv-cell" style="color:var(--t2)" title="교차 공분산 (대칭)">
              <div style="font-size:9px;color:var(--t3);margin-bottom:3px">C₁₀</div>
              ${c.C01}
            </div>
            <div class="mv-cell" style="color:var(--c1)" title="수직 그라디언트 분산 (∑Gy²/N)">
              <div style="font-size:9px;color:var(--t3);margin-bottom:3px">C₁₁</div>
              ${c.C11}
            </div>
          </div>
        </div>
        <div class="mv-bracket">]</div>
      </div>
      <div class="mv-eigen">
        <span>λ₁ = <strong>${c.lambda1}</strong></span>
        <span>λ₂ = <strong>${c.lambda2}</strong></span>
        <span>Trace = <strong style="color:${traceColor}">${c.trace}</strong></span>
        <span>이방성 = <strong style="color:${parseFloat(c.anisotropy) > 50 ? 'var(--grn)' : parseFloat(c.anisotropy) < 25 ? 'var(--red)' : 'var(--org)'}">${c.anisotropy}</strong></span>
      </div>
      <div style="margin-top:12px;font-size:11px;color:var(--t3);text-align:left;padding-top:10px;border-top:1px solid var(--bd)">
        <strong style="color:var(--t2)">해석:</strong>
        Trace(C)=${c.trace}${traceVal < 300 ? ' — <span style="color:var(--red)">매우 낮음 → AI 생성 강하게 의심</span>' : traceVal < 800 ? ' — <span style="color:var(--org)">낮음 → AI 가능성 있음</span>' : ' — <span style="color:var(--grn)">높음 → 자연 사진 특성</span>'}
      </div>`;
  }

  function renderReport(analysis, reportId) {
    const { scores: sc, covariance: c, gradient: g, saturation: s, luminance: l, dimensions: dim } = analysis;
    const prob = parseInt(sc.aiProbability);
    const vColor = sc.verdict==='LIKELY_REAL'?'var(--grn)':sc.verdict==='UNCERTAIN'?'var(--org)':'var(--red)';
    const vKo = sc.verdict==='LIKELY_REAL'?'실제 사진 가능성 높음':sc.verdict==='UNCERTAIN'?'불확실 — 추가 검증 필요':'AI 생성 가능성 높음';

    document.getElementById('report-body').innerHTML = `
      <div class="rpt-hd">
        <div>
          <div class="rpt-logo">🔍 Fact Maze AI 탐지 보고서</div>
          <div style="font-size:11px;color:var(--t2);margin-top:4px">AI-Generated Image Detection Report · v4</div>
        </div>
        <div class="rpt-meta">
          <div>보고서 ID: <strong>${reportId.slice(0,8).toUpperCase()}</strong></div>
          <div>분석 시각: ${new Date().toLocaleString('ko-KR')}</div>
          <div>원본 해상도: ${dim.width}×${dim.height}px</div>
          <div>분석 해상도: ${dim.analyzed}px</div>
        </div>
      </div>

      <div class="rpt-section">
        <h3>최종 판정</h3>
        <div class="rpt-verdict" style="background:${vColor}18;border:1px solid ${vColor};color:${vColor}">
          ${sc.verdict==='LIKELY_REAL'?'✅':sc.verdict==='UNCERTAIN'?'⚠️':'🚨'} ${vKo}
          &nbsp;&nbsp;|&nbsp;&nbsp; AI 생성 확률 <strong>${prob}%</strong>
        </div>
      </div>

      <div class="rpt-section">
        <h3>공분산 행렬 분석 — C = (1/N)·MᵀM</h3>
        <table class="rpt-table">
          <tr><td>C₀₀ (수평 그라디언트 분산 ∑Gx²/N)</td><td>${c.C00}</td></tr>
          <tr><td>C₁₁ (수직 그라디언트 분산 ∑Gy²/N)</td><td>${c.C11}</td></tr>
          <tr><td>C₀₁ (교차 공분산 ∑GxGy/N)</td><td>${c.C01}</td></tr>
          <tr><td><strong>Trace(C) = C₀₀ + C₁₁</strong></td><td><strong>${c.trace}</strong></td></tr>
          <tr><td>고유값 λ₁ (주 성분)</td><td>${c.lambda1}</td></tr>
          <tr><td>고유값 λ₂ (직교 성분)</td><td>${c.lambda2}</td></tr>
          <tr><td>방향 이방성 (λ₁−λ₂)/λ₁</td><td>${c.anisotropy}</td></tr>
        </table>
      </div>

      <div class="rpt-section">
        <h3>그라디언트·밝기·색상 분석</h3>
        <table class="rpt-table">
          <tr><td>밝기(Luminance) 평균 L̄ — BT.709 표준</td><td>${l.mean}</td></tr>
          <tr><td>밝기 표준편차 σ(L)</td><td>${l.std}</td></tr>
          <tr><td>그라디언트 평균 |∇L| (Sobel)</td><td>${g.mean}</td></tr>
          <tr><td>그라디언트 표준편차 σ(|∇L|)</td><td>${g.std}</td></tr>
          <tr><td>고주파 비율 (Mean+σ 초과 픽셀)</td><td>${g.highFreqRatio}</td></tr>
          <tr><td>채도 평균 S̄</td><td>${s.mean}</td></tr>
          <tr><td>채도 표준편차 σ(S)</td><td>${s.std}</td></tr>
          <tr><td>블록 주파수 불규칙성 (8×8 DCT 유사)</td><td>${analysis.blockFreq}</td></tr>
        </table>
      </div>

      <div class="rpt-section">
        <h3>탐지 근거 (${(sc.reasons||[]).length}개 지표)</h3>
        <div style="font-size:12px;line-height:2">
          ${(sc.reasons||[]).map(r => `• ${escHtml(r)}`).join('<br/>') || '• 유의미한 AI 특성 신호 미감지'}
        </div>
      </div>

      <div style="font-size:11px;color:var(--t3);border-top:1px solid var(--bd);padding-top:14px;line-height:2">
        <strong>⚠️ 면책 조항:</strong> 본 보고서는 알고리즘 기반 참고 도구이며 법적 증거로 사용 불가. 최종 판단은 전문가 검토 필수.<br/>
        <strong>알고리즘:</strong> BT.709 Luminance · Sobel Gradient · 2×2 Covariance PCA · Anisotropy · Block Frequency<br/>
        <strong>학술 출처:</strong> ITU-R BT.709 · Kang et al. IEEE T-IFS 2014 · Wang et al. CVPR 2020 · Corvi et al. ICASSP 2023<br/>
        <strong>팩트체크 소스:</strong> Reuters · AFP · Bellingcat · KISA · MIT · GDELT · IFCN 인증 기관<br/>
        <strong>프라이버시:</strong> 업로드 이미지는 분석 완료 후 서버에서 즉시 삭제됨 · 개인정보 미수집 · GDPR·개인정보보호법 준수
      </div>`;
  }

  // ══════════════════════════════════════════════
  //  WEB VERIFICATION
  // ══════════════════════════════════════════════
  async function runWebVerify() {
    const query = document.getElementById('wc-input')?.value?.trim();
    if (!query) { toast('검색어를 입력해주세요', 'warning'); return; }

    const container = document.getElementById('wc-results');
    container.innerHTML = `
      <div class="wc-loading">
        <div class="spin"></div>
        <div>
          <div style="font-size:13px">"${escHtml(query)}" 실시간 검색 중...</div>
          <div style="font-size:11px;color:var(--t3);margin-top:3px">DuckDuckGo · GDELT · Reuters · AFP · KISA · Bellingcat 교차 검증</div>
        </div>
      </div>`;

    // Switch to webcheck tab
    switchTab('webcheck');

    try {
      const resp = await fetch('/api/webverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, reportId: state.reportId })
      });
      const data = await resp.json();
      renderWebResults(data.results, query);
    } catch(err) {
      container.innerHTML = `<div class="fc-warn-box">❌ 검색 오류: ${escHtml(err.message)}</div>`;
    }
  }

  function switchTab(tabName) {
    document.querySelectorAll('.rt').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelector(`.rt[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
  }

  function renderWebResults(results, query) {
    const c = document.getElementById('wc-results');
    const isConflict = /ukraine|russia|iran|israel|우크라이나|러시아|이란|이스라엘|Gaza|가자/i.test(query);
    const isDeepfake = /deepfake|딥페이크|deep.?fake/i.test(query);

    let html = '';

    if (isConflict) {
      html += `<div class="fc-warn-box">
        ⚠️
        <div>
          <strong>분쟁 지역 이미지 주의:</strong> 전쟁·분쟁 이미지는 AI 합성·오용 위험이 매우 높습니다.<br/>
          반드시 복수의 신뢰 소스를 교차 확인하고, Bellingcat OSINT 방법론(위성 교차 검증)을 이용하세요.
          RAND Corp. 연구: 분쟁 초기 <strong>72시간</strong>이 허위정보 확산의 핵심 시간대.
          (출처: RAND Corporation Research 2023, NATO StratCom COE)
        </div>
      </div>`;
    }
    if (isDeepfake) {
      html += `<div class="fc-warn-box" style="border-color:rgba(123,47,255,.4);color:var(--c2);background:rgba(123,47,255,.06)">
        🤖
        <div>
          <strong>딥페이크 관련 검색:</strong> 피해 발생 시 즉시 신고하세요.<br/>
          ▪ <a href="https://www.kisa.or.kr/" target="_blank" style="color:var(--c2)">KISA 한국인터넷진흥원</a> (kisa.or.kr)
          ▪ <a href="https://cyberbureau.police.go.kr/" target="_blank" style="color:var(--c2)">경찰청 사이버수사대</a>
          ▪ 사이버범죄 신고전화 <strong>117</strong>
        </div>
      </div>`;
    }

    if (!results || results.length === 0) {
      html += `<div class="wc-placeholder">
        "${escHtml(query)}"에 대한 직접 검색 결과가 없습니다.<br/>
        아래 직접 팩트체크 도구를 이용해보세요.
      </div>`;
    } else {
      const typeIcon = t => t==='factcheck'?'🔍':t==='news'?'📰':t==='investigation'?'🕵️':t==='research'?'🔬':t==='official'?'🏛️':t==='standard'?'📋':'🔗';
      const relLabel = r => r==='high'?`<span style="color:var(--grn)">✓ 신뢰도: 높음</span>`:r==='medium'?`<span style="color:var(--org)">⚡ 신뢰도: 중간</span>`:`<span style="color:var(--t3)">신뢰도: 낮음</span>`;

      results.forEach((r, i) => {
        html += `
          <div class="fc-card fc-reliability-${r.reliability||'low'}" style="animation-delay:${i * .06}s">
            <div class="fc-top">
              <a href="${r.url}" target="_blank" rel="noopener" class="fc-title">${typeIcon(r.type)} ${escHtml(r.title || '제목 없음')}</a>
              <span class="fc-src">${escHtml(r.source)}</span>
            </div>
            ${r.snippet ? `<p class="fc-snip">${escHtml(r.snippet)}</p>` : ''}
            <div class="fc-meta">
              ${r.country ? `<span class="fc-tag2">🌍 ${r.country}</span>` : ''}
              ${r.lang    ? `<span class="fc-tag2">🗣 ${r.lang}</span>` : ''}
              ${r.reliability ? `<span class="fc-tag2">${relLabel(r.reliability)}</span>` : ''}
            </div>
          </div>`;
      });
    }

    html += `
      <div class="fc-tools">
        <div class="fc-tools-title">📌 직접 팩트체크 도구 (IFCN 인증 기관)</div>
        <div class="fc-tools-links">
          <a href="https://toolbox.google.com/factcheck/explorer/search/${encodeURIComponent(query)}" target="_blank" rel="noopener" class="fc-tl">🔍 Google Fact Check</a>
          <a href="https://www.snopes.com/search/?q=${encodeURIComponent(query)}" target="_blank" rel="noopener" class="fc-tl">Snopes</a>
          <a href="https://www.reuters.com/fact-check/" target="_blank" rel="noopener" class="fc-tl">Reuters FC</a>
          <a href="https://fact.afp.com/en" target="_blank" rel="noopener" class="fc-tl">AFP FC</a>
          <a href="https://tineye.com/" target="_blank" rel="noopener" class="fc-tl">🔄 TinEye 역방향</a>
          <a href="https://images.google.com/" target="_blank" rel="noopener" class="fc-tl">Google 이미지</a>
          <a href="https://www.yna.co.kr/" target="_blank" rel="noopener" class="fc-tl">연합뉴스 팩트체크</a>
          <a href="https://www.bellingcat.com/" target="_blank" rel="noopener" class="fc-tl">Bellingcat OSINT</a>
        </div>
        <p style="font-size:11px;color:var(--t3);margin-top:8px">
          * IFCN(국제팩트체킹네트워크) 인증 기관 — poynter.org/ifcn<br/>
          출처: DuckDuckGo API · GDELT Project · 자체 팩트체크 지식베이스 (Reuters, AFP, Bellingcat, StopFake, MENA FC, KISA 등)
        </p>
      </div>`;

    c.innerHTML = html;
  }

  // ══════════════════════════════════════════════
  //  CHAT
  // ══════════════════════════════════════════════
  function addChat(role, content) {
    const c = document.getElementById('chat-msgs');
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.innerHTML = `
      <div class="cm-avatar">${role === 'user' ? '👤' : '🔍'}</div>
      <div class="cm-bubble">${content}</div>`;
    c.appendChild(div);
    c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
  }

  function showTyping() {
    const c = document.getElementById('chat-msgs');
    const div = document.createElement('div');
    div.className = 'chat-msg bot'; div.id = 'typing';
    div.innerHTML = `<div class="cm-avatar">🔍</div><div class="cm-bubble"><div class="typing-dots"><div class="td"></div><div class="td"></div><div class="td"></div></div></div>`;
    c.appendChild(div);
    c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
  }

  async function sendChat() {
    const inp = document.getElementById('chat-input');
    const msg = inp.value.trim();
    if (!msg) return;
    inp.value = '';
    addChat('user', escHtml(msg));
    showTyping();
    switchTab('chat');

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, reportId: state.reportId })
      });
      const data = await resp.json();
      document.getElementById('typing')?.remove();
      if (data.response) addChat('bot', data.response);
    } catch(e) {
      document.getElementById('typing')?.remove();
      addChat('bot', '응답 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  // ══════════════════════════════════════════════
  //  EXPORT / SHARE
  // ══════════════════════════════════════════════
  function exportReport() {
    if (!state.reportId) { toast('먼저 이미지를 분석해주세요', 'warning'); return; }
    window.open(`/api/export/${state.reportId}`, '_blank');
    toast('📥 JSON 보고서 다운로드 시작', 'success');
  }

  function copyLink() {
    if (!state.reportId) { toast('먼저 이미지를 분석해주세요', 'warning'); return; }
    const url = `${location.origin}/api/report/${state.reportId}`;
    navigator.clipboard.writeText(url)
      .then(() => toast('🔗 보고서 링크 복사 완료', 'success'))
      .catch(() => toast(`링크: ${url}`, 'info'));
  }

  // ══════════════════════════════════════════════
  //  TOAST
  // ══════════════════════════════════════════════
  function toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.innerHTML = msg;
    el.className = `toast show ${type}`;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 3800);
  }

  // ══════════════════════════════════════════════
  //  UTILS
  // ══════════════════════════════════════════════
  function escHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── PUBLIC API ──
  return { navigateTo, sendChat, exportReport, copyLink, fetchServerStatus };

})();
