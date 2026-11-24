/* Ledgers and trial balance (دفاتر و تراز): کل/معین trial balance (tree roll-up), detail (تفصیلی) balances and the journal (دفتر روزنامه), filtered by date, account and detail. */
(function () {
  "use strict";
  var $ = D.$, toFa = D.toFa, toEn = D.toEn, esc = D.esc;
  var entries = [], pendingDelete = null, expanded = {}, selected = {};
  var day = null, allDays = false; // journal page: one date at a time (null = latest)

  // double entry: each entry posts to its account, and (mirrored) to its counter account when it has one
  function postings(list) {
    var out = [];
    list.forEach(function (e) {
      out.push({ e: e, acc: e.accountId, det: e.detailId, debit: e.debit || 0, credit: e.credit || 0, other: e.counterId, otherDet: e.counterDetailId, mirror: false });
      if (e.counterId) out.push({ e: e, acc: e.counterId, det: e.counterDetailId, debit: e.credit || 0, credit: e.debit || 0, other: e.accountId, otherDet: e.detailId, mirror: true });
    });
    return out;
  }

  function load() {
    D.setStatus("در حال بارگذاری…");
    return Promise.all([D.loadAccounts(), D.loadDetails(), D.api("GET", "/api/entries")]).then(function (r) {
      entries = (r[2] || []).map(D.fromServer);
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

  // details in the filter (null = all)
  function allowedDetails() {
    var q = D.normName($("rDetail").value), qe = toEn(q);
    if (!q) return null;
    var allowed = {};
    D.details.forEach(function (d) { if (/^\d+$/.test(qe) ? String(d.code) === qe : d.name.indexOf(q) !== -1) allowed[d.id] = 1; });
    return allowed;
  }

  // ---------- balances and journal ----------
  function render() {
    $("detailList").innerHTML = D.details.map(function (d) { return '<option value="' + esc(d.name) + '" label="' + toFa(d.code) + '">'; }).join("");
    $("accountList").innerHTML = D.treeOrder().map(function (x) { return '<option value="' + esc(D.pathOf(x.a)) + '" label="' + toFa(x.a.code) + '">'; }).join("");
    var fromRaw = $("rFrom").value.trim(), toRaw = $("rTo").value.trim();
    var from = fromRaw ? D.normDate(fromRaw) : null, to = toRaw ? D.normDate(toRaw) : null;
    var fErr = [];
    if (fromRaw && !from) fErr.push("«از تاریخ» درست نیست");
    if (toRaw && !to) fErr.push("«تا تاریخ» درست نیست");
    $("filterErr").textContent = fErr.length ? fErr.join("، ") + " (نمونه: ۱۴۰۵/۰۸/۰۱)." : "";
    var accQ = D.normName($("rAccount").value), allowed = allowedAccounts(), detAllowed = allowedDetails(), detQ = D.normName($("rDetail").value);
    var detTot = {};

    var running = {}, own = {}, rows = [], onlyNo = $("onlyNoCounter").checked;
    postings(D.sortEntries(entries)).forEach(function (p) {
      var acc = p.acc, e = p.e;
      if (allowed && !allowed[acc]) return;
      if (detAllowed && !detAllowed[p.det]) return;
      running[acc] = (running[acc] || 0) + p.debit - p.credit;
      if (to && e.date > to) return;
      var s = own[acc] || (own[acc] = { opening: 0, debit: 0, credit: 0, n: 0 });
      var ds = p.det ? (detTot[p.det] || (detTot[p.det] = { opening: 0, debit: 0, credit: 0 })) : null;
      s.n++;
      if (from && e.date < from) { s.opening += p.debit - p.credit; if (ds) ds.opening += p.debit - p.credit; return; }
      s.debit += p.debit; s.credit += p.credit;
      if (ds) { ds.debit += p.debit; ds.credit += p.credit; }
      // without an account or detail filter each entry is listed once (from its own account's side)
      if (!allowed && !detAllowed && p.mirror) return;
      if (onlyNo && e.counterId) return;
      rows.push({ p: p, e: e, bal: running[acc] });
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
    var shown = {};
    D.treeOrder().forEach(function (x) {
      var a = x.a;
      if (allowed && !allowed[a.id]) return;
      var t = rollup(a.id);
      if (!t.n) return;
      var isRoot = !a.parentId || (allowed && !allowed[a.parentId]);
      var depth = 0, c = a;
      while (c.parentId && (!allowed || allowed[c.parentId]) && depth < 20) { depth++; c = D.accById(c.parentId); if (!c) break; }
      if (isRoot) { roots++; tot.opening += t.opening; tot.debit += t.debit; tot.credit += t.credit; }
      // only main accounts are listed; a click opens the next level, one indent step deeper
      if (!isRoot && !(shown[a.parentId] && expanded[a.parentId])) return;
      shown[a.id] = 1;
      var hasKids = D.childrenOf(a.id).some(function (k) { return (!allowed || allowed[k.id]) && rollup(k.id).n; });
      var end = t.opening + t.debit - t.credit;
      parts.push("<tr" + (hasKids ? ' class="tree-parent"' : "") + '><td class="amt code-cell">' + toFa(a.code) + '</td><td style="padding-inline-start:' + (0.6 + depth * 1.6) + 'em">' +
        (hasKids
          ? '<button type="button" class="tree-toggle" data-toggle="' + a.id + '" aria-expanded="' + !!expanded[a.id] + '"><span class="chev">' + (expanded[a.id] ? "▾" : "◂") + "</span>" + esc(a.name) + ' <span class="unit">(جمع)</span></button>'
          : '<span class="chev-space"></span><button type="button" class="acct-link" data-acc="' + a.code + '">' + esc(a.name) + "</button>") + "</td>" +
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
    // ---------- page the journal by date ----------
    var counts = {};
    rows.forEach(function (r) { counts[r.e.date] = (counts[r.e.date] || 0) + 1; });
    var dates = Object.keys(counts).sort(); // oldest → newest
    if (!dates.length) day = null;
    else if (!day || !counts[day]) {
      // keep near the chosen day: the closest earlier date with vouchers, else the newest
      var before = day ? dates.filter(function (d) { return d <= day; }) : [];
      day = before.length ? before[before.length - 1] : dates[dates.length - 1];
    }
    var di = dates.indexOf(day);
    $("daySelect").innerHTML = dates.slice().reverse().map(function (d) {
      return '<option value="' + d + '">' + toFa(d) + " (" + D.fmt(counts[d]) + " ردیف)</option>";
    }).join("");
    if (day) $("daySelect").value = day;
    $("daySelect").disabled = allDays || !dates.length;
    $("dayPrev").disabled = $("dayFirst").disabled = allDays || di <= 0;
    $("dayNext").disabled = $("dayLast").disabled = allDays || di < 0 || di >= dates.length - 1;
    $("dayAll").checked = allDays;
    var totalRows = rows.length;
    if (!allDays && day) rows = rows.filter(function (r) { return r.e.date === day; });

    $("journalNote").textContent = "(" + (allDays ? "" : toFa(day || "") + "، ") + D.fmt(rows.length) + (allDays ? "" : " از " + D.fmt(totalRows)) + " ردیف" + (accQ ? "، حساب: " + toFa(accQ) : "") + (detQ ? "، تفصیلی: " + toFa(detQ) : "") + ")";

    // detail (تفصیلی) balances
    var detRows = D.details.filter(function (d) { return detTot[d.id]; });
    $("detailSection").hidden = !detRows.length;
    $("detailBody").innerHTML = detRows.map(function (d) {
      var t = detTot[d.id], end = t.opening + t.debit - t.credit;
      return '<tr><td class="amt code-cell">' + toFa(d.code) + '</td><td><button type="button" class="acct-link" data-det="' + esc(d.name) + '">' + esc(d.name) + "</button></td>" +
        '<td class="amt">' + D.fmtOut(Math.abs(t.opening)) + '</td><td class="amt dr">' + D.fmtOut(t.debit) + '</td><td class="amt cr">' + D.fmtOut(t.credit) + "</td>" +
        '<td class="amt">' + D.fmtOut(Math.abs(end)) + "</td><td>" + D.statusTag(end) + "</td></tr>";
    }).join("");
    var bd = $("bulkDetail"), bdCur = bd.value;
    bd.innerHTML = '<option value="">— انتخاب کنید —</option>' + D.details.map(function (d) {
      return '<option value="' + d.id + '">' + toFa(d.code) + " - " + esc(d.name) + "</option>";
    }).join("") + '<option value="none">(برداشتن تفصیلی)</option>';
    bd.value = bdCur;

    var noCounter = entries.filter(function (e) { return !e.counterId; }).length;
    $("noCounterCount").textContent = noCounter ? "(" + D.fmt(noCounter) + " سند)" : "(همه حساب مقابل دارند)";
    var visibleIds = {};
    rows.forEach(function (r) { visibleIds[r.e.id] = 1; });
    Object.keys(selected).forEach(function (id) { if (!visibleIds[id]) delete selected[id]; });
    var nSel = Object.keys(selected).length;
    $("bulkActions").hidden = !nSel;
    $("bulkCount").textContent = D.fmt(nSel) + " سند انتخاب شد";
    $("selAll").checked = rows.length > 0 && nSel === Object.keys(visibleIds).length;
    $("selAll").indeterminate = nSel > 0 && !$("selAll").checked;
    var bc = $("bulkCounter"), bcCur = bc.value;
    bc.innerHTML = '<option value="">— انتخاب کنید —</option>' + D.treeOrder().map(function (x) {
      return '<option value="' + x.a.id + '">' + "\u00a0\u00a0".repeat(x.depth) + toFa(x.a.code) + " - " + esc(x.a.name) + "</option>";
    }).join("") + '<option value="none">(برداشتن حساب مقابل)</option>';
    bc.value = bcCur;

    $("journalBody").innerHTML = rows.slice().reverse().map(function (r) {
      var e = r.e, p = r.p, acc = D.accById(p.acc), other = p.other ? D.accById(p.other) : null;
      var otherDet = p.other ? D.detailTag(p.otherDet) : "";
      var actions = String(pendingDelete) === String(e.id)
        ? '<span class="confirm">حذف شود؟ <button type="button" class="small danger" data-del-yes="' + e.id + '">بله</button><button type="button" class="small" data-del-no="1">نه</button></span>'
        : '<a class="small" href="/voucher?edit=' + e.id + '">اصلاح</a> <button type="button" class="small" data-del="' + e.id + '">حذف</button>';
      var code = acc ? acc.code : e.code;
      return '<tr' + (selected[e.id] ? ' class="selected"' : "") + '><td class="sel"><input type="checkbox" data-sel="' + e.id + '"' + (selected[e.id] ? " checked" : "") + ' aria-label="انتخاب سند"></td>' +
        '<td class="acts-col">' + actions + "</td>" +
        '<td class="amt">' + toFa(e.id) + '</td><td class="amt">' + toFa(e.date) + '</td><td><span class="code-cell">' + toFa(code) + '</span> <button type="button" class="acct-link" data-acc="' + code + '">' +
        esc(acc ? D.pathOf(acc) : e.account) + "</button>" + D.detailTag(p.det) +
        (other ? ' <span class="counter">⇄ <button type="button" class="acct-link" data-acc="' + other.code + '">' + esc(D.pathOf(other)) + "</button>" + otherDet + "</span>" : ' <span class="counter missing">⇄ ؟</span>') + "</td>" +
        '<td class="amt dr">' + (p.debit ? D.fmtOut(p.debit) : "") + '</td><td class="amt cr">' + (p.credit ? D.fmtOut(p.credit) : "") + "</td>" +
        '<td class="amt">' + D.fmtOut(Math.abs(r.bal)) + " " + D.statusTag(r.bal) + "</td><td>" + esc(e.method) + '</td><td class="desc">' + esc(e.desc) + "</td></tr>";
    }).join("") || '<tr><td colspan="10" class="empty">' + (hasData ? "سندی در این بازه نیست." : "اسناد ثبت‌شده اینجا به ترتیب تاریخ می‌آیند، با مانده‌ی حساب بعد از هر سند.") + "</td></tr>";
  }

  ["rFrom", "rTo", "rAccount", "rDetail"].forEach(function (id) { $(id).addEventListener("input", render); });
  $("onlyNoCounter").addEventListener("change", render);
  function stepDay(to) {
    var opts = Array.prototype.map.call($("daySelect").options, function (o) { return o.value; }).reverse(); // oldest → newest
    var i = opts.indexOf(day);
    if (to === "first") day = opts[0]; else if (to === "last") day = opts[opts.length - 1];
    else if (opts[i + to]) day = opts[i + to];
    selected = {}; render();
  }
  $("dayPrev").addEventListener("click", function () { stepDay(-1); });
  $("dayNext").addEventListener("click", function () { stepDay(1); });
  $("dayFirst").addEventListener("click", function () { stepDay("first"); });
  $("dayLast").addEventListener("click", function () { stepDay("last"); });
  $("daySelect").addEventListener("change", function () { day = $("daySelect").value; selected = {}; render(); });
  $("dayAll").addEventListener("change", function () { allDays = $("dayAll").checked; selected = {}; render(); });
  // keyboard: Alt+← / Alt+→ moves between days
  document.addEventListener("keydown", function (ev) {
    if (!ev.altKey || allDays) return;
    if (ev.key === "ArrowRight") { ev.preventDefault(); stepDay(-1); } // RTL: right = back in time
    else if (ev.key === "ArrowLeft") { ev.preventDefault(); stepDay(1); }
  });
  $("journalBody").addEventListener("change", function (ev) {
    var id = ev.target.dataset && ev.target.dataset.sel; if (!id) return;
    if (ev.target.checked) selected[id] = 1; else delete selected[id];
    render();
  });
  $("selAll").addEventListener("change", function () {
    var on = $("selAll").checked;
    selected = {};
    if (on) Array.prototype.forEach.call(document.querySelectorAll("#journalBody [data-sel]"), function (c) { selected[c.dataset.sel] = 1; });
    render();
  });
  $("bulkDetailApply").addEventListener("click", function () {
    var v = $("bulkDetail").value, side = $("bulkDetailSide").value, err = $("bulkErr");
    if (!v) { err.textContent = "تفصیلی را انتخاب کنید."; return; }
    var ids = Object.keys(selected).map(Number), did = v === "none" ? null : +v;
    err.textContent = ""; $("bulkDetailApply").disabled = true;
    D.api("POST", "/api/entries/detail", { ids: ids, detailId: did, side: side }).then(function (r) {
      entries.forEach(function (e) {
        if (!selected[e.id]) return;
        if (side === "counter") { if (e.counterId) e.counterDetailId = did; } else e.detailId = did;
      });
      selected = {}; $("bulkDetail").value = "";
      render();
      D.setStatus((did === null ? "تفصیلی " + D.fmt(r.updated) + " سند برداشته شد." : "تفصیلی به " + D.fmt(r.updated) + " سند اختصاص یافت.") +
        (r.skipped ? " " + D.fmt(r.skipped) + " سند حساب مقابل نداشت و تغییر نکرد." : ""));
    }).catch(function (e) { err.textContent = e.message; }).then(function () { $("bulkDetailApply").disabled = false; });
  });
  $("bulkClear").addEventListener("click", function () { selected = {}; render(); });
  $("bulkApply").addEventListener("click", function () {
    var v = $("bulkCounter").value, err = $("bulkErr");
    if (!v) { err.textContent = "حساب مقابل را انتخاب کنید."; return; }
    var ids = Object.keys(selected).map(Number), cid = v === "none" ? null : +v;
    err.textContent = ""; $("bulkApply").disabled = true;
    D.api("POST", "/api/entries/counter", { ids: ids, counterAccountId: cid }).then(function (r) {
      entries.forEach(function (e) { if (selected[e.id] && (cid === null || e.accountId !== cid)) e.counterId = cid; });
      selected = {}; $("bulkCounter").value = "";
      render();
      D.setStatus(cid === null ? "حساب مقابل " + D.fmt(r.updated) + " سند برداشته شد." :
        "حساب مقابل به " + D.fmt(r.updated) + " سند اختصاص یافت." + (r.skipped ? " " + D.fmt(r.skipped) + " سند که حساب خودشان همین بود، تغییر نکرد." : ""));
    }).catch(function (e) { err.textContent = e.message; }).then(function () { $("bulkApply").disabled = false; });
  });
  $("clearFilters").addEventListener("click", function () { $("rFrom").value = ""; $("rTo").value = ""; $("rAccount").value = ""; $("rDetail").value = ""; render(); });

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("button"); if (!t) return;
    if (t.dataset.toggle) { expanded[t.dataset.toggle] = !expanded[t.dataset.toggle]; render(); }
    else if (t.dataset.det) { $("rDetail").value = t.dataset.det; render(); $("reportTitle").scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if (t.dataset.acc) { $("rAccount").value = toFa(t.dataset.acc); render(); $("reportTitle").scrollIntoView({ behavior: "smooth", block: "start" }); }
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
