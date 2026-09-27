#!/usr/bin/env bash
# Runs ON THE SERVER, in the live folder, after `git pull`: brings the live
# game fully up to date. (update_dam_angler.sh on the server and
# tools/deploy-v2.sh on the PC both end up here.)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Installing packages..."
npm ci --omit=dev --no-audit --no-fund --loglevel=error
echo "Updating the database..."
node --env-file=server/.env server/migrate.js
echo "Updating the web server settings..."
sudo cp server/deploy/angler-proxy.conf server/deploy/angler-security-headers.conf /etc/nginx/snippets/
sudo cp server/deploy/nginx-angler.conf /etc/nginx/sites-available/angler
sudo nginx -t -q && sudo systemctl reload nginx
echo "Restarting the game server..."
sudo systemctl restart dam-angler-api
sleep 2
curl -fsS http://127.0.0.1:8100/api/health >/dev/null && echo "Game server is up."
echo "Live version: $(git log --oneline -1)"
