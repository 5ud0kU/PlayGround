import * as THREE from 'three';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#96836c');
scene.fog = new THREE.FogExp2('#95836d', 0.0125);
const camera = new THREE.PerspectiveCamera(69, innerWidth / innerHeight, .08, 240);
scene.add(camera);
let lastFrame = performance.now();
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const mat = (color, roughness=1, extra={}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const mats = {
  earth: mat('#655a40'), grass: mat('#4c5435'), grassLight: mat('#6b6b3f'), road: mat('#393a36'), roadEdge: mat('#71674f'),
  bark: mat('#40382a'), leaf: mat('#3c4933'), leaf2: mat('#566044'), rock: mat('#716957'),
  rusty: mat('#57483b'), white: mat('#d5cdbc'), cloth: mat('#aaa596'), black: mat('#23221e'),
};
scene.add(new THREE.HemisphereLight('#e2cfad', '#354033', 1.6));
const sun = new THREE.DirectionalLight('#f0c998', 2.45); sun.position.set(-35, 55, 24); scene.add(sun);
const fill = new THREE.DirectionalLight('#b4b8aa', .5); fill.position.set(25, 16, -25); scene.add(fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(500,500), mats.earth); ground.rotation.x=-Math.PI/2; ground.position.y=-.11; scene.add(ground);
const horizon = new THREE.Mesh(new THREE.SphereGeometry(160,28,18), new THREE.MeshBasicMaterial({color:'#827a66',side:THREE.BackSide})); horizon.position.y=8; scene.add(horizon);
// Distant folded hills frame the valley.
for(let i=0;i<11;i++){
  const h=12+Math.sin(i*1.7)*5, w=19+(i%4)*8;
  const hill=new THREE.Mesh(new THREE.ConeGeometry(w,h,7), mat(i%2?'#69705a':'#77755f'));
  hill.position.set(-100+i*21,h/2-2,-83-(i%3)*17); hill.rotation.y=i*1.9; scene.add(hill);
}
const route = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0,0,24),new THREE.Vector3(0,0,14),new THREE.Vector3(0,0,5),new THREE.Vector3(1,0,-1),
  new THREE.Vector3(8,0,-8),new THREE.Vector3(18,0,-9),new THREE.Vector3(23,0,-5),new THREE.Vector3(24,0,3),new THREE.Vector3(26,0,13),new THREE.Vector3(28,0,24)
], false,'centripetal');
const roadLength=route.getLength();
function at(t, side=0, y=0){const p=route.getPointAt(clamp(t,0,1));const d=route.getTangentAt(clamp(t,0,1));return new THREE.Vector3(p.x-d.z*side,y,p.z+d.x*side)}
function ribbon(curve,width,material,offset=0){
  const verts=[],inds=[],n=260;
  for(let i=0;i<=n;i++){const t=i/n,p=curve.getPointAt(t),d=curve.getTangentAt(t),nx=-d.z,nz=d.x;verts.push(p.x+nx*width/2,p.y+offset,p.z+nz*width/2,p.x-nx*width/2,p.y+offset,p.z-nz*width/2);if(i<n){const a=i*2,b=a+1,c=a+2,e=a+3;inds.push(a,b,c,b,e,c)}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(inds);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
ribbon(route,5.5,mats.roadEdge,-.015); ribbon(route,4.2,mats.road,0);
// Weathered road-edge dashes and scattered shoulder gravel.
for(let i=0;i<90;i++){
  const t=(i+Math.random())/90, side=i%2?1:-1,p=at(t,side*(2.9+Math.random()*1.7),-.035);
  const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.06+Math.random()*.15,0),i%4===0?mats.rock:mats.earth);
  rock.position.copy(p);rock.scale.y=.35;rock.rotation.set(Math.random(),Math.random(),Math.random());scene.add(rock);
}
// Soft, rolling farmland and rows of orchard trees.
for(let i=0;i<150;i++){
  const x=(Math.random()-.5)*140,z=(Math.random()-.5)*155;
  if(Math.abs(x)<8&&z>0&&z<26)continue;
  const blade=new THREE.Mesh(new THREE.ConeGeometry(.13+Math.random()*.23,.45+Math.random()*.8,4),i%3?mats.grass:mats.grassLight);
  blade.position.set(x,-.15,z);blade.rotation.y=Math.random()*6.2;scene.add(blade);
}
function tree(x,z,s=1,lean=0){
  const group=new THREE.Group();group.position.set(x,0,z);group.rotation.z=lean;scene.add(group);
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.13*s,.24*s,2.4*s,7),mats.bark);trunk.position.y=1.2*s;group.add(trunk);
  for(let j=0;j<3;j++){const crown=new THREE.Mesh(new THREE.DodecahedronGeometry((1.05-j*.12)*s,1),j===1?mats.leaf2:mats.leaf);crown.position.set((j%2-.5)*.24*s,(2.25+j*.62)*s,0);crown.scale.set(1,.92,.95);group.add(crown)}
  return group;
}
for(let i=0;i<74;i++){
  const t=(i%37)/37, side=i<37?-1:1, base=at(t,side*(8+Math.random()*23));
  tree(base.x,base.z,.65+Math.random()*1.05,(Math.random()-.5)*.1);
}
// A few fence lines disappear into the fields.
for(const side of [-1,1]) for(let row=0;row<2;row++){
  const points=[];for(let i=0;i<13;i++)points.push(at(.07+i*.061,side*(10+row*7)));
  const line=new THREE.CatmullRomCurve3(points);
  const wire=new THREE.Mesh(new THREE.TubeGeometry(line,60,.025,4,false),mats.bark);wire.position.y=.7;scene.add(wire);
  for(let i=0;i<points.length;i+=3){const post=new THREE.Mesh(new THREE.BoxGeometry(.13,1.05,.13),mats.bark);post.position.set(points[i].x,.4,points[i].z);scene.add(post)}
}
// Scattered abandoned farm sheds far off in the valley.
function shed(x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);const body=new THREE.Mesh(new THREE.BoxGeometry(3*s,2*s,2.4*s),mat('#6a5842'));body.position.y=s;g.add(body);const roof=new THREE.Mesh(new THREE.ConeGeometry(2.4*s,.8*s,4),mat('#3d3c34'));roof.rotation.y=Math.PI/4;roof.position.y=2.35*s;g.add(roof);return g}
shed(-24,-31,1.5);shed(39,-45,1.2);shed(-49,20,1.4);

