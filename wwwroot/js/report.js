/* Report page: account balances (tree roll-up) and journal, filtered by date range and account. */
(function () {
  "use strict";
  var $ = D.$, toFa = D.toFa, toEn = D.toEn, esc = D.esc;
  var entries = [], pendingDelete = null, expanded = {}, selected = {};

  // double entry: each entry posts to its account, and (mirrored) to its counter account when it has one
  function postings(list) {
    var out = [];
    list.forEach(function (e) {
      out.push({ e: e, acc: e.accountId, debit: e.debit || 0, credit: e.credit || 0, other: e.counterId, mirror: false });
      if (e.counterId) out.push({ e: e, acc: e.counterId, debit: e.credit || 0, credit: e.debit || 0, other: e.accountId, mirror: true });
    });
    return out;
  }

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

    var running = {}, own = {}, rows = [], onlyNo = $("onlyNoCounter").checked;
    postings(D.sortEntries(entries)).forEach(function (p) {
      var acc = p.acc, e = p.e;
      if (allowed && !allowed[acc]) return;
      running[acc] = (running[acc] || 0) + p.debit - p.credit;
      if (to && e.date > to) return;
      var s = own[acc] || (own[acc] = { opening: 0, debit: 0, credit: 0, n: 0 });
      s.n++;
      if (from && e.date < from) { s.opening += p.debit - p.credit; return; }
      s.debit += p.debit; s.credit += p.credit;
      // without an account filter each entry is listed once (from its own account's side)
      if (!allowed && p.mirror) return;
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
    $("journalNote").textContent = "(" + D.fmt(rows.length) + " سند" + (accQ ? "، حساب: " + toFa(accQ) : "") + ")";

    var noCounter = entries.filter(function (e) { return !e.counterId; }).length;
    $("noCounterCount").textContent = noCounter ? "(" + D.fmt(noCounter) + " سند)" : "(همه حساب متقابل دارند)";
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
    }).join("") + '<option value="none">(برداشتن حساب متقابل)</option>';
    bc.value = bcCur;

    $("journalBody").innerHTML = rows.slice().reverse().map(function (r) {
      var e = r.e, p = r.p, acc = D.accById(p.acc), other = p.other ? D.accById(p.other) : null;
      var actions = String(pendingDelete) === String(e.id)
        ? '<span class="confirm">حذف شود؟ <button type="button" class="small danger" data-del-yes="' + e.id + '">بله</button><button type="button" class="small" data-del-no="1">نه</button></span>'
        : '<a class="small" href="/?edit=' + e.id + '">ویرایش</a> <button type="button" class="small" data-del="' + e.id + '">حذف</button>';
      var code = acc ? acc.code : e.code;
      return '<tr' + (selected[e.id] ? ' class="selected"' : "") + '><td class="sel"><input type="checkbox" data-sel="' + e.id + '"' + (selected[e.id] ? " checked" : "") + ' aria-label="انتخاب سند"></td>' +
        '<td class="amt">' + toFa(e.date) + '</td><td><span class="code-cell">' + toFa(code) + '</span> <button type="button" class="acct-link" data-acc="' + code + '">' +
        esc(acc ? D.pathOf(acc) : e.account) + "</button>" +
        (other ? ' <span class="counter">⇄ <button type="button" class="acct-link" data-acc="' + other.code + '">' + esc(D.pathOf(other)) + "</button></span>" : ' <span class="counter missing">⇄ ؟</span>') + "</td>" +
        '<td class="amt dr">' + (p.debit ? D.fmtOut(p.debit) : "") + '</td><td class="amt cr">' + (p.credit ? D.fmtOut(p.credit) : "") + "</td>" +
        '<td class="amt">' + D.fmtOut(Math.abs(r.bal)) + " " + D.statusTag(r.bal) + "</td><td>" + esc(e.method) + '</td><td class="desc">' + esc(e.desc) + "</td><td>" + actions + "</td></tr>";
    }).join("") || '<tr><td colspan="9" class="empty">' + (hasData ? "سندی در این بازه نیست." : "سندهای ثبت‌شده اینجا به ترتیب تاریخ می‌آیند، با مانده هر حساب بعد از هر سند.") + "</td></tr>";
  }

  ["rFrom", "rTo", "rAccount"].forEach(function (id) { $(id).addEventListener("input", render); });
  $("onlyNoCounter").addEventListener("change", render);
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
  $("bulkClear").addEventListener("click", function () { selected = {}; render(); });
  $("bulkApply").addEventListener("click", function () {
    var v = $("bulkCounter").value, err = $("bulkErr");
    if (!v) { err.textContent = "حساب متقابل را انتخاب کنید."; return; }
    var ids = Object.keys(selected).map(Number), cid = v === "none" ? null : +v;
    err.textContent = ""; $("bulkApply").disabled = true;
    D.api("POST", "/api/entries/counter", { ids: ids, counterAccountId: cid }).then(function (r) {
      entries.forEach(function (e) { if (selected[e.id] && (cid === null || e.accountId !== cid)) e.counterId = cid; });
      selected = {}; $("bulkCounter").value = "";
      render();
      D.setStatus(cid === null ? "حساب متقابل " + D.fmt(r.updated) + " سند برداشته شد." :
        "حساب متقابل به " + D.fmt(r.updated) + " سند اختصاص یافت." + (r.skipped ? " " + D.fmt(r.skipped) + " سند که حساب خودشان همین بود، تغییر نکرد." : ""));
    }).catch(function (e) { err.textContent = e.message; }).then(function () { $("bulkApply").disabled = false; });
  });
  $("clearFilters").addEventListener("click", function () { $("rFrom").value = ""; $("rTo").value = ""; $("rAccount").value = ""; render(); });

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("button"); if (!t) return;
    if (t.dataset.toggle) { expanded[t.dataset.toggle] = !expanded[t.dataset.toggle]; render(); }
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
