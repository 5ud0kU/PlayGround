// ─── HELIX FORGE · genome, phenotype & inheritance ──────────────────────────
// Every creature carries paired alleles. Expressed form and stats are derived
// from the whole genome, so breeding two creatures reshapes body AND behaviour.

export const GENES = [
  { key: 'size',      label: 'Stature',        group: 'frame',  desc: 'Overall body mass' },
  { key: 'length',    label: 'Torso Length',   group: 'frame',  desc: 'Spine elongation' },
  { key: 'girth',     label: 'Torso Girth',    group: 'frame',  desc: 'Ribcage volume' },
  { key: 'neck',      label: 'Neck',           group: 'frame',  desc: 'Cervical reach' },
  { key: 'head',      label: 'Cranium',        group: 'frame',  desc: 'Skull size' },
  { key: 'snout',     label: 'Jaw Reach',      group: 'frame',  desc: 'Bite projection' },
  { key: 'legs',      label: 'Limb Length',    group: 'limb',   desc: 'Stride length' },
  { key: 'stance',    label: 'Limb Build',     group: 'limb',   desc: 'Bone thickness' },
  { key: 'horns',     label: 'Cranial Horns',  group: 'weapon', desc: 'Gore potential' },
  { key: 'tail',      label: 'Caudal Tail',    group: 'weapon', desc: 'Balance & sweep' },
  { key: 'armor',     label: 'Dermal Plates',  group: 'weapon', desc: 'Spine spikes & scutes' },
  { key: 'wings',     label: 'Wing Membrane',  group: 'weapon', desc: 'Glide & gust' },
  { key: 'antlers',   label: 'Branching Antlers', group: 'adapt', desc: 'Crown of branching bone' },
  { key: 'fins',      label: 'Dorsal Fins',      group: 'adapt', desc: 'Streamlined fin sails' },
  { key: 'gills',     label: 'Gill Fans',        group: 'adapt', desc: 'Frilled aquatic breathing organs' },
  { key: 'antennae',  label: 'Antennae',         group: 'adapt', desc: 'Sensitive insect feelers' },
  { key: 'carapace',  label: 'Carapace',         group: 'adapt', desc: 'Armored beetle shell' },
  { key: 'pincers',   label: 'Pincers',          group: 'adapt', desc: 'Paired grasping claws' },
  { key: 'tusks',     label: 'Tusks',            group: 'weapon', desc: 'Protruding gore teeth' },
  { key: 'mane',      label: 'Neck Mane',        group: 'adapt',  desc: 'Furred crest along the neck and back' },
  { key: 'muscle',    label: 'Myofiber',       group: 'core',   desc: 'Raw contractile power' },
  { key: 'bone',      label: 'Bone Density',   group: 'core',   desc: 'Impact absorption' },
  { key: 'speed',     label: 'Fast Twitch',    group: 'core',   desc: 'Reaction & footspeed' },
  { key: 'brain',     label: 'Neural Mass',    group: 'core',   desc: 'Tactics & learning' },
  { key: 'metabolism',label: 'Metabolism',     group: 'core',   desc: 'Appetite & recovery' },
  { key: 'eyes',      label: 'Photoreceptors', group: 'core',   desc: 'Accuracy & threat read' },
  { key: 'posture',   label: 'Stance',         group: 'form',   desc: 'Four-legged to upright posture' },
  { key: 'bodyPlan',  label: 'Body Type',      group: 'form',   desc: 'Fish, insect, bird, quadruped, or biped anatomy' },
  { key: 'archetype', label: 'Species Type',   group: 'form',   desc: 'Distinct body and facial structure' },

  { key: 'hueA',      label: 'Pigment A',      group: 'coat',   desc: 'Primary chromatophore' },
  { key: 'hueB',      label: 'Pigment B',      group: 'coat',   desc: 'Secondary chromatophore' },
  { key: 'pattern',   label: 'Dermal Pattern', group: 'coat',   desc: 'Spots, stripes, rosettes, mottling' },
  { key: 'hide',      label: 'Skin Type',      group: 'coat',   desc: 'Fur, scales, hide or crystalline sheen' },
  { key: 'biolum',    label: 'Bioluminescence', group: 'coat',   desc: 'Glowing body markings' },
]

export const GENE_MAP = Object.fromEntries(GENES.map(g => [g.key, g]))

