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
    clockSeconds: true,
    clock12h: true           /* 12-hour with am/pm, matching the cards */
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
     Info modal
     ------------------------------------------------------------ */
  function wireModal() {
    var open = document.querySelector('[data-edition="info-open"]');
    var modal = document.querySelector('[data-edition="info-modal"]');
    if (!open || !modal) return;               /* not built yet — skip quietly */
    var close = document.querySelector('[data-edition="info-close"]');

    function show(on) {
      modal.style.display = on ? '' : 'none';
      modal.classList.toggle('is-open', on);
      document.documentElement.classList.toggle('edi-modal-open', on);
    }
    show(false);
    open.style.cursor = 'pointer';
    open.addEventListener('click', function (e) { e.preventDefault(); show(true); });
    if (close) close.addEventListener('click', function (e) { e.preventDefault(); show(false); });
    modal.addEventListener('click', function (e) { if (e.target === modal) show(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') show(false);
    });
    Edition.showInfo = show;
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
