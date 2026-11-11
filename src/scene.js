import * as THREE from 'three'
import { buildCreature } from './creature.js'
import { phenotype } from './dna.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function groundTexture(kind) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const x = c.getContext('2d')
  if (kind === 'habitat') {
    const grad = x.createRadialGradient(256, 256, 20, 256, 256, 260)
    grad.addColorStop(0, '#274b44')
    grad.addColorStop(0.65, '#1c3a38')
    grad.addColorStop(1, '#12292c')
    x.fillStyle = grad
    x.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 1200; i++) {
      x.globalAlpha = 0.05 + Math.random() * 0.12
      x.fillStyle = ['#5affc8', '#0e1e22', '#8de0a0', '#456c5c'][Math.floor(Math.random() * 4)]
      const r = 1 + Math.random() * 16
      x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, r, 0, Math.PI * 2); x.fill()
    }
    // faint mycelium veins
    x.globalAlpha = 0.26
    x.strokeStyle = '#68f7c3'
    x.lineWidth = 1.1
    for (let i = 0; i < 26; i++) {
      x.beginPath()
      let px = Math.random() * 512, py = Math.random() * 512
      x.moveTo(px, py)
      for (let s = 0; s < 5; s++) {
        px += (Math.random() - 0.5) * 90
        py += (Math.random() - 0.5) * 90
        x.lineTo(px, py)
      }
      x.stroke()
    }
    // rings
    x.globalAlpha = 0.22
    x.strokeStyle = '#7effd2'
    for (let r = 80; r < 250; r += 56) {
      x.lineWidth = r === 192 ? 2 : 1
      x.beginPath(); x.arc(256, 256, r, 0, Math.PI * 2); x.stroke()
    }
  } else {
    const grad = x.createRadialGradient(256, 256, 30, 256, 256, 260)
    grad.addColorStop(0, '#2a2430')
    grad.addColorStop(0.7, '#1b1a25')
    grad.addColorStop(1, '#100f18')
    x.fillStyle = grad
    x.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 900; i++) {
      x.globalAlpha = 0.04 + Math.random() * 0.1
      x.fillStyle = ['#ff5e8a', '#ffb46b', '#14121c', '#5f4d66'][Math.floor(Math.random() * 4)]
      x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 18, 0, Math.PI * 2); x.fill()
    }
    x.globalAlpha = 0.5
    x.strokeStyle = '#ff7a5c'
    x.lineWidth = 1.4
    for (let i = 0; i < 18; i++) {
      x.beginPath()
      let px = Math.random() * 512, py = Math.random() * 512
      x.moveTo(px, py)
      for (let s = 0; s < 6; s++) {
        px += (Math.random() - 0.5) * 70
        py += (Math.random() - 0.5) * 70
        x.lineTo(px, py)
      }
      x.stroke()
    }
    x.globalAlpha = 0.3
    x.strokeStyle = '#ffcf7a'
    for (let r = 70; r < 250; r += 60) {
      x.beginPath(); x.arc(256, 256, r, 0, Math.PI * 2); x.stroke()
    }
  }
  x.globalAlpha = 1
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function skyMesh(top, horizon, bottom) {
  const geo = new THREE.SphereGeometry(90, 24, 16)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      horizon: { value: new THREE.Color(horizon) },
      bottom: { value: new THREE.Color(bottom) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP; uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
      void main(){
        vec3 d = normalize(vP);
        float h = d.y;
        vec3 col = mix(horizon, top, smoothstep(0.02, 0.65, h));
        col = mix(bottom, col, smoothstep(-0.35, 0.03, h));
        float star = step(0.9975, hash(floor(d*420.0))) * smoothstep(0.15, 0.5, h);
        col += vec3(0.55,0.9,0.8) * star * 0.85;
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
  return new THREE.Mesh(geo, mat)
}

function sporeField(count, color, radius, height, size) {
  const positions = new Float32Array(count * 3)
  const seeds = []
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * radius
    const y = Math.random() * height
    positions[i * 3] = Math.cos(a) * r
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = Math.sin(a) * r
    seeds.push({ speed: 0.1 + Math.random() * 0.35, phase: Math.random() * 10, a })
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })
  const points = new THREE.Points(geo, mat)
  points.userData.seeds = seeds
  return points
}

function mushroom(x, z, scale, hue) {
  const g = new THREE.Group()
  const stemMat = new THREE.MeshStandardMaterial({ color: '#c9d8bd', roughness: 0.8 })
  const capMat = new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 0.5, roughness: 0.5 })
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.1 * scale, 0.6 * scale, 6), stemMat)
  stem.position.y = 0.3 * scale
  stem.castShadow = true
  g.add(stem)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26 * scale, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat)
  cap.position.y = 0.6 * scale
  cap.scale.y = 0.6
  cap.castShadow = true
  g.add(cap)
  const dotMat = new THREE.MeshBasicMaterial({ color: '#f4ffe0' })
  for (let i = 0; i < 4; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.028 * scale, 5, 4), dotMat)
    const a = Math.random() * Math.PI * 2
    dot.position.set(Math.cos(a) * 0.16 * scale, 0.62 * scale + Math.random() * 0.05 * scale, Math.sin(a) * 0.16 * scale)
    g.add(dot)
  }
  g.position.set(x, 0, z)
  g.rotation.y = Math.random() * Math.PI
  return g
}

function crystal(x, z, scale, color) {
  const g = new THREE.Group()
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.65, roughness: 0.25, metalness: 0.1, flatShading: true })
  for (let i = 0; i < 3; i++) {
    const h = (0.7 + Math.random() * 1.3) * scale
    const shard = new THREE.Mesh(new THREE.ConeGeometry((0.12 + Math.random() * 0.2) * scale, h, 5), m)
    shard.position.set((Math.random() - 0.5) * 0.5 * scale, h / 2, (Math.random() - 0.5) * 0.5 * scale)
    shard.rotation.z = (Math.random() - 0.5) * 0.4
    shard.rotation.x = (Math.random() - 0.5) * 0.3
    shard.castShadow = true
    g.add(shard)
  }
  g.position.set(x, 0, z)
  return g
}

