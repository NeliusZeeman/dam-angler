import assert from 'node:assert';
import { LOCATIONS, getLocationById } from '../src/locations.js';
import { FISH_SPECIES } from '../src/fish.js';
import { LOCAL_TIPS, liveTip, localTip, randomTip, localTipsFor } from '../src/tips.js';
import { makeRng } from '../src/gfx/noise.js';

{
  for (const loc of LOCATIONS) {
    assert.ok(localTipsFor(loc).length >= 5, `${loc.id} needs at least 5 local tips`);
  }
  console.log('PASS: every dam has its own local-knowledge tips');
}

{
  // Live tips only ever name a fish that lives in that dam, with a bait it
  // really takes -- they're read off the bite model, so they can't lie.
  const rng = makeRng(7);
  for (const loc of LOCATIONS) {
    for (const timeOfDay of ['morning', 'midday', 'sunset', 'night']) {
      for (let i = 0; i < 40; i++) {
        // A summer's day at this water (mountain trout streams run cold).
        const tip = liveTip(loc, { waterTempC: 22 + (loc.tempOffset || 0), timeOfDay }, { rng });
        assert.ok(tip && tip.text.length > 10, `${loc.id} ${timeOfDay}: expected a tip`);
        assert.ok(loc.speciesIds.includes(tip.speciesId), `${loc.id}: tip names ${tip.speciesId}, not found there`);
        if (tip.lureId) {
          const species = FISH_SPECIES.find((s) => s.id === tip.lureId || s.id === tip.speciesId);
          assert.ok(species.preferredLureIds.includes(tip.lureId), `${tip.speciesId} doesn't take ${tip.lureId}`);
        }
      }
    }
  }
  console.log('PASS: live tips name local fish and baits they actually take');
}

{
  // Tips follow the clock: at night on the Highveld it's barbel talk, at
  // Jozini in the morning the tigers feature.
  const rng = makeRng(3);
  const count = (locId, timeOfDay, speciesId) => {
    let n = 0;
    for (let i = 0; i < 400; i++) if (liveTip(getLocationById(locId), { waterTempC: 22, timeOfDay }, { rng })?.speciesId === speciesId) n++;
    return n;
  };
  assert.ok(count('roodeplaat', 'night', 'catfish') > count('roodeplaat', 'midday', 'catfish'), 'barbel tips should peak at night');
  assert.ok(count('jozini', 'morning', 'tigerfish') > 40, 'tigerfish should feature in Jozini morning tips');
  console.log('PASS: live tips change with the time of day');
}

{
  // A bait you don't own yet gets a pointer to the shop.
  const rng = makeRng(11);
  let pointed = false;
  for (let i = 0; i < 200 && !pointed; i++) {
    const tip = liveTip(getLocationById('loskop'), { waterTempC: 22, timeOfDay: 'morning' }, { rng, ownedLureIds: ['bread-bait'] });
    if (tip?.lureId && tip.lureId !== 'bread-bait') pointed = tip.text.includes('tackle box shop');
  }
  assert.ok(pointed, 'expected a shop pointer for an unowned bait');
  console.log('PASS: tips point you to the shop for baits you do not own');
}

{
  // Even with every fish out of its temperature range, there's still a tip.
  const loc = getLocationById('vaal');
  assert.strictEqual(liveTip(loc, { waterTempC: -5, timeOfDay: 'midday' }, { rng: () => 0.9 }), null);
  const tip = randomTip(loc, { waterTempC: -5, timeOfDay: 'midday' }, { rng: () => 0.1 });
  assert.ok(tip && tip.kind === 'local', 'falls back to local knowledge');
  assert.ok(localTip(loc).text.length > 10);
  console.log('PASS: random tips fall back to local knowledge');
}

console.log('All tips tests passed.');
