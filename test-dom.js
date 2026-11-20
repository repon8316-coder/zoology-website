// Smoke test of the public pages without a browser: a tiny fake DOM + fake RPC answers (test-fixtures.js, shaped like the
// migration 64 contracts). It cannot judge looks; it proves that every page renders, hides what has no data, survives failures
// and calls the right functions with the right parameters. Run through `node test.js`.
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path"), assert = require("assert");
const FX = require("./test-fixtures.js");

// ---------------- fake DOM ----------------
class Node_ {
  constructor(tag, text) { this.tagName = tag ? tag.toUpperCase() : "#text"; this.isText = tag == null; this._text = text || ""; this.childNodes = []; this.parentNode = null; this.attrs = {}; this.listeners = {}; this.value = ""; }
  get firstChild() { return this.childNodes[0] || null; }
  get children() { return this.childNodes.filter((c) => !c.isText); }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.childNodes.push(c); return c; }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); c.parentNode = null; return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "value") this.value = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  get hidden() { return "hidden" in this.attrs; }
  set hidden(v) { if (v) this.attrs.hidden = ""; else delete this.attrs.hidden; }
  get className() { return this.attrs.class || ""; }
  set className(v) { this.attrs.class = v; }
  get classList() {
    const self = this, list = () => (self.attrs.class || "").split(/\s+/).filter(Boolean);
    return {
      contains: (c) => list().indexOf(c) >= 0,
      add: (c) => { if (list().indexOf(c) < 0) self.attrs.class = list().concat(c).join(" "); },
      toggle: (c, on) => { const has = list().indexOf(c) >= 0, want = on === undefined ? !has : !!on; self.attrs.class = list().filter((x) => x !== c).concat(want ? [c] : []).join(" "); return want; }
    };
  }
  get textContent() { return this.isText ? this._text : this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { if (this.isText) this._text = String(v); else { this.childNodes.forEach((c) => { c.parentNode = null; }); this.childNodes = []; if (v !== "" && v != null) this.appendChild(new Node_(null, String(v))); } }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  fire(t, ev) { const e = Object.assign({ type: t, key: "", button: 0, defaultPrevented: false, target: this, preventDefault() { this.defaultPrevented = true; } }, ev || {}); (this.listeners[t] || []).forEach((f) => f.call(this, e)); return e; }
  focus() { this.focused = true; }
  querySelector(sel) { return find(this, (n) => n.tagName === sel.toUpperCase()); }
}
function walk(n, f) { if (f(n) === false) return false; for (const c of n.childNodes.slice()) if (walk(c, f) === false) return false; return true; }
function all(n, pred) { const out = []; walk(n, (x) => { if (!x.isText && pred(x)) out.push(x); }); return out; }
function find(n, pred) { return all(n, pred)[0] || null; }
const hasClass = (n, c) => n.classList.contains(c);
const byClass = (n, c) => all(n, (x) => hasClass(x, c));
const byTag = (n, t) => all(n, (x) => x.tagName === t.toUpperCase());
const text = (n) => n.textContent.replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function flush() { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); }

// ---------------- one page load ----------------
// routes: {rpc_name: (body) => data | throws}; opts: {page, search, storage:{k:v}}
async function boot(opts) {
  const calls = [], hist = [], store = Object.assign({}, opts.storage || {}), timers = [];
  const doc = new Node_("html");
  const body = new Node_("body"); body.setAttribute("data-page", opts.page); doc.appendChild(body);
  const mk = (tag, id) => { const e = new Node_(tag); e.setAttribute("id", id); body.appendChild(e); return e; };
  mk("header", "site-header"); const main = mk("main", "main"); mk("footer", "site-footer");
  const document_ = {
    body, title: "", hidden: false, documentElement: new Node_("html"),
    createElement: (t) => new Node_(t), createElementNS: (ns, t) => new Node_(t), createTextNode: (s) => new Node_(null, s),
    getElementById: (id) => find(doc, (n) => n.attrs.id === id), querySelector: () => null, addEventListener() {}
  };
  const routes = opts.routes;
  const ctx = {
    document: document_, console, Promise, JSON, setTimeout, clearTimeout, AbortController, encodeURIComponent, decodeURIComponent,
    setInterval: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearInterval() {},
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    location: { search: opts.search || "", href: "http://localhost/" + opts.page + ".html" + (opts.search || "") },
    history: { pushState: (s, t, u) => hist.push(["push", u]), replaceState: (s, t, u) => hist.push(["replace", u]) },
    addEventListener() {}, print() { ctx.printed = true; },
    fetch: (url, init) => {
      const name = String(url).split("/rpc/")[1], b = JSON.parse(init.body || "{}");
      calls.push({ name, body: b });
      if (!routes[name]) return Promise.reject(new Error("no route " + name));
      let data;
      try { data = routes[name](b); } catch (e) { return Promise.reject(e); }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(data))) });
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const dir = __dirname;
  vm.runInContext("window.APP_CONFIG = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake' };", ctx);
  ["lib.js", "site.js", "pages.js"].forEach((f) => vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), ctx, { filename: f }));
  await flush();
  return { main, body, doc, calls, hist, store, timers, ctx, header: byClass(body, "site-header")[0] || find(body, (n) => n.attrs.id === "site-header") };
}

