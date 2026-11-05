/* Settings page: input/report currency, port and access mode. */
(function () {
  "use strict";
  var $ = D.$, toFa = D.toFa, toEn = D.toEn;

  function fill() {
    $("sIn").value = D.cfg.inputCurrency; $("sOut").value = D.cfg.reportCurrency;
    $("sPort").value = toFa(D.cfg.port); $("sBind").value = D.cfg.bindAddress;
  }

  $("settingsForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var err = $("settingsErr"); err.textContent = "";
    var port = parseInt(toEn($("sPort").value), 10);
    if (!(port >= 1024 && port <= 65535)) { err.textContent = "پورت باید عددی بین ۱۰۲۴ و ۶۵۵۳۵ باشد."; return; }
    var body = { port: port, bindAddress: $("sBind").value, inputCurrency: $("sIn").value, reportCurrency: $("sOut").value };
    $("settingsSave").disabled = true;
    D.api("PUT", "/api/settings", body).then(function (r) {
      D.cfg = r.settings;
      $("unitSub").textContent = "ورود مبالغ به " + D.unitName[D.cfg.inputCurrency] + "، گزارش به " + D.unitName[D.cfg.reportCurrency];
      if (r.restarting) {
        var direct = location.port && String(location.port) === String(D.runningPort);
        var url = location.protocol + "//" + location.hostname + ":" + port + "/settings";
        if (direct && body.bindAddress === "0.0.0.0") {
          D.setStatus("در حال راه‌اندازی روی پورت " + toFa(port) + "…", true);
          setTimeout(function () { location.href = url; }, 5000);
        } else {
          D.setStatus("ذخیره شد. برنامه روی پورت " + toFa(port) + " راه‌اندازی مجدد می‌شود؛ اگر پشت nginx است، پورت را در تنظیم nginx هم عوض کنید.", true);
        }
      } else D.setStatus("تنظیمات ذخیره شد.");
    }).catch(function (e) { err.textContent = e.message; })
      .then(function () { $("settingsSave").disabled = false; });
  });

  D.start(function () { fill(); });
})();
