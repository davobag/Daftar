namespace Daftar.Models;

/// <summary>حساب تفصیلی شناور: شخص، پروژه یا مرکز هزینه (مثلاً «رضا» یا «باسکول»).
/// به هیچ حساب کل/معینی بسته نیست و روی هر سندی می‌نشیند، پس «رضا» هم با «حقوق» می‌آید هم با «مساعده».</summary>
public class Detail
{
    public int Id { get; set; }
    public int Code { get; set; }
    public string Name { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}
