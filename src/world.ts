import { createNoise2D } from "simplex-noise";
import { makeRng, type Rng } from "./rng";
import { H, RGB, T, W, hashShade, isSolid, isTreeish, isWalkThrough } from "./tiles";

export class World {
  readonly w = W; readonly h = H;
  readonly tiles = new Uint8Array(W * H);
  readonly light = new Uint8Array(W * H);
  readonly sky = new Uint16Array(W);
  readonly surface = new Uint16Array(W);
  readonly biome = new Uint8Array(W);
  readonly seed: number; rng: Rng; dirty = true;
  lights: { x: number; y: number; r: number }[] = [];
  private noiseCave: (x: number, y: number) => number;
  private noiseOre: (x: number, y: number) => number;

  constructor(seed: number) {
    this.seed = seed >>> 0; this.rng = makeRng(this.seed);
    this.noiseCave = createNoise2D(makeRng(this.seed ^ 0x9e3779b9).next);
    this.noiseOre = createNoise2D(makeRng(this.seed ^ 0x85ebca6b).next);
    this.generate(); this.recomputeAllLight();
  }
  idx(x: number, y: number) { return (y | 0) * W + (x | 0); }
  inBounds(x: number, y: number) { return x >= 0 && y >= 0 && x < W && y < H; }
  get(x: number, y: number) { return this.inBounds(x, y) ? this.tiles[this.idx(x, y)]! : T.BEDROCK; }
  set(x: number, y: number, t: number) {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y); if (this.tiles[i] === t) return;
    this.tiles[i] = t; this.dirty = true;
    if (y <= this.surface[x]!) this.scanSurface(x);
  }
  solid(x: number, y: number) { return isSolid(this.get(x | 0, y | 0)); }
  walkable(x: number, y: number) { return isWalkThrough(this.get(x | 0, y | 0)); }
  standY(x: number) { return this.surface[Math.max(0, Math.min(W - 1, x | 0))]!; }
  scanSurface(x: number) {
    for (let y = 0; y < H; y++) {
      const t = this.tiles[y * W + x]!;
      if (isSolid(t) && !isTreeish(t)) { this.surface[x] = y; return; }
    }
    this.surface[x] = H - 2;
  }
  private fbm(n: (x: number, y: number) => number, x: number, y: number, oct = 5) {
    let v = 0, a = 1, f = 1, s = 0;
    for (let i = 0; i < oct; i++) { v += n(x * f, y * f) * a; s += a; a *= 0.5; f *= 2.05; }
    return v / s;
  }
  private generate() {
    const elev = createNoise2D(makeRng(this.seed ^ 0x11111111).next);
    const moist = createNoise2D(makeRng(this.seed ^ 0x22222222).next);
    const detail = createNoise2D(makeRng(this.seed ^ 0x33333333).next);
    const bio = createNoise2D(makeRng(this.seed ^ 0x44444444).next);
    for (let x = 0; x < W; x++) {
      const e = (this.fbm(elev, x * 0.0022, 0.1) + 1) * 0.5;
      const d = this.fbm(detail, x * 0.012, 2.2, 3);
      const b = (this.fbm(bio, x * 0.0014, 8.1, 4) + 1) * 0.5;
      const m0 = (this.fbm(moist, x * 0.003, 4, 3) + 1) * 0.5;
      let kind = 0;
      if (b > 0.78 && e > 0.55) kind = 3;
      else if (b > 0.62 && m0 < 0.38) kind = 2;
      else if (b < 0.22 && m0 > 0.55) kind = 4;
      else if (e > 0.72) kind = 5;
      else if (m0 > 0.58) kind = 1;
      this.biome[x] = kind;
      let sy = Math.floor(74 + e * 58 + d * 10);
      if (kind === 3) sy -= 18; if (kind === 4) sy += 10; if (kind === 5) sy -= 8;
      this.surface[x] = Math.max(42, Math.min(H - 36, sy));
    }
    for (let x = 1; x < W - 1; x++) this.surface[x] = Math.round((this.surface[x - 1]! + this.surface[x]! * 2 + this.surface[x + 1]!) / 4);
    const lakeY = 128;
    for (let x = 0; x < W; x++) {
      const sy = this.surface[x]!, kind = this.biome[x]!, lake = sy > lakeY - 2;
      if (lake && kind !== 3) this.biome[x] = 6;
      for (let y = 0; y < H; y++) {
        const i = y * W + x;
        if (y < sy) { this.tiles[i] = lake && y >= lakeY ? T.WATER : T.AIR; continue; }
        if (y >= H - 5) { this.tiles[i] = T.BEDROCK; continue; }
        if (y === sy) {
          this.tiles[i] = lake ? T.SAND : kind === 5 || sy < 58 ? T.SNOW : kind === 2 ? T.SAND : kind === 4 ? T.MOSS : T.GRASS;
          continue;
        }
        this.tiles[i] = y <= sy + 6 ? (kind === 2 ? T.SAND : T.DIRT) : y > 198 ? T.DEEP : T.STONE;
      }
    }
    this.carveCaves(); this.placeOres(); this.placeTrees(); this.decorate();
    for (let x = 0; x < W; x++) this.scanSurface(x);
  }
  private carveCaves() {
    for (let x = 2; x < W - 2; x++) {
      const sy = this.surface[x]!;
      for (let y = sy + 8; y < H - 8; y++) {
        if (this.noiseCave(x * 0.028, y * 0.042) > 0.42) this.tiles[y * W + x] = T.AIR;
      }
    }
  }
  private placeOres() {
    for (let x = 1; x < W - 1; x++) {
      const sy = this.surface[x]!;
      for (let y = sy + 10; y < H - 6; y++) {
        const i = y * W + x; if (this.tiles[i] !== T.STONE && this.tiles[i] !== T.DEEP) continue;
        const n = this.noiseOre(x * 0.08, y * 0.08);
        if (n > 0.56) this.tiles[i] = T.COAL;
        else if (n < -0.6) this.tiles[i] = T.COPPER;
        else if (this.noiseOre(x * 0.07, y * 0.09) > 0.6) this.tiles[i] = T.IRON;
      }
    }
  }
  private placeTrees() {
    for (let x = 6; x < W - 6; x++) {
      const sy = this.surface[x]!, kind = this.biome[x]!;
      if (this.tiles[sy * W + x] !== T.GRASS && this.tiles[sy * W + x] !== T.MOSS) continue;
      if (!this.rng.chance(kind === 1 ? 0.24 : 0.08)) continue;
      this.growTree(x, sy - 1, kind === 5 ? 9 : 6, kind === 5);
      x += 3;
    }
  }
  growTree(x: number, baseY: number, tall: number, pine: boolean) {
    for (let i = 0; i < tall; i++) {
      const y = baseY - i; if (!this.inBounds(x, y) || this.tiles[y * W + x] !== T.AIR) break;
      this.tiles[y * W + x] = T.WOOD;
    }
    const top = baseY - tall + 1, r = pine ? 2 : 3;
    for (let dy = -r; dy <= 2; dy++) for (let dx = -r; dx <= r; dx++) {
      const tx = x + dx, ty = top + dy;
      if (this.inBounds(tx, ty) && this.tiles[ty * W + tx] === T.AIR) this.tiles[ty * W + tx] = T.LEAVES;
    }
  }
  private decorate() {
    for (let x = 1; x < W - 1; x++) {
      const sy = this.surface[x]!;
      if (this.tiles[sy * W + x] === T.GRASS && this.tiles[(sy - 1) * W + x] === T.AIR && this.rng.chance(0.12))
        this.tiles[(sy - 1) * W + x] = T.TALLGRASS;
    }
  }
  chopTreeAt(x: number, y: number): number {
    let wood = 0, trunkX = x;
    for (let i = 0; i < 6; i++) {
      if (this.get(x + i, y) === T.WOOD) { trunkX = x + i; break; }
      if (this.get(x - i, y) === T.WOOD) { trunkX = x - i; break; }
    }
    for (let xx = trunkX - 5; xx <= trunkX + 5; xx++) for (let yy = y - 14; yy <= y + 4; yy++) {
      const t = this.get(xx, yy);
      if (t === T.WOOD) wood++;
      if (t === T.WOOD || t === T.LEAVES || t === T.SAPLING) this.set(xx, yy, T.AIR);
    }
    return Math.max(1, wood);
  }
  dropLooseVegetation() {
    for (let n = 0; n < 200; n++) {
      const x = this.rng.int(2, W - 2), y = this.rng.int(2, H - 4), t = this.get(x, y);
      if (t === T.LEAVES && this.get(x, y + 1) === T.AIR && this.get(x, y + 2) === T.AIR) this.set(x, y, T.AIR);
    }
  }
  recomputeAllLight() {
    this.lights.length = 0;
    for (let x = 0; x < W; x++) {
      let blocked = false;
      for (let y = 0; y < H; y++) {
        const t = this.tiles[y * W + x]!;
        if (!blocked && (t === T.AIR || t === T.LEAVES || t === T.TALLGRASS)) this.light[y * W + x] = t === T.LEAVES ? 12 : 15;
        else { blocked = true; this.light[y * W + x] = 0; }
      }
    }
  }
  colorAt(x: number, y: number): [number, number, number, number] {
    const t = this.get(x, y); if (t === T.AIR) return [0, 0, 0, 0];
    const base = RGB[t] ?? [255, 0, 255], s = hashShade(x, y);
    return [Math.max(0, Math.min(255, base[0] + s)), Math.max(0, Math.min(255, base[1] + s)), Math.max(0, Math.min(255, base[2] + s)), t === T.WATER ? 200 : 255];
  }
  findFlatNearWater(x0: number, x1: number, width: number): number | null {
    let best: number | null = null, bestScore = 1e9;
    for (let x = Math.max(20, x0); x < Math.min(W - width - 20, x1); x += 4) {
      let minY = H, maxY = 0;
      for (let i = 0; i < width; i++) { const sy = this.surface[x + i]!; if (sy < minY) minY = sy; if (sy > maxY) maxY = sy; }
      const score = maxY - minY;
      if (score < bestScore) { bestScore = score; best = x; }
    }
    return best;
  }
  findNearest(x: number, y: number, pred: (t: number, x: number, y: number) => boolean, r = 80) {
    let best: { x: number; y: number } | null = null, bestD = r * r;
    for (let yy = Math.max(0, (y | 0) - r); yy <= Math.min(H - 1, (y | 0) + r); yy++)
      for (let xx = Math.max(0, (x | 0) - r); xx <= Math.min(W - 1, (x | 0) + r); xx++) {
        if (!pred(this.get(xx, yy), xx, yy)) continue;
        const d = (xx - x) ** 2 + (yy - y) ** 2;
        if (d < bestD) { bestD = d; best = { x: xx, y: yy }; }
      }
    return best;
  }
}
