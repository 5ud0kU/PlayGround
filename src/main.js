import * as THREE from 'three';
import './style.css';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc3d0);
scene.fog = new THREE.Fog(0x9fc3d0, 38, 155);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 220);
camera.position.set(0, 1.7, 8);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xd7f2ff, 0x253440, 2.2));
const sun = new THREE.DirectionalLight(0xffe6c6, 3.1);
sun.position.set(-24, 45, 28);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -80; sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80;
scene.add(sun);

const mat = (color, roughness = .86, metalness = .03) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const groundMat = mat(0x4d5656);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -.05;
ground.receiveShadow = true;
scene.add(ground);

// A broad asphalt avenue, concrete sidewalks, and repeating lane markings.
const road = new THREE.Mesh(new THREE.PlaneGeometry(15, 210), mat(0x28343b));
road.rotation.x = -Math.PI / 2; road.position.y = .008; road.receiveShadow = true; scene.add(road);
const sidewalkMat = mat(0x9b9d91);
for (const x of [-9.3, 9.3]) {
  const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(3.6, .22, 210), sidewalkMat);
  sidewalk.position.set(x, .12, 0); sidewalk.receiveShadow = true; sidewalk.castShadow = true; scene.add(sidewalk);
}
const lineMat = new THREE.MeshBasicMaterial({ color: 0xe9d891 });
for (let z = -95; z <= 95; z += 12) {
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(.17, 5), lineMat);
  stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, .025, z); scene.add(stripe);
}

// City block generator: offset facades, roof details, windows and shopfronts.
const buildings = [];
const buildingMats = [0x53626b, 0x80766b, 0x66716f, 0x626778, 0x917c69, 0x687d80].map(c => mat(c));
const windowMats = [0x263e49, 0x344b4d, 0x384554].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .48, metalness: .12 }));
const signMats = [0xe47a51, 0xe1bb64, 0x54b8b2, 0x8397d5].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .28 }));
function box(w, h, d, material, x, y, z, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); mesh.castShadow = cast; mesh.receiveShadow = true; scene.add(mesh); return mesh;
}
for (let side of [-1, 1]) {
  for (let row = 0; row < 17; row++) {
    const z = -82 + row * 10 + Math.random() * 2;
    const width = 8 + Math.random() * 7;
    const depth = 8 + Math.random() * 5;
    const height = 11 + Math.random() * 25;
    const x = side * (13 + width / 2 + Math.random() * 4);
    const b = box(width, height, depth, buildingMats[Math.floor(Math.random() * buildingMats.length)], x, height / 2, z);
    buildings.push(b);
    // rows of dark inset-looking windows on the avenue-facing facade
    const facing = x - side * width / 2;
    const cols = Math.max(2, Math.floor(width / 2.5));
    const floors = Math.floor(height / 3.1);
    for (let fy = 0; fy < floors; fy++) for (let cx = 0; cx < cols; cx++) {
      const wx = facing - side * .025;
      const wz = z - width * .32 + cx * (width * .64 / Math.max(1, cols - 1));
      const wy = 2.1 + fy * 3.05;
      if (wy < height - 1) box(.95, 1.55, .08, windowMats[(row + fy + cx) % windowMats.length], wx, wy, wz, false);
    }
    // rooftop water tanks and air units
    if (row % 3 === 0) {
      box(2.2, 1.8, 2.2, mat(0x424a4d), x + side * (Math.random() * 2), height + .9, z, true);
      box(2.8, .25, 2.8, mat(0x9a8b72), x, height + 1.85, z, true);
    }
    // storefront canopy with colorful fascia
    if (height > 13) {
      box(width * .86, .65, .35, signMats[row % signMats.length], facing, 3.2, z, false);
      box(width * .9, .18, 1.1, mat(0x333d40), facing, 2.65, z, false);
    }
  }
}

