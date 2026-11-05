/* Report page: daily debit/credit bar chart for a month, account balances (tree roll-up), journal. */
(function () {
  "use strict";
  var $ = D.$, toFa = D.toFa, toEn = D.toEn, esc = D.esc;
  var entries = [], pendingDelete = null;
  var today = D.todayParts(), viewY = today[0], viewM = today[1];
  var weekdays = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

  function load() {
    D.setStatus("در حال بارگذاری…");
    return Promise.all([D.loadAccounts(), D.api("GET", "/api/entries")]).then(function (r) {
      entries = (r[1] || []).map(D.fromServer);
      D.setStatus("");
      render();
    }).catch(function (e) { D.setStatus("بارگذاری نشد: " + e.message, true); });
  }

  // accounts in the filter: the matched ones plus all their sub-accounts (null = all)
  function allowedAccounts() {
    var q = D.normName($("rAccount").value), qe = toEn(q);
    if (!q) return null;
    var allowed = {};
    D.accounts.filter(function (a) { return /^\d+$/.test(qe) ? String(a.code) === qe : D.pathOf(a).indexOf(q) !== -1; })
      .forEach(function (a) { Object.assign(allowed, D.subtreeIds(a.id)); });
    return allowed;
  }

  // ---------- chart ----------
  function compact(v) {
    var a = Math.abs(v), units = [[1e9, "میلیارد"], [1e6, "میلیون"], [1e3, "هزار"]];
    for (var i = 0; i < units.length; i++) {
      if (a >= units[i][0]) return (v / units[i][0]).toLocaleString("fa-IR", { maximumFractionDigits: 1 }) + " " + units[i][1];
    }
    return v.toLocaleString("fa-IR");
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }

  var dayData = [];
  function renderChart(allowed) {
    var days = D.monthLength(viewY, viewM), prefix = viewY + "/" + D.pad(viewM) + "/";
    var div = D.cfg.reportCurrency === "Toman" ? 10 : 1;
    dayData = [];
    for (var d = 1; d <= days; d++) {
      var g = D.j2g(viewY, viewM, d);
      dayData.push({ d: d, dr: 0, cr: 0, wd: new Date(g[0], g[1] - 1, g[2]).getDay() });
    }
    var totDr = 0, totCr = 0;
    entries.forEach(function (e) {
      if (e.date.indexOf(prefix) !== 0 || (allowed && !allowed[e.accountId])) return;
      var x = dayData[+e.date.slice(8) - 1]; if (!x) return;
      x.dr += (e.debit || 0) / div; x.cr += (e.credit || 0) / div;
      totDr += e.debit || 0; totCr += e.credit || 0;
    });
    $("monthLabel").textContent = D.monthNames[viewM - 1] + " " + toFa(viewY);
    $("monthDr").textContent = D.fmtOut(totDr);
    $("monthCr").textContent = D.fmtOut(totCr);
    $("chartFilterNote").textContent = allowed ? "، فقط حساب‌های فیلترشده" : "";
    var isCurrent = viewY === today[0] && viewM === today[1];
    $("thisMonth").hidden = isCurrent;

    var max = niceMax(Math.max.apply(null, dayData.map(function (x) { return Math.max(x.dr, x.cr); }).concat([0])));
    var slot = 26, padR = 74, padL = 10, padT = 12, plotH = 200, padB = 34;
    var W = padR + padL + slot * days, H = padT + plotH + padB, bw = 9;
    function y(v) { return padT + plotH - (v / max) * plotH; }
    // RTL: day 1 on the right, next to the value axis
    function xSlot(d) { return W - padR - slot * d; }
    var svg = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="نمودار بدهکار و بستانکار روزانه ' + esc($("monthLabel").textContent) + '">'];
    dayData.forEach(function (x) {
      if (x.wd === 5) svg.push('<rect class="ch-fri" x="' + xSlot(x.d) + '" y="' + padT + '" width="' + slot + '" height="' + plotH + '"></rect>');
    });
    for (var i = 0; i <= 4; i++) {
      var v = max * i / 4, yy = y(v);
      svg.push('<line class="ch-grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '"></line>');
      svg.push('<text class="ch-axis" x="' + (W - 4) + '" y="' + (yy + 4) + '" text-anchor="end">' + compact(v) + "</text>");
    }
    dayData.forEach(function (x) {
      var x0 = xSlot(x.d), mid = x0 + slot / 2;
      if (x.dr > 0) svg.push('<rect class="ch-dr" x="' + mid + '" y="' + y(x.dr) + '" width="' + bw + '" height="' + Math.max(1, plotH + padT - y(x.dr)) + '" rx="2"></rect>');
      if (x.cr > 0) svg.push('<rect class="ch-cr" x="' + (mid - bw) + '" y="' + y(x.cr) + '" width="' + bw + '" height="' + Math.max(1, plotH + padT - y(x.cr)) + '" rx="2"></rect>');
      var isToday = isCurrent && x.d === today[2];
      svg.push('<text class="ch-day' + (isToday ? " ch-today" : "") + '" x="' + mid + '" y="' + (padT + plotH + 18) + '" text-anchor="middle">' + toFa(x.d) + "</text>");
      svg.push('<rect class="ch-hit" data-day="' + x.d + '" x="' + x0 + '" y="' + padT + '" width="' + slot + '" height="' + (plotH + 24) + '"><title>' +
        toFa(x.d) + " " + D.monthNames[viewM - 1] + "</title></rect>");
    });
    svg.push('<line class="ch-base" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + plotH) + '" y2="' + (padT + plotH) + '"></line>');
    svg.push("</svg>");
    $("chartBox").innerHTML = svg.join("");
    // keep the newest days in view on narrow screens (RTL: start of month is on the right)
    var box = $("chartBox");
    if (isCurrent && box.scrollWidth > box.clientWidth) {
      var target = xSlot(today[2]) - box.clientWidth / 2;
      box.scrollLeft = Math.max(0, Math.min(target * (box.scrollWidth / W), box.scrollWidth));
    }
  }
  function showDay(d) {
    var x = dayData[d - 1]; if (!x) return;
    document.querySelectorAll(".ch-hit.on").forEach(function (el) { el.classList.remove("on"); });
    var hit = document.querySelector('.ch-hit[data-day="' + d + '"]'); if (hit) hit.classList.add("on");
    var fmtv = function (v) { return v.toLocaleString("fa-IR", { maximumFractionDigits: 1 }); };
    $("chartTip").innerHTML = weekdays[x.wd] + " " + toFa(d) + " " + D.monthNames[viewM - 1] + ": بدهکار <b>" + fmtv(x.dr) + "</b>، بستانکار <b>" + fmtv(x.cr) + "</b> " + D.unitName[D.cfg.reportCurrency];
  }
  $("chartBox").addEventListener("mouseover", function (ev) { var t = ev.target.closest(".ch-hit"); if (t) showDay(+t.dataset.day); });
  $("chartBox").addEventListener("click", function (ev) { var t = ev.target.closest(".ch-hit"); if (t) showDay(+t.dataset.day); });
  function shiftMonth(n) {
    viewM += n;
    if (viewM < 1) { viewM = 12; viewY--; }
    if (viewM > 12) { viewM = 1; viewY++; }
    renderChart(allowedAccounts());
    $("chartTip").textContent = "روی هر روز بروید یا بزنید تا مبالغش را ببینید.";
  }
  $("prevMonth").addEventListener("click", function () { shiftMonth(-1); });
  $("nextMonth").addEventListener("click", function () { shiftMonth(1); });
  $("thisMonth").addEventListener("click", function () { viewY = today[0]; viewM = today[1]; shiftMonth(0); });

  // ---------- balances and journal ----------
  function render() {
    $("accountList").innerHTML = D.treeOrder().map(function (x) { return '<option value="' + esc(D.pathOf(x.a)) + '" label="' + toFa(x.a.code) + '">'; }).join("");
    var fromRaw = $("rFrom").value.trim(), toRaw = $("rTo").value.trim();
    var from = fromRaw ? D.normDate(fromRaw) : null, to = toRaw ? D.normDate(toRaw) : null;
    var fErr = [];
    if (fromRaw && !from) fErr.push("«از تاریخ» درست نیست");
    if (toRaw && !to) fErr.push("«تا تاریخ» درست نیست");
    $("filterErr").textContent = fErr.length ? fErr.join("، ") + " (نمونه: ۱۴۰۵/۰۸/۰۱)." : "";
    var accQ = D.normName($("rAccount").value), allowed = allowedAccounts();

    renderChart(allowed);

    var running = {}, own = {}, rows = [];
    D.sortEntries(entries).forEach(function (e) {
      var acc = e.accountId;
      if (allowed && !allowed[acc]) return;
      running[acc] = (running[acc] || 0) + (e.debit || 0) - (e.credit || 0);
      if (to && e.date > to) return;
      var s = own[acc] || (own[acc] = { opening: 0, debit: 0, credit: 0, n: 0 });
      s.n++;
      if (from && e.date < from) { s.opening += (e.debit || 0) - (e.credit || 0); return; }
      s.debit += e.debit || 0; s.credit += e.credit || 0;
      rows.push({ e: e, bal: running[acc] });
    });

    function rollup(id) {
      var t = Object.assign({ opening: 0, debit: 0, credit: 0, n: 0 }, own[id] || {});
      D.childrenOf(id).forEach(function (c) {
        if (allowed && !allowed[c.id]) return;
        var ct = rollup(c.id); t.opening += ct.opening; t.debit += ct.debit; t.credit += ct.credit; t.n += ct.n;
      });
      return t;
    }
    var tot = { opening: 0, debit: 0, credit: 0 }, roots = 0, parts = [];
    D.treeOrder().forEach(function (x) {
      var a = x.a;
      if (allowed && !allowed[a.id]) return;
      var t = rollup(a.id);
      if (!t.n) return;
      var isRoot = !a.parentId || (allowed && !allowed[a.parentId]);
      var depth = 0, c = a;
      while (c.parentId && (!allowed || allowed[c.parentId]) && depth < 20) { depth++; c = D.accById(c.parentId); if (!c) break; }
      if (isRoot) { roots++; tot.opening += t.opening; tot.debit += t.debit; tot.credit += t.credit; }
      var hasKids = D.childrenOf(a.id).some(function (k) { return (!allowed || allowed[k.id]) && rollup(k.id).n; });
      var end = t.opening + t.debit - t.credit;
      parts.push("<tr" + (hasKids ? ' class="tree-parent"' : "") + '><td class="amt code-cell">' + toFa(a.code) + '</td><td style="padding-inline-start:' + (0.6 + depth * 1.6) + 'em">' +
        (depth ? '<span class="path-sep">└ </span>' : "") + '<button type="button" class="acct-link" data-acc="' + a.code + '">' + esc(a.name) + "</button>" + (hasKids ? ' <span class="unit">(جمع)</span>' : "") + "</td>" +
        '<td class="amt">' + D.fmtOut(Math.abs(t.opening)) + '</td><td class="amt dr">' + D.fmtOut(t.debit) + '</td><td class="amt cr">' + D.fmtOut(t.credit) + "</td>" +
        '<td class="amt">' + D.fmtOut(Math.abs(end)) + "</td><td>" + D.statusTag(end) + "</td></tr>");
    });
    var hasData = entries.length > 0;
    $("summaryBody").innerHTML = parts.join("") || '<tr><td colspan="7" class="empty">' +
      (hasData ? "<strong>سندی با این فیلتر پیدا نشد</strong>تاریخ یا حساب را تغییر دهید." :
        '<strong>هنوز سندی ثبت نشده</strong>از صفحه‌ی <a href="/">ثبت سند</a> اولین خرج یا دریافت را وارد کنید.') + "</td></tr>";
    var totEnd = tot.opening + tot.debit - tot.credit;
    $("summaryFoot").innerHTML = roots > 1 ? '<tr><td></td><td>جمع کل</td><td class="amt">' + D.fmtOut(Math.abs(tot.opening)) + '</td><td class="amt">' + D.fmtOut(tot.debit) +
      '</td><td class="amt">' + D.fmtOut(tot.credit) + '</td><td class="amt">' + D.fmtOut(Math.abs(totEnd)) + "</td><td>" + D.statusTag(totEnd) + "</td></tr>" : "";

    var period = (from ? "از " + toFa(from) + " " : "") + (to ? "تا " + toFa(to) : "");
    $("summaryNote").textContent = period ? "(" + period.trim() + ")" : "(تا امروز)";
    $("journalNote").textContent = "(" + D.fmt(rows.length) + " سند" + (accQ ? "، حساب: " + toFa(accQ) : "") + ")";

    $("journalBody").innerHTML = rows.slice().reverse().map(function (r) {
      var e = r.e, acc = D.accById(e.accountId);
      var actions = String(pendingDelete) === String(e.id)
        ? '<span class="confirm">حذف شود؟ <button type="button" class="small danger" data-del-yes="' + e.id + '">بله</button><button type="button" class="small" data-del-no="1">نه</button></span>'
        : '<a class="small" href="/?edit=' + e.id + '">ویرایش</a> <button type="button" class="small" data-del="' + e.id + '">حذف</button>';
      return '<tr><td class="amt">' + toFa(e.date) + '</td><td><span class="code-cell">' + toFa(e.code) + '</span> <button type="button" class="acct-link" data-acc="' + e.code + '">' +
        esc(acc ? D.pathOf(acc) : e.account) + "</button></td>" +
        '<td class="amt dr">' + (e.debit ? D.fmtOut(e.debit) : "") + '</td><td class="amt cr">' + (e.credit ? D.fmtOut(e.credit) : "") + "</td>" +
        '<td class="amt">' + D.fmtOut(Math.abs(r.bal)) + " " + D.statusTag(r.bal) + "</td><td>" + esc(e.method) + '</td><td class="desc">' + esc(e.desc) + "</td><td>" + actions + "</td></tr>";
    }).join("") || '<tr><td colspan="8" class="empty">' + (hasData ? "سندی در این بازه نیست." : "سندهای ثبت‌شده اینجا به ترتیب تاریخ می‌آیند، با مانده هر حساب بعد از هر سند.") + "</td></tr>";
  }

  ["rFrom", "rTo", "rAccount"].forEach(function (id) { $(id).addEventListener("input", render); });
  $("clearFilters").addEventListener("click", function () { $("rFrom").value = ""; $("rTo").value = ""; $("rAccount").value = ""; render(); });

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("button"); if (!t) return;
    if (t.dataset.acc) { $("rAccount").value = toFa(t.dataset.acc); render(); $("reportTitle").scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if (t.dataset.del) { pendingDelete = t.dataset.del; render(); }
    else if (t.dataset.delNo) { pendingDelete = null; render(); }
    else if (t.dataset.delYes) {
      var id = t.dataset.delYes; pendingDelete = null;
      D.api("DELETE", "/api/entries/" + id).then(function () {
        entries = entries.filter(function (e) { return String(e.id) !== String(id); });
        render(); D.setStatus("سند حذف شد.");
      }).catch(function (e) { D.setStatus("حذف نشد: " + e.message, true); render(); });
    }
  });

  D.start(function (first) {
    if (first) {
      var m = location.search.match(/[?&]account=([^&]+)/);
      if (m) $("rAccount").value = toFa(decodeURIComponent(m[1]));
    }
    load();
  });
})();
