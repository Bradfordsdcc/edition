/* ============================================================
   edition-page.js
   Page logic for the Edition schedule.

     · parses data-start / data-end as America/Los_Angeles wall time
     · moves finished events into .edition-past-wrap and marks them
     · live clock and date in the nav
     · contrast + grade readouts, fed by the palette module
     · back to top, info modal

   Load AFTER edition-palette.js and edition-icons.js.
   ============================================================ */
(function () {
  'use strict';

  var Edition = window.Edition = window.Edition || {};

  var CFG = {
    tz: 'America/Los_Angeles',
    /* how the past list is ordered: 'desc' puts the most recent first,
       right under the TBA block, which is where someone looking for
       "what did I just miss" will start */
    pastOrder: 'desc',
    recheckMs: 60000,        /* re-evaluate while the page sits open */
    infoStart: 'css',        /* 'css' keeps your placement, 'centre' overrides it */
    /* Below this width the window is left entirely to CSS: no dragging,
       and no inline left/top written, because an inline style always
       beats a stylesheet and would strand the window mid-screen. */
    infoDragMinWidth: 768,
    clockSeconds: true,
    clock12h: true,          /* 12-hour with am/pm, matching the cards */

    /* NOAA publishes monthly Mauna Loa means as plain text and, unusually
       for a government endpoint, sends CORS headers — so this can be read
       straight from the browser with no proxy. Updated around the 5th of
       each month. */
    co2Url: 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt',
    co2Fallback: 429.12,     /* shown if the fetch fails */
    co2CacheHours: 12,       /* be a polite guest — one request per session */
    co2Suffix: ' PPM'
  };
  Edition.pageConfig = CFG;

  /* ------------------------------------------------------------
     Timezone-correct parsing.

     The attributes carry wall-clock time with no offset
     ("2026-08-05 9:40"), so the same string means different
     instants depending on the reader's location. Everything is
     resolved against the site's timezone instead, which also
     handles the PST/PDT switch without a hardcoded offset.
     ------------------------------------------------------------ */
  var MONTHS = {january:1,february:2,march:3,april:4,may:5,june:6,july:7,
    august:8,september:9,october:10,november:11,december:12,
    jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};

  /* offset between a given instant and how the tz renders it */
  function tzOffset(ms, tz) {
    var d = new Date(ms);
    var p = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(d).reduce(function (a, x) { a[x.type] = x.value; return a; }, {});
    var asUTC = Date.UTC(+p.year, +p.month - 1, +p.day,
                         (+p.hour) % 24, +p.minute, +p.second);
    return asUTC - ms;
  }

  /* wall-clock fields in tz -> a real instant */
  function fromWallClock(y, mo, d, h, mi, tz) {
    var guess = Date.UTC(y, mo - 1, d, h, mi, 0);
    var ms = guess - tzOffset(guess, tz);
    /* one refinement settles the DST boundary cases */
    ms = guess - tzOffset(ms, tz);
    return ms;
  }

  /* tolerant of the formats Webflow might hand us */
  function parseStamp(str, tz) {
    if (!str) return null;
    str = String(str).trim();
    if (!str) return null;

    /* 2026-08-05 9:40 | 2026-08-05T09:40 | 2026-08-05 09:40:00 */
    var m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?/);
    if (m) {
      return fromWallClock(+m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0, tz);
    }

    /* August 20, 2026 9:40 am | Aug 20 2026 14:30 */
    m = str.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?)?/i);
    if (m) {
      var mon = MONTHS[m[1].toLowerCase()];
      if (!mon) return null;
      var h = m[4] ? +m[4] : 0;
      var ap = (m[6] || '').toLowerCase().replace(/\./g, '');
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      return fromWallClock(+m[3], mon, +m[2], h, m[5] ? +m[5] : 0, tz);
    }

    /* last resort */
    var t = Date.parse(str);
    return isNaN(t) ? null : t;
  }
  Edition.parseStamp = function (s) { return parseStamp(s, CFG.tz); };

  /* ------------------------------------------------------------
     Past / upcoming
     ------------------------------------------------------------ */
  function cardEnd(card) {
    /* an event stays current until it has actually finished, so the
       end time is what matters, not the start */
    return parseStamp(card.getAttribute('data-end'), CFG.tz) ||
           parseStamp(card.getAttribute('data-start'), CFG.tz);
  }

  function partition() {
    var live = document.querySelector('[data-edition="events"]');
    var pastWrap = document.querySelector('.edition-past-wrap');
    if (!live || !pastWrap) return;

    var now = Date.now();
    var moved = 0;

    /* finished events leave the upcoming list */
    var cards = live.querySelectorAll('.edition-event-card');
    Array.prototype.forEach.call(cards, function (card) {
      var end = cardEnd(card);
      if (end === null) return;              /* undated: leave it alone */
      if (end <= now) {
        card.classList.add('is-past');
        card.setAttribute('data-past', 'true');
        pastWrap.appendChild(card);
        moved++;
      }
    });

    /* Upcoming events are sorted here as well as in the CMS. Webflow's
       collection sort is the primary source of order, but relying on it
       alone means the page silently drifts if that setting is ever
       changed — and sorting an already-sorted list costs nothing. */
    var live_cards = Array.prototype.slice.call(
      live.querySelectorAll('.edition-event-card'));
    if (live_cards.length > 1) {
      var host = live_cards[0].parentNode;
      live_cards.sort(function (a, b) {
        var sa = parseStamp(a.getAttribute('data-start'), CFG.tz);
        var sb = parseStamp(b.getAttribute('data-start'), CFG.tz);
        if (sa === null && sb === null) return 0;
        if (sa === null) return 1;
        if (sb === null) return -1;
        return sa - sb;
      });
      live_cards.forEach(function (c) { host.appendChild(c); });
    }

    /* anything already in the past wrap gets sorted and marked */
    var pastCards = Array.prototype.slice.call(
      pastWrap.querySelectorAll('.edition-event-card'));
    pastCards.forEach(function (c) {
      c.classList.add('is-past');
      c.setAttribute('data-past', 'true');
    });
    pastCards.sort(function (a, b) {
      var ea = cardEnd(a) || 0, eb = cardEnd(b) || 0;
      return CFG.pastOrder === 'desc' ? eb - ea : ea - eb;
    });
    pastCards.forEach(function (c) { pastWrap.appendChild(c); });

    /* hide group headings that ended up with nothing under them */
    toggleEmpty('[data-edition="heading-upcoming"]',
      live.querySelectorAll('.edition-event-card').length);
    toggleEmpty('[data-edition="heading-past"]', pastCards.length);
    var tba = document.querySelector('[data-edition="events-tba"]');
    toggleEmpty('[data-edition="heading-tba"]',
      tba ? tba.querySelectorAll('.edition-event-card').length : 0);

    Edition.counts = {
      upcoming: live.querySelectorAll('.edition-event-card').length,
      tba: tba ? tba.querySelectorAll('.edition-event-card').length : 0,
      past: pastCards.length,
      movedThisPass: moved
    };
    return Edition.counts;
  }
  function toggleEmpty(sel, n) {
    var el = document.querySelector(sel);
    if (el) el.style.display = n ? '' : 'none';
  }
  Edition.partitionEvents = partition;

  /* ------------------------------------------------------------
     Clock
     ------------------------------------------------------------ */
  var dateFmt, timeFmt;
  function initFormatters() {
    dateFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: CFG.tz, year: 'numeric', month: '2-digit', day: '2-digit'
    });
    timeFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: CFG.tz, hour12: !!CFG.clock12h,
      hour: CFG.clock12h ? 'numeric' : '2-digit',
      minute: '2-digit',
      second: CFG.clockSeconds ? '2-digit' : undefined
    });
  }
  function tickClock() {
    var now = new Date();
    var dEl = document.querySelector('[data-edition="date"]');
    var tEl = document.querySelector('[data-edition="clock"]');
    if (dEl) dEl.textContent = dateFmt.format(now);
    if (tEl) {
      var t = timeFmt.format(now);
      if (CFG.clock12h) {
        /* Intl gives "1:05:09 PM"; the cards read "1:05 pm" */
        t = t.replace(/\u202F|\u00A0/g, ' ')
             .replace(/\s*(AM|PM)$/i, function (_, ap) { return ' ' + ap.toLowerCase(); });
      } else {
        t = t.replace(/^24:/, '00:');   /* some engines emit 24:00 at midnight */
      }
      tEl.textContent = t;
    }
  }

  /* ------------------------------------------------------------
     Contrast readout — driven by the palette module
     ------------------------------------------------------------ */
  function paintContrast(p) {
    if (!p) return;
    var c = document.querySelector('[data-edition="contrast"]');
    var g = document.querySelector('[data-edition="grade"]');
    if (c) c.textContent = p.r.toFixed(2) + ':1';
    if (g) g.textContent = p.r >= 7 ? 'AAA' : (p.r >= 4.5 ? 'AA' : 'AA LARGE');
  }
  window.addEventListener('edition:palette', function (e) { paintContrast(e.detail); });


  /* ------------------------------------------------------------
     CO2

     The file is whitespace-separated columns:
       year  month  decimal_date  monthly_mean  deseasonalized  ndays  sdev  unc
     Missing readings are -99.99 and get dropped.
     ------------------------------------------------------------ */
  function parseCo2(text) {
    var out = [];
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim();
      if (!l || l.charAt(0) === '#') continue;
      var p = l.split(/\s+/);
      if (p.length < 4) continue;
      var y = +p[0], m = +p[1], dec = +p[2], v = +p[3];
      if (!isFinite(v) || v < 0) continue;
      out.push([dec, v, y, m]);
    }
    return out;
  }

  function showCo2(value, when) {
    var els = document.querySelectorAll('[data-edition="co2"]');
    Array.prototype.forEach.call(els, function (el) {
      var txt = value.toFixed(2) + CFG.co2Suffix;
      /* the element also holds the CO2 label with its subscript, so only
         the number is replaced — either a dedicated span, or the last
         text node if there isn't one */
      var slot = el.querySelector('[data-edition="co2-value"]');
      if (slot) { slot.textContent = txt; return; }
      var last = null;
      for (var i = el.childNodes.length - 1; i >= 0; i--) {
        if (el.childNodes[i].nodeType === 3) { last = el.childNodes[i]; break; }
      }
      if (last) last.nodeValue = ' ' + txt;
      else el.appendChild(document.createTextNode(' ' + txt));
    });
    Edition.co2 = { value: value, when: when || null };
  }

  function loadCo2() {
    var KEY = 'edition:co2';
    var maxAge = CFG.co2CacheHours * 3600 * 1000;

    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var c = JSON.parse(raw);
        if (c && c.ts && (Date.now() - c.ts) < maxAge && c.v) {
          showCo2(c.v, c.when);
          Edition.co2Series = c.series || null;
          return;
        }
      }
    } catch (e) {}

    showCo2(CFG.co2Fallback);          /* something sensible while it loads */

    if (!window.fetch) return;
    fetch(CFG.co2Url, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (t) {
        var rows = parseCo2(t);
        if (!rows.length) return;
        var last = rows[rows.length - 1];
        var when = last[2] + '-' + ('0' + last[3]).slice(-2);
        showCo2(last[1], when);
        Edition.co2Series = rows.map(function (r) { return [r[0], r[1]]; });
        try {
          localStorage.setItem(KEY, JSON.stringify({
            ts: Date.now(), v: last[1], when: when, series: Edition.co2Series
          }));
        } catch (e) {}
      })
      .catch(function (e) { console.warn('[co2] using fallback:', e); });
  }
  Edition.loadCo2 = loadCo2;

  /* ------------------------------------------------------------
     Back to top
     ------------------------------------------------------------ */
  function wireTop() {
    var el = document.querySelector('[data-edition="top"]');
    if (!el) return;
    el.style.cursor = 'pointer';
    el.addEventListener('click', function (e) {
      e.preventDefault();
      var reduce = window.matchMedia &&
                   window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  /* ------------------------------------------------------------
     Info window

     Deliberately not modal: no overlay, the page stays usable, and the
     window can be dragged aside rather than dismissed. Behaves like a
     small application window that happens to live on the page.

     Elements:
       [data-edition="info-open"]    opens it
       [data-edition="info-modal"]   the window
       [data-edition="info-bar"]     the drag handle, usually the title bar
       [data-edition="info-close"]   closes it

     The script only toggles `is-open` and writes left/top. Everything
     else stays in your CSS.
     ------------------------------------------------------------ */
  var winEl = null, winOpen = false, winPos = null;

  function canDragWindow() {
    return window.innerWidth >= CFG.infoDragMinWidth;
  }
  /* hand position back to the stylesheet */
  function clearInlinePosition() {
    if (!winEl) return;
    ['left', 'top', 'right', 'bottom'].forEach(function (k) {
      winEl.style.removeProperty(k);
    });
    winPos = null;
  }

  function clampWindow() {
    if (!winEl || !winPos || !canDragWindow()) return;
    var w = winEl.offsetWidth || 320, h = winEl.offsetHeight || 240;
    var vw = window.innerWidth, vh = window.innerHeight;
    /* keep a grabbable strip on screen rather than the whole window, so
       it can hang off an edge the way a real window does */
    var keep = 60;
    winPos.x = Math.min(Math.max(winPos.x, -(w - keep)), vw - keep);
    winPos.y = Math.min(Math.max(winPos.y, 0), vh - 34);
    /* Webflow may have positioned this with right/bottom. Those have to
       be released or the box is anchored from both sides at once, which
       stretches it and makes dragging do nothing visible. */
    winEl.style.right = 'auto';
    winEl.style.bottom = 'auto';
    winEl.style.left = Math.round(winPos.x) + 'px';
    winEl.style.top = Math.round(winPos.y) + 'px';
  }

  function centreWindow() {
    if (!winEl) return;
    var w = winEl.offsetWidth || 320, h = winEl.offsetHeight || 240;
    winPos = {
      x: Math.max(8, (window.innerWidth - w) / 2),
      y: Math.max(8, (window.innerHeight - h) / 2 - 30)
    };
    clampWindow();
  }

  /* On the first open, take whatever position your CSS gave the window
     and carry on from there — so a window placed bottom-left in the
     Designer opens bottom-left, and is still draggable from it. */
  function adoptCssPosition() {
    if (!winEl) return false;
    var r = winEl.getBoundingClientRect();
    if (!r.width && !r.height) return false;
    winPos = { x: r.left, y: r.top };
    return true;
  }

  function showWindow(on) {
    if (!winEl) return;
    winOpen = !!on;
    winEl.classList.toggle('is-open', winOpen);
    /* the class has to land before getBoundingClientRect is any use —
       a display:none element measures as zero */
    document.documentElement.classList.toggle('info-open', winOpen);
    document.querySelectorAll('[data-edition="info-open"]').forEach(function (b) {
      b.classList.toggle('is-active', winOpen);
    });
    if (winOpen) {
      if (!canDragWindow()) {
        clearInlinePosition();           /* CSS anchors it on small screens */
      } else if (!winPos) {
        if (CFG.infoStart === 'centre' || !adoptCssPosition()) centreWindow();
        else clampWindow();
      } else {
        clampWindow();
      }
      var first = winEl.querySelector('[data-edition="info-close"]');
      if (first && first.focus) { try { first.focus({ preventScroll: true }); } catch (e) {} }
    }
  }
  Edition.showInfo = showWindow;
  Edition.centreInfo = centreWindow;

  function wireModal() {
    winEl = document.querySelector('[data-edition="info-modal"]');
    if (!winEl) return;                       /* not built yet — stay quiet */

    winEl.style.position = 'fixed';
    if (!winEl.getAttribute('role')) winEl.setAttribute('role', 'dialog');
    winEl.setAttribute('aria-label', winEl.getAttribute('aria-label') || 'Information');

    document.querySelectorAll('[data-edition="info-open"]').forEach(function (b) {
      b.style.cursor = 'pointer';
      b.addEventListener('click', function (e) { e.preventDefault(); showWindow(!winOpen); });
    });
    document.querySelectorAll('[data-edition="info-close"]').forEach(function (b) {
      b.style.cursor = 'pointer';
      b.addEventListener('click', function (e) { e.preventDefault(); showWindow(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && winOpen) showWindow(false);
    });

    /* ---- dragging ---- */
    var bar = winEl.querySelector('[data-edition="info-bar"]') || winEl;
    var dragging = false, grab = null;
    bar.style.userSelect = 'none';
    function syncDragAffordance() {
      var on = canDragWindow();
      bar.style.cursor = on ? 'move' : '';
      /* leaving touch-action alone below the breakpoint means the bar can
         still be scrolled past normally on a phone */
      bar.style.touchAction = on ? 'none' : '';
    }
    syncDragAffordance();

    bar.addEventListener('pointerdown', function (e) {
      if (!canDragWindow()) return;      /* anchored by CSS at this width */
      /* let buttons inside the bar still be clickable */
      if (e.target.closest && e.target.closest('[data-edition="info-close"]')) return;
      dragging = true;
      var r = winEl.getBoundingClientRect();
      grab = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      winPos = { x: r.left, y: r.top };
      try { bar.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    bar.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      winPos = { x: e.clientX - grab.dx, y: e.clientY - grab.dy };
      clampWindow();
      e.preventDefault();
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      bar.addEventListener(ev, function () { dragging = false; });
    });

    window.addEventListener('resize', function () {
      syncDragAffordance();
      /* crossing the breakpoint has to drop any inline position, or a
         window dragged on desktop stays stuck there when the viewport
         narrows */
      if (!canDragWindow()) clearInlinePosition();
      else if (winOpen) clampWindow();
    });

    showWindow(false);
  }

  /* ------------------------------------------------------------
     Boot
     ------------------------------------------------------------ */
  function boot() {
    initFormatters();
    tickClock();
    setInterval(tickClock, 1000);

    partition();
    setInterval(partition, CFG.recheckMs);

    if (Edition.palette) paintContrast(Edition.palette);
    wireTop();
    wireModal();
    loadCo2();
  }

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);

  /* console helper: Edition.checkDates() */
  Edition.checkDates = function () {
    var rows = [];
    document.querySelectorAll('.edition-event-card').forEach(function (c) {
      var s = c.getAttribute('data-start'), e = c.getAttribute('data-end');
      var se = parseStamp(s, CFG.tz), ee = parseStamp(e, CFG.tz);
      var f = function (ms) {
        return ms === null ? '—' : new Intl.DateTimeFormat('en-US', {
          timeZone: CFG.tz, dateStyle: 'medium', timeStyle: 'short'
        }).format(new Date(ms));
      };
      rows.push({
        title: (c.querySelector('.edition-event-title') || {}).textContent || '',
        rawStart: s || '—',
        parsedStart: f(se),
        parsedEnd: f(ee),
        past: ee !== null && ee <= Date.now()
      });
    });
    if (console.table) console.table(rows);
    return rows;
  };
})();
