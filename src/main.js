import * as THREE from 'three';
import './style.css';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9aaca9);
scene.fog = new THREE.Fog(0x9aaca9, 48, 165);
const daylightSky = new THREE.Color(0x9aaca9);
const eveningSky = new THREE.Color(0x374345);
const skyColor = new THREE.Color();

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 220);
camera.position.set(0, 1.7, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
document.body.appendChild(renderer.domElement);

const hemisphere = new THREE.HemisphereLight(0xe4eeea, 0x63716e, 2.5);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight(0xfff3d9, 3.2);
sun.position.set(-22, 42, 28);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -65; sun.shadow.camera.right = 65;
sun.shadow.camera.top = 65; sun.shadow.camera.bottom = -65;
scene.add(sun);

const mat = (color, roughness = 0.86, metalness = 0.03) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mat(0x93968a));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
ground.receiveShadow = true;
scene.add(ground);

const road = new THREE.Mesh(new THREE.PlaneGeometry(16, 220), mat(0x626b6c));
road.rotation.x = -Math.PI / 2;
road.position.y = 0.01;
road.receiveShadow = true;
scene.add(road);

for (const x of [-10.5, 10.5]) {
  const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.2, 220), mat(0x9ea089));
  sidewalk.position.set(x, 0.12, 0);
  sidewalk.receiveShadow = true;
  scene.add(sidewalk);
}

const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8d6a0 });
for (let z = -100; z <= 100; z += 12) {
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 5), lineMat);
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(0, 0.02, z);
  scene.add(stripe);
}

const buildingMats = [0xc1b9a7, 0xb5aa98, 0xa9b8b0, 0xb0b4b1, 0xc3b59b, 0x9eadae].map((c) => mat(c, 0.94));
const windowMats = [0x566d70, 0x687a79, 0x71817e].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.47, metalness: 0.08 }));
const signMats = [0xb9684c, 0xc49b50, 0x5c9287, 0x727da2].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.12 }));