function tree(x, z, scale, palette) {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13 * scale, 0.24 * scale, 2.1 * scale, 6),
    new THREE.MeshStandardMaterial({ color: '#2b2a2e', roughness: 0.9 })
  )
  trunk.position.y = 1.05 * scale
  trunk.castShadow = true
  g.add(trunk)
  const canopyMat = new THREE.MeshStandardMaterial({ color: palette, roughness: 0.8, flatShading: true })
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry((0.65 + Math.random() * 0.3) * scale, 0), canopyMat)
    c.position.set((Math.random() - 0.5) * 0.7 * scale, (1.9 + Math.random() * 0.7) * scale, (Math.random() - 0.5) * 0.7 * scale)
    c.castShadow = true
    g.add(c)
  }
  const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09 * scale, 0), new THREE.MeshBasicMaterial({ color: '#b8ffd8' }))
  glow.position.set(0.3 * scale, 2.2 * scale, 0.4 * scale)
  g.add(glow)
  g.position.set(x, 0, z)
  g.rotation.y = Math.random() * Math.PI * 2
  return g
}

// ─── Biomes ───────────────────────────────────────────────────────────────────
// Each biome tints the ground, places themed flora and offers distinct
// nutrients. Creatures sense nearby biomes and roam to satisfy their needs.
export const BIOMES = [
  { key: 'forest', label: 'Forest', icon: '🌲', ground: '#2d6a4f', edge: '#1b4332', sky: '#0b1426', resources: ['fruit', 'nectar'], food: 'fruit', water: 'stream', color: '#4ade80' },
  { key: 'jungle', label: 'Jungle', icon: '🌴', ground: '#1b4332', edge: '#0d4f1b', sky: '#0a1a12', resources: ['fruit', 'insect'], food: 'fruit', water: 'pond', color: '#22c55e' },
  { key: 'desert', label: 'Desert', icon: '🏜️', ground: '#a67c52', edge: '#8b6914', sky: '#2a1b0e', resources: ['cactus', 'water'], food: 'cactus', water: 'oasis', color: '#f59e0b' },
  { key: 'seacoast', label: 'Seacoast', icon: '🏖️', ground: '#3d8da1', edge: '#2a6f97', sky: '#14263a', resources: ['fish', 'kelp'], food: 'fish', water: 'sea', color: '#0ea5e9' },
  { key: 'sea', label: 'Sea', icon: '🌊', ground: '#028090', edge: '#05668d', sky: '#12262e', resources: ['fish', 'kelp'], food: 'fish', water: 'sea', color: '#0891b2' },
  { key: 'plain', label: 'Plain', icon: '🌾', ground: '#8fbc8f', edge: '#6b8e23', sky: '#16261e', resources: ['grass', 'seed'], food: 'grass', water: 'dew', color: '#84cc16' },
]
const BIOME_COLORS = Object.fromEntries(BIOMES.map(b => [b.key, b.ground]))

function biomeAt(x, z) {
  // Pseudo-random stable biome field based on world position.
  const nx = Math.floor(x / 22)
  const nz = Math.floor(z / 22)
  let h = 2166136261
  h ^= nx; h = Math.imul(h, 16777619)
  h ^= nz; h = Math.imul(h, 16777619)
  const pick = (h >>> 0) % BIOMES.length
  return BIOMES[pick]
}

export class World {
  constructor(container, hooks = {}) {
    this.container = container
    this.hooks = hooks
    this.mode = 'habitat'
    this.creatures = new Map()
    this.selectedId = null
    this.time = 0
    this.shakeAmt = 0
    this.pointer = { down: false, x: 0, y: 0, moved: 0 }
    // First-person player state (habitat mode).
    this.player = {
      x: 0, y: 1.6, z: 3.5,
      yaw: 0, pitch: -0.25,
      speed: 5.5,
      bob: 0,
      keys: { w: false, s: false, a: false, d: false },
    }
    this.fov = 45
    this.crosshair = null
    this.hintEl = null
    this.touch = {
      mode: null,        // 'look' | 'joystick'
      start: { x: 0, y: 0 },
      joy: { cx: 0, cy: 0, dx: 0, dy: 0, active: false },
    }
    // Drag-to-pan camera state (retained for reference).
    this.pan = { x: 0, z: 0, targetX: 0, targetZ: 0 }
    this.targetY = 1.35
    this.autoRotate = false
    this.raycaster = new THREE.Raycaster()
    this.ndc = new THREE.Vector2()

    this.biomes = []
    this.resources = []
    this.resourceNodes = []
    this.resourceSpawnTimer = 0

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.touchAction = 'none'
    container.appendChild(this.renderer.domElement)

    const wrap = container.parentElement
    if (wrap) {
      this.crosshair = document.createElement('div')
      this.crosshair.className = 'crosshair'
      wrap.appendChild(this.crosshair)
      this.buildJoystick(wrap)
      this.hintEl = wrap.querySelector('.camera-hint')
      this.updateHint()
    }

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x0b1a1d, 0.028)
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
    this.camera.fov = this.fov
    this.camera.position.set(0, 1.6, 3.5)
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.set(0.25, 0, 0)
    this.camera.updateProjectionMatrix()