// Street props: lamps, parked cars, planters and trees.
const lampMat = new THREE.MeshStandardMaterial({ color: 0x303b40, metalness: .7, roughness: .3 });
const lampGlow = new THREE.MeshStandardMaterial({ color: 0xffe1a3, emissive: 0xffc76a, emissiveIntensity: 1.2 });
const trunkMat = mat(0x5c4939), leafMats = [mat(0x627c69), mat(0x74876d), mat(0x536f6d)];
const carMats = [0x56656b, 0x9d5644, 0x737d76, 0x354956, 0xc3b28a].map(c => new THREE.MeshStandardMaterial({ color: c, metalness: .3, roughness: .42 }));
for (let i = 0; i < 15; i++) {
  const z = -85 + i * 12;
  for (const side of [-1, 1]) {
    const x = side * 11.6;
    box(.16, 5.2, .16, lampMat, x, 2.6, z, true);
    box(1.3, .12, .12, lampMat, x - side * .55, 5.1, z, true);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 8), lampGlow); bulb.position.set(x - side * 1.08, 5, z); scene.add(bulb);
    if (i % 2 === 0) {
      box(.34, 1.25, .34, trunkMat, side * 12, .8, z + 4, true);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 1), leafMats[i % leafMats.length]);
      crown.position.set(side * 12, 2.25, z + 4); crown.scale.set(1, 1.2, 1); crown.castShadow = true; scene.add(crown);
    }
    if (i % 3 === 1) {
      const car = box(2.1, 1.25, 4.1, carMats[i % carMats.length], side * 7.2, .78, z + 2.5, true);
      car.rotation.y = side < 0 ? 0 : Math.PI;
      box(1.75, .75, 2, mat(0x32424a, .24, .38), side * 7.2, 1.65, z + 2.35, true);
      for (const wx of [-.78, .78]) for (const wz of [-1.25, 1.25]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .25, 14), mat(0x202426));
        wheel.rotation.z = Math.PI / 2; wheel.position.set(side * 7.2 + wx, .48, z + 2.5 + wz); wheel.castShadow = true; scene.add(wheel);
      }
      void car;
    }
  }
}

// Distant skyline closes the horizon while keeping the play avenue readable.
for (let i = 0; i < 30; i++) {
  const h = 20 + Math.random() * 42;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(7 + Math.random() * 10, h, 9), buildingMats[i % buildingMats.length]);
  tower.position.set((Math.random() - .5) * 145, h / 2, -105 - Math.random() * 26);
  tower.castShadow = true; scene.add(tower);
}

// Simple first-person weapon model.
const gun = new THREE.Group();
const gunBody = new THREE.Mesh(new THREE.BoxGeometry(.24, .22, .72), mat(0x26333a, .4, .55));
gunBody.position.set(.32, -.3, -.65); gun.add(gunBody);
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.055, .065, .38, 12), mat(0x9aadae, .35, .7));
barrel.rotation.x = Math.PI / 2; barrel.position.set(.32, -.25, -1.02); gun.add(barrel);
const grip = new THREE.Mesh(new THREE.BoxGeometry(.14, .34, .18), mat(0x141d22)); grip.position.set(.32, -.53, -.48); grip.rotation.x = -.2; gun.add(grip);
const sight = new THREE.Mesh(new THREE.BoxGeometry(.11, .065, .15), signMats[2]); sight.position.set(.32, -.16, -.58); gun.add(sight);
camera.add(gun); scene.add(camera);

const drones = [];
const bullets = [];
const sparks = [];
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const keys = new Set();
const player = { health: 100, score: 0, yaw: 0, pitch: 0, velocity: new THREE.Vector3(), grounded: true, started: false, wave: 1, fireCooldown: 0, hurtCooldown: 0, kills: 0 };
const overlay = document.querySelector('#overlay');
const startBtn = document.querySelector('#startBtn');
const healthFill = document.querySelector('#healthFill');
const scoreLabel = document.querySelector('#scoreLabel');
const waveLabel = document.querySelector('#waveLabel');
let locked = false;

