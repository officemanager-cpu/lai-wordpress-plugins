# LAI FAQ Schema

**Version 1.0.0** · GPL-2.0-or-later

Adds FAQ structured data (schema.org `FAQPage`, as JSON-LD) to the **FAQs about LAI and AA** page (`/faqs-about-lai-and-aa/`), so search engines and AI answer tools can read each question and its answer.

Nothing changes on screen. There is no settings page and no shortcode.

## How it works

- On the page with the slug `faqs-about-lai-and-aa` only, the plugin reads the page content and builds the question list from it:
  - each **H3 heading** is a question;
  - the paragraphs under it, up to the next H3, H2 or H1, are the answer;
  - a bulleted or numbered list in an answer is joined into one sentence, with items separated by semicolons.
- An H1 or H2 ends the current question, so section headings are never treated as questions.
- The result is printed in the page `<head>` as `<script type="application/ld+json" class="lai-faq-schema">`.
- It is cached in a transient keyed to the page's ID and last-modified time, so editing the FAQ page refreshes it automatically. Otherwise it is rebuilt once a day.

## Editing the FAQ

Edit the page as usual in the block editor. To add a question, add an **H3 heading** with the question and put the answer underneath it as normal text. No other step is needed.

## Checking it

View the page source and search for `lai-faq-schema`, or run the page through Google's Rich Results Test. As of November 2026 the page has 15 questions.

## Privacy

The plugin only reads public page content. It stores nothing except the cached question list.