function box(w, h, d, material, x, y, z, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

const buildingAccess = [];
const buildingNames = ['Juniper Flats', 'Lantern House', 'Market Lofts', 'Bluebird Studio', 'Cedar Court', 'Sunroom Apartments', 'Old Town Office', 'Canal House', 'Maple Works', 'Cornerstone Inn', 'Orchard Residences', 'Foundry Lofts', 'Mosaic House', 'Garden Apartments', 'Northstar Offices'];
const trimMat = mat(0xc8b78f, 0.58, 0.12);
const sillMat = mat(0x36464a, 0.7, 0.1);

for (const side of [-1, 1]) {
  for (let row = 0; row < 15; row++) {
    const z = -82 + row * 10 + Math.random() * 2;
    const w = 8 + Math.random() * 7;
    const d = 8 + Math.random() * 5;
    const floors = Math.max(2, Math.floor((8 + Math.random() * 13) / 3.1));
    const floorHeight = 3.05;
    const h = floors * floorHeight;
    const x = side * (14 + w / 2 + Math.random() * 3.5);
    const front = x - side * w / 2;
    const wall = buildingMats[Math.floor(Math.random() * buildingMats.length)];
    const name = buildingNames[(row + (side > 0 ? 4 : 0)) % buildingNames.length];

    // These are open-front shells, not solid props: each level has a walkable
    // floor, and the facade is framed around real door and window openings.
    box(0.22, h, d, wall, x + side * (w / 2 - 0.11), h / 2, z);
    box(0.22, h, d, wall, x - side * (w / 2 - 0.11), h / 2, z);
    box(w, h, 0.22, wall, x, h / 2, z - d / 2 + 0.11);
    box(w, 0.28, d, wall, x, h + 0.14, z);

    for (let floor = 0; floor < floors; floor++) {
      const levelY = floor * floorHeight;
      box(w - 0.35, 0.2, d - 0.35, mat(floor % 2 ? 0x726f61 : 0x8b806d), x, levelY, z, false);
    }

    const windowCount = Math.max(2, Math.floor(d / 2.35));
    const windowCenters = Array.from({ length: windowCount }, (_, index) => z - d * 0.31 + index * (d * 0.62 / Math.max(1, windowCount - 1)));
    const windowAccess = [];
    for (let floor = 0; floor < floors; floor++) {
      for (let index = 0; index < windowCenters.length; index++) {
        const windowZ = windowCenters[index];
        const windowY = floor * floorHeight + 1.85;
        if (floor === 0 && Math.abs(windowZ - z) < 1.1) continue; // keep the front door clear
        const frameX = front - side * 0.12;
        const width = 1.42;
        const frame = trimMat;
        box(0.16, 1.35, 0.12, frame, frameX, windowY, windowZ - width / 2, false);
        box(0.16, 1.35, 0.12, frame, frameX, windowY, windowZ + width / 2, false);
        box(0.16, 0.12, width + 0.12, frame, frameX, windowY + 0.68, windowZ, false);
        box(0.16, 0.12, width + 0.12, frame, frameX, windowY - 0.68, windowZ, false);
        box(0.18, 0.12, width, sillMat, frameX, windowY - 0.72, windowZ, false);
        windowAccess.push({ floor, index: index + 1, position: new THREE.Vector3(front + side * 1.5, floor * floorHeight + 1.7, windowZ) });
      }
    }

    // Front supports leave open bays; the central ground-level bay is a door.
    const doorWidth = 1.55;
    const doorFrameX = front - side * 0.12;
    box(0.18, 2.55, 0.14, trimMat, doorFrameX, 1.275, z - doorWidth / 2, false);
    box(0.18, 2.55, 0.14, trimMat, doorFrameX, 1.275, z + doorWidth / 2, false);
    box(0.18, 0.16, doorWidth + 0.14, signMats[row % signMats.length], doorFrameX, 2.55, z, false);

    // Visible vertical piers and roofline identify every floor and aperture.
    for (const edgeZ of [z - d / 2, z + d / 2]) {
      box(0.24, h, 0.24, wall, front, h / 2, edgeZ, false);
    }
    for (let floor = 1; floor < floors; floor++) {
      box(0.22, 0.16, d, trimMat, front, floor * floorHeight, z, false);
    }
    if (row % 3 === 0) {
      box(2.2, 1.8, 2.2, mat(0x464e55), x + side * 1.5, h + 1, z, true);
      box(2.8, 0.25, 2.8, mat(0x9d8c76), x, h + 1.95, z, true);
    }
    box(w * 0.68, 0.62, 0.16, signMats[row % signMats.length], doorFrameX, 3.35, z, false);

    buildingAccess.push({
      id: `${side < 0 ? 'west' : 'east'}-${row + 1}`,
      name: `${name} ${String(row + 1).padStart(2, '0')}`,
      side, x, z, front, floors, floorHeight, doorZ: z,
      door: new THREE.Vector3(front - side * 1.65, 1.7, z),
      windows: windowAccess,
    });
  }
}

const lampMat = new THREE.MeshStandardMaterial({ color: 0x2e3940, metalness: 0.72, roughness: 0.3 });
const lampGlow = new THREE.MeshStandardMaterial({ color: 0xffe6b4, emissive: 0xf2c577, emissiveIntensity: 0.62 });
const trunkMat = mat(0x79624c);
const leafMats = [mat(0x81947a), mat(0xa0a17b), mat(0x708c82)];
const carMats = [0x687a7b, 0x9d7059, 0x818982, 0x53676a, 0xb9a987].map((c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.16, roughness: 0.58 }));

