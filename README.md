# Zoology Department – public website and student information page

Plain HTML/CSS/JS, **no build step**, no framework. It runs on GitHub Pages under any sub-path
(for example `https://<user>.github.io/zoology-website/`) and would run the same on a custom domain later:
**every link in the code is relative**, nothing contains the repository name or a domain.

The data comes from the department's Supabase database. The logged-out website may call only a few read-only functions
(`web_site_*`) and the two form functions (`student_web_*`); it cannot read any table. The admin writes the content in the
department app (admin panel = Task 51; until then content is entered through the admin functions in the SQL editor).

## Pages
| File | What |
|---|---|
| `index.html` | hero, latest notices, quick links, teacher preview |
| `about.html` | about / history / vision (pages `about`, `history`, `vision`) |
| `teachers.html` | teachers and staff (a curated public list, not the app's user table) |
| `notices.html`, `notice.html?id=…` | notice list (category filter, pagination) and one notice |
| `gallery.html` | albums and photos with a keyboard-friendly lightbox |
| `downloads.html` | files to download, grouped by category |
| `contact.html` | address, phone, e-mail, map link, social links, contact text (page `contact`) |
| `form.html` | the student information form (unchanged; `form.js`, `validate.js`, `style.css`) |

Shared code: `site.js` (header, footer, menu, the Supabase call, loading / empty / error states, maintenance page,
tiny Markdown renderer), `lib.js` (pure helpers, tested), `pages.js` (one function per page), `site.css`.
The header and footer are put in by `site.js` (`<header id="site-header">`, `<footer id="site-footer">`).

## Rules the code follows
- Data is shown with `textContent` / DOM APIs only. There is no `innerHTML`. Page text uses a tiny Markdown subset
  (`# heading`, `- list`, `1. list`, `**bold**`, `*italic*`, `[text](https://…)`, `---`); links are checked (`https`, `mailto`, `tel`
  or a file of this site; `javascript:` is turned into plain text).
- File links are built only from checked storage paths (`lib.js: fileUrl`).
- Every request has a timeout (15 s) and a Bangla error with a "try again" button; nothing spins forever.
- When the admin switches **maintenance mode** on, every page shows the maintenance page (the student form is not affected).
- Light and dark mode follow the device; touch targets are at least 44 px; layouts are built mobile-first (360 px up to wide screens).

## 1. Config (the only place with the URL and the key)
`config.js` holds the Supabase URL and the **publishable** key (`sb_publishable_…`). Never put the `service_role` or any secret key
in this folder.

## 2. Database
Run these migrations of the app repository once, in order, in the Supabase SQL Editor:
1. `20261201000100_student_web_submissions.sql` (student form)
2. `20261202000100_site_content.sql` (website content: notices, people, gallery, downloads, pages, settings, public bucket `site-public`)

## 3. Publish on GitHub Pages
Repository **Settings → Pages** → Source: *Deploy from a branch* → branch `main`, folder `/ (root)` → Save.
The site is at `https://<user>.github.io/<repo>/`; the student form stays at `…/form.html`.

## Files that visitors can open
Photos, notice attachments and downloads are stored in the **public** bucket `site-public`
(`<SUPABASE_URL>/storage/v1/object/public/site-public/<path>`). Anyone who knows a path can open the file, so never upload
anything private there. Allowed: jpg, png, webp, pdf, docx, xlsx; 10 MB each. Please upload photos already resized
(about 1600 px wide); the site does not make thumbnails.

## Tests
`node test.js` checks `validate.js` (student form rules) and `lib.js` (dates, file URLs, link safety, Markdown, paging).
To look at the site locally: `python -m http.server` in this folder, then open `http://localhost:8000/`.

## Privacy note (shown on the form)
"আপনার তথ্য শুধু বিভাগের কাজে ব্যবহৃত হবে।"
