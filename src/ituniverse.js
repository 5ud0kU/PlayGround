/* Complete interactive IT universe layer.
   Component-level PC building, BIOS/UEFI, OS installation, electronics,
   network construction, studios, AI experiments, support tickets,
   challenges, skills, certifications and collecting. All state is shared,
   bounded, JSON-safe and driven by real simulated actions. */
import { makeRng, clamp, hash32, slugify } from './util.js';
import { startOperation } from './interaction.js';
import { playerPublishContent } from './society.js';

export const IT_VERSION = 1;
const DAY = 1440;
const CAPS = Object.freeze({ rigs: 40, installs: 80, circuits: 60, networks: 40, studios: 30, games: 80, ai: 60, agents: 80, tickets: 160, challenges: 120, collectibles: 220, events: 400 });

const CPUS = [
  { id:'cpu-i3', name:'Core i3 12100', socket:'LGA1700', cores:4, ghz:3.3, tdp:60, price:110, score:42, gen:12 },
  { id:'cpu-i7', name:'Core i7 13700K', socket:'LGA1700', cores:12, ghz:3.4, tdp:125, price:390, score:78, gen:13 },
  { id:'cpu-r5', name:'Ryzen 5 5600', socket:'AM4', cores:6, ghz:2.9, tdp:65, price:130, score:48, gen:5 },
  { id:'cpu-r9', name:'Ryzen 9 7950X', socket:'AM5', cores:16, ghz:3.6, tdp:170, price:720, score:96, gen:7 },
  { id:'cpu-epyc', name:'EPYC 9454P', socket:'SP5', cores:24, ghz:2.8, tdp:200, price:1800, score:120, gen:4 },
  { id:'cpu-retro', name:'Pentium 4 3.0', socket:'Socket478', cores:1, ghz:3.0, tdp:85, price:18, score:6, gen:1, vintage:true }
];
const MOBOS = [
  { id:'mb-h610', name:'H610M board', socket:'LGA1700', memory:'DDR4', slots:2, form:'mATX', price:75, tdp:18 },
  { id:'mb-z790', name:'Z790 board', socket:'LGA1700', memory:'DDR5', slots:4, form:'ATX', price:260, tdp:28 },
  { id:'mb-b550', name:'B550M board', socket:'AM4', memory:'DDR4', slots:4, form:'mATX', price:95, tdp:22 },
  { id:'mb-x670', name:'X670E board', socket:'AM5', memory:'DDR5', slots:4, form:'ATX', price:340, tdp:32 },
  { id:'mb-sp5', name:'SP5 server board', socket:'SP5', memory:'DDR5', slots:8, form:'E-ATX', price:980, tdp:45 },
  { id:'mb-845', name:'845 board', socket:'Socket478', memory:'DDR', slots:2, form:'ATX', price:14, tdp:15, vintage:true }
];
const RAM = [
  { id:'ram-8', name:'8 GB DDR4-3200', type:'DDR4', gb:8, sticks:1, price:35, speed:3200 },
  { id:'ram-16', name:'16 GB DDR4-3600', type:'DDR4', gb:16, sticks:2, price:78, speed:3600 },
  { id:'ram-32', name:'32 GB DDR5-5600', type:'DDR5', gb:32, sticks:2, price:180, speed:5600 },
  { id:'ram-64', name:'64 GB DDR5-6000', type:'DDR5', gb:64, sticks:4, price:420, speed:6000 },
  { id:'ram-512', name:'512 GB DDR5 ECC', type:'DDR5', gb:512, sticks:8, price:3800, speed:4800 },
  { id:'ram-1', name:'1 GB DDR-266', type:'DDR', gb:1, sticks:1, price:8, speed:266, vintage:true }
];
const GPUS = [
  { id:'gpu-ig', name:'Integrated graphics', vram:0, watts:0, price:0, score:5 },
  { id:'gpu-1060', name:'GTX 1060 6GB', vram:6, watts:120, price:140, score:32, vintage:true },
  { id:'gpu-4070', name:'RTX 4070', vram:12, watts:200, price:620, score:74 },
  { id:'gpu-4090', name:'RTX 4090', vram:24, watts:450, price:2100, score:110 },
  { id:'gpu-a6000', name:'A6000', vram:48, watts:300, price:3400, score:96, ai:true }
];
const STORAGE = [
  { id:'ssd-256', name:'256 GB SATA SSD', gb:256, type:'SSD', speed:520, price:40 },
  { id:'ssd-1t', name:'1 TB NVMe SSD', gb:1024, type:'NVMe', speed:3500, price:95 },
  { id:'ssd-4t', name:'4 TB NVMe SSD', gb:4096, type:'NVMe', speed:7000, price:360 },
  { id:'hdd-8t', name:'8 TB HDD', gb:8192, type:'HDD', speed:180, price:180 }
];
const PSU = [
  { id:'psu-450', name:'450 W bronze', watts:450, efficiency:.82, price:55 },
  { id:'psu-750', name:'750 W gold', watts:750, efficiency:.9, price:110 },
  { id:'psu-1200', name:'1200 W platinum', watts:1200, efficiency:.94, price:260 },
  { id:'psu-2000', name:'2000 W titanium', watts:2000, efficiency:.96, price:620 }
];
const COOLING = [
  { id:'cool-air', name:'Air cooler', capacity:90, watts:8, price:30 },
  { id:'cool-240', name:'240 mm AIO', capacity:160, watts:14, price:110 },
  { id:'cool-360', name:'360 mm AIO', capacity:240, watts:18, price:210 },
  { id:'cool-fan', name:'Stock fan', capacity:65, watts:4, price:10, vintage:true }
];
const CASES = [
  { id:'case-atx', name:'ATX tower', form:['ATX','mATX'], price:65, airflow:70 },
  { id:'case-matx', name:'Compact mATX case', form:['mATX'], price:80, airflow:50 },
  { id:'case-rack', name:'4U rack chassis', form:['ATX','mATX','E-ATX'], price:240, airflow:80 },
  { id:'case-vintage', name:'Beige tower', form:['ATX'], price:22, airflow:35, vintage:true }
];
const DISTROS = [
  { id:'distro-nullDesktop', name:'NullNet Desktop 26', kind:'desktop', kernel:'6.11-null', sizeGb:24, requirements:{ minCores:2, minRam:4 }, price:0, desktops:['Nova','Plain','Tile'] },
  { id:'distro-nullServer', name:'NullNet Server LTS', kind:'server', kernel:'6.6-lts', sizeGb:8, requirements:{ minCores:1, minRam:2 }, price:0, desktops:['none'] },
  { id:'distro-freebsd', name:'FreeNet 14', kind:'bsd', kernel:'14.2-stable', sizeGb:6, requirements:{ minCores:1, minRam:2 }, price:0, desktops:['none'] },
  { id:'distro-winlike', name:'Meridian Workstation OS', kind:'windows-like', kernel:'nt-11', sizeGb:48, requirements:{ minCores:4, minRam:8 }, price:180, desktops:['Shell'] },
  { id:'distro-embedded', name:'TinyRoot Embedded', kind:'embedded', kernel:'5.15-tiny', sizeGb:1, requirements:{ minCores:1, minRam:1 }, price:0, desktops:['none'] },
  { id:'distro-security', name:'Spectre Security', kind:'security', kernel:'6.9-sec', sizeGb:12, requirements:{ minCores:2, minRam:4 }, price:0, desktops:['XFCE'] },
  { id:'distro-retro', name:'NullNet 1998', kind:'retro', kernel:'2.0.36', sizeGb:.4, requirements:{ minCores:1, minRam:1 }, price:0, desktops:['WM'] }
];
const BOARDS = [
  { id:'board-uno', name:'NullUno R3', mcu:'ATmega-like', pins:14, price:22, watts:1 },
  { id:'board-pico', name:'Pico Zero', mcu:'RP-like', pins:20, price:12, watts:1 },
  { id:'board-rpi', name:'PocketPi 5', mcu:'ARM quad', pins:40, price:75, watts:8 },
  { id:'board-fpga', name:'OpenFPGA Nano', mcu:'LUT fabric', pins:32, price:190, watts:12 },
  { id:'board-esp', name:'MeshESP32', mcu:'wireless SoC', pins:18, price:9, watts:2 }
];
const SENSORS = [
  { id:'sensor-temp', name:'Temperature probe', pins:1, price:4, kind:'input' },
  { id:'sensor-motion', name:'Motion sensor', pins:2, price:9, kind:'input' },
  { id:'sensor-cam', name:'Camera module', pins:4, price:45, kind:'input' },
  { id:'sensor-relay', name:'Relay module', pins:2, price:7, kind:'output' },
  { id:'sensor-led', name:'LED matrix', pins:6, price:14, kind:'output' },
  { id:'sensor-gps', name:'GPS receiver', pins:3, price:25, kind:'input' }
];
const NODE_TYPES = {
  router: { cost:120, latency:2, throughput:1000, color:'b' },
  switch: { cost:60, latency:.5, throughput:2000 },
  firewall: { cost:180, latency:3, throughput:800 },
  ap: { cost:90, latency:4, throughput:300 },
  server: { cost:0, latency:2, throughput:500 },
  gateway: { cost:140, latency:5, throughput:600 },
  balancer: { cost:220, latency:2, throughput:1500 }
};
const ENGINES = ['NullEngine 2D','NullEngine 3D','PixelForge','Orbit SDK','Text Adventure Kit'];
const AI_BASES = ['lumen-8b','lumen-70b','kestrel-7b','sable-embed','atlas-4-mini'];
const CERTS = [
  { id:'cert-net', name:'Associate Network Operator', skill:'networking', required:6, cost:120 },
  { id:'cert-sys', name:'Certified System Administrator', skill:'sysadmin', required:7, cost:160 },
  { id:'cert-sec', name:'Defensive Security Practitioner', skill:'security', required:8, cost:220 },
  { id:'cert-dev', name:'Software Developer Credential', skill:'programming', required:7, cost:180 },
  { id:'cert-cloud', name:'Cloud Architect Associate', skill:'cloud', required:9, cost:280 },
  { id:'cert-ai', name:'Applied AI Engineer', skill:'ai', required:9, cost:340 },
  { id:'cert-hw', name:'Hardware Technician', skill:'hardware', required:7, cost:180 }
];
const SKILLS = ['programming','networking','sysadmin','security','hardware','ai','cloud','business','media','research'];
const COLLECTIBLES = [
  { id:'retro-pentium', name:'Boxed Pentium 4', kind:'cpu', rarity:'uncommon', condition:72, base:60 },
  { id:'retro-386', name:'386DX-40 chip', kind:'cpu', rarity:'rare', condition:55, base:140 },
  { id:'retro-sound', name:'SoundBlaster-compatible card', kind:'card', rarity:'rare', condition:68, base:180 },
  { id:'retro-os', name:'Sealed NullNet 1998 media', kind:'software', rarity:'rare', condition:90, base:95 },
  { id:'book-asm', name:'Assembly for Microcontrollers', kind:'book', rarity:'common', condition:80, base:35 },
  { id:'book-tcp', name:'TCP/IP Illustrated, fictional edition', kind:'book', rarity:'uncommon', condition:78, base:85 },
  { id:'retro-router', name:'10 Mbps hub', kind:'network', rarity:'uncommon', condition:60, base:45 },
  { id:'dev-kit', name:'First-generation dev board', kind:'board', rarity:'rare', condition:66, base:210 }
];

