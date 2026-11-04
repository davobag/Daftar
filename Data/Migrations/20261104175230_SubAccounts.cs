using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Daftar.Data.Migrations
{
    /// <inheritdoc />
    public partial class SubAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_accounts_name",
                table: "accounts");

            migrationBuilder.AddColumn<int>(
                name: "parent_id",
                table: "accounts",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_accounts_parent_id_name",
                table: "accounts",
                columns: new[] { "parent_id", "name" });

            migrationBuilder.AddForeignKey(
                name: "FK_accounts_accounts_parent_id",
                table: "accounts",
                column: "parent_id",
                principalTable: "accounts",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_accounts_accounts_parent_id",
                table: "accounts");

            migrationBuilder.DropIndex(
                name: "IX_accounts_parent_id_name",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "parent_id",
                table: "accounts");

            migrationBuilder.CreateIndex(
                name: "IX_accounts_name",
                table: "accounts",
                column: "name",
                unique: true);
        }
    }
}
