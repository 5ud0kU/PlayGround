(()=>{
'use strict';
const $=id=>document.getElementById(id), canvas=$('view'), ctx=canvas.getContext('2d',{alpha:true});
const ui={objective:$('objective'),progressText:$('progressText'),progressBar:$('progressBar'),location:$('locationLabel'),clock:$('clock'),weather:$('weather'),prompt:$('prompt'),toast:$('toast'),panel:$('panel'),panelTitle:$('panelTitle'),panelKicker:$('panelKicker'),panelContent:$('panelContent'),dialogue:$('dialogue'),start:$('startScreen'),ending:$('ending')};
const SAVE='gloamwood-save-';
const world={minute:22*60+17,day:17,weather:'COLD RAIN',events:[],publicTrust:54,sectPressure:0,days:1,autoTick:0,ending:null};
const player={x:6.25,y:10.1,angle:-Math.PI/2,health:86,stress:24,stamina:100,flashlight:true,inventory:['Field notebook','Camera','Evidence bags'],habits:{chapel:0,interviews:0,forensics:0,public:0},visited:[],steps:0};
const flags={sceneSecured:false,interviewedMara:false,interviewedJonah:false,analyzed:false,sectFound:false,warrant:false,secretFound:false,ending:null,trustMara:0,sealExplained:false};
const locations=[{id:'chapel',name:'OLD MERCY CHAPEL',x:6,y:6},{id:'diner',name:'THE NIGHTJAR DINER',x:12,y:12},{id:'station',name:'GLOAMWOOD POLICE',x:18,y:18},{id:'library',name:'COUNTY ARCHIVE',x:12,y:6},{id:'flats',name:'ASHDOWN COURT',x:6,y:18},{id:'market',name:'BELL & SONS MARKET',x:24,y:12},{id:'cemetery',name:'ST. ORAN CEMETERY',x:24,y:6},{id:'mill',name:'NORTH MILL',x:18,y:6},{id:'underpass',name:'CINDER UNDERPASS',x:18,y:12}];
const evidence=[
{id:'fiber',name:'Ivory wool fiber',type:'TRACE EVIDENCE',where:'Mercy chapel grounds',x:5.7,y:8.1,desc:'A single pale fiber, caught on the ironwork. The rain has not yet flattened it.',found:false,analyzed:false},
{id:'key',name:'Brass archive key',type:'PHYSICAL EVIDENCE',where:'Mercy chapel grounds',x:6.55,y:7.8,desc:'An old key stamped with a small sunburst. Its cut pattern is uncommon.',found:false,analyzed:false},
{id:'testament',name:'Torn prayer leaf',type:'DOCUMENT',where:'Mercy chapel grounds',x:6.2,y:7.2,desc:'A damp fragment in a careful hand: “When the last lamp gutters, the Witness will remember our names.”',found:false,analyzed:false},
{id:'register',name:'Burial register',type:'ARCHIVAL RECORD',where:'County archive',x:12.3,y:6.7,desc:'A 1978 ledger lists a second congregation beneath Old Mercy. Several pages are missing.',found:false,analyzed:false},
{id:'seal',name:'Choir seal',type:'CULT SYMBOL',where:'Old Mercy chapel',x:6.7,y:5.5,desc:'Three nested circles around an empty eye. The oldest stonework is worn smooth around it.',found:false,analyzed:false},
{id:'ledger',name:'Unlisted tithe ledger',type:'DOCUMENT',where:'Cinder underpass',x:18.5,y:12.6,desc:'Names, dates, and civic donations written in two inks. A police pension fund appears among them.',found:false,analyzed:false},
{id:'thread',name:'Blue coat thread',type:'TRACE EVIDENCE',where:'St. Oran cemetery',x:24.5,y:6.7,desc:'A dark blue thread snagged on a gate hinge. It matches no known uniform.',found:false,analyzed:false}
];
const persons=[
{id:'mara',name:'Mara Voss',role:'NIGHT SHIFT · WITNESS',x:12.8,y:12.4,kind:'witness',trust:44,met:false,memories:[],line:'I was closing up. The rain was so loud I nearly missed the church bell. Then it rang again, though the tower has no bell.'},
{id:'jonah',name:'Jonah Bell',role:'CHAPEL ARCHIVIST',x:7.1,y:5.8,kind:'killer',trust:65,met:false,memories:[],line:'People come here when they need a story to explain what happened. I keep the old books. That is all.'},
{id:'park',name:'Officer Lena Park',role:'GLOAMWOOD PD · EVIDENCE DESK',x:18.7,y:18.4,kind:'officer',trust:72,met:false,memories:[],line:'Scene is logged. If you have anything that needs a lab, bag it first. No shortcuts.'},
{id:'ellis',name:'Reverend Ellis',role:'PASTOR · OLD MERCY',x:6.9,y:6.2,kind:'pastor',trust:49,met:false,memories:[],line:'We call it the Lantern congregation. We keep a light for those who have lost their way.'}
];
const items=[
{id:'scene',name:'THE CHAPEL GROUNDS',x:6,y:8.55,kind:'scene',prompt:'[E] SECURE THE SCENE',desc:'A thin line of candles gutters in the rain. The place feels staged, but no one has disturbed the mud.'},
{id:'altar',name:'THE OLD CHAPEL DOOR',x:6,y:5.1,kind:'altar',prompt:'[E] EXAMINE CHAPEL',desc:'The door is swollen with age. In the stained glass, a figure has had its face carefully scraped away.'},
{id:'lab',name:'EVIDENCE INTAKE',x:18,y:18.9,kind:'lab',prompt:'[E] VISIT EVIDENCE INTAKE',desc:'A fluorescent room hums behind wired glass. Officer Park can request a rush analysis.'},
{id:'archive',name:'ARCHIVE READING ROOM',x:12,y:6.9,kind:'archive',prompt:'[E] SEARCH THE ARCHIVE',desc:'A microfilm reader clicks to life. The county has kept more than one version of its history.'},
{id:'under',name:'CINDER UNDERPASS',x:18,y:12.8,kind:'under',prompt:'[E] SEARCH THE UNDERPASS',desc:'Water ticks into a storm drain. A light below street level flickers, then steadies.'},
{id:'sleep',name:'MOTEL ROOM 9',x:24,y:18.8,kind:'rest',prompt:'[E] REST UNTIL MORNING',desc:'A tired roadside motel. A few hours of sleep could clear your head.'},
{id:'radio',name:'PATROL RADIO',x:18.2,y:18.1,kind:'radio',prompt:'[E] CHECK DISPATCH',desc:'The receiver spits static, then a voice says your badge number twice.'},
{id:'warrant',name:'CASE REVIEW DESK',x:18.5,y:19.2,kind:'warrant',prompt:'[E] REQUEST SEARCH WARRANT',desc:'The case is ready for a review with the duty prosecutor.'}
];
const SIZE=30;let grid=Array.from({length:SIZE},(_,y)=>Array.from({length:SIZE},(_,x)=>x<1||y<1||x>=SIZE-1||y>=SIZE-1?1:(x%6!==0&&y%6!==0?1+((x*7+y*13)%4===0?1:0):0)));
function openCell(x,y){if(x>=0&&y>=0&&x<SIZE&&y<SIZE)grid[y][x]=0}
locations.forEach(l=>{for(let y=l.y-1;y<=l.y+1;y++)for(let x=l.x-1;x<=l.x+1;x++)if(x%6===0||y%6===0||Math.abs(x-l.x)<=1&&Math.abs(y-l.y)<=1)openCell(x,y)});
const structures=[{x:7,y:6,c:1},{x:13,y:12,c:2},{x:19,y:18,c:3},{x:13,y:6,c:4},{x:7,y:18,c:5},{x:25,y:12,c:6},{x:25,y:6,c:7},{x:19,y:6,c:8},{x:19,y:12,c:9}];
structures.forEach(s=>{for(let y=s.y;y<s.y+2;y++)for(let x=s.x;x<s.x+2;x++)if(x<SIZE&&y<SIZE)grid[y][x]=s.c+10});
for(let y=8;y<=10;y++)for(let x=4;x<=8;x++)openCell(x,y);
[...items,...evidence,...persons].forEach(o=>openCell(Math.floor(o.x),Math.floor(o.y)));
const wallColors={1:'#333a35',2:'#493e37',3:'#474744',4:'#465044',5:'#3c4542',6:'#49423b',7:'#41493f',8:'#3a4342',9:'#484238',11:'#4b4540',12:'#605448',13:'#55534b',14:'#4a514b',15:'#4b4c42',16:'#535044',17:'#54514a',18:'#414b46',19:'#514a40'};
let w=0,h=0,pxRatio=1,keys={},nearest=null,activePanel='case',caseTab='evidence',currentPerson=null,last=performance.now(),toastTimer=0,mouseLook=0,dialogueChoice=0,touchMoveX=0,touchMoveY=0,touchRun=false,lookPointer=null,movePointer=null,zBuffer=[];const buffer=document.createElement('canvas'),bufferCtx=buffer.getContext('2d');
const sceneCanvas=$('scene');
let glReady=false,renderer=null,frameDt=1/60,viewHorizon=.49,bobPhase=0,bobAmt=0,prevPX=player.x,prevPY=player.y,lightning=0,nextFlash=5+Math.random()*5;
function resize(){pxRatio=Math.min(devicePixelRatio||1,1.35);w=canvas.width=Math.floor(innerWidth*pxRatio);h=canvas.height=Math.floor(innerHeight*pxRatio);if(glReady)renderer.resize(innerWidth,innerHeight,devicePixelRatio||1)}addEventListener('resize',resize);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function wallAt(x,y){if(x<0||y<0||x>=SIZE||y>=SIZE)return 1;return grid[Math.floor(y)][Math.floor(x)]}
function collides(x,y){return wallAt(x-.17,y-.17)>0||wallAt(x+.17,y-.17)>0||wallAt(x-.17,y+.17)>0||wallAt(x+.17,y+.17)>0}
renderer=window.GloamRenderer?window.GloamRenderer.create(sceneCanvas,{mapSize:SIZE,getCell:(x,y)=>wallAt(x,y)}):null;glReady=!!renderer;if(!glReady)sceneCanvas.style.display='none';resize();
const lampDefs=[
{x:6.0,y:9.25,radius:7.2,power:1.7,color:[1,.60,.28]},
{x:5.35,y:7.55,radius:5.2,power:1.15,color:[1,.64,.30]},
{x:6.65,y:5.55,radius:4.4,power:1.5,color:[1,.50,.20],flicker:true},
{x:12.35,y:13.35,radius:6.4,power:1.55,color:[1,.66,.34]},
{x:13.55,y:12.35,radius:5.2,power:1.25,color:[1,.20,.46]},
{x:18.65,y:19.45,radius:6.6,power:1.55,color:[.46,.66,1],mode:'police'},
{x:17.35,y:18.45,radius:4.5,power:1.0,color:[.54,.76,1]},
{x:12.55,y:5.45,radius:4.4,power:1.2,color:[.52,1,.82]},
{x:17.35,y:12.55,radius:5.6,power:1.5,color:[1,.40,.16],flicker:true},
{x:24.45,y:19.4,radius:5.2,power:1.35,color:[1,.26,.48]},
{x:24.4,y:11.45,radius:5.2,power:1.35,color:[1,.66,.34]},
{x:24.45,y:5.5,radius:5.4,power:1.25,color:[.58,.78,1]},
{x:18.45,y:5.5,radius:5.0,power:1.2,color:[.62,.82,1]},
{x:6.2,y:17.55,radius:5.4,power:1.35,color:[1,.54,.24]},
{x:12.4,y:7.55,radius:4.2,power:1.05,color:[.72,.9,1]},
{x:18.4,y:7.55,radius:4.4,power:1.15,color:[1,.62,.3]}
];
const lamps=lampDefs.map((l,i)=>Object.assign({},l,{phase:i*2.17}));
function visibleLights(t){return lamps.map(l=>{let power=l.power,color=l.color,radius=l.radius;if(l.mode==='police'){const red=Math.sin(t*5.1+l.phase)>0;color=red?[1,.14,.10]:[.18,.4,1];power*=red?1.5:1.25}else if(l.flicker){power*=.62+.38*(.5+.5*Math.sin(t*9.7+l.phase))*(.7+.3*Math.sin(t*23.3+l.phase*2))}else{power*=.94+.06*Math.sin(t*2.1+l.phase)}return{x:l.x,y:l.y,radius,power,color}}).sort((a,b)=>((a.x-player.x)**2+(a.y-player.y)**2)-((b.x-player.x)**2+(b.y-player.y)**2)).slice(0,8)}
function updateView(dt){const dx=player.x-prevPX,dy=player.y-prevPY,speed=Math.hypot(dx,dy)/Math.max(dt,.001);const target=Math.min(1,speed/2.2);bobAmt+=(target-bobAmt)*Math.min(1,dt*7);bobPhase+=dt*(4.2+speed*2.6);prevPX=player.x;prevPY=player.y;viewHorizon=.49+Math.sin(bobPhase)*.0032*bobAmt+Math.sin(bobPhase*2+.7)*.0012*bobAmt}
function updateStorm(t,dt){if(t>nextFlash){lightning=Math.max(lightning,.85);nextFlash=t+9+Math.random()*14}lightning=Math.max(0,lightning-dt*2.8)}
function updateSpriteDepth(){const res=Math.min(1024,Math.max(320,Math.round(w*.62)));zBuffer=new Float32Array(res);const dirX=Math.cos(player.angle),dirY=Math.sin(player.angle),planeX=-dirY*.66,planeY=dirX*.66;for(let x=0;x<res;x++){const cameraX=2*x/res-1,rayX=dirX+planeX*cameraX,rayY=dirY+planeY*cameraX;let mapX=Math.floor(player.x),mapY=Math.floor(player.y),deltaX=Math.abs(1/(rayX||.00001)),deltaY=Math.abs(1/(rayY||.00001)),stepX,stepY,sideX,sideY;if(rayX<0){stepX=-1;sideX=(player.x-mapX)*deltaX}else{stepX=1;sideX=(mapX+1-player.x)*deltaX}if(rayY<0){stepY=-1;sideY=(player.y-mapY)*deltaY}else{stepY=1;sideY=(mapY+1-player.y)*deltaY}let side=0,wall=1;for(let i=0;i<60;i++){if(sideX<sideY){sideX+=deltaX;mapX+=stepX;side=0}else{sideY+=deltaY;mapY+=stepY;side=1}wall=wallAt(mapX,mapY);if(wall)break}zBuffer[x]=Math.max(.16,side===0?sideX-deltaX:sideY-deltaY)}}
function draw(){const now=performance.now(),t=now*.001;updateView(frameDt);updateStorm(t,frameDt);if(glReady&&renderer.render({x:player.x,y:player.y,angle:player.angle,time:t,flashlight:player.flashlight,horizon:viewHorizon,lightning:lightning,lights:visibleLights(t)})){updateSpriteDepth();ctx.clearRect(0,0,w,h);drawSprites(t);drawAtmosphere(t);return}drawFallback()}
function say(text){ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),2600)}
function save(slot=0,quiet=false){try{const data={version:1,world,player,flags,evidence,persons,items};localStorage.setItem(SAVE+slot,JSON.stringify(data));localStorage.setItem(SAVE+'active',String(slot));if(!quiet)say(`FIELD NOTES SAVED · SLOT ${slot+1}`)}catch(e){if(!quiet)say('SAVE FAILED — STORAGE UNAVAILABLE')}}
function load(slot=0){try{const d=JSON.parse(localStorage.getItem(SAVE+slot)||'null');if(!d||d.version!==1)return false;Object.assign(world,d.world||{});Object.assign(player,d.player||{});Object.assign(flags,d.flags||{});for(const [arr,key] of [[evidence,'evidence'],[persons,'persons'],[items,'items']])for(const a of arr){const b=(d[key]||[]).find(x=>x.id===a.id);if(b)Object.assign(a,b)}return true}catch(e){return false}}
function nearestPlace(x=player.x,y=player.y){return locations.reduce((best,l)=>distance({x,y},l)<best.d?{l,d:distance({x,y},l)}:best,{l:locations[0],d:999}).l}
function objective(){let title,count=0;if(!flags.sceneSecured){title='Search the scene. The rain is washing away the night.';count=evidence.filter(e=>['fiber','key','testament'].includes(e.id)&&e.found).length;ui.location.textContent='OLD MERCY CHAPEL · GROUNDS'}else if(!flags.analyzed){title='Take the evidence to Gloamwood Police. Request a forensic comparison.';ui.location.textContent=nearestPlace().name}else if(!flags.interviewedMara){title='Find the night-shift witness at the Nightjar Diner.';ui.location.textContent=nearestPlace().name}else if(!flags.sectFound){title='The archive may explain the repeated sunburst. Follow the records.';ui.location.textContent=nearestPlace().name}else if(!flags.warrant){title='Build a case. Separate rumor from proof, then request a warrant.';ui.location.textContent=nearestPlace().name}else{title='Return to Old Mercy. Jonah Bell is waiting beneath the chapel.';ui.location.textContent=nearestPlace().name}ui.objective.textContent=title;ui.progressText.textContent=count?`${count} / 3`:flags.warrant?'WARRANT ISSUED':'';ui.progressBar.style.width=`${count/3*100}%`;$('evidenceCount').textContent=evidence.filter(e=>e.found).length;$('healthNum').textContent=Math.round(player.health);$('healthBar').style.width=`${player.health}%`;$('stressNum').textContent=Math.round(player.stress);$('stressBar').style.width=`${player.stress}%`}
function drawFallback(){if(!w||!h)return;const sw=Math.max(280,Math.floor(w*.72)),sh=Math.max(180,Math.floor(h*.72));if(buffer.width!==sw||buffer.height!==sh){buffer.width=sw;buffer.height=sh}const img=bufferCtx.createImageData(sw,sh),data=img.data,horizon=sh*.49+Math.sin(player.angle*1.6)*2,dirX=Math.cos(player.angle),dirY=Math.sin(player.angle),planeX=-dirY*.66,planeY=dirX*.66;zBuffer=new Float32Array(sw);
for(let x=0;x<sw;x++){let cameraX=2*x/sw-1,rayX=dirX+planeX*cameraX,rayY=dirY+planeY*cameraX,mapX=Math.floor(player.x),mapY=Math.floor(player.y),deltaX=Math.abs(1/(rayX||.00001)),deltaY=Math.abs(1/(rayY||.00001)),stepX,stepY,sideX,sideY;if(rayX<0){stepX=-1;sideX=(player.x-mapX)*deltaX}else{stepX=1;sideX=(mapX+1-player.x)*deltaX}if(rayY<0){stepY=-1;sideY=(player.y-mapY)*deltaY}else{stepY=1;sideY=(mapY+1-player.y)*deltaY}let side=0,wall=1;for(let i=0;i<60;i++){if(sideX<sideY){sideX+=deltaX;mapX+=stepX;side=0}else{sideY+=deltaY;mapY+=stepY;side=1}wall=wallAt(mapX,mapY);if(wall)break}let d=Math.max(.16,side===0?sideX-deltaX:sideY-deltaY);zBuffer[x]=d;let lineH=Math.min(sh*2,sh/d),start=Math.max(0,Math.floor(horizon-lineH*.52)),end=Math.min(sh,Math.floor(horizon+lineH*.56)),color=wallColors[wall]||'#45483f';if(wall>=11)color=wallColors[wall-10]||color;let rgb=[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)],shade=Math.max(.17,1-d/16)*(side===1?.79:1),texture=((mapX*19+mapY*37+wall*11)%7)*.016;
for(let y=0;y<sh;y++){let idx=(y*sw+x)*4,rr,gg,bb;if(y<horizon){let f=y/horizon;rr=8+f*10;gg=14+f*15;bb=15+f*14}else{let f=(y-horizon)/(sh-horizon);rr=18+f*23;gg=25+f*23;bb=24+f*18}if(y>=start&&y<=end){let yy=(y-start)/Math.max(1,end-start),brick=((Math.floor(x/9)+Math.floor(yy*lineH/10))%2)*.07,light=shade+texture+brick;rr=rgb[0]*light;gg=rgb[1]*light;bb=rgb[2]*light;if(Math.floor(x/14)%2===0&&yy>.18&&yy<.46&&Math.abs(x%34-16)<4){rr+=15*shade;gg+=19*shade;bb+=18*shade}if(yy>.74&&Math.floor(x/8)%3===0){rr*=.77;gg*=.77;bb*=.77}let fog=Math.max(0,(d-5)/19);rr=rr*(1-fog)+18*fog;gg=gg*(1-fog)+25*fog;bb=bb*(1-fog)+25*fog}data[idx]=rr;data[idx+1]=gg;data[idx+2]=bb;data[idx+3]=255}}
bufferCtx.putImageData(img,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(buffer,0,0,w,h);ctx.imageSmoothingEnabled=true;drawSprites();drawAtmosphere()}
function project(o,height=.5){const dx=o.x-player.x,dy=o.y-player.y,f=dx*Math.cos(player.angle)+dy*Math.sin(player.angle),s=-dx*Math.sin(player.angle)+dy*Math.cos(player.angle);if(f<.15)return null;const focal=w*.757576,horizon=h*viewHorizon;return{x:w*.5+focal*s/f,y:horizon+focal*.5/f,size:Math.min(h*.94,focal*height/f),f,focal}}
function drawSprites(t=0){
  const list=[...evidence.filter(e=>!e.found).map(o=>({o,sprite:'evidence',h:.10})),...items.filter(o=>!o.used).map(o=>({o,sprite:'item',h:.18})),...persons.map(o=>({o,sprite:'person',h:.62})),...lamps.map(o=>({o,sprite:'lamp',h:.55}))].map(a=>({...a,p:project(a.o,a.h)})).filter(a=>a.p&&a.p.x>-140&&a.p.x<w+140).sort((a,b)=>b.p.f-a.p.f);
  for(const {o,p,sprite} of list){
    if(wallAt(Math.floor(o.x),Math.floor(o.y))!==0)continue;
    if(sprite==='lamp'&&p.f<1.45)continue;
    const half=p.size*(sprite==='person'?.46:1.35),first=Math.max(0,Math.floor((p.x-half)/w*zBuffer.length)),lastCol=Math.min(zBuffer.length-1,Math.ceil((p.x+half)/w*zBuffer.length)),visible=[];
    for(let c=first;c<=lastCol;c++)if(p.f<zBuffer[c]+.18)visible.push(c);
    if(!visible.length)continue;
    ctx.save();ctx.beginPath();for(const c of visible)ctx.rect(c*w/zBuffer.length-1,0,w/zBuffer.length+2,h);ctx.clip();
    const fog=Math.max(0,Math.min(.62,(p.f-5)/17));ctx.globalAlpha=1-fog;
    if(sprite==='person')drawPerson(o,p,t);else if(sprite==='lamp')drawLamp(o,p,t);else drawPickup(o,p,t,sprite);
    ctx.restore();
  }
}
function drawPerson(o,p,t){
  const z=p.size,x=p.x,g=p.y,sway=Math.sin(t*1.35+p.f*2.3)*z*.006,kind=o.kind||'pastor';
  const dx=o.x-player.x,dy=o.y-player.y,ca=Math.atan2(dy,dx);let rel=((ca-player.angle+Math.PI*3)%(Math.PI*2))-Math.PI;
  const beam=player.flashlight&&Math.abs(rel)<.72?1:0;
  const coat=kind==='killer'?'#252a24':kind==='witness'?'#5a544c':kind==='officer'?'#303d44':'#514a3b';
  const rim=kind==='officer'?'#a9c0cc':kind==='witness'?'#cdbba0':'#dcc293';
  const skin=beam?'#c2ab90':'#8f7d68',hair=kind==='witness'?'#2a211b':'#191d18';
  const sh=ctx.createRadialGradient(x,g,z*.02,x,g,z*.44);
  sh.addColorStop(0,'rgba(0,0,0,.5)');sh.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=sh;ctx.beginPath();ctx.ellipse(x,g,z*.30,z*.045,0,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.translate(x+sway,g);
  // legs and shoes
  ctx.fillStyle='#101412';ctx.fillRect(-z*.095,-z*.31,z*.072,z*.31);ctx.fillRect(z*.023,-z*.31,z*.072,z*.31);
  ctx.fillStyle='#070a09';ctx.beginPath();ctx.ellipse(-z*.058,-z*.018,z*.085,z*.035,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(z*.058,-z*.018,z*.085,z*.035,0,0,Math.PI*2);ctx.fill();
  // long coat
  const grad=ctx.createLinearGradient(-z*.28,-z*.82,z*.28,-z*.20);
  grad.addColorStop(0,rim);grad.addColorStop(.14,coat);grad.addColorStop(.58,coat);grad.addColorStop(.9,'#111511');grad.addColorStop(1,'#0a0d0b');
  ctx.fillStyle=grad;
  ctx.beginPath();
  ctx.moveTo(-z*.225,-z*.775);
  ctx.quadraticCurveTo(-z*.285,-z*.64,-z*.26,-z*.29);
  ctx.lineTo(-z*.175,-z*.23);ctx.lineTo(-z*.048,-z*.25);
  ctx.lineTo(0,-z*.19);ctx.lineTo(z*.048,-z*.25);ctx.lineTo(z*.175,-z*.23);
  ctx.lineTo(z*.26,-z*.29);
  ctx.quadraticCurveTo(z*.285,-z*.64,z*.225,-z*.775);
  ctx.quadraticCurveTo(z*.10,-z*.845,-z*.225,-z*.775);
  ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=Math.max(.7,z*.006);ctx.stroke();
  // lapels
  ctx.fillStyle='rgba(12,15,13,.72)';
  ctx.beginPath();ctx.moveTo(-z*.06,-z*.77);ctx.lineTo(0,-z*.60);ctx.lineTo(z*.06,-z*.77);ctx.quadraticCurveTo(0,-z*.82,-z*.06,-z*.77);ctx.fill();
  ctx.strokeStyle='rgba(214,198,168,.20)';ctx.lineWidth=Math.max(.7,z*.005);
  ctx.beginPath();ctx.moveTo(-z*.06,-z*.77);ctx.lineTo(-z*.005,-z*.58);ctx.moveTo(z*.06,-z*.77);ctx.lineTo(z*.005,-z*.58);ctx.stroke();
  if(kind==='pastor'){ctx.fillStyle='#d9d2c0';ctx.fillRect(-z*.016,-z*.75,z*.032,z*.06)}
  if(kind==='officer'){ctx.fillStyle='#c8b56a';ctx.beginPath();ctx.arc(-z*.03,-z*.67,z*.018,0,Math.PI*2);ctx.fill()}
  // hands
  ctx.fillStyle=skin;
  ctx.beginPath();ctx.ellipse(-z*.245,-z*.33,z*.036,z*.055,.2,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(z*.245,-z*.33,z*.036,z*.055,-.2,0,Math.PI*2);ctx.fill();
  // neck and head
  ctx.fillStyle='#3a322a';ctx.fillRect(-z*.035,-z*.815,z*.07,z*.05);
  ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(0,-z*.855,z*.076,z*.09,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(8,10,9,.34)';ctx.beginPath();ctx.ellipse(-z*.02,-z*.858,z*.072,z*.086,.1,0,Math.PI*1.4);ctx.fill();
  // hair / hood
  ctx.fillStyle=hair;
  ctx.beginPath();ctx.moveTo(-z*.086,-z*.862);ctx.quadraticCurveTo(-z*.102,-z*.94,z*.006,-z*.945);ctx.quadraticCurveTo(z*.102,-z*.935,z*.085,-z*.855);ctx.quadraticCurveTo(z*.055,-z*.912,0,-z*.91);ctx.quadraticCurveTo(-z*.05,-z*.918,-z*.086,-z*.862);ctx.fill();
  if(kind==='pastor'){ctx.fillStyle='#d6cdb9';ctx.beginPath();ctx.ellipse(0,-z*.955,z*.10,z*.04,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b8ad96';ctx.fillRect(-z*.09,-z*.958,z*.18,z*.012)}
  if(kind==='officer'){ctx.fillStyle='#1e2a30';ctx.beginPath();ctx.ellipse(0,-z*.945,z*.098,z*.045,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c9b369';ctx.fillRect(-z*.05,-z*.943,z*.10,z*.010)}
  // eyes catch light
  const eg=beam?.55:.18;ctx.fillStyle=`rgba(232,222,194,${eg})`;
  ctx.fillRect(-z*.036,-z*.868,z*.018,z*.007);ctx.fillRect(z*.018,-z*.868,z*.018,z*.007);
  // rim light
  ctx.strokeStyle=`rgba(224,204,166,${beam?.30:.10})`;ctx.lineWidth=Math.max(.7,z*.005);
  ctx.beginPath();ctx.moveTo(-z*.225,-z*.77);ctx.quadraticCurveTo(-z*.285,-z*.62,-z*.26,-z*.30);ctx.stroke();
  if(beam){const rg=ctx.createRadialGradient(0,-z*.5,z*.1,0,-z*.5,z*.55);rg.addColorStop(0,'rgba(255,228,176,.07)');rg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=rg;ctx.beginPath();ctx.ellipse(0,-z*.5,z*.34,z*.5,0,0,Math.PI*2);ctx.fill()}
  ctx.restore();
  if(p.f<2.6){ctx.textAlign='center';ctx.font=`500 ${Math.max(8,Math.min(12,z*.055))}px "DM Mono", monospace`;ctx.fillStyle='rgba(232,224,200,.85)';ctx.shadowColor='rgba(0,0,0,.95)';ctx.shadowBlur=7;ctx.fillText(o.name.toUpperCase(),x,g+Math.max(13,z*.06));ctx.shadowBlur=0}
}
function drawPickup(o,p,t,sprite){
  const z=Math.max(7,p.size),x=p.x,g=p.y,pulse=.72+.28*Math.sin(t*2.3+p.f*1.7),gold=sprite==='evidence';
  ctx.save();ctx.globalCompositeOperation='lighter';
  const halo=ctx.createRadialGradient(x,g-z*.45,z*.03,x,g-z*.45,z*1.9);
  halo.addColorStop(0,gold?'rgba(255,220,150,.55)':'rgba(235,190,120,.42)');
  halo.addColorStop(.28,gold?'rgba(220,170,90,.20)':'rgba(190,140,80,.16)');
  halo.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=halo;ctx.beginPath();ctx.arc(x,g-z*.45,z*1.9*pulse,0,Math.PI*2);ctx.fill();
  const core=ctx.createRadialGradient(x,g-z*.55,0,x,g-z*.55,z*.5);
  core.addColorStop(0,'rgba(255,246,214,.95)');core.addColorStop(.38,gold?'rgba(232,190,110,.75)':'rgba(207,167,102,.68)');core.addColorStop(1,'rgba(160,120,60,0)');
  ctx.fillStyle=core;ctx.beginPath();ctx.arc(x,g-z*.55,z*.5,0,Math.PI*2);ctx.fill();
  ctx.restore();
  ctx.save();ctx.translate(x,g-z*.55);ctx.rotate(Math.PI/4);
  ctx.fillStyle=gold?'rgba(250,225,160,.92)':'rgba(238,202,140,.88)';
  const d=Math.max(2.2,z*.12);ctx.fillRect(-d/2,-d/2,d,d);
  ctx.strokeStyle='rgba(255,240,200,.45)';ctx.lineWidth=1;ctx.strokeRect(-d,-d,d*2,d*2);
  ctx.restore();
  const sh=ctx.createRadialGradient(x,g,0,x,g,z*.9);sh.addColorStop(0,'rgba(0,0,0,.28)');sh.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=sh;ctx.beginPath();ctx.ellipse(x,g,z*.55,z*.09,0,0,Math.PI*2);ctx.fill();
  if(p.f<3.1){ctx.textAlign='center';ctx.font='9px "DM Mono", monospace';ctx.fillStyle='rgba(238,224,188,.9)';ctx.shadowColor='rgba(0,0,0,.95)';ctx.shadowBlur=7;ctx.fillText((o.name||'').toUpperCase(),x,g+Math.max(13,z*.35));ctx.shadowBlur=0}
}
function drawLamp(o,p,t){
  const z=Math.max(8,p.size),x=p.x,g=p.y,top=g-z*1.02,flick=.84+.16*Math.sin(t*11+o.phase)*(o.flicker?.5+.5*Math.sin(t*23+o.phase):1),sway=swayLamp(o,t,z),lx=x+sway,ly=top+z*.16;
  const c=o.color||[1,.65,.3];
  ctx.save();
  const sh=ctx.createRadialGradient(x,g,z*.02,x,g,z*.42);sh.addColorStop(0,'rgba(0,0,0,.38)');sh.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=sh;ctx.beginPath();ctx.ellipse(x,g,z*.24,z*.04,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(20,24,21,.95)';ctx.lineWidth=Math.max(1.1,z*.022);
  ctx.beginPath();ctx.moveTo(x+sway*.35,g-z*.02);ctx.lineTo(x,top+z*.06);ctx.stroke();
  ctx.globalCompositeOperation='lighter';
  const halo=ctx.createRadialGradient(lx,ly,0,lx,ly,z*.62);
  halo.addColorStop(0,`rgba(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)},${.28*flick})`);
  halo.addColorStop(.24,`rgba(${Math.round(c[0]*255)},${Math.round(c[1]*230)},${Math.round(c[2]*180)},${.12*flick})`);
  halo.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=halo;ctx.beginPath();ctx.arc(lx,ly,z*.62,0,Math.PI*2);ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle='#0e1210';
  ctx.beginPath();ctx.moveTo(lx-z*.062,ly-z*.075);ctx.lineTo(lx+z*.062,ly-z*.075);ctx.lineTo(lx+z*.038,ly+z*.035);ctx.lineTo(lx-z*.038,ly+z*.035);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(208,188,148,.25)';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle=`rgba(255,224,158,${.8*flick})`;ctx.fillRect(lx-z*.03,ly-z*.045,z*.06,z*.072);
  ctx.fillStyle='#0d100e';ctx.fillRect(lx-z*.05,ly-z*.085,z*.1,z*.014);
  ctx.restore();
}
function swayLamp(o,t,z){return Math.sin(t*1.1+o.phase)*z*.012}
const rainSeeds=Array.from({length:170},(_,i)=>{const r=(n=>{let x=(n*9301+49297)%233280;return()=>{x=(x*9301+49297)%233280;return x/233280}})(i*7+3);return{x:r(),y:r(),z:r(),sp:.55+r()*1.35,len:.5+r()*1.3,wob:r()*6.283}});
const mistSeeds=[{x:.22,y:.48,s:.5,sp:.012},{x:.63,y:.52,s:.62,sp:-.009},{x:.84,y:.44,s:.4,sp:.016}];
function drawAtmosphere(t=0){
  const wet=world.weather.includes('RAIN')?1:world.weather==='FOG'?.5:.14,coarse=matchMedia('(pointer: coarse)').matches,count=coarse?150:230;
  ctx.save();ctx.lineCap='round';
  for(let i=0;i<count;i++){
    const d=rainSeeds[i],depth=.28+d.z*.72;
    let yy=(d.y+t*(.55+d.sp*.9))%1;
    if(yy<0)yy+=1;
    let xx=(d.x + player.angle*.045*depth + Math.sin(t*.7+d.wob)*.003)%1;
    if(xx<0)xx+=1;
    const px=xx*w,py=yy*h,ln=(7+d.len*24)*pxRatio*depth,slant=(1.5+d.z*4)*pxRatio;
    ctx.strokeStyle=`rgba(196,208,210,${(.09+d.z*.28)*wet})`;
    ctx.lineWidth=Math.max(.55,(.4+d.z*1.25)*pxRatio);
    if(d.z>.78){ctx.shadowColor='rgba(190,205,210,.35)';ctx.shadowBlur=2*pxRatio}
    ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-slant,py+ln);ctx.stroke();
    ctx.shadowBlur=0;
  }
  ctx.globalCompositeOperation='lighter';
  for(let i=0;i<22;i++){
    const d=rainSeeds[i+52],ph=(t*(.55+d.z*.7)+d.wob)%1,cy=h*(.55+d.y*.43),cx=(d.x+player.angle*.02*(.3+d.z))*w;
    const rad=(1.5+ph*9*(.5+d.z))*pxRatio,a=(1-ph)*(.10+.10*d.z)*wet;
    ctx.strokeStyle=`rgba(186,205,208,${a})`;ctx.lineWidth=Math.max(.5,.7*pxRatio);
    ctx.beginPath();ctx.ellipse(cx,cy,rad,rad*.32,0,0,Math.PI*2);ctx.stroke();
  }
  ctx.globalCompositeOperation='source-over';
  ctx.globalCompositeOperation='lighter';
  for(const m of mistSeeds){
    const mx=(m.x+Math.sin(t*m.sp+m.x*10)*.06)*w,my=(m.y+Math.sin(t*.05+m.y*8)*.02)*h,r=m.s*w;
    const g=ctx.createRadialGradient(mx,my,0,mx,my,r);
    g.addColorStop(0,`rgba(112,132,134,${.045*wet})`);g.addColorStop(.55,`rgba(86,104,108,${.022*wet})`);g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(mx,my,r,r*.34,0,0,Math.PI*2);ctx.fill();
  }
  if(player.flashlight){
    const gx=w*.5,gy=h*(viewHorizon+.03),r=h*.58;
    const g=ctx.createRadialGradient(gx,gy,4,gx,gy,r);
    g.addColorStop(0,'rgba(255,240,200,.045)');g.addColorStop(.34,'rgba(220,220,190,.018)');g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    for(let i=0;i<18;i++){
      const d=rainSeeds[i],x=(((d.x*.7+.15)+Math.sin(t*.13+d.wob)*.02)%1)*w,y=((d.y*.6+.2+t*.006*(.3+d.z))%1)*h;
      ctx.fillStyle=`rgba(240,230,200,${.05+d.z*.12})`;ctx.beginPath();ctx.arc(x,y,(.45+d.z*.9)*pxRatio,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.globalCompositeOperation='source-over';
  if(lightning>.01){ctx.fillStyle=`rgba(188,204,220,${lightning*.16})`;ctx.fillRect(0,0,w,h)}
  ctx.restore();
}
function wrap(text,max=72){const words=text.split(' '),lines=[];let line='';for(const word of words){if((line+' '+word).trim().length>max){lines.push(line);line=word}else line=(line+' '+word).trim()}if(line)lines.push(line);return lines}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function panel(title,kicker,html){ui.panelTitle.textContent=title;ui.panelKicker.textContent=kicker;ui.panelContent.innerHTML=html;ui.panel.classList.remove('hidden')}
function closePanel(){ui.panel.classList.add('hidden')}
function openCase(tab=caseTab){caseTab=tab;activePanel='case';document.querySelectorAll('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.panel==='case'));const tabs=`<div class="tab-row"><button data-case-tab="evidence" class="${tab==='evidence'?'selected':''}">EVIDENCE</button><button data-case-tab="people" class="${tab==='people'?'selected':''}">PERSONS OF INTEREST</button><button data-case-tab="theory" class="${tab==='theory'?'selected':''}">WORKING THEORY</button></div>`;let body='';if(tab==='evidence'){body=evidence.filter(e=>e.found).map(e=>`<article class="file-card"><span class="case-label">${escapeHTML(e.type)} · ${escapeHTML(e.where.toUpperCase())}</span><h3>${escapeHTML(e.name)}</h3><p>${escapeHTML(e.desc)}</p><small>${e.analyzed?'LAB NOTE: '+escapeHTML(e.analysis):'Awaiting analysis · Take to evidence intake'}</small></article>`).join('')||'<p class="muted">No evidence logged yet. Search the chapel grounds before the rain erases the traces.</p>'}else if(tab==='people'){body=persons.map(p=>`<article class="file-card"><span class="case-label">${escapeHTML(p.role)}</span><h3>${escapeHTML(p.name)}</h3><p>${p.met?'Interview recorded. '+escapeHTML(p.memories.join(' · ')||p.line):'Not yet interviewed'}</p><small>COOPERATION · ${p.trust}%</small></article>`).join('')}else{const found=evidence.filter(e=>e.found).length;body=`<article class="file-card"><span class="case-label">CURRENT THEORY</span><h3>${flags.warrant?'A warrant, not a verdict':'The Lantern congregation'}</h3><p>${found<3?'The chapel scene is incomplete. Collect the trace, the key, and the prayer leaf before drawing conclusions.':!flags.analyzed?'Three items are secured, but their meaning is not established. Evidence intake may connect the fiber to a person.':!flags.sectFound?'The ivory fiber points toward a local witness. The repeated sunburst and archive key suggest an older story beneath the chapel.':'The records show an unlisted congregation and civic payments. The underpass ledger may prove a conspiracy, but motive is not proof of murder.'}</p><div class="theory-meter"><span>SCENE</span><b>${found}/3</b><span>LAB</span><b>${flags.analyzed?'DONE':'—'}</b><span>ARCHIVE</span><b>${flags.sectFound?'FOUND':'—'}</b><span>WARRANT</span><b>${flags.warrant?'ISSUED':'PENDING'}</b></div></article>`}panel('Case file','MAJOR CRIMES · CASE 07-14',tabs+body)}
function openMap(){activePanel='map';document.querySelectorAll('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.panel==='map'));const here=nearestPlace();const list=locations.map(l=>`<div class="map-stop ${l.id===here.id?'here':''}"><span class="map-dot"></span><div><b>${escapeHTML(l.name)}</b><small>${l.id===here.id?'YOU ARE HERE':Math.round(distance(player,l))+' BLOCKS · '+(l.id==='chapel'?'CASE SCENE':'PUBLIC ACCESS')}</small></div><button data-travel="${l.id}">GO</button></div>`).join('');panel('Town map','GLOAMWOOD COUNTY · WALKING ROUTES',`<div class="map-summary">A county road grid, nine marked locations. Travel moves time forward; your footsteps are not silent.</div><div class="map-list">${list}</div>`)}
function openNotes(){activePanel='notes';document.querySelectorAll('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.panel==='notes'));panel('Field notes','PRIVATE · NOT FOR DISCOVERY',`<div class="note-paper"><span class="case-label">OCT ${world.day} · ${timeString()}</span><h3>Night ${world.days} — field observations</h3><p>${flags.sceneSecured?'Scene secured and logged.':'Rain is heavy. The crime scene has not been formally secured.'}</p><p>${player.visited.length?`Locations visited: ${player.visited.map(id=>escapeHTML(locations.find(l=>l.id===id)?.name||id)).join(', ')}.`:'I have not had time to map the town.'}</p><p>${player.habits.chapel>2?'I keep looking toward Old Mercy. I should ask myself why.':'Someone is watching from the dark windows. Probably nerves.'}</p><p>${player.habits.public>1?'The town hears every question before I ask it.':'Keep a record of what is said, not just what is found.'}</p><p class="handwritten">“Evidence is not a conclusion.”</p></div><button class="action-btn" data-do="save">SAVE FIELD NOTES</button>`)}
function timeString(){let hr=Math.floor(world.minute/60)%24,min=world.minute%60;return `${String(hr%12||12).padStart(2,'0')}:${String(min).padStart(2,'0')} ${hr>=12?'PM':'AM'}`}
function advance(minutes,travel=false){world.minute+=minutes;while(world.minute>=1440){world.minute-=1440;world.day++;world.days++;world.weather=world.days%3===0?'FOG':'COLD RAIN'}if(travel){player.stress=Math.min(100,player.stress+Math.max(1,minutes*.07));world.sectPressure=Math.min(100,world.sectPressure+minutes*.04)}ui.clock.textContent=timeString();ui.weather.textContent=world.weather;objective();if(world.sectPressure>70&&Math.random()<.035){player.stress=Math.min(100,player.stress+8);say('A shape has moved behind you. You are certain of it.')}}
function facing(o){let dx=o.x-player.x,dy=o.y-player.y,dist=Math.hypot(dx,dy),dot=(dx*Math.cos(player.angle)+dy*Math.sin(player.angle))/(dist||1);return{dist,dot}}
function visible(o){let f=facing(o);if(f.dist>2.25||f.dot<.45)return false;let steps=Math.ceil(f.dist*12);for(let i=1;i<steps;i++){let t=i/steps;if(wallAt(player.x+(o.x-player.x)*t,player.y+(o.y-player.y)*t)>0)return false}return true}
function updatePrompt(){let candidates=[...evidence.filter(e=>!e.found),...items.filter(i=>!i.used),...persons].map(o=>({o,...facing(o)})).filter(a=>a.dist<2.1&&a.dot>.45&&visible(a.o)).sort((a,b)=>a.dist-b.dist);nearest=candidates[0]?.o||null;ui.prompt.textContent=nearest?(evidence.includes(nearest)?`[E] COLLECT ${nearest.name.toUpperCase()}`:nearest.name&&nearest.role?`[E] SPEAK WITH ${nearest.name.toUpperCase()}`:nearest.prompt||`[E] EXAMINE ${nearest.name}`):'';ui.prompt.classList.toggle('visible',!!nearest&&visible(nearest))}
function collect(e){e.found=true;player.inventory.push(e.name);player.stress=Math.max(0,player.stress-1);say(`EVIDENCE SECURED · ${e.name.toUpperCase()}`);if(e.id==='seal')flags.sealExplained=true;if(e.id==='ledger')flags.secretFound=true;advance(3);if(['fiber','key','testament'].every(id=>evidence.find(x=>x.id===id).found)){flags.sceneSecured=true;items.find(i=>i.id==='scene').used=true;say('SCENE SEALED · THREE ITEMS LOGGED') }objective();save(0,true)}
function examineItem(i){if(i.kind==='scene'){if(!flags.sceneSecured){if(['fiber','key','testament'].some(id=>!evidence.find(e=>e.id===id).found)){say('Do not disturb the scene. Bag each visible trace first.');return}flags.sceneSecured=true;i.used=true;player.habits.chapel++;say('SCENE SECURED · PHOTOGRAPHED AND LOGGED');advance(5);save(0,true)}else say(i.desc)}else if(i.kind==='altar'){player.habits.chapel++;if(!evidence.find(e=>e.id==='seal').found){evidence.find(e=>e.id==='seal').found=true;player.inventory.push('Choir seal');say('FOUND · CHOIR SEAL — carved behind the loose stained-glass frame')}else say(i.desc);advance(2)}else if(i.kind==='lab'){openLab()}else if(i.kind==='archive'){if(!flags.sectFound){flags.sectFound=true;let reg=evidence.find(e=>e.id==='register');reg.found=true;reg.analyzed=true;reg.analysis='The Lantern congregation held property below Old Mercy. A margin note says “Bell family keeps the second key.”';player.inventory.push(reg.name);say('ARCHIVE MATCH · LANTERN CONGREGATION FOUND')}else say('The microfilm spools through the same list of vanished names.');advance(8);save(0,true)}else if(i.kind==='under'){let led=evidence.find(e=>e.id==='ledger');if(!led.found){led.found=true;flags.secretFound=true;player.inventory.push(led.name);say('FOUND · UNLISTED TITHE LEDGER')}else say('The tunnel is empty now. The water has risen over the footprints.');advance(6);save(0,true)}else if(i.kind==='rest'){world.minute=(Math.floor(world.minute/60)+7)*60;advance(0);player.stress=Math.max(8,player.stress-28);player.health=Math.min(100,player.health+14);player.stamina=100;world.sectPressure=Math.max(0,world.sectPressure-22);say('MORNING, OCT '+world.day+' · YOU FEEL NO BETTER');save(0,true)}else if(i.kind==='radio'){advance(4);player.stress=Math.min(100,player.stress+4);say(flags.warrant?'DISPATCH: Search order logged. Keep the channel clear.':'DISPATCH: “Bell, report to the lower chapel.” The voice is not Park’s.');if(!flags.warrant)world.events.push('Unknown voice on patrol frequency.')}else if(i.kind==='warrant'){if(!flags.analyzed||!flags.interviewedMara||!flags.sectFound){say('The prosecutor wants lab confirmation, a witness statement, and the archive record.');return}if(!flags.warrant){flags.warrant=true;world.publicTrust=Math.max(0,world.publicTrust-6);say('SEARCH WARRANT ISSUED · SUBJECT: JONAH BELL');advance(12);save(0,true)}else say('The warrant is active. The chapel is the next stop.')}}
function interact(){if(!nearest||!visible(nearest)){say('Nothing within reach.');return}if(evidence.includes(nearest)){collect(nearest);return}if(persons.includes(nearest)){openDialogue(nearest);return}const it=items.find(i=>i.id===nearest.id);if(it)examineItem(it)}
function openLab(){let html=`<p class="muted">Officer Park cross-checks secured material against county records. This is a rush request; it will advance the night.</p>`;if(!flags.analyzed&&evidence.find(e=>e.id==='fiber').found){html+=`<article class="file-card"><span class="case-label">TRACE COMPARISON · AVAILABLE</span><h3>Ivory wool fiber</h3><p>Compare the chapel fiber with the witness's raincoat. Establishes contact, not guilt.</p><button class="action-btn" data-do="analyze">REQUEST LAB COMPARISON</button></article>`}else if(flags.analyzed)html+='<article class="file-card"><span class="case-label">COMPLETED</span><h3>Ivory wool fiber</h3><p>Fibers are consistent with a coat issued to Nightjar Diner staff. Mara Voss confirms she was near the chapel earlier.</p></article>';else html+='<p>There is not enough secured trace evidence to run a comparison.</p>';panel('Evidence intake','GLOAMWOOD POLICE · FORENSICS',html)}
function dialogueOptions(p){if(p.id==='mara'){return [
{label:'Ask about the second bell',id:'bell',text:'I heard a second bell after closing. The chapel tower has no bell. Someone rang the handbell below the hill. I saw a lantern by the underpass.'},
{label:'Show the fiber comparison',id:'fiber',text:'That coat is issued to staff here. I went to Old Mercy before my shift. I took soup to Reverend Ellis. I did not go inside.'},
{label:'Ask why she withheld the visit',id:'withheld',text:'Because I saw someone leave the chapel. I thought it was Jonah, but the rain makes everyone look like a stranger.'},
{label:'Thank her and leave',id:'leave',text:'You should be careful. People here remember who asks questions.'}]}
if(p.id==='jonah'){return [
{label:'Ask about the archive key',id:'key',text:'That key is not mine. My father kept one. The second key was buried with the old congregation.'},
{label:'Present the warrant and confront him',id:'confront',text:'You came back for the ledger. The storm drain exits at the chapel wall. You thought the pages were lost.'},
{label:'Accuse him without showing evidence',id:'reckless',text:'A useful accusation. The township has guards at every door, detective. You have given them a reason to clear the chapel.'},
{label:'Ask about the missing names',id:'names',text:'The congregation kept its own list. I tried to end it. The dead do not care what we call the living.'}]}
if(p.id==='park')return [{label:'Request evidence intake',id:'lab',text:'Bring the sealed evidence to the intake window. I can run a comparison once it is logged.'},{label:'Ask about Jonah Bell',id:'bell',text:'He has no record. His father did, once. The file disappeared during the county merger.'},{label:'End conversation',id:'leave',text:'Keep your radio on. The storm is interfering with dispatch.'}];
return [{label:'Ask about the Lantern congregation',id:'lantern',text:'It was a mutual-aid society. Soup, winter coats, burial costs. Later, people started calling it a congregation.'},{label:'Ask about the scraped face',id:'glass',text:'A memorial to the Witness. The elders said no one should be able to recognize him.'},{label:'End conversation',id:'leave',text:'The reverend looks away toward the dark chapel.'}]}
function openDialogue(p){currentPerson=p;p.met=true;player.habits.interviews++;$('avatar').textContent=p.name.split(' ').map(s=>s[0]).join('');$('personRole').textContent=p.role;$('personName').textContent=p.name;$('personLine').textContent=p.line;renderDialogueOptions(p);ui.dialogue.classList.remove('hidden');advance(2);save(0,true)}
function renderDialogueOptions(p){$('dialogueOptions').innerHTML=dialogueOptions(p).map((o,i)=>`<button class="dialogue-option" data-choice="${o.id}"><span>${String(i+1).padStart(2,'0')}</span>${escapeHTML(o.label)} <b>→</b></button>`).join('')}
function chooseDialogue(id){const p=currentPerson;if(!p)return;const option=dialogueOptions(p).find(o=>o.id===id);if(!option)return;$('personLine').textContent=option.text;p.memories.push(option.label);advance(id==='confront'?5:3);if(p.id==='mara'){if(id==='bell'){flags.interviewedMara=true;player.habits.interviews++;player.stress=Math.max(0,player.stress-4)}if(id==='fiber'){flags.interviewedMara=true;flags.trustMara++;p.trust=Math.min(100,p.trust+8)}if(id==='withheld'){flags.interviewedMara=true;flags.trustMara++;world.events.push('Mara saw a figure leave the chapel.')}if(id==='leave'&&flags.analyzed)flags.interviewedMara=true}
if(p.id==='jonah'){if(id==='key'&&evidence.find(e=>e.id==='key').found){flags.interviewedJonah=true;flags.trustMara++;}if(id==='names'){flags.interviewedJonah=true;flags.sealExplained=true}if(id==='reckless'){world.publicTrust=Math.max(0,world.publicTrust-18);player.health=Math.max(40,player.health-8);player.stress=Math.min(100,player.stress+22);flags.ending='reckless';setTimeout(()=>finishEnding('bad'),650);return}if(id==='confront'){if(!flags.warrant){say('Without a warrant he says nothing more.');player.stress=Math.min(100,player.stress+10)}else{flags.interviewedJonah=true;const best=flags.secretFound&&flags.analyzed&&flags.trustMara>0;setTimeout(()=>finishEnding(best?'best':'good'),500);return}}}
if(p.id==='park'&&id==='lab'){ui.dialogue.classList.add('hidden');currentPerson=null;openLab();return}if(p.id==='pastor'&&id==='lantern')flags.sectFound=flags.sectFound||evidence.find(e=>e.id==='register').found;
renderDialogueOptions(p);objective();save(0,true)}
function finishEnding(type){ui.dialogue.classList.add('hidden');closePanel();flags.ending=type;world.ending=type;let title,sub,text;if(type==='best'){title='THE NAMES REMAIN';sub='A TESTAMENT, NOT A CONFESSION';text='The ledger, the fiber, and Mara’s account hold up under scrutiny. Jonah is taken in alive. His confession names the people who financed the congregation, and the dead are finally entered into the county record. Before dawn, the radio speaks your badge number once. Only once.'}else if(type==='good'){title='THE LAST LANTERN';sub='CASE CLOSED · QUESTIONS REMAIN';text='Jonah is arrested beneath the chapel, but the old ledger is incomplete. He gives the county a confession and keeps the names of those who helped him. By morning, the rain has stopped. No one in Gloamwood remembers hearing a bell.'}else{title='THE TOWN CLOSES RANKS';sub='CASE DISMISSED';text='The accusation outruns the evidence. Jonah vanishes into the storm, and the county calls it a misunderstanding. The dispatch channel goes quiet. Somewhere below Old Mercy, a bell rings twice.'}$('endingTitle').textContent=title;$('endingSub').textContent=sub;$('endingText').textContent=text;ui.ending.classList.remove('hidden');save(0,true)}
function findWalkable(x,y){for(let r=1;r<5;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){let xx=x+dx*.5,yy=y+dy*.5;if(!collides(xx,yy))return{x:xx,y:yy}}return{x:player.x,y:player.y}}
function travel(id){const loc=locations.find(l=>l.id===id);if(!loc)return;const tripDistance=distance(player,loc);const pos=findWalkable(loc.x,loc.y);player.x=pos.x;player.y=pos.y;player.angle=-Math.PI/2;player.visited=[...new Set([...player.visited,id])];player.habits[loc.id==='chapel'?'chapel':'public']++;advance(Math.max(8,Math.round(tripDistance*4)),true);closePanel();say(`ARRIVED · ${loc.name}`);save(0,true)}
function closeAll(){if(!ui.dialogue.classList.contains('hidden'))ui.dialogue.classList.add('hidden');if(!ui.panel.classList.contains('hidden'))closePanel();$('helpScreen').classList.add('hidden');document.exitPointerLock?.()}
function handlePanelClick(e){const btn=e.target.closest('button');if(!btn)return;if(btn.dataset.caseTab){openCase(btn.dataset.caseTab);return}if(btn.dataset.travel){travel(btn.dataset.travel);return}if(btn.dataset.do==='save'){save();return}if(btn.dataset.do==='analyze'){flags.analyzed=true;player.habits.forensics++;player.stress=Math.max(0,player.stress-6);evidence.find(x=>x.id==='fiber').analyzed=true;evidence.find(x=>x.id==='fiber').analysis='Consistent with the dark ivory wool coat issued to Nightjar Diner staff. The fiber alone does not establish who wore it or when.';flags.trustMara++;world.events.push('Fiber is consistent with Nightjar staff coat.');advance(45,true);say('LAB RESULT RECEIVED · COMPARISON IS CONSISTENT');save(0,true);openLab();objective()}}
function tick(now){let dt=Math.min(.05,(now-last)/1000);last=now;if(ui.start.classList.contains('hidden')&&ui.ending.classList.contains('hidden')&&ui.dialogue.classList.contains('hidden')&&ui.panel.classList.contains('hidden')){let forward=Math.max(-1,Math.min(1,(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-touchMoveY)),side=Math.max(-1,Math.min(1,(keys.KeyD?1:0)-(keys.KeyA?1:0)+touchMoveX));if(Math.hypot(forward,side)>1){forward/=Math.hypot(forward,side);side/=Math.hypot(forward,side)}if(keys.ArrowLeft)player.angle-=dt*1.9;if(keys.ArrowRight)player.angle+=dt*1.9;if(mouseLook){player.angle+=mouseLook;mouseLook=0}if(forward||side){const running=(keys.ShiftLeft||keys.ShiftRight||touchRun)&&player.stamina>20,speed=(running?3.5:2.35)*dt,dx=(Math.cos(player.angle)*forward-Math.sin(player.angle)*side)*speed,dy=(Math.sin(player.angle)*forward+Math.cos(player.angle)*side)*speed;if(!collides(player.x+dx,player.y))player.x+=dx;if(!collides(player.x,player.y+dy))player.y+=dy;player.steps+=Math.abs(forward)+Math.abs(side);player.stamina=Math.max(0,player.stamina-(running?dt*9:-dt*4));if(player.steps>25){player.steps=0;advance(1,true)}}else player.stamina=Math.min(100,player.stamina+dt*6)}frameDt=dt;draw();updatePrompt();requestAnimationFrame(tick)}
function bind(){document.querySelectorAll('.nav-button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.panel==='case')openCase('evidence');if(b.dataset.panel==='map')openMap();if(b.dataset.panel==='notes')openNotes()}));$('closePanel').addEventListener('click',closePanel);ui.panelContent.addEventListener('click',handlePanelClick);$('closeDialogue').addEventListener('click',()=>ui.dialogue.classList.add('hidden'));$('dialogueOptions').addEventListener('click',e=>{const b=e.target.closest('[data-choice]');if(b)chooseDialogue(b.dataset.choice)});$('beginBtn').addEventListener('click',()=>{ui.start.classList.add('hidden');advance(0);say('CASE 07-14 · FIELD NOTES OPEN');save(0,true)});$('saveBtn').addEventListener('click',()=>save());$('helpBtn').addEventListener('click',()=>$('helpScreen').classList.remove('hidden'));document.querySelectorAll('.modal-close,.modal-ok').forEach(b=>b.addEventListener('click',()=>$('helpScreen').classList.add('hidden')));$('restartBtn').addEventListener('click',()=>{localStorage.removeItem(SAVE+'0');location.reload()});canvas.addEventListener('click',()=>{if(document.pointerLockElement!==canvas&&ui.start.classList.contains('hidden'))canvas.requestPointerLock?.()});document.addEventListener('pointerlockchange',()=>{});document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&ui.dialogue.classList.contains('hidden')&&ui.panel.classList.contains('hidden'))player.angle+=e.movementX*.0022});document.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys[e.code]=true;if(e.repeat)return;if(e.code==='KeyE'&&ui.start.classList.contains('hidden')&&ui.ending.classList.contains('hidden'))interact();if(e.code==='KeyF')player.flashlight=!player.flashlight;if(e.code==='Escape'){if(!$('helpScreen').classList.contains('hidden'))$('helpScreen').classList.add('hidden');else closeAll()}if(e.code==='Digit1')openCase('evidence');if(e.code==='Digit2')openMap();if(e.code==='Digit3')openNotes()});document.addEventListener('keyup',e=>keys[e.code]=false);document.addEventListener('visibilitychange',()=>{if(document.hidden)save(0,true)});const movePad=$('movePad'),moveStick=$('moveStick');movePad.addEventListener('pointerdown',e=>{e.preventDefault();movePointer=e.pointerId;movePad.setPointerCapture(e.pointerId);updateMove(e)});movePad.addEventListener('pointermove',e=>{if(e.pointerId===movePointer)updateMove(e)});const stopMove=e=>{if(e.pointerId!==movePointer)return;movePointer=null;touchMoveX=touchMoveY=0;moveStick.style.transform='translate(0,0)'};movePad.addEventListener('pointerup',stopMove);movePad.addEventListener('pointercancel',stopMove);function updateMove(e){const r=movePad.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),limit=r.width*.31,len=Math.hypot(dx,dy),scale=len>limit?limit/len:1;touchMoveX=dx*scale/limit;touchMoveY=dy*scale/limit;moveStick.style.transform=`translate(${dx*scale}px,${dy*scale}px)`}const run=$('runTouch');run.addEventListener('pointerdown',e=>{e.preventDefault();touchRun=true;run.classList.add('pressed');run.setPointerCapture(e.pointerId)});const stopRun=()=>{touchRun=false;run.classList.remove('pressed')};run.addEventListener('pointerup',stopRun);run.addEventListener('pointercancel',stopRun);$('flashTouch').addEventListener('click',()=>{player.flashlight=!player.flashlight});$('interactTouch').addEventListener('click',interact);$('view').addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!e.target.closest('button')){lookPointer={id:e.pointerId,x:e.clientX};canvas.setPointerCapture(e.pointerId)}});$('view').addEventListener('pointermove',e=>{if(lookPointer?.id===e.pointerId){player.angle+=(lookPointer.x-e.clientX)*.006;lookPointer.x=e.clientX}});const stopLook=e=>{if(lookPointer?.id===e.pointerId)lookPointer=null};$('view').addEventListener('pointerup',stopLook);$('view').addEventListener('pointercancel',stopLook);}
if(!load(Number(localStorage.getItem(SAVE+'active')||0))){objective()}else{ui.start.querySelector('p').innerHTML='A rain-darkened town. A congregation with a secret.<br>Someone is listening.<br><span class="muted">A field notebook from this case was recovered.</span>';objective();say('FIELD NOTES RECOVERED')}
ui.clock.textContent=timeString();ui.weather.textContent=world.weather;bind();requestAnimationFrame(tick);
window.__gloam={player,grid,world,flags,evidence,persons,items,lamps};
})();
