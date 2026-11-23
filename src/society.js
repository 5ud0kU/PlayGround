/* Autonomous human civilization layer.
 *
 * Identities, emotions, needs, daily routines, decisions, relationships,
 * content creation/consumption, testing, reviews and a real transaction
 * ledger. Every counted event corresponds to a simulated action.
 * No DOM, no timers, no imports from world.js.
 */
import { makeRng, clamp, hash32, slugify } from './util.js';
import { lint, languageFor } from './coding.js';
import { npcCreateProject, npcPatchProject, projectDetail } from './devworld.js';

export const SOCIETY_VERSION = 1;
const DAY = 1440;

export const SOC_CAPS = Object.freeze({
  identities: 460, content: 360, transactions: 600, reviews: 600,
  tests: 600, usage: 900, relationships: 900, events: 500, decisions: 900
});

const NEEDS = ['security','employment','knowledge','social','achievement','recreation','recognition','growth','expression','independence','stability','belonging','privacy','rest'];
const EMOTIONS = ['happiness','sadness','frustration','curiosity','excitement','anxiety','fear','confidence','disappointment','boredom','loneliness','motivation','pride','jealousy','trust','affection','stress','gratitude'];
const CONTENT_TYPES = ['software','article','guide','website','game','data','video','music','podcast','image'];
const INTEREST_TOPICS = ['python','javascript','networking','security','databases','design','linux','automation','privacy','hardware','markets','research','writing','cloud','games','education','music','art'];

function srng(game, salt = 0) {
  return makeRng((game.seed ^ Math.floor((game.worldMinutes || 0) * 2654435761) ^ ((game.tickCount || 0) * 97) ^ salt) >>> 0);
}
function nextId(st, prefix) { st.seq[prefix] = (st.seq[prefix] || 1) + 1; return `${prefix}-${String(st.seq[prefix]).padStart(5, '0')}`; }
function bounded(arr, maximum) { if (Array.isArray(arr) && arr.length > maximum) arr.splice(0, arr.length - maximum); return arr; }
function clampv(n) { return clamp(Number(n) || 0, 0, 100); }
function ageOf(handle, seed) { return 18 + (hash32(`${handle}:${seed}:age`) % 52); }
function pick(rng, arr) { return arr.length ? arr[rng.int(0, arr.length - 1)] : null; }
function pickWeighted(rng, entries, weight) {
  if (!entries.length) return null;
  let roll = rng.next() * entries.reduce((s, e) => s + Math.max(.0001, weight(e)), 0);
  for (const e of entries) { roll -= Math.max(.0001, weight(e)); if (roll <= 0) return e; }
  return entries[entries.length - 1];
}
function money(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('en-US'); }

function defaultEmotions() {
  const out = {};
  for (const key of EMOTIONS) out[key] = 0;
  out.happiness = 12; out.curiosity = 20; out.motivation = 30; out.trust = 10; out.stress = 8;
  return out;
}
function defaultNeeds(rng) {
  const out = {};
  for (const key of NEEDS) out[key] = clamp(Math.round(rng.float(20, 70)), 0, 100);
  out.security = clampv(out.security + 12);
  out.rest = clampv(out.rest + 10);
  return out;
}
function scheduleFor(role, rng) {
  const r = String(role || '').toLowerCase();
  if (/student/.test(r)) return { wake: 7 * 60, work: 9 * 60, study: 13 * 60, leisure: 19 * 60, sleep: 23 * 60 };
  if (/executive|manager|entrepreneur|broker/.test(r)) return { wake: 6 * 60, work: 8 * 60, study: 18 * 60, leisure: 21 * 60, sleep: 23 * 60 };
  if (/admin|engineer|operations|reliability/.test(r)) return { wake: 7 * 60, work: 9 * 60, study: 17 * 60, leisure: 20 * 60, sleep: 24 * 60 };
  if (/security|research/.test(r)) return { wake: 8 * 60, work: 10 * 60, study: 16 * 60, leisure: 21 * 60, sleep: 1 * 60 };
  return { wake: rng.int(6, 9) * 60, work: rng.int(8, 11) * 60, study: rng.int(15, 19) * 60, leisure: rng.int(19, 22) * 60, sleep: rng.int(23, 25) * 60 };
}

export function ensureSociety(game) {
  if (!game.society || typeof game.society !== 'object' || !game.society.identities || typeof game.society.identities !== 'object') {
    game.society = buildSociety(game, srng(game, 0x50c1));
    return game.society;
  }
  const st = game.society;
  st.version = SOCIETY_VERSION;
  st.seq = st.seq || {};
  for (const key of ['identity','content','transaction','review','test','usage','relationship','event','decision']) if (typeof st.seq[key] !== 'number') st.seq[key] = 1;
  for (const key of ['content','transactions','reviews','tests','usage','relationships','events','decisions']) if (!Array.isArray(st[key])) st[key] = [];
  st.cadence = st.cadence || {};
  st.metrics = st.metrics || {};
  const caps = { content: SOC_CAPS.content, transactions: SOC_CAPS.transactions, reviews: SOC_CAPS.reviews, tests: SOC_CAPS.tests, usage: SOC_CAPS.usage, relationships: SOC_CAPS.relationships, events: SOC_CAPS.events, decisions: SOC_CAPS.decisions };
  for (const [key, maximum] of Object.entries(caps)) bounded(st[key], maximum);
  for (const identity of Object.values(st.identities)) {
    if (!identity.emotions) identity.emotions = defaultEmotions();
    if (!identity.needs) identity.needs = defaultNeeds(srng(game, hash32(identity.handle)));
    if (!Array.isArray(identity.memories)) identity.memories = [];
    if (!Array.isArray(identity.objectives)) identity.objectives = [];
    if (!Array.isArray(identity.history)) identity.history = [];
    if (!Array.isArray(identity.skills)) identity.skills = [];
  }
  recomputeSocietyMetrics(game, st);
  return st;
}

