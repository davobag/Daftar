/* Daily debit/credit bar chart for one Jalali month. Drawn left to right: day 1 on the left. */
(function () {
  "use strict";
  var $ = D.$, toFa = D.toFa, esc = D.esc;
  var weekdays = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
  var today = D.todayParts(), viewY = today[0], viewM = today[1];
  var entries = [], dayData = [];

  function compact(v) {
    var a = Math.abs(v), units = [[1e9, "میلیارد"], [1e6, "میلیون"], [1e3, "هزار"]];
    for (var i = 0; i < units.length; i++) {
      if (a >= units[i][0]) return (v / units[i][0]).toLocaleString("fa-IR", { maximumFractionDigits: 1 }) + " " + units[i][1];
    }
    return v.toLocaleString("fa-IR");
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  var fmtv = function (v) { return v.toLocaleString("fa-IR", { maximumFractionDigits: 1 }); };

  function render() {
    var days = D.monthLength(viewY, viewM), prefix = viewY + "/" + D.pad(viewM) + "/";
    var div = D.cfg.reportCurrency === "Toman" ? 10 : 1;
    dayData = [];
    for (var d = 1; d <= days; d++) {
      var g = D.j2g(viewY, viewM, d);
      dayData.push({ d: d, dr: 0, cr: 0, wd: new Date(g[0], g[1] - 1, g[2]).getDay() });
    }
    var totDr = 0, totCr = 0;
    entries.forEach(function (e) {
      if (e.date.indexOf(prefix) !== 0) return;
      var x = dayData[+e.date.slice(8) - 1]; if (!x) return;
      x.dr += (e.debit || 0) / div; x.cr += (e.credit || 0) / div;
      totDr += e.debit || 0; totCr += e.credit || 0;
    });
    var isCurrent = viewY === today[0] && viewM === today[1];
    $("monthLabel").textContent = D.monthNames[viewM - 1] + " " + toFa(viewY);
    $("monthDr").textContent = D.fmtOut(totDr);
    $("monthCr").textContent = D.fmtOut(totCr);
    $("thisMonth").hidden = isCurrent;

    var max = niceMax(Math.max.apply(null, dayData.map(function (x) { return Math.max(x.dr, x.cr); }).concat([0])));
    var slot = 26, padL = 74, padR = 10, padT = 12, plotH = 200, padB = 34, bw = 9;
    var W = padL + padR + slot * days, H = padT + plotH + padB;
    function y(v) { return padT + plotH - (v / max) * plotH; }
    function xSlot(d) { return padL + slot * (d - 1); }
    var svg = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="نمودار بدهکار و بستانکار روزانه ' + esc($("monthLabel").textContent) + '">'];
    dayData.forEach(function (x) {
      if (x.wd === 5) svg.push('<rect class="ch-fri" x="' + xSlot(x.d) + '" y="' + padT + '" width="' + slot + '" height="' + plotH + '"></rect>');
    });
    for (var i = 0; i <= 4; i++) {
      var v = max * i / 4, yy = y(v);
      svg.push('<line class="ch-grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '"></line>');
      svg.push('<text class="ch-axis" x="' + (padL - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + compact(v) + "</text>");
    }
    dayData.forEach(function (x) {
      var mid = xSlot(x.d) + slot / 2;
      // debit on the left, credit on the right, touching
      if (x.dr > 0) svg.push('<rect class="ch-dr" x="' + (mid - bw) + '" y="' + y(x.dr) + '" width="' + bw + '" height="' + Math.max(1, padT + plotH - y(x.dr)) + '" rx="2"></rect>');
      if (x.cr > 0) svg.push('<rect class="ch-cr" x="' + mid + '" y="' + y(x.cr) + '" width="' + bw + '" height="' + Math.max(1, padT + plotH - y(x.cr)) + '" rx="2"></rect>');
      svg.push('<text class="ch-day' + (isCurrent && x.d === today[2] ? " ch-today" : "") + '" x="' + mid + '" y="' + (padT + plotH + 18) + '" text-anchor="middle">' + toFa(x.d) + "</text>");
      svg.push('<rect class="ch-hit" data-day="' + x.d + '" x="' + xSlot(x.d) + '" y="' + padT + '" width="' + slot + '" height="' + (plotH + 24) + '"><title>' +
        weekdays[x.wd] + " " + toFa(x.d) + " " + D.monthNames[viewM - 1] + "</title></rect>");
    });
    svg.push('<line class="ch-base" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + plotH) + '" y2="' + (padT + plotH) + '"></line>');
    svg.push("</svg>");
    var box = $("chartBox");
    box.innerHTML = svg.join("");
    // on narrow screens, scroll so today is in view
    if (isCurrent && box.scrollWidth > box.clientWidth) {
      var ratio = box.scrollWidth / W;
      box.scrollLeft = Math.max(0, xSlot(today[2]) * ratio - box.clientWidth / 2);
    }
  }

  function showDay(d) {
    var x = dayData[d - 1]; if (!x) return;
    document.querySelectorAll(".ch-hit.on").forEach(function (el) { el.classList.remove("on"); });
    var hit = document.querySelector('.ch-hit[data-day="' + d + '"]'); if (hit) hit.classList.add("on");
    $("chartTip").innerHTML = weekdays[x.wd] + " " + toFa(d) + " " + D.monthNames[viewM - 1] + ": بدهکار <b>" + fmtv(x.dr) + "</b>، بستانکار <b>" + fmtv(x.cr) + "</b> " + D.unitName[D.cfg.reportCurrency];
  }
  function shiftMonth(n) {
    viewM += n;
    if (viewM < 1) { viewM = 12; viewY--; }
    if (viewM > 12) { viewM = 1; viewY++; }
    render();
    $("chartTip").textContent = "روی هر روز بروید یا بزنید تا مبالغش را ببینید.";
  }
  $("chartBox").addEventListener("mouseover", function (ev) { var t = ev.target.closest(".ch-hit"); if (t) showDay(+t.dataset.day); });
  $("chartBox").addEventListener("click", function (ev) { var t = ev.target.closest(".ch-hit"); if (t) showDay(+t.dataset.day); });
  $("prevMonth").addEventListener("click", function () { shiftMonth(-1); });
  $("nextMonth").addEventListener("click", function () { shiftMonth(1); });
  $("thisMonth").addEventListener("click", function () { viewY = today[0]; viewM = today[1]; shiftMonth(0); });

  /** Redraw the chart from the given entries (amounts in Rial). */
  D.drawMonthChart = function (list) { entries = list || []; render(); };
})();
