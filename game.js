import * as THREE from 'three';

// The house is built from simple, authored geometry so it loads quickly and runs offline.
const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#8a8b80');
scene.fog = new THREE.FogExp2('#777970', .027);
const camera = new THREE.PerspectiveCamera(73, innerWidth/innerHeight, .08, 70);
const player = new THREE.Group(); player.position.set(0,0,1.1); scene.add(player); player.add(camera); camera.position.y=1.62;
let yaw=0, pitch=0, started=false, paused=true, lanternOn=true, currentRoom='THE HALL';
const clock = new THREE.Clock();
const lantern=new THREE.SpotLight('#ead7ad',0,13,Math.PI/7,.48,1.35);lantern.position.set(0,0,0);camera.add(lantern);const lanternAim=new THREE.Object3D();lanternAim.position.set(0,0,-1);camera.add(lanternAim);lantern.target=lanternAim;
const needs={hunger:18,thirst:12,rest:82,hygiene:71,stress:19,fear:0,isolation:23,suspicion:9,stability:81};
const state={day:1,minutes:7*60+12,events:[],flags:{},doors:{},seen:new Set(),history:[],tv:false,weather:'OVERCAST',eventAt:517,lastEvent:-1000,encounters:0,steps:0,found:0,called:false,leaving:false,seed:Math.random()*1e6>>>0};
const inventory=new Set(['keys','phone']);
const saveKey='house-within-save-v1';
const mat=(color,rough=.8,extra={})=>new THREE.MeshStandardMaterial({color,roughness:rough,...extra});
const M={wall:mat('#aaa391'),wallDark:mat('#77766a'),trim:mat('#554b3c'),wood:mat('#493c2d'),floor:mat('#51483a'),floorLight:mat('#6a5d49'),ceiling:mat('#8d897d'),white:mat('#c5bdab'),black:mat('#1c201d'),metal:mat('#666963',.32,{metalness:.65}),fabric:mat('#777568'),fabricDark:mat('#4a514c'),red:mat('#75493b'),paper:mat('#b9ad91'),glass:mat('#8a9b91',.22,{transparent:true,opacity:.27}),glow:mat('#f2c986',.3,{emissive:'#ffbc69',emissiveIntensity:2}),screen:mat('#30332d',.3,{emissive:'#667264',emissiveIntensity:.24})};
const colliders=[], interactables=[], lights=[], movable=[];
function box(parent,x,y,z,w,h,d,material,opts={}) {const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=opts.cast!==false;mesh.receiveShadow=opts.receive!==false;parent.add(mesh);if(opts.collider)colliders.push({x:x-w/2,z:z-d/2,w,d});return mesh;}
function addInteract(label,action,meshes,room=currentRoom,detail='') {const entry={label,action,meshes:Array.isArray(meshes)?meshes:[meshes],room,detail};interactables.push(entry);entry.meshes.forEach(o=>{o.userData.interactable=entry});return entry;}
function wall(parent,x,y,z,w,h,d,material=M.wall){return box(parent,x,y,z,w,h,d,material)}
function floor(parent,x,z,w,d,material=M.floor){box(parent,x,-.12,z,w,.24,d,material,{cast:false});box(parent,x,.015,z,w,.05,d,M.trim,{cast:false})}
function ceiling(parent,x,z,w,d){box(parent,x,3.05,z,w,.14,d,M.ceiling,{cast:false})}
function segmentWall(parent,axis,fixed,start,end,doorCenter=null,doorWidth=1.15,height=2.78,material=M.wall){
  const add=(a,b,h=height,base=0)=>{if(b<=a)return;let length=b-a;if(axis==='x')box(parent,(a+b)/2,base+h/2,fixed,length,h,.18,material,{collider:true});else box(parent,fixed,base+h/2,(a+b)/2,.18,h,length,material,{collider:true})};
  const centers=(Array.isArray(doorCenter)?doorCenter:doorCenter===null?[]:[doorCenter]).sort((a,b)=>a-b);let cursor=start;
  for(const center of centers){const left=Math.max(cursor,center-doorWidth/2),right=Math.min(end,center+doorWidth/2);add(cursor,left);if(height>2.16&&right>left){const h=height-2.16;if(axis==='x')wall(parent,center,2.16+h/2,fixed,right-left,h,.18,material);else wall(parent,fixed,2.16+h/2,center,.18,h,right-left,material)}cursor=Math.max(cursor,right)}add(cursor,end)
}
function makeRoom(name,b,opts={}){const g=new THREE.Group();scene.add(g);floor(g,(b.x1+b.x2)/2,(b.z1+b.z2)/2,b.x2-b.x1,b.z2-b.z1,opts.floor||M.floor);ceiling(g,(b.x1+b.x2)/2,(b.z1+b.z2)/2,b.x2-b.x1,b.z2-b.z1);
// door openings in walls, described in world coordinates. Internal rooms open into a shared central hall.
const doors=opts.doors||{};segmentWall(g,'x',b.z1,b.x1,b.x2,doors.n??null,1.2);segmentWall(g,'x',b.z2,b.x1,b.x2,doors.s??null,1.2);segmentWall(g,'z',b.x1,b.z1,b.z2,doors.w??null,1.2);segmentWall(g,'z',b.x2,b.z1,b.z2,doors.e??null,1.2);
const lamp=new THREE.PointLight('#ffdda7',opts.light||.48,opts.range||8,2);lamp.position.set((b.x1+b.x2)/2,2.6,(b.z1+b.z2)/2);lamp.castShadow=false;g.add(lamp);lights.push(lamp);
const sign=new THREE.Object3D();sign.position.set((b.x1+b.x2)/2,0,(b.z1+b.z2)/2);g.userData={name,b,lamp};return g;}
// House shell, joining the rooms at their shared walls.
const hall=makeRoom('THE HALL',{x1:-2.2,x2:2.2,z1:-2.1,z2:7.1},{doors:{n:0,w:[.1,3.8,5.7],e:[.1,3.8,5.7]},light:.34,range:10});
const living=makeRoom('LIVING ROOM',{x1:-8.5,x2:-2.2,z1:-2.1,z2:4.7},{doors:{e:[.1,3.8],s:-5.7},light:.7,range:9,floor:M.floorLight});
const kitchen=makeRoom('KITCHEN',{x1:2.2,x2:8.6,z1:-2.1,z2:4.7},{doors:{w:[.1,3.8],e:2.2,s:5.7},light:.75,range:9});
const bedroom=makeRoom('BEDROOM',{x1:-7.7,x2:-2.2,z1:4.7,z2:10.4},{doors:{e:5.7,n:-5.7,s:-5.7},light:.42,range:8,floor:M.floorLight});
const bath=makeRoom('BATHROOM',{x1:2.2,x2:7.7,z1:4.7,z2:10.4},{doors:{w:5.7,n:5.7,s:5.7},light:.55,range:7,floor:mat('#77776e')});
const basement=makeRoom('BASEMENT',{x1:-7.6,x2:-2.2,z1:10.4,z2:16.5},{doors:{n:-5.7},light:.18,range:7,floor:mat('#363632')});
const attic=makeRoom('ATTIC',{x1:2.2,x2:7.8,z1:10.4,z2:16.5},{doors:{n:5.7},light:.25,range:7,floor:mat('#544b3e')});
// Outer-house boundary and door frames, plus trim around the connected openings.
const rooms=[hall,living,kitchen,bedroom,bath,basement,attic];
function trimDoor(axis,fixed,center){if(axis==='x'){box(scene,center-.62,1.08,fixed,.08,2.16,.22,M.trim);box(scene,center+.62,1.08,fixed,.08,2.16,.22,M.trim);box(scene,center,2.18,fixed,1.32,.1,.24,M.trim)}else{box(scene,fixed,1.08,center- .62,.22,2.16,.08,M.trim);box(scene,fixed,1.08,center+.62,.22,2.16,.08,M.trim);box(scene,fixed,2.18,center,.24,.1,1.32,M.trim)}}
trimDoor('x',-2.1,0);for(const center of [-5.7,5.7]){trimDoor('x',4.7,center);trimDoor('x',10.4,center)}for(const center of [-5.7,.1,3.8,5.7]){trimDoor('z',-2.2,center);trimDoor('z',2.2,center)}
// Exterior weather, grounds, porch, and windows.
const outdoors=box(scene,0,-.31,0,160,.12,160,mat('#444a40'),{cast:false});
const skyLight=new THREE.HemisphereLight('#a6b0aa','#3d382f',.75);scene.add(skyLight);const sun=new THREE.DirectionalLight('#e7d4b0',1.45);sun.position.set(-7,12,-8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-12;scene.add(sun);scene.add(sun.target);
// front porch facing south, near entry at z=-2.
box(scene,0,-.04,-3.15,3.2,.18,1.8,M.floorLight);box(scene,-1.5,1.1,-3.85,.13,2.2,.14,M.trim);box(scene,1.5,1.1,-3.85,.13,2.2,.14,M.trim);box(scene,0,2.2,-3.85,3.15,.16,.18,M.trim);
// Windows are translucent dark panes and sills; subtle directional exterior fill.
function windowWall(x,z,axis,width=1.45){const frame=axis==='z'?box(scene,x,1.62,z,width,1.05,.13,M.trim):box(scene,x,1.62,z,.13,1.05,width,M.trim);if(axis==='z'){box(scene,x,1.62,z-.01,width-.14,.9,.03,M.glass);box(scene,x,1.62,z+.04,.035,.9,.04,M.trim);box(scene,x,1.62,z+.04,width-.14,.035,.04,M.trim);box(scene,x,1.06,z,width+.18,.08,.23,M.trim)}else{box(scene,x-.01,1.62,z,.03,.9,width-.14,M.glass);box(scene,x+.04,1.62,z,.04,.9,.035,M.trim);box(scene,x+.04,1.62,z,.04,.035,width-.14,M.trim);box(scene,x,1.06,z,.23,.08,width+.18,M.trim)}}
windowWall(-8.5,1.2,'x');windowWall(-5.4,-2.1,'z');windowWall(5.2,-2.1,'z');windowWall(-7.7,7.8,'x');windowWall(7.7,7.6,'x');
// Furniture helpers: every notable object has a small, meaningful interaction.
function table(g,x,z,w=1.4,d=.8,y=.77,material=M.wood){box(g,x,y,z,w,.12,d,material);for(const dx of [-w*.42,w*.42])for(const dz of [-d*.38,d*.38])box(g,x+dx,y/2,z+dz,.09,y,.09,material)}
function chair(g,x,z,turn=0){const c=new THREE.Group();c.position.set(x,0,z);c.rotation.y=turn;g.add(c);box(c,0,.49,0,.52,.12,.5,M.wood);box(c,0,.91,-.22,.52,.78,.1,M.wood);for(const dx of [-.2,.2])for(const dz of [-.18,.18])box(c,dx,.24,dz,.07,.48,.07,M.wood);return c}
function lamp(g,x,y,z){const base=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,.08,12),M.metal);base.position.set(x,y,z);g.add(base);const stem=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,.42,8),M.metal);stem.position.set(x,y+.24,z);g.add(stem);const shade=new THREE.Mesh(new THREE.CylinderGeometry(.19,.12,.25,12,1,true),M.paper);shade.position.set(x,y+.53,z);g.add(shade)}
// Living room: couch, rug, coffee table, television, family picture.
box(living,-5.45,.14,1.1,4.7,.08,3.2,mat('#393931'));const sofa=box(living,-5.5,.58,1.0,2.65,.78,.92,M.fabric);box(living,-5.5,1.05,.61,2.65,.42,.3,M.fabricDark);for(const x of [-6.65,-4.35])box(living,x,.67,1,.28,.7,1.05,M.fabricDark);
const coffee=table(living,-5.25,.04,1.6,.78,.55);box(living,-5.3,.64,.04,.38,.07,.28,M.paper);const remote=box(living,-4.85,.64,.07,.2,.04,.07,M.black);addInteract('Pick up the remote',()=>{note('The plastic is warm. You put it in your pocket.');remote.visible=false;inventory.add('remote')},remote,'LIVING ROOM');
const tv=box(living,-2.55,1.7,-.7,.18,1.22,1.8,M.black);const tvscreen=box(living,-2.43,1.72,-.7,.025,1.02,1.6,M.screen);box(living,-2.58,.65,-.7,.32,.5,1.4,M.wood);addInteract('Turn on the television',()=>toggleTV(),[tv,tvscreen],'LIVING ROOM');
const photo=box(living,-8.39,1.95,-.65,.08,.73,.55,M.wood);box(living,-8.33,1.95,-.65,.025,.59,.41,mat('#bcb49f'));addInteract('Look at the photograph',()=>readLetter('The photograph','A woman in a garden, one hand lifted to shade her face. The other person has been carefully cut out. There is a pale rectangle where the frame used to hang.'),photo,'LIVING ROOM');
lamp(living,-7.3,1.22,2.4);chair(living,-3.8,.7,1.3);
// Kitchen: cabinets, sink, fridge, stove, kettle and provisions.
for(let x=3.1;x<8;x+=1.18){box(kitchen,x,1.08,-1.86,1.1,1.12,.52,mat('#777264'));box(kitchen,x,1.82,-1.86,1.08,.32,.54,M.white);box(kitchen,x,2.15,-1.85,1.08,.09,.55,M.trim)}
box(kitchen,5.3,.89,-1.49,5.7,.14,.9,mat('#817965'));const sink=box(kitchen,6.1,.99,-1.44,.95,.05,.54,M.metal);const fridge=box(kitchen,7.75,1.2,.05,.9,2.25,.82,mat('#9a9b91',.42));const fridgeDoor=box(kitchen,7.27,1.2,.05,.08,2.2,.79,mat('#b7b7ab',.37));box(kitchen,7.21,1.24,.32,.045,.58,.035,M.metal);const fridgeState={open:false};addInteract('Open the refrigerator',()=>{fridgeState.open=!fridgeState.open;fridgeDoor.position.x=fridgeState.open?7.03:7.27;fridgeDoor.rotation.y=fridgeState.open?.55:0;notify(fridgeState.open?'Cold air spills over your hands.':'The door seals with a soft thud.');if(fridgeState.open)inventory.add('milk')},[fridge,fridgeDoor],'KITCHEN');
const stove=box(kitchen,3.5,.96,-1.42,1.15,.14,.8,M.black);for(let i=0;i<4;i++){const burner=new THREE.Mesh(new THREE.TorusGeometry(.17,.035,6,16),M.metal);burner.rotation.x=Math.PI/2;burner.position.set(3.2+(i%2)*.48,1.06,-1.58+Math.floor(i/2)*.36);kitchen.add(burner)}
const kettle=box(kitchen,4.15,1.26,-1.45,.35,.48,.32,M.metal);addInteract('Make a cup of tea',()=>{if(inventory.has('tea')){inventory.delete('tea');needs.thirst=Math.max(0,needs.thirst-23);note('The tea is over-steeped. You drink it anyway.')}else note('You cannot remember where you put the tea.');},kettle,'KITCHEN');
const apple=new THREE.Mesh(new THREE.SphereGeometry(.14,16,12),mat('#a45b3e'));apple.position.set(5.1,1.16,-1.35);kitchen.add(apple);addInteract('Eat the apple',()=>{needs.hunger=Math.max(0,needs.hunger-27);needs.stress=Math.max(0,needs.stress-2);apple.visible=false;inventory.delete('apple');note('The apple is bruised, but sweet.')},apple,'KITCHEN');inventory.add('apple');inventory.add('tea');
addInteract('Wash your hands',()=>{needs.hygiene=Math.min(100,needs.hygiene+22);needs.stress=Math.max(0,needs.stress-4);notify('The water takes a moment to run clear.')},sink,'KITCHEN');
// Bedroom and sleep.
box(bedroom,-5.1,.4,7.2,3.6,.4,2.9,M.wood);box(bedroom,-5.1,.76,7.2,3.5,.46,2.8,M.fabricDark);box(bedroom,-5.1,1.04,8.0,3.45,.32,1.15,M.white);box(bedroom,-6.22,1.25,8.08,.9,.26,.7,M.paper);box(bedroom,-3.5,.62,5.2,.72,1.22,.68,M.wood);lamp(bedroom,-3.5,1.28,5.2);
const diary=box(bedroom,-6.2,1.2,8.03,.42,.08,.31,M.red);addInteract('Read the notebook',()=>readLetter('A page from the notebook','Monday. I woke up before the alarm again.\n\nI keep setting two places at the table. I keep clearing one.\n\nIf I write it down, it happened. That is what the doctor said. I think that is what he said.'),diary,'BEDROOM');
const bedTarget=box(bedroom,-5.1,.95,7.2,2.3,.35,1.6,mat('#bcb49f',1,{transparent:true,opacity:0}));bedTarget.material.colorWrite=false;addInteract('Lie down and sleep',()=>sleep(),bedTarget,'BEDROOM');
const wardrobe=box(bedroom,-7.27,1.25,5.52,.62,2.45,1.12,M.wood);addInteract('Check the wardrobe',()=>{if(needs.fear>40){whisper('There is nothing in there.');}else notify('Coats. An old umbrella. The familiar smell of cedar.')},wardrobe,'BEDROOM');
// Bathroom fixtures and mirror.
const tub=box(bath,6.2,.38,8.72,1.05,.55,2.45,M.white);box(bath,6.2,.67,8.72,.92,.11,2.2,M.paper);const toilet=box(bath,3.12,.43,9.3,.62,.75,.72,M.white);box(bath,3.12,.89,9.04,.62,.37,.22,M.white);const mirror=box(bath,2.31,1.79,7.1,.04,.95,1.25,mat('#78908e',.1,{metalness:.4}));box(bath,2.26,1.79,7.1,.07,1.08,1.38,M.trim);addInteract('Look in the mirror',()=>{needs.stress=Math.min(100,needs.stress+2);note('You look tired. The face in the glass looks like yours, a second after you move.')},mirror,'BATHROOM');addInteract('Take a shower',()=>{needs.hygiene=Math.min(100,needs.hygiene+42);needs.stress=Math.max(0,needs.stress-8);needs.thirst=Math.min(100,needs.thirst+2);notify('The pipes knock once. Then the water warms.')},tub,'BATHROOM');addInteract('Use the bathroom',()=>{needs.stress=Math.max(0,needs.stress-3);notify('The small fan keeps turning after you leave.')},toilet,'BATHROOM');
// Basement / attic spaces, each with a narrative object and unease.
for(let x=-7.1;x<-2.6;x+=1.05){box(basement,x,.35,12.4,.75,.7,.74,M.wood);box(basement,x,.75,12.4,.75,.08,.74,M.trim)}
const fuse=box(basement,-3.25,1.6,15.95,.55,.72,.15,M.metal);addInteract('Inspect the fuse box',()=>{notify('All the switches are on. One is warm.');state.flags.fuse=true},fuse,'BASEMENT');
const boxAttic=box(attic,6.0,.58,15.1,1.2,1.05,.95,M.wood);const tape=box(attic,5.95,1.17,15.08,.32,.12,.23,M.black);addInteract('Play the old recording',()=>readLetter('On the tape','[static]\n\nA chair scrapes across a floor. A voice, very far away: “You said you would come back.”\n\nThen your own voice, closer: “I am home.”\n\n[the rest is blank]'),tape,'ATTIC');
const atticWindow=box(attic,4.9,1.9,16.36,1.2,.85,.08,M.glass);
// Doors are usable and can be locked. A door's position is a persistent household state.
function createDoor(name,x,z,axis,hingeX,hingeZ,room){const group=new THREE.Group();group.position.set(hingeX,0,hingeZ);scene.add(group);let leaf=box(group,axis==='x'?.58:.1,1.08,axis==='x'?.1:.58,axis==='x'?1.16:.12,2.16,axis==='x'?.12:1.16,M.wood);box(group,axis==='x'?1.02:.19,1.08,axis==='x'?.16:.99,.07,.08,.07,M.metal);const hitTarget=box(scene,hingeX+(axis==='x'?.58:0),1.08,hingeZ+(axis==='z'?.58:0),axis==='x'?1.05:.18,1.9,axis==='x'?.18:1.05,new THREE.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,depthWrite:false}),{cast:false,receive:false});const entry=addInteract((name==='front'?'Open the front door':'Open the back door'),()=>{const open=group.rotation.y!==0;if(name==='front'&&open){leaveHouse();return}group.rotation.y=open?0:(axis==='x'?-Math.PI/2:Math.PI/2);state.doors[name]=!open;save();notify(open?'The door closes.':'The door opens with a dry little catch.');entry.label=(open?'Open the ':'Close the ')+name+' door'},hitTarget,room);return group;}
const frontDoor=createDoor('front',0,-2.08,'x',-.57,-2.08,'THE HALL');const backDoor=createDoor('back',8.5,2.2,'z',8.5,1.62,'KITCHEN');
// House-specific wall-mounted things, small clutter, and safe navigation bounds.
for(const [x,z] of [[-1.8,-1.1],[1.8,-.4],[-1.8,2.3],[1.8,4.8],[-1.8,6.1]])box(hall,x,1.35,z,.12,.12,.12,M.trim);
const phone=box(hall,1.9,1.35,1.6,.14,.24,.19,M.black);addInteract('Call someone',()=>{if(state.called){note('No new messages. The last call is still listed as “E. — 8 minutes”.')}else callSomeone()},phone,'THE HALL');
const coat=box(hall,-1.82,1.45,5.6,.13,.8,.55,M.fabricDark);addInteract('Take the house keys',()=>{inventory.add('keys');notify('The brass keys are in your palm. They feel familiar.')},coat,'THE HALL');inventory.add('keys');inventory.add('phone');
// Dining table and a chair give the kitchen a lived-in center.
table(kitchen,4.2,.8,2.25,1.2,.78);const mug=box(kitchen,4.05,.95,.74,.19,.28,.18,M.white);addInteract('Drink from the mug',()=>{needs.thirst=Math.max(0,needs.thirst-18);notify('The water has gone flat.')},mug,'KITCHEN');chair(kitchen,3.25,1.8,0);chair(kitchen,5.15,1.8,Math.PI);
// Add a neighboring house silhouette outdoors for occasional uncertain sightlines.
box(scene,-12,1.5,-8,10,4,9,mat('#42463e'),{cast:false});for(const x of [-14,-10]){box(scene,x,2,-3.48,1.2,.9,.06,mat('#444d46'));}

