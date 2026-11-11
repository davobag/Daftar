/* Accounts page: account tree with codes, add/edit/delete, add sub-accounts. No balances here; those live in the report. */
(function () {
  "use strict";
  var $ = D.$, toFa = D.toFa, toEn = D.toEn, esc = D.esc;
  var entries = [], editingAccountId = null;

  function load() {
    return Promise.all([D.loadAccounts(), D.api("GET", "/api/entries")]).then(function (r) {
      entries = (r[1] || []).map(D.fromServer);
      render();
    }).catch(function (e) { D.setStatus("بارگذاری نشد: " + e.message, true); });
  }

  function render() {
    var own = {};
    entries.forEach(function (e) {
      var s = own[e.accountId] || (own[e.accountId] = { n: 0, bal: 0 });
      s.n++; s.bal += (e.debit || 0) - (e.credit || 0);
    });
    var tree = D.treeOrder();
    $("accountsBody").innerHTML = tree.length ? tree.map(function (x) {
      var a = x.a, kids = D.childrenOf(a.id).length > 0, n = own[a.id] ? own[a.id].n : 0;
      return "<tr" + (kids ? ' class="tree-parent"' : "") + '><td class="amt code-cell">' + toFa(a.code) + "</td>" +
        '<td style="padding-inline-start:' + (0.6 + x.depth * 1.6) + 'em">' + (x.depth ? '<span class="path-sep">└ </span>' : "") + esc(a.name) + "</td>" +
        '<td><button type="button" class="small" data-sub="' + a.id + '">+ زیرحساب</button> <button type="button" class="small" data-edit="' + a.id + '">ویرایش</button> ' +
        (n || kids ? "" : '<button type="button" class="small" data-del="' + a.id + '">حذف</button>') + "</td></tr>";
    }).join("") : '<tr><td colspan="3" class="empty"><strong>هنوز حسابی تعریف نشده</strong>اولین حساب را با فرم بالا بسازید، یا موقع ثبت سند نام حساب جدید را بنویسید.</td></tr>';
    fillParentSelect();
  }

  function fillParentSelect() {
    var sel = $("aParent"), cur = sel.value;
    var blocked = editingAccountId ? D.subtreeIds(editingAccountId) : {};
    sel.innerHTML = '<option value="">— حساب اصلی —</option>' + D.treeOrder().filter(function (x) { return !blocked[x.a.id]; }).map(function (x) {
      return '<option value="' + x.a.id + '">' + "  ".repeat(x.depth) + toFa(x.a.code) + " - " + esc(x.a.name) + "</option>";
    }).join("");
    sel.value = cur; if (sel.value !== cur) sel.value = "";
  }

  function resetForm() {
    editingAccountId = null; $("aCode").value = ""; $("aName").value = ""; fillParentSelect(); $("aParent").value = "";
    $("aSave").textContent = "افزودن حساب"; $("aCancel").hidden = true; $("accountErr").textContent = "";
  }
  $("aCancel").addEventListener("click", resetForm);

  $("accountForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var codeTxt = toEn($("aCode").value).trim(), name = D.normName($("aName").value), err = $("accountErr");
    if (codeTxt && !/^\d+$/.test(codeTxt)) { err.textContent = "کد باید عدد باشد."; return; }
    if (!name) { err.textContent = "نام حساب را بنویسید."; return; }
    var body = { code: codeTxt ? +codeTxt : null, name: name, parentId: $("aParent").value ? +$("aParent").value : null };
    var wasEdit = editingAccountId, keepParent = wasEdit ? "" : $("aParent").value;
    D.api(wasEdit ? "PUT" : "POST", wasEdit ? "/api/accounts/" + wasEdit : "/api/accounts", body).then(function (a) {
      resetForm();
      return load().then(function () {
        $("aParent").value = keepParent; $("aName").focus();
        D.setStatus(wasEdit ? "حساب ذخیره شد." : "حساب «" + a.name + "» با کد " + toFa(a.code) + " ساخته شد.");
      });
    }).catch(function (e) { err.textContent = e.message; });
  });

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("button"); if (!t) return;
    if (t.dataset.sub) {
      resetForm(); $("aParent").value = t.dataset.sub; $("aName").focus();
      $("accountForm").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else if (t.dataset.edit) {
      var a = D.accById(t.dataset.edit); if (!a) return;
      editingAccountId = a.id; $("aCode").value = toFa(a.code); $("aName").value = a.name;
      fillParentSelect(); $("aParent").value = a.parentId ? String(a.parentId) : "";
      $("aSave").textContent = "ذخیره حساب"; $("aCancel").hidden = false; $("aName").focus();
      $("accountForm").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else if (t.dataset.del) {
      D.api("DELETE", "/api/accounts/" + t.dataset.del).then(load).catch(function (e) { $("accountErr").textContent = e.message; });
    }
  });

  D.start(function (first) { if (first) resetForm(); load().then(function () { if (first) $("aName").focus(); }); });
})();