export const BODY_PLANS = [
  { key: 'fish', label: 'Fish', icon: '≋', source: 'Reef · river', note: 'Streamlined swimmer with fins and gills' },
  { key: 'insect', label: 'Insect', icon: '⌘', source: 'Beetle · moth', note: 'Six-legged frame with shell and feelers' },
  { key: 'bird', label: 'Bird', icon: '⌁', source: 'Raptor · songbird', note: 'Feathered wings, beak, and two legs' },
  { key: 'quadruped', label: 'Quadruped', icon: '♧', source: 'Stag · wolf', note: 'Grounded four-legged body plan' },
  { key: 'biped', label: 'Biped', icon: '♙', source: 'Primate · drake', note: 'Upright stance with grasping forelimbs' },
]

// Thirty sculptural families, each with ten DNA-selected variants, provide a
// stable catalog of 300 heritable forms without adding artificial alleles.
const MORPHOLOGY_FAMILIES = [
  'Longstride', 'Bulwark', 'Spindle', 'Crownback', 'Sailcrest',
  'Barrel', 'Thornhide', 'Highneck', 'Paddletail', 'Ridgeback',
  'Razorfin', 'Boulderback', 'Longjaw', 'Burrower', 'Spirespine',
  'Fantail', 'Paddlelimb', 'Coilback', 'Lanterncrest', 'Crownshield',
  'Glimmermoss', 'Ironjaw', 'Veilwing', 'Duskstrider', 'Crestfall',
  'Stoneback', 'Firespine', 'Dewclaw', 'Mistmantle', 'Brightshell',
]
const MORPHOLOGY_KEYS = ['size', 'length', 'girth', 'neck', 'head', 'snout', 'legs', 'stance', 'tail', 'armor', 'wings', 'posture', 'bodyPlan', 'archetype']

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const clamp01 = v => clamp(v)
export const lerp = (a, b, t) => a + (b - a) * t
export const mix = (a, b, t) => Math.round(a + (b - a) * t)

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rnd = (min, max) => min + Math.random() * (max - min)

// ─── genome creation ───────────────────────────────────────────────────────
export function randomGenome(seed, bias = {}) {
  const r = seed == null ? Math.random : mulberry32(seed)
  const genome = {}
  for (const gene of GENES) {
    const b = bias[gene.key] ?? 0.5
    const spread = bias[gene.key + '_spread'] ?? 0.34
    const center = clamp(b + (r() - 0.5) * spread, 0.06, 0.96)
    const alleleA = clamp(center + (r() - 0.5) * 0.3, 0.02, 0.98)
    const alleleB = clamp(center + (r() - 0.5) * 0.3, 0.02, 0.98)
    // Wild finds span the full trait range; bred lineages remain centered on parents.
    if (bias._wild) {
      genome[gene.key] = [r(), r()]
    // Hue genes are stored as full-range values, not centred on 0.5
    } else if (gene.key === 'hueA' || gene.key === 'hueB') {
      genome[gene.key] = bias[gene.key] != null
        ? [clamp(b + (r() - 0.5) * 0.18), clamp(b + (r() - 0.5) * 0.18)]
        : [r(), r()]
    } else {
      genome[gene.key] = [alleleA, alleleB]
    }
  }
  return genome
}

