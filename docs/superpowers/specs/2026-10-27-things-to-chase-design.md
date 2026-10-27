# Things to chase (gameplay piece 5 of 5)

Approved 2026-10-27.

## Species Book
Replaces the Catch Log (menu and in-game): all species, silhouettes for the ones not
caught yet, caught count, personal best, released, trophies, personal bests per dam,
and where each lives. "9 / 16 species" at the top.

## Challenges (`src/goals.js`, `server/goals.js`)
Three daily challenges (new at midnight SA time) and one weekly (Mondays), the same
for everyone (seeded from the date): catch N of a fish, release N over X kg, land a
fish at a time of day, a fish over X kg at a dam, N fish at a dam, N different species.
Rewards: daily 60 credits base (x1-1.5), weekly 350 base. Online, the server counts its
own recorded catches in the period and pays a claim once (`challenge_claims`);
guests are counted on the device from their guest catches. A toast says when a catch
finishes a challenge.

## Monthly competitions
Two a month, chosen from the month (heaviest of a species; the second at one dam).
Leaderboard: each angler's heaviest qualifying fish, top 10 plus your place. When the
month ends (SA time), the first request after it pays 1st/2nd/3rd 1500/800/400 credits
once (`comp_awards`); winners get a 🏆 by their name. Account needed.

## Server
Migration 008: `challenge_claims`, `comp_awards`, credit reasons 'challenge' and 'prize'.
Endpoints: GET /api/me/challenges, POST /api/me/challenges/claim, GET /api/me/competitions.
The catch log carries `bestByDam`.

## Tuning
Game settings → Challenges & competitions: rewards and prizes.
