/* Entry page: record a journal entry (account + optional sub-account, each by code or name), see today's entries, monthly chart. */
(function () {
  "use strict";
  var $ = D.$, toFa = D.toFa, toEn = D.toEn, esc = D.esc;
  var entries = [], editingId = null, pendingDelete = null;

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

  // ---------- two pickers: main account, then (optional) sub-account; both accept a code or a name ----------
  function rootOf(a) { var c = a, g = 0; while (c && c.parentId && g++ < 20) c = D.accById(c.parentId); return c; }
  function relPath(a, root) { var p = D.pathOf(a), r = D.pathOf(root) + " › "; return p.indexOf(r) === 0 ? p.slice(r.length) : p; }

  function makePicker(o) {
    var input = $(o.input), ul = $(o.list), hint = $(o.hint), items = [], idx = -1;
    var P = { selected: null, newName: null };
    function close() { ul.hidden = true; input.setAttribute("aria-expanded", "false"); idx = -1; }
    function draw() {
      if (!items.length) { close(); return; }
      ul.innerHTML = items.map(function (it, i) {
        var sel = ' aria-selected="' + (i === idx) + '"';
        if (it.isNew) return '<li role="option" data-i="' + i + '"' + sel + '><span class="code new">+</span><span class="new">' + esc(o.newLabel(it.name)) + "</span></li>";
        return '<li role="option" data-i="' + i + '"' + sel + '><span class="code">' + toFa(it.code) + "</span><span>" + esc(o.label(it)) + "</span></li>";
      }).join("");
      ul.hidden = false; input.setAttribute("aria-expanded", "true");
    }
    P.set = function (a, silent) {
      P.selected = a || null; P.newName = null;
      input.value = a ? o.label(a) : "";
      hint.innerHTML = a ? "کد <b>" + toFa(a.code) + "</b>" : "";
      if (!silent && o.onChange) o.onChange(P.selected);
    };
    P.close = close;
    function onInput() {
      var raw = D.normName(input.value), q = toEn(raw), isCode = /^\d+$/.test(q), pool = o.pool();
      P.selected = null; P.newName = null; hint.innerHTML = "";
      if (!q) { items = pool.slice(0, 12); idx = -1; draw(); if (o.onChange) o.onChange(null); return; }
      var exact = null;
      if (isCode) {
        exact = pool.find(function (a) { return String(a.code) === q; }) || null;
        if (!exact && o.onForeignCode) { var f = D.accByCode(+q); if (f && o.onForeignCode(f)) { close(); return; } }
      } else exact = pool.find(function (a) { return o.label(a) === raw || a.name === raw; }) || null;
      if (exact) { P.selected = exact; hint.innerHTML = "کد <b>" + toFa(exact.code) + "</b>"; }
      else if (isCode) hint.textContent = "کدی با این شماره اینجا نیست.";
      else { P.newName = raw; hint.textContent = o.newHint; }
      if (o.onChange) o.onChange(P.selected);
      items = pool.filter(function (a) { return String(a.code).indexOf(q) === 0 || o.label(a).indexOf(raw) !== -1; })
        .sort(function (a, b) { return (exact && b.id === exact.id ? 1 : 0) - (exact && a.id === exact.id ? 1 : 0) || a.code - b.code; })
        .slice(0, 12);
      if (!exact && !isCode) items.push({ isNew: true, name: raw });
      idx = items.length ? 0 : -1;
      draw();
    }
    function pick(i) {
      var it = items[i]; if (!it) return;
      if (it.isNew) { P.selected = null; P.newName = it.name; input.value = it.name; hint.textContent = o.newHint; if (o.onChange) o.onChange(null); }
      else P.set(it);
      close();
      o.next();
    }
    input.addEventListener("input", onInput);
    input.addEventListener("focus", function () { if (!P.selected && !P.newName) onInput(); });
    input.addEventListener("blur", function () { setTimeout(function () { if (document.activeElement !== input) close(); }, 150); });
    input.addEventListener("keydown", function (ev) {
      if (ul.hidden) { if (ev.key === "Enter") { ev.preventDefault(); o.next(); } return; }
      if (ev.key === "ArrowDown") { ev.preventDefault(); idx = Math.min(idx + 1, items.length - 1); draw(); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); idx = Math.max(idx - 1, 0); draw(); }
      else if (ev.key === "Enter") { ev.preventDefault(); if (idx >= 0) pick(idx); else { close(); o.next(); } }
      else if (ev.key === "Escape") close();
    });
    ul.addEventListener("mousedown", function (ev) { var li = ev.target.closest("li"); if (!li) return; ev.preventDefault(); pick(+li.dataset.i); });
    return P;
  }

  function descendants(root) {
    if (!root) return [];
    var set = D.subtreeIds(root.id);
    return D.treeOrder().map(function (x) { return x.a; }).filter(function (a) { return set[a.id] && a.id !== root.id; });
  }

  var acctPicker = makePicker({
    input: "fAccount", list: "acctSuggest", hint: "acctHint",
    pool: function () { return D.childrenOf(null); },
    label: function (a) { return a.name; },
    newLabel: function (n) { return "حساب اصلی جدید: «" + n + "» (کد خودکار)"; },
    newHint: "حساب اصلی جدید با ثبت سند ساخته می‌شود.",
    // typing a sub-account's full code here (e.g. 10201) fills both boxes
    onForeignCode: function (a) { var r = rootOf(a); if (!r || r.id === a.id) return false; acctPicker.set(r); subPicker.set(a); return true; },
    onChange: function (a) { syncSub(a); },
    next: function () {
      var a = acctPicker.selected;
      if (a && descendants(a).length || acctPicker.newName) $("fSub").focus(); else $("fDebit").focus();
    }
  });
  var subPicker = makePicker({
    input: "fSub", list: "subSuggest", hint: "subHint",
    pool: function () { return descendants(acctPicker.selected); },
    label: function (a) { return acctPicker.selected ? relPath(a, acctPicker.selected) : a.name; },
    newLabel: function (n) { return "زیرحساب جدید: «" + n + "» (کد خودکار)"; },
    newHint: "زیرحساب جدید با ثبت سند ساخته می‌شود.",
    next: function () { $("fDebit").focus(); }
  });
  var lastRootId = null;
  function syncSub(a) {
    var id = a ? a.id : null, fSub = $("fSub");
    fSub.disabled = !a && !acctPicker.newName;
    fSub.placeholder = fSub.disabled ? "اول حساب را انتخاب کنید" : (a && descendants(a).length ? "کد یا نام زیرحساب (خالی = خود حساب)" : "ندارد؛ برای ساختن نام بنویسید");
    if (id !== lastRootId) { subPicker.set(null, true); lastRootId = id; }
  }

  // ---------- form ----------
  function resetForm() {
    editingId = null;
    $("entryForm").reset();
    $("fDate").value = toFa(D.todayJ());
    $("editNote").hidden = true;
    $("formTitle").textContent = "ثبت سند جدید";
    $("saveBtn").textContent = "ثبت سند";
    $("formErr").textContent = "";
    acctPicker.set(null); subPicker.set(null, true); acctPicker.close(); subPicker.close();
    updateHint();
  }
  function startEdit(id) {
    var e = entries.find(function (x) { return String(x.id) === String(id); });
    if (!e) return;
    editingId = e.id;
    $("fDate").value = toFa(e.date);
    var a = D.accById(e.accountId), r = rootOf(a);
    acctPicker.set(r);
    if (a && r && a.id !== r.id) subPicker.set(a);
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
    var debit = D.parseAmount($("fDebit").value), credit = D.parseAmount($("fCredit").value);
    var acct = acctPicker.selected, acctNew = acctPicker.newName, sub = subPicker.selected, subNew = subPicker.newName;
    var subText = D.normName($("fSub").value), acctText = D.normName($("fAccount").value);
    if (!date) { err.textContent = "تاریخ را به شکل ۱۴۰۵/۰۸/۱۳ وارد کنید."; return; }
    if (!acct && !acctNew) { err.textContent = acctText ? "حسابی با کد " + toFa(toEn(acctText)) + " وجود ندارد." : "کد یا نام حساب را وارد کنید."; return; }
    if (subText && !sub && !subNew) { err.textContent = "زیرحسابی با کد " + toFa(toEn(subText)) + " زیر این حساب نیست."; return; }
    if (isNaN(debit) || isNaN(credit)) { err.textContent = "مبلغ را به " + D.unitName[D.cfg.inputCurrency] + " و بدون اعشار وارد کنید."; return; }
    if (debit <= 0 && credit <= 0) { err.textContent = "یکی از مبالغ بدهکار یا بستانکار را وارد کنید."; return; }
    err.textContent = "";
    var payload = { date: date, debit: debit * D.inFactor(), credit: credit * D.inFactor(),
      paymentMethod: $("fMethod").value, description: $("fDesc").value.trim() };
    var btn = $("saveBtn"); btn.disabled = true;
    var keepDate = $("fDate").value, keepMethod = $("fMethod").value, wasEdit = editingId;
    function create(name, parentId) {
      return D.api("POST", "/api/accounts", { name: name, parentId: parentId }).then(function (a) { D.accounts.push(a); return a; });
    }
    (acct ? Promise.resolve(acct) : create(acctNew, null)).then(function (root) {
      if (sub) return sub;
      if (subNew) return create(subNew, root.id);
      return root;
    }).then(function (target) {
      payload.accountId = target.id;
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

  // ---------- entries recorded today (by the time they were saved, not the entry date) ----------
  function isToday(ms) {
    var d = new Date(ms), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }
  function timeOf(ms) { var d = new Date(ms); return toFa(D.pad(d.getHours()) + ":" + D.pad(d.getMinutes())); }
  function renderRecent() {
    if (D.drawMonthChart) D.drawMonthChart(entries);
    var list = entries.filter(function (e) { return isToday(e.createdAt); })
      .sort(function (a, b) { return (b.createdAt - a.createdAt) || (b.id - a.id); });
    $("recentBody").innerHTML = list.length ? list.map(function (e) {
      var acc = D.accById(e.accountId);
      var actions = String(pendingDelete) === String(e.id)
        ? '<span class="confirm">حذف شود؟ <button type="button" class="small danger" data-del-yes="' + e.id + '">بله</button><button type="button" class="small" data-del-no="1">نه</button></span>'
        : '<button type="button" class="small" data-edit="' + e.id + '">ویرایش</button> <button type="button" class="small" data-del="' + e.id + '">حذف</button>';
      return '<tr><td class="time">' + timeOf(e.createdAt) + '</td><td class="amt">' + toFa(e.date) + '</td><td><span class="code-cell">' + toFa(e.code) + "</span> " + esc(acc ? D.pathOf(acc) : e.account) + "</td>" +
        '<td class="amt dr">' + (e.debit ? D.fmtOut(e.debit) : "") + '</td><td class="amt cr">' + (e.credit ? D.fmtOut(e.credit) : "") + "</td>" +
        "<td>" + esc(e.method) + '</td><td class="desc">' + esc(e.desc) + "</td><td>" + actions + "</td></tr>";
    }).join("") : "";
    $("recentBody").closest(".table-scroll").hidden = !list.length;
    $("recentEmpty").hidden = !!list.length;
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
