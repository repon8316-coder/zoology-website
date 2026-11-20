// Admin section: seminar library catalogue ("সেমিনার লাইব্রেরি"): search + pages, add / edit / delete. The CSV / Excel import is in views-library-import.js.
// No raw HTML: all data goes in through textContent / DOM APIs.
(function () {
  "use strict";
  var A = window.Admin, H = A.H, L = A.L, S = A.S, el = A.el, clear = A.clear, U = A.ui;
  var V = A.views = A.views || {};
  var PAGE = 25;
  var LQ = { q: "", page: 0 };          // kept while the admin goes to a form and back
  var cache = {};                       // id -> row, from the list that was shown last

  function bn(n) { return L.bnDigits(n); }

  function fetchPage(q, page, size) {
    return A.call("site_library_list", { p_q: q || null, p_limit: size || PAGE, p_offset: page * (size || PAGE) });
  }

  // The edit form is reached from the list (the row is in the cache). After a reload of the page the row is searched page by page.
  function findBook(id) {
    if (cache[id]) return Promise.resolve(cache[id]);
    function step(offset) {
      return A.call("site_library_list", { p_q: null, p_limit: 200, p_offset: offset }).then(function (r) {
        var items = (r && r.items) || [];
        for (var i = 0; i < items.length; i++) { cache[items[i].id] = items[i]; }
        if (cache[id]) return cache[id];
        if (!items.length || offset + items.length >= ((r && r.total) || 0) || offset >= 10000) return null;
        return step(offset + 200);
      });
    }
    return step(0);
  }

  V.library = function (host, arg, alive) {
    if (arg === "import") return A.libraryImport(host, alive);
    if (arg) return bookForm(host, arg, alive);
    var box = el("div"), total = 0, pager = el("div", { class: "form-actions" });
    var search = el("input", { type: "search", value: LQ.q, placeholder: "শিরোনাম, লেখক, সংগ্রহ নম্বর বা প্রকাশক খুঁজুন", "aria-label": "বই খুঁজুন" });

    function drawPager() {
      clear(pager);
      var pages = Math.max(1, Math.ceil(total / PAGE));
      if (total <= PAGE) return;
      pager.appendChild(A.btn("← আগের", "btn-outline btn-sm", function () { LQ.page = Math.max(0, LQ.page - 1); load(); }, { disabled: LQ.page <= 0 }));
      pager.appendChild(el("span", { class: "muted", role: "status", text: "পাতা " + bn(LQ.page + 1) + " / " + bn(pages) + " · মোট " + bn(total) + "টি" }));
      pager.appendChild(A.btn("পরের →", "btn-outline btn-sm", function () { LQ.page = Math.min(pages - 1, LQ.page + 1); load(); }, { disabled: LQ.page >= pages - 1 }));
    }
    function draw(items) {
      clear(box);
      if (!items.length) { box.appendChild(A.empty(LQ.q ? "এই খোঁজে কিছু পাওয়া যায়নি।" : "এখনো কোনো বই নেই। “নতুন বই” চেপে শুরু করুন, অথবা ফাইল থেকে ইমপোর্ট করুন।")); return; }
      box.appendChild(el("ul", { class: "plain rows" }, items.map(function (b) {
        return el("li", { class: "row" }, [
          el("div", { class: "row-main" }, [
            el("a", { class: "row-title", href: "#/library/" + b.id, text: b.title }),
            el("div", { class: "row-meta" }, [A.badge(b.is_published ? "প্রকাশিত" : "খসড়া", b.is_published ? "badge-ok" : ""), b.author ? el("span", { text: b.author }) : null,
              b.category ? A.badge(b.category) : null, b.accession_no ? el("span", { class: "muted", text: "সংগ্রহ নং: " + b.accession_no }) : null,
              el("span", { class: "muted", text: "কপি: " + bn(b.copies) + (b.edition_year ? " · সাল: " + bn(b.edition_year) : "") + (b.shelf ? " · তাক: " + b.shelf : "") })])
          ]),
          el("div", { class: "row-actions" }, [
            U.toggleBtn("site_library_upsert", b, load), el("a", { class: "btn btn-outline btn-sm", href: "#/library/" + b.id, text: "সম্পাদনা" }),
            A.btn("মুছুন", "btn-danger-outline btn-sm", function (btn) { del(btn, b); })])
        ]);
      })));
    }
    function del(btn, b) {
      A.confirm({ title: "বই মুছবেন?", message: "“" + b.title + "” সাইটের তালিকা থেকে চিরতরে মুছে যাবে।", ok: "হ্যাঁ, মুছুন", danger: true }).then(function (ok) {
        if (!ok) return;
        return A.run(btn, function () { return A.call("site_library_delete", { p_id: b.id }).then(A.afterDelete).then(function (d) { if (d) { A.toast("বই মুছে ফেলা হয়েছে"); return load(); } }); });
      });
    }
    function load() {
      A.loading(box);
      return fetchPage(LQ.q, LQ.page).then(function (r) {
        if (!alive()) return;
        total = (r && r.total) || 0;
        var items = (r && r.items) || [];
        if (!items.length && LQ.page > 0 && total > 0) { LQ.page = Math.max(0, Math.ceil(total / PAGE) - 1); return load(); }   // the last page became empty after a delete
        cache = {};
        items.forEach(function (b) { cache[b.id] = b; });
        draw(items); drawPager();
      }, function (e) { if (alive()) A.failed(box, e, load); });
    }
    var tm;
    search.addEventListener("input", function () { clearTimeout(tm); tm = setTimeout(function () { LQ.q = search.value.trim(); LQ.page = 0; load(); }, 350); });
    clear(host).appendChild(A.pageTitle("সেমিনার লাইব্রেরি", [el("a", { class: "btn", href: "#/library/new", text: "+ নতুন বই" }), el("a", { class: "btn btn-outline", href: "#/library/import", text: "ফাইল থেকে ইমপোর্ট" })]));
    host.appendChild(el("p", { class: "muted" }, ["এটি বিভাগের বই, জার্নাল ও থিসিসের প্রকাশ্য তালিকা — কে কোন বই নিয়েছে তা এখানে নেই। খোলা থাকার সময়, নিয়ম ও যোগাযোগের লেখা বদলাতে ", el("a", { href: "#/pages/seminar-library", text: "“সেমিনার লাইব্রেরি” পাতা" }), " খুলুন।"]));
    host.appendChild(el("div", { class: "toolbar" }, [search]));
    host.appendChild(box); host.appendChild(pager);
    return load();
  };

  function bookForm(host, id, alive) {
    A.loading(host);
    var pBook = id === "new" ? Promise.resolve(null) : findBook(id);
    var pCats = A.call("web_site_library_categories").then(function (r) { return ((r && r.categories) || []).map(function (c) { return c.category; }); }, function () { return []; });
    return Promise.all([pBook, pCats]).then(function (res) {
      if (!alive()) return;
      var cur = res[0], cats = res[1].slice();
      if (id !== "new" && !cur) { S.showState(host, "error", "বইটি পাওয়া যায়নি (মুছে ফেলা হয়ে থাকতে পারে)।"); host.appendChild(U.backLink("#/library")); return; }
      if (cur && cur.category && cats.indexOf(cur.category) < 0) cats.push(cur.category);
      var form = el("form", { class: "form card", novalidate: "" });
      var title = A.input("title", cur ? cur.title : "", { maxlength: "300", required: "" });
      var author = A.input("author", cur ? cur.author : "", { maxlength: "200" });
      var cat = A.input("category", cur ? cur.category : "", { maxlength: "60", list: "lcats" });
      var pub = A.input("publisher", cur ? cur.publisher : "", { maxlength: "200" });
      var year = A.input("edition_year", cur && cur.edition_year != null ? cur.edition_year : "", { type: "number", min: "1500", max: "2100", step: "1", inputmode: "numeric" });
      var acc = A.input("accession_no", cur && cur.accession_no || "", { maxlength: "40" });
      var shelf = A.input("shelf", cur ? cur.shelf : "", { maxlength: "40" });
      var copies = A.input("copies", cur ? cur.copies : 1, { type: "number", min: "0", max: "999", step: "1", inputmode: "numeric" });
      var note = A.textarea("note", cur ? cur.note : "", 3);
      note.setAttribute("maxlength", "300");
      var saveBtn = el("button", { type: "submit", class: "btn", text: "সংরক্ষণ করুন" });
      form.appendChild(el("div", { class: "grid2" }, [A.field("শিরোনাম *", title), A.field("লেখক", author), A.field("বিভাগ", cat, "যেমন: পাঠ্যবই, জার্নাল, থিসিস। প্রকাশিত বইয়ের বিভাগগুলো সাজেশনে আসবে।"),
        A.field("প্রকাশক", pub), A.field("প্রকাশের সাল (১৫০০–২১০০)", year), A.field("সংগ্রহ নম্বর", acc, "প্রতিটি বইয়ের আলাদা হতে হবে। ইমপোর্টে এই নম্বর দিয়েই আগের বই চেনা হয়।"),
        A.field("তাক", shelf), A.field("কপির সংখ্যা (০–৯৯৯)", copies)]));
      form.appendChild(A.datalist("lcats", cats));
      form.appendChild(A.field("মন্তব্য", note, "সর্বোচ্চ ৩০০ অক্ষর। এটি সাইটে সবাই দেখতে পাবে — ভেতরের কোনো কথা লিখবেন না।"));
      form.appendChild(el("div", { class: "checks" }, [A.check("is_published", "প্রকাশ করুন", cur ? cur.is_published : false)]));
      var acts = [saveBtn, U.backLink("#/library", "বাতিল")];
      if (cur) acts.push(A.btn("বই মুছুন", "btn-danger-outline", function (b) {
        A.confirm({ title: "বই মুছবেন?", message: "এটা চিরতরে মুছে যাবে।", ok: "হ্যাঁ, মুছুন", danger: true }).then(function (ok) {
          if (!ok) return;
          return A.run(b, function () { return A.call("site_library_delete", { p_id: cur.id }).then(A.afterDelete).then(function (d) { if (d) { A.setDirty(false); A.toast("বই মুছে ফেলা হয়েছে"); U.go("#/library"); } }); });
        });
      }));
      form.appendChild(el("div", { class: "form-actions" }, acts));
      A.watchDirty(form);
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        A.run(saveBtn, function () {
          var f = form.elements;
          var r = H.libraryToPayload({ id: cur && cur.id, title: f.title.value, author: f.author.value, category: f.category.value, publisher: f.publisher.value,
            edition_year: f.edition_year.value, accession_no: f.accession_no.value, shelf: f.shelf.value, copies: f.copies.value, note: f.note.value, is_published: f.is_published.checked });
          if (r.error) throw A.userErr(r.error);
          return A.call("site_library_upsert", { p_data: r.payload }).then(function () { A.setDirty(false); U.go("#/library"); });
        }, "বই সংরক্ষণ হয়েছে");
      });
      clear(host).appendChild(A.pageTitle(cur ? "বই সম্পাদনা" : "নতুন বই"));
      host.appendChild(form);
    }, function (e) { if (alive()) A.failed(host, e, function () { bookForm(host, id, alive); }); });
  }
})();
