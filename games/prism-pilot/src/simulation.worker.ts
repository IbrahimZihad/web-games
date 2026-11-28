export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 640;

const MAX_ENEMIES = 32;
const MAX_PLAYER_BULLETS = 64;
const MAX_ENEMY_BULLETS = 56;
const MAX_PARTICLES = 220;
const MAX_PICKUPS = 8;
const MAX_EFFECTS = 12;
const SNAPSHOT_INTERVAL = 1 / 30;

export type GameStatus = "idle" | "playing" | "paused" | "gameover";
export type EnemyKind = "scout" | "weaver" | "tank";
export type PickupKind = "rapid" | "shield" | "repair";

export interface PilotInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  pointerActive: boolean;
  pointerX: number;
  pointerY: number;
}

export type SimulationCommand =
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "togglePause" }
  | { type: "restart" }
  | { type: "burst" }
  | { type: "input"; input: PilotInput };

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  invulnerable: number;
  shield: number;
  rapid: number;
}

export interface EnemyState {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  baseX: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  phase: number;
  fireTimer: number;
  points: number;
}

export interface BulletState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  friendly: boolean;
  color: number;
}

export interface ParticleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
}

export interface PickupState {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  radius: number;
  life: number;
}

export interface EffectState {
  kind: "ring" | "hit";
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  color: number;
}

export interface SimulationSnapshot {
  status: GameStatus;
  score: number;
  highScore: number;
  lives: number;
  wave: number;
  combo: number;
  comboTimer: number;
  elapsed: number;
  burstCooldown: number;
  shake: number;
  flash: number;
  announcement: string;
  announcementDetail: string;
  announcementTimer: number;
  player: PlayerState;
  enemies: EnemyState[];
  bullets: BulletState[];
  particles: ParticleState[];
  pickups: PickupState[];
  effects: EffectState[];
}

export type SimulationMessage =
  | { type: "ready" }
  | { type: "snapshot"; snapshot: SimulationSnapshot };

interface SimulationState extends Omit<SimulationSnapshot, "highScore"> {
  input: PilotInput;
  highScore: number;
  nextId: number;
  fireTimer: number;
  spawnTimer: number;
  spawnRemaining: number;
  waveCleared: boolean;
  intermission: number;
}

type WorkerScope = {
  postMessage(message: SimulationMessage): void;
  onmessage: ((event: MessageEvent<SimulationCommand>) => void) | null;
};

const scope = self as unknown as WorkerScope;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const random = (min: number, max: number) => min + Math.random() * (max - min);
const distanceSq = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;
const emptyInput = (): PilotInput => ({
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
  pointerActive: false,
  pointerX: WORLD_WIDTH / 2,
  pointerY: WORLD_HEIGHT - 100,
});

function freshState(highScore = 0): SimulationState {
  return {
    status: "idle",
    score: 0,
    highScore,
    lives: 3,
    wave: 1,
    combo: 0,
    comboTimer: 0,
    elapsed: 0,
    burstCooldown: 0,
    shake: 0,
    flash: 0,
    announcement: "",
    announcementDetail: "",
    announcementTimer: 0,
    player: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT - 92, vx: 0, vy: 0, invulnerable: 0, shield: 0, rapid: 0 },
    enemies: [],
    bullets: [],
    particles: [],
    pickups: [],
    effects: [],
    input: emptyInput(),
    nextId: 1,
    fireTimer: 0,
    spawnTimer: 0.55,
    spawnRemaining: 8,
    waveCleared: false,
    intermission: 0,
  };
}

let state = freshState();
let lastTime = performance.now();
let snapshotClock = 0;

function announce(title: string, detail: string, duration = 1.8) {
  state.announcement = title;
  state.announcementDetail = detail;
  state.announcementTimer = duration;
}

