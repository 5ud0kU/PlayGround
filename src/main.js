import * as THREE from 'three';
import './style.css';

const mount = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#182523');
scene.fog = new THREE.Fog('#182523', 32, 90);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 100);
camera.position.set(0, 11.5, 18.5);
camera.lookAt(0, 1.2, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
mount.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xc9f0e2, 0x26312b, 2.2));
const keyLight = new THREE.DirectionalLight(0xffefcf, 3.2);
keyLight.position.set(-5, 11, 6); keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024); keyLight.shadow.camera.left = -12; keyLight.shadow.camera.right = 12; keyLight.shadow.camera.top = 12; keyLight.shadow.camera.bottom = -12;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x66c9ca, 2.3); rimLight.position.set(5, 7, -7); scene.add(rimLight);
const fill = new THREE.PointLight(0xd6ff4f, 35, 18); fill.position.set(0, 5, 1); scene.add(fill);

const mat = (color, roughness=.7, metalness=0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const floorMat = mat('#29312b', .9), darkMat = mat('#151d1c', .86), railMat = mat('#53635b', .45, .55), limeMat = mat('#d6ff4f', .38, .08);
const arena = new THREE.Group(); scene.add(arena);
const platform = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.6, .48, 8, 1), floorMat);
platform.position.y = -.24; platform.rotation.y = Math.PI / 8; platform.receiveShadow = true; platform.castShadow = true; arena.add(platform);
const inner = new THREE.Mesh(new THREE.CylinderGeometry(6.7, 6.7, .06, 8), mat('#343a30'));
inner.position.y = .015; inner.rotation.y = Math.PI / 8; inner.receiveShadow = true; arena.add(inner);
const ring = new THREE.Mesh(new THREE.TorusGeometry(6.95, .055, 8, 8), limeMat);
ring.rotation.x = Math.PI / 2; ring.position.y = .08; arena.add(ring);
// Octagonal safety rails and corner posts.
for(let i=0;i<8;i++){
  const a=i*Math.PI/4+Math.PI/8, x=Math.cos(a)*7.08, z=Math.sin(a)*7.08;
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,2.1,8),mat(i%2?'#394941':'#748278',.42,.25));
  post.position.set(x,1.05,z); post.castShadow=true; arena.add(post);
  for(const y of [.53,1.03,1.53]){
    const next=(i+1)*Math.PI/4+Math.PI/8, nx=Math.cos(next)*7.08, nz=Math.sin(next)*7.08;
    const rope=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,Math.hypot(nx-x,nz-z),8),mat(y===1.03?'#b8c5ae':'#67766b',.42));
    rope.position.set((x+nx)/2,y,(z+nz)/2); rope.rotation.z=Math.PI/2; rope.rotation.y=-Math.atan2(nz-z,nx-x); arena.add(rope);
  }
}
for(let i=0;i<8;i++){
  const a=i*Math.PI/4+Math.PI/8, post=new THREE.Mesh(new THREE.BoxGeometry(1.05,.1,.13), mat('#d6ff4f',.45));
  post.position.set(Math.cos(a)*7.09,1.84,Math.sin(a)*7.09); post.rotation.y=-a; arena.add(post);
}
// Rooftop beyond the ring: distant blocks, antennae and window glows.
const city=new THREE.Group();scene.add(city);
for(let i=0;i<24;i++){
  const angle=i*Math.PI*2/24, radius=12+Math.random()*5, w=1.1+Math.random()*2, h=3+Math.random()*10;
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,1.1+Math.random()*1.5),mat(i%3===0?'#344642':'#222f2e',.95));
  b.position.set(Math.cos(angle)*radius,h/2-1.8,Math.sin(angle)*radius-3); b.rotation.y=-angle; scene.add(b);
  for(let j=0;j<3;j++){
    const win=new THREE.Mesh(new THREE.PlaneGeometry(.14,.22),new THREE.MeshBasicMaterial({color:j%2?'#7c9a65':'#c3a764'}));
    win.position.set(b.position.x+(Math.random()-.5)*w,b.position.y+(Math.random()-.5)*h,b.position.z+.58); scene.add(win);
  }
}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),mat('#16201e'));ground.rotation.x=-Math.PI/2;ground.position.y=-1;ground.receiveShadow=true;scene.add(ground);

