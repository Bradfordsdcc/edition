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
    pad: 0.05,        /* margin around the mark, as a fraction */
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
  /* ============================================================
     THE LIST

     Palettes are drawn from these named colours rather than generated,
     so every name is exactly right by construction — Khaki can only ever
     appear on the actual Khaki. Editing this list is the whole
     maintenance story: add a line, remove a line, nothing else changes.

     Values are the published ones where a published one exists.
     ============================================================ */
  var LIST = [
    'Prussian Blue #003366',
    'Viridian #1E9167',
    'Alizarin #E32636',
    'Cadmium Red #E30022',
    'Cadmium Yellow #FFF600',
    'Cadmium Orange #ED872D',
    'Ultramarine #1805DB',
    'Vermilion #F4320C',
    'Payne\'s Grey #536878',
    'Naples Yellow #FADA5F',
    'Rose Madder #E33636',
    'Burnt Sienna #A93400',
    'Raw Sienna #9A6200',
    'Raw Umber #A75E09',
    'Burnt Umber #8A3324',
    'Yellow Ochre #C39143',
    'Venetian Red #C80815',
    'Van Dyke Brown #664228',
    'Malachite #0BDA51',
    'Lapis Lazuli #26619C',
    'Verdigris #43B3AE',
    'Tyrian Purple #66023C',
    'Han Purple #5218FA',
    'Egyptian Blue #1034A6',
    'Maya Blue #73C2FB',
    'Paris Green #50C87C',
    'Chrome Yellow #FFA700',
    'Sap Green #5C8B15',
    'Titanium White #E4E4E4',
    'Gamboge #E49B0F',
    'Sepia #704214',
    'Bistre #3D2B1F',
    'Carmine #D60036',
    'Cerulean Blue #2A52BE',
    'Cobalt #030AA7',
    'Phthalo Blue #000F89',
    'Phthalo Green #123524',
    'Hansa Yellow #E9D66C',
    'Smalt #003399',
    'Vermillion #E34234',
    'Lead White #F2F0E6',
    'Bone Black #3B3229',
    'Charcoal Grey #4A4A4A',
    'Indigo #4B0082',
    'Woad #3F5C8C',
    'Madder #754C50',
    'Cochineal #953B45',
    'Saffron #F4C430',
    'Orpiment #F9C80E',
    'Azurite #2E5894',
    'Terre Verte #6B7C5B',
    'Celadon Green #2F847C',
    'Ochre #CC7722',
    'Sanguine #6C110E',
    'Umber #B26400',
    'Sienna #A9561E',
    'Ivory Black #231F20',
    'Mars Black #1C1C1C',
    'Mars Red #C92A37',
    'Quinacridone #8E3A59',
    'Emerald Green #046307',
    'Scheele Green #4C9141',
    'Cinnabar #730113',
    'Minium #D94E1F',
    'Lampblack #1B1B1B',
    'British Racing Green #05480D',
    'International Klein Blue #002FA6',
    'Majorelle Blue #6050DC',
    'Isabelline #F4F0EC',
    'Davy\'s Grey #535554',
    'Delft Blue #3311EE',
    'Byzantium #702963',
    'Wedgewood Blue #5A7D9A',
    'Pompeian Red #A82A38',
    'Van Gogh Yellow #F2C12E',
    'Rembrandt Brown #5A4632',
    'Titian Red #BD5620',
    'Veronese Green #4F7942',
    'Bordeaux #7B002C',
    'Havana #3B2B2C',
    'Siena #A0522D',
    'Sevres Blue #1F4E9C',
    'Capri Blue #0091C8',
    'Amalfi #016E85',
    'Marrakesh #C9622E',
    'Mykonos Blue #005780',
    'Provence #658DC6',
    'Tuscany #B98C7B',
    'Egyptian Gold #EFA84C',
    'Moroccan Blue #115674',
    'Copenhagen Blue #21638B',
    'Bristol Blue #558F91',
    'Oxford Blue #002147',
    'Cambridge Blue #A3C1AD',
    'Eton Blue #AAD4D1',
    'Harvard Crimson #C90016',
    'Yale Blue #0F4D92',
    'Princeton Orange #FF8F00',
    'International Orange #BA160C',
    'Safety Orange #FF6600',
    'Safety Yellow #EED202',
    'Air Force Blue #5D8AA8',
    'Rifle Green #414833',
    'Bottle Green #006A4E',
    'Imperial Red #EC2938',
    'Royal Blue #4169E1',
    'Navy Blue #000080',
    'Regimental #2F3E56',
    'Military Green #667C3E',
    'Army Green #4B5320',
    'Cadet Blue #5F9EA0',
    'Cardinal #C41E3A',
    'Sable #784841',
    'Argent #888888',
    'Tenne #CD5700',
    'Field Drab #6C541E',
    'Marine Blue #01386A',
    'Federal Blue #43628B',
    'Fluorescent Pink #FE1493',
    'Fluorescent Green #08FF08',
    'Aqua #0FF0FE',
    'Bright Red #FF000D',
    'Kelly Green #339C5E',
    'Sunflower #FFC512',
    'Hunter Green #0B4008',
    'Crimson #8C000F',
    'Scarlet #FF2400',
    'Medium Blue #0000CD',
    'Mint #3EB489',
    'Cornflower #5170D7',
    'Light Teal #B1CCC5',
    'Brick Red #8F1402',
    'Lake #92CDCC',
    'Moss Green #6A7F3C',
    'Metallic Gold #D4AF37',
    'Orchid #7A81FF',
    'Violet #9A0EEA',
    'Flat Gold #B59A3B',
    'Light Lime #C8E04A',
    'Coral #FF7F50',
    'Sea Blue #006994',
    'Cranberry #9E003A',
    'Charcoal #343837',
    'Melon #FF7855',
    'Sakura #DFB1B6',
    'Asagi Blue #48929B',
    'Ivory #FFFFF0',
    'Chalk #EDEAE5',
    'Alabaster #F3E7DB',
    'Porcelain #DDDCDB',
    'Eggshell #F0EAD6',
    'Cream #FFFFC2',
    'Vanilla #F3E5AB',
    'Parchment #FEFCAF',
    'Linen #FAF0E6',
    'Bone #E0D7C6',
    'Pearl #EAE0C8',
    'Snow #FFFAFA',
    'Frost #E1E4C5',
    'Fog #D6D7D2',
    'Dove #B3ADA7',
    'Putty #CDAE70',
    'Straw #E4D96F',
    'Wheat #FBDD7E',
    'Honey #AE8934',
    'Butter #FFFF81',
    'Lemon #FFF700',
    'Citron #D5C757',
    'Celadon #ACE1AF',
    'Beige #E6DAA6',
    'Ecru #C2B280',
    'Oyster #E3D3BF',
    'Champagne #E9D2AC',
    'Buttermilk #FFFEE4',
    'Meringue #F3E4B3',
    'Seashell #FFF5EE',
    'Bisque #FFE4C4',
    'Almond #EDDCC8',
    'Oatmeal #C9C1B1',
    'Blush #F29E8E',
    'Peach #FFB07C',
    'Apricot #FFB16D',
    'Salmon #FF796C',
    'Powder Blue #B0E0E6',
    'Baby Blue #A2CFFE',
    'Sky Blue #9FB9E2',
    'Periwinkle #8E82FE',
    'Lilac #CEA2FD',
    'Lavender #B56EDC',
    'Thistle #D8BFD8',
    'Mauve #E0B0FF',
    'Pistachio #93C572',
    'Mint Green #487D4A',
    'Seafoam #93E9BE',
    'Sage #87AE73',
    'Willow #8C7A48',
    'Glacier #78B1BF',
    'Ice Blue #739BD0',
    'Platinum #E5E4E2',
    'Silver #C0C0C0',
    'Ash Grey #C1B5A9',
    'Pale Gold #FDDE6C',
    'Buff #F0DC82',
    'Sand #E2CA76',
    'Taupe #B9A281',
    'Greige #B0A999',
    'Khaki #C3B091',
    'Olive #808010',
    'Teal #008080',
    'Mustard #CEB301',
    'Terracotta #CB6843',
    'Clay #B66A50',
    'Rust #A83C09',
    'Copper #B87333',
    'Bronze #A87900',
    'Amber #FFBF00',
    'Marigold #FCC006',
    'Tangerine #FF9300',
    'Persimmon #E59B34',
    'Poppy #C23C47',
    'Coral Pink #F88379',
    'Rose #FF007F',
    'Cerise #AD134E',
    'Raspberry #B00149',
    'Cherry #CF0234',
    'Magenta #FF00FF',
    'Fuchsia #ED0DD9',
    'Orchid Purple #9A5BA8',
    'Amethyst #9966CC',
    'Heather #A484AC',
    'Wisteria #A87DC2',
    'Denim #2243B6',
    'Slate Blue #5A6B8C',
    'Steel Blue #4682B4',
    'Cobalt Blue #0047AB',
    'Peacock Blue #016795',
    'Turquoise Blue #00FFEF',
    'Jade #00A86B',
    'Fern #548D44',
    'Moss #009051',
    'Basil #879F84',
    'Avocado #568203',
    'Chartreuse #C1F80A',
    'Lime #AAFF32',
    'Shamrock #009E60',
    'Kelly #4CBB17',
    'Pewter #91A092',
    'Gunmetal #536267',
    'Stone #ADA587',
    'Camel #C69F59',
    'Fawn #CFAF7B',
    'Caramel #AF6F09',
    'Toffee #755139',
    'Cinnamon #D26911',
    'Paprika Red #B5432F',
    'Brick #A03623',
    'Sienna Brown #8A5A44',
    'Chestnut #742802',
    'Walnut #773F1A',
    'Hazel #A36B4B',
    'Bronze Green #8D8752',
    'Verdigris Green #61AC86',
    'Petrol #005F6A',
    'Lagoon #4B9B93',
    'Midnight #03012D',
    'Maroon #800000',
    'Oxblood #800020',
    'Claret #680018',
    'Wine #80013F',
    'Mulberry #920A4E',
    'Plum #66386A',
    'Aubergine #372528',
    'Damson #854C65',
    'Blackberry #43182F',
    'Espresso #4E312D',
    'Coffee #6F4E37',
    'Chocolate #D2691E',
    'Cocoa #875F42',
    'Mahogany #C04000',
    'Ebony #313337',
    'Onyx #464544',
    'Obsidian #445055',
    'Jet #343434',
    'Soot #555E5F',
    'Ink #1B1B2F',
    'Graphite #383428',
    'Charcoal Black #232326',
    'Slate #516572',
    'Anthracite #28282D',
    'Pine #2B5D34',
    'Forest #0B5509',
    'Spruce #0A5F38',
    'Juniper #74918E',
    'Cypress #585D40',
    'Bottle #093624',
    'Racing Green #014600',
    'Prussian #3F585F',
    'Navy #01153E',
    'Marine #042E60',
    'Abyss #8F9E9D',
    'Indigo Blue #3A18B1',
    'Ultramarine Blue #657ABB',
    'Aubergine Purple #472C3E',
    'Imperial Purple #5B3167',
    'Eggplant #430541',
    'Garnet #733635',
    'Ruby #CA0147',
    'Sangria #B14566',
    'Merlot #730039',
    'Cordovan #893F45',
    'Chocolate Brown #4A2C2A',
    'Peat #766D52',
    'Bitumen #2B2018',
    'City Design Navy #1B3F52',
    'City Design Teal #54C2D3',
    'City Design Yellow #F4DF05',
    'City Design Red #EE412E',
    'Tiffany Blue #7BF2DA',
    'Barbie Pink #FE46A5',
    'Terminal Green #33FF33',
    'Hyperlink Blue #0000EE',
    'Matrix Green #70F15E',
    'Process Cyan #00AEEF',
    'Process Magenta #EC008C',
    'Process Yellow #FFF200',
    'Rubylith Red #C8102E',
    'Cyanotype Blue #1A4B84',
    'Kraft Paper #A98B62',
    'Newsprint #C8C4BC',
    'Legal Pad #FFF9AE',
    'Pinkest Pink #FF00CC',
    'Black 3.0 #030303',
    'Yoshi Green #6FBF4A',
    'Kirby Pink #D74894',
    'Pikachu Yellow #FFCB05',
    'Nintendo Red #E60012',
    'Kuromi Purple #8260A2',
    'Pompompurin Yellow #FFF9B0',
    'Akira Red #D7262F',
    'Brat Green #8ACE00',
    'Discord Blurple #5865F2',
    'Vaporwave Pink #FF71CE',
    'Millennial Pink #F3CFC6',
    'Traffic Cone #FF5800',
    'Tennis Ball #CCFF00',
  ];


  /* Contrast band a pair has to fall inside. 4.5 is the WCAG AA floor and
     the level any audit actually checks. Raising the lower bound to 7
     would meet AAA but drops every mid-luminance colour from the list —
     a colour sitting in the middle is close to both ends, so it cannot
     reach 7:1 against anything at all. */
  var MIN_RATIO = 4.5;
  var MAX_RATIO = 21;

  function hexToRgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.substr(0, 2), 16),
            parseInt(h.substr(2, 2), 16),
            parseInt(h.substr(4, 2), 16)];
  }
  function relLum(rgb) {
    var a = rgb.map(function (v) {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function ratio(la, lb) {
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }
  Edition.contrast = function (a, b) {
    return ratio(relLum(hexToRgb(a)), relLum(hexToRgb(b)));
  };

  /* Parsed once. Every pair inside the band is worked out at load — about
     sixty thousand comparisons, which costs a millisecond — so picking a
     palette afterwards is a single array lookup and every pair is equally
     likely. */
  var COLORS = [], PAIRS = [], BY_HEX = {};
  (function buildIndex() {
    for (var i = 0; i < LIST.length; i++) {
      var s = LIST[i].trim();
      if (!s) continue;
      var cut = s.lastIndexOf(' ');
      var name = s.slice(0, cut).trim();
      var hex = s.slice(cut + 1).trim().toUpperCase();
      if (!/^#[0-9A-F]{6}$/.test(hex)) continue;
      var c = { name: name, hex: hex, L: relLum(hexToRgb(hex)) };
      COLORS.push(c);
      BY_HEX[hex] = name;
    }
    for (var a = 0; a < COLORS.length; a++) {
      for (var b = a + 1; b < COLORS.length; b++) {
        var r = ratio(COLORS[a].L, COLORS[b].L);
        if (r >= MIN_RATIO && r <= MAX_RATIO) PAIRS.push([a, b, r]);
      }
    }
  })();
  Edition.colors = COLORS;
  Edition.pairCount = function () { return PAIRS.length; };

  /* A name is a lookup, not a guess. Anything not in the list — someone
     setting a colour by hand — falls back to the nearest entry. */
  Edition.nameColor = function (hex) {
    hex = String(hex).trim().toUpperCase();
    if (BY_HEX[hex]) return BY_HEX[hex];
    var t = hexToRgb(hex), best = null, bd = Infinity;
    for (var i = 0; i < COLORS.length; i++) {
      var c = hexToRgb(COLORS[i].hex);
      var d = (c[0] - t[0]) * (c[0] - t[0]) +
              (c[1] - t[1]) * (c[1] - t[1]) +
              (c[2] - t[2]) * (c[2] - t[2]);
      if (d < bd) { bd = d; best = COLORS[i]; }
    }
    return best ? best.name : hex;
  };

  Edition.makePalette = function () {
    var p = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    var a = COLORS[p[0]], b = COLORS[p[1]];
    /* either member can be the ground, so about half of all visits come
       out light on dark */
    var flip = Math.random() < 0.5;
    var paper = (a.L > b.L) ? a : b;
    var ink = (a.L > b.L) ? b : a;
    if (flip) { var t = paper; paper = ink; ink = t; }
    return { ink: ink.hex, paper: paper.hex, r: p[2], flip: flip };
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
