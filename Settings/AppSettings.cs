using System.Text.Json;
using System.Text.Json.Nodes;

namespace Daftar.Settings;

/// <summary>تنظیماتی که از داخل برنامه قابل تغییرند و در فایل settings.json کنار برنامه ذخیره می‌شوند.</summary>
public class AppSettings
{
    public const string FileName = "settings.json";

    /// <summary>پورتی که برنامه روی آن اجرا می‌شود. تغییرش با راه‌اندازی مجدد اعمال می‌شود.</summary>
    public int Port { get; set; } = 5080;

    /// <summary>آدرسی که برنامه روی آن گوش می‌دهد: 0.0.0.0 برای دسترسی مستقیم، 127.0.0.1 وقتی پشت nginx است.</summary>
    public string BindAddress { get; set; } = "0.0.0.0";

    /// <summary>واحد ورود مبالغ: Toman یا Rial.</summary>
    public string InputCurrency { get; set; } = "Toman";

    /// <summary>واحد نمایش گزارش‌ها: Toman یا Rial.</summary>
    public string ReportCurrency { get; set; } = "Rial";

    public static readonly string[] Currencies = ["Toman", "Rial"];

    public static AppSettings Load(string contentRoot)
    {
        var path = Path.Combine(contentRoot, FileName);
        if (!File.Exists(path)) return new AppSettings();
        var root = JsonNode.Parse(File.ReadAllText(path));
        return root?["App"]?.Deserialize<AppSettings>() ?? new AppSettings();
    }

    public void Save(string contentRoot)
    {
        var path = Path.Combine(contentRoot, FileName);
        var json = JsonSerializer.Serialize(new { App = this }, new JsonSerializerOptions { WriteIndented = true });
        var tmp = path + ".tmp";
        File.WriteAllText(tmp, json);
        File.Move(tmp, path, overwrite: true);
    }

    public Dictionary<string, string[]> Validate()
    {
        var e = new Dictionary<string, string[]>();
        if (Port < 1024 || Port > 65535) e["port"] = ["پورت باید بین 1024 و 65535 باشد."];
        if (BindAddress is not ("0.0.0.0" or "127.0.0.1")) e["bindAddress"] = ["آدرس باید 0.0.0.0 یا 127.0.0.1 باشد."];
        if (!Currencies.Contains(InputCurrency)) e["inputCurrency"] = ["واحد ورود معتبر نیست."];
        if (!Currencies.Contains(ReportCurrency)) e["reportCurrency"] = ["واحد گزارش معتبر نیست."];
        return e;
    }
}
