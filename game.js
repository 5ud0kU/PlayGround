import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#a9c6c6');
scene.fog = new THREE.FogExp2('#9cb9b7', 0.0065);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .1, 260);
camera.position.set(0, 1.68, 11);
const renderer = new THREE.WebGLRenderer({ canvas: $('world'), antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene.add(new THREE.HemisphereLight('#d9eeeb', '#686965', 2.0));
const sun = new THREE.DirectionalLight('#ffe3b4', 3.2);
sun.position.set(-34, 54, 18); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -45; sun.shadow.camera.right = 45; sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
sun.shadow.bias = -.00035; scene.add(sun);
const fill = new THREE.DirectionalLight('#9dc7d6', .8); fill.position.set(30, 18, -35); scene.add(fill);

const mats = {};
const mat = (name, color, roughness=.8, extra={}) => mats[name] ||= new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const groundMat = mat('ground','#788b78');
const asphaltMat = mat('asphalt','#3c4647');
const sidewalkMat = mat('sidewalk','#a7a59a');
const concreteMat = mat('concrete','#7e8981');
const trimMat = mat('trim','#d6c9ad');
const darkMat = mat('dark','#283538');
const glassMat = new THREE.MeshStandardMaterial({color:'#86aeb4',roughness:.22,metalness:.18,emissive:'#263e43',emissiveIntensity:.3});
const litGlassMat = new THREE.MeshStandardMaterial({color:'#cfb989',roughness:.3,emissive:'#eacb87',emissiveIntensity:.48});
const leafMats = ['#647b61','#778b68','#879476','#566e5c'].map(c=>mat(`leaf${c}`,c));
const buildingPalette = ['#d3c4a6','#a9b5ae','#c6ad94','#b5bcb4','#d8cfc0','#8c9b99','#c8b49a','#a4a8a0'];
const boxGeo = new THREE.BoxGeometry(1,1,1);
function box(parent, x,y,z, sx,sy,sz, material, cast=false, receive=true) {
  const mesh = new THREE.Mesh(boxGeo, material); mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz); mesh.castShadow=cast; mesh.receiveShadow=receive; parent.add(mesh); return mesh;
}
function cylinder(parent,x,y,z,r1,r2,h,material,segments=8){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}
function sphere(parent,x,y,z,r,material,seg=10){const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,seg,Math.max(6,seg-2)),material);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}

// A walkable waterfront district: block geometry, street furniture, storefronts and park.
box(scene,0,-.24,0,220,.45,220,groundMat,false);
box(scene,0,-.08,0,12,.18,220,asphaltMat,false);
box(scene,-9,-.08,0,5,.18,220,sidewalkMat,false); box(scene,9,-.08,0,5,.18,220,sidewalkMat,false);
// curb strips and lane markings
box(scene,-6.45,.015,0,.18,.12,220,mat('curb','#d8d1bd'),false); box(scene,6.45,.015,0,.18,.12,mat('curb2','#d8d1bd'),false);
for(let z=-100;z<110;z+=8) box(scene,0,.018,z,.13,.025,3.8,mat('line','#c6bda8'),false);
// Cross streets and blockside walks
for(const z of [-84,-60,-36,-12,12,36,60,84]){
  box(scene,0,-.04,z,80,.14,5,asphaltMat,false);
  box(scene,0,.015,z-3.15,80,.13,1.2,sidewalkMat,false); box(scene,0,.015,z+3.15,80,.13,1.2,sidewalkMat,false);
  for(let x=-38;x<=38;x+=14) box(scene,x,.04,z,4,.02,.08,mat('cross','#ded8c4'),false);
}
// Sidewalk seams
for(let z=-100;z<105;z+=4){box(scene,-9,.022,z,.025,.02,3.9,mat('seam','#918f84'),false);box(scene,9,.022,z,.025,.02,3.9,mat('seam2','#918f84'),false);}