function makeDeer(){
  const g=new THREE.Group();g.position.copy(at(.215,3.8,.12));g.rotation.y=.4;scene.add(g);
  const hide=mat('#806846'), dark=mat('#493d30');
  const body=new THREE.Mesh(new THREE.SphereGeometry(.83,14,9),hide);body.scale.set(1.3,.52,.52);body.position.y=.57;g.add(body);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.19,.31,.77,9),hide);neck.position.set(.62,.86,.04);neck.rotation.z=-.42;g.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),hide);head.position.set(.88,1.21,.04);g.add(head);
  for(let i=0;i<4;i++){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,.49,6),dark);leg.position.set((i<2?.48:-.48),.25,i%2?.28:-.28);leg.rotation.z=(i<2?.15:-.08);g.add(leg)}
  // Rope and a plain canvas shroud suggest the discovery without showing gore.
  const rope=new THREE.Mesh(new THREE.TorusGeometry(.24,.035,6,16),mat('#b4a07a'));rope.position.set(.7,1.3,.04);rope.rotation.x=1.1;g.add(rope);
  return g;
}
const deer=makeDeer();
function altar(){
 const g=new THREE.Group();g.position.copy(at(.385,4.9,.05));g.rotation.y=-.5;scene.add(g);
 const block=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.25,1.1),mat('#4b4035'));block.position.y=.62;g.add(block);
 const top=new THREE.Mesh(new THREE.BoxGeometry(1.75,.16,1.3),mat('#392c27'));top.position.y=1.32;g.add(top);
 const vinyl=new THREE.Mesh(new THREE.CylinderGeometry(.64,.64,.035,32),mat('#171817'));vinyl.position.set(-1.1,.5,0);g.add(vinyl);
 const spindle=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.12,8),mat('#928771'));spindle.position.set(-1.1,.57,0);g.add(spindle);
 for(let i=0;i<3;i++){const blade=new THREE.Mesh(new THREE.BoxGeometry(.08,.75,.12),mat('#a89a80'));blade.position.set(1.15,.42,i*.24-.24);blade.rotation.z=.55;g.add(blade)}
 for(let i=0;i<3;i++){const jar=new THREE.Mesh(new THREE.CylinderGeometry(.17,.14,.19,8),mat(i===1?'#79664d':'#776e5b'));jar.position.set(-.35,.86,i*.36-.36);g.add(jar)}
 return g;
}
const altarGroup=altar();
function tarp(xoff=0){
 const g=new THREE.Group();g.position.copy(at(.652,-2.5+xoff,.05));g.rotation.y=.22+xoff*.2;scene.add(g);
 for(let i=0;i<2;i++){
  const roll=new THREE.Mesh(new THREE.CylinderGeometry(.35,.38,2.3,12,1),mat(i?'#524e43':'#6a6557'));
  roll.rotation.z=Math.PI/2;roll.rotation.x=(i-.5)*.05;roll.position.set(i*.65-.36,.4,i*.43-.22);g.add(roll);
  const tie=new THREE.Mesh(new THREE.TorusGeometry(.37,.025,5,16),mat('#8c806a'));tie.rotation.y=Math.PI/2;tie.position.set(i*.65-.36,.4,i*.43-.22);g.add(tie);
 }
 return g;
}
const tarps=tarp();
// Ritual-site debris: broken pots, a crate and rough stakes.
const altarPos=at(.39,4.8);
for(let i=0;i<8;i++){const a=i*Math.PI/4;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.2+Math.random()*.28,0),i%2?mats.rock:mats.bark);rock.position.set(altarPos.x+Math.cos(a)*2,.1,altarPos.z+Math.sin(a)*2);scene.add(rock)}

