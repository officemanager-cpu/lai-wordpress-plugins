# LAI Meeting List (Text Version)

**Version 1.0.1** · Requires the [12 Step Meeting List](https://wordpress.org/plugins/12-step-meeting-list/) (TSML) plugin · GPL-2.0-or-later

Prints the full weekly meeting schedule as plain HTML text, so search engines, AI answer tools and screen readers can read every meeting. On the LAI site it sits below the interactive meeting finder on **/meeting-finder/**.

The plugin **only reads** the meeting list. It never changes a TSML listing.

## Shortcode: `[lai_meetings_list]`

Shows:

- a heading, **"Weekly meeting schedule"**;
- a collapsed section, **"Show every meeting as a list, by day"**, which opens to show Sunday through Saturday;
- one line per meeting, sorted by time: the start time, the meeting name (linked to its TSML page), the location and town, and whether it is Open, Closed or Online. For example:
  *9:00 am – A Daily Reprieve, LAI, Lancaster (Open)*

If TSML isn't active, or there are no meetings, the shortcode prints nothing.

## Caching

The finished HTML is cached in the transient `lai_mlh_html_v2` for six hours. The cache is cleared whenever a TSML post (meeting, location or group) is saved, trashed or deleted, so changes show up right away.

## Privacy

Only public meeting information is shown: the same details TSML already publishes. No contact details are read or printed.
