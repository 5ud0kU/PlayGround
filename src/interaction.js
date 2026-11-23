/* Deep interactivity layer.
   Every operation here changes persistent state, consumes simulated time through
   jobs, and can be observed by the shell, the world tick and NPC behaviour.
   This module never imports world.js or shell.js, so it can be called from the
   simulation tick without creating a cycle. */
import { makeRng, clamp, hash32, fmtMoney, fmtNum, fmtDate } from './util.js';
import { HOME, ensureDir, writeFile, readFile, exists, getNode, allFiles, joinPath, normalize, resolvePath } from './vfs.js';

const DAY = 1440;
const CAPS = Object.freeze({
  jobs: 60, conversations: 80, offers: 60, issues: 80, prs: 60,
  builds: 40, deployments: 40, labEnvs: 12, labReports: 40,
  invoices: 60, orders: 60, faults: 40, logs: 60
});

function irng(game, salt = 0) {
  return makeRng((game.seed ^ Math.floor(game.worldMinutes * 2654435761) ^ (game.tickCount * 97) ^ salt) >>> 0);
}
function seq(ix, key) {
  ix.seq[key] = (ix.seq[key] || 0) + 1;
  return `${key}-${String(ix.seq[key]).padStart(4, '0')}`;
}
function bounded(arr, cap) { if (arr.length > cap) arr.splice(0, arr.length - cap); return arr; }
function logJob(game, job, text) {
  if (!job.log) job.log = [];
  job.log.push({ world: game.worldMinutes, text: String(text) });
  bounded(job.log, 40);
}
function pushMail(game, from, subject, body) {
  if (!game.mail) game.mail = [];
  const id = game.seq?.mail ? game.seq.mail++ : game.mail.length + 1;
  game.mail.push({ id, from, to: 'operator', subject, body, time: Date.now(), read: false, outbound: false, npcId: null, threadId: `th-${id}` });
  if (game.mail.length > 120) game.mail = game.mail.slice(-120);
}
function pushFeed(game, text, kind = 'info') {
  if (!game.feed) game.feed = [];
  game.feed.unshift({ id: game.seq?.feed ? game.seq.feed++ : game.feed.length + 1, time: Date.now(), world: game.worldMinutes, text, kind });
  if (game.feed.length > 80) game.feed.length = 80;
}
function money(n) { return Math.max(0, Math.round(Number(n) || 0)); }
function pct(n) { return clamp(Math.round(Number(n) || 0), 0, 100); }
function round(n) { return Math.round(Number(n) || 0); }

/* ---------------- root / revival ---------------- */
export function ensureInteraction(game) {
  if (!game.interaction || typeof game.interaction !== 'object') game.interaction = {};
  const ix = game.interaction;
  ix.version = 1;
  ix.seq = ix.seq || {};
  for (const key of ['job', 'conversation', 'offer', 'issue', 'pr', 'build', 'deploy', 'env', 'report', 'invoice', 'order', 'fault']) {
    if (typeof ix.seq[key] !== 'number') ix.seq[key] = 0;
  }
  ix.jobs = ix.jobs || [];
  ix.conversations = ix.conversations || [];
  ix.offers = ix.offers || [];
  ix.faults = ix.faults || [];
  ix.lastNpcInitiativeWorld = typeof ix.lastNpcInitiativeWorld === 'number' ? ix.lastNpcInitiativeWorld : game.worldMinutes;
  ix.lastFaultAuditWorld = typeof ix.lastFaultAuditWorld === 'number' ? ix.lastFaultAuditWorld : game.worldMinutes;

  ix.hardware = ix.hardware || {};
  const hw = ix.hardware;
  hw.level = typeof hw.level === 'number' ? hw.level : 1;
  hw.cpu = hw.cpu || { model: 'Kestrel C3', cores: 4, speed: 2.6, load: 6, temp: 34 };
  hw.gpu = hw.gpu || { model: 'Lumen G2', vram: 4, load: 2, temp: 31 };
  hw.ram = hw.ram || { total: 16, used: 2 };
  hw.storage = hw.storage || { total: 512, used: 96, fs: 'ext4' };
  hw.nic = hw.nic || { model: 'virtio-net', bandwidth: 940, latency: 4, mac: '52:54:00:1c:4a:0e' };
  hw.motherboard = hw.motherboard || { model: 'Halcyon H61', sockets: 1, maxRam: 64 };
  hw.power = typeof hw.power === 'number' ? hw.power : 48;
  hw.temp = typeof hw.temp === 'number' ? hw.temp : 36;
  hw.failures = hw.failures || [];
  hw.upgrades = hw.upgrades || [];
  if (typeof hw.cpu.load !== 'number') hw.cpu.load = 6;
  if (typeof hw.gpu.load !== 'number') hw.gpu.load = 2;

  ix.bank = ix.bank || {};
  ix.bank.accounts = ix.bank.accounts || {};
  ix.bank.accounts.primary = ix.bank.accounts.primary || {
    id: 'primary', name: 'Operator Current', balance: game.player.money || 0, overdraft: 0
  };
  ix.bank.invoices = ix.bank.invoices || [];
  ix.bank.orders = ix.bank.orders || [];
  ix.bank.portfolio = ix.bank.portfolio || {};
  ix.bank.budgets = ix.bank.budgets || { infrastructure: 0, payroll: 0, research: 0, living: 0 };
  ix.bank.feesPaid = typeof ix.bank.feesPaid === 'number' ? ix.bank.feesPaid : 0;

  ix.npc = ix.npc || {};
  ix.npc.trust = ix.npc.trust || {};
  ix.npc.preferences = ix.npc.preferences || {};

  ix.dev = ix.dev || {};
  ix.dev.issues = ix.dev.issues || [];
  ix.dev.prs = ix.dev.prs || [];
  ix.dev.builds = ix.dev.builds || [];
  ix.dev.deployments = ix.dev.deployments || [];
  ix.dev.tests = ix.dev.tests || [];

  ix.lab = ix.lab || {};
  ix.lab.environments = ix.lab.environments || [];
  ix.lab.captures = ix.lab.captures || [];
  ix.lab.reports = ix.lab.reports || [];

  for (const repo of game.repos || []) {
    if (typeof repo.quality !== 'number') repo.quality = clamp(38 + (repo.stars || 0) / 6, 10, 95);
    if (typeof repo.downloads !== 'number') repo.downloads = (repo.stars || 0) * 14;
    repo.issues = repo.issues || [];
    repo.pullRequests = repo.pullRequests || [];
    repo.builds = repo.builds || [];
  }
  for (const npc of game.npcs || []) {
    if (!ix.npc.trust[npc.id]) {
      const rng = makeRng((game.seed ^ hash32(npc.id)) >>> 0);
      ix.npc.trust[npc.id] = clamp(Math.round(18 + npc.rep * .35 + rng.int(0, 22)), 0, 100);
      ix.npc.preferences[npc.id] = {
        channel: rng.pick(['email', 'message', 'forum']),
        interests: rng.picks(['software', 'security', 'market', 'media', 'hardware', 'research'], 2),
        availability: rng.int(20, 90),
        patience: rng.int(20, 90)
      };
    }
  }
  bounded(ix.jobs, CAPS.jobs);
  bounded(ix.conversations, CAPS.conversations);
  bounded(ix.offers, CAPS.offers);
  bounded(ix.faults, CAPS.faults);
  return ix;
}

