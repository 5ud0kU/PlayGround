import * as THREE from 'three';

// Neon Blood: a small open-neighborhood life sim / arcade brawler.
const $ = (id) => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x100b1b);
scene.fog = new THREE.FogExp2(0x100b1b, 0.012);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .1, 180);
const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
scene.add(new THREE.HemisphereLight(0x9ca5e3, 0x261726, 1.9));
const moon = new THREE.DirectionalLight(0xabbcff, 2.3); moon.position.set(-18, 30, -10); moon.castShadow = true; moon.shadow.mapSize.set(1024,1024); scene.add(moon);
const mats = {};
function mat(color, rough=.82, metal=0){ return new THREE.MeshStandardMaterial({color, roughness:rough, metalness:metal}); }
const asphalt=mat(0x24212b), sidewalk=mat(0x56515d), concrete=mat(0x4a4250), skin=mat(0xa96850), black=mat(0x15141a), white=mat(0xe4ddca), red=mat(0xd52f4a), teal=mat(0x208c91), gold=mat(0xe3aa48), denim=mat(0x283c62), green=mat(0x31905e), glass= new THREE.MeshStandardMaterial({color:0x39747e,emissive:0x102e35,roughness:.27,metalness:.2});
const boxGeo=new THREE.BoxGeometry(1,1,1), sphereGeo=new THREE.SphereGeometry(1,12,10), cylGeo=new THREE.CylinderGeometry(.5,.5,1,12);
function cube(parent, geo, material, pos, scale, cast=false){ const o=new THREE.Mesh(geo,material); o.position.set(...pos); o.scale.set(...scale); o.castShadow=cast; o.receiveShadow=true; parent.add(o); return o; }
function pointLight(color,intensity,dist,pos){const l=new THREE.PointLight(color,intensity,dist,2);l.position.set(...pos);scene.add(l);return l;}
// broad walkable grid
cube(scene,boxGeo,asphalt,[0,-.32,0],[94,.5,94]);
for(let v=-40;v<=40;v+=20){
  cube(scene,boxGeo,sidewalk,[v,-.03,0],[6,.14,94]); cube(scene,boxGeo,sidewalk,[0,-.03,v],[94,.14,6]);
  cube(scene,boxGeo,asphalt,[v,-.12,0],[14,.18,94]); cube(scene,boxGeo,asphalt,[0,-.12,v],[94,.18,14]);
  for(let n=-42;n<=42;n+=6){cube(scene,boxGeo,mat(0xbba778),[v,.002,n],[.17,.025,2.1]);cube(scene,boxGeo,mat(0xbba778),[n,.002,v],[2.1,.025,.17]);}
}
// pavement slabs and street lamps
for(let x=-42;x<=42;x+=10) for(let z=-42;z<=42;z+=10){
 if(Math.abs(x%20)<5 && Math.abs(z%20)<5) continue;
 cube(scene,boxGeo,mat(0x47424b),[x,-.12,z],[2.4,.15,2.4]);
}
for(let x=-40;x<=40;x+=20) for(let z=-40;z<=40;z+=20){
 if(Math.abs(x)<4 && Math.abs(z)<4) continue;
 const pole=cube(scene,cylGeo,mat(0x37303a),[x+4,2.6,z+4],[.12,5.2,.12]);
 cube(scene,boxGeo,mat(0xffcc88,.25),[x+4,5.2,z+4],[.5,.14,.4]); pointLight(0xffb978,.9,9,[x+4,4.7,z+4]);
}
const buildings=[];
function building(x,z,w,d,h,color,name,accent=0xff4c78){
 const g=new THREE.Group(); scene.add(g);g.position.set(x,0,z);
 cube(g,boxGeo,mat(color),[0,h/2,0],[w,h,d],true);
 cube(g,boxGeo,mat(0x211c28),[0,h+.25,0],[w+.35,.5,d+.35],true);
 for(let yy=2;yy<h-1;yy+=3) for(let xx=-w/2+1;xx<w/2-.5;xx+=2.4){
   cube(g,boxGeo,glass,[xx,yy,d/2+.015],[.85,1.15,.04]); cube(g,boxGeo,mat(accent,.3),[xx,yy-.7,d/2+.05],[.95,.09,.08]);
 }
 const sign=cube(g,boxGeo,mat(accent,.3),[0,2,d/2+.18],[Math.min(w-1,8),.75,.2]);
 const label=document.createElement('canvas');label.width=512;label.height=96;const ctx=label.getContext('2d');ctx.fillStyle='#100b18';ctx.fillRect(0,0,512,96);ctx.font='bold 54px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff0e8';ctx.shadowColor='#ff315d';ctx.shadowBlur=16;ctx.fillText(name.toUpperCase(),256,48);
 const tex=new THREE.CanvasTexture(label);sign.material=new THREE.MeshBasicMaterial({map:tex,transparent:true});
 buildings.push({x,z,w,d}); return g;
}
building(-10,-10,14,12,13,0x443746,'Motel 6',0x55d8dc);
building(16,-12,12,10,9,0x392d38,'Lucky Star Diner',0xffb943);
building(-17,-14,11,11,11,0x343448,'IRON TEMPLE',0x8dd765);
building(17,17,14,12,15,0x482837,'THE RED ROOM',0xff315f);
building(-28,12,13,13,17,0x40344a,'PAWN & GO',0xccb8ee);
building(31,-29,13,15,20,0x37334a,'SUNSET TOWERS',0x51d5e0);
building(-29,-30,14,14,13,0x3e3442,'LIQUOR',0xffd25c);
building(30,11,13,14,12,0x423243,'TATTOO',0xff5eb5);
// neon landmarks / arcade navigation signs
function marker(x,z,color,label){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,.075,8,32),new THREE.MeshBasicMaterial({color}));ring.rotation.x=Math.PI/2;ring.position.set(x,.12,z);scene.add(ring);const l=pointLight(color,1.7,8,[x,2,z]);return {ring,light:l,label,x,z};}
const markers={apartment:marker(0,5,0x53e6dc,'MOTEL'),diner:marker(16,-5,0xffbd4b,'DINER'),gym:marker(-17,-7,0x95e86e,'GYM'),club:marker(17,26,0xff3d6c,'CLUB'),pawn:marker(-28,20,0xc4a8f4,'PAWN')};
// characters, props, and vehicles
function makePerson(shirt, pants=denim){
 const g=new THREE.Group();
 cube(g,cylGeo,pants,[0,.72,0],[.54,.9,.42],true);
 cube(g,boxGeo,mat(shirt),[0,1.48,0],[.72,.75,.48],true);
 const head=cube(g,sphereGeo,skin,[0,2.05,0],[.38,.42,.37],true);
 cube(g,boxGeo,black,[0,2.3,0],[.72,.16,.52],true);
 for(const side of [-1,1]){cube(g,cylGeo,skin,[side*.19,1.04,0],[.17,.67,.18],true);cube(g,cylGeo,skin,[side*.48,1.48,0],[.17,.68,.18],true);}
 g.userData={head};scene.add(g);return g;
}
const player=makePerson(0x239895,denim); player.position.set(0,0,3);
// recognizable jacket and sneakers
cube(player,boxGeo,mat(0x1ce0ce),[0,1.5,-.255],[.36,.42,.035]);
const enemies=[];
const enemySeeds=[[-8,4],[9,1],[-24,0],[11,22],[-13,21],[26,1],[-32,-2],[2,-25],[32,19],[17,25],[23,-20]];
enemySeeds.forEach((p,i)=>{const g=makePerson(i%3===0?0x9a2c40:i%3===1?0x302a39:0xb18446,i%2?0x22263b:0x353142);g.position.set(p[0],0,p[1]);g.rotation.y=Math.random()*6.28;enemies.push({g,hp:3,max:3,alive:true,aggro:false,hit:0,walk:Math.random()*6,seed:p,down:0,kind:i===9?'boss':'thug'});});
const civilians=[];
[[-5,-2],[5,-12],[24,-3],[-22,7],[4,23],[30,-15],[-7,29]].forEach((p,i)=>{const g=makePerson([0x544984,0x497b77,0x9d526b,0x82764a][i%4],0x383544);g.position.set(p[0],0,p[1]);civilians.push({g,seed:p,walk:i});});
// parked car; simple arcade driving
const car=new THREE.Group();scene.add(car);car.position.set(4,0,7);car.rotation.y=-.3;
cube(car,boxGeo,mat(0x287a52,.38),[0,.62,0],[2.1,.65,4.1],true);cube(car,boxGeo,glass,[0,1.16,-.15],[1.72,.63,2.05],true);
for(const x of [-1.06,1.06])for(const z of [-1.35,1.35])cube(car,cylGeo,black,[x,.42,z],[.52,.23,.7],true).rotation.z=Math.PI/2;
for(const x of [-.7,.7])cube(car,boxGeo,mat(0xffe6a8,.25),[x,.65,-2.07],[.42,.19,.04]);
const carLight=pointLight(0xffd07b,0,10,[4,1,5]);

