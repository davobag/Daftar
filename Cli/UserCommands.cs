using Daftar.Data;
using Daftar.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Daftar.Cli;

/// <summary>
/// دستورهای خط فرمان برای مدیریت کاربر:
///   dotnet Daftar.dll set-password &lt;username&gt;   ساخت کاربر یا تغییر رمز
///   dotnet Daftar.dll unlock &lt;username&gt;         باز کردن قفل ورود
/// </summary>
public static class UserCommands
{
    public static bool TryRun(string[] args, IServiceProvider services)
    {
        if (args.Length == 0 || args[0] is not ("set-password" or "unlock")) return false;
        if (args.Length < 2) { Console.Error.WriteLine("نام کاربری را هم بنویسید. مثال: set-password admin"); Environment.ExitCode = 1; return true; }

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.Migrate();
        var name = args[1].Trim().ToLowerInvariant();
        var user = db.Users.FirstOrDefault(u => u.Username == name);

        if (args[0] == "unlock")
        {
            if (user is null) { Console.Error.WriteLine("کاربر پیدا نشد."); Environment.ExitCode = 1; return true; }
            user.FailedAttempts = 0; user.LockedUntil = null; db.SaveChanges();
            Console.WriteLine($"قفل کاربر {name} باز شد.");
            return true;
        }

        var pass = Environment.GetEnvironmentVariable("DAFTAR_NEW_PASSWORD") ?? ReadPassword("رمز جدید: ");
        if (Environment.GetEnvironmentVariable("DAFTAR_NEW_PASSWORD") is null && ReadPassword("تکرار رمز: ") != pass)
        { Console.Error.WriteLine("دو رمز یکی نیستند."); Environment.ExitCode = 1; return true; }
        if (pass.Length < 10 || !pass.Any(char.IsLetter) || !pass.Any(char.IsDigit))
        { Console.Error.WriteLine("رمز باید حداقل ۱۰ کاراکتر و شامل حرف و عدد باشد."); Environment.ExitCode = 1; return true; }

        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<AppUser>>();
        if (user is null)
        {
            user = new AppUser { Username = name, CreatedAt = DateTime.UtcNow };
            db.Users.Add(user);
        }
        user.PasswordHash = hasher.HashPassword(user, pass);
        user.FailedAttempts = 0; user.LockedUntil = null;
        db.SaveChanges();
        Console.WriteLine($"رمز کاربر {name} ذخیره شد.");
        return true;
    }

    private static string ReadPassword(string prompt)
    {
        Console.Write(prompt);
        if (Console.IsInputRedirected) return Console.ReadLine() ?? "";
        var s = new System.Text.StringBuilder();
        while (true)
        {
            var k = Console.ReadKey(intercept: true);
            if (k.Key == ConsoleKey.Enter) break;
            if (k.Key == ConsoleKey.Backspace) { if (s.Length > 0) s.Length--; continue; }
            s.Append(k.KeyChar);
        }
        Console.WriteLine();
        return s.ToString();
    }
}
