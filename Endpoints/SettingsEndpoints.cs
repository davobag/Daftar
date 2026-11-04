using Daftar.Settings;

namespace Daftar.Endpoints;

public static class SettingsEndpoints
{
    public static void MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/settings").RequireAuthorization();

        g.MapGet("/", (IWebHostEnvironment env, RunningInfo running) =>
            Results.Ok(new { settings = AppSettings.Load(env.ContentRootPath), runningPort = running.Port }));

        g.MapPut("/", (AppSettings input, IWebHostEnvironment env, RunningInfo running, IHostApplicationLifetime life) =>
        {
            var errors = input.Validate();
            if (errors.Count > 0) return Results.ValidationProblem(errors);
            input.Save(env.ContentRootPath);

            var restart = input.Port != running.Port || input.BindAddress != running.BindAddress;
            if (restart)
            {
                // برنامه متوقف می‌شود و systemd (Restart=always) آن را روی پورت جدید بالا می‌آورد.
                _ = Task.Run(async () => { await Task.Delay(1500); life.StopApplication(); });
            }
            return Results.Ok(new { settings = input, restarting = restart });
        });
    }
}

/// <summary>پورت و آدرسی که این اجرا واقعاً روی آن بالا آمده.</summary>
public record RunningInfo(int Port, string BindAddress);
