import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const canvas = document.querySelector('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050607);
scene.fog = new THREE.FogExp2(0x07090a, 0.027);
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 100);
camera.position.set(0, 1.7, 8);
const player = new THREE.Group();
player.position.copy(camera.position);
scene.add(player);
player.add(camera);

scene.add(new THREE.HemisphereLight(0x82909a, 0x10100f, 0.31));
const ambient = new THREE.AmbientLight(0x22272b, 0.18); scene.add(ambient);
const flashlight = new THREE.SpotLight(0xc9d7d2, 33, 23, Math.PI / 7, .6, 1.2);
flashlight.position.set(0, 0, 0); flashlight.target.position.set(0, 0, -1); camera.add(flashlight, flashlight.target);
const redFill = new THREE.PointLight(0x9d161a, 22, 16, 2); redFill.position.set(0, 4.7, -9); scene.add(redFill);

const mat = (color, roughness=.8, metalness=0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const concrete = mat(0x252728), floorMat = mat(0x171a1b), darkMetal = mat(0x0b0d0e,.48,.55), trimMat = mat(0x3c3b38,.55,.3), flesh = mat(0x564744,.9), black = mat(0x070809), redMat = new THREE.MeshStandardMaterial({color:0x7d1d1b, emissive:0x641311,emissiveIntensity:1.2,roughness:.5});
function box(parent, x,y,z, sx,sy,sz, material, cast=false) { const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m; }
function makeCodeTexture(text, color='#8ee2cb') { const c=document.createElement('canvas');c.width=256;c.height=512;const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);g.font='20px monospace';g.fillStyle=color;g.globalAlpha=.78;for(let y=21;y<510;y+=26){g.fillText(text[(y/26|0)%text.length]+' '+text.slice((y/26|0)%text.length),10,y)}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t; }
const greenCode=makeCodeTexture('0100110101010010','#91c9b9');
const redCode=makeCodeTexture('1011001000101101','#ef665c');

// A repeating, impossible service corridor.
box(scene,0,-.28,-17,9.3,.55,62,floorMat);
box(scene,0,7.1,-17,9.3,.5,62,concrete);
box(scene,-4.8,3.35,-17,.5,7.2,62,concrete);
box(scene,4.8,3.35,-17,.5,7.2,62,concrete);
for(let i=0;i<16;i++){
  const z=10-i*3.8;
  box(scene,0,6.65,z,9.5,.18,.16,darkMetal);
  box(scene,-4.5,3.3,z,.35,6.9,.13,trimMat);
  box(scene,4.5,3.3,z,.35,6.9,.13,trimMat);
  // scuffed wall paneling
  for(const s of [-1,1]){
    const panel=box(scene,s*4.48,3.6,z-1.6,.035,3.2,2.7,darkMetal);
    const code=new THREE.Mesh(new THREE.PlaneGeometry(1.05,2.45),new THREE.MeshBasicMaterial({map:greenCode,transparent:true,opacity:.26,side:THREE.DoubleSide,depthWrite:false}));
    code.position.set(s*4.455,3.35,z-1.6);code.rotation.y=s<0?Math.PI/2:-Math.PI/2;scene.add(code);
  }
  box(scene,0,-.03,z,9.1,.07,.07,trimMat);
  const light=new THREE.PointLight(i%3===0?0x9d2922:0xb6c1bc,i%3===0?7:2.1,8,2);light.position.set(0,6.15,z-1);scene.add(light);
  if(i%3===0){const lamp=box(scene,0,6.28,z-1,1.15,.12,.32,redMat);lamp.material=redMat;}
}
// Side alcoves and impossible human shapes, assembled from primitive geometry.
function makeWitness(x,z,flip=1){
  const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=flip*.12;scene.add(group);
  const bodymat=new THREE.MeshStandardMaterial({color:0x27201f,roughness:1});
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.95,5,8),bodymat);torso.position.y=2.15;torso.rotation.z=-.16*flip;group.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.24,10,8),flesh);head.scale.set(.8,1.15,.82);head.position.set(.03,2.95,0);group.add(head);
  for(const side of [-1,1]){
    const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.85,4,6),bodymat);arm.position.set(side*.44,2.12,.02);arm.rotation.z=side*.16;group.add(arm);
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.13,.83,4,6),bodymat);leg.position.set(side*.18,.77,0);leg.rotation.z=side*.1;group.add(leg);
  }
  const eye=new THREE.Mesh(new THREE.SphereGeometry(.035,6,6),redMat);eye.position.set(0,3,-.19);group.add(eye);
  // a narrow red reflection, suggestive rather than graphic
  const stain=new THREE.Mesh(new THREE.PlaneGeometry(.28,.65),new THREE.MeshBasicMaterial({color:0x541817,transparent:true,opacity:.5}));stain.position.set(.4,1.6,.12);group.add(stain);
}
makeWitness(-3.65,-4,1);makeWitness(3.65,-16,-1);makeWitness(-3.65,-29,1);

