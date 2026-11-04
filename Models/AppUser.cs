namespace Daftar.Models;

/// <summary>کاربر برنامه. رمز فقط به صورت هش (PBKDF2) ذخیره می‌شود.</summary>
public class AppUser
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";

    /// <summary>تعداد تلاش ناموفق پشت سر هم.</summary>
    public int FailedAttempts { get; set; }

    /// <summary>تا این زمان (UTC) ورود این کاربر قفل است.</summary>
    public DateTime? LockedUntil { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}