const state={active:false,paused:false,shop:false,shift:false,dead:false,inCar:false,muted:false,health:100,energy:100,hunger:88,hygiene:90,strength:10,cash:120,heat:0,day:1,time:21.5,weapon:0,kills:0,shifts:0,mission:0,missionDone:false,saveKey:'neonblood-save-v1'};
const missions=[
 {title:'A New Low',text:'Grab a bite at the diner.',kicker:'MISSION 01'},
 {title:'Rent Money',text:'Earn $200 and pay up at the motel.',kicker:'MISSION 02'},
 {title:'Welcome Committee',text:'Knock out 3 street thugs.',kicker:'MISSION 03'},
 {title:'Clock In',text:'Work a diner shift. Serve 5 customers.',kicker:'MISSION 04'},
 {title:'Get Strong',text:'Hit the Iron Temple gym.',kicker:'MISSION 05'},
 {title:'Last Call',text:'Take down the Red Room bouncer.',kicker:'MISSION 06'},
];
let yaw=0,pitch=.2, attackCooldown=0, carSpeed=0,shiftTime=30,shiftServed=0,shiftTips=0,shiftOrder=null,shopType='diner',nearby=null,toastTimer=0,subtitleTimer=0,missionHold=0,missionOverlay=false, lastTime=performance.now();
const keys=new Set();
function toast(text,bad=false){const el=document.createElement('div');el.className='toast'+(bad?' bad':'');el.textContent=text;$('toasts').appendChild(el);setTimeout(()=>el.remove(),2500);}
function subtitle(text,seconds=3){$('subtitle').textContent=text;$('subtitle').classList.remove('hidden');subtitleTimer=seconds;}
function objective(title,text,kicker){$('obj-title').textContent=title;$('obj-text').textContent=text;$('obj-kicker').textContent=kicker;}
function updateObjective(){const m=missions[state.mission];if(!m){objective('Free Roam','The night is yours. Eat, earn, fight, and stay alive.','SAN ANDREAS NIGHTS');return;}objective(m.title,m.text,m.kicker);}
function setBar(id,value){$(id).style.width=Math.max(0,Math.min(100,value))+'%';}
function updateHud(){setBar('bar-health',state.health);setBar('bar-energy',state.energy);setBar('bar-hunger',state.hunger);setBar('bar-hygiene',state.hygiene);setBar('bar-strength',Math.min(100,state.strength*3));$('health-num').textContent=Math.ceil(state.health);$('strength-num').textContent='STR '+Math.round(state.strength);$('cash').textContent='$'+Math.floor(state.cash).toString().padStart(4,'0');$('clock').textContent=String(Math.floor(state.time)).padStart(2,'0')+':'+String(Math.floor((state.time%1)*60/5)*5).padStart(2,'0');$('dayline').textContent=`NIGHT ${state.day} · ${['TUES','WED','THU','FRI','SAT','SUN','MON'][(state.day-1)%7]}`;$('wanted').textContent='★'.repeat(Math.ceil(state.heat))+'☆'.repeat(5-Math.ceil(state.heat));$('heat-label').textContent=state.heat>0?'WANTED — LAY LOW':'';$('bar-health').style.background=state.health<30?'#ff3b48':'';$('w-name').textContent=['FISTS','PIPE','BAT'][state.weapon];$('w-icon').textContent=['✊','🔧','🏏'][state.weapon];$('speedo').classList.toggle('hidden',!state.inCar);$('speed-num').textContent=Math.floor(Math.abs(carSpeed)*24);$('speed-bar').style.width=Math.min(100,Math.abs(carSpeed)*38)+'%';$('district').textContent=nearestDistrict();$('mm-label').textContent=nearestDistrict();}
function nearestDistrict(){const x=player.position.x,z=player.position.z;if(Math.hypot(x,z)<13)return 'VERONA HEIGHTS';if(x>8&&z<3)return 'COMMERCE';if(x<0&&z<0)return 'IDLEWOOD';if(x>0&&z>5)return 'THE STRIP';return 'SOUTH SIDE';}
function setMission(n){state.mission=n;state.missionDone=false;updateObjective();}
function completeMission(reward,nextText){if(missionOverlay)return;missionOverlay=true;state.cash+=reward;state.missionDone=true;const m=missions[state.mission];$('mc-title').textContent=m?.title||'MISSION PASSED';$('mc-reward').textContent=`+$${reward}`;$('mc-next').textContent=nextText;$('mission-complete').classList.remove('hidden');document.exitPointerLock?.();}
function advanceMission(){ $('mission-complete').classList.add('hidden');missionOverlay=false;setMission(state.mission+1);if(state.mission>=missions.length){$('ending').classList.remove('hidden');$('ending-stats').textContent=`${state.kills} KOs · ${state.shifts} SHIFTS · $${state.cash} CASH`;}}
function showPrompt(text,key='E'){if(!text){$('prompt').classList.add('hidden');return;}$('prompt-text').textContent=text;$('prompt-key').textContent=key;$('prompt').classList.remove('hidden');}
function nearestPlace(){let best=null,dist=999;for(const [key,m] of Object.entries(markers)){const d=Math.hypot(player.position.x-m.x,player.position.z-m.z);if(d<dist){dist=d;best={key,dist,marker:m};}}return dist<2.8?best:null;}
function chooseInteraction(){if(state.inCar){showPrompt('Exit vehicle');nearby={key:'car'};return;}const p=nearestPlace();let nearestEnemy=enemies.find(e=>e.alive&&e.kind==='boss'&&Math.hypot(e.g.position.x-player.position.x,e.g.position.z-player.position.z)<3);
 if(nearestEnemy&&state.mission>=5){showPrompt('Challenge the bouncer');nearby={key:'boss',enemy:nearestEnemy};return;}
 if(p){nearby=p;const names={apartment:'Motel — sleep / shower / rent',diner:'Lucky Star — eat / work shift',gym:'Iron Temple — workout',club:'Red Room — go inside',pawn:'Pawn shop — buy gear'};showPrompt(names[p.key]);return;}
 let d=Math.hypot(player.position.x-car.position.x,player.position.z-car.position.z);if(d<3){nearby={key:'car'};showPrompt('Enter Greenwood');return;}
 const target=enemies.filter(e=>e.alive).sort((a,b)=>a.g.position.distanceTo(player.position)-b.g.position.distanceTo(player.position))[0];if(target&&target.g.position.distanceTo(player.position)<2.2){nearby={key:'fight',enemy:target};showPrompt('Throw hands');return;}
 nearby=null;showPrompt('');}
