/* Cloud infrastructure, container orchestration, AI agents and organization economics.
   Pure simulation helpers: this module never imports world.js, so the world tick can
   call it without a circular dependency. Events are returned as plain descriptors and
   applied by the caller. */
import { makeRng, clamp, fmtMoney, fmtNum } from './util.js';
import {
  CLOUD_PROVIDERS, CLOUD_PLANS, CONTAINER_IMAGES, AGENT_MODELS, AGENT_ROLES,
  AGENT_TASKS, PRODUCT_TEMPLATES, ORG_EVENTS
} from './data.js';

const DAY = 1440;
const clone = v => JSON.parse(JSON.stringify(v));
const AGENT_NAMES = ['Aster','Bramble','Cinder','Delta','Echo','Fable','Garnet','Hollow','Iris','Juniper','Kite','Lumen','Morrow','Nix','Orbit','Pike','Quill','Rune','Sable','Tessera','Umber','Vesper','Wren','Yarrow','Zephyr'];

/* ---------------- revival + generation ---------------- */
export function ensureSystems(game) {
  if (!game.cloud || typeof game.cloud !== 'object') game.cloud = {};
  const c = game.cloud;
  if (!Array.isArray(c.providers) || !c.providers.length) c.providers = clone(CLOUD_PROVIDERS);
  for (const p of c.providers) {
    if (p.status === undefined) p.status = 'operational';
    if (p.incidentUntil === undefined) p.incidentUntil = 0;
  }
  if (!Array.isArray(c.instances)) c.instances = [];
  if (!Array.isArray(c.containers)) c.containers = [];
  if (!Array.isArray(c.clusters)) c.clusters = [];
  if (!Array.isArray(c.buckets)) c.buckets = [];
  if (!Array.isArray(c.images) || !c.images.length) c.images = CONTAINER_IMAGES.map(i => i.name);
  if (typeof c.spend !== 'number') c.spend = 0;
  if (typeof c.usage !== 'number') c.usage = 0;
  if (!Array.isArray(game.agents)) game.agents = [];
  if (!Array.isArray(game.products)) game.products = [];
  game.seq = game.seq || {};
  for (const key of ['agent','product','container','cluster','bucket','company','cloud']) {
    if (typeof game.seq[key] !== 'number') game.seq[key] = 1;
  }
  for (const co of game.companies || []) {
    if (co.status === undefined) co.status = 'operating';
    if (typeof co.funds !== 'number') co.funds = 0;
    if (typeof co.revenue !== 'number') co.revenue = 0;
    if (typeof co.burn !== 'number') co.burn = Math.round((co.employees || 10) * 1000);
    if (co.ownerType === 'player' && co.burn > 400) {
      co.burn = 180;
      if (co.funds < 0) co.funds = 0;
      if (co.status === 'distressed') co.status = 'operating';
      co.history = co.history || [];
      co.history.unshift({ world: game.worldMinutes, text: 'Operating costs corrected to a single-operator budget.' });
    }
    if (co.ownerType === 'player' && co.status === 'failed') {
      co.status = 'operating';
      co.funds = 0;
      for (const p of game.products || []) if (p.companyId === co.id) p.status = 'live';
      co.history = co.history || [];
      co.history.unshift({ world: game.worldMinutes, text: 'Operations restored under operator control.' });
    }
    if (typeof co.morale !== 'number') co.morale = 62;
    if (!Array.isArray(co.products)) co.products = [];
    if (!co.ownerType) co.ownerType = 'npc';
    if (!Array.isArray(co.history)) co.history = [];
  }
  return game;
}

