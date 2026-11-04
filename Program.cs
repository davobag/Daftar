using System.Threading.RateLimiting;
using Daftar.Cli;
using Daftar.Data;
using Daftar.Models;
using Microsoft.AspNetCore.Identity;
using Daftar.Endpoints;
using Daftar.Settings;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// پورت و واحد پول از settings.json خوانده می‌شوند (از داخل برنامه هم قابل تغییرند)
var appSettings = AppSettings.Load(builder.Environment.ContentRootPath);
if (!File.Exists(Path.Combine(builder.Environment.ContentRootPath, AppSettings.FileName)))
    appSettings.Save(builder.Environment.ContentRootPath);
builder.WebHost.UseUrls($"http://{appSettings.BindAddress}:{appSettings.Port}");
builder.Services.AddSingleton(new RunningInfo(appSettings.Port, appSettings.BindAddress));

builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// کلیدهای رمزنگاری کوکی ورود کنار برنامه نگه داشته می‌شوند تا با راه‌اندازی مجدد، کاربر از حساب خارج نشود
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, "keys")))
    .SetApplicationName("Daftar");

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(o =>
    {
        o.Cookie.Name = "daftar.auth";
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Strict;
        o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest; // پشت HTTPS، کوکی فقط روی HTTPS فرستاده می‌شود
        o.ExpireTimeSpan = TimeSpan.FromDays(30);
        o.SlidingExpiration = true;
        // API: به جای ریدایرکت، 401 برگردان
        o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
        o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
    });
builder.Services.AddAuthorization();
builder.Services.AddSingleton<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "x",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
});

var app = builder.Build();

// دستورهای مدیریت کاربر (set-password / unlock) به جای اجرای وب‌سرور
if (UserCommands.TryRun(args, app.Services)) return;

// ساخت/به‌روزرسانی خودکار جدول‌ها هنگام اجرا
using (var scope = app.Services.CreateScope())
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.Migrate();

app.UseForwardedHeaders();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapAccountEndpoints();
app.MapEntryEndpoints();
app.MapSettingsEndpoints();

app.Run();