const anchorsData=[
 {name:'ANCHOR 01 / THE WITNESS',code:'10100110',x:-1.3,z:-2.2,desc:'A shape that remembers being human. Rewrite the sequence and it may let you pass.'},
 {name:'ANCHOR 02 / THE PULSE',code:'01101001',x:1.35,z:-14.5,desc:'Something beneath the floor beats in binary. Make its rhythm match the signal.'},
 {name:'ANCHOR 03 / THE DOOR',code:'11010010',x:-1.1,z:-27.5,desc:'The way home is here, but the world has written over its name.'}
];
const anchors=[];
function makeAnchor(data,index){
 const g=new THREE.Group();g.position.set(data.x,0,data.z);scene.add(g);
 const base= new THREE.Mesh(new THREE.CylinderGeometry(.72,.86,.22,8),darkMetal);base.position.y=.12;g.add(base);
 const body=new THREE.Mesh(new THREE.BoxGeometry(.8,2.65,.62),new THREE.MeshStandardMaterial({color:0x171c1c,metalness:.65,roughness:.32,emissive:0x06100e}));body.position.y=1.55;g.add(body);
 const core=new THREE.Mesh(new THREE.OctahedronGeometry(.38,1),new THREE.MeshStandardMaterial({color:0x9bd5c3,emissive:0x247461,emissiveIntensity:2,metalness:.3,roughness:.2}));core.position.set(0,1.75,.4);g.add(core);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.92,.035,8,40),new THREE.MeshBasicMaterial({color:0x73cdb5,transparent:true,opacity:.7}));ring.position.y=1.65;ring.rotation.x=Math.PI/2;g.add(ring);
 const label=new THREE.Mesh(new THREE.PlaneGeometry(1.05,1.55),new THREE.MeshBasicMaterial({map:index===1?redCode:greenCode,transparent:true,opacity:.68,side:THREE.DoubleSide,depthWrite:false}));label.position.set(0,3.25,.04);label.rotation.y=.18;g.add(label);
 const p=new THREE.PointLight(0x58b99c,3.8,5,2);p.position.set(0,2,.8);g.add(p);
 return { ...data,group:g,core,ring,light:p,solved:false,index };
}
anchorsData.forEach((d,i)=>anchors.push(makeAnchor(d,i)));
// Exit membrane at the end of the corridor.
const exitGroup=new THREE.Group();exitGroup.position.set(0,0,-43);scene.add(exitGroup);
box(exitGroup,-1.9,3.1,0,.26,6.2,.5,trimMat);box(exitGroup,1.9,3.1,0,.26,6.2,.5,trimMat);box(exitGroup,0,6.1,0,4,.26,.5,trimMat);
const door=new THREE.Mesh(new THREE.PlaneGeometry(3.5,5.7),new THREE.MeshBasicMaterial({color:0x111515,transparent:true,opacity:.95,side:THREE.DoubleSide}));door.position.y=2.9;exitGroup.add(door);
const portal=new THREE.Mesh(new THREE.PlaneGeometry(3.35,5.5),new THREE.MeshBasicMaterial({color:0x8db7aa,transparent:true,opacity:.0,side:THREE.DoubleSide}));portal.position.set(0,2.9,-.03);exitGroup.add(portal);
const exitLight=new THREE.PointLight(0x8db7aa,0,11,2);exitLight.position.set(0,3,-1);exitGroup.add(exitLight);

