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
renderer.toneMappingExposure = 1.05;

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
const interactables = [];
const npcMeshes = [];
const world = {
  day: 1, minute: 495, weather: 'Clear', temp: 19, balance: 420,
  needs: { energy: 78, hunger: 24, social: 56, stress: 18 },
  occupation: 'Between chapters', skill: 0, reputation: 0, people: [], relations: {}, log: [], events: [],
  city: { jobs: 12, employed: .91, mood: 62, prices: 1, outlook: 'Stable' }, seed: Math.floor(Math.random()*1e8),
  hasWork: false, lastDay: 1
};
const saved = (()=>{try{return JSON.parse(localStorage.getItem('reality-unbound-save')||'null')}catch{return null}})();
const rng = (()=>{let s=world.seed;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}})();
if(saved?.version===1){Object.assign(world,saved.world);world.seed=saved.world.seed;}

const mats = {};
const mat = (name,color,roughness=.85,metalness=0)=>mats[name]=new THREE.MeshStandardMaterial({color,roughness,metalness});
mat('grass',0x708b73);mat('road',0x424e4d);mat('sidewalk',0xc0bdae);mat('concrete',0x9b9b8c);mat('brick',0x9c765f);mat('cream',0xd1c4a8);mat('blue',0x6f9290);mat('sage',0x92a58b);mat('glass',0x708c8d,.3,.28);mat('darkglass',0x3c595b,.22,.38);mat('wood',0x705844);mat('leaf',0x64806a);mat('leaf2',0x81906c);mat('white',0xe8e5d7);mat('gold',0xc59957,.32,.5);mat('red',0x9b5b4b);mat('npc1',0x405e60);mat('npc2',0xc29b70);mat('npc3',0x72627d);mat('npc4',0x9a6d61);mat('npc5',0x65816b);mat('skin1',0xd4a17e);mat('skin2',0x9d694d);mat('skin3',0xe1b997);mat('skin4',0x80563f);
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
  addCollider(x,z,w+.35,d+.35);
  if(kind) addPlace({name,label:name,x,z:z-d/2-2.0,type:kind,description});
}
function tree(x,z,size=1){cylinder(x,size*.9,z,.19*size,1.8*size,'wood',8);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(size*.85,1),mats[rng()>.5?'leaf':'leaf2']);crown.position.set(x,size*1.9,z);crown.castShadow=true;scene.add(crown);}
function lamp(x,z){cylinder(x,1.7,z,.055,3.4,'wood',8);box('lamp',x,3.35,z,.34,.15,.25,'gold',false)}
function bench(x,z,rot=0){const g=new THREE.Group();const seat=new THREE.Mesh(new THREE.BoxGeometry(1.7,.12,.48),mats.wood);seat.position.y=.57;g.add(seat);const back=new THREE.Mesh(new THREE.BoxGeometry(1.7,.65,.1),mats.wood);back.position.set(0,.91,-.19);g.add(back);for(const xx of [-.65,.65]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.09,.55,.09),mats.road);leg.position.set(xx,.28,0);g.add(leg)}g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);addPlace({name:'Park bench',label:'Sit and take a breather',x,z,type:'bench',description:'A quiet place to let the day slow down.'})}
function makeWorld(){
  scene.add(new THREE.HemisphereLight(0xd5e9e4,0x59604f,2.1));
  const sun=new THREE.DirectionalLight(0xffe6c1,3.15);sun.position.set(-35,52,24);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-55;sun.shadow.camera.right=55;sun.shadow.camera.top=55;sun.shadow.camera.bottom=-55;sun.shadow.bias=-.0002;scene.add(sun);world.sun=sun;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(260,260),mats.grass);floor.rotation.x=-Math.PI/2;floor.position.y=-.12;floor.receiveShadow=true;scene.add(floor);
  // Streets, sidewalks and plaza form a walkable, human-scale district.
  box('main street',0,-.045,0,14,.12,210,'road',false);box('cross street',0,-.035,-31,215,.12,12,'road',false);box('cross street',0,-.035,39,215,.12,12,'road',false);
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
  // low-density homes beyond the district, trees and small park accents
  for(const [x,z,c] of [[-90,-45,'cream'],[-62,-48,'blue'],[-24,-56,'sage'],[22,-57,'cream'],[62,-51,'red'],[95,-43,'cream'],[-95,49,'sage'],[-56,55,'cream'],[-15,58,'red'],[20,59,'blue'],[62,54,'cream'],[99,50,'sage']])building(x,z,13,12,6.5,c,'homes','home');
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
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.29,.64,4,8),mats[npc.color]);body.position.y=1.04;body.castShadow=true;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.22,12,10),mats[npc.skin]);head.position.y=1.65;head.castShadow=true;g.add(head);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.224,12,7,0,Math.PI*2,0,Math.PI*.52),mats[npc.color]);hair.position.y=1.73;g.add(hair);
  const legs=new THREE.Mesh(new THREE.BoxGeometry(.35,.48,.23),mats.road);legs.position.y=.34;g.add(legs);
  g.position.set(npc.x,0,npc.z);scene.add(g);npc.mesh=g;npcMeshes.push(g);
  return npc;
}
if(!world.people?.length){world.people=[];for(let i=0;i<18;i++)createNPC(i)} else {
  const savedPeople=[...world.people];world.people=[];
  savedPeople.forEach((npc,i)=>{const copy=createNPC(i);Object.assign(copy,npc);copy.mesh.position.set(copy.x,0,copy.z);copy.mesh.traverse(o=>{if(o.isMesh&&o.geometry.type==='CapsuleGeometry')o.material=mats[copy.color]})});
}

