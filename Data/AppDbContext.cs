using Daftar.Models;
using Microsoft.EntityFrameworkCore;

namespace Daftar.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<AppUser> Users => Set<AppUser>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<JournalEntry>(e =>
        {
            e.ToTable("journal_entries");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Date).HasColumnName("date").HasMaxLength(10).IsRequired();
            e.Property(x => x.AccountId).HasColumnName("account_id");
            e.HasOne(x => x.Account).WithMany(a => a.Entries).HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.Debit).HasColumnName("debit");
            e.Property(x => x.Credit).HasColumnName("credit");
            e.Property(x => x.PaymentMethod).HasColumnName("payment_method").HasMaxLength(50).IsRequired();
            e.Property(x => x.Description).HasColumnName("description").HasMaxLength(2000);
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.HasIndex(x => x.Date);
            e.ToTable(t => t.HasCheckConstraint("ck_amounts", "debit >= 0 AND credit >= 0"));
        });

        b.Entity<Account>(e =>
        {
            e.ToTable("accounts");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Code).HasColumnName("code");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.ParentId).HasColumnName("parent_id");
            e.HasOne(x => x.Parent).WithMany(x => x.Children).HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.Restrict);
            // نام فقط زیر یک والد یکتاست (مثلاً «کاغذ» هم زیر باسکول و هم زیر خانه مجاز است)؛ در کد بررسی می‌شود
            e.HasIndex(x => new { x.ParentId, x.Name });
            e.ToTable(t => t.HasCheckConstraint("ck_account_code", "code > 0"));
        });

        b.Entity<AppUser>(e =>
        {
            e.ToTable("users");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Username).HasColumnName("username").HasMaxLength(100).IsRequired();
            e.Property(x => x.PasswordHash).HasColumnName("password_hash").IsRequired();
            e.Property(x => x.FailedAttempts).HasColumnName("failed_attempts");
            e.Property(x => x.LockedUntil).HasColumnName("locked_until");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
            e.HasIndex(x => x.Username).IsUnique();
        });
    }
}
