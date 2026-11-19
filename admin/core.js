// Admin core: Supabase client, calls with timeout, Bangla errors, toasts, dialogs, form helpers, uploads.
// No innerHTML anywhere: all data goes in through textContent / DOM APIs (the el() builder of site.js).
// The password is only read from the sign-in field, passed to supabase-js and the field is cleared; it is never stored or logged.
(function () {
  "use strict";
  var L = window.SiteLib, H = window.AdminHelpers, S = window.Site, cfg = window.APP_CONFIG || {};
  var el = S.el, clear = S.clear;
  var BUCKET = L.PUBLIC_BUCKET;
  var NOTE_PUBLIC = "এখানে শুধু সবার জন্য খোলা ফাইল দিন। শিক্ষার্থীর ব্যক্তিগত তথ্য কখনোই এখানে আপলোড করবেন না।";
  var MSG_EXPIRED = "আপনার সেশনের মেয়াদ শেষ হয়েছে। আবার সাইন ইন করুন।";
  var MSG_DENIED = "আপনার অ্যাডমিন অনুমতি নেই";

  var A = window.Admin = {
    sb: null, dirty: false, viewToken: 0, onExpired: null,
    el: el, clear: clear, L: L, H: H, S: S, NOTE_PUBLIC: NOTE_PUBLIC, MSG_EXPIRED: MSG_EXPIRED, MSG_DENIED: MSG_DENIED
  };

  A.configured = function () {
    return !!(cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY && cfg.SUPABASE_PUBLISHABLE_KEY.indexOf("PASTE_") !== 0 && window.supabase);
  };

  A.init = function () {
    A.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "zoology-admin-auth" }
    });
    return A.sb;
  };

  // ---------------- errors ----------------
  var BN_RE = /[ঀ-৿]/;
  function toError(e) {
    var msg = e && e.message ? String(e.message) : "";
    var code = e && e.code ? String(e.code) : "";
    var err = new Error(msg || "error");
    err.code = code;
    if (code === "42501" || /Only admin/i.test(msg)) { err.denied = true; err.userMessage = MSG_DENIED; }
    else if (code === "28000" || code === "PGRST301" || code === "PGRST303" || /JWT|Sign in first|not authenticated/i.test(msg)) {
      err.expired = true; err.userMessage = MSG_EXPIRED;
    } else if (code === "PGRST202" || /Could not find the function/i.test(msg)) {
      err.missing = true; err.userMessage = "এই সুবিধা ডাটাবেসে এখনো চালু হয়নি (নতুন মাইগ্রেশন চালাতে হবে)।";
    } else if (BN_RE.test(msg) && !/^\s*[{\[]/.test(msg)) {
      err.userMessage = msg;                                   // the server's own Bangla message, shown as it is
    } else if (/abort|timeout/i.test(msg + " " + (e && e.name || ""))) {
      err.userMessage = "সার্ভার সাড়া দিচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
    } else if (/fetch|network|load failed/i.test(msg)) {
      err.userMessage = "ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না। আবার চেষ্টা করুন।";
    } else {
      err.userMessage = "কাজটি করা যায়নি। আবার চেষ্টা করুন।";
    }
    return err;
  }
  A.toError = toError;
  A.errText = function (e) { return (e && e.userMessage) || L.errorMessage(e); };
  function userErr(msg) { var e = new Error(msg); e.userMessage = msg; return e; }
  A.userErr = userErr;

  // ---------------- calls ----------------
  A.call = function (name, args, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms || 20000);
    var p;
    try { p = A.sb.rpc(name, args || {}).abortSignal(ctrl.signal); } catch (e) { clearTimeout(timer); return Promise.reject(toError(e)); }
    return Promise.resolve(p).then(function (r) {
      clearTimeout(timer);
      if (r.error) throw toError(r.error);
      return r.data;
    }, function (e) { clearTimeout(timer); throw toError(e); }).catch(function (e) {
      if (e && e.expired && A.onExpired) A.onExpired();
      throw e;
    });
  };

  function withTimeout(p, ms, msg) {
    var timer;
    var t = new Promise(function (_, rej) { timer = setTimeout(function () { rej(userErr(msg || "সার্ভার সাড়া দিচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।")); }, ms); });
    return Promise.race([Promise.resolve(p), t]).then(function (v) { clearTimeout(timer); return v; }, function (e) { clearTimeout(timer); throw e; });
  }
  A.withTimeout = withTimeout;

  // ---------------- toasts ----------------
  A.toast = function (msg, kind) {
    var host = document.getElementById("toasts");
    if (!host) return;
    var t = el("div", { class: "toast toast-" + (kind || "ok"), role: kind === "error" ? "alert" : "status", text: msg });
    host.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, kind === "error" ? 9000 : 5000);
  };
  A.toastError = function (e) { A.toast(A.errText(e), "error"); };

  // ---------------- dialogs ----------------
  // A.dialog({title, body: node, buttons: [{text, cls, value}]}) -> Promise<value or null>. Esc / backdrop = null.
  A.dialog = function (o) {
    return new Promise(function (resolve) {
      var dlg = document.createElement("dialog");
      dlg.className = "dlg";
      var result = null;
      var btns = (o.buttons || []).map(function (b) {
        var bt = el("button", { type: "button", class: "btn " + (b.cls || "btn-outline"), text: b.text });
        bt.addEventListener("click", function () {
          if (b.validate && !b.validate()) return;
          result = b.value; dlg.close();
        });
        return bt;
      });
      dlg.appendChild(el("div", { class: "dlg-body" }, [
        el("h2", { class: "dlg-title", text: o.title || "" }),
        o.message ? el("p", { text: o.message }) : null,
        o.body || null,
        el("div", { class: "dlg-actions" }, btns)
      ]));
      dlg.addEventListener("close", function () {
        if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
        resolve(result);
      });
      document.body.appendChild(dlg);
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
      var focus = dlg.querySelector(o.focusFirst ? "input, textarea, select, button" : ".btn-outline") || dlg.querySelector("button");
      if (focus) focus.focus();
    });
  };

  // Yes / no question. Resolves true / false.
  A.confirm = function (o) {
    return A.dialog({
      title: o.title, message: o.message, body: o.body,
      buttons: [{ text: o.cancel || "না, থাক", cls: "btn-outline", value: false }, { text: o.ok || "হ্যাঁ", cls: o.danger ? "btn-danger" : "", value: true }]
    }).then(function (v) { return v === true; });
  };

  // ---------------- unsaved changes ----------------
  A.setDirty = function (v) { A.dirty = !!v; };
  window.addEventListener("beforeunload", function (e) {
    if (A.dirty) { e.preventDefault(); e.returnValue = ""; }
  });
  A.leaveOk = function () {
    if (!A.dirty) return Promise.resolve(true);
    return A.confirm({ title: "সংরক্ষণ করা হয়নি", message: "আপনার করা পরিবর্তন সংরক্ষণ হয়নি। পাতা ছেড়ে গেলে তা হারিয়ে যাবে। যেতে চান?", ok: "হ্যাঁ, ছেড়ে যাই", cancel: "না, এখানেই থাকি", danger: true })
      .then(function (ok) { if (ok) A.dirty = false; return ok; });
  };
  // mark a form as "changed" on any edit
  A.watchDirty = function (form) {
    var f = function () { A.setDirty(true); };
    form.addEventListener("input", f); form.addEventListener("change", f);
  };

  // ---------------- buttons and fields ----------------
  // Runs fn while the button is disabled (no double submit). Resolves to fn's value; an error is toasted and gives undefined.
  A.run = function (btn, fn, okMsg) {
    if (btn && btn.disabled) return Promise.resolve();
    if (btn) { btn.disabled = true; btn.setAttribute("aria-busy", "true"); }
    function done() { if (btn) { btn.disabled = false; btn.removeAttribute("aria-busy"); } }
    return Promise.resolve().then(fn).then(function (v) {
      done();
      if (okMsg) A.toast(okMsg, "ok");
      return v;
    }, function (e) { done(); A.toastError(e); });
  };

  A.btn = function (text, cls, fn, attrs) {
    var b = el("button", Object.assign({ type: "button", class: "btn " + (cls || "") , text: text }, attrs || {}));
    if (fn) b.addEventListener("click", function () { fn(b); });
    return b;
  };

  var idn = 0;
  A.uid = function (p) { idn += 1; return (p || "f") + idn; };

  // label + control (+ hint). `control` is a node whose id is set here.
  A.field = function (label, control, hint) {
    var id = control.id || A.uid("f");
    control.id = id;
    return el("div", { class: "field" }, [
      el("label", { for: id, text: label }), control, hint ? el("p", { class: "hint muted", text: hint }) : null
    ]);
  };
  A.input = function (name, value, attrs) {
    return el("input", Object.assign({ type: "text", name: name, value: value == null ? "" : String(value) }, attrs || {}));
  };
  A.textarea = function (name, value, rows) { return el("textarea", { name: name, rows: String(rows || 6), text: value == null ? "" : String(value) }); };
  A.select = function (name, options, value) {
    return el("select", { name: name }, options.map(function (o) {
      return el("option", { value: o[0], text: o[1], selected: String(o[0]) === String(value) });
    }));
  };
  A.check = function (name, label, checked) {
    return el("label", { class: "check" }, [el("input", { type: "checkbox", name: name, checked: !!checked }), el("span", { text: label })]);
  };
  A.datalist = function (id, values) { return el("datalist", { id: id }, values.map(function (v) { return el("option", { value: v }); })); };

  A.pageTitle = function (title, actions) {
    return el("div", { class: "page-title" }, [el("h1", { text: title }), actions ? el("div", { class: "actions" }, actions) : null]);
  };

  A.badge = function (text, cls) { return el("span", { class: "badge " + (cls || ""), text: text }); };

  // loading / error / empty states
  A.loading = function (c) { S.showState(c, "loading", "লোড হচ্ছে…"); };
  A.failed = function (c, e, retry) { S.showState(c, "error", A.errText(e), retry); };
  A.empty = function (text) { return S.stateBox("empty", text); };

  // stale-render guard: every render of the main area gets a token
  A.newToken = function () { A.viewToken += 1; var t = A.viewToken; return function () { return t === A.viewToken; }; };

  A.thumb = function (path, cls, w, h, alt) {
    var u = L.fileUrl(cfg.SUPABASE_URL, path || "");
    return u ? el("img", { class: cls || "thumb", src: u, alt: alt || "", width: String(w || 64), height: String(h || 64), loading: "lazy", decoding: "async" }) : null;
  };
  A.publicUrl = function (path) { return L.fileUrl(cfg.SUPABASE_URL, path || ""); };

  // ---------------- uploads (bucket site-public, admin session) ----------------
  function uuid() {
    var c = window.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    var b = new Uint8Array(16); c.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  function readHead(file) {
    return file.slice(0, 16).arrayBuffer().then(function (b) { return Array.prototype.slice.call(new Uint8Array(b)); });
  }

  function decodeImage(file) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () { return createImageBitmap(file); }).catch(function () { return viaImg(file); });
    }
    return viaImg(file);
  }
  function viaImg(file) {   // modern browsers apply the EXIF orientation when drawing an <img>
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); res(img); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(userErr("ছবিটি খোলা যায়নি")); };
      img.src = url;
    });
  }
  function toBlob(canvas, type, q) {
    return new Promise(function (res) { canvas.toBlob(function (b) { res(b); }, type, q); });
  }

  // Check and (for images) shrink. Resolves {blob, ext, mime}. Rejects with a Bangla message.
  A.prepareFile = function (file, wanted) {
    return readHead(file).then(function (head) {
      var c = H.classifyFile({ name: file.name, size: file.size, type: file.type }, head, wanted || "any");
      if (!c.ok) throw userErr(c.error);
      if (c.kind !== "image") return { blob: file, ext: c.ext, mime: c.mime };
      return decodeImage(file).then(function (img) {
        var w = img.width, h = img.height;
        function same() { if (img.close) img.close(); return { blob: file, ext: c.ext, mime: c.mime }; }
        if (H.keepOriginalImage(w, h, file.size)) return same();
        var d = H.fitDimensions(w, h);
        var cv = document.createElement("canvas");
        cv.width = d.w; cv.height = d.h;
        var ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0, d.w, d.h);
        return toBlob(cv, "image/webp", 0.82).then(function (b) {
          if (b && b.type === "image/webp") return { blob: b, ext: "webp", mime: "image/webp" };
          ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, d.w, d.h);   // jpeg has no transparency
          return toBlob(cv, "image/jpeg", 0.82).then(function (j) {
            if (!j) throw userErr("ছবিটি ছোট করা যায়নি");
            return { blob: j, ext: "jpg", mime: "image/jpeg" };
          });
        }).then(function (out) {
          if (img.close) img.close();
          if (!d.scaled && out.blob.size >= file.size) return { blob: file, ext: c.ext, mime: c.mime };   // not smaller: keep the original
          if (out.blob.size > H.MAX_BYTES) throw userErr("ছবি ছোট করার পরেও ১০ MB এর বেশি বড়");
          return out;
        });
      });
    });
  };

  function storageError(e) {
    var m = String(e && (e.message || e.error) || "");
    if (/exceed|too large|maximum allowed size|413/i.test(m)) return userErr("ফাইল ১০ MB এর বেশি বড়");
    if (/mime|not supported|invalid_mime/i.test(m)) return userErr("ফাইলের ধরন চলবে না");
    if (/row-level|policy|unauthor|forbidden|403|401/i.test(m)) return userErr("আপলোডের অনুমতি নেই। আবার সাইন ইন করে দেখুন।");
    if (/already exists|duplicate/i.test(m)) return userErr("এই নামে ফাইল আগেই আছে। আবার চেষ্টা করুন।");
    if (/fetch|network/i.test(m)) return userErr("ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না। আবার চেষ্টা করুন।");
    return userErr("ফাইল আপলোড করা যায়নি। আবার চেষ্টা করুন।");
  }

  // Uploads a prepared file to <area>/<yyyymm>/<uuid>-<safe-name>.<ext> (insert only, never overwrites). Resolves {path, size}.
  A.upload = function (prep, area, originalName) {
    var path = H.buildPath(area, new Date(), uuid(), originalName, prep.ext);
    return withTimeout(
      A.sb.storage.from(BUCKET).upload(path, prep.blob, { contentType: prep.mime, upsert: false, cacheControl: "3600" }),
      120000, "আপলোড সাড়া দিচ্ছে না। আবার চেষ্টা করুন।"
    ).then(function (r) {
      if (r && r.error) throw storageError(r.error);
      return { path: path, size: prep.blob.size };
    }, function (e) { throw e && e.userMessage ? e : storageError(e); });
  };

  // Removes objects from the bucket. Never throws: resolves true when it worked (or nothing to do), false otherwise.
  A.removeObjects = function (paths) {
    var list = (paths || []).filter(function (p) { return H.isValidPath(p); });
    if (!list.length) return Promise.resolve(true);
    return withTimeout(A.sb.storage.from(BUCKET).remove(list), 30000).then(function (r) { return !(r && r.error); }, function () { return false; });
  };
  A.warnCleanup = function () { A.toast("ডাটাবেসে কাজ হয়ে গেছে, কিন্তু পুরনো ফাইল মুছতে সমস্যা হয়েছে। ফাইলটি সার্ভারে থেকে গেছে, তবে সাইটে দেখা যাবে না।", "warn"); };

  // Upload one file, then save the row with it. If the save fails, the new file is deleted again (no orphan).
  // o: {file, wanted, area, save(path, size) -> Promise<row>, oldPath}. Resolves {row}. The old file is removed only after the save worked.
  A.uploadAndSave = function (o) {
    var up;
    return A.prepareFile(o.file, o.wanted).then(function (prep) { return A.upload(prep, o.area, o.file.name); }).then(function (u) {
      up = u;
      return o.save(u.path, u.size);
    }).then(function (row) {
      if (o.oldPath && o.oldPath !== up.path) return A.removeObjects([o.oldPath]).then(function (ok) { if (!ok) A.warnCleanup(); return { row: row, path: up.path, size: up.size }; });
      return { row: row, path: up.path, size: up.size };
    }, function (e) {
      if (up) return A.removeObjects([up.path]).then(function () { throw e; });
      throw e;
    });
  };

  // Many files at once. Shows a progress list in `host`. o: {files, wanted, area, save(path,size,file)->Promise, done: {} (shared set), onDone()}.
  // Sequential; a failed file does not stop the others; a file that was already added is never added twice.
  A.uploadMany = function (host, o) {
    var done = o.done || {};
    var items = Array.prototype.slice.call(o.files).map(function (f) {
      var key = H.fileKey(f);
      var row = el("li", { class: "up-row" }, [el("span", { class: "up-name", text: f.name }), el("span", { class: "up-state muted", text: "অপেক্ষায়" })]);
      return { file: f, key: key, row: row, state: row.lastChild, ok: !!done[key] };
    });
    clear(host);
    var list = el("ul", { class: "plain up-list" }, items.map(function (i) { return i.row; }));
    var summary = el("p", { class: "up-summary", role: "status" });
    host.appendChild(list); host.appendChild(summary);
    var total = items.length, okCount = 0;
    function setState(it, text, cls) { it.state.textContent = text; it.state.className = "up-state " + (cls || "muted"); }

    var chain = Promise.resolve();
    items.forEach(function (it) {
      chain = chain.then(function () {
        if (done[it.key]) { okCount += 1; setState(it, "আগেই যুক্ত হয়েছে", "muted"); return; }
        setState(it, "আপলোড হচ্ছে…", "muted");
        return A.uploadAndSave({
          file: it.file, wanted: o.wanted, area: o.area,
          save: function (path, size) { return o.save(path, size, it.file); }
        }).then(function () {
          done[it.key] = true; okCount += 1; setState(it, "যুক্ত হয়েছে ✓", "ok-text");
        }, function (e) { setState(it, A.errText(e), "err-text"); });
      });
    });
    return chain.then(function () {
      summary.textContent = H.uploadSummary(total, okCount);
      var failed = total - okCount;
      if (failed) {
        host.appendChild(el("p", { class: "muted", text: "ব্যর্থ ফাইলগুলো আবার চেষ্টা করতে একই ফাইলগুলো আবার বাছুন — যেগুলো যুক্ত হয়ে গেছে সেগুলো দ্বিতীয়বার যুক্ত হবে না।" }));
      }
      A.toast(H.uploadSummary(total, okCount), failed ? "warn" : "ok");
      if (o.onDone) o.onDone(okCount);
      return { total: total, ok: okCount };
    });
  };

  // a file input with the public-bucket warning right next to it
  A.uploadNote = function () { return el("p", { class: "upload-note", text: NOTE_PUBLIC }); };

  // delete result {ok, storage_paths, message}: remove the files only after the database call worked
  A.afterDelete = function (res) {
    if (!res || res.ok !== true) { A.toast((res && res.message) || "মুছে ফেলা যায়নি", "error"); return Promise.resolve(false); }
    return A.removeObjects(res.storage_paths || []).then(function (ok) { if (!ok) A.warnCleanup(); return true; });
  };
})();
