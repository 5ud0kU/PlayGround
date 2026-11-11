// REALITY UNBOUND - First-Person Life Simulator Prototype
// ========================================================
// NOTE: This is a prototype demonstrating core concepts. 
// Full implementation of all 19 system categories would require 
// orders of magnitude more development time.
// ========================================================

import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const isNode = typeof window === 'undefined' || typeof document === 'undefined';

// Configuration
const CONFIG = {
  worldSize: 500,
  dayNightCycle: true,
  timeScale: 60,
  maxNPCs: 50,
  simulationPaused: false,
};

// ---- Scene Setup ----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

// Camera - use sensible defaults for both browser and Node
const aspect = isBrowser ? window.innerWidth / window.innerHeight : 16 / 9;
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
camera.position.set(1.6, 1.6, 1.6);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
if (isBrowser) {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);
} else {
  // Node.js: just set a fixed size for testing
  renderer.setSize(800, 600);
}
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Orbit controls (for developer navigation)
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = false;

// ---- Ground & Basic World ----
const groundGeometry = new THREE.PlaneGeometry(CONFIG.worldSize, CONFIG.worldSize);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x228B22,
  roughness: 0.8,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Grid helper
const gridHelper = new THREE.GridHelper(CONFIG.worldSize, 50, 0x444444, 0x222222);
scene.add(gridHelper);

// ---- Building generation (basic) ----
function createBuilding(position, height, width, depth) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: Math.random() > 0.5 ? 0x6B8E23 : 0x8B4513,
    roughness: 0.6,
  });
  const building = new THREE.Mesh(geometry, material);
  building.position.copy(position);
  building.position.y = height / 2;
  building.castShadow = true;
  building.receiveShadow = true;
  return building;
}

// Create a small city block
const buildings = [];
for (let i = 0; i < 30; i++) {
  const x = (Math.random() - 0.5) * (CONFIG.worldSize - 20);
  const z = (Math.random() - 0.5) * (CONFIG.worldSize - 20);
  const height = 5 + Math.random() * 15;
  const width = 5 + Math.random() * 10;
  const depth = 5 + Math.random() * 10;
  const building = createBuilding(new THREE.Vector3(x, 0, z), height, width, depth);
  scene.add(building);
  buildings.push(building);
}

// ---- Lighting ----
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(100, 200, 100);
sunLight.castShadow = true;
scene.add(sunLight);

// Sun for day/night cycle
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(50, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffe066 })
);
sun.position.set(100, 200, 100);
scene.add(sun);

// ---- Player First-Person System ----
class Player {
  constructor() {
    this.health = 100;
    this.hunger = 50;
    this.energy = 100;
    this.money = 1000;
    this.inventory = [];
    this.emotion = 'neutral';
    this.timeInGame = 0;
    this.currentLocation = new THREE.Vector3(0, 0, 0);
    
    // Movement state
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = true;
    this.jumpVelocity = 0;
    this.isOnGround = true;
    
    // First-person body visibility
    this.bodyVisible = true;
    
    // Initialize first-person if in browser
    if (isBrowser) {
      this.initFirstPerson();
    }
  }

