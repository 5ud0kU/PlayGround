/* Deep-interaction layer: background operations, hardware, relationships,
   hands-on server administration and financial workflows.
   Pure state helpers: no DOM, no timers, no imports from world.js. */
import { makeRng, clamp, hash32, slugify } from './util.js';

export const INTERACT_VERSION = 1;
const DAY = 1440;
const caps = { operations: 60, relationships: 120, invoices: 120, orders: 120, events: 220, portfolio: 60 };

function irng(game, salt = 0) {
  return makeRng((game.seed ^ Math.floor((game.worldMinutes || 0) * 2654435761) ^ ((game.tickCount || 0) * 97) ^ salt) >>> 0);
}
function nextId(st, prefix) { st.seq[prefix] = (st.seq[prefix] || 1) + 1; return `${prefix}-${String(st.seq[prefix]).padStart(4, '0')}`; }
function bounded(arr, maximum) { if (Array.isArray(arr) && arr.length > maximum) arr.splice(0, arr.length - maximum); return arr; }
function spend(game, amount, memo) {
  const cost = Math.max(0, Math.round(amount));
  if (cost > (game.player?.money || 0)) return false;
  game.player.money -= cost;
  if (game.stats) game.stats.spent += cost;
  if (game.player.transactions) game.player.transactions.unshift({ time: Date.now(), amount: -cost, memo, balance: game.player.money });
  return true;
}
function earn(game, amount, memo) {
  const value = Math.max(0, Math.round(amount));
  game.player.money += value;
  if (game.stats) game.stats.earned += value;
  if (game.player.transactions) game.player.transactions.unshift({ time: Date.now(), amount: value, memo, balance: game.player.money });
}
function pushEvent(st, category, title, body = '', severity = 'minor') {
  st.events.push({ id: nextId(st, 'event'), world: st.worldMinutes || 0, category, title, body, severity });
  bounded(st.events, caps.events);
}
function defaultHardware() {
  return {
    cpu: { model: 'Ryzen 5 5600', cores: 4, ghz: 2.9 },
    gpu: { model: 'integrated', vramGb: 2 },
    memoryGb: 8, storageGb: 256, storageUsedGb: 84, nic: '1 Gbps',
    motherboard: 'B550M', temperature: 42, powerW: 165, health: 96,
    cooling: 'air', failures: 0, lastMaintenance: 0, upgrades: []
  };
}

export function ensureInteraction(game) {
  if (!game.interact || typeof game.interact !== 'object') {
    game.interact = {
      version: INTERACT_VERSION, worldMinutes: game.worldMinutes || 0,
      seq: { operation: 1, relationship: 1, invoice: 1, order: 1, portfolio: 1, event: 1 },
      operations: [], hardware: defaultHardware(), relationships: [], invoices: [],
      orders: [], portfolio: [], events: [], cadence: {}, metrics: {}
    };
    return game.interact;
  }
  const st = game.interact;
  st.version = INTERACT_VERSION;
  st.worldMinutes = game.worldMinutes || 0;
  st.seq = st.seq || {};
  for (const key of ['operation','relationship','invoice','order','portfolio','event']) if (typeof st.seq[key] !== 'number') st.seq[key] = 1;
  for (const key of ['operations','relationships','invoices','orders','portfolio','events']) if (!Array.isArray(st[key])) st[key] = [];
  st.cadence = st.cadence || {};
  st.metrics = st.metrics || {};
  if (!st.hardware || typeof st.hardware !== 'object') st.hardware = defaultHardware();
  const hw = st.hardware;
  if (!hw.cpu) hw.cpu = defaultHardware().cpu;
  if (!hw.gpu) hw.gpu = defaultHardware().gpu;
  for (const key of ['memoryGb','storageGb','storageUsedGb','temperature','powerW','health','failures','lastMaintenance']) if (typeof hw[key] !== 'number') hw[key] = defaultHardware()[key];
  if (!Array.isArray(hw.upgrades)) hw.upgrades = [];
  bounded(st.operations, caps.operations);
  bounded(st.relationships, caps.relationships);
  bounded(st.invoices, caps.invoices);
  bounded(st.orders, caps.orders);
  bounded(st.portfolio, caps.portfolio);
  bounded(st.events, caps.events);
  recomputeInteractionMetrics(game, st);
  return st;
}

/* ---------------- hardware ---------------- */
export const HARDWARE_TIERS = {
  cpu: [
    { id: 'i5', name: 'Core i5 12600K', cost: 340, cores: 6, ghz: 3.7, power: 190 },
    { id: 'ryzen9', name: 'Ryzen 9 7950X', cost: 920, cores: 12, ghz: 4.2, power: 260 },
    { id: 'threadripper', name: 'Threadripper 7970X', cost: 2400, cores: 24, ghz: 3.8, power: 350 }
  ],
  gpu: [
    { id: 'gtx', name: 'GTX 1660', cost: 280, vramGb: 6, power: 230 },
    { id: 'rtx', name: 'RTX 4070', cost: 760, vramGb: 12, power: 300 },
    { id: 'a6000', name: 'A6000', cost: 3400, vramGb: 48, power: 460 }
  ],
  memory: [
    { id: '16g', name: '16 GB DDR4', cost: 90, gb: 16, power: 175 },
    { id: '32g', name: '32 GB DDR5', cost: 240, gb: 32, power: 185 },
    { id: '64g', name: '64 GB DDR5', cost: 520, gb: 64, power: 200 }
  ],
  storage: [
    { id: '1t', name: '1 TB NVMe', cost: 110, gb: 1024, power: 168 },
    { id: '4t', name: '4 TB NVMe', cost: 390, gb: 4096, power: 180 }
  ],
  nic: [
    { id: 'gig', name: '2.5 Gbps NIC', cost: 70, speed: '2.5 Gbps', power: 170 },
    { id: 'ten', name: '10 Gbps NIC', cost: 260, speed: '10 Gbps', power: 185 }
  ]
};

