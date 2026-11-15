import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.physicallyCorrectLights = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cb8b5);
scene.fog = new THREE.Fog(0x9cb8b5, 65, 230);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .1, 300);
camera.position.set(0, 1.67, 0);
const player = new THREE.Group(); player.position.set(0, 0, 10); scene.add(player);
player.add(camera);
let yaw = 0, pitch = -.035, locked = false, started = false, verticalVelocity = 0;
const keys = new Set();
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const colliders = [];
const streetLights = [];
const interactables = [];
const npcMeshes = [];
const world = {
  day: 1, minute: 495, weather: 'Clear', temp: 19, balance: 420,
  needs: { energy: 78, hunger: 24, social: 56, stress: 18, hygiene: 82 },
  inventory: { groceries: 1, toiletries: 1, cleaningSupplies: 1, books: 0 }, homeCare: 78,
  occupation: 'Between chapters', skill: 0, reputation: 0, people: [], relations: {}, log: [], events: [],
  city: { jobs: 12, employed: .91, mood: 62, prices: 1, outlook: 'Stable' }, seed: Math.floor(Math.random()*1e8),
  hasWork: false, lastDay: 1
};
const saved = (()=>{try{return JSON.parse(localStorage.getItem('reality-unbound-save')||'null')}catch{return null}})();
const rng = (()=>{let s=world.seed;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}})();
if(saved?.version===1){Object.assign(world,saved.world);world.seed=saved.world.seed;}
world.needs={energy:78,hunger:24,social:56,stress:18,hygiene:82,...world.needs};
world.inventory={groceries:1,toiletries:1,cleaningSupplies:1,books:0,...world.inventory};
world.homeCare=world.homeCare??78;

const mats = {};
const mat = (name,color,roughness=.85,metalness=0)=>mats[name]=new THREE.MeshStandardMaterial({color,roughness,metalness});
mat('grass',0x708b73);mat('road',0x424e4d);mat('sidewalk',0xc0bdae);mat('concrete',0x9b9b8c);mat('brick',0x9c765f);mat('cream',0xd1c4a8);mat('blue',0x6f9290);mat('sage',0x92a58b);mat('glass',0x708c8d,.3,.28);mat('darkglass',0x3c595b,.22,.38);mat('wood',0x705844);mat('leaf',0x64806a);mat('leaf2',0x81906c);mat('white',0xe8e5d7);mat('gold',0xc59957,.32,.5);mat('red',0x9b5b4b);mat('npc1',0x405e60);mat('npc2',0xc29b70);mat('npc3',0x72627d);mat('npc4',0x9a6d61);mat('npc5',0x65816b);mat('skin1',0xd4a17e);mat('skin2',0x9d694d);mat('skin3',0xe1b997);mat('skin4',0x80563f);

