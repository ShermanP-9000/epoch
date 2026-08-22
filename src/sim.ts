import {
  AGE_NAMES, appendJobs, expandDwelling, expandWarehouse, growMine,
  makeCastle, makeCellar, makeFactory, makeFarm, makeGranary, makeHall, makeHouse, makeHut,
  makeMill, makeRoad, makeStairMine, makeWarehouse, makeWorkshop,
  type AgeId, type MineState, type Project, type ProjectKind,
} from "./blueprints";
import { makeRng, type Rng } from "./rng";
import { FACTION_COLORS, FACTION_NAMES, H, T, W, isClimb, isOre, isTreeish, isWalkThrough } from "./tiles";
import { World } from "./world";

const YEAR = 12, STEP = 1 / 30;
const SKINS = [0xe8c4a2, 0xc48a62, 0x8d5a3a, 0xf0d3b0];
const SHIRTS = [0x6b5344, 0x3d4f3a, 0x4a3f36, 0x5c4a3a];

type Task =
  | { kind: "idle" }
  | { kind: "goto"; x: number; y: number }
  | { kind: "place"; x: number; y: number; tile: number; project: number; jobI: number }
  | { kind: "harvest"; x: number; y: number }
  | { kind: "deposit" }
  | { kind: "tend"; x: number; y: number };

export type Human = {
  id: number; x: number; y: number; dir: number; sett: number; skin: number; shirt: number;
  carry: number; carryN: number; task: Task; stuck: number; work: number; since: number;
  role: "worker" | "miner"; homeX: number;
};
type Stock = { wood: number; food: number; stone: number; steel: number };
type Settlement = {
  id: number; x: number; y: number; stock: Stock; projects: Project[]; age: AgeId;
  founded: number; mine: MineState | null; color: number; name: string;
};
export type EventLine = { at: number; text: string };
export type Snapshot = {
  year: number; age: AgeId; ageName: string; pop: number; houses: number; seed: number;
  speed: number; paused: boolean; following: boolean; zoom: number; focusName: string;
  activity: string; events: EventLine[]; nextAge: string;
};

export class Sim {
  world: World; humans: Human[] = []; settlements: Settlement[] = []; events: EventLine[] = [];
  rng: Rng; time = 0; year = 0; nextId = 1; nextProj = 1; lastNature = 0; lastGrow = 0; lastMine = 0;
  activity = "A band marks two shelters.";
  private claimed = new Set<number>(); private nextFaction = 0;