export function hardwareSummary(game) {
  const st = ensureInteraction(game);
  const hw = st.hardware;
  const score = clamp(Math.round((hw.cpu.cores * hw.cpu.ghz * 7) + hw.memoryGb * 1.8 + hw.gpu.vramGb * 1.2 + (hw.storageGb > 512 ? 6 : 0)), 1, 400);
  return {
    ...JSON.parse(JSON.stringify(hw)),
    performance: score,
    vmCapacity: clamp(Math.floor(hw.memoryGb / 2), 1, 32),
    inferenceCapacity: clamp(Math.floor(hw.gpu.vramGb / 2), 0, 24),
    compileFactor: clamp((hw.cpu.cores * hw.cpu.ghz) / 12, .4, 6),
    status: hw.health < 30 || hw.temperature > 88 ? 'degraded' : hw.temperature > 72 ? 'warm' : 'healthy'
  };
}

export function upgradeHardware(game, component, tierId) {
  const st = ensureInteraction(game);
  const table = HARDWARE_TIERS[component];
  if (!table) return { ok: false, error: `Unknown component '${component}'. Try: ${Object.keys(HARDWARE_TIERS).join(', ')}` };
  const tier = table.find(t => t.id === tierId);
  if (!tier) return { ok: false, error: `Unknown tier '${tierId}'. Try: ${table.map(t => t.id).join(', ')}` };
  if (!spend(game, tier.cost, `hardware ${component}:${tier.id}`)) return { ok: false, error: `Upgrade costs $${tier.cost}.` };
  const hw = st.hardware;
  if (component === 'cpu') { hw.cpu = { model: tier.name, cores: tier.cores, ghz: tier.ghz }; hw.powerW = tier.power; }
  else if (component === 'gpu') { hw.gpu = { model: tier.name, vramGb: tier.vramGb }; hw.powerW = tier.power; }
  else if (component === 'memory') { hw.memoryGb = tier.gb; hw.powerW = tier.power; }
  else if (component === 'storage') { hw.storageGb = tier.gb; hw.powerW = tier.power; }
  else if (component === 'nic') { hw.nic = tier.speed; hw.powerW = tier.power; }
  hw.upgrades.push({ component, tier: tier.id, cost: tier.cost, world: game.worldMinutes || 0 });
  bounded(hw.upgrades, 40);
  hw.health = clamp(hw.health + 3, 0, 100);
  pushEvent(st, 'hardware', `${component} upgraded to ${tier.name}`, `Cost ${tier.cost}. System performance recalculated.`);
  return { ok: true, component, tier, summary: hardwareSummary(game) };
}

export function maintainHardware(game) {
  const st = ensureInteraction(game);
  if (!spend(game, 45, 'hardware maintenance')) return { ok: false, error: 'Maintenance costs $45.' };
  st.hardware.health = 100;
  st.hardware.temperature = 38;
  st.hardware.lastMaintenance = game.worldMinutes || 0;
  pushEvent(st, 'hardware', 'Workstation serviced', 'Dust removed, thermal paste renewed, health restored.');
  return { ok: true, message: 'Workstation serviced. Health 100/100, temperature 38°C.' };
}

function tickHardware(game, minutes, rng) {
  const st = ensureInteraction(game);
  const hw = st.hardware;
  const load = st.operations.filter(o => o.status === 'running').length;
  const target = 38 + load * 6 + (hw.powerW - 165) / 14;
  hw.temperature = clamp(hw.temperature + (target - hw.temperature) * Math.min(1, minutes / 240) + rng.float(-.3, .3), 28, 110);
  if (hw.temperature > 82 && rng.chance(Math.min(.12, .0015 * minutes))) {
    hw.health = clamp(hw.health - rng.int(4, 14), 0, 100);
    hw.failures++;
    pushEvent(st, 'hardware', 'Thermal throttling detected', `Temperature ${Math.round(hw.temperature)}°C. Health fell to ${Math.round(hw.health)}/100.`, 'warn');
    return [{ type: 'feed', text: `Workstation overheating: ${Math.round(hw.temperature)}°C. Service it before it fails.`, kind: 'warn' }];
  }
  if (hw.health < 25 && rng.chance(Math.min(.1, .0008 * minutes))) {
    hw.failures++;
    for (const op of st.operations) if (op.status === 'running') { op.status = 'failed'; op.logs.push('hardware failure'); }
    pushEvent(st, 'hardware', 'Workstation component failure', 'Running operations were interrupted.', 'critical');
    return [{ type: 'feed', text: 'A hardware failure interrupted background operations. Service the workstation.', kind: 'bad' }];
  }
  return [];
}

