import { Application, Container, Graphics } from "pixi.js";
import "./style.css";
import PrismWorker from "./simulation.worker?worker&inline";
import type { PilotInput, SimulationCommand, SimulationMessage, SimulationSnapshot } from "./simulation.worker";

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 640;
const appElement = document.getElementById("app") as HTMLElement;
const loadingElement = document.getElementById("loading") as HTMLElement;
const pauseIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const prismIcon = `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 2 9 17H3L12 2Z" stroke="currentColor" stroke-width="1.5"/><path d="m12 2 3 17M12 2 9 19M3 19l9-6 9 6" stroke="currentColor" stroke-width="1" opacity=".6"/></svg>`;

appElement.insertAdjacentHTML(
  "beforeend",
  `
  <div class="hud" id="hud">
    <div class="topbar">
      <div class="brand">
        <div class="brand-mark">${prismIcon}</div>
        <div class="brand-copy"><strong>PRISM PILOT</strong><span>PIXIJS 8 · BEST <b id="best-score">000000</b></span></div>
      </div>
      <div class="stats">
        <div class="stat score"><span class="stat-label">Score</span><span class="stat-value" id="score">000000</span></div>
        <div class="stat wave"><span class="stat-label">Wave</span><span class="stat-value" id="wave">01</span></div>
        <div class="lives" id="lives" aria-label="3 lives"><i class="life"></i><i class="life"></i><i class="life"></i></div>
        <button class="icon-button" id="pause-button" type="button" aria-label="Pause game" title="Pause (P)">${pauseIcon}</button>
      </div>
    </div>
    <div class="combo" id="combo" hidden></div>
    <div class="announcement quiet" id="announcement" aria-live="polite"><strong id="announcement-title"></strong><span id="announcement-detail"></span></div>
    <div class="touch-controls">
      <div class="touch-note">Drag to steer<br />Hold to fire</div>
      <button class="touch-button burst" id="touch-burst" type="button" aria-label="Activate prism burst">PRISM<br />BURST</button>
    </div>
    <div class="bottom-hud">
      <div class="controls-hint"><b>WASD / ARROWS</b> steer &nbsp;·&nbsp; <b>SPACE / HOLD</b> fire<br /><b>SHIFT</b> prism burst &nbsp;·&nbsp; <b>P</b> pause &nbsp;·&nbsp; <b>R</b> restart</div>
      <div class="burst-status">
        <div class="burst-row"><span>Prism burst</span><output id="burst-output">READY</output></div>
        <div class="meter"><i id="burst-meter"></i></div>
      </div>
    </div>
  </div>
  <div class="state-panel" id="pause-panel" hidden>
    <div class="eyebrow">FLIGHT SUSPENDED</div>
    <h1>PRISM<span>PAUSED</span></h1>
    <p>The swarm is holding position. Resume when your reflexes are ready.</p>
    <div class="actions"><button class="action-button" id="resume-button" type="button">Resume flight</button><button class="action-button secondary" id="pause-restart-button" type="button">Restart run</button></div>
  </div>
  <div class="state-panel" id="gameover-panel" hidden>
    <div class="eyebrow">RUN COMPLETE / SIGNAL LOST</div>
    <h1>PRISM<span>OVER</span></h1>
    <div class="final-score"><small>Final score</small><span id="final-score">0</span></div>
    <p id="final-detail">The void remembers every pilot. Calibrate, launch, and chase a new high score.</p>
    <div class="actions"><button class="action-button" id="restart-button" type="button">Fly again</button></div>
  </div>
  <div class="state-panel" id="error-panel" hidden>
    <div class="eyebrow">RENDERER OFFLINE</div>
    <h1>PRISM<span>FAULT</span></h1>
    <p id="error-message">This cartridge needs a browser with WebGL enabled.</p>
    <div class="actions"><button class="action-button" id="reload-button" type="button">Reload cartridge</button></div>
  </div>
  <div id="screen-flash"></div>
`,
);

