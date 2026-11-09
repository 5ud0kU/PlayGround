import './style.css'
import { World } from './scene.js'
import {
  GENES, phenotype, statsOf, maxHpOf, maxStaminaOf, movesFor,
  freshNeeds, generateStarter, generateWild, makeName, sexOf, breedGenomes,
  geneticSimilarity, decayNeeds, formatAge, dnaSequence, cryptoId,
} from './dna.js'

const $ = (s, root = document) => root.querySelector(s)
const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const SAVE = 'helix-forge-save-v1'
const ADAPTATIONS = [
  { key: 'antlers', icon: '♧', name: 'Branching antlers', source: 'Stag · elk', note: 'A branching crown of bone' },
  { key: 'fins', icon: '≋', name: 'Dorsal fins', source: 'Fish · rays', note: 'Sails along the spine' },
  { key: 'gills', icon: '❋', name: 'Gill fans', source: 'Axolotl · reef fish', note: 'Frilled cheek fans' },
  { key: 'antennae', icon: '⌁', name: 'Antennae', source: 'Moth · beetle', note: 'Curious sensory feelers' },
  { key: 'carapace', icon: '⬡', name: 'Carapace', source: 'Beetle · crab', note: 'A glossy protective shell' },
  { key: 'pincers', icon: '⚯', name: 'Pincers', source: 'Crab · scorpion', note: 'Paired grasping claws' },
]

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE))
    if (saved?.creatures?.length) {
      saved.creatures.forEach(c => { c.needs ||= freshNeeds(78); c.wins ||= 0; c.battles ||= 0; c.born ||= Date.now() })
      return { creatures: saved.creatures, selected: saved.selected || saved.creatures[0].id, coins: saved.coins ?? 120, food: saved.food ?? 8, wins: saved.wins ?? 0 }
    }
  } catch (e) { console.warn('Save could not be loaded', e) }
  const creatures = [
    generateStarter(401, { hueA: .73, hueB: .22, horns: .76, muscle: .64, size: .58, brain: .45, speed: .56 }),
    generateStarter(908, { hueA: .12, hueB: .83, wings: .81, speed: .74, brain: .68, horns: .25, size: .42 }),
    generateStarter(173, { hueA: .47, hueB: .1, armor: .79, bone: .78, size: .77, muscle: .55, wings: .1 }),
  ]
  ;['Cinderhorn', 'Glimmerwing', 'Mossback'].forEach((n, i) => { creatures[i].name = n; creatures[i].needs = freshNeeds(86 - i * 5) })
  return { creatures, selected: creatures[0].id, coins: 120, food: 8, wins: 0 }
}
const game = loadGame()
let mode = 'habitat', tab = 'overview', world, battle = null, toastTimer
const app = $('#app')
app.innerHTML = `
<div class="shell">
<header class="topbar"><a class="brand" href="#"><span class="brand-mark">H<span>↗</span></span><span class="brand-copy">HELIX<span>FORGE</span></span></a><div class="top-status"><i class="live-dot"></i> GENOME SANCTUARY <span class="season">SEASON 01 · THE VERDANT</span></div><div class="resources"><div class="resource"><span>✧</span><b id="coins">120</b><small>SHARDS</small></div><div class="resource"><span>◉</span><b id="food">8</b><small>NECTAR</small></div></div></header>
<main class="workspace">
<aside class="left-rail"><div class="section-label">YOUR SANCTUARY <span id="roster-count">03</span></div><div class="roster" id="roster"></div><button class="discover" data-action="discover">＋ DISCOVER CREATURE <small>60 ✧</small></button><div class="rail-spacer"></div><div class="sanctuary-card"><div class="sanctuary-orb">✳</div><div><b>THE HOLLOW</b><span>Habitat level 01</span></div><i class="live-tag">LIVE</i><p>Creatures wander, rest and recover here.</p><div class="harmony"><i></i></div><small>SANCTUARY HARMONY <b>78%</b></small></div><div class="rail-footer">BUILD 1.0 · AUTOSAVED</div></aside>
<section class="stage-column"><div class="stage-head"><div><div class="eyebrow" id="stage-kicker">◌ OPEN HABITAT</div><h1 id="stage-title">The Verdant Hollow</h1></div><div class="stage-controls"><span class="creature-count"><i></i><b id="stage-count">3</b> CREATURES</span><button class="view-btn active" data-mode="habitat">◉ HABITAT</button><button class="view-btn" data-mode="arena">⚔ ARENA</button></div></div>
<div class="viewport-wrap"><div class="viewport" id="viewport"></div><div class="viewport-vignette"></div><div class="scene-tag"><i class="live-dot"></i><span id="scene-tag-text">ECOSYSTEM ACTIVE</span></div><div class="camera-hint">DRAG TO ORBIT <b>·</b> SCROLL TO ZOOM</div><div id="battle-hud" class="battle-hud hidden"></div><div id="battle-result" class="battle-result hidden"></div></div>
<div class="stage-bottom"><div class="world-note"><span>✦</span><div><b id="world-note-title">THE HOLLOW IS ALIVE</b><small id="world-note-copy">Traits and temperament are written in every creature's DNA.</small></div></div><div class="stage-actions"><button class="secondary-btn" data-action="breed">♧ BREED</button><button class="primary-btn" data-action="arena">⚔ ENTER ARENA <b>↗</b></button></div></div></section>
<aside class="right-panel" id="right-panel"></aside>
</main><nav class="mobile-nav"><button data-action="sanctuary">◈<span>Sanctuary</span></button><button data-action="habitat">◉<span>Habitat</span></button><button data-action="profile">◎<span>Profile</span></button></nav><div class="toast" id="toast" role="status"></div><div class="modal-layer hidden" id="modal-layer"><div class="modal" id="modal"></div></div></div>`