function displayTime(){const h=Math.floor(world.minute/60)%24,m=world.minute%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`}
function log(text){world.log.unshift({time:displayTime(),text});world.log=world.log.slice(0,4);renderLog()}
function renderLog(){ $('logCount').textContent=String(world.log.length).padStart(2,'0');$('lifeLog').innerHTML=world.log.map(e=>`<div class="log-item"><time>${e.time}</time><span>${e.text}</span></div>`).join('')||'<div class="log-item"><time>NOW</time><span>Your story is still unwritten.</span></div>' }
function toast(text){const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2400)}
function updateUI(){
  $('clock').textContent=displayTime();$('money').textContent=Math.floor(world.balance).toLocaleString();
  for(const n of ['energy','hunger','social','stress']){$(n+'Bar').style.width=`${Math.max(0,Math.min(100,world.needs[n]))}%`;$(n+'Val').textContent=Math.round(world.needs[n])}
  $('occupation').textContent=world.occupation;$('dayProgress').style.width=`${(world.minute/1440)*100}%`;
  const mood=world.needs.stress>70?'Overloaded':world.needs.energy<25?'Worn down':world.needs.social<20?'Isolated':world.needs.hunger>75?'Hungry':'Steady';$('moodLabel').textContent=mood.toUpperCase();
  $('weatherText').textContent=`${world.weather.toUpperCase()} · ${world.temp}°C`;$('weatherIcon').textContent=world.weather==='Rain'?'☂':world.weather==='Cloudy'?'☁':'☀';
  $('nearbyCount').textContent=world.people.filter(p=>Math.hypot(p.x-player.position.x,p.z-player.position.z)<28).length;
  $('pulseText').textContent=world.city.mood>70?'Hopeful':world.city.mood<35?'Tense':'Unhurried';$('outlook').textContent=world.city.outlook;
  $('playerName').textContent='YOU · AGE '+(world.age||24);
}
function save(){try{const copy={...world,playerPosition:{x:player.position.x,z:player.position.z}};delete copy.sun;delete copy.people;localStorage.setItem('reality-unbound-save',JSON.stringify({version:1,world:{...copy,people:world.people.map(({mesh,...p})=>p)}}));toast('Your life in Harborlight has been saved.')}catch{toast('Could not save this world in your browser.')}}

function goModal(kicker,title,body,options=[]){if(document.pointerLockElement)document.exitPointerLock();keys.clear();$('modalContent').innerHTML=`<div class="modal-kicker">${kicker}</div><h2>${title}</h2>${body}<div class="modal-options">${options.map((o,i)=>`<button class="choice" data-choice="${i}"><strong>${o.title}</strong><small>${o.detail}</small></button>`).join('')}</div>`;$('modalBackdrop').classList.add('open');$('modalContent').querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{const chosen=options[+b.dataset.choice];if(chosen?.action)chosen.action();closeModal()})}
function closeModal(){$('modalBackdrop').classList.remove('open')}
$('modalClose').onclick=closeModal;$('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))closeModal()});
function doAction(label,fn){return{title:label,detail:'Make this choice now.',action:fn}}
function action(msg,{money=0,energy=0,hunger=0,social=0,stress=0,skill=0,rep=0}={}){world.balance+=money;world.needs.energy=Math.max(0,Math.min(100,world.needs.energy+energy));world.needs.hunger=Math.max(0,Math.min(100,world.needs.hunger+hunger));world.needs.social=Math.max(0,Math.min(100,world.needs.social+social));world.needs.stress=Math.max(0,Math.min(100,world.needs.stress+stress));world.skill+=skill;world.reputation+=rep;world.minute+=15;log(msg);$('objectiveText').textContent=msg;updateUI();save()}
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
      {title:`Buy groceries · $${Math.round(22*world.city.prices)}`,detail:'A proper meal. Hunger −48.',action:()=>{let cost=Math.round(22*world.city.prices);if(world.balance<cost){toast('Your balance is a little short.');return}action('You picked up groceries at Harbor Market.',{money:-cost,hunger:-48,stress:-2})}},
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
    case 'home':goModal('A PLACE TO CALL YOUR OWN','The door is open.',`<p>A home base can make all the difference. You’re not tied to this place, but you can take a moment here.</p>`,[
      {title:'Rest for a while',detail:'Recover energy and let stress settle.',action:()=>action('You rested at home and gathered yourself.',{energy:34,stress:-12,hunger:8})},
      {title:'Review your life',detail:'See your current wellbeing and standing.',action:()=>statusModal()}
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
    case 'bus':goModal('HARBORLIGHT TRANSIT','The city is bigger than one block.',`<p>Local routes reach the waterfront, university, and southbank. A day pass costs $5.</p>`,[
      {title:'Ride to the university · $5',detail:'Explore a new part of town. Meet new people.',action:()=>{if(world.balance<5){toast('Not enough for a transit fare.');return}world.balance-=5;player.position.set(67,0,25);world.minute+=25;action('You took the bus across town to the university.',{social:5,energy:-3})}},
      {title:'Stay in the neighborhood',detail:'There is plenty to discover on foot.',action:()=>{closeModal();toast('You decide to keep exploring nearby.')}}
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
$('objectivesButton').onclick=objectivesModal;$('saveButton').onclick=save;

function nearestNPC(max=3){let best=null,dist=max;for(const p of world.people){const d=Math.hypot(p.x-player.position.x,p.z-player.position.z);if(d<dist){dist=d;best=p}}return best}
let focus=null;
function findFocus(){let nearest=null,dist=4.2;const dir=new THREE.Vector3(),eye=new THREE.Vector3();camera.getWorldDirection(dir);camera.getWorldPosition(eye);for(const p of world.people){const pos=new THREE.Vector3(p.x,1.2,p.z);const delta=pos.sub(eye);const d=delta.length();if(d<4.2&&(dir.dot(delta.normalize())>.25||d<1.6)&&d<dist){nearest={kind:'npc',npc:p,label:`Talk to ${p.name}`};dist=d}}
  // Prefer people in the crosshair, otherwise use nearest contextual object.
  let candidate=nearest;
  if(!candidate){for(const o of interactables){const d=Math.hypot(o.x-player.position.x,o.z-player.position.z);if(d<o.radius+1.2&&d<dist){candidate=o;dist=d}}}
  focus=candidate;$('interactionHint').classList.toggle('visible',!!focus);if(focus){$('interactionHint').innerHTML=`<kbd>E</kbd><span>${focus.kind==='npc'?focus.label:focus.label.toUpperCase()}</span>`}
}
// Collider-aware walking keeps the player on streets and sidewalks rather than through buildings.
function blocked(x,z){if(Math.abs(x)>112||Math.abs(z)>93)return true;for(const c of colliders){if(Math.abs(x-c.x)<c.sx/2+.42&&Math.abs(z-c.z)<c.sz/2+.42)return true}return false}
function move(dt){const forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);if(forward||side){const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?7.2:4.15;const v=new THREE.Vector3(side,0,-forward).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),yaw).multiplyScalar(speed*dt);const nx=player.position.x+v.x,nz=player.position.z+v.z;if(!blocked(nx,player.position.z))player.position.x=nx;if(!blocked(player.position.x,nz))player.position.z=nz;}player.position.y+=verticalVelocity*dt;verticalVelocity-=12*dt;if(player.position.y<0){player.position.y=0;verticalVelocity=0;}}
function handleInteract(){if(focus)interact(focus)}
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
function animateNPCs(t){for(const p of world.people){const mesh=p.mesh;const moving=(p.routine.includes('way')||p.routine.includes('errand')||p.routine.includes('heading'));if(moving&&Math.hypot(p.x-player.position.x,p.z-player.position.z)>4){p.x+=Math.sin(t*.12+p.walkSeed)*.002;p.z+=Math.cos(t*.11+p.walkSeed)*.002;mesh.position.x=p.x;mesh.position.z=p.z;mesh.rotation.y=Math.sin(t*.15+p.walkSeed)*.3}mesh.position.y=Math.sin(t*2+p.walkSeed)*.018}}
function applyLight(){const h=world.minute/60;const warm=Math.max(0,1-Math.abs(h-17)/8);world.sun.intensity=1.55+warm*1.8;world.sun.position.set(-35+Math.cos(h/24*Math.PI*2)*20,30+Math.sin(h/24*Math.PI*2)*22,24);const night=Math.max(0,1-Math.abs(h-12)/7);scene.background.setRGB(.055+night*.53,.09+night*.62,.12+night*.61);scene.fog.color.copy(scene.background);}
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;if(started){move(dt);animateNPCs(t);simAccumulator+=dt;if(simAccumulator>=1){simAccumulator-=1;simMinute();updateUI()}findFocus();applyLight();}renderer.render(scene,camera)}
frame();

$('beginButton').onclick=()=>{started=true;$('startScreen').classList.add('hidden');canvas.requestPointerLock?.();toast('Welcome to Harborlight. Take the day at your pace.');log('You stepped into Harborlight on a clear spring morning.');updateUI()};
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas});
document.addEventListener('mousemove',e=>{if(!locked||!started)return;yaw-=e.movementX*.0022;pitch-=e.movementY*.0019;pitch=Math.max(-1.35,Math.min(1.35,pitch));setView()});
document.addEventListener('keydown',e=>{if($('modalBackdrop').classList.contains('open')){if(e.code==='Escape')closeModal();return}keys.add(e.code);if(e.code==='Space'){e.preventDefault();if(started&&player.position.y<=.01)verticalVelocity=4.5}if(e.code==='KeyE'&&!e.repeat&&started)handleInteract();if(e.code==='KeyJ'&&!e.repeat&&started)cityModal();if(e.code==='KeyI'&&!e.repeat&&started)statusModal()});document.addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('click',()=>{if(started&&!locked&&!$('modalBackdrop').classList.contains('open'))canvas.requestPointerLock?.()});
// Drag-look and a simple left-side touch walk region for tablets/phones.
let touchStart=null,touchId=null;canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){touchStart={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY};touchId=e.pointerId;canvas.setPointerCapture(e.pointerId)}});canvas.addEventListener('pointermove',e=>{if(e.pointerType!=='touch'||!touchStart||e.pointerId!==touchId||!started)return;const dx=e.clientX-touchStart.lastX,dy=e.clientY-touchStart.lastY;touchStart.lastX=e.clientX;touchStart.lastY=e.clientY;if(touchStart.x>innerWidth*.45){yaw-=dx*.006;pitch=Math.max(-1.25,Math.min(1.25,pitch-dy*.005));setView()}else{keys.delete('KeyW');keys.delete('KeyS');keys.delete('KeyA');keys.delete('KeyD');if(Math.abs(dy)>18)keys.add(dy<0?'KeyW':'KeyS');if(Math.abs(dx)>24)keys.add(dx>0?'KeyD':'KeyA')}});canvas.addEventListener('pointerup',e=>{if(e.pointerType==='touch'){touchStart=null;touchId=null;for(const k of ['KeyW','KeyS','KeyA','KeyD'])keys.delete(k)}});
$('objectivesButton').title='Choose what matters to you';window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7))});
if(saved?.world){world.log=saved.world.log||[];world.minute=saved.world.minute??495;world.day=saved.world.day??1;world.needs=saved.world.needs||world.needs;world.balance=saved.world.balance??420;world.occupation=saved.world.occupation||'Between chapters';world.city=saved.world.city||world.city;world.relations=saved.world.relations||world.relations;world.skill=saved.world.skill||0;world.reputation=saved.world.reputation||0;world.age=saved.world.age||24;world.events=saved.world.events||[];if(saved.world.playerPosition)player.position.set(saved.world.playerPosition.x,0,saved.world.playerPosition.z);renderLog();updateUI()}
updateUI();