const scoreElement = document.getElementById("score") as HTMLElement;
const bestElement = document.getElementById("best-score") as HTMLElement;
const waveElement = document.getElementById("wave") as HTMLElement;
const livesElement = document.getElementById("lives") as HTMLElement;
const lifeElements = [...livesElement.querySelectorAll<HTMLElement>(".life")];
const comboElement = document.getElementById("combo") as HTMLElement;
const announcementElement = document.getElementById("announcement") as HTMLElement;
const announcementTitle = document.getElementById("announcement-title") as HTMLElement;
const announcementDetail = document.getElementById("announcement-detail") as HTMLElement;
const burstOutput = document.getElementById("burst-output") as HTMLElement;
const burstMeter = document.getElementById("burst-meter") as HTMLElement;
const pausePanel = document.getElementById("pause-panel") as HTMLElement;
const gameoverPanel = document.getElementById("gameover-panel") as HTMLElement;
const errorPanel = document.getElementById("error-panel") as HTMLElement;
const errorMessage = document.getElementById("error-message") as HTMLElement;
const finalScore = document.getElementById("final-score") as HTMLElement;
const finalDetail = document.getElementById("final-detail") as HTMLElement;
const pauseButton = document.getElementById("pause-button") as HTMLButtonElement;
const touchBurst = document.getElementById("touch-burst") as HTMLButtonElement;

const storageKey = "nexus-prism-pilot-best";
let bestScore = 0;
try {
  bestScore = Math.max(0, Number(localStorage.getItem(storageKey)) || 0);
} catch {
  bestScore = 0;
}
bestElement.textContent = formatScore(bestScore);

function formatScore(value: number) {
  return Math.max(0, Math.floor(value)).toString().padStart(6, "0");
}

function postToParent(message: { type: "GAME_SCORE"; score: number } | { type: "NEXUS_READY" }) {
  if (window.parent !== window) window.parent.postMessage(message, "*");
}

const worker = new PrismWorker();
let latestSnapshot: SimulationSnapshot | undefined;
let workerReady = false;
let rendererReady = false;
let readyPosted = false;
let previousStatus: SimulationSnapshot["status"] = "idle";
let runBestBaseline = bestScore;
let lastBestPersist = 0;
let lastPostedScore = -1;
let destroyed = false;
let viewWidth = window.innerWidth;
let viewHeight = window.innerHeight;
let worldScale = 1;
let worldOffsetX = 0;
let worldOffsetY = 0;

const keys = new Set<string>();
const pointer = { active: false, x: WORLD_WIDTH / 2, y: WORLD_HEIGHT - 92 };
const input: PilotInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
  pointerActive: false,
  pointerX: WORLD_WIDTH / 2,
  pointerY: WORLD_HEIGHT - 92,
};

function send(command: SimulationCommand) {
  if (!destroyed) worker.postMessage(command);
}

function postReady() {
  if (workerReady && rendererReady && !readyPosted) {
    readyPosted = true;
    postToParent({ type: "NEXUS_READY" });
    if (window.parent === window) send({ type: "start" });
  }
}

function showError(message: string) {
  loadingElement.hidden = true;
  pausePanel.hidden = true;
  gameoverPanel.hidden = true;
  errorMessage.textContent = message;
  errorPanel.hidden = false;
}

worker.onmessage = (event: MessageEvent<SimulationMessage>) => {
  const message = event.data;
  if (message.type === "ready") {
    workerReady = true;
    postReady();
  } else if (message.type === "snapshot") {
    latestSnapshot = message.snapshot;
    if (message.snapshot.status === "playing" && previousStatus !== "playing") runBestBaseline = bestScore;
    if (message.snapshot.score > bestScore) bestScore = message.snapshot.score;
    const runEnded = message.snapshot.status === "gameover" && previousStatus !== "gameover";
    if ((message.snapshot.score > runBestBaseline && performance.now() - lastBestPersist > 2000) || runEnded) {
      lastBestPersist = performance.now();
      try {
        localStorage.setItem(storageKey, String(bestScore));
      } catch {
        // Storage is optional in sandboxed embeds.
      }
    }
    if (message.snapshot.score !== lastPostedScore) {
      lastPostedScore = message.snapshot.score;
      postToParent({ type: "GAME_SCORE", score: message.snapshot.score });
    }
    updateHud(message.snapshot);
    postReady();
  }
};
worker.onerror = () => showError("The simulation worker could not start. Reload the cartridge to try again.");