/* ---------------- background operations ---------------- */
export function operationSpeed(game) {
  const st = ensureInteraction(game);
  const hw = st.hardware;
  const compute = clamp((hw.cpu.cores * hw.cpu.ghz) / 12, .4, 6);
  const memory = clamp(hw.memoryGb / 8, .5, 4);
  const health = clamp(hw.health / 100, .3, 1);
  const running = st.operations.filter(o => o.status === 'running').length;
  const contention = 1 / (1 + Math.max(0, running - 1) * .18);
  return compute * Math.min(memory, 1.5) * health * contention;
}

export function startOperation(game, opts = {}) {
  const st = ensureInteraction(game);
  if (st.operations.filter(o => o.status === 'running').length >= 8) return { ok: false, error: 'Too many background operations are already running.' };
  if ((opts.storageCost || 0) > (st.hardware.storageGb - st.hardware.storageUsedGb)) return { ok: false, error: 'Not enough free disk space.' };
  st.hardware.storageUsedGb += Number(opts.storageCost || 0);
  const speed = operationSpeed(game);
  const work = clamp(Number(opts.work) || 10, 1, 20000);
  const total = Math.max(1, Math.round(work / speed));
  const op = {
    id: nextId(st, 'operation'), kind: opts.kind || 'generic', label: String(opts.label || 'operation').slice(0, 90),
    total, progress: 0, status: 'running', startedWorld: game.worldMinutes || 0,
    finishedWorld: null, logs: [{ world: game.worldMinutes || 0, text: 'started' }],
    resources: { cpu: clamp(Number(opts.cpu) || 20, 1, 100), memoryMb: clamp(Number(opts.memoryMb) || 256, 16, 65536) },
    meta: opts.meta || {}, result: null, delivered: false
  };
  st.operations.push(op);
  bounded(st.operations, caps.operations);
  pushEvent(st, 'operation', `Started: ${op.label}`, `Estimated ${total} world minutes.`);
  return { ok: true, operation: op, speed };
}

export function cancelOperation(game, id) {
  const st = ensureInteraction(game);
  const op = st.operations.find(o => o.id === id || o.label.toLowerCase() === String(id).toLowerCase());
  if (!op) return { ok: false, error: 'No such operation.' };
  if (op.status !== 'running') return { ok: false, error: 'That operation is no longer running.' };
  op.status = 'cancelled';
  op.finishedWorld = game.worldMinutes || 0;
  op.logs.push({ world: game.worldMinutes || 0, text: 'cancelled by operator' });
  st.hardware.storageUsedGb = Math.max(0, st.hardware.storageUsedGb - (op.meta.storageCost || 0));
  return { ok: true, operation: op };
}

function tickOperations(game, minutes, rng) {
  const st = ensureInteraction(game);
  const events = [];
  for (const op of st.operations) {
    if (op.status !== 'running') continue;
    const speed = operationSpeed(game);
    op.progress = clamp(op.progress + minutes * speed / op.total * 100, 0, 100);
    if (rng.chance(Math.min(.06, .0005 * minutes))) op.logs.push({ world: game.worldMinutes || 0, text: rng.pick(['checkpoint written','worker re-scheduled','cache warm','I/O wait spike','retrying one task']) });
    if (op.progress >= 100) {
      op.status = 'done';
      op.finishedWorld = game.worldMinutes || 0;
      op.logs.push({ world: game.worldMinutes || 0, text: 'completed' });
      events.push({ type: 'operation-done', operation: op });
      pushEvent(st, 'operation', `Completed: ${op.label}`, `Finished in ${op.finishedWorld - op.startedWorld} world minutes.`, 'good');
    }
    bounded(op.logs, 40);
  }
  return events;
}

export function collectOperations(game) {
  const st = ensureInteraction(game);
  const ready = st.operations.filter(o => o.status === 'done' && !o.delivered);
  for (const op of ready) op.delivered = true;
  return ready;
}

export function operationSummary(game) {
  const st = ensureInteraction(game);
  return st.operations.slice().reverse().slice(0, 20).map(o => ({
    id: o.id, kind: o.kind, label: o.label, status: o.status,
    progress: Math.round(o.progress), total: o.total,
    elapsed: Math.max(0, (o.finishedWorld || game.worldMinutes || 0) - o.startedWorld),
    logs: o.logs.slice(-5)
  }));
}

/* ---------------- NPC relationships ---------------- */
export const CONTACT_KINDS = ['message','help','collaborate','hire','negotiate','review'];

