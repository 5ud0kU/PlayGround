/* Persistent world generation and autonomous simulation. */
import { makeRng, randomSeed, clamp, fmtMoney, fmtNum, fmtDate, fmtTime, pick, uid, deepClone } from './util.js';
import {
  FIRST, LAST, HANDLES, ROLES, PERSONALITIES, BIOS, ACTIVITIES, COMPANY_DEFS, KEY_NPCS,
  OSES, SERVICES, VULN_TYPES, DOMAIN_WORDS, TLDS, SITE_CATEGORIES, FORUM_DEFS,
  NEWS_SOURCES, NEWS_TEMPLATES, TOPICS, CONTRACT_TEMPLATES, SHOP_ITEMS, ACHIEVEMENTS,
  EMAIL_BODIES, SERVICE_NAMES, MAINT_NOTES
} from './data.js';
import {
  makeLocalFS, makeRemoteFS, writeFile, ensureDir, readFile, getNode, resolvePath, listDir,
  allFiles, HOME
} from './vfs.js';
import { buildSystems, ensureSystems, tickSystems } from './systems.js';

export const SAVE_KEY = 'internet-persistent-world.v1';
export const WORLD_VERSION = 4;
export const MINUTES_PER_DAY = 1440;
export const START_MINUTES = 9 * 60 + 12;

const REGIONS = ['eu-west', 'us-east', 'us-west', 'ap-south', 'eu-north', 'sa-east', 'af-south'];
const ASNS = ['AS64500', 'AS64511', 'AS64522', 'AS64533', 'AS64544', 'AS64555', 'AS64566', 'AS64577', 'AS64588'];
const TAGS = ['web', 'mail', 'db', 'cdn', 'edge', 'internal', 'staging', 'prod', 'legacy', 'research', 'payment', 'backup', 'ci', 'dns'];

function slugRole(role) { return role.split(' ')[0].toLowerCase(); }

function makeIdentity(rng, usedHandles) {
  let handle;
  do { handle = rng.pick(HANDLES) + (rng.chance(.45) ? rng.int(1, 99) : ''); } while (usedHandles.has(handle));
  usedHandles.add(handle);
  const name = rng.pick(FIRST) + ' ' + rng.pick(LAST);
  const rolePair = rng.pick(ROLES);
  return {
    handle, name, role: rolePair[0], tag: rolePair[1],
    personality: rng.pick(PERSONALITIES), bio: rng.pick(BIOS),
    interests: rng.picks(['web','networking','security','crypto','databases','design','linux','automation','privacy','hardware','markets','research','writing','oss','cloud'], 3),
    skill: rng.int(24, 91), rep: rng.int(3, 78), funds: rng.int(400, 180000),
    online: rng.chance(.42), activity: rng.pick(ACTIVITIES), mood: rng.pick(['calm','busy','curious','tired','focused','wary']),
    email: '', companyId: null, company: 'independent', faction: 'civilian', relations: {}
  };
}

function makeService(port, rng) {
  const def = SERVICES.find(s => s.port === port) || rng.pick(SERVICES);
  return { port: def.port, name: def.name, product: def.product, version: rng.pick(def.versions), state: 'open' };
}

function makeVuln(rng, name, service) {
  const def = VULN_TYPES.find(v => v.name === name) || rng.pick(VULN_TYPES);
  const cve = `CVE-2026-${rng.int(1000, 9899)}`;
  return {
    id: cve, name: def.name, service: service || def.service, severity: def.severity,
    desc: def.desc, patched: false, discovered: false, detected: false,
    value: def.severity === 'critical' ? rng.int(1200, 4200) : def.severity === 'high' ? rng.int(500, 1800) : rng.int(80, 450)
  };
}

function makeUsers(rng, primary, opts = {}) {
  const users = [
    { user: 'root', pass: rng.chance(.35) ? 'toor' : rng.hex(12), role: 'root', sudo: true },
    { user: primary, pass: opts.pass || rng.hex(10), role: 'admin', sudo: true },
    { user: 'www-data', pass: rng.hex(12), role: 'service', sudo: false }
  ];
  if (rng.chance(.4)) users.push({ user: 'guest', pass: 'guest', role: 'user', sudo: false });
  return users;
}

function makeServer(rng, opts = {}) {
  const ip = opts.ip;
  const host = opts.host;
  const domain = opts.domain || `${host}.${opts.baseDomain || 'nullnet'}`;
  const primary = opts.user || (rng.chance(.5) ? 'admin' : 'deploy');
  const os = opts.os || rng.pick(OSES);
  const ports = opts.ports || [22, 80, 443];
  const services = ports.map(p => makeService(p, rng));
  const users = makeUsers(rng, primary, { pass: opts.pass });
  const fs = makeRemoteFS(host, {
    os, user: primary, motd: opts.motd || `${host} — authorized access only. All activity is logged.\n`,
    webroot: opts.webroot
  });
  if (opts.files) for (const [path, content] of Object.entries(opts.files)) writeFile(fs, path, content, { owner: primary });
  const vulns = (opts.vulns || []).map(v => {
    if (typeof v === 'string') return makeVuln(rng, v);
    const out = makeVuln(rng, v.name, v.service);
    if (v.id) out.id = v.id;
    return out;
  });
  const motd = opts.motd || `${host} — authorized access only. All activity is logged.\n`;
  const fsMeta = { user: primary, os, motd, webroot: opts.webroot || null };
  let cache = null;
  if (opts.owned || opts.curated || opts.fsDirty) {
    cache = makeRemoteFS(host, { os, user: primary, motd, webroot: opts.webroot });
    if (opts.files) for (const [path, content] of Object.entries(opts.files)) writeFile(cache, path, content, { owner: primary });
  }
  const server = {
    id: opts.id || `srv-${String(opts.seq || 0).padStart(4, '0')}`,
    ip, host, domain, org: opts.org || 'Independent', companyId: opts.companyId || null,
    ownerId: opts.ownerId || null, role: opts.role || 'server', os,
    kernel: rng.chance(.5) ? '6.1.0-18-amd64' : '5.15.0-91-generic',
    status: opts.status || 'online', security: opts.security ?? rng.int(35, 88),
    services, users, vulns,
    asn: opts.asn || rng.pick(ASNS), region: opts.region || rng.pick(REGIONS),
    uptimePct: opts.uptimePct ?? rng.float(97.2, 99.99), lastSeen: Date.now(),
    traffic: opts.traffic ?? rng.int(50, 24000), revenue: 0,
    tags: opts.tags || [rng.pick(TAGS)], notes: opts.notes ? [opts.notes] : [],
    compromised: false, owned: !!opts.owned, discovered: !!opts.discovered,
    siteKind: opts.siteKind || null, createdWorld: opts.createdWorld || 0,
    history: [], fsMeta, fsDirty: !!opts.fsDirty, curated: !!opts.curated
  };
  Object.defineProperty(server, 'fs', {
    enumerable: false, configurable: true,
    get() { if (!cache) cache = buildServerFS(server); return cache; },
    set(v) { cache = v; }
  });
  Object.defineProperty(server, 'toJSON', {
    enumerable: false, configurable: true,
    value: function () {
      const out = {};
      for (const k of Object.keys(this)) out[k] = this[k];
      if (this.owned || this.curated || this.fsDirty) out.fs = cache;
      return out;
    }
  });
  return server;
}

function buildServerFS(server) {
  const m = server.fsMeta || {};
  return makeRemoteFS(server.host, {
    os: m.os || server.os,
    user: m.user || 'admin',
    motd: m.motd || `${server.host} — authorized access only. All activity is logged.\n`,
    webroot: m.webroot || undefined
  });
}

export function reviveGame(game) {
  ensureSystems(game);
  if (!game.growth) game.growth = { companyCycle: 0, npcCycle: 0, serverCycle: 0, siteCycle: 0, contractCycle: 0, eventCycle: 0, lastWorldMinute: 0 };
  else {
    const growthDefaults = { companyCycle: 0, npcCycle: 0, serverCycle: 0, siteCycle: 0, contractCycle: 0, eventCycle: 0, lastWorldMinute: game.worldMinutes || 0 };
    for (const [key, value] of Object.entries(growthDefaults)) if (typeof game.growth[key] !== 'number') game.growth[key] = value;
  }
  if (typeof game.lastRentDay !== 'number') game.lastRentDay = Math.floor((game.worldMinutes || 0) / MINUTES_PER_DAY);
  for (const s of game.servers || []) {
    if (!s.fsMeta) {
      s.fsMeta = {
        user: (s.users || []).find(u => u.role === 'admin')?.user || 'admin',
        os: s.os, motd: `${s.host} — authorized access only. All activity is logged.\n`, webroot: null
      };
    }
    const existing = s.fs || null;
    if (existing) s.fsDirty = true;
    delete s.fs;
    let cache = existing;
    Object.defineProperty(s, 'fs', {
      enumerable: false, configurable: true,
      get() { if (!cache) cache = buildServerFS(s); return cache; },
      set(v) { cache = v; }
    });
    Object.defineProperty(s, 'toJSON', {
      enumerable: false, configurable: true,
      value: function () {
        const out = {};
        for (const k of Object.keys(this)) out[k] = this[k];
        if (this.owned || this.curated || this.fsDirty) out.fs = cache;
        return out;
      }
    });
  }
  return game;
}

function siteText(title, desc, sections, links) {
  const body = sections.map(s => `${s.h}\n${s.p}`).join('\n\n');
  return `${title}\n${'='.repeat(title.length)}\n\n${desc}\n\n${body}\n\nLINKS: ${links.join('  ')}`;
}

function makeSite(rng, opts) {
  const sections = opts.sections || [
    { h: 'About', p: opts.desc || '' },
    { h: 'Recent', p: 'The site is updated irregularly. Its owner prefers the terminal.' }
  ];
  const links = opts.links || ['portal.nullnet', 'market.nullnet', 'news.nullnet'];
  return {
    id: opts.id || `site-${rng.hex(6)}`, domain: opts.domain, title: opts.title,
    kind: opts.kind || 'generic', category: opts.category || rng.pick(SITE_CATEGORIES),
    ownerId: opts.ownerId || null, companyId: opts.companyId || null, serverId: opts.serverId || null,
    desc: opts.desc || '', sections, links, created: opts.created || Date.now() - rng.int(1, 900) * 86400000,
    visits: opts.visits ?? rng.int(20, 4800), status: opts.status || 'live',
    tech: opts.tech || rng.pick(['nginx','Caddy','Apache','static','Next.js','Rails','Go','Flask']),
    text: siteText(opts.title, opts.desc || '', sections, links),
    revenue: 0, ownerType: opts.ownerType || 'npc'
  };
}

function objectiveFor(type, server, extra = {}) {
  const host = server ? server.host : extra.targetLabel || 'target';
  const base = { type, target: server?.id || null, label: '', hint: '' };
  if (type === 'scan') return { ...base, label: `Enumerate exposed services on ${host}`, hint: `nmap -sV ${host}` };
  if (type === 'audit') return { ...base, label: `Audit ${host} and document a real finding`, hint: `nmap -sV ${host} && audit ${host}` };
  if (type === 'patch') return { ...base, label: `Close the known exposure on ${host}`, hint: `patch ${host}` };
  if (type === 'exploit') return { ...base, label: `Obtain access to ${host} and retrieve the archive`, hint: `nmap -sV ${host} && vulnscan ${host} && exploit ${host}` };
  if (type === 'deploy') return { ...base, label: 'Publish a live site on infrastructure you own', hint: 'buy vps-std, then deploy <dir> <domain>' };
  if (type === 'code') return { ...base, label: `Deliver ${extra.path || 'the requested artifact'}`, hint: `create the file at ${extra.path || '~/projects'}`, path: extra.path, minLines: extra.minLines || 4 };
  return { ...base, label: `Complete the work for ${host}`, hint: '' };
}

export function createGame(seed = randomSeed()) {
  const rng = makeRng(seed);
  const now = Date.now();
  const game = {
    version: WORLD_VERSION, seed, createdAt: now, lastSaved: now, lastActive: now,
    worldMinutes: START_MINUTES, tickCount: 0, cycle: 1,
    player: {
      handle: 'operator', name: 'Kai Mercer', alias: 'nullbyte',
      host: 'voidbox', ip: '10.0.0.42', gateway: '10.0.0.1',
      money: 1840, reputation: 8, heat: 0, skill: 1, title: 'unproven',
      joined: now, relations: {}, achievements: {}, notes: [],
      inventory: { proxy: 0, vpn: 0, ids: 0, course: 0, forensics: 0, gpu: 0, backup: 0, monitor: 0 },
      domains: [], transactions: [], contractsDone: 0, contractsFailed: 0
    },
    fs: makeLocalFS(),
    companies: [], npcs: [], servers: [], sites: [], forums: [], contracts: [], mail: [],
    news: [], feed: [], pendingReplies: [], legal: [], repos: [], processes: [],
    cloud: null, agents: [], products: [],
    packages: ['bash','coreutils','procps','openssh-client','openssh-server','curl','wget','git','python3','python3-pip','gcc','g++','make','sqlite3','vim','nano','nmap','dnsutils','whois','traceroute','net-tools','iproute2','file','less','grep','sed','awk','htop','tree'],
    installed: ['nmap','curl','wget','git','python3','gcc','g++','sqlite3','vim','nano','bash','openssh-client','dnsutils','whois','traceroute','net-tools','htop','tree','file'],
    stats: { scans: 0, audits: 0, exploits: 0, patches: 0, deploys: 0, contracts: 0, earned: 0, spent: 0, mailsSent: 0, newsRead: 0, logins: 0, codeLines: 0, sites: 0, purchases: 0 },
    flags: { scanned: {}, audited: {}, patched: {}, exploited: {}, discovered: {}, visited: {}, hacked: {} },
    market: { index: 1000, history: [1000], volume: 0, sentiment: 'neutral' },
    seq: { mail: 100, contract: 1000, news: 1, feed: 1, forum: 1, server: 1, site: 1, npc: 1, company: 1, agent: 1, product: 1, container: 1, cluster: 1, bucket: 1, cloud: 1 },
    achievements: {}, settings: { reducedMotion: false, sound: false },
    offline: null, versionTag: 'sim/4.2',
    growth: { companyCycle: 0, npcCycle: 0, serverCycle: 0, siteCycle: 0, contractCycle: 0, eventCycle: 0, lastWorldMinute: START_MINUTES },
    lastRentDay: Math.floor(START_MINUTES / MINUTES_PER_DAY)
  };

  buildCompanies(game, rng);
  buildNpcs(game, rng);
  buildSystems(game, rng);
  buildServers(game, rng);
  buildSites(game, rng);
  buildForums(game, rng);
  buildContracts(game, rng);
  buildMail(game, rng);
  buildNews(game, rng);
  buildProcesses(game, rng);
  buildRepos(game, rng);

  game.feed = [
    { id: game.seq.feed++, time: now - 90000, world: game.worldMinutes - 3, text: 'NullNet Collective restarted the public shell after maintenance.', kind: 'info' },
    { id: game.seq.feed++, time: now - 52000, world: game.worldMinutes - 2, text: 'A new contract was posted: "Perimeter scan and inventory".', kind: 'work' },
    { id: game.seq.feed++, time: now - 24000, world: game.worldMinutes - 1, text: 'Signal Review published a short note on the OldCo migration.', kind: 'news' },
    { id: game.seq.feed++, time: now - 6000, world: game.worldMinutes, text: 'You are online. The world has been running without you.', kind: 'self' }
  ];
  checkAchievements(game, true);
  return game;
}