// Phenotype: average expression; a few genes skew dominant to create variety.
export function phenotype(genome) {
  const p = {}
  for (const gene of GENES) {
    // Older local saves predate newer appearance genes; keep them playable.
    const [a = 0.5, b = 0.5] = genome[gene.key] || []
    p[gene.key] = (a + b) / 2
  }
  // Quantized expressed physical genes make morphology reproducible and
  // heritable while allowing allele edits and breeding to reshuffle the form.
  let morphologyHash = 2166136261
  for (const key of MORPHOLOGY_KEYS) {
    morphologyHash ^= Math.round(clamp(p[key]) * 255)
    morphologyHash = Math.imul(morphologyHash, 16777619)
  }
  const morphologyIndex = (morphologyHash >>> 0) % 300
  // Derived composite values used by the mesh builder.
  const size = p.size
  p.height = 0.72 + size * 0.62 + p.legs * 0.18
  p.huePrimary = Math.round(lerp(0, 360, p.hueA))
  p.hueAccent = Math.round(lerp(0, 360, p.hueB))
  p.sat = Math.round(38 + p.pattern * 34 + p.muscle * 10)
  p.lightness = Math.round(52 - p.bone * 12 + p.eyes * 4)
  p.bodyColor = `hsl(${p.huePrimary} ${p.sat}% ${p.lightness}%)`
  p.accentColor = `hsl(${p.hueAccent} ${Math.min(92, p.sat + 18)}% ${58 + p.eyes * 8}%)`
  p.darkColor = `hsl(${p.huePrimary - 12} ${p.sat + 6}% ${Math.max(18, p.lightness - 26)}%)`
  p.eyeColor = `hsl(${(p.hueAccent + 38) % 360} 100% ${62 + p.brain * 10}%)`
  p.speciesType = ['Drake', 'Mireling', 'Skykin', 'Goliath'][Math.min(3, Math.floor(p.archetype * 4))]
  p.skinType = ['Velvet hide', 'Scaled hide', 'Plated hide', 'Crystal hide'][Math.min(3, Math.floor(p.hide * 4))]
  p.postureName = p.posture > 0.58 ? 'Upright' : 'Grounded'
  const bodyPlanIndex = Math.min(BODY_PLANS.length - 1, Math.floor(p.bodyPlan * BODY_PLANS.length))
  p.bodyPlanKey = BODY_PLANS[bodyPlanIndex].key
  p.bodyPlanName = BODY_PLANS[bodyPlanIndex].label
  p.morphologyIndex = morphologyIndex
  p.morphologyFamily = Math.floor(morphologyIndex / 10)
  p.morphologyVariant = morphologyIndex % 10
  p.morphologyName = `${MORPHOLOGY_FAMILIES[p.morphologyFamily]} ${String(p.morphologyVariant + 1).padStart(2, '0')}`
  p.skinRoughness = 0.9 - p.hide * 0.62
  p.horniness = p.horns
  p.limbCount = { fish: 0, insect: 6, bird: 2, quadruped: 4, biped: 2 }[p.bodyPlanKey]
  p.tuskSize = clamp(p.tusks)
  p.maneSize = clamp(p.mane)
  p.biolum = clamp(p.biolum)
  p.glowColor = `hsl(${(p.hueAccent + 90) % 360} 90% ${50 + p.brain * 20}%)`
  return p
}

// ─── stats ─────────────────────────────────────────────────────────────────
export const STAT_KEYS = ['power', 'bones', 'mobility', 'muscle', 'brain', 'condition']
export const STAT_META = {
  power:    { label: 'Ability',  color: '#d8ff5f', short: 'PWR' },
  bones:    { label: 'Bones',    color: '#ffd36e', short: 'BON' },
  mobility: { label: 'Mobility', color: '#67e8f9', short: 'MOB' },
  muscle:   { label: 'Muscle',   color: '#ff8a7a', short: 'MUS' },
  brain:    { label: 'Brain',    color: '#c4a7ff', short: 'BRN' },
  condition:{ label: 'Condition',color: '#8fffc0', short: 'CON' },
}

export function averageNeeds(needs) {
  return (needs.hunger + needs.energy + needs.hygiene + needs.fun) / 4
}

export function heterozygosity(genome) {
  let sum = 0
  for (const gene of GENES) {
    const [a = 0.5, b = 0.5] = genome?.[gene.key] || []
    sum += Math.abs(a - b)
  }
  return sum / GENES.length
}

export function conditionOf(creature) {
  if (!creature) return 0
  const needs = creature.needs
  const vitality = averageNeeds(needs)
  const vigor = clamp01(heterozygosity(creature.genome) * 1.8) * 9
  const levelBonus = Math.min(6, (creature.wins || 0) * 0.8)
  const raw = vitality * 0.88 + vigor + levelBonus + 4
  return Math.round(clamp(raw, 4, 100))
}

export function statsOf(creature) {
  const p = phenotype(creature.genome)
  const cond = conditionOf(creature)
  const condMul = 0.72 + (cond / 100) * 0.28
  const raw = {
    power: 12 + p.size * 18 + p.muscle * 30 + p.bone * 14 + p.horns * 12 + p.snout * 6 + p.armor * 7 + p.tusks * 10,
    bones: 8 + p.bone * 84 + p.armor * 8,
    mobility: 8 + p.legs * 25 + p.speed * 32 + (1 - p.stance) * 12 + p.wings * 14 - p.size * 7,
    muscle: 6 + p.muscle * 88 + p.stance * 6,
    brain: 5 + p.brain * 88 + p.eyes * 7,
    condition: cond,
  }
  const out = {}
  for (const k of STAT_KEYS) out[k] = Math.round(clamp(k === 'condition' ? raw[k] : raw[k] * condMul, 3, 100))
  return out
}

export function maxHpOf(creature) {
  const p = phenotype(creature.genome)
  const stats = statsOf(creature)
  return Math.round(64 + p.size * 58 + p.bone * 34 + stats.muscle * 0.28 + p.armor * 16 + (creature.wins || 0) * 3)
}

export function maxStaminaOf(creature) {
  const p = phenotype(creature.genome)
  return Math.round(58 + p.speed * 34 + p.legs * 18 + p.brain * 10 + p.wings * 10)
}