for (let i = 0; i < 12; i++) {
  const z = -84 + i * 12;
  for (const side of [-1, 1]) {
    const x = side * 11.4;
    box(0.18, 5.2, 0.18, lampMat, x, 2.6, z, true);
    box(1.4, 0.12, 0.12, lampMat, x - side * 0.55, 5.1, z, true);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), lampGlow);
    bulb.position.set(x - side * 1.08, 5, z);
    scene.add(bulb);
    if (i % 2 === 0) {
      box(0.32, 1.3, 0.32, trunkMat, side * 12, 0.74, z + 3.8, true);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 1), leafMats[i % leafMats.length]);
      crown.position.set(side * 12, 2.2, z + 3.8);
      crown.scale.set(1, 1.2, 1);
      crown.castShadow = true;
      scene.add(crown);
    }
    if (i % 3 === 1) {
      const car = box(2.1, 1.25, 4.1, carMats[i % carMats.length], side * 7.2, 0.78, z + 2.5, true);
      car.rotation.y = side < 0 ? 0 : Math.PI;
      box(1.75, 0.75, 2, mat(0x2f3b42, 0.3, 0.38), side * 7.2, 1.65, z + 2.35, true);
      for (const wx of [-0.78, 0.78]) {
        for (const wz of [-1.25, 1.25]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 14), mat(0x212628));
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(side * 7.2 + wx, 0.48, z + 2.5 + wz);
          wheel.castShadow = true;
          scene.add(wheel);
        }
      }
    }
  }
}

for (let i = 0; i < 28; i++) {
  const h = 20 + Math.random() * 42;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(7 + Math.random() * 10, h, 10), buildingMats[i % buildingMats.length]);
  tower.position.set((Math.random() - 0.5) * 150, h / 2, -110 - Math.random() * 22);
  tower.castShadow = true;
  scene.add(tower);
}

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const keys = new Set();
let locked = false;

const overlay = document.querySelector('#overlay');
const startBtn = document.querySelector('#startBtn');
const healthFill = document.querySelector('#energyBar');
const hungerFill = document.querySelector('#hungerBar');
const joyFill = document.querySelector('#joyBar');
const moneyLabel = document.querySelector('#moneyLabel');
const dayLabel = document.querySelector('#dayLabel');
const clockLabel = document.querySelector('#clockLabel');
const statusLabel = document.querySelector('#status');

const state = {
  started: false,
  day: 1,
  maxDays: 7,
  time: 7,
  money: 42,
  energy: 100,
  hunger: 100,
  joy: 100,
  yaw: 0,
  pitch: 0,
  interactCooldown: 0,
  mapOpen: false,
  workedToday: false,
  completed: false,
};

const cityMap = document.querySelector('#cityMap');
const buildingList = document.querySelector('#buildingList');
const mapToggle = document.querySelector('#mapToggle');

function travelTo(position, side, label) {
  camera.position.copy(position);
  state.yaw = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  state.pitch = 0;
  camera.rotation.set(0, state.yaw, 0, 'YXZ');
  setStatus(`Arrived at ${label}. Explore this floor and its open windows.`);
  closeCityMap();
}

function addMapButton(parent, text, className, position, side, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.addEventListener('click', () => travelTo(position, side, label));
  parent.append(button);
}

for (const building of buildingAccess) {
  const card = document.createElement('article');
  card.className = 'building-card';
  const heading = document.createElement('div');
  heading.className = 'building-card-heading';
  const title = document.createElement('h3');
  title.textContent = building.name;
  heading.append(title);
  addMapButton(heading, 'Door', 'door-action', new THREE.Vector3(building.front + building.side * 1.5, 1.7, building.doorZ), building.side, `${building.name} entrance`);
  card.append(heading);

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = `${building.floors} floors · ${building.windows.length} accessible windows`;
  details.append(summary);
  for (let floor = 0; floor < building.floors; floor++) {
    const floorRow = document.createElement('div');
    floorRow.className = 'floor-access';
    const floorName = `Floor ${floor + 1}`;
    const floorPosition = new THREE.Vector3(building.front + building.side * 1.5, floor * building.floorHeight + 1.7, building.z);
    addMapButton(floorRow, floorName, 'floor-action', floorPosition, building.side, `${building.name}, ${floorName}`);
    const windows = building.windows.filter((window) => window.floor === floor);
    for (const window of windows) {
      const label = `${floorName}, window ${window.index}`;
      addMapButton(floorRow, `Window ${window.index}`, 'window-action', window.position, building.side, `${building.name}, ${label}`);
    }
    details.append(floorRow);
  }
  card.append(details);
  buildingList.append(card);
}

