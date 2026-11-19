// node test.js : quick check of validate.js
const V = require("./validate.js");
const assert = require("assert");
const r = V.rules;
const y = new Date().getFullYear();
assert.ok(r.reg_no("12ab45")); assert.ok(r.reg_no("12")); assert.strictEqual(r.reg_no("১২৩৪৫৬"), "");
assert.ok(r.name_en("Name 1")); assert.ok(r.name_en("নাম")); assert.strictEqual(r.name_en("Md. Rahim-Uddin"), "");
assert.strictEqual(r.name_bn(""), ""); assert.ok(r.name_bn("নাম ১"));
assert.ok(r.father_name("")); assert.ok(r.father_name("A")); assert.ok(r.mother_name("<b>x</b>"));
assert.strictEqual(r.roll_no(""), ""); assert.ok(r.roll_no("1a"));
assert.ok(r.mobile("0171234567")); assert.ok(r.mobile("01212345678")); assert.strictEqual(r.mobile("+8801712345678"), ""); assert.strictEqual(r.mobile("০১৭১২৩৪৫৬৭৮"), "");
assert.ok(r.dob("")); assert.ok(r.dob(`${y + 1}-01-01`)); assert.ok(r.dob("2023-02-31")); assert.ok(r.dob(`${y - 10}-01-01`)); assert.ok(r.dob(`${y - 50}-01-01`));
assert.strictEqual(r.dob(`${y - 20}-06-15`), ""); assert.strictEqual(r.dob(`15/06/${y - 20}`), "");
assert.ok(r.gender("")); assert.strictEqual(r.gender("male"), "");
assert.ok(r.blood_group("C+")); assert.strictEqual(r.blood_group("b +"), ""); assert.strictEqual(r.blood_group(""), "");
assert.ok(r.village("")); assert.strictEqual(r.post_office(""), ""); assert.ok(r.district("x".repeat(121)));
assert.ok(r.program("", { needProgram: true })); assert.strictEqual(r.program("", { needProgram: false }), "");
const all = V.validateAll({}, {});
["reg_no", "name_en", "father_name", "mother_name", "session", "mobile", "dob", "gender", "guardian_name", "guardian_mobile", "village", "thana", "district"]
  .forEach((k) => assert.ok(all[k], k));
["name_bn", "roll_no", "blood_group", "post_office"].forEach((k) => assert.ok(!all[k], k));
console.log("validate.js OK");

// ---------------- lib.js (the public site helpers) ----------------
const S = require("./lib.js");
assert.strictEqual(S.bnDigits("12/05/2026 ab"), "১২/০৫/২০২৬ ab");
assert.strictEqual(S.bnDigits(null), "");
// 18:30 UTC on 31 Dec is already 1 Jan in Bangladesh (UTC+6)
assert.strictEqual(S.formatDate("2026-12-31T18:30:00Z"), "০১/০১/২০২৭");
assert.strictEqual(S.formatDate("2026-03-05T00:00:00+00:00"), "০৫/০৩/২০২৬");
assert.strictEqual(S.formatDate("nonsense"), ""); assert.strictEqual(S.formatDate(null), "");
assert.strictEqual(S.formatSize(null), ""); assert.strictEqual(S.formatSize(-1), ""); assert.strictEqual(S.formatSize(512), "৫১২ B");
assert.strictEqual(S.formatSize(1536), "১.৫ KB"); assert.strictEqual(S.formatSize(3 * 1024 * 1024), "৩.০ MB");
const U = "https://abc.supabase.co/";
assert.strictEqual(S.fileUrl(U, "notices/a b.pdf"), "");   // a space is not a valid path
assert.strictEqual(S.fileUrl(U, "notices/a.pdf"), "https://abc.supabase.co/storage/v1/object/public/site-public/notices/a.pdf");
["../x.pdf", "/abs.pdf", "a//b.pdf", "a/../b", "javascript:alert(1)", "", null, 5, "a".repeat(301)].forEach((p) => assert.strictEqual(S.fileUrl(U, p), "", String(p)));
assert.strictEqual(S.fileUrl("", "a.pdf"), "");
assert.strictEqual(S.safeHttpUrl("https://example.com/x?y=1"), "https://example.com/x?y=1");
["javascript:alert(1)", "ftp://x.com", "https://", "https://a b.com", "https://x.com/\"onclick", "//evil.com", "data:text/html,x", "", null, "https://nodot"].forEach((u) => assert.strictEqual(S.safeHttpUrl(u), "", String(u)));
assert.strictEqual(S.safeEmail("a@b.com"), "a@b.com"); assert.strictEqual(S.safeEmail("a@b"), ""); assert.strictEqual(S.safeEmail("<x>@b.com"), "");
assert.strictEqual(S.telHref("০১৭১২-৩৪৫৬৭৮"), "tel:01712345678"); assert.strictEqual(S.telHref("+880 1712 345678"), "tel:+8801712345678");
assert.strictEqual(S.telHref("12"), ""); assert.strictEqual(S.telHref(null), "");
assert.strictEqual(S.safeHref("notices.html?id=1"), "notices.html?id=1"); assert.strictEqual(S.safeHref("mailto:a@b.com"), "mailto:a@b.com");
["javascript:alert(1)", " javascript:alert(1)", "data:x", "//evil.com", "/abs", "a:b", "vbscript:x", "mailto:nope"].forEach((u) => assert.strictEqual(S.safeHref(u), "", u));

