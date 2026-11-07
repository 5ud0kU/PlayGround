import * as THREE from "three";
import { mulberry32, nameCreature, traitValueForDisplay } from "./genetics.js";
import { terrainHeight, POND } from "./world.js";

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const TAU = Math.PI * 2;

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function hsl(h, s, l) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function makeSkinTexture(genome, seed) {
  const size = 384;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const rng = mulberry32(seed * 997 + 17);
  const hue = 48 + genome.hue * 102;
  const saturation = 25 + genome.pattern * 20;
  const lightness = 31 + genome.hue * 9;
  ctx.fillStyle = hsl(hue, saturation, lightness);
  ctx.fillRect(0, 0, size, size);

  // Soft dorsal gradient.
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, hsl(hue - 5, saturation + 7, lightness - 10));
  grad.addColorStop(0.55, hsl(hue, saturation, lightness + 1));
  grad.addColorStop(1, hsl(hue + 8, saturation - 8, lightness + 16));
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;

  const spots = Math.floor(28 + genome.pattern * 115);
  for (let i = 0; i < spots; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 2 + rng() * (5 + genome.pattern * 12);
    const ry = rx * (0.45 + rng() * 0.7);
    ctx.fillStyle = rng() > 0.42
      ? `hsla(${hue - 8 - rng() * 18}, ${saturation + 10}%, ${lightness - 13 - rng() * 12}%, ${0.25 + rng() * 0.38})`
      : `hsla(${hue + 9}, ${saturation + 2}%, ${lightness + 12}%, ${0.14 + rng() * 0.22})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  if (genome.pattern > 0.34) {
    const stripes = 4 + Math.floor(genome.pattern * 7);
    ctx.globalAlpha = 0.13 + genome.pattern * 0.2;
    ctx.strokeStyle = hsl(hue - 12, saturation + 14, lightness - 20);
    ctx.lineWidth = 3 + genome.pattern * 7;
    for (let i = 0; i < stripes; i += 1) {
      const x = (i / stripes) * size + rng() * 10;
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.bezierCurveTo(x + 15, size * 0.3, x - 18, size * 0.7, x + 8, size + 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Fine dermal speckle.
  for (let i = 0; i < 1200; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.fillStyle = `rgba(20, 34, 26, ${0.025 + rng() * 0.09})`;
    ctx.fillRect(x, y, 0.8 + rng() * 1.6, 0.8 + rng() * 1.6);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, hue, saturation, lightness };
}

function makeCrestGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.28, 0.02, 0.36, 0.3, 0.18, 0.48);
  shape.bezierCurveTo(0.09, 0.57, 0.01, 0.46, -0.04, 0.31);
  shape.bezierCurveTo(-0.05, 0.18, -0.06, 0.06, 0, 0);
  return new THREE.ShapeGeometry(shape, 10);
}

export class Creature {
  constructor({ genome, evaluation, world, rng, index, position }) {
    this.genome = genome;
    this.evaluation = evaluation;
    this.world = world;
    this.rng = rng;
    this.index = index;
    this.nameData = nameCreature(genome);
    this.spawnTime = world.time;
    this.group = new THREE.Group();
    this.group.userData.creature = this;
    this.group.userData.creatureId = index;
    this.model = new THREE.Group();
    this.group.add(this.model);
    this.world.addLifeObject(this.group);

    this.position = new THREE.Vector3(position.x, terrainHeight(position.x, position.z), position.z);
    this.home = this.position.clone();
    this.group.position.copy(this.position);
    this.heading = rng() * TAU;
    this.group.rotation.y = this.heading;
    this.target = this.position.clone();
    this.walkPhase = rng() * TAU;
    this.blinkPhase = rng() * 8;
    this.moving = false;
    this.selected = false;
    this.dimensions = {};
    this.movementSpeed = 0.8;
    this.legs = [];
    this.tailJoints = [];
    this.eyes = [];
    this.crestMeshes = [];
    this.tempTarget = new THREE.Vector3();

    this.build();
    this.chooseTarget(true);
    if (index === 0) {
      this.heading = Math.atan2(
        world.camera.position.x - this.position.x,
        world.camera.position.z - this.position.z,
      );
      this.group.rotation.y = this.heading;
      this.target.set(
        this.position.x + Math.sin(this.heading) * 1.2,
        this.position.y,
        this.position.z + Math.cos(this.heading) * 1.2,
      );
    }
  }

  get radius() {
    return (0.58 + this.genome.bodySize * 0.42) * (0.82 + this.genome.bodySize * 0.5);
  }

  build() {
    const g = this.genome;
    const rng = this.rng;
    const sizeScale = 0.82 + g.bodySize * 0.55;
    this.sizeScale = sizeScale;
    this.model.scale.setScalar(0.01);
    this.spawnTime = this.world.time;

    const skin = makeSkinTexture(g, this.index + 3);
    this.skinTexture = skin.texture;
    const hue = skin.hue;
    const baseColor = new THREE.Color().setHSL(hue / 360, skin.saturation / 100, skin.lightness / 100, THREE.SRGBColorSpace);
    const accentColor = new THREE.Color().setHSL(((hue + 48) % 360) / 360, 0.46, 0.36, THREE.SRGBColorSpace);
    const bellyColor = new THREE.Color().setHSL(((hue + 14) % 360) / 360, 0.22, 0.57, THREE.SRGBColorSpace);
    const limbColor = new THREE.Color().setHSL(((hue - 2) % 360) / 360, 0.3, 0.28, THREE.SRGBColorSpace);
    this.themeColor = baseColor;
    this.accentColor = accentColor;

    this.bodyMat = new THREE.MeshStandardMaterial({
      map: skin.texture,
      bumpMap: skin.texture,
      bumpScale: 0.012,
      roughness: 0.76,
      metalness: 0.015,
      color: 0xffffff,
    });
    this.limbMat = new THREE.MeshStandardMaterial({
      color: limbColor,
      roughness: 0.83,
      metalness: 0.01,
    });
    this.bellyMat = new THREE.MeshStandardMaterial({ color: bellyColor, roughness: 0.86 });
    this.boneMat = new THREE.MeshStandardMaterial({ color: 0xaaa48d, roughness: 0.7, metalness: 0.03 });
    this.darkBoneMat = new THREE.MeshStandardMaterial({ color: 0x6e6858, roughness: 0.84 });
    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0x090d0a, roughness: 0.17, metalness: 0.12 });
    this.glintMat = new THREE.MeshBasicMaterial({ color: 0xd9ffed });
    this.crestMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.08,
      roughness: 0.78,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
    });
    this.accentMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.16,
      roughness: 0.6,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    this.spotMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.3,
      roughness: 0.45,
      transparent: true,
      opacity: 0.6,
    });

    // Proportions: raw genes become an actual biological body plan.
    const bodyLen = 0.9;
    const bodyW = 0.29 + g.fat * 0.1;
    const bodyH = 0.32 + g.fat * 0.11;
    const legLen = 0.53 + g.legs * 0.8;
    const neckLen = 0.15 + g.neck * 0.9;
    const tailLen = 0.24 + g.tail * 1.02;
    const bodyY = legLen + bodyH * 0.26 + 0.03;
    this.dimensions = { bodyLen, bodyW, bodyH, legLen, neckLen, tailLen, bodyY };
    this.bodyY = bodyY;

    const sphereGeo = new THREE.SphereGeometry(1, 24, 18);
    this.torsoGeo = sphereGeo;

    const torso = new THREE.Mesh(sphereGeo, this.bodyMat);
    torso.scale.set(bodyW, bodyH, bodyLen);
    torso.position.y = bodyY;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.model.add(torso);
    this.torso = torso;

    const chest = new THREE.Mesh(sphereGeo, this.bodyMat);
    chest.scale.set(bodyW * 0.93, bodyH * 0.9, bodyLen * 0.56);
    chest.position.set(0, bodyY + 0.015, bodyLen * 0.58);
    chest.castShadow = true;
    this.model.add(chest);

    const hip = new THREE.Mesh(sphereGeo, this.bodyMat);
    hip.scale.set(bodyW * 0.86, bodyH * 0.84, bodyLen * 0.5);
    hip.position.set(0, bodyY + 0.005, -bodyLen * 0.58);
    hip.castShadow = true;
    this.model.add(hip);

    const belly = new THREE.Mesh(sphereGeo, this.bellyMat);
    belly.scale.set(bodyW * 0.8, bodyH * 0.42, bodyLen * 0.86);
    belly.position.set(0, bodyY - bodyH * 0.38, bodyLen * 0.06);
    this.model.add(belly);

    this.buildNeck({ bodyLen, bodyW, bodyH, bodyY, neckLen, accentColor });
    this.buildTail({ bodyLen, bodyH, bodyY, tailLen });
    this.buildLegs({ bodyLen, bodyW, bodyH, bodyY, legLen });
    this.buildArmor({ bodyLen, bodyW, bodyH, bodyY, legLen });
    this.buildAccents({ bodyLen, bodyW, bodyH, bodyY });
  }

  buildNeck({ bodyLen, bodyW, bodyH, bodyY, neckLen, accentColor }) {
    const g = this.genome;
    const neckGroup = new THREE.Group();
    neckGroup.position.set(0, bodyY + bodyH * 0.3, bodyLen * 0.69);
    neckGroup.rotation.x = 0.62 + g.neck * 0.2;
    this.model.add(neckGroup);
    this.neckGroup = neckGroup;

    const segCount = 4;
    for (let i = 0; i < segCount; i += 1) {
      const t = (i + 0.5) / segCount;
      const taper = 1 - t * 0.22;
      const segment = new THREE.Mesh(this.torsoGeo, this.bodyMat);
      const segLen = neckLen / segCount;
      segment.scale.set(
        (0.14 + g.neck * 0.022) * taper,
        segLen * 0.68,
        (0.135 + g.neck * 0.02) * taper,
      );
      segment.position.set(0, t * neckLen, Math.sin(t * Math.PI) * 0.035);
      segment.castShadow = true;
      neckGroup.add(segment);
    }

    const headGroup = new THREE.Group();
    headGroup.position.set(0, neckLen + 0.045, 0.085);
    headGroup.rotation.x = -0.54;
    neckGroup.add(headGroup);
    this.headGroup = headGroup;

    const headR = 0.205 + g.crest * 0.026;
    const cranium = new THREE.Mesh(this.torsoGeo, this.bodyMat);
    cranium.scale.set(headR * 1.02, headR * 0.9, headR * 1.28);
    cranium.castShadow = true;
    headGroup.add(cranium);

    const snout = new THREE.Mesh(this.torsoGeo, this.bodyMat);
    snout.scale.set(headR * 0.72, headR * 0.5, headR * 1.05);
    snout.position.set(0, -headR * 0.17, headR * 1.48);
    snout.castShadow = true;
    headGroup.add(snout);

    const jaw = new THREE.Mesh(this.torsoGeo, this.bellyMat);
    jaw.scale.set(headR * 0.62, headR * 0.24, headR * 0.88);
    jaw.position.set(0, -headR * 0.55, headR * 1.36);
    headGroup.add(jaw);

    const browRidge = new THREE.Mesh(this.torsoGeo, this.limbMat);
    browRidge.scale.set(headR * 0.84, headR * 0.18, headR * 0.52);
    browRidge.position.set(0, headR * 0.5, headR * 0.36);
    headGroup.add(browRidge);

    for (const side of [-1, 1]) {
      const eyeSocket = new THREE.Mesh(this.torsoGeo, this.bellyMat);
      eyeSocket.scale.set(headR * 0.35, headR * 0.3, headR * 0.32);
      eyeSocket.position.set(side * headR * 0.78, headR * 0.25, headR * 0.62);
      headGroup.add(eyeSocket);

      const eye = new THREE.Mesh(this.torsoGeo, this.eyeMat);
      eye.scale.setScalar(headR * 0.22);
      eye.position.set(side * headR * 0.89, headR * 0.28, headR * 0.72);
      eye.userData.baseScaleY = headR * 0.22;
      headGroup.add(eye);
      this.eyes.push(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), this.glintMat);
      glint.scale.setScalar(headR * 0.055);
      glint.position.set(side * headR * 0.94, headR * 0.34, headR * 0.86);
      headGroup.add(glint);

      if (g.armor > 0.42) {
        const brow = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.14, headR * (0.26 + g.armor * 0.4), 4), this.boneMat);
        brow.position.set(side * headR * 0.74, headR * 0.58, headR * 0.46);
        brow.rotation.set(-0.4, 0, side * -0.4);
        brow.castShadow = true;
        headGroup.add(brow);
      }
    }

    const nostrilGeo = new THREE.SphereGeometry(headR * 0.05, 6, 4);
    for (const side of [-1, 1]) {
      const nostril = new THREE.Mesh(nostrilGeo, this.eyeMat);
      nostril.position.set(side * headR * 0.18, -headR * 0.02, headR * 1.86);
      headGroup.add(nostril);
    }

    if (g.crest > 0.18) {
      const crest = new THREE.Mesh(makeCrestGeometry(), this.crestMat);
      crest.scale.set(0.46 + g.crest * 0.55, 0.32 + g.crest * 0.5, 1);
      crest.position.set(0, headR * 0.28, -headR * 0.12);
      crest.rotation.set(0.18, Math.PI / 2, 0.02);
      crest.castShadow = true;
      headGroup.add(crest);
      this.crestMeshes.push(crest);

      const crestBrother = crest.clone();
      crestBrother.position.x = 0.008;
      headGroup.add(crestBrother);
    }

    // Neck frill when display alleles are strong.
    if (g.crest > 0.64) {
      for (const side of [-1, 1]) {
        const frill = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.16, 4), this.accentMat);
        frill.position.set(side * 0.095, neckLen * 0.72, 0);
        frill.rotation.z = side * 1.15;
        neckGroup.add(frill);
      }
    }
  }

  buildTail({ bodyLen, bodyH, bodyY, tailLen }) {
    const g = this.genome;
    const base = new THREE.Group();
    base.position.set(0, bodyY + 0.01, -bodyLen * 0.77);
    base.rotation.x = -0.13;
    this.model.add(base);
    this.tailJoints.push(base);

    let parent = base;
    const segments = 5;
    const segLen = tailLen / segments;
    for (let i = 0; i < segments; i += 1) {
      const joint = new THREE.Group();
      joint.position.z = i === 0 ? 0 : -segLen;
      joint.rotation.x = i === 0 ? 0 : 0.035;
      parent.add(joint);
      const taper = 1 - (i / segments) * 0.82;
      const segment = new THREE.Mesh(this.torsoGeo, this.bodyMat);
      segment.scale.set(0.115 * taper, 0.105 * taper, segLen * 0.72);
      segment.position.z = -segLen * 0.5;
      segment.castShadow = true;
      joint.add(segment);
      this.tailJoints.push(joint);
      parent = joint;
    }

    if (g.armor > 0.58) {
      const club = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 + g.armor * 0.1, 0), this.boneMat);
      club.position.z = -segLen * 0.92;
      club.scale.set(1.2, 0.85, 1.35);
      club.rotation.set(0.2, 0.4, 0.1);
      club.castShadow = true;
      parent.add(club);
    }
  }

  buildLegs({ bodyLen, bodyW, bodyH, bodyY, legLen }) {
    const g = this.genome;
    const upperLen = legLen * 0.55;
    const lowerLen = legLen * 0.48;
    const legRadius = 0.058 + g.bodySize * 0.032;
    const positions = [
      { x: -bodyW * 0.82, z: bodyLen * 0.47, front: true, phase: 0 },
      { x: bodyW * 0.82, z: bodyLen * 0.47, front: true, phase: Math.PI },
      { x: -bodyW * 0.75, z: -bodyLen * 0.5, front: false, phase: Math.PI },
      { x: bodyW * 0.75, z: -bodyLen * 0.5, front: false, phase: 0 },
    ];

    positions.forEach((entry, i) => {
      const root = new THREE.Group();
      root.position.set(entry.x, bodyY - bodyH * 0.26, entry.z);
      this.model.add(root);

      const shoulder = new THREE.Mesh(this.torsoGeo, this.limbMat);
      shoulder.scale.set(legRadius * 1.22, legRadius * 1.25, legRadius * 1.3);
      root.add(shoulder);

      const thigh = new THREE.Mesh(this.torsoGeo, this.limbMat);
      thigh.scale.set(legRadius * 1.35, upperLen * 0.32, legRadius * 1.35);
      thigh.position.y = -upperLen * 0.36;
      thigh.castShadow = true;
      root.add(thigh);

      const upper = new THREE.Mesh(
        new THREE.CylinderGeometry(legRadius * 0.82, legRadius * 0.68, upperLen, 8),
        this.limbMat,
      );
      upper.position.y = -upperLen / 2;
      upper.castShadow = true;
      root.add(upper);

      const knee = new THREE.Group();
      knee.position.y = -upperLen;
      root.add(knee);

      const kneeJoint = new THREE.Mesh(this.torsoGeo, this.limbMat);
      kneeJoint.scale.setScalar(legRadius * 0.8);
      knee.add(kneeJoint);

      const lower = new THREE.Mesh(
        new THREE.CylinderGeometry(legRadius * 0.68, legRadius * 0.5, lowerLen, 7),
        this.limbMat,
      );
      lower.position.y = -lowerLen / 2;
      lower.castShadow = true;
      knee.add(lower);

      const foot = new THREE.Mesh(this.torsoGeo, this.limbMat);
      foot.scale.set(legRadius * 1.65, legRadius * 0.58, legRadius * 2.25);
      foot.position.set(0, -lowerLen - legRadius * 0.17, legRadius * 0.7);
      foot.castShadow = true;
      knee.add(foot);

      for (let toe = -1; toe <= 1; toe += 1) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(legRadius * 0.17, legRadius * 0.75, 4), this.darkBoneMat);
        claw.position.set(toe * legRadius * 0.62, -lowerLen + legRadius * 0.02, legRadius * 1.9);
        claw.rotation.x = Math.PI / 2.4;
        knee.add(claw);
      }

      this.legs.push({
        root,
        knee,
        phase: entry.phase,
        front: entry.front,
        upperLen,
        lowerLen,
        baseRot: entry.front ? 0.05 : -0.04,
      });
    });
  }

  buildArmor({ bodyLen, bodyW, bodyH, bodyY, legLen }) {
    const g = this.genome;
    if (g.armor < 0.22) return;
    const count = 3 + Math.round(g.armor * 5);
    for (let i = 0; i < count; i += 1) {
      const t = (i / (count - 1 || 1)) * 1.5 - 0.75;
      const z = t * bodyLen * 0.76;
      const profile = Math.sqrt(Math.max(0.06, 1 - Math.pow(t * 0.72, 2)));
      const height = (0.11 + g.armor * 0.26) * (0.7 + profile * 0.55);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045 + g.armor * 0.026, height, 4), this.boneMat);
      spike.position.set(0, bodyY + bodyH * profile * 0.93, z);
      spike.rotation.x = -0.34 - g.armor * 0.18;
      spike.rotation.y = Math.PI / 4;
      spike.castShadow = true;
      this.model.add(spike);
    }

    if (g.armor > 0.62) {
      for (const side of [-1, 1]) {
        const plate = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.18, 4), this.boneMat);
        plate.position.set(side * bodyW * 0.55, bodyY + bodyH * 0.5, bodyLen * 0.55);
        plate.rotation.z = side * 0.6;
        plate.rotation.x = -0.3;
        plate.castShadow = true;
        this.model.add(plate);
      }
    }
  }

  buildAccents({ bodyLen, bodyW, bodyH, bodyY }) {
    const g = this.genome;
    const spotCount = Math.round(1 + g.pattern * 5);
    for (let i = 0; i < spotCount; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const t = (i / Math.max(1, spotCount - 1)) * 1.4 - 0.7;
      const spot = new THREE.Mesh(new THREE.SphereGeometry(0.008 + g.pattern * 0.012, 6, 5), this.spotMat);
      spot.position.set(side * bodyW * 0.98, bodyY - bodyH * 0.05 + Math.sin(t * 3) * 0.03, t * bodyLen * 0.68);
      this.model.add(spot);
    }
  }

  chooseTarget(initial = false) {
    const angle = this.rng() * TAU;
    const dist = initial ? 0 : (this.index === 0 ? 0.8 : 1.1) + this.rng() * (this.index === 0 ? 1.7 : 2.2);
    let x = this.home.x + Math.cos(angle) * dist;
    let z = this.home.z + Math.sin(angle) * dist;

    if (Math.hypot(x - POND.x, z - POND.z) < POND.radius + 0.8) {
      x = this.home.x - Math.cos(angle) * dist;
      z = this.home.z - Math.sin(angle) * dist;
    }
    const r = Math.hypot(x, z);
    if (r > 7.1) {
      x *= 7.1 / r;
      z *= 7.1 / r;
    }
    this.target.set(x, 0, z);
  }

  update(dt) {
    const elapsed = this.world.time - this.spawnTime;
    const spawnT = clamp01(elapsed / 0.8);
    this.model.scale.setScalar(this.sizeScale * Math.max(0.01, easeOutBack(spawnT)));
    this.model.visible = spawnT > 0;
    if (spawnT < 1) {
      this.model.rotation.z = Math.sin(spawnT * Math.PI) * 0.04;
      return;
    }
    this.model.rotation.z *= 0.9;

    const speedGene = 0.6 + this.genome.speed * 1.45;
    this.tempTarget.set(this.target.x - this.position.x, 0, this.target.z - this.position.z);
    const distance = this.tempTarget.length();
    if (distance < 0.22 || this.rng() < dt * 0.008) {
      this.chooseTarget();
    }

    const moving = distance > 0.35;
    this.moving = moving;
    if (moving) {
      this.tempTarget.normalize();
      const desired = Math.atan2(this.tempTarget.x, this.tempTarget.z);
      let diff = desired - this.heading;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      this.heading += diff * Math.min(1, dt * 2.4);
      this.group.rotation.y = this.heading;

      const step = Math.min(distance, dt * (0.16 + speedGene * 0.22));
      const nx = this.position.x + Math.sin(this.heading) * step;
      const nz = this.position.z + Math.cos(this.heading) * step;
      if (Math.hypot(nx - POND.x, nz - POND.z) > POND.radius + 0.5 && Math.hypot(nx, nz) < 7.35) {
        this.position.x = nx;
        this.position.z = nz;
      } else {
        this.chooseTarget();
      }
      this.walkPhase += dt * (3.9 + speedGene * 2.8);
    } else {
      this.walkPhase += dt * 1.1;
    }

    this.position.y = terrainHeight(this.position.x, this.position.z);
    this.group.position.x = this.position.x;
    this.group.position.z = this.position.z;
    this.group.position.y = this.position.y;

    const stride = moving ? 1 : 0.25;
    for (const leg of this.legs) {
      const swing = Math.sin(this.walkPhase + leg.phase) * 0.54 * stride;
      const lift = Math.max(0, Math.sin(this.walkPhase + leg.phase + Math.PI / 2)) * 0.28 * stride;
      leg.root.rotation.x = leg.baseRot + swing;
      leg.knee.rotation.x = -lift + (leg.front ? 0.18 : 0.32);
    }

    const bob = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.026 : Math.sin(this.world.time * 1.4) * 0.006;
    this.model.position.y = bob;
    this.model.rotation.x = moving ? Math.sin(this.walkPhase) * 0.008 : 0;

    if (this.neckGroup) {
      this.neckGroup.rotation.z = Math.sin(this.walkPhase * 0.5 + 1.2) * 0.022;
      this.neckGroup.rotation.x = (0.62 + this.genome.neck * 0.2) + Math.sin(this.walkPhase * 0.5) * 0.027;
    }
    if (this.headGroup) {
      this.headGroup.rotation.y = Math.sin(this.world.time * 0.7 + this.index) * 0.11;
      this.headGroup.rotation.z = Math.sin(this.walkPhase * 0.5) * 0.02;
    }
    for (let i = 1; i < this.tailJoints.length; i += 1) {
      const joint = this.tailJoints[i];
      joint.rotation.y = Math.sin(this.world.time * 1.7 + i * 0.8 + this.index) * (0.06 + i * 0.012);
      joint.rotation.x = 0.035 + Math.sin(this.world.time * 1.1 + i) * 0.012;
    }
    for (const crest of this.crestMeshes) {
      crest.rotation.y = Math.PI / 2 + Math.sin(this.world.time * 2.1 + this.index) * 0.035;
    }

    const blink = (this.world.time + this.blinkPhase) % 4.6;
    const closed = blink > 4.42 ? 0.12 : 1;
    for (const eye of this.eyes) {
      eye.scale.y = eye.userData.baseScaleY * closed;
    }
  }

  setVisible(value) {
    this.group.visible = value;
  }

  dispose() {
    this.world.removeLifeObject(this.group);
    const disposed = new Set();
    this.group.traverse((obj) => {
      if (obj.geometry && !disposed.has(obj.geometry)) {
        disposed.add(obj.geometry);
        obj.geometry.dispose();
      }
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          if (mat.map && !disposed.has(mat.map)) {
            disposed.add(mat.map);
            mat.map.dispose();
          }
          if (!disposed.has(mat)) {
            disposed.add(mat);
            mat.dispose();
          }
        }
      }
    });
    this.skinTexture?.dispose();
  }
}

export class CreatureSystem {
  constructor(world) {
    this.world = world;
    this.creatures = [];
    this.selectedIndex = 0;
    this.rand = mulberry32(911);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
  }

  spawnPopulation(population, positions) {
    for (const creature of this.creatures) {
      creature.dispose();
    }
    this.creatures = [];
    population.forEach((organism, index) => {
      const creature = new Creature({
        genome: organism.genome,
        evaluation: organism.evaluation,
        world: this.world,
        rng: mulberry32(3001 + index * 137 + organism.id * 13),
        index,
        position: positions[index],
      });
      organism.creature = creature;
      this.creatures.push(creature);
    });
    this.selectedIndex = Math.min(this.selectedIndex, this.creatures.length - 1);
    this.select(this.selectedIndex, true);
  }

  select(index, updateFocus = true) {
    this.selectedIndex = Math.max(0, Math.min(this.creatures.length - 1, index));
    const creature = this.creatures[this.selectedIndex];
    if (!creature) return null;
    if (updateFocus) {
      this.world.setSelection(creature.position, creature.radius);
    }
    return creature;
  }

  replace(index, organism) {
    const old = this.creatures[index];
    if (!old) return null;
    const position = old.position.clone();
    const wasSelected = this.selectedIndex === index;
    old.dispose();
    const creature = new Creature({
      genome: organism.genome,
      evaluation: organism.evaluation,
      world: this.world,
      rng: mulberry32(7103 + index * 193 + organism.id * 7),
      index,
      position,
    });
    organism.creature = creature;
    this.creatures[index] = creature;
    if (wasSelected) this.select(index);
    return creature;
  }

  next() {
    return this.select((this.selectedIndex + 1) % this.creatures.length);
  }

  previous() {
    return this.select((this.selectedIndex - 1 + this.creatures.length) % this.creatures.length);
  }

  get selected() {
    return this.creatures[this.selectedIndex];
  }

  update(dt) {
    for (const creature of this.creatures) {
      creature.update(dt);
    }
    const selected = this.selected;
    if (selected) {
      this.world.setSelection(selected.position, selected.radius);
    }
  }

  hitTest(event) {
    const rect = this.world.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.world.camera);
    const hits = this.raycaster.intersectObjects(this.world.lifeGroup.children, true);
    if (!hits.length) return null;
    let node = hits[0].object;
    while (node) {
      if (node.userData?.creature) {
        const index = this.creatures.indexOf(node.userData.creature);
        if (index >= 0) return index;
      }
      node = node.parent;
    }
    return null;
  }

  pick(event) {
    const index = this.hitTest(event);
    if (index !== null) this.select(index);
    return index;
  }
}
