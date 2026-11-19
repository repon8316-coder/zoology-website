# Zoology Department – public website and student information page

Plain HTML/CSS/JS, **no build step**, no framework. It runs on GitHub Pages under any sub-path
(for example `https://<user>.github.io/zoology-website/`) and would run the same on a custom domain later:
**every link in the code is relative**, nothing contains the repository name or a domain.

The data comes from the department's Supabase database. The logged-out website may call only a few read-only functions
(`web_site_*`) and the two form functions (`student_web_*`); it cannot read any table. The admin writes the content in the
admin panel (`admin/`, see below) after signing in with an admin account.

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
3. `20261203000100_site_control.sql` (migration 63: admin-only get/set of the student-form settings; needed only for the form switch and limits in the control panel)

## 3. Publish on GitHub Pages
Repository **Settings → Pages** → Source: *Deploy from a branch* → branch `main`, folder `/ (root)` → Save.
The site is at `https://<user>.github.io/<repo>/`; the student form stays at `…/form.html`.

## Files that visitors can open
Photos, notice attachments and downloads are stored in the **public** bucket `site-public`
(`<SUPABASE_URL>/storage/v1/object/public/site-public/<path>`). Anyone who knows a path can open the file, so never upload
anything private there. Allowed: jpg, png, webp, pdf, docx, xlsx; 10 MB each. Please upload photos already resized
(about 1600 px wide); the site does not make thumbnails.

## Tests
`node test.js` checks `validate.js` (student form rules), `lib.js` (dates, file URLs, link safety, Markdown, paging) and
`admin/helpers.js` (file-name and path builder, file type / size checks, image size maths, Dhaka time <-> UTC, form -> payload, routes).
To look at the site locally: `python -m http.server` in this folder, then open `http://localhost:8000/`.

## Admin panel (`admin/index.html`)
Open `<site>/admin/` (for example `https://<user>.github.io/<repo>/admin/`). It is a single page with hash links (`#/notices` ...);
it has `noindex`, is not linked from the public menu, and shows nothing but the sign-in card until an admin signs in.

**How the admin signs in:** type the e-mail and password of an app account whose role is **admin** (the same account as in the
department app; create it in the app / Supabase Auth, there is no sign-up or password reset here). After sign-in the panel asks the
database one admin-only question (`student_submission_counts`). A user who is not an admin sees "আপনার অ্যাডমিন অনুমতি নেই", is signed out
and no admin data is requested. The session is kept by supabase-js in the browser; when it expires the sign-in card comes back with a message.
The password is never stored, logged or put in a URL.

**Sections**
| Section | What it does |
|---|---|
| ড্যাশবোর্ড | counts of submissions, notices, people, photos, downloads, pages; quick links; a banner while maintenance mode is on |
| নোটিশ | search + status filter; create / edit with a live preview (same safe renderer as the public site), publish / expiry time (Dhaka time), pinned, attachment (replace / remove); publish / hide; delete |
| শিক্ষক ও কর্মচারী | add / edit (photo with preview), publish / hide, ↑ ↓ reorder, delete |
| গ্যালারি | many photos at once into an album; per-photo title, caption, album, publish; ↑ ↓ reorder; delete |
| ডাউনলোড | many files at once; title, category, publish; shows size; ↑ ↓ reorder; delete |
| পাতা | edit about / history / vision / contact (Markdown subset with live preview); create a page with a new slug (lowercase letters, digits, `-`) |
| ফর্মে জমা পড়া তথ্য | pending / approved / rejected, search, detail + fix typos, accept (automatic batch or pick one), reject with a reason, accept all |
| কন্ট্রোল প্যানেল | site name / address / phone / e-mail / links; maintenance mode (with confirm); student form open / closed + the two rate limits; read-only "site health" |

**Upload rules** (bucket `site-public`, admin session)
- Allowed: jpg, png, webp (images) and pdf, docx, xlsx (files); 10 MB each. The real file bytes are checked, not only the name.
- Images are shrunk in the browser to at most 1600 px (webp, quality about 0.82; jpeg if webp is not available). A small image is kept as it is.
- Stored as `<area>/<yyyymm>/<uuid>-<ascii-name>.<ext>` where area is `notices | people | gallery | downloads | pages`. The original name is never used as a path.
- Order of work: upload -> save the row -> (on failure the new file is deleted again). Old / deleted files are removed from the bucket only after the database call worked; if that cleanup fails you get a gentle warning.
- Many files: each file shows its own result, a failed file does not stop the rest, a summary is shown, and a file that was already added is not added twice on retry.

**How to add content:** sign in -> choose the section -> fill the form -> tick "প্রকাশ করুন" -> save. Items stay invisible on the public site until published.

**Security notes**
- The bucket `site-public` is **public**: anyone who knows a file path can open the file. Never upload anything private (student data, marks, ID photos) there. The panel shows this warning next to every upload button.
- Only the publishable key (`sb_publishable_...`) is in `config.js`. The panel never uses a `service_role` / secret key; every write is checked by the database (functions that call `private.require_admin()` and storage policies that need `private.is_admin()`).
- supabase-js is loaded from jsdelivr at an exact version (`2.45.4`) with an integrity hash. No other third-party script runs.
- All data is shown with `textContent` / DOM APIs (no `innerHTML`).
- Turning on maintenance mode hides the public pages, not this panel and not `form.html`.

## Privacy note (shown on the form)
"আপনার তথ্য শুধু বিভাগের কাজে ব্যবহৃত হবে।"
