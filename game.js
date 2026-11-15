(() => {
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const state = {
    size: 15, player: {x: 7, y: 7}, inv: {wood: 0, stone: 0, crystal: 0, fiber: 0},
    day: 1, minutes: 8 * 60 + 24, selected: 0, hasAxe: false, hasTorch: false,
    beacon: false, camp: false, toastTimer: 0, moveTimer: 0, target: null, sound: true, seed: 414,
    objects: [], tiles: [], screenObjects: [], particles: [], lastTime: 0, time: 0
  };
  const recipes = {
    beacon: {cost:{wood:8,stone:6,crystal:3}}, axe:{cost:{wood:3,stone:2}},
    camp:{cost:{wood:2,fiber:2}}, torch:{cost:{wood:1,fiber:2}}
  };
  const names = {wood:'softwood',stone:'stone',crystal:'star crystal',fiber:'wild fiber'};
  const keyMap = {KeyW:[0,-1],ArrowUp:[0,-1],KeyS:[0,1],ArrowDown:[0,1],KeyA:[-1,0],ArrowLeft:[-1,0],KeyD:[1,0],ArrowRight:[1,0]};
  let width = 900, height = 650, dpr = 1;

  function rand(){ state.seed=(state.seed*1664525+1013904223)>>>0; return state.seed/4294967296; }
  function inside(x,y){ return x>=0&&y>=0&&x<state.size&&y<state.size; }
  function land(x,y){ const dx=(x-7)/7.6,dy=(y-7)/7.4; return dx*dx+dy*dy<1.04 && !(x<1||y<1||x>13||y>13); }
  function load(){
    try {const saved=JSON.parse(localStorage.getItem('polygon-wild-save')); if(saved&&saved.inv){Object.assign(state.inv,saved.inv);state.day=saved.day||1;state.beacon=!!saved.beacon;state.hasAxe=!!saved.hasAxe;state.hasTorch=!!saved.hasTorch;state.camp=!!saved.camp; if(saved.player){state.player.x=saved.player.x;state.player.y=saved.player.y;}}}catch(_){ }
  }
  function save(){try{localStorage.setItem('polygon-wild-save',JSON.stringify({inv:state.inv,day:state.day,beacon:state.beacon,hasAxe:state.hasAxe,hasTorch:state.hasTorch,camp:state.camp,player:state.player}));}catch(_){}}
  function makeWorld(){
    state.tiles=[];state.objects=[];state.seed=414;
    for(let y=0;y<state.size;y++) for(let x=0;x<state.size;x++){
      if(!land(x,y))continue;
      const edge=((x-7)/7.4)**2+((y-7)/7.3)**2>.79;
      const r=rand(); let kind=r>.86?'moss':r>.69?'light':r>.48?'mid':'dark';
      state.tiles.push({x,y,kind,edge,phase:rand()*6.28});
      if((x===7&&y===7)||(x===7&&y===6))continue;
      const border=Math.min(x,y,14-x,14-y);
      if(border<2)continue;
      let type=null;
      if(r>.88) type='crystal';
      else if(r>.76) type='rock';
      else if(r>.55) type='tree';
      else if(r>.39) type='pine';
      else if(r>.25) type='bush';
      if(type) state.objects.push({x,y,type,alive:true,sway:rand()*6.28});
    }
    // Guarantee a welcoming mix close to spawn and the materials needed for the beacon.
    const reserved=[[7,6],[7,7],[6,7],[8,7],[7,8],[6,6],[8,6],[6,8],[8,8],[5,7],[9,7],[7,5]];
    state.objects=state.objects.filter(o=>!reserved.some(p=>p[0]===o.x&&p[1]===o.y));
    [[5,6,'tree'],[9,6,'tree'],[5,8,'pine'],[9,8,'rock'],[6,5,'rock'],[8,5,'crystal'],[5,5,'bush'],[9,5,'tree'],[4,7,'crystal'],[10,7,'rock'],[6,9,'bush'],[8,9,'tree'],[7,4,'pine'],[4,9,'tree'],[10,9,'pine'],[4,5,'rock']].forEach(([x,y,type])=>state.objects.push({x,y,type,alive:true,sway:rand()*6.28}));
  }
  function resize(){const rect=canvas.getBoundingClientRect(); if(!rect.width||!rect.height)return; dpr=Math.min(window.devicePixelRatio||1,2);width=rect.width;height=rect.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  function project(x,y,z=0){const tw=Math.max(36,Math.min(58,width/15));const th=tw*.5;return {x:width/2+(x-state.player.x-y+state.player.y)*tw/2,y:height/2+(x-state.player.x+y-state.player.y)*th/2-z,tw,th};}
  function poly(points,fill,stroke=null,line=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}}
  function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  const palettes={dark:['#9ab982','#80a76f','#779d69'],mid:['#a4c28a','#8db679','#82a970'],light:['#b5cb90','#9cbd7d','#8caf70'],moss:['#abc18a','#8fac70','#7e9f65']};
  function drawWater(){
    const g=ctx.createLinearGradient(0,0,width,height);g.addColorStop(0,'#c7dfd7');g.addColorStop(.52,'#b7d5ce');g.addColorStop(1,'#a8cdc6');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    // soft far-water glints
    for(let i=0;i<34;i++){const x=((i*137+37)%Math.max(width,1)),y=((i*83+21)%Math.max(height,1));ctx.globalAlpha=.12+((i%3)*.035);ctx.strokeStyle='#f4f4d9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+8+(i%5)*3,y-2);ctx.stroke();}ctx.globalAlpha=1;
    const cx=width/2,cy=height/2+15,rx=Math.min(width*.47,440),ry=Math.min(height*.49,340);
    ctx.save();ctx.translate(cx,cy);ctx.scale(1,.54);ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fillStyle='rgba(69,113,102,.14)';ctx.fill();ctx.restore();
  }
  function drawTile(t){
    const p=project(t.x,t.y),w=p.tw/2,h=p.th/2;const top=[{x:p.x,y:p.y-h},{x:p.x+w,y:p.y},{x:p.x,y:p.y+h},{x:p.x-w,y:p.y}];
    const colors=palettes[t.kind];
    if(t.edge){poly([{x:p.x-w,y:p.y},{x:p.x,y:p.y+h},{x:p.x+w,y:p.y},{x:p.x+w,y:p.y+7},{x:p.x,y:p.y+h+7},{x:p.x-w,y:p.y+7}],'#658b69');}
    poly([{x:p.x,y:p.y+h},{x:p.x+w,y:p.y},{x:p.x+w,y:p.y+5},{x:p.x,y:p.y+h+5}],colors[1]);
    poly([{x:p.x-w,y:p.y},{x:p.x,y:p.y+h},{x:p.x,y:p.y+h+5},{x:p.x-w,y:p.y+5}],colors[2]);
    poly(top,colors[0], 'rgba(255,255,255,.07)',.6);
    if((t.x*7+t.y*3)%9===0){ellipse(p.x-5,p.y-2,1.3,1,'rgba(239,236,190,.36)');ellipse(p.x+8,p.y+1,1,1,'rgba(87,133,81,.24)');}
    if(t.edge&&((t.x+t.y)%3===0)){ellipse(p.x+(t.x%2?7:-8),p.y,3,1.5,'#aacb8b');}
  }
  function drawTree(o,p){
    const bob=Math.sin(state.time*1.1+o.sway)*1.3;ellipse(p.x+2,p.y+2,13,5,'rgba(43,65,46,.18)');
    poly([{x:p.x-3,y:p.y-2},{x:p.x+4,y:p.y-2},{x:p.x+4,y:p.y-24},{x:p.x-3,y:p.y-24}],'#896744');
    const cx=p.x,cy=p.y-35+bob;
    if(o.type==='pine'){
      poly([{x:cx, y:cy-31},{x:cx+17,y:cy-2},{x:cx+8,y:cy+1},{x:cx+14,y:cy+10},{x:cx-14,y:cy+10},{x:cx-8,y:cy+1},{x:cx-17,y:cy-2}], '#4f8257');
      poly([{x:cx, y:cy-31},{x:cx-17,y:cy-2},{x:cx-8,y:cy+1},{x:cx-14,y:cy+10},{x:cx,y:cy+10}], '#699d62');
      poly([{x:cx,y:cy-31},{x:cx+17,y:cy-2},{x:cx+8,y:cy+1},{x:cx,y:cy+1}], '#83ad69');
    }else{
      ellipse(cx+3,cy+1,18,14,'#527d52');ellipse(cx-5,cy-7,14,13,'#6f995f');ellipse(cx+7,cy-12,12,12,'#8eae6d');ellipse(cx-9,cy-1,9,10,'#80a864');
      ellipse(cx-8,cy-8,2,2,'rgba(222,232,164,.48)');ellipse(cx+5,cy-17,2,2,'rgba(225,234,170,.42)');
    }
    o.hit={x:p.x,y:p.y-24,r:22};
  }
  function drawRock(o,p){
    ellipse(p.x+1,p.y+1,13,5,'rgba(44,63,56,.19)');
    poly([{x:p.x-13,y:p.y-4},{x:p.x-9,y:p.y-15},{x:p.x-2,y:p.y-19},{x:p.x+8,y:p.y-16},{x:p.x+14,y:p.y-6},{x:p.x+10,y:p.y},{x:p.x-9,y:p.y}], '#82938d');
    poly([{x:p.x-13,y:p.y-4},{x:p.x-9,y:p.y-15},{x:p.x-2,y:p.y-19},{x:p.x+1,y:p.y-8},{x:p.x-4,y:p.y}], '#a9b5a8');
    poly([{x:p.x+1,y:p.y-8},{x:p.x-2,y:p.y-19},{x:p.x+8,y:p.y-16},{x:p.x+14,y:p.y-6},{x:p.x+10,y:p.y}], '#738780');
    o.hit={x:p.x,y:p.y-10,r:20};
  }
  function drawCrystal(o,p){
    ellipse(p.x,p.y,13,4,'rgba(49,83,75,.16)');
    poly([{x:p.x,y:p.y-26},{x:p.x+9,y:p.y-15},{x:p.x+6,y:p.y-2},{x:p.x-5,y:p.y-2},{x:p.x-9,y:p.y-15}], '#58b2a7');
    poly([{x:p.x,y:p.y-26},{x:p.x-9,y:p.y-15},{x:p.x-3,y:p.y-12}], '#b1ebe0');
    poly([{x:p.x,y:p.y-26},{x:p.x+9,y:p.y-15},{x:p.x+2,y:p.y-11}], '#7bd5c7');
    poly([{x:p.x-3,y:p.y-12},{x:p.x+6,y:p.y-2},{x:p.x-5,y:p.y-2}], '#439b92');
    ctx.globalAlpha=.25+.12*Math.sin(state.time*2+o.sway);ellipse(p.x,p.y-15,17,14,'#9be6d6');ctx.globalAlpha=1;o.hit={x:p.x,y:p.y-14,r:20};
  }
  function drawBush(o,p){
    ellipse(p.x,p.y+1,13,5,'rgba(46,66,43,.16)');ellipse(p.x-6,p.y-6,8,7,'#8cae63');ellipse(p.x+3,p.y-9,9,8,'#a4bc6c');ellipse(p.x+8,p.y-3,7,6,'#789b5a');
    for(let i=0;i<3;i++)ellipse(p.x-5+i*6,p.y-7+(i%2)*3,1.5,1.5,'#e1d78d');o.hit={x:p.x,y:p.y-5,r:18};
  }
  function drawObject(o){if(!o.alive)return;const p=project(o.x,o.y);if(o.type==='tree'||o.type==='pine')drawTree(o,p);else if(o.type==='rock')drawRock(o,p);else if(o.type==='crystal')drawCrystal(o,p);else drawBush(o,p);}
  function drawPlayer(){
    const p=project(state.player.x,state.player.y),bob=Math.abs(Math.sin(state.time*7))*(state.moving?2:0.6);ellipse(p.x,p.y+1,10,4,'rgba(37,54,45,.22)');
    // tiny polygon explorer, with a bright little cap
    poly([{x:p.x-7,y:p.y-12-bob},{x:p.x,y:p.y-16-bob},{x:p.x+7,y:p.y-12-bob},{x:p.x+7,y:p.y-3},{x:p.x,y:p.y+1},{x:p.x-7,y:p.y-3}], '#4b6f55');
    poly([{x:p.x-7,y:p.y-12-bob},{x:p.x,y:p.y-16-bob},{x:p.x,y:p.y-6},{x:p.x-7,y:p.y-3}], '#71925d');
    ellipse(p.x,p.y-18-bob,6,6,'#edc99d');ellipse(p.x,p.y-23-bob,7,3,'#e7b46b');poly([{x:p.x-7,y:p.y-24-bob},{x:p.x,y:p.y-28-bob},{x:p.x+6,y:p.y-24-bob},{x:p.x+4,y:p.y-22-bob},{x:p.x-7,y:p.y-22-bob}], '#66864f');
    ctx.fillStyle='#384e3c';ctx.fillRect(p.x+2,p.y-19-bob,1.4,1.4);
  }
  function drawBeacon(){const p=project(7,6);ellipse(p.x,p.y+1,18,5,'rgba(49,65,46,.16)');poly([{x:p.x-14,y:p.y-3},{x:p.x,y:p.y-10},{x:p.x+14,y:p.y-3},{x:p.x,y:p.y+4}], '#b2a77e');poly([{x:p.x-14,y:p.y-3},{x:p.x,y:p.y+4},{x:p.x,y:p.y+8},{x:p.x-14,y:p.y+1}], '#988b69');poly([{x:p.x,y:p.y+4},{x:p.x+14,y:p.y-3},{x:p.x+14,y:p.y+1},{x:p.x,y:p.y+8}], '#84785f');if(state.beacon){poly([{x:p.x-6,y:p.y-10},{x:p.x-4,y:p.y-24},{x:p.x,y:p.y-30},{x:p.x+4,y:p.y-24},{x:p.x+6,y:p.y-10}], '#a67c4e');ellipse(p.x,p.y-33,11,11,'rgba(250,220,136,.15)');poly([{x:p.x,y:p.y-47},{x:p.x+5,y:p.y-36},{x:p.x+1,y:p.y-28},{x:p.x-4,y:p.y-36}], '#ffe59a');}}
  function draw(){
    ctx.clearRect(0,0,width,height);drawWater();
    const visible=state.tiles.filter(t=>{const p=project(t.x,t.y);return p.x>-80&&p.x<width+80&&p.y>-120&&p.y<height+120;}).sort((a,b)=>(a.x+a.y)-(b.x+b.y));
    visible.forEach(drawTile);
    const actors=state.objects.filter(o=>o.alive).map(o=>({depth:o.x+o.y,draw:()=>drawObject(o)}));
    actors.push({depth:state.player.x+state.player.y,draw:drawPlayer});actors.push({depth:13,draw:drawBeacon});actors.sort((a,b)=>a.depth-b.depth).forEach(a=>a.draw());
    // occasional drifting pollen
    for(const q of state.particles){ctx.globalAlpha=q.life;ellipse(q.x,q.y,q.r,q.r,'#fff6b8');ctx.globalAlpha=1;}
  }
  function updateHUD(){
    $('woodTotal').textContent=state.inv.wood;$('stoneTotal').textContent=state.inv.stone;$('crystalTotal').textContent=state.inv.crystal;$('fiberTotal').textContent=state.inv.fiber;
    $('slotWood').textContent=state.inv.wood;$('slotStone').textContent=state.inv.stone;$('slotCrystal').textContent=state.inv.crystal;$('slotFiber').textContent=state.inv.fiber;
    $('woodNeed').textContent=`${Math.min(8,state.inv.wood)}/8`;$('stoneNeed').textContent=`${Math.min(6,state.inv.stone)}/6`;$('crystalNeed').textContent=`${Math.min(3,state.inv.crystal)}/3`;
    const score=Math.min(1,state.inv.wood/8,state.inv.stone/6,state.inv.crystal/3);$('questProgress').style.width=`${Math.max(0,score*100)}%`;
    $('questCount').textContent=state.beacon?'3 / 3':`${Math.min(3,Math.floor(score*3))} / 3`;
    const can=canCraft('beacon');$('beaconBtn').disabled=!can||state.beacon;$('beaconBtn').innerHTML=state.beacon?'BEACON IS LIT <span>✦</span>':can?'BUILD YOUR BEACON <span>↗</span>':'NEED MORE MATERIALS <span>↗</span>';
    $('axeBtn').textContent=state.hasAxe?'CRAFTED ✓':canCraft('axe')?'CRAFT':'NEED MATERIALS';$('axeBtn').disabled=state.hasAxe||!canCraft('axe');
    $('campBtn').textContent=state.camp?'CRAFTED ✓':canCraft('camp')?'CRAFT':'NEED MATERIALS';$('campBtn').disabled=state.camp||!canCraft('camp');
    $('torchBtn').textContent=state.hasTorch?'CRAFTED ✓':canCraft('torch')?'CRAFT':'NEED MATERIALS';$('torchBtn').disabled=state.hasTorch||!canCraft('torch');
    $('dayLabel').textContent=`DAY ${String(state.day).padStart(2,'0')}`;$('clockLabel').textContent=clockText();
    $('coordX').textContent=String(Math.round(state.player.x)+1).padStart(2,'0');$('coordY').textContent=String(Math.round(state.player.y)+1).padStart(2,'0');
    const dist=Math.abs(state.player.x-7)+Math.abs(state.player.y-6);$('locationLabel').textContent=state.beacon&&dist<3?'BEACON HILL':dist<3?'SUNLIT CLEARING':state.player.x<5?'MOSSY GROVE':state.player.x>9?'CRYSTAL SHORE':'THE LITTLE ISLES';
  }
  function clockText(){const h=Math.floor(state.minutes/60)%24,m=Math.floor(state.minutes%60);return `${String(h%12||12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
  function canCraft(which){const c=recipes[which].cost;return Object.keys(c).every(k=>state.inv[k]>=c[k]);}
  function showToast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove('show'),1900);}
  function spend(which){const c=recipes[which].cost;for(const k in c)state.inv[k]-=c[k];}
  function craft(which){if(which==='beacon'&&state.beacon){showToast('Your beacon is already shining.');return;}if((which==='axe'&&state.hasAxe)||(which==='camp'&&state.camp)||(which==='torch'&&state.hasTorch)){showToast('You already made one of those.');return;}if(!canCraft(which)){showToast('Not quite enough materials yet.');return;}spend(which);
    if(which==='beacon'){state.beacon=true;save();updateHUD();winModal();burst();return;}
    if(which==='axe')state.hasAxe=true;if(which==='camp')state.camp=true;if(which==='torch')state.hasTorch=true;showToast(which==='axe'?'Stone hatchet crafted — nice!':which==='camp'?'Camp marker crafted.':'Pocket torch crafted.');updateHUD();save();
  }
  function give(type,amount){state.inv[type]+=amount;updateHUD();save();const message=`+${amount} ${names[type]}`;showToast(message);if(Math.random()<.75){for(let i=0;i<5;i++)state.particles.push({x:width/2+(Math.random()-.5)*60,y:height/2-25+(Math.random()-.5)*25,life:1,r:1+Math.random()*1.2,vx:(Math.random()-.5)*.8,vy:-.4-Math.random()*.6});}}
  function targetYield(o){if(o.type==='tree')return ['wood',state.hasAxe?4:2];if(o.type==='pine')return ['wood',state.hasAxe?4:3];if(o.type==='rock')return ['stone',2];if(o.type==='crystal')return ['crystal',1];return ['fiber',2];}
  function gather(o){if(!o||!o.alive)return;const [kind,count]=targetYield(o);o.alive=false;give(kind,count);state.minutes+=3;if(kind==='crystal')$('fieldNote').textContent='Star crystals hum softly. The beacon must be close.';else if(kind==='wood')$('fieldNote').textContent='Good softwood. The old beacon will need a sturdy frame.';else if(kind==='stone')$('fieldNote').textContent='Solid stone — just right for a beacon foundation.';else $('fieldNote').textContent='Wild fiber is useful for all sorts of little things.';}
  function nearestAt(x,y,max=1.5){let best=null,bd=max;for(const o of state.objects){if(!o.alive)continue;const d=Math.hypot(o.x-x,o.y-y);if(d<bd){bd=d;best=o;}}return best;}
  function findCellAt(px,py){let best=null,dist=Infinity;for(const t of state.tiles){const p=project(t.x,t.y),dx=Math.abs(px-p.x),dy=Math.abs(py-(p.y-p.th/2));if(dx/(p.tw/2)+dy/(p.th/2)<1.07){const d=dx+dy;if(d<dist){dist=d;best=t;}}}return best;}
  function step(dx,dy){const nx=Math.round(state.player.x)+dx,ny=Math.round(state.player.y)+dy;if(!inside(nx,ny)||!land(nx,ny))return;state.player.x=nx;state.player.y=ny;state.minutes+=1;state.moving=true;updateHUD();const o=nearestAt(nx,ny,.76);if(o)gather(o);if(state.target&&Math.abs(state.target.x-nx)+Math.abs(state.target.y-ny)<=1){const obj=state.objects.find(q=>q.x===state.target.x&&q.y===state.target.y&&q.alive);if(obj)gather(obj);state.target=null;}save();}
  function interact(){const o=nearestAt(state.player.x,state.player.y,2.1);if(o){if(Math.hypot(o.x-state.player.x,o.y-state.player.y)<1.6)gather(o);else{state.target={x:o.x,y:o.y};moveToward(o);}return;}if(Math.abs(state.player.x-7)+Math.abs(state.player.y-6)<2){if(canCraft('beacon'))craft('beacon');else showToast('The old foundation is waiting for its beacon.');}else showToast('Nothing close by. Keep exploring.');}
  function moveToward(o){const dx=o.x-state.player.x,dy=o.y-state.player.y;if(Math.abs(dx)>Math.abs(dy))step(Math.sign(dx),0);else step(0,Math.sign(dy));}
  function clickWorld(e){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;let hit=null,dist=Infinity;for(const o of state.objects){if(!o.alive||!o.hit)continue;const d=Math.hypot(o.hit.x-x,o.hit.y-y);if(d<o.hit.r&&d<dist){hit=o;dist=d;}}
    if(hit){if(Math.hypot(hit.x-state.player.x,hit.y-state.player.y)<=2.1)gather(hit);else{state.target={x:hit.x,y:hit.y};showToast('Heading over to gather…');moveToward(hit);}return;}
    const cell=findCellAt(x,y);if(cell){const dx=cell.x-state.player.x,dy=cell.y-state.player.y;if(Math.abs(dx)+Math.abs(dy)===1)step(Math.sign(dx),Math.sign(dy));else if(Math.abs(dx)>Math.abs(dy))step(Math.sign(dx),0);else if(dy)step(0,Math.sign(dy));}
  }
  function winModal(){ $('modalTitle').textContent='You found your way home.';$('modalText').textContent='The beacon is glowing over the Little Isles. Your first little world is alive — keep exploring, gathering, and making it your own.';$('modalBackdrop').hidden=false;$('modalBackdrop').classList.add('victory');$('modalPlay').textContent='KEEP EXPLORING';}
  function burst(){for(let i=0;i<60;i++)state.particles.push({x:width/2+(Math.random()-.5)*190,y:height/2-20+(Math.random()-.5)*100,life:1,r:1.5+Math.random()*2,vx:(Math.random()-.5)*2,vy:-Math.random()*2});}
  function frame(now){const dt=Math.min(.05,(now-state.lastTime)/1000||0);state.lastTime=now;state.time+=dt;state.minutes+=dt*.48;if(state.minutes>=1440){state.minutes-=1440;state.day++;save();showToast(`Day ${state.day} on the Little Isles.`);}state.moving=false;
    if(state.target&&now-state.moveTimer>330){const o=state.objects.find(q=>q.x===state.target.x&&q.y===state.target.y&&q.alive);if(o&&Math.hypot(o.x-state.player.x,o.y-state.player.y)<=1.35){gather(o);state.target=null;}else if(o)moveToward(o);else state.target=null;state.moveTimer=now;}
    state.particles=state.particles.filter(p=>p.life>0);state.particles.forEach(p=>{p.life-=dt*.8;p.x+=p.vx;p.y+=p.vy;p.vy+=.012;});draw();requestAnimationFrame(frame);
  }
  document.addEventListener('keydown',e=>{if(keyMap[e.code]){e.preventDefault();step(...keyMap[e.code]);}else if(e.code==='Space'){e.preventDefault();interact();}else if(/^Digit[1-5]$/.test(e.code)){selectSlot(Number(e.code.slice(-1))-1);}});
  function selectSlot(n){state.selected=n;document.querySelectorAll('.slot').forEach((el,i)=>el.classList.toggle('selected',i===n));}
  document.querySelectorAll('.slot').forEach((el,i)=>el.addEventListener('click',()=>selectSlot(i)));
  canvas.addEventListener('click',clickWorld);canvas.addEventListener('keydown',e=>{if(keyMap[e.code]){e.preventDefault();step(...keyMap[e.code]);}});
  $('beaconBtn').addEventListener('click',()=>craft('beacon'));$('axeBtn').addEventListener('click',()=>craft('axe'));$('campBtn').addEventListener('click',()=>craft('camp'));$('torchBtn').addEventListener('click',()=>craft('torch'));
  document.querySelectorAll('.recipe-tab').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('.recipe-tab').forEach(t=>t.classList.toggle('active',t===tab));document.querySelectorAll('.recipe-card').forEach(card=>{card.hidden=tab.dataset.tab!=='all'&&card.dataset.category!==tab.dataset.tab;});}));
  $('helpBtn').addEventListener('click',()=>{$('modalTitle').textContent='A place to make your own.';$('modalText').textContent='Move around your little island, gather what you find, and bring the old beacon back to life. Gather 8 softwood, 6 stone, and 3 star crystals, then build your beacon at the workbench.';$('modalBackdrop').hidden=false;$('modalBackdrop').classList.remove('victory');$('modalPlay').textContent="GOT IT, LET'S GO";});
  $('modalClose').addEventListener('click',()=>{$('modalBackdrop').hidden=true;});$('modalPlay').addEventListener('click',()=>{$('modalBackdrop').hidden=true;});$('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))$('modalBackdrop').hidden=true;});
  $('mobileAction').addEventListener('click',interact);$('sortBtn').addEventListener('click',()=>showToast('Your backpack is looking tidy.'));$('journalBtn').addEventListener('click',()=>{$('modalTitle').textContent='Island journal';$('modalText').textContent=state.beacon?'The beacon is home again. You made a place from a handful of finds — the rest of the island is still yours to discover.':'A sun-warmed island, a quiet old foundation, and a few scattered resources. Gather 8 softwood, 6 stone, and 3 star crystals to light the beacon.';$('modalBackdrop').hidden=false;$('modalBackdrop').classList.remove('victory');$('modalPlay').textContent='BACK TO THE ISLAND';});
  $('soundBtn').addEventListener('click',()=>{state.sound=!state.sound;$('soundBtn').style.opacity=state.sound?'1':'.45';showToast(state.sound?'Island sounds on.':'Island sounds off.');});
  load();makeWorld();resize();window.addEventListener('resize',resize);updateHUD();if(!sessionStorage.getItem('polygon-wild-seen')){sessionStorage.setItem('polygon-wild-seen','1');setTimeout(()=>$('helpBtn').click(),450);}requestAnimationFrame(frame);
})();
