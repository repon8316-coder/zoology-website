// The page scripts of the public site. Each html page has <body data-page="..."> and this file runs the matching one.
(function () {
  "use strict";
  var S = window.Site, L = window.SiteLib, el = S.el;
  var PER_PAGE = 10;

  function section(title, linkHref, linkText, body) {
    return el("section", { class: "section" }, [
      el("div", { class: "section-head" }, [el("h2", { text: title }), linkHref ? el("a", { href: linkHref, text: linkText }) : null]),
      body
    ]);
  }
  function wrapped(kids) { return el("div", { class: "wrap" }, kids); }
  function empty(text) { return S.stateBox("empty", text); }

  var pages = {};

  // ---------------- home ----------------
  pages.home = function () {
    S.page({
      id: "home", title: "",
      load: function () { return S.rpc("web_site_home"); },
      render: function (d, main) {
        var n = S.names();
        main.appendChild(el("section", { class: "hero" }, el("div", { class: "wrap" }, [
          el("h1", { text: n.bn }),
          el("p", { text: n.college }),
          el("p", { text: "বিভাগের নোটিশ, শিক্ষক পরিচিতি, ছবি ও দরকারি ফাইল এক জায়গায়।" }),
          el("div", { class: "btns" }, [
            el("a", { class: "btn", href: "notices.html", text: "সর্বশেষ নোটিশ" }),
            el("a", { class: "btn btn-outline", href: "form.html", text: "শিক্ষার্থীর তথ্য ফর্ম" })
          ])
        ])));

        var notices = (d && d.notices) || [];
        var people = (d && d.people) || [];
        var nb = notices.length ? el("ul", { class: "notice-list" }, notices.map(S.noticeCard)) : empty("এখন কোনো নোটিশ নেই।");

        var quick = [
          ["notices.html", "নোটিশ", "সব নোটিশ ও বিজ্ঞপ্তি"], ["teachers.html", "শিক্ষক ও কর্মচারী", "বিভাগের সদস্যদের পরিচিতি"],
          ["gallery.html", "গ্যালারি", "অনুষ্ঠান ও ক্ষেত্র-ভ্রমণের ছবি"], ["downloads.html", "ডাউনলোড", "ফর্ম, রুটিন ও অন্যান্য ফাইল"],
          ["form.html", "শিক্ষার্থীর ফর্ম", "নিজের তথ্য জমা দিন"], ["contact.html", "যোগাযোগ", "ঠিকানা, ফোন ও মানচিত্র"]
        ].map(function (q) {
          return el("li", { class: "quick" }, el("a", { href: q[0] }, el("div", { class: "card" }, [el("h3", { text: q[1] }), el("p", { class: "muted", text: q[2] })])));
        });

        main.appendChild(wrapped([
          section("সর্বশেষ নোটিশ", "notices.html", "সব নোটিশ →", nb),
          section("দ্রুত লিংক", null, null, el("ul", { class: "grid" }, quick)),
          people.length ? section("আমাদের শিক্ষকগণ", "teachers.html", "সবাইকে দেখুন →", el("ul", { class: "people" }, people.map(S.personCard))) : null
        ]));
      }
    });
  };

  // ---------------- about ----------------
  pages.about = function () {
    var slugs = ["about", "history", "vision"];
    S.page({
      id: "about", title: "পরিচিতি",
      load: function () {
        return Promise.all(slugs.map(function (s) { return S.rpc("web_site_page", { p_slug: s }); })).then(function (rs) {
          return { maintenance: rs.some(function (r) { return r && r.maintenance; }), items: rs.map(function (r) { return r && r.item; }).filter(Boolean) };
        });
      },
      render: function (d, main) {
        var kids = [S.pageHeading("বিভাগ পরিচিতি")];
        if (!d.items.length) kids.push(empty("পরিচিতির তথ্য শীঘ্রই যুক্ত করা হবে।"));
        d.items.forEach(function (it) {
          var art = el("article", { class: "article" }, [el("h2", { text: it.title })]);
          S.renderMarkdown(art, it.body_md);
          kids.push(art);
        });
        main.appendChild(wrapped(kids));
      }
    });
  };

  // ---------------- teachers ----------------
  pages.teachers = function () {
    S.page({
      id: "teachers", title: "শিক্ষক ও কর্মচারী",
      load: function () { return S.rpc("web_site_people"); },
      render: function (d, main) {
        var items = (d && d.items) || [];
        var kids = [S.pageHeading("শিক্ষক ও কর্মচারী")];
        var t = items.filter(function (p) { return p.kind === "teacher"; });
        var o = items.filter(function (p) { return p.kind !== "teacher"; });
        if (!items.length) kids.push(empty("তথ্য শীঘ্রই যুক্ত করা হবে।"));
        if (t.length) kids.push(el("h2", { text: "শিক্ষকবৃন্দ" }), el("ul", { class: "people" }, t.map(S.personCard)));
        if (o.length) kids.push(el("h2", { text: "কর্মচারীবৃন্দ" }), el("ul", { class: "people" }, o.map(S.personCard)));
        main.appendChild(wrapped(kids));
      }
    });
  };

  // ---------------- notices (list) ----------------
  pages.notices = function () {
    var q = L.parseQuery(location.search);
    var cat = (q.cat || "").slice(0, 60);
    var pageNo = Math.max(1, parseInt(L.bnDigits(q.page || "1").replace(/[^0-9]/g, ""), 10) || 1);
    function href(c, p) { return "notices.html" + L.buildQuery({ cat: c, page: p > 1 ? String(p) : "" }); }
    S.page({
      id: "notices", title: "নোটিশ",
      load: function () { return S.rpc("web_site_notices", { p_limit: PER_PAGE, p_offset: (pageNo - 1) * PER_PAGE, p_category: cat || null }); },
      render: function (d, main) {
        var kids = [S.pageHeading("নোটিশ")];
        var cats = d.categories || [];
        if (cats.length || cat) {
          var sel = el("select", { id: "cat", name: "cat" }, [el("option", { value: "", text: "সব বিভাগ" })].concat(cats.map(function (c) {
            return el("option", { value: c, text: c, selected: c === cat });
          })));
          sel.addEventListener("change", function () { location.href = href(sel.value, 1); });
          kids.push(el("div", { class: "filter" }, [el("label", { for: "cat", text: "বিভাগ অনুযায়ী দেখুন:" }), sel]));
        }
        var info = L.pageInfo(d.total, PER_PAGE, (pageNo - 1) * PER_PAGE);
        if (!d.total) {
          kids.push(empty(cat ? "এই বিভাগে কোনো নোটিশ নেই।" : "এখন কোনো নোটিশ নেই।"));
        } else if (pageNo > info.pages) {
          kids.push(S.stateBox("empty", "এই পাতায় কোনো নোটিশ নেই।"), el("p", { class: "pager" }, el("a", { href: href(cat, 1), text: "প্রথম পাতায় যান" })));
        } else {
          kids.push(el("p", { class: "muted", text: "মোট " + L.bnDigits(d.total) + "টি নোটিশ — পাতা " + L.bnDigits(info.page) + " / " + L.bnDigits(info.pages) }));
          kids.push(el("ul", { class: "notice-list" }, (d.items || []).map(S.noticeCard)));
          if (info.pages > 1) {
            var nav = el("nav", { class: "pager", "aria-label": "পাতা" });
            if (info.hasPrev) nav.appendChild(el("a", { href: href(cat, info.page - 1), rel: "prev", text: "← আগের" }));
            L.pageNumbers(info.page, info.pages).forEach(function (n) {
              if (n === "…") nav.appendChild(el("span", { class: "gap", "aria-hidden": "true", text: "…" }));
              else nav.appendChild(el("a", { href: href(cat, n), text: L.bnDigits(n), "aria-current": n === info.page ? "page" : null,
                                             "aria-label": "পাতা " + L.bnDigits(n) }));
            });
            if (info.hasNext) nav.appendChild(el("a", { href: href(cat, info.page + 1), rel: "next", text: "পরের →" }));
            kids.push(nav);
          }
        }
        main.appendChild(wrapped(kids));
      }
    });
  };

  // ---------------- notice (detail) ----------------
  pages.notice = function () {
    var id = L.parseQuery(location.search).id || "";
    S.page({
      id: "notices", title: "নোটিশ",
      load: function () { return L.isUuid(id) ? S.rpc("web_site_notice", { p_id: id }) : Promise.resolve({ item: null }); },
      render: function (d, main) {
        var back = el("p", null, el("a", { href: "notices.html", text: "← সব নোটিশ" }));
        var it = d && d.item;
        if (!it) { main.appendChild(wrapped([back, S.stateBox("empty", "নোটিশটি পাওয়া যায়নি। এটি মুছে ফেলা হয়েছে বা মেয়াদ শেষ হয়ে গেছে।")])); return; }
        document.title = it.title + " — " + S.names().bn;
        var art = el("article", { class: "article" });
        S.renderPlain(art, it.body);
        var file = S.fileUrl(it.attachment_path || "");
        main.appendChild(wrapped([
          back,
          el("h1", { text: it.title }),
          el("div", { class: "notice-meta" }, [
            it.pinned ? el("span", { class: "badge badge-pin", text: "গুরুত্বপূর্ণ" }) : null,
            it.category ? el("span", { class: "badge", text: it.category }) : null,
            el("time", { datetime: it.publish_at || null, text: L.formatDate(it.publish_at) })
          ]),
          art.firstChild ? art : null,
          file ? el("p", { class: "attach" }, el("a", { class: "btn", href: file, target: "_blank", rel: "noopener noreferrer", text: "সংযুক্ত ফাইল দেখুন / ডাউনলোড করুন" })) : null
        ]));
      }
    });
  };

  // ---------------- gallery ----------------
  function lightbox(photos) {
    var dlg = el("dialog", { class: "lightbox", "aria-label": "ছবি" });
    var img = el("img", { alt: "" });
    var cap = el("p", { class: "lb-cap" });
    var closeB = el("button", { type: "button", class: "lb-btn lb-close", "aria-label": "বন্ধ করুন", text: "×" });
    var prevB = el("button", { type: "button", class: "lb-btn lb-prev", "aria-label": "আগের ছবি", text: "‹" });
    var nextB = el("button", { type: "button", class: "lb-btn lb-next", "aria-label": "পরের ছবি", text: "›" });
    dlg.appendChild(el("div", { class: "lb-inner" }, [img, cap]));
    [closeB, prevB, nextB].forEach(function (b) { dlg.appendChild(b); });
    if (photos.length < 2) { prevB.hidden = true; nextB.hidden = true; }
    document.body.appendChild(dlg);
    var idx = 0, opener = null;
    function show(i) {
      idx = (i + photos.length) % photos.length;
      var p = photos[idx];
      img.src = p.src; img.alt = p.alt; cap.textContent = p.caption || "";
    }
    closeB.addEventListener("click", function () { dlg.close(); });
    prevB.addEventListener("click", function () { show(idx - 1); });
    nextB.addEventListener("click", function () { show(idx + 1); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.className === "lb-inner") dlg.close(); });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { show(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowRight") { show(idx + 1); e.preventDefault(); }
    });
    dlg.addEventListener("close", function () { img.removeAttribute("src"); if (opener) opener.focus(); });
    return function open(i, btn) {
      opener = btn;
      if (typeof dlg.showModal !== "function") { window.open(photos[i].src, "_blank", "noopener"); return; }
      show(i); dlg.showModal(); closeB.focus();
    };
  }

  pages.gallery = function () {
    var album = (L.parseQuery(location.search).album || "").slice(0, 80);
    S.page({
      id: "gallery", title: "গ্যালারি",
      load: function () { return S.rpc("web_site_gallery", { p_album: album || null }); },
      render: function (d, main) {
        var kids = [S.pageHeading("গ্যালারি")];
        var albums = (d.albums || []).filter(function (a) { return a.album; });
        if (albums.length) {
          kids.push(el("ul", { class: "albums", "aria-label": "অ্যালবাম" }, [
            el("li", null, el("a", { href: "gallery.html", text: "সব ছবি", "aria-current": album ? null : "true" }))
          ].concat(albums.map(function (a) {
            return el("li", null, el("a", { href: "gallery.html" + L.buildQuery({ album: a.album }), "aria-current": a.album === album ? "true" : null,
                                            text: a.album + " (" + L.bnDigits(a.count) + ")" }));
          }))));
        }
        var items = d.items || [];
        var photos = [];
        var cells = [];
        items.forEach(function (it) {
          var src = S.fileUrl(it.image_path);
          if (!src) return;
          var alt = it.title || it.caption || it.album || "গ্যালারির ছবি";
          var n = photos.push({ src: src, alt: alt, caption: [it.title, it.caption].filter(Boolean).join(" — ") }) - 1;
          cells.push({ n: n, src: src, alt: alt });
        });
        if (!cells.length) { kids.push(empty(album ? "এই অ্যালবামে কোনো ছবি নেই।" : "ছবি শীঘ্রই যুক্ত করা হবে।")); main.appendChild(wrapped(kids)); return; }
        var open = lightbox(photos);
        kids.push(el("ul", { class: "photos" }, cells.map(function (c) {
          var b = el("button", { type: "button", class: "photo-btn", "aria-label": c.alt + " — বড় করে দেখুন" },
            el("img", { src: c.src, alt: "", loading: "lazy", decoding: "async" }));
          b.addEventListener("click", function () { open(c.n, b); });
          return el("li", null, b);
        })));
        main.appendChild(wrapped(kids));
      }
    });
  };

  // ---------------- downloads ----------------
  pages.downloads = function () {
    S.page({
      id: "downloads", title: "ডাউনলোড",
      load: function () { return S.rpc("web_site_downloads"); },
      render: function (d, main) {
        var kids = [S.pageHeading("ডাউনলোড", "ফর্ম, রুটিন ও অন্যান্য দরকারি ফাইল")];
        var items = (d.items || []).filter(function (it) { return S.fileUrl(it.file_path); });
        if (!items.length) { kids.push(empty("এখন কোনো ফাইল নেই।")); main.appendChild(wrapped(kids)); return; }
        var groups = [], by = {};
        items.forEach(function (it) {
          var k = it.category || "";
          if (!by[k]) { by[k] = []; groups.push(k); }
          by[k].push(it);
        });
        groups.forEach(function (g) {
          if (g) kids.push(el("h2", { text: g }));
          kids.push(el("ul", { class: "files" }, by[g].map(function (it) {
            var size = L.formatSize(it.file_size);
            return el("li", { class: "file" }, [
              el("span", { class: "file-title", text: it.title }),
              size ? el("span", { class: "muted", text: size }) : null,
              el("a", { class: "btn btn-outline", href: S.fileUrl(it.file_path), target: "_blank", rel: "noopener noreferrer",
                        "aria-label": it.title + " ডাউনলোড করুন", text: "ডাউনলোড" })
            ]);
          })));
        });
        main.appendChild(wrapped(kids));
      }
    });
  };

  // ---------------- contact ----------------
  pages.contact = function () {
    S.page({
      id: "contact", title: "যোগাযোগ",
      load: function () { return S.rpc("web_site_page", { p_slug: "contact" }); },
      render: function (d, main, s) {
        var rows = [];
        function row(k, v) { rows.push(el("li", null, [el("span", { class: "k", text: k }), el("span", { class: "v" }, v)])); }
        if (s.address) row("ঠিকানা", s.address);
        if (s.phone) { var tel = L.telHref(s.phone); row("ফোন", tel ? el("a", { href: tel, text: s.phone }) : s.phone); }
        var mail = L.safeEmail(s.email || "");
        if (mail) row("ইমেইল", el("a", { href: "mailto:" + mail, text: mail }));
        [["Facebook", s.social_facebook], ["YouTube", s.social_youtube], ["অন্যান্য", s.social_other]].forEach(function (x) {
          var u = L.safeHttpUrl(x[1] || "");
          if (u) row(x[0], el("a", { href: u, target: "_blank", rel: "noopener noreferrer", text: u }));
        });
        var kids = [S.pageHeading("যোগাযোগ")];
        var box = el("div", { class: "card" });
        if (rows.length) box.appendChild(el("ul", { class: "contact-list" }, rows));
        var map = L.safeHttpUrl(s.map_url || "");
        if (map) box.appendChild(el("p", null, el("a", { class: "btn", href: map, target: "_blank", rel: "noopener noreferrer", text: "মানচিত্রে দেখুন" })));
        if (rows.length || map) kids.push(box);
        if (d && d.item) {
          var art = el("article", { class: "article" }, [el("h2", { text: d.item.title })]);
          S.renderMarkdown(art, d.item.body_md);
          kids.push(art);
        }
        if (kids.length === 1) kids.push(empty("যোগাযোগের তথ্য শীঘ্রই যুক্ত করা হবে।"));
        main.appendChild(wrapped(kids));
      }
    });
  };

  var run = pages[document.body.getAttribute("data-page")];
  if (run) run();
})();