/* ---------------- helpers ---------------- */
function hardwarePenalty(hw) {
  const thermal = clamp((hw.temp - 42) / 22, 0, 1.2);
  const load = clamp(hw.cpu.load / 100, 0, 1);
  const age = Math.max(0, 3 - hw.level) * .12;
  return 1 + thermal * .55 + load * .25 + age;
}
function activeJobs(ix) { return ix.jobs.filter(j => j.status === 'running'); }
function jobCapacity(ix) { return clamp(1 + Math.floor(ix.hardware.ram.total / 8), 1, 6); }
function freeRam(ix) { return Math.max(0, ix.hardware.ram.total - ix.hardware.ram.used - activeJobs(ix).reduce((n, j) => n + (j.ram || 0), 0)); }
function freeStorage(ix) { return Math.max(0, ix.hardware.storage.total - ix.hardware.storage.used); }

export function startJob(game, opts = {}) {
  const ix = ensureInteraction(game);
  const kind = String(opts.kind || 'task');
  const ram = Math.max(0, round(opts.ram || 1));
  const cpu = clamp(Number(opts.cpu) || 20, 1, 100);
  const storage = Math.max(0, round(opts.storage || 0));
  const duration = Math.max(1, round((Number(opts.minutes) || 30) * hardwarePenalty(ix.hardware)));
  if (activeJobs(ix).length >= jobCapacity(ix)) return { ok: false, error: 'No worker slots free. Close or wait for a running job.' };
  if (ram > freeRam(ix)) return { ok: false, error: `Not enough free RAM (${freeRam(ix)} GB free, needs ${ram} GB).` };
  if (storage > freeStorage(ix)) return { ok: false, error: `Not enough free storage (${freeStorage(ix)} GB free, needs ${storage} GB).` };
  const cost = money(opts.cost || 0);
  if (cost > game.player.money) return { ok: false, error: `This requires ${fmtMoney(cost)}; you have ${fmtMoney(game.player.money)}.` };
  if (cost) chargeMoney(game, cost, `job · ${opts.label || kind}`);
  const job = {
    id: seq(ix, 'job'), kind, label: opts.label || kind, status: 'running',
    startedWorld: game.worldMinutes, endsWorld: game.worldMinutes + duration,
    progress: 0, ram, cpu, storage, cost, meta: opts.meta || {}, log: [], result: null
  };
  logJob(game, job, `Started ${job.label}.`);
  ix.jobs.push(job);
  bounded(ix.jobs, CAPS.jobs);
  return { ok: true, job };
}

function chargeMoney(game, amount, memo) {
  const v = money(amount);
  game.player.money = Math.max(0, game.player.money - v);
  game.stats.spent = (game.stats.spent || 0) + v;
  game.player.transactions.unshift({ time: Date.now(), amount: -v, memo, balance: game.player.money });
  if (game.player.transactions.length > 120) game.player.transactions.length = 120;
  const ix = ensureInteraction(game);
  if (ix.bank.accounts.primary) ix.bank.accounts.primary.balance = game.player.money;
}
function payMoney(game, amount, memo) {
  const v = money(amount);
  game.player.money += v;
  game.stats.earned = (game.stats.earned || 0) + v;
  game.player.transactions.unshift({ time: Date.now(), amount: v, memo, balance: game.player.money });
  if (game.player.transactions.length > 120) game.player.transactions.length = 120;
  const ix = ensureInteraction(game);
  if (ix.bank.accounts.primary) ix.bank.accounts.primary.balance = game.player.money;
}

export function spawnFault(game, opts = {}) {
  const ix = ensureInteraction(game);
  const fault = {
    id: seq(ix, 'fault'), kind: opts.kind || 'service', target: opts.target || 'voidbox',
    symptom: opts.symptom || 'A service is behaving incorrectly.',
    cause: opts.cause || 'unconfirmed',
    fix: opts.fix || 'investigate the affected service',
    diagnosed: false, status: 'open', startedWorld: game.worldMinutes,
    severity: opts.severity || 'warning', meta: opts.meta || {}
  };
  ix.faults.push(fault);
  bounded(ix.faults, CAPS.faults);
  pushFeed(game, `Fault detected: ${fault.symptom}`, 'warn');
  return fault;
}

