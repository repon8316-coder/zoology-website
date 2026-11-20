# Design plan — public website (Task 54)

Plain HTML/CSS/JS, no framework, no build step. Everything below is implemented in `site.css` (tokens + components), `site.js`
(shell) and `pages.js` (pages). The contrast ratios at the end are produced by `node docs/contrast-report.js` and checked again by `node test.js`.

## 1. What makes this identity specific

The site is the Department of Zoology's, in Rangpur, so it borrows from the department's own working objects instead of a generic
"college template": a **field notebook and the specimen label** that goes with every museum jar and pinned insect.

* **Specimen label.** The "today's classes" card, the museum cards and the head-corner card are drawn as labels: a thin ruled border,
  a punched hole (a small circle) in the corner, a catalogue number in tabular figures, and the scientific name in *italic*
  (*Rana tigrina*) — the way a real museum tag reads. Notices are not cards at all but **ruled notebook rows** (date, title, hairline).
* **Measuring scale.** Under the header runs a thin millimetre ruler (hard-edged ticks every 8 px, a long tick every 40 px) — the one
  decorative element, taken from the scale a zoologist puts beside a specimen. It is made of two repeating hairline stripes, not a colour wash.
* **Colours from the logo.** The department logo is a deep blue-teal shield with a bronze butterfly. *Pond-ink* `#0F3D3E` is the shield,
  *moss* `#2F7D4F` is the pond-bank green used for actions, and *wing-amber* `#C9871C` is the butterfly — and, like a bronze wing, it is
  rare: it appears only on **the period that is running now**, **today's column/tab** and **active filters**. Night mode keeps the same
  family (deep pond water, pale moss, warm amber) instead of a generic black.
* **A Bangladeshi working week.** The routine puts **Sunday first** and follows the server's `working_days` (Sunday–Thursday today), shows
  Friday/Saturday as "আজ ক্লাস নেই", and writes every number, date and time in Bangla digits with Bangla month and weekday names
  (`২২ নভেম্বর ২০২৬, রবিবার`).
* **Bangla first.** Headings are set in *Noto Serif Bengali* (the printed-notebook voice), the body in *Hind Siliguri* with a 1.75 line
  height (Bangla matras need air) and a 70-character measure. No all-caps eyebrow labels (Bangla has no capitals anyway), no
  terracotta/cream serif look, no black-and-acid-green, no identical shadowed cards: notices are ruled rows, quick links are an index,
  museum and "today" are labels, people are plain bordered boxes with square photos.

## 2. Tokens

CSS custom properties on `:root` (Day); `:root[data-theme="dark"]` overrides them (Night); the same overrides sit in
`@media (prefers-color-scheme: dark) { :root:not([data-theme]) … }` so the page is already dark before JavaScript runs.

| Token | Day | Night | Used for |
|---|---|---|---|
| `--bg` | `#EEF4F1` mist | `#0A1614` | page |
| `--surface` | `#FFFFFF` paper | `#11221F` | cards, inputs |
| `--surface-2` | `#DDEBE4` | `#172B27` | chips, table heads, empty photo |
| `--text` | `#14231F` ink | `#E4EFEA` | body text |
| `--muted` | `#465A53` | `#9DB5AB` | secondary text |
| `--heading` | `#0F3D3E` pond-ink | `#E4EFEA` | headings, section rules |
| `--primary` / `-hover` / `--on-primary` | `#2F7D4F` / `#256A40` / `#FFFFFF` | `#6FCF9F` / `#8FDDB5` / `#06210F` | buttons, selected tab, current page number |
| `--link` | `#256A40` | `#6FCF9F` | links |
| `--accent` / `--on-accent` / `--accent-soft` | `#C9871C` / `#14231F` / `#FBF0DA` | `#F2B94B` / `#14231F` / `#2A2312` | now-period, today, active filter |
| `--line` | `#CBD9D2` | `#26403A` | hairlines (decorative) |
| `--edge` | `#6B817A` | `#5E7C72` | borders of inputs and buttons (≥ 3:1) |
| `--col-today` | `#E6F0EB` | `#162A26` | today's column in the weekly grid |
| `--err` / `--err-bg` | `#A32018` / `#FBEAE8` | `#FFB4AB` / `#3A1613` | errors, "বাতিল" |
| `--head-bg` / `--head-fg` / `--head-muted` | `#0F3D3E` / `#EEF4F1` / `#B9D2C9` | `#11221F` / `#E4EFEA` / `#9DB5AB` | header, hero |
| `--hbtn-bg` / `--hbtn-fg` | `#FFFFFF` / `#0F3D3E` | `#E4EFEA` / `#0A1614` | light button in the hero |
| `--focus` | `#0B57D0` | `#8AB4FF` | focus ring (inside the header/hero: `--head-fg`) |