function emitSnapshot() {
  const snapshot: SimulationSnapshot = {
    status: state.status,
    score: state.score,
    highScore: state.highScore,
    lives: state.lives,
    wave: state.wave,
    combo: state.combo,
    comboTimer: state.comboTimer,
    elapsed: state.elapsed,
    burstCooldown: state.burstCooldown,
    shake: state.shake,
    flash: state.flash,
    announcement: state.announcement,
    announcementDetail: state.announcementDetail,
    announcementTimer: state.announcementTimer,
    player: { ...state.player },
    enemies: state.enemies,
    bullets: state.bullets,
    particles: state.particles,
    pickups: state.pickups,
    effects: state.effects,
  };
  scope.postMessage({ type: "snapshot", snapshot });
}

function addParticles(x: number, y: number, color: number, count: number, force = 150) {
  for (let index = 0; index < count; index += 1) {
    const angle = random(0, Math.PI * 2);
    const speed = random(force * 0.25, force);
    const life = random(0.25, 0.7);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      size: random(2, 5.5),
      color,
    });
  }
  if (state.particles.length > MAX_PARTICLES) state.particles.splice(0, state.particles.length - MAX_PARTICLES);
}

function addEffect(kind: EffectState["kind"], x: number, y: number, color: number, radius = 20) {
  state.effects.push({ kind, x, y, color, radius, life: kind === "ring" ? 0.55 : 0.22, maxLife: kind === "ring" ? 0.55 : 0.22 });
  if (state.effects.length > MAX_EFFECTS) state.effects.shift();
}

function startGame() {
  state = freshState(state.highScore);
  state.status = "playing";
  state.player.invulnerable = 1.2;
  announce("WAVE 01", "Prism drive online");
  emitSnapshot();
}

function sanitizeInput(input: PilotInput): PilotInput {
  return {
    left: input.left === true,
    right: input.right === true,
    up: input.up === true,
    down: input.down === true,
    fire: input.fire === true,
    pointerActive: input.pointerActive === true,
    pointerX: clamp(Number.isFinite(input.pointerX) ? input.pointerX : WORLD_WIDTH / 2, 0, WORLD_WIDTH),
    pointerY: clamp(Number.isFinite(input.pointerY) ? input.pointerY : WORLD_HEIGHT - 92, 0, WORLD_HEIGHT),
  };
}

function togglePause() {
  if (state.status === "playing") {
    state.status = "paused";
    state.input = emptyInput();
  } else if (state.status === "paused") {
    state.status = "playing";
    lastTime = performance.now();
  }
  emitSnapshot();
}

function spawnEnemy() {
  if (state.enemies.length >= MAX_ENEMIES) return false;
  const roll = Math.random();
  const kind: EnemyKind = state.wave >= 4 && roll > 0.82 ? "tank" : state.wave >= 2 && roll > 0.55 ? "weaver" : "scout";
  const x = random(58, WORLD_WIDTH - 58);
  const hp = kind === "tank" ? 5 + Math.floor(state.wave / 5) : kind === "weaver" ? 2 : 1;
  state.enemies.push({
    id: state.nextId++,
    kind,
    x,
    y: -34,
    baseX: x,
    radius: kind === "tank" ? 26 : kind === "weaver" ? 20 : 17,
    hp,
    maxHp: hp,
    speed: (kind === "tank" ? 46 : kind === "weaver" ? 74 : 66) + state.wave * 4.5 + random(0, 18),
    phase: random(0, Math.PI * 2),
    fireTimer: random(1.1, 2.8),
    points: kind === "tank" ? 320 : kind === "weaver" ? 180 : 100,
  });
  return true;
}

function firePlayer() {
  const spread = state.player.rapid > 0;
  const shots = spread ? [-11, 0, 11] : [-7, 7];
  for (const offset of shots) {
    if (state.bullets.filter((bullet) => bullet.friendly).length >= MAX_PLAYER_BULLETS) break;
    state.bullets.push({
      id: state.nextId++,
      x: state.player.x + offset,
      y: state.player.y - 25,
      vx: spread ? offset * 5 : 0,
      vy: -690,
      radius: 4,
      friendly: true,
      color: spread ? 0xffb347 : offset < 0 ? 0x54f3ef : 0xff4fae,
    });
  }
  state.fireTimer = spread ? 0.095 : 0.16;
}

