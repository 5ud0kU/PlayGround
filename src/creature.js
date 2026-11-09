import * as THREE from 'three'
import { phenotype } from './dna.js'

// ─── materials & procedural coat texture ───────────────────────────────────
const texCache = new Map()

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function coatTexture(p, key) {
  const cacheKey = `${p.bodyColor}|${p.darkColor}|${p.accentColor}|${p.pattern.toFixed(2)}|${p.hide.toFixed(2)}|${key}`
  if (texCache.has(cacheKey)) return texCache.get(cacheKey)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const r = rng(hashString(cacheKey))
  ctx.fillStyle = p.bodyColor
  ctx.fillRect(0, 0, size, size)

  // soft mottling
  for (let i = 0; i < 90; i++) {
    const x = r() * size, y = r() * size, rad = 6 + r() * 26
    ctx.globalAlpha = 0.05 + r() * 0.1
    ctx.fillStyle = r() > 0.5 ? p.darkColor : p.accentColor
    ctx.beginPath(); ctx.ellipse(x, y, rad, rad * (0.4 + r()), r() * Math.PI, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1

  const mode = Math.min(3, Math.floor(p.pattern * 4))
  ctx.fillStyle = p.darkColor
  if (mode === 0) {
    // High-contrast spots
    ctx.globalAlpha = 0.48
    for (let i = 0; i < 42; i++) {
      const x = r() * size, y = r() * size, rad = 3 + r() * 9
      ctx.beginPath(); ctx.ellipse(x, y, rad * (0.7 + r() * 0.7), rad, r() * Math.PI, 0, Math.PI * 2); ctx.fill()
    }
  } else if (mode === 1) {
    // Flowing bands
    ctx.globalAlpha = 0.42
    for (let i = 0; i < 7; i++) {
      const y = i * 39 + 6 + r() * 10
      ctx.beginPath(); ctx.moveTo(0, y)
      ctx.bezierCurveTo(70, y - 12, 170, y + 12, size, y - 4)
      ctx.lineTo(size, y + 12 + r() * 8)
      ctx.bezierCurveTo(170, y + 24, 70, y + 2, 0, y + 18)
      ctx.closePath(); ctx.fill()
    }
  } else if (mode === 2) {
    // Rosettes with a lighter center
    for (let i = 0; i < 24; i++) {
      const x = r() * size, y = r() * size, rad = 5 + r() * 11
      ctx.globalAlpha = 0.52
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 0.58
      ctx.fillStyle = p.accentColor
      ctx.beginPath(); ctx.arc(x, y, rad * 0.48, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = p.darkColor
    }
  } else {
    // Fine dapple
    ctx.globalAlpha = 0.34
    for (let i = 0; i < 96; i++) {
      const x = r() * size, y = r() * size, rad = 2 + r() * 7
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill()
    }
  }

  // Skin-specific surface detail makes hide alleles apparent on the model.
  ctx.globalAlpha = p.hide < 0.25 ? 0.28 : 0.38
  if (p.hide < 0.25) {
    // Velvet/fur: short directional fibers
    ctx.strokeStyle = p.accentColor; ctx.lineWidth = 1
    for (let i = 0; i < 700; i++) {
      const x = r() * size, y = r() * size, len = 2 + r() * 5
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len * 0.35, y + len); ctx.stroke()
    }
  } else if (p.hide < 0.5) {
    // Scaled hide: overlapping scale arcs
    ctx.strokeStyle = p.darkColor; ctx.lineWidth = 1.4
    for (let y = -8; y < size + 12; y += 12) for (let x = -8 + ((y / 12) % 2) * 7; x < size + 12; x += 14) {
      ctx.beginPath(); ctx.arc(x, y, 7, 0.15, Math.PI - 0.15); ctx.stroke()
    }
  } else if (p.hide < 0.75) {
    // Plated hide: angular overlapping scutes
    ctx.fillStyle = p.accentColor; ctx.strokeStyle = p.darkColor; ctx.lineWidth = 2
    for (let y = 0; y < size; y += 32) for (let x = (y % 64 ? 0 : 16); x < size; x += 32) {
      ctx.globalAlpha = 0.24 + r() * 0.16
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 13, y + 3); ctx.lineTo(x + 16, y + 17); ctx.lineTo(x + 8, y + 23); ctx.lineTo(x, y + 17); ctx.closePath(); ctx.fill(); ctx.stroke()
    }
  } else {
    // Crystal hide: bright crystalline facets
    ctx.fillStyle = p.accentColor
    for (let i = 0; i < 34; i++) {
      const x = r() * size, y = r() * size, rad = 4 + r() * 13
      ctx.globalAlpha = 0.22 + r() * 0.3
      ctx.beginPath(); ctx.moveTo(x, y - rad); ctx.lineTo(x + rad * 0.65, y + rad * 0.35); ctx.lineTo(x, y + rad); ctx.lineTo(x - rad * 0.65, y + rad * 0.35); ctx.closePath(); ctx.fill()
    }
  }
  ctx.globalAlpha = 0.18
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = r() > 0.5 ? '#ffffff' : '#000000'
    ctx.fillRect(r() * size, r() * size, 1, 1)
  }
  ctx.globalAlpha = 1
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
  texCache.set(cacheKey, tex)
  if (texCache.size > 100) {
    const first = texCache.keys().next().value
    texCache.get(first)?.dispose()
    texCache.delete(first)
  }
  return tex
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.72,
    metalness: opts.metalness ?? 0.04,
    flatShading: opts.flat ?? false,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    map: opts.map,
  })
}

