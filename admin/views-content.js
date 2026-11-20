// Admin sections: notices, teachers and staff, gallery, downloads, pages.
(function () {
  "use strict";
  var A = window.Admin, H = A.H, L = A.L, S = A.S, el = A.el, clear = A.clear;
  var V = A.views = A.views || {};

  function go(hash) { location.hash = hash; }
  function listFailed(host, e, retry) { A.failed(host, e, retry); }
  function norm(s) { return String(s == null ? "" : s).toLowerCase(); }
  function backLink(hash, text) { return el("a", { class: "btn btn-outline", href: hash, text: text || "← ফিরে যান" }); }
  function fileLink(path, text) {
    var u = A.publicUrl(path);
    return u ? el("a", { href: u, target: "_blank", rel: "noopener noreferrer", text: text || path.split("/").pop() }) : null;
  }

  // publish / hide in one click (only the flag is sent; the server keeps all other fields)
  function toggleBtn(rpc, row, reload) {
    return A.btn(row.is_published ? "লুকান" : "প্রকাশ করুন", "btn-outline btn-sm", function (b) {
      A.run(b, function () {
        return A.call(rpc, { p_data: { id: row.id, is_published: !row.is_published } }).then(reload);
      }, row.is_published ? "লুকানো হয়েছে" : "প্রকাশ করা হয়েছে");
    });
  }

  // ---------------- reorder ----------------
  // rows: full list in server order. i: index in `rows`. `same(a, b)`: may these two swap? Returns a function(dir) -> promise.
  function reorderBtns(rpc, rows, i, same, reload) {
    function mk(dir, label, aria) {
      var j = i + dir;
      var can = j >= 0 && j < rows.length && same(rows[i], rows[j]);
      return A.btn(label, "btn-outline btn-sm btn-icon", function (b) {
        A.run(b, function () {
          return A.call(rpc, { p_ids: H.moveItem(rows.map(function (r) { return r.id; }), i, dir) }).then(reload);
        });
      }, { "aria-label": aria, disabled: !can });
    }
    return [mk(-1, "↑", "উপরে তুলুন"), mk(1, "↓", "নিচে নামান")];
  }

  // shared with the other admin files (views-site.js, views-library.js)
  A.ui = { go: go, norm: norm, backLink: backLink, fileLink: fileLink, toggleBtn: toggleBtn, reorderBtns: reorderBtns };

  // ======================= NOTICES =======================
  function noticeStatus(n, now) {
    if (!n.is_published) return "draft";
    if (Date.parse(n.publish_at) > now) return "scheduled";
    if (n.expires_at && Date.parse(n.expires_at) <= now) return "expired";
    return "live";
  }
  var N_LABEL = { live: ["প্রকাশিত", "badge-ok"], draft: ["খসড়া", ""], scheduled: ["নির্ধারিত", "badge-pin"], expired: ["মেয়াদ শেষ", "badge-file"] };

  V.notices = function (host, arg, alive) {
    if (arg) return noticeForm(host, arg, alive);
    var rows = [], q = "", st = "all";
    var listBox = el("div");
    var search = el("input", { type: "search", placeholder: "শিরোনাম বা বিভাগ খুঁজুন", "aria-label": "নোটিশ খুঁজুন" });
    var status = A.select("status", [["all", "সব অবস্থা"], ["live", "প্রকাশিত"], ["draft", "খসড়া"], ["scheduled", "নির্ধারিত"], ["expired", "মেয়াদ শেষ"]], "all");
    status.setAttribute("aria-label", "অবস্থা");
    function draw() {
      var now = Date.now();
      var shown = rows.filter(function (n) {
        return (st === "all" || noticeStatus(n, now) === st) && (!q || norm(n.title).indexOf(q) >= 0 || norm(n.category).indexOf(q) >= 0);
      });
      clear(listBox);
      if (!rows.length) { listBox.appendChild(A.empty("এখনো কোনো নোটিশ নেই। “নতুন নোটিশ” চেপে শুরু করুন।")); return; }
      if (!shown.length) { listBox.appendChild(A.empty("এই খোঁজে কিছু পাওয়া যায়নি।")); return; }
      listBox.appendChild(el("ul", { class: "plain rows" }, shown.map(function (n) {
        var s = N_LABEL[noticeStatus(n, now)];
        return el("li", { class: "row" }, [
          el("div", { class: "row-main" }, [
            el("a", { class: "row-title", href: "#/notices/" + n.id, text: n.title }),
            el("div", { class: "row-meta" }, [A.badge(s[0], s[1]), n.pinned ? A.badge("গুরুত্বপূর্ণ", "badge-pin") : null, n.category ? A.badge(n.category) : null,
              n.attachment_path ? A.badge("ফাইল আছে", "badge-file") : null, el("span", { class: "muted", text: L.formatDate(n.publish_at) })])
          ]),
          el("div", { class: "row-actions" }, [toggleBtn("site_notice_upsert", n, load), el("a", { class: "btn btn-outline btn-sm", href: "#/notices/" + n.id, text: "সম্পাদনা" }),
            A.btn("মুছুন", "btn-danger-outline btn-sm", function (b) { delNotice(b, n); })])
        ]);
      })));
    }
    function delNotice(b, n) {
      A.confirm({ title: "নোটিশ মুছবেন?", message: "“" + n.title + "” চিরতরে মুছে যাবে। এটা আর ফেরানো যাবে না।", ok: "হ্যাঁ, মুছুন", danger: true }).then(function (ok) {
        if (!ok) return;
        return A.run(b, function () { return A.call("site_notice_delete", { p_id: n.id }).then(A.afterDelete).then(function (d) { if (d) { A.toast("নোটিশ মুছে ফেলা হয়েছে"); return load(); } }); });
      });
    }
    function load() {
      A.loading(listBox);
      return A.call("site_notice_list").then(function (r) { if (!alive()) return; rows = r || []; draw(); }, function (e) { if (alive()) listFailed(listBox, e, load); });
    }
    search.addEventListener("input", function () { q = norm(search.value.trim()); draw(); });
    status.addEventListener("change", function () { st = status.value; draw(); });
    clear(host).appendChild(A.pageTitle("নোটিশ", [el("a", { class: "btn", href: "#/notices/new", text: "+ নতুন নোটিশ" })]));
    host.appendChild(el("div", { class: "toolbar" }, [search, status]));
    host.appendChild(listBox);
    return load();
  };

  function noticeForm(host, id, alive) {
    A.loading(host);
    return A.call("site_notice_list").then(function (rows) {
      if (!alive()) return;
      rows = rows || [];
      var cur = id === "new" ? null : rows.filter(function (r) { return r.id === id; })[0];
      if (id !== "new" && !cur) { S.showState(host, "error", "নোটিশটি পাওয়া যায়নি।"); host.appendChild(backLink("#/notices")); return; }
      var att = { path: cur && cur.attachment_path || null, file: null, remove: false };
      var cats = H.uniqueValues(rows.map(function (r) { return r.category; }));
      var form = el("form", { class: "form card", novalidate: "" });
      var title = A.input("title", cur ? cur.title : "", { maxlength: "200", required: "" });
      var cat = A.input("category", cur ? cur.category : "সাধারণ", { maxlength: "60", list: "cats" });
      var body = A.textarea("body", cur ? cur.body : "", 12);
      var preview = el("div", { class: "article preview", "aria-live": "polite" });
      var pubAt = el("input", { type: "datetime-local", name: "publish_at", value: cur ? H.isoToDhakaLocal(cur.publish_at) : H.nowDhakaLocal() });
      var expAt = el("input", { type: "datetime-local", name: "expires_at", value: cur ? H.isoToDhakaLocal(cur.expires_at) : "" });
      var attBox = el("div", { class: "att-box" });
      var fileIn = el("input", { type: "file", accept: ".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.webp", "aria-label": "সংযুক্ত ফাইল বাছুন" });
      function drawAtt() {
        clear(attBox);
        if (att.file) attBox.appendChild(el("p", null, ["নতুন ফাইল: ", el("strong", { text: att.file.name }), " (" + L.formatSize(att.file.size) + ")"]));
        else if (att.path && !att.remove) attBox.appendChild(el("p", null, ["বর্তমান ফাইল: ", fileLink(att.path)]));
        else attBox.appendChild(el("p", { class: "muted", text: att.remove ? "ফাইলটি সংরক্ষণের সময় সরানো হবে।" : "কোনো ফাইল সংযুক্ত নেই।" }));
        if (att.file) attBox.appendChild(A.btn("বাদ দিন", "btn-outline btn-sm", function () { att.file = null; fileIn.value = ""; drawAtt(); }));
        if ((att.path && !att.remove) && !att.file) attBox.appendChild(A.btn("ফাইলটি সরান", "btn-danger-outline btn-sm", function () { att.remove = true; A.setDirty(true); drawAtt(); }));
        if (att.remove && !att.file) attBox.appendChild(A.btn("সরানো বাতিল", "btn-outline btn-sm", function () { att.remove = false; drawAtt(); }));
      }
      fileIn.addEventListener("change", function () { att.file = fileIn.files[0] || null; if (att.file) att.remove = false; A.setDirty(true); drawAtt(); });
      var tm;
      function drawPreview() { clear(preview); if (body.value.trim()) S.renderPlain(preview, body.value); else preview.appendChild(el("p", { class: "muted", text: "লেখা শুরু করলে এখানে প্রিভিউ দেখা যাবে।" })); }
      body.addEventListener("input", function () { clearTimeout(tm); tm = setTimeout(drawPreview, 150); });
      drawAtt(); drawPreview();

      var saveBtn = el("button", { type: "submit", class: "btn", text: "সংরক্ষণ করুন" });
      form.appendChild(A.field("শিরোনাম *", title));
      form.appendChild(A.field("বিভাগ", cat, "যেমন: সাধারণ, ভর্তি, পরীক্ষা। আগের বিভাগগুলো সাজেশনে আসবে।"));
      form.appendChild(A.datalist("cats", cats));
      form.appendChild(el("div", { class: "split" }, [
        el("div", null, [A.field("লেখা", body, "খালি লাইন দিলে নতুন অনুচ্ছেদ হবে।")]),
        el("div", null, [el("p", { class: "label-like", text: "প্রিভিউ (সাইটে যেমন দেখাবে)" }), preview])
      ]));
      form.appendChild(el("div", { class: "split" }, [
        A.field("প্রকাশের সময়", pubAt, "ঢাকার সময় (বাংলাদেশ সময়)। ভবিষ্যতের সময় দিলে তখন থেকে দেখা যাবে।"),
        A.field("মেয়াদ শেষের সময় (ঐচ্ছিক)", expAt, "ঢাকার সময়। ফাঁকা রাখলে মেয়াদ শেষ হবে না।")
      ]));
      form.appendChild(el("div", { class: "field" }, [el("span", { class: "label-like", text: "সংযুক্ত ফাইল (ঐচ্ছিক)" }), attBox, fileIn, A.uploadNote(),
        el("p", { class: "hint muted", text: "pdf, docx, xlsx বা ছবি; সর্বোচ্চ ১০ MB। ছবি নিজে থেকেই ছোট করা হয়।" })]));
      form.appendChild(el("div", { class: "checks" }, [A.check("pinned", "গুরুত্বপূর্ণ (সবার উপরে থাকবে)", cur && cur.pinned), A.check("is_published", "প্রকাশ করুন", cur ? cur.is_published : false)]));
      var acts = [saveBtn, backLink("#/notices", "বাতিল")];
      if (cur) acts.push(A.btn("নোটিশ মুছুন", "btn-danger-outline", function (b) {
        A.confirm({ title: "নোটিশ মুছবেন?", message: "এটা চিরতরে মুছে যাবে।", ok: "হ্যাঁ, মুছুন", danger: true }).then(function (ok) {
          if (!ok) return;
          return A.run(b, function () { return A.call("site_notice_delete", { p_id: cur.id }).then(A.afterDelete).then(function (d) { if (d) { A.setDirty(false); A.toast("নোটিশ মুছে ফেলা হয়েছে"); go("#/notices"); } }); });
        });
      }));
      form.appendChild(el("div", { class: "form-actions" }, acts));
      A.watchDirty(form);

      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        A.run(saveBtn, function () {
          var f = form.elements;
          var r = H.noticeToPayload({ id: cur && cur.id, title: f.title.value, category: f.category.value, body: f.body.value, publish_at: f.publish_at.value,
            expires_at: f.expires_at.value, pinned: f.pinned.checked, is_published: f.is_published.checked, attachment_path: att.remove ? null : att.path });
          if (r.error) throw A.userErr(r.error);
          function save(path) { var p = Object.assign({}, r.payload); if (path) p.attachment_path = path; return A.call("site_notice_upsert", { p_data: p }); }
          function finish() { A.setDirty(false); go("#/notices"); }
          var old = cur && cur.attachment_path;
          if (att.file) return A.uploadAndSave({ file: att.file, wanted: "any", area: "notices", oldPath: old, save: save }).then(finish);
          return save().then(function () {
            if (old && att.remove) return A.removeObjects([old]).then(function (ok) { if (!ok) A.warnCleanup(); });
          }).then(finish);
        }, "নোটিশ সংরক্ষণ হয়েছে");
      });
      clear(host).appendChild(A.pageTitle(cur ? "নোটিশ সম্পাদনা" : "নতুন নোটিশ"));
      host.appendChild(form);
    }, function (e) { if (alive()) listFailed(host, e, function () { noticeForm(host, id, alive); }); });
  }

  // ======================= PEOPLE =======================
  V.people = function (host, arg, alive) {
    if (arg) return personForm(host, arg, alive);
    var box = el("div");
    function load() {
      A.loading(box);
      return A.call("site_person_list").then(function (rows) {
        if (!alive()) return;
        rows = rows || [];
        clear(box);
        if (!rows.length) { box.appendChild(A.empty("এখনো কেউ যুক্ত হননি। “নতুন সদস্য” চেপে শুরু করুন।")); return; }
        var sameKind = function (a, b) { return a.kind === b.kind; };
        box.appendChild(el("ul", { class: "plain rows" }, rows.map(function (p, i) {
          return el("li", { class: "row" }, [
            el("div", { class: "row-main row-photo" }, [
              A.thumb(p.photo_path, "avatar-sm", 48, 48, p.name) || el("span", { class: "avatar-sm avatar-ph", "aria-hidden": "true", text: L.initials(p.name) }),
              el("div", null, [el("a", { class: "row-title", href: "#/people/" + p.id, text: p.name }),
                el("div", { class: "row-meta" }, [A.badge(p.kind === "teacher" ? "শিক্ষক" : "কর্মচারী"), p.designation ? el("span", { class: "muted", text: p.designation }) : null,
                  A.badge(p.is_published ? "প্রকাশিত" : "খসড়া", p.is_published ? "badge-ok" : "")])])
            ]),
            el("div", { class: "row-actions" }, reorderBtns("site_person_reorder", rows, i, sameKind, load).concat([
              toggleBtn("site_person_upsert", p, load), el("a", { class: "btn btn-outline btn-sm", href: "#/people/" + p.id, text: "সম্পাদনা" }),
              A.btn("মুছুন", "btn-danger-outline btn-sm", function (b) {
                A.confirm({ title: "সদস্য মুছবেন?", message: "“" + p.name + "” সাইট থেকে মুছে যাবে।", ok: "হ্যাঁ, মুছুন", danger: true }).then(function (ok) {
                  if (!ok) return;
                  return A.run(b, function () { return A.call("site_person_delete", { p_id: p.id }).then(A.afterDelete).then(function (d) { if (d) { A.toast("মুছে ফেলা হয়েছে"); return load(); } }); });
                });
              })]))
          ]);
        })));
      }, function (e) { if (alive()) listFailed(box, e, load); });
    }
    clear(host).appendChild(A.pageTitle("শিক্ষক ও কর্মচারী", [el("a", { class: "btn", href: "#/people/new", text: "+ নতুন সদস্য" })]));
    host.appendChild(el("p", { class: "muted", text: "সাইটে শিক্ষকরা আগে, তারপর কর্মচারীরা দেখা যায়। ↑ ↓ বোতামে একই ধরনের সদস্যদের ক্রম বদলান।" }));
    host.appendChild(box);
    return load();
  };

  function personForm(host, id, alive) {
    A.loading(host);
    return A.call("site_person_list").then(function (rows) {
      if (!alive()) return;
      rows = rows || [];
      var cur = id === "new" ? null : rows.filter(function (r) { return r.id === id; })[0];
      if (id !== "new" && !cur) { S.showState(host, "error", "সদস্যকে পাওয়া যায়নি।"); host.appendChild(backLink("#/people")); return; }
      var ph = { path: cur && cur.photo_path || null, file: null, remove: false, url: "" };
      var form = el("form", { class: "form card", novalidate: "" });
      var prev = el("div", { class: "photo-prev" });
      var fileIn = el("input", { type: "file", accept: ".jpg,.jpeg,.png,.webp", "aria-label": "ছবি বাছুন" });
      function drawPhoto() {
        clear(prev);
        var img = ph.file ? (ph.url = ph.url || URL.createObjectURL(ph.file)) : (ph.path && !ph.remove ? A.publicUrl(ph.path) : "");
        if (img) prev.appendChild(el("img", { class: "photo-big", src: img, alt: "ছবির প্রিভিউ", width: "120", height: "120" }));
        else prev.appendChild(el("p", { class: "muted", text: ph.remove ? "ছবিটি সংরক্ষণের সময় সরানো হবে।" : "কোনো ছবি নেই।" }));
        if (ph.file) prev.appendChild(A.btn("বাদ দিন", "btn-outline btn-sm", function () { if (ph.url) URL.revokeObjectURL(ph.url); ph.url = ""; ph.file = null; fileIn.value = ""; drawPhoto(); }));
        else if (ph.path && !ph.remove) prev.appendChild(A.btn("ছবি সরান", "btn-danger-outline btn-sm", function () { ph.remove = true; A.setDirty(true); drawPhoto(); }));
        else if (ph.remove) prev.appendChild(A.btn("সরানো বাতিল", "btn-outline btn-sm", function () { ph.remove = false; drawPhoto(); }));
      }
      fileIn.addEventListener("change", function () {
        if (ph.url) { URL.revokeObjectURL(ph.url); ph.url = ""; }
        ph.file = fileIn.files[0] || null; if (ph.file) ph.remove = false; A.setDirty(true); drawPhoto();
      });
      drawPhoto();
      var kind = A.select("kind", [["teacher", "শিক্ষক"], ["staff", "কর্মচারী"]], cur ? cur.kind : "teacher");
      var name = A.input("name", cur ? cur.name : "", { maxlength: "120", required: "" });
      var des = A.input("designation", cur ? cur.designation : "", { maxlength: "120" });
      var bio = A.textarea("bio", cur ? cur.bio : "", 6);
      var mail = A.input("email_public", cur && cur.email_public || "", { type: "email", maxlength: "120", autocomplete: "off" });
      var saveBtn = el("button", { type: "submit", class: "btn", text: "সংরক্ষণ করুন" });
      form.appendChild(A.field("ধরন *", kind));
      form.appendChild(A.field("নাম *", name));
      form.appendChild(A.field("পদবি", des, "যেমন: অধ্যাপক, সহকারী অধ্যাপক, অফিস সহায়ক"));
      form.appendChild(A.field("সংক্ষিপ্ত পরিচিতি", bio, "সর্বোচ্চ ২০০০ অক্ষর। শুধু যা সবার জানাতে চান তা-ই লিখুন।"));
      form.appendChild(A.field("প্রকাশ্য ইমেইল (ঐচ্ছিক)", mail, "সাইটে সবাই দেখতে পাবে। ব্যক্তিগত ইমেইল দেবেন না।"));
      form.appendChild(el("div", { class: "field" }, [el("span", { class: "label-like", text: "ছবি (ঐচ্ছিক)" }), prev, fileIn, A.uploadNote()]));
      form.appendChild(el("div", { class: "checks" }, [A.check("is_published", "প্রকাশ করুন", cur ? cur.is_published : false)]));
      form.appendChild(el("div", { class: "form-actions" }, [saveBtn, backLink("#/people", "বাতিল")]));
      A.watchDirty(form);
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        A.run(saveBtn, function () {
          var f = form.elements;
          var r = H.personToPayload({ id: cur && cur.id, kind: f.kind.value, name: f.name.value, designation: f.designation.value, bio: f.bio.value,
            email_public: f.email_public.value, photo_path: ph.remove ? null : ph.path, is_published: f.is_published.checked });
          if (r.error) throw A.userErr(r.error);
          if (!cur) r.payload.sort_order = rows.reduce(function (m, x) { return Math.max(m, +x.sort_order || 0); }, 0) + 10;
          function save(path) { var p = Object.assign({}, r.payload); if (path) p.photo_path = path; return A.call("site_person_upsert", { p_data: p }); }
          function finish() { A.setDirty(false); if (ph.url) URL.revokeObjectURL(ph.url); go("#/people"); }
          var old = cur && cur.photo_path;
          if (ph.file) return A.uploadAndSave({ file: ph.file, wanted: "image", area: "people", oldPath: old, save: save }).then(finish);
          return save().then(function () {
            if (old && ph.remove) return A.removeObjects([old]).then(function (ok) { if (!ok) A.warnCleanup(); });
          }).then(finish);
        }, "সংরক্ষণ হয়েছে");
      });
      clear(host).appendChild(A.pageTitle(cur ? "সদস্য সম্পাদনা" : "নতুন সদস্য"));
      host.appendChild(form);
    }, function (e) { if (alive()) listFailed(host, e, function () { personForm(host, id, alive); }); });
  }

  // ======================= GALLERY =======================
  V.gallery = function (host, arg, alive) {
    var rows = [], album = null, done = {};
    var listBox = el("div"), chips = el("div", { class: "chips", role: "group", "aria-label": "অ্যালবাম" });
    var upBox = el("div", { class: "card upload-card" });
    var albumIn = A.input("album", "", { maxlength: "80", list: "albums", placeholder: "অ্যালবামের নাম (ঐচ্ছিক)" });
    var pubIn = A.check("pub", "যুক্ত করার সাথে সাথে প্রকাশ করুন", false);
    var fileIn = el("input", { type: "file", multiple: "", accept: ".jpg,.jpeg,.png,.webp", "aria-label": "ছবি বাছুন (একসাথে অনেক)" });
    var progress = el("div");
    var datalist = A.datalist("albums", []);

    fileIn.addEventListener("change", function () {
      var files = fileIn.files;
      if (!files || !files.length) return;
      var alb = albumIn.value.trim(), pub = pubIn.querySelector("input").checked;
      fileIn.disabled = true;
      var base = rows.reduce(function (m, x) { return Math.max(m, +x.sort_order || 0); }, 0);
      var n = 0;
      A.uploadMany(progress, {
        files: files, wanted: "image", area: "gallery", done: done,
        save: function (path, size, f) {
          n += 1;
          var title = f.name.replace(/\.[A-Za-z0-9]{1,8}$/, "").slice(0, 150);
          return A.call("site_gallery_upsert", { p_data: { title: title, caption: "", album: alb, image_path: path, sort_order: base + n * 10, is_published: pub } });
        },
        onDone: function () { fileIn.value = ""; fileIn.disabled = false; load(true); }
      });
    });
    upBox.appendChild(el("h2", { class: "h3", text: "ছবি যুক্ত করুন" }));
    upBox.appendChild(el("div", { class: "split" }, [A.field("অ্যালবাম", albumIn), el("div", { class: "field" }, [el("span", { class: "label-like", text: "প্রকাশ" }), pubIn])]));
    upBox.appendChild(datalist);
    upBox.appendChild(A.field("ছবি বাছুন (একসাথে অনেকগুলো)", fileIn, "jpg, png, webp; সর্বোচ্চ ১০ MB। বড় ছবি নিজে থেকেই ১৬০০ px-এ ছোট করা হয়।"));
    upBox.appendChild(A.uploadNote());
    upBox.appendChild(progress);

    function drawChips() {
      var albums = H.uniqueValues(rows.map(function (r) { return r.album; }));
      clear(chips);
      function chip(label, val) {
        var b = A.btn(label, "chip" + (album === val ? " active" : ""), function () { album = val; drawChips(); draw(); }, { "aria-pressed": album === val ? "true" : "false" });
        chips.appendChild(b);
      }
      chip("সব (" + L.bnDigits(rows.length) + ")", null);
      albums.forEach(function (a) { chip(a + " (" + L.bnDigits(rows.filter(function (r) { return r.album === a; }).length) + ")", a); });
      if (rows.some(function (r) { return !r.album; })) chip("অ্যালবামহীন", "");
      clear(datalist); albums.forEach(function (a) { datalist.appendChild(el("option", { value: a })); });
    }
    function draw() {
      clear(listBox);
      if (!rows.length) { listBox.appendChild(A.empty("এখনো কোনো ছবি নেই। উপরে ছবি বেছে যুক্ত করুন।")); return; }
      var shown = rows.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) { return album === null || x.r.album === album; });
      if (!shown.length) { listBox.appendChild(A.empty("এই অ্যালবামে ছবি নেই।")); return; }
      var sameAlbum = function (a, b) { return a.album === b.album; };
      listBox.appendChild(el("ul", { class: "plain photo-grid" }, shown.map(function (x) {
        var g = x.r;
        return el("li", { class: "photo-card" }, [
          A.thumb(g.image_path, "photo-thumb", 160, 120, g.title || "ছবি"),
          el("div", { class: "photo-info" }, [el("strong", { text: g.title || "(নামহীন)" }), el("div", { class: "row-meta" }, [g.album ? A.badge(g.album) : null, A.badge(g.is_published ? "প্রকাশিত" : "খসড়া", g.is_published ? "badge-ok" : "")])]),
          el("div", { class: "row-actions" }, reorderBtns("site_gallery_reorder", rows, x.i, sameAlbum, function () { return load(true); }).concat([
            toggleBtn("site_gallery_upsert", g, function () { return load(true); }),
            A.btn("সম্পাদনা", "btn-outline btn-sm", function () { editPhoto(g); }),
            A.btn("মুছুন", "btn-danger-outline btn-sm", function (b) {
              A.confirm({ title: "ছবি মুছবেন?", message: "ছবিটি সাইট থেকে ও সার্ভার থেকে মুছে যাবে।", ok: "হ্যাঁ, মুছুন", danger: true }).then(function (ok) {
                if (!ok) return;
                return A.run(b, function () { return A.call("site_gallery_delete", { p_id: g.id }).then(A.afterDelete).then(function (d) { if (d) { A.toast("ছবি মুছে ফেলা হয়েছে"); return load(true); } }); });
              });
            })]))
        ]);
      })));
    }
    function editPhoto(g) {
      var t = A.input("title", g.title, { maxlength: "150" }), c = A.textarea("caption", g.caption, 3), al = A.input("album", g.album, { maxlength: "80", list: "albums" });
      var pub = A.check("is_published", "প্রকাশিত", g.is_published);
      var body = el("div", { class: "form" }, [A.field("শিরোনাম", t), A.field("ক্যাপশন", c), A.field("অ্যালবাম", al), pub]);
      A.dialog({
        title: "ছবির তথ্য", body: body, focusFirst: true,
        buttons: [{ text: "বাতিল", cls: "btn-outline", value: false }, { text: "সংরক্ষণ করুন", value: true }]
      }).then(function (ok) {
        if (!ok) return;
        var r = H.galleryToPayload({ id: g.id, image_path: g.image_path, title: t.value, caption: c.value, album: al.value, is_published: pub.querySelector("input").checked });
        if (r.error) { A.toast(r.error, "error"); return; }
        return A.run(null, function () { return A.call("site_gallery_upsert", { p_data: r.payload }).then(function () { return load(true); }); }, "সংরক্ষণ হয়েছে");
      });
    }
    function load(quiet) {
      if (!quiet) A.loading(listBox);
      return A.call("site_gallery_list").then(function (r) { if (!alive()) return; rows = r || []; if (album !== null && !rows.some(function (x) { return x.album === album; })) album = null; drawChips(); draw(); },
        function (e) { if (alive()) listFailed(listBox, e, function () { load(); }); });
    }
    clear(host).appendChild(A.pageTitle("গ্যালারি"));
    host.appendChild(upBox); host.appendChild(chips); host.appendChild(listBox);
    return load();
  };

  // ======================= DOWNLOADS =======================
  V.downloads = function (host, arg, alive) {
    var rows = [], done = {};
    var listBox = el("div"), progress = el("div");
    var catIn = A.input("category", "", { maxlength: "60", list: "dcats", placeholder: "যেমন: সিলেবাস, ফর্ম, রুটিন" });
    var datalist = A.datalist("dcats", []);
    var pubIn = A.check("pub", "যুক্ত করার সাথে সাথে প্রকাশ করুন", false);
    var fileIn = el("input", { type: "file", multiple: "", accept: ".pdf,.docx,.xlsx", "aria-label": "ফাইল বাছুন (একসাথে অনেক)" });
    fileIn.addEventListener("change", function () {
      var files = fileIn.files;
      if (!files || !files.length) return;
      var cat = catIn.value.trim(), pub = pubIn.querySelector("input").checked;
      fileIn.disabled = true;
      var base = rows.reduce(function (m, x) { return Math.max(m, +x.sort_order || 0); }, 0), n = 0;
      A.uploadMany(progress, {
        files: files, wanted: "file", area: "downloads", done: done,
        save: function (path, size, f) {
          n += 1;
          var title = f.name.replace(/\.[A-Za-z0-9]{1,8}$/, "").slice(0, 200) || "ফাইল";
          return A.call("site_download_upsert", { p_data: { title: title, category: cat, file_path: path, file_size: size, sort_order: base + n * 10, is_published: pub } });
        },
        onDone: function () { fileIn.value = ""; fileIn.disabled = false; load(true); }
      });
    });
    var upBox = el("div", { class: "card upload-card" }, [
      el("h2", { class: "h3", text: "ফাইল যুক্ত করুন" }),
      el("div", { class: "split" }, [A.field("বিভাগ", catIn), el("div", { class: "field" }, [el("span", { class: "label-like", text: "প্রকাশ" }), pubIn])]),
      datalist,
      A.field("ফাইল বাছুন (একসাথে অনেকগুলো)", fileIn, "pdf, docx, xlsx; সর্বোচ্চ ১০ MB। ফাইলের নামটিই প্রথমে শিরোনাম হবে — পরে সম্পাদনা করতে পারবেন।"),
      A.uploadNote(), progress
    ]);
    function draw() {
      clear(listBox);
      clear(datalist); H.uniqueValues(rows.map(function (r) { return r.category; })).forEach(function (a) { datalist.appendChild(el("option", { value: a })); });
      if (!rows.length) { listBox.appendChild(A.empty("এখনো কোনো ফাইল নেই। উপরে ফাইল বেছে যুক্ত করুন।")); return; }
      listBox.appendChild(el("ul", { class: "plain rows" }, rows.map(function (d, i) {
        return el("li", { class: "row" }, [
          el("div", { class: "row-main" }, [
            el("span", { class: "row-title", text: d.title }),
            el("div", { class: "row-meta" }, [d.category ? A.badge(d.category) : null, A.badge(d.is_published ? "প্রকাশিত" : "খসড়া", d.is_published ? "badge-ok" : ""),
              el("span", { class: "muted", text: (H.extOf(d.file_path) || "").toUpperCase() + (d.file_size != null ? " · " + L.formatSize(d.file_size) : "") }), fileLink(d.file_path, "খুলে দেখুন")])
          ]),
          el("div", { class: "row-actions" }, reorderBtns("site_download_reorder", rows, i, function () { return true; }, function () { return load(true); }).concat([
            toggleBtn("site_download_upsert", d, function () { return load(true); }),
            A.btn("সম্পাদনা", "btn-outline btn-sm", function () { editDl(d); }),
            A.btn("মুছুন", "btn-danger-outline btn-sm", function (b) {
              A.confirm({ title: "ফাইল মুছবেন?", message: "“" + d.title + "” সাইট ও সার্ভার থেকে মুছে যাবে।", ok: "হ্যাঁ, মুছুন", danger: true }).then(function (ok) {
                if (!ok) return;
                return A.run(b, function () { return A.call("site_download_delete", { p_id: d.id }).then(A.afterDelete).then(function (x) { if (x) { A.toast("ফাইল মুছে ফেলা হয়েছে"); return load(true); } }); });
              });
            })]))
        ]);
      })));
    }
    function editDl(d) {
      var t = A.input("title", d.title, { maxlength: "200" }), c = A.input("category", d.category, { maxlength: "60", list: "dcats" });
      var pub = A.check("is_published", "প্রকাশিত", d.is_published);
      A.dialog({ title: "ফাইলের তথ্য", body: el("div", { class: "form" }, [A.field("শিরোনাম *", t), A.field("বিভাগ", c), pub]), focusFirst: true,
        buttons: [{ text: "বাতিল", cls: "btn-outline", value: false }, { text: "সংরক্ষণ করুন", value: true }] }).then(function (ok) {
        if (!ok) return;
        var r = H.downloadToPayload({ id: d.id, title: t.value, category: c.value, file_path: d.file_path, is_published: pub.querySelector("input").checked });
        if (r.error) { A.toast(r.error, "error"); return; }
        return A.run(null, function () { return A.call("site_download_upsert", { p_data: r.payload }).then(function () { return load(true); }); }, "সংরক্ষণ হয়েছে");
      });
    }
    function load(quiet) {
      if (!quiet) A.loading(listBox);
      return A.call("site_download_list").then(function (r) { if (!alive()) return; rows = r || []; draw(); }, function (e) { if (alive()) listFailed(listBox, e, function () { load(); }); });
    }
    clear(host).appendChild(A.pageTitle("ডাউনলোড"));
    host.appendChild(upBox); host.appendChild(listBox);
    return load();
  };

  // ======================= PAGES =======================
  var CORE_SLUGS = ["about", "history", "vision", "contact", "head-message", "seminar-library", "museum"];   // never deletable here
  var SLUG_NAMES = { about: "পরিচিতি", history: "ইতিহাস", vision: "লক্ষ্য ও উদ্দেশ্য", contact: "যোগাযোগ",
    "head-message": "বিভাগীয় প্রধানের বাণী", "seminar-library": "সেমিনার লাইব্রেরি", museum: "মিউজিয়াম" };

  V.pages = function (host, arg, alive) {
    if (arg) return pageForm(host, arg, alive);
    var box = el("div");
    var slugIn = A.input("slug", "", { maxlength: "60", placeholder: "নতুন পাতার নাম, যেমন: research", autocapitalize: "off", "aria-label": "নতুন পাতার slug" });
    function load() {
      A.loading(box);
      return A.call("site_page_list").then(function (rows) {
        if (!alive()) return;
        rows = rows || [];
        clear(box);
        if (!rows.length) { box.appendChild(A.empty("কোনো পাতা নেই।")); return; }
        box.appendChild(el("ul", { class: "plain rows" }, rows.map(function (p) {
          return el("li", { class: "row" }, [
            el("div", { class: "row-main" }, [el("a", { class: "row-title", href: "#/pages/" + p.slug, text: p.title }),
              el("div", { class: "row-meta" }, [A.badge(p.slug), SLUG_NAMES[p.slug] ? el("span", { class: "muted", text: SLUG_NAMES[p.slug] }) : null, A.badge(p.is_published ? "প্রকাশিত" : "খসড়া", p.is_published ? "badge-ok" : "")])]),
            el("div", { class: "row-actions" }, [el("a", { class: "btn btn-outline btn-sm", href: "#/pages/" + p.slug, text: "সম্পাদনা" })])
          ]);
        })));
      }, function (e) { if (alive()) listFailed(box, e, load); });
    }
    clear(host).appendChild(A.pageTitle("পাতা"));
    host.appendChild(el("p", { class: "muted", text: "পরিচিতি, ইতিহাস, লক্ষ্য ও যোগাযোগ পাতার লেখা এখানে বদলান। লেখায় # শিরোনাম, - তালিকা, **গাঢ়**, *বাঁকা*, [লেখা](https://…) চলবে।" }));
    host.appendChild(el("form", { class: "toolbar", novalidate: "" }, [slugIn, el("button", { type: "submit", class: "btn btn-outline", text: "নতুন পাতা খুলুন" })]));
    host.lastChild.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var s = slugIn.value.trim().toLowerCase();
      if (!H.isValidSlug(s)) { A.toast("পাতার নাম (slug): ছোট ইংরেজি অক্ষর, সংখ্যা ও - চলবে", "error"); return; }
      go("#/pages/" + s);
    });
    host.appendChild(box);
    return load();
  };

  function pageForm(host, slug, alive) {
    A.loading(host);
    return A.call("site_page_list").then(function (rows) {
      if (!alive()) return;
      var cur = (rows || []).filter(function (r) { return r.slug === slug; })[0];
      var form = el("form", { class: "form card", novalidate: "" });
      var title = A.input("title", cur ? cur.title : (SLUG_NAMES[slug] || ""), { maxlength: "200", required: "" });
      var body = A.textarea("body_md", cur ? cur.body_md : "", 14);
      var preview = el("div", { class: "article preview", "aria-live": "polite" });
      var tm;
      function drawPreview() { clear(preview); if (body.value.trim()) S.renderMarkdown(preview, body.value); else preview.appendChild(el("p", { class: "muted", text: "লেখা শুরু করলে এখানে প্রিভিউ দেখা যাবে।" })); }
      body.addEventListener("input", function () { clearTimeout(tm); tm = setTimeout(drawPreview, 150); });
      drawPreview();
      var saveBtn = el("button", { type: "submit", class: "btn", text: "সংরক্ষণ করুন" });
      form.appendChild(el("p", null, ["পাতার নাম (slug): ", el("strong", { text: slug }), cur ? "" : " — নতুন পাতা (সংরক্ষণ করলে তৈরি হবে)"]));
      form.appendChild(A.field("শিরোনাম *", title));
      form.appendChild(el("div", { class: "split" }, [A.field("লেখা", body, "# বড় শিরোনাম · ## মাঝারি · - তালিকা · 1. ক্রমিক তালিকা · --- রেখা"),
        el("div", null, [el("p", { class: "label-like", text: "প্রিভিউ (সাইটে যেমন দেখাবে)" }), preview])]));
      form.appendChild(el("div", { class: "checks" }, [A.check("is_published", "প্রকাশ করুন", cur ? cur.is_published : false)]));
      var acts = [saveBtn, backLink("#/pages", "বাতিল")];
      if (cur && CORE_SLUGS.indexOf(slug) < 0) acts.push(A.btn("পাতা মুছুন", "btn-danger-outline", function (b) {
        A.confirm({ title: "পাতা মুছবেন?", message: "“" + cur.title + "” চিরতরে মুছে যাবে।", ok: "হ্যাঁ, মুছুন", danger: true }).then(function (ok) {
          if (!ok) return;
          return A.run(b, function () { return A.call("site_page_delete", { p_slug: slug }).then(A.afterDelete).then(function (d) { if (d) { A.setDirty(false); A.toast("পাতা মুছে ফেলা হয়েছে"); go("#/pages"); } }); });
        });
      }));
      form.appendChild(el("div", { class: "form-actions" }, acts));
      A.watchDirty(form);
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        A.run(saveBtn, function () {
          var f = form.elements;
          var r = H.pageToPayload({ slug: slug, title: f.title.value, body_md: f.body_md.value, is_published: f.is_published.checked });
          if (r.error) throw A.userErr(r.error);
          return A.call("site_page_upsert", { p_data: r.payload }).then(function () { A.setDirty(false); go("#/pages"); });
        }, "পাতা সংরক্ষণ হয়েছে");
      });
      clear(host).appendChild(A.pageTitle(cur ? "পাতা সম্পাদনা" : "নতুন পাতা"));
      host.appendChild(form);
    }, function (e) { if (alive()) listFailed(host, e, function () { pageForm(host, slug, alive); }); });
  }
})();
