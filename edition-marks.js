/* ============================================================
   edition-marks.js  ·  phase 5c — drawing

   Needs the Supabase client first:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

   Hooks (all optional — missing ones are skipped):
     [data-edition="marks-toggle"]                 show / hide the wall
     [data-edition="marks-hide"]                   hide it
     [data-edition="marks-box"]                    the toolbar, shown with the wall
     [data-edition="tool"][data-tool="pen|erase"]  tools
     [data-edition="sticker"][data-sticker="…"]    star | heart | reg
     [data-edition="width"]                        range input, 1–5
     [data-edition="undo"]                         undo the last thing you did
     [data-edition="dim-toggle"]                   dim the cards
     [data-edition="marks-count"]                  live count

   The script only ever toggles the class `is-active` on tool
   buttons. Every visual decision stays in your CSS.

   Classes set on <html>:  .marks-on  .cards-dim  .marks-armed
   ============================================================ */
(function () {
  'use strict';

  var Edition = window.Edition = window.Edition || {};
  function qsa(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  }
  function qs(sel) { return document.querySelector(sel); }

  /* Your text buttons wrap their label in a .buttontext child, with the
     brackets as siblings, so write into that when it exists. */
  function labelEl(el) { return el.querySelector('.buttontext') || el; }
  function setLabel(el, text) {
    if (!el || !text) return;
    labelEl(el).textContent = text;
  }
  function rememberLabel(el) {
    if (el && !el.__label0) el.__label0 = labelEl(el).textContent;
  }

  var CFG = {
    url: 'https://jtelqybifbiazhmltear.supabase.co',
    key: 'sb_publishable_YS4zJgl-oPOL2GRKvhNqoQ_uD85_ZEO',
    clearCode: 'kumeyaay',
    pollMs: 8000,
    maxMarks: 4000,

    /* stroke weights as a fraction of the square. On a 1440 square
       these are roughly 1.9 / 2.9 / 4.3 / 6.3 / 9.2 px. */
    weights: [0.00065, 0.0010, 0.0015, 0.0022, 0.0032],
    defaultWeight: 2,

    /* stickers are a fixed size — deliberately not tied to the weight
       slider, so the slider only ever means "pen" */
    stickerSize: 0.0225,
    stickerWeight: 0.0013,

    /* the eraser reaches further with a heavier pen selected */
    eraseBase: 0.018,
    eraseGrowth: 0.35,

    /* how close together captured points may be before one is dropped.
       A raw drag emits hundreds of near-identical points; unsimplified
       strokes would blow past the 20KB row limit and make the wall slow
       to load. */
    minPointGap: 0.0035,
    simplifyTol: 0.0016,

    undoWindowMs: 28000,     /* must stay under the 30s SQL policy */

    /* While a tool is armed these stop swallowing the pointer, so the
       canvas underneath can actually be drawn on. The nav is left alone
       — the toolbar lives in it and has to stay clickable. */
    passThrough: '.edition-card-body, .edition-footer',

    labels: {
      marksOn:  'HIDE ANNOTATIONS',
      marksOff: null,               /* null = keep whatever is in the markup */
      cardsOn:  'SHOW CARDS',
      cardsOff: null
    }
  };
  Edition.marksConfig = CFG;

  function currentTerm() {
    var d = new Date(), m = d.getMonth();
    return d.getFullYear() + '-' + (m < 5 ? 'spring' : (m < 7 ? 'summer' : 'fall'));
  }
  var TERM = currentTerm();
  Edition.marksTerm = TERM;

  function who() {
    try {
      var k = localStorage.getItem('edition:who');
      if (!k) { k = 'u' + Math.random().toString(36).slice(2, 10);
                localStorage.setItem('edition:who', k); }
      return k;
    } catch (e) { return 'u' + Math.random().toString(36).slice(2, 10); }
  }
  var WHO = who();

  /* ============================================================
     CANVASES
     ============================================================ */
  var wrap, cCommit, cLive, xCommit, xLive;
  var side = 0, offX = 0, offY = 0, dpr = 1;

  function buildCanvases() {
    wrap = document.createElement('div');
    wrap.className = 'edi-marks-layer';
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:0;pointer-events:none;display:none';
    cCommit = document.createElement('canvas');
    cLive = document.createElement('canvas');
    [cCommit, cLive].forEach(function (c) {
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      wrap.appendChild(c);
    });
    xCommit = cCommit.getContext('2d');
    xLive = cLive.getContext('2d');
    document.body.insertBefore(wrap, document.body.firstChild);
  }

  function measure() {
    var w = window.innerWidth, h = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    side = Math.max(w, h);
    offX = (w - side) / 2;
    offY = (h - side) / 2;
    [cCommit, cLive].forEach(function (c) {
      var bw = Math.round(w * dpr), bh = Math.round(h * dpr);
      if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
      c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }
  function X(u) { return offX + u * side; }
  function Y(v) { return offY + v * side; }
  function toU(px) { return (px - offX) / side; }
  function toV(py) { return (py - offY) / side; }

  var INK = '#141210';
  function readInk() {
    var s = getComputedStyle(document.documentElement);
    var v = s.getPropertyValue('--_edition-colors---ink').trim() ||
            s.getPropertyValue('--ink').trim();
    if (v) INK = v;
  }
  window.addEventListener('edition:palette', function (e) {
    if (e.detail && e.detail.ink) INK = e.detail.ink;
    renderCommitted();
  });

  /* ============================================================
     STICKERS
     ============================================================ */
  var STICKERS = {
    star: function (c, s) {
      c.beginPath();
      for (var i = 0; i < 16; i++) {
        var a = -Math.PI / 2 + i / 16 * Math.PI * 2;
        var r = (i % 2 ? s * 0.16 : s * 0.5);
        i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r)
          : c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath(); c.fill();
    },
    heart: function (c, s) {
      var k = s * 0.5;
      c.beginPath();
      c.moveTo(0, k * 0.85);
      c.bezierCurveTo(-k * 1.25, k * 0.05, -k * 0.62, -k * 0.92, 0, -k * 0.3);
      c.bezierCurveTo(k * 0.62, -k * 0.92, k * 1.25, k * 0.05, 0, k * 0.85);
      c.stroke();
    },
    reg: function (c, s) {
      var k = s * 0.5;
      c.beginPath(); c.arc(0, 0, k * 0.52, 0, 7); c.stroke();
      c.beginPath();
      c.moveTo(-k, 0); c.lineTo(k, 0);
      c.moveTo(0, -k); c.lineTo(0, k);
      c.stroke();
    }
  };
  Edition.markStickers = STICKERS;

  function drawMark(ctx, m) {
    var d = m.data || m;
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 1;

    if (m.type === 'stroke') {
      var pts = d.pts || [];
      if (pts.length < 2) return;
      ctx.lineWidth = Math.max(0.7, (d.w || 0.002) * side);
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var x = X(pts[i][0]), y = Y(pts[i][1]);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      return;
    }
    if (m.type === 'sticker') {
      var fn = STICKERS[d.k];
      if (!fn) return;
      ctx.save();
      ctx.translate(X(d.u), Y(d.v));
      ctx.lineWidth = Math.max(0.7, (d.w || CFG.stickerWeight) * side);
      fn(ctx, (d.s || CFG.stickerSize) * side);
      ctx.restore();
    }
  }
  Edition.drawMark = drawMark;

  var MARKS = [];
  function renderCommitted() {
    if (!xCommit) return;
    xCommit.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (var i = 0; i < MARKS.length; i++) drawMark(xCommit, MARKS[i]);
    var el = document.querySelector('[data-edition="marks-count"]');
    if (el) el.textContent = MARKS.length;
  }
  function clearLive() {
    if (xLive) xLive.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
  Edition.renderMarks = renderCommitted;

  /* ============================================================
     SUPABASE
     ============================================================ */
  var sb = null;
  function db() {
    if (sb) return sb;
    if (!window.supabase || !window.supabase.createClient) return null;
    sb = window.supabase.createClient(CFG.url, CFG.key);
    return sb;
  }

  var loading = false;
  function load() {
    var c = db();
    if (!c || loading || drawing) return Promise.resolve();
    loading = true;
    return c.from('marks')
      .select('id,type,data,ts')
      .eq('term', TERM)
      .order('ts', { ascending: true })
      .limit(CFG.maxMarks)
      .then(function (res) {
        loading = false;
        if (res.error) { console.warn('[marks] load:', res.error.message); return; }
        var remote = res.data || [];
        /* keep anything of ours that has not round-tripped yet */
        var ids = {};
        remote.forEach(function (r) { ids[r.id] = 1; });
        var pending = MARKS.filter(function (m) { return m.__pending && !ids[m.id]; });
        MARKS = remote.concat(pending);
        renderCommitted();
      }, function (e) { loading = false; console.warn('[marks] load failed', e); });
  }
  Edition.loadMarks = load;

  function rid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  /* Marks appear immediately and sync in the background — nothing ever
     waits on the network. If the write fails the mark is pulled back
     out, so the wall never lies about what was saved. */
  function commit(mark) {
    mark.__pending = true;
    MARKS.push(mark);
    renderCommitted();
    var c = db();
    if (!c) return;
    c.from('marks').insert({
      id: mark.id, term: TERM, who: WHO, type: mark.type, data: mark.data
    }).then(function (res) {
      if (res.error) {
        console.warn('[marks] save failed:', res.error.message);
        MARKS = MARKS.filter(function (m) { return m.id !== mark.id; });
        renderCommitted();
        return;
      }
      delete mark.__pending;
    });
  }

  /* A silent no-op is the failure mode to guard against here: if row
     level security rejects the update, supabase-js still resolves
     without an error and simply changes nothing — so the next poll
     brings the mark straight back. Asking for the affected rows makes
     that visible instead of mysterious. */
  function softDelete(ids) {
    if (!ids.length) return;
    var gone = MARKS.filter(function (m) { return ids.indexOf(m.id) !== -1; });
    MARKS = MARKS.filter(function (m) { return ids.indexOf(m.id) === -1; });
    renderCommitted();
    var c = db();
    if (!c) return;
    c.from('marks')
      .update({ deleted_at: new Date().toISOString(), deleted_by: WHO })
      .in('id', ids)
      .select('id')
      .then(function (res) {
        if (res.error) {
          console.warn('[marks] erase rejected:', res.error.message);
        } else if (!res.data || res.data.length < ids.length) {
          console.warn('[marks] erase changed ' + ((res.data || []).length) +
            ' of ' + ids.length + ' rows — the update policy is blocking it. ' +
            'Run Edition.testErase() for the reason.');
          /* put them back rather than pretend they are gone */
          MARKS = MARKS.concat(gone);
          renderCommitted();
        }
      });
  }

  function restore(ids) {
    var c = db();
    if (!c || !ids.length) return;
    c.from('marks')
      .update({ deleted_at: null, deleted_by: null })
      .in('id', ids)
      .select('id')
      .then(function (res) {
        if (res.error) { console.warn('[marks] restore rejected:', res.error.message); return; }
        if (!res.data || !res.data.length) {
          console.warn('[marks] restore changed no rows — past the 30s window, ' +
                       'or the "undo recent erase" policy is missing.');
        }
        load();
      });
  }

  /* ============================================================
     UNDO — session only, as agreed
     ============================================================ */
  var UNDO = [];
  function pushUndo(entry) {
    entry.at = Date.now();
    UNDO.push(entry);
    if (UNDO.length > 60) UNDO.shift();
  }
  function undo() {
    var e = UNDO.pop();
    if (!e) return;
    if (e.kind === 'draw') { softDelete([e.id]); return; }
    if (e.kind === 'erase') {
      /* the database only allows un-erasing very recently, so an old
         entry is skipped rather than half-applied */
      if (Date.now() - e.at > CFG.undoWindowMs) { undo(); return; }
      restore(e.ids);
    }
  }
  Edition.undoMark = undo;

  /* ============================================================
     TOOLS
     ============================================================ */
  var tool = null;            /* 'pen' | 'erase' | null */
  var sticker = null;         /* 'star' | 'heart' | 'reg' | null */
  var weight = CFG.defaultWeight;
  var drawing = false, live = null;

  function armed() { return tool !== null || sticker !== null; }

  function syncArm() {
    var on = armed();
    wrap.style.pointerEvents = on ? 'auto' : 'none';
    /* the content sections sit above the canvas, so they have to stop
       catching the pointer while a tool is armed */
    qsa(CFG.passThrough).forEach(function (el) {
      el.style.pointerEvents = on ? 'none' : '';
    });
    /* stop the browser scrolling the page from a drag on the canvas */
    wrap.style.touchAction = on ? 'none' : '';
    document.documentElement.classList.toggle('marks-armed', on);
    document.querySelectorAll('[data-edition="tool"]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-tool') === tool);
    });
    document.querySelectorAll('[data-edition="sticker"]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-sticker') === sticker);
    });
  }

  /* tools and stickers are mutually exclusive; clicking the active one
     releases it, which is also how you get scrolling back on a phone */
  function selectTool(t) {
    if (tool === t) { tool = null; } else { tool = t; sticker = null; }
    syncArm();
  }
  function selectSticker(k) {
    if (sticker === k) { sticker = null; } else { sticker = k; tool = null; }
    syncArm();
  }
  Edition.selectTool = selectTool;
  Edition.selectSticker = selectSticker;


  /* ------------------------------------------------------------
     Weight control.

     Works either with a real <input type="range"> or with a hand-built
     slider — a track element carrying data-edition="width" and a knob
     inside it carrying data-edition="width-knob". The two end icons
     can also step the weight up and down.
     ------------------------------------------------------------ */
  var track = null, knob = null;

  function steps() { return CFG.weights.length; }

  function setWeight(n, silent) {
    weight = Math.max(1, Math.min(steps(), Math.round(n)));
    if (track && track.tagName === 'INPUT') {
      track.value = weight;
    } else if (track && knob) {
      var tw = track.clientWidth || 50;
      var kw = knob.offsetWidth || 12;
      var span = Math.max(0, tw - kw);
      knob.style.position = 'absolute';
      knob.style.left = (span * (weight - 1) / (steps() - 1)) + 'px';
    }
    qsa('[data-edition="width-step"]').forEach(function (el) {
      el.textContent = weight;
    });
    if (!silent) document.documentElement.setAttribute('data-weight', weight);
  }
  Edition.setWeight = setWeight;

  function weightFromX(clientX) {
    var r = track.getBoundingClientRect();
    var kw = knob ? (knob.offsetWidth || 12) : 12;
    var span = Math.max(1, r.width - kw);
    var x = clientX - r.left - kw / 2;
    return 1 + Math.round((Math.max(0, Math.min(span, x)) / span) * (steps() - 1));
  }

  function wireWidth() {
    track = qs('[data-edition="width"]');
    knob = qs('[data-edition="width-knob"]');

    if (track && track.tagName === 'INPUT') {
      track.min = 1; track.max = steps(); track.step = 1;
      weight = parseInt(track.value, 10) || CFG.defaultWeight;
      track.addEventListener('input', function () {
        setWeight(parseInt(track.value, 10) || CFG.defaultWeight);
      });
    } else if (track) {
      /* the track needs to be a positioning context for the knob */
      if (getComputedStyle(track).position === 'static') track.style.position = 'relative';
      track.style.cursor = 'pointer';
      track.style.touchAction = 'none';

      var dragging = false;
      track.addEventListener('pointerdown', function (e) {
        dragging = true;
        try { track.setPointerCapture(e.pointerId); } catch (err) {}
        setWeight(weightFromX(e.clientX));
        e.preventDefault();
      });
      track.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        setWeight(weightFromX(e.clientX));
        e.preventDefault();
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
        track.addEventListener(ev, function () { dragging = false; });
      });
    }

    /* the two end icons step the weight */
    qsa('[data-edition="width-down"]').forEach(function (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) { e.preventDefault(); setWeight(weight - 1); });
    });
    qsa('[data-edition="width-up"]').forEach(function (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) { e.preventDefault(); setWeight(weight + 1); });
    });

    setWeight(weight);
  }

  /* ---------- path simplification (Douglas–Peucker) ---------- */
  function perp(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var L = dx * dx + dy * dy;
    if (L === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    var t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }
  function simplify(pts, tol) {
    if (pts.length < 3) return pts;
    var keep = new Array(pts.length);
    keep[0] = keep[pts.length - 1] = true;
    (function rec(lo, hi) {
      if (hi <= lo + 1) return;
      var worst = -1, idx = -1;
      for (var i = lo + 1; i < hi; i++) {
        var d = perp(pts[i], pts[lo], pts[hi]);
        if (d > worst) { worst = d; idx = i; }
      }
      if (worst > tol) { keep[idx] = true; rec(lo, idx); rec(idx, hi); }
    })(0, pts.length - 1);
    return pts.filter(function (_, i) { return keep[i]; });
  }

  /* ---------- erasing ---------- */
  function eraseRadius() {
    return CFG.eraseBase * (1 + (weight - 1) * CFG.eraseGrowth);
  }
  function eraseAt(u, v) {
    var r = eraseRadius(), hit = [];
    for (var i = 0; i < MARKS.length; i++) {
      var m = MARKS[i], d = m.data || {};
      if (m.type === 'stroke') {
        var pts = d.pts || [];
        for (var k = 0; k < pts.length; k++) {
          if (Math.hypot(pts[k][0] - u, pts[k][1] - v) < r) { hit.push(m.id); break; }
        }
      } else if (m.type === 'sticker') {
        if (Math.hypot(d.u - u, d.v - v) < r + (d.s || CFG.stickerSize) * 0.5) hit.push(m.id);
      }
    }
    if (hit.length) { softDelete(hit); pushUndo({ kind: 'erase', ids: hit }); }
  }

  /* ---------- pointer ---------- */
  function pos(e) {
    var r = cLive.getBoundingClientRect();
    return [toU(e.clientX - r.left), toV(e.clientY - r.top)];
  }

  function onDown(e) {
    if (!armed()) return;
    e.preventDefault();
    var p = pos(e);

    if (sticker) {
      var m = {
        id: rid(), type: 'sticker',
        data: { k: sticker, u: +p[0].toFixed(4), v: +p[1].toFixed(4),
                s: CFG.stickerSize, w: CFG.stickerWeight }
      };
      commit(m);
      pushUndo({ kind: 'draw', id: m.id });
      return;                       /* the sticker stays armed */
    }
    if (tool === 'erase') { drawing = true; eraseAt(p[0], p[1]); return; }
    if (tool === 'pen') {
      drawing = true;
      live = { w: CFG.weights[weight - 1], pts: [p] };
      try { cLive.setPointerCapture(e.pointerId); } catch (err) {}
    }
  }

  function onMove(e) {
    if (!drawing) return;
    e.preventDefault();
    var p = pos(e);
    if (tool === 'erase') { eraseAt(p[0], p[1]); return; }
    if (!live) return;
    var last = live.pts[live.pts.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < CFG.minPointGap) return;
    live.pts.push(p);
    /* only the light layer repaints while the pen is down */
    clearLive();
    drawMark(xLive, { type: 'stroke', data: live });
  }

  function onUp() {
    if (!drawing) return;
    drawing = false;
    if (tool === 'erase' || !live) { live = null; return; }
    var pts = simplify(live.pts, CFG.simplifyTol).map(function (p) {
      return [+p[0].toFixed(4), +p[1].toFixed(4)];
    });
    var w = live.w;
    live = null;
    clearLive();
    if (pts.length < 2) return;
    var m = { id: rid(), type: 'stroke', data: { w: w, pts: pts } };
    commit(m);
    pushUndo({ kind: 'draw', id: m.id });
  }

  /* ============================================================
     UI
     ============================================================ */
  var visible = false, dimmed = false, poll = null;

  function setVisible(on) {
    visible = !!on;
    document.documentElement.classList.toggle('marks-on', visible);
    wrap.style.display = visible ? 'block' : 'none';
    var box = qs('[data-edition="marks-box"]');
    if (box) box.style.display = visible ? '' : 'none';
    qsa('[data-edition="marks-toggle"]').forEach(function (el) {
      rememberLabel(el);
      var on = el.getAttribute('data-label-on') || CFG.labels.marksOn;
      var off = el.getAttribute('data-label-off') || CFG.labels.marksOff || el.__label0;
      setLabel(el, visible ? on : off);
      el.classList.toggle('is-active', visible);
    });
    if (!visible) {
      setDim(false);
      tool = null; sticker = null; syncArm();
    }
    clearInterval(poll);
    if (visible) {
      load();
      poll = setInterval(function () { if (!document.hidden) load(); }, CFG.pollMs);
    }
  }
  function setDim(on) {
    dimmed = !!on;
    document.documentElement.classList.toggle('cards-hidden', dimmed);
    document.documentElement.classList.remove('cards-dim');   /* superseded */
    qsa('[data-edition="dim-toggle"],[data-edition="hide-cards"]').forEach(function (b) {
      b.classList.toggle('is-active', dimmed);
      rememberLabel(b);
      var on = b.getAttribute('data-label-on') || CFG.labels.cardsOn;
      var off = b.getAttribute('data-label-off') || CFG.labels.cardsOff || b.__label0;
      setLabel(b, dimmed ? on : off);
    });
  }
  Edition.showMarks = setVisible;
  Edition.hideCards = setDim;
  Edition.dimCards = setDim;

  function wire() {
    qsa('[data-edition="marks-toggle"]').forEach(function (t) {
      rememberLabel(t);
      t.addEventListener('click', function (e) { e.preventDefault(); setVisible(!visible); });
    });
    var h = document.querySelector('[data-edition="marks-hide"]');
    if (h) h.addEventListener('click', function (e) { e.preventDefault(); setVisible(false); });
    qsa('[data-edition="dim-toggle"],[data-edition="hide-cards"]').forEach(function (d) {
      d.addEventListener('click', function (e) { e.preventDefault(); setDim(!dimmed); });
    });
    var u = document.querySelector('[data-edition="undo"]');
    if (u) u.addEventListener('click', function (e) { e.preventDefault(); undo(); });

    document.querySelectorAll('[data-edition="tool"]').forEach(function (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) {
        e.preventDefault(); selectTool(el.getAttribute('data-tool'));
      });
    });
    document.querySelectorAll('[data-edition="sticker"]').forEach(function (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) {
        e.preventDefault(); selectSticker(el.getAttribute('data-sticker'));
      });
    });
    wireWidth();

    cLive.addEventListener('pointerdown', onDown);
    cLive.addEventListener('pointermove', onMove);
    cLive.addEventListener('pointerup', onUp);
    cLive.addEventListener('pointercancel', onUp);
    cLive.addEventListener('pointerleave', onUp);

    document.addEventListener('keydown', function (e) {
      if (!visible) return;
      if (e.key === 'Escape') { tool = null; sticker = null; syncArm(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    });
  }

  function maybeClear() {
    var code = new URLSearchParams(location.search).get('clear');
    if (!code || code !== CFG.clearCode) return;
    var c = db();
    if (!c) return;
    if (!window.confirm('Erase every mark for ' + TERM + '?')) return;
    c.from('marks')
      .update({ deleted_at: new Date().toISOString(), deleted_by: 'clear-code' })
      .eq('term', TERM).is('deleted_at', null)
      .then(function (res) {
        if (res.error) { alert('Clear failed: ' + res.error.message); return; }
        MARKS = []; renderCommitted();
        alert('Wall cleared for ' + TERM + '. Restorable from the SQL editor.');
      });
  }

  var rzTimer;
  function onResize() {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(function () {
      measure(); renderCommitted(); clearLive(); setWeight(weight, true);
    }, 120);
  }

  function boot() {
    buildCanvases();
    readInk();
    measure();
    wire();
    syncArm();
    setVisible(false);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    maybeClear();
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);

  /* ============================================================
     Console helpers
     ============================================================ */
  Edition.marksStatus = function () {
    return {
      term: TERM, connected: !!db(), visible: visible, dimmed: dimmed,
      tool: tool, sticker: sticker, weight: weight,
      armed: armed(), loaded: MARKS.length, undoDepth: UNDO.length,
      passThroughCount: qsa(CFG.passThrough).length,
      square: Math.round(side), dpr: dpr
    };
  };
  /* Reports which hooks were found. The fastest way to see why a
     button is doing nothing. */
  Edition.marksCheck = function () {
    var want = [
      ['marks-toggle', '[data-edition="marks-toggle"]'],
      ['marks-box',    '[data-edition="marks-box"]'],
      ['tool pen',     '[data-edition="tool"][data-tool="pen"]'],
      ['tool erase',   '[data-edition="tool"][data-tool="erase"]'],
      ['sticker star', '[data-edition="sticker"][data-sticker="star"]'],
      ['sticker heart','[data-edition="sticker"][data-sticker="heart"]'],
      ['sticker reg',  '[data-edition="sticker"][data-sticker="reg"]'],
      ['width track',  '[data-edition="width"]'],
      ['width knob',   '[data-edition="width-knob"]'],
      ['width down',   '[data-edition="width-down"]'],
      ['width up',     '[data-edition="width-up"]'],
      ['undo',         '[data-edition="undo"]'],
      ['hide cards',   '[data-edition="dim-toggle"],[data-edition="hide-cards"]']
    ];
    var rows = want.map(function (w) {
      var els = qsa(w[1]);
      return { hook: w[0], found: els.length,
               tag: els[0] ? els[0].tagName.toLowerCase() : '—',
               classes: els[0] ? (els[0].className || '').slice(0, 40) : '—' };
    });
    if (console.table) console.table(rows);
    var missing = rows.filter(function (r) { return !r.found; }).map(function (r) { return r.hook; });
    if (missing.length) console.warn('missing hooks:', missing.join(', '));
    else console.log('all hooks found');
    return rows;
  };

  /* Writes a throwaway mark, erases it, and reports exactly what the
     database did at each step. */
  Edition.testErase = function () {
    var c = db();
    if (!c) return Promise.reject('no supabase client');
    var id = 'test' + rid();
    return c.from('marks').insert({
      id: id, term: TERM, who: WHO, type: 'stroke',
      data: { w: 0.001, pts: [[0.01, 0.01], [0.02, 0.02]] }
    }).select('id').then(function (ins) {
      if (ins.error) { console.error('INSERT failed:', ins.error.message); throw ins.error; }
      console.log('INSERT ok');
      return c.from('marks')
        .update({ deleted_at: new Date().toISOString(), deleted_by: WHO })
        .eq('id', id).select('id');
    }).then(function (upd) {
      if (upd.error) { console.error('UPDATE failed:', upd.error.message); return; }
      var n = (upd.data || []).length;
      if (n) {
        console.log('UPDATE ok — erase works. ' + n + ' row changed.');
      } else {
        console.error('UPDATE changed 0 rows. The "erase marks" policy is missing ' +
          'or the anon role has no UPDATE grant. In the SQL editor run:\n' +
          '  grant update on public.marks to anon, authenticated;\n' +
          '  -- and confirm the "erase marks" policy exists');
      }
    });
  };

  Edition.marksSizes = function () {
    return CFG.weights.map(function (w, i) {
      return { step: i + 1, fraction: w,
               pxOn1440: +(w * 1440).toFixed(1), pxHere: +(w * side).toFixed(1) };
    });
  };
})();
