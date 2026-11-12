#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${1:-}"
if [ -z "$BACKUP_DIR" ] || [ "${BACKUP_DIR:0:1}" != "/" ]; then
  echo "Usage: bash scripts/install-systemd-user.sh /absolute/external/backup-folder"
  exit 1
fi
if [ ! -d "$BACKUP_DIR" ]; then
  echo "Backup folder must already exist: $BACKUP_DIR"
  exit 1
fi
if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemd user services are unavailable on this machine."
  exit 1
fi
NODE_BIN="$(command -v node)"
USER_UNITS="$HOME/.config/systemd/user"
mkdir -p "$USER_UNITS"

cat > "$USER_UNITS/bar-restaurant-ticketing.service" <<EOF
[Unit]
Description=BarRestaurantTicketing POS
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
Environment=BAR_TICKETING_DESKTOP_STATIC=1
ExecStartPre=$NODE_BIN $APP_DIR/scripts/check-production-ready.mjs
ExecStart=$NODE_BIN $APP_DIR/scripts/dev-lan.mjs --production
Restart=on-failure
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=default.target
EOF

cat > "$USER_UNITS/bar-restaurant-ticketing-backup.service" <<EOF
[Unit]
Description=BarRestaurantTicketing verified SQLite snapshot

[Service]
Type=oneshot
WorkingDirectory=$APP_DIR
ExecStart=$NODE_BIN $APP_DIR/scripts/backup-database.mjs --dir=$BACKUP_DIR
NoNewPrivileges=true
EOF

cat > "$USER_UNITS/bar-restaurant-ticketing-backup.timer" <<EOF
[Unit]
Description=Daily BarRestaurantTicketing backup at 04:00

[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true
Unit=bar-restaurant-ticketing-backup.service

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now bar-restaurant-ticketing-backup.timer
echo "Installed optional user service and scheduled backup timer."
echo "Start the app with: systemctl --user enable --now bar-restaurant-ticketing.service"
echo "Check backups with: systemctl --user list-timers"
echo "Keep external backup media connected; verify and restore a backup regularly."