function makeDrone() {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x38464c, metalness: .55, roughness: .36 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff5348, emissive: 0xff2015, emissiveIntensity: 2.4 });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(.58, 1), bodyMat); body.scale.set(1.2, .7, .8); body.castShadow = true; root.add(body);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 10), eyeMat); eye.position.z = -.43; root.add(eye);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(.065, .09, 1.25, 8), lampMat); arm.rotation.z = side * .24; arm.position.x = side * .7; root.add(arm);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .07, 12), mat(0x252b2e, .4, .65)); rotor.position.set(side * 1.1, .08, 0); root.add(rotor);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(.86, .035, .12), lampGlow); fin.position.set(side * 1.1, .13, 0); root.add(fin);
  }
  root.position.set((Math.random() - .5) * 17, 3 + Math.random() * 7, -25 - Math.random() * 30);
  scene.add(root);
  drones.push({ root, hp: 3, phase: Math.random() * 6, speed: 1.3 + Math.random() * .7, shoot: 2 + Math.random() * 2, dead: false });
}

function spawnWave() {
  const count = Math.min(3 + player.wave * 2, 15);
  for (let i = 0; i < count; i++) makeDrone();
  waveLabel.textContent = `Wave ${player.wave}`;
}

function setOverlay(title, text, button) {
  overlay.querySelector('h1').textContent = title;
  overlay.querySelector('p').textContent = text;
  startBtn.textContent = button;
  overlay.classList.add('visible');
}
function startGame() {
  if (player.health <= 0) {
    player.health = 100; player.score = 0; player.wave = 1; player.kills = 0;
    for (const d of drones) scene.remove(d.root);
    drones.length = 0;
    scoreLabel.textContent = 'Score 0';
    healthFill.style.width = '100%';
    camera.position.set(0, 1.7, 8);
    player.yaw = 0; player.pitch = 0;
    spawnWave();
  } else if (drones.length === 0) spawnWave();
  player.started = true;
  overlay.classList.remove('visible');
  renderer.domElement.requestPointerLock?.();
}
startBtn.addEventListener('click', startGame);
renderer.domElement.addEventListener('click', () => { if (player.started && !locked) renderer.domElement.requestPointerLock?.(); else if (player.started) fire(); });
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === renderer.domElement; });
document.addEventListener('mousemove', e => {
  if (!locked || !player.started) return;
  player.yaw -= e.movementX * .0022;
  player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * .0022, -1.25, 1.25);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
});
document.addEventListener('keydown', e => {
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Space' && player.grounded && player.started) { player.velocity.y = 6.4; player.grounded = false; }
  if (e.code === 'Escape' && player.started && !locked) setOverlay('Paused', 'Click deploy to jump back into the city.', 'Resume');
});
document.addEventListener('keyup', e => keys.delete(e.code));
document.addEventListener('mousedown', e => { if (e.button === 0 && locked && player.started) fire(); });
for (const button of document.querySelectorAll('[data-key]')) {
  const code = button.dataset.key;
  const release = () => keys.delete(code);
  button.addEventListener('pointerdown', e => { e.preventDefault(); keys.add(code); button.setPointerCapture(e.pointerId); });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}
document.querySelector('#touchFire').addEventListener('pointerdown', e => { e.preventDefault(); fire(); });

function fire() {
  if (player.fireCooldown > 0) return;
  player.fireCooldown = .19;
  gun.position.z = -.08;
  setTimeout(() => { gun.position.z = 0; }, 55);
  raycaster.setFromCamera(center, camera);
  const targets = drones.filter(d => !d.dead).map(d => d.root.children[0]);
  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length) {
    const drone = drones.find(d => d.root.children[0] === hits[0].object);
    drone.hp--;
    drone.root.scale.setScalar(1.12);
    setTimeout(() => { if (drone.root) drone.root.scale.setScalar(1); }, 75);
    if (drone.hp <= 0) {
      drone.dead = true; scene.remove(drone.root);
      player.kills++; player.score += 100;
      scoreLabel.textContent = `Score ${player.score}`;
      if (drones.every(d => d.dead)) {
        player.wave++;
        setTimeout(() => { if (player.started && player.health > 0) spawnWave(); }, 1200);
      }
    }
  }
}

