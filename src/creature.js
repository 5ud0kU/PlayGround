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
  const cacheKey = `${p.bodyColor}|${p.darkColor}|${p.accentColor}|${p.pattern.toFixed(2)}|${key}`
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

  const mode = p.pattern < 0.34 ? 'spots' : p.pattern < 0.68 ? 'bands' : 'dapple'
  ctx.fillStyle = p.darkColor
  if (mode === 'spots') {
    ctx.globalAlpha = 0.5
    for (let i = 0; i < 34; i++) {
      const x = r() * size, y = r() * size, rad = 3 + r() * 8
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 0.3
    ctx.fillStyle = p.accentColor
    for (let i = 0; i < 16; i++) {
      ctx.beginPath(); ctx.arc(r() * size, r() * size, 1.5 + r() * 3, 0, Math.PI * 2); ctx.fill()
    }
  } else if (mode === 'bands') {
    ctx.globalAlpha = 0.4
    for (let i = 0; i < 6; i++) {
      const y = i * 44 + 10 + r() * 8
      ctx.beginPath(); ctx.moveTo(0, y)
      ctx.bezierCurveTo(70, y - 12, 170, y + 12, size, y - 4)
      ctx.lineTo(size, y + 12 + r() * 8)
      ctx.bezierCurveTo(170, y + 24, 70, y + 2, 0, y + 18)
      ctx.closePath(); ctx.fill()
    }
    ctx.globalAlpha = 0.25
    ctx.fillStyle = p.accentColor
    for (let i = 0; i < 5; i++) {
      const y = i * 52 + 30
      ctx.fillRect(0, y, size, 2)
    }
  } else {
    ctx.globalAlpha = 0.36
    for (let i = 0; i < 70; i++) {
      const x = r() * size, y = r() * size, rad = 4 + r() * 14
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 0.3
    ctx.fillStyle = p.accentColor
    for (let i = 0; i < 26; i++) {
      ctx.beginPath(); ctx.arc(r() * size, r() * size, 1 + r() * 2.5, 0, Math.PI * 2); ctx.fill()
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

// ─── creature mesh ─────────────────────────────────────────────────────────
export function buildCreature(genome, opts = {}) {
  const p = phenotype(genome)
  const root = new THREE.Group()
  const model = new THREE.Group()
  root.add(model)

  const s = 0.78 + p.size * 0.52
  const torsoRY = (0.5 + p.girth * 0.3) * s
  const torsoRX = (0.52 + p.girth * 0.48) * s
  const torsoRZ = (0.62 + p.length * 0.55) * s
  const legLen = (0.34 + p.legs * 0.62) * s
  const legThick = 0.09 + p.stance * 0.12
  const hipY = legLen + torsoRY * 0.42
  const headScale = (0.34 + p.head * 0.36) * s
  const bodyY = legLen + torsoRY * 0.55

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
  const torso = addMesh(bodyGroup, torsoGeo, bodyMat, [0, 0, 0], [0, 0, 0], [torsoRX, torsoRY, torsoRZ])
  // belly plate
  addMesh(bodyGroup, new THREE.IcosahedronGeometry(1, 1), mat(p.accentColor, { roughness: 0.7 }), [0, -torsoRY * 0.55, torsoRZ * 0.05], [0, 0, 0], [torsoRX * 0.8, torsoRY * 0.42, torsoRZ * 0.86])

  // ── neck & head ──
  const neckBase = new THREE.Group()
  neckBase.position.set(0, torsoRY * 0.3, torsoRZ * 0.62)
  bodyGroup.add(neckBase)
  const neckLen = (0.16 + p.neck * 0.62) * s
  const neckGeo = new THREE.CapsuleGeometry(0.17 * s, neckLen, 3, 8)
  addMesh(neckBase, neckGeo, bodyMat, [0, neckLen * 0.34, 0.06 * s], [-0.62 + p.neck * 0.2, 0, 0], [1, 1, 1.05 + p.neck * 0.3])

  const headGroup = new THREE.Group()
  headGroup.position.set(0, neckLen * 0.82 + 0.06 * s, neckLen * 0.48)
  neckBase.add(headGroup)
  const skull = addMesh(headGroup, new THREE.IcosahedronGeometry(1, 2), bodyMat, [0, 0, 0], [0, 0, 0], [headScale, headScale * 0.82, headScale * 1.02])
  // jaw / snout
  const snoutLen = headScale * (0.72 + p.snout * 0.78)
  addMesh(headGroup, new THREE.CapsuleGeometry(headScale * 0.41, snoutLen, 3, 8), darkMat,
    [0, -headScale * 0.18, headScale * 0.62 + snoutLen * 0.34], [Math.PI / 2, 0, 0], [1, 1, 0.8])
  addMesh(headGroup, new THREE.CapsuleGeometry(headScale * 0.3, snoutLen * 0.68, 3, 8), bodyMat,
    [0, -headScale * 0.38, headScale * 0.7 + snoutLen * 0.24], [Math.PI / 2, 0, 0], [1, 1, 0.6])
  // teeth
  const toothGeo = new THREE.ConeGeometry(headScale * 0.055, headScale * 0.19, 4)
  for (let i = 0; i < 4; i++) {
    addMesh(headGroup, toothGeo, boneMat, [(i - 1.5) * headScale * 0.16, -headScale * 0.48, headScale * 0.72 + snoutLen * 0.4 + (i % 2) * 0.02], [Math.PI, 0, 0])
  }
  // eyes
  const eyeR = headScale * (0.13 + p.eyes * 0.1)
  for (const side of [-1, 1]) {
    const ex = side * headScale * 0.58, ey = headScale * 0.16, ez = headScale * 0.62
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
  // shoulder scutes
  for (const side of [-1, 1]) {
    addMesh(bodyGroup, new THREE.IcosahedronGeometry(1, 0), darkMat,
      [side * torsoRX * 0.72, torsoRY * 0.34, torsoRZ * 0.3], [0, 0, side * 0.4], [torsoRX * 0.26, torsoRY * 0.2, torsoRZ * 0.42])
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
      const r = (0.2 - i * 0.032) * s * (0.7 + p.tail * 0.7)
      const len = (0.32 + p.tail * 0.42) * s
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
    const span = (0.9 + p.wings * 1.35) * s
    const height = (0.6 + p.wings * 0.9) * s
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

  // ── legs ──
  const legs = []
  const hips = [
    { x: -1, z: 0.48, front: true },
    { x: 1, z: 0.48, front: true },
    { x: -1, z: -0.5, front: false },
    { x: 1, z: -0.5, front: false },
  ]
  for (const hip of hips) {
    const leg = new THREE.Group()
    leg.position.set(hip.x * torsoRX * 0.62, hipY, hip.z * torsoRZ * 0.86)
    const scaleLeg = (hip.front ? 0.86 : 1) * (0.8 + p.legs * 0.34)
    const upper = legLen * 0.52 * scaleLeg
    const lower = legLen * 0.54 * scaleLeg
    const thick = legThick * (hip.front ? 0.84 : 1.1)
    addMesh(leg, new THREE.CapsuleGeometry(thick, upper, 2, 7), bodyMat, [0, -upper * 0.5, 0], [0, 0, 0], [1, 1, 1])
    const knee = new THREE.Group()
    knee.position.y = -upper
    leg.add(knee)
    addMesh(knee, new THREE.SphereGeometry(thick * 1.15, 8, 6), darkMat)
    addMesh(knee, new THREE.CapsuleGeometry(thick * 0.78, lower * 0.82, 2, 7), darkMat, [0, -lower * 0.45, 0])
    const foot = addMesh(knee, new THREE.IcosahedronGeometry(thick * 1.7, 1), darkMat, [0, -lower * 0.92, thick * 0.55], [0, 0, 0], [1.5, 0.55, 1.9])
    foot.castShadow = true
    // claws
    for (let c = -1; c <= 1; c++) {
      addMesh(knee, new THREE.ConeGeometry(thick * 0.3, thick * 1.15, 4), clawMat,
        [c * thick * 0.7, -lower * 0.94, thick * 1.4], [Math.PI / 2.2, 0, 0])
    }
    leg.rotation.x = hip.front ? 0.06 : -0.06
    legs.push({ group: leg, knee, front: hip.front, phase: hip.front ? (hip.x > 0 ? 0 : Math.PI) : (hip.x > 0 ? Math.PI : 0) })
    model.add(leg)
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

    for (const seg of tailSegs) {
      seg.rotation.y = Math.sin(t * 1.6 + seg.id * 0.4) * 0.12 + Math.sin(t * 0.7) * 0.05
      seg.rotation.x = Math.sin(t * 1.2 + 0.6) * 0.035
    }
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

  // store tail ids for animation phase
  tailSegs.forEach((seg, i) => { seg.id = i })

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