// markdown: structure
assert.deepStrictEqual(S.parseMarkdown("# Title\n\npara one\nline two\n\n- a\n- b\n\n1. x\n2) y\n\n---\n### Small"),
  [{ t: "h", level: 2, text: "Title" }, { t: "p", text: "para one\nline two" }, { t: "ul", items: ["a", "b"] }, { t: "ol", items: ["x", "y"] }, { t: "hr" }, { t: "h", level: 4, text: "Small" }]);
assert.deepStrictEqual(S.parseMarkdown(""), []); assert.deepStrictEqual(S.parseMarkdown(null), []);
assert.deepStrictEqual(S.parseMarkdown("a\r\n\r\nb"), [{ t: "p", text: "a" }, { t: "p", text: "b" }]);
// markdown: a script tag stays plain text (the renderer only ever uses textContent)
assert.deepStrictEqual(S.parseMarkdown("<script>alert(1)</script>"), [{ t: "p", text: "<script>alert(1)</script>" }]);
assert.deepStrictEqual(S.parseInline("a **b** *c* [d](https://x.com) e"),
  [{ t: "text", v: "a " }, { t: "strong", v: "b" }, { t: "text", v: " " }, { t: "em", v: "c" }, { t: "text", v: " " }, { t: "a", v: "d", href: "https://x.com" }, { t: "text", v: " e" }]);
// a javascript: link becomes plain text, never a link
assert.ok(S.parseInline("[click](javascript:alert(1))").every((t) => t.t === "text"));   // plain text only, no link token
assert.deepStrictEqual(S.parseInline("x\ny"), [{ t: "text", v: "x" }, { t: "br" }, { t: "text", v: "y" }]);
assert.ok(S.parseInline("<img src=x onerror=alert(1)>").every((t) => t.t === "text"));

// paging
assert.deepStrictEqual(S.pageInfo(25, 10, 0), { page: 1, pages: 3, hasPrev: false, hasNext: true });
assert.deepStrictEqual(S.pageInfo(25, 10, 20), { page: 3, pages: 3, hasPrev: true, hasNext: false });
assert.deepStrictEqual(S.pageInfo(0, 10, 0), { page: 1, pages: 1, hasPrev: false, hasNext: false });
assert.strictEqual(S.pageInfo(25, 10, 999).page, 3);
assert.deepStrictEqual(S.pageNumbers(1, 3), [1, 2, 3]);
assert.deepStrictEqual(S.pageNumbers(10, 20), [1, "…", 8, 9, 10, 11, 12, "…", 20]);
assert.deepStrictEqual(S.pageNumbers(1, 1), [1]);

