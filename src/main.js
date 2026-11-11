import * as THREE from 'three';
import './style.css';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07141b);
scene.fog = new THREE.Fog(0x07141b, 26, 135);

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

scene.add(new THREE.HemisphereLight(0xdaf6ff, 0x1b2c34, 2.3));
const sun = new THREE.DirectionalLight(0xfff0d1, 2.8);
sun.position.set(-22, 42, 28);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -65; sun.shadow.camera.right = 65;
sun.shadow.camera.top = 65; sun.shadow.camera.bottom = -65;
scene.add(sun);

const mat = (color, roughness = 0.86, metalness = 0.03) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mat(0x3d4546));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
ground.receiveShadow = true;
scene.add(ground);

const road = new THREE.Mesh(new THREE.PlaneGeometry(16, 220), mat(0x27363d));
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

const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8d785 });
for (let z = -100; z <= 100; z += 12) {
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 5), lineMat);
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(0, 0.02, z);
  scene.add(stripe);
}

const buildingMats = [0x53626b, 0x7f746c, 0x667d7a, 0x646e7a, 0x8f7f68, 0x6b7d86].map((c) => mat(c));
const windowMats = [0x1d3945, 0x2a454b, 0x314b5a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.47, metalness: 0.12 }));
const signMats = [0xe97d61, 0xe2be67, 0x57c7bd, 0x8a9de0].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25 }));

function box(w, h, d, material, x, y, z, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

for (const side of [-1, 1]) {
  for (let row = 0; row < 15; row++) {
    const z = -82 + row * 10 + Math.random() * 2;
    const w = 8 + Math.random() * 7;
    const d = 8 + Math.random() * 5;
    const h = 10 + Math.random() * 24;
    const x = side * (14 + w / 2 + Math.random() * 3.5);
    const building = box(w, h, d, buildingMats[Math.floor(Math.random() * buildingMats.length)], x, h / 2, z);
    building.userData.lifeColor = signMats[row % signMats.length].color;
    const facing = x - side * w / 2;
    const cols = Math.max(2, Math.floor(w / 2.5));
    const floors = Math.floor(h / 3.1);
    for (let fy = 0; fy < floors; fy++) {
      for (let cx = 0; cx < cols; cx++) {
        const wx = facing - side * 0.025;
        const wz = z - w * 0.32 + cx * (w * 0.64 / Math.max(1, cols - 1));
        const wy = 2.1 + fy * 3.05;
        if (wy < h - 1) {
          box(0.9, 1.5, 0.08, windowMats[(row + fy + cx) % windowMats.length], wx, wy, wz, false);
        }
      }
    }
    if (row % 3 === 0) {
      box(2.2, 1.8, 2.2, mat(0x464e55), x + side * (Math.random() * 2), h + 0.9, z, true);
      box(2.8, 0.25, 2.8, mat(0x9d8c76), x, h + 1.85, z, true);
    }
    if (h > 13) {
      box(w * 0.86, 0.65, 0.35, signMats[row % signMats.length], facing, 3.2, z, false);
      box(w * 0.9, 0.18, 1.1, mat(0x343d40), facing, 2.65, z, false);
    }
  }
}

const lampMat = new THREE.MeshStandardMaterial({ color: 0x2e3940, metalness: 0.72, roughness: 0.3 });
const lampGlow = new THREE.MeshStandardMaterial({ color: 0xffdea2, emissive: 0xffc77c, emissiveIntensity: 1.2 });
const trunkMat = mat(0x5d4738);
const leafMats = [mat(0x617b69), mat(0x788a6d), mat(0x58706a)];
const carMats = [0x58707d, 0x9d6247, 0x77817a, 0x2f4653, 0xc4b08d].map((c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.3, roughness: 0.42 }));

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
};