// The watcher appears only after the tarps are found.
function makeLady(){
 const g=new THREE.Group();
 const fabric=new THREE.MeshStandardMaterial({color:'#ded9ca',roughness:.92,side:THREE.DoubleSide});
 const dressGeo=new THREE.CylinderGeometry(.18,.67,1.45,16,1);dressGeo.translate(0,.95,0);
 const gown=new THREE.Mesh(dressGeo,fabric);g.add(gown);
 const torso=new THREE.Mesh(new THREE.CylinderGeometry(.22,.3,.62,12),fabric);torso.position.y=1.68;g.add(torso);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.22,16,12),mat('#c6c0b4'));head.position.y=2.16;g.add(head);
 const veil=new THREE.Mesh(new THREE.SphereGeometry(.245,16,10,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:'#d2cdbf',transparent:true,opacity:.66,side:THREE.DoubleSide}));veil.position.y=2.2;g.add(veil);
 for(const side of [-1,1]){const arm=new THREE.Mesh(new THREE.CylinderGeometry(.075,.09,.75,9),fabric);arm.position.set(side*.34,1.54,.02);arm.rotation.z=side*.16;g.add(arm);}
 // A dark hollow where a face ought to be, visible only at close range.
 const face=new THREE.Mesh(new THREE.SphereGeometry(.105,12,8),new THREE.MeshBasicMaterial({color:'#171719'}));face.position.set(0,2.14,.2);face.scale.set(.9,1,.45);g.add(face);
 g.visible=false;scene.add(g);return g;
}
const lady=makeLady();const ladyHome=at(.49,9,.03);lady.position.copy(ladyHome);
// Sleep scene: small, still bedroom; window moonlight, bed and bedside silhouette.
const bedroom=new THREE.Group();bedroom.visible=false;scene.add(bedroom);
const roomMat=mat('#373837'), wallMat=mat('#4b4b47'), wood=mat('#493b30'), linen=mat('#9a9280');
const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),mat('#393632'));floor.rotation.x=-Math.PI/2;floor.position.y=-.12;bedroom.add(floor);
const backWall=new THREE.Mesh(new THREE.PlaneGeometry(12,5),wallMat);backWall.position.set(0,2.35,-4);bedroom.add(backWall);
const sideWall=new THREE.Mesh(new THREE.PlaneGeometry(12,5),roomMat);sideWall.position.set(-6,2.35,0);sideWall.rotation.y=Math.PI/2;bedroom.add(sideWall);
const rightWall=new THREE.Mesh(new THREE.PlaneGeometry(12,5),roomMat);rightWall.position.set(6,2.35,0);rightWall.rotation.y=-Math.PI/2;bedroom.add(rightWall);
const frontWall=new THREE.Mesh(new THREE.PlaneGeometry(12,5),wallMat);frontWall.position.set(0,2.35,6);frontWall.rotation.y=Math.PI;bedroom.add(frontWall);
const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(12,12),mat('#292a2b'));ceiling.rotation.x=Math.PI/2;ceiling.position.y=4.85;bedroom.add(ceiling);
const winFrame=new THREE.Mesh(new THREE.BoxGeometry(2.6,2.2,.15),wood);winFrame.position.set(2.2,2.65,-3.88);bedroom.add(winFrame);
const windowGlow=new THREE.Mesh(new THREE.PlaneGeometry(2.38,1.98),new THREE.MeshBasicMaterial({color:'#8292a2'}));windowGlow.position.set(2.2,2.65,-3.79);bedroom.add(windowGlow);
const cross1=new THREE.Mesh(new THREE.BoxGeometry(.045,2,.03),wood);cross1.position.set(2.2,2.65,-3.72);bedroom.add(cross1);
const cross2=new THREE.Mesh(new THREE.BoxGeometry(2.4,.045,.03),wood);cross2.position.set(2.2,2.65,-3.72);bedroom.add(cross2);
const bedBase=new THREE.Mesh(new THREE.BoxGeometry(3.2,.55,4),wood);bedBase.position.set(0,.02,1);bedroom.add(bedBase);
const mattress=new THREE.Mesh(new THREE.BoxGeometry(3.05,.42,3.8),linen);mattress.position.set(0,.42,1);bedroom.add(mattress);
const duvet=new THREE.Mesh(new THREE.BoxGeometry(3.08,.32,2.55),mat('#77786e'));duvet.position.set(0,.79,1.66);bedroom.add(duvet);
for(let x of [-1.12,1.12]){const pillow=new THREE.Mesh(new THREE.BoxGeometry(.88,.22,.62),mat('#c3b9a2'));pillow.position.set(x,.76,-.38);bedroom.add(pillow)}
const footboard=new THREE.Mesh(new THREE.BoxGeometry(3.2,.95,.16),wood);footboard.position.set(0,.52,3.04);bedroom.add(footboard);
const nightstand=new THREE.Mesh(new THREE.BoxGeometry(.85,.9,.8),wood);nightstand.position.set(-2,.35,-.2);bedroom.add(nightstand);
const lampBase=new THREE.Mesh(new THREE.CylinderGeometry(.14,.2,.3,10),mat('#5f5240'));lampBase.position.set(-2,.98,-.2);bedroom.add(lampBase);
const lampShade=new THREE.Mesh(new THREE.ConeGeometry(.3,.48,10,1,true),mat('#b0a78e'));lampShade.position.set(-2,1.35,-.2);bedroom.add(lampShade);
const moon=new THREE.DirectionalLight('#9aaabc',1.8);moon.position.set(3,4,-2);bedroom.add(moon);
const roomAmbient=new THREE.HemisphereLight('#718096','#252421',.48);bedroom.add(roomAmbient);
const nightLady=makeLady();nightLady.visible=false;bedroom.add(nightLady);nightLady.position.set(0,0,-1.8);nightLady.rotation.y=Math.PI;

