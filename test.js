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
// pictures: the REAL type decides (a JPEG named icon.png is accepted and stored as jpg), documents stay strict
{
  const a = H.classifyFile({ name: "icon.png", size: 1000, type: "image/png" }, JPG, "image");     // what a browser reports for icon.png
  assert.deepStrictEqual(a, { ok: true, ext: "jpg", kind: "image", mime: "image/jpeg" });
  const b = H.classifyFile({ name: "photo.jpg", size: 1000, type: "image/jpeg" }, PNG, "image");
  assert.deepStrictEqual(b, { ok: true, ext: "png", kind: "image", mime: "image/png" });
  assert.deepStrictEqual(H.classifyFile({ name: "x.jpeg", size: 10, type: "" }, WEBP, "any"), { ok: true, ext: "webp", kind: "image", mime: "image/webp" });
  assert.deepStrictEqual(H.classifyFile({ name: "icon.png", size: 10, type: "" }, JPG, "any"), { ok: true, ext: "jpg", kind: "image", mime: "image/jpeg" });
  assert.ok(!H.classifyFile({ name: "doc.png", size: 10, type: "image/png" }, PDF, "image").ok);                       // a PDF named .png
  assert.ok(!H.classifyFile({ name: "note.png", size: 10, type: "image/png" }, [0x68, 0x65, 0x6C, 0x6C, 0x6F, 0x20], "image").ok);   // text named .png
  assert.ok(!H.classifyFile({ name: "x.png", size: 10, type: "image/png" }, ZIP, "any").ok);                           // a zip named .png
  assert.ok(!H.classifyFile({ name: "icon.png", size: 10, type: "application/pdf" }, JPG, "any").ok);                  // browser type is something else
  assert.ok(!H.classifyFile({ name: "a.pdf", size: 10, type: "" }, ZIP, "any").ok);                                    // pdf / docx / xlsx: extension must match
  assert.ok(!H.classifyFile({ name: "a.docx", size: 10, type: "" }, PDF, "any").ok);
  assert.ok(!H.classifyFile({ name: "a.xlsx", size: 10, type: "" }, JPG, "any").ok);
  assert.ok(!H.classifyFile({ name: "a.pdf", size: 10, type: "" }, JPG, "any").ok);
  // the corrected extension is what the storage path uses
  assert.strictEqual(H.buildPath("gallery", D, U1, "icon.png", a.ext), "gallery/202611/" + U1 + "-icon.jpg");
}
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