/* ---------------- job completion ---------------- */
function finishJob(game, job) {
  const ix = ensureInteraction(game);
  const rng = irng(game, hash32(job.id));
  job.status = 'done';
  job.progress = 100;
  job.completedWorld = game.worldMinutes;
  logJob(game, job, 'Operation completed.');
  const meta = job.meta || {};

  if (job.kind === 'compile') {
    const repo = (game.repos || []).find(r => r.name === meta.project);
    const hw = ix.hardware;
    if (hw.ram.total < (meta.minRam || 8) && rng.chance(.45)) {
      spawnFault(game, { kind: 'memory', target: meta.project || 'voidbox', symptom: `Build of ${meta.project} was killed by the memory manager.`, cause: `Only ${hw.ram.total} GB RAM installed; build needs ${meta.minRam || 8} GB.`, fix: 'Upgrade RAM or reduce build parallelism', severity: 'error' });
      job.status = 'failed';
      job.result = { ok: false, error: 'out of memory' };
      logJob(game, job, 'Compiler killed: out of memory.');
      return;
    }
    const quality = clamp(Math.round((repo?.quality || 50) + rng.int(-6, 10) + hw.level * 2), 5, 99);
    const build = {
      id: seq(ix, 'build'), project: meta.project || 'project', quality,
      version: meta.version || '0.1.0', builtWorld: game.worldMinutes,
      status: 'ready', sizeMb: Math.max(1, round(rng.int(2, 60) + quality / 4)), log: job.log.slice()
    };
    ix.dev.builds.push(build);
    bounded(ix.dev.builds, CAPS.builds);
    if (repo) { repo.builds.push(build.id); repo.quality = quality; repo.downloads += rng.int(1, 8); }
    job.result = { ok: true, build };
    pushFeed(game, `Build ready: ${build.project} ${build.version} (quality ${quality}).`, 'good');
    return;
  }

  if (job.kind === 'test') {
    const build = ix.dev.builds.find(b => b.id === meta.buildId);
    const repo = (game.repos || []).find(r => r.name === meta.project);
    const passed = !!build && rng.next() < clamp((build.quality + (repo?.quality || 50)) / 190 + .28, .15, .96);
    const test = {
      id: `test-${ix.seq.job}`, project: meta.project || 'project', buildId: meta.buildId || null,
      passed, cases: rng.int(8, 48), failures: passed ? 0 : rng.int(1, 4),
      world: game.worldMinutes, detail: passed ? 'all checks passed' : 'regression in parser and cache layers'
    };
    ix.dev.tests.push(test);
    bounded(ix.dev.tests, 80);
    if (repo) repo.quality = clamp(repo.quality + (passed ? rng.int(1, 4) : -rng.int(2, 7)), 5, 99);
    job.result = { ok: true, test };
    logJob(game, job, passed ? `${test.cases} tests passed.` : `${test.failures} test(s) failed: ${test.detail}`);
    pushFeed(game, `Tests ${passed ? 'passed' : 'failed'} for ${test.project}.`, passed ? 'good' : 'bad');
    return;
  }

  if (job.kind === 'deploy') {
    const build = ix.dev.builds.find(b => b.id === meta.buildId);
    const server = (game.servers || []).find(s => s.id === meta.serverId || s.host === meta.serverId);
    if (!build || !server) {
      spawnFault(game, { kind: 'deploy', target: meta.serverId || 'server', symptom: `Deployment of ${meta.project || 'project'} failed: missing artifact or host.`, cause: 'The referenced build or server no longer exists.', fix: 'Build the project and verify the target host' });
      job.status = 'failed';
      job.result = { ok: false, error: 'missing build or server' };
      return;
    }
    const deployment = {
      id: seq(ix, 'deploy'), buildId: build.id, project: build.project,
      serverId: server.id, host: server.host, world: game.worldMinutes, status: 'live'
    };
    ix.dev.deployments.push(deployment);
    bounded(ix.dev.deployments, CAPS.deployments);
    build.status = 'deployed';
    if (server.status && server.status !== 'failed') server.status = 'online';
    if (game.products && !game.products.some(p => p.name === build.project)) {
      game.products.push({ id: `prod-${game.products.length + 1}`, name: build.project, price: 8, quality: build.quality, growth: 1.5, owner: 'player', deployedWorld: game.worldMinutes });
    }
    job.result = { ok: true, deployment };
    pushFeed(game, `Deployed ${build.project} ${build.version} to ${server.host}.`, 'good');
    return;
  }

  if (job.kind === 'download') {
    const path = meta.path || joinPath(HOME, 'downloads', meta.filename || 'download.txt');
    const content = meta.content || `# ${job.label}\nDownloaded at world minute ${game.worldMinutes}.\n`;
    const need = Math.max(0.1, content.length / 1024 / 1024);
    if (need > freeStorage(ix)) {
      spawnFault(game, { kind: 'disk', target: 'voidbox', symptom: 'Download failed: disk quota exceeded.', cause: `Storage ${ix.hardware.storage.used.toFixed(1)}/${ix.hardware.storage.total} GB is full.`, fix: 'Remove unused files or upgrade storage' });
      job.status = 'failed'; job.result = { ok: false, error: 'disk full' }; return;
    }
    const parent = normalize(path.slice(0, path.lastIndexOf('/')) || HOME);
    ensureDir(game.fs, parent, 'operator');
    writeFile(game.fs, path, content, { owner: 'operator' });
    ix.hardware.storage.used = Math.min(ix.hardware.storage.total, ix.hardware.storage.used + need);
    job.result = { ok: true, path, bytes: content.length };
    logJob(game, job, `Wrote ${content.length} bytes to ${path}.`);
    return;
  }

  if (job.kind === 'npc-reply') {
    const convo = ix.conversations.find(c => c.id === meta.conversationId);
    const npc = (game.npcs || []).find(n => n.id === meta.npcId);
    if (!convo || !npc) { job.status = 'failed'; job.result = { ok: false, error: 'conversation lost' }; return; }
    const trust = ix.npc.trust[npc.id] || 20;
    const rep = clamp(game.player.reputation || 0, 0, 100);
    const repScore = (game.stats?.contracts || 0) * 2 + (game.civ?.player?.professional?.score || 0) * .25;
    const score = trust * .45 + rep * .2 + repScore * .2 + rng.int(0, 22);
    const intent = meta.intent || 'chat';
    let body, outcome;
    if (intent === 'help') {
      outcome = score > 48 ? 'accepted' : score > 32 ? 'counter' : 'declined';
      body = outcome === 'accepted'
        ? `${npc.name}: I can take a look. Send the logs and I will respond within a day or two.`
        : outcome === 'counter'
          ? `${npc.name}: I am booked, but I can review it for ${fmtMoney(180 + rng.int(40, 320))} if that works.`
          : `${npc.name}: I do not have the time right now. Try the public board.`;
    } else if (intent === 'employment') {
      outcome = score > 58 ? 'accepted' : score > 40 ? 'counter' : 'declined';
      body = outcome === 'accepted'
        ? `${npc.name}: I am interested. Send a contract and we can start.`
        : outcome === 'counter'
          ? `${npc.name}: Possible, but the number needs to be closer to ${fmtMoney(meta.salary ? meta.salary * 1.18 : 42000)}/yr.`
          : `${npc.name}: I am staying where I am for now.`;
    } else if (intent === 'collaboration') {
      outcome = score > 50 ? 'accepted' : 'counter';
      body = outcome === 'accepted'
        ? `${npc.name}: Count me in. Fork the repository and I will submit a patch.`
        : `${npc.name}: I will watch it first. Publish a build and I will decide.`;
    } else {
      outcome = 'accepted';
      body = `${npc.name}: ${rng.pick(['Thanks for reaching out.', 'I saw your work on the board.', 'Let me think about it and get back to you.'])}`;
    }
    convo.messages.push({ from: npc.handle, text: body, world: game.worldMinutes });
    convo.lastWorld = game.worldMinutes;
    convo.status = outcome;
    convo.outcome = outcome;
    if (outcome === 'accepted') ix.npc.trust[npc.id] = clamp((ix.npc.trust[npc.id] || 20) + 3, 0, 100);
    if (outcome === 'declined') ix.npc.trust[npc.id] = clamp((ix.npc.trust[npc.id] || 20) - 2, 0, 100);
    const offer = { id: seq(ix, 'offer'), npcId: npc.id, handle: npc.handle, intent, outcome, salary: meta.salary || 0, world: game.worldMinutes, conversationId: convo.id, meta: meta.payload || {} };
    ix.offers.push(offer);
    bounded(ix.offers, CAPS.offers);
    pushMail(game, npc.handle, `Re: ${meta.subject || convo.subject || 'your message'}`, body);
    job.result = { ok: true, outcome, offer };
    pushFeed(game, `@${npc.handle} replied: ${outcome}.`, outcome === 'declined' ? 'warn' : 'good');
    return;
  }

  if (job.kind === 'meeting') {
    const convo = ix.conversations.find(c => c.id === meta.conversationId);
    const npc = (game.npcs || []).find(n => n.id === meta.npcId);
    if (convo && npc) {
      ix.npc.trust[npc.id] = clamp((ix.npc.trust[npc.id] || 20) + rng.int(4, 11), 0, 100);
      convo.messages.push({ from: npc.handle, text: `${npc.name}: That was useful. I have a few ideas we can try.`, world: game.worldMinutes });
      convo.lastWorld = game.worldMinutes;
      job.result = { ok: true, trust: ix.npc.trust[npc.id] };
      pushFeed(game, `Met with @${npc.handle}; trust is now ${ix.npc.trust[npc.id]}.`, 'good');
    }
    return;
  }

  if (job.kind === 'scan') {
    const env = ix.lab.environments.find(e => e.id === meta.envId);
    if (!env) { job.status = 'failed'; job.result = { ok: false, error: 'environment missing' }; return; }
    const found = [];
    for (const svc of env.services) {
      if (!svc.patched && !svc.discovered) {
        svc.discovered = true;
        found.push({ service: svc.name, version: svc.version, issue: svc.vuln, severity: svc.severity });
      }
    }
    env.scans = (env.scans || 0) + 1;
    env.evidence = (env.evidence || 0) + found.length * 8 + rng.int(2, 14);
    ix.lab.captures.push({ id: seq(ix, 'job'), envId: env.id, world: game.worldMinutes, findings: found, mode: 'scan' });
    bounded(ix.lab.captures, 80);
    job.result = { ok: true, findings: found };
    logJob(game, job, found.length ? `${found.length} finding(s): ${found.map(f => f.issue).join(', ')}` : 'No new findings.');
    return;
  }

  if (job.kind === 'capture') {
    const env = ix.lab.environments.find(e => e.id === meta.envId);
    if (!env) { job.status = 'failed'; job.result = { ok: false, error: 'environment missing' }; return; }
    const packet = { id: seq(ix, 'job'), envId: env.id, world: game.worldMinutes, protocol: rng.pick(['TCP', 'UDP', 'TLS', 'DNS']), bytes: rng.int(280, 9800), note: rng.pick(['cleartext credential attempt', 'certificate negotiation', 'service banner', 'repeated failed login']) };
    ix.lab.captures.push(packet);
    bounded(ix.lab.captures, 80);
    env.evidence = (env.evidence || 0) + 4;
    job.result = { ok: true, packet };
    return;
  }

  if (job.kind === 'patch') {
    const env = ix.lab.environments.find(e => e.id === meta.envId);
    const svc = env?.services.find(s => s.name === meta.service);
    if (!svc) { job.status = 'failed'; job.result = { ok: false, error: 'service missing' }; return; }
    svc.patched = true;
    svc.version = `${svc.version.split('.')[0]}.${Number(svc.version.split('.')[1] || 0) + 1}.0`;
    svc.vuln = 'patched';
    env.patches = (env.patches || 0) + 1;
    env.status = 'hardened';
    job.result = { ok: true, service: svc.name, version: svc.version };
    pushFeed(game, `${svc.name} patched to ${svc.version} in ${env.name}.`, 'good');
    return;
  }

  if (job.kind === 'repair') {
    const fault = ix.faults.find(f => f.id === meta.faultId);
    if (!fault) { job.status = 'failed'; return; }
    const skill = (game.civ?.player?.professional?.score || 30) + (game.player.skill || 1) * 6;
    const success = rng.next() < clamp(skill / 180 + (fault.diagnosed ? .22 : 0), .12, .95);
    if (success) {
      fault.status = 'resolved';
      fault.resolvedWorld = game.worldMinutes;
      job.result = { ok: true, fault: fault.id };
      pushFeed(game, `Resolved fault: ${fault.symptom}`, 'good');
    } else {
      fault.status = 'escalated';
      spawnFault(game, { kind: fault.kind, target: fault.target, symptom: `Repair attempt failed: ${fault.symptom}`, cause: fault.cause, fix: fault.fix, severity: 'error' });
      job.result = { ok: false, error: 'repair failed' };
      job.status = 'failed';
    }
    return;
  }

  if (job.kind === 'train') {
    const project = (game.civ?.tech?.projects || []).find(p => p.id === meta.projectId);
    if (project) {
      project.progress = clamp(project.progress + rng.int(12, 30), 0, 100);
      project.expertise = clamp((project.expertise || 20) + rng.int(1, 5), 0, 100);
      job.result = { ok: true, progress: project.progress };
      pushFeed(game, `Training advanced ${project.name} to ${Math.round(project.progress)}%.`, 'good');
    }
    return;
  }

  if (job.kind === 'upgrade') {
    const hw = ix.hardware;
    const part = meta.part;
    if (part === 'ram') { hw.ram.total = meta.value; hw.level++; }
    if (part === 'cpu') { hw.cpu.cores = meta.value; hw.cpu.speed = meta.speed; hw.level++; }
    if (part === 'storage') { hw.storage.total = meta.value; hw.level++; }
    if (part === 'gpu') { hw.gpu.vram = meta.value; hw.level++; }
    if (part === 'nic') { hw.nic.bandwidth = meta.value; hw.level++; }
    hw.upgrades.push({ part, value: meta.value, world: game.worldMinutes });
    job.result = { ok: true, part, value: meta.value };
    pushFeed(game, `Hardware upgraded: ${part} → ${meta.value}.`, 'good');
    return;
  }

  job.result = job.result || { ok: true };
}

