import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { LOCATIONS, SCENE_ANCHORS, KEY_PLACES } from './lore.js';
import { labelTexture, sigilTexture, rngFor, clamp, lerp } from './util.js';
import { buildInteriors } from './interiors.js';

const matCache = new Map();
export function std(color, rough = 0.86, metal = 0, extra = {}) {
  const key = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  matCache.set(key, m);
  return m;
}
function glow(color, intensity = 1) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.7 });
}

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1214);
    this.camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.06, 420);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.querySelector('#scene').appendChild(this.renderer.domElement);

    this.colliders = [];
    this.interactables = [];
    this.interactablesById = new Map();
    this.interiors = [];
    this.buildingGroups = [];
    this.scenes = new Map();
    this.keyNpcs = new Map();
    this.genericNpc = null;
    this.genericList = [];
    this.windowMaterials = [];
    this.lampMaterials = [];
    this.neonMaterials = [];
    this.candleLights = [];
    this.clock = 0;
    this.lastEnv = 0;
    this.isInside = false;
    this.currentZone = null;
    this.rain = null;
    this.snow = null;
    this.stars = null;
    this.lightningT = 0;
    this.skyLerp = null;

    this._initLights();
    this._initGround();
    this._initRoads();
    this._initTown();
    this._initProps();
    buildInteriors(this);
    this._initWeather();
    this._initNpcMeshes();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
  }

  /* ---------------------------------------------------------------- */
  _initLights() {
    this.hemi = new THREE.HemisphereLight(0x6b7d80, 0x1a1d19, 0.55);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xa9b9c2, 2.1);
    this.sun.position.set(-40, 60, -30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -80; this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80; this.sun.shadow.camera.bottom = -80;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 200;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);
    this.moonLight = new THREE.DirectionalLight(0x7890a4, 0.35);
    this.moonLight.position.set(30, 45, 60);
    this.scene.add(this.moonLight);
    this.flashLight = new THREE.PointLight(0xd6e4ff, 0, 120);
    this.flashLight.position.set(0, 40, 0);
    this.scene.add(this.flashLight);
    this.scene.fog = new THREE.FogExp2(0x0c1214, 0.013);
  }

  planeMat(color, rough = 0.9) { return std(color, rough); }

  /* ---------------------------------------------------------------- */
  _initGround() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(330, 330), std(0x2b302a, 0.97));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; ground.receiveShadow = true;
    this.scene.add(ground);

    // river along the south edge
    const water = new THREE.Mesh(new THREE.PlaneGeometry(340, 44, 1, 1), new THREE.MeshStandardMaterial({ color: 0x26383d, roughness: 0.22, metalness: 0.45 }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, -0.01, 126); this.scene.add(water);
    for (let i = 0; i < 44; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(16 + Math.random() * 26, 0.05), new THREE.MeshBasicMaterial({ color: 0x5b7478, transparent: true, opacity: 0.18 }));
      p.rotation.x = -Math.PI / 2; p.position.set(-150 + Math.random() * 300, 0.009, 104 + Math.random() * 44);
      this.scene.add(p);
    }
    // river bank mud
    const bank = new THREE.Mesh(new THREE.PlaneGeometry(340, 12), std(0x3a3c30, 1));
    bank.rotation.x = -Math.PI / 2; bank.position.set(0, -0.005, 100); this.scene.add(bank);

    // wooded perimeter
    const trunk = std(0x2f2b22, 0.95), pine = std(0x1f2b23, 0.94), pine2 = std(0x28332a, 0.94);
    for (let i = 0; i < 120; i++) {
      const side = i % 4;
      let x, z;
      if (side === 0) { x = -160 + Math.random() * 320; z = -124 - Math.random() * 18; }
      else if (side === 1) { x = -160 + Math.random() * 320; z = 104 + Math.random() * 6; }
      else if (side === 2) { x = -128 - Math.random() * 26; z = -110 + Math.random() * 210; }
      else { x = 118 + Math.random() * 26; z = -110 + Math.random() * 210; }
      const s = 0.8 + Math.random() * 1.8;
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.22 * s, 2.2 * s, 5), trunk); t.position.y = 1.1 * s; g.add(t);
      for (let k = 0; k < 3; k++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry((1.25 - k * 0.28) * s, 2.2 * s, 6), k % 2 ? pine : pine2);
        cone.position.y = 2.1 * s + k * 1.0 * s; g.add(cone);
      }
      this.scene.add(g);
    }
  }

  /* ---------------------------------------------------------------- */
  _initRoads() {
    const asphalt = std(0x1b1e1e, 0.95);
    const sidewalk = std(0x565951, 0.94);
    const lineMat = std(0x8f8259, 0.7);
    const roadV = [-60, 0, 60], roadH = [-60, 0, 60];
    for (const x of roadV) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(11, 230), asphalt);
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.01, 0); r.receiveShadow = true; this.scene.add(r);
      for (const sx of [-7.2, 7.2]) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 230), sidewalk);
        s.rotation.x = -Math.PI / 2; s.position.set(x + sx, 0.028, 0); s.receiveShadow = true; this.scene.add(s);
      }
      for (let z = -108; z < 108; z += 6.5) {
        if (roadH.some(hz => Math.abs(z - hz) < 7)) continue;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.4), lineMat);
        m.rotation.x = -Math.PI / 2; m.position.set(x, 0.022, z); this.scene.add(m);
      }
    }
    for (const z of roadH) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(230, 11), asphalt);
      r.rotation.x = -Math.PI / 2; r.position.set(0, 0.012, z); r.receiveShadow = true; this.scene.add(r);
      for (const sz of [-7.2, 7.2]) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(230, 2.6), sidewalk);
        s.rotation.x = -Math.PI / 2; s.position.set(0, 0.03, z + sz); s.receiveShadow = true; this.scene.add(s);
      }
      for (let x = -108; x < 108; x += 6.5) {
        if (roadV.some(vx => Math.abs(x - vx) < 7)) continue;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.12), lineMat);
        m.rotation.x = -Math.PI / 2; m.position.set(x, 0.024, z); this.scene.add(m);
      }
    }
    // crosswalks
    for (const x of roadV) for (const z of roadH) {
      for (let i = -3; i <= 3; i++) {
        for (const [dx, dz, w, h] of [[0, -6.2, 7, 0.55], [0, 6.2, 7, 0.55], [-6.2, 0, 0.55, 7], [6.2, 0, 0.55, 7]]) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.5, h - 0.2), std(0x6d6a5b, 0.9));
          m.rotation.x = -Math.PI / 2; m.position.set(x + dx + (dx === 0 ? i * 0.9 : 0), 0.024, z + dz + (dz === 0 ? i * 0.9 : 0));
          this.scene.add(m);
        }
      }
    }
  }

  /* ---------------------------------------------------------------- */
  _initTown() {
    const rng = rngFor(1147, 'town');
    // key buildings
    for (const [id, loc] of Object.entries(LOCATIONS)) {
      if (id === 'chapelBasement') continue;
      if (loc.interior) this.makeEnterable(id, loc);
      else if (loc.kind === 'cemetery' || loc.kind === 'river') this.makeOutdoorZone(id, loc);
      else this.makeSolidBuilding(id, loc);
    }
    // residential infill
    const homes = [
      [-96, -44], [-74, -44], [-96, 62], [-72, 64], [-46, 76], [-26, 76],
      [70, -22], [92, -22], [92, 56], [68, 62], [84, 72], [64, 32],
      [-96, 6], [-96, 86], [-46, -92], [-20, -88], [68, -96], [96, -96],
      [-12, 94], [18, 72], [26, 88], [-52, -82], [96, 88], [56, -36],
    ];
    for (const [x, z] of homes) this.makeHouse(x, z, rng);
    this.makeCemetery();
    this.makeRiverbank();
  }

  addCollider(minX, maxX, minZ, maxZ, tag = 'solid') {
    this.colliders.push({ minX, maxX, minZ, maxZ, tag });
  }
  addColliderAt(x, z, w, d, tag) { this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, tag); }

  collides(x, z, r = 0.34) {
    if (x < -112 || x > 112 || z < -112 || z > 100) return true;
    for (const c of this.colliders) {
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  }

  makeBox(parent, x, y, z, w, h, d, material, cast = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
  }
  makeCylinder(parent, x, y, z, r1, r2, h, material, seg = 10) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), material);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  makePlane(parent, x, y, z, w, h, material, rx = -Math.PI / 2, ry = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; parent.add(m); return m;
  }
  sign(parent, text, x, y, z, w, h, opts = {}) {
    const tex = labelTexture(text, { w: 640, h: 140, bg: opts.bg || '#0b0e0e', color: opts.color || '#d7cdb7', borderColor: opts.borderColor || 'rgba(190,178,150,.4)', font: opts.font });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    m.position.set(x, y, z); m.rotation.y = opts.ry || 0; parent.add(m); return m;
  }

  makeSolidBuilding(id, loc) {
    const g = new THREE.Group();
    this.scene.add(g);
    const { x, z, w, d, h } = loc;
    const wall = std(loc.color, 0.9);
    const trim = std(0x6b675c, 0.9);
    this.makeBox(g, x, h / 2, z, w, h, d, wall);
    this.makeBox(g, x, h + 0.18, z, w + 0.9, 0.42, d + 0.9, std(0x262827, 0.95));
    this.addColliderAt(x, z, w, d, 'building');
    this.addWindows(x, z, w, d, h, loc.door || 'south', 0.18);
    const front = this.frontPos(loc);
    this.sign(g, loc.name.toUpperCase(), front.x, 3.5, front.z, Math.min(w * 0.72, 9), 1.15, { ry: front.ry });
    // awning + steps
    this.makeBox(g, front.x, 3.0, front.z + (front.nz || 0), Math.min(w * 0.7, 9), 0.18, 1.5, trim);
    this.makeBox(g, front.x, 0.12, front.z, 3.4, 0.24, 1.4, trim);
    return g;
  }

  addWindows(x, z, w, d, h, door, lit = 0.2) {
    const winMat = new THREE.MeshStandardMaterial({ color: 0x1a2021, emissive: 0xb59a63, emissiveIntensity: lit, roughness: 0.4 });
    this.windowMaterials.push(winMat);
    const floors = Math.max(1, Math.floor((h - 1.8) / 2.4));
    const alongFront = door === 'south' || door === 'north';
    const length = alongFront ? w : d;
    const n = Math.max(2, Math.floor(length / 3.2));
    for (let f = 0; f < floors; f++) {
      const y = 1.9 + f * 2.4;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * (length / n);
        for (const side of [-1, 1]) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(alongFront ? 1.05 : 0.08, 1.5, alongFront ? 0.08 : 1.05), winMat);
          if (alongFront) win.position.set(x + off, y, z + side * (d / 2 + 0.04));
          else win.position.set(x + side * (w / 2 + 0.04), y, z + off);
          this.scene.add(win);
        }
      }
    }
  }

  frontPos(loc) {
    const { x, z, w, d, door } = loc;
    if (door === 'east') return { x: x + w / 2 + 0.06, z, ry: Math.PI / 2, nz: 0 };
    if (door === 'west') return { x: x - w / 2 - 0.06, z, ry: -Math.PI / 2, nz: 0 };
    if (door === 'north') return { x, z: z - d / 2 - 0.06, ry: Math.PI, nz: 0 };
    return { x, z: z + d / 2 + 0.06, ry: 0, nz: 0 };
  }

  makeEnterable(id, loc) {
    const g = new THREE.Group(); this.scene.add(g);
    const { x, z, w, d, h } = loc;
    const wall = std(loc.color, 0.9);
    const inner = std(0x5b5950, 0.95);
    const floorMat = std(0x3a3a33, 0.88);
    const t = 0.42, doorW = 3.1;
    const door = loc.door || 'south';
    // floor + ceiling
    this.makeBox(g, x, -0.04, z, w - 0.1, 0.18, d - 0.1, floorMat, false);
    this.makeBox(g, x, h - 0.12, z, w, 0.26, d, std(0x2e302c, 0.95));
    // walls
    if (door === 'south' || door === 'north') {
      const frontZ = z + (door === 'south' ? d / 2 : -d / 2);
      const backZ = z + (door === 'south' ? -d / 2 : d / 2);
      this._wall(g, x - (w / 2 + doorW / 2) / 2 - 0.0, frontZ, (w - doorW) / 2, h, t, wall);
      this._wall(g, x + (w / 2 + doorW / 2) / 2, frontZ, (w - doorW) / 2, h, t, wall);
      this._wall(g, x, backZ, w, h, t, wall);
      this._wall(g, x - w / 2, z, t, h, d, wall);
      this._wall(g, x + w / 2, z, t, h, d, wall);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, 1.0, t), wall);
      lintel.position.set(x, h - 0.5, frontZ); g.add(lintel);
    } else {
      const frontX = x + (door === 'east' ? w / 2 : -w / 2);
      const backX = x - (door === 'east' ? w / 2 : -w / 2);
      this._wall(g, frontX, z - (d / 2 + doorW / 2) / 2 - 0.0, t, h, (d - doorW) / 2, wall);
      this._wall(g, frontX, z + (d / 2 + doorW / 2) / 2, t, h, (d - doorW) / 2, wall);
      this._wall(g, backX, z, t, h, d, wall);
      this._wall(g, x, z - d / 2, w, h, t, wall);
      this._wall(g, x, z + d / 2, w, h, t, wall);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(t, 1.0, doorW), wall);
      lintel.position.set(frontX, h - 0.5, z); g.add(lintel);
    }
    // interior shell trim
    this.makeBox(g, x, 0.82, z - d / 2 + 0.25, w - 1, 1.55, 0.06, inner, false);
    this.makeBox(g, x, 0.82, z + d / 2 - 0.25, w - 1, 1.55, 0.06, inner, false);
    // roof cap
    this.makeBox(g, x, h + 0.1, z, w + 0.8, 0.35, d + 0.8, std(0x2a2c29, 0.92));
    // facade sign & awning
    const front = this.frontPos(loc);
    this.sign(g, loc.name.toUpperCase(), front.x, 3.9, front.z, Math.min((door === 'east' || door === 'west' ? d : w) * 0.7, 10), 1.1, { ry: front.ry });
    if (door === 'south' || door === 'north') {
      this.makeBox(g, x, 3.2, z + (door === 'south' ? d / 2 + 0.55 : -d / 2 - 0.55), Math.min(w * 0.74, 11), 0.16, 1.3, std(0x403a30, 0.92));
      this.makeBox(g, x, 0.08, z + (door === 'south' ? d / 2 + 0.5 : -d / 2 - 0.5), doorW + 0.6, 0.16, 1.1, std(0x5b564a, 0.9));
    } else {
      this.makeBox(g, x + (door === 'east' ? w / 2 + 0.5 : -w / 2 - 0.5), 3.2, z, 1.3, 0.16, Math.min(d * 0.7, 11), std(0x403a30, 0.92));
    }
    // windows (decoration, exterior)
    this.addWindows(x, z, w, d, h, door, 0.3);
    // doorway frame
    if (door === 'south') this.makeBox(g, x, 0.12, z + d / 2 - 0.1, doorW + 0.8, 0.22, 0.6, std(0x6a6252, 0.8));
    if (door === 'east') this.makeBox(g, x + w / 2 - 0.1, 0.12, z, 0.6, 0.22, doorW + 0.8, std(0x6a6252, 0.8));

    // interior light
    const light = new THREE.PointLight(0xd8b27a, 0, w + d + 12, 2);
    light.position.set(x, h - 1.0, z); this.scene.add(light);
    for (let i = 0; i < 2; i++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.7), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }));
      panel.position.set(x + (i ? 3 : -3), h - 0.28, z); panel.material.transparent = true; panel.material.opacity = 0.72; this.scene.add(panel);
    }
    this.interiors.push({ id, loc, light });
    this.addColliderAt(x, z, 0.01, 0.01, 'noop');
    return g;
  }

  _wall(g, x, z, w, h, d, m) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    wall.position.set(x, h / 2, z); wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
    this.addColliderAt(x, z, w, d, 'wall');
    return wall;
  }

  makeOutdoorZone(id, loc) {
    // subtle ground patch for cemetery / riverbank is built separately
    this.outdoorZones = this.outdoorZones || {};
    this.outdoorZones[id] = loc;
  }

  makeHouse(x, z, rng) {
    const w = 7.5 + rng() * 3.2, d = 7 + rng() * 3.2, h = 4.2 + rng() * 1.8;
    const colors = [0x5e5a4c, 0x6c6150, 0x555b51, 0x6b5b4c, 0x4f5654, 0x665a4f];
    const g = new THREE.Group(); this.scene.add(g);
    const wall = std(colors[Math.floor(rng() * colors.length)], 0.93);
    this.makeBox(g, x, h / 2, z, w, h, d, wall);
    // gable roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.3, 4), std(0x2c2a25, 0.95));
    roof.rotation.y = Math.PI / 4; roof.position.set(x, h + 1.05, z); roof.scale.set(1, 0.9, d / w); roof.castShadow = true; g.add(roof);
    this.addColliderAt(x, z, w, d, 'house');
    this.addWindows(x, z, w, d, h, 'south', 0.15);
    // porch
    this.makeBox(g, x, 2.6, z + d / 2 + 0.7, 3.2, 0.16, 1.4, std(0x39362e, 0.9));
    this.makeBox(g, x, 0.08, z + d / 2 + 0.7, 3.2, 0.15, 1.4, std(0x4a473e, 0.9));
    this.makeBox(g, x + 1.2, 1.3, z + d / 2 + 1.3, 0.12, 2.6, 0.12, std(0x2f2b24, 0.9));
    this.makeBox(g, x - 1.2, 1.3, z + d / 2 + 1.3, 0.12, 2.6, 0.12, std(0x2f2b24, 0.9));
    // porch bulb
    const bulbMat = glow(0xd9b77c, 0.5); this.lampMaterials.push(bulbMat);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), bulbMat); bulb.position.set(x, 2.45, z + d / 2 + 0.5); g.add(bulb);
    // chimney
    if (rng() < 0.6) this.makeBox(g, x + w * 0.27, h + 1.3, z - d * 0.2, 0.55, 2.2, 0.55, std(0x4a3d33, 0.95));
    // parked car sometimes
    if (rng() < 0.4) this.makeCar(x - w / 2 - 2.2, z + d / 2 + 3.2, rng, false);
  }

  makeCar(x, z, rng, police = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rng() * Math.PI; this.scene.add(g);
    const colors = [0x272b2b, 0x3d3a35, 0x22302f, 0x4a3c32, 0x59574e];
    const body = std(police ? 0x20292b : colors[Math.floor(rng() * colors.length)], 0.42, 0.3);
    this.makeBox(g, 0, 0.55, 0, 4.3, 0.55, 1.85, body);
    this.makeBox(g, -0.2, 1.02, 0, 2.15, 0.55, 1.62, std(0x1a2022, 0.3, 0.4));
    const wheel = std(0x0c0d0d, 0.9);
    for (const [wx, wz] of [[-1.4, -0.95], [1.4, -0.95], [-1.4, 0.95], [1.4, 0.95]]) {
      const wheelM = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 10), wheel);
      wheelM.rotation.z = Math.PI / 2; wheelM.position.set(wx, 0.36, wz); g.add(wheelM);
    }
    const lm = glow(police ? 0x9fc7d6 : 0xd9c49a, 0.4);
    for (const wz of [-0.62, 0.62]) {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), lm); hl.position.set(2.16, 0.62, wz); g.add(hl);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.4), glow(0x8d2418, 0.6)); tail.position.set(-2.16, 0.62, 0.55); g.add(tail);
    if (police) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.5), glow(0x6f1a12, 0.6)); bar.position.set(-0.2, 1.4, 0); g.add(bar);
    }
    this.addColliderAt(x, z, 4.6, 2.1, 'car');
    return g;
  }

  makeCemetery() {
    const loc = LOCATIONS.cemetery;
    const g = new THREE.Group(); this.scene.add(g);
    const rng = rngFor(91, 'cemetery');
    const stone = std(0x5a5c55, 0.95), dark = std(0x3e413b, 0.95), iron = std(0x242724, 0.7, 0.4);
    this.makePlane(g, loc.x, 0.0, loc.z, 52, 34, std(0x2c332b, 0.98));
    // iron fence
    for (let i = 0; i < 26; i++) {
      const x = loc.x - 26 + i * 2.08;
      for (const z of [loc.z - 17, loc.z + 17]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.4, 4), iron);
        post.position.set(x, 0.7, z); g.add(post);
      }
    }
    this.makeBox(g, loc.x, 1.45, loc.z - 17, 54, 0.08, 0.08, iron);
    this.makeBox(g, loc.x, 1.45, loc.z + 17, 54, 0.08, 0.08, iron);
    // graves
    for (let i = 0; i < 46; i++) {
      const gx = loc.x - 23 + (i % 11) * 4.4 + rng() * 1.1;
      const gz = loc.z - 12 + Math.floor(i / 11) * 6.2 + rng() * 1.2;
      if (Math.abs(gx - loc.x) < 4 && Math.abs(gz - loc.z) < 5) continue;
      const h = 0.9 + rng() * 0.6;
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.72, h, 0.15), rng() < 0.3 ? stone : dark);
      st.position.set(gx, h / 2, gz); st.rotation.y = (rng() - 0.5) * 0.3; st.castShadow = true; g.add(st);
      if (rng() < 0.5) { const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.55), stone); base.position.set(gx, 0.09, gz); g.add(base); }
    }
    // mausoleum
    const mx = loc.x + 18, mz = loc.z - 9;
    this.makeBox(g, mx, 2.0, mz, 4.4, 4.0, 4.8, stone);
    const mRoof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.8, 4), dark); mRoof.rotation.y = Math.PI / 4; mRoof.position.set(mx, 4.8, mz); g.add(mRoof);
    this.makeBox(g, mx, 1.2, mz + 2.42, 1.4, 2.4, 0.14, std(0x161817, 0.9));
    this.addColliderAt(mx, mz, 4.4, 4.8, 'mausoleum');
    // trees
    for (let i = 0; i < 9; i++) this.makeTree(loc.x - 24 + rng() * 48, loc.z - 15 + rng() * 30, 0.8 + rng() * 0.8);
    // chapel ruin at the far side
    const rx = loc.x - 19, rz = loc.z - 13;
    this.makeBox(g, rx, 1.8, rz, 6, 3.4, 5, dark);
    this.makeBox(g, rx, 2.2, rz + 2.55, 2.2, 2.2, 0.2, std(0x141717, 1));
    this.addColliderAt(rx, rz, 6, 5, 'ruin');
    this.makeTree(loc.x - 2, loc.z + 4, 1.4);
    // path
    this.makeBox(g, loc.x, 0.02, loc.z + 4, 3, 0.02, 22, std(0x4a4a3e, 0.95), false);
    // lamps
    for (const [lx, lz] of [[loc.x - 20, loc.z + 14], [loc.x + 20, loc.z + 14]]) this.makeStreetLamp(lx, lz);
  }

  makeRiverbank() {
    const g = new THREE.Group(); this.scene.add(g);
    this.makePlane(g, 36, 0.0, 96, 60, 24, std(0x3a3b2f, 0.98));
    for (let i = 0; i < 18; i++) this.makeTree(14 + Math.random() * 46, 88 + Math.random() * 10, 0.7 + Math.random() * 0.9);
    // concrete flood wall
    this.makeBox(g, 36, 0.55, 104, 60, 1.1, 0.5, std(0x55564c, 0.95));
    this.addCollider(6, 66, 103.6, 104.4, 'wall');
    // mooring posts, reeds, debris
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.8, 6), std(0x3f3529, 0.9));
      p.position.set(10 + i * 7, 0.9, 98); g.add(p);
    }
    const reeds = std(0x4b5138, 0.95);
    for (let i = 0; i < 70; i++) {
      const r = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.9 + Math.random() * 0.7, 3), reeds);
      r.position.set(8 + Math.random() * 54, 0.5, 94 + Math.random() * 8); g.add(r);
    }
    // ruined boathouse
    this.makeBox(g, 58, 1.4, 92, 6, 2.8, 5, std(0x33382f, 0.95));
    this.addColliderAt(58, 92, 6, 5, 'boathouse');
    this.makeStreetLamp(24, 91);
  }

  makeStreetLamp(x, z) {
    const g = new THREE.Group(); this.scene.add(g);
    const iron = std(0x1b201e, 0.7, 0.4);
    this.makeCylinder(g, x, 2.4, z, 0.06, 0.1, 4.8, iron, 6);
    this.makeBox(g, x, 4.78, z, 0.7, 0.1, 0.1, iron);
    const bulbMat = glow(0xe9c68a, 0.25); this.lampMaterials.push(bulbMat);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), bulbMat);
    bulb.position.set(x, 4.68, z); g.add(bulb);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshBasicMaterial({ color: 0xe9c68a, transparent: true, opacity: 0.08, depthWrite: false }));
    halo.position.set(x, 4.68, z); g.add(halo);
    this.addColliderAt(x, z, 0.3, 0.3, 'lamp');
  }

  makeTree(x, z, s = 1) {
    const g = new THREE.Group(); this.scene.add(g);
    const trunk = std(0x332b21, 0.95);
    const leaf = std(0x263329, 0.95), leaf2 = std(0x303d30, 0.95);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.2 * s, 2.6 * s, 6), trunk);
    t.position.set(x, 1.3 * s, z); t.castShadow = true; g.add(t);
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry((1.25 - i * 0.16) * s, 0), i % 2 ? leaf2 : leaf);
      c.position.set(x + (i - 1) * 0.3 * s, (2.7 + i * 0.65) * s, z + (i % 2 ? 0.2 : -0.18) * s);
      c.castShadow = true; g.add(c);
    }
    this.addColliderAt(x, z, 0.5 * s, 0.5 * s, 'tree');
    return g;
  }

  makeStreetFurniture() {
    const rng = rngFor(44, 'props');
    // benches around the square near the center west block
    for (const [x, z, ry] of [[-7, -4, 0], [-7, 4, 0], [-40, -4, 1.57], [52, 2, 1.57]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; this.scene.add(g);
      this.makeBox(g, 0, 0.45, 0, 2.0, 0.12, 0.55, std(0x4b3c2e, 0.9));
      this.makeBox(g, 0, 0.78, -0.25, 2.0, 0.55, 0.1, std(0x4b3c2e, 0.9));
      for (const dx of [-0.8, 0.8]) this.makeBox(g, dx, 0.22, 0, 0.1, 0.44, 0.5, std(0x242626, 0.7, 0.3));
    }
    // dumpsters behind diner / bar
    for (const [x, z] of [[-26, 50], [52, 50], [-8, -22], [90, -34]]) {
      const d = this.makeBox(this.scene, x, 0.7, z, 2.2, 1.35, 1.2, std(0x304037, 0.85));
      this.addColliderAt(x, z, 2.2, 1.2, 'dumpster');
    }
    // hydrants
    for (const [x, z] of [[-7, 12], [7, -40], [68, 3], [-66, 1]]) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.8, 8), std(0x7c2b20, 0.75));
      h.position.set(x, 0.4, z); this.scene.add(h);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), std(0x7c2b20, 0.75)); cap.position.set(x, 0.84, z); this.scene.add(cap);
    }
    // trash / newspapers
    for (let i = 0; i < 22; i++) {
      const x = -100 + rng() * 200, z = -100 + rng() * 190;
      if (Math.abs(x % 60) < 8 || Math.abs(z % 60) < 8) continue;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.3 + rng() * 0.4, 0.02, 0.2 + rng() * 0.3), std(0x6d695a, 1));
      p.position.set(x, 0.02, z); p.rotation.y = rng() * 3; this.scene.add(p);
    }
    // telephone poles + wires
    const pole = std(0x2d2a23, 0.95);
    const poles = [[-73, -55], [-73, -25], [-73, 5], [-73, 35], [72, -55], [72, -25], [72, 5], [72, 35]];
    for (const [x, z] of poles) {
      this.makeCylinder(this.scene, x, 4.5, z, 0.13, 0.18, 9, pole, 6);
      this.makeBox(this.scene, x, 8.2, z, 2.2, 0.13, 0.13, pole);
    }
    for (let i = 0; i < 3; i++) {
      const y = 7.3 + i * 0.5;
      for (const side of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 4; k++) {
          const z = -55 + k * 30;
          pts.push(new THREE.Vector3(side === -1 ? -73 : 72, y - Math.sin(k / 4 * Math.PI) * 0.35, z));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x191c1b, transparent: true, opacity: 0.7 }));
        this.scene.add(line);
      }
    }
  }

  _initProps() {
    this.makeStreetFurniture();
    // street lamps around the main roads
    for (let z = -100; z <= 80; z += 26) {
      this.makeStreetLamp(-8, z + 3); this.makeStreetLamp(8, z - 3);
      if (z % 52 === 0) { this.makeStreetLamp(-52, z); this.makeStreetLamp(52, z + 10); }
    }
    for (let x = -96; x <= 96; x += 30) {
      if (Math.abs(x) > 10) { this.makeStreetLamp(x, 8); this.makeStreetLamp(x, -8); }
    }
    // police cruiser
    this.makeCar(12, -18, rngFor(3, 'car'), true);
    this.makeCar(-50, -20, rngFor(4, 'car'));
    this.makeCar(44, 52, rngFor(5, 'car'));
    this.makeCar(84, 40, rngFor(6, 'car'));
    // plaza
    const g = new THREE.Group(); this.scene.add(g);
    const stone = std(0x4b4a40, 0.92);
    this.makeBox(g, -7, 0.02, 0, 9, 0.04, 12, stone, false);
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 0.55, 20), std(0x4f4c40, 0.9));
    fountain.position.set(-7, 0.27, 0); this.scene.add(fountain);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0x33494c, roughness: 0.2, metalness: 0.4 }));
    water.position.set(-7, 0.52, 0); this.scene.add(water);
    this.addColliderAt(-7, 0, 3.6, 3.6, 'fountain');
    // noticeboard with missing persons
    const board = new THREE.Group(); board.position.set(-13.8, 2.2, 7); this.scene.add(board);
    this.makeBox(board, 0, 0, 0, 2.2, 1.5, 0.12, std(0x40372b, 0.9));
    this.makeBox(board, 0, 0.1, 0.08, 1.95, 1.2, 0.02, std(0xcfc6af, 0.9));
    this.sign(board, 'MISSING', 0, 0.45, 0.1, 1.2, 0.28, { bg: '#d9d1bc', color: '#6e2419', border: false });
    this.makeTree(-14, 10, 1.1);
  }

  _initWeather() {
    // rain points surrounding the camera
    const N = 1600;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 46;
      pos[i * 3 + 1] = Math.random() * 24;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 46;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x9eb1b5, size: 0.045, transparent: true, opacity: 0.55, depthWrite: false });
    this.rain = new THREE.Points(geo, mat);
    this.rain.frustumCulled = false; this.scene.add(this.rain);
    this.rainVel = new Float32Array(N);

    // snow points
    const snowGeo = new THREE.BufferGeometry();
    const spos = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) { spos[i * 3] = (Math.random() - 0.5) * 40; spos[i * 3 + 1] = Math.random() * 20; spos[i * 3 + 2] = (Math.random() - 0.5) * 40; }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    this.snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xd9dfdd, size: 0.09, transparent: true, opacity: 0.7, depthWrite: false }));
    this.snow.frustumCulled = false; this.snow.visible = false; this.scene.add(this.snow);

    // stars
    const starGeo = new THREE.BufferGeometry();
    const sPos = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) {
      const r = 190, th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.42;
      sPos[i * 3] = Math.cos(th) * Math.sin(ph) * r;
      sPos[i * 3 + 1] = Math.cos(ph) * r + 20;
      sPos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9aabae, size: 0.42, transparent: true, opacity: 0, depthWrite: false }));
    this.stars.frustumCulled = false; this.scene.add(this.stars);

    // moon
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(5.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xc9d0c8 }));
    this.moon.position.set(80, 120, -130); this.scene.add(this.moon);
  }