function irng(game, salt = 0) { return makeRng((game.seed ^ Math.floor((game.worldMinutes || 0) * 2654435761) ^ ((game.tickCount || 0) * 97) ^ salt) >>> 0); }
function nextId(st, prefix) { st.seq[prefix] = (st.seq[prefix] || 1) + 1; return `${prefix}-${String(st.seq[prefix]).padStart(4, '0')}`; }
function bounded(arr, maximum) { if (Array.isArray(arr) && arr.length > maximum) arr.splice(0, arr.length - maximum); return arr; }
function money(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('en-US'); }
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
function event(st, category, title, body = '', severity = 'minor') {
  st.events.push({ id: nextId(st, 'event'), world: st.worldMinutes || 0, category, title: String(title).slice(0, 140), body: String(body).slice(0, 280), severity });
  bounded(st.events, CAPS.events);
}
function findPart(id) {
  return [...CPUS, ...MOBOS, ...RAM, ...GPUS, ...STORAGE, ...PSU, ...COOLING, ...CASES].find(p => p.id === id) || null;
}
export function partName(id) { return findPart(id)?.name || String(id || 'unknown'); }
function skillLevel(xp) { return clamp(1 + Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / 90)), 1, 40); }
function skillBonus(game, key) { const st = ensureIT(game); return skillLevel(st.skills[key]?.xp || 0); }

export function ensureIT(game) {
  if (!game.it || typeof game.it !== 'object' || !game.it.seq) {
    game.it = buildIT(game, irng(game, 0x7e1));
    return game.it;
  }
  const st = game.it;
  st.version = IT_VERSION;
  st.worldMinutes = game.worldMinutes || 0;
  st.seq = st.seq || {};
  for (const key of ['rig','install','circuit','network','node','link','studio','game','ai','agent','ticket','challenge','collectible','event','test']) if (typeof st.seq[key] !== 'number') st.seq[key] = 1;
  const arrays = { rigs:'rigs', installs:'installs', circuits:'circuits', networks:'networks', studios:'studios', games:'games', ai:'ai', agents:'agents', tickets:'tickets', challenges:'challenges', collectibles:'collectibles', events:'events' };
  for (const [key, field] of Object.entries(arrays)) if (!Array.isArray(st[key])) st[key] = [];
  st.skills = st.skills || {};
  for (const key of SKILLS) if (!st.skills[key] || typeof st.skills[key] !== 'object') st.skills[key] = { xp: 0, level: 1, history: [] };
  st.certs = st.certs || [];
  st.cadence = st.cadence || {};
  st.metrics = st.metrics || {};
  st.inventory = st.inventory || [];
  for (const [key, cap] of Object.entries(CAPS)) {
    const field = key === 'identities' ? null : arrays[key];
    if (field) bounded(st[field], cap);
  }
  recomputeITMetrics(game, st);
  return st;
}

function buildIT(game, rng) {
  const st = {
    version: IT_VERSION, worldMinutes: game.worldMinutes || 0,
    seq: { rig:1, install:1, circuit:1, network:1, node:1, link:1, studio:1, game:1, ai:1, agent:1, ticket:1, challenge:1, collectible:1, event:1, test:1 },
    rigs: [], installs: [], circuits: [], networks: [], studios: [], games: [], ai: [], agents: [],
    tickets: [], challenges: [], collectibles: [], events: [], inventory: [], skills: {}, certs: [],
    cadence: {}, metrics: {}, activeRigId: null
  };
  for (const key of SKILLS) st.skills[key] = { xp: 0, level: 1, history: [] };
  game.it = st; // publish state before helpers that call ensureIT()
  // Starter rig uses the workstation baseline.
  const hw = game.interact?.hardware;
  const rig = {
    id: nextId(st, 'rig'), name: 'voidbox', preset: 'workstation', status: 'assembled',
    parts: { cpu:'cpu-r5', mobo:'mb-b550', ram:'ram-16', gpu:'gpu-ig', storage:'ssd-1t', psu:'psu-450', cooling:'cool-air', case:'case-matx' },
    bios: { multiplier: 100, voltage: 'auto', fan: 'balanced', bootOrder: ['nvme0'], secureBoot: false },
    partitions: [], bootCount: 0, temperature: 38, powerW: 120, health: 96, failures: 0,
    performance: 48, components: [], createdWorld: game.worldMinutes || 0, lastStressWorld: 0
  };
  st.rigs.push(rig);
  st.activeRigId = rig.id;
  if (hw) {
    rig.parts.cpu = 'cpu-r5';
    rig.performance = Math.round((hw.cpu?.cores || 4) * (hw.cpu?.ghz || 2.9) * 4);
  }
  for (const item of COLLECTIBLES.slice(0, 5)) {
    const record = { ...item, id: nextId(st, 'collectible'), itemId: item.id, owned: item.id === 'book-asm', acquiredWorld: item.id === 'book-asm' ? game.worldMinutes || 0 : null, demand: rng.int(40, 80) };
    st.collectibles.push(record);
    if (record.owned) st.inventory.push({ id: record.id, name: record.name, kind: record.kind });
  }
  installOS(game, rig.id, 'distro-nullDesktop', { partitions: [{ mount:'/', sizeGb:80, fs:'ext4' }, { mount:'/home', sizeGb:200, fs:'ext4' }], bootloader:'grub-like' });
  event(st, 'lab', 'Home laboratory registered', 'A starter workstation is assembled with NullNet Desktop installed.');
  recomputeITMetrics(game, st);
  return st;
}