export function getRelationship(game, handle) {
  const st = ensureInteraction(game);
  const clean = String(handle || '').toLowerCase().replace(/^@/, '');
  let rel = st.relationships.find(r => r.handle === clean);
  if (rel) return rel;
  const npc = (game.npcs || []).find(n => n.handle.toLowerCase() === clean);
  rel = {
    id: nextId(st, 'relationship'), handle: clean, npcId: npc?.id || null,
    name: npc?.name || clean, role: npc?.role || 'unknown',
    personality: npc?.personality || 'pragmatic', trust: clamp(Math.round((npc?.rep || 30) / 3), 0, 60),
    status: 'acquaintance', interactions: [], notes: [], lastContactWorld: null,
    responseDueWorld: null, schedule: npc?.online ? 'online' : 'away'
  };
  st.relationships.push(rel);
  bounded(st.relationships, caps.relationships);
  return rel;
}

export function contactNpc(game, handle, kind, message) {
  const st = ensureInteraction(game);
  const npc = (game.npcs || []).find(n => n.handle.toLowerCase() === String(handle || '').toLowerCase().replace(/^@/, ''));
  if (!npc) return { ok: false, error: `No operator named @${handle || ''} is indexed.` };
  if (!CONTACT_KINDS.includes(kind)) return { ok: false, error: `Unknown contact type '${kind}'. Try: ${CONTACT_KINDS.join(', ')}` };
  const rel = getRelationship(game, npc.handle);
  const delay = clamp(180 + rngDelay(game, npc.handle + kind) * 720 + (npc.online ? 0 : 480), 60, 2400);
  rel.interactions.push({
    id: `${rel.id}-${rel.interactions.length + 1}`, kind, direction: 'outbound',
    message: String(message || '').slice(0, 240), world: game.worldMinutes || 0,
    status: 'pending', response: null, dueWorld: (game.worldMinutes || 0) + delay
  });
  bounded(rel.interactions, 40);
  rel.lastContactWorld = game.worldMinutes || 0;
  rel.responseDueWorld = (game.worldMinutes || 0) + delay;
  rel.trust = clamp(rel.trust + 1, 0, 100);
  pushEvent(st, 'relationship', `Contacted @${npc.handle}`, `${kind}: ${String(message || '').slice(0, 100)}`);
  return { ok: true, relationship: rel, delay, message: `Message queued. @${npc.handle} usually replies within ${Math.round(delay / 60)} hours.` };
}
function rngDelay(game, key) { return (hash32(`${game.seed}:${key}`) % 1000) / 1000; }

function tickRelationships(game, rng) {
  const st = ensureInteraction(game);
  const events = [];
  for (const rel of st.relationships) {
    const npc = (game.npcs || []).find(n => n.id === rel.npcId);
    if (!npc) continue;
    for (const interaction of rel.interactions) {
      if (interaction.status !== 'pending' || game.worldMinutes < interaction.dueWorld) continue;
      const skill = npc.skill || 50;
      const reputation = game.player.reputation || 0;
      const ambitious = /ambitious|curious|generous|loyal/i.test(npc.personality || '');
      const guarded = /guarded|secretive|skeptical|blunt/i.test(npc.personality || '');
      let chance = .52 + rel.trust / 180 + reputation / 400 + skill / 600 + (ambitious ? .1 : 0) - (guarded ? .12 : 0);
      if (['hire','negotiate'].includes(interaction.kind)) chance -= .16;
      chance = clamp(chance, .08, .94);
      const roll = rng.next();
      let outcome = roll < chance ? 'accepted' : roll < chance + .12 ? 'countered' : roll < chance + .2 ? 'ignored' : 'declined';
      if (outcome === 'accepted') rel.trust = clamp(rel.trust + 6, 0, 100);
      else if (outcome === 'declined') rel.trust = clamp(rel.trust - 3, 0, 100);
      else if (outcome === 'countered') rel.trust = clamp(rel.trust + 2, 0, 100);
      interaction.status = 'resolved';
      interaction.response = outcome;
      interaction.respondedWorld = game.worldMinutes || 0;
      rel.status = rel.trust > 72 ? 'collaborator' : rel.trust > 40 ? 'trusted' : rel.trust < 18 ? 'strained' : 'acquaintance';
      rel.responseDueWorld = null;
      const reply = relationshipReply(game, rel, npc, interaction, outcome, rng);
      if (reply) events.push(reply);
      pushEvent(st, 'relationship', `@${npc.handle} ${outcome} your ${interaction.kind}`, interaction.message);
      events.push({ type: 'feed', text: `@${npc.handle} ${outcome} your ${interaction.kind} request.`, kind: outcome === 'accepted' ? 'good' : outcome === 'declined' ? 'warn' : 'info' });
    }
  }
  return events;
}

