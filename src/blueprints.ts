import { H, T, W } from "./tiles";
import type { World } from "./world";

export type JobBlock = { x: number; y: number; tile: number; pri: number; done: boolean; who: number };
export type AgeId = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const AGE_NAMES = ["Paleolithic", "Neolithic", "Bronze Age", "Iron Age", "Medieval", "Industrial", "Modern"] as const;
export type ProjectKind = "hut" | "house" | "farm" | "mine" | "warehouse" | "granary" | "hall" | "workshop" | "road" | "mill" | "castle" | "factory" | "cellar";
export type Project = {
  id: number; kind: ProjectKind; x: number; y: number; w: number; h: number;
  jobs: JobBlock[]; done: boolean; home: boolean; capacity: number;
  lastVisit: number; builtAge: AgeId; buried: boolean; variant: string; rooms: number;
};
export type MineState = { mouthX: number; mouthY: number; heads: { x: number; y: number }[]; dug: number; rails: boolean };

function add(jobs: JobBlock[], x: number, y: number, tile: number, pri: number) {
  if (x < 1 || x >= W - 1 || y < 1 || y >= H - 2) return;
  jobs.push({ x, y, tile, pri, done: false, who: -1 });
}
export function wallMat(age: AgeId) {
  return age <= 0 ? T.DIRT : age <= 2 ? T.PLANKS : age <= 4 ? T.STONEBRICK : age === 5 ? T.BRICK : T.CONCRETE;
}
export function roofMat(age: AgeId) { return age <= 1 ? T.LEAVES : age <= 4 ? T.ROOF : T.STEEL; }
function avgStand(world: World, x0: number, w: number) {
  let b = 0; for (let i = 0; i < w; i++) b += world.standY(x0 + i); return Math.round(b / Math.max(1, w));
}
function shell(kind: ProjectKind, x: number, y: number, w: number, h: number, jobs: JobBlock[], extra: Partial<Project> = {}): Project {
  return { id: 0, kind, x, y, w, h, jobs, done: false, home: extra.home ?? false, capacity: extra.capacity ?? 0, lastVisit: 0, builtAge: extra.builtAge ?? 0, buried: false, variant: extra.variant ?? kind, rooms: extra.rooms ?? 1 };
}
function box(world: World, x0: number, w: number, h: number, age: AgeId) {
  const base = avgStand(world, x0, w), wall = wallMat(age), jobs: JobBlock[] = [];
  for (let x = x0; x < x0 + w; x++) {
    if (world.get(x, base - 2) === T.WOOD) add(jobs, x, base - 2, T.AIR, -2);
    add(jobs, x, base, T.PLANKS, 0);
  }
  for (let y = 1; y < h; y++) { add(jobs, x0, base - y, wall, 1); add(jobs, x0 + w - 1, base - y, wall, 1); }
  add(jobs, x0, base - 1, T.DOOR, 2); add(jobs, x0 + w - 1, base - 1, T.DOOR, 2);
  for (let x = x0 + 1; x < x0 + w - 1; x++) add(jobs, x, base - 1, T.BACKWALL, 2);
  for (let x = x0; x < x0 + w; x++) add(jobs, x, base - h, roofMat(age), 3);
  add(jobs, x0 + 2, base - 2, T.TORCH, 4);
  return { jobs, base };
}
export function makeHut(world: World, x0: number, age: AgeId) {
  const b = box(world, x0, 7, 4, age); return shell("hut", x0, b.base, 7, 6, b.jobs, { home: true, capacity: 4, builtAge: age, variant: "peaked-hut" });
}
export function makeHouse(world: World, x0: number, age: AgeId) {
  const b = box(world, x0, 11, 5, age); return shell("house", x0, b.base, 11, 7, b.jobs, { home: true, capacity: 6, builtAge: age, variant: "cottage", rooms: 2 });
}
export function expandDwelling(_world: World, p: Project, age: AgeId) {
  const jobs: JobBlock[] = [], nx = p.x + p.w; if (nx + 5 >= W - 8) return jobs;
  for (let x = nx; x < nx + 5; x++) add(jobs, x, p.y, T.PLANKS, 0);
  for (let y = 1; y <= 4; y++) add(jobs, nx + 4, p.y - y, wallMat(age), 1);
  add(jobs, nx + 4, p.y - 1, T.DOOR, 2);
  p.w += 5; p.rooms += 1; p.capacity += 2; return jobs;
}
export function makeFarm(world: World, x0: number, w = 10) {
  const base = avgStand(world, x0, w), jobs: JobBlock[] = [];
  for (let x = x0; x < x0 + w; x++) { add(jobs, x, base, T.FARMLAND, 0); add(jobs, x, base - 1, T.PLANTED, 1); }
  return shell("farm", x0, base, w, 2, jobs, { variant: "field" });
}
export function makeWarehouse(world: World, x0: number, age: AgeId) {
  const b = box(world, x0, 11, 5, age); return shell("warehouse", x0, b.base, 11, 7, b.jobs, { builtAge: age, variant: "storehouse", capacity: 80, rooms: 3 });
}
export function expandWarehouse(_world: World, p: Project, age: AgeId) {
  const jobs: JobBlock[] = [], nx = p.x + p.w; if (nx + 6 >= W - 8) return jobs;
  for (let x = nx; x < nx + 6; x++) add(jobs, x, p.y, T.PLANKS, 0);
  for (let y = 1; y <= 4; y++) add(jobs, nx + 5, p.y - y, wallMat(age), 1);
  p.w += 6; p.rooms += 1; p.capacity += 50; return jobs;
}
export function makeGranary(world: World, x0: number, age: AgeId) {
  const b = box(world, x0, 8, 6, age); return shell("granary", x0, b.base, 8, 8, b.jobs, { builtAge: age, variant: "grain", capacity: 60 });
}
export function makeHall(world: World, x0: number, age: AgeId) {
  const b = box(world, x0, 13, 6, age); add(b.jobs, x0 + 6, b.base - 6, T.FLAG, 4); return shell("hall", x0, b.base, 13, 8, b.jobs, { builtAge: age, variant: "hall" });
}
export function makeWorkshop(world: World, x0: number, age: AgeId) {
  const b = box(world, x0, 11, 5, age); return shell("workshop", x0, b.base, 11, 7, b.jobs, { builtAge: age, variant: "forge" });
}
export function makeRoad(world: World, x0: number, x1: number, age: AgeId) {
  const lo = Math.min(x0, x1), hi = Math.max(x0, x1), jobs: JobBlock[] = [];
  const tile = age >= 6 ? T.ASPHALT : age >= 4 ? T.COBBLE : T.PATH;
  for (let x = lo; x <= hi; x++) add(jobs, x, world.standY(x), tile, 0);
  return shell("road", lo, world.standY(lo), hi - lo + 1, 1, jobs, { builtAge: age, variant: "road" });
}
export function makeMill(world: World, x0: number, age: AgeId) {
  const b = box(world, x0, 7, 8, age); return shell("mill", x0, b.base, 7, 10, b.jobs, { builtAge: age, variant: "mill" });
}
export function makeCastle(world: World, x0: number) {
  const b = box(world, x0, 16, 10, 4); return shell("castle", x0, b.base, 16, 12, b.jobs, { builtAge: 4, variant: "keep", rooms: 4 });
}
export function makeFactory(world: World, x0: number) {
  const b = box(world, x0, 16, 8, 5); return shell("factory", x0, b.base, 16, 10, b.jobs, { builtAge: 5, variant: "works" });
}
export function makeCellar(world: World, x0: number) {
  const base = world.standY(x0 + 3), jobs: JobBlock[] = [];
  for (let y = 0; y <= 6; y++) add(jobs, x0 + 3, base + y, T.STAIR, 0);
  add(jobs, x0 + 2, base + 5, T.TORCH, 4);
  return shell("cellar", x0, base, 7, 6, jobs, { builtAge: 1, variant: "root-cellar", capacity: 30 });
}
export function makeStairMine(world: World, x0: number, depth = 16) {
  const base = world.standY(x0), jobs: JobBlock[] = [];
  for (let s = 0; s < depth; s++) {
    add(jobs, x0, base + s, T.STAIR, 0); add(jobs, x0 + 1, base + s, T.AIR, 1);
    if (s % 3 === 0) add(jobs, x0 - 1, base + s, T.SUPPORT, 2);
    if (s % 4 === 0) add(jobs, x0 + 1, base + s - 1, T.TORCH, 3);
  }
  for (let i = 1; i <= 12; i++) { add(jobs, x0 + i, base + depth, T.AIR, 2); add(jobs, x0 + i, base + depth + 1, T.BEAM, 3); }
  return { project: shell("mine", x0 - 2, base, 16, depth + 3, jobs, { builtAge: 1, variant: "working" }), mine: { mouthX: x0, mouthY: base, heads: [{ x: x0 + 12, y: base + depth }], dug: depth, rails: false } };
}
export function growMine(world: World, mine: MineState, length = 10) {
  const jobs: JobBlock[] = [], head = mine.heads[0] ?? { x: mine.mouthX, y: mine.mouthY + 16 };
  for (let i = 1; i <= length; i++) {
    add(jobs, head.x + i, head.y, T.AIR, 2); add(jobs, head.x + i, head.y - 1, T.AIR, 2);
    if (!world.solid(head.x + i, head.y + 1)) add(jobs, head.x + i, head.y + 1, T.BEAM, 3);
  }
  head.x += length; mine.dug += length; return jobs;
}
export function remaining(p: Project) { return p.jobs.filter((j) => !j.done).length; }
export function appendJobs(p: Project, jobs: JobBlock[]) { if (!jobs.length) return; p.jobs.push(...jobs); p.done = false; }
export function collapseProject(world: World, p: Project) {
  const jobs: JobBlock[] = [];
  for (let x = p.x; x < p.x + p.w; x++) for (let y = p.y - p.h; y <= p.y; y++) {
    const t = world.get(x, y);
    if (t !== T.AIR && t !== T.WATER) { world.set(x, y, T.AIR); add(jobs, x, p.y, T.RUBBLE, 0); }
  }
  p.done = false; return jobs;
}