/* ---------------- skills and certifications ---------------- */
export function addSkill(game, key, xp, reason) {
  const st = ensureIT(game);
  if (!SKILLS.includes(key)) return null;
  const entry = st.skills[key];
  const before = skillLevel(entry.xp);
  entry.xp = Math.max(0, Math.round(entry.xp + Math.max(0, xp)));
  entry.level = skillLevel(entry.xp);
  entry.history.push({ world: game.worldMinutes || 0, xp: Math.max(0, xp), reason: String(reason || '').slice(0, 120) });
  bounded(entry.history, 60);
  if (entry.level > before) event(st, 'skill', `${key} skill reached level ${entry.level}`, reason);
  return entry;
}
export function skillOverview(game) {
  const st = ensureIT(game);
  return {
    skills: SKILLS.map(key => ({ key, ...st.skills[key], level: skillLevel(st.skills[key].xp) })),
    certifications: st.certs.slice(),
    available: CERTS.map(c => ({ ...c, eligible: skillLevel(st.skills[c.skill]?.xp || 0) >= c.required }))
  };
}
export function takeCertification(game, certId) {
  const st = ensureIT(game);
  const cert = CERTS.find(c => c.id === certId);
  if (!cert) return { ok: false, error: 'No such certification.' };
  if (st.certs.some(c => c.id === certId)) return { ok: false, error: 'You already hold that certification.' };
  const level = skillLevel(st.skills[cert.skill]?.xp || 0);
  if (level < cert.required) return { ok: false, error: `Requires ${cert.skill} level ${cert.required}; you have ${level}.` };
  if (!spend(game, cert.cost, `certification ${cert.id}`)) return { ok: false, error: `Exam costs ${money(cert.cost)}.` };
  const rng = irng(game, hash32(certId));
  const chance = clamp(.55 + (level - cert.required) * .06 + skillBonus(game, cert.skill) * .01, .2, .96);
  const pass = rng.next() < chance;
  if (!pass) return { ok: false, error: 'You failed the practical exam. Skill XP is retained; study and retry.' };
  st.certs.push({ id: cert.id, name: cert.name, skill: cert.skill, world: game.worldMinutes || 0 });
  event(st, 'certification', `Certified: ${cert.name}`, 'Passed a practical examination based on demonstrated skill.');
  earn(game, 0, 'certificate issued');
  return { ok: true, cert };
}

/* ---------------- PC building ---------------- */
function compatibility(rig) {
  const p = rig.parts;
  const cpu = findPart(p.cpu), mobo = findPart(p.mobo), ram = findPart(p.ram), gpu = findPart(p.gpu), psu = findPart(p.psu), cooling = findPart(p.cooling), storage = findPart(p.storage), box = findPart(p.case);
  const problems = [];
  if (!cpu || !mobo || !ram || !storage || !psu || !cooling || !box) return { ok: false, problems: ['missing core component'] };
  if (cpu.socket !== mobo.socket) problems.push(`CPU socket ${cpu.socket} does not match motherboard ${mobo.socket}`);
  if (ram.type !== mobo.memory) problems.push(`RAM type ${ram.type} is not supported by ${mobo.memory} motherboard`);
  if (ram.sticks > mobo.slots) problems.push(`RAM needs ${ram.sticks} slots but board has ${mobo.slots}`);
  if (!box.form.includes(mobo.form)) problems.push(`Motherboard ${mobo.form} does not fit ${box.name}`);
  const draw = 25 + cpu.tdp + (gpu?.watts || 0) + cooling.watts + mobo.tdp;
  if (psu.watts < draw * 1.15) problems.push(`PSU ${psu.watts} W is below recommended ${Math.ceil(draw * 1.15)} W`);
  if (cooling.capacity < cpu.tdp) problems.push(`Cooling capacity ${cooling.capacity} W is below CPU TDP ${cpu.tdp} W`);
  const requiredRam = Math.max(1, Math.ceil(ram.gb / 2));
  return {
    ok: problems.length === 0, problems, draw, headroom: psu.watts - draw,
    performance: Math.round(cpu.score * .6 + (gpu?.score || 0) * .3 + ram.gb * .6 + (storage.speed / 100)),
    gpuScore: gpu?.score || 0, ramGb: ram.gb, storageGb: storage.gb,
    requiredRam
  };
}
export function componentCatalog(game) {
  const st = ensureIT(game);
  const bonus = skillLevel(st.skills.hardware?.xp || 0);
  return {
    cpu: CPUS.map(c => ({ ...c, unlocked: !c.vintage || bonus >= 6 })),
    mobo: MOBOS.map(c => ({ ...c })), ram: RAM.map(c => ({ ...c })), gpu: GPUS.map(c => ({ ...c })),
    storage: STORAGE.map(c => ({ ...c })), psu: PSU.map(c => ({ ...c })), cooling: COOLING.map(c => ({ ...c })), case: CASES.map(c => ({ ...c }))
  };
}
function buildCost(parts) {
  return Object.values(parts).reduce((s, id) => s + (findPart(id)?.price || 0), 0);
}
export function assembleRig(game, name, parts, preset = 'custom') {
  const st = ensureIT(game);
  if (st.rigs.length >= CAPS.rigs) return { ok: false, error: 'Laboratory capacity reached.' };
  const clean = slugify(name) || `rig-${st.rigs.length + 1}`;
  const rig = {
    id: nextId(st, 'rig'), name: clean, preset, status: 'assembled',
    parts: { gpu:'gpu-ig', ...parts },
    bios: { multiplier:100, voltage:'auto', fan:'balanced', bootOrder:['nvme0'], secureBoot:false },
    partitions: [], bootCount: 0, temperature: 36, powerW: 0, health: 100, failures: 0,
    performance: 0, components: [], createdWorld: game.worldMinutes || 0, lastStressWorld: 0
  };
  const check = compatibility(rig);
  if (!spend(game, buildCost(rig.parts), `assemble ${clean}`)) return { ok: false, error: `Insufficient funds. This build costs ${money(buildCost(rig.parts))}.` };
  if (!check.ok) {
    rig.status = 'faulty';
    rig.faults = check.problems;
  } else {
    rig.performance = check.performance;
    rig.powerW = check.draw;
  }
  st.rigs.push(rig);
  st.activeRigId = rig.id;
  addSkill(game, 'hardware', 18, `assembled ${clean}`);
  event(st, 'lab', `${clean} assembled`, check.ok ? `Performance ${rig.performance}, estimated draw ${Math.round(rig.powerW)} W.` : check.problems.join('; '), check.ok ? 'minor' : 'warn');
  return { ok: true, rig, check };
}
export function selectRig(game, rigId) {
  const st = ensureIT(game);
  const rig = st.rigs.find(r => r.id === rigId || r.name === rigId);
  if (!rig) return { ok: false, error: 'No such rig.' };
  st.activeRigId = rig.id;
  const hw = game.interact?.hardware;
  if (hw && rig.status !== 'faulty') {
    const cpu = findPart(rig.parts.cpu), ram = findPart(rig.parts.ram), gpu = findPart(rig.parts.gpu), storage = findPart(rig.parts.storage);
    hw.cpu = { model: cpu.name, cores: cpu.cores, ghz: cpu.ghz * (rig.bios.multiplier / 100) };
    hw.gpu = { model: gpu.name, vramGb: gpu.vram };
    hw.memoryGb = ram.gb; hw.storageGb = storage.gb;
    hw.temperature = rig.temperature; hw.powerW = rig.powerW; hw.health = rig.health;
  }
  event(st, 'lab', `Active rig: ${rig.name}`, 'Workstation capabilities updated to the selected machine.');
  return { ok: true, rig };
}
export function setBios(game, rigId, key, value) {
  const st = ensureIT(game);
  const rig = st.rigs.find(r => r.id === rigId || r.name === rigId) || st.rigs.find(r => r.id === st.activeRigId);
  if (!rig) return { ok: false, error: 'No such rig.' };
  const allowed = ['multiplier','voltage','fan','secureBoot','bootOrder'];
  if (!allowed.includes(key)) return { ok: false, error: `Unknown BIOS setting '${key}'. Try: ${allowed.join(', ')}` };
  if (key === 'multiplier') {
    const m = clamp(Number(value) || 100, 80, 140);
    rig.bios.multiplier = m;
    const cpu = findPart(rig.parts.cpu);
    rig.powerW = Math.round((25 + cpu.tdp + (findPart(rig.parts.gpu)?.watts || 0)) * (m / 100));
    rig.temperature = clamp(rig.temperature + (m - 100) * .35, 28, 110);
  } else if (key === 'voltage') rig.bios.voltage = /^(auto|low|normal|high)$/.test(value) ? value : 'auto';
  else if (key === 'fan') rig.bios.fan = /^(silent|balanced|aggressive)$/.test(value) ? value : 'balanced';
  else if (key === 'secureBoot') rig.bios.secureBoot = /^(on|true|1)$/i.test(value);
  else rig.bios.bootOrder = String(value).split(',').map(s => s.trim()).slice(0, 4);
  addSkill(game, 'hardware', 4, `configured ${key} on ${rig.name}`);
  event(st, 'lab', `BIOS updated on ${rig.name}`, `${key} = ${rig.bios[key]}`);
  return { ok: true, rig };
}
export function stressTest(game, rigId, minutes = 60) {
  const st = ensureIT(game);
  const rig = st.rigs.find(r => r.id === rigId || r.name === rigId) || st.rigs.find(r => r.id === st.activeRigId);
  if (!rig) return { ok: false, error: 'No such rig.' };
  if (rig.status === 'faulty') return { ok: false, error: 'The rig has a hardware fault. Fix it first.' };
  const check = compatibility(rig);
  const target = 42 + (rig.powerW / 18) + (rig.bios.fan === 'silent' ? 14 : rig.bios.fan === 'aggressive' ? -8 : 0);
  rig.temperature = clamp(rig.temperature + (target - rig.temperature) * .6, 28, 120);
  const stable = rig.temperature < 88 && rig.health > 25;
  const result = {
    ok: true, stable, temperature: Math.round(rig.temperature), powerW: Math.round(rig.powerW),
    performance: Math.round(rig.performance * (1 + (rig.bios.multiplier - 100) / 240)),
    faults: check.problems.slice()
  };
  if (!stable) {
    rig.health = clamp(rig.health - 12, 0, 100);
    rig.failures++;
    event(st, 'hardware', `Thermal failure on ${rig.name}`, `${result.temperature}°C recorded. Health ${Math.round(rig.health)}/100.`, 'critical');
  } else {
    addSkill(game, 'hardware', 8, `stress-tested ${rig.name}`);
    event(st, 'hardware', `${rig.name} passed stress test`, `${result.temperature}°C · ${result.performance} points.`);
  }
  rig.lastStressWorld = game.worldMinutes || 0;
  return result;
}

