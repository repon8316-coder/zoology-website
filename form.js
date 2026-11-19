(function () {
  "use strict";
  var cfg = window.APP_CONFIG || {};
  var V = window.Validate;
  var form = document.getElementById("f");
  var result = document.getElementById("result");
  var sendBtn = document.getElementById("send");
  var sessionEl = document.getElementById("session");
  var programEl = document.getElementById("program");
  var programWrap = document.getElementById("program_wrap");
  var yearInfo = document.getElementById("year_info");
  var batches = [];
  var ctx = { needProgram: false };
  var FIELDS = Object.keys(V.rules);
  var touched = {};

  function configured() {
    return cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY && cfg.SUPABASE_PUBLISHABLE_KEY.indexOf("PASTE_") !== 0;
  }

  function rpc(name, body, timeoutMs) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || 20000);
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

  function showCard(kind, text) {
    result.innerHTML = "";
    if (!text) return;
    var d = document.createElement("div");
    d.className = "alert " + kind;
    d.textContent = text;
    result.appendChild(d);
    result.focus();
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function val(name) {
    if (name === "gender") {
      var r = form.querySelector("input[name=gender]:checked");
      return r ? r.value : "";
    }
    return form.elements[name] ? form.elements[name].value : "";
  }
  function setErr(name, msg) {
    var m = document.getElementById("e_" + name);
    if (m) m.textContent = msg || "";
    var el = form.elements[name];
    if (el && el.classList) el.classList.toggle("invalid", !!msg);
    if (el && el.setAttribute) el.setAttribute("aria-invalid", msg ? "true" : "false");
  }
  function check(name) {
    var msg = V.rules[name](val(name), ctx);
    setErr(name, msg);
    return msg;
  }
  function data() {
    var d = {};
    FIELDS.forEach(function (k) { d[k] = val(k); });
    d.session = sessionEl.value;
    d.program = ctx.needProgram ? programEl.value : (currentProgram() || "");
    var b = pick();
    d.year_of_study = b ? String(b.year_of_study) : "";
    return d;
  }

  // ---- dropdown options ----
  function currentProgram() {
    var list = batches.filter(function (b) { return b.session === sessionEl.value; });
    return list.length === 1 ? list[0].program : "";
  }
  function pick() {
    var list = batches.filter(function (b) { return b.session === sessionEl.value; });
    if (list.length === 1) return list[0];
    return list.filter(function (b) { return b.program === programEl.value; })[0] || null;
  }
  function onSession() {
    var list = batches.filter(function (b) { return b.session === sessionEl.value; });
    ctx.needProgram = list.length > 1;
    programWrap.hidden = !ctx.needProgram;
    programEl.innerHTML = "";
    if (ctx.needProgram) {
      var o = document.createElement("option");
      o.value = ""; o.textContent = "— বেছে নিন —";
      programEl.appendChild(o);
      list.forEach(function (b) {
        var x = document.createElement("option");
        x.value = b.program; x.textContent = b.program;
        programEl.appendChild(x);
      });
    }
    onProgram();
  }
  function onProgram() {
    var b = pick();
    yearInfo.textContent = b ? "প্রোগ্রাম: " + b.program + " • বর্ষ: " + b.year_of_study : "";
  }
  function loadOptions() {
    sessionEl.innerHTML = '<option value="">লোড হচ্ছে…</option>';
    if (!configured()) {
      sessionEl.innerHTML = '<option value="">— বেছে নিন —</option>';
      showCard("err", "ফর্মটি এখনো চালু করা হয়নি (config.js-এ কী বসানো হয়নি)।");
      return;
    }
    rpc("student_web_options", {}, 15000).then(function (o) {
      if (o && o.open === false) {
        showCard("warn", "এখন তথ্য নেওয়া বন্ধ আছে।");
        sendBtn.disabled = true;
      }
      batches = (o && o.batches) || [];
      var seen = {};
      sessionEl.innerHTML = '<option value="">— বেছে নিন —</option>';
      batches.forEach(function (b) {
        if (seen[b.session]) return;
        seen[b.session] = 1;
        var x = document.createElement("option");
        x.value = b.session; x.textContent = b.session;
        sessionEl.appendChild(x);
      });
    }).catch(function () {
      sessionEl.innerHTML = '<option value="">— বেছে নিন —</option>';
      showCard("err", "শিক্ষাবর্ষের তালিকা আনা যায়নি। ইন্টারনেট দেখে পাতাটি আবার খুলুন।");
    });
  }

  // ---- instant validation ----
  FIELDS.forEach(function (name) {
    var els = form.querySelectorAll('[name="' + name + '"]');
    Array.prototype.forEach.call(els, function (el) {
      el.addEventListener("blur", function () { touched[name] = true; check(name); });
      var ev = el.tagName === "SELECT" || el.type === "radio" || el.type === "date" ? "change" : "input";
      el.addEventListener(ev, function () { if (touched[name] || ev === "change") { touched[name] = true; check(name); } });
    });
  });
  sessionEl.addEventListener("change", function () { onSession(); check("session"); });
  programEl.addEventListener("change", function () { onProgram(); check("program"); });

  // ---- submit ----
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    showCard("", "");
    var d = data();
    var errs = V.validateAll(d, ctx);
    FIELDS.forEach(function (k) { setErr(k, errs[k]); });
    var first = FIELDS.filter(function (k) { return errs[k]; })[0];
    if (first) {
      var el = form.querySelector('[name="' + first + '"]');
      if (el) el.focus();
      showCard("err", "কিছু তথ্য ঠিক নেই, লাল লেখাগুলো দেখুন।");
      return;
    }
    if (!configured()) { showCard("err", "ফর্মটি এখনো চালু করা হয়নি।"); return; }
    sendBtn.disabled = true;
    sendBtn.textContent = "পাঠানো হচ্ছে…";
    rpc("student_web_submit", { p_data: d, p_hp: form.elements.website.value }, 25000).then(function (r) {
      if (r && r.ok) {
        showCard("ok", r.message || "আপনার তথ্য জমা হয়েছে। ধন্যবাদ");
        form.reset();
        touched = {};
        FIELDS.forEach(function (k) { setErr(k, ""); });
        onSession();
      } else if (r && (r.code === "already_exists" || r.code === "pending_exists" || r.code === "too_many" || r.code === "closed")) {
        showCard("warn", r.message);
      } else if (r && r.errors) {
        Object.keys(r.errors).forEach(function (k) { setErr(k, r.errors[k]); });
        showCard("err", r.message || "কিছু তথ্য ঠিক নেই।");
      } else {
        showCard("err", (r && r.message) || "তথ্য জমা হয়নি। আবার চেষ্টা করুন।");
      }
    }).catch(function () {
      showCard("err", "ইন্টারনেটে সমস্যা বা সময় শেষ। আপনার লেখা তথ্য আছে — আবার \"জমা দিন\" চাপুন।");
    }).then(function () {
      sendBtn.disabled = false;
      sendBtn.textContent = "জমা দিন";
    });
  });

  loadOptions();
})();
