#!/usr/bin/env bash
# به‌روزرسانی دفتر روزنامه از GitHub:  sudo daftar-update
# آخرین کد را می‌گیرد، نسخه‌ی آماده‌ی ساخته‌شده در GitHub را دانلود و نصب می‌کند.
# روی سرور به .NET SDK نیازی نیست. اطلاعات و تنظیمات دست نمی‌خورند.
set -euo pipefail
SRC=/opt/daftar-src
REPO=davobag/Daftar
ASSET_URL="https://github.com/$REPO/releases/download/latest/daftar-publish.tar.gz"

if [[ $EUID -ne 0 ]]; then echo "با sudo اجرا کنید: sudo daftar-update"; exit 1; fi
if [[ ! -d $SRC/.git ]]; then
  echo "کد برنامه در $SRC نیست. یک بار طبق README مخزن را clone کنید."; exit 1
fi

echo "==> دریافت آخرین نسخه"
OLD=$(git -C "$SRC" rev-parse HEAD)
git -C "$SRC" pull --ff-only -q
NEW=$(git -C "$SRC" rev-parse HEAD)
if [[ "$OLD" == "$NEW" && "${1:-}" != "--force" && -f /opt/daftar/Daftar.dll ]]; then
  echo "برنامه به‌روز است (${NEW:0:7}). برای نصب دوباره: sudo daftar-update --force"; exit 0
fi
git -C "$SRC" log --oneline "$OLD..$NEW" 2>/dev/null | sed 's/^/   /' || true

TMP=$(mktemp -d); trap 'rm -rf -- "$TMP"' EXIT
echo "==> دانلود نسخه‌ی آماده از GitHub"
if ! curl -fsSL --retry 3 -o "$TMP/app.tar.gz" "$ASSET_URL"; then
  echo "دانلود نشد: $ASSET_URL"; exit 1
fi
mkdir "$TMP/publish"
tar xzf "$TMP/app.tar.gz" -C "$TMP/publish"
BUILT=$(cat "$TMP/publish/COMMIT" 2>/dev/null || echo "")
if [[ "$BUILT" != "$NEW" ]]; then
  echo "نسخه‌ی آماده‌ی آخرین تغییرات هنوز در GitHub ساخته نشده (معمولاً ۲ تا ۳ دقیقه بعد از هر تغییر)."
  echo "چند دقیقه دیگر دوباره بزنید: sudo daftar-update --force"
  exit 1
fi

echo "==> نصب"
rm -rf -- "$SRC/publish"
mv "$TMP/publish" "$SRC/publish"
bash "$SRC/deploy/install.sh"