/* ---------------- OS and boot ---------------- */
export function partitionDisk(game, rigId, scheme) {
  const st = ensureIT(game);
  const rig = st.rigs.find(r => r.id === rigId || r.name === rigId) || st.rigs.find(r => r.id === st.activeRigId);
  if (!rig) return { ok: false, error: 'No such rig.' };
  const rows = String(scheme || '').split(/[,;]/).map(s => s.trim()).filter(Boolean).map(s => {
    const [mount, sizeGb, fs] = s.split(':');
    return { mount: mount || '/', sizeGb: clamp(Number(sizeGb) || 20, 1, 100000), fs: /^(ext4|btrfs|zfs|ntfs|ufs)$/.test(fs) ? fs : 'ext4' };
  });
  if (!rows.length) return { ok: false, error: 'usage: part <rig> /:40,ext4 /home:100,ext4' };
  const storage = findPart(rig.parts.storage);
  const total = rows.reduce((s, r) => s + r.sizeGb, 0);
  if (total > storage.gb) return { ok: false, error: `Partitions need ${total} GB but disk has ${storage.gb} GB.` };
  rig.partitions = rows;
  addSkill(game, 'sysadmin', 8, `partitioned ${rig.name}`);
  return { ok: true, rig, partitions: rig.partitions };
}
export function installOS(game, rigId, distroId, opts = {}) {
  const st = ensureIT(game);
  const rig = st.rigs.find(r => r.id === rigId || r.name === rigId) || st.rigs.find(r => r.id === st.activeRigId);
  const distro = DISTROS.find(d => d.id === distroId || d.name.toLowerCase() === String(distroId).toLowerCase());
  if (!rig) return { ok: false, error: 'No such rig.' };
  if (!distro) return { ok: false, error: `Unknown distribution. Try: ${DISTROS.map(d => d.id).join(', ')}` };
  if (rig.status === 'faulty') return { ok: false, error: 'Fix the hardware fault before installing.' };
  const cpu = findPart(rig.parts.cpu), ram = findPart(rig.parts.ram), storage = findPart(rig.parts.storage);
  if (cpu.cores < distro.requirements.minCores || ram.gb < distro.requirements.minRam) return { ok: false, error: `${distro.name} requires ${distro.requirements.minCores} cores and ${distro.requirements.minRam} GB RAM.` };
  const partitions = opts.partitions || rig.partitions || [{ mount:'/', sizeGb:Math.min(40, storage.gb), fs:'ext4' }];
  const free = storage.gb - partitions.reduce((s, p) => s + p.sizeGb, 0);
  if (free < distro.sizeGb) return { ok: false, error: `Not enough unallocated space for ${distro.name} (${distro.sizeGb} GB).` };
  const existing = st.installs.filter(i => i.rigId === rig.id && !i.removed);
  if (!opts.dualBoot && existing.length) for (const i of existing) i.removed = true;
  const install = {
    id: nextId(st, 'install'), rigId: rig.id, distroId: distro.id, distroName: distro.name,
    kind: distro.kind, kernel: distro.kernel, desktop: opts.desktop || distro.desktops[0],
    bootloader: opts.bootloader || (existing.length ? 'grub-like dual boot' : 'grub-like'),
    partitions: JSON.parse(JSON.stringify(partitions)), installedWorld: game.worldMinutes || 0,
    updates: 0, config: {}, status: 'installed', removed: false
  };
  st.installs.push(install);
  bounded(st.installs, CAPS.installs);
  const logs = bootSequence(rig, install);
  addSkill(game, 'sysadmin', 12, `installed ${distro.name} on ${rig.name}`);
  event(st, 'os', `${distro.name} installed on ${rig.name}`, `${install.bootloader} · ${install.desktop} desktop · kernel ${install.kernel}`);
  return { ok: true, install, logs };
}
function bootSequence(rig, install) {
  const logs = [];
  logs.push(`POST: CPU ${findPart(rig.parts.cpu).name} detected (${findPart(rig.parts.cpu).cores} cores)`);
  logs.push(`POST: memory ${findPart(rig.parts.ram).gb} GB ok`);
  if (rig.bios.secureBoot && install.kind === 'bsd') logs.push('Secure Boot: unsigned loader rejected — boot halted');
  else logs.push(`Bootloader ${install.bootloader}: loading ${install.distroName}`);
  logs.push(`Kernel ${install.kernel}: mounting ${install.partitions.map(p => p.mount).join(' ')}`);
  logs.push(`${install.desktop === 'none' ? 'Text console' : install.desktop + ' desktop'}: ready`);
  rig.bootCount++;
  return logs;
}
export function bootRig(game, rigId) {
  const st = ensureIT(game);
  const rig = st.rigs.find(r => r.id === rigId || r.name === rigId) || st.rigs.find(r => r.id === st.activeRigId);
  if (!rig) return { ok: false, error: 'No such rig.' };
  const installs = st.installs.filter(i => i.rigId === rig.id && !i.removed);
  if (!installs.length) return { ok: false, error: 'No operating system installed.' };
  const chosen = rig.bios.bootOrder.map(m => installs.find(i => i.bootloader.includes(m) || m === 'nvme0')).find(Boolean) || installs[0];
  const logs = bootSequence(rig, chosen);
  addSkill(game, 'sysadmin', 2, `booted ${rig.name}`);
  return { ok: true, install: chosen, logs };
}
export function configureOS(game, installId, key, value) {
  const st = ensureIT(game);
  const install = st.installs.find(i => i.id === installId || i.distroId === installId);
  if (!install) return { ok: false, error: 'No such installation.' };
  install.config[key] = String(value).slice(0, 80);
  addSkill(game, 'sysadmin', 3, `configured ${key} on ${install.distroName}`);
  return { ok: true, install };
}
export function publishDistro(game, installId, name) {
  const st = ensureIT(game);
  const install = st.installs.find(i => i.id === installId);
  if (!install) return { ok: false, error: 'No such installation.' };
  const title = String(name || `${install.distroName} custom`).slice(0, 60);
  const result = playerPublishContent(game, 'guide', title, `Custom distribution based on ${install.distroName}. Kernel ${install.kernel}. Config: ${JSON.stringify(install.config)}.`, 0);
  if (!result.ok) return result;
  event(st, 'os', `Custom distribution published: ${title}`, `Based on ${install.distroName}`);
  addSkill(game, 'sysadmin', 20, `published custom distribution ${title}`);
  return { ok: true, content: result.content };
}

