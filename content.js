// YouTube AI & Bot Detector — Content Script v4 (comments only)

(function () {
  'use strict';

  const ATTR = 'data-ytabd';

  const COMMENT_SEL = [
    `ytd-comment-renderer:not([${ATTR}])`,
    `ytd-comment-view-model:not([${ATTR}])`,
  ].join(',');

  // ── BOT patterns — one match flags a comment as BOT ──────────────────────
  const BOT_PATTERNS = [
    /\+\s*\d[\d\s\-\.\(\)]{8,}\d/,
    /(?:whatsapp|watsapp|wa\.me)\s*[:\-]?\s*\+?[\d\s\-\.\(\)]{8,}/i,
    /(?:telegram|t\.me)\s*[:\-]?\s*@?[\w]{4,}/i,
    /(?:bitcoin|btc|crypto|invest(?:ment)?|forex|trading)\b.{0,50}(?:\$\s*\d|\d+\s*%\s*(?:profit|return|daily|weekly))/i,
    /(?:earn|make|get)\s+\$[\d,]+\s+(?:daily|weekly|monthly|per\s+(?:day|week))/i,
    /I\s+(?:made|earned|got)\s+\$[\d,]+\s+(?:in|within)\s+\d+\s+(?:day|week|hour)/i,
    /(?:congratulations?|you(?:'ve| have) been (?:selected|chosen))\b.{0,80}(?:prize|gift|reward|winner|claim)/i,
    /(?:sub(?:scribe)?|follow).{0,15}(?:back|4|for).{0,15}(?:sub(?:scribe)?|follow)/i,
    /(?:bit\.ly|tinyurl\.com|rb\.gy|cutt\.ly|ow\.ly)\//i,
    /(.)\1{7,}/,
    /(?:dm\s+me|message\s+me|text\s+me|contact\s+me)\b.{0,40}\+?\d{5,}/i,
  ];

  // ── Linguistic scorer (Checker-AI — linguisticScorer.js) ──────────────────
  const LLM_FILLER_PATTERNS = [
    /\bof course\b/i,
    /\bcertainly\b/i,
    /\bsure(?:ly)?\b/i,
    /\bit(?:'s| is) (?:worth noting|important to note|crucial to)\b/i,
    /\bfeel free to\b/i,
    /\bhope this helps\b/i,
    /\blet(?:'s| us) (?:dive|explore|delve)\b/i,
    /\bin (?:conclusion|summary|essence)\b/i,
    /\bfirstly[,\s]/i,
    /\bsecondly[,\s]/i,
    /\bthirdly[,\s]/i,
    /\bmoreover\b/i,
    /\bfurthermore\b/i,
    /\bnevertheless\b/i,
    /\bit is (?:worth|essential|important)\b/i,
  ];

  function _clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

  function _tokenizeSentences(text) {
    return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
  }

  function _tokenizeWords(text) {
    return text.toLowerCase().match(/\b[a-z']+\b/g) ?? [];
  }

  function _stddev(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  }

  function _burstinessScore(sentences) {
    if (sentences.length < 2) return 0.5;
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const cv = mean > 0 ? _stddev(lengths) / mean : 0;
    return _clamp(1 - cv / 0.5, 0, 1);
  }

  function _lexicalDiversityScore(words) {
    if (words.length === 0) return 0;
    return _clamp(1 - (new Set(words).size / words.length) / 0.5, 0, 1);
  }

  function _fillerPhraseScore(text, wordCount) {
    const hits = LLM_FILLER_PATTERNS.filter(rx => rx.test(text)).length;
    return _clamp((hits / Math.max(wordCount, 1)) * 100 / 3, 0, 1);
  }

  function _punctuationUniformityScore(text) {
    const all = text.match(/[.,;:!?()\-–—]/g) ?? [];
    if (all.length === 0) return 0.5;
    return _clamp(all.filter(p => p === ',' || p === '.').length / all.length, 0, 1);
  }

  // ── Classifier (TF-IDF + Logistic Regression, lazy-loaded) ──────────────────
  let _clf = null;

  fetch(chrome.runtime.getURL('classifier_model.json'))
    .then(r => r.json())
    .then(m => { _clf = m; })
    .catch(() => {});

  function _clfPreprocess(text) {
    text = text.toLowerCase();
    text = text.replace(/https?:\/\/\S+|www\.\S+/g, ' url ');
    text = text.replace(/[\+]?[\d][\d\s\-\.\(\)]{8,}\d/g, ' phone ');
    text = text.replace(/@\w{3,}/g, ' handle ');
    text = text.replace(/t\.me\/\S+|wa\.me\/\S+|bit\.ly\/\S+|tinyurl\.com\/\S+|rb\.gy\/\S+|cutt\.ly\/\S+|ow\.ly\/\S+/g, ' shortlink ');
    text = text.replace(/(.)\1{5,}/g, '$1$1$1');
    text = text.replace(/[^\w\s]/g, ' ');
    return text.trim();
  }

  function _clfTokenize(text) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const tokens = [...words];
    for (let i = 0; i < words.length - 1; i++) tokens.push(words[i] + ' ' + words[i + 1]);
    return tokens;
  }

  function _clfPredict(text) {
    if (!_clf || text.length < 8) return null;
    const tokens = _clfTokenize(_clfPreprocess(text));
    const tf = {};
    for (const t of tokens) {
      if (t in _clf.vocab) tf[t] = (tf[t] || 0) + 1;
    }
    const vec = new Float64Array(_clf.idf.length);
    let norm = 0;
    for (const [t, count] of Object.entries(tf)) {
      const idx = _clf.vocab[t];
      const v = (1 + Math.log(count)) * _clf.idf[idx];
      vec[idx] = v;
      norm += v * v;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    const scores = _clf.intercept.map((b, c) => {
      let s = b;
      for (let i = 0; i < vec.length; i++) s += vec[i] * _clf.coef[c][i];
      return s;
    });
    const max = Math.max(...scores);
    const exp = scores.map(s => Math.exp(s - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    const probs = exp.map(e => e / sum);
    const best = probs.indexOf(Math.max(...probs));
    return {
      label: _clf.classes[best],
      confidence: Math.round(probs[best] * 100),
      probs: Object.fromEntries(_clf.classes.map((c, i) => [c, Math.round(probs[i] * 100)])),
    };
  }

  // ── Runtime state ──────────────────────────────────────────────────────────
  let commentsEnabled = true;
  let panelDock       = 'right';

  // ── Detection result cache per badge element ──────────────────────────────
  const detectionMeta = new WeakMap();

  // ── Badge factory ──────────────────────────────────────────────────────────
  const BADGE_TITLES = {
    ai:    'Likely AI-written — click for details',
    bot:   'Bot or spam pattern detected — click for details',
    human: 'Appears human-written — click for details',
  };

  function makeBadge(status) {
    const el       = document.createElement('span');
    el.className   = `ytabd-badge ytabd-${status}`;
    el.textContent = status.toUpperCase();
    el.title       = BADGE_TITLES[status] || '';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const meta = detectionMeta.get(el);
      if (meta) showPanel(meta);
    });
    return el;
  }

  function attachMeta(badge, meta) {
    detectionMeta.set(badge, meta);
    badge.classList.add('ytabd-clickable');
  }

  // ── Side panel ─────────────────────────────────────────────────────────────
  let _panel = null;

  function getPanel() {
    if (_panel) return _panel;
    _panel = document.createElement('div');
    _panel.id = 'ytabd-panel';
    _panel.innerHTML = `
      <div class="ytabd-panel-header">
        <span class="ytabd-panel-title">&#128269; Detection Report</span>
        <div class="ytabd-panel-controls">
          <button class="ytabd-dock-btn" data-dock="left"   title="Dock left">&#9664;</button>
          <button class="ytabd-dock-btn" data-dock="top"    title="Dock top">&#9650;</button>
          <button class="ytabd-dock-btn" data-dock="bottom" title="Dock bottom">&#9660;</button>
          <button class="ytabd-dock-btn" data-dock="right"  title="Dock right">&#9654;</button>
          <button id="ytabd-close" title="Close">&#10005;</button>
        </div>
      </div>
      <div class="ytabd-panel-body"></div>`;

    _panel.querySelectorAll('.ytabd-dock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        panelDock = btn.dataset.dock;
        _applyDock();
        chrome.storage.local.set({ panelDock });
      });
    });
    _panel.querySelector('#ytabd-close').addEventListener('click', hidePanel);
    document.body.appendChild(_panel);
    _applyDock();
    return _panel;
  }

  function _applyDock() {
    if (!_panel) return;
    _panel.className = `ytabd-panel ytabd-panel-${panelDock}` +
      (_panel.classList.contains('ytabd-panel-visible') ? ' ytabd-panel-visible' : '');
    _panel.querySelectorAll('.ytabd-dock-btn').forEach(b => {
      b.classList.toggle('ytabd-dock-active', b.dataset.dock === panelDock);
    });
  }

  function hidePanel() {
    if (_panel) _panel.classList.remove('ytabd-panel-visible');
  }

  function showPanel(meta) {
    const panel = getPanel();
    _applyDock();
    panel.querySelector('.ytabd-panel-body').innerHTML = _buildBody(meta);
    panel.classList.add('ytabd-panel-visible');
  }

  function _buildBody(meta) {
    const statusLabel = (meta.status || '?').toUpperCase();
    const typeLabel   = 'Comment';

    let html = `
      <div class="ytabd-panel-result">
        <span class="ytabd-badge ytabd-${meta.status}">${statusLabel}</span>
        <span class="ytabd-panel-type">${typeLabel}</span>
      </div>`;

    if (meta.method === 'bot-pattern') {
      html += _section('Detection method',
        `<div class="ytabd-panel-value">Bot / spam pattern</div>` +
        `<div class="ytabd-panel-hint">The comment matched a known spam pattern: crypto or trading scam, phone number, link shortener, repeated characters, or solicitation phrase.</div>`);
    } else if (meta.method === 'classifier' && meta.probs) {
      const p = meta.probs;
      html += _section('Detection method',
        `<div class="ytabd-panel-value">Trained classifier</div>` +
        `<div class="ytabd-panel-hint">TF-IDF + Logistic Regression trained on labeled YouTube comments. Confidence: ${meta.confidence}%</div>`);
      html += _section('Class probabilities',
        _scoreRow('AI-generated',  p.ai    ?? 0, null, 'Generic, perfect grammar, no specific references') +
        _scoreRow('Bot / spam',    p.bot   ?? 0, null, 'Promotional, links, phone numbers, solicitation') +
        _scoreRow('Human-written', p.human ?? 0, null, 'Informal, personal, references specific content')
      );
    } else if (meta.method === 'linguistic' && meta.scores) {
      const s = meta.scores;
      html += _section('Detection method',
        `<div class="ytabd-panel-value">Linguistic analysis (fallback)</div>` +
        `<div class="ytabd-panel-hint">Classifier not yet loaded or confidence too low. Four LLM-tell signals weighted into a 0–100 AI score. Threshold: 60.</div>`);
      html += _section('Score breakdown',
        _scoreRow('Sentence burstiness',   s.burstiness,            35, 'Uniform sentence lengths → AI') +
        _scoreRow('Lexical diversity',      s.lexicalDiversity,      30, 'Narrow vocabulary → AI') +
        _scoreRow('Filler phrases',         s.fillerPhrases,         20, '"of course", "furthermore", "moreover"…') +
        _scoreRow('Punctuation uniformity', s.punctuationUniformity, 15, 'Heavy comma / period usage → AI') +
        `<div class="ytabd-panel-divider"></div>` +
        _scoreRow(
          'Total AI score', s.total, null,
          `Threshold 60% — ${s.total >= 60 ? 'above → flagged AI' : 'below → flagged Human'}`,
          true
        )
      );
    }

    return html;
  }

  function _section(label, inner) {
    return `<div class="ytabd-panel-section"><div class="ytabd-panel-label">${label}</div>${inner}</div>`;
  }

  function _scoreRow(label, value, weight, hint, bold = false) {
    const wtag = weight !== null ? ` <span class="ytabd-weight">&times;${weight}%</span>` : '';
    const cls  = isNaN(value) ? 'ytabd-bar-lo' : (value >= 60 ? 'ytabd-bar-hi' : 'ytabd-bar-lo');
    return `
      <div class="ytabd-score-row${bold ? ' ytabd-score-total' : ''}">
        <div class="ytabd-score-label">${label}${wtag}</div>
        <div class="ytabd-bar-row">
          <div class="ytabd-bar-track"><div class="ytabd-bar-fill ${cls}" style="width:${value}%"></div></div>
          <span class="ytabd-bar-val">${value}%</span>
        </div>
        <div class="ytabd-panel-hint">${hint}</div>
      </div>`;
  }

  // ── Comment analysis ───────────────────────────────────────────────────────
  function analyzeComment(text) {
    if (!text || text.length < 4) {
      return { status: 'human', method: 'linguistic',
        scores: { burstiness: 0, lexicalDiversity: 0, fillerPhrases: 0, punctuationUniformity: 0, total: 0 } };
    }
    // Stage 1: bot-pattern regex (fast, always runs)
    for (const p of BOT_PATTERNS) {
      if (p.test(text)) return { status: 'bot', method: 'bot-pattern' };
    }
    // Stage 2: trained classifier (when model is loaded)
    const clf = _clfPredict(text);
    if (clf && clf.confidence >= 65) {
      return { status: clf.label, method: 'classifier', confidence: clf.confidence, probs: clf.probs };
    }
    // Stage 3: linguistic fallback (model not yet loaded, or low-confidence prediction)
    const sentences = _tokenizeSentences(text);
    const words     = _tokenizeWords(text);
    const b = _burstinessScore(sentences);
    const l = _lexicalDiversityScore(words);
    const f = _fillerPhraseScore(text, words.length);
    const p = _punctuationUniformityScore(text);
    const total = b * 0.35 + l * 0.30 + f * 0.20 + p * 0.15;
    return {
      status: total > 0.60 ? 'ai' : 'human',
      method: 'linguistic',
      scores: {
        burstiness:            Math.round(b     * 100),
        lexicalDiversity:      Math.round(l     * 100),
        fillerPhrases:         Math.round(f     * 100),
        punctuationUniformity: Math.round(p     * 100),
        total:                 Math.round(total * 100),
      },
    };
  }

  // ── Scan comments ──────────────────────────────────────────────────────────
  function scanComments() {
    if (!commentsEnabled) return;
    document.querySelectorAll(COMMENT_SEL).forEach(el => {
      const textEl = el.querySelector('#content-text, #comment-content, yt-attributed-string');
      const timeEl = el.querySelector('#published-time-text, .published-time-text');
      if (!textEl || !timeEl) return;
      const result = analyzeComment(textEl.textContent);
      el.setAttribute(ATTR, result.status);
      if (!timeEl.querySelector('.ytabd-badge')) {
        const badge = makeBadge(result.status);
        attachMeta(badge, { ...result, type: 'comment' });
        timeEl.appendChild(badge);
      }
    });
  }

  // ── MutationObserver ──────────────────────────────────────────────────────
  let timer = null;
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.addedNodes.length) {
        clearTimeout(timer);
        timer = setTimeout(scanComments, 280);
        return;
      }
    }
  });

  window.addEventListener('yt-navigate-finish', () => {
    document.querySelectorAll(`[${ATTR}]`).forEach(el => el.removeAttribute(ATTR));
    document.querySelectorAll('.ytabd-badge').forEach(el => el.remove());
    hidePanel();
    clearTimeout(timer);
    timer = setTimeout(scanComments, 400);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.moduleState)
      commentsEnabled = changes.moduleState.newValue?.comments ?? commentsEnabled;
    if (changes.panelDock) {
      panelDock = changes.panelDock.newValue || 'right';
      _applyDock();
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    chrome.storage.local.get(['moduleState', 'panelDock'], (r) => {
      if (r.moduleState)  commentsEnabled = r.moduleState.comments ?? true;
      if (r.panelDock)    panelDock       = r.panelDock;
      observer.observe(document.documentElement, { childList: true, subtree: true });
      scanComments();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