const app = new Application();
const background = new Graphics();
const world = new Container();
const grid = new Graphics();
const planet = new Graphics();
const entities = new Graphics();
const playerGraphic = new Graphics();
const foregroundFlash = new Graphics();

interface Star { x: number; y: number; size: number; speed: number; alpha: number }
let seed = 39;
function seededRandom() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
const stars: Star[] = Array.from({ length: 105 }, () => ({
  x: seededRandom(),
  y: seededRandom(),
  size: 0.6 + seededRandom() * 1.7,
  speed: 5 + seededRandom() * 24,
  alpha: 0.25 + seededRandom() * 0.65,
}));

function updateLayout() {
  viewWidth = Math.max(1, appElement.clientWidth);
  viewHeight = Math.max(1, appElement.clientHeight);
  if (rendererReady) app.renderer.resize(viewWidth, viewHeight);
  worldScale = Math.min(viewWidth / WORLD_WIDTH, viewHeight / WORLD_HEIGHT);
  worldOffsetX = (viewWidth - WORLD_WIDTH * worldScale) / 2;
  worldOffsetY = (viewHeight - WORLD_HEIGHT * worldScale) / 2;
  world.scale.set(worldScale);
  world.position.set(worldOffsetX, worldOffsetY);
}

function updateHud(snapshot: SimulationSnapshot) {
  scoreElement.textContent = formatScore(snapshot.score);
  bestElement.textContent = formatScore(bestScore);
  waveElement.textContent = String(snapshot.wave).padStart(2, "0");
  livesElement.setAttribute("aria-label", `${snapshot.lives} ${snapshot.lives === 1 ? "life" : "lives"}`);
  lifeElements.forEach((element, index) => element.classList.toggle("lost", index >= snapshot.lives));

  const burstProgress = 1 - snapshot.burstCooldown / 9;
  burstMeter.style.transform = `scaleX(${Math.max(0, burstProgress)})`;
  burstOutput.textContent = snapshot.burstCooldown > 0 ? `${snapshot.burstCooldown.toFixed(1)}s` : "READY";
  burstOutput.style.color = snapshot.burstCooldown > 0 ? "#9ba7c5" : "#ffb347";
  touchBurst.classList.toggle("active", snapshot.burstCooldown <= 0);

  comboElement.hidden = snapshot.combo < 3;
  comboElement.textContent = snapshot.combo >= 3 ? `CHAIN ×${snapshot.combo}` : "";
  announcementElement.classList.toggle("quiet", snapshot.announcementTimer <= 0 || !snapshot.announcement);
  announcementTitle.textContent = snapshot.announcement;
  announcementDetail.textContent = snapshot.announcementDetail;

  loadingElement.hidden = snapshot.status !== "idle";
  pausePanel.hidden = snapshot.status !== "paused";
  gameoverPanel.hidden = snapshot.status !== "gameover";
  if (snapshot.status === "gameover" && previousStatus !== "gameover") {
    finalScore.textContent = snapshot.score.toLocaleString();
    finalDetail.textContent = snapshot.score > runBestBaseline && snapshot.score > 0
      ? "New personal best. The prism core is burning brighter than ever."
      : `Best score ${bestScore.toLocaleString()}. The void remembers every pilot.`;
    postToParent({ type: "GAME_SCORE", score: snapshot.score });
  }
  previousStatus = snapshot.status;
}

function rotatePoints(x: number, y: number, points: number[], angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotated: number[] = [];
  for (let index = 0; index < points.length; index += 2) {
    rotated.push(x + points[index] * cos - points[index + 1] * sin, y + points[index] * sin + points[index + 1] * cos);
  }
  return rotated;
}