const capsuleGeo=new THREE.CapsuleGeometry(.25,.42,5,8);
const sphereGeo=new THREE.SphereGeometry(.27,12,10);
function limb(parent, material, length=.74, radius=.14){
  const g=new THREE.Group();
  const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(radius,length*.55,4,8),material);
  mesh.position.y=-length*.42; mesh.castShadow=true;g.add(mesh);
  const joint=new THREE.Mesh(new THREE.SphereGeometry(radius*1.08,10,8),material);joint.position.y=-length*.83; joint.castShadow=true;g.add(joint);
  parent.add(g);return g;
}
function makeFighter(name, colors, x, z, isPlayer){
  const group=new THREE.Group();scene.add(group);group.position.set(x,0,z);
  const bodyMat=mat(colors.body,.44), shirtMat=mat(colors.shirt,.68), pantsMat=mat(colors.pants,.74), shoeMat=mat('#202725',.38), skinMat=mat(colors.skin,.64), accentMat=mat(colors.accent,.35,.15);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.53,.67,6,12),shirtMat);torso.position.y=1.63;torso.castShadow=true;group.add(torso);
  const chest=new THREE.Mesh(new THREE.SphereGeometry(.45,12,10),bodyMat);chest.scale.set(1,.34,.72);chest.position.set(0,1.82,.015);chest.castShadow=true;group.add(chest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.34,16,12),skinMat);head.position.set(0,2.46,0);head.scale.set(1,.98,.92);head.castShadow=true;group.add(head);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.355,12,8),mat(colors.hair,.9));hair.position.set(0,2.61,-.025);hair.scale.set(1,.53,.95);hair.castShadow=true;group.add(hair);
  const face=new THREE.Mesh(new THREE.BoxGeometry(.42,.075,.035),mat('#17201d',.5));face.position.set(0,2.49,.31);group.add(face);
  const belt=new THREE.Mesh(new THREE.TorusGeometry(.36,.055,6,16),accentMat);belt.position.set(0,1.23,0);belt.rotation.x=Math.PI/2;group.add(belt);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const armPivot=new THREE.Group();armPivot.position.set(side*.55,1.98,0);group.add(armPivot);
    limb(armPivot,shirtMat,.52,.18);
    const fore=new THREE.Group();fore.position.y=-.48;armPivot.add(fore);limb(fore,skinMat,.43,.14);
    const glove=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),accentMat);glove.position.set(0,-.8,.04);glove.castShadow=true;armPivot.add(glove);
    arms.push(armPivot);
    const hip=new THREE.Group();hip.position.set(side*.23,1.15,0);group.add(hip);
    const legMesh=new THREE.Mesh(new THREE.CapsuleGeometry(.18,.5,4,8),pantsMat);legMesh.position.y=-.37;legMesh.castShadow=true;hip.add(legMesh);
    const boot=new THREE.Mesh(new THREE.BoxGeometry(.31,.18,.44),shoeMat);boot.position.set(0,-.73,.09);boot.castShadow=true;hip.add(boot);
    legs.push(hip);
  }
  // Colored shoulder marks and a simple belt tag.
  const badge=new THREE.Mesh(new THREE.BoxGeometry(.24,.25,.06),accentMat);badge.position.set(.35,1.91,.43);badge.rotation.z=-.2;group.add(badge);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.65,20),new THREE.MeshBasicMaterial({color:'#050908',transparent:true,opacity:.35}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.018;group.add(shadow);
  return {name,group,arms,legs,head,torso,isPlayer,hp:100,stamina:100,velocity:new THREE.Vector3(),facing:new THREE.Vector3(isPlayer?1:-1,0,0),grounded:true,action:'idle',actionTime:0,attackCooldown:0,invuln:0,grabbed:0,throwTimer:0,throwTarget:null,stress:{head:0,ribs:0,leftArm:0,rightArm:0,leftLeg:0,rightLeg:0},injuries:{},walk:Math.random()*10,alive:true};
}
const player=makeFighter('Rivet',{body:'#d59f77',shirt:'#208cb3',pants:'#25404a',skin:'#e0b294',hair:'#29352c',accent:'#55d2ef'},-2.6,.4,true);
const bot=makeFighter('Grit',{body:'#c08768',shirt:'#b64538',pants:'#4a302c',skin:'#ce9a7a',hair:'#452e25',accent:'#ff775f'},2.5,-.35,false);