export function buildSociety(game, rng = null) {
  rng = rng || srng(game, 0x50c1);
  const st = {
    version: SOCIETY_VERSION,
    seq: { identity: 1, content: 1, transaction: 1, review: 1, test: 1, usage: 1, relationship: 1, event: 1, decision: 1 },
    identities: {}, content: [], transactions: [], reviews: [], tests: [], usage: [],
    relationships: [], events: [], decisions: [], cadence: {}, metrics: {},
    builtWorld: game.worldMinutes || 0
  };
  for (const npc of (game.npcs || []).slice(0, SOC_CAPS.identities)) st.identities[npc.id] = makeIdentity(game, rng, npc);
  // Seed a small number of real public artifacts so the world has culture before the player acts.
  const creators = Object.values(st.identities).filter(i => i.level === 'active').slice(0, 10);
  for (const creator of creators) {
    const type = pick(rng, ['article','guide','software','website']);
    createContent(game, st, creator, { type, reason: 'to share what I know', public: true }, rng);
  }
  recomputeSocietyMetrics(game, st);
  return st;
}

function makeIdentity(game, rng, npc) {
  const age = ageOf(npc.handle, game.seed);
  const now = game.worldMinutes || 0;
  const education = [];
  if (age > 22) education.push({ field: pick(rng, INTEREST_TOPICS), level: rng.pick(['certificate','diploma','BSc','MSc']), years: rng.int(1, 5) });
  if (rng.chance(.3)) education.push({ field: pick(rng, INTEREST_TOPICS), level: 'self-taught', years: rng.int(1, 8) });
  const experiences = [];
  if (rng.chance(.7)) experiences.push({ role: npc.role, employer: npc.company || 'independent', from: now - rng.int(30, 1800) * DAY, to: null });
  const level = rng.chance(.18) ? 'active' : rng.chance(.5) ? 'known' : 'distant';
  return {
    id: `identity-${String(st_seqSafe(game, npc)).padStart(5, '0')}`,
    npcId: npc.id, handle: npc.handle, name: npc.name,
    age, birthWorld: now - age * 365 * DAY,
    history: [`Born ${age} years before the current world minute.`, `Currently ${npc.role}.`],
    education, experience: experiences,
    technical: { [String(npc.role || 'general').toLowerCase()]: npc.skill || 50, ...Object.fromEntries((npc.interests || []).slice(0, 3).map(i => [i, clampv((npc.skill || 50) + rng.int(-8, 12))])) },
    personality: npc.personality || 'pragmatic',
    interests: (npc.interests || []).slice(),
    preferences: { collaboration: rng.float(.1, .9), risk: rng.float(.05, .7), privacy: rng.float(.1, .9) },
    values: rng.picks(['independence','craft','community','accuracy','profit','learning','privacy','stability','freedom'], rng.int(2, 4)),
    habits: rng.picks(['writes notes','checks forums daily','reviews code twice','publishes weekly','works late','takes long walks','keeps a journal'], rng.int(1, 3)),
    ambitions: [pick(rng, ['build something useful','gain recognition','find stable work','learn a new language','publish a library','grow a small business'])],
    objectives: [pick(rng, ['finish a project','improve a skill','earn a contract','meet collaborators','reduce stress'])],
    memories: [], decisions: [], relationships: [],
    emotions: defaultEmotions(), emotionCauses: {}, needs: defaultNeeds(rng),
    funds: Math.max(0, Math.round(npc.funds || rng.int(200, 5000))),
    living: { situation: rng.pick(['rents a small flat','shares a house','lives with family','lives above a workshop']), location: game.civ?.cities?.[rng.int(0, Math.max(0, (game.civ?.cities?.length || 1) - 1))]?.name || 'NullNet' },
    family: rng.chance(.4) ? [pick(rng, ['a sibling','a parent','a partner'])] : [],
    schedule: scheduleFor(npc.role, rng),
    employment: { employerId: npc.companyId || null, employer: npc.company || 'independent', role: npc.role || 'independent work', salaryPerDay: Math.round(rng.float(12, 90)) },
    level, lastActiveWorld: now, lastDecisionWorld: 0, contentIds: [], purchases: [], sales: [],
    health: rng.int(70, 100), mood: npc.mood || 'calm', status: 'alive'
  };
}
function st_seqSafe(game, npc) { return (hash32(`${game.seed}:${npc.id}`) % 100000) + 1; }

function emotion(st, identity, key, delta, cause) {
  if (!identity.emotions) identity.emotions = defaultEmotions();
  if (!identity.emotionCauses) identity.emotionCauses = {};
  identity.emotions[key] = clamp(Number(identity.emotions[key] || 0) + delta, -100, 100);
  identity.emotionCauses[key] = String(cause || '').slice(0, 160);
}
function need(identity, key, delta) {
  if (!identity.needs) identity.needs = defaultNeeds(srng({ seed: 1 }));
  identity.needs[key] = clampv((identity.needs[key] || 0) + delta);
}
function remember(identity, text, world, weight = 1) {
  identity.memories.push({ world, text: String(text).slice(0, 180), weight });
  if (identity.memories.length > 60) {
    identity.memories.sort((a, b) => b.weight - a.weight);
    identity.memories.length = 40;
  }
}
function societyEvent(st, opts) {
  st.events.push({
    id: nextId(st, 'event'), world: opts.world || 0, category: opts.category || 'life',
    title: String(opts.title || 'Life event').slice(0, 140),
    body: String(opts.body || '').slice(0, 300),
    actors: (opts.actors || []).slice(0, 6), severity: opts.severity || 'minor',
    contentId: opts.contentId || null
  });
  bounded(st.events, SOC_CAPS.events);
}
function decision(st, identity, action, reason, world) {
  st.decisions.push({ id: nextId(st, 'decision'), identityId: identity.id, handle: identity.handle, action, reason: String(reason).slice(0, 180), world });
  bounded(st.decisions, SOC_CAPS.decisions);
  identity.decisions.push({ action, reason: String(reason).slice(0, 120), world });
  bounded(identity.decisions, 40);
  identity.lastDecisionWorld = world;
}

