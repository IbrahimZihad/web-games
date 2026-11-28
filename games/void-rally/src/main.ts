import * as THREE from "three";
import "./style.css";

const appElement = document.getElementById("app") as HTMLElement;
const loadingElement = document.getElementById("loading") as HTMLElement;
const pauseIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const rallyIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 15 3-7h10l3 7M7 15h10M3 15h18v4H3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 11h10" stroke="currentColor" opacity=".55"/></svg>`;

appElement.insertAdjacentHTML(
  "beforeend",
  `
  <div class="hud" id="hud">
    <div class="topbar">
      <div class="brand">
        <div class="brand-mark">${rallyIcon}</div>
        <div class="brand-copy"><strong>VOID RALLY</strong><span>THREE.JS · BEST <b id="best-score">0</b></span></div>
      </div>
      <div class="stats">
        <div class="stat score"><span class="stat-label">Score</span><span class="stat-value" id="score">0</span></div>
        <div class="stat"><span class="stat-label">Distance</span><span class="stat-value"><span id="distance">0.00</span><small>KM</small></span></div>
        <div class="stat speed"><span class="stat-label">Velocity</span><span class="stat-value"><span id="speed">0</span><small>KM/H</small></span></div>
        <button class="icon-button" id="pause-button" type="button" aria-label="Pause game" title="Pause (P)">${pauseIcon}</button>
      </div>
    </div>
    <div class="sector"><i></i><span id="sector-label">SECTOR 07 // EVENT HORIZON</span></div>
    <div class="dodge-feed" id="dodge-feed" aria-live="polite"><strong id="feed-title">CLEAN DODGE</strong><span id="feed-detail">+100</span></div>
    <div class="touch-controls">
      <div class="steer-buttons"><button class="touch-button" id="touch-left" type="button" aria-label="Steer left">←</button><button class="touch-button" id="touch-right" type="button" aria-label="Steer right">→</button></div>
      <button class="touch-button boost" id="touch-boost" type="button" aria-label="Hold to boost">BOOST</button>
    </div>
    <div class="bottom-hud">
      <div class="controls-hint"><b>A / D or ← / →</b> switch lanes<br /><b>SPACE</b> hold to boost &nbsp;·&nbsp; <b>P</b> pause &nbsp;·&nbsp; <b>R</b> restart</div>
      <div class="boost-status">
        <div class="boost-row"><span>Flux boost</span><output id="boost-output">100%</output></div>
        <div class="meter"><i id="boost-meter"></i></div>
      </div>
    </div>
  </div>
  <div class="state-panel" id="pause-panel" hidden>
    <div class="eyebrow">RACE SUSPENDED</div>
    <h1>VOID<span>PAUSED</span></h1>
    <p>The highway is holding position. Resume when your reflexes are ready.</p>
    <div class="actions"><button class="action-button" id="resume-button" type="button">Resume race</button><button class="action-button secondary" id="pause-restart-button" type="button">Restart run</button></div>
  </div>
  <div class="state-panel" id="gameover-panel" hidden>
    <div class="eyebrow">RUN COMPLETE / HULL BREACH</div>
    <h1>VOID<span>WRECKED</span></h1>
    <div class="final-score"><small>Final score</small><span id="final-score">0</span></div>
    <p id="final-detail">The void is endless. Your next run can go farther.</p>
    <div class="actions"><button class="action-button" id="restart-button" type="button">Race again</button></div>
  </div>
  <div class="state-panel" id="error-panel" hidden>
    <div class="eyebrow">RENDERER OFFLINE</div>
    <h1>VOID<span>FAULT</span></h1>
    <p id="error-message">This cartridge needs a browser with WebGL enabled.</p>
    <div class="actions"><button class="action-button" id="reload-button" type="button">Reload cartridge</button></div>
  </div>
`,
);

const scoreElement = document.getElementById("score") as HTMLElement;
const bestElement = document.getElementById("best-score") as HTMLElement;
const distanceElement = document.getElementById("distance") as HTMLElement;
const speedElement = document.getElementById("speed") as HTMLElement;
const sectorLabel = document.getElementById("sector-label") as HTMLElement;
const boostOutput = document.getElementById("boost-output") as HTMLElement;
const boostMeter = document.getElementById("boost-meter") as HTMLElement;
const pauseButton = document.getElementById("pause-button") as HTMLButtonElement;
const touchLeft = document.getElementById("touch-left") as HTMLButtonElement;
const touchRight = document.getElementById("touch-right") as HTMLButtonElement;
const touchBoost = document.getElementById("touch-boost") as HTMLButtonElement;
const pausePanel = document.getElementById("pause-panel") as HTMLElement;
const gameoverPanel = document.getElementById("gameover-panel") as HTMLElement;
const errorPanel = document.getElementById("error-panel") as HTMLElement;
const errorMessage = document.getElementById("error-message") as HTMLElement;
const finalScore = document.getElementById("final-score") as HTMLElement;
const finalDetail = document.getElementById("final-detail") as HTMLElement;
const feedElement = document.getElementById("dodge-feed") as HTMLElement;
const feedTitle = document.getElementById("feed-title") as HTMLElement;
const feedDetail = document.getElementById("feed-detail") as HTMLElement;