// misc
assert.ok(S.isUuid("123e4567-e89b-12d3-a456-426614174000")); assert.ok(!S.isUuid("123")); assert.ok(!S.isUuid("'; drop table x;--"));
assert.deepStrictEqual(S.parseQuery("?cat=%E0%A6%AD&page=2&x"), { cat: "ভ", page: "2", x: "" });
assert.deepStrictEqual(S.parseQuery("?a=%E0%A6"), {});   // a broken escape is ignored, not thrown
assert.strictEqual(S.buildQuery({ cat: "", page: "2" }), "?page=2"); assert.strictEqual(S.buildQuery({ cat: "", page: "" }), "");
assert.strictEqual(S.buildQuery({ cat: "a b" }), "?cat=a%20b");
assert.strictEqual(S.initials("ড. রহিম উদ্দিন"), "রউ"); assert.strictEqual(S.initials("Md. Karim Ali"), "KA"); assert.strictEqual(S.initials(""), "");
assert.ok(/সাড়া/.test(S.errorMessage({ name: "AbortError" }))); assert.ok(/সার্ভারে সমস্যা/.test(S.errorMessage(new Error("http 503"))));
assert.ok(/ইন্টারনেট/.test(S.errorMessage(new TypeError("Failed to fetch"))));
console.log("lib.js OK");

