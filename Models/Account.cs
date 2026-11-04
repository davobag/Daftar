namespace Daftar.Models;

/// <summary>حساب یا شخص. هر حساب یک کد عددی یکتا دارد که برای انتخاب سریع تایپ می‌شود.</summary>
public class Account
{
    public int Id { get; set; }
    public int Code { get; set; }
    public string Name { get; set; } = "";
    /// <summary>حساب والد (برای زیرحساب‌ها، مثلاً «باسکول» برای «خرید کاغذ»). null یعنی حساب اصلی.</summary>
    public int? ParentId { get; set; }
    public Account? Parent { get; set; }
    public List<Account> Children { get; set; } = [];

    public DateTime CreatedAt { get; set; }
    public List<JournalEntry> Entries { get; set; } = [];
}