export function needsProfile(creature) {
  const p = phenotype(creature.genome)
  return {
    hunger: 0.24 + p.metabolism * 0.33 + p.size * 0.13,
    energy: 0.10 + p.speed * 0.12 + p.size * 0.06 + p.wings * 0.05,
    hygiene: 0.05 + p.armor * 0.04 + p.pattern * 0.05,
    fun: 0.07 + p.brain * 0.15 + p.speed * 0.04,
  }
}

export function decayNeeds(creature, seconds) {
  const rate = needsProfile(creature)
  for (const k of ['hunger', 'energy', 'hygiene', 'fun']) {
    creature.needs[k] = Math.max(0, Math.min(100, creature.needs[k] - rate[k] * seconds))
  }
}

export function freshNeeds(value = 82) {
  return { hunger: value, energy: value, hygiene: value, fun: value }
}

// ─── movement / battle traits ──────────────────────────────────────────────
export function movesFor(creature) {
  const p = phenotype(creature.genome)
  const moves = []
  moves.push({
    id: 'bite', name: 'Rend', icon: '⚔', type: 'strike', cost: 11,
    power: 0.92 + p.snout * 0.38 + p.head * 0.14,
    acc: 0.88 + p.eyes * 0.08, tag: 'JAW',
    desc: 'A snapping bite. Reliable and cheap.',
    fx: 'bite',
  })
  if (p.tusks > 0.22) moves.push({
    id: 'tusk', name: 'Tusk Jab', icon: '🦷', type: 'strike', cost: 13,
    power: 0.88 + p.tusks * 0.44 + p.snout * 0.12,
    acc: 0.9 + p.eyes * 0.06, tag: 'TUSK',
    desc: 'Drive the tusks deep. Heavy piercing strike.',
    fx: 'tusk', crit: 0.08 + p.tusks * 0.1,
  })
  if (p.horns > 0.18) moves.push({
    id: 'gore', name: 'Horn Rush', icon: '⛏', type: 'strike', cost: 18,
    power: 1.08 + p.horns * 0.52 + p.bone * 0.25,
    acc: 0.76 + p.speed * 0.15 + p.eyes * 0.06, tag: 'HORN',
    desc: 'Lower the crown and charge. Huge damage, less accurate.',
    fx: 'gore', crit: 0.1 + p.horns * 0.14,
  })
  if (p.armor > 0.2 || p.size > 0.55) moves.push({
    id: 'slam', name: 'Mass Slam', icon: '⬤', type: 'strike', cost: 16,
    power: 0.95 + p.size * 0.34 + p.muscle * 0.26 + p.armor * 0.14,
    acc: 0.82 + p.eyes * 0.06, tag: 'BODY',
    desc: 'Throw the whole mass forward. Shakes the arena.',
    fx: 'slam', stagger: 0.3,
  })
  if (p.tail > 0.3) moves.push({
    id: 'tail', name: 'Tail Sweep', icon: '↻', type: 'strike', cost: 12,
    power: 0.7 + p.tail * 0.44 + p.speed * 0.14,
    acc: 0.9, tag: 'TAIL',
    desc: 'A wide arc that leaves the foe off balance.',
    fx: 'tail', debuff: 'acc',
  })
  if (p.wings > 0.42) moves.push({
    id: 'gust', name: 'Wing Gust', icon: '≋', type: 'strike', cost: 14,
    power: 0.62 + p.wings * 0.42 + p.speed * 0.12,
    acc: 0.95, tag: 'WING',
    desc: 'Batter with a downdraft and lift your guard.',
    fx: 'gust', buff: 'evade',
  })
  if (p.brain > 0.55) moves.push({
    id: 'mind', name: 'Neural Lash', icon: '✦', type: 'strike', cost: 20,
    power: 0.86 + p.brain * 0.4 + p.eyes * 0.2,
    acc: 0.97, tag: 'MIND',
    desc: 'A focused psychic jab that pierces guarding.',
    fx: 'mind', pierce: true,
  })
  moves.push({
    id: 'guard', name: 'Brace', icon: '◈', type: 'defend', cost: -14,
    tag: 'GUARD', desc: 'Plant your feet. Halve the next hit, recover stamina.',
    fx: 'guard',
  })
  return [...moves.filter(move => move.type === 'strike').slice(0, 5), moves.find(move => move.type === 'defend')]
}

