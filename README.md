# LAI WordPress Plugins

Custom WordPress plugins for the Lancaster Area Intergroup (LAI) website, [lancasterareaintergroup.org](https://lancasterareaintergroup.org). LAI is an A.A. service office in Lancaster, Ohio. The office manager and the website committee look after these plugins as part of their service work.

| Plugin | Folder | Version | What it does |
| --- | --- | --- | --- |
| LAI Meeting Update Form | [`plugins/lai-meeting-update`](plugins/lai-meeting-update) | 1.4.3 | Public form where groups add a meeting or update their listing and officers, plus an office-only tool for printing the Group Information Change Form |
| LAI Subscribe Button Close | [`plugins/lai-subscribe-close`](plugins/lai-subscribe-close) | 1.0.0 | Adds a close "×" to Jetpack's floating Subscribe button and remembers it for 30 days |
| LAI Meeting List (Text Version) | [`plugins/lai-meeting-list-html`](plugins/lai-meeting-list-html) | 1.0.1 | `[lai_meetings_list]` prints the whole weekly schedule as plain text below the meeting finder, for search engines and screen readers |
| LAI FAQ Schema | [`plugins/lai-faq-schema`](plugins/lai-faq-schema) | 1.0.0 | Adds FAQ structured data to the "FAQs about LAI and AA" page, built from its H3 questions |

Each plugin folder has its own README and CHANGELOG.

## Repository layout

```
plugins/
  lai-meeting-update/     one WordPress plugin per folder; the folder name is the plugin slug
  lai-subscribe-close/
  lai-meeting-list-html/
  lai-faq-schema/
```

## Building an install zip

WordPress expects the zip to contain the plugin folder at its top level. From the `plugins/` folder:

```sh
cd plugins
zip -r ../lai-meeting-update.zip lai-meeting-update -x '*/README.md' '*/CHANGELOG.md'
zip -r ../lai-subscribe-close.zip lai-subscribe-close -x '*/README.md' '*/CHANGELOG.md'
zip -r ../lai-meeting-list-html.zip lai-meeting-list-html -x '*/README.md' '*/CHANGELOG.md'
zip -r ../lai-faq-schema.zip lai-faq-schema -x '*/README.md' '*/CHANGELOG.md'
```

(Leaving out the README and CHANGELOG is optional. WordPress ignores them either way.)

## Deploying to the live site

The site is on WordPress.com (site ID 237344970). Releases are installed with the WordPress.com connector:

1. Bump the version in **both** the plugin header (`Version:`) and the version constant (for example `LAI_MU_VERSION`). The version constant is also what busts the browser cache for the CSS and JS. Then add a CHANGELOG entry.
2. Build the zip as shown above and take its SHA-256 (`sha256sum lai-meeting-update.zip`).
3. Run `plugin-upload-request` to get an upload URL, upload the zip with `curl`, and then run `plugin-upload` with `overwrite: true` and the SHA-256.
4. Activate the plugin.
5. Purge the edge cache and check the live pages (`/update-your-meeting/` and `/group-change-form/` for the meeting plugin).

Tag each release in git as `<plugin>-v<version>`, for example `lai-meeting-update-v1.4.0`.

## Anonymity and privacy (please read before contributing)

These plugins handle contact details for group officers. In keeping with A.A.'s Traditions on anonymity:

- Use **first names and last initials only** everywhere: code, comments, test data, documentation, issues, and commit messages.
- Never commit real officer names, phone numbers, emails, or addresses, including in sample data or screenshots.
- Never hardcode passwords, API keys, or tokens. Site settings (such as the office notice email) live in WordPress options.
- Any change to what the public can see, or to how officer details are stored, should be reviewed by the office manager and, where it affects groups, brought to the Steering Committee.

The office's own public contact details (phone, mailing address, office email) do appear in the plugins, because they are printed on the Group Information Change Form and shown to the public anyway.

## License

GPL-2.0-or-later, the same as WordPress.
