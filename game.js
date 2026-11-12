(() => {
  'use strict';
  const canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const mapW = 92, mapH = 20, world = Array.from({length: mapH}, () => Array(mapW).fill(0));
  // 0 = open, 1 = workshop concrete, 2 = warm brick, 3 = glass / painted city facade
  for (let y=0;y<mapH;y++) for(let x=0;x<mapW;x++) {
    if (x===0 || y===0 || y===mapH-1 || x===mapW-1) world[y][x]=3;
    if (x<=15 && y<=13 && (x===1 || y===1 || y===13 || (x===15 && !(y>=5&&y<=8)))) world[y][x]=1;
    if (x>15 && x<mapW-1 && (y<=2 || y>=17)) world[y][x]=((Math.floor(x/9)%3)===0?2:3);
    // periodic side-street openings and little facade setbacks
    if (x>16 && x<mapW-1 && (x%27===0 || x%27===1) && y>=2 && y<=17) world[y][x]=0;
  }
  const player={x:6.1,y:7,angle:0}, keys={};
  let mode='walk', started=false, modal=false, selected=null, driving=false, speed=0, steer=0, lookDelta=0, walkBob=0, clock=0, toastTimer=0;
  let soundOn=false;
  const required=[
    {id:'chassis',name:'Châssis tubulaire',desc:'Cadre acier · base légère',icon:'⌑',power:'—',mass:'38 kg'},
    {id:'engine',name:'Moteur 2 cylindres',desc:'620 cm³ · refroidi par air',icon:'⚙',power:'42 ch',mass:'64 kg'},
    {id:'seat',name:'Siège baquet',desc:'Fibre tressée · 1 place',icon:'▰',power:'—',mass:'8 kg'},
    {id:'wheels',name:'4 roues tout-terrain',desc:'Pneus mixtes · jantes alu',icon:'◉',power:'ADH.',mass:'32 kg'},
    {id:'steering',name:'Direction directe',desc:'Volant + crémaillère',icon:'⊗',power:'CTRL',mass:'11 kg'},
    {id:'battery',name:'Batterie compacte',desc:'12 V · démarrage électrique',icon:'▣',power:'12 V',mass:'9 kg'}
  ];
  const installed=new Set();
  let w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,1.65),zBuffer=[];
  function resize(){w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,1.65);canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
  addEventListener('resize',resize);resize();
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function cell(x,y){const ix=Math.floor(x),iy=Math.floor(y);return world[iy]?.[ix] ?? 3;}
  function blocked(x,y){return cell(x+.18,y)!==0||cell(x-.18,y)!==0||cell(x,y+.18)!==0||cell(x,y-.18)!==0;}
  function toast(text){const el=$('toast');el.textContent=text;el.classList.add('show');toastTimer=2.4;}
  function setModal(open){modal=open;$('assemblyModal').classList.toggle('open',open);$('assemblyModal').setAttribute('aria-hidden',String(!open));if(open){$('crosshair').classList.remove('show');document.exitPointerLock?.();}else if(started)$('crosshair').classList.add('show');}
  function drawParts(){
    const list=$('partsList'); list.innerHTML='';
    required.forEach((p,i)=>{const done=installed.has(p.id), blockedItem=i>0&&!installed.has('chassis')&&!done;
      const b=document.createElement('button');b.className='part-card'+(done?' installed':'')+(selected===p.id?' selected':'')+(blockedItem?' locked':'');b.disabled=done||blockedItem;
      b.innerHTML=`<span class="part-icon">${done?'✓':p.icon}</span><span><strong>${p.name}</strong><small>${done?'INSTALLÉE':p.desc}</small></span><span class="part-cost">${done?'✓':'+'}</span>`;
      b.onclick=()=>{selected=p.id;drawParts();document.querySelectorAll('.slot').forEach(s=>s.classList.toggle('active',s.dataset.slot===p.id));$('assemblyMessage').textContent=`${p.name} sélectionné · choisis son emplacement sur le plan.`;};list.appendChild(b);
    });
    updateAssembly();
  }
  function updateAssembly(){
    const n=installed.size;$('progressText').textContent=`${n} / 6 PIÈCES`;$('progressBar').style.width=`${n/6*100}%`;
    $('buildStatus').textContent=n===0?'CHÂSSIS NU':n===6?'PRÊT À ROULER':'ASSEMBLAGE · '+n+'/6';
    $('powerReadout').textContent=installed.has('engine')?'42 CH':'—';
    let mass=0;required.forEach(p=>{if(installed.has(p.id))mass+=parseInt(p.mass)||0;});$('massReadout').textContent=mass?`${mass} KG`:'—';
    document.querySelectorAll('.slot').forEach(s=>s.classList.toggle('complete',installed.has(s.dataset.slot)));
    const visuals=$('partVisuals'); visuals.innerHTML='';
    if(installed.has('chassis')) visuals.insertAdjacentHTML('beforeend','<path class="part-built accent" d="M121 210 L179 169 L430 169 L499 210 L486 220 L139 220 Z"/>');
    if(installed.has('engine')) visuals.insertAdjacentHTML('beforeend','<rect class="part-built" x="371" y="180" width="57" height="32" rx="4"/><path class="part-built accent" d="M380 178h39v-7h-39z"/>');
    if(installed.has('seat')) visuals.insertAdjacentHTML('beforeend','<path class="part-built" d="M245 143 Q248 136 258 137h29q8 0 9 9l-3 16h-42z"/>');
    if(installed.has('wheels')) visuals.insertAdjacentHTML('beforeend','<g><circle cx="190" cy="249" r="30" fill="#344038" stroke="#d8ff3e" stroke-width="5"/><circle cx="190" cy="249" r="11" fill="#b7c5a5"/><circle cx="426" cy="249" r="30" fill="#344038" stroke="#d8ff3e" stroke-width="5"/><circle cx="426" cy="249" r="11" fill="#b7c5a5"/></g>');
    if(installed.has('steering')) visuals.insertAdjacentHTML('beforeend','<path class="part-built accent" d="M235 161a12 12 0 1 1 24 0 M247 161l12 10" fill="none"/>');
    if(installed.has('battery')) visuals.insertAdjacentHTML('beforeend','<rect class="part-built accent" x="316" y="177" width="34" height="20" rx="3"/>');
    $('launchButton').disabled=n!==6;
    if(n===6){$('assemblyMessage').textContent='Tout est en place. La ville t’attend.';$('objectiveText').textContent='Véhicule assemblé · prêt pour l’essai';}
  }
  drawParts();
  document.querySelectorAll('.slot').forEach(slot=>slot.addEventListener('click',()=>{
    const id=slot.dataset.slot;if(!selected){$('assemblyMessage').textContent='Choisis une pièce dans la liste à gauche.';return;}
    if(id!==selected){$('assemblyMessage').textContent='Cette pièce ne correspond pas à cet emplacement.';return;}
    installed.add(id);selected=null;drawParts();$('assemblyMessage').textContent=`${required.find(p=>p.id===id).name} installé.`;
    if(installed.size===6)toast('PROTOTYPE 09 TERMINÉ — ESSAI DISPONIBLE');
  }));
  $('buildButton').onclick=()=>setModal(true);$('closeAssembly').onclick=()=>setModal(false);
  $('launchButton').onclick=()=>{if(installed.size<6)return;setModal(false);started=true;mode='drive';driving=true;speed=0;player.x=16.5;player.y=7;player.angle=0;$('startScreen').classList.add('hidden');$('missionCard').classList.add('hidden-ui');$('objectiveChip').classList.add('hidden-ui');$('locationLabel').textContent='RUE DES FORGES · V-09';$('driveHud').classList.add('show');$('minimapFrame').classList.add('show');$('crosshair').classList.add('show');toast('ESSAI ROUTIER — PRENDS LA RUE VERS L’EST');};
  $('startButton').onclick=()=>{started=true;$('startScreen').classList.add('hidden');$('crosshair').classList.add('show');$('missionCard').classList.remove('hidden-ui');};
  $('soundButton').onclick=()=>{soundOn=!soundOn;$('soundButton').innerHTML=soundOn?'♫ <span>ON</span>':'♫ <span>SON</span>';toast(soundOn?'SON ACTIVÉ':'SON COUPÉ');};
  addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key.toLowerCase()==='e'&&started&&!modal&&!driving){if(Math.hypot(player.x-10.6,player.y-7)<3.6)setModal(true);}});
  addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
  canvas.addEventListener('click',()=>{if(started&&!modal&&canvas.requestPointerLock&&!('ontouchstart'in window))canvas.requestPointerLock();});
  document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&!modal)player.angle+=e.movementX*.0022;});
  let touch=null;canvas.addEventListener('touchstart',e=>{const t=e.changedTouches[0];touch={x:t.clientX,y:t.clientY,lastX:t.clientX,lastY:t.clientY};},{passive:true});
  canvas.addEventListener('touchmove',e=>{if(!touch)return;const t=e.changedTouches[0],dx=t.clientX-touch.lastX,dy=t.clientY-touch.lastY;if(t.clientX>w*.42)player.angle+=dx*.005;else if(driving){steer=clamp(steer+dx*.004,-1,1);if(dy<0)keys.w=true;else keys.w=false;}else{lookDelta=clamp(lookDelta-dy*.04,-80,80);player.x+=Math.cos(player.angle)*(-dy)*.012;player.y+=Math.sin(player.angle)*(-dy)*.012;}touch.lastX=t.clientX;touch.lastY=t.clientY;},{passive:true});
  canvas.addEventListener('touchend',()=>{touch=null;keys.w=false;steer=0;});
  function update(dt){
    clock+=dt;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}
    if(!started||modal)return;
    if(!driving){let move=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0), turn=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);player.angle+=turn*dt*1.65;let dx=Math.cos(player.angle)*move*dt*3.1,dy=Math.sin(player.angle)*move*dt*3.1;if(!blocked(player.x+dx,player.y))player.x+=dx;if(!blocked(player.x,player.y+dy))player.y+=dy;walkBob=move?Math.sin(clock*10)*2:walkBob*.9;
      const near=Math.hypot(player.x-10.6,player.y-7)<3.6;$('interactHint').classList.toggle('visible',near);$('minimapFrame').classList.toggle('show',player.x>15.5);if(near)$('locationLabel').textContent='GARAGE · BAIE 01';else if(player.x>15)$('locationLabel').textContent='RUE DES FORGES · V-09';
    }else{
      const accel=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0),turn=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);if(keys[' '])speed*=Math.max(0,1-dt*3.2);else speed=clamp(speed+accel*dt*4.5,-2,18);speed*=Math.max(0,1-dt*(accel?0.12:.45));steer+=(turn-steer)*Math.min(1,dt*4);player.angle+=steer*speed*.024*dt;const dx=Math.cos(player.angle)*speed*dt,dy=Math.sin(player.angle)*speed*dt;if(!blocked(player.x+dx,player.y))player.x+=dx;else speed*=.3;if(!blocked(player.x,player.y+dy))player.y+=dy;else speed*=.3;$('speedValue').textContent=Math.round(Math.abs(speed)*5.2);
    }
  }
  function drawSky(){const horizon=h*.49+lookDelta;const g=ctx.createLinearGradient(0,0,0,horizon);g.addColorStop(0,'#527779');g.addColorStop(.52,'#92a89d');g.addColorStop(1,'#c7c4a4');ctx.fillStyle=g;ctx.fillRect(0,0,w,horizon);ctx.fillStyle='rgba(237,218,162,.78)';ctx.beginPath();ctx.arc(w*.76,horizon*.52,Math.min(w,h)*.055,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,232,174,.15)';ctx.beginPath();ctx.arc(w*.76,horizon*.52,Math.min(w,h)*.095,0,Math.PI*2);ctx.fill();
    // Skyline above the street, visible over the low outer buildings.
    for(let i=0;i<20;i++){const bx=((i*173+clock*2)% (w+220))-80,bh=22+((i*73)%72);ctx.fillStyle=i%3?'#4d6460':'#596c65';ctx.fillRect(bx,horizon-bh,bh*.62,bh);ctx.fillStyle='rgba(216,230,196,.2)';for(let j=0;j<3;j++)ctx.fillRect(bx+5+j*8,horizon-bh+8,3,4);}
    const floor=ctx.createLinearGradient(0,horizon,0,h);floor.addColorStop(0,'#6c7770');floor.addColorStop(.38,'#353f3d');floor.addColorStop(1,'#202928');ctx.fillStyle=floor;ctx.fillRect(0,horizon,w,h-horizon);
    // low contrast road seams and foreground grain lines
    for(let i=1;i<13;i++){const yy=horizon+(h-horizon)*i/13;ctx.fillStyle=`rgba(202,211,189,${.015+i*.002})`;ctx.fillRect(0,yy,w,1);}
  }
  function castRay(angle){const rayX=Math.cos(angle),rayY=Math.sin(angle);let mapX=Math.floor(player.x),mapY=Math.floor(player.y);const deltaX=Math.abs(1/(rayX||.00001)),deltaY=Math.abs(1/(rayY||.00001));let stepX,stepY,sideX,sideY;if(rayX<0){stepX=-1;sideX=(player.x-mapX)*deltaX}else{stepX=1;sideX=(mapX+1-player.x)*deltaX}if(rayY<0){stepY=-1;sideY=(player.y-mapY)*deltaY}else{stepY=1;sideY=(mapY+1-player.y)*deltaY}let side=0,hit=0,dist=0;
    for(let n=0;n<120;n++){if(sideX<sideY){sideX+=deltaX;mapX+=stepX;side=0}else{sideY+=deltaY;mapY+=stepY;side=1}hit=world[mapY]?.[mapX]??3;if(hit){dist=side===0?sideX-deltaX:sideY-deltaY;break;}}
    const hitPos=side===0?player.y+dist*rayY:player.x+dist*rayX;return{dist:Math.max(.05,dist),side,type:hit,frac:hitPos-Math.floor(hitPos),mapX,mapY};
  }
  function facadeColor(type,dist,side,frac,mapX,mapY){let base=type===1?[116,119,100]:type===2?[137,93,67]:[76,112,111];const shade=(side?.77:1)*Math.max(.35,1-dist*.036);let r=base[0]*shade,g=base[1]*shade,b=base[2]*shade;
    const row=(Math.floor(player.y+dist*Math.sin(player.angle))%4);const win=((Math.floor(frac*5)+mapX+mapY)%5);
    return {r,g,b,row,win};}
  function renderWalls(){const focal=w*.72;const columns=Math.ceil(w/2);zBuffer.length=columns;const horizon=h*.49+lookDelta+walkBob;for(let i=0;i<columns;i++){const sx=i*2,rayAngle=player.angle+Math.atan((sx-w/2)/focal),r=castRay(rayAngle),dist=r.dist*Math.cos(rayAngle-player.angle);zBuffer[i]=dist;const wallH=Math.min(h*2,focal/dist);const top=horizon-wallH*.5,bottom=horizon+wallH*.5;const c=facadeColor(r.type,dist,r.side,r.frac,r.mapX,r.mapY);ctx.fillStyle=`rgb(${c.r|0},${c.g|0},${c.b|0})`;ctx.fillRect(sx,top,2.2,wallH);
      if(r.type===1){ctx.fillStyle='rgba(33,40,36,.42)';const brickY=top+(Math.floor((top+bottom)/14)%9)*14;ctx.fillRect(sx,brickY,2.2,1.5);if(r.frac<.035||r.frac>.965){ctx.fillStyle='rgba(216,222,193,.25)';ctx.fillRect(sx,top,2.2,wallH);}}
      else {let rowH=wallH/4, winX=(r.frac*4)%1, winY=(top+horizon*.14)%Math.max(2,rowH);if((r.frac>.14&&r.frac<.78)&&dist<28){ctx.fillStyle=r.type===2?'rgba(234,177,106,.55)':'rgba(190,223,204,.42)';const ww=Math.max(2,2.2),wh=Math.max(2,rowH*.34);const wy=top+wallH*.18+Math.floor((r.mapY+r.mapX)%3)*rowH*.52;ctx.fillRect(sx,wy,ww,wh);ctx.fillStyle='rgba(42,59,57,.48)';ctx.fillRect(sx,wy+wh,ww,Math.max(1,2));}}
      const fog=clamp((dist-10)/26,0,.72);if(fog){ctx.fillStyle=`rgba(130,156,145,${fog})`;ctx.fillRect(sx,top,2.2,wallH);}
      if(sx%70<2){ctx.fillStyle='rgba(15,26,26,.1)';ctx.fillRect(sx,top,1,wallH);}
    }
    // road markings give the long avenue a clear vanishing point
    if(player.x>15&&player.y>3&&player.y<17){const van=horizon;ctx.save();ctx.globalAlpha=.23;ctx.strokeStyle='#e7e2bb';ctx.lineWidth=2;ctx.setLineDash([22,20]);ctx.beginPath();ctx.moveTo(w*.5,van+8);ctx.lineTo(w*.5,h);ctx.stroke();ctx.restore();}
  }
  function drawWorkbench(){if(player.x>15.5)return;const ox=10.6-player.x,oy=7-player.y;let dist=Math.hypot(ox,oy);if(dist>.2){let ang=Math.atan2(oy,ox)-player.angle;while(ang>Math.PI)ang-=Math.PI*2;while(ang<-Math.PI)ang+=Math.PI*2;const sx=w/2+Math.tan(ang)*w*.72, sy=h*.49+lookDelta;const scale=Math.min(1.7,w/(dist*340));if(Math.abs(ang)<1.1&&sx>w*.18&&sx<w*.82&&dist<13){const zi=Math.floor(sx/2);if(!zBuffer[zi]||dist<zBuffer[zi]){ctx.save();ctx.translate(sx,sy);ctx.scale(scale,scale);ctx.translate(0,130); // world anchor at floor
        // shelves and pegboard
        ctx.fillStyle='#414b42';ctx.fillRect(-94,-174,188,90);ctx.fillStyle='#727866';ctx.fillRect(-100,-91,200,9);ctx.fillStyle='#333a34';ctx.fillRect(-104,-80,208,71);ctx.fillStyle='#ac794b';ctx.fillRect(-108,-11,216,12);ctx.fillStyle='#586154';ctx.fillRect(-103,1,18,42);ctx.fillRect(85,1,18,42);
        for(let i=0;i<7;i++){ctx.fillStyle=i%2?'#d8ff3e':'#c47b4d';ctx.fillRect(-79+i*25,-160+(i%3)*15,7,30);}
        ctx.fillStyle='#d8ff3e';ctx.fillRect(-67,-48,134,8);ctx.fillStyle='#222a26';ctx.fillRect(-47,-67,92,18);ctx.fillStyle='#c2caad';ctx.fillRect(-23,-63,46,8);ctx.fillStyle='rgba(243,239,197,.8)';ctx.beginPath();ctx.arc(64,-114,7,0,Math.PI*2);ctx.fill();ctx.restore();}}
    }
  }
  function drawCockpit(){if(!driving)return;const horizon=h*.49;ctx.save();ctx.fillStyle='#18221f';ctx.beginPath();ctx.moveTo(0,h*.82);ctx.lineTo(w*.15,h*.72);ctx.lineTo(w*.85,h*.72);ctx.lineTo(w,h*.82);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();ctx.fillStyle='#29352f';ctx.beginPath();ctx.moveTo(w*.18,h*.79);ctx.lineTo(w*.27,h*.74);ctx.lineTo(w*.73,h*.74);ctx.lineTo(w*.82,h*.79);ctx.closePath();ctx.fill();ctx.strokeStyle='#9ba78c';ctx.globalAlpha=.45;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,h*.81);ctx.lineTo(w*.17,h*.72);ctx.lineTo(w*.83,h*.72);ctx.lineTo(w,h*.81);ctx.stroke();ctx.globalAlpha=1;
    // wheel rim in lower view
    ctx.strokeStyle='#131b18';ctx.lineWidth=Math.max(12,w*.018);ctx.beginPath();ctx.ellipse(w*.5,h*.91,w*.12,h*.14,0,Math.PI*1.08,Math.PI*1.92);ctx.stroke();ctx.strokeStyle='#738078';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(w*.5,h*.91,w*.12,h*.14,0,Math.PI*1.08,Math.PI*1.92);ctx.stroke();ctx.restore();}
  function drawMinimap(){const c=$('minimap'),m=c.getContext('2d');m.clearRect(0,0,120,120);m.fillStyle='rgba(23,33,31,.94)';m.fillRect(0,0,120,120);const scale=6,ox=60-player.x*scale,oy=60-player.y*scale;for(let y=0;y<mapH;y++)for(let x=0;x<mapW;x++)if(world[y][x]){m.fillStyle=world[y][x]===1?'#8a8b68':'#536b65';m.fillRect(ox+x*scale,oy+y*scale,scale,scale);}m.fillStyle='#d8ff3e';m.beginPath();m.arc(60,60,3,0,Math.PI*2);m.fill();m.strokeStyle='#d8ff3e';m.beginPath();m.moveTo(60,60);m.lineTo(60+Math.cos(player.angle)*10,60+Math.sin(player.angle)*10);m.stroke();}
  function render(){drawSky();renderWalls();drawWorkbench();drawCockpit();if($('minimapFrame').classList.contains('show'))drawMinimap();}
  let last=performance.now();function loop(now){const dt=Math.min(.04,(now-last)/1000);last=now;update(dt);render();requestAnimationFrame(loop);}requestAnimationFrame(loop);
})();
