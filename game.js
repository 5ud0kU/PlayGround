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
const state={day:1,minutes:7*60+12,totalMinutes:7*60+12,events:[],flags:{},doors:{},seen:new Set(),history:[],tv:false,weather:'OVERCAST',eventAt:517,lastEvent:-1000,encounters:0,steps:0,found:0,called:false,leaving:false,seed:Math.random()*1e6>>>0};
const inventory=new Set(['keys','phone']);
const saveKey='house-within-save-v1';
const mat=(color,rough=.8,extra={})=>new THREE.MeshStandardMaterial({color,roughness:rough,...extra});
const M={wall:mat('#aaa391'),wallDark:mat('#77766a'),trim:mat('#554b3c'),wood:mat('#493c2d'),floor:mat('#51483a'),floorLight:mat('#6a5d49'),ceiling:mat('#8d897d'),white:mat('#c5bdab'),black:mat('#1c201d'),metal:mat('#666963',.32,{metalness:.65}),fabric:mat('#777568'),fabricDark:mat('#4a514c'),red:mat('#75493b'),paper:mat('#b9ad91'),glass:mat('#8a9b91',.22,{transparent:true,opacity:.27}),glow:mat('#f2c986',.3,{emissive:'#ffbc69',emissiveIntensity:2}),screen:mat('#30332d',.3,{emissive:'#667264',emissiveIntensity:.24})};
const colliders=[], interactables=[], lights=[], movable=[];
const physicsProps=[], effects=[], animatedDoors=[];
const particleGeo=new THREE.SphereGeometry(.018,5,4);
const particleMaterials={dust:mat('#c9b991',.9,{transparent:true,opacity:.48}),water:mat('#a9d8db',.22,{transparent:true,opacity:.72}),steam:mat('#d6d5ca',.9,{transparent:true,opacity:.16})};
// A brief, peripheral figure: unmistakably person-shaped, but gone when directly noticed.
const apparitionMaterial=new THREE.MeshBasicMaterial({color:'#101310',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
const apparition=new THREE.Group();
function apparitionPart(geometry,x,y,z,sx=1,sy=1,sz=1){const mesh=new THREE.Mesh(geometry,apparitionMaterial);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);apparition.add(mesh)}
apparitionPart(new THREE.ConeGeometry(.38,1.38,8),0,.76,0,1,1,.72);
apparitionPart(new THREE.SphereGeometry(.19,8,7),0,1.58,0,.9,1.1,.9);
apparitionPart(new THREE.CylinderGeometry(.065,.09,.72,6),-.31,1.02,0,1,1,1);
apparitionPart(new THREE.CylinderGeometry(.065,.09,.72,6),.31,1.02,0,1,1,1);
apparition.visible=false;scene.add(apparition);
let apparitionLife=0,apparitionLook=0;
const apparitionDuration=3.1,apparitionDirection=new THREE.Vector3(),apparitionCameraPosition=new THREE.Vector3();
function showPeripheralApparition(){
 if(currentRoom==='OUTSIDE')return;
 const fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw),sides=[rand()<.5?-1:1,rand()<.5?1:-1];
 let point=null;
 for(const side of sides){for(const [depth,offset] of [[3.1,1.55],[2.5,1.35],[3.3,1.1]]){const x=player.position.x+fx*depth+rx*side*offset,z=player.position.z+fz*depth+rz*side*offset;if(roomAt(x,z)===currentRoom&&!overlaps(x,z,.28)){point={x,z};break}}if(point)break}
 if(!point)return;
 apparition.position.set(point.x,0,point.z);apparition.lookAt(player.position.x,1.05,player.position.z);apparition.visible=true;apparitionLife=apparitionDuration;apparitionLook=0;apparitionMaterial.opacity=0;
}
function updateApparition(dt){
 if(!apparition.visible)return;
 apparitionLife-=dt;camera.getWorldDirection(apparitionDirection);camera.getWorldPosition(apparitionCameraPosition);
 const toward=apparition.position.clone().sub(apparitionCameraPosition);toward.y=0;apparitionDirection.y=0;
 if(toward.lengthSq()>0&&apparitionDirection.lengthSq()>0&&apparitionDirection.normalize().dot(toward.normalize())>.95)apparitionLook+=dt;else apparitionLook=0;
 if(apparitionLook>.08||apparitionLife<=0){apparition.visible=false;apparitionMaterial.opacity=0;return}
 const elapsed=apparitionDuration-apparitionLife,fade=Math.min(1,elapsed/.18,apparitionLife/.42);apparitionMaterial.opacity=.68*Math.max(0,fade);
}
function emitParticles(x,y,z,type='dust',count=12,power=.7){
  for(let i=0;i<count;i++){const mesh=new THREE.Mesh(particleGeo,particleMaterials[type].clone());mesh.position.set(x,y,z);mesh.scale.setScalar(type==='steam'?1.7:1);scene.add(mesh);const a=Math.random()*Math.PI*2,s=.12+Math.random()*power;effects.push({mesh,vx:Math.cos(a)*s,vy:.2+Math.random()*power,vz:Math.sin(a)*s,life:.65+Math.random()*.75,type})}
}
function addPhysicsProp(mesh,radius=.13){physicsProps.push({mesh,radius,floorY:mesh.position.y,vx:0,vy:0,vz:0,spin:0,sleeping:true});return mesh}
function kickProp(mesh,power=.8){const p=physicsProps.find(item=>item.mesh===mesh);if(!p)return;p.sleeping=false;p.vx+=(Math.random()-.5)*power;p.vy+=.45+Math.random()*power*.7;p.vz+=(Math.random()-.5)*power;p.spin+=(Math.random()-.5)*4;emitParticles(mesh.position.x,mesh.position.y,mesh.position.z,'dust',5,.3)}
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
const photo=box(living,-8.39,1.95,-.65,.08,.73,.55,M.wood);const photoPrint=box(living,-8.33,1.95,-.65,.025,.59,.41,mat('#bcb49f'));addInteract('Look at the photograph',()=>readLetter('The photograph','A woman in a garden, one hand lifted to shade her face. The other person has been carefully cut out. There is a pale rectangle where the frame used to hang.'),[photo,photoPrint],'LIVING ROOM');
lamp(living,-7.3,1.22,2.4);chair(living,-3.8,.7,1.3);
// Kitchen: cabinets, sink, fridge, stove, kettle and provisions.
for(let x=3.1;x<8;x+=1.18){box(kitchen,x,1.08,-1.86,1.1,1.12,.52,mat('#777264'));box(kitchen,x,1.82,-1.86,1.08,.32,.54,M.white);box(kitchen,x,2.15,-1.85,1.08,.09,.55,M.trim)}
box(kitchen,5.3,.89,-1.49,5.7,.14,.9,mat('#817965'));const sink=box(kitchen,6.1,.99,-1.44,.95,.05,.54,M.metal);const fridge=box(kitchen,7.75,1.2,.05,.9,2.25,.82,mat('#9a9b91',.42));const fridgeDoor=box(kitchen,7.27,1.2,.05,.08,2.2,.79,mat('#b7b7ab',.37));box(kitchen,7.21,1.24,.32,.045,.58,.035,M.metal);const fridgeState={open:false};addInteract('Open the refrigerator',()=>{fridgeState.open=!fridgeState.open;notify(fridgeState.open?'The seal breaks with a soft pop; cold air spills out.':'The door swings shut and seals.');emitParticles(7.25,1.15,.05,'dust',7,.18);if(fridgeState.open)inventory.add('milk')},[fridge,fridgeDoor],'KITCHEN');
const stove=box(kitchen,3.5,.96,-1.42,1.15,.14,.8,M.black);for(let i=0;i<4;i++){const burner=new THREE.Mesh(new THREE.TorusGeometry(.17,.035,6,16),M.metal);burner.rotation.x=Math.PI/2;burner.position.set(3.2+(i%2)*.48,1.06,-1.58+Math.floor(i/2)*.36);kitchen.add(burner)}
const kettle=box(kitchen,4.15,1.26,-1.45,.35,.48,.32,M.metal);addInteract('Make a cup of tea',()=>{if(inventory.has('tea')){inventory.delete('tea');needs.thirst=Math.max(0,needs.thirst-23);note('The tea is over-steeped. You drink it anyway.')}else note('You cannot remember where you put the tea.');},kettle,'KITCHEN');
const apple=new THREE.Mesh(new THREE.SphereGeometry(.14,16,12),mat('#a45b3e'));apple.position.set(5.1,1.16,-1.35);kitchen.add(apple);addInteract('Eat the apple',()=>{needs.hunger=Math.max(0,needs.hunger-27);needs.stress=Math.max(0,needs.stress-2);apple.visible=false;inventory.delete('apple');state.flags.ateApple=true;note('The apple is bruised, but sweet.')},apple,'KITCHEN');inventory.add('apple');inventory.add('tea');
addInteract('Wash your hands',()=>{needs.hygiene=Math.min(100,needs.hygiene+22);needs.stress=Math.max(0,needs.stress-4);emitParticles(6.1,1.05,-1.44,'water',18,.32);notify('The tap sputters, then runs clear into the sink.')},sink,'KITCHEN');
// Bedroom and sleep.
box(bedroom,-5.1,.4,7.2,3.6,.4,2.9,M.wood);box(bedroom,-5.1,.76,7.2,3.5,.46,2.8,M.fabricDark);box(bedroom,-5.1,1.04,8.0,3.45,.32,1.15,M.white);box(bedroom,-6.22,1.25,8.08,.9,.26,.7,M.paper);box(bedroom,-3.5,.62,5.2,.72,1.22,.68,M.wood);lamp(bedroom,-3.5,1.28,5.2);
const diary=box(bedroom,-6.2,1.2,8.03,.42,.08,.31,M.red);addInteract('Read the notebook',()=>readLetter('A page from the notebook','Monday. I woke up before the alarm again.\n\nI keep setting two places at the table. I keep clearing one.\n\nIf I write it down, it happened. That is what the doctor said. I think that is what he said.'),diary,'BEDROOM');
const bedTarget=box(bedroom,-5.1,.95,7.2,2.3,.35,1.6,mat('#bcb49f',1,{transparent:true,opacity:0}));bedTarget.material.colorWrite=false;addInteract('Lie down and sleep',()=>sleep(),bedTarget,'BEDROOM');
const wardrobe=box(bedroom,-7.27,1.25,5.52,.62,2.45,1.12,M.wood);addInteract('Check the wardrobe',()=>{if(needs.fear>40){whisper('There is nothing in there.');}else notify('Coats. An old umbrella. The familiar smell of cedar.')},wardrobe,'BEDROOM');
// Bathroom fixtures and mirror.
const tub=box(bath,6.2,.38,8.72,1.05,.55,2.45,M.white);box(bath,6.2,.67,8.72,.92,.11,2.2,M.paper);const toilet=box(bath,3.12,.43,9.3,.62,.75,.72,M.white);box(bath,3.12,.89,9.04,.62,.37,.22,M.white);const mirror=box(bath,2.31,1.79,7.1,.04,.95,1.25,mat('#78908e',.1,{metalness:.4}));box(bath,2.26,1.79,7.1,.07,1.08,1.38,M.trim);addInteract('Look in the mirror',()=>{needs.stress=Math.min(100,needs.stress+2);note('You look tired. The face in the glass looks like yours, a second after you move.')},mirror,'BATHROOM');addInteract('Take a shower',()=>{needs.hygiene=Math.min(100,needs.hygiene+42);needs.stress=Math.max(0,needs.stress-8);needs.thirst=Math.min(100,needs.thirst+2);emitParticles(6.2,1.3,8.72,'water',25,.5);emitParticles(6.2,.9,8.72,'steam',12,.12);notify('The pipes knock once. Water drums against the tub and warms.')},tub,'BATHROOM');addInteract('Use the bathroom',()=>{needs.stress=Math.max(0,needs.stress-3);notify('The small fan keeps turning after you leave.')},toilet,'BATHROOM');
// Basement / attic spaces, each with a narrative object and unease.
for(let x=-7.1;x<-2.6;x+=1.05){box(basement,x,.35,12.4,.75,.7,.74,M.wood);box(basement,x,.75,12.4,.75,.08,.74,M.trim)}
const fuse=box(basement,-3.25,1.6,15.95,.55,.72,.15,M.metal);addInteract('Inspect the fuse box',()=>{notify('All the switches are on. One is warm.');state.flags.fuse=true},fuse,'BASEMENT');
const boxAttic=box(attic,6.0,.58,15.1,1.2,1.05,.95,M.wood);const tape=box(attic,5.95,1.17,15.08,.32,.12,.23,M.black);addInteract('Play the old recording',()=>readLetter('On the tape','[static]\n\nA chair scrapes across a floor. A voice, very far away: “You said you would come back.”\n\nThen your own voice, closer: “I am home.”\n\n[the rest is blank]'),tape,'ATTIC');
const atticWindow=box(attic,4.9,1.9,16.36,1.2,.85,.08,M.glass);
// Doors are usable and can be locked. A door's position is a persistent household state.
function createDoor(name,x,z,axis,hingeX,hingeZ,room){const group=new THREE.Group();group.position.set(hingeX,0,hingeZ);scene.add(group);const panel=box(group,axis==='x'?.58:.1,1.08,axis==='x'?.1:.58,axis==='x'?1.16:.12,2.16,axis==='x'?.12:1.16,M.wood);const handle=box(group,axis==='x'?1.02:.19,1.08,axis==='x'?.16:.99,.07,.08,.07,M.metal);const hitTarget=box(scene,hingeX+(axis==='x'?.58:0),1.08,hingeZ+(axis==='z'?.58:0),axis==='x'?1.05:.18,1.9,axis==='x'?.18:1.05,new THREE.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,depthWrite:false}),{cast:false,receive:false});const motion={name,group,axis,hingeX,hingeZ,closed:0,open:axis==='x'?-Math.PI/2:Math.PI/2,target:0,entry:null};animatedDoors.push(motion);const entry=addInteract((name==='front'?'Open the front door':'Open the back door'),()=>{const open=Math.abs(motion.target)>.1;motion.target=open?motion.closed:motion.open;state.doors[name]=!open;syncDoorLabel(motion);save();notify(open?'The door closes with a wooden thud.':'The door swings open on its hinges.');emitParticles(hingeX,1.1,hingeZ,'dust',8,.25)},[hitTarget,panel,handle],'ANY');motion.entry=entry;entry.door=motion;return group;}
function syncDoorLabel(motion){if(motion.entry)motion.entry.label=(Math.abs(motion.target)>.1?'Close the ':'Open the ')+motion.name+' door'}
const frontDoor=createDoor('front',0,-2.08,'x',-.57,-2.08,'THE HALL');const backDoor=createDoor('back',8.5,2.2,'z',8.5,1.62,'KITCHEN');
// House-specific wall-mounted things, small clutter, and safe navigation bounds.
for(const [x,z] of [[-1.8,-1.1],[1.8,-.4],[-1.8,2.3],[1.8,4.8],[-1.8,6.1]])box(hall,x,1.35,z,.12,.12,.12,M.trim);
const phone=box(hall,1.9,1.35,1.6,.14,.24,.19,M.black);addInteract('Call someone',()=>{if(state.called){note('No new messages. The last call is still listed as “E. — 8 minutes”.')}else callSomeone()},phone,'THE HALL');
const coat=box(hall,-1.82,1.45,5.6,.13,.8,.55,M.fabricDark);addInteract('Take the house keys',()=>{inventory.add('keys');notify('The brass keys are in your palm. They feel familiar.')},coat,'THE HALL');inventory.add('keys');inventory.add('phone');
// Dining table and a chair give the kitchen a lived-in center.
table(kitchen,4.2,.8,2.25,1.2,.78);const mug=box(kitchen,4.05,.95,.74,.19,.28,.18,M.white);addInteract('Drink from the mug',()=>{needs.thirst=Math.max(0,needs.thirst-18);notify('The water has gone flat.')},mug,'KITCHEN');chair(kitchen,3.25,1.8,0);chair(kitchen,5.15,1.8,Math.PI);
// Quiet routines: small actions make the house feel inhabited, and leave persistent traces.
const stoveControl=box(kitchen,3.22,1.16,-1.42,.16,.12,.16,M.metal);
addInteract('Cook something simple',()=>{
 if(state.flags.mealCooked){notify('The pan is clean again. You already ate.');return}
 if(inventory.has('apple')||inventory.has('milk')){state.flags.mealCooked=true;inventory.delete('apple');inventory.delete('milk');apple.visible=false;needs.hunger=Math.max(0,needs.hunger-38);needs.stress=Math.max(0,needs.stress-3);setTime(24);note('You eat at the kitchen table. The second chair is pulled out when you finish.');}
 else{notify('There is nothing in the fridge worth cooking.');}
},stoveControl,'KITCHEN');
const sinkTap=box(kitchen,6.1,1.14,-1.44,.15,.13,.14,M.metal);
addInteract('Drink a glass of water',()=>{needs.thirst=Math.max(0,needs.thirst-28);needs.stress=Math.max(0,needs.stress-2);setTime(2);emitParticles(6.1,1.14,-1.44,'water',14,.28);notify('Cold water. The pipes tick as you turn the tap off.')},sinkTap,'KITCHEN');
const paper=box(living,-4.65,.66,.03,.43,.045,.3,M.paper);
addInteract('Read the folded newspaper',()=>readLetter('The folded paper','A local paper, years old. The date has been circled twice.\n\n“Search called off near Miller Road.”\n\nThe next column is missing. On the back, in your handwriting: Don’t let them call it an accident.'),paper,'LIVING ROOM');
const computerDesk=table(bedroom,-3.15,5.65,1.55,.72,.72,M.wood);
const computer=box(bedroom,-3.15,1.35,5.58,.78,.62,.12,M.black);const computerScreen=box(bedroom,-3.15,1.36,5.5,.67,.47,.02,M.screen);
addInteract('Use the computer',()=>{
 setTime(12);needs.rest=Math.max(0,needs.rest-1);state.flags.usedComputer=true;
 if(!state.flags.computerFile){state.flags.computerFile=true;readLetter('A file on the desktop','DRAFT — unsent\n\nMara, I know what I told you about the night by the river. I know what you remember. I can’t make both versions fit in the same room.\n\nThe cursor blinks after the word “sorry.”');}
 else{notify(pick(['The connection is down again.','A blank email is open, addressed to Mara.','The clock in the corner says 2:14. Your watch says otherwise.']));if(rand()<.3)needs.suspicion=Math.min(100,needs.suspicion+2)}
},[computer,computerScreen],'BEDROOM');
const windowLatch=box(scene,-5.4,1.3,-2.02,.16,.18,.12,M.metal);
addInteract('Check the front window',()=>{state.flags.checkedWindow=true;setTime(3);if(Math.floor(state.minutes/60)>=20||Math.floor(state.minutes/60)<5){needs.fear=Math.min(100,needs.fear+3);notify('The street is empty. A curtain across the road moves anyway.')}else notify('A quiet street. The neighbor’s porch light is on.')},windowLatch,'LIVING ROOM');
// Add a neighboring house silhouette outdoors for occasional uncertain sightlines.
box(scene,-12,1.5,-8,10,4,9,mat('#42463e'),{cast:false});for(const x of [-14,-10]){box(scene,x,2,-3.48,1.2,.9,.06,mat('#444d46'));}
// Small loose household objects have weight: footsteps and nearby disturbances can send them skittering.
const looseMaterials=[mat('#8c7960'),mat('#777b70'),mat('#9a8b72'),mat('#584d40')];
function looseCan(x,z,room,material=looseMaterials[0]){const m=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.22,10),material);m.position.set(x,.12,z);m.rotation.z=Math.PI/2;room.add(m);return addPhysicsProp(m,.13)}
function loosePaper(x,z,room){const m=box(room,x,.035,z,.28,.025,.19,M.paper,{cast:false});m.rotation.y=Math.random()*Math.PI;return addPhysicsProp(m,.19)}
looseCan(-4.2,2.4,living,looseMaterials[1]);loosePaper(-6.9,-.35,living);
looseCan(6.7,2.7,kitchen,looseMaterials[2]);loosePaper(3.1,2.65,kitchen);
looseCan(-6.7,6.0,bedroom,looseMaterials[3]);loosePaper(-3.2,8.7,bedroom);
const droppedKeys=new THREE.Mesh(new THREE.TorusGeometry(.105,.018,6,16),M.metal);droppedKeys.rotation.x=Math.PI/2;droppedKeys.position.set(.9,.045,2.35);hall.add(droppedKeys);addPhysicsProp(droppedKeys,.12);
// Dust motes drift through the flashlight cone, making its beam legible in the quiet rooms.
const dustMotes=[];for(let i=0;i<38;i++){const mote=new THREE.Mesh(particleGeo,particleMaterials.dust);mote.scale.setScalar(.38+Math.random()*.55);mote.position.set((Math.random()-.5)*12,.35+Math.random()*2.2,Math.random()*12);scene.add(mote);dustMotes.push({mesh:mote,phase:Math.random()*6.28,baseY:mote.position.y})}