const lifeNodes = [
  { key: 'home', name: 'Home', color: 0x70f0d7, position: new THREE.Vector3(-12, 1.8, -24), radius: 3.2 },
  { key: 'work', name: 'Office', color: 0x8abaf5, position: new THREE.Vector3(-2.5, 1.8, 26), radius: 3.4 },
  { key: 'cafe', name: 'Cafe', color: 0xffb46a, position: new THREE.Vector3(11.5, 1.8, 20), radius: 3 },
  { key: 'park', name: 'Park', color: 0x72d77c, position: new THREE.Vector3(14.5, 1.5, -11), radius: 3.5 },
  { key: 'club', name: 'Night Club', color: 0xf87eb0, position: new THREE.Vector3(-15, 1.8, 8), radius: 3.5 },
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
  state.energy = 100;
  state.hunger = 100;
  state.joy = 100;
  camera.position.set(0, 1.7, 8);
  state.yaw = 0;
  state.pitch = 0;
  camera.rotation.set(0, 0, 0, 'YXZ');
  updateHud();
}

function endDay() {
  state.started = false;
  document.exitPointerLock?.();

  if (state.day >= state.maxDays) {
    const resultText = `You survived ${state.maxDays} days in Neon City with $${state.money}.`;
    setOverlay('Neighborhood legend', resultText, 'Restart life');
    state.day = 1;
    state.money = 42;
    resetForNewDay();
    return;
  }

  const summary = `Day ${state.day} complete. You closed with $${state.money}.`;
  setOverlay('Day complete', summary, 'Start next day');
  state.day += 1;
  state.money = Math.max(42, state.money);
  resetForNewDay();
}

function startGame() {
  if (state.day > state.maxDays) {
    state.day = 1;
    state.money = 42;
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
  if (!state.started || state.interactCooldown > 0) {
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

  switch (targetNode.key) {
    case 'home':
      if (state.time < 21 && state.time > 6) {
        state.energy = clamp(state.energy + 36, 0, 100);
        state.hunger = clamp(state.hunger - 10, 0, 100);
        state.joy = clamp(state.joy + 12, 0, 100);
        setStatus('You rest at home and recover your energy.');
      } else {
        setStatus('Home is cozy, but the city is still active.');
      }
      break;
    case 'work':
      if (state.time >= 9 && state.time <= 18) {
        state.money += 30;
        state.energy = clamp(state.energy - 18, 0, 100);
        state.hunger = clamp(state.hunger - 12, 0, 100);
        state.joy = clamp(state.joy - 8, 0, 100);
        setStatus('A productive shift. The bank account is healthier.');
      } else {
        setStatus('The office is off-hours right now.');
      }
      break;
    case 'cafe':
      if (state.money >= 10) {
        state.hunger = clamp(state.hunger + 28, 0, 100);
        state.energy = clamp(state.energy + 8, 0, 100);
        state.joy = clamp(state.joy + 8, 0, 100);
        state.money -= 10;
        setStatus('Fresh food and coffee keep you going.');
      } else {
        setStatus('You need $10 for a meal at the cafe.');
      }
      break;
    case 'park':
      state.joy = clamp(state.joy + 26, 0, 100);
      state.energy = clamp(state.energy + 8, 0, 100);
      state.hunger = clamp(state.hunger - 8, 0, 100);
      setStatus('A walk in the park lifts your mood.');
      break;
    case 'club':
      if (state.money >= 12) {
        state.money -= 12;
        state.joy = clamp(state.joy + 30, 0, 100);
        state.energy = clamp(state.energy - 12, 0, 100);
        setStatus('Late-night music and conversation energize you.');
      } else {
        setStatus('You need a little cash before hitting the club.');
      }
      break;
    default:
      break;
  }

  updateHud();
  if (state.energy <= 0 || state.hunger <= 0 || state.joy <= 0) {
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

  if (state.started) {
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
    camera.position.x = clamp(camera.position.x, -30, 30);
    camera.position.z = clamp(camera.position.z, -96, 38);

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