function addMesh(parent, geo, material, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, material)
  m.position.set(...pos)
  m.rotation.set(...rot)
  m.scale.set(...scl)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

function addBone(parent, start, end, radius, material) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end)
  const direction = b.clone().sub(a)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius, direction.length(), 6), material)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

// ─── creature mesh ─────────────────────────────────────────────────────────
export function buildCreature(genome, opts = {}) {
  const p = phenotype(genome)
  const root = new THREE.Group()
  const model = new THREE.Group()
  root.add(model)

  const s = 0.78 + p.size * 0.52
  const species = Math.min(3, Math.floor(p.archetype * 4))
  const bodyPlan = p.bodyPlanKey
  const fish = bodyPlan === 'fish'
  const insect = bodyPlan === 'insect'
  const bird = bodyPlan === 'bird'
  const biped = bodyPlan === 'biped'
  const quadruped = bodyPlan === 'quadruped'
  const upright = p.posture > 0.58
  const typeWidth = [1, 1.16, 0.78, 1.27][species]
  const typeLength = [1, 1.12, 0.86, 1.08][species]
  const planWidth = fish ? 0.9 : insect ? 1.08 : bird ? 0.82 : 1
  const planLength = fish ? 1.32 : insect ? 0.92 : bird ? 0.9 : 1
  const torsoRY = (0.5 + p.girth * 0.3) * s * [1, 0.98, 0.82, 1.2][species] * (fish ? 0.78 : 1)
  const torsoRX = (0.52 + p.girth * 0.48) * s * typeWidth * planWidth
  const torsoRZ = (0.62 + p.length * 0.55) * s * typeLength * planLength
  const legLen = fish ? 0 : (0.34 + p.legs * 0.62) * s * [1, 0.9, 1.22, 0.82][species] * (biped ? 1.04 : bird ? 0.82 : insect ? 0.55 : 1)
  const legThick = (0.09 + p.stance * 0.12) * [1, 0.9, 0.78, 1.42][species] * (insect ? 0.55 : bird ? 0.82 : 1)
  const hipY = legLen + torsoRY * 0.42
  const headScale = (0.34 + p.head * 0.36) * s * [1, 1.05, 0.88, 1.22][species] * (fish ? 0.9 : 1)
  const bodyY = fish ? torsoRY * 1.12 : legLen + torsoRY * (biped ? 0.62 : upright ? 0.58 : 0.52)
  const finLevel = fish ? Math.max(p.fins, 0.62) : p.fins
  const shellLevel = insect ? Math.max(p.carapace, 0.62) : p.carapace
  const antennaLevel = insect ? Math.max(p.antennae, 0.5) : p.antennae
  const wingLevel = bird ? Math.max(p.wings, 0.64) : p.wings
  const gillLevel = fish ? Math.max(p.gills, 0.56) : p.gills
  const tailLevel = fish ? Math.max(p.tail, 0.68) : p.tail
  const insectLegs = insect
    ? [-0.62, 0, 0.62].flatMap(z => [-1, 1].map(x => ({ x, z, front: z > 0, middle: z === 0 })))
    : null

  const coat = coatTexture(p, 'body')
  const bodyMat = mat(0xffffff, { map: coat, roughness: 0.66 })
  const darkMat = mat(p.darkColor, { roughness: 0.8 })
  const accentMat = mat(p.accentColor, { roughness: 0.55, metalness: 0.12 })
  const boneMat = mat('#e8dfc4', { roughness: 0.62, flat: true })
  const clawMat = mat('#332f27', { roughness: 0.4, metalness: 0.2 })
  const eyeMat = mat(p.eyeColor, { emissive: p.eyeColor, emissiveIntensity: 2.1, roughness: 0.2 })
  const pupilMat = mat('#0a0d0c', { roughness: 0.3 })
  const wingMat = mat(p.accentColor, { transparent: true, opacity: 0.72, side: THREE.DoubleSide, roughness: 0.5, emissive: p.darkColor, emissiveIntensity: 0.16 })

  const bodyGroup = new THREE.Group()
  bodyGroup.position.y = bodyY
  model.add(bodyGroup)

  const torsoGeo = new THREE.IcosahedronGeometry(1, 2)
  const torsoTilt = fish ? 0 : biped ? -0.62 : upright ? -0.16 : 0
  const torso = addMesh(bodyGroup, torsoGeo, bodyMat, [0, 0, 0], [torsoTilt, 0, 0], [torsoRX, torsoRY, torsoRZ])
  // belly plate follows the body plan's torso angle.
  addMesh(bodyGroup, new THREE.IcosahedronGeometry(1, 1), mat(p.accentColor, { roughness: 0.7 }), [0, -torsoRY * 0.55, torsoRZ * 0.05], [torsoTilt, 0, 0], [torsoRX * 0.8, torsoRY * 0.42, torsoRZ * 0.86])

  // ── neck & head ──
  const neckBase = new THREE.Group()
  neckBase.position.set(0, torsoRY * (biped ? 0.36 : 0.3), torsoRZ * 0.62)
  bodyGroup.add(neckBase)
  const neckLen = (0.16 + p.neck * 0.62) * s * [1, 1.34, 1.08, 0.76][species]
  const neckGeo = new THREE.CapsuleGeometry(0.17 * s, neckLen, 3, 8)
  addMesh(neckBase, neckGeo, bodyMat, [0, neckLen * 0.34, 0.06 * s], [-0.62 + p.neck * 0.2, 0, 0], [1, 1, 1.05 + p.neck * 0.3])

  const headGroup = new THREE.Group()
  headGroup.position.set(0, neckLen * 0.82 + 0.06 * s, neckLen * 0.48)
  neckBase.add(headGroup)
  const skull = addMesh(headGroup, new THREE.IcosahedronGeometry(1, 2), bodyMat, [0, 0, 0], [0, 0, 0], [headScale, headScale * 0.82, headScale * 1.02])
  // jaw / snout
  const snoutLen = headScale * (0.72 + p.snout * 0.78)
  if (bird) {
    addMesh(headGroup, new THREE.ConeGeometry(headScale * 0.3, snoutLen * 1.35, 5), accentMat,
      [0, -headScale * 0.12, headScale * 0.88], [Math.PI / 2, 0, 0], [1, 0.72, 1.15])
    addMesh(headGroup, new THREE.ConeGeometry(headScale * 0.2, snoutLen * 0.82, 5), darkMat,
      [0, -headScale * 0.31, headScale * 0.94], [-Math.PI / 2, 0, 0], [1, 0.6, 1])
  } else if (fish) {
    addMesh(headGroup, new THREE.IcosahedronGeometry(1, 1), bodyMat,
      [0, -headScale * 0.12, headScale * 0.74 + snoutLen * 0.2], [0, 0, 0], [headScale * 0.44, headScale * 0.34, snoutLen * 0.62])
    addMesh(headGroup, new THREE.BoxGeometry(headScale * 0.42, headScale * 0.08, headScale * 0.16), darkMat,
      [0, -headScale * 0.27, headScale * 1.16 + snoutLen * 0.42])
  } else {
    addMesh(headGroup, new THREE.CapsuleGeometry(headScale * 0.41, snoutLen, 3, 8), darkMat,
      [0, -headScale * 0.18, headScale * 0.62 + snoutLen * 0.34], [Math.PI / 2, 0, 0], [1, 1, 0.8])
    addMesh(headGroup, new THREE.CapsuleGeometry(headScale * 0.3, snoutLen * 0.68, 3, 8), bodyMat,
      [0, -headScale * 0.38, headScale * 0.7 + snoutLen * 0.24], [Math.PI / 2, 0, 0], [1, 1, 0.6])
    if (!insect) {
      const toothGeo = new THREE.ConeGeometry(headScale * 0.055, headScale * 0.19, 4)
      for (let i = 0; i < 4; i++) {
        addMesh(headGroup, toothGeo, boneMat, [(i - 1.5) * headScale * 0.16, -headScale * 0.48, headScale * 0.72 + snoutLen * 0.4 + (i % 2) * 0.02], [Math.PI, 0, 0])
      }
    }
  }
  // Eyes sit wide on aquatic and insect heads for distinct silhouettes.
  const eyeR = headScale * (0.13 + p.eyes * 0.1) * (insect ? 1.42 : 1)
  for (const side of [-1, 1]) {
    const ex = side * headScale * (insect || fish ? 0.76 : 0.58), ey = headScale * 0.16, ez = headScale * 0.62
    addMesh(headGroup, new THREE.SphereGeometry(eyeR, 14, 10), eyeMat, [ex, ey, ez], [0, 0, 0], [1, 1, 0.7])
    addMesh(headGroup, new THREE.SphereGeometry(eyeR * 0.48, 10, 8), pupilMat, [ex + side * eyeR * 0.35, ey, ez + eyeR * 0.5], [0, 0, 0], [1, 1, 0.5])
  }
  // brow ridge
  addMesh(headGroup, new THREE.BoxGeometry(headScale * 0.95, headScale * 0.16, headScale * 0.34), darkMat, [0, headScale * 0.36, headScale * 0.5], [0.18, 0, 0])

  // horns
  const hornPairs = p.horns > 0.74 ? 3 : p.horns > 0.46 ? 2 : p.horns > 0.16 ? 1 : 0
  for (let pair = 0; pair < hornPairs; pair++) {
    for (const side of [-1, 1]) {
      const len = headScale * (0.55 + p.horns * 1.15) * (1 - pair * 0.22)
      const horn = addMesh(headGroup, new THREE.ConeGeometry(headScale * 0.14, len, 6), boneMat,
        [side * (headScale * 0.34 + pair * headScale * 0.12), headScale * 0.6 + pair * headScale * 0.15, headScale * (0.18 - pair * 0.24)],
        [-0.35, 0, side * -(0.25 + pair * 0.2)], [1, 1, 1])
      horn.castShadow = true
    }
  }
  // Animal adaptations are independent loci so inherited combinations reshape the silhouette.
  if (p.antlers > 0.24) {
    for (const side of [-1, 1]) {
      const root = [side * headScale * 0.38, headScale * 0.61, headScale * 0.02]
      const crown = [side * headScale * (0.82 + p.antlers * 0.3), headScale * (1.18 + p.antlers * 0.5), -headScale * 0.08]
      const fork = [side * headScale * (0.96 + p.antlers * 0.32), headScale * (1.65 + p.antlers * 0.48), -headScale * 0.12]
      addBone(headGroup, root, crown, headScale * 0.105, boneMat)
      addBone(headGroup, crown, fork, headScale * 0.075, boneMat)
      addBone(headGroup, [side * headScale * 0.62, headScale * 0.95, 0], [side * headScale * 1.24, headScale * 1.2, headScale * 0.02], headScale * 0.07, boneMat)
      addBone(headGroup, [side * headScale * 1.24, headScale * 1.2, headScale * 0.02], [side * headScale * 1.35, headScale * 1.52, -headScale * 0.02], headScale * 0.055, boneMat)
    }
  }
  if (antennaLevel > 0.24) {
    for (const side of [-1, 1]) {
      const base = [side * headScale * 0.32, headScale * 0.68, -headScale * 0.12]
      const bend = [side * headScale * (0.65 + antennaLevel * 0.24), headScale * (1.18 + antennaLevel * 0.2), -headScale * 0.2]
      const tip = [side * headScale * (0.98 + antennaLevel * 0.38), headScale * (1.34 + antennaLevel * 0.32), -headScale * 0.27]
      addBone(headGroup, base, bend, headScale * 0.045, darkMat)
      addBone(headGroup, bend, tip, headScale * 0.035, darkMat)
      addMesh(headGroup, new THREE.SphereGeometry(headScale * (0.085 + antennaLevel * 0.035), 8, 6), accentMat, tip)
    }
  }

  // crest / ear fins
  if (p.wings > 0.3) {
    for (const side of [-1, 1]) {
      const fin = addMesh(headGroup, new THREE.ConeGeometry(headScale * 0.26, headScale * 0.7, 4), wingMat,
        [side * headScale * 0.7, headScale * 0.15, -headScale * 0.15], [0, 0, side * -1.15], [1, 0.3, 1])
      fin.material = wingMat
    }
  }

  // ── back spikes ──
  if (p.armor > 0.2) {
    const count = 2 + Math.floor(p.armor * 7)
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1 || 1)
      const h = torsoRY * (1.05 - t * 0.5) * (0.55 + p.armor * 0.55)
      const spike = addMesh(bodyGroup, new THREE.ConeGeometry(torsoRX * 0.16, h, 4), boneMat,
        [0, torsoRY * (0.72 - Math.abs(t - 0.4) * 0.5), torsoRZ * (0.62 - t * 1.25)],
        [-0.24, 0, 0], [1, 1, 1])
      spike.castShadow = true
    }
  }
  // Animal-inspired body structures follow the torso proportions and remain visible at portrait scale.
  if (p.carapace > 0.24) {
    const shellY = torsoRY * 0.34
    const shell = addMesh(bodyGroup,
      new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(p.accentColor, { roughness: 0.34, metalness: 0.16 }),
      [0, shellY, -torsoRZ * 0.02], [torsoTilt, 0, 0],
      [torsoRX * 0.94, torsoRY * (0.72 + p.carapace * 0.16), torsoRZ * 0.78])
    shell.material.side = THREE.DoubleSide
    addMesh(bodyGroup, new THREE.TorusGeometry(1, 0.045, 5, 28), darkMat,
      [0, shellY, -torsoRZ * 0.02], [Math.PI / 2 + torsoTilt, 0, 0],
      [torsoRX * 0.94, torsoRZ * 0.78, 1])
    for (const side of [-1, 1]) {
      addMesh(bodyGroup, new THREE.IcosahedronGeometry(1, 1), accentMat,
        [side * torsoRX * 0.57, shellY + torsoRY * 0.13, -torsoRZ * 0.06],
        [0, 0, side * 0.28], [torsoRX * 0.28, torsoRY * 0.36, torsoRZ * 0.62])
    }
  }
  if (p.fins > 0.24) {
    const count = 3 + Math.round(p.fins * 3)
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1)
      const z = torsoRZ * (0.72 - t * 1.48)
      const height = torsoRY * (0.32 + p.fins * 0.72) * (0.7 + Math.sin(t * Math.PI) * 0.3)
      const width = torsoRZ * (0.12 + p.fins * 0.04)
      const finShape = new THREE.Shape()
      finShape.moveTo(-width * 0.5, 0)
      finShape.quadraticCurveTo(-width * 0.28, height * 0.72, width * 0.02, height)
      finShape.quadraticCurveTo(width * 0.12, height * 0.5, width * 0.5, 0)
      finShape.closePath()
      const fin = addMesh(bodyGroup, new THREE.ShapeGeometry(finShape, 8), wingMat,
        [0, torsoRY * (0.78 - t * 0.08), z], [0, Math.PI / 2, 0])
      fin.material = wingMat
      addBone(bodyGroup, [0, torsoRY * (0.78 - t * 0.08), z + width * 0.42],
        [0, torsoRY * (0.78 - t * 0.08) + height * 0.78, z - width * 0.02], torsoRX * 0.025, accentMat)
    }
  }
  if (p.gills > 0.24) {
    for (const side of [-1, 1]) {
      const baseX = side * headScale * 0.68
      const baseY = -headScale * 0.08
      const baseZ = headScale * 0.16
      for (let i = 0; i < 4; i++) {
        const spread = (i - 1.5) / 1.5
        const length = headScale * (0.38 + p.gills * 0.48)
        const start = [baseX, baseY + spread * headScale * 0.08, baseZ - i * headScale * 0.035]
        const end = [side * (headScale * 1.08 + length * 0.34), baseY + spread * length * 0.62, baseZ - length * (0.48 + i * 0.035)]
        const tip = [side * (headScale * 1.1 + length * 0.46), baseY + spread * length * 0.78, baseZ - length * (0.55 + i * 0.035)]
        addBone(headGroup, start, end, headScale * 0.052, accentMat)
        addBone(headGroup, end, tip, headScale * 0.034, boneMat)
      }
    }
  }
  if (p.pincers > 0.24) {
    for (const side of [-1, 1]) {
      const reach = torsoRX * (0.35 + p.pincers * 0.28)
      const shoulder = [side * torsoRX * 0.76, torsoRY * 0.08, torsoRZ * 0.48]
      const elbow = [side * (torsoRX + reach * 0.45), torsoRY * 0.02, torsoRZ * 0.7]
      const palm = [side * (torsoRX + reach * 0.62), torsoRY * 0.02, torsoRZ * 0.82]
      addBone(bodyGroup, shoulder, elbow, legThick * 0.48, darkMat)
      addBone(bodyGroup, elbow, palm, legThick * 0.4, clawMat)
      const clawLength = torsoRZ * (0.16 + p.pincers * 0.12)
      addBone(bodyGroup, palm, [side * (torsoRX + reach * 0.9), torsoRY * 0.18, torsoRZ * 0.82 + clawLength], legThick * 0.34, clawMat)
      addBone(bodyGroup, palm, [side * (torsoRX + reach * 0.95), -torsoRY * 0.14, torsoRZ * 0.82 + clawLength * 0.88], legThick * 0.34, clawMat)
    }
  }
  // shoulder scutes
  for (const side of [-1, 1]) {
    addMesh(bodyGroup, new THREE.IcosahedronGeometry(1, 0), darkMat,
      [side * torsoRX * 0.72, torsoRY * 0.34, torsoRZ * 0.3], [0, 0, side * 0.4], [torsoRX * 0.26, torsoRY * 0.2, torsoRZ * 0.42])
  }
  // Species-specific silhouette details make the four archetypes readable at a glance.
  if (species === 1) { // Mireling: paired cheek/gill frills along a broad ribcage.
    for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
      addMesh(bodyGroup, new THREE.ConeGeometry(torsoRY * 0.16, torsoRY * 0.68, 5), accentMat,
        [side * torsoRX * 0.88, torsoRY * (0.28 - i * 0.08), torsoRZ * (0.42 - i * 0.48)],
        [0, 0, side * -1.05], [0.72, 1, 0.48])
    }
  } else if (species === 2) { // Skykin: swept feather crest, even when wing membranes are small.
    for (let i = 0; i < 3; i++) {
      addMesh(headGroup, new THREE.ConeGeometry(headScale * 0.12, headScale * (0.52 + i * 0.12), 5), wingMat,
        [(i - 1) * headScale * 0.2, headScale * 0.68, -headScale * (0.12 + i * 0.12)],
        [-0.5, 0, (i - 1) * 0.16])
    }
  }

  // ── tail ──
  const tailSegs = []
  if (p.tail > 0.08) {
    let parent = new THREE.Group()
    parent.position.set(0, torsoRY * 0.12, -torsoRZ * 0.92)
    bodyGroup.add(parent)
    const segCount = 4
    for (let i = 0; i < segCount; i++) {
      const seg = new THREE.Group()
      const r = (0.2 - i * 0.032) * s * (0.7 + p.tail * 0.7) * [1, 0.88, 0.78, 1.32][species]
      const len = (0.32 + p.tail * 0.42) * s * [1, 1.22, 1.08, 0.82][species]
      seg.position.z = i === 0 ? 0 : -len * 0.92
      const g = new THREE.CapsuleGeometry(Math.max(0.045, r), len, 2, 7)
      addMesh(seg, g, i % 2 === 0 ? bodyMat : darkMat, [0, 0, -len * 0.46], [Math.PI / 2, 0, 0])
      parent.add(seg)
      tailSegs.push(seg)
      parent = seg
      if (i === segCount - 1 && p.armor > 0.3) {
        addMesh(seg, new THREE.ConeGeometry(r * 1.2, len * 1.1, 5), boneMat, [0, 0, -len * 1.1], [-Math.PI / 2, 0, 0])
      }
    }
  }

  // ── wings ──
  const wings = []
  if (p.wings > 0.42) {
    const wingGroup = new THREE.Group()
    wingGroup.position.set(0, torsoRY * 0.5, torsoRZ * 0.05)
    bodyGroup.add(wingGroup)
    const span = (0.9 + p.wings * 1.35) * s * [1, 0.92, 1.28, 1.05][species]
    const height = (0.6 + p.wings * 0.9) * s * [1, 0.94, 1.22, 1.08][species]
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    shape.quadraticCurveTo(span * 0.55, height * 0.7, span, height * 0.18)
    shape.quadraticCurveTo(span * 0.7, -height * 0.12, span * 0.38, -height * 0.28)
    shape.quadraticCurveTo(span * 0.22, -height * 0.08, 0, 0)
    const wingGeo = new THREE.ShapeGeometry(shape, 12)
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group()
      pivot.rotation.z = side * 0.18
      wingGroup.add(pivot)
      const w = new THREE.Mesh(wingGeo, wingMat)
      w.scale.x = side
      w.castShadow = true
      pivot.add(w)
      // leading edge strut
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.028 * s, 0.045 * s, span, 5), darkMat)
      bone.position.set(side * span * 0.46, height * 0.22, 0)
      bone.rotation.z = side * -0.42
      bone.castShadow = true
      wingGroup.add(bone)
      wings.push(pivot)
    }
  }

  // ── legs & biped arms ──
  const legs = []
  const hips = fish ? [] : insect ? insectLegs : bird || biped
    ? [{ x: -1, z: -0.06, front: true }, { x: 1, z: -0.06, front: true }]
    : [
        { x: -1, z: 0.48, front: true }, { x: 1, z: 0.48, front: true },
        { x: -1, z: -0.5, front: false }, { x: 1, z: -0.5, front: false },
      ]
  for (const hip of hips) {
    const leg = new THREE.Group()
    leg.position.set(hip.x * torsoRX * (biped ? 0.43 : 0.62), hipY, hip.z * torsoRZ * (biped ? 0.48 : 0.86))
    const scaleLeg = (hip.front ? 0.86 : 1) * (0.8 + p.legs * 0.34) * (biped ? 1.14 : 1)
    const upper = legLen * 0.52 * scaleLeg
    const lower = legLen * 0.54 * scaleLeg
    const thick = legThick * (hip.front ? (biped ? 1.12 : 0.84) : 1.1)
    addMesh(leg, new THREE.CapsuleGeometry(thick, upper, 2, 7), bodyMat, [0, -upper * 0.5, 0])
    const knee = new THREE.Group()
    knee.position.y = -upper
    leg.add(knee)
    addMesh(knee, new THREE.SphereGeometry(thick * 1.15, 8, 6), darkMat)
    addMesh(knee, new THREE.CapsuleGeometry(thick * 0.78, lower * 0.82, 2, 7), darkMat, [0, -lower * 0.45, 0])
    const foot = addMesh(knee, new THREE.IcosahedronGeometry(thick * 1.7, 1), darkMat, [0, -lower * 0.92, thick * 0.55], [0, 0, 0], [biped ? 1.2 : 1.5, 0.55, biped ? 1.45 : 1.9])
    foot.castShadow = true
    for (let c = -1; c <= 1; c++) {
      addMesh(knee, new THREE.ConeGeometry(thick * 0.3, thick * 1.15, 4), clawMat,
        [c * thick * 0.7, -lower * 0.94, thick * 1.4], [Math.PI / 2.2, 0, 0])
    }
    leg.rotation.x = hip.front ? 0.06 : -0.06
    legs.push({ group: leg, knee, front: hip.front, phase: hip.x > 0 ? 0 : Math.PI })
    model.add(leg)
  }
  const arms = []
  if (biped) {
    const armLen = legLen * 0.72
    for (const side of [-1, 1]) {
      const arm = new THREE.Group()
      arm.position.set(side * torsoRX * 0.72, torsoRY * 0.52, torsoRZ * 0.18)
      arm.rotation.z = side * 0.16
      const upper = armLen * 0.54, fore = armLen * 0.48, thick = legThick * 0.68
      addMesh(arm, new THREE.CapsuleGeometry(thick, upper, 2, 7), bodyMat, [0, -upper * 0.42, 0])
      const elbow = new THREE.Group()
      elbow.position.y = -upper * 0.84
      arm.add(elbow)
      addMesh(elbow, new THREE.CapsuleGeometry(thick * 0.76, fore, 2, 7), darkMat, [0, -fore * 0.42, torsoRZ * 0.025])
      addMesh(elbow, new THREE.SphereGeometry(thick * 1.18, 8, 6), darkMat, [0, -fore * 0.86, torsoRZ * 0.04])
      for (let c = -1; c <= 1; c++) {
        addMesh(elbow, new THREE.ConeGeometry(thick * 0.2, thick * 0.72, 4), clawMat,
          [c * thick * 0.54, -fore * 0.9, torsoRZ * 0.16], [Math.PI / 2, 0, 0])
      }
      bodyGroup.add(arm)
      arms.push({ group: arm, side })
    }
  }

  // ── ground fit ──
  model.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(model)
  const lift = -box.min.y
  model.position.y = lift + 0.015

  // animation state
  let t = Math.random() * 10
  let walkAmt = 0
  let flashTime = 0
  let flashColor = new THREE.Color('#ffffff')
  const materials = []
  root.traverse(o => { if (o.material && !materials.includes(o.material)) materials.push(o.material) })
  const baseEmissive = materials.map(m => ({ m, e: m.emissive ? m.emissive.clone() : null, i: m.emissiveIntensity }))

  function update(dt, movement = 0) {
    t += dt
    walkAmt += (movement - walkAmt) * Math.min(1, dt * 7)
    const breathe = Math.sin(t * 1.7) * 0.014
    bodyGroup.scale.set(1 + breathe * 0.4, 1 + breathe, 1 + breathe * 0.3)
    bodyGroup.position.y = bodyY + Math.sin(t * 1.7) * 0.012 + Math.abs(Math.cos(t * 6)) * 0.03 * walkAmt
    neckBase.rotation.x = Math.sin(t * 1.1) * 0.04 - 0.04 + walkAmt * 0.06
    headGroup.rotation.x = Math.sin(t * 1.4 + 0.7) * 0.05
    headGroup.rotation.y = Math.sin(t * 0.6) * 0.13
    headGroup.rotation.z = Math.sin(t * 0.9) * 0.02

    tailSegs.forEach((seg, i) => {
      seg.rotation.y = Math.sin(t * 1.6 + i * 0.4) * 0.12 + Math.sin(t * 0.7) * 0.05
      seg.rotation.x = Math.sin(t * 1.2 + 0.6) * 0.035
    })
    for (let i = 0; i < wings.length; i++) {
      const side = i === 0 ? -1 : 1
      wings[i].rotation.z = side * (0.12 + Math.sin(t * 2.3) * 0.18) + side * walkAmt * 0.12
      wings[i].rotation.x = Math.sin(t * 1.5 + i) * 0.06
    }
    for (const leg of legs) {
      const phase = walkAmt > 0.02 ? Math.sin(t * 7.5 + leg.phase) : 0
      leg.group.rotation.x = (leg.front ? 0.06 : -0.06) + phase * 0.5 * walkAmt
      leg.knee.rotation.x = Math.max(0, -phase) * 0.6 * walkAmt
    }
    for (const arm of arms) {
      arm.group.rotation.x = Math.sin(t * 7.5 + (arm.side < 0 ? Math.PI : 0)) * 0.16 * walkAmt
    }
    if (flashTime > 0) {
      flashTime -= dt
      const k = Math.max(0, flashTime / 0.18)
      for (const b of baseEmissive) {
        if (!b.e) continue
        b.m.emissive.copy(b.e).lerp(flashColor, k)
        b.m.emissiveIntensity = b.i + k * 2.4
      }
    }
  }

  function flash(color = '#ffffff', duration = 0.18) {
    flashColor.set(color)
    flashTime = duration
  }

  function dispose() {
    model.traverse(o => {
      if (o.geometry) o.geometry.dispose()
    })
    for (const m of materials) m.dispose()
    root.removeFromParent()
  }

  root.userData = { update, flash, dispose, phenotype: p, materials }
  root.scale.setScalar(opts.scale ?? 1)
  root.name = 'creature'
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  return root
}

