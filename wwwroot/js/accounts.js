/* Accounts page: full-width account tree with codes; add/edit in a modal dialog. No balances here; those live in the report. */
(function () {
  "use strict";
  var $ = D.$, toFa = D.toFa, toEn = D.toEn, esc = D.esc;
  var entries = [], editingAccountId = null, dlg = $("accountDialog");

  function load() {
    return Promise.all([D.loadAccounts(), D.api("GET", "/api/entries")]).then(function (r) {
      entries = (r[1] || []).map(D.fromServer);
      render();
    }).catch(function (e) { D.setStatus("بارگذاری نشد: " + e.message, true); });
  }

  function render() {
    var used = {};
    entries.forEach(function (e) { used[e.accountId] = 1; });
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
      return "<tr" + (kids ? ' class="tree-parent"' : "") + '><td class="amt code-cell">' + toFa(a.code) + "</td>" +
        '<td class="name" style="padding-inline-start:' + (0.6 + x.depth * 1.6) + 'em">' + (x.depth ? '<span class="path-sep">└ </span>' : "") + esc(a.name) + "</td>" +
        '<td class="col-parent">' + (parent ? esc(D.pathOf(parent)) : "—") + "</td>" +
        '<td class="acts"><button type="button" class="small" data-sub="' + a.id + '">+ زیرحساب</button><button type="button" class="small" data-edit="' + a.id + '">ویرایش</button>' +
        (used[a.id] || kids ? "" : '<button type="button" class="small" data-del="' + a.id + '">حذف</button>') + "</td></tr>";
    }).join("") : '<tr><td colspan="4" class="empty">' + (tree.length ? "حسابی با این جستجو پیدا نشد." :
      "<strong>هنوز حسابی تعریف نشده</strong>با دکمه‌ی «حساب جدید» اولین حساب را بسازید، یا موقع ثبت سند نام حساب جدید را بنویسید.") + "</td></tr>";
  }

  function fillParentSelect() {
    var sel = $("aParent");
    var blocked = editingAccountId ? D.subtreeIds(editingAccountId) : {};
    sel.innerHTML = '<option value="">— حساب اصلی —</option>' + D.treeOrder().filter(function (x) { return !blocked[x.a.id]; }).map(function (x) {
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
    $("dlgTitle").textContent = mode === "edit" ? "ویرایش حساب «" + a.name + "»" : mode === "sub" && a ? "زیرحساب جدید برای «" + a.name + "»" : "حساب جدید";
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
    else if (t.dataset.del) {
      $("listErr").textContent = "";
      D.api("DELETE", "/api/accounts/" + t.dataset.del).then(load).catch(function (e) { $("listErr").textContent = e.message; });
    }
  });

  D.start(function () { load(); });
})();
