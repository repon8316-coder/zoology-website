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