// ─── portrait snapshot ─────────────────────────────────────────────────────
let portraitRenderer = null
export function portraitDataURL(genome, size = 220) {
  if (!portraitRenderer) {
    portraitRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    portraitRenderer.setPixelRatio(1)
    portraitRenderer.outputColorSpace = THREE.SRGBColorSpace
    portraitRenderer.toneMapping = THREE.ACESFilmicToneMapping
    portraitRenderer.toneMappingExposure = 1.1
    portraitRenderer.shadowMap.enabled = false
  }
  portraitRenderer.setSize(size, size, false)
  const scene = new THREE.Scene()
  const creature = buildCreature(genome)
  // face three-quarter
  creature.rotation.y = -0.5
  creature.update(0.2, 0)
  scene.add(creature)
  const box = new THREE.Box3().setFromObject(creature)
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
  const dist = sphere.radius / Math.sin((34 * Math.PI / 180) / 2) * 0.84
  cam.position.set(sphere.center.x + dist * 0.18, sphere.center.y + dist * 0.18, sphere.center.z + dist)
  cam.lookAt(sphere.center)
  scene.add(cam)
  scene.add(new THREE.HemisphereLight(0xcffcff, 0x203030, 2.2))
  const key = new THREE.DirectionalLight(0xfff3d6, 3.2)
  key.position.set(3, 5, 4)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x6fffd7, 2.2)
  rim.position.set(-4, 2, -3)
  scene.add(rim)
  portraitRenderer.render(scene, cam)
  const url = portraitRenderer.domElement.toDataURL('image/jpeg', 0.86)
  creature.userData.dispose()
  return url
}