const landmarks=[];
function makeSign(parent,text,color='#213a37'){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');
 ctx.fillStyle=color;ctx.fillRect(0,0,512,128);ctx.fillStyle='#efe9d8';ctx.font='600 43px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text.toUpperCase(),256,64);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(4.5,.9),new THREE.MeshBasicMaterial({map:texture}));mesh.position.set(0,3.3,1.065);parent.add(mesh);
}
function makeBuilding(x,z,name,type='residence',color,opts={}){
 const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
 const width=opts.width||9.5,depth=opts.depth||10,height=opts.height||12;
 const facade=mat(`facade${buildingPalette.indexOf(color)}`,color||buildingPalette[Math.floor(Math.random()*buildingPalette.length)]);
 box(group,0,height/2,0,width,height,depth,facade,true);
 // subtle base course and cornice
 box(group,0,.45,depth/2+.015,width,.75,.12,mat('base','#766f62'),false);
 box(group,0,height-.15,0,width+.3,.3,depth+.3,trimMat,false);
 const floors=Math.max(2,Math.floor(height/3.2));
 for(let f=0;f<floors;f++){
   const yy=2.1+f*2.7;
   for(let c=0;c<3;c++){
    const xx=-width*.31+c*width*.31;
    if(f===0&&c===1&&(type==='cafe'||type==='market'||type==='work')){
      box(group,xx,yy,depth/2+.04,width*.22,1.85,.12,glassMat,false);
      box(group,xx,yy+.98,depth/2+.12,width*.24,.12,.16,trimMat,false);
    } else {
      box(group,xx,yy,depth/2+.035,1.22,1.65,.08,Math.random()>.3?glassMat:litGlassMat,false);
      box(group,xx,yy-.87,depth/2+.08,1.48,.08,.14,trimMat,false);
    }
   }
 }
 const doorMat=mat('door'+name,'#514b40');box(group,0,1.25,depth/2+.1,1.15,2.5,.2,doorMat,false);
 sphere(group,.38,1.2,depth/2+.23,.07,mat('brass','#c8a86d'));
 if(name)makeSign(group,name, type==='cafe'?'#345246':type==='work'?'#364957':'#514c3c');
 // rain pipe, wall lamps, rooftop vent
 cylinder(group,width/2-.28,height/2,depth/2+.1,.055,.055,height,mat('pipe','#7a7569'),6);
 box(group,0,height+.34,0,width*.56,.65,depth*.62,mat('roof','#797970'),false);
 if(type==='cafe'||type==='market'){
   const awning=mat('awning'+name,type==='cafe'?'#b6694c':'#657e70');box(group,0,2.65,depth/2+.5,width*.82,.23,1.15,awning,false);
 }
 landmarks.push({name,type,x,z,group,doorX:x,doorZ:z+depth/2+.8});return group;
}
// Main street storefronts
makeBuilding(-13,-20,'Tide & Table','cafe','#bdad95',{width:10,depth:10,height:10});
makeBuilding(13,-18,'The Greenhouse','market','#aab99f',{width:10,depth:10,height:11});
makeBuilding(-13,5,'Old Quay Flats','home','#c9b79e',{width:10,depth:11,height:16});
makeBuilding(13,7,'Harbor Works','work','#abb6b3',{width:10,depth:11,height:15});
makeBuilding(-13,31,'The Lantern','cafe','#c6a889',{width:10,depth:10,height:11});
makeBuilding(13,32,'Community Hall','community','#c8c3ad',{width:10,depth:10,height:12});
makeBuilding(-13,-47,'Harbor Clinic','clinic','#d1d2c7',{width:10,depth:11,height:13});
makeBuilding(13,-46,'Post & Parcel','market','#b5c1b6',{width:10,depth:10,height:10});
// Background neighborhood blocks - varied apartment and office masses, lower detail.
for(let side of [-1,1]) for(let z=-91;z<=91;z+=24){
 for(let row=0;row<2;row++){
  const x=side*(21+row*13); const h=7+Math.random()*17; const w=9+Math.random()*4; const d=10+Math.random()*4;
  const building=new THREE.Group();building.position.set(x,0,z+(row?10:-7));scene.add(building);
  const fm=mat(`bg${Math.floor(Math.random()*buildingPalette.length)}${Math.floor(h)}`,buildingPalette[Math.floor(Math.random()*buildingPalette.length)]);
  box(building,0,h/2,0,w,h,d,fm,true);
  box(building,0,h,0,w+.3,.3,d+.3,mat('bgtrim','#c4b8a0'),false);
  for(let floor=0;floor<Math.floor(h/3);floor++) for(let c=0;c<3;c++) box(building,-w*.3+c*w*.3,1.8+floor*2.6,d/2+.04,1.1,1.35,.08,Math.random()>.5?glassMat:litGlassMat,false);
 }
}

// A small green pocket park on the west side.
const parkFloor=mat('parkfloor','#607b63');box(scene,-30,-.02,-4,18,.12,24,parkFloor,false);
for(let i=0;i<24;i++){
 const x=-37+Math.random()*14,z=-15+Math.random()*22;
 cylinder(scene,x,1.35,z,.12,.25,2.7,mat('trunk','#68543e'),7);
 sphere(scene,x,3.05,z,1.35,leafMats[i%leafMats.length],9);
}
box(scene,-30,.27,7,3.2,.45,.65,mat('bench','#795a42'),true);box(scene,-30,.63,7.9,3.2,.12,.15,mat('benchback','#795a42'),true);
const bench={name:'Park bench',type:'bench',x:-30,z:7,doorX:-30,doorZ:7};landmarks.push(bench);
cylinder(scene,-30,.75,1.3,1.5,1.5,.12,mat('fountain','#718a8d'),18);cylinder(scene,-30,1.2,1.3,.28,.4,.8,mat('fountainstone','#a6a69a'),12);landmarks.push({name:'Old stone fountain',type:'fountain',x:-30,z:1,doorX:-30,doorZ:1});
// Lamp posts and street trees in the walkable strips
for(let z=-93;z<100;z+=18) for(const x of [-10.7,10.7]){
 cylinder(scene,x,2.1,z,.1,.13,4.2,mat('lampmetal','#454d49'),7);box(scene,x,4.25,z,.55,.13,.25,mat('lampglow','#eed19a',.35,{emissive:'#daa968',emissiveIntensity:.75}),false);
}
for(let z=-78;z<95;z+=20) for(const x of [-8,8]){
 cylinder(scene,x,1.2,z,.17,.3,2.4,mat('bark','#766047'),7);sphere(scene,x,3,z,1.25,leafMats[(z+100)%leafMats.length|0],9);
}
// Waterfront glimpse beyond the end of Harbor Walk.
const waterMat=new THREE.MeshStandardMaterial({color:'#3c6870',roughness:.28,metalness:.12});box(scene,0,-.1,-110,200,.22,28,waterMat,false);
for(let i=0;i<16;i++){const y=new THREE.Mesh(new THREE.BoxGeometry(4,.025,.12),mat(`wave${i}`,'#83a9a7',.3,{transparent:true,opacity:.48}));y.position.set(-90+i*11,.03,-105+Math.sin(i)*4);scene.add(y);}