/* ---------------- tick ---------------- */
export function tickInteraction(game, minutes = 1) {
  const ix = ensureInteraction(game);
  const rng = irng(game, 0x51ac);
  const events = [];
  const running = activeJobs(ix);

  // Hardware telemetry is driven by real work, not decoration.
  const load = clamp(4 + running.reduce((n, j) => n + j.cpu, 0) / Math.max(1, jobCapacity(ix)) + rng.int(0, 4), 0, 100);
  ix.hardware.cpu.load += (load - ix.hardware.cpu.load) * .25;
  ix.hardware.gpu.load += (clamp(running.filter(j => j.kind === 'train' || j.kind === 'compile').length * 32, 0, 100) - ix.hardware.gpu.load) * .2;
  const targetTemp = 28 + ix.hardware.cpu.load * .28 + ix.hardware.gpu.load * .1 - Math.min(8, (ix.hardware.level - 1) * 2);
  ix.hardware.temp += (targetTemp - ix.hardware.temp) * .12;
  ix.hardware.power = Math.round(24 + ix.hardware.cpu.load * .45 + ix.hardware.gpu.load * .3);
  ix.hardware.ram.used = 2 + running.reduce((n, j) => n + (j.ram || 0), 0);
  ix.hardware.storage.used = Math.min(ix.hardware.storage.total, ix.hardware.storage.used + (running.some(j => j.kind === 'download') ? .05 : 0));

  if (ix.hardware.temp > 78 && rng.chance(.05)) {
    const f = spawnFault(game, { kind: 'thermal', target: 'voidbox', symptom: 'System is thermal throttling; jobs are slowing down.', cause: `CPU temperature ${Math.round(ix.hardware.temp)}°C exceeds safe range.`, fix: 'Reduce concurrent jobs or improve cooling', severity: 'error' });
    events.push(f);
  }
  if (freeStorage(ix) < 8 && !ix.faults.some(f => f.kind === 'disk' && f.status === 'open')) {
    events.push(spawnFault(game, { kind: 'disk', target: 'voidbox', symptom: 'Disk space is critically low.', cause: `${freeStorage(ix).toFixed(1)} GB free.`, fix: 'Remove downloads or upgrade storage' }));
  }

  for (const job of ix.jobs) {
    if (job.status !== 'running') continue;
    const span = Math.max(1, job.endsWorld - job.startedWorld);
    job.progress = clamp((game.worldMinutes - job.startedWorld) / span * 100, 0, 100);
    const marks = [25, 50, 75];
    for (const mark of marks) {
      if (job.progress >= mark && !job[`mark${mark}`]) {
        job[`mark${mark}`] = true;
        logJob(game, job, `${mark}% complete.`);
      }
    }
    if (job.progress >= 100) finishJob(game, job);
  }

  // NPCs act on their own. They contact the operator when something in the
  // shared world touches their interests.
  if (game.worldMinutes - ix.lastNpcInitiativeWorld >= 3 * DAY && (game.npcs || []).length) {
    ix.lastNpcInitiativeWorld = game.worldMinutes;
    const playerRep = clamp(game.player.reputation || 0, 0, 100);
    const candidates = game.npcs.filter(n => {
      const pref = ix.npc.preferences[n.id];
      const trust = ix.npc.trust[n.id] || 20;
      return trust > 26 && rng.next() < clamp(.18 + playerRep / 500 + trust / 900, .05, .6) && pref;
    });
    const npc = rng.pick(candidates);
    if (npc && !ix.conversations.some(c => c.npcId === npc.id && game.worldMinutes - c.lastWorld < 2 * DAY)) {
      const pref = ix.npc.preferences[npc.id];
      const reasons = [
        { intent: 'collaboration', subject: 'a project worth contributing to', text: `${npc.name}: I saw your work on the board. Are you taking contributions?` },
        { intent: 'help', subject: 'a technical question', text: `${npc.name}: Quick question about your setup. Do you have a minute?` },
        { intent: 'employment', subject: 'a possible role', text: `${npc.name}: A team I know is hiring. Would you consider it?` }
      ];
      const reason = reasons[rng.int(0, reasons.length - 1)];
      const convo = {
        id: seq(ix, 'conversation'), npcId: npc.id, handle: npc.handle,
        subject: reason.subject, status: 'awaiting-you', outcome: null,
        lastWorld: game.worldMinutes,
        messages: [{ from: npc.handle, text: reason.text, world: game.worldMinutes }]
      };
      ix.conversations.push(convo);
      bounded(ix.conversations, CAPS.conversations);
      pushMail(game, npc.handle, reason.subject, reason.text);
      pushFeed(game, `New conversation from @${npc.handle}.`, 'info');
      events.push({ type: 'conversation', text: `${npc.handle} contacted you` });
    }
  }

  // NPC developers discover published player projects over time.
  for (const repo of game.repos || []) {
    if (repo.owner !== 'player') continue;
    if (rng.chance(.012)) {
      repo.downloads += rng.int(1, 6);
      if (rng.chance(.22) && repo.issues.length < 20) {
        repo.issues.push({ id: `issue-${repo.issues.length + 1}`, title: rng.pick(['Build fails on clean checkout', 'Documentation is unclear', 'Unexpected output on large input']), author: rng.pick(game.npcs || [])?.handle || 'visitor', world: game.worldMinutes, status: 'open' });
        pushFeed(game, `New issue on ${repo.name}: ${repo.issues[repo.issues.length - 1].title}`, 'warn');
      }
    }
  }

  // Invoices become overdue and can be collected automatically.
  for (const invoice of ix.bank.invoices) {
    if (invoice.status === 'sent' && game.worldMinutes >= invoice.dueWorld) {
      invoice.status = 'overdue';
      const target = (game.npcs || []).find(n => n.handle === invoice.party) || (game.companies || []).find(c => c.name === invoice.party);
      if (target && rng.chance(.55)) {
        const fee = Math.round(invoice.amount * .02);
        payMoney(game, invoice.amount - fee, `invoice · ${invoice.party}`);
        ix.bank.feesPaid += fee;
        invoice.status = 'paid';
        invoice.paidWorld = game.worldMinutes;
        pushFeed(game, `Invoice ${invoice.id} paid by ${invoice.party}.`, 'good');
      }
    }
  }

  // Market orders execute at the next tick if price and liquidity allow it.
  for (const order of ix.bank.orders) {
    if (order.status !== 'open') continue;
    const price = sharePrice(game, order.asset);
    const crosses = order.side === 'buy' ? price <= order.limit : price >= order.limit;
    if (!crosses) continue;
    const qty = Math.min(order.quantity, Math.max(1, Math.floor(order.liquidity / Math.max(1, price))));
    const gross = qty * price;
    const fee = Math.max(1, Math.round(gross * .0015));
    if (order.side === 'buy') {
      if (gross + fee > game.player.money) { order.status = 'rejected'; order.reason = 'insufficient funds'; continue; }
      chargeMoney(game, gross + fee, `buy ${qty} ${order.asset}`);
      ix.bank.portfolio[order.asset] = (ix.bank.portfolio[order.asset] || 0) + qty;
    } else {
      const held = ix.bank.portfolio[order.asset] || 0;
      if (held < qty) { order.status = 'rejected'; order.reason = 'insufficient shares'; continue; }
      ix.bank.portfolio[order.asset] = held - qty;
      payMoney(game, gross - fee, `sell ${qty} ${order.asset}`);
    }
    ix.bank.feesPaid += fee;
    order.status = 'filled';
    order.filledPrice = price;
    order.filledWorld = game.worldMinutes;
    pushFeed(game, `Order ${order.id} filled: ${order.side} ${qty} ${order.asset} @ ${fmtMoney(price)}.`, 'good');
  }

  bounded(ix.jobs, CAPS.jobs);
  bounded(ix.conversations, CAPS.conversations);
  bounded(ix.offers, CAPS.offers);
  bounded(ix.faults, CAPS.faults);
  bounded(ix.bank.invoices, CAPS.invoices);
  bounded(ix.bank.orders, CAPS.orders);
  bounded(ix.faults, CAPS.faults);
  return events;
}