const intro=document.querySelector('#intro'),hud=document.querySelector('#hud'),watchPanel=document.querySelector('#watch-panel'),ending=document.querySelector('#ending');
const startBtn=document.querySelector('#start-button'),watchClose=document.querySelector('#close-watch'),applyBtn=document.querySelector('#apply-button');
const toast=document.querySelector('#toast');let active=true,started=false,paused=false,watchOpen=false,endingOn=false;
let yaw=0,pitch=0,move={f:0,s:0},nearby=null,currentBits='',toastTimer=0;
const playerHeight=1.7; camera.position.set(0,playerHeight,0);
const bitGrid=document.querySelector('#bit-grid');
function showToast(text){toast.textContent=text;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2100)}
function updateProgress(){const done=anchors.filter(a=>a.solved).length;document.querySelector('#progress-fill').style.width=`${done/3*100}%`;document.querySelector('#progress-label').textContent=`ANCHORS RESTORED ${done} / 3`;if(done===3){document.querySelector('#objective-text').textContent='FIND THE DOOR THAT REMEMBERS';door.material.color.setHex(0x64786f);portal.material.opacity=.65;exitLight.intensity=8;}}
function openWatch(anchor){if(!anchor){showToast('NO STABLE SIGNAL IN RANGE');return;}nearby=anchor;watchOpen=true;document.querySelector('#watch-title').textContent=anchor.name;document.querySelector('#watch-description').textContent=anchor.desc;currentBits=anchor.solved?anchor.code:Array.from({length:8},(_,i)=>((i*3+anchor.index*5+1)%7<3?'1':'0')).join('');document.querySelector('#current-code').textContent=currentBits;document.querySelector('#target-code').textContent=anchor.code;document.querySelector('#watch-feedback').textContent=anchor.solved?'SIGNAL STABLE. PATCH ALREADY COMMITTED.':'Tap a digit to invert it.';document.querySelector('#watch-feedback').className='watch-feedback';drawBits();watchPanel.classList.remove('hidden');document.exitPointerLock?.();}
function drawBits(){bitGrid.replaceChildren();[...currentBits].forEach((bit,i)=>{const b=document.createElement('button');b.className=`bit ${bit==='1'?'on':''}`;b.textContent=bit;b.setAttribute('aria-label',`Bit ${i+1}, ${bit}. Toggle`);b.onclick=()=>{if(nearby?.solved)return;currentBits=currentBits.slice(0,i)+(currentBits[i]==='1'?'0':'1')+currentBits.slice(i+1);document.querySelector('#current-code').textContent=currentBits;drawBits();};bitGrid.appendChild(b);});}
function closeWatch(){watchOpen=false;watchPanel.classList.add('hidden');if(started&&!paused&&!endingOn)canvas.requestPointerLock?.();}
function commitPatch(){if(!nearby)return;if(nearby.solved){closeWatch();return;}const feedback=document.querySelector('#watch-feedback');if(currentBits===nearby.code){nearby.solved=true;nearby.core.material.color.set(0xff665b);nearby.core.material.emissive.set(0x96251d);nearby.ring.material.color.set(0xf05a4f);nearby.light.color.set(0xee5548);feedback.textContent='PATCH ACCEPTED. THE WORLD SHIFTS.';feedback.className='watch-feedback success';updateProgress();showToast('ANCHOR RESTORED // REALITY REJECTS YOU');setTimeout(closeWatch,900);}else{feedback.textContent='SEQUENCE REJECTED. THE SIGNAL IS STILL WRONG.';feedback.className='watch-feedback error';const card=document.querySelector('.watch-card');card.animate([{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(-2px)'},{transform:'none'}],{duration:260});}}
startBtn.onclick=()=>{started=true;intro.classList.add('hidden');hud.classList.remove('hidden');canvas.requestPointerLock?.();};
watchClose.onclick=closeWatch;applyBtn.onclick=commitPatch;document.querySelector('#return-button').onclick=()=>location.reload();
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['w','a','s','d',' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(watchOpen){if(k==='escape')closeWatch();return;}if(k==='w'||k==='arrowup')move.f=1;if(k==='s'||k==='arrowdown')move.f=-1;if(k==='a'||k==='arrowleft')move.s=-1;if(k==='d'||k==='arrowright')move.s=1;if(k==='shift')active=true;if(k==='e'&&started&&!endingOn){if(nearby)openWatch(nearby);else if(player.position.z<-39){if(anchors.every(a=>a.solved)){endingOn=true;ending.classList.remove('hidden');document.exitPointerLock?.();}else showToast('THE EXIT IS STILL SEALED');}else showToast('NO SIGNAL. KEEP MOVING.');}});
window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='w'||k==='s'||k==='arrowup'||k==='arrowdown')move.f=0;if(k==='a'||k==='d'||k==='arrowleft'||k==='arrowright')move.s=0;});
window.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&!watchOpen){yaw-=e.movementX*.0022;pitch-=e.movementY*.0018;pitch=Math.max(-1.25,Math.min(1.25,pitch));}});
document.addEventListener('pointerlockchange',()=>{paused=started&&!watchOpen&&!endingOn&&document.pointerLockElement!==canvas;document.querySelector('#lock-hint').classList.toggle('hidden',!paused);});
canvas.addEventListener('click',()=>{if(started&&!watchOpen&&!endingOn&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.();});
let touchLook=null;
canvas.addEventListener('touchstart',e=>{if(e.touches.length){touchLook={x:e.touches[0].clientX,y:e.touches[0].clientY};}},{passive:true});
canvas.addEventListener('touchmove',e=>{if(!touchLook||watchOpen)return;const t=e.touches[0];yaw-=(t.clientX-touchLook.x)*.004;pitch=Math.max(-1.25,Math.min(1.25,pitch-(t.clientY-touchLook.y)*.003));touchLook={x:t.clientX,y:t.clientY};},{passive:true});
canvas.addEventListener('touchend',()=>touchLook=null);
document.querySelectorAll('[data-move]').forEach(button=>{const set=e=>{e.preventDefault();const m=button.dataset.move;if(m==='f')move.f=1;if(m==='b')move.f=-1;if(m==='l')move.s=-1;if(m==='r')move.s=1;};const clear=()=>{move.f=0;move.s=0;};button.addEventListener('pointerdown',set);button.addEventListener('pointerup',clear);button.addEventListener('pointercancel',clear);button.addEventListener('pointerleave',clear);});
document.querySelector('#touch-interact').addEventListener('click',()=>{if(watchOpen)return;if(nearby)openWatch(nearby);else if(player.position.z<-39){if(anchors.every(a=>a.solved)){endingOn=true;ending.classList.remove('hidden');}else showToast('THE EXIT IS STILL SEALED');}});
function update(dt,time){if(started&&!watchOpen&&!paused&&!endingOn){const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));const dir=forward.multiplyScalar(move.f).add(right.multiplyScalar(move.s));if(dir.lengthSq()>0){dir.normalize();const actualSpeed=window.__sprinting?7.2:4.65;player.position.addScaledVector(dir,actualSpeed*dt);}
 player.position.x=THREE.MathUtils.clamp(player.position.x,-3.9,3.9);player.position.z=THREE.MathUtils.clamp(player.position.z,-44.5,9.5);player.position.y=playerHeight;
 camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;
 const distToExit=player.position.distanceTo(new THREE.Vector3(0,1.7,-41));if(distToExit<3&&anchors.every(a=>a.solved)){document.querySelector('#nearby-name').textContent='HOME / EXIT';document.querySelector('#nearby').classList.remove('hidden');document.querySelector('#nearby').querySelector('.signal').textContent='◉ SIGNAL ACQUIRED';}else{
 let nearest=null,min=4.1;for(const a of anchors){if(a.solved)continue;const d=player.position.distanceTo(new THREE.Vector3(a.x,1.6,a.z));if(d<min){min=d;nearest=a;}}
 if(nearest){nearby=nearest;document.querySelector('#nearby-name').textContent=nearest.name;document.querySelector('#nearby').classList.remove('hidden')}else{nearby=null;document.querySelector('#nearby').classList.add('hidden')}
 }
 document.querySelector('#coords').innerHTML=`X ${Math.abs(player.position.x).toFixed(1).padStart(2,'0')}&nbsp;&nbsp; Z ${Math.abs(player.position.z).toFixed(1).padStart(2,'0')}`;
 }
 anchors.forEach((a,i)=>{a.group.rotation.y=Math.sin(time*.7+i)*.04;a.core.rotation.y=time*.7;a.core.rotation.x=time*.33;a.ring.rotation.z=time*.55;a.group.position.y=Math.sin(time*1.1+i)*.035;});
 // The red lights intermittently forget how to exist.
 redFill.intensity=14+Math.abs(Math.sin(time*1.7))*12+(Math.sin(time*7.3)>0.98?0:0);
}
window.addEventListener('keydown',e=>{if(e.key==='Shift')window.__sprinting=true;});window.addEventListener('keyup',e=>{if(e.key==='Shift')window.__sprinting=false;});
let prev=performance.now();function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-prev)/1000,.04);prev=now;update(dt,now/1000);renderer.render(scene,camera);}requestAnimationFrame(animate);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));});