export function buildSystems(game, rng = null) {
  ensureSystems(game);
  rng = rng || makeRng((game.seed ^ 0x5f3759df) >>> 0);
  const usedNames = new Set();

  for (const co of game.companies) {
    co.burn = Math.round((co.employees || 10) * rng.float(820, 1240) + (co.security || 50) * 90);
    co.morale = rng.int(46, 84);
    co.revenue = 0;
    co.products = [];
    co.status = co.sector === 'legacy' ? 'distressed' : 'operating';
    co.history = [{ world: game.worldMinutes, text: `${co.name} is operating in ${co.hq}.` }];

    const target = (co.employees || 10) * rng.float(1150, 2450) * (co.sector === 'legacy' ? .35 : 1);
    const count = clamp(Math.round((co.employees || 10) / 180) + 1, 1, 3);
    const templates = rng.picks(PRODUCT_TEMPLATES.filter(t => productFitsSector(t.category, co.sector)), count);
    const picks = templates.length ? templates : rng.picks(PRODUCT_TEMPLATES, count);
    for (let i = 0; i < picks.length; i++) {
      const t = picks[i];
      const price = Math.max(3, Math.round(t.price * rng.float(.7, 1.35)));
      const subs = Math.max(4, Math.round((target * (1 / picks.length)) / price * rng.float(.55, 1.15)));
      const product = {
        id: `prod-${String(game.seq.product++).padStart(4, '0')}`,
        companyId: co.id, name: `${co.name.split(' ')[0]} ${t.name}`,
        category: t.category, price, subscribers: subs,
        rating: rng.float(3.1, 4.8), growth: rng.float(-.0016, .0032),
        churn: rng.float(.0008, .004), status: 'live', desc: t.desc,
        launchedWorld: game.worldMinutes - rng.int(30, 900) * DAY,
        pendingRevenue: 0, pendingCost: 0
      };
      game.products.push(product);
      co.products.push(product.id);
    }

    const agentCount = co.employees > 500 ? 2 : 1;
    for (let i = 0; i < agentCount; i++) {
      const role = pickRoleForSector(rng, co.sector);
      const model = pickModelForCompany(rng, co);
      const name = agentName(rng, usedNames, co);
      game.agents.push(makeAgent(game, {
        name, ownerType: 'company', ownerId: co.id, ownerName: co.name,
        roleId: role.id, modelId: model.id, serverId: null,
        budget: Math.round(rng.float(180, 4200)), efficiency: rng.float(.84, 1.14),
        tasksDone: rng.int(12, 1400), createdAt: Date.now() - rng.int(20, 500) * 86400000
      }));
    }
  }

  for (let i = 0; i < 4; i++) {
    const role = rng.pick(AGENT_ROLES);
    const model = rng.pick(AGENT_MODELS);
    game.agents.push(makeAgent(game, {
      name: agentName(rng, usedNames, null), ownerType: 'independent', ownerId: null,
      ownerName: 'independent operator', roleId: role.id, modelId: model.id,
      budget: Math.round(rng.float(20, 300)), efficiency: rng.float(.7, 1.1),
      tasksDone: rng.int(3, 260), createdAt: Date.now() - rng.int(5, 240) * 86400000
    }));
  }
  return game;
}

function productFitsSector(category, sector) {
  if (sector === 'cloud' || sector === 'hosting' || sector === 'infrastructure') return ['hosting','monitoring','dns','devtools'].includes(category);
  if (sector === 'security') return ['security','monitoring','devtools'].includes(category);
  if (sector === 'software' || sector === 'research') return ['devtools','ai','data','observability'].includes(category);
  if (sector === 'media') return ['data','messaging'].includes(category);
  if (sector === 'commerce') return ['messaging','hosting','data'].includes(category);
  return true;
}
function pickRoleForSector(rng, sector) {
  const map = {
    security: ['security','monitor'], cloud: ['monitor','support'], hosting: ['monitor','support'],
    software: ['developer','support'], research: ['research','analyst'], media: ['research','support'],
    commerce: ['support','sales'], finance: ['analyst','security'], government: ['security','analyst'],
    community: ['monitor','support'], consulting: ['analyst','security'], legacy: ['monitor','support'],
    infrastructure: ['monitor','security'], logistics: ['analyst','monitor'], manufacturing: ['monitor','support'],
    design: ['support','research'], data: ['analyst','research']
  };
  const ids = map[sector] || ['support','monitor'];
  return AGENT_ROLES.find(r => r.id === rng.pick(ids)) || rng.pick(AGENT_ROLES);
}
function pickModelForCompany(rng, co) {
  if (co.sector === 'community' || co.employees < 30) return rng.chance(.65) ? AGENT_MODELS.find(m => m.id === 'local-7b') : AGENT_MODELS.find(m => m.id === 'kestrel-mini');
  if (co.sector === 'security') return rng.chance(.7) ? AGENT_MODELS.find(m => m.id === 'vanta-guard') : AGENT_MODELS.find(m => m.id === 'atlas-reason');
  if (co.sector === 'research' || co.sector === 'data') return rng.chance(.55) ? AGENT_MODELS.find(m => m.id === 'atlas-reason') : AGENT_MODELS.find(m => m.id === 'nimbus-3');
  return rng.chance(.55) ? AGENT_MODELS.find(m => m.id === 'nimbus-3') : AGENT_MODELS.find(m => m.id === 'kestrel-mini');
}
function agentName(rng, used, co) {
  for (let i = 0; i < 40; i++) {
    const base = rng.pick(AGENT_NAMES);
    const name = `${base}-${rng.int(2, 99)}`;
    if (!used.has(name)) { used.add(name); return name; }
  }
  return `agent-${rng.hex(4)}`;
}
function makeAgent(game, opts) {
  const role = AGENT_ROLES.find(r => r.id === opts.roleId) || AGENT_ROLES[0];
  const model = AGENT_MODELS.find(m => m.id === opts.modelId) || AGENT_MODELS[0];
  return {
    id: `agent-${String(game.seq.agent++).padStart(4, '0')}`,
    name: opts.name, ownerType: opts.ownerType, ownerId: opts.ownerId || null,
    ownerName: opts.ownerName || 'independent', roleId: role.id, modelId: model.id,
    status: 'active', serverId: opts.serverId || null, siteId: opts.siteId || null,
    budget: opts.budget ?? 100, spend: 0, tasksDone: opts.tasksDone || 0,
    efficiency: opts.efficiency || 1, pendingRevenue: 0, pendingCost: 0,
    createdAt: opts.createdAt || Date.now(), lastTaskWorld: game.worldMinutes,
    memory: [{ world: game.worldMinutes, text: `Started as ${role.name} using ${model.name}.` }],
    capabilities: role.id === 'developer' ? ['read:code','write:code','run:tests'] :
      role.id === 'security' ? ['read:logs','read:policy','open:incident'] :
      role.id === 'support' ? ['read:tickets','draft:reply','escalate'] :
      role.id === 'monitor' ? ['read:metrics','read:logs','open:incident'] :
      role.id === 'sales' ? ['read:crm','draft:message'] : ['read:docs','draft:report'],
    permissions: ['no:external-write','no:payment','human-review:high-impact'],
    objectives: [role.desc, 'Escalate anything that cannot be verified.', 'Stay inside the assigned budget.']
  };
}

