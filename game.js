(() => {
'use strict';
const canvas=document.getElementById('view'),ctx=canvas.getContext('2d',{alpha:false}),W=800,H=450,MW=40,MH=40;
canvas.width=W;canvas.height=H;
const $=s=>document.querySelector(s),clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
const map=new Uint8Array(MW*MH),labels=new Array(MW*MH).fill(''),doors=[],objects=[],people=[],walkers=[],clues=[],rumors=[],threats=[];
const idx=(x,y)=>Math.floor(y)*MW+Math.floor(x),tile=(x,y)=>x<0||y<0||x>=MW||y>=MH?1:map[idx(x,y)],setTile=(x,y,v)=>{if(x>=0&&y>=0&&x<MW&&y<MH)map[idx(x,y)]=v};
const sites=[
 {x:7,y:7,name:'Mara Venn’s House',kind:'house',type:1,open:true},{x:15,y:7,name:'Bellweather Grocery',kind:'shop',type:2,open:true},{x:23,y:7,name:'Ashgate Elementary',kind:'school',type:3},{x:31,y:7,name:'St. Oran Hospital',kind:'hospital',type:4,key:'ward key'},
 {x:7,y:15,name:'Ashgate Police',kind:'police',type:4,open:true},{x:15,y:15,name:'The Drowned Bell',kind:'church',type:3},{x:23,y:15,name:'Morrow Hotel',kind:'hotel',type:2},{x:31,y:15,name:'Switchyard Works',kind:'factory',type:4,key:'brass key'},
 {x:7,y:23,name:'Cedar Street Flats',kind:'apartments',type:2},{x:15,y:23,name:'Red Fern Diner',kind:'diner',type:1,open:true},{x:23,y:23,name:'Riverside Cemetery',kind:'cemetery',type:3},{x:31,y:23,name:'North Pump Station',kind:'tunnel',type:4,key:'brass key'},
 {x:7,y:31,name:'County Archive',kind:'archive',type:3},{x:15,y:31,name:'Old Mill Clinic',kind:'clinic',type:4},{x:23,y:31,name:'Pine Hollow Road',kind:'forest',type:5},{x:31,y:31,name:'Relay Bunker',kind:'bunker',type:4,key:'ward key'}
];
function buildTown(){
 for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){if(x===0||y===0||x===MW-1||y===MH-1)setTile(x,y,1);else if((x%8<=1)||(y%8<=1))setTile(x,y,0);else setTile(x,y,0)}
 // Streets, alleys and the creek at the edge of town.
 for(let x=1;x<MW-1;x++){setTile(x,3,6);setTile(x,4,6);setTile(x,11,6);setTile(x,12,6);setTile(x,19,6);setTile(x,20,6);setTile(x,27,6);setTile(x,28,6)}
 for(let y=1;y<MH-1;y++){setTile(3,y,6);setTile(4,y,6);setTile(11,y,6);setTile(12,y,6);setTile(19,y,6);setTile(20,y,6);setTile(27,y,6);setTile(28,y,6)}
 for(const s of sites){
  const x0=s.x-2,y0=s.y-2,x1=s.x+2,y1=s.y+2;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const edge=x===x0||x===x1||y===y0||y===y1;setTile(x,y,edge?s.type:0);labels[idx(x,y)]=s.name}
  // One front door, facing the southern street; access changes the actual collision map.
  const dx=s.x,dy=y1;setTile(dx,dy,s.open?0:8);s.door={x:dx+.5,y:dy+.5,site:s,open:!!s.open,door:true};doors.push(s.door);
  // Interiors: one narrow partition, a curtained back room and a hint of lived-in clutter.
  if(s.kind!=='cemetery'&&s.kind!=='forest'){
   const wallX=s.x+(s.x%2?1:-1);for(let y=y0+2;y<y1;y++)if(y!==s.y)setTile(wallX,y,s.type);
   setTile(wallX,s.y,0);
   for(let i=0;i<3;i++)objects.push({x:s.x+rnd(-1.35,1.35),y:s.y+rnd(-1.25,1.1),type:'furniture',name:pick(['desk','chair','shelf','cabinet']),site:s,hidden:true});
  }
  objects.push({x:s.x,y:y0-.6,type:'sign',name:s.name,site:s});
 }
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
 spawnPeople();spawnWalkers();return start;
}
function addClue(x,y,title,teaser,text,id){const c={x,y,title,teaser,text,id,found:false,type:'clue'};clues.push(c);objects.push(c);return c}
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
 defs.forEach((d,i)=>people.push({name:d[0],x:d[1],y:d[2],role:d[3],line:d[4],secret:d[5],temper:d[6],memory:0,fear:0,met:false,phase:rnd(0,6.2),home:{x:d[1],y:d[2]},routine:i%3}));
}
function spawnWalkers(){
  const defs=[['Elsie Ward',3.5,8.5,'The bus stop regular.','The 6:10 still comes through, even though the rails are gone.','She checks an empty timetable and nods as if it answered.','warm'],['Tomas Reed',11.5,16.5,'A postman with a bag full of undelivered letters.','Every house gets the same letter on Thursdays.','The envelopes are addressed to people who have not been born yet.','wary'],['Ruth Calder',27.5,23.5,'A woman carrying a paper grocery bag.','The market is open if you knock three times.','Her groceries rustle though the bag is empty.','gentle'],['Mr. Vale',19.5,32.5,'A watchman walking the same block.','I take the long way home so I don’t arrive too early.','He has no shadow beneath the streetlamps.','guarded']];
  for(const d of defs)walkers.push({name:d[0],x:d[1],y:d[2],role:d[3],line:d[4],secret:d[5],temper:d[6],memory:0,fear:0,met:false,ambient:true,route:[],phase:rnd(0,6.2),speed:rnd(.22,.34)});
  for(const w of walkers)chooseWalkerRoute(w);
 }
 function chooseWalkerRoute(w){
  const sx=Math.floor(w.x),sy=Math.floor(w.y),start=idx(sx,sy);if(tile(sx,sy)!==6)return;
  const roads=[];for(let i=0;i<map.length;i++)if(map[i]===6)roads.push(i);if(!roads.length)return;
  let goal=pick(roads);for(let n=0;n<8&&Math.hypot(goal%MW-sx,Math.floor(goal/MW)-sy)<7;n++)goal=pick(roads);
  const prev=new Int32Array(map.length);prev.fill(-1);const queue=[start];prev[start]=start;
  for(let head=0;head<queue.length&&prev[goal]===-1;head++){const at=queue[head],x=at%MW,y=Math.floor(at/MW);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,ni=idx(nx,ny);if(tile(nx,ny)===6&&prev[ni]===-1){prev[ni]=at;queue.push(ni)}}}
  if(prev[goal]===-1)return;const path=[];for(let at=goal;at!==start;at=prev[at])path.push({x:at%MW+.5,y:Math.floor(at/MW)+.5});w.route=path.reverse();
 }
 const start=buildTown();