// Ambient city actors: each person has goals, temperament, social memory and a daily rhythm.
const peopleData=[
 ['Mina Park','café owner','warm',[-13,-15],[-13,-19],.74],['Jonah Reed','teacher','curious',[6,-5],[-13,28],.61],['Priya Das','designer','thoughtful',[-5,13],[13,7],.52],['Eli Brooks','student','restless',[3,20],[-30,7],.68],['Nora Ellis','nurse','kind',[-4,-30],[-13,-47],.82],['Luis Ortega','courier','outgoing',[4,-42],[13,-46],.58],['Ari Tanaka','musician','dreaming',[-2,5],[-13,31],.65],['Sam Carter','retired sailor','wry',[1,35],[-30,7],.79],['Bea Wilson','botanist','curious',[-5,-12],[13,-18],.72],['Theo Martin','cook','ambitious',[2,-25],[-13,-20],.55],['Rosa Alvarez','accountant','steady',[4,45],[13,7],.64],['Kai Bennett','photographer','quiet',[-3,-50],[-13,-47],.48]
];
const people=[];
const skinColors=['#d6a985','#efc4a1','#9d684e','#c89170','#e1b28f','#b77f63'];
const shirtColors=['#628176','#b16c54','#64768a','#bb9f69','#6d617e','#718a87','#bd8870','#596b5f'];
function makePerson(data,index){
 const [name,job,trait,start,dest,kindness]=data; const g=new THREE.Group();g.position.set(start[0],0,start[1]);scene.add(g);
 const skin=mat(`skin${index}`,skinColors[index%skinColors.length]);const shirt=mat(`shirt${index}`,shirtColors[index%shirtColors.length]);const pants=mat(`pants${index}`,index%2?'#39464a':'#55534b');
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.27,.53,4,8),shirt);torso.position.y=1.16;torso.castShadow=true;g.add(torso);
 const head=sphere(g,0,1.88,0,.21,skin,10);const hair=sphere(g,0,2.02,-.025,.22,mat(`hair${index}`,['#342f2b','#564239','#282a2d','#81634c'][index%4]),9);hair.scale.set(1,.53,1);
 for(const dx of [-.12,.12]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.48,3,7),pants);leg.position.set(dx,.43,0);leg.castShadow=true;g.add(leg);}
 for(const dx of [-.34,.34]){const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.08,.47,3,7),shirt);arm.position.set(dx,1.18,0);arm.rotation.z=dx<0?-.12:.12;arm.castShadow=true;g.add(arm);}
 const target=new THREE.Vector3(dest[0],0,dest[1]);
 const p={name,job,trait,kindness,g,head,torso,arms:g.children.slice(-2),legs:g.children.slice(1,3),target,speed:.42+Math.random()*.24,phase:Math.random()*6.28,trust:Math.round(20+Math.random()*35),memory:[],mood:['hopeful','in a hurry','a little distracted','content'][index%4],active:true};people.push(p);return p;
}
peopleData.forEach(makePerson);

// Player body cues (hands/forearms) remain in the camera for first-person presence.
const arms=new THREE.Group();camera.add(arms);arms.position.set(0,-.46,-.88);arms.scale.setScalar(.68);scene.add(camera);
const sleeveMat=mat('playerSleeve','#9b7865'), handMat=mat('playerHand','#d3a887');
const forearm=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.48,4,9),sleeveMat);forearm.position.set(.28,-.06,-.02);forearm.rotation.z=-.2;arms.add(forearm);
const hand=sphere(arms,.28,-.36,-.03,.12,handMat,10);hand.scale.set(.85,1.2,.65);

// Tiny procedural clouds / distant skyline make the horizon feel populated.
for(let i=0;i<28;i++){
 const cloud=new THREE.Group();const x=(Math.random()-.5)*190,z=-115+Math.random()*70,y=24+Math.random()*18;
 for(let j=0;j<4;j++){const puff=sphere(cloud,(j-1.5)*1.3,Math.random()*.5,0,1.6+Math.random()*.8,mat(`cloud${i}`,'#d7e3dd',1,{transparent:true,opacity:.25}),8);puff.scale.set(1.6,.55,1);}
 cloud.position.set(x,y,z);scene.add(cloud);
}

