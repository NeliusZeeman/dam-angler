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

# -t: lets sudo ask for the server password if it needs to.
ssh -t "$SERVER" "set -e; cd $APP && git pull -q --ff-only && bash tools/update-on-server.sh"

# Live now: master on GitHub follows what is live.
git push -q origin v2:master && echo "GitHub master now matches the live game."
