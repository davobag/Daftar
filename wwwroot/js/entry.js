/* Entry page: record a journal entry, pick an account by code, see and edit recent entries. */
(function () {
  "use strict";
  var $ = D.$, toFa = D.toFa, toEn = D.toEn, esc = D.esc;
  var entries = [], editingId = null, pendingDelete = null, selectedAccountId = null;
  var suggestItems = [], suggestIdx = -1;

  function load() {
    D.setStatus("در حال بارگذاری…");
    return Promise.all([D.loadAccounts(), D.api("GET", "/api/entries")]).then(function (r) {
      entries = (r[1] || []).map(D.fromServer);
      D.setStatus("");
      renderRecent();
    }).catch(function (e) { D.setStatus("بارگذاری نشد: " + e.message, true); });
  }

  // ---------- amounts hint ----------
  function updateHint() {
    var d = D.parseAmount($("fDebit").value), c = D.parseAmount($("fCredit").value), parts = [];
    var other = D.cfg.inputCurrency === "Toman" ? "Rial" : "Toman";
    function conv(v) { var r = v * D.inFactor(); return (other === "Toman" ? r / 10 : r).toLocaleString("fa-IR", { maximumFractionDigits: 1 }); }
    if (d > 0) parts.push("بدهکار: <b>" + conv(d) + "</b> " + D.unitName[other]);
    if (c > 0) parts.push("بستانکار: <b>" + conv(c) + "</b> " + D.unitName[other]);
    $("rialHint").innerHTML = parts.join("، ");
  }
  $("fDebit").addEventListener("input", updateHint);
  $("fCredit").addEventListener("input", updateHint);

  // ---------- account picker (type a code or a name) ----------
  function selectAccount(a) {
    selectedAccountId = a ? a.id : null;
    $("fAccount").value = a ? D.pathOf(a) : "";
    $("acctHint").innerHTML = a ? "کد <b>" + toFa(a.code) + "</b>: " + esc(D.pathOf(a)) : "";
  }
  function closeSuggest() { $("acctSuggest").hidden = true; $("fAccount").setAttribute("aria-expanded", "false"); suggestIdx = -1; }
  function drawSuggest() {
    var ul = $("acctSuggest");
    if (!suggestItems.length) { closeSuggest(); return; }
    ul.innerHTML = suggestItems.map(function (it, i) {
      var sel = ' aria-selected="' + (i === suggestIdx) + '"';
      if (it.isNew) return '<li role="option" data-i="' + i + '"' + sel + '><span class="code new">+</span><span class="new">حساب جدید: «' + esc(it.name) + '» (کد خودکار)</span></li>';
      return '<li role="option" data-i="' + i + '"' + sel + '><span class="code">' + toFa(it.code) + "</span><span>" + esc(D.pathOf(it)) + "</span></li>";
    }).join("");
    ul.hidden = false; $("fAccount").setAttribute("aria-expanded", "true");
  }
  function onAccountInput() {
    var raw = D.normName($("fAccount").value), q = toEn(raw), isCode = /^\d+$/.test(q);
    selectedAccountId = null; $("acctHint").innerHTML = "";
    if (!q) { suggestItems = D.treeOrder().map(function (x) { return x.a; }).slice(0, 10); suggestIdx = -1; drawSuggest(); return; }
    var exact = isCode ? D.accByCode(+q) : D.accByName(raw);
    if (exact) { selectedAccountId = exact.id; $("acctHint").innerHTML = "کد <b>" + toFa(exact.code) + "</b>: " + esc(D.pathOf(exact)); }
    else if (isCode) $("acctHint").textContent = "حسابی با این کد نیست.";
    else $("acctHint").textContent = "اگر از لیست انتخاب نکنید، حساب جدید با کد خودکار ساخته می‌شود.";
    suggestItems = D.accounts.filter(function (a) { return String(a.code).indexOf(q) === 0 || D.pathOf(a).indexOf(raw) !== -1; })
      .sort(function (a, b) { return (exact && b.id === exact.id ? 1 : 0) - (exact && a.id === exact.id ? 1 : 0) || a.code - b.code; })
      .slice(0, 10);
    if (!exact && !isCode) suggestItems.push({ isNew: true, name: raw });
    suggestIdx = suggestItems.length ? 0 : -1;
    drawSuggest();
  }
  function pickSuggest(i) {
    var it = suggestItems[i]; if (!it) return;
    if (it.isNew) { selectedAccountId = null; $("fAccount").value = it.name; $("acctHint").textContent = "حساب جدید با ثبت سند ساخته می‌شود."; }
    else selectAccount(it);
    closeSuggest();
    $("fDebit").focus();
  }
  $("fAccount").addEventListener("input", onAccountInput);
  $("fAccount").addEventListener("focus", function () { if (!selectedAccountId) onAccountInput(); });
  $("fAccount").addEventListener("blur", function () {
    setTimeout(function () { if (document.activeElement !== $("fAccount")) closeSuggest(); }, 150);
  });
  $("fAccount").addEventListener("keydown", function (ev) {
    if ($("acctSuggest").hidden) {
      if (ev.key === "Enter") { ev.preventDefault(); $("fDebit").focus(); }
      return;
    }
    if (ev.key === "ArrowDown") { ev.preventDefault(); suggestIdx = Math.min(suggestIdx + 1, suggestItems.length - 1); drawSuggest(); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); suggestIdx = Math.max(suggestIdx - 1, 0); drawSuggest(); }
    else if (ev.key === "Enter" && suggestIdx >= 0) { ev.preventDefault(); pickSuggest(suggestIdx); }
    else if (ev.key === "Escape") closeSuggest();
  });
  $("acctSuggest").addEventListener("mousedown", function (ev) {
    var li = ev.target.closest("li"); if (!li) return;
    ev.preventDefault(); pickSuggest(+li.dataset.i);
  });

  // ---------- form ----------
  function resetForm() {
    editingId = null;
    $("entryForm").reset();
    $("fDate").value = toFa(D.todayJ());
    $("editNote").hidden = true;
    $("formTitle").textContent = "ثبت سند جدید";
    $("saveBtn").textContent = "ثبت سند";
    $("formErr").textContent = "";
    selectAccount(null); closeSuggest();
    updateHint();
  }
  function startEdit(id) {
    var e = entries.find(function (x) { return String(x.id) === String(id); });
    if (!e) return;
    editingId = e.id;
    $("fDate").value = toFa(e.date);
    selectAccount(D.accById(e.accountId));
    $("fDebit").value = e.debit ? toFa(e.debit / D.inFactor()) : "";
    $("fCredit").value = e.credit ? toFa(e.credit / D.inFactor()) : "";
    $("fMethod").value = e.method;
    $("fDesc").value = e.desc || "";
    $("editNote").hidden = false;
    $("formTitle").textContent = "ویرایش سند";
    $("saveBtn").textContent = "ذخیره تغییرات";
    updateHint();
    $("fDebit").focus();
    $("entryForm").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("cancelEdit").addEventListener("click", function () { resetForm(); history.replaceState(null, "", "/"); });

  $("entryForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var err = $("formErr");
    var date = D.normDate($("fDate").value);
    var acctText = D.normName($("fAccount").value);
    var debit = D.parseAmount($("fDebit").value), credit = D.parseAmount($("fCredit").value);
    if (!date) { err.textContent = "تاریخ را به شکل ۱۴۰۵/۰۸/۱۳ وارد کنید."; return; }
    if (!selectedAccountId && !acctText) { err.textContent = "کد یا نام حساب را وارد کنید."; return; }
    if (!selectedAccountId && /^\d+$/.test(toEn(acctText))) { err.textContent = "حسابی با کد " + toFa(toEn(acctText)) + " وجود ندارد."; return; }
    if (isNaN(debit) || isNaN(credit)) { err.textContent = "مبلغ را به " + D.unitName[D.cfg.inputCurrency] + " و بدون اعشار وارد کنید."; return; }
    if (debit <= 0 && credit <= 0) { err.textContent = "یکی از مبالغ بدهکار یا بستانکار را وارد کنید."; return; }
    err.textContent = "";
    var payload = { date: date, debit: debit * D.inFactor(), credit: credit * D.inFactor(),
      paymentMethod: $("fMethod").value, description: $("fDesc").value.trim() };
    var btn = $("saveBtn"); btn.disabled = true;
    var keepDate = $("fDate").value, keepMethod = $("fMethod").value, wasEdit = editingId;
    var ensureAccount = selectedAccountId ? Promise.resolve(selectedAccountId)
      : D.api("POST", "/api/accounts", { name: acctText }).then(function (a) { D.accounts.push(a); return a.id; });
    ensureAccount.then(function (accId) {
      payload.accountId = accId;
      return D.api(wasEdit ? "PUT" : "POST", wasEdit ? "/api/entries/" + wasEdit : "/api/entries", payload);
    }).then(function (saved) {
      var e = D.fromServer(saved);
      if (wasEdit) entries = entries.map(function (x) { return x.id === e.id ? e : x; });
      else entries.push(e);
      renderRecent();
      resetForm();
      if (wasEdit) history.replaceState(null, "", "/");
      else { $("fDate").value = keepDate; $("fMethod").value = keepMethod; }
      D.setStatus(wasEdit ? "سند ویرایش شد." : "سند ثبت شد.");
      $("fAccount").focus();
    }).catch(function (e) {
      err.textContent = "ثبت نشد: " + ((e && e.message) || "اتصال به سرور برقرار نیست.");
    }).then(function () { btn.disabled = false; });
  });

  // ---------- recent entries ----------
  function renderRecent() {
    var recent = entries.slice().sort(function (a, b) { return (b.createdAt - a.createdAt) || (b.id - a.id); }).slice(0, 20);
    $("recentBody").innerHTML = recent.length ? recent.map(function (e) {
      var acc = D.accById(e.accountId);
      var actions = String(pendingDelete) === String(e.id)
        ? '<span class="confirm">حذف شود؟ <button type="button" class="small danger" data-del-yes="' + e.id + '">بله</button><button type="button" class="small" data-del-no="1">نه</button></span>'
        : '<button type="button" class="small" data-edit="' + e.id + '">ویرایش</button> <button type="button" class="small" data-del="' + e.id + '">حذف</button>';
      return '<tr><td class="amt">' + toFa(e.date) + '</td><td><span class="code-cell">' + toFa(e.code) + "</span> " + esc(acc ? D.pathOf(acc) : e.account) + "</td>" +
        '<td class="amt dr">' + (e.debit ? D.fmtOut(e.debit) : "") + '</td><td class="amt cr">' + (e.credit ? D.fmtOut(e.credit) : "") + "</td>" +
        "<td>" + esc(e.method) + '</td><td class="desc">' + esc(e.desc) + "</td><td>" + actions + "</td></tr>";
    }).join("") : '<tr><td colspan="7" class="empty"><strong>هنوز سندی ثبت نشده</strong>اولین خرج یا دریافت را از فرم کنار وارد کنید.</td></tr>';
  }
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("button"); if (!t) return;
    if (t.dataset.edit) startEdit(t.dataset.edit);
    else if (t.dataset.del) { pendingDelete = t.dataset.del; renderRecent(); }
    else if (t.dataset.delNo) { pendingDelete = null; renderRecent(); }
    else if (t.dataset.delYes) {
      var id = t.dataset.delYes; pendingDelete = null;
      D.api("DELETE", "/api/entries/" + id).then(function () {
        entries = entries.filter(function (e) { return String(e.id) !== String(id); });
        if (String(editingId) === String(id)) resetForm();
        renderRecent(); D.setStatus("سند حذف شد.");
      }).catch(function (e) { D.setStatus("حذف نشد: " + e.message, true); renderRecent(); });
    }
  });

  D.start(function (first) {
    if (first) resetForm();
    load().then(function () {
      var m = location.search.match(/[?&]edit=(\d+)/);
      if (first && m) startEdit(m[1]);
    });
  });
})();
