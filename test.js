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
