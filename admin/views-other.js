// Admin sections: dashboard, student submissions, control panel.
(function () {
  "use strict";
  var A = window.Admin, H = A.H, L = A.L, el = A.el, clear = A.clear;
  var V = A.views = A.views || {};
  function go(hash) { location.hash = hash; }
  function settle(p) { return Promise.resolve(p).then(function (v) { return { v: v }; }, function (e) { return { e: e }; }); }
  function bn(n) { return L.bnDigits(n); }

  // ======================= DASHBOARD =======================
  V.dashboard = function (host, arg, alive) {
    function load() {
      A.loading(host);
      return Promise.all([
        settle(A.call("student_submission_counts")), settle(A.call("site_notice_list")), settle(A.call("site_person_list")),
        settle(A.call("site_gallery_list")), settle(A.call("site_download_list")), settle(A.call("site_page_list")), settle(A.call("site_settings_list"))
      ]).then(function (r) {
        if (!alive()) return;
        var counts = r[0], lists = { notices: r[1], people: r[2], gallery: r[3], downloads: r[4], pages: r[5] }, settings = r[6];
        clear(host).appendChild(A.pageTitle("ড্যাশবোর্ড"));
        if (settings.v && A.setMaintenance) A.setMaintenance(settings.v["site.maintenance_mode"] === true);
        if (r.every(function (x) { return x.e; })) { A.failed(host, r[0].e, load); return; }

        function card(title, res, link, lines) {
          var body;
          if (res.e) body = el("p", { class: "err-text", role: "alert", text: A.errText(res.e) });
          else body = el("ul", { class: "plain stat-lines" }, lines(res.v).map(function (t) { return el("li", { text: t }); }));
          return el("section", { class: "card stat" }, [el("h2", { class: "h3" }, el("a", { href: link, text: title })), body]);
        }
        function pubLines(unit) {
          return function (rows) {
            var pub = rows.filter(function (x) { return x.is_published; }).length;
            return ["প্রকাশিত " + unit + ": " + bn(pub), "খসড়া: " + bn(rows.length - pub)];
          };
        }
        var grid = el("div", { class: "stat-grid" }, [
          card("ফর্মে জমা পড়া তথ্য", counts, "#/submissions", function (c) {
            return ["অপেক্ষমাণ: " + bn(c.pending), "গৃহীত: " + bn(c.approved), "বাতিল: " + bn(c.rejected)];
          }),
          card("নোটিশ", lists.notices, "#/notices", pubLines("নোটিশ")),
          card("শিক্ষক ও কর্মচারী", lists.people, "#/people", pubLines("সদস্য")),
          card("গ্যালারি", lists.gallery, "#/gallery", pubLines("ছবি")),
          card("ডাউনলোড", lists.downloads, "#/downloads", pubLines("ফাইল")),
          card("পাতা", lists.pages, "#/pages", pubLines("পাতা"))
        ]);
        host.appendChild(grid);
        if (counts.v && counts.v.pending > 0) {
          host.appendChild(el("div", { class: "notice-bar" }, [el("span", { text: bn(counts.v.pending) + "টি তথ্য যাচাইয়ের অপেক্ষায় আছে।" }), el("a", { class: "btn btn-sm", href: "#/submissions", text: "দেখুন" })]));
        }
        host.appendChild(el("h2", { class: "h3", text: "দ্রুত কাজ" }));
        host.appendChild(el("div", { class: "quick-links" }, [
          el("a", { class: "btn", href: "#/notices/new", text: "+ নতুন নোটিশ" }), el("a", { class: "btn btn-outline", href: "#/gallery", text: "ছবি যুক্ত করুন" }),
          el("a", { class: "btn btn-outline", href: "#/downloads", text: "ফাইল যুক্ত করুন" }), el("a", { class: "btn btn-outline", href: "../index.html", target: "_blank", rel: "noopener", text: "ওয়েবসাইট দেখুন ↗" })
        ]));
      });
    }
    return load();
  };

  // ======================= SUBMISSIONS =======================
  var SUB = { status: "pending", q: "" };
  var STATUS = { pending: ["অপেক্ষমাণ", "badge-pin"], approved: ["গৃহীত", "badge-ok"], rejected: ["বাতিল", "badge-file"] };

  V.submissions = function (host, arg, alive) {
    if (L.isUuid(arg)) return subDetail(host, arg, alive);
    if (STATUS[arg]) SUB.status = arg;
    var box = el("div"), tabs = el("div", { class: "chips", role: "group", "aria-label": "অবস্থা" });
    var search = el("input", { type: "search", value: SUB.q, placeholder: "নাম, রেজিস্ট্রেশন বা মোবাইল নম্বর", "aria-label": "খুঁজুন" });
    var counts = null;
    function drawTabs() {
      clear(tabs);
      Object.keys(STATUS).forEach(function (k) {
        var n = counts && counts[k] != null ? " (" + bn(counts[k]) + ")" : "";
        tabs.appendChild(A.btn(STATUS[k][0] + n, "chip" + (SUB.status === k ? " active" : ""), function () { SUB.status = k; drawTabs(); load(); }, { "aria-pressed": SUB.status === k ? "true" : "false" }));
      });
    }
    function loadCounts() { return A.call("student_submission_counts").then(function (c) { counts = c; drawTabs(); }, function () { /* tabs without numbers */ }); }
    function load() {
      A.loading(box);
      return A.call("student_submissions_list", { p_status: SUB.status, p_search: SUB.q || null }).then(function (rows) {
        if (!alive()) return;
        rows = rows || [];
        clear(box);
        if (!rows.length) { box.appendChild(A.empty(SUB.q ? "এই খোঁজে কিছু পাওয়া যায়নি।" : "এই অবস্থায় কোনো তথ্য নেই।")); return; }
        if (rows.length >= 500) box.appendChild(el("p", { class: "muted", text: "প্রথম ৫০০টি দেখানো হচ্ছে। খুঁজে সংখ্যা কমান।" }));
        box.appendChild(el("ul", { class: "plain rows" }, rows.map(rowItem)));
      }, function (e) { if (alive()) A.failed(box, e, load); });
    }
    function rowItem(s) {
      var err = el("p", { class: "err-text row-err", role: "alert", hidden: "" });
      function showErr(t) { err.textContent = t; err.hidden = false; }
      function after() { loadCounts(); return load(); }
      var actions = [el("a", { class: "btn btn-outline btn-sm", href: "#/submissions/" + s.id, text: s.status === "pending" ? "দেখুন / সংশোধন" : "দেখুন" })];
      if (s.status === "pending") {
        actions.push(A.btn("গ্রহণ", "btn-sm", function (b) {
          A.confirm({ title: "শিক্ষার্থী যুক্ত করবেন?", message: s.name_en + " (" + s.reg_no + ") — প্রোগ্রাম, সেশন ও বর্ষ মিলিয়ে ব্যাচ বেছে নেওয়া হবে।", ok: "হ্যাঁ, গ্রহণ করুন" }).then(function (ok) {
            if (!ok) return;
            return A.run(b, function () {
              return A.call("student_submission_approve", { p_id: s.id, p_batch_id: null }, 60000).then(function (r) {
                if (r && r.ok) { A.toast(r.message || "শিক্ষার্থী যুক্ত হয়েছে"); return after(); }
                showErr((r && r.message) || "গ্রহণ করা যায়নি"); A.toast((r && r.message) || "গ্রহণ করা যায়নি", "error");
              });
            });
          });
        }));
        actions.push(A.btn("বাতিল", "btn-danger-outline btn-sm", function (b) { rejectFlow(s, b, showErr, after); }));
      }
      return el("li", { class: "row" }, [
        el("div", { class: "row-main" }, [
          el("a", { class: "row-title", href: "#/submissions/" + s.id, text: s.name_en + (s.name_bn ? " (" + s.name_bn + ")" : "") }),
          el("div", { class: "row-meta" }, [A.badge(STATUS[s.status][0], STATUS[s.status][1]), el("span", { text: "রেজি: " + s.reg_no }), el("span", { class: "muted", text: s.program + " · " + s.session + " · " + bn(s.year_of_study) + " বর্ষ" }),
            el("span", { class: "muted", text: s.mobile }), el("span", { class: "muted", text: L.formatDate(s.created_at) })]),
          err
        ]),
        el("div", { class: "row-actions" }, actions)
      ]);
    }
    var tm;
    search.addEventListener("input", function () { clearTimeout(tm); tm = setTimeout(function () { SUB.q = search.value.trim(); load(); }, 350); });
    clear(host).appendChild(A.pageTitle("ফর্মে জমা পড়া তথ্য", [
      A.btn("সব অপেক্ষমাণ গ্রহণ করুন", "btn-outline", function (b) {
        A.confirm({ title: "সব অপেক্ষমাণ তথ্য গ্রহণ করবেন?", message: "প্রতিটির জন্য প্রোগ্রাম, সেশন ও বর্ষ মিলিয়ে ব্যাচ খোঁজা হবে। যেগুলোর ব্যাচ বা অন্য কিছু মিলবে না সেগুলো গ্রহণ হবে না — তার তালিকা দেখানো হবে।", ok: "হ্যাঁ, সব গ্রহণ করুন" }).then(function (ok) {
          if (!ok) return;
          return A.run(b, function () {
            return A.call("student_submission_approve_all", {}, 120000).then(function (r) {
              showApproveAll(r);
              loadCounts(); return load();
            });
          });
        });
      })
    ]));
    host.appendChild(tabs); host.appendChild(el("div", { class: "toolbar" }, [search])); host.appendChild(box);
    drawTabs();
    loadCounts();
    return load();
  };

  function showApproveAll(r) {
    var failed = (r && r.failed) || [];
    var body = el("div", null, [
      el("p", { text: "যুক্ত হয়েছে: " + bn((r && r.added) || 0) + "টি" + (failed.length ? "; যুক্ত হয়নি: " + bn(failed.length) + "টি" : "") }),
      failed.length ? el("ul", { class: "plain fail-list" }, failed.map(function (f) { return el("li", null, [el("strong", { text: f.name + " (" + f.reg_no + "): " }), el("span", { class: "err-text", text: f.message || "" })]); })) : null
    ]);
    A.dialog({ title: "ফলাফল", body: body, buttons: [{ text: "ঠিক আছে", value: true }] });
  }

  function rejectFlow(s, btn, showErr, after) {
    var note = A.textarea("note", "", 3);
    note.setAttribute("maxlength", "500");
    return A.dialog({
      title: "তথ্য বাতিল করবেন?", message: s.name_en + " (" + s.reg_no + ")", focusFirst: true,
      body: A.field("কারণ (ঐচ্ছিক, সর্বোচ্চ ৫০০ অক্ষর)", note),
      buttons: [{ text: "না, থাক", cls: "btn-outline", value: false }, { text: "হ্যাঁ, বাতিল করুন", cls: "btn-danger", value: true }]
    }).then(function (ok) {
      if (!ok) return;
      return A.run(btn, function () {
        return A.call("student_submission_reject", { p_id: s.id, p_note: note.value.trim() || null }).then(function (r) {
          if (r && r.ok) { A.toast(r.message || "বাতিল করা হয়েছে"); return after(); }
          showErr && showErr((r && r.message) || "বাতিল করা যায়নি"); A.toast((r && r.message) || "বাতিল করা যায়নি", "error");
        });
      });
    });
  }

  var FIELDS = [
    ["reg_no", "রেজিস্ট্রেশন নম্বর *", "text"], ["name_en", "নাম (ইংরেজি) *", "text"], ["name_bn", "নাম (বাংলা)", "text"], ["roll_no", "ক্লাস রোল", "text"],
    ["father_name", "পিতার নাম *", "text"], ["mother_name", "মাতার নাম *", "text"], ["program", "প্রোগ্রাম *", "text"], ["session", "সেশন * (যেমন ২০২২-২৩ → 2022-23)", "text"],
    ["year_of_study", "বর্ষ *", "year"], ["mobile", "মোবাইল *", "text"], ["dob", "জন্মতারিখ *", "date"], ["gender", "লিঙ্গ *", "gender"],
    ["blood_group", "রক্তের গ্রুপ", "blood"], ["guardian_name", "অভিভাবকের নাম *", "text"], ["guardian_mobile", "অভিভাবকের মোবাইল *", "text"],
    ["village", "গ্রাম / মহল্লা *", "text"], ["post_office", "ডাকঘর", "text"], ["thana", "থানা *", "text"], ["district", "জেলা *", "text"]
  ];

  function subDetail(host, id, alive) {
    A.loading(host);
    var pRow = A.call("student_submissions_list", { p_status: null, p_search: null }, 30000).then(function (rows) {
      return (rows || []).filter(function (x) { return x.id === id; })[0] || null;
    });
    var pBatch = settle(A.withTimeout(A.sb.from("batches").select("id, program, session, year_of_study, is_active").is("deleted_at", null)
      .order("session", { ascending: false }).order("program"), 20000).then(function (r) { if (r.error) throw A.toError(r.error); return r.data || []; }));
    return Promise.all([settle(pRow), pBatch]).then(function (res) {
      if (!alive()) return;
      if (res[0].e) { A.failed(host, res[0].e, function () { subDetail(host, id, alive); }); return; }
      var s = res[0].v;
      if (!s) { clear(host); host.appendChild(A.empty("এই তথ্যটি পাওয়া যায়নি (৫০০টির বেশি হলে খুঁজে দেখুন)।")); host.appendChild(el("a", { class: "btn btn-outline", href: "#/submissions", text: "← তালিকা" })); return; }
      var batches = res[1].v || [];
      var pending = s.status === "pending";
      var form = el("form", { class: "form card", novalidate: "" });
      var vals = H.submissionToForm(s);
      var errBoxes = {};
      var grid = el("div", { class: "grid2" });
      FIELDS.forEach(function (fd) {
        var key = fd[0], ctl;
        if (fd[2] === "year") ctl = A.select(key, [1, 2, 3, 4, 5, 6].map(function (n) { return [String(n), bn(n) + " বর্ষ"]; }), vals[key]);
        else if (fd[2] === "gender") ctl = A.select(key, [["male", "পুরুষ"], ["female", "মহিলা"]], vals[key]);
        else if (fd[2] === "blood") ctl = A.select(key, [["", "—"]].concat(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(function (g) { return [g, g]; })), vals[key]);
        else ctl = A.input(key, vals[key], { type: fd[2] === "date" ? "date" : "text", maxlength: "120", autocomplete: "off" });
        if (!pending) ctl.setAttribute("disabled", "");
        var err = el("p", { class: "err-text field-err", role: "alert", hidden: "" });
        errBoxes[key] = err;
        var f = A.field(fd[1], ctl); f.appendChild(err); grid.appendChild(f);
      });
      form.appendChild(grid);
      var msg = el("p", { class: "err-text", role: "alert", hidden: "" });
      form.appendChild(msg);
      function showErrors(r) {
        Object.keys(errBoxes).forEach(function (k) { errBoxes[k].hidden = true; errBoxes[k].textContent = ""; });
        var errs = (r && r.errors) || {};
        Object.keys(errs).forEach(function (k) { if (errBoxes[k]) { errBoxes[k].textContent = errs[k]; errBoxes[k].hidden = false; } });
        msg.textContent = (r && r.message) || ""; msg.hidden = !msg.textContent;
      }
      function snapshot() { var o = {}; FIELDS.forEach(function (fd) { o[fd[0]] = form.elements[fd[0]].value; }); return H.formToSubmission(o); }

      var head = el("div", { class: "row-meta" }, [A.badge(STATUS[s.status][0], STATUS[s.status][1]), el("span", { class: "muted", text: "জমা: " + L.formatDate(s.created_at) }),
        s.reviewed_at ? el("span", { class: "muted", text: "যাচাই: " + L.formatDate(s.reviewed_at) }) : null, s.review_note ? el("span", { text: "কারণ: " + s.review_note }) : null]);
      clear(host).appendChild(A.pageTitle(s.name_en, [el("a", { class: "btn btn-outline", href: "#/submissions/" + s.status, text: "← তালিকা" })]));
      host.appendChild(head);

      if (pending) {
        var batchSel = el("select", { name: "batch", "aria-label": "ব্যাচ বাছুন" }, [el("option", { value: "", text: "স্বয়ংক্রিয় (প্রোগ্রাম + সেশন + বর্ষ মিলিয়ে)" })].concat(batches.map(function (b) {
          var match = b.program === s.program && b.session === s.session && b.year_of_study === s.year_of_study;
          return el("option", { value: b.id, text: b.program + " · " + b.session + " · " + bn(b.year_of_study) + " বর্ষ" + (b.is_active ? "" : " (বন্ধ)"), selected: match });
        })));
        var saveBtn = A.btn("সংশোধন সংরক্ষণ", "btn-outline", function (b) {
          A.run(b, function () {
            return A.call("student_submission_update", { p_id: s.id, p_data: snapshot() }).then(function (r) {
              showErrors(r);
              if (r && r.ok) { A.setDirty(false); A.toast(r.message || "সংশোধন সংরক্ষিত হয়েছে"); } else A.toast((r && r.message) || "সংরক্ষণ হয়নি", "error");
            });
          });
        });
        var okBtn = A.btn("গ্রহণ করে শিক্ষার্থী যুক্ত করুন", "", function (b) {
          if (A.dirty) { A.toast("আগে “সংশোধন সংরক্ষণ” চাপুন, তারপর গ্রহণ করুন।", "warn"); return; }
          A.confirm({ title: "শিক্ষার্থী যুক্ত করবেন?", message: s.name_en + " (" + s.reg_no + ")", ok: "হ্যাঁ, যুক্ত করুন" }).then(function (ok) {
            if (!ok) return;
            return A.run(b, function () {
              return A.call("student_submission_approve", { p_id: s.id, p_batch_id: batchSel.value || null }, 60000).then(function (r) {
                if (r && r.ok) { A.setDirty(false); A.toast(r.message || "শিক্ষার্থী যুক্ত হয়েছে"); go("#/submissions/pending"); }
                else { showErrors({ message: (r && r.message) || "গ্রহণ করা যায়নি" }); A.toast((r && r.message) || "গ্রহণ করা যায়নি", "error"); }
              });
            });
          });
        });
        var rejBtn = A.btn("বাতিল করুন", "btn-danger-outline", function (b) {
          rejectFlow(s, b, function (t) { showErrors({ message: t }); }, function () { A.setDirty(false); go("#/submissions/pending"); });
        });
        form.appendChild(A.field("কোন ব্যাচে যুক্ত হবে", batchSel, res[1].e ? "ব্যাচের তালিকা আনা যায়নি; স্বয়ংক্রিয় বাছাই কাজ করবে।" : "সাধারণত “স্বয়ংক্রিয়” রাখাই ঠিক। মিলে না গেলে নিজে বাছুন।"));
        form.appendChild(el("div", { class: "form-actions" }, [saveBtn, okBtn, rejBtn]));
        A.watchDirty(form);
        form.addEventListener("submit", function (ev) { ev.preventDefault(); });
      } else if (s.student_id) {
        form.appendChild(el("p", { class: "muted", text: "এই তথ্য থেকে শিক্ষার্থী তৈরি হয়ে গেছে।" }));
      }
      host.appendChild(form);
    }, function (e) { if (alive()) A.failed(host, e, function () { subDetail(host, id, alive); }); });
  }

  // ======================= CONTROL PANEL =======================
  var SET_FIELDS = [
    ["site.name_bn", "বিভাগের নাম (বাংলা) *", "text"], ["site.name_en", "বিভাগের নাম (ইংরেজি) *", "text"], ["site.college_bn", "কলেজের নাম *", "text"],
    ["site.address", "ঠিকানা", "text"], ["site.phone", "ফোন", "text"], ["site.email", "ইমেইল", "email"],
    ["site.map_url", "মানচিত্রের লিংক (https://…)", "url"], ["site.social_facebook", "Facebook লিংক (https://…)", "url"],
    ["site.social_youtube", "YouTube লিংক (https://…)", "url"], ["site.social_other", "অন্য লিংক (https://…)", "url"]
  ];

  V.control = function (host, arg, alive) {
    function load() {
      A.loading(host);
      return Promise.all([settle(A.call("site_settings_list")), settle(A.call("site_form_settings_get")), settle(A.call("site_notice_list")), settle(A.call("site_person_list")),
        settle(A.call("site_gallery_list")), settle(A.call("site_download_list")), settle(A.call("site_page_list")), settle(A.call("student_submission_counts"))]).then(function (r) {
        if (!alive()) return;
        if (r[0].e) { A.failed(host, r[0].e, load); return; }
        clear(host).appendChild(A.pageTitle("কন্ট্রোল প্যানেল"));
        var settings = r[0].v || {};
        if (A.setMaintenance) A.setMaintenance(settings["site.maintenance_mode"] === true);
        host.appendChild(siteSettingsCard(settings));
        host.appendChild(maintenanceCard(settings, load));
        host.appendChild(formCard(r[1], load));
        host.appendChild(healthCard(r.slice(2)));
      });
    }
    return load();
  };

  function siteSettingsCard(settings) {
    var form = el("form", { class: "form card", novalidate: "" });
    var errs = {}, base = {};
    form.appendChild(el("h2", { class: "h3", text: "সাইটের তথ্য" }));
    form.appendChild(el("p", { class: "muted", text: "নাম, ঠিকানা, ফোন, ইমেইল ও লিংক — সাইটের উপরে-নিচে ও যোগাযোগ পাতায় দেখা যায়। লিংক https:// দিয়ে শুরু হতে হবে।" }));
    var grid = el("div", { class: "grid2" });
    SET_FIELDS.forEach(function (fd) {
      var v = typeof settings[fd[0]] === "string" ? settings[fd[0]] : "";
      base[fd[0]] = v;
      var ctl = A.input(fd[0], v, { type: fd[2] === "text" ? "text" : fd[2], maxlength: "500", autocomplete: "off" });
      var e = el("p", { class: "err-text field-err", role: "alert", hidden: "" });
      errs[fd[0]] = e;
      var f = A.field(fd[1], ctl); f.appendChild(e); grid.appendChild(f);
    });
    form.appendChild(grid);
    var saveBtn = el("button", { type: "submit", class: "btn", text: "সংরক্ষণ করুন" });
    form.appendChild(el("div", { class: "form-actions" }, [saveBtn]));
    A.watchDirty(form);
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      A.run(saveBtn, function () {
        var changed = SET_FIELDS.filter(function (fd) { return form.elements[fd[0]].value.trim() !== base[fd[0]]; });
        if (!changed.length) { A.toast("কোনো পরিবর্তন নেই", "warn"); return; }
        var okN = 0, failN = 0, chain = Promise.resolve();
        changed.forEach(function (fd) {
          chain = chain.then(function () {
            var v = form.elements[fd[0]].value.trim();
            errs[fd[0]].hidden = true;
            return A.call("site_settings_set", { p_key: fd[0], p_value: v }).then(function () { base[fd[0]] = v; okN += 1; }, function (e) {
              failN += 1; errs[fd[0]].textContent = A.errText(e); errs[fd[0]].hidden = false;
            });
          });
        });
        return chain.then(function () {
          if (!failN) A.setDirty(false);
          A.toast(failN ? bn(okN) + "টি সংরক্ষিত, " + bn(failN) + "টিতে ভুল আছে — নিচের লাল লেখা দেখুন" : "সাইটের তথ্য সংরক্ষিত হয়েছে", failN ? "error" : "ok");
        });
      });
    });
    return form;
  }

  function maintenanceCard(settings, reload) {
    var on = settings["site.maintenance_mode"] === true;
    return el("section", { class: "card" }, [
      el("h2", { class: "h3", text: "রক্ষণাবেক্ষণ মোড" }),
      el("p", null, ["এখন: ", A.badge(on ? "চালু (সাইট বন্ধ দেখাচ্ছে)" : "বন্ধ (সাইট খোলা আছে)", on ? "badge-pin" : "badge-ok")]),
      el("p", { class: "muted", text: "চালু করলে ভিজিটররা সব পাতায় শুধু “রক্ষণাবেক্ষণ চলছে” বার্তা দেখবে। ছাত্রছাত্রীর তথ্য ফর্ম এতে বন্ধ হয় না। আপনি এই প্যানেল ঠিকই ব্যবহার করতে পারবেন।" }),
      A.btn(on ? "রক্ষণাবেক্ষণ মোড বন্ধ করুন" : "রক্ষণাবেক্ষণ মোড চালু করুন", on ? "" : "btn-danger-outline", function (b) {
        A.confirm({ title: on ? "সাইট আবার খুলবেন?" : "সাইট বন্ধ দেখাবেন?", message: on ? "সব ভিজিটর আবার সাইটের সব পাতা দেখতে পাবে।" : "চালু করলে এখনই সব ভিজিটর শুধু রক্ষণাবেক্ষণের বার্তা দেখবে।",
          ok: on ? "হ্যাঁ, খুলুন" : "হ্যাঁ, চালু করুন", danger: !on }).then(function (ok) {
          if (!ok) return;
          return A.run(b, function () {
            return A.call("site_settings_set", { p_key: "site.maintenance_mode", p_value: !on }).then(function () { A.toast(on ? "সাইট খোলা হয়েছে" : "রক্ষণাবেক্ষণ মোড চালু হয়েছে"); return reload(); });
          });
        });
      })
    ]);
  }

  function formCard(res, reload) {
    var card = el("section", { class: "card" }, [el("h2", { class: "h3", text: "শিক্ষার্থীর তথ্য ফর্ম (form.html)" })]);
    if (res.e) {
      card.appendChild(el("p", { class: "err-text", role: "alert", text: res.e.missing ? "এই অংশ চালু করতে নতুন মাইগ্রেশন ৬৩ (site_control) চালাতে হবে। তারপর পাতাটি আবার খুলুন।" : A.errText(res.e) }));
      card.appendChild(A.btn("আবার চেষ্টা করুন", "btn-outline", function () { reload(); }));
      return card;
    }
    var cur = res.v || {};
    var open = cur.enabled !== false;
    card.appendChild(el("p", null, ["ফর্ম এখন: ", A.badge(open ? "খোলা" : "বন্ধ", open ? "badge-ok" : "badge-pin")]));
    card.appendChild(A.btn(open ? "ফর্ম বন্ধ করুন" : "ফর্ম খুলুন", open ? "btn-danger-outline" : "", function (b) {
      A.confirm({ title: open ? "ফর্ম বন্ধ করবেন?" : "ফর্ম খুলবেন?", message: open ? "শিক্ষার্থীরা আর নতুন তথ্য জমা দিতে পারবে না।" : "শিক্ষার্থীরা আবার তথ্য জমা দিতে পারবে।", ok: open ? "হ্যাঁ, বন্ধ করুন" : "হ্যাঁ, খুলুন", danger: open }).then(function (ok) {
        if (!ok) return;
        return A.run(b, function () { return A.call("site_form_settings_set", { p_key: "enabled", p_value: !open }).then(function () { A.toast(open ? "ফর্ম বন্ধ করা হয়েছে" : "ফর্ম খোলা হয়েছে"); return reload(); }); });
      });
    }));
    var form = el("form", { class: "form", novalidate: "" });
    var a = A.input("max_attempts_per_reg_per_day", cur.max_attempts_per_reg_per_day, { type: "number", min: "1", max: "50", step: "1", inputmode: "numeric" });
    var n = A.input("max_new_per_hour", cur.max_new_per_hour, { type: "number", min: "1", max: "5000", step: "1", inputmode: "numeric" });
    var saveBtn = el("button", { type: "submit", class: "btn btn-outline", text: "সীমা সংরক্ষণ করুন" });
    form.appendChild(el("div", { class: "split" }, [A.field("একই রেজিস্ট্রেশন নম্বরে দিনে সর্বোচ্চ কতবার চেষ্টা (১–৫০)", a), A.field("ঘণ্টায় সর্বোচ্চ কতটি নতুন তথ্য (১–৫০০০)", n)]));
    form.appendChild(el("div", { class: "form-actions" }, [saveBtn]));
    A.watchDirty(form);
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      A.run(saveBtn, function () {
        var chain = Promise.resolve(), any = false;
        [["max_attempts_per_reg_per_day", a], ["max_new_per_hour", n]].forEach(function (p) {
          chain = chain.then(function () {
            var v = Number(p[1].value);
            if (!/^[0-9]+$/.test(p[1].value.trim())) throw A.userErr("সংখ্যা দিন");
            if (v === cur[p[0]]) return;
            any = true;
            return A.call("site_form_settings_set", { p_key: p[0], p_value: v });
          });
        });
        return chain.then(function () { A.setDirty(false); if (!any) { A.toast("কোনো পরিবর্তন নেই", "warn"); return; } A.toast("সীমা সংরক্ষিত হয়েছে"); return reload(); });
      });
    });
    card.appendChild(form);
    return card;
  }

  function healthCard(r) {
    // r: notices, people, gallery, downloads, pages, counts
    function unpub(x) { return x.e ? "জানা যায়নি" : bn((x.v || []).filter(function (i) { return !i.is_published; }).length) + "টি"; }
    function paths(x, k) { return (x.v || []).filter(function (i) { return i[k]; }).length; }
    var used = r[0].e || r[1].e || r[2].e || r[3].e ? null : paths(r[0], "attachment_path") + paths(r[1], "photo_path") + paths(r[2], "image_path") + paths(r[3], "file_path");
    var rows = [
      ["অপ্রকাশিত নোটিশ (খসড়া)", unpub(r[0])], ["অপ্রকাশিত সদস্য", unpub(r[1])], ["অপ্রকাশিত ছবি", unpub(r[2])], ["অপ্রকাশিত ডাউনলোড", unpub(r[3])], ["অপ্রকাশিত পাতা", unpub(r[4])],
      ["যাচাইয়ের অপেক্ষায় থাকা তথ্য", r[5].e ? "জানা যায়নি" : bn(r[5].v.pending) + "টি"], ["সাইটে ব্যবহৃত ফাইল (ছবি, সংযুক্তি, ডাউনলোড)", used == null ? "জানা যায়নি" : bn(used) + "টি"]
    ];
    return el("section", { class: "card" }, [el("h2", { class: "h3", text: "সাইট স্বাস্থ্য" }), el("p", { class: "muted", text: "শুধু দেখার জন্য।" }),
      el("dl", { class: "dl" }, rows.map(function (x) { return el("div", { class: "dl-row" }, [el("dt", { text: x[0] }), el("dd", { text: x[1] })]); }))]);
  }
})();