/* ---------------- electronics ---------------- */
export function createCircuit(game, name, boardId, sensorIds, firmware) {
  const st = ensureIT(game);
  const board = BOARDS.find(b => b.id === boardId);
  if (!board) return { ok: false, error: `Unknown board. Try: ${BOARDS.map(b => b.id).join(', ')}` };
  const sensors = sensorIds.map(id => SENSORS.find(s => s.id === id)).filter(Boolean);
  if (sensors.length !== sensorIds.length) return { ok: false, error: 'Unknown sensor in the circuit.' };
  const requiredPins = sensors.reduce((s, x) => s + x.pins, 0) + 1;
  if (requiredPins > board.pins) return { ok: false, error: `${board.name} has ${board.pins} pins; the circuit needs ${requiredPins}.` };
  const power = board.watts + sensors.reduce((s, x) => s + (x.kind === 'output' ? 2 : .5), 0);
  const code = String(firmware || `void setup() {\n  pinMode(0, INPUT);\n}\n\nvoid loop() {\n  readPin(0);\n}\n`);
  if (!/void\s+setup\s*\(/.test(code) || !/void\s+loop\s*\(/.test(code)) return { ok: false, error: 'Firmware must define setup() and loop().' };
  const circuit = {
    id: nextId(st, 'circuit'), name: slugify(name) || `device-${st.circuits.length + 1}`, boardId: board.id,
    boardName: board.name, sensors: sensors.map(s => s.id), firmware: code,
    powerW: Math.round(power * 10) / 10, pinsUsed: requiredPins, status: 'built', tests: [], createdWorld: game.worldMinutes || 0
  };
  const cost = board.price + sensors.reduce((s, x) => s + x.price, 0);
  if (!spend(game, cost, `build device ${circuit.name}`)) return { ok: false, error: `Components cost ${money(cost)}.` };
  st.circuits.push(circuit);
  bounded(st.circuits, CAPS.circuits);
  addSkill(game, 'hardware', 14, `built electronic device ${circuit.name}`);
  addSkill(game, 'programming', 6, `wrote firmware for ${circuit.name}`);
  event(st, 'electronics', `${circuit.name} built`, `${board.name} · ${sensors.length} modules · ${circuit.pinsUsed}/${board.pins} pins used.`);
  return { ok: true, circuit };
}
export function testCircuit(game, circuitId, opts = {}) {
  const st = ensureIT(game);
  const circuit = st.circuits.find(c => c.id === circuitId || c.name === circuitId);
  if (!circuit) return { ok: false, error: 'No such device.' };
  const board = BOARDS.find(b => b.id === circuit.boardId);
  const rng = irng(game, hash32(circuit.id));
  const fault = opts.injectFault || (rng.chance(.12) ? 'loose-ground' : null);
  const passed = !fault && /readPin|digitalWrite|analogRead/.test(circuit.firmware);
  const test = { id: nextId(st, 'test'), circuitId: circuit.id, world: game.worldMinutes || 0, result: passed ? 'pass' : 'fail', fault, notes: passed ? 'device responds as programmed' : fault ? `fault injected: ${fault}` : 'firmware never reads or writes a pin' };
  circuit.tests.push(test);
  bounded(circuit.tests, 30);
  if (passed) { circuit.status = 'working'; addSkill(game, 'hardware', 5, `tested ${circuit.name}`); }
  else circuit.status = 'faulty';
  return { ok: true, test, circuit };
}

/* ---------------- network sandbox ---------------- */
export function createNetwork(game, name) {
  const st = ensureIT(game);
  const net = {
    id: nextId(st, 'network'), name: slugify(name) || `net-${st.networks.length + 1}`,
    nodes: [], links: [], tests: [], createdWorld: game.worldMinutes || 0, status: 'designed'
  };
  st.networks.push(net);
  bounded(st.networks, CAPS.networks);
  addSkill(game, 'networking', 6, `designed network ${net.name}`);
  return { ok: true, network: net };
}
export function addNetworkNode(game, networkId, type, name, ip) {
  const st = ensureIT(game);
  const net = st.networks.find(n => n.id === networkId || n.name === networkId);
  if (!net) return { ok: false, error: 'No such network.' };
  const def = NODE_TYPES[type];
  if (!def) return { ok: false, error: `Unknown node type. Try: ${Object.keys(NODE_TYPES).join(', ')}` };
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip || '')) return { ok: false, error: 'A valid IPv4 address is required.' };
  if (net.nodes.some(n => n.ip === ip)) return { ok: false, error: 'That address is already assigned.' };
  const node = { id: nextId(st, 'node'), type, name: slugify(name) || type, ip, config: { vlan: 1, dhcp: type === 'server' ? false : true, dns: '', nat: false, firewall: [], routing: 'static', up: true }, logs: [] };
  net.nodes.push(node);
  if (def.cost) spend(game, def.cost, `network node ${node.name}`);
  event(st, 'network', `${node.name} added to ${net.name}`, `${type} at ${ip}`);
  return { ok: true, node, network: net };
}
export function connectNodes(game, networkId, a, b, opts = {}) {
  const st = ensureIT(game);
  const net = st.networks.find(n => n.id === networkId || n.name === networkId);
  if (!net) return { ok: false, error: 'No such network.' };
  const from = net.nodes.find(n => n.id === a || n.name === a);
  const to = net.nodes.find(n => n.id === b || n.name === b);
  if (!from || !to) return { ok: false, error: 'Both endpoints must exist in the network.' };
  if (net.links.some(l => (l.from === from.id && l.to === to.id) || (l.from === to.id && l.to === from.id))) return { ok: false, error: 'Those nodes are already connected.' };
  const link = { from: from.id, to: to.id, latencyMs: clamp(Number(opts.latency) || 2, 0, 500), bandwidthMbps: clamp(Number(opts.bandwidth) || 1000, 1, 100000), loss: clamp(Number(opts.loss) || 0, 0, 50), up: opts.up !== false };
  net.links.push(link);
  return { ok: true, link, network: net };
}
export function configNode(game, networkId, nodeId, key, value) {
  const st = ensureIT(game);
  const net = st.networks.find(n => n.id === networkId || n.name === networkId);
  const node = net?.nodes.find(n => n.id === nodeId || n.name === nodeId);
  if (!node) return { ok: false, error: 'No such node.' };
  if (key === 'vlan') node.config.vlan = clamp(Number(value) || 1, 1, 4094);
  else if (key === 'dhcp') node.config.dhcp = /^(on|true|1)$/i.test(value);
  else if (key === 'dns') node.config.dns = String(value || '');
  else if (key === 'nat') node.config.nat = /^(on|true|1)$/i.test(value);
  else if (key === 'routing') node.config.routing = /^(static|ospf|bgp)$/.test(value) ? value : 'static';
  else if (key === 'firewall') {
    const port = clamp(Number(value) || 0, 0, 65535);
    if (port) node.config.firewall.push({ port, policy: 'allow' });
  } else if (key === 'up') node.config.up = /^(on|true|1)$/i.test(value);
  else return { ok: false, error: `Unknown setting '${key}'. Try: vlan, dhcp, dns, nat, routing, firewall, up` };
  node.logs.push({ world: game.worldMinutes || 0, text: `${key} = ${node.config[key]}` });
  addSkill(game, 'networking', 3, `configured ${key} on ${node.name}`);
  return { ok: true, node };
}
export function testNetwork(game, networkId, source, destination) {
  const st = ensureIT(game);
  const net = st.networks.find(n => n.id === networkId || n.name === networkId);
  if (!net) return { ok: false, error: 'No such network.' };
  const src = net.nodes.find(n => n.id === source || n.name === source || n.ip === source);
  const dst = net.nodes.find(n => n.id === destination || n.name === destination || n.ip === destination);
  if (!src || !dst) return { ok: false, error: 'Source or destination does not exist.' };
  const queue = [[src]], seen = new Set([src.id]);
  let path = null;
  while (queue.length) {
    const p = queue.shift();
    if (p.at(-1).id === dst.id) { path = p; break; }
    for (const link of net.links) {
      if (!link.up) continue;
      const next = link.from === p.at(-1).id ? net.nodes.find(n => n.id === link.to) : link.to === p.at(-1).id ? net.nodes.find(n => n.id === link.from) : null;
      if (next && !seen.has(next.id)) { seen.add(next.id); queue.push([...p, next]); }
    }
  }
  const problems = [];
  if (!path) problems.push('no route: the nodes are not connected');
  else {
    for (const node of path) {
      if (!node.config.up) problems.push(`${node.name} interface is down`);
      if (node.config.vlan !== path[0].config.vlan) problems.push(`${node.name} VLAN ${node.config.vlan} does not match source VLAN ${path[0].config.vlan}`);
      if (node.type === 'firewall' && node.config.firewall.length && !node.config.firewall.some(r => r.port === 443 || r.port === 80)) problems.push(`${node.name} firewall has no rule for the service port`);
    }
    if (dst.config.dhcp && !path.some(n => n.type === 'router' && n.config.dhcp)) problems.push('no DHCP server reachable for the destination');
    if (!dst.config.dns && !path.some(n => n.config.dns)) problems.push('no DNS resolver configured');
  }
  const latency = path ? path.slice(1).reduce((s, _, i) => s + (net.links.find(l => (l.from === path[i].id && l.to === path[i + 1].id) || (l.to === path[i].id && l.from === path[i + 1].id))?.latencyMs || 99), 0) : 0;
  const loss = path ? path.slice(1).reduce((s, _, i) => s + (net.links.find(l => (l.from === path[i].id && l.to === path[i + 1].id) || (l.to === path[i].id && l.from === path[i + 1].id))?.loss || 0), 0) : 100;
  const result = { ok: true, success: problems.length === 0, path: path?.map(n => `${n.name}(${n.ip})`) || [], latencyMs: latency, lossPct: loss, problems };
  const record = { id: nextId(st, 'test'), networkId: net.id, from: src.name, to: dst.name, world: game.worldMinutes || 0, ...result };
  net.tests.push(record);
  bounded(net.tests, 40);
  addSkill(game, 'networking', result.success ? 6 : 4, `tested route ${src.name} → ${dst.name}`);
  if (result.success) event(st, 'network', `Connectivity verified in ${net.name}`, `${src.name} → ${dst.name} via ${path.map(n => n.name).join(' → ')}`);
  return record;
}