function playerProjects(game) {
  return (game.devworld?.projects || []).filter(p => p.ownerId === 'player-dev');
}
function relationshipReply(game, rel, npc, interaction, outcome, rng) {
  const st = ensureInteraction(game);
  const subject = {
    message: 'Re: your message', help: 'technical assistance', collaborate: 'collaboration proposal',
    hire: 'work offer', negotiate: 'your rate', review: 'code review request'
  }[interaction.kind] || 'your request';
  if (outcome === 'ignored') return null;
  let body = '';
  if (outcome === 'declined') body = `Thanks for the note. I am not taking that on right now. — @${npc.handle}`;
  else if (outcome === 'countered') {
    const amount = Math.round((80 + rng.int(1, 40) * 12) / 5) * 5;
    body = `I can help, but not on those terms. ${fmtSafe(amount)} would make it worth my time. Say the word. — @${npc.handle}`;
    interaction.counterAmount = amount;
  } else if (interaction.kind === 'help') {
    body = `Look at the input path first. ${rng.pick(['Validate before parsing.','Log the failing case, not the whole payload.','Pin the dependency version before you deploy.','Add a test that reproduces it.'])} I have seen that exact failure twice. — @${npc.handle}`;
    st.relationships.find(r => r.handle === rel.handle)?.notes.push('Provided technical advice');
  } else if (interaction.kind === 'collaborate') {
    const project = playerProjects(game)[0];
    if (project) {
      project.collaborators = Array.isArray(project.collaborators) ? project.collaborators : [];
      if (!project.collaborators.includes(npc.handle)) project.collaborators.push(npc.handle);
      project.metrics.contributions++;
      body = `I will take a look at ${project.name}. Send me the failing test and I will open a patch. — @${npc.handle}`;
    } else body = `I am interested, but I do not see a project to work on yet. — @${npc.handle}`;
  } else if (interaction.kind === 'hire' || interaction.kind === 'negotiate') {
    body = `I can take a short contract. Draft the scope and I will review it before accepting. — @${npc.handle}`;
    if (!Array.isArray(game.contracts)) game.contracts = [];
    game.contracts.push({
      id: `contract-npc-${hash32(`${npc.handle}-${game.worldMinutes}`).toString(16).slice(0, 6)}`,
      title: `${interaction.kind === 'negotiate' ? 'Negotiated' : 'Contracted'} work with @${npc.handle}`,
      clientHandle: npc.handle, clientName: npc.name, pay: interaction.counterAmount || Math.round(120 + npc.skill * 3),
      status: 'open', deadlineWorld: (game.worldMinutes || 0) + 7 * DAY,
      requirements: [`work with @${npc.handle}`], difficulty: 2, description: body, source: 'relationship'
    });
  } else if (interaction.kind === 'review') {
    const project = playerProjects(game)[0];
    if (project) {
      project.issues.push({ id: `issue-${hash32(`${npc.handle}-${game.worldMinutes}`).toString(16).slice(0, 6)}`, title: rng.pick(['unhandled empty input','unclear error message','missing test for edge case']), severity: 'medium', status: 'open', openedBy: npc.handle, openedWorld: game.worldMinutes || 0 });
      body = `I reviewed ${project.name} and filed an issue. The rest looks workable. — @${npc.handle}`;
    } else body = `I do not have anything of yours to review yet. — @${npc.handle}`;
  } else body = `${rng.pick(['Thanks, I have been meaning to reply.','I saw your work on the board.','Let me get back to you after this shift.'])}) — @${npc.handle}`;
  return { type: 'mail', from: npc.handle, subject, body };
}
function fmtSafe(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

function npcInitiated(game, rng) {
  const st = ensureInteraction(game);
  const events = [];
  if (!rng.chance(.16)) return events;
  const mine = playerProjects(game).filter(p => p.published);
  const npcs = (game.npcs || []).filter(n => n.online);
  if (!npcs.length) return events;
  const npc = rng.pick(npcs);
  const rel = getRelationship(game, npc.handle);
  rel.lastContactWorld = game.worldMinutes || 0;
  if (mine.length && rng.chance(.55)) {
    const project = rng.pick(mine);
    const subject = rng.pick([`Question about ${project.name}`, `Issue in ${project.name}`, `Partnership idea`]);
    const body = subject.startsWith('Issue')
      ? `I hit ${rng.pick(['empty input','a stale dependency','a certificate error'])} while using ${project.name}. Could you take a look?`
      : `I follow ${project.name}. Would you be interested in a joint release or a short contract? I can bring users.`;
    events.push({ type: 'mail', from: npc.handle, subject, body });
    events.push({ type: 'feed', text: `@${npc.handle} contacted you about ${project.name}.`, kind: 'info' });
  } else {
    events.push({ type: 'mail', from: npc.handle, subject: 'Professional introduction', body: `${rng.pick(['We are hiring for a short systems job.','I maintain a small library you may find useful.','I saw your work on the market board.'])} Reply if you are interested.` });
  }
  pushEvent(st, 'relationship', `@${npc.handle} initiated contact`, 'An NPC reached out independently.');
  return events;
}

export function relationshipSummary(game) {
  const st = ensureInteraction(game);
  return {
    relationships: st.relationships.slice().sort((a, b) => b.trust - a.trust),
    pending: st.relationships.reduce((s, r) => s + r.interactions.filter(i => i.status === 'pending').length, 0),
    collaborators: st.relationships.filter(r => r.status === 'collaborator').length
  };
}

/* ---------------- server administration ---------------- */
function ownedServer(game, query) {
  const server = (game.servers || []).find(s => s.id === query || s.host === query || s.domain === query);
  if (!server) return { ok: false, error: 'No such server.' };
  if (!server.owned) return { ok: false, error: 'You do not administer that server.' };
  if (!server.admin) server.admin = { firewall: [], dns: [], backups: [], config: {}, packages: [], history: [] };
  return { ok: true, server, admin: server.admin };
}
function adminLog(admin, text, world) {
  admin.history.push({ world, text });
  if (admin.history.length > 60) admin.history.shift();
}

export function serverAdmin(game, query, action, opts = {}) {
  const hit = ownedServer(game, query);
  if (!hit) return hit;
  const { server, admin } = hit;
  const value = opts.value || '';
  const world = game.worldMinutes || 0;
  if (action === 'service') {
    const name = opts.service || value;
    const service = (server.services || []).find(s => s.name.toLowerCase() === String(name).toLowerCase());
    if (!service) return { ok: false, error: `No service '${name}'. Running: ${(server.services || []).map(s => s.name).join(', ')}` };
    const desired = opts.state || opts.subaction || 'restart';
    if (!['start','stop','restart','status'].includes(desired)) return { ok: false, error: 'Use start, stop, restart or status.' };
    if (desired === 'status') return { ok: true, message: `${service.name}: ${service.state} (port ${service.port}, ${service.product} ${service.version})` };
    if (desired === 'stop') service.state = 'stopped';
    else service.state = 'running';
    if ([80,443,8080,8443].includes(service.port) && desired === 'stop') {
      for (const site of (game.sites || []).filter(s => s.serverId === server.id)) site.status = 'offline';
      if (game.internet?.web?.records) for (const record of Object.values(game.internet.web.records)) if (game.sites.find(s => s.id === record.siteId && s.serverId === server.id)) record.status = 'offline';
    } else if ([80,443,8080,8443].includes(service.port) && desired === 'start') {
      for (const site of (game.sites || []).filter(s => s.serverId === server.id)) site.status = 'live';
    }
    adminLog(admin, `${service.name} ${desired}`, world);
    return { ok: true, message: `${service.name} ${desired === 'restart' ? 'restarted' : desired + 'ed'}.`, service };
  }
  if (action === 'user') {
    const sub = opts.subaction || 'list';
    const name = opts.name || value;
    if (sub === 'add') {
      if (!name) return { ok: false, error: 'A user name is required.' };
      if (server.users.some(u => u.user === name)) return { ok: false, error: 'That user already exists.' };
      server.users.push({ user: name, role: 'operator', pass: null, sudo: false });
      adminLog(admin, `added user ${name}`, world);
      return { ok: true, message: `Created local user ${name}.` };
    }
    if (sub === 'remove') {
      server.users = server.users.filter(u => u.user !== name);
      adminLog(admin, `removed user ${name}`, world);
      return { ok: true, message: `Removed local user ${name}.` };
    }
    return { ok: true, message: `Users: ${server.users.map(u => `${u.user}(${u.role})`).join(', ')}` };
  }
  if (action === 'dns') {
    const sub = opts.subaction || 'list';
    if (sub === 'add') {
      if (!value) return { ok: false, error: 'A DNS record value is required.' };
      admin.dns.push({ record: value, world });
      adminLog(admin, `dns add ${value}`, world);
      return { ok: true, message: `Added DNS record ${value}.` };
    }
    if (sub === 'remove') { admin.dns = admin.dns.filter(r => r.record !== value); return { ok: true, message: 'DNS record removed.' }; }
    return { ok: true, message: admin.dns.length ? admin.dns.map(r => r.record).join('\n') : 'No custom DNS records.' };
  }
  if (action === 'firewall') {
    const sub = opts.subaction || 'list';
    const port = Number(opts.port || value) || 0;
    if (sub === 'allow' || sub === 'deny') {
      admin.firewall = admin.firewall.filter(r => r.port !== port);
      admin.firewall.push({ port, policy: sub, world });
      server.security = clamp(server.security + (sub === 'deny' ? 3 : -2), 0, 99);
      adminLog(admin, `firewall ${sub} ${port}`, world);
      return { ok: true, message: `Firewall ${sub === 'allow' ? 'allows' : 'denies'} port ${port}. Security ${Math.round(server.security)}/100.` };
    }
    return { ok: true, message: admin.firewall.length ? admin.firewall.map(r => `${r.port}/tcp ${r.policy}`).join(', ') : 'No custom firewall rules.' };
  }
  if (action === 'backup') {
    if ((opts.subaction || 'create') === 'create') {
      const snapshot = { id: `bkp-${admin.backups.length + 1}`, world, services: JSON.parse(JSON.stringify(server.services || [])), dns: JSON.parse(JSON.stringify(admin.dns)), firewall: JSON.parse(JSON.stringify(admin.firewall)), config: JSON.parse(JSON.stringify(admin.config)), security: server.security };
      admin.backups.push(snapshot);
      if (admin.backups.length > 12) admin.backups.shift();
      adminLog(admin, `backup ${snapshot.id}`, world);
      return { ok: true, message: `${snapshot.id} created.`, backup: snapshot };
    }
    const backup = admin.backups.find(b => b.id === value) || admin.backups.at(-1);
    if (!backup) return { ok: false, error: 'No backup available.' };
    server.services = JSON.parse(JSON.stringify(backup.services));
    admin.dns = JSON.parse(JSON.stringify(backup.dns));
    admin.firewall = JSON.parse(JSON.stringify(backup.firewall));
    admin.config = JSON.parse(JSON.stringify(backup.config));
    server.security = backup.security;
    adminLog(admin, `restored ${backup.id}`, world);
    return { ok: true, message: `Restored ${backup.id}.` };
  }
  if (action === 'config') {
    if (!value) return { ok: true, message: Object.entries(admin.config).map(([k, v]) => `${k}=${v}`).join('\n') || 'No custom configuration.' };
    const [key, ...rest] = String(value).split(/\s+/);
    admin.config[key] = rest.join(' ');
    adminLog(admin, `config ${key}=${admin.config[key]}`, world);
    return { ok: true, message: `${key} set to "${admin.config[key]}".` };
  }
  if (action === 'package') {
    const sub = opts.subaction || 'list';
    if (sub === 'install') {
      admin.packages = admin.packages || [];
      if (!admin.packages.includes(value)) admin.packages.push(value);
      adminLog(admin, `installed ${value}`, world);
      return { ok: true, message: `Installed ${value} on ${server.host}.` };
    }
    return { ok: true, message: (admin.packages || []).join(', ') || 'No extra packages installed.' };
  }
  if (action === 'restart') {
    server.status = 'maintenance';
    adminLog(admin, 'restart requested', world);
    setTimeoutNoop();
    server.status = 'online';
    return { ok: true, message: `${server.host} restarted. Services checked.` };
  }
  return { ok: false, error: `Unknown administration action '${action}'. Try: service, user, dns, firewall, backup, config, package, restart` };
}
function setTimeoutNoop() { /* restart is simulated as an immediate state transition */ }

/* ---------------- finance ---------------- */
export function issueInvoice(game, client, amount, dueDays = 14) {
  const st = ensureInteraction(game);
  const value = Math.round(Number(amount) || 0);
  if (value < 1) return { ok: false, error: 'Invoice amount must be positive.' };
  const invoice = {
    id: nextId(st, 'invoice'), client: String(client || 'client').slice(0, 60), amount: value,
    issuedWorld: game.worldMinutes || 0, dueWorld: (game.worldMinutes || 0) + clamp(dueDays, 1, 90) * DAY,
    status: 'sent', paidWorld: null
  };
  st.invoices.push(invoice);
  bounded(st.invoices, caps.invoices);
  pushEvent(st, 'finance', `Invoice ${invoice.id} sent to ${invoice.client}`, `${fmtSafe(value)} due in ${dueDays} days.`);
  return { ok: true, invoice };
}

export function payInvoice(game, id) {
  const st = ensureInteraction(game);
  const invoice = st.invoices.find(i => i.id === id);
  if (!invoice) return { ok: false, error: 'No such invoice.' };
  if (invoice.status === 'paid') return { ok: false, error: 'That invoice is already paid.' };
  if (!spend(game, invoice.amount, `invoice ${invoice.id}`)) return { ok: false, error: 'Insufficient funds.' };
  invoice.status = 'paid';
  invoice.paidWorld = game.worldMinutes || 0;
  return { ok: true, invoice };
}
export function collectInvoice(game, id) {
  const st = ensureInteraction(game);
  const invoice = st.invoices.find(i => i.id === id);
  if (!invoice) return { ok: false, error: 'No such invoice.' };
  if (invoice.status !== 'sent' && invoice.status !== 'overdue') return { ok: false, error: 'That invoice is settled.' };
  earn(game, invoice.amount, `invoice ${invoice.id} settled`);
  invoice.status = 'paid';
  invoice.paidWorld = game.worldMinutes || 0;
  if (game.player.reputation != null) game.player.reputation = clamp(game.player.reputation + 1, 0, 100);
  return { ok: true, invoice };
}

export function transferFunds(game, handle, amount, memo) {
  const value = Math.round(Number(amount) || 0);
  if (value < 1) return { ok: false, error: 'Transfer amount must be positive.' };
  if (!spend(game, value, `transfer to @${handle}: ${memo || ''}`)) return { ok: false, error: 'Insufficient funds.' };
  return { ok: true, message: `Transferred ${fmtSafe(value)} to @${handle}.`, notification: { type: 'mail', from: game.player.handle, to: handle, subject: 'Payment received', body: `${fmtSafe(value)} — ${memo || 'no memo'}` } };
}

export function placeOrder(game, side, asset, qty, price) {
  const st = ensureInteraction(game);
  if (!['buy','sell'].includes(side)) return { ok: false, error: 'Side must be buy or sell.' };
  const units = clamp(Math.round(Number(qty) || 1), 1, 100000);
  const limit = Math.max(1, Math.round(Number(price) || game.market?.index || 1000));
  const cost = Math.round(units * limit * 1.001);
  if (side === 'buy' && !spend(game, cost, `order ${side} ${asset}`)) return { ok: false, error: `Escrow requires ${fmtSafe(cost)}.` };
  const order = {
    id: nextId(st, 'order'), side, asset: String(asset || 'IDX').slice(0, 12).toUpperCase(),
    qty: units, limit, filled: 0, status: 'open', placedWorld: game.worldMinutes || 0, escrow: side === 'buy' ? cost : 0
  };
  st.orders.push(order);
  bounded(st.orders, caps.orders);
  return { ok: true, order };
}

export function cancelOrder(game, id) {
  const st = ensureInteraction(game);
  const order = st.orders.find(o => o.id === id);
  if (!order || order.status !== 'open') return { ok: false, error: 'No open order with that id.' };
  if (order.escrow && order.filled < order.qty) earn(game, Math.round(order.escrow * (1 - order.filled / order.qty)), `cancel order ${order.id}`);
  order.status = 'cancelled';
  return { ok: true, order };
}

function tickFinance(game, rng) {
  const st = ensureInteraction(game);
  const events = [];
  const price = Number(game.market?.index) || 1000;
  for (const order of st.orders) {
    if (order.status !== 'open' && order.status !== 'partial') continue;
    const crosses = order.side === 'buy' ? price <= order.limit : price >= order.limit;
    if (!crosses) continue;
    const fill = Math.max(1, Math.round(order.qty * rng.float(.18, .7)));
    const remaining = order.qty - order.filled - fill;
    order.filled += fill;
    const notional = Math.round(fill * price);
    if (order.side === 'sell') earn(game, notional, `order ${order.id} fill`);
    else {
      let holding = st.portfolio.find(p => p.asset === order.asset);
      if (!holding) { holding = { id: nextId(st, 'portfolio'), asset: order.asset, qty: 0, avgPrice: price }; st.portfolio.push(holding); bounded(st.portfolio, caps.portfolio); }
      holding.avgPrice = Math.round((holding.avgPrice * holding.qty + notional) / Math.max(1, holding.qty + fill));
      holding.qty += fill;
    }
    order.status = remaining <= 0 ? 'filled' : 'partial';
    events.push({ type: 'feed', text: `Order ${order.id} filled ${fill} ${order.asset} at ${price}.`, kind: 'good' });
    pushEvent(st, 'finance', `Order ${order.id} ${order.status}`, `${fill} ${order.asset} at ${price}.`);
  }
  for (const invoice of st.invoices) {
    if (invoice.status === 'sent' && game.worldMinutes > invoice.dueWorld) invoice.status = 'overdue';
  }
  events.push(...npcInitiated(game, rng));
  return events;
}

export function financeSummary(game) {
  const st = ensureInteraction(game);
  const price = Number(game.market?.index) || 1000;
  const holdings = st.portfolio.map(p => ({ ...p, value: p.qty * price, pnl: p.qty * (price - p.avgPrice) }));
  return {
    invoices: st.invoices.slice().reverse(),
    orders: st.orders.slice().reverse(),
    holdings,
    receivable: st.invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0),
    payable: st.invoices.filter(i => i.status === 'received').reduce((s, i) => s + i.amount, 0),
    portfolioValue: holdings.reduce((s, h) => s + h.value, 0)
  };
}

