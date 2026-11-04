#!/usr/bin/env bash
# نصب یا به‌روزرسانی «دفتر روزنامه» روی اوبونتو 22.04 / 24.04
# اجرا از داخل پوشه‌ی استخراج‌شده:  sudo bash deploy/install.sh
set -euo pipefail

APP_DIR=/opt/daftar
ENV_DIR=/etc/daftar
ENV_FILE=$ENV_DIR/daftar.env
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLISH_DIR="$SRC_DIR/publish"

if [[ $EUID -ne 0 ]]; then echo "این اسکریپت را با sudo اجرا کنید."; exit 1; fi
if [[ ! -f "$PUBLISH_DIR/Daftar.dll" ]]; then echo "پوشه publish پیدا نشد: $PUBLISH_DIR"; exit 1; fi

echo "==> نصب پیش‌نیازها (ASP.NET Core 8 و PostgreSQL)"
apt-get update -qq </dev/null
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq aspnetcore-runtime-8.0 postgresql rsync >/dev/null </dev/null

if ! id daftar &>/dev/null; then
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin daftar
fi
mkdir -p "$APP_DIR" "$ENV_DIR"

FIRST_INSTALL=0
if [[ ! -f "$ENV_FILE" ]]; then
  FIRST_INSTALL=1
  echo "==> ساخت دیتابیس PostgreSQL"
  DB_PASS="$(openssl rand -hex 24)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'daftar') THEN
    CREATE ROLE daftar LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE daftar WITH PASSWORD '$DB_PASS';
  END IF;
END \$\$;
SQL
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='daftar'" | grep -q 1 \
    || sudo -u postgres createdb -O daftar daftar
  # پورت واقعی PostgreSQL نصب‌شده (اگر 5432 دست برنامه دیگری باشد، معمولاً 5433 است)
  PG_PORT="$(sudo -u postgres psql -tAc 'SHOW port' | tr -d '[:space:]')"
  # مقدار داخل کوتیشن است تا هم systemd و هم bash (source) آن را درست بخوانند
  echo "ConnectionStrings__Default=\"Host=localhost;Port=$PG_PORT;Database=daftar;Username=daftar;Password=$DB_PASS\"" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

echo "==> کپی فایل‌های برنامه به $APP_DIR"
systemctl stop daftar 2>/dev/null || true
rsync -a --delete --exclude settings.json --exclude keys/ "$PUBLISH_DIR/" "$APP_DIR/"

if [[ ! -f "$APP_DIR/settings.json" ]]; then
  read -rp "پورت برنامه [5080]: " PORT; PORT=${PORT:-5080}
  cat > "$APP_DIR/settings.json" <<JSON
{
  "App": {
    "Port": $PORT,
    "BindAddress": "0.0.0.0",
    "InputCurrency": "Toman",
    "ReportCurrency": "Rial"
  }
}
JSON
fi
chown -R daftar:daftar "$APP_DIR"

cp "$SRC_DIR/deploy/daftar.service" /etc/systemd/system/daftar.service
install -m 755 "$SRC_DIR/deploy/daftar-user" /usr/local/bin/daftar-user
install -m 755 "$SRC_DIR/deploy/update.sh" /usr/local/bin/daftar-update
systemctl daemon-reload

if [[ $FIRST_INSTALL -eq 1 ]]; then
  echo "==> ساخت کاربر ورود (admin)"
  for try in 1 2 3; do
    /usr/local/bin/daftar-user set-password admin && break
    [[ $try -eq 3 ]] && { echo "رمز ساخته نشد. بعداً با دستور set-password در README بسازید."; break; }
    echo "دوباره امتحان کنید."
  done
fi

systemctl enable --now daftar
PORT=$(grep -oP '"Port":\s*\K\d+' "$APP_DIR/settings.json")
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow "$PORT"/tcp >/dev/null && echo "==> پورت $PORT در فایروال باز شد"
fi
sleep 2
systemctl --no-pager --lines=0 status daftar || true
echo
echo "تمام شد. آدرس برنامه: http://<IP-سرور>:$PORT"
