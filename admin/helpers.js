// Pure helpers of the admin panel (no DOM, no network). Tested by test.js (node test.js).
// Works in the browser (window.AdminHelpers) and in node (module.exports).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AdminHelpers = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MB = 1024 * 1024;
  var MAX_BYTES = 10 * MB;
  var MAX_EDGE = 1600;
  var AREAS = ["notices", "people", "gallery", "downloads", "pages"];

  // extension -> {kind, mime}
  var TYPES = {
    jpg: { kind: "image", mime: "image/jpeg" }, jpeg: { kind: "image", mime: "image/jpeg" },
    png: { kind: "image", mime: "image/png" }, webp: { kind: "image", mime: "image/webp" },
    pdf: { kind: "file", mime: "application/pdf" },
    docx: { kind: "file", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    xlsx: { kind: "file", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
  };

  function extOf(name) {
    var m = /\.([A-Za-z0-9]{1,8})$/.exec(String(name || ""));
    return m ? m[1].toLowerCase() : "";
  }

  // The file name part (without the extension) as plain ASCII: letters, digits and single hyphens. Never empty.
  function sanitizeFileName(name, maxLen) {
    var s = String(name == null ? "" : name);
    s = s.replace(/^.*[\\\/]/, "");               // no folders
    s = s.replace(/\.[A-Za-z0-9]{1,8}$/, "");     // no extension
    try { s = s.normalize("NFKD"); } catch (e) { /* old engine: keep as is */ }
    s = s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
    s = s.slice(0, maxLen || 40).replace(/-+$/g, "");
    return s || "file";
  }

  // "202611" (UTC month). A Date is passed in so the function stays pure.
  function yyyymm(date) {
    var d = date instanceof Date && !isNaN(date) ? date : new Date();
    return d.getUTCFullYear() + ("0" + (d.getUTCMonth() + 1)).slice(-2);
  }

  var PATH_RE = /^[A-Za-z0-9][A-Za-z0-9_.\/-]*$/;
  function isValidPath(p) {
    return typeof p === "string" && p.length <= 300 && PATH_RE.test(p) && !/\.\.|\/\//.test(p);
  }

  // <area>/<yyyymm>/<uuid>-<safe-name>.<ext>. Throws for a bad area / ext. The result always satisfies isValidPath().
  function buildPath(area, date, uuid, fileName, ext) {
    if (AREAS.indexOf(area) < 0) throw new Error("bad area");
    ext = String(ext || "").toLowerCase();
    if (!TYPES[ext]) throw new Error("bad ext");
    var id = String(uuid || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!id) throw new Error("bad id");
    var head = area + "/" + yyyymm(date) + "/" + id + "-";
    var tail = "." + ext;
    var room = Math.max(1, 300 - head.length - tail.length);
    var path = head + sanitizeFileName(fileName, Math.min(40, room)) + tail;
    if (!isValidPath(path)) throw new Error("bad path");
    return path;
  }

  // First bytes of a file (array-like of numbers) -> "jpg" | "png" | "webp" | "pdf" | "zip" | "".
  function sniffType(b) {
    if (!b || b.length < 4) return "";
    function s(from, str) { for (var i = 0; i < str.length; i++) if (b[from + i] !== str.charCodeAt(i)) return false; return true; }
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return "jpg";
    if (b[0] === 0x89 && s(1, "PNG") && b[4] === 0x0D && b[5] === 0x0A) return "png";
    if (s(0, "RIFF") && b.length >= 12 && s(8, "WEBP")) return "webp";
    if (s(0, "%PDF")) return "pdf";
    if (b[0] === 0x50 && b[1] === 0x4B && (b[2] === 3 || b[2] === 5) && (b[3] === 4 || b[3] === 6)) return "zip";
    return "";
  }

  // Checks name + browser MIME + real first bytes + size.
  // wanted: "image" | "file" | "any". Returns {ok:true, ext, kind, mime} or {ok:false, error:<Bangla>}.
  function classifyFile(info, head, wanted) {
    var name = info && info.name || "";
    var ext = extOf(name);
    var t = TYPES[ext];
    if (!t) return { ok: false, error: "এই ধরনের ফাইল চলবে না (শুধু jpg, png, webp, pdf, docx, xlsx)" };
    if (wanted === "image" && t.kind !== "image") return { ok: false, error: "এখানে শুধু ছবি (jpg, png, webp) দিন" };
    if (wanted === "file" && t.kind !== "file") return { ok: false, error: "এখানে শুধু pdf, docx বা xlsx ফাইল দিন" };
    var size = info && info.size;
    if (typeof size !== "number" || !(size > 0)) return { ok: false, error: "ফাইলটি খালি" };
    if (size > MAX_BYTES) return { ok: false, error: "ফাইল ১০ MB এর বেশি বড়" };
    var real = sniffType(head);
    var okReal = (ext === "jpeg" ? real === "jpg" : ext === "docx" || ext === "xlsx" ? real === "zip" : real === ext);
    if (!okReal) return { ok: false, error: "ফাইলের ভেতরের ধরন নামের সাথে মেলেনি (ফাইলটি নষ্ট বা নাম বদলানো)" };
    var mt = String(info.type || "").toLowerCase();
    if (mt && mt !== "application/octet-stream" && mt !== t.mime && !(ext === "jpg" && mt === "image/jpg")) {
      return { ok: false, error: "ফাইলের ধরন ঠিক নেই" };
    }
    return { ok: true, ext: ext === "jpeg" ? "jpg" : ext, kind: t.kind, mime: t.mime };
  }

  // Image size after the 1600 px rule: {w, h, scaled}. Never enlarges.
  function fitDimensions(w, h, max) {
    max = max || MAX_EDGE;
    w = Math.round(+w); h = Math.round(+h);
    if (!(w > 0) || !(h > 0)) return { w: 0, h: 0, scaled: false };
    var long = Math.max(w, h);
    if (long <= max) return { w: w, h: h, scaled: false };
    var k = max / long;
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), scaled: true };
  }

  // Keep the original file when it is already small: long edge <= 1600 px and at most 700 KB.
  function keepOriginalImage(w, h, bytes) {
    return Math.max(+w || 0, +h || 0) <= MAX_EDGE && +bytes <= 700 * 1024;
  }

  // ---------------- date and time (Bangladesh = UTC+6, no daylight saving) ----------------
  var DHAKA = 6 * 3600 * 1000;

  // "2026-11-20T14:30" typed in Dhaka time -> "2026-11-20T08:30:00.000Z". "" / bad value -> null.
  function dhakaLocalToIso(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(v || ""));
    if (!m) return null;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - DHAKA;
    var d = new Date(t);
    // reject impossible dates such as 31 Feb (Date.UTC would roll them over)
    var back = new Date(t + DHAKA);
    if (back.getUTCMonth() !== +m[2] - 1 || back.getUTCDate() !== +m[3] || back.getUTCHours() !== +m[4]) return null;
    return d.toISOString();
  }

  // ISO timestamp -> "2026-11-20T14:30" in Dhaka time for <input type="datetime-local">. "" for empty / bad.
  function isoToDhakaLocal(iso) {
    if (!iso) return "";
    var t = Date.parse(iso);
    if (isNaN(t)) return "";
    var d = new Date(t + DHAKA);
    function p(n) { return ("0" + n).slice(-2); }
    return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()) + "T" + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
  }

  // "now" in the datetime-local format, Dhaka time
  function nowDhakaLocal(now) { return isoToDhakaLocal(new Date(now == null ? Date.now() : +now).toISOString()); }

  // ---------------- form -> payload ----------------
  function str(v) { return v == null ? "" : String(v).trim(); }

  // form: {id?, title, category, body, publish_at (local), expires_at (local), pinned, is_published, attachment_path}
  // Returns {payload} or {error}. Dates become UTC ISO strings; an empty expiry is null.
  function noticeToPayload(f) {
    var title = str(f.title);
    if (!title) return { error: "শিরোনাম লিখুন" };
    var pub = f.publish_at ? dhakaLocalToIso(f.publish_at) : null;
    if (f.publish_at && !pub) return { error: "প্রকাশের তারিখ ঠিক নেই" };
    var exp = f.expires_at ? dhakaLocalToIso(f.expires_at) : null;
    if (f.expires_at && !exp) return { error: "মেয়াদ শেষের তারিখ ঠিক নেই" };
    if (pub && exp && Date.parse(exp) <= Date.parse(pub)) return { error: "মেয়াদ শেষের সময় প্রকাশের সময়ের পরে হতে হবে" };
    var p = {
      title: title, category: str(f.category) || "সাধারণ", body: String(f.body == null ? "" : f.body),
      expires_at: exp, pinned: !!f.pinned, is_published: !!f.is_published,
      attachment_path: f.attachment_path || null
    };
    if (pub) p.publish_at = pub;
    if (f.id) p.id = f.id;
    return { payload: p };
  }

  function personToPayload(f) {
    if (f.kind !== "teacher" && f.kind !== "staff") return { error: "ধরন বেছে নিন (শিক্ষক / কর্মচারী)" };
    if (!str(f.name)) return { error: "নাম লিখুন" };
    var p = {
      kind: f.kind, name: str(f.name), designation: str(f.designation), bio: String(f.bio == null ? "" : f.bio).trim(),
      email_public: str(f.email_public) || null, photo_path: f.photo_path || null, is_published: !!f.is_published
    };
    if (f.id) p.id = f.id;
    return { payload: p };
  }

  function galleryToPayload(f) {
    if (!f.image_path) return { error: "ছবি নেই" };
    var p = { title: str(f.title), caption: str(f.caption), album: str(f.album), image_path: f.image_path, is_published: !!f.is_published };
    if (f.id) p.id = f.id;
    return { payload: p };
  }

  function downloadToPayload(f) {
    if (!str(f.title)) return { error: "শিরোনাম লিখুন" };
    if (!f.file_path) return { error: "ফাইল নেই" };
    var p = { title: str(f.title), category: str(f.category), file_path: f.file_path, is_published: !!f.is_published };
    if (f.file_size != null && f.file_size !== "") p.file_size = +f.file_size;
    if (f.id) p.id = f.id;
    return { payload: p };
  }

  var SLUG_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
  function isValidSlug(s) { return typeof s === "string" && SLUG_RE.test(s); }

  function pageToPayload(f) {
    var slug = str(f.slug).toLowerCase();
    if (!isValidSlug(slug)) return { error: "পাতার নাম (slug): ছোট ইংরেজি অক্ষর, সংখ্যা ও - চলবে" };
    if (!str(f.title)) return { error: "শিরোনাম লিখুন" };
    return { payload: { slug: slug, title: str(f.title), body_md: String(f.body_md == null ? "" : f.body_md), is_published: !!f.is_published } };
  }

  // ---------------- student submission <-> web form keys ----------------
  var SUB_KEYS = ["reg_no", "name_bn", "name_en", "roll_no", "father_name", "mother_name", "session", "program", "year_of_study",
    "mobile", "dob", "gender", "blood_group", "guardian_name", "guardian_mobile", "village", "post_office", "thana", "district"];

  // a row of student_submissions -> the keys student_submission_update expects (strings only)
  function submissionToForm(r) {
    r = r || {};
    var m = { village: "address_village", post_office: "address_post", thana: "address_thana", district: "address_zila" };
    var o = {};
    SUB_KEYS.forEach(function (k) {
      var v = m[k] ? r[m[k]] : r[k];
      o[k] = v == null ? "" : String(v);
    });
    return o;
  }

  // only the keys the server knows; empty optional fields are sent as "" (the server cleans them)
  function formToSubmission(f) {
    var o = {};
    SUB_KEYS.forEach(function (k) { o[k] = str(f[k]); });
    return o;
  }

  // ---------------- routing ----------------
  var ROUTES = ["dashboard", "notices", "people", "gallery", "downloads", "pages", "submissions", "control"];

  // "#/notices/new" -> {name:"notices", arg:"new"}; unknown or empty -> dashboard. Nothing from the hash is trusted further.
  function parseRoute(hash) {
    var h = String(hash || "").replace(/^#\/?/, "").split("?")[0];
    var parts = h.split("/").filter(Boolean);
    var name = parts[0] || "dashboard";
    if (ROUTES.indexOf(name) < 0) return { name: "dashboard", arg: "" };
    var arg = parts[1] ? safeDecode(parts[1]) : "";
    if (arg && !/^[A-Za-z0-9_-]{1,64}$/.test(arg)) arg = "";
    return { name: name, arg: arg };
  }
  function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return ""; } }

  // ---------------- list helpers ----------------
  // ids in display order -> new order after moving the item at `index` one step (dir -1 up, +1 down). A copy.
  function moveItem(ids, index, dir) {
    var a = ids.slice(), j = index + dir;
    if (index < 0 || index >= a.length || j < 0 || j >= a.length) return a;
    var t = a[index]; a[index] = a[j]; a[j] = t;
    return a;
  }

  // identity of a picked file, so a retry never adds the same file twice
  function fileKey(f) { return [f && f.name, f && f.size, f && f.lastModified].join("|"); }

  // distinct non-empty values, in first-seen order (category suggestions)
  function uniqueValues(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (v) { v = str(v); if (v && !seen[v]) { seen[v] = true; out.push(v); } });
    return out;
  }

  // "৮টির মধ্যে ৭টি যুক্ত হয়েছে"
  function uploadSummary(total, ok) {
    function bn(n) { return String(n).replace(/[0-9]/g, function (d) { return "০১২৩৪৫৬৭৮৯".charAt(+d); }); }
    return bn(total) + "টির মধ্যে " + bn(ok) + "টি যুক্ত হয়েছে";
  }

  return {
    MAX_BYTES: MAX_BYTES, MAX_EDGE: MAX_EDGE, AREAS: AREAS, TYPES: TYPES, SUB_KEYS: SUB_KEYS, ROUTES: ROUTES,
    extOf: extOf, sanitizeFileName: sanitizeFileName, yyyymm: yyyymm, isValidPath: isValidPath, buildPath: buildPath,
    sniffType: sniffType, classifyFile: classifyFile, fitDimensions: fitDimensions, keepOriginalImage: keepOriginalImage,
    dhakaLocalToIso: dhakaLocalToIso, isoToDhakaLocal: isoToDhakaLocal, nowDhakaLocal: nowDhakaLocal,
    noticeToPayload: noticeToPayload, personToPayload: personToPayload, galleryToPayload: galleryToPayload,
    downloadToPayload: downloadToPayload, pageToPayload: pageToPayload, isValidSlug: isValidSlug,
    submissionToForm: submissionToForm, formToSubmission: formToSubmission, parseRoute: parseRoute,
    moveItem: moveItem, fileKey: fileKey, uniqueValues: uniqueValues, uploadSummary: uploadSummary
  };
});