function fireEnemy(enemy: EnemyState) {
  if (state.bullets.filter((bullet) => !bullet.friendly).length >= MAX_ENEMY_BULLETS) return;
  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  const length = Math.hypot(dx, dy) || 1;
  const speed = Math.min(255, 142 + state.wave * 5);
  state.bullets.push({
    id: state.nextId++,
    x: enemy.x,
    y: enemy.y + enemy.radius,
    vx: (dx / length) * speed,
    vy: (dy / length) * speed,
    radius: 5,
    friendly: false,
    color: enemy.kind === "tank" ? 0xff9b42 : 0xff4fae,
  });
  enemy.fireTimer = random(1.4, 2.8) / (1 + state.wave * 0.035);
}

function destroyEnemy(index: number) {
  const enemy = state.enemies[index];
  if (!enemy) return;
  state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
  state.comboTimer = 2.4;
  const multiplier = Math.min(4, 1 + Math.floor(state.combo / 5) * 0.5);
  state.score = Math.min(999999999, state.score + Math.round(enemy.points * multiplier));
  state.shake = Math.max(state.shake, enemy.kind === "tank" ? 9 : 4);
  addParticles(enemy.x, enemy.y, enemy.kind === "tank" ? 0xff9b42 : 0xff4fae, enemy.kind === "tank" ? 24 : 14, 190);
  addEffect("ring", enemy.x, enemy.y, 0x54f3ef, enemy.radius);
  if (state.pickups.length < MAX_PICKUPS && Math.random() < 0.13) {
    const roll = Math.random();
    state.pickups.push({
      id: state.nextId++,
      kind: roll < 0.4 ? "rapid" : roll < 0.75 ? "shield" : "repair",
      x: enemy.x,
      y: enemy.y,
      radius: 14,
      life: 8,
    });
  }
  state.enemies.splice(index, 1);
}

function damagePlayer() {
  if (state.status !== "playing" || state.player.invulnerable > 0) return;
  if (state.player.shield > 0) {
    state.player.shield = 0;
    state.player.invulnerable = 1;
    addEffect("ring", state.player.x, state.player.y, 0x54f3ef, 48);
    announce("SHIELD ABSORBED", "Hull integrity stable", 1.1);
    return;
  }
  state.lives -= 1;
  state.player.invulnerable = 1.65;
  state.combo = 0;
  state.comboTimer = 0;
  state.shake = 16;
  state.flash = 0.55;
  addParticles(state.player.x, state.player.y, 0xff9b42, 28, 230);
  addEffect("ring", state.player.x, state.player.y, 0xff4fae, 55);
  if (state.lives <= 0) {
    state.status = "gameover";
    state.highScore = Math.max(state.highScore, state.score);
    state.input = emptyInput();
    announce("SIGNAL LOST", "Prism drive offline", 4);
  } else {
    announce("HULL HIT", `${state.lives} ${state.lives === 1 ? "life" : "lives"} remaining`, 1.1);
  }
}

function prismBurst() {
  if (state.status !== "playing" || state.burstCooldown > 0) return;
  state.burstCooldown = 9;
  state.bullets = state.bullets.filter((bullet) => bullet.friendly);
  state.shake = 12;
  state.flash = 0.32;
  addEffect("ring", state.player.x, state.player.y, 0xffb347, 40);
  addParticles(state.player.x, state.player.y, 0x54f3ef, 34, 310);
  for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = state.enemies[index];
    enemy.hp -= 4;
    if (enemy.hp <= 0) destroyEnemy(index);
  }
  state.score = Math.min(999999999, state.score + state.enemies.length * 15);
  announce("PRISM BURST", "Hostile signals cleared", 1.1);
  emitSnapshot();
}

