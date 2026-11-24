# Changelog: LAI Meeting Finder

## [1.0.0] - 2026-11-21

### Added
- First LAI release, adapted from Area 53 Meeting Finder 0.5.1. Adds the `[lai_meetings]` shortcode, with search and filters, "Next meeting near me", and a map using OpenFreeMap and bundled MapLibre GL JS 5.24.1.
- Optional takeover of TSML's /meetings page and each meeting's page from Settings → LAI Meeting Finder, with an admin-only preview.

### Changed from Area 53 Meeting Finder 0.5.1
- Renamed to the `lai_meetings` shortcode and the `laim_` prefix.
- Filters by town instead of Area 53 districts.
- LAI colours, no dark mode, and the map centred on Lancaster, Ohio.
- The /meetings takeover works with block themes (`template_include`).
