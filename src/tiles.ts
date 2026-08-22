export const W = 3072;
export const H = 272;

export const T = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, DEEP: 4, SAND: 5, WATER: 6,
  WOOD: 7, LEAVES: 8, COAL: 9, COPPER: 10, IRON: 11, GOLD: 12, CLAY: 13,
  PLANKS: 14, BRICK: 15, STONEBRICK: 16, CONCRETE: 17, STEEL: 18, GLASS: 19,
  DOOR: 20, ROOF: 21, TORCH: 22, LAMP: 23, FARMLAND: 24, CROP: 25,
  PATH: 26, COBBLE: 27, ASPHALT: 28, RAIL: 29, BEDROCK: 30, VINE: 31,
  MOSS: 32, SAPLING: 33, LADDER: 35, SUPPORT: 36, WINDOW: 37,
  TALLGRASS: 38, FLOWER: 39, SNOW: 40, ICE: 41, PLANTED: 42, RUBBLE: 43,
  BEAM: 44, STAIR: 45, BACKWALL: 46, FLAG: 47,
} as const;

export type Tile = (typeof T)[keyof typeof T];

export const RGB: [number, number, number][] = [];
RGB[T.AIR] = [0, 0, 0];
RGB[T.GRASS] = [72, 118, 48];
RGB[T.DIRT] = [122, 86, 58];
RGB[T.STONE] = [118, 118, 122];
RGB[T.DEEP] = [72, 74, 80];
RGB[T.SAND] = [194, 178, 128];
RGB[T.WATER] = [48, 92, 148];
RGB[T.WOOD] = [96, 68, 40];
RGB[T.LEAVES] = [52, 98, 46];
RGB[T.COAL] = [36, 36, 38];
RGB[T.COPPER] = [164, 92, 48];
RGB[T.IRON] = [168, 164, 156];
RGB[T.GOLD] = [212, 176, 64];
RGB[T.CLAY] = [148, 96, 74];
RGB[T.PLANKS] = [156, 112, 64];
RGB[T.BRICK] = [132, 64, 48];
RGB[T.STONEBRICK] = [128, 126, 122];
RGB[T.CONCRETE] = [150, 150, 148];
RGB[T.STEEL] = [110, 120, 128];
RGB[T.GLASS] = [160, 196, 210];
RGB[T.DOOR] = [92, 62, 36];
RGB[T.ROOF] = [110, 52, 40];
RGB[T.TORCH] = [255, 170, 70];
RGB[T.LAMP] = [255, 220, 140];
RGB[T.FARMLAND] = [96, 64, 40];
RGB[T.CROP] = [176, 168, 64];
RGB[T.PATH] = [140, 120, 88];
RGB[T.COBBLE] = [108, 108, 110];
RGB[T.ASPHALT] = [52, 52, 54];
RGB[T.RAIL] = [90, 78, 64];
RGB[T.BEDROCK] = [28, 28, 30];
RGB[T.VINE] = [46, 88, 42];
RGB[T.MOSS] = [58, 92, 48];
RGB[T.SAPLING] = [70, 120, 52];
RGB[T.LADDER] = [120, 86, 48];
RGB[T.SUPPORT] = [86, 62, 40];
RGB[T.WINDOW] = [150, 190, 210];
RGB[T.TALLGRASS] = [86, 132, 58];
RGB[T.FLOWER] = [190, 80, 90];
RGB[T.SNOW] = [232, 236, 240];
RGB[T.ICE] = [170, 210, 230];
RGB[T.PLANTED] = [90, 130, 50];
RGB[T.RUBBLE] = [108, 96, 84];
RGB[T.BEAM] = [86, 62, 40];
RGB[T.STAIR] = [140, 104, 64];
RGB[T.BACKWALL] = [78, 62, 48];
RGB[T.FLAG] = [160, 40, 40];

const SOLID = new Uint8Array(64);
const WALK = new Uint8Array(64);
const TREE = new Uint8Array(64);
const LIGHT = new Uint8Array(64);
const BUILT = new Uint8Array(64);
const CLIMB = new Uint8Array(64);
const ORE = new Uint8Array(64);

function mark(a: Uint8Array, tiles: number[]) {
  for (const t of tiles) a[t] = 1;
}

mark(SOLID, [
  T.GRASS, T.DIRT, T.STONE, T.DEEP, T.SAND, T.WOOD, T.LEAVES, T.COAL, T.COPPER,
  T.IRON, T.GOLD, T.CLAY, T.PLANKS, T.BRICK, T.STONEBRICK, T.CONCRETE, T.STEEL,
  T.GLASS, T.ROOF, T.FARMLAND, T.CROP, T.PATH, T.COBBLE, T.ASPHALT, T.RAIL,
  T.BEDROCK, T.MOSS, T.WINDOW, T.SNOW, T.ICE, T.PLANTED, T.RUBBLE,
]);
mark(WALK, [
  T.AIR, T.WATER, T.DOOR, T.TORCH, T.LAMP, T.VINE, T.SAPLING, T.LADDER,
  T.TALLGRASS, T.FLOWER, T.SUPPORT, T.STAIR, T.BACKWALL, T.FLAG, T.BEAM,
]);
mark(TREE, [T.WOOD, T.LEAVES, T.SAPLING, T.TALLGRASS, T.FLOWER, T.VINE]);
mark(LIGHT, [T.TORCH, T.LAMP]);
mark(BUILT, [
  T.PLANKS, T.BRICK, T.STONEBRICK, T.CONCRETE, T.STEEL, T.GLASS, T.DOOR, T.ROOF,
  T.TORCH, T.LAMP, T.PATH, T.COBBLE, T.ASPHALT, T.RAIL, T.LADDER, T.SUPPORT,
  T.WINDOW, T.BEAM, T.STAIR, T.RUBBLE, T.BACKWALL, T.FLAG,
]);
mark(CLIMB, [T.LADDER, T.STAIR]);
mark(ORE, [T.COAL, T.COPPER, T.IRON, T.GOLD]);

export const isSolid = (t: number) => SOLID[t] === 1;
export const isWalkThrough = (t: number) => WALK[t] === 1;
export const isTreeish = (t: number) => TREE[t] === 1;
export const isLight = (t: number) => LIGHT[t] === 1;
export const isBuilt = (t: number) => BUILT[t] === 1;
export const isClimb = (t: number) => CLIMB[t] === 1;
export const isOre = (t: number) => ORE[t] === 1;

export const LIGHT_RADIUS: Record<number, number> = { [T.TORCH]: 8, [T.LAMP]: 12 };

export const FACTION_COLORS = [0xb84a3a, 0x3a6bb8, 0x3a8a4a, 0xb88a2a];
export const FACTION_NAMES = ["Redbank", "Ashford", "Greenhollow", "Stoneford"];

export function hashShade(x: number, y: number) {
  let n = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  n = (n ^ (n >>> 13)) >>> 0;
  return (n % 13) - 6;
}