// HUD and narrative progression.
const ui={hud:document.querySelector('#hud'),intro:document.querySelector('#intro-screen'),interlude:document.querySelector('#interlude'),ending:document.querySelector('#ending-screen'),loading:document.querySelector('#loading'),objective:document.querySelector('#objective'),chapter:document.querySelector('#chapter-label'),clock:document.querySelector('#clock'),prompt:document.querySelector('#prompt'),promptText:document.querySelector('#prompt-text'),subtitles:document.querySelector('#subtitles'),touchInteract:document.querySelector('#touch-interact'),soundState:document.querySelector('#sound-state'),sheet:document.querySelector('#sheet-shadow')};
let mode='intro', progress=.005, yaw=0, pitch=0, lookYaw=0, lookPitch=0, unlocked=false, clueDeer=false, clueRitual=false, clueTarps=false, ladySeen=false, sleepTime=0, covered=0, subtitleTimer=0, time=0;
const keys=new Set(), touchMove=new Set();const touchDevice=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;let actionReady=false;
const joystickState={active:false,x:0,y:0,dx:0,dy:0};
const hotspots=[{t:.215,range:.042,id:'deer'},{t:.39,range:.05,id:'altar'},{t:.652,range:.055,id:'tarps'}];
function tell(text,duration=4){ui.subtitles.textContent=text;ui.subtitles.classList.add('show');subtitleTimer=duration;}
function startWalk(){mode='walk';unlocked=true;ui.intro.hidden=true;ui.hud.hidden=false;ui.objective.textContent='Follow the road downhill.';ui.chapter.textContent="DEVIL'S CURB";document.querySelector('#control-hint').textContent=touchDevice?'JOYSTICK TO MOVE · DRAG TO LOOK · TAP USE NEAR CLUES':'WASD TO WALK · MOUSE TO LOOK';progress=.005;positionWalker();audioStart();if(matchMedia('(pointer:fine)').matches)canvas.requestPointerLock?.();tell('“So we should be safe.”',3.3)}
function positionWalker(){const p=at(progress,0,0);camera.position.set(p.x,1.68,p.z);const tangent=route.getTangentAt(clamp(progress,0,1));const heading=Math.atan2(-tangent.x,-tangent.z);camera.rotation.order='YXZ';camera.rotation.set(pitch,heading+yaw,0)}
function interact(){
 if(mode!=='walk')return;
 const h=hotspots.find(o=>Math.abs(progress-o.t)<o.range);
 if(!h)return;
 if(h.id==='deer'&&!clueDeer){clueDeer=true;tell('A dead deer. Rope at its neck. And the other bodies scattered around it.');ui.objective.textContent='Keep going. The smell gets worse downhill.';return}
 if(h.id==='altar'&&!clueRitual){clueRitual=true;tell('A record player. Knives. Something like a pulpit. This isn’t just local gossip.');return}
 if(h.id==='tarps'&&!clueTarps){clueTarps=true;mode='escape';lady.visible=true;ladySeen=true;ui.objective.textContent='Run back up the hill. Hold S / ↓ to retreat.';document.querySelector('#control-hint').textContent=touchDevice?'PULL JOYSTICK DOWN TO RUN BACK · DRAG TO LOOK':'HOLD S / ↓ TO RUN BACK';ui.chapter.textContent='THE OVERLOOK';tell('The smell turns your stomach. Something is rolled up inside. You feel someone watching.',5);return}
}
function advanceNight(){if(mode!=='interlude')return;mode='night';ui.interlude.hidden=true;bedroom.visible=true;scene.background=new THREE.Color('#161a22');scene.fog=new THREE.FogExp2('#161a22',.04);scene.add(new THREE.AmbientLight('#bac2d0',.18));camera.fov=65;camera.updateProjectionMatrix();camera.position.set(0,1.25,4.7);camera.rotation.order='YXZ';camera.rotation.set(-.04,0,0);nightLady.visible=true;nightLady.position.set(.35,-.2,-1.65);sleepTime=0;ui.chapter.textContent='3:07 AM';ui.objective.textContent='Something is at the foot of your bed.';ui.clock.textContent='3:07 AM';document.querySelector('#control-hint').textContent=touchDevice?'HOLD HIDE TO STAY UNDER THE COVERS':'HOLD SPACE TO HIDE UNDER THE COVERS';ui.touchInteract.textContent='HIDE';ui.touchInteract.setAttribute('aria-label','Hold to hide under the covers');tell('You wake with the feeling that someone is close.',4);}
function finish(){mode='ending';ui.hud.hidden=true;ui.ending.hidden=false;}

