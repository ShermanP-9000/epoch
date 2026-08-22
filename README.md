# EPOCH

A **watch-only** 2D side-view block civilization sim. You do not build. A band of people raise houses, cut whole trees, farm, store goods in a warehouse, and cut stair mines. Ages unlock from what they have actually built and stored, not from a year timer.

1 pixel ≈ 1 meter. People are two pixels tall.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL, then **Watch the land**.

| Control | Action |
|---|---|
| 1 / 2 / 3 / 4 / 5 | Speed 1×–16× |
| Space | Pause |
| WASD / arrows | Pan |
| Drag canvas | Pan |
| Scroll | Zoom |
| Drag the bottom map strip | Jump the camera |

## What they do

- Start by raising **two shelters**, not a campfire.
- Carry wood and food into a **warehouse** (it grows when full).
- Chop a tree as one job: trunk and canopy go, all wood is credited.
- Mines drop **switchback stairs**, then galleries that follow ore, with beams over pits.
- Old work can be added onto. Collapse leaves **rubble**.
- Biomes across the long map: plains, forest, desert, mountains, swamp, snow, coast.

Ages: Paleolithic → Neolithic → Bronze → Iron → Medieval → Industrial → Modern.

## Stack

Vite, TypeScript, canvas 2D, simplex-noise terrain.

Core files:

- `src/world.ts` — terrain, biomes, caves, ores, trees
- `src/blueprints.ts` — buildings and mine growth
- `src/sim.ts` — jobs, walking, ages
- `src/render.ts` / `src/engine.ts` — draw, camera, speed

## License

MIT. See [LICENSE](LICENSE).
