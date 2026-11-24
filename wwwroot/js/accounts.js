/* Chart of accounts (کدینگ): کل/معین tree and the floating detail list (تفصیلی); add/edit in modals; convert a معین into a تفصیلی. No balances here. */
(function () {
  "use strict";
  var $ = D.$, toFa = D.toFa, toEn = D.toEn, esc = D.esc;
  var entries = [], editingAccountId = null, dlg = $("accountDialog");

  function load() {
    return Promise.all([D.loadAccounts(), D.loadDetails(), D.api("GET", "/api/entries")]).then(function (r) {
      entries = (r[2] || []).map(D.fromServer);
      render(); renderDetails();
    }).catch(function (e) { D.setStatus("بارگذاری نشد: " + e.message, true); });
  }

  function render() {
    var used = {};
    entries.forEach(function (e) { used[e.accountId] = 1; if (e.counterId) used[e.counterId] = 1; });
    var q = D.normName($("aSearch").value), qe = toEn(q);
    var tree = D.treeOrder(), shown = tree;
    if (q) {
      // keep matches plus their ancestors so the tree still reads correctly
      var keep = {};
      tree.forEach(function (x) {
        var a = x.a;
        if (String(a.code).indexOf(qe) === 0 || D.pathOf(a).indexOf(q) !== -1) {
          for (var c = a; c; c = c.parentId ? D.accById(c.parentId) : null) keep[c.id] = 1;
        }
      });
      shown = tree.filter(function (x) { return keep[x.a.id]; });
    }
    $("acctCount").textContent = tree.length ? "(" + D.fmt(tree.length) + ")" : "";
    $("accountsBody").innerHTML = shown.length ? shown.map(function (x) {
      var a = x.a, kids = D.childrenOf(a.id).length > 0, parent = a.parentId ? D.accById(a.parentId) : null;
      var level = x.depth === 0 ? "کل" : x.depth === 1 ? "معین" : "معین سطح " + toFa(x.depth);
      return "<tr" + (kids ? ' class="tree-parent"' : "") + '><td class="amt code-cell">' + toFa(a.code) + "</td>" +
        '<td class="name" style="padding-inline-start:' + (0.6 + x.depth * 1.6) + 'em">' + (x.depth ? '<span class="path-sep">└ </span>' : "") + esc(a.name) + "</td>" +
        '<td class="level">' + level + "</td>" + '<td class="col-parent">' + (parent ? esc(D.pathOf(parent)) : "—") + "</td>" +
        '<td class="acts"><button type="button" class="small" data-sub="' + a.id + '">+ معین</button><button type="button" class="small" data-edit="' + a.id + '">ویرایش</button>' +
        (parent && !kids ? '<button type="button" class="small" data-conv="' + a.id + '">تبدیل به تفصیلی</button>' : "") +
        (used[a.id] || kids ? "" : '<button type="button" class="small" data-del="' + a.id + '">حذف</button>') + "</td></tr>";
    }).join("") : '<tr><td colspan="5" class="empty">' + (tree.length ? "حسابی با این جستجو پیدا نشد." :
      "<strong>هنوز حسابی تعریف نشده</strong>با دکمه‌ی «حساب کل جدید» اولین حساب را بسازید.") + "</td></tr>";
  }

  function fillParentSelect() {
    var sel = $("aParent");
    var blocked = editingAccountId ? D.subtreeIds(editingAccountId) : {};
    sel.innerHTML = '<option value="">— ندارد (حساب کل) —</option>' + D.treeOrder().filter(function (x) { return !blocked[x.a.id]; }).map(function (x) {
      return '<option value="' + x.a.id + '">' + "  ".repeat(x.depth) + toFa(x.a.code) + " - " + esc(x.a.name) + "</option>";
    }).join("");
  }

  // mode: "new" | "sub" | "edit"
  function openDialog(mode, id) {
    var a = id ? D.accById(id) : null;
    editingAccountId = mode === "edit" && a ? a.id : null;
    fillParentSelect();
    $("accountErr").textContent = "";
    $("aCode").value = editingAccountId ? toFa(a.code) : "";
    $("aName").value = editingAccountId ? a.name : "";
    $("aParent").value = mode === "sub" && a ? String(a.id) : (editingAccountId && a.parentId ? String(a.parentId) : "");
    $("dlgTitle").textContent = mode === "edit" ? "ویرایش حساب «" + a.name + "»" : mode === "sub" && a ? "حساب معین جدید زیر «" + a.name + "»" : "حساب کل جدید";
    $("aSave").textContent = editingAccountId ? "ذخیره" : "افزودن حساب";
    if (!dlg.open) dlg.showModal();
    $("aName").focus();
  }

  $("aNew").addEventListener("click", function () { openDialog("new"); });
  $("aCancel").addEventListener("click", function () { dlg.close(); });
  dlg.addEventListener("click", function (ev) { if (ev.target === dlg) dlg.close(); }); // click on backdrop
  $("aSearch").addEventListener("input", render);

  $("accountForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var codeTxt = toEn($("aCode").value).trim(), name = D.normName($("aName").value), err = $("accountErr");
    if (codeTxt && !/^\d+$/.test(codeTxt)) { err.textContent = "کد باید عدد باشد."; return; }
    if (!name) { err.textContent = "نام حساب را بنویسید."; $("aName").focus(); return; }
    var body = { code: codeTxt ? +codeTxt : null, name: name, parentId: $("aParent").value ? +$("aParent").value : null };
    var wasEdit = editingAccountId;
    $("aSave").disabled = true;
    D.api(wasEdit ? "PUT" : "POST", wasEdit ? "/api/accounts/" + wasEdit : "/api/accounts", body).then(function (a) {
      dlg.close();
      return load().then(function () {
        D.setStatus(wasEdit ? "حساب ذخیره شد." : "حساب «" + a.name + "» با کد " + toFa(a.code) + " ساخته شد.");
      });
    }).catch(function (e) { err.textContent = e.message; }).then(function () { $("aSave").disabled = false; });
  });

  $("accountsBody").addEventListener("click", function (ev) {
    var t = ev.target.closest("button"); if (!t) return;
    if (t.dataset.sub) openDialog("sub", t.dataset.sub);
    else if (t.dataset.edit) openDialog("edit", t.dataset.edit);
    else if (t.dataset.conv) openConvert(t.dataset.conv);
    else if (t.dataset.del) {
      $("listErr").textContent = "";
      D.api("DELETE", "/api/accounts/" + t.dataset.del).then(load).catch(function (e) { $("listErr").textContent = e.message; });
    }
  });

  // ---------- floating details (تفصیلی) ----------
  var dDlg = $("detailDialog"), editingDetailId = null;
  function renderDetails() {
    var usedD = {};
    entries.forEach(function (e) { if (e.detailId) usedD[e.detailId] = (usedD[e.detailId] || 0) + 1; if (e.counterDetailId) usedD[e.counterDetailId] = (usedD[e.counterDetailId] || 0) + 1; });
    var q = D.normName($("dSearch").value), qe = toEn(q);
    var list = D.details.filter(function (d) { return !q || String(d.code).indexOf(qe) === 0 || d.name.indexOf(q) !== -1; });
    $("detCount").textContent = D.details.length ? "(" + D.fmt(D.details.length) + ")" : "";
    $("detailsBody").innerHTML = list.length ? list.map(function (d) {
      return '<tr><td class="amt code-cell">' + toFa(d.code) + '</td><td class="name">' + esc(d.name) +
        (usedD[d.id] ? ' <span class="unit">(' + D.fmt(usedD[d.id]) + " سند)</span>" : "") + "</td>" +
        '<td class="acts"><button type="button" class="small" data-dedit="' + d.id + '">ویرایش</button>' +
        (usedD[d.id] ? "" : '<button type="button" class="small" data-ddel="' + d.id + '">حذف</button>') + "</td></tr>";
    }).join("") : '<tr><td colspan="3" class="empty">' + (D.details.length ? "تفصیلی‌ای با این جستجو پیدا نشد." :
      "<strong>هنوز تفصیلی‌ای تعریف نشده</strong>اشخاص، پروژه‌ها یا مراکز هزینه را اینجا تعریف کنید، یا معین‌های فعلی را «تبدیل به تفصیلی» کنید.") + "</td></tr>";
  }
  function openDetail(id) {
    var d = id ? D.detById(id) : null;
    editingDetailId = d ? d.id : null;
    $("dName").value = d ? d.name : ""; $("dCode").value = d ? toFa(d.code) : ""; $("detailErr").textContent = "";
    $("dDlgTitle").textContent = d ? "ویرایش تفصیلی «" + d.name + "»" : "تفصیلی جدید";
    $("dSave").textContent = d ? "ذخیره" : "افزودن";
    dDlg.showModal(); $("dName").focus();
  }
  $("dNew").addEventListener("click", function () { openDetail(null); });
  $("dCancel").addEventListener("click", function () { dDlg.close(); });
  dDlg.addEventListener("click", function (ev) { if (ev.target === dDlg) dDlg.close(); });
  $("dSearch").addEventListener("input", renderDetails);
  $("detailForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var codeTxt = toEn($("dCode").value).trim(), name = D.normName($("dName").value), err = $("detailErr");
    if (codeTxt && !/^\d+$/.test(codeTxt)) { err.textContent = "کد باید عدد باشد."; return; }
    if (!name) { err.textContent = "نام تفصیلی را بنویسید."; return; }
    var id = editingDetailId;
    D.api(id ? "PUT" : "POST", id ? "/api/details/" + id : "/api/details", { code: codeTxt ? +codeTxt : null, name: name }).then(function (d) {
      dDlg.close();
      return load().then(function () { D.setStatus(id ? "تفصیلی ذخیره شد." : "تفصیلی «" + d.name + "» با کد " + toFa(d.code) + " ساخته شد."); });
    }).catch(function (e) { err.textContent = e.message; });
  });
  $("detailsBody").addEventListener("click", function (ev) {
    var t = ev.target.closest("button"); if (!t) return;
    if (t.dataset.dedit) openDetail(t.dataset.dedit);
    else if (t.dataset.ddel) {
      $("detListErr").textContent = "";
      D.api("DELETE", "/api/details/" + t.dataset.ddel).then(load).catch(function (e) { $("detListErr").textContent = e.message; });
    }
  });

  // ---------- convert a معین (leaf sub-account) into a floating detail ----------
  var cDlg = $("convertDialog"), convId = null;
  function openConvert(id) {
    var a = D.accById(id); if (!a) return;
    var parent = D.accById(a.parentId);
    var n = entries.filter(function (e) { return e.accountId === a.id || e.counterId === a.id; }).length;
    convId = a.id; $("convertErr").textContent = "";
    $("cText").innerHTML = "حساب <b>" + toFa(a.code) + " " + esc(D.pathOf(a)) + "</b> حذف می‌شود و به جایش تفصیلی <b>«" + esc(a.name) + "»</b> ساخته می‌شود (اگر از قبل نباشد)." +
      "<br><br>" + (n ? D.fmt(n) + " سند آن به حساب <b>" + toFa(parent.code) + " " + esc(D.pathOf(parent)) + "</b> منتقل می‌شود و تفصیلی‌اش «" + esc(a.name) + "» می‌شود. مبلغ‌ها و مانده‌ها تغییری نمی‌کنند." : "این حساب سندی ندارد.");
    cDlg.showModal(); $("cOk").focus();
  }
  $("cCancel").addEventListener("click", function () { cDlg.close(); });
  $("convertForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    $("cOk").disabled = true;
    D.api("POST", "/api/accounts/" + convId + "/to-detail").then(function (r) {
      cDlg.close();
      return load().then(function () { D.setStatus("تبدیل شد: تفصیلی «" + r.detail.name + "» (کد " + toFa(r.detail.code) + ")، " + D.fmt(r.moved) + " سند منتقل شد."); });
    }).catch(function (e) { $("convertErr").textContent = e.message; }).then(function () { $("cOk").disabled = false; });
  });

  D.start(function () { load(); });
})();
