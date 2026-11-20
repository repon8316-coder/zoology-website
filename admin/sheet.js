// Shared spreadsheet reading for the admin panel: CSV or Excel (.xlsx) file -> a grid of strings. Used by the student import and the library import.
// The file is read in the browser only. SheetJS is loaded from jsdelivr (exact version + integrity hash) only when an .xlsx file is chosen.
// No raw HTML, no logging of file contents.
(function () {
  "use strict";
  var A = window.Admin, H = A.H, el = A.el;
  var XLSX_SRC = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
  var XLSX_SRI = "sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw";

  // ---------------- SheetJS, loaded only when an .xlsx file is chosen ----------------
  var xlsxPromise = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxPromise) return xlsxPromise;
    xlsxPromise = A.withTimeout(new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = XLSX_SRC; s.integrity = XLSX_SRI; s.crossOrigin = "anonymous";
      s.onload = function () { if (window.XLSX) resolve(window.XLSX); else reject(A.userErr("Excel পড়ার অংশটি চালু হয়নি। পাতাটি আবার খুলুন।")); };
      s.onerror = function () { if (s.parentNode) s.parentNode.removeChild(s); reject(A.userErr("Excel পড়ার অংশটি নামানো যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন, অথবা CSV ফাইল দিন।")); };
      document.head.appendChild(s);
    }), 30000, "Excel পড়ার অংশটি নামাতে দেরি হচ্ছে। আবার চেষ্টা করুন, অথবা CSV ফাইল দিন।").catch(function (e) { xlsxPromise = null; throw e; });
    return xlsxPromise;
  }

  // a cell of the first sheet -> text. Numbers are written in full (no 1.23E+9); text cells stay text.
  function cellText(c) {
    if (!c) return "";
    if (c.t === "n") return H.numToText(c.v);
    if (c.t === "s") return String(c.v == null ? "" : c.v);
    if (c.t === "b") return c.v ? "TRUE" : "FALSE";
    if (c.t === "d") return c.v instanceof Date && !isNaN(c.v) ? c.v.toISOString().slice(0, 10) : "";
    if (c.t === "e") return "";
    return String(c.w == null ? "" : c.w);
  }
  function gridFromXlsx(buf) {
    return loadXlsx().then(function (X) {
      var wb;
      try { wb = X.read(new Uint8Array(buf), { type: "array", cellDates: false, cellFormula: false, cellHTML: false }); }
      catch (e) { throw A.userErr("Excel ফাইলটি পড়া যায়নি — ফাইলটি নষ্ট বা পাসওয়ার্ড দেওয়া হতে পারে।"); }
      var name = wb.SheetNames && wb.SheetNames[0], ws = name && wb.Sheets[name];
      if (!ws || !ws["!ref"]) return { grid: [], sheets: (wb.SheetNames || []).length };
      var rg = X.utils.decode_range(ws["!ref"]);
      if (rg.e.r > 20000 || rg.e.c > 200) throw A.userErr("শিটটি অতিরিক্ত বড়। শুধু দরকারি সারি ও কলাম রেখে আবার চেষ্টা করুন।");
      var grid = [];
      for (var r = 0; r <= rg.e.r; r++) {
        var row = [];
        for (var c = 0; c <= rg.e.c; c++) row.push(cellText(ws[X.utils.encode_cell({ r: r, c: c })]));
        grid.push(row);
      }
      return { grid: grid, sheets: wb.SheetNames.length };
    });
  }

  function readGrid(file, ext) {
    return file.arrayBuffer().then(function (buf) {
      var real = H.sniffType(Array.prototype.slice.call(new Uint8Array(buf, 0, Math.min(16, buf.byteLength))));
      if (ext === "xlsx") {
        if (real !== "zip") throw A.userErr("এটি আসল .xlsx ফাইল নয় (পুরনো .xls ফাইলের নাম বদলালে এমন হয়)। Excel-এ “Save As → Excel Workbook (.xlsx)” করে আবার দিন।");
        return gridFromXlsx(buf);
      }
      if (real) throw A.userErr("এটি CSV ফাইল নয় (ভেতরের ধরন আলাদা)।");
      var text;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
      catch (e) { throw A.userErr("CSV ফাইলটি UTF-8 নয়। Excel-এ “CSV UTF-8” হিসেবে সেভ করুন, অথবা .xlsx ফাইল দিন।"); }
      return { grid: H.parseCsv(text), sheets: 1 };
    });
  }

  function download(name, text) {
    var blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob), a = el("a", { href: url, download: name });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  // A.sheet.readGrid(file, ext) -> Promise<{grid, sheets}>; A.sheet.download(name, text) saves a CSV (with a BOM so Excel reads Bangla)
  A.sheet = { readGrid: readGrid, download: download };
})();