// Persistent routine, hidden mental state, and a small narrative graph.
let rngSeed=state.seed;function rand(){rngSeed=(rngSeed*1664525+1013904223)>>>0;return rngSeed/4294967296}function pick(a){return a[Math.floor(rand()*a.length)]}
function save(){try{const data={state:{...state,seen:[...state.seen]},needs,inventory:[...inventory],rngSeed,player:{x:player.position.x,y:player.position.y,z:player.position.z,yaw,pitch},world:{fridgeOpen:fridgeState.open,lanternOn}};localStorage.setItem(saveKey,JSON.stringify(data));document.querySelector('#continue-button').disabled=false;return true}catch(e){return false}}
function load(){try{const raw=localStorage.getItem(saveKey);if(!raw)return false;const d=JSON.parse(raw);Object.assign(state,d.state);state.seen=new Set(d.state.seen||[]);Object.assign(needs,d.needs);inventory.clear();(d.inventory||[]).forEach(i=>inventory.add(i));rngSeed=d.rngSeed||state.seed;if(d.player){player.position.set(d.player.x||0,d.player.y||0,d.player.z??1.1);yaw=d.player.yaw||0;pitch=d.player.pitch||0;player.rotation.y=yaw;camera.rotation.x=pitch}if(d.world){fridgeState.open=!!d.world.fridgeOpen;fridgeDoor.position.x=fridgeState.open?7.03:7.27;fridgeDoor.rotation.y=fridgeState.open?.55:0;setLantern(d.world.lanternOn!==false)}document.querySelector('#continue-button').disabled=false;return true}catch(e){return false}}
function note(text){document.querySelector('#journal-text').textContent=text;state.history.push({day:state.day,time:state.minutes,text});if(state.history.length>40)state.history.shift();save()}
let notificationTimer,subtitleTimer;
function notify(text){const el=document.querySelector('#notification');el.textContent=text;el.classList.add('show');clearTimeout(notificationTimer);notificationTimer=setTimeout(()=>el.classList.remove('show'),3300)}
function whisper(text){const el=document.querySelector('#subtitle');el.textContent=text;el.classList.add('show');clearTimeout(subtitleTimer);subtitleTimer=setTimeout(()=>el.classList.remove('show'),4700);audioTone(95,.7,.085)}
function readLetter(title,text){document.querySelector('#letter-title').textContent=title;document.querySelector('#letter-copy').textContent=text;document.querySelector('#letter-day').textContent=String(state.day).padStart(2,'0');document.querySelector('#letter-screen').hidden=false;paused=true;if(document.pointerLockElement)document.exitPointerLock();state.flags.readItems??=[];if(!state.flags.readItems.includes(title)){state.flags.readItems.push(title);state.found=state.flags.readItems.length}state.flags.read=true;needs.suspicion=Math.max(0,needs.suspicion-1);save()}
function closeLetter(){document.querySelector('#letter-screen').hidden=true;paused=false;requestLock()}
function setTime(mins){state.minutes=(state.minutes+mins)%(24*60);if(state.minutes<mins)state.day++;}
function displayTime(){let h=Math.floor(state.minutes/60),m=Math.floor(state.minutes%60),ap=h>=12?'PM':'AM';h=h%12||12;document.querySelector('#clock').innerHTML=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} <small>${ap}</small>`;document.querySelector('#day-label').textContent=`${['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][(state.day)%7]} · DAY ${String(state.day).padStart(2,'0')}`;}
function roomAt(x,z){if(z>10.25&&x<-2.1)return 'BASEMENT';if(z>10.25&&x>2.1)return 'ATTIC';if(z>4.65&&x<-2.1)return 'BEDROOM';if(z>4.65&&x>2.1)return 'BATHROOM';if(x<-2.1)return 'LIVING ROOM';if(x>2.1)return 'KITCHEN';return 'THE HALL'}
function updateRoom(){let r=roomAt(player.position.x,player.position.z);if(r!==currentRoom){currentRoom=r;document.querySelector('#room-name').textContent=r;state.flags.visited=state.flags.visited||{};state.flags.visited[r]=true;if(r==='BASEMENT'&&state.encounters>1&&!state.seen.has('basement-voice')){state.seen.add('basement-voice');whisper('You came down here already.');}}}
function updateNeeds(dt){if(!started||paused)return;const sim=dt*1.25;needs.hunger=Math.min(100,needs.hunger+sim*.22);needs.thirst=Math.min(100,needs.thirst+sim*.29);needs.rest=Math.max(0,needs.rest-sim*.095);needs.hygiene=Math.max(0,needs.hygiene-sim*.055);needs.isolation=Math.min(100,needs.isolation+sim*.045);needs.stress=Math.max(0,needs.stress-sim*.012);
 for(const [key,val] of [['hunger',needs.hunger],['thirst',needs.thirst],['rest',needs.rest]]){document.querySelector(`#${key}-value`).textContent=Math.round(val);const bar=document.querySelector(`#${key}-bar`);bar.style.width=`${Math.max(3,100-val)}%`;bar.style.background=val>72?'#b16d5a':'#d3c5a5'}
 document.querySelector('#inventory-line').textContent='POCKETS: '+[...inventory].map(x=>x.toUpperCase()).join(' · ');if(needs.rest<20){needs.stress=Math.min(100,needs.stress+dt*.16);}
}
function updateLightAndSky(){const t=state.minutes/1440,night=Math.max(0,Math.min(1,(Math.cos((t-.5)*Math.PI*2)+.18)/1.18));skyLight.intensity=.18+night*.7;sun.intensity=.12+(1-night)*1.3;scene.background.set(night>.6?'#151a1c':'#8a8b80');scene.fog.color.set(night>.6?'#1a1e20':'#777970');scene.fog.density=.025+night*.006;lights.forEach(l=>{l.intensity=.46*(1-night*.56)});const wash=document.querySelector('.color-wash');wash.style.background=night>.7?'linear-gradient(180deg,rgba(6,9,13,.4),rgba(8,10,13,.16) 50%,rgba(4,5,8,.63))':'linear-gradient(180deg,rgba(8,10,9,.42),transparent 25%,transparent 65%,rgba(5,6,6,.5))';document.querySelector('#weather').textContent=state.weather;document.querySelector('#weather-icon').textContent=state.weather==='RAIN'?'☂':state.weather==='CLEAR'?'☼':'☁';}
function requestLock(){try{const result=canvas.requestPointerLock?.();result?.catch?.(()=>{})}catch{}}
function startDay(){document.querySelector('#start-screen').hidden=true;started=true;paused=false;requestLock()}
function loadGame(){if(load()){document.querySelector('#start-screen').hidden=true;started=true;paused=false;restoreWorld();notify('The day comes back in pieces.');requestLock()}}
function restoreWorld(){Object.entries(state.doors).forEach(([name,open])=>{if(name==='front'&&open)frontDoor.rotation.y=-Math.PI/2;if(name==='back'&&open)backDoor.rotation.y=Math.PI/2});if(state.flags.ateApple)apple.visible=false;if(state.flags.tv)toggleTV(true)}
function pause(){if(!started)return;paused=true;document.querySelector('#pause-screen').hidden=false;if(document.pointerLockElement)document.exitPointerLock();save()}
function resume(){document.querySelector('#pause-screen').hidden=true;paused=false;requestLock()}
function sleep(){if(needs.rest>88)notify('You are not tired enough to sleep yet.');else{const hours=7+rand()*2;state.minutes=(state.minutes+Math.round(hours*60))%(24*60);state.day++;needs.rest=96;needs.stress=Math.max(0,needs.stress-12);needs.fear=Math.max(0,needs.fear-14);needs.isolation=Math.min(100,needs.isolation+9);needs.hunger=Math.min(100,needs.hunger+8);needs.thirst=Math.min(100,needs.thirst+11);scheduleNext();notify('You wake to a dim, quiet room.');save()}}
function scheduleNext(){state.eventAt=state.minutes+50+Math.floor(rand()*180)}
function toggleTV(force){state.tv=force===true?true:!state.tv;tvscreen.material=state.tv?mat('#555b53',.25,{emissive:'#8b9878',emissiveIntensity:.42}):M.screen;if(state.tv){notify('The television finds a channel. Low voices.');setTimeout(()=>{if(state.tv&&needs.stress>35)whisper('...you can hear me, can’t you?')},11000);state.flags.tv=true}else notify('The screen goes dark.');save()}
function callSomeone(){if(state.minutes<6*60||state.minutes>22*60){notify('No one answers. You leave a message after the tone.');needs.isolation=Math.max(0,needs.isolation-4);state.flags.called=true;return}state.called=true;state.flags.called=true;needs.isolation=Math.max(0,needs.isolation-17);needs.stress=Math.max(0,needs.stress-6);const lines=['Mara says she can bring the spare key tomorrow. She asks if you are sleeping.','A friend answers, distracted, but stays on the line for a minute.','The call drops just after someone says your name.','A neighbor says the street is quiet tonight. You hear a door close on their end.'];note(pick(lines));notify('The line clicks softly when you hang up.');save()}
function leaveHouse(){if(!inventory.has('keys')){notify('You cannot find your keys.');return}if(needs.fear>78&&state.encounters>4){notify('The front door is open. The porch does not seem to be where it was.');realityBend();return}if(state.found>=3&&state.flags.called){ending('A little further','The road is wet. The house shrinks behind you, a familiar shape among the trees. You do not know what happened here. You know only that, for the first time in a long while, you kept walking.');return}if(state.found>=2){ending(state.flags.called?'A voice on the line':'The road, for now',state.flags.called?'Someone stays on the line while you walk toward the end of the street. The house is still there when you look back. So is the morning.':'You leave without making the call. The street is quiet, the air cold, and the house remains behind you. You can come back if you need to.');return}state.minutes+=32;needs.isolation=Math.max(0,needs.isolation-10);notify('Cool air. The street is empty, but not unwelcoming.');state.flags.outside=true;save()}

// The event graph is deliberately suggestive rather than diagnostic: each moment has an ordinary explanation.
function realityBend(){const fade=document.querySelector('#fade');fade.classList.add('active');setTimeout(()=>{player.position.set(0,0,1.1);yaw=0;pitch=0;player.rotation.y=0;camera.rotation.x=0;needs.fear=Math.max(0,needs.fear-24);state.minutes=Math.min(state.minutes+18,23*60);state.encounters++;fade.classList.remove('active');notify('You are back in the hall. The front door is still open.');save()},1200)}
function ending(title,text){paused=true;document.exitPointerLock?.();document.querySelector('#ending-title').textContent=title;document.querySelector('#ending-copy').textContent=text;document.querySelector('#ending-screen').hidden=false;state.flags.ending=title;save()}
function triggerEvent(){state.lastEvent=state.minutes;state.eventAt=state.minutes+65+Math.floor(rand()*175);state.encounters++;const hour=Math.floor(state.minutes/60);needs.fear=Math.min(100,needs.fear+2+rand()*5+(needs.stress>50?3:0));needs.stress=Math.min(100,needs.stress+1.5+rand()*2);if(needs.fear>58)needs.suspicion=Math.min(100,needs.suspicion+1);const events=[
 {id:'pipes',test:()=>!state.seen.has('pipes'),run:()=>{state.seen.add('pipes');whisper('A knock travels through the pipes. Then the house settles.')}},
 {id:'phone',test:()=>!state.seen.has('phone-ring')&&inventory.has('phone'),run:()=>{state.seen.add('phone-ring');notify('Your phone vibrates once. No number is shown.');needs.stress=Math.min(100,needs.stress+3)}},
 {id:'hall-light',test:()=>!state.seen.has('hall-light'),run:()=>{state.seen.add('hall-light');lights[0].intensity=.04;setTimeout(()=>{lights[0].intensity=.46},1700);whisper('The hallway seems longer in the dark.')}},
 {id:'memory',test:()=>!state.seen.has('memory')&&state.found>0,run:()=>{state.seen.add('memory');note('You remember a second cup at the table. You cannot remember when you put it away.')}},
 {id:'weather',test:()=>!state.seen.has('weather')&&hour>15,run:()=>{state.seen.add('weather');state.weather=pick(['RAIN','OVERCAST','CLEAR']);updateLightAndSky();notify('The weather changes while you are inside.')}},
 {id:'attic',test:()=>state.flags.visited?.ATTIC&&!state.seen.has('attic-step'),run:()=>{state.seen.add('attic-step');whisper('A soft step overhead. You are standing beneath the roof.')}},
 {id:'settle',test:()=>true,run:()=>{const line=pick(['The refrigerator hum stops. A moment later, it starts again.','A small sound from another room. Probably the old house.','The air smells briefly of rain and wet leaves.','For a moment, you expect someone to answer.']);notify(line);needs.stress=Math.min(100,needs.stress+1)}}
];const available=events.filter(e=>e.test());if(available.length)pick(available).run();if(needs.stress>70&&rand()<.42)whisper(pick(['You have time. Breathe slowly.','The room is quiet now.','You can check the door if you want.']))}
function audioTone(freq=180,duration=.12,volume=.04){try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;audioContext??=new Ctx();const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(volume,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+duration)}catch{}}
let audioContext=null;
const raycaster=new THREE.Raycaster();raycaster.far=2.65;const moveKeys=new Set();let focused=null,stepSound=0;
function findTarget(){raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const candidates=interactables.filter(i=>i.room===currentRoom).flatMap(i=>i.meshes.filter(m=>m.visible).map(mesh=>({mesh,entry:i})));const hit=raycaster.intersectObjects(candidates.map(x=>x.mesh),false)[0];if(!hit){focused=null;document.querySelector('#interact').hidden=true;return}focused=hit.object.userData.interactable;document.querySelector('#interact-label').textContent=focused.label;document.querySelector('#interact').hidden=false}
function interact(){if(focused&&started&&!paused){focused.action();findTarget();audioTone(360,.07,.025)}}
function overlaps(x,z,r=.22){return colliders.some(c=>x+r>c.x&&x-r<c.x+c.w&&z+r>c.z&&z-r<c.z+c.d)}
function movePlayer(dt){let x=(moveKeys.has('KeyD')?1:0)-(moveKeys.has('KeyA')?1:0),z=(moveKeys.has('KeyS')?1:0)-(moveKeys.has('KeyW')?1:0);if(!x&&!z)return;const len=Math.hypot(x,z);x/=len;z/=len;const speed=(moveKeys.has('ShiftLeft')?3.7:2.55)*dt;const sin=Math.sin(yaw),cos=Math.cos(yaw),dx=(x*cos+z*sin)*speed,dz=(z*cos-x*sin)*speed;const px=player.position.x,pz=player.position.z;let nx=px+dx,nz=pz+dz;if(nx>-8.2&&nx<8.3&&!overlaps(nx,pz))player.position.x=nx;if(nz>-12&&nz<18&&!overlaps(player.position.x,nz))player.position.z=nz;const walking=Math.abs(player.position.x-px)+Math.abs(player.position.z-pz)>.001;if(walking){stepSound+=dt;if(stepSound>.48){stepSound=0;if(rand()<.18)audioTone(72,.035,.012)}}}
function updateTime(dt){if(!started||paused)return;const oldDay=state.day;setTime(dt*2.7);if(state.day!==oldDay){needs.rest=Math.min(100,needs.rest+2);state.weather=pick(['OVERCAST','OVERCAST','RAIN','CLEAR']);save()}if(state.minutes>=state.eventAt&&state.minutes-state.lastEvent>30)triggerEvent();displayTime();updateLightAndSky()}
function persistWorld(){state.flags.ateApple=!apple.visible;save()}

// Input, interface bindings, and the render/update loop.
function setLantern(on){lanternOn=on;lantern.intensity=on?3.2:0;document.querySelector('#flash-indicator').textContent=on?'◉ LANTERN ON':'◯ LANTERN OFF'}
function bindButton(id,action){document.querySelector(`#${id}`).addEventListener('click',action)}
function startNew(){localStorage.removeItem(saveKey);state.day=1;state.minutes=7*60+12;state.seen.clear();state.history=[];state.flags={};state.doors={};state.encounters=0;state.found=0;state.called=false;state.eventAt=517;state.lastEvent=-1000;state.weather='OVERCAST';state.seed=Math.random()*1e6>>>0;rngSeed=state.seed;Object.assign(needs,{hunger:18,thirst:12,rest:82,hygiene:71,stress:19,fear:0,isolation:23,suspicion:9,stability:81});inventory.clear();['keys','phone','apple','tea'].forEach(i=>inventory.add(i));frontDoor.rotation.y=0;backDoor.rotation.y=0;state.tv=false;tvscreen.material=M.screen;apple.visible=true;fridgeState.open=false;fridgeDoor.position.x=7.27;fridgeDoor.rotation.y=0;player.position.set(0,0,1.1);yaw=0;pitch=0;setLantern(true);displayTime();updateLightAndSky();document.querySelector('#journal-text').textContent='The kettle needs descaling. Pick up milk if you go out.';startDay()}
bindButton('start-button',startDay);
bindButton('continue-button',loadGame);
bindButton('new-button',startNew);
bindButton('resume-button',resume);
bindButton('save-button',()=>{persistWorld();notify('Your day is saved.');resume()});
bindButton('leave-button',()=>{persistWorld();document.querySelector('#pause-screen').hidden=true;document.querySelector('#start-screen').hidden=false;started=false;paused=true});
bindButton('close-letter',closeLetter);
bindButton('ending-return',()=>{document.querySelector('#ending-screen').hidden=true;document.querySelector('#start-screen').hidden=false;started=false;paused=true;save()});
if(localStorage.getItem(saveKey))document.querySelector('#continue-button').disabled=false;
canvas.addEventListener('click',()=>{if(started&&!paused)requestLock()});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas||paused)return;yaw-=e.movementX*.0022;pitch=Math.max(-1.35,Math.min(1.35,pitch-e.movementY*.0019));player.rotation.y=yaw;camera.rotation.x=pitch});
document.addEventListener('keydown',e=>{
 if(e.code==='Escape'){if(!document.querySelector('#letter-screen').hidden){closeLetter();return}if(!document.querySelector('#pause-screen').hidden){resume();return}if(started&&!paused)pause();return}
 if(!started||paused)return;
 if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code)){moveKeys.add(e.code);e.preventDefault()}
 if(e.code==='KeyE'&&!e.repeat)interact();if(e.code==='KeyF'&&!e.repeat)setLantern(!lanternOn);
});
document.addEventListener('keyup',e=>moveKeys.delete(e.code));
document.addEventListener('pointerlockchange',()=>{if(started&&!paused&&document.pointerLockElement!==canvas)pause()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!paused)pause()});
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(started&&!paused){movePlayer(dt);updateNeeds(dt);updateTime(dt);updateRoom();findTarget();if(Math.floor(state.minutes/12)!==state._saveMinute){state._saveMinute=Math.floor(state.minutes/12);persistWorld()}}renderer.render(scene,camera)}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}
window.addEventListener('resize',resize);
setLantern(true);displayTime();updateLightAndSky();animate();

