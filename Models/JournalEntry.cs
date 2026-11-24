namespace Daftar.Models;

/// <summary>یک سطر از دفتر روزنامه. مبالغ همیشه به ریال ذخیره می‌شوند؛ واحد ورود و نمایش از تنظیمات می‌آید.</summary>
public class JournalEntry
{
    public long Id { get; set; }

    /// <summary>تاریخ شمسی به شکل 1405/08/13 (قابل مرتب‌سازی به صورت متنی).</summary>
    public string Date { get; set; } = "";

    public int AccountId { get; set; }
    public Account Account { get; set; } = null!;

    /// <summary>حساب متقابل (طرف دیگر سند در حسابداری دوبل). اختیاری؛ سندهای قدیمی می‌توانند بدون آن بمانند.
    /// مبلغ بدهکار این سند برای حساب متقابل بستانکار حساب می‌شود و برعکس.</summary>
    public int? CounterAccountId { get; set; }
    public Account? CounterAccount { get; set; }

    /// <summary>تفصیلی شناورِ طرف حساب سند (شخص، پروژه، مرکز هزینه). اختیاری.</summary>
    public int? DetailId { get; set; }
    public Detail? Detail { get; set; }

    /// <summary>تفصیلی شناورِ طرف حساب متقابل. اختیاری و فقط وقتی حساب متقابل دارد.</summary>
    public int? CounterDetailId { get; set; }
    public Detail? CounterDetail { get; set; }

    /// <summary>مبلغ بدهکار به ریال.</summary>
    public long Debit { get; set; }

    /// <summary>مبلغ بستانکار به ریال.</summary>
    public long Credit { get; set; }

    public string PaymentMethod { get; set; } = "";

    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
