# LAI Meeting Finder

**Version 1.0.0** · Requires the [12 Step Meeting List](https://wordpress.org/plugins/12-step-meeting-list/) (TSML) plugin · GPL-2.0-or-later

A friendly meeting finder for the LAI site, with a free map and "Next meeting near me". It is adapted from the Area 53 web team's **Area 53 Meeting Finder 0.5.1**. On the LAI site it runs on **/meeting-finder/**, with the plain-text list from [LAI Meeting List (Text Version)](../lai-meeting-list-html) below it.

The plugin **only reads** the meeting list. Meetings are still added and edited in 12 Step Meeting List.

## Shortcode: `[lai_meetings]`

| Attribute | Values | Default | What it does |
| --- | --- | --- | --- |
| `day` | `today`, `any`, `0`–`6` | `today` | Day selected when the page opens (0 = Sunday) |
| `region` | a town, such as `Lancaster` | none | Start filtered to one town |
| `view` | `list`, `map` | `list` | Which view opens first |
| `map` | `yes`, `no` | `yes` | Show the Map button |
| `map_style` | `positron`, `liberty`, `bright`, `dark`, `fiord` | `positron` | Map look |

`district`, `filter`, `map_style_dark` and `open` are also accepted (carried over from the Area 53 version).

## The /meetings page (optional)

**Settings → LAI Meeting Finder** can show this finder at TSML's own `/meetings` page, and on each meeting's page (`/meetings/meeting-name/` opens the finder on that meeting). Unticking it, or deactivating the plugin, puts TSML's page straight back. Admins can preview it first at `/meetings/?laipreview=1`.

Old TSML links (`?weekday=`, `?type=`, `?region=`, `?search=`, `?view=map`, `?meeting=`) still work.

## Features

- Search, day buttons, time-of-day, in-person/online, town and meeting-type filters.
- **Next meeting near me**: uses the visitor's location (the browser asks first, and the location is never sent to the site) to show distances, sort by nearest or soonest, and give directions.
- **Map view**: [OpenFreeMap](https://openfreemap.org) tiles (free, with no API key or billing) drawn with MapLibre GL JS 5.24.1. The map library is bundled in `assets/vendor/maplibre/` (BSD-3-Clause, see its LICENSE.txt) and downloads only when someone opens the map.
- Directions open Google Maps as a plain link, with no Google API key.
- Colours come from the Portia theme palette (`theme-1` to `theme-5`), so changing the site's colours in Styles changes the finder too.

## Caching

The meeting data sent to the page is cached in the transient `laim_meetings_v1`, keyed to the modification time and size of TSML's own cache file. Any TSML change rebuilds it. Saving or deleting a TSML meeting, location or group also clears it.

## Privacy

Only public listing fields are sent to the browser (see `$keep` in `laim_get_payload()`). **Contact names, emails and phone numbers stored in TSML are never included.** Online-meeting links and phone numbers are only sent for meetings marked Online or In person + online.

## Files

```
lai-meeting-finder.php        plugin, shortcode, settings page, /meetings takeover
templates/meetings-page.php   template for the /meetings takeover
assets/lai-meetings.js        the finder (vanilla JS)
assets/css/lai-meetings.css   styles
assets/vendor/maplibre/       MapLibre GL JS 5.24.1 (third-party, BSD-3-Clause)
readme.txt                    the original short readme
```

## Changes from Area 53 Meeting Finder 0.5.1

- Renamed (`lai_meetings` shortcode, `laim_` prefix) so it can never clash with the Area 53 plugin.
- The Area 53 Group Map district engine was removed. It filters by town (TSML region) instead.
- LAI colours, no dark mode, and the map is centred on Lancaster, Ohio.
- The /meetings takeover uses `template_include` so it works with block themes.