// A camera-local pair of hands, plus a body that stays anchored to the player's world position.
const playerBody = new THREE.Group();
const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.25,.48,5,10),mats.blue);
torso.position.set(0,1.02,.04);torso.scale.set(1.25,1.05,.72);torso.castShadow=true;playerBody.add(torso);
const belt = new THREE.Mesh(new THREE.CylinderGeometry(.245,.245,.09,12),mats.road);
belt.position.set(0,.68,.04);playerBody.add(belt);
for(const side of [-1,1]){
  const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.47,4,8),mats.road);
  leg.position.set(side*.13,.34,.03);leg.castShadow=true;playerBody.add(leg);
  const shoe=new THREE.Mesh(new THREE.BoxGeometry(.17,.11,.29),mats.darkglass);
  shoe.position.set(side*.13,.075,-.035);shoe.castShadow=true;playerBody.add(shoe);
}
player.add(playerBody);
const handRig=new THREE.Group();camera.add(handRig);
const handMaterials={sleeve:mats.blue,skin:mats.skin3};
const hands=[];
for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.37,-.34,-.48);handRig.add(arm);
  const forearm=new THREE.Mesh(new THREE.CapsuleGeometry(.085,.38,4,8),handMaterials.sleeve);
  forearm.position.set(-side*.045,-.2,-.08);forearm.rotation.z=side*-.22;forearm.castShadow=true;arm.add(forearm);
  const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.087,.087,.08,10),mats.cream);
  cuff.position.set(-side*.045,-.39,-.08);cuff.rotation.z=side*-.22;arm.add(cuff);
  const palm=new THREE.Mesh(new THREE.BoxGeometry(.13,.085,.15),handMaterials.skin);
  palm.position.set(-side*.045,-.45,-.12);palm.castShadow=true;arm.add(palm);
  const fingers=[];
  for(let f=0;f<4;f++){
    const finger=new THREE.Mesh(new THREE.CapsuleGeometry(.018,.075,2,5),handMaterials.skin);
    finger.rotation.x=Math.PI/2;finger.position.set(-side*.045+(f-1.5)*.032,-.46,-.22);arm.add(finger);fingers.push(finger);
  }
  const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(.022,.065,2,5),handMaterials.skin);
  thumb.position.set(-side*.13,-.43,-.14);thumb.rotation.set(.3,0,side*.7);arm.add(thumb);
  hands.push({arm,rest:arm.position.clone(),side,fingers});
}
let handReach=0,handReachTime=0,walkBob=0,stepDistance=0,fallBob=0;
function box(name,x,y,z,sx,sy,sz,material,shadow=true){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),typeof material==='string'?mats[material]:material);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;scene.add(m);return m}
function cylinder(x,y,z,r,h,material,segments=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(r*.78,r,h,segments),mats[material]);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m}
function addCollider(x,z,sx,sz){colliders.push({x,z,sx,sz})}
function addPlace({name,label,x,z,type='object',color='gold',description='',radius=2.3}){const obj={name,label,x,z,type,description,radius};interactables.push(obj);return obj}
function building(x,z,w,d,h,material,name,kind,description=''){
  box(name,x,h/2,z,w,h,d,material); box('roof',x,h+.07,z,w+.14,.16,d+.14,'wood');
  const floors=Math.floor(h/3), windows=Math.max(2,Math.floor(w/2.5));
  for(let f=0;f<floors;f++) for(let i=0;i<windows;i++){
    const wx=x-w/2+.9+(w-1.8)*(i/Math.max(1,windows-1));
    box('window',wx,1.65+f*2.7,z-d/2-.012,.66,1.08,.035,(f+i)%4===0?'darkglass':'glass',false);
    box('sill',wx,1.1+f*2.7,z-d/2-.05,.78,.08,.08,'white',false);
  }
  box('door',x,h<5?1.15:1.28,z-d/2-.045,1.05,h<5?2.3:2.55,.09,'wood');
  // Cornice, corner trim, and a modest shop plaque break up the large flat facades.
  box('facade cornice',x,h-.28,z-d/2-.08,w,.16,.18,'white',false);
  for(const side of [-1,1])box('corner pilaster',x+side*(w/2-.16),h/2,z-d/2-.045,.16,h-.18,.12,material==='cream'?'white':'cream',false);
  if(['cafe','market','work','clinic','library','civic','school'].includes(kind)){
    box('entrance sign',x,2.85,z-d/2-.11,Math.min(w*.62,6.2),.48,.12,'wood',false);
    box('sign inset',x,2.85,z-d/2-.18,Math.min(w*.56,5.8),.29,.025,'gold',false);
  }
  addCollider(x,z,w+.35,d+.35);
  if(kind) addPlace({name,label:name,x,z:z-d/2-2.0,type:kind,description});
}
function tree(x,z,size=1){cylinder(x,size*.9,z,.19*size,1.8*size,'wood',8);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(size*.85,1),mats[rng()>.5?'leaf':'leaf2']);crown.position.set(x,size*1.9,z);crown.castShadow=true;scene.add(crown);}
function lamp(x,z){cylinder(x,1.7,z,.055,3.4,'wood',8);box('lamp',x,3.35,z,.34,.15,.25,'gold',false);const glow=new THREE.PointLight(0xffc987,0,19,2);glow.position.set(x,3.12,z);scene.add(glow);streetLights.push(glow)}
function bench(x,z,rot=0){const g=new THREE.Group();const seat=new THREE.Mesh(new THREE.BoxGeometry(1.7,.12,.48),mats.wood);seat.position.y=.57;g.add(seat);const back=new THREE.Mesh(new THREE.BoxGeometry(1.7,.65,.1),mats.wood);back.position.set(0,.91,-.19);g.add(back);for(const xx of [-.65,.65]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.09,.55,.09),mats.road);leg.position.set(xx,.28,0);g.add(leg)}g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);addPlace({name:'Park bench',label:'Sit and take a breather',x,z,type:'bench',description:'A quiet place to let the day slow down.'})}
function makeWorld(){
  world.ambient=new THREE.HemisphereLight(0xd5e9e4,0x59604f,1.2);scene.add(world.ambient);
  const sun=new THREE.DirectionalLight(0xffe6c1,3.15);sun.position.set(-35,52,24);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-55;sun.shadow.camera.right=55;sun.shadow.camera.top=55;sun.shadow.camera.bottom=-55;sun.shadow.bias=-.0002;scene.add(sun);world.sun=sun;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(260,260),mats.grass);floor.rotation.x=-Math.PI/2;floor.position.y=-.12;floor.receiveShadow=true;scene.add(floor);
  // Streets, sidewalks and plaza form a walkable, human-scale district.
  box('main street',0,-.045,0,14,.12,210,'road',false);box('cross street',0,-.035,-31,215,.12,12,'road',false);box('cross street',0,-.035,39,215,.12,12,'road',false);
  // Subtle lane paint and pedestrian crossings give the avenue a more lived-in scale.
  for(let z=-99;z<=99;z+=8)box('center lane dash',0,.022,z,.12,.018,3.8,'white',false);
  for(const crossZ of [-31,39])for(const side of [-1,1])for(let x=-6.1;x<=6.1;x+=1.35)box('crosswalk stripe',x,.029,crossZ+side*4.65,.72,.025,1.05,'white',false);
  for(const z of [-6.9,6.9])box('curb',0,.02,z,210,.17,.48,'sidewalk',false);
  for(const x of [-7.2,7.2])box('curb',x,.02,0,.48,.17,210,'sidewalk',false);
  // walkable central pocket park
  box('plaza',30,-.02,0,36,.12,42,'sidewalk',false);box('garden',30,.055,0,24,.08,30,'sage',false);
  for(const [x,z] of [[22,-11],[38,-11],[22,11],[38,11],[20,0],[40,0]])tree(x,z,.9+rng()*.3);
  bench(27,-6);bench(34,7,Math.PI);bench(26,7,Math.PI/2);
  cylinder(30,.23,0,2.2,.36,'concrete',32);cylinder(30,.52,0,1.55,.3,'glass',32);cylinder(30,.72,0,.28,.4,'gold',16);
  // central avenue streetscape and recognizable places
  building(-19,-18,14,12,8,'brick','row homes','home');
  building(-39,-17,17,13,11,'blue','Juniper House','home');
  building(-19,17,14,12,10,'cream','Harborlight Clinic','clinic');
  building(-42,17,17,13,13,'sage','Civic Library','library');
  building(17,-23,14,12,8,'red','Good Day Café','cafe');
  building(43,-23,18,14,11,'cream','Harbor Market','market');
  building(17,24,15,12,12,'blue','Northline Works','work');
  building(44,23,19,15,16,'brick','Municipal Hall','civic');
  building(-70,-12,24,18,13,'cream','Southbank Apartments','home');
  building(-75,20,20,17,17,'brick','Old Exchange','work');
  building(74,-19,25,18,14,'sage','Schoolhouse','school');
  building(77,20,24,18,20,'blue','Harborlight University','school');
  building(-43,-47,18,14,9,'blue','Harborlight Movement Studio','gym');
  building(44,-50,20,14,10,'brick','Northlight Cinema','cinema');
  // Low-density homes beyond the district, trees and small park accents.
  for(const [x,z,c] of [[-90,-45,'cream'],[-62,-48,'blue'],[-24,-56,'sage'],[22,-57,'cream'],[62,-51,'red'],[95,-43,'cream'],[-95,49,'sage'],[-56,55,'cream'],[-15,58,'red'],[20,59,'blue'],[62,54,'cream'],[99,50,'sage']])building(x,z,13,12,6.5,c,'homes','home');
  // Street furniture, bins, and tactile sidewalk details make the public spaces feel inhabited.
  for(const [x,z] of [[-8,-22],[8,-13],[-8,16],[8,29],[-8,53],[8,-48]]){
    cylinder(x,.46,z,.22,.92,'darkglass',10);cylinder(x,.94,z,.24,.08,'wood',10);
  }
  for(const z of [-25,-8,9,27,46,64])for(const x of [-8.05,8.05])box('sidewalk joint',x,.115,z,.035,.012,1.15,'concrete',false);
  for(let i=0;i<42;i++){let x=(rng()-.5)*210,z=(rng()-.5)*170;if(Math.abs(x)<53&&Math.abs(z)<48)continue;if(Math.abs(x)<13||Math.abs(z+31)<8||Math.abs(z-39)<8)continue;tree(x,z,.65+rng()*.65)}
  for(let z=-68;z<80;z+=17){lamp(-9,z);lamp(9,z)}
  // neighborhood service points outside building fronts
  addPlace({name:'Bus stop',label:'Check the local routes',x:11,z:1,type:'bus',description:'A small city, but it does connect.'});
  addPlace({name:'Community noticeboard',label:'Look for a way into work',x:-9,z:-2,type:'board',description:'Shift listings, neighborhood needs, and things people leave behind.'});
  addPlace({name:'Harbor overlook',label:'Take in the neighborhood',x:51,z:1,type:'view',description:'The whole district seems to be going somewhere.'});
  // distant silhouettes soften the horizon
  for(let i=0;i<18;i++){const x=-115+i*13;const h=15+rng()*26;box('distant block',x,h/2,-99-rng()*17,8+rng()*5,h,7+rng()*5,['blue','cream','sage','brick'][i%4],false)}
}
makeWorld();

// Localized rain streaks keep the weather readable without an expensive particle system.
const rainGroup=new THREE.Group();scene.add(rainGroup);
const rainCount=260,rainPositions=new Float32Array(rainCount*6);
for(let i=0;i<rainCount;i++){
  const x=(rng()-.5)*34,y=2+rng()*20,z=(rng()-.5)*34;
  rainPositions.set([x,y,z,x-.07,y-.48,z],i*6);
}
const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
const rainMaterial=new THREE.LineBasicMaterial({color:0xc9dce2,transparent:true,opacity:.38,depthWrite:false});
const rainMesh=new THREE.LineSegments(rainGeometry,rainMaterial);rainGroup.add(rainMesh);
let wetness=0;
function updateWeather(dt){
  const raining=world.weather==='Rain';rainMesh.visible=raining;
  const targetWetness=raining?1:0;wetness+=(targetWetness-wetness)*Math.min(1,dt*.22);
  mats.road.roughness=THREE.MathUtils.lerp(.86,.28,wetness);mats.road.metalness=.025+.08*wetness;
  mats.sidewalk.roughness=THREE.MathUtils.lerp(.88,.4,wetness);mats.concrete.roughness=THREE.MathUtils.lerp(.9,.48,wetness);
  rainGroup.position.set(player.position.x,Math.max(0,player.position.y),player.position.z);
  if(raining){for(let i=0;i<rainCount;i++){const j=i*6;rainPositions[j+1]-=18*dt;rainPositions[j+4]-=18*dt;rainPositions[j]+=1.8*dt;rainPositions[j+3]+=1.8*dt;if(rainPositions[j+1]<-1){const x=(rng()-.5)*34,z=(rng()-.5)*34,y=15+rng()*10;rainPositions.set([x,y,z,x-.07,y-.48,z],j)}}rainGeometry.attributes.position.needsUpdate=true;}
}