/* ---------------- bounded procedural growth ---------------- */
const GROWTH_CAPS = Object.freeze({ companies: 30, npcs: 420, servers: 180, sites: 220, contracts: 60 });

function crossedCadence(game, key, interval) {
  const cycle = Math.floor(game.worldMinutes / interval);
  if (cycle <= (game.growth[key] || 0)) return false;
  game.growth[key] = cycle;
  return true;
}

function growthRng(game, salt) {
  return makeRng((game.seed ^ Math.floor(game.worldMinutes * 2654435761) ^ (game.tickCount * 97) ^ salt) >>> 0);
}

function addGrowthNpc(game, rng) {
  if (game.npcs.length >= GROWTH_CAPS.npcs) return null;
  const used = new Set(game.npcs.map(n => n.handle));
  const id = makeIdentity(rng, used);
  const co = rng.chance(.78) ? rng.pick(game.companies) : null;
  const npc = {
    ...id, id: `npc-${String(game.seq.npc++).padStart(4, '0')}`,
    companyId: co?.id || null, company: co?.name || 'independent',
    email: `${id.handle}@${co?.domain || 'nullnet'}`,
    faction: co?.sector === 'government' ? 'gov' : (!co && id.rep < 38) ? 'underground' : 'civilian',
    key: false, sent: 0, received: 0
  };
  game.npcs.push(npc);
  game.player.relations[npc.handle] = 0;
  return npc;
}

function addGrowthServer(game, rng) {
  if (game.servers.length >= GROWTH_CAPS.servers) return null;
  const co = rng.chance(.72) ? rng.pick(game.companies) : null;
  const users = co ? game.npcs.filter(n => n.companyId === co.id) : [];
  const seq = game.seq.server++;
  const ip = `198.51.${rng.int(100, 249)}.${rng.int(10, 249)}`;
  let domain = `${rng.pick(DOMAIN_WORDS)}-${rng.int(10, 999)}.${rng.pick(TLDS)}`;
  const server = makeServer(rng, {
    seq, ip, host: `${rng.pick(['edge','node','service','app','stage','api','cdn']).toLowerCase()}-${seq}`,
    domain, org: co?.name || rng.pick(['Independent Operator','Neighborhood Collective','Small Systems Guild','Field Station']),
    role: rng.pick(['application node','edge cache','backup target','internal service','static origin']),
    os: rng.pick(OSES), security: rng.int(42, 82), ports: rng.picks([22,80,443,3306,5432,8080,8443], rng.int(2,5)),
    user: users[0]?.handle || 'deploy', pass: null, vulns: rng.picks(VULN_TYPES.map(v => v.name), rng.int(1,3)),
    tags: rng.picks(TAGS, rng.int(1,3)), asn: rng.pick(ASNS), ownerId: users[0]?.id || null,
    companyId: co?.id || null, status: 'online', createdWorld: game.worldMinutes
  });
  game.servers.push(server);
  if (co) co.serverIds.push(server.id);
  return server;
}

function addGrowthSite(game, rng) {
  if (game.sites.length >= GROWTH_CAPS.sites) return null;
  const server = rng.pick(game.servers.filter(s => s.status === 'online' && s.siteKind == null));
  const company = server?.companyId ? game.companies.find(c => c.id === server.companyId) : null;
  const owner = server?.ownerId ? game.npcs.find(n => n.id === server.ownerId) : rng.pick(game.npcs);
  if (!server || !owner) return null;
  const kind = rng.pick(['community','corp','news','git','generic']);
  server.siteKind = kind;
  const site = makeSite(rng, {
    id: `site-${String(game.seq.site++).padStart(4, '0')}`,
    domain: server.domain, title: company?.name || server.org, kind,
    category: company?.sector || 'independent', ownerId: owner.id,
    companyId: company?.id || null, serverId: server.id,
    desc: `Public ${kind} service operated from ${server.host}.`,
    sections: siteSectionsFor(kind, company, server, rng), ownerType: company ? 'company' : 'npc', tech: rng.pick(['nginx','Caddy','static','Next.js','Rails','Go','Flask'])
  });
  game.sites.push(site);
  if (company) company.siteId = company.siteId || site.id;
  return site;
}

function growWorldEntities(game, rng) {
  const growthEvents = [];
  if (crossedCadence(game, 'companyCycle', MINUTES_PER_DAY * 3) && game.companies.length < GROWTH_CAPS.companies) {
    // Companies are introduced only as bounded, deterministic offshoots of existing entities.
    const source = rng.pick(game.companies);
    if (source) {
      const name = `${rng.pick(DOMAIN_WORDS).replace(/./, c => c.toUpperCase())} ${rng.pick(['Systems','Networks','Works','Collective','Labs','Services'])}`;
      if (!game.companies.some(c => c.name === name)) {
        const company = { id: `co-${String(game.seq.company++).padStart(3, '0')}`, name, domain: `${name.toLowerCase().replace(/[^a-z]+/g, '-')}.net`, sector: source.sector, size: rng.int(12, 420), security: rng.int(35, 88), funds: rng.int(500000, 18000000), desc: `A growing ${source.sector} operation with an independent network footprint.`, rep: rng.int(20, 78), founded: 2026 - rng.int(0, 8), employees: rng.int(12, 420), serverIds: [], siteId: null, ceoId: null, status: 'operating', projects: rng.picks(['expansion','migration','hiring','audit','platform rebuild'], 2), hq: rng.pick(REGIONS) };
        game.companies.push(company);
        growthEvents.push({ type: 'growth', text: `${company.name} entered the network` });
      }
    }
  }
  if (crossedCadence(game, 'npcCycle', 240)) {
    const npc = addGrowthNpc(game, rng);
    if (npc) growthEvents.push({ type: 'growth', text: `@${npc.handle} joined the network` });
  }
  if (crossedCadence(game, 'serverCycle', 360) && rng.chance(.85)) {
    const server = addGrowthServer(game, rng);
    if (server) growthEvents.push({ type: 'growth', text: `${server.host} came online` });
  }
  if (crossedCadence(game, 'siteCycle', 720)) {
    const site = addGrowthSite(game, rng);
    if (site) growthEvents.push({ type: 'growth', text: `${site.domain} launched` });
  }
  if (crossedCadence(game, 'contractCycle', 180)) {
    const open = game.contracts.filter(c => c.status === 'open').length;
    if (open < GROWTH_CAPS.contracts) {
      const contract = generateContract(game, rng);
      if (contract) growthEvents.push({ type: 'contract', text: `${contract.id} ${contract.title}` });
    }
  }
  if (crossedCadence(game, 'eventCycle', 480)) {
    const headline = addNews(game, rng, { silent: true });
    if (headline) growthEvents.push({ type: 'news', text: headline.headline });
  }
  return growthEvents;
}

/* ---------------- generation: companies + people ---------------- */
function buildCompanies(game, rng) {
  for (const def of COMPANY_DEFS) {
    const id = `co-${String(game.seq.company++).padStart(3, '0')}`;
    game.companies.push({
      ...def, id, rep: clamp(Math.round(def.security * .55 + rng.int(5, 35)), 5, 96),
      funds: def.funds, founded: 2026 - rng.int(2, 24), employees: def.size,
      serverIds: [], siteId: null, ceoId: null, status: 'operating',
      projects: rng.picks(['migration','audit','launch','cost reduction','hiring','incident review','platform rebuild','regional expansion'], 2),
      hq: rng.pick(REGIONS)
    });
  }
}
function buildNpcs(game, rng) {
  const used = new Set();
  const byCompany = new Map(game.companies.map(c => [c.name, c]));
  for (const k of KEY_NPCS) {
    used.add(k.handle);
    const co = byCompany.get(k.company);
    const npc = {
      ...k, id: `npc-${String(game.seq.npc++).padStart(4, '0')}`,
      companyId: co?.id || null, email: `${k.handle}@${co?.domain || 'nullnet'}`,
      online: rng.chance(.6), activity: rng.pick(ACTIVITIES), mood: rng.pick(['calm','focused','busy','wary']),
      faction: co?.sector === 'government' ? 'gov' : k.company === 'independent' ? (k.rep < 45 ? 'underground' : 'civilian') : 'corp',
      relations: {}, key: true, sent: 0, received: 0
    };
    game.npcs.push(npc);
    if (co && !co.ceoId) co.ceoId = npc.id;
    if (co) co.rep = clamp(co.rep + rng.int(-2, 3), 1, 99);
  }
  for (let i = 0; i < 104; i++) {
    const id = makeIdentity(rng, used);
    const co = rng.chance(.78) ? rng.pick(game.companies) : null;
    const npc = {
      ...id, id: `npc-${String(game.seq.npc++).padStart(4, '0')}`,
      companyId: co?.id || null, company: co?.name || 'independent',
      email: `${id.handle}@${co?.domain || 'nullnet'}`,
      online: rng.chance(.45), activity: rng.pick(ACTIVITIES),
      faction: co?.sector === 'government' ? 'gov' : (!co && id.rep < 38) ? 'underground' : 'civilian',
      key: false, sent: 0, received: 0
    };
    game.npcs.push(npc);
  }
  for (const npc of game.npcs.filter(n => n.key)) {
    for (const other of rng.picks(game.npcs.filter(n => n.key && n.handle !== npc.handle), rng.int(1, 3))) {
      npc.relations[other.handle] = rng.int(-40, 80);
    }
  }
  for (const npc of game.npcs) {
    game.player.relations[npc.handle] = npc.key && ['hex','pixel','fable','relay'].includes(npc.handle) ? rng.int(0, 8) : 0;
  }
}

