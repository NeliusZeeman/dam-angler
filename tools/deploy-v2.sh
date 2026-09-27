#!/usr/bin/env bash
# Publishes v2 to angler-v2.homeprojecthub.co.za (server 192.168.1.36).
# Run from the V2 folder on the PC:  bash tools/deploy-v2.sh
# Pushes branch v2 to GitHub, then on the server: pull, install packages,
# update the database tables, restart the API, and check it answers.
set -euo pipefail
SERVER=nelius@192.168.1.36
APP=/home/nelius/online_app/dam-angler-v2

branch=$(git branch --show-current)
[ "$branch" = "v2" ] || { echo "On branch '$branch' -- switch to v2 first."; exit 1; }
node --test "server/test/*.test.js" >/dev/null && node test/run-all.mjs >/dev/null || { echo "Tests failed -- not deploying."; exit 1; }
git push -q origin v2

ssh "$SERVER" "set -e
  cd $APP
  git pull -q --ff-only
  npm ci --omit=dev --no-audit --no-fund --loglevel=error
  node --env-file=server/.env server/migrate.js
  sudo systemctl restart dam-angler-api
  sleep 2
  curl -fsS http://127.0.0.1:8100/api/health >/dev/null && echo 'API is up.'
  git log --oneline -1"
