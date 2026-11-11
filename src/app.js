import './style.css'
import { World } from './scene.js'
import { portraitDataURL } from './creature.js'
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
{ key: 'mammifere', icon: '🦁', name: 'Mammifère', source: 'Lion · bear', note: 'Fur and warm-blooded traits' },
{ key: 'reptile', icon: '🐍', name: 'Reptilian', source: 'Snake · lizard', note: 'Scales and cold-blooded traits' },
{ key: 'tusks', icon: '🦷', name: 'Tusks', source: 'Boar · walrus', note: 'Protruding gore teeth' },
{ key: 'mane', icon: '🌊', name: 'Neck Mane', source: 'Lion · horse', note: 'Furred neck crest' },
{ key: 'biolum', icon: '✨', name: 'Bioluminescence', source: 'Jellyfish · firefly', note: 'Glowing body markings' },
]
const DNA_CONTRACTS = [
  { id: 'bulwark', icon: '⬡', name: 'Living Bulwark', note: 'Armor ≥ 75% · Bone ≥ 65%', goals: [['armor', .75], ['bone', .65]] },
  { id: 'skybound', icon: '≋', name: 'Skybound', note: 'Wings ≥ 72% · Speed ≥ 58%', goals: [['wings', .72], ['speed', .58]] },
  { id: 'colossus', icon: '⬤', name: 'Colossus', note: 'Stature ≥ 72% · Muscle ≥ 65%', goals: [['size', .72], ['muscle', .65]] },
  { id: 'mosaic', icon: '✦', name: 'Wild Mosaic', note: 'Pattern ≥ 70% · Skin ≥ 70%', goals: [['pattern', .70], ['hide', .70]] },
]

const portraitCache = new Map()
function creaturePortrait(c) {
  let url = portraitCache.get(c.id)
  if (!url) {
    try { url = portraitDataURL(c.genome, 110) } catch (e) { console.warn('creature portrait failed', e) }
    if (url) portraitCache.set(c.id, url)
  }
  return url
}
function dropPortrait(id) { portraitCache.delete(id) }

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE))
    if (saved?.creatures?.length) {
      saved.creatures.forEach(c => { c.needs ||= freshNeeds(78); c.wins ||= 0; c.battles ||= 0; c.born ||= Date.now() })
      return { creatures: saved.creatures, selected: saved.selected || saved.creatures[0].id, coins: saved.coins ?? 120, food: saved.food ?? 8, wins: saved.wins ?? 0, archives: Array.isArray(saved.archives) ? saved.archives : [], xp: Math.max(0, Math.floor(Number(saved.xp) || 0)), xpClaims: Array.isArray(saved.xpClaims) ? saved.xpClaims : [], roadLevel: Math.max(1, Math.floor(Number(saved.roadLevel) || 1)) }
    }
  } catch (e) { console.warn('Save could not be loaded', e) }
  const creatures = [
    generateStarter(401, { hueA: .73, hueB: .22, horns: .76, muscle: .64, size: .58, brain: .45, speed: .56 }),
    generateStarter(908, { hueA: .12, hueB: .83, wings: .81, speed: .74, brain: .68, horns: .25, size: .42 }),
    generateStarter(173, { hueA: .47, hueB: .1, armor: .79, bone: .78, size: .77, muscle: .55, wings: .1 }),
  ]
  ;['Cinderhorn', 'Glimmerwing', 'Mossback'].forEach((n, i) => { creatures[i].name = n; creatures[i].needs = freshNeeds(86 - i * 5) })
  return { creatures, selected: creatures[0].id, coins: 120, food: 8, wins: 0, archives: [], xp: 0, xpClaims: [], roadLevel: 1 }
}
const game = loadGame()
let mode = 'habitat', tab = 'overview', world, battle = null, toastTimer, releaseTargetId = null, currentBiome = null
const app = $('#app')
app.innerHTML = `
<div class="shell">
<header class="topbar"><a class="brand" href="#"><span class="brand-mark">H<span>↗</span></span><span class="brand-copy">HELIX<span>FORGE</span></span></a><div class="top-status"><i class="live-dot"></i> GENOME SANCTUARY <span class="season">SEASON 01 · THE VERDANT</span></div><div class="header-actions"><button class="player-chip" data-action="player-profile" aria-label="Open player profile"><span class="player-level" id="player-level">01</span><span class="player-progress"><b>PLAYER</b><i><em id="player-xp-bar"></em></i><small id="player-xp-label">LV 1 · 0 / 100 XP</small></span></button><button class="guide-btn" data-action="guide" aria-label="How to play">? <span>GUIDE</span></button><div class="resources"><div class="resource"><span>✧</span><b id="coins">120</b><small>SHARDS</small></div><div class="resource"><span>◉</span><b id="food">8</b><small>NECTAR</small></div></div></div></header>
<main class="workspace">
<aside class="left-rail"><div class="section-label">YOUR SANCTUARY <span id="roster-count">03</span></div><div class="roster" id="roster"></div><button class="discover" data-action="discover">＋ DISCOVER CREATURE <small>60 ✧</small></button><div class="rail-spacer"></div><div class="sanctuary-card"><div class="sanctuary-orb">✳</div><div><b>THE HOLLOW</b><span>Habitat level 01</span></div><i class="live-tag">LIVE</i><p>Creatures wander, rest and recover here.</p><div class="harmony"><i></i></div><small>SANCTUARY HARMONY <b>78%</b></small></div><div class="rail-footer">BUILD 1.0 · AUTOSAVED</div></aside>
<section class="stage-column"><div class="stage-head"><div><div class="eyebrow" id="stage-kicker">◌ OPEN HABITAT</div><h1 id="stage-title">The Verdant Hollow</h1></div><div class="stage-controls"><span class="creature-count"><i></i><b id="stage-count">3</b> CREATURES</span><button class="view-btn active" data-mode="habitat">◉ HABITAT</button><button class="view-btn" data-mode="arena">⚔ ARENA</button></div></div>
<div class="viewport-wrap"><div class="viewport" id="viewport"></div><div class="viewport-vignette"></div><div class="scene-tag"><i class="live-dot"></i><span id="scene-tag-text">ECOSYSTEM ACTIVE</span></div><div class="camera-hint">DRAG TO PAN THE MAP <b>·</b> SCROLL TO ZOOM</div>
<div id="battle-hud" class="battle-hud hidden"></div><div id="battle-result" class="battle-result hidden"></div></div>
<div class="stage-bottom"><div class="world-note"><span>✦</span><div><b id="world-note-title">THE HOLLOW IS ALIVE</b><small id="world-note-copy">Traits and temperament are written in every creature's DNA.</small></div></div><div class="stage-actions"><button class="secondary-btn" data-action="archives">▤ DNA ARCHIVE</button><button class="secondary-btn" data-action="breed">♧ BREED</button><button class="primary-btn" data-action="arena">⚔ ENTER ARENA <b>↗</b></button></div></div></section>
<aside class="right-panel" id="right-panel"></aside>
</main>
<div class="habitat-nav" aria-label="Habitat navigation">
  <button data-nav="up" aria-label="Pan up">▲</button>
  <button data-nav="down" aria-label="Pan down">▼</button>
  <button data-nav="left" aria-label="Pan left">◀</button>
  <button data-nav="right" aria-label="Pan right">▶</button>
  <button data-zoom="in" aria-label="Zoom in">⊕</button>
  <button data-zoom="out" aria-label="Zoom out">⊖</button>
  <button data-nav="reset" aria-label="Center view">⌂</button>
</div>
<nav class="mobile-nav"><button data-action="sanctuary">◈<span>Sanctuary</span></button><button data-action="habitat">◉<span>Habitat</span></button><button data-action="profile">◎<span>Profile</span></button></nav><div class="toast" id="toast" role="status"></div><div class="modal-layer hidden" id="modal-layer"><div class="modal" id="modal"></div></div></div>`