const storageKey = "nexus-void-rally-best";
let bestScore = 0;
try {
  bestScore = Math.max(0, Number(localStorage.getItem(storageKey)) || 0);
} catch {
  bestScore = 0;
}
bestElement.textContent = Math.floor(bestScore).toLocaleString();

type RunState = "idle" | "running" | "paused" | "gameover";
let state: RunState = "idle";
let playRequested = false;
let launch = () => {};
let resize = () => {};
let cleanUp = () => {};

function postToParent(message: { type: "GAME_SCORE"; score: number } | { type: "NEXUS_READY" }) {
  if (window.parent !== window) window.parent.postMessage(message, "*");
}

function showError(message: string) {
  loadingElement.hidden = true;
  pausePanel.hidden = true;
  gameoverPanel.hidden = true;
  errorMessage.textContent = message;
  errorPanel.hidden = false;
}

function onPortalMessage(event: MessageEvent) {
  if (event.source !== window.parent) return;
  const data = event.data as { type?: unknown; active?: unknown } | null;
  if (!data || typeof data !== "object") return;
  if (data.type === "NEXUS_PLAY") {
    playRequested = true;
    launch();
  }
  if (data.type === "NEXUS_FULLSCREEN" && typeof data.active === "boolean") {
    appElement.dataset.fullscreen = String(data.active);
    resize();
  }
}

window.addEventListener("message", onPortalMessage);
document.getElementById("resume-button")?.addEventListener("click", () => {
  if (state === "paused") launch();
});
document.getElementById("pause-restart-button")?.addEventListener("click", () => {
  state = "gameover";
  launch();
});
document.getElementById("restart-button")?.addEventListener("click", () => {
  state = "gameover";
  launch();
});
document.getElementById("reload-button")?.addEventListener("click", () => window.location.reload());

interface Obstacle {
  group: THREE.Group;
  active: boolean;
  kind: "barrier" | "drone" | "pylon";
  lane: number;
  passed: boolean;
}

interface Pickup {
  group: THREE.Group;
  active: boolean;
  lane: number;
}

interface RoadDash { x: number; z: number }
interface Pylon { x: number; z: number }
interface Building { x: number; z: number; width: number; height: number; depth: number; color: THREE.Color }
interface Streak { x: number; y: number; z: number; length: number }
interface CrashParticle { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }

const LANES = [-6.75, -2.25, 2.25, 6.75];
const PLAYER_Z = 4;

