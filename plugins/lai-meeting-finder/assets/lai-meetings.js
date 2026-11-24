/* LAI Meeting Finder — vanilla JS, no dependencies. Adapted from Area 53 Meeting Finder 0.5.1. */
(function () {
  'use strict';

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) {
    if (!u) return '';
    try { var x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; }
  }
  function fmtTime(t) {
    if (!t) return '';
    var p = t.split(':'), h = +p[0], m = p[1] || '00';
    if (h === 0 && m === '00') return 'Midnight';
    if (h === 12 && m === '00') return 'Noon';
    return ((h % 12) || 12) + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  function mins(t) { var p = (t || '0:0').split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function duration(a, b) {
    if (!b) return '';
    var d = mins(b) - mins(a); if (d <= 0) d += 1440;
    return d % 60 === 0 ? (d / 60) + ' hr' : d < 60 ? d + ' min' : Math.floor(d / 60) + ' hr ' + (d % 60) + ' min';
  }
  function nowIn(tz) {
    // {day, minutes} in the site's timezone
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
      return { day: DAYS.indexOf(o.weekday), minutes: (+o.hour % 24) * 60 + (+o.minute) };
    } catch (e) { var d = new Date(); return { day: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() }; }
  }
  function miles(lat1, lon1, lat2, lon2) {
    var r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function fmtDist(d) { return d < 0.1 ? 'Nearby' : (d < 10 ? d.toFixed(1) : Math.round(d)) + ' mi'; }
  var ICON = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    locate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    chev: '<svg class="laim-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
  };

  function init(root) {
    var raw = root.querySelector('.laim-data');
    if (!raw) return;
    var parsed; try { parsed = JSON.parse(raw.textContent); } catch (e) { root.innerHTML = '<p class="laim-error">Could not load meetings.</p>'; return; }
    var data = parsed.data, cfg = parsed.config || {}, TYPES = data.types || {}, tz = data.timezone || 'America/New_York';
    var HIDDEN_TYPES = { ONL: 1, TC: 1 };
    var all = (data.meetings || []).filter(function (m) { return m.attendance_option !== 'inactive'; });
    all.forEach(function (m) {
      m.day = +m.day;
      if (!m.city && m.formatted_address) {
        var cm = /(?:^|, )([^,]+), [A-Z]{2}(?: \d{5}(?:-\d{4})?)?(?:, (?:USA|United States))?$/.exec(m.formatted_address);
        if (cm) m.city = cm[1];
      }
    });

    /* ---------- districts: only if 12 Step Meeting List has them for the groups ---------- */
    function dlabel(d) { return /^\d/.test(d) ? 'District ' + d : String(d); }
    function dsortKey(d) { var n = parseInt(String(d).replace(/\D.*$/, ''), 10); return isFinite(n) ? n : 999; }
    function assignDistricts() { all.forEach(function (m) { if (m.district) m._d = m.district; }); }

    var now = nowIn(tz), today = now.day;
    var state = { q: '', day: cfg.defaultDay === 'any' ? 'any' : (/^[0-6]$/.test(cfg.defaultDay) ? +cfg.defaultDay : today), region: '', type: '', att: '', tod: '', near: null, dist: '25', sort: 'soon' };
    // restore from the address bar
    var qs = new URLSearchParams(location.search);
    if (qs.has('laiq')) state.q = qs.get('laiq');
    if (qs.has('laiday')) state.day = qs.get('laiday') === 'any' ? 'any' : +qs.get('laiday');
    ['region', 'type', 'att', 'tod'].forEach(function (k) { if (qs.has('lai' + k)) state[k] = qs.get('lai' + k); });
    if (!state.region && cfg.defaultRegion) state.region = cfg.defaultRegion;
    state.district = qs.get('laidistrict') || '';
    var wantDistrict = state.district || cfg.defaultDistrict || '';
    var showRegion = cfg.filter !== 'district';
    var showDistrict = cfg.filter === 'district' || cfg.filter === 'both';

    state.view = qs.get('laiview') === 'map' || (!qs.has('laiview') && cfg.defaultView === 'map') ? 'map' : 'list';
    var mapEnabled = !!(cfg.maplibreJs && cfg.mapStyle);
    if (!mapEnabled) state.view = 'list';

    // option lists
    var regions = {}, types = {};
    all.forEach(function (m) {
      if (m.region) regions[m.region] = 1;
      (m.types || []).forEach(function (t) { if (!HIDDEN_TYPES[t] && TYPES[t]) types[t] = TYPES[t]; });
    });
    var regionList = Object.keys(regions).sort();
    var typeList = Object.keys(types).sort(function (a, b) { return types[a].localeCompare(types[b]); });

    // Links made for 12 Step Meeting List's own finder keep working on this page.
    function slugify(x) { return String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
    var openId = cfg.openMeeting ? String(cfg.openMeeting) : '';
    (function () {
      var p = function (k) { return qs.get(k); };
      var wd = p('weekday') || '', tday = p('tsml-day');
      if (wd) { var di = DAYS.map(function (d) { return d.toLowerCase(); }).indexOf(wd.split(',')[0]); if (di > -1) state.day = di; }
      else if (tday !== null && /^[0-6]$/.test(tday)) state.day = +tday;
      else if (tday === 'any') state.day = 'any';
      if (!state.q && (p('search') || p('tsml-query'))) state.q = p('search') || p('tsml-query');
      var rg = p('region') || p('tsml-region');
      if (rg && !state.region) {
        var hit = Object.keys(regions).filter(function (r) { return slugify(r) === slugify(rg); })[0];
        if (hit) { state.region = hit; showRegion = true; }
      }
      var tp = (p('type') || p('tsml-type') || '').split(',').filter(Boolean);
      tp.forEach(function (t) {
        if (t === 'online') state.att = 'online';
        else if (t === 'in-person') state.att = 'in_person';
        else if (!state.type) {
          var code = Object.keys(TYPES).filter(function (c) { return c === t || slugify(TYPES[c]) === slugify(t); })[0];
          if (code) state.type = code;
        }
      });
      if (p('view') === 'map' && mapEnabled) state.view = 'map';
      if (p('meeting')) {
        var bySlug = all.filter(function (m) { return m.slug === p('meeting'); })[0];
        if (bySlug) openId = String(bySlug.id);
      }
      if (openId) {
        var om = all.filter(function (m) { return String(m.id) === openId; })[0];
        if (om) { state.day = om.day; state.view = 'list'; } else openId = '';
      }
    })();
    var openIds = {};

    function opts(list, sel, labelFn, first) {
      return '<option value="">' + first + '</option>' + list.map(function (v) {
        return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(labelFn ? labelFn(v) : v) + '</option>';
      }).join('');
    }

    var dayPills = '<button type="button" class="laim-day" data-day="any">All days</button>';
    for (var i = 0; i < 7; i++) {
      var d = (today + i) % 7;
      dayPills += '<button type="button" class="laim-day" data-day="' + d + '">' + (i === 0 ? 'Today' : DAYS[d].slice(0, 3)) + (i === 0 ? '<small>' + DAYS[d].slice(0, 3) + '</small>' : '') + '</button>';
    }

    root.innerHTML =
      '<div class="laim-controls">' +
        '<div class="laim-near"><button type="button" class="laim-locate" aria-pressed="false">' + ICON.locate + '<span class="laim-locate-text"></span></button>' +
          '<span class="laim-nearopts" hidden>' +
            '<select data-f="dist" aria-label="Distance"><option value="5">Within 5 mi</option><option value="10">Within 10 mi</option><option value="25" selected>Within 25 mi</option><option value="50">Within 50 mi</option><option value="">Any distance</option></select>' +
            '<select data-f="sort" aria-label="Sort"><option value="soon" selected>Soonest first</option><option value="near">Nearest first</option><option value="time">By day and time</option></select>' +
            '<button type="button" class="laim-linkbtn" data-clear-near>Stop using my location</button>' +
          '</span>' +
          '<span class="laim-nearmsg" role="status"></span></div>' +
        '<label class="laim-search"><span class="laim-sr">Search meetings</span>' + ICON.search +
          '<input type="search" placeholder="Search by meeting, group, place, or town" value="' + esc(state.q) + '" data-f="q"></label>' +
        '<div class="laim-days" role="group" aria-label="Day of the week">' + dayPills + '</div>' +
        '<div class="laim-filters">' +
          '<select data-f="tod" aria-label="Time of day"><option value="">Any time</option><option value="am">Morning (before noon)</option><option value="pm">Afternoon (noon–5)</option><option value="eve">Evening (after 5)</option><option value="soon">Starting soon</option></select>' +
          '<select data-f="att" aria-label="Attendance"><option value="">In person or online</option><option value="in_person">In person</option><option value="online">Online</option></select>' +
          (showDistrict ? '<select data-f="district" aria-label="District" disabled><option value="">Finding districts…</option></select>' : '') +
          (showRegion ? '<select data-f="region" aria-label="Town">' + opts(regionList, state.region, null, 'All towns') + '</select>' : '') +
          '<select data-f="type" aria-label="Meeting type">' + opts(typeList, state.type, function (t) { return types[t]; }, 'All meeting types') + '</select>' +
        '</div>' +
      '</div>' +
      '<div class="laim-bar"><div class="laim-count" aria-live="polite"></div><div class="laim-bar-right"><button type="button" class="laim-reset" hidden>Clear filters</button>' +
        (mapEnabled ? '<div class="laim-views" role="group" aria-label="View"><button type="button" class="laim-view" data-view="list">' + ICON.list + 'List</button><button type="button" class="laim-view" data-view="map">' + ICON.pin + 'Map</button></div>' : '') +
      '</div></div>' +
      '<div class="laim-next" hidden></div>' +
      '<div class="laim-results"></div>' +
      (mapEnabled ? '<div class="laim-mapwrap" hidden><div class="laim-map" role="region" aria-label="Map of meetings"></div><div class="laim-mapmsg" hidden></div><p class="laim-mapnote"></p></div>' : '') +
      '<p class="laim-foot">Times are shown in Eastern time. If you’re unsure, please check with the group or call the LAI office.</p>';

    var $ = function (s) { return root.querySelector(s); };
    $('[data-f="tod"]').value = state.tod; $('[data-f="att"]').value = state.att;

    function matches(m) {
      if (state.day !== 'any' && m.day !== state.day) return false;
      if (state.region && m.region !== state.region) return false;
      if (state.district && m._d !== state.district) return false;
      if (state.type && (m.types || []).indexOf(state.type) < 0) return false;
      if (state.att === 'in_person' && m.attendance_option === 'online') return false;
      if (state.att === 'online' && m.attendance_option !== 'online' && m.attendance_option !== 'hybrid') return false;
      var t = mins(m.time);
      if (state.tod === 'am' && t >= 720) return false;
      if (state.tod === 'pm' && (t < 720 || t >= 1020)) return false;
      if (state.tod === 'eve' && t < 1020) return false;
      if (state.tod === 'soon') { if (m.day !== today || t < now.minutes || t > now.minutes + 120) return false; }
      if (state.near && state.dist) {
        if (!hasCoords(m)) { if (state.att !== 'online') return false; }
        else if (m._dist > +state.dist) return false;
      }
      if (state.q) {
        var hay = [m.name, m.group, m.location, m.formatted_address, m.address, m.city, m.region, m.sub_region, m.notes, m.location_notes].join(' ').toLowerCase();
        return state.q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) > -1; });
      }
      return true;
    }
    function byNear() { return !!(state.near && state.sort !== 'time'); }
    function sortFn(a, b) {
      if (state.near && state.sort === 'soon') {
        var ua = untilStart(a), ub = untilStart(b);
        if (ua !== ub) return ua - ub;
        return (a._dist == null ? 1e9 : a._dist) - (b._dist == null ? 1e9 : b._dist);
      }
      if (state.near && state.sort === 'near') {
        var da = a._dist == null ? 1e9 : a._dist, db = b._dist == null ? 1e9 : b._dist;
        if (Math.abs(da - db) > 0.05) return da - db;
      }
      return baseSort(a, b);
    }
    function baseSort(a, b) { return (a.day - b.day) || (mins(a.time) - mins(b.time)) || String(a.name).localeCompare(b.name); }

    function card(m) {
      var soon = m.day === today && mins(m.time) >= now.minutes && mins(m.time) <= now.minutes + 60;
      var online = m.attendance_option === 'online';
      var place = online ? (m.group || 'Online meeting') : (m.location || m.group || '');
      var dist = state.near && m._dist != null ? fmtDist(m._dist) : '';
      var town = m.city || m.region || '';
      var where = online ? 'Online only' : [town, m._d ? dlabel(m._d) : ''].filter(Boolean).join(' · ');
      var shown = (m.types || []).filter(function (t) { return !HIDDEN_TYPES[t] && TYPES[t]; });
      var badges = '';
      if (soon) badges += '<span class="laim-badge soon">Starting soon</span>';
      if (m.attendance_option === 'online') badges += '<span class="laim-badge online">Online</span>';
      if (m.attendance_option === 'hybrid') badges += '<span class="laim-badge online">In person + online</span>';
      if (shown.indexOf('C') > -1) badges += '<span class="laim-badge closed">Closed</span>';
      if (shown.indexOf('O') > -1) badges += '<span class="laim-badge">Open</span>';
      shown.filter(function (t) { return t !== 'C' && t !== 'O'; }).slice(0, 3).forEach(function (t) { badges += '<span class="laim-badge">' + esc(TYPES[t]) + '</span>'; });

      var id = 'laim-d-' + m.id;
      return '<li class="laim-card' + (soon ? ' is-soon' : '') + '" data-id="' + esc(m.id) + '">' +
        '<button type="button" class="laim-head" aria-expanded="false" aria-controls="' + id + '">' +
          '<span class="laim-time">' + esc(fmtTime(m.time)) + '<small>' + esc(duration(m.time, m.end_time) || DAYS[m.day].slice(0, 3)) + '</small></span>' +
          '<span><span class="laim-name">' + esc(m.name) + '</span>' +
            '<span class="laim-sub">' + esc(place) + (where ? ' — ' + esc(where) : '') + '</span>' +
            (dist ? '<span class="laim-dist">' + ICON.pin + esc(dist) + (state.day === 'any' && byNear() ? ' · ' + DAYS[m.day] : '') + '</span>' : '') +
            '<span class="laim-badges">' + badges + '</span></span>' + ICON.chev +
        '</button><div class="laim-detail" id="' + id + '" hidden></div></li>';
    }

    function detail(m) {
      var out = '', addr = m.formatted_address || m.address;
      var isOnline = m.attendance_option === 'online' || m.attendance_option === 'hybrid';
      var conf = isOnline ? safeUrl(m.conference_url) : '';
      out += '<div class="laim-actions">';
      if (conf) out += '<a class="laim-btn primary" href="' + esc(conf) + '" target="_blank" rel="noopener">Join online</a>';
      if (isOnline && m.conference_phone) out += '<a class="laim-btn" href="tel:' + esc(String(m.conference_phone).replace(/[^\d,;#*+]/g, '')) + '">Call in: ' + esc(m.conference_phone) + '</a>';
      if (addr && m.attendance_option !== 'online') out += '<a class="laim-btn' + (conf ? '' : ' primary') + '" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr) + '">Get directions</a>';
      var page = safeUrl(m.url); if (page) out += '<a class="laim-btn link" href="' + esc(page) + '">Meeting page</a>';
      out += '</div>';
      if (addr && m.attendance_option !== 'online') out += '<div><h4>Address</h4><p>' + esc(m.location ? m.location + ' — ' : '') + esc(addr) + '</p>' + (m.location_notes ? '<p class="laim-notes laim-soft">' + esc(m.location_notes) + '</p>' : '') + '</div>';
      if (isOnline && (m.conference_url_notes || m.conference_phone_notes)) out += '<div><h4>Online details</h4><p class="laim-notes">' + esc([m.conference_url_notes, m.conference_phone_notes].filter(Boolean).join('\n')) + '</p></div>';
      if (m.notes) out += '<div><h4>About this meeting</h4><p class="laim-notes">' + esc(m.notes) + '</p></div>';
      var fmt = (m.types || []).filter(function (t) { return TYPES[t]; }).map(function (t) { return TYPES[t]; });
      if (fmt.length) out += '<div><h4>Format</h4><p>' + esc(fmt.join(', ')) + '</p></div>';
      var meta = [m.group ? 'Group: ' + m.group : '', m._d ? dlabel(m._d) : ''].filter(Boolean);
      if (meta.length) out += '<div><h4>Group info</h4><p>' + esc(meta.join(' · ')) + '</p></div>';
      var fb = safeUrl(m.feedback_url); if (fb) out += '<div><a class="laim-btn link" href="' + esc(fb) + '" target="_blank" rel="noopener">Suggest a change to this listing</a></div>';
      return out;
    }

    function render() {
      var list = all.filter(matches).sort(sortFn);
      var active = state.q || state.region || state.district || state.type || state.att || state.tod;
      if (!$('.laim-locate').disabled) setLocate(state.near ? 'on' : 'idle');
      $('.laim-nearopts').hidden = !state.near;
      renderNext();
      $('.laim-count').innerHTML = list.length + ' meeting' + (list.length === 1 ? '' : 's') + (state.day === 'any' ? '' : ' <span>' + (state.day === today ? 'today (' + DAYS[state.day] + ')' : 'on ' + DAYS[state.day]) + '</span>');
      $('.laim-reset').hidden = !active;
      root.querySelectorAll('.laim-day').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.day === String(state.day))); });

      root.querySelectorAll('.laim-view').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === state.view)); });
      var res = $('.laim-results'), mw = $('.laim-mapwrap');
      res.hidden = state.view === 'map';
      if (mw) mw.hidden = state.view !== 'map';
      if (state.view === 'map') {
        res.innerHTML = '';
        updateMap(list);
      } else if (!list.length) {
        res.innerHTML = '<div class="laim-empty"><strong>No meetings match</strong>Try another day or clear a filter.</div>';
      } else if (state.day === 'any' && !byNear()) {
        var html = '', cur = -1;
        list.forEach(function (m) {
          if (m.day !== cur) { if (cur !== -1) html += '</ul>'; cur = m.day; html += '<div class="laim-daygroup">' + DAYS[m.day] + '</div><ul class="laim-list">'; }
          html += card(m);
        });
        res.innerHTML = html + '</ul>';
      } else {
        var later = list, earlier = [];
        if (state.near && state.sort === 'soon' && state.day === today) {
          // soonest first: meetings that already started today go below a divider
          later = list.filter(function (m) { return mins(m.time) >= now.minutes; });
          earlier = list.filter(function (m) { return mins(m.time) < now.minutes; });
        }
        res.innerHTML = (later.length ? '<ul class="laim-list">' + later.map(card).join('') + '</ul>' : '<div class="laim-empty"><strong>No more meetings near you today</strong>Try Tomorrow, or All days.</div>') +
          (earlier.length ? '<div class="laim-daygroup">Earlier today</div><ul class="laim-list laim-earlier">' + earlier.map(card).join('') + '</ul>' : '');
      }
      Object.keys(openIds).forEach(function (id) {
        var li = res.querySelector('.laim-card[data-id="' + id + '"]');
        if (!li) return;
        var pane = li.querySelector('.laim-detail'), m = all.filter(function (x) { return String(x.id) === id; })[0];
        if (!m) return;
        pane.innerHTML = detail(m); pane.hidden = false;
        li.querySelector('.laim-head').setAttribute('aria-expanded', 'true');
      });
      // keep the address bar in step (no history spam)
      var u = new URL(location.href), sp = u.searchParams;
      [['q', state.q], ['view', state.view === 'map' ? 'map' : ''], ['day', state.day === today ? '' : state.day], ['region', state.region], ['district', state.district], ['type', state.type], ['att', state.att], ['tod', state.tod]].forEach(function (kv) {
        if (kv[1] !== '' && kv[1] != null) sp.set('lai' + kv[0], kv[1]); else sp.delete('lai' + kv[0]);
      });
      try { history.replaceState(null, '', u.pathname + (sp.toString() ? '?' + sp : '') + u.hash); } catch (e) {}
    }

    /* ---------- map (MapLibre + OpenFreeMap), loaded only when first opened ---------- */
    var map = null, mapReady = null, markers = [], youMarker = null, lastFit = '';

    function loadAssets() {
      if (window.maplibregl) return Promise.resolve();
      if (window.__laimLoading) return window.__laimLoading;
      window.__laimLoading = new Promise(function (resolve, reject) {
        if (cfg.maplibreCss) {
          var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = cfg.maplibreCss; document.head.appendChild(l);
        }
        var s = document.createElement('script'); s.src = cfg.maplibreJs; s.async = true;
        s.onload = function () { window.maplibregl ? resolve() : reject(new Error('MapLibre missing')); };
        s.onerror = function () { window.__laimLoading = null; reject(new Error('MapLibre failed to load')); };
        document.head.appendChild(s);
      });
      return window.__laimLoading;
    }

    function hasCoords(m) {
      var la = parseFloat(m.latitude), lo = parseFloat(m.longitude);
      return m.attendance_option !== 'online' && isFinite(la) && isFinite(lo) && !(la === 0 && lo === 0);
    }

    function boundsOf(list) {
      var b = null;
      list.forEach(function (m) {
        var p = [+m.longitude, +m.latitude];
        if (!b) b = new maplibregl.LngLatBounds(p, p); else b.extend(p);
      });
      return b;
    }

    function mapMsg(text) {
      var el = $('.laim-mapmsg'); if (!el) return;
      el.hidden = !text; el.textContent = text || '';
    }

    function ensureMap() {
      if (mapReady) return mapReady;
      mapMsg('Loading map…');
      mapReady = loadAssets().then(function () {
        var start = boundsOf(all.filter(hasCoords));
        var dark = cfg.mapStyleDark && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        map = new maplibregl.Map({
          container: $('.laim-map'),
          style: dark ? cfg.mapStyleDark : cfg.mapStyle,
          bounds: start || undefined,
          center: start ? undefined : (cfg.center || [-82.5993, 39.7137]),
          zoom: start ? undefined : 9,
          fitBoundsOptions: { padding: 40, maxZoom: 13 },
          cooperativeGestures: true,
          attributionControl: { compact: true }
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('zoomend', function () { drawMarkers(); });
        return new Promise(function (resolve, reject) {
          if (map.loaded()) { resolve(map); return; }
          var done = false;
          var fail = function (why) {
            if (done) return; done = true;
            try { map.remove(); } catch (e) {} map = null;
            reject(why);
          };
          // the style (from OpenFreeMap) must load; if it can't be reached, say so instead of spinning forever
          var t = setTimeout(function () { fail(new Error('timeout')); }, 12000);
          map.once('load', function () { if (done) return; done = true; clearTimeout(t); resolve(map); });
          map.on('error', function (ev) { if (!map || map.isStyleLoaded()) return; clearTimeout(t); fail(ev && ev.error || new Error('style')); });
        });
      }).then(function (m) { mapMsg(''); return m; }, function (err) {
        mapReady = null;
        mapMsg('The map couldn’t load right now. The List view has every meeting.');
        throw err;
      });
      return mapReady;
    }

    function popupHtml(group) {
      var first = group[0], addr = first.formatted_address || first.address || '';
      var h = '<div class="laim-pop"><strong>' + esc(first.location || first.group || 'Meeting location') + '</strong>';
      if (addr) h += '<div class="laim-pop-addr">' + esc(addr) + '</div>';
      h += '<ul>';
      group.forEach(function (m) {
        h += '<li><button type="button" data-open="' + esc(m.id) + '"><span class="laim-pop-time">' +
          (state.day === 'any' ? esc(DAYS[m.day].slice(0, 3)) + ' ' : '') + esc(fmtTime(m.time)) + '</span>' + esc(m.name) +
          (m.attendance_option === 'hybrid' ? ' <em>+ online</em>' : '') + '</button></li>';
      });
      h += '</ul>';
      if (addr) h += '<a class="laim-pop-dir" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr) + '">Get directions</a>';
      return h + '</div>';
    }

    var locGroups = [], clusterSig = '';
    var CLUSTER_PX = 46, CLUSTER_OFF_ZOOM = 14;

    function pinMarker(L) {
      var first = L.g[0];
      var el = document.createElement('div');
      el.className = 'laim-marker';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'laim-pin' + (L.soon ? ' is-soon' : '');
      btn.setAttribute('aria-label', (first.location || first.name) + ': ' + L.g.length + ' meeting' + (L.g.length === 1 ? '' : 's'));
      btn.innerHTML = '<svg viewBox="0 0 32 42" aria-hidden="true"><path d="M16 1C7.7 1 1 7.6 1 15.8 1 27 16 41 16 41s15-14 15-25.2C31 7.6 24.3 1 16 1z"/></svg><span>' + L.g.length + '</span>';
      el.appendChild(btn);
      var popup = new maplibregl.Popup({ offset: 30, maxWidth: '320px', className: 'laim-popup' }).setHTML(popupHtml(L.g));
      return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([L.lng, L.lat]).setPopup(popup);
    }

    function clusterMarker(members) {
      var n = 0, soon = false, b = null;
      members.forEach(function (L) {
        n += L.g.length; soon = soon || L.soon;
        if (!b) b = new maplibregl.LngLatBounds([L.lng, L.lat], [L.lng, L.lat]); else b.extend([L.lng, L.lat]);
      });
      var c = b.getCenter();
      var el = document.createElement('div');
      el.className = 'laim-marker';
      var btn = document.createElement('button');
      btn.type = 'button';
      var size = n < 10 ? 'sm' : n < 50 ? 'md' : 'lg';
      btn.className = 'laim-cluster laim-cluster-' + size + (soon ? ' is-soon' : '');
      btn.setAttribute('aria-label', n + ' meetings at ' + members.length + ' places. Zoom in to see them.');
      btn.textContent = n;
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        map.fitBounds(b, { padding: 70, maxZoom: Math.min(map.getZoom() + 4, 16), duration: 450 });
      });
      el.appendChild(btn);
      return new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(c);
    }

    // group locations that would overlap on screen at the current zoom
    function drawMarkers() {
      if (!map) return;
      var z = map.getZoom(), clusters = [];
      if (z >= CLUSTER_OFF_ZOOM) {
        clusters = locGroups.map(function (L) { return [L]; });
      } else {
        var pts = locGroups.map(function (L) { var p = map.project([L.lng, L.lat]); return { L: L, x: p.x, y: p.y, used: false }; });
        pts.sort(function (a, b) { return b.L.g.length - a.L.g.length; });
        pts.forEach(function (p) {
          if (p.used) return;
          p.used = true;
          var c = [p.L];
          pts.forEach(function (q) {
            if (!q.used && Math.abs(q.x - p.x) < CLUSTER_PX && Math.abs(q.y - p.y) < CLUSTER_PX) { q.used = true; c.push(q.L); }
          });
          clusters.push(c);
        });
      }
      var sig = clusters.map(function (c) { return c.map(function (L) { return L.k; }).sort().join(','); }).sort().join('|');
      if (sig === clusterSig) return; // nothing changed: keep open popups open
      clusterSig = sig;
      markers.forEach(function (mk) { mk.remove(); }); markers = [];
      clusters.forEach(function (c) {
        markers.push((c.length === 1 ? pinMarker(c[0]) : clusterMarker(c)).addTo(map));
      });
    }

    function updateMap(list) {
      var placed = list.filter(hasCoords);
      var onlineOnly = list.filter(function (m) { return m.attendance_option === 'online'; }).length;
      var missing = list.length - placed.length - onlineOnly;
      var note = [];
      if (onlineOnly) note.push(onlineOnly + ' online-only meeting' + (onlineOnly === 1 ? ' is' : 's are') + ' not on the map');
      if (missing) note.push(missing + ' meeting' + (missing === 1 ? ' has' : 's have') + ' no map location');
      $('.laim-mapnote').innerHTML = note.length ? esc(note.join(' · ')) + ' — <button type="button" class="laim-linkbtn" data-goto-list>see them in the list</button>.' : '';

      ensureMap().then(function () {
        map.resize();
        var groups = {};
        placed.forEach(function (m) {
          var k = (+m.latitude).toFixed(5) + ',' + (+m.longitude).toFixed(5);
          (groups[k] = groups[k] || []).push(m);
        });
        locGroups = Object.keys(groups).map(function (k) {
          var g = groups[k].sort(sortFn), first = g[0];
          return {
            k: k, g: g, lng: +first.longitude, lat: +first.latitude,
            soon: g.some(function (m) { return m.day === today && mins(m.time) >= now.minutes && mins(m.time) <= now.minutes + 60; })
          };
        });
        clusterSig = '';
        mapMsg(placed.length ? '' : 'No in-person meetings match these filters.');
        if (youMarker) { youMarker.remove(); youMarker = null; }
        if (state.near) {
          var you = document.createElement('div'); you.className = 'laim-you'; you.setAttribute('aria-label', 'Your location');
          youMarker = new maplibregl.Marker({ element: you }).setLngLat([state.near.lng, state.near.lat]).addTo(map);
        }
        var key = Object.keys(groups).sort().join('|') + (state.near ? '|you' : '');
        if (placed.length && key !== lastFit) {
          var fb = boundsOf(placed); if (state.near) fb.extend([state.near.lng, state.near.lat]);
          map.fitBounds(fb, { padding: 50, maxZoom: 14, duration: lastFit ? 500 : 0 });
        }
        lastFit = key;
        drawMarkers();
      }).catch(function () {});
    }

    function openInList(id) {
      state.view = 'list'; render();
      var li = root.querySelector('.laim-card[data-id="' + String(id).replace(/"/g, '') + '"]');
      if (!li) return;
      var head = li.querySelector('.laim-head');
      if (head.getAttribute('aria-expanded') !== 'true') head.click();
      li.scrollIntoView({ behavior: 'smooth', block: 'center' });
      head.focus({ preventScroll: true });
    }

    /* ---------- near me (browser geolocation; the location never leaves the browser) ---------- */
    function setLocate(mode) {
      var btn = $('.laim-locate'), t = btn.querySelector('.laim-locate-text');
      var L = {
        idle: ['Next meeting near me', 'The closest meetings, starting soonest'],
        busy: ['Finding you…', 'Your browser will ask to use your location'],
        on: ['Showing meetings near you', 'Tap to stop using your location']
      }[mode];
      t.innerHTML = '<strong>' + L[0] + '</strong><small>' + L[1] + '</small>';
      btn.disabled = mode === 'busy';
      btn.classList.toggle('is-on', mode === 'on');
      btn.setAttribute('aria-pressed', String(mode === 'on'));
    }
    function nearMsg(t, isErr) { var el = $('.laim-nearmsg'); el.textContent = t || ''; el.classList.toggle('is-err', !!isErr); }
    function locate() {
      if (!navigator.geolocation) { nearMsg('Your browser can’t share your location.', true); return; }
      setLocate('busy'); nearMsg('');
      navigator.geolocation.getCurrentPosition(function (pos) {
        $('.laim-locate').disabled = false;
        state.near = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        all.forEach(function (m) { m._dist = hasCoords(m) ? miles(state.near.lat, state.near.lng, +m.latitude, +m.longitude) : null; });
        // if nothing is within 25 mi, widen automatically
        var anyClose = all.some(function (m) { return m._dist != null && m._dist <= 25; });
        state.dist = anyClose ? '25' : '';
        $('[data-f="dist"]').value = state.dist;
        nearMsg(anyClose ? '' : 'No meetings within 25 miles — showing the closest ones, soonest first.');
        render();
        var nb = $('.laim-next');
        if (nb && !nb.hidden && nb.getBoundingClientRect().top > window.innerHeight * 0.6) nb.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, function (err) {
        setLocate('idle');
        nearMsg(err.code === 1 ? 'Location is turned off for this site. Allow it in your browser, or search by town instead.' : 'We couldn’t find your location. Try searching by town instead.', true);
      }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
    }
    function untilStart(m) {
      var d = (m.day - today + 7) % 7, t = mins(m.time) - now.minutes;
      if (d === 0 && t < 0) d = 7;
      return d * 1440 + t;
    }
    function whenText(m) {
      var u = untilStart(m), dd = (m.day - today + 7) % 7;
      if (u < 60) return 'Starts in ' + Math.max(u, 1) + ' min';
      if (dd === 0 && u < 1440) return u < 180 ? 'Starts in ' + Math.floor(u / 60) + ' hr' + (u % 60 ? ' ' + (u % 60) + ' min' : '') : 'Today at ' + fmtTime(m.time);
      if (dd === 1) return 'Tomorrow at ' + fmtTime(m.time);
      return DAYS[m.day] + ' at ' + fmtTime(m.time);
    }
    function renderNext() {
      var box = $('.laim-next');
      if (!state.near) { box.hidden = true; box.innerHTML = ''; return; }
      var limit = state.dist ? +state.dist : Infinity;
      var pool = all.filter(function (m) {
        if (m._dist == null || m._dist > limit) return false;
        if (state.type && (m.types || []).indexOf(state.type) < 0) return false;
        return true;
      }).sort(function (a, b) { return (untilStart(a) - untilStart(b)) || (a._dist - b._dist); });
      if (!pool.length) {
        box.hidden = false;
        box.innerHTML = '<div class="laim-next-none">No in-person meetings within ' + esc(state.dist) + ' miles. Try a wider distance.</div>';
        return;
      }
      var m = pool[0], addr = m.formatted_address || m.address || '';
      var h = '<div class="laim-next-card' + (untilStart(m) <= 60 ? ' is-soon' : '') + '">' +
        '<div class="laim-next-label">Next meeting near you</div>' +
        '<div class="laim-next-when">' + esc(whenText(m)) + '</div>' +
        '<div class="laim-next-name">' + esc(m.name) + '</div>' +
        '<div class="laim-next-where">' + esc(m.location || m.group || '') + ' · ' + esc(fmtDist(m._dist)) + ' away' + (m.attendance_option === 'hybrid' ? ' · also online' : '') + '</div>' +
        '<div class="laim-actions">' +
          (addr ? '<a class="laim-btn primary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr) + '">Get directions</a>' : '') +
          '<button type="button" class="laim-btn" data-open-any="' + esc(m.id) + '">Details</button>' +
        '</div></div>';
      var more = pool.slice(1, 3);
      if (more.length) {
        h += '<div class="laim-next-more"><div class="laim-next-label">After that</div><ul>' + more.map(function (x) {
          return '<li><button type="button" data-open-any="' + esc(x.id) + '"><strong>' + esc(whenText(x)) + '</strong> — ' + esc(x.name) + ' <span>' + esc(fmtDist(x._dist)) + '</span></button></li>';
        }).join('') + '</ul></div>';
      }
      box.hidden = false; box.innerHTML = h;
    }
    function openAny(id) {
      var m = all.filter(function (x) { return String(x.id) === String(id); })[0];
      if (!m) return;
      if (state.day !== 'any' && state.day !== m.day) state.day = m.day;
      if (!matches(m)) { state.tod = ''; $('[data-f="tod"]').value = ''; state.q = ''; $('[data-f="q"]').value = ''; }
      openInList(id);
    }
    function clearNear() {
      state.near = null; all.forEach(function (m) { delete m._dist; }); nearMsg(''); render();
    }

    // events
    var timer;
    root.addEventListener('input', function (e) {
      var f = e.target.dataset && e.target.dataset.f; if (f !== 'q') return;
      clearTimeout(timer); timer = setTimeout(function () { state.q = e.target.value.trim(); render(); }, 120);
    });
    root.addEventListener('change', function (e) {
      var f = e.target.dataset && e.target.dataset.f; if (!f || f === 'q') return;
      state[f] = e.target.value; render();
    });
    root.addEventListener('click', function (e) {
      var pill = e.target.closest('.laim-day');
      if (pill) { state.day = pill.dataset.day === 'any' ? 'any' : +pill.dataset.day; render(); return; }
      if (e.target.closest('.laim-locate')) { if (state.near) clearNear(); else locate(); return; }
      if (e.target.closest('[data-clear-near]')) { clearNear(); return; }
      var vb = e.target.closest('.laim-view');
      if (vb) { state.view = vb.dataset.view; render(); return; }
      var oa = e.target.closest('[data-open-any]');
      if (oa) { openAny(oa.getAttribute('data-open-any')); return; }
      var op = e.target.closest('[data-open]');
      if (op) { openInList(op.getAttribute('data-open')); return; }
      if (e.target.closest('[data-goto-list]')) { state.view = 'list'; render(); return; }
      if (e.target.closest('.laim-reset')) {
        state.q = state.region = state.district = state.type = state.att = state.tod = '';
        root.querySelectorAll('.laim-filters [data-f], [data-f="q"]').forEach(function (el) { el.value = ''; }); render(); return;
      }
      var head = e.target.closest('.laim-head');
      if (head) {
        var li = head.closest('.laim-card'), pane = li.querySelector('.laim-detail'), open = head.getAttribute('aria-expanded') === 'true';
        if (!open && !pane.innerHTML) {
          var m = all.filter(function (x) { return String(x.id) === li.dataset.id; })[0]; pane.innerHTML = detail(m);
        }
        head.setAttribute('aria-expanded', String(!open)); pane.hidden = open;
        if (open) delete openIds[li.dataset.id]; else openIds[li.dataset.id] = 1;
      }
    });
    function fillDistricts() {
      var sel = $('[data-f="district"]');
      if (!sel) return;
      var seen = {};
      all.forEach(function (m) { if (m._d) seen[m._d] = 1; });
      var list = Object.keys(seen).sort(function (a, b) { return dsortKey(a) - dsortKey(b) || (a < b ? -1 : 1); });
      if (!list.length) {
        // no districts in 12 Step Meeting List: offer the towns instead
        if (!showRegion && regionList.length) {
          sel.outerHTML = '<select data-f="region" aria-label="Town">' + opts(regionList, state.region, null, 'All towns') + '</select>';
        } else { sel.remove(); }
        return;
      }
      state.district = seen[wantDistrict] ? wantDistrict : '';
      sel.innerHTML = '<option value="">All districts</option>' + list.map(function (d) {
        return '<option value="' + esc(d) + '"' + (d === state.district ? ' selected' : '') + '>' + esc(dlabel(d)) + '</option>';
      }).join('');
      sel.disabled = false;
    }

    assignDistricts(); fillDistricts(); render();
    if (openId) openInList(openId);
  }

  function boot() { document.querySelectorAll('[data-laim]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
