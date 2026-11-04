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
                    e.Debit, e.Credit, e.PaymentMethod, e.Description, e.CreatedAt))
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
        return errors;
    }

    private static Task<EntryView> View(AppDbContext db, long id) =>
        db.JournalEntries.AsNoTracking().Where(e => e.Id == id)
            .Select(e => new EntryView(e.Id, e.Date, e.AccountId, e.Account.Code, e.Account.Name,
                e.Debit, e.Credit, e.PaymentMethod, e.Description, e.CreatedAt))
            .FirstAsync();
}