// Persistent routine, hidden mental state, and a small narrative graph.
let rngSeed=state.seed;function rand(){rngSeed=(rngSeed*1664525+1013904223)>>>0;return rngSeed/4294967296}function pick(a){return a[Math.floor(rand()*a.length)]}
function save(){try{const data={state:{...state,seen:[...state.seen]},needs,inventory:[...inventory],rngSeed,player:{x:player.position.x,y:player.position.y,z:player.position.z,yaw,pitch},world:{fridgeOpen:fridgeState.open,lanternOn}};localStorage.setItem(saveKey,JSON.stringify(data));document.querySelector('#continue-button').disabled=false;return true}catch(e){return false}}
function load(){try{const raw=localStorage.getItem(saveKey);if(!raw)return false;const d=JSON.parse(raw);Object.assign(state,d.state);state.totalMinutes=d.state.totalMinutes??((state.day-1)*1440+state.minutes);if(d.state.totalMinutes===undefined){state.eventAt+=((state.day-1)*1440);state.lastEvent=state.lastEvent<0?state.lastEvent:state.lastEvent+((state.day-1)*1440)}state.seen=new Set(d.state.seen||[]);Object.assign(needs,d.needs);inventory.clear();(d.inventory||[]).forEach(i=>inventory.add(i));rngSeed=d.rngSeed||state.seed;if(d.player){player.position.set(d.player.x||0,d.player.y||0,d.player.z??1.1);yaw=d.player.yaw||0;pitch=d.player.pitch||0;player.rotation.y=yaw;camera.rotation.x=pitch}if(d.world){fridgeState.open=!!d.world.fridgeOpen;fridgeDoor.position.x=fridgeState.open?7.03:7.27;fridgeDoor.rotation.y=fridgeState.open?.55:0;setLantern(d.world.lanternOn!==false)}document.querySelector('#continue-button').disabled=false;return true}catch(e){return false}}
function note(text){document.querySelector('#journal-text').textContent=text;state.history.push({day:state.day,time:state.minutes,text});if(state.history.length>40)state.history.shift();save()}
let notificationTimer,subtitleTimer;
function notify(text){const el=document.querySelector('#notification');el.textContent=text;el.classList.add('show');clearTimeout(notificationTimer);notificationTimer=setTimeout(()=>el.classList.remove('show'),3300)}
function whisper(text){const el=document.querySelector('#subtitle');el.textContent=text;el.classList.add('show');clearTimeout(subtitleTimer);subtitleTimer=setTimeout(()=>el.classList.remove('show'),4700);audioTone(95,.7,.085)}
function readLetter(title,text){document.querySelector('#letter-title').textContent=title;document.querySelector('#letter-copy').textContent=text;document.querySelector('#letter-day').textContent=String(state.day).padStart(2,'0');document.querySelector('#letter-screen').hidden=false;paused=true;if(document.pointerLockElement)document.exitPointerLock();state.flags.readItems??=[];if(!state.flags.readItems.includes(title)){state.flags.readItems.push(title);state.found=state.flags.readItems.length}state.flags.read=true;needs.suspicion=Math.max(0,needs.suspicion-1);save()}
function closeLetter(){document.querySelector('#letter-screen').hidden=true;paused=false;requestLock()}
function setTime(mins){state.totalMinutes=(state.totalMinutes??((state.day-1)*1440+state.minutes))+mins;state.day=Math.floor(state.totalMinutes/1440)+1;state.minutes=((state.totalMinutes%1440)+1440)%1440;}
function updateObjectives(){const clues=document.querySelector('#objective-clues'),call=document.querySelector('#objective-call'),leave=document.querySelector('#objective-leave');clues.querySelector('b').textContent=`${Math.min(state.found,3)} / 3`;clues.classList.toggle('complete',state.found>=3);call.querySelector('b').textContent=state.flags.called?'DONE':'—';call.classList.toggle('complete',!!state.flags.called);leave.querySelector('b').textContent=state.flags.outside||state.flags.ending?'DONE':'—';leave.classList.toggle('complete',!!(state.flags.outside||state.flags.ending))}
function displayTime(){let h=Math.floor(state.minutes/60),m=Math.floor(state.minutes%60),ap=h>=12?'PM':'AM';h=h%12||12;document.querySelector('#clock').innerHTML=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} <small>${ap}</small>`;document.querySelector('#day-label').textContent=`${['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][(state.day)%7]} · DAY ${String(state.day).padStart(2,'0')}`;}
function roomAt(x,z){if(z<-2.25||x>8.8)return 'OUTSIDE';if(z>10.25&&x<-2.1)return 'BASEMENT';if(z>10.25&&x>2.1)return 'ATTIC';if(z>4.65&&x<-2.1)return 'BEDROOM';if(z>4.65&&x>2.1)return 'BATHROOM';if(x<-2.1)return 'LIVING ROOM';if(x>2.1)return 'KITCHEN';return 'THE HALL'}
function updateRoom(){let r=roomAt(player.position.x,player.position.z);if(r!==currentRoom){const previous=currentRoom;currentRoom=r;document.querySelector('#room-name').textContent=r;if(r!=='OUTSIDE'){state.flags.visited=state.flags.visited||{};state.flags.visited[r]=true}if(r==='BASEMENT'&&state.encounters>1&&!state.seen.has('basement-voice')){state.seen.add('basement-voice');whisper('You came down here already.');}if(previous!=='OUTSIDE'&&r==='OUTSIDE'){const front=player.position.z<-2.25&&Math.abs(player.position.x)<1.2,back=player.position.x>8.8&&player.position.z>1.3&&player.position.z<3.05;if((front&&Math.abs(animatedDoors[0].target)>.1)||(back&&Math.abs(animatedDoors[1].target)>.1))leaveHouse();}}}
function updateNeeds(dt){
 if(!started||paused)return;
 const sim=dt*1.25;
 needs.hunger=Math.min(100,needs.hunger+sim*.22);
 needs.thirst=Math.min(100,needs.thirst+sim*.29);
 needs.rest=Math.max(0,needs.rest-sim*.095);
 needs.hygiene=Math.max(0,needs.hygiene-sim*.055);
 needs.isolation=Math.min(100,needs.isolation+sim*.045);
 needs.stress=Math.max(0,needs.stress-sim*.012);

 for(const [key,value] of [['hunger',needs.hunger],['thirst',needs.thirst],['rest',needs.rest]]){
  document.querySelector(`#${key}-value`).textContent=Math.round(value);
  const bar=document.querySelector(`#${key}-bar`);
  bar.style.width=`${Math.max(3,value)}%`;
  const critical=key==='rest'?value<28:value>72;
  bar.style.background=critical?'#b16d5a':'#d3c5a5';
 }
 document.querySelector('#inventory-line').textContent='POCKETS: '+[...inventory].map(item=>item.toUpperCase()).join(' · ');
 if(needs.rest<20)needs.stress=Math.min(100,needs.stress+dt*.16);
}
function updateLightAndSky(){const t=state.minutes/1440,night=Math.max(0,Math.min(1,(Math.cos((t-.5)*Math.PI*2)+.18)/1.18));skyLight.intensity=.18+night*.7;sun.intensity=.12+(1-night)*1.3;scene.background.set(night>.6?'#151a1c':'#8a8b80');scene.fog.color.set(night>.6?'#1a1e20':'#777970');scene.fog.density=.025+night*.006;lights.forEach(l=>{l.intensity=.46*(1-night*.56)});const wash=document.querySelector('.color-wash');wash.style.background=night>.7?'linear-gradient(180deg,rgba(6,9,13,.4),rgba(8,10,13,.16) 50%,rgba(4,5,8,.63))':'linear-gradient(180deg,rgba(8,10,9,.42),transparent 25%,transparent 65%,rgba(5,6,6,.5))';document.querySelector('#weather').textContent=state.weather;document.querySelector('#weather-icon').textContent=state.weather==='RAIN'?'☂':state.weather==='CLEAR'?'☼':'☁';}
function requestLock(){if(touchDevice)return;try{const result=canvas.requestPointerLock?.();result?.catch?.(()=>{})}catch{}}
function startDay(){document.querySelector('#start-screen').hidden=true;started=true;paused=false;requestLock()}
function loadGame(){if(load()){document.querySelector('#start-screen').hidden=true;started=true;paused=false;restoreWorld();notify('The day comes back in pieces.');requestLock()}else{document.querySelector('#continue-button').disabled=true;notify('No saved day could be loaded.')}}
function restoreWorld(){Object.entries(state.doors).forEach(([name,open])=>{const motion=animatedDoors.find(d=>d.group===(name==='front'?frontDoor:backDoor));if(motion){motion.target=open?motion.open:motion.closed;motion.group.rotation.y=motion.target;syncDoorLabel(motion)}});if(state.flags.ateApple||!inventory.has('apple')){state.flags.ateApple=true;apple.visible=false}if(state.flags.photoMissing){photo.visible=false;photoPrint.visible=false}if(state.flags.tv)toggleTV(true)}
function pause(){if(!started)return;paused=true;document.querySelector('#pause-screen').hidden=false;if(document.pointerLockElement)document.exitPointerLock();save()}
function resume(){document.querySelector('#pause-screen').hidden=true;paused=false;requestLock()}
function sleep(){if(needs.rest>88)notify('You are not tired enough to sleep yet.');else{const hours=7+rand()*2;setTime(Math.round(hours*60));needs.rest=96;needs.stress=Math.max(0,needs.stress-12);needs.fear=Math.max(0,needs.fear-14);needs.isolation=Math.min(100,needs.isolation+9);needs.hunger=Math.min(100,needs.hunger+8);needs.thirst=Math.min(100,needs.thirst+11);scheduleNext();displayTime();updateLightAndSky();notify('You wake to a dim, quiet room.');save()}}
function scheduleNext(){state.eventAt=state.totalMinutes+50+Math.floor(rand()*180)}
function toggleTV(force){state.tv=force===true?true:!state.tv;tvscreen.material=state.tv?mat('#555b53',.25,{emissive:'#8b9878',emissiveIntensity:.42}):M.screen;if(state.tv){notify('The television finds a channel. Low voices.');setTimeout(()=>{if(state.tv&&needs.stress>35)whisper('...you can hear me, can’t you?')},11000);state.flags.tv=true}else notify('The screen goes dark.');save()}
function callSomeone(){if(state.minutes<6*60||state.minutes>22*60){notify('No one answers. You leave a message after the tone.');needs.isolation=Math.max(0,needs.isolation-4);state.called=true;state.flags.called=true;save();return}state.called=true;state.flags.called=true;needs.isolation=Math.max(0,needs.isolation-17);needs.stress=Math.max(0,needs.stress-6);const lines=['Mara says she can bring the spare key tomorrow. She asks if you are sleeping.','A friend answers, distracted, but stays on the line for a minute.','The call drops just after someone says your name.','A neighbor says the street is quiet tonight. You hear a door close on their end.'];note(pick(lines));notify('The line clicks softly when you hang up.');save()}
function leaveHouse(){if(!inventory.has('keys')){notify('You cannot find your keys.');return}if(needs.fear>78&&state.encounters>4){notify('The front door is open. The porch does not seem to be where it was.');realityBend();return}state.flags.outside=true;if(state.found>=3&&state.flags.called){ending('A little further','The road is wet. The house shrinks behind you, a familiar shape among the trees. You do not know what happened here. You know only that, for the first time in a long while, you kept walking.');return}if(state.found>=2){ending(state.flags.called?'A voice on the line':'The road, for now',state.flags.called?'Someone stays on the line while you walk toward the end of the street. The house is still there when you look back. So is the morning.':'You leave without making the call. The street is quiet, the air cold, and the house remains behind you. You can come back if you need to.');return}setTime(32);needs.isolation=Math.max(0,needs.isolation-10);displayTime();updateLightAndSky();notify('Cool air. The street is empty, but not unwelcoming.');save()}

// The event graph is deliberately suggestive rather than diagnostic: each moment has an ordinary explanation.
function realityBend(){const fade=document.querySelector('#fade');fade.classList.add('active');setTimeout(()=>{player.position.set(0,0,1.1);yaw=0;pitch=0;player.rotation.y=0;camera.rotation.x=0;needs.fear=Math.max(0,needs.fear-24);setTime(18);state.encounters++;displayTime();updateLightAndSky();fade.classList.remove('active');notify('You are back in the hall. The front door is still open.');save()},1200)}
function ending(title,text){paused=true;document.exitPointerLock?.();document.querySelector('#ending-title').textContent=title;document.querySelector('#ending-copy').textContent=text;document.querySelector('#ending-screen').hidden=false;state.flags.ending=title;save()}
function triggerEvent(){
 state.lastEvent=state.totalMinutes;state.eventAt=state.totalMinutes+72+Math.floor(rand()*220);state.encounters++;
 const hour=Math.floor(state.minutes/60),late=hour>=22||hour<5,pressure=(needs.stress*.32+needs.fear*.3+(100-needs.rest)*.22+needs.isolation*.16)/100;
 needs.fear=Math.min(100,needs.fear+1.5+rand()*4+pressure*2);needs.stress=Math.min(100,needs.stress+1+rand()*2+pressure);
 const once=(id,run)=>({id,test:()=>!state.seen.has(id),run:()=>{state.seen.add(id);run()}});
 const events=[
  once('pipes',()=>{whisper('A knock travels through the pipes. Then the house settles.');physicsProps.forEach(p=>{if(Math.random()<.45)kickProp(p.mesh,.32)});state.flags.threadStage=Math.max(state.flags.threadStage||0,1)}),
  once('phone-ring',()=>{notify('Your phone vibrates once. No number is shown.');needs.stress=Math.min(100,needs.stress+3);state.flags.phoneMissed=true}),
  once('hall-light',()=>{lights[0].intensity=.04;setTimeout(()=>{lights[0].intensity=.46},1700);whisper('The hallway seems longer in the dark.')}),
  once('weather-shift',()=>{state.weather=pick(['RAIN','OVERCAST','CLEAR']);updateLightAndSky();notify('The weather changes while you are inside.')}),
  {id:'attic-step',test:()=>state.flags.visited?.ATTIC&&!state.seen.has('attic-step'),run:()=>{state.seen.add('attic-step');whisper('A soft step overhead. You are standing beneath the roof.');state.flags.threadStage=Math.max(state.flags.threadStage||0,2)}},
  once('first-footsteps',()=>{state.flags.threadStage=1;audioTone(58,.55,.06);whisper('Footsteps cross the empty room above you. They stop at the stairs.')}),
  {id:'chair-memory',test:()=>state.flags.threadStage===1&&!state.seen.has('chair-memory'),run:()=>{state.seen.add('chair-memory');state.flags.threadStage=2;note('In the morning, a chair is facing the stairs. You are certain it was not there last night.')}} ,
  {id:'photo-memory',test:()=>state.flags.threadStage===2&&!state.seen.has('photo-memory'),run:()=>{state.seen.add('photo-memory');state.flags.threadStage=3;photo.visible=false;photoPrint.visible=false;state.flags.photoMissing=true;note('The family photograph is gone. There is no glass on the floor, only a clean rectangle in the dust.')}},
  {id:'voice-memory',test:()=>state.flags.threadStage===3&&!state.seen.has('voice-memory')&&late,run:()=>{state.seen.add('voice-memory');state.flags.threadStage=4;whisper('From the room where the photograph hung: “You said you would come back.”');needs.fear=Math.min(100,needs.fear+7)}},
  {id:'fridge-open',test:()=>!fridgeState.open&&needs.stress>26,run:()=>{fridgeState.open=true;notify('A pale line of light spills from the kitchen. The refrigerator door eases open.');state.flags.fridgeMoved=true}},
  {id:'window-silhouette',test:()=>late&&state.flags.checkedWindow&&!state.seen.has('window-silhouette'),run:()=>{state.seen.add('window-silhouette');whisper('Something stands in the window. When you look directly, it is only your reflection.')}},
  {id:'time-slip',test:()=>needs.rest<24&&!state.seen.has('time-slip'),run:()=>{state.seen.add('time-slip');const skip=7+Math.floor(rand()*13);setTime(skip);needs.stability=Math.max(0,needs.stability-2);notify('You blink. The clock has moved forward.')}},
  {id:'memory',test:()=>state.found>0&&!state.seen.has('memory'),run:()=>{state.seen.add('memory');note('You remember a second cup at the table. You cannot remember when you put it away.')}},
  {id:'settle',test:()=>true,run:()=>{const lines=['The refrigerator hum stops. A moment later, it starts again.','A small sound from another room. Probably the old house.','The air smells briefly of rain and wet leaves.','For a moment, you expect someone to answer.','A floorboard creaks somewhere you cannot reach.','The television clicks, though it is unplugged.'];notify(pick(lines));if(pressure>.55)needs.suspicion=Math.min(100,needs.suspicion+1)}}
 ];
 const available=events.filter(e=>e.test());const chain=available.filter(e=>e.id.includes('memory')||e.id==='first-footsteps'||e.id==='voice-memory');
 const pool=chain.length&&rand()<.68?chain:available;if(pool.length)pick(pool).run();
 if(needs.stress>72&&rand()<pressure*.4)whisper(pick(['You have time. Breathe slowly.','The room is quiet now.','You can check the door if you want.','It is all right to sit down.']))
 if(state.encounters>=3&&pressure>.3&&rand()<Math.min(.38,.12+(pressure-.3)*.65))showPeripheralApparition();
}
function audioTone(freq=180,duration=.12,volume=.04){try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;audioContext??=new Ctx();const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(volume,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+duration)}catch{}}
let audioContext=null;
const raycaster=new THREE.Raycaster();raycaster.far=2.65;const moveKeys=new Set(),touchMove={x:0,z:0};const touchDevice=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;let stamina=100,crouched=false,sprinting=false,exhausted=false;document.body.classList.toggle('touch-device',touchDevice);if(touchDevice){document.querySelector('#interact kbd').textContent='TAP';document.querySelector('.start-tip').textContent='Left stick to move · drag to look · USE to interact · LIGHT for your lantern'}let focused=null,stepSound=0,touchLookId=null,lastTouchX=0,lastTouchY=0,stickPointerId=null;
function findTarget(){raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hits=[];scene.traverseVisible(o=>{if(o.isMesh)hits.push(o)});const hit=raycaster.intersectObjects(hits,false)[0];focused=hit?.object.userData.interactable;if(focused&&focused.room!=='ANY'&&focused.room!==currentRoom)focused=null;document.querySelector('#interact').hidden=!focused;if(focused)document.querySelector('#interact-label').textContent=focused.label}
function interact(){if(focused&&started&&!paused){focused.action();findTarget();audioTone(360,.07,.025)}}
function overlaps(x,z,r=.22){return colliders.some(c=>x+r>c.x&&x-r<c.x+c.w&&z+r>c.z&&z-r<c.z+c.d)}
function doorDistance(m,x,z){const c=Math.cos(m.group.rotation.y),s=Math.sin(m.group.rotation.y),ax=m.axis==='x'?0:.1,az=m.axis==='x'?.1:0,bx=m.axis==='x'?1.16:.1,bz=m.axis==='x'?.1:1.16,x1=m.hingeX+c*ax+s*az,z1=m.hingeZ-s*ax+c*az,x2=m.hingeX+c*bx+s*bz,z2=m.hingeZ-s*bx+c*bz,dx=x2-x1,dz=z2-z1,t=Math.max(0,Math.min(1,((x-x1)*dx+(z-z1)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-(x1+t*dx),z-(z1+t*dz))}
function blockedByDoor(x,z,fromX,fromZ,r){return animatedDoors.some(m=>{const distance=doorDistance(m,x,z),previous=doorDistance(m,fromX,fromZ);return distance<r+.06&&distance<=previous+.001})}
let movementImpulse=0;
function updateStamina(dt,moving){const wantsRun=(moveKeys.has('ShiftLeft')||moveKeys.has('ShiftRight'))&&!crouched&&moving;sprinting=wantsRun&&!exhausted&&stamina>0;if(sprinting){stamina=Math.max(0,stamina-dt*22);if(stamina===0)exhausted=true}else{stamina=Math.min(100,stamina+dt*(exhausted?11:17));if(stamina>24)exhausted=false}const bar=document.querySelector('#stamina-bar'),meter=document.querySelector('.stamina-meter');bar.style.width=`${stamina}%`;bar.style.background=stamina<25?'#b16d5a':'#c9ae79';meter.classList.toggle('active',sprinting||stamina<99);document.querySelector('#stance-label').textContent=crouched?'CROUCHING':sprinting?'RUNNING':moving?'WALKING':'RESTING'}
function setCrouched(value){crouched=!!value;const button=document.querySelector('#touch-crouch');button?.setAttribute('aria-pressed',String(crouched))}
function movePlayer(dt){let x=(moveKeys.has('KeyD')?1:0)-(moveKeys.has('KeyA')?1:0)+touchMove.x,z=(moveKeys.has('KeyS')?1:0)-(moveKeys.has('KeyW')?1:0)+touchMove.z;const moving=!!(x||z);updateStamina(dt,moving);camera.position.y+=( (crouched?1.02:1.62)-camera.position.y )*(1-Math.exp(-dt*9));if(!moving){movementImpulse=0;return}const len=Math.hypot(x,z);x/=len;z/=len;const speed=(crouched?1.2:sprinting?4.05:2.55)*dt;const sin=Math.sin(yaw),cos=Math.cos(yaw),dx=(x*cos+z*sin)*speed,dz=(z*cos-x*sin)*speed;const px=player.position.x,pz=player.position.z;let nx=px+dx,nz=pz+dz;if(nx>-12&&nx<12&&!overlaps(nx,pz,crouched?.17:.22)&&!blockedByDoor(nx,pz,px,pz,crouched?.17:.22))player.position.x=nx;if(nz>-12&&nz<18&&!overlaps(player.position.x,nz,crouched?.17:.22)&&!blockedByDoor(player.position.x,nz,player.position.x,pz,crouched?.17:.22))player.position.z=nz;const walking=Math.abs(player.position.x-px)+Math.abs(player.position.z-pz)>.001;movementImpulse=walking?speed/Math.max(dt,.001):0;if(walking){stepSound+=dt*(crouched?.68:1);if(stepSound>(crouched?.72:.48)){stepSound=0;if(rand()<.18)audioTone(crouched?55:72,.035,.012)}}}
function updateTime(dt){if(!started||paused)return;const oldDay=state.day;setTime(dt*2.7);if(state.day!==oldDay){needs.rest=Math.min(100,needs.rest+2);state.weather=pick(['OVERCAST','OVERCAST','RAIN','CLEAR']);save()}if(state.totalMinutes>=state.eventAt&&state.totalMinutes-state.lastEvent>30)triggerEvent();displayTime();updateLightAndSky()}
function persistWorld(){state.flags.ateApple=!apple.visible;save()}
function updatePhysicalWorld(dt){
  for(const motion of animatedDoors){const delta=motion.target-motion.group.rotation.y;motion.group.rotation.y+=delta*(1-Math.exp(-dt*7))}
  // Fridge door has weight and swings to its stop rather than teleporting.
  const fridgeTarget=fridgeState.open?7.03:7.27;fridgeDoor.position.x+=(fridgeTarget-fridgeDoor.position.x)*(1-Math.exp(-dt*8));const fridgeAngle=fridgeState.open?.55:0;fridgeDoor.rotation.y+=(fridgeAngle-fridgeDoor.rotation.y)*(1-Math.exp(-dt*7));
  for(const p of physicsProps){const m=p.mesh;if(!m.visible)continue;const dx=m.position.x-player.position.x,dz=m.position.z-player.position.z,dist=Math.hypot(dx,dz),reach=p.radius+.32;if(dist<reach&&movementImpulse>.45){const force=(movementImpulse-.35)*dt*1.6;p.vx+=dx/(dist||1)*force;p.vz+=dz/(dist||1)*force;if(p.sleeping){p.vy=.12;p.sleeping=false}}if(p.sleeping)continue;p.vy-=5.8*dt;m.position.x+=p.vx*dt;m.position.y+=p.vy*dt;m.position.z+=p.vz*dt;m.rotation.x+=p.vz*dt*2;m.rotation.z-=p.vx*dt*2;p.vx*=Math.exp(-2.2*dt);p.vz*=Math.exp(-2.2*dt);if(m.position.y<p.floorY){m.position.y=p.floorY;if(Math.abs(p.vy)>.16)p.vy=-p.vy*.24;else p.vy=0;if(Math.hypot(p.vx,p.vz)<.035){p.vx=0;p.vz=0;p.sleeping=true}}}
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;e.vy-=1.5*dt;e.mesh.position.x+=e.vx*dt;e.mesh.position.y+=e.vy*dt;e.mesh.position.z+=e.vz*dt;e.mesh.material=particleMaterials[e.type];e.mesh.material.opacity=Math.max(0,Math.min(1,e.life*1.5))*(e.type==='steam'?.16:e.type==='water'?.72:.48);if(e.type==='steam')e.mesh.scale.multiplyScalar(1+dt*.3);if(e.life<=0){scene.remove(e.mesh);effects.splice(i,1)}}
  const t=performance.now()*.001;for(const d of dustMotes){d.mesh.position.y=d.baseY+Math.sin(t*.7+d.phase)*.12;d.mesh.position.x+=Math.sin(t*.3+d.phase)*dt*.012}
}

// Input, interface bindings, and the render/update loop.
function setLantern(on){lanternOn=on;lantern.intensity=on?3.2:0;document.querySelector('#flash-indicator').textContent=on?'◉ LANTERN ON':'◯ LANTERN OFF'}
function bindButton(id,action){document.querySelector(`#${id}`).addEventListener('click',action)}
function startNew(){localStorage.removeItem(saveKey);state.day=1;state.minutes=7*60+12;state.totalMinutes=state.minutes;state.seen.clear();state.history=[];state.flags={};state.doors={};state.encounters=0;state.found=0;state.called=false;state.eventAt=517;state.lastEvent=-1000;state.weather='OVERCAST';state.seed=Math.random()*1e6>>>0;rngSeed=state.seed;Object.assign(needs,{hunger:18,thirst:12,rest:82,hygiene:71,stress:19,fear:0,isolation:23,suspicion:9,stability:81});stamina=100;exhausted=false;setCrouched(false);camera.position.y=1.62;moveKeys.clear();inventory.clear();['keys','phone','apple','tea'].forEach(i=>inventory.add(i));for(const motion of animatedDoors){motion.target=motion.closed;motion.group.rotation.y=motion.closed;syncDoorLabel(motion)}frontDoor.rotation.y=0;backDoor.rotation.y=0;currentRoom='THE HALL';document.querySelector('#room-name').textContent=currentRoom;state.tv=false;tvscreen.material=M.screen;apple.visible=true;photo.visible=true;photoPrint.visible=true;fridgeState.open=false;fridgeDoor.position.x=7.27;fridgeDoor.rotation.y=0;apparition.visible=false;apparitionLife=0;apparitionLook=0;apparitionMaterial.opacity=0;player.position.set(0,0,1.1);yaw=0;pitch=0;setLantern(true);displayTime();updateLightAndSky();document.querySelector('#journal-text').textContent='The kettle needs descaling. Pick up milk if you go out.';startDay()}
bindButton('start-button',startDay);
bindButton('continue-button',loadGame);
bindButton('new-button',startNew);
bindButton('resume-button',resume);
bindButton('save-button',()=>{persistWorld();notify('Your day is saved.');resume()});
bindButton('leave-button',()=>{persistWorld();document.querySelector('#pause-screen').hidden=true;document.querySelector('#start-screen').hidden=false;started=false;paused=true});
bindButton('close-letter',closeLetter);
bindButton('ending-return',()=>{document.querySelector('#ending-screen').hidden=true;document.querySelector('#start-screen').hidden=false;started=false;paused=true;save()});
if(localStorage.getItem(saveKey))document.querySelector('#continue-button').disabled=false;
canvas.addEventListener('click',()=>{if(!touchDevice&&started&&!paused)requestLock()});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas||paused)return;lookBy(e.movementX,e.movementY)});
function lookBy(dx,dy){yaw-=dx*.0022;pitch=Math.max(-1.35,Math.min(1.35,pitch-dy*.0019));player.rotation.y=yaw;camera.rotation.x=pitch}
if(touchDevice){
 canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||!started||paused||touchLookId!==null)return;touchLookId=e.pointerId;lastTouchX=e.clientX;lastTouchY=e.clientY;canvas.setPointerCapture?.(e.pointerId);e.preventDefault()});
 canvas.addEventListener('pointermove',e=>{if(e.pointerId!==touchLookId||paused)return;const dx=e.clientX-lastTouchX,dy=e.clientY-lastTouchY;lastTouchX=e.clientX;lastTouchY=e.clientY;lookBy(dx,dy);e.preventDefault()});
 const endTouchLook=e=>{if(e.pointerId===touchLookId)touchLookId=null};canvas.addEventListener('pointerup',endTouchLook);canvas.addEventListener('pointercancel',endTouchLook);
 const stick=document.querySelector('#move-stick'),knob=document.querySelector('#move-stick-knob');
 const updateStick=e=>{const rect=stick.getBoundingClientRect(),radius=rect.width*.34,dx=e.clientX-(rect.left+rect.width/2),dy=e.clientY-(rect.top+rect.height/2),length=Math.hypot(dx,dy),scale=length>radius?radius/length:1,nx=dx*scale,ny=dy*scale;knob.style.transform=`translate(${nx}px,${ny}px)`;touchMove.x=Math.abs(nx/radius)<.12?0:nx/radius;touchMove.z=Math.abs(ny/radius)<.12?0:ny/radius};
 stick.addEventListener('pointerdown',e=>{stickPointerId=e.pointerId;stick.setPointerCapture(e.pointerId);updateStick(e);e.preventDefault()});
 stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointerId)updateStick(e)});
 const resetStick=e=>{if(e.pointerId!==stickPointerId)return;stickPointerId=null;touchMove.x=0;touchMove.z=0;knob.style.transform='translate(0,0)'};stick.addEventListener('pointerup',resetStick);stick.addEventListener('pointercancel',resetStick);
 bindButton('touch-interact',interact);bindButton('touch-lantern',()=>setLantern(!lanternOn));bindButton('touch-crouch',()=>setCrouched(!crouched));bindButton('touch-pause',pause);
}
document.addEventListener('keydown',e=>{
 if(e.code==='Escape'){if(!document.querySelector('#letter-screen').hidden){closeLetter();return}if(!document.querySelector('#pause-screen').hidden){resume();return}if(started&&!paused)pause();return}
 if(!started||paused)return;
 if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code)){moveKeys.add(e.code);e.preventDefault()}
 if(e.code==='KeyC'&&!e.repeat){setCrouched(!crouched);e.preventDefault()}if(e.code==='KeyE'&&!e.repeat)interact();if(e.code==='KeyF'&&!e.repeat)setLantern(!lanternOn);
});
document.addEventListener('keyup',e=>moveKeys.delete(e.code));
document.addEventListener('pointerlockchange',()=>{if(!touchDevice&&started&&!paused&&document.pointerLockElement!==canvas)pause()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!paused)pause()});
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(started&&!paused){movePlayer(dt);updateNeeds(dt);updateTime(dt);updateRoom();updateApparition(dt);findTarget();if(Math.floor(state.minutes/12)!==state._saveMinute){state._saveMinute=Math.floor(state.minutes/12);persistWorld()}}updateObjectives();updatePhysicalWorld(dt);renderer.render(scene,camera)}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}
window.addEventListener('resize',resize);
setLantern(true);displayTime();updateLightAndSky();animate();

