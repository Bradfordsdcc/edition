/* ============================================================
   edition-ascii.js
   The EDITION banner, drawn as characters and animated.

   Markup — a <pre> is important, a <div> will collapse the spaces:
     <pre data-edition="ascii"></pre>

   CSS worth having:

     [data-edition="ascii"]{
       font-family: ui-monospace, SFMono-Regular, Menlo, Consolas,
                    "Liberation Mono", monospace;
       font-size: 11px;
       line-height: .9;
       white-space: pre;
       overflow-x: auto;
       margin: 0;
       color: var(--_edition-colors---ink);
     }

   Name real families before the generic `monospace` keyword. On some
   systems that keyword resolves to a font that is not actually fixed
   width, which turns the banner into rubble. `ui-monospace` itself is
   not a font either — it resolves to SF Mono on a Mac and falls through
   to Consolas on Windows, which is what most visitors will see.

   At these settings the banner is 34 columns by 7 rows, about 224px
   wide and 69px tall, so it clears a 360px phone comfortably.

   ============================================================ */
(function () {
  'use strict';

  var Edition = window.Edition = window.Edition || {};

  var CFG = {
    rows: 5,
    widths: { E: 4, D: 5, I: 1, T: 5, O: 5, N: 5 },
    round:  { D: 1, O: 1 },
    gap: 1,
    pad: 1,
    buildMs: 0,        /* 0 = appear instantly */
    cycleMs: 1000,     /* switch character set every second */
    idleSwaps: 0,      /* re-roll characters per second, for the noisy sets */
    /* ordered so no two adjacent frames share a texture: dotted ground,
       then a knockout, then a dotted ground again, then two solids */
    order: ['hashDots', 'cutShade', 'dotMatrix', 'shade', 'asterisk']
  };
  Edition.asciiConfig = CFG;

  /* Everything is generated rather than hand-typed, so the letters stay
     consistent at any size. Strictly on or off — no half characters, so
     the horizontal strokes weigh the same as the vertical ones and every
     character set draws an identical shape.

     Rounding is a per-row inset. Nothing diagonal is ever added, which
     is what turned an earlier attempt into a diamond. Note that real
     roundness comes from rows rather than width: at 5 rows there is only
     one full-width middle row, so the corners can only be clipped. */
  function insetProfile(rows, k) {
    var p = [];
    for (var y = 0; y < rows; y++) p.push(Math.max(0, k - Math.min(y, rows - 1 - y)));
    return p;
  }
  function boxGlyph(w, rows, rightK, leftK) {
    var pr = insetProfile(rows, rightK), pl = insetProfile(rows, leftK);
    var cap = Math.floor((w - 2) / 2), g = [];
    for (var y = 0; y < rows; y++) {
      var L = Math.min(pl[y], cap), R = w - 1 - Math.min(pr[y], cap);
      var row = [];
      for (var x = 0; x < w; x++) row.push('.');
      if (y === 0 || y === rows - 1) { for (var i = L; i <= R; i++) row[i] = '#'; }
      else { row[L] = '#'; row[R] = '#'; }
      g.push(row.join(''));
    }
    return g;
  }
  function eGlyph(w, rows) {
    var mid = Math.floor((rows - 1) / 2), g = [];
    for (var y = 0; y < rows; y++) {
      var row = [];
      for (var x = 0; x < w; x++) row.push('.');
      row[0] = '#';
      if (y === 0 || y === rows - 1) for (var a = 0; a < w; a++) row[a] = '#';
      if (y === mid) for (var b = 0; b < w - 1; b++) row[b] = '#';
      g.push(row.join(''));
    }
    return g;
  }
  function tGlyph(w, rows) {
    var c = Math.floor((w - 1) / 2), even = (w % 2 === 0), g = [];
    for (var y = 0; y < rows; y++) {
      var row = [];
      for (var x = 0; x < w; x++) row.push('.');
      if (y === 0) for (var a = 0; a < w; a++) row[a] = '#';
      else { row[c] = '#'; if (even) row[c + 1] = '#'; }
      g.push(row.join(''));
    }
    return g;
  }
  function iGlyph(rows) {
    var g = [];
    for (var y = 0; y < rows; y++) g.push('#');
    return g;
  }
  /* the diagonal is symmetric only when the interior columns match the
     interior rows — width 5 at 5 rows, width 7 at 7 rows */
  function nGlyph(w, rows) {
    var n = rows - 2, cols = [], g = [];
    for (var i = 0; i < n; i++) {
      var d = (n > 1) ? (w - 3) / (n - 1) : 0;
      cols.push(i < n / 2 ? 1 + Math.floor(i * d)
                          : w - 2 - Math.floor((n - 1 - i) * d));
    }
    for (var y = 0; y < rows; y++) {
      var row = [];
      for (var x = 0; x < w; x++) row.push('.');
      row[0] = '#'; row[w - 1] = '#';
      if (y > 0 && y < rows - 1) row[cols[y - 1]] = '#';
      g.push(row.join(''));
    }
    return g;
  }

  var SETS = {
    hashDots:   { on: '#', off: '\u00B7' },
    hash:       { on: '#', off: ' ' },
    blocksDots: { on: '\u2588', off: '\u00B7' },
    blocks:     { on: '\u2588', off: ' ' },
    plusDots:   { on: '+', off: '\u00B7' },
    asterisk:   { on: '*', off: ' ' },
    atDots:     { on: '@', off: '\u00B7' },
    shade:      { on: '\u2588', off: '\u2591' },
    dotMatrix:  { on: '\u25CF', off: '\u00B7' },
    binary:     { on: '01', off: ' ' },
    hex:        { on: '0123456789ABCDEF', off: ' ' },
    /* cut out of a field rather than drawn on one. These rely on the
       padding border, or the outer strokes have nothing to read against. */
    cutShade:   { on: ' ', off: '\u2593' },
    cutShadeMix:{ on: ' ', off: '\u2593\u2592' },
    cutLight:   { on: ' ', off: '\u2592' },
    cutSolid:   { on: ' ', off: '\u2588' },
    cutHash:    { on: ' ', off: '#' },
    cutBinary:  { on: ' ', off: '01' }
  };
  Edition.asciiSets = SETS;

  function buildRows() {
    var w = CFG.widths, rows = CFG.rows;
    var parts = {
      E: eGlyph(w.E, rows),
      D: boxGlyph(w.D, rows, CFG.round.D, 0),
      I: iGlyph(rows),
      T: tGlyph(w.T, rows),
      O: boxGlyph(w.O, rows, CFG.round.O, CFG.round.O),
      N: nGlyph(w.N, rows)
    };
    var word = 'EDITION', out = [], gap = CFG.gap, pad = CFG.pad;
    for (var r = 0; r < rows; r++) {
      var line = '';
      for (var i = 0; i < word.length; i++) {
        line += parts[word.charAt(i)][r];
        if (i < word.length - 1) line += new Array(gap + 1).join('.');
      }
      out.push(new Array(pad + 1).join('.') + line + new Array(pad + 1).join('.'));
    }
    if (pad) {
      var blank = new Array(out[0].length + 1).join('.');
      for (var q = 0; q < pad; q++) { out.unshift(blank); out.push(blank); }
    }
    return out;
  }

  var GRID, ROWS, COLS;
  function rebuild() {
    GRID = buildRows();
    ROWS = GRID.length; COLS = GRID[0].length;
  }
  rebuild();
  Edition.asciiRebuild = rebuild;

  function pick(spec) {
    if (spec.length <= 1) return spec;
    return spec.charAt(Math.floor(Math.random() * spec.length));
  }
  function render(setName, revealed) {
    var set = SETS[setName] || SETS[CFG.order[0]];
    var out = [];
    for (var r = 0; r < ROWS; r++) {
      var line = '';
      for (var c = 0; c < COLS; c++) {
        if (revealed && !revealed[r * COLS + c]) { line += ' '; continue; }
        line += pick(GRID[r].charAt(c) === '#' ? set.on : set.off);
      }
      out.push(line);
    }
    return out.join('\n');
  }
  Edition.asciiFrame = render;

  /* ------------------------------------------------------------
     Animation
     ------------------------------------------------------------ */
  var el = null, timer = null, raf = null, setIdx = 0;

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  function build(setName, done) {
    var total = ROWS * COLS;
    var order = [];
    for (var i = 0; i < total; i++) order.push(i);
    /* shuffle so the characters land in a scatter rather than a sweep */
    for (var j = total - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = order[j]; order[j] = order[k]; order[k] = t;
    }
    var revealed = new Array(total);
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / CFG.buildMs);
      var want = Math.floor(p * total);
      for (var n = 0; n < want; n++) revealed[order[n]] = 1;
      el.textContent = render(setName, revealed);
      if (p < 1) raf = requestAnimationFrame(step);
      else { raf = null; el.textContent = render(setName); if (done) done(); }
    }
    raf = requestAnimationFrame(step);
  }

  function idle(setName) {
    if (!CFG.idleSwaps) return;
    timer = setInterval(function () {
      el.textContent = render(setName);
    }, Math.max(60, 1000 / CFG.idleSwaps));
  }

  function play() {
    if (!el) return;
    stop();
    var name = CFG.order[setIdx % CFG.order.length];
    build(name, function () {
      if (CFG.cycleMs > 0) {
        timer = setInterval(function () {
          setIdx++;
          el.textContent = render(CFG.order[setIdx % CFG.order.length]);
        }, CFG.cycleMs);
      } else {
        idle(name);
      }
    });
  }
  Edition.asciiPlay = play;
  Edition.asciiStop = stop;
  Edition.asciiSet = function (name) {
    setIdx = Math.max(0, CFG.order.indexOf(name));
    if (el) { stop(); el.textContent = render(name); }
  };

  function boot() {
    el = document.querySelector('[data-edition="ascii"]');
    if (!el) return;
    el.setAttribute('aria-label', 'EDITION');
    el.setAttribute('role', 'img');

    var reduce = window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = render(CFG.order[0]); return; }

    /* replay whenever the info window opens, so it is a small event
       rather than something that ran once before anyone looked */
    var win = document.querySelector('[data-edition="info-modal"]');
    if (win && typeof MutationObserver === 'function') {
      var wasOpen = win.classList.contains('is-open');
      new MutationObserver(function () {
        var now = win.classList.contains('is-open');
        if (now && !wasOpen) play();
        if (!now && wasOpen) stop();
        wasOpen = now;
      }).observe(win, { attributes: true, attributeFilter: ['class'] });
      if (wasOpen) play(); else el.textContent = render(CFG.order[0]);
    } else {
      play();
    }
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
