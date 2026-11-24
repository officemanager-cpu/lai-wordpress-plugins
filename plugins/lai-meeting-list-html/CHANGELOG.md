# Changelog: LAI Meeting List (Text Version)

## [1.0.1] - 2026-11-21

### Changed
- Added a visible "Weekly meeting schedule" heading above the list, and renamed the collapsed toggle to "Show every meeting as a list, by day".
- Cache key changed to `lai_mlh_html_v2` so the new markup shows at once.

## [1.0.0] - 2026-11-21

### Added
- First release. The `[lai_meetings_list]` shortcode prints every TSML meeting as plain HTML, grouped by day and sorted by time, inside a collapsed section. Cached for six hours and cleared whenever a TSML post changes.