// ---------------- student import (CSV / Excel): admin/helpers.js + the menu / route wiring ----------------
const fs = require("fs"), path = require("path");
{
  // headings (same names and aliases as the Flutter app)
  assert.strictEqual(H.importKey("Registration No"), "registrationno");
  assert.strictEqual(H.importKey("  রেজিস্ট্রেশন   নং "), H.importKey("রেজিস্ট্রেশন নং"));
  assert.strictEqual(H.importKey("ডিগ্রী"), H.importKey("ডিগ্রি"));
  assert.strictEqual(H.importKey("১ম"), "1ম");
  assert.strictEqual(H.importKey("য়"), H.importKey("য়"));                  // য় written two ways
  assert.deepStrictEqual(H.autoMapHeaders(["Registration No", "Name (English)", "মোবাইল নং", "Foo", "ঠিকানা"]), { registration_no: 0, name_en: 1, mobile: 2, address: 4 });
  assert.deepStrictEqual(H.autoMapHeaders(["reg no", "নাম", "Phone", "DOB", "Sex", "Blood Group"]), { registration_no: 0, name_bn: 1, mobile: 2, date_of_birth: 3, gender: 4, blood_group: 5 });
  {   // the app's own export headings all map back to their field
    const heads = H.IMPORT_TEMPLATE_KEYS.map((k) => H.IMPORT_FIELDS.find((f) => f.key === k).bn);
    const m = H.autoMapHeaders(heads);
    H.IMPORT_TEMPLATE_KEYS.forEach((k, i) => assert.strictEqual(m[k], i, k));
    const m2 = H.autoMapHeaders(H.IMPORT_TEMPLATE_KEYS.map((k) => H.IMPORT_FIELDS.find((f) => f.key === k).en));
    H.IMPORT_TEMPLATE_KEYS.forEach((k, i) => assert.strictEqual(m2[k], i, "en " + k));
  }
  assert.strictEqual(H.findHeaderRow([["রিপোর্ট"], [], ["Registration No", "Name", "Mobile"], ["1", "a", "b"]]), 2);
  assert.strictEqual(H.findHeaderRow([]), -1); assert.strictEqual(H.findHeaderRow([["", ""], ["x"]]), 1);
  assert.strictEqual(H.countDataRows([["h"], [""], ["a"], [" "], ["b"]], 0), 2);

  // CSV reader / writer
  assert.deepStrictEqual(H.parseCsv("﻿a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);
  assert.deepStrictEqual(H.parseCsv('a,"b,c",d\n"x ""q"" y","l1\nl2",z'), [["a", "b,c", "d"], ['x "q" y', "l1\nl2", "z"]]);
  assert.deepStrictEqual(H.parseCsv("a;b\n1;2"), [["a", "b"], ["1", "2"]]);
  assert.deepStrictEqual(H.parseCsv("a,b\n\n1,2"), [["a", "b"], [""], ["1", "2"]]);
  assert.deepStrictEqual(H.parseCsv("a,b\r1,2"), [["a", "b"], ["1", "2"]]);
  assert.deepStrictEqual(H.parseCsv("a,b,"), [["a", "b", ""]]);
  assert.deepStrictEqual(H.parseCsv(""), []); assert.deepStrictEqual(H.parseCsv(null), []);
  assert.deepStrictEqual(H.parseCsv("০০১২৩,নাম\n"), [["০০১২৩", "নাম"]]);             // text stays text
  assert.strictEqual(H.toCsv([["a", "b,c"], ['x "q"', ""]]), 'a,"b,c"\r\n"x ""q""",\r\n');
  assert.strictEqual(H.toCsv([["=1+1", "+8801712345678", "-x", "ok", " pad"]]), "'=1+1,+8801712345678,'-x,ok,\" pad\"\r\n");   // no formulas
  assert.deepStrictEqual(H.parseCsv(H.toCsv([["a", 'b "c", d\ne']])), [["a", 'b "c", d\ne']]);
  // numbers from an .xlsx cell
  assert.strictEqual(H.numToText(990000001), "990000001"); assert.strictEqual(H.numToText(1234567890123), "1234567890123");
  assert.strictEqual(H.numToText(1.5), "1.5"); assert.strictEqual(H.numToText(0.1 + 0.2), "0.3"); assert.strictEqual(H.numToText(NaN), "");
  assert.ok(!/e/i.test(H.numToText(9.90000001e8)));

  // cell rules
  assert.strictEqual(H.normMobile("০১৭১২৩৪৫৬৭৮"), "01712345678"); assert.strictEqual(H.normMobile("+880 1712-345678"), "01712345678");
  assert.strictEqual(H.normMobile("1712345678"), "01712345678"); assert.strictEqual(H.normMobile("0123"), "0123");
  assert.strictEqual(H.parseImportDate("15/07/2025").iso, "2025-07-15"); assert.strictEqual(H.parseImportDate("১৫-০৭-২০২৫").iso, "2025-07-15");
  assert.strictEqual(H.parseImportDate("2025-7-5").iso, "2025-07-05"); assert.strictEqual(H.parseImportDate("2025-07-15T00:00:00").iso, "2025-07-15");
  assert.strictEqual(H.parseImportDate("37631").iso, "2003-01-10");                                       // Excel day number
  ["31/02/2020", "32/01/2020", "2005", "", "abc", "1899-01-01", "13/13/2020"].forEach((v) => assert.strictEqual(H.parseImportDate(v), null, v));
  assert.strictEqual(H.parseSession("২০২২-২৩"), "2022-23"); assert.strictEqual(H.parseSession("2022-2023"), "2022-23"); assert.strictEqual(H.parseSession("2022/23"), "2022-23");
  ["2022-24", "2022", "1900-01", "", "abc"].forEach((v) => assert.strictEqual(H.parseSession(v), null, v));
  assert.strictEqual(H.parseGender("Male"), "male"); assert.strictEqual(H.parseGender(" F "), "female"); assert.strictEqual(H.parseGender("ছেলে"), "male");
  assert.strictEqual(H.parseGender("x"), null); assert.strictEqual(H.parseGender(""), null); assert.strictEqual(H.parseGender("constructor"), null);
  assert.strictEqual(H.parseBloodGroup("a +"), "A+"); assert.strictEqual(H.parseBloodGroup("A positive"), "A+"); assert.strictEqual(H.parseBloodGroup("ab-"), "AB-");
  assert.strictEqual(H.parseBloodGroup("0+"), "O+"); assert.strictEqual(H.parseBloodGroup("O Negative"), "O-"); assert.strictEqual(H.parseBloodGroup("এ+"), "A+");
  assert.strictEqual(H.parseBloodGroup("C+"), null); assert.strictEqual(H.parseBloodGroup(""), null);
  assert.strictEqual(H.parseGroup("মেজর"), "major"); assert.strictEqual(H.parseGroup("Non-Major"), "non_major"); assert.strictEqual(H.parseGroup("ডিগ্রি"), "degree"); assert.strictEqual(H.parseGroup("xx"), null);
  assert.strictEqual(H.parseStatus("অধ্যয়নরত"), "active"); assert.strictEqual(H.parseStatus("Left"), "left"); assert.strictEqual(H.parseStatus("?"), null);
  assert.strictEqual(H.parseYear("২য়"), 2); assert.strictEqual(H.parseYear("2nd year"), 2); assert.strictEqual(H.parseYear("দ্বিতীয় বর্ষ"), 2);
  assert.strictEqual(H.parseYear("প্রথম"), 1); assert.strictEqual(H.parseYear("7"), null); assert.strictEqual(H.parseYear(""), null);
  assert.strictEqual(H.guessYear("2022-23", 4, new Date(2026, 10, 1)), 4); assert.strictEqual(H.guessYear("2025-26", 4, new Date(2026, 10, 1)), 1);
  assert.strictEqual(H.guessYear("2010-11", 4, new Date(2026, 10, 1)), 4); assert.strictEqual(H.guessYear("2022-23", 1, new Date(2026, 10, 1)), 1);
  assert.deepStrictEqual(H.parseAddress("গ্রাম: ক, ডাকঘর: খ, থানা: গ, জেলা: ঘ"), { village: "ক", post: "খ", thana: "গ", zila: "ঘ" });
  assert.deepStrictEqual(H.parseAddress("ক, খ, গ, ঘ"), { village: "ক", post: "খ", thana: "গ", zila: "ঘ" });
  assert.deepStrictEqual(H.parseAddress("Vill: A, PO: B, PS: C, Dist: D"), { village: "A", post: "B", thana: "C", zila: "D" });

  // checking rows
  const PROGS = [{ name: "B.Sc (Honours)", name_bn: "বিএসসি (অনার্স)", duration_years: 4 }, { name: "M.Sc", name_bn: "এমএসসি", duration_years: 1 }];
  const BATCHES = [{ program: "B.Sc (Honours)", session: "2022-23", year_of_study: 4 }];
  const TODAY = new Date(2026, 10, 20);
  const build = (csv, extra) => {
    const grid = H.parseCsv(csv), hi = H.findHeaderRow(grid);
    return H.buildImportRows(grid, hi, H.autoMapHeaders(grid[hi].map(H.cleanCell)), Object.assign({ programs: PROGS, batches: BATCHES, today: TODAY }, extra || {}));
  };
  const errCodes = (r) => r.issues.filter((i) => i.error).map((i) => i.code).sort();
  {   // the downloadable template passes its own checks
    const t = build(H.importTemplateCsv());
    assert.strictEqual(t.rows.length, 2);
    assert.ok(t.rows.every((r) => r.ok && r.issues.length === 0), JSON.stringify(t.rows.map((r) => r.issues)));
    assert.strictEqual(t.rows[0].reg, "990000001"); assert.strictEqual(t.rows[1].reg, "990000002");
    assert.deepStrictEqual(t.rows[0].payload, { row: 2, registration_no: "990000001", name_bn: "নমুনা এক", name_en: "Sample One", class_roll: "1", father_name: "নমুনা পিতা",
      mother_name: "নমুনা মাতা", father_name_en: "Sample Father", mother_name_en: "Sample Mother", guardian_name: "নমুনা পিতা", mobile: "01700000001", guardian_mobile: "01700000011",
      study_group: "major", date_of_birth: "2006-01-01", admission_date: "2025-07-15", gender: "male", blood_group: "A+", email: "sample1@example.com", status: "active",
      address_village: "নমুনা গ্রাম", address_post: "নমুনা", address_thana: "রংপুর সদর", address_zila: "রংপুর", program: "B.Sc (Honours)", session: "2025-26", year_of_study: 1 });
    assert.deepStrictEqual(t.newBatches, [{ program: "B.Sc (Honours)", session: "2025-26", year: 1, count: 2 }]);
    assert.strictEqual(t.rows[1].payload.gender, "female");
  }
  {   // Bangla digits, leading zeros, a mobile whose 0 was dropped, a program written in Bangla, local errors, duplicates
    const csv = [
      "রেজিস্ট্রেশন নং,Name (English),মোবাইল,জন্মতারিখ,লিঙ্গ,রক্তের গ্রুপ,শিক্ষাবর্ষ,প্রোগ্রাম",
      "০০১২৩,Rahim,০১৭১২৩৪৫৬৭৮,15/07/2005,ছেলে,a +,২০২২-২৩,B.Sc (Honours)",
      "001234,Karim,1712345679,2005-07-15,মেয়ে,O+,2022-23,এমএসসি",
      ",NoReg,01712345678,,,,,",
      "7777,Dup A,01712345678,,,,,",
      "7777,Dup B,01712345679,,,,,",
      "8888,Bad,0123,32/13/2005,x,Z+,2022-25,Unknown"
    ].join("\n");
    const b = build(csv);
    assert.deepStrictEqual(b.rows.map((r) => r.rowNumber), [2, 3, 4, 5, 6, 7]);
    assert.ok(b.rows[0].ok); assert.strictEqual(b.rows[0].reg, "00123");                                    // leading zeros kept
    assert.deepStrictEqual(b.rows[0].payload, { row: 2, registration_no: "00123", name_en: "Rahim", mobile: "01712345678", date_of_birth: "2005-07-15", gender: "male",
      blood_group: "A+", program: "B.Sc (Honours)", session: "2022-23", year_of_study: 4 });                  // known batch -> its own year
    assert.ok(b.rows[1].ok); assert.strictEqual(b.rows[1].payload.mobile, "01712345679"); assert.strictEqual(b.rows[1].payload.program, "M.Sc");
    assert.deepStrictEqual(b.newBatches, [{ program: "M.Sc", session: "2022-23", year: 1, count: 1 }]);
    assert.deepStrictEqual(errCodes(b.rows[2]), ["missing_reg"]);
    assert.deepStrictEqual(errCodes(b.rows[3]), ["dup_in_file"]); assert.deepStrictEqual(errCodes(b.rows[4]), ["dup_in_file"]);
    const dupMsg = (r) => r.issues.find((i) => i.code === "dup_in_file").msg;
    assert.ok(/সারি ৬/.test(dupMsg(b.rows[3])) && /সারি ৫/.test(dupMsg(b.rows[4])));
    assert.deepStrictEqual(errCodes(b.rows[5]), ["bad_blood", "bad_date", "bad_gender", "bad_mobile", "bad_session", "unknown_program"]);
    assert.ok(b.rows.slice(2).every((r) => !r.ok));
  }
  {   // a date in the future is wrong; today is fine
    const b = build("Registration No,Name (English),Mobile,Date of Birth\n1,A,01712345678,21/11/2026\n2,B,01712345678,20/11/2026");
    assert.deepStrictEqual(errCodes(b.rows[0]), ["bad_date"]); assert.ok(b.rows[1].ok);
  }
  {   // new vs existing students, soft-deleted ones, and when the lookup failed
    const csv = "Registration No,Name (English),Mobile\n100,Old Student,\n200,,\n300,New Guy,01712345678\n400,Gone,01712345678";
    const b = build(csv, { existing: { "100": false, "400": true } });
    assert.ok(b.rows[0].ok);                                                                               // existing: name / mobile may stay empty
    assert.deepStrictEqual(errCodes(b.rows[1]), ["missing_mobile", "missing_name"]);
    assert.ok(b.rows[2].ok); assert.deepStrictEqual(errCodes(b.rows[3]), ["deleted"]);
    const c = build(csv, { existing: null });
    assert.ok(c.rows[1].ok && c.rows[1].issues.length >= 2 && c.rows[1].issues.every((i) => !i.error));   // unknown: only a warning, the server decides
    assert.ok(!c.rows[3].issues.some((i) => i.code === "deleted"));
  }
  {   // batch: default batch, none, half
    const hdr = "Registration No,Name (English),Mobile";
    const d = build(hdr + "\n500,A,01712345678", { defaultBatch: { program: "B.Sc (Honours)", session: "2022-23", year_of_study: 4 } });
    assert.ok(d.rows[0].ok); assert.strictEqual(d.rows[0].payload.program, "B.Sc (Honours)"); assert.strictEqual(d.rows[0].payload.year_of_study, 4); assert.deepStrictEqual(d.newBatches, []);
    const n = build(hdr + "\n500,A,01712345678");
    assert.ok(n.rows[0].ok); assert.ok(!("program" in n.rows[0].payload)); assert.ok(n.rows[0].issues.some((i) => i.code === "no_batch" && !i.error));
    const h = build(hdr + ",Program\n600,A,01712345678,M.Sc");
    assert.deepStrictEqual(errCodes(h.rows[0]), ["half_batch"]);
    const k = build(hdr + ",Program,Session\n700,A,01712345678,M.Sc,2024-25"); assert.ok(k.rows[0].ok); assert.strictEqual(k.rows[0].payload.year_of_study, 1);
    const np = build(hdr + ",Program,Session\n700,A,01712345678,M.Sc,2024-25", { programs: null });
    assert.deepStrictEqual(errCodes(np.rows[0]), ["programs_unknown"]);                                      // never an unchecked program name
  }
  {   // registration numbers: Excel damage is caught, "123.0" is repaired, unknown columns are not sent
    const hdr = "Registration No,Name (English),Mobile";
    assert.deepStrictEqual(errCodes(build(hdr + "\n9.90000001E+8,A,01712345678").rows[0]), ["sci"]);
    assert.strictEqual(build(hdr + "\n123.0,A,01712345678").rows[0].reg, "123");
    assert.strictEqual(build(hdr + "\nab12,A,01712345678").rows[0].reg, "AB12");
    const u = build(hdr + ",Foo\n1,A,01712345678,secret");
    assert.deepStrictEqual(Object.keys(u.rows[0].payload).sort(), ["mobile", "name_en", "registration_no", "row"]);
    assert.deepStrictEqual(u.rows[0].raw, { registration_no: "1", name_en: "A", mobile: "01712345678" });
    const a = build(hdr + ",ঠিকানা\n1,A,01712345678,\"গ্রাম: ক, ডাকঘর: খ, থানা: গ, জেলা: ঘ\"");
    assert.strictEqual(a.rows[0].payload.address_village, "ক"); assert.strictEqual(a.rows[0].payload.address_zila, "ঘ");
    assert.ok(!("address" in a.rows[0].payload));
    assert.ok(build(hdr + "\n1,A,01712345678\n\n  ,  ,\n2,B,01712345679").rows.length === 2);                   // blank rows skipped, numbers kept
    assert.deepStrictEqual(build(hdr + "\n1,A,01712345678\n\n2,B,01712345679").rows.map((r) => r.rowNumber), [2, 4]);
  }
  // chunks and server errors
  assert.deepStrictEqual(H.chunkList([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]); assert.deepStrictEqual(H.chunkList([], 200), []);
  assert.strictEqual(H.chunkList(new Array(401).fill(0)).length, 3); assert.strictEqual(H.IMPORT_CHUNK, 200); assert.ok(H.IMPORT_CHUNK <= 500);
  assert.strictEqual(H.IMPORT_MAX_ROWS, 2000); assert.strictEqual(H.IMPORT_MAX_BYTES, 5 * 1024 * 1024);
  assert.ok(/মোবাইল/.test(H.importErrorBn({ status: "error", code: "23502", message: 'null value in column "mobile" of relation "students" violates not-null constraint' })));
  assert.strictEqual(H.importErrorBn({ status: "error", code: "23514", message: 'new row violates check constraint "students_mobile_check"' }), "মোবাইল নম্বর সঠিক নয়");
  assert.ok(/মুছে/.test(H.importErrorBn({ status: "deleted" })));
  assert.ok(/ভুল ধরনের/.test(H.importErrorBn({ status: "error", code: "22P02", message: 'invalid input syntax for type smallint: "abc"' })));
  {
    const g = H.importErrorBn({ status: "error", code: "XX000", message: "select * from secret_table where password" });
    assert.ok(!/select|secret|password/i.test(g) && /[ঀ-৿]/.test(g));                                         // unknown error: generic Bangla, never raw SQL
    assert.ok(/[ঀ-৿]/.test(H.importErrorBn(null)));
  }
  {   // failed rows -> CSV that can be fixed and uploaded again
    const text = H.failedRowsCsv([{ rowNumber: 5, raw: { registration_no: "123", name_en: "A, B", mobile: "0123" }, reason: "মোবাইল নম্বর সঠিক নয়" }]);
    const g = H.parseCsv(text);
    assert.strictEqual(g.length, 2); assert.strictEqual(g[0].length, H.IMPORT_TEMPLATE_KEYS.length + 2);
    const m = H.autoMapHeaders(g[0]);
    assert.strictEqual(g[1][m.registration_no], "123"); assert.strictEqual(g[1][m.name_en], "A, B"); assert.strictEqual(g[1][m.mobile], "0123");
    assert.ok(Object.values(m).every((i) => i < g[0].length - 2));                                           // the two extra columns are ignored on re-upload
    assert.strictEqual(g[1][g[0].length - 1], "5");
  }

  // wiring: menu = routes, the import entry follows the submissions entry, the script is loaded, SheetJS only lazily
  const adminSrc = fs.readFileSync(path.join(__dirname, "admin", "admin.js"), "utf8");
  const nav = Array.from(adminSrc.matchAll(/\["([a-z]+)", "[^"]+"\]/g)).map((m) => m[1]);
  assert.deepStrictEqual(nav, H.ROUTES);
  assert.strictEqual(H.ROUTES.indexOf("import"), H.ROUTES.indexOf("submissions") + 1);
  assert.deepStrictEqual(H.parseRoute("#/import"), { name: "import", arg: "" });
  const html = fs.readFileSync(path.join(__dirname, "admin", "index.html"), "utf8");
  assert.ok(html.indexOf('src="views-import.js"') > html.indexOf('src="views-other.js"') && html.indexOf('src="views-import.js"') < html.indexOf('src="admin.js"'));
  assert.ok(!/xlsx/i.test(html.replace(/views-import\.js/g, "")));                                            // SheetJS is not loaded on every page
  const impSrc = fs.readFileSync(path.join(__dirname, "admin", "views-import.js"), "utf8");
  // since Task 53 the SheetJS loader and the file reader live in the shared admin/sheet.js (used by the student import and the library import)
  const sheetSrc = fs.readFileSync(path.join(__dirname, "admin", "sheet.js"), "utf8");
  assert.ok(/xlsx@0\.18\.5\/dist\/xlsx\.full\.min\.js/.test(sheetSrc) && /sha384-[A-Za-z0-9+\/]{64}/.test(sheetSrc) && /cdn\.jsdelivr\.net\/npm\//.test(sheetSrc));
  assert.ok(!/xlsx@|sha384-|createElement\("script"\)/.test(impSrc));                                              // the student import has no loader of its own any more
  assert.ok(/A\.sheet\.readGrid/.test(impSrc) && /A\.sheet\.download/.test(impSrc));
  assert.ok(!/innerHTML|insertAdjacentHTML|document\.write|console\.|service_role|site-public/.test(impSrc + sheetSrc));      // no raw HTML, no logging of student data, no public bucket
  assert.ok(/V\["import"\]/.test(impSrc));
  assert.ok(html.indexOf('src="sheet.js"') > html.indexOf('src="core.js"') && html.indexOf('src="sheet.js"') < html.indexOf('src="views-library-import.js"') && html.indexOf('src="sheet.js"') < html.indexOf('src="views-import.js"'));
}
console.log("student import OK");

// ---------------- Task 53: head corner, museum, seminar library (admin helpers + wiring) ----------------
{
  const H = require("./admin/helpers.js");
  const fs = require("fs"), path = require("path");
  const UU = "123e4567-e89b-42d3-a456-426614174000";

  // upload area + routes
  assert.ok(H.AREAS.indexOf("museum") >= 0);
  const mp = H.buildPath("museum", new Date(Date.UTC(2026, 10, 20)), UU, "Photo 1.JPG", "jpg");
  assert.ok(/^museum\/202611\/123e4567-e89b-42d3-a456-426614174000-[a-z0-9-]+\.jpg$/.test(mp) && H.isValidPath(mp), mp);
  assert.throws(() => H.buildPath("library", new Date(), UU, "a.jpg", "jpg"));
  ["head", "museum", "library"].forEach((n) => assert.ok(H.ROUTES.indexOf(n) >= 0, n));
  assert.deepStrictEqual(H.parseRoute("#/head"), { name: "head", arg: "" });
  assert.deepStrictEqual(H.parseRoute("#/museum/new"), { name: "museum", arg: "new" });
  assert.deepStrictEqual(H.parseRoute("#/library/import"), { name: "library", arg: "import" });
  assert.deepStrictEqual(H.parseRoute("#/library/" + UU), { name: "library", arg: UU });
  assert.deepStrictEqual(H.parseRoute("#/library/%3Cscript%3E"), { name: "library", arg: "" });       // nothing odd from the hash is trusted
  assert.deepStrictEqual(H.parseRoute("#/library/a/b"), { name: "library", arg: "a" });
  assert.deepStrictEqual(H.parseRoute("#/nope"), { name: "dashboard", arg: "" });

  // head corner
  {
    const ok = H.headToArgs({ person_id: UU, title: "  বিভাগীয় প্রধানের   বাণী ", body_md: "  # শিরোনাম\r\nলেখা  ", publish: true });
    assert.deepStrictEqual(ok.args, { p_person_id: UU, p_title: "বিভাগীয় প্রধানের বাণী", p_body_md: "# শিরোনাম\nলেখা", p_publish: true });
    assert.strictEqual(H.headToArgs({ person_id: "", title: "t", body_md: "", publish: false }).args.p_person_id, null);       // no person is fine while not publishing
    assert.ok(/প্রধান বেছে নিন/.test(H.headToArgs({ person_id: "", title: "t", body_md: "b", publish: true }).error));        // publishing needs a person
    assert.ok(H.headToArgs({ person_id: "nope", title: "t" }).error);
    ["", "   ", null, undefined].forEach((t) => assert.ok(/শিরোনাম লিখুন/.test(H.headToArgs({ person_id: UU, title: t }).error)));
    assert.ok(H.headToArgs({ person_id: UU, title: "অ".repeat(200) }).args);
    assert.ok(/২০০/.test(H.headToArgs({ person_id: UU, title: "অ".repeat(201) }).error));
    assert.ok(H.headToArgs({ person_id: UU, title: "t", body_md: "আ".repeat(6000) }).args);
    assert.ok(/৬০০০/.test(H.headToArgs({ person_id: UU, title: "t", body_md: "আ".repeat(6001) }).error));
    assert.ok(H.headToArgs({ person_id: UU, title: "t", body_md: "😀".repeat(6000) }).args);                                   // characters, not UTF-16 units (the database counts characters)
    assert.ok(H.headToArgs({ person_id: UU, title: "t", body_md: "😀".repeat(6001) }).error);
    assert.ok(H.headToArgs().error);
    assert.strictEqual(H.chars("a😀ক"), 3);
  }

  // dates
  assert.ok(H.isoDateOk("2020-02-29", "2026-11-20") && H.isoDateOk("2026-11-20", "2026-11-20") && H.isoDateOk("1800-01-01", "2026-11-20"));
  ["2021-02-29", "2026-11-21", "1799-12-31", "20-1-1", "2020-13-01", "abc", "", null, "2020-1-01"].forEach((d) => assert.ok(!H.isoDateOk(d, "2026-11-20"), String(d)));
  assert.strictEqual(H.dhakaToday(Date.UTC(2026, 10, 20, 18, 30)), "2026-11-21");                                               // 18:30 UTC is already the next day in Dhaka

  // museum
  {
    const T = { today: "2026-11-20" };
    const ok = H.museumToPayload({ id: UU, title_bn: " প্রজাপতি ", title_en: "Butterfly  ", scientific_name: "Papilio demoleus", category: "পোকামাকড়", catalog_no: " M-001 ",
      description: "Line one\r\n\r\nLine two  ", collected_from: "রংপুর", collected_on: "2020-05-17", photo_path: "museum/202611/a.jpg", is_published: true, sort_order: "30" }, T);
    assert.strictEqual(ok.payload.title_bn, "প্রজাপতি"); assert.strictEqual(ok.payload.catalog_no, "M-001"); assert.strictEqual(ok.payload.description, "Line one\n\nLine two");
    assert.strictEqual(ok.payload.id, UU); assert.strictEqual(ok.payload.sort_order, 30); assert.strictEqual(ok.payload.is_published, true);
    const min = H.museumToPayload({ title_bn: "x" }, T).payload;
    assert.strictEqual(min.catalog_no, null); assert.strictEqual(min.collected_on, null); assert.strictEqual(min.photo_path, null); assert.strictEqual(min.is_published, false); assert.ok(!("id" in min) && !("sort_order" in min));
    assert.ok(/নাম \(বাংলা\)/.test(H.museumToPayload({ title_bn: "  " }, T).error));
    assert.ok(H.museumToPayload({ title_bn: "অ".repeat(200), title_en: "a".repeat(200), scientific_name: "a".repeat(200), category: "ক".repeat(60), catalog_no: "c".repeat(40),
      description: "d".repeat(3000), collected_from: "f".repeat(200) }, T).payload);
    [["title_bn", 201], ["title_en", 201], ["scientific_name", 201], ["category", 61], ["catalog_no", 41], ["description", 3001], ["collected_from", 201]].forEach(([k, n]) => {
      const f = { title_bn: "x" }; f[k] = "a".repeat(n);
      assert.ok(H.museumToPayload(f, T).error, k);
    });
    ["2026-11-21", "2020-02-31", "17/05/2020", "abc", "1700-01-01"].forEach((d) => assert.ok(/তারিখ/.test(H.museumToPayload({ title_bn: "x", collected_on: d }, T).error), d));
    assert.ok(H.museumToPayload({ title_bn: "x", collected_on: "2026-11-20" }, T).payload);
    ["a/../b.jpg", "a//b.jpg", "/abs.jpg", "a b.jpg", "javascript:alert(1)"].forEach((p) => assert.ok(/ছবির পথ/.test(H.museumToPayload({ title_bn: "x", photo_path: p }, T).error), p));
  }

  // library form
  {
    const ok = H.libraryToPayload({ id: UU, title: " Zoology  Vol 1 ", author: "A. Rahman", category: "পাঠ্যবই", publisher: "Pub", edition_year: "২০১৫", accession_no: " ACC-001 ", shelf: "A1", copies: "3", note: "ok", is_published: true });
    assert.deepStrictEqual(ok.payload, { title: "Zoology Vol 1", author: "A. Rahman", category: "পাঠ্যবই", publisher: "Pub", shelf: "A1", note: "ok", accession_no: "ACC-001", is_published: true, edition_year: 2015, copies: 3, id: UU });
    const min = H.libraryToPayload({ title: "x" }).payload;
    assert.strictEqual(min.edition_year, null); assert.strictEqual(min.copies, 1); assert.strictEqual(min.accession_no, null); assert.strictEqual(min.is_published, false);
    assert.ok(/শিরোনাম/.test(H.libraryToPayload({ title: " " }).error));
    assert.ok(H.libraryToPayload({ title: "t".repeat(300), author: "a".repeat(200), publisher: "p".repeat(200), category: "c".repeat(60), shelf: "s".repeat(40), note: "n".repeat(300), accession_no: "x".repeat(40) }).payload);
    [["title", 301], ["author", 201], ["publisher", 201], ["category", 61], ["shelf", 41], ["note", 301], ["accession_no", 41]].forEach(([k, n]) => {
      const f = { title: "x" }; f[k] = "a".repeat(n);
      assert.ok(H.libraryToPayload(f).error, k);
    });
    assert.strictEqual(H.libraryToPayload({ title: "x", edition_year: "1500" }).payload.edition_year, 1500);
    assert.strictEqual(H.libraryToPayload({ title: "x", edition_year: "2100" }).payload.edition_year, 2100);
    ["1499", "2101", "abc", "20.5", "-5", "0"].forEach((y) => assert.ok(/১৫০০ থেকে ২১০০/.test(H.libraryToPayload({ title: "x", edition_year: y }).error), y));
    assert.strictEqual(H.libraryToPayload({ title: "x", copies: "0" }).payload.copies, 0);
    assert.strictEqual(H.libraryToPayload({ title: "x", copies: "999" }).payload.copies, 999);
    ["1000", "-1", "x", "1.5"].forEach((c) => assert.ok(/৯৯৯/.test(H.libraryToPayload({ title: "x", copies: c }).error), c));
  }

  // library import: headings -> rows
  {
    const en = ["Title", "Author", "Category", "Publisher", "Edition Year", "Accession No", "Shelf", "Copies", "Note"];
    const m = H.autoMapLibHeaders(en);
    assert.deepStrictEqual(Object.keys(m).sort(), H.LIB_FIELDS.map((f) => f.key).sort());
    const bnHeads = ["শিরোনাম", "লেখক", "বিভাগ", "প্রকাশক", "প্রকাশের সাল", "সংগ্রহ নম্বর", "তাক", "কপি", "মন্তব্য"];
    assert.deepStrictEqual(Object.keys(H.autoMapLibHeaders(bnHeads)).sort(), H.LIB_FIELDS.map((f) => f.key).sort());
    const heads = ["ক্রম", "বইয়ের নাম", "Author", "বিভাগ", "Publisher", "সাল", "Accession No", "তাক", "কপি", "মন্তব্য"];
    const grid = [
      ["সেমিনার লাইব্রেরি তালিকা", "", "", "", "", "", "", "", "", ""],
      heads,
      ["1", "Zoology Vol 1", "A. Rahman", "পাঠ্যবই", "Pub", "2015", "ACC-1", "A1", "3", "ok"],
      ["2", "", "No title", "", "", "", "", "", "", ""],
      ["3", "Old book", "", "", "", "1200", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", ""],
      ["5", "Dup of one", "", "", "", "", "acc-1", "", "", ""],
      ["6", "Excel numbers", "", "", "", "2015.0", "ACC-2", "", "2.0", ""]
    ];
    const hi = H.findLibHeaderRow(grid);
    assert.strictEqual(hi, 1);
    const mapping = H.autoMapLibHeaders(grid[hi]);
    assert.ok(mapping.title === 1 && mapping.edition_year === 5 && mapping.accession_no === 6 && mapping.copies === 8, JSON.stringify(mapping));
    assert.strictEqual(H.countDataRows(grid, hi), 5);
    const built = H.buildLibraryRows(grid, hi, mapping);
    assert.deepStrictEqual(built.rows.map((r) => r.rowNumber), [3, 4, 5, 7, 8]);                                       // file row numbers; the blank row is skipped
    assert.deepStrictEqual(built.rows.map((r) => r.ok), [false, false, false, false, true]);
    assert.ok(built.rows[0].issues.some((i) => i.code === "dup_in_file" && /৭/.test(i.msg)) && built.rows[3].issues.some((i) => i.code === "dup_in_file" && /৩/.test(i.msg)));   // both rows of a repeated accession number are refused, any letter case
    assert.ok(built.rows[1].issues.some((i) => i.code === "missing_title"));
    assert.ok(built.rows[2].issues.some((i) => i.code === "bad_year"));
    assert.deepStrictEqual(built.rows[4].payload, { row: 8, title: "Excel numbers", edition_year: 2015, accession_no: "ACC-2", copies: 2 });   // empty cells are left out; Excel numbers repaired
    assert.strictEqual(built.rows[0].raw.title, "Zoology Vol 1");
    // long values
    const long = H.buildLibraryRows([["Title", "Author", "Copies"], ["t".repeat(301), "a".repeat(201), "1000"]], 0, H.autoMapLibHeaders(["Title", "Author", "Copies"])).rows[0];
    assert.ok(!long.ok && long.issues.length === 3);
    const okLong = H.buildLibraryRows([["Title", "Author"], ["t".repeat(300), "a".repeat(200)]], 0, H.autoMapLibHeaders(["Title", "Author"])).rows[0];
    assert.ok(okLong.ok);
    // Bangla digits in the year
    assert.strictEqual(H.buildLibraryRows([["Title", "Year"], ["x", "২০১৫"]], 0, H.autoMapLibHeaders(["Title", "Year"])).rows[0].payload.edition_year, 2015);
    // a file without a Title column
    assert.strictEqual(H.autoMapLibHeaders(["Author", "Year"]).title, undefined);
  }

  // the server's answer for one row -> Bangla, never SQL text
  {
    ["lib_title_required", "lib_too_long", "lib_bad_year", "lib_bad_copies", "lib_bad_number", "lib_dup_accession", "lib_bad_publish", "lib_bad_row"].forEach((c) => {
      const t = H.libImportErrorBn({ status: "error", code: c, message: "select * from secret" });
      assert.ok(/[ঀ-৿]/.test(t) && !/select|secret/i.test(t), c);
    });
    ["lib_invalid_row", "XX000", "", undefined, "constructor", "toString"].forEach((c) => {
      const t = H.libImportErrorBn({ status: "error", code: c, message: "ERROR: duplicate key value violates unique constraint site_library_accession_uq" });
      assert.ok(/[ঀ-৿]/.test(t) && !/duplicate|constraint|ERROR/i.test(t), String(c));
    });
    assert.ok(/[ঀ-৿]/.test(H.libImportErrorBn(null)));
  }

  // template and failed rows survive a round trip
  {
    const g = H.parseCsv(H.libraryTemplateCsv());
    assert.strictEqual(g.length, 3);
    const m = H.autoMapLibHeaders(g[0]);
    assert.strictEqual(Object.keys(m).length, H.LIB_FIELDS.length);
    const built = H.buildLibraryRows(g, 0, m);
    assert.strictEqual(built.rows.length, 2); assert.ok(built.rows.every((r) => r.ok));
    assert.strictEqual(built.rows[0].payload.edition_year, 2015); assert.strictEqual(built.rows[0].payload.copies, 2); assert.ok(!("publisher" in built.rows[1].payload) && !("edition_year" in built.rows[1].payload));
    const csv = H.libFailedRowsCsv([{ rowNumber: 5, raw: { title: "A, B", accession_no: "X-1", note: "=1+1" }, reason: "শিরোনাম নেই" }]);
    const f = H.parseCsv(csv), fm = H.autoMapLibHeaders(f[0]);
    assert.strictEqual(f.length, 2); assert.strictEqual(f[0].length, H.LIB_FIELDS.length + 2);
    assert.strictEqual(f[1][fm.title], "A, B"); assert.strictEqual(f[1][fm.accession_no], "X-1");
    assert.ok(f[1][fm.note].charAt(0) === "'");                                                                          // a cell that looks like a formula is defused
    assert.ok(Object.values(fm).every((i) => i < H.LIB_FIELDS.length));                                                  // the two extra columns are ignored on re-upload
    assert.strictEqual(f[1][f[0].length - 1], "5");
  }

  // wiring and safety of the new admin files
  {
    const dir = path.join(__dirname, "admin");
    const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
    const order = ["helpers.js", "core.js", "sheet.js", "views-content.js", "views-other.js", "views-site.js", "views-library.js", "views-library-import.js", "views-import.js", "admin.js"];
    order.forEach((f, i) => { assert.ok(html.indexOf('src="' + f + '"') > 0, f); if (i) assert.ok(html.indexOf('src="' + f + '"') > html.indexOf('src="' + order[i - 1] + '"'), f + " after " + order[i - 1]); });
    ["views-site.js", "views-library.js", "views-library-import.js", "sheet.js"].forEach((f) => {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|console\.|service_role|eval\(/.test(src), f);
    });
    const site = fs.readFileSync(path.join(dir, "views-site.js"), "utf8"), lib = fs.readFileSync(path.join(dir, "views-library.js"), "utf8"), imp = fs.readFileSync(path.join(dir, "views-library-import.js"), "utf8");
    assert.ok(/V\.head\s*=/.test(site) && /V\.museum\s*=/.test(site) && /V\.library\s*=/.test(lib) && /A\.libraryImport\s*=/.test(imp));
    assert.ok(/area: "museum"/.test(site));                                                                              // museum photos go to the museum/ area
    assert.ok(/site_head_set/.test(site) && /site_museum_reorder/.test(site) && /site_library_import/.test(imp) && /site_library_list/.test(lib));
    // the library import never shows what the server wrote, only a mapped Bangla text
    assert.ok(/libImportErrorBn/.test(imp) && !/\.message\b/.test(imp));
    // the control panel switch and the page links
    const other = fs.readFileSync(path.join(dir, "views-other.js"), "utf8");
    assert.ok(/site\.routine_public/.test(other) && /#\/pages\/museum/.test(other) && /#\/pages\/seminar-library/.test(other));
    // the three starting pages are protected from deletion in the pages screen
    const content = fs.readFileSync(path.join(dir, "views-content.js"), "utf8");
    assert.ok(/CORE_SLUGS = \[[^\]]*"head-message"[^\]]*"seminar-library"[^\]]*"museum"/.test(content));
  }
}
console.log("task 53 (head corner, museum, library) OK");

// ---------------- Task 54: public site redesign (pure helpers) ----------------
{
  const L = S;                                   // lib.js
  const FX = require("./test-fixtures.js");
  const vm = require("vm"), fs54 = require("fs"), path54 = require("path");

  // --- dates and times (Bangla digits, no time zone shifts for plain dates)
  assert.strictEqual(L.isoWeekday("2026-11-22"), 7);                                // Sunday
  assert.strictEqual(L.isoWeekday("2026-11-23"), 1);                                // Monday
  assert.strictEqual(L.isoWeekday("2026-11-20"), 5);                                // Friday
  assert.strictEqual(L.isoWeekday("2026-02-30"), 0); assert.strictEqual(L.isoWeekday("nonsense"), 0); assert.strictEqual(L.isoWeekday(null), 0);
  assert.strictEqual(L.formatDateOnly("2026-11-20"), "২০/১১/২০২৬"); assert.strictEqual(L.formatDateOnly("2025-03-05"), "০৫/০৩/২০২৫"); assert.strictEqual(L.formatDateOnly("x"), "");
  assert.strictEqual(L.formatLongDate("2026-11-20"), "২০ নভেম্বর ২০২৬, শুক্রবার");
  assert.strictEqual(L.formatLongDate("2026-01-01"), "১ জানুয়ারি ২০২৬, বৃহস্পতিবার");
  assert.strictEqual(L.formatLongDate("2026-11-22"), "২২ নভেম্বর ২০২৬, রবিবার"); assert.strictEqual(L.formatLongDate("bad"), "");
  assert.strictEqual(L.formatDayMonth("2026-12-05"), "৫ ডিসেম্বর");
  assert.strictEqual(L.formatTime("09:05"), "০৯:০৫"); assert.strictEqual(L.formatTime("9:05"), "০৯:০৫"); assert.strictEqual(L.formatTime("14:30:00"), "১৪:৩০");
  ["24:00", "09:60", "abc", "", null, 5].forEach((t) => assert.strictEqual(L.formatTime(t), "", String(t)));
  assert.strictEqual(L.formatTimeRange("09:00", "09:50"), "০৯:০০ – ০৯:৫০"); assert.strictEqual(L.formatTimeRange("09:00", "bad"), "০৯:০০"); assert.strictEqual(L.formatTimeRange("x", "y"), "");
  assert.strictEqual(L.weekdayName(7), "রবিবার"); assert.strictEqual(L.weekdayShort(1), "সোম"); assert.strictEqual(L.weekdayName(9), "");

  // --- routine: grouping by cell, exceptions, today rows, current period
  const R = FX.routine;
  assert.deepStrictEqual(L.sortedPeriods(R).map((p) => p.period_no), [1, 2, 3]);       // sorted although the server list was not
  const c72 = L.buildCell(R, 7, 2);
  assert.strictEqual(c72.length, 2);                                                  // two slots share a cell, both kept, in order
  assert.deepStrictEqual(c72.map((e) => e.slot.subject_code), ["ZOO-102", "ZOO-103P"]);
  assert.strictEqual(c72[0].today.kind, "substitute"); assert.strictEqual(c72[0].today.substitute_name, "জনাব হাসান"); assert.strictEqual(c72[1].today, null);
  const c71 = L.buildCell(R, 7, 1);
  assert.strictEqual(c71.length, 1); assert.strictEqual(c71[0].today.kind, "cancelled");
  assert.strictEqual(c71[0].notes.length, 2);                                         // today + the same weekday next week, both shown with their date
  assert.deepStrictEqual(c71[0].notes.map((n) => n.on_date), ["2026-11-22", "2026-11-29"]);
  assert.strictEqual(L.buildCell(R, 1, 1)[0].today, null);                            // Monday's cancellation is tomorrow, not today
  assert.strictEqual(L.buildCell(R, 1, 1)[0].notes[0].on_date, "2026-11-23");
  assert.strictEqual(L.buildCell(R, 7, 3).length, 0); assert.strictEqual(L.buildCell(null, 7, 3).length, 0); assert.strictEqual(L.buildCell({}, 1, 1).length, 0);
  // an exception that matches no slot becomes its own entry; one without a subject code applies to every slot of the cell
  const odd = Object.assign({}, R, { exceptions: [{ on_date: R.today, day: 7, period_no: 3, kind: "cancelled", subject_code: "ZOO-999", teacher_name: "X", substitute_name: null },
    { on_date: R.today, day: 7, period_no: 2, kind: "cancelled", subject_code: null, teacher_name: null, substitute_name: null }] });
  const o73 = L.buildCell(odd, 7, 3); assert.strictEqual(o73.length, 1); assert.strictEqual(o73[0].standalone, true); assert.strictEqual(o73[0].today.kind, "cancelled");
  assert.ok(L.buildCell(odd, 7, 2).every((e) => e.today && e.today.kind === "cancelled"));
  // today's rows
  const T = L.todayRows(R);
  assert.strictEqual(T.working, true); assert.strictEqual(T.weekday, 7);
  assert.deepStrictEqual(T.rows.map((r) => r.period.period_no), [1, 2]);              // only periods that have a class, in order
  assert.deepStrictEqual(T.rows.map((r) => r.current), [false, true]);                // now_period = 2
  const friday = Object.assign({}, R, { today: "2026-11-20", now_period: null });     // Friday is not a working day
  assert.deepStrictEqual(L.todayRows(friday), { date: "2026-11-20", weekday: 5, working: false, rows: [] });
  assert.strictEqual(L.todayRows(Object.assign({}, R, { today: "2026-11-25" })).rows.length, 0);   // Wednesday: a working day without any class for this batch
  assert.strictEqual(L.todayRows(Object.assign({}, R, { today: "2026-11-25" })).working, true);
  assert.strictEqual(L.todayRows(Object.assign({}, R, { now_period: null })).rows.some((r) => r.current), false);
  assert.strictEqual(L.todayRows(null).working, false); assert.strictEqual(L.todayRows({ today: "2026-11-22", working_days: [7], periods: [], slots: [] }).rows.length, 0);
  assert.strictEqual(L.isTodayDay(R, 7), true); assert.strictEqual(L.isTodayDay(R, 1), false);
  assert.strictEqual(L.isNowPeriod(R, 7, 2), true); assert.strictEqual(L.isNowPeriod(R, 7, 1), false); assert.strictEqual(L.isNowPeriod(R, 1, 2), false);   // a Monday cell is never "now" on a Sunday
  assert.strictEqual(L.isNowPeriod(Object.assign({}, R, { now_period: null }), 7, 2), false);
  // upcoming changes
  const U54 = L.upcomingChanges(R);
  assert.deepStrictEqual(U54.map((c) => c.on_date), [FX.TODAY, FX.TODAY, "2026-11-23", "2026-11-29"]);
  assert.strictEqual(U54[0].subject_name, "প্রাণিবিদ্যা পরিচিতি"); assert.strictEqual(U54[1].substitute_name, "জনাব হাসান"); assert.strictEqual(U54[0].period.start, "09:00");
  assert.deepStrictEqual(L.upcomingChanges({}), []); assert.deepStrictEqual(L.upcomingChanges(null), []);
  assert.strictEqual(L.changeLabel(R.exceptions[0]), "বাতিল"); assert.strictEqual(L.changeLabel(R.exceptions[1]), "বদলি: জনাব হাসান");
  assert.strictEqual(L.changeLabel({ kind: "substitute" }), "বদলি"); assert.strictEqual(L.changeLabel(null), "");
  assert.strictEqual(L.classTypeLabel("practical"), "ব্যবহারিক"); assert.strictEqual(L.classTypeLabel("theory"), "");

  // --- batches
  assert.strictEqual(L.batchLabel(FX.batches.batches[0]), "২০২৫-২৬ সেশন · ১ম বর্ষ");
  assert.strictEqual(L.yearLabel(3), "৩য় বর্ষ"); assert.strictEqual(L.yearLabel(4), "৪র্থ বর্ষ"); assert.strictEqual(L.yearLabel(0), "");
  const G = L.groupBatches(FX.batches.batches);
  assert.deepStrictEqual(G.map((g) => [g.label, g.items.length]), [["বি.এস.সি. (সম্মান)", 2], ["Degree (Pass)", 1]]);   // program_bn first, then program
  assert.strictEqual(L.pickBatch(FX.batches.batches, FX.B2), FX.B2);
  assert.strictEqual(L.pickBatch(FX.batches.batches, "gone"), ""); assert.strictEqual(L.pickBatch(FX.batches.batches, null), "");   // nothing chosen: the visitor must choose
  assert.strictEqual(L.pickBatch([FX.batches.batches[0]], null), FX.B1); assert.strictEqual(L.pickBatch([], "x"), "");

  // --- theme resolution
  assert.strictEqual(L.resolveTheme("auto", true), "dark"); assert.strictEqual(L.resolveTheme("auto", false), "light");
  assert.strictEqual(L.resolveTheme("light", true), "light"); assert.strictEqual(L.resolveTheme("dark", false), "dark");
  assert.strictEqual(L.resolveTheme("bogus", true), "dark"); assert.strictEqual(L.resolveTheme(null, false), "light");   // an unknown value means auto
  assert.deepStrictEqual(["auto", "light", "dark", "auto", "x"].map(L.nextThemePref), ["light", "dark", "auto", "light", "light"]);
  assert.deepStrictEqual(["auto", "light", "dark"].map(L.themeLabel), ["অটো মুড", "ডে মুড", "নাইট মুড"]);

  // --- the inline theme script in the head of every public page: identical everywhere, absent from form.html, and it really works
  const pagesWithTheme = ["index", "about", "head", "teachers", "notices", "notice", "routine", "museum", "museum-item", "library", "gallery", "downloads", "contact"];
  const scripts = pagesWithTheme.map((n) => {
    const html = fs54.readFileSync(path54.join(__dirname, n + ".html"), "utf8");
    const m = /<head>[\s\S]*?(<script>[\s\S]*?<\/script>)[\s\S]*?<\/head>/.exec(html);
    assert.ok(m, n + " has an inline script in <head>");
    assert.ok(html.indexOf('name="theme-color"') < html.indexOf(m[1]), n + ": meta theme-color comes before the script");
    assert.ok(html.indexOf(m[1]) < html.indexOf('rel="stylesheet"'), n + ": the script runs before the stylesheet is applied");
    assert.ok(/<meta name="color-scheme" content="light dark">/.test(html), n);
    assert.ok(/<link rel="stylesheet" href="site\.css">/.test(html) && /src="site\.js"/.test(html) && /src="pages\.js"/.test(html), n);
    assert.ok(!/https?:\/\/[^"']*github\.io/.test(html), n + ": no hard-coded github.io address");
    return m[1];
  });
  assert.ok(scripts.every((s) => s === scripts[0]), "the theme script is identical on every page");
  assert.ok(!/site-theme|data-theme/.test(fs54.readFileSync(path54.join(__dirname, "form.html"), "utf8")), "form.html is untouched by the theme");
  const themeSrc = scripts[0].replace(/^<script>/, "").replace(/<\/script>$/, "");
  function runTheme(opts) {
    const attrs = {}, metaAttrs = { content: "#0F3D3E" }, listeners = {};
    let mqHandler = null;
    const ctx = {
      document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => (k in attrs ? attrs[k] : null) },
        querySelector: (sel) => (/theme-color/.test(sel) ? { setAttribute: (k, v) => { metaAttrs[k] = v; } } : null) },
      localStorage: opts.storage === "throws" ? { getItem() { throw new Error("blocked"); } } : { getItem: () => (opts.storage == null ? null : opts.storage) },
      matchMedia: opts.noMatchMedia ? undefined : () => ({ matches: !!opts.dark, addEventListener: (t, f) => { mqHandler = f; } }),
      addEventListener: (t, f) => { listeners[t] = f; }
    };
    ctx.window = ctx;
    vm.runInNewContext(themeSrc, ctx);
    return { attrs, metaAttrs, ctx, fireSystemChange(dark) { opts.dark = dark; mqHandler && mqHandler(); } };
  }
  let th = runTheme({ dark: false }); assert.strictEqual(th.attrs["data-theme"], "light"); assert.strictEqual(th.attrs["data-theme-pref"], "auto"); assert.strictEqual(th.metaAttrs.content, "#0F3D3E");
  th = runTheme({ dark: true }); assert.strictEqual(th.attrs["data-theme"], "dark"); assert.strictEqual(th.metaAttrs.content, "#11221F");
  th = runTheme({ dark: true, storage: "light" }); assert.strictEqual(th.attrs["data-theme"], "light"); assert.strictEqual(th.attrs["data-theme-pref"], "light");   // the choice beats the system
  th = runTheme({ dark: false, storage: "dark" }); assert.strictEqual(th.attrs["data-theme"], "dark");
  th = runTheme({ dark: true, storage: "garbage" }); assert.strictEqual(th.attrs["data-theme-pref"], "auto"); assert.strictEqual(th.attrs["data-theme"], "dark");
  th = runTheme({ dark: true, storage: "throws" }); assert.strictEqual(th.attrs["data-theme"], "dark");                      // blocked storage: still works, still auto
  th = runTheme({ noMatchMedia: true }); assert.strictEqual(th.attrs["data-theme"], "light");                                  // very old browser: light, no error
  th = runTheme({ dark: false }); th.fireSystemChange(true); assert.strictEqual(th.attrs["data-theme"], "dark");               // auto follows the system when it changes
  th = runTheme({ dark: false, storage: "light" }); th.fireSystemChange(true); assert.strictEqual(th.attrs["data-theme"], "light");   // a choice does not
  th = runTheme({ dark: false }); th.ctx.SiteTheme.apply("dark"); assert.strictEqual(th.attrs["data-theme"], "dark"); assert.strictEqual(th.ctx.SiteTheme.get(), "dark");   // the button's override works even if storage is blocked

  assert.strictEqual(L.asciiDigits("১২৩abc৪"), "123abc4"); assert.strictEqual(L.asciiDigits(null), "");
  // --- text helpers
  assert.strictEqual(L.plainFromMarkdown("# শিরোনাম\n\n**মোটা** ও *বাঁকা* [লিংক](https://example.com) টেক্সট\n\n- এক\n- দুই\n\n---"), "শিরোনাম মোটা ও বাঁকা লিংক টেক্সট এক দুই");
  assert.strictEqual(L.plainFromMarkdown(null), "");
  assert.strictEqual(L.excerpt("ছোট লেখা", 280), "ছোট লেখা");
  const long = L.excerpt("শব্দ ".repeat(200), 280);
  assert.ok(Array.from(long).length <= 281 && long.endsWith("…") && !/\s…$/.test(long));
  assert.strictEqual(Array.from(L.excerpt("ক".repeat(500), 10)).length, 11);        // counts characters; no word break -> hard cut
  assert.ok(L.excerpt("x".repeat(100) + " yy", 100).endsWith("…"));
  assert.strictEqual(L.excerpt(null, 5), "");

  // --- library: state in the query string
  assert.deepStrictEqual(L.libraryState(""), { q: "", category: "", page: 1 });
  assert.deepStrictEqual(L.libraryState("?q=%E0%A6%AC%E0%A6%87&category=A+B&page=3"), { q: "বই", category: "A B", page: 3 });
  assert.strictEqual(L.libraryState("?page=৪").page, 4);                              // Bangla digits are accepted
  ["?page=0", "?page=-2", "?page=abc", "?page=99999999"].forEach((s) => assert.strictEqual(L.libraryState(s).page, 1, s));
  assert.strictEqual(L.libraryState("?q=" + "a".repeat(300)).q.length, 100);
  assert.strictEqual(L.libraryHref({ q: "", category: "", page: 1 }), "library.html");
  assert.strictEqual(L.libraryHref({ q: "বই", category: "জার্নাল", page: 2 }), "library.html?q=" + encodeURIComponent("বই") + "&category=" + encodeURIComponent("জার্নাল") + "&page=2");
  assert.deepStrictEqual(L.libraryState(L.libraryHref({ q: "a&b=c", category: "x y", page: 7 }).replace("library.html", "")), { q: "a&b=c", category: "x y", page: 7 });   // round trip
  assert.deepStrictEqual(L.libraryParams({ q: "", category: "", page: 1 }), { p_q: null, p_category: null, p_limit: 20, p_offset: 0 });
  assert.deepStrictEqual(L.libraryParams({ q: "x", category: "c", page: 3 }), { p_q: "x", p_category: "c", p_limit: 20, p_offset: 40 });
  assert.ok(L.LIB_PER_PAGE <= 50);

  // --- museum: client-side filter
  const M = FX.museum.items;
  assert.strictEqual(L.museumFilter(M, "", "").length, 4);
  assert.strictEqual(L.museumFilter(M, "", "উভচর").length, 2);
  assert.strictEqual(L.museumFilter(M, "নমুনা 3", "").length, 1);                       // Bangla title
  assert.strictEqual(L.museumFilter(M, "RANA TIGRINA 2", "").length, 1);                // scientific name, any letter case
  assert.strictEqual(L.museumFilter(M, "specimen", "সরীসৃপ").length, 2);               // English title + category
  assert.strictEqual(L.museumFilter(M, "mus-004", "").length, 1);
  assert.strictEqual(L.museumFilter(M, "zzz", "").length, 0); assert.deepStrictEqual(L.museumFilter(null, "a", ""), []);
}
console.log("task 54 helpers OK");

// ---------------- Task 54: wiring and safety of the public files ----------------
{
  const fs54 = require("fs"), path54 = require("path");
  const read = (f) => fs54.readFileSync(path54.join(__dirname, f), "utf8");
  const pagesList = () => ["index", "about", "head", "teachers", "notices", "notice", "routine", "museum", "museum-item", "library", "gallery", "downloads", "contact"];
  // no unsafe DOM writes, no secrets, no hard-coded host in the public code
  ["site.js", "pages.js", "lib.js"].forEach((f) => {
    const src = read(f);
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|service_role/.test(src), f);
    assert.ok(!/github\.io|supabase\.co/.test(src), f + ": the address lives only in config.js");
  });
  // no new third-party scripts: the only external thing is the Google Fonts stylesheet
  pagesList().forEach((n) => {
    const html = read(n + ".html");
    const ext = (html.match(/(?:src|href)="https?:\/\/[^"]+"/g) || []);
    assert.ok(ext.every((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), n + ": " + ext.join(" "));
    assert.ok(!/<script[^>]+src="https?:/.test(html), n);
    assert.ok(/<a class="skip" href="#main">/.test(html) && /<main id="main" tabindex="-1">/.test(html), n + ": skip link and main kept");
    assert.ok(/Hind\+Siliguri/.test(html) && /Noto\+Serif\+Bengali/.test(html) && /display=swap/.test(html) && /rel="preconnect"/.test(html), n + ": fonts");
  });
  // every new page script is registered for its <body data-page>
  const pg = read("pages.js");
  ["home", "head", "routine", "museum", "\"museum-item\"", "library"].forEach((k) => assert.ok(new RegExp("pages(\\." + k + "|\\[" + k + "\\]) = function").test(pg), k));
  pagesList().forEach((n) => {
    const m = /<body data-page="([^"]+)">/.exec(read(n + ".html"));
    assert.ok(m && new RegExp("pages(\\." + m[1] + "|\\[\"" + m[1] + "\"\\]) = function").test(pg), n);
  });
  // the nav and the footer offer the new pages (relative links)
  const site = read("site.js");
  ["head.html", "routine.html", "museum.html", "library.html"].forEach((f) => assert.ok(site.indexOf('"' + f + '"') >= 0, f));
  // only the documented RPCs are called by the new pages
  const rpcs = (pg.match(/S\.rpc\("([a-z_]+)"/g) || []).map((x) => x.slice(7, -1));
  const allowed = ["web_site_home", "web_site_head", "web_site_routine_batches", "web_site_routine", "web_site_museum", "web_site_museum_item", "web_site_library",
    "web_site_library_categories", "web_site_page", "web_site_people", "web_site_notices", "web_site_notice", "web_site_gallery", "web_site_downloads"];
  assert.ok(rpcs.every((r) => allowed.indexOf(r) >= 0), rpcs.join(","));
  ["web_site_head", "web_site_routine_batches", "web_site_routine", "web_site_museum", "web_site_museum_item", "web_site_library", "web_site_library_categories"].forEach((r) => assert.ok(rpcs.indexOf(r) >= 0, r));
  // CSS: the tokens exist for both themes, motion is guarded, print sheet exists, focus ring is defined, no gradient washes
  const css = read("site.css");
  ["--bg", "--surface", "--text", "--muted", "--primary", "--accent", "--line", "--focus", "--head-bg"].forEach((t) => {
    assert.ok(new RegExp(t + ":").test(css.split(':root[data-theme="dark"]')[0]), "day token " + t);
    assert.ok(new RegExp(t + ":").test(css.split(':root[data-theme="dark"]')[1].split("@media")[0]), "night token " + t);
  });
  ["#0F3D3E", "#2F7D4F", "#C9871C", "#EEF4F1", "#14231F", "#CBD9D2", "#0A1614", "#11221F", "#172B27", "#E4EFEA", "#9DB5AB", "#6FCF9F", "#F2B94B", "#26403A"].forEach((c) => assert.ok(css.toUpperCase().indexOf(c) >= 0, c));
  assert.ok(/prefers-reduced-motion: no-preference/.test(css) && !/transition\s*:/.test(css), "animations only when motion is allowed; no transitions");
  assert.ok(/@media print/.test(css) && /:focus-visible/.test(css) && /prefers-color-scheme: dark/.test(css));
  assert.ok(!/gradient\(\s*(135|180|to )/.test(css) && !/linear-gradient\([^)]*(var\(--primary|#1b6b4a)/i.test(css), "no decorative colour washes");
  // contrast: every colour pair of the tokens meets WCAG AA in both themes (docs/contrast-report.js lists the ratios)
  {
    const CR = require("./docs/contrast-report.js");
    const res = CR.compute(read("site.css"));
    const bad = res.rows.filter((r) => !r.pass).map((r) => r.theme + ": " + r.label + " " + r.ratio.toFixed(2));
    assert.deepStrictEqual(bad, []);
    assert.ok(res.sameAuto, "the system-dark block equals the chosen-dark block");
    assert.ok(res.rows.length >= 60);
    assert.ok(/aria-pressed="true"\]/.test(read("site.css")));
  }
  // form.html keeps its own files
  const form = read("form.html");
  assert.ok(/href="style\.css"/.test(form) && !/site\.(css|js)/.test(form) && /src="form\.js"/.test(form));
  // docs
  assert.ok(fs54.existsSync(path54.join(__dirname, "docs", "DESIGN.md")));
}
console.log("task 54 files OK");

// the page smoke test (fake DOM + fake RPC answers)
require("./test-dom.js").run().then(() => console.log("task 54 pages OK"), (e) => { console.error(e); process.exit(1); });
