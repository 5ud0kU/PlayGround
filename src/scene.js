import * as THREE from 'three'
import { buildCreature } from './creature.js'

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
    this.orbit = { yaw: 0.55, pitch: 0.34, radius: 10.5, targetY: 1.35 }
    this.autoRotate = true
    this.bindCamera = { yaw: 0, pitch: 0, radius: 11 }
    this.raycaster = new THREE.Raycaster()
    this.ndc = new THREE.Vector2()

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

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x0b1a1d, 0.028)
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)
    this.camera.position.set(6, 4, 8)

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
    this.bindPointer()
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

    const groundTex = groundTexture('habitat')
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(15, 72),
      new THREE.MeshStandardMaterial({ map: groundTex, color: 0xffffff, roughness: 0.95, metalness: 0 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    g.add(ground)

    const under = new THREE.Mesh(
      new THREE.CylinderGeometry(15.2, 15.8, 1.4, 72),
      new THREE.MeshStandardMaterial({ color: '#0d2124', roughness: 0.9, flatShading: true })
    )
    under.position.y = -0.71
    under.receiveShadow = true
    g.add(under)

    // luminous rim
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(14.6, 0.035, 6, 120),
      new THREE.MeshBasicMaterial({ color: '#67ffc8' })
    )
    rim.rotation.x = -Math.PI / 2
    rim.position.y = 0.02
    g.add(rim)

    // distant moon
    const moon = new THREE.Mesh(new THREE.SphereGeometry(3.2, 24, 16), new THREE.MeshBasicMaterial({ color: '#cfe9d3' }))
    moon.position.set(-22, 17, -34)
    g.add(moon)
    const moonGlow = new THREE.Mesh(new THREE.SphereGeometry(4.4, 20, 14), new THREE.MeshBasicMaterial({ color: '#6dffc9', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }))
    moonGlow.position.copy(moon.position)
    g.add(moonGlow)

    for (let i = 0; i < 26; i++) {
      const a = -0.2 + Math.random() * Math.PI * 1.4
      const r = 11 + Math.random() * 9
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (Math.abs(x) < 11 && z > -14) {
        if (Math.random() < 0.55) g.add(tree(x, z, 0.8 + Math.random() * 1.1, ['#174a44', '#1c5b4e', '#123e40'][i % 3]))
        else g.add(crystal(x, z, 0.8 + Math.random() * 1.4, ['#7dffd0', '#9a8cff', '#ffd27a'][i % 3]))
      }
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 3.6 + Math.random() * 9.4
      g.add(mushroom(Math.cos(a) * r, Math.sin(a) * r, 0.6 + Math.random() * 1.2, ['#8dffbe', '#ffb3d9', '#9ad7ff', '#ffe28a'][i % 4]))
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 3.2 + Math.random() * 10
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.18 + Math.random() * 0.5, 0),
        new THREE.MeshStandardMaterial({ color: '#24413e', roughness: 0.95, flatShading: true })
      )
      rock.position.set(Math.cos(a) * r, 0.14, Math.sin(a) * r)
      rock.rotation.set(Math.random(), Math.random(), Math.random())
      rock.castShadow = true
      g.add(rock)
    }

    // central ceremonial rings
    for (const [r, op] of [[3.1, 0.3], [5.4, 0.16], [8.1, 0.1]]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.025, r + 0.025, 96),
        new THREE.MeshBasicMaterial({ color: '#64ffc4', transparent: true, opacity: op, side: THREE.DoubleSide })
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.025
      g.add(ring)
    }

    this.spores = sporeField(180, '#9dffd7', 15, 5.5, 0.075)
    g.add(this.spores)
    this.fireflies = sporeField(60, '#ffd27a', 11, 3.2, 0.12)
    g.add(this.fireflies)

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

    this.selectionRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.028, 6, 64),
      new THREE.MeshBasicMaterial({ color: '#d8ff5f' })
    )
    this.selectionRing.rotation.x = -Math.PI / 2
    this.selectionRing.position.y = 0.03
    this.selectionRing.visible = false
    g.add(this.selectionRing)
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
      this.orbit = { yaw: 0.55, pitch: 0.34, radius: 10.5, targetY: 1.35 }
      if (!instant) this.orbit.yaw = this.orbitYaw ?? 0.55
      this.bindCamera = { yaw: this.orbit.yaw, pitch: this.orbit.pitch, radius: this.orbit.radius }
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

  enterArena(player, foe) {
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
    if (this.fighters) {
      this.fighters.player.userData.dispose()
      this.fighters.foe.userData.dispose()
      this.fighters = null
    }
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

  bindPointer() {
    const el = this.renderer.domElement
    const down = e => {
      this.pointer.down = true
      this.pointer.moved = 0
      this.pointer.x = e.clientX
      this.pointer.y = e.clientY
      this.pointer.lx = e.clientX
      this.pointer.ly = e.clientY
      this.autoRotate = false
      el.setPointerCapture?.(e.pointerId)
    }
    const move = e => {
      if (!this.pointer.down) return
      const dx = e.clientX - this.pointer.lx
      const dy = e.clientY - this.pointer.ly
      this.pointer.moved += Math.abs(dx) + Math.abs(dy)
      this.pointer.lx = e.clientX
      this.pointer.ly = e.clientY
      this.orbit.yaw -= dx * 0.006
      this.orbit.pitch = clamp(this.orbit.pitch + dy * 0.004, 0.02, 0.95)
    }
    const up = e => {
      if (!this.pointer.down) return
      this.pointer.down = false
      if (this.pointer.moved < 8) this.pickAt(e.clientX, e.clientY)
      if (this.mode === 'habitat') this.autoRotate = true
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', () => { this.pointer.down = false })
    el.addEventListener('wheel', e => {
      e.preventDefault()
      this.orbit.radius = clamp(this.orbit.radius + e.deltaY * 0.006, 6.5, 15)
    }, { passive: false })
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
    if (this.shakeAmt > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt
      this.shakeAmt *= 0.9
    }
    this.camera.lookAt(target)

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
      entry.pause -= dt
      const dx = entry.target.x - entry.root.position.x
      const dz = entry.target.z - entry.root.position.z
      const dist = Math.hypot(dx, dz)
      let moving = 0
      if (entry.pause <= 0) {
        if (dist < 0.25) {
          entry.pause = 2 + Math.random() * 5
          const a = Math.random() * Math.PI * 2
          const r = 1.5 + Math.random() * 4.8
          entry.target.set(Math.cos(a) * r, 0, Math.sin(a) * r)
        } else {
          moving = 1
          const step = Math.min(dist, entry.speed * dt)
          entry.root.position.x += (dx / dist) * step
          entry.root.position.z += (dz / dist) * step
          const want = Math.atan2(dx, dz)
          let diff = want - entry.root.rotation.y
          while (diff > Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          entry.root.rotation.y += diff * Math.min(1, dt * 4)
        }
      }
      entry.moving += (moving - entry.moving) * Math.min(1, dt * 5)
      entry.root.userData.update?.(dt, entry.moving)
      if (this.selectedId === entry.id) {
        this.selectionRing.position.x = entry.root.position.x
        this.selectionRing.position.z = entry.root.position.z
        this.selectionRing.scale.setScalar(1 + Math.sin(this.time * 3) * 0.06)
      }
    }
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