/* ---------------- banking ---------------- */
export function sharePrice(game, asset) {
  const company = (game.companies || []).find(c => c.name.toLowerCase() === String(asset).toLowerCase() || c.id === asset);
  if (!company) return 0;
  const idx = game.market?.index || 100;
  const base = clamp((company.funds || 0) / 2200 + (company.rep || 0) * 8 + 20, 4, 9000);
  return Math.max(1, Math.round(base * (idx / 100)));
}

export function bankTransfer(game, target, amount) {
  const ix = ensureInteraction(game);
  const value = money(amount);
  if (value < 1) return { ok: false, error: 'Amount must be positive.' };
  const fee = Math.max(1, Math.round(value * .001) + 1);
  if (value + fee > game.player.money) return { ok: false, error: `Transfer plus fee (${fmtMoney(fee)}) exceeds your balance.` };
  const npc = (game.npcs || []).find(n => n.handle === target || n.name.toLowerCase() === String(target).toLowerCase());
  const company = (game.companies || []).find(c => c.name.toLowerCase() === String(target).toLowerCase() || c.id === target);
  if (!npc && !company) return { ok: false, error: 'Unknown recipient.' };
  chargeMoney(game, value + fee, `transfer · ${target}`);
  ix.bank.feesPaid += fee;
  if (npc) {
    npc.funds = (npc.funds || 0) + value;
    ix.npc.trust[npc.id] = clamp((ix.npc.trust[npc.id] || 20) + 2, 0, 100);
  }
  if (company) company.funds = (company.funds || 0) + value;
  return { ok: true, amount: value, fee, target };
}