/* ---------------- generation: infrastructure ---------------- */
const CURATED = [
  {
    ip: '10.0.0.1', host: 'home-gw', domain: 'gw.lan', org: 'Residential', role: 'edge router',
    os: 'OpenWrt 23.05', security: 28, ports: [22, 53, 80], user: 'admin', pass: 'admin',
    vulns: ['Default admin credentials', 'Outdated TLS stack'], tags: ['edge','home'], asn: 'AS64500',
    notes: 'Your own gateway. Old firmware, noisy fans, stable enough.',
    files: {
      '/etc/config/network': 'config interface \'lan\'\n\toption proto \'static\'\n\toption ipaddr \'10.0.0.1\'\n\toption netmask \'255.255.255.0\'\n',
      '/etc/config/dhcp': 'config dnsmasq\n\toption domainneeded \'1\'\n\toption local \'/lan/\'\n\toption domain \'lan\'\n',
      '/www/index.html': '<html><body><h1>Home Gateway</h1><p>Firmware 23.05. Status: nominal.</p></body></html>'
    }
  },
  {
    ip: '203.0.113.10', host: 'portal', domain: 'portal.nullnet', org: 'NullNet Collective', company: 'NullNet Collective',
    role: 'community hub', os: 'Debian GNU/Linux 12 (bookworm)', security: 68, ports: [22, 80, 443, 3306],
    user: 'guest', pass: 'guest', vulns: ['Exposed .git directory', 'Verbose error disclosure'], tags: ['web','community','prod'],
    siteKind: 'portal', notes: 'The public face of NullNet. Busy, volunteer-run, held together by cron.',
    files: {
      '/var/www/html/index.html': '<html><body><h1>NullNet</h1><p>A community network for people who still read headers.</p></body></html>',
      '/home/guest/README': 'Welcome, guest.\n\nThe boards are public. The shell is shared. Do not break what you cannot fix.\n\n- relay\n',
      '/etc/nginx/sites-enabled/portal': 'server {\n  listen 80;\n  root /var/www/html;\n  location / { try_files $uri $uri/ =404; }\n}\n',
      '/var/log/nginx/access.log': '203.0.113.77 - - [22/Nov/2026:09:10:12] "GET / HTTP/1.1" 200 1842\n198.51.100.14 - - [22/Nov/2026:09:10:19] "GET /boards HTTP/1.1" 200 5120\n'
    }
  },
  {
    ip: '203.0.113.20', host: 'mail', domain: 'mail.nullnet', org: 'NullNet Collective', company: 'NullNet Collective',
    role: 'mail relay', os: 'Debian GNU/Linux 12 (bookworm)', security: 71, ports: [22, 25, 143, 993],
    user: 'postmaster', vulns: ['Open SMTP relay'], tags: ['mail','prod'],
    notes: 'Public mail relay. Heavily rate limited, lightly monitored.',
    files: {
      '/etc/postfix/main.cf': 'myhostname = mail.nullnet\nsmtpd_relay_restrictions = permit_mynetworks permit_sasl_authenticated defer_unauth_destination\n',
      '/var/log/mail.log': 'postfix/smtpd[812]: connect from unknown[198.51.100.91]\npostfix/smtpd[812]: NOQUEUE: reject: RCPT from unknown[198.51.100.91]: 554 5.7.1 Relay access denied\n'
    }
  },
  {
    ip: '203.0.113.30', host: 'market', domain: 'market.nullnet', org: 'NullNet Collective', company: 'NullNet Collective',
    role: 'contract board', os: 'Ubuntu 22.04.4 LTS', security: 66, ports: [22, 80, 443],
    user: 'deploy', vulns: ['Outdated CMS plugin', 'Missing rate limiting'], tags: ['web','market','prod'],
    siteKind: 'market', notes: 'The contract board. Reputation is the only real currency here.',
    files: {
      '/var/www/market/app.py': 'from flask import Flask, request\napp = Flask(__name__)\n\n@app.route("/contracts")\ndef contracts():\n    return "contract board"\n',
      '/var/www/market/static/README': 'Contract escrow is manual. Read the objective. Deliver the artifact.\n'
    }
  },
  {
    ip: '203.0.113.40', host: 'git', domain: 'git.nullnet', org: 'NullNet Collective', company: 'NullNet Collective',
    role: 'git host', os: 'Alpine Linux 3.19', security: 74, ports: [22, 80, 443],
    user: 'git', vulns: ['Weak SSH credentials'], tags: ['git','dev'],
    siteKind: 'git', notes: 'Public repositories. Some are abandoned. Some are load-bearing.',
    files: {
      '/srv/git/README': 'Public repositories:\n  netmap       - network inventory tool\n  nullnet-cli  - community shell utilities\n  starter-site - a small static site template\n',
      '/etc/ssh/sshd_config': 'PasswordAuthentication yes\nPermitRootLogin no\n'
    }
  },
  {
    ip: '198.51.100.7', host: 'portal-prod', domain: 'acme-industries.com', org: 'Acme Industries', company: 'Acme Industries',
    role: 'customer portal', os: 'Ubuntu 22.04.4 LTS', security: 58, ports: [22, 80, 443, 3306],
    user: 'deploy', vulns: ['SQL injection', 'Outdated CMS plugin', 'Verbose error disclosure'],
    tags: ['web','prod','customer'], siteKind: 'corp',
    notes: 'Customer-facing portal. The staging host is rumored to share a database.',
    files: {
      '/var/www/portal/app.py': 'import os\nfrom flask import Flask, request, render_template\napp = Flask(__name__)\nDB_HOST = os.environ.get("DB_HOST", "db.internal")\n\n@app.route("/search")\ndef search():\n    q = request.args.get("q", "")\n    return render_template("results.html", q=q)\n',
      '/var/www/portal/.env': 'DB_HOST=db.internal\nDB_USER=portal\nDB_PASS=acme_portal_2024\nSECRET_KEY=4f1c9a7e2b\n',
      '/var/log/nginx/error.log': '2026/11/22 08:41:02 [error] 2211#2211: *918 open() "/var/www/portal/static/missing.js" failed\n'
    }
  },
  {
    ip: '198.51.100.23', host: 'vault', domain: 'finwise.net', org: 'FinWise', company: 'FinWise',
    role: 'banking core', os: 'Rocky Linux 9.3', security: 88, ports: [22, 443, 5432],
    user: 'svc-vault', vulns: ['Weak session tokens', 'Exposed database port'], tags: ['finance','prod','critical'],
    siteKind: 'bank', notes: 'Regulated infrastructure. Intrusion attempts are escalated immediately.',
    files: {
      '/etc/finwise/vault.conf': '# redacted by policy\nlisten = 0.0.0.0:443\naudit = strict\nsession_ttl = 900\n',
      '/var/log/secure': 'Nov 22 08:12:44 vault sshd[882]: Failed password for invalid user test from 198.51.100.91 port 40222\nNov 22 08:12:46 vault sshd[882]: Connection closed by invalid user test\n',
      '/opt/vault/README': 'Core banking services. Change control is mandatory. Do not test in production.\n'
    }
  },
  {
    ip: '192.0.2.44', host: 'icarus', domain: 'helixlabs.io', org: 'Helix Labs', company: 'Helix Labs',
    role: 'research compute', os: 'Debian GNU/Linux 12 (bookworm)', security: 55, ports: [22, 80, 443, 8080],
    user: 'research', vulns: ['Exposed .git directory', 'Weak SSH credentials', 'Stale DNS zone transfer'],
    tags: ['research','internal'], siteKind: 'research',
    notes: 'Project Icarus lives here. The artifact was never published.',
    files: {
      '/opt/icarus/README.md': '# Project Icarus\n\nStatus: paused.\n\nWe demonstrated that a routing anomaly can be predicted from partial telemetry.\nThe dataset is under retention review. Do not redistribute.\n\nContact: hex@helixlabs.io\n',
      '/opt/icarus/data/manifest.txt': 'shard-01  telemetry/2026-08-01..2026-08-31\nshard-02  telemetry/2026-09-01..2026-09-30\nshard-03  labels/incidents.csv\n',
      '/home/research/notes.txt': 'The third experiment depends on data we no longer have. Hex says that is a finding.\n'
    }
  },
  {
    ip: '192.0.2.13', host: 'oldco', domain: 'legacy.oldco.net', org: 'OldCo Systems', company: 'OldCo Systems',
    role: 'abandoned host', os: 'CentOS Stream 9', security: 21, ports: [21, 22, 80],
    user: 'guest', pass: 'guest', vulns: ['Anonymous FTP write', 'Default admin credentials', 'Exposed .git directory'],
    tags: ['legacy','abandoned'], siteKind: 'legacy',
    notes: 'Decommissioned years ago. Still answering. Somebody forgot the power bill.',
    files: {
      '/home/guest/README': 'If you are reading this, the migration did not finish.\n\nOPS-114 was closed without resolution.\n',
      '/var/backups/customers.sql': '-- OldCo customer export (partial)\nCREATE TABLE customers (id INT, name TEXT, plan TEXT);\nINSERT INTO customers VALUES (1,\'Harbor Freight\',\'legacy-512\');\nINSERT INTO customers VALUES (2,\'Cinder Freight\',\'legacy-1024\');\nINSERT INTO customers VALUES (3,\'Unknown\',\'legacy-512\');\n-- 1,184 rows omitted\n',
      '/opt/archive/manifest.txt': 'archive/2019-01.tar.gz\narchive/2019-02.tar.gz\narchive/final-notice.txt\n',
      '/opt/archive/final-notice.txt': 'All customers have been notified. Remaining infrastructure will be decommissioned by Q3.\n\n— admin, 2019-06-14\n'
    }
  },
  {
    ip: '198.51.100.88', host: 'shop', domain: 'pixelbazaar.com', org: 'PixelBazaar', company: 'PixelBazaar',
    role: 'commerce frontend', os: 'Ubuntu 24.04 LTS', security: 64, ports: [22, 80, 443],
    user: 'deploy', vulns: ['Outdated CMS plugin', 'Reflected XSS'], tags: ['web','shop','prod'], siteKind: 'shop',
    notes: 'Digital goods marketplace. Traffic is spiky and the plugin directory is a mess.',
    files: {
      '/var/www/shop/index.php': '<?php\n// storefront bootstrap\nrequire __DIR__ . "/vendor/autoload.php";\n$app = new Storefront();\n$app->run();\n',
      '/var/www/shop/wp-content/plugins/README': 'Do not update plugins during business hours.\n'
    }
  },
  {
    ip: '192.0.2.101', host: 'meridian-mail', domain: 'mail.corp-meridian.com', org: 'Meridian Consulting', company: 'Meridian Consulting',
    role: 'corporate mail', os: 'Windows Server 2022', security: 79, ports: [25, 443, 3389],
    user: 'administrator', vulns: ['Missing rate limiting', 'Verbose error disclosure'], tags: ['mail','corp'],
    notes: 'Consulting firm mail. Client confidentiality is the product.',
    files: {
      '/etc/mail/transport': 'meridian.corp smtp:[192.0.2.102]\n*.meridian.corp smtp:[192.0.2.102]\n',
      '/var/log/maillog': 'Nov 22 07:02:11 meridian-mail postfix/smtpd[2201]: connect from mail.nullnet[203.0.113.20]\n'
    }
  },
  {
    ip: '203.0.113.66', host: 'blackmarket', domain: 'blackmarket.onion', org: 'unknown', role: 'hidden service',
    os: 'Debian GNU/Linux 12 (bookworm)', security: 92, ports: [443], user: 'operator',
    vulns: ['Weak session tokens'], tags: ['hidden','market'], siteKind: 'underground',
    notes: 'A hidden service. The board is public; the operators are not.',
    files: {
      '/var/www/html/index.html': '<html><body><h1>0x00</h1><p>Access, data, and things that should stay buried.</p></body></html>'
    }
  },
  {
    ip: '203.0.113.99', host: 'cybernet', domain: 'cybernet.gov', org: 'CyberNet Authority', company: 'CyberNet Authority',
    role: 'regulator honeypot', os: 'OpenBSD 7.5', security: 96, ports: [22, 80, 443],
    user: 'observer', vulns: ['Verbose error disclosure'], tags: ['gov','honeypot','critical'], siteKind: 'gov',
    notes: 'Regulator. Do not test. This host is almost certainly monitored.',
    files: {
      '/var/www/html/index.html': '<html><body><h1>CyberNet Authority</h1><p>Advisories and enforcement notices.</p></body></html>',
      '/etc/motd': 'AUTHORIZED PERSONNEL ONLY. All connections are retained for investigation.\n'
    }
  },
  {
    ip: '192.0.2.77', host: 'edge-cdn', domain: 'staticwave.net', org: 'StaticWave', company: 'StaticWave',
    role: 'edge cache', os: 'Alpine Linux 3.19', security: 72, ports: [22, 80, 443],
    user: 'edge', vulns: ['Directory traversal'], tags: ['cdn','edge'], siteKind: 'cdn',
    notes: 'Edge cache for a long tail of small sites. Logs are aggregated elsewhere.',
    files: {
      '/etc/nginx/nginx.conf': 'worker_processes auto;\nevents { worker_connections 1024; }\nhttp { include /etc/nginx/mime.types; }\n',
      '/var/cache/nginx/README': 'Cache is evicted by LRU. Do not assume persistence.\n'
    }
  },
  {
    ip: '198.51.100.140', host: 'api', domain: 'api.northwind.dev', org: 'Northwind Devtools', company: 'Northwind Devtools',
    role: 'public API', os: 'Ubuntu 24.04 LTS', security: 49, ports: [22, 443, 8080],
    user: 'deploy', vulns: ['Leaked API token', 'Missing rate limiting', 'Outdated TLS stack'],
    tags: ['api','staging'], siteKind: 'startup',
    notes: 'Northwind API. The staging environment shares a token with production. Allegedly.',
    files: {
      '/srv/api/.env': 'NODE_ENV=production\nAPI_TOKEN=nw_live_7c1f9a2e\nDB_URL=postgres://api:api@db:5432/northwind\n',
      '/srv/api/README': 'Deploy with make release. Do not commit .env.\n'
    }
  },
  {
    ip: '198.51.100.55', host: 'cinder-web', domain: 'cinderfreight.com', org: 'Cinder Freight', company: 'Cinder Freight',
    role: 'logistics portal', os: 'Rocky Linux 9.3', security: 63, ports: [22, 80, 443],
    user: 'deploy', vulns: ['Reflected XSS', 'Missing rate limiting'], tags: ['web','logistics'], siteKind: 'corp',
    notes: 'Freight routing and warehouse telemetry. Most of it still runs on Perl.',
    files: { '/var/www/html/index.html': '<html><body><h1>Cinder Freight</h1><p>Moving things, mostly on time.</p></body></html>' }
  },
  {
    ip: '198.51.100.61', host: 'basalt-edge', domain: 'basalt.net', org: 'Basalt Infrastructure', company: 'Basalt Infrastructure',
    role: 'transit edge', os: 'FreeBSD 14.0-RELEASE', security: 76, ports: [22, 80, 443, 53],
    user: 'netops', vulns: ['Stale DNS zone transfer'], tags: ['network','transit'], siteKind: 'corp',
    notes: 'Transit edge. If this is slow, half the network notices.',
    files: { '/etc/rc.conf': 'hostname="basalt-edge"\nsshd_enable="YES"\n', '/var/log/messages': 'Nov 22 08:00:01 basalt-edge syslogd: kernel boot file is /boot/kernel/kernel\n' }
  },
  {
    ip: '198.51.100.72', host: 'vanta', domain: 'vanta.security', org: 'Vanta Security', company: 'Vanta Security',
    role: 'security operations', os: 'Debian GNU/Linux 12 (bookworm)', security: 91, ports: [22, 443],
    user: 'ir', vulns: ['Weak session tokens'], tags: ['security','critical'], siteKind: 'security',
    notes: 'Incident response firm. They are very good at noticing.',
    files: { '/opt/ir/runbook.md': '# IR runbook\n1. Preserve evidence.\n2. Scope the incident.\n3. Communicate.\n4. Do not improvise in production.\n' }
  },
  {
    ip: '198.51.100.83', host: 'signal', domain: 'signalreview.media', org: 'Signal Review', company: 'Signal Review',
    role: 'newsroom', os: 'Ubuntu 22.04.4 LTS', security: 70, ports: [22, 80, 443],
    user: 'editor', vulns: ['Reflected XSS'], tags: ['media','web'], siteKind: 'news',
    notes: 'Independent newsroom. The tip line is encrypted; the CMS is not.',
    files: { '/var/www/html/index.html': '<html><body><h1>Signal Review</h1><p>Infrastructure, privacy, and digital labor.</p></body></html>' }
  },
  {
    ip: '198.51.100.94', host: 'ledger', domain: 'byteledger.news', org: 'Byte Ledger', company: 'Byte Ledger',
    role: 'market news', os: 'Debian GNU/Linux 12 (bookworm)', security: 66, ports: [22, 80, 443],
    user: 'editor', vulns: ['Outdated CMS plugin'], tags: ['media','web'], siteKind: 'news',
    notes: 'Markets and technology. Publishes fast, corrects later.',
    files: { '/var/www/html/index.html': '<html><body><h1>Byte Ledger</h1><p>Markets, technology, and the people who move both.</p></body></html>' }
  }
];