// A narrow creek catches the late-afternoon light below the overlook.
const water=new THREE.Mesh(new THREE.PlaneGeometry(34,7),new THREE.MeshStandardMaterial({color:'#5a6259',roughness:.27,metalness:.18,transparent:true,opacity:.84}));water.rotation.x=-Math.PI/2;water.position.set(-5,-.025,-32);scene.add(water);
for(let i=0;i<16;i++){const reed=new THREE.Mesh(new THREE.CylinderGeometry(.025,.055,.8+Math.random(),5),mats.grassLight);reed.position.set(-22+i*2.2,.35,-27+(i%3)*1.5);reed.rotation.z=(Math.random()-.5)*.24;scene.add(reed)}

// Audio is generated locally: restrained wind and insects, no external files.
let audio=null, audioOn=true;
function audioStart(){
 if(audio||!audioOn)return;
 try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;audio=new C();
  const master=audio.createGain();master.gain.value=.12;master.connect(audio.destination);
  const osc=audio.createOscillator(),gain=audio.createGain(),filter=audio.createBiquadFilter();osc.type='triangle';osc.frequency.value=56;filter.type='lowpass';filter.frequency.value=160;gain.gain.value=.32;osc.connect(filter);filter.connect(gain);gain.connect(master);osc.start();
  const insect=audio.createOscillator(),ig=audio.createGain();insect.type='sine';insect.frequency.value=2900;ig.gain.value=.006;insect.connect(ig);ig.connect(master);insect.start();
  audio.master=master;audio.wind=gain;audio.osc=osc;
 }catch{}
}
function toggleSound(){audioOn=!audioOn;ui.soundState.textContent=audioOn?'ON':'OFF';if(audio?.master)audio.master.gain.setTargetAtTime(audioOn?.12:0,audio.currentTime,.12);else if(audioOn&&mode!=='intro')audioStart()}

