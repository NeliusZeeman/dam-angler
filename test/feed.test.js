import assert from 'node:assert';
import { FEED_TYPES, feedIntensity, feedFalloff, feedBoostAt } from '../src/feed.js';
import { FISH_SPECIES, pickGuaranteedBite, rollDamBite } from '../src/fish.js';
import { LURES, RODS, getGearById } from '../src/gear.js';
import { getLocationById } from '../src/locations.js';
import { simulateCast, launchSpeed, DRAG } from '../src/castPhysics.js';

{
  // Fish take a few seconds to find the feed, hold on it, then drift off.
  const bread = FEED_TYPES.bread;
  assert.ok(feedIntensity(1, bread) < 0.2, 'fish have not found it after 1 second');
  assert.ok(feedIntensity(bread.findSeconds + 5, bread) > 0.95, 'fish are on it once they find it');
  assert.ok(feedIntensity(bread.duration * 0.5, bread) > 0.95, 'and they stay while there is food');
  assert.ok(feedIntensity(bread.duration * 0.9, bread) < 0.3, 'they drift off as it runs out');
  assert.strictEqual(feedIntensity(bread.duration + 1, bread), 0);
  assert.ok(bread.duration >= 120, 'breadcrumbs hold fish for a couple of minutes');
  console.log('PASS: feed draws fish in, holds them, then they drift away');
}

{
  assert.strictEqual(feedFalloff(0, 3), 1);
  assert.ok(feedFalloff(3, 3) > 0 && feedFalloff(3, 3) < 1, 'edge still has some pull');
  assert.strictEqual(feedFalloff(10, 3), 0);
  const spots = [{ type: 'bread', x: 0, z: 0, age: 40 }];
  assert.ok(Math.abs(feedBoostAt(spots, 0, 0) - (FEED_TYPES.bread.peak - 1)) < 0.01, 'full boost over the middle');
  assert.strictEqual(feedBoostAt(spots, 30, 0), 0, 'no boost far away');
  console.log('PASS: the pull is strongest over the spot and fades past its edge');
}

{
  // Feed brings bites -- and the right fish: carp and kurper, not tigers.
  const loc = getLocationById('jozini');
  const list = FISH_SPECIES.filter((s) => loc.speciesIds.includes(s.id));
  const opts = { waterTempC: 24, equippedLureId: 'worm', timeOfDay: 'afternoon', lureKind: 'bait', habitat: { zone: 'open', depthFactor: 0.5 } };
  const bites = (chumBoost) => {
    let n = 0;
    for (let i = 0; i < 20000; i++) if (rollDamBite(list, loc.catchShare, { ...opts, chumBoost, deltaSeconds: 1 })) n++;
    return n;
  };
  const plain = bites(0), fed = bites(FEED_TYPES.bread.peak - 1);
  assert.ok(fed > plain * 1.8, `feed should roughly double-to-triple bites (${plain} -> ${fed})`);
  const share = (chumBoost, id) => {
    let n = 0;
    for (let i = 0; i < 20000; i++) if (pickGuaranteedBite(list, { ...opts, chumBoost }, loc.catchShare).id === id) n++;
    return n / 20000;
  };
  assert.ok(share(2, 'mozambique-tilapia') > share(0, 'mozambique-tilapia'), 'kurper crowd onto breadcrumbs');
  assert.ok(share(2, 'tigerfish') <= share(0, 'tigerfish'), 'tigerfish do not come for bread');
  console.log(`PASS: feed raises bites (${plain} -> ${fed}) and draws the fish that eat it`);
}

{
  // Mieliebom: carp's favourite, and heavy enough to cast further.
  const bom = getGearById(LURES, 'mieliebom');
  assert.ok(bom && bom.groundbait && bom.heavy, 'mieliebom is in the tackle box');
  const carp = FISH_SPECIES.find((s) => s.id === 'common-carp');
  assert.ok(carp.preferredLureIds.includes('mieliebom') && carp.lureAffinity.mieliebom > 1, 'carp love a mieliebom');
  const loc = getLocationById('hartbeespoort');
  const list = FISH_SPECIES.filter((s) => loc.speciesIds.includes(s.id));
  let carpN = 0;
  for (let i = 0; i < 4000; i++) {
    if (pickGuaranteedBite(list, { waterTempC: 22, equippedLureId: 'mieliebom', timeOfDay: 'morning', lureKind: 'bait', habitat: { zone: 'open', depthFactor: 0.5 } }, loc.catchShare).id === 'common-carp') carpN++;
  }
  assert.ok(carpN / 4000 > 0.55, `mieliebom sessions at Harties are mostly carp (${Math.round(carpN / 40)}%)`);

  const distance = (rodId, drag, mult = 1) => simulateCast({
    from: { x: 0, y: 2, z: 0 }, dirX: 0, dirZ: 1, speed: launchSpeed(getGearById(RODS, rodId), 1, mult),
    drag, wind: { x: 0, z: 0 }, surfaceAt: () => 0,
  }).distance;
  const carpRodFloat = distance('rod-carp', DRAG.bait);
  const carpRodBom = distance('rod-carp', bom.castDrag);
  assert.ok(carpRodBom > carpRodFloat * 1.2, `carp rod: mieliebom ${carpRodBom.toFixed(1)}m beats float ${carpRodFloat.toFixed(1)}m`);
  // A light starter rod can't throw the heavy feeder at full speed (x0.72 in main.js).
  const starterBom = distance('rod-starter', bom.castDrag, 0.72);
  assert.ok(starterBom < carpRodBom * 0.6, 'the starter rod is no feeder rod');
  console.log(`PASS: mieliebom catches carp and casts further (float ${carpRodFloat.toFixed(1)}m -> bom ${carpRodBom.toFixed(1)}m on a carp rod; starter rod ${starterBom.toFixed(1)}m)`);
}

console.log('All feed tests passed.');
