/* ============================================================
   edition-palette.js
   Picks one two-colour palette per SESSION and writes it to
   :root as --ink / --paper.

   Palettes are generated, not listed. Two independent hues, no
   harmony rule, and either colour may be the ground — so about
   half of all palettes come out light-on-dark. Every pair is
   solved to land inside the contrast band below, and the darker
   member is floored so it always carries hue instead of
   collapsing toward black.

   Load this BEFORE edition-icons.js.
   ============================================================ */
(function () {
  'use strict';

  var MIN_RATIO = 7;      /* AAA for body text */
  var MAX_RATIO = 14;     /* past this the dark member loses its hue */
  var STORE_KEY = 'edition:palette';

  var Edition = window.Edition = window.Edition || {};

  function hsv2rgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c, r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  function toHex(rgb) {
    return '#' + rgb.map(function (v) {
      return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2).toUpperCase();
    }).join('');
  }
  function relLum(rgb) {
    var v = rgb.map(function (c) {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function ratio(a, b) {
    var L = Math.max(relLum(a), relLum(b)), S = Math.min(relLum(a), relLum(b));
    return (L + 0.05) / (S + 0.05);
  }

  function make(minR, maxR) {
    var hL = Math.floor(Math.random() * 360);
    var hD = Math.floor(Math.random() * 360);
    var light = hsv2rgb(hL, 0.04 + Math.random() * 0.42, 0.84 + Math.random() * 0.16);
    var sD = 0.45 + Math.random() * 0.50;
    var target = minR + Math.random() * (maxR - minR);

    /* bisect the dark member's value onto the target ratio */
    var lo = 0.06, hi = 0.98, dark = null;
    for (var i = 0; i < 26; i++) {
      var mid = (lo + hi) / 2;
      dark = hsv2rgb(hD, sD, mid);
      if (ratio(dark, light) > target) lo = mid; else hi = mid;
    }
    dark = hsv2rgb(hD, sD, (lo + hi) / 2);

    var r = ratio(dark, light);
    if (r < minR || r > maxR) return null;
    if (Math.max(dark[0], dark[1], dark[2]) < 58) return null;   /* would read as black */

    var flip = Math.random() < 0.5;                              /* either may be the ground */
    return { ink: toHex(flip ? light : dark), paper: toHex(flip ? dark : light),
             r: r, flip: flip };
  }

  Edition.makePalette = function (minR, maxR) {
    minR = minR || MIN_RATIO; maxR = maxR || MAX_RATIO;
    for (var i = 0; i < 400; i++) {
      var p = make(minR, maxR);
      if (p) return p;
    }
    return { ink: '#141210', paper: '#F2EEE3', r: 15.5, flip: false };
  };


  /* ------------------------------------------------------------
     Naming a generated colour.
     Palettes are random hues, so names are derived: hue picks the
     family, lightness picks which of its three names, and anything
     with almost no saturation falls through to a neutral.
     ------------------------------------------------------------ */
  /* 18 hue families x 6 variants (deep / mid / light, each muted or
     vivid), plus separate warm and cool neutral ladders. Names are
     derived rather than listed because the palettes are generated. */
  var FAMILIES = [
    /*   0 */ ['Oxblood','Crimson','Brick','Vermilion','Blush','Coral'],
    /*  20 */ ['Mahogany','Scarlet','Terracotta','Persimmon','Salmon','Melon'],
    /*  40 */ ['Umber','Burnt Orange','Clay','Tangerine','Apricot','Cantaloupe'],
    /*  60 */ ['Bistre','Amber','Ochre','Marigold','Wheat','Honey'],
    /*  80 */ ['Olive','Mustard','Khaki','Saffron','Custard','Lemon'],
    /* 100 */ ['Moss','Chartreuse','Sage','Acid Green','Celadon','Lime Wash'],
    /* 120 */ ['Pine','Kelly Green','Fern','Grass','Eucalyptus','Spring Green'],
    /* 140 */ ['Bottle','Emerald','Sea Green','Jade','Pistachio','Mint'],
    /* 160 */ ['Deep Teal','Viridian','Verdigris','Malachite','Seafoam','Aquamarine'],
    /* 180 */ ['Spruce','Teal','Slate Teal','Turquoise','Powder','Aqua'],
    /* 200 */ ['Petrol','Cerulean','Steel Blue','Peacock','Glacier','Sky'],
    /* 220 */ ['Prussian','Cobalt','Denim','Azure','Cornflower','Bluebell'],
    /* 240 */ ['Navy','Ultramarine','Slate Blue','Sapphire','Periwinkle','Powder Blue'],
    /* 260 */ ['Midnight','Indigo','Dusk','Iris','Wisteria','Lavender'],
    /* 280 */ ['Aubergine','Violet','Heather','Amethyst','Lilac','Mauve'],
    /* 300 */ ['Plum','Magenta','Mulberry','Fuchsia','Orchid','Thistle'],
    /* 320 */ ['Wine','Cerise','Raspberry','Hot Pink','Peony','Bubblegum'],
    /* 340 */ ['Maroon','Ruby','Rosewood','Rose','Shell','Petal']
  ];
  var WARM_N = [[0.16,'Ink'],[0.30,'Espresso'],[0.46,'Bark'],[0.62,'Taupe'],
                [0.78,'Putty'],[0.90,'Oat'],[1.01,'Bone']];
  var COOL_N = [[0.16,'Ink'],[0.30,'Charcoal'],[0.46,'Graphite'],[0.62,'Slate'],
                [0.78,'Fog'],[0.90,'Mist'],[1.01,'Chalk']];

  function hexToRgb(h) {
    h = h.replace('#', '');
    return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); });
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    var l = (mx + mn) / 2, h = 0, s = 0;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }

  Edition.nameColor = function (hex) {
    var rgb = hexToRgb(hex);
    var mx = Math.max(rgb[0], rgb[1], rgb[2]);
    var mn = Math.min(rgb[0], rgb[1], rgb[2]);
    var chroma = mx - mn;
    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    var h = hsl[0], l = hsl[2];

    /* Judge colourfulness by raw chroma, not HSL saturation, which
       balloons near white and would name a cream "Apricot". The bar
       scales with lightness because a dark colour can never reach as
       much absolute chroma as a pale one. */
    if (chroma < 10 + 28 * l) {
      var set = (h < 70 || h >= 300) ? WARM_N : COOL_N;
      for (var i = 0; i < set.length; i++) if (l < set[i][0]) return set[i][1];
      return set[set.length - 1][1];
    }

    /* chroma as a fraction of the most a colour can reach at this
       lightness — separates a muted oxblood from a vivid crimson */
    var maxC = 255 * (1 - Math.abs(2 * l - 1));
    var rel = maxC > 1 ? chroma / maxC : 0;
    var vivid = rel > 0.78 ? 1 : 0;
    var band = l < 0.32 ? 0 : (l < 0.62 ? 1 : 2);
    return FAMILIES[Math.round(h / 20) % 18][band * 2 + vivid];
  };

  /* ------------------------------------------------------------
     Colour name elements: click to copy the hex.
       <a data-edition="ink-name">Oxblood</a>
       <a data-edition="paper-name">Shell</a>
     ------------------------------------------------------------ */
  var REVERT_MS = 1600;
  function paintNames() {
    [['ink-name', 'ink'], ['paper-name', 'paper']].forEach(function (pair) {
      var els = document.querySelectorAll('[data-edition="' + pair[0] + '"]');
      Array.prototype.forEach.call(els, function (el) {
        if (el.__reverting) return;          /* leave "Copied" alone mid-flash */
        el.textContent = Edition.nameColor(Edition.palette[pair[1]]);
        el.setAttribute('title', Edition.palette[pair[1]]);
      });
    });
  }
  function copyHex(el, which) {
    var hex = Edition.palette[which];
    var done = function () {
      el.__reverting = true;
      var prev = Edition.nameColor(hex);
      el.textContent = 'Copied';
      el.classList.add('is-copied');
      clearTimeout(el.__t);
      el.__t = setTimeout(function () {
        el.__reverting = false;
        el.classList.remove('is-copied');
        el.textContent = Edition.nameColor(Edition.palette[which]);
      }, REVERT_MS);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(hex).then(done, done);
    } else {
      var ta = document.createElement('textarea');
      ta.value = hex; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      done();
    }
  }
  function wireNames() {
    [['ink-name', 'ink'], ['paper-name', 'paper']].forEach(function (pair) {
      var els = document.querySelectorAll('[data-edition="' + pair[0] + '"]');
      Array.prototype.forEach.call(els, function (el) {
        if (el.__wired) return;
        el.__wired = true;
        el.style.cursor = 'pointer';
        el.addEventListener('click', function (e) { e.preventDefault(); copyHex(el, pair[1]); });
      });
    });
  }

  /* Webflow compiles its Variables to custom properties with a generated
     name. We write to those AND to the plain --ink / --paper so the same
     script works inside Webflow and in any standalone page. */
  var TARGETS = {
    ink:   ['--ink',   '--_edition-colors---ink'],
    paper: ['--paper', '--_edition-colors---paper']
  };
  Edition.colorTargets = TARGETS;

  function apply(p) {
    var r = document.documentElement;
    TARGETS.ink.forEach(function (n) { r.style.setProperty(n, p.ink); });
    TARGETS.paper.forEach(function (n) { r.style.setProperty(n, p.paper); });
    Edition.palette = p;
    Edition.inkName = Edition.nameColor(p.ink);
    Edition.paperName = Edition.nameColor(p.paper);
    window.dispatchEvent(new CustomEvent('edition:palette', { detail: p }));
    paintNames();
  }
  function load() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (raw) { var p = JSON.parse(raw); if (p && p.ink && p.paper) return p; }
    } catch (e) {}
    return null;
  }
  function save(p) {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) {}
  }

  /* Swap which colour is the ground — same pair, same contrast, the
     page just flips between light-on-dark and dark-on-light. */
  Edition.swapPalette = function () {
    var p = Edition.palette;
    if (!p) return null;
    var q = { ink: p.paper, paper: p.ink, r: p.r, flip: !p.flip };
    save(q); apply(q);
    return q;
  };

  Edition.shuffle = function () {
    var p = Edition.makePalette();
    save(p); apply(p);
    return p;
  };

  Edition.initPalette = function () {
    var p = load();
    if (!p) { p = Edition.makePalette(); save(p); }
    apply(p);
    wireNames();
    paintNames();
    document.querySelectorAll('[data-edition="shuffle"]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); Edition.shuffle(); });
    });
    document.querySelectorAll('[data-edition="swap"]').forEach(function (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) { e.preventDefault(); Edition.swapPalette(); });
    });
  };

  /* dev helper: Edition.auditPalettes(200) in the console */
  Edition.auditPalettes = function (n) {
    n = n || 200;
    var flips = 0, min = 99, max = 0, sample = [];
    for (var i = 0; i < n; i++) {
      var p = Edition.makePalette();
      if (p.flip) flips++;
      min = Math.min(min, p.r); max = Math.max(max, p.r);
      if (sample.length < 8) sample.push(p);
    }
    return { count: n, lightOnDark: flips, minRatio: +min.toFixed(2),
             maxRatio: +max.toFixed(2), sample: sample };
  };
  Edition.contrast = function (a, b) {
    function rgb(h) { h = h.replace('#',''); return [0,2,4].map(function(i){
      return parseInt(h.substr(i,2),16); }); }
    return ratio(rgb(a), rgb(b));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Edition.initPalette);
  } else {
    Edition.initPalette();
  }
})();