function buildServers(game, rng) {
  const usedIps = new Set();
  const usedDomains = new Set();
  const coByName = new Map(game.companies.map(c => [c.name, c]));
  const npcByCompany = new Map();
  for (const n of game.npcs) if (n.companyId) { if (!npcByCompany.has(n.companyId)) npcByCompany.set(n.companyId, []); npcByCompany.get(n.companyId).push(n); }

  for (const def of CURATED) {
    const co = coByName.get(def.company);
    const users = npcByCompany.get(co?.id) || [];
    const owner = users.length ? rng.pick(users) : null;
    const seq = game.seq.server++;
    const server = makeServer(rng, {
      ...def, seq, companyId: co?.id || null, ownerId: owner?.id || null,
      files: def.files, vulns: def.vulns, tags: def.tags, status: 'online',
      createdWorld: -rng.int(200, 2400), siteKind: def.siteKind, curated: true
    });
    usedIps.add(server.ip); usedDomains.add(server.domain);
    game.servers.push(server);
    if (co) co.serverIds.push(server.id);
  }

  const roles = ['web frontend','customer portal','internal wiki','mail relay','backup target','CI runner','staging API','metrics collector','database primary','database replica','asset store','status page','VPN concentrator','DNS resolver','jump host','build cache','log archive','payment worker','docs site','edge proxy'];
  for (let i = 0; i < 178; i++) {
    const co = rng.chance(.86) ? rng.pick(game.companies) : null;
    let ip;
    const base = rng.chance(.45) ? '198.51.100.' : rng.chance(.55) ? '192.0.2.' : '203.0.113.';
    do { ip = base + rng.int(20, 250); } while (usedIps.has(ip));
    usedIps.add(ip);
    const role = rng.pick(roles);
    const slug = slugRole(role) + '-' + i;
    let domain = `${slug}.${co ? co.domain : rng.pick(DOMAIN_WORDS) + rng.pick(TLDS)}`;
    let domTries = 0;
    while (usedDomains.has(domain)) {
      domain = `${slug}-${domTries++}.${co ? co.domain : rng.pick(DOMAIN_WORDS) + rng.pick(TLDS)}`;
    }
    usedDomains.add(domain);
    const os = rng.pick(OSES);
    const ports = new Set([22]);
    if (/web|portal|wiki|status|docs|proxy|api|shop|asset|payment/.test(role)) { ports.add(80); if (rng.chance(.65)) ports.add(443); }
    if (/mail/.test(role)) { ports.add(25); ports.add(143); }
    if (/database|primary|replica/.test(role)) { ports.add(rng.chance(.5) ? 5432 : 3306); }
    if (/cache|metrics/.test(role)) { ports.add(rng.chance(.5) ? 6379 : 9200); }
    if (/dns/.test(role)) ports.add(53);
    if (rng.chance(.12)) ports.add(8080);
    if (rng.chance(.08)) ports.add(21);
    if (rng.chance(.06)) ports.add(3389);
    const security = clamp(Math.round(rng.float(34, 92) + (co ? (co.security - 65) * .25 : 0)), 18, 97);
    const vulnCount = security < 45 ? rng.int(2, 4) : security < 70 ? rng.int(0, 3) : rng.int(0, 1);
    const vulns = rng.picks(VULN_TYPES, vulnCount).map(v => makeVuln(rng, v.name, v.service));
    const ownerList = co ? (npcByCompany.get(co.id) || []) : [];
    const owner = ownerList.length ? rng.pick(ownerList) : rng.pick(game.npcs);
    const primary = rng.chance(.5) ? 'deploy' : 'admin';
    const siteKind = /web|portal|status|docs|shop|api|wiki/.test(role) && rng.chance(.42) ? 'generic' : null;
    const server = makeServer(rng, {
      seq: game.seq.server++, ip, host: slug, domain, org: co?.name || 'Independent', companyId: co?.id || null,
      ownerId: owner?.id || null, role, os, ports: [...ports], security, vulns,
      status: rng.chance(.88) ? 'online' : rng.chance(.5) ? 'degraded' : rng.chance(.5) ? 'maintenance' : 'offline',
      tags: rng.picks(TAGS, 2), createdWorld: -rng.int(30, 2600), siteKind, user: primary,
      motd: `${slug} — ${role}. All access is logged.\n`,
      webroot: `<html><body><h1>${co?.name || 'Independent'}</h1><p>${role}. Status: operational.</p></body></html>`
    });
    game.servers.push(server);
    if (co) co.serverIds.push(server.id);
  }
  for (const server of game.servers) {
    if (!server.siteKind) continue;
    const co = game.companies.find(c => c.id === server.companyId);
    const owner = game.npcs.find(n => n.id === server.ownerId) || rng.pick(game.npcs);
    const kind = server.siteKind;
    const title = co ? co.name : server.org === 'NullNet Collective' ? 'NullNet' : server.host;
    const desc = co?.desc || `Public services for ${server.org}.`;
    const sections = siteSectionsFor(kind, co, server, rng);
    const site = makeSite(rng, {
      domain: server.domain, title, kind, category: co?.sector || 'community', ownerId: owner.id,
      companyId: co?.id || null, serverId: server.id, desc, sections,
      links: kind === 'portal' ? ['news.nullnet','market.nullnet','git.nullnet','blackmarket.onion'] : ['portal.nullnet','market.nullnet'],
      ownerType: co ? 'company' : 'npc', tech: kind === 'git' ? 'cgit' : 'nginx'
    });
    game.sites.push(site);
    if (co) co.siteId = site.id;
  }
}

function siteSectionsFor(kind, co, server, rng) {
  switch (kind) {
    case 'portal': return [
      { h: 'The network is a population.', p: 'NullNet is a volunteer-run community network. Boards, mail, git, and a public shell. Slow by design. Useful by accident.' },
      { h: 'Services', p: 'portal.nullnet — boards and shell\nmail.nullnet — public mail\nmarket.nullnet — contract board\ngit.nullnet — public repositories\nnews.nullnet — network wire' },
      { h: 'Conduct', p: 'Read before posting. Report breakage. Do not make the network worse.' }
    ];
    case 'market': return [
      { h: 'Work is a promise.', p: 'The contract board connects independent operators with organizations that need careful work. Escrow is manual. Reputation is public.' },
      { h: 'Open contracts', p: 'Perimeter scans, audits, deployments, incident triage, and the occasional recovery job. Read the objective before accepting.' },
      { h: 'Rates', p: 'Clients set the price. Operators set the standard. Deliver the artifact, get paid.' }
    ];
    case 'git': return [
      { h: 'Public repositories', p: 'netmap — a small network inventory tool\nnullnet-cli — community shell utilities\nstarter-site — a static site template\nicarus-notes — sanitized research notes' },
      { h: 'Clone', p: 'git clone https://git.nullnet/netmap\ngit clone https://git.nullnet/nullnet-cli\n\nRead the license. Some of these are load-bearing.' },
      { h: 'Status', p: 'The forge is community-run. Pull requests are reviewed when someone has time.' }
    ];
    case 'corp': return [
      { h: co ? `${co.name} — ${co.sector}` : 'Corporate portal', p: co?.desc || 'Enterprise services.' },
      { h: 'Careers', p: 'We are hiring across infrastructure, security, and product. Calm under pressure is not a metaphor here.' },
      { h: 'Status', p: 'All systems nominal. Scheduled maintenance windows are announced to customers.' }
    ];
    case 'bank': return [
      { h: 'Banking infrastructure', p: 'FinWise operates regulated financial infrastructure. Access is audited, scoped, and time-limited.' },
      { h: 'Security', p: 'We do not run bug bounties on production. Report vulnerabilities through the coordinated disclosure channel.' },
      { h: 'Notice', p: 'Any unauthorized access attempt is logged and may be referred to the CyberNet Authority.' }
    ];
    case 'research': return [
      { h: 'Helix Labs', p: 'Applied research in distributed systems, telemetry, and machine learning. We publish more than we ship.' },
      { h: 'Project Icarus', p: 'A study of routing anomalies and partial observability. The public artifact is under retention review.' },
      { h: 'Open positions', p: 'Research engineer, data curator, and one technical writer who enjoys arguing about diagrams.' }
    ];
    case 'legacy': return [
      { h: 'OldCo Systems', p: 'This page has not been updated since 2019. Most customer services were migrated. Some infrastructure was not.' },
      { h: 'Migration notice', p: 'All customer accounts have been notified. Remaining infrastructure will be decommissioned by Q3.' },
      { h: 'Contact', p: 'The support address bounces. The status page still resolves.' }
    ];
    case 'shop': return [
      { h: 'Digital goods, independent makers', p: 'PixelBazaar is a marketplace for fonts, icons, templates, small tools, and strange commissions.' },
      { h: 'Featured', p: 'Moth & Co — identity systems\nLattice Press — type specimens\nKestrel — data notebooks' },
      { h: 'Seller notice', p: 'Payouts are processed weekly. Chargebacks are handled by humans, slowly.' }
    ];
    case 'underground': return [
      { h: '0x00', p: 'Access, data, and things that should probably stay buried. Read the rules. There are only three.' },
      { h: 'Boards', p: 'Access offerings\nData and archives\nOPSEC\nContract disputes' },
      { h: 'Warning', p: 'Everything here is fictional and simulated. Do not bring real targets, real credentials, or real harm.' }
    ];
    case 'gov': return [
      { h: 'CyberNet Authority', p: 'The network regulator publishes advisories, enforcement notices, and incident statistics.' },
      { h: 'Advisory 2026-114', p: 'Organizations should verify backup restoration and rotate credentials after legacy migrations.' },
      { h: 'Enforcement', p: 'Unauthorized access to regulated infrastructure may result in suspension, fines, and referral to civil authorities.' }
    ];
    case 'cdn': return [
      { h: 'StaticWave', p: 'Edge hosting and CDN capacity for the long tail of the network. Small sites, global reach.' },
      { h: 'Network', p: 'Anycast edge in 14 regions. Cache hit ratio: 91.4%. Origin shield enabled by default.' },
      { h: 'Status', p: 'All edges nominal. Scheduled maintenance in eu-north at 02:00.' }
    ];
    case 'startup': return [
      { h: 'Northwind Devtools', p: 'Developer tooling for small teams. Fast deploys, honest logs, fewer dashboards.' },
      { h: 'API', p: 'REST and streaming endpoints. Tokens are scoped. Rate limits are real.' },
      { h: 'We are hiring', p: 'Two engineers, one designer, and someone who can explain pricing without a spreadsheet.' }
    ];
    case 'security': return [
      { h: 'Vanta Security', p: 'Incident response and defensive engineering. We are called when the comfortable version of the story stops working.' },
      { h: 'Services', p: 'Retainer response\nCompromise assessment\nDetection engineering\nExecutive communication' },
      { h: 'Disclosure', p: 'Report vulnerabilities through the encrypted channel. Please do not test production.' }
    ];
    case 'news': return [
      { h: co?.name || 'Signal Review', p: co?.desc || 'Independent reporting on infrastructure and digital labor.' },
      { h: 'Latest', p: 'OldCo migration left customer data behind, documents suggest.\nContract board activity rises after hosting consolidation.\nResearchers quietly circulate a routing anomaly paper.' },
      { h: 'Tip line', p: 'Encrypted drop available. Do not use a work account.' }
    ];
    default: return [
      { h: 'About', p: co?.desc || `Services operated by ${server.org}.` },
      { h: 'Status', p: 'Operational. This page is updated infrequently.' },
      { h: 'Contact', p: 'Use the public board. Response times vary.' }
    ];
  }
}

/* ---------------- generation: sites, forums, work, mail, news ---------------- */
function buildSites(game, rng) {
  const used = new Set(game.sites.map(s => s.domain));
  const portal = game.servers.find(s => s.host === 'portal');
  const add = (opts) => {
    if (used.has(opts.domain)) return null;
    used.add(opts.domain);
    const site = makeSite(rng, { ...opts, id: `site-${String(game.seq.site++).padStart(4, '0')}` });
    game.sites.push(site);
    return site;
  };

  add({
    domain: 'news.nullnet', title: 'NullNet Wire', kind: 'news', category: 'news',
    ownerId: game.npcs.find(n => n.handle === 'mirage')?.id || null,
    serverId: portal?.id || null, ownerType: 'community',
    desc: 'The network wire. Events, incidents, and things that changed while you were away.',
    sections: [
      { h: 'Network wire', p: 'Reporting on infrastructure, labor, and the strange edges of the simulated internet.' },
      { h: 'Latest', p: 'The wire is updated continuously by the simulation. Type news in the terminal for a compact view.' },
      { h: 'Tip line', p: 'Encrypted drop available. Do not use a work account.' }
    ],
    links: ['portal.nullnet', 'market.nullnet', 'signalreview.media', 'byteledger.news']
  });
  add({
    domain: 'search.nullnet', title: 'NullSearch', kind: 'search', category: 'tool',
    serverId: portal?.id || null, ownerType: 'community',
    desc: 'A small index of the public network. No tracking. No ranking secrets.',
    sections: [
      { h: 'Search the public network', p: 'Enter a domain, a phrase, or a name. Results are drawn from the live site index.' },
      { h: 'Coverage', p: 'The index is incomplete by design. Private and hidden services are not listed.' }
    ],
    links: ['portal.nullnet', 'news.nullnet']
  });
  add({
    domain: 'status.nullnet', title: 'NullNet Status', kind: 'status', category: 'tool',
    serverId: portal?.id || null, ownerType: 'community',
    desc: 'Service status for the community network.',
    sections: [
      { h: 'Current status', p: 'portal — operational\nmail — operational\nmarket — operational\ngit — operational' },
      { h: 'Incidents', p: 'No active incidents. Maintenance windows are announced on the board.' }
    ],
    links: ['portal.nullnet']
  });

  const orbital = game.companies.find(c => c.name === 'Orbital Cloud');
  add({
    domain: 'orbital.cloud', title: 'Orbital Cloud', kind: 'cloud', category: 'company',
    companyId: orbital?.id || null, ownerType: 'company',
    serverId: game.servers.find(s => s.companyId === orbital?.id)?.id || portal?.id || null,
    desc: 'Compute, storage, and managed services with a global footprint and an opaque pricing page.',
    sections: [
      { h: 'Compute', p: 'Nano, Small, Pro, and GPU nodes. Per-month billing. Egress billed separately.' },
      { h: 'Reliability', p: 'Multi-region capacity with a published SLA and a support queue measured in business days.' },
      { h: 'Developers', p: 'A CLI, an HTTP API, and documentation that is mostly accurate.' }
    ],
    links: ['status.nullnet', 'kestrel.ai', 'basalt.net']
  });
  const kestrel = game.companies.find(c => c.name === 'Kestrel Analytics');
  add({
    domain: 'kestrel.ai', title: 'Kestrel Inference', kind: 'ai', category: 'company',
    companyId: kestrel?.id || null, ownerType: 'company',
    serverId: game.servers.find(s => s.companyId === kestrel?.id)?.id || portal?.id || null,
    desc: 'Hosted model endpoints, agent runtimes, and a very serious usage dashboard.',
    sections: [
      { h: 'Models', p: 'Kestrel Mini, Nimbus 3, Atlas Reason, and Vanta Guard. Context limits vary. So does the bill.' },
      { h: 'Agents', p: 'Run an agent against your own tools and permissions. Human review is strongly recommended.' },
      { h: 'Local inference', p: 'Self-hosted weights are available for operators with GPU capacity and patience.' }
    ],
    links: ['orbital.cloud', 'agents.nullnet', 'portal.nullnet']
  });
  add({
    domain: 'agents.nullnet', title: 'Agent Directory', kind: 'agents', category: 'directory',
    ownerType: 'community', serverId: portal?.id || null,
    desc: 'A public register of autonomous agents, their owners, roles, and current status.',
    sections: [
      { h: 'What this is', p: 'A partial directory of agents operating on the public network. Private agents are not listed.' },
      { h: 'Caveat', p: 'An agent is only as reliable as its permissions, its data, and the person who deployed it.' }
    ],
    links: ['kestrel.ai', 'portal.nullnet', 'news.nullnet']
  });

  const blogOwners = ['hex','mirage','pixel','fable','relay','n0va','onyx','kernel','kestrel'];
  for (const handle of blogOwners) {
    const npc = game.npcs.find(n => n.handle === handle);
    if (!npc) continue;
    add({
      domain: `${handle}.${rng.pick(['blog','notes','dev','net','io','studio'])}`,
      title: `${npc.name} — notes`, kind: 'blog', category: 'personal blog',
      ownerId: npc.id, ownerType: 'npc',
      serverId: rng.pick(game.servers.filter(s => s.status === 'online')).id,
      desc: npc.bio,
      sections: [
        { h: 'Recent notes', p: `${rng.pick(TOPICS)} — a short working note, updated when the thought survives the week.` },
        { h: 'About', p: `${npc.name} is a ${npc.role}. ${npc.bio}` },
        { h: 'Elsewhere', p: `mail: ${npc.email}\nboard: @${npc.handle}` }
      ],
      links: ['portal.nullnet', 'news.nullnet']
    });
  }

  const companyNames = ['Foundry','Tessera','Kite','Spool','Violet','Granite','Willow','Cobalt','Sable','Mosaic'];
  for (let i = 0; i < 38; i++) {
    const co = rng.chance(.4) ? rng.pick(game.companies) : null;
    const owner = rng.pick(game.npcs);
    const word1 = rng.pick(DOMAIN_WORDS);
    const word2 = rng.chance(.35) ? rng.pick(companyNames).toLowerCase() : rng.pick(DOMAIN_WORDS);
    let domain = `${word1}${rng.chance(.5) ? '-' + word2 : ''}${rng.pick(TLDS)}`;
    if (used.has(domain)) domain = `${word1}-${rng.int(10, 99)}${rng.pick(TLDS)}`;
    const category = rng.pick(SITE_CATEGORIES);
    const title = co ? `${co.name} / ${rng.pick(['lab','studio','works','systems','group'])}` : `${rng.pick(companyNames)} ${rng.pick(['Studio','Works','Collective','Systems','Press','Labs'])}`;
    const server = rng.pick(game.servers.filter(s => s.status === 'online'));
    add({
      domain, title, kind: 'generic', category,
      ownerId: owner.id, companyId: co?.id || null, ownerType: co ? 'company' : 'npc',
      serverId: server?.id || null,
      desc: rng.pick([
        'Small tools, careful interfaces, and a public changelog.',
        'Independent infrastructure for people who prefer plain text.',
        'A working archive of projects that survived their authors.',
        'Documentation for systems that are still in use.',
        'A storefront for digital objects and strange commissions.',
        'Notes from the edge of a network nobody owns.'
      ]),
      sections: [
        { h: 'About', p: rng.pick(BIOS) },
        { h: 'Now', p: `Currently ${rng.pick(ACTIVITIES)}.` },
        { h: 'Contact', p: `@${owner.handle} on the NullNet board.` }
      ],
      links: rng.picks(['portal.nullnet','market.nullnet','news.nullnet','git.nullnet'], 2),
      tech: rng.pick(['static','nginx','Caddy','Next.js','Go','Flask'])
    });
  }
}