/* ---------------- content ---------------- */
export function createContent(game, st, identity, opts = {}, rng = null) {
  rng = rng || srng(game, hash32(identity.handle + 'content'));
  if (st.content.length >= SOC_CAPS.content) return null;
  const type = CONTENT_TYPES.includes(opts.type) ? opts.type : 'article';
  const topics = identity.interests.length ? identity.interests : INTEREST_TOPICS.slice(0, 3);
  const topic = pick(rng, topics);
  const slug = slugify(opts.title || `${topic}-${type}-${rng.int(10, 999)}`) || `${type}-${rng.int(10, 999)}`;
  const content = {
    id: nextId(st, 'content'), creatorId: identity.id, creatorHandle: identity.handle,
    creatorName: identity.name, type, title: String(opts.title || `${topic} ${type}`).slice(0, 90),
    description: String(opts.description || `A ${type} about ${topic} by @${identity.handle}.`).slice(0, 220),
    createdWorld: game.worldMinutes || 0, updatedWorld: game.worldMinutes || 0,
    version: '1.0.0', availability: opts.public === false ? 'private' : 'public',
    price: opts.price != null ? Math.max(0, Math.round(opts.price)) : (/income|profit|sell|business/i.test(opts.reason || '') || identity.values.includes('profit') ? rng.int(5, 60) : rng.chance(.12) ? rng.int(2, 18) : 0),
    model: opts.model || (/income|profit|sell|business/i.test(opts.reason || '') ? 'one-time' : 'free'),
    tags: [...new Set([topic, type, ...(identity.interests || []).slice(0, 3)])].slice(0, 6),
    data: {}, projectId: null, quality: {}, dependencies: [],
    usage: { views: 0, downloads: 0, purchases: 0, tests: 0, reviews: 0, recommendations: 0 },
    feedback: [], status: 'available', reason: opts.reason || 'personal expression'
  };

  if (type === 'software') {
    const project = npcCreateProject(game, game.npcs?.find(n => n.id === identity.npcId) || { id: identity.npcId, handle: identity.handle, name: identity.name, skill: Object.values(identity.technical)[0], interests: identity.interests }, {
      kind: pick(rng, ['cli','tool','library','api','game']), name: slug,
      description: content.description, reason: content.reason, publish: content.availability === 'public'
    });
    if (!project) return null;
    content.projectId = project.id;
    content.data = { projectId: project.id, files: Object.keys(project.files), language: project.language };
    content.quality = { ...project.quality, entertainment: rng.int(30, 90) };
  } else if (type === 'article' || type === 'guide' || type === 'website') {
    const skill = Object.values(identity.technical)[0] || 50;
    const sections = [
      `This ${type} was written by ${identity.name} (@${identity.handle}) because ${content.reason}.`,
      `The core idea is simple: ${topic} works best when the operator understands the failure modes before the happy path.`,
      `First, define the problem in one sentence. Then write down what a working result looks like. ${rng.pick(['Keep the first version small.','Measure before you optimise.','Write the error cases down before the feature list.'])}`,
      `A common mistake is ${rng.pick(['trusting defaults','skipping a test','assuming the network is healthy','ignoring permissions'])}. Check it early.`,
      `The ${type} ends with a short checklist: verify inputs, record the result, and keep notes for the next revision.`
    ];
    content.data = {
      text: `# ${content.title}\n\n${sections.join('\n\n')}\n`,
      words: sections.join(' ').split(/\s+/).length,
      format: 'markdown'
    };
    if (type === 'website') content.data.html = `<!doctype html><html><head><title>${content.title}</title></head><body><main><h1>${content.title}</h1><pre>${content.data.text}</pre></main></body></html>`;
    content.quality = {
      documentation: clampv(skill * .8 + rng.int(-8, 12)),
      clarity: clampv(skill * .7 + rng.int(-10, 18)),
      originality: clampv(rng.float(25, 85) + (identity.values.includes('craft') ? 10 : 0)),
      completeness: clampv(skill * .65 + rng.int(-12, 16)),
      accessibility: clampv(skill * .6 + rng.int(0, 30)),
      entertainment: clampv(rng.float(20, 80))
    };
  } else {
    content.data = {
      representation: 'structured-simulation',
      format: type,
      parameters: { topic, complexity: clampv(Object.values(identity.technical)[0] || 50), durationSeconds: rng.int(30, 900), resolution: rng.pick(['480p','720p','1080p']) },
      notes: `${identity.name} produced a ${type} about ${topic}. The simulated representation records its properties without claiming a real media file.`
    };
    content.quality = { originality: clampv(rng.float(20, 85)), completeness: clampv(rng.float(30, 90)), entertainment: clampv(rng.float(25, 95)), performance: clampv(rng.float(30, 90)) };
  }
  st.content.push(content);
  identity.contentIds.push(content.id);
  need(identity, 'expression', -16);
  need(identity, 'achievement', -12);
  need(identity, 'recognition', -8);
  emotion(st, identity, 'satisfaction', content.price > 0 ? 7 : 10, `published ${content.title}`);
  emotion(st, identity, 'pride', 8, `published ${content.title}`);
  emotion(st, identity, 'motivation', 6, `published ${content.title}`);
  societyEvent(st, { world: game.worldMinutes || 0, category: 'creation', title: `@${identity.handle} published ${content.title}`, body: `${type} · ${content.availability} · ${money(content.price)} · ${content.reason}.`, actors: [identity.handle], contentId: content.id });
  return content;
}