function polygon(x: number, y: number, radius: number, sides: number, rotation = 0) {
  const points: number[] = [];
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (index / sides) * Math.PI * 2;
    points.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  return points;
}

function drawBackground(time: number) {
  background.clear().rect(0, 0, viewWidth, viewHeight).fill(0x050611);
  background.circle(viewWidth * 0.76, viewHeight * 0.28, Math.max(viewWidth, viewHeight) * 0.38).fill({ color: 0x5b238a, alpha: 0.09 });
  background.circle(viewWidth * 0.2, viewHeight * 0.8, Math.max(viewWidth, viewHeight) * 0.32).fill({ color: 0x087d91, alpha: 0.07 });
  for (const star of stars) {
    const y = (star.y * viewHeight + time * star.speed) % viewHeight;
    const x = star.x * viewWidth;
    background.circle(x, y, star.size).fill({ color: 0xcdefff, alpha: star.alpha });
    if (star.size > 1.9) background.moveTo(x, y - star.size * 3).lineTo(x, y).stroke({ color: 0x8defff, alpha: star.alpha * 0.45, width: 0.7 });
  }

  planet.clear();
  planet.circle(795, 148, 78).fill({ color: 0x35155f, alpha: 0.72 });
  planet.circle(774, 128, 61).fill({ color: 0x623495, alpha: 0.28 });
  planet.circle(795, 148, 80).stroke({ color: 0xb783ff, alpha: 0.24, width: 2 });
  planet.ellipse(795, 148, 124, 25).stroke({ color: 0x54f3ef, alpha: 0.2, width: 3 });
  planet.ellipse(795, 148, 112, 18).stroke({ color: 0xff4fae, alpha: 0.13, width: 2 });

  grid.clear();
  const horizon = 174;
  for (let index = -6; index <= 6; index += 1) {
    grid.moveTo(WORLD_WIDTH / 2 + index * 14, horizon).lineTo(WORLD_WIDTH / 2 + index * 128, WORLD_HEIGHT).stroke({ color: 0x38578c, alpha: 0.17, width: 1 });
  }
  for (let index = 0; index < 11; index += 1) {
    const progress = ((index / 11 + time * 0.055) % 1) ** 2;
    const y = horizon + progress * (WORLD_HEIGHT - horizon);
    grid.moveTo(0, y).lineTo(WORLD_WIDTH, y).stroke({ color: 0x54f3ef, alpha: 0.05 + progress * 0.09, width: 1 });
  }
  grid.moveTo(26, 58).lineTo(26, WORLD_HEIGHT - 26).stroke({ color: 0x54f3ef, alpha: 0.12, width: 1 });
  grid.moveTo(WORLD_WIDTH - 26, 58).lineTo(WORLD_WIDTH - 26, WORLD_HEIGHT - 26).stroke({ color: 0xff4fae, alpha: 0.12, width: 1 });
}

function drawPlayer(snapshot: SimulationSnapshot) {
  const player = snapshot.player;
  playerGraphic.clear();
  playerGraphic.position.set(player.x, player.y);
  playerGraphic.rotation = Math.max(-0.2, Math.min(0.2, player.vx / 2200));
  const flicker = player.invulnerable > 0 && Math.sin(snapshot.elapsed * 34) > 0.25;
  playerGraphic.alpha = flicker ? 0.42 : 1;

  const flame = 17 + Math.sin(snapshot.elapsed * 28) * 5 + (snapshot.player.rapid > 0 ? 7 : 0);
  playerGraphic.poly([-10, 23, 0, 25 + flame, 10, 23]).fill({ color: 0xff9b42, alpha: 0.22 });
  playerGraphic.poly([-5, 22, 0, 23 + flame * 0.75, 5, 22]).fill(0xffe5a3);
  playerGraphic.poly([0, -31, 13, -7, 34, 20, 12, 15, 0, 27, -12, 15, -34, 20, -13, -7]).fill({ color: 0x133d62, alpha: 0.95 }).stroke({ color: 0x54f3ef, width: 2 });
  playerGraphic.poly([0, -31, 8, 4, 0, 22, -8, 4]).fill(0x9bfbff).stroke({ color: 0xffffff, alpha: 0.7, width: 1 });
  playerGraphic.poly([-12, -4, -29, 17, -11, 12]).fill(0xff4fae);
  playerGraphic.poly([12, -4, 29, 17, 11, 12]).fill(0xff4fae);
  playerGraphic.circle(0, -7, 4.5).fill(0xffffff);

  if (player.shield > 0) {
    playerGraphic.circle(0, 0, 40 + Math.sin(snapshot.elapsed * 5) * 2).stroke({ color: 0x54f3ef, alpha: 0.35 + Math.sin(snapshot.elapsed * 8) * 0.12, width: 2 });
    playerGraphic.circle(0, 0, 44).stroke({ color: 0xb8ffff, alpha: 0.13, width: 5 });
  }
}