function openCityMap() {
  state.mapOpen = true;
  document.exitPointerLock?.();
  cityMap.classList.add('open');
  cityMap.setAttribute('aria-hidden', 'false');
  mapToggle.setAttribute('aria-expanded', 'true');
}

function closeCityMap() {
  state.mapOpen = false;
  cityMap.classList.remove('open');
  cityMap.setAttribute('aria-hidden', 'true');
  mapToggle.setAttribute('aria-expanded', 'false');
}

mapToggle.addEventListener('click', () => state.mapOpen ? closeCityMap() : openCityMap());
document.querySelector('#mapClose').addEventListener('click', closeCityMap);
cityMap.addEventListener('click', (event) => {
  if (event.target === cityMap) closeCityMap();
});
document.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && state.mapOpen) closeCityMap();
});

const lifeNodes = [
  { key: 'home', name: 'Home', color: 0x83a998, position: new THREE.Vector3(-12, 1.8, -24), radius: 3.2 },
  { key: 'work', name: 'Office', color: 0x8497a4, position: new THREE.Vector3(-2.5, 1.8, 26), radius: 3.4 },
  { key: 'cafe', name: 'Cafe', color: 0xc28b5e, position: new THREE.Vector3(11.5, 1.8, 20), radius: 3 },
  { key: 'park', name: 'Park', color: 0x87986e, position: new THREE.Vector3(14.5, 1.5, -11), radius: 3.5 },
  { key: 'club', name: 'Night Club', color: 0xa57b84, position: new THREE.Vector3(-15, 1.8, 8), radius: 3.5 },
];

const roomZones = [
  { key: 'home', name: 'Home Room', center: new THREE.Vector3(-12, 0, -24), size: new THREE.Vector3(8, 4.5, 8), color: 0x70f0d7 },
  { key: 'work', name: 'Office Room', center: new THREE.Vector3(-2.5, 0, 26), size: new THREE.Vector3(9, 4.8, 9), color: 0x8abaf5 },
  { key: 'cafe', name: 'Cafe Room', center: new THREE.Vector3(11.5, 0, 20), size: new THREE.Vector3(8, 4.5, 8), color: 0xffb46a },
  { key: 'park', name: 'Park Room', center: new THREE.Vector3(14.5, 0, -11), size: new THREE.Vector3(10, 3.2, 10), color: 0x72d77c },
  { key: 'club', name: 'Night Club Room', center: new THREE.Vector3(-15, 0, 8), size: new THREE.Vector3(10, 4.8, 8), color: 0xf87eb0 },
];

function makeNodeMarker(node) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.35, 0.45, 18), new THREE.MeshStandardMaterial({ color: 0x172830, emissive: node.color, emissiveIntensity: 0.45 }));
  base.position.y = 0.2;
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 16), new THREE.MeshStandardMaterial({ color: node.color, emissive: node.color, emissiveIntensity: 1.8 }));
  orb.position.y = 1.25;
  const light = new THREE.PointLight(node.color, 14, 12);
  light.position.y = 1.1;
  group.add(base, orb, light);
  group.position.copy(node.position);
  scene.add(group);
  node.group = group;
}

for (const node of lifeNodes) {
  makeNodeMarker(node);
}