export function updateContent(game, st, identity, contentId, reason) {
  const content = st.content.find(c => c.id === contentId);
  if (!content || content.creatorId !== identity.id) return null;
  if (content.type === 'software' && content.projectId) {
    const hit = projectDetail(game, content.projectId);
    if (hit) content.version = npcPatchProject(game, hit.project, game.npcs?.find(n => n.id === identity.npcId), reason);
  } else {
    const bump = content.version.split('.').map(Number);
    bump[2]++;
    content.version = bump.join('.');
    if (content.data.text) content.data.text += `\n\n## Revision ${content.version}\n\n${reason}\n`;
    if (content.data.html) content.data.html = content.data.html.replace('</main>', `<p>${reason}</p></main>`);
  }
  content.updatedWorld = game.worldMinutes || 0;
  emotion(st, identity, 'satisfaction', 4, `updated ${content.title}`);
  societyEvent(st, { world: game.worldMinutes || 0, category: 'creation', title: `@${identity.handle} updated ${content.title}`, body: reason, actors: [identity.handle], contentId });
  return content;
}

/* ---------------- relationships ---------------- */
function getRelationship(st, a, b, type = 'acquaintance', npcA = null, npcB = null) {
  if (a.id === b.id) return null;
  const key = [a.id, b.id].sort().join(':');
  let rel = st.relationships.find(r => r.key === key);
  if (rel) return rel;
  rel = {
    id: nextId(st, 'relationship'), key, aId: a.id, bId: b.id,
    aHandle: a.handle || 'player', bHandle: b.handle || 'player',
    type, trust: clamp(Math.round((npcA?.rep || 20) / 4), 0, 60), affection: 5,
    interactions: [], lastWorld: 0, status: 'acquaintance'
  };
  st.relationships.push(rel);
  bounded(st.relationships, SOC_CAPS.relationships);
  return rel;
}
function interact(st, a, b, kind, outcome, world, note = '') {
  const rel = getRelationship(st, a, b, kind, null, null);
  if (!rel) return null;
  rel.interactions.push({ kind, outcome, world, note: String(note).slice(0, 140) });
  bounded(rel.interactions, 30);
  rel.lastWorld = world;
  const positive = ['helped','collaborated','recommended','thanked','shared','paid'].includes(outcome);
  const negative = ['argued','disappointed','refunded','criticised','betrayed'].includes(outcome);
  rel.trust = clamp(rel.trust + (positive ? 6 : negative ? -9 : 1), -100, 100);
  rel.affection = clamp(rel.affection + (positive ? 4 : negative ? -6 : 0), -100, 100);
  rel.status = rel.trust > 65 ? 'friend' : rel.trust > 35 ? 'colleague' : rel.trust < -20 ? 'rival' : 'acquaintance';
  if (a.emotions) {
    emotion(st, a, positive ? 'affection' : negative ? 'frustration' : 'trust', positive ? 5 : negative ? -6 : 1, `${outcome} with @${b.handle}`);
    need(a, 'social', -8);
  }
  if (b.emotions) emotion(st, b, positive ? 'gratitude' : negative ? 'sadness' : 'trust', positive ? 5 : negative ? -5 : 1, `${outcome} with @${a.handle}`);
  return rel;
}

/* ---------------- consumption, testing and economy ---------------- */
export function recordUsage(game, st, identity, content, action) {
  if (!identity || !content) return null;
  const usage = { id: nextId(st, 'usage'), contentId: content.id, consumerId: identity.id, handle: identity.handle, action, world: game.worldMinutes || 0 };
  st.usage.push(usage);
  bounded(st.usage, SOC_CAPS.usage);
  if (action === 'download' || action === 'purchase') {
    content.usage.downloads++;
    if (content.projectId) {
      const hit = projectDetail(game, content.projectId);
      if (hit) hit.project.metrics.downloads++;
    }
  } else if (action === 'view' || action === 'play' || action === 'read') content.usage.views++;
  identity.purchases.push({ contentId: content.id, action, world: usage.world });
  bounded(identity.purchases, 60);
  return usage;
}

export function testContent(game, st, identity, content) {
  if (!identity || !content) return null;
  const findings = [];
  let result = 'pass';
  let operation = 'read';
  if (content.type === 'software' && content.projectId) {
    const hit = projectDetail(game, content.projectId);
    operation = 'lint';
    if (hit) {
      for (const [path, source] of Object.entries(hit.project.files)) {
        if (!/\.(py|js|ts|c|cpp|go|rs|sh|html|sql)$/.test(path)) continue;
        const lang = languageFor(path, source).id;
        for (const problem of lint(source, lang, path)) {
          if (problem.severity === 'error' || problem.severity === 'warning') findings.push(`${path}:${problem.line} ${problem.message}`);
        }
      }
      result = findings.length ? 'fail' : 'pass';
    } else result = 'unavailable';
  } else if (content.data?.text) {
    operation = 'read';
    const words = content.data.words || 0;
    if (words < 60) { findings.push('document is unusually short'); result = 'fail'; }
    if (content.quality.documentation < 35) findings.push('documentation is hard to follow');
  } else if (content.data?.html) {
    operation = 'navigate';
    if (!content.data.html.includes('<h1>')) { findings.push('page has no heading'); result = 'fail'; }
  } else {
    operation = 'simulated-execution';
    if (content.status !== 'available') { result = 'unavailable'; findings.push('content is unavailable'); }
  }
  const test = {
    id: nextId(st, 'test'), contentId: content.id, testerId: identity.id, handle: identity.handle,
    world: game.worldMinutes || 0, operation, result, findings: findings.slice(0, 12),
    capability: Math.round(Object.values(identity.technical)[0] || 50)
  };
  st.tests.push(test);
  bounded(st.tests, SOC_CAPS.tests);
  content.usage.tests++;
  if (result === 'fail') {
    emotion(st, identity, 'frustration', 6, `${content.title} failed ${operation}`);
    emotion(st, identity, 'disappointment', 5, `${content.title} failed ${operation}`);
  } else if (result === 'pass') {
    emotion(st, identity, 'satisfaction', 4, `${content.title} passed ${operation}`);
    emotion(st, identity, 'confidence', 2, `${content.title} passed ${operation}`);
  }
  return test;
}