function buildForums(game, rng) {
  const now = Date.now();
  for (const def of FORUM_DEFS) {
    const id = `forum-${String(game.seq.forum++).padStart(2, '0')}`;
    const threads = def.threads.map((t, ti) => {
      const threadId = `${id}-t${ti + 1}`;
      return {
        id: threadId, title: t.title, author: t.author, pinned: !!t.pinned,
        posts: t.posts.map((body, pi) => ({
          id: `${threadId}-p${pi + 1}`, author: pi === 0 ? t.author : rng.pick(game.npcs).handle,
          body, time: now - (t.posts.length - pi) * rng.int(3, 40) * 60000 - rng.int(1, 20) * 86400000,
          world: game.worldMinutes - (t.posts.length - pi) * rng.int(3, 40)
        }))
      };
    });
    game.forums.push({
      id, name: def.name, domain: def.domain, kind: def.kind, members: def.members,
      desc: def.desc, threads, status: def.kind === 'archive' ? 'archived' : 'live'
    });
  }
}

function buildContracts(game, rng) {
  const byHost = new Map(game.servers.map(s => [s.host, s]));
  const npc = h => game.npcs.find(n => n.handle === h);
  const co = name => game.companies.find(c => c.name === name);
  const add = (templateIndex, targetHost, clientHandle, extra = {}) => {
    const t = CONTRACT_TEMPLATES[templateIndex];
    const target = byHost.get(targetHost);
    const client = npc(clientHandle) || rng.pick(game.npcs);
    const id = `C-${game.seq.contract++}`;
    const pay = extra.pay || Math.round((t.base + rng.int(-40, 120)) * (1 + t.difficulty * .08));
    const objective = objectiveFor(t.type, target, extra);
    const contract = {
      id, title: extra.title || t.title, desc: extra.desc || t.desc,
      clientId: client.id, clientHandle: client.handle, companyId: client.companyId,
      pay, difficulty: t.difficulty, tags: t.tags, status: 'open', objective,
      progress: 0, createdWorld: game.worldMinutes, acceptedWorld: null, deliveredWorld: null,
      deadlineWorld: game.worldMinutes + (extra.days || (t.difficulty + 2)) * MINUTES_PER_DAY,
      requirements: extra.requirements || `Deliver: ${objective.label}`, bonus: extra.bonus || 0,
      escrow: Math.round(pay * .2)
    };
    game.contracts.push(contract);
    return contract;
  };

  add(0, 'meridian-mail', 'relay', { title: 'Meridian perimeter inventory', desc: 'Enumerate exposed services on the Meridian mail edge. The client wants a clean inventory, not a story.', days: 4 });
  add(1, 'portal-prod', 'hex', { title: 'Audit the Acme customer portal', desc: 'Acme wants an independent review of the customer portal before a board meeting. Evidence beats speculation.', pay: 1800, days: 5 });
  add(2, 'oldco', 'lumen', { title: 'Harden the OldCo gateway', desc: 'The abandoned OldCo host is still answering. Close the known exposure and verify it from outside.', pay: 640, days: 4 });
  add(7, 'oldco', 'v0id', { title: 'Recover the OldCo archive', desc: 'Retrieve the archive manifest from the abandoned host. The client is paying for access, not destruction.', pay: 1100, days: 4 });
  add(3, 'api', 'atlas', { title: 'Landing page for Northwind', desc: 'Build a small static landing page in ~/projects/landing/index.html. Fast, readable, no tracking.', pay: 620, days: 5, path: '/home/operator/projects/landing/index.html', minLines: 8 });
  add(2, 'vault', 'cipher', { title: 'Close the FinWise exposure', desc: 'A database port is reachable from the edge. Close it, verify the change, and document the window.', pay: 2400, days: 6 });
  add(9, 'icarus', 'hex', { title: 'Network monitor prototype', desc: 'Write a small Python monitor in ~/projects/monitor.py that checks a host list and reports reachability.', pay: 780, days: 6, path: '/home/operator/projects/monitor.py', minLines: 6 });
  add(1, 'icarus', 'mirage', { title: 'Trace the Icarus leak', desc: 'A sanitized research note is circulating. Find the exposed repository and document the path.', pay: 1320, days: 6 });
  add(5, 'portal', 'relay', { title: 'Deploy a community mirror', desc: 'Publish a static mirror on infrastructure you control. Keep it reachable for a cycle.', pay: 420, days: 7 });
  add(0, 'cinder-web', 'lumen', { title: 'Cinder edge inventory', desc: 'Cinder needs a current service inventory for its logistics portal. Do not touch production data.', pay: 360, days: 3 });
  add(12, 'api', 'atlas', { title: 'API authentication review', desc: 'Northwind suspects its staging token leaked into a client bundle. Review the token lifecycle.', pay: 1450, days: 5 });
  add(10, 'signal', 'mirage', { title: 'Phishing infrastructure trace', desc: 'A campaign is using a small hosting provider. Trace the infrastructure and identify the operator.', pay: 1580, days: 6 });
  add(6, 'portal-prod', 'cipher', { title: 'Acme incident triage', desc: 'Review the portal for signs of unauthorized access after an alert. Produce a timeline.', pay: 1700, days: 5 });
  add(8, 'meridian-mail', 'onyx', { title: 'Database performance review', desc: 'Profile the Meridian mail database, identify the slow query, and recommend an index.', pay: 880, days: 5 });

  for (let i = 0; i < 5; i++) {
    const tIndex = rng.int(0, CONTRACT_TEMPLATES.length - 1);
    const t = CONTRACT_TEMPLATES[tIndex];
    const candidates = game.servers.filter(s => s.status === 'online' && s.host !== 'cybernet' && !s.owned);
    const target = rng.pick(candidates);
    const client = rng.pick(game.npcs);
    const id = `C-${game.seq.contract++}`;
    const objective = objectiveFor(t.type, target, t.type === 'code' ? { path: `/home/operator/projects/${rng.pick(['tool','site','monitor','report'])}.${t.tags.includes('web') ? 'html' : 'py'}`, minLines: 5 } : {});
    game.contracts.push({
      id, title: t.title, desc: t.desc, clientId: client.id, clientHandle: client.handle,
      companyId: client.companyId, pay: Math.round((t.base + rng.int(-30, 90)) * (1 + t.difficulty * .06)),
      difficulty: t.difficulty, tags: t.tags, status: 'open', objective, progress: 0,
      createdWorld: game.worldMinutes, acceptedWorld: null, deliveredWorld: null,
      deadlineWorld: game.worldMinutes + (t.difficulty + 3) * MINUTES_PER_DAY,
      requirements: `Deliver: ${objective.label}`, bonus: 0, escrow: 0
    });
  }
}

function buildMail(game, rng) {
  const now = Date.now();
  const add = (from, subject, body, opts = {}) => {
    const npc = game.npcs.find(n => n.handle === from);
    const mail = {
      id: game.seq.mail++, from, to: 'operator', subject, body,
      time: now - (opts.age || 0) * 60000, read: !!opts.read, outbound: false,
      npcId: npc?.id || null, threadId: opts.threadId || `th-${game.seq.mail}`
    };
    game.mail.push(mail);
    return mail;
  };
  add('hex', 'Welcome to the contract board', `Operator,

I saw your profile go live. You have a clean machine and no history, which is either an advantage or a warning depending on who is reading.

The board is open. Start with something small: an inventory, a patch, a landing page. Deliver the artifact. Reputation compounds.

If you want a real audit later, find me.

— hex
Helix Labs`, { age: 42 });
  add('lumen', 'Acme portal — second pair of eyes?', `Hello,

I maintain the customer portal at Acme. We have a board meeting next week and I would rather know what is exposed before someone else tells them.

There is a contract on the board. It is not glamorous. It is, unfortunately, real.

— Sana Okafor
Acme Industries`, { age: 96, threadId: 'th-acme' });
  add('mirage', 'The OldCo migration did not finish', `I have been looking at OldCo for a month. The status page says the migration completed. The DNS says otherwise.

The old host still answers. If you find documentation, I would like to see it. If you find customer data, do not send it to me unencrypted.

This is a story, not a heist.

— Noor Haddad
Signal Review`, { age: 140 });
  add('atlas', 'Landing page — small budget, real deadline', `We need a landing page for the new developer tools launch. Static, fast, no tracking pixels. The board has the details.

If it goes well there is more work. If it goes badly there is a postmortem.

— Jonas Berg
Northwind Devtools`, { age: 180 });
  add('v0id', 'If you want faster money', `The board is for people who like paperwork. There are other ways to get paid.

OldCo still has an archive. Nobody important is watching. Probably.

Do not reply from a machine you care about.

— v0id`, { age: 220, read: false });
  game.seq.mail += 10;
}

function buildNews(game, rng) {
  const now = Date.now();
  for (let i = 0; i < 14; i++) {
    addNews(game, rng, { time: now - i * 42 * 60000, world: game.worldMinutes - i * 7, silent: true });
  }
  game.news.sort((a, b) => b.time - a.time);
}

function buildProcesses(game, rng) {
  const defs = [
    [1, 'root', 0.1, 0.4, '/sbin/init splash'],
    [412, 'root', 0.0, 0.1, '/usr/sbin/sshd -D'],
    [688, 'root', 0.3, 0.6, '/usr/sbin/NetworkManager --no-daemon'],
    [941, 'root', 1.2, 2.1, '/usr/lib/xorg/Xorg :0 -seat seat0'],
    [1102, 'operator', 0.7, 3.8, '/usr/bin/gnome-shell'],
    [1320, 'operator', 0.0, 0.1, '/usr/bin/dbus-daemon --session'],
    [1401, 'operator', 0.0, 0.0, '-bash'],
    [1556, 'operator', 0.1, 0.2, 'sshd: operator@pts/0'],
    [1684, 'operator', 0.0, 0.1, '/usr/bin/tmux new -s work'],
    [1810, 'operator', 1.6, 5.2, 'node /opt/nullnet/ui.js'],
    [2011, 'operator', 0.0, 0.1, 'python3 -m http.server 8080'],
    [2204, 'postgres', 0.2, 1.4, 'postgres: checkpointer'],
    [2301, 'operator', 0.4, 0.8, 'htop'],
    [2440, 'root', 0.0, 0.0, 'kworker/2:1-events']
  ];
  game.processes = defs.map(([pid, user, cpu, mem, command], i) => ({
    pid, user, cpu, mem, command, state: i % 9 === 0 ? 'S' : 'S', started: Date.now() - rng.int(1, 50) * 60000
  }));
}