function drawEntities(snapshot: SimulationSnapshot) {
  entities.clear();
  for (const enemy of snapshot.enemies) {
    const rotation = snapshot.elapsed * (enemy.kind === "weaver" ? 1.7 : 0.65) + enemy.phase;
    const color = enemy.kind === "tank" ? 0xff9b42 : enemy.kind === "weaver" ? 0x54f3ef : 0xff4fae;
    if (enemy.kind === "scout") {
      entities.poly(rotatePoints(enemy.x, enemy.y, [0, -22, 18, 2, 10, 19, 0, 11, -10, 19, -18, 2], rotation)).fill({ color: 0x35132f, alpha: 0.96 }).stroke({ color, width: 2 });
      entities.poly(polygon(enemy.x, enemy.y, 7, 4, rotation)).fill(color);
    } else if (enemy.kind === "weaver") {
      entities.poly(polygon(enemy.x, enemy.y, enemy.radius, 6, rotation)).fill({ color: 0x0c3447, alpha: 0.96 }).stroke({ color, width: 2 });
      entities.poly(polygon(enemy.x, enemy.y, 10, 3, -rotation)).fill({ color: 0xb8ffff, alpha: 0.8 });
      entities.circle(enemy.x, enemy.y, 27).stroke({ color, alpha: 0.2, width: 1 });
    } else {
      entities.poly(polygon(enemy.x, enemy.y, enemy.radius, 8, rotation)).fill({ color: 0x3c211d, alpha: 0.97 }).stroke({ color, width: 3 });
      entities.poly(polygon(enemy.x, enemy.y, 15, 4, -rotation)).fill(0xffd39b);
      entities.rect(enemy.x - 20, enemy.y - 34, 40, 3).fill({ color: 0xffffff, alpha: 0.12 });
      entities.rect(enemy.x - 20, enemy.y - 34, 40 * (enemy.hp / enemy.maxHp), 3).fill(color);
    }
  }

  for (const bullet of snapshot.bullets) {
    if (bullet.friendly) {
      entities.moveTo(bullet.x, bullet.y + 13).lineTo(bullet.x, bullet.y - 9).stroke({ color: bullet.color, alpha: 0.16, width: 10 });
      entities.moveTo(bullet.x, bullet.y + 9).lineTo(bullet.x, bullet.y - 8).stroke({ color: bullet.color, alpha: 0.95, width: 3 });
      entities.moveTo(bullet.x, bullet.y + 4).lineTo(bullet.x, bullet.y - 6).stroke({ color: 0xffffff, alpha: 0.9, width: 1 });
    } else {
      entities.circle(bullet.x, bullet.y, 11).fill({ color: bullet.color, alpha: 0.12 });
      entities.poly(polygon(bullet.x, bullet.y, 6, 4, snapshot.elapsed * 4)).fill(bullet.color);
      entities.circle(bullet.x, bullet.y, 2.4).fill(0xfff2fa);
    }
  }

  for (const pickup of snapshot.pickups) {
    const color = pickup.kind === "rapid" ? 0xffb347 : 0x54f3ef;
    const rotation = snapshot.elapsed * 1.8;
    entities.circle(pickup.x, pickup.y, 21).fill({ color, alpha: 0.08 });
    entities.poly(polygon(pickup.x, pickup.y, 14, 6, rotation)).fill({ color: 0x081829, alpha: 0.9 }).stroke({ color, width: 2 });
    if (pickup.kind === "rapid") {
      entities.poly([pickup.x, pickup.y - 7, pickup.x + 6, pickup.y + 5, pickup.x - 6, pickup.y + 5]).fill(color);
    } else if (pickup.kind === "shield") {
      entities.poly([pickup.x, pickup.y - 7, pickup.x + 6, pickup.y - 3, pickup.x + 4, pickup.y + 5, pickup.x, pickup.y + 8, pickup.x - 4, pickup.y + 5, pickup.x - 6, pickup.y - 3]).stroke({ color, width: 2 });
    } else {
      entities.rect(pickup.x - 6, pickup.y - 2, 12, 4).fill(color);
      entities.rect(pickup.x - 2, pickup.y - 6, 4, 12).fill(color);
    }
  }

  for (const particle of snapshot.particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    entities.rect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size).fill({ color: particle.color, alpha });
  }
  for (const effect of snapshot.effects) {
    const alpha = Math.max(0, effect.life / effect.maxLife);
    entities.circle(effect.x, effect.y, effect.radius).stroke({ color: effect.color, alpha: alpha * 0.8, width: effect.kind === "ring" ? 3 : 7 });
    if (effect.kind === "ring") entities.circle(effect.x, effect.y, effect.radius * 0.78).stroke({ color: 0xffffff, alpha: alpha * 0.28, width: 1 });
  }
}

