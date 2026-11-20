// Pure helpers of the public website (no DOM, no network). Tested by test.js (node test.js).
// Works in the browser (window.SiteLib) and in node (module.exports).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SiteLib = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var BN = "০১২৩৪৫৬৭৮৯";

  // 0-9 -> ০-৯ (anything else is kept)
  function bnDigits(v) {
    return String(v == null ? "" : v).replace(/[0-9]/g, function (d) { return BN.charAt(+d); });
  }

  // ০-৯ -> 0-9 (anything else is kept): for numbers typed or shared in Bangla digits
  function asciiDigits(v) {
    return String(v == null ? "" : v).replace(/[০-৯]/g, function (d) { return String(BN.indexOf(d)); });
  }

  // ISO timestamp -> dd/mm/yyyy in Bangladesh time (UTC+6), Bangla digits. "" for a bad value.
  function formatDate(iso) {
    if (!iso) return "";
    var t = Date.parse(iso);
    if (isNaN(t)) return "";
    var d = new Date(t + 6 * 3600 * 1000);
    var dd = ("0" + d.getUTCDate()).slice(-2), mm = ("0" + (d.getUTCMonth() + 1)).slice(-2);
    return bnDigits(dd + "/" + mm + "/" + d.getUTCFullYear());
  }

  // bytes -> "৫১২ B", "১.২ KB", "৩.৪ MB"; "" when unknown
  function formatSize(n) {
    if (n == null || n === "" || isNaN(+n) || +n < 0) return "";
    n = +n;
    if (n < 1024) return bnDigits(Math.round(n)) + " B";
    if (n < 1024 * 1024) return bnDigits((n / 1024).toFixed(1)) + " KB";
    return bnDigits((n / 1024 / 1024).toFixed(1)) + " MB";
  }

  var PUBLIC_BUCKET = "site-public";

  // Public URL of a file in the public bucket. "" when the path looks wrong (never builds a URL out of "..", "//", ":" ...).
  function fileUrl(base, path) {
    if (!base || typeof path !== "string") return "";
    if (!/^[A-Za-z0-9][A-Za-z0-9_.\/-]{0,299}$/.test(path) || /\.\.|\/\//.test(path)) return "";
    return String(base).replace(/\/+$/, "") + "/storage/v1/object/public/" + PUBLIC_BUCKET + "/" +
      path.split("/").map(encodeURIComponent).join("/");
  }

  // Only https:// (or http://) links with a host and no spaces / quotes / angle brackets. Otherwise "".
  function safeHttpUrl(u) {
    if (typeof u !== "string") return "";
    u = u.trim();
    if (!/^https?:\/\/[^\s<>"'\\]+$/i.test(u)) return "";
    if (!/^https?:\/\/[^\/?#]+\.[^\/?#]+/i.test(u) && !/^https?:\/\/localhost/i.test(u)) return "";
    return u;
  }

  function safeEmail(e) {
    return typeof e === "string" && /^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/.test(e.trim()) ? e.trim() : "";
  }

  // "tel:" link from a phone text: keeps digits and a leading +. "" when there are fewer than 5 digits.
  function telHref(p) {
    if (typeof p !== "string") return "";
    var s = p.replace(/[০-৯]/g, function (c) { return String(BN.indexOf(c)); });
    var plus = /^\s*\+/.test(s) ? "+" : "";
    var digits = s.replace(/[^0-9]/g, "");
    return digits.length >= 5 ? "tel:" + plus + digits : "";
  }

  // A link that may appear inside page text: https/http, mailto, tel, or a plain relative file name of this site.
  function safeHref(u) {
    if (typeof u !== "string") return "";
    u = u.trim();
    if (safeHttpUrl(u)) return u;
    var m = /^(mailto):(.+)$/i.exec(u);
    if (m) return safeEmail(m[2]) ? "mailto:" + m[2].trim() : "";
    if (/^tel:\+?[0-9]{5,20}$/i.test(u)) return u;
    if (/^[A-Za-z0-9_\-]+(\.[A-Za-z0-9]+)?(\?[A-Za-z0-9_=&.\-]*)?(#[A-Za-z0-9_\-]*)?$/.test(u)) return u;   // e.g. notices.html?id=1
    return "";
  }

  // ---------------- tiny Markdown (a safe subset) ----------------
  // Inline: **bold**, *italic*, [text](link). Returns tokens: {t:"text"|"strong"|"em"|"br", v} and {t:"a", v, href}.
  function parseInline(text) {
    var out = [];
    var lines = String(text == null ? "" : text).split("\n");
    var re = /\*\*([^*]+?)\*\*|\*([^*\s][^*]*?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
    lines.forEach(function (line, i) {
      if (i > 0) out.push({ t: "br" });
      var last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(line)) !== null) {
        if (m.index > last) out.push({ t: "text", v: line.slice(last, m.index) });
        if (m[1] != null) out.push({ t: "strong", v: m[1] });
        else if (m[2] != null) out.push({ t: "em", v: m[2] });
        else {
          var href = safeHref(m[4]);
          if (href) out.push({ t: "a", v: m[3], href: href });
          else out.push({ t: "text", v: m[3] });   // a bad link is shown as plain text
        }
        last = re.lastIndex;
      }
      if (last < line.length) out.push({ t: "text", v: line.slice(last) });
    });
    return out;
  }

  // Blocks: {t:"h", level:2..4, text}, {t:"p", text}, {t:"ul"|"ol", items:[text]}, {t:"hr"}.
  // "#" is level 2 because the page title is the only h1.
  function parseMarkdown(md) {
    var blocks = [];
    var lines = String(md == null ? "" : md).replace(/\r\n?/g, "\n").split("\n");
    var para = [], list = null;
    function flushPara() { if (para.length) { blocks.push({ t: "p", text: para.join("\n") }); para = []; } }
    function flushList() { if (list) { blocks.push(list); list = null; } }
    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, "");
      var m;
      if (line.trim() === "") { flushPara(); flushList(); return; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flushPara(); flushList(); blocks.push({ t: "hr" }); return; }
      if ((m = /^(#{1,3})\s+(.+)$/.exec(line))) { flushPara(); flushList(); blocks.push({ t: "h", level: m[1].length + 1, text: m[2] }); return; }
      if ((m = /^\s*[-*]\s+(.+)$/.exec(line))) {
        flushPara();
        if (!list || list.t !== "ul") { flushList(); list = { t: "ul", items: [] }; }
        list.items.push(m[1]); return;
      }
      if ((m = /^\s*[0-9০-৯]+[.)]\s+(.+)$/.exec(line))) {
        flushPara();
        if (!list || list.t !== "ol") { flushList(); list = { t: "ol", items: [] }; }
        list.items.push(m[1]); return;
      }
      flushList();
      para.push(line);
    });
    flushPara(); flushList();
    return blocks;
  }

  // ---------------- paging ----------------
  function pageInfo(total, limit, offset) {
    total = Math.max(0, +total || 0); limit = Math.max(1, +limit || 10); offset = Math.max(0, +offset || 0);
    var pages = Math.max(1, Math.ceil(total / limit));
    var page = Math.min(pages, Math.floor(offset / limit) + 1);
    return { page: page, pages: pages, hasPrev: page > 1, hasNext: page < pages };
  }

  // Page numbers to show: first, last, and two on each side of the current one; "…" for gaps.
  function pageNumbers(page, pages) {
    var set = {}, out = [], i;
    [1, pages, page - 2, page - 1, page, page + 1, page + 2].forEach(function (n) { if (n >= 1 && n <= pages) set[n] = true; });
    var nums = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    for (i = 0; i < nums.length; i++) {
      if (i > 0 && nums[i] - nums[i - 1] > 1) out.push("…");
      out.push(nums[i]);
    }
    return out;
  }

  // ---------------- misc ----------------
  function isUuid(s) { return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s); }

  // "?a=1&b=2" -> {a:"1", b:"2"} (no DOM needed)
  function parseQuery(search) {
    var o = {};
    String(search || "").replace(/^\?/, "").split("&").forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf("="), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? "" : kv.slice(i + 1);
      try { o[decodeURIComponent(k.replace(/\+/g, " "))] = decodeURIComponent(v.replace(/\+/g, " ")); } catch (e) { /* ignore a broken pair */ }
    });
    return o;
  }

  // {a:1, b:""} -> "?a=1" (empty values are left out); "" when nothing is left
  function buildQuery(obj) {
    var parts = Object.keys(obj || {}).filter(function (k) { return obj[k] !== "" && obj[k] != null; })
      .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]); });
    return parts.length ? "?" + parts.join("&") : "";
  }

  // first letters for a photo-less person ("ড. রহিম উদ্দিন" -> "র" is not guessed; we take the first two word starts)
  function initials(name) {
    var words = String(name || "").replace(/^(ড\.|ডঃ|ডা\.|মো\.|মোঃ|Dr\.|Md\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s*/i, "").trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map(function (w) { return Array.from(w)[0] || ""; }).join("");
  }

  // a Bangla message for a failed request
  function errorMessage(e) {
    var s = e && (e.name || "") + " " + (e && e.message || "");
    if (/AbortError|timeout/i.test(s)) return "সার্ভার সাড়া দিচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
    if (/http 404/.test(s)) return "তথ্য পাওয়া যায়নি। সাইটটি এখনো সম্পূর্ণ প্রস্তুত নয়।";
    if (/http (5\d\d|429)/.test(s)) return "সার্ভারে সমস্যা হচ্ছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
    if (/not configured/.test(s)) return "সাইটের সেটিং এখনো সম্পূর্ণ হয়নি।";
    return "ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না বা তথ্য আনা যায়নি। আবার চেষ্টা করুন।";
  }

  // ================= Task 54: dates, routine, theme, library, museum helpers =================
  var WEEKDAYS = { 1: "সোমবার", 2: "মঙ্গলবার", 3: "বুধবার", 4: "বৃহস্পতিবার", 5: "শুক্রবার", 6: "শনিবার", 7: "রবিবার" };
  var WEEKDAYS_SHORT = { 1: "সোম", 2: "মঙ্গল", 3: "বুধ", 4: "বৃহ", 5: "শুক্র", 6: "শনি", 7: "রবি" };
  var MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

  // "YYYY-MM-DD" (a date without time) -> {y, mo, d, t} or null. No time zone is involved (UTC maths on the calendar date).
  function parseYmd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(typeof s === "string" ? s : "");
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3], t = Date.UTC(y, mo - 1, d), dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return { y: y, mo: mo, d: d, t: t };
  }
  // ISO weekday of a calendar date: 1 = Monday ... 7 = Sunday; 0 when the text is not a date
  function isoWeekday(s) {
    var p = parseYmd(s);
    if (!p) return 0;
    var w = new Date(p.t).getUTCDay();
    return w === 0 ? 7 : w;
  }
  function weekdayName(n) { return WEEKDAYS[n] || ""; }
  function weekdayShort(n) { return WEEKDAYS_SHORT[n] || ""; }
  // "2026-11-20" -> "২০/১১/২০২৬"
  function formatDateOnly(s) {
    var p = parseYmd(s);
    if (!p) return "";
    return bnDigits(("0" + p.d).slice(-2) + "/" + ("0" + p.mo).slice(-2) + "/" + p.y);
  }
  // "2026-11-20" -> "২০ নভেম্বর ২০২৬, শুক্রবার"
  function formatLongDate(s) {
    var p = parseYmd(s);
    if (!p) return "";
    return bnDigits(p.d) + " " + MONTHS[p.mo - 1] + " " + bnDigits(p.y) + ", " + WEEKDAYS[isoWeekday(s)];
  }
  // "2026-11-20" -> "২০ নভেম্বর"
  function formatDayMonth(s) {
    var p = parseYmd(s);
    return p ? bnDigits(p.d) + " " + MONTHS[p.mo - 1] : "";
  }
  // "09:05" or "09:05:00" -> "০৯:০৫"; "" for a bad value
  function formatTime(t) {
    var m = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(typeof t === "string" ? t.trim() : "");
    return m ? bnDigits(("0" + m[1]).slice(-2) + ":" + m[2]) : "";
  }
  function formatTimeRange(a, b) {
    var x = formatTime(a), y = formatTime(b);
    return x && y ? x + " – " + y : (x || y);
  }

  // ---- routine ----
  function cellKey(day, period) { return day + "|" + period; }

  // The periods of the routine in order (bad rows left out)
  function sortedPeriods(data) {
    return ((data && data.periods) || []).filter(function (p) { return p && +p.period_no > 0; }).slice()
      .sort(function (a, b) { return a.period_no - b.period_no; });
  }

  // The Bangla subject name for a code, taken from the slots (exceptions carry only the code)
  function subjectNameFor(data, code) {
    if (!code) return "";
    var s = ((data && data.slots) || []).filter(function (x) { return x && x.subject_code === code; })[0];
    return s ? (s.subject_name_bn || s.subject_name_en || "") : "";
  }

  // What stands in one cell (a day + a period). Several slots may share a cell, they stack in the given order.
  // Every entry: {slot, notes:[exception...], today: exception|null, standalone}. An exception is matched to a slot by subject_code
  // (an exception without a subject code applies to every slot of the cell). An exception that matches no slot is shown as its own entry.
  // "today" is the exception dated data.today: the entry is then cancelled / has a substitute today.
  function buildCell(data, day, period) {
    data = data || {};
    var entries = [];
    (data.slots || []).forEach(function (s) {
      if (s && +s.day === +day && +s.period_no === +period) entries.push({ slot: s, notes: [], today: null, standalone: false });
    });
    var exs = (data.exceptions || []).filter(function (e) { return e && +e.day === +day && +e.period_no === +period; })
      .slice().sort(function (a, b) { return String(a.on_date).localeCompare(String(b.on_date)); });
    exs.forEach(function (e) {
      var hit = entries.filter(function (en) { return !en.standalone && (!e.subject_code || en.slot.subject_code === e.subject_code); });
      if (!hit.length) {
        hit = [{ slot: { subject_code: e.subject_code || "", teacher_name: e.teacher_name || "", subject_name_bn: subjectNameFor(data, e.subject_code) },
                 notes: [], today: null, standalone: true }];
        entries.push(hit[0]);
      }
      hit.forEach(function (en) {
        en.notes.push(e);
        if (e.on_date === data.today) en.today = e;
      });
    });
    return entries;
  }

  // Rows of "today's classes": only periods that have a class, in period order.
  // -> {date, weekday, working, rows:[{period:{period_no,start,end}, entries, current}]}
  function todayRows(data) {
    data = data || {};
    var wd = isoWeekday(data.today);
    var working = (data.working_days || []).indexOf(wd) >= 0;
    var rows = [];
    if (working) {
      sortedPeriods(data).forEach(function (p) {
        var entries = buildCell(data, wd, p.period_no);
        if (entries.length) rows.push({ period: p, entries: entries, current: data.now_period != null && +data.now_period === +p.period_no });
      });
    }
    return { date: data.today, weekday: wd, working: working, rows: rows };
  }

  // Is this column (ISO day) today? Is this period running now? (now_period comes from the server and means something only for today)
  function isTodayDay(data, day) { return !!data && isoWeekday(data.today) === +day; }
  function isNowPeriod(data, day, period) { return isTodayDay(data, day) && data.now_period != null && +data.now_period === +period; }

  // The changes of the next days, sorted by date then period
  function upcomingChanges(data) {
    var periods = {};
    sortedPeriods(data).forEach(function (p) { periods[p.period_no] = p; });
    return ((data && data.exceptions) || []).filter(function (e) { return e && (e.kind === "cancelled" || e.kind === "substitute"); })
      .slice().sort(function (a, b) { return String(a.on_date).localeCompare(String(b.on_date)) || (a.period_no - b.period_no); })
      .map(function (e) {
        return { on_date: e.on_date, day: e.day, period_no: e.period_no, kind: e.kind, subject_code: e.subject_code || "",
                 subject_name: subjectNameFor(data, e.subject_code), teacher_name: e.teacher_name || "", substitute_name: e.substitute_name || "",
                 period: periods[e.period_no] || null };
      });
  }

  function classTypeLabel(t) { return t === "practical" ? "ব্যবহারিক" : ""; }
  function changeLabel(ex) {
    if (!ex) return "";
    if (ex.kind === "cancelled") return "বাতিল";
    if (ex.kind === "substitute") return ex.substitute_name ? "বদলি: " + ex.substitute_name : "বদলি";
    return "";
  }

  // ---- batches ----
  var ORD = { 1: "১ম", 2: "২য়", 3: "৩য়", 4: "৪র্থ" };
  function yearLabel(y) {
    y = +y;
    if (!y) return "";
    return (ORD[y] || bnDigits(y) + "ম") + " বর্ষ";
  }
  function programName(b) { return (b && (b.program_bn || b.program)) || ""; }
  // "২০২৫-২৬ সেশন · ১ম বর্ষ"
  function batchLabel(b) {
    if (!b) return "";
    var parts = [];
    if (b.session) parts.push(bnDigits(b.session) + " সেশন");
    var y = yearLabel(b.year_of_study);
    if (y) parts.push(y);
    return parts.join(" · ");
  }
  // [{label, items}] grouped by program name, in the order the programs first appear
  function groupBatches(batches) {
    var groups = [], by = {};
    (batches || []).forEach(function (b) {
      if (!b || !b.id) return;
      var k = programName(b) || "অন্যান্য";
      if (!by[k]) { by[k] = { label: k, items: [] }; groups.push(by[k]); }
      by[k].items.push(b);
    });
    return groups;
  }
  // The remembered batch when it still exists; the only batch when there is exactly one; otherwise "" (the visitor must choose)
  function pickBatch(batches, saved) {
    var list = batches || [];
    if (saved) for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === saved) return saved;
    return list.length === 1 && list[0] && list[0].id ? list[0].id : "";
  }

  // ---- theme ----
  function normalizeThemePref(p) { return p === "light" || p === "dark" ? p : "auto"; }
  // pref ("light" | "dark" | "auto") + the system setting -> "light" | "dark"
  function resolveTheme(pref, systemDark) {
    var p = normalizeThemePref(pref);
    return p === "auto" ? (systemDark ? "dark" : "light") : p;
  }
  // The header button cycles auto -> day -> night -> auto
  function nextThemePref(p) {
    p = normalizeThemePref(p);
    return p === "auto" ? "light" : p === "light" ? "dark" : "auto";
  }
  var THEME_LABELS = { auto: "অটো মুড", light: "ডে মুড", dark: "নাইট মুড" };
  function themeLabel(p) { return THEME_LABELS[normalizeThemePref(p)]; }

  // ---- text ----
  // Markdown -> plain text (no marks); paragraphs and list items are joined with a space
  function plainFromMarkdown(md) {
    var out = [];
    parseMarkdown(md).forEach(function (b) {
      if (b.t === "hr") return;
      var texts = b.t === "ul" || b.t === "ol" ? b.items : [b.text];
      texts.forEach(function (t) {
        out.push(parseInline(t).map(function (x) { return x.t === "br" ? " " : x.v; }).join(""));
      });
    });
    return out.join(" ").replace(/\s+/g, " ").trim();
  }
  // At most max characters (not UTF-16 units), cut at a space when one is near the end, "…" added
  function excerpt(text, max) {
    var chars = Array.from(String(text == null ? "" : text).replace(/\s+/g, " ").trim());
    max = Math.max(1, +max || 280);
    if (chars.length <= max) return chars.join("");
    var cut = chars.slice(0, max), sp = cut.lastIndexOf(" ");
    if (sp > max * 0.6) cut = cut.slice(0, sp);
    return cut.join("").replace(/[\s,;:।.\-–—]+$/, "") + "…";
  }

  // ---- seminar library: the state lives in the URL ----
  var LIB_PER_PAGE = 20;
  function libraryState(search) {
    var q = parseQuery(search);
    var raw = asciiDigits(q.page || "1").trim();
    var page = /^[0-9]{1,5}$/.test(raw) ? parseInt(raw, 10) : 1;     // anything that is not a plain number means page 1
    return { q: (q.q || "").trim().slice(0, 100), category: (q.category || "").trim().slice(0, 60), page: page > 0 ? page : 1 };
  }
  function libraryHref(st) {
    st = st || {};
    return "library.html" + buildQuery({ q: st.q || "", category: st.category || "", page: st.page > 1 ? String(st.page) : "" });
  }
  function libraryParams(st) {
    st = st || {};
    return { p_q: st.q || null, p_category: st.category || null, p_limit: LIB_PER_PAGE, p_offset: (Math.max(1, st.page || 1) - 1) * LIB_PER_PAGE };
  }

  // ---- museum: client-side filter ----
  function museumFilter(items, q, category) {
    var needle = String(q || "").trim().toLowerCase();
    return (items || []).filter(function (it) {
      if (!it) return false;
      if (category && it.category !== category) return false;
      if (!needle) return true;
      return [it.title_bn, it.title_en, it.scientific_name, it.catalog_no].some(function (x) { return x && String(x).toLowerCase().indexOf(needle) >= 0; });
    });
  }

  return {
    bnDigits: bnDigits, asciiDigits: asciiDigits, formatDate: formatDate, formatSize: formatSize, fileUrl: fileUrl, safeHttpUrl: safeHttpUrl,
    safeEmail: safeEmail, telHref: telHref, safeHref: safeHref, parseInline: parseInline, parseMarkdown: parseMarkdown,
    pageInfo: pageInfo, pageNumbers: pageNumbers, isUuid: isUuid, parseQuery: parseQuery, buildQuery: buildQuery,
    initials: initials, errorMessage: errorMessage, PUBLIC_BUCKET: PUBLIC_BUCKET,
    parseYmd: parseYmd, isoWeekday: isoWeekday, weekdayName: weekdayName, weekdayShort: weekdayShort, formatDateOnly: formatDateOnly,
    formatLongDate: formatLongDate, formatDayMonth: formatDayMonth, formatTime: formatTime, formatTimeRange: formatTimeRange,
    cellKey: cellKey, sortedPeriods: sortedPeriods, buildCell: buildCell, subjectNameFor: subjectNameFor, todayRows: todayRows,
    isTodayDay: isTodayDay, isNowPeriod: isNowPeriod, upcomingChanges: upcomingChanges, classTypeLabel: classTypeLabel, changeLabel: changeLabel,
    yearLabel: yearLabel, programName: programName, batchLabel: batchLabel, groupBatches: groupBatches, pickBatch: pickBatch,
    normalizeThemePref: normalizeThemePref, resolveTheme: resolveTheme, nextThemePref: nextThemePref, themeLabel: themeLabel,
    plainFromMarkdown: plainFromMarkdown, excerpt: excerpt, libraryState: libraryState, libraryHref: libraryHref, libraryParams: libraryParams,
    LIB_PER_PAGE: LIB_PER_PAGE, museumFilter: museumFilter
  };
});