export function purchaseContent(game, st, identity, content, opts = {}) {
  if (!content || !identity) return { ok: false, error: 'No buyer or content.' };
  if (content.availability === 'private' && content.creatorId !== identity.id) return { ok: false, error: 'That content is private.' };
  const price = opts.free ? 0 : content.price || 0;
  if (price > 0 && identity.funds < price) return { ok: false, error: `${identity.handle} cannot afford ${content.title}.` };
  if (content.creatorId === identity.id) return recordUsage(game, st, identity, content, price ? 'purchase' : content.type === 'software' ? 'download' : 'use') && { ok: true, self: true };
  if (price > 0) {
    identity.funds -= price;
    const creator = Object.values(st.identities).find(i => i.id === content.creatorId);
    if (creator) {
      creator.funds += price;
      creator.sales.push({ contentId: content.id, buyerId: identity.id, amount: price, world: game.worldMinutes || 0 });
      bounded(creator.sales, 80);
      emotion(st, creator, 'gratitude', 5, `${identity.handle} purchased ${content.title}`);
      emotion(st, creator, 'happiness', 4, `sale of ${content.title}`);
      need(creator, 'security', -8);
    }
    content.usage.purchases++;
  }
  const transaction = {
    id: nextId(st, 'transaction'), buyerId: identity.id, buyerHandle: identity.handle,
    sellerId: content.creatorId, sellerHandle: content.creatorHandle, contentId: content.id,
    amount: price, kind: price ? content.model : 'free-access', world: game.worldMinutes || 0, status: 'settled'
  };
  st.transactions.push(transaction);
  bounded(st.transactions, SOC_CAPS.transactions);
  recordUsage(game, st, identity, content, price ? 'purchase' : content.type === 'software' ? 'download' : 'use');
  societyEvent(st, { world: transaction.world, category: 'commerce', title: `@${identity.handle} acquired ${content.title}`, body: `${money(price)} · seller @${content.creatorHandle} · transaction ${transaction.id}.`, actors: [identity.handle, content.creatorHandle], contentId: content.id });
  return { ok: true, transaction, price };
}

export function reviewContent(game, st, identity, content, text) {
  const test = st.tests.filter(t => t.contentId === content.id && t.testerId === identity.id).slice(-1)[0];
  if (!test) return { ok: false, error: 'You must test content before reviewing it.' };
  const skill = Math.round(Object.values(identity.technical)[0] || 50);
  const base = test.result === 'pass' ? 68 : 32;
  const alignment = content.tags.some(t => (identity.interests || []).includes(t)) ? 8 : 0;
  const expertise = skill > 70 ? (test.findings.length ? -6 : 4) : 0;
  const rating = clamp(Math.round(base + alignment + expertise + identity.emotions.happiness / 20 - identity.emotions.frustration / 12), 1, 5);
  const review = {
    id: nextId(st, 'review'), contentId: content.id, reviewerId: identity.id, handle: identity.handle,
    world: game.worldMinutes || 0, rating, testId: test.id, text: String(text || `${content.title} ${test.result === 'pass' ? 'worked as described.' : 'needs work.'}`).slice(0, 240)
  };
  st.reviews.push(review);
  bounded(st.reviews, SOC_CAPS.reviews);
  content.feedback.push({ reviewId: review.id, rating, world: review.world });
  content.usage.reviews++;
  const creator = Object.values(st.identities).find(i => i.id === content.creatorId);
  if (creator) {
    emotion(st, creator, rating >= 4 ? 'pride' : 'disappointment', rating >= 4 ? 7 : -6, `review of ${content.title}`);
    need(creator, 'recognition', rating >= 4 ? -14 : 8);
    if (rating < 3) emotion(st, creator, 'stress', 5, 'negative review');
  }
  societyEvent(st, { world: review.world, category: 'feedback', title: `@${identity.handle} rated ${content.title} ${rating}/5`, body: review.text, actors: [identity.handle], contentId: content.id });
  return { ok: true, review };
}

export function recommendContent(game, st, from, to, content) {
  const rel = getRelationship(st, from, to, 'recommendation');
  const r = interact(st, from, to, 'recommendation', 'recommended', game.worldMinutes || 0, content.title);
  content.usage.recommendations++;
  emotion(st, from, 'affection', 3, `recommended ${content.title} to @${to.handle}`);
  return { ok: true, relationship: r };
}

/* ---------------- decisions and daily life ---------------- */
function phaseOf(identity, world) {
  const t = ((world % DAY) + DAY) % DAY;
  const s = identity.schedule;
  if (t < s.wake || t >= s.sleep) return 'sleep';
  if (t >= s.work && t < (s.study || s.work + 8 * 60)) return 'work';
  if (t >= s.study && t < s.leisure) return 'study';
  if (t >= s.leisure) return 'leisure';
  return 'routine';
}
function actionScore(identity, action, phase, rng) {
  const n = identity.needs, e = identity.emotions;
  let score = rng.float(0, 8);
  if (action === 'rest') score += (phase === 'sleep' ? 40 : 4) + n.rest / 3 - e.stress / 8;
  if (action === 'work') score += (phase === 'work' ? 34 : 2) + (100 - n.security) / 5 + (100 - n.employment) / 6 + e.motivation / 8;
  if (action === 'study') score += (phase === 'study' ? 32 : 3) + n.knowledge / 4 + n.growth / 5 - e.boredom / 6;
  if (action === 'create') score += (phase === 'leisure' || phase === 'study' ? 14 : 4) + n.expression / 3 + n.achievement / 4 + e.motivation / 6;
  if (action === 'consume') score += n.recreation / 3 + n.knowledge / 6 + e.curiosity / 5 - n.security / 12;
  if (action === 'social') score += (phase === 'leisure' ? 22 : 4) + n.social / 3 + n.belonging / 4 - e.loneliness / 8;
  if (action === 'seek-work') score += n.employment / 2 + (100 - n.security) / 4 + (identity.employment?.role === 'independent work' ? 8 : 0);
  if (action === 'maintain') score += (identity.contentIds.length ? 12 : -20) + n.recognition / 6;
  if (action === 'explore') score += e.curiosity / 4 + n.recreation / 5;
  return score;
}

