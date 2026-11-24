/* LAI Group Information Change Form (office use): fill the paper form for one meeting, then print. */
(function () {
	'use strict';
	var cfgEl = document.getElementById('lai-gcf-config');
	var root = document.getElementById('lai-gcf');
	if (!cfgEl || !root) return;
	var cfg;
	try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }
	var dir = cfg.meetings || [], rows = cfg.officers || [];
	var $ = function (id) { return document.getElementById(id); };
	var q = $('lai-gcf-q'), list = $('lai-gcf-list'), status = $('lai-gcf-status'), paper = $('lai-gcf-paper'), printBtn = $('lai-gcf-print');
	var DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
	var current = null, shown = [], active = -1;

	function decode(s) { var t = document.createElement('textarea'); t.innerHTML = String(s || ''); return t.value.trim(); }
	function normName(s) { return decode(s).toLowerCase().replace(/&/g, 'and').replace(/['’`.]/g, '').replace(/\b(the|group|grp|aa|meeting)\b/g, '').replace(/[^a-z0-9]/g, ''); }
	function dayOf(s) { var m = String(s || '').toLowerCase().match(/sun|mon|tue|wed|thu|fri|sat/); return m ? DAYS.filter(function (d) { return d.indexOf(m[0]) === 0; })[0] : ''; }
	function timeKey(s) {
		var m = String(s || '').toLowerCase().replace(/noon/, '12pm').match(/(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?/);
		if (!m) return '';
		var h = +m[1], mi = m[2] || '00', ap = m[3];
		if (!ap) { if (h > 12) { h -= 12; ap = 'pm'; } else ap = (h >= 9 && h <= 11) ? 'am' : 'pm'; }
		return h + mi + ap;
	}
	function prettyTime(k) { var m = String(k).match(/^(\d{1,2})(\d{2})(am|pm)$/); return m ? m[1] + ':' + m[2] + ' ' + m[3].toUpperCase() : ''; }
	function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
	function parseAddress(a) {
		var parts = decode(a).split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x && !/^usa?$/i.test(x); });
		var r = { street: '', city: '', state: '', zip: '' }, i = -1;
		parts.forEach(function (p, j) { if (/^(oh|ohio)\b/i.test(p)) i = j; });
		if (i > 0) {
			var m = parts[i].match(/^(\S+)\s*(\d{5}(-\d{4})?)?/);
			r.state = /^ohio$/i.test(m[1]) ? 'OH' : m[1].toUpperCase(); r.zip = m[2] || ''; r.city = parts[i - 1]; r.street = parts.slice(0, i - 1).join(', ');
		} else r.street = parts.join(', ');
		return r;
	}
	function splitPerson(s) {
		var o = { name: '', phone: '', email: '' };
		decode(s).split(/\s+[–-]\s+|\s*\|\s*|,\s*/).forEach(function (p) {
			if (!p) return;
			if (/@/.test(p)) o.email = p; else if (/\d{3}\D?\d{3}\D?\d{4}/.test(p)) o.phone = p; else o.name = o.name ? o.name + ' ' + p : p;
		});
		return o;
	}
	rows.forEach(function (r) { r.day = dayOf(r.day_time); r.tkey = timeKey(String(r.day_time).replace(/^\S+\s*/, '')); });

	function findDir(r) {
		var nm = normName(r.name);
		var hits = dir.filter(function (m) {
			var mn = normName(m.name);
			return mn && (mn === nm || mn.indexOf(nm) > -1 || nm.indexOf(mn) > -1) && dayOf(m.day) === r.day;
		});
		if (hits.length > 1 && r.tkey) { var t = hits.filter(function (m) { return timeKey(m.time) === r.tkey; }); if (t.length) hits = t; }
		return hits.length === 1 ? hits[0] : null;
	}

	function set(id, v) { $('g-' + id).value = decode(v); }
	function fill(r) {
		current = r;
		var d = findDir(r) || {}, ad = parseAddress(d.address || '');
		var t = d.time ? prettyTime(timeKey(d.time)) : prettyTime(r.tkey);
		paper.querySelectorAll('input').forEach(function (i) { i.value = ''; });
		var now = new Date();
		set('date', (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear());
		set('grpId', r.grp_id);
		set('area', '53');
		set('district', String(d.district || '').replace(/^district\s*/i, ''));
		set('name', r.name + (r.day ? ' (' + cap(r.day) + (t ? ' ' + t : '') + ')' : ''));
		set('format', d.format || '');
		set('location', d.place || '');
		set('address', ad.street);
		set('city', ad.city || r.city);
		set('state', ad.state || 'OH');
		set('zip', ad.zip);
		var same = /^same$/i.test(r.tre);
		set('oldSec', r.sec); set('oldTre', same ? r.sec : r.tre);
		if ($('lai-gcf-reps').checked) {
			var i = splitPerson(r.igr), g = splitPerson(r.gsr);
			set('igrName', i.name); set('igrPhone', i.phone); set('igrEmail', i.email);
			set('gsrName', g.name); set('gsrPhone', g.phone); set('gsrEmail', g.email);
		}
		if ($('lai-gcf-new').checked) {
			set('sName', r.sec); set('sPhone', r.sec_phone); set('sEmail', r.sec_email);
			set('tName', same ? r.sec : r.tre); set('tPhone', same ? r.sec_phone : r.tre_phone); set('tEmail', same ? r.sec_email : r.tre_email);
		}
		paper.hidden = false; printBtn.disabled = false;
		q.value = r.name + ' — ' + r.day_time;
		status.textContent = r.name + ', ' + r.day_time + '.' + (d.name ? '' : ' Its address and format weren’t found in the meeting list, so those lines are blank.') + ' You can type over anything before printing.';
	}

	function paint() {
		var v = normName(q.value), raw = q.value.toLowerCase().trim();
		shown = (v ? rows.filter(function (r) { return normName(r.name).indexOf(v) > -1 || r.name.toLowerCase().indexOf(raw) > -1; }) : rows).slice(0, 40);
		list.textContent = '';
		shown.forEach(function (r, i) {
			var li = document.createElement('li');
			li.setAttribute('role', 'option'); li.setAttribute('aria-selected', i === active ? 'true' : 'false');
			var a = document.createElement('strong'); a.textContent = r.name;
			var b = document.createElement('span'); b.textContent = r.day_time + (r.city ? ' · ' + r.city : '');
			li.appendChild(a); li.appendChild(b);
			li.addEventListener('mousedown', function (e) { e.preventDefault(); pick(r); });
			list.appendChild(li);
		});
		list.hidden = !shown.length; q.setAttribute('aria-expanded', shown.length ? 'true' : 'false');
	}
	function pick(r) {
		list.hidden = true; active = -1;
		try { history.replaceState(null, '', location.pathname + '?row=' + r.row); } catch (e) {}
		fill(r);
	}
	q.addEventListener('focus', function () { q.select(); active = -1; paint(); });
	q.addEventListener('input', function () { active = -1; paint(); });
	q.addEventListener('blur', function () { setTimeout(function () { list.hidden = true; }, 150); });
	q.addEventListener('keydown', function (e) {
		if (e.key === 'ArrowDown') { active = Math.min(active + 1, shown.length - 1); paint(); e.preventDefault(); }
		else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); paint(); e.preventDefault(); }
		else if (e.key === 'Enter') { if (shown.length) pick(shown[active < 0 ? 0 : active]); e.preventDefault(); }
		else if (e.key === 'Escape') { list.hidden = true; }
	});
	$('lai-gcf-reps').addEventListener('change', function () { if (current) fill(current); });
	$('lai-gcf-new').addEventListener('change', function () { if (current) fill(current); });
	printBtn.addEventListener('click', function () { window.print(); });

	if (!rows.length) {
		status.textContent = 'No officer details have been loaded yet. They are copied from the U/D groups sheet every hour, 8 AM to 10 PM.';
		q.disabled = true;
		return;
	}
	var m = location.search.match(/[?&]row=(\d+)/);
	if (m) {
		var r = rows.filter(function (x) { return x.row === +m[1]; })[0];
		if (r) fill(r); else status.textContent = 'Row ' + m[1] + ' isn’t a meeting on U/D groups. Pick a meeting above.';
	} else {
		status.textContent = rows.length + ' meetings. Start typing a name above.';
	}
})();