const viewport = $('#viewport')
world = new World(viewport, {
  onSelect: selectCreature,
  onBackground: () => mode === 'habitat' && toast('Select a creature to inspect its genome.'),
  onBiome: (b) => { currentBiome = b; renderStageTag() },
})

function xpForNextLevel(level) { return 100 + (level - 1) * 25 }
function levelInfo(total = game.xp) {
  let level = 1, remaining = Math.max(0, Math.floor(total))
  while (remaining >= xpForNextLevel(level)) { remaining -= xpForNextLevel(level); level++ }
  return { level, current: remaining, needed: xpForNextLevel(level), percent: Math.min(100, remaining / xpForNextLevel(level) * 100) }
}
function awardXP(amount, reason, claimKey = null) {
  if (claimKey && game.xpClaims.includes(claimKey)) return false
  const reward = Math.max(0, Math.floor(Number(amount) || 0))
  if (!reward) return false
  if (claimKey) game.xpClaims.push(claimKey)
  game.xp += reward
  return true
}
function persist() {
  try { localStorage.setItem(SAVE, JSON.stringify({ creatures: game.creatures, selected: game.selected, coins: game.coins, food: game.food, wins: game.wins, archives: game.archives, xp: game.xp, xpClaims: game.xpClaims, roadLevel: game.roadLevel })) } catch (e) { console.warn('Save failed', e) }
  $('#coins').textContent = game.coins; $('#food').textContent = game.food
  const progress = levelInfo()
  $('#player-level').textContent = String(progress.level).padStart(2, '0')
  $('#player-xp-bar').style.width = `${progress.percent}%`
  $('#player-xp-label').textContent = `LV ${progress.level} · ${progress.current} / ${progress.needed} XP`
}
function selected() { return game.creatures.find(c => c.id === game.selected) || game.creatures[0] }
function toast(text) { const el = $('#toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600) }
function selectCreature(id) { if (mode === 'arena') return toast('Return to the Hollow before changing your active creature.'); if (!game.creatures.some(c => c.id === id)) return; game.selected = id; world.setSelected(id); renderRoster(); renderProfile(); persist() }
function populateWorld() {
  world.clearCreatures()
  const spots = [[-2.7,0,.5],[.4,0,-1.5],[2.4,0,1.7],[-1.4,0,3.2],[3.2,0,-2.3],[0,0,2.8]]
  game.creatures.forEach((c,i) => world.addCreature(c, { position: spots[i % spots.length], rotation: i * 1.9 }))
  world.setSelected(game.selected)
}
function renderRoster() {
  $('#roster').innerHTML = game.creatures.map((c,i) => {
    const p = phenotype(c.genome), vitality = Object.values(c.needs).reduce((a,b) => a+b,0)/4
    const purl = creaturePortrait(c)
    return `<button class="roster-card ${c.id === game.selected ? 'selected' : ''}" data-creature="${esc(c.id)}" ${mode === 'arena' ? 'disabled title="Return to the Hollow before changing your active creature."' : ''}><span class="roster-num">0${i+1}</span><span class="roster-avatar" style="--creature-color:${p.bodyColor};--creature-accent:${p.accentColor}">${purl?`<img src="${esc(purl)}" class="roster-portrait" alt="${esc(c.name)} portrait">`:''}<i></i></span><span class="roster-info"><b>${esc(c.name)}</b><small>GEN ${c.generation || 0} <i>·</i> ${c.sex === 'F' ? '♀' : '♂'}</small><span class="roster-mini"><i style="width:${vitality}%"></i></span></span><span class="roster-rating">${statsOf(c).power}</span></button>`
  }).join('')
  $('#roster-count').textContent = String(game.creatures.length).padStart(2,'0'); $('#stage-count').textContent = game.creatures.length
}
function statBar(label, value, color) { return `<div class="stat-row"><span>${label}</span><div class="bar-track"><i style="width:${clamp(value,0,100)}%;background:${color}"></i></div><b>${Math.round(value)}</b></div>` }
function renderProfile() {
  const c = selected(); if (!c) return
  const p = phenotype(c.genome), stats = statsOf(c), genes = GENES
  const purl = creaturePortrait(c)
  const body = tab === 'genome' ? renderGenome(c) : tab === 'abilities' ? renderAbilities(c) : renderOverview(c,p,stats)
  const combat = mode === 'arena' && battle && !battle.finished && c.id === battle.player.id ? `<section class="combat-actions"><div class="block-heading"><span>CHOOSE YOUR MOVE</span><small>${battle.busy?'TURN IN PROGRESS':'YOUR TURN'}</small></div><div class="combat-grid">${movesFor(c).map(m=>`<button data-move="${m.id}" ${battle.busy?'disabled':''}><b>${m.icon} ${esc(m.name)}</b><small>${m.type==='defend'?`+${Math.abs(m.cost)} STA`:`${Math.max(0,m.cost)} STA · ${Math.round((m.power||0)*20)} PWR`}</small></button>`).join('')}</div></section>` : ''
  const trait = p.horns > .62 ? 'HORNED' : p.wings > .62 ? 'WINGED' : p.armor > .62 ? 'ARMORED' : 'ADAPTIVE'
  $('#right-panel').innerHTML = `<div class="profile-heading"><div><div class="eyebrow">CREATURE DOSSIER</div><h2>FIELD NOTES</h2></div><button class="icon-btn" data-action="rename" title="Rename creature">···</button></div>
  <div class="identity"><div class="identity-art" style="--creature-color:${p.bodyColor};--creature-accent:${p.accentColor}">${purl?`<img src="${esc(purl)}" class="identity-portrait" alt="${esc(c.name)} portrait">`:`<span class="art-creature"><i class="art-tail"></i><i class="art-horn"></i><i class="art-eye"></i></span>`}<small>SPECIMEN 0${game.creatures.indexOf(c)+1}</small><b>${p.horns > .72 || p.wings > .75 ? '✦ RARE' : '◈ COMMON'}</b></div><div class="identity-copy"><div class="name-line"><h3>${esc(c.name)}</h3><span>${c.sex === 'F' ? '♀' : '♂'}</span></div><p>${c.generation ? `Generation ${c.generation} · offspring` : 'Foundling · Verdant Hollow'}</p><div class="trait-pills"><span>${esc(p.speciesType.toUpperCase())}</span><span>${p.postureName.toUpperCase()}</span><span>${trait}</span></div><small class="skin-note">FORM ${String(p.morphologyIndex + 1).padStart(3, '0')} · ${esc(p.morphologyName)} · ${esc(p.skinType)}</small></div></div>
  <div class="profile-tabs"><button data-tab="overview" class="${tab==='overview'?'active':''}">OVERVIEW</button><button data-tab="genome" class="${tab==='genome'?'active':''}">GENOME <i>${GENES.length}</i></button><button data-tab="abilities" class="${tab==='abilities'?'active':''}">ABILITIES</button></div><div class="profile-content">${body}</div>${combat}
  <div class="profile-footer"><button class="care-btn" data-care="feed" ${mode==='arena' ? 'disabled title="Care is unavailable during a bout."' : ''}><span>◉</span><b>FEED</b><small>1 NECTAR</small></button><button class="care-btn" data-care="play" ${mode==='arena' ? 'disabled title="Care is unavailable during a bout."' : ''}><span>♡</span><b>PLAY</b><small>+FUN</small></button><button class="care-btn" data-care="rest" ${mode==='arena' ? 'disabled title="Care is unavailable during a bout."' : ''}><span>☾</span><b>REST</b><small>+ENERGY</small></button><button class="release-creature-btn" data-action="release" ${mode==='arena' || game.creatures.length <= 1 ? 'disabled' : ''} ${mode==='arena' ? 'title="Return to the habitat before releasing a creature."' : game.creatures.length <= 1 ? 'title="Your last creature must remain in the sanctuary."' : ''}>RELEASE CREATURE</button></div>`
}
function renderOverview(c,p,s) {
  const needs = [['Hunger',c.needs.hunger,'🥩'],['Energy',c.needs.energy,'☾'],['Hygiene',c.needs.hygiene,'✧'],['Enrichment',c.needs.fun,'♡']]
  return `<section class="panel-block"><div class="block-heading"><span>VITAL SIGNS</span><b class="stable"><i></i> STABLE</b></div>${needs.map(([n,v,icon])=>`<div class="need-row"><span class="need-icon">${icon}</span><span class="need-name">${n}</span><span class="need-track"><i style="width:${v}%;background:${v<28?'#ff7a72':v<55?'#ffc36a':'#77e6bf'}"></i></span><b>${Math.round(v)}%</b></div>`).join('')}</section>
  <section class="panel-block"><div class="block-heading"><span>GENETIC POTENTIAL</span><button class="text-action" data-tab="genome">VIEW DNA ↗</button></div>${statBar('ABILITY',s.power,'#d7fa77')}${statBar('BONES',s.bones,'#f2cb77')}${statBar('MOBILITY',s.mobility,'#71d9db')}${statBar('INTELLECT',s.brain,'#b9a4f5')}</section>
  <section class="temperament"><span>✺</span><div><b>INSTINCT PROFILE</b><p>${p.brain>.67?'A keen strategist with a curious streak.':p.speed>.67?'Restless and quick to answer a challenge.':p.muscle>.68?'A bold powerhouse who thrives on action.':'An adaptable soul, ready to find its own path.'}</p></div></section><div class="record-line"><span>RECORD <b>${c.wins||0}W — ${Math.max(0,(c.battles||0)-(c.wins||0))}L</b></span><span>AGE <b>${formatAge(c.born)}</b></span></div>`
}
function renderGenome(c) {
  const groups = { frame:'FRAME', limb:'LIMBS', weapon:'ADAPTATIONS', adapt:'ANIMAL ADAPTATIONS', core:'CORE', form:'BODY PLAN', coat:'PIGMENT' }
  const glyphs = { size:'⬡',length:'↔',girth:'◉',neck:'⌁',head:'◈',snout:'⌖',legs:'╱',stance:'▥',horns:'⌃',tail:'〰',armor:'▰',wings:'⟡',antlers:'♧',fins:'≋',gills:'≋',antennae:'⌇',carapace:'⬢',pincers:'⌘',muscle:'ϟ',bone:'╫',speed:'≫',brain:'✦',metabolism:'◌',eyes:'◎',posture:'⌖',bodyPlan:'⌂',archetype:'❖',hueA:'◉',hueB:'◉',pattern:'▦',hide:'✧' }
  const loci = GENES.map(g=>{const [a,b]=c.genome?.[g.key]||[0.5,0.5], expressed=Math.round((a+b)*50);return `<i class="chromosome-locus" style="--locus:${expressed}%" title="${esc(g.label)} ${expressed}%"></i>`}).join('')
  return `<div class="genome-summary"><div class="chromosome-art" aria-label="Chromosome map: ${GENES.length} paired loci">${loci}</div><div class="genome-summary-copy"><small>PAIRED CHROMOSOME · ${GENES.length} LOCI</small><code>${dnaSequence(c.genome).slice(0,22)}…</code></div><span>GEN ${c.generation||0}</span></div>${Object.entries(groups).map(([group,label])=>`<section class="gene-group"><div class="gene-group-title">${label}<span>${GENES.filter(g=>g.group===group).length} LOCI</span></div>${GENES.filter(g=>g.group===group).map(g=>{const [a,b]=c.genome?.[g.key]||[0.5,0.5], expressed=Math.round((a+b)*50);return `<div class="gene-visual" title="${esc(g.desc)}"><span class="gene-glyph" aria-hidden="true">${glyphs[g.key]||'◇'}</span><div class="gene-visual-main"><div class="gene-name-line"><b>${esc(g.label)}</b><span>${expressed}%</span></div><div class="allele-visual" role="img" aria-label="${esc(g.label)}: allele A ${Math.round(a*100)}%, allele B ${Math.round(b*100)}%"><span class="allele-track"><i style="width:${a*100}%"></i></span><span class="allele-track allele-b"><i style="width:${b*100}%"></i></span></div></div></div>`}).join('')}</section>`).join('')}`
}
function renderAbilities(c) {
  const moves = movesFor(c)
  const metric = (label,value,percent,kind='') => `<div class="ability-metric ${kind}" role="img" aria-label="${label} ${value}"><span>${label}</span><i><b style="width:${clamp(percent,0,100)}%"></b></i><strong>${value}</strong></div>`
  return `<div class="ability-intro"><span>DNA-EXPRESSED ABILITIES</span><small>${moves.length} UNLOCKED</small></div><div class="ability-spectrum" aria-label="Ability profile"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>${moves.map(m=>{const defense=m.type==='defend';const secondary=defense?`+${Math.abs(m.cost)} STA`:`${Math.round(m.acc*100)}%`;const effect=m.stagger?'STAGGER':m.debuff==='acc'?'OFF-BALANCE':m.buff?'EVASION':m.pierce?'PIERCING':m.crit?'CRITICAL':'';return `<article class="move-card ability-graphic-card ${m.type}"><div class="move-icon ${m.type}" aria-hidden="true">${m.icon}</div><div class="move-info"><div class="move-title-line"><b>${esc(m.name)}</b><span>${esc(m.tag)}</span></div><p>${esc(m.desc)}</p><div class="ability-metrics">${defense?metric('RECOVER',secondary,70,'recovery'):metric('POWER',`${Math.round(m.power*34)}`,m.power/1.8*100)}${!defense?metric('ACCURACY',secondary,m.acc*100,'accuracy'):''}${!defense?metric('COST',`${m.cost} STA`,m.cost/24*100,'cost'):''}</div>${effect?`<small class="ability-effect">✦ ${effect}</small>`:''}</div></article>`}).join('')}<div class="ability-note">Abilities emerge from expressed traits. Breed for new combinations.</div>`
}
function care(action) {
  if(mode==='arena')return toast('Care is unavailable during a bout.')
  const c=selected()
  if(action==='feed') { if(game.food<1)return toast('You are out of nectar. Discover a creature to receive 4 more.'); if(c.needs.hunger>94)return toast(`${c.name} is already full.`); game.food--; c.needs.hunger=clamp(c.needs.hunger+38,0,100); c.needs.energy=clamp(c.needs.energy+5,0,100); toast(`${c.name} enjoyed a nectar fruit.${awardXP(3, 'care', `care:${c.id}:feed`) ? ' +3 XP.' : ''}`) }
  else if(action==='play') { if(c.needs.energy<12)return toast(`${c.name} is too tired to play. Let them rest.`); c.needs.fun=clamp(c.needs.fun+30,0,100); c.needs.energy=Math.max(0,c.needs.energy-8); toast(`${c.name} had a lovely play session.${awardXP(3, 'care', `care:${c.id}:play`) ? ' +3 XP.' : ''}`) }
  else { c.needs.energy=clamp(c.needs.energy+36,0,100); c.needs.hygiene=clamp(c.needs.hygiene+8,0,100); toast(`${c.name} took a restorative nap.${awardXP(3, 'care', `care:${c.id}:rest`) ? ' +3 XP.' : ''}`) }
  persist(); renderProfile(); renderRoster()
}
function showModal(content) { $('#modal').innerHTML=content; $('#modal-layer').classList.remove('hidden') }
function closeModal() { $('#modal-layer').classList.add('hidden') }
function playerDialog() {
  const progress = levelInfo()
  showModal(`<button class="modal-close" data-action="close" aria-label="Close player profile">×</button><div class="eyebrow">SANCTUARY RECORD · PLAYER PROFILE</div><h2>Your field journal</h2><p>Every experiment and bout builds your legacy. Levels keep rising forever; each new level takes a little more experience.</p><div class="player-level-card"><span class="player-level player-level-large">${String(progress.level).padStart(2, '0')}</span><div><b>LEVEL ${progress.level} · GENOME NATURALIST</b><div class="player-xp-track"><i style="width:${progress.percent}%"></i></div><small>${progress.current} / ${progress.needed} XP TO LEVEL ${progress.level + 1}</small></div><strong>${game.xp.toLocaleString()}<small>TOTAL XP</small></strong></div><div class="journal-stats"><div><b>${game.wins}</b><small>ARENA WINS</small></div><div><b>${game.archives.length}</b><small>DNA RECORDS</small></div><div><b>${game.creatures.length}</b><small>CREATURES</small></div></div><h3 class="guide-subtitle">WAYS TO EARN EXPERIENCE</h3><div class="xp-rewards"><div><b>⚔ Win an arena bout</b><span>+35 XP · +25 shards</span></div><div><b>♧ Breed a new lineage</b><span>+25 XP per parent pairing</span></div><div><b>▤ Archive a genome</b><span>+15 XP per saved record</span></div><div><b>✦ Complete a DNA contract</b><span>+20 XP and +12 shards each</span></div><div><b>◈ Discover or hatch</b><span>+20 XP · archive hatch +10 XP</span></div><div><b>♡ Care for a creature</b><span>+3 XP for each care type, once per creature</span></div></div><p class="guide-footnote">Progress is saved on this device. Repeating one-time journal discoveries will not pay XP again.</p><div class="modal-actions"><button class="primary-btn" data-action="close">BACK TO THE HOLLOW</button></div>`)
}
function guideDialog() {
  showModal(`<button class="modal-close" data-action="close" aria-label="Close guide">×</button><div class="eyebrow">FIELD MANUAL · HELIX FORGE</div><h2>How to play</h2><p>Raise a living collection, shape its inherited traits, and put your designs to the test.</p><div class="guide-grid"><article><span>◈</span><div><b>Sanctuary & care</b><p>Select a creature to read its dossier. Feed with nectar, play to lift enrichment, and rest to restore energy. Needs slowly change while you are in the habitat.</p></div></article><article><span>✧</span><div><b>Discover specimens</b><p>Spend 60 shards to search the Hollow. Pick up to three adaptations to guarantee visible features in your new creature; each discovery also brings 4 nectar.</p></div></article><article><span>♧</span><div><b>Breed a lineage</b><p>Choose two creatures to combine their DNA. Offspring inherit a new genome, may mutate, and gain a generation number.</p></div></article><article><span>⚔</span><div><b>Enter the Crucible</b><p>Choose an opponent and use DNA-shaped abilities. Manage stamina: defending recovers it, while stronger attacks cost more. Victories award shards and XP.</p></div></article><article><span>▤</span><div><b>Archive & forge DNA</b><p>Save an independent copy from the DNA Archive. Edit both alleles in the Forge; the live preview updates as you tune traits. Saving a design never changes its source creature.</p></div></article><article><span>✦</span><div><b>Research contracts</b><p>Meet the paired trait targets shown on a forged record, then save it to claim that record’s one-time shard and XP rewards. Hatch any archived sequence as a separate creature.</p></div></article><article><span>◎</span><div><b>Grow your profile</b><p>Earn XP through battles, breeding, discovery, archives, contracts, hatching, and creature care. Your level has no cap; the XP needed rises gradually each level.</p></div></article></div><div class="modal-actions"><button class="primary-btn" data-action="close">GOT IT — LET’S PLAY</button></div>`)
}
const ADAPT_PART = {
  antlers: '♧ Crown of bone',
  fins: '≋ Dorsal sail',
  gills: '❋ Frilled cheek fans',
  antennae: '⌁ Sensory feelers',
  carapace: '⬡ Glossy shell',
  pincers: '⚯ Grasping claws',
  mammifere: '🦁 Fur & chest ruff',
  reptile: '🐍 Scale ridge & slit eyes',
  tusks: '🦷 Protruding teeth',
  mane: '🌊 Furred neck crest',
  biolum: '✨ Glowing markings',
}

function discover() {
  if(mode==='arena')return toast('Return to the Hollow before discovering a creature.')
  if(game.coins<60)return toast('You need 60 shards to discover a creature.')
  showModal(`<button class="modal-close" data-action="close" aria-label="Close discovery">×</button><div class="eyebrow">VERDANT HOLLOW · FIELD FIND</div><h2>Shape a new foundling</h2><p>Choose up to three adaptations to guarantee in this creature’s DNA. Every pick grows into a visible body part.</p><div class="discover-bar"><span class="discover-cost">60 ✧</span><span class="discover-reward">+4 NECTAR</span><span id="adapt-count" class="discover-pick">0 / 3 chosen</span></div><div class="adapt-grid">${ADAPTATIONS.map(a=>`<label class="adapt-card"><input type="checkbox" name="adaptation" value="${a.key}"><div class="adapt-face"><div class="adapt-ring"></div><span class="adapt-glyph">${a.icon}</span></div><div class="adapt-copy"><b>${esc(a.name)}</b><small>${esc(a.source)}</small><em>${esc(a.note)}</em></div><span class="adapt-part">${ADAPT_PART[a.key]}</span><i class="adapt-mark">✓</i></label>`).join('')}</div><div class="discover-hint">Pick adaptations that suit the niche you want to fill. Unpicked traits stay dormant in the wild genome.</div><div class="modal-actions"><button class="secondary-btn" data-action="close">CANCEL</button><button class="primary-btn" data-action="discover-confirm" disabled>SEARCH THE HOLLOW ↗</button></div>`)
}
function discoverConfirm() {
  if(mode==='arena')return toast('Return to the Hollow before discovering a creature.')
  if(game.coins<60)return toast('You need 60 shards to discover a creature.')
  const selectedTraits=[...document.querySelectorAll('#modal input[name="adaptation"]:checked')].map(input=>input.value).filter(key=>ADAPTATIONS.some(a=>a.key===key)).slice(0,3)
  if(selectedTraits.length===0)return toast('Choose at least one adaptation.')
  game.coins-=60
  game.food+=4
  const c=generateWild()
  for(const adaptation of ADAPTATIONS) c.genome[adaptation.key]=selectedTraits.includes(adaptation.key)?[0.88,0.96]:[0.04,0.12]
  c.needs=freshNeeds(82)
  game.creatures.push(c); game.selected=c.id; closeModal()
  if(mode==='habitat') { world.addCreature(c,{position:[(Math.random()-.5)*5,0,(Math.random()-.5)*5]}); world.setSelected(c.id) }
  awardXP(20, 'discovery', `discover:${c.id}`)
  persist(); renderRoster(); renderProfile(); toast(`${c.name} joined with ${selectedTraits.length} adaptation${selectedTraits.length===1?'':'s'}; +4 nectar and +20 XP.`)
}
function copyGenome(genome) {
  return Object.fromEntries(GENES.map(g => {
    const alleles = genome?.[g.key] || [0.5, 0.5]
    return [g.key, [clamp(Number(alleles[0]) || 0, 0, 1), clamp(Number(alleles[1]) || 0, 0, 1)]]
  }))
}
function archivesDialog() {
  const items = game.archives.map(entry => {
    const p = phenotype(entry.genome)
    return `<article class="archive-card"><div class="archive-swatch" style="--creature-color:${p.bodyColor};--creature-accent:${p.accentColor}"><i></i></div><div class="archive-info"><b>${esc(entry.name)}</b><small>${esc(entry.sourceName || 'Unknown specimen')} · ${new Date(entry.savedAt || Date.now()).toLocaleDateString()}</small><code>${dnaSequence(entry.genome).slice(0, 18)}…</code></div><div class="archive-actions"><button class="text-action" data-action="archive-edit" data-archive-id="${esc(entry.id)}">EDIT</button><button class="text-action" data-action="archive-create" data-archive-id="${esc(entry.id)}">HATCH ↗</button><button class="archive-delete" data-action="archive-delete" data-archive-id="${esc(entry.id)}" aria-label="Delete ${esc(entry.name)}">×</button></div></article>`
  }).join('')
  showModal(`<button class="modal-close" data-action="close" aria-label="Close DNA archive">×</button><div class="eyebrow">GENOME VAULT · ${game.archives.length} STORED</div><h2>DNA archive</h2><p>Preserve a creature’s genome, edit individual alleles, or hatch a new creature from any archived sequence.</p><div class="archive-list">${items || '<div class="archive-empty">No genomes archived yet. Save your selected creature to begin a lineage library.</div>'}</div><div class="modal-actions archive-modal-actions"><button class="secondary-btn" data-action="close">CLOSE</button><button class="primary-btn" data-action="archive-save-dialog">＋ ARCHIVE SELECTED DNA</button></div>`)
}
function archiveSaveDialog() {
  const c = selected()
  showModal(`<button class="modal-close" data-action="archives">×</button><div class="eyebrow">GENOME VAULT · NEW RECORD</div><h2>Preserve this genome</h2><p>A copy of ${esc(c.name)}’s DNA will be stored independently, so edits to the archive will not alter the living creature.</p><label class="field-label">ARCHIVE NAME<input id="archive-name" maxlength="28" value="${esc(c.name + ' DNA')}"></label><div class="modal-actions"><button class="secondary-btn" data-action="archives">BACK</button><button class="primary-btn" data-action="archive-save">SAVE TO ARCHIVE</button></div>`)
  $('#archive-name').focus(); $('#archive-name').select()
}
function saveArchive() {
  const c = selected(), name = $('#archive-name')?.value.trim()
  if (!name) return toast('Give this archive record a name.')
  const entry = { id: cryptoId(), name, sourceName: c.name, sourceId: c.id, generation: c.generation || 0, genome: copyGenome(c.genome), savedAt: Date.now() }
  game.archives.unshift(entry)
  awardXP(15, 'archive', `archive:${entry.id}`)
  persist(); archivesDialog(); toast(`${name} saved to the DNA archive. +15 XP.`)
}
function editArchive(id) {
  const entry = game.archives.find(item => item.id === id)
  if (!entry) return archivesDialog()
  const groups = { frame:'FRAME', limb:'LIMBS', weapon:'ADAPTATIONS', adapt:'ANIMAL ADAPTATIONS', core:'CORE', form:'BODY PLAN', coat:'PIGMENT' }
  const rows = Object.entries(groups).map(([group, label]) => `<section class="archive-gene-group"><h3>${label}</h3>${GENES.filter(g => g.group === group).map(g => {
    const [a, b] = entry.genome?.[g.key] || [0.5, 0.5]
    return `<div class="archive-gene-row"><label>${esc(g.label)}</label><div class="allele-control"><small>A</small><input aria-label="${esc(g.label)} allele A" type="range" min="0" max="1" step="0.01" value="${Number(a)}" data-gene="${g.key}" data-allele="0"><output>${Math.round(a * 100)}%</output></div><div class="allele-control"><small>B</small><input aria-label="${esc(g.label)} allele B" type="range" min="0" max="1" step="0.01" value="${Number(b)}" data-gene="${g.key}" data-allele="1"><output>${Math.round(b * 100)}%</output></div></div>`
  }).join('')}</section>`).join('')
  const p = phenotype(entry.genome)
  const contracts = DNA_CONTRACTS.map(contract => {
    const progress = contractProgress(contract, entry.genome)
    const claimed = (entry.claimedContracts || []).includes(contract.id)
    return `<article class="dna-contract ${progress.complete ? 'complete' : ''} ${claimed ? 'claimed' : ''}" data-contract="${contract.id}"><span class="contract-icon">${contract.icon}</span><div class="contract-copy"><b>${contract.name}</b><small>${contract.note}</small><div class="contract-meter"><i style="width:${progress.percent}%"></i></div></div><strong>${claimed ? '✓ CLAIMED' : progress.complete ? '+12 ✧' : `${progress.percent}%`}</strong></article>`
  }).join('')
  showModal(`<button class="modal-close" data-action="archives" aria-label="Back to archive">×</button><div class="eyebrow">GENOME FORGE · DESIGN A LINEAGE</div><h2>Engineer archived DNA</h2><label class="field-label">RECORD NAME<input id="archive-edit-name" maxlength="28" value="${esc(entry.name)}"></label><div class="forge-preview"><i id="forge-swatch" style="--creature-color:${p.bodyColor};--creature-accent:${p.accentColor}"></i><div><b id="forge-species">${esc(p.speciesType)} · ${esc(p.bodyPlanName)}</b><small>Live phenotype preview · edits stay in this archive</small></div><span id="forge-sequence">${dnaSequence(entry.genome).slice(0,10)}…</span></div><section class="contract-board"><div class="forge-section-title"><span>RESEARCH CONTRACTS</span><small>COMPLETE & SAVE · +12 ✧ EACH</small></div>${contracts}</section><p class="forge-instructions">Tune paired alleles to complete contracts, then save your design. Each contract pays once per archive record.</p><div class="archive-editor-scroll">${rows}</div><div class="modal-actions"><button class="secondary-btn" data-action="archives">CANCEL</button><button class="primary-btn" data-action="archive-update" data-archive-id="${esc(entry.id)}">SAVE DNA DESIGN ↗</button></div>`)
}
function contractProgress(contract, genome) {
  const ratios = contract.goals.map(([key, target]) => Math.min(1, ((genome?.[key] || [0.5, 0.5]).reduce((sum, allele) => sum + Number(allele || 0), 0) / 2) / target))
  const percent = Math.round(ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length * 100)
  return { percent, complete: ratios.every(ratio => ratio >= 1) }
}
function draftArchiveGenome() {
  const genome = {}
  GENES.forEach(g => { genome[g.key] = [0.5, 0.5] })
  document.querySelectorAll('#modal [data-gene][data-allele]').forEach(input => { genome[input.dataset.gene][Number(input.dataset.allele)] = Number(input.value) })
  return genome
}
function refreshForgePreview() {
  const genome = draftArchiveGenome(), p = phenotype(genome)
  const swatch = $('#forge-swatch')
  if (swatch) { swatch.style.setProperty('--creature-color', p.bodyColor); swatch.style.setProperty('--creature-accent', p.accentColor) }
  const species = $('#forge-species')
  if (species) species.textContent = `${p.speciesType} · ${p.bodyPlanName}`
  const sequence = $('#forge-sequence')
  if (sequence) sequence.textContent = `${dnaSequence(genome).slice(0, 10)}…`
  DNA_CONTRACTS.forEach(contract => {
    const card = $(`[data-contract="${contract.id}"]`)
    if (!card) return
    const progress = contractProgress(contract, genome), claimed = card.classList.contains('claimed')
    card.classList.toggle('complete', progress.complete)
    card.querySelector('.contract-meter i').style.width = `${progress.percent}%`
    card.querySelector('strong').textContent = claimed ? '✓ CLAIMED' : progress.complete ? '+12 ✧' : `${progress.percent}%`
  })
}
function updateArchive(id) {
  const entry = game.archives.find(item => item.id === id)
  if (!entry) return archivesDialog()
  const name = $('#archive-edit-name')?.value.trim()
  if (!name) return toast('Give this archive record a name.')
  const genome = copyGenome(draftArchiveGenome())
  const rewards = DNA_CONTRACTS.filter(contract => !(entry.claimedContracts || []).includes(contract.id) && contractProgress(contract, genome).complete)
  entry.claimedContracts ||= []
  entry.claimedContracts.push(...rewards.map(contract => contract.id))
  entry.name = name; entry.genome = genome; entry.editedAt = Date.now()
  game.coins += rewards.length * 12
  rewards.forEach(contract => awardXP(20, 'DNA contract', `contract:${entry.id}:${contract.id}`))
  persist(); archivesDialog()
  toast(rewards.length ? `${rewards.length} DNA contract${rewards.length === 1 ? '' : 's'} completed! +${rewards.length * 12} shards and +${rewards.length * 20} XP.` : `${name} design saved.`)
}
function createFromArchiveDialog(id) {
  if(mode==='arena')return toast('Return to the Hollow before hatching a creature.')
  const entry = game.archives.find(item => item.id === id)
  if (!entry) return archivesDialog()
  const p = phenotype(entry.genome)
  showModal(`<button class="modal-close" data-action="archives">×</button><div class="eyebrow">GENOME VAULT · SEQUENCE HATCH</div><h2>Create from archived DNA</h2><p>This creates a new, independent creature with the exact archived genome. The archived record remains unchanged.</p><div class="parent-preview"><div class="parent-chip"><i style="--creature-color:${p.bodyColor}"></i><span><b>${esc(entry.name)}</b><small>${esc(p.speciesType.toUpperCase())} · ARCHIVED DNA</small></span></div></div><label class="field-label">NEW CREATURE NAME<input id="archive-creature-name" maxlength="20" value="${esc(makeName(entry.genome))}"></label><div class="modal-actions"><button class="secondary-btn" data-action="archives">CANCEL</button><button class="primary-btn" data-action="archive-create-confirm" data-archive-id="${esc(entry.id)}">HATCH CREATURE ↗</button></div>`)
  $('#archive-creature-name').focus(); $('#archive-creature-name').select()
}
function createFromArchive(id) {
  if(mode==='arena')return toast('Return to the Hollow before hatching a creature.')
  const entry = game.archives.find(item => item.id === id)
  const name = $('#archive-creature-name')?.value.trim()
  if (!entry) return archivesDialog()
  if (!name) return toast('A creature name cannot be empty.')
  const creature = { id: cryptoId(), name, genome: copyGenome(entry.genome), sex: sexOf(), needs: freshNeeds(92), wins: 0, battles: 0, born: Date.now(), generation: entry.generation || 0, archivedFrom: entry.id }
  game.creatures.push(creature); game.selected = creature.id; closeModal()
  if (mode === 'habitat') { world.addCreature(creature, { position: [(Math.random() - .5) * 5, 0, (Math.random() - .5) * 5] }); world.setSelected(creature.id) }
  const earnedXP = awardXP(10, 'archive hatch', `hatch:${entry.id}`)
  persist(); renderRoster(); renderProfile(); toast(`${creature.name} hatched from archived DNA.${earnedXP ? ' +10 XP.' : ''}`)
}
function deleteArchive(id) {
  const index = game.archives.findIndex(item => item.id === id)
  if (index < 0) return archivesDialog()
  const [removed] = game.archives.splice(index, 1)
  persist(); archivesDialog(); toast(`${removed.name} removed from the archive.`)
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
  const pairKey = `breed:${[parent.id, mate.id].sort().join(':')}`
  const earnedXP = awardXP(25, 'breeding', pairKey)
  persist(); renderRoster(); renderProfile(); toast(`${child.name} hatched with ${mutations.length} mutated gene${mutations.length===1?'':'s'}!${earnedXP ? ' +25 XP.' : ''}`)
}
function renameDialog() {
  const c=selected(); showModal(`<button class="modal-close" data-action="close">×</button><div class="eyebrow">CREATURE DOSSIER</div><h2>Rename specimen</h2><label class="field-label">SPECIMEN NAME<input id="rename-input" maxlength="20" value="${esc(c.name)}"></label><div class="modal-actions"><button class="secondary-btn" data-action="close">CANCEL</button><button class="primary-btn" data-action="rename-confirm">SAVE NAME</button></div>`)
  $('#rename-input').focus(); $('#rename-input').select()
}
function rename() { const input=$('#rename-input'), name=input?.value.trim(); if(!name)return toast('A name cannot be empty.'); selected().name=name; closeModal(); renderRoster(); renderProfile(); persist(); toast('Specimen renamed.') }
function releaseDialog() {
  if (mode === 'arena') return toast('Return to the habitat before releasing a creature.')
  if (game.creatures.length <= 1) return toast('Your last creature must remain in the sanctuary.')
  const c = selected()
  if (!c) return
  releaseTargetId = c.id
  showModal(`<button class="modal-close" data-action="close" aria-label="Cancel release">×</button><div class="eyebrow">SANCTUARY · RELEASE SPECIMEN</div><h2>Release ${esc(c.name)}?</h2><p>This creature will leave your sanctuary permanently. This cannot be undone.</p><div class="modal-actions"><button class="secondary-btn" data-action="close">KEEP CREATURE</button><button class="release-confirm-btn" data-action="release-confirm">RELEASE CREATURE</button></div>`)
}
function releaseCreature() {
  if (mode === 'arena') return toast('Return to the habitat before releasing a creature.')
  if (game.creatures.length <= 1) { closeModal(); releaseTargetId = null; return toast('Your last creature must remain in the sanctuary.') }
  const index = game.creatures.findIndex(c => c.id === releaseTargetId)
  if (index < 0) { closeModal(); releaseTargetId = null; return }
  const [creature] = game.creatures.splice(index, 1)
  dropPortrait(creature.id)
  world.removeCreature(creature.id)
  if (game.selected === creature.id) game.selected = game.creatures[index % game.creatures.length].id
  releaseTargetId = null
  world.setSelected(game.selected)
  closeModal()
  renderRoster()
  renderProfile()
  persist()
  toast(`${creature.name} has been released from the sanctuary.`)
}
function arenaDialog() {
  const player=selected(), foes=game.creatures.filter(c=>c.id!==player.id)
  const foe=[...foes].sort((a,b)=>Math.abs(statsOf(a).power-statsOf(player).power)-Math.abs(statsOf(b).power-statsOf(player).power))[0]
  showModal(`<button class="modal-close" data-action="close" aria-label="Close">×</button><div class="eyebrow">THE CRUCIBLE · BATTLE GATE</div><h2>Choose your challenge</h2><p>Your selected creature enters turn-based combat. Abilities and stamina are shaped by its DNA.</p><section class="road-card"><div class="eyebrow">ENDLESS ROAD · LEVEL ${game.roadLevel}${game.roadLevel%10===0?' · BOSS':''}</div><b>One wild genome. Every level.</b><p>Face a totally random creature, with tougher opponents each level and an Apex boss every tenth level. Progress is saved.</p><button class="primary-btn" data-action="road-start">${game.roadLevel%10===0?'FACE THE BOSS':'START LEVEL '+game.roadLevel} ↗</button></section><div class="friendly-gate"><div class="eyebrow">FRIENDLY MATCH</div>${foe?`<div class="fight-preview"><div class="fight-side"><i style="--creature-color:${phenotype(player.genome).bodyColor}"></i><b>${esc(player.name)}</b><small>POWER ${statsOf(player).power}</small></div><span>VS</span><select id="foe-select">${foes.map(c=>`<option value="${esc(c.id)}" ${c.id===foe.id?'selected':''}>${esc(c.name)} · POW ${statsOf(c).power}</option>`).join('')}</select></div><button class="secondary-btn" data-action="battle-start">BEGIN FRIENDLY BOUT</button>`:`<p>Discover another creature to unlock friendly matches.</p>`}</div>`)
}
function startBattle(roadLevel=null, carry=null) {
  const player=selected()
  const foe=roadLevel==null?game.creatures.find(c=>c.id===$('#foe-select')?.value):generateWild()
  if(!foe)return closeModal()
  const boss=roadLevel!=null&&roadLevel%10===0
  if(boss)foe.name=`Apex ${foe.name}`
  closeModal(); mode='arena'; tab='overview'
  const maxHp={player:maxHpOf(player),foe:maxHpOf(foe)}, maxSta={player:maxStaminaOf(player),foe:maxStaminaOf(foe)}
  const enemyHpScale=roadLevel==null?1:1+(roadLevel-1)*0.035+(boss?0.55:0)
  battle={player,foe,challenge:roadLevel==null?null:{level:roadLevel,boss},hp:{player:maxHp.player,foe:Math.round(maxHp.foe*enemyHpScale)},maxHp:{...maxHp,foe:Math.round(maxHp.foe*enemyHpScale)},sta:{player:maxSta.player,foe:maxSta.foe},maxSta,guard:{player:false,foe:false},status:{player:{staggered:false,accuracyDown:false},foe:{staggered:false,accuracyDown:false}},busy:false,turn:1}
  if(carry){battle.hp.player=Math.min(maxHp.player,carry.hp+Math.round(maxHp.player*0.28));battle.sta.player=Math.min(maxSta.player,carry.sta+Math.round(maxSta.player*0.45))}
  world.enterArena(player,foe); updateModeUI(); renderProfile(); renderBattle()
}
function renderStageTag() {
  if (mode !== 'habitat') return
  const el = $('#scene-tag-text')
  if (!currentBiome) { el.textContent = 'ECOSYSTEM ACTIVE'; return }
  el.textContent = `${currentBiome.icon} ${currentBiome.label.toUpperCase()} · ${currentBiome.resources.join(' · ')}`
}

function updateModeUI() {
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode))
  $('#stage-title').textContent=mode==='arena'?(battle?.challenge?`Endless Road · Level ${battle.challenge.level}`:'The Crucible'):'The Verdant Hollow'
  $('#stage-kicker').textContent=mode==='arena'?(battle?.challenge?(battle.challenge.boss?'☠ APEX BOSS':'⚔ ENDLESS CHALLENGE'):'⚔ COMBAT ARENA'):'◌ OPEN HABITAT'
  $('#scene-tag-text').textContent=mode==='arena'?(battle?.challenge?(battle.challenge.boss?'BOSS ENCOUNTER':'ROAD CHALLENGE'):'BATTLE IN PROGRESS'):(currentBiome?`${currentBiome.icon} ${currentBiome.label.toUpperCase()} · ${currentBiome.resources.join(' · ')}`:'ECOSYSTEM ACTIVE')
  $('.creature-count').style.display=mode==='arena'?'none':''
  $('[data-action="arena"]').innerHTML=mode==='arena'?'↩ RETURN TO HOLLOW <b>↗</b>':'⚔ ENTER ARENA <b>↗</b>'
  $('[data-action="breed"]').disabled=mode==='arena'
  renderRoster()
}
function renderBattle() {
  const hud=$('#battle-hud'), result=$('#battle-result')
  if(!battle) { hud.classList.add('hidden'); result.classList.add('hidden'); return }
  hud.classList.remove('hidden')
  const bar=(who,label)=>{const effects=[battle.status[who].staggered?'STAGGERED':'',battle.status[who].accuracyDown?'OFF-BALANCE':''].filter(Boolean);return `<div class="fighter-hud ${who}"><div class="fighter-label"><b>${esc(battle[who].name)}</b><span>${label}</span></div>${effects.length?`<small class="battle-effects">${effects.join(' · ')}</small>`:''}<div class="fight-meter hp"><i style="width:${battle.hp[who]/battle.maxHp[who]*100}%"></i></div><small>HP ${battle.hp[who]} / ${battle.maxHp[who]}</small><div class="fight-meter stamina"><i style="width:${battle.sta[who]/battle.maxSta[who]*100}%"></i></div><small>STA ${battle.sta[who]} / ${battle.maxSta[who]}</small></div>`}
  const center=battle.challenge?`LEVEL ${battle.challenge.level}${battle.challenge.boss?' · BOSS':''}<small>${battle.busy?'ACTION IN PROGRESS':'ROUND '+battle.turn}</small>`:`ROUND ${battle.turn}<small>${battle.busy?'ACTION IN PROGRESS':'CHOOSE AN ABILITY'}</small>`
  hud.innerHTML=`${bar('player','YOUR CREATURE')}<div class="battle-turn">${center}</div>${bar('foe',battle.challenge?(battle.challenge.boss?'APEX BOSS':'WILD CHALLENGER'):'OPPONENT')}`
  if(battle.finished) {
    result.classList.remove('hidden')
    const road=battle.challenge, won=battle.winner==='player'
    const heading=road?(won?`Level ${road.level} cleared${road.boss?' · boss defeated':''}`:`Run ended at level ${road.level}`):(won?'wins the bout':'takes the round')
    const buttons=road?`${won?'<button class="primary-btn" data-action="road-next">NEXT LEVEL ↗</button>':'<button class="primary-btn" data-action="road-retry">RETRY LEVEL ↻</button>'}<button class="secondary-btn" data-action="battle-exit">RETURN TO HOLLOW</button>`:'<button class="primary-btn" data-action="battle-exit">RETURN TO HOLLOW</button>'
    result.innerHTML=`<div class="result-stamp">${won?'VICTORY':'DEFEAT'}</div><b>${esc(road?heading:`${won?battle.player.name:battle.foe.name} ${heading}`)}</b><div class="result-actions">${buttons}</div>`
  } else result.classList.add('hidden')
  renderProfile()
}
function applyMove(attacker, defender, move, done) {
  if(!battle||battle.finished)return
  const status=battle.status[attacker]
  if(status.staggered) {
    status.staggered=false
    battle.guard[attacker]=false
    battle.sta[attacker]=Math.min(battle.maxSta[attacker],battle.sta[attacker]+8)
    toast(`${battle[attacker].name} is staggered and loses the turn.`)
    done(); return
  }
  if(move.type==='defend') {
    battle.guard[attacker]=true; battle.sta[attacker]=Math.min(battle.maxSta[attacker],battle.sta[attacker]+Math.abs(move.cost));
    toast(`${battle[attacker].name} braces and recovers stamina.`); done(); return
  }
  const cost=Math.max(0,move.cost)
  if(battle.sta[attacker]<cost) { battle.sta[attacker]=Math.min(battle.maxSta[attacker],battle.sta[attacker]+12); toast(`${battle[attacker].name} is winded and recovers 12 stamina.`); done(); return }
  battle.sta[attacker]-=cost
  const accuracy=Math.max(0.1,move.acc-(status.accuracyDown?0.25:0))
  status.accuracyDown=false
  if(Math.random()>accuracy) { toast(`${move.name} missed!`); done(); return }
  const roadScale=attacker==='foe'&&battle.challenge?(1+(battle.challenge.level-1)*0.022+(battle.challenge.boss?0.28:0)):1
  let damage=Math.round((10+move.power*16)*(0.78+statsOf(battle[attacker]).power/180)*(0.82+Math.random()*.36)*roadScale)
  if(move.crit&&Math.random()<move.crit)damage=Math.round(damage*1.5)
  if(battle.guard[defender]){if(!move.pierce){damage=Math.ceil(damage*.48);toast(`${battle[defender].name} guarded the hit!`)}battle.guard[defender]=false}
  battle.hp[defender]=Math.max(0,battle.hp[defender]-damage)
  const landedEffects=[]
  if(move.stagger&&Math.random()<move.stagger){battle.status[defender].staggered=true;landedEffects.push('staggered')}
  if(move.debuff==='acc'){battle.status[defender].accuracyDown=true;landedEffects.push('off-balance')}
  const defenderSide=attacker==='player'?'foe':'player'
  world.battleLunge(attacker,()=>world.hitReact(defenderSide,done))
  world.burst?.({x:attacker==='player'?2: -2,y:1.5,z:.3},phenotype(battle[attacker].genome).accentColor,15)
  toast(`${move.name} dealt ${damage} damage${landedEffects.length?` and left ${battle[defender].name} ${landedEffects.join(' and ')}.`:'.'}`)
  if(move.buff==='evade')battle.guard[attacker]=true
}
function playerTurn(moveId) {
  if(!battle||battle.busy||battle.finished)return
  const move=movesFor(battle.player).find(m=>m.id===moveId); if(!move)return
  battle.busy=true; renderBattle()
  applyMove('player','foe',move,()=>{
    if(!battle||battle.finished)return
    if(battle.hp.foe<=0)return finishBattle('player')
    setTimeout(enemyTurn,650)
  })
}
function enemyTurn() {
  if(!battle||battle.finished)return
  const choices=movesFor(battle.foe).filter(m=>m.type==='strike'&&battle.sta.foe>=m.cost)
  const move=choices[Math.floor(Math.random()*choices.length)]||movesFor(battle.foe).find(m=>m.type==='defend')
  battle.turn++; applyMove('foe','player',move,()=>{
    if(!battle||battle.finished)return
    if(battle.hp.player<=0)return finishBattle('foe')
    battle.busy=false; renderBattle()
  })
}
function finishBattle(winner) {
  battle.finished=true; battle.winner=winner; battle.busy=false
  world.faint(winner==='player'?'foe':'player')
  battle.player.battles=(battle.player.battles||0)+1; battle.foe.battles=(battle.foe.battles||0)+1
  if(winner==='player'){battle.player.wins=(battle.player.wins||0)+1;game.wins++;game.coins+=battle.challenge?35+Math.min(100,battle.challenge.level*2):25;awardXP(battle.challenge?45+Math.min(200,battle.challenge.level*5):35, 'arena victory');if(battle.challenge)game.roadLevel=battle.challenge.level+1
    const foe=battle.foe
    const entry={id:cryptoId(),name:`${foe.name} DNA`,sourceName:foe.name,sourceId:foe.id,source:'battle',generation:foe.generation||0,genome:copyGenome(foe.genome),savedAt:Date.now()}
    game.archives.unshift(entry)
    awardXP(15,'archive',`archive:${entry.id}`)
    toast(battle.challenge?`Road victory! ${foe.name}'s DNA archived.`: `Victory! ${foe.name}'s DNA archived. +25 shards and +35 XP.`)
  }else toast(`${battle.foe.name} wins this round. Your creature will be ready for another bout.`)
  persist(); renderBattle(); renderRoster()
}
function exitBattle() { if(battle?.busy&&!battle.finished)return toast('Wait for the current battle animation to finish.'); battle=null; world.exitArena(); mode='habitat'; updateModeUI(); populateWorld(); renderBattle(); renderProfile() }
function advanceRoad(retry=false) {
  if(!battle?.challenge||!battle.finished||battle.winner!=='player'&&!retry)return
  const previous=battle, level=retry?previous.challenge.level:previous.challenge.level+1
  if(!retry){game.roadLevel=level;persist()}
  startBattle(level,{hp:previous.hp.player,sta:previous.sta.player})
}
function dispatch(action, id) {
  if(action==='close')closeModal()
  else if(action==='discover')discover()
  else if(action==='discover-confirm')discoverConfirm()
  else if(action==='archives')archivesDialog()
  else if(action==='archive-save-dialog')archiveSaveDialog()
  else if(action==='archive-save')saveArchive()
  else if(action==='archive-edit')editArchive(id)
  else if(action==='archive-update')updateArchive(id)
  else if(action==='archive-create')createFromArchiveDialog(id)
  else if(action==='archive-create-confirm')createFromArchive(id)
  else if(action==='archive-delete')deleteArchive(id)
  else if(action==='breed')breedDialog()
  else if(action==='breed-confirm')breed()
  else if(action==='rename')renameDialog()
  else if(action==='rename-confirm')rename()
  else if(action==='release')releaseDialog()
  else if(action==='release-confirm')releaseCreature()
  else if(action==='arena')mode==='arena'?exitBattle():arenaDialog()
  else if(action==='battle-start')startBattle()
  else if(action==='road-start')startBattle(game.roadLevel)
  else if(action==='road-next')advanceRoad()
  else if(action==='road-retry')advanceRoad(true)
  else if(action==='battle-exit')exitBattle()
  else if(action==='guide')guideDialog()
  else if(action==='player-profile')playerDialog()
  else if(action==='sanctuary'){window.scrollTo({top:0,behavior:'smooth'});toast('Sanctuary roster is ready.')}
  else if(action==='habitat'){if(mode==='arena')exitBattle();else toast('You are in the Verdant Hollow.')}
  else if(action==='profile'){document.querySelector('.right-panel').scrollIntoView({behavior:'smooth',block:'start'})}
}
document.addEventListener('input', e => {
  const slider = e.target.closest('#modal input[type="range"][data-gene][data-allele]')
  if (!slider) return
  const output = slider.parentElement.querySelector('output')
  if (output) output.textContent = `${Math.round(Number(slider.value) * 100)}%`
  refreshForgePreview()
})
document.addEventListener('change',e=>{
  const input=e.target.closest('input[name="adaptation"]')
  if(!input)return
  const card=input.closest('.adapt-card')
  const checked=[...document.querySelectorAll('input[name="adaptation"]:checked')]
  if(checked.length>3){input.checked=false;card?.classList.remove('selected');toast('Choose up to three adaptations.')}
  card?.classList.toggle('selected', input.checked)
  const n=document.querySelectorAll('#modal input[name="adaptation"]:checked').length
  $('#adapt-count').textContent=`${n} / 3 chosen`
  const confirm=$('#modal [data-action="discover-confirm"]')
  if(confirm)confirm.disabled=n===0
})
document.addEventListener('click',e=>{
  const nav = e.target.closest('[data-nav],[data-zoom]')
  if (nav) {
    const zoom = nav.dataset.zoom
    if (zoom) world.zoomBy(zoom === 'in' ? 1.5 : -1.5)
    else {
      const move = nav.dataset.nav
      if (move === 'reset') world.resetView()
      else {
        const v = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] }[move] || [0, 0]
        world.panBy(v[0], v[1])
      }
    }
    return
  }
  const actionTarget=e.target.closest('[data-action]')
  const action=actionTarget?.dataset.action
  if(action){dispatch(action,actionTarget.dataset.archiveId);return}
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