export function bankInvoice(game, party, amount, days = 14) {
  const ix = ensureInteraction(game);
  const value = money(amount);
  if (value < 1) return { ok: false, error: 'Invoice amount must be positive.' };
  const invoice = {
    id: seq(ix, 'invoice'), party, amount: value, status: 'sent',
    createdWorld: game.worldMinutes, dueWorld: game.worldMinutes + Math.max(1, days) * DAY
  };
  ix.bank.invoices.push(invoice);
  bounded(ix.bank.invoices, CAPS.invoices);
  pushMail(game, party, `Invoice ${invoice.id}`, `Invoice for ${fmtMoney(value)} is due in ${days} days.`);
  return { ok: true, invoice };
}

export function bankOrder(game, side, asset, quantity, limit) {
  const ix = ensureInteraction(game);
  const qty = Math.max(1, round(quantity));
  const price = limit ? money(limit) : sharePrice(game, asset);
  if (!price) return { ok: false, error: 'No quoted price for that asset.' };
  const liquidity = Math.max(1, Math.round((game.market?.volume || 1000) * .35));
  const order = {
    id: seq(ix, 'order'), side: String(side).toLowerCase() === 'sell' ? 'sell' : 'buy',
    asset, quantity: qty, limit: price, liquidity, status: 'open', createdWorld: game.worldMinutes
  };
  ix.bank.orders.push(order);
  bounded(ix.bank.orders, CAPS.orders);
  return { ok: true, order, quoted: price };
}

export function bankBudget(game, category, amount) {
  const ix = ensureInteraction(game);
  const value = money(amount);
  ix.bank.budgets[category] = value;
  return { ok: true, category, amount: value };
}

/* ---------------- NPC interaction ---------------- */
export function npcContact(game, query, intent = 'chat', opts = {}) {
  const ix = ensureInteraction(game);
  const q = String(query || '').toLowerCase().replace(/^@/, '');
  const npc = (game.npcs || []).find(n => n.handle.toLowerCase() === q || n.name.toLowerCase() === q || n.id === q);
  if (!npc) return { ok: false, error: 'Unknown NPC.' };
  const text = String(opts.text || '').trim();
  if (!text) return { ok: false, error: 'Write a message first.' };
  if (ix.conversations.some(c => c.npcId === npc.id && c.status === 'awaiting-reply')) {
    return { ok: false, error: `${npc.handle} has not replied yet.` };
  }
  const convo = {
    id: seq(ix, 'conversation'), npcId: npc.id, handle: npc.handle,
    subject: opts.subject || intent, status: 'awaiting-reply', outcome: null,
    lastWorld: game.worldMinutes,
    messages: [{ from: 'operator', text, world: game.worldMinutes }]
  };
  ix.conversations.push(convo);
  bounded(ix.conversations, CAPS.conversations);
  sendNpcMail(game, npc, `Re: ${convo.subject}`, text);
  const response = startJob(game, {
    kind: 'npc-reply', label: `waiting for @${npc.handle}`, minutes: opts.wait || 240,
    ram: 0, cpu: 0, meta: { conversationId: convo.id, npcId: npc.id, intent, salary: opts.salary || 0, subject: convo.subject, payload: opts.payload || {} }
  });
  if (!response.ok) { convo.status = 'queued'; return { ok: true, convo, queued: true }; }
  return { ok: true, convo, job: response.job };
}

function sendNpcMail(game, npc, subject, body) {
  if (!game.mail) game.mail = [];
  const id = game.seq?.mail ? game.seq.mail++ : game.mail.length + 1;
  game.mail.push({ id, from: 'operator', to: npc.handle, subject, body, time: Date.now(), read: true, outbound: true, npcId: npc.id, threadId: `th-${id}` });
  if (game.mail.length > 120) game.mail = game.mail.slice(-120);
}

export function npcMeet(game, query) {
  const ix = ensureInteraction(game);
  const q = String(query || '').toLowerCase().replace(/^@/, '');
  const npc = (game.npcs || []).find(n => n.handle.toLowerCase() === q || n.name.toLowerCase() === q || n.id === q);
  if (!npc) return { ok: false, error: 'Unknown NPC.' };
  const convo = ix.conversations.find(c => c.npcId === npc.id) || {
    id: seq(ix, 'conversation'), npcId: npc.id, handle: npc.handle, subject: 'meeting',
    status: 'active', outcome: null, lastWorld: game.worldMinutes, messages: []
  };
  if (!ix.conversations.includes(convo)) ix.conversations.push(convo);
  const job = startJob(game, { kind: 'meeting', label: `meeting with @${npc.handle}`, minutes: 180, ram: 0, cpu: 0, meta: { conversationId: convo.id, npcId: npc.id } });
  if (!job.ok) return job;
  return { ok: true, convo, job: job.job };
}

export function npcOffer(game, query, role, salary) {
  return npcContact(game, query, 'employment', {
    subject: `offer: ${role}`, text: `I would like to offer you a ${role} position at ${fmtMoney(salary)}/yr.`,
    salary: money(salary), payload: { role }
  });
}

/* ---------------- software lifecycle ---------------- */
function findRepo(game, name) {
  return (game.repos || []).find(r => r.name.toLowerCase() === String(name || '').toLowerCase()) || null;
}
function projectPath(name) { return joinPath(HOME, 'projects', String(name).replace(/[^a-z0-9_-]/gi, '-')); }