function damage(amount) {
  if (player.hurtCooldown > 0 || !player.started) return;
  player.hurtCooldown = .8;
  player.health = Math.max(0, player.health - amount);
  healthFill.style.width = `${player.health}%`;
  healthFill.style.background = player.health < 30 ? 'linear-gradient(90deg,#ff514b,#ffae73)' : 'linear-gradient(90deg,#47dfab,#9dfc91)';
  if (player.health <= 0) {
    player.started = false;
    document.exitPointerLock?.();
    setOverlay('City overrun', `Score ${player.score} · ${player.kills} drones down. Ready for another run?`, 'Redeploy');
  }
}

// Touch look and movement buttons for mobile play.
let touchStart = null;
renderer.domElement.addEventListener('touchstart', e => { if (e.touches.length) touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
renderer.domElement.addEventListener('touchmove', e => {
  if (!touchStart || !player.started || !e.touches.length) return;
  const t = e.touches[0];
  player.yaw -= (t.clientX - touchStart.x) * .004;
  player.pitch = THREE.MathUtils.clamp(player.pitch - (t.clientY - touchStart.y) * .003, -1.2, 1.2);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });
renderer.domElement.addEventListener('touchend', e => { if (player.started) fire(); touchStart = null; }, { passive: true });

function update(dt, time) {
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.hurtCooldown = Math.max(0, player.hurtCooldown - dt);
  if (player.started) {
    const move = new THREE.Vector3();
    if (keys.has('KeyW') || keys.has('ArrowUp')) move.z -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) move.z += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) move.x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) move.x += 1;
    move.normalize();
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 9 : 5.5;
    const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    camera.position.addScaledVector(forward, -move.z * speed * dt);
    camera.position.addScaledVector(right, move.x * speed * dt);
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -6.5, 6.5);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -93, 10);
    player.velocity.y -= 17 * dt;
    camera.position.y += player.velocity.y * dt;
    if (camera.position.y < 1.7) { camera.position.y = 1.7; player.velocity.y = 0; player.grounded = true; }
    gun.position.y = Math.sin(time * 10) * (move.length() ? .012 : .004);
  }
  for (const d of drones) {
    if (d.dead) continue;
    d.phase += dt;
    const toPlayer = camera.position.clone().sub(d.root.position);
    const distance = toPlayer.length();
    if (distance > 6) d.root.position.addScaledVector(toPlayer.normalize(), d.speed * dt);
    d.root.position.y += Math.sin(d.phase * 2.4) * .006;
    d.root.lookAt(camera.position);
    d.root.rotation.z = Math.sin(d.phase * 1.4) * .08;
    d.shoot -= dt;
    if (d.shoot <= 0 && distance < 30) {
      d.shoot = 2.1 + Math.random() * 1.3;
      const bead = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff554b, emissive: 0xff1d15, emissiveIntensity: 2 }));
      bead.position.copy(d.root.position); scene.add(bead);
      const dir = camera.position.clone().sub(bead.position).normalize();
      bullets.push({ mesh: bead, dir, speed: 13, life: 3 });
    }
    if (distance < 3.2) damage(12);
  }
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.mesh.position.addScaledVector(b.dir, b.speed * dt); b.life -= dt;
    if (b.mesh.position.distanceTo(camera.position) < .7) { damage(10); b.life = 0; }
    if (b.life <= 0) { scene.remove(b.mesh); bullets.splice(i, 1); }
  }
  // Recurring subtle city ambience: glowing windows and drifting cloudless haze.
}

let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(.04, (now - last) / 1000); last = now;
  update(dt, now / 1000);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
});
