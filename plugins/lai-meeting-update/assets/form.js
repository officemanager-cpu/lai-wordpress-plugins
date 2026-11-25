/* LAI Meeting Update form. Builds the steps in the page; sends to /wp-json/lai-mu/v1/submit. */
(function () {
	'use strict';
	var root = document.getElementById('lai-mu');
	var cfgEl = document.getElementById('lai-mu-config');
	if (!root || !cfgEl) return;
	var cfg = {};
	try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }
	var meetings = cfg.meetings || [];
	var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	var FORMATS = ['Open', 'Closed', 'Big Book', '12 & 12', 'Lead / Speaker', 'Discussion', 'Literature', 'Step Study', 'Grapevine', 'Meditation', 'Women', 'Men', 'Rotating format'];
	var ROLES = [
		{ k: 'sec', title: 'Secretary', address: true },
		{ k: 'tre', title: 'Treasurer', address: true },
		{ k: 'igr', title: 'Intergroup Rep (IGR)', address: false },
		{ k: 'gsr', title: 'General Service Rep (GSR)', address: false }
	];
	var token = null;

	function blankPerson() { return { change: false, name: '', phone: '', email: '', street: '', city: '', state: 'OH', zip: '' }; }
	function fresh() {
		return {
			step: 1, mode: 'update', q: '', meeting: null, open: {}, sending: false, error: '',
			changes: { day: '', start: '', end: '', place: '', street: '', city: '', zip: '', formats: [], format_other: '', district: '' },
			group: { group_id: '', phone: '', members: '', anniversary: '' },
			new_meeting: { name: '', day: '', start: '', end: '', place: '', street: '', city: '', state: 'OH', zip: '', formats: [], format_other: '', group_id: '', district: '', phone: '', members: '', anniversary: '' },
			officers: { sec: blankPerson(), tre: blankPerson(), igr: blankPerson(), gsr: blankPerson() },
			notes: '', sender: { name: '', role: 'Secretary', contact: '' }, website: ''
		};
	}
	var S = fresh();

	/* ---------- tiny DOM helpers (all text goes in as text, never HTML) ---------- */
	function h(tag, attrs) {
		var el = document.createElement(tag);
		attrs = attrs || {};
		Object.keys(attrs).forEach(function (k) {
			var v = attrs[k];
			if (v === null || v === undefined || v === false) return;
			if (k === 'text') el.textContent = v;
			else if (k === 'class') el.className = v;
			else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
			else if (k === 'value') el.value = v;
			else if (k === 'checked') el.checked = !!v;
			else el.setAttribute(k, v === true ? '' : v);
		});
		function add(c) {
			if (c === null || c === undefined || c === false) return;
			if (Array.isArray(c)) c.forEach(add);
			else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
		}
		for (var i = 2; i < arguments.length; i++) add(arguments[i]);
		return el;
	}
	function get(path) { return path.split('.').reduce(function (o, k) { return o ? o[k] : undefined; }, S); }
	function set(path, v) {
		var ks = path.split('.'), o = S;
		for (var i = 0; i < ks.length - 1; i++) o = o[ks[i]];
		o[ks[ks.length - 1]] = v;
	}
	var uid = 0;
	function field(label, path, opts) {
		opts = opts || {};
		var id = 'lai-mu-f' + (++uid);
		var input, wrap;
		/* opts.orig: the value listed now. When the field differs from it, mark it "Changed". */
		function mark() {
			if (opts.orig === undefined || !wrap) return;
			var changed = String(get(path) || '').trim() !== String(opts.orig || '').trim();
			wrap.classList.toggle('is-changed', changed);
			tag.hidden = !changed;
		}
		function onIn(e) { set(path, e.target.value); mark(); }
		if (opts.options) {
			input = h('select', { id: id, onchange: onIn },
				opts.options.map(function (o) { return h('option', { value: o.value, text: o.label }); }));
			input.value = get(path) || '';
		} else if (opts.textarea) {
			input = h('textarea', { id: id, rows: '4', oninput: onIn });
			input.value = get(path) || '';
		} else {
			input = h('input', {
				id: id, type: opts.type || 'text', inputmode: opts.inputmode, placeholder: opts.ph, autocomplete: opts.ac || 'off',
				required: opts.required, 'aria-required': opts.required ? 'true' : null,
				value: get(path) || '', oninput: onIn, onchange: onIn
			});
		}
		var tag = h('span', { class: 'lai-mu-changed', text: 'Changed', hidden: true });
		wrap = h('div', { class: 'lai-mu-field' + (opts.wide ? ' is-wide' : '') + (opts.small ? ' is-small' : '') },
			h('label', { for: id }, label, opts.required ? h('span', { class: 'lai-mu-req', 'aria-hidden': 'true', text: ' *' }) : null, tag),
			opts.hint ? h('span', { class: 'lai-mu-hint', text: opts.hint }) : null,
			input);
		mark();
		return wrap;
	}
	var dayOptions = [{ value: '', label: 'Choose a day' }].concat(DAYS.map(function (d) { return { value: d, label: d }; }));

	/* Checkboxes for type/format, plus "Other" with a box to type in. obj holds formats[] and format_other. */
	function formatPicker(obj, path, legend) {
		var otherOn = obj.format_other !== '' || obj._other === true;
		var otherBox = field('Other type or format', path + '.format_other', { ph: 'Type it here' });
		otherBox.hidden = !otherOn;
		return h('fieldset', { class: 'lai-mu-formats is-wide' },
			h('legend', { text: legend }),
			h('div', {},
				FORMATS.map(function (f) {
					return h('label', { class: 'lai-mu-check' },
						h('input', { type: 'checkbox', checked: obj.formats.indexOf(f) > -1, onchange: function (e) {
							var i = obj.formats.indexOf(f);
							if (e.target.checked && i < 0) obj.formats.push(f);
							if (!e.target.checked && i > -1) obj.formats.splice(i, 1);
						} }), ' ' + f);
				}),
				h('label', { class: 'lai-mu-check' },
					h('input', { type: 'checkbox', checked: otherOn, 'aria-controls': otherBox.querySelector('input').id, onchange: function (e) {
						obj._other = e.target.checked;
						otherBox.hidden = !e.target.checked;
						if (e.target.checked) otherBox.querySelector('input').focus();
						else obj.format_other = '';
					} }), ' Other')),
			otherBox);
	}
	function formatsOut(obj) {
		var list = obj.formats.slice();
		if (obj.format_other.trim()) list.push(obj.format_other.trim());
		return list;
	}
	/* Tick the boxes that match what's listed now; anything else goes in "Other". */
	function prefillFormats(obj, current) {
		if (obj.formats.length || obj.format_other) return;
		var other = [];
		String(current || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (c) {
			var hit = FORMATS.filter(function (f) { return norm(f) === norm(c) || (norm(c) === 'speaker' && f === 'Lead / Speaker'); })[0];
			if (hit) { if (obj.formats.indexOf(hit) < 0) obj.formats.push(hit); } else other.push(c);
		});
		obj.format_other = other.join(', ');
	}
	function anniversaryField(path) {
		return field('Group anniversary (the date the group started)', path, { hint: 'If you know it. A month and year is fine.', ph: 'e.g. 3/1/2002 or March 2002' });
	}
	function norm(s) { return String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, ''); }

	/* ---------- steps ---------- */
	function stepper() {
		var labels = ['Find your meeting', S.mode === 'new' ? 'Meeting details' : 'Check the details', 'Officers', 'Notes and send'];
		return h('ol', { class: 'lai-mu-steps', 'aria-label': 'Steps' }, labels.map(function (l, i) {
			var n = i + 1, cls = S.step === n ? 'is-current' : (S.step > n ? 'is-done' : '');
			return h('li', { class: cls, 'aria-current': S.step === n ? 'step' : null, text: (S.step > n ? '✓ ' : n + '. ') + l });
		}));
	}

	function stepFind() {
		var list = h('ul', { class: 'lai-mu-results', role: 'listbox', 'aria-label': 'Matching meetings', hidden: true });
		var msg = h('p', { class: 'lai-mu-hint', 'aria-live': 'polite' });
		var active = -1, shown = [];
		function pick(m) {
			S.meeting = m; S.mode = 'update'; S.step = 2; S.open = {};
			S.changes = listedValues(m);
			S.orig = JSON.parse(JSON.stringify(S.changes));
			render(true);
		}
		function paint() {
			var q = norm(S.q);
			shown = q.length < 2 ? [] : meetings.filter(function (m) { return norm(m.name).indexOf(q) > -1; }).slice(0, 10);
			list.textContent = '';
			shown.forEach(function (m, i) {
				list.appendChild(h('li', { role: 'option', 'aria-selected': i === active ? 'true' : 'false', id: 'lai-mu-opt' + i },
					h('button', { type: 'button', class: 'lai-mu-pick', onclick: function () { pick(m); } },
						h('strong', { text: m.name }),
						h('span', { text: m.day + (m.time ? ' ' + m.time : '') + ' · ' + [m.place, m.town].filter(Boolean).join(', ') }))));
			});
			list.hidden = !shown.length;
			var names = {}, dup = false;
			shown.forEach(function (m) { names[m.name] = (names[m.name] || 0) + 1; if (names[m.name] > 1) dup = true; });
			msg.textContent = q.length >= 2 && !shown.length ? 'No meeting by that name. Check the spelling, or add it as a new meeting below.'
				: dup ? 'More than one meeting has this name. Pick the one with your day and place.' : '';
			input.setAttribute('aria-expanded', shown.length ? 'true' : 'false');
		}
		var input = h('input', {
			id: 'lai-mu-q', type: 'search', class: 'lai-mu-search', autocomplete: 'off', placeholder: 'e.g. Miracles Happen',
			role: 'combobox', 'aria-controls': 'lai-mu-results', 'aria-expanded': 'false', 'aria-autocomplete': 'list', value: S.q,
			oninput: function (e) { S.q = e.target.value; active = -1; paint(); },
			onkeydown: function (e) {
				if (e.key === 'ArrowDown' && shown.length) { active = Math.min(active + 1, shown.length - 1); paint(); e.preventDefault(); }
				else if (e.key === 'ArrowUp' && shown.length) { active = Math.max(active - 1, 0); paint(); e.preventDefault(); }
				else if (e.key === 'Enter' && shown.length) { pick(shown[active < 0 ? 0 : active]); e.preventDefault(); }
			}
		});
		list.id = 'lai-mu-results';
		setTimeout(paint, 0);
		return [
			h('h2', { text: 'Which meeting is this about?' }),
			h('label', { for: 'lai-mu-q', class: 'lai-mu-lead', text: 'Start typing the meeting\'s name, then pick it from the list.' }),
			input, list, msg,
			h('div', { class: 'lai-mu-alt' },
				h('button', { type: 'button', class: 'lai-mu-btn-outline', text: 'My meeting isn\'t listed – add a new meeting',
					onclick: function () { S.mode = 'new'; S.meeting = null; S.step = 2; render(true); } }))
		];
	}

	/* The meeting's public details, split into the form's boxes. */
	function listedValues(m) {
		var parts = String(m.address || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
		var street = '', city = '', zip = '';
		var si = -1;
		parts.forEach(function (p, i) { if (/^(oh|ohio)\b/i.test(p)) si = i; });
		if (si > 0) {
			var z = parts[si].match(/(\d{5}(-\d{4})?)/);
			zip = z ? z[1] : '';
			city = parts[si - 1];
			street = parts.slice(0, si - 1).join(', ');
		} else {
			street = parts.join(', ');
		}
		var v = { day: m.day && DAYS.indexOf(m.day) > -1 ? m.day : '', start: m.start24 || '', end: m.end24 || '', place: m.place || '',
			street: street, city: city || m.town || '', zip: zip, formats: [], format_other: '',
			district: String(m.district || '').replace(/^district\s*/i, '') };
		prefillFormats(v, m.format);
		return v;
	}

	function stepDetailsUpdate() {
		var m = S.meeting, o = S.orig || {};
		return [
			h('p', { class: 'lai-mu-kicker', text: 'UPDATING' }),
			h('h2', { text: m.name }),
			h('p', { class: 'lai-mu-lead', text: 'Here’s what the meeting list shows now. Change anything that’s different and leave the rest as it is.' }),
			h('div', { class: 'lai-mu-grid' },
				h('div', { class: 'lai-mu-trio is-wide' },
					field('Day', 'changes.day', { options: dayOptions, orig: o.day }),
					field('Starts', 'changes.start', { type: 'time', orig: o.start }),
					field('Ends', 'changes.end', { type: 'time', orig: o.end })),
				field('Where it meets (building name)', 'changes.place', { wide: true, orig: o.place }),
				field('Street address', 'changes.street', { wide: true, orig: o.street }),
				field('City or town', 'changes.city', { orig: o.city }),
				h('div', { class: 'lai-mu-pair' },
					field('ZIP', 'changes.zip', { inputmode: 'numeric', orig: o.zip }),
					field('District #', 'changes.district', { orig: o.district, ph: o.district ? '' : 'If you know it' })),
				formatPicker(S.changes, 'changes', 'Type / format (tick everything that fits)')),
			h('p', { class: 'lai-mu-lead lai-mu-extra-lead', text: 'These aren’t shown on the website. Fill them in if you know them or they’ve changed.' }),
			h('div', { class: 'lai-mu-grid lai-mu-extra' },
				h('div', { class: 'is-wide' }, anniversaryField('group.anniversary')),
				field('Group ID # (from GSO, if you know it)', 'group.group_id', { inputmode: 'numeric' }),
				field('Group phone (if the group has one)', 'group.phone', { type: 'tel' }),
				field('Number of members (about)', 'group.members', { inputmode: 'numeric' }))
		];
	}

	function stepDetailsNew() {
		var n = S.new_meeting;
		return [
			h('p', { class: 'lai-mu-kicker', text: 'NEW MEETING' }),
			h('h2', { text: 'Tell us about the meeting' }),
			h('div', { class: 'lai-mu-grid' },
				field('Group name', 'new_meeting.name', { wide: true, required: true, ph: 'e.g. Miracles Happen' }),
				h('div', { class: 'lai-mu-trio is-wide' },
					field('Day', 'new_meeting.day', { options: dayOptions, required: true }),
					field('Starts', 'new_meeting.start', { type: 'time' }),
					field('Ends', 'new_meeting.end', { type: 'time' })),
				field('Where it meets (building name)', 'new_meeting.place', { wide: true, ph: 'e.g. St. Peter\'s Lutheran Church' }),
				field('Street address', 'new_meeting.street', { wide: true }),
				field('City or town', 'new_meeting.city'),
				h('div', { class: 'lai-mu-pair' }, field('State', 'new_meeting.state'), field('ZIP', 'new_meeting.zip', { inputmode: 'numeric' })),
				formatPicker(n, 'new_meeting', 'Type / format (pick all that fit)'),
				h('div', { class: 'is-wide' }, anniversaryField('new_meeting.anniversary')),
				field('Group ID # (if you have one)', 'new_meeting.group_id', { inputmode: 'numeric' }),
				field('District # (if you know it)', 'new_meeting.district'),
				field('Group phone (if the group has one)', 'new_meeting.phone', { type: 'tel' }),
				field('Number of members (about)', 'new_meeting.members', { inputmode: 'numeric' })),
			h('p', { class: 'lai-mu-fine', text: 'A.A.’s Traditions suggest that a group not be named after a facility or person (living or deceased), and that its name not imply affiliation with any sect, religion, organization or institution.' })
		];
	}

	function stepOfficers() {
		var isNew = S.mode === 'new';
		return [
			h('h2', { text: 'Group officers' }),
			h('p', { class: 'lai-mu-lead', text: isNew ? 'Fill in the positions your group has. Leave the rest blank.' : 'Here’s who we have on file. If someone new has the position, or their phone or email changed, choose “New person or new contact info”. Leave the others on “No change”.' }),
			h('p', { class: 'lai-mu-note', text: 'Office use only. This is how LAI reaches your group. It is never published on the website or in the Meeting Guide app.' }),
			ROLES.map(function (r) {
				var p = S.officers[r.k];
				var open = isNew || p.change;
				var base = 'officers.' + r.k + '.';
				var onFile = (!isNew && S.meeting && (r.k === 'sec' || r.k === 'tre')) ? (S.meeting[r.k] || '') : null;
				return h('div', { class: 'lai-mu-role' },
					h('div', { class: 'lai-mu-role-head' },
						h('div', {},
							h('h3', { text: r.title }),
							onFile === null ? null : h('p', { class: 'lai-mu-onfile', text: onFile ? 'On file: ' + onFile : 'No one on file' })),
						isNew ? null : h('div', { class: 'lai-mu-toggle', role: 'group', 'aria-label': r.title },
							h('button', { type: 'button', 'aria-pressed': open ? 'false' : 'true', text: 'No change', onclick: function () { p.change = false; render(); } }),
							h('button', { type: 'button', 'aria-pressed': open ? 'true' : 'false', text: 'New person or new contact info', onclick: function () { p.change = true; render(); } }))),
					open ? h('div', { class: 'lai-mu-grid' },
						field('Name', base + 'name', { wide: true }),
						field('Phone', base + 'phone', { type: 'tel', ph: '(740) 555-1234' }),
						field('Email', base + 'email', { type: 'email' }),
						r.address ? field('Mailing address', base + 'street', { wide: true }) : null,
						r.address ? field('City or town', base + 'city') : null,
						r.address ? h('div', { class: 'lai-mu-pair' }, field('State', base + 'state'), field('ZIP', base + 'zip', { inputmode: 'numeric' })) : null
					) : null);
			})
		];
	}

	function stepNotes() {
		return [
			h('h2', { text: 'Anything else?' }),
			field('Notes for the office (a correction, or anything else we should know)', 'notes', { textarea: true, wide: true }),
			h('h3', { text: 'Who’s sending this?' }),
			h('p', { class: 'lai-mu-lead', text: 'So the office can reach you if we have a question. First name and last initial is fine.' }),
			h('div', { class: 'lai-mu-grid' },
				field('Your name', 'sender.name', { required: true, ph: 'e.g. Pat S.' }),
				field('Your role in the group', 'sender.role', { options: ['Secretary', 'Treasurer', 'Intergroup Rep (IGR)', 'General Service Rep (GSR)', 'Other group member'].map(function (x) { return { value: x, label: x }; }) }),
				field('Phone or email', 'sender.contact', { wide: true, required: true })),
			h('div', { class: 'lai-mu-hp', 'aria-hidden': 'true' },
				h('label', { for: 'lai-mu-website', text: 'Leave this empty' }),
				h('input', { id: 'lai-mu-website', type: 'text', tabindex: '-1', autocomplete: 'off', oninput: function (e) { S.website = e.target.value; } })),
			h('p', { class: 'lai-mu-fine', text: 'A group listing does not constitute or imply an approval or endorsement of any group’s practice of the A.A. program. Tradition Four says, “Each group should be autonomous except in matters affecting other groups or A.A. as a whole.”' })
		];
	}

	function stepDone() {
		return h('div', { class: 'lai-mu-done' },
			h('h2', { text: 'Thank you for your service' }),
			h('p', { text: 'We’ve received your update' + (S.meeting ? ' for ' + S.meeting.name : '') + '. The office reviews every change before the meeting list is updated, usually within a few days. Questions? Call ' + (cfg.phone || 'the office') + '.' }),
			h('button', { type: 'button', class: 'lai-mu-btn-outline', text: 'Send another update', onclick: function () { S = fresh(); render(true); } }));
	}

	/* ---------- moving between steps ---------- */
	function check() {
		if (S.step === 2 && S.mode === 'new' && (!S.new_meeting.name.trim() || !S.new_meeting.day)) return 'Please give the meeting’s name and day.';
		if (S.step === 4 && (!S.sender.name.trim() || !S.sender.contact.trim())) return 'Please add your name and a phone number or email.';
		return '';
	}
	function payload() {
		var c = S.changes, n = S.new_meeting, o = S.orig || {};
		/* Send only what differs from what's listed now; blank means "no change". */
		function diff(k) { var v = String(c[k] || '').trim(); return v !== String(o[k] || '').trim() ? v : ''; }
		var fmtNow = formatsOut(c), fmtWas = o.formats ? formatsOut(o) : [];
		var fmtChanged = fmtNow.slice().sort().join('|').toLowerCase() !== fmtWas.slice().sort().join('|').toLowerCase();
		return {
			mode: S.mode, meeting_id: S.meeting ? S.meeting.id : 0,
			changes: { day: diff('day'), start: diff('start'), end: diff('end'), place: diff('place'), street: diff('street'), city: diff('city'), zip: diff('zip'), district: diff('district'),
				format: fmtChanged ? fmtNow.join(', ') : '' },
			group: S.group,
			new_meeting: { name: n.name, day: n.day, start: n.start, end: n.end, place: n.place, street: n.street, city: n.city, state: n.state, zip: n.zip,
				formats: formatsOut(n), group_id: n.group_id, district: n.district, phone: n.phone, members: n.members, anniversary: n.anniversary },
			officers: S.officers,
			notes: S.notes, sender: S.sender, website: S.website,
			t: token ? token.t : 0, s: token ? token.s : ''
		};
	}
	function send() {
		S.sending = true; S.error = ''; render();
		var headers = { 'Content-Type': 'application/json' };
		if (cfg.nonce) { headers['X-WP-Nonce'] = cfg.nonce; }
		fetch(cfg.rest + 'submit', { method: 'POST', headers: headers, body: JSON.stringify(payload()), credentials: 'same-origin' })
			.then(function (r) {
				// The website answered. If it wasn't the form's usual reply (e.g. an error page), say so plainly.
				return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; },
					function () { return { ok: false, status: r.status, j: null }; });
			})
			.then(function (res) {
				S.sending = false;
				if (res.ok && res.j && res.j.ok) { S.step = 5; render(true); return; }
				var phone = cfg.phone || 'the office';
				if (res.j && res.j.code === 'rest_cookie_invalid_nonce') { S.error = 'This page has been open a long time. Please reload the page and try again.'; }
				else if (res.j && res.j.message) { S.error = res.j.message; }
				else if (res.status === 429) { S.error = 'Too many updates have been sent from this connection in the last hour. Please wait an hour and try again, or call ' + phone + '.'; }
				else { S.error = 'Something went wrong on the website (error ' + res.status + '). Please try again in a few minutes, or call ' + phone + '.'; }
				render();
			})
			.catch(function () { S.sending = false; S.error = 'We couldn’t reach the website. Check your connection and try again.'; render(); });
	}
	function next() {
		var err = check();
		if (err) { S.error = err; render(); return; }
		S.error = '';
		if (S.step === 4) { send(); return; }
		S.step += 1; render(true);
	}
	function back() { S.error = ''; S.step -= 1; render(true); }

	function render(scrollTop) {
		var body;
		if (S.step === 1) body = stepFind();
		else if (S.step === 2) body = S.mode === 'new' ? stepDetailsNew() : stepDetailsUpdate();
		else if (S.step === 3) body = stepOfficers();
		else if (S.step === 4) body = stepNotes();
		else body = stepDone();
		var nav = (S.step >= 2 && S.step <= 4) ? h('div', { class: 'lai-mu-nav' },
			h('button', { type: 'button', class: 'lai-mu-back', text: '‹ Back', onclick: back }),
			h('button', { type: 'button', class: 'lai-mu-next', disabled: S.sending, text: S.sending ? 'Sending…' : (S.step === 4 ? 'SEND TO THE OFFICE' : 'CONTINUE'), onclick: next })) : null;
		var card = h('form', { class: 'lai-mu-card', novalidate: true, onsubmit: function (e) { e.preventDefault(); } },
			body,
			S.error ? h('p', { class: 'lai-mu-error', role: 'alert', text: S.error }) : null,
			nav);
		root.textContent = '';
		root.appendChild(S.step <= 4 ? stepper() : h('div'));
		root.appendChild(card);
		if (scrollTop) {
			var top = root.getBoundingClientRect().top + window.pageYOffset - 90;
			if (window.pageYOffset > top) window.scrollTo(0, top);
			var head = card.querySelector('h2');
			if (head) { head.setAttribute('tabindex', '-1'); head.focus({ preventScroll: true }); }
		}
	}

	fetch(cfg.rest + 'token', { credentials: 'same-origin', cache: 'no-store' })
		.then(function (r) { return r.json(); }).then(function (j) { token = j; }).catch(function () {});
	render();
})();
