// Same rules as the database function (private.web_validate). The server is the authority; this gives instant feedback.
(function (root) {
  var BN = "০১২৩৪৫৬৭৮৯";
  function digits(s) {
    return String(s == null ? "" : s).replace(/[০-৯]/g, function (c) { return String(BN.indexOf(c)); });
  }
  function clean(s) {
    return String(s == null ? "" : s)
      .replace(/[\t\r\n]+/g, " ")
      .replace(/[\u0001-\u001F\u007F​‪-‮⁦-⁩﻿]/g, "")
      .replace(/ {2,}/g, " ")
      .trim();
  }
  var NAME_BAD = /[0-9০-৯<>{}\[\]\\|@#$%^*=+~`;:"\/?!_&]/;

  function mobile(s) {
    var d = digits(s).replace(/[^0-9]/g, "");
    if (/^8801[0-9]{9}$/.test(d)) d = d.slice(2);
    return d;
  }
  function personName(v, required, msgRequired) {
    v = clean(v);
    if (!v) return required ? msgRequired : "";
    if (v.length < 2) return "নাম খুব ছোট";
    if (v.length > 120) return "নাম ১২০ অক্ষরের বেশি হবে না";
    if (NAME_BAD.test(v)) return "নামে সংখ্যা বা অদ্ভুত চিহ্ন থাকবে না";
    return "";
  }
  function todayParts() {
    var d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  }
  function parseDob(s) {
    s = clean(digits(s));
    var y, m, d, a;
    if ((a = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) { y = +a[1]; m = +a[2]; d = +a[3]; }
    else if ((a = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s))) { d = +a[1]; m = +a[2]; y = +a[3]; }
    else return null;
    var dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return { y: y, m: m, d: d };
  }
  function age(p) {
    var t = todayParts();
    var a = t.y - p.y;
    if (t.m < p.m || (t.m === p.m && t.d < p.d)) a--;
    return a;
  }

  // One rule per field. Each returns "" when fine, else a Bangla message.
  var rules = {
    reg_no: function (v) {
      v = clean(digits(v)).toUpperCase();
      if (!v) return "রেজিস্ট্রেশন নং লিখুন";
      if (!/^[0-9]{3,20}$/.test(v)) return "রেজিস্ট্রেশন নং শুধু সংখ্যা হবে (৩ থেকে ২০ অঙ্ক)";
      return "";
    },
    name_en: function (v) {
      v = clean(v);
      if (!v) return "ইংরেজিতে নাম লিখুন";
      if (v.length > 120) return "নাম ১২০ অক্ষরের বেশি হবে না";
      if (!/^[A-Za-z][A-Za-z .'’-]+$/.test(v)) return "নাম ইংরেজি অক্ষরে লিখুন (সংখ্যা বা চিহ্ন ছাড়া)";
      return "";
    },
    name_bn: function (v) {
      v = clean(v);
      if (!v) return "";
      if (v.length > 120) return "নাম ১২০ অক্ষরের বেশি হবে না";
      if (NAME_BAD.test(v)) return "নামে সংখ্যা বা অদ্ভুত চিহ্ন থাকবে না";
      return "";
    },
    roll_no: function (v) {
      v = clean(digits(v));
      if (!v) return "";
      return /^[0-9]{1,10}$/.test(v) ? "" : "রোল নং শুধু সংখ্যা হবে";
    },
    father_name: function (v) { return personName(v, true, "পিতার নাম লিখুন"); },
    mother_name: function (v) { return personName(v, true, "মাতার নাম লিখুন"); },
    guardian_name: function (v) { return personName(v, true, "অভিভাবকের নাম লিখুন"); },
    session: function (v) { return clean(v) ? "" : "শিক্ষাবর্ষ বেছে নিন"; },
    program: function (v, ctx) { return ctx && ctx.needProgram && !clean(v) ? "প্রোগ্রাম বেছে নিন" : ""; },
    mobile: function (v) {
      var d = mobile(v);
      if (!d) return "মোবাইল নম্বর লিখুন";
      return /^01[3-9][0-9]{8}$/.test(d) ? "" : "মোবাইল নম্বর সঠিক নয় (যেমন: ০১৭১২৩৪৫৬৭৮)";
    },
    guardian_mobile: function (v) {
      var d = mobile(v);
      if (!d) return "অভিভাবকের মোবাইল নম্বর লিখুন";
      return /^01[3-9][0-9]{8}$/.test(d) ? "" : "মোবাইল নম্বর সঠিক নয় (যেমন: ০১৭১২৩৪৫৬৭৮)";
    },
    dob: function (v) {
      if (!clean(v)) return "জন্মতারিখ দিন";
      var p = parseDob(v);
      if (!p) return "জন্মতারিখ সঠিক নয় (দিন/মাস/সাল)";
      var t = todayParts();
      if (p.y > t.y || (p.y === t.y && (p.m > t.m || (p.m === t.m && p.d > t.d)))) return "জন্মতারিখ ভবিষ্যতের হতে পারে না";
      var a = age(p);
      if (a < 15 || a > 40) return "বয়স ১৫ থেকে ৪০ বছরের মধ্যে হতে হবে";
      return "";
    },
    gender: function (v) { return v === "male" || v === "female" ? "" : "লিঙ্গ বেছে নিন"; },
    blood_group: function (v) {
      v = clean(v).replace(/\s/g, "").toUpperCase();
      if (!v) return "";
      return ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].indexOf(v) >= 0 ? "" : "রক্তের গ্রুপ সঠিক নয় (A+, B+, O+, AB+ ...)";
    },
    village: function (v) { return addr(v, true, "গ্রাম / মহল্লা লিখুন"); },
    post_office: function (v) { return addr(v, false, ""); },
    thana: function (v) { return addr(v, true, "থানা / উপজেলা লিখুন"); },
    district: function (v) { return addr(v, true, "জেলা লিখুন"); }
  };
  function addr(v, required, msg) {
    v = clean(v);
    if (!v) return required ? msg : "";
    if (v.length > 120) return "১২০ অক্ষরের বেশি হবে না";
    if (/[<>{}\\|`]/.test(v)) return "অদ্ভুত চিহ্ন ব্যবহার করবেন না";
    return "";
  }

  function validateAll(data, ctx) {
    var errors = {};
    Object.keys(rules).forEach(function (k) {
      var m = rules[k](data[k], ctx);
      if (m) errors[k] = m;
    });
    return errors;
  }

  var api = { rules: rules, validateAll: validateAll, digits: digits, clean: clean, mobile: mobile, parseDob: parseDob };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Validate = api;
})(typeof window !== "undefined" ? window : this);