  constructor(world: World) {
    this.world = world; this.rng = makeRng(world.seed ^ 0x51ed); this.foundFirst();
  }
  private log(text: string) {
    this.events.unshift({ at: this.year, text }); if (this.events.length > 12) this.events.pop(); this.activity = text;
  }
  private foundFirst() {
    const x = this.world.findFlatNearWater(Math.floor(W * 0.28), Math.floor(W * 0.48), 28) ?? Math.floor(W * 0.36);
    const s = this.makeSett(x, 0); s.stock.food = 48; s.stock.wood = 12; this.settlements.push(s);
    this.enqueue(s, makeHut(this.world, x + 6, 0)); this.enqueue(s, makeHut(this.world, x - 10, 0));
    for (let i = 0; i < 8; i++) this.spawnHuman(s, x + this.rng.int(-6, 8));
    this.log(`${s.name} starts two shelters.`);
  }
  private makeSett(x: number, age: AgeId): Settlement {
    const i = this.nextFaction++;
    return { id: this.settlements.length, x, y: this.world.standY(x), stock: { wood: 0, food: 0, stone: 0, steel: 0 }, projects: [], age, founded: this.year, mine: null, color: FACTION_COLORS[i % FACTION_COLORS.length]!, name: FACTION_NAMES[i % FACTION_NAMES.length]! };
  }
  private spawnHuman(s: Settlement, x: number) {
    this.humans.push({ id: this.nextId++, x, y: this.world.standY(x | 0) - 1, dir: 1, sett: s.id, skin: this.rng.pick(SKINS), shirt: this.rng.pick(SHIRTS), carry: 0, carryN: 0, task: { kind: "idle" }, stuck: 0, work: 0, since: 0, role: "worker", homeX: s.x });
  }
  private enqueue(s: Settlement, p: Project) { p.id = this.nextProj++; s.projects.push(p); }
  settOf(h: Human) { return this.settlements[h.sett] ?? this.settlements[0]!; }
  step() {
    this.time += STEP; this.year = this.time / YEAR;
    for (const s of this.settlements) {
      s.stock.food = Math.max(0, s.stock.food - this.humans.filter((h) => h.sett === s.id).length * STEP * 0.18);
      this.plan(s);
    }
    for (const h of this.humans) this.stepHuman(h);
    if (this.time - this.lastNature > 0.5) { this.world.dropLooseVegetation(); this.lastNature = this.time; }
    if (this.time - this.lastGrow > 1.6) { this.growPop(); this.advanceAge(); this.lastGrow = this.time; }
    if (this.time - this.lastMine > 4.5) { for (const s of this.settlements) if (s.mine) this.growTheMine(s); this.lastMine = this.time; }
    this.humans = this.humans.filter((h) => h.y < H - 3 && h.y > 2);
  }
  private has(s: Settlement, k: ProjectKind) { return s.projects.some((p) => p.kind === k && !p.buried); }
  private building(s: Settlement, k: ProjectKind) { return s.projects.some((p) => p.kind === k && !p.done && !p.buried); }
  private plan(s: Settlement) {
    const open = s.projects.filter((p) => !p.done && !p.buried);
    const homes = s.projects.filter((p) => p.done && p.home && !p.buried);
    const pop = this.humans.filter((h) => h.sett === s.id).length;
    if (open.length > 6 + s.age) return;
    if (!this.has(s, "hut") && !this.building(s, "hut")) { this.enqueue(s, makeHut(this.world, s.x + 8, s.age)); return; }
    if ((homes.reduce((a, p) => a + p.capacity, 0) < pop + 1 || homes.length < 2 + s.age) && !this.building(s, "hut") && !this.building(s, "house")) {
      this.enqueue(s, s.age >= 2 ? makeHouse(this.world, this.siteNear(s), s.age) : makeHut(this.world, this.siteNear(s), s.age)); return;
    }
    if (!this.has(s, "warehouse") && !this.building(s, "warehouse")) { this.enqueue(s, makeWarehouse(this.world, this.siteNear(s), s.age)); return; }
    if (!this.has(s, "farm") && !this.building(s, "farm")) { this.enqueue(s, makeFarm(this.world, this.siteNear(s), 10)); this.log(`${s.name} turns soil.`); return; }
    if (s.age >= 1 && !this.has(s, "hall") && !this.building(s, "hall")) { this.enqueue(s, makeHall(this.world, this.siteNear(s), s.age)); return; }
    if (s.age >= 1 && !s.mine && !this.building(s, "mine")) {
      const made = makeStairMine(this.world, s.x + 24, 16); this.enqueue(s, made.project); s.mine = made.mine; this.log(`${s.name} cuts into the hill.`); return;
    }
    if (s.age >= 2 && !this.has(s, "workshop") && !this.building(s, "workshop")) { this.enqueue(s, makeWorkshop(this.world, this.siteNear(s), s.age)); return; }
    if (s.age >= 3 && !this.has(s, "mill") && !this.building(s, "mill")) { this.enqueue(s, makeMill(this.world, this.siteNear(s), s.age)); return; }
    if (s.age >= 4 && !this.has(s, "castle") && !this.building(s, "castle")) { this.enqueue(s, makeCastle(this.world, this.siteNear(s))); return; }
    if (s.age >= 4 && !this.has(s, "road") && !this.building(s, "road")) {
      const xs = s.projects.filter((p) => p.done).map((p) => p.x);
      if (xs.length) this.enqueue(s, makeRoad(this.world, Math.min(...xs) - 4, Math.max(...xs) + 16, s.age)); return;
    }
    if (s.age >= 5 && !this.has(s, "factory") && !this.building(s, "factory")) { this.enqueue(s, makeFactory(this.world, this.siteNear(s))); return; }
    if (open.length === 0) {
      const old = homes.find((p) => p.rooms < 3 + s.age);
      if (old) { const jobs = expandDwelling(this.world, old, s.age); if (jobs.length) { appendJobs(old, jobs); return; } }
      if (s.mine) this.growTheMine(s);
      else this.enqueue(s, makeHut(this.world, this.siteNear(s), s.age));
    }
  }
  private siteNear(s: Settlement) {
    for (let k = 0; k < 16; k++) {
      const x = s.x + (k % 2 === 0 ? 1 : -1) * (14 + k * 7);
      if (x > 20 && x < W - 30 && !s.projects.some((p) => Math.abs(p.x - x) < p.w + 2)) return x;
    }
    return s.x + 20;
  }
  private growTheMine(s: Settlement) {
    const p = s.projects.find((q) => q.kind === "mine" && !q.buried); if (!p || !s.mine) return;
    appendJobs(p, growMine(this.world, s.mine, 8));
  }
  private pickJob(h: Human, s: Settlement) {
    let best: { p: Project; job: Project["jobs"][number]; i: number } | null = null, bestScore = 1e9;
    for (const p of s.projects) {
      if (p.done || p.buried) continue;
      for (let i = 0; i < p.jobs.length; i++) {
        const j = p.jobs[i]!; if (j.done) continue;
        if (j.who >= 0) { const w = this.humans.find((o) => o.id === j.who); if (!w || w.task.kind !== "place") j.who = -1; else continue; }
        const score = Math.abs(j.x - h.x) * 1.6 + Math.abs(j.y - h.y) * 0.4 + j.pri * 4;
        if (score < bestScore) { bestScore = score; best = { p, job: j, i }; }
      }
    }
    return best;
  }
  private assign(h: Human) {
    const s = this.settOf(h);
    if (h.carryN > 0) { h.task = { kind: "deposit" }; return; }
    const picked = this.pickJob(h, s);
    if (picked) { picked.job.who = h.id; h.task = { kind: "place", x: picked.job.x, y: picked.job.y, tile: picked.job.tile, project: picked.p.id, jobI: picked.i }; return; }
    this.plan(s);
    const again = this.pickJob(h, s);
    if (again) { again.job.who = h.id; h.task = { kind: "place", x: again.job.x, y: again.job.y, tile: again.job.tile, project: again.p.id, jobI: again.i }; return; }
    const tree = this.world.findNearest(h.x, h.y, (t, x, y) => t === T.WOOD && this.world.get(x, y + 1) !== T.WOOD && !this.claimed.has(y * W + x), 80);
    if (tree) { this.claimed.add(tree.y * W + tree.x); h.task = { kind: "harvest", x: tree.x, y: tree.y }; return; }
    h.task = { kind: "goto", x: s.x + 8, y: s.y - 1 };
  }
  private atBuild(h: Human, tx: number, ty: number) {
    const dx = Math.abs(h.x - tx), dy = h.y - ty;
    return (dx <= 2.5 && dy >= -1.2 && dy <= 6) || Math.abs(h.x - tx) + Math.abs(h.y - ty) <= 1.8;
  }
  private moveToward(h: Human, tx: number, ty: number) {
    if (this.atBuild(h, tx, ty)) return true;
    const dx = tx - h.x, spd = 10 * STEP;
    const below = this.world.get(h.x | 0, (h.y | 0) + 1);
    if (!this.world.solid(h.x, h.y + 1) && !isClimb(below)) { h.y += 18 * STEP; h.stuck++; return false; }
    if (Math.abs(dx) > 0.25) this.stepX(h, Math.sign(dx), spd); else h.stuck++;
    if (h.stuck > 22) { h.x += Math.sign(dx || 1); if (this.world.solid(h.x, h.y)) h.y -= 1; h.stuck = 0; }
    h.x = Math.max(2, Math.min(W - 3, h.x)); return false;
  }
  private stepX(h: Human, dir: number, spd: number) {
    h.dir = dir; const nx = h.x + dir * spd; const fx = dir > 0 ? Math.ceil(nx) : Math.floor(nx); const fy = Math.round(h.y);
    const t = this.world.get(fx, fy);
    if (this.world.walkable(fx, fy) || isWalkThrough(t)) {
      if (this.world.solid(fx, fy)) { if (!this.world.solid(fx, fy - 1)) { h.y = fy - 1; h.x = nx; h.stuck = 0; } else h.stuck++; }
      else { h.x = nx; h.stuck = 0; }
    } else if (!this.world.solid(fx, fy - 1)) { h.y = fy - 1; h.x = nx; h.stuck = 0; }
    else { h.stuck++; if (h.stuck > 8 && isTreeish(t)) { this.world.chopTreeAt(fx, fy); h.stuck = 0; } }
  }
  private stepHuman(h: Human) {
    h.since += STEP;
    if (h.task.kind === "idle" || h.stuck > 36) { h.stuck = 0; h.since = 0; this.assign(h); }
    const s = this.settOf(h);
    if (h.task.kind === "deposit") {
      const drop = s.projects.find((p) => p.kind === "warehouse" && p.done) ?? s.projects.find((p) => p.home && p.done);
      if (this.moveToward(h, drop ? drop.x + 2 : s.x, drop ? drop.y - 1 : s.y - 1)) {
        if (h.carry === T.WOOD) s.stock.wood += Math.max(1, h.carryN); else s.stock.food += Math.max(1, h.carryN);
        h.carry = 0; h.carryN = 0; h.task = { kind: "idle" };
      }
      return;
    }
    if (h.task.kind === "goto") { if (this.moveToward(h, h.task.x, h.task.y)) h.task = { kind: "idle" }; return; }
    if (h.task.kind === "harvest") {
      const hx = h.task.x, hy = h.task.y;
      if (Math.abs(h.x - hx) <= 2.6 || this.atBuild(h, hx, hy) || this.moveToward(h, hx, this.world.standY(hx) - 1)) {
        if (Math.abs(h.x - hx) <= 2.6 || this.atBuild(h, hx, hy)) {
          h.work += STEP;
          if (h.work > 0.12) {
            h.work = 0; this.claimed.delete(hy * W + hx);
            const t = this.world.get(hx, hy);
            if (t === T.WOOD || t === T.LEAVES) { h.carry = T.WOOD; h.carryN += this.world.chopTreeAt(hx, hy); }
            else { this.world.set(hx, hy, T.AIR); h.carry = T.CROP; h.carryN += 1; }
            h.task = { kind: "deposit" };
          }
        }
      }
      return;
    }
    if (h.task.kind === "place") {
      const task = h.task, p = s.projects.find((pr) => pr.id === task.project);
      if (!p || p.jobs[task.jobI]?.done) { h.task = { kind: "idle" }; return; }
      if (this.atBuild(h, task.x, task.y) || this.moveToward(h, task.x, task.y)) {
        h.work += STEP;
        if (h.work > 0.1 / (1 + s.age * 0.35)) {
          h.work = 0;
          const prev = this.world.get(task.x, task.y);
          if (prev === T.WOOD || prev === T.LEAVES) s.stock.wood += this.world.chopTreeAt(task.x, task.y);
          else if (prev === T.STONE || isOre(prev)) s.stock.stone++;
          this.world.set(task.x, task.y, task.tile);
          p.jobs[task.jobI]!.done = true; p.jobs[task.jobI]!.who = -1;
          if (p.jobs.every((j) => j.done)) { p.done = true; if (p.home) this.log(`${s.name} finishes a ${p.variant}.`); }
          h.task = { kind: "idle" };
        }
      }
    }
  }
  private growPop() {
    for (const s of this.settlements) {
      const pop = this.humans.filter((h) => h.sett === s.id).length;
      const cap = s.projects.filter((p) => p.done && p.home).reduce((a, p) => a + p.capacity, 0);
      if (pop < Math.max(cap, 8) && pop < 48 && s.stock.food > pop * 2 && this.rng.chance(0.4)) this.spawnHuman(s, s.x);
    }
  }
  private advanceAge() {
    for (const s of this.settlements) {
      if (s.age >= 6) continue;
      const homes = s.projects.filter((p) => p.done && p.home).length;
      const has = (k: ProjectKind) => s.projects.some((p) => p.kind === k && p.done);
      const next = (s.age + 1) as AgeId; let ok = false;
      if (next === 1) ok = homes >= 1;
      if (next === 2) ok = has("farm") && (s.stock.wood >= 10 || homes >= 2);
      if (next === 3) ok = has("mine") || has("workshop") || s.stock.stone >= 12;
      if (next === 4) ok = has("hall");
      if (next === 5) ok = has("road") || has("mill") || has("castle");
      if (next === 6) ok = has("factory") || s.stock.steel >= 2;
      if (ok) { s.age = next; this.log(`${s.name} enters the ${AGE_NAMES[next]}.`); }
    }
  }
  snapshot(speed: number, paused: boolean, following: boolean, zoom: number): Snapshot {
    const s = this.settlements.reduce((a, b) => (b.age >= a.age ? b : a), this.settlements[0]!);
    return { year: this.year, age: s.age, ageName: AGE_NAMES[s.age], pop: this.humans.length, houses: this.settlements.reduce((a, st) => a + st.projects.filter((p) => p.done && p.home).length, 0), seed: this.world.seed, speed, paused, following, zoom, focusName: s.name, activity: this.activity, events: this.events.slice(0, 6), nextAge: s.age < 6 ? AGE_NAMES[(s.age + 1) as AgeId] : "—" };
  }
  centroid() {
    if (!this.humans.length) return { x: this.settlements[0]!.x, y: this.settlements[0]!.y - 8 };
    let x = 0, y = 0; for (const h of this.humans) { x += h.x; y += h.y; }
    return { x: x / this.humans.length, y: y / this.humans.length };
  }
}