function updatePlayer(dt: number) {
  const player = state.player;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.shield = Math.max(0, player.shield - dt);
  player.rapid = Math.max(0, player.rapid - dt);
  state.burstCooldown = Math.max(0, state.burstCooldown - dt);

  let dx = Number(state.input.right) - Number(state.input.left);
  let dy = Number(state.input.down) - Number(state.input.up);
  const keyboardActive = dx !== 0 || dy !== 0;
  if (state.input.pointerActive && !keyboardActive) {
    dx = clamp((state.input.pointerX - player.x) / 22, -1, 1);
    dy = clamp((state.input.pointerY - player.y) / 22, -1, 1);
  }
  const length = Math.hypot(dx, dy) || 1;
  const speed = 440;
  player.vx = (dx / length) * speed;
  player.vy = (dy / length) * speed;
  player.x = clamp(player.x + player.vx * dt, 28, WORLD_WIDTH - 28);
  player.y = clamp(player.y + player.vy * dt, 70, WORLD_HEIGHT - 34);

  state.fireTimer -= dt;
  if ((state.input.fire || state.input.pointerActive) && state.fireTimer <= 0) firePlayer();
}

function updateWaves(dt: number) {
  if (state.spawnRemaining > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      if (spawnEnemy()) state.spawnRemaining -= 1;
      state.spawnTimer = Math.max(0.3, 1.02 - state.wave * 0.055) * random(0.78, 1.16);
    }
  } else if (state.enemies.length === 0 && !state.waveCleared && state.status === "playing") {
    state.waveCleared = true;
    state.intermission = 1.9;
    state.score = Math.min(999999999, state.score + state.wave * 250);
    announce(`WAVE ${String(state.wave).padStart(2, "0")} CLEAR`, "Sector secure · bonus awarded");
  }

  if (state.waveCleared) {
    state.intermission -= dt;
    if (state.intermission <= 0) {
      state.wave += 1;
      state.spawnRemaining = Math.min(42, 7 + state.wave * 3);
      state.spawnTimer = 0.5;
      state.waveCleared = false;
      announce(`WAVE ${String(state.wave).padStart(2, "0")}`, state.wave % 5 === 0 ? "Heavy signatures detected" : "Hostile swarm inbound");
    }
  }
}

function updateEnemies(dt: number) {
  for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = state.enemies[index];
    enemy.y += enemy.speed * dt;
    const amplitude = enemy.kind === "weaver" ? 92 : enemy.kind === "tank" ? 20 : 38;
    enemy.x = clamp(enemy.baseX + Math.sin(state.elapsed * (enemy.kind === "weaver" ? 2.5 : 1.5) + enemy.phase) * amplitude, 24, WORLD_WIDTH - 24);
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && enemy.y > 20 && enemy.y < WORLD_HEIGHT * 0.7 && (enemy.kind !== "scout" || state.wave >= 3)) {
      fireEnemy(enemy);
    }
    if (distanceSq(enemy.x, enemy.y, state.player.x, state.player.y) < (enemy.radius + 15) ** 2) {
      addParticles(enemy.x, enemy.y, 0xff4fae, 12, 160);
      state.enemies.splice(index, 1);
      damagePlayer();
    } else if (enemy.y > WORLD_HEIGHT + 38) {
      state.enemies.splice(index, 1);
      damagePlayer();
    }
    if (state.status !== "playing") break;
  }
}

function updateBullets(dt: number) {
  for (let bulletIndex = state.bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
    const bullet = state.bullets[bulletIndex];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    let remove = bullet.y < -30 || bullet.y > WORLD_HEIGHT + 30 || bullet.x < -30 || bullet.x > WORLD_WIDTH + 30;

    if (!remove && bullet.friendly) {
      for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
        const enemy = state.enemies[enemyIndex];
        if (distanceSq(bullet.x, bullet.y, enemy.x, enemy.y) < (bullet.radius + enemy.radius) ** 2) {
          enemy.hp -= 1;
          remove = true;
          addParticles(bullet.x, bullet.y, bullet.color, 4, 80);
          if (enemy.hp <= 0) destroyEnemy(enemyIndex);
          break;
        }
      }
    } else if (!remove && distanceSq(bullet.x, bullet.y, state.player.x, state.player.y) < (bullet.radius + 13) ** 2) {
      remove = true;
      damagePlayer();
    }

    if (remove) state.bullets.splice(bulletIndex, 1);
    if (state.status !== "playing") break;
  }
}