function render() {
  if (destroyed) return;
  const time = performance.now() / 1000;
  drawBackground(time);
  const snapshot = latestSnapshot;
  if (snapshot) {
    const shakeX = snapshot.shake > 0 ? Math.sin(time * 97) * snapshot.shake * worldScale : 0;
    const shakeY = snapshot.shake > 0 ? Math.cos(time * 83) * snapshot.shake * 0.6 * worldScale : 0;
    world.position.set(worldOffsetX + shakeX, worldOffsetY + shakeY);
    drawEntities(snapshot);
    drawPlayer(snapshot);
    foregroundFlash.clear();
    if (snapshot.flash > 0) foregroundFlash.rect(0, 0, viewWidth, viewHeight).fill({ color: 0xff5b9d, alpha: snapshot.flash * 0.32 });
  } else {
    entities.clear();
    playerGraphic.clear();
    foregroundFlash.clear();
  }
}

function refreshInput() {
  input.left = keys.has("arrowleft") || keys.has("a");
  input.right = keys.has("arrowright") || keys.has("d");
  input.up = keys.has("arrowup") || keys.has("w");
  input.down = keys.has("arrowdown") || keys.has("s");
  input.fire = keys.has(" ");
  input.pointerActive = pointer.active;
  input.pointerX = pointer.x;
  input.pointerY = pointer.y;
  send({ type: "input", input: { ...input } });
}

function clearInput() {
  keys.clear();
  pointer.active = false;
  refreshInput();
}

function pauseGame() {
  if (latestSnapshot?.status === "playing") {
    clearInput();
    send({ type: "pause" });
  }
}

function resumeGame() {
  if (latestSnapshot?.status === "paused") {
    clearInput();
    send({ type: "resume" });
  }
}

function restartGame() {
  clearInput();
  send({ type: "restart" });
}

function togglePause() {
  if (latestSnapshot?.status === "playing") pauseGame();
  else if (latestSnapshot?.status === "paused") resumeGame();
}

function pointerToWorld(event: PointerEvent) {
  const bounds = app.canvas.getBoundingClientRect();
  pointer.x = Math.max(0, Math.min(WORLD_WIDTH, (event.clientX - bounds.left - worldOffsetX) / worldScale));
  pointer.y = Math.max(0, Math.min(WORLD_HEIGHT, (event.clientY - bounds.top - worldOffsetY) / worldScale));
}

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  pointer.active = true;
  pointerToWorld(event);
  app.canvas.setPointerCapture(event.pointerId);
  app.canvas.focus({ preventScroll: true });
  refreshInput();
}

