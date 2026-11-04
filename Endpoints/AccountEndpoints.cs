using Daftar.Data;
using Daftar.Models;
using Microsoft.EntityFrameworkCore;

namespace Daftar.Endpoints;

public static class AccountEndpoints
{
    private const int MaxCode = 99_999_999;

    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/accounts").RequireAuthorization();

        g.MapGet("/", async (AppDbContext db) =>
            await db.Accounts.AsNoTracking().OrderBy(a => a.Code)
                .Select(a => new { a.Id, a.Code, a.Name, a.ParentId, EntryCount = a.Entries.Count })
                .ToListAsync());

        g.MapPost("/", async (AccountInput input, AppDbContext db) =>
        {
            var name = AccountInput.NormalizeName(input.Name ?? "");
            var code = input.Code ?? await NextCode(db, input.ParentId);
            var err = await Check(db, null, code, name, input.ParentId);
            if (err is not null) return err;
            var a = new Account { Code = code, Name = name, ParentId = input.ParentId, CreatedAt = DateTime.UtcNow };
            db.Accounts.Add(a);
            await db.SaveChangesAsync();
            return Results.Created($"/api/accounts/{a.Id}", new { a.Id, a.Code, a.Name, a.ParentId, EntryCount = 0 });
        });

        g.MapPut("/{id:int}", async (int id, AccountInput input, AppDbContext db) =>
        {
            var a = await db.Accounts.FindAsync(id);
            if (a is null) return Results.NotFound();
            var name = AccountInput.NormalizeName(input.Name ?? "");
            var code = input.Code ?? a.Code;
            var err = await Check(db, id, code, name, input.ParentId);
            if (err is not null) return err;
            a.Code = code; a.Name = name; a.ParentId = input.ParentId;
            await db.SaveChangesAsync();
            return Results.Ok(new { a.Id, a.Code, a.Name, a.ParentId, EntryCount = await db.JournalEntries.CountAsync(e => e.AccountId == id) });
        });

        g.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
        {
            if (await db.JournalEntries.AnyAsync(e => e.AccountId == id))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["account"] = ["این حساب سند دارد و حذف نمی‌شود."] });
            if (await db.Accounts.AnyAsync(a => a.ParentId == id))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["account"] = ["این حساب زیرحساب دارد؛ اول زیرحساب‌ها را حذف یا جابه‌جا کنید."] });
            var n = await db.Accounts.Where(a => a.Id == id).ExecuteDeleteAsync();
            return n == 0 ? Results.NotFound() : Results.NoContent();
        });
    }

    /// <summary>کد بعدی: برای حساب اصلی max+1، برای زیرحساب کد والد + دو رقم (101 → 10101، 10102 ...).</summary>
    private static async Task<int> NextCode(AppDbContext db, int? parentId)
    {
        if (parentId is { } pid && await db.Accounts.FindAsync(pid) is { } parent && parent.Code <= MaxCode / 100)
        {
            int lo = parent.Code * 100 + 1, hi = parent.Code * 100 + 99;
            var used = await db.Accounts.Where(a => a.Code >= lo && a.Code <= hi).Select(a => a.Code).ToListAsync();
            for (var c = lo; c <= hi; c++) if (!used.Contains(c)) return c;
        }
        // حساب اصلی: بزرگ‌ترین کد سه‌رقمی (یا هر کد زیر 1000) + 1
        var maxTop = await db.Accounts.Where(a => a.ParentId == null).MaxAsync(a => (int?)a.Code);
        var next = (maxTop ?? 100) + 1;
        while (await db.Accounts.AnyAsync(a => a.Code == next)) next++;
        return next;
    }

    private static async Task<IResult?> Check(AppDbContext db, int? id, int code, string name, int? parentId)
    {
        var errors = new Dictionary<string, string[]>();
        if (code <= 0 || code > MaxCode) errors["code"] = ["کد حساب باید عددی مثبت باشد."];
        if (name.Length == 0) errors["name"] = ["نام حساب لازم است."];
        else if (name.Length > 200) errors["name"] = ["نام حساب خیلی بلند است."];

        if (parentId is { } pid)
        {
            if (!await db.Accounts.AnyAsync(a => a.Id == pid)) errors["parentId"] = ["حساب والد پیدا نشد."];
            else if (id is not null)
            {
                // جلوگیری از حلقه: والد نباید خود حساب یا یکی از زیرحساب‌هایش باشد
                var parents = await db.Accounts.AsNoTracking().ToDictionaryAsync(a => a.Id, a => a.ParentId);
                for (int? cur = pid; cur is not null; cur = parents.GetValueOrDefault(cur.Value))
                    if (cur == id) { errors["parentId"] = ["حساب نمی‌تواند زیرمجموعه‌ی خودش یا زیرحساب‌هایش باشد."]; break; }
            }
        }

        if (errors.Count == 0)
        {
            if (await db.Accounts.AnyAsync(a => a.Code == code && a.Id != id))
                errors["code"] = [$"کد {code} قبلاً برای حساب دیگری ثبت شده."];
            if (await db.Accounts.AnyAsync(a => a.Name == name && a.ParentId == parentId && a.Id != id))
                errors["name"] = ["حسابی با همین نام در همین سطح وجود دارد."];
        }
        return errors.Count > 0 ? Results.ValidationProblem(errors) : null;
    }
}
