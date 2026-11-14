import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { LOCATIONS } from './lore.js';

const materials = {
  wood: new THREE.MeshStandardMaterial({ color: 0x493b2d, roughness: 0.88 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x29251f, roughness: 0.9 }),
  paleWood: new THREE.MeshStandardMaterial({ color: 0x75664d, roughness: 0.86 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x454947, roughness: 0.56, metalness: 0.55 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xb9ae91, roughness: 0.95 }),
  cloth: new THREE.MeshStandardMaterial({ color: 0x596568, roughness: 0.97 }),
  brass: new THREE.MeshStandardMaterial({ color: 0x927748, roughness: 0.42, metalness: 0.58 }),
  ceramic: new THREE.MeshStandardMaterial({ color: 0xd0c8b3, roughness: 0.36 }),
  candle: new THREE.MeshStandardMaterial({ color: 0xe3d6b7, roughness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x455b59, roughness: 0.22, metalness: 0.18 }),
  evidence: new THREE.MeshStandardMaterial({ color: 0x9a3729, roughness: 0.62 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x55534b, roughness: 0.96 }),
};

const evidenceByPlace = {
  precinct: [
    ['case-file', 'Holt case file', 'The incident report has a page torn cleanly from its center.'],
    ['evidence-envelope', 'Unlogged evidence envelope', 'A silver medal is listed in the property room ledger, but the envelope is empty.'],
  ],
  chapel: [
    ['chapel-ledger', 'Loose page beneath the altar', 'A fragment of the Ledger carries nine names in cramped ink.'],
    ['chapel-candle', 'Ninth candle', 'The wax is fresh. A thumbprint has pressed into the base.'],
  ],
  library: [
    ['miner-diary', 'Vane diary, 1889', 'The final entry says the ninth miner was never found.'],
    ['archive-card', 'Missing-person index card', 'The same family names recur every nine years.'],
  ],
  diner: [['diner-cup', 'Coffee cup at the back booth', 'A lipstick rim and a folded scrap of newspaper remain in the cup.']],
  hospital: [
    ['autopsy-chart', 'Maren Holt autopsy chart', 'The cause-of-death line has been overwritten in a different hand.'],
    ['hospital-scrub-fiber', 'Blue thread on the instrument tray', 'A short blue cotton fiber is caught beneath the tray lip.'],
  ],
  bar: [['bar-tab', 'Unpaid tab', 'A tab in Jonah Pike’s name runs until closing time.']],
  motel: [
    ['motel-register', 'Motel register, room 2', 'Alma Holt checked in under her own name, then stopped signing the book.'],
    ['motel-key', 'Room 2 key', 'The brass key is warm, though the room has been empty for hours.'],
  ],
  foundry: [
    ['foundry-shift-sheet', 'Night shift sheet', 'A hand has added a worker to the roster after the shift was completed.'],
    ['foundry-ash', 'Grey ash in the slag pan', 'The residue smells faintly of myrrh and birch.'],
  ],
  warehouse: [
    ['warehouse-crate', 'Freshly moved crate', 'Dust outlines a smaller box that was recently taken away.'],
    ['warehouse-manifest', 'Rail manifest', 'A delivery to the chapel was filed as machine parts.'],
  ],
  victimHome: [
    ['holt-photo', 'Family photograph', 'Maren and Simon stand in front of the chapel, years before his disappearance.'],
    ['holt-notebook', 'Maren’s notebook', 'The last page mentions a flashlight and a meeting below the chapel.'],
  ],
  apartment: [['rook-notes', 'Detective’s working notes', 'A map of Mercy Falls with nine locations circled in red.']],
  chapelBasement: [
    ['undercroft-mark', 'Nine-point mark', 'Scratches in the stone align with nine old candle sockets.'],
    ['undercroft-medal', 'Silver St. Brendan medal', 'The back is engraved with a name that has been deliberately scratched away.'],
  ],
};

function point(loc, x, y, z) {
  return new THREE.Vector3(loc.x + x, y, loc.z + z);
}

function box(world, loc, x, y, z, w, h, d, material, rotation = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.copy(point(loc, x, y, z));
  mesh.rotation.y = rotation;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  (loc.group || world.scene).add(mesh);
  return mesh;
}

function cylinder(world, loc, x, y, z, radiusTop, radiusBottom, height, material, segments = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.copy(point(loc, x, y, z));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  (loc.group || world.scene).add(mesh);
  return mesh;
}