// Procedural ambience uses world-positioned panners; audio starts only after the player's gesture.
let audioContext=null,audioMaster=null,ambientRainGain=null,noiseBuffer=null;
const audioPanners=[];
function setPannerPosition(panner,x,y,z){if(panner.positionX){panner.positionX.value=x;panner.positionY.value=y;panner.positionZ.value=z}else panner.setPosition(x,y,z)}
function makeNoiseBuffer(context){const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;return buffer}
function addNoiseSource({x=0,y=0,z=0,cutoff=1000,highpass=false,volume=.02,spatial=true}){
  const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain();
  source.buffer=noiseBuffer;source.loop=true;filter.type=highpass?'highpass':'lowpass';filter.frequency.value=cutoff;gain.gain.value=volume;
  source.connect(filter);filter.connect(gain);
  if(spatial){const panner=audioContext.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=5;panner.maxDistance=110;panner.rolloffFactor=1.6;setPannerPosition(panner,x,y,z);gain.connect(panner);panner.connect(audioMaster);audioPanners.push(panner)}else gain.connect(audioMaster);
  source.start();return{source,gain};
}
function initAmbientAudio(){
  if(audioContext)return;
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)return;
  try{audioContext=new AudioContextClass();audioMaster=audioContext.createGain();audioMaster.gain.value=.42;audioMaster.connect(audioContext.destination);noiseBuffer=makeNoiseBuffer(audioContext);
    addNoiseSource({x:0,y:2,z:-43,cutoff:230,volume:.11});
    addNoiseSource({x:30,y:1,z:0,cutoff:1500,highpass:true,volume:.075});
    const rain=addNoiseSource({cutoff:4200,volume:.0,spatial:false});ambientRainGain=rain.gain;
    audioContext.resume().catch(()=>{});
  }catch(error){console.warn('Ambient audio unavailable:',error);audioContext=null}
}
function updateAudio(){
  if(!audioContext)return;const listener=audioContext.listener,pos=new THREE.Vector3(),forward=new THREE.Vector3();camera.getWorldPosition(pos);camera.getWorldDirection(forward);
  if(listener.positionX){listener.positionX.value=pos.x;listener.positionY.value=pos.y;listener.positionZ.value=pos.z;listener.forwardX.value=forward.x;listener.forwardY.value=forward.y;listener.forwardZ.value=forward.z;listener.upX.value=0;listener.upY.value=1;listener.upZ.value=0}else listener.setPosition(pos.x,pos.y,pos.z);
  if(ambientRainGain){const target=world.weather==='Rain'?.055:0;ambientRainGain.gain.setTargetAtTime(target,audioContext.currentTime,.7)}
}
function playFootstep(){
  if(!audioContext||audioContext.state!=='running')return;const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain(),panner=audioContext.createPanner();
  source.buffer=noiseBuffer;filter.type='bandpass';filter.frequency.value=world.weather==='Rain'?380:620;filter.Q.value=.7;
  const now=audioContext.currentTime;gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.09,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+.11);
  panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=1;panner.maxDistance=16;panner.rolloffFactor=2;setPannerPosition(panner,player.position.x,.05,player.position.z);
  source.connect(filter);filter.connect(gain);gain.connect(panner);panner.connect(audioMaster);source.start();source.stop(now+.12);
}

const firstNames=['Mara','Theo','Imani','Jules','Ravi','Nina','Ellis','Sofia','Owen','Leila','Cal','Priya','Ari','Bea','Dante','Mina','Jonah','Rosa'];
const surnames=['Chen','Navarro','Brooks','Patel','Fischer','Okafor','Kim','Reed','Alvarez','Singh','Morgan','Sato','Williams','Diaz','Shah','Bennett'];
const jobs=['barista','nurse','bus driver','student','shopkeeper','teacher','designer','mechanic','researcher','cook','freelancer','librarian'];
const goals=['save for a place of their own','finish a course','reconnect with family','find work that matters','make time for friends','start something of their own','get through the week'];
function createNPC(i){
  const id='p'+i, name=firstNames[i%firstNames.length]+' '+surnames[Math.floor(rng()*surnames.length)];
  const spots=[[-3,-7],[-2,5],[2,-16],[11,-4],[14,6],[24,-15],[36,16],[50,-8],[-11,25],[-52,-1],[51,32],[85,5],[24,35],[-26,0],[3,30],[63,-33],[0,-43],[31,4]];
  const s=spots[i%spots.length];
  const npc={id,name,age:19+Math.floor(rng()*48),job:jobs[Math.floor(rng()*jobs.length)],goal:goals[Math.floor(rng()*goals.length)],personality:['warm','reserved','curious','practical','hopeful'][Math.floor(rng()*5)],energy:40+Math.floor(rng()*55),hunger:10+Math.floor(rng()*65),mood:48+Math.floor(rng()*45),money:120+Math.floor(rng()*1200),x:s[0],z:s[1],homeX:s[0],homeZ:s[1],routine:['heading to work','on a coffee break','running an errand','taking the long way home'][Math.floor(rng()*4)],memory:[],color:'npc'+(1+Math.floor(rng()*5)),skin:'skin'+(1+Math.floor(rng()*4)),relation:0,walkSeed:rng()*10};
  world.people.push(npc);world.relations[id]=0;
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.29,.64,4,8),mats[npc.color]);body.position.y=1.04;body.castShadow=true;body.receiveShadow=true;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.22,16,12),mats[npc.skin]);head.position.y=1.65;head.castShadow=true;g.add(head);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.224,16,10,0,Math.PI*2,0,Math.PI*.52),mats[npc.color]);hair.position.y=1.73;g.add(hair);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),mats[npc.skin]);nose.position.set(0,1.63,-.205);g.add(nose);
  const limbs={arms:[],legs:[]};
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.13,.67,0);g.add(leg);limbs.legs.push(leg);
    const trousers=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.36,3,7),mats.road);trousers.position.y=-.23;trousers.castShadow=true;leg.add(trousers);
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(.17,.11,.29),mats.darkglass);shoe.position.set(0,-.48,-.055);shoe.castShadow=true;leg.add(shoe);
    const arm=new THREE.Group();arm.position.set(side*.32,1.31,0);arm.rotation.z=side*-.12;g.add(arm);limbs.arms.push(arm);
    const sleeve=new THREE.Mesh(new THREE.CapsuleGeometry(.085,.35,3,7),mats[npc.color]);sleeve.position.set(side*-.015,-.21,0);sleeve.castShadow=true;arm.add(sleeve);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),mats[npc.skin]);hand.position.set(side*-.015,-.43,0);arm.add(hand);
  }
  g.position.set(npc.x,0,npc.z);scene.add(g);npc.mesh=g;npc.limbs=limbs;npcMeshes.push(g);
  return npc;
}
if(!world.people?.length){world.people=[];for(let i=0;i<18;i++)createNPC(i)} else {
  const savedPeople=[...world.people];world.people=[];
  savedPeople.forEach((npc,i)=>{const copy=createNPC(i);const {mesh,limbs,...state}=npc;Object.assign(copy,state);copy.mesh.position.set(copy.x,0,copy.z);copy.mesh.traverse(o=>{if(o.isMesh&&o.geometry.type==='CapsuleGeometry')o.material=mats[copy.color]})});
}

