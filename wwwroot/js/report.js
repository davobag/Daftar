/* Report page: account balances (tree roll-up) and journal, filtered by date range and account. */
(function () {
  "use strict";
  var $ = D.$, toFa = D.toFa, toEn = D.toEn, esc = D.esc;
  var entries = [], pendingDelete = null, expanded = {};

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