/* ---------------- lookups ---------------- */
export function findProvider(game, query) {
  const q = String(query || '').toLowerCase();
  return (game.cloud?.providers || []).find(p => p.id === q || p.name.toLowerCase() === q || p.domain === q);
}
export function findPlan(query) {
  const q = String(query || '').toLowerCase();
  return CLOUD_PLANS.find(p => p.id === q || p.name.toLowerCase() === q || p.name.toLowerCase().startsWith(q));
}
export function cloudPrice(plan, provider) { return Math.max(3, Math.round(plan.price * provider.factor)); }
export function cloudLaunchItem(plan, provider) {
  return {
    id: plan.id, name: `${provider.name} ${plan.name}`, price: cloudPrice(plan, provider),
    kind: 'infra', recurring: true, desc: plan.desc,
    server: { cpu: plan.cpu, ram: plan.ram, disk: plan.disk }
  };
}
export function attachCloudInstance(game, server, plan, provider, region) {
  const inst = {
    id: `cloud-${String(game.seq.cloud++).padStart(4, '0')}`,
    serverId: server.id, providerId: provider.id, planId: plan.id, region,
    monthly: cloudPrice(plan, provider), createdAt: game.worldMinutes,
    status: 'running', gpu: !!plan.gpu
  };
  server.provider = provider.id; server.region = region; server.plan = plan.id;
  server.monthly = inst.monthly; server.gpu = !!plan.gpu;
  server.tags = [...new Set([...(server.tags || []), 'cloud', provider.id])];
  game.cloud.instances.push(inst);
  return inst;
}
export function findCloudInstance(game, query) {
  const q = String(query || '').toLowerCase();
  return (game.cloud?.instances || []).find(i => i.id.toLowerCase() === q || i.serverId.toLowerCase() === q ||
    game.servers.find(s => s.id === i.serverId)?.host === q);
}
export function removeCloudInstance(game, inst) {
  const idx = game.cloud.instances.indexOf(inst);
  if (idx >= 0) game.cloud.instances.splice(idx, 1);
  const sIdx = game.servers.findIndex(s => s.id === inst.serverId);
  if (sIdx >= 0) game.servers.splice(sIdx, 1);
  game.cloud.containers = game.cloud.containers.filter(c => c.serverId !== inst.serverId);
  for (const cl of game.cloud.clusters) cl.nodeIds = cl.nodeIds.filter(id => id !== inst.serverId);
}
export function playerCloudServers(game) {
  const ids = new Set((game.cloud?.instances || []).map(i => i.serverId));
  return game.servers.filter(s => ids.has(s.id));
}