// ─── breeding ──────────────────────────────────────────────────────────────
export function geneticSimilarity(a, b) {
  let sum = 0
  for (const gene of GENES) {
    const allelesA = a?.[gene.key] || [0.5, 0.5]
    const allelesB = b?.[gene.key] || [0.5, 0.5]
    const pa = ((allelesA[0] ?? 0.5) + (allelesA[1] ?? 0.5)) / 2
    const pb = ((allelesB[0] ?? 0.5) + (allelesB[1] ?? 0.5)) / 2
    sum += Math.abs(pa - pb)
  }
  return clamp01(1 - sum / GENES.length)
}

export function breedGenomes(genomeA, genomeB, mutationRate = 0.09) {
  const child = {}
  const mutations = []
  for (const gene of GENES) {
    const allelesA = genomeA[gene.key] || [0.5, 0.5]
    const allelesB = genomeB[gene.key] || [0.5, 0.5]
    const pickA = Math.random() < 0.5 ? allelesA[0] : allelesA[1]
    const pickB = Math.random() < 0.5 ? allelesB[0] : allelesB[1]
    let a = pickA, b = pickB
    if (Math.random() < mutationRate) {
      a = clamp(a + (Math.random() - 0.5) * 0.26)
      mutations.push(gene.key)
    }
    if (Math.random() < mutationRate) {
      b = clamp(b + (Math.random() - 0.5) * 0.26)
      if (!mutations.includes(gene.key)) mutations.push(gene.key)
    }
    child[gene.key] = [a, b]
  }
  return { genome: child, mutations: [...new Set(mutations)] }
}

const FIRST = ['Vex', 'Morrow', 'Thal', 'Kestrel', 'Nyra', 'Orin', 'Sable', 'Quill', 'Rime', 'Ash', 'Bramble', 'Cinder', 'Dusk', 'Echo', 'Fen', 'Gloam', 'Harrow', 'Iris', 'Juno', 'Kite', 'Lumen', 'Moss', 'Nettle', 'Onyx', 'Pyre', 'Rook', 'Silt', 'Thorn', 'Umber', 'Vale', 'Wisp', 'Yarrow', 'Zephyr', 'Cobalt', 'Dune', 'Ember', 'Flint', 'Gale', 'Hazel', 'Indigo', 'Jasper', 'Kelp', 'Lark', 'Mica', 'Nimbus', 'Opal', 'Pearl', 'Reed', 'Slate', 'Tide']
const SECOND = ['back', 'wing', 'maw', 'horn', 'crest', 'shade', 'spine', 'bloom', 'stride', 'gaze', 'fang', 'scale', 'song', 'tread', 'vault', 'whisper', 'cradle', 'howl', 'drift', 'spark']

export function makeName(genome, parents) {
  const p = phenotype(genome)
  const first = FIRST[Math.floor(Math.random() * FIRST.length)]
  let epithet = SECOND[Math.floor(Math.random() * SECOND.length)]
  if (p.horns > 0.65) epithet = 'horn'
  else if (p.wings > 0.6) epithet = 'wing'
  else if (p.brain > 0.7) epithet = 'gaze'
  else if (p.speed > 0.68) epithet = 'stride'
  else if (p.armor > 0.65) epithet = 'scale'
  const name = `${first}${epithet}`
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function sexOf() {
  return Math.random() < 0.5 ? 'F' : 'M'
}

export function generateStarter(seed, bias) {
  return createCreature(randomGenome(seed, bias), seed)
}

export function generateWild(seed = Math.floor(Math.random() * 1000000000)) {
  return createCreature(randomGenome(seed, { _wild: true }), seed)
}

function createCreature(genome, seed) {
  return {
    id: cryptoId(),
    name: makeName(genome),
    genome,
    sex: seed % 2 === 0 ? 'F' : 'M',
    needs: freshNeeds(86),
    wins: 0,
    battles: 0,
    born: Date.now(),
    generation: 0,
  }
}

let idCounter = 0
export function cryptoId() {
  idCounter++
  return 'c' + Date.now().toString(36) + idCounter.toString(36) + Math.random().toString(36).slice(2, 5)
}

export function dnaSequence(genome) {
  const bases = 'ACGT'
  let seq = ''
  for (const gene of GENES) {
    const alleles = genome?.[gene.key] || [0.5, 0.5]
    for (let i = 0; i < 2; i++) {
      const n = Math.floor(clamp(alleles[i] ?? 0.5) * 4095)
      for (let j = 0; j < 3; j++) seq += bases[(n >> (j * 2)) & 3]
    }
    seq += '·'
  }
  return seq.slice(0, -1)
}

export function formatAge(born) {
  const s = Math.max(0, (Date.now() - born) / 1000)
  if (s < 90) return `${Math.floor(s)}s`
  if (s < 5400) return `${Math.floor(s / 60)}m`
  if (s < 86400 * 2) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}
