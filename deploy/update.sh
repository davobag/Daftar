#!/usr/bin/env bash
# به‌روزرسانی دفتر روزنامه از GitHub:  sudo daftar-update
# آخرین نسخه را از مخزن می‌گیرد، روی سرور می‌سازد و نصب می‌کند. اطلاعات و تنظیمات دست نمی‌خورند.
set -euo pipefail
SRC=/opt/daftar-src

if [[ $EUID -ne 0 ]]; then echo "با sudo اجرا کنید: sudo daftar-update"; exit 1; fi
if [[ ! -d $SRC/.git ]]; then
  echo "کد برنامه در $SRC نیست. یک بار طبق README مخزن را clone کنید."; exit 1
fi

if ! command -v git >/dev/null || ! dotnet --list-sdks 2>/dev/null | grep -q '^8\.'; then
  echo "==> نصب git و .NET SDK 8 (فقط بار اول)"
  apt-get update -qq </dev/null
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git dotnet-sdk-8.0 >/dev/null </dev/null
fi

echo "==> دریافت آخرین نسخه"
OLD=$(git -C "$SRC" rev-parse --short HEAD)
git -C "$SRC" pull --ff-only
NEW=$(git -C "$SRC" rev-parse --short HEAD)
if [[ "$OLD" == "$NEW" && "${1:-}" != "--force" && -f /opt/daftar/Daftar.dll ]]; then
  echo "برنامه به‌روز است ($NEW). برای نصب دوباره: sudo daftar-update --force"; exit 0
fi
git -C "$SRC" log --oneline "$OLD..$NEW" 2>/dev/null | sed 's/^/   /' || true

echo "==> ساخت برنامه"
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1
rm -rf "$SRC/publish"
dotnet publish "$SRC/Daftar.csproj" -c Release -o "$SRC/publish" --nologo -v quiet

echo "==> نصب"
bash "$SRC/deploy/install.sh"