export function imageInfo(name) {
  const q = String(name || '').toLowerCase();
  return CONTAINER_IMAGES.find(i => i.name === q || i.name.split(':')[0] === q || i.name.startsWith(q + ':'));
}
export function findContainer(game, query) {
  const q = String(query || '').toLowerCase();
  return (game.cloud?.containers || []).find(c => c.id.toLowerCase() === q || c.name.toLowerCase() === q || c.id.endsWith(q));
}
export function runContainer(game, opts) {
  const server = game.servers.find(s => s.id === opts.serverId);
  if (!server) return { ok: false, error: 'No host selected.' };
  if (!server.owned) return { ok: false, error: 'That host is not yours.' };
  if (server.status === 'offline') return { ok: false, error: `${server.host} is offline.` };
  const image = imageInfo(opts.image);
  if (!image) return { ok: false, error: `Unable to find image '${opts.image}' locally.` };
  if (!game.cloud.images.includes(image.name)) game.cloud.images.push(image.name);
  const running = game.cloud.containers.filter(c => c.serverId === server.id && c.status === 'running');
  const usedRam = running.reduce((s, c) => s + (c.ram || 0), 0);
  if (usedRam + image.ram > server.ram) return { ok: false, error: `Host memory exhausted (${usedRam.toFixed(1)}/${server.ram} GB in use).` };
  const id = `ctr-${String(game.seq.container++).padStart(5, '0')}`;
  const name = (opts.name || `${image.service}-${id.slice(-4)}`).replace(/[^a-zA-Z0-9_.-]/g, '-');
  if (game.cloud.containers.some(c => c.name === name)) return { ok: false, error: `Conflict. The container name "/${name}" is already in use.` };
  const container = {
    id, name, image: image.name, service: image.service, serverId: server.id,
    port: opts.port || image.port, status: 'running', restartPolicy: opts.restart || 'always',
    ram: image.ram, cpu: image.cpu, requests: 0, revenue: 0, uptime: 0, restarts: 0,
    createdWorld: game.worldMinutes, createdAt: Date.now(), env: opts.env || [],
    logs: [`${new Date().toISOString()} starting ${image.name}`]
  };
  game.cloud.containers.push(container);
  server.tags = [...new Set([...server.tags, image.service])];
  return { ok: true, container, server, image };
}
export function stopContainer(container) {
  if (container.status === 'exited') return { ok: false, error: `Container ${container.name} is not running.` };
  container.status = 'exited';
  container.logs.push(`${new Date().toISOString()} stopped by operator`);
  return { ok: true, container };
}
export function startContainer(game, container) {
  const server = game.servers.find(s => s.id === container.serverId);
  if (!server) return { ok: false, error: 'Container host no longer exists.' };
  if (server.status === 'offline') return { ok: false, error: `${server.host} is offline.` };
  container.status = 'running';
  container.logs.push(`${new Date().toISOString()} started by operator`);
  return { ok: true, container, server };
}
export function removeContainer(game, container) {
  const idx = game.cloud.containers.indexOf(container);
  if (idx >= 0) game.cloud.containers.splice(idx, 1);
  return { ok: true };
}
export function containerLogs(container, lines = 12) {
  return container.logs.slice(-lines);
}

/* ---------------- clusters ---------------- */
export function createCluster(game, opts) {
  const nodes = (opts.nodeIds || []).map(id => game.servers.find(s => s.id === id || s.host === id)).filter(Boolean);
  if (!nodes.length) return { ok: false, error: 'A cluster needs at least one node.' };
  if (nodes.some(n => !n.owned)) return { ok: false, error: 'All cluster nodes must be yours.' };
  const name = String(opts.name || `cluster-${game.seq.cluster}`).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (game.cloud.clusters.some(c => c.name === name)) return { ok: false, error: `Cluster '${name}' already exists.` };
  const cluster = {
    id: `k8s-${String(game.seq.cluster++).padStart(3, '0')}`, name, version: 'v1.31.2',
    nodeIds: nodes.map(n => n.id), workloads: [], status: 'healthy',
    createdWorld: game.worldMinutes, createdAt: Date.now(), ownerType: 'player'
  };
  game.cloud.clusters.push(cluster);
  return { ok: true, cluster, nodes };
}
export function findCluster(game, query) {
  const q = String(query || '').toLowerCase();
  return (game.cloud?.clusters || []).find(c => c.id.toLowerCase() === q || c.name === q);
}
export function applyWorkload(game, cluster, manifest) {
  const name = manifest.name || manifest.metadata?.name;
  const imageName = manifest.image;
  if (!name) return { ok: false, error: 'manifest has no metadata.name' };
  const image = imageInfo(imageName);
  if (!image) return { ok: false, error: `image '${imageName}' is not available in the local registry` };
  let w = cluster.workloads.find(x => x.name === name);
  const replicas = clamp(Number(manifest.replicas) || 1, 1, 20);
  if (w) { w.image = image.name; w.replicas = replicas; }
  else {
    w = { name, kind: manifest.kind || 'Deployment', image: image.name, replicas, service: image.service, port: image.port, running: replicas, restarts: 0, createdWorld: game.worldMinutes };
    cluster.workloads.push(w);
  }
  return { ok: true, workload: w };
}
export function scaleWorkload(cluster, name, replicas) {
  const w = cluster.workloads.find(x => x.name === name);
  if (!w) return { ok: false, error: `deployment.apps/${name} not found` };
  w.replicas = clamp(Number(replicas) || 1, 1, 20);
  return { ok: true, workload: w };
}
export function clusterPods(game, cluster) {
  const nodes = cluster.nodeIds.map(id => game.servers.find(s => s.id === id)).filter(Boolean);
  const online = nodes.filter(n => n.status !== 'offline');
  const pods = [];
  for (const w of cluster.workloads) {
    const capacity = Math.max(1, online.length * 4);
    const running = Math.min(w.replicas, capacity);
    for (let i = 0; i < w.replicas; i++) {
      const node = online[i % Math.max(1, online.length)];
      pods.push({
        name: `${w.name}-${String(i + 1).padStart(2, '0')}`, workload: w.name, image: w.image,
        status: i < running ? 'Running' : 'Pending', node: node?.host || 'none', restarts: w.restarts || 0
      });
    }
  }
  return pods;
}