const state={x:start.x,y:start.y,angle:-Math.PI/2,pitch:0,health:92,mind:78,stamina:100,hunger:14,thirst:9,fatigue:8,ammo:2,med:1,flash:true,keys:[],found:0,decisions:[],time:6.67,weather:'OVERCAST',weatherTimer:75,day:1,alert:0,steps:0,ending:false,started:false,paused:false,near:null,radio:false,crouch:false,lastEvent:0,visitCount:0,seed:Math.random()};
const keysDown=new Set(),depthBuffer=new Float32Array(W),offscreen=document.createElement('canvas');offscreen.width=W;offscreen.height=H;const oc=offscreen.getContext('2d');
const textures={1:['#494440','#56514b','#363435'],2:['#49423d','#665950','#393432'],3:['#4c4a46','#5b5954','#3b3a38'],4:['#434744','#585b55','#343735'],5:['#37423a','#505c4a','#2e352e'],8:['#49352f','#674b41','#352b28'],6:['#292b2d','#37393a','#252628']};
function resize(){canvas.style.imageRendering='auto';}window.addEventListener('resize',resize);resize();
let frame=0,toastTimer=0,toastNode=$('#toast'),lastTime=performance.now(),lastStep=0;
function sky(){const night=Math.max(0,Math.min(1,(state.time<5||state.time>19)?1:.15));return{top:night?[17,20,25]:[48,55,59],low:night?[42,45,47]:[113,112,104],fog:state.weather==='FOG'?7:state.weather==='RAIN'?9:night?12:15}}
function render(){
 const horizon=H*(.49+state.pitch),g=oc.createLinearGradient(0,0,0,horizon+H*.08),s=sky();g.addColorStop(0,`rgb(${s.top.join(',')})`);g.addColorStop(1,`rgb(${s.low.join(',')})`);oc.fillStyle=g;oc.fillRect(0,0,W,Math.min(H,horizon+H*.08));
 const floor=oc.createLinearGradient(0,horizon-H*.01,0,H);floor.addColorStop(0,'#383633');floor.addColorStop(.24,state.weather==='RAIN'||state.weather==='STORM'?'#292b2c':'#333230');floor.addColorStop(1,'#17191a');oc.fillStyle=floor;oc.fillRect(0,Math.max(0,horizon-H*.01),W,H);
 // Long asphalt seams and a road that disappears into damp town fog.
 oc.strokeStyle='rgba(194,185,164,.09)';oc.lineWidth=1;for(let i=0;i<8;i++){const y=horizon+H*.06+i*i*4;oc.beginPath();oc.moveTo(W/2-8-i*22,y);oc.lineTo(W/2+8+i*22,y);oc.stroke()}
 // Fine deterministic road grit adds surface scale without flickering.
  const groundTop=Math.max(0,horizon);for(let i=0;i<190;i++){const seed=(i*9301+49297)%233280,x=(i*137.5+seed*3)%W,y=groundTop+((i*71+seed*11)%(H-groundTop||1)),scale=.35+(y-groundTop)/H*1.4;oc.fillStyle=`rgba(${i%4===0?'180,174,157':'8,9,10'},${.025+(y-groundTop)/H*.075})`;oc.fillRect(x,y,scale,scale)}
  if(state.weather==='RAIN'||state.weather==='STORM'){for(let i=0;i<9;i++){const y=horizon+H*.12+i*i*2.7;if(y>=H)break;const x=W*.5+Math.sin(i*12.7+state.x)*W*.28,rx=2+(y-horizon)*.055;oc.fillStyle=`rgba(142,158,160,${.025+i*.004})`;oc.beginPath();oc.ellipse(x,y,rx,Math.max(1,rx*.22),-.08,0,Math.PI*2);oc.fill()}}
  const fov=1.08,step=2;
 for(let sx=0;sx<W;sx+=step){const cam=2*sx/W-1,rayA=state.angle+Math.atan(cam*Math.tan(fov/2)),rx=Math.cos(rayA),ry=Math.sin(rayA);let mx=Math.floor(state.x),my=Math.floor(state.y),ddx=Math.abs(1/(rx||.00001)),ddy=Math.abs(1/(ry||.00001)),sxstep,ystep,sdx,sdy,side=0;
  if(rx<0){sxstep=-1;sdx=(state.x-mx)*ddx}else{sxstep=1;sdx=(mx+1-state.x)*ddx}if(ry<0){ystep=-1;sdy=(state.y-my)*ddy}else{ystep=1;sdy=(my+1-state.y)*ddy}
  let wall=0,guard=0;while(!wall&&guard++<70){if(sdx<sdy){sdx+=ddx;mx+=sxstep;side=0}else{sdy+=ddy;my+=ystep;side=1}wall=tile(mx,my)}
  let d=side===0?(mx-state.x+(1-sxstep)/2)/(rx||.0001):(my-state.y+(1-ystep)/2)/(ry||.0001);d=Math.max(.08,d);for(let z=sx;z<sx+step;z++)depthBuffer[z]=d;
  const wallH=Math.min(H*1.5,H*.83/d),top=horizon-wallH*.5,shade=Math.max(.15,1-d/(s.fog*1.5)),tex=textures[wall]||textures[1],edge=((side===0?state.y+d*ry:state.x+d*rx)%1+1)%1,edgeShade=(side&&((edge>.94)||(edge<.06)))?.67:1;
  const band=Math.sin((edge*10+frame*.004))*2,br=wall===8?'#765645':tex[Math.floor((edge*11+Math.floor(mx+my))%tex.length)];let rgb=hexRgb(br);const fog=Math.min(.8,d/(s.fog*1.2));for(let c=0;c<3;c++)rgb[c]=Math.floor((rgb[c]*shade*edgeShade*(wall===8?1.1:1))*(1-fog)+s.low[c]*fog);oc.fillStyle=`rgb(${rgb.join(',')})`;oc.fillRect(sx,top,step+1,wallH);
  // Brick courses, peeling plaster, damp streaks and a few tired windows.
  if(wall!==6&&wall!==8){oc.fillStyle=`rgba(12,13,14,${.11+fog*.12})`;for(let k=1;k<5;k++)if((Math.floor(edge*7)+k)%2===0)oc.fillRect(sx,top+wallH*k/5,step+1,1);if(edge>.13&&edge<.34&&wallH>28){oc.fillStyle=`rgba(183,167,133,${.14*shade})`;oc.fillRect(sx,top+wallH*.28,step+1,wallH*.23);oc.fillStyle='rgba(10,12,13,.4)';oc.fillRect(sx,top+wallH*.3,step+1,wallH*.18)}}
  if(wall!==6&&wall!==8&&wallH>24){const facade=wallH*.22,wy=top+wallH*.3;if(edge>.13&&edge<.34){oc.fillStyle=`rgba(185,174,148,${.15*shade})`;oc.fillRect(sx,wy-2,step+1,2);oc.fillStyle=`rgba(12,16,17,${.62+fog*.2})`;oc.fillRect(sx,wy,step+1,facade*.72);oc.fillStyle=`rgba(174,163,140,${.2*shade})`;oc.fillRect(sx,wy+facade*.72,step+1,2);if(edge>.225&&edge<.245){oc.fillStyle=`rgba(160,153,137,${.35*shade})`;oc.fillRect(sx,wy,step+1,facade*.72)}}if(edge<.035||edge>.965){oc.fillStyle=`rgba(15,15,14,${.2+fog*.16})`;oc.fillRect(sx,top,step+1,wallH)}}
   if(wall===8){oc.fillStyle=`rgba(12,10,9,${.27+fog*.2})`;oc.fillRect(sx,top+wallH*.15,step+1,wallH*.72);oc.fillStyle=`rgba(158,105,82,${.16*shade})`;oc.fillRect(sx,top+wallH*.5,step+1,2)}
  if(wall===6){oc.fillStyle=`rgba(183,178,160,${.12*shade})`;oc.fillRect(sx,top+wallH*.45,step+1,1)}
  if(d<5&&state.flash){const beam=Math.max(0,1-Math.abs(cam)*1.8)*.16;oc.fillStyle=`rgba(210,205,185,${beam})`;oc.fillRect(sx,top,step+1,wallH)}
  if(fog>.35){oc.fillStyle=`rgba(${s.low.join(',')},${fog*.5})`;oc.fillRect(sx,top,step+1,wallH)}
 }
 // Empty street silhouettes, lit windows and the smear where the road seems to dip.
 drawStreetDetails();
 const sprites=[];for(const p of people)sprites.push({...p,sprite:'person'});for(const p of walkers)sprites.push({...p,sprite:'person'});for(const o of objects)if(!o.hidden||tile(state.x,state.y)!==0)sprites.push({...o,sprite:o.type==='clue'?'clue':o.type});
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
 const px=W/2+side/forward*(W*.72),scale=H*.72/forward,height=(e.sprite==='person'||e.sprite==='threat')?scale*1.45:scale*.48,width=(e.sprite==='person'||e.sprite==='threat')?height*.43:height*.8,top=H*(.49+state.pitch)-height*.48;
 if(px<-width||px>W+width)return;const col=clamp(Math.round(px),0,W-1);if(depthBuffer[col]<forward-.12)return;
 if(e.sprite==='person'||e.sprite==='threat'){
  const fear=e.fear||0,disturb=e.sprite==='threat'||state.alert>1;oc.fillStyle='rgba(0,0,0,.4)';oc.beginPath();oc.ellipse(px,H*(.49+state.pitch)+height*.48,width*.58,Math.max(2,height*.06),0,0,Math.PI*2);oc.fill();
  // Coat, uneven shoulders and a face mostly obscured by the darkness.
  oc.fillStyle=e.sprite==='threat'?'#252527':(e.temper==='warm'?'#514c44':e.temper==='wary'?'#474943':'#3e4242');oc.beginPath();oc.moveTo(px-width*.42,top+height*.38);oc.lineTo(px-width*.32,top+height*.26);oc.lineTo(px-width*.16,top+height*.22);oc.lineTo(px+width*.2,top+height*.22);oc.lineTo(px+width*.38,top+height*.4);oc.lineTo(px+width*.31,top+height*.92);oc.lineTo(px-width*.33,top+height*.92);oc.closePath();oc.fill();
  oc.fillStyle='#272525';oc.fillRect(px-width*.13,top+height*.08,width*.27,height*.23);oc.fillStyle=disturb?'#4b3837':'#6d6255';oc.beginPath();oc.ellipse(px,top+height*.23,width*.23,height*.16,0,0,Math.PI*2);oc.fill();
  if(disturb){oc.fillStyle='#a64c43';oc.fillRect(px-width*.12,top+height*.23,Math.max(2,width*.08),Math.max(1,height*.012));oc.fillRect(px+width*.05,top+height*.23,Math.max(2,width*.08),Math.max(1,height*.012));oc.strokeStyle='rgba(139,61,51,.7)';oc.beginPath();oc.moveTo(px,top+height*.28);oc.lineTo(px+width*.06,top+height*.52);oc.stroke()}
  if(e.sprite==='person'&&forward<3.5&&height>48){oc.fillStyle='#ded1bb';oc.font=`${Math.max(8,Math.min(11,scale*.11))}px DM Mono`;oc.textAlign='center';oc.fillText(e.name.split(' ')[0].toUpperCase(),px,top-5)}
 }else if(e.sprite==='clue'){
  const pulse=.7+Math.sin(frame*.06+e.x)*.2;oc.fillStyle=`rgba(189,137,103,${.12*pulse})`;oc.beginPath();oc.arc(px,top+height*.6,width*.9,0,7);oc.fill();oc.fillStyle='#b88b69';oc.fillRect(px-width*.16,top+height*.28,width*.32,height*.34);oc.fillStyle='#efe2c6';oc.fillRect(px-width*.1,top+height*.33,width*.2,1);oc.fillRect(px-width*.1,top+height*.39,width*.18,1)
 }else if(e.sprite==='sign'){
  if(forward<4){oc.fillStyle='#3d3d37';oc.fillRect(px-width*.45,top+height*.22,width*.9,height*.5);oc.strokeStyle='#8c826d';oc.strokeRect(px-width*.45,top+height*.22,width*.9,height*.5)}
 }else if(e.sprite==='furniture'){
  oc.fillStyle=e.name==='chair'?'#49443b':'#3c3b37';oc.fillRect(px-width*.36,top+height*.35,width*.72,height*.5);oc.fillStyle='#282928';oc.fillRect(px-width*.32,top+height*.77,width*.1,height*.2);oc.fillRect(px+width*.22,top+height*.77,width*.1,height*.2)
 }else if(e.sprite==='threat'){}
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
function nearest(){let best=null,bd=2.15;for(const p of people){const d=dist(state,p);if(d<bd){const da=Math.atan2(p.y-state.y,p.x-state.x),diff=Math.abs(Math.atan2(Math.sin(da-state.angle),Math.cos(da-state.angle)));if(diff<.95){best=p;bd=d}}}for(const p of walkers){const d=dist(state,p);if(d<bd){const da=Math.atan2(p.y-state.y,p.x-state.x),diff=Math.abs(Math.atan2(Math.sin(da-state.angle),Math.cos(da-state.angle)));if(diff<.95){best=p;bd=d}}}for(const c of clues){if(c.found)continue;const d=dist(state,c);if(d<bd){best=c;bd=d}}for(const d of doors){const z=dist(state,d);if(z<bd){best=d;bd=z}}return best}
function refreshPrompt(){state.near=nearest();const p=$('#prompt');if(!state.near){p.textContent='';return}let label=state.near.site?state.near.site.name:state.near.name||state.near.title;if(state.near.type==='clue')label=state.near.title;if(state.near.door)label=state.near.site.name; p.innerHTML=`<kbd>E</kbd> &nbsp; ${label.toUpperCase()}`}
function interact(){const n=state.near||nearest();if(!n){say('Only the rain answers.');return}if(n.type==='clue'){if(n.found)return;openCard(n);return}if(n.door){const d=n,site=d.site;if(!d.open){const key=site.key;if(key&&!state.keys.includes(key)){if(key==='ward key'&&state.found>=4){state.keys.push(key);say('A key has turned up in your coat pocket. No memory of putting it there.')}else{openCard({title:site.name,kind:'LOCKED',teaser:'The door will not give.',text:key==='ward key'?'A hospital key, or perhaps a reason to enter. The thought of the ward makes your teeth ache.':key==='storm grate'?'The grate is chained. Something beneath it taps, once, then twice.':'An old brass lock. The key must be nearby.','id':'locked'});return}}else if(key&&!state.keys.includes(key)){say('The lock is still closed.');return}}
   d.open=!d.open;setTile(Math.floor(d.x),Math.floor(d.y),d.open?0:8);if(d.open){say(`${site.name.toUpperCase()} · THE AIR INSIDE IS COLDER.`);if(site.kind==='bunker'&&state.found>=6){state.near={type:'ending',site};openCard({title:'THE RELAY ROOM',kind:'NO SIGNAL',teaser:'The receiver is already warm.',text:'Below the static, a voice counts down from seven. It sounds like your own. The receiver waits for an answer.','id':'ending'});}else if(site.kind==='bunker')say('The bunker is sealed from the inside. Find more of the town’s records.')}else say('The latch falls into place.');return}
  if(n.sprite==='sign'||n.type==='furniture')return;
  if(n.sprite==='threat'){if(state.ammo>0){state.ammo--;state.alert=0;threats.splice(threats.indexOf(n),1);say('The shot echoes down the block. The shape folds into the fog.');sound('shot')}else{state.health-=12;state.mind-=5;state.alert=2;say('Something cold catches your shoulder. RUN.')}return}
  if(n.name&&(people.includes(n)||walkers.includes(n))){talk(n);return}
}
function openCard(c){state.near=c;$('#card-type').textContent=c.kind||'EVIDENCE';$('#card-title').textContent=c.title;$('#card-copy').textContent=c.teaser||c.text;$('#card-action').textContent=c.type==='clue'?'ADD TO JOURNAL':'EXAMINE';$('#interact-card').classList.remove('hidden')}
$('#card-action').addEventListener('click',()=>{const c=state.near;if(!c)return;if(c.id==='ending'){showEnding();return}if(c.type==='clue'){c.found=true;state.found++;state.mind=clamp(state.mind+2,0,100);rumors.push({title:c.title,text:c.text,day:state.day});$('#interact-card').classList.add('hidden');say(`EVIDENCE RECORDED · ${c.title.toUpperCase()}`);$('#objective-text').textContent=state.found<3?'Ask Mara what came back from the lake.':state.found<6?'Find the signal beneath Ashgate.':'The relay is waiting. Decide what to tell it.';if(c.id==='notebook')state.decisions.push('read-notebook');if(c.id==='relay')state.keys.push('ward key');renderJournal();return}if(c.id==='ending'){showEnding();return}$('#interact-card').classList.add('hidden')});
function talk(p){p.met=true;p.memory++;state.alert=Math.max(0,state.alert-.2);const altered=state.mind<35||state.day>2;$('#speaker').textContent=p.name.toUpperCase();$('#dialogue-text').textContent=p.memory===1?p.line:(altered?p.secret:`${p.name.split(' ')[0]} looks at you for a long moment. “You already asked me that.”`);const box=$('#choices');box.innerHTML='';const options=p.name==='Mara Venn'?['Ask about the lake','Ask about your father','Leave']:p.name==='Deputy Ellis'?['Ask about the missing report','Ask for a key','Leave']:p.name==='Nurse Ada'?['Ask who is in Ward 3B','Ask for a key','Leave']:['Ask what they remember','Offer a ration','Leave'];options.forEach((text,i)=>{const b=document.createElement('button');b.className='choice';b.innerHTML=`<b>0${i+1}</b>${text}`;b.onclick=()=>choice(p,text);box.appendChild(b)});$('#dialogue').classList.remove('hidden')}
function choice(p,text){$('#dialogue').classList.add('hidden');state.decisions.push(`${p.name}:${text}`);p.memory++;
 if(text==='Leave'){say(`${p.name.toUpperCase()} DOES NOT LOOK AWAY.`);return}
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
 else if(tab==='people'){content.innerHTML=[...people,...walkers].map(p=>`<article class="journal-entry"><small>${p.met?'ENCOUNTERED':'UNCONFIRMED'} · ${p.temper.toUpperCase()}</small><h3>${p.name}</h3><p>${p.met?p.secret:'No reliable description. Residents avoid the subject.'}</p></article>`).join('')}
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
 movePeople(dt,night);moveWalkers(dt,night);moveThreats(dt,night);
 if(state.radio&&Math.random()<dt*.12)sound('radio');
 if(state.health<=0||state.fatigue>=100)die();
}
let speedFactor=1;
function movePlayer(dx,dy){const r=.22;const nx=state.x+dx,ny=state.y+dy;if(!collides(nx,state.y,r))state.x=nx;if(!collides(state.x,ny,r))state.y=ny}
function movePeople(dt,night){for(const p of people){const d=dist(state,p);if(d<4.2&&night){p.fear+=dt*.15;if(Math.random()<dt*.018){p.x=clamp(p.x+rnd(-1,1),2,MW-2);p.y=clamp(p.y+rnd(-1,1),2,MH-2)}}else if(d>5){p.phase+=dt*(p.routine===0?.12:.05);const tx=p.home.x+Math.sin(p.phase)*.7,ty=p.home.y+Math.cos(p.phase*.73)*.55;if(Math.random()<dt*.3&&!collides(tx,ty,.2)){p.x+=(tx-p.x)*dt*.12;p.y+=(ty-p.y)*dt*.12}}}}
function moveWalkers(dt,night){
  for(const w of walkers){
   w.pause=Math.max(0,(w.pause||0)-dt);if(dist(state,w)<1.35){w.pause=Math.max(w.pause,.7);continue}
   if(!w.route.length){if(Math.random()<dt*.55)chooseWalkerRoute(w);continue}
   if(w.pause>0)continue;const target=w.route[0],dx=target.x-w.x,dy=target.y-w.y,d=Math.hypot(dx,dy),step=w.speed*(night?.58:1)*(state.weather==='STORM'?.72:1)*dt;
   if(d<=step+.025){w.x=target.x;w.y=target.y;w.route.shift();if(!w.route.length)w.pause=rnd(.8,2.4)}else{w.x+=dx/d*step;w.y+=dy/d*step}
  }
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
function showEnding(died=false){state.ending=true;$('#interact-card').classList.add('hidden');$('#dialogue').classList.add('hidden');$('#journal').classList.add('hidden');$('#map-panel').classList.add('hidden');$('#ending-screen').classList.remove('hidden');let title,copy;if(died){title='THE QUIET';copy='Ashgate closes its doors. By morning, no one remembers there was ever a visitor.'}else if(state.found>=8&&state.decisions.includes('Mara Venn:Ask about the lake')&&state.mind>35){title='THE RETURN';copy='You tell the voice your name. Somewhere above, a bell rings once. The town exhales. For the first time, a door opens from the inside.'}else if(state.decisions.some(d=>d.includes('Deputy Ellis:Ask for a key'))){title='THE RECORD';copy='You leave the relay dark. The deputy files a report. It lists four missing residents. You ask him to check the fifth name. He says there was never a fifth.'}else{title='ASHES';copy='You answer the voice with silence. By morning, the street looks ordinary again. Your father’s notebook is gone. So is the address.'}$('#ending-title').textContent=title;$('#ending-copy').textContent=copy;$('#ending-stats').textContent=`${state.found} clues recovered · ${[...people,...walkers].filter(p=>p.met).length} residents met · Day ${state.day}`;document.exitPointerLock?.()}
function collides(x,y,r){for(const [a,b] of [[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]])if(tile(a,b)!==0&&tile(a,b)!==6&&tile(a,b)!==5)return true;return false}
})();
