// Shared code of the public pages: header / footer / menu / theme button, the Supabase call, loading / empty / error states,
// the maintenance page, a tiny safe Markdown renderer. No framework, no HTML strings: all data goes in with textContent.
// Only config.js holds the URL and the key. Every link here is relative, so the site works under any sub-path or domain.
(function () {
  "use strict";
  var L = window.SiteLib;
  var cfg = window.APP_CONFIG || {};

  var DEFAULTS = { name_bn: "প্রাণিবিদ্যা বিভাগ", name_en: "Department of Zoology", college_bn: "রংপুর সরকারি কলেজ, রংপুর" };
  // [file, label, key]. The key is the <body data-page> value (the page that is "current").
  var NAV = [
    ["index.html", "হোম", "home"], ["about.html", "পরিচিতি", "about"], ["head.html", "বিভাগীয় প্রধান", "head"],
    ["teachers.html", "শিক্ষক ও কর্মচারী", "teachers"], ["notices.html", "নোটিশ", "notices"], ["routine.html", "ক্লাস রুটিন", "routine"],
    ["museum.html", "মিউজিয়াম", "museum"], ["library.html", "সেমিনার লাইব্রেরি", "library"], ["gallery.html", "গ্যালারি", "gallery"],
    ["downloads.html", "ডাউনলোড", "downloads"], ["contact.html", "যোগাযোগ", "contact"]
  ];

  // ---------- small DOM builder (text only) ----------
  // el("div", {class: "x", href: "..."}, "text" | node | [children...])
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "text") n.textContent = v;
      else n.setAttribute(k, v === true ? "" : v);
    });
    add(n, kids);
    return n;
  }
  function add(n, kids) {
    if (kids == null) return;
    if (!Array.isArray(kids)) kids = [kids];
    kids.forEach(function (k) {
      if (k == null || k === false) return;
      if (Array.isArray(k)) add(n, k);
      else n.appendChild(typeof k === "string" || typeof k === "number" ? document.createTextNode(String(k)) : k);
    });
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

  var SVG_NS = "http://www.w3.org/2000/svg";
  // Tiny line icons built with the DOM (no markup strings): "light" = sun, "dark" = moon, anything else = half circle (auto)
  function icon(kind) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "22"); svg.setAttribute("height", "22");
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round"); svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    function node(name, attrs) {
      var n = document.createElementNS(SVG_NS, name);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      svg.appendChild(n);
    }
    if (kind === "light") {
      node("circle", { cx: "12", cy: "12", r: "4" });
      [[12, 2, 12, 4.5], [12, 19.5, 12, 22], [2, 12, 4.5, 12], [19.5, 12, 22, 12], [4.9, 4.9, 6.6, 6.6], [17.4, 17.4, 19.1, 19.1], [4.9, 19.1, 6.6, 17.4], [17.4, 6.6, 19.1, 4.9]]
        .forEach(function (r) { node("line", { x1: r[0], y1: r[1], x2: r[2], y2: r[3] }); });
    } else if (kind === "dark") {
      node("path", { d: "M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z" });
    } else {
      node("circle", { cx: "12", cy: "12", r: "9" });
      node("path", { d: "M12 3a9 9 0 0 1 0 18z", fill: "currentColor" });
    }
    return svg;
  }

  // ---------- browser storage that never throws ----------
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };

  function debounce(fn, ms) {
    var t = null;
    function d() {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, a); }, ms);
    }
    d.cancel = function () { clearTimeout(t); t = null; };
    return d;
  }

  function configured() {
    return !!(cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY && cfg.SUPABASE_PUBLISHABLE_KEY.indexOf("PASTE_") !== 0);
  }

  // ---------- the call ----------
  function rpc(name, body, timeoutMs) {
    if (!configured()) return Promise.reject(new Error("not configured"));
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || 15000);
    return fetch(cfg.SUPABASE_URL + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    }, function (e) { clearTimeout(timer); throw e; });
  }

  function fileUrl(path) { return L.fileUrl(cfg.SUPABASE_URL, path); }

  // ---------- states ----------
  function stateBox(kind, text, retry) {
    var box = el("div", { class: "state state-" + kind, role: kind === "error" ? "alert" : "status" });
    if (kind === "loading") box.appendChild(el("span", { class: "spinner", "aria-hidden": "true" }));
    box.appendChild(el("p", { text: text }));
    if (retry) {
      var b = el("button", { type: "button", class: "btn btn-outline", text: "আবার চেষ্টা করুন" });
      b.addEventListener("click", retry);
      box.appendChild(b);
    }
    return box;
  }
  function showState(container, kind, text, retry) { clear(container).appendChild(stateBox(kind, text, retry)); }

  // A page widget that fills a placeholder on its own: the placeholder stays hidden until there is data, and a failure of
  // the call or of the render function hides it again. One broken widget never touches the rest of the page.
  // render(data, host) may return false when there is nothing to show.
  function widget(host, load, render) {
    host.hidden = true;
    var p;
    try { p = Promise.resolve(load()); } catch (e) { p = Promise.reject(e); }
    return p.then(function (d) {
      if (!d || d.maintenance) return false;
      try {
        clear(host);
        if (render(d, host) === false) { clear(host); return false; }
        host.hidden = false;
        return true;
      } catch (e) { clear(host); return false; }
    }, function () { return false; });
  }

  // ---------- Markdown (safe subset) ----------
  function inlineNodes(text) {
    return L.parseInline(text).map(function (t) {
      if (t.t === "br") return el("br");
      if (t.t === "strong") return el("strong", { text: t.v });
      if (t.t === "em") return el("em", { text: t.v });
      if (t.t === "a") {
        var ext = /^https?:/i.test(t.href);
        return el("a", { href: t.href, text: t.v, rel: ext ? "noopener noreferrer" : null, target: ext ? "_blank" : null });
      }
      return document.createTextNode(t.v);
    });
  }
  function renderMarkdown(container, md) {
    L.parseMarkdown(md).forEach(function (b) {
      if (b.t === "h") container.appendChild(el("h" + Math.min(4, b.level), null, inlineNodes(b.text)));
      else if (b.t === "p") container.appendChild(el("p", null, inlineNodes(b.text)));
      else if (b.t === "hr") container.appendChild(el("hr"));
      else container.appendChild(el(b.t, null, b.items.map(function (it) { return el("li", null, inlineNodes(it)); })));
    });
    return container;
  }
  // plain text with blank-line paragraphs and single line breaks (used for notices)
  function renderPlain(container, text) {
    String(text || "").replace(/\r\n?/g, "\n").split(/\n{2,}/).forEach(function (para) {
      if (!para.trim()) return;
      var p = el("p");
      para.split("\n").forEach(function (line, i) { if (i) p.appendChild(el("br")); p.appendChild(document.createTextNode(line)); });
      container.appendChild(p);
    });
    return container;
  }

  // ---------- shell: header, footer ----------
  var settings = {};
  var shell = {};

  function names() {
    return {
      bn: settings.name_bn || DEFAULTS.name_bn, en: settings.name_en || DEFAULTS.name_en, college: settings.college_bn || DEFAULTS.college_bn
    };
  }

  // The theme button: auto -> day -> night -> auto. The choice is kept in localStorage ("site-theme"); the inline script in every
  // page head applies it before the first paint (window.SiteTheme).
  function themeButton() {
    var pref = L.normalizeThemePref(window.SiteTheme ? window.SiteTheme.get() : store.get("site-theme"));
    var btn = el("button", { type: "button", class: "icon-btn theme-btn" });
    var live = el("span", { class: "sr", role: "status", "aria-live": "polite" });
    function paint(announce) {
      var label = L.themeLabel(pref), next = L.themeLabel(L.nextThemePref(pref));
      btn.setAttribute("aria-label", "থিম: " + label + "। বদলাতে চাপুন (পরেরটি: " + next + ")");
      btn.setAttribute("title", label);
      btn.setAttribute("aria-pressed", pref === "auto" ? "false" : "true");
      btn.setAttribute("data-pref", pref);
      clear(btn).appendChild(icon(pref));
      if (announce) live.textContent = label + " চালু হয়েছে";
    }
    btn.addEventListener("click", function () {
      pref = L.nextThemePref(pref);
      store.set("site-theme", pref);
      if (window.SiteTheme) window.SiteTheme.apply(pref);
      else document.documentElement.setAttribute("data-theme", L.resolveTheme(pref, false));
      paint(true);
    });
    paint(false);
    return [btn, live];
  }

  function buildHeader(active) {
    var host = document.getElementById("site-header");
    if (!host) return;
    var n = names();
    var menuBtn = el("button", { type: "button", class: "icon-btn menu-btn", "aria-expanded": "false", "aria-controls": "site-nav", "aria-label": "মেনু খুলুন বা বন্ধ করুন" },
      [el("span", { class: "menu-bar", "aria-hidden": "true" })]);
    var nav = el("nav", { id: "site-nav", class: "site-nav", "aria-label": "প্রধান মেনু" },
      NAV.map(function (it) { return el("a", { href: it[0], text: it[1], "aria-current": it[2] === active ? "page" : null }); }));
    function setOpen(open) {
      nav.classList.toggle("open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    menuBtn.addEventListener("click", function () { setOpen(!nav.classList.contains("open")); });
    host.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) { setOpen(false); menuBtn.focus(); }
    });
    shell.brandBn = el("span", { class: "brand-bn", text: n.bn });
    shell.brandSub = el("span", { class: "brand-sub", text: n.college });
    var brand = el("a", { class: "brand", href: "index.html", "aria-label": "হোম পাতা" }, [
      el("span", { class: "logo" }, el("img", { src: "img/logo-zoology-128.png", alt: "", width: "43", height: "44", decoding: "async" })),
      el("span", { class: "brand-text" }, [
        shell.brandBn,
        el("span", { class: "brand-college" }, [
          el("img", { class: "college-mark", src: "img/logo-college.png", alt: "", width: "20", height: "20", decoding: "async" }),
          shell.brandSub
        ])
      ])
    ]);
    clear(host);
    host.appendChild(el("div", { class: "wrap header-row" }, [brand, el("div", { class: "header-tools" }, themeButton().concat([menuBtn]))]));
    host.appendChild(el("div", { class: "nav-band" }, el("div", { class: "wrap" }, nav)));
    host.appendChild(el("div", { class: "ruler", "aria-hidden": "true" }));
    host.className = "site-header";
  }

  function buildFooter() {
    var host = document.getElementById("site-footer");
    if (!host) return;
    host.className = "site-footer";
    shell.footer = host;
    renderFooter();
  }

  function renderFooter() {
    var host = shell.footer;
    if (!host) return;
    var n = names();
    var contact = [];
    if (!settings.maintenance) {
      if (settings.address) contact.push(el("li", { text: settings.address }));
      var tel = L.telHref(settings.phone || "");
      if (settings.phone) contact.push(el("li", null, tel ? el("a", { href: tel, text: settings.phone }) : settings.phone));
      var mail = L.safeEmail(settings.email || "");
      if (mail) contact.push(el("li", null, el("a", { href: "mailto:" + mail, text: mail })));
    }
    var social = [
      ["facebook", "Facebook", settings.social_facebook], ["youtube", "YouTube", settings.social_youtube], ["other", "অন্যান্য লিংক", settings.social_other]
    ].map(function (s) {
      var u = L.safeHttpUrl(s[2] || "");
      return u ? el("li", null, el("a", { href: u, text: s[1], target: "_blank", rel: "noopener noreferrer" })) : null;
    });
    var quick = [["notices.html", "নোটিশ"], ["routine.html", "ক্লাস রুটিন"], ["museum.html", "মিউজিয়াম"], ["library.html", "সেমিনার লাইব্রেরি"],
      ["downloads.html", "ডাউনলোড"], ["gallery.html", "গ্যালারি"], ["form.html", "শিক্ষার্থীর তথ্য ফর্ম"]]
      .map(function (q) { return el("li", null, el("a", { href: q[0], text: q[1] })); });
    clear(host).appendChild(el("div", { class: "wrap footer-grid" }, [
      el("div", { class: "footer-id" }, [
        el("img", { class: "footer-logo", src: "img/logo-college.png", alt: "", width: "52", height: "54", loading: "lazy", decoding: "async" }),
        el("div", null, [
          el("strong", { class: "footer-name", text: n.bn }),
          el("p", { class: "muted", text: n.college }),
          el("p", { class: "muted", text: n.en })
        ])
      ]),
      contact.length ? el("div", null, [el("h2", { class: "footer-h", text: "যোগাযোগ" }), el("ul", { class: "plain" }, contact)]) : null,
      el("div", null, [el("h2", { class: "footer-h", text: "দরকারি লিংক" }), el("ul", { class: "plain" }, quick.concat(social))])
    ]));
    host.appendChild(el("div", { class: "wrap copy", text: "© " + L.bnDigits(new Date().getFullYear()) + " " + n.bn + ", " + n.college }));
  }

  function applySettings(s) {
    settings = s && typeof s === "object" ? s : {};
    if (shell.brandBn) { shell.brandBn.textContent = names().bn; shell.brandSub.textContent = names().college; }
    renderFooter();
  }

  function maintenanceView(main) {
    var n = names();
    clear(main).appendChild(el("section", { class: "wrap maint" }, [
      el("h1", { text: "সাইটটি এখন রক্ষণাবেক্ষণের কাজে আছে" }),
      el("p", { text: n.bn + ", " + n.college + " — ওয়েবসাইটে কিছু কাজ চলছে। কিছুক্ষণ পরে আবার দেখুন।" }),
      el("p", { class: "muted", text: "অসুবিধার জন্য আমরা দুঃখিত।" })
    ]));
    document.title = "রক্ষণাবেক্ষণ — " + n.bn;
  }

  // ---------- the page runner ----------
  // Site.page({ id, title, load: () => Promise<data>, render: (data, main, settings) => void })
  function page(opts) {
    var main = document.getElementById("main");
    buildHeader(opts.id);
    buildFooter();
    document.title = (opts.title ? opts.title + " — " : "") + DEFAULTS.name_bn;
    var maint = false;

    function setTitle() { document.title = (opts.title ? opts.title + " — " : "") + names().bn; }

    var settingsP = rpc("web_site_settings", {}).then(function (s) {
      applySettings(s);
      if (s && s.maintenance) { maint = true; maintenanceView(main); } else setTitle();
      return s;
    }, function () { return null; });   // a settings failure is not fatal: the page's own call shows the error

    function run() {
      showState(main, "loading", "লোড হচ্ছে…");
      main.setAttribute("aria-busy", "true");
      var dataP;
      try { dataP = Promise.resolve(opts.load()); } catch (e) { dataP = Promise.reject(e); }
      dataP.then(function (data) {
        return settingsP.then(function () {
          main.removeAttribute("aria-busy");
          if (maint || (data && data.maintenance)) {
            if (!maint) { maint = true; maintenanceView(main); }
            return;
          }
          clear(main);
          opts.render(data, main, settings);
        });
      }).catch(function (e) {
        main.removeAttribute("aria-busy");
        if (maint) return;
        showState(main, "error", L.errorMessage(e), run);
      });
    }
    run();
  }

  // ---------- small shared widgets ----------
  function pageHeading(title, lead) {
    return el("header", { class: "page-head" }, [el("h1", { text: title }), lead ? el("p", { class: "muted", text: lead }) : null]);
  }

  // A notice row. compact === true: date + title only (home page).
  function noticeCard(n, compact) {
    var date = el("time", { datetime: n.publish_at || null, text: L.formatDate(n.publish_at) });
    if (compact === true) {
      return el("li", { class: "notice notice-compact" + (n.pinned ? " pinned" : "") }, [
        date,
        el("a", { class: "notice-title", href: "notice.html?id=" + encodeURIComponent(n.id), text: n.title }),
        n.pinned ? el("span", { class: "badge badge-pin", text: "গুরুত্বপূর্ণ" }) : null
      ]);
    }
    return el("li", { class: "notice" + (n.pinned ? " pinned" : "") }, [
      el("div", { class: "notice-meta" }, [
        n.pinned ? el("span", { class: "badge badge-pin", text: "গুরুত্বপূর্ণ" }) : null,
        n.category ? el("span", { class: "badge", text: n.category }) : null,
        date
      ]),
      el("a", { class: "notice-title", href: "notice.html?id=" + encodeURIComponent(n.id), text: n.title }),
      n.excerpt ? el("p", { class: "muted clamp", text: n.excerpt }) : null,
      n.has_attachment ? el("span", { class: "badge badge-file", text: "সংযুক্ত ফাইল আছে" }) : null
    ]);
  }

  function personCard(p) {
    var photo = L.fileUrl(cfg.SUPABASE_URL, p.photo_path || "");
    var mail = L.safeEmail(p.email_public || "");
    return el("li", { class: "person" }, [
      photo ? el("img", { class: "avatar", src: photo, alt: p.name, loading: "lazy", decoding: "async", width: "96", height: "96" })
            : el("span", { class: "avatar avatar-ph", "aria-hidden": "true", text: L.initials(p.name) }),
      el("div", { class: "person-body" }, [
        el("h3", { text: p.name }),
        p.designation ? el("p", { class: "muted", text: p.designation }) : null,
        mail ? el("p", null, el("a", { href: "mailto:" + mail, text: mail })) : null,
        p.bio ? el("details", null, [el("summary", { text: "পরিচিতি" }), el("p", { class: "bio", text: p.bio })]) : null
      ])
    ]);
  }

  // A page of the 'site pages' table (about, museum, seminar-library ...). Never rejects: resolves to the item or null.
  function loadPageItem(slug) {
    return rpc("web_site_page", { p_slug: slug }).then(function (r) { return r && !r.maintenance ? (r.item || null) : null; }, function () { return null; });
  }

  window.Site = {
    el: el, clear: clear, rpc: rpc, page: page, fileUrl: fileUrl, showState: showState, stateBox: stateBox, icon: icon,
    renderMarkdown: renderMarkdown, renderPlain: renderPlain, pageHeading: pageHeading, noticeCard: noticeCard,
    personCard: personCard, names: names, getSettings: function () { return settings; },
    store: store, debounce: debounce, widget: widget, loadPageItem: loadPageItem
  };
})();
