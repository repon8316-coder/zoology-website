// Admin panel shell: sign-in, admin check, menu, hash routing. The sections are in views-content.js and views-other.js.
// No password / token / session is ever written to the page, the URL or the console.
(function () {
  "use strict";
  var A = window.Admin, H = A.H, el = A.el, clear = A.clear, L = A.L;
  var root = document.getElementById("root");
  var NAV = [["dashboard", "ড্যাশবোর্ড"], ["notices", "নোটিশ"], ["people", "শিক্ষক ও কর্মচারী"], ["gallery", "গ্যালারি"], ["downloads", "ডাউনলোড"],
    ["pages", "পাতা"], ["submissions", "ফর্মে জমা পড়া তথ্য"], ["control", "কন্ট্রোল প্যানেল"]];
  var TITLES = {};
  NAV.forEach(function (n) { TITLES[n[0]] = n[1]; });
  var state = { mode: "boot", explicitOut: false, currentHash: "", reverting: false, shell: null };

  function logoImg(cls, src, w, h) { return el("img", { class: cls, src: src, alt: "প্রাণিবিদ্যা বিভাগের লোগো", width: String(w), height: String(h), decoding: "async" }); }

  function screen(kids) {
    state.shell = null;
    clear(root).appendChild(el("main", { class: "center-screen", id: "main" }, kids));
  }

  function showFatal(msg, retry) {
    state.mode = "fatal";
    screen(el("div", { class: "card login-card" }, [logoImg("login-logo", "../img/logo-zoology.png", 150, 152), el("h1", { text: "অ্যাডমিন প্যানেল" }),
      A.S.stateBox("error", msg, retry)]));
  }
  function showLoading() {
    screen(el("div", { class: "card login-card" }, [logoImg("login-logo", "../img/logo-zoology.png", 150, 152), A.S.stateBox("loading", "লোড হচ্ছে…")]));
  }

  // ---------------- sign-in ----------------
  function showLogin(msg) {
    A.setDirty(false);
    state.mode = "login"; state.explicitOut = false;
    var email = el("input", { type: "email", name: "email", autocomplete: "username", required: "", inputmode: "email", autocapitalize: "off", spellcheck: "false" });
    var pw = el("input", { type: "password", name: "password", autocomplete: "current-password", required: "" });
    var err = el("p", { class: "err-text", role: "alert", hidden: "" });
    var btn = el("button", { type: "submit", class: "btn", text: "সাইন ইন" });
    function setErr(t) { err.textContent = t || ""; err.hidden = !t; }
    if (msg) setErr(msg);
    var form = el("form", { novalidate: "" }, [A.field("ইমেইল", email), A.field("পাসওয়ার্ড", pw), err, btn]);
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (btn.disabled) return;
      var e = email.value.trim(), p = pw.value;
      if (!e || !p) { setErr("ইমেইল ও পাসওয়ার্ড দিন"); return; }
      setErr("");
      btn.disabled = true; btn.setAttribute("aria-busy", "true");
      A.withTimeout(A.sb.auth.signInWithPassword({ email: e, password: p }), 25000, "সার্ভার সাড়া দিচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।").then(function (r) {
        pw.value = ""; p = "";
        if (r && r.error) {
          var er = r.error, st = er.status;
          if (st === 429 || /rate limit/i.test(er.message || "")) throw A.userErr("অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।");
          if (st === 400 || st === 401 || /invalid/i.test(er.message || "")) throw A.userErr("ইমেইল বা পাসওয়ার্ড ঠিক নয়");
          throw A.userErr("সাইন ইন করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।");
        }
        return verify();
      }).catch(function (x) {
        pw.value = "";
        btn.disabled = false; btn.removeAttribute("aria-busy");
        setErr(A.errText(x));
        pw.focus();
      });
    });
    screen(el("div", { class: "card login-card" }, [
      logoImg("login-logo", "../img/logo-zoology.png", 150, 152), el("h1", { text: "অ্যাডমিন সাইন ইন" }),
      el("p", { class: "muted", text: "প্রাণিবিদ্যা বিভাগ, রংপুর সরকারি কলেজ" }), form,
      el("a", { class: "login-back", href: "../index.html", text: "← ওয়েবসাইটে ফিরুন" })
    ]));
    email.focus();
  }

  function showDenied() {
    state.mode = "denied"; state.explicitOut = true;
    A.sb.auth.signOut().then(function () {}, function () {});
    screen(el("div", { class: "card login-card" }, [logoImg("login-logo", "../img/logo-zoology.png", 150, 152), el("h1", { text: A.MSG_DENIED }),
      el("p", { class: "muted", text: "এই অ্যাকাউন্ট দিয়ে অ্যাডমিন প্যানেল ব্যবহার করা যাবে না। আপনাকে সাইন আউট করা হয়েছে।" }),
      A.btn("অন্য অ্যাকাউন্টে সাইন ইন করুন", "", function () { showLogin(); }), el("br"), el("a", { class: "login-back", href: "../index.html", text: "← ওয়েবসাইটে ফিরুন" })]));
  }

  // The cheapest admin-only read: student_submission_counts() raises 42501 for anybody who is not an active admin.
  function verify() {
    state.mode = "verify";
    showLoading();
    return A.call("student_submission_counts", {}, 20000).then(function () { return showApp(); }, function (e) {
      if (e.denied) return showDenied();
      if (e.expired) return showLogin(A.MSG_EXPIRED);
      showFatal(A.errText(e), verify);
    });
  }

  // ---------------- the app ----------------
  function showApp() {
    state.mode = "app"; state.explicitOut = false;
    var menuBtn = el("button", { type: "button", class: "menu-btn", "aria-expanded": "false", "aria-controls": "side", "aria-label": "মেনু খুলুন বা বন্ধ করুন" }, el("span", { class: "menu-bar", "aria-hidden": "true" }));
    var who = el("span", { class: "who" });
    var outBtn = A.btn("সাইন আউট", "", function (b) {
      A.leaveOk().then(function (ok) {
        if (!ok) return;
        A.run(b, function () { state.explicitOut = true; return A.sb.auth.signOut().then(function () { showLogin("আপনি সাইন আউট হয়েছেন।"); }); });
      });
    });
    var top = el("header", { class: "top" }, [menuBtn,
      el("a", { class: "brand", href: "#/dashboard", "aria-label": "ড্যাশবোর্ড" }, [el("span", { class: "logo" }, el("img", { src: "../img/logo-zoology-128.png", alt: "প্রাণিবিদ্যা বিভাগের লোগো", width: "43", height: "44", decoding: "async" })),
        el("span", { class: "brand-bn", text: "অ্যাডমিন প্যানেল" })]),
      el("span", { class: "spacer" }), who, outBtn]);
    var links = NAV.map(function (n) { return el("a", { href: "#/" + n[0], "data-route": n[0], text: n[1] }); });
    var side = el("nav", { id: "side", class: "side", "aria-label": "অ্যাডমিন মেনু" }, links.concat([el("div", { class: "side-sep" }),
      el("a", { href: "../index.html", target: "_blank", rel: "noopener", text: "ওয়েবসাইট দেখুন ↗" })]));
    var scrim = el("div", { class: "scrim", hidden: "" });
    var banner = el("div", { class: "banner", role: "status", hidden: "" }, [el("span", { text: "সাইট এখন রক্ষণাবেক্ষণ মোডে আছে — ভিজিটররা শুধু রক্ষণাবেক্ষণের বার্তা দেখছে। " }), el("a", { href: "#/control", text: "কন্ট্রোল প্যানেল" })]);
    var view = el("main", { id: "view", tabindex: "-1" });
    var skip = el("a", { class: "skip", href: "#view", text: "মূল অংশে যান" });
    clear(root).appendChild(el("div", { class: "app" }, [skip, top, banner, side, scrim, el("div", { class: "shell" }, [view])]));
    state.shell = { view: view, side: side, links: links, scrim: scrim, menuBtn: menuBtn, banner: banner };

    function setMenu(open) {
      side.classList.toggle("open", open); scrim.hidden = !open;
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    menuBtn.addEventListener("click", function () { setMenu(!side.classList.contains("open")); });
    scrim.addEventListener("click", function () { setMenu(false); menuBtn.focus(); });
    side.addEventListener("click", function (e) { if (e.target && e.target.tagName === "A") setMenu(false); });
    document.addEventListener("keydown", function esc(e) {
      if (!state.shell || state.shell.view !== view) { document.removeEventListener("keydown", esc); return; }
      if (e.key === "Escape" && side.classList.contains("open")) { setMenu(false); menuBtn.focus(); }
    });
    A.sb.auth.getSession().then(function (r) {
      var u = r && r.data && r.data.session && r.data.session.user;
      if (u && u.email) who.textContent = u.email;
    });
    A.setMaintenance = function (on) { banner.hidden = !on; };
    if (!location.hash || location.hash === "#") history.replaceState(null, "", "#/dashboard");   // no hashchange event
    route();
  }

  function route() {
    var sh = state.shell;
    if (!sh || state.mode !== "app") return;
    var r = H.parseRoute(location.hash);
    state.currentHash = location.hash;
    sh.links.forEach(function (a) { if (a.getAttribute("data-route") === r.name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    document.title = (TITLES[r.name] || "অ্যাডমিন") + " — অ্যাডমিন প্যানেল";
    var alive = A.newToken();
    A.setDirty(false);
    clear(sh.view);
    var fn = A.views && A.views[r.name];
    Promise.resolve().then(function () { return fn(sh.view, r.arg, alive); }).catch(function (e) {
      if (alive()) A.failed(sh.view, e, route);
    });
    try { sh.view.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", function () {
    if (state.mode !== "app") return;
    if (state.reverting) { state.reverting = false; return; }
    if (!A.dirty) { route(); return; }
    A.leaveOk().then(function (ok) {
      if (ok) route();
      else { state.reverting = true; location.hash = state.currentHash; }
    });
  });

  // ---------------- start ----------------
  function boot() {
    if (!A.configured()) { showFatal("সেটিং এখনো সম্পূর্ণ হয়নি (config.js) অথবা প্রয়োজনীয় স্ক্রিপ্ট লোড হয়নি। ইন্টারনেট দেখে পাতাটি আবার খুলুন।", function () { location.reload(); }); return; }
    A.init();
    A.onExpired = function () {
      if (state.mode !== "app") return;
      state.explicitOut = true;
      A.sb.auth.signOut({ scope: "local" }).then(function () {}, function () {});
      showLogin(A.MSG_EXPIRED);
    };
    A.sb.auth.onAuthStateChange(function (event) {
      if (event !== "SIGNED_OUT") return;
      setTimeout(function () {
        if (state.explicitOut || state.mode !== "app") return;
        showLogin(A.MSG_EXPIRED);
      }, 0);
    });
    showLoading();
    A.withTimeout(A.sb.auth.getSession(), 15000).then(function (r) {
      if (r && r.data && r.data.session) return verify();
      showLogin();
    }, function (e) { showFatal(A.errText(e), boot); });
  }
  boot();
})();