/* ---------------- AI agents ---------------- */
export function agentModel(id) { return AGENT_MODELS.find(m => m.id === id) || AGENT_MODELS[0]; }
export function agentRole(id) { return AGENT_ROLES.find(r => r.id === id) || AGENT_ROLES[0]; }
export function findAgent(game, query) {
  const q = String(query || '').toLowerCase();
  return (game.agents || []).find(a => a.id.toLowerCase() === q || a.name.toLowerCase() === q || a.name.toLowerCase().startsWith(q));
}
export function deployAgent(game, opts) {
  const role = agentRole(opts.roleId);
  const model = agentModel(opts.modelId);
  const server = opts.serverId ? game.servers.find(s => s.id === opts.serverId || s.host === opts.serverId) : null;
  if (!server) return { ok: false, error: 'An agent needs a host. Provision a server or cloud instance first.' };
  if (!server.owned) return { ok: false, error: 'That host is not yours.' };
  if (server.status === 'offline') return { ok: false, error: `${server.host} is offline.` };
  if (model.id === 'local-7b' && !server.gpu) return { ok: false, error: 'Local 7B needs a GPU node. Launch one with: cloud launch cloud-gpu' };
  const fee = 45;
  if (game.player.money < fee) return { ok: false, error: `Agent deployment costs ${fmtMoney(fee)}.` };
  const name = String(opts.name || `${role.id}-${game.seq.agent}`).replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 28);
  if (game.agents.some(a => a.ownerType === 'player' && a.name === name)) return { ok: false, error: `You already run an agent named ${name}.` };
  game.player.money -= fee;
  game.stats.spent += fee;
  game.player.transactions.unshift({ time: Date.now(), amount: -fee, memo: `agent deployment ${name}`, balance: game.player.money });
  const agent = makeAgent(game, {
    name, ownerType: 'player', ownerId: 'player', ownerName: 'operator',
    roleId: role.id, modelId: model.id, serverId: server.id, siteId: opts.siteId || null,
    budget: opts.budget || 200, efficiency: 1
  });
  agent.capabilities = [...agent.capabilities, 'host:' + server.host];
  game.agents.push(agent);
  return { ok: true, agent, server, role, model, fee };
}
export function setAgentStatus(agent, status) {
  if (!['active','paused','stopped'].includes(status)) return { ok: false, error: 'status must be active, paused or stopped' };
  agent.status = status;
  agent.memory.push({ world: 0, text: `Operator set status to ${status}.` });
  return { ok: true, agent };
}
export function assignAgent(game, agent, siteQuery) {
  const site = game.sites.find(s => s.domain === siteQuery || s.id === siteQuery);
  if (!site) return { ok: false, error: `No site matching '${siteQuery}'.` };
  if (site.ownerType !== 'player') return { ok: false, error: 'That site is not yours.' };
  agent.siteId = site.id;
  agent.memory.push({ world: game.worldMinutes, text: `Assigned to ${site.domain}.` });
  return { ok: true, agent, site };
}
export function agentDailyRevenue(agent) {
  const role = agentRole(agent.roleId);
  const model = agentModel(agent.modelId);
  return role.revenue * (model.skill / 70) * (agent.efficiency || 1);
}
export function agentDailyCost(agent) {
  const model = agentModel(agent.modelId);
  return model.cost / 30;
}