function sphere(world, loc, x, y, z, radius, material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), material);
  mesh.position.copy(point(loc, x, y, z));
  mesh.castShadow = true;
  (loc.group || world.scene).add(mesh);
  return mesh;
}

function table(world, loc, x, z, w = 2.4, d = 1.4, top = materials.wood) {
  box(world, loc, x, 0.88, z, w, 0.16, d, top);
  for (const dx of [-w * 0.4, w * 0.4]) for (const dz of [-d * 0.35, d * 0.35]) {
    box(world, loc, x + dx, 0.43, z + dz, 0.12, 0.82, 0.12, materials.darkWood);
  }
}

function chair(world, loc, x, z, material = materials.darkWood, rotation = 0) {
  box(world, loc, x, 0.52, z, 0.72, 0.14, 0.68, material, rotation);
  box(world, loc, x, 1.03, z - 0.25, 0.72, 0.95, 0.12, material, rotation);
  for (const dx of [-0.27, 0.27]) for (const dz of [-0.24, 0.24]) {
    box(world, loc, x + dx, 0.25, z + dz, 0.09, 0.5, 0.09, material);
  }
}

function bed(world, loc, x, z, w = 2.2, d = 3.2) {
  box(world, loc, x, 0.38, z, w, 0.42, d, materials.darkWood);
  box(world, loc, x, 0.67, z, w - 0.14, 0.2, d - 0.14, materials.cloth);
  box(world, loc, x, 0.82, z - d * 0.31, w - 0.2, 0.22, 0.72, materials.paper);
  box(world, loc, x, 0.9, z - d * 0.42, w + 0.08, 0.28, 0.12, materials.wood);
}

function addEvidence(world, placeId, loc, index, itemMesh) {
  const record = evidenceByPlace[placeId]?.[index];
  if (!record) return;
  const [suffix, label, description] = record;
  const id = `${placeId}:${suffix}`;
  if (world.interactablesById.has(id)) return;
  const position = new THREE.Vector3();
  itemMesh.getWorldPosition(position);
  const interactable = {
    id,
    position,
    label,
    description,
    kind: 'evidence',
    location: placeId,
    object: itemMesh,
  };
  world.interactables.push(interactable);
  world.interactablesById.set(id, interactable);
}

function shelf(world, loc, x, z, width = 2.4, levels = 3) {
  box(world, loc, x, 1.15, z, width, 2.3, 0.16, materials.darkWood);
  for (const side of [-1, 1]) box(world, loc, x + side * width * 0.47, 1.15, z, 0.12, 2.3, 0.3, materials.wood);
  for (let i = 0; i <= levels; i++) box(world, loc, x, 0.12 + i * (2.05 / levels), z, width, 0.11, 0.32, materials.paleWood);
}

function cabinet(world, loc, x, z, width = 1.4) {
  box(world, loc, x, 1.0, z, width, 1.9, 0.62, materials.paleWood);
  box(world, loc, x, 1.0, z + 0.33, width - 0.12, 1.72, 0.06, materials.wood);
  for (let y = 0.45; y <= 1.55; y += 0.55) box(world, loc, x, y, z + 0.38, width - 0.2, 0.045, 0.04, materials.brass);
}

function evidenceProp(world, placeId, loc, index, x, y, z, type = 'paper') {
  let mesh;
  if (type === 'medal') {
    mesh = cylinder(world, loc, x, y, z, 0.2, 0.2, 0.055, materials.brass, 16);
    mesh.rotation.x = Math.PI / 2;
    cylinder(world, loc, x, y + 0.15, z, 0.035, 0.035, 0.25, materials.brass, 8);
  } else if (type === 'candle') {
    mesh = cylinder(world, loc, x, y, z, 0.09, 0.1, 0.48, materials.candle, 8);
    cylinder(world, loc, x, y + 0.27, z, 0.025, 0.025, 0.09, materials.evidence, 6);
  } else if (type === 'cup') {
    mesh = cylinder(world, loc, x, y, z, 0.18, 0.14, 0.28, materials.ceramic, 12);
  } else if (type === 'fiber') {
    mesh = box(world, loc, x, y, z, 0.42, 0.025, 0.035, materials.cloth, 0.4);
  } else {
    mesh = box(world, loc, x, y, z, 0.48, 0.055, 0.64, type === 'photo' ? materials.paper : materials.evidence, (index % 2 ? -0.12 : 0.08));
    if (type === 'book') box(world, loc, x, y + 0.045, z, 0.42, 0.025, 0.58, materials.paper, 0.03);
  }
  addEvidence(world, placeId, loc, index, mesh);
  return mesh;
}