/* ---------------- aggregate tick ---------------- */
function advanceBucket(st, key, interval, world, max = 6) {
  const bucket = Math.floor(world / interval);
  const prev = st.cadence[key] || 0;
  if (bucket <= prev) return 0;
  const steps = Math.min(max, bucket - prev);
  st.cadence[key] = prev + steps;
  return steps;
}

export function recomputeInteractionMetrics(game, st = ensureInteraction(game)) {
  st.metrics = {
    runningOperations: st.operations.filter(o => o.status === 'running').length,
    completedOperations: st.operations.filter(o => o.status === 'done').length,
    failedOperations: st.operations.filter(o => o.status === 'failed' || o.status === 'cancelled').length,
    relationships: st.relationships.length,
    pendingReplies: st.relationships.reduce((s, r) => s + r.interactions.filter(i => i.status === 'pending').length, 0),
    openInvoices: st.invoices.filter(i => i.status === 'sent' || i.status === 'overdue').length,
    openOrders: st.orders.filter(o => o.status === 'open' || o.status === 'partial').length,
    hardwareHealth: Math.round(st.hardware.health),
    temperature: Math.round(st.hardware.temperature)
  };
  return st.metrics;
}

export function tickInteraction(game, minutes = 1, rng = null) {
  const st = ensureInteraction(game);
  rng = rng || irng(game, 0xc0de);
  st.worldMinutes = game.worldMinutes || 0;
  const events = [];
  for (const op of tickOperations(game, minutes, rng)) events.push(op);
  if (advanceBucket(st, 'hardware', 60, game.worldMinutes || 0, 60)) events.push(...tickHardware(game, minutes, rng));
  for (let step = 0; step < advanceBucket(st, 'relationships', 120, game.worldMinutes || 0, 12); step++) events.push(...tickRelationships(game, rng));
  for (let step = 0; step < advanceBucket(st, 'finance', 240, game.worldMinutes || 0, 8); step++) events.push(...tickFinance(game, rng));
  recomputeInteractionMetrics(game, st);
  return events;
}

export function interactionOverview(game) {
  const st = ensureInteraction(game);
  return {
    st, metrics: recomputeInteractionMetrics(game, st), hardware: hardwareSummary(game),
    operations: operationSummary(game), relationships: relationshipSummary(game).relationships,
    finance: financeSummary(game), events: st.events.slice().reverse()
  };
}