  initFirstPerson() {
    // Create a simple visible body for first-person
    const bodyGeometry = new THREE.BoxGeometry(0.5, 1.8, 0.5);
    const bodyMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x888888, 
      transparent: true, 
      opacity: 0.001 
    });
    this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.body.visible = this.bodyVisible;
    scene.add(this.body);
    
    // Hands
    const handGeometry = new THREE.BoxGeometry(0.3, 0.8, 0.3);
    const handMaterial = new THREE.MeshBasicMaterial({ color: 0x8b7355 });
    this.rightHand = new THREE.Mesh(handGeometry, handMaterial);
    this.rightHand.position.set(0.4, -0.3, 0.5);
    this.body.add(this.rightHand);
    
    this.leftHand = new THREE.Mesh(handGeometry, handMaterial);
    this.leftHand.position.set(-0.4, -0.3, 0.5);
    this.body.add(this.leftHand);
    
    // Input handling
    window.addEventListener('keydown', (event) => {
      switch (event.code) {
        case 'KeyW': this.moveForward = true; break;
        case 'KeyS': this.moveBackward = true; break;
        case 'KeyA': this.moveLeft = true; break;
        case 'KeyD': this.moveRight = true; break;
        case 'Space': 
          if (this.isOnGround) {
            this.jumpVelocity = 5;
            this.isOnGround = false;
          }
          break;
      }
    });
    
    window.addEventListener('keyup', (event) => {
      switch (event.code) {
        case 'KeyW': this.moveForward = false; break;
        case 'KeyS': this.moveBackward = false; break;
        case 'KeyA': this.moveLeft = false; break;
        case 'KeyD': this.moveRight = false; break;
      }
    });
    
    // Pointer interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    window.addEventListener('pointerdown', (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      
      // Check buildings
      const buildingIntersects = raycaster.intersectObjects(buildings);
      if (buildingIntersects.length > 0) {
        const intersect = buildingIntersects[0];
        console.log(`Interact with building at (${intersect.point.x.toFixed(1)}, ${intersect.point.y.toFixed(1)}, ${intersect.point.z.toFixed(1)})`);
      }
      
      // Check NPCs
      const visibleNPCs = npcs.filter(n => n.mesh.visible);
      if (visibleNPCs.length > 0) {
        for (const npc of visibleNPCs) {
          const intersect = raycaster.intersectObject(npc.mesh);
          if (intersect.length > 0) {
            console.log(`Talk to ${npc.name} (${npc.job}, hunger: ${npc.hunger.toFixed(1)}, emotion: ${npc.emotion})`);
            npc.hunger = Math.min(100, npc.hunger + 10);
            npc.emotion = 'happy';
            if (npc.mesh.material) {
              npc.mesh.material.color.set(npc.getColorForEmotion(npc.emotion));
            }
          }
        }
      }
    });
  }

  update(deltaTime) {
    this.timeInGame += deltaTime;
    
    // Player needs decay
    this.hunger = Math.max(0, this.hunger - deltaTime * 0.02);
    this.energy = Math.max(0, this.energy - deltaTime * 0.01);
    this.health = Math.max(0, this.health - deltaTime * 0.005);
    
    // Emotion based on needs
    if (this.hunger < 20) this.emotion = 'sad';
    else if (this.hunger < 40) this.emotion = 'neutral';
    else this.emotion = 'happy';
    
    // First-person movement
    const speed = 4.0;
    const velocity = new THREE.Vector3();
    
    if (this.moveForward) velocity.z -= speed;
    if (this.moveBackward) velocity.z += speed;
    if (this.moveLeft) velocity.x -= speed;
    if (this.moveRight) velocity.x += speed;
    
    // Rotate velocity based on camera yaw
    velocity.applyEuler(new THREE.Euler(0, camera.rotation.y, 0, 'YXZ'));
    
    // Apply movement
    camera.position.addScaledVector(velocity, deltaTime);
    
    // Keep camera upright
    camera.rotation.x = 0;
    
    // Ground check
    if (camera.position.y < 2) {
      camera.position.y = 2;
      this.isOnGround = true;
      this.canJump = true;
    } else {
      this.isOnGround = false;
    }
    
    // Current location
    this.currentLocation.copy(camera.position);
    
    // Update body to follow camera
    if (this.body) {
      this.body.position.copy(camera.position);
    }
  }
}

const player = new Player();

// ---- NPC System (simplified) ----
class NPC {
  constructor(id) {
    this.id = id;
    this.name = `NPC_${id}`;
    this.age = Math.floor(Math.random() * 60) + 18;
    this.health = 100;
    this.hunger = 50;
    this.energy = 100;
    this.money = Math.random() * 1000;
    this.location = new THREE.Vector3(
      (Math.random() - 0.5) * 100,
      0,
      (Math.random() - 0.5) * 100
    );
    this.job = ['unemployed', 'worker', 'doctor', 'engineer', 'teacher'][Math.floor(Math.random() * 5)];
    this.relationships = {};
    this.home = null;
    this.inventory = [];
    this.memories = [];
    this.emotion = 'neutral';
    this.personality = Math.random();
    
    // Create visual marker
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: this.getColorForEmotion(this.emotion),
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.location);
    // Only visible in browser; in Node we can hide
    if (isBrowser) {
      this.mesh.visible = true;
    } else {
      this.mesh.visible = false;
    }
    scene.add(this.mesh);
  }

  getColorForEmotion(emotion) {
    const colors = {
      happy: 0xff6b6b,
      sad: 0x4ecdc4,
      angry: 0xffa502,
      neutral: 0x90a4ae,
      anxious: 0xf09321,
    };
    return colors[emotion] || colors.neutral;
  }

  update(deltaTime) {
    if (CONFIG.simulationPaused) return;

    // Basic needs simulation
    this.hunger = Math.max(0, this.hunger - deltaTime * 0.01);
    this.energy = Math.max(0, this.energy - deltaTime * 0.005);
    
    // Health affected by needs
    if (this.hunger < 20) this.health = Math.max(0, this.health - deltaTime * 0.1);
    if (this.energy < 20) this.health = Math.max(0, this.health - deltaTime * 0.05);

    // Update emotion based on state
    if (this.hunger < 10) this.emotion = 'angry';
    else if (this.hunger < 30) this.emotion = 'sad';
    else if (this.energy > 80) this.emotion = 'happy';
    else this.emotion = 'neutral';

    // Update visual
    if (this.mesh) {
      this.mesh.position.copy(this.location);
      const color = this.getColorForEmotion(this.emotion);
      if (this.mesh.material) {
        this.mesh.material.color.set(color);
      }
    }

    // Simple AI: wander
    this.behave(deltaTime);
  }

  behave(deltaTime) {
    if (Math.random() > 0.98) {
      this.location.x += (Math.random() - 0.5) * 10;
      this.location.z += (Math.random() - 0.5) * 10;
      this.location.y = Math.max(0, this.location.y);
    }
  }
}