export function devInit(game, name, lang = 'Python') {
  const title = String(name || '').trim();
  if (title.length < 2) return { ok: false, error: 'Project name is too short.' };
  if (findRepo(game, title)) return { ok: false, error: 'A project with that name already exists.' };
  const root = projectPath(title);
  if (exists(game.fs, root)) return { ok: false, error: 'That project directory already exists.' };
  const ext = lang.toLowerCase() === 'javascript' ? 'js' : lang.toLowerCase() === 'bash' ? 'sh' : lang.toLowerCase() === 'go' ? 'go' : 'py';
  ensureDir(game.fs, root, 'operator');
  ensureDir(game.fs, joinPath(root, 'src'), 'operator');
  ensureDir(game.fs, joinPath(root, 'tests'), 'operator');
  writeFile(game.fs, joinPath(root, 'README.md'), `# ${title}\n\nLanguage: ${lang}\nCreated by the operator.\n`, { owner: 'operator' });
  writeFile(game.fs, joinPath(root, `src/main.${ext}`), `# ${title}\n# Entry point\n\ndef main():\n    print("${title} ready")\n\nif __name__ == "__main__":\n    main()\n`, { owner: 'operator' });
  writeFile(game.fs, joinPath(root, 'tests/test_smoke.py'), 'def test_smoke():\n    assert True\n', { owner: 'operator' });
  const repo = {
    name: title, domain: 'git.nullnet', owner: 'player', stars: 0, lang,
    desc: `Independent ${lang} project created by the operator.`,
    files: { 'README.md': `# ${title}\n` }, quality: 42, downloads: 0,
    issues: [], pullRequests: [], builds: []
  };
  game.repos.push(repo);
  const job = startJob(game, { kind: 'download', label: `scaffold ${title}`, minutes: 20, ram: 1, meta: { filename: `${title}.scaffold`, content: `Project ${title} created at ${root}.\n` } });
  pushFeed(game, `Created project ${title} in ${root}.`, 'good');
  return { ok: true, repo, root, job: job.job || null };
}

export function devIssue(game, project, title) {
  const repo = findRepo(game, project);
  if (!repo) return { ok: false, error: 'No such project.' };
  const text = String(title || '').trim();
  if (text.length < 4) return { ok: false, error: 'Describe the issue.' };
  const ix = ensureInteraction(game);
  const issue = { id: seq(ix, 'issue'), title: text, author: 'operator', world: game.worldMinutes, status: 'open', repo: repo.name };
  repo.issues.push(issue);
  ix.dev.issues.push(issue);
  bounded(ix.dev.issues, CAPS.issues);
  pushFeed(game, `Issue opened on ${repo.name}: ${text}`, 'warn');
  return { ok: true, issue, repo };
}

export function devPr(game, project, npcQuery = null) {
  const repo = findRepo(game, project);
  if (!repo) return { ok: false, error: 'No such project.' };
  const ix = ensureInteraction(game);
  const npc = npcQuery
    ? (game.npcs || []).find(n => n.handle === String(npcQuery).replace(/^@/, '') || n.name.toLowerCase() === String(npcQuery).toLowerCase())
    : (game.npcs || []).find(n => (ix.npc.trust[n.id] || 0) > 45 && (ix.npc.preferences[n.id]?.interests || []).includes('software'));
  if (!npc) return { ok: false, error: 'No contributor is available. Meet an NPC developer first.' };
  const pr = {
    id: seq(ix, 'pr'), repo: repo.name, author: npc.handle, status: 'open',
    files: rngInts(game, 1, 4), world: game.worldMinutes,
    title: `Improve ${repo.name} error handling`
  };
  repo.pullRequests.push(pr);
  ix.dev.prs.push(pr);
  bounded(ix.dev.prs, CAPS.prs);
  const job = startJob(game, { kind: 'test', label: `review PR ${pr.id}`, minutes: 300, ram: 4, cpu: 40, meta: { project: repo.name, buildId: null } });
  const accepted = job.ok && (repo.quality || 40) > 35;
  pr.status = accepted ? 'merged' : 'changes-requested';
  if (accepted) {
    repo.quality = clamp(repo.quality + 5, 5, 99);
    repo.stars = (repo.stars || 0) + rngInts(game, 1, 6);
    ix.npc.trust[npc.id] = clamp((ix.npc.trust[npc.id] || 20) + 5, 0, 100);
  }
  pushFeed(game, `${npc.handle} ${accepted ? 'contributed to' : 'opened a PR on'} ${repo.name}.`, accepted ? 'good' : 'warn');
  return { ok: true, pr, accepted, repo };
}

function rngInts(game, min, max) {
  const r = irng(game, game.tickCount ^ 0x99);
  return r.int(min, max);
}

export function devBuild(game, project, version = '0.1.0') {
  const repo = findRepo(game, project);
  if (!repo) return { ok: false, error: 'No such project.' };
  const job = startJob(game, {
    kind: 'compile', label: `build ${repo.name}`, minutes: 240, ram: repo.lang === 'JavaScript' ? 4 : 8,
    cpu: 70, meta: { project: repo.name, version, minRam: repo.lang === 'JavaScript' ? 4 : 8 }
  });
  if (!job.ok) return job;
  return { ok: true, job: job.job, repo };
}

export function devTest(game, project, buildId = null) {
  const repo = findRepo(game, project);
  if (!repo) return { ok: false, error: 'No such project.' };
  const ix = ensureInteraction(game);
  const build = buildId ? ix.dev.builds.find(b => b.id === buildId && b.project === repo.name) : ix.dev.builds.filter(b => b.project === repo.name).slice(-1)[0];
  if (!build) return { ok: false, error: 'Build the project before testing it.' };
  const job = startJob(game, { kind: 'test', label: `test ${repo.name}`, minutes: 120, ram: 2, cpu: 45, meta: { project: repo.name, buildId: build.id } });
  if (!job.ok) return job;
  return { ok: true, job: job.job, build };
}

export function devDeploy(game, buildId, serverId) {
  const ix = ensureInteraction(game);
  const build = ix.dev.builds.find(b => b.id === buildId);
  if (!build || build.status !== 'ready') return { ok: false, error: 'No ready build with that id.' };
  const server = (game.servers || []).find(s => s.id === serverId || s.host === serverId);
  if (!server) return { ok: false, error: 'No such server.' };
  const job = startJob(game, { kind: 'deploy', label: `deploy ${build.project}`, minutes: 180, ram: 2, cpu: 30, cost: 40, meta: { buildId: build.id, project: build.project, serverId: server.id } });
  if (!job.ok) return job;
  return { ok: true, job: job.job, build, server };
}

export function devPublish(game, project) {
  const repo = findRepo(game, project);
  if (!repo) return { ok: false, error: 'No such project.' };
  if (repo.owner !== 'player') return { ok: false, error: 'You can only publish your own projects.' };
  const published = repo.publishedWorld ? false : true;
  if (!published) return { ok: false, error: 'Already published.' };
  repo.publishedWorld = game.worldMinutes;
  repo.stars = (repo.stars || 0) + 1;
  const job = startJob(game, { kind: 'download', label: `publish ${repo.name}`, minutes: 120, ram: 1, meta: { filename: `${repo.name}.release.txt`, content: `Release of ${repo.name} published on git.nullnet.\n` } });
  pushFeed(game, `Published ${repo.name}; NPC developers can now discover it.`, 'good');
  return { ok: true, repo, job: job.job || null };
}

/* ---------------- cyber lab ---------------- */
const LAB_SERVICES = [
  { name: 'ssh', version: '7.4', vuln: 'legacy authentication accepted', severity: 'high' },
  { name: 'http', version: '2.4.29', vuln: 'directory listing exposed', severity: 'medium' },
  { name: 'db', version: '5.7.18', vuln: 'default credentials present', severity: 'critical' },
  { name: 'dns', version: '9.10.3', vuln: 'recursion enabled for all clients', severity: 'low' }
];