const citizenPalette = [0x6ec7d9, 0xffb76a, 0xb39ae8, 0xf7d66c, 0x7ae0a0, 0xf38eb0];
const citizens = [];
function makeCitizen(index, x, z) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: citizenPalette[index % citizenPalette.length], roughness: 0.75, metalness: 0.08 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.9, 4, 8), bodyMat);
  body.castShadow = true;
  body.position.y = 0.9;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), new THREE.MeshStandardMaterial({ color: 0xf4e5d4, roughness: 0.9 }));
  head.position.y = 1.63;
  head.castShadow = true;
  group.add(body, head);
  group.position.set(x, 0, z);
  scene.add(group);
  citizens.push({ group, phase: Math.random() * Math.PI * 2, speed: 0.7 + Math.random() * 0.6, drift: 1.2 + Math.random() * 1.8, baseX: x, baseZ: z });
}

for (let i = 0; i < 14; i++) {
  const x = (Math.random() - 0.5) * 28;
  const z = -46 + Math.random() * 62;
  makeCitizen(i, x, z);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(hourValue) {
  const hours = Math.floor(hourValue) % 24;
  const minutes = Math.floor((hourValue % 1) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function setBar(fill, value) {
  fill.style.width = `${clamp(value, 0, 100)}%`;
}

function setStatus(message) {
  statusLabel.textContent = message;
}

function updateHud() {
  setBar(healthFill, state.energy);
  setBar(hungerFill, state.hunger);
  setBar(joyFill, state.joy);
  moneyLabel.textContent = `$${state.money}`;
  dayLabel.textContent = `Day ${state.day}`;
  clockLabel.textContent = formatTime(state.time);
}

function setOverlay(title, text, buttonText) {
  if (title !== 'Neon City Life') {
    overlay.querySelector('h1').textContent = title;
  }
  overlay.querySelector('p').textContent = text;
  startBtn.textContent = buttonText;
  overlay.classList.add('visible');
}

function resetForNewDay() {
  state.time = 7;
  state.workedToday = false;
  camera.position.set(0, 1.7, 8);
  state.yaw = 0;
  state.pitch = 0;
  camera.rotation.set(0, 0, 0, 'YXZ');
  updateHud();
}

function endDay() {
  if (!state.started) return;
  state.started = false;
  document.exitPointerLock?.();

  if (state.day >= state.maxDays) {
    state.completed = true;
    const resultText = `You made it through the week with $${state.money}. Your final needs: ${Math.round(state.energy)} energy, ${Math.round(state.hunger)} hunger, and ${Math.round(state.joy)} mood.`;
    setOverlay('Week complete', resultText, 'Restart life');
    return;
  }

  const previousDay = state.day;
  state.day += 1;
  state.energy = clamp(state.energy + 58, 35, 100);
  state.hunger = clamp(state.hunger - 18, 12, 100);
  state.joy = clamp(state.joy - 8, 12, 100);
  state.money -= 12;
  resetForNewDay();
  setOverlay('Day complete', `Day ${previousDay} is done. Overnight rent and utilities cost $12. You have $${state.money} for the days ahead.`, 'Start next day');
}

function startGame() {
  if (state.completed) {
    state.day = 1;
    state.money = 42;
    state.energy = 100;
    state.hunger = 100;
    state.joy = 100;
    state.completed = false;
  }

  state.started = true;
  overlay.classList.remove('visible');
  renderer.domElement.requestPointerLock?.();
  setStatus('Explore the city and keep your body, wallet, and mood in balance.');
  updateHud();
}

startBtn.addEventListener('click', startGame);

function nearestNode() {
  let best = null;
  for (const node of lifeNodes) {
    const distance = camera.position.distanceTo(node.position);
    if (!best || distance < best.distance) {
      best = { node, distance };
    }
  }
  return best;
}

function inRoom(zone) {
  const dx = Math.abs(camera.position.x - zone.center.x);
  const dy = Math.abs(camera.position.y - zone.center.y);
  const dz = Math.abs(camera.position.z - zone.center.z);
  return dx <= zone.size.x / 2 && dy <= zone.size.y / 2 && dz <= zone.size.z / 2;
}

function currentRoom() {
  for (const zone of roomZones) {
    if (inRoom(zone)) {
      return zone;
    }
  }
  return null;
}

function interact() {
  if (!state.started || state.mapOpen || state.interactCooldown > 0) {
    return;
  }

  const current = currentRoom();
  const closest = nearestNode();
  const targetNode = current ? lifeNodes.find((node) => node.key === current.key) : closest?.node;

  if (!targetNode || (closest && closest.distance > 4.5 && !current)) {
    setStatus('Move inside a building or room to interact.');
    return;
  }

  state.interactCooldown = 0.45;
  let hoursSpent = 0.35;

  switch (targetNode.key) {
    case 'home':
      if (state.time >= 20 || state.time < 7 || state.energy <= 20) {
        setStatus('You call it a night. Rest up and the next day begins.');
        endDay();
      } else {
        state.energy = clamp(state.energy + 32, 0, 100);
        state.hunger = clamp(state.hunger - 8, 0, 100);
        setStatus('A short rest at home helps you recover.');
      }
      break;
    case 'work':
      if (state.workedToday) {
        setStatus('You already worked a shift today. Come back tomorrow.');
      } else if (state.time >= 9 && state.time <= 12) {
        state.money += 45;
        state.workedToday = true;
        state.energy = clamp(state.energy - 20, 0, 100);
        state.hunger = clamp(state.hunger - 18, 0, 100);
        state.joy = clamp(state.joy - 10, 0, 100);
        hoursSpent = 6;
        setStatus('Shift complete: +$45. You worked six hours; take care of yourself.');
      } else {
        setStatus('The shift starts between 09:00 and 12:00. One shift is available each day.');
      }
      break;
    case 'cafe':
      if (state.money >= 8) {
        state.hunger = clamp(state.hunger + 34, 0, 100);
        state.energy = clamp(state.energy + 6, 0, 100);
        state.joy = clamp(state.joy + 5, 0, 100);
        state.money -= 8;
        setStatus('Meal bought for $8. You feel ready to keep moving.');
      } else {
        setStatus('You need $8 for a meal. Try to get a work shift first.');
      }
      break;
    case 'park':
      state.joy = clamp(state.joy + 22, 0, 100);
      state.energy = clamp(state.energy + 5, 0, 100);
      state.hunger = clamp(state.hunger - 6, 0, 100);
      setStatus('A little time outside lifts your mood.');
      break;
    case 'club':
      if (state.money >= 12) {
        state.money -= 12;
        state.joy = clamp(state.joy + 25, 0, 100);
        state.energy = clamp(state.energy - 14, 0, 100);
        setStatus('A night out costs $12, but the music lifts your mood.');
      } else {
        setStatus('You need $12 for a night out.');
      }
      break;
    default:
      break;
  }

  if (state.started) state.time += hoursSpent;
  updateHud();
  if (state.started && (state.time >= 23.8 || state.energy <= 0 || state.hunger <= 0 || state.joy <= 0)) {
    endDay();
  }
}

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
});

document.addEventListener('mousemove', (event) => {
  if (!locked || !state.started) return;
  state.yaw -= event.movementX * 0.0022;
  state.pitch = THREE.MathUtils.clamp(state.pitch - event.movementY * 0.0022, -1.25, 1.25);
  camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
});

document.addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
    event.preventDefault();
  }
  if (event.code === 'KeyE') {
    interact();
  }
  if (event.code === 'KeyM') {
    state.mapOpen ? closeCityMap() : openCityMap();
  }
  if (event.code === 'Escape' && state.started) {
    document.exitPointerLock?.();
  }
});

