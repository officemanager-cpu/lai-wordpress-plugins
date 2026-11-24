# LAI Subscribe Button Close

**Version 1.0.0** · Requires Jetpack (floating Subscribe button) · GPL-2.0-or-later

Adds a small round **"×"** to Jetpack's floating Subscribe button so visitors can close it. Once a visitor closes it, the button stays hidden for that visitor for **30 days**. Nothing else on the site changes.

## How it works

- **In `<head>`** (priority 1): a tiny script checks `localStorage.laiSubClosed`. If the button was closed less than 30 days ago, it adds the class `lai-sub-hidden` to `<html>` before the page paints, so the button never flashes. The styles for the "×" are also printed here, in LAI's navy, cream, and brown colors, with a visible keyboard focus ring.
- **In the footer** (priority 99): finds `.jetpack-subscribe-floating-button`, adds a `<button aria-label="Close the subscribe button">×</button>`, and when it's clicked, hides the button and saves the time in `localStorage`.

## Privacy

There are no cookies, no server calls, and no personal data. The "closed" time is kept only in the visitor's own browser (`localStorage`). Clearing site data brings the button back.

## Installing

Zip the `lai-subscribe-close` folder, keeping the folder at the top of the zip. Upload and activate it like any plugin, or use the WordPress.com connector steps in the [top-level README](../../README.md#deploying-to-the-live-site). There are no settings.
