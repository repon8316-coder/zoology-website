// Admin section: student bulk import from a CSV / Excel file (#/import).
// The file is read in the browser only. Rows go to the database one chunk at a time through public.import_students (RLS: admin / staff).
// Student data is never written to the public bucket, never logged, never put in the page as HTML (textContent / DOM APIs only).
(function () {
  "use strict";
  var A = window.Admin, H = A.H, S = A.S, el = A.el, clear = A.clear;
  var V = A.views = A.views || {};
  var XLSX_SRC = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
  var XLSX_SRI = "sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw";
  var FIELD = {};
  H.IMPORT_FIELDS.forEach(function (f) { FIELD[f.key] = f; });

  function bn(n) { return H.bnNum(n); }
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function short(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

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

  function query(table, cols, tweak) {
    var b = A.sb.from(table).select(cols);
    if (tweak) b = tweak(b);
    return A.withTimeout(b, 20000).then(function (r) { if (r.error) throw A.toError(r.error); return r.data || []; });
  }

  // ======================= the view =======================
  V["import"] = function (host, arg, alive) {
    var ref = { programs: null, batches: null, loading: null };
    var st = { stage: "idle" };
    var body = el("div");

    function loadRef() {
      if (ref.loading) return ref.loading;
      var jobs = [];
      if (!ref.programs) jobs.push(query("programs", "name, name_bn, duration_years").then(function (r) { ref.programs = r; }, function () { ref.programs = null; }));
      if (!ref.batches) {
        jobs.push(query("batches", "program, session, year_of_study, is_active", function (b) {
          return b.is("deleted_at", null).order("session", { ascending: false }).order("program");
        }).then(function (r) { ref.batches = r; }, function () { ref.batches = null; }));
      }
      ref.loading = Promise.all(jobs).then(function () { ref.loading = null; });
      return ref.loading;
    }

    // ---------------- top of the page ----------------
    clear(host).appendChild(A.pageTitle("শিক্ষার্থী ইমপোর্ট", [
      A.btn("টেমপ্লেট CSV নামান", "btn-outline", function () { download("student-import-template.csv", H.importTemplateCsv()); })
    ]));
    host.appendChild(el("section", { class: "card" }, [
      el("h2", { class: "h3", text: "কীভাবে কাজ করে" }),
      el("p", { text: "CSV বা Excel (.xlsx) ফাইল থেকে একসাথে অনেক শিক্ষার্থীর তথ্য ডাটাবেসে তোলা যায়। ফাইল আপনার ব্রাউজারেই পড়া হয়; যাচাই করা সারিগুলো ছোট ছোট ভাগে ডাটাবেসে যায়।" }),
      el("p", { class: "import-warn", role: "note", text: "সতর্কতা: যে রেজিস্ট্রেশন নম্বর আগে থেকেই ডাটাবেসে আছে, তার তথ্য ফাইলের তথ্য দিয়ে হালনাগাদ হবে — তবে ফাইলে যে ঘর ফাঁকা, সেখানে আগের তথ্যই থাকবে। মুছে ফেলা শিক্ষার্থীর তথ্য বদলানো হয় না।" }),
      el("ul", { class: "plain" }, [
        el("li", { text: "রেজিস্ট্রেশন নম্বরের কলাম অবশ্যই চাই। নতুন শিক্ষার্থীর জন্য ইংরেজি নাম ও মোবাইল নম্বরও লাগবে।" }),
        el("li", { text: "প্রোগ্রাম ও শিক্ষাবর্ষ (বর্ষ ঐচ্ছিক) ফাইলে থাকতে পারে; না থাকলে নিচ থেকে একটি ব্যাচ বেছে নিতে পারবেন।" }),
        el("li", { text: "হেডিং বাংলা বা ইংরেজি — অ্যাপের এক্সপোর্ট করা Excel ফাইলও সরাসরি চলবে। সর্বোচ্চ ৫ MB ও ২০০০টি সারি।" }),
        el("li", { text: "রেজিস্ট্রেশন নম্বরের ঘর Text হিসেবে রাখুন (না হলে Excel শুরুর ০ বাদ দেয় বা 1.23E+9 করে ফেলে)।" })
      ])
    ]));

    var fileInput = el("input", { type: "file", accept: ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", id: "imp-file" });
    fileInput.addEventListener("change", function () {
      var f = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (f) onFile(f);
    });
    host.appendChild(el("section", { class: "card" }, [
      el("label", { class: "label-like", for: "imp-file", text: "ফাইল বাছুন (.csv বা .xlsx)" }), fileInput,
      el("p", { class: "hint muted", text: "শুধু শিটের প্রথম পাতা পড়া হয়। ফাইলটি কোথাও আপলোড করা হয় না — শুধু যাচাই করা সারিগুলো ডাটাবেসে যায়।" })
    ]));
    host.appendChild(body);

    // ---------------- reading the file ----------------
    function showBusy(text) { st.stage = "busy"; A.setDirty(false); clear(body); S.showState(body, "loading", text); }
    function showError(msg) {
      st = { stage: "error" }; A.setDirty(false);
      clear(body).appendChild(el("div", { class: "card" }, [el("p", { class: "err-text", role: "alert", text: msg })]));
    }

    function onFile(file) {
      if (st.stage === "running" || st.stage === "stopped") { A.toast("একটি ইমপোর্ট চলছে বা থেমে আছে — আগে সেটি শেষ করুন বা “ফল দেখুন” চাপুন।", "warn"); return; }
      var ext = H.extOf(file.name);
      if (ext !== "csv" && ext !== "xlsx") { showError("শুধু .csv বা .xlsx ফাইল চলবে।"); return; }
      if (!(file.size > 0)) { showError("ফাইলটি খালি।"); return; }
      if (file.size > H.IMPORT_MAX_BYTES) { showError("ফাইল ৫ MB এর বেশি বড়।"); return; }
      showBusy("ফাইল পড়া হচ্ছে…");
      readGrid(file, ext).then(function (g) {
        if (!alive()) return;
        var grid = g.grid, hi = H.findHeaderRow(grid);
        if (hi < 0) { showError("ফাইলে কোনো তথ্য পাওয়া যায়নি।"); return; }
        var n = H.countDataRows(grid, hi);
        if (n === 0) { showError("হেডিংয়ের নিচে কোনো সারি নেই।"); return; }
        if (n > H.IMPORT_MAX_ROWS) { showError("ফাইলে " + bn(n) + "টি সারি আছে; একবারে সর্বোচ্চ " + bn(H.IMPORT_MAX_ROWS) + "টি চলে। ফাইলটি ভাগ করে আলাদা আলাদা ইমপোর্ট করুন।"); return; }
        var headers = grid[hi].map(H.cleanCell);
        st = { stage: "busy", fileName: file.name, grid: grid, headerIdx: hi, headers: headers, mapping: H.autoMapHeaders(headers), sheets: g.sheets, defaultBatch: "", existing: null, existingErr: false };
        return prepare();
      }).catch(function (e) { if (alive()) showError(A.errText(e)); });
    }

    function prepare() {
      showBusy("প্রোগ্রাম ও ব্যাচের তালিকা আনা হচ্ছে…");
      return loadRef().then(function () {
        if (!alive()) return;
        if (st.mapping.registration_no == null) { st.built = { rows: [], newBatches: [] }; st.stage = "ready"; draw(); return; }
        rebuild();
        showBusy("আগে থেকে থাকা রেজিস্ট্রেশন নম্বর মিলিয়ে দেখা হচ্ছে…");
        return lookupExisting().then(function () { if (!alive()) return; rebuild(); st.stage = "ready"; draw(); });
      });
    }

    function defaultBatchObj() {
      if (st.defaultBatch === "" || !ref.batches) return null;
      return ref.batches[+st.defaultBatch] || null;
    }
    function rebuild() {
      st.built = H.buildImportRows(st.grid, st.headerIdx, st.mapping, {
        programs: ref.programs, batches: ref.batches || [], defaultBatch: defaultBatchObj(), existing: st.existing, today: new Date()
      });
    }

    // Which registration numbers are already in the database? An ordinary admin read (RLS); if it fails the import still works.
    function lookupExisting() {
      var seen = {}, regs = [];
      st.built.rows.forEach(function (r) { if (r.reg && r.reg.length <= 30 && !seen[r.reg]) { seen[r.reg] = true; regs.push(r.reg); } });
      var found = {}, chain = Promise.resolve();
      H.chunkList(regs, 200).forEach(function (part) {
        chain = chain.then(function () {
          return query("students", "registration_no, deleted_at", function (b) { return b.in("registration_no", part); }).then(function (rows) {
            rows.forEach(function (x) { found[x.registration_no] = x.deleted_at != null; });
          });
        });
      });
      return chain.then(function () { st.existing = found; st.existingErr = false; }, function () { st.existing = null; st.existingErr = true; });
    }

    // ---------------- drawing ----------------
    function draw() {
      if (!alive()) return;
      A.setDirty(st.stage === "running" || st.stage === "stopped");
      clear(body);
      if (st.stage === "ready") drawReady();
      else if (st.stage === "running" || st.stage === "stopped") drawProgress();
      else if (st.stage === "done") drawDone();
    }

    function table(head, rows) {
      return el("div", { class: "tbl-wrap" }, el("table", { class: "tbl" }, [
        el("thead", null, el("tr", null, head.map(function (h) { return el("th", { scope: "col", text: h }); }))),
        el("tbody", null, rows)
      ]));
    }
    function td(text, cls) { return el("td", { class: cls || null, text: text }); }

    function mappingCard() {
      var byCol = {};
      Object.keys(st.mapping).forEach(function (k) { byCol[st.mapping[k]] = k; });
      var trs = [];
      st.headers.forEach(function (h, i) {
        if (!h) return;
        var k = byCol[i], f = k && FIELD[k], label, cls = null;
        if (!f) { label = "চেনা যায়নি — বাদ দেওয়া হবে"; cls = "muted"; }
        else if (f.ignored) { label = "ছবির নাম — ওয়েব ইমপোর্টে ছবি নেওয়া হয় না, বাদ"; cls = "muted"; }
        else label = "✓ " + f.bn;
        trs.push(el("tr", null, [td(short(h, 60)), td(label, cls)]));
      });
      var kids = [el("h2", { class: "h3", text: "ফাইলের হেডিং কীভাবে ধরা হয়েছে" }), el("p", { class: "muted", text: "ফাইল: " + short(st.fileName, 80) + " · হেডিং সারি " + bn(st.headerIdx + 1) + (st.sheets > 1 ? " · শুধু প্রথম শিট পড়া হয়েছে" : "") })];
      if (st.mapping.registration_no == null) {
        kids.push(el("p", { class: "err-text", role: "alert", text: "“রেজিস্ট্রেশন নম্বর” নামের কলাম পাওয়া যায়নি, তাই ইমপোর্ট করা যাবে না। হেডিং ঠিক করে (যেমন “রেজিস্ট্রেশন নং” বা “Registration No”) আবার ফাইল দিন।" }));
      }
      if (trs.length) kids.push(table(["ফাইলের হেডিং", "যা ধরা হয়েছে"], trs));
      var miss = [];
      ["name_en", "mobile"].forEach(function (k) { if (st.mapping[k] == null) miss.push(FIELD[k].bn); });
      if (miss.length && st.mapping.registration_no != null) kids.push(el("p", { class: "import-warn", role: "note", text: "এই কলাম নেই: " + miss.join(", ") + " — শুধু আগে থেকে থাকা শিক্ষার্থীর তথ্য হালনাগাদ হবে; নতুন শিক্ষার্থী যুক্ত করা যাবে না।" }));
      return el("section", { class: "card" }, kids);
    }

    function batchCard() {
      var sel = el("select", { "aria-label": "ডিফল্ট ব্যাচ" }, [el("option", { value: "", text: "— ডিফল্ট ব্যাচ নেই —" })].concat((ref.batches || []).map(function (b, i) {
        return el("option", { value: String(i), text: b.program + " · " + b.session + " · " + bn(b.year_of_study) + " বর্ষ" + (b.is_active ? "" : " (বন্ধ)"), selected: String(i) === String(st.defaultBatch) });
      })));
      sel.addEventListener("change", function () { st.defaultBatch = sel.value; rebuild(); draw(); });
      return el("section", { class: "card" }, [
        el("h2", { class: "h3", text: "ডিফল্ট ব্যাচ (ঐচ্ছিক)" }),
        A.field("যে সারিতে প্রোগ্রাম বা শিক্ষাবর্ষ নেই, সেখানে এটি ধরা হবে", sel,
          ref.batches ? "ফাইলে প্রোগ্রাম ও শিক্ষাবর্ষ থাকলে ফাইলেরটাই চলবে।" : "ব্যাচের তালিকা আনা যায়নি — পাতাটি আবার খুলুন।")
      ]);
    }

    function rowStatus(r) {
      if (!r.ok) {
        var errs = r.issues.filter(function (i) { return i.error; });
        return el("td", { class: "err-text" }, errs.slice(0, 2).map(function (i) { return el("div", { text: i.msg }); }).concat(errs.length > 2 ? [el("div", { text: "…আরও " + bn(errs.length - 2) + "টি" })] : []));
      }
      var kids = [];
      if (st.existing) kids.push(A.badge(has(st.existing, r.reg) ? "হালনাগাদ হবে" : "নতুন", has(st.existing, r.reg) ? "badge-pin" : "badge-ok"));
      r.issues.filter(function (i) { return !i.error; }).slice(0, 2).forEach(function (i) { kids.push(el("div", { class: "muted", text: i.msg })); });
      return el("td", null, kids);
    }

    function drawReady() {
      body.appendChild(mappingCard());
      if (st.mapping.registration_no == null) return;
      body.appendChild(batchCard());

      var rows = st.built.rows, valid = rows.filter(function (r) { return r.ok; }), bad = rows.length - valid.length;
      var existingN = st.existing ? valid.filter(function (r) { return has(st.existing, r.reg); }).length : null;
      var warnN = valid.filter(function (r) { return r.issues.length; }).length;

      var sum = [
        el("h2", { class: "h3", text: "যাচাইয়ের ফল" }),
        el("dl", { class: "dl" }, [
          ["মোট সারি", bn(rows.length)], ["ঠিক আছে (ইমপোর্ট হবে)", bn(valid.length)], ["ত্রুটি আছে (বাদ যাবে)", bn(bad)]
        ].concat(existingN == null ? [] : [["এর মধ্যে আগে থেকেই আছে (হালনাগাদ হবে)", bn(existingN)], ["এর মধ্যে নতুন", bn(valid.length - existingN)]])
          .map(function (x) { return el("div", { class: "dl-row" }, [el("dt", { text: x[0] }), el("dd", { text: x[1] })]); }))
      ];
      if (existingN != null && existingN > 0) sum.push(el("p", { class: "import-warn", role: "note", text: bn(existingN) + " জন আগে থেকেই আছে, তাদের তথ্য হালনাগাদ হবে (ফাইলের ফাঁকা ঘর আগের তথ্য মুছবে না)।" }));
      if (st.existingErr) sum.push(el("p", { class: "import-warn", role: "note", text: "আগে থেকে কারা আছে তা মিলিয়ে দেখা যায়নি। মনে রাখবেন: যাদের রেজিস্ট্রেশন নম্বর আগে থেকেই আছে, তাদের তথ্য হালনাগাদ হবে। নতুন শিক্ষার্থীর নাম/মোবাইল ঠিক আছে কিনা সার্ভার যাচাই করবে।" }));
      if (warnN) sum.push(el("p", { class: "muted", text: bn(warnN) + "টি ঠিক সারিতে ছোট সতর্কতা আছে (নিচের তালিকায় দেখুন) — এগুলো ইমপোর্ট আটকায় না।" }));
      if (ref.batches && st.built.newBatches.length) {
        sum.push(el("p", { text: "নতুন ব্যাচ তৈরি হবে (ডাটাবেসে আগে নেই):" }));
        sum.push(el("ul", { class: "plain" }, st.built.newBatches.map(function (b) { return el("li", { text: b.program + " · " + b.session + " · " + bn(b.year) + " বর্ষ — " + bn(b.count) + " জন" }); })));
        sum.push(el("p", { class: "hint muted", text: "বর্ষ ফাইলের “বর্ষ” কলাম থেকে, না থাকলে শিক্ষাবর্ষ দেখে আন্দাজ করা। ভুল হলে ফাইলে “বর্ষ” কলাম যোগ করে আবার দিন।" }));
      }
      if (ref.batches == null) sum.push(el("p", { class: "import-warn", role: "note", text: "ব্যাচের তালিকা আনা যায়নি, তাই নতুন ব্যাচ হবে কিনা দেখানো যাচ্ছে না। সার্ভার ঠিকঠাক মিলিয়ে নেবে।" }));
      if (bad) sum.push(A.btn("ত্রুটিযুক্ত সারি CSV করে নামান", "btn-outline btn-sm", function () { download("student-import-errors.csv", H.failedRowsCsv(localFailed())); }));
      body.appendChild(el("section", { class: "card" }, sum));

      if (bad) {
        var errRows = rows.filter(function (r) { return !r.ok; });
        body.appendChild(el("section", { class: "card" }, [
          el("h2", { class: "h3", text: "ত্রুটির তালিকা" }),
          errRows.length > 30 ? el("p", { class: "muted", text: "প্রথম ৩০টি দেখানো হচ্ছে; সবগুলো উপরের CSV বোতামে পাবেন।" }) : null,
          el("ul", { class: "plain fail-list" }, errRows.slice(0, 30).map(function (r) {
            return el("li", null, [el("strong", { text: "সারি " + bn(r.rowNumber) + (r.reg ? " (" + short(r.reg, 30) + ")" : "") + ": " }),
              el("span", { class: "err-text", text: r.issues.filter(function (i) { return i.error; }).map(function (i) { return i.msg; }).join("; ") })]);
          }))
        ]));
      }

      var prev = rows.slice(0, 20).map(function (r) {
        var p = r.payload;
        return el("tr", null, [td(bn(r.rowNumber)), td(short(r.reg, 30)), td(short(r.name, 40)), td(p.mobile || ""), td(r.batchKey ? r.batchKey.replace("|", " · ") : ""), rowStatus(r)]);
      });
      body.appendChild(el("section", { class: "card" }, [
        el("h2", { class: "h3", text: "প্রথম " + bn(Math.min(20, rows.length)) + "টি সারি" }),
        table(["সারি", "রেজিস্ট্রেশন", "নাম", "মোবাইল", "ব্যাচ", "অবস্থা"], prev)
      ]));

      // confirm + start
      var cb = el("input", { type: "checkbox", name: "confirm" });
      var go = A.btn("ইমপোর্ট শুরু করুন", "", function () { start(go); }, { disabled: true });
      cb.addEventListener("change", function () { go.disabled = !cb.checked || !valid.length; });
      body.appendChild(el("section", { class: "card" }, [
        el("h2", { class: "h3", text: "ইমপোর্ট শুরু" }),
        valid.length ? el("p", { text: bn(valid.length) + " জনের তথ্য ডাটাবেসে যাবে।" }) : el("p", { class: "err-text", text: "ইমপোর্ট করার মতো ঠিক সারি নেই।" }),
        el("label", { class: "check" }, [cb, el("span", { text: "আমি যাচাই করেছি" })]),
        el("div", { class: "form-actions" }, [go])
      ]));
    }

    function localFailed() {
      return st.built.rows.filter(function (r) { return !r.ok; }).map(function (r) {
        return { rowNumber: r.rowNumber, reg: r.reg, raw: r.raw, reason: r.issues.filter(function (i) { return i.error; }).map(function (i) { return i.msg; }).join("; ") };
      });
    }

    // ---------------- running ----------------
    function start(btn) {
      if (st.stage !== "ready" || st.sending) return;
      var valid = st.built.rows.filter(function (r) { return r.ok; });
      if (!valid.length) return;
      btn.disabled = true;
      st.chunks = H.chunkList(valid, H.IMPORT_CHUNK);
      st.next = 0; st.total = valid.length; st.doneRows = 0;
      st.res = { created: 0, updated: 0, unchanged: 0 };
      st.serverFailed = []; st.localFailed = localFailed(); st.stopErr = null;
      st.stage = "running";
      step();
    }

    function absorb(part, res) {
      var by = {};
      res.forEach(function (x) { if (x && x.row != null) by[x.row] = x; });
      part.forEach(function (r) {
        var x = by[r.rowNumber], s = x && x.status;
        if (s === "inserted") st.res.created += 1;
        else if (s === "updated") st.res.updated += 1;
        else if (s === "unchanged") st.res.unchanged += 1;
        else st.serverFailed.push({ rowNumber: r.rowNumber, reg: r.reg, raw: r.raw, reason: x ? H.importErrorBn(x) : "সার্ভার এই সারির ফল পাঠায়নি — আবার চেষ্টা করুন" });
      });
      st.doneRows += part.length;
    }

    // One chunk at a time. st.next moves forward only after the server answered, and st.sending blocks a second send of the same chunk.
    function step() {
      if (!alive() || st.sending) return Promise.resolve();
      if (st.next >= st.chunks.length) return finish();
      var i = st.next, part = st.chunks[i];
      st.stage = "running"; st.sending = true; st.stopErr = null;
      draw();
      return A.call("import_students", { p_rows: part.map(function (r) { return r.payload; }) }, 120000).then(function (res) {
        st.sending = false;
        if (!Array.isArray(res)) throw A.userErr("সার্ভারের উত্তর বোঝা যায়নি");
        absorb(part, res);
        st.next = i + 1;
        return step();
      }, function (e) {
        st.sending = false; st.stopErr = e; st.stage = "stopped";
        if (alive()) draw();
      });
    }

    function finish() {
      // rows that were never sent (the run was stopped early) are listed as not imported
      for (var i = st.next; i < st.chunks.length; i++) {
        st.chunks[i].forEach(function (r) { st.serverFailed.push({ rowNumber: r.rowNumber, reg: r.reg, raw: r.raw, reason: "পাঠানো হয়নি বা ফল জানা যায়নি (ইমপোর্ট মাঝপথে থামানো হয়েছে)" }); });
      }
      st.next = st.chunks.length;
      st.stage = "done"; A.setDirty(false);
      var failed = st.localFailed.length + st.serverFailed.length;
      A.toast("ইমপোর্ট শেষ: " + bn(st.res.created) + " নতুন, " + bn(st.res.updated) + " হালনাগাদ" + (failed ? ", " + bn(failed) + "টি বাদ" : ""), failed ? "warn" : "ok");
      st.grid = null;   // the file contents are not kept in memory any longer
      draw();
    }

    function drawProgress() {
      var running = st.stage === "running";
      var from = st.chunks[st.next] && st.chunks[st.next][0] ? st.chunks[st.next][0].rowNumber : 0;
      var bar = el("progress", { max: String(st.total), value: String(st.doneRows), "aria-label": "অগ্রগতি" });
      var kids = [
        el("h2", { class: "h3", text: running ? "ইমপোর্ট চলছে…" : "ইমপোর্ট থেমে গেছে" }),
        bar,
        el("p", { role: "status", text: bn(st.doneRows) + " / " + bn(st.total) + " জনের কাজ শেষ (ভাগ " + bn(Math.min(st.next + 1, st.chunks.length)) + " / " + bn(st.chunks.length) + ")" }),
        el("p", { class: "muted", text: "যে পর্যন্ত হয়েছে: " + bn(st.res.created) + " নতুন, " + bn(st.res.updated) + " হালনাগাদ, " + bn(st.res.unchanged) + " অপরিবর্তিত, " + bn(st.serverFailed.length) + " ব্যর্থ।" })
      ];
      if (running) kids.push(el("p", { class: "import-warn", role: "note", text: "পাতাটি বন্ধ করবেন না বা অন্য জায়গায় যাবেন না।" }));
      else {
        var e = st.stopErr;
        kids.push(el("p", { class: "err-text", role: "alert", text: A.errText(e) }));
        if (e && (e.denied || e.missing)) {
          kids.push(el("p", { class: "muted", text: "এই সমস্যা আবার চেষ্টা করলে মিটবে না। যে পর্যন্ত হয়েছে তা ডাটাবেসে আছে।" }));
          kids.push(A.btn("ফল দেখুন", "btn-outline", function () { finish(); }));
        } else {
          kids.push(el("p", { text: "সারি " + bn(from) + " থেকে শুরু হওয়া ভাগটির ফল জানা যায়নি — সেটি ডাটাবেসে পৌঁছে থাকতেও পারে। আবার পাঠালে একই শিক্ষার্থীদের তথ্য শুধু আরেকবার একই ভাবে লেখা হবে, কোনো ক্ষতি নেই।" }));
          kids.push(el("div", { class: "form-actions" }, [
            A.btn("সারি " + bn(from) + " থেকে আবার শুরু করুন", "", function (b) { b.disabled = true; step(); }),
            A.btn("এখানেই শেষ করে ফল দেখুন", "btn-outline", function () { finish(); })
          ]));
        }
      }
      body.appendChild(el("section", { class: "card" }, kids));
    }

    function drawDone() {
      var all = st.localFailed.concat(st.serverFailed).sort(function (a, b) { return a.rowNumber - b.rowNumber; });
      var kids = [
        el("h2", { class: "h3", text: "ইমপোর্টের ফল" }),
        el("dl", { class: "dl" }, [
          ["নতুন যুক্ত হয়েছে", bn(st.res.created)], ["তথ্য হালনাগাদ হয়েছে", bn(st.res.updated)], ["আগের মতোই ছিল (বদলায়নি)", bn(st.res.unchanged)],
          ["ব্যর্থ / বাদ পড়েছে", bn(all.length)]
        ].map(function (x) { return el("div", { class: "dl-row" }, [el("dt", { text: x[0] }), el("dd", { text: x[1] })]); }))
      ];
      if (st.stopErr) kids.push(el("p", { class: "import-warn", role: "note", text: "ইমপোর্ট মাঝপথে থামানো হয়েছিল; বাকি সারিগুলো পাঠানো হয়নি।" }));
      if (all.length) {
        kids.push(el("h3", { class: "h3", text: "যে সারিগুলো ইমপোর্ট হয়নি" }));
        if (all.length > 200) kids.push(el("p", { class: "muted", text: "প্রথম ২০০টি দেখানো হচ্ছে; সবগুলো CSV-তে পাবেন।" }));
        kids.push(table(["সারি", "রেজিস্ট্রেশন", "কারণ"], all.slice(0, 200).map(function (f) {
          return el("tr", null, [td(bn(f.rowNumber)), td(short(f.reg, 30)), td(f.reason, "err-text")]);
        })));
        kids.push(el("p", { class: "hint muted", text: "CSV-তে ফাইলের সারি নম্বর ও ত্রুটির কারণ আছে। ঠিক করে একই পাতায় আবার দিন। এতে শিক্ষার্থীদের ব্যক্তিগত তথ্য আছে — অন্য কাউকে পাঠাবেন না।" }));
        kids.push(A.btn("ব্যর্থ সারিগুলো CSV করে নামান", "", function () { download("student-import-failed.csv", H.failedRowsCsv(all)); }));
      } else {
        kids.push(el("p", { class: "ok-text", text: "সব সারি ঠিকঠাক ইমপোর্ট হয়েছে।" }));
      }
      kids.push(el("div", { class: "form-actions" }, [A.btn("আরেকটি ফাইল ইমপোর্ট করুন", "btn-outline", function () { st = { stage: "idle" }; clear(body); })]));
      body.appendChild(el("section", { class: "card" }, kids));
    }

    loadRef();   // warm up in the background
    return Promise.resolve();
  };
})();