function buildRepos(game, rng) {
  game.repos = [
    {
      name: 'netmap', domain: 'git.nullnet', owner: 'relay', stars: 184, lang: 'Python',
      desc: 'A small network inventory tool. Reads a host list, checks reachability, writes plain text.',
      files: {
        'README.md': '# netmap\n\nA small network inventory tool. No dependencies beyond Python 3.\n\n    python3 netmap.py hosts.txt\n\nOutput is plain text so it can be diffed.\n',
        'netmap.py': '#!/usr/bin/env python3\nimport socket\nimport sys\n\nhosts = ["10.0.0.1", "203.0.113.10", "192.0.2.13"]\nfor host in hosts:\n    print("checking", host)\nprint("inventory complete:", len(hosts), "hosts")\n',
        'LICENSE': 'MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy...\n'
      }
    },
    {
      name: 'nullnet-cli', domain: 'git.nullnet', owner: 'fable', stars: 92, lang: 'Bash',
      desc: 'Community shell utilities for the NullNet boards.',
      files: {
        'README.md': '# nullnet-cli\n\nSmall shell helpers for the board.\n',
        'board.sh': '#!/usr/bin/env bash\necho "nullnet board"\necho "contracts: market.nullnet"\necho "wire: news.nullnet"\n',
        'LICENSE': 'MIT License\n'
      }
    },
    {
      name: 'starter-site', domain: 'git.nullnet', owner: 'pixel', stars: 311, lang: 'HTML',
      desc: 'A static site template with no build step and no tracking.',
      files: {
        'README.md': '# starter-site\n\nCopy this directory. Edit index.html. Publish it somewhere.\n',
        'index.html': '<!doctype html>\n<html><head><title>Starter</title></head>\n<body><h1>Starter site</h1><p>Replace this text.</p></body></html>\n',
        'style.css': 'body { font-family: system-ui; max-width: 640px; margin: 4rem auto; }\n'
      }
    },
    {
      name: 'icarus-notes', domain: 'git.nullnet', owner: 'hex', stars: 47, lang: 'Markdown',
      desc: 'Sanitized notes from the Icarus routing anomaly study.',
      files: {
        'README.md': '# Icarus notes (sanitized)\n\nWe observed that partial telemetry can predict routing anomalies with modest accuracy.\nThe full dataset is under retention review.\n',
        'notes/experiment-1.md': 'Experiment 1: baseline telemetry.\nResult: the anomaly is visible in the edge sample before it is visible in the core.\n',
        'notes/experiment-2.md': 'Experiment 2: partial observability.\nResult: prediction improves when the sample is biased toward the edge.\n'
      }
    }
  ];
}

/* ============================================================
   LOOKUPS + DERIVED STATE
   ============================================================ */
export function getServer(game, query) {
  if (!query) return null;
  let q = String(query).trim().toLowerCase();
  q = q.replace(/^ssh:\/\//, '').replace(/^https?:\/\//, '').split('/')[0];
  if (q.includes('@')) q = q.split('@').pop();
  q = q.replace(/:\d+$/, '');
  const site = getSite(game, q);
  if (site?.serverId) {
    const bySite = game.servers.find(s => s.id === site.serverId);
    if (bySite) return bySite;
  }
  return game.servers.find(s => s.ip === q || s.host.toLowerCase() === q || s.domain.toLowerCase() === q) || null;
}
export function getSite(game, query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/:\d+$/, '');
  return game.sites.find(s => s.domain.toLowerCase() === q) || null;
}
export function getNpc(game, query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase().replace(/^@/, '');
  return game.npcs.find(n => n.handle.toLowerCase() === q || n.id === q || n.name.toLowerCase() === q) || null;
}
export function getCompany(game, query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();
  return game.companies.find(c => c.name.toLowerCase() === q || c.domain.toLowerCase() === q || c.id === q) || null;
}
export function getContract(game, id) {
  const q = String(id || '').toUpperCase();
  return game.contracts.find(c => c.id.toUpperCase() === q || c.id === id) || null;
}
export function playerSites(game) { return game.sites.filter(s => s.ownerType === 'player' || s.ownerId === 'player'); }
export function ownedServers(game) { return game.servers.filter(s => s.owned); }
export function onlineNpcs(game) { return game.npcs.filter(n => n.online); }
export function onlineCount(game) { return onlineNpcs(game).length + 36 + (game.tickCount % 17); }
export function marketIndex(game) { return Math.round(game.market.index * 10) / 10; }
export function netWorth(game) {
  const owned = ownedServers(game);
  const serverValue = owned.reduce((s, x) => s + (x.plan === 'dedicated' ? 1800 : x.plan === 'standard' ? 700 : 260), 0);
  const siteValue = playerSites(game).reduce((s, x) => s + Math.min(4000, Math.round(x.visits * .25)), 0);
  const inv = Object.values(game.player.inventory || {}).reduce((s, n) => s + Number(n || 0), 0) * 40;
  return game.player.money + serverValue + siteValue + game.player.domains.length * 18 + inv;
}
export function getPlayerSkill(game) {
  const s = game.stats;
  return clamp(1 + Math.floor(s.scans * .10 + s.audits * .65 + s.exploits * .9 + s.patches * .45 + s.contracts * 1.15 + s.deploys * .35 + s.codeLines * .004 + (game.player.bonusSkill || 0)), 1, 10);
}
export const SKILL_TITLES = ['', 'novice', 'apprentice', 'practitioner', 'operator', 'specialist', 'senior operator', 'expert', 'veteran', 'master', 'architect'];
export function skillTitle(game) { return SKILL_TITLES[getPlayerSkill(game)] || 'operator'; }
export function playerTitle(game) {
  const rep = game.player.reputation;
  const owned = ownedServers(game).length;
  if (rep >= 80 && owned >= 2) return 'network figure';
  if (rep >= 60) return 'trusted contractor';
  if (owned >= 1 && rep >= 30) return 'infrastructure owner';
  if (rep >= 30) return 'working operator';
  if (game.stats.contracts >= 1) return 'independent operator';
  return 'unproven';
}
export function threatInfo(game) {
  const heat = game.player.heat;
  if (heat >= 70) return { label: 'SEVERE', level: 4, color: 'red' };
  if (heat >= 42) return { label: 'ELEVATED', level: 3, color: 'amber' };
  if (heat >= 18) return { label: 'GUARDED', level: 2, color: 'amber' };
  return { label: 'LOW', level: 1, color: 'green' };
}
export function worldClock(game) {
  const total = Math.max(0, Math.floor(game.worldMinutes));
  const day = Math.floor(total / MINUTES_PER_DAY);
  const mins = total % MINUTES_PER_DAY;
  return {
    day: day + 1, cycle: day + 1,
    hh: String(Math.floor(mins / 60)).padStart(2, '0'),
    mm: String(mins % 60).padStart(2, '0'),
    date: new Date(game.createdAt + day * 86400000)
  };
}
export function sitesForServer(game, serverId) { return game.sites.filter(s => s.serverId === serverId); }

/* ============================================================
   WORLD EVENTS, MONEY, REPUTATION
   ============================================================ */
export function addFeed(game, text, kind = 'info') {
  game.feed.unshift({ id: game.seq.feed++, time: Date.now(), world: game.worldMinutes, text, kind });
  if (game.feed.length > 80) game.feed.length = 80;
}
export function addNews(game, rng = null, opts = {}) {
  rng = rng || makeRng((game.seed ^ game.worldMinutes ^ game.news.length) >>> 0);
  const company = rng.pick(game.companies);
  const npc = rng.pick(game.npcs);
  const server = rng.pick(game.servers);
  const domain = rng.pick(game.sites)?.domain || server.domain;
  const topic = rng.pick(TOPICS);
  const template = rng.pick(NEWS_TEMPLATES);
  const headline = opts.headline || template
    .replace('{company}', company.name)
    .replace('{npc}', npc.name)
    .replace('{domain}', domain)
    .replace('{ip}', server.ip)
    .replace('{pct}', String(rng.int(2, 38)))
    .replace('{mins}', String(rng.int(3, 55)))
    .replace('{n}', String(rng.int(2, 19)))
    .replace('{role}', rng.pick(['systems administrator','security analyst','platform engineer','technical writer']))
    .replace('{topic}', topic);
  const item = {
    id: game.seq.news++, time: opts.time || Date.now(), world: opts.world ?? game.worldMinutes,
    source: opts.source || rng.pick(NEWS_SOURCES), headline,
    body: opts.body || `${headline} ${rng.pick([
      'The details are sparse and the people involved prefer it that way.',
      'A spokesperson described the situation as "contained."',
      'No customer data has been confirmed exposed.',
      'The change was visible in public telemetry for several minutes.',
      'Independent observers have not verified the claim.',
      'The organization says a full review is underway.'
    ])}`,
    tags: opts.tags || rng.picks(['infrastructure','security','market','community','labor','policy'], 2)
  };
  game.news.unshift(item);
  if (game.news.length > 70) game.news.length = 70;
  if (!opts.silent) addFeed(game, headline, 'news');
  return item;
}
export function addMail(game, opts) {
  const npc = opts.npcId ? game.npcs.find(n => n.id === opts.npcId) : getNpc(game, opts.from);
  const mail = {
    id: game.seq.mail++, from: opts.from || 'unknown', to: opts.to || 'operator',
    subject: opts.subject || '(no subject)', body: opts.body || '', time: opts.time || Date.now(),
    read: !!opts.read, outbound: !!opts.outbound, npcId: npc?.id || null,
    threadId: opts.threadId || `th-${game.seq.mail}`
  };
  game.mail.push(mail);
  if (game.mail.length > 120) game.mail = game.mail.slice(-120);
  return mail;
}
export function unreadMail(game) { return game.mail.filter(m => !m.outbound && !m.read).length; }
export function addMoney(game, amount, memo) {
  amount = Math.round(amount);
  game.player.money += amount;
  if (amount > 0) game.stats.earned += amount;
  else game.stats.spent += Math.abs(amount);
  game.player.transactions.unshift({ time: Date.now(), amount, memo, balance: game.player.money });
  if (game.player.transactions.length > 120) game.player.transactions.length = 120;
  return game.player.money;
}
export function awardReputation(game, amount, reason) {
  game.player.reputation = clamp(game.player.reputation + amount, 0, 100);
  if (reason) addFeed(game, `Reputation ${amount >= 0 ? '+' : ''}${amount}: ${reason}`, amount >= 0 ? 'good' : 'bad');
}
export function addHeat(game, amount, reason) {
  let a = amount;
  if (game.player.inventory.proxy > 0) a *= .68;
  if (game.player.inventory.vpn > 0) a *= .85;
  game.player.heat = clamp(game.player.heat + a, 0, 100);
  if (reason) addFeed(game, `Trace exposure +${Math.round(a)}: ${reason}`, 'bad');
  return game.player.heat;
}
export function reduceHeat(game, amount) {
  game.player.heat = clamp(game.player.heat - amount, 0, 100);
}
export function investigate(game, reason = 'anomalous activity') {
  const rng = makeRng((game.seed ^ game.worldMinutes ^ 0x9e37) >>> 0);
  const fine = Math.min(Math.max(120, Math.round(game.player.money * .18)), 4200);
  game.player.money = Math.max(0, game.player.money - fine);
  game.player.heat = clamp(game.player.heat - 42, 0, 100);
  game.player.reputation = clamp(game.player.reputation - rng.int(3, 9), 0, 100);
  const event = { time: Date.now(), fine, reason, authority: 'CyberNet Authority' };
  game.legal.push(event);
  addMail(game, {
    from: 'notice', subject: 'Enforcement notice / trace resolution',
    body: `An investigation into ${reason} has been resolved administratively.\n\nFine: ${fmtMoney(fine)}\nCase: CN-${rng.int(10000, 99999)}\n\nThe network regulator reminds all operators that persistent access is not consent. Further findings may result in suspension of network privileges.\n\n— CyberNet Authority`,
    npcId: null
  });
  addFeed(game, `Investigation resolved: ${fmtMoney(fine)} fine and reputation loss.`, 'bad');
  return event;
}
export function checkAchievements(game, silent = false) {
  const p = game.player;
  const owned = ownedServers(game).length;
  const partners = new Set(game.mail.filter(m => !m.outbound).map(m => m.from));
  const conditions = {
    boot: true,
    scan: game.stats.scans >= 1,
    shell: game.stats.logins >= 1,
    contract: game.stats.contracts >= 1,
    deploy: game.stats.deploys >= 1,
    paid: game.stats.earned >= 1000,
    patch: game.stats.patches >= 1,
    reputation: p.reputation >= 50,
    network: owned >= 3,
    clean: game.stats.contracts >= 1 && p.heat <= 0,
    reader: partners.size >= 5,
    news: game.stats.newsRead >= 10
  };
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!conditions[a.id] || game.achievements[a.id]) continue;
    game.achievements[a.id] = Date.now();
    p.achievements[a.id] = true;
    unlocked.push(a);
    if (!silent) addFeed(game, `Achievement unlocked — ${a.name}`, 'good');
  }
  return unlocked;
}
export function updateDerived(game) {
  game.player.skill = getPlayerSkill(game);
  game.player.title = playerTitle(game);
  game.cycle = worldClock(game).cycle;
}

/* ============================================================
   CONTRACTS
   ============================================================ */