function displayTime(){const h=Math.floor(world.minute/60)%24,m=world.minute%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`}
function log(text){world.log.unshift({time:displayTime(),text});world.log=world.log.slice(0,4);renderLog()}
function renderLog(){ $('logCount').textContent=String(world.log.length).padStart(2,'0');$('lifeLog').innerHTML=world.log.map(e=>`<div class="log-item"><time>${e.time}</time><span>${e.text}</span></div>`).join('')||'<div class="log-item"><time>NOW</time><span>Your story is still unwritten.</span></div>' }
function toast(text){const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2400)}
function updateUI(){
  $('clock').textContent=displayTime();$('money').textContent=Math.floor(world.balance).toLocaleString();
  for(const n of ['energy','hunger','social','stress','hygiene']){$(n+'Bar').style.width=`${Math.max(0,Math.min(100,world.needs[n]))}%`;$(n+'Val').textContent=Math.round(world.needs[n])}
  $('occupation').textContent=world.occupation;$('dayProgress').style.width=`${(world.minute/1440)*100}%`;
  const mood=world.needs.stress>70?'Overloaded':world.needs.energy<25?'Worn down':world.needs.social<20?'Isolated':world.needs.hunger>75?'Hungry':'Steady';$('moodLabel').textContent=mood.toUpperCase();
  $('weatherText').textContent=`${world.weather.toUpperCase()} · ${world.temp}°C`;$('weatherIcon').textContent=world.weather==='Rain'?'☂':world.weather==='Cloudy'?'☁':'☀';
  $('mobileClock').textContent=displayTime();$('mobileWeather').textContent=`${world.weather==='Rain'?'☂':world.weather==='Cloudy'?'☁':'☀'} ${world.temp}°`;
  $('nearbyCount').textContent=world.people.filter(p=>Math.hypot(p.x-player.position.x,p.z-player.position.z)<28).length;
  $('pulseText').textContent=world.city.mood>70?'Hopeful':world.city.mood<35?'Tense':'Unhurried';$('outlook').textContent=world.city.outlook;
  $('playerName').textContent='YOU · AGE '+(world.age||24);
}
function save(){try{const copy={...world,playerPosition:{x:player.position.x,z:player.position.z}};delete copy.sun;delete copy.ambient;delete copy.people;localStorage.setItem('reality-unbound-save',JSON.stringify({version:1,world:{...copy,people:world.people.map(({mesh,...p})=>p)}}));toast('Your life in Harborlight has been saved.')}catch{toast('Could not save this world in your browser.')}}

function goModal(kicker,title,body,options=[]){if(document.pointerLockElement)document.exitPointerLock();keys.clear();$('modalContent').innerHTML=`<div class="modal-kicker">${kicker}</div><h2>${title}</h2>${body}<div class="modal-options">${options.map((o,i)=>`<button class="choice" data-choice="${i}"><strong>${o.title}</strong><small>${o.detail}</small></button>`).join('')}</div>`;$('modalBackdrop').classList.add('open');$('modalContent').querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{const chosen=options[+b.dataset.choice];closeModal();if(chosen?.action)chosen.action()})}
function closeModal(){$('modalBackdrop').classList.remove('open')}
$('modalClose').onclick=closeModal;$('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))closeModal()});
function doAction(label,fn){return{title:label,detail:'Make this choice now.',action:fn}}
let activityAnimation=null;
const activityModes=[
  [/eat|meal|toast|coffee|bite|lunch/i,'eat'],[/sleep|rested|nap/i,'sleep'],[/shower|wash|hygiene/i,'shower'],[/exercise|workout|sport|run|practice/i,'exercise'],[/clean|tidied|maintenance/i,'clean'],[/shop|grocer|picked up|belongings/i,'shopping'],[/computer|internet|social media|browse/i,'computer'],[/television|watch|game|entertainment/i,'entertainment'],[/study|class|course|learn|book/i,'study'],[/bus|travel|explor|ride|commut/i,'travel'],[/work|shift|delivery|volunteer/i,'work'],[/talk|conversation|meeting|gather|friend/i,'social']
];
function modeForAction(message){return activityModes.find(([pattern])=>pattern.test(message))?.[1]||'social'}
function makeActivityProp(mode){
  const group=new THREE.Group(),make=(geometry,color,x,y,z)=>{const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.72}));mesh.position.set(x,y,z);group.add(mesh);return mesh};
  if(mode==='eat'){make(new THREE.BoxGeometry(.16,.095,.15),0xd6a96d,0,-.55,-.19);make(new THREE.BoxGeometry(.17,.025,.16),0x6f9161,0,-.57,-.19)}
  else if(mode==='exercise'){make(new THREE.CylinderGeometry(.055,.055,.12,10),0x56676a,0,-.55,-.18);for(const x of [-.11,.11]){const weight=make(new THREE.CylinderGeometry(.08,.08,.045,10),0x9b5b4b,x,-.55,-.18);weight.rotation.z=Math.PI/2}}
  else if(mode==='study'||mode==='work'||mode==='computer'){make(new THREE.BoxGeometry(.2,.025,.15),0x527a78,0,-.56,-.18);make(new THREE.BoxGeometry(.17,.012,.12),0xe8dfc7,0,-.54,-.185)}
  else if(mode==='clean'){const handle=make(new THREE.CylinderGeometry(.012,.012,.48,6),0x8a6c45,0,-.65,-.16);handle.rotation.x=-.5;make(new THREE.BoxGeometry(.17,.09,.07),0x9b765f,0,-.85,-.03)}
  else if(mode==='shopping'||mode==='travel'){make(new THREE.BoxGeometry(.2,.2,.13),mode==='travel'?0x526d75:0x9b765f,0,-.59,-.18);make(new THREE.TorusGeometry(.045,.009,5,12),0xd1c4a8,0,-.46,-.18)}
  else if(mode==='shower'){make(new THREE.SphereGeometry(.075,10,8),0x9dbab3,0,-.55,-.16)}
  else if(mode==='entertainment'){make(new THREE.BoxGeometry(.16,.055,.09),0x424e4d,0,-.56,-.18);for(const x of [-.045,.045])make(new THREE.SphereGeometry(.012,6,5),0xe7c488,x,-.53,-.18)}
  return group;
}
function startActivityAnimation(mode){
  if(activityAnimation?.prop){activityAnimation.arm.remove(activityAnimation.prop);activityAnimation.prop.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()})}
  const hand=hands.find(h=>h.side===1);const prop=makeActivityProp(mode);hand.arm.add(prop);
  activityAnimation={mode,elapsed:0,duration:3.1,prop,arm:hand.arm};
}
function updateActivityAnimation(dt){
  if(!activityAnimation)return;const a=activityAnimation;a.elapsed+=dt;const phase=Math.min(1,a.elapsed/a.duration),reach=THREE.MathUtils.smoothstep(phase,.06,.36)*(1-THREE.MathUtils.smoothstep(phase,.68,.98));
  hands.forEach(({arm,rest,side})=>{
    const active=side===1||['sleep','computer','study','work','shower'].includes(a.mode);const amount=reach*(active?1:.2);
    let targetY=rest.y-.08,targetZ=rest.z-.12,rx=-.25,rz=side*-.12;
    if(a.mode==='eat'){targetY=rest.y+.18;targetZ=rest.z+.04;rx=-1.05}
    if(a.mode==='exercise'){const lift=.48+Math.sin(a.elapsed*7)*.09;targetY=rest.y+lift;targetZ=rest.z+.08;rx=-1.25+Math.sin(a.elapsed*7)*.12}
    if(a.mode==='shower'){targetY=rest.y+.42;targetZ=rest.z+.02;rx=-1.2}
    if(a.mode==='clean'){targetY=rest.y-.05+Math.sin(a.elapsed*9)*.08;targetZ=rest.z-.2;rx=-.65+Math.sin(a.elapsed*9)*.22}
    if(a.mode==='sleep'){targetY=rest.y-.2;targetZ=rest.z+.18;rx=.35}
    if(a.mode==='computer'||a.mode==='study'||a.mode==='work'){targetY=rest.y-.03;targetZ=rest.z-.32;rx=-.12}
    if(a.mode==='shopping'||a.mode==='travel'){targetY=rest.y-.02;targetZ=rest.z-.18;rx=-.45}
    if(a.mode==='entertainment'){targetY=rest.y+.03;targetZ=rest.z-.15;rx=-.55}
    arm.position.set(rest.x,rest.y,rest.z).lerp(new THREE.Vector3(rest.x+side*.06,targetY,targetZ),amount);
    arm.rotation.x=THREE.MathUtils.lerp(0,rx,amount);arm.rotation.z=THREE.MathUtils.lerp(side*-.08,rz,amount);
  });
  if(a.mode==='sleep')camera.position.y=THREE.MathUtils.lerp(1.67,1.42,reach);else camera.position.y=THREE.MathUtils.lerp(camera.position.y,1.67,Math.min(1,dt*5));
  if(phase>=1){camera.position.y=1.67;a.arm.remove(a.prop);a.prop.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()});activityAnimation=null}
}
function advanceClock(minutes){
  const total=world.minute+minutes,daysPassed=Math.floor(total/1440);
  world.minute=total%1440;
  for(let i=0;i<daysPassed;i++){
    world.day++;world.city.prices=Math.max(.85,Math.min(1.35,world.city.prices+(rng()-.48)*.018));
    world.city.mood=Math.max(20,Math.min(90,world.city.mood+(rng()-.48)*5));world.city.jobs=Math.max(2,Math.min(24,world.city.jobs+(rng()>.52?1:-1)));
    if(world.day%4===0){world.weather=['Clear','Clear','Cloudy','Rain'][Math.floor(rng()*4)];world.temp=Math.round(13+rng()*13)}
  }
}
function action(msg,{money=0,energy=0,hunger=0,social=0,stress=0,skill=0,rep=0,hygiene=0,homeCare=0,minutes=15}={}){startActivityAnimation(modeForAction(msg));world.balance+=money;world.needs.energy=Math.max(0,Math.min(100,world.needs.energy+energy));world.needs.hunger=Math.max(0,Math.min(100,world.needs.hunger+hunger));world.needs.social=Math.max(0,Math.min(100,world.needs.social+social));world.needs.stress=Math.max(0,Math.min(100,world.needs.stress+stress));world.needs.hygiene=Math.max(0,Math.min(100,world.needs.hygiene+hygiene));world.homeCare=Math.max(0,Math.min(100,world.homeCare+homeCare));world.skill+=skill;world.reputation+=rep;advanceClock(minutes);log(msg);$('objectiveText').textContent=msg;updateUI();save()}
function purchase(item,cost,label){if(world.balance<cost){toast('Your balance is a little short.');return false}world.inventory[item]=(world.inventory[item]||0)+1;action(`You bought ${label} at Harbor Market.`,{money:-cost});return true}
function consume(item,label){if((world.inventory[item]||0)<1){toast(`You need ${label.toLowerCase()} first. Try Harbor Market.`);return false}world.inventory[item]--;return true}
function computerModal(){goModal('A LITTLE TIME ONLINE','Choose what to do on the computer.',`<p>Check in with friends, follow a curiosity, or simply let a screen fill a quiet moment.</p>`,[
  {title:'Catch up with friends',detail:'Social +12, stress −4.',action:()=>action('You caught up with friends online.',{social:12,stress:-4,minutes:25})},
  {title:'Study a short course',detail:'Skill +3, energy −5.',action:()=>action('You studied a short course on the computer.',{skill:3,energy:-5,minutes:45})},
  {title:'Watch a show',detail:'Stress −10, energy +3.',action:()=>action('You watched a favorite show and relaxed.',{stress:-10,energy:3,minutes:40})}
])}
function talk(npc){
  const rel=world.relations[npc.id]||0;const greeting=rel>2?'It’s good to see you again.':npc.personality==='reserved'?'Oh—hi. I was just thinking.':'Morning. Funny how everyone’s on their own little schedule, isn’t it?';
  goModal('A MOMENT WITH '+npc.name.toUpperCase(),npc.name,`<p>Age ${npc.age} · ${npc.job}<br>They seem ${npc.personality}. Today they’re ${npc.routine}.<br><br><em>“${greeting} I’m hoping to ${npc.goal}.”</em></p><div class="modal-stats"><div class="modal-stat"><small>YOUR RAPPORT</small><strong>${rel<0?'Strained':rel>5?'Close':'Getting acquainted'}</strong></div><div class="modal-stat"><small>THEIR DAY</small><strong>${npc.energy<25?'Running low':npc.mood>72?'Good spirits':'In motion'}</strong></div></div>`,[
    {title:'Ask how they’re doing',detail:'Listen, share a little time. Social +, build trust.',action:()=>{npc.relation++;world.relations[npc.id]=npc.relation;npc.memory.unshift('You checked in on them');npc.mood=Math.min(100,npc.mood+7);action(`You took time to talk with ${npc.name}.`,{social:16,stress:-5,rep:1})}},
    {title:'Offer a kind word',detail:'A small gesture can shift someone’s day.',action:()=>{npc.relation+=2;world.relations[npc.id]=npc.relation;npc.memory.unshift('You were kind to them');npc.mood=Math.min(100,npc.mood+12);action(`${npc.name} seemed glad you stopped to talk.`,{social:12,stress:-8,rep:2})}},
    {title:'Ask about their work',detail:'Learn how the city is doing through one person’s day.',action:()=>{world.events.unshift(`${npc.name} is ${npc.routine} and hopes to ${npc.goal}.`);action(`You learned a little about ${npc.name}’s life.`,{social:8,skill:1})}}
  ]);
}
function interact(place){
  if(place.kind==='npc'){talk(place.npc);return}
  switch(place.type){
    case 'cafe':goModal('GOOD DAY CAFÉ · NORTH DISTRICT','Take a seat for a while.',`<p>The windows are warm with morning light. A chalkboard menu promises coffee, toast, and no hurry.</p>`,[
      {title:'Coffee & toast · $8',detail:'A good start. Hunger −28, energy +10.',action:()=>{if(world.balance<8){toast('Not enough money for that right now.');return}action('You had coffee and toast at Good Day Café.',{money:-8,hunger:-28,energy:10,stress:-4})}},
      {title:'Pick up a shift',detail:'A few hours behind the counter. Earn $72, build experience.',action:()=>{world.occupation='Café shift worker';world.hasWork=true;action('You covered a café shift and earned $72.',{money:72,energy:-17,stress:5,skill:2});world.city.jobs=Math.max(0,world.city.jobs-1)}},
      {title:'Sit by the window',detail:'Pause and watch the neighborhood. Stress −16.',action:()=>action('You let the morning unfold at your own pace.',{energy:4,stress:-16})}
    ]);break;
    case 'market':goModal('HARBOR MARKET · OPEN','A little care goes a long way.',`<p>Fresh bread, fruit, and everyday essentials. Prices move with the city’s supply and demand.</p>`,[
      {title:`Buy groceries · $${Math.round(22*world.city.prices)}`,detail:'Stock your kitchen for a few meals.',action:()=>purchase('groceries',Math.round(22*world.city.prices),'groceries')},
      {title:'Buy toiletries · $12',detail:'Keep up with everyday hygiene at home.',action:()=>purchase('toiletries',12,'toiletries')},
      {title:'Buy cleaning supplies · $10',detail:'A little upkeep makes home feel better.',action:()=>purchase('cleaningSupplies',10,'cleaning supplies')},
      {title:'Take a paid delivery',detail:'Help move stock to the café. Earn $38, spend some energy.',action:()=>action('You helped deliver a market order across the district.',{money:38,energy:-9,skill:1,rep:1})}
    ]);break;
    case 'work':goModal('NORTHLINE WORKS · OPPORTUNITIES','A place to put your hands to something.',`<p>Small local teams make the city work. A notice by the entrance lists casual shifts and an open trainee position.</p>`,[
      {title:'Take a workshop shift · $96',detail:'A day’s work. Energy −24, skill +3.',action:()=>{world.occupation='Workshop assistant';world.hasWork=true;action('You worked a shift at Northline Works.',{money:96,energy:-24,stress:5,skill:3});world.city.employed=Math.min(.99,world.city.employed+.002)}},
      {title:'Ask about the trainee role',detail:'No cost. Build skills and open future opportunities.',action:()=>{world.occupation='Workshop trainee';world.hasWork=true;action('You started training at Northline Works.',{energy:-8,skill:4,rep:1})}},
      {title:'Read the community board',detail:'Learn about local opportunities.',action:()=>openBoard()}
    ]);break;
    case 'board':openBoard();break;
    case 'clinic':goModal('HARBORLIGHT CLINIC · WALK-IN','Looking after yourself is part of living.',`<p>Someone at reception nods you toward a chair. The clinic is busy, but not too busy to help.</p>`,[
      {title:'Routine check-in · $15',detail:'Rest, reassurance, and a little care.',action:()=>{if(world.balance<15){toast('You do not have enough for the clinic fee.');return}action('You checked in at Harborlight Clinic.',{money:-15,energy:8,stress:-19})}},
      {title:'Volunteer for an hour',detail:'Help people find their way. Social +, local reputation +.',action:()=>action('You helped out at the clinic for an hour.',{energy:-5,social:12,rep:3})}
    ]);break;
    case 'home':goModal('A PLACE TO CALL YOUR OWN','The door is open.',`<p>Your everyday routine can start here. Groceries: ${world.inventory.groceries||0} · toiletries: ${world.inventory.toiletries||0} · cleaning supplies: ${world.inventory.cleaningSupplies||0}. Home care: ${Math.round(world.homeCare)}%.</p>`,[
      {title:'Cook and eat a meal',detail:'Use groceries. Hunger −42, energy +5.',action:()=>{if(!consume('groceries','groceries'))return;action('You cooked a simple meal at home.',{hunger:-42,energy:5,stress:-4,minutes:35})}},
      {title:'Sleep until morning',detail:'A full night’s rest. Energy +55, time advances 8 hours.',action:()=>action('You slept at home and woke feeling more restored.',{energy:55,hunger:14,hygiene:-8,minutes:480})},
      {title:'Take a shower',detail:'Use toiletries. Hygiene +35, stress −5.',action:()=>{if(!consume('toiletries','toiletries'))return;action('You took a refreshing shower at home.',{hygiene:35,stress:-5,minutes:20})}},
      {title:'Tidy your home',detail:'Use cleaning supplies. Home care +18, stress −4.',action:()=>{if(!consume('cleaningSupplies','cleaning supplies'))return;action('You tidied up and took care of your home.',{homeCare:18,stress:-4,minutes:30})}},
      {title:'Use your computer',detail:'Browse, study, or unwind online.',action:()=>computerModal()}
    ]);break;
    case 'bench':goModal('NORTH DISTRICT · POCKET PARK','A quiet minute.',`<p>Leaves stir above the street. People come and go without needing anything from you.</p>`,[
      {title:'Sit and breathe',detail:'Energy +8, stress −14.',action:()=>action('You took a quiet break in the park.',{energy:8,stress:-14})},
      {title:'Strike up a conversation',detail:'Nearby people are often happy to talk.',action:()=>{const p=nearestNPC(7);if(p)talk(p);else toast('No one is close enough just now.')}}
    ]);break;
    case 'library':case 'school':goModal('HARBORLIGHT LEARNING','Curiosity is a direction.',`<p>The library has public computers, quiet study tables, and free evening classes. Learning takes time—but it opens doors.</p>`,[
      {title:'Study a new skill',detail:'Spend an hour learning. Skill +4, energy −8.',action:()=>action('You spent time studying at the library.',{energy:-8,skill:4,stress:-3})},
      {title:'Join a community class',detail:'Meet people and build confidence.',action:()=>action('You joined a community learning session.',{energy:-5,social:14,skill:2,rep:1})}
    ]);break;
    case 'civic':goModal('HARBORLIGHT · CITY HALL','The city is shaped by the people who live in it.',`<p>There’s a public meeting tonight about transit and neighborhood services. You can show up, listen, and make your voice part of the room.</p>`,[
      {title:'Attend the public meeting',detail:'Build civic knowledge and meet neighbors.',action:()=>{world.city.mood=Math.min(100,world.city.mood+2);action('You attended a local public meeting.',{energy:-4,social:12,skill:1,rep:2})}},
      {title:'Check local outlook',detail:'See how the district is changing.',action:()=>cityModal()}
    ]);break;
    case 'bus':goModal('HARBORLIGHT TRANSIT','The city is bigger than one block.',`<p>Local routes reach the waterfront, university, and southbank. A one-way fare costs $5.</p>`,[
      {title:'Ride to the university · $5',detail:'Explore a new part of town. Meet new people.',action:()=>{if(world.balance<5){toast('Not enough for a transit fare.');return}player.position.set(67,0,25);yaw=Math.PI;setView();action('You took the bus across town to the university.',{money:-5,social:5,energy:-3,minutes:25})}},
      {title:'Stay in the neighborhood',detail:'There is plenty to discover on foot.',action:()=>{closeModal();toast('You decide to keep exploring nearby.')}}
    ]);break;
    case 'gym':goModal('HARBORLIGHT MOVEMENT STUDIO','Move in a way that feels good.',`<p>There are simple weights, open floor space, and room to practice at your own pace.</p>`,[
      {title:'Take a gentle workout',detail:'Energy −14, stress −10, hygiene −5.',action:()=>action('You completed a gentle workout at the movement studio.',{energy:-14,stress:-10,hygiene:-5,minutes:40})},
      {title:'Join a group class',detail:'Social +12, skill +2, energy −18.',action:()=>action('You joined a welcoming group movement class.',{social:12,skill:2,energy:-18,stress:-8,minutes:55})},
      {title:'Practice a little longer',detail:'Build skill, using more energy.',action:()=>action('You practiced at the studio and built your fitness.',{energy:-22,skill:3,stress:-6,minutes:60})}
    ]);break;
    case 'cinema':goModal('NORTHLIGHT CINEMA','An evening away from the everyday.',`<p>A neighborhood screen is showing a few films. Tickets are $12.</p>`,[
      {title:'See a film · $12',detail:'Stress −18, energy +4. The show takes two hours.',action:()=>{if(world.balance<12){toast('Your balance is a little short.');return}action('You watched a film at Northlight Cinema.',{money:-12,stress:-18,energy:4,minutes:120})}},
      {title:'Check showtimes',detail:'No cost. Think about coming back later.',action:()=>{closeModal();toast('The next show starts this evening.')}}
    ]);break;
    case 'view':goModal('HARBORLIGHT · NORTH DISTRICT','There’s no rush to know what comes next.',`<p>From here you can see the park, the shops, and the people making their way through an ordinary day. The city keeps going.</p>`,[
      {title:'Take it all in',detail:'Stress −20, confidence +1.',action:()=>action('You took a moment to appreciate where you are.',{stress:-20,energy:3,rep:1})},
      {title:'Think about what you want',detail:'Set an intention for the next part of your day.',action:()=>{closeModal();objectivesModal()}}
    ]);break;
    default:toast('There is nothing to do here right now.')
  }
}
function openBoard(){goModal('COMMUNITY NOTICEBOARD · UPDATED TODAY','A few ways to get involved.',`<p>Local life is made up of small openings. No single one decides who you become.</p>`,[
  {title:'Casual shift at the market · $68',detail:'Help with deliveries. A straightforward day’s work.',action:()=>action('You took a casual delivery shift at Harbor Market.',{money:68,energy:-16,skill:1,rep:1})},
  {title:'Neighborhood clean-up · $25',detail:'Help care for the streets you share.',action:()=>action('You joined a neighborhood clean-up.',{money:25,energy:-9,social:9,rep:3})},
  {title:'Free evening course',detail:'Start building a skill at your own pace.',action:()=>action('You signed up for a free evening course.',{skill:2,stress:-3})}
])}
function statusModal(){goModal('A CHECK-IN WITH YOURSELF','This is where you are today.',`<div class="modal-stats"><div class="modal-stat"><small>ENERGY</small><strong>${Math.round(world.needs.energy)} / 100</strong></div><div class="modal-stat"><small>HUNGER</small><strong>${Math.round(world.needs.hunger)} / 100</strong></div><div class="modal-stat"><small>PEOPLE WHO KNOW YOU</small><strong>${Object.values(world.relations).filter(v=>v>0).length}</strong></div><div class="modal-stat"><small>SKILLS GAINED</small><strong>${world.skill}</strong></div><div class="modal-stat"><small>REPUTATION</small><strong>${world.reputation}</strong></div><div class="modal-stat"><small>YOUR WORK</small><strong>${world.occupation}</strong></div></div><p>There is no score to finish. Wellbeing is information, not a judgment.</p>`,[doAction('Close',()=>{})])}
function cityModal(){goModal('HARBORLIGHT · LOCAL OUTLOOK','A city is many lives happening at once.',`<div class="modal-stats"><div class="modal-stat"><small>EMPLOYMENT</small><strong>${Math.round(world.city.employed*100)}%</strong></div><div class="modal-stat"><small>COMMUNITY MOOD</small><strong>${world.city.mood>70?'Hopeful':world.city.mood<35?'Concerned':'Steady'}</strong></div><div class="modal-stat"><small>LOCAL OPENINGS</small><strong>${world.city.jobs}</strong></div><div class="modal-stat"><small>COST OF LIVING</small><strong>${Math.round(world.city.prices*100)} index</strong></div></div><p>People’s choices, businesses, needs, and public decisions quietly shape these numbers over time.</p>`,[doAction('Close',()=>{})])}
function objectivesModal(){goModal('NO QUEST MARKER · JUST POSSIBILITIES','What feels right for today?',`<p>Try something small. Follow a curiosity. Change your mind. You can make a living here in more than one way.</p>`,[
  {title:'Find work',detail:'Try the café, workshop, or community noticeboard.',action:()=>{closeModal();$('objectiveText').textContent='Look for a place where you can lend a hand.'}},
  {title:'Look after yourself',detail:'Eat, rest, or find a quiet place.',action:()=>{closeModal();$('objectiveText').textContent='Your needs are worth listening to.'}},
  {title:'Get to know someone',detail:'A conversation can make this place feel smaller.',action:()=>{closeModal();$('objectiveText').textContent='Say hello to someone nearby.'}},
  {title:'See how the city is doing',detail:'Visit the noticeboard or city hall.',action:()=>{closeModal();$('objectiveText').textContent='The city is shaped by people who show up.'}}
])}
$('objectivesButton').onclick=objectivesModal;$('saveButton').onclick=save;$('statusButton').onclick=statusModal;
$('touchInteract').addEventListener('click',handleInteract);
$('touchJump').addEventListener('click',()=>{if(started&&player.position.y<=.01)verticalVelocity=4.5});
const movePad=$('movePad'),moveStick=$('moveStick');let movePointer=null;
function clearTouchMove(){touchMoveVector={x:0,y:0};moveStick.style.transform='translate(0,0)';movePointer=null}
function updateTouchMove(e){const rect=movePad.getBoundingClientRect(),radius=Math.min(rect.width,rect.height)*.32;let dx=e.clientX-(rect.left+rect.width/2),dy=e.clientY-(rect.top+rect.height/2);const distance=Math.hypot(dx,dy),scale=distance>radius?radius/distance:1;dx*=scale;dy*=scale;moveStick.style.transform=`translate(${dx}px,${dy}px)`;const strength=Math.max(0,(Math.min(distance/radius,1)-.12)/.88);touchMoveVector={x:dx/radius*strength,y:dy/radius*strength}}
movePad.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;e.preventDefault();movePointer=e.pointerId;movePad.setPointerCapture(e.pointerId);updateTouchMove(e)});
movePad.addEventListener('pointermove',e=>{if(e.pointerId===movePointer)updateTouchMove(e)});
movePad.addEventListener('pointerup',e=>{if(e.pointerId===movePointer)clearTouchMove()});
movePad.addEventListener('pointercancel',clearTouchMove);

function nearestNPC(max=3){let best=null,dist=max;for(const p of world.people){const d=Math.hypot(p.x-player.position.x,p.z-player.position.z);if(d<dist){dist=d;best=p}}return best}
let focus=null;
function findFocus(){let nearest=null,dist=4.2;const dir=new THREE.Vector3(),eye=new THREE.Vector3();camera.getWorldDirection(dir);camera.getWorldPosition(eye);for(const p of world.people){const pos=new THREE.Vector3(p.x,1.2,p.z);const delta=pos.sub(eye);const d=delta.length();if(d<4.2&&(dir.dot(delta.normalize())>.25||d<1.6)&&d<dist){nearest={kind:'npc',npc:p,label:`Talk to ${p.name}`};dist=d}}
  // Prefer people in the crosshair, otherwise use nearest contextual object.
  let candidate=nearest;
  if(!candidate){for(const o of interactables){const d=Math.hypot(o.x-player.position.x,o.z-player.position.z);if(d<o.radius+1.2&&d<dist){candidate=o;dist=d}}}
  focus=candidate;$('interactionHint').classList.toggle('visible',!!focus);$('touchInteract').classList.toggle('available',!!focus);$('touchInteract').setAttribute('aria-disabled',String(!focus));if(focus){$('interactionHint').innerHTML=`<kbd>E</kbd><span>${focus.kind==='npc'?focus.label:focus.label.toUpperCase()}</span>`}
}
// Collider-aware walking keeps the player on streets and sidewalks rather than through buildings.
function blocked(x,z){if(Math.abs(x)>112||Math.abs(z)>93)return true;for(const c of colliders){if(Math.abs(x-c.x)<c.sx/2+.42&&Math.abs(z-c.z)<c.sz/2+.42)return true}return false}
let touchMoveVector={x:0,y:0};
function move(dt){
  const forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-touchMoveVector.y;
  const side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchMoveVector.x;
  const inputLength=Math.hypot(forward,side);let moved=0;
  if(inputLength>.05){
    const sprinting=keys.has('ShiftLeft')||keys.has('ShiftRight'),speed=sprinting?6.2:3.45;
    const v=new THREE.Vector3(side,0,-forward).multiplyScalar(speed*dt/Math.max(1,inputLength)).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
    const beforeX=player.position.x,beforeZ=player.position.z,nx=beforeX+v.x,nz=beforeZ+v.z;
    if(!blocked(nx,beforeZ))player.position.x=nx;if(!blocked(player.position.x,nz))player.position.z=nz;
    moved=Math.hypot(player.position.x-beforeX,player.position.z-beforeZ);
    if(moved>0){walkBob+=dt*(sprinting?12:9);stepDistance+=moved;while(stepDistance>(sprinting?1.45:1.75)){stepDistance-=sprinting?1.45:1.75;playFootstep()}}
  }
  const wasGrounded=player.position.y<=0;player.position.y+=verticalVelocity*dt;verticalVelocity-=12*dt;
  if(player.position.y<0){player.position.y=0;if(!wasGrounded&&verticalVelocity< -2)fallBob=Math.min(.14,Math.abs(verticalVelocity)*.012);verticalVelocity=0}
  fallBob=Math.max(0,fallBob-dt*.42);
  const speedBlend=Math.min(1,moved/Math.max(dt,.001)/3.45);
  playerBody.position.y=-Math.abs(Math.sin(walkBob))*.025*speedBlend+fallBob;
  playerBody.rotation.y=yaw;
  playerBody.rotation.z=THREE.MathUtils.damp(playerBody.rotation.z,-side*.035*speedBlend,7,dt);
  const sway=Math.sin(walkBob*.5)*.012*speedBlend;
  handRig.position.set(0,-Math.abs(Math.sin(walkBob))*.018*speedBlend,0);
  hands.forEach(({arm,rest,side})=>{
    const reach=side===1?handReach:handReach*.18;
    arm.position.set(rest.x+side*sway,rest.y+Math.sin(walkBob+side)*.018*speedBlend,rest.z-reach*.32);
    arm.rotation.x=-reach*.7+Math.sin(walkBob+side)*.035*speedBlend;
    arm.rotation.z=side*-.08+side*reach*.2;
  });
  handReach=Math.max(0,handReach-dt*2.7);
  updateActivityAnimation(dt);
}
function handleInteract(){if(!focus)return;handReach=1;handReachTime=clock.elapsedTime;interact(focus)}
function setView(){camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;}

let simAccumulator=0, autosaveTimer=0, lastThought=0;
function simMinute(){world.minute++;if(world.minute>=1440){world.minute=0;world.day++;world.city.prices=Math.max(.85,Math.min(1.35,world.city.prices+(rng()-.48)*.018));world.city.mood=Math.max(20,Math.min(90,world.city.mood+(rng()-.48)*5));world.city.jobs=Math.max(2,Math.min(24,world.city.jobs+(rng()>.52?1:-1)));if(world.day%4===0){world.weather=['Clear','Clear','Cloudy','Rain'][Math.floor(rng()*4)];world.temp=Math.round(13+rng()*13);log(`A new day in Harborlight. The outlook is ${world.city.mood>65?'bright':'uncertain'}.`)} }
  world.needs.energy=Math.max(0,world.needs.energy-.018);world.needs.hunger=Math.min(100,world.needs.hunger+.035);world.needs.social=Math.max(0,world.needs.social-.012);world.needs.stress=Math.max(0,Math.min(100,world.needs.stress+(world.needs.energy<15?.025:0)+(world.needs.hunger>80?.018:0)-.004));
  if(world.minute%10===0){for(const p of world.people){p.energy=Math.max(4,p.energy-.12);p.hunger=Math.min(100,p.hunger+.16);p.mood=Math.max(12,Math.min(98,p.mood+(rng()-.49)*2));p.walkSeed+=.2;
      if(rng()<.08){const d=rng()<.5?1:-1;p.x+=d*(.4+rng());p.z+=(rng()-.5)*1.5;p.x=Math.max(-100,Math.min(100,p.x));p.z=Math.max(-77,Math.min(77,p.z));p.mesh.position.set(p.x,0,p.z)}
      if(p.energy<18&&rng()<.1)p.routine='taking a quiet break';else if(p.hunger>76&&rng()<.13)p.routine='looking for a bite to eat';else if(rng()<.03)p.routine=['on their way to work','checking in with a friend','running an errand','making plans for later'][Math.floor(rng()*4)];
    }
    world.city.mood+=(world.city.employed-.88)*.07-(world.city.prices-1)*.08;world.city.mood=Math.max(15,Math.min(92,world.city.mood));
  }
  if(world.minute%60===0&&world.minute>=360&&world.minute<1100){world.balance-=world.occupation==='Between chapters'?0:0;}
}
function animateNPCs(t,dt){
  for(const p of world.people){
    const mesh=p.mesh,limbs=p.limbs;
    const walking=p.routine.includes('way')||p.routine.includes('errand')||p.routine.includes('heading');
    if(walking&&Math.hypot(p.x-player.position.x,p.z-player.position.z)>4){
      if(!p.target||Math.hypot(p.target.x-p.x,p.target.z-p.z)<.55){
        const angle=rng()*Math.PI*2,distance=2+rng()*5;
        p.target={x:Math.max(-100,Math.min(100,p.x+Math.sin(angle)*distance)),z:Math.max(-77,Math.min(77,p.z+Math.cos(angle)*distance))};
      }
      const dx=p.target.x-p.x,dz=p.target.z-p.z,distance=Math.hypot(dx,dz),step=Math.min(distance,.7*dt);
      if(distance>.1&&!blocked(p.x+dx/distance*step,p.z+dz/distance*step)){
        p.x+=dx/distance*step;p.z+=dz/distance*step;mesh.rotation.y=Math.atan2(dx,-dz);
      }else p.target=null;
    }
    const gait=walking?Math.sin(t*7+p.walkSeed):Math.sin(t*1.4+p.walkSeed)*.08;
    limbs.legs.forEach((limb,i)=>limb.rotation.x=walking?gait*(i===0?-.48:.48):0);
    limbs.arms.forEach((limb,i)=>limb.rotation.x=walking?gait*(i===0?.34:-.34):Math.sin(t*1.2+p.walkSeed+i)*.025);
    mesh.position.set(p.x,Math.abs(gait)*.025,p.z);
    if(!walking)mesh.rotation.y=Math.sin(t*.2+p.walkSeed)*.025;
  }
}
function applyLight(){
  const h=world.minute/60,daylight=Math.max(0,Math.sin((h-6)/12*Math.PI));
  const sunset=Math.max(0,1-Math.abs(h-17.5)/2.5),night=1-daylight;
  const overcast=world.weather==='Cloudy'?.72:world.weather==='Rain'?.52:1;
  world.ambient.intensity=(.2+daylight*1.2)*overcast;
  world.sun.intensity=(.04+daylight*2.7+sunset*.45)*overcast;
  world.sun.color.setRGB(1,.82+daylight*.14,.68+daylight*.32);
  world.sun.position.set(-35+Math.cos(h/24*Math.PI*2)*20,12+daylight*48,24);
  scene.background.setRGB(.025+daylight*(.48+sunset*.12)*overcast,.045+daylight*(.64-sunset*.12)*overcast,.075+daylight*(.68-sunset*.24)*overcast);
  scene.fog.color.copy(scene.background);
  streetLights.forEach(light=>{light.intensity=night*1.8+(world.weather==='Rain'?night*.25:0)});
  renderer.toneMappingExposure=.78+daylight*.27;
}
function frame(){
  requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
  if(started){move(dt);animateNPCs(t,dt);simAccumulator+=dt;if(simAccumulator>=1){simAccumulator-=1;simMinute();updateUI()}findFocus();applyLight();updateWeather(dt);updateAudio();}
  renderer.render(scene,camera);
}
frame();

$('beginButton').onclick=()=>{started=true;initAmbientAudio();$('startScreen').classList.add('hidden');if(matchMedia('(pointer:fine)').matches)canvas.requestPointerLock?.();toast(matchMedia('(pointer:coarse)').matches?'Drag the right side to look. Use the pad to move.':'Welcome to Harborlight. Take the day at your pace.');log('You stepped into Harborlight on a clear spring morning.');updateUI()};
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas});
document.addEventListener('mousemove',e=>{if(!locked||!started)return;yaw-=e.movementX*.0022;pitch-=e.movementY*.0019;pitch=Math.max(-1.35,Math.min(1.35,pitch));setView()});
document.addEventListener('keydown',e=>{if($('modalBackdrop').classList.contains('open')){if(e.code==='Escape')closeModal();return}keys.add(e.code);if(e.code==='Space'){e.preventDefault();if(started&&player.position.y<=.01)verticalVelocity=4.5}if(e.code==='KeyE'&&!e.repeat&&started)handleInteract();if(e.code==='KeyJ'&&!e.repeat&&started)cityModal();if(e.code==='KeyI'&&!e.repeat&&started)statusModal()});document.addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('click',e=>{if(e.pointerType==='mouse'&&started&&!locked&&!$('modalBackdrop').classList.contains('open'))canvas.requestPointerLock?.()});
// Right-side drags look around; the on-screen joystick handles movement.
const lookPointers=new Map();canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||!started||e.clientX<innerWidth*.42)return;e.preventDefault();lookPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{const prev=lookPointers.get(e.pointerId);if(!prev||!started)return;const dx=e.clientX-prev.x,dy=e.clientY-prev.y;prev.x=e.clientX;prev.y=e.clientY;yaw-=dx*.005; pitch=Math.max(-1.25,Math.min(1.25,pitch-dy*.004));setView()});function endLook(e){lookPointers.delete(e.pointerId)}canvas.addEventListener('pointerup',endLook);canvas.addEventListener('pointercancel',endLook);
$('objectivesButton').title='Choose what matters to you';window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7))});
if(saved?.world){world.log=saved.world.log||[];world.minute=saved.world.minute??495;world.day=saved.world.day??1;world.needs=saved.world.needs||world.needs;world.balance=saved.world.balance??420;world.occupation=saved.world.occupation||'Between chapters';world.city=saved.world.city||world.city;world.relations=saved.world.relations||world.relations;world.skill=saved.world.skill||0;world.reputation=saved.world.reputation||0;world.age=saved.world.age||24;world.events=saved.world.events||[];if(saved.world.playerPosition)player.position.set(saved.world.playerPosition.x,0,saved.world.playerPosition.z);renderLog();updateUI()}
updateUI();
