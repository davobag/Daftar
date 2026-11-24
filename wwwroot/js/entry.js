/* Dashboard: monthly debit/credit chart and the vouchers recorded today. Vouchers are entered on /voucher. */
(function () {
  "use strict";
  var $ = D.$, toFa = D.toFa;
  var entries = [], pendingDelete = null;

  function load() {
    D.setStatus("در حال بارگذاری…");
    return Promise.all([D.loadAccounts(), D.loadDetails(), D.api("GET", "/api/entries")]).then(function (r) {
      entries = (r[2] || []).map(D.fromServer);
      D.setStatus("");
      render();
    }).catch(function (e) { D.setStatus("بارگذاری نشد: " + e.message, true); });
  }

  function isToday(ms) {
    var d = new Date(ms), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }
  function timeOf(ms) { var d = new Date(ms); return toFa(D.pad(d.getHours()) + ":" + D.pad(d.getMinutes())); }
  function side(s) { return s ? D.sideLabel(s.acc, s.det) : '<span class="counter missing">؟</span>'; }

  function render() {
    if (D.drawMonthChart) D.drawMonthChart(entries);
    var list = entries.filter(function (e) { return isToday(e.createdAt); })
      .sort(function (a, b) { return (b.createdAt - a.createdAt) || (b.id - a.id); });
    $("recentBody").innerHTML = list.map(function (e) {
      var v = D.asVoucher(e);
      var actions = String(pendingDelete) === String(e.id)
        ? '<span class="confirm">حذف شود؟ <button type="button" class="small danger" data-del-yes="' + e.id + '">بله</button><button type="button" class="small" data-del-no="1">نه</button></span>'
        : '<a class="small" href="/voucher?edit=' + e.id + '">ویرایش</a> <button type="button" class="small" data-del="' + e.id + '">حذف</button>';
      return '<tr><td class="amt">' + toFa(e.id) + '</td><td class="time">' + timeOf(e.createdAt) + '</td><td class="amt">' + toFa(e.date) + "</td>" +
        "<td>" + side(v.dr) + "</td><td>" + side(v.cr) + "</td>" +
        '<td class="amt">' + (v.both ? D.fmtOut(e.debit) + " / " + D.fmtOut(e.credit) : D.fmtOut(v.amount)) + "</td>" +
        "<td>" + D.esc(e.method) + '</td><td class="desc">' + D.esc(e.desc) + "</td><td>" + actions + "</td></tr>";
    }).join("");
    $("recentBody").closest(".table-scroll").hidden = !list.length;
    $("recentEmpty").hidden = !!list.length;
  }

  $("recentBody").addEventListener("click", function (ev) {
    var t = ev.target.closest("button"); if (!t) return;
    if (t.dataset.del) { pendingDelete = t.dataset.del; render(); }
    else if (t.dataset.delNo) { pendingDelete = null; render(); }
    else if (t.dataset.delYes) {
      var id = t.dataset.delYes; pendingDelete = null;
      D.api("DELETE", "/api/entries/" + id).then(function () {
        entries = entries.filter(function (e) { return String(e.id) !== String(id); });
        render(); D.setStatus("سند حذف شد.");
      }).catch(function (e) { D.setStatus("حذف نشد: " + e.message, true); render(); });
    }
  });

  // old links (/?edit=12) now open the voucher page
  var m = location.search.match(/[?&]edit=(\d+)/);
  if (m) { location.replace("/voucher?edit=" + m[1]); return; }
  D.start(function () { load(); });
})();