export function objectiveSatisfied(game, contract) {
  const o = contract.objective;
  if (!o) return false;
  if (o.type === 'scan') return !!game.flags.scanned[o.target];
  if (o.type === 'audit') return !!game.flags.audited[o.target];
  if (o.type === 'patch') return !!game.flags.patched[o.target];
  if (o.type === 'exploit') return !!game.flags.exploited[o.target];
  if (o.type === 'deploy') return game.stats.deploys > 0 || playerSites(game).length > 0;
  if (o.type === 'code') {
    const path = o.path?.startsWith('/') ? o.path : resolvePath(HOME, o.path || '');
    const node = getNode(game.fs, path);
    if (!node || node.type !== 'file') return false;
    return node.content.trim().split('\n').length >= (o.minLines || 4);
  }
  return false;
}
export function acceptContract(game, contract) {
  if (!contract) return { ok: false, error: 'No such contract.' };
  if (contract.status !== 'open') return { ok: false, error: `Contract is ${contract.status}.` };
  contract.status = 'active';
  contract.acceptedWorld = game.worldMinutes;
  const npc = game.npcs.find(n => n.id === contract.clientId);
  if (npc) { game.player.relations[npc.handle] = (game.player.relations[npc.handle] || 0) + 2; npc.sent++; }
  addFeed(game, `Accepted ${contract.id}: ${contract.title}`, 'work');
  return { ok: true, contract };
}
export function submitContract(game, contract) {
  if (!contract) return { ok: false, error: 'No such contract.' };
  if (contract.status !== 'active') return { ok: false, error: `Contract is ${contract.status}.` };
  if (!objectiveSatisfied(game, contract)) return { ok: false, error: 'Objective not yet satisfied. ' + (contract.objective.hint || '') };
  contract.status = 'done';
  contract.deliveredWorld = game.worldMinutes;
  game.stats.contracts++;
  game.player.contractsDone++;
  const pay = contract.pay + (contract.bonus || 0);
  addMoney(game, pay, `contract ${contract.id}`);
  const rep = clamp(2 + contract.difficulty, 2, 9);
  awardReputation(game, rep, `delivered ${contract.id}`);
  const npc = game.npcs.find(n => n.id === contract.clientId);
  if (npc) {
    game.player.relations[npc.handle] = (game.player.relations[npc.handle] || 0) + 6;
    npc.received++;
    addMail(game, {
      from: npc.handle, subject: `re: ${contract.title}`,
      body: `Payment sent for ${contract.id}. ${['Clean work.','Received. Thanks.','Delivered as described.','Good. I will keep you in mind.','That is exactly what I needed.'][contract.difficulty % 5]}\n\n— ${npc.name}`,
      npcId: npc.id
    });
  }
  addFeed(game, `Contract delivered: ${contract.id} — ${fmtMoney(pay)}`, 'good');
  checkAchievements(game);
  return { ok: true, pay, rep };
}
export function generateContract(game, rng = null) {
  rng = rng || makeRng((game.seed ^ game.worldMinutes ^ 0x51ed) >>> 0);
  const t = rng.pick(CONTRACT_TEMPLATES);
  const candidates = game.servers.filter(s => s.status === 'online' && s.host !== 'cybernet' && !s.owned);
  if (!candidates.length) return null;
  const target = rng.pick(candidates);
  const client = rng.pick(game.npcs);
  const extra = t.type === 'code' ? {
    path: `/home/operator/projects/${rng.pick(['tool','site','monitor','report','client'])}.${t.tags.includes('web') ? 'html' : 'py'}`,
    minLines: rng.int(5, 9)
  } : {};
  const objective = objectiveFor(t.type, target, extra);
  const contract = {
    id: `C-${game.seq.contract++}`, title: t.title, desc: t.desc,
    clientId: client.id, clientHandle: client.handle, companyId: client.companyId,
    pay: Math.round((t.base + rng.int(-50, 150)) * (1 + t.difficulty * .07)),
    difficulty: t.difficulty, tags: t.tags, status: 'open', objective, progress: 0,
    createdWorld: game.worldMinutes, acceptedWorld: null, deliveredWorld: null,
    deadlineWorld: game.worldMinutes + (t.difficulty + 3) * MINUTES_PER_DAY,
    requirements: `Deliver: ${objective.label}`, bonus: 0, escrow: 0
  };
  game.contracts.push(contract);
  addFeed(game, `New contract posted: ${contract.title} (${fmtMoney(contract.pay)})`, 'work');
  return contract;
}

/* ============================================================
   ECONOMY / INFRASTRUCTURE / SECURITY
   ============================================================ */
export function buyShopItem(game, item) {
  if (!item) return { ok: false, error: 'Unknown item.' };
  if (game.player.money < item.price) return { ok: false, error: `Insufficient funds. Need ${fmtMoney(item.price)}.` };
  if (item.id === 'domain') return { ok: false, error: 'Register a domain with: buy domain <name>' };
  addMoney(game, -item.price, `purchase ${item.name}`);
  game.stats.purchases++;
  if (item.kind === 'infra' && item.server) {
    const server = createOwnedServer(game, item);
    addFeed(game, `Provisioned ${item.name} at ${server.ip}`, 'good');
    return { ok: true, server, item };
  }
  if (item.id === 'course') {
    game.player.bonusSkill = (game.player.bonusSkill || 0) + 1;
    addFeed(game, 'Completed the offensive lab. Skill increased.', 'good');
    updateDerived(game);
    return { ok: true, item };
  }
  if (item.id === 'ids') {
    const owned = ownedServers(game);
    if (owned.length) { owned[0].security = clamp(owned[0].security + 12, 0, 99); owned[0].tags.push('ids'); }
    else game.player.inventory.ids++;
    addFeed(game, 'IDS appliance installed.', 'good');
    return { ok: true, item };
  }
  game.player.inventory[item.id] = (game.player.inventory[item.id] || 0) + 1;
  addFeed(game, `Purchased ${item.name}.`, 'info');
  return { ok: true, item };
}
export function createOwnedServer(game, item) {
  const rng = makeRng((game.seed ^ game.seq.server ^ 0x77aa) >>> 0);
  const id = `srv-owned-${String(game.seq.server++).padStart(3, '0')}`;
  const host = `node-${rng.int(100, 999)}.operator.host`;
  const ip = `198.51.100.${rng.int(220, 250)}`;
  const server = makeServer(rng, {
    id, seq: game.seq.server, ip, host, domain: host, org: 'operator', role: 'personal node',
    os: 'Debian GNU/Linux 12 (bookworm)', security: 54, ports: [22, 80, 443],
    user: 'operator', owned: true, ownerId: 'player', status: 'online',
    tags: ['owned','web'], motd: 'Your node. Keep it patched.\n',
    webroot: '<html><body><h1>It works.</h1><p>Your first node is online.</p></body></html>'
  });
  server.plan = item.id === 'vps-dedicated' ? 'dedicated' : item.id === 'vps-std' ? 'standard' : 'micro';
  server.monthly = item.price;
  server.cpu = item.server.cpu; server.ram = item.server.ram; server.disk = item.server.disk;
  server.createdWorld = game.worldMinutes;
  game.servers.push(server);
  return server;
}
export function registerDomain(game, name) {
  let domain = String(name || '').toLowerCase().trim();
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)) return { ok: false, error: 'Invalid domain name. Use something like quietfield.net.' };
  if (game.sites.some(s => s.domain === domain)) return { ok: false, error: 'Domain is already registered.' };
  if (game.player.money < 18) return { ok: false, error: 'Insufficient funds. Domain registration costs $18.' };
  addMoney(game, -18, `domain ${domain}`);
  game.player.domains.push(domain);
  addFeed(game, `Registered ${domain}.`, 'good');
  return { ok: true, domain };
}
export function deploySite(game, { domain, dir, serverId, title }) {
  const server = game.servers.find(s => s.id === serverId) || ownedServers(game)[0];
  if (!server) return { ok: false, error: 'No owned server. Buy one with: buy vps-std' };
  if (!server.owned) return { ok: false, error: 'That server is not yours.' };
  if (server.status === 'offline') return { ok: false, error: 'Server is offline.' };
  if (game.sites.some(s => s.domain === domain)) return { ok: false, error: 'Domain is already in use.' };
  const path = resolvePath(HOME, dir || '.');
  const node = getNode(game.fs, path);
  if (!node || node.type !== 'dir') return { ok: false, error: 'Source directory not found.' };
  const files = allFiles(game.fs, path);
  const index = files.find(f => /(^|\/)index\.html$/.test(f.path));
  const rng = makeRng((game.seed ^ game.seq.site ^ 0x33cc) >>> 0);
  const body = index ? index.node.content : `<html><body><h1>${title || domain}</h1><p>Deployed from ${path}.</p></body></html>`;
  const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const site = makeSite(rng, {
    domain, title: title || domain, kind: 'player', category: 'independent',
    ownerId: 'player', ownerType: 'player', serverId: server.id,
    desc: `Independent site operated by operator. ${files.length} files deployed.`,
    sections: [{ h: 'Deployed', p: `Source: ${path}\nFiles: ${files.length}\nServer: ${server.ip}\nStatus: live` }, { h: 'Content', p: text.slice(0, 700) || 'A quiet corner of the network.' }],
    links: ['portal.nullnet','market.nullnet'], visits: rng.int(5, 40), status: 'live', tech: 'static'
  });
  game.sites.push(site);
  game.stats.deploys++;
  game.stats.sites++;
  if (!game.player.domains.includes(domain)) game.player.domains.push(domain);
  server.tags = [...new Set([...server.tags, 'hosting'])];
  addFeed(game, `Deployed ${domain} on ${server.ip} (${files.length} files)`, 'good');
  checkAchievements(game);
  return { ok: true, site, server, files: files.length };
}
export function auditServer(game, server) {
  if (!server) return { ok: false, error: 'No such host.' };
  const discovered = server.vulns.filter(v => !v.patched && !v.discovered);
  for (const v of server.vulns) if (!v.patched) v.discovered = true;
  game.flags.audited[server.id] = { time: Date.now(), findings: server.vulns.filter(v => !v.patched).length };
  game.stats.audits++;
  addFeed(game, `Audit completed on ${server.host}: ${server.vulns.filter(v => !v.patched).length} finding(s)`, 'info');
  if (discovered.length) addHeat(game, 1.5, `audit of ${server.host}`);
  return { ok: true, server, findings: server.vulns.filter(v => !v.patched), discovered: discovered.length };
}
export function patchServer(game, server) {
  if (!server) return { ok: false, error: 'No such host.' };
  const open = server.vulns.filter(v => !v.patched);
  if (!open.length) return { ok: false, error: 'No known open vulnerabilities to patch.' };
  for (const v of open) v.patched = true;
  server.security = clamp(server.security + 7 + open.length * 2, 0, 99);
  server.notes.unshift(`Patched ${open.length} finding(s) at cycle ${worldClock(game).cycle}.`);
  if (server.notes.length > 8) server.notes.length = 8;
  game.flags.patched[server.id] = { time: Date.now(), count: open.length };
  game.stats.patches++;
  addFeed(game, `Patched ${open.length} finding(s) on ${server.host}; security now ${server.security}.`, 'good');
  checkAchievements(game);
  return { ok: true, count: open.length, server };
}
export function exploitServer(game, server, vulnId) {
  if (!server) return { ok: false, error: 'No such host.' };
  if (server.status === 'offline') return { ok: false, error: 'Host is offline.' };
  const candidates = server.vulns.filter(v => !v.patched && v.discovered);
  if (!candidates.length) return { ok: false, error: 'No discovered exploit vector. Run: vulnscan ' + server.host };
  const vuln = vulnId ? candidates.find(v => v.id.toLowerCase() === String(vulnId).toLowerCase()) : candidates.sort((a, b) => (b.severity === 'critical') - (a.severity === 'critical'))[0];
  if (!vuln) return { ok: false, error: 'That vulnerability is not known on this host.' };
  if (server.host === 'cybernet') {
    addHeat(game, 45, 'interaction with a monitored regulator host');
    const ev = investigate(game, 'unauthorized interaction with CyberNet infrastructure');
    return { ok: false, error: 'The connection is terminated immediately. A regulator trace has been opened.', legal: ev };
  }
  const rng = makeRng((game.seed ^ game.worldMinutes ^ server.id.length ^ 0xabc) >>> 0);
  const skill = getPlayerSkill(game);
  const sevBonus = vuln.severity === 'critical' ? .18 : vuln.severity === 'high' ? .1 : 0;
  let chance = clamp(.48 + skill * .045 + sevBonus - server.security * .0065, .08, .94);
  if (server.compromised) chance = .98;
  const success = rng.chance(chance);
  if (!success) {
    addHeat(game, 9 + (100 - server.security) * .05, `failed intrusion attempt on ${server.host}`);
    server.history.unshift({ time: Date.now(), text: 'Failed intrusion attempt detected.' });
    return { ok: false, error: 'Exploit failed. The service reset the connection. You may have left a trace.' };
  }
  server.compromised = true;
  game.flags.exploited[server.id] = { time: Date.now(), vuln: vuln.id };
  game.flags.hacked[server.id] = true;
  game.stats.exploits++;
  addHeat(game, 8 + (vuln.severity === 'critical' ? 8 : 4) + (100 - server.security) * .08, `intrusion on ${server.host}`);
  const loot = [];
  const files = allFiles(server.fs, '/');
  for (const f of files) {
    if (/(backup|manifest|\.env|README|notes|conf)$/i.test(f.path) && loot.length < 3) {
      const dest = `/home/operator/downloads/${server.host}-${f.path.split('/').pop()}`;
      writeFile(game.fs, dest, f.node.content, { owner: 'operator' });
      loot.push(dest);
    }
  }
  server.notes.unshift(`Compromised at cycle ${worldClock(game).cycle}; access retained.`);
  addFeed(game, `Shell obtained on ${server.host} (${server.ip}) via ${vuln.id}.`, 'bad');
  checkAchievements(game);
  return { ok: true, server, vuln, loot, user: 'root' };
}
export function sendPlayerMail(game, handle, subject, body) {
  const npc = getNpc(game, handle);
  if (!npc) return { ok: false, error: `No such handle: ${handle}` };
  addMail(game, { from: 'operator', to: npc.handle, subject, body, outbound: true, npcId: npc.id });
  game.stats.mailsSent++;
  npc.received++;
  game.player.relations[npc.handle] = (game.player.relations[npc.handle] || 0) + 1;
  game.pendingReplies.push({ handle: npc.handle, atWorld: game.worldMinutes + makeRng((game.seed ^ game.seq.mail) >>> 0).int(4, 16), subject, body });
  addFeed(game, `Mail sent to @${npc.handle}.`, 'info');
  return { ok: true, npc };
}
function npcReply(npc, subject, body, rng) {
  const text = `${subject} ${body}`.toLowerCase();
  if (/audit|vuln|security|expos/.test(text)) return `Scope noted. I care about evidence, not adjectives. If you find something real, write it up with a reproduction path and the affected service.\n\nRate depends on whether the report needs to survive a regulator. Send a timeline.\n\n— ${npc.name}`;
  if (/oldco|archive|legacy/.test(text)) return `The OldCo situation is messier than the status page suggests. If you recover documentation, keep it intact and tell me what it proves, not what it implies.\n\nDo not send customer records.\n\n— ${npc.name}`;
  if (/contract|work|job|hire|rate/.test(text)) return `I have work, but I need to know you can finish. Send me a short note on what you have delivered before, and a realistic timeline.\n\nSmall scopes are fine. Missed deadlines are not.\n\n— ${npc.name}`;
  if (/help|how|advice|start/.test(text)) return `Start with an inventory. You cannot defend or audit what you have not enumerated. Then read the logs before you touch anything.\n\nThe board has small jobs. Take one. Deliver it cleanly.\n\n— ${npc.name}`;
  if (/hello|hi|hey|introduc/.test(text)) return `Good to hear from you. I am around, usually buried in something.\n\nWhat are you working on?\n\n— ${npc.name}`;
  return `Received. I will get back to you when I have a clear answer.\n\n— ${npc.name}`;
}
export function sendMailReply(game, pending, rng) {
  const npc = getNpc(game, pending.handle);
  if (!npc) return null;
  const mail = addMail(game, {
    from: npc.handle, subject: `re: ${pending.subject}`,
    body: npcReply(npc, pending.subject, pending.body, rng), npcId: npc.id
  });
  npc.sent++;
  game.player.relations[npc.handle] = (game.player.relations[npc.handle] || 0) + 2;
  addFeed(game, `New mail from @${npc.handle}.`, 'mail');
  return mail;
}

