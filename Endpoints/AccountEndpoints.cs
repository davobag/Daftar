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

        // تبدیل یک معین (زیرحسابِ بدون زیرمجموعه) به تفصیلی شناور:
        // سندهایش به حساب بالاتر می‌روند و تفصیلی‌شان همین نام می‌شود، بعد خود حساب حذف می‌شود.
        g.MapPost("/{id:int}/to-detail", async (int id, AppDbContext db) =>
        {
            var a = await db.Accounts.FindAsync(id);
            if (a is null) return Results.NotFound();
            IResult Bad(string m) => Results.ValidationProblem(new Dictionary<string, string[]> { ["account"] = [m] });
            if (a.ParentId is not int parentId) return Bad("فقط زیرحساب (معین) به تفصیلی تبدیل می‌شود، نه حساب کل.");
            if (await db.Accounts.AnyAsync(x => x.ParentId == id)) return Bad("این حساب خودش زیرحساب دارد؛ اول آن‌ها را تبدیل یا جابه‌جا کنید.");

            await using var tx = await db.Database.BeginTransactionAsync();
            var d = await db.Details.FirstOrDefaultAsync(x => x.Name == a.Name);
            if (d is null)
            {
                var code = Math.Max(1001, (await db.Details.MaxAsync(x => (int?)x.Code) ?? 0) + 1);
                d = new Detail { Code = code, Name = a.Name, CreatedAt = DateTime.UtcNow };
                db.Details.Add(d);
                await db.SaveChangesAsync();
            }
            var did = d.Id;
            if (await db.JournalEntries.AnyAsync(e => (e.AccountId == id && e.DetailId != null && e.DetailId != did)
                                                   || (e.CounterAccountId == id && e.CounterDetailId != null && e.CounterDetailId != did)))
                return Bad("بعضی سندهای این حساب تفصیلی دیگری دارند؛ اول آن را بردارید.");
            if (await db.JournalEntries.AnyAsync(e => (e.AccountId == id && e.CounterAccountId == parentId) || (e.CounterAccountId == id && e.AccountId == parentId)))
                return Bad("بعضی سندها بین این حساب و حساب بالاترش هستند و بعد از تبدیل دو طرفشان یکی می‌شود.");

            var n1 = await db.JournalEntries.Where(e => e.AccountId == id)
                .ExecuteUpdateAsync(u => u.SetProperty(e => e.AccountId, parentId).SetProperty(e => e.DetailId, did).SetProperty(e => e.UpdatedAt, DateTime.UtcNow));
            var n2 = await db.JournalEntries.Where(e => e.CounterAccountId == id)
                .ExecuteUpdateAsync(u => u.SetProperty(e => e.CounterAccountId, parentId).SetProperty(e => e.CounterDetailId, did).SetProperty(e => e.UpdatedAt, DateTime.UtcNow));
            await db.Accounts.Where(x => x.Id == id).ExecuteDeleteAsync();
            await tx.CommitAsync();
            return Results.Ok(new { detail = new { d.Id, d.Code, d.Name }, moved = n1 + n2 });
        });

        g.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
        {
            if (await db.JournalEntries.AnyAsync(e => e.AccountId == id || e.CounterAccountId == id))
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
