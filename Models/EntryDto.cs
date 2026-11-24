using System.Text.RegularExpressions;

namespace Daftar.Models;

/// <summary>داده‌ای که فرم برای ثبت یا ویرایش سند می‌فرستد. مبالغ به ریال.</summary>
public record EntryInput(string? Date, int AccountId, long Debit, long Credit, string? PaymentMethod, string? Description, int? CounterAccountId = null,
    int? DetailId = null, int? CounterDetailId = null)
{
    private static readonly Regex DateRx = new(@"^(\d{4})/(\d{2})/(\d{2})$", RegexOptions.Compiled);

    public static readonly string[] Methods =
        ["نقدی", "کارت به کارت", "کارتخوان", "انتقال بانکی (پایا/ساتنا)", "چک", "سایر"];

    public Dictionary<string, string[]> Validate()
    {
        var errors = new Dictionary<string, string[]>();
        var m = DateRx.Match(Date ?? "");
        if (!m.Success)
            errors["date"] = ["تاریخ باید به شکل 1405/08/13 باشد."];
        else
        {
            int mo = int.Parse(m.Groups[2].Value), d = int.Parse(m.Groups[3].Value);
            if (mo < 1 || mo > 12 || d < 1 || d > (mo <= 6 ? 31 : 30))
                errors["date"] = ["تاریخ معتبر نیست."];
        }
        if (AccountId <= 0) errors["accountId"] = ["حساب را انتخاب کنید."];
        else if (CounterAccountId == AccountId) errors["counterAccountId"] = ["حساب متقابل نمی‌تواند همان حساب سند باشد."];
        if (Debit < 0 || Credit < 0) errors["amount"] = ["مبلغ نمی‌تواند منفی باشد."];
        else if (Debit == 0 && Credit == 0) errors["amount"] = ["یکی از مبالغ بدهکار یا بستانکار را وارد کنید."];
        if (!Methods.Contains(PaymentMethod)) errors["paymentMethod"] = ["روش پرداخت معتبر نیست."];
        if ((Description?.Length ?? 0) > 2000) errors["description"] = ["توضیحات خیلی بلند است."];
        return errors;
    }

    public void ApplyTo(JournalEntry e)
    {
        e.Date = Date!;
        e.AccountId = AccountId;
        e.CounterAccountId = CounterAccountId is > 0 ? CounterAccountId : null;
        e.DetailId = DetailId is > 0 ? DetailId : null;
        e.CounterDetailId = e.CounterAccountId is not null && CounterDetailId is > 0 ? CounterDetailId : null;
        e.Debit = Debit;
        e.Credit = Credit;
        e.PaymentMethod = PaymentMethod!;
        e.Description = string.IsNullOrWhiteSpace(Description) ? null : Description.Trim();
    }
}

/// <summary>ساخت یا ویرایش حساب. اگر کد خالی باشد، کد بعدی خودکار داده می‌شود (زیرحساب‌های 101 می‌شوند 10101، 10102 و ...).</summary>
public record AccountInput(int? Code, string? Name, int? ParentId)
{
    /// <summary>یکسان‌سازی «ی» و «ک» عربی و فاصله‌ها تا یک حساب دو بار ساخته نشود.</summary>
    public static string NormalizeName(string s) =>
        Regex.Replace(s.Trim(), @"\s+", " ").Replace('ي', 'ی').Replace('ك', 'ک');
}

public record EntryView(long Id, string Date, int AccountId, int AccountCode, string AccountName,
    long Debit, long Credit, string PaymentMethod, string? Description, DateTime CreatedAt, int? CounterAccountId,
    int? DetailId, int? CounterDetailId);

/// <summary>اختصاص یک حساب متقابل به چند سند با هم (null یعنی برداشتن حساب متقابل).</summary>
public record CounterInput(long[]? Ids, int? CounterAccountId);

/// <summary>اختصاص یک تفصیلی به چند سند با هم. Side: "account" (طرف حساب) یا "counter" (طرف متقابل). null یعنی برداشتن.</summary>
public record DetailAssignInput(long[]? Ids, int? DetailId, string? Side);