/* ---------------- studios, games and AI ---------------- */
export function createStudio(game, name) {
  const st = ensureIT(game);
  if (st.studios.some(s => s.name === name)) return { ok: false, error: 'A studio with that name already exists.' };
  if (!spend(game, 300, `register studio ${name}`)) return { ok: false, error: 'Registering a studio costs $300.' };
  const studio = { id: nextId(st, 'studio'), name: slugify(name) || 'studio', staff: [], projects: [], funds: 0, reputation: 10, createdWorld: game.worldMinutes || 0 };
  st.studios.push(studio);
  bounded(st.studios, CAPS.studios);
  addSkill(game, 'business', 12, `founded studio ${studio.name}`);
  event(st, 'business', `Studio ${studio.name} founded`, 'A new game development organization entered the market.');
  return { ok: true, studio };
}
export function hireDeveloper(game, studioId, handle, role = 'programmer') {
  const st = ensureIT(game);
  const studio = st.studios.find(s => s.id === studioId || s.name === studioId);
  if (!studio) return { ok: false, error: 'No such studio.' };
  const npc = (game.npcs || []).find(n => n.handle.toLowerCase() === String(handle).toLowerCase().replace(/^@/, ''));
  if (!npc) return { ok: false, error: 'No such developer.' };
  if (studio.staff.some(x => x.handle === npc.handle)) return { ok: false, error: 'Already employed.' };
  const salary = Math.round(20 + npc.skill * 1.2);
  if (!spend(game, salary * 7, `hire ${npc.handle}`)) return { ok: false, error: `A week of salary costs ${money(salary * 7)}.` };
  studio.staff.push({ handle: npc.handle, npcId: npc.id, role, skill: npc.skill, salary });
  addSkill(game, 'business', 8, `hired @${npc.handle}`);
  return { ok: true, studio, staff: studio.staff.at(-1) };
}
export function createGameProject(game, studioId, title, engine = ENGINES[0], genre = 'utility') {
  const st = ensureIT(game);
  const studio = st.studios.find(s => s.id === studioId || s.name === studioId);
  if (!studio) return { ok: false, error: 'No such studio.' };
  if (st.games.length >= CAPS.games) return { ok: false, error: 'Game index is full.' };
  if (!studio.staff.length) return { ok: false, error: 'Hire at least one developer first.' };
  const project = {
    id: nextId(st, 'game'), studioId: studio.id, title: String(title).slice(0, 70), engine, genre,
    scope: rngScope(game), progress: 0, status: 'development', quality: {}, bugs: [], tests: [],
    contentId: null, publishedWorld: null, sales: 0, revenue: 0, createdWorld: game.worldMinutes || 0
  };
  project.quality = { graphics: clamp(35 + studio.staff.reduce((s, x) => s + x.skill, 0) / studio.staff.length / 2, 10, 95), gameplay: 45 + skillBonus(game, 'programming') * 4, stability: 40, originality: irng(game, hash32(title)).int(25, 85) };
  studio.projects.push(project.id);
  st.games.push(project);
  addSkill(game, 'programming', 10, `started game ${project.title}`);
  event(st, 'games', `${project.title} entered development`, `${engine} · ${genre} · ${studio.name}`);
  return { ok: true, project };
}
function rngScope(game) { const rng = irng(game, hash32('scope' + game.tickCount)); return { features: rng.int(4, 12), assets: rng.int(6, 40), levels: rng.int(1, 8) }; }
export function testGame(game, projectId) {
  const st = ensureIT(game);
  const project = st.games.find(g => g.id === projectId || g.title.toLowerCase() === String(projectId).toLowerCase());
  if (!project) return { ok: false, error: 'No such game.' };
  const rng = irng(game, hash32(`${project.id}:test:${project.tests.length}`));
  const bugs = rng.int(0, Math.max(1, Math.round((100 - project.quality.stability) / 12)));
  const result = { id: nextId(st, 'test'), gameId: project.id, world: game.worldMinutes || 0, passed: bugs === 0, bugs, notes: bugs ? `${bugs} defect(s) found in ${project.scope.features} features.` : 'All simulated features passed.' };
  project.tests.push(result);
  bounded(project.tests, 30);
  if (bugs) { project.bugs.push(...Array.from({ length: bugs }, () => ({ title: rng.pick(['collision glitch','save corruption','audio desync','soft-lock on level 2','missing texture']), status: 'open' }))); project.quality.stability = clamp(project.quality.stability - 4, 10, 95); }
  else project.quality.stability = clamp(project.quality.stability + 6, 10, 95);
  addSkill(game, 'programming', bugs ? 4 : 8, `tested ${project.title}`);
  return { ok: true, result };
}
export function publishGame(game, projectId, price = 15) {
  const st = ensureIT(game);
  const project = st.games.find(g => g.id === projectId || g.title.toLowerCase() === String(projectId).toLowerCase());
  if (!project) return { ok: false, error: 'No such game.' };
  if (!project.tests.some(t => t.passed)) return { ok: false, error: 'A game must pass a test before release.' };
  if (project.contentId) return { ok: false, error: 'Already published.' };
  const result = playerPublishContent(game, 'game', project.title, `${project.genre} game built with ${project.engine}. ${project.scope.features} features, ${project.scope.levels} levels.`, Math.max(0, Math.round(price)));
  if (!result.ok) return result;
  project.contentId = result.content.id;
  project.publishedWorld = game.worldMinutes || 0;
  project.status = 'released';
  addSkill(game, 'business', 16, `published ${project.title}`);
  event(st, 'games', `${project.title} released`, `Price ${money(price)} · content ${result.content.id}`);
  return { ok: true, project, content: result.content };
}
export function createAIExperiment(game, name, baseId, dataset = 'local-corpus') {
  const st = ensureIT(game);
  if (st.ai.length >= CAPS.ai) return { ok: false, error: 'AI lab capacity reached.' };
  const base = AI_BASES.includes(baseId) ? baseId : AI_BASES[0];
  const rig = st.rigs.find(r => r.id === st.activeRigId) || st.rigs[0];
  const gpu = rig ? findPart(rig.parts.gpu) : null;
  if (!gpu || gpu.vram < 6) return { ok: false, error: 'A GPU with at least 6 GB VRAM is required.' };
  const cost = 80 + Math.round((gpu.vram || 0) * 4);
  if (!spend(game, cost, `AI experiment ${name}`)) return { ok: false, error: `Compute reservation costs ${money(cost)}.` };
  const model = { id: nextId(st, 'ai'), name: slugify(name) || `model-${st.ai.length + 1}`, base, dataset, gpu: gpu.name, vram: gpu.vram, quality: 30, status: 'queued', benchmarks: [], createdWorld: game.worldMinutes || 0, opId: null };
  const op = startOperation(game, { kind: 'train', label: `train ${model.name}`, work: 60 + gpu.vram * 4, meta: { modelId: model.id } });
  if (!op.ok) return { ok: false, error: op.error };
  model.opId = op.operation.id;
  st.ai.push(model);
  addSkill(game, 'ai', 8, `started training ${model.name}`);
  return { ok: true, model, operation: op.operation };
}
export function benchmarkAI(game, modelId) {
  const st = ensureIT(game);
  const model = st.ai.find(m => m.id === modelId || m.name === modelId);
  if (!model) return { ok: false, error: 'No such model.' };
  if (model.status !== 'ready') return { ok: false, error: 'The model has not finished training.' };
  const rng = irng(game, hash32(model.id + 'bench'));
  const bench = { id: nextId(st, 'test'), world: game.worldMinutes || 0, latencyMs: rng.int(40, 400), quality: clamp(model.quality + rng.int(-4, 5), 1, 99), tokens: rng.int(1000, 100000) };
  model.benchmarks.push(bench);
  bounded(model.benchmarks, 20);
  addSkill(game, 'ai', 5, `benchmarked ${model.name}`);
  return { ok: true, benchmark: bench };
}
export function deployAgent(game, modelId, tools, budget) {
  const st = ensureIT(game);
  const model = st.ai.find(m => m.id === modelId || m.name === modelId);
  if (!model) return { ok: false, error: 'No such model.' };
  if (st.agents.length >= CAPS.agents) return { ok: false, error: 'Agent registry is full.' };
  const agent = {
    id: nextId(st, 'agent'), modelId: model.id, name: `${model.name}-agent`,
    tools: String(tools || 'read,write').split(',').map(s => s.trim()).slice(0, 8),
    permissions: ['read'], memory: [], budget: clamp(Number(budget) || 100, 10, 10000),
    spent: 0, tasks: [], status: 'active', createdWorld: game.worldMinutes || 0
  };
  st.agents.push(agent);
  addSkill(game, 'ai', 10, `deployed agent ${agent.name}`);
  return { ok: true, agent };
}

