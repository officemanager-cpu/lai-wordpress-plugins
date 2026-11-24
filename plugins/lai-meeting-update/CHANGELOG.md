# Changelog: LAI Meeting Update Form

All notable changes to this plugin. Versions follow [semantic versioning](https://semver.org/).

> **Note:** This history was reconstructed from the 1.4.0 code when the plugin was first put in git (2026-11-24). Version 1.4.0 is exact. The contents of 1.0.0–1.3.0 are a best reading of the code, and their dates aren't known. Please correct any entry that's wrong.

## [1.4.1] – 2026-11-24

### Security / privacy
- The officer-initials (`lai_mu_roster`) and officer-details (`lai_mu_officers`) items can no longer be published. Like submissions, any attempt to publish or schedule one is forced back to Private. Before this, their privacy depended on the scheduled task saving them as Private.
- Second lock on the REST API: the meta of submissions, officer initials, and officer details is removed from REST responses for anyone without `edit_posts`, whatever the item's status. (A meta field's `auth_callback` only controls who can change it, not who can read it.)

### Changed
- The Group Change Form's "no officer details loaded yet" message now says the details are copied every hour, 8 AM to 10 PM, instead of "each evening", to match the scheduled task's new schedule.

## [1.4.0]

### Added
- **Group Information Change Form** office tool, shortcode `[lai_group_change_form]`. It fills in the paper form for any row of the office's U/D groups sheet and prints it on a letter-size page (`assets/gcf.js`, `assets/gcf.css`).
  - `?row=N` preselects a sheet row. Picking a meeting updates the URL to `?row=N`.
  - Options to fill IGR and GSR from what's on file, and to copy the current officer phone and email to the "new" side.
- Private custom post type `lai_mu_officers` (REST base `lai-mu-officers`) holding the officer details the tool uses. It is refreshed nightly.
- The tool works only for editors, or on a password-protected page after the password is entered. Pages using it are `noindex, nofollow` and sent with no-cache headers.

## [1.3.0]

### Added
- Private custom post type `lai_mu_roster` (REST base `lai-mu-roster`) with officer **first name + last initial** per meeting, refreshed nightly.
- The Officers step shows who is on file for Secretary and Treasurer ("On file: Pat S." or "No one on file").
- Server-side `lai_mu_short_name()` is applied to roster names, so only "First L." ever reaches the public page.

### Changed
- Form layouts use responsive auto-fit grids, so fields wrap cleanly on phones.

## [1.2.0]

### Added
- **"Other"** type/format option with a text box. Formats on file that don't match a checkbox are prefilled into "Other".
- **Group anniversary** (start date) field, for both updates and new meetings, shown in the office email and the dashboard.
- Akismet check on submissions, when Akismet is active. Spam is saved with status `spam` and no email is sent.

## [1.1.0]

### Added
- For updates, the form is **prefilled with the current listing values**, and edited fields show a **"Changed"** tag.
- **Only the fields that changed are sent.** The office email lists which details are changing.
- When meeting names are duplicated, search results and matching tell meetings apart by **day and time**.

### Changed
- The meeting list cache moved to transient `lai_mu_meetings_v2`, adding 24-hour start and end times (`start24`, `end24`) for prefilling and matching.

## [1.0.0]

### Added
- First release. Multi-step public form, shortcode `[lai_meeting_update]`, for groups to update a meeting or add a new one, including Secretary, Treasurer, IGR, and GSR.
- Type-ahead meeting search over the 12 Step Meeting List (read-only), cached in a transient and cleared when TSML data changes.
- Private custom post type `lai_mtg_update` ("Meeting Updates") with `lai_mu_data` (JSON) and `lai_mu_status` (new/done/spam) meta. These posts can never be published. The dashboard has list columns, a readable "What was sent" view, and a Status box.
- Email notice to the office, with officers shown as first name + last initial and a link to the dashboard for the full details.
- **Meeting Updates › Settings** page for the notice address (`lai_mu_office_email`, falling back to the admin email).
- Spam protection: honeypot field (`website`), HMAC-signed token from `GET /lai-mu/v1/token` (the form must be open 4 seconds to 2 days), and a rate limit of 6 submissions per hour per IP.
