# Strike timing (gameplay piece 1 of 5)

Approved 2026-10-27. Part of: strike timing → working lures → reading the water →
landing the fish → things to chase.

## Goal
A bite no longer hooks the fish by itself. The fish takes the bait, the game shows
the take the way that fish and rig really show it, and the player strikes (the
same click / tap / Space they already use). Timing decides it.

## The take
`src/strike.js` (pure, tested) plans a take from species, bait/lure, hook and reel:

| Take | Who | False cues | Real cue | Window (default) |
|---|---|---|---|---|
| hit | any lure or fly | none | the hit | 0.55 s (lures), 0.6 s (flies) |
| dips | nibblers on a float (kurper, bluegill, mudfish) | 1–3 small dips | float goes under | 0.6 s |
| slide | steady/heavy fish on a float | one small dip | float slides away | 1.2 s |
| under | aggressive fish on a float | — | float pulled under | 0.8 s |
| run | carp / barbel on bottom rigs | 1–2 rod-tip knocks | the run (reel screams on a baitrunner) | 2.5 s (×1.3 on a baitrunner) |
| pull | heavy fish on bottom liver/sardine | one knock | slow pull | 1.5 s |

## Strike
- Before the real cue: **too early** — bait pulled away; the fish may come back (bites ×3 for 8 s).
- In the window: hook-up roll — 92 %; tigerfish 50 % (+10 % on treble lures);
  a circle hook struck hard 55 %.
- After the window with no strike: **self-hooking** rigs hook it anyway —
  hair rig / chod 85 %, circle hook 92 %, treble lures 30 %. Otherwise **dropped**;
  a soft bait (liver, bread, worm…) is stripped half the time.
- A strike that hooks keeps winding if the button is still held.

## Shown / heard
Float dips, slides and goes under; rod tip knocks; line loads on a run; splash on a
lure hit. The bite sound plays on the real cue; a baitrunner screams through a run.
Messages: "Something's at the bait…" (first false cue), the species' bite line on the
real cue, "Fish on!", "Too early…", "It dropped the bait", "Missed — the hook didn't
stick".

## Tuning
`ENGINE.strike` (all windows and chances) under Game settings → Strike in the admin area.
