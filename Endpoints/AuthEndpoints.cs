using System.Security.Claims;
using Daftar.Data;
using Daftar.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Daftar.Endpoints;

public record LoginInput(string? Username, string? Password);

public static class AuthEndpoints
{
    public const int MaxFailedAttempts = 5;
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/login", async (LoginInput input, HttpContext ctx, AppDbContext db,
            IPasswordHasher<AppUser> hasher, ILogger<LoginInput> log) =>
        {
            var fail = Results.Json(new { error = "نام کاربری یا رمز عبور اشتباه است." }, statusCode: 401);
            if (!await db.Users.AnyAsync())
                return Results.Json(new { error = "هنوز کاربری ساخته نشده. روی سرور دستور ساخت کاربر را اجرا کنید." }, statusCode: 401);

            var name = (input.Username ?? "").Trim().ToLowerInvariant();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Username == name);
            var ip = ctx.Connection.RemoteIpAddress?.ToString();

            if (user is null)
            {
                // برای اینکه از زمان پاسخ نشود فهمید کاربر وجود دارد یا نه، باز هم هش محاسبه می‌شود.
                hasher.VerifyHashedPassword(new AppUser(), DummyHash.Value, input.Password ?? "");
                log.LogWarning("Failed login for unknown user from {Ip}", ip);
                return fail;
            }

            if (user.LockedUntil is { } until && until > DateTime.UtcNow)
            {
                var mins = (int)Math.Ceiling((until - DateTime.UtcNow).TotalMinutes);
                return Results.Json(new { error = $"به خاطر تلاش‌های ناموفق، ورود تا {mins} دقیقه دیگر قفل است." }, statusCode: 423);
            }

            var result = hasher.VerifyHashedPassword(user, user.PasswordHash, input.Password ?? "");
            if (result == PasswordVerificationResult.Failed)
            {
                user.FailedAttempts++;
                if (user.FailedAttempts >= MaxFailedAttempts)
                {
                    user.LockedUntil = DateTime.UtcNow + LockoutDuration;
                    user.FailedAttempts = 0;
                    log.LogWarning("User {User} locked out after failed logins from {Ip}", user.Username, ip);
                }
                await db.SaveChangesAsync();
                log.LogWarning("Failed login for {User} from {Ip}", user.Username, ip);
                return fail;
            }

            if (result == PasswordVerificationResult.SuccessRehashNeeded)
                user.PasswordHash = hasher.HashPassword(user, input.Password!);
            user.FailedAttempts = 0;
            user.LockedUntil = null;
            user.LastLoginAt = DateTime.UtcNow;
            await db.SaveChangesAsync();

            var identity = new ClaimsIdentity(
                [new Claim(ClaimTypes.Name, user.Username), new Claim(ClaimTypes.NameIdentifier, user.Id.ToString())],
                CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(new ClaimsPrincipal(identity), new AuthenticationProperties { IsPersistent = true });
            return Results.Ok(new { user = user.Username });
        }).RequireRateLimiting("login");

        app.MapPost("/api/logout", async (HttpContext ctx) =>
        {
            await ctx.SignOutAsync();
            return Results.NoContent();
        });

        app.MapGet("/api/me", (ClaimsPrincipal u) => Results.Ok(new { user = u.Identity?.Name }))
            .RequireAuthorization();
    }

    private static readonly Lazy<string> DummyHash =
        new(() => new PasswordHasher<AppUser>().HashPassword(new AppUser(), Guid.NewGuid().ToString()));
}