function interact(){if(!nearby)return;const key=nearby.key;if(key==='car'){state.inCar=!state.inCar;if(state.inCar){player.visible=false;car.position.x=player.position.x;car.position.z=player.position.z;carSpeed=0;state.heat=Math.min(5,state.heat+.7);toast('GRAND THEFT AUTO',true);subtitle('You lifted a Greenwood. Keep it moving.',2);$('car-name').textContent='GREENWOOD';}else{state.inCar=false;player.visible=true;player.position.x=car.position.x+2;player.position.z=car.position.z;toast('You left the car.');}return;}
 if(key==='boss'){const e=nearby.enemy;e.aggro=true;toast('BRAWL! THE BOUNCER IS ON YOU.',true);return;}
 if(key==='fight'){attack(nearby.enemy);return;}
 if(key==='diner'){openShop('diner');return;}if(key==='apartment'){openShop('apartment');return;}if(key==='gym'){openShop('gym');return;}if(key==='club'){if(state.mission<5){toast('Bouncer: Not tonight, little man.',true);return;}toast('You step into the Red Room. The bouncer is waiting.',true);return;}if(key==='pawn'){openShop('pawn');}}
function openShop(type){state.shop=true;shopType=type;const config={diner:{title:'LUCKY STAR DINER',items:[['Burger','Hunger +35 · Health +8',12,'eat'],['Coffee','Energy +24',8,'coffee'],['Work a shift','Serve orders · earn $',0,'shift']]},apartment:{title:'VERONA MOTEL',items:[['Sleep until morning','Restore health & energy',0,'sleep'],['Take a shower','Hygiene +65',0,'shower'],['Pay rent','Keep a roof over your head',200,'rent']]},gym:{title:'IRON TEMPLE',items:[['Workout','Strength +2 · Energy -22',15,'workout'],['Protein shake','Hunger +12 · Energy +10',9,'shake']]},pawn:{title:'PAWN & GO',items:[['Steel pipe','Equip a heavy hitter',50,'pipe'],['Baseball bat','The neighborhood special',110,'bat'],['Sell junk','A mystery bag of cash',0,'sell']]}}[type];$('shop-title').textContent=config.title;$('shop-cash').textContent='$'+state.cash;const items=$('shop-items');items.innerHTML='';config.items.forEach((item,i)=>{const b=document.createElement('button');b.className='shop-item';b.type='button';b.innerHTML=`<span class="item-name">${i+1}. ${item[0]}<small>${item[1]}</small></span><span class="price">${item[2]?'$'+item[2]:'FREE'}</span>`;b.onclick=()=>shopAction(item[3],item[2]);items.appendChild(b);});$('shop').classList.remove('hidden');document.exitPointerLock?.();}
function closeShop(){state.shop=false;$('shop').classList.add('hidden');}
function shopAction(action,cost){if(state.cash<cost){toast('Not enough cash.',true);return;}if(cost)state.cash-=cost;
 if(action==='eat'){state.hunger=Math.min(100,state.hunger+35);state.health=Math.min(100,state.health+8);toast('Burger down. You feel more human.');closeShop();if(state.mission===0)completeMission(30,'Next: find rent money.');return;}
 if(action==='coffee'){state.energy=Math.min(100,state.energy+24);state.hunger=Math.max(0,state.hunger-4);toast('Coffee: +energy, -sleep.');}
 if(action==='shift'){closeShop();startShift();return;}
 if(action==='sleep'){state.energy=100;state.health=Math.min(100,state.health+35);state.hunger=Math.max(0,state.hunger-18);state.hygiene=Math.max(0,state.hygiene-14);state.time=7.5;state.day++;toast('Eight hours later… mostly rested.');}
 if(action==='shower'){state.hygiene=Math.min(100,state.hygiene+65);toast('Clean enough to face the city.');}
 if(action==='rent'){toast('Rent paid. The motel manager nods.');if(state.mission===1)completeMission(40,'Next: make friends with the neighborhood.');}
 if(action==='workout'){state.energy=Math.max(0,state.energy-22);state.hunger=Math.max(0,state.hunger-8);state.strength=Math.min(34,state.strength+2);state.health=Math.min(100,state.health+4);toast('Iron sharpens iron. Strength up.');if(state.mission===4)completeMission(65,'Next: visit the Red Room.');}
 if(action==='shake'){state.hunger=Math.min(100,state.hunger+12);state.energy=Math.min(100,state.energy+10);}
 if(action==='pipe'){state.weapon=1;toast('Steel pipe equipped.');}
 if(action==='bat'){state.weapon=2;toast('Baseball bat equipped.');}
 if(action==='sell'){state.cash+=Math.floor(10+Math.random()*26);toast('You sold a mystery bag.');}
 $('shop-cash').textContent='$'+state.cash;updateHud();if(action==='pipe'||action==='bat'||action==='rent'||action==='sleep'||action==='shower'||action==='workout'||action==='shake'||action==='sell')openShop(shopType);
}
const orderNames=['BURGER','FRIES','SODA'];
function nextOrder(){shiftOrder=orderNames[Math.floor(Math.random()*orderNames.length)].toLowerCase();$('shift-order').textContent=shiftOrder.toUpperCase();$('shift-customer').textContent=['🧍','👩','🧔','👨‍🦱'][Math.floor(Math.random()*4)];}
function startShift(){state.shift=true;shiftTime=30;shiftServed=0;shiftTips=0;nextOrder();$('shift-served').textContent='0';$('shift-tips').textContent='$0';$('shift').classList.remove('hidden');document.exitPointerLock?.();}
function serve(order){if(!state.shift)return;if(order===shiftOrder){shiftServed++;shiftTips+=8+Math.floor(Math.random()*8);$('shift-served').textContent=shiftServed;$('shift-tips').textContent='$'+shiftTips;nextOrder();}else{shiftTips=Math.max(0,shiftTips-4);$('shift-tips').textContent='$'+shiftTips;toast('Wrong order! Tip jar took a hit.',true);}}
function finishShift(){state.shift=false;$('shift').classList.add('hidden');state.cash+=shiftTips+20;state.shifts++;state.energy=Math.max(0,state.energy-12);toast(`Shift over. $${shiftTips+20} earned.`);if(state.mission===3&&shiftServed>=5)completeMission(80,'Next: build yourself up at the gym.');else if(state.mission===3)toast('Serve at least 5 orders to clear the mission.');}
function attack(target){if(attackCooldown>0||!target||!target.alive)return;attackCooldown=.58;const range=state.weapon===0?2.45:3.1;const d=target.g.position.distanceTo(player.position);if(d>range){toast('Out of reach.',true);return;}const toward=new THREE.Vector3().subVectors(target.g.position,player.position).normalize();if(toward.dot(new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)))<-.25){toast('Turn toward your target.',true);return;}
 const damage=(state.weapon===0?1:state.weapon===1?2:3)+(state.strength>20?1:0);target.hp-=damage;target.aggro=true;target.hit=.28;target.g.position.add(toward.multiplyScalar(.72));target.g.rotation.y=yaw+Math.PI;state.energy=Math.max(0,state.energy-1.6);if(target.hp<=0){target.alive=false;target.down=0;state.kills++;if(target.kind==='boss'){state.cash+=90;toast('BOUNCER DOWN. The Red Room is yours.',false);if(state.mission===5)completeMission(180,'You own this block.');}else{const reward=18+Math.floor(Math.random()*20);state.cash+=reward;toast(`Thug down. +$${reward}`);if(state.mission===2&&state.kills>=3)completeMission(60,'Next: get a shift at the diner.');}if(Math.random()<.45)state.heat=Math.min(5,state.heat+.6);}else{state.heat=Math.min(5,state.heat+.16);}
}
function playerDamage(amount){state.health=Math.max(0,state.health-amount);$('flash').style.opacity='.18';setTimeout(()=>$('flash').style.opacity='0',110);if(state.health<=0&&!state.dead){state.dead=true;state.paused=true;document.exitPointerLock?.();$('wasted').classList.remove('hidden');$('wasted-sub').textContent='You wake up at the motel, $40 lighter.';}}
function respawn(){state.dead=false;state.paused=false;state.health=65;state.energy=Math.max(30,state.energy);state.cash=Math.max(0,state.cash-40);state.heat=Math.max(0,state.heat-1);player.position.set(0,0,4);player.visible=true;state.inCar=false;$('wasted').classList.add('hidden');toast('You made it back to Verona Heights.');}
function buildMini(){const c=$('minimap'),ctx=c.getContext('2d');ctx.clearRect(0,0,360,360);ctx.fillStyle='#15111d';ctx.fillRect(0,0,360,360);ctx.strokeStyle='#4b4653';ctx.lineWidth=19;for(let i=0;i<360;i+=80){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,360);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(360,i);ctx.stroke();}const sx=x=>180+(x-player.position.x)*3,sy=z=>180+(z-player.position.z)*3;for(const m of Object.values(markers)){ctx.fillStyle=m.light.color.getHexString().replace(/^/,'#');ctx.beginPath();ctx.arc(sx(m.x),sy(m.z),7,0,Math.PI*2);ctx.fill();}for(const e of enemies)if(e.alive){ctx.fillStyle=e.aggro?'#ff3656':'#b9a2c6';ctx.fillRect(sx(e.g.position.x)-3,sy(e.g.position.z)-3,6,6);}ctx.fillStyle='#4de6ec';ctx.beginPath();ctx.arc(180,180,6,0,7);ctx.fill();ctx.strokeStyle='#4de6ec';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(180,180);ctx.lineTo(180+Math.sin(yaw)*14,180+Math.cos(yaw)*14);ctx.stroke();}
// controls, camera, collision, and gameplay loop
let pointerLocked=false;const isTouch=('ontouchstart'in window)||navigator.maxTouchPoints>0;let touchMove={x:0,y:0},touchAttack=false,touchRun=false;
function startGame(){state.active=true;$('title').classList.add('hidden');$('help').classList.add('hidden');$('hud').classList.remove('hidden');$('touch').classList.toggle('hidden',!isTouch);$('loading').style.opacity='0';setTimeout(()=>$('loading').classList.add('hidden'),700);updateObjective();updateHud();if(!isTouch)$('game').requestPointerLock?.();toast('Welcome to Verona Heights. Try not to get wasted.');}
function togglePause(){if(!state.active||state.shop||state.shift||state.dead||missionOverlay)return;state.paused=!state.paused;$('pause').classList.toggle('hidden',!state.paused);if(state.paused){$('pause-stats').textContent=`$${state.cash} CASH · ${state.kills} KOs · ${state.shifts} SHIFTS · DAY ${state.day}`;document.exitPointerLock?.();}else if(!isTouch)$('game').requestPointerLock?.();}
function clampWorld(p){p.x=Math.max(-44,Math.min(44,p.x));p.z=Math.max(-44,Math.min(44,p.z));}
function blocked(x,z){for(const b of buildings){if(Math.abs(x-b.x)<b.w/2+.5&&Math.abs(z-b.z)<b.d/2+.5)return true;}return false;}
function movePerson(dt){let ix=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchMove.x;let iz=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0)+touchMove.y;const len=Math.hypot(ix,iz);if(len>1){ix/=len;iz/=len;}const fast=keys.has('ShiftLeft')||keys.has('ShiftRight')||touchRun;const tired=state.energy<5?.65:1;const speed=(fast?7:4.2)*tired;const fx=Math.sin(yaw),fz=Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);const dx=(rx*ix+fx*iz)*speed*dt,dz=(rz*ix+fz*iz)*speed*dt;const nx=player.position.x+dx,nz=player.position.z+dz;if(!blocked(nx,player.position.z))player.position.x=nx;if(!blocked(player.position.x,nz))player.position.z=nz;clampWorld(player.position);if(len>.08){player.rotation.y=Math.atan2(dx,dz);if(fast)state.energy=Math.max(0,state.energy-dt*1.5);}player.position.y=Math.max(0,player.position.y-dt*2);}
function drive(dt){const gas=keys.has('KeyW')?1:0,brake=keys.has('KeyS')?1:0,steer=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);carSpeed+=gas*dt*5-brake*dt*7;carSpeed*=Math.pow(.985,dt*60);if(keys.has('Space'))carSpeed*=Math.pow(.91,dt*60);carSpeed=THREE.MathUtils.clamp(carSpeed,-.35,1.55);car.rotation.y-=steer*dt*(.65+Math.abs(carSpeed)*.4)*Math.sign(carSpeed||1);const next=car.position.clone();next.x+=Math.sin(car.rotation.y)*carSpeed*dt*7;next.z+=Math.cos(car.rotation.y)*carSpeed*dt*7;if(!blocked(next.x,next.z)){car.position.x=next.x;car.position.z=next.z;}else carSpeed*=-.35;clampWorld(car.position);player.position.copy(car.position);player.rotation.y=car.rotation.y;if(Math.abs(carSpeed)>.2&&Math.random()<dt*.55)state.heat=Math.min(5,state.heat+.006);}
function updateNPC(dt){for(const e of enemies){if(!e.alive)continue;const g=e.g,d=Math.hypot(player.position.x-g.position.x,player.position.z-g.position.z);if(!e.aggro&&d<4&&state.heat>1)e.aggro=true;if(e.kind==='boss'&&d<4&&state.mission>=5)e.aggro=true;if(e.aggro&&d<13&&!state.inCar){const angle=Math.atan2(player.position.x-g.position.x,player.position.z-g.position.z);g.rotation.y=angle;if(d>1.55){g.position.x+=Math.sin(angle)*dt*(e.kind==='boss'?2.4:2);g.position.z+=Math.cos(angle)*dt*(e.kind==='boss'?2.4:2);}else{e.hit-=dt;if(e.hit<=0){e.hit=e.kind==='boss'?1.0:1.3;playerDamage(e.kind==='boss'?11:7);}}}else{e.walk+=dt;const angle=Math.atan2(Math.sin(e.walk*.3+e.seed[0]),Math.cos(e.walk*.25+e.seed[1]));g.rotation.y=angle;g.position.x=e.seed[0]+Math.sin(e.walk*.35)*1.5;g.position.z=e.seed[1]+Math.cos(e.walk*.25)*1.4;}g.position.y=e.hit>0?.05:0;}
 for(const c of civilians){c.walk+=dt*.15;c.g.position.x=c.seed[0]+Math.sin(c.walk)*1.4;c.g.position.z=c.seed[1]+Math.cos(c.walk*.8)*1.2;c.g.rotation.y=Math.atan2(Math.cos(c.walk),-Math.sin(c.walk));}
}
function updateCamera(dt){const target=state.inCar?car.position:player.position;const distance=state.inCar?9:7.3;const height=state.inCar?4.7:4.1;const cx=target.x-Math.sin(yaw)*distance,cz=target.z-Math.cos(yaw)*distance;const desired=new THREE.Vector3(cx,target.y+height-pitch*2,cz);camera.position.lerp(desired,1-Math.pow(.001,dt));camera.lookAt(target.x,target.y+(state.inCar?1.2:1.65),target.z);}
function updateNeeds(dt){if(!state.active||state.paused||state.shop||state.shift||state.dead)return;state.time+=dt*.035;if(state.time>=24){state.time-=24;state.day++;}state.hunger=Math.max(0,state.hunger-dt*.17);state.hygiene=Math.max(0,state.hygiene-dt*.055);if(!state.inCar)state.energy=Math.max(0,state.energy-dt*(keys.has('ShiftLeft')?0.17:.035));if(state.hunger<15){state.health=Math.max(0,state.health-dt*.55);}if(state.hygiene<10&&Math.random()<dt*.08)toast('You could use a shower.');if(state.heat>0){const inSight=enemies.some(e=>e.alive&&e.aggro&&e.g.position.distanceTo(player.position)<12);if(!inSight)state.heat=Math.max(0,state.heat-dt*.045);}if(state.heat>=3&&Math.random()<dt*.015)subtitle('Police radio: suspect last seen near Verona Heights.',2);if(state.health<=0&&!state.dead)playerDamage(100);}
function updateGame(dt){if(!state.active)return;if(!state.paused&&!state.shop&&!state.shift&&!state.dead&&!missionOverlay){if(state.inCar)drive(dt);else movePerson(dt);updateNPC(dt);attackCooldown=Math.max(0,attackCooldown-dt);if(touchAttack){touchAttack=false;const t=enemies.filter(e=>e.alive).sort((a,b)=>a.g.position.distanceTo(player.position)-b.g.position.distanceTo(player.position))[0];if(t)attack(t);}updateNeeds(dt);chooseInteraction();}if(state.shift){shiftTime-=dt;$('shift-timer').textContent=Math.max(0,shiftTime).toFixed(1);if(shiftTime<=0)finishShift();}if(subtitleTimer>0){subtitleTimer-=dt;if(subtitleTimer<=0)$('subtitle').classList.add('hidden');}updateCamera(dt);updateHud();buildMini();renderer.render(scene,camera);}
function frame(now){const dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;updateGame(dt);requestAnimationFrame(frame);}requestAnimationFrame(frame);
// input and interface wiring
$('btn-play').addEventListener('click',startGame);
$('btn-help').addEventListener('click',()=>{$('title').classList.add('hidden');$('help').classList.remove('hidden');});
$('btn-help-close').addEventListener('click',()=>{if(state.active){$('help').classList.add('hidden');}else{$('help').classList.add('hidden');$('title').classList.remove('hidden');}});
$('btn-resume').addEventListener('click',togglePause);
$('btn-restart').addEventListener('click',()=>{localStorage.removeItem(state.saveKey);location.reload();});
$('btn-save').addEventListener('click',()=>{const save={cash:state.cash,health:state.health,energy:state.energy,hunger:state.hunger,hygiene:state.hygiene,strength:state.strength,heat:state.heat,day:state.day,time:state.time,weapon:state.weapon,kills:state.kills,shifts:state.shifts,mission:state.mission,x:player.position.x,z:player.position.z};localStorage.setItem(state.saveKey,JSON.stringify(save));toast('Game saved.');});
$('btn-mc').addEventListener('click',advanceMission);
$('btn-wasted').addEventListener('click',respawn);
$('btn-ending').addEventListener('click',()=>{$('ending').classList.add('hidden');state.mission=missions.length;updateObjective();});
$('shop-close').addEventListener('click',closeShop);
document.querySelectorAll('[data-order]').forEach(b=>b.addEventListener('click',()=>serve(b.dataset.order)));
$('game').addEventListener('click',()=>{if(!isTouch&&state.active&&!state.paused&&!state.shop&&!state.shift&&!state.dead&&!missionOverlay){if(document.pointerLockElement!==$('game'))$('game').requestPointerLock?.();else if(!state.inCar){const t=enemies.filter(e=>e.alive).sort((a,b)=>a.g.position.distanceTo(player.position)-b.g.position.distanceTo(player.position))[0];if(t)attack(t);}}});
document.addEventListener('pointerlockchange',()=>{pointerLocked=document.pointerLockElement===$('game');});
document.addEventListener('mousemove',e=>{if(pointerLocked&&!state.paused){yaw-=e.movementX*.0024;pitch=THREE.MathUtils.clamp(pitch+e.movementY*.0018,-.4,.75);}});
document.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;
 if(e.code==='Escape'){if(state.shift){finishShift();return;}if(state.shop){closeShop();return;}if($('help').classList.contains('hidden')===false){$('help').classList.add('hidden');if(!state.active)$('title').classList.remove('hidden');return;}if(missionOverlay)return;togglePause();return;}
 if(state.shop){if(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit3')$('shop-items').children[Number(e.code.slice(-1))-1]?.click();return;}
 if(state.shift){if(e.code==='Digit1')serve('burger');if(e.code==='Digit2')serve('fries');if(e.code==='Digit3')serve('soda');return;}
 if(state.paused){if(e.code==='KeyH'){$('pause').classList.add('hidden');$('help').classList.remove('hidden');}return;}
 if(e.code==='KeyE'&&state.active)interact();if(e.code==='KeyQ'&&state.active){state.weapon=(state.weapon+1)%3;toast(['Fists','Steel pipe','Baseball bat'][state.weapon]+' equipped.');}
 if(e.code==='KeyM'){state.muted=!state.muted;toast(state.muted?'Audio muted.':'Audio on.');}
 if(e.code==='KeyH'&&state.active){$('pause').classList.add('hidden');$('help').classList.remove('hidden');}
 if(e.code==='Space'&&state.active&&!state.inCar){if(player.position.y<.03)player.userData.jump=5.1;}
});
document.addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('wheel',e=>{if(state.active&&!state.shop&&!state.shift){state.weapon=(state.weapon+(e.deltaY>0?1:2))%3;updateHud();}},{passive:true});
// Add a small jump arc without introducing another movement mode.
const movePersonBase=movePerson;
movePerson=function(dt){movePersonBase(dt);if(player.userData.jump){player.position.y+=player.userData.jump*dt;player.userData.jump-=12*dt;if(player.position.y<=0){player.position.y=0;player.userData.jump=0;}}};
// Touch joystick, look swipe, and action buttons.
const stickZone=$('stick-zone'),knob=$('stick-knob');let stickId=null,lookId=null,lastLook={x:0,y:0};
stickZone.addEventListener('pointerdown',e=>{stickId=e.pointerId;stickZone.setPointerCapture(e.pointerId);});
stickZone.addEventListener('pointermove',e=>{if(stickId!==e.pointerId)return;const r=$('stick').getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=38,len=Math.hypot(dx,dy),k=len>max?max/len:1;touchMove={x:dx*k/max,y:dy*k/max};knob.style.transform=`translate(${dx*k}px,${dy*k}px)`;});
function releaseStick(e){if(stickId!==e.pointerId)return;stickId=null;touchMove={x:0,y:0};knob.style.transform='';}stickZone.addEventListener('pointerup',releaseStick);stickZone.addEventListener('pointercancel',releaseStick);
$('look-zone').addEventListener('pointerdown',e=>{lookId=e.pointerId;lastLook={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);});
$('look-zone').addEventListener('pointermove',e=>{if(lookId!==e.pointerId)return;yaw-=(e.clientX-lastLook.x)*.008;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastLook.y)*.006,-.4,.75);lastLook={x:e.clientX,y:e.clientY};});
$('look-zone').addEventListener('pointerup',e=>{if(lookId===e.pointerId)lookId=null;});
$('t-attack').addEventListener('pointerdown',e=>{e.preventDefault();touchAttack=true;});
$('t-interact').addEventListener('click',()=>interact());
$('t-sprint').addEventListener('pointerdown',()=>touchRun=true);$('t-sprint').addEventListener('pointerup',()=>touchRun=false);$('t-sprint').addEventListener('pointercancel',()=>touchRun=false);
$('t-weapon').addEventListener('click',()=>{state.weapon=(state.weapon+1)%3;updateHud();});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));});
// Restore a local save when available; the title screen remains the entry point.
try{const save=JSON.parse(localStorage.getItem(state.saveKey)||'null');if(save){for(const k of ['cash','health','energy','hunger','hygiene','strength','heat','day','time','weapon','kills','shifts','mission'])if(Number.isFinite(save[k]))state[k]=save[k];if(Number.isFinite(save.x))player.position.x=save.x;if(Number.isFinite(save.z))player.position.z=save.z;updateObjective();}}catch{}
// Draw a rendered city behind the title card too.
renderer.render(scene,camera);