function buildPrecinct(world, loc) {
  table(world, loc, -5, -2, 4.4, 1.8);
  chair(world, loc, -5, -3.8);
  table(world, loc, 4.5, -1.5, 3.2, 1.5);
  chair(world, loc, 4.5, -3.2);
  for (let i = 0; i < 4; i++) {
    box(world, loc, 8.5, 1.2 + i * 0.9, -4.5 + i * 1.9, 1.35, 0.72, 0.58, materials.metal);
    box(world, loc, 8.5, 1.58 + i * 0.9, -4.18 + i * 1.9, 0.7, 0.04, 0.03, materials.brass);
  }
  box(world, loc, -1, 2.4, -8.65, 6.8, 2.8, 0.12, materials.darkWood);
  for (let i = 0; i < 5; i++) box(world, loc, -3.4 + i * 1.2, 2.5, -8.55, 0.72, 0.9, 0.07, i % 2 ? materials.paper : materials.evidence);
  const file = box(world, loc, -5.35, 1.03, -1.95, 0.82, 0.1, 0.58, materials.paper, -0.08);
  const envelope = box(world, loc, 4.5, 1.02, -1.5, 0.32, 0.08, 0.28, materials.evidence);
  addEvidence(world, 'precinct', loc, 0, file);
  addEvidence(world, 'precinct', loc, 1, envelope);
}

function buildChapel(world, loc) {
  for (let row = 0; row < 4; row++) {
    const z = -5.6 + row * 2.35;
    for (const x of [-5.6, 5.6]) {
      box(world, loc, x, 0.78, z, 5.0, 0.2, 0.72, materials.wood);
      box(world, loc, x, 1.2, z - 0.27, 5.0, 0.75, 0.16, materials.wood);
      for (const dx of [-2.25, 2.25]) box(world, loc, x + dx, 0.38, z, 0.14, 0.8, 0.62, materials.darkWood);
    }
  }
  box(world, loc, 0, 1.05, -7.3, 5.8, 1.5, 1.3, materials.paleWood);
  box(world, loc, 0, 1.86, -7.3, 6.2, 0.18, 1.55, materials.darkWood);
  box(world, loc, 0, 3.9, -9.72, 0.16, 2.1, 0.12, materials.brass);
  box(world, loc, 0, 3.9, -9.72, 1.25, 0.14, 0.12, materials.brass);
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9;
    const candle = cylinder(world, loc, Math.cos(a) * 1.35, 1.99, -7.2 + Math.sin(a) * 0.55, 0.07, 0.08, 0.36, materials.candle, 8);
    if (i === 8) addEvidence(world, 'chapel', loc, 1, candle);
  }
  const page = box(world, loc, 0.42, 2.01, -7.1, 0.48, 0.035, 0.34, materials.paper, 0.12);
  addEvidence(world, 'chapel', loc, 0, page);
}

function buildLibrary(world, loc) {
  for (const x of [-8.7, 8.7]) {
    box(world, loc, x, 2.4, -1.8, 1.15, 4.8, 8.5, materials.darkWood);
    for (let shelf = 0; shelf < 4; shelf++) {
      box(world, loc, x, 0.85 + shelf * 1.05, -1.8, 1.2, 0.09, 8.5, materials.wood);
      for (let i = 0; i < 9; i++) {
        const book = box(world, loc, x + (i % 2 ? 0.05 : -0.05), 1.12 + shelf * 1.05, -5.2 + i * 0.85, 0.42, 0.5 + (i % 3) * 0.08, 0.52, i % 3 ? materials.evidence : materials.cloth);
        book.rotation.z = (i % 2 ? 1 : -1) * 0.05;
      }
    }
  }
  table(world, loc, 0, 0.2, 4.2, 2.4, materials.paleWood);
  chair(world, loc, 0, 2.05, materials.wood, Math.PI);
  const diary = box(world, loc, -0.48, 1.03, 0.15, 0.72, 0.12, 0.92, materials.darkWood, -0.1);
  box(world, loc, 0.5, 1.0, 0.28, 0.5, 0.035, 0.42, materials.paper, 0.08);
  addEvidence(world, 'library', loc, 0, diary);
  const card = box(world, loc, 0.45, 1.08, 0.27, 0.5, 0.045, 0.42, materials.paper, 0.08);
  addEvidence(world, 'library', loc, 1, card);
}

