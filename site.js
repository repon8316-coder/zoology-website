// Shared code of the public pages: header / footer / menu, the Supabase call, loading / empty / error states,
// the maintenance page, a tiny safe Markdown renderer. No framework, no innerHTML: all data goes in with textContent.
// Only config.js holds the URL and the key. Every link here is relative, so the site works under any sub-path or domain.
(function () {
  "use strict";
  var L = window.SiteLib;
  var cfg = window.APP_CONFIG || {};

  var DEFAULTS = { name_bn: "প্রাণিবিদ্যা বিভাগ", name_en: "Department of Zoology", college_bn: "রংপুর সরকারি কলেজ, রংপুর" };
  var NAV = [
    ["index.html", "হোম", "home"], ["about.html", "পরিচিতি", "about"], ["teachers.html", "শিক্ষক ও কর্মচারী", "teachers"],
    ["notices.html", "নোটিশ", "notices"], ["gallery.html", "গ্যালারি", "gallery"], ["downloads.html", "ডাউনলোড", "downloads"],
    ["contact.html", "যোগাযোগ", "contact"]
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

  function buildHeader(active) {
    var host = document.getElementById("site-header");
    if (!host) return;
    var n = names();
    var menuBtn = el("button", { type: "button", class: "menu-btn", "aria-expanded": "false", "aria-controls": "site-nav", "aria-label": "মেনু খুলুন বা বন্ধ করুন" },
      [el("span", { class: "menu-bar", "aria-hidden": "true" })]);
    var nav = el("nav", { id: "site-nav", class: "site-nav", "aria-label": "প্রধান মেনু" },
      NAV.map(function (it) { return el("a", { href: it[0], text: it[1], "aria-current": it[2] === active ? "page" : null }); }));
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    shell.brandBn = el("span", { class: "brand-bn", text: n.bn });
    shell.brandSub = el("span", { class: "brand-sub", text: n.college });
    var brand = el("a", { class: "brand", href: "index.html", "aria-label": "হোম পাতা" }, [
      el("span", { class: "logo" }, el("img", { src: "img/logo-zoology-128.png", alt: n.bn, width: "43", height: "44", decoding: "async" })),
      el("span", { class: "brand-text" }, [
        shell.brandBn,
        el("span", { class: "brand-college" }, [
          el("img", { class: "college-mark", src: "img/logo-college.png", alt: "", width: "20", height: "20", decoding: "async" }),
          shell.brandSub
        ])
      ])
    ]);
    var wrap = el("div", { class: "wrap header-row" }, [brand, menuBtn, nav]);
    clear(host).appendChild(wrap);
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
    var links = [
      ["facebook", "Facebook", settings.social_facebook], ["youtube", "YouTube", settings.social_youtube], ["other", "অন্যান্য লিংক", settings.social_other]
    ].map(function (s) {
      var u = L.safeHttpUrl(s[2] || "");
      return u ? el("li", null, el("a", { href: u, text: s[1], target: "_blank", rel: "noopener noreferrer" })) : null;
    });
    clear(host).appendChild(el("div", { class: "wrap footer-grid" }, [
      el("div", null, [
        el("strong", { text: n.bn }),
        el("p", { class: "muted footer-college" }, [
          el("img", { class: "college-mark", src: "img/logo-college.png", alt: "", width: "26", height: "27", loading: "lazy", decoding: "async" }),
          n.college
        ]),
        el("p", { class: "muted", text: n.en })
      ]),
      contact.length ? el("ul", { class: "plain", "aria-label": "যোগাযোগ" }, contact) : null,
      el("ul", { class: "plain", "aria-label": "দরকারি লিংক" }, [
        el("li", null, el("a", { href: "form.html", text: "শিক্ষার্থীর তথ্য ফর্ম" })),
        el("li", null, el("a", { href: "notices.html", text: "সব নোটিশ" })),
        links
      ])
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

  function noticeCard(n) {
    return el("li", { class: "notice" + (n.pinned ? " pinned" : "") }, [
      el("div", { class: "notice-meta" }, [
        n.pinned ? el("span", { class: "badge badge-pin", text: "গুরুত্বপূর্ণ" }) : null,
        n.category ? el("span", { class: "badge", text: n.category }) : null,
        el("time", { datetime: n.publish_at || null, text: L.formatDate(n.publish_at) })
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

  window.Site = {
    el: el, clear: clear, rpc: rpc, page: page, fileUrl: fileUrl, showState: showState, stateBox: stateBox,
    renderMarkdown: renderMarkdown, renderPlain: renderPlain, pageHeading: pageHeading, noticeCard: noticeCard,
    personCard: personCard, names: names, getSettings: function () { return settings; }
  };
})();
