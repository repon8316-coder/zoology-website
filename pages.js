// The page scripts of the public site. Each html page has <body data-page="..."> and this file runs the matching one.
(function () {
  "use strict";
  var S = window.Site, L = window.SiteLib, el = S.el;
  var PER_PAGE = 10;
  var BATCH_KEY = "site-batch";          // the batch a visitor chose last (localStorage)
  var REFRESH_MS = 5 * 60 * 1000;        // the "today" card asks the server again every 5 minutes

  function section(title, linkHref, linkText, body, cls) {
    return el("section", { class: "section" + (cls ? " " + cls : "") }, [
      el("div", { class: "section-head" }, [el("h2", { text: title }), linkHref ? el("a", { href: linkHref, text: linkText }) : null]),
      body
    ]);
  }
  function wrapped(kids) { return el("div", { class: "wrap" }, kids); }
  function empty(text) { return S.stateBox("empty", text); }
  function photoUrl(path) { return S.fileUrl(path || ""); }

  // ---------------- shared pieces: routine entry, specimen card ----------------
  // One class (an entry of a routine cell). mode "today": only today's change is shown; mode "grid": every change of the next days, with its date.
  function entryNode(en, mode, todayDate) {
    var s = en.slot || {};
    var name = s.subject_name_bn || s.subject_name_en || s.subject_code || "";
    var cancelled = !!(en.today && en.today.kind === "cancelled");
    var subst = en.today && en.today.kind === "substitute" ? en.today : null;
    var typeTag = L.classTypeLabel(s.class_type);
    var meta = [s.teacher_name, s.room ? "কক্ষ: " + s.room : ""].filter(Boolean).join(" · ");
    var notes = [];
    if (mode === "grid") {
      en.notes.forEach(function (n) {
        notes.push(el("p", { class: "cls-note cls-note-" + n.kind }, [
          el("span", { class: "cls-note-date", text: L.formatDayMonth(n.on_date) + (todayDate && n.on_date === todayDate ? " (আজ)" : "") }), ": ",
          el("strong", { text: L.changeLabel(n) })
        ]));
      });
    }
    return el("div", { class: "cls" + (cancelled ? " cls-cancelled" : "") }, [
      el("div", { class: "cls-title" }, [
        el("span", { class: "cls-name", text: name }),
        s.subject_code && s.subject_code !== name ? el("small", { class: "cls-code", text: s.subject_code }) : null,
        typeTag ? el("span", { class: "tag", text: typeTag }) : null
      ]),
      meta ? el("div", { class: "cls-meta", text: meta }) : null,
      mode === "today" && cancelled ? el("span", { class: "chip chip-cancel", text: "বাতিল" }) : null,
      mode === "today" && subst ? el("span", { class: "chip chip-sub", text: L.changeLabel(subst) }) : null,
      notes
    ]);
  }

  // A specimen label card (museum page, home highlights)
  function museumCard(it) {
    var src = photoUrl(it.photo_path);
    var title = it.title_bn || it.title_en || "নমুনা";
    return el("li", { class: "spec" }, el("a", { class: "spec-link", href: "museum-item.html?id=" + encodeURIComponent(it.id) }, [
      el("div", { class: "spec-photo" }, src
        ? el("img", { src: src, alt: title, width: "400", height: "300", loading: "lazy", decoding: "async" })
        : el("span", { class: "spec-ph", text: "ছবি নেই" })),
      el("div", { class: "spec-body" }, [
        it.catalog_no ? el("p", { class: "spec-no", text: "ক্যাটালগ নং " + it.catalog_no }) : null,
        el("h3", { class: "spec-title", text: title }),
        it.scientific_name ? el("p", { class: "spec-sci" }, el("em", { text: it.scientific_name })) : null,
        it.category ? el("p", { class: "spec-cat", text: it.category }) : null
      ])
    ]));
  }

  function batchSelect(id, batches, selected) {
    var sel = el("select", { id: id, name: id });
    if (!selected) sel.appendChild(el("option", { value: "", text: "— ব্যাচ বেছে নিন —" }));
    L.groupBatches(batches).forEach(function (g) {
      sel.appendChild(el("optgroup", { label: g.label }, g.items.map(function (b) {
        return el("option", { value: b.id, text: L.batchLabel(b) || g.label, selected: b.id === selected });
      })));
    });
    return sel;
  }
  function batchTitle(batches, id) {
    var b = (batches || []).filter(function (x) { return x.id === id; })[0];
    return b ? [L.programName(b), L.batchLabel(b)].filter(Boolean).join(" — ") : "";
  }

  var pages = {};

  // ---------------- home ----------------
  // The "today's classes" card: one widget that fetches on its own. It removes itself when the routine switch is off and
  // shows its own Bangla error (with a retry) when a call fails; the rest of the home page never waits for it.
  function todayCard(host, onOff) {
    var batches = [], selectedId = "", seq = 0, timer = null;
    var dateP = el("p", { class: "today-date" });
    var pick = el("div", { class: "today-pick" });
    var body = el("div", { class: "today-body" });
    var card = el("section", { class: "today", "aria-labelledby": "today-h" }, [
      el("div", { class: "today-head" }, [el("h2", { id: "today-h", text: "আজকের ক্লাস" }), dateP]),
      pick, body,
      el("p", { class: "today-foot" }, el("a", { href: "routine.html", text: "পুরো সাপ্তাহিক রুটিন →" }))
    ]);
    host.appendChild(card);
    S.showState(body, "loading", "রুটিন আনা হচ্ছে…");

    function off() { if (timer) clearInterval(timer); host.hidden = true; S.clear(host); if (onOff) onOff(); }

    function paint(d) {
      var t = L.todayRows(d);
      dateP.textContent = L.formatLongDate(d.today);
      S.clear(body);
      if (!t.working) { body.appendChild(el("p", { class: "today-none", text: "আজ ক্লাস নেই" })); return; }
      if (!t.rows.length) { body.appendChild(el("p", { class: "today-none", text: "আজ এই ব্যাচের কোনো ক্লাস নেই" })); return; }
      body.appendChild(el("ol", { class: "t-list" }, t.rows.map(function (r) {
        return el("li", { class: "t-row" + (r.current ? " now" : ""), "aria-current": r.current ? "true" : null }, [
          el("div", { class: "t-time" }, [
            el("strong", { text: L.formatTimeRange(r.period.start, r.period.end) }),
            el("span", { class: "t-period", text: "পিরিয়ড " + L.bnDigits(r.period.period_no) })
          ]),
          el("div", { class: "t-body" }, [
            r.current ? el("span", { class: "chip chip-now", text: "এখন চলছে" }) : null,
            r.entries.map(function (en) { return entryNode(en, "today"); })
          ])
        ]);
      })));
    }

    function fetchRoutine(silent) {
      if (!selectedId) { dateP.textContent = ""; S.showState(body, "empty", "উপরের তালিকা থেকে আপনার ব্যাচ বেছে নিন।"); return; }
      var my = ++seq;
      if (!silent) S.showState(body, "loading", "রুটিন আনা হচ্ছে…");
      S.rpc("web_site_routine", { p_batch_id: selectedId }).then(function (d) {
        if (my !== seq) return;
        if (!d || d.maintenance || d.enabled === false) { off(); return; }
        paint(d);
      }, function (e) {
        if (my !== seq || silent) return;
        dateP.textContent = "";
        S.showState(body, "error", L.errorMessage(e), function () { fetchRoutine(false); });
      });
    }

    function init() {
      S.showState(body, "loading", "রুটিন আনা হচ্ছে…");
      S.rpc("web_site_routine_batches").then(function (d) {
        if (!d || d.maintenance || d.enabled === false || !(d.batches || []).length) { off(); return; }
        batches = d.batches;
        selectedId = L.pickBatch(batches, S.store.get(BATCH_KEY));
        var sel = batchSelect("today-batch", batches, selectedId);
        sel.addEventListener("change", function () {
          selectedId = sel.value;
          if (selectedId) S.store.set(BATCH_KEY, selectedId);
          fetchRoutine(false);
        });
        S.clear(pick).appendChild(el("label", { for: "today-batch", text: "ব্যাচ" }));
        pick.appendChild(sel);
        fetchRoutine(false);
        timer = setInterval(function () { if (!document.hidden && selectedId) fetchRoutine(true); }, REFRESH_MS);
      }, function (e) {
        S.showState(body, "error", L.errorMessage(e), init);
      });
    }
    init();
  }

  pages.home = function () {
    S.page({
      id: "home", title: "",
      // if the home call fails the hero, the today card and the other widgets still render
      load: function () { return S.rpc("web_site_home").catch(function (e) { return { _failed: e }; }); },
      render: function (d, main) {
        var n = S.names();
        var todayHost = el("div", { class: "hero-today" });
        var hero = el("section", { class: "hero", "aria-labelledby": "hero-h" }, el("div", { class: "wrap hero-grid" }, [
          el("div", { class: "hero-text" }, [
            el("img", { class: "hero-logo", src: "img/logo-zoology.png", alt: "", width: "112", height: "113", decoding: "async" }),
            el("h1", { id: "hero-h", text: n.bn }),
            el("p", { class: "hero-college", text: n.college }),
            el("p", { class: "hero-lead", text: "বিভাগের নোটিশ, ক্লাস রুটিন, শিক্ষক পরিচিতি, মিউজিয়াম ও সেমিনার লাইব্রেরি এক জায়গায়।" }),
            el("div", { class: "btns" }, [
              el("a", { class: "btn btn-light", href: "notices.html", text: "নোটিশ" }),
              el("a", { class: "btn btn-ghost", href: "form.html", text: "শিক্ষার্থীর তথ্য ফর্ম" })
            ])
          ]),
          todayHost
        ]));
        main.appendChild(hero);

        var failed = !!(d && d._failed);
        var notices = (!failed && d && d.notices) || [];
        var people = (!failed && d && d.people) || [];

        var headHost = el("div", { class: "section head-corner", hidden: true });
        var museumHost = el("div", { class: "section", hidden: true });
        var galleryHost = el("div", { class: "section", hidden: true });

        var routineQuick = el("li", { class: "quick" }, el("a", { href: "routine.html" }, [el("strong", { text: "ক্লাস রুটিন" }), el("span", { class: "muted", text: "আজকের ও সাপ্তাহিক রুটিন" })]));
        var quick = [routineQuick].concat([
          ["museum.html", "মিউজিয়াম", "নমুনা ও সংগ্রহ"], ["library.html", "সেমিনার লাইব্রেরি", "বইয়ের তালিকা"],
          ["downloads.html", "ডাউনলোড", "ফর্ম ও ফাইল"], ["gallery.html", "গ্যালারি", "অনুষ্ঠানের ছবি"], ["form.html", "তথ্য ফর্ম", "শিক্ষার্থীর তথ্য জমা"]
        ].map(function (q) {
          return el("li", { class: "quick" }, el("a", { href: q[0] }, [el("strong", { text: q[1] }), el("span", { class: "muted", text: q[2] })]));
        }));

        var kids = [];
        if (failed) kids.push(el("div", { class: "section" }, S.stateBox("error", L.errorMessage(d._failed), function () { location.reload(); })));
        else if (notices.length) kids.push(section("সর্বশেষ নোটিশ", "notices.html", "সব নোটিশ →",
          el("ul", { class: "notice-list notice-list-compact" }, notices.slice(0, 6).map(function (x) { return S.noticeCard(x, true); }))));
        kids.push(headHost);
        kids.push(section("দ্রুত লিংক", null, null, el("ul", { class: "quick-list" }, quick)));
        if (people.length) kids.push(section("আমাদের শিক্ষকগণ", "teachers.html", "সবাইকে দেখুন →", el("ul", { class: "strip", tabindex: "0", "aria-label": "শিক্ষকদের তালিকা (পাশে সরিয়ে দেখুন)" }, people.map(personTile))));
        kids.push(museumHost, galleryHost);
        main.appendChild(wrapped(kids));

        // independent widgets: each one fills its own placeholder or stays hidden
        todayCard(todayHost, function () { hero.classList.add("hero-solo"); routineQuick.hidden = true; });
        S.widget(headHost, function () { return S.rpc("web_site_head"); }, function (h, host) {
          if (!h.enabled || !h.person || !h.message) return false;
          var p = h.person, src = photoUrl(p.photo_path);
          var text = L.excerpt(L.plainFromMarkdown(h.message.body_md), 280);
          if (!text) return false;
          host.appendChild(el("div", { class: "section-head" }, el("h2", { text: "বিভাগীয় প্রধানের বাণী" })));
          host.appendChild(el("div", { class: "head-card" }, [
            src ? el("img", { class: "head-photo", src: src, alt: p.name, width: "140", height: "140", loading: "lazy", decoding: "async" })
                : el("span", { class: "head-photo head-photo-ph", "aria-hidden": "true", text: L.initials(p.name) }),
            el("div", { class: "head-body" }, [
              el("h3", { text: p.name }),
              p.designation ? el("p", { class: "muted", text: p.designation }) : null,
              el("p", { class: "head-excerpt", text: text }),
              el("a", { class: "btn btn-outline", href: "head.html", text: "পুরো বাণী পড়ুন" })
            ])
          ]));
        });
        S.widget(museumHost, function () { return S.rpc("web_site_museum", { p_category: null }); }, function (m, host) {
          var items = (m.items || []).slice(0, 3);
          if (!items.length) return false;
          host.appendChild(el("div", { class: "section-head" }, [el("h2", { text: "মিউজিয়ামের নমুনা" }), el("a", { href: "museum.html", text: "সব নমুনা →" })]));
          host.appendChild(el("ul", { class: "spec-grid" }, items.map(museumCard)));
        });
        S.widget(galleryHost, function () { return S.rpc("web_site_gallery", { p_album: null }); }, function (g, host) {
          var cells = (g.items || []).map(function (it) {
            var src = photoUrl(it.image_path);
            return src ? el("li", null, el("a", { href: "gallery.html", "aria-label": (it.title || it.caption || "গ্যালারির ছবি") + " — গ্যালারিতে যান" },
              el("img", { src: src, alt: it.title || it.caption || "গ্যালারির ছবি", width: "320", height: "240", loading: "lazy", decoding: "async" }))) : null;
          }).filter(Boolean).slice(0, 6);
          if (!cells.length) return false;
          host.appendChild(el("div", { class: "section-head" }, [el("h2", { text: "গ্যালারি" }), el("a", { href: "gallery.html", text: "সব ছবি →" })]));
          host.appendChild(el("ul", { class: "mosaic" }, cells));
        });
      }
    });
  };

  // a small teacher tile for the home strip
  function personTile(p) {
    var src = photoUrl(p.photo_path);
    return el("li", { class: "tile" }, [
      src ? el("img", { class: "tile-photo", src: src, alt: p.name, width: "112", height: "112", loading: "lazy", decoding: "async" })
          : el("span", { class: "tile-photo tile-ph", "aria-hidden": "true", text: L.initials(p.name) }),
      el("strong", { class: "tile-name", text: p.name }),
      p.designation ? el("span", { class: "muted tile-role", text: p.designation }) : null
    ]);
  }

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
    var pageNo = Math.max(1, parseInt(L.asciiDigits(q.page || "1").replace(/[^0-9]/g, ""), 10) || 1);
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


  // ---------------- head corner (বিভাগীয় প্রধানের বাণী) ----------------
  pages.head = function () {
    S.page({
      id: "head", title: "বিভাগীয় প্রধানের বাণী",
      load: function () { return S.rpc("web_site_head"); },
      render: function (d, main) {
        var kids = [S.pageHeading("বিভাগীয় প্রধানের বাণী")];
        if (!d || d.enabled === false || !d.person || !d.message) {
          kids.push(empty("বিভাগীয় প্রধানের বাণী এখন প্রদর্শিত হচ্ছে না।"));
          main.appendChild(wrapped(kids));
          return;
        }
        var p = d.person, m = d.message, src = photoUrl(p.photo_path), mail = L.safeEmail(p.email_public || "");
        var art = el("article", { class: "article head-article" });
        if (m.title && m.title !== "বিভাগীয় প্রধানের বাণী") art.appendChild(el("h2", { text: m.title }));
        S.renderMarkdown(art, m.body_md);
        var upd = L.formatDate(m.updated_at);
        kids.push(el("div", { class: "head-page" }, [
          el("aside", { class: "head-who" }, [
            src ? el("img", { class: "head-photo head-photo-lg", src: src, alt: p.name, width: "200", height: "200", decoding: "async" })
                : el("span", { class: "head-photo head-photo-lg head-photo-ph", "aria-hidden": "true", text: L.initials(p.name) }),
            el("h2", { class: "head-name", text: p.name }),
            p.designation ? el("p", { class: "muted", text: p.designation }) : null,
            mail ? el("p", null, el("a", { href: "mailto:" + mail, text: mail })) : null
          ]),
          el("div", { class: "head-text" }, [art, upd ? el("p", { class: "muted head-updated" }, ["সর্বশেষ হালনাগাদ: ", el("time", { datetime: m.updated_at || null, text: upd })]) : null])
        ]));
        main.appendChild(wrapped(kids));
      }
    });
  };

  // ---------------- routine ----------------
  function periodRow(p, entries, current, todayDate) {
    return el("li", { class: "t-row" + (current ? " now" : ""), "aria-current": current ? "true" : null }, [
      el("div", { class: "t-time" }, [
        el("strong", { text: L.formatTimeRange(p.start, p.end) }),
        el("span", { class: "t-period", text: "পিরিয়ড " + L.bnDigits(p.period_no) })
      ]),
      el("div", { class: "t-body" }, [
        current ? el("span", { class: "chip chip-now", text: "এখন চলছে" }) : null,
        entries.map(function (en) { return entryNode(en, "grid", todayDate); })
      ])
    ]);
  }

  // Desktop: the weekly grid (days as columns in the given order, periods as rows)
  function routineGrid(data, days) {
    var periods = L.sortedPeriods(data);
    var head = el("tr", null, [el("th", { scope: "col", class: "rt-corner", text: "পিরিয়ড" })].concat(days.map(function (day) {
      var isToday = L.isTodayDay(data, day);
      return el("th", { scope: "col", class: isToday ? "today-col" : null, "aria-current": isToday ? "date" : null },
        [L.weekdayName(day), isToday ? el("small", { class: "rt-today-tag", text: " (আজ)" }) : null]);
    })));
    var rows = periods.map(function (p) {
      return el("tr", null, [el("th", { scope: "row" }, [el("span", { class: "rt-pno", text: "পিরিয়ড " + L.bnDigits(p.period_no) }), el("small", { text: L.formatTimeRange(p.start, p.end) })])]
        .concat(days.map(function (day) {
          var entries = L.buildCell(data, day, p.period_no);
          var now = L.isNowPeriod(data, day, p.period_no) && entries.length > 0;
          var cls = [L.isTodayDay(data, day) ? "today-col" : "", now ? "now" : ""].join(" ").trim();
          return el("td", { class: cls || null }, entries.length
            ? [now ? el("span", { class: "chip chip-now", text: "এখন চলছে" }) : null, entries.map(function (en) { return entryNode(en, "grid", data.today); })]
            : el("span", { class: "rt-empty", "aria-label": "ক্লাস নেই", text: "—" }));
        })));
    });
    return el("div", { class: "rt-grid-wrap" }, el("table", { class: "rt-grid" }, [
      el("caption", { class: "sr", text: "সাপ্তাহিক ক্লাস রুটিন" }), el("thead", null, head), el("tbody", null, rows)
    ]));
  }

  // Phone: day tabs (today selected) and a list of that day's classes
  function routineTabs(data, days) {
    var wd = L.isoWeekday(data.today);
    var current = days.indexOf(wd) >= 0 ? wd : days[0];
    var periods = L.sortedPeriods(data);
    var tabs = [], panels = [];
    var list = el("div", { class: "rt-tablist", role: "tablist", "aria-label": "দিন বেছে নিন" });
    function select(day, focus) {
      current = day;
      tabs.forEach(function (t) {
        var on = +t.getAttribute("data-day") === day;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.setAttribute("tabindex", on ? "0" : "-1");
        if (on && focus) t.focus();
      });
      panels.forEach(function (p) { p.hidden = +p.getAttribute("data-day") !== day; });
    }
    days.forEach(function (day, i) {
      var isToday = L.isTodayDay(data, day);
      var tab = el("button", { type: "button", role: "tab", id: "rt-tab-" + day, "data-day": day, "aria-controls": "rt-panel-" + day,
        "aria-selected": "false", tabindex: "-1", class: "rt-tab" + (isToday ? " is-today" : "") }, [L.weekdayShort(day), isToday ? el("small", { text: "আজ" }) : null]);
      tab.addEventListener("click", function () { select(day, false); });
      tab.addEventListener("keydown", function (e) {
        var to = null;
        if (e.key === "ArrowRight") to = days[(i + 1) % days.length];
        else if (e.key === "ArrowLeft") to = days[(i + days.length - 1) % days.length];
        else if (e.key === "Home") to = days[0];
        else if (e.key === "End") to = days[days.length - 1];
        if (to != null) { e.preventDefault(); select(to, true); }
      });
      tabs.push(tab);
      list.appendChild(tab);
      var rows = periods.map(function (p) {
        var entries = L.buildCell(data, day, p.period_no);
        return entries.length ? periodRow(p, entries, L.isNowPeriod(data, day, p.period_no), data.today) : null;
      }).filter(Boolean);
      panels.push(el("div", { class: "rt-panel", role: "tabpanel", id: "rt-panel-" + day, "aria-labelledby": "rt-tab-" + day, "data-day": day, tabindex: "0" },
        [el("h3", { class: "rt-day-h", text: L.weekdayName(day) }), rows.length ? el("ol", { class: "t-list" }, rows) : el("p", { class: "muted", text: "এই দিনে কোনো ক্লাস নেই।" })]));
    });
    select(current, false);
    return el("div", { class: "rt-days" }, [list].concat(panels));
  }

  function routineChanges(data) {
    var ch = L.upcomingChanges(data);
    var body;
    if (!ch.length) body = el("p", { class: "muted", text: "আগামী ৭ দিনে কোনো পরিবর্তন নেই।" });
    else body = el("ul", { class: "changes" }, ch.map(function (c) {
      var what = c.subject_name || c.subject_code || "ক্লাস";
      return el("li", { class: "change change-" + c.kind }, [
        el("strong", { class: "change-date", text: L.formatLongDate(c.on_date) }),
        el("span", { class: "change-what" }, [
          what, c.period ? " — পিরিয়ড " + L.bnDigits(c.period.period_no) + " (" + L.formatTimeRange(c.period.start, c.period.end) + ")" : ""
        ]),
        el("span", { class: "chip " + (c.kind === "cancelled" ? "chip-cancel" : "chip-sub"), text: L.changeLabel(c) }),
        c.teacher_name ? el("span", { class: "muted", text: "শিক্ষক: " + c.teacher_name }) : null
      ]);
    }));
    return el("section", { class: "section rt-changes" }, [el("h2", { text: "আগামী ৭ দিনে পরিবর্তন" }), body]);
  }

  function renderRoutine(out, data, title) {
    S.clear(out);
    var days = (data.working_days || []).filter(function (x) { return x >= 1 && x <= 7; });
    var periods = L.sortedPeriods(data);
    out.appendChild(el("div", { class: "rt-title" }, [
      el("div", null, [
        el("h2", { text: title || "ক্লাস রুটিন" }),
        data.today ? el("p", { class: "muted" }, ["আজ: ", el("time", { datetime: data.today, text: L.formatLongDate(data.today) })]) : null
      ]),
      el("button", { type: "button", class: "btn btn-outline no-print", text: "প্রিন্ট করুন" })
    ]));
    out.querySelector("button").addEventListener("click", function () { window.print(); });
    if (!days.length || !periods.length || !(data.slots || []).length) {
      out.appendChild(empty("এই ব্যাচের রুটিন এখনো যুক্ত করা হয়নি।"));
      return;
    }
    out.appendChild(routineGrid(data, days));
    out.appendChild(routineTabs(data, days));
    out.appendChild(routineChanges(data));
  }

  pages.routine = function () {
    var qBatch = L.parseQuery(location.search).batch || "";
    S.page({
      id: "routine", title: "ক্লাস রুটিন",
      load: function () { return S.rpc("web_site_routine_batches"); },
      render: function (d, main) {
        var kids = [S.pageHeading("ক্লাস রুটিন", "ব্যাচ বেছে নিলে সাপ্তাহিক রুটিন ও আগামী ৭ দিনের পরিবর্তন দেখা যাবে।")];
        if (!d || d.enabled === false) { kids.push(empty("রুটিন এখন প্রদর্শিত হচ্ছে না")); main.appendChild(wrapped(kids)); return; }
        var batches = d.batches || [];
        if (!batches.length) { kids.push(empty("এখনো কোনো ব্যাচের রুটিন যুক্ত করা হয়নি।")); main.appendChild(wrapped(kids)); return; }
        var selected = L.isUuid(qBatch) && batches.some(function (b) { return b.id === qBatch; }) ? qBatch : L.pickBatch(batches, S.store.get(BATCH_KEY));
        var sel = batchSelect("rt-batch", batches, selected);
        var out = el("div", { class: "rt-out" });
        var seq = 0;
        function load(id) {
          if (!id) { S.showState(out, "empty", "উপরের তালিকা থেকে আপনার ব্যাচ বেছে নিন।"); return; }
          var my = ++seq;
          S.showState(out, "loading", "রুটিন আনা হচ্ছে…");
          S.rpc("web_site_routine", { p_batch_id: id }).then(function (r) {
            if (my !== seq) return;
            if (!r || r.maintenance) { S.showState(out, "empty", "সাইটটি এখন রক্ষণাবেক্ষণের কাজে আছে। কিছুক্ষণ পরে আবার দেখুন।"); return; }
            if (r.enabled === false) { S.showState(out, "empty", "রুটিন এখন প্রদর্শিত হচ্ছে না"); return; }
            try { renderRoutine(out, r, batchTitle(batches, id)); } catch (e) { S.showState(out, "error", L.errorMessage(e), function () { load(id); }); }
          }, function (e) { if (my === seq) S.showState(out, "error", L.errorMessage(e), function () { load(id); }); });
        }
        sel.addEventListener("change", function () {
          if (sel.value) S.store.set(BATCH_KEY, sel.value);
          try { history.replaceState(null, "", "routine.html" + L.buildQuery({ batch: sel.value })); } catch (e) { /* the address bar is only a convenience */ }
          load(sel.value);
        });
        kids.push(el("div", { class: "rt-pick no-print" }, [el("label", { for: "rt-batch", text: "ব্যাচ" }), sel]), out);
        main.appendChild(wrapped(kids));
        load(selected);
      }
    });
  };

  // ---------------- museum ----------------
  pages.museum = function () {
    var q0 = L.parseQuery(location.search);
    S.page({
      id: "museum", title: "মিউজিয়াম",
      load: function () {
        return Promise.all([S.rpc("web_site_museum", { p_category: null }), S.loadPageItem("museum")]).then(function (r) {
          var m = r[0] || {};
          m._intro = r[1];
          return m;
        });
      },
      render: function (d, main) {
        var kids = [S.pageHeading("মিউজিয়াম")];
        var intro = d._intro && String(d._intro.body_md || "").trim() ? d._intro : null;
        if (intro) kids.push(S.renderMarkdown(el("div", { class: "article" }), intro.body_md));
        var items = d.items || [];
        if (!items.length) { kids.push(empty("মিউজিয়ামের নমুনা শীঘ্রই যুক্ত করা হবে।")); main.appendChild(wrapped(kids)); return; }
        var cats = (d.categories || []).filter(Boolean);
        var cat = cats.indexOf(q0.cat) >= 0 ? q0.cat : "";
        var q = (q0.q || "").slice(0, 100);
        var input = el("input", { type: "search", id: "mu-q", name: "q", value: q || null, maxlength: "100", autocomplete: "off" });
        var count = el("p", { class: "muted mu-count", role: "status", "aria-live": "polite" });
        var grid = el("div", { class: "mu-results" });
        var chipBox = el("div", { class: "chips", role: "group", "aria-label": "বিভাগ অনুযায়ী বাছাই" });
        function chip(label, value) {
          var b = el("button", { type: "button", class: "chip-btn", "aria-pressed": value === cat ? "true" : "false", text: label });
          b.addEventListener("click", function () { cat = value; paintChips(); update(); });
          b.setAttribute("data-cat", value);
          return b;
        }
        function paintChips() {
          Array.prototype.forEach.call(chipBox.children, function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-cat") === cat ? "true" : "false"); });
        }
        chipBox.appendChild(chip("সব", ""));
        cats.forEach(function (c) { chipBox.appendChild(chip(c, c)); });
        function update() {
          var shown = L.museumFilter(items, input.value, cat);
          try { history.replaceState(null, "", "museum.html" + L.buildQuery({ cat: cat, q: input.value.trim() })); } catch (e) { /* only a convenience */ }
          S.clear(grid);
          count.textContent = "মোট " + L.bnDigits(shown.length) + "টি নমুনা" + (shown.length !== items.length ? " (" + L.bnDigits(items.length) + "টির মধ্যে)" : "");
          grid.appendChild(shown.length ? el("ul", { class: "spec-grid" }, shown.map(museumCard)) : empty("এই খোঁজে কোনো নমুনা মেলেনি।"));
        }
        input.addEventListener("input", S.debounce(update, 150));
        kids.push(el("div", { class: "filters", role: "search" }, [
          el("div", { class: "field" }, [el("label", { for: "mu-q", text: "নাম বা বৈজ্ঞানিক নাম দিয়ে খুঁজুন" }), input]),
          cats.length ? chipBox : null
        ]), count, grid);
        main.appendChild(wrapped(kids));
        update();
      }
    });
  };

  pages["museum-item"] = function () {
    var id = L.parseQuery(location.search).id || "";
    S.page({
      id: "museum", title: "মিউজিয়াম",
      load: function () { return L.isUuid(id) ? S.rpc("web_site_museum_item", { p_id: id }) : Promise.resolve({ item: null }); },
      render: function (d, main) {
        var back = el("p", { class: "back" }, el("a", { href: "museum.html", text: "← সব নমুনা" }));
        var it = d && d.item;
        if (!it) { main.appendChild(wrapped([back, S.stateBox("empty", "নমুনাটি পাওয়া যায়নি। এটি সরিয়ে ফেলা হয়েছে বা প্রদর্শিত হচ্ছে না।")])); return; }
        var title = it.title_bn || it.title_en || "নমুনা";
        document.title = title + " — " + S.names().bn;
        var src = photoUrl(it.photo_path);
        var rows = [];
        function row(k, v) { if (v) rows.push(el("div", { class: "spec-row" }, [el("dt", { text: k }), el("dd", null, v)])); }
        row("ক্যাটালগ নং", it.catalog_no);
        row("বিভাগ", it.category);
        row("ইংরেজি নাম", it.title_bn && it.title_en ? it.title_en : "");
        row("বৈজ্ঞানিক নাম", it.scientific_name ? el("em", { text: it.scientific_name }) : "");
        row("সংগ্রহের স্থান", it.collected_from);
        row("সংগ্রহের তারিখ", L.formatDateOnly(it.collected_on));
        var desc = el("div", { class: "article spec-desc" });
        S.renderPlain(desc, it.description);
        main.appendChild(wrapped([
          back,
          el("article", { class: "spec-page" }, [
            el("figure", { class: "spec-fig" }, src
              ? el("img", { src: src, alt: title, width: "960", height: "720", decoding: "async" })
              : el("span", { class: "spec-ph", text: "ছবি নেই" })),
            el("div", { class: "spec-info" }, [
              el("h1", { text: title }),
              it.title_bn && it.title_en ? el("p", { class: "spec-sub", text: it.title_en }) : null,
              it.scientific_name ? el("p", { class: "spec-sci" }, el("em", { text: it.scientific_name })) : null,
              rows.length ? el("dl", { class: "spec-dl" }, rows) : null,
              desc.firstChild ? desc : null
            ])
          ])
        ]));
      }
    });
  };

  // ---------------- seminar library ----------------
  function libPager(st, info, go) {
    var nav = el("nav", { class: "pager", "aria-label": "পাতা" });
    function link(page, text, extra) {
      var a = el("a", Object.assign({ href: L.libraryHref({ q: st.q, category: st.category, page: page }), text: text }, extra || {}));
      a.addEventListener("click", function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        go(page);
      });
      return a;
    }
    if (info.hasPrev) nav.appendChild(link(info.page - 1, "← আগের", { rel: "prev" }));
    L.pageNumbers(info.page, info.pages).forEach(function (n) {
      if (n === "…") nav.appendChild(el("span", { class: "gap", "aria-hidden": "true", text: "…" }));
      else nav.appendChild(link(n, L.bnDigits(n), { "aria-current": n === info.page ? "page" : null, "aria-label": "পাতা " + L.bnDigits(n) }));
    });
    if (info.hasNext) nav.appendChild(link(info.page + 1, "পরের →", { rel: "next" }));
    return nav;
  }

  function bookTable(items) {
    var heads = ["শিরোনাম", "লেখক", "বিভাগ", "প্রকাশ সাল", "অ্যাকসেশন নং", "তাক", "কপি"];
    return el("div", { class: "lib-table-wrap" }, el("table", { class: "lib-table" }, [
      el("caption", { class: "sr", text: "সেমিনার লাইব্রেরির বইয়ের তালিকা" }),
      el("thead", null, el("tr", null, heads.map(function (h) { return el("th", { scope: "col", text: h }); }))),
      el("tbody", null, items.map(function (b) {
        return el("tr", null, [
          el("th", { scope: "row", class: "lib-title" }, [b.title, b.publisher ? el("small", { class: "muted", text: b.publisher }) : null, b.note ? el("small", { class: "muted", text: b.note }) : null]),
          el("td", { text: b.author || "" }), el("td", { text: b.category || "" }), el("td", { text: b.edition_year ? L.bnDigits(b.edition_year) : "" }),
          el("td", { text: b.accession_no || "" }), el("td", { text: b.shelf || "" }), el("td", { text: b.copies != null ? L.bnDigits(b.copies) : "" })
        ]);
      }))
    ]));
  }
  function bookCards(items) {
    return el("ul", { class: "lib-cards" }, items.map(function (b) {
      var rows = [["লেখক", b.author], ["বিভাগ", b.category], ["প্রকাশ সাল", b.edition_year ? L.bnDigits(b.edition_year) : ""],
        ["অ্যাকসেশন নং", b.accession_no], ["তাক", b.shelf], ["কপি", b.copies != null ? L.bnDigits(b.copies) : ""]]
        .filter(function (r) { return r[1]; })
        .map(function (r) { return el("div", null, [el("dt", { text: r[0] }), el("dd", { text: r[1] })]); });
      return el("li", { class: "lib-card" }, [
        el("h3", { text: b.title }),
        b.publisher ? el("p", { class: "muted", text: b.publisher }) : null,
        el("dl", null, rows),
        b.note ? el("p", { class: "muted", text: b.note }) : null
      ]);
    }));
  }

  pages.library = function () {
    S.page({
      id: "library", title: "সেমিনার লাইব্রেরি",
      load: function () {
        return Promise.all([S.rpc("web_site_library_categories").catch(function () { return { categories: [] }; }), S.loadPageItem("seminar-library")]).then(function (r) {
          return { maintenance: !!(r[0] && r[0].maintenance), categories: (r[0] && r[0].categories) || [], info: r[1] };
        });
      },
      render: function (d, main) {
        var st = L.libraryState(location.search);
        var kids = [S.pageHeading("সেমিনার লাইব্রেরি")];
        if (d.info && String(d.info.body_md || "").trim()) kids.push(S.renderMarkdown(el("div", { class: "article lib-info" }), d.info.body_md));
        kids.push(el("p", { class: "lib-note", text: "এটি বইয়ের তালিকা; ধার দেওয়ার তথ্য এখানে নেই।" }));

        var cats = (d.categories || []).filter(function (c) { return c && c.category; });
        var input = el("input", { type: "search", id: "lib-q", name: "q", value: st.q || null, maxlength: "100", autocomplete: "off", enterkeyhint: "search" });
        var sel = el("select", { id: "lib-cat", name: "category" }, [el("option", { value: "", text: "সব বিভাগ" })].concat(cats.map(function (c) {
          return el("option", { value: c.category, text: c.category + " (" + L.bnDigits(c.count) + ")" });
        })));
        if (st.category && !cats.some(function (c) { return c.category === st.category; })) sel.appendChild(el("option", { value: st.category, text: st.category }));
        sel.value = st.category;
        var form = el("form", { class: "filters lib-form", role: "search", action: "library.html", method: "get" }, [
          el("div", { class: "field field-grow" }, [el("label", { for: "lib-q", text: "বইয়ের নাম, লেখক বা বিষয় লিখুন" }), input]),
          el("div", { class: "field" }, [el("label", { for: "lib-cat", text: "বিভাগ" }), sel])
        ]);
        var results = el("div", { class: "lib-results" });
        kids.push(form, results);
        main.appendChild(wrapped(kids));

        var seq = 0;
        function load(state, focusTop) {
          var my = ++seq;
          S.showState(results, "loading", "বই খোঁজা হচ্ছে…");
          S.rpc("web_site_library", L.libraryParams(state)).then(function (r) {
            if (my !== seq) return;
            if (!r || r.maintenance) { S.showState(results, "empty", "সাইটটি এখন রক্ষণাবেক্ষণের কাজে আছে। কিছুক্ষণ পরে আবার দেখুন।"); return; }
            S.clear(results);
            var total = +r.total || 0, items = r.items || [];
            var info = L.pageInfo(total, L.LIB_PER_PAGE, (state.page - 1) * L.LIB_PER_PAGE);
            var summary = el("p", { class: "muted lib-count", tabindex: "-1", text: total
              ? "মোট " + L.bnDigits(total) + "টি বই — পাতা " + L.bnDigits(info.page) + " / " + L.bnDigits(info.pages)
              : "" });
            if (!total) {
              results.appendChild(empty(state.q || state.category ? "এই খোঁজে কোনো বই পাওয়া যায়নি। অন্য শব্দ দিয়ে চেষ্টা করুন।" : "বইয়ের তালিকা শীঘ্রই যুক্ত করা হবে।"));
              return;
            }
            if (state.page > info.pages) {
              results.appendChild(S.stateBox("empty", "এই পাতায় কোনো বই নেই।"));
              results.appendChild(el("p", { class: "pager" }, el("a", { href: L.libraryHref({ q: state.q, category: state.category, page: 1 }), text: "প্রথম পাতায় যান" })));
              return;
            }
            results.appendChild(summary);
            results.appendChild(bookTable(items));
            results.appendChild(bookCards(items));
            if (info.pages > 1) results.appendChild(libPager(state, info, function (p) { go({ q: state.q, category: state.category, page: p }, "push", true); }));
            if (focusTop) summary.focus();
          }, function (e) {
            if (my === seq) S.showState(results, "error", L.errorMessage(e), function () { load(state, false); });
          });
        }
        // mode: "push" (new history entry), "replace" (typing), "none" (back / forward button)
        function go(state, mode, focusTop) {
          if (mode !== "none") {
            try { history[mode === "push" ? "pushState" : "replaceState"](null, "", L.libraryHref(state)); } catch (e) { /* the address bar is only a convenience */ }
          }
          load(state, !!focusTop);
        }
        var typed = S.debounce(function () { go({ q: input.value.trim(), category: sel.value, page: 1 }, "replace"); }, 300);
        input.addEventListener("input", typed);
        sel.addEventListener("change", function () { typed.cancel(); go({ q: input.value.trim(), category: sel.value, page: 1 }, "push"); });
        form.addEventListener("submit", function (e) { e.preventDefault(); typed.cancel(); go({ q: input.value.trim(), category: sel.value, page: 1 }, "replace"); });
        window.addEventListener("popstate", function () {
          var s = L.libraryState(location.search);
          input.value = s.q; sel.value = s.category;
          go(s, "none");
        });
        load(st, false);
      }
    });
  };

  var run = pages[document.body.getAttribute("data-page")];
  if (run) run();
})();
