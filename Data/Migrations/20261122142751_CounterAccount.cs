using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Daftar.Data.Migrations
{
    /// <inheritdoc />
    public partial class CounterAccount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "counter_account_id",
                table: "journal_entries",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_journal_entries_counter_account_id",
                table: "journal_entries",
                column: "counter_account_id");

            migrationBuilder.AddForeignKey(
                name: "FK_journal_entries_accounts_counter_account_id",
                table: "journal_entries",
                column: "counter_account_id",
                principalTable: "accounts",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_journal_entries_accounts_counter_account_id",
                table: "journal_entries");

            migrationBuilder.DropIndex(
                name: "IX_journal_entries_counter_account_id",
                table: "journal_entries");

            migrationBuilder.DropColumn(
                name: "counter_account_id",
                table: "journal_entries");
        }
    }
}
