/* ============================================================
   edition-marks.js  ·  phase 5b — read only

   Renders the shared annotation wall. No drawing yet.

   Needs the Supabase client loaded first:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

   Elements it looks for (all optional — it skips what is missing):
     [data-edition="marks-toggle"]   show / hide the wall
     [data-edition="marks-hide"]     hide it
     [data-edition="dim-toggle"]     dim the cards
     [data-edition="marks-box"]      the little control bar under the nav
     [data-edition="marks-count"]    live mark count, if you want one

   Classes it sets on <html>:
     .marks-on      the wall is visible
     .cards-dim     cards dimmed so the wall reads
   ============================================================ */
(function () {
  'use strict';

  var Edition = window.Edition = window.Edition || {};

  var CFG = {
    url: 'https://jtelqybifbiazhmltear.supabase.co',
    key: 'sb_publishable_YS4zJgl-oPOL2GRKvhNqoQ_uD85_ZEO',
    clearCode: 'kumeyaay',      /* ?clear=kumeyaay wipes the wall */
    pollMs: 8000,
    maxMarks: 4000
  };
  Edition.marksConfig = CFG;

  /* ------------------------------------------------------------
     Term. Marks are stamped with it so a semester can be cleared
     in one go without touching anything else.
     ------------------------------------------------------------ */
  function currentTerm() {
    var d = new Date(), m = d.getMonth();
    return d.getFullYear() + '-' + (m < 5 ? 'spring' : (m < 7 ? 'summer' : 'fall'));
  }
  var TERM = currentTerm();
  Edition.marksTerm = TERM;

  /* ------------------------------------------------------------
     Canvases

     Two of them. The committed layer holds every saved mark and is
     only redrawn when the data or the viewport changes; the live
     layer is for the stroke currently under the pen. Repainting
     hundreds of paths every frame would cost far more than it is
     worth on a phone.
     ------------------------------------------------------------ */
  var wrap, cCommit, cLive, xCommit, xLive;
  var side = 0, offX = 0, offY = 0, dpr = 1;

  function buildCanvases() {
    wrap = document.createElement('div');
    wrap.className = 'edi-marks-layer';
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:0;pointer-events:none;' +
      'opacity:0;transition:opacity .35s ease';

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

  /* The drawing surface is a square that covers the viewport: wide
     screens lose the bottom of it, tall screens lose the sides. Marks
     are stored 0..1 within that square, so they land in the same place
     relative to each other on every device. */
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
  Edition.marksProject = function (u, v) { return [X(u), Y(v)]; };

  /* ------------------------------------------------------------
     Ink colour, kept in step with the palette
     ------------------------------------------------------------ */
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

  /* ------------------------------------------------------------
     Sticker shapes — fine linework, matching the icon language
     ------------------------------------------------------------ */
  var STICKERS = {
    /* a pointed star, eight rays, no fill */
    star: function (c, s) {
      var n = 8;
      c.beginPath();
      for (var i = 0; i < n * 2; i++) {
        var a = -Math.PI / 2 + i / (n * 2) * Math.PI * 2;
        var r = (i % 2 ? s * 0.16 : s * 0.5);
        i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r)
          : c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath(); c.stroke();
    },
    heart: function (c, s) {
      var k = s * 0.5;
      c.beginPath();
      c.moveTo(0, k * 0.85);
      c.bezierCurveTo(-k * 1.25, k * 0.05, -k * 0.62, -k * 0.92, 0, -k * 0.3);
      c.bezierCurveTo(k * 0.62, -k * 0.92, k * 1.25, k * 0.05, 0, k * 0.85);
      c.stroke();
    },
    arrow: function (c, s) {
      var k = s * 0.5;
      c.beginPath();
      c.moveTo(-k * 0.85, k * 0.65); c.lineTo(k * 0.8, -k * 0.7);
      c.moveTo(k * 0.16, -k * 0.78); c.lineTo(k * 0.86, -k * 0.78);
      c.lineTo(k * 0.86, -k * 0.1);
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

  /* ------------------------------------------------------------
     Drawing a mark
     ------------------------------------------------------------ */
  function drawMark(ctx, m) {
    var d = m.data || m;
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 1;

    if (m.type === 'stroke' || d.pts) {
      var pts = d.pts || [];
      if (pts.length < 2) return;
      ctx.lineWidth = Math.max(0.6, (d.w || 0.0022) * side);
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
      var s = (d.s || 0.05) * side;
      ctx.save();
      ctx.translate(X(d.u), Y(d.v));
      if (d.rot) ctx.rotate(d.rot);
      ctx.lineWidth = Math.max(0.6, (d.w || 0.0022) * side);
      fn(ctx, s);
      ctx.restore();
    }
  }
  Edition.drawMark = drawMark;

  var MARKS = [];
  function renderCommitted() {
    if (!xCommit) return;
    xCommit.setTransform(dpr, 0, 0, dpr, 0, 0);
    xCommit.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (var i = 0; i < MARKS.length; i++) drawMark(xCommit, MARKS[i]);
    var el = document.querySelector('[data-edition="marks-count"]');
    if (el) el.textContent = MARKS.length;
  }
  Edition.renderMarks = renderCommitted;

  /* ------------------------------------------------------------
     Supabase
     ------------------------------------------------------------ */
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
    if (!c || loading) return Promise.resolve();
    loading = true;
    return c.from('marks')
      .select('id,type,data,ts')
      .eq('term', TERM)
      .order('ts', { ascending: true })
      .limit(CFG.maxMarks)
      .then(function (res) {
        loading = false;
        if (res.error) { console.warn('[marks] load:', res.error.message); return; }
        MARKS = res.data || [];
        renderCommitted();
      }, function (e) { loading = false; console.warn('[marks] load failed', e); });
  }
  Edition.loadMarks = load;

  /* ------------------------------------------------------------
     Secret clear. Erases in bulk rather than deleting, so the wall
     can still be brought back from the SQL editor afterwards.
     ------------------------------------------------------------ */
  function maybeClear() {
    var code = new URLSearchParams(location.search).get('clear');
    if (!code || code !== CFG.clearCode) return;
    var c = db();
    if (!c) return;
    if (!window.confirm('Erase every mark for ' + TERM + '?')) return;
    c.from('marks')
      .update({ deleted_at: new Date().toISOString(), deleted_by: 'clear-code' })
      .eq('term', TERM)
      .is('deleted_at', null)
      .then(function (res) {
        if (res.error) { alert('Clear failed: ' + res.error.message); return; }
        MARKS = [];
        renderCommitted();
        alert('Wall cleared for ' + TERM + '. It can be restored from the SQL editor.');
      });
  }

  /* ------------------------------------------------------------
     UI
     ------------------------------------------------------------ */
  var visible = false, dimmed = false, poll = null;

  function setVisible(on) {
    visible = !!on;
    document.documentElement.classList.toggle('marks-on', visible);
    wrap.style.opacity = visible ? '1' : '0';
    var box = document.querySelector('[data-edition="marks-box"]');
    if (box) box.style.display = visible ? '' : 'none';
    if (!visible) setDim(false);

    clearInterval(poll);
    if (visible) {
      load();
      poll = setInterval(function () { if (!document.hidden) load(); }, CFG.pollMs);
    }
    var t = document.querySelector('[data-edition="marks-toggle"]');
    if (t && t.getAttribute('data-label-on')) {
      t.textContent = visible ? t.getAttribute('data-label-on')
                              : t.getAttribute('data-label-off') || t.textContent;
    }
  }
  function setDim(on) {
    dimmed = !!on;
    document.documentElement.classList.toggle('cards-dim', dimmed);
    var b = document.querySelector('[data-edition="dim-toggle"]');
    if (b) b.classList.toggle('is-active', dimmed);
  }
  Edition.showMarks = setVisible;
  Edition.dimCards = setDim;

  function wire() {
    var t = document.querySelector('[data-edition="marks-toggle"]');
    if (t) t.addEventListener('click', function (e) {
      e.preventDefault(); setVisible(!visible);
    });
    var h = document.querySelector('[data-edition="marks-hide"]');
    if (h) h.addEventListener('click', function (e) {
      e.preventDefault(); setVisible(false);
    });
    var d = document.querySelector('[data-edition="dim-toggle"]');
    if (d) d.addEventListener('click', function (e) {
      e.preventDefault(); setDim(!dimmed);
    });
  }

  var rzTimer;
  function onResize() {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(function () { measure(); renderCommitted(); }, 120);
  }

  function boot() {
    buildCanvases();
    readInk();
    measure();
    wire();
    setVisible(false);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    maybeClear();
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);

  /* ------------------------------------------------------------
     Dev helpers — run from the console
     ------------------------------------------------------------ */
  Edition.marksStatus = function () {
    return {
      term: TERM,
      connected: !!db(),
      visible: visible,
      dimmed: dimmed,
      loaded: MARKS.length,
      square: Math.round(side),
      offset: [Math.round(offX), Math.round(offY)],
      dpr: dpr
    };
  };

  /* seeds a few marks so rendering can be checked before drawing exists */
  Edition.seedMarks = function (n) {
    var c = db();
    if (!c) return Promise.reject('no client');
    n = n || 6;
    var rows = [];
    for (var i = 0; i < n; i++) {
      var pts = [], x = Math.random(), y = Math.random(), a = Math.random() * 6.3;
      for (var k = 0; k < 40; k++) {
        a += (Math.random() - 0.5) * 0.6;
        x += Math.cos(a) * 0.012; y += Math.sin(a) * 0.012;
        pts.push([+x.toFixed(4), +y.toFixed(4)]);
      }
      rows.push({
        id: 'seed' + Date.now() + '-' + i,
        term: TERM, who: 'seed', type: 'stroke',
        data: { w: 0.0022, pts: pts }
      });
    }
    var kinds = Object.keys(STICKERS);
    for (var j = 0; j < 4; j++) {
      rows.push({
        id: 'seedst' + Date.now() + '-' + j,
        term: TERM, who: 'seed', type: 'sticker',
        data: { k: kinds[j % kinds.length], u: 0.2 + j * 0.2, v: 0.35,
                s: 0.06, w: 0.0022 }
      });
    }
    return c.from('marks').insert(rows).then(function (res) {
      if (res.error) { console.warn('[marks] seed failed:', res.error.message); return res; }
      return load().then(function () { return 'seeded ' + rows.length; });
    });
  };
})();