/* ---------------- support tickets and challenges ---------------- */
function ticketFor(problem) {
  return {
    id: problem.id, kind: problem.kind, title: problem.title, symptom: problem.symptom,
    evidence: problem.evidence, expected: problem.expected, reward: problem.reward,
    deadlineWorld: problem.deadlineWorld || (problem.world || 0) + 7 * DAY,
    status: 'open', createdWorld: problem.world || 0, diagnosis: null
  };
}
function detectProblems(game, st, rng) {
  const out = [];
  for (const srv of (game.servers || []).filter(s => s.owned)) {
    const web = (srv.services || []).find(s => [80,443].includes(s.port));
    if (web && web.state === 'stopped') out.push({ kind:'service', id:`srv-${srv.id}`, title:`Web service stopped on ${srv.host}`, symptom:`${srv.domain} is unavailable to visitors.`, evidence:{ serverId:srv.id, service:web.name }, expected:{ action:'service', state:'start' }, reward:45 });
    if (srv.status === 'offline') out.push({ kind:'host', id:`host-${srv.id}`, title:`${srv.host} is offline`, symptom:'The host stopped answering monitoring checks.', evidence:{ serverId:srv.id }, expected:{ action:'host', state:'online' }, reward:60 });
  }
  const certs = game.internet?.security?.advisories || [];
  for (const site of (game.sites || []).filter(s => s.ownerType === 'player' || s.ownerId === 'player')) {
    const bad = certs.find(a => a.product === site.domain && a.status === 'published');
    if (bad) out.push({ kind:'advisory', id:`adv-${bad.id}`, title:`Advisory affects ${site.domain}`, symptom:`${bad.cve} is still published.`, evidence:{ domain:site.domain, advisory:bad.id }, expected:{ action:'harden', domain:site.domain }, reward:80 });
  }
  const hw = game.interact?.hardware;
  if (hw && (hw.health < 55 || hw.temperature > 82)) out.push({ kind:'hardware', id:'hw-workstation', title:'Workstation needs maintenance', symptom:`Health ${Math.round(hw.health)}/100, temperature ${Math.round(hw.temperature)}°C.`, evidence:{ health:hw.health, temperature:hw.temperature }, expected:{ action:'maintain' }, reward:35 });
  const rig = st.rigs.find(r => r.id === st.activeRigId);
  if (rig && rig.status === 'faulty') out.push({ kind:'rig', id:`rig-${rig.id}`, title:`${rig.name} fails POST`, symptom:rig.faults?.join('; ') || 'Hardware compatibility fault.', evidence:{ rigId:rig.id, faults:rig.faults }, expected:{ action:'repair-rig', rigId:rig.id }, reward:70 });
  for (const net of st.networks) {
    const failed = net.tests.filter(t => !t.success).slice(-1)[0];
    if (failed) out.push({ kind:'network', id:`net-${failed.id}`, title:`Connectivity failure in ${net.name}`, symptom:`${failed.from} → ${failed.to} failed: ${failed.problems[0] || 'unknown'}`, evidence:{ networkId:net.id, testId:failed.id }, expected:{ action:'network', networkId:net.id, testId:failed.id }, reward:55 });
  }
  for (const op of (game.interact?.operations || []).filter(o => o.status === 'failed')) out.push({ kind:'operation', id:`op-${op.id}`, title:`Failed operation: ${op.label}`, symptom:op.logs.at(-1)?.text || 'operation stopped', evidence:{ opId:op.id }, expected:{ action:'retry', opId:op.id }, reward:40 });
  return out.slice(0, 8);
}
export function generateTickets(game) {
  const st = ensureIT(game);
  const rng = irng(game, 0x11c7);
  if (rng.chance(.55)) for (const problem of detectProblems(game, st, rng)) {
    if (st.tickets.some(t => t.id === ticketFor(problem).id && t.status !== 'resolved')) continue;
    st.tickets.push(ticketFor({ ...problem, world: game.worldMinutes || 0 }));
  }
  bounded(st.tickets, CAPS.tickets);
  return st.tickets.filter(t => t.status === 'open');
}
export function diagnoseTicket(game, ticketId) {
  const st = ensureIT(game);
  const ticket = st.tickets.find(t => t.id === ticketId);
  if (!ticket) return { ok: false, error: 'No such ticket.' };
  ticket.diagnosis = { world: game.worldMinutes || 0, evidence: ticket.evidence, note: 'Evidence inspected from live world state.' };
  addSkill(game, 'sysadmin', 3, `diagnosed ${ticket.title}`);
  return { ok: true, ticket };
}
export function resolveTicket(game, ticketId, action, params = {}) {
  const st = ensureIT(game);
  const ticket = st.tickets.find(t => t.id === ticketId);
  if (!ticket) return { ok: false, error: 'No such ticket.' };
  if (ticket.status !== 'open') return { ok: false, error: 'That ticket is already settled.' };
  if (!ticket.diagnosis) return { ok: false, error: 'Diagnose the ticket before applying a fix.' };
  if (action !== ticket.expected.action) return { ok: false, error: `That fix does not address the evidence. Expected discipline: ${ticket.expected.action}.` };
  let verified = false;
  if (action === 'service') {
    const srv = (game.servers || []).find(s => s.id === ticket.evidence.serverId);
    const service = srv?.services?.find(s => s.name === ticket.evidence.service);
    if (srv && service) { service.state = ticket.expected.state; verified = service.state === 'start' || service.state === 'running'; service.state = verified ? 'running' : service.state; for (const site of (game.sites || []).filter(s => s.serverId === srv.id)) site.status = 'live'; }
  } else if (action === 'host') {
    const srv = (game.servers || []).find(s => s.id === ticket.evidence.serverId);
    if (srv) { srv.status = 'online'; verified = true; }
  } else if (action === 'maintain') {
    const hw = game.interact?.hardware;
    if (hw) { hw.health = 100; hw.temperature = 38; verified = true; }
  } else if (action === 'repair-rig') {
    const rig = st.rigs.find(r => r.id === ticket.evidence.rigId);
    if (rig) {
      const parts = { ...rig.parts };
      if (parts.cpu === 'cpu-r9') parts.cpu = 'cpu-r5';
      rig.parts = parts;
      const check = compatibility(rig);
      if (check.ok) { rig.status = 'assembled'; rig.faults = []; verified = true; rig.performance = check.performance; }
    }
  } else if (action === 'network') {
    const result = testNetwork(game, ticket.evidence.networkId, params.from, params.to);
    verified = result.success;
  } else if (action === 'harden') {
    const site = (game.sites || []).find(s => s.domain === ticket.evidence.domain);
    if (site) { const record = game.internet?.web?.records?.[site.id]; if (record) { record.tls.enabled = true; record.tls.version = 'TLS 1.3'; record.securityHeaders = clamp(record.securityHeaders + 18, 0, 100); } verified = true; }
  } else if (action === 'retry') {
    const op = (game.interact?.operations || []).find(o => o.id === ticket.evidence.opId);
    if (op) { op.status = 'running'; op.progress = 0; verified = true; }
  }
  if (!verified) return { ok: false, error: 'The fix was applied but the underlying state did not recover. Investigate again.' };
  ticket.status = 'resolved';
  ticket.resolvedWorld = game.worldMinutes || 0;
  earn(game, ticket.reward, `ticket ${ticket.id}`);
  addSkill(game, 'sysadmin', 8, `resolved ${ticket.title}`);
  addSkill(game, ticket.kind === 'network' ? 'networking' : ticket.kind === 'hardware' || ticket.kind === 'rig' ? 'hardware' : 'security', 6, ticket.title);
  event(st, 'support', `Resolved: ${ticket.title}`, `Reward ${money(ticket.reward)}.`, 'good');
  return { ok: true, ticket, reward: ticket.reward };
}

