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

  return {
    bnDigits: bnDigits, formatDate: formatDate, formatSize: formatSize, fileUrl: fileUrl, safeHttpUrl: safeHttpUrl,
    safeEmail: safeEmail, telHref: telHref, safeHref: safeHref, parseInline: parseInline, parseMarkdown: parseMarkdown,
    pageInfo: pageInfo, pageNumbers: pageNumbers, isUuid: isUuid, parseQuery: parseQuery, buildQuery: buildQuery,
    initials: initials, errorMessage: errorMessage, PUBLIC_BUCKET: PUBLIC_BUCKET
  };
});
