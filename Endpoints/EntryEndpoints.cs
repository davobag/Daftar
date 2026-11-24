using Daftar.Data;
using Daftar.Models;
using Microsoft.EntityFrameworkCore;

namespace Daftar.Endpoints;

public static class EntryEndpoints
{
    public static void MapEntryEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/entries").RequireAuthorization();

        g.MapGet("/", async (AppDbContext db) =>
            await db.JournalEntries.AsNoTracking()
                .OrderBy(e => e.Date).ThenBy(e => e.CreatedAt).ThenBy(e => e.Id)
                .Select(e => new EntryView(e.Id, e.Date, e.AccountId, e.Account.Code, e.Account.Name,
                    e.Debit, e.Credit, e.PaymentMethod, e.Description, e.CreatedAt, e.CounterAccountId, e.DetailId, e.CounterDetailId))
                .ToListAsync());

        g.MapPost("/", async (EntryInput input, AppDbContext db) =>
        {
            var errors = await Validate(input, db);
            if (errors.Count > 0) return Results.ValidationProblem(errors);
            var e = new JournalEntry { CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            input.ApplyTo(e);
            db.JournalEntries.Add(e);
            await db.SaveChangesAsync();
            return Results.Created($"/api/entries/{e.Id}", await View(db, e.Id));
        });

        g.MapPut("/{id:long}", async (long id, EntryInput input, AppDbContext db) =>
        {
            var e = await db.JournalEntries.FindAsync(id);
            if (e is null) return Results.NotFound();
            var errors = await Validate(input, db);
            if (errors.Count > 0) return Results.ValidationProblem(errors);
            input.ApplyTo(e);
            e.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return Results.Ok(await View(db, id));
        });

        // اختصاص گروهی حساب متقابل به سندهای موجود (برای سندهای قبل از حسابداری دوبل)
        g.MapPost("/counter", async (CounterInput input, AppDbContext db) =>
        {
            var ids = input.Ids ?? [];
            if (ids.Length == 0) return Results.ValidationProblem(new Dictionary<string, string[]> { ["ids"] = ["سندی انتخاب نشده."] });
            int? cid = input.CounterAccountId is > 0 ? input.CounterAccountId : null;
            if (cid is not null && !await db.Accounts.AnyAsync(a => a.Id == cid))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["counterAccountId"] = ["حساب متقابل پیدا نشد."] });
            // سندی که حساب خودش همان حساب متقابل است عوض نمی‌شود
            var n = await db.JournalEntries.Where(e => ids.Contains(e.Id) && (cid == null || e.AccountId != cid))
                .ExecuteUpdateAsync(u => u.SetProperty(e => e.CounterAccountId, cid).SetProperty(e => e.UpdatedAt, DateTime.UtcNow));
            return Results.Ok(new { updated = n, skipped = ids.Length - n });
        });

        // اختصاص گروهی تفصیلی به سندهای موجود
        g.MapPost("/detail", async (DetailAssignInput input, AppDbContext db) =>
        {
            var ids = input.Ids ?? [];
            if (ids.Length == 0) return Results.ValidationProblem(new Dictionary<string, string[]> { ["ids"] = ["سندی انتخاب نشده."] });
            int? did = input.DetailId is > 0 ? input.DetailId : null;
            if (did is not null && !await db.Details.AnyAsync(d => d.Id == did))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["detailId"] = ["تفصیلی پیدا نشد."] });
            int n;
            if (input.Side == "counter")
                // طرف متقابل فقط برای سندهایی که حساب متقابل دارند
                n = await db.JournalEntries.Where(e => ids.Contains(e.Id) && e.CounterAccountId != null)
                    .ExecuteUpdateAsync(u => u.SetProperty(e => e.CounterDetailId, did).SetProperty(e => e.UpdatedAt, DateTime.UtcNow));
            else
                n = await db.JournalEntries.Where(e => ids.Contains(e.Id))
                    .ExecuteUpdateAsync(u => u.SetProperty(e => e.DetailId, did).SetProperty(e => e.UpdatedAt, DateTime.UtcNow));
            return Results.Ok(new { updated = n, skipped = ids.Length - n });
        });

        g.MapDelete("/{id:long}", async (long id, AppDbContext db) =>
        {
            var n = await db.JournalEntries.Where(e => e.Id == id).ExecuteDeleteAsync();
            return n == 0 ? Results.NotFound() : Results.NoContent();
        });
    }

    private static async Task<Dictionary<string, string[]>> Validate(EntryInput input, AppDbContext db)
    {
        var errors = input.Validate();
        if (!errors.ContainsKey("accountId") && !await db.Accounts.AnyAsync(a => a.Id == input.AccountId))
            errors["accountId"] = ["حساب پیدا نشد."];
        if (input.CounterAccountId is > 0 && !errors.ContainsKey("counterAccountId") && !await db.Accounts.AnyAsync(a => a.Id == input.CounterAccountId))
            errors["counterAccountId"] = ["حساب متقابل پیدا نشد."];
        foreach (var (key, did) in new[] { ("detailId", input.DetailId), ("counterDetailId", input.CounterDetailId) })
            if (did is > 0 && !await db.Details.AnyAsync(d => d.Id == did))
                errors[key] = ["تفصیلی پیدا نشد."];
        return errors;
    }

    private static Task<EntryView> View(AppDbContext db, long id) =>
        db.JournalEntries.AsNoTracking().Where(e => e.Id == id)
            .Select(e => new EntryView(e.Id, e.Date, e.AccountId, e.Account.Code, e.Account.Name,
                e.Debit, e.Credit, e.PaymentMethod, e.Description, e.CreatedAt, e.CounterAccountId, e.DetailId, e.CounterDetailId))
            .FirstAsync();
}
