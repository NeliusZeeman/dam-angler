# Pond Fishing

3D browser fishing game built with Three.js. No build step, no backend.

## Run

Open `index.html` directly in a modern browser, or serve the folder statically:

```
npx serve .
```

## Controls

- Drag mouse: pan camera (limited arc)
- Hold left mouse button on the water: aim cast (power builds while held)
- Release: cast line
- Hold Space while a fish bites: reel in (release to ease tension)
- B: open/close gear shop
- C: open/close catch log

## Gear

3 rod tiers, 3 line tiers, lures matched to species (tilapia, carp, bass).
Buy gear in the shop with credits earned from catches.

## Tests

Pure-logic modules have plain Node assertion tests (no framework/install needed):

```
node test/environment.test.js
node test/fish.test.js
node test/gear.test.js
node test/economy.test.js
node test/save.test.js
```