export function labCreate(game, name, os = 'Debian 9') {
  const ix = ensureInteraction(game);
  const title = String(name || '').trim();
  if (title.length < 2) return { ok: false, error: 'Name the environment.' };
  if (ix.lab.environments.length >= CAPS.labEnvs) return { ok: false, error: 'Laboratory is at capacity.' };
  const rng = irng(game, hash32(title));
  const count = rng.int(2, 4);
  const services = rng.picks(LAB_SERVICES, count).map(s => ({ ...s, patched: false, discovered: false }));
  const env = {
    id: seq(ix, 'env'), name: title, os, services, status: 'active',
    createdWorld: game.worldMinutes, evidence: 0, scans: 0, patches: 0,
    network: `10.${rng.int(20, 60)}.${rng.int(0, 20)}.0/24`
  };
  ix.lab.environments.push(env);
  const job = startJob(game, { kind: 'download', label: `provision ${title}`, minutes: 360, ram: 6, cpu: 50, meta: { filename: `${title}.inventory`, content: JSON.stringify(env, null, 2) } });
  if (!job.ok) { env.status = 'queued'; }
  return { ok: true, env, job: job.job || null };
}

export function labAction(game, action, envQuery, service = null) {
  const ix = ensureInteraction(game);
  const q = String(envQuery || '').toLowerCase();
  const env = ix.lab.environments.find(e => e.id === q || e.name.toLowerCase() === q) || ix.lab.environments.slice(-1)[0];
  if (!env) return { ok: false, error: 'No lab environment. Create one first.' };
  if (action === 'scan') {
    const job = startJob(game, { kind: 'scan', label: `scan ${env.name}`, minutes: 300, ram: 4, cpu: 60, meta: { envId: env.id } });
    return job.ok ? { ok: true, env, job: job.job } : job;
  }
  if (action === 'capture') {
    const job = startJob(game, { kind: 'capture', label: `capture traffic in ${env.name}`, minutes: 90, ram: 2, cpu: 25, meta: { envId: env.id } });
    return job.ok ? { ok: true, env, job: job.job } : job;
  }
  if (action === 'patch') {
    const svc = env.services.find(s => s.name === service);
    if (!svc) return { ok: false, error: `Unknown service. Services: ${env.services.map(s => s.name).join(', ')}` };
    if (svc.patched) return { ok: false, error: `${svc.name} is already patched.` };
    const job = startJob(game, { kind: 'patch', label: `patch ${env.name}/${svc.name}`, minutes: 200, ram: 4, cpu: 40, meta: { envId: env.id, service: svc.name } });
    return job.ok ? { ok: true, env, service: svc, job: job.job } : job;
  }
  if (action === 'report') {
    const findings = env.services.filter(s => s.discovered || s.patched);
    if (!findings.length) return { ok: false, error: 'Scan the environment before writing a report.' };
    const report = {
      id: seq(ix, 'report'), envId: env.id, envName: env.name, world: game.worldMinutes,
      findings: findings.map(s => ({ service: s.name, issue: s.vuln, patched: s.patched, severity: s.severity })),
      quality: clamp(40 + env.evidence + env.patches * 10, 10, 99)
    };
    ix.lab.reports.push(report);
    bounded(ix.lab.reports, CAPS.labReports);
    if (game.civ?.player?.security?.score !== undefined) game.civ.player.security.score = clamp(game.civ.player.security.score + 3, 0, 100);
    if (game.player.reputation !== undefined) game.player.reputation = clamp(game.player.reputation + 1, 0, 100);
    pushFeed(game, `Security report filed for ${env.name}.`, 'good');
    return { ok: true, report };
  }
  return { ok: false, error: 'Unknown lab action.' };
}

/* ---------------- faults ---------------- */
export function faultDiagnose(game, id) {
  const ix = ensureInteraction(game);
  const fault = ix.faults.find(f => f.id === id) || ix.faults.find(f => f.status !== 'resolved' && f.kind === id);
  if (!fault) return { ok: false, error: 'No such fault.' };
  const skill = (game.player.skill || 1) + (game.civ?.player?.professional?.score || 0) / 40;
  if (skill < 2.5 && !fault.diagnosed) {
    return { ok: false, error: `You cannot identify the cause yet. Symptoms: ${fault.symptom}` };
  }
  fault.diagnosed = true;
  return { ok: true, fault };
}

export function faultRepair(game, id) {
  const ix = ensureInteraction(game);
  const fault = ix.faults.find(f => f.id === id) || ix.faults.find(f => f.status !== 'resolved' && f.kind === id);
  if (!fault) return { ok: false, error: 'No such fault.' };
  const job = startJob(game, { kind: 'repair', label: `repair ${fault.kind} fault`, minutes: 240, ram: 3, cpu: 50, cost: Math.max(20, fault.severity === 'error' ? 120 : 40), meta: { faultId: fault.id } });
  if (!job.ok) return job;
  return { ok: true, job: job.job, fault };
}

/* ---------------- hardware upgrades ---------------- */
export function hardwareUpgrade(game, part) {
  const ix = ensureInteraction(game);
  const hw = ix.hardware;
  const options = {
    ram: { label: 'RAM 16 → 32 GB', value: 32, cost: 480, minutes: 180, ram: 1 },
    cpu: { label: 'CPU 4 → 8 cores', value: 8, speed: 3.4, cost: 1200, minutes: 360, ram: 2 },
    storage: { label: 'Storage 512 → 1500 GB', value: 1500, cost: 640, minutes: 300, ram: 1 },
    gpu: { label: 'GPU 4 → 12 GB VRAM', value: 12, cost: 980, minutes: 300, ram: 2 },
    nic: { label: 'NIC 940 → 2500 Mbps', value: 2500, cost: 260, minutes: 90, ram: 1 }
  };
  const opt = options[String(part || '').toLowerCase()];
  if (!opt) return { ok: false, error: `Upgrade options: ${Object.keys(options).join(', ')}` };
  if (game.player.money < opt.cost) return { ok: false, error: `${opt.label} costs ${fmtMoney(opt.cost)}.` };
  const job = startJob(game, { kind: 'upgrade', label: opt.label, minutes: opt.minutes, ram: opt.ram, cpu: 30, cost: opt.cost, meta: { part, value: opt.value, speed: opt.speed } });
  if (!job.ok) return job;
  return { ok: true, job: job.job, option: opt };
}

/* ---------------- queries ---------------- */
export function interactionSummary(game) {
  const ix = ensureInteraction(game);
  return {
    ix,
    jobs: ix.jobs,
    running: activeJobs(ix),
    hardware: ix.hardware,
    bank: ix.bank,
    conversations: ix.conversations,
    offers: ix.offers,
    faults: ix.faults.filter(f => f.status !== 'resolved'),
    repos: (game.repos || []).filter(r => r.owner === 'player')
  };
}