    this.hemi = new THREE.HemisphereLight(0x9ffff0, 0x14201f, 1.25)
    this.scene.add(this.hemi)
    this.sun = new THREE.DirectionalLight(0xffe9c4, 2.2)
    this.sun.position.set(7, 12, 6)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.left = -16
    this.sun.shadow.camera.right = 16
    this.sun.shadow.camera.top = 16
    this.sun.shadow.camera.bottom = -16
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 40
    this.sun.shadow.bias = -0.0009
    this.scene.add(this.sun)
    this.rim = new THREE.DirectionalLight(0x62ffd0, 0.9)
    this.rim.position.set(-8, 5, -7)
    this.scene.add(this.rim)
    this.arenaGlow = new THREE.PointLight(0xff8a5c, 0, 20, 2)
    this.arenaGlow.position.set(0, 3, 0)
    this.scene.add(this.arenaGlow)

    this.buildHabitat()
    this.buildArena()
    this.setMode('habitat', true)
    this.bindTouch()
    this.bindKeys()
    this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)
    window.addEventListener('resize', () => this.resize())

    this.clock = new THREE.Clock()
    this.raf = requestAnimationFrame(() => this.loop())
  }

  buildHabitat() {
    const g = new THREE.Group()
    this.habitat = g
    this.scene.add(g)

    g.add(skyMesh('#071426', '#1c4d4b', '#081416'))

    // Large navigable ground plane.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(60, 120),
      new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.95, metalness: 0 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    g.add(ground)

    const under = new THREE.Mesh(
      new THREE.CylinderGeometry(60.2, 60.8, 1.4, 120),
      new THREE.MeshStandardMaterial({ color: '#0d2124', roughness: 0.9, flatShading: true })
    )
    under.position.y = -0.71
    under.receiveShadow = true
    g.add(under)

    // Biome patches: circular regions with distinct ground color, flora & resources.
    const patchCount = 24
    for (let i = 0; i < patchCount; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 8 + Math.random() * 40
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const biome = biomeAt(x, z)
      this.biomes.push({ x, z, biome, radius: 6 + Math.random() * 8 })

      // Biome ground disc.
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(this.biomes[i].radius, 24),
        new THREE.MeshStandardMaterial({ color: biome.ground, roughness: 0.9, metalness: 0 })
      )
      disc.rotation.x = -Math.PI / 2
      disc.position.set(x, 0.02, z)
      g.add(disc)

      // Biome-appropriate flora.
      const floraCount = 3 + Math.floor(Math.random() * 4)
      for (let j = 0; j < floraCount; j++) {
        const fa = Math.random() * Math.PI * 2
        const fr = Math.random() * (this.biomes[i].radius * 0.8)
        const fx = x + Math.cos(fa) * fr
        const fz = z + Math.sin(fa) * fr
        if (biome.key === 'forest' || biome.key === 'jungle') {
          g.add(tree(fx, fz, 0.8 + Math.random() * 1.1, [biome.edge, biome.ground, '#123e40'][j % 3]))
        } else if (biome.key === 'desert') {
          g.add(crystal(fx, fz, 0.6 + Math.random() * 1, biome.color))
        } else if (biome.key === 'seacoast' || biome.key === 'sea') {
          g.add(mushroom(fx, fz, 0.5 + Math.random() * 0.8, biome.color))
        } else {
          g.add(tree(fx, fz, 0.6 + Math.random() * 0.8, [biome.edge, biome.ground, '#6b8e23'][j % 3]))
        }
      }

      // Resource nodes: creatures seek these to satisfy their needs.
      const resCount = 2 + Math.floor(Math.random() * 3)
      for (let j = 0; j < resCount; j++) {
        const ra = Math.random() * Math.PI * 2
        const rr = Math.random() * (this.biomes[i].radius * 0.7)
        const rx = x + Math.cos(ra) * rr
        const rz = z + Math.sin(ra) * rr
        const type = biome.resources[Math.floor(Math.random() * biome.resources.length)]
        this.addResourceNode(rx, rz, type, biome)
      }
    }

    // distant moon
    const moon = new THREE.Mesh(new THREE.SphereGeometry(3.2, 24, 16), new THREE.MeshBasicMaterial({ color: '#cfe9d3' }))
    moon.position.set(-22, 17, -34)
    g.add(moon)
    const moonGlow = new THREE.Mesh(new THREE.SphereGeometry(4.4, 20, 14), new THREE.MeshBasicMaterial({ color: '#6dffc9', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }))
    moonGlow.position.copy(moon.position)
    g.add(moonGlow)

    // floating islets
    for (let i = 0; i < 5; i++) {
      const isle = new THREE.Group()
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.6, 0),
        new THREE.MeshStandardMaterial({ color: '#1a3838', roughness: 0.9, flatShading: true })
      )
      rock.scale.y = 1.6
      isle.add(rock)
      const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: '#2b6b58', flatShading: true }))
      tuft.position.y = 0.5
      isle.add(tuft)
      const a = Math.random() * Math.PI * 2
      isle.position.set(Math.cos(a) * (8 + Math.random() * 6), 3.2 + Math.random() * 3.5, Math.sin(a) * (8 + Math.random() * 6))
      isle.userData.baseY = isle.position.y
      isle.userData.phase = Math.random() * 10
      g.add(isle)
      if (!this.isles) this.isles = []
      this.isles.push(isle)
    }

    this.spores = sporeField(180, '#9dffd7', 55, 5.5, 0.075)
    g.add(this.spores)
    this.fireflies = sporeField(60, '#ffd27a', 45, 3.2, 0.12)
    g.add(this.fireflies)

    this.selectionRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.028, 6, 64),
      new THREE.MeshBasicMaterial({ color: '#d8ff5f' })
    )
    this.selectionRing.rotation.x = -Math.PI / 2
    this.selectionRing.position.y = 0.03
    this.selectionRing.visible = false
    g.add(this.selectionRing)
  }

  addResourceNode(x, z, type, biome) {
    const g = new THREE.Group()
    g.position.set(x, 0.05, z)
    let mesh, color
    switch (type) {
      case 'fruit': color = 0xff6b6b; mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color })); break
      case 'nectar': color = 0x4ade80; mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), new THREE.MeshBasicMaterial({ color })); break
      case 'insect': color = 0xf59e0b; mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color })); break
      case 'cactus': color = 0x22c55e; mesh = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), new THREE.MeshBasicMaterial({ color })); break
      case 'water': color = 0x0ea5e9; mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color })); break
      case 'fish': color = 0x0891b2; mesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color })); break
      case 'kelp': color = 0x10b981; mesh = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 6), new THREE.MeshBasicMaterial({ color })); break
      case 'grass': color = 0x84cc16; mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color })); break
      case 'seed': color = 0xd97706; mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 1), new THREE.MeshBasicMaterial({ color })); break
      default: color = 0xffffff; mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color }))
    }
    mesh.castShadow = false
    g.add(mesh)
    const node = { x, z, type, amount: 1, mesh: g, biome, t: 0 }
    this.resourceNodes.push(node)
    this.habitat.add(g)
    return node
  }

  getBiomeAt(x, z) {
    return biomeAt(x, z)
  }

  findNearestResource(x, z, type) {
    let best = null, bestDist = 1e9
    for (const node of this.resourceNodes) {
      if (node.type !== type || node.amount <= 0) continue
      const d = Math.hypot(node.x - x, node.z - z)
      if (d < bestDist) { bestDist = d; best = node }
    }
    return best
  }

  consumeResource(node) {
    if (node.amount <= 0) return
    node.amount -= 1
    if (node.amount <= 0) {
      node.mesh.visible = false
      // Respawn after a delay in the same biome.
      setTimeout(() => {
        if (node.amount <= 0) { node.amount = 1; node.mesh.visible = true }
      }, 12000 + Math.random() * 8000)
    }
  }

  buildArena() {
    const g = new THREE.Group()
    this.arena = g
    g.visible = false
    this.scene.add(g)

    g.add(skyMesh('#120b1c', '#4a2238', '#100a14'))

    const groundTex = groundTexture('arena')
    const arena = new THREE.Mesh(
      new THREE.CylinderGeometry(11, 11.8, 1.1, 64),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.9, metalness: 0.05 })
    )
    arena.position.y = -0.56
    arena.receiveShadow = true
    g.add(arena)

    const rim = new THREE.Mesh(new THREE.TorusGeometry(10.9, 0.09, 8, 120), new THREE.MeshBasicMaterial({ color: '#ff8a5c' }))
    rim.rotation.x = -Math.PI / 2
    rim.position.y = 0.02
    g.add(rim)

    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      const r = 10.2
      const pillar = new THREE.Group()
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.4, 6), new THREE.MeshStandardMaterial({ color: '#2a2130', roughness: 0.9, flatShading: true }))
      base.position.y = 0.2
      pillar.add(base)
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 2.2, 6), new THREE.MeshStandardMaterial({ color: '#3a2e40', roughness: 0.8, flatShading: true }))
      shaft.position.y = 1.4
      shaft.castShadow = true
      pillar.add(shaft)
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffb46b' : '#ff5e8a' }))
      orb.position.y = 2.7
      pillar.add(orb)
      pillar.position.set(Math.cos(a) * r, 0, Math.sin(a) * r)
      g.add(pillar)
      pillar.userData.orb = orb
    }

    const beams = new THREE.Group()
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.5, 14, 6, 1, true),
        new THREE.MeshBasicMaterial({ color: i % 2 ? '#ff7a5c' : '#ffae6b', transparent: true, opacity: 0.055, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      )
      beam.position.set(Math.cos(a) * 7, 6.9, Math.sin(a) * 7)
      beams.add(beam)
    }
    g.add(beams)
    this.arenaBeams = beams

    this.embers = sporeField(120, '#ff9a6b', 10, 5.5, 0.08)
    g.add(this.embers)
    const dust = sporeField(60, '#ffd7a8', 11, 2.4, 0.05)
    g.add(dust)

    this.p1Ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.03, 6, 48), new THREE.MeshBasicMaterial({ color: '#b9ff68' }))
    this.p1Ring.rotation.x = -Math.PI / 2
    this.p1Ring.position.set(-3.4, 0.035, 0)
    g.add(this.p1Ring)
    this.p2Ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.03, 6, 48), new THREE.MeshBasicMaterial({ color: '#ff6b8a' }))
    this.p2Ring.rotation.x = -Math.PI / 2
    this.p2Ring.position.set(3.4, 0.035, 0)
    g.add(this.p2Ring)
  }

  setMode(mode, instant = false) {
    this.mode = mode
    this.autoRotate = mode === 'habitat'
    if (mode === 'habitat') {
      this.habitat.visible = true
      this.arena.visible = false
      this.scene.fog.color.set(0x0b1a1d)
      this.scene.fog.density = 0.026
      this.sun.color.set(0xffe9c4)
      this.sun.intensity = 2.2
      this.rim.color.set(0x62ffd0)
      this.rim.intensity = 0.9
      this.hemi.color.set(0x9ffff0)
      this.hemi.intensity = 1.25
      this.arenaGlow.intensity = 0
      this.pan.targetX = 0
      this.pan.targetZ = 0
    } else {
      this.habitat.visible = false
      this.arena.visible = true
      this.scene.fog.color.set(0x180e16)
      this.scene.fog.density = 0.022
      this.sun.color.set(0xffc9a0)
      this.sun.intensity = 1.7
      this.rim.color.set(0xff7a8a)
      this.rim.intensity = 1.3
      this.hemi.color.set(0xffbfa0)
      this.hemi.intensity = 0.65
      this.arenaGlow.intensity = 22
      this.orbit = { yaw: 0, pitch: 0.2, radius: 11.6, targetY: 1.55 }
      this.bindCamera = { yaw: 0, pitch: 0.2, radius: 11.6 }
    }
    this.selectionRing.visible = false
    if (mode === 'habitat') this.refreshSelectionRing()
  }

  setSelected(id) {
    this.selectedId = id
    this.refreshSelectionRing()
  }

  refreshSelectionRing() {
    const entry = this.creatures.get(this.selectedId)
    if (!entry || this.mode !== 'habitat') { this.selectionRing.visible = false; return }
    this.selectionRing.visible = true
    this.selectionRing.position.x = entry.root.position.x
    this.selectionRing.position.z = entry.root.position.z
  }

  addCreature(data, opts = {}) {
    const existing = this.creatures.get(data.id)
    if (existing) {
      this.removeCreature(data.id)
    }
    const root = buildCreature(data.genome)
    const scale = opts.scale ?? (0.9 + (data.genome.size[0] + data.genome.size[1]) * 0.09)
    root.scale.setScalar(scale)
    const pos = opts.position ?? [0, 0, 0]
    root.position.set(pos[0], 0, pos[2])
    root.rotation.y = opts.rotation ?? Math.random() * Math.PI * 2
    root.userData.creatureId = data.id
    this.habitat.add(root)
    const entry = {
      id: data.id, root, data,
      target: new THREE.Vector3(pos[0], 0, pos[2]),
      pause: Math.random() * 3,
      moving: 0,
      speed: 0.45 + Math.random() * 0.3,
      arena: false,
      phase: Math.random() * 10,
      portrait: Math.random() < 0.5,
    }
    this.creatures.set(data.id, entry)
    return entry
  }

  removeCreature(id) {
    const entry = this.creatures.get(id)
    if (!entry) return
    entry.root.parent?.remove(entry.root)
    entry.root.userData.dispose?.()
    this.creatures.delete(id)
    if (this.selectedId === id) {
      this.selectedId = null
      this.selectionRing.visible = false
    }
  }

  clearCreatures() {
    for (const id of [...this.creatures.keys()]) this.removeCreature(id)
  }

  setWander(ids) {
    // put habitat creatures back into free roam
    for (const [id, entry] of this.creatures) {
      if (this.habitat.children.includes(entry.root)) {
        entry.arena = false
        entry.target.set((Math.random() - 0.5) * 7, 0, (Math.random() - 0.5) * 7)
      }
    }
    if (ids) this.roamingIds = new Set(ids)
    this.refreshSelectionRing()
  }

  disposeFighters() {
    if (!this.fighters) return
    this.fighters.player.userData.dispose()
    this.fighters.foe.userData.dispose()
    this.fighters = null
  }

  enterArena(player, foe) {
    this.disposeFighters()
    this.setMode('arena')
    this.clearCreatures()
    const pA = buildCreature(player.genome)
    const pB = buildCreature(foe.genome)
    pA.scale.setScalar(1.18 * (0.86 + (player.genome.size[0] + player.genome.size[1]) * 0.08))
    pB.scale.setScalar(1.18 * (0.86 + (foe.genome.size[0] + foe.genome.size[1]) * 0.08))
    pA.position.set(-3.3, 0, 0.4)
    pB.position.set(3.3, 0, 0.4)
    pA.rotation.y = Math.PI / 2 + 0.1
    pB.rotation.y = -Math.PI / 2 - 0.1
    pA.userData.creatureId = player.id
    pB.userData.creatureId = foe.id
    this.arena.add(pA, pB)
    this.fighters = { player: pA, foe: pB }
    this.playerStart = pA.position.clone()
    this.foeStart = pB.position.clone()
  }

  exitArena() {
    this.disposeFighters()
    this.clearCreatures()
    this.setMode('habitat')
    this.setWander()
  }

  battleLunge(who, cb) {
    if (!this.fighters) return
    const mesh = who === 'player' ? this.fighters.player : this.fighters.foe
    const start = who === 'player' ? this.playerStart : this.foeStart
    const dir = who === 'player' ? 1.6 : -1.6
    const t0 = performance.now()
    const dur = 320
    const tick = () => {
      const k = (performance.now() - t0) / dur
      if (k >= 1) { mesh.position.x = start.x; if (cb) cb(); return }
      const e = Math.sin(Math.min(1, k) * Math.PI)
      mesh.position.x = start.x + dir * e
      mesh.position.z = start.z - (who === 'player' ? 0.8 : 0.8) * e
      requestAnimationFrame(tick)
    }
    tick()
  }

  hitReact(who, done) {
    if (!this.fighters) { done?.(); return }
    const mesh = who === 'player' ? this.fighters.player : this.fighters.foe
    mesh.userData.flash?.('#ff7a6b', 0.22)
    this.shake(0.22)
    const start = mesh.position.clone()
    const t0 = performance.now()
    const tick = () => {
      if (this.fighters?.[who] !== mesh) return
      const k = (performance.now() - t0) / 300
      if (k >= 1) { mesh.position.copy(start); done?.(); return }
      const e = Math.sin(Math.min(1, k) * Math.PI) * 0.24
      mesh.position.x = start.x + (who === 'player' ? -e : e)
      requestAnimationFrame(tick)
    }
    tick()
    this.burst({ x: mesh.position.x, y: 1.05, z: mesh.position.z }, who === 'player' ? '#ff7a6b' : '#ffd27a', 26)
  }

  faint(who) {
    if (!this.fighters) return
    const mesh = who === 'player' ? this.fighters.player : this.fighters.foe
    const start = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z, rotation: mesh.rotation.z }
    const direction = who === 'player' ? 1 : -1
    const t0 = performance.now()
    const tick = () => {
      if (this.fighters?.[who] !== mesh) return
      const k = clamp((performance.now() - t0) / 700, 0, 1)
      const ease = 1 - (1 - k) ** 3
      mesh.rotation.z = start.rotation + direction * ease * 1.12
      mesh.position.x = start.x + direction * ease * 0.18
      mesh.position.y = start.y - ease * 0.3
      if (k < 1) requestAnimationFrame(tick)
    }
    this.burst({ x: start.x, y: 1.05, z: start.z }, '#ffd27a', 30)
    tick()
  }

  burst(pos, color = '#ffffff', count = 24) {
    if (!this.bursts) {
      const geo = new THREE.BufferGeometry()
      const max = 600
      const positions = new Float32Array(max * 3)
      const colors = new Float32Array(max * 3)
      positions.fill(9999)
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      const material = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })
      this.burstPoints = new THREE.Points(geo, material)
      this.burstPoints.frustumCulled = false
      this.scene.add(this.burstPoints)
      this.burstState = { next: 0, max, life: new Float32Array(max), vel: new Float32Array(max * 3), color: new Float32Array(max * 3) }
    }
    const st = this.burstState
    const c = new THREE.Color(color)
    for (let i = 0; i < count; i++) {
      const idx = st.next
      st.next = (st.next + 1) % st.max
      st.life[idx] = 0.6 + Math.random() * 0.5
      st.vel[idx * 3] = (Math.random() - 0.5) * 3.4
      st.vel[idx * 3 + 1] = Math.random() * 3.2 + 0.4
      st.vel[idx * 3 + 2] = (Math.random() - 0.5) * 2.6
      const pos3 = this.burstPoints.geometry.attributes.position.array
      pos3[idx * 3] = pos.x + (Math.random() - 0.5) * 0.3
      pos3[idx * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.3
      pos3[idx * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.3
      const col = this.burstPoints.geometry.attributes.color.array
      col[idx * 3] = c.r; col[idx * 3 + 1] = c.g; col[idx * 3 + 2] = c.b
    }
    this.burstPoints.geometry.attributes.position.needsUpdate = true
    this.burstPoints.geometry.attributes.color.needsUpdate = true
  }

  shake(amount) {
    this.shakeAmt = Math.min(0.5, this.shakeAmt + amount)
  }

  buildJoystick(wrap) {
    const base = document.createElement('div')
    const stick = document.createElement('div')
    base.appendChild(stick)
    wrap.appendChild(base)
    Object.assign(base.style, {
      position: 'absolute', left: '16px', bottom: '18px',
      width: '92px', height: '92px', borderRadius: '50%',
      background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.22)',
      pointerEvents: 'none', zIndex: '6',
      filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.45))',
    })
    Object.assign(stick.style, {
      position: 'absolute', left: '50%', top: '50%', width: '52px', height: '52px',
      borderRadius: '50%', background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.55)',
      transform: 'translate(-50%,-50%)',
      filter: 'drop-shadow(0 0 6px rgba(216,255,95,0.35))',
    })
    this.joyBase = base
    this.joyStick = stick
  }

  bindTouch() {
    const el = this.renderer.domElement
    const sens = 0.0026
    const joyZone = 0.34
    let activeId = null
    let lookStart = { x: 0, y: 0 }
    let lookMoved = 0
    let touchStartTime = 0
    let joyAnchor = { x: 0, y: 0 }

    const start = (x, y, id) => {
      activeId = id
      touchStartTime = performance.now()
      this.touch.start = { x, y }
      lookMoved = 0
      const isJoy = x < el.clientWidth * joyZone
      this.touch.mode = isJoy ? 'joystick' : 'look'
      if (isJoy) {
        joyAnchor = { x, y }
        this.touch.joy.active = true
        this.touch.joy.dx = 0
        this.touch.joy.dy = 0
        this.updateJoystickVisual(x, y)
      } else {
        lookStart = { x, y }
      }
    }

    const move = (x, y) => {
      if (this.touch.mode === 'joystick') {
        const dx = (x - joyAnchor.x) / el.clientWidth
        const dy = (y - joyAnchor.y) / el.clientHeight
        const len = Math.hypot(dx, dy)
        const cap = 0.30
        const k = len > cap ? cap / len : 1
        this.touch.joy.dx = dx * k
        this.touch.joy.dy = dy * k
        this.updateJoystickVisual(joyAnchor.x + dx * k * el.clientWidth, joyAnchor.y + dy * k * el.clientHeight)
      } else {
        lookMoved += Math.abs(x - lookStart.x) + Math.abs(y - lookStart.y)
        this.player.yaw += (x - lookStart.x) * sens
        this.player.pitch -= (y - lookStart.y) * sens
        this.player.pitch = Math.max(-1.4, Math.min(1.4, this.player.pitch))
        lookStart = { x, y }
      }
    }

    const end = (id) => {
      if (id !== activeId) return
      if (this.touch.mode === 'look' && lookMoved < 14 && performance.now() - touchStartTime < 260) {
        this.pickCenter()
      }
      if (this.touch.mode === 'joystick') {
        this.touch.joy.active = false
        this.touch.joy.dx = 0
        this.touch.joy.dy = 0
        this.updateJoystickVisual(joyAnchor.x, joyAnchor.y)
      }
      activeId = null
      this.touch.mode = null
    }

    el.addEventListener('touchstart', e => {
      e.preventDefault()
      for (const t of e.changedTouches) start(t.clientX, t.clientY, t.identifier)
    }, { passive: false })
    el.addEventListener('touchmove', e => {
      e.preventDefault()
      for (const t of e.changedTouches) move(t.clientX, t.clientY)
    }, { passive: false })
    el.addEventListener('touchend', e => {
      for (const t of e.changedTouches) end(t.identifier)
    })
    el.addEventListener('touchcancel', e => {
      for (const t of e.changedTouches) end(t.identifier)
    })
    el.addEventListener('wheel', e => {
      e.preventDefault()
      this.camera.fov = Math.max(30, Math.min(90, this.camera.fov - e.deltaY * 0.05))
      this.camera.updateProjectionMatrix()
    }, { passive: false })
  }

  updateJoystickVisual(cx, cy) {
    if (!this.joyBase || !this.joyStick) return
    this.joyBase.style.left = `${Math.round(cx - 46)}px`
    this.joyBase.style.top = `${Math.round(cy - 46)}px`
    this.joyBase.style.bottom = 'auto'
    this.joyStick.style.left = '50%'
    this.joyStick.style.top = '50%'
  }

  bindKeys() {
    const down = e => {
      const k = e.code
      if (k === 'KeyW') this.player.keys.w = true
      else if (k === 'KeyS') this.player.keys.s = true
      else if (k === 'KeyA') this.player.keys.a = true
      else if (k === 'KeyD') this.player.keys.d = true
    }
    const up = e => {
      const k = e.code
      if (k === 'KeyW') this.player.keys.w = false
      else if (k === 'KeyS') this.player.keys.s = false
      else if (k === 'KeyA') this.player.keys.a = false
      else if (k === 'KeyD') this.player.keys.d = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
  }

  updatePlayer(dt) {
    const p = this.player
    const j = this.touch.joy
    const yaw = p.yaw
    const fx = Math.sin(yaw), fz = -Math.cos(yaw)
    const rx = Math.cos(yaw), rz = Math.sin(yaw)
    let mx = 0, mz = 0
    const add = (ax, az) => { mx += ax; mz += az }
    if (p.keys.w) add(fx, fz)
    if (p.keys.s) add(-fx, -fz)
    if (p.keys.d) add(rx, rz)
    if (p.keys.a) add(-rx, -rz)
    if (j.active) {
      // Screen-space joystick: up = forward, down = back, right = strafe right.
      add(-j.dy * fx + j.dx * rx, -j.dy * fz + j.dx * rz)
    }
    const len = Math.hypot(mx, mz)
    if (len > 0) {
      const strength = Math.min(len, 1)
      const spd = p.speed * dt * strength
      mx = (mx / len) * spd
      mz = (mz / len) * spd
      const nx = p.x + mx, nz = p.z + mz
      if (Math.hypot(nx, nz) < 55) { p.x = nx; p.z = nz }
      p.bob = Math.min(1, p.bob + dt * 4)
    } else {
      p.bob = Math.max(0, p.bob - dt * 2)
    }
    p.y = 1.6 + Math.sin(this.time * 12) * p.bob * 0.04
  }

  updateHint() {
    if (!this.hintEl) return
    this.hintEl.innerHTML = 'DRAG RIGHT SIDE TO LOOK <b>·</b> LEFT JOYSTICK TO WALK <b>·</b> TAP CREATURE TO INSPECT'
  }

  pickCenter() {
    if (this.mode !== 'habitat') return
    this.ndc.set(0, 0)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const hits = this.raycaster.intersectObjects(this.habitat.children, true)
    for (const hit of hits) {
      let o = hit.object
      while (o && !o.userData.creatureId) o = o.parent
      if (o?.userData.creatureId) {
        this.hooks.onSelect?.(o.userData.creatureId)
        return
      }
    }
    this.hooks.onBackground?.()
  }

  pickAt(clientX, clientY) {
    if (this.mode !== 'habitat') return
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const hits = this.raycaster.intersectObjects(this.habitat.children, true)
    for (const hit of hits) {
      let o = hit.object
      while (o && !o.userData.creatureId) o = o.parent
      if (o?.userData.creatureId) {
        this.hooks.onSelect?.(o.userData.creatureId)
        return
      }
    }
    this.hooks.onBackground?.()
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth
    const h = this.container.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  loop() {
    this.raf = requestAnimationFrame(() => this.loop())
    const dt = Math.min(0.05, this.clock.getDelta())
    this.time += dt

    if (this.mode === 'habitat') {
      this.updateHabitat(dt)
    } else {
      this.updateArena(dt)
    }

    this.updateParticles(dt)

    if (this.mode === 'habitat') {
      this.updatePlayer(dt)
      const p = this.player
      this.camera.position.set(p.x, p.y, p.z)
      this.camera.rotation.order = 'YXZ'
      this.camera.rotation.set(-p.pitch, p.yaw, 0)
    } else {
      const orbit = this.orbit
      if (this.autoRotate && this.mode === 'habitat') {
        this.orbitYaw = (this.orbitYaw ?? orbit.yaw) + dt * 0.028
        orbit.yaw = this.orbitYaw
      }
      const target = new THREE.Vector3(0, orbit.targetY, 0)
      const dist = orbit.radius
      const camX = Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * dist
      const camZ = Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * dist
      const camY = orbit.targetY + Math.sin(orbit.pitch) * dist + 0.4
      this.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.08)
      this.camera.lookAt(target)
    }
    if (this.shakeAmt > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt
      this.shakeAmt *= 0.9
    }

    // slow toggling details
    if (this.isles) for (const isle of this.isles) {
      isle.position.y = isle.userData.baseY + Math.sin(this.time * 0.5 + isle.userData.phase) * 0.25
      isle.rotation.y += dt * 0.05
    }
    if (this.arena.visible && this.arenaBeams) this.arenaBeams.rotation.y += dt * 0.03
    if (this.p1Ring) {
      const pulse = 1 + Math.sin(this.time * 2.4) * 0.07
      this.p1Ring.scale.setScalar(pulse)
      this.p2Ring.scale.setScalar(1 + Math.sin(this.time * 2.4 + 1.6) * 0.07)
    }

    this.renderer.render(this.scene, this.camera)
  }

  updateHabitat(dt) {
    const list = [...this.creatures.values()]
    for (const entry of list) {
      if (!this.habitat.children.includes(entry.root)) continue
      const c = entry.data
      const needs = c.needs
      const p = phenotype(c.genome)
      const pos = entry.root.position

      // Automatic survival AI: creatures roam to satisfy their needs.
      // Needs decay is handled in app.js gameLoop; here creatures act on them.
      const hungry = needs.hunger < 45
      const tired = needs.energy < 35
      const needFun = needs.fun < 35
      let moving = 0
      let goalReached = false

      // Decide current goal based on the most pressing need.
      let goal = null
      if (hungry) {
        const foodType = p.mammifere > 0.5 ? 'fruit' : p.reptile > 0.5 ? 'insect' : 'fruit'
        goal = this.findNearestResource(pos.x, pos.z, foodType) || this.findNearestResource(pos.x, pos.z, 'nectar')
      } else if (tired) {
        // Rest where you are: recover energy, pause movement.
        entry.pause = Math.max(entry.pause, dt)
        needs.energy = Math.min(100, needs.energy + 12 * dt)
        needs.hunger = Math.max(0, needs.hunger - 6 * dt)
      } else if (needFun) {
        // Roam toward any resource for enrichment.
        goal = this.findNearestResource(pos.x, pos.z, null)
      }

      if (goal) {
        const dx = goal.x - pos.x
        const dz = goal.z - pos.z
        const dist = Math.hypot(dx, dz)
        if (dist < 0.9) {
          // Consume the resource.
          goalReached = true
          if (goal.type === 'fruit' || goal.type === 'insect' || goal.type === 'cactus' || goal.type === 'fish' || goal.type === 'grass') {
            needs.hunger = Math.min(100, needs.hunger + 28)
            needs.fun = Math.min(100, needs.fun + 12)
          } else if (goal.type === 'nectar' || goal.type === 'water' || goal.type === 'kelp' || goal.type === 'seed') {
            needs.fun = Math.min(100, needs.fun + 18)
            needs.hunger = Math.min(100, needs.hunger + 10)
          }
          this.consumeResource(goal)
          entry.pause = 2
        } else {
          moving = 1
          const step = Math.min(dist, (entry.speed + p.speed * 0.5) * dt)
          pos.x += (dx / dist) * step
          pos.z += (dz / dist) * step
          const want = Math.atan2(dx, dz)
          let diff = want - entry.root.rotation.y
          while (diff > Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          entry.root.rotation.y += diff * Math.min(1, dt * 4)
        }
      } else if (!tired) {
        // Free-roam wander when no pressing need.
        entry.pause -= dt
        if (entry.pause <= 0) {
          entry.pause = 2 + Math.random() * 5
          const a = Math.random() * Math.PI * 2
          const r = 1.5 + Math.random() * 4.8
          entry.target.set(Math.cos(a) * r, 0, Math.sin(a) * r)
        } else {
          const dx = entry.target.x - pos.x
          const dz = entry.target.z - pos.z
          const dist = Math.hypot(dx, dz)
          if (dist > 0.25) {
            moving = 1
            const step = Math.min(dist, entry.speed * dt)
            pos.x += (dx / dist) * step
            pos.z += (dz / dist) * step
            const want = Math.atan2(dx, dz)
            let diff = want - entry.root.rotation.y
            while (diff > Math.PI) diff -= Math.PI * 2
            while (diff < -Math.PI) diff += Math.PI * 2
            entry.root.rotation.y += diff * Math.min(1, dt * 4)
          }
        }
      }

      // Gentle avoidance of the player.
      const pdx = pos.x - this.player.x, pdz = pos.z - this.player.z
      const pd = Math.hypot(pdx, pdz)
      if (pd > 0 && pd < 4) {
        const repel = ((4 - pd) / 4) * entry.speed * dt * 1.5
        pos.x += (pdx / pd) * repel
        pos.z += (pdz / pd) * repel
      }

      entry.moving += (moving - entry.moving) * Math.min(1, dt * 5)
      entry.root.userData.update?.(dt, entry.moving)

      if (this.selectedId === entry.id) {
        this.selectionRing.position.x = pos.x
        this.selectionRing.position.z = pos.z
        this.selectionRing.scale.setScalar(1 + Math.sin(this.time * 3) * 0.06)
      }
    }
    // Biome tag under the player's feet.
    const pb = this.getBiomeAt(this.player.x, this.player.z)
    if (this.hooks.onBiome) this.hooks.onBiome(pb)

    // spore drift
    this.driftField(this.spores, dt, 0.25)
    this.driftField(this.fireflies, dt, 0.6)
  }

  updateArena(dt) {
    if (!this.fighters) return
    this.fighters.player.userData.update?.(dt, 0)
    this.fighters.foe.userData.update?.(dt, 0)
    this.driftField(this.embers, dt, 0.55)
  }

  driftField(points, dt, speed) {
    if (!points) return
    const arr = points.geometry.attributes.position.array
    const seeds = points.userData.seeds
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]
      arr[i * 3 + 1] += s.speed * dt * speed
      arr[i * 3] += Math.sin(this.time * 0.5 + s.phase) * dt * 0.12
      arr[i * 3 + 2] += Math.cos(this.time * 0.4 + s.phase) * dt * 0.1
      if (arr[i * 3 + 1] > 5.8) arr[i * 3 + 1] = 0.1
    }
    points.geometry.attributes.position.needsUpdate = true
  }

  updateParticles(dt) {
    if (!this.burstPoints) return
    const st = this.burstState
    const pos = this.burstPoints.geometry.attributes.position.array
    for (let i = 0; i < st.max; i++) {
      if (st.life[i] <= 0) continue
      st.life[i] -= dt
      if (st.life[i] <= 0) { pos[i * 3] = 9999; continue }
      st.vel[i * 3 + 1] -= 6 * dt
      pos[i * 3] += st.vel[i * 3] * dt
      pos[i * 3 + 1] += st.vel[i * 3 + 1] * dt
      pos[i * 3 + 2] += st.vel[i * 3 + 2] * dt
    }
    this.burstPoints.geometry.attributes.position.needsUpdate = true
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.clearCreatures()
    this.renderer.dispose()
    this.container.innerHTML = ''
  }
}