function executeDecision(game, st, identity, action, rng) {
  const world = game.worldMinutes || 0;
  const phase = phaseOf(identity, world);
  let reason = '';
  if (action === 'rest') {
    need(identity, 'rest', -30);
    emotion(st, identity, 'stress', -14, 'rested');
    identity.health = clamp(identity.health + 3, 0, 100);
    reason = `slept during ${phase}`;
  } else if (action === 'work') {
    const pay = Math.round(identity.employment.salaryPerDay * rng.float(.3, .8));
    identity.funds += pay;
    need(identity, 'security', -10);
    need(identity, 'employment', -8);
    emotion(st, identity, 'stress', 4, 'work pressure');
    emotion(st, identity, 'satisfaction', 3, 'completed work');
    societyEvent(st, { world, category: 'work', title: `@${identity.handle} worked a shift`, body: `${identity.employment.role} · earned ${money(pay)}.`, actors: [identity.handle] });
    reason = `worked as ${identity.employment.role}`;
  } else if (action === 'study') {
    const field = pick(rng, identity.interests.length ? identity.interests : INTEREST_TOPICS);
    identity.technical[field] = clampv((identity.technical[field] || 40) + rng.int(1, 5));
    need(identity, 'knowledge', -16);
    need(identity, 'growth', -12);
    emotion(st, identity, 'confidence', 4, `studied ${field}`);
    societyEvent(st, { world, category: 'education', title: `@${identity.handle} studied ${field}`, body: `Skill is now ${Math.round(identity.technical[field])}/100.`, actors: [identity.handle] });
    reason = `studied ${field} because knowledge was urgent`;
  } else if (action === 'create') {
    const type = pick(rng, identity.technical.python > 60 ? ['software','guide','article'] : ['article','guide','website','music']);
    const content = createContent(game, st, identity, { type, reason: pick(rng, ['to share what I know','for personal enjoyment','to build a reputation','to earn income']) }, rng);
    reason = content ? `created ${content.title}` : 'wanted to create but the registry was full';
  } else if (action === 'consume') {
    const candidates = st.content.filter(c => c.creatorId !== identity.id && c.availability === 'public' && (c.tags.some(t => (identity.interests || []).includes(t)) || rng.chance(.2)));
    const content = pickWeighted(rng, candidates, c => 1 + c.tags.filter(t => (identity.interests || []).includes(t)).length + c.usage.recommendations / 5);
    if (content) {
      const price = content.price || 0;
      const purchase = purchaseContent(game, st, identity, content, { free: price === 0 || !rng.chance(.5) });
      const test = testContent(game, st, identity, content);
      if (rng.chance(.3)) reviewContent(game, st, identity, content, '');
      need(identity, 'recreation', -14);
      need(identity, 'knowledge', content.type === 'guide' || content.type === 'article' ? -12 : -4);
      emotion(st, identity, 'curiosity', -5, `consumed ${content.title}`);
      reason = purchase.ok ? `used ${content.title} (${money(purchase.price)})` : `could not afford ${content.title}`;
    } else reason = 'looked for content but found nothing relevant';
  } else if (action === 'social') {
    const others = Object.values(st.identities).filter(i => i.id !== identity.id && i.level !== 'distant');
    const other = pick(rng, others);
    if (other) {
      const outcome = rng.chance(.78) ? 'helped' : 'argued';
      interact(st, identity, other, 'conversation', outcome, world, pick(rng, ['shared a debugging note','discussed a project','argued about architecture','recommended a guide']));
      need(identity, 'social', -18);
      need(identity, 'belonging', -10);
      reason = `${outcome} @${other.handle}`;
    } else reason = 'found nobody available to talk to';
  } else if (action === 'seek-work') {
    const co = pick(rng, game.companies || []);
    if (co && rng.chance(.35 + (identity.skill || (Object.values(identity.technical)[0] || 50)) / 300)) {
      identity.employment = { employerId: co.id || null, employer: co.name || co.handle || 'independent collective', role: pick(rng, ['contractor','developer','operations support','researcher']), salaryPerDay: Math.round(rng.float(18, 110)) };
      need(identity, 'employment', -40);
      need(identity, 'security', -20);
      emotion(st, identity, 'happiness', 12, `joined ${identity.employment.employer}`);
      emotion(st, identity, 'confidence', 8, 'found work');
      societyEvent(st, { world, category: 'career', title: `@${identity.handle} joined ${identity.employment.employer}`, body: `Role: ${identity.employment.role}.`, actors: [identity.handle] });
      reason = `accepted work at ${identity.employment.employer}`;
    } else {
      emotion(st, identity, 'anxiety', 6, 'unsuccessful job search');
      reason = 'applied for work and was declined';
    }
  } else if (action === 'maintain') {
    const own = st.content.filter(c => c.creatorId === identity.id);
    const content = pickWeighted(rng, own, c => 1 + c.usage.tests / 4 + c.usage.reviews / 4);
    if (content) {
      const updated = updateContent(game, st, identity, content.id, pick(rng, ['fixed a documented issue','updated the examples','improved error handling','added a short note from feedback']));
      reason = updated ? `updated ${content.title} to ${content.version}` : 'maintenance skipped';
    } else reason = 'had nothing to maintain';
  } else if (action === 'explore') {
    const site = pick(rng, game.sites || []);
    if (site) {
      site.visits = (site.visits || 0) + 1;
      const record = game.internet?.web?.records?.[site.id];
      if (record) record.requestsPerMin = (record.requestsPerMin || 0) + 1;
      need(identity, 'recreation', -6);
      emotion(st, identity, 'curiosity', 4, `visited ${site.domain}`);
      reason = `browsed ${site.domain}`;
    } else reason = 'the web was empty';
  }
  decision(st, identity, action, reason, world);
  identity.mood = identity.emotions.happiness > 20 ? 'content' : identity.emotions.stress > 30 ? 'stressed' : 'busy';
  return reason;
}

