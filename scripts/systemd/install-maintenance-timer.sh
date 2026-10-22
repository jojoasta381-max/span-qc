#!/bin/bash
set -euo pipefail

# Ensure script is run with sudo/root privileges
if [[ $EUID -ne 0 ]]; then
   echo "[ERROR] This script must be run as root (use sudo)" 
   exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[INFO] Installing Docker maintenance systemd units..."
cp "${SCRIPT_DIR}/docker-prune.service" /etc/systemd/system/docker-prune.service
cp "${SCRIPT_DIR}/docker-prune.timer" /etc/systemd/system/docker-prune.timer

systemctl daemon-reload
systemctl enable docker-prune.timer
systemctl restart docker-prune.timer

echo "[SUCCESS] docker-prune.timer is enabled and running!"
systemctl status docker-prune.timer --no-pager
