using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Daftar.Data.Migrations
{
    /// <inheritdoc />
    public partial class FloatingDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "counter_detail_id",
                table: "journal_entries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "detail_id",
                table: "journal_entries",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "details",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    code = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_details", x => x.id);
                    table.CheckConstraint("ck_detail_code", "code > 0");
                });

            migrationBuilder.CreateIndex(
                name: "IX_journal_entries_counter_detail_id",
                table: "journal_entries",
                column: "counter_detail_id");

            migrationBuilder.CreateIndex(
                name: "IX_journal_entries_detail_id",
                table: "journal_entries",
                column: "detail_id");

            migrationBuilder.CreateIndex(
                name: "IX_details_code",
                table: "details",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_details_name",
                table: "details",
                column: "name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_journal_entries_details_counter_detail_id",
                table: "journal_entries",
                column: "counter_detail_id",
                principalTable: "details",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_journal_entries_details_detail_id",
                table: "journal_entries",
                column: "detail_id",
                principalTable: "details",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_journal_entries_details_counter_detail_id",
                table: "journal_entries");

            migrationBuilder.DropForeignKey(
                name: "FK_journal_entries_details_detail_id",
                table: "journal_entries");

            migrationBuilder.DropTable(
                name: "details");

            migrationBuilder.DropIndex(
                name: "IX_journal_entries_counter_detail_id",
                table: "journal_entries");

            migrationBuilder.DropIndex(
                name: "IX_journal_entries_detail_id",
                table: "journal_entries");

            migrationBuilder.DropColumn(
                name: "counter_detail_id",
                table: "journal_entries");

            migrationBuilder.DropColumn(
                name: "detail_id",
                table: "journal_entries");
        }
    }
}
