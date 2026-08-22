import { Renderer } from "./render";
import { Sim, type Snapshot } from "./sim";
import { H, W } from "./tiles";
import { World } from "./world";

export type Camera = { x: number; y: number; zoom: number };

export class Engine {
  world: World;
  sim: Sim;
  renderer = new Renderer();
  camera: Camera;
  viewW = 1280;
  viewH = 720;
  speed = 2;
  paused = false;
  following = true;
  running = false;
  keys = new Set<string>();
  dragging = false;
  lastMx = 0;
  lastMy = 0;
  acc = 0;
  lastT = 0;
  raf = 0;
  onSnap: ((s: Snapshot) => void) | null = null;
  private snapAt = 0;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  minimap: HTMLCanvasElement | null = null;

  constructor(seed: number) {
    this.world = new World(seed);
    this.sim = new Sim(this.world);
    const c = this.sim.centroid();
    this.camera = { x: c.x - 80, y: c.y - 40, zoom: 6 };
    this.renderer.bakeAll(this);
  }

  attach(canvas: HTMLCanvasElement, minimap?: HTMLCanvasElement) {
    this.canvas = canvas;
    this.minimap = minimap ?? null;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.bind(canvas);
    this.resize();
    this.running = true;
    this.lastT = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      const raw = Math.min(0.08, (t - this.lastT) / 1000);
      this.lastT = t;
      this.tick(raw);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    (window as unknown as { __epoch?: Engine }).__epoch = this;
  }

  detach() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.canvas = null;
    this.ctx = null;
  }

  setSpeed(n: number) {
    this.paused = n === 0;
    if (n > 0) this.speed = n;
  }

  private bind(canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code === "Space") { e.preventDefault(); this.paused = !this.paused; }
      if (e.code === "Digit1") this.setSpeed(1);
      if (e.code === "Digit2") this.setSpeed(2);
      if (e.code === "Digit3") this.setSpeed(4);
      if (e.code === "Digit4") this.setSpeed(8);
      if (e.code === "Digit5") this.setSpeed(16);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    canvas.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      this.following = false;
      this.lastMx = e.clientX;
      this.lastMy = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    window.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.camera.x -= (e.clientX - this.lastMx) / this.camera.zoom;
      this.camera.y -= (e.clientY - this.lastMy) / this.camera.zoom;
      this.lastMx = e.clientX;
      this.lastMy = e.clientY;
    });
    window.addEventListener("pointerup", () => { this.dragging = false; });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const bx = this.camera.x + mx / this.camera.zoom;
      const by = this.camera.y + my / this.camera.zoom;
      const next = Math.max(1.2, Math.min(18, this.camera.zoom * (e.deltaY > 0 ? 0.9 : 1.12)));
      this.camera.zoom = next;
      this.camera.x = bx - mx / next;
      this.camera.y = by - my / next;
      this.following = false;
    }, { passive: false });
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.viewW = Math.max(1, r.width);
    this.viewH = Math.max(1, r.height);
    this.canvas.width = Math.floor(this.viewW * dpr);
    this.canvas.height = Math.floor(this.viewH * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private tick(dt: number) {
    const sp = (140 / this.camera.zoom) * (this.keys.has("ShiftLeft") ? 2.4 : 1);
    let dx = 0, dy = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) dx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) dx += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) dy -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) dy += 1;
    if (dx || dy) {
      this.following = false;
      this.camera.x += dx * sp * dt * 10;
      this.camera.y += dy * sp * dt * 10;
    }
    if (!this.paused) {
      this.acc += dt * this.speed;
      const STEP = 1 / 30;
      let n = 0;
      while (this.acc >= STEP && n < 24) { this.sim.step(); this.acc -= STEP; n++; }
    }
    if (this.following) {
      const c = this.sim.centroid();
      const tx = c.x - this.viewW / this.camera.zoom / 2;
      const ty = c.y - this.viewH / this.camera.zoom / 1.7;
      const k = 1 - Math.exp(-3.2 * dt);
      this.camera.x += (tx - this.camera.x) * k;
      this.camera.y += (ty - this.camera.y) * k;
    }
    this.clampCam();
    if (this.ctx) this.renderer.draw(this.ctx, this, this.viewW, this.viewH);
    if (this.minimap) {
      const r = this.minimap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (this.minimap.width !== Math.floor(r.width * dpr)) {
        this.minimap.width = Math.floor(r.width * dpr);
        this.minimap.height = Math.floor(r.height * dpr);
      }
      const mctx = this.minimap.getContext("2d");
      if (mctx) {
        mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.renderer.drawMinimap(mctx, this, r.width, r.height);
      }
    }
    if (this.onSnap && performance.now() - this.snapAt > 180) {
      this.snapAt = performance.now();
      this.onSnap(this.sim.snapshot(this.speed, this.paused, this.following, this.camera.zoom));
    }
  }

  jumpToFrac(fx: number, fy: number) {
    this.following = false;
    this.camera.x = fx * W - this.viewW / this.camera.zoom / 2;
    this.camera.y = fy * H - this.viewH / this.camera.zoom / 2;
    this.clampCam();
  }

  focusTribe() {
    this.following = true;
    const c = this.sim.centroid();
    this.camera.x = c.x - this.viewW / this.camera.zoom / 2;
    this.camera.y = c.y - this.viewH / this.camera.zoom / 1.6;
  }

  private clampCam() {
    const vw = this.viewW / this.camera.zoom;
    const vh = this.viewH / this.camera.zoom;
    this.camera.x = Math.max(0, Math.min(W - vw, this.camera.x));
    this.camera.y = Math.max(0, Math.min(H - vh, this.camera.y));
  }
}

export function randomSeed() {
  return (Math.floor(Math.random() * 0xffffffff) || 1) >>> 0;
}