// ---------------- admin/helpers.js (the admin panel's pure helpers) ----------------
const H = require("./admin/helpers.js");
// file names
assert.strictEqual(H.extOf("A.B.PDF"), "pdf"); assert.strictEqual(H.extOf("noext"), ""); assert.strictEqual(H.extOf(null), "");
assert.strictEqual(H.sanitizeFileName("My File (1).PDF"), "my-file-1");
assert.strictEqual(H.sanitizeFileName("রিপোর্ট.pdf"), "file");               // only Bangla -> fallback
assert.strictEqual(H.sanitizeFileName("../../etc/passwd.png"), "passwd");     // no folders
assert.strictEqual(H.sanitizeFileName("C:\\fakepath\\ছবি 12.jpg"), "12");
assert.strictEqual(H.sanitizeFileName("café-menü.jpg"), "cafe-menu");          // accents are transliterated by NFKD
assert.strictEqual(H.sanitizeFileName("a".repeat(100) + ".jpg").length, 40);
assert.strictEqual(H.sanitizeFileName(""), "file"); assert.strictEqual(H.sanitizeFileName(null), "file");
assert.strictEqual(H.sanitizeFileName("---.pdf"), "file");
// paths
const D = new Date(Date.UTC(2026, 10, 20, 5, 0, 0));
assert.strictEqual(H.yyyymm(D), "202611"); assert.strictEqual(H.yyyymm(new Date(Date.UTC(2027, 0, 1))), "202701");
const U1 = "123e4567-e89b-12d3-a456-426614174000";
assert.strictEqual(H.buildPath("notices", D, U1, "Exam Routine (final).PDF", "pdf"), "notices/202611/" + U1 + "-exam-routine-final.pdf");
assert.strictEqual(H.buildPath("gallery", D, U1, "ছবি.jpg", "jpg"), "gallery/202611/" + U1 + "-file.jpg");
["notices", "people", "gallery", "downloads", "pages"].forEach((a) => assert.ok(H.isValidPath(H.buildPath(a, D, U1, "x y", "png")), a));
assert.throws(() => H.buildPath("etc", D, U1, "a", "pdf")); assert.throws(() => H.buildPath("notices", D, U1, "a", "exe"));
assert.throws(() => H.buildPath("notices", D, "", "a", "pdf")); assert.throws(() => H.buildPath("notices", D, "../..", "a", "pdf"));
{
  const p = H.buildPath("downloads", D, U1, "z".repeat(500), "xlsx");
  assert.ok(p.length <= 300 && H.isValidPath(p) && p.endsWith(".xlsx"));
}
["../x.pdf", "/abs.pdf", "a//b.pdf", "a/../b", "a b.pdf", "", null, 5, "a".repeat(301), "ছবি.jpg"].forEach((p) => assert.ok(!H.isValidPath(p), String(p)));
assert.ok(H.isValidPath("a".repeat(300)));
// real type check (magic bytes)
const JPG = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10], PNG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50], PDF = [0x25, 0x50, 0x44, 0x46, 0x2D], ZIP = [0x50, 0x4B, 3, 4, 0];
assert.strictEqual(H.sniffType(JPG), "jpg"); assert.strictEqual(H.sniffType(PNG), "png"); assert.strictEqual(H.sniffType(WEBP), "webp");
assert.strictEqual(H.sniffType(PDF), "pdf"); assert.strictEqual(H.sniffType(ZIP), "zip"); assert.strictEqual(H.sniffType([1, 2, 3, 4]), "");
assert.strictEqual(H.sniffType(null), ""); assert.strictEqual(H.sniffType([0xFF]), "");
const ok1 = H.classifyFile({ name: "a.JPG", size: 1000, type: "image/jpeg" }, JPG, "image");
assert.deepStrictEqual(ok1, { ok: true, ext: "jpg", kind: "image", mime: "image/jpeg" });
assert.strictEqual(H.classifyFile({ name: "a.jpeg", size: 10, type: "" }, JPG, "any").ext, "jpg");
assert.ok(H.classifyFile({ name: "a.docx", size: 10, type: "" }, ZIP, "file").ok);
assert.ok(H.classifyFile({ name: "a.xlsx", size: 10, type: "application/octet-stream" }, ZIP, "any").ok);
assert.ok(!H.classifyFile({ name: "evil.jpg", size: 10, type: "image/jpeg" }, PDF, "image").ok);          // a PDF renamed to .jpg
assert.ok(!H.classifyFile({ name: "evil.pdf", size: 10, type: "application/pdf" }, JPG, "file").ok);
assert.ok(!H.classifyFile({ name: "a.exe", size: 10, type: "" }, JPG, "any").ok);
assert.ok(!H.classifyFile({ name: "a.svg", size: 10, type: "image/svg+xml" }, JPG, "any").ok);
assert.ok(!H.classifyFile({ name: "a.pdf", size: 10, type: "" }, PDF, "image").ok);                       // not an image
assert.ok(!H.classifyFile({ name: "a.jpg", size: 10, type: "" }, JPG, "file").ok);
assert.ok(!H.classifyFile({ name: "a.jpg", size: 0, type: "" }, JPG, "any").ok);
assert.ok(!H.classifyFile({ name: "a.jpg", size: 10 * 1024 * 1024 + 1, type: "" }, JPG, "any").ok);
assert.ok(H.classifyFile({ name: "a.jpg", size: 10 * 1024 * 1024, type: "" }, JPG, "any").ok);
assert.ok(!H.classifyFile({ name: "a.png", size: 10, type: "image/jpeg" }, PNG, "any").ok);                // wrong browser MIME
assert.ok(/MB/.test(H.classifyFile({ name: "a.jpg", size: 11 * 1024 * 1024, type: "" }, JPG, "any").error));
// image size math
assert.deepStrictEqual(H.fitDimensions(3200, 1600), { w: 1600, h: 800, scaled: true });
assert.deepStrictEqual(H.fitDimensions(1200, 4800), { w: 400, h: 1600, scaled: true });
assert.deepStrictEqual(H.fitDimensions(1600, 1600), { w: 1600, h: 1600, scaled: false });
assert.deepStrictEqual(H.fitDimensions(800, 600), { w: 800, h: 600, scaled: false });                    // never enlarged
assert.deepStrictEqual(H.fitDimensions(0, 5), { w: 0, h: 0, scaled: false });
assert.deepStrictEqual(H.fitDimensions(5000, 1), { w: 1600, h: 1, scaled: true });
assert.ok(H.keepOriginalImage(1000, 800, 200 * 1024)); assert.ok(!H.keepOriginalImage(1000, 800, 900 * 1024)); assert.ok(!H.keepOriginalImage(2000, 800, 1000));
// Dhaka <-> UTC
assert.strictEqual(H.dhakaLocalToIso("2026-11-20T14:30"), "2026-11-20T08:30:00.000Z");
assert.strictEqual(H.dhakaLocalToIso("2026-11-20T03:00"), "2026-11-19T21:00:00.000Z");                    // previous UTC day
assert.strictEqual(H.dhakaLocalToIso("2026-01-01T00:00"), "2025-12-31T18:00:00.000Z");
["", null, "2026-11-20", "2026-02-31T10:00", "2026-11-20T24:00", "x"].forEach((v) => assert.strictEqual(H.dhakaLocalToIso(v), null, String(v)));
assert.strictEqual(H.isoToDhakaLocal("2026-11-20T08:30:00.000Z"), "2026-11-20T14:30");
assert.strictEqual(H.isoToDhakaLocal("2025-12-31T18:00:00+00:00"), "2026-01-01T00:00");
assert.strictEqual(H.isoToDhakaLocal("2026-03-05T12:00:00+06:00"), "2026-03-05T12:00");
assert.strictEqual(H.isoToDhakaLocal(""), ""); assert.strictEqual(H.isoToDhakaLocal("nonsense"), ""); assert.strictEqual(H.isoToDhakaLocal(null), "");
["2026-11-20T14:30", "2026-01-01T00:00", "2026-12-31T23:59"].forEach((v) => assert.strictEqual(H.isoToDhakaLocal(H.dhakaLocalToIso(v)), v, v));   // round trip
assert.strictEqual(H.nowDhakaLocal(Date.UTC(2026, 10, 20, 8, 30)), "2026-11-20T14:30");
// payloads
{
  const r = H.noticeToPayload({ id: "i1", title: " Exam ", category: "", body: "x\ny", publish_at: "2026-11-20T14:30", expires_at: "", pinned: 1, is_published: "", attachment_path: "" });
  assert.deepStrictEqual(r.payload, { title: "Exam", category: "সাধারণ", body: "x\ny", expires_at: null, pinned: true, is_published: false, attachment_path: null, publish_at: "2026-11-20T08:30:00.000Z", id: "i1" });
  assert.ok(!("id" in H.noticeToPayload({ title: "a" }).payload)); assert.ok(!("publish_at" in H.noticeToPayload({ title: "a" }).payload));
  assert.ok(H.noticeToPayload({ title: "  " }).error);
  assert.ok(H.noticeToPayload({ title: "a", publish_at: "2026-11-20T14:30", expires_at: "2026-11-20T14:30" }).error);
  assert.ok(H.noticeToPayload({ title: "a", publish_at: "2026-11-20T14:30", expires_at: "2026-11-20T14:31" }).payload);
  assert.ok(H.noticeToPayload({ title: "a", publish_at: "garbage" }).error);
}
assert.ok(H.personToPayload({ kind: "x", name: "a" }).error); assert.ok(H.personToPayload({ kind: "staff", name: " " }).error);
assert.deepStrictEqual(H.personToPayload({ kind: "teacher", name: " A ", designation: " Prof ", bio: " b ", email_public: " ", photo_path: "", is_published: 1 }).payload,
  { kind: "teacher", name: "A", designation: "Prof", bio: "b", email_public: null, photo_path: null, is_published: true });
