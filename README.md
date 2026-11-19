# Zoology Department – student information page

Plain HTML/CSS/JS, no build step. Students fill `form.html`; the data goes to the Supabase database
(function `student_web_submit`) and waits there until the admin approves it in the department app
("ফর্মে জমা পড়া তথ্য").

## Files
- `index.html` – landing page (replace the "লোগো" circle with your logo image)
- `form.html`, `form.js`, `validate.js` – the form; `validate.js` repeats the server rules for instant messages
- `config.js` – **the only file you edit**: the Supabase URL and the **publishable (anon) key**
- `style.css`

## 1. Set the key
Open `config.js` and replace `PASTE_PUBLISHABLE_KEY_HERE` with the publishable key
(Supabase → Project Settings → API Keys → *Publishable key*, starts with `sb_publishable_`).
Never put the `service_role` / secret key here. The database only lets this key call two functions
(`student_web_options`, `student_web_submit`); it cannot read any table.

## 2. Database
Run migration `20261201000100_student_web_submissions.sql` (in the app repo) once in the Supabase SQL Editor.

## 3. Publish on GitHub Pages
1. Create a GitHub repository and push this folder to branch `main`.
2. GitHub → repository **Settings → Pages**.
3. *Build and deployment* → Source: **Deploy from a branch** → Branch **main**, folder **/ (root)** → Save.
4. After a minute the page is at `https://<user>.github.io/<repo>/`. The form is `.../form.html`.

## Test locally
Open `form.html` in a browser (or `python -m http.server` in this folder). `node test.js` checks the validation rules.

## Privacy note (shown on the form)
"আপনার তথ্য শুধু বিভাগের কাজে ব্যবহৃত হবে।"