const keys=new Set(),pressed=new Set();let running=false,gameOver=false,timeLeft=90,toastTimer=0,shake=0,soundEnabled=true,audioContext=null;
const $=s=>document.querySelector(s);
function sound(kind){
  if(!soundEnabled)return;
  try{
    audioContext??=new AudioContext();
    if(audioContext.state==='suspended')audioContext.resume();
    const now=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();
    const tones={hit:[115,.13,'square'],throw:[78,.22,'sawtooth'],jump:[250,.08,'sine']};
    const [frequency,duration,wave]=tones[kind]||tones.hit;
    osc.type=wave;osc.frequency.setValueAtTime(frequency,now);osc.frequency.exponentialRampToValueAtTime(Math.max(35,frequency*.48),now+duration);
    gain.gain.setValueAtTime(.055,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+duration);
  }catch{}
}
function toast(text){const el=$('#combat-toast');el.textContent=text;el.classList.add('show');toastTimer=1.2;}
function startGame(){player.hp=bot.hp=100;player.stamina=bot.stamina=100;player.stress={head:0,ribs:0,leftArm:0,rightArm:0,leftLeg:0,rightLeg:0};bot.stress={head:0,ribs:0,leftArm:0,rightArm:0,leftLeg:0,rightLeg:0};player.injuries={};bot.injuries={};for(const f of [player,bot]){f.action='idle';f.actionTime=0;f.attackCooldown=0;f.invuln=0;f.grabbed=0;f.throwTimer=0;f.throwTarget=null;}player.group.position.set(-2.6,0,.4);bot.group.position.set(2.5,0,-.35);player.velocity.set(0,0,0);bot.velocity.set(0,0,0);player.alive=bot.alive=true;timeLeft=90;running=true;gameOver=false;$('#center-message').classList.add('hidden');$('#center-message').querySelector('span').textContent='READY?';$('#start-btn').innerHTML='FIGHT <span>→</span>';toast('FIGHT!');updateHud();}
$('#start-btn').addEventListener('click',startGame);
$('#sound-btn').addEventListener('click',e=>{soundEnabled=!soundEnabled;const span=e.currentTarget.querySelector('span');span.textContent=soundEnabled?'SOUND ON':'SOUND OFF';e.currentTarget.classList.toggle('muted',!soundEnabled);if(soundEnabled)sound('jump');});
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(!keys.has(k))pressed.add(k);keys.add(k);if(!running&&(k==='enter'||k===' '))startGame();});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
document.querySelectorAll('.mobile-controls button').forEach(btn=>{const action=btn.dataset.action;const mapping={left:'a',right:'d',jump:' ',punch:'j',grab:'k'};btn.addEventListener('pointerdown',e=>{e.preventDefault();const key=mapping[action];if(!keys.has(key))pressed.add(key);keys.add(key);});for(const ev of ['pointerup','pointerleave','pointercancel'])btn.addEventListener(ev,()=>keys.delete(mapping[action]));});

