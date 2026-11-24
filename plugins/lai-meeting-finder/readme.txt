=== LAI Meeting Finder ===
Version: 1.0.0
Requires: 12 Step Meeting List plugin (active)
Adapted from: Area 53 Meeting Finder 0.5.1 (Area 53 web team), GPL-2.0-or-later

A friendly meeting finder in the LAI site's colours. Meetings are still managed in
12 Step Meeting List; this plugin only displays them and never changes them.

== Use ==
Settings > LAI Meeting Finder:
- "Show this finder at /meetings" puts it in place of the 12 Step Meeting List page.
  Untick (or deactivate this plugin) to put the old page straight back.
- "Each meeting's own page": /meetings/meeting-name/ opens the finder on that meeting.
- Page heading, and Options (same as the shortcode).
- "Try it first": /meetings/?laipreview=1 shows the new finder to logged-in admins only.

Or put this shortcode on any page: [lai_meetings]
  day="today|any|0-6"   day selected when the page opens (default today)
  region="Lancaster"    start on one town
  view="list|map"       which view opens first (default list)
  map="yes|no"          show the Map button (default yes)
  map_style="positron|liberty|bright|fiord"  map look (default positron)

Old links made for 12 Step Meeting List (?weekday=, ?type=, ?region=, ?search=, ?view=map,
?meeting=, tsml-day, tsml-query, tsml-region) still work. Meetings, locations, imports, the
Meeting Guide feed and every other page stay as they are.

== Features ==
- Search, day buttons, time of day, in person/online, town and meeting type filters
- "Next meeting near me": uses the visitor's location (asked by the browser, never sent to
  the site) to show distances, sort nearest or soonest, and show the next meeting with directions
- Map view: OpenFreeMap tiles (free, no API key, no billing) with MapLibre GL JS 5.24.1
  bundled in assets/vendor/maplibre (BSD-3 licence). The map library only downloads when
  someone opens the Map view.
- Directions open Google Maps as a plain link (no Google API key or charges)
- Contact names, emails and phones from 12 Step Meeting List are never sent to the page

== Look ==
Colours come from the Portia theme palette (theme-1 to theme-5), so changing the site's
colours in Styles changes the finder too.

== Changes from Area 53 Meeting Finder 0.5.1 ==
- Renamed (lai_meetings shortcode, laim_ prefix) so it can never clash with the Area 53 plugin
- Area 53 Group Map district engine removed; filters by town (12 Step Meeting List region)
- LAI colours, no dark mode (the LAI theme has none), map centred on Lancaster, Ohio
- /meetings takeover uses template_include so it works with block themes