function buildDiner(world, loc) {
  box(world, loc, 0, 1.12, -4.1, 9.0, 1.45, 1.0, materials.darkWood);
  box(world, loc, 0, 1.9, -4.1, 9.15, 0.14, 1.15, materials.metal);
  for (let i = 0; i < 5; i++) {
    cylinder(world, loc, -3.8 + i * 1.9, 2.2, -4.1, 0.17, 0.17, 0.45, materials.glass, 10);
    cylinder(world, loc, -3.8 + i * 1.9, 2.45, -4.1, 0.18, 0.18, 0.06, materials.brass, 10);
  }
  for (const x of [-4.1, 4.1]) {
    table(world, loc, x, 1.1, 2.2, 1.5);
    for (const dz of [-1.25, 1.25]) {
      box(world, loc, x, 0.9, 1.1 + dz, 2.05, 0.75, 0.16, materials.evidence);
      box(world, loc, x, 0.55, 1.1 + dz, 0.12, 1.1, 0.12, materials.darkWood);
    }
  }
  const cup = cylinder(world, loc, -4.25, 1.13, 1.05, 0.16, 0.12, 0.24, materials.ceramic, 12);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 10), materials.ceramic);
  handle.position.copy(point(loc, -4.05, 1.13, 1.05)); handle.rotation.y = Math.PI / 2; world.scene.add(handle);
  addEvidence(world, 'diner', loc, 0, cup);
}

function buildHospital(world, loc) {
  for (const [x, z] of [[-6, -2.6], [5.8, -2.6]]) {
    bed(world, loc, x, z, 2.4, 3.8);
    box(world, loc, x, 1.65, z - 1.6, 1.25, 0.12, 0.75, materials.metal);
    for (const dx of [-0.5, 0, 0.5]) cylinder(world, loc, x + dx, 1.78, z - 1.6, 0.035, 0.035, 0.22, materials.brass, 8);
    box(world, loc, x + 1.65, 1.45, z, 0.9, 0.1, 0.8, materials.paper);
    box(world, loc, x + 1.65, 0.75, z, 0.08, 1.4, 0.08, materials.metal);
  }
  box(world, loc, -0.2, 1.6, -6.9, 3.6, 2.8, 0.15, materials.cloth);
  box(world, loc, -0.2, 1.8, -6.78, 2.4, 0.06, 0.04, materials.paper);
  const chart = box(world, loc, 0.8, 1.28, 4.0, 0.64, 0.08, 0.46, materials.paper, -0.16);
  const tray = box(world, loc, -0.5, 1.05, 0.6, 0.9, 0.1, 0.62, materials.metal);
  box(world, loc, -0.5, 1.14, 0.6, 0.6, 0.045, 0.04, materials.cloth);
  addEvidence(world, 'hospital', loc, 0, chart);
  addEvidence(world, 'hospital', loc, 1, tray);
}

function buildBar(world, loc) {
  box(world, loc, 0, 1.15, -3.8, 9.0, 1.45, 1.15, materials.darkWood);
  box(world, loc, 0, 1.95, -3.8, 9.2, 0.16, 1.3, materials.paleWood);
  for (let i = 0; i < 7; i++) {
    const bx = -3.6 + i * 1.2;
    cylinder(world, loc, bx, 2.28, -3.72, 0.15, 0.13, 0.52, i % 2 ? materials.glass : materials.evidence, 9);
    cylinder(world, loc, bx, 2.55, -3.72, 0.16, 0.16, 0.05, materials.brass, 9);
  }
  for (let i = 0; i < 4; i++) {
    const x = -3.3 + i * 2.2;
    cylinder(world, loc, x, 0.9, -1.7, 0.38, 0.42, 0.16, materials.wood, 12);
    cylinder(world, loc, x, 0.47, -1.7, 0.08, 0.08, 0.82, materials.metal, 8);
    cylinder(world, loc, x, 0.15, -1.7, 0.42, 0.42, 0.08, materials.metal, 12);
  }
  table(world, loc, 0, 2.4, 2.2, 1.2);
  const tab = box(world, loc, 0.35, 1.0, 2.35, 0.72, 0.04, 0.42, materials.paper, 0.12);
  addEvidence(world, 'bar', loc, 0, tab);
}

