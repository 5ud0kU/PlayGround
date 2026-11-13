(() => {
'use strict';
const canvas=document.getElementById('view'),ctx=canvas.getContext('2d',{alpha:false}),W=640,H=360,MW=40,MH=40;
canvas.width=W;canvas.height=H;
const $=s=>document.querySelector(s),clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
const map=new Uint8Array(MW*MH),labels=new Array(MW*MH).fill(''),doors=[],objects=[],people=[],clues=[],rumors=[],threats=[],critters=[];
const idx=(x,y)=>Math.floor(y)*MW+Math.floor(x),tile=(x,y)=>x<0||y<0||x>=MW||y>=MH?1:map[idx(x,y)],setTile=(x,y,v)=>{if(x>=0&&y>=0&&x<MW&&y<MH)map[idx(x,y)]=v};
const sites=[
 {x:7,y:7,name:'Mara Venn’s House',kind:'house',type:1,open:true},{x:15,y:7,name:'Bellweather Grocery',kind:'shop',type:2,open:true},{x:23,y:7,name:'Ashgate Elementary',kind:'school',type:3},{x:31,y:7,name:'St. Oran Hospital',kind:'hospital',type:4,key:'ward key'},
 {x:7,y:15,name:'Ashgate Police',kind:'police',type:4,open:true},{x:15,y:15,name:'The Drowned Bell',kind:'church',type:3},{x:23,y:15,name:'Morrow Hotel',kind:'hotel',type:2},{x:31,y:15,name:'Switchyard Works',kind:'factory',type:4,key:'brass key'},
 {x:7,y:23,name:'Cedar Street Flats',kind:'apartments',type:2},{x:15,y:23,name:'Red Fern Diner',kind:'diner',type:1,open:true},{x:23,y:23,name:'Riverside Cemetery',kind:'cemetery',type:3},{x:31,y:23,name:'North Pump Station',kind:'tunnel',type:4,key:'brass key'},
 {x:7,y:31,name:'County Archive',kind:'archive',type:3},{x:15,y:31,name:'Old Mill Clinic',kind:'clinic',type:4},{x:23,y:31,name:'Pine Hollow Road',kind:'forest',type:5},{x:31,y:31,name:'Relay Bunker',kind:'bunker',type:4,key:'ward key'}
];
function isBuilding(site){return site.kind!=='cemetery'&&site.kind!=='forest'}
function roomAt(x,y){return sites.find(s=>isBuilding(s)&&x>s.x-2&&x<s.x+2&&y>s.y-2&&y<s.y+2)||null}
function addRoomDecor(site,items){for(const [dx,dy,name,style='wood',horror=false] of items)objects.push({x:site.x+dx,y:site.y+dy,type:style==='blood'?'blood':horror?'horror':'furniture',name,site,room:site,style,horror,hidden:true})}
function buildTown(){
  // Ashgate is a walkable low-poly landscape: grass lots, broad asphalt lanes,
  // pale sidewalks and a dense, continuous perimeter of ruined town walls.
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++)setTile(x,y,x===0||y===0||x===MW-1||y===MH-1?1:5);
  // The old grid survives as a road network, with a wider crossroad at the town square.
  for(let x=1;x<MW-1;x++)for(const y of [3,4,11,12,19,20,27,28,35,36])setTile(x,y,6);
  for(let y=1;y<MH-1;y++)for(const x of [3,4,11,12,19,20,27,28,35,36])setTile(x,y,6);
  for(let y=17;y<=22;y++)for(let x=17;x<=22;x++)setTile(x,y,6);
  // Sidewalks and small forecourts frame each building without interrupting routes.
  for(const s of sites){for(let x=s.x-3;x<=s.x+3;x++){if(tile(x,s.y-3)===5)setTile(x,s.y-3,7);if(tile(x,s.y+3)===5)setTile(x,s.y+3,7)}for(let y=s.y-3;y<=s.y+3;y++){if(tile(s.x-3,y)===5)setTile(s.x-3,y,7);if(tile(s.x+3,y)===5)setTile(s.x+3,y,7)}}
  // The town square opens into a small paved civic plaza; a raised-looking island
  // is kept walkable so the old cross-town route stays intact.
  for(let y=17;y<=22;y++)for(let x=17;x<=22;x++)setTile(x,y,7);
  for(const [x,y] of [[18,18],[21,18],[18,21],[21,21]])setTile(x,y,6);
 for(const s of sites){
  const x0=s.x-2,y0=s.y-2,x1=s.x+2,y1=s.y+2;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const edge=x===x0||x===x1||y===y0||y===y1;setTile(x,y,isBuilding(s)&&edge?s.type:0);labels[idx(x,y)]=s.name}
  if(isBuilding(s)){
   // Each site has a real threshold in the south wall; opening it changes collision and sightlines.
   const dx=s.x,dy=y1;setTile(dx,dy,s.open?0:8);s.door={x:dx+.5,y:dy+.5,site:s,open:!!s.open,door:true};doors.push(s.door);
   const wallX=s.x+(s.x%2?1:-1);for(let y=y0+2;y<y1;y++)if(y!==s.y)setTile(wallX,y,s.type);
   setTile(wallX,s.y,0);
  }
  objects.push({x:s.x,y:y0-.6,type:'sign',name:s.name,site:s});
 }
 // Distinct, deliberately sparse room layouts leave the doorway and central route clear.
 addRoomDecor(sites[0],[[-1.2,-1.05,'iron bed','wood'],[.25,-1.15,'tall wardrobe','wood'],[-1.2,.7,'child chair','wood'],[.65,.85,'cracked mirror','glass',true],[.35,.2,'dark stain','blood',true]]);
 addRoomDecor(sites[1],[[-1.15,-1.1,'can shelves','metal'],[-1.15,.5,'can shelves','metal'],[.9,-1.05,'checkout counter','wood'],[.85,.65,'counting ledger','paper']]);
 addRoomDecor(sites[2],[[-1.15,-1.1,'school desk','wood'],[.9,-1.1,'school desk','wood'],[-1.1,.65,'chalkboard','slate'],[.85,.7,'small chair','wood'],[.2,-.1,'empty child coat','cloth',true]]);
 addRoomDecor(sites[3],[[-1.15,-1.05,'ward bed','metal'],[.9,-1.1,'medicine cabinet','metal'],[-1.1,.65,'privacy screen','cloth'],[.85,.7,'covered form','cloth',true],[.25,.25,'dark stain','blood',true]]);
 addRoomDecor(sites[4],[[-1.15,-1.05,'deputy desk','wood'],[.9,-1.1,'file cabinet','metal'],[-1.15,.7,'evidence board','paper'],[.8,.65,'visitor chair','wood'],[.15,.15,'dark handprint','blood',true]]);
 addRoomDecor(sites[5],[[-1.15,-1.1,'altar','stone'],[.9,-1.05,'candle stand','metal'],[-1.1,.7,'pew','wood'],[.9,.7,'pew','wood'],[.15,.05,'wet hymnbook','paper',true]]);
 addRoomDecor(sites[6],[[-1.15,-1.05,'hotel bed','wood'],[.9,-1.1,'wardrobe','wood'],[-1.15,.7,'nightstand','wood'],[.85,.7,'black mirror','glass',true]]);
 addRoomDecor(sites[7],[[-1.15,-1.05,'workbench','metal'],[.9,-1.1,'tool cabinet','metal'],[-1.1,.7,'hanging coat','cloth'],[.8,.7,'hooked silhouette','metal',true],[.1,.1,'dark stain','blood',true]]);
 addRoomDecor(sites[8],[[-1.15,-1.05,'narrow bed','wood'],[.9,-1.1,'dresser','wood'],[-1.1,.7,'kitchen chair','wood'],[.85,.7,'covered form','cloth',true]]);
 addRoomDecor(sites[9],[[-1.15,-1.05,'diner booth','wood'],[.9,-1.1,'service counter','wood'],[-1.1,.7,'round table','metal'],[.85,.7,'empty chair','wood'],[.1,.1,'dark stain','blood',true]]);
 addRoomDecor(sites[11],[[-1.15,-1.05,'pump console','metal'],[.9,-1.1,'valve bank','metal'],[-1.1,.7,'pipe manifold','metal'],[.85,.7,'flood mark','blood',true]]);
 addRoomDecor(sites[12],[[-1.15,-1.05,'archive shelves','wood'],[.9,-1.1,'archive shelves','wood'],[-1.1,.7,'reading desk','wood'],[.85,.7,'paper stacks','paper']]);
 addRoomDecor(sites[13],[[-1.15,-1.05,'clinic cot','metal'],[.9,-1.1,'medical cabinet','metal'],[-1.1,.7,'privacy screen','cloth'],[.85,.7,'instrument tray','metal'],[.1,.1,'dark stain','blood',true]]);
 addRoomDecor(sites[15],[[-1.15,-1.05,'bunker cot','metal'],[.9,-1.1,'radio console','metal'],[-1.1,.7,'sealed locker','metal'],[.85,.7,'covered form','cloth',true]]);
 // A looping service alley into the municipal storm drains.
 for(let y=4;y<36;y++)if(y%8!==0){setTile(37,y,0);if(y%8===4)setTile(36,y,6)}
 setTile(37,34,8);doors.push({x:37.5,y:34.5,site:{name:'Storm Drain',kind:'tunnel',key:'storm grate'},open:false,door:true});
 // Woods and a dead end road beyond the south-west blocks.
 for(let y=29;y<38;y++)for(let x=1;x<6;x++)if((x*13+y*7)%4===0)setTile(x,y,5);
 const start={x:7.5,y:10.7};
 // Evidence has story significance, not just collectible flavor.
 addClue(7.5,6.8,'The address','A page torn from your father’s notebook. The ink is still damp.','Your father wrote “Mara Venn. Ask what came back from the lake.” The date beside it is tomorrow.','notebook');
 addClue(14.5,7.8,'A receipt from Bellweather','The last item on the list is a single candle.','The purchase was made three days after the store closed for good. A second receipt is pinned beneath it, same handwriting: yours.','receipt');
 addClue(6.6,14.4,'Incident report 114','A typed report from the night the river rose.','Four residents reported missing. The report lists five names. The fifth is blacked out from the inside of the paper.','report');
 addClue(22.7,6.8,'Class photograph','A school photograph with one face scratched away.','The empty space is exactly your height. Someone wrote “We kept your desk” on the back.','photograph');
 addClue(30.7,7.3,'Ward 3B','A clinical note, folded into the shape of a little house.','“Patient denies having a daughter. Patient asks every hour when she will come home.” The signature is your father’s.','medical');
 addClue(15.4,14.4,'The drowned bell','A strip of hymn paper, swollen with river water.','There is a verse here that was never printed: “The town has no dead, only the ones it cannot remember.”','hymn');
 addClue(30.8,14.6,'Shift ledger','A factory ledger with the night shift crossed out.','Every worker signed in on the same date, in the same hand. Their final entry reads: “Still hearing it under the floor.”','ledger');
 addClue(14.3,30.5,'The sealed tape','An unlabelled microcassette, warm to the touch.','A voice on the tape says your name, then your father says: “If you hear this, don’t let Mara open the door.”','tape');
 addClue(23.4,22.7,'Grave 0','A fresh patch of earth with a blank headstone.','The earth is warm. The stone reflects a name that disappears when you turn around.','grave');
 addClue(30.7,30.8,'Relay log','A radio log marked with today’s date.','The signal is coming from beneath Ashgate. The operator’s final words: “There is no beneath. There is only the other side.”','relay');
 spawnPeople();return start;
}
function addClue(x,y,title,teaser,text,id){const c={x,y,title,teaser,text,id,found:false,type:'clue',room:roomAt(x,y)};clues.push(c);objects.push(c);return c}
function spawnPeople(){
 const defs=[
  ['Mara Venn',7.4,7.1,'The neighbor who kept your house key.','Irene was supposed to leave with the last train.','Her porch light is on. She does not own a lamp.','gentle'],
  ['Jonah Pike',14.7,7.3,'Grocery clerk, though the store is shuttered.','Your father bought the same thing every Thursday.','He keeps counting the cans. He always loses his place at seven.','wary'],
  ['Deputy Ellis',7.6,14.7,'The night deputy. His uniform is dry in the rain.','You weren’t on the list when they found the car.','His incident report is missing one name. He knows which.','guarded'],
  ['June Bell',15.2,14.7,'A woman kneeling in the church aisle.','The bell rings from underwater now.','She remembers a funeral with no body and a eulogy in your voice.','sad'],
  ['Nurse Ada',30.5,7.2,'A nurse with a visitor badge dated 1998.','Your father asked us to keep the room ready.','She says your father is the patient. She says you were the one who called.','calm'],
  ['Cal Rowan',14.6,23.5,'Diner cook. His coffee has a skin of dust.','There is always a place set for one more.','He says you should eat before you go. He does not look at the empty chair.','warm'],
  ['The Drifter',22.4,30.4,'Someone standing where the forest road ends.','I remember the first version of you.','The face is almost familiar. It moves only when you look away.','unknown']
 ];
 defs.forEach((d,i)=>people.push({name:d[0],x:d[1],y:d[2],role:d[3],line:d[4],secret:d[5],temper:d[6],memory:0,fear:0,met:false,phase:rnd(0,6.2),home:{x:d[1],y:d[2]},routine:i%3,activity:'waiting',activityTimer:rnd(1,5),look:0,gesture:0}));
}
// Ashgate has a few stubborn residents that never learned to leave: a street cat and crows.
critters.push({x:4.7,y:9.1,name:'Stray cat',sprite:'cat',phase:rnd(0,6),home:{x:4.7,y:9.1},speed:.18});
for(let i=0;i<4;i++)critters.push({x:3.2+i*.55,y:6.4+Math.sin(i)*.35,name:'Crow',sprite:'bird',phase:i*1.7,home:{x:3.2+i*.55,y:6.4+Math.sin(i)*.35},speed:.28});
const start=buildTown();
const state={x:start.x,y:start.y,angle:-Math.PI/2,pitch:0,health:92,mind:78,stamina:100,hunger:14,thirst:9,fatigue:8,ammo:2,med:1,flash:true,keys:[],found:0,decisions:[],time:6.67,weather:'OVERCAST',weatherTimer:75,day:1,alert:0,steps:0,ending:false,started:false,paused:false,near:null,radio:false,crouch:false,lastEvent:0,visitCount:0,seed:Math.random()};
const keysDown=new Set(),depthBuffer=new Float32Array(W),offscreen=document.createElement('canvas');offscreen.width=W;offscreen.height=H;const oc=offscreen.getContext('2d');
const textures={1:['#494440','#56514b','#363435'],2:['#49423d','#665950','#393432'],3:['#4c4a46','#5b5954','#3b3a38'],4:['#434744','#585b55','#343735'],5:['#37423a','#505c4a','#2e352e'],8:['#49352f','#674b41','#352b28'],6:['#292b2d','#37393a','#252628']};
function resize(){const d=Math.min(1.6,devicePixelRatio||1);canvas.style.imageRendering='pixelated';}window.addEventListener('resize',resize);resize();
let frame=0,toastTimer=0,toastNode=$('#toast'),lastTime=performance.now(),lastStep=0;
function sky(){const night=Math.max(0,Math.min(1,(state.time<5||state.time>19)?1:.15));return{top:night?[17,20,25]:[48,55,59],low:night?[42,45,47]:[113,112,104],fog:state.weather==='FOG'?7:state.weather==='RAIN'?9:night?12:15}}
function render(){
 const horizon=H*(.49+state.pitch),g=oc.createLinearGradient(0,0,0,horizon+H*.08),s=sky();g.addColorStop(0,`rgb(${s.top.join(',')})`);g.addColorStop(1,`rgb(${s.low.join(',')})`);oc.fillStyle=g;oc.fillRect(0,0,W,Math.min(H,horizon+H*.08));
 const floor=oc.createLinearGradient(0,horizon-H*.01,0,H);floor.addColorStop(0,'#383633');floor.addColorStop(.28,state.weather==='RAIN'?'#27292a':'#302f2e');floor.addColorStop(1,'#111315');oc.fillStyle=floor;oc.fillRect(0,Math.max(0,horizon-H*.01),W,H);
 // Long asphalt seams and a road that disappears into damp town fog.
 oc.strokeStyle='rgba(194,185,164,.09)';oc.lineWidth=1;for(let i=0;i<8;i++){const y=horizon+H*.06+i*i*4;oc.beginPath();oc.moveTo(W/2-8-i*22,y);oc.lineTo(W/2+8+i*22,y);oc.stroke()}
 const fov=1.08,step=2;
 for(let sx=0;sx<W;sx+=step){const cam=2*sx/W-1,rayA=state.angle+Math.atan(cam*Math.tan(fov/2)),rx=Math.cos(rayA),ry=Math.sin(rayA);let mx=Math.floor(state.x),my=Math.floor(state.y),ddx=Math.abs(1/(rx||.00001)),ddy=Math.abs(1/(ry||.00001)),sxstep,ystep,sdx,sdy,side=0;
  if(rx<0){sxstep=-1;sdx=(state.x-mx)*ddx}else{sxstep=1;sdx=(mx+1-state.x)*ddx}if(ry<0){ystep=-1;sdy=(state.y-my)*ddy}else{ystep=1;sdy=(my+1-state.y)*ddy}
  let wall=0,guard=0;while(!wall&&guard++<70){if(sdx<sdy){sdx+=ddx;mx+=sxstep;side=0}else{sdy+=ddy;my+=ystep;side=1}wall=tile(mx,my)}
  let d=side===0?(mx-state.x+(1-sxstep)/2)/(rx||.0001):(my-state.y+(1-ystep)/2)/(ry||.0001);d=Math.max(.08,d);for(let z=sx;z<sx+step;z++)depthBuffer[z]=d;
  const wallH=Math.min(H*1.5,H*.83/d),top=horizon-wallH*.5,shade=Math.max(.15,1-d/(s.fog*1.5)),tex=textures[wall]||textures[1],edge=((side===0?state.y+d*ry:state.x+d*rx)%1+1)%1,edgeShade=(side&&((edge>.94)||(edge<.06)))?.67:1;
  const band=Math.sin((edge*10+frame*.004))*2,br=wall===8?'#765645':tex[Math.floor((edge*11+Math.floor(mx+my))%tex.length)];let rgb=hexRgb(br);const fog=Math.min(.8,d/(s.fog*1.2));for(let c=0;c<3;c++)rgb[c]=Math.floor((rgb[c]*shade*edgeShade*(wall===8?1.1:1))*(1-fog)+s.low[c]*fog);oc.fillStyle=`rgb(${rgb.join(',')})`;oc.fillRect(sx,top,step+1,wallH);
  // Brick courses, peeling plaster, damp streaks and a few tired windows.
  if(wall!==6&&wall!==8){oc.fillStyle=`rgba(12,13,14,${.11+fog*.12})`;for(let k=1;k<5;k++)if((Math.floor(edge*7)+k)%2===0)oc.fillRect(sx,top+wallH*k/5,step+1,1);if(edge>.13&&edge<.34&&wallH>28){oc.fillStyle=`rgba(183,167,133,${.14*shade})`;oc.fillRect(sx,top+wallH*.28,step+1,wallH*.23);oc.fillStyle='rgba(10,12,13,.4)';oc.fillRect(sx,top+wallH*.3,step+1,wallH*.18)}}
  if(wall===8){oc.fillStyle=`rgba(12,10,9,${.27+fog*.2})`;oc.fillRect(sx,top+wallH*.15,step+1,wallH*.72);oc.fillStyle=`rgba(158,105,82,${.16*shade})`;oc.fillRect(sx,top+wallH*.5,step+1,2)}
  if(wall===6){oc.fillStyle=`rgba(183,178,160,${.12*shade})`;oc.fillRect(sx,top+wallH*.45,step+1,1)}
  if(d<5&&state.flash){const beam=Math.max(0,1-Math.abs(cam)*1.8)*.16;oc.fillStyle=`rgba(210,205,185,${beam})`;oc.fillRect(sx,top,step+1,wallH)}
  if(fog>.35){oc.fillStyle=`rgba(${s.low.join(',')},${fog*.5})`;oc.fillRect(sx,top,step+1,wallH)}
 }
 // Empty street silhouettes, lit windows and the smear where the road seems to dip.
 drawStreetDetails();
 const sprites=[],activeRoom=roomAt(state.x,state.y);for(const p of people)sprites.push({...p,sprite:'person'});for(const c of critters)sprites.push({...c});for(const o of objects){const visible=o.type==='sign'||(!o.room&&!roomAt(o.x,o.y))||o.room===activeRoom;if(visible)sprites.push({...o,sprite:o.type==='clue'?'clue':o.type})}
 for(const e of threats)sprites.push({...e,sprite:'threat'});
 sprites.sort((a,b)=>{const da=(b.x-state.x)*Math.cos(state.angle)+(b.y-state.y)*Math.sin(state.angle),db=(a.x-state.x)*Math.cos(state.angle)+(a.y-state.y)*Math.sin(state.angle);return da-db});
 for(const e of sprites)drawSprite(e);
 if(state.weather==='RAIN'||state.weather==='STORM'){oc.strokeStyle='rgba(180,190,195,.22)';oc.lineWidth=1;for(let i=0;i<65;i++){const x=(i*127+frame*7*(i%3+1))%W,y=(i*71+frame*13)%H;oc.beginPath();oc.moveTo(x,y);oc.lineTo(x-3,y+8);oc.stroke()}}
 if(state.weather==='FOG'){oc.fillStyle='rgba(167,171,167,.12)';oc.fillRect(0,0,W,H)}
 if(state.alert>0){const vign=oc.createRadialGradient(W/2,H/2,80,W/2,H/2,330);vign.addColorStop(0,'transparent');vign.addColorStop(1,`rgba(79,20,20,${Math.min(.26,state.alert*.06)})`);oc.fillStyle=vign;oc.fillRect(0,0,W,H)}
 ctx.drawImage(offscreen,0,0);
}
function hexRgb(v){if(v.startsWith('#'))return[parseInt(v.slice(1,3),16),parseInt(v.slice(3,5),16),parseInt(v.slice(5,7),16)];return v.split(',').map(Number)}
function drawStreetDetails(){
 const horizon=H*(.49+state.pitch),night=state.time<5||state.time>19;
 // A wavering distant row of roofs makes streets feel wider than the raycast blocks.
 for(let n=0;n<6;n++){const x=((n*117+W*.13-state.x*11)%W+W)%W,y=horizon-10-(n%3)*7;oc.fillStyle=night?'#22272a':'#424442';oc.fillRect(x,y,18+n%3*8,12);oc.fillStyle=night?'#171a1c':'#343636';oc.fillRect(x+3,y-5,10,6)}
 const lamp=night?'.23':'.09';for(let n=0;n<5;n++){const x=(n*151+W*.13+(state.x*5)%100)%W,y=horizon+18+n*4;oc.strokeStyle='rgba(19,20,20,.65)';oc.beginPath();oc.moveTo(x,y);oc.lineTo(x,y+48+n*8);oc.stroke();oc.fillStyle=`rgba(223,186,123,${lamp})`;oc.beginPath();oc.arc(x,y,4,0,Math.PI*2);oc.fill()}
 if(state.time>20||state.time<5){oc.fillStyle='rgba(191,191,180,.55)';oc.beginPath();oc.arc(W*.81,clamp(horizon-H*.36,8,H-8),8,0,Math.PI*2);oc.fill()}
}
function drawSprite(e){
 const dx=e.x-state.x,dy=e.y-state.y,ca=Math.cos(state.angle),sa=Math.sin(state.angle),forward=dx*ca+dy*sa,side=-dx*sa+dy*ca;if(forward<.15)return;
 const px=W/2+side/forward*(W*.72),scale=H*.72/forward,height=(e.sprite==='person'||e.sprite==='threat')?scale*1.45:(e.sprite==='cat'?scale*.34:e.sprite==='bird'?scale*.23:scale*.48),width=(e.sprite==='person'||e.sprite==='threat')?height*.43:e.sprite==='cat'?height*1.4:e.sprite==='bird'?height*1.6:height*.8,top=H*(.49+state.pitch)-height*.48;
 if(px<-width||px>W+width)return;const col=clamp(Math.round(px),0,W-1);if(depthBuffer[col]<forward-.12)return;
 if(e.sprite==='person'||e.sprite==='threat'){
  const fear=e.fear||0,disturb=e.sprite==='threat'||state.alert>1;oc.fillStyle='rgba(0,0,0,.4)';oc.beginPath();oc.ellipse(px,H*(.49+state.pitch)+height*.48,width*.58,Math.max(2,height*.06),0,0,Math.PI*2);oc.fill();
  // Coat, uneven shoulders and a face mostly obscured by the darkness.
  oc.fillStyle=e.sprite==='threat'?'#252527':(e.temper==='warm'?'#514c44':e.temper==='wary'?'#474943':'#3e4242');oc.beginPath();oc.moveTo(px-width*.42,top+height*.38);oc.lineTo(px-width*.32,top+height*.26);oc.lineTo(px-width*.16,top+height*.22);oc.lineTo(px+width*.2,top+height*.22);oc.lineTo(px+width*.38,top+height*.4);oc.lineTo(px+width*.31,top+height*.92);oc.lineTo(px-width*.33,top+height*.92);oc.closePath();oc.fill();
  const walk=Math.sin(frame*.13+(e.phase||0))*height*.035,gesture=Math.sin(frame*.045+(e.phase||0))*(e.gesture||0);oc.strokeStyle='#282a29';oc.lineWidth=Math.max(1,width*.12);oc.beginPath();oc.moveTo(px-width*.15,top+height*.83);oc.lineTo(px-width*.17+walk,top+height*.98);oc.moveTo(px+width*.15,top+height*.83);oc.lineTo(px+width*.17-walk,top+height*.98);oc.moveTo(px-width*.3,top+height*.42);oc.lineTo(px-width*.43,top+height*.62+gesture);oc.moveTo(px+width*.3,top+height*.42);oc.lineTo(px+width*.43,top+height*.62-gesture);oc.stroke();oc.fillStyle='#272525';oc.fillRect(px-width*.13,top+height*.08,width*.27,height*.23);oc.fillStyle=disturb?'#4b3837':'#6d6255';oc.beginPath();oc.ellipse(px,top+height*.23,width*.23,height*.16,0,0,Math.PI*2);oc.fill();
  if(disturb){oc.fillStyle='#a64c43';oc.fillRect(px-width*.12,top+height*.23,Math.max(2,width*.08),Math.max(1,height*.012));oc.fillRect(px+width*.05,top+height*.23,Math.max(2,width*.08),Math.max(1,height*.012));oc.strokeStyle='rgba(139,61,51,.7)';oc.beginPath();oc.moveTo(px,top+height*.28);oc.lineTo(px+width*.06,top+height*.52);oc.stroke()}
  if(e.sprite==='person'&&forward<3.5&&height>48){oc.fillStyle='#ded1bb';oc.font=`${Math.max(8,Math.min(11,scale*.11))}px DM Mono`;oc.textAlign='center';oc.fillText(e.name.split(' ')[0].toUpperCase(),px,top-5)}
 }else if(e.sprite==='cat'){
   const bob=Math.sin(frame*.09+e.phase)*height*.035;oc.fillStyle='rgba(0,0,0,.35)';oc.beginPath();oc.ellipse(px,H*(.49+state.pitch)+height*.42,width*.62,Math.max(1,height*.08),0,0,Math.PI*2);oc.fill();oc.fillStyle='#353632';oc.beginPath();oc.ellipse(px,top+height*.56+bob,width*.38,height*.25,0,0,Math.PI*2);oc.fill();oc.beginPath();oc.moveTo(px+width*.2,top+height*.56);oc.quadraticCurveTo(px+width*.62,top+height*.32,px+width*.54,top+height*.18);oc.strokeStyle='#353632';oc.lineWidth=Math.max(1,width*.09);oc.stroke();oc.fillStyle='#252725';oc.beginPath();oc.moveTo(px-width*.12,top+height*.43);oc.lineTo(px-width*.2,top+height*.18);oc.lineTo(px,top+height*.36);oc.moveTo(px+width*.12,top+height*.43);oc.lineTo(px+width*.2,top+height*.18);oc.lineTo(px,top+height*.36);oc.fill();
  }else if(e.sprite==='bird'){
   const flap=Math.sin(frame*.22+e.phase)*height*.35;oc.fillStyle='#292d2d';oc.beginPath();oc.ellipse(px,top+height*.56,width*.2,height*.13,0,0,Math.PI*2);oc.fill();oc.strokeStyle='#292d2d';oc.lineWidth=Math.max(1,width*.12);oc.beginPath();oc.moveTo(px-width*.1,top+height*.56);oc.quadraticCurveTo(px-width*.45,top+height*.2+flap,px-width*.55,top+height*.5);oc.moveTo(px+width*.1,top+height*.56);oc.quadraticCurveTo(px+width*.45,top+height*.2-flap,px+width*.55,top+height*.5);oc.stroke();
  }else if(e.sprite==='clue'){
  const pulse=.7+Math.sin(frame*.06+e.x)*.2;oc.fillStyle=`rgba(189,137,103,${.12*pulse})`;oc.beginPath();oc.arc(px,top+height*.6,width*.9,0,7);oc.fill();oc.fillStyle='#b88b69';oc.fillRect(px-width*.16,top+height*.28,width*.32,height*.34);oc.fillStyle='#efe2c6';oc.fillRect(px-width*.1,top+height*.33,width*.2,1);oc.fillRect(px-width*.1,top+height*.39,width*.18,1)
 }else if(e.sprite==='sign'){
  if(forward<4){oc.fillStyle='#3d3d37';oc.fillRect(px-width*.45,top+height*.22,width*.9,height*.5);oc.strokeStyle='#8c826d';oc.strokeRect(px-width*.45,top+height*.22,width*.9,height*.5)}
 }else if(e.sprite==='furniture'||e.sprite==='horror'||e.sprite==='blood'){
  drawRoomObject(e,px,top,width,height)
 }else if(e.sprite==='threat'){}
}
function drawRoomObject(e,px,top,width,height){
  const floor=top+height*.94,name=(e.name||'').toLowerCase(),style=e.style||'wood';
  const dark=style==='metal'?'#272c2c':style==='cloth'?'#302e2b':style==='stone'?'#292927':'#292824',mid=style==='metal'?'#454a49':style==='cloth'?'#514c47':style==='stone'?'#4b4945':'#494238',light=style==='metal'?'#646966':style==='cloth'?'#686057':style==='stone'?'#625f58':'#625746';
  oc.fillStyle='rgba(0,0,0,.4)';oc.beginPath();oc.ellipse(px,floor,width*.48,Math.max(1,height*.075),0,0,Math.PI*2);oc.fill();
  if(e.sprite==='blood'){oc.fillStyle='rgba(69,20,19,.82)';oc.beginPath();oc.ellipse(px,floor-height*.05,width*.42,height*.1,-.12,0,Math.PI*2);oc.fill();oc.fillStyle='rgba(137,44,35,.58)';oc.beginPath();oc.ellipse(px-width*.08,floor-height*.08,width*.19,height*.03,-.2,0,Math.PI*2);oc.fill();return}
  if(e.sprite==='horror'){
   if(/coat|hooked|silhouette/.test(name)){oc.strokeStyle=dark;oc.lineWidth=Math.max(2,width*.12);oc.beginPath();oc.moveTo(px,floor-height*.06);oc.lineTo(px,floor-height*.62);oc.moveTo(px-width*.26,floor-height*.48);oc.lineTo(px,floor-height*.61);oc.lineTo(px+width*.26,floor-height*.48);oc.stroke();oc.fillStyle=mid;oc.beginPath();oc.moveTo(px-width*.22,floor-height*.52);oc.lineTo(px-width*.13,floor-height*.69);oc.lineTo(px+width*.13,floor-height*.69);oc.lineTo(px+width*.22,floor-height*.52);oc.closePath();oc.fill()}
   else{oc.fillStyle='#4b4842';oc.beginPath();oc.moveTo(px-width*.45,floor-height*.12);oc.lineTo(px-width*.35,floor-height*.42);oc.lineTo(px-width*.13,floor-height*.55);oc.lineTo(px+width*.13,floor-height*.52);oc.lineTo(px+width*.39,floor-height*.37);oc.lineTo(px+width*.47,floor-height*.12);oc.closePath();oc.fill();oc.fillStyle='#292a28';oc.fillRect(px-width*.18,floor-height*.48,width*.34,height*.05)}return;
  }
  const chair=/chair|stool/.test(name),bed=/bed|cot|booth|pew/.test(name),shelf=/shelf|cabinet|wardrobe|dresser|locker/.test(name),table=/desk|table|counter|workbench|altar|console|tray|stand|valve|manifold/.test(name),panel=/mirror|screen|board/.test(name),paper=/ledger|form|stacks|hymnbook/.test(name);
  const w=width*.76,x=px-w*.5,y=floor-height*(chair?.45:bed?.45:shelf?.78:table?.57:panel?.76:paper?.3:.58),h=height*(chair?.43:bed?.43:shelf?.78:table?.55:panel?.75:paper?.24:.56);
  if(bed){oc.fillStyle=dark;oc.fillRect(x,y+h*.25,w,h*.7);oc.fillStyle=mid;oc.fillRect(x+width*.04,y+h*.32,w-width*.08,h*.55);oc.fillStyle=light;oc.fillRect(x+width*.06,y+h*.28,width*.38,h*.18)}
  else if(chair){oc.fillStyle=mid;oc.fillRect(px-width*.25,y+height*.12,width*.5,height*.15);oc.fillRect(px-width*.23,y-height*.03,width*.46,height*.2);oc.fillStyle=dark;oc.fillRect(px-width*.2,y+height*.25,width*.08,height*.2);oc.fillRect(px+width*.12,y+height*.25,width*.08,height*.2)}
  else if(shelf){oc.fillStyle=dark;oc.fillRect(x,y,w,h);oc.fillStyle=mid;oc.fillRect(x+width*.035,y+height*.025,w-width*.09,h-height*.04);for(let k=1;k<4;k++){const sy=y+h*k/4;oc.fillStyle=light;oc.fillRect(x+width*.05,sy,w-width*.13,Math.max(1,height*.025));for(let q=0;q<3;q++){oc.fillStyle=q%2?'#343632':'#77705f';oc.fillRect(x+width*(.08+q*.2),sy-height*.1,width*.11,height*.09)}}}
  else if(table){oc.fillStyle=mid;oc.beginPath();oc.moveTo(x,y+height*.1);oc.lineTo(x+width*.16,y);oc.lineTo(x+w,y+height*.03);oc.lineTo(x+w-width*.12,y+height*.14);oc.lineTo(x+width*.12,y+height*.19);oc.closePath();oc.fill();oc.fillStyle=dark;oc.fillRect(x+width*.12,y+height*.16,width*.1,h*.68);oc.fillRect(x+w-width*.2,y+height*.15,width*.1,h*.68)}
  else if(panel){oc.fillStyle=dark;oc.fillRect(x,y,w,h);oc.fillStyle=style==='glass'?'#414c4c':mid;oc.fillRect(x+width*.055,y+height*.035,w-width*.11,h-height*.07);oc.strokeStyle=light;oc.strokeRect(x+width*.075,y+height*.055,w-width*.15,h-height*.11);if(/cracked|black/.test(name)){oc.strokeStyle=dark;oc.beginPath();oc.moveTo(px,y+height*.08);oc.lineTo(px-width*.05,y+height*.31);oc.lineTo(px+width*.07,y+height*.42);oc.lineTo(px+width*.02,y+h);oc.stroke()}}
  else if(paper){oc.fillStyle=mid;oc.beginPath();oc.moveTo(x,y+height*.08);oc.lineTo(x+width*.12,y);oc.lineTo(x+w,y+height*.02);oc.lineTo(x+w-width*.08,y+height*.13);oc.closePath();oc.fill();oc.strokeStyle='rgba(220,207,177,.42)';oc.beginPath();oc.moveTo(x+width*.13,y+height*.05);oc.lineTo(x+w-width*.13,y+height*.05);oc.stroke()}
  else{oc.fillStyle=dark;oc.fillRect(x,y,w,h);oc.fillStyle=mid;oc.fillRect(x+width*.035,y+height*.025,w-width*.09,h-height*.06);oc.fillStyle=light;oc.fillRect(x+width*.07,y+height*.07,w-width*.16,Math.max(1,height*.035))}
 }
 function updateHUD(){
 $('#health-fill').style.width=`${state.health}%`;$('#mind-fill').style.width=`${state.mind}%`;$('#stamina-fill').style.width=`${state.stamina}%`;
 $('#health-num').textContent=Math.round(state.health);$('#mind-num').textContent=Math.round(state.mind);$('#stamina-num').textContent=Math.round(state.stamina);$('#med-count').textContent=state.med;$('#lamp-state').textContent=state.flash?'ON':'OFF';
 const h=Math.floor(state.time),m=Math.floor((state.time-h)*60);$('#clock').textContent=`${String(h%12||12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
 $('#weather').textContent=state.weather==='STORM'?'THUNDERSTORM':state.weather;$('#district').textContent=districtAt();
 $('#vignette').style.background=`radial-gradient(ellipse at 50% 46%,transparent ${25+state.mind*.13}%,rgba(5,6,8,.35) 78%,rgba(3,4,5,${.78+(100-state.health)*.002}) 120%)`;
}
function districtAt(){let s=sites.reduce((a,b)=>dist(state,b)<dist(state,a)?b:a,sites[0]);return s.name.toUpperCase()+' · ASHGATE'}
function say(msg,duration=3200){toastNode.textContent=msg;toastNode.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastNode.classList.remove('show'),duration)}
function nearest(){let best=null,bd=2.15;for(const p of people){const d=dist(state,p);if(d<bd){const da=Math.atan2(p.y-state.y,p.x-state.x),diff=Math.abs(Math.atan2(Math.sin(da-state.angle),Math.cos(da-state.angle)));if(diff<.95){best=p;bd=d}}}for(const c of clues){if(c.found)continue;const d=dist(state,c);if(d<bd){best=c;bd=d}}for(const d of doors){const z=dist(state,d);if(z<bd){best=d;bd=z}}return best}
function refreshPrompt(){state.near=nearest();const p=$('#prompt');if(!state.near){p.textContent='';return}let label=state.near.site?state.near.site.name:state.near.name||state.near.title;if(state.near.type==='clue')label=state.near.title;if(state.near.door)label=state.near.site.name; p.innerHTML=`<kbd>E</kbd> &nbsp; ${label.toUpperCase()}`}
function interact(){const n=state.near||nearest();if(!n){say('Only the rain answers.');return}if(n.type==='clue'){if(n.found)return;openCard(n);return}if(n.door){const d=n,site=d.site;if(!d.open){const key=site.key;if(key&&!state.keys.includes(key)){if(key==='ward key'&&state.found>=4){state.keys.push(key);say('A key has turned up in your coat pocket. No memory of putting it there.')}else{openCard({title:site.name,kind:'LOCKED',teaser:'The door will not give.',text:key==='ward key'?'A hospital key, or perhaps a reason to enter. The thought of the ward makes your teeth ache.':key==='storm grate'?'The grate is chained. Something beneath it taps, once, then twice.':'An old brass lock. The key must be nearby.','id':'locked'});return}}else if(key&&!state.keys.includes(key)){say('The lock is still closed.');return}}
   d.open=!d.open;setTile(Math.floor(d.x),Math.floor(d.y),d.open?0:8);if(d.open){say(`${site.name.toUpperCase()} · THE AIR INSIDE IS COLDER.`);if(site.kind==='bunker'&&state.found>=6){state.near={type:'ending',site};openCard({title:'THE RELAY ROOM',kind:'NO SIGNAL',teaser:'The receiver is already warm.',text:'Below the static, a voice counts down from seven. It sounds like your own. The receiver waits for an answer.','id':'ending'});}else if(site.kind==='bunker')say('The bunker is sealed from the inside. Find more of the town’s records.')}else say('The latch falls into place.');return}
  if(n.sprite==='sign'||n.type==='furniture')return;
  if(n.sprite==='threat'){if(state.ammo>0){state.ammo--;state.alert=0;threats.splice(threats.indexOf(n),1);say('The shot echoes down the block. The shape folds into the fog.');sound('shot')}else{state.health-=12;state.mind-=5;state.alert=2;say('Something cold catches your shoulder. RUN.')}return}
  if(n.name&&people.includes(n)){talk(n);return}
}
function openCard(c){state.near=c;$('#card-type').textContent=c.kind||'EVIDENCE';$('#card-title').textContent=c.title;$('#card-copy').textContent=c.teaser||c.text;$('#card-action').textContent=c.type==='clue'?'ADD TO JOURNAL':'EXAMINE';$('#interact-card').classList.remove('hidden')}
$('#card-action').addEventListener('click',()=>{const c=state.near;if(!c)return;if(c.id==='ending'){showEnding();return}if(c.type==='clue'){c.found=true;state.found++;state.mind=clamp(state.mind+2,0,100);rumors.push({title:c.title,text:c.text,day:state.day});$('#interact-card').classList.add('hidden');say(`EVIDENCE RECORDED · ${c.title.toUpperCase()}`);$('#objective-text').textContent=state.found<3?'Ask Mara what came back from the lake.':state.found<6?'Find the signal beneath Ashgate.':'The relay is waiting. Decide what to tell it.';if(c.id==='notebook')state.decisions.push('read-notebook');if(c.id==='relay')state.keys.push('ward key');renderJournal();return}if(c.id==='ending'){showEnding();return}$('#interact-card').classList.add('hidden')});
function talk(p){p.met=true;p.memory++;state.alert=Math.max(0,state.alert-.2);const altered=state.mind<35||state.day>2;$('#speaker').textContent=p.name.toUpperCase();$('#dialogue-text').textContent=p.memory===1?`${p.line}\n\n${p.name} is ${p.activity}.`:(altered?p.secret:`${p.name.split(' ')[0]} looks at you for a long moment. “You already asked me that.”`);const box=$('#choices');box.innerHTML='';const options=p.name==='Mara Venn'?['Ask about the lake','Ask about your father','Leave']:p.name==='Deputy Ellis'?['Ask about the missing report','Ask for a key','Leave']:p.name==='Nurse Ada'?['Ask who is in Ward 3B','Ask for a key','Leave']:['Ask what they remember','Offer a ration','Leave'];options.splice(options.length-1,0,'Ask about today');options.forEach((text,i)=>{const b=document.createElement('button');b.className='choice';b.innerHTML=`<b>0${i+1}</b>${text}`;b.onclick=()=>choice(p,text);box.appendChild(b)});$('#dialogue').classList.remove('hidden')}
function choice(p,text){$('#dialogue').classList.add('hidden');state.decisions.push(`${p.name}:${text}`);p.memory++;
  if(text==='Leave'){say(`${p.name.toUpperCase()} DOES NOT LOOK AWAY.`);return}
  if(text==='Ask about today'){say(`${p.name} is ${p.activity}. “Same as yesterday,” they say, without looking up.`);return}
  if(text==='Offer a ration'){if(state.hunger<40){say('You are too hungry to part with food.');return}state.hunger-=15;state.mind=clamp(state.mind+4,0,100);say(`${p.name} takes the food. They remember the gesture.`);p.fear=Math.max(0,p.fear-1);return}
  if(p.name==='Mara Venn'){if(text==='Ask about the lake'){if(state.found>=1){say('“It came back without getting wet.” Mara presses a key into your hand.');if(!state.keys.includes('brass key'))state.keys.push('brass key');state.decisions.push('mara-trusted')}else say('“Which lake?” She glances at the notebook in your hand. “You haven’t found it yet.”')}else say(p.secret)}
  else if(p.name==='Deputy Ellis'&&text==='Ask for a key'){state.keys.push('brass key');say('Ellis lets the brass key slide across the desk. “I never saw you.”');p.fear++;}
  else if(p.name==='Nurse Ada'&&text==='Ask for a key'){state.keys.push('ward key');say('Ada puts a key in your palm. “You already know which room.”');}
  else if(text==='Ask about the missing report'){say(p.secret);state.found=Math.max(state.found,1);renderJournal()}
  else if(text==='Ask who is in Ward 3B'){state.mind=clamp(state.mind-5,0,100);say('“Nobody,” Ada says. A call bell rings behind the locked door.')}
  else {say(p.secret);if(p.name==='The Drifter'){state.mind=clamp(state.mind-12,0,100);if(state.found>=6)state.decisions.push('heard-drifter')}}
}
function renderJournal(tab='clues'){
 const content=$('#journal-content');if(tab==='clues'){content.innerHTML=rumors.length?rumors.map(r=>`<article class="journal-entry"><small>RECOVERED · DAY ${r.day}</small><h3>${r.title}</h3><p>${r.text}</p></article>`).join(''):'<p class="muted">The notebook is empty. The town is not.</p>';$('#clue-count').textContent=state.found}
 else if(tab==='people'){content.innerHTML=people.map(p=>`<article class="journal-entry"><small>${p.met?'ENCOUNTERED':'UNCONFIRMED'} · ${p.temper.toUpperCase()}</small><h3>${p.name}</h3><p>${p.met?p.secret:'No reliable description. Residents avoid the subject.'}</p></article>`).join('')}
 else{content.innerHTML=`<article class="journal-entry"><small>PHYSICAL</small><h3>Health ${Math.round(state.health)}% · Hunger ${Math.round(state.hunger)}% · Thirst ${Math.round(state.thirst)}%</h3><p>Fatigue ${Math.round(state.fatigue)}%. You can run, but not forever.</p></article><article class="journal-entry"><small>PSYCHOLOGICAL</small><h3>Composure ${Math.round(state.mind)}%</h3><p>${state.mind<25?'You hear the town speaking in your own voice.':state.mind<50?'The edges of familiar places will not hold still.':'You are doing your best to keep the details straight.'}</p></article><article class="journal-entry"><small>POCKETS</small><h3>${state.keys.length?state.keys.join(' · '):'No keys'} · ${state.ammo} rounds</h3><p>${state.med} medical supplies. The radio has no station.</p></article>`}
}
$$('.tab').forEach(t=>t.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.toggle('selected',x===t));renderJournal(t.dataset.tab)}));
function $$(s){return[...document.querySelectorAll(s)]}
function showPanel(id){state.paused=true;$('#'+id).classList.remove('hidden');if(id==='journal')renderJournal($('.tab.selected')?.dataset.tab||'clues');if(id==='map-panel')drawMap()}
function closePanels(){$$('.panel').forEach(p=>p.classList.add('hidden'));$('#dialogue').classList.add('hidden');$('#interact-card').classList.add('hidden');state.paused=false}
$$('[data-close]').forEach(b=>b.onclick=closePanels);$('#journal-button').onclick=()=>showPanel('journal');$('#map-button').onclick=()=>showPanel('map-panel');
function drawMap(){const c=$('#minimap'),m=c.getContext('2d'),sc=c.width/MW;m.fillStyle='#242526';m.fillRect(0,0,c.width,c.height);for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){const t=tile(x,y);if(t===6){m.fillStyle='#55534c';m.fillRect(x*sc,y*sc,sc,sc)}else if(t===5){m.fillStyle='#303c33';m.fillRect(x*sc,y*sc,sc,sc)}else if(t>0){m.fillStyle=t===8?'#332927':t===4?'#494842':'#393936';m.fillRect(x*sc,y*sc,sc,sc)}}for(const s of sites){m.fillStyle='#b5947d';m.fillRect((s.x-2)*sc,(s.y-2)*sc,5*sc,5*sc);m.fillStyle='#ded1bb';m.font='7px monospace';m.fillText(s.name.split(' ')[0],(s.x-2)*sc,(s.y-2)*sc-2)}m.fillStyle='#edc7a6';m.beginPath();m.arc(state.x*sc,state.y*sc,sc*.42,0,Math.PI*2);m.fill();m.strokeStyle='#edc7a6';m.beginPath();m.moveTo(state.x*sc,state.y*sc);m.lineTo((state.x+Math.cos(state.angle)*1.5)*sc,(state.y+Math.sin(state.angle)*1.5)*sc);m.stroke()}
let audio=null,master=null;
function initAudio(){if(audio)return;try{audio=new(window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=.14;master.connect(audio.destination);const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=44;gain.gain.value=.18;osc.connect(gain);gain.connect(master);osc.start();}catch(e){}}
function sound(type='ambient') {if(!audio)return;try{const osc=audio.createOscillator(),gain=audio.createGain();osc.connect(gain);gain.connect(master);const now=audio.currentTime;if(type==='shot'){osc.type='sawtooth';osc.frequency.setValueAtTime(110,now);osc.frequency.exponentialRampToValueAtTime(35,now+.22);gain.gain.setValueAtTime(.32,now);gain.gain.exponentialRampToValueAtTime(.001,now+.35);osc.start();osc.stop(now+.36)}else{osc.type='triangle';osc.frequency.setValueAtTime(rnd(90,180),now);osc.frequency.exponentialRampToValueAtTime(40,now+1.6);gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(.07,now+.1);gain.gain.exponentialRampToValueAtTime(.001,now+1.8);osc.start();osc.stop(now+1.85)}}catch(e){}}
function startGame(){initAudio();state.started=true;state.paused=false;$('#game-shell').classList.add('playing');$('#start-screen').classList.add('hidden');$('#fade').classList.remove('on');say('ASHGATE · 06:40 AM · OVERCAST',3800);sound();loop(performance.now())}
$('#begin').onclick=startGame;$('#again').onclick=()=>location.reload();
function loop(now){if(!state.started)return;const dt=Math.min(.05,(now-lastTime)/1000||.016);lastTime=now;frame++;if(!state.paused)update(dt);render();updateHUD();refreshPrompt();requestAnimationFrame(loop)}
function update(dt){
 // Real time, imperfectly synchronized to the clock in town hall.
 state.time=(state.time+dt*.11)%24;if(state.time<.12&&state.time+dt*.11>=.12)state.day++;state.weatherTimer-=dt;if(state.weatherTimer<=0){state.weatherTimer=rnd(55,130);state.weather=pick(['OVERCAST','RAIN','FOG','STORM','OVERCAST','CLEAR']);say(state.weather==='STORM'?'A low, distant thunder rolls across the town.':state.weather==='FOG'?'The fog is thickening. You lose sight of the road.':state.weather==='RAIN'?'Rain begins to patter against the empty street.':'The weather shifts. You cannot tell which way the wind is going.',2600)}
 const night=state.time<5||state.time>20;state.hunger=clamp(state.hunger+dt*.035,0,100);state.thirst=clamp(state.thirst+dt*.06,0,100);state.fatigue=clamp(state.fatigue+dt*.018,0,100);if(state.hunger>85||state.thirst>88){state.health=clamp(state.health-dt*.24,0,100);state.mind=clamp(state.mind-dt*.08,0,100)}
 if(state.mind<27&&Math.random()<dt*.018)hallucination();if(night&&state.mind<60&&Math.random()<dt*.025)hallucination();
 let forward=(keysDown.has('w')||keysDown.has('arrowup'))-(keysDown.has('s')||keysDown.has('arrowdown')),strafe=(keysDown.has('d')||keysDown.has('arrowright'))-(keysDown.has('a')||keysDown.has('arrowleft'));
 state.crouch=keysDown.has('control')||keysDown.has('c');const running=keysDown.has('shift')&&state.stamina>2&&!state.crouch,speed=(state.crouch ? .9 : running ? 3.05 : 1.75)*(state.fatigue>75?.7:1);if(running&&forward)state.stamina=clamp(state.stamina-dt*20,0,100);else state.stamina=clamp(state.stamina+dt*11,0,100);
 if(state.health<45)speedFactor=.8;else speedFactor=1;
 const move=(forward?1:0)+(strafe?1:0),norm=move?1/Math.sqrt((forward?1:0)+(strafe?1:0)):1,dx=(Math.cos(state.angle)*forward-Math.sin(state.angle)*strafe)*speed*dt*norm*speedFactor,dy=(Math.sin(state.angle)*forward+Math.cos(state.angle)*strafe)*speed*dt*norm*speedFactor;movePlayer(dx,dy);
 if(forward||strafe){state.steps+=dt*(running?1.8:1);if(state.steps-lastStep>.58){lastStep=state.steps;if(Math.random()<.035)sound();}}
 if(state.alert>0)state.alert=Math.max(0,state.alert-dt*.09);
 movePeople(dt,night);moveThreats(dt,night);
 if(state.radio&&Math.random()<dt*.12)sound('radio');
 if(state.health<=0||state.fatigue>=100)die();
}
let speedFactor=1;
function movePlayer(dx,dy){const r=.22;const nx=state.x+dx,ny=state.y+dy;if(!collides(nx,state.y,r))state.x=nx;if(!collides(state.x,ny,r))state.y=ny}
function movePeople(dt,night){
 const hour=state.time;for(const p of people){const d=dist(state,p);p.phase+=dt*(p.routine===0?.75:.43);p.activityTimer-=dt;
  const activity=night?(p.routine===2?'watching the road':'turning in for the night'):hour<9?'opening for the day':hour<17?['at work','making rounds','keeping watch'][p.routine]:'walking home';
  if(p.activity!==activity){p.activity=activity;p.activityTimer=0;p.gesture=rnd(.2,1)}
  if(p.activityTimer<=0){p.activityTimer=rnd(2.5,6);p.target={x:p.home.x+rnd(-.62,.62),y:p.home.y+rnd(-.48,.48)}}
  if(d<3.2){p.look=Math.min(1,p.look+dt*2);if(night)p.fear+=dt*.08}else p.look=Math.max(0,p.look-dt*.3);
  const tx=p.target?.x??p.home.x,ty=p.target?.y??p.home.y,dx=tx-p.x,dy=ty-p.y,step=dt*.17;if(Math.hypot(dx,dy)>.08){const nx=p.x+Math.sign(dx)*Math.min(Math.abs(dx),step),ny=p.y+Math.sign(dy)*Math.min(Math.abs(dy),step);if(!collides(nx,p.y,.16))p.x=nx;if(!collides(p.x,ny,.16))p.y=ny}
 }
 for(const c of critters){const playerDistance=dist(state,c);if(c.sprite==='cat'&&playerDistance<1.1&&!c.fleeing){const away=Math.atan2(c.y-state.y,c.x-state.x);c.home.x=clamp(c.x+Math.cos(away)*1.8,2,MW-2);c.home.y=clamp(c.y+Math.sin(away)*1.8,2,MH-2);c.fleeing=true}else if(playerDistance>2.2)c.fleeing=false;c.phase+=dt*(c.sprite==='bird'?1.5:.65);const radius=c.sprite==='bird'?.24:.8,tx=c.home.x+Math.sin(c.phase)*radius,ty=c.home.y+Math.cos(c.phase*.73)*radius*.65,step=dt*c.speed;if(!collides(tx,ty,.08)){c.x+=(tx-c.x)*Math.min(1,step);c.y+=(ty-c.y)*Math.min(1,step)}}
}
function moveThreats(dt,night){
 if(night&&threats.length===0&&Math.random()<dt*.014){const a=state.angle+pick([-1,1])*rnd(.65,1.3),x=state.x+Math.cos(a)*rnd(5,8),y=state.y+Math.sin(a)*rnd(5,8);if(!collides(x,y,.2))threats.push({x,y,name:'The Listener',sprite:'threat',mode:'stalk',speed:rnd(.4,.65),cooldown:0})}
 for(let i=threats.length-1;i>=0;i--){const e=threats[i],d=dist(state,e);if(d<.62){e.cooldown-=dt;if(e.cooldown<=0){state.health-=rnd(5,11);state.mind=clamp(state.mind-4,0,100);state.alert=2;e.cooldown=1.8;say('A hand closes around your sleeve. It is colder than the rain.');sound('threat')}}else if(d<5||state.alert>0){const vx=(state.x-e.x)/d,vy=(state.y-e.y)/d,step=e.speed*dt*(state.crouch?.65:1);if(!collides(e.x+vx*step,e.y,.2))e.x+=vx*step;if(!collides(e.x,e.y+vy*step,.2))e.y+=vy*step}else if(d>11)threats.splice(i,1)}
}
function hallucination(){state.mind=clamp(state.mind-.4,0,100);const events=['Footsteps stop when you stop.','Someone knocks from the other side of a wall.','A voice on the radio says your name.','A window holds a face, then only its reflection.','You hear a child counting down the street.','The street sign reads your childhood address.','A shadow moves against the light.'];say(pick(events),2400);if(Math.random()<.28)sound('threat');if(Math.random()<.25)$('#vignette').style.filter='hue-rotate(25deg)';setTimeout(()=>$('#vignette').style.filter='',850)}
function doAction(key){if(!state.started)return;if(key==='e'){if(!$('#dialogue').classList.contains('hidden'))return;if(!$('#interact-card').classList.contains('hidden')){$('#card-action').click();return}interact()}else if(key==='j'){if($('#journal').classList.contains('hidden'))showPanel('journal');else closePanels()}else if(key==='m'){if($('#map-panel').classList.contains('hidden'))showPanel('map-panel');else closePanels()}else if(key==='1'){state.flash=!state.flash;say(state.flash?'Flashlight on. The beam feels too narrow.':'Flashlight off. The dark is not empty.')}else if(key==='2'){state.radio=!state.radio;say(state.radio?'The radio clicks softly. No station.':'You switch off the radio.')}else if(key==='3'){if(state.med>0&&state.health<100){state.med--;state.health=clamp(state.health+38,0,100);say('You bind the wound. Your hands keep shaking.')}else say('Nothing to use.')}else if(key==='q'){if(state.ammo>0){state.ammo--;state.alert=0;const e=threats[0];if(e&&dist(state,e)<6)threats.splice(0,1);say('One shot. The sound is swallowed by the fog.');sound('shot')}else say('The gun is empty.')}else if(key==='escape')closePanels()}
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift','control','c'].includes(k)){keysDown.add(k);e.preventDefault()}if(!e.repeat&&['e','j','m','1','2','3','q','escape'].includes(k))doAction(k)});window.addEventListener('keyup',e=>keysDown.delete(e.key.toLowerCase()));
 $$('#mobile-controls [data-hold]').forEach(button=>{const key=button.dataset.hold;const release=()=>{keysDown.delete(key);button.classList.remove('pressed')};button.addEventListener('pointerdown',e=>{e.preventDefault();keysDown.add(key);button.classList.add('pressed');button.setPointerCapture?.(e.pointerId)});button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release)});$$('#mobile-controls [data-action]').forEach(button=>button.addEventListener('click',()=>doAction(button.dataset.action)));window.addEventListener('blur',()=>keysDown.clear());
let mouseDown=false,lastMouseX=0,lastMouseY=0;canvas.addEventListener('pointerdown',e=>{if(!state.started||matchMedia('(pointer:coarse)').matches)return;mouseDown=true;lastMouseX=e.clientX;lastMouseY=e.clientY;canvas.setPointerCapture?.(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(!mouseDown||state.paused)return;state.angle+=(e.clientX-lastMouseX)*.004;state.pitch=clamp(state.pitch-(e.clientY-lastMouseY)/innerHeight*1.25,-.28,.28);lastMouseX=e.clientX;lastMouseY=e.clientY});canvas.addEventListener('pointerup',()=>mouseDown=false);canvas.addEventListener('pointercancel',()=>mouseDown=false);
// Drag-look fallback where pointer lock is unavailable; touch pads keep controls usable on phones.
let lastTouchX=null,lastTouchY=null,touchId=null;canvas.addEventListener('touchstart',e=>{for(const t of e.changedTouches){if(state.started&&t.clientX>=innerWidth*.42){touchId=t.identifier;lastTouchX=t.clientX;lastTouchY=t.clientY;break}}},{passive:true});canvas.addEventListener('touchmove',e=>{if(lastTouchX===null)return;for(const t of e.changedTouches){if(t.identifier===touchId){state.angle+=(t.clientX-lastTouchX)*.007;state.pitch=clamp(state.pitch-(t.clientY-lastTouchY)/innerHeight*1.25,-.28,.28);lastTouchX=t.clientX;lastTouchY=t.clientY;e.preventDefault();break}}},{passive:false});const endLook=e=>{for(const t of e.changedTouches)if(t.identifier===touchId){lastTouchX=null;lastTouchY=null;touchId=null;break}};canvas.addEventListener('touchend',endLook);canvas.addEventListener('touchcancel',endLook);
function die(){if(state.ending)return;state.ending=true;state.paused=true;setTimeout(()=>showEnding(true),900)}
function showEnding(died=false){state.ending=true;$('#interact-card').classList.add('hidden');$('#dialogue').classList.add('hidden');$('#journal').classList.add('hidden');$('#map-panel').classList.add('hidden');$('#ending-screen').classList.remove('hidden');let title,copy;if(died){title='THE QUIET';copy='Ashgate closes its doors. By morning, no one remembers there was ever a visitor.'}else if(state.found>=8&&state.decisions.includes('Mara Venn:Ask about the lake')&&state.mind>35){title='THE RETURN';copy='You tell the voice your name. Somewhere above, a bell rings once. The town exhales. For the first time, a door opens from the inside.'}else if(state.decisions.some(d=>d.includes('Deputy Ellis:Ask for a key'))){title='THE RECORD';copy='You leave the relay dark. The deputy files a report. It lists four missing residents. You ask him to check the fifth name. He says there was never a fifth.'}else{title='ASHES';copy='You answer the voice with silence. By morning, the street looks ordinary again. Your father’s notebook is gone. So is the address.'}$('#ending-title').textContent=title;$('#ending-copy').textContent=copy;$('#ending-stats').textContent=`${state.found} clues recovered · ${people.filter(p=>p.met).length} residents met · Day ${state.day}`;document.exitPointerLock?.()}
function collides(x,y,r){for(const [a,b] of [[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]])if(tile(a,b)!==0&&tile(a,b)!==6&&tile(a,b)!==5)return true;return false}
})();