function nearPrompt(){return mode==='walk'&&hotspots.some(o=>Math.abs(progress-o.t)<o.range)}
function update(dt){
 time+=dt;
 if(mode==='walk'||mode==='escape'){
  const moveX=joystickState.active?joystickState.dx:0;
  const moveY=joystickState.active?joystickState.dy:0;
  const forward=keys.has('w')||keys.has('arrowup')||touchMove.has('forward');
  const back=keys.has('s')||keys.has('arrowdown')||touchMove.has('back');
  const turnLeft=keys.has('a')||keys.has('arrowleft')||touchMove.has('left');
  const turnRight=keys.has('d')||keys.has('arrowright')||touchMove.has('right');
  const speed=mode==='escape'?8.1:4.7;
  const verticalInput=forward?1:back?-1:Math.abs(moveY)>.12?-moveY:0;
  const horizontalInput=turnLeft?1:turnRight?-1:Math.abs(moveX)>.12?-moveX:0;
  progress+=verticalInput*dt*speed/roadLength;
  yaw=clamp(yaw+horizontalInput*dt*1.35,-1.15,1.15);
  progress=clamp(progress,.005,clueTarps?1:.705);
  positionWalker();
  ui.clock.textContent=progress<.18?'4:32 PM':progress<.4?'4:26 PM':progress<.66?'4:21 PM':'4:18 PM';
  if(mode==='walk'&&progress>.69&&!clueTarps){ui.objective.textContent='Look around the overlook. (Press E)'}
  if(mode==='escape'){
   if(!ladySeen&&progress<.57){lady.visible=true;ladySeen=true;}
   if(progress<.52&&progress>.455){lady.visible=true;const look=at(progress,0);lady.lookAt(look.x,1.2,look.z);}
   if(progress<=.008){mode='interlude';ui.hud.hidden=true;ui.interlude.hidden=false;lady.visible=false;}
  }
  const h=hotspots.find(o=>Math.abs(progress-o.t)<o.range);
  ui.prompt.hidden=!(h&&mode==='walk');
  if(h&&mode==='walk')ui.promptText.textContent=h.id==='deer'?'Examine the deer':h.id==='altar'?'Look closer':'Look at the tarps';
  ui.touchInteract.textContent=touchDevice?(h?'EXAMINE':'USE'):(h?'LOOK':'E');ui.touchInteract.setAttribute('aria-label',h?'Examine clue':'Use');
  if(mode==='escape'&&progress<.55&&progress>.44){const pulse=.5+.5*Math.sin(time*1.3);lady.children.forEach(c=>{if(c.material?.transparent)c.material.opacity=.5+pulse*.18})}
 } else ui.prompt.hidden=true;
 if(mode==='night'){
  sleepTime+=dt;
  const hiding=keys.has(' ')||touchMove.has('hide');
  if(hiding){covered+=dt;ui.sheet.classList.add('covered');ui.objective.textContent='Keep still. Don’t look.';}
  else{ui.sheet.classList.remove('covered');if(covered<3.2)covered=0;}
  if(covered>3.1){nightLady.visible=false;ui.objective.textContent='Wait for the morning light.';}
  if(!hiding&&covered>3.1)sleepTime+=dt*1.3;
  if(sleepTime>15&&!hiding&&covered<3.1){nightLady.position.z=-.1;ui.objective.textContent='Hold SPACE to hide under the covers.';}
  if(sleepTime>18&&covered<3.1){covered=3.2;nightLady.visible=false;ui.sheet.classList.remove('covered');}
  if(covered>3.1&&sleepTime>8){finish();}
  const approach=clamp((sleepTime-3)/10,0,1);if(nightLady.visible)nightLady.position.z=mix(-1.65,.25,approach);
  ui.clock.textContent=sleepTime>4?'3:08 AM':'3:07 AM';
 }
 if(subtitleTimer>0){subtitleTimer-=dt;if(subtitleTimer<=0)ui.subtitles.classList.remove('show')}
}
function frame(){requestAnimationFrame(frame);const now=performance.now();const dt=Math.min((now-lastFrame)/1000,.045);lastFrame=now;update(dt);
 if(mode==='night'){
  // The bedroom camera stays still; only a trace of breathing disturbs the frame.
  camera.position.y=1.25+Math.sin(time*1.3)*.008;
  camera.rotation.y=lookYaw;camera.rotation.x=-.04+lookPitch;
 }
 if(mode==='walk'||mode==='escape'){
  // The veil and treetops move almost imperceptibly in the heat.
  lady.position.y=mode==='escape'&&lady.visible?.08+Math.sin(time*1.2)*.07:lady.position.y;
 }
 renderer.render(scene,camera)}