function initialize() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(appElement.clientWidth, appElement.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.id = "game-canvas";
  renderer.domElement.setAttribute("aria-label", "Void Rally game surface. Use A and D or arrow keys to switch lanes, and hold Space to boost.");
  renderer.domElement.tabIndex = 0;
  appElement.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050611);
  scene.fog = new THREE.FogExp2(0x080818, 0.0105);
  const camera = new THREE.PerspectiveCamera(60, appElement.clientWidth / appElement.clientHeight, 0.1, 480);
  camera.position.set(0, 5.4, 13.5);
  camera.lookAt(0, 0.8, -30);

  scene.add(new THREE.HemisphereLight(0x9dc9ff, 0x210820, 1.65));
  const keyLight = new THREE.DirectionalLight(0xc5d8ff, 2.1);
  keyLight.position.set(-10, 18, 8);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xff4fae, 1.25);
  rimLight.position.set(12, 6, -20);
  scene.add(rimLight);

  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x0c1020, roughness: 0.86, metalness: 0.22 });
  const shoulderMaterial = new THREE.MeshStandardMaterial({ color: 0x080b16, roughness: 0.9, metalness: 0.1 });
  const cyanRailMaterial = new THREE.MeshStandardMaterial({ color: 0x54f3ef, emissive: 0x54f3ef, emissiveIntensity: 3.2, roughness: 0.35 });
  const pinkRailMaterial = new THREE.MeshStandardMaterial({ color: 0xff4fae, emissive: 0xff4fae, emissiveIntensity: 3.2, roughness: 0.35 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(20, 440), roadMaterial);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -190);
  scene.add(road);
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 440), shoulderMaterial);
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(side * 11.75, -0.015, -190);
    scene.add(shoulder);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 440), side < 0 ? cyanRailMaterial : pinkRailMaterial);
    rail.position.set(side * 10.05, 0.13, -190);
    scene.add(rail);
  }

  const dashGeometry = new THREE.BoxGeometry(0.085, 0.025, 4.8);
  const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xbac9e8, transparent: true, opacity: 0.42 });
  const dashData: RoadDash[] = [];
  for (const x of [-4.5, 0, 4.5]) {
    for (let index = 0; index < 30; index += 1) dashData.push({ x, z: 22 - index * 14 });
  }
  const dashMesh = new THREE.InstancedMesh(dashGeometry, dashMaterial, dashData.length);
  dashMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(dashMesh);
  const dummy = new THREE.Object3D();

  const pylonGeometry = new THREE.BoxGeometry(0.14, 1.3, 0.14);
  const pylonMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pylonData: Pylon[] = [];
  for (let index = 0; index < 22; index += 1) {
    pylonData.push({ x: -11.2, z: 20 - index * 19 });
    pylonData.push({ x: 11.2, z: 20 - index * 19 });
  }
  const pylonMesh = new THREE.InstancedMesh(pylonGeometry, pylonMaterial, pylonData.length);
  pylonMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pylonData.forEach((pylon, index) => pylonMesh.setColorAt(index, new THREE.Color(pylon.x < 0 ? 0x54f3ef : 0xff4fae)));
  if (pylonMesh.instanceColor) pylonMesh.instanceColor.needsUpdate = true;
  scene.add(pylonMesh);

  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.28, emissive: 0x160b28, emissiveIntensity: 0.45 });
  const rooftopGeometry = new THREE.BoxGeometry(0.16, 0.7, 0.16);
  const rooftopMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const buildings: Building[] = Array.from({ length: 30 }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    return {
      x: side * (15 + Math.random() * 36),
      z: 25 - Math.random() * 390,
      width: 3 + Math.random() * 6,
      height: 5 + Math.random() * 25,
      depth: 3 + Math.random() * 7,
      color: new THREE.Color(index % 3 === 0 ? 0x17132c : index % 3 === 1 ? 0x101a2c : 0x21132b),
    };
  });
  const buildingMesh = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, buildings.length);
  const rooftopMesh = new THREE.InstancedMesh(rooftopGeometry, rooftopMaterial, buildings.length);
  buildingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rooftopMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  buildings.forEach((building, index) => {
    buildingMesh.setColorAt(index, building.color);
    rooftopMesh.setColorAt(index, new THREE.Color(index % 2 === 0 ? 0x54f3ef : 0xff4fae));
  });
  if (buildingMesh.instanceColor) buildingMesh.instanceColor.needsUpdate = true;
  if (rooftopMesh.instanceColor) rooftopMesh.instanceColor.needsUpdate = true;
  scene.add(buildingMesh, rooftopMesh);

  const starPositions = new Float32Array(560 * 3);
  for (let index = 0; index < 560; index += 1) {
    starPositions[index * 3] = (Math.random() - 0.5) * 310;
    starPositions[index * 3 + 1] = 9 + Math.random() * 105;
    starPositions[index * 3 + 2] = -45 - Math.random() * 330;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xb8d9ff, size: 0.42, transparent: true, opacity: 0.8, sizeAttenuation: true, fog: false });
  scene.add(new THREE.Points(starGeometry, starMaterial));

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(17, 28, 20),
    new THREE.MeshStandardMaterial({ color: 0x352056, emissive: 0x321852, emissiveIntensity: 0.75, roughness: 0.92 }),
  );
  moon.position.set(-43, 30, -185);
  scene.add(moon);
  const moonRing = new THREE.Mesh(
    new THREE.TorusGeometry(26, 0.16, 8, 72),
    new THREE.MeshBasicMaterial({ color: 0xb47aff, transparent: true, opacity: 0.35, fog: false }),
  );
  moonRing.position.copy(moon.position);
  moonRing.rotation.set(1.18, 0.25, -0.28);
  scene.add(moonRing);

  const streakCount = 44;
  const streakPositions = new Float32Array(streakCount * 6);
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute("position", new THREE.BufferAttribute(streakPositions, 3).setUsage(THREE.DynamicDrawUsage));
  const streakMaterial = new THREE.LineBasicMaterial({ color: 0x83f7ff, transparent: true, opacity: 0.28, fog: false });
  const streakLines = new THREE.LineSegments(streakGeometry, streakMaterial);
  scene.add(streakLines);
  const streaks: Streak[] = Array.from({ length: streakCount }, () => ({
    x: (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 24),
    y: 0.5 + Math.random() * 13,
    z: -190 + Math.random() * 220,
    length: 2 + Math.random() * 7,
  }));

  const hullMaterial = new THREE.MeshStandardMaterial({ color: 0x18b9c9, emissive: 0x06414e, emissiveIntensity: 0.7, metalness: 0.78, roughness: 0.26 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x10182b, metalness: 0.72, roughness: 0.34 });
  const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x83f7ff, emissive: 0x1c6b80, emissiveIntensity: 0.8, metalness: 0.55, roughness: 0.12 });
  const orangeMaterial = new THREE.MeshBasicMaterial({ color: 0xffa14a });
  const flameMaterial = new THREE.MeshBasicMaterial({ color: 0x54f3ef, transparent: true, opacity: 0.88 });
  const player = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.72, 2.8, 4), hullMaterial);
  body.rotation.x = -Math.PI / 2;
  body.rotation.z = Math.PI / 4;
  body.position.y = 0.47;
  player.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.13, 0.88), hullMaterial);
  wing.position.set(0, 0.36, 0.42);
  wing.rotation.y = -0.04;
  player.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.72), darkMaterial);
  tail.position.set(0, 0.53, 1.02);
  player.add(tail);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 9), glassMaterial);
  cockpit.scale.set(1, 0.55, 1.5);
  cockpit.position.set(0, 0.87, -0.25);
  player.add(cockpit);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.95), orangeMaterial);
    tip.position.set(side * 1.53, 0.4, 0.42);
    player.add(tip);
    const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.23, 0.82, 10), darkMaterial);
    thruster.rotation.x = Math.PI / 2;
    thruster.position.set(side * 0.43, 0.4, 1.03);
    player.add(thruster);
  }
  const flames: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1.05, 8), flameMaterial);
    flame.rotation.x = Math.PI / 2;
    flame.position.set(side * 0.43, 0.4, 1.63);
    player.add(flame);
    flames.push(flame);
  }
  const underglow = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), new THREE.MeshBasicMaterial({ color: 0x54f3ef, transparent: true, opacity: 0.1, depthWrite: false }));
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.035;
  player.add(underglow);
  const engineLight = new THREE.PointLight(0x54f3ef, 7, 10, 2);
  engineLight.position.set(0, 0.8, 1.6);
  player.add(engineLight);
  player.position.set(LANES[1], 0, PLAYER_Z);
  scene.add(player);

  const barrierGeometry = new THREE.BoxGeometry(2.75, 1.05, 0.92);
  const hazardGeometry = new THREE.BoxGeometry(2.82, 0.13, 0.96);
  const barrierMaterial = new THREE.MeshStandardMaterial({ color: 0x24182d, metalness: 0.65, roughness: 0.4 });
  const hazardMaterial = new THREE.MeshStandardMaterial({ color: 0xff4fae, emissive: 0xff4fae, emissiveIntensity: 2.8, roughness: 0.35 });
  const droneGeometry = new THREE.OctahedronGeometry(0.86, 0);
  const droneMaterial = new THREE.MeshStandardMaterial({ color: 0xff9b42, emissive: 0xff5a1f, emissiveIntensity: 2.2, metalness: 0.5, roughness: 0.3 });
  const droneRingGeometry = new THREE.TorusGeometry(1.12, 0.07, 6, 18);
  const pylonHazardGeometry = new THREE.ConeGeometry(0.76, 2.1, 4);
  const pylonHazardMaterial = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff6b24, emissiveIntensity: 1.7, metalness: 0.45, roughness: 0.38 });
  const obstacles: Obstacle[] = Array.from({ length: 18 }, () => {
    const group = new THREE.Group();
    const barrier = new THREE.Group();
    barrier.add(new THREE.Mesh(barrierGeometry, barrierMaterial));
    const hazard = new THREE.Mesh(hazardGeometry, hazardMaterial);
    hazard.position.y = 0.54;
    barrier.add(hazard);
    const drone = new THREE.Group();
    const droneCore = new THREE.Mesh(droneGeometry, droneMaterial);
    droneCore.position.y = 1.15;
    const droneRing = new THREE.Mesh(droneRingGeometry, droneMaterial);
    droneRing.rotation.x = Math.PI / 2;
    droneRing.position.y = 1.15;
    drone.add(droneCore, droneRing);
    const pylon = new THREE.Mesh(pylonHazardGeometry, pylonHazardMaterial);
    pylon.position.y = 1.05;
    group.add(barrier, drone, pylon);
    group.visible = false;
    scene.add(group);
    return { group, active: false, kind: "barrier", lane: 0, passed: false };
  });

  const pickupCoreGeometry = new THREE.IcosahedronGeometry(0.3, 0);
  const pickupRingGeometry = new THREE.TorusGeometry(0.62, 0.1, 7, 20);
  const pickupMaterial = new THREE.MeshStandardMaterial({ color: 0x54f3ef, emissive: 0x54f3ef, emissiveIntensity: 2.4, metalness: 0.45, roughness: 0.2 });
  const pickups: Pickup[] = Array.from({ length: 6 }, () => {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(pickupRingGeometry, pickupMaterial);
    const core = new THREE.Mesh(pickupCoreGeometry, pickupMaterial);
    group.add(ring, core);
    group.visible = false;
    scene.add(group);
    return { group, active: false, lane: 0 };
  });

  const crashGeometry = new THREE.IcosahedronGeometry(0.14, 0);
  const crashMaterialA = new THREE.MeshBasicMaterial({ color: 0xffa14a });
  const crashMaterialB = new THREE.MeshBasicMaterial({ color: 0x54f3ef });
  const crashParticles: CrashParticle[] = Array.from({ length: 18 }, (_, index) => {
    const mesh = new THREE.Mesh(crashGeometry, index % 2 === 0 ? crashMaterialA : crashMaterialB);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, velocity: new THREE.Vector3(), life: 0 };
  });

  let lane = 1;
  let distance = 0;
  let scoreValue = 0;
  let speed = 0;
  let boost = 100;
  let boostHeld = false;
  let boosting = false;
  let spawnTimer = 1.15;
  let dodged = 0;
  let shake = 0;
  let feedTimer = 0;
  let lastTime = performance.now();
  let animationFrame = 0;
  let lastPostedScore = -1;
  let lastScorePost = 0;
  let swipeStart: { x: number; y: number } | null = null;
  let destroyed = false;

  function postScore(force = false) {
    const score = Math.floor(scoreValue);
    const now = performance.now();
    if (force || (score !== lastPostedScore && now - lastScorePost > 200)) {
      lastPostedScore = score;
      lastScorePost = now;
      postToParent({ type: "GAME_SCORE", score });
    }
  }

  function showFeed(title: string, detail: string) {
    feedTitle.textContent = title;
    feedDetail.textContent = detail;
    feedTimer = 1.15;
    feedElement.classList.add("show");
  }

  function updateHud(dt = 0) {
    scoreElement.textContent = Math.floor(scoreValue).toLocaleString();
    bestElement.textContent = Math.floor(bestScore).toLocaleString();
    distanceElement.textContent = (distance / 1000).toFixed(2);
    speedElement.textContent = String(Math.round(speed * 4.6));
    boostOutput.textContent = `${Math.round(boost)}%`;
    boostMeter.style.transform = `scaleX(${boost / 100})`;
    touchBoost.classList.toggle("active", boosting);
    sectorLabel.textContent = `SECTOR ${String(7 + Math.floor(distance / 1200)).padStart(2, "0")} // ${distance < 1200 ? "EVENT HORIZON" : distance < 3000 ? "ION EXPRESSWAY" : "THE DEEP VOID"}`;
    feedTimer = Math.max(0, feedTimer - dt);
    if (feedTimer === 0) feedElement.classList.remove("show");
    postScore();
  }

  function shiftLane(direction: number) {
    if (state !== "running") return;
    lane = Math.max(0, Math.min(LANES.length - 1, lane + direction));
  }

  function setBoost(active: boolean) {
    boostHeld = active && state === "running";
  }

  function resetRun() {
    lane = 1;
    distance = 0;
    scoreValue = 0;
    speed = 28;
    boost = 100;
    boostHeld = false;
    boosting = false;
    spawnTimer = 1.15;
    dodged = 0;
    shake = 0;
    feedTimer = 0;
    feedElement.classList.remove("show");
    player.visible = true;
    player.position.set(LANES[lane], 0, PLAYER_Z);
    player.rotation.set(0, 0, 0);
    for (const obstacle of obstacles) {
      obstacle.active = false;
      obstacle.group.visible = false;
    }
    for (const pickup of pickups) {
      pickup.active = false;
      pickup.group.visible = false;
    }
    for (const particle of crashParticles) {
      particle.life = 0;
      particle.mesh.visible = false;
    }
    lastTime = performance.now();
    lastPostedScore = -1;
    postScore(true);
  }

  function startRun() {
    if (state === "running") return;
    if (state === "paused") {
      state = "running";
      boostHeld = false;
      lastTime = performance.now();
    } else {
      resetRun();
      state = "running";
    }
    loadingElement.hidden = true;
    pausePanel.hidden = true;
    gameoverPanel.hidden = true;
    errorPanel.hidden = true;
    renderer.domElement.focus({ preventScroll: true });
  }

  function pauseRun() {
    if (state !== "running") return;
    state = "paused";
    boostHeld = false;
    boosting = false;
    pausePanel.hidden = false;
    lastTime = performance.now();
  }

  function togglePause() {
    if (state === "running") pauseRun();
    else if (state === "paused") startRun();
  }

  function endRun() {
    if (state !== "running") return;
    state = "gameover";
    boostHeld = false;
    boosting = false;
    shake = 1;
    player.visible = false;
    crashParticles.forEach((particle, index) => {
      const angle = (index / crashParticles.length) * Math.PI * 2;
      particle.mesh.position.copy(player.position).add(new THREE.Vector3(0, 0.6, 0));
      particle.velocity.set(Math.cos(angle) * (2.5 + Math.random() * 4), 2.5 + Math.random() * 5, Math.sin(angle) * (2.5 + Math.random() * 4));
      particle.life = 1.4 + Math.random() * 0.6;
      particle.mesh.scale.setScalar(1);
      particle.mesh.visible = true;
    });
    if (scoreValue > bestScore) {
      bestScore = Math.floor(scoreValue);
      try {
        localStorage.setItem(storageKey, String(bestScore));
      } catch {
        // Storage is optional in sandboxed embeds.
      }
    }
    finalScore.textContent = Math.floor(scoreValue).toLocaleString();
    finalDetail.textContent = `${(distance / 1000).toFixed(2)} km travelled · ${dodged} clean dodges · best ${bestScore.toLocaleString()}`;
    gameoverPanel.hidden = false;
    postScore(true);
  }

  function spawnRow() {
    const available = [0, 1, 2, 3];
    for (let index = available.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [available[index], available[swap]] = [available[swap], available[index]];
    }
    const count = distance > 2200 && Math.random() > 0.55 ? 3 : Math.random() > 0.38 ? 2 : 1;
    const blocked = available.slice(0, count);
    for (const blockedLane of blocked) {
      const obstacle = obstacles.find((candidate) => !candidate.active);
      if (!obstacle) break;
      const roll = Math.random();
      obstacle.kind = roll > 0.72 ? "drone" : roll > 0.42 ? "pylon" : "barrier";
      obstacle.lane = blockedLane;
      obstacle.passed = false;
      obstacle.active = true;
      obstacle.group.visible = true;
      obstacle.group.position.set(LANES[blockedLane], 0, -195);
      obstacle.group.children.forEach((child, index) => { child.visible = index === (obstacle.kind === "barrier" ? 0 : obstacle.kind === "drone" ? 1 : 2); });
    }
    if (Math.random() < 0.48) {
      const freeLane = available[count];
      const pickup = pickups.find((candidate) => !candidate.active);
      if (pickup && freeLane !== undefined) {
        pickup.active = true;
        pickup.lane = freeLane;
        pickup.group.visible = true;
        pickup.group.position.set(LANES[freeLane], 1.05, -198);
      }
    }
  }

  function updateRoad(dt: number, roadSpeed: number) {
    dashData.forEach((dash, index) => {
      dash.z += roadSpeed * dt;
      if (dash.z > 28) dash.z -= 420;
      dummy.position.set(dash.x, 0.028, dash.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      dashMesh.setMatrixAt(index, dummy.matrix);
    });
    dashMesh.instanceMatrix.needsUpdate = true;

    pylonData.forEach((pylon, index) => {
      pylon.z += roadSpeed * dt;
      if (pylon.z > 28) pylon.z -= 418;
      dummy.position.set(pylon.x, 0.65, pylon.z);
      dummy.updateMatrix();
      pylonMesh.setMatrixAt(index, dummy.matrix);
    });
    pylonMesh.instanceMatrix.needsUpdate = true;

    buildings.forEach((building, index) => {
      building.z += roadSpeed * dt * 0.42;
      if (building.z > 45) building.z -= 410;
      dummy.position.set(building.x, building.height / 2 - 0.2, building.z);
      dummy.scale.set(building.width, building.height, building.depth);
      dummy.updateMatrix();
      buildingMesh.setMatrixAt(index, dummy.matrix);
      dummy.position.set(building.x, building.height + 0.15, building.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      rooftopMesh.setMatrixAt(index, dummy.matrix);
    });
    buildingMesh.instanceMatrix.needsUpdate = true;
    rooftopMesh.instanceMatrix.needsUpdate = true;

    streaks.forEach((streak, index) => {
      streak.z += roadSpeed * dt * 1.7;
      if (streak.z > 28) {
        streak.z = -210 - Math.random() * 30;
        streak.x = (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 25);
        streak.y = 0.5 + Math.random() * 14;
      }
      const offset = index * 6;
      streakPositions[offset] = streak.x;
      streakPositions[offset + 1] = streak.y;
      streakPositions[offset + 2] = streak.z;
      streakPositions[offset + 3] = streak.x;
      streakPositions[offset + 4] = streak.y;
      streakPositions[offset + 5] = streak.z + streak.length;
    });
    streakGeometry.attributes.position.needsUpdate = true;
    streakMaterial.opacity = 0.16 + Math.min(0.3, roadSpeed / 180);
  }

  function updateObstacles(dt: number) {
    for (const obstacle of obstacles) {
      if (!obstacle.active) continue;
      const previousZ = obstacle.group.position.z;
      obstacle.group.position.z += speed * dt;
      if (obstacle.kind === "drone") {
        obstacle.group.position.y = Math.sin(performance.now() * 0.004 + obstacle.lane) * 0.16;
        obstacle.group.children[1].rotation.y += dt * 2.4;
      }
      const collisionWidth = obstacle.kind === "drone" ? 1.05 : 1.48;
      const collisionDepth = obstacle.kind === "drone" ? 1.2 : 1.52;
      const crossedPlayerPlane = previousZ < PLAYER_Z && obstacle.group.position.z >= PLAYER_Z;
      const withinCollisionDepth = Math.abs(obstacle.group.position.z - PLAYER_Z) < collisionDepth;
      if (Math.abs(obstacle.group.position.x - player.position.x) < collisionWidth && (withinCollisionDepth || crossedPlayerPlane)) {
        endRun();
        break;
      }
      if (!obstacle.passed && obstacle.group.position.z > PLAYER_Z + 3.2) {
        obstacle.passed = true;
        obstacle.active = false;
        obstacle.group.visible = false;
        dodged += 1;
        const gap = Math.abs(obstacle.group.position.x - player.position.x);
        if (gap < 3.1) {
          scoreValue += 175;
          showFeed("NEAR MISS", "+175");
        } else {
          scoreValue += 100;
          showFeed("CLEAN DODGE", "+100");
        }
      }
    }
  }

  function updatePickups(dt: number, time: number) {
    for (const pickup of pickups) {
      if (!pickup.active) continue;
      const previousZ = pickup.group.position.z;
      pickup.group.position.z += speed * dt;
      pickup.group.rotation.y = time * 2.2;
      pickup.group.rotation.z = Math.sin(time * 1.7) * 0.25;
      const crossedPlayerPlane = previousZ < PLAYER_Z && pickup.group.position.z >= PLAYER_Z;
      if (Math.abs(pickup.group.position.x - player.position.x) < 1.35 && (Math.abs(pickup.group.position.z - PLAYER_Z) < 1.6 || crossedPlayerPlane)) {
        pickup.active = false;
        pickup.group.visible = false;
        boost = 100;
        scoreValue += 300;
        showFeed("FLUX CELL", "BOOST FULL");
      } else if (pickup.group.position.z > 24) {
        pickup.active = false;
        pickup.group.visible = false;
      }
    }
  }

  function updateCrash(dt: number) {
    for (const particle of crashParticles) {
      if (particle.life <= 0) continue;
      particle.life -= dt;
      particle.velocity.y -= dt * 8;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += dt * 5;
      particle.mesh.rotation.y += dt * 4;
      particle.mesh.scale.setScalar(Math.max(0.05, particle.life));
      if (particle.life <= 0) particle.mesh.visible = false;
    }
  }

  function updateRun(dt: number, time: number) {
    const baseSpeed = Math.min(74, 28 + distance * 0.011);
    boosting = boostHeld && boost > 1;
    speed = baseSpeed * (boosting ? 1.52 : 1);
    boost = Math.max(0, Math.min(100, boost + (boosting ? -31 : 10) * dt));
    distance += speed * dt;
    scoreValue += speed * dt * (boosting ? 2.6 : 1.8);
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnRow();
      spawnTimer = Math.max(0.44, 1.18 - distance / 6500) * (0.84 + Math.random() * 0.3);
    }
    updateRoad(dt, speed);
    updateObstacles(dt);
    if (state === "running") updatePickups(dt, time);
    updateCrash(dt);
  }

  function updatePlayer(dt: number, time: number) {
    if (!player.visible) return;
    const targetX = LANES[lane];
    const previousX = player.position.x;
    player.position.x += (targetX - player.position.x) * (1 - Math.exp(-dt * 13));
    const lateralVelocity = (player.position.x - previousX) / Math.max(dt, 0.001);
    player.position.y = 0.03 + Math.sin(time * 3.2) * 0.035;
    player.rotation.z += ((-lateralVelocity * 0.022) - player.rotation.z) * (1 - Math.exp(-dt * 9));
    player.rotation.y += (((targetX - player.position.x) * -0.035) - player.rotation.y) * (1 - Math.exp(-dt * 8));
    flames.forEach((flame, index) => {
      flame.scale.y = (boosting ? 1.85 : 0.85) + Math.sin(time * 28 + index) * 0.14;
      flame.position.z = boosting ? 1.95 : 1.63;
    });
    engineLight.intensity = boosting ? 13 : 7;
  }

  function updateCamera(dt: number, time: number) {
    shake = Math.max(0, shake - dt * 1.7);
    const jitter = shake * 0.32;
    camera.position.x += (player.position.x * 0.22 - camera.position.x) * (1 - Math.exp(-dt * 5));
    camera.position.y = 5.35 + Math.sin(time * 0.7) * 0.045 - (boosting ? 0.18 : 0) + Math.sin(time * 71) * jitter;
    camera.position.z = 13.5 - (boosting ? 0.85 : 0) + Math.cos(time * 63) * jitter;
    const targetFov = 59 + Math.max(0, speed - 28) * 0.12 + (boosting ? 4 : 0);
    camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-dt * 4));
    camera.updateProjectionMatrix();
    camera.lookAt(player.position.x * 0.25, 0.8, -30);
  }

  function frame(now: number) {
    if (destroyed) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    const time = now / 1000;
    if (state === "running") updateRun(dt, time);
    else if (state === "gameover") {
      speed *= Math.exp(-dt * 2.2);
      updateRoad(dt, speed);
      updateCrash(dt);
    }
    if (state !== "paused") {
      updatePlayer(dt, time);
      updateCamera(dt, time);
      moon.rotation.y += dt * 0.015;
      moonRing.rotation.z += dt * 0.008;
    }
    updateHud(dt);
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(frame);
  }

  function onKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", " ", "a", "d", "p", "r", "escape"].includes(key)) event.preventDefault();
    if ((key === "p" || key === "escape") && !event.repeat) {
      togglePause();
      return;
    }
    if (key === "r" && !event.repeat) {
      state = "gameover";
      startRun();
      return;
    }
    if ((key === "arrowleft" || key === "a") && !event.repeat) shiftLane(-1);
    if ((key === "arrowright" || key === "d") && !event.repeat) shiftLane(1);
    if (key === " ") setBoost(true);
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.key === " ") setBoost(false);
  }

  function onCanvasPointerDown(event: PointerEvent) {
    swipeStart = { x: event.clientX, y: event.clientY };
    renderer.domElement.setPointerCapture(event.pointerId);
  }

  function onCanvasPointerUp(event: PointerEvent) {
    if (!swipeStart) return;
    const delta = event.clientX - swipeStart.x;
    if (Math.abs(delta) > 26) shiftLane(delta > 0 ? 1 : -1);
    swipeStart = null;
    if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
  }

  function onBoostDown(event: PointerEvent) {
    event.preventDefault();
    touchBoost.setPointerCapture(event.pointerId);
    setBoost(true);
  }

  function onBoostUp(event: PointerEvent) {
    setBoost(false);
    if (touchBoost.hasPointerCapture(event.pointerId)) touchBoost.releasePointerCapture(event.pointerId);
  }

  function onVisibilityChange() {
    if (document.hidden) pauseRun();
  }

  function onContextLost(event: Event) {
    event.preventDefault();
    pauseRun();
    showError("The WebGL context was interrupted. Reload the cartridge to restart the renderer.");
  }

  resize = () => {
    const width = Math.max(1, appElement.clientWidth);
    const height = Math.max(1, appElement.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  launch = startRun;
  pauseButton.addEventListener("click", togglePause);
  touchLeft.onclick = () => shiftLane(-1);
  touchRight.onclick = () => shiftLane(1);
  touchBoost.addEventListener("pointerdown", onBoostDown, { passive: false });
  touchBoost.addEventListener("pointerup", onBoostUp);
  touchBoost.addEventListener("pointercancel", onBoostUp);
  renderer.domElement.addEventListener("pointerdown", onCanvasPointerDown);
  renderer.domElement.addEventListener("pointerup", onCanvasPointerUp);
  renderer.domElement.addEventListener("pointercancel", onCanvasPointerUp);
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", pauseRun);
  document.addEventListener("visibilitychange", onVisibilityChange);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(appElement);

  updateRoad(0, 0);
  updateHud();
  renderer.render(scene, camera);
  postToParent({ type: "NEXUS_READY" });
  if (window.parent === window || playRequested) startRun();
  animationFrame = requestAnimationFrame(frame);

  cleanUp = () => {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    pauseButton.removeEventListener("click", togglePause);
    touchLeft.onclick = null;
    touchRight.onclick = null;
    touchBoost.removeEventListener("pointerdown", onBoostDown);
    touchBoost.removeEventListener("pointerup", onBoostUp);
    touchBoost.removeEventListener("pointercancel", onBoostUp);
    renderer.domElement.removeEventListener("pointerdown", onCanvasPointerDown);
    renderer.domElement.removeEventListener("pointerup", onCanvasPointerUp);
    renderer.domElement.removeEventListener("pointercancel", onCanvasPointerUp);
    renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
    window.removeEventListener("resize", resize);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("message", onPortalMessage);
    window.removeEventListener("blur", pauseRun);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse((object) => {
      const drawable = object as THREE.Mesh;
      if (drawable.geometry) geometries.add(drawable.geometry);
      if (drawable.material) {
        const objectMaterials = Array.isArray(drawable.material) ? drawable.material : [drawable.material];
        objectMaterials.forEach((material) => materials.add(material));
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}

try {
  initialize();
} catch {
  showError("This cartridge needs WebGL. Enable hardware acceleration or try a current browser.");
}

window.addEventListener("pagehide", () => cleanUp(), { once: true });
