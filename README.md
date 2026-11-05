# دفتر روزنامه شخصی

برنامه‌ی تحت وب برای ثبت خرج و دخل روزانه به سبک دفتر روزنامه، با ASP.NET Core 8 و PostgreSQL.

- هر سند: تاریخ شمسی، حساب (با کد)، بدهکار، بستانکار، روش پرداخت، توضیحات
- ورود مبالغ به تومان و گزارش به ریال (هر دو از «تنظیمات» قابل تغییر)
- گزارش بر اساس بازه‌ی تاریخ و کد یا نام حساب، با مانده‌ی هر حساب بعد از هر سند و جمع کل
- صفحه‌های جدا: ثبت سند (`/`)، گزارش (`/report`)، حساب‌ها (`/accounts`)، تنظیمات (`/settings`)
- نمودار میله‌ای روزانه‌ی ماه (بدهکار و بستانکار کنار هم) بالای صفحه‌ی گزارش، با جابه‌جایی بین ماه‌ها
- هر حساب یک کد عددی دارد؛ در فرم ثبت، با تایپ کد (مثلاً 101) حساب فوراً انتخاب می‌شود
- هر حساب می‌تواند زیرحساب داشته باشد. کد زیرحساب خودکار از کد والد ساخته می‌شود-  (102 ← 10201) و در گزارش، جمع حساب والد و سهم هر زیرحساب جدا نمایش داده می‌شود
- پورت برنامه از «تنظیمات» داخل برنامه عوض می‌شود تا چند برنامه روی یک VPS کنار هم اجرا شوند
- ورود امن: رمز با PBKDF2 هش می‌شود، بعد از ۵ تلاش ناموفق حساب ۱۵ دقیقه قفل می‌شود، و هر IP حداکثر ۵ تلاش در دقیقه دارد

مبالغ همیشه به **ریال** در دیتابیس ذخیره می‌شوند، پس عوض کردن واحد ورود یا گزارش روی سندهای قبلی اثری ندارد.

---

## نصب سریع روی اوبونتو (22.04 یا 24.04)

فایل zip را روی سرور کپی کنید، سپس:

```bash
sudo apt install -y unzip
unzip -o daftar.zip && cd daftar
sudo bash deploy/install.sh
```

اسکریپت این کارها را انجام می‌دهد:

1. نصب ASP.NET Core Runtime 8 و PostgreSQL
2. ساخت کاربر سیستمی `daftar` و دیتابیس `daftar` با رمز تصادفی (در `/etc/daftar/daftar.env`)
3. کپی برنامه در `/opt/daftar` و پرسیدن پورت (پیش‌فرض 5080)
4. ساخت کاربر ورود `admin`؛ رمز را از شما می‌پرسد (حداقل ۱۰ کاراکتر، شامل حرف و عدد)
5. نصب و اجرای سرویس systemd به نام `daftar` و باز کردن پورت در ufw (اگر فعال باشد)

بعد از آن برنامه در `http://IP-سرور:5080` در دسترس است.

**به‌روزرسانی:** نسخه‌ی جدید را استخراج کنید و همان `sudo bash deploy/install.sh` را اجرا کنید. دیتابیس و تنظیمات دست نمی‌خورند.

---

## به‌روزرسانی خودکار از GitHub (پیشنهادی)

