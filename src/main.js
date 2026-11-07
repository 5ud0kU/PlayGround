import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const canvas = document.querySelector('#scene')
const viewer = document.querySelector('.viewer')
const loading = document.querySelector('#loading')
const hint = document.querySelector('#drag-hint')
const DURATION = 2.5

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7))
renderer.setSize(viewer.clientWidth, viewer.clientHeight, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.12
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(32, viewer.clientWidth / viewer.clientHeight, 0.1, 50)
const cameraTarget = new THREE.Vector3(0, 0.9, 0)
let radius = 3.65
let azimuth = 0
let polar = Math.PI / 2
const initialRadius = radius

scene.add(new THREE.HemisphereLight(0xfff8ee, 0x7d7770, 2.0))
const keyLight = new THREE.DirectionalLight(0xffe6d1, 3.1)
keyLight.position.set(-2.8, 4.8, 3.7)
keyLight.castShadow = true
keyLight.shadow.mapSize.set(1024, 1024)
keyLight.shadow.camera.near = 0.1
keyLight.shadow.camera.far = 10
keyLight.shadow.camera.left = -2.4
keyLight.shadow.camera.right = 2.4
keyLight.shadow.camera.top = 3.2
keyLight.shadow.camera.bottom = -0.5
keyLight.shadow.bias = -0.00025
keyLight.shadow.normalBias = 0.025
scene.add(keyLight)
const fillLight = new THREE.DirectionalLight(0xd6e0ff, 1.25)
fillLight.position.set(3.2, 2.4, -3.4)
scene.add(fillLight)
const frontLight = new THREE.DirectionalLight(0xfff5e8, 0.85)
frontLight.position.set(0.5, 1.5, 4)
scene.add(frontLight)

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.ShadowMaterial({ color: 0x51483e, opacity: 0.17 }),
)
floor.rotation.x = -Math.PI / 2
floor.position.y = -0.012
floor.receiveShadow = true
scene.add(floor)

const cameraPosition = new THREE.Vector3()
function updateCamera() {
  cameraPosition.setFromSphericalCoords(radius, polar, azimuth).add(cameraTarget)
  camera.position.copy(cameraPosition)
  camera.lookAt(cameraTarget)
}
updateCamera()

let mixer = null
let idleAction = null
let modelPivot = null
let isPlaying = true
let hasInteracted = false
let timelineScrubbing = false
let lastFrame = 0
let previousFrameTime = performance.now()

const loader = new GLTFLoader()
const loadGLTF = (url) => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject))

function makeIdleClip(data) {
  const times = Float32Array.from({ length: data.frames + 1 }, (_, index) => index / data.fps)
  const tracks = []
  for (const [boneName, channels] of Object.entries(data.bones)) {
    if (channels.r) {
      tracks.push(new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, Float32Array.from(channels.r)))
    }
    if (channels.p) {
      tracks.push(new THREE.VectorKeyframeTrack(`${boneName}.position`, times, Float32Array.from(channels.p)))
    }
  }
  const clip = new THREE.AnimationClip(data.name || 'Quiet breathing', data.duration, tracks)
  clip.resetDuration()
  return clip
}

async function init() {
  try {
    const [gltf, idleData] = await Promise.all([
      loadGLTF('/models/michelle.glb'),
      fetch('/models/idle-xbot.json').then((response) => {
        if (!response.ok) throw new Error('Could not load the idle animation.')
        return response.json()
      }),
    ])

    const root = gltf.scene
    root.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(root)
    const center = bounds.getCenter(new THREE.Vector3())
    bounds.getSize(new THREE.Vector3())
    root.position.x -= center.x
    root.position.z -= center.z
    root.position.y -= bounds.min.y

    root.traverse((object) => {
      if (object.isMesh || object.isSkinnedMesh) {
        object.castShadow = true
        object.receiveShadow = true
        object.frustumCulled = false
        if (object.material) {
          object.material.side = THREE.FrontSide
          object.material.needsUpdate = true
        }
      }
    })

    modelPivot = new THREE.Group()
    modelPivot.add(root)
    scene.add(modelPivot)
    const modelHeight = bounds.max.y - bounds.min.y
    cameraTarget.set(0, modelHeight * 0.53, 0)
    radius = modelHeight * 2.2
    updateCamera()

    mixer = new THREE.AnimationMixer(root)
    const clip = makeIdleClip(idleData)
    idleAction = mixer.clipAction(clip)
    idleAction.setLoop(THREE.LoopRepeat, Infinity)
    idleAction.play()
    mixer.setTime(0)

    loading.classList.add('is-gone')
    window.__viewer = { ready: true, model: 'Michelle', duration: idleData.duration, bones: Object.keys(idleData.bones).length }
  } catch (error) {
    console.error('Unable to load the 3D portrait:', error)
    loading.innerHTML = '<span class="loading-ring"></span><span>THE PORTRAIT COULD NOT LOAD</span>'
    window.__viewer = { ready: false, error: String(error) }
  }
}