function advanceIdentity(game, st, identity, rng) {
  const world = game.worldMinutes || 0;
  const phase = phaseOf(identity, world);
  if (phase === 'sleep' && identity.level === 'active') {
    need(identity, 'rest', -8);
    return null;
  }
  const actions = ['work','study','create','consume','social','rest','seek-work','maintain','explore'];
  const choice = pickWeighted(rng, actions, a => Math.max(.001, actionScore(identity, a, phase, rng)));
  const reason = executeDecision(game, st, identity, choice, rng);
  identity.lastActiveWorld = world;
  // Drift needs and emotions slowly with context, never randomly labelled.
  need(identity, 'security', 1.2);
  need(identity, 'social', phase === 'leisure' ? 2 : 1);
  need(identity, 'rest', phase === 'sleep' ? -4 : 2);
  emotion(st, identity, 'boredom', choice === 'rest' ? 2 : -1, `after ${choice}`);
  if (identity.level === 'distant' && rng.chance(.05)) promote(identity, 'known', 'accumulated public activity');
  return { type: 'feed', text: `@${identity.handle} ${reason}.`, kind: 'info' };
}

function promote(identity, level, reason) {
  if (identity.level === level) return;
  identity.level = level;
  identity.memories.push({ world: identity.lastActiveWorld || 0, text: `Simulation detail raised to ${level}: ${reason}.`, weight: 3 });
}

function advanceBucket(st, key, interval, world, max = 8) {
  const bucket = Math.floor(world / interval);
  const prev = st.cadence[key] || 0;
  if (bucket <= prev) return 0;
  const steps = Math.min(max, bucket - prev);
  st.cadence[key] = prev + steps;
  return steps;
}

export function tickSociety(game, minutes = 1, rng = null) {
  const st = ensureSociety(game);
  rng = rng || srng(game, 0x8c1e);
  const events = [];
  const world = game.worldMinutes || 0;
  const identities = Object.values(st.identities);
  for (let step = 0; step < advanceBucket(st, 'active', 120, world, 12); step++) {
    const active = identities.filter(i => i.level === 'active');
    for (const identity of active.slice(0, 40)) {
      const e = advanceIdentity(game, st, identity, rng);
      if (e && rng.chance(.35)) events.push(e);
    }
  }
  for (let step = 0; step < advanceBucket(st, 'known', 720, world, 6); step++) {
    const known = identities.filter(i => i.level === 'known');
    for (const identity of known.slice(0, 60)) {
      const e = advanceIdentity(game, st, identity, rng);
      if (e && rng.chance(.1)) events.push(e);
    }
  }
  for (let step = 0; step < advanceBucket(st, 'distant', 2880, world, 4); step++) {
    for (const identity of identities.filter(i => i.level === 'distant').slice(0, 80)) {
      identity.funds += Math.round(rng.float(-6, 18));
      need(identity, 'security', rng.float(-1, 1.5));
      need(identity, 'rest', rng.float(-1, 2));
      if (rng.chance(.04)) promote(identity, 'known', 'became visible through public work');
    }
  }
  // Popularity is derived only from recorded usage, purchases and recommendations.
  for (const content of st.content) {
    const signal = content.usage.downloads + content.usage.views + content.usage.purchases * 3 + content.usage.recommendations * 2 + content.usage.reviews * 2;
    if (signal > 120 && content.status === 'available' && rng.chance(.01)) content.status = 'popular';
  }
  recomputeSocietyMetrics(game, st);
  bounded(st.content, SOC_CAPS.content);
  return events;
}

export function recomputeSocietyMetrics(game, st = ensureSociety(game)) {
  const identities = Object.values(st.identities);
  st.metrics = {
    population: identities.length,
    active: identities.filter(i => i.level === 'active').length,
    known: identities.filter(i => i.level === 'known').length,
    distant: identities.filter(i => i.level === 'distant').length,
    content: st.content.length,
    transactions: st.transactions.length,
    reviews: st.reviews.length,
    tests: st.tests.length,
    relationships: st.relationships.length,
    revenue: st.transactions.reduce((s, t) => s + t.amount, 0),
    averageHappiness: Math.round(identities.reduce((s, i) => s + (i.emotions.happiness || 0), 0) / Math.max(1, identities.length)),
    averageStress: Math.round(identities.reduce((s, i) => s + (i.emotions.stress || 0), 0) / Math.max(1, identities.length))
  };
  return st.metrics;
}

/* ---------------- shared-world hooks ---------------- */
export function playerMeetNpc(game, handle, kind = 'conversation', note = '') {
  const st = ensureSociety(game);
  const identity = Object.values(st.identities).find(i => i.handle.toLowerCase() === String(handle).toLowerCase().replace(/^@/, ''));
  if (!identity) return { ok: false, error: 'No inhabitant with that handle.' };
  const player = { id: 'player-identity', handle: game.player.handle, name: game.player.name, emotions: {}, needs: {} };
  const rel = interact(st, identity, player, kind, kind === 'conversation' ? 'helped' : 'collaborated', game.worldMinutes || 0, note);
  promote(identity, 'active', `interacted with @${game.player.handle}`);
  emotion(st, identity, 'trust', 8, `interaction with @${game.player.handle}`);
  remember(identity, `interaction with @${game.player.handle}: ${note || kind}`, game.worldMinutes || 0, 3);
  societyEvent(st, { world: game.worldMinutes || 0, category: 'relationship', title: `@${identity.handle} met @${game.player.handle}`, body: note || kind, actors: [identity.handle, game.player.handle] });
  return { ok: true, identity, relationship: rel };
}

