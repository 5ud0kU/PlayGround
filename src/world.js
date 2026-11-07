import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { mulberry32 } from "./genetics.js";

export const POND = { x: -4.25, z: -1.65, radius: 2.25 };

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const smooth = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = Math.sin(x * 0.52) * 0.034 + Math.cos(z * 0.67) * 0.03 + Math.sin((x + z) * 1.17) * 0.013;
  h *= smooth(0.8, 4.4, r);
  h += smooth(8.2, 10.4, r) * 0.18;
  const pondD = Math.hypot(x - POND.x, z - POND.z);
  h -= (1 - smooth(POND.radius * 0.3, POND.radius * 1.12, pondD)) * 0.14;
  return h;
}

function makeNoiseTexture(size = 512, base = "#b5b8a6", seed = 7) {
  const rng = mulberry32(seed);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const radius = 0.4 + rng() * 4.4;
    const shade = Math.floor(70 + rng() * 90);
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade - 8}, ${0.04 + rng() * 0.14})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 170; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.strokeStyle = `rgba(55, 55, 48, ${0.03 + rng() * 0.09})`;
    ctx.lineWidth = 0.5 + rng() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + rng() * 25 - 12, y + rng() * 25 - 12, x + rng() * 48 - 24, y + rng() * 48 - 24);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeRadialTexture(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)", size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.3, inner);
  grad.addColorStop(1, outer);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeGroundClearingTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, "rgba(111, 112, 73, 0.52)");
  grad.addColorStop(0.58, "rgba(98, 101, 66, 0.34)");
  grad.addColorStop(0.85, "rgba(78, 86, 58, 0.09)");
  grad.addColorStop(1, "rgba(78, 86, 58, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const rng = mulberry32(41);
  for (let i = 0; i < 130; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.fillStyle = `rgba(180, 170, 125, ${rng() * 0.06})`;
    ctx.beginPath();
    ctx.arc(x, y, rng() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.time = 0;
    this.ripples = [];
    this.bursts = [];
    this.fireflies = [];
    this.sporeCloud = null;
    this.predatorEyes = [];
    this.fruits = [];
    this.selectionRing = null;
    this.environment = { climate: 1, food: 1, predators: 1 };
    this.selectionFocus = new THREE.Vector3(0, 1.05, 0);
    this.focusTarget = new THREE.Vector3(0, 1.05, 0);
    this.resizeHandlers = [];
    this.disposables = [];

    this.setupRenderer();
    this.setupScene();
    this.setupLights();
    this.buildIsland();
    this.buildPond();
    this.buildFlora();
    this.buildDetails();
    this.buildAtmosphere();
    this.setupSelectionRing();
    this.setupPostprocessing();
    this.bindResize();
    this.resize();
    this.applyEnvironment(this.environment, true);
    this.animate();
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.85));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x071612, 0.016);
    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(6.25, 4.95, 9.0);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.95, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.minDistance = 5.2;
    this.controls.maxDistance = 26;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.46;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.22;
    this.controls.rotateSpeed = 0.65;
    this.controls.zoomSpeed = 0.7;
    this.controls.update();

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.lifeGroup = new THREE.Group();
    this.scene.add(this.lifeGroup);
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0x9be2c9, 0x09130f, 1.02);
    this.scene.add(hemi);
    this.hemi = hemi;

    const key = new THREE.DirectionalLight(0xffe7c2, 2.35);
    key.position.set(7.5, 12.5, 6.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -11;
    key.shadow.camera.right = 11;
    key.shadow.camera.top = 11;
    key.shadow.camera.bottom = -11;
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 30;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.025;
    this.scene.add(key);
    this.keyLight = key;

    const fill = new THREE.DirectionalLight(0x62d8ff, 0.92);
    fill.position.set(-8.5, 5, -7);
    this.scene.add(fill);
    this.fillLight = fill;

    const rim = new THREE.PointLight(0x59ffd1, 14, 15, 2);
    rim.position.set(0, 4.2, -8);
    this.scene.add(rim);
    this.rimLight = rim;

    const under = new THREE.PointLight(0x39d9b2, 10, 9, 2);
    under.position.set(-4.2, 0.5, 1.5);
    this.scene.add(under);
    this.pondLight = under;

    this.scene.add(new THREE.AmbientLight(0x2e5a49, 0.42));
  }

  buildIsland() {
    const group = new THREE.Group();
    this.root.add(group);
    this.island = group;

    // Top soil mesh, built as a radial grid so the rim can ripple organically.
    const rings = 30;
    const segments = 128;
    const radius = 10.45;
    const positions = [];
    const colors = [];
    const uvs = [];
    const indices = [];
    const color = new THREE.Color();
    const rng = mulberry32(9);

    // center
    positions.push(0, terrainHeight(0, 0), 0);
    color.setHSL(0.23 + rng() * 0.018, 0.28, 0.31);
    colors.push(color.r, color.g, color.b);
    uvs.push(0.5, 0.5);

    for (let ring = 1; ring <= rings; ring += 1) {
      const rr = (ring / rings) * radius;
      for (let s = 0; s < segments; s += 1) {
        const a = (s / segments) * Math.PI * 2;
        const wobble = 1 + Math.sin(a * 5 + 1.2) * 0.012 + Math.sin(a * 9 - 2) * 0.006;
        const x = Math.cos(a) * rr * wobble;
        const z = Math.sin(a) * rr * wobble;
        const y = terrainHeight(x, z);
        positions.push(x, y, z);
        const clearing = 1 - smooth(1.8, 4.2, Math.hypot(x, z));
        const moisture = 1 - smooth(2.0, 4.4, Math.hypot(x - POND.x, z - POND.z));
        const rim = smooth(8.8, 10.4, rr);
        color.setHSL(
          0.205 + Math.sin(x * 0.82 + z * 0.4) * 0.018 + clearing * 0.018,
          0.24 + moisture * 0.13 - rim * 0.09,
          0.265 + Math.sin(z * 0.7) * 0.02 + clearing * 0.055 + rim * 0.012,
        );
        colors.push(color.r, color.g, color.b);
        uvs.push(x / (radius * 2) + 0.5, z / (radius * 2) + 0.5);
      }
    }

    for (let s = 0; s < segments; s += 1) {
      indices.push(0, 1 + ((s + 1) % segments), 1 + s);
    }
    for (let ring = 1; ring < rings; ring += 1) {
      const rowA = 1 + (ring - 1) * segments;
      const rowB = 1 + ring * segments;
      for (let s = 0; s < segments; s += 1) {
        const next = (s + 1) % segments;
        const a = rowA + s;
        const b = rowA + next;
        const c = rowB + s;
        const d = rowB + next;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const terrainMap = makeNoiseTexture(512, "#c7c8b8", 12);
    terrainMap.repeat.set(3.2, 3.2);
    const terrainMaterial = new THREE.MeshStandardMaterial({
      map: terrainMap,
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
    });
    const terrain = new THREE.Mesh(geometry, terrainMaterial);
    terrain.receiveShadow = true;
    group.add(terrain);
    this.terrain = terrain;

    // Soft worn clearing beneath the population.
    const clearingTexture = makeGroundClearingTexture();
    const clearing = new THREE.Mesh(
      new THREE.CircleGeometry(3.7, 64),
      new THREE.MeshStandardMaterial({
        map: clearingTexture,
        transparent: true,
        roughness: 1,
        depthWrite: false,
        opacity: 0.85,
      }),
    );
    clearing.rotation.x = -Math.PI / 2;
    clearing.position.y = 0.023;
    clearing.receiveShadow = true;
    group.add(clearing);

    // Thick rocky underside.
    const rimGeo = new THREE.CylinderGeometry(radius, 9.82, 1.35, 96, 2, false);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x26322d, roughness: 0.92, metalness: 0.04 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.y = -0.675;
    rim.receiveShadow = true;
    rim.castShadow = true;
    group.add(rim);

    const strata = [
      { r: 9.8, y: -1.04, h: 0.28, color: 0x1b2722, rot: 0.16 },
      { r: 9.4, y: -1.45, h: 0.28, color: 0x374038, rot: -0.2 },
      { r: 9.05, y: -1.84, h: 0.3, color: 0x1d2925, rot: 0.3 },
    ];
    for (const layer of strata) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(layer.r, layer.r - 0.22, layer.h, 96, 1),
        new THREE.MeshStandardMaterial({ color: layer.color, roughness: 0.96, metalness: 0.02 }),
      );
      mesh.position.y = layer.y;
      mesh.rotation.y = layer.rot;
      group.add(mesh);
    }

    const keelGeo = new THREE.ConeGeometry(8.7, 4.8, 24, 4);
    const keel = new THREE.Mesh(
      keelGeo,
      new THREE.MeshStandardMaterial({ color: 0x131c19, roughness: 0.98, flatShading: true }),
    );
    keel.rotation.x = Math.PI;
    keel.rotation.y = 0.1;
    keel.position.y = -4.92;
    group.add(keel);

    // Holographic edge rings give the diorama a laboratory frame.
    const edgeRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 0.03, 0.012, 6, 160),
      new THREE.MeshBasicMaterial({ color: 0x7affe0, transparent: true, opacity: 0.42 }),
    );
    edgeRing.rotation.x = Math.PI / 2;
    edgeRing.position.y = 0.026;
    group.add(edgeRing);

    const lowerRing = new THREE.Mesh(
      new THREE.TorusGeometry(9.22, 0.018, 6, 160),
      new THREE.MeshBasicMaterial({ color: 0x4feac5, transparent: true, opacity: 0.38 }),
    );
    lowerRing.rotation.x = Math.PI / 2;
    lowerRing.position.y = -1.62;
    group.add(lowerRing);
    this.edgeRings = [edgeRing, lowerRing];

    const tickMaterial = new THREE.MeshBasicMaterial({ color: 0xa9ffe1, transparent: true, opacity: 0.36 });
    for (let i = 0; i < 32; i += 1) {
      const a = (i / 32) * Math.PI * 2;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, i % 4 === 0 ? 0.34 : 0.16), tickMaterial);
      tick.position.set(Math.cos(a) * (radius + 0.35), 0.01, Math.sin(a) * (radius + 0.35));
      tick.rotation.y = -a + Math.PI / 2;
      group.add(tick);
    }

    this.addRocks(group);
  }

  addRocks(group) {
    const rng = mulberry32(32);
    const rockMatA = new THREE.MeshStandardMaterial({ color: 0x59655e, roughness: 0.93, flatShading: true });
    const rockMatB = new THREE.MeshStandardMaterial({ color: 0x3b4b43, roughness: 0.97, flatShading: true });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x527449, roughness: 1, flatShading: true });
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);

    for (let i = 0; i < 34; i += 1) {
      const angle = rng() * Math.PI * 2;
      const nearRim = rng() > 0.22;
      const rr = nearRim ? 8.1 + rng() * 2.0 : 3.6 + rng() * 4.1;
      const x = Math.cos(angle) * rr;
      const z = Math.sin(angle) * rr;
      if (Math.hypot(x - POND.x, z - POND.z) < POND.radius + 0.35) continue;
      const s = nearRim ? 0.2 + rng() * 0.72 : 0.16 + rng() * 0.52;
      const rock = new THREE.Mesh(rockGeo, rng() > 0.42 ? rockMatA : rockMatB);
      rock.scale.set(s * (0.9 + rng() * 0.5), s * (0.52 + rng() * 0.38), s);
      rock.position.set(x, terrainHeight(x, z) + s * 0.18, z);
      rock.rotation.set(rng() * 2, rng() * 6, rng() * 2);
      rock.castShadow = true;
      rock.receiveShadow = true;
      group.add(rock);

      if (rng() > 0.48) {
        const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mossMat);
        moss.scale.set(s * 0.72, s * 0.1, s * 0.58);
        moss.position.set(x + rng() * 0.1, rock.position.y + s * 0.35, z + rng() * 0.1);
        moss.rotation.y = rng() * 6;
        group.add(moss);
      }
    }

    // Larger stones frame the habitat edge.
    const anchorPositions = [
      [-7.8, -6.0, 1.1],
      [7.2, -6.8, 1.35],
      [8.8, 2.1, 0.9],
      [-8.5, 4.7, 1.0],
      [4.6, 7.2, 0.85],
    ];
    for (const [x, z, s] of anchorPositions) {
      const rock = new THREE.Mesh(rockGeo, rockMatB);
      rock.scale.set(s * 1.4, s * 0.85, s);
      rock.position.set(x, terrainHeight(x, z) + s * 0.28, z);
      rock.rotation.set(rng() * 1.2, rng() * 6, rng() * 1.2);
      rock.castShadow = true;
      rock.receiveShadow = true;
      group.add(rock);
    }
  }

  buildPond() {
    const group = new THREE.Group();
    this.root.add(group);
    this.pondGroup = group;

    const shore = new THREE.Mesh(
      new THREE.RingGeometry(POND.radius * 0.92, POND.radius * 1.33, 56),
      new THREE.MeshStandardMaterial({ color: 0x6a6b4e, roughness: 0.98, side: THREE.DoubleSide }),
    );
    shore.rotation.x = -Math.PI / 2;
    shore.scale.set(1.2, 1, 0.82);
    shore.position.set(POND.x, 0.022, POND.z);
    shore.receiveShadow = true;
    group.add(shore);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a4650,
      roughness: 0.14,
      metalness: 0.05,
      transmission: 0.16,
      transparent: true,
      opacity: 0.88,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.4,
      side: THREE.DoubleSide,
    });
    const water = new THREE.Mesh(new THREE.CircleGeometry(POND.radius * 0.94, 64), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.scale.set(1.18, 0.8, 1);
    water.position.set(POND.x, 0.075, POND.z);
    water.receiveShadow = true;
    group.add(water);
    this.water = water;

    for (let i = 0; i < 3; i += 1) {
      const ripple = new THREE.Mesh(
        new THREE.RingGeometry(0.35 + i * 0.33, 0.37 + i * 0.33, 64),
        new THREE.MeshBasicMaterial({ color: 0xa7ffe2, transparent: true, opacity: 0.2, side: THREE.DoubleSide }),
      );
      ripple.rotation.x = -Math.PI / 2;
      ripple.scale.set(1.2, 0.82, 1);
      ripple.position.set(POND.x - 0.25, 0.087, POND.z + 0.15);
      group.add(ripple);
      this.ripples.push({ mesh: ripple, offset: i * 0.95 });
    }

    const padMat = new THREE.MeshStandardMaterial({ color: 0x426f45, roughness: 0.86, side: THREE.DoubleSide });
    const padGeo = new THREE.CircleGeometry(0.2, 12);
    const padPositions = [
      [0.55, 0.25, 0.29],
      [-0.4, -0.4, 0.22],
      [0.2, -0.5, 0.16],
      [-0.65, 0.48, 0.18],
    ];
    for (const [dx, dz, s] of padPositions) {
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = Math.random() * 6;
      pad.scale.set(1.2 * s * 4, 1, s * 4);
      pad.position.set(POND.x + dx * 2, 0.092, POND.z + dz * 2);
      group.add(pad);
    }

    // Glowing mineral shards leaning out of the water.
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0x38d5b6,
      emissive: 0x27c9a8,
      emissiveIntensity: 0.55,
      roughness: 0.24,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82,
    });
    const shards = [
      [-0.95, 0.9, 0.28, 1.2],
      [-0.55, 1.15, 0.2, 0.8],
      [-1.2, 0.62, 0.15, 0.55],
    ];
    for (const [dx, dz, s, h] of shards) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(s, h, 5), shardMat);
      shard.position.set(POND.x + dx, 0.12 + h * 0.38, POND.z + dz);
      shard.rotation.z = -0.18 + Math.random() * 0.2;
      shard.rotation.x = 0.12;
      group.add(shard);
    }

    this.pondLight.position.set(POND.x, 0.7, POND.z);
  }

  buildFlora() {
    const group = new THREE.Group();
    this.root.add(group);
    this.floraGroup = group;
    const rng = mulberry32(87);

    this.buildGrass(group, rng);
    this.buildFerns(group, rng);
    this.buildTrees(group, rng);
    this.buildMushrooms(group, rng);
    this.buildFruit(group, rng);
  }

  buildGrass(group, rng) {
    const count = 2600;
    const bladeGeo = new THREE.ConeGeometry(0.014, 0.46, 3, 1);
    bladeGeo.translate(0, 0.23, 0);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x6b8c4c,
      roughness: 0.93,
      side: THREE.DoubleSide,
    });
    const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, count);
    grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 14) {
      guard += 1;
      const a = rng() * Math.PI * 2;
      const rr = Math.sqrt(rng()) * 9.7;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      const pondD = Math.hypot(x - POND.x, z - POND.z);
      if (pondD < POND.radius * 1.12) continue;
      if (Math.hypot(x, z) < 2.2) continue;
      const clearing = smooth(2.2, 4.3, Math.hypot(x, z));
      if (rng() > 0.22 + clearing * 0.78) continue;
      const scale = 0.55 + rng() * 1.25 + clearing * 0.35;
      dummy.position.set(x, terrainHeight(x, z) - 0.01, z);
      dummy.rotation.set((rng() - 0.5) * 0.25, rng() * Math.PI * 2, (rng() - 0.5) * 0.24);
      dummy.scale.set(0.7 + rng() * 0.7, scale, 0.7 + rng() * 0.7);
      dummy.updateMatrix();
      grass.setMatrixAt(placed, dummy.matrix);
      color.setHSL(0.2 + rng() * 0.05, 0.25 + rng() * 0.24, 0.28 + rng() * 0.16);
      grass.setColorAt(placed, color);
      placed += 1;
    }
    grass.count = placed;
    grass.receiveShadow = true;
    group.add(grass);
  }

  buildFerns(group, rng) {
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.09, 0.32, 0.02, 0.9);
    leafShape.quadraticCurveTo(0, 1.0, -0.02, 0.9);
    leafShape.quadraticCurveTo(-0.09, 0.32, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape, 8);
    leafGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 24; i += 1) {
      const a = rng() * Math.PI * 2;
      const rr = 4.2 + rng() * 5.2;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      if (Math.hypot(x - POND.x, z - POND.z) < POND.radius + 0.35) continue;
      const fern = new THREE.Group();
      const scale = 0.48 + rng() * 0.72;
      fern.position.set(x, terrainHeight(x, z) + 0.025, z);
      fern.rotation.y = rng() * Math.PI * 2;
      const leafCount = 6 + Math.floor(rng() * 5);
      const leafMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.25 + rng() * 0.035, 0.42, 0.22 + rng() * 0.09),
        roughness: 0.86,
        side: THREE.DoubleSide,
      });
      for (let l = 0; l < leafCount; l += 1) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        const angle = (l / leafCount) * Math.PI * 2 + rng() * 0.25;
        leaf.rotation.y = angle;
        leaf.rotation.z = 0.48 + rng() * 0.42;
        leaf.position.y = 0.03;
        leaf.scale.setScalar(scale * (0.75 + rng() * 0.35));
        leaf.castShadow = true;
        fern.add(leaf);
      }
      group.add(fern);
    }
  }

  buildTrees(group, rng) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3c3b2d, roughness: 0.97, flatShading: true });
    const canopyMats = [
      new THREE.MeshStandardMaterial({ color: 0x264735, roughness: 0.85, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x31543a, roughness: 0.88, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x1e3c30, roughness: 0.9, flatShading: true }),
    ];
    const positions = [
      [-7.6, -6.6, 3.5],
      [-2.6, -8.6, 2.8],
      [5.6, -7.7, 3.9],
      [8.1, -3.2, 2.7],
      [-8.9, 1.2, 2.5],
    ];

    positions.forEach(([x, z, height], index) => {
      const tree = new THREE.Group();
      tree.position.set(x, terrainHeight(x, z), z);
      tree.rotation.y = rng() * Math.PI * 2;
      const trunkHeight = height * 0.66;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, trunkHeight, 7), trunkMat);
      trunk.position.y = trunkHeight / 2;
      trunk.rotation.z = (rng() - 0.5) * 0.28;
      trunk.castShadow = true;
      tree.add(trunk);

      for (let b = 0; b < 2; b += 1) {
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.08, trunkHeight * 0.45, 5), trunkMat);
        branch.position.set((rng() - 0.5) * 0.55, trunkHeight * (0.56 + b * 0.1), (rng() - 0.5) * 0.4);
        branch.rotation.z = (rng() - 0.5) * 1.4;
        branch.rotation.x = (rng() - 0.5) * 0.9;
        tree.add(branch);
      }

      const canopyCount = 3 + (index % 2);
      for (let c = 0; c < canopyCount; c += 1) {
        const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), canopyMats[(c + index) % 3]);
        const spread = 0.65 + rng() * 0.55;
        canopy.scale.set(spread * (0.8 + rng() * 0.5), spread * 0.4, spread * (0.7 + rng() * 0.5));
        canopy.position.set(
          (rng() - 0.5) * 1.65,
          trunkHeight + (rng() - 0.15) * 0.85,
          (rng() - 0.5) * 1.4,
        );
        canopy.rotation.set(rng() * 0.5, rng() * 6, rng() * 0.4);
        canopy.castShadow = true;
        canopy.receiveShadow = true;
        tree.add(canopy);
      }
      group.add(tree);
    });
  }

  buildMushrooms(group, rng) {
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xa5bca1, roughness: 0.8 });
    const capMats = [
      new THREE.MeshStandardMaterial({
        color: 0xb2ffcc,
        emissive: 0x63ffc0,
        emissiveIntensity: 0.4,
        roughness: 0.4,
      }),
      new THREE.MeshStandardMaterial({
        color: 0x7ce8ff,
        emissive: 0x38cfff,
        emissiveIntensity: 0.5,
        roughness: 0.35,
      }),
    ];
    const sites = [
      [-5.2, -3.5],
      [4.7, -4.9],
      [-1.6, -4.4],
      [2.7, -4.8],
      [6.4, -2.6],
    ];
    sites.forEach(([sx, sz], s) => {
      const cluster = new THREE.Group();
      cluster.position.set(sx, terrainHeight(sx, sz), sz);
      for (let i = 0; i < 3 + (s % 3); i += 1) {
        const h = 0.25 + rng() * 0.4;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.026, h, 5), stemMat);
        stem.position.set((rng() - 0.5) * 0.7, h / 2, (rng() - 0.5) * 0.6);
        stem.rotation.z = (rng() - 0.5) * 0.3;
        cluster.add(stem);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075 + rng() * 0.08, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), capMats[(i + s) % 2]);
        cap.scale.y = 0.48;
        cap.position.set(stem.position.x, h + 0.01, stem.position.z);
        cluster.add(cap);
      }
      group.add(cluster);
    });
  }

  buildFruit(group, rng) {
    const fruitMat = new THREE.MeshStandardMaterial({
      color: 0xffc65d,
      emissive: 0xff9f3f,
      emissiveIntensity: 0.35,
      roughness: 0.38,
    });
    const sites = [
      [-3.6, 2.1],
      [4.1, -1.2],
      [-1.0, 3.4],
      [5.1, -3.8],
      [-5.8, 1.7],
      [2.0, -3.0],
      [-1.9, -5.2],
      [6.1, 3.6],
    ];
    sites.forEach(([x, z]) => {
      const bush = new THREE.Group();
      bush.position.set(x, terrainHeight(x, z), z);
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.022, 0.42, 4),
        new THREE.MeshStandardMaterial({ color: 0x556840, roughness: 1 }),
      );
      stem.position.y = 0.21;
      bush.add(stem);
      const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 1), fruitMat);
      fruit.position.y = 0.44;
      bush.add(fruit);
      bush.userData.food = true;
      group.add(bush);
      this.fruits.push(bush);
    });
  }

  buildDetails() {
    const group = new THREE.Group();
    this.root.add(group);
    this.detailGroup = group;

    // Predator eyes appear in the undergrowth as pressure rises.
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff7d56 });
    const glowTexture = makeRadialTexture("rgba(255, 110, 75, 0.85)", "rgba(255, 80, 50, 0)", 64);
    const eyeSites = [
      [-7.2, -2.7, 1.15],
      [7.6, 3.4, 0.95],
      [-4.8, 6.4, 0.75],
      [3.5, -7.4, 0.7],
    ];
    for (const [x, z, y] of eyeSites) {
      const pair = new THREE.Group();
      pair.position.set(x, terrainHeight(x, z) + y, z);
      for (const offset of [-0.1, 0.1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
        eye.position.x = offset;
        pair.add(eye);
        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTexture,
            color: 0xff8050,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        glow.scale.setScalar(0.5);
        glow.position.copy(eye.position);
        pair.add(glow);
      }
      pair.scale.setScalar(0);
      group.add(pair);
      this.predatorEyes.push(pair);
    }
    this.detailGroup = group;
  }

  buildAtmosphere() {
    const group = new THREE.Group();
    this.root.add(group);
    this.atmosphereGroup = group;
    const rng = mulberry32(188);

    const dotTexture = makeRadialTexture("rgba(195,255,221,1)", "rgba(150,255,210,0)", 64);

    const sporeCount = 240;
    const positions = new Float32Array(sporeCount * 3);
    for (let i = 0; i < sporeCount; i += 1) {
      const a = rng() * Math.PI * 2;
      const rr = Math.sqrt(rng()) * 11;
      positions[i * 3] = Math.cos(a) * rr;
      positions[i * 3 + 1] = 0.15 + Math.pow(rng(), 1.8) * 5.5;
      positions[i * 3 + 2] = Math.sin(a) * rr;
    }
    const sporeGeo = new THREE.BufferGeometry();
    sporeGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const spores = new THREE.Points(
      sporeGeo,
      new THREE.PointsMaterial({
        map: dotTexture,
        size: 0.055,
        transparent: true,
        opacity: 0.6,
        color: 0xbfffdc,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    group.add(spores);
    this.sporeCloud = spores;

    for (let i = 0; i < 18; i += 1) {
      const a = rng() * Math.PI * 2;
      const rr = 2.5 + rng() * 6.5;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: dotTexture,
          color: i % 4 === 0 ? 0x6fffd0 : 0xc9ff92,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      sprite.scale.setScalar(0.12 + rng() * 0.17);
      sprite.userData = {
        angle: a,
        radius: rr,
        baseY: 0.4 + rng() * 2.8,
        speed: 0.06 + rng() * 0.15,
        phase: rng() * 6,
        wobble: rng() * 0.8,
      };
      group.add(sprite);
      this.fireflies.push(sprite);
    }
  }

  setupSelectionRing() {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: 0xcaff72,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.68, 0.72, 64), mat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    const outer = new THREE.Mesh(new THREE.RingGeometry(0.83, 0.85, 64), mat.clone());
    outer.material.opacity = 0.22;
    outer.rotation.x = -Math.PI / 2;
    group.add(outer);
    for (let i = 0; i < 4; i += 1) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.02), mat.clone());
      tick.material.opacity = 0.6;
      const a = (i / 4) * Math.PI * 2;
      tick.position.set(Math.cos(a) * 0.79, 0, Math.sin(a) * 0.79);
      tick.rotation.x = -Math.PI / 2;
      tick.rotation.z = -a;
      group.add(tick);
    }
    group.position.y = 0.06;
    group.visible = false;
    this.scene.add(group);
    this.selectionRing = group;
    this.selectionRingMat = mat;
  }

  setupPostprocessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.34,
      0.42,
      0.95,
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.85));
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  setSelection(position, radius = 0.8) {
    if (!this.selectionRing) return;
    this.selectionRing.visible = Boolean(position);
    if (!position) return;
    this.selectionRing.position.set(position.x, terrainHeight(position.x, position.z) + 0.11, position.z);
    this._selectionBaseScale = radius * 2.15;
    this.selectionRing.scale.setScalar(this._selectionBaseScale);
    this.selectionFocus.set(position.x, position.y + 0.9, position.z);
  }

  focusOn(position) {
    this.focusTarget.set(position.x, position.y + 0.75, position.z);
  }

  burst(position, color = 0xcaff72, scale = 1) {
    const group = new THREE.Group();
    group.position.set(position.x, terrainHeight(position.x, position.z) + 0.3, position.z);
    const particles = [];
    for (let i = 0; i < 18; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.016 + Math.random() * 0.024, 5, 4), mat);
      mesh.position.set((Math.random() - 0.5) * 0.3, Math.random() * 0.1, (Math.random() - 0.5) * 0.3);
      group.add(mesh);
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.65 + Math.random() * 1.3;
      particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        vy: 0.8 + Math.random() * 1.6,
        life: 0.9 + Math.random() * 0.55,
      });
    }
    group.scale.setScalar(scale);
    this.scene.add(group);
    this.bursts.push({ group, particles, age: 0, duration: 1.35 });
  }

  updateBursts(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i -= 1) {
      const burst = this.bursts[i];
      burst.age += dt;
      for (const particle of burst.particles) {
        particle.vy -= dt * 1.7;
        particle.mesh.position.x += particle.vx * dt;
        particle.mesh.position.y += particle.vy * dt;
        particle.mesh.position.z += particle.vz * dt;
        particle.mesh.material.opacity = Math.max(0, 0.9 * (1 - burst.age / burst.duration));
      }
      if (burst.age >= burst.duration) {
        burst.group.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        this.scene.remove(burst.group);
        this.bursts.splice(i, 1);
      }
    }
  }

  applyEnvironment(env, instant = false) {
    this.environment = env;
    const climate = env.climate;
    const targetKey = climate === 0 ? 0xd8efff : climate === 2 ? 0xffd3a0 : 0xffe7c2;
    const targetHemi = climate === 0 ? 0xa8ddff : climate === 2 ? 0xffd6a1 : 0x9be2c9;
    const targetFill = climate === 0 ? 0x7bc4ff : climate === 2 ? 0xffa25e : 0x62d8ff;
    const targetFog = climate === 0 ? 0x09181b : climate === 2 ? 0x1a130d : 0x071612;

    if (instant) {
      this.keyLight.color.setHex(targetKey);
      this.hemi.color.setHex(targetHemi);
      this.fillLight.color.setHex(targetFill);
      this.scene.fog.color.setHex(targetFog);
      this.scene.fog.density = climate === 0 ? 0.019 : climate === 2 ? 0.021 : 0.016;
      this.keyLight.intensity = climate === 0 ? 1.9 : climate === 2 ? 2.55 : 2.35;
      this.water.material.color.setHex(climate === 0 ? 0x0a3a4e : climate === 2 ? 0x194c45 : 0x0a4650);
    } else {
      this.environmentLerp = {
        key: new THREE.Color(targetKey),
        hemi: new THREE.Color(targetHemi),
        fill: new THREE.Color(targetFill),
        fog: new THREE.Color(targetFog),
      };
    }

    for (const fruit of this.fruits) {
      fruit.visible = env.food > 0;
      fruit.scale.setScalar(env.food === 2 ? 1.35 : env.food === 1 ? 1 : 0.72);
    }

    const eyeStrength = [0.0, 0.65, 1][env.predators];
    for (let i = 0; i < this.predatorEyes.length; i += 1) {
      const pair = this.predatorEyes[i];
      pair.visible = eyeStrength > 0;
      pair.userData.targetScale = eyeStrength * (i % 2 === 0 ? 1 : 0.82);
    }
  }

  setOrbit(enabled) {
    this.controls.autoRotate = enabled;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.7 ? 55 : aspect < 1 ? 48 : 42;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.setResponsiveFrame(aspect);
  }

  setResponsiveFrame(aspect) {
    const category = aspect < 0.72 ? 0 : aspect < 1 ? 1 : 2;
    if (this._framedCategory === category) return;
    this._framedCategory = category;
    if (aspect < 0.72) {
      this.camera.position.set(8.7, 6.5, 13.9);
      this.controls.target.set(0, 1.0, 0.2);
    } else if (aspect < 1) {
      this.camera.position.set(9.1, 6.9, 14.6);
      this.controls.target.set(0, 1.0, 0.2);
    }
    this.controls.update();
  }

  bindResize() {
    this.onResize = () => this.resize();
    window.addEventListener("resize", this.onResize);
  }

  updateEnvironmentLerp(dt) {
    if (!this.environmentLerp) return;
    const k = 1 - Math.exp(-dt * 1.5);
    this.keyLight.color.lerp(this.environmentLerp.key, k);
    this.hemi.color.lerp(this.environmentLerp.hemi, k);
    this.fillLight.color.lerp(this.environmentLerp.fill, k);
    this.scene.fog.color.lerp(this.environmentLerp.fog, k);
    const climate = this.environment.climate;
    this.keyLight.intensity += ((climate === 0 ? 1.9 : climate === 2 ? 2.55 : 2.35) - this.keyLight.intensity) * k;
    const targetDensity = climate === 0 ? 0.019 : climate === 2 ? 0.021 : 0.016;
    this.scene.fog.density += (targetDensity - this.scene.fog.density) * k;
    if (Math.abs(this.keyLight.color.r - this.environmentLerp.key.r) < 0.002) this.environmentLerp = null;
  }

  animate() {
    this.renderer.setAnimationLoop(() => this.tick());
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    this.updateEnvironmentLerp(dt);
    this.updateBursts(dt);
    this.controls.update();

    // Camera target eases toward the selected creature without breaking orbit.
    const focusK = 1 - Math.exp(-dt * 1.8);
    this.controls.target.x += (this.selectionFocus.x - this.controls.target.x) * focusK;
    this.controls.target.y += (this.selectionFocus.y - this.controls.target.y) * focusK;
    this.controls.target.z += (this.selectionFocus.z - this.controls.target.z) * focusK;

    if (this.selectionRing?.visible) {
      this.selectionRing.rotation.y += dt * 0.32;
      const pulse = 1 + Math.sin(this.time * 2.1) * 0.032;
      this.selectionRing.scale.setScalar((this._selectionBaseScale || 1.5) * pulse);
      this.selectionRingMat.opacity = 0.62 + Math.sin(this.time * 2.1) * 0.14;
    }

    for (let i = 0; i < this.ripples.length; i += 1) {
      const ripple = this.ripples[i];
      const t = (this.time * 0.14 + ripple.offset) % 2.6;
      const scale = 0.45 + t * 1.25;
      ripple.mesh.scale.set(1.2 * scale, 0.82 * scale, 1);
      ripple.mesh.material.opacity = Math.max(0, 0.24 * (1 - t / 2.6));
    }
    if (this.water) {
      this.water.position.y = 0.075 + Math.sin(this.time * 0.8) * 0.003;
    }

    if (this.sporeCloud) {
      this.sporeCloud.rotation.y = this.time * 0.004;
      this.sporeCloud.position.y = Math.sin(this.time * 0.12) * 0.08;
    }

    for (const sprite of this.fireflies) {
      const data = sprite.userData;
      const a = data.angle + this.time * data.speed;
      sprite.position.set(
        Math.cos(a) * data.radius + Math.sin(this.time * 0.7 + data.phase) * data.wobble,
        data.baseY + Math.sin(this.time * 0.55 + data.phase) * 0.22,
        Math.sin(a) * data.radius + Math.cos(this.time * 0.61 + data.phase) * data.wobble,
      );
      sprite.material.opacity = 0.35 + (Math.sin(this.time * 2.2 + data.phase) + 1) * 0.18;
    }

    for (const pair of this.predatorEyes) {
      if (!pair.visible) continue;
      const target = pair.userData.targetScale || 0;
      pair.scale.x += (target - pair.scale.x) * (1 - Math.exp(-dt * 2));
      pair.scale.y = pair.scale.x;
      pair.scale.z = pair.scale.x;
      const flicker = 0.65 + Math.sin(this.time * 4.7 + pair.position.x) * 0.2;
      pair.children.forEach((child, index) => {
        if (child.isSprite) child.material.opacity = flicker;
        if (index % 2 === 0) child.scale.setScalar(1);
      });
    }

    if (this.edgeRings) {
      this.edgeRings[0].material.opacity = 0.34 + Math.sin(this.time * 1.5) * 0.07;
      this.edgeRings[1].material.opacity = 0.3 + Math.sin(this.time * 1.3 + 2) * 0.06;
    }

    this.composer.render();
  }

  addLifeObject(object) {
    this.lifeGroup.add(object);
  }

  removeLifeObject(object) {
    this.lifeGroup.remove(object);
  }

  raycaster() {
    return new THREE.Raycaster();
  }
}