const state={time:8.25,day:1,energy:82,wellbeing:74,connection:38,cash:840,fitness:68,skill:12,rep:0,weather:'Clear and mild',weatherKey:'clear',playerName:'Alex Morgan',lastAction:'Find your rhythm.',memories:[],started:false};
try{const saved=JSON.parse(localStorage.getItem('realityUnboundSave')||'null');if(saved)Object.assign(state,saved,{started:false});}catch{}
let yaw=0,pitch=0,keys={},locked=false,modalOpen=false,nearest=null,activePerson=null,lastTick=performance.now(),eventTimer=0,toastTimer;
const clockEl=$('clock-time');
function save(){try{const data={...state,memories:state.memories.slice(-18)};delete data.started;localStorage.setItem('realityUnboundSave',JSON.stringify(data));}catch{}}
function setToast(text){const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2500);}
function setEvent(text){$('world-event').innerHTML=text;}
function ui(){
 $('energy-num').textContent=Math.round(state.energy)+'%';$('energy-bar').style.width=state.energy+'%';
 $('wellbeing-num').textContent=Math.round(state.wellbeing)+'%';$('wellbeing-bar').style.width=state.wellbeing+'%';
 $('connection-num').textContent=Math.round(state.connection)+'%';$('connection-bar').style.width=state.connection+'%';
 $('cash').textContent='$ '+Math.round(state.cash).toLocaleString();$('fitness').textContent=Math.round(state.fitness);$('skill').textContent=Math.round(state.skill);$('rep').textContent=Math.round(state.rep);
 const hour=Math.floor(state.time),min=Math.floor((state.time-hour)*60);clockEl.textContent=`${String(hour%24).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
 $('clock-date').textContent=`${['MON','TUE','WED','THU','FRI','SAT','SUN'][(state.day-1)%7]} · ${String(state.day).padStart(2,'0')} MAY`;
 $('mood-label').textContent=state.wellbeing>65?'STEADY':state.wellbeing>35?'RESTLESS':'WORN';
 $('intention').textContent=state.lastAction;$('intention-hint').textContent=state.lastAction==='Find your rhythm.'?'Your life is yours to shape.':'A day is built one choice at a time.';
}
function advance(hours=.22){
 const previous=Math.floor(state.time);state.time+=hours;if(state.time>=24){state.time-=24;state.day++;}
 state.energy=Math.max(2,state.energy-hours*1.25);state.wellbeing=Math.max(5,Math.min(100,state.wellbeing+ (state.connection<20?-.25:0)));
 if(Math.floor(state.time)!==previous){const h=Math.floor(state.time);if(h>=22||h<6){$('weather-name').textContent='Night air, still and cool';$('weather-big').textContent='☾';$('weather-icon').textContent='☾';}else{$('weather-name').textContent=state.weather;$('weather-big').textContent=state.weatherKey==='clear'?'☀':'☁';$('weather-icon').textContent=state.weatherKey==='clear'?'☀':'☁';}}
 ui();save();
}
function memory(text){state.memories.push({day:state.day,time:clockEl.textContent,text});if(state.memories.length>30)state.memories.shift();}
function openModal({kicker,title,copy,actions,foot='Time moves with you.'}){
 modalOpen=true;document.exitPointerLock?.();$('modal-kicker').textContent=kicker;$('modal-title').textContent=title;$('modal-copy').textContent=copy;$('modal-foot-note').textContent=foot;
 const holder=$('modal-actions');holder.replaceChildren();for(const a of actions){const btn=document.createElement('button');btn.className='action';btn.innerHTML=`<span>${a.label}</span><span>${a.cost||a.meta||'CHOOSE'}</span>`;btn.onclick=()=>{a.run();closeModal();};holder.append(btn);}
 $('modal-wrap').classList.add('show');
}
function closeModal(){modalOpen=false;$('modal-wrap').classList.remove('show');}
$('modal-close').onclick=closeModal;

function nearestThing(){
 const pos=camera.position;let best=null,bestD=1e9;
 for(const place of landmarks){const d=Math.hypot(place.doorX-pos.x,place.doorZ-pos.z);if(d<bestD&&d<4.2){best=place;bestD=d;}}
 for(const person of people){const d=Math.hypot(person.g.position.x-pos.x,person.g.position.z-pos.z);if(d<bestD&&d<3.1){best={type:'person',name:person.name,person};bestD=d;}}
 return best;
}
function openPlace(place){
 if(place.type==='person')return talk(place.person);
 if(place.type==='cafe'){
  openModal({kicker:'TIDE & TABLE · CORNER CAFÉ',title:'A pause in the day',copy:'The espresso machine sighs behind the counter. Mina remembers the regulars, though you are new to her.',actions:[
   {label:'Order a coffee',cost:'$5 · +energy',run:()=>{if(state.cash<5)return setToast('You need a little more cash.');state.cash-=5;state.energy=Math.min(100,state.energy+18);state.wellbeing=Math.min(100,state.wellbeing+4);state.lastAction='A coffee and a slower breath.';setEvent('The first sip is warm. <em>Mina</em> asks if you are settling in.');memory('Stopped for coffee at Tide & Table.');advance(.28);setToast('Coffee shared. Energy restored.');}},
   {label:'Pick up a short shift',cost:'+ $48 · +skill',run:()=>{state.cash+=48;state.skill+=2;state.energy=Math.max(5,state.energy-15);state.connection+=4;state.lastAction='A few hours behind the counter.';setEvent('A small shift at the café turned into a conversation with <em>Mina</em>.');memory('Worked a short café shift; earned $48.');advance(1.4);setToast('Shift complete · $48 earned · hospitality +2.');}},
   {label:'Ask Mina about the neighborhood',cost:'+ connection',run:()=>{state.connection=Math.min(100,state.connection+10);state.rep+=1;state.lastAction='Getting to know the people here.';memory('Mina told you there is a good view from Harbor Walk.');setEvent('<em>Mina</em> tells you the old harbor is beautiful around dusk.');advance(.18);setToast('A new face becomes a familiar one.');}}
  ]});
 }else if(place.type==='market'){
  openModal({kicker:'THE GREENHOUSE · LOCAL GROCER',title:'Pick up a few things',copy:'Fresh bread, oranges, and a handwritten note about the weekend market. The owner is watering the basil by the door.',actions:[
   {label:'Buy fruit and bread',cost:'$9 · +wellbeing',run:()=>{if(state.cash<9)return setToast('You need a little more cash.');state.cash-=9;state.wellbeing=Math.min(100,state.wellbeing+15);state.energy=Math.min(100,state.energy+5);state.lastAction='Something simple, something good.';memory('Bought fresh bread and oranges.');advance(.2);setToast('A little food for the road.');}},
   {label:'Ask about work',cost:'+ opportunity',run:()=>{state.connection+=5;state.skill+=1;state.lastAction='Keeping an eye open for work.';memory('Asked at The Greenhouse about work; a weekend shift may open.');advance(.25);setToast('The owner may need a hand this weekend.');}},
   {label:'Browse the notice board',cost:'FREE',run:()=>{openModal({kicker:'COMMUNITY NOTICEBOARD',title:'A few open doors',copy:'A handwritten list is pinned beneath a flyer for the neighborhood supper. There is always more than one way to start.',actions:[{label:'Volunteer at the community hall',meta:'+ connection · + reputation',run:()=>{state.connection+=8;state.rep+=2;state.lastAction='Making a little room for community.';memory('Signed up to volunteer at the community hall.');advance(.6);setToast('You signed up for Saturday.');}},{label:'Look into a weekend market stall',meta:'+ ambition',run:()=>{state.skill+=1;state.lastAction='An idea starts to take shape.';advance(.3);setToast('There may be room for a small stall.');}}]});}}
  ]});
 }else if(place.type==='work'){
  openModal({kicker:'HARBOR WORKS · CO-WORKING',title:'Work, learn, or start something',copy:'A bright shared space with a view of the water. A few desks are open and the noticeboard is full of small opportunities.',actions:[
   {label:'Take a focus session',cost:'+ skill · − energy',run:()=>{state.skill+=3;state.energy=Math.max(5,state.energy-13);state.cash+=22;state.lastAction='Putting in a focused hour.';memory('Did a focused work session at Harbor Works.');advance(1);setToast('Productive hour · $22 · skills +3.');}},
   {label:'Meet someone over a tea',cost:'$4 · + connection',run:()=>{if(state.cash<4)return setToast('You need a little more cash.');state.cash-=4;state.connection+=9;state.rep+=1;state.lastAction='An unexpected introduction.';advance(.35);setEvent('Someone at the next table knows of a project looking for a curious mind.');setToast('A useful conversation.');}},
   {label:'Read a free course guide',cost:'+ skill',run:()=>{state.skill+=2;state.lastAction='Learning something you can carry.';advance(.7);setToast('You found a course worth following. Skills +2.');}}
  ]});
 }else if(place.type==='home'){
  openModal({kicker:'OLD QUAY FLATS · YOUR ROOM',title:'The door is open',copy:'A modest room, a clean window, and a little space to make your own. The city sounds softer from here.',actions:[
   {label:'Rest for a while',cost:'+ energy · + wellbeing',run:()=>{state.energy=Math.min(100,state.energy+34);state.wellbeing=Math.min(100,state.wellbeing+8);state.lastAction='A little rest, with the window open.';memory('Returned home to rest.');advance(2);setToast('You feel more like yourself.');}},
   {label:'Tidy up and make it yours',cost:'+ wellbeing · + skill',run:()=>{state.wellbeing+=12;state.skill+=1;state.lastAction='Making a place feel like home.';advance(.5);setToast('A little order changes the whole room.');}},
   {label:'Sleep until morning',cost:'REST',run:()=>{state.energy=90;state.wellbeing=Math.min(100,state.wellbeing+12);state.lastAction='A fresh morning, and another chance.';advance(Math.max(1,24-state.time+7));setEvent('Morning light fills the windows of Old Quay. The world kept moving while you slept.');memory('Slept at home; woke to a new day.');setToast('Good morning. The city is waking up.');}}
  ]});
 }else if(place.type==='bench'){
  openModal({kicker:'POCKET PARK · OLD QUAY',title:'Sit for a moment',copy:'Leaves catch the light over the park. A couple of neighbors pass by with their dogs. No one is in a hurry.',actions:[{label:'Take a quiet break',cost:'+ wellbeing',run:()=>{state.wellbeing=Math.min(100,state.wellbeing+16);state.energy=Math.min(100,state.energy+7);state.lastAction='The quiet has its own kind of company.';advance(.35);setEvent('A dog noses curiously at the fallen leaves; its owner smiles.');setToast('A quiet moment well spent.');}},{label:'Stretch and move a little',cost:'+ fitness · + energy',run:()=>{state.fitness+=2;state.energy=Math.max(5,state.energy-6);state.wellbeing+=6;state.lastAction='A little movement clears the head.';advance(.45);setToast('Movement +2 · wellbeing improved.');}}]});
 }else if(place.type==='fountain'){
  openModal({kicker:'OLD QUAY · FOUNTAIN',title:'Listen to the water',copy:'The old stone fountain has been here longer than most of the buildings. Rainwater and stories collect in the same places.',actions:[{label:'Pause and take it in',cost:'+ wellbeing · + connection',run:()=>{state.wellbeing+=10;state.connection+=3;state.lastAction='Letting the city arrive at its own pace.';advance(.25);setToast('A small stillness in a busy city.');}},{label:'Leave a note for the next person',cost:'− $1 · + reputation',run:()=>{state.cash=Math.max(0,state.cash-1);state.rep+=1;memory('Left a kind note at the old fountain.');advance(.1);setEvent('A stranger finds your note and carries the thought with them.');setToast('Some kindness travels.');}}]});
 }else if(place.type==='community'){
  openModal({kicker:'COMMUNITY HALL · OPEN DOOR',title:'Find your people',copy:'The hall smells like fresh paint and tea. There is a shared meal on Wednesday and a volunteer group that needs a hand.',actions:[{label:'Join the shared supper',cost:'$8 · + connection',run:()=>{if(state.cash<8)return setToast('You need a little more cash.');state.cash-=8;state.connection+=15;state.wellbeing+=8;state.lastAction='A table is better when it is shared.';memory('Joined a community supper at the hall.');advance(1);setToast('Good food, new names, a place at the table.');}},{label:'Volunteer for the garden',cost:'+ reputation · + connection',run:()=>{state.rep+=3;state.connection+=7;state.fitness+=1;state.lastAction='Giving something back to the block.';advance(1.5);setEvent('Neighbors talk about a shared garden taking root behind the hall.');setToast('Two hours well spent.');}}]});
 }else if(place.type==='clinic'){
  openModal({kicker:'HARBOR CLINIC · WALK-IN',title:'Take care of yourself',copy:'A calm waiting room, kind staff, and a small community health board by reception.',actions:[{label:'Routine check-in',cost:'$18 · + wellbeing',run:()=>{if(state.cash<18)return setToast('You need a little more cash.');state.cash-=18;state.wellbeing+=14;state.lastAction='Looking after the person you live in.';advance(.5);setToast('Check-in complete. You are doing okay.');}},{label:'Ask about low-cost support',cost:'FREE',run:()=>{state.connection+=4;state.lastAction='Finding the support that is already here.';advance(.2);setToast('The front desk gave you a list of local services.');}}]});
 }
}
function talk(person){
 activePerson=person;
 const greetings={warm:'A welcoming smile comes easily.',curious:'Their gaze lingers, interested in who you might be.',thoughtful:'They pause, measuring the moment before speaking.',restless:'They keep glancing down the street, but make time for you.',kind:'There is an easy kindness in their voice.',outgoing:'They greet you like the conversation has already started.',wry:'A quick, knowing smile crosses their face.',dreaming:'They seem to return from somewhere far away.',ambitious:'They are between tasks, already thinking ahead.',quiet:'They offer a small smile and wait to see what you say.',steady:'They meet your eyes with calm attention.'};
 const line=person.memory.length?`They remember you: “${person.memory[person.memory.length-1]}”`:`${greetings[person.trait]||'They seem open to a conversation.'} ${person.name} works as a ${person.job}.`;
 openModal({kicker:`${person.job.toUpperCase()} · ${person.mood.toUpperCase()}`,title:person.name,copy:line,actions:[
  {label:'Ask how their day is going',cost:'+ connection',run:()=>{const gain=person.kindness>0.68?12:8;state.connection=Math.min(100,state.connection+gain);person.trust=Math.min(100,person.trust+10);person.memory.push('You asked how their day was.');state.lastAction=`A good conversation with ${person.name}.`;setEvent(`<em>${person.name}</em> shares a little about their day.`);advance(.16);setToast(`${person.name} seems glad you asked.`);}},
  {label:'Ask about their work and life here',cost:'+ skill · + connection',run:()=>{state.skill+=1;state.connection=Math.min(100,state.connection+6);person.trust+=5;person.memory.push('You asked about their work.');state.lastAction='Learning a little from someone else.';advance(.22);setEvent(`${person.name} tells you what brought them to Harborlight.`);setToast(`You learned something about ${person.name}.`);}},
  {label:'Invite them for a coffee',cost:'$5 · build a bond',run:()=>{if(state.cash<5)return setToast('You need a little more cash.');state.cash-=5;state.connection=Math.min(100,state.connection+13);person.trust=Math.min(100,person.trust+16);person.memory.push('You shared a coffee together.');person.mood='more at ease';state.lastAction=`A coffee with ${person.name}.`;advance(.5);setEvent(`<em>${person.name}</em> says you should do this again sometime.`);setToast('A new friendship might be beginning.');}},
  {label:'Say goodbye for now',meta:'BE KIND',run:()=>{person.memory.push('You shared a friendly hello.');person.trust+=2;advance(.04);}}
 ],foot:`Trust ${person.trust}% · Their life continues either way.`});
}
function interact(){if(modalOpen)return;if(nearest)openPlace(nearest);else setToast('Take a walk. Harborlight has time for you.');}

function setTarget(person){
 const possible=[[person.g.position.x,person.g.position.z],...landmarks.filter(l=>l.type==='bench'||l.type==='cafe'||l.type==='market'||l.type==='work').map(l=>[l.x,l.z])];
 const index=Math.floor(Math.random()*possible.length);const dest=possible[index];person.target.set(dest[0]+(Math.random()-.5)*2,0,dest[1]+(Math.random()-.5)*2);
}
function walkPeople(dt,time){
 for(const p of people){
  const pos=p.g.position,dx=p.target.x-pos.x,dz=p.target.z-pos.z,d=Math.hypot(dx,dz);
  if(d<.6){setTarget(p);continue;}
  // people stay in the pedestrian realm, never cross the central traffic lane
  const speed=p.speed*(p.mood==='in a hurry'?1.5:1);
  pos.x+=dx/d*speed*dt;pos.z+=dz/d*speed*dt;
  if(Math.abs(pos.x)<6.8)pos.x=pos.x<0?-7:7;
  p.g.rotation.y=Math.atan2(dx,dz);
  p.phase+=dt*6;const bob=Math.sin(p.phase)*.025;
  p.torso.position.y=1.16+bob;p.head.position.y=1.88+bob;
  for(let i=0;i<p.legs.length;i++)p.legs[i].rotation.x=Math.sin(p.phase+(i*Math.PI))*Math.min(.45,speed*.62);
  for(let i=0;i<p.arms.length;i++)p.arms[i].rotation.x=Math.sin(p.phase+(i?0:Math.PI))*.2;
 }
}

const soundButton=$('sound-btn');let audio=null,soundOn=false;
function beep(freq=520,duration=.08){if(!soundOn)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();const osc=audio.createOscillator(),gain=audio.createGain();osc.frequency.value=freq;osc.type='sine';gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}catch{}}
soundButton.onclick=()=>{soundOn=!soundOn;soundButton.textContent=soundOn?'♫':'♩';if(soundOn)beep();setToast(soundOn?'Ambient sound enabled.':'Sound off.');};

function begin(){state.started=true;$('start-screen').classList.add('hidden');$('world').requestPointerLock?.();setToast('Welcome to Harborlight, Alex.');memory('Arrived in Harborlight.');save();}
$('begin').onclick=begin;
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===$('world');});
document.addEventListener('mousemove',e=>{if(locked&&!modalOpen){yaw-=e.movementX*.0022;pitch=Math.max(-1.25,Math.min(1.25,pitch-e.movementY*.0018));}});
document.addEventListener('keydown',e=>{
 if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'&&$('map-panel').style.display==='block'){$('map-panel').style.display='none';return;}
 if(e.code==='KeyE'&&!modalOpen&&state.started){interact();return;}
 if(e.code==='KeyM'&&state.started){toggleMap();return;}
 if(e.code==='KeyJ'&&state.started){openJournal();return;}
 if(e.code==='KeyF'&&state.started){toggleWeather();return;}
 keys[e.code]=true;
});document.addEventListener('keyup',e=>keys[e.code]=false);
$('world').addEventListener('click',()=>{if(state.started&&!modalOpen&&!locked)$('world').requestPointerLock?.();});
function toggleMap(){const el=$('map-panel');el.style.display=el.style.display==='block'?'none':'block';document.exitPointerLock?.();}
$('map-btn').onclick=toggleMap;$('map-close').onclick=()=>{$('map-panel').style.display='none';};
function openJournal(){
 const memories=state.memories.slice(-6).reverse();const copy=memories.length?memories.map(m=>`${m.time} · ${m.text}`).join('     /     '):'Your story is waiting for its first page.';
 openModal({kicker:'YOUR JOURNAL · DAY '+state.day,title:'The life you are making',copy,actions:[
  {label:'Rest, eat, and care for yourself',meta:'NEEDS',run:()=>{openModal({kicker:'DAILY LIFE',title:'Care is a practice',copy:'Your wellbeing is the shape of all the small things: sleep, a decent meal, movement, and a friendly face.',actions:[{label:'Take a proper rest',meta:'+ energy',run:()=>{state.energy=Math.min(100,state.energy+25);state.wellbeing+=4;advance(1);setToast('Rest makes room for the rest of the day.');}},{label:'Stretch and go for a walk',meta:'+ fitness · − energy',run:()=>{state.fitness+=2;state.energy-=5;state.wellbeing+=7;advance(.5);setToast('A little movement. A clearer head.');}}]});}},
  {label:'Save your life',meta:'LOCAL SAVE',run:()=>{save();setToast('Your life in Harborlight is saved on this device.');}},
  {label:'Start over with a new life',meta:'RESET',run:()=>{if(confirm('Start a new life? This clears your saved progress.')){localStorage.removeItem('realityUnboundSave');location.reload();}}}
 ],foot:copy||'Saved locally on this device.'});
}
$('journal-btn').onclick=openJournal;
function toggleWeather(){state.weatherKey=state.weatherKey==='clear'?'overcast':'clear';state.weather=state.weatherKey==='clear'?'Clear and mild':'Soft clouds, cool breeze';$('weather-name').textContent=state.weather;$('temperature').textContent=state.weatherKey==='clear'?'18°C · light breeze':'15°C · harbor wind';$('weather-big').textContent=state.weatherKey==='clear'?'☀':'☁';$('weather-icon').textContent=state.weatherKey==='clear'?'☀':'☁';scene.fog.color.set(state.weatherKey==='clear'?'#9cb9b7':'#859a9a');scene.fog.density=state.weatherKey==='clear'?.0065:.009;setToast(state.weatherKey==='clear'?'The clouds are opening.':'Clouds roll in off the water.');}

function move(dt){
 if(!locked||modalOpen||!state.started)return;
 const forward=(keys.KeyW?1:0)-(keys.KeyS?1:0),side=(keys.KeyD?1:0)-(keys.KeyA?1:0);if(!forward&&!side)return;
 const speed=keys.ShiftLeft?5.2:3.1,angle=yaw;
 const vx=(Math.sin(angle)*forward+Math.cos(angle)*side)*speed*dt;
 const vz=(-Math.cos(angle)*forward+Math.sin(angle)*side)*speed*dt;
 const nx=camera.position.x+vx,nz=camera.position.z+vz;
 // A simple soft collision boundary keeps the player on streets, paths and sidewalks.
 const blocked=landmarks.some(l=>l.group&&Math.abs(nx-l.x)<5.2&&Math.abs(nz-l.z)<5.5);
 if(!blocked){camera.position.x=THREE.MathUtils.clamp(nx,-47,47);camera.position.z=THREE.MathUtils.clamp(nz,-101,45);}
 camera.position.y=1.68+Math.sin(performance.now()*.009)*(forward||side?.035:0);
 if(Math.random()<dt*.035){state.energy=Math.max(2,state.energy-.035);}
}
function updatePrompt(){
 nearest=nearestThing();const prompt=$('prompt');
 if(nearest){prompt.classList.add('show');$('prompt-text').textContent=nearest.type==='person'?`Talk with ${nearest.name}`:nearest.name;}
 else{prompt.classList.remove('show');}
 // position/location names evolve with coordinates
 const z=camera.position.z,x=camera.position.x;
 const district=x<-21?'Pocket Park':z<-55?'Harbor Walk':z>22?'Lantern Row':'Old Quay';
 $('district').textContent=district;$('location-sub').textContent=x<-21?'NORTH HARBOR · GREEN SPACE':z<-55?'NORTH HARBOR · WATERFRONT':z>22?'HARBORLIGHT · COMMUNITY':'NORTH HARBOR · RESIDENTIAL';
}
function worldEvents(dt){
 eventTimer+=dt;if(eventTimer>19){eventTimer=0;const ev=[
 ['A number 4 bus sighs to a stop on the cross street. <em>Two neighbors</em> climb aboard.','A small life, going somewhere.'],
 ['Somebody has left a box of books outside the <em>community hall</em>.','Take one. Leave one.'],
 ['The smell of warm bread drifts down the block from <em>Tide & Table</em>.','Mina is baking early today.'],
 ['A gull drops a shell on the pavement and pecks at the pieces.','Harborlight has its own kind of rhythm.'],
 ['A hand-lettered sign goes up: <em>Saturday supper · everyone welcome</em>.','The community hall is making room.'],
 ['A light comes on in a top-floor window. <em>Someone is home.</em>','Lives unfolding just beyond view.'],
 ['The harbor wind carries a tune from a street musician near the water.','The city is full of almost-meetings.']
 ];const item=ev[Math.floor(Math.random()*ev.length)];setEvent(item[0]);$('nearby-count').textContent=`${5+Math.floor(Math.random()*5)} ACTIVE`;}}

let prev=performance.now();
function animate(now){requestAnimationFrame(animate);const dt=Math.min(.04,(now-prev)/1000);prev=now;
 if(state.started){move(dt);walkPeople(dt,now/1000);updatePrompt();if(now-lastTick>5000){advance(.07);lastTick=now;}worldEvents(dt);}
 camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;
 const walkBob=(keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD)&&locked?Math.sin(now*.012)*.012:0;arms.position.y=-.44+walkBob;
 renderer.render(scene,camera);
}
requestAnimationFrame(animate);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));});
ui();
