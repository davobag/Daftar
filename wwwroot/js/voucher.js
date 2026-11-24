/* Voucher page (سند حسابداری): one debit row and one credit row, each an account (کل/معین) plus an optional floating detail (تفصیلی), one amount. */
(function () {
  "use strict";
  var $ = D.$, toFa = D.toFa, esc = D.esc;
  var entries = [], editing = null; // editing = the entry being changed
  var touch = window.matchMedia && matchMedia("(pointer: coarse)").matches;

  function accPicker(prefix, next) {
    return D.makePicker({
      input: prefix, list: prefix + "List", hint: prefix + "Hint", noNew: true,
      missingHint: "این حساب تعریف نشده؛ از «کدینگ حساب‌ها» بسازید.",
      pool: function () { return D.treeOrder().map(function (x) { return x.a; }); },
      label: function (a) { return D.pathOf(a); },
      onChange: updateHint, next: next
    });
  }
  function detPicker(prefix, next) {
    return D.makePicker({
      input: prefix, list: prefix + "List", hint: prefix + "Hint", noNew: true,
      missingHint: "این تفصیلی تعریف نشده؛ از «کدینگ حساب‌ها» بسازید.",
      pool: function () { return D.details; },
      label: function (d) { return d.name; },
      next: next
    });
  }
  var drAcc = accPicker("vDrAcc", function () { $("vDrDet").focus(); });
  var drDet = detPicker("vDrDet", function () { $("vCrAcc").focus(); });
  var crAcc = accPicker("vCrAcc", function () { $("vCrDet").focus(); });
  var crDet = detPicker("vCrDet", function () { $("vAmount").focus(); });
  var pickers = [drAcc, drDet, crAcc, crDet];

  function updateHint() {
    var v = D.parseAmount($("vAmount").value), other = D.cfg.inputCurrency === "Toman" ? "Rial" : "Toman";
    $("vAmountHint").innerHTML = v > 0 ? "<b>" + (other === "Toman" ? v * D.inFactor() / 10 : v * D.inFactor()).toLocaleString("fa-IR") + "</b> " + D.unitName[other] : "";
  }
  $("vAmount").addEventListener("input", updateHint);

  // Enter moves forward: date → debit account; the last field (amount) submits
  $("vDate").addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); $("vDesc").focus(); } });
  $("vDesc").addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); $("vDrAcc").focus(); } });

  function resetForm(keep) {
    editing = null;
    var keepDate = keep && $("vDate").value, keepMethod = keep && $("vMethod").value;
    $("voucherForm").reset();
    $("vDate").value = keepDate || toFa(D.todayJ());
    if (keepMethod) $("vMethod").value = keepMethod;
    pickers.forEach(function (p) { p.set(null, true); p.close(); });
    $("vErr").textContent = ""; $("editNote").hidden = true; $("vBack").hidden = true; $("vReset").hidden = false;
    $("vTitle").textContent = "صدور سند حسابداری"; $("vSave").textContent = "ثبت سند"; $("vSave").disabled = false;
    updateHint();
  }
  $("vReset").addEventListener("click", function () { resetForm(false); $("vDrAcc").focus(); });

  function startEdit(id) {
    var e = entries.find(function (x) { return String(x.id) === String(id); });
    if (!e) { $("vErr").textContent = "سند شماره " + toFa(id) + " پیدا نشد."; return; }
    resetForm(false);
    editing = e;
    var v = D.asVoucher(e);
    $("vTitle").textContent = "اصلاح سند شماره " + toFa(e.id);
    $("vSave").textContent = "ذخیره‌ی اصلاحات";
    $("vReset").hidden = true; $("vBack").hidden = false;
    $("vDate").value = toFa(e.date); $("vMethod").value = e.method; $("vDesc").value = e.desc || "";
    $("editNote").hidden = false;
    if (v.both) {
      $("editNote").textContent = "این سند قدیمی هم بدهکار (" + D.fmtOut(e.debit) + ") و هم بستانکار (" + D.fmtOut(e.credit) + ") دارد و در این فرم جا نمی‌شود. آن را از «دفاتر و تراز» حذف و دوباره ثبت کنید.";
      $("vSave").disabled = true;
      return;
    }
    $("editNote").textContent = "در حال اصلاح سند. ثبت‌شده در " + toFa(new Date(e.createdAt).toLocaleDateString("fa-IR")) + ".";
    if (v.dr) { drAcc.set(D.accById(v.dr.acc), true); drDet.set(D.detById(v.dr.det), true); }
    if (v.cr) { crAcc.set(D.accById(v.cr.acc), true); crDet.set(D.detById(v.cr.det), true); }
    $("vAmount").value = toFa(v.amount / D.inFactor());
    updateHint();
    if (!touch) $("vAmount").focus();
  }

  $("voucherForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var err = $("vErr");
    function fail(m) { err.textContent = m; return; }
    var date = D.normDate($("vDate").value), amount = D.parseAmount($("vAmount").value);
    if (!date) return fail("تاریخ سند را به شکل ۱۴۰۵/۰۹/۰۳ وارد کنید.");
    var rows = [["بدهکار", "vDrAcc", drAcc, "vDrDet", drDet], ["بستانکار", "vCrAcc", crAcc, "vCrDet", crDet]];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (D.normName($(r[1]).value) && !r[2].selected) return fail("حساب ردیف " + r[0] + " را از فهرست انتخاب کنید.");
      if (D.normName($(r[3]).value) && !r[4].selected) return fail("تفصیلی ردیف " + r[0] + " را از فهرست انتخاب کنید.");
      if (r[4].selected && !r[2].selected) return fail("برای تفصیلی ردیف " + r[0] + " حساب کل/معین هم لازم است.");
    }
    var dr = drAcc.selected ? { acc: drAcc.selected.id, det: drDet.selected ? drDet.selected.id : null } : null;
    var cr = crAcc.selected ? { acc: crAcc.selected.id, det: crDet.selected ? crDet.selected.id : null } : null;
    if (!dr && !cr) return fail("دست کم یکی از ردیف‌های بدهکار یا بستانکار را پر کنید.");
    if (dr && cr && dr.acc === cr.acc) return fail("حساب بدهکار و بستانکار نمی‌تواند یکی باشد.");
    if (isNaN(amount) || amount <= 0) return fail("مبلغ را به " + D.unitName[D.cfg.inputCurrency] + " و بدون اعشار وارد کنید.");
    err.textContent = "";

    // keep the original orientation when editing, so an entry booked on its credit side stays there
    var primary = editing ? D.asVoucher(editing).primary : (dr ? "dr" : "cr");
    if (primary === "dr" && !dr) primary = "cr";
    if (primary === "cr" && !cr) primary = "dr";
    var main = primary === "dr" ? dr : cr, other = primary === "dr" ? cr : dr, rial = amount * D.inFactor();
    var payload = {
      date: date, accountId: main.acc, detailId: main.det,
      debit: primary === "dr" ? rial : 0, credit: primary === "cr" ? rial : 0,
      counterAccountId: other ? other.acc : null, counterDetailId: other ? other.det : null,
      paymentMethod: $("vMethod").value, description: $("vDesc").value.trim()
    };
    var wasEdit = editing, btn = $("vSave"); btn.disabled = true;
    D.api(wasEdit ? "PUT" : "POST", wasEdit ? "/api/entries/" + wasEdit.id : "/api/entries", payload).then(function (saved) {
      var e = D.fromServer(saved);
      if (wasEdit) {
        D.setStatus("سند شماره " + toFa(e.id) + " اصلاح شد.");
        setTimeout(goBack, 400);
        return;
      }
      entries.push(e);
      resetForm(true);
      D.setStatus("سند شماره " + toFa(e.id) + " ثبت شد.");
      if (!touch) $("vDrAcc").focus(); else window.scrollTo({ top: 0, behavior: "smooth" });
    }).catch(function (e) {
      err.textContent = "ثبت نشد: " + ((e && e.message) || "اتصال به سرور برقرار نیست.");
    }).then(function () { if (!wasEdit) btn.disabled = false; });
  });
  // amount is the last field: Enter there submits (the browser does that for a form with a submit button)

  function backUrl() {
    try { var r = new URL(document.referrer); if (r.origin === location.origin && r.pathname !== "/voucher") return r.pathname + r.search; } catch (e) { /* no referrer */ }
    return "/";
  }
  function goBack() { location.href = backUrl(); }
  $("vBack").addEventListener("click", function (ev) { ev.preventDefault(); goBack(); });

  D.start(function (first) {
    Promise.all([D.loadAccounts(), D.loadDetails(), D.api("GET", "/api/entries")]).then(function (r) {
      entries = (r[2] || []).map(D.fromServer);
      if (!first) return;
      resetForm(false);
      var m = location.search.match(/[?&]edit=(\d+)/);
      // no autofocus on touch screens: it would pop up the keyboard and the account list over the form
      if (m) startEdit(m[1]); else if (!touch) $("vDrAcc").focus();
    }).catch(function (e) { D.setStatus("بارگذاری نشد: " + e.message, true); });
  });
})();