// Create NPCs
let npcs = [];
for (let i = 0; i < CONFIG.maxNPCs; i++) {
  const npc = new NPC(i);
  npcs.push(npc);
}

// ---- Interaction System (global) ----
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onPointerDown(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  
  // Check buildings
  const buildingIntersects = raycaster.intersectObjects(buildings);
  if (buildingIntersects.length > 0) {
    const intersect = buildingIntersects[0];
    console.log(`Interact with building at (${intersect.point.x.toFixed(1)}, ${intersect.point.y.toFixed(1)}, ${intersect.point.z.toFixed(1)})`);
  }
  
  // Check NPCs
  const visibleNPCs = npcs.filter(n => n.mesh.visible);
  if (visibleNPCs.length > 0) {
    for (const npc of visibleNPCs) {
      const intersect = raycaster.intersectObject(npc.mesh);
      if (intersect.length > 0) {
        console.log(`Talk to ${npc.name} (${npc.job}, hunger: ${npc.hunger.toFixed(1)}, emotion: ${npc.emotion})`);
        npc.hunger = Math.min(100, npc.hunger + 10);
        npc.emotion = 'happy';
        if (npc.mesh.material) {
          npc.mesh.material.color.set(npc.getColorForEmotion(npc.emotion));
        }
      }
    }
  }
}

// Only add event listeners in browser
if (isBrowser) {
  window.addEventListener('pointerdown', onPointerDown);
  
  // Day/night cycle UI update
  function updateDayNightUI() {
    const hour = gameTime % 24;
    const hours = Math.floor(hour).toString().padStart(2, '0');
    const minutes = Math.floor((hour % 1) * 60).toString().padStart(2, '0');
    document.getElementById('gameTime').textContent = `${hours}:${minutes} ${hour < 12 ? 'AM' : 'PM'}`;
  }
}

// ---- Day/Night Cycle ----
let gameTime = 6; // Start at 6 AM

function updateDayNight(deltaTime) {
  if (!CONFIG.dayNightCycle) return;
  
  gameTime += deltaTime * CONFIG.timeScale;
  if (gameTime >= 24) gameTime = 0;
  
  // Calculate sun position based on time of day
  const angle = (gameTime / 24) * Math.PI * 2;
  const sunHeight = Math.sin(angle) * 100 + 50;
  const sunX = Math.cos(angle) * 150;
  const sunZ = Math.sin(angle) * 150;
  
  sun.position.set(sunX, sunHeight, sunZ);
  sunLight.position.set(sunX, sunHeight + 50, sunZ);
  
  // Adjust light intensity based on time
  const hour = gameTime % 24;
  let lightIntensity = 0.6;
  
  if (hour >= 6 && hour <= 18) {
    lightIntensity = 0.8;
    sunLight.intensity = 0.8;
  } else if (hour >= 18 && hour <= 22) {
    lightIntensity = 0.5;
    sunLight.intensity = 0.5;
  } else {
    lightIntensity = 0.2;
    sunLight.intensity = 0.3;
  }
  
  ambientLight.intensity = lightIntensity;
  
  // Enable shadows only during day
  renderer.shadowMap.enabled = hour >= 6 && hour <= 18;
  
  // Update UI if in browser
  if (isBrowser) {
    updateDayNightUI();
  }
}

// ---- Render Loop ----
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  const deltaTime = Math.min(clock.getDelta(), 0.1);
  
  // Player update
  player.update(deltaTime);
  
  // NPC updates
  npcs.forEach(npc => npc.update(deltaTime));
  
  // Day/night cycle
  updateDayNight(deltaTime);
  
  // Rotate buildings
  buildings.forEach((building, i) => {
    building.rotation.y = deltaTime * 0.1 * (i % 2 === 0 ? 1 : -1);
    building.rotation.x = deltaTime * 0.02;
  });
  
  // Update controls
  controls.update();
  
  // Render
  renderer.render(scene, camera);
  
  // Update stats
  if (isBrowser) stats.update();
}

 // Only start animation loop in browser
 if (isBrowser) {
   animate();
 }