const baseRoutes = () => ({
  web_site_settings: () => FX.settings, web_site_home: () => FX.home, web_site_routine_batches: () => FX.batches, web_site_routine: () => FX.routine,
  web_site_head: () => FX.head, web_site_museum: () => FX.museum, web_site_museum_item: () => FX.museumItem, web_site_gallery: () => FX.gallery,
  web_site_library: () => FX.library, web_site_library_categories: () => FX.libraryCategories,
  web_site_page: (b) => ({ item: b.p_slug === "museum" ? FX.pageMuseum.item : b.p_slug === "seminar-library" ? FX.pageLibrary.item : null })
});
const withRoutes = (over) => Object.assign(baseRoutes(), over || {});

async function run() {
  // ===== home, nothing remembered: the visitor must choose a batch =====
  {
    const p = await boot({ page: "home", routes: baseRoutes() });
    const m = text(p.main);
    assert.deepStrictEqual(all(p.main, (n) => n.tagName === "H2").filter((h) => !hasClass(h, "x")).map((h) => text(h)),
      ["আজকের ক্লাস", "সর্বশেষ নোটিশ", "বিভাগীয় প্রধানের বাণী", "দ্রুত লিংক", "আমাদের শিক্ষকগণ", "মিউজিয়ামের নমুনা", "গ্যালারি"], "home order");
    assert.strictEqual(byTag(p.main, "h1").length, 1);
    assert.ok(byTag(p.main, "a").some((a) => a.getAttribute("href") === "notices.html" && text(a) === "নোটিশ"));
    assert.ok(byTag(p.main, "a").some((a) => a.getAttribute("href") === "form.html" && text(a) === "শিক্ষার্থীর তথ্য ফর্ম"));
    assert.ok(/উপরের তালিকা থেকে আপনার ব্যাচ বেছে নিন/.test(m));
    assert.strictEqual(p.calls.filter((c) => c.name === "web_site_routine").length, 0, "no routine call before a batch is chosen");
    const sel = find(p.main, (n) => n.attrs.id === "today-batch");
    assert.strictEqual(byTag(sel, "optgroup").length, 2); assert.strictEqual(byTag(sel, "option").length, 4);   // placeholder + 3 batches
    assert.strictEqual(p.timers.length, 1);
    // choose a batch: remembered, routine loaded, today card filled
    sel.value = FX.B1; sel.fire("change");
    await flush();
    assert.strictEqual(p.store["site-batch"], FX.B1);
    assert.strictEqual(p.calls.filter((c) => c.name === "web_site_routine").pop().body.p_batch_id, FX.B1);
    const card = byClass(p.main, "today")[0], ct = text(card);
    assert.ok(ct.indexOf("২২ নভেম্বর ২০২৬, রবিবার") >= 0, ct);
    assert.strictEqual(byClass(card, "t-row").length, 2);                                // periods 1 and 2 only
    assert.ok(ct.indexOf("০৯:০০ – ০৯:৫০") >= 0 && ct.indexOf("পিরিয়ড ১") >= 0);
    assert.strictEqual(byClass(card, "chip-now").length, 1); assert.ok(hasClass(byClass(card, "t-row")[1], "now") && ct.indexOf("এখন চলছে") >= 0);
    assert.strictEqual(byClass(card, "cls-cancelled").length, 1); assert.ok(/বাতিল/.test(ct));
    assert.ok(ct.indexOf("বদলি: জনাব হাসান") >= 0 && ct.indexOf("ব্যবহারিক") >= 0 && ct.indexOf("ZOO-101") >= 0 && ct.indexOf("ড. রহিম উদ্দিন") >= 0 && ct.indexOf("কক্ষ: ২০১") >= 0);
    assert.ok(ct.indexOf("২৩ নভেম্বর") < 0, "tomorrow's change is not in today's card");
    assert.ok(byTag(card, "a").some((a) => a.getAttribute("href") === "routine.html" && /পুরো সাপ্তাহিক রুটিন/.test(text(a))));
    // head corner, highlights, strips
    const hc = text(byClass(p.main, "head-card")[0]);
    assert.ok(hc.indexOf("ড. আব্দুল করিম") >= 0 && hc.indexOf("অধ্যাপক ও বিভাগীয় প্রধান") >= 0 && hc.indexOf("পুরো বাণী পড়ুন") >= 0 && /…/.test(hc));
    assert.ok(Array.from(text(byClass(p.main, "head-excerpt")[0])).length <= 281);
    assert.ok(byTag(byClass(p.main, "head-card")[0], "a")[0].getAttribute("href") === "head.html");
    assert.strictEqual(byClass(p.main, "spec").length, 3);
    assert.strictEqual(byTag(byClass(p.main, "mosaic")[0], "img").length, 2);
    assert.ok(byTag(byClass(p.main, "mosaic")[0], "img")[0].getAttribute("src").indexOf("/storage/v1/object/public/site-public/gallery/") > 0);
    assert.ok(byTag(byClass(p.main, "mosaic")[0], "img").every((i) => i.getAttribute("width") && i.getAttribute("height") && i.getAttribute("alt")));
    assert.strictEqual(byClass(p.main, "notice-compact").length, 2);
    assert.strictEqual(byClass(p.main, "tile").length, 1);
    assert.strictEqual(byClass(p.main, "quick").length, 6);
    assert.strictEqual(byClass(p.main, "strip")[0].getAttribute("tabindex"), "0");
    // the header: theme button, nav with the new pages, skip target
    const hdr = find(p.body, (n) => n.attrs.id === "site-header"), btn = byClass(hdr, "theme-btn")[0];
    assert.ok(btn && /অটো মুড/.test(btn.getAttribute("aria-label")) && btn.getAttribute("title") === "অটো মুড" && btn.getAttribute("aria-pressed") === "false");
    btn.fire("click"); assert.strictEqual(p.store["site-theme"], "light"); assert.ok(/ডে মুড/.test(btn.getAttribute("aria-label")) && btn.getAttribute("aria-pressed") === "true");
    btn.fire("click"); assert.strictEqual(p.store["site-theme"], "dark"); assert.strictEqual(btn.getAttribute("title"), "নাইট মুড");
    btn.fire("click"); assert.strictEqual(p.store["site-theme"], "auto"); assert.strictEqual(btn.getAttribute("title"), "অটো মুড");
    assert.ok(text(byClass(hdr, "sr")[0]).indexOf("অটো মুড") >= 0, "state announced in a live region");
    const navLinks = byTag(byClass(hdr, "site-nav")[0], "a");
    ["head.html", "routine.html", "museum.html", "library.html"].forEach((h) => assert.ok(navLinks.some((a) => a.getAttribute("href") === h), h));
    assert.strictEqual(navLinks.filter((a) => a.getAttribute("aria-current") === "page").length, 1);
    const foot = text(find(p.body, (n) => n.attrs.id === "site-footer"));
    assert.ok(foot.indexOf("01700000000") >= 0 && foot.indexOf("zoo@example.com") >= 0 && foot.indexOf("রংপুর") >= 0 && foot.indexOf("সেমিনার লাইব্রেরি") >= 0);
  }

  // ===== home, batch remembered =====
  {
    const p = await boot({ page: "home", routes: baseRoutes(), storage: { "site-batch": FX.B2 } });
    assert.strictEqual(p.calls.filter((c) => c.name === "web_site_routine").length, 1);
    assert.strictEqual(p.calls.filter((c) => c.name === "web_site_routine")[0].body.p_batch_id, FX.B2);
    assert.strictEqual(byClass(p.main, "chip-now").length, 1);
    // a Friday: no class today
    const fri = withRoutes({ web_site_routine: () => Object.assign({}, FX.routine, { today: "2026-11-20", now_period: null }) });
    const q = await boot({ page: "home", routes: fri, storage: { "site-batch": FX.B1 } });
    assert.ok(/আজ ক্লাস নেই/.test(text(q.main)) && byClass(q.main, "t-row").length === 0);
    // a refresh timer re-asks the server without a spinner
    const before = q.calls.length; q.timers[0].f(); await flush(); assert.strictEqual(q.calls.length, before + 1);
  }

  // ===== home, routine switched off =====
  {
    const p = await boot({ page: "home", routes: withRoutes({ web_site_routine_batches: () => ({ maintenance: false, enabled: false }) }) });
    const host = byClass(p.main, "hero-today")[0];
    assert.ok(host.hidden && host.childNodes.length === 0, "the card is gone, no gap");
    assert.ok(hasClass(byClass(p.main, "hero")[0], "hero-solo"));
    assert.ok(byClass(p.main, "quick")[0].hidden, "the routine quick link is hidden too");
    assert.ok(text(p.main).indexOf("আজকের ক্লাস") < 0);
    // maintenance answers hide the widgets as well
    const m = await boot({ page: "home", routes: withRoutes({ web_site_routine_batches: () => ({ maintenance: true }), web_site_head: () => ({ maintenance: true }), web_site_museum: () => ({ maintenance: true }) }) });
    assert.ok(byClass(m.main, "hero-today")[0].hidden && byClass(m.main, "head-card").length === 0 && byClass(m.main, "spec").length === 0);
    // head corner off / museum empty / gallery empty: hidden without a gap
    const e = await boot({ page: "home", routes: withRoutes({ web_site_head: () => ({ maintenance: false, enabled: false }), web_site_museum: () => ({ maintenance: false, total: 0, categories: [], items: [] }), web_site_gallery: () => ({ albums: [], items: [] }) }) });
    const h2 = all(e.main, (n) => n.tagName === "H2" && !n.parentNode.hidden).map(text);
    assert.ok(h2.indexOf("বিভাগীয় প্রধানের বাণী") < 0 && h2.indexOf("মিউজিয়ামের নমুনা") < 0 && h2.indexOf("গ্যালারি") < 0, h2.join("|"));
  }

  // ===== home, calls fail: one broken widget never kills the page =====
  {
    const fail = () => { throw new Error("http 500"); };
    const p = await boot({ page: "home", routes: withRoutes({ web_site_routine_batches: fail, web_site_head: fail, web_site_museum: fail, web_site_gallery: fail }) });
    assert.strictEqual(byTag(p.main, "h1").length, 1);
    assert.strictEqual(byClass(p.main, "notice-compact").length, 2, "notices still render");
    const card = byClass(p.main, "today")[0];
    assert.ok(card && /আবার চেষ্টা করুন/.test(text(card)) && byClass(card, "state-error").length === 1, "the card shows its own Bangla error with a retry");
    assert.ok(byClass(p.main, "head-card").length === 0 && byClass(p.main, "spec").length === 0);
    // retry works once the server is back
    const routes = withRoutes({ web_site_routine_batches: fail });
    const q = await boot({ page: "home", routes, storage: { "site-batch": FX.B1 } });
    routes.web_site_routine_batches = () => FX.batches;
    byTag(byClass(q.main, "today")[0], "button").filter((b) => /আবার/.test(text(b)))[0].fire("click"); await flush();
    assert.ok(byClass(q.main, "t-row").length === 2);
    // a failing routine call (not the batches) keeps the select and shows the error
    const r = await boot({ page: "home", routes: withRoutes({ web_site_routine: fail }), storage: { "site-batch": FX.B1 } });
    assert.ok(find(r.main, (n) => n.attrs.id === "today-batch") && byClass(r.main, "state-error").length === 1);
    // the home call itself fails: hero, today card and widgets still there, plus an error with retry
    const h = await boot({ page: "home", routes: withRoutes({ web_site_home: fail }), storage: { "site-batch": FX.B1 } });
    assert.strictEqual(byTag(h.main, "h1").length, 1); assert.ok(byClass(h.main, "t-row").length === 2 && byClass(h.main, "spec").length === 3);
    assert.ok(byClass(h.main, "state-error").length === 1);
  }

  // ===== head page =====
  {
    const p = await boot({ page: "head", routes: baseRoutes() });
    const t = text(p.main);
    assert.strictEqual(byTag(p.main, "h1").length, 1); assert.ok(t.indexOf("ড. আব্দুল করিম") >= 0 && t.indexOf("head@example.com") >= 0 && t.indexOf("০১/১১/২০২৬") >= 0);
    assert.strictEqual(byTag(p.main, "strong").length, 1); assert.strictEqual(byTag(p.main, "li").length, 1);   // the markdown renderer ran
    assert.ok(byTag(p.main, "a").some((a) => a.getAttribute("href") === "mailto:head@example.com"));
    const d = await boot({ page: "head", routes: withRoutes({ web_site_head: () => ({ maintenance: false, enabled: false }) }) });
    assert.ok(/এখন প্রদর্শিত হচ্ছে না/.test(text(d.main)) && byClass(d.main, "state-empty").length === 1);
  }

  // ===== routine page =====
  {
    const p = await boot({ page: "routine", routes: baseRoutes(), storage: { "site-batch": FX.B1 } });
    assert.strictEqual(byTag(p.main, "h1").length, 1);
    const table = byTag(p.main, "table")[0];
    const heads = byTag(byTag(table, "thead")[0], "th").map((h) => text(h));
    assert.deepStrictEqual(heads.slice(1).map((h) => h.replace(" (আজ)", "")), ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"], "days in working_days order, Sunday first");
    assert.ok(/আজ/.test(heads[1]) && byTag(byTag(table, "thead")[0], "th")[1].getAttribute("aria-current") === "date");
    const rows = byTag(byTag(table, "tbody")[0], "tr");
    assert.strictEqual(rows.length, 3);
    const cellP2 = byTag(rows[1], "td")[0];
    assert.strictEqual(byClass(cellP2, "cls").length, 2, "two classes stack in one cell");
    assert.ok(hasClass(cellP2, "now") && hasClass(cellP2, "today-col") && /এখন চলছে/.test(text(cellP2)));
    assert.strictEqual(all(table, (n) => hasClass(n, "now")).length, 1);
    const cellP1 = byTag(rows[0], "td")[0];
    assert.ok(byClass(cellP1, "cls-cancelled").length === 1 && /২২ নভেম্বর \(আজ\): বাতিল/.test(text(cellP1)) && /২৯ নভেম্বর: বাতিল/.test(text(cellP1)), text(cellP1));
    assert.ok(/২৩ নভেম্বর: বাতিল/.test(text(byTag(rows[0], "td")[1])), "the Monday cell shows tomorrow's cancellation with its date");
    assert.ok(/ব্যবহারিক/.test(text(cellP2)) && /ZOO-103P/.test(text(cellP2)) && /ল্যাব ১/.test(text(cellP2)));
    assert.ok(/বদলি: জনাব হাসান/.test(text(cellP2)));
    assert.ok(/—/.test(text(byTag(rows[2], "td")[0])), "empty cell");
    const tabs = byClass(p.main, "rt-tab");
    assert.strictEqual(tabs.length, 5); assert.strictEqual(tabs.filter((t) => t.getAttribute("aria-selected") === "true").length, 1);
    assert.strictEqual(tabs.find((t) => t.getAttribute("aria-selected") === "true").getAttribute("data-day"), "7", "today's tab is selected");
    const panels = byClass(p.main, "rt-panel"); assert.strictEqual(panels.filter((x) => !x.hidden).length, 1);
    tabs[0].fire("keydown", { key: "ArrowRight" });
    assert.strictEqual(tabs[1].getAttribute("aria-selected"), "true"); assert.strictEqual(tabs[0].getAttribute("tabindex"), "-1"); assert.ok(tabs[1].focused);
    assert.ok(!panels[1].hidden && panels[0].hidden);
    const ch = byClass(p.main, "change"); assert.strictEqual(ch.length, 4);
    assert.ok(/আগামী ৭ দিনে পরিবর্তন/.test(text(p.main)) && /২২ নভেম্বর ২০২৬, রবিবার/.test(text(ch[0])) && /বদলি: জনাব হাসান/.test(text(ch[1])));
    const pr = byTag(p.main, "button").find((b) => text(b) === "প্রিন্ট করুন"); assert.ok(pr); pr.fire("click"); assert.ok(p.ctx.printed);
    assert.ok(text(p.main).indexOf("বি.এস.সি. (সম্মান)") >= 0 && text(p.main).indexOf("২০২৫-২৬ সেশন · ১ম বর্ষ") >= 0);
    // changing the batch loads the other routine and remembers it
    const sel = find(p.main, (n) => n.attrs.id === "rt-batch"); sel.value = FX.B2; sel.fire("change"); await flush();
    assert.strictEqual(p.calls.filter((c) => c.name === "web_site_routine").pop().body.p_batch_id, FX.B2); assert.strictEqual(p.store["site-batch"], FX.B2);
    assert.ok(p.hist.some((h) => h[0] === "replace" && /routine\.html\?batch=/.test(h[1])));
    // nothing chosen: a prompt, no routine call
    const n = await boot({ page: "routine", routes: baseRoutes() });
    assert.ok(/ব্যাচ বেছে নিন/.test(text(n.main)) && n.calls.filter((c) => c.name === "web_site_routine").length === 0);
    // a batch in the address is used first
    const u = await boot({ page: "routine", routes: baseRoutes(), search: "?batch=" + FX.B2, storage: { "site-batch": FX.B1 } });
    assert.strictEqual(u.calls.filter((c) => c.name === "web_site_routine")[0].body.p_batch_id, FX.B2);
    // switch off (both functions answer enabled:false), and a day with no data for the batch
    const off = await boot({ page: "routine", routes: withRoutes({ web_site_routine_batches: () => ({ maintenance: false, enabled: false }) }) });
    assert.ok(/রুটিন এখন প্রদর্শিত হচ্ছে না/.test(text(off.main)) && byTag(off.main, "table").length === 0);
    const off2 = await boot({ page: "routine", routes: withRoutes({ web_site_routine: () => ({ maintenance: false, enabled: false }) }), storage: { "site-batch": FX.B1 } });
    assert.ok(/রুটিন এখন প্রদর্শিত হচ্ছে না/.test(text(off2.main)));
    const emp = await boot({ page: "routine", routes: withRoutes({ web_site_routine: () => Object.assign({}, FX.routine, { slots: [], exceptions: [] }) }), storage: { "site-batch": FX.B1 } });
    assert.ok(/এখনো যুক্ত করা হয়নি/.test(text(emp.main)));
    const bad = await boot({ page: "routine", routes: withRoutes({ web_site_routine: () => { throw new Error("http 503"); } }), storage: { "site-batch": FX.B1 } });
    assert.ok(byClass(bad.main, "state-error").length === 1 && /আবার চেষ্টা করুন/.test(text(bad.main)));
  }

  // ===== museum =====
  {
    const p = await boot({ page: "museum", routes: baseRoutes() });
    assert.strictEqual(byTag(p.main, "h1").length, 1);
    assert.ok(/নমুনা.*সংরক্ষিত আছে/.test(text(p.main)), "intro page shown");
    assert.strictEqual(byClass(p.main, "spec").length, 4);
    const first = byClass(p.main, "spec")[0], img = byTag(first, "img")[0];
    assert.ok(img && img.getAttribute("alt") === "নমুনা ১".replace("১", "1") && img.getAttribute("loading") === "lazy" && img.getAttribute("width") && img.getAttribute("height"));
    assert.ok(byTag(first, "a")[0].getAttribute("href") === "museum-item.html?id=aaaaaaaa-aaaa-4aaa-8aaa-000000000001");
    assert.ok(byTag(first, "em").length === 1 && /MUS-001/.test(text(first)) && /উভচর/.test(text(first)));
    assert.ok(/মোট ৪টি নমুনা/.test(text(byClass(p.main, "mu-count")[0])));
    const chips = byClass(p.main, "chip-btn"); assert.deepStrictEqual(chips.map(text), ["সব", "উভচর", "সরীসৃপ"]);
    chips[1].fire("click");
    assert.strictEqual(byClass(p.main, "spec").length, 2); assert.strictEqual(chips[1].getAttribute("aria-pressed"), "true"); assert.strictEqual(chips[0].getAttribute("aria-pressed"), "false");
    assert.ok(/মোট ২টি নমুনা \(৪টির মধ্যে\)/.test(text(byClass(p.main, "mu-count")[0])));
    const q = find(p.main, (n) => n.attrs.id === "mu-q"); q.value = "tigrina 3"; q.fire("input"); await sleep(250);
    assert.strictEqual(byClass(p.main, "spec").length, 1); assert.ok(p.hist.some((h) => /museum\.html\?/.test(h[1]) && /cat=/.test(h[1]) && /q=tigrina/.test(h[1])));
    q.value = "zzz"; q.fire("input"); await sleep(250);
    assert.strictEqual(byClass(p.main, "spec").length, 0); assert.ok(/মেলেনি/.test(text(p.main)));
    // from the address
    const u = await boot({ page: "museum", routes: baseRoutes(), search: "?cat=" + encodeURIComponent("সরীসৃপ") });
    assert.strictEqual(byClass(u.main, "spec").length, 2);
    // unpublished intro is hidden; no items = friendly note
    const n = await boot({ page: "museum", routes: withRoutes({ web_site_page: () => ({ item: null }), web_site_museum: () => ({ maintenance: false, total: 0, categories: [], items: [] }) }) });
    assert.ok(/শীঘ্রই যুক্ত করা হবে/.test(text(n.main)) && byClass(n.main, "article").length === 0);
    // the item page
    const it = await boot({ page: "museum-item", routes: baseRoutes(), search: "?id=aaaaaaaa-aaaa-4aaa-8aaa-000000000001" });
    const t = text(it.main);
    assert.strictEqual(byTag(it.main, "h1").length, 1);
    assert.ok(t.indexOf("নমুনা 1") >= 0 && t.indexOf("Rana tigrina 1") >= 0 && t.indexOf("তিস্তা নদীর চর") >= 0 && t.indexOf("০৫/০৩/২০২৫") >= 0 && t.indexOf("প্রথম লাইন") >= 0 && t.indexOf("MUS-001") >= 0);
    assert.ok(byTag(it.main, "a").some((a) => a.getAttribute("href") === "museum.html" && /সব নমুনা/.test(text(a))));
    assert.ok(byTag(it.main, "img").length === 1 && byTag(it.main, "img")[0].getAttribute("alt") === "নমুনা 1");
    assert.strictEqual(it.calls.filter((c) => c.name === "web_site_museum_item")[0].body.p_id, "aaaaaaaa-aaaa-4aaa-8aaa-000000000001");
    const bad = await boot({ page: "museum-item", routes: baseRoutes(), search: "?id=not-a-uuid" });
    assert.ok(/পাওয়া যায়নি/.test(text(bad.main)) && bad.calls.filter((c) => c.name === "web_site_museum_item").length === 0);
    const gone = await boot({ page: "museum-item", routes: withRoutes({ web_site_museum_item: () => ({ maintenance: false, item: null }) }), search: "?id=aaaaaaaa-aaaa-4aaa-8aaa-000000000001" });
    assert.ok(/পাওয়া যায়নি/.test(text(gone.main)));
  }

  // ===== seminar library =====
  {
    const routes = baseRoutes();
    const p = await boot({ page: "library", routes, search: "?q=abc&category=" + encodeURIComponent("জার্নাল") + "&page=2" });
    const call = p.calls.filter((c) => c.name === "web_site_library")[0].body;
    assert.deepStrictEqual(call, { p_q: "abc", p_category: "জার্নাল", p_limit: 20, p_offset: 20 });
    const t = text(p.main);
    assert.strictEqual(byTag(p.main, "h1").length, 1);
    assert.ok(t.indexOf("এটি বইয়ের তালিকা; ধার দেওয়ার তথ্য এখানে নেই।") >= 0 && t.indexOf("খোলা থাকে") >= 0, "note and info block");
    assert.ok(t.indexOf("মোট ৪৫টি বই — পাতা ২ / ৩") >= 0, t);
    assert.strictEqual(byTag(p.main, "tr").length, 21); assert.strictEqual(byClass(p.main, "lib-card").length, 20);
    assert.deepStrictEqual(byTag(byTag(p.main, "thead")[0], "th").map(text), ["শিরোনাম", "লেখক", "বিভাগ", "প্রকাশ সাল", "অ্যাকসেশন নং", "তাক", "কপি"]);
    assert.ok(/২০১৫/.test(text(byTag(p.main, "tbody")[0])), "Bangla digits for the year");
    const cats = byTag(find(p.main, (n) => n.attrs.id === "lib-cat"), "option").map(text); assert.deepStrictEqual(cats, ["সব বিভাগ", "পাঠ্যবই (৩০)", "জার্নাল (১৫)"]);
    assert.strictEqual(find(p.main, (n) => n.attrs.id === "lib-cat").value, "জার্নাল"); assert.strictEqual(find(p.main, (n) => n.attrs.id === "lib-q").value, "abc");
    const pager = byClass(p.main, "pager")[0], links = byTag(pager, "a");
    assert.ok(links.some((a) => a.getAttribute("rel") === "prev") && links.some((a) => a.getAttribute("rel") === "next"));
    assert.strictEqual(links.filter((a) => a.getAttribute("aria-current") === "page").length, 1);
    const next = links.find((a) => a.getAttribute("rel") === "next");
    assert.strictEqual(next.getAttribute("href"), "library.html?q=abc&category=" + encodeURIComponent("জার্নাল") + "&page=3");
    // pager click: in-page, history entry, right offset
    const ev = next.fire("click"); await flush();
    assert.ok(ev.defaultPrevented && p.hist.some((h) => h[0] === "push" && /page=3/.test(h[1])));
    assert.strictEqual(p.calls.filter((c) => c.name === "web_site_library").pop().body.p_offset, 40);
    // a modified click is left to the browser
    const links2 = byTag(byClass(p.main, "pager")[0], "a"); const ev2 = links2[0].fire("click", { ctrlKey: true }); assert.ok(!ev2.defaultPrevented);
    // typing: debounced 300 ms, page back to 1, address updated (replace)
    const q = find(p.main, (n) => n.attrs.id === "lib-q"); const n0 = p.calls.filter((c) => c.name === "web_site_library").length;
    q.value = "ক"; q.fire("input"); q.value = "কর্ডাটা"; q.fire("input"); await sleep(120);
    assert.strictEqual(p.calls.filter((c) => c.name === "web_site_library").length, n0, "not before 300 ms");
    await sleep(400);
    assert.strictEqual(p.calls.filter((c) => c.name === "web_site_library").length, n0 + 1, "one call for two keystrokes");
    const last = p.calls.filter((c) => c.name === "web_site_library").pop().body;
    assert.deepStrictEqual([last.p_q, last.p_offset, last.p_category], ["কর্ডাটা", 0, "জার্নাল"]);
    assert.ok(p.hist.some((h) => h[0] === "replace" && h[1].indexOf("q=" + encodeURIComponent("কর্ডাটা")) > 0));
    // category change: immediate, pushes a history entry
    const sel = find(p.main, (n) => n.attrs.id === "lib-cat"); sel.value = ""; sel.fire("change"); await flush();
    assert.strictEqual(p.calls.filter((c) => c.name === "web_site_library").pop().body.p_category, null);
    // empty result, one page (no pager), error with retry
    const e = await boot({ page: "library", routes: withRoutes({ web_site_library: () => ({ maintenance: false, total: 0, items: [] }) }), search: "?q=zzz" });
    assert.ok(/কোনো বই পাওয়া যায়নি/.test(text(e.main)) && byClass(e.main, "pager").length === 0);
    const one = await boot({ page: "library", routes: withRoutes({ web_site_library: () => ({ maintenance: false, total: 3, items: FX.library.items.slice(0, 3) }) }) });
    assert.strictEqual(byClass(one.main, "pager").length, 0); assert.strictEqual(byClass(one.main, "lib-card").length, 3);
    const bad = await boot({ page: "library", routes: withRoutes({ web_site_library: () => { throw new Error("http 500"); } }) });
    assert.ok(byClass(bad.main, "state-error").length === 1 && /আবার চেষ্টা করুন/.test(text(bad.main)));
    const far = await boot({ page: "library", routes: withRoutes({ web_site_library: () => ({ maintenance: false, total: 5, items: [] }) }), search: "?page=9" });
    assert.ok(/এই পাতায় কোনো বই নেই/.test(text(far.main)));
    // info page unpublished or categories failing: the list still works
    const nf = await boot({ page: "library", routes: withRoutes({ web_site_page: () => ({ item: null }), web_site_library_categories: () => { throw new Error("x"); } }) });
    assert.ok(byClass(nf.main, "lib-info").length === 0 && byTag(nf.main, "tr").length === 21);
    // maintenance
    const mt = await boot({ page: "library", routes: withRoutes({ web_site_library_categories: () => ({ maintenance: true }), web_site_settings: () => ({ maintenance: true }) }) });
    assert.ok(/রক্ষণাবেক্ষণ/.test(text(mt.main)));
  }

  // ===== the old pages still render =====
  {
    const old = withRoutes({
      web_site_people: () => ({ items: FX.home.people }), web_site_notices: () => ({ total: 2, categories: ["ভর্তি"], items: FX.home.notices }),
      web_site_notice: () => ({ item: { id: "n1", title: "ভর্তি বিজ্ঞপ্তি", body: "লাইন ১\nলাইন ২", publish_at: "2026-11-20T04:00:00Z", pinned: true, category: "ভর্তি", attachment_path: null } }),
      web_site_downloads: () => ({ items: [{ id: "d1", title: "ফর্ম", category: "ফর্ম", file_path: "downloads/202611/a-b.pdf", file_size: 2048 }] }),
      web_site_page: () => ({ item: { slug: "about", title: "পরিচিতি", body_md: "# শিরোনাম\n\nটেক্সট" } })
    });
    for (const [page, expect, search] of [["about", "টেক্সট"], ["teachers", "ড. আব্দুল করিম"], ["notices", "ভর্তি বিজ্ঞপ্তি"], ["notice", "লাইন ২", "?id=aaaaaaaa-aaaa-4aaa-8aaa-000000000001"],
      ["gallery", "গ্যালারি"], ["downloads", "ফর্ম"], ["contact", "01700000000"]]) {
      const p = await boot({ page, routes: old, search });
      assert.ok(text(p.main).indexOf(expect) >= 0, page + ": " + text(p.main).slice(0, 120));
      assert.strictEqual(byTag(p.main, "h1").length, 1, page + " has one h1");
      assert.strictEqual(byClass(p.main, "state-error").length, 0, page);
    }
  }
}

module.exports = { run };