function render(timestamp = performance.now()) {
  const delta = Math.min(Math.max((timestamp - previousFrameTime) / 1000, 0), 0.05)
  previousFrameTime = timestamp
  if (mixer && isPlaying && !timelineScrubbing) mixer.update(delta)
  renderer.render(scene, camera)
  if (mixer && idleAction) updateTimeline(mixer.time % DURATION)
  requestAnimationFrame(render)
}

function resize() {
  const width = Math.max(viewer.clientWidth, 1)
  const height = Math.max(viewer.clientHeight, 1)
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

const resizeObserver = new ResizeObserver(resize)
resizeObserver.observe(viewer)
window.addEventListener('resize', resize)

// Pointer orbit works with mouse, pen, and touch. Prevent the browser's page gestures only inside the stage.
let pointer = null
viewer.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) return
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
  viewer.setPointerCapture(event.pointerId)
  if (!hasInteracted) {
    hasInteracted = true
    hint.classList.add('is-hidden')
  }
})
viewer.addEventListener('pointermove', (event) => {
  if (!pointer || pointer.id !== event.pointerId) return
  const dx = event.clientX - pointer.x
  const dy = event.clientY - pointer.y
  pointer.x = event.clientX
  pointer.y = event.clientY
  azimuth -= dx * 0.008
  polar = THREE.MathUtils.clamp(polar + dy * 0.006, 0.28, Math.PI - 0.28)
  updateCamera()
})
function endPointer(event) {
  if (!pointer || pointer.id !== event.pointerId) return
  pointer = null
}
viewer.addEventListener('pointerup', endPointer)
viewer.addEventListener('pointercancel', endPointer)
viewer.addEventListener('wheel', (event) => {
  event.preventDefault()
  radius = THREE.MathUtils.clamp(radius * Math.exp(event.deltaY * 0.001), 2.15, 7.3)
  updateCamera()
}, { passive: false })

function zoom(factor) {
  radius = THREE.MathUtils.clamp(radius * factor, 2.15, 7.3)
  updateCamera()
  if (!hasInteracted) {
    hasInteracted = true
    hint.classList.add('is-hidden')
  }
}
document.querySelector('#zoom-in').addEventListener('click', () => zoom(0.86))
document.querySelector('#zoom-out').addEventListener('click', () => zoom(1.16))
document.querySelector('#reset-view').addEventListener('click', () => {
  azimuth = 0
  polar = Math.PI / 2
  radius = initialRadius
  updateCamera()
  hint.classList.remove('is-hidden')
  hasInteracted = false
})

const toggle = document.querySelector('#animation-toggle')
function setPlaying(value) {
  isPlaying = value
  if (idleAction) idleAction.paused = !value
  toggle.classList.toggle('is-paused', !value)
  toggle.setAttribute('aria-label', value ? 'Pause animation' : 'Play animation')
  toggle.title = value ? 'Pause animation' : 'Play animation'
}
toggle.addEventListener('click', () => setPlaying(!isPlaying))

const timeline = document.querySelector('#timeline')
const progress = document.querySelector('#timeline-progress')
const thumb = document.querySelector('#timeline-thumb')
const timecode = document.querySelector('#timecode')
function updateTimeline(time) {
  const ratio = THREE.MathUtils.clamp(time / DURATION, 0, 1)
  progress.style.width = `${ratio * 100}%`
  thumb.style.left = `${ratio * 100}%`
  timecode.innerHTML = `00:${String(Math.floor(time * 10) / 10).padStart(4, '0')} <b>/</b> 00:02.5`
  timeline.setAttribute('aria-valuenow', time.toFixed(2))
}
function seekFromPointer(event) {
  const rect = timeline.getBoundingClientRect()
  const ratio = THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width, 0, 1)
  if (mixer) mixer.setTime(ratio * DURATION)
  updateTimeline(ratio * DURATION)
}
timeline.addEventListener('pointerdown', (event) => {
  timelineScrubbing = true
  timeline.setPointerCapture(event.pointerId)
  seekFromPointer(event)
})
timeline.addEventListener('pointermove', (event) => {
  if (timelineScrubbing) seekFromPointer(event)
})
function finishScrub() { timelineScrubbing = false }
timeline.addEventListener('pointerup', finishScrub)
timeline.addEventListener('pointercancel', finishScrub)
timeline.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const current = mixer?.time ?? 0
  const next = THREE.MathUtils.clamp(current + (event.key === 'ArrowRight' ? 0.1 : -0.1), 0, DURATION)
  if (mixer) mixer.setTime(next)
  updateTimeline(next)
})

const aboutOverlay = document.querySelector('#about-overlay')
function setAboutOpen(open) {
  aboutOverlay.classList.toggle('is-open', open)
  aboutOverlay.setAttribute('aria-hidden', String(!open))
}
document.querySelector('#about-button').addEventListener('click', () => setAboutOpen(true))
document.querySelector('#close-about').addEventListener('click', () => setAboutOpen(false))
aboutOverlay.addEventListener('click', (event) => { if (event.target === aboutOverlay) setAboutOpen(false) })
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setAboutOpen(false)
  if (event.code === 'Space' && !/INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) {
    event.preventDefault()
    setPlaying(!isPlaying)
  }
})

init()
requestAnimationFrame(render)
