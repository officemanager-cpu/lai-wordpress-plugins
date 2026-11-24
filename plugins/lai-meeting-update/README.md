# LAI Meeting Update Form

**Version 1.4.2** · Requires WordPress with the [12 Step Meeting List](https://wordpress.org/plugins/12-step-meeting-list/) (TSML) plugin · GPL-2.0-or-later

This plugin gives A.A. groups in the Lancaster Area Intergroup an easy online way to tell the office about a new meeting, or about changes to an existing meeting and its officers. It also gives the office a tool for printing a filled-in paper **Group Information Change Form** for any meeting.

The plugin **only reads** the meeting list. It never changes a TSML listing. Every submission is reviewed by the office, which makes the change by hand.

---

## What it does

### 1. The public form: `[lai_meeting_update]`

Live on **/update-your-meeting/**. It is a four-step form that runs in the browser:

1. **Find your meeting.** Type-ahead search over the live TSML list. If more than one meeting has the same name, the results show each one's day, time, and place, and the form says so. There is also a **"My meeting isn't listed – add a new meeting"** button.
2. **Check the details** (or, for a new meeting, **Meeting details**). For an update, every field is prefilled with what the meeting list shows now: day, start and end time, building, street, city, ZIP, district, and type/format. Any field that's edited gets a **"Changed"** tag. Type/format is a set of checkboxes plus an **"Other"** option with its own text box. Formats on file that don't match a checkbox are put into "Other". There are also fields that aren't published: **group anniversary** (the start date), Group ID #, group phone, and number of members.
3. **Officers.** Secretary, Treasurer, Intergroup Rep (IGR), and General Service Rep (GSR). For an update, each role shows who is on file, as **first name + last initial only** (for example "On file: Pat S."), and offers "No change" or "New person or new contact info".
4. **Notes and send.** Notes for the office, plus the sender's name, role, and a phone or email.

**Only the fields that changed are sent.** Unchanged meeting fields go to the server as blank, which means "no change".

### 2. Saving and notifying

Each submission:

- is saved as a **private** post in the custom post type `lai_mtg_update`, which shows in the dashboard as **Meeting Updates**. Its title is like *"Update: Miracles Happen (Tuesday 7:00 pm)"* or *"New meeting: …"*.
  - Meta `lai_mu_data` holds the full submission as JSON, including a snapshot of the meeting's public listing at the time it was sent.
  - Meta `lai_mu_status` is `new`, `done`, or `spam`. It is set from a **Status** box on the edit screen.
  - These posts can't be created by hand and can never be published. Any attempt to publish is forced back to private. (Since 1.4.1 the same applies to the officer-initials and officer-details items.)
- is **emailed to the office** at the address set under **Meeting Updates › Settings** (option `lai_mu_office_email`). If that is blank, the site's admin email is used. The email lists only *which* fields are changing and the officers' **first name + last initial**. Phone numbers, emails, and addresses are only in the dashboard, and the email links to the dashboard entry.

### 3. Spam protection

- **Honeypot:** a hidden `website` field. If it's filled, the server says "ok" and quietly discards the submission.
- **Signed timestamp:** the form fetches `GET /wp-json/lai-mu/v1/token`, which returns a time and an HMAC-SHA256 signature (keyed with `wp_salt('nonce')`). The submission must carry a valid signature, and the form must have been open **at least 4 seconds and no more than 2 days**.
- **Rate limit:** at most **6 submissions per hour per IP address**. This uses a transient keyed by a hash of the IP.
- **Akismet:** if Akismet is active and has a key, each submission is checked as a `contact-form`. Spam is saved with status `spam` and no email is sent.
- **Server-side cleaning:** only expected keys are kept. Every value is sanitized and length-limited.

### 4. Officer initials on file: `lai_mu_roster`

A private custom post type with one item. Its `lai_mu_roster` meta holds a JSON list of `{name, day, time, sec, tre}`, with **names as first name + last initial only**. A Claude scheduled task refreshes it from the office's sheet every hour, 8 AM–10 PM. The form matches each meeting by normalized name and day, and by time if needed. It shows Secretary and Treasurer as "On file: …". The server runs every name through `lai_mu_short_name()` again before sending, so even a full name in the data would only reach the public page as "First L.".

### 5. Office tool: `[lai_group_change_form]`

Live on the **password-protected** page **/group-change-form/**. It fills in A.A.'s *Group Information Change Form* for any meeting on the office's U/D groups sheet, ready to **Print / Save as PDF** on letter-size paper.

- The data comes from a private custom post type, `lai_mu_officers` (one item, refreshed hourly, 8 AM–10 PM). Its meta is a JSON list of `row, grp_id, day_time, name, city, igr, gsr, anniv, sec, sec_phone, sec_email, tre, tre_phone, tre_email`.
- Meeting address, format, and district come from TSML.
- Search by name, or open `?row=N` to preselect a sheet row. Picking a meeting updates the URL to `?row=N`.
- Options: "Fill IGR and GSR with what's on file" and "Copy current officer phone and email to the 'new' side, for the group to check". Every box can be typed over before printing.
- The shortcode **only renders for signed-in editors** (`edit_posts`), **or on a page that has a password set and whose password the visitor has entered**. On any other page it shows a note asking for a password to be set.
- Any page using this shortcode gets `noindex, nofollow` (in both the WordPress and the Rank Math robots tags) and no-cache headers.

---

## Installing

1. Make sure **12 Step Meeting List** is installed and active.
2. Zip the `lai-meeting-update` folder, keeping the folder at the top of the zip, and upload it under **Plugins › Add New › Upload Plugin**. Or install it with the WordPress.com connector, as described in the [top-level README](../../README.md#deploying-to-the-live-site).
3. Activate it.
4. Go to **Meeting Updates › Settings** and enter the office email that should receive notices.
5. Make a page with the `[lai_meeting_update]` shortcode. On the live site this is /update-your-meeting/.
6. For the office tool, make a page with `[lai_group_change_form]` and **set it to Password protected** (Page settings › Visibility).
7. Optional: (re)load the private `lai_mu_roster` and `lai_mu_officers` items. On the live site the scheduled task does this every hour, 8 AM–10 PM. Both items **must be saved with status Private** (see Privacy below).

## Shortcodes

| Shortcode | Where | Who can use it |
| --- | --- | --- |
| `[lai_meeting_update]` | /update-your-meeting/ | Anyone |
| `[lai_group_change_form]` | /group-change-form/ (password-protected) | Editors, or visitors who entered the page password |

## REST routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/wp-json/lai-mu/v1/token` | GET | Signed timestamp for the form (sent with `Cache-Control: no-store`) |
| `/wp-json/lai-mu/v1/submit` | POST | Receives a submission (JSON) |
| `/wp-json/wp/v2/lai-meeting-updates` | standard | Submissions (`lai_mtg_update`) |
| `/wp-json/wp/v2/lai-mu-roster` | standard | Officer initials item |
| `/wp-json/wp/v2/lai-mu-officers` | standard | Officer details item (office use) |

## How the privacy works

Officer contact details are **never public**. The design keeps them in three layers:

1. **What the public page carries.** The page for `[lai_meeting_update]` embeds the meeting list (TSML's public fields) and, for Secretary and Treasurer, **first name + last initial only**. No officer phone numbers, emails, or addresses are ever sent to the public form. Visitors only *send* contact details; they can't read them back.
2. **Where full details are stored.** Full details from submissions are stored only in private `lai_mtg_update` posts. Full details for the office tool are stored only in the private `lai_mu_officers` item. Both custom post types are non-public, not publicly queryable, excluded from search, and have no rewrite rules. Their meta can only be **written** by users with `edit_posts`.
3. **Where full details are shown.** Full details appear only in the dashboard and on the password-protected, noindex, no-cache Group Change Form page.

> **Two locks on the REST API (since 1.4.1).** In WordPress, a meta field's `auth_callback` only controls who can *change* it; who can *read* a post and its meta over `/wp-json/wp/v2/...` depends on the post's status. So the plugin (1) forces all three post types (`lai_mtg_update`, `lai_mu_roster`, `lai_mu_officers`) to stay Private, even if something tries to publish one, and (2) removes their meta from REST responses for anyone who can't edit posts. As of 2026-11-24 all three public endpoints return an empty list to anonymous visitors.

The office's own public contact details (phone 740-653-4869, the office mailing address, and the office email printed on the paper form) are hardcoded in the plugin. These are not personal details.

## Files

```
lai-meeting-update.php   plugin code: post types, settings, shortcodes, REST routes, email
assets/form.js           public form (steps, search, "Changed" tags, only-changes payload)
assets/form.css          public form styles; responsive auto-fit grids
assets/gcf.js            Group Change Form: search, ?row=N, fill, print
assets/gcf.css           Group Change Form styles, with print CSS for a letter-size page
```

## Caches

- The meeting list is cached for one hour in the transient `lai_mu_meetings_v2`. It is cleared whenever a TSML meeting, location, or group is saved.
- The site's edge cache should be purged after each release.
