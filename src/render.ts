import type { Engine } from "./engine";
import { RGB, W } from "./tiles";

export class Renderer {
  private cache: ImageData | null = null;
  private sheet: HTMLCanvasElement | null = null;

  bakeAll(eng: Engine) {
    const { world } = eng;
    const img = new ImageData(W, world.h);
    const d = img.data;
    for (let y = 0; y < world.h; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const [r, g, b, a] = world.colorAt(x, y);
        const lit = world.light[y * W + x]! / 15;
        const cave = y > world.surface[x]! + 1 ? 0.35 + lit * 0.65 : 1;
        d[i] = Math.floor(r * cave);
        d[i + 1] = Math.floor(g * cave);
        d[i + 2] = Math.floor(b * cave);
        d[i + 3] = a;
      }
    }
    this.cache = img;
    if (!this.sheet) {
      this.sheet = document.createElement("canvas");
      this.sheet.width = W;
      this.sheet.height = world.h;
    }
    this.sheet.getContext("2d")!.putImageData(img, 0, 0);
    world.dirty = false;
  }

  draw(ctx: CanvasRenderingContext2D, eng: Engine, vw: number, vh: number) {
    if (!this.cache || eng.world.dirty) this.bakeAll(eng);
    ctx.fillStyle = "#87b4d4";
    ctx.fillRect(0, 0, vw, vh);
    const z = eng.camera.zoom;
    ctx.imageSmoothingEnabled = false;
    if (this.sheet) ctx.drawImage(this.sheet, -eng.camera.x * z, -eng.camera.y * z, W * z, eng.world.h * z);
    for (const h of eng.sim.humans) {
      const px = (h.x - eng.camera.x) * z;
      const py = (h.y - 1 - eng.camera.y) * z;
      ctx.fillStyle = hex(h.skin);
      ctx.fillRect(px, py, Math.max(2, z * 0.7), Math.max(2, z * 1.6));
      ctx.fillStyle = hex(h.shirt);
      ctx.fillRect(px, py + z * 0.5, Math.max(2, z * 0.7), Math.max(1, z * 0.7));
    }
  }

  drawMinimap(ctx: CanvasRenderingContext2D, eng: Engine, mw: number, mh: number) {
    ctx.fillStyle = "#0b0e0c";
    ctx.fillRect(0, 0, mw, mh);
    const sx = mw / W, sy = mh / eng.world.h;
    for (let x = 0; x < W; x += 6) {
      const g = eng.world.surface[x]!;
      const c = RGB[eng.world.get(x, g)] ?? [80, 80, 80];
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.fillRect(x * sx, g * sy, 6 * sx + 1, mh);
    }
    for (const s of eng.sim.settlements) {
      ctx.fillStyle = hex(s.color);
      ctx.fillRect(s.x * sx - 2, s.y * sy - 2, 4, 4);
    }
    ctx.strokeStyle = "#ece7dc";
    ctx.strokeRect(eng.camera.x * sx, eng.camera.y * sy, (eng.viewW / eng.camera.zoom) * sx, (eng.viewH / eng.camera.zoom) * sy);
  }
}

function hex(n: number) {
  return `#${n.toString(16).padStart(6, "0")}`;
}
