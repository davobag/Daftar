using Daftar.Data;
using Daftar.Models;
using Microsoft.EntityFrameworkCore;

namespace Daftar.Endpoints;

public record DetailInput(int? Code, string? Name);

public static class DetailEndpoints
{
    /// <summary>کد تفصیلی‌ها از ۱۰۰۱ شروع می‌شود تا با کد حساب‌ها (۱۰۱، ۱۰۲۰۱) اشتباه نشود.</summary>
    private const int FirstCode = 1001;

    public static void MapDetailEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/details").RequireAuthorization();

        g.MapGet("/", async (AppDbContext db) =>
            await db.Details.AsNoTracking().OrderBy(d => d.Code).Select(d => new { d.Id, d.Code, d.Name }).ToListAsync());

        g.MapPost("/", async (DetailInput input, AppDbContext db) =>
        {
            var name = AccountInput.NormalizeName(input.Name ?? "");
            var code = input.Code ?? Math.Max(FirstCode, (await db.Details.MaxAsync(d => (int?)d.Code) ?? 0) + 1);
            var err = await Check(db, null, code, name);
            if (err is not null) return err;
            var d = new Detail { Code = code, Name = name, CreatedAt = DateTime.UtcNow };
            db.Details.Add(d);
            await db.SaveChangesAsync();
            return Results.Created($"/api/details/{d.Id}", new { d.Id, d.Code, d.Name });
        });

        g.MapPut("/{id:int}", async (int id, DetailInput input, AppDbContext db) =>
        {
            var d = await db.Details.FindAsync(id);
            if (d is null) return Results.NotFound();
            var name = AccountInput.NormalizeName(input.Name ?? "");
            var code = input.Code ?? d.Code;
            var err = await Check(db, id, code, name);
            if (err is not null) return err;
            d.Code = code; d.Name = name;
            await db.SaveChangesAsync();
            return Results.Ok(new { d.Id, d.Code, d.Name });
        });

        g.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
        {
            if (await db.JournalEntries.AnyAsync(e => e.DetailId == id || e.CounterDetailId == id))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["detail"] = ["این تفصیلی روی سند استفاده شده و حذف نمی‌شود."] });
            var n = await db.Details.Where(d => d.Id == id).ExecuteDeleteAsync();
            return n == 0 ? Results.NotFound() : Results.NoContent();
        });
    }

    private static async Task<IResult?> Check(AppDbContext db, int? id, int code, string name)
    {
        var errors = new Dictionary<string, string[]>();
        if (name.Length == 0) errors["name"] = ["نام تفصیلی را بنویسید."];
        else if (name.Length > 200) errors["name"] = ["نام خیلی بلند است."];
        else if (await db.Details.AnyAsync(d => d.Name == name && d.Id != id)) errors["name"] = ["تفصیلی‌ای با این نام هست."];
        if (code <= 0) errors["code"] = ["کد باید عدد مثبت باشد."];
        else if (await db.Details.AnyAsync(d => d.Code == code && d.Id != id)) errors["code"] = ["این کد قبلاً استفاده شده."];
        return errors.Count > 0 ? Results.ValidationProblem(errors) : null;
    }
}
