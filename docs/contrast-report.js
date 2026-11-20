// WCAG contrast check of the colour tokens in site.css.
//   node docs/contrast-report.js      -> prints the table that is pasted into docs/DESIGN.md and exits 1 when a pair fails
// test.js uses compute() too, so a colour change that breaks AA fails the tests.
"use strict";
const fs = require("fs"), path = require("path");

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const x = lum(a), y = lum(b), hi = Math.max(x, y), lo = Math.min(x, y);
  return (hi + 0.05) / (lo + 0.05);
}

// token blocks of site.css: day (:root), night (data-theme=dark), auto-night (inside the prefers-color-scheme media query)
function tokens(css) {
  function grab(startMarker) {
    const i = css.indexOf(startMarker);
    if (i < 0) throw new Error("block not found: " + startMarker);
    const block = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
    const out = {};
    block.replace(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\b/g, (m, k, v) => { out[k] = v.toUpperCase(); return m; });
    return out;
  }
  return { day: grab(":root {"), night: grab(':root[data-theme="dark"] {'), auto: grab(":root:not([data-theme]) {") };
}

// [label, foreground token, background token, minimum ratio]. 4.5 = normal text, 3 = large text / UI components / focus indicators.
const PAIRS = [
  ["Body text on page", "text", "bg", 4.5], ["Body text on cards", "text", "surface", 4.5], ["Body text on soft fill (chips, table head)", "text", "surface-2", 4.5],
  ["Body text on current-period fill", "text", "accent-soft", 4.5], ["Body text in today's column", "text", "col-today", 4.5],
  ["Muted text on page", "muted", "bg", 4.5], ["Muted text on cards", "muted", "surface", 4.5], ["Muted text on soft fill", "muted", "surface-2", 4.5],
  ["Muted text on current-period fill", "muted", "accent-soft", 4.5], ["Muted text in today's column", "muted", "col-today", 4.5],
  ["Headings on page", "heading", "bg", 4.5], ["Headings on cards", "heading", "surface", 4.5], ["Headings on soft fill", "heading", "surface-2", 4.5],
  ["Links on page", "link", "bg", 4.5], ["Links on cards", "link", "surface", 4.5], ["Links on soft fill", "link", "surface-2", 4.5],
  ["Button text on primary", "on-primary", "primary", 4.5], ["Button text on primary (hover)", "on-primary", "primary-hover", 4.5],
  ["Amber badge \"এখন চলছে\" (ink on amber)", "on-accent", "accent", 4.5], ["Active filter chip (ink on amber)", "on-accent", "accent", 4.5],
  ["Error text on error fill", "err", "err-bg", 4.5], ["Error text on cards", "err", "surface", 4.5],
  ["Header text on header", "head-fg", "head-bg", 4.5], ["Header secondary text on header", "head-muted", "head-bg", 4.5],
  ["Hero button text (light button)", "hbtn-fg", "hbtn-bg", 4.5],
  ["Input / button border on cards (UI 3:1)", "edge", "surface", 3], ["Input / button border on page (UI 3:1)", "edge", "bg", 3],
  ["Amber marker on cards (UI 3:1)", "accent", "surface", 3], ["Active-chip outline (text colour) on page (UI 3:1)", "text", "bg", 3],
  ["Focus ring on page", "focus", "bg", 3], ["Focus ring on cards", "focus", "surface", 3], ["Focus ring in the header", "head-fg", "head-bg", 3],
  ["Primary action vs page (selected tab, current page link: UI 3:1)", "primary", "bg", 3]
];

function compute(css) {
  const t = tokens(css), rows = [];
  ["day", "night"].forEach((theme) => {
    PAIRS.forEach((p) => {
      const fg = t[theme][p[1]], bg = t[theme][p[2]];
      if (!fg || !bg) throw new Error(theme + ": missing token " + (!fg ? p[1] : p[2]) + " for " + p[0]);
      const r = ratio(fg, bg);
      rows.push({ theme, label: p[0], fg: p[1], bg: p[2], fgHex: fg, bgHex: bg, ratio: r, min: p[3], pass: r >= p[3] });
    });
  });
  // the "no JavaScript yet" night block must hold exactly the same colours as the chosen-night block
  const sameAuto = Object.keys(t.night).every((k) => t.auto[k] === t.night[k]) && Object.keys(t.auto).length === Object.keys(t.night).length;
  return { tokens: t, rows, sameAuto };
}

function markdown(res) {
  const out = [];
  ["day", "night"].forEach((theme) => {
    out.push("**" + (theme === "day" ? "Day" : "Night") + "**", "", "| Pair | Colours | Ratio | Needs | |", "|---|---|---|---|---|");
    res.rows.filter((r) => r.theme === theme).forEach((r) => {
      out.push("| " + r.label + " | `" + r.fgHex + "` on `" + r.bgHex + "` | " + r.ratio.toFixed(2) + " : 1 | " + r.min + " : 1 | " + (r.pass ? "pass" : "**FAIL**") + " |");
    });
    out.push("");
  });
  return out.join("\n");
}

module.exports = { ratio, tokens, compute, markdown, PAIRS };

if (require.main === module) {
  const res = compute(fs.readFileSync(path.join(__dirname, "..", "site.css"), "utf8"));
  console.log(markdown(res));
  const bad = res.rows.filter((r) => !r.pass);
  console.log(bad.length ? bad.length + " pair(s) FAIL" : "all " + res.rows.length + " pairs pass; auto-night block equals night block: " + res.sameAuto);
  process.exit(bad.length || !res.sameAuto ? 1 : 0);
}