**Type scale** (ratio 1.2, body 17–18 px): `--fs-0` = `clamp(1.0625rem, 1.03rem + .15vw, 1.125rem)`, then ×1.2 steps:
`--fs--1` ≈ 14.2 px (meta, table text), `--fs-1` ≈ 20.4 px (card titles), `--fs-2` ≈ 24.5 px (section titles), `--fs-3` ≈ 29.4 px (page title),
`--fs-4` ≈ 35.3 px / `--fs-5` ≈ 42.4 px (hero, from 720 px). Line height 1.75 for text, 1.3–1.5 for headings.
**Spacing** (8 px scale, 4 px for hairline gaps): `--sp-0 .25rem`, `--sp-1 .5rem`, `--sp-2 1rem`, `--sp-3 1.5rem`, `--sp-4 2rem`, `--sp-5 3rem`, `--sp-6 4rem`.
**Layout:** one column below 720 px; 12-column grid above (hero: 7 + 5 columns); max width 1180 px, 16 px gutters. Radius 4 px everywhere; no box shadows.

## 3. Layout per page

```
HEADER    [logo] প্রাণিবিদ্যা বিভাগ / রংপুর সরকারি কলেজ, রংপুর        [theme ◐/☀/☾] [☰ on phones]
nav band  হোম পরিচিতি বিভাগীয় প্রধান শিক্ষক নোটিশ ক্লাস রুটিন মিউজিয়াম লাইব্রেরি গ্যালারি ডাউনলোড যোগাযোগ   (wraps on desktop, menu on phone)
ruler     |’’’’|’’’’|’’’’|’’’’|        (millimetre scale)

HOME  (≥720px)                                         HOME (phone)
┌───────────────────────────┬───────────────────┐      hero text
│ logo                      │ ○ আজকের ক্লাস      │      buttons
│ প্রাণিবিদ্যা বিভাগ (serif) │ ২২ নভেম্বর…, রবিবার │      today card (select + list)
│ রংপুর সরকারি কলেজ, রংপুর   │ [ব্যাচ ▾]          │      notices (date + title rows)
│ [নোটিশ] [তথ্য ফর্ম]        │ ০৯:০০–০৯:৫০ ZOO-101 বাতিল│      head corner
│                           │ ০৯:৫০–১০:৪০ এখন চলছে │      quick-link index (1 col)
│                           │ পুরো সাপ্তাহিক রুটিন →│      teachers strip (scrolls sideways)
└───────────────────────────┴───────────────────┘      3 museum labels
সর্বশেষ নোটিশ  ── date │ title ── (6 ruled rows)       gallery mosaic
বিভাগীয় প্রধানের বাণী  [photo] name, designation, ~280 chars, [পুরো বাণী পড়ুন]
দ্রুত লিংক  (index of 6: রুটিন, মিউজিয়াম, সেমিনার লাইব্রেরি, ডাউনলোড, গ্যালারি, তথ্য ফর্ম)
আমাদের শিক্ষকগণ  (horizontal strip)  ·  মিউজিয়ামের নমুনা (3 labels)  ·  গ্যালারি (6-photo mosaic)
Any section without data is hidden without a gap.

ROUTINE (≥720px): batch select · title · [প্রিন্ট করুন]        ROUTINE (phone)
        │ পিরিয়ড │ রবিবার(আজ)│ সোমবার │ … 5 working days       [রবি·আজ][সোম][মঙ্গল][বুধ][বৃহ]  (day tabs)
        │ ১ ০৯:০০ │ ZOO-101…  │ …                              list of that day's periods
        │ ২ ০৯:৫০ │ [এখন চলছে]│                                 ↓
        আগামী ৭ দিনে পরিবর্তন (list)                            আগামী ৭ দিনে পরিবর্তন

MUSEUM: intro · search + category chips · grid of labels (4:3 photo, catalogue no, bn title, italic scientific name, category)
MUSEUM ITEM: back link · photo (4:3, contain) beside title, scientific name, dl of fields, description
LIBRARY: info block · note "এটি বইয়ের তালিকা…" · search + category select · count · table (≥720px) / stacked cards (phone) · pager (20 per page)
HEAD: portrait + name + designation + e-mail  |  the message (safe Markdown) + "সর্বশেষ হালনাগাদ"
```