/* ---------------- player companies ---------------- */
export function playerCompany(game) {
  return (game.companies || []).find(c => c.ownerType === 'player' || c.ownerId === 'player');
}
export function registerCompany(game, name) {
  if (playerCompany(game)) return { ok: false, error: 'You already operate a company.' };
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (clean.length < 2 || clean.length > 42) return { ok: false, error: 'Company name must be 2–42 characters.' };
  const fee = 250;
  if (game.player.money < fee) return { ok: false, error: `Registration costs ${fmtMoney(fee)}.` };
  game.player.money -= fee;
  game.stats.spent += fee;
  game.player.transactions.unshift({ time: Date.now(), amount: -fee, memo: `company registration ${clean}`, balance: game.player.money });
  const domain = `${clean.toLowerCase().replace(/[^a-z0-9]+/g, '')}.operator.host`;
  const co = {
    id: `co-${String(game.seq.company++).padStart(3, '0')}`, name: clean, domain,
    sector: 'software', size: 1, employees: 1, security: 55, funds: 0,
    desc: `${clean} — an independent technology company operated by one person and whatever agents they trust.`,
    rep: game.player.reputation, founded: 2026, serverIds: [], siteId: null, ceoId: null,
    status: 'operating', projects: ['first product'], hq: 'operator workspace',
    revenue: 0, burn: 180, morale: 75, products: [], ownerType: 'player', ownerId: 'player',
    history: [{ world: game.worldMinutes, text: `${clean} registered by operator.` }]
  };
  game.companies.push(co);
  return { ok: true, company: co, fee };
}
export function launchProduct(game, company, templateName) {
  if (!company) return { ok: false, error: 'No company. Register one with: company register <name>' };
  if (company.ownerType !== 'player') return { ok: false, error: 'You do not control that company.' };
  const templates = PRODUCT_TEMPLATES.filter(t => !templateName || t.name.toLowerCase() === String(templateName).toLowerCase() || t.category === String(templateName).toLowerCase());
  const t = templates[0] || PRODUCT_TEMPLATES[0];
  if (company.products.length >= 8) return { ok: false, error: 'Product portfolio is full. Retire something first.' };
  const fee = 150;
  if (game.player.money < fee) return { ok: false, error: `Launching a product costs ${fmtMoney(fee)}.` };
  // Durable products consume real supply-chain capacity. A constrained
  // component market raises the launch cost and can block production entirely.
  const supply = game.civ?.supply;
  if (supply?.components) {
    const componentId = t.category === 'ai' ? 'semiconductor' : t.category === 'hosting' || t.category === 'monitoring' || t.category === 'dns' ? 'network-chip' : 'circuit-board';
    const component = supply.components[componentId];
    if (component) {
      if ((component.availability || 0) < 16) return { ok: false, error: `${component.name} supply is constrained (${Math.round(component.availability)}% availability). Wait for factories to recover.` };
      component.stock = Math.max(0, (component.stock || 0) - 8);
      component.demand = clamp(component.demand + 2, 0, 100);
    }
  }
  const hardwareMultiplier = clamp((supply?.hardwareIndex || 100) / 100, .6, 2.4);
  const launchCost = Math.max(fee, Math.round(fee * hardwareMultiplier));
  if (game.player.money < launchCost) return { ok: false, error: `Launching a product costs ${fmtMoney(launchCost)} at current component prices.` };
  game.player.money -= launchCost;
  game.stats.spent += launchCost;
  game.player.transactions.unshift({ time: Date.now(), amount: -launchCost, memo: `product launch ${t.name}`, balance: game.player.money });
  const product = {
    id: `prod-${String(game.seq.product++).padStart(4, '0')}`,
    companyId: company.id, name: `${company.name} ${t.name}`, category: t.category,
    price: t.price,
    subscribers: clamp(2 + Math.round((game.player.reputation || 0) / 6), 2, 14),
    rating: 3.6, growth: .001, churn: .002,
    status: 'live', desc: t.desc, launchedWorld: game.worldMinutes,
    pendingRevenue: 0, pendingCost: 0
  };
  game.products.push(product);
  company.products.push(product.id);
  company.history.unshift({ world: game.worldMinutes, text: `Launched ${product.name}.` });
  return { ok: true, product, template: t, fee };
}
export function companyValuation(co) {
  if (!co) return 0;
  const mrr = (co.revenue || 0);
  const multiple = co.status === 'failed' ? 0 : co.status === 'distressed' ? 8 : 18;
  return Math.round(Math.max(0, co.funds) + mrr * multiple);
}

