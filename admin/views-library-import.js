// Admin section: seminar library import from a CSV / Excel file (#/library/import).
// The file is read in the browser only (shared reader: sheet.js). Rows go to the database one chunk at a time through public.site_library_import (admin only).
// No raw HTML: all data goes in through textContent / DOM APIs. Nothing from the file is logged.
(function () {
  "use strict";
  var A = window.Admin, H = A.H, S = A.S, el = A.el, clear = A.clear;
  var FIELD = {};
  H.LIB_FIELDS.forEach(function (f) { FIELD[f.key] = f; });

  function bn(n) { return H.bnNum(n); }
  function short(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function table(head, rows) {
    return el("div", { class: "tbl-wrap" }, el("table", { class: "tbl" }, [
      el("thead", null, el("tr", null, head.map(function (h) { return el("th", { scope: "col", text: h }); }))),
      el("tbody", null, rows)
    ]));
  }
  function td(text, cls) { return el("td", { class: cls || null, text: text }); }

  A.libraryImport = function (host, alive) {
    var st = { stage: "idle" };
    var body = el("div");

    clear(host).appendChild(A.pageTitle("বই ইমপোর্ট", [
      A.btn("টেমপ্লেট CSV নামান", "btn-outline", function () { A.sheet.download("library-import-template.csv", H.libraryTemplateCsv()); }),
      el("a", { class: "btn btn-outline", href: "#/library", text: "← বইয়ের তালিকা" })
    ]));
    host.appendChild(el("section", { class: "card" }, [
      el("h2", { class: "h3", text: "কীভাবে কাজ করে" }),
      el("p", { text: "CSV বা Excel (.xlsx) ফাইল থেকে একসাথে অনেক বই সেমিনার লাইব্রেরির তালিকায় তোলা যায়। ফাইল আপনার ব্রাউজারেই পড়া হয়; যাচাই করা সারিগুলো ছোট ছোট ভাগে ডাটাবেসে যায়।" }),
      el("p", { class: "import-warn", role: "note", text: "সতর্কতা: যে সংগ্রহ নম্বর আগে থেকেই তালিকায় আছে, সেই বইয়ের তথ্য ফাইলের তথ্য দিয়ে হালনাগাদ হবে — তবে ফাইলে যে ঘর ফাঁকা, সেখানে আগের তথ্যই থাকবে। সংগ্রহ নম্বর না থাকলে প্রতিটি সারি নতুন বই হিসেবে যুক্ত হবে।" }),
      el("ul", { class: "plain" }, [
        el("li", { text: "শুধু “শিরোনাম” কলাম অবশ্যই চাই। বাকি: লেখক, বিভাগ, প্রকাশক, প্রকাশের সাল (১৫০০–২১০০), সংগ্রহ নম্বর, তাক, কপি (০–৯৯৯), মন্তব্য।" }),
        el("li", { text: "হেডিং বাংলা বা ইংরেজি হতে পারে। সর্বোচ্চ ৫ MB ও ২০০০টি সারি; একই সংগ্রহ নম্বর ফাইলে দুবার থাকলে সেই সারিগুলো বাদ যায়।" }),
        el("li", { text: "বাংলা অঙ্কও চলে (যেমন ২০১৫)। CSV অবশ্যই UTF-8 হতে হবে।" })
      ])
    ]));
    var fileInput = el("input", { type: "file", accept: ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", id: "lib-file" });
    fileInput.addEventListener("change", function () {
      var f = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (f) onFile(f);
    });
    host.appendChild(el("section", { class: "card" }, [
      el("label", { class: "label-like", for: "lib-file", text: "ফাইল বাছুন (.csv বা .xlsx)" }), fileInput,
      el("p", { class: "hint muted", text: "শুধু শিটের প্রথম পাতা পড়া হয়। ফাইলটি কোথাও আপলোড করা হয় না — শুধু যাচাই করা সারিগুলো ডাটাবেসে যায়।" })
    ]));
    host.appendChild(body);

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
      A.sheet.readGrid(file, ext).then(function (g) {
        if (!alive()) return;
        var grid = g.grid, hi = H.findLibHeaderRow(grid);
        if (hi < 0) { showError("ফাইলে কোনো তথ্য পাওয়া যায়নি।"); return; }
        var n = H.countDataRows(grid, hi);
        if (n === 0) { showError("হেডিংয়ের নিচে কোনো সারি নেই।"); return; }
        if (n > H.LIB_IMPORT_MAX_ROWS) { showError("ফাইলে " + bn(n) + "টি সারি আছে; একবারে সর্বোচ্চ " + bn(H.LIB_IMPORT_MAX_ROWS) + "টি চলে। ফাইলটি ভাগ করে আলাদা আলাদা ইমপোর্ট করুন।"); return; }
        var headers = grid[hi].map(H.cleanCell), mapping = H.autoMapLibHeaders(headers);
        st = { stage: "ready", fileName: file.name, headerIdx: hi, headers: headers, mapping: mapping, sheets: g.sheets, publish: true };
        st.built = mapping.title == null ? { rows: [] } : H.buildLibraryRows(grid, hi, mapping);
        draw();
      }).catch(function (e) { if (alive()) showError(A.errText(e)); });
    }

    function draw() {
      if (!alive()) return;
      A.setDirty(st.stage === "running" || st.stage === "stopped");
      clear(body);
      if (st.stage === "ready") drawReady();
      else if (st.stage === "running" || st.stage === "stopped") drawProgress();
      else if (st.stage === "done") drawDone();
    }

    function mappingCard() {
      var byCol = {};
      Object.keys(st.mapping).forEach(function (k) { byCol[st.mapping[k]] = k; });
      var trs = [];
      st.headers.forEach(function (h, i) {
        if (!h) return;
        var k = byCol[i], f = k && FIELD[k];
        trs.push(el("tr", null, [td(short(h, 60)), f ? td("✓ " + f.bn) : td("চেনা যায়নি — বাদ দেওয়া হবে", "muted")]));
      });
      var kids = [el("h2", { class: "h3", text: "ফাইলের হেডিং কীভাবে ধরা হয়েছে" }),
        el("p", { class: "muted", text: "ফাইল: " + short(st.fileName, 80) + " · হেডিং সারি " + bn(st.headerIdx + 1) + (st.sheets > 1 ? " · শুধু প্রথম শিট পড়া হয়েছে" : "") })];
      if (st.mapping.title == null) kids.push(el("p", { class: "err-text", role: "alert", text: "“শিরোনাম” নামের কলাম পাওয়া যায়নি, তাই ইমপোর্ট করা যাবে না। হেডিং ঠিক করে (যেমন “শিরোনাম”, “বইয়ের নাম” বা “Title”) আবার ফাইল দিন। টেমপ্লেট CSV দেখতে পারেন।" }));
      if (trs.length) kids.push(table(["ফাইলের হেডিং", "যা ধরা হয়েছে"], trs));
      return el("section", { class: "card" }, kids);
    }

    function localFailed() {
      return st.built.rows.filter(function (r) { return !r.ok; }).map(function (r) {
        return { rowNumber: r.rowNumber, raw: r.raw, reason: r.issues.filter(function (i) { return i.error; }).map(function (i) { return i.msg; }).join("; ") };
      });
    }

    function drawReady() {
      body.appendChild(mappingCard());
      if (st.mapping.title == null) return;
      var rows = st.built.rows, valid = rows.filter(function (r) { return r.ok; }), bad = rows.length - valid.length;
      var noAcc = valid.filter(function (r) { return !r.accession; }).length;
      var sum = [
        el("h2", { class: "h3", text: "যাচাইয়ের ফল" }),
        el("dl", { class: "dl" }, [["মোট সারি", bn(rows.length)], ["ঠিক আছে (ইমপোর্ট হবে)", bn(valid.length)], ["ত্রুটি আছে (বাদ যাবে)", bn(bad)],
          ["এর মধ্যে সংগ্রহ নম্বর নেই", bn(noAcc)]].map(function (x) { return el("div", { class: "dl-row" }, [el("dt", { text: x[0] }), el("dd", { text: x[1] })]); }))
      ];
      if (noAcc) sum.push(el("p", { class: "import-warn", role: "note", text: bn(noAcc) + "টি সারিতে সংগ্রহ নম্বর নেই — এগুলো সবসময় নতুন বই হিসেবে যুক্ত হবে। একই ফাইল দ্বিতীয়বার দিলে এই বইগুলো দুবার হয়ে যাবে।" }));
      if (bad) sum.push(A.btn("ত্রুটিযুক্ত সারি CSV করে নামান", "btn-outline btn-sm", function () { A.sheet.download("library-import-errors.csv", H.libFailedRowsCsv(localFailed())); }));
      body.appendChild(el("section", { class: "card" }, sum));

      if (bad) {
        var errRows = rows.filter(function (r) { return !r.ok; });
        body.appendChild(el("section", { class: "card" }, [
          el("h2", { class: "h3", text: "ত্রুটির তালিকা" }),
          errRows.length > 30 ? el("p", { class: "muted", text: "প্রথম ৩০টি দেখানো হচ্ছে; সবগুলো উপরের CSV বোতামে পাবেন।" }) : null,
          el("ul", { class: "plain fail-list" }, errRows.slice(0, 30).map(function (r) {
            return el("li", null, [el("strong", { text: "সারি " + bn(r.rowNumber) + (r.title ? " (" + short(r.title, 40) + ")" : "") + ": " }),
              el("span", { class: "err-text", text: r.issues.filter(function (i) { return i.error; }).map(function (i) { return i.msg; }).join("; ") })]);
          }))
        ]));
      }
      body.appendChild(el("section", { class: "card" }, [
        el("h2", { class: "h3", text: "প্রথম " + bn(Math.min(20, rows.length)) + "টি সারি" }),
        table(["সারি", "শিরোনাম", "লেখক", "বিভাগ", "সংগ্রহ নং", "সাল", "কপি", "অবস্থা"], rows.slice(0, 20).map(function (r) {
          var p = r.payload, errs = r.issues.filter(function (i) { return i.error; });
          return el("tr", null, [td(bn(r.rowNumber)), td(short(r.title, 50)), td(short(p.author || "", 30)), td(short(p.category || "", 20)), td(short(p.accession_no || "", 20)),
            td(p.edition_year != null ? bn(p.edition_year) : ""), td(p.copies != null ? bn(p.copies) : ""),
            r.ok ? td("ঠিক আছে") : el("td", { class: "err-text" }, errs.slice(0, 2).map(function (i) { return el("div", { text: i.msg }); }))]);
        }))
      ]));

      var pubCb = el("input", { type: "checkbox", name: "publish", checked: st.publish });
      pubCb.addEventListener("change", function () { st.publish = pubCb.checked; });
      var cb = el("input", { type: "checkbox", name: "confirm" });
      var go = A.btn("ইমপোর্ট শুরু করুন", "", function () { start(go); }, { disabled: true });
      cb.addEventListener("change", function () { go.disabled = !cb.checked || !valid.length; });
      body.appendChild(el("section", { class: "card" }, [
        el("h2", { class: "h3", text: "ইমপোর্ট শুরু" }),
        valid.length ? el("p", { text: bn(valid.length) + "টি বই ডাটাবেসে যাবে।" }) : el("p", { class: "err-text", text: "ইমপোর্ট করার মতো ঠিক সারি নেই।" }),
        el("label", { class: "check" }, [pubCb, el("span", { text: "ইমপোর্টের সাথে সাথে সাইটে প্রকাশ করুন (না চাপলে সব বই খসড়া হিসেবে যুক্ত হবে)" })]),
        el("label", { class: "check" }, [cb, el("span", { text: "আমি যাচাই করেছি" })]),
        el("div", { class: "form-actions" }, [go])
      ]));
    }

    // ---------------- running ----------------
    function start(btn) {
      if (st.stage !== "ready" || st.sending) return;
      var valid = st.built.rows.filter(function (r) { return r.ok; });
      if (!valid.length) return;
      btn.disabled = true;
      st.chunks = H.chunkList(valid, H.LIB_IMPORT_CHUNK);
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
        else st.serverFailed.push({ rowNumber: r.rowNumber, raw: r.raw, reason: x ? H.libImportErrorBn(x) : "সার্ভার এই সারির ফল পাঠায়নি — আবার চেষ্টা করুন" });
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
      var rows = part.map(function (r) { return Object.assign({}, r.payload, { is_published: !!st.publish }); });
      return A.call("site_library_import", { p_rows: rows }, 120000).then(function (res) {
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
      for (var i = st.next; i < st.chunks.length; i++) {
        st.chunks[i].forEach(function (r) { st.serverFailed.push({ rowNumber: r.rowNumber, raw: r.raw, reason: "পাঠানো হয়নি বা ফল জানা যায়নি (ইমপোর্ট মাঝপথে থামানো হয়েছে)" }); });
      }
      st.next = st.chunks.length;
      st.stage = "done"; A.setDirty(false);
      var failed = st.localFailed.length + st.serverFailed.length;
      A.toast("ইমপোর্ট শেষ: " + bn(st.res.created) + " নতুন, " + bn(st.res.updated) + " হালনাগাদ" + (failed ? ", " + bn(failed) + "টি বাদ" : ""), failed ? "warn" : "ok");
      st.built = null;   // the file contents are not kept in memory any longer
      draw();
    }

    function drawProgress() {
      var running = st.stage === "running";
      var chunk = st.chunks[st.next] || [];
      var from = chunk[0] ? chunk[0].rowNumber : 0;
      var kids = [
        el("h2", { class: "h3", text: running ? "ইমপোর্ট চলছে…" : "ইমপোর্ট থেমে গেছে" }),
        el("progress", { max: String(st.total), value: String(st.doneRows), "aria-label": "অগ্রগতি" }),
        el("p", { role: "status", text: bn(st.doneRows) + " / " + bn(st.total) + "টি বইয়ের কাজ শেষ (ভাগ " + bn(Math.min(st.next + 1, st.chunks.length)) + " / " + bn(st.chunks.length) + ")" }),
        el("p", { class: "muted", text: "যে পর্যন্ত হয়েছে: " + bn(st.res.created) + " নতুন, " + bn(st.res.updated) + " হালনাগাদ, " + bn(st.res.unchanged) + " অপরিবর্তিত, " + bn(st.serverFailed.length) + " ব্যর্থ।" })
      ];
      if (running) kids.push(el("p", { class: "import-warn", role: "note", text: "পাতাটি বন্ধ করবেন না বা অন্য জায়গায় যাবেন না।" }));
      else {
        var e = st.stopErr, noAcc = chunk.filter(function (r) { return !r.accession; }).length;
        kids.push(el("p", { class: "err-text", role: "alert", text: A.errText(e) }));
        if (e && (e.denied || e.missing)) {
          kids.push(el("p", { class: "muted", text: "এই সমস্যা আবার চেষ্টা করলে মিটবে না। যে পর্যন্ত হয়েছে তা ডাটাবেসে আছে।" }));
          kids.push(A.btn("ফল দেখুন", "btn-outline", function () { finish(); }));
        } else {
          kids.push(el("p", { text: "সারি " + bn(from) + " থেকে শুরু হওয়া ভাগটির ফল জানা যায়নি — সেটি ডাটাবেসে পৌঁছে থাকতেও পারে।" }));
          kids.push(el("p", { class: noAcc ? "import-warn" : "muted", role: "note", text: noAcc
            ? "এই ভাগে " + bn(noAcc) + "টি বইয়ের সংগ্রহ নম্বর নেই। আবার পাঠালে ভাগটি আগেই পৌঁছে থাকলে সেই বইগুলো দুবার যুক্ত হবে। নিশ্চিত না হলে “এখানেই শেষ করে ফল দেখুন” চেপে তালিকা দেখে নিন।"
            : "ভাগের প্রতিটি বইয়ের সংগ্রহ নম্বর আছে, তাই আবার পাঠালে একই বই শুধু আরেকবার একই ভাবে লেখা হবে — কোনো ক্ষতি নেই।" }));
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
        el("dl", { class: "dl" }, [["নতুন যুক্ত হয়েছে", bn(st.res.created)], ["তথ্য হালনাগাদ হয়েছে", bn(st.res.updated)], ["আগের মতোই ছিল (বদলায়নি)", bn(st.res.unchanged)],
          ["ব্যর্থ / বাদ পড়েছে", bn(all.length)]].map(function (x) { return el("div", { class: "dl-row" }, [el("dt", { text: x[0] }), el("dd", { text: x[1] })]); }))
      ];
      if (st.stopErr) kids.push(el("p", { class: "import-warn", role: "note", text: "ইমপোর্ট মাঝপথে থামানো হয়েছিল; বাকি সারিগুলো পাঠানো হয়নি।" }));
      if (all.length) {
        kids.push(el("h3", { class: "h3", text: "যে সারিগুলো ইমপোর্ট হয়নি" }));
        if (all.length > 200) kids.push(el("p", { class: "muted", text: "প্রথম ২০০টি দেখানো হচ্ছে; সবগুলো CSV-তে পাবেন।" }));
        kids.push(table(["সারি", "কারণ"], all.slice(0, 200).map(function (f) { return el("tr", null, [td(bn(f.rowNumber)), td(f.reason, "err-text")]); })));
        kids.push(el("p", { class: "hint muted", text: "CSV-তে ফাইলের সারি নম্বর ও ত্রুটির কারণ আছে। ঠিক করে একই পাতায় আবার দিন।" }));
        kids.push(A.btn("ব্যর্থ সারিগুলো CSV করে নামান", "", function () { A.sheet.download("library-import-failed.csv", H.libFailedRowsCsv(all)); }));
      } else {
        kids.push(el("p", { class: "ok-text", text: "সব সারি ঠিকঠাক ইমপোর্ট হয়েছে।" }));
      }
      kids.push(el("div", { class: "form-actions" }, [el("a", { class: "btn", href: "#/library", text: "বইয়ের তালিকা দেখুন" }),
        A.btn("আরেকটি ফাইল ইমপোর্ট করুন", "btn-outline", function () { st = { stage: "idle" }; clear(body); })]));
      body.appendChild(el("section", { class: "card" }, kids));
    }

    return Promise.resolve();
  };
})();