## 4. Self-review against the brief — what changed before and while building

The first sketch was reviewed line by line against the brief and revised:

1. **Too generic: a card for everything.** The old site (and a literal first sketch of the brief's section list) had notices, quick links, people and museum items as the same bordered cards.
   Now: notices = ruled rows; quick links = an index list with hairlines; museum and "today" = specimen labels; people = plain boxes with square photos; no shadows at all.
2. **No colour washes.** The old hero was a green gradient. The hero is now flat pond-ink; the only repeating-stripe element is the millimetre ruler, built from hard-edged 1 px ticks (it is a scale, not a wash).
3. **Amber as text.** Amber `#C9871C` on white is 3.0 : 1 — fails for text. Amber is therefore only a *fill with ink text* (5.4 : 1) or a marker next to a text label ("এখন চলছে", "আজ"). The pinned-notice badge is not amber (amber stays rare).
4. **Colour alone.** "Now", "today", "cancelled" and "substitute" are never colour-only: each also has a word (এখন চলছে, আজ, বাতিল + strike-through, বদলি: নাম).
5. **The contrast script found a failure** (amber chip vs the page background, 2.7 : 1). The active chip/album now has a 2 px outline in the text colour as well as the amber fill.
6. **Eleven menu items would not fit one row.** The header is two-tier: brand + tools on top, the nav band below (wraps on desktop, one menu button on phones).
7. **Night mode:** not simply inverted; the hero/header use the surface colour `#11221F` (not pure black), and primary becomes the pale moss `#6FCF9F` with dark button text.
8. **Without JavaScript** the page follows the system theme (the `:not([data-theme])` block); with JavaScript the inline head script sets the theme *before* first paint (no flash).
9. **A bug found while testing:** the notice list read `?page=2` through `bnDigits` (which turns 2 into ২ and then stripped it), so page links always showed page 1. Fixed with a new `asciiDigits` helper; the library uses the same.

## 5. Motion, theme and other decisions

* **Motion:** one calm reveal of the hero text and the today card (700 ms fade + 10 px rise) on first load. Nothing else animates (no hover transitions, no page transitions). Inside `@media (prefers-reduced-motion: no-preference)`; with "reduce" there is no motion at all (the loading spinner is a still ring then).
* **Theme:** `auto → day → night` button in the header, state kept in `localStorage["site-theme"]`, applied by an identical inline script in the `<head>` of every public page (not `form.html`). It also updates `<meta name="theme-color">` and reacts to system changes while on auto. aria: the label always says the current mode and the next one; `aria-pressed` is false for auto and true for a fixed choice; a visually hidden live region announces the change. If storage is blocked it still works for the visit.
* **Fonts:** Google Fonts `<link>` with `preconnect` and `display=swap`; fallbacks `Noto Sans Bengali, Nirmala UI, Vrinda, system-ui` / `Noto Serif, Kalpurush, Georgia`, so nothing breaks offline. Privacy trade-off: see README.
* **Print:** the routine page prints only the weekly grid (A4 landscape, black on white, cancelled classes struck through, the "now" marker removed).
* **Remembered batch:** `localStorage["site-batch"]` (inside try/catch), shared by the home card and the routine page; `routine.html?batch=<uuid>` also works.


## 6. Contrast (WCAG 2.x AA) — checked by script

Generated with `node docs/contrast-report.js` from the real values in `site.css` (and re-checked on every `node test.js`: a colour change that
breaks a pair fails the tests). Text needs 4.5 : 1; borders of inputs/buttons, markers and the focus ring need 3 : 1. Decorative hairlines (`--line`) are not
used to identify a control and are exempt; every control has an `--edge` border or a fill.

**Day**

| Pair | Colours | Ratio | Needs | |
|---|---|---|---|---|
| Body text on page | `#14231F` on `#EEF4F1` | 14.61 : 1 | 4.5 : 1 | pass |
| Body text on cards | `#14231F` on `#FFFFFF` | 16.28 : 1 | 4.5 : 1 | pass |
| Body text on soft fill (chips, table head) | `#14231F` on `#DDEBE4` | 13.24 : 1 | 4.5 : 1 | pass |
| Body text on current-period fill | `#14231F` on `#FBF0DA` | 14.40 : 1 | 4.5 : 1 | pass |
| Body text in today's column | `#14231F` on `#E6F0EB` | 13.98 : 1 | 4.5 : 1 | pass |
| Muted text on page | `#465A53` on `#EEF4F1` | 6.62 : 1 | 4.5 : 1 | pass |
| Muted text on cards | `#465A53` on `#FFFFFF` | 7.37 : 1 | 4.5 : 1 | pass |
| Muted text on soft fill | `#465A53` on `#DDEBE4` | 6.00 : 1 | 4.5 : 1 | pass |
| Muted text on current-period fill | `#465A53` on `#FBF0DA` | 6.52 : 1 | 4.5 : 1 | pass |
| Muted text in today's column | `#465A53` on `#E6F0EB` | 6.33 : 1 | 4.5 : 1 | pass |
| Headings on page | `#0F3D3E` on `#EEF4F1` | 10.72 : 1 | 4.5 : 1 | pass |
| Headings on cards | `#0F3D3E` on `#FFFFFF` | 11.95 : 1 | 4.5 : 1 | pass |
| Headings on soft fill | `#0F3D3E` on `#DDEBE4` | 9.72 : 1 | 4.5 : 1 | pass |
| Links on page | `#256A40` on `#EEF4F1` | 5.86 : 1 | 4.5 : 1 | pass |
| Links on cards | `#256A40` on `#FFFFFF` | 6.53 : 1 | 4.5 : 1 | pass |
| Links on soft fill | `#256A40` on `#DDEBE4` | 5.31 : 1 | 4.5 : 1 | pass |
| Button text on primary | `#FFFFFF` on `#2F7D4F` | 5.04 : 1 | 4.5 : 1 | pass |
| Button text on primary (hover) | `#FFFFFF` on `#256A40` | 6.53 : 1 | 4.5 : 1 | pass |
| Amber badge "এখন চলছে" (ink on amber) | `#14231F` on `#C9871C` | 5.40 : 1 | 4.5 : 1 | pass |
| Active filter chip (ink on amber) | `#14231F` on `#C9871C` | 5.40 : 1 | 4.5 : 1 | pass |
| Error text on error fill | `#A32018` on `#FBEAE8` | 6.49 : 1 | 4.5 : 1 | pass |
| Error text on cards | `#A32018` on `#FFFFFF` | 7.56 : 1 | 4.5 : 1 | pass |
| Header text on header | `#EEF4F1` on `#0F3D3E` | 10.72 : 1 | 4.5 : 1 | pass |
| Header secondary text on header | `#B9D2C9` on `#0F3D3E` | 7.47 : 1 | 4.5 : 1 | pass |
| Hero button text (light button) | `#0F3D3E` on `#FFFFFF` | 11.95 : 1 | 4.5 : 1 | pass |
| Input / button border on cards (UI 3:1) | `#6B817A` on `#FFFFFF` | 4.16 : 1 | 3 : 1 | pass |
| Input / button border on page (UI 3:1) | `#6B817A` on `#EEF4F1` | 3.73 : 1 | 3 : 1 | pass |
| Amber marker on cards (UI 3:1) | `#C9871C` on `#FFFFFF` | 3.01 : 1 | 3 : 1 | pass |
| Active-chip outline (text colour) on page (UI 3:1) | `#14231F` on `#EEF4F1` | 14.61 : 1 | 3 : 1 | pass |
| Focus ring on page | `#0B57D0` on `#EEF4F1` | 5.73 : 1 | 3 : 1 | pass |
| Focus ring on cards | `#0B57D0` on `#FFFFFF` | 6.39 : 1 | 3 : 1 | pass |
| Focus ring in the header | `#EEF4F1` on `#0F3D3E` | 10.72 : 1 | 3 : 1 | pass |
| Primary action vs page (selected tab, current page link: UI 3:1) | `#2F7D4F` on `#EEF4F1` | 4.52 : 1 | 3 : 1 | pass |

**Night**

| Pair | Colours | Ratio | Needs | |
|---|---|---|---|---|
| Body text on page | `#E4EFEA` on `#0A1614` | 15.67 : 1 | 4.5 : 1 | pass |
| Body text on cards | `#E4EFEA` on `#11221F` | 14.02 : 1 | 4.5 : 1 | pass |
| Body text on soft fill (chips, table head) | `#E4EFEA` on `#172B27` | 12.64 : 1 | 4.5 : 1 | pass |
| Body text on current-period fill | `#E4EFEA` on `#2A2312` | 13.23 : 1 | 4.5 : 1 | pass |
| Body text in today's column | `#E4EFEA` on `#162A26` | 12.80 : 1 | 4.5 : 1 | pass |
| Muted text on page | `#9DB5AB` on `#0A1614` | 8.46 : 1 | 4.5 : 1 | pass |
| Muted text on cards | `#9DB5AB` on `#11221F` | 7.57 : 1 | 4.5 : 1 | pass |
| Muted text on soft fill | `#9DB5AB` on `#172B27` | 6.82 : 1 | 4.5 : 1 | pass |
| Muted text on current-period fill | `#9DB5AB` on `#2A2312` | 7.15 : 1 | 4.5 : 1 | pass |
| Muted text in today's column | `#9DB5AB` on `#162A26` | 6.91 : 1 | 4.5 : 1 | pass |
| Headings on page | `#E4EFEA` on `#0A1614` | 15.67 : 1 | 4.5 : 1 | pass |
| Headings on cards | `#E4EFEA` on `#11221F` | 14.02 : 1 | 4.5 : 1 | pass |
| Headings on soft fill | `#E4EFEA` on `#172B27` | 12.64 : 1 | 4.5 : 1 | pass |
| Links on page | `#6FCF9F` on `#0A1614` | 9.76 : 1 | 4.5 : 1 | pass |
| Links on cards | `#6FCF9F` on `#11221F` | 8.72 : 1 | 4.5 : 1 | pass |
| Links on soft fill | `#6FCF9F` on `#172B27` | 7.87 : 1 | 4.5 : 1 | pass |
| Button text on primary | `#06210F` on `#6FCF9F` | 9.01 : 1 | 4.5 : 1 | pass |
| Button text on primary (hover) | `#06210F` on `#8FDDB5` | 10.69 : 1 | 4.5 : 1 | pass |
| Amber badge "এখন চলছে" (ink on amber) | `#14231F` on `#F2B94B` | 9.16 : 1 | 4.5 : 1 | pass |
| Active filter chip (ink on amber) | `#14231F` on `#F2B94B` | 9.16 : 1 | 4.5 : 1 | pass |
| Error text on error fill | `#FFB4AB` on `#3A1613` | 9.48 : 1 | 4.5 : 1 | pass |
| Error text on cards | `#FFB4AB` on `#11221F` | 9.72 : 1 | 4.5 : 1 | pass |
| Header text on header | `#E4EFEA` on `#11221F` | 14.02 : 1 | 4.5 : 1 | pass |
| Header secondary text on header | `#9DB5AB` on `#11221F` | 7.57 : 1 | 4.5 : 1 | pass |
| Hero button text (light button) | `#0A1614` on `#E4EFEA` | 15.67 : 1 | 4.5 : 1 | pass |
| Input / button border on cards (UI 3:1) | `#5E7C72` on `#11221F` | 3.62 : 1 | 3 : 1 | pass |
| Input / button border on page (UI 3:1) | `#5E7C72` on `#0A1614` | 4.04 : 1 | 3 : 1 | pass |
| Amber marker on cards (UI 3:1) | `#F2B94B` on `#11221F` | 9.29 : 1 | 3 : 1 | pass |
| Active-chip outline (text colour) on page (UI 3:1) | `#E4EFEA` on `#0A1614` | 15.67 : 1 | 3 : 1 | pass |
| Focus ring on page | `#8AB4FF` on `#0A1614` | 8.84 : 1 | 3 : 1 | pass |
| Focus ring on cards | `#8AB4FF` on `#11221F` | 7.90 : 1 | 3 : 1 | pass |
| Focus ring in the header | `#E4EFEA` on `#11221F` | 14.02 : 1 | 3 : 1 | pass |
| Primary action vs page (selected tab, current page link: UI 3:1) | `#6FCF9F` on `#0A1614` | 9.76 : 1 | 3 : 1 | pass |

All 66 pairs pass. The block used before JavaScript runs (`prefers-color-scheme`) holds exactly the same Night colours as the chosen-Night block (also tested).

## 7. Quality floor — how each item is met

| Item | How |
|---|---|
| 360 / 768 / 1280 px | mobile-first CSS, one column below 720 px, 12 columns above; tables become stacked cards/tabs on phones; wide things scroll *inside* their box (teacher strip, routine tabs, library table), never the page |
| Keyboard focus visible | global `:focus-visible` 3 px ring (`--focus`; `--head-fg` inside the header/hero) |
| Skip link, landmarks | "মূল অংশে যান" kept on every page; `<header>`, `<nav aria-label>`, `<main id="main">`, `<footer>` |
| Headings in order | one `h1` per page, then `h2` sections, then `h3` (tested by the page smoke test: exactly one `h1` on every page) |
| Images | every content image has `alt` (decorative logos `alt=""`) and explicit `width`/`height`; museum/gallery images use `loading="lazy"` and a fixed `aspect-ratio` box with `object-fit` |
| Touch targets ≥ 44 px | buttons, selects, inputs, nav links, chips, pager, tabs, summary rows are `min-height: 44px` |
| Reduced motion | all animation lives in `prefers-reduced-motion: no-preference` |
| Print | routine grid only (see above) |
| One widget failing | home widgets (`Site.widget`) hide themselves on any error; the today card shows its own Bangla error + retry; pages catch render errors per section |
| Layout shift | explicit image sizes and aspect-ratio boxes; the today card and widget placeholders reserve space; font swap can still move text by a few pixels (see limitations) |
| Cache busting | the project had none, so none was added |

## 8. Known limitations

* No browser was available while building, so looks, real font rendering, Lighthouse scores and the print preview were **not** verified visually; behaviour is covered by the fake-DOM test (`test-dom.js`) and the contrast script.
* Fonts come from Google Fonts (the visitor's browser contacts Google); fallback metrics (`size-adjust`) were not tuned, so a small text shift can happen when the web font arrives.
* The "3 newest museum items" on the home page are the first three the server returns (the order the admin set with ↑ ↓); the contract has no date field to sort by.
* "এখন চলছে" comes from the server's `now_period`; the home card re-asks every 5 minutes while the tab is visible, the routine page only on load.