function impact(victim, attacker, force, region){
  if(!victim.alive||victim.invuln>0)return;
  victim.invuln=.24;sound('hit');const injuryKey=region==='arm'?(Math.random()<.5?'leftArm':'rightArm'):region==='leg'?(Math.random()<.5?'leftLeg':'rightLeg'):region;
  const old=victim.stress[injuryKey]||0;victim.stress[injuryKey]=Math.min(130,old+force*.84);
  const fractured=victim.stress[injuryKey]>=78;
  if(!victim.injuries[injuryKey]&&victim.stress[injuryKey]>=32){
    const names={head:'Concussion',ribs:'Bruised ribs',leftArm:'Arm fracture',rightArm:'Arm fracture',leftLeg:'Leg fracture',rightLeg:'Leg fracture'};
    victim.injuries[injuryKey]={name:fractured?names[injuryKey]:injuryKey==='head'?'Dazed':injuryKey==='ribs'?'Rib contusion':injuryKey.includes('Arm')?'Arm contusion':'Leg contusion',fracture:fractured};
    if(victim===player)toast(fractured?'BONE FRACTURE':'INJURY — '+victim.injuries[injuryKey].name.toUpperCase());
  }else if(victim.injuries[injuryKey]&&!victim.injuries[injuryKey].fracture&&fractured){victim.injuries[injuryKey].fracture=true;victim.injuries[injuryKey].name=injuryKey==='ribs'?'Rib fracture':injuryKey==='head'?'Concussion':'Bone fracture';if(victim===player)toast('BONE FRACTURE');}
  const damage=Math.max(2,force*.22);victim.hp=Math.max(0,victim.hp-damage);
  const dir=new THREE.Vector3().subVectors(victim.group.position,attacker.group.position);dir.y=0;dir.normalize();victim.velocity.x+=dir.x*force*.065;victim.velocity.z+=dir.z*force*.065;victim.velocity.y+=Math.min(.95,force*.012);
  victim.action='hit';victim.actionTime=.37;shake=Math.min(.35,force*.006);
  if(victim.hp<=0){victim.alive=false;victim.action='down';victim.actionTime=2;}
  updateHud();
}
function startAttack(fighter,type,target){
  if(fighter.attackCooldown>0||fighter.stamina<8||!fighter.alive||fighter.grabbed>0)return;
  fighter.action=type;fighter.actionTime=type==='punch'?.42:.65;fighter.attackCooldown=type==='punch'?.58:1.15;fighter.stamina-=type==='punch'?8:13;
  const delta=new THREE.Vector3().subVectors(target.group.position,fighter.group.position);const distance=delta.length();delta.normalize();
  const facingDot=delta.dot(fighter.facing);
  if(type==='punch'&&distance<1.6&&facingDot>.15&&target.invuln<=0){
    const region=Math.random()<.2?'head':Math.random()<.57?'ribs':'arm';impact(target,fighter,22+Math.random()*12,region);
    toast(target===bot?'CLEAN HIT':'GOT CLOCKED');
  }
  if(type==='grab'&&distance<1.42&&facingDot>-.1&&target.grabbed<=0){
    target.grabbed=.48;target.velocity.multiplyScalar(.25);fighter.action='grab';fighter.actionTime=.5;fighter.throwTimer=.35;fighter.throwTarget=target;
  }
}
function updateFighter(f,other,dt,isPlayer){
  f.attackCooldown=Math.max(0,f.attackCooldown-dt);f.invuln=Math.max(0,f.invuln-dt);f.grabbed=Math.max(0,f.grabbed-dt);f.actionTime=Math.max(0,f.actionTime-dt);
  if(f.throwTimer>0){f.throwTimer=Math.max(0,f.throwTimer-dt);if(f.throwTimer===0&&running&&f.alive&&f.throwTarget?.alive){const target=f.throwTarget,d=new THREE.Vector3().subVectors(target.group.position,f.group.position);d.y=0;d.normalize();target.velocity.addScaledVector(d,10);target.velocity.y=2.3;target.grabbed=0;impact(target,f,39,'ribs');sound('throw');toast(f===player?'YEET!':'THROWN!');}f.throwTarget=null;}
  if(f.actionTime===0&&['punch','grab','hit'].includes(f.action))f.action='idle';
  const toward=new THREE.Vector3().subVectors(other.group.position,f.group.position);toward.y=0;
  if(toward.lengthSq()>.01)f.facing.lerp(toward.normalize(),Math.min(1,dt*7)).normalize();
  let moveX=0,moveZ=0;
  if(isPlayer){moveX=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);moveZ=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
    if(pressed.has(' ')&&f.grounded&&f.stamina>10){f.velocity.y=6.3;f.grounded=false;f.stamina-=8;sound('jump');}
    if(pressed.has('j'))startAttack(f,'punch',other);if(pressed.has('k'))startAttack(f,'grab',other);
  }else if(running&&f.alive&&f.grabbed<=0){
    const d=toward.length();if(d>1.18){moveX=toward.x;moveZ=toward.z;}
    if(d<1.62&&f.attackCooldown<=0&&Math.random()<dt*1.65)startAttack(f,Math.random()<.68?'punch':'grab',other);
    if(d>3.1&&f.grounded&&Math.random()<dt*.13&&f.stamina>20){f.velocity.y=5;f.grounded=false;}
  }
  const injuryScale=Object.values(f.injuries).some(i=>i.fracture)?.72:1;
  const move=new THREE.Vector3(moveX,0,moveZ);if(move.lengthSq()>1)move.normalize();
  const accel=(f.grabbed>0?0:1)*injuryScale;
  const speed=(!f.alive||f.action==='hit'||f.action==='down'?0:4.7)*accel;
  f.velocity.x+=(move.x*speed-f.velocity.x)*Math.min(1,dt*(move.lengthSq()?8:4));f.velocity.z+=(move.z*speed-f.velocity.z)*Math.min(1,dt*(move.lengthSq()?8:4));
  f.group.position.x+=f.velocity.x*dt;f.group.position.z+=f.velocity.z*dt;
  f.velocity.y-=17*dt;f.group.position.y+=f.velocity.y*dt;
  if(f.group.position.y<0){f.group.position.y=0;f.velocity.y=0;f.grounded=true;}
  f.velocity.x*=Math.pow(.08,dt);f.velocity.z*=Math.pow(.08,dt);
  // Boundary: kick back from the rail, and ring-outs count as a knockdown.
  const radius=Math.hypot(f.group.position.x,f.group.position.z);
  if(radius>6.48){const n=new THREE.Vector3(f.group.position.x,0,f.group.position.z).normalize();f.group.position.x=n.x*6.48;f.group.position.z=n.z*6.48;f.velocity.addScaledVector(n,-3.3);f.hp=Math.max(0,f.hp-2);if(radius>7.5)impact(f,other,32,'ribs');}
  if(f.alive&&f.stamina<100)f.stamina=Math.min(100,f.stamina+dt*(f.action==='idle'?13:5));
  f.walk+=dt*(move.lengthSq()?10:3);
  const run=move.lengthSq()>.01&&f.grounded&&f.action==='idle';
  const swing=run?Math.sin(f.walk)*.5:0;
  f.legs.forEach((leg,i)=>{leg.rotation.x=run?Math.sin(f.walk+i*Math.PI)*.52:0;});
  f.arms.forEach((arm,i)=>{arm.rotation.x=run?-Math.sin(f.walk+i*Math.PI)*.36:0;arm.rotation.z=0;});
  if(f.action==='punch'){const side=f.attackCooldown>.3?0:1;f.arms[side].rotation.x=-1.85+f.actionTime*1.3;f.arms[side].rotation.z=side===0?.35:-.35;}
  if(f.action==='grab'){f.arms[0].rotation.x=-1.15;f.arms[1].rotation.x=-1.15;}
  if(f.action==='hit'||f.action==='down'){f.torso.rotation.z=(f===player?1:-1)*Math.min(.8,f.actionTime*1.4);f.arms.forEach(a=>a.rotation.x=-1.2);}else f.torso.rotation.z*=Math.pow(.04,dt);
  f.group.rotation.y=Math.atan2(f.facing.x,f.facing.z);
  f.group.position.y+=(run?Math.abs(swing)*.025:0);
  if(f===player)updateHud();
}
function updateHud(){
  $('#player-health').style.width=`${player.hp}%`;$('#player-hp-text').textContent=Math.ceil(player.hp);$('#player-stamina').style.width=`${player.stamina}%`;
  $('#player-health').style.background=player.hp<30?'#ff705f':'#53c7ef';$('#bot-health').style.width=`${bot.hp}%`;
  const list=$('#player-injuries');const entries=Object.entries(player.injuries);
  list.innerHTML=entries.length?entries.map(([key,item])=>`<div class="injury-entry"><i></i>${item.name}<small>${item.fracture?'FRACTURE':'CONTUSION'}</small></div>`).join(''):'<div class="injury-clear"><i>✓</i> No injuries detected</div>';
  const dots={head:document.querySelector('.dot-head'),ribs:document.querySelector('.dot-ribs'),leftArm:document.querySelector('.dot-arm')};
  for(const [key,dot] of Object.entries(dots)){const stress=player.stress[key]||0;dot.classList.toggle('stressed',stress>=16);dot.classList.toggle('fractured',stress>=78);}
}
function finishRound(){running=false;gameOver=true;const message=$('#center-message');message.classList.remove('hidden');
  const title=player.hp<=0?'KNOCKOUT':'bot';const win=bot.hp<=0||player.hp>bot.hp;message.querySelector('span').textContent=win?'RING VICTORY':'TAKE THE L';message.querySelector('small').textContent=player.hp<=0?'RIVET IS DOWN':bot.hp<=0?'GRIT IS DOWN':'TIME EXPIRED';$('#start-btn').innerHTML='RUN IT BACK <span>↻</span>';toast(win?'YOU OWN THE ROOF':'GRIT TAKES IT');}
const clock=new THREE.Timer();clock.connect(document);
function frame(){requestAnimationFrame(frame);clock.update();const elapsed=clock.getDelta();const dt=Math.min(.04,elapsed);
  if(running){timeLeft=Math.max(0,timeLeft-elapsed);const tenths=Math.ceil(timeLeft*10);const seconds=Math.floor(tenths/10);$('#timer').innerHTML=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}<span>.${tenths%10}</span>`;
    updateFighter(player,bot,dt,true);updateFighter(bot,player,dt,false);
    // Keep fighters separated while preserving the soft, knockback-heavy feel.
    const gap=new THREE.Vector3().subVectors(bot.group.position,player.group.position);gap.y=0;if(gap.length()<.86&&gap.length()>.001){gap.normalize();player.group.position.addScaledVector(gap,-.018);bot.group.position.addScaledVector(gap,.018);}
    if(bot.hp<=0||player.hp<=0||timeLeft<=0)finishRound();
  }
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('#combat-toast').classList.remove('show');}
  shake=Math.max(0,shake-dt*.7);camera.position.x+=(Math.sin(performance.now()*.09)*shake-camera.position.x)*dt*3;camera.lookAt(0,1.15,0);
  pressed.clear();renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
updateHud();frame();
