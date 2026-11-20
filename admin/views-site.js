// Admin sections: department head corner ("বিভাগীয় প্রধান") and museum ("মিউজিয়াম").
// No raw HTML: all data goes in through textContent / DOM APIs (the el() builder of site.js).
(function () {
  "use strict";
  var A = window.Admin, H = A.H, L = A.L, S = A.S, el = A.el, clear = A.clear, U = A.ui;
  var V = A.views = A.views || {};

  function bn(n) { return L.bnDigits(n); }

  // ======================= HEAD CORNER =======================
  V.head = function (host, arg, alive) {
    A.loading(host);
    return Promise.all([A.call("site_head_get"), A.call("site_person_list")]).then(function (r) {
      if (!alive()) return;
      var cur = r[0] || {}, people = r[1] || [];
      var published = people.filter(function (p) { return p.is_published; });
      var chosen = cur.person_id || "";
      var inList = published.some(function (p) { return p.id === chosen; });

      var opts = [["", "— কাউকে বাছা হয়নি —"]].concat(published.map(function (p) {
        return [p.id, p.name + (p.designation ? " — " + p.designation : "")];
      }));
      if (chosen && !inList && cur.person) opts.push([chosen, cur.person.name + " (এখন প্রকাশিত নয়)"]);
      var sel = A.select("person_id", opts, chosen && (inList || cur.person) ? chosen : "");
      var title = A.input("title", cur.title || "বিভাগীয় প্রধানের বাণী", { maxlength: "200", required: "" });
      var body = A.textarea("body_md", cur.body_md || "", 14);
      body.setAttribute("maxlength", String(H.HEAD_BODY_MAX));
      var counter = el("p", { class: "hint muted", "aria-live": "polite" });
      var preview = el("div", { class: "article preview", "aria-live": "polite" });
      var pub = A.check("is_published", "প্রকাশ করুন", !!cur.is_published);
      var tm;
      function drawCounter() {
        var n = H.chars(body.value);
        counter.textContent = bn(n) + " / " + bn(H.HEAD_BODY_MAX) + " অক্ষর";
        counter.className = "hint " + (n > H.HEAD_BODY_MAX ? "err-text" : "muted");
      }
      function drawPreview() { clear(preview); if (body.value.trim()) S.renderMarkdown(preview, body.value); else preview.appendChild(el("p", { class: "muted", text: "লেখা শুরু করলে এখানে প্রিভিউ দেখা যাবে।" })); }
      body.addEventListener("input", function () { drawCounter(); clearTimeout(tm); tm = setTimeout(drawPreview, 150); });
      drawCounter(); drawPreview();

      // what the visitors see right now
      var visible = !!cur.is_published && !!cur.person && !!cur.person.is_published;
      var why = null;
      if (!cur.is_published) why = "বাণী এখনো প্রকাশ করা হয়নি।";
      else if (!cur.person_id) why = "কোনো ব্যক্তি বাছা হয়নি।";
      else if (!cur.person) why = "আগে বাছা ব্যক্তিকে আর পাওয়া যায়নি (মুছে ফেলা হয়েছে) — নতুন করে বাছুন।";
      else if (!cur.person.is_published) why = "বাছা ব্যক্তি “শিক্ষক ও কর্মচারী” তালিকায় প্রকাশিত নন — আগে তাঁকে প্রকাশ করুন।";

      var msg = el("p", { class: "err-text", role: "alert", hidden: "" });
      var saveBtn = el("button", { type: "submit", class: "btn", text: "সংরক্ষণ করুন" });
      var form = el("form", { class: "form card", novalidate: "" }, [
        A.field("বিভাগীয় প্রধান *", sel, published.length ? "শুধু “শিক্ষক ও কর্মচারী” তালিকায় প্রকাশিত ব্যক্তিদের থেকে বাছা যায়। নাম, পদবি ও ছবি সেখান থেকেই আসে।" : "প্রকাশিত কোনো সদস্য নেই। আগে “শিক্ষক ও কর্মচারী” পাতায় সদস্য যুক্ত করে প্রকাশ করুন।"),
        A.field("শিরোনাম *", title),
        el("div", { class: "split" }, [
          el("div", null, [A.field("বাণী", body, "# বড় শিরোনাম · ## মাঝারি · - তালিকা · **গাঢ়** · খালি লাইন দিলে নতুন অনুচ্ছেদ। সর্বোচ্চ ৬০০০ অক্ষর।"), counter]),
          el("div", null, [el("p", { class: "label-like", text: "প্রিভিউ (সাইটে যেমন দেখাবে)" }), preview])
        ]),
        el("div", { class: "checks" }, [pub]),
        msg,
        el("div", { class: "form-actions" }, [saveBtn, U.backLink("#/dashboard", "বাতিল")])
      ]);
      A.watchDirty(form);
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        msg.hidden = true;
        A.run(saveBtn, function () {
          var f = form.elements;
          var res = H.headToArgs({ person_id: f.person_id.value, title: f.title.value, body_md: f.body_md.value, publish: f.is_published.checked });
          if (res.error) { msg.textContent = res.error; msg.hidden = false; throw A.userErr(res.error); }
          return A.call("site_head_set", res.args).then(function (out) {
            A.setDirty(false);
            if (out && out.person_hidden) A.toast("সংরক্ষিত হয়েছে, কিন্তু বাছা ব্যক্তি প্রকাশিত নন — তাই সাইটে দেখা যাবে না।", "warn");
            else if (out && out.visible) A.toast("সংরক্ষিত হয়েছে — সাইটে দেখা যাবে");
            else A.toast("সংরক্ষিত হয়েছে (প্রকাশ করা নেই, তাই সাইটে দেখা যাবে না)");
            return V.head(host, arg, alive);
          });
        });
      });

      clear(host).appendChild(A.pageTitle("বিভাগীয় প্রধান"));
      host.appendChild(el("section", { class: "card" }, [
        el("p", null, ["সাইটে এখন: ", A.badge(visible ? "দেখা যাচ্ছে" : "দেখা যাচ্ছে না", visible ? "badge-ok" : "badge-pin")]),
        why ? el("p", { class: "muted", text: why }) : null,
        el("p", { class: "muted", text: "প্রকাশ করলে ওয়েবসাইটের “বিভাগীয় প্রধানের কোণ” অংশে (হোম পাতা ও বাণীর পাতা) নাম, পদবি, ছবি ও এই বাণী দেখা যাবে — নতুন ওয়েবসাইট নকশা চালু হওয়ার পর। বাণীর পাতাটি “পাতা” মেনুতেও (head-message) আছে।" }),
        el("p", null, [el("a", { href: "#/people", text: "শিক্ষক ও কর্মচারী তালিকা" })])
      ]));
      host.appendChild(form);
    }, function (e) { if (alive()) A.failed(host, e, function () { V.head(host, arg, alive); }); });
  };

  // ======================= MUSEUM =======================
  var MQ = { q: "", cat: "" };

  V.museum = function (host, arg, alive) {
    if (arg) return museumForm(host, arg, alive);
    var rows = [], box = el("div");
    var search = el("input", { type: "search", value: MQ.q, placeholder: "নাম, বৈজ্ঞানিক নাম বা ক্যাটালগ নম্বর খুঁজুন", "aria-label": "মিউজিয়াম খুঁজুন" });
    var catSel = el("select", { "aria-label": "বিভাগ" });
    function drawCats() {
      var cats = H.uniqueValues(rows.map(function (r) { return r.category; }));
      if (MQ.cat && cats.indexOf(MQ.cat) < 0) MQ.cat = "";
      clear(catSel);
      catSel.appendChild(el("option", { value: "", text: "সব বিভাগ" }));
      cats.forEach(function (c) { catSel.appendChild(el("option", { value: c, text: c, selected: c === MQ.cat })); });
    }
    function draw() {
      var q = U.norm(MQ.q.trim()), filtering = !!(q || MQ.cat);
      clear(box);
      if (!rows.length) { box.appendChild(A.empty("এখনো কোনো আইটেম নেই। “নতুন আইটেম” চেপে শুরু করুন।")); return; }
      var shown = rows.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) {
        var r = x.r;
        return (!MQ.cat || r.category === MQ.cat) &&
          (!q || U.norm(r.title_bn).indexOf(q) >= 0 || U.norm(r.title_en).indexOf(q) >= 0 || U.norm(r.scientific_name).indexOf(q) >= 0 || U.norm(r.catalog_no).indexOf(q) >= 0);
      });
      if (!shown.length) { box.appendChild(A.empty("এই খোঁজে কিছু পাওয়া যায়নি।")); return; }
      if (filtering) box.appendChild(el("p", { class: "muted", text: "খোঁজা বা বিভাগ বাছা থাকলে ↑ ↓ বোতাম বন্ধ থাকে — ক্রম বদলাতে আগে খোঁজা মুছুন।" }));
      var canMove = function () { return !filtering; };
      box.appendChild(el("ul", { class: "plain rows" }, shown.map(function (x) {
        var m = x.r;
        return el("li", { class: "row" }, [
          el("div", { class: "row-main row-photo" }, [
            A.thumb(m.photo_path, "avatar-sm", 48, 48, m.title_bn) || el("span", { class: "avatar-sm avatar-ph", "aria-hidden": "true", text: L.initials(m.title_bn) }),
            el("div", null, [el("a", { class: "row-title", href: "#/museum/" + m.id, text: m.title_bn }),
              el("div", { class: "row-meta" }, [A.badge(m.is_published ? "প্রকাশিত" : "খসড়া", m.is_published ? "badge-ok" : ""), m.category ? A.badge(m.category) : null,
                m.catalog_no ? el("span", { class: "muted", text: "ক্যাটালগ: " + m.catalog_no }) : null,
                m.scientific_name ? el("span", { class: "muted", text: m.scientific_name }) : null])])
          ]),
          el("div", { class: "row-actions" }, U.reorderBtns("site_museum_reorder", rows, x.i, canMove, load).concat([
            U.toggleBtn("site_museum_upsert", m, load), el("a", { class: "btn btn-outline btn-sm", href: "#/museum/" + m.id, text: "সম্পাদনা" }),
            A.btn("মুছুন", "btn-danger-outline btn-sm", function (b) {
              A.confirm({ title: "আইটেম মুছবেন?", message: "“" + m.title_bn + "” সাইট ও সার্ভার থেকে মুছে যাবে।", ok: "হ্যাঁ, মুছুন", danger: true }).then(function (ok) {
                if (!ok) return;
                return A.run(b, function () { return A.call("site_museum_delete", { p_id: m.id }).then(A.afterDelete).then(function (d) { if (d) { A.toast("মুছে ফেলা হয়েছে"); return load(); } }); });
              });
            })]))
        ]);
      })));
    }
    function load() {
      A.loading(box);
      return A.call("site_museum_list").then(function (r) { if (!alive()) return; rows = r || []; drawCats(); draw(); }, function (e) { if (alive()) A.failed(box, e, load); });
    }
    search.addEventListener("input", function () { MQ.q = search.value; draw(); });
    catSel.addEventListener("change", function () { MQ.cat = catSel.value; draw(); });
    clear(host).appendChild(A.pageTitle("মিউজিয়াম", [el("a", { class: "btn", href: "#/museum/new", text: "+ নতুন আইটেম" })]));
    host.appendChild(el("p", { class: "muted" }, ["প্রকাশিত আইটেম ওয়েবসাইটের মিউজিয়াম অংশে দেখা যাবে। মিউজিয়ামের ভূমিকার লেখা বদলাতে ", el("a", { href: "#/pages/museum", text: "“মিউজিয়াম” পাতা" }), " খুলুন।"]));
    host.appendChild(el("div", { class: "toolbar" }, [search, catSel]));
    host.appendChild(box);
    return load();
  };

  function museumForm(host, id, alive) {
    A.loading(host);
    return A.call("site_museum_list").then(function (rows) {
      if (!alive()) return;
      rows = rows || [];
      var cur = id === "new" ? null : rows.filter(function (r) { return r.id === id; })[0];
      if (id !== "new" && !cur) { S.showState(host, "error", "আইটেমটি পাওয়া যায়নি।"); host.appendChild(U.backLink("#/museum")); return; }
      var ph = { path: cur && cur.photo_path || null, file: null, remove: false, url: "" };
      var cats = H.uniqueValues(rows.map(function (r) { return r.category; }));
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

      var titleBn = A.input("title_bn", cur ? cur.title_bn : "", { maxlength: "200", required: "" });
      var titleEn = A.input("title_en", cur ? cur.title_en : "", { maxlength: "200" });
      var sci = A.input("scientific_name", cur ? cur.scientific_name : "", { maxlength: "200" });
      var cat = A.input("category", cur ? cur.category : "", { maxlength: "60", list: "mcats" });
      var no = A.input("catalog_no", cur && cur.catalog_no || "", { maxlength: "40" });
      var from = A.input("collected_from", cur ? cur.collected_from : "", { maxlength: "200" });
      var on = A.input("collected_on", cur && cur.collected_on || "", { type: "date", min: "1800-01-01", max: H.dhakaToday() });
      var desc = A.textarea("description", cur ? cur.description : "", 8);
      desc.setAttribute("maxlength", "3000");
      var saveBtn = el("button", { type: "submit", class: "btn", text: "সংরক্ষণ করুন" });
      form.appendChild(el("div", { class: "grid2" }, [A.field("নাম (বাংলা) *", titleBn), A.field("নাম (ইংরেজি)", titleEn),
        A.field("বৈজ্ঞানিক নাম", sci, "যেমন: Papilio demoleus"), A.field("বিভাগ", cat, "যেমন: পোকামাকড়, সরীসৃপ। আগের বিভাগগুলো সাজেশনে আসবে।"),
        A.field("ক্যাটালগ নম্বর", no, "প্রতিটি আইটেমের আলাদা হতে হবে (বড়/ছোট হাতের অক্ষর একই ধরা হয়)।"), A.field("সংগ্রহের স্থান", from),
        A.field("সংগ্রহের তারিখ", on, "ঐচ্ছিক। আজকের পরের তারিখ চলবে না।")]));
      form.appendChild(A.datalist("mcats", cats));
      form.appendChild(A.field("বিবরণ", desc, "সর্বোচ্চ ৩০০০ অক্ষর। সাধারণ লেখা — খালি লাইন দিলে নতুন অনুচ্ছেদ।"));
      form.appendChild(el("div", { class: "field" }, [el("span", { class: "label-like", text: "ছবি (ঐচ্ছিক, একটি)" }), prev, fileIn, A.uploadNote()]));
      form.appendChild(el("div", { class: "checks" }, [A.check("is_published", "প্রকাশ করুন", cur ? cur.is_published : false)]));
      var acts = [saveBtn, U.backLink("#/museum", "বাতিল")];
      if (cur) acts.push(A.btn("আইটেম মুছুন", "btn-danger-outline", function (b) {
        A.confirm({ title: "আইটেম মুছবেন?", message: "এটা চিরতরে মুছে যাবে।", ok: "হ্যাঁ, মুছুন", danger: true }).then(function (ok) {
          if (!ok) return;
          return A.run(b, function () { return A.call("site_museum_delete", { p_id: cur.id }).then(A.afterDelete).then(function (d) { if (d) { A.setDirty(false); A.toast("মুছে ফেলা হয়েছে"); U.go("#/museum"); } }); });
        });
      }));
      form.appendChild(el("div", { class: "form-actions" }, acts));
      A.watchDirty(form);
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        A.run(saveBtn, function () {
          var f = form.elements;
          var r = H.museumToPayload({ id: cur && cur.id, title_bn: f.title_bn.value, title_en: f.title_en.value, scientific_name: f.scientific_name.value, category: f.category.value,
            catalog_no: f.catalog_no.value, description: f.description.value, collected_from: f.collected_from.value, collected_on: f.collected_on.value,
            photo_path: ph.remove ? null : ph.path, is_published: f.is_published.checked });
          if (r.error) throw A.userErr(r.error);
          if (!cur) r.payload.sort_order = rows.reduce(function (m, x) { return Math.max(m, +x.sort_order || 0); }, 0) + 10;
          function save(path) { var p = Object.assign({}, r.payload); if (path) p.photo_path = path; return A.call("site_museum_upsert", { p_data: p }); }
          function finish() { A.setDirty(false); if (ph.url) URL.revokeObjectURL(ph.url); U.go("#/museum"); }
          var old = cur && cur.photo_path;
          if (ph.file) return A.uploadAndSave({ file: ph.file, wanted: "image", area: "museum", oldPath: old, save: save }).then(finish);
          return save().then(function () {
            if (old && ph.remove) return A.removeObjects([old]).then(function (ok) { if (!ok) A.warnCleanup(); });
          }).then(finish);
        }, "সংরক্ষণ হয়েছে");
      });
      clear(host).appendChild(A.pageTitle(cur ? "আইটেম সম্পাদনা" : "নতুন আইটেম"));
      host.appendChild(form);
    }, function (e) { if (alive()) A.failed(host, e, function () { museumForm(host, id, alive); }); });
  }
})();
