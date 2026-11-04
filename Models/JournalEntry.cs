namespace Daftar.Models;

/// <summary>یک سطر از دفتر روزنامه. مبالغ همیشه به ریال ذخیره می‌شوند؛ واحد ورود و نمایش از تنظیمات می‌آید.</summary>
public class JournalEntry
{
    public long Id { get; set; }

    /// <summary>تاریخ شمسی به شکل 1405/08/13 (قابل مرتب‌سازی به صورت متنی).</summary>
    public string Date { get; set; } = "";

    public int AccountId { get; set; }
    public Account Account { get; set; } = null!;

    /// <summary>مبلغ بدهکار به ریال.</summary>
    public long Debit { get; set; }

    /// <summary>مبلغ بستانکار به ریال.</summary>
    public long Credit { get; set; }

    public string PaymentMethod { get; set; } = "";

    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
