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

  /* Draw the half-circle mark into a canvas and hand it to the browser
     as the favicon, repainted on every palette change. Canvas rather
     than an inline SVG because Safari's support for SVG favicons is
     unreliable, and a PNG data URI works everywhere. */
  var FAVICON = {
    on: true,
    size: 128,        /* drawn large, shown small — stays sharp on retina */
    pad: 0.09,        /* margin around the mark, as a fraction */
    centre: true,     /* centre the half disc's own box, not the circle's */
    bg: true,         /* false leaves it transparent, outline only */
    stroke: 0         /* outline, in px at 16px display. Only useful
                         when bg is false — on a paper ground it is
                         paper on paper, and just eats into the radius. */
  };

  /* The tab title can carry the palette. Kept separate from og:title
     and the meta description, which stay static — those are what search
     results and shared links use, and colour names there would read as
     broken rather than playful. */
  var TITLE = {
    on: true,
    template: ' — {ink} · {paper}',
    onlyOnChange: false,   /* true = only after Randomize or Swap, not on load */
    base: null             /* captured from the page on first run */
  };

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
  /* ------------------------------------------------------------
     Naming a generated colour.

     Hue is measured in OKLCH rather than HSL. HSL hue is
     perceptually lopsided — the span from yellow to green covers
     60 degrees there but only 32 perceptually — so evenly spaced
     HSL families put yellow names on colours that are plainly
     yellow-green. OKLCH is perceptually even, so a family boundary
     lands where the eye puts it.

     The families themselves are deliberately uneven in width,
     sized to how finely people actually name each region: reds and
     pinks get narrow bands, blues get wide ones.

     Each family carries ten names — five lightness bands, each in a
     muted and a vivid version.
     ------------------------------------------------------------ */
  var FAMILIES = [
    [355, 12,'Rose',   ['Oxblood','Carmine','Rosewood','Cerise','Rose','Watermelon','Blush','Flamingo','Rose Water','Candy Floss']],
    [ 12, 25,'Red',   ['Garnet','Ruby','Barn Red','Cherry','Clay Rose','Poppy','Rose Quartz','Coral Pink','Powder Rose','Peach Blossom']],
    [ 25, 38,'Scarlet',   ['Maroon','Scarlet','Brick','Vermilion','Salmon','Tomato','Shell','Peach','Seashell','Apricot Cream']],
    [ 38, 50,'Ember',   ['Mahogany','Cinnabar','Rust','Persimmon','Melon','Papaya','Apricot','Sherbet','Peach Milk','Creamsicle']],
    [ 50, 66,'Orange',   ['Umber','Burnt Orange','Clay','Tangerine','Sandstone','Marmalade','Buff','Cantaloupe','Bisque','Melon Cream']],
    [ 66, 80,'Amber',   ['Bistre','Amber','Ochre','Marigold','Fawn','Honey','Oat','Buttercup','Almond','Lemon Cream']],
    [ 80, 95,'Gold',   ['Bronze','Old Gold','Mustard','Amber Gold','Wheat','Saffron','Vanilla','Sunflower','Cream','Daffodil']],
    [ 95,118,'Yellow',   ['Olive Drab','Citrine','Khaki','Mustard Yellow','Straw','Chrome Yellow','Parchment','Lemon','Ivory','Citron']],
    [118,130,'Lime',   ['Moss','Chartreuse','Sage','Acid Green','Celadon','Lime','Lime Wash','Neon Lime','Pale Lime','Key Lime']],
    [130,145,'Green',   ['Loden','Kelly Green','Fern','Grass','Willow','Spring Green','Pistachio','Electric Green','Green Tea','Mint Ice']],
    [145,160,'Emerald',   ['Pine','Emerald','Ivy','Shamrock','Eucalyptus','Jade','Honeydew','Mint','Dew','Peppermint']],
    [160,185,'Sea',   ['Bottle','Malachite','Verdigris','Sea Green','Sea Glass','Aquamarine','Seafoam','Ice Green','Sea Mist','Glacier Green']],
    [185,205,'Teal',   ['Deep Teal','Viridian','Slate Teal','Turquoise','Celadon Blue','Aqua','Powder','Ice Blue','Vapour','Pool']],
    [205,230,'Cyan',   ['Spruce','Petrol','Slate Cyan','Peacock','Mist Blue','Cerulean','Glacier','Powder Blue','Cloud Blue','Robin Egg']],
    [230,250,'Sky',   ['Prussian','Azure','Steel Blue','Cornflower','Chambray','Sky Blue','Bluebell','Frost','Sky Wash','Cirrus']],
    [250,268,'Blue',   ['Navy','Sapphire','Denim','Cobalt','Wedgwood','Iris','Periwinkle','Alice Blue','Moonstone','Forget Me Not']],
    [268,285,'Indigo',   ['Midnight','Ultramarine','Slate Blue','Klein Blue','Dusk','Hyacinth','Wisteria','Lilac Blue','Lavender Grey','Iris Mist']],
    [285,305,'Violet',   ['Aubergine','Violet','Heather','Amethyst','Lavender','Orchid','Lilac','Powder Violet','Orchid Mist','Violet Ice']],
    [305,320,'Purple',   ['Plum','Byzantium','Mulberry','Grape','Thistle','Magenta Rose','Mauve','Powder Lilac','Dusty Lilac','Lilac Wash']],
    [320,338,'Magenta',   ['Wine','Tyrian','Raspberry','Fuchsia','Peony','Magenta','Cotton Candy','Bubblegum','Pink Pearl','Fairy Floss']],
    [338,355,'Pink',   ['Merlot','Ruby Pink','Cranberry','Rose Red','Dusty Pink','Punch','Petal','Ballet Pink','Shell Pink','Blossom']]
  ];
  var WARM_N = [[0.20,'Ink'],[0.32,'Espresso'],[0.44,'Bark'],[0.56,'Umber Grey'],
                [0.68,'Taupe'],[0.80,'Putty'],[0.90,'Oat'],[1.01,'Bone']];
  var COOL_N = [[0.20,'Ink'],[0.32,'Charcoal'],[0.44,'Graphite'],[0.56,'Slate'],
                [0.68,'Steel'],[0.80,'Fog'],[0.90,'Mist'],[1.01,'Chalk']];

  function hexToRgb(h) {
    h = h.replace('#', '');
    return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); });
  }
  function toLinear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function toOklch(rgb) {
    var r = toLinear(rgb[0]), g = toLinear(rgb[1]), b = toLinear(rgb[2]);
    var l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    var m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    var s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    var l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    var L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    var A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    var B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
    var H = Math.atan2(B, A) * 180 / Math.PI;
    if (H < 0) H += 360;
    return [L, Math.hypot(A, B), H];
  }
  function oklchInGamut(L, C, H) {
    var h = H * Math.PI / 180, a = C * Math.cos(h), b = C * Math.sin(h);
    var l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    var s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    var lr =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    var lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    var lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
    return lr >= -0.001 && lr <= 1.001 && lg >= -0.001 && lg <= 1.001 &&
           lb >= -0.001 && lb <= 1.001;
  }
  /* how much chroma is actually reachable at this lightness and hue —
     "vivid" only means anything relative to what is possible */
  function maxChroma(L, H) {
    var lo = 0, hi = 0.45;
    for (var i = 0; i < 22; i++) {
      var mid = (lo + hi) / 2;
      if (oklchInGamut(L, mid, H)) lo = mid; else hi = mid;
    }
    return lo;
  }

  Edition.nameColor = function (hex) {
    var lch = toOklch(hexToRgb(hex));
    var L = lch[0], C = lch[1], H = lch[2];

    /* too little chroma to carry a hue at all */
    if (C < 0.024 + 0.014 * L) {
      var warm = (H >= 20 && H < 130) || H >= 330;
      var set = warm ? WARM_N : COOL_N;
      for (var i = 0; i < set.length; i++) if (L < set[i][0]) return set[i][1];
      return set[set.length - 1][1];
    }

    var fam = FAMILIES[0];
    for (var k = 0; k < FAMILIES.length; k++) {
      var f = FAMILIES[k];
      if (f[0] < f[1]) { if (H >= f[0] && H < f[1]) { fam = f; break; } }
      else { if (H >= f[0] || H < f[1]) { fam = f; break; } }   /* the wrap */
    }
    var band = L < 0.40 ? 0 : (L < 0.62 ? 1 : (L < 0.76 ? 2 : (L < 0.88 ? 3 : 4)));
    var vivid = (C / Math.max(1e-4, maxChroma(L, H))) > 0.82 ? 1 : 0;
    return fam[3][band * 2 + vivid];
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

  function paintFavicon(p) {
    if (!FAVICON.on) return;
    try {
      var n = FAVICON.size;
      var c = document.createElement('canvas');
      c.width = c.height = n;
      var x = c.getContext('2d');
      if (!x) return;
      if (FAVICON.bg) { x.fillStyle = p.paper; x.fillRect(0, 0, n, n); }
      var lw = FAVICON.stroke ? (n / 16) * FAVICON.stroke : 0;
      var pad = FAVICON.pad * n;
      /* the stroke straddles the path, so half of it sits outside */
      var r = (n - pad * 2 - lw) / 2;
      var cy = n / 2;
      /* a half disc is r wide but 2r tall, so centring the circle would
         leave the right half of the square empty */
      var cx = n / 2 + (FAVICON.centre ? r / 2 : 0);
      x.beginPath();
      x.arc(cx, cy, r, Math.PI / 2, Math.PI * 1.5, false);
      x.closePath();
      x.fillStyle = p.ink;
      x.fill();
      /* Without a solid ground the mark has to survive both a light and
         a dark browser tab. Half the palettes make the ink the lighter
         colour, so an outline in the opposite colour means whichever
         one disappears against the tab, the other still reads. */
      if (lw > 0) {
        x.lineWidth = lw;
        x.lineJoin = 'round';
        x.strokeStyle = p.paper;
        x.stroke();
      }

      var href = c.toDataURL('image/png');
      var old = document.querySelectorAll('link[rel~="icon"],link[rel="shortcut icon"]');
      Array.prototype.forEach.call(old, function (el) { el.parentNode.removeChild(el); });
      var link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = href;
      document.head.appendChild(link);
      Edition.faviconHref = href;
    } catch (e) { /* not worth breaking the page over */ }
  }
  Edition.paintFavicon = paintFavicon;
  Edition.faviconOptions = FAVICON;

  function paintTitle(p, userAction) {
    if (!TITLE.on) return;
    if (TITLE.base === null) TITLE.base = document.title;
    if (TITLE.onlyOnChange && !userAction) { document.title = TITLE.base; return; }
    document.title = TITLE.base +
      TITLE.template.replace('{ink}', Edition.nameColor(p.ink))
                    .replace('{paper}', Edition.nameColor(p.paper));
  }
  Edition.titleOptions = TITLE;

  function apply(p, userAction) {
    var r = document.documentElement;
    TARGETS.ink.forEach(function (n) { r.style.setProperty(n, p.ink); });
    TARGETS.paper.forEach(function (n) { r.style.setProperty(n, p.paper); });
    Edition.palette = p;
    Edition.inkName = Edition.nameColor(p.ink);
    Edition.paperName = Edition.nameColor(p.paper);
    window.dispatchEvent(new CustomEvent('edition:palette', { detail: p }));
    paintNames();
    paintFavicon(p);
    paintTitle(p, userAction);
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
    save(q); apply(q, true);
    return q;
  };

  Edition.shuffle = function () {
    var p = Edition.makePalette();
    save(p); apply(p, true);
    return p;
  };

  /* A reload is treated as "give me another one", while a normal load
     keeps whatever the session already has. On a single-page site the
     two are nearly the same thing, but this keeps the palette stable
     if a second page ever gets added. */
  function wasReloaded() {
    try {
      var nav = performance.getEntriesByType('navigation')[0];
      if (nav && nav.type) return nav.type === 'reload';
      /* older browsers */
      if (performance.navigation) return performance.navigation.type === 1;
    } catch (e) {}
    return false;
  }

  Edition.initPalette = function () {
    var p = wasReloaded() ? null : load();
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