document.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

renderer.domElement.addEventListener('click', () => {
  if (state.started && !locked) {
    renderer.domElement.requestPointerLock?.();
  } else if (state.started) {
    interact();
  }
});

let touchLook = null;
renderer.domElement.addEventListener('touchstart', (event) => {
  if (event.touches.length !== 1 || !state.started) return;
  const touch = event.touches[0];
  touchLook = { x: touch.clientX, y: touch.clientY };
}, { passive: true });
renderer.domElement.addEventListener('touchmove', (event) => {
  if (!touchLook || !state.started || event.touches.length !== 1) return;
  const touch = event.touches[0];
  state.yaw -= (touch.clientX - touchLook.x) * 0.004;
  state.pitch = THREE.MathUtils.clamp(state.pitch - (touch.clientY - touchLook.y) * 0.003, -1.25, 1.25);
  camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
  touchLook = { x: touch.clientX, y: touch.clientY };
}, { passive: true });
renderer.domElement.addEventListener('touchend', () => { touchLook = null; }, { passive: true });
renderer.domElement.addEventListener('touchcancel', () => { touchLook = null; }, { passive: true });

for (const button of document.querySelectorAll('[data-key]')) {
  const code = button.dataset.key;
  const release = () => keys.delete(code);
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    keys.add(code);
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}