function buildMotel(world, loc) {
  bed(world, loc, -4.7, -1.4, 2.6, 4.1);
  box(world, loc, -4.7, 2.95, -7.5, 3.2, 0.12, 0.08, materials.darkWood);
  box(world, loc, -4.7, 2.95, -7.42, 2.8, 1.1, 0.04, materials.evidence);
  table(world, loc, 5.2, -4.8, 2.2, 1.2);
  box(world, loc, 5.2, 1.62, -4.8, 1.0, 1.5, 0.12, materials.wood);
  for (let i = 0; i < 3; i++) {
    box(world, loc, -0.9 + i * 0.9, 2.0, -7.55, 0.72, 0.55, 0.06, materials.paleWood);
    box(world, loc, -0.9 + i * 0.9, 2.55, -7.51, 0.62, 0.52, 0.06, materials.paper);
  }
  const register = box(world, loc, 5.2, 1.03, -4.8, 0.68, 0.08, 0.48, materials.paper);
  const key = cylinder(world, loc, 5.75, 1.05, -4.82, 0.07, 0.07, 0.06, materials.brass, 8);
  sphere(world, loc, 5.75, 1.1, -4.82, 0.13, materials.brass);
  addEvidence(world, 'motel', loc, 0, register);
  addEvidence(world, 'motel', loc, 1, key);
}

function buildFoundry(world, loc) {
  for (const x of [-11.5, 11.5]) {
    box(world, loc, x, 2.6, -7.5, 5.0, 5.2, 4.2, materials.metal);
    cylinder(world, loc, x, 5.3, -7.5, 1.05, 1.25, 0.42, materials.darkWood, 12);
    cylinder(world, loc, x, 5.9, -7.5, 0.38, 0.55, 0.9, materials.metal, 10);
  }
  box(world, loc, 0, 1.85, 1.0, 7.4, 2.5, 2.0, materials.metal);
  box(world, loc, 0, 3.18, 1.0, 8.0, 0.18, 2.4, materials.darkWood);
  for (const x of [-3.1, 3.1]) box(world, loc, x, 0.9, 1.0, 0.2, 1.8, 1.8, materials.darkWood);
  for (let i = 0; i < 5; i++) {
    const x = -6 + i * 3;
    cylinder(world, loc, x, 0.55, 8.8, 0.62, 0.62, 0.9, materials.metal, 12);
    cylinder(world, loc, x, 1.05, 8.8, 0.12, 0.12, 0.18, materials.brass, 10);
  }
  const sheet = box(world, loc, 0, 3.2, 2.25, 0.85, 0.08, 0.6, materials.paper, 0.05);
  const ash = cylinder(world, loc, 1.25, 3.0, 1.0, 0.18, 0.2, 0.08, materials.evidence, 10);
  addEvidence(world, 'foundry', loc, 0, sheet);
  addEvidence(world, 'foundry', loc, 1, ash);
}

function buildWarehouse(world, loc) {
  for (let i = 0; i < 4; i++) {
    const x = -8.5 + (i % 2) * 4.2;
    const z = -4.5 + Math.floor(i / 2) * 5.2;
    box(world, loc, x, 0.9, z, 3.4, 1.8, 3.2, i === 0 ? materials.evidence : materials.wood);
    box(world, loc, x, 1.9, z, 3.5, 0.14, 3.3, materials.darkWood);
    box(world, loc, x, 2.85, z, 3.4, 1.8, 3.2, materials.wood);
  }
  for (let i = 0; i < 5; i++) {
    box(world, loc, 7.3, 0.5 + i * 0.72, -6.5 + i * 2.5, 3.8, 0.12, 0.18, materials.metal);
  }
  table(world, loc, 6.8, 6.0, 3.2, 1.8);
  const crate = box(world, loc, -8.5, 2.85, -4.5, 3.4, 1.8, 3.2, materials.wood);
  const manifest = box(world, loc, 6.8, 1.0, 6.0, 0.78, 0.05, 0.54, materials.paper, -0.08);
  addEvidence(world, 'warehouse', loc, 0, crate);
  addEvidence(world, 'warehouse', loc, 1, manifest);
}

function buildVictimHome(world, loc) {
  table(world, loc, -2.0, -0.5, 2.8, 1.6);
  chair(world, loc, -2.0, 1.1);
  bed(world, loc, 2.7, -2.4, 2.2, 3.5);
  box(world, loc, -3.8, 1.7, -4.8, 2.5, 3.0, 0.12, materials.wood);
  const frame = box(world, loc, -3.8, 1.7, -4.71, 2.15, 2.6, 0.04, materials.paper);
  box(world, loc, -3.8, 1.7, -4.67, 1.72, 1.42, 0.05, materials.cloth);
  const notebook = box(world, loc, -2.25, 1.01, -0.42, 0.66, 0.07, 0.92, materials.evidence, 0.14);
  box(world, loc, 4.0, 0.75, 3.0, 1.3, 1.5, 1.2, materials.darkWood);
  box(world, loc, 4.0, 1.55, 3.0, 1.34, 0.12, 1.24, materials.wood);
  addEvidence(world, 'victimHome', loc, 0, frame);
  addEvidence(world, 'victimHome', loc, 1, notebook);
}