export function playerIdentity(game) {
  return {
    id: 'player-identity', handle: game.player.handle, name: game.player.name || game.player.handle,
    technical: { general: getPlayerSkillSafe(game) }, interests: game.player?.interests || [],
    values: [], emotions: defaultEmotions(), emotionCauses: {}, needs: defaultNeeds(srng(game, 1)),
    contentIds: [], purchases: []
  };
}

export function playerPurchaseContent(game, contentId) {
  const st = ensureSociety(game);
  const content = st.content.find(c => c.id === contentId);
  if (!content) return { ok: false, error: 'No such content.' };
  if (content.availability === 'private') return { ok: false, error: 'That content is private.' };
  const price = content.price || 0;
  if (price > game.player.money) return { ok: false, error: `You need ${money(price)}.` };
  if (price > 0) {
    game.player.money -= price;
    if (game.stats) game.stats.spent += price;
    game.player.transactions.unshift({ time: Date.now(), amount: -price, memo: `content ${content.id}`, balance: game.player.money });
    const creator = st.identities[content.creatorId] || Object.values(st.identities).find(i => i.id === content.creatorId);
    if (creator) {
      creator.funds += price;
      creator.sales.push({ contentId: content.id, buyerId: 'player-identity', amount: price, world: game.worldMinutes || 0 });
      emotion(st, creator, 'gratitude', 6, `player purchased ${content.title}`);
    }
    content.usage.purchases++;
  }
  const transaction = {
    id: nextId(st, 'transaction'), buyerId: 'player-identity', buyerHandle: game.player.handle,
    sellerId: content.creatorId, sellerHandle: content.creatorHandle, contentId: content.id,
    amount: price, kind: price ? content.model : 'free-access', world: game.worldMinutes || 0, status: 'settled'
  };
  st.transactions.push(transaction);
  bounded(st.transactions, SOC_CAPS.transactions);
  const consumer = playerIdentity(game);
  recordUsage(game, st, consumer, content, price ? 'purchase' : 'use');
  const test = testContent(game, st, consumer, content);
  societyEvent(st, { world: game.worldMinutes || 0, category: 'commerce', title: `You acquired ${content.title}`, body: `${money(price)} · transaction ${transaction.id} · ${test.result}.`, actors: [game.player.handle], contentId: content.id });
  return { ok: true, content, transaction, test };
}

export function playerPublishContent(game, type, title, text, price = 0) {
  const st = ensureSociety(game);
  const identity = playerIdentity(game);
  identity.technical[String(type)] = getPlayerSkillSafe(game);
  const content = createContent(game, st, identity, { type, title, description: String(text || '').slice(0, 200), price, reason: price ? 'income' : 'to share what I know', public: true }, srng(game, hash32(title)));
  if (!content) return { ok: false, error: 'The content index is full.' };
  if (text) {
    content.data.text = `${String(text)}\n\n${content.data.text || ''}`.trim();
    content.data.words = content.data.text.split(/\s+/).length;
  }
  societyEvent(st, { world: game.worldMinutes || 0, category: 'creation', title: `You published ${content.title}`, body: `${type} · ${content.availability} · ${money(price)}.`, actors: [game.player.handle], contentId: content.id });
  return { ok: true, content };
}
function getPlayerSkillSafe(game) { return 40 + Math.min(50, Math.round((game.coding?.level || 1) * 2)); }

export function playerReviewContent(game, contentId, text) {
  const st = ensureSociety(game);
  const content = st.content.find(c => c.id === contentId);
  if (!content) return { ok: false, error: 'No such content.' };
  const consumer = playerIdentity(game);
  const result = reviewContent(game, st, consumer, content, text);
  return result;
}

/* ---------------- reads ---------------- */
export function societyOverview(game) {
  const st = ensureSociety(game);
  return {
    st, metrics: recomputeSocietyMetrics(game, st),
    citizens: Object.values(st.identities).sort((a, b) => b.funds - a.funds),
    content: st.content.slice().sort((a, b) => (b.usage.views + b.usage.purchases * 3) - (a.usage.views + a.usage.purchases * 3)),
    transactions: st.transactions.slice().reverse(),
    reviews: st.reviews.slice().reverse(),
    events: st.events.slice().reverse()
  };
}
export function citizenProfile(game, query) {
  const st = ensureSociety(game);
  const q = String(query || '').toLowerCase().replace(/^@/, '');
  const identity = Object.values(st.identities).find(i => i.handle.toLowerCase() === q || i.name.toLowerCase().includes(q));
  if (!identity) return null;
  return {
    identity,
    content: st.content.filter(c => c.creatorId === identity.id),
    purchases: st.transactions.filter(t => t.buyerId === identity.id),
    sales: st.transactions.filter(t => t.sellerId === identity.id),
    reviews: st.reviews.filter(r => r.reviewerId === identity.id),
    relationships: st.relationships.filter(r => r.aId === identity.id || r.bId === identity.id),
    decisions: st.decisions.filter(d => d.identityId === identity.id).slice(-20).reverse()
  };
}
export function contentDetail(game, query) {
  const st = ensureSociety(game);
  const q = String(query || '').toLowerCase();
  const content = st.content.find(c => c.id === q || c.title.toLowerCase().includes(q) || c.type === q);
  if (!content) return null;
  return {
    content,
    creator: Object.values(st.identities).find(i => i.id === content.creatorId)
      || (content.creatorId === 'player-identity' ? { id: 'player-identity', handle: content.creatorHandle, name: content.creatorName, level: 'player' } : null),
    usage: st.usage.filter(u => u.contentId === content.id).slice(-30).reverse(),
    tests: st.tests.filter(t => t.contentId === content.id).slice(-20).reverse(),
    reviews: st.reviews.filter(r => r.contentId === content.id).slice(-20).reverse(),
    transactions: st.transactions.filter(t => t.contentId === content.id).slice(-20).reverse()
  };
}
