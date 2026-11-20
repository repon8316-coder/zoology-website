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
    var mt = String(info.type || "").toLowerCase();
    var mtFree = !mt || mt === "application/octet-stream";
    if (t.kind === "image") {
      // Pictures: the REAL type (first bytes) decides. A JPEG named icon.png is a normal case, so it is accepted
      // and stored as jpg. Anything that is not really a jpg / png / webp picture is refused.
      if (real !== "jpg" && real !== "png" && real !== "webp") {
        return { ok: false, error: "ফাইলের ভেতরের ধরন নামের সাথে মেলেনি (ফাইলটি নষ্ট বা নাম বদলানো)" };
      }
      var realMime = TYPES[real].mime;
      if (!mtFree && mt !== realMime && mt !== t.mime && !(mt === "image/jpg" && real === "jpg")) {
        return { ok: false, error: "ফাইলের ধরন ঠিক নেই" };
      }
      return { ok: true, ext: real, kind: "image", mime: realMime };
    }
    // pdf / docx / xlsx stay strict: the extension must match the real bytes.
    var okReal = (ext === "docx" || ext === "xlsx" ? real === "zip" : real === ext);
    if (!okReal) return { ok: false, error: "ফাইলের ভেতরের ধরন নামের সাথে মেলেনি (ফাইলটি নষ্ট বা নাম বদলানো)" };
    if (!mtFree && mt !== t.mime) return { ok: false, error: "ফাইলের ধরন ঠিক নেই" };
    return { ok: true, ext: ext, kind: t.kind, mime: t.mime };
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
  var ROUTES = ["dashboard", "notices", "people", "gallery", "downloads", "pages", "submissions", "import", "control"];

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

  // ======================= student import (CSV / Excel) =======================
  // Same heading names / aliases and the same cell rules as the Flutter app (lib/features/students/import/*), so one file works in both.
  var IMPORT_MAX_BYTES = 5 * MB, IMPORT_MAX_ROWS = 2000, IMPORT_CHUNK = 200;

  function bn(n) { return String(n).replace(/[0-9]/g, function (d) { return "০১২৩৪৫৬৭৮৯".charAt(+d); }); }
  function asciiDigits(s) {
    return String(s == null ? "" : s).replace(/[০-৯]/g, function (c) { return String("০১২৩৪৫৬৭৮৯".indexOf(c)); });
  }

  // heading -> comparable key: lower case, ASCII digits, no spaces / punctuation, one spelling for য় ড় ঢ় (NFC), ী = ি, ূ = ু
  function importKey(s) {
    var t = asciiDigits(s);
    try { t = t.normalize("NFC"); } catch (e) { /* old engine */ }
    t = t.toLowerCase().replace(/ী/g, "ি").replace(/ূ/g, "ু");
    return t.replace(/[\s​-‍ ().,:ঃ;'’_\-–\/\\|]+/g, "");
  }
  function cleanCell(s) {
    return String(s == null ? "" : s).replace(/[​-‍﻿ ]/g, " ").replace(/\s+/g, " ").trim();
  }
  function regNo(s) {
    var t = asciiDigits(cleanCell(s)).toUpperCase();
    return /^\d+\.0+$/.test(t) ? t.replace(/\.0+$/, "") : t;   // "123.0" (a number cell) -> "123"
  }
  function normMobile(s) {
    var d = asciiDigits(s).replace(/[^0-9]/g, "");
    if (d.length === 13 && d.indexOf("8801") === 0) d = d.slice(2);
    if (d.length === 10 && d.charAt(0) === "1") d = "0" + d;      // Excel dropped the leading 0
    return d;
  }

  // key = the JSON key of public.import_students (or "address" = one full-address column that is split)
  var IMPORT_FIELDS = [
    { key: "registration_no", bn: "রেজিস্ট্রেশন নং", en: "Registration No", aliases: ["রেজিস্ট্রেশন নম্বর", "রেজিঃ নং", "রেজি নং", "রেজিস্ট্রেশন", "registration number", "reg no", "reg", "regno"] },
    { key: "name_bn", bn: "নাম (বাংলা)", en: "Name (Bangla)", aliases: ["বাংলা নাম", "নাম বাংলা", "name bangla", "name bn", "নাম"] },
    { key: "name_en", bn: "Name (English)", en: "Name (English)", aliases: ["নাম (ইংরেজি)", "ইংরেজি নাম", "name english", "english name", "name en", "name", "student name"] },
    { key: "class_roll", bn: "রোল নং", en: "Class Roll", aliases: ["রোল", "ক্লাস রোল", "class roll", "roll", "roll no"] },
    { key: "father_name", bn: "পিতার নাম", en: "Father's Name", aliases: ["বাবার নাম", "father name", "father"] },
    { key: "mother_name", bn: "মাতার নাম", en: "Mother's Name", aliases: ["মায়ের নাম", "mother name", "mother"] },
    { key: "father_name_en", bn: "পিতার নাম (ইংরেজি)", en: "Father's Name (English)", aliases: ["father name english", "father name en", "father english"] },
    { key: "mother_name_en", bn: "মাতার নাম (ইংরেজি)", en: "Mother's Name (English)", aliases: ["mother name english", "mother name en", "mother english"] },
    { key: "program", bn: "প্রোগ্রাম", en: "Program", aliases: ["শ্রেণি", "শ্রেণী", "কোর্স", "program", "programme", "course", "class"] },
    { key: "session", bn: "শিক্ষাবর্ষ", en: "Session", aliases: ["সেশন", "session", "academic session", "academic year"] },
    { key: "year_of_study", bn: "বর্ষ", en: "Year", aliases: ["year", "year of study", "অধ্যয়নরত বর্ষ"] },
    { key: "study_group", bn: "গ্রুপ", en: "Group", aliases: ["group"] },
    { key: "mobile", bn: "মোবাইল নং", en: "Mobile", aliases: ["মোবাইল নম্বর", "মোবাইল", "ফোন", "ফোন নম্বর", "mobile no", "mobile number", "phone", "contact no", "contact"] },
    { key: "date_of_birth", bn: "জন্মতারিখ", en: "Date of Birth", aliases: ["জন্ম তারিখ", "date of birth", "dob", "birth date"] },
    { key: "gender", bn: "লিঙ্গ", en: "Gender", aliases: ["gender", "sex", "ছেলে/মেয়ে", "ছেলেমেয়ে"] },
    { key: "blood_group", bn: "রক্তের গ্রুপ", en: "Blood Group", aliases: ["blood group", "blood"] },
    { key: "email", bn: "ইমেইল", en: "E-mail", aliases: ["ই-মেইল", "email", "e-mail", "email address"] },
    { key: "guardian_name", bn: "অভিভাবকের নাম", en: "Guardian's Name", aliases: ["guardian name", "guardian"] },
    { key: "guardian_mobile", bn: "অভিভাবকের মোবাইল", en: "Guardian's Mobile", aliases: ["অভিভাবকের মোবাইল নং", "অভিভাবকের মোবাইল নম্বর", "guardian mobile", "guardian phone", "guardian contact"] },
    { key: "address", bn: "ঠিকানা", en: "Address (full)", aliases: ["স্থায়ী ঠিকানা", "address", "permanent address"] },
    { key: "address_village", bn: "গ্রাম", en: "Village", aliases: ["village"] },
    { key: "address_post", bn: "ডাকঘর", en: "Post", aliases: ["পোস্ট", "post", "post office"] },
    { key: "address_thana", bn: "থানা", en: "Thana", aliases: ["উপজেলা", "thana", "upazila"] },
    { key: "address_zila", bn: "জেলা", en: "Zila", aliases: ["zila", "district"] },
    { key: "status", bn: "অবস্থা", en: "Status", aliases: ["status"] },
    { key: "admission_date", bn: "ভর্তির তারিখ", en: "Admission Date", aliases: ["admission date"] },
    { key: "photo_file", bn: "ছবির ফাইলের নাম", en: "Photo file name", aliases: ["ছবি", "ছবির নাম", "photo", "photo file"], ignored: true }
  ];
  var FIELD_BY_KEY = {};
  IMPORT_FIELDS.forEach(function (f) { FIELD_BY_KEY[f.key] = f; f.keys = [f.bn, f.en].concat(f.aliases).map(importKey); });
  // the app's export order (also the template order)
  var IMPORT_TEMPLATE_KEYS = ["name_bn", "name_en", "registration_no", "class_roll", "program", "session", "year_of_study", "study_group", "mobile", "date_of_birth",
    "blood_group", "gender", "email", "father_name", "mother_name", "father_name_en", "mother_name_en", "guardian_name", "guardian_mobile",
    "address_village", "address_post", "address_thana", "address_zila", "status", "admission_date"];

  // headings -> {fieldKey: columnIndex}. Exact names first, then the longest known name contained in a heading.
  function autoMapHeaders(headers) {
    var result = {}, used = {}, keys = (headers || []).map(importKey), i, j, k, f;
    for (i = 0; i < keys.length; i++) {
      if (!keys[i]) continue;
      for (j = 0; j < IMPORT_FIELDS.length; j++) {
        f = IMPORT_FIELDS[j];
        if (!(f.key in result) && f.keys.indexOf(keys[i]) >= 0) { result[f.key] = i; used[i] = true; break; }
      }
    }
    for (i = 0; i < keys.length; i++) {
      var h = String(headers[i] == null ? "" : headers[i]);
      if (!keys[i] || keys[i].length > 40 || h.trim().split(/\s+/).length > 5 || h.indexOf("।") >= 0 || used[i]) continue;   // a sentence is not a heading
      var best = null, bestLen = 2;
      for (j = 0; j < IMPORT_FIELDS.length; j++) {
        f = IMPORT_FIELDS[j];
        if (f.key in result) continue;
        for (k = 0; k < f.keys.length; k++) if (f.keys[k].length > bestLen && keys[i].indexOf(f.keys[k]) >= 0) { best = f; bestLen = f.keys[k].length; }
      }
      if (best) { result[best.key] = i; used[i] = true; }
    }
    return result;
  }

  function isBlankRow(cells) {
    for (var i = 0; i < (cells || []).length; i++) if (cleanCell(cells[i])) return false;
    return true;
  }
  // The header row = the one among the first 15 rows that matches the most known headings; else the first non-empty row. -1 if the file is empty.
  function findHeaderRow(grid) {
    var best = 0, idx = -1, i;
    for (i = 0; i < grid.length && i < 15; i++) {
      var n = Object.keys(autoMapHeaders((grid[i] || []).map(cleanCell))).length;
      if (n > best) { best = n; idx = i; }
    }
    if (idx < 0) for (i = 0; i < grid.length; i++) if (!isBlankRow(grid[i])) { idx = i; break; }
    return idx;
  }
  function countDataRows(grid, headerIdx) {
    var n = 0;
    for (var i = headerIdx + 1; i < grid.length; i++) if (!isBlankRow(grid[i])) n += 1;
    return n;
  }

  // ---- CSV ----
  function detectDelimiter(s) {
    var inQ = false, c = { ",": 0, ";": 0, "\t": 0 };
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '"') inQ = !inQ;
      else if (!inQ && (ch === "\n" || ch === "\r")) { if (c[","] + c[";"] + c["\t"] > 0) break; }
      else if (!inQ && ch in c) c[ch] += 1;
    }
    return c[";"] > c[","] && c[";"] >= c["\t"] ? ";" : c["\t"] > c[","] ? "\t" : ",";
  }
  // text -> array of rows (array of strings). BOM, quotes, "" escapes, commas / new lines inside quotes, CRLF / CR / LF. Blank lines are kept (row numbers).
  function parseCsv(text) {
    var s = String(text == null ? "" : text);
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    var delim = detectDelimiter(s), rows = [], row = [], cur = "", inQ = false, i = 0, n = s.length, ch;
    while (i < n) {
      ch = s.charAt(i);
      if (inQ) {
        if (ch === '"') {
          if (s.charAt(i + 1) === '"') { cur += '"'; i += 2; continue; }
          inQ = false; i += 1; continue;
        }
        cur += ch; i += 1; continue;
      }
      if (ch === '"' && cur === "") { inQ = true; i += 1; continue; }
      if (ch === delim) { row.push(cur); cur = ""; i += 1; continue; }
      if (ch === "\r" || ch === "\n") {
        if (ch === "\r" && s.charAt(i + 1) === "\n") i += 1;
        i += 1; row.push(cur); rows.push(row); row = []; cur = ""; continue;
      }
      cur += ch; i += 1;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  function csvCell(v) {
    var s = String(v == null ? "" : v);
    if (/^[=@\t\r]/.test(s) || /^[+\-][^0-9.]/.test(s)) s = "'" + s;   // a spreadsheet must not run it as a formula
    return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows) { return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n") + "\r\n"; }

  // a number cell of an .xlsx file -> text without 1.23E+9 (a registration number must stay whole)
  function numToText(n) {
    if (typeof n !== "number" || !isFinite(n)) return "";
    if (Math.abs(n) < 1e21 && Math.floor(n) === n) return n.toFixed(0);
    var t = String(+n.toPrecision(15));
    if (/e/i.test(t)) t = n.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
    return t;
  }

  // ---- cell parsers (ports of CellParsers in the app) ----
  function ymdValid(y, m, d) {
    if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return { y: y, m: m, d: d };
  }
  function pad2(n) { return ("0" + n).slice(-2); }
  // dd/mm/yyyy (also d-m-yyyy, dd.mm.yyyy), yyyy-mm-dd, or an Excel day number (>= 10000) -> {y,m,d,iso} or null
  function parseImportDate(s) {
    var t = asciiDigits(cleanCell(s)), a, p = null;
    if (!t) return null;
    if ((a = /^(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})$/.exec(t))) p = ymdValid(+a[3], +a[2], +a[1]);
    else if ((a = /^(\d{4})-(\d{1,2})-(\d{1,2})([T ].*)?$/.exec(t))) p = ymdValid(+a[1], +a[2], +a[3]);
    else if ((a = /^(\d{5})(\.\d+)?$/.exec(t))) {
      var dt = new Date(Date.UTC(1899, 11, 30) + (+a[1]) * 86400000);
      p = ymdValid(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
    if (!p) return null;
    return { y: p.y, m: p.m, d: p.d, iso: p.y + "-" + pad2(p.m) + "-" + pad2(p.d) };
  }
  // "২০২২-২৩", "2022-2023", "2022/23" -> "2022-23"; null if invalid
  function parseSession(s) {
    var t = asciiDigits(cleanCell(s)), m = /^(\d{4})\s*[-–\/]\s*(\d{2}|\d{4})$/.exec(t);
    if (!m) return null;
    var start = +m[1], endText = m[2], end = +endText;
    var ok = endText.length === 2 ? end === (start + 1) % 100 : end === start + 1;
    if (!ok || start < 1950 || start > 2200) return null;
    return start + "-" + pad2((start + 1) % 100);
  }
  function wordMap(groups) {
    var o = {};
    Object.keys(groups).forEach(function (val) { groups[val].forEach(function (w) { o[importKey(w)] = val; }); });
    return o;
  }
  var GROUPS = wordMap({
    major: ["মেজর", "major", "honours", "honors", "অনার্স"],
    non_major: ["নন-মেজর", "ননমেজর", "non-major", "non major", "nonmajor", "non_major"],
    degree: ["ডিগ্রী", "ডিগ্রি", "degree", "pass", "degree (pass)", "ডিগ্রি (পাস)", "পাস কোর্স"]
  });
  var GENDERS = wordMap({ male: ["male", "m", "boy", "ছেলে"], female: ["female", "f", "girl", "মেয়ে"] });
  var STATUSES = wordMap({
    active: ["active", "অধ্যয়নরত", "চলমান", "নিয়মিত", "regular", "running"],
    graduated: ["graduated", "পাস করেছে", "পাস", "উত্তীর্ণ", "passed"],
    left: ["left", "চলে গেছে", "ঝরে পড়া", "dropout", "drop out", "বাদ"]
  });
  var YEARS = wordMap({
    1: ["1", "1st", "first", "প্রথম", "১ম", "1ম"], 2: ["2", "2nd", "second", "দ্বিতীয়", "২য়", "2য়"], 3: ["3", "3rd", "third", "তৃতীয়", "৩য়", "3য়"],
    4: ["4", "4th", "fourth", "চতুর্থ", "৪র্থ", "4র্থ"], 5: ["5", "5th", "fifth", "পঞ্চম", "৫ম", "5ম"], 6: ["6", "6th", "sixth", "ষষ্ঠ", "৬ষ্ঠ", "6ষ্ঠ"]
  });
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null; }
  function parseGroup(s) { return own(GROUPS, importKey(s)); }
  function parseGender(s) { return own(GENDERS, importKey(s)); }
  function parseStatus(s) { return own(STATUSES, importKey(s)); }
  function parseYear(s) { var v = own(YEARS, importKey(s).replace(/(year|বর্ষ)$/, "")); return v == null ? null : +v; }
  var BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  function parseBloodGroup(s) {
    var t = cleanCell(s).toUpperCase().replace(/ /g, "");
    t = t.replace(/এবি/g, "AB").replace(/বি/g, "B").replace(/এ/g, "A").replace(/ও/g, "O")
      .replace(/\(?(POSITIVE|POS|\+VE|VE\+)\)?/g, "+").replace(/\(?(NEGATIVE|NEG|-VE|−VE)\)?/g, "-").replace(/−/g, "-");
    if (t.charAt(0) === "0") t = "O" + t.slice(1);
    return BLOOD.indexOf(t) >= 0 ? t : null;
  }
  function validEmail(s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s); }
  // 2022-23 in 2026 -> 4th year
  function guessYear(session, maxYears, today) {
    var start = parseInt(String(session).split("-")[0], 10);
    var y = (today instanceof Date ? today : new Date()).getFullYear();
    if (isNaN(start)) start = y;
    return Math.min(Math.max(y - start, 1), Math.min(Math.max(maxYears || 6, 1), 6));
  }

  var ADDR_LABEL = /^(গ্রামের নাম|গ্রাম|village|vill|ডাকঘর|ডাক|পোস্ট|পোষ্ট|post office|post|p\.?\s?o|থানা|উপজেলা|thana|upazila|p\.?\s?s|জেলা|zilla|zila|district|dist)(?:\s*[:ঃ.\-]\s*|\s+)(.+)$/i;
  // "গ্রাম: X, ডাকঘর: Y, থানা: Z, জেলা: W" or "X, Y, Z, W" -> {village, post, thana, zila}
  function parseAddress(s) {
    var parts = cleanCell(s).split(/[,،;\n]/).map(function (p) { return p.trim(); }).filter(Boolean);
    var v = null, po = null, th = null, zi = null, un = [];
    function join(a, b) { return a == null ? b : a + ", " + b; }
    parts.forEach(function (p) {
      var m = ADDR_LABEL.exec(p), val = m ? m[2].trim() : "";
      if (!m || !val) { un.push(p); return; }
      var label = importKey(m[1]);
      if (label.indexOf("গ্র") === 0 || label.indexOf("vill") === 0) v = join(v, val);
      else if (label.indexOf("ডা") === 0 || label.indexOf("পো") === 0 || (label.charAt(0) === "p" && label !== "ps")) po = join(po, val);
      else if (label.indexOf("থা") === 0 || label.indexOf("উপ") === 0 || label.indexOf("tha") === 0 || label.indexOf("upa") === 0 || label === "ps") th = join(th, val);
      else zi = join(zi, val);
    });
    if (un.length && zi == null && (un.length >= 2 || v != null)) zi = un.pop();
    un.forEach(function (p) {
      if (v == null) v = p; else if (po == null) po = p; else if (th == null) th = p; else v = v + ", " + p;
    });
    return { village: v, post: po, thana: th, zila: zi };
  }

  // ---- checking the rows ----
  var SQL_ERR_BN = "এই সারিটি যুক্ত করা যায়নি";
  function rowsBn(list) { return "সারি " + list.map(bn).join(", "); }

  // grid: array of rows of strings; mapping: from autoMapHeaders. ctx: {programs:[{name,name_bn,duration_years}]|null, batches:[{program,session,year_of_study}],
  // defaultBatch:{program,session,year_of_study}|null, existing:{reg: isDeleted}|null (null = could not look up), today:Date}.
  // Returns {rows:[{rowNumber, reg, name, ok, issues:[{error, code, field, msg}], payload, raw}], newBatches:[{program,session,year,count}]}.
  function buildImportRows(grid, headerIdx, mapping, ctx) {
    ctx = ctx || {};
    var today = ctx.today instanceof Date ? ctx.today : new Date();
    var td = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    var programs = ctx.programs, existing = ctx.existing || null, def = ctx.defaultBatch || null;
    var known = {};
    (ctx.batches || []).forEach(function (b) { known[b.program + "|" + b.session] = b.year_of_study; });
    var rows = [], byReg = {}, newB = {};

    function findProgram(text) {
      var k = importKey(text);
      if (!k || !programs) return null;
      for (var i = 0; i < programs.length; i++) {
        if (importKey(programs[i].name) === k || (programs[i].name_bn && importKey(programs[i].name_bn) === k)) return programs[i];
      }
      return null;
    }

    for (var gi = headerIdx + 1; gi < grid.length; gi++) {
      var cells = grid[gi] || [];
      if (isBlankRow(cells)) continue;
      rows.push(oneRow(cells, gi + 1));
    }

    function oneRow(cells, rowNumber) {
      var issues = [], vals = {}, raw = {};
      function text(key) { return mapping[key] == null ? "" : cleanCell(cells[mapping[key]]); }
      function err(code, field, msg) { issues.push({ error: true, code: code, field: field, msg: msg }); }
      function warn(code, field, msg) { issues.push({ error: false, code: code, field: field, msg: msg }); }
      Object.keys(mapping).forEach(function (k) { var t = text(k); if (t && !FIELD_BY_KEY[k].ignored) raw[k] = t; });
      function put(k, v) { if (v) vals[k] = v; }

      var regText = text("registration_no"), reg = regNo(regText);
      if (/^\d+(\.\d+)?e[+\-]?\d+$/i.test(reg)) err("sci", "registration_no", "রেজিস্ট্রেশন নম্বর বিজ্ঞানী সংখ্যায় (E+) বদলে গেছে — ঘরটি Text করে নম্বর আবার লিখুন");
      else if (!reg) err("missing_reg", "registration_no", "রেজিস্ট্রেশন নম্বর নেই");
      else if (reg.length > 30) err("long_reg", "registration_no", "রেজিস্ট্রেশন নম্বর খুব লম্বা");

      var isNew = existing ? !Object.prototype.hasOwnProperty.call(existing, reg) : null;
      if (existing && isNew === false && existing[reg] === true) err("deleted", "registration_no", "এই শিক্ষার্থী মুছে ফেলা আছে — আগে অ্যাপ থেকে ফিরিয়ে আনতে হবে");

      var nameEn = text("name_en");
      if (!nameEn) {
        if (isNew === true) err("missing_name", "name_en", "ইংরেজি নাম নেই (নতুন শিক্ষার্থীর জন্য লাগবে)");
        else if (isNew === null) warn("missing_name", "name_en", "ইংরেজি নাম নেই — নতুন শিক্ষার্থী হলে যুক্ত হবে না");
      }
      put("name_en", nameEn);
      ["name_bn", "father_name", "mother_name", "father_name_en", "mother_name_en", "guardian_name"].forEach(function (k) { put(k, text(k)); });
      put("class_roll", regNo(text("class_roll")));

      var mt = text("mobile");
      if (!mt) {
        if (isNew === true) err("missing_mobile", "mobile", "মোবাইল নম্বর নেই (নতুন শিক্ষার্থীর জন্য লাগবে)");
        else if (isNew === null) warn("missing_mobile", "mobile", "মোবাইল নম্বর নেই — নতুন শিক্ষার্থী হলে যুক্ত হবে না");
      } else {
        var m = normMobile(mt);
        if (!/^01[0-9]{9}$/.test(m)) err("bad_mobile", "mobile", "মোবাইল নম্বর সঠিক নয়: " + mt);
        else { vals.mobile = m; if (!/^01[3-9]/.test(m)) warn("mobile_prefix", "mobile", "মোবাইল নম্বর ০১৩–০১৯ দিয়ে শুরু হয় না: " + mt); }
      }
      var gm = text("guardian_mobile");
      if (gm) {
        var g2 = normMobile(gm);
        if (!/^01[0-9]{9}$/.test(g2)) err("bad_gmobile", "guardian_mobile", "অভিভাবকের মোবাইল নম্বর সঠিক নয়: " + gm);
        else vals.guardian_mobile = g2;
      }

      // program / session / year (a missing part is taken from the default batch)
      var pt = text("program"), st = text("session"), yt = text("year_of_study"), program = null, session = null, year = null, usedDef = false;
      if (pt) {
        if (!programs) err("programs_unknown", "program", "প্রোগ্রামের তালিকা আনা যায়নি — পাতা আবার খুলুন");
        else { var pr = findProgram(pt); if (pr) program = pr.name; else err("unknown_program", "program", "প্রোগ্রাম চেনা যায়নি: " + pt); }
      }
      if (st) { session = parseSession(st); if (!session) err("bad_session", "session", "শিক্ষাবর্ষ সঠিক নয় (যেমন 2025-26): " + st); }
      if (yt) { year = parseYear(yt); if (year == null) err("bad_year", "year_of_study", "বর্ষ সঠিক নয়: " + yt); }
      if (def) {
        if (!pt && !program) { program = def.program; usedDef = true; }
        if (!st && !session) { session = def.session; usedDef = true; }
      }
      var hasBatch = false;
      if (program && session) hasBatch = true;
      else if (program || session) { if (!hasErr("unknown_program") && !hasErr("programs_unknown") && !hasErr("bad_session")) err("half_batch", program ? "session" : "program", "প্রোগ্রাম ও শিক্ষাবর্ষ দুটোই লাগবে"); }
      else if (!pt && !st && isNew !== false) warn("no_batch", "program", "ব্যাচ দেওয়া নেই — নতুন শিক্ষার্থী হলে ব্যাচ ছাড়া যুক্ত হবে");
      function hasErr(code) { return issues.some(function (i) { return i.code === code; }); }

      var batchYear = null, key = null;
      if (hasBatch) {
        key = program + "|" + session;
        if (Object.prototype.hasOwnProperty.call(known, key)) batchYear = known[key];
        else {
          var pgm = programs ? findProgram(program) : null;
          batchYear = year || (usedDef && def && def.year_of_study ? def.year_of_study : guessYear(session, pgm ? pgm.duration_years : 6, today));
        }
      }

      function date(k) {
        var t = text(k);
        if (!t) return;
        var d = parseImportDate(t);
        if (!d || d.y * 10000 + d.m * 100 + d.d > td) err("bad_date", k, (k === "date_of_birth" ? "জন্মতারিখ" : "ভর্তির তারিখ") + " সঠিক নয় (দিন/মাস/সাল): " + t);
        else vals[k] = d.iso;
      }
      date("date_of_birth"); date("admission_date");

      var gt = text("gender");
      if (gt) { var gv = parseGender(gt); if (gv) vals.gender = gv; else err("bad_gender", "gender", "লিঙ্গ বোঝা যায়নি (ছেলে / মেয়ে): " + gt); }
      var bt = text("blood_group");
      if (bt) { var bv = parseBloodGroup(bt); if (bv) vals.blood_group = bv; else err("bad_blood", "blood_group", "রক্তের গ্রুপ সঠিক নয়: " + bt); }
      var grt = text("study_group");
      if (grt) { var grv = parseGroup(grt); if (grv) vals.study_group = grv; else err("bad_group", "study_group", "গ্রুপ বোঝা যায়নি (মেজর / নন-মেজর / ডিগ্রী): " + grt); }
      var emt = text("email");
      if (emt) { if (validEmail(emt)) vals.email = emt.toLowerCase(); else err("bad_email", "email", "ইমেইল সঠিক নয়: " + emt); }
      var stt = text("status");
      if (stt) { var sv = parseStatus(stt); if (sv) vals.status = sv; else err("bad_status", "status", "অবস্থা বোঝা যায়নি (অধ্যয়নরত / পাস করেছে / চলে গেছে): " + stt); }

      var full = text("address"), pa = full ? parseAddress(full) : {};
      function pick(k, fromFull) { var o = text(k); return o || fromFull || ""; }
      put("address_village", pick("address_village", pa.village)); put("address_post", pick("address_post", pa.post));
      put("address_thana", pick("address_thana", pa.thana)); put("address_zila", pick("address_zila", pa.zila));

      var payload = { row: rowNumber, registration_no: reg };
      Object.keys(vals).forEach(function (k) { payload[k] = vals[k]; });
      if (hasBatch && !issues.some(function (i) { return i.error; })) { payload.program = program; payload.session = session; payload.year_of_study = batchYear; }
      var r = { rowNumber: rowNumber, reg: reg, name: nameEn || text("name_bn"), issues: issues, payload: payload, raw: raw, batchKey: hasBatch ? key : null, batchYear: batchYear };
      if (reg) (byReg[reg] = byReg[reg] || []).push(r);
      return r;
    }

    Object.keys(byReg).forEach(function (reg) {
      var g = byReg[reg];
      if (g.length < 2) return;
      g.forEach(function (r) {
        var others = g.filter(function (o) { return o !== r; }).map(function (o) { return o.rowNumber; });
        r.issues.push({ error: true, code: "dup_in_file", field: "registration_no", msg: "এই রেজিস্ট্রেশন নম্বর ফাইলে একাধিকবার আছে (" + rowsBn(others) + ")" });
      });
    });
    rows.forEach(function (r) {
      r.ok = !r.issues.some(function (i) { return i.error; });
      if (r.ok && r.batchKey && !Object.prototype.hasOwnProperty.call(known, r.batchKey)) {
        var p = r.batchKey.split("|");
        var nb = newB[r.batchKey] = newB[r.batchKey] || { program: p[0], session: p[1], year: r.batchYear, count: 0 };
        nb.count += 1;
      }
    });
    return { rows: rows, newBatches: Object.keys(newB).map(function (k) { return newB[k]; }) };
  }

  function chunkList(list, n) {
    var out = [];
    n = n > 0 ? n : IMPORT_CHUNK;
    for (var i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
    return out;
  }

  // One server answer for one row ({status:'error', code, message} or status deleted) -> a short Bangla reason. Raw SQL text is never shown.
  function importErrorBn(item) {
    var code = String(item && item.code || ""), msg = String(item && item.message || "");
    if (item && item.status === "deleted") return "এই শিক্ষার্থী মুছে ফেলা আছে — আগে অ্যাপ থেকে ফিরিয়ে আনতে হবে";
    if (code === "42501") return "এই কাজের অনুমতি নেই";
    if (code === "23502") {
      if (/registration_no/.test(msg)) return "রেজিস্ট্রেশন নম্বর নেই";
      if (/mobile/.test(msg)) return "মোবাইল নম্বর নেই (নতুন শিক্ষার্থীর জন্য লাগবে)";
      if (/name_en/.test(msg)) return "ইংরেজি নাম নেই (নতুন শিক্ষার্থীর জন্য লাগবে)";
      return "একটি দরকারি ঘর ফাঁকা";
    }
    if (code === "23514") {
      if (/guardian_mobile/.test(msg)) return "অভিভাবকের মোবাইল নম্বর সঠিক নয়";
      if (/mobile/.test(msg)) return "মোবাইল নম্বর সঠিক নয়";
      if (/name_en/.test(msg)) return "ইংরেজি নাম ফাঁকা থাকতে পারবে না";
      if (/email/.test(msg)) return "ইমেইল সঠিক নয়";
      if (/blood/.test(msg)) return "রক্তের গ্রুপ সঠিক নয়";
      if (/study_group/.test(msg)) return "গ্রুপ সঠিক নয়";
      if (/gender/.test(msg)) return "লিঙ্গ সঠিক নয়";
      if (/status/.test(msg)) return "অবস্থা সঠিক নয়";
      if (/date_of_birth/.test(msg)) return "জন্মতারিখ সঠিক নয়";
      return "একটি ঘরের মান নিয়ম মানছে না";
    }
    if (code === "23505") return "এই রেজিস্ট্রেশন নম্বর বা রোল নম্বর আগে থেকেই অন্য কারও আছে";
    if (code === "23P01") return "এই রোল নম্বর ব্যাচে আগে থেকেই আছে";
    if (code === "23503") return "প্রোগ্রাম বা ব্যাচ ডাটাবেসে পাওয়া যায়নি";
    if (/^22/.test(code)) return "কোনো ঘরের মান ভুল ধরনের (সংখ্যা বা তারিখ)";
    return SQL_ERR_BN;
  }

  var TEMPLATE_HEADS = IMPORT_TEMPLATE_KEYS.map(function (k) { return FIELD_BY_KEY[k].bn; });
  // the template: the app's headings + 2 obviously fake rows
  function importTemplateCsv() {
    var a = { name_bn: "নমুনা এক", name_en: "Sample One", registration_no: "990000001", class_roll: "1", program: "B.Sc (Honours)", session: "2025-26", year_of_study: "1",
      study_group: "মেজর", mobile: "01700000001", date_of_birth: "01/01/2006", blood_group: "A+", gender: "ছেলে", email: "sample1@example.com",
      father_name: "নমুনা পিতা", mother_name: "নমুনা মাতা", father_name_en: "Sample Father", mother_name_en: "Sample Mother", guardian_name: "নমুনা পিতা",
      guardian_mobile: "01700000011", address_village: "নমুনা গ্রাম", address_post: "নমুনা", address_thana: "রংপুর সদর", address_zila: "রংপুর", status: "অধ্যয়নরত", admission_date: "15/07/2025" };
    var b = { name_bn: "নমুনা দুই", name_en: "Sample Two", registration_no: "990000002", class_roll: "2", program: "B.Sc (Honours)", session: "2025-26", year_of_study: "1",
      study_group: "মেজর", mobile: "01700000002", date_of_birth: "02/02/2006", blood_group: "O+", gender: "মেয়ে", email: "",
      father_name: "নমুনা পিতা দুই", mother_name: "নমুনা মাতা দুই", father_name_en: "", mother_name_en: "", guardian_name: "নমুনা মাতা দুই",
      guardian_mobile: "01700000012", address_village: "নমুনা গ্রাম", address_post: "", address_thana: "রংপুর সদর", address_zila: "রংপুর", status: "অধ্যয়নরত", admission_date: "15/07/2025" };
    return toCsv([TEMPLATE_HEADS].concat([a, b].map(function (o) { return IMPORT_TEMPLATE_KEYS.map(function (k) { return o[k] || ""; }); })));
  }

  // items: [{rowNumber, raw, reason}] -> CSV with the template headings (+ the full-address column if it was used) + the reason. Fix and upload again.
  function failedRowsCsv(items) {
    var keys = IMPORT_TEMPLATE_KEYS.slice(), hasAddr = items.some(function (i) { return i.raw && i.raw.address; });
    if (hasAddr) keys.push("address");
    var head = keys.map(function (k) { return FIELD_BY_KEY[k].bn; }).concat(["ত্রুটির কারণ", "ফাইলের সারি"]);
    return toCsv([head].concat(items.map(function (i) {
      return keys.map(function (k) { return (i.raw && i.raw[k]) || ""; }).concat([i.reason || "", String(i.rowNumber)]);
    })));
  }

  return {
    IMPORT_MAX_BYTES: IMPORT_MAX_BYTES, IMPORT_MAX_ROWS: IMPORT_MAX_ROWS, IMPORT_CHUNK: IMPORT_CHUNK, IMPORT_FIELDS: IMPORT_FIELDS, IMPORT_TEMPLATE_KEYS: IMPORT_TEMPLATE_KEYS,
    importKey: importKey, cleanCell: cleanCell, normMobile: normMobile, autoMapHeaders: autoMapHeaders, findHeaderRow: findHeaderRow, countDataRows: countDataRows,
    isBlankRow: isBlankRow, parseCsv: parseCsv, toCsv: toCsv, numToText: numToText, parseImportDate: parseImportDate, parseSession: parseSession,
    parseGroup: parseGroup, parseGender: parseGender, parseStatus: parseStatus, parseYear: parseYear, parseBloodGroup: parseBloodGroup, parseAddress: parseAddress,
    guessYear: guessYear, buildImportRows: buildImportRows, chunkList: chunkList, importErrorBn: importErrorBn, importTemplateCsv: importTemplateCsv,
    failedRowsCsv: failedRowsCsv, bnNum: bn,
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
