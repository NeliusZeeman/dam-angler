import assert from 'node:assert';
import { LURES, getGearById } from '../src/gear.js';
import { FISH_SPECIES, suitability } from '../src/fish.js';
import { castLossChance, soakLossChance } from '../src/baitLoss.js';

const liver = getGearById(LURES, 'chicken-liver');
const bread = getGearById(LURES, 'bread-bait');
const sp = (id) => FISH_SPECIES.find((s) => s.id === id);

{
  // Barbel first, the odd tiger (SA forums): a tiger wants liver far less
  // than a Rapala.
  const cond = { waterTempC: 25, timeOfDay: 'morning', lureKind: 'bait' };
  const tigerOnLiver = suitability(sp('tigerfish'), { ...cond, equippedLureId: 'chicken-liver' });
  const tigerOnRapala = suitability(sp('tigerfish'), { ...cond, equippedLureId: 'rapala-minnow', lureKind: 'lure' });
  assert.ok(tigerOnLiver > 0 && tigerOnLiver < tigerOnRapala * 0.4, `tigers take liver only occasionally (${tigerOnLiver} vs ${tigerOnRapala})`);
  assert.ok(sp('catfish').preferredLureIds.includes('chicken-liver'));
  console.log('PASS: chicken liver is a barbel bait that catches the odd tiger');
}

{
  // Liver comes off; bread (in this game) doesn't.
  assert.strictEqual(castLossChance(bread, 1), 0);
  assert.strictEqual(soakLossChance(bread, 60), 0);
  assert.ok(castLossChance(liver, 1.2) > castLossChance(liver, 0.2), 'a hard cast flicks it off more');
  const minute = soakLossChance(liver, 60);
  assert.ok(Math.abs(minute - liver.soft.perMinute) < 1e-9, 'per-minute loss as rated');
  assert.ok(soakLossChance(liver, 60, true) > minute, 'reeling or working it loses it faster');
  // Frame by frame adds up to the same thing as one big step.
  let kept = 1;
  for (let i = 0; i < 3600; i++) kept *= 1 - soakLossChance(liver, 1 / 60);
  assert.ok(Math.abs((1 - kept) - minute) < 1e-6);
  console.log(`PASS: chicken liver comes off (${Math.round(castLossChance(liver, 1) * 100)}% on a full cast, ${Math.round(minute * 100)}% per minute)`);
}
