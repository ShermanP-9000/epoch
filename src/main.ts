import { Engine, randomSeed } from "./engine";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const map = document.querySelector<HTMLCanvasElement>("#map")!;
const meta = document.querySelector("#meta")!;
const log = document.querySelector("#log")!;
const start = document.querySelector<HTMLElement>("#start")!;

let engine = new Engine(randomSeed());
engine.onSnap = (s) => {
  meta.textContent = `Year ${s.year.toFixed(1)} · ${s.ageName} · ${s.pop} people · ${s.houses} homes · ${s.focusName}`;
  log.innerHTML = s.events.map((e) => `<div>${e.text}</div>`).join("") || s.activity;
};
engine.attach(canvas, map);

document.querySelector("#watch")!.addEventListener("click", () => {
  start.style.display = "none";
});

document.querySelectorAll<HTMLButtonElement>("[data-speed]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-speed]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    engine.setSpeed(Number(btn.dataset.speed));
  });
});
document.querySelector("#pause")!.addEventListener("click", () => {
  engine.paused = !engine.paused;
});
document.querySelector("#follow")!.addEventListener("click", () => engine.focusTribe());
document.querySelector("#seed")!.addEventListener("click", () => {
  engine.detach();
  engine = new Engine(randomSeed());
  engine.onSnap = (s) => {
    meta.textContent = `Year ${s.year.toFixed(1)} · ${s.ageName} · ${s.pop} people · ${s.houses} homes · ${s.focusName}`;
    log.innerHTML = s.events.map((e) => `<div>${e.text}</div>`).join("") || s.activity;
  };
  engine.attach(canvas, map);
  start.style.display = "none";
});

let dragging = false;
const jump = (e: PointerEvent) => {
  const r = map.getBoundingClientRect();
  engine.jumpToFrac((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
};
map.addEventListener("pointerdown", (e) => { dragging = true; map.setPointerCapture(e.pointerId); jump(e); });
map.addEventListener("pointermove", (e) => { if (dragging) jump(e); });
map.addEventListener("pointerup", () => { dragging = false; });