function buildApartment(world, loc) {
  bed(world, loc, -3.1, -1.7, 2.2, 3.4);
  table(world, loc, 2.4, -1.5, 2.5, 1.6);
  chair(world, loc, 2.4, 0.25, materials.darkWood, Math.PI);
  box(world, loc, 0, 2.15, -4.75, 4.8, 1.8, 0.14, materials.darkWood);
  for (let i = 0; i < 4; i++) box(world, loc, -1.65 + i * 1.1, 2.1, -4.64, 0.68, 0.9, 0.04, i % 2 ? materials.paper : materials.evidence);
  const map = box(world, loc, 2.4, 1.0, -1.5, 0.9, 0.05, 0.62, materials.paper, 0.1);
  cylinder(world, loc, 3.05, 1.12, -1.5, 0.16, 0.16, 0.18, materials.ceramic, 10);
  addEvidence(world, 'apartment', loc, 0, map);
}

function buildUndercroft(world, loc) {
  const floorY = -3.65, wallTop = -0.12, wallHeight = wallTop - floorY;
  const wallY = (wallTop + floorY) / 2;
  box(world, loc, 0, floorY, 0, loc.w - 0.5, 0.18, loc.d - 0.5, materials.stone);
  box(world, loc, 0, wallY, -loc.d / 2, loc.w, wallHeight, 0.42, materials.stone);
  box(world, loc, 0, wallY, loc.d / 2, loc.w, wallHeight, 0.42, materials.stone);
  box(world, loc, -loc.w / 2, wallY, 0, 0.42, wallHeight, loc.d, materials.stone);
  box(world, loc, loc.w / 2, wallY, 0, 0.42, wallHeight, loc.d, materials.stone);
  // Steps rise toward the chapel floor; the open top keeps the sunken room visible from below.
  for (let i = 0; i < 5; i++) box(world, loc, 7.0 - i * 0.9, -3.28 + i * 0.57, 6.4 - i * 1.55, 2.2, 0.22, 1.15, materials.darkWood);
  box(world, loc, -3.2, -2.55, -4.0, 4.8, 1.8, 2.4, materials.stone);
  box(world, loc, -3.2, -1.55, -4.0, 5.2, 0.2, 2.8, materials.darkWood);
  // Nine sockets and a worn ring are the undercroft's central evidence tableau.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.045, 6, 36), materials.brass);
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(point(loc, 0, -3.53, 0));
  world.scene.add(ring);
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9;
    cylinder(world, loc, Math.cos(a) * 2.15, -3.43, Math.sin(a) * 2.15, 0.07, 0.08, 0.3, materials.candle, 8);
  }
  const mark = box(world, loc, 0, -3.51, 0, 0.34, 0.035, 0.34, materials.evidence);
  const medal = cylinder(world, loc, -3.25, -1.42, -4.0, 0.23, 0.23, 0.07, materials.brass, 16);
  addEvidence(world, 'chapelBasement', loc, 0, mark);
  addEvidence(world, 'chapelBasement', loc, 1, medal);
  const light = new THREE.PointLight(0xb89563, 0.45, 16, 2);
  light.position.copy(point(loc, 0, -1.0, 0));
  world.scene.add(light);
}

const layouts = {
  precinct: buildPrecinct,
  chapel: buildChapel,
  library: buildLibrary,
  diner: buildDiner,
  hospital: buildHospital,
  bar: buildBar,
  motel: buildMotel,
  foundry: buildFoundry,
  warehouse: buildWarehouse,
  victimHome: buildVictimHome,
  apartment: buildApartment,
};

export function buildInteriors(world) {
  if (!world || !world.scene || !Array.isArray(world.interactables) || world._interiorsBuilt) return;
  world._interiorsBuilt = true;
  world.interactablesById ||= new Map(world.interactables.map(item => [item.id, item]));
  for (const [id, build] of Object.entries(layouts)) {
    const loc = LOCATIONS[id];
    if (loc) build(world, loc);
  }
  buildUndercroft(world, LOCATIONS.chapelBasement);
}
