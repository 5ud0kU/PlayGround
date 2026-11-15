(() => {
  'use strict';
  const levels = [
    {name:'First Steps', sub:'The basics of movement', objective:'Collect the energy cell, then reach the exit.', tip:'The machine starts facing east. One instruction runs per tick.', start:[1,5],dir:1,cells:[[4,5]],exit:[7,5],walls:[]},
    {name:'The Detour', sub:'Read the room', objective:'Route around the wall. Collect the cell and find the exit.', tip:'Turns change direction, not position. Look ahead before moving.', start:[1,5],dir:1,cells:[[3,2]],exit:[7,1],walls:[[3,4],[3,3],[4,3],[5,3],[5,2],[5,1]]},
    {name:'Power Grid', sub:'Two cells. One route.', objective:'Collect both energy cells, then reach the exit.', tip:'TAKE only works on a cell tile. Use REPEAT to avoid busywork.', start:[1,5],dir:0,cells:[[1,2],[5,1]],exit:[7,1],walls:[[2,4],[2,3],[4,4],[4,3],[4,2],[6,2]]},
    {name:'Fail-Safe', sub:'Make a machine that adapts', objective:'Collect the cell and reach the exit without knowing the route.', tip:'IF BLOCKED checks the tile ahead. Use it to change course.', start:[1,5],dir:1,cells:[[6,2]],exit:[7,1],walls:[[4,5],[4,4],[4,3],[4,2],[2,2],[3,2],[6,4],[6,3]]}
  ];
  const starters = [
`MOVE
MOVE
MOVE
TAKE
MOVE
MOVE
MOVE`,
`MOVE
TURN LEFT
REPEAT 3
  MOVE
END
TURN RIGHT
MOVE
TAKE
TURN LEFT
REPEAT 2
  MOVE
END
TURN RIGHT
REPEAT 4
  MOVE
END
TURN RIGHT
MOVE`,
`REPEAT 3
  MOVE
END
TAKE
TURN RIGHT
REPEAT 4
  MOVE
END
TAKE
REPEAT 2
  MOVE
END`,
`REPEAT 2
  MOVE
END
TURN RIGHT
MOVE
TURN LEFT
REPEAT 4
  MOVE
END
TURN LEFT
REPEAT 4
  MOVE
END
TURN LEFT
MOVE
TAKE
TURN RIGHT
TURN RIGHT
MOVE
TURN LEFT
MOVE`
  ];
  const $ = id => document.getElementById(id);
  const canvas = $('world'), ctx = canvas.getContext('2d');
  const editor = $('codeEditor');
  let levelIndex = 0, state, timer = null, logs = [], savedCode = [...starters], toastTimer;
  const dirs = [[0,-1],[1,0],[0,1],[-1,0]], dirGlyph = ['↑','→','↓','←'];
  const clone = obj => JSON.parse(JSON.stringify(obj));

  function newState(){
    const level=levels[levelIndex];
    return {x:level.start[0],y:level.start[1],dir:level.dir,cells:clone(level.cells),collected:0,tick:0,pc:0,program:[],running:false,done:false,blocked:false,failed:false};
  }
  function log(message,type=''){const now=new Date();const stamp=String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');logs.unshift({stamp,message,type});logs=logs.slice(0,20);renderLogs();}
  function renderLogs(){const box=$('terminalLines');box.innerHTML=logs.slice(0,5).map(x=>`<p class="${x.type}"><time>${x.stamp}</time><span>${escapeHtml(x.message)}</span></p>`).join('');$('logCount').textContent=String(logs.length).padStart(2,'0');}
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100);}

  function parse(source){
    const lines=source.split(/\r?\n/).map((text,i)=>({text:text.replace(/#.*/,'').trim(),line:i+1})).filter(x=>x.text);
    let at=0;
    function block(allowed){const nodes=[];while(at<lines.length){const row=lines[at++],parts=row.text.toUpperCase().split(/\s+/),word=parts[0];
      if(word==='END'){if(!allowed)throw Error(`Line ${row.line}: END without an open block.`);return {nodes,ended:'END'};}
      if(word==='ELSE'){if(!allowed)throw Error(`Line ${row.line}: ELSE without an IF.`);return {nodes,ended:'ELSE'};}
      if(word==='REPEAT'){if(parts.length!==2||!/^\d+$/.test(parts[1]))throw Error(`Line ${row.line}: write REPEAT followed by a number (1–20).`);const n=Number(parts[1]);if(n<1||n>20)throw Error(`Line ${row.line}: repeat count must be from 1 to 20.`);const child=block(true);if(child.ended!=='END')throw Error(`Line ${row.line}: REPEAT needs an END.`);nodes.push({kind:'repeat',n,body:child.nodes,line:row.line});continue;}
      if(word==='IF'){const condition=parts.slice(1).join(' ');if(!['BLOCKED','CELL','EXIT','CELLS'].includes(condition))throw Error(`Line ${row.line}: use IF BLOCKED, CELL, EXIT, or CELLS.`);const yes=block(true);let no=[];if(yes.ended==='ELSE'){const other=block(true);if(other.ended!=='END')throw Error(`Line ${row.line}: IF needs an END.`);no=other.nodes;}else if(yes.ended!=='END')throw Error(`Line ${row.line}: IF needs an END.`);nodes.push({kind:'if',condition,yes:yes.nodes,no,line:row.line});continue;}
      let op,args=[];if(word==='MOVE'||word==='TAKE'||word==='WAIT'){if(parts.length!==1)throw Error(`Line ${row.line}: ${word} takes no arguments.`);op=word;}
      else if(word==='TURN'&&parts.length===2&&['LEFT','RIGHT'].includes(parts[1])){op='TURN';args=[parts[1]];}
      else throw Error(`Line ${row.line}: I don't know “${row.text}”. Check the language guide.`);
      nodes.push({kind:'action',op,args,line:row.line});
    }return {nodes,ended:null};}
    const root=block(false);if(at<lines.length)throw Error(`Line ${lines[at].line}: unexpected ${lines[at].text}.`);return emit(root.nodes);
  }
  function emit(nodes,out=[]){for(const node of nodes){if(node.kind==='action')out.push({op:node.op,args:node.args,line:node.line});else if(node.kind==='repeat'){for(let i=0;i<node.n;i++)emit(node.body,out);}else{const branch={op:'IF',condition:node.condition,line:node.line,jump:0};out.push(branch);emit(node.yes,out);if(node.no.length){const jump={op:'JUMP',to:0};out.push(jump);branch.jump=out.length;emit(node.no,out);jump.to=out.length;}else branch.jump=out.length;}}return out;}

  function updateEditor(){const n=editor.value.split('\n').length;$('lineNumbers').textContent=Array.from({length:n},(_,i)=>i+1).join('\n');$('lineCount').textContent=String(n).padStart(2,'0')+' LINES';savedCode[levelIndex]=editor.value;}
  function loadLevel(index){stop();if(index<0||index>=levels.length)return;levelIndex=index;state=newState();editor.value=savedCode[index];updateEditor();$('missionNumber').textContent=String(index+1).padStart(2,'0');$('missionTitle').textContent=levels[index].name;$('missionSubtitle').textContent=levels[index].sub;$('missionObjective').textContent=levels[index].objective;$('missionTip').textContent=levels[index].tip;$('levelList').innerHTML=levels.map((l,i)=>`<button class="level-button ${i===index?'active':''}" data-level="${i}" aria-current="${i===index?'page':'false'}"><span class="level-num">0${i+1}</span><strong>${l.name}</strong><span class="level-check" id="check${i}">${localStorage.getItem('machine-room-'+i)==='done'?'✓':''}</span></button>`).join('');$('levelList').querySelectorAll('button').forEach(b=>b.onclick=()=>loadLevel(Number(b.dataset.level)));logs=[];log('Machine booted. Awaiting instructions.');setStatus('READY');$('editorMessage').textContent='SPARK is ready when you are.';$('overlayText').textContent='AWAITING PROGRAM';$('canvasOverlay').classList.remove('hidden');draw();updateHud();}
  function setStatus(s){$('missionStatus').textContent=s;}
  function updateHud(){const lvl=levels[levelIndex];$('coordinate').textContent=`X ${String(state.x+1).padStart(2,'0')} · Y ${String(state.y+1).padStart(2,'0')}`;$('tickReadout').textContent=`TICK ${String(state.tick).padStart(3,'0')}`;$('objectiveText').textContent=`${state.collected} / ${lvl.cells.length} CELLS`;$('progressFill').style.width=`${Math.min(100,state.collected/lvl.cells.length*100)}%`;}
  function isBlockedAhead(){const d=dirs[state.dir],x=state.x+d[0],y=state.y+d[1];return x<0||y<0||x>=9||y>=7||levels[levelIndex].walls.some(([wx,wy])=>wx===x&&wy===y);}
  function condition(name){if(name==='BLOCKED')return isBlockedAhead();if(name==='CELL')return state.cells.some(([x,y])=>x===state.x&&y===state.y);if(name==='EXIT'){const [x,y]=levels[levelIndex].exit;return x===state.x&&y===state.y;}if(name==='CELLS')return state.collected>=levels[levelIndex].cells.length;return false;}
  function finishWin(){state.done=true;stop();setStatus('COMPLETE');$('editorMessage').textContent='Objective complete — beautifully done.';$('overlayText').textContent='OBJECTIVE COMPLETE';$('canvasOverlay').classList.remove('hidden');localStorage.setItem('machine-room-'+levelIndex,'done');const check=$('check'+levelIndex);if(check)check.textContent='✓';log('Objective complete. Machine and operator: excellent work.','success');toast('MISSION COMPLETE — nice work!');}
  function tick(){if(!state||state.done||state.failed)return;let controls=0;while(state.pc<state.program.length&&controls++<100){const ins=state.program[state.pc++];if(ins.op==='JUMP'){state.pc=ins.to;continue;}if(ins.op==='IF'){if(!condition(ins.condition))state.pc=ins.jump;continue;}state.tick++;state.blocked=false;
      if(ins.op==='MOVE'){if(isBlockedAhead()){state.blocked=true;log('Path blocked. The machine held position.','warn');}else{state.x+=dirs[state.dir][0];state.y+=dirs[state.dir][1];}}
      else if(ins.op==='TURN')state.dir=(state.dir+(ins.args[0]==='RIGHT'?1:3))%4;
      else if(ins.op==='TAKE'){const i=state.cells.findIndex(([x,y])=>x===state.x&&y===state.y);if(i>=0){state.cells.splice(i,1);state.collected++;log('Energy cell secured.','success');}else log('TAKE found no cell here.','warn');}
      if(state.tick>=500){state.failed=true;stop();setStatus('LIMIT');log('Safety limit reached (500 ticks). Try a smaller program.','error');}
      break;
    }
    if(controls>=100){state.failed=true;stop();log('Program control limit reached. Check your loops.','error');}
    const [ex,ey]=levels[levelIndex].exit;if(state.x===ex&&state.y===ey&&state.collected===levels[levelIndex].cells.length){finishWin();}
    if(state.pc>=state.program.length&&!state.done&&!state.failed){state.failed=true;stop();setStatus('STOPPED');$('editorMessage').textContent='Program ended before the objective was complete.';log('Program ended. The objective is not complete yet.','warn');}
    updateHud();draw();
  }
  function run(){if(state.done){toast('Mission complete — choose another mission or reset.');return;}if(state.running)return;try{state.program=parse(editor.value);if(!state.program.length)throw Error('Your program is empty. Add an instruction to begin.');if(state.pc===0&&state.tick===0){log(`Compiled ${state.program.length} instructions. Execution started.`);setStatus('RUNNING');$('overlayText').textContent='PROGRAM RUNNING';$('canvasOverlay').classList.add('hidden');}state.failed=false;state.running=true;$('runBtn').disabled=true;$('stopBtn').disabled=false;$('runLabel').textContent='RUNNING';timer=setInterval(tick,220);}catch(e){$('editorMessage').textContent=e.message;log(e.message,'error');setStatus('ERROR');toast('PROGRAM ERROR — check the system log.');}}
  function step(){if(state.done)return;if(!state.program.length||state.pc===0){try{state.program=parse(editor.value);if(!state.program.length)throw Error('Your program is empty.');log(`Compiled ${state.program.length} instructions.`);$('overlayText').textContent='SINGLE-STEP MODE';$('canvasOverlay').classList.remove('hidden');}catch(e){$('editorMessage').textContent=e.message;log(e.message,'error');setStatus('ERROR');return;}}if(state.pc===0&&state.tick===0)setStatus('STEPPING');tick();}
  function stop(){if(timer){clearInterval(timer);timer=null;}if($('runBtn')){$('runBtn').disabled=false;$('stopBtn').disabled=true;$('runLabel').textContent='RUN PROGRAM';}if(state&&state.running){state.running=false;if(!state.done&&!state.failed){setStatus('PAUSED');$('overlayText').textContent='PROGRAM PAUSED';$('canvasOverlay').classList.remove('hidden');log('Program paused.');}}}
  function reset(){stop();state=newState();setStatus('READY');$('editorMessage').textContent='Machine reset. Ready to run.';$('overlayText').textContent='AWAITING PROGRAM';$('canvasOverlay').classList.remove('hidden');log('Machine reset to starting position.');updateHud();draw();}

  function draw(){if(!canvas||!ctx)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);const w=rect.width,h=rect.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#182124';ctx.fillRect(0,0,w,h);const cols=9,rows=7,cell=Math.min((w-34)/cols,(h-28)/rows),ox=(w-cols*cell)/2,oy=(h-rows*cell)/2;
    ctx.strokeStyle='#ffffff0b';ctx.lineWidth=1;for(let x=0;x<=cols;x++){ctx.beginPath();ctx.moveTo(ox+x*cell,oy);ctx.lineTo(ox+x*cell,oy+rows*cell);ctx.stroke();}for(let y=0;y<=rows;y++){ctx.beginPath();ctx.moveTo(ox,oy+y*cell);ctx.lineTo(ox+cols*cell,oy+y*cell);ctx.stroke();}
    // soft ambient pools
    const glow=ctx.createRadialGradient(ox+cell*2,oy+cell*5,1,ox+cell*2,oy+cell*5,cell*3);glow.addColorStop(0,'#b7f35c0c');glow.addColorStop(1,'#b7f35c00');ctx.fillStyle=glow;ctx.fillRect(ox,oy,cols*cell,rows*cell);
    levels[levelIndex].walls.forEach(([x,y])=>{const px=ox+x*cell,py=oy+y*cell;ctx.fillStyle='#263337';ctx.fillRect(px+2,py+2,cell-4,cell-4);ctx.strokeStyle='#354449';ctx.strokeRect(px+2.5,py+2.5,cell-5,cell-5);ctx.fillStyle='#3a4b4d';ctx.fillRect(px+5,py+5,cell-10,2);ctx.fillStyle='#11191b';ctx.fillRect(px+5,py+cell-7,cell-10,2);});
    const [ex,ey]=levels[levelIndex].exit,epx=ox+ex*cell,epy=oy+ey*cell;ctx.fillStyle=state.collected===levels[levelIndex].cells.length?'#b7f35c20':'#d6e5d513';ctx.fillRect(epx+3,epy+3,cell-6,cell-6);ctx.strokeStyle=state.collected===levels[levelIndex].cells.length?'#b7f35c99':'#d6e5d544';ctx.setLineDash([3,3]);ctx.strokeRect(epx+5,epy+5,cell-10,cell-10);ctx.setLineDash([]);ctx.fillStyle='#d9e8d0';ctx.font=`${Math.max(11,cell*.42)}px ${getComputedStyle(document.body).fontFamily}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('↗',epx+cell/2,epy+cell/2);
    state.cells.forEach(([x,y])=>{const cx=ox+(x+.5)*cell,cy=oy+(y+.5)*cell;ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.PI/4);const s=cell*.19;ctx.shadowColor='#ffad50';ctx.shadowBlur=12;ctx.fillStyle='#ffb95d';ctx.fillRect(-s/2,-s/2,s,s);ctx.shadowBlur=0;ctx.fillStyle='#fff0c4';ctx.fillRect(-s*.12,-s*.12,s*.24,s*.24);ctx.restore();});
    const cx=ox+(state.x+.5)*cell,cy=oy+(state.y+.5)*cell;ctx.save();ctx.translate(cx,cy);ctx.rotate(state.dir*Math.PI/2);const r=cell*.29;ctx.shadowColor='#b7f35c';ctx.shadowBlur=13;ctx.fillStyle='#b7f35c';ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.77,r*.77);ctx.lineTo(0,r*.46);ctx.lineTo(-r*.77,r*.77);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#26361c';ctx.beginPath();ctx.arc(0,0,cell*.055,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.fillStyle='#a1b0a7';ctx.font=`${Math.max(7,cell*.15)}px 'DM Mono',monospace`;ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText('0'+(levelIndex+1)+' / CHAMBER',ox+3,oy+3);
  }

  $('runBtn').onclick=run;$('stopBtn').onclick=stop;$('stepBtn').onclick=()=>{stop();step();};$('resetBtn').onclick=reset;$('clearBtn').onclick=()=>{editor.value=starters[levelIndex];updateEditor();editor.focus();toast('Starter program restored.');};editor.addEventListener('input',updateEditor);editor.addEventListener('scroll',()=>$('lineNumbers').scrollTop=editor.scrollTop);editor.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const start=editor.selectionStart,end=editor.selectionEnd;editor.setRangeText('  ',start,end,'end');updateEditor();}});
  const modal=$('guideModal');function openGuide(){modal.hidden=false;$('closeGuide').focus();}function closeGuide(){modal.hidden=true;$('helpBtn').focus();}$('helpBtn').onclick=openGuide;$('closeGuide').onclick=closeGuide;$('guideDone').onclick=closeGuide;modal.addEventListener('click',e=>{if(e.target===modal)closeGuide();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeGuide();if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();run();}if(e.code==='Space'&&document.activeElement!==editor&&modal.hidden){e.preventDefault();if(state.running)stop();else step();}if(e.key.toLowerCase()==='r'&&document.activeElement!==editor&&modal.hidden)reset();});
  window.addEventListener('resize',draw);if('ResizeObserver'in window)new ResizeObserver(draw).observe(canvas);loadLevel(0);
})();
