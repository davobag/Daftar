/* Shared helpers for every page: digits, Jalali dates, API, units, accounts tree, header and login. */
(function () {
  "use strict";
  var D = window.D = {};

  var $ = D.$ = function (id) { return document.getElementById(id); };
  var faDigits = "۰۱۲۳۴۵۶۷۸۹", arDigits = "٠١٢٣٤٥٦٧٨٩";

  D.toEn = function (s) {
    return String(s || "").replace(/[۰-۹]/g, function (d) { return faDigits.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return arDigits.indexOf(d); });
  };
  D.toFa = function (s) { return String(s).replace(/\d/g, function (d) { return faDigits[d]; }); };
  D.parseAmount = function (s) {
    var t = D.toEn(s).replace(/[,،٬\s]/g, "");
    if (t === "") return 0;
    if (!/^\d+$/.test(t)) return NaN;
    return Number(t);
  };
  D.fmt = function (n) { return Math.round(n).toLocaleString("fa-IR"); };
  D.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  D.normName = function (s) { return String(s || "").trim().replace(/\s+/g, " ").replace(/ي/g, "ی").replace(/ك/g, "ک"); };

  // ---------- Jalali calendar ----------
  function g2j(gy, gm, gd) {
    var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var gy2 = gm > 2 ? gy + 1 : gy;
    var days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
    var jy = -1595 + 33 * Math.floor(days / 12053); days %= 12053;
    jy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var jm, jd;
    if (days < 186) { jm = 1 + Math.floor(days / 31); jd = 1 + (days % 31); }
    else { jm = 7 + Math.floor((days - 186) / 30); jd = 1 + ((days - 186) % 30); }
    return [jy, jm, jd];
  }
  function j2g(jy, jm, jd) {
    jy += 1595;
    var days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
    var gy = 400 * Math.floor(days / 146097); days %= 146097;
    if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
    gy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var gd = days + 1;
    var ml = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var gm;
    for (gm = 0; gm < 13 && gd > ml[gm]; gm++) gd -= ml[gm];
    return [gy, gm, gd];
  }
  D.g2j = g2j; D.j2g = j2g;
  D.monthLength = function (jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    var g = j2g(jy, 12, 30), back = g2j(g[0], g[1], g[2]);
    return back[0] === jy && back[1] === 12 && back[2] === 30 ? 30 : 29;
  };
  D.monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
  D.pad = function (n) { return (n < 10 ? "0" : "") + n; };
  D.todayParts = function () { var d = new Date(); return g2j(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
  D.todayJ = function () { var j = D.todayParts(); return j[0] + "/" + D.pad(j[1]) + "/" + D.pad(j[2]); };
  D.normDate = function (s) {
    var t = D.toEn(s).trim().replace(/[-.]/g, "/");
    var m = t.match(/^(\d{2,4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y < 100) y += 1400;
    if (mo < 1 || mo > 12 || d < 1 || d > D.monthLength(y, mo)) return null;
    return y + "/" + D.pad(mo) + "/" + D.pad(d);
  };

  // ---------- status line ----------
  D.setStatus = function (text, warn) {
    var s = $("status"); if (!s) return;
    s.textContent = text; s.classList.toggle("warn", !!warn);
  };

  // ---------- API ----------
  D.api = function (method, url, data) {
    return fetch(url, {
      method: method, credentials: "same-origin",
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined
    }).then(function (res) {
      if (res.status === 401) { showLogin(); throw new Error("ابتدا وارد شوید."); }
      if (res.status === 204) return null;
      return res.json().catch(function () { return null; }).then(function (body) {
        if (!res.ok) {
          var msg = body && (body.error || (body.errors && Object.values(body.errors).flat().join(" ")) || body.detail || body.title);
          throw new Error(msg || "خطای سرور (" + res.status + ")");
        }
        return body;
      });
    });
  };

  // ---------- units (amounts are stored in Rial) ----------
  D.cfg = { inputCurrency: "Toman", reportCurrency: "Rial" };
  D.runningPort = null;
  D.unitName = { Toman: "تومان", Rial: "ریال" };
  D.inFactor = function () { return D.cfg.inputCurrency === "Toman" ? 10 : 1; };
  D.fmtOut = function (rial) {
    var v = D.cfg.reportCurrency === "Toman" ? rial / 10 : rial;
    return v.toLocaleString("fa-IR", { maximumFractionDigits: 1 });
  };
  D.loadSettings = function () {
    return D.api("GET", "/api/settings").then(function (r) {
      D.cfg = r.settings; D.runningPort = r.runningPort;
      document.querySelectorAll(".inUnit").forEach(function (el) { el.textContent = D.unitName[D.cfg.inputCurrency]; });
      document.querySelectorAll(".outUnit").forEach(function (el) { el.textContent = D.unitName[D.cfg.reportCurrency]; });
      return D.cfg;
    });
  };

  // ---------- entries ----------
  D.fromServer = function (x) {
    return { id: x.id, date: x.date, accountId: x.accountId, code: x.accountCode, account: x.accountName, debit: x.debit, credit: x.credit,
      method: x.paymentMethod, desc: x.description || "", createdAt: Date.parse(x.createdAt) || 0 };
  };
  D.sortEntries = function (list) {
    return list.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0) || a.id - b.id;
    });
  };
  D.statusTag = function (bal) {
    if (Math.round(bal) === 0) return '<span class="tag zero">بی‌حساب</span>';
    return bal > 0 ? '<span class="tag dr">بدهکار</span>' : '<span class="tag cr">بستانکار</span>';
  };

  // ---------- accounts tree ----------
  D.accounts = [];
  D.loadAccounts = function () { return D.api("GET", "/api/accounts").then(function (a) { D.accounts = a || []; return D.accounts; }); };
  D.accById = function (id) { return D.accounts.find(function (a) { return String(a.id) === String(id); }) || null; };
  D.accByCode = function (code) { return D.accounts.find(function (a) { return String(a.code) === String(code); }) || null; };
  D.pathOf = function (a) {
    var p = [a.name], c = a, guard = 0;
    while (c && c.parentId && guard++ < 20) { c = D.accById(c.parentId); if (c) p.unshift(c.name); }
    return p.join(" › ");
  };
  D.accByName = function (name) {
    return D.accounts.find(function (a) { return D.pathOf(a) === name; }) || D.accounts.find(function (a) { return a.name === name; }) || null;
  };
  D.childrenOf = function (id) {
    return D.accounts.filter(function (a) { return String(a.parentId || "") === String(id || ""); })
      .sort(function (a, b) { return a.code - b.code; });
  };
  D.treeOrder = function () {
    var out = [];
    (function walk(pid, depth) {
      D.childrenOf(pid).forEach(function (a) { if (depth < 20) { out.push({ a: a, depth: depth }); walk(a.id, depth + 1); } });
    })(null, 0);
    return out;
  };
  D.subtreeIds = function (id) {
    var set = {};
    (function walk(x) { set[x] = 1; D.childrenOf(x).forEach(function (c) { if (!set[c.id]) walk(c.id); }); })(id);
    return set;
  };

  // ---------- header, nav and login ----------
  var pages = [
    { href: "/", label: "ثبت سند" },
    { href: "/report", label: "گزارش" },
    { href: "/accounts", label: "حساب‌ها" },
    { href: "/settings", label: "تنظیمات" }
  ];
  function currentPath() { var p = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/"); return p === "" ? "/" : p; }

  function buildChrome() {
    var login = document.createElement("div");
    login.className = "login-wrap"; login.id = "loginView"; login.hidden = true;
    login.innerHTML = '<form class="panel login" id="loginForm" novalidate><h2>ورود به دفتر روزنامه</h2>' +
      '<label>نام کاربری <input id="lUser" autocomplete="username" class="num"></label>' +
      '<label>رمز عبور <input id="lPass" type="password" autocomplete="current-password" class="num"></label>' +
      '<div class="err" id="loginErr" role="alert"></div><button type="submit" class="primary">ورود</button></form>';
    document.body.insertBefore(login, document.body.firstChild);

    var header = $("appHeader"), cur = currentPath();
    header.innerHTML = '<div><h1>دفتر روزنامه شخصی</h1><div class="sub" id="unitSub"></div></div>' +
      '<div class="topbar"><nav class="pages" aria-label="صفحه‌ها">' + pages.map(function (p) {
        return '<a href="' + p.href + '"' + (p.href === cur ? ' aria-current="page"' : "") + ">" + p.label + "</a>";
      }).join("") + '</nav><span class="status" id="status"></span><button type="button" class="small" id="logoutBtn">خروج</button></div>';

    $("loginForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var err = $("loginErr"); err.textContent = "";
      fetch("/api/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: $("lUser").value.trim(), password: $("lPass").value }) })
        .then(function (res) {
          if (res.ok) { $("lPass").value = ""; showApp(); return; }
          if (res.status === 429) { err.textContent = "تلاش زیاد بود. یک دقیقه صبر کنید."; return; }
          return res.json().catch(function () { return {}; }).then(function (b) { err.textContent = b.error || b.detail || "ورود ناموفق بود."; });
        }).catch(function () { err.textContent = "اتصال به سرور برقرار نیست."; });
    });
    $("logoutBtn").addEventListener("click", function () {
      fetch("/api/logout", { method: "POST", credentials: "same-origin" }).then(function () { showLogin(); });
    });
  }

  var onReady = null, started = false;
  function showLogin() {
    $("appView").hidden = true; $("loginView").hidden = false;
    setTimeout(function () { $("lUser").focus(); }, 0);
  }
  function showApp() {
    $("loginView").hidden = true; $("appView").hidden = false;
    D.loadSettings().catch(function () {}).then(function () {
      $("unitSub").textContent = "ورود مبالغ به " + D.unitName[D.cfg.inputCurrency] + "، گزارش به " + D.unitName[D.cfg.reportCurrency];
      if (onReady) onReady(!started);
      started = true;
    });
  }
  D.showLogin = showLogin;

  /** Every page calls D.start(fn): builds the header, checks login, then runs fn once the user is signed in. */
  D.start = function (fn) {
    onReady = fn;
    buildChrome();
    fetch("/api/me", { credentials: "same-origin" }).then(function (r) { if (r.ok) showApp(); else showLogin(); })
      .catch(function () { showLogin(); $("loginErr").textContent = "اتصال به سرور برقرار نیست."; });
  };
})();