assert.ok(H.galleryToPayload({ title: "t" }).error);
assert.deepStrictEqual(H.galleryToPayload({ id: "g", image_path: "gallery/a.jpg", title: " t ", album: " Trip ", caption: "", is_published: true }).payload,
  { title: "t", caption: "", album: "Trip", image_path: "gallery/a.jpg", is_published: true, id: "g" });
assert.ok(H.downloadToPayload({ title: "", file_path: "a.pdf" }).error); assert.ok(H.downloadToPayload({ title: "t" }).error);
assert.strictEqual(H.downloadToPayload({ title: "t", file_path: "a.pdf", file_size: 12 }).payload.file_size, 12);
assert.ok(!("file_size" in H.downloadToPayload({ title: "t", file_path: "a.pdf" }).payload));
assert.ok(H.isValidSlug("about") && H.isValidSlug("a-1") && !H.isValidSlug("A") && !H.isValidSlug("-a") && !H.isValidSlug("a_b") && !H.isValidSlug("") && !H.isValidSlug("a".repeat(61)));
assert.ok(H.pageToPayload({ slug: "Bad Slug", title: "t" }).error); assert.ok(H.pageToPayload({ slug: "ok", title: "" }).error);
assert.deepStrictEqual(H.pageToPayload({ slug: " About ", title: "T", body_md: "# x", is_published: 1 }).payload, { slug: "about", title: "T", body_md: "# x", is_published: true });
// submissions
{
  const row = { id: "x", status: "pending", reg_no: "123", name_bn: null, name_en: "A B", roll_no: null, father_name: "F", mother_name: "M", session: "2022-23", year_of_study: 2,
    program: "BSc", mobile: "01711111111", dob: "2003-05-06", gender: "male", blood_group: null, guardian_name: "G", guardian_mobile: "01811111111",
    address_village: "V", address_post: null, address_thana: "T", address_zila: "Z" };
  const f = H.submissionToForm(row);
  assert.deepStrictEqual(Object.keys(f).sort(), H.SUB_KEYS.slice().sort());
  assert.strictEqual(f.village, "V"); assert.strictEqual(f.district, "Z"); assert.strictEqual(f.post_office, ""); assert.strictEqual(f.year_of_study, "2"); assert.strictEqual(f.name_bn, "");
  assert.ok(!("id" in f) && !("status" in f));
  assert.strictEqual(H.formToSubmission(Object.assign({}, f, { name_en: " A B ", evil: "x" })).name_en, "A B");
  assert.ok(!("evil" in H.formToSubmission({ evil: 1 })));
}
// routes
assert.deepStrictEqual(H.parseRoute(""), { name: "dashboard", arg: "" }); assert.deepStrictEqual(H.parseRoute("#/"), { name: "dashboard", arg: "" });
assert.deepStrictEqual(H.parseRoute("#/notices"), { name: "notices", arg: "" }); assert.deepStrictEqual(H.parseRoute("#/notices/new"), { name: "notices", arg: "new" });
assert.deepStrictEqual(H.parseRoute("#/pages/about?x=1"), { name: "pages", arg: "about" });
assert.deepStrictEqual(H.parseRoute("#/nope/1"), { name: "dashboard", arg: "" });
assert.deepStrictEqual(H.parseRoute("#/notices/%3Cscript%3E"), { name: "notices", arg: "" }); assert.deepStrictEqual(H.parseRoute("#/notices/%E0%A6"), { name: "notices", arg: "" });
assert.deepStrictEqual(H.parseRoute("#/notices/" + U1), { name: "notices", arg: U1 }); assert.deepStrictEqual(H.parseRoute(null), { name: "dashboard", arg: "" });
// list helpers
assert.deepStrictEqual(H.moveItem(["a", "b", "c"], 1, -1), ["b", "a", "c"]); assert.deepStrictEqual(H.moveItem(["a", "b", "c"], 1, 1), ["a", "c", "b"]);
assert.deepStrictEqual(H.moveItem(["a", "b"], 0, -1), ["a", "b"]); assert.deepStrictEqual(H.moveItem(["a", "b"], 1, 1), ["a", "b"]); assert.deepStrictEqual(H.moveItem(["a"], 5, 1), ["a"]);
{ const src = ["a", "b"]; H.moveItem(src, 0, 1); assert.deepStrictEqual(src, ["a", "b"]); }
assert.strictEqual(H.fileKey({ name: "a", size: 1, lastModified: 2 }), "a|1|2");
assert.deepStrictEqual(H.uniqueValues([" a ", "b", "a", "", null, "b"]), ["a", "b"]);
assert.strictEqual(H.uploadSummary(8, 7), "৮টির মধ্যে ৭টি যুক্ত হয়েছে"); assert.strictEqual(H.uploadSummary(12, 0), "১২টির মধ্যে ০টি যুক্ত হয়েছে");
console.log("admin/helpers.js OK");