const viewport = $('#viewport')
world = new World(viewport, { onSelect: selectCreature, onBackground: () => mode === 'habitat' && toast('Select a creature to inspect its genome.') })

function persist() {
  try { localStorage.setItem(SAVE, JSON.stringify({ creatures: game.creatures, selected: game.selected, coins: game.coins, food: game.food, wins: game.wins })) } catch (e) { console.warn('Save failed', e) }
  $('#coins').textContent = game.coins; $('#food').textContent = game.food
}
function selected() { return game.creatures.find(c => c.id === game.selected) || game.creatures[0] }
function toast(text) { const el = $('#toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600) }
function selectCreature(id) { if (!game.creatures.some(c => c.id === id)) return; game.selected = id; world.setSelected(id); renderRoster(); renderProfile(); persist() }
function populateWorld() {
  world.clearCreatures()
  const spots = [[-2.7,0,.5],[.4,0,-1.5],[2.4,0,1.7],[-1.4,0,3.2],[3.2,0,-2.3],[0,0,2.8]]
  game.creatures.forEach((c,i) => world.addCreature(c, { position: spots[i % spots.length], rotation: i * 1.9 }))
  world.setSelected(game.selected)
}
function renderRoster() {
  $('#roster').innerHTML = game.creatures.map((c,i) => {
    const p = phenotype(c.genome), vitality = Object.values(c.needs).reduce((a,b) => a+b,0)/4
    return `<button class="roster-card ${c.id === game.selected ? 'selected' : ''}" data-creature="${esc(c.id)}"><span class="roster-num">0${i+1}</span><span class="roster-avatar" style="--creature-color:${p.bodyColor};--creature-accent:${p.accentColor}"><i></i></span><span class="roster-info"><b>${esc(c.name)}</b><small>GEN ${c.generation || 0} <i>·</i> ${c.sex === 'F' ? '♀' : '♂'}</small><span class="roster-mini"><i style="width:${vitality}%"></i></span></span><span class="roster-rating">${statsOf(c).power}</span></button>`
  }).join('')
  $('#roster-count').textContent = String(game.creatures.length).padStart(2,'0'); $('#stage-count').textContent = game.creatures.length
}
function statBar(label, value, color) { return `<div class="stat-row"><span>${label}</span><div class="bar-track"><i style="width:${clamp(value,0,100)}%;background:${color}"></i></div><b>${Math.round(value)}</b></div>` }
function renderProfile() {
  const c = selected(); if (!c) return
  const p = phenotype(c.genome), stats = statsOf(c), genes = GENES
  const body = tab === 'genome' ? renderGenome(c) : tab === 'abilities' ? renderAbilities(c) : renderOverview(c,p,stats)
  const combat = mode === 'arena' && battle && !battle.finished && c.id === battle.player.id ? `<section class="combat-actions"><div class="block-heading"><span>CHOOSE YOUR MOVE</span><small>${battle.busy?'TURN IN PROGRESS':'YOUR TURN'}</small></div><div class="combat-grid">${movesFor(c).map(m=>`<button data-move="${m.id}" ${battle.busy?'disabled':''}><b>${m.icon} ${esc(m.name)}</b><small>${m.type==='defend'?`+${Math.abs(m.cost)} STA`:`${Math.max(0,m.cost)} STA · ${Math.round((m.power||0)*20)} PWR`}</small></button>`).join('')}</div></section>` : ''
  const trait = p.horns > .62 ? 'HORNED' : p.wings > .62 ? 'WINGED' : p.armor > .62 ? 'ARMORED' : 'ADAPTIVE'
  $('#right-panel').innerHTML = `<div class="profile-heading"><div><div class="eyebrow">CREATURE DOSSIER</div><h2>FIELD NOTES</h2></div><button class="icon-btn" data-action="rename" title="Rename creature">···</button></div>
  <div class="identity"><div class="identity-art" style="--creature-color:${p.bodyColor};--creature-accent:${p.accentColor}"><span class="art-creature"><i class="art-tail"></i><i class="art-horn"></i><i class="art-eye"></i></span><small>SPECIMEN 0${game.creatures.indexOf(c)+1}</small><b>${p.horns > .72 || p.wings > .75 ? '✦ RARE' : '◈ COMMON'}</b></div><div class="identity-copy"><div class="name-line"><h3>${esc(c.name)}</h3><span>${c.sex === 'F' ? '♀' : '♂'}</span></div><p>${c.generation ? `Generation ${c.generation} · offspring` : 'Foundling · Verdant Hollow'}</p><div class="trait-pills"><span>${esc(p.speciesType.toUpperCase())}</span><span>${p.postureName.toUpperCase()}</span><span>${trait}</span></div><small class="skin-note">${esc(p.skinType)}</small></div></div>
  <div class="profile-tabs"><button data-tab="overview" class="${tab==='overview'?'active':''}">OVERVIEW</button><button data-tab="genome" class="${tab==='genome'?'active':''}">GENOME <i>${GENES.length}</i></button><button data-tab="abilities" class="${tab==='abilities'?'active':''}">ABILITIES</button></div><div class="profile-content">${body}</div>${combat}
  <div class="profile-footer"><button class="care-btn" data-care="feed"><span>◉</span><b>FEED</b><small>1 NECTAR</small></button><button class="care-btn" data-care="play"><span>♡</span><b>PLAY</b><small>+FUN</small></button><button class="care-btn" data-care="rest"><span>☾</span><b>REST</b><small>+ENERGY</small></button></div>`
}
function renderOverview(c,p,s) {
  const needs = [['Hunger',c.needs.hunger,'🥩'],['Energy',c.needs.energy,'☾'],['Hygiene',c.needs.hygiene,'✧'],['Enrichment',c.needs.fun,'♡']]
  return `<section class="panel-block"><div class="block-heading"><span>VITAL SIGNS</span><b class="stable"><i></i> STABLE</b></div>${needs.map(([n,v,icon])=>`<div class="need-row"><span class="need-icon">${icon}</span><span class="need-name">${n}</span><span class="need-track"><i style="width:${v}%;background:${v<28?'#ff7a72':v<55?'#ffc36a':'#77e6bf'}"></i></span><b>${Math.round(v)}%</b></div>`).join('')}</section>
  <section class="panel-block"><div class="block-heading"><span>GENETIC POTENTIAL</span><button class="text-action" data-tab="genome">VIEW DNA ↗</button></div>${statBar('ABILITY',s.power,'#d7fa77')}${statBar('BONES',s.bones,'#f2cb77')}${statBar('MOBILITY',s.mobility,'#71d9db')}${statBar('INTELLECT',s.brain,'#b9a4f5')}</section>
  <section class="temperament"><span>✺</span><div><b>INSTINCT PROFILE</b><p>${p.brain>.67?'A keen strategist with a curious streak.':p.speed>.67?'Restless and quick to answer a challenge.':p.muscle>.68?'A bold powerhouse who thrives on action.':'An adaptable soul, ready to find its own path.'}</p></div></section><div class="record-line"><span>RECORD <b>${c.wins||0}W — ${Math.max(0,(c.battles||0)-(c.wins||0))}L</b></span><span>AGE <b>${formatAge(c.born)}</b></span></div>`
}
function renderGenome(c) {
  const groups = { frame:'FRAME', limb:'LIMBS', weapon:'ADAPTATIONS', adapt:'ANIMAL ADAPTATIONS', core:'CORE', form:'BODY PLAN', coat:'PIGMENT' }
  return `<div class="genome-summary"><small>DNA SEQUENCE<br><b>${dnaSequence(c.genome).slice(0,22)}…</b></small><span>GEN ${c.generation||0}</span></div>${Object.entries(groups).map(([group,label])=>`<section class="gene-group"><div class="gene-group-title">${label}<span>${GENES.filter(g=>g.group===group).length} LOCI</span></div>${GENES.filter(g=>g.group===group).map(g=>{const [a,b]=c.genome?.[g.key]||[0.5,0.5];return `<div class="gene-line" title="${esc(g.desc)}"><span>${g.label}</span><span class="alleles"><i style="width:${a*100}%"></i><i style="width:${b*100}%"></i></span><b>${Math.round((a+b)*50)}</b></div>`}).join('')}</section>`).join('')}`
}
function renderAbilities(c) {
  const moves = movesFor(c)
  return `<div class="ability-intro"><span>DNA-EXPRESSED ABILITIES</span><small>${moves.length} UNLOCKED</small></div>${moves.map(m=>`<article class="move-card"><div class="move-icon ${m.type}">${m.icon}</div><div class="move-info"><div><b>${esc(m.name)}</b><span>${m.tag}</span></div><p>${esc(m.desc)}</p><small>${m.type==='defend'?'RECOVERY':`POWER ${Math.round(m.power*34)}`} · COST ${Math.max(0,m.cost)} STA</small></div></article>`).join('')}<div class="ability-note">Abilities emerge from expressed traits. Breed for new combinations.</div>`
}
function care(action) {
  const c=selected()
  if(action==='feed') { if(game.food<1)return toast('You are out of nectar. Discover a creature to restock.'); if(c.needs.hunger>94)return toast(`${c.name} is already full.`); game.food--; c.needs.hunger=clamp(c.needs.hunger+38,0,100); c.needs.energy=clamp(c.needs.energy+5,0,100); toast(`${c.name} enjoyed a nectar fruit.`) }
  else if(action==='play') { if(c.needs.energy<12)return toast(`${c.name} is too tired to play. Let them rest.`); c.needs.fun=clamp(c.needs.fun+30,0,100); c.needs.energy=Math.max(0,c.needs.energy-8); toast(`${c.name} had a lovely play session.`) }
  else { c.needs.energy=clamp(c.needs.energy+36,0,100); c.needs.hygiene=clamp(c.needs.hygiene+8,0,100); toast(`${c.name} took a restorative nap.`) }
  persist(); renderProfile(); renderRoster()
}
function showModal(content) { $('#modal').innerHTML=content; $('#modal-layer').classList.remove('hidden') }
function closeModal() { $('#modal-layer').classList.add('hidden') }
function discover() {
  if(game.coins<60)return toast('You need 60 shards to discover a creature.')
  showModal(`<button class="modal-close" data-action="close" aria-label="Close discovery">×</button><div class="eyebrow">VERDANT HOLLOW · FIELD FIND</div><h2>Shape a new foundling</h2><p>Choose up to three adaptations to guarantee in this creature’s DNA. Every pick grows into a visible body part.</p><div class="adapt-grid">${ADAPTATIONS.map(a=>`<label class="adapt-option"><input type="checkbox" name="adaptation" value="${a.key}"><span class="adapt-icon">${a.icon}</span><span class="adapt-copy"><b>${a.name}</b><small>${a.source}</small><em>${a.note}</em></span><i class="adapt-check">＋</i></label>`).join('')}</div><div class="adapt-footer"><span id="adapt-count">0 / 3 SELECTED</span><small>DISCOVERY COST · 60 ✧</small></div><div class="modal-actions"><button class="secondary-btn" data-action="close">CANCEL</button><button class="primary-btn" data-action="discover-confirm">SEARCH THE HOLLOW ↗</button></div>`)
}
function discoverConfirm() {
  if(game.coins<60)return toast('You need 60 shards to discover a creature.')
  const selectedTraits=[...document.querySelectorAll('input[name="adaptation"]:checked')].map(input=>input.value).filter(key=>ADAPTATIONS.some(a=>a.key===key)).slice(0,3)
  game.coins-=60
  const c=generateWild()
  for(const adaptation of ADAPTATIONS) c.genome[adaptation.key]=selectedTraits.includes(adaptation.key)?[0.88,0.96]:[0.04,0.12]
  c.needs=freshNeeds(82)
  game.creatures.push(c); game.selected=c.id; closeModal()
  if(mode==='habitat') { world.addCreature(c,{position:[(Math.random()-.5)*5,0,(Math.random()-.5)*5]}); world.setSelected(c.id) }
  persist(); renderRoster(); renderProfile(); toast(`${c.name} joined your sanctuary with ${selectedTraits.length} adaptation${selectedTraits.length===1?'':'s'}.`)
}
function breedDialog() {
  if(game.creatures.length<2)return toast('You need two creatures to breed.')
  const a=selected(), others=game.creatures.filter(c=>c.id!==a.id)
  showModal(`<button class="modal-close" data-action="close">×</button><div class="eyebrow">INHERITANCE LAB · GEN 0${(a.generation||0)+1}</div><h2>Pair a lineage</h2><p>Choose a second parent. Their expressed traits combine with ${esc(a.name)}'s DNA; mutation can create new adaptations.</p><div class="parent-preview"><div class="parent-chip"><i style="--creature-color:${phenotype(a.genome).bodyColor}"></i><span><b>${esc(a.name)}</b><small>SELECTED PARENT</small></span></div><span class="cross">×</span><select id="mate-select">${others.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${c.sex==='F'?'♀':'♂'} · GEN ${c.generation||0}</option>`).join('')}</select></div><div class="modal-actions"><button class="secondary-btn" data-action="close">CANCEL</button><button class="primary-btn" data-action="breed-confirm">CREATE OFFSPRING ↗</button></div>`)
}
function breed() {
  const parent=selected(), mate=game.creatures.find(c=>c.id===$('#mate-select')?.value)
  if(!mate)return closeModal()
  const {genome,mutations}=breedGenomes(parent.genome,mate.genome)
  const child={id:cryptoId(),name:makeName(genome,[parent,mate]),genome,sex:sexOf(),needs:freshNeeds(90),wins:0,battles:0,born:Date.now(),generation:Math.max(parent.generation||0,mate.generation||0)+1,parents:[parent.id,mate.id]}
  game.creatures.push(child); game.selected=child.id; closeModal(); if(mode==='habitat') { world.addCreature(child,{position:[0,0,0]}); world.setSelected(child.id) }
  persist(); renderRoster(); renderProfile(); toast(`${child.name} hatched with ${mutations.length} mutated gene${mutations.length===1?'':'s'}!`)
}
function renameDialog() {
  const c=selected(); showModal(`<button class="modal-close" data-action="close">×</button><div class="eyebrow">CREATURE DOSSIER</div><h2>Rename specimen</h2><label class="field-label">SPECIMEN NAME<input id="rename-input" maxlength="20" value="${esc(c.name)}"></label><div class="modal-actions"><button class="secondary-btn" data-action="close">CANCEL</button><button class="primary-btn" data-action="rename-confirm">SAVE NAME</button></div>`)
  $('#rename-input').focus(); $('#rename-input').select()
}
function rename() { const input=$('#rename-input'), name=input?.value.trim(); if(!name)return toast('A name cannot be empty.'); selected().name=name; closeModal(); renderRoster(); renderProfile(); persist(); toast('Specimen renamed.') }
function arenaDialog() {
  if(game.creatures.length<2)return toast('Discover another creature before entering the arena.')
  const player=selected(), foes=game.creatures.filter(c=>c.id!==player.id)
  const foe=[...foes].sort((a,b)=>Math.abs(statsOf(a).power-statsOf(player).power)-Math.abs(statsOf(b).power-statsOf(player).power))[0]
  showModal(`<button class="modal-close" data-action="close">×</button><div class="eyebrow">THE CRUCIBLE · FRIENDLY MATCH</div><h2>Ready for a bout?</h2><p>Choose your opponent. Battles are turn-based; abilities and stamina are shaped by each creature's DNA.</p><div class="fight-preview"><div class="fight-side"><i style="--creature-color:${phenotype(player.genome).bodyColor}"></i><b>${esc(player.name)}</b><small>POWER ${statsOf(player).power}</small></div><span>VS</span><select id="foe-select">${foes.map(c=>`<option value="${esc(c.id)}" ${c.id===foe.id?'selected':''}>${esc(c.name)} · POW ${statsOf(c).power}</option>`).join('')}</select></div><div class="modal-actions"><button class="secondary-btn" data-action="close">CANCEL</button><button class="primary-btn" data-action="battle-start">BEGIN BOUT ↗</button></div>`)
}
function startBattle() {
  const player=selected(), foe=game.creatures.find(c=>c.id===$('#foe-select')?.value)
  if(!foe)return closeModal()
  closeModal(); mode='arena'; tab='overview'
  battle={player,foe,hp:{player:maxHpOf(player),foe:maxHpOf(foe)},maxHp:{player:maxHpOf(player),foe:maxHpOf(foe)},sta:{player:maxStaminaOf(player),foe:maxStaminaOf(foe)},maxSta:{player:maxStaminaOf(player),foe:maxStaminaOf(foe)},guard:{player:false,foe:false},busy:false,turn:1}
  world.enterArena(player,foe); updateModeUI(); renderProfile(); renderBattle()
}
function updateModeUI() {
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode))
  $('#stage-title').textContent=mode==='arena'?'The Crucible':'The Verdant Hollow'
  $('#stage-kicker').textContent=mode==='arena'?'⚔ COMBAT ARENA':'◌ OPEN HABITAT'
  $('#scene-tag-text').textContent=mode==='arena'?'BATTLE IN PROGRESS':'ECOSYSTEM ACTIVE'
  $('.creature-count').style.display=mode==='arena'?'none':''
  $('[data-action="arena"]').innerHTML=mode==='arena'?'↩ RETURN TO HOLLOW <b>↗</b>':'⚔ ENTER ARENA <b>↗</b>'
  $('[data-action="breed"]').disabled=mode==='arena'
}
function renderBattle() {
  const hud=$('#battle-hud'), result=$('#battle-result')
  if(!battle) { hud.classList.add('hidden'); result.classList.add('hidden'); return }
  hud.classList.remove('hidden')
  const bar=(who,label)=>`<div class="fighter-hud ${who}"><div class="fighter-label"><b>${esc(battle[who].name)}</b><span>${label}</span></div><div class="fight-meter hp"><i style="width:${battle.hp[who]/battle.maxHp[who]*100}%"></i></div><small>HP ${battle.hp[who]} / ${battle.maxHp[who]}</small><div class="fight-meter stamina"><i style="width:${battle.sta[who]/battle.maxSta[who]*100}%"></i></div><small>STA ${battle.sta[who]} / ${battle.maxSta[who]}</small></div>`
  hud.innerHTML=`${bar('player','YOUR CREATURE')}<div class="battle-turn">ROUND ${battle.turn}<small>${battle.busy?'ACTION IN PROGRESS':'CHOOSE AN ABILITY'}</small></div>${bar('foe','OPPONENT')}`
  if(battle.finished) { result.classList.remove('hidden'); result.innerHTML=`<div class="result-stamp">${battle.winner==='player'?'VICTORY':'DEFEAT'}</div><b>${esc(battle.winner==='player'?battle.player.name:battle.foe.name)} ${battle.winner==='player'?'wins the bout':'takes the round'}</b><button class="primary-btn" data-action="battle-exit">RETURN TO HOLLOW</button>` } else result.classList.add('hidden')
  renderProfile()
}
function applyMove(attacker, defender, move, done) {
  if(!battle||battle.finished)return
  if(move.type==='defend') {
    battle.guard[attacker]=true; battle.sta[attacker]=Math.min(battle.maxSta[attacker],battle.sta[attacker]+Math.abs(move.cost));
    toast(`${battle[attacker].name} braces and recovers stamina.`); done(); return
  }
  const cost=Math.max(0,move.cost)
  if(battle.sta[attacker]<cost) { battle.sta[attacker]=Math.min(battle.maxSta[attacker],battle.sta[attacker]+12); toast(`${battle[attacker].name} is winded and recovers 12 stamina.`); done(); return }
  battle.sta[attacker]-=cost
  if(Math.random()>move.acc) { toast(`${move.name} missed!`); done(); return }
  let damage=Math.round((10+move.power*16)*(0.78+statsOf(battle[attacker]).power/180)*(0.82+Math.random()*.36))
  if(move.crit&&Math.random()<move.crit)damage=Math.round(damage*1.5)
  if(battle.guard[defender]&&!move.pierce){damage=Math.ceil(damage*.48);battle.guard[defender]=false;toast(`${battle[defender].name} guarded the hit!`)}
  battle.hp[defender]=Math.max(0,battle.hp[defender]-damage)
  if(attacker==='player')world.battleLunge('player',()=>world.hitReact('foe'));else world.battleLunge('foe',()=>world.hitReact('player'))
  world.burst?.({x:attacker==='player'?2: -2,y:1.5,z:.3},phenotype(battle[attacker].genome).accentColor,15)
  toast(`${move.name} dealt ${damage} damage.`)
  if(move.buff==='evade')battle.guard[attacker]=true
  done()
}
function playerTurn(moveId) {
  if(!battle||battle.busy||battle.finished)return
  const move=movesFor(battle.player).find(m=>m.id===moveId); if(!move)return
  battle.busy=true; renderBattle()
  applyMove('player','foe',move,()=>{
    if(battle.hp.foe<=0)return finishBattle('player')
    setTimeout(enemyTurn,650)
  })
}
function enemyTurn() {
  if(!battle||battle.finished)return
  const choices=movesFor(battle.foe).filter(m=>m.type==='strike'&&battle.sta.foe>=m.cost)
  const move=choices[Math.floor(Math.random()*choices.length)]||movesFor(battle.foe).find(m=>m.type==='defend')
  battle.turn++; applyMove('foe','player',move,()=>{
    if(battle.hp.player<=0)return finishBattle('foe')
    battle.busy=false; renderBattle()
  })
}
function finishBattle(winner) {
  battle.finished=true; battle.winner=winner; battle.busy=false
  battle.player.battles=(battle.player.battles||0)+1; battle.foe.battles=(battle.foe.battles||0)+1
  if(winner==='player'){battle.player.wins=(battle.player.wins||0)+1;game.wins++;game.coins+=25;toast('Victory! +25 shards and a new experience point.')}else toast(`${battle.foe.name} wins this round. Your creature will be ready for another bout.`)
  persist(); renderBattle(); renderRoster()
}
function exitBattle() { battle=null; world.exitArena(); mode='habitat'; updateModeUI(); populateWorld(); renderBattle(); renderProfile() }
function dispatch(action) {
  if(action==='close')closeModal()
  else if(action==='discover')discover()
  else if(action==='discover-confirm')discoverConfirm()
  else if(action==='breed')breedDialog()
  else if(action==='breed-confirm')breed()
  else if(action==='rename')renameDialog()
  else if(action==='rename-confirm')rename()
  else if(action==='arena')mode==='arena'?exitBattle():arenaDialog()
  else if(action==='battle-start')startBattle()
  else if(action==='battle-exit')exitBattle()
  else if(action==='sanctuary'){window.scrollTo({top:0,behavior:'smooth'});toast('Sanctuary roster is ready.')}
  else if(action==='habitat'){if(mode==='arena')exitBattle();else toast('You are in the Verdant Hollow.')}
  else if(action==='profile'){document.querySelector('.right-panel').scrollIntoView({behavior:'smooth',block:'start'})}
}
document.addEventListener('change',e=>{
  const input=e.target.closest('input[name="adaptation"]')
  if(!input)return
  const checked=[...document.querySelectorAll('input[name="adaptation"]:checked')]
  if(checked.length>3){input.checked=false;toast('Choose up to three adaptations.')}
  $('#adapt-count').textContent=`${document.querySelectorAll('input[name="adaptation"]:checked').length} / 3 SELECTED`
})
document.addEventListener('click',e=>{
  const action=e.target.closest('[data-action]')?.dataset.action
  if(action){dispatch(action);return}
  const creature=e.target.closest('[data-creature]')?.dataset.creature
  if(creature){selectCreature(creature);return}
  const tabButton=e.target.closest('[data-tab]')
  if(tabButton){tab=tabButton.dataset.tab;renderProfile();return}
  const careButton=e.target.closest('[data-care]')
  if(careButton){care(careButton.dataset.care);return}
  const move=e.target.closest('[data-move]')
  if(move){playerTurn(move.dataset.move);return}
  const modeButton=e.target.closest('[data-mode]')
  if(modeButton){if(modeButton.dataset.mode==='arena'){if(mode==='arena')return;arenaDialog()}else if(mode==='arena')exitBattle();return}
  if(e.target.id==='modal-layer')closeModal()
})
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if(e.key==='Enter'&&e.target.id==='rename-input')rename()})
function gameLoop(now) {
  const dt=Math.min(1,(now-(game.lastTick||now))/1000); game.lastTick=now
  if(mode==='habitat'&&dt>0){game.creatures.forEach(c=>decayNeeds(c,dt));if((game.decayTimer=(game.decayTimer||0)+dt)>7){game.decayTimer=0;renderProfile();renderRoster();persist()}}
  requestAnimationFrame(gameLoop)
}
window.addEventListener('beforeunload',persist)
persist(); renderRoster(); renderProfile(); populateWorld(); updateModeUI(); requestAnimationFrame(gameLoop)