/* ---------------- the tick ---------------- */
export function tickSystems(game, minutes, rng) {
  ensureSystems(game);
  const events = [];
  const day = minutes / DAY;
  const c = game.cloud;

  // cloud providers: rare incidents and recoveries
  for (const p of c.providers) {
    if (p.incidentUntil && game.worldMinutes >= p.incidentUntil) {
      p.incidentUntil = 0; p.status = 'operational';
      events.push({ type: 'feed', text: `${p.name} reports recovery after a regional incident.`, kind: 'info' });
    }
    if (!p.incidentUntil && rng.chance(Math.min(.25, .00035 * minutes))) {
      p.status = 'degraded'; p.incidentUntil = game.worldMinutes + rng.int(25, 180);
      events.push({ type: 'news', headline: `${p.name} reports degraded service in ${rng.pick(p.regions)}`, body: 'Customers describe elevated latency and intermittent API errors. The provider has not published a root cause.', source: 'The Packet' });
      events.push({ type: 'feed', text: `${p.name} is degraded in ${rng.pick(p.regions)}.`, kind: 'warn' });
    }
  }

  // containers on player infrastructure
  for (const ctr of c.containers) {
    const server = game.servers.find(s => s.id === ctr.serverId);
    if (!server) { ctr.status = 'exited'; ctr.logs.push('host removed'); continue; }
    if (server.status === 'offline') {
      if (ctr.status === 'running') { ctr.status = 'exited'; ctr.restarts++; ctr.logs.push(`${new Date().toISOString()} host went offline`); }
      continue;
    }
    if (ctr.status === 'exited' && ctr.restartPolicy === 'always') {
      ctr.status = 'running'; ctr.restarts++;
      ctr.logs.push(`${new Date().toISOString()} restarted after host recovery`);
    }
    if (ctr.status === 'running') {
      ctr.uptime += minutes;
      const load = ctr.service === 'web' ? rng.float(1, 8) : ctr.service === 'db' ? rng.float(.3, 3) : rng.float(.1, 2);
      ctr.requests += Math.round(load * minutes);
      if (ctr.service === 'web' && rng.chance(Math.min(.5, .01 * minutes))) {
        const site = game.sites.find(s => s.serverId === server.id && s.status === 'live');
        if (site) site.visits += rng.int(1, 6);
      }
      if (rng.chance(Math.min(.35, .004 * minutes))) ctr.logs.push(`${new Date().toISOString()} ${rng.pick(['GET / 200','GET /health 200','POST /api 201','GET /static/app.js 200','upstream timeout, retrying','cache miss'])}`);
      if (ctr.logs.length > 60) ctr.logs = ctr.logs.slice(-60);
    }
  }

  // cluster health
  for (const cl of c.clusters) {
    const nodes = cl.nodeIds.map(id => game.servers.find(s => s.id === id)).filter(Boolean);
    const online = nodes.filter(n => n.status !== 'offline');
    cl.status = online.length === 0 ? 'offline' : online.length < nodes.length ? 'degraded' : 'healthy';
    for (const w of cl.workloads) {
      const capacity = Math.max(1, online.length * 4);
      const running = Math.min(w.replicas, capacity);
      if (running < w.replicas && rng.chance(Math.min(.5, .006 * minutes))) {
        w.restarts = (w.restarts || 0) + 1;
        events.push({ type: 'feed', text: `pod ${w.name} rescheduled in ${cl.name}.`, kind: 'warn' });
      }
      w.running = running;
    }
  }

  // agents
  for (const a of game.agents) {
    const role = agentRole(a.roleId);
    const model = agentModel(a.modelId);
    if (a.ownerType === 'player') {
      const server = game.servers.find(s => s.id === a.serverId);
      if (a.status === 'active' && (!server || server.status === 'offline')) {
        a.status = 'idle'; a.note = 'compute unavailable';
        events.push({ type: 'feed', text: `Agent ${a.name} is idle: compute unavailable.`, kind: 'warn' });
        continue;
      }
      if (a.status === 'idle' && server && server.status === 'online') a.status = 'active';
      if (a.status !== 'active') continue;
      const revenue = agentDailyRevenue(a) * day;
      const cost = agentDailyCost(a) * day;
      a.pendingRevenue += revenue;
      a.pendingCost += cost;
      a.spend += cost;
      if (a.pendingRevenue >= 1) {
        const amount = Math.floor(a.pendingRevenue);
        a.pendingRevenue -= amount;
        events.push({ type: 'money', amount, memo: `agent ${a.name} output` });
      }
      if (a.pendingCost >= 1) {
        const amount = Math.floor(a.pendingCost);
        a.pendingCost -= amount;
        events.push({ type: 'money', amount: -amount, memo: `agent ${a.name} model usage` });
      }
      if (a.siteId && rng.chance(Math.min(.6, .02 * minutes))) {
        const site = game.sites.find(s => s.id === a.siteId);
        if (site) site.visits += rng.int(1, 4);
      }
      if (rng.chance(Math.min(.9, .012 * minutes))) {
        a.tasksDone++;
        const task = rng.pick(AGENT_TASKS);
        a.memory.push({ world: game.worldMinutes, text: task });
        if (a.memory.length > 24) a.memory.shift();
        if (rng.chance(.16)) events.push({ type: 'feed', text: `Agent ${a.name} ${task}.`, kind: 'info' });
      }
      if (rng.chance(Math.min(.5, role.risk * day * 1.8))) {
        a.status = 'paused';
        const note = rng.pick([
          'Produced a confident answer with no supporting source. Paused pending review.',
          'Attempted an action outside its permission scope. Request denied and logged.',
          'Escalated an ambiguous customer request instead of guessing. Correct behavior.',
          'Repeated a stale runbook step. Paused until the runbook is updated.'
        ]);
        a.memory.push({ world: game.worldMinutes, text: note });
        events.push({ type: 'feed', text: `Agent ${a.name} paused: ${note}`, kind: 'warn' });
        events.push({ type: 'mail', from: 'agent-ops', subject: `Agent ${a.name} needs review`, body: `${note}\n\nReview with: agent inspect ${a.name}\nResume with: agent start ${a.name}` });
      }
    } else {
      if (rng.chance(Math.min(.8, .006 * minutes))) {
        a.tasksDone++;
        a.memory.push({ world: game.worldMinutes, text: rng.pick(AGENT_TASKS) });
        if (a.memory.length > 16) a.memory.shift();
        if (rng.chance(.05)) events.push({ type: 'feed', text: `${a.ownerName}'s agent ${a.name} ${rng.pick(AGENT_TASKS)}.`, kind: 'info' });
      }
    }
  }

  // organizations, products and market drift
  for (const co of game.companies) {
    const products = (co.products || []).map(id => game.products.find(p => p.id === id)).filter(Boolean);
    let mrr = 0;
    for (const p of products) {
      if (p.status !== 'live') continue;
      mrr += p.price * p.subscribers;
      if (day > 0) {
        const churn = p.churn || .002;
        const growth = p.growth || 0;
        p.subscribers = Math.max(0, p.subscribers * (1 + (growth - churn) * day * 30));
        p.rating = clamp(p.rating + rng.float(-.04, .04) * day, 1, 5);
      }
    }
    co.revenue = Math.round(mrr);
    if (co.status === 'failed') continue;
    const profit = (mrr - (co.burn || 0)) * day / 30;
    co.funds += profit;
    if (co.ownerType === 'player') {
      // retained earnings first, then a dividend to the operator
      for (const p of products) {
        if (p.status !== 'live') continue;
        const reach = clamp((game.player.reputation || 0) / 100 + Math.min(.5, (game.player.domains?.length || 0) * .03), 0, 1);
        const acquisition = (1.2 + reach * 2.8) * day;
        const churn = p.subscribers * (p.churn || .002) * day;
        p.subscribers = Math.max(0, p.subscribers + acquisition - churn);
      }
      if (profit > 0) {
        const dividend = Math.floor(profit * .5);
        if (dividend >= 1) {
          co.funds -= dividend;
          events.push({ type: 'money', amount: dividend, memo: `${co.name} dividend` });
        }
      }
    }
    if (co.funds < -(co.burn || 1000) * .5) {
      if (co.status !== 'distressed') {
        co.status = 'distressed';
        co.history.unshift({ world: game.worldMinutes, text: 'Cash reserve exhausted; entered distressed operations.' });
        events.push({ type: 'news', headline: `${co.name} enters distressed operations`, body: 'The company says it is reviewing costs and has paused non-essential hiring. Customers report no immediate service impact.', source: 'Byte Ledger' });
      }
      if (co.ownerType !== 'player' && co.funds < -(co.burn || 1000) * 2 && rng.chance(Math.min(.4, .002 * minutes))) {
        co.employees = Math.max(1, Math.round(co.employees * .82));
        co.burn = Math.round(co.burn * .84);
        co.morale = clamp(co.morale - 12, 0, 100);
        co.history.unshift({ world: game.worldMinutes, text: `Reduced headcount to ${co.employees}.` });
        events.push({ type: 'feed', text: `${co.name} reduced headcount to ${co.employees}.`, kind: 'bad' });
      }
      if (co.ownerType !== 'player' && co.funds < -(co.burn || 1000) * 6) {
        co.status = 'failed';
        for (const p of products) p.status = 'offline';
        co.history.unshift({ world: game.worldMinutes, text: 'Operations ceased; products taken offline.' });
        events.push({ type: 'news', headline: `${co.name} ceases operations`, body: 'The organization has stopped trading after failing to secure additional funding. Its products are offline and its domains are expected to lapse.', source: 'Signal Review' });
      }
    } else if (co.status === 'distressed' && co.funds > (co.ownerType === 'player' ? 0 : (co.burn || 1000) * 1.5)) {
      co.status = 'operating';
      co.history.unshift({ world: game.worldMinutes, text: 'Returned to stable operations.' });
      events.push({ type: 'feed', text: `${co.name} returned to stable operations.`, kind: 'good' });
    }
    if (rng.chance(Math.min(.5, .0016 * minutes))) {
      const text = rng.pick(ORG_EVENTS);
      co.history.unshift({ world: game.worldMinutes, text });
      if (co.history.length > 18) co.history.length = 18;
      events.push({ type: 'feed', text: `${co.name} ${text}.`, kind: 'info' });
      if (rng.chance(.18)) events.push({ type: 'news', headline: `${co.name} ${text}`, body: 'The move was announced internally before it appeared in public telemetry.', source: rng.pick(['The Packet','Signal Review','Byte Ledger']) });
    }
  }

  // clean up references to companies that no longer exist
  game.products = game.products.filter(p => game.companies.some(c => c.id === p.companyId));
  return events;
}