function updatePickups(dt: number) {
  for (let index = state.pickups.length - 1; index >= 0; index -= 1) {
    const pickup = state.pickups[index];
    pickup.y += 78 * dt;
    pickup.life -= dt;
    if (distanceSq(pickup.x, pickup.y, state.player.x, state.player.y) < (pickup.radius + 18) ** 2) {
      if (pickup.kind === "rapid") state.player.rapid = 8;
      if (pickup.kind === "shield") state.player.shield = 7;
      if (pickup.kind === "repair") state.lives = Math.min(3, state.lives + 1);
      state.score = Math.min(999999999, state.score + 75);
      addParticles(pickup.x, pickup.y, pickup.kind === "rapid" ? 0xffb347 : 0x54f3ef, 16, 130);
      addEffect("ring", pickup.x, pickup.y, 0x54f3ef, 28);
      announce(pickup.kind === "rapid" ? "RAPID PRISM" : pickup.kind === "shield" ? "AEGIS SHIELD" : "HULL REPAIR", "Module installed", 1);
      state.pickups.splice(index, 1);
    } else if (pickup.life <= 0 || pickup.y > WORLD_HEIGHT + 25) {
      state.pickups.splice(index, 1);
    }
  }
}

function updateEffects(dt: number) {
  for (let index = state.particles.length - 1; index >= 0; index -= 1) {
    const particle = state.particles[index];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 1 - dt * 1.8;
    particle.vy *= 1 - dt * 1.8;
    if (particle.life <= 0) state.particles.splice(index, 1);
  }
  for (let index = state.effects.length - 1; index >= 0; index -= 1) {
    const effect = state.effects[index];
    effect.life -= dt;
    effect.radius += dt * (effect.kind === "ring" ? 230 : 70);
    if (effect.life <= 0) state.effects.splice(index, 1);
  }
  state.shake = Math.max(0, state.shake - dt * 30);
  state.flash = Math.max(0, state.flash - dt * 2.4);
}

function update(dt: number) {
  state.elapsed += dt;
  state.announcementTimer = Math.max(0, state.announcementTimer - dt);
  state.comboTimer = Math.max(0, state.comboTimer - dt);
  if (state.comboTimer === 0) state.combo = 0;
  updatePlayer(dt);
  updateWaves(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updatePickups(dt);
}

scope.onmessage = (event: MessageEvent<SimulationCommand>) => {
  const command = event.data;
  if (!command || typeof command !== "object") return;
  if (command.type === "start" || command.type === "restart") startGame();
  else if (command.type === "pause" && state.status === "playing") togglePause();
  else if (command.type === "resume" && state.status === "paused") togglePause();
  else if (command.type === "togglePause") togglePause();
  else if (command.type === "burst") prismBurst();
  else if (command.type === "input" && command.input) state.input = sanitizeInput(command.input);
};

setInterval(() => {
  const now = performance.now();
  const dt = clamp((now - lastTime) / 1000, 0, 0.034);
  lastTime = now;
  if (state.status === "playing") {
    update(dt);
    updateEffects(dt);
  } else if (state.status !== "paused") {
    updateEffects(dt);
  }
  snapshotClock += dt;
  if (snapshotClock >= SNAPSHOT_INTERVAL && (state.status === "playing" || state.status === "gameover" || state.particles.length > 0 || state.effects.length > 0)) {
    snapshotClock %= SNAPSHOT_INTERVAL;
    emitSnapshot();
  }
}, 16);

scope.postMessage({ type: "ready" });