function defineChallenge(game, st, rng) {
  const kind = rng.pick(['rig','network','content','game','cert','research','support','ai']);
  const skill = { rig:'hardware', network:'networking', content:'programming', game:'programming', cert:'sysadmin', research:'research', support:'sysadmin', ai:'ai' }[kind];
  const level = skillLevel(st.skills[skill]?.xp || 0);
  const challenge = {
    id: nextId(st, 'challenge'), kind, title: '', requirement: {}, reward: { money: rng.int(60, 260), xp: rng.int(10, 26) },
    status: 'open', createdWorld: game.worldMinutes || 0, expiresWorld: (game.worldMinutes || 0) + 10 * DAY, attempts: 0
  };
  if (kind === 'rig') { challenge.title = `Assemble a rig scoring ${40 + level * 6}`; challenge.requirement = { score: 40 + level * 6 }; }
  else if (kind === 'network') { challenge.title = 'Build and verify a routed network with DHCP and DNS'; challenge.requirement = { nodes: 4, successfulTest: true }; }
  else if (kind === 'content') { challenge.title = 'Publish a tested guide with at least one review'; challenge.requirement = { contentType:'guide', reviews:1 }; }
  else if (kind === 'game') { challenge.title = 'Release a game that passes testing'; challenge.requirement = { publishedGame:true }; }
  else if (kind === 'cert') { challenge.title = 'Earn a professional certification'; challenge.requirement = { certs:1 }; }
  else if (kind === 'research') { challenge.title = 'Complete a cloud deployment'; challenge.requirement = { deployments:1 }; }
  else if (kind === 'support') { challenge.title = 'Resolve two support tickets'; challenge.requirement = { tickets:2 }; }
  else { challenge.title = 'Train and benchmark a local model'; challenge.requirement = { benchmark:1 }; }
  return challenge;
}
export function generateChallenges(game) {
  const st = ensureIT(game);
  const rng = irng(game, 0xc4a1);
  if (rng.chance(.5) && st.challenges.filter(c => c.status === 'open').length < 6) st.challenges.push(defineChallenge(game, st, rng));
  bounded(st.challenges, CAPS.challenges);
  return st.challenges.filter(c => c.status === 'open');
}
export function attemptChallenge(game, challengeId) {
  const st = ensureIT(game);
  const challenge = st.challenges.find(c => c.id === challengeId);
  if (!challenge) return { ok: false, error: 'No such challenge.' };
  if (challenge.status !== 'open') return { ok: false, error: 'That challenge is closed.' };
  challenge.attempts++;
  const r = challenge.requirement;
  let done = false;
  if (r.score) done = st.rigs.some(x => x.performance >= r.score);
  else if (r.nodes) done = st.networks.some(n => n.nodes.length >= r.nodes && n.tests.some(t => t.success));
  else if (r.contentType) done = (game.society?.content || []).some(c => c.type === r.contentType && c.usage.reviews >= r.reviews);
  else if (r.publishedGame) done = st.games.some(g => g.status === 'released');
  else if (r.certs) done = st.certs.length >= r.certs;
  else if (r.deployments) done = (game.internet?.deployments?.length || 0) >= r.deployments;
  else if (r.tickets) done = st.tickets.filter(t => t.status === 'resolved').length >= r.tickets;
  else if (r.benchmark) done = st.ai.some(m => m.benchmarks.length >= r.benchmark);
  if (!done) return { ok: false, error: 'The requirement is not satisfied yet. Perform the activity in the shared world.' };
  challenge.status = 'complete';
  challenge.completedWorld = game.worldMinutes || 0;
  earn(game, challenge.reward.money, `challenge ${challenge.id}`);
  const skill = { rig:'hardware', network:'networking', content:'programming', game:'programming', cert:'sysadmin', research:'cloud', support:'sysadmin', ai:'ai' }[challenge.kind];
  addSkill(game, skill, challenge.reward.xp, `challenge ${challenge.title}`);
  event(st, 'challenge', `Completed: ${challenge.title}`, `Reward ${money(challenge.reward.money)} and ${challenge.reward.xp} XP.`, 'good');
  return { ok: true, challenge };
}

/* ---------------- collecting ---------------- */
export function marketplace(game) {
  const st = ensureIT(game);
  return st.collectibles.map(c => ({ ...c, price: Math.round(c.base * (c.condition / 100) * (1 + c.demand / 200)) }));
}
export function buyCollectible(game, collectibleId) {
  const st = ensureIT(game);
  const item = st.collectibles.find(c => c.id === collectibleId || c.name.toLowerCase() === String(collectibleId).toLowerCase());
  if (!item) return { ok: false, error: 'No such collectible.' };
  if (item.owned) return { ok: false, error: 'Already owned.' };
  const price = Math.round(item.base * (item.condition / 100) * (1 + item.demand / 200));
  if (!spend(game, price, `collectible ${item.name}`)) return { ok: false, error: `Costs ${money(price)}.` };
  item.owned = true;
  item.acquiredWorld = game.worldMinutes || 0;
  st.inventory.push({ id: item.id, name: item.name, kind: item.kind });
  addSkill(game, 'research', 4, `acquired ${item.name}`);
  return { ok: true, item, price };
}
export function sellCollectible(game, collectibleId) {
  const st = ensureIT(game);
  const item = st.collectibles.find(c => c.id === collectibleId || c.name.toLowerCase() === String(collectibleId).toLowerCase());
  if (!item || !item.owned) return { ok: false, error: 'You do not own that item.' };
  const price = Math.round(item.base * (item.condition / 100) * (.6 + item.demand / 300));
  item.owned = false;
  st.inventory = st.inventory.filter(i => i.id !== item.id);
  earn(game, price, `sold ${item.name}`);
  return { ok: true, item, price };
}

/* ---------------- tick ---------------- */
function bucket(st, key, interval, world, max = 6) {
  const n = Math.floor(world / interval), prev = st.cadence[key] || 0;
  if (n <= prev) return 0;
  st.cadence[key] = prev + Math.min(max, n - prev);
  return Math.min(max, n - prev);
}
export function tickIT(game, minutes = 1, rng = null) {
  const st = ensureIT(game);
  rng = rng || irng(game, 0x11);
  st.worldMinutes = game.worldMinutes || 0;
  const events = [];
  for (let i = 0; i < bucket(st, 'support', 480, st.worldMinutes, 6); i++) {
    generateTickets(game);
    generateChallenges(game);
  }
  // AI training completions use the shared operation ledger.
  for (const op of (game.interact?.operations || [])) {
    if (op.status !== 'done' || op.delivered !== true || op.kind !== 'train') continue;
    const model = st.ai.find(m => m.opId === op.id && m.status === 'queued');
    if (!model) continue;
    model.status = 'ready';
    model.quality = clamp(35 + Math.round(model.vram * .8) + rng.int(-4, 8), 20, 95);
    events.push({ type: 'feed', text: `AI model ${model.name} finished training (quality ${model.quality}).`, kind: 'good' });
    event(st, 'ai', `${model.name} trained`, `Quality ${model.quality}/100 on ${model.gpu}.`);
  }
  // NPC studios advance game projects according to actual staff skill.
  for (let i = 0; i < bucket(st, 'studios', 1440, st.worldMinutes, 3); i++) {
    for (const studio of st.studios) {
      const skill = studio.staff.reduce((s, x) => s + x.skill, 0) / Math.max(1, studio.staff.length);
      for (const gid of studio.projects) {
        const project = st.games.find(g => g.id === gid);
        if (!project || project.status !== 'development') continue;
        project.progress = clamp(project.progress + rng.float(3, 12) * skill / 60, 0, 100);
        if (project.progress >= 100) {
          const test = testGame(game, project.id);
          if (test.result.passed) {
            const published = publishGame(game, project.id, Math.max(5, Math.round(project.quality.graphics / 3)));
            if (published.ok) events.push({ type: 'feed', text: `${project.title} was released by ${studio.name}.`, kind: 'info' });
          }
        }
      }
      // Salaries are real expenses drawn from studio funds, seeded by the founder.
      studio.funds += Math.round(rng.float(10, 60));
    }
  }
  // Collectible demand moves with world activity, not arbitrary randomness.
  for (const item of st.collectibles) {
    const interest = (game.society?.content || []).filter(c => c.tags.includes(item.kind)).length;
    item.demand = clamp(item.demand + Math.sign(interest - 2) * rng.int(0, 2), 0, 200);
  }
  for (const rig of st.rigs) {
    if (rig.status === 'faulty' || rig.temperature < 60) continue;
    rig.temperature = clamp(rig.temperature + rng.float(-1.5, 1), 25, 110);
  }
  recomputeITMetrics(game, st);
  bounded(st.tickets, CAPS.tickets);
  bounded(st.challenges, CAPS.challenges);
  return events;
}

export function recomputeITMetrics(game, st = ensureIT(game)) {
  st.metrics = {
    rigs: st.rigs.length, activeRig: st.activeRigId, circuits: st.circuits.length,
    networks: st.networks.length, studios: st.studios.length, games: st.games.length,
    aiModels: st.ai.length, agents: st.agents.length,
    openTickets: st.tickets.filter(t => t.status === 'open').length,
    resolvedTickets: st.tickets.filter(t => t.status === 'resolved').length,
    openChallenges: st.challenges.filter(c => c.status === 'open').length,
    certifications: st.certs.length, collectibles: st.collectibles.filter(c => c.owned).length,
    skills: Object.fromEntries(SKILLS.map(k => [k, skillLevel(st.skills[k]?.xp || 0)]))
  };
  return st.metrics;
}

export function itOverview(game) {
  const st = ensureIT(game);
  return { st, metrics: recomputeITMetrics(game, st), rigs: st.rigs, networks: st.networks, studios: st.studios, games: st.games, ai: st.ai, tickets: st.tickets.slice().reverse(), challenges: st.challenges.filter(c => c.status === 'open'), skills: skillOverview(game), marketplace: marketplace(game), events: st.events.slice().reverse() };
}