function onPointerMove(event: PointerEvent) {
  if (!pointer.active) return;
  event.preventDefault();
  pointerToWorld(event);
}

function onPointerUp(event: PointerEvent) {
  pointer.active = false;
  if (app.canvas.hasPointerCapture(event.pointerId)) app.canvas.releasePointerCapture(event.pointerId);
  refreshInput();
}

function onKeyDown(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "w", "a", "s", "d", "p", "r", "shift"].includes(key)) event.preventDefault();
  if ((key === "p" || key === "escape") && !event.repeat) {
    togglePause();
    return;
  }
  if (key === "r" && !event.repeat) {
    restartGame();
    return;
  }
  if (key === "shift" && !event.repeat) {
    send({ type: "burst" });
    return;
  }
  keys.add(key);
  refreshInput();
}

function onKeyUp(event: KeyboardEvent) {
  keys.delete(event.key.toLowerCase());
  refreshInput();
}

function onMessage(event: MessageEvent) {
  if (event.source !== window.parent) return;
  const data = event.data as { type?: unknown; active?: unknown } | null;
  if (!data || typeof data !== "object") return;
  if (data.type === "NEXUS_PLAY" && latestSnapshot?.status !== "playing") send({ type: "start" });
  if (data.type === "NEXUS_FULLSCREEN" && typeof data.active === "boolean") {
    appElement.dataset.fullscreen = String(data.active);
    updateLayout();
  }
}

pauseButton.addEventListener("click", togglePause);
touchBurst.addEventListener("click", () => send({ type: "burst" }));
document.getElementById("resume-button")?.addEventListener("click", resumeGame);
document.getElementById("pause-restart-button")?.addEventListener("click", restartGame);
document.getElementById("restart-button")?.addEventListener("click", restartGame);
document.getElementById("reload-button")?.addEventListener("click", () => window.location.reload());

async function initialize() {
  try {
    await app.init({
      width: viewWidth,
      height: viewHeight,
      background: 0x050611,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: "webgl",
      powerPreference: "high-performance",
    });
    if (destroyed) return;
    app.canvas.id = "game-canvas";
    app.canvas.setAttribute("aria-label", "Prism Pilot game surface. Use WASD or arrow keys to steer and Space to fire.");
    app.canvas.tabIndex = 0;
    app.canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    app.canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    app.canvas.addEventListener("pointerup", onPointerUp);
    app.canvas.addEventListener("pointercancel", onPointerUp);
    appElement.prepend(app.canvas);
    app.stage.addChild(background, world, foregroundFlash);
    world.addChild(grid, planet, entities, playerGraphic);
    rendererReady = true;
    updateLayout();
    app.ticker.add(render);
    postReady();
  } catch {
    showError("This cartridge needs WebGL. Enable hardware acceleration or try a current browser.");
  }
}

initialize();

const inputTimer = window.setInterval(refreshInput, 1000 / 30);
const resizeObserver = new ResizeObserver(updateLayout);
resizeObserver.observe(appElement);
window.addEventListener("resize", updateLayout);
window.addEventListener("keydown", onKeyDown, { passive: false });
window.addEventListener("keyup", onKeyUp);
window.addEventListener("message", onMessage);
window.addEventListener("blur", pauseGame);
function onVisibilityChange() {
  if (document.hidden) pauseGame();
}
document.addEventListener("visibilitychange", onVisibilityChange);

function destroy() {
  if (destroyed) return;
  destroyed = true;
  window.clearInterval(inputTimer);
  resizeObserver.disconnect();
  window.removeEventListener("resize", updateLayout);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("message", onMessage);
  window.removeEventListener("blur", pauseGame);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  worker.terminate();
  if (rendererReady) app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true, context: true });
}
window.addEventListener("pagehide", destroy, { once: true });