document.querySelector('#touchFire').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  interact();
});

function update(dt) {
  state.interactCooldown = Math.max(0, state.interactCooldown - dt);

  const morning = clamp((state.time - 5) / 2, 0, 1);
  const evening = 1 - clamp((state.time - 18) / 3, 0, 1);
  const daylight = morning * evening;
  skyColor.copy(eveningSky).lerp(daylightSky, daylight);
  scene.background.copy(skyColor);
  scene.fog.color.copy(skyColor);
  sun.intensity = 0.55 + daylight * 2.65;
  hemisphere.intensity = 0.8 + daylight * 1.7;
  sun.color.setRGB(1, 0.88 + daylight * 0.07, 0.68 + daylight * 0.22);

  if (state.started && !state.mapOpen) {
    const move = new THREE.Vector3();
    if (keys.has('KeyW') || keys.has('ArrowUp')) move.z -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) move.z += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) move.x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) move.x += 1;

    move.normalize();
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 7.2 : 4.8;
    const forward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));

    camera.position.addScaledVector(forward, -move.z * speed * dt);
    camera.position.addScaledVector(right, move.x * speed * dt);
    camera.position.x = clamp(camera.position.x, -40, 40);
    camera.position.z = clamp(camera.position.z, -96, 74);

    state.energy = clamp(state.energy - dt * 1.8, 0, 100);
    state.hunger = clamp(state.hunger - dt * 2.2, 0, 100);
    state.joy = clamp(state.joy - dt * 1.4, 0, 100);
    state.time += dt * 0.45;

    if (state.time >= 23.8 || state.energy <= 0 || state.hunger <= 0 || state.joy <= 0) {
      endDay();
      return;
    }

    const room = currentRoom();
    const nearest = nearestNode();
    if (room) {
      setStatus(`${room.name}: press E to act`);
    } else if (nearest && nearest.distance < 4.5) {
      setStatus(`${nearest.node.name}: press E to act`);
    } else {
      setStatus('Explore the city and keep your needs balanced.');
    }
  }

  for (const citizen of citizens) {
    citizen.phase += dt * (0.5 + citizen.speed * 0.2);
    citizen.group.position.x = citizen.baseX + Math.sin(citizen.phase) * citizen.drift;
    citizen.group.position.z = citizen.baseZ + Math.cos(citizen.phase * 1.2) * (citizen.drift * 0.7);
    citizen.group.rotation.y = Math.sin(citizen.phase * 0.75) * 0.8;
  }

  for (const node of lifeNodes) {
    node.group.rotation.y += dt * 0.45;
    node.group.position.y = node.position.y + Math.sin(performance.now() * 0.003 + node.position.x) * 0.12;
  }

  updateHud();
}

let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.04, (now - last) / 1000);
  last = now;
  update(dt);
  renderer.render(scene, camera);
}

updateHud();
setOverlay('Neon City Life', 'WASD to move, mouse to look, and E to interact with the city. Keep your energy, hunger, and mood balanced through the week.', 'Start day');
requestAnimationFrame(animate);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
});