frame();

// Inputs: keyboard + pointer lock on desktop; large, gesture-safe touch pads on phones.
document.querySelector('#start-button').addEventListener('click',startWalk);
document.querySelector('#night-button').addEventListener('click',advanceNight);
document.querySelector('#again-button').addEventListener('click',()=>location.reload());
window.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();keys.add(key);
 if(key==='e'&&!e.repeat)interact();
 if(key==='escape'&&mode==='walk'&&document.pointerLockElement)document.exitPointerLock();
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
canvas.addEventListener('click',()=>{if(mode==='walk'&&matchMedia('(pointer:fine)').matches&&!document.pointerLockElement)canvas.requestPointerLock?.()});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){yaw=clamp(yaw-e.movementX*.0022,-1.35,1.35);pitch=clamp(pitch-e.movementY*.0018,-.52,.52)}});
let touchLook=null;
document.querySelector('#game').addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!e.target.closest('button, #touch-controls'))touchLook={id:e.pointerId,x:e.clientX,y:e.clientY}});
document.querySelector('#game').addEventListener('pointermove',e=>{if(touchLook?.id===e.pointerId){yaw=clamp(yaw-(e.clientX-touchLook.x)*.007,-1.3,1.3);pitch=clamp(pitch-(e.clientY-touchLook.y)*.006,-.5,.5);touchLook.x=e.clientX;touchLook.y=e.clientY}});
window.addEventListener('pointerup',e=>{if(touchLook?.id===e.pointerId)touchLook=null});window.addEventListener('pointercancel',e=>{if(touchLook?.id===e.pointerId)touchLook=null});
const joystickBase=document.querySelector('#joystick-base');
const joystickThumb=document.querySelector('#joystick-thumb');
function resetJoystick(){
 joystickState.active=false;joystickState.x=0;joystickState.y=0;joystickState.dx=0;joystickState.dy=0;
 joystickThumb.style.transform='translate(0px, 0px)';
}
function releaseTouchControls(){touchMove.clear();keys.clear();touchLook=null;resetJoystick()}
window.addEventListener('blur',releaseTouchControls);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseTouchControls()});
function moveJoystick(e){
 if(!joystickState.active)return;
 const rect=joystickBase.getBoundingClientRect();
 const radius=rect.width*.31;
 const rawX=e.clientX-(rect.left+rect.width/2);
 const rawY=e.clientY-(rect.top+rect.height/2);
 const distance=Math.hypot(rawX,rawY);
 const scale=distance>radius?radius/distance:1;
 const x=rawX*scale,y=rawY*scale;
 joystickState.x=x;joystickState.y=y;
 joystickState.dx=x/radius;joystickState.dy=y/radius;
 joystickThumb.style.transform=`translate(${x}px, ${y}px)`;
}
joystickBase.addEventListener('pointerdown',e=>{
 e.preventDefault();joystickState.active=true;joystickBase.setPointerCapture(e.pointerId);moveJoystick(e);
});
joystickBase.addEventListener('pointermove',moveJoystick);
for(const ev of ['pointerup','pointercancel','lostpointercapture'])joystickBase.addEventListener(ev,resetJoystick);
const hideButton=ui.touchInteract;
hideButton.addEventListener('pointerdown',e=>{e.preventDefault();hideButton.setPointerCapture(e.pointerId);if(mode==='night')touchMove.add('hide');else interact()});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])hideButton.addEventListener(ev,()=>touchMove.delete('hide'));
document.querySelector('#sound-toggle').addEventListener('click',toggleSound);
document.querySelector('#sound-toggle').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleSound()}});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7))});
ui.loading.classList.add('done');
