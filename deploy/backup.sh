#!/usr/bin/env bash
# پشتیبان روزانه دیتابیس. نصب در cron:
#   sudo cp deploy/backup.sh /usr/local/bin/daftar-backup && sudo chmod +x /usr/local/bin/daftar-backup
#   echo "30 3 * * * root /usr/local/bin/daftar-backup" | sudo tee /etc/cron.d/daftar-backup
set -euo pipefail
DIR=/var/backups/daftar
mkdir -p "$DIR"
sudo -u postgres pg_dump -Fc daftar > "$DIR/daftar-$(date +%F).dump"
find "$DIR" -name 'daftar-*.dump' -mtime +30 -delete