/* ============================================================
   TICK + OFFLINE SIMULATION
   ============================================================ */
export function tickWorld(game, minutes = 1, opts = {}) {
  ensureSystems(game);
  reviveGame(game);
  const rng = makeRng((game.seed ^ Math.floor(game.worldMinutes * 2654435761) ^ (game.tickCount * 97)) >>> 0);
  minutes = Math.max(1, Math.round(minutes));
  game.worldMinutes += minutes;
  game.tickCount++;
  const events = [];
  const before = { money: game.player.money, mail: game.mail.length, contracts: game.contracts.length, sites: game.sites.length, heat: game.player.heat };

  // market random walk
  const drift = (rng.next() - .5) * .006 + .00015;
  game.market.index = clamp(game.market.index * (1 + drift), 720, 1480);
  game.market.history.push(Math.round(game.market.index * 10) / 10);
  if (game.market.history.length > 80) game.market.history.shift();
  game.market.volume = Math.max(0, Math.round(game.market.volume * .94 + rng.int(120, 2400)));
  game.market.sentiment = game.market.index > 1120 ? 'bullish' : game.market.index < 900 ? 'bearish' : 'neutral';

  // people keep moving
  const npcUpdates = Math.min(6, 1 + Math.floor(minutes / 10));
  for (let i = 0; i < npcUpdates; i++) {
    const npc = rng.pick(game.npcs);
    npc.online = rng.chance(.46);
    npc.activity = rng.pick(ACTIVITIES);
    npc.mood = rng.pick(['calm','busy','curious','tired','focused','wary']);
    if (rng.chance(.006 * Math.min(minutes, 30))) {
      npc.rep = clamp(npc.rep + rng.int(-1, 1), 0, 100);
      if (rng.chance(.35)) addFeed(game, `@${npc.handle} is ${npc.activity}.`, 'info');
    }
  }

  // infrastructure events
  const serverEvents = Math.max(1, Math.min(4, Math.ceil(minutes / 30)));
  for (let i = 0; i < serverEvents; i++) {
    const server = rng.pick(game.servers);
    if (!server) continue;
    if (server.owned) {
      if (rng.chance(.015)) {
        server.notes.unshift(rng.pick(MAINT_NOTES));
        if (server.notes.length > 8) server.notes.length = 8;
      }
      continue;
    }
    if (server.status === 'offline' && rng.chance(.24)) {
      server.status = 'online';
      server.notes.unshift('Host recovered and rejoined the network.');
      addFeed(game, `${server.host} is back online.`, 'info');
      events.push({ type: 'recovery', text: `${server.host} recovered` });
    } else if (server.status === 'maintenance' && rng.chance(.3)) {
      server.status = 'online';
      server.notes.unshift(rng.pick(MAINT_NOTES));
    } else if (server.status === 'online' && rng.chance(.035)) {
      server.status = rng.chance(.55) ? 'degraded' : rng.chance(.5) ? 'maintenance' : 'offline';
      server.notes.unshift(server.status === 'degraded' ? 'Latency elevated; incident opened.' : server.status === 'maintenance' ? 'Scheduled maintenance started.' : 'Host unreachable.');
      if (server.notes.length > 8) server.notes.length = 8;
      if (server.status === 'offline') addFeed(game, `${server.host} went offline.`, 'bad');
      events.push({ type: 'status', text: `${server.host} ${server.status}` });
    }
    if (server.status === 'online') {
      server.traffic = Math.max(0, Math.round(server.traffic * (1 + rng.float(-.03, .04))));
      if (server.vulns.some(v => !v.patched) && rng.chance(.012)) {
        server.compromised = true;
        server.security = clamp(server.security - rng.int(2, 8), 0, 99);
        const news = addNews(game, rng, { silent: true });
        events.push({ type: 'compromise', text: `${server.host} compromised` });
        if (rng.chance(.5)) addFeed(game, `${server.host} shows signs of compromise.`, 'bad');
      }
      if (server.security < 52 && rng.chance(.018)) {
        const v = makeVuln(rng, rng.pick(VULN_TYPES).name);
        if (!server.vulns.some(x => x.name === v.name && !x.patched)) {
          server.vulns.push(v);
          server.notes.unshift(`New exposure discovered: ${v.name}.`);
        }
      }
      if (server.vulns.some(v => !v.patched) && rng.chance(.02)) {
        const v = server.vulns.find(x => !x.patched);
        v.patched = true;
        server.security = clamp(server.security + 2, 0, 99);
      }
      server.lastSeen = Date.now();
    }
  }

  // bounded procedural growth across the persistent world
  for (const growthEvent of growWorldEntities(game, growthRng(game, 0x9a17))) {
    events.push(growthEvent);
  }

  // news + forum life
  if (rng.chance(Math.min(.9, .028 * minutes))) {
    const n = addNews(game, rng, { silent: false });
    events.push({ type: 'news', text: n.headline });
  }
  if (rng.chance(Math.min(.75, .022 * minutes))) {
    const forum = rng.pick(game.forums.filter(f => f.status === 'live'));
    if (forum && forum.threads.length) {
      const thread = rng.pick(forum.threads);
      const npc = rng.pick(game.npcs);
      thread.posts.push({ id: `${thread.id}-p${thread.posts.length + 1}`, author: npc.handle, body: rng.pick([
        'Following this. Same problem on our side.',
        'The fix is boring and it works. Rotate the credential, then verify from outside.',
        'I would not touch that without a rollback plan.',
        'This is why we keep a written inventory.',
        'Tested it on staging. No issues so far.',
        'Does anyone have the original thread? The search index is stale.',
        'I have seen this before. It is always the certificate.',
        'Strong disagree, but I understand why you would say that.'
      ]), time: Date.now(), world: game.worldMinutes });
      if (thread.posts.length > 30) thread.posts.shift();
    }
  }
  if (rng.chance(Math.min(.8, .006 * minutes))) {
    const openCount = game.contracts.filter(c => c.status === 'open').length;
    if (openCount < 36) {
      const c = generateContract(game, rng);
      if (c) events.push({ type: 'contract', text: `${c.id} ${c.title}` });
    }
  }

  // deadlines
  for (const c of game.contracts) {
    if (c.status === 'active' && game.worldMinutes > c.deadlineWorld) {
      c.status = 'failed';
      game.player.contractsFailed++;
      game.player.reputation = clamp(game.player.reputation - 3, 0, 100);
      addFeed(game, `Contract failed: ${c.id} passed its deadline.`, 'bad');
      events.push({ type: 'failed', text: c.title });
    } else if (c.status === 'open' && game.worldMinutes > c.deadlineWorld + MINUTES_PER_DAY * 2) {
      c.status = 'expired';
    }
  }

  // mail replies
  const due = game.pendingReplies.filter(r => r.atWorld <= game.worldMinutes);
  for (const r of due) {
    const mail = sendMailReply(game, r, rng);
    if (mail) events.push({ type: 'mail', text: `reply from @${r.handle}` });
  }
  game.pendingReplies = game.pendingReplies.filter(r => r.atWorld > game.worldMinutes);

  // Passive site traffic and revenue accrue at every crossed ten-minute boundary,
  // including when a large offline-simulation chunk skips several boundaries.
  const previousWorldMinute = game.worldMinutes - minutes;
  const intervals = Math.floor(game.worldMinutes / 10) - Math.floor(previousWorldMinute / 10);
  for (let interval = 0; interval < intervals; interval++) {
    for (const site of playerSites(game)) {
      const gain = Math.max(1, Math.round(site.visits * rng.float(.004, .012)) + rng.int(1, 8));
      site.visits += gain;
      const rev = Math.max(0, Math.round(site.visits * .0012));
      if (rev > 0) {
        site.revenue += rev;
        game.player.money += rev;
        game.stats.earned += rev;
      }
    }
    for (const site of game.sites.filter(s => s.ownerType !== 'player' && s.status === 'live')) {
      if (rng.chance(.08)) site.visits += rng.int(1, 40);
    }
  }

  // Charge once for every crossed world day, rather than only once per tick.
  // For older v4 saves without lastRentDay, start at the tick's previous day.
  const previousDay = Math.floor(previousWorldMinute / MINUTES_PER_DAY);
  const day = Math.floor(game.worldMinutes / MINUTES_PER_DAY);
  const firstUnchargedDay = Math.max(previousDay, game.lastRentDay ?? previousDay) + 1;
  for (let rentDay = firstUnchargedDay; rentDay <= day; rentDay++) {
    const owned = ownedServers(game);
    let rent = 0;
    for (const s of owned) rent += Math.round((s.monthly || 28) / 30);
    for (const id of ['proxy','vpn','backup','monitor']) {
      const count = game.player.inventory[id] || 0;
      if (count) {
        const item = SHOP_ITEMS.find(i => i.id === id);
        rent += Math.round((item?.price || 0) / 30) * count;
      }
    }
    if (rent > 0) {
      game.player.money -= rent;
      game.stats.spent += rent;
      game.player.transactions.unshift({ time: Date.now(), amount: -rent, memo: 'daily infrastructure costs', balance: game.player.money });
      if (game.player.money < 0) {
        game.player.heat = clamp(game.player.heat + 4, 0, 100);
        addFeed(game, 'Infrastructure bill unpaid. Account flagged.', 'bad');
        events.push({ type: 'billing', text: 'unpaid infrastructure bill' });
      }
    }
  }
  if (day > (game.lastRentDay ?? previousDay)) game.lastRentDay = day;

  // heat decays slowly when quiet
  if (game.player.heat > 0) game.player.heat = Math.max(0, game.player.heat - (minutes / 60) * .55);
  if (game.player.heat >= 62 && rng.chance(Math.min(.8, .006 * minutes))) {
    const ev = investigate(game, 'persistent trace correlation');
    events.push({ type: 'legal', text: `investigation fine ${fmtMoney(ev.fine)}` });
  }

  // world-side site lifecycle
  if (rng.chance(Math.min(.6, .004 * minutes))) {
    const dead = game.sites.filter(s => s.ownerType !== 'player' && s.status === 'live');
    if (dead.length > 4) {
      const s = rng.pick(dead);
      s.status = rng.chance(.5) ? 'offline' : 'live';
      if (s.status === 'offline') addFeed(game, `${s.domain} stopped responding.`, 'info');
    }
  }

  // cloud, containers, agents and organizations
  try {
    const sysEvents = tickSystems(game, minutes, rng);
    for (const e of sysEvents) {
      if (e.type === 'money') addMoney(game, e.amount, e.memo);
      else if (e.type === 'feed') addFeed(game, e.text, e.kind || 'info');
      else if (e.type === 'news') addNews(game, rng, { headline: e.headline, body: e.body, source: e.source, silent: true });
      else if (e.type === 'mail') addMail(game, { from: e.from, subject: e.subject, body: e.body });
    }
  } catch (err) {
    console.error('systems tick failed', err);
  }

  updateDerived(game);
  checkAchievements(game, true);
  events.push({ type: 'summary', text: `${minutes} world minute(s) advanced`, before });
  return events;
}

export function simulateOffline(game, elapsedMs) {
  const realMinutes = Math.floor(elapsedMs / 60000);
  if (realMinutes < 2) return null;
  const worldMinutes = Math.min(Math.round(realMinutes * 60), MINUTES_PER_DAY * 7);
  const before = {
    money: game.player.money, mail: game.mail.length, unread: unreadMail(game),
    contracts: game.contracts.filter(c => c.status === 'open').length,
    sites: game.sites.length, news: game.news.length, heat: game.player.heat,
    owned: ownedServers(game).length
  };
  const steps = clamp(Math.ceil(worldMinutes / 30), 1, 320);
  const chunk = Math.max(1, Math.round(worldMinutes / steps));
  const events = [];
  for (let i = 0; i < steps; i++) events.push(...tickWorld(game, chunk, { offline: true }));
  const report = {
    elapsedMs, realMinutes, worldMinutes,
    moneyDelta: game.player.money - before.money,
    newMail: game.mail.length - before.mail,
    unread: unreadMail(game),
    newContracts: game.contracts.filter(c => c.status === 'open').length - before.contracts,
    newSites: game.sites.length - before.sites,
    newNews: game.news.length - before.news,
    heatDelta: Math.round(game.player.heat - before.heat),
    events: events.filter(e => e.type !== 'summary'),
    headlines: game.news.slice(0, 3).map(n => n.headline),
    newMails: game.mail.slice(before.mail).filter(m => !m.outbound).slice(0, 4),
    newOpenContracts: game.contracts.filter(c => c.status === 'open').slice(-3),
    incidents: events.filter(e => e.type === 'compromise' || e.type === 'legal' || e.type === 'failed').slice(0, 5)
  };
  game.lastActive = Date.now();
  addFeed(game, `The world advanced ${Math.round(worldMinutes / 60)}h while you were away.`, 'info');
  game.offline = { at: Date.now(), report: { ...report, events: report.events.slice(0, 30) } };
  return report;
}

/* ============================================================
   MISC
   ============================================================ */
export function serverSummary(game, server) {
  return `${server.host} (${server.ip}) · ${server.org} · ${server.status} · sec ${server.security}`;
}
export function serviceLine(s) { return `${String(s.port).padStart(5)}/tcp  ${s.state.padEnd(5)}  ${s.name.padEnd(12)} ${s.product} ${s.version}`; }
export function contractStatusClass(status) {
  return status === 'open' ? 'g' : status === 'active' ? 'b' : status === 'done' ? 'g' : status === 'failed' ? 'r' : 'a';
}
export function mailPartners(game) { return new Set(game.mail.filter(m => !m.outbound).map(m => m.from)); }
export function randomEventLine(game) {
  const rng = makeRng((game.seed ^ Date.now()) >>> 0);
  return rng.pick([
    'A routing change in eu-west is propagating slowly.',
    'A backup job finished without errors. Nobody noticed.',
    'A small site went offline after its certificate expired.',
    'An operator is arguing about DNS in the community board.',
    'A contract deadline is approaching on the market board.',
    'An old host answered a request it should have refused.'
  ]);
}