کد در مخزن [davobag/Daftar](https://github.com/davobag/Daftar) است. یک بار روی سرور:

```bash
sudo apt install -y git
sudo git clone https://github.com/davobag/Daftar.git /opt/daftar-src
sudo bash /opt/daftar-src/deploy/update.sh --force
```

از این به بعد برای گرفتن نسخه‌ی جدید فقط کافی است:

```bash
sudo daftar-update
```

این دستور آخرین تغییرات را از GitHub می‌گیرد، فهرستشان را نشان می‌دهد، برنامه را روی سرور می‌سازد و دوباره راه‌اندازی می‌کند. دیتابیس و تنظیمات دست نمی‌خورند.

<details>
<summary>اگر مخزن را خصوصی کردید</summary>

سرور برای دسترسی به مخزن خصوصی یک کلید فقط‌خواندنی لازم دارد:

```bash
sudo ssh-keygen -t ed25519 -N "" -f /root/.ssh/daftar_deploy
sudo cat /root/.ssh/daftar_deploy.pub      # در GitHub: Settings ← Deploy keys ← Add deploy key
sudo git -C /opt/daftar-src remote set-url origin git@github.com:davobag/Daftar.git
sudo git -C /opt/daftar-src config core.sshCommand "ssh -i /root/.ssh/daftar_deploy -o StrictHostKeyChecking=accept-new"
```
</details>

## دستورهای مفید

```bash
sudo systemctl status daftar          # وضعیت
sudo journalctl -u daftar -f          # لاگ‌ها (تلاش‌های ناموفق ورود هم اینجا ثبت می‌شوند)
sudo systemctl restart daftar         # راه‌اندازی مجدد

# ساخت کاربر جدید یا تغییر رمز
sudo daftar-user set-password davoud

# باز کردن قفل ورود بعد از تلاش‌های ناموفق
sudo daftar-user unlock davoud
```

## تغییر پورت

از دکمه‌ی «تنظیمات» داخل برنامه پورت جدید را وارد کنید. برنامه چند ثانیه بعد خودش روی پورت جدید بالا می‌آید (systemd آن را دوباره اجرا می‌کند) و صفحه به آدرس جدید می‌رود.

- اگر ufw فعال است، پورت جدید را باز کنید: `sudo ufw allow 5090/tcp`
- همین تنظیم در فایل `/opt/daftar/settings.json` هم هست و می‌شود دستی ویرایش کرد (بعدش `sudo systemctl restart daftar`).

## امنیت بیشتر: HTTPS با nginx (توصیه‌شده)

بدون HTTPS، رمز ورود روی اینترنت رمزنگاری نمی‌شود. اگر دامنه دارید:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx-daftar.conf /etc/nginx/sites-available/daftar
sudo nano /etc/nginx/sites-available/daftar      # دامنه و پورت را تنظیم کنید
sudo ln -s /etc/nginx/sites-available/daftar /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d daftar.example.com       # گواهی رایگان Let's Encrypt
```

سپس در «تنظیمات» برنامه، «دسترسی» را روی **فقط از طریق nginx** بگذارید تا پورت برنامه از بیرون بسته شود و فقط `https://daftar.example.com` کار کند. پورت را هم از فایروال ببندید: `sudo ufw delete allow 5080/tcp`.

## پشتیبان‌گیری

```bash
sudo cp deploy/backup.sh /usr/local/bin/daftar-backup && sudo chmod +x /usr/local/bin/daftar-backup
echo "30 3 * * * root /usr/local/bin/daftar-backup" | sudo tee /etc/cron.d/daftar-backup
```

هر شب ساعت ۳:۳۰ یک نسخه در `/var/backups/daftar` ذخیره می‌شود و نسخه‌های قدیمی‌تر از ۳۰ روز پاک می‌شوند.
بازگردانی: `sudo -u postgres pg_restore --clean -d daftar /var/backups/daftar/daftar-2026-11-04.dump`

---

## ساختار کد (برای توسعه)

| مسیر | کار |
|---|---|
| `Program.cs` | راه‌اندازی، احراز هویت، محدودیت تلاش ورود |
| `Models/` | موجودیت‌ها: `Account` (حساب با کد)، `JournalEntry` (سند)، `AppUser` |
| `Data/AppDbContext.cs` و `Data/Migrations/` | EF Core و مایگریشن‌های PostgreSQL؛ هنگام اجرا خودکار اعمال می‌شوند |
| `Endpoints/` | API ها: `/api/accounts`، `/api/entries`، `/api/settings`، `/api/login` |
| `Settings/AppSettings.cs` | پورت و واحد پول (فایل `settings.json`) |
| `Cli/UserCommands.cs` | دستورهای `set-password` و `unlock` |
| `wwwroot/` | رابط کاربری فارسی (HTML/CSS/JS ساده، بدون کتابخانه‌ی خارجی): `index.html` ثبت سند، `report.html` گزارش و نمودار، `accounts.html` حساب‌ها، `settings.html` تنظیمات؛ کد مشترک در `js/common.js`؛ فونت وزیرمتن داخل `fonts/` |

افزودن جدول یا فیلد جدید:

```bash
dotnet tool install --global dotnet-ef --version 8.0.10
dotnet ef migrations add NameOfChange -o Data/Migrations
```

اجرای محلی برای توسعه:

```bash
export ConnectionStrings__Default="Host=localhost;Database=daftar;Username=daftar;Password=..."
dotnet run -- set-password admin
dotnet run
```

ساخت بسته‌ی انتشار: `dotnet publish -c Release -o publish`
