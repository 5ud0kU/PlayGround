/* Terminal shell: parsing, pipes, virtual filesystem, networking and tools. */
import { fmtMoney, fmtNum, fmtBytes, fmtDate, fmtTime, fmtDateTime, fmtDuration, esc, pad, padLeft, table, sleep, clamp, progressBar, lineWrap, titleCase } from './util.js';
import {
  HOME, resolvePath, getNode, listDir, readFile, writeFile, ensureDir, removeNode, moveNode,
  copyNode, exists, isDir, basename, dirname, joinPath, normalize, allFiles, findFiles, treeLines,
  sizeOf, modeString, diskUsage, newDir, newFile
} from './vfs.js';
import {
  getServer, getSite, getNpc, getCompany, getContract, getPlayerSkill, skillTitle, playerTitle,
  addFeed, addMoney, awardReputation, addHeat, investigate, checkAchievements, acceptContract,
  submitContract, objectiveSatisfied, buyShopItem, registerDomain, deploySite, auditServer,
  patchServer, exploitServer, sendPlayerMail, addMail, ownedServers, playerSites, onlineCount,
  marketIndex, netWorth, worldClock, threatInfo, unreadMail,
  contractStatusClass, mailPartners, sitesForServer, generateContract, addNews, updateDerived
} from './world.js';
import {
  findProvider, findPlan, cloudPrice, cloudLaunchItem, attachCloudInstance, findCloudInstance,
  removeCloudInstance, playerCloudServers, imageInfo, findContainer, runContainer, stopContainer,
  startContainer, removeContainer, containerLogs, createCluster, findCluster, applyWorkload,
  scaleWorkload, clusterPods, agentModel, agentRole, findAgent, deployAgent, setAgentStatus,
  assignAgent, agentDailyRevenue, agentDailyCost, playerCompany, registerCompany, launchProduct,
  companyValuation
} from './systems.js';
import {
  SHOP_ITEMS, ACHIEVEMENTS, CLOUD_PROVIDERS, CLOUD_PLANS, CONTAINER_IMAGES, AGENT_MODELS,
  AGENT_ROLES, PRODUCT_TEMPLATES
} from './data.js';
import {
  civilizationSummary, civHistory, civEventList, educationFields, researchFields, lawDomains,
  playerStudy, playerStartResearch, playerFundResearch, playerPublish, playerBuyProperty,
  playerSellProperty, playerInsureProperty, playerRelease, playerLobby, playerRelocate, playerAdoptTech, playerProperties,
  playerCredentials, playerCompliance, getCivCountry, getCivCity, playerCountry, playerCity,
  outletFor, researchField, civKnowledge, validateLedger, sharedSnapshot, joinSharedWorld,
  disconnectSharedPlayer, applyRemoteAction, activeLegalDisputes, playerLegalAction, careerSnapshot, jobMatch, playerApplyJob,
  playerInterviewJob, playerNegotiateJob, playerAcceptJob, playerDeclineJob, playerQuitJob
} from './civilization.js';

const CMD_ALIASES = {
  ll: 'ls -la', la: 'ls -a', l: 'ls', ports: 'ss -tulnp', dir: 'ls',
  cls: 'clear', logout: 'exit', quit: 'exit', h: 'history', '?': 'help',
  inbox: 'mail', jobs: 'contracts', gigs: 'contracts', board: 'contracts',
  shop: 'market', store: 'market', topology: 'map', netmap: 'map',
  whoami: 'whoami', sysinfo: 'neofetch', fetch: 'neofetch'
};

const COMMANDS = {};

function hhmm(minutes) {
  const m = ((Math.floor(Number(minutes) || 0) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function rootOf(term) { return term.remote ? term.remote.server.fs : term.remoteRoot || null; }
function getFS(term) { return term.remote ? term.remote.server.fs : term.localFS; }
function homeOf(term) { return term.remote ? term.remote.home : HOME; }
function userOf(term) { return term.remote ? term.remote.user : (term.user || 'operator'); }
function hostOf(term) { return term.remote ? term.remote.server.host : (term.host || 'voidbox'); }
function isRoot(term, ctx) { return userOf(term) === 'root' || !!ctx?.sudo; }

function makeCtx(app, term, cmd, args, raw, input = '') {
  const ctx = {
    app, term, game: app.game, cmd, args, raw, input, sudo: false, piped: false,
    out: [], code: 0, stop: false,
    print(text = '', cls = '') { this.out.push({ text: String(text), cls }); },
    raw(text) { this.out.push({ text: String(text), cls: '' }); },
    err(text) { this.out.push({ text: String(text), cls: 'err' }); this.code = 1; },
    ok(text) { this.out.push({ text: String(text), cls: 'ok' }); },
    warn(text) { this.out.push({ text: String(text), cls: 'warn' }); },
    dim(text) { this.out.push({ text: String(text), cls: 'dim' }); },
    head(text) { this.out.push({ text: String(text), cls: 'head' }); },
    info(text) { this.out.push({ text: String(text), cls: 'info' }); },
    accent(text) { this.out.push({ text: String(text), cls: 'accent' }); },
    text() { return this.out.map(o => o.text).join('\n'); },
    fs() { return getFS(this.term); },
    home() { return homeOf(this.term); },
    user() { return userOf(this.term); },
    host() { return hostOf(this.term); },
    resolve(p) { return resolvePath(this.term.cwd, p, homeOf(this.term)); }
  };
  return ctx;
}

/* ---------------- line parsing ---------------- */
export function splitTop(line, sep = ';') {
  const parts = [];
  let cur = '', quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { cur += c; if (c === quote && line[i - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === sep) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}
export function splitPipeline(line) {
  const parts = [];
  let cur = '', quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { cur += c; if (c === quote && line[i - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '|') { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}
export function tokenize(line) {
  const out = [];
  let cur = '', quote = null, has = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) { quote = null; continue; }
      if (c === '\\' && quote === '"' && i + 1 < line.length) { cur += line[++i]; continue; }
      cur += c; has = true; continue;
    }
    if (c === '"' || c === "'") { quote = c; has = true; continue; }
    if (c === '\\' && i + 1 < line.length) { cur += line[++i]; has = true; continue; }
    if (/\s/.test(c)) { if (has) { out.push(cur); cur = ''; has = false; } continue; }
    cur += c; has = true;
  }
  if (has) out.push(cur);
  return out;
}
function expandEnv(term, text) {
  const vars = { HOME: homeOf(term), USER: userOf(term), HOSTNAME: hostOf(term), PWD: term.cwd, SHELL: '/bin/bash', ...(term.env || {}) };
  return text.replace(/\$\{([A-Z_][A-Z0-9_]*)\}|\$([A-Z_][A-Z0-9_]*)/g, (m, a, b) => {
    const k = a || b;
    return vars[k] ?? '';
  });
}
function parseRedirect(line) {
  let quote = null, cut = -1, mode = '>';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { if (c === quote && line[i - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '>') {
      cut = i;
      mode = line[i + 1] === '>' ? '>>' : '>';
      break;
    }
  }
  if (cut < 0) return { line: line.trim(), mode: null, file: null };
  const cmd = line.slice(0, cut).trim();
  let file = line.slice(cut + (mode === '>>' ? 2 : 1)).trim();
  const m = file.match(/^([^\s]+)/);
  file = m ? m[1] : '';
  return { line: cmd, mode, file };
}

export function splitControl(line) {
  const parts = [];
  let cur = '', quote = null, depth = 0, op = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { cur += c; if (c === quote && line[i - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    if (c === ')' || c === ']' || c === '}') depth--;
    if (depth === 0 && c === '&' && line[i + 1] === '&') { parts.push({ op, text: cur.trim() }); cur = ''; op = '&&'; i++; continue; }
    if (depth === 0 && c === '|' && line[i + 1] === '|') { parts.push({ op, text: cur.trim() }); cur = ''; op = '||'; i++; continue; }
    if (depth === 0 && c === ';') { parts.push({ op, text: cur.trim() }); cur = ''; op = ';'; continue; }
    cur += c;
  }
  parts.push({ op, text: cur.trim() });
  return parts;
}

export async function execute(app, term, rawLine) {
  const game = app.game;
  const line = expandEnv(term, String(rawLine || '').trim());
  if (!line) return;
  if (term.history[term.history.length - 1] !== line) term.history.push(line);
  term.histIndex = term.history.length;

  if (term.pending) return handlePending(app, term, line);

  const aliased = CMD_ALIASES[line] ? CMD_ALIASES[line] : line;
  const controls = splitControl(aliased);
  let lastCode = 0;
  for (const control of controls) {
    const statement = control.text;
    if (!statement) continue;
    if (control.op === '&&' && lastCode !== 0) continue;
    if (control.op === '||' && lastCode === 0) continue;
    if (statement.startsWith('#')) continue;
    const redir = parseRedirect(statement);
    const segments = splitPipeline(redir.line);
    let input = '';
    let lastCtx = null;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i].trim();
      if (!seg) continue;
      const tokens = tokenize(seg);
      if (!tokens.length) continue;
      let sudo = false;
      if (tokens[0] === 'sudo') { sudo = true; tokens.shift(); }
      if (!tokens.length) { term.print('usage: sudo command', 'err'); continue; }
      const cmd = tokens[0];
      const args = tokens.slice(1);
      const ctx = makeCtx(app, term, cmd, args, seg, input);
      ctx.sudo = sudo;
      ctx.piped = segments.length > 1;
      lastCtx = ctx;
      const handler = resolveCommand(ctx, cmd);
      if (!handler) {
        ctx.out.push({ text: `bash: ${cmd}: command not found`, cls: 'err' });
        ctx.code = 127;
      } else {
        try {
          const result = await handler(ctx);
          if (result === false) ctx.code = ctx.code || 1;
        } catch (e) {
          console.error(e);
          ctx.out.push({ text: `bash: ${cmd}: internal simulation error: ${e.message}`, cls: 'err' });
          ctx.code = 1;
        }
      }
      input = ctx.text();
      if (ctx.stop) break;
      if (i < segments.length - 1) continue;
    }
    if (!lastCtx) continue;
    if (redir.mode && redir.file) {
      const path = resolvePath(term.cwd, redir.file, homeOf(term));
      if (redir.mode === '>>') {
        const old = readFile(getFS(term), path);
        writeFile(getFS(term), path, (old ?? '') + input + (input.endsWith('\n') ? '' : '\n'), { owner: userOf(term) });
      } else {
        writeFile(getFS(term), path, input + (input.endsWith('\n') ? '' : '\n'), { owner: userOf(term) });
      }
      if (lastCtx.code !== 0) term.print(`bash: ${redir.file}: command failed`, 'err');
    } else {
      for (const o of lastCtx.out) term.print(o.text, o.cls);
    }
    lastCode = lastCtx.code || 0;
    if (lastCtx.stop) return;
  }
  if (typeof app.afterCommand === 'function') app.afterCommand(term);
}

function resolveCommand(ctx, cmd) {
  if (COMMANDS[cmd]) return COMMANDS[cmd];
  if (cmd.startsWith('./') || cmd.startsWith('/') || cmd.startsWith('~/')) return runFileCommand;
  return null;
}

function handlePending(app, term, input) {
  const p = term.pending;
  if (!p) return;
  if (p.kind === 'ssh-password') {
    const server = app.game.servers.find(s => s.id === p.serverId);
    if (!server) { term.pending = null; term.print('Connection closed.', 'err'); return; }
    const known = server.users.find(u => u.user === p.user);
    const ok = (known && known.pass === input) || server.compromised;
    if (ok) {
      term.pending = null;
      attachRemote(app, term, server, p.user, server.compromised ? 'compromised session' : 'password');
    } else {
      p.attempts++;
      if (p.attempts >= 3) {
        term.pending = null;
        term.print(`Permission denied (publickey,password).`, 'err');
        term.print(`Received disconnect from ${server.ip} port 22:2: Too many authentication failures`, 'dim');
      } else {
        term.print('Permission denied, please try again.', 'err');
        term.print(`password:`, 'dim');
      }
    }
    return;
  }
  if (p.kind === 'confirm-reset') {
    term.pending = null;
    if (/^y(es)?$/i.test(input)) {
      term.print('Resetting persistent world...', 'warn');
      app.resetWorld();
    } else {
      term.print('Reset cancelled.', 'dim');
    }
    return;
  }
  term.pending = null;
}

/* ---------------- filesystem helpers ---------------- */
function pathFor(term, p) { return resolvePath(term.cwd, p, homeOf(term)); }
function checkInstalled(ctx, name, pkg = name) {
  if (ctx.game.installed.includes(name)) return true;
  ctx.err(`bash: ${name}: command not found`);
  ctx.dim(`Install it with: sudo apt install ${pkg}`);
  return false;
}
function fsError(ctx, cmd, path, error) {
  ctx.err(`${cmd}: ${path}: ${error}`);
}
function listingLong(ctx, abs, entries, showAll) {
  const fs = ctx.fs();
  const node = getNode(fs, abs);
  const lines = [];
  const total = entries.reduce((s, e) => s + Math.ceil(sizeOf(e.node) / 1024), 0);
  lines.push(`total ${Math.max(1, Math.ceil(total / 4))}`);
  for (const e of entries) {
    const mode = modeString(e.node);
    const size = e.isDir ? 4096 : sizeOf(e.node);
    const date = new Date(e.node.mtime || Date.now());
    const ds = `${date.toLocaleString('en-US', { month: 'short', day: '2-digit' })} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    lines.push(`${mode} 1 ${pad(e.node.owner || 'operator', 8)} ${pad(e.node.owner || 'operator', 8)} ${padLeft(size, 7)} ${ds} ${e.name}${e.isDir ? '/' : ''}`);
  }
  ctx.print(lines.join('\n'), '');
}
function columnize(names, width = 82) {
  const max = Math.max(...names.map(n => n.length), 1) + 3;
  const cols = Math.max(1, Math.floor(width / max));
  const rows = [];
  for (let i = 0; i < names.length; i += cols) rows.push(names.slice(i, i + cols).map(n => pad(n, max)).join('').trimEnd());
  return rows.join('\n');
}

/* ---------------- core commands ---------------- */
COMMANDS.help = (ctx) => {
  if (ctx.args[0]) return manPage(ctx, ctx.args[0]);
  ctx.head('PERSISTENT WORLD SHELL — command index');
  ctx.dim('A fictional network. Real parsing. Every command acts on simulated state.');
  const groups = [
    ['NAVIGATION', 'pwd  cd  ls  tree  find  file  stat  du  df'],
    ['FILES', 'cat  head  tail  less  grep  wc  mkdir  touch  rm  cp  mv  chmod  nano  vim  code'],
    ['SYSTEM', 'whoami  id  hostname  uname  date  uptime  ps  top  kill  free  systemctl  sudo  su'],
    ['PACKAGES', 'apt update  apt install <pkg>  apt list --installed'],
    ['NETWORK', 'ip  ifconfig  ping  traceroute  dig  whois  curl  wget  ssh  scp  nc  netstat  ss'],
    ['SECURITY', 'nmap  vulnscan  audit  exploit  patch  hydra  heat  legal'],
    ['DEVELOP', 'python3  bash  gcc  make  git  sqlite3  node  docker  kubectl'],
    ['CLOUD', 'cloud  docker  kubectl'],
    ['AI', 'agent  agent models  agent deploy  company'],
    ['ECONOMY', 'bank  contracts  accept  submit  market  buy  deploy  domains  site  servers  company'],
    ['SOCIAL', 'mail  send  read  forum  thread  post  news  profile  search  whois'],
    ['CIVILIZATION', 'civ  country  study  research  publish  civ laws  civ legal  civ identity  civ property  civ tech  civ supply  civ history  civ events  civ mp'],
    ['WORLD', 'map  status  world  achievements  save  reset  neofetch  history  clear'],
  ];
  for (const [g, cmds] of groups) {
    ctx.print('');
    ctx.print(g, 'head');
    ctx.print('  ' + cmds, 'accent');
  }
  ctx.print('');
  ctx.dim('Tip: pipes work.  nmap -sV 192.0.2.13 | grep open');
  ctx.dim('Tip: Tab completes commands and paths. Up/Down recalls history.');
  ctx.dim('Everything and everyone in this simulation is fictional.');
};
function manPage(ctx, name) {
  const pages = {
    nmap: ['nmap — network mapper', 'nmap [-sV] [-p ports] <host>', 'Enumerates open services on a simulated host. Results are stored in your scan history.'],
    ssh: ['ssh — remote login', 'ssh <user>@<host>', 'Opens a shell on a simulated host. You need credentials or an exploited session.'],
    audit: ['audit — formal security audit', 'audit <host>', 'Documents every unpatched finding on a host. Required by audit contracts.'],
    exploit: ['exploit — use a discovered vulnerability', 'exploit <host> [CVE]', 'Attempts access through a known finding. Generates trace exposure.'],
    patch: ['patch — remediate findings', 'patch <host>', 'Closes known vulnerabilities and raises host security.'],
    deploy: ['deploy — publish a site', 'deploy <dir> <domain>', 'Publishes files from a local directory on a server you own.'],
    contracts: ['contracts — work board', 'contracts [open|active|all]', 'Lists contracts. Accept with accept <id>, deliver with submit <id>.'],
    mail: ['mail — inbox', 'mail | mail read <id> | mail send <handle> <subject> <body>', 'Mail is persistent. NPCs reply when the world advances.'],
    git: ['git — version control', 'git init|status|add|commit -m|log|clone <url>', 'Repositories live inside the virtual filesystem.'],
    python3: ['python3 — simulated runtime', 'python3 <file.py> | python3 -c "code"', 'A small Python subset: print, variables, arithmetic, for/range, if.'],
    gcc: ['gcc — C compiler', 'gcc <file.c> -o <binary>', 'Compiles a C source file into a runnable simulated binary.'],
    printf: ['printf — formatted output', "printf 'line one\\nline two\\n' > file.txt", 'Interprets \\n, \\t and %s placeholders. Useful for writing manifests and small config files.'],
    cloud: ['cloud — provision infrastructure', 'cloud providers | plans [provider] | launch <plan> [provider] [region] | instances | destroy <id>', 'Rents cloud instances with real monthly costs. Instances become owned servers you can SSH into.'],
    docker: ['docker — containers', 'docker ps [-a] | images | pull <image> | run -d <image> | stop <id> | start <id> | rm <id> | logs <id> | build -t <tag>', 'Runs containers on servers you own. Container state persists and consumes host memory.'],
    kubectl: ['kubectl — orchestration', 'kubectl create cluster <name> [node...] | get pods|nodes|deploy | apply -f <manifest> | scale deployment/<name> --replicas N', 'A small Kubernetes-style control plane over your own nodes. Manifests are read from the virtual filesystem.'],
    agent: ['agent — autonomous AI agents', 'agent list [--all] | models | roles | deploy <name> --role <role> --model <model> | inspect <name> | start|stop|pause <name> | assign <name> <domain>', 'Agents perform bounded work on your infrastructure. They cost money, remember what they did, and pause when something looks wrong.'],
    company: ['company — organizations', 'company list | inspect <name> | register <name> | launch <product> | products | mine', 'Register and operate your own technology company. Products generate recurring revenue based on subscribers and reputation.'],
    civ: ['civ — civilization interface', 'civ [status|countries|country <q>|cities|laws|legal|identity|study|research|media|tech|supply|property|society|diplomacy|release|history|events|mp|relocate|lobby]', 'Inspect and act on the persistent civilization: governments, regulation, education, research, media, infrastructure, property, supply chains, technology, culture, identity and shared-world authority. The simulation runs whether or not you participate.'],
  };
  const p = pages[name];
  if (!p) { ctx.print(`No manual entry for ${name}`, 'err'); ctx.dim('Try: help'); return; }
  ctx.head(p[0]); ctx.print(''); ctx.print('SYNOPSIS', 'dim'); ctx.print('  ' + p[1], 'info');
  ctx.print(''); ctx.print('DESCRIPTION', 'dim'); ctx.print('  ' + p[2]);
}

COMMANDS.clear = (ctx) => { ctx.term.clear(); ctx.stop = true; };
COMMANDS.pwd = (ctx) => ctx.print(ctx.term.cwd);
COMMANDS.whoami = (ctx) => ctx.print(userOf(ctx.term));
COMMANDS.id = (ctx) => {
  const u = userOf(ctx.term);
  ctx.print(u === 'root' ? 'uid=0(root) gid=0(root) groups=0(root)' : `uid=1000(${u}) gid=1000(${u}) groups=1000(${u}),27(sudo)`);
};
COMMANDS.hostname = (ctx) => ctx.print(hostOf(ctx.term));
COMMANDS.uname = (ctx) => {
  if (ctx.args.includes('-a')) {
    if (ctx.term.remote) ctx.print(`Linux ${hostOf(ctx.term)} ${ctx.term.remote.server.kernel} #1 SMP PREEMPT_DYNAMIC ${ctx.term.remote.server.os} x86_64 GNU/Linux`);
    else ctx.print('Linux voidbox 6.8.11-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.8.11-1 (2026-10-14) x86_64 GNU/Linux');
  } else if (ctx.args.includes('-r')) ctx.print(ctx.term.remote ? ctx.term.remote.server.kernel : '6.8.11-amd64');
  else ctx.print('Linux');
};
COMMANDS.date = (ctx) => {
  const c = worldClock(ctx.game);
  ctx.print(`${c.date.toDateString()} ${c.hh}:${c.mm}:${String((ctx.game.tickCount * 7) % 60).padStart(2, '0')} UTC`);
  ctx.dim(`world cycle ${c.cycle} · ${Math.floor(ctx.game.worldMinutes)} simulated minutes`);
};
COMMANDS.uptime = (ctx) => {
  if (ctx.term.remote) {
    const s = ctx.term.remote.server;
    ctx.print(` ${cTime()} up ${Math.floor(s.uptimePct)} days, load average: 0.12, 0.18, 0.22`);
  } else {
    ctx.print(` ${cTime()} up 3 days, 4:12, 1 user, load average: 0.42, 0.37, 0.31`);
  }
};
function cTime() { return new Date().toTimeString().slice(0, 8); }
COMMANDS.echo = (ctx) => {
  let args = ctx.args.slice();
  let newline = true;
  if (args[0] === '-n') { newline = false; args = args.slice(1); }
  ctx.print(args.join(' ') + (newline ? '' : ''), '');
  if (!newline) { /* terminal renderer already adds a line */ }
};
COMMANDS.printf = (ctx) => {
  let args = ctx.args.slice();
  if (!args.length) { ctx.err('usage: printf <format> [arguments]'); return; }
  let fmt = args.shift();
  let ai = 0;
  fmt = fmt.replace(/%s/g, () => args[ai++] ?? '');
  const out = fmt
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');
  ctx.print(out);
};
COMMANDS.env = (ctx) => {
  const vars = { HOME: homeOf(ctx.term), USER: userOf(ctx.term), HOSTNAME: hostOf(ctx.term), PWD: ctx.term.cwd, SHELL: '/bin/bash', TERM: 'xterm-256color', EDITOR: 'nano', LANG: 'en_US.UTF-8', ...(ctx.term.env || {}) };
  for (const [k, v] of Object.entries(vars)) ctx.print(`${k}=${v}`, 'dim');
};
COMMANDS.export = (ctx) => {
  const a = ctx.args[0] || '';
  const eq = a.indexOf('=');
  if (eq < 0) { ctx.err('usage: export NAME=value'); return; }
  ctx.term.env = ctx.term.env || {};
  ctx.term.env[a.slice(0, eq)] = a.slice(eq + 1);
  ctx.dim(`exported ${a.slice(0, eq)}`);
};
COMMANDS.history = (ctx) => {
  ctx.term.history.forEach((h, i) => ctx.print(`${padLeft(i + 1, 4)}  ${h}`, 'dim'));
};
COMMANDS.sleep = async (ctx) => {
  const n = Number(ctx.args[0]) || 0;
  await sleep(Math.min(5000, n * 1000));
};
COMMANDS.exit = (ctx) => {
  if (ctx.term.remote) {
    ctx.print(`logout`, 'dim');
    ctx.print(`Connection to ${ctx.term.remote.server.ip} closed.`, 'dim');
    ctx.term.remote = null;
    ctx.term.cwd = HOME;
    ctx.term.user = 'operator';
    ctx.term.host = 'voidbox';
  } else {
    ctx.print('There is no logout from the network.', 'dim');
    ctx.print('Close the terminal window or open a new session.', 'dim');
  }
};
COMMANDS.sudo = (ctx) => {
  if (ctx.args[0] === 'su') {
    ctx.term.user = 'root';
    ctx.print('root@' + hostOf(ctx.term) + ':# ', 'dim');
    ctx.print('You are root in this session. Be careful what you persist.', 'warn');
    return;
  }
  ctx.print('usage: sudo <command>', 'dim');
};
COMMANDS.su = (ctx) => {
  ctx.term.user = 'root';
  ctx.print('root session active. This is a simulation; consequences are still modeled.', 'warn');
};
COMMANDS.which = (ctx) => {
  const cmd = ctx.args[0];
  if (!cmd) return;
  if (COMMANDS[cmd]) ctx.print(`/usr/bin/${cmd}`);
  else ctx.err(`which: no ${cmd} in (/usr/local/bin:/usr/bin:/bin)`);
};
COMMANDS.man = (ctx) => manPage(ctx, ctx.args[0] || 'help');
COMMANDS.neofetch = (ctx) => {
  const g = ctx.game;
  const c = worldClock(g);
  const owned = ownedServers(g).length;
  const art = [
    '        .--.        ',
    '       |o_o |       ',
    '       |:_/ |       ',
    '      //   \\ \\      ',
    '     (|     | )     ',
    "    /'\\_   _/`\\    ",
    '    \\___)=(___/    '
  ];
  const info = [
    `${userOf(ctx.term)}@${hostOf(ctx.term)}`,
    '─────────────────────────────',
    `OS:       Parrot Security 6.2 (lorikeet)`,
    `Kernel:   6.8.11-amd64`,
    `Uptime:   3 days, 4 hours`,
    `Shell:    bash 5.2.15`,
    `Terminal: xterm-256color`,
    `CPU:      AMD Ryzen 5 5600 (6) @ 3.7GHz`,
    `Memory:   11.2GiB / 15.6GiB`,
    `Disk:     218G / 512G (43%)`,
    `Network:  10.0.0.42/24`,
    `World:    cycle ${c.cycle} · ${c.hh}:${c.mm}`,
    `Operator: rep ${g.player.reputation} · skill ${getPlayerSkill(g)} · heat ${Math.round(g.player.heat)}%`,
    `Assets:   ${owned} node(s) · ${playerSites(g).length} site(s)`
  ];
  const rows = Math.max(art.length, info.length);
  const lines = [];
  for (let i = 0; i < rows; i++) lines.push(pad(art[i] || '', 22) + (info[i] || ''));
  ctx.print(lines.join('\n'), 'accent');
};
COMMANDS.banner = (ctx) => {
  ctx.print(`███╗   ██╗██╗   ██╗██╗     ██╗     ███╗   ██╗███████╗████████╗
████╗  ██║██║   ██║██║     ██║     ████╗  ██║██╔════╝╚══██╔══╝
██╔██╗ ██║██║   ██║██║     ██║     ██╔██╗ ██║█████╗     ██║   
██║╚██╗██║██║   ██║██║     ██║     ██║╚██╗██║██╔══╝     ██║   
██║ ╚████║╚██████╔╝███████╗███████╗██║ ╚████║███████╗   ██║   
╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═══╝╚══════╝   ╚═╝   `, 'ok');
  ctx.dim('persistent world / fictional network / live simulation');
};

/* ---------------- filesystem commands ---------------- */
COMMANDS.ls = (ctx) => {
  const flags = ctx.args.filter(a => a.startsWith('-'));
  const rest = ctx.args.filter(a => !a.startsWith('-'));
  const showAll = flags.some(f => f.includes('a'));
  const long = flags.some(f => f.includes('l'));
  const human = flags.some(f => f.includes('h'));
  const paths = rest.length ? rest : ['.'];
  const fs = ctx.fs();
  const blocks = [];
  for (const p of paths) {
    const abs = pathFor(ctx.term, p);
    const node = getNode(fs, abs);
    if (!node) { ctx.err(`ls: cannot access '${p}': No such file or directory`); continue; }
    if (node.type === 'file') { blocks.push(p); continue; }
    let entries = listDir(fs, abs) || [];
    if (!showAll) entries = entries.filter(e => !e.name.startsWith('.'));
    if (long) {
      listingLong(ctx, abs, entries, showAll);
      continue;
    }
    const names = entries.map(e => e.name + (e.isDir ? '/' : ''));
    if (paths.length > 1) blocks.push(`${p}:`);
    blocks.push(columnize(names));
  }
  if (blocks.length) ctx.print(blocks.join('\n\n'));
};
COMMANDS.cd = (ctx) => {
  const target = ctx.args[0] || homeOf(ctx.term);
  if (target === '-') {
    const prev = ctx.term.prevCwd || homeOf(ctx.term);
    ctx.term.prevCwd = ctx.term.cwd;
    ctx.term.cwd = prev;
    return;
  }
  const abs = pathFor(ctx.term, target);
  const node = getNode(ctx.fs(), abs);
  if (!node) { ctx.err(`cd: ${target}: No such file or directory`); return; }
  if (node.type !== 'dir') { ctx.err(`cd: ${target}: Not a directory`); return; }
  ctx.term.prevCwd = ctx.term.cwd;
  ctx.term.cwd = abs;
};
COMMANDS.cat = (ctx) => {
  if (!ctx.args.length) {
    if (ctx.input) ctx.print(ctx.input);
    else ctx.dim('cat: reading from stdin is not interactive here. Provide a file.');
    return;
  }
  const fs = ctx.fs();
  for (const p of ctx.args) {
    const abs = pathFor(ctx.term, p);
    const node = getNode(fs, abs);
    if (!node) { ctx.err(`cat: ${p}: No such file or directory`); continue; }
    if (node.type === 'dir') { ctx.err(`cat: ${p}: Is a directory`); continue; }
    const content = node.content || '';
    if (content.includes('\u0000')) { ctx.err(`cat: ${p}: binary file`); continue; }
    ctx.print(content.replace(/\n$/, ''), '');
  }
};
COMMANDS.less = (ctx) => COMMANDS.cat(ctx);
COMMANDS.head = (ctx) => fileSlice(ctx, 'head');
COMMANDS.tail = (ctx) => fileSlice(ctx, 'tail');
function fileSlice(ctx, mode) {
  let n = 10;
  const args = ctx.args.slice();
  if (args[0] === '-n') { n = Number(args[1]) || 10; args.splice(0, 2); }
  else if (/^-\d+$/.test(args[0])) { n = Math.abs(Number(args[0])); args.shift(); }
  const fs = ctx.fs();
  for (const p of args.length ? args : []) {
    const node = getNode(fs, pathFor(ctx.term, p));
    if (!node || node.type !== 'file') { ctx.err(`${mode}: ${p}: No such file or directory`); continue; }
    const lines = node.content.split('\n');
    const slice = mode === 'head' ? lines.slice(0, n) : lines.slice(-n);
    ctx.print(slice.join('\n').replace(/\n$/, ''));
  }
  if (!args.length && ctx.input) {
    const lines = ctx.input.split('\n');
    ctx.print((mode === 'head' ? lines.slice(0, n) : lines.slice(-n)).join('\n'));
  }
}
COMMANDS.wc = (ctx) => {
  let text = ctx.input;
  let label = '';
  const args = ctx.args.slice();
  let showLines = false, showWords = false, showChars = false;
  while (args[0]?.startsWith('-')) {
    const f = args.shift();
    if (f.includes('l')) showLines = true;
    if (f.includes('w')) showWords = true;
    if (f.includes('c') || f.includes('m')) showChars = true;
  }
  const anyFlag = showLines || showWords || showChars;
  if (!anyFlag) showLines = showWords = showChars = true;
  if (args.length) {
    const p = args[0];
    const node = getNode(ctx.fs(), pathFor(ctx.term, p));
    if (!node || node.type !== 'file') { ctx.err(`wc: ${p}: No such file or directory`); return; }
    text = node.content; label = p;
  }
  const lines = text ? text.split('\n').length - (text.endsWith('\n') ? 1 : 0) : 0;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const cols = [];
  if (showLines) cols.push(padLeft(lines, 4));
  if (showWords) cols.push(padLeft(words, 6));
  if (showChars) cols.push(padLeft(chars, 6));
  ctx.print(cols.join(' ') + (label ? ' ' + label : ''));
};
COMMANDS.grep = (ctx) => {
  const args = ctx.args.slice();
  let ignoreCase = false, invert = false, lineNumbers = false;
  while (args[0]?.startsWith('-')) {
    const f = args.shift();
    if (f.includes('i')) ignoreCase = true;
    if (f.includes('v')) invert = true;
    if (f.includes('n')) lineNumbers = true;
  }
  const pattern = args.shift();
  if (!pattern) { ctx.err('usage: grep [-in] pattern [file...]'); return; }
  let re;
  try { re = new RegExp(pattern, ignoreCase ? 'i' : ''); }
  catch { ctx.err(`grep: invalid regular expression: ${pattern}`); return; }
  const files = args.length ? args : null;
  if (!files) {
    const lines = ctx.input.split('\n');
    const matches = lines.map((l, i) => ({ l, i })).filter(x => (re.test(x.l) !== invert));
    if (!matches.length) ctx.code = 1;
    matches.forEach(x => ctx.print((lineNumbers ? `${x.i + 1}:` : '') + x.l, 'accent'));
    return;
  }
  for (const p of files) {
    const node = getNode(ctx.fs(), pathFor(ctx.term, p));
    if (!node || node.type !== 'file') { ctx.err(`grep: ${p}: No such file or directory`); continue; }
    const lines = node.content.split('\n');
    lines.forEach((l, i) => {
      if (re.test(l) !== invert) ctx.print(`${files.length > 1 ? p + ':' : ''}${lineNumbers ? (i + 1) + ':' : ''}${l}`, 'accent');
    });
  }
};
COMMANDS.find = (ctx) => {
  const start = ctx.args.find(a => !a.startsWith('-')) || '.';
  const nameIdx = ctx.args.indexOf('-name');
  const pattern = nameIdx >= 0 ? ctx.args[nameIdx + 1] : null;
  const abs = pathFor(ctx.term, start);
  const node = getNode(ctx.fs(), abs);
  if (!node) { ctx.err(`find: '${start}': No such file or directory`); return; }
  const results = [];
  const walk = (p) => {
    const n = getNode(ctx.fs(), p);
    if (!n) return;
    if (!pattern || new RegExp(pattern.replace(/\*/g, '.*'), 'i').test(basename(p))) results.push(p);
    if (n.type === 'dir') for (const e of listDir(ctx.fs(), p) || []) walk(joinPath(p, e.name));
  };
  walk(abs);
  if (!results.length) ctx.dim('(no matches)');
  else results.slice(0, 200).forEach(p => ctx.print(p));
};
COMMANDS.tree = (ctx) => {
  const p = ctx.args.find(a => !a.startsWith('-')) || '.';
  const abs = pathFor(ctx.term, p);
  if (!getNode(ctx.fs(), abs)) { ctx.err(`tree: ${p}: No such file or directory`); return; }
  ctx.print(treeLines(ctx.fs(), abs, { depth: 4 }), 'accent');
};
COMMANDS.mkdir = (ctx) => {
  const recursive = ctx.args.some(a => a.startsWith('-') && a.includes('p'));
  const paths = ctx.args.filter(a => !a.startsWith('-'));
  if (!paths.length) { ctx.err('mkdir: missing operand'); return; }
  for (const p of paths) {
    const abs = pathFor(ctx.term, p);
    if (getNode(ctx.fs(), abs)) { if (!recursive) ctx.err(`mkdir: cannot create directory '${p}': File exists`); continue; }
    if (recursive) ensureDir(ctx.fs(), abs, userOf(ctx.term));
    else {
      const parent = getNode(ctx.fs(), dirname(abs));
      if (!parent || parent.type !== 'dir') { ctx.err(`mkdir: cannot create directory '${p}': No such file or directory`); continue; }
      parent.children[basename(abs)] = newDir({}, { owner: userOf(ctx.term) });
    }
  }
};
COMMANDS.touch = (ctx) => {
  if (!ctx.args.length) { ctx.err('touch: missing file operand'); return; }
  for (const p of ctx.args) {
    const abs = pathFor(ctx.term, p);
    const node = getNode(ctx.fs(), abs);
    if (node) { node.mtime = Date.now(); continue; }
    const parent = getNode(ctx.fs(), dirname(abs));
    if (!parent || parent.type !== 'dir') { ctx.err(`touch: cannot touch '${p}': No such file or directory`); continue; }
    parent.children[basename(abs)] = newFile('', { owner: userOf(ctx.term) });
  }
};
COMMANDS.rm = (ctx) => {
  const flags = ctx.args.filter(a => a.startsWith('-'));
  const recursive = flags.some(f => f.includes('r'));
  const force = flags.some(f => f.includes('f'));
  const paths = ctx.args.filter(a => !a.startsWith('-'));
  if (!paths.length) { ctx.err('rm: missing operand'); return; }
  for (const p of paths) {
    const abs = pathFor(ctx.term, p);
    if (abs === '/' || abs === HOME) { ctx.err(`rm: refusing to remove '${p}'`); continue; }
    const r = removeNode(ctx.fs(), abs, recursive);
    if (!r.ok) { if (!force) ctx.err(`rm: cannot remove '${p}': ${r.error}`); }
  }
};
COMMANDS.cp = (ctx) => {
  const paths = ctx.args.filter(a => !a.startsWith('-'));
  if (paths.length < 2) { ctx.err('cp: missing destination file operand'); return; }
  const dest = pathFor(ctx.term, paths.pop());
  for (const p of paths) {
    const r = copyNode(ctx.fs(), pathFor(ctx.term, p), dest);
    if (!r.ok) ctx.err(`cp: cannot stat '${p}': ${r.error}`);
  }
};
COMMANDS.mv = (ctx) => {
  const paths = ctx.args.filter(a => !a.startsWith('-'));
  if (paths.length < 2) { ctx.err('mv: missing destination file operand'); return; }
  const dest = pathFor(ctx.term, paths.pop());
  for (const p of paths) {
    const r = moveNode(ctx.fs(), pathFor(ctx.term, p), dest);
    if (!r.ok) ctx.err(`mv: cannot move '${p}': ${r.error}`);
  }
};
COMMANDS.chmod = (ctx) => {
  if (ctx.args.length < 2) { ctx.err('chmod: missing operand'); return; }
  const mode = ctx.args[0];
  const fs = ctx.fs();
  for (const p of ctx.args.slice(1)) {
    const abs = pathFor(ctx.term, p);
    const node = getNode(fs, abs);
    if (!node) { ctx.err(`chmod: cannot access '${p}': No such file or directory`); continue; }
    if (!isRoot(ctx.term, ctx) && node.owner !== userOf(ctx.term)) { ctx.err(`chmod: changing permissions of '${p}': Operation not permitted`); continue; }
    if (/^[0-7]{3,4}$/.test(mode)) node.mode = mode.slice(-3);
    else {
      let m = node.mode;
      if (mode.includes('+x')) m = m.slice(0, 2) + '7' + m.slice(3, 5) + '7' + m.slice(6) + '7';
      if (mode.includes('-x')) m = m.replace(/[1357]/g, c => String(Number(c) - 1));
      node.mode = m;
    }
  }
};
COMMANDS.stat = (ctx) => {
  if (!ctx.args[0]) { ctx.err('stat: missing operand'); return; }
  const abs = pathFor(ctx.term, ctx.args[0]);
  const n = getNode(ctx.fs(), abs);
  if (!n) { ctx.err(`stat: cannot statx '${ctx.args[0]}': No such file or directory`); return; }
  ctx.print(`  File: ${abs}`, 'accent');
  ctx.print(`  Size: ${n.type === 'dir' ? 4096 : sizeOf(n)}\tType: ${n.type === 'dir' ? 'directory' : 'regular file'}`);
  ctx.print(`Access: (${n.mode}/${modeString(n)})  Uid: (${n.owner === 'root' ? 0 : 1000}/${n.owner})`);
  ctx.print(`Modify: ${new Date(n.mtime).toUTCString()}`);
};
COMMANDS.file = (ctx) => {
  if (!ctx.args.length) { ctx.err('file: missing operand'); return; }
  for (const p of ctx.args) {
    const n = getNode(ctx.fs(), pathFor(ctx.term, p));
    if (!n) { ctx.err(`file: cannot open '${p}' (No such file or directory)`); continue; }
    if (n.type === 'dir') { ctx.print(`${p}: directory`); continue; }
    const c = n.content || '';
    let type = 'ASCII text';
    if (c.includes('\u0000')) type = 'data';
    else if (/^#!.*python/.test(c)) type = 'Python script, ASCII text executable';
    else if (/^#!.*bash/.test(c)) type = 'Bourne-Again shell script, ASCII text executable';
    else if (/<html/i.test(c)) type = 'HTML document, ASCII text';
    else if (/^\s*\{/.test(c)) type = 'JSON data';
    else if (/^#include/.test(c)) type = 'C source, ASCII text';
    ctx.print(`${p}: ${type}`);
  }
};
COMMANDS.du = (ctx) => {
  const p = ctx.args[0] || '.';
  const abs = pathFor(ctx.term, p);
  const n = getNode(ctx.fs(), abs);
  if (!n) { ctx.err(`du: cannot access '${p}': No such file or directory`); return; }
  ctx.print(`${Math.max(4, Math.ceil(sizeOf(n) / 1024))}\t${p}`);
};
COMMANDS.df = (ctx) => {
  ctx.print(`Filesystem      Size  Used Avail Use% Mounted on`);
  ctx.print(`/dev/nvme0n1p2  512G  218G  268G  45% /`);
  ctx.print(`tmpfs           7.8G   12M  7.8G   1% /dev/shm`);
  ctx.print(`/dev/nvme0n1p1  512M  6.1M  506M   2% /boot/efi`);
};
COMMANDS.nano = (ctx) => openEditor(ctx, 'nano');
COMMANDS.vim = (ctx) => openEditor(ctx, 'vim');
COMMANDS.vi = (ctx) => openEditor(ctx, 'vim');
COMMANDS.code = (ctx) => openEditor(ctx, 'code');
function openEditor(ctx, tool) {
  const p = ctx.args.find(a => !a.startsWith('-'));
  if (!p) { ctx.print(`${tool}: open the editor from the dock, or specify a file.`, 'dim'); ctx.app.openWindow('editor'); return; }
  const abs = pathFor(ctx.term, p);
  if (!getNode(ctx.fs(), abs)) {
    const parent = getNode(ctx.fs(), dirname(abs));
    if (!parent) { ctx.err(`${tool}: ${p}: No such file or directory`); return; }
    writeFile(ctx.fs(), abs, '', { owner: userOf(ctx.term) });
  }
  ctx.app.openWindow('editor', { path: abs });
  ctx.dim(`${tool}: opened ${abs}`);
}

/* ---------------- system ---------------- */
COMMANDS.ps = (ctx) => {
  const all = ctx.args.includes('aux') || ctx.args.includes('-e') || ctx.args.includes('-ef');
  const rows = [['PID', 'USER', 'CPU%', 'MEM%', 'STAT', 'COMMAND']];
  for (const p of ctx.game.processes) rows.push([p.pid, p.user, p.cpu.toFixed(1), p.mem.toFixed(1), p.state || 'S', p.command]);
  if (!all) rows.splice(1, 0, ['', '', '', '', '', '']);
  ctx.print(table(rows), 'dim');
  ctx.print('');
  ctx.print(`${ctx.game.processes.length} processes · load 0.42 0.37 0.31`, 'dim');
};
COMMANDS.top = (ctx) => {
  ctx.app.openWindow('processes');
  ctx.print('Opened the system monitor. Live process telemetry is rendered there.', 'info');
};
COMMANDS.htop = (ctx) => COMMANDS.top(ctx);
COMMANDS.kill = (ctx) => {
  const pid = Number(ctx.args.find(a => !a.startsWith('-')));
  if (!pid) { ctx.err('kill: usage: kill [-9] pid'); return; }
  const i = ctx.game.processes.findIndex(p => p.pid === pid);
  if (i < 0) { ctx.err(`kill: (${pid}) - No such process`); return; }
  const p = ctx.game.processes.splice(i, 1)[0];
  ctx.print(`[${pid}] terminated ${p.command}`, 'dim');
};
COMMANDS.free = (ctx) => {
  ctx.print('               total        used        free      shared  buff/cache   available');
  ctx.print('Mem:           15.6Gi       4.4Gi       6.2Gi       0.4Gi       5.0Gi        11.2Gi');
  ctx.print('Swap:           2.0Gi          0B       2.0Gi');
};
COMMANDS.systemctl = (ctx) => {
  const sub = ctx.args[0];
  const svc = ctx.args[1] || 'ssh';
  if (!sub) { ctx.err('systemctl: missing command'); return; }
  if (sub === 'status') {
    ctx.print(`● ${svc}.service - ${svc === 'ssh' ? 'OpenBSD Secure Shell server' : svc}`, 'accent');
    ctx.print(`     Loaded: loaded (/lib/systemd/system/${svc}.service; enabled; preset: enabled)`);
    ctx.print(`     Active: ${ctx.term.remote ? 'active (running)' : 'active (running)'} since ${new Date().toUTCString()}`);
    ctx.print(`       Docs: man:${svc}(8)`);
    ctx.print(`   Main PID: ${svc === 'ssh' ? 412 : 2201} (${svc})`);
    ctx.print(`      Tasks: 1 (limit: 18843)`);
    ctx.print(`     Memory: 6.2M`);
    ctx.print(`        CPU: 12ms`);
  } else if (sub === 'restart' || sub === 'start' || sub === 'stop') {
    if (!isRoot(ctx.term, ctx)) { ctx.err('Failed to restart: Interactive authentication required.'); return; }
    ctx.print(`${sub === 'stop' ? 'Stopped' : 'Started'} ${svc}.service.`, 'ok');
  } else if (sub === 'list-units') {
    ctx.print('  UNIT                 LOAD   ACTIVE SUB     DESCRIPTION', 'dim');
    for (const s of ['ssh', 'nginx', 'postgresql', 'cron', 'NetworkManager']) ctx.print(`  ${pad(s + '.service', 20)} loaded active running ${s} service`);
  } else ctx.err(`systemctl: unknown command '${sub}'`);
};
COMMANDS.service = (ctx) => {
  const svc = ctx.args[0] || 'ssh';
  ctx.print(` * ${svc} is running`, 'ok');
};
COMMANDS.reboot = (ctx) => {
  if (!isRoot(ctx.term, ctx)) { ctx.err('reboot: Operation not permitted'); return; }
  ctx.warn('Reboot is disabled in this simulation. The world would continue without you.');
};
COMMANDS.apt = (ctx) => {
  const sub = ctx.args[0];
  if (!sub) { ctx.print('apt 2.6.1 (amd64)\nUsage: apt [update|install|remove|list|search] ...', 'dim'); return; }
  if (sub === 'update') {
    if (!isRoot(ctx.term, ctx)) { ctx.err('E: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)'); ctx.dim('Try: sudo apt update'); return; }
    ctx.print('Hit:1 https://deb.parrot.sh/parrot lorikeet InRelease');
    ctx.print('Hit:2 https://deb.debian.org/debian bookworm InRelease');
    ctx.print('Reading package lists... Done');
    ctx.print('Building dependency tree... Done');
    ctx.print('All packages are up to date.', 'ok');
    return;
  }
  if (sub === 'install') {
    if (!isRoot(ctx.term, ctx)) { ctx.err('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)'); ctx.dim('Try: sudo apt install ' + (ctx.args[1] || '<package>')); return; }
    const names = ctx.args.slice(1).filter(a => !a.startsWith('-'));
    if (!names.length) { ctx.err('E: Invalid operation install'); return; }
    const catalog = ['nmap','sqlmap','hydra','metasploit-framework','wireshark','tcpdump','john','nikto','gobuster','ffuf','rustscan','neovim','tmux','jq','docker.io','nodejs','golang','rustc','python3-pip','netcat-openbsd','socat','binwalk','radare2'];
    for (const name of names) {
      if (ctx.game.installed.includes(name)) { ctx.print(`${name} is already the newest version (${name === 'nmap' ? '7.94' : '1.0'}).`, 'dim'); continue; }
      if (!catalog.includes(name) && !['sqlmap','hydra','wireshark','tcpdump','john','nikto','gobuster','ffuf','rustscan'].includes(name)) {
        ctx.err(`E: Unable to locate package ${name}`);
        continue;
      }
      ctx.print(`Reading package lists... Done`);
      ctx.print(`Building dependency tree... Done`);
      ctx.print(`The following NEW packages will be installed:\n  ${name}`);
      ctx.print(`Need to get ${(2 + name.length / 3).toFixed(1)} MB of archives.`);
      ctx.print(`Fetched ${(2 + name.length / 3).toFixed(1)} MB in 1s (2.4 MB/s)`);
      ctx.print(`Selecting previously unselected package ${name}.`);
      ctx.print(`Unpacking ${name} ...`);
      ctx.print(`Setting up ${name} ...`);
      ctx.game.installed.push(name);
      if (!ctx.game.packages.includes(name)) ctx.game.packages.push(name);
      ctx.ok(`${name} installed.`);
    }
    return;
  }
  if (sub === 'remove' || sub === 'purge') {
    if (!isRoot(ctx.term, ctx)) { ctx.err('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)'); return; }
    const name = ctx.args[1];
    if (!name) return;
    ctx.game.installed = ctx.game.installed.filter(x => x !== name);
    ctx.print(`Removing ${name} ...`, 'dim');
    return;
  }
  if (sub === 'list') {
    if (ctx.args.includes('--installed')) {
      ctx.print('Listing... Done', 'dim');
      for (const p of [...new Set(ctx.game.installed)].sort()) ctx.print(`${p}/stable,now 1.0 amd64 [installed]`, 'dim');
    } else ctx.print('Listing... Done', 'dim');
    return;
  }
  if (sub === 'search') {
    const q = ctx.args[1] || '';
    const hits = ['nmap','sqlmap','hydra','wireshark','tcpdump','john','nikto','gobuster','ffuf','rustscan'].filter(x => x.includes(q));
    if (!hits.length) ctx.dim(`No packages found matching ${q}.`);
    hits.forEach(h => ctx.print(`${h}/stable 1.0 amd64\n  ${h} — security tooling for the simulated network.`));
    return;
  }
  ctx.err(`E: Invalid operation ${sub}`);
};
COMMANDS.dpkg = (ctx) => {
  if (ctx.args[0] === '-l') { ctx.print('Desired=Unknown/Install/Remove/Purge/Hold\n||/ Name Version Architecture Description', 'dim'); for (const p of [...new Set(ctx.game.installed)].slice(0, 20)) ctx.print(`ii  ${pad(p, 22)} 1.0 amd64 ${p}`); }
  else ctx.dim('dpkg: use apt for package operations in this simulation.');
};

/* ---------------- network ---------------- */
COMMANDS.ip = (ctx) => {
  const s = ctx.term.remote?.server;
  const ip = s ? s.ip : '10.0.0.42';
  const host = s ? s.host : 'voidbox';
  ctx.print('1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000');
  ctx.print('    inet 127.0.0.1/8 scope host lo');
  ctx.print('2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000');
  ctx.print(`    inet ${ip}/24 brd ${ip.split('.').slice(0, 3).join('.')}.255 scope global dynamic eth0`);
  ctx.dim(`${host} · asn ${s?.asn || 'AS64500'} · ${s?.region || 'local'}`);
};
COMMANDS.ifconfig = (ctx) => {
  const s = ctx.term.remote?.server;
  const ip = s ? s.ip : '10.0.0.42';
  ctx.print(`eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500`);
  ctx.print(`        inet ${ip}  netmask 255.255.255.0  broadcast ${ip.split('.').slice(0, 3).join('.')}.255`);
  ctx.print(`        ether 52:54:00:${(s?.id || 'local').slice(-2)}:${Math.floor(Math.random() * 90 + 10)}:${Math.floor(Math.random() * 90 + 10)}  txqueuelen 1000  (Ethernet)`);
  ctx.print(`        RX packets 184220  bytes 218439921 (218.4 MB)`);
  ctx.print(`        TX packets 92114  bytes 18200412 (18.2 MB)`);
};
COMMANDS.arp = (ctx) => {
  ctx.print('Address                  HWtype  HWaddress           Flags Mask            Iface');
  ctx.print('10.0.0.1                 ether   52:54:00:12:34:56   C                     eth0');
  ctx.print('10.0.0.42                ether   52:54:00:ab:cd:ef   C                     eth0');
};
COMMANDS.route = (ctx) => {
  ctx.print('Kernel IP routing table');
  ctx.print('Destination     Gateway         Genmask         Flags Metric Ref    Use Iface');
  ctx.print('0.0.0.0         10.0.0.1        0.0.0.0         UG    100    0        0 eth0');
  ctx.print('10.0.0.0        0.0.0.0         255.255.255.0   U     100    0        0 eth0');
};
COMMANDS.ping = async (ctx) => {
  const host = ctx.args.find(a => !a.startsWith('-'));
  if (!host) { ctx.err('ping: usage error: Destination address required'); return; }
  const countIdx = ctx.args.indexOf('-c');
  const count = countIdx >= 0 ? Math.min(10, Number(ctx.args[countIdx + 1]) || 4) : 4;
  const server = getServer(ctx.game, host);
  const site = getSite(ctx.game, host);
  const ip = server?.ip || (site ? getServer(ctx.game, site.serverId)?.ip : null);
  if (!server && !site) {
    ctx.err(`ping: ${host}: Name or service not known`);
    return;
  }
  if (server && server.status === 'offline') {
    ctx.print(`PING ${host} (${server.ip}) 56(84) bytes of data.`);
    ctx.print('');
    ctx.print(`--- ${host} ping statistics ---`);
    ctx.print(`${count} packets transmitted, 0 received, 100% packet loss, time ${count * 1000}ms`, 'err');
    return;
  }
  const latency = server ? Math.max(2, Math.round(6 + (server.security % 17) + (server.region === 'eu-west' ? 2 : 18))) : 12;
  ctx.print(`PING ${host} (${ip}) 56(84) bytes of data.`);
  for (let i = 0; i < count; i++) {
    const t = (latency + Math.random() * 5).toFixed(1);
    ctx.print(`64 bytes from ${ip}: icmp_seq=${i + 1} ttl=${server?.os.includes('Windows') ? 128 : 64} time=${t} ms`);
    await sleep(40);
  }
  ctx.print('');
  ctx.print(`--- ${host} ping statistics ---`);
  ctx.print(`${count} packets transmitted, ${count} received, 0% packet loss, time ${count * 1000 + 3}ms`);
  const avg = latency + 2;
  ctx.print(`rtt min/avg/max/mdev = ${latency}.0/${avg.toFixed(1)}/${latency + 8}.0/1.2 ms`, 'dim');
};
COMMANDS.traceroute = async (ctx) => {
  const host = ctx.args.find(a => !a.startsWith('-'));
  if (!host) { ctx.err('traceroute: usage error: Destination address required'); return; }
  const server = getServer(ctx.game, host);
  if (!server) { ctx.err(`traceroute: ${host}: Name or service not known`); return; }
  ctx.print(`traceroute to ${host} (${server.ip}), 30 hops max, 60 byte packets`);
  const hops = [
    ['10.0.0.1', 'home-gw', 1.2],
    ['198.51.100.1', 'edge-01.basalt.net', 6.4],
    ['198.51.100.17', 'as64500.core', 8.1],
    ['203.0.113.1', 'nullnet.transit', 12.8],
    [server.ip, server.host, 18.3]
  ];
  for (let i = 0; i < hops.length; i++) {
    const [ip, name, base] = hops[i];
    ctx.print(`${padLeft(i + 1, 2)}  ${pad(name, 26)} (${ip})  ${(base + Math.random()).toFixed(2)} ms  ${(base + 1.1 + Math.random()).toFixed(2)} ms`);
    await sleep(50);
  }
};
COMMANDS.dig = (ctx) => {
  const host = ctx.args.find(a => !a.startsWith('+') && !a.startsWith('-')) || ctx.args[ctx.args.length - 1];
  if (!host) { ctx.err('dig: missing host'); return; }
  const server = getServer(ctx.game, host);
  const site = getSite(ctx.game, host);
  if (!server && !site) {
    ctx.print(`; <<>> DiG 9.18 <<>> ${host}`, 'dim');
    ctx.print(';; global options: +cmd');
    ctx.print(`;; status: NXDOMAIN`, 'err');
    return;
  }
  const ip = server?.ip;
  ctx.print('; <<>> DiG 9.18.24 <<>> ' + host + ' +short', 'dim');
  ctx.print(';; global options: +cmd');
  ctx.print(';; Got answer:');
  ctx.print(';; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 41233');
  ctx.print(';; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1');
  ctx.print('');
  ctx.print(';; QUESTION SECTION:');
  ctx.print(`;${host}.\t\t\tIN\tA`);
  ctx.print('');
  ctx.print(';; ANSWER SECTION:');
  ctx.print(`${host}.\t\t300\tIN\tA\t${ip}`, 'ok');
  ctx.print('');
  ctx.print(';; Query time: 12 msec');
  ctx.print(';; SERVER: 10.0.0.1#53(10.0.0.1)');
  ctx.dim(`;; WHEN: ${new Date().toUTCString()}`);
};
COMMANDS.nslookup = (ctx) => {
  const host = ctx.args[0];
  if (!host) { ctx.err('nslookup: missing host'); return; }
  const server = getServer(ctx.game, host);
  if (!server) { ctx.print(`** server can't find ${host}: NXDOMAIN`, 'err'); return; }
  ctx.print('Server:\t\t10.0.0.1');
  ctx.print('Address:\t10.0.0.1#53');
  ctx.print('');
  ctx.print('Non-authoritative answer:');
  ctx.print(`Name:\t${host}`);
  ctx.print(`Address: ${server.ip}`, 'ok');
};
COMMANDS.whois = (ctx) => {
  const q = ctx.args[0];
  if (!q) { ctx.err('whois: missing query'); return; }
  const site = getSite(ctx.game, q);
  const server = getServer(ctx.game, q);
  const company = getCompany(ctx.game, q) || (site?.companyId ? ctx.game.companies.find(c => c.id === site.companyId) : null);
  if (!site && !server && !company) { ctx.print(`No match for "${q}".`, 'err'); return; }
  const domain = site?.domain || server?.domain || company?.domain || q;
  const org = company?.name || server?.org || site?.title || 'unknown';
  ctx.print(`Domain Name: ${domain.toUpperCase()}`, 'accent');
  ctx.print(`Registrar: NullNet Registrar`);
  ctx.print(`Registrant Organization: ${org}`);
  ctx.print(`Creation Date: ${new Date(site?.created || Date.now() - 86400000 * 700).toISOString().slice(0, 10)}`);
  ctx.print(`Name Server: NS1.NULLNET`);
  ctx.print(`Name Server: NS2.NULLNET`);
  ctx.print(`DNSSEC: signedDelegation`);
  if (server) ctx.print(`Network: ${server.asn} · ${server.region} · ${server.ip}`);
  ctx.print('');
  ctx.dim('This is a simulated registry. All records are fictional.');
};
COMMANDS.curl = (ctx) => {
  const flags = ctx.args.filter(a => a.startsWith('-'));
  const rest = ctx.args.filter(a => !a.startsWith('-'));
  const url = rest[rest.length - 1];
  if (!url) { ctx.err('curl: try \'curl --help\' for more information'); return; }
  const headOnly = flags.includes('-I') || flags.includes('--head');
  const silent = flags.includes('-s') || flags.includes('--silent');
  const outIdx = ctx.args.indexOf('-o');
  const outFile = outIdx >= 0 ? ctx.args[outIdx + 1] : null;
  const domain = url.replace(/^https?:\/\//, '').split('/')[0].replace(/:\d+$/, '');
  const site = getSite(ctx.game, domain);
  const server = getServer(ctx.game, domain);
  if (!site && !server) {
    ctx.err(`curl: (6) Could not resolve host: ${domain}`);
    return;
  }
  if (site && site.status !== 'live') {
    ctx.err(`curl: (7) Failed to connect to ${domain} port 443: Connection refused`);
    return;
  }
  const body = site ? fetchSiteText(ctx.game, site) : `HTTP/1.1 200 OK\n\n${server.host} — ${server.role}\n${server.org}\n`;
  if (headOnly) {
    ctx.print(`HTTP/2 200`, 'dim');
    ctx.print(`server: ${site?.tech || 'nginx'}`, 'dim');
    ctx.print(`content-type: text/html; charset=utf-8`, 'dim');
    ctx.print(`content-length: ${body.length}`, 'dim');
    ctx.print(`date: ${new Date().toUTCString()}`, 'dim');
    ctx.print(`x-simulated: true`, 'dim');
    return;
  }
  if (outFile) {
    writeFile(ctx.fs(), pathFor(ctx.term, outFile), body, { owner: userOf(ctx.term) });
    if (!silent) ctx.print(`  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100 ${String(body.length).padStart(6)}  100 ${String(body.length).padStart(6)}    0     0   142k      0 --:--:-- --:--:-- --:--:--  142k`, 'dim');
    ctx.ok(`Saved to '${outFile}'`);
    return;
  }
  ctx.print(body);
};
function fetchSiteText(game, site) {
  if (site.kind === 'news' && site.domain === 'news.nullnet') {
    return `NULLNET WIRE\n============\n\nThe network wire. Updated continuously.\n\n${game.news.slice(0, 12).map(n => `[${fmtTime(n.time)}] ${n.source}\n  ${n.headline}`).join('\n\n')}\n\nLINKS: portal.nullnet  market.nullnet  signalreview.media`;
  }
  if (site.kind === 'market') {
    return `NULLNET CONTRACT BOARD\n======================\n\n${game.contracts.filter(c => c.status === 'open').slice(0, 10).map(c => `${c.id}  ${c.title}\n  ${fmtMoney(c.pay)} · difficulty ${c.difficulty} · ${c.clientHandle}\n  ${c.desc}`).join('\n\n')}\n\nAccept with: accept <id>`;
  }
  if (site.kind === 'git') {
    return `GIT.NULLNET\n===========\n\n${game.repos.map(r => `${r.name}  (${r.lang})  ★ ${r.stars}\n  ${r.desc}\n  git clone https://git.nullnet/${r.name}`).join('\n\n')}`;
  }
  if (site.kind === 'portal') {
    return `NULLNET\n=======\n\nA community network for people who still read headers.\n\nBOARDS\n  portal.nullnet/boards\n  forum list in the shell\n\nSERVICES\n  mail.nullnet     public mail\n  market.nullnet   contract board\n  git.nullnet      public repositories\n  news.nullnet     network wire\n\nCONDUCT\n  Read before posting. Report breakage. Do not make the network worse.`;
  }
  if (site.kind === 'player') {
    return `${site.title}\n${'='.repeat(site.title.length)}\n\n${site.desc}\n\n${site.sections.map(s => `${s.h}\n${s.p}`).join('\n\n')}\n\nLINKS: ${site.links.join('  ')}`;
  }
  return site.text;
}
COMMANDS.wget = (ctx) => {
  const url = ctx.args.find(a => /^https?:\/\//.test(a)) || ctx.args.find(a => !a.startsWith('-'));
  if (!url) { ctx.err('wget: missing URL'); return; }
  const domain = url.replace(/^https?:\/\//, '').split('/')[0];
  const site = getSite(ctx.game, domain);
  const server = getServer(ctx.game, domain);
  if (!site && !server) { ctx.err(`wget: unable to resolve host address '${domain}'`); return; }
  const body = site ? fetchSiteText(ctx.game, site) : `${server.host} — ${server.role}\n`;
  const name = ctx.args.includes('-O') ? ctx.args[ctx.args.indexOf('-O') + 1] : 'index.html';
  const abs = pathFor(ctx.term, name);
  writeFile(ctx.fs(), abs, body, { owner: userOf(ctx.term) });
  ctx.print(`--${new Date().toISOString()}--  ${url}`, 'dim');
  ctx.print(`Resolving ${domain}... ${server?.ip || ''}`);
  ctx.print(`Connecting to ${domain}|${server?.ip || ''}|:443... connected.`);
  ctx.print(`HTTP request sent, awaiting response... 200 OK`);
  ctx.print(`Length: ${body.length} [text/html]`);
  ctx.ok(`'${name}' saved [${body.length}/${body.length}]`);
};
COMMANDS.ssh = (ctx) => {
  const target = ctx.args.find(a => !a.startsWith('-'));
  if (!target) { ctx.err('usage: ssh [user@]host'); return; }
  const at = target.includes('@');
  const user = at ? target.split('@')[0] : 'operator';
  const host = at ? target.split('@').slice(1).join('@') : target;
  const server = getServer(ctx.game, host);
  if (!server) { ctx.err(`ssh: Could not resolve hostname ${host}: Name or service not known`); return; }
  if (server.status === 'offline') { ctx.err(`ssh: connect to host ${host} port 22: Connection refused`); return; }
  if (ctx.game.flags.exploited[server.id]) { attachRemote(ctx.app, ctx.term, server, 'root', 'retained session'); return; }
  if (server.owned && (user === 'operator' || user === 'root')) {
    attachRemote(ctx.app, ctx.term, server, user, 'public key');
    return;
  }
  const known = server.users.find(u => u.user === user);
  ctx.print(`The authenticity of host '${host} (${server.ip})' can't be established.`);
  ctx.print(`ED25519 key fingerprint is SHA256:${(server.id + server.ip).replace(/[^a-zA-Z0-9]/g, '').slice(0, 28)}.`);
  ctx.print('This key is not known by any other names.');
  ctx.print(`Are you sure you want to continue connecting (yes/no/[fingerprint])? `, 'dim');
  ctx.term.pending = { kind: 'ssh-hostkey', serverId: server.id, user, known: !!known };
  ctx.print(`Warning: Permanently added '${host}' (ED25519) to the list of known hosts.`, 'dim');
  ctx.print(`${user}@${host}'s password: `, 'dim');
  ctx.term.pending = { kind: 'ssh-password', serverId: server.id, user, attempts: 0 };
};
function attachRemote(app, term, server, user, method) {
  const home = server.fs.children.home?.children?.[user] ? `/home/${user}` : '/root';
  term.remote = { serverId: server.id, user, home, server };
  term.cwd = home;
  term.user = user;
  term.host = server.host;
  app.game.stats.logins++;
  app.game.flags.visited[server.id] = Date.now();
  term.print(`Linux ${server.host} ${server.kernel} #1 SMP PREEMPT_DYNAMIC ${server.os} x86_64`, 'dim');
  term.print(`Last login: ${new Date(Date.now() - 86400000 * 3).toUTCString()} from 10.0.0.42`, 'dim');
  term.print('');
  term.print(`Welcome to ${server.host} — ${server.role}.`, 'accent');
  term.print(server.org + ' · ' + server.os, 'dim');
  term.print('');
  const motd = readFile(server.fs, '/etc/motd');
  if (motd) term.print(motd.trim(), 'dim');
  if (method === 'retained session') term.print('[session retained from prior access]', 'warn');
  if (method === 'public key') term.print('[authenticated via ~/.ssh/id_ed25519]', 'dim');
  term.print('');
  term.print(`You are ${user}@${server.host}. Type 'exit' to disconnect.`, 'ok');
  checkAchievements(app.game);
  app.refreshUI?.();
}
COMMANDS.scp = (ctx) => {
  const args = ctx.args.filter(a => !a.startsWith('-'));
  if (args.length < 2) { ctx.err('usage: scp [user@host:]source [user@host:]dest'); return; }
  const [src, dest] = args;
  const parse = (s) => {
    const m = s.match(/^(?:([^@]+)@)?([^:]+):(.+)$/);
    return m ? { user: m[1] || 'operator', host: m[2], path: m[3] } : null;
  };
  const remoteSrc = parse(src);
  const remoteDest = parse(dest);
  if (remoteSrc) {
    const server = getServer(ctx.game, remoteSrc.host);
    if (!server) { ctx.err(`ssh: Could not resolve hostname ${remoteSrc.host}`); return; }
    const content = readFile(server.fs, remoteSrc.path);
    if (content == null) { ctx.err(`scp: ${src}: No such file or directory`); return; }
    const abs = pathFor(ctx.term, dest);
    writeFile(ctx.fs(), abs, content, { owner: userOf(ctx.term) });
    ctx.ok(`${src} → ${abs} (${content.length} bytes)`);
  } else if (remoteDest) {
    const server = getServer(ctx.game, remoteDest.host);
    if (!server) { ctx.err(`ssh: Could not resolve hostname ${remoteDest.host}`); return; }
    if (!ctx.game.flags.exploited[server.id]) { ctx.err('scp: Permission denied (publickey,password).'); return; }
    const content = readFile(ctx.fs(), pathFor(ctx.term, src));
    if (content == null) { ctx.err(`scp: ${src}: No such file or directory`); return; }
    writeFile(server.fs, remoteDest.path, content, { owner: remoteDest.user });
    ctx.ok(`${src} → ${remoteDest.host}:${remoteDest.path}`);
  } else {
    ctx.err('scp: one side must be remote');
  }
};
COMMANDS.nc = (ctx) => {
  const host = ctx.args.find(a => !a.startsWith('-'));
  const port = Number(ctx.args.find(a => /^\d+$/.test(a)));
  if (!host || !port) { ctx.err('usage: nc [-v] host port'); return; }
  const server = getServer(ctx.game, host);
  if (!server) { ctx.err(`nc: getaddrinfo for host "${host}" failed: Name or service not known`); return; }
  const svc = server.services.find(s => s.port === port);
  if (!svc) { ctx.err(`nc: connect to ${host} port ${port} (tcp) failed: Connection refused`); return; }
  ctx.ok(`Connection to ${host} ${port} port [tcp/${svc.name}] succeeded!`);
  ctx.print(`${svc.product} ${svc.version}`, 'dim');
  ctx.print(`220 ${server.host} ${svc.name} service ready`, 'dim');
  ctx.dim('(simulated banner; press Ctrl+C is not required)');
};
COMMANDS.netstat = (ctx) => {
  const remote = ctx.term.remote?.server;
  ctx.print('Active Internet connections (only servers)');
  ctx.print('Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name');
  if (remote) {
    for (const s of remote.services) ctx.print(`tcp        0      0 0.0.0.0:${String(s.port).padEnd(6)}       0.0.0.0:*               LISTEN      ${1000 + s.port}/${s.name}`);
  } else {
    const rows = [
      ['tcp', '0.0.0.0:22', 'sshd'], ['tcp', '127.0.0.1:631', 'cupsd'], ['tcp', '0.0.0.0:8080', 'python3'],
      ['tcp', '127.0.0.1:5432', 'postgres'], ['udp', '0.0.0.0:53', 'dnsmasq']
    ];
    for (const [proto, addr, name] of rows) ctx.print(`${proto}        0      0 ${pad(addr, 22)} 0.0.0.0:*               LISTEN      ${name}`);
  }
};
COMMANDS.ss = (ctx) => {
  const remote = ctx.term.remote?.server;
  ctx.print('Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process');
  if (remote) for (const s of remote.services) ctx.print(`tcp   LISTEN 0      128    0.0.0.0:${String(s.port).padEnd(6)}      0.0.0.0:*     users:(("${s.name}",pid=${1000 + s.port},fd=3))`);
  else {
    for (const [port, name] of [[22, 'sshd'], [631, 'cupsd'], [8080, 'python3'], [5432, 'postgres'], [53, 'dnsmasq']]) {
      ctx.print(`tcp   LISTEN 0      128    0.0.0.0:${String(port).padEnd(6)}      0.0.0.0:*     users:(("${name}",pid=${1000 + port},fd=3))`);
    }
  }
};

/* ---------------- security ---------------- */
COMMANDS.nmap = async (ctx) => {
  if (!checkInstalled(ctx, 'nmap')) return;
  const target = ctx.args.find(a => !a.startsWith('-'));
  if (!target) { ctx.err('Usage: nmap [Scan Type(s)] [Options] {target specification}'); return; }
  const server = getServer(ctx.game, target);
  if (!server) {
    ctx.print(`Starting Nmap 7.94 ( https://nmap.org ) at ${new Date().toUTCString()}`, 'dim');
    ctx.err(`Failed to resolve "${target}".`);
    return;
  }
  if (server.status === 'offline') {
    ctx.print(`Starting Nmap 7.94 ( https://nmap.org ) at ${new Date().toUTCString()}`, 'dim');
    ctx.print(`Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn`, 'warn');
    ctx.print('Nmap done: 1 IP address (0 hosts up) scanned in 2.04 seconds', 'dim');
    return;
  }
  const serviceDetect = ctx.args.includes('-sV') || ctx.args.includes('-A') || ctx.args.includes('-sC');
  const allPorts = ctx.args.includes('-p-') || ctx.args.includes('-p');
  const portArg = ctx.args.includes('-p') ? ctx.args[ctx.args.indexOf('-p') + 1] : null;
  let ports = server.services.slice();
  if (portArg && portArg !== '-') {
    const wanted = portArg.split(',').flatMap(x => {
      if (x.includes('-')) { const [a, b] = x.split('-').map(Number); return Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i); }
      return [Number(x)];
    }).filter(Boolean);
    if (wanted.length) ports = ports.filter(s => wanted.includes(s.port));
  }
  if (!allPorts && !portArg) ports = ports.filter(s => s.port < 10000);
  ctx.print(`Starting Nmap 7.94 ( https://nmap.org ) at ${new Date().toUTCString()}`, 'dim');
  await sleep(160);
  ctx.print(`Nmap scan report for ${server.host} (${server.ip})`, 'accent');
  ctx.print(`Host is up (0.0${Math.floor(Math.random() * 9 + 1)}s latency).`);
  const closed = allPorts ? 65535 - ports.length : 995 - ports.length;
  ctx.print(`Not shown: ${Math.max(0, closed)} closed tcp ports (reset)`, 'dim');
  ctx.print('PORT      STATE SERVICE     VERSION');
  for (const s of ports) {
    ctx.print(`${String(s.port).padEnd(9)} open  ${pad(s.name, 11)} ${serviceDetect ? s.product + ' ' + s.version : ''}`);
  }
  if (!ports.length) ctx.dim('(no matching open ports)');
  ctx.print('');
  if (serviceDetect) {
    ctx.print(`Service detection performed. OS fingerprint: ${server.os}`, 'dim');
    ctx.print(`Aggressive OS guesses: ${server.os} (94%), Linux 5.15 - 6.1 (88%)`, 'dim');
  }
  const t = (0.9 + ports.length * .18).toFixed(2);
  ctx.print(`Nmap done: 1 IP address (1 host up) scanned in ${t} seconds`, 'dim');
  ctx.game.flags.scanned[server.id] = { time: Date.now(), ports: ports.map(s => s.port) };
  server.discovered = true;
  ctx.game.stats.scans++;
  checkAchievements(ctx.game);
  ctx.app.refreshUI?.();
};
COMMANDS.vulnscan = (ctx) => {
  const target = ctx.args.find(a => !a.startsWith('-'));
  if (!target) { ctx.err('usage: vulnscan <host>'); return; }
  const server = getServer(ctx.game, target);
  if (!server) { ctx.err(`vulnscan: cannot resolve ${target}`); return; }
  if (!ctx.game.flags.scanned[server.id]) { ctx.warn('No prior scan on record. Results may be incomplete.'); ctx.dim(`Try: nmap -sV ${server.host}`); }
  const open = server.vulns.filter(v => !v.patched);
  for (const v of open) v.discovered = true;
  ctx.game.flags.discovered[server.id] = Date.now();
  ctx.print(`vulnscan 1.4 — ${server.host} (${server.ip})`, 'accent');
  ctx.print(`Target: ${server.os} · security score ${server.security}/100`, 'dim');
  ctx.print('');
  if (!open.length) { ctx.ok('No known exploitable findings. The host is either clean or quiet.'); return; }
  ctx.print('ID                SEV       SERVICE     FINDING');
  for (const v of open) {
    ctx.print(`${pad(v.id, 18)}${pad(v.severity.toUpperCase(), 10)}${pad(v.service, 12)}${v.name}`, v.severity === 'critical' ? 'err' : v.severity === 'high' ? 'warn' : '');
    ctx.dim(`  ${v.desc}`);
  }
  ctx.print('');
  ctx.dim(`Use: exploit ${server.host} <ID>   ·   or report findings with: audit ${server.host}`);
};
COMMANDS.audit = (ctx) => {
  const target = ctx.args.find(a => !a.startsWith('-'));
  if (!target) { ctx.err('usage: audit <host>'); return; }
  const server = getServer(ctx.game, target);
  if (!server) { ctx.err(`audit: cannot resolve ${target}`); return; }
  if (!ctx.game.flags.scanned[server.id]) { ctx.err(`audit: no scan baseline for ${server.host}. Run: nmap -sV ${server.host}`); return; }
  const r = auditServer(ctx.game, server);
  if (!r.ok) { ctx.err(r.error); return; }
  ctx.print(`SECURITY AUDIT — ${server.host} (${server.ip})`, 'head');
  ctx.print(`Auditor: ${userOf(ctx.term)} · ${new Date().toUTCString()}`, 'dim');
  ctx.print(`Scope: ${server.role} · ${server.os} · ASN ${server.asn}`, 'dim');
  ctx.print('');
  if (!r.findings.length) {
    ctx.ok('No unpatched findings were identified. The evidence is in the scan history.');
  } else {
    for (const v of r.findings) {
      ctx.print(`[${v.severity.toUpperCase()}] ${v.name} (${v.id})`, v.severity === 'critical' ? 'err' : 'warn');
      ctx.print(`  service: ${v.service} · ${v.desc}`);
    }
    ctx.print('');
    ctx.print(`${r.findings.length} finding(s). ${r.discovered} newly discovered.`, 'accent');
    ctx.print('Report stored in audit history. Deliver with: contracts active', 'dim');
  }
  ctx.app.refreshUI?.();
};
COMMANDS.exploit = (ctx) => {
  const target = ctx.args.find(a => !a.startsWith('-'));
  if (!target) { ctx.err('usage: exploit <host> [CVE]'); return; }
  const server = getServer(ctx.game, target);
  if (!server) { ctx.err(`exploit: cannot resolve ${target}`); return; }
  const vulnId = ctx.args.find(a => /^CVE-|^NULL-/i.test(a));
  ctx.print(`[*] Preparing exploit against ${server.host} (${server.ip})`, 'dim');
  ctx.print(`[*] Checking known vectors...`, 'dim');
  const r = exploitServer(ctx.game, server, vulnId);
  if (!r.ok) {
    ctx.err(`[-] ${r.error}`);
    if (r.legal) ctx.print(`[-] Enforcement fine: ${fmtMoney(r.legal.fine)}`, 'err');
    ctx.app.refreshUI?.();
    return;
  }
  ctx.print(`[+] ${r.vuln.id} — ${r.vuln.name}`, 'ok');
  ctx.print(`[*] Gaining session...`, 'dim');
  ctx.print(`[+] uid=0(root) gid=0(root) groups=0(root)`, 'ok');
  if (r.loot.length) {
    ctx.print('[+] Files copied to local downloads:', 'accent');
    for (const l of r.loot) ctx.print('    ' + l, 'dim');
  }
  ctx.print('');
  attachRemote(ctx.app, ctx.term, server, r.user, 'exploit');
  ctx.app.refreshUI?.();
};
COMMANDS.patch = (ctx) => {
  const target = ctx.args.find(a => !a.startsWith('-'));
  if (!target) { ctx.err('usage: patch <host>'); return; }
  const server = getServer(ctx.game, target);
  if (!server) { ctx.err(`patch: cannot resolve ${target}`); return; }
  if (!server.owned && !isRoot(ctx.term, ctx) && !ctx.game.flags.exploited[server.id]) {
    ctx.err(`patch: permission denied on ${server.host}. You need root access or ownership.`);
    return;
  }
  const r = patchServer(ctx.game, server);
  if (!r.ok) { ctx.err(r.error); return; }
  ctx.print(`[*] Applying patches to ${server.host}`, 'dim');
  for (let i = 0; i < r.count; i++) ctx.print(`[+] remediated finding ${i + 1}/${r.count}`, 'ok');
  ctx.print(`[+] security score now ${server.security}/100`, 'ok');
  ctx.print('[+] verification complete: exposed services re-tested', 'dim');
  ctx.app.refreshUI?.();
};
COMMANDS.hydra = async (ctx) => {
  if (!checkInstalled(ctx, 'hydra')) return;
  const target = ctx.args.find(a => !a.startsWith('-') && !a.includes('://') && /^[a-zA-Z0-9.@-]+$/.test(a));
  const server = getServer(ctx.game, target || '');
  if (!server) { ctx.err(`hydra: could not resolve target`); return; }
  const user = (ctx.args[ctx.args.indexOf('-l') + 1]) || 'guest';
  ctx.print(`Hydra v9.5 (c) 2026 by van Hauser/THC — simulated build`, 'dim');
  ctx.print(`[DATA] attacking ssh://${server.ip}:22/`, 'dim');
  await sleep(220);
  const weak = server.users.find(u => u.user === user && (u.pass === 'guest' || u.pass === 'toor' || u.pass === 'admin'));
  if (weak) {
    ctx.print(`[22][ssh] host: ${server.ip}   login: ${user}   password: ${weak.pass}`, 'ok');
    addHeat(ctx.game, 4, `credential attack on ${server.host}`);
    ctx.game.flags.knownCreds = ctx.game.flags.knownCreds || {};
    ctx.game.flags.knownCreds[server.id] = { user, pass: weak.pass };
    ctx.print('[STATUS] 1 valid password found', 'ok');
  } else {
    ctx.print(`[STATUS] 0 valid passwords found`, 'err');
    addHeat(ctx.game, 2, `failed credential attack on ${server.host}`);
  }
  ctx.app.refreshUI?.();
};
COMMANDS.heat = (ctx) => {
  const t = threatInfo(ctx.game);
  ctx.print(`Trace exposure: ${Math.round(ctx.game.player.heat)}% · ${t.label}`, t.level >= 3 ? 'warn' : 'ok');
  ctx.print(progressBar(ctx.game.player.heat, 30), t.level >= 3 ? 'warn' : 'ok');
  ctx.dim('Heat decays slowly. Proxy and VPN reduce new exposure. Investigations are expensive.');
  if (ctx.game.legal.length) ctx.dim(`Legal events on record: ${ctx.game.legal.length}`);
};
COMMANDS.legal = (ctx) => {
  if (!ctx.game.legal.length) { ctx.ok('No enforcement actions on record.'); return; }
  for (const e of ctx.game.legal.slice().reverse()) ctx.print(`${fmtDateTime(e.time)}  ${fmtMoney(e.fine)}  ${e.reason}`, 'warn');
};
COMMANDS.recon = (ctx) => COMMANDS.nmap(ctx);
COMMANDS.true = () => {};
COMMANDS.false = (ctx) => { ctx.code = 1; };

/* ---------------- development runtimes ---------------- */
function runFileCommand(ctx) {
  const p = ctx.resolve(ctx.cmd);
  const node = getNode(ctx.fs(), p);
  if (!node) { ctx.err(`bash: ${ctx.cmd}: No such file or directory`); return; }
  if (node.type === 'dir') { ctx.err(`bash: ${ctx.cmd}: Is a directory`); return; }
  if (!node.exec) { ctx.err(`bash: ${ctx.cmd}: Permission denied`); ctx.dim(`Try: chmod +x ${ctx.cmd.replace('./', '')}`); return; }
  if (node.simOutput != null) { ctx.print(node.simOutput); return; }
  const content = node.content || '';
  if (/^#!.*python/.test(content)) return runPython(ctx, content, p);
  if (/^#!.*(bash|sh)/.test(content)) return runBash(ctx, content, p);
  ctx.err(`bash: ${ctx.cmd}: cannot execute binary file: Exec format error`);
}

COMMANDS.python3 = (ctx) => runPythonCommand(ctx, 'python3');
COMMANDS.python = (ctx) => runPythonCommand(ctx, 'python');
function runPythonCommand(ctx, cmd) {
  if (!checkInstalled(ctx, 'python3')) return;
  const args = ctx.args.slice();
  if (!args.length) {
    ctx.print(`Python 3.11.9 (main, Apr  2 2026, 09:12:44) [GCC 12.2.0] on linux`, 'dim');
    ctx.print('Type "help", "copyright", "credits" or "license" for more information.');
    ctx.dim('This is a simulated REPL. Run a file with: python3 script.py');
    return;
  }
  if (args[0] === '--version' || args[0] === '-V') { ctx.print('Python 3.11.9'); return; }
  if (args[0] === '-c') {
    const src = args.slice(1).join(' ');
    return runPython(ctx, src, '<string>');
  }
  const file = args[0];
  const node = getNode(ctx.fs(), pathFor(ctx.term, file));
  if (!node || node.type !== 'file') { ctx.err(`python3: can't open file '${file}': [Errno 2] No such file or directory`); return; }
  return runPython(ctx, node.content, file);
}
COMMANDS.pip = (ctx) => {
  if (ctx.args[0] === 'install') {
    const pkg = ctx.args[1];
    if (!pkg) { ctx.err('ERROR: You must give at least one requirement to install'); return; }
    ctx.print(`Collecting ${pkg}`, 'dim');
    ctx.print(`  Downloading ${pkg}-1.0.0-py3-none-any.whl (42 kB)`, 'dim');
    ctx.print(`Installing collected packages: ${pkg}`);
    ctx.ok(`Successfully installed ${pkg}-1.0.0`);
    ctx.game.packages.push(`python-${pkg}`);
    return;
  }
  if (ctx.args[0] === 'list') { ctx.print('Package    Version\n---------- -------\nrequests   2.31.0\nrich       13.7.1'); return; }
  ctx.print('Usage: pip install <package>', 'dim');
};
COMMANDS.bash = (ctx) => {
  if (ctx.args[0] === '-c') { return runBash(ctx, ctx.args.slice(1).join(' '), '<command>'); }
  const file = ctx.args[0];
  if (!file) { ctx.print('bash: interactive shell already active.', 'dim'); return; }
  const node = getNode(ctx.fs(), pathFor(ctx.term, file));
  if (!node || node.type !== 'file') { ctx.err(`bash: ${file}: No such file or directory`); return; }
  return runBash(ctx, node.content, file);
};
COMMANDS.sh = (ctx) => COMMANDS.bash(ctx);
COMMANDS.source = (ctx) => COMMANDS.bash(ctx);

COMMANDS.gcc = (ctx) => compileC(ctx, 'gcc');
COMMANDS['g++'] = (ctx) => compileC(ctx, 'g++');
function compileC(ctx, compiler) {
  if (!checkInstalled(ctx, compiler === 'g++' ? 'g++' : 'gcc')) return;
  if (ctx.args.includes('--version') || (ctx.args.includes('-v') && ctx.args.length === 1)) {
    ctx.print(compiler === 'g++' ? 'g++ (Debian 12.2.0-14) 12.2.0' : 'gcc (Debian 12.2.0-14) 12.2.0');
    ctx.print('Copyright (C) 2022 Free Software Foundation, Inc.');
    ctx.print('This is free software; see the source for copying conditions.  There is NO');
    ctx.print('warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.');
    return;
  }
  const files = ctx.args.filter(a => !a.startsWith('-'));
  const src = files[0];
  if (!src) { ctx.err(`${compiler}: fatal error: no input files`); return; }
  const outIdx = ctx.args.indexOf('-o');
  const out = outIdx >= 0 ? ctx.args[outIdx + 1] : 'a.out';
  const node = getNode(ctx.fs(), pathFor(ctx.term, src));
  if (!node || node.type !== 'file') { ctx.err(`${compiler}: error: ${src}: No such file or directory`); return; }
  const source = node.content;
  const err = cSyntaxCheck(source);
  if (err) { ctx.err(`${src}:${err.line}:${err.col}: error: ${err.message}`); ctx.dim(`${compiler}: compilation terminated.`); return; }
  const output = simulateC(source);
  const abs = pathFor(ctx.term, out);
  const bin = writeFile(ctx.fs(), abs, 'ELF 64-bit LSB pie executable, x86-64, dynamically linked (simulated)', { owner: userOf(ctx.term), exec: true, mode: '755' });
  if (bin) bin.simOutput = output;
  ctx.game.stats.codeLines += source.split('\n').length;
  ctx.ok(`Compiled ${src} → ${out}`);
  ctx.dim(`Run it with: ./${out}`);
  checkAchievements(ctx.game);
}
function cSyntaxCheck(source) {
  const lines = source.split('\n');
  let braces = 0, parens = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const code = raw.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (!code.trim()) continue;
    for (const ch of code) { if (ch === '{') braces++; if (ch === '}') braces--; if (ch === '(') parens++; if (ch === ')') parens--; }
    if (/\bprintf\s*\(/.test(code) && !code.trim().endsWith(';') && !code.trim().endsWith('{')) {
      return { line: i + 1, col: code.length, message: 'expected \';\' before \'}\'' };
    }
    if (braces < 0) return { line: i + 1, col: 1, message: 'expected declaration or statement at end of input' };
  }
  if (braces !== 0) return { line: lines.length, col: 1, message: 'expected \'}\' at end of input' };
  if (parens !== 0) return { line: lines.length, col: 1, message: 'expected \')\' at end of input' };
  if (!/#include/.test(source)) return { line: 1, col: 1, message: 'implicit declaration of function \'printf\' (did you forget #include <stdio.h>?)' };
  return null;
}
function simulateC(source) {
  const lines = source.split('\n');
  const out = [];
  const loops = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const loop = line.match(/for\s*\(\s*(?:int\s+)?(\w+)\s*=\s*0\s*;\s*\1\s*<\s*(\d+)\s*;/);
    if (loop) { loops.push({ var: loop[1], count: Number(loop[2]) }); continue; }
    if (/^\s*}/.test(line) && loops.length) { loops.pop(); continue; }
    const prints = [...line.matchAll(/printf\s*\(\s*"((?:[^"\\]|\\.)*)"/g)];
    if (!prints.length) continue;
    const count = loops.length ? loops[loops.length - 1].count : 1;
    for (let n = 0; n < count; n++) {
      let text = prints.map(m => m[1]).join('');
      text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      text = text.replace(/%d/g, String(n)).replace(/%i/g, String(n)).replace(/%s/g, 'simulated').replace(/%%/g, '%');
      out.push(text);
    }
  }
  return out.join('').replace(/\n$/, '');
}
COMMANDS.make = (ctx) => {
  if (!checkInstalled(ctx, 'make')) return;
  const mk = getNode(ctx.fs(), pathFor(ctx.term, 'Makefile')) || getNode(ctx.fs(), pathFor(ctx.term, 'makefile'));
  if (!mk) { ctx.err('make: *** No targets specified and no makefile found.  Stop.'); return; }
  ctx.print('cc -Wall -O2 -o app main.c');
  ctx.print('make: Nothing to be done for \'all\'.', 'dim');
  const c = getNode(ctx.fs(), pathFor(ctx.term, 'main.c'));
  if (c) {
    const out = simulateC(c.content);
    const bin = writeFile(ctx.fs(), pathFor(ctx.term, 'app'), 'ELF (simulated)', { owner: userOf(ctx.term), exec: true, mode: '755' });
    if (bin) bin.simOutput = out;
    ctx.ok('Built ./app');
  }
};
COMMANDS.node = (ctx) => {
  if (ctx.args[0] === '-v' || ctx.args[0] === '--version') { ctx.print('v22.11.0'); return; }
  if (ctx.args[0] === '-e') {
    const code = ctx.args.slice(1).join(' ');
    const prints = [...code.matchAll(/console\.log\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\d+)\s*\)/g)].map(m => m[1].replace(/^['"]|['"]$/g, ''));
    if (prints.length) ctx.print(prints.join('\n'));
    else ctx.dim('node: no console output');
    return;
  }
  const file = ctx.args[0];
  if (!file) { ctx.print('Welcome to Node.js v22.11.0.\nType ".help" for more information.', 'dim'); return; }
  const node = getNode(ctx.fs(), pathFor(ctx.term, file));
  if (!node) { ctx.err(`node: Cannot find module '${file}'`); return; }
  const prints = [...node.content.matchAll(/console\.log\s*\(\s*(?:"([^"]*)"|'([^']*)'|(\d+))\s*\)/g)].map(m => m[1] ?? m[2] ?? m[3]);
  ctx.print(prints.join('\n') || '(no output)');
  ctx.game.stats.codeLines += node.content.split('\n').length;
};
COMMANDS.npm = (ctx) => {
  if (ctx.args[0] === 'install' || ctx.args[0] === 'i') {
    ctx.print('npm warn deprecated inflight@1.0.6: This module is not supported.', 'dim');
    ctx.print('added 42 packages, and audited 43 packages in 2s');
    ctx.ok('found 0 vulnerabilities');
  } else if (ctx.args[0] === 'run') ctx.print(`> ${ctx.args[1] || 'start'}\n> node index.js\n\nserver listening on :3000`);
  else ctx.print('npm <command>\n\ninstall, run, init, test', 'dim');
};

/* ---------------- Python subset ---------------- */
function runPython(ctx, source, filename) {
  const lines = source.replace(/\r/g, '').split('\n').map(l => l.replace(/\t/g, '    '));
  const scope = Object.create(null);
  scope.__name__ = '__main__';
  const out = [];
  let lineNo = 0;

  const fmt = v => {
    if (v === null || v === undefined) return 'None';
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    if (Array.isArray(v)) return '[' + v.map(fmt).join(', ') + ']';
    if (typeof v === 'object') { try { return JSON.stringify(v); } catch { return String(v); } }
    return String(v);
  };
  const truthy = v => !!v && !(Array.isArray(v) && v.length === 0) && !(typeof v === 'object' && v && !Array.isArray(v) && Object.keys(v).length === 0);

  const pyModules = {
    sys: {
      argv: [filename], version: '3.11.9', platform: 'linux', stdout: {}, stderr: {},
      exit: code => { throw { python: true, message: `SystemExit: ${code ?? 0}`, line: lineNo }; }
    },
    os: {
      getcwd: () => ctx.term?.cwd || '/home/operator',
      getenv: k => (ctx.term?.env?.[k] ?? ''),
      listdir: () => [],
      path: {
        join: (...p) => p.join('/').replace(/\/+/g, '/'),
        basename: p => String(p).split('/').filter(Boolean).pop() || '',
        dirname: p => String(p).split('/').slice(0, -1).join('/') || '/',
        exists: () => false
      }
    },
    math: {
      sqrt: Math.sqrt, floor: Math.floor, ceil: Math.ceil, pow: Math.pow, log: Math.log,
      log10: Math.log10, sin: Math.sin, cos: Math.cos, tan: Math.tan, pi: Math.PI, e: Math.E,
      inf: Infinity, isfinite: Number.isFinite
    },
    random: {
      random: () => Math.random(),
      randint: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
      choice: a => a[Math.floor(Math.random() * a.length)],
      shuffle: a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return null; },
      seed: () => null
    },
    json: { dumps: o => JSON.stringify(o), loads: s => JSON.parse(s) },
    time: { time: () => Date.now() / 1000, sleep: () => null, strftime: () => new Date().toISOString() },
    re: {
      match: (p, s) => new RegExp(p).exec(s),
      search: (p, s) => new RegExp(p).exec(s),
      sub: (p, r, s) => String(s).replace(new RegExp(p, 'g'), r),
      findall: (p, s) => [...String(s).matchAll(new RegExp(p, 'g'))].map(m => m[1] ?? m[0])
    },
    hashlib: { sha256: () => ({ hexdigest: () => 'f'.repeat(64) }) }
  };

  const builtins = {
    len: x => x == null ? 0 : (Array.isArray(x) || typeof x === 'string') ? x.length : Object.keys(x).length,
    range: (a, b, c) => { if (b === undefined) { b = a; a = 0; } c = c || 1; const r = []; for (let i = a; c > 0 ? i < b : i > b; i += c) r.push(i); return r; },
    str: x => fmt(x), int: (x, radix) => parseInt(x, radix || 10), float: x => parseFloat(x),
    abs: Math.abs, round: (x, n) => { const f = 10 ** (n || 0); return Math.round(x * f) / f; },
    min: (...a) => Array.isArray(a[0]) ? Math.min(...a[0]) : Math.min(...a),
    max: (...a) => Array.isArray(a[0]) ? Math.max(...a[0]) : Math.max(...a),
    sum: (arr, start = 0) => arr.reduce((a, b) => a + b, start),
    sorted: (arr, ...rest) => arr.slice().sort((a, b) => a - b),
    list: x => Array.from(x || []), bool: x => truthy(x), print: () => {},
    enumerate: (arr, start = 0) => arr.map((v, i) => [i + start, v]),
    zip: (...arrs) => arrs[0].map((_, i) => arrs.map(a => a[i])),
    dict: x => Object.assign({}, x),
    any: arr => arr.some(truthy), all: arr => arr.every(truthy),
    type: x => Array.isArray(x) ? 'list' : x === null ? 'NoneType' : typeof x,
    input: prompt => '',
    __append: (a, v) => { a.push(v); return null; },
    __extend: (a, v) => { a.push(...(Array.isArray(v) ? v : [v])); return null; },
    __insert: (a, i, v) => { a.splice(i, 0, v); return null; },
    __pop: (a, i) => i === undefined ? a.pop() : a.splice(i, 1)[0],
    __get: (o, k, d) => (o && o[k] !== undefined ? o[k] : (d ?? null)),
    __keys: o => Object.keys(o), __values: o => Object.values(o), __items: o => Object.entries(o)
  };

  function evalExpr(expr, sc) {
    let e = expr.trim();
    // f-strings
    e = e.replace(/(^|[^A-Za-z0-9_])f(["'])(.*?)\2/g, (m, pre, q, body) => {
      const pieces = body.replace(/\{([^}]+)\}/g, (mm, ex) => '${' + ex + '}');
      return pre + '`' + pieces.replace(/`/g, '\\`') + '`';
    });
    e = e.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null');
    e = e.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\s+/g, '!');
    // membership
    e = e.replace(/([A-Za-z_$][\w$]*(?:\([^)]*\))?|"[^"]*"|'[^']*')\s+not\s+in\s+([A-Za-z_$][\w$]*(?:\([^)]*\))?)/g, '!$2.includes($1)');
    e = e.replace(/([A-Za-z_$][\w$]*(?:\([^)]*\))?|"[^"]*"|'[^']*')\s+in\s+([A-Za-z_$][\w$]*(?:\([^)]*\))?)/g, '$2.includes($1)');
    // common Python string/list methods
    e = e.replace(/(\b[A-Za-z_$][\w$]*(?:\[[^\]]*\])?)\.append\(/g, '__append($1, ');
    e = e.replace(/(\b[A-Za-z_$][\w$]*(?:\[[^\]]*\])?)\.extend\(/g, '__extend($1, ');
    e = e.replace(/(\b[A-Za-z_$][\w$]*(?:\[[^\]]*\])?)\.insert\(/g, '__insert($1, ');
    e = e.replace(/(\b[A-Za-z_$][\w$]*(?:\[[^\]]*\])?)\.pop\(\)/g, '__pop($1)');
    e = e.replace(/(\b[A-Za-z_$][\w$]*(?:\[[^\]]*\])?)\.pop\(/g, '__pop($1, ');
    e = e.replace(/(\b[A-Za-z_$][\w$]*(?:\[[^\]]*\])?)\.get\(/g, '__get($1, ');
    e = e.replace(/(\b[A-Za-z_$][\w$]*(?:\[[^\]]*\])?)\.items\(\)/g, '__items($1)');
    e = e.replace(/(\b[A-Za-z_$][\w$]*(?:\[[^\]]*\])?)\.keys\(\)/g, '__keys($1)');
    e = e.replace(/(\b[A-Za-z_$][\w$]*(?:\[[^\]]*\])?)\.values\(\)/g, '__values($1)');
    e = e.replace(/\.upper\(\)/g, '.toUpperCase()').replace(/\.lower\(\)/g, '.toLowerCase()');
    e = e.replace(/\.strip\(\)/g, '.trim()').replace(/\.lstrip\(\)/g, '.trimStart()').replace(/\.rstrip\(\)/g, '.trimEnd()');
    e = e.replace(/\.startswith\(/g, '.startsWith(').replace(/\.endswith\(/g, '.endsWith(');
    e = e.replace(/\.title\(\)/g, '.replace(/\\b\\w/g, c => c.toUpperCase())');
    e = e.replace(/(["'][^"']*["'])\.join\(([^)]*)\)/g, '$2.join($1)');
    const names = Object.keys(sc).filter(n => /^[A-Za-z_$][\w$]*$/.test(n) && !['in', 'is', 'class', 'for', 'if', 'else', 'return', 'new', 'delete', 'typeof', 'void', 'with', 'this', 'function'].includes(n));
    const vals = names.map(n => sc[n]);
    const bnames = Object.keys(builtins);
    const bvals = bnames.map(n => builtins[n]);
    try {
      const fn = new Function(...names, ...bnames, `"use strict"; return (${e});`);
      return fn(...vals, ...bvals);
    } catch (err) {
      throw { python: true, message: err.message, expr: expr };
    }
  }

  function bodyRange(start, indent) {
    let j = start;
    while (j < lines.length && (lines[j].trim() === '' || lines[j].match(/^\s*/)[0].length > indent)) j++;
    return j;
  }

  function execBlock(start, indent, sc, flow) {
    let i = start;
    while (i < lines.length) {
      if (flow.returned) return i;
      const raw = lines[i];
      lineNo = i + 1;
      if (!raw.trim()) { i++; continue; }
      const ind = raw.match(/^\s*/)[0].length;
      if (ind < indent) return i;
      if (ind > indent) throw { python: true, message: 'unexpected indent', line: i + 1 };
      let code = stripPyComment(raw.trim());
      if (!code || code.startsWith('#')) { i++; continue; }

      if (code.startsWith('import ')) {
        const im = code.match(/^import\s+([\w.]+)(?:\s+as\s+(\w+))?$/);
        if (im) {
          const mod = pyModules[im[1]];
          sc[im[2] || im[1].split('.')[0]] = mod || {};
        }
        i++; continue;
      }
      if (code.startsWith('from ')) {
        const fm = code.match(/^from\s+([\w.]+)\s+import\s+(.+)$/);
        if (fm) {
          const mod = pyModules[fm[1]] || {};
          for (const part of splitArgs(fm[2])) {
            const [name, alias] = part.split(/\s+as\s+/);
            sc[(alias || name).trim()] = mod[name.trim()];
          }
        }
        i++; continue;
      }

      if (code.startsWith('def ')) {
        const m = code.match(/^def\s+(\w+)\s*\((.*?)\)\s*:$/);
        if (!m) { i++; continue; }
        const params = splitArgs(m[2]).map(p => {
          const eq = p.indexOf('=');
          return eq >= 0 ? { name: p.slice(0, eq).trim(), def: p.slice(eq + 1).trim() } : { name: p.trim() };
        }).filter(p => p.name);
        let bodyStart = i + 1;
        while (bodyStart < lines.length && !lines[bodyStart].trim()) bodyStart++;
        const bodyIndent = bodyStart < lines.length ? lines[bodyStart].match(/^\s*/)[0].length : indent + 4;
        const j = bodyRange(bodyStart, indent);
        const fn = (...args) => {
          const local = { ...sc };
          params.forEach((p, idx) => {
            local[p.name] = args[idx] !== undefined ? args[idx] : (p.def !== undefined ? evalExpr(p.def, sc) : null);
          });
          const inner = { returned: false, ret: undefined, broken: false, continued: false };
          execBlock(bodyStart, Math.max(bodyIndent, indent + 1), local, inner);
          return inner.ret;
        };
        sc[m[1]] = fn;
        i = j; continue;
      }

      if (code.startsWith('for ') && code.endsWith(':')) {
        const m = code.match(/^for\s+(.+?)\s+in\s+(.+):$/);
        if (!m) throw { python: true, message: 'invalid for statement', line: i + 1 };
        const iterable = evalExpr(m[2], sc);
        const arr = Array.isArray(iterable) ? iterable : typeof iterable === 'string' ? iterable.split('') : iterable && typeof iterable === 'object' ? Object.keys(iterable) : [];
        const targets = m[1].split(',').map(s => s.trim());
        const bodyStart = i + 1;
        const j = bodyRange(bodyStart, indent);
        for (const val of arr) {
          if (targets.length > 1) targets.forEach((t, k) => sc[t] = Array.isArray(val) ? val[k] : null);
          else sc[targets[0]] = val;
          execBlock(bodyStart, indent + 4, sc, flow);
          if (flow.returned) return j;
          if (flow.broken) { flow.broken = false; break; }
          flow.continued = false;
        }
        i = j; continue;
      }

      if (code.startsWith('while ') && code.endsWith(':')) {
        const cond = code.slice(6, -1);
        const bodyStart = i + 1;
        const j = bodyRange(bodyStart, indent);
        let guard = 0;
        while (guard++ < 1000 && truthy(evalExpr(cond, sc))) {
          execBlock(bodyStart, indent + 4, sc, flow);
          if (flow.returned) return j;
          if (flow.broken) { flow.broken = false; break; }
          flow.continued = false;
        }
        i = j; continue;
      }

      if (code.startsWith('if ') && code.endsWith(':')) {
        let cond = code.slice(3, -1);
        let bodyStart = i + 1;
        let j = bodyRange(bodyStart, indent);
        let chosen = truthy(evalExpr(cond, sc));
        if (chosen) execBlock(bodyStart, indent + 4, sc, flow);
        if (flow.returned) return j;
        while (j < lines.length && /^elif\s+.+:$/.test(lines[j].trim()) && lines[j].match(/^\s*/)[0].length === indent) {
          const econd = lines[j].trim().slice(5, -1);
          bodyStart = j + 1;
          j = bodyRange(bodyStart, indent);
          if (!chosen && truthy(evalExpr(econd, sc))) { execBlock(bodyStart, indent + 4, sc, flow); chosen = true; }
          if (flow.returned) return j;
        }
        if (j < lines.length && lines[j].trim() === 'else:' && lines[j].match(/^\s*/)[0].length === indent) {
          bodyStart = j + 1;
          j = bodyRange(bodyStart, indent);
          if (!chosen) execBlock(bodyStart, indent + 4, sc, flow);
        }
        i = j; continue;
      }

      if (/^print\s*\(/.test(code)) {
        const m = code.match(/^print\s*\((.*)\)$/s);
        if (!m) throw { python: true, message: 'invalid print call', line: i + 1 };
        const parts = splitArgs(m[1]);
        const vals = [];
        let end = '\n', sep = ' ';
        for (const p of parts) {
          const kw = p.match(/^(\w+)\s*=\s*(.+)$/s);
          if (kw && ['sep', 'end', 'file', 'flush'].includes(kw[1])) {
            if (kw[1] === 'end') end = String(evalExpr(kw[2], sc));
            else if (kw[1] === 'sep') sep = String(evalExpr(kw[2], sc));
          } else vals.push(evalExpr(p, sc));
        }
        const text = vals.map(fmt).join(sep);
        if (end === '\n') out.push(text);
        else if (out.length) out[out.length - 1] += text + end;
        else out.push(text + end);
        i++; continue;
      }

      if (code === 'break') { flow.broken = true; return i; }
      if (code === 'continue') { flow.continued = true; return i; }
      if (code === 'pass') { i++; continue; }
      if (code.startsWith('return')) {
        const rest = code.slice(6).trim();
        flow.ret = rest ? evalExpr(rest, sc) : null;
        flow.returned = true;
        return i;
      }

      const tupleAssign = code.match(/^([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)+)\s*=\s*(.+)$/);
      if (tupleAssign) {
        const names = tupleAssign[1].split(',').map(s => s.trim());
        const vals = splitArgs(tupleAssign[2]).map(v => evalExpr(v, sc));
        names.forEach((n, k) => sc[n] = vals[k] ?? null);
        i++; continue;
      }
      const idxAssign = code.match(/^([A-Za-z_]\w*)\[([^\]]+)\]\s*(\+=|-=|\*=|\/=|=)\s*(.+)$/);
      if (idxAssign) {
        const [, name, idx, op, rhs] = idxAssign;
        const key = evalExpr(idx, sc);
        const val = evalExpr(rhs, sc);
        if (!sc[name]) sc[name] = {};
        if (op === '=') sc[name][key] = val;
        else if (op === '+=') sc[name][key] = (sc[name][key] || 0) + val;
        else if (op === '-=') sc[name][key] = (sc[name][key] || 0) - val;
        else if (op === '*=') sc[name][key] = (sc[name][key] || 0) * val;
        else if (op === '/=') sc[name][key] = (sc[name][key] || 0) / val;
        i++; continue;
      }
      const assign = code.match(/^([A-Za-z_]\w*)\s*(\+=|-=|\*=|\/=|=)\s*(.+)$/);
      if (assign) {
        const [, name, op, rhs] = assign;
        const val = evalExpr(rhs, sc);
        if (op === '=') sc[name] = val;
        else if (op === '+=') sc[name] = (sc[name] || 0) + val;
        else if (op === '-=') sc[name] = (sc[name] || 0) - val;
        else if (op === '*=') sc[name] = (sc[name] || 0) * val;
        else if (op === '/=') sc[name] = (sc[name] || 0) / val;
        i++; continue;
      }
      if (/^[A-Za-z_$][\w$]*(?:\.[\w$]+)*\s*\(.*\)$/.test(code)) { evalExpr(code, sc); i++; continue; }
      i++;
    }
    return i;
  }

  try {
    const flow = { returned: false, ret: undefined, broken: false, continued: false };
    execBlock(0, 0, scope, flow);
    ctx.game.stats.codeLines += source.split('\n').length;
    if (out.length) ctx.print(out.join('\n'));
    else ctx.dim(`(${filename} produced no output)`);
    checkAchievements(ctx.game);
  } catch (err) {
    if (err.python) {
      ctx.err(`  File "${filename}", line ${err.line || lineNo}`);
      ctx.err(`    ${err.message}`);
      if (err.expr) ctx.dim(`    expression: ${err.expr}`);
    } else {
      ctx.err(`  File "${filename}", line ${lineNo}`);
      ctx.err(`    ${err.message}`);
    }
    ctx.print('Traceback (most recent call last):', 'dim');
    ctx.print('  [simulated runtime]', 'dim');
  }
}
function stripPyComment(s) {
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === quote && s[i - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '#') return s.slice(0, i).trimEnd();
  }
  return s;
}
function splitArgs(s) {
  const out = []; let cur = '', quote = null, depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) { cur += c; if (c === quote && s[i - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    if (c === ')' || c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/* ---------------- Bash subset ---------------- */
async function runBash(ctx, source, filename) {
  const lines = source.replace(/\r/g, '').split('\n');
  let vars = { ...(ctx.term.env || {}) };
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line || line.startsWith('#!') || line.startsWith('#')) continue;
    if (line.startsWith('for ')) {
      const m = line.match(/^for\s+(\w+)\s+in\s+(.+?)(?:;\s*do)?$/);
      if (m && (line.includes('do') || lines[i + 1]?.trim() === 'do')) {
        const values = m[2].split(/\s+/).filter(Boolean);
        let j = i + 1;
        if (lines[j]?.trim() === 'do') j++;
        const body = [];
        while (j < lines.length && lines[j].trim() !== 'done') { body.push(lines[j]); j++; }
        for (const val of values) {
          for (const b of body) {
            const sub = b.replace(new RegExp('\\$\\{' + m[1] + '\\}|\\$' + m[1] + '\\b', 'g'), val);
            await execute(ctx.app, ctx.term, sub);
          }
        }
        i = j;
        continue;
      }
    }
    if (line.startsWith('if ') && line.endsWith('; then')) {
      // Skip a trivial if-block; execute the body only if the condition is a file test that passes.
      let j = i + 1;
      const body = [];
      while (j < lines.length && lines[j].trim() !== 'fi') { body.push(lines[j]); j++; }
      const test = line.match(/^if\s+\[(.*)\];\s*then/);
      let pass = true;
      if (test) {
        const parts = test[1].trim().split(/\s+/);
        if (parts[0] === '-f') pass = !!getNode(ctx.fs(), pathFor(ctx.term, parts[1]));
        else if (parts[0] === '-d') pass = isDir(ctx.fs(), pathFor(ctx.term, parts[1]));
      }
      if (pass) for (const b of body) await execute(ctx.app, ctx.term, expandBash(b, vars, ctx));
      i = j;
      continue;
    }
    if (line.startsWith('while ') || line === 'done' || line === 'fi') continue;
    const assign = line.match(/^(?:export\s+)?([A-Za-z_]\w*)=(.*)$/);
    if (assign) {
      let val = assign[2].replace(/^["']|["']$/g, '');
      val = expandBash(val, vars, ctx);
      vars[assign[1]] = val;
      ctx.term.env = ctx.term.env || {};
      if (line.startsWith('export')) ctx.term.env[assign[1]] = val;
      continue;
    }
    if (line.startsWith('echo ')) {
      let text = line.slice(5);
      text = expandBash(text, vars, ctx);
      ctx.print(text);
      continue;
    }
    if (line.startsWith('printf ')) {
      let text = line.slice(7).trim().replace(/^["']|["']$/g, '');
      text = expandBash(text, vars, ctx).replace(/\\n/g, '\n');
      ctx.print(text);
      continue;
    }
    line = expandBash(line, vars, ctx);
    await execute(ctx.app, ctx.term, line);
  }
}
function expandBash(text, vars, ctx) {
  let out = text.replace(/\$\(([^)]+)\)/g, (m, cmd) => {
    const c = cmd.trim();
    if (c === 'date') return new Date().toUTCString();
    if (c.startsWith('uptime')) return 'up 3 days, 4:12';
    if (c === 'whoami') return userOf(ctx.term);
    if (c === 'pwd') return ctx.term.cwd;
    if (c === 'hostname') return hostOf(ctx.term);
    if (c.startsWith('cat ')) return readFile(ctx.fs(), pathFor(ctx.term, c.slice(4).trim())) || '';
    return '';
  });
  out = out.replace(/\$\{([A-Za-z_]\w*)\}|\$([A-Za-z_]\w*)/g, (m, a, b) => {
    const k = a || b;
    return vars[k] ?? ctx.term.env?.[k] ?? '';
  });
  return out;
}

/* ---------------- Git ---------------- */
function gitRoot(ctx) {
  let p = ctx.term.cwd;
  while (true) {
    if (getNode(ctx.fs(), joinPath(p, '.git/repo.json'))) return p;
    if (p === '/') return null;
    p = dirname(p);
  }
}
function gitRepo(ctx, root) {
  const node = getNode(ctx.fs(), joinPath(root, '.git/repo.json'));
  if (!node) return null;
  try { return JSON.parse(node.content); } catch { return null; }
}
function saveRepo(ctx, root, repo) {
  writeFile(ctx.fs(), joinPath(root, '.git/repo.json'), JSON.stringify(repo, null, 2), { owner: userOf(ctx.term) });
}
COMMANDS.git = (ctx) => {
  const sub = ctx.args[0];
  const root = gitRoot(ctx);
  if (sub === 'init') {
    const p = pathFor(ctx.term, ctx.args[1] || '.');
    ensureDir(ctx.fs(), joinPath(p, '.git'), userOf(ctx.term));
    saveRepo(ctx, p, { branch: 'main', staged: [], commits: [], remote: null });
    ctx.print(`Initialized empty Git repository in ${joinPath(p, '.git')}/`, 'ok');
    return;
  }
  if (sub === 'clone') {
    const url = ctx.args[1];
    if (!url) { ctx.err('fatal: You must specify a repository to clone.'); return; }
    const name = url.replace(/\/$/, '').split('/').pop().replace(/\.git$/, '');
    const repo = ctx.game.repos.find(r => r.name === name);
    if (!repo) { ctx.err(`Cloning into '${name}'...`); ctx.err(`fatal: repository '${url}' not found`); return; }
    const dest = pathFor(ctx.term, name);
    if (getNode(ctx.fs(), dest)) { ctx.err(`fatal: destination path '${name}' already exists and is not an empty directory.`); return; }
    ensureDir(ctx.fs(), dest, userOf(ctx.term));
    for (const [p, content] of Object.entries(repo.files)) writeFile(ctx.fs(), joinPath(dest, p), content, { owner: userOf(ctx.term) });
    ensureDir(ctx.fs(), joinPath(dest, '.git'), userOf(ctx.term));
    saveRepo(ctx, dest, { branch: 'main', staged: [], commits: [{ hash: Math.random().toString(16).slice(2, 9), message: 'initial import', time: Date.now(), files: Object.keys(repo.files) }], remote: url });
    ctx.print(`Cloning into '${name}'...`);
    ctx.print('remote: Enumerating objects: 42, done.');
    ctx.print('remote: Counting objects: 100% (42/42), done.');
    ctx.print(`Receiving objects: 100% (42/42), ${(repo.files['README.md']?.length || 1200)} bytes | 1.2 MiB/s, done.`);
    ctx.ok(`Repository cloned to ~/${name}`);
    return;
  }
  if (!root) { ctx.err('fatal: not a git repository (or any of the parent directories): .git'); return; }
  const repo = gitRepo(ctx, root);
  if (sub === 'status') {
    const files = allFiles(ctx.fs(), root).filter(f => !f.path.includes('/.git/')).map(f => f.path.slice(root.length + 1));
    const untracked = files.filter(f => !repo.staged.includes(f) && !repo.commits.some(c => c.files.includes(f)));
    ctx.print(`On branch ${repo.branch}`, 'accent');
    if (!repo.commits.length) ctx.print('\nNo commits yet');
    if (repo.staged.length) { ctx.print('\nChanges to be committed:'); for (const f of repo.staged) ctx.print(`  new file:   ${f}`, 'ok'); }
    if (untracked.length) { ctx.print('\nUntracked files:'); for (const f of untracked) ctx.print(`  ${f}`, 'err'); }
    if (!repo.staged.length && !untracked.length) ctx.print('nothing to commit, working tree clean');
    return;
  }
  if (sub === 'add') {
    const target = ctx.args[1] || '.';
    const files = target === '.'
      ? allFiles(ctx.fs(), root).filter(f => !f.path.includes('/.git/')).map(f => f.path.slice(root.length + 1))
      : [normalize(resolvePath(ctx.term.cwd, target)).replace(root + '/', '')];
    repo.staged = [...new Set([...repo.staged, ...files])];
    saveRepo(ctx, root, repo);
    ctx.dim(`staged ${files.length} file(s)`);
    return;
  }
  if (sub === 'commit') {
    const mi = ctx.args.indexOf('-m');
    const msg = mi >= 0 ? ctx.args.slice(mi + 1).join(' ') : 'update';
    if (!repo.staged.length) { ctx.err('On branch ' + repo.branch); ctx.err('nothing added to commit but untracked files present'); return; }
    const hash = Math.random().toString(16).slice(2, 9);
    repo.commits.push({ hash, message: msg, time: Date.now(), files: repo.staged.slice() });
    const n = repo.staged.length;
    repo.staged = [];
    saveRepo(ctx, root, repo);
    ctx.print(`[${repo.branch} ${hash}] ${msg}`, 'ok');
    ctx.print(` ${n} file(s) changed`, 'dim');
    return;
  }
  if (sub === 'log') {
    if (!repo.commits.length) { ctx.dim('fatal: your current branch does not have any commits yet'); return; }
    for (const c of repo.commits.slice().reverse()) {
      ctx.print(`commit ${c.hash}${c.hash}${c.hash}${c.hash}`, 'warn');
      ctx.print(`Author: ${userOf(ctx.term)} <${userOf(ctx.term)}@voidbox>`);
      ctx.print(`Date:   ${new Date(c.time).toUTCString()}`);
      ctx.print('');
      ctx.print(`    ${c.message}`, 'accent');
      ctx.print('');
    }
    return;
  }
  if (sub === 'remote') {
    if (ctx.args[1] === 'add') { repo.remote = ctx.args[3]; saveRepo(ctx, root, repo); ctx.dim(`remote ${ctx.args[2]} → ${repo.remote}`); }
    else ctx.print(repo.remote || '(no remotes)', 'dim');
    return;
  }
  if (sub === 'push') { ctx.print('Enumerating objects: 5, done.'); ctx.print('Writing objects: 100% (5/5), 1.2 KiB | 1.2 MiB/s, done.'); ctx.ok(`branch '${repo.branch}' pushed to ${repo.remote || 'origin'}`); return; }
  if (sub === 'pull') { ctx.print('Already up to date.', 'ok'); return; }
  if (sub === 'branch') {
    if (ctx.args[1] && !ctx.args[1].startsWith('-')) { ctx.dim(`created branch ${ctx.args[1]}`); return; }
    ctx.print(`* ${repo.branch}`, 'ok');
    return;
  }
  if (sub === 'checkout') {
    if (ctx.args[1] === '-b' && ctx.args[2]) { repo.branch = ctx.args[2]; saveRepo(ctx, root, repo); ctx.ok(`Switched to a new branch '${repo.branch}'`); }
    else if (ctx.args[1]) { repo.branch = ctx.args[1]; saveRepo(ctx, root, repo); ctx.ok(`Switched to branch '${repo.branch}'`); }
    return;
  }
  if (sub === 'diff') { ctx.print('diff --git a/README.md b/README.md\nindex 3f2a1c..9b4e2d 100644\n--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-working\n+working, with notes', 'dim'); return; }
  ctx.err(`git: '${sub}' is not a git command. See 'git --help'.`);
};

/* ---------------- SQLite ---------------- */
COMMANDS.sqlite3 = (ctx) => {
  if (!checkInstalled(ctx, 'sqlite3')) return;
  const db = ctx.args[0];
  const sql = ctx.args.slice(1).join(' ').replace(/^["']|["']$/g, '');
  if (!db) { ctx.err('Usage: sqlite3 FILENAME [SQL]'); return; }
  if (db === '--version' || db === '-version' || db === '-v') {
    ctx.print('SQLite version 3.40.1 2026-02-01 09:12:44');
    return;
  }
  if (db === '--help' || db === '-help' || db === '-h') {
    ctx.print('Usage: sqlite3 [OPTIONS] FILENAME [SQL]\nFILENAME is the name of an SQLite database. A new database is created\nif the file does not previously exist. OPTIONS include:\n  --version   show SQLite version\n  -help       show this message');
    return;
  }
  const abs = pathFor(ctx.term, db);
  let node = getNode(ctx.fs(), abs);
  if (!node) {
    node = writeFile(ctx.fs(), abs, '', { owner: userOf(ctx.term) });
    ctx.dim(`Created ${db}`);
  }
  const content = node.content || '';
  const tables = parseSqlTables(content);
  if (!sql) {
    ctx.print(`SQLite version 3.40.1 2026-02-01 09:12:44`);
    ctx.dim(`Connected to ${db}. Tables: ${Object.keys(tables).join(', ') || '(none)'}`);
    return;
  }
  if (sql === '.tables') { ctx.print(Object.keys(tables).join(' ') || '(no tables)'); return; }
  if (sql === '.schema') {
    for (const [name, t] of Object.entries(tables)) ctx.print(`CREATE TABLE ${name} (${t.cols.join(', ')});`);
    return;
  }
  const select = sql.match(/^select\s+(.+?)\s+from\s+(\w+)/i);
  if (select) {
    const cols = select[1].trim() === '*' ? null : select[1].split(',').map(s => s.trim());
    const table = tables[select[2]];
    if (!table) { ctx.err(`Error: no such table: ${select[2]}`); return; }
    const use = cols || table.cols;
    ctx.print(use.join('|'));
    for (const row of table.rows) ctx.print(use.map(c => row[c] ?? '').join('|'));
    return;
  }
  const insert = sql.match(/^insert\s+into\s+(\w+)\s+values\s*\((.*)\)/i);
  if (insert) {
    const table = tables[insert[1]];
    if (!table) { ctx.err(`Error: no such table: ${insert[1]}`); return; }
    const vals = splitArgs(insert[2]).map(v => v.replace(/^['"]|['"]$/g, ''));
    const row = {}; table.cols.forEach((c, i) => row[c] = vals[i]);
    table.rows.push(row);
    node.content = content + `\nINSERT INTO ${insert[1]} VALUES (${vals.map(v => `'${v}'`).join(',')});`;
    ctx.dim('1 row inserted');
    return;
  }
  if (/^create\s+table/i.test(sql)) {
    const m = sql.match(/create\s+table\s+(\w+)\s*\((.*)\)/i);
    if (m) { node.content = content + '\n' + sql + ';'; ctx.dim(`table ${m[1]} created`); }
    return;
  }
  ctx.dim('Query executed. (simulated SQLite: SELECT, INSERT, CREATE TABLE supported)');
};
function parseSqlTables(content) {
  const tables = {};
  const createRe = /CREATE\s+TABLE\s+(\w+)\s*\(([^;]+)\)/gi;
  let m;
  while ((m = createRe.exec(content))) {
    const cols = m[2].split(',').map(c => c.trim().split(/\s+/)[0]).filter(Boolean);
    tables[m[1]] = { cols, rows: [] };
  }
  const insertRe = /INSERT\s+INTO\s+(\w+)\s+VALUES\s*\(([^;]+)\)/gi;
  while ((m = insertRe.exec(content))) {
    const t = tables[m[1]];
    if (!t) continue;
    const vals = splitArgs(m[2]).map(v => v.trim().replace(/^['"]|['"]$/g, ''));
    const row = {}; t.cols.forEach((c, i) => row[c] = vals[i]); t.rows.push(row);
  }
  if (!Object.keys(tables).length && content.trim()) {
    tables.data = { cols: ['value'], rows: content.split('\n').filter(Boolean).map(l => ({ value: l })) };
  }
  return tables;
}



/* ============================================================
   ECONOMY, WORK, SOCIAL, WORLD — the persistent-game commands
   ============================================================ */

function contractLine(c) {
  const left = `${pad(c.id, 7)} ${pad(fmtMoney(c.pay), 9)} ${pad('D' + c.difficulty, 4)} ${pad(c.status.toUpperCase(), 7)}`;
  return `${left} ${pad('@' + c.clientHandle, 13)} ${c.title}`;
}

COMMANDS.contracts = (ctx) => {
  if (ctx.args[0] && getContract(ctx.game, ctx.args[0])) {
    return showContract(ctx, getContract(ctx.game, ctx.args[0]));
  }
  const filter = (ctx.args[0] || 'open').toLowerCase();
  let list = ctx.game.contracts.slice();
  if (filter !== 'all') list = list.filter(c => c.status === filter);
  list.sort((a, b) => (a.status === b.status ? b.pay - a.pay : a.status.localeCompare(b.status)));
  ctx.head(`CONTRACT BOARD — ${filter.toUpperCase()}`);
  ctx.dim('Work is a promise. Read the objective. Deliver the artifact.');
  ctx.print('');
  if (!list.length) {
    ctx.dim(`No ${filter} contracts. New work appears as the world advances.`);
    return;
  }
  ctx.print(`ID      PAY       DIFF STATUS  CLIENT        TITLE`, 'dim');
  for (const c of list) {
    const cls = c.status === 'active' ? 'info' : c.status === 'done' ? 'ok' : c.status === 'failed' ? 'err' : 'accent';
    ctx.print(contractLine(c), cls);
  }
  ctx.print('');
  const active = ctx.game.contracts.filter(c => c.status === 'active');
  if (active.length) {
    ctx.dim('Your active work:');
    for (const c of active) {
      const ready = objectiveSatisfied(ctx.game, c);
      ctx.print(`  ${c.id}  ${c.title}  ${ready ? '[ready to submit]' : '· ' + (c.objective.hint || '')}`, ready ? 'ok' : 'dim');
    }
  }
  ctx.dim('accept <id>   submit <id>   contracts all');
};

function showContract(ctx, c) {
  const client = ctx.game.npcs.find(n => n.id === c.clientId);
  const ready = c.status === 'active' && objectiveSatisfied(ctx.game, c);
  ctx.head(`${c.id} — ${c.title}`);
  ctx.print(`Client:     @${c.clientHandle}${client ? ' · ' + client.name : ''}`, 'accent');
  ctx.print(`Status:     ${c.status.toUpperCase()}${ready ? ' · objective satisfied' : ''}`, ready ? 'ok' : '');
  ctx.print(`Pay:        ${fmtMoney(c.pay)}${c.bonus ? ' + ' + fmtMoney(c.bonus) + ' bonus' : ''}`, 'ok');
  ctx.print(`Difficulty: ${c.difficulty}/5   Tags: ${c.tags.join(', ')}`, 'dim');
  ctx.print('');
  ctx.print(c.desc);
  ctx.print('');
  ctx.print('OBJECTIVE', 'head');
  ctx.print('  ' + c.objective.label);
  if (c.objective.hint) ctx.dim('  hint: ' + c.objective.hint);
  ctx.print('');
  const cw = worldClock(ctx.game);
  const dl = worldClock({ ...ctx.game, worldMinutes: c.deadlineWorld });
  ctx.dim(`Deadline: cycle ${dl.cycle} ${dl.hh}:${dl.mm} · current cycle ${cw.cycle} ${cw.hh}:${cw.mm}`);
  if (c.status === 'open') ctx.info(`Accept with: accept ${c.id}`);
  if (c.status === 'active') ctx.info(`Deliver with: submit ${c.id}`);
}

COMMANDS.accept = (ctx) => {
  const c = getContract(ctx.game, ctx.args[0]);
  if (!c) { ctx.err('usage: accept <contract-id>'); return; }
  const r = acceptContract(ctx.game, c);
  if (!r.ok) { ctx.err(r.error); return; }
  ctx.ok(`Accepted ${c.id} — ${c.title}`);
  ctx.print(`Objective: ${c.objective.label}`);
  if (c.objective.hint) ctx.dim(`Hint: ${c.objective.hint}`);
  ctx.app.refreshUI?.();
};

COMMANDS.submit = (ctx) => {
  const c = getContract(ctx.game, ctx.args[0]);
  if (!c) { ctx.err('usage: submit <contract-id>'); return; }
  const r = submitContract(ctx.game, c);
  if (!r.ok) { ctx.err(r.error); return; }
  ctx.ok(`Delivered ${c.id}. Payment ${fmtMoney(r.pay)}. Reputation +${r.rep}.`);
  ctx.dim('The client has been notified. Check your mail.');
  ctx.app.refreshUI?.();
};

COMMANDS.bank = (ctx) => {
  const p = ctx.game.player;
  ctx.head('OPERATOR ACCOUNT');
  ctx.print(`Balance:    ${fmtMoney(p.money)}`, 'ok');
  ctx.print(`Net worth:  ${fmtMoney(netWorth(ctx.game))}`, 'accent');
  ctx.print(`Earned:     ${fmtMoney(ctx.game.stats.earned)}`, 'dim');
  ctx.print(`Spent:      ${fmtMoney(ctx.game.stats.spent)}`, 'dim');
  ctx.print('');
  const tx = p.transactions.slice(0, ctx.args[0] === 'history' ? 20 : 6);
  if (!tx.length) ctx.dim('No transactions yet. The board is open.');
  else {
    ctx.print('RECENT ACTIVITY', 'head');
    for (const t of tx) {
      const sign = t.amount >= 0 ? '+' : '';
      ctx.print(`  ${fmtDateTime(t.time)}  ${pad(sign + fmtMoney(t.amount), 11)}  ${t.memo || ''}`, t.amount >= 0 ? 'ok' : 'accent');
    }
  }
  ctx.dim('bank history   ·   contracts   ·   market');
};

COMMANDS.market = (ctx) => {
  const sub = (ctx.args[0] || '').toLowerCase();
  if (sub === 'contracts' || sub === 'work' || sub === 'jobs') return COMMANDS.contracts(ctx);
  if (['infra', 'tools', 'services', 'training', 'shop'].includes(sub)) {
    const kinds = sub === 'shop' ? ['infra', 'tool', 'service', 'training'] : [sub === 'infra' ? 'infra' : sub === 'tools' ? 'tool' : sub === 'services' ? 'service' : 'training'];
    ctx.head('NULLNET MARKET');
    ctx.dim('Infrastructure, tools, and services for independent operators.');
    ctx.print('');
    for (const item of SHOP_ITEMS.filter(i => kinds.includes(i.kind))) {
      ctx.print(`${pad(item.id, 14)} ${pad(fmtMoney(item.price), 8)} ${pad(item.recurring ? '/mo' : 'once', 5)} ${item.name}`, 'accent');
      ctx.dim(`  ${item.desc}`);
    }
    ctx.print('');
    ctx.dim('buy <item-id>   ·   market contracts');
    return;
  }
  if (sub === 'index') {
    const m = ctx.game.market;
    ctx.head('NETWORK MARKET INDEX');
    ctx.print(`Index:     ${marketIndex(ctx.game)}`, 'ok');
    ctx.print(`Sentiment: ${m.sentiment}`, m.sentiment === 'bullish' ? 'ok' : m.sentiment === 'bearish' ? 'warn' : 'dim');
    ctx.print(`Volume:    ${fmtNum(m.volume)}`);
    ctx.print(`History:   ${m.history.slice(-12).join('  ')}`, 'dim');
    return;
  }
  ctx.head('NULLNET MARKET');
  ctx.print(`Index ${marketIndex(ctx.game)} · ${ctx.game.market.sentiment} · volume ${fmtNum(ctx.game.market.volume)}`, 'ok');
  ctx.print('');
  ctx.print('INFRASTRUCTURE & TOOLS', 'head');
  for (const item of SHOP_ITEMS.slice(0, 10)) {
    ctx.print(`  ${pad(item.id, 14)} ${pad(fmtMoney(item.price), 8)} ${item.recurring ? '/mo ' : '    '} ${item.name}`, 'accent');
  }
  ctx.print('');
  ctx.dim('buy <item-id>   market infra   market tools   market contracts   market index');
};

COMMANDS.buy = (ctx) => {
  if (!ctx.args.length) {
    ctx.print('usage: buy <item-id>   ·   buy domain <name>', 'dim');
    ctx.print(SHOP_ITEMS.map(i => `${i.id} ${fmtMoney(i.price)}`).join('   '), 'dim');
    return;
  }
  if (ctx.args[0] === 'domain') {
    const name = ctx.args[1];
    if (!name) { ctx.err('usage: buy domain <name.example>'); return; }
    const r = registerDomain(ctx.game, name);
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`Registered ${r.domain} for ${fmtMoney(18)}.`);
    ctx.dim('Publish something with: deploy <dir> ' + r.domain);
    ctx.app.refreshUI?.();
    return;
  }
  const q = ctx.args[0].toLowerCase();
  const item = SHOP_ITEMS.find(i => i.id === q) || SHOP_ITEMS.find(i => i.name.toLowerCase().includes(q));
  if (!item) { ctx.err(`buy: unknown item '${ctx.args[0]}'`); ctx.dim('Try: market infra'); return; }
  const r = buyShopItem(ctx.game, item);
  if (!r.ok) { ctx.err(r.error); return; }
  ctx.ok(`Purchased ${item.name} for ${fmtMoney(item.price)}.`);
  if (r.server) {
    ctx.print(`Node provisioned: ${r.server.host} (${r.server.ip})`, 'accent');
    ctx.dim(`Connect with: ssh operator@${r.server.host}`);
  }
  ctx.dim(`Balance: ${fmtMoney(ctx.game.player.money)}`);
  ctx.app.refreshUI?.();
};

COMMANDS.deploy = (ctx) => {
  const dir = ctx.args[0] || '.';
  const domain = ctx.args[1];
  if (!domain) { ctx.err('usage: deploy <directory> <domain> [server]'); return; }
  const serverQ = ctx.args[2];
  const owned = ownedServers(ctx.game);
  if (!owned.length) { ctx.err('No owned server. Provision one with: buy vps-std'); return; }
  const server = serverQ ? owned.find(s => s.id === serverQ || s.host === serverQ || s.ip === serverQ) : owned[0];
  if (!server) { ctx.err(`deploy: no owned server matching '${serverQ}'`); return; }
  const r = deploySite(ctx.game, { domain, dir: pathFor(ctx.term, dir), serverId: server.id, title: domain });
  if (!r.ok) { ctx.err(r.error); return; }
  ctx.ok(`Published ${domain} on ${server.host} (${server.ip}) with ${r.files} file(s).`);
  ctx.dim('Open the browser to inspect it, or curl it from the terminal.');
  ctx.app.refreshUI?.();
};

COMMANDS.domains = (ctx) => {
  const domains = ctx.game.player.domains;
  ctx.head('REGISTERED DOMAINS');
  if (!domains.length) {
    ctx.dim('No domains. Register one with: buy domain quietfield.net');
    return;
  }
  for (const d of domains) {
    const site = ctx.game.sites.find(s => s.domain === d);
    ctx.print(`${pad(d, 34)} ${site ? (site.status === 'live' ? 'LIVE' : site.status.toUpperCase()) : 'unpublished'}`, site ? 'ok' : 'dim');
  }
};

COMMANDS.site = (ctx) => {
  if (ctx.args[0]) {
    const site = getSite(ctx.game, ctx.args[0]);
    if (!site) { ctx.err(`site: no such domain '${ctx.args[0]}'`); return; }
    ctx.head(site.title);
    ctx.print(`${site.domain} · ${site.category} · ${site.status}`, 'dim');
    ctx.print(site.desc);
    ctx.print('');
    for (const s of site.sections) {
      ctx.print(s.h, 'head');
      ctx.print(s.p);
      ctx.print('');
    }
    ctx.print(`visits ${fmtNum(site.visits)} · revenue ${fmtMoney(site.revenue)} · ${site.tech}`, 'dim');
    return;
  }
  const sites = playerSites(ctx.game);
  ctx.head('YOUR SITES');
  if (!sites.length) { ctx.dim('Nothing published yet. Buy a node, then: deploy <dir> <domain>'); return; }
  for (const s of sites) {
    const server = ctx.game.servers.find(x => x.id === s.serverId);
    ctx.print(`${pad(s.domain, 32)} ${pad(s.status, 8)} ${padLeft(fmtNum(s.visits), 7)} visits  ${fmtMoney(s.revenue)}`, 'accent');
    if (server) ctx.dim(`  ${server.host} · ${server.ip}`);
  }
};
COMMANDS.sites = (ctx) => COMMANDS.site(ctx);

COMMANDS.servers = (ctx) => {
  const all = ctx.args.includes('-a') || ctx.args.includes('--all');
  const list = all ? ctx.game.servers.slice() : ownedServers(ctx.game);
  ctx.head(all ? 'NETWORK INVENTORY' : 'YOUR SERVERS');
  if (!list.length) {
    ctx.dim('No owned infrastructure. Provision a node with: buy vps-std');
    ctx.dim('Inspect the whole network with: servers -a');
    return;
  }
  ctx.print(`HOST                    IP                ROLE                 STATUS      SEC  PLAN`, 'dim');
  const sorted = list.sort((a, b) => (a.owned === b.owned ? a.host.localeCompare(b.host) : a.owned ? -1 : 1));
  for (const s of sorted.slice(0, all ? 80 : 30)) {
    ctx.print(`${pad(s.host, 23)} ${pad(s.ip, 17)} ${pad(s.role, 20)} ${pad(s.status, 11)} ${padLeft(s.security, 3)}  ${s.owned ? (s.plan || 'owned') : ''}`, s.owned ? 'ok' : s.status === 'offline' ? 'dim' : 'accent');
  }
  if (all && sorted.length > 80) ctx.dim(`… ${sorted.length - 80} more hosts indexed`);
  ctx.print('');
  ctx.dim('nmap -sV <host> · ssh <user>@<host> · audit <host> · patch <host>');
};

COMMANDS.mail = (ctx) => {
  const game = ctx.game;
  const a = ctx.args[0];
  if (a === 'send') {
    const handle = ctx.args[1];
    const subject = ctx.args[2] || '(no subject)';
    const body = ctx.args.slice(3).join(' ');
    if (!handle) { ctx.err('usage: mail send <handle> <subject> [body]'); return; }
    return sendMailCommand(ctx, handle, subject, body);
  }
  if (a === 'read' || /^\d+$/.test(a || '')) {
    return readMailCommand(ctx, a === 'read' ? ctx.args[1] : a);
  }
  const sent = a === 'sent';
  const list = game.mail.filter(m => sent ? m.outbound : !m.outbound).sort((x, y) => y.time - x.time);
  ctx.head(sent ? 'SENT MAIL' : 'INBOX');
  ctx.print(`Unread: ${unreadMail(game)} · total: ${game.mail.length}`, 'dim');
  ctx.print('');
  if (!list.length) { ctx.dim(sent ? 'Nothing sent yet.' : 'No mail. The world will write when it has something to say.'); return; }
  for (const m of list.slice(0, 30)) {
    const who = sent ? 'to @' + m.to : '@' + m.from;
    const mark = !sent && !m.read ? '●' : ' ';
    ctx.print(`${mark} ${padLeft(m.id, 4)}  ${pad(who, 16)} ${pad(fmtTime(m.time), 6)}  ${m.subject}`, !sent && !m.read ? 'ok' : 'accent');
  }
  ctx.print('');
  ctx.dim('mail read <id>   mail sent   send <handle> <subject> <body>');
};

function readMailCommand(ctx, id) {
  const m = ctx.game.mail.find(x => String(x.id) === String(id));
  if (!m) { ctx.err(`mail: no message ${id}`); return; }
  if (!m.outbound) m.read = true;
  ctx.head(m.subject);
  ctx.print(`From: @${m.from}   To: @${m.to}   ${fmtDateTime(m.time)}`, 'dim');
  ctx.print('');
  ctx.print(m.body || '(empty message)', 'accent');
  ctx.print('');
  ctx.dim(`Reply with: send ${m.outbound ? m.to : m.from} "re: ${m.subject}" <body>`);
  checkAchievements(ctx.game);
  ctx.app.refreshUI?.();
}
COMMANDS.read = (ctx) => readMailCommand(ctx, ctx.args[0]);

function sendMailCommand(ctx, handle, subject, body) {
  if (!body) body = 'Message sent from the terminal.';
  const r = sendPlayerMail(ctx.game, handle, subject, body);
  if (!r.ok) { ctx.err(r.error); return; }
  ctx.ok(`Sent to @${r.npc.handle} — "${subject}"`);
  ctx.dim('The world advances in the background. Replies arrive when they arrive.');
  ctx.app.refreshUI?.();
}
COMMANDS.send = (ctx) => {
  const handle = ctx.args[0];
  if (!handle) { ctx.err('usage: send <handle> <subject> [body]'); return; }
  if (ctx.args.length === 1) { ctx.app.openWindow('mail', { composeTo: handle }); return; }
  const subject = ctx.args[1];
  const body = ctx.args.slice(2).join(' ');
  return sendMailCommand(ctx, handle, subject, body);
};

COMMANDS.forum = (ctx) => {
  if (ctx.args[0]) {
    const q = ctx.args[0].toLowerCase();
    const f = ctx.game.forums.find(x => x.id === q || x.name.toLowerCase().includes(q) || x.domain.toLowerCase().includes(q));
    if (!f) { ctx.err(`forum: no board '${ctx.args[0]}'`); return; }
    ctx.head(f.name);
    ctx.print(`${f.desc}`, 'dim');
    ctx.print(`${f.members} members · ${f.status} · ${f.domain}`, 'dim');
    ctx.print('');
    for (const t of f.threads) {
      ctx.print(`${pad(t.id, 14)} ${t.pinned ? 'PIN ' : '    '}${pad('@' + t.author, 14)} ${t.title}  (${t.posts.length})`, 'accent');
    }
    ctx.print('');
    ctx.dim(`thread <id>   post <id> <message>`);
    return;
  }
  ctx.head('NULLNET BOARDS');
  for (const f of ctx.game.forums) {
    ctx.print(`${pad(f.id, 10)} ${pad(f.name, 30)} ${padLeft(f.threads.length, 3)} threads  ${padLeft(f.members, 5)} members  ${f.status}`, f.status === 'live' ? 'accent' : 'dim');
    ctx.dim(`  ${f.desc}`);
  }
  ctx.dim('forum <id>   thread <thread-id>   post <thread-id> <message>');
};

COMMANDS.thread = (ctx) => {
  if (!ctx.args[0]) { ctx.err('usage: thread <thread-id>'); return; }
  let thread = null, forum = null;
  for (const f of ctx.game.forums) {
    const t = f.threads.find(x => x.id === ctx.args[0]);
    if (t) { thread = t; forum = f; break; }
  }
  if (!thread) { ctx.err(`thread: no thread '${ctx.args[0]}'`); return; }
  ctx.head(thread.title);
  ctx.print(`${forum.name} · started by @${thread.author}`, 'dim');
  ctx.print('');
  for (const p of thread.posts) {
    ctx.print(`@${p.author}  ${fmtDateTime(p.time)}`, 'ok');
    ctx.print(p.body);
    ctx.print('');
  }
  ctx.dim(`post ${thread.id} <message>`);
};

COMMANDS.post = (ctx) => {
  if (!ctx.args[0]) { ctx.err('usage: post <thread-id> <message>'); return; }
  const body = ctx.args.slice(1).join(' ');
  if (!body) { ctx.err('post: message required'); return; }
  let thread = null, forum = null;
  for (const f of ctx.game.forums) {
    const t = f.threads.find(x => x.id === ctx.args[0]);
    if (t) { thread = t; forum = f; break; }
  }
  if (!thread) { ctx.err(`post: no thread '${ctx.args[0]}'`); return; }
  if (forum.status !== 'live') { ctx.err(`post: ${forum.name} is ${forum.status}`); return; }
  thread.posts.push({ id: `${thread.id}-p${thread.posts.length + 1}`, author: 'operator', body, time: Date.now(), world: ctx.game.worldMinutes });
  addFeed(ctx.game, `Posted in ${forum.name}: ${thread.title}`, 'info');
  ctx.ok('Posted to ' + thread.title);
  ctx.app.refreshUI?.();
};

COMMANDS.news = (ctx) => {
  const game = ctx.game;
  if (ctx.args[0] === 'read') {
    const n = game.news.find(x => String(x.id) === String(ctx.args[1]));
    if (!n) { ctx.err(`news: no item ${ctx.args[1]}`); return; }
    ctx.head(n.headline);
    ctx.print(`${n.source} · ${fmtDateTime(n.time)}`, 'dim');
    ctx.print('');
    ctx.print(n.body);
    game.stats.newsRead++;
    checkAchievements(game);
    return;
  }
  ctx.head('NULLNET WIRE');
  ctx.dim('What the network is talking about. Updated by the simulation.');
  ctx.print('');
  for (const n of game.news.slice(0, 16)) {
    ctx.print(`${padLeft(n.id, 3)}  ${pad(fmtTime(n.time), 6)} ${pad(n.source, 16)} ${n.headline}`, 'accent');
  }
  game.stats.newsRead++;
  checkAchievements(game);
  ctx.print('');
  ctx.dim('news read <id>   ·   open the browser at news.nullnet');
};

COMMANDS.profile = (ctx) => {
  const g = ctx.game, p = g.player;
  const skill = getPlayerSkill(g);
  ctx.head(`${p.handle}@${p.host} — operator profile`);
  ctx.print(`${p.name} · ${playerTitle(g)} · ${skillTitle(g)}`, 'accent');
  ctx.print('');
  ctx.print(`Reputation   ${p.reputation}`, 'ok');
  ctx.print(`Skill        ${skill}/10`);
  ctx.print(`Heat         ${Math.round(p.heat)}% (${threatInfo(g).label})`, p.heat >= 42 ? 'warn' : 'dim');
  ctx.print(`Balance      ${fmtMoney(p.money)}`);
  ctx.print(`Net worth    ${fmtMoney(netWorth(g))}`);
  ctx.print(`Contracts    ${g.stats.contracts} delivered · ${p.contractsFailed} failed`);
  ctx.print(`Infrastructure ${ownedServers(g).length} node(s) · ${playerSites(g).length} site(s) · ${p.domains.length} domain(s)`);
  ctx.print(`Mail partners  ${mailPartners(g).size}`);
  ctx.print('');
  const unlocked = Object.keys(g.achievements).length;
  ctx.print(`Achievements ${unlocked}/${ACHIEVEMENTS.length}`, 'head');
  for (const a of ACHIEVEMENTS) {
    ctx.print(`  ${g.achievements[a.id] ? '✓' : '·'} ${pad(a.name, 18)} ${a.desc}`, g.achievements[a.id] ? 'ok' : 'dim');
  }
  ctx.print('');
  ctx.dim('Open the profile window for the full operator record.');
};

COMMANDS.status = (ctx) => {
  const g = ctx.game, c = worldClock(g), t = threatInfo(g);
  ctx.head('WORLD STATUS');
  ctx.print(`Cycle ${c.cycle} · ${c.date.toDateString()} · ${c.hh}:${c.mm}`, 'accent');
  ctx.print(`Nodes indexed     ${g.servers.length}`);
  ctx.print(`Operators online  ${onlineCount(g)}`);
  ctx.print(`Market index      ${marketIndex(g)} (${g.market.sentiment})`);
  ctx.print(`Threat level      ${t.label}`, t.level >= 3 ? 'warn' : 'ok');
  ctx.print(`Open contracts    ${g.contracts.filter(x => x.status === 'open').length}`);
  ctx.print(`Active contracts  ${g.contracts.filter(x => x.status === 'active').length}`);
  ctx.print(`Unread mail       ${unreadMail(g)}`);
  ctx.print(`Your heat         ${Math.round(g.player.heat)}%`, g.player.heat >= 42 ? 'warn' : 'dim');
  ctx.print('');
  ctx.dim('The simulation advances while this window is open and while you are away.');
};
COMMANDS.world = (ctx) => COMMANDS.status(ctx);

COMMANDS.map = (ctx) => {
  ctx.app.openWindow('map');
  const g = ctx.game;
  ctx.print(`Network topology opened. ${g.servers.length} indexed nodes · ${onlineCount(g)} operators online.`, 'info');
  ctx.dim('Click a node in the map to inspect it, scan it, or open a session.');
};

COMMANDS.achievements = (ctx) => {
  const g = ctx.game;
  ctx.head('ACHIEVEMENTS');
  for (const a of ACHIEVEMENTS) {
    const at = g.achievements[a.id];
    ctx.print(`${at ? '✓' : '·'} ${pad(a.name, 20)} ${a.desc}`, at ? 'ok' : 'dim');
    if (at) ctx.dim(`  unlocked ${fmtDateTime(at)}`);
  }
};

COMMANDS.search = (ctx) => {
  const q = ctx.args.join(' ').toLowerCase().trim();
  if (!q) { ctx.err('usage: search <term>'); return; }
  ctx.head(`SEARCH — "${q}"`);
  const sites = ctx.game.sites.filter(s => [s.domain, s.title, s.desc, s.category].join(' ').toLowerCase().includes(q)).slice(0, 10);
  const servers = ctx.game.servers.filter(s => [s.host, s.ip, s.domain, s.org, s.role].join(' ').toLowerCase().includes(q)).slice(0, 8);
  const npcs = ctx.game.npcs.filter(n => [n.handle, n.name, n.role, n.company, n.bio].join(' ').toLowerCase().includes(q)).slice(0, 8);
  const cos = ctx.game.companies.filter(c => [c.name, c.domain, c.sector, c.desc].join(' ').toLowerCase().includes(q)).slice(0, 5);
  const contracts = ctx.game.contracts.filter(c => [c.id, c.title, c.desc, c.clientHandle, c.tags.join(' ')].join(' ').toLowerCase().includes(q)).slice(0, 6);
  let n = 0;
  if (sites.length) { ctx.print('SITES', 'head'); for (const s of sites) { n++; ctx.print(`  ${pad(s.domain, 32)} ${s.title}`, 'accent'); } }
  if (servers.length) { ctx.print('HOSTS', 'head'); for (const s of servers) { n++; ctx.print(`  ${pad(s.host, 22)} ${pad(s.ip, 16)} ${s.org} · ${s.role}`, 'accent'); } }
  if (npcs.length) { ctx.print('PEOPLE', 'head'); for (const p of npcs) { n++; ctx.print(`  ${pad('@' + p.handle, 16)} ${pad(p.name, 20)} ${p.role}`, 'accent'); } }
  if (cos.length) { ctx.print('ORGANIZATIONS', 'head'); for (const c of cos) { n++; ctx.print(`  ${pad(c.name, 24)} ${c.domain} · ${c.sector}`, 'accent'); } }
  if (contracts.length) { ctx.print('CONTRACTS', 'head'); for (const c of contracts) { n++; ctx.print(`  ${contractLine(c)}`, 'accent'); } }
  if (!n) ctx.dim('No matches in the indexed network.');
  else ctx.dim(`${n} result(s). Use whois, nmap, or forum for deeper inspection.`);
};

/* ---------------- cloud, containers, agents, organizations ---------------- */
function parseLongFlags(args, start = 0) {
  const flags = {}, rest = [];
  for (let i = start; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) flags[key] = args[++i];
      else flags[key] = true;
    } else rest.push(a);
  }
  return { flags, rest };
}

COMMANDS.cloud = (ctx) => {
  const g = ctx.game;
  const sub = (ctx.args[0] || 'status').toLowerCase();
  const { flags, rest } = parseLongFlags(ctx.args, 1);

  if (sub === 'providers' || sub === 'provider') {
    ctx.head('CLOUD PROVIDERS');
    for (const p of g.cloud.providers) {
      ctx.print(`${pad(p.id, 12)} ${pad(p.name, 26)} ${pad(p.asn, 8)} ${pad(p.factor.toFixed(2) + '×', 7)} ${p.status === 'operational' ? 'operational' : 'degraded'}`, p.status === 'operational' ? 'accent' : 'warn');
      ctx.dim(`  ${p.desc}`);
      ctx.dim(`  regions: ${p.regions.join(', ')} · reliability ${p.reliability}%`);
    }
    ctx.dim('cloud plans [provider]   ·   cloud launch <plan> <provider> [region]');
    return;
  }

  if (sub === 'plans' || sub === 'plan') {
    const requested = rest[0] ? findProvider(g, rest[0]) : null;
    if (rest[0] && !requested) { ctx.err(`Unknown provider '${rest[0]}'.`); return; }
    const provider = requested || findProvider(g, 'orbital');
    ctx.head(`CLOUD PLANS — ${provider.name}`);
    for (const plan of CLOUD_PLANS) {
      const price = cloudPrice(plan, provider);
      ctx.print(`${pad(plan.id, 14)} ${pad(fmtMoney(price) + '/mo', 11)} ${pad(plan.cpu + ' vCPU', 9)} ${pad(plan.ram + ' GB', 7)} ${pad(plan.disk + ' GB', 8)} ${plan.name}`, 'accent');
      ctx.dim(`  ${plan.desc}`);
    }
    ctx.dim(`Provider factor ${provider.factor}× · ${provider.reliability}% reliability · regions ${provider.regions.join(', ')}`);
    return;
  }

  if (sub === 'launch' || sub === 'create' || sub === 'provision') {
    const plan = findPlan(rest[0]);
    if (!plan) { ctx.err('usage: cloud launch <plan> [provider] [region]'); ctx.dim('Plans: ' + CLOUD_PLANS.map(p => p.id).join(', ')); return; }
    const requested = rest[1] ? findProvider(g, rest[1]) : null;
    if (rest[1] && !requested) { ctx.err(`Unknown provider '${rest[1]}'.`); return; }
    const provider = requested || findProvider(g, 'orbital');
    const region = rest[2] || provider.regions[0];
    if (!provider.regions.includes(region)) { ctx.err(`${provider.name} does not operate in ${region}.`); ctx.dim('Regions: ' + provider.regions.join(', ')); return; }
    const item = cloudLaunchItem(plan, provider);
    const r = buyShopItem(g, item);
    if (!r.ok) { ctx.err(r.error); return; }
    const inst = attachCloudInstance(g, r.server, plan, provider, region);
    ctx.ok(`Launched ${provider.name} ${plan.name} in ${region}.`);
    ctx.print(`  instance  ${inst.id}`);
    ctx.print(`  host      ${r.server.host} (${r.server.ip})`);
    ctx.print(`  specs     ${plan.cpu} vCPU · ${plan.ram} GB RAM · ${plan.disk} GB disk${plan.gpu ? ' · GPU' : ''}`);
    ctx.print(`  billing   ${fmtMoney(inst.monthly)}/mo`);
    ctx.dim(`ssh operator@${r.server.host}   ·   docker run -d nginx:alpine`);
    ctx.app.refreshUI?.();
    return;
  }

  if (sub === 'instances' || sub === 'ls' || sub === 'list') {
    const insts = g.cloud.instances;
    ctx.head('CLOUD INSTANCES');
    if (!insts.length) { ctx.dim('No cloud instances. Launch one with: cloud launch cloud-small'); return; }
    for (const i of insts) {
      const s = g.servers.find(x => x.id === i.serverId);
      const p = findProvider(g, i.providerId);
      ctx.print(`${pad(i.id, 12)} ${pad(s?.host || i.serverId, 24)} ${pad(p?.name || i.providerId, 20)} ${pad(i.region, 10)} ${pad(fmtMoney(i.monthly) + '/mo', 9)} ${s?.status || 'gone'}`, s?.status === 'online' ? 'accent' : 'warn');
    }
    ctx.dim('cloud destroy <instance-id>');
    return;
  }

  if (sub === 'destroy' || sub === 'rm') {
    const inst = findCloudInstance(g, rest[0] || flags.id);
    if (!inst) { ctx.err(`No cloud instance matching '${rest[0] || flags.id || ''}'.`); return; }
    const sites = sitesForServer(g, inst.serverId);
    if (sites.length) { ctx.err(`Instance still hosts ${sites.length} site(s). Move or remove them first.`); return; }
    if (g.cloud.containers.some(c => c.serverId === inst.serverId)) { ctx.err('Instance still has containers. Remove them first.'); return; }
    removeCloudInstance(g, inst);
    ctx.ok(`Destroyed ${inst.id}. Billing stopped.`);
    addFeed(g, `Destroyed cloud instance ${inst.id}.`, 'info');
    ctx.app.refreshUI?.();
    return;
  }

  if (sub === 'images') {
    ctx.head('LOCAL CONTAINER IMAGES');
    for (const name of g.cloud.images) {
      const info = CONTAINER_IMAGES.find(i => i.name === name);
      ctx.print(`${pad(name, 30)} ${pad(info ? info.size + ' MB' : 'custom', 10)} ${info?.service || 'app'}`, 'accent');
    }
    ctx.dim('docker pull <image>   ·   docker run -d <image>');
    return;
  }

  // status
  const monthly = g.cloud.instances.reduce((s, i) => s + i.monthly, 0);
  ctx.head('CLOUD STATUS');
  ctx.print(`Instances     ${g.cloud.instances.length}`, 'accent');
  ctx.print(`Containers    ${g.cloud.containers.filter(c => c.status === 'running').length} running / ${g.cloud.containers.length} total`);
  ctx.print(`Clusters      ${g.cloud.clusters.length}`);
  ctx.print(`Agents        ${g.agents.filter(a => a.ownerType === 'player').length} yours / ${g.agents.length} visible`);
  ctx.print(`Monthly       ${fmtMoney(monthly)}`, monthly ? 'accent' : 'dim');
  ctx.print('');
  ctx.dim('cloud providers   cloud plans   cloud instances   cloud launch <plan> [provider] [region]');
  ctx.dim('docker ps   kubectl get pods   agent list');
};

COMMANDS.docker = (ctx) => {
  const g = ctx.game;
  const sub = (ctx.args[0] || 'ps').toLowerCase();
  const owned = ownedServers(g);
  const remote = ctx.term.remote?.server;
  const defaultServer = remote && remote.owned ? remote : owned[0];
  const mine = id => g.cloud.containers.filter(c => c.serverId === id);

  if (sub === 'ps' || sub === 'list') {
    const all = ctx.args.includes('-a') || ctx.args.includes('--all');
    const list = (remote ? mine(remote.id) : g.cloud.containers).filter(c => all || c.status === 'running');
    ctx.head('CONTAINERS');
    if (!list.length) { ctx.dim('No running containers. Try: docker run -d nginx:alpine'); return; }
    ctx.print('CONTAINER ID   NAME              IMAGE                    STATUS          PORTS                 HOST');
    for (const c of list) {
      const host = g.servers.find(s => s.id === c.serverId)?.host || '—';
      ctx.print(`${pad(c.id, 15)}${pad(c.name, 18)}${pad(c.image, 25)}${pad(c.status, 16)}${pad(String(c.port) + '/tcp', 22)}${host}`, c.status === 'running' ? 'accent' : 'dim');
    }
    return;
  }

  if (sub === 'images') {
    ctx.head('IMAGES');
    for (const name of g.cloud.images) {
      const info = CONTAINER_IMAGES.find(i => i.name === name);
      ctx.print(`${pad(name, 32)} ${pad(info ? info.size + ' MB' : 'custom', 10)} ${info?.service || 'app'}`, 'accent');
    }
    return;
  }

  if (sub === 'pull') {
    const name = ctx.args[1];
    const info = imageInfo(name);
    if (!info) { ctx.err(`Error response from daemon: pull access denied for ${name || 'image'}, repository does not exist.`); return; }
    if (!g.cloud.images.includes(info.name)) g.cloud.images.push(info.name);
    ctx.print(`Using default tag: latest`);
    ctx.print(`${info.name}: Pulling from library/${info.name.split(':')[0]}`);
    ctx.print(`Digest: sha256:${Math.random().toString(16).slice(2).padEnd(64, '0')}`);
    ctx.ok(`Status: Downloaded newer image for ${info.name}`);
    return;
  }

  if (sub === 'run') {
    let imageName = null, name = null, port = null, restart = 'always', serverId = null;
    for (let i = 1; i < ctx.args.length; i++) {
      const a = ctx.args[i];
      if (a === '-d' || a === '--detach') continue;
      if (a === '--name') { name = ctx.args[++i]; continue; }
      if (a === '-p' || a === '--publish') { port = Number((ctx.args[++i] || '').split(':').pop()); continue; }
      if (a === '--restart') { restart = ctx.args[++i] || 'always'; continue; }
      if (a === '--server') { serverId = ctx.args[++i]; continue; }
      if (a === '-e' || a === '--env') { i++; continue; }
      if (!a.startsWith('-') && !imageName) imageName = a;
    }
    if (!imageName) { ctx.err('"docker run" requires at least 1 argument.'); ctx.dim('usage: docker run -d [-p 8080:80] [--name web] <image>'); return; }
    let server = serverId ? g.servers.find(s => s.id === serverId || s.host === serverId) : defaultServer;
    if (!server) { ctx.err('No owned server available. Launch one with: cloud launch cloud-small'); return; }
    const r = runContainer(g, { image: imageName, name, port, restart, serverId: server.id });
    if (!r.ok) { ctx.err(`docker: ${r.error}`); return; }
    ctx.print(r.container.id, 'accent');
    ctx.dim(`${r.container.name} is running on ${server.host}:${r.container.port}`);
    addFeed(g, `Started container ${r.container.name} on ${server.host}.`, 'info');
    ctx.app.refreshUI?.();
    return;
  }

  if (['stop','start','rm','remove','logs','inspect'].includes(sub)) {
    const c = findContainer(g, ctx.args[1]);
    if (!c) { ctx.err(`Error: No such container: ${ctx.args[1] || ''}`); return; }
    if (sub === 'stop') {
      const r = stopContainer(c);
      if (!r.ok) { ctx.err(r.error); return; }
      ctx.ok(`Stopped ${c.name}.`); ctx.app.refreshUI?.(); return;
    }
    if (sub === 'start') {
      const r = startContainer(g, c);
      if (!r.ok) { ctx.err(r.error); return; }
      ctx.ok(`Started ${c.name}.`); ctx.app.refreshUI?.(); return;
    }
    if (sub === 'rm' || sub === 'remove') {
      if (c.status === 'running') { ctx.err(`You cannot remove a running container ${c.name}. Stop it first.`); return; }
      removeContainer(g, c); ctx.ok(`Removed ${c.name}.`); ctx.app.refreshUI?.(); return;
    }
    if (sub === 'logs') {
      ctx.head(`${c.name} — logs`);
      for (const line of containerLogs(c, 16)) ctx.print(line, 'dim');
      return;
    }
    ctx.head(`${c.name} — inspect`);
    ctx.print(`image      ${c.image}`);
    ctx.print(`host       ${g.servers.find(s => s.id === c.serverId)?.host || 'gone'}`);
    ctx.print(`status     ${c.status}`);
    ctx.print(`restarts   ${c.restarts}`);
    ctx.print(`uptime     ${c.uptime} world minutes`);
    ctx.print(`requests   ${fmtNum(c.requests)}`);
    ctx.print(`ports      ${c.port}/tcp`);
    return;
  }

  if (sub === 'build') {
    const tagIdx = ctx.args.indexOf('-t');
    const tag = tagIdx >= 0 ? ctx.args[tagIdx + 1] : 'local/app:latest';
    const file = getNode(ctx.fs(), pathFor(ctx.term, 'Dockerfile'));
    if (!file || file.type !== 'file') { ctx.err('ERROR: Cannot locate specified Dockerfile: Dockerfile'); return; }
    ctx.print(`[+] Building ${tag}`, 'accent');
    for (const line of ['load build definition', 'resolve docker.io/library/alpine:latest', 'install build dependencies', 'copy source', 'export image']) {
      ctx.dim(` => ${line}`);
    }
    const image = tag.includes(':') ? tag : tag + ':latest';
    if (!g.cloud.images.includes(image)) g.cloud.images.push(image);
    ctx.ok(`Built ${image}`);
    return;
  }

  ctx.err(`docker: '${sub}' is not a docker command.`);
};

COMMANDS.kubectl = (ctx) => {
  const g = ctx.game;
  const sub = (ctx.args[0] || 'get').toLowerCase();
  const clusters = g.cloud.clusters;

  if (sub === 'version') {
    ctx.print('Client Version: v1.31.2');
    ctx.print('Kustomize Version: v5.5.0');
    ctx.print('Server Version: v1.31.2');
    return;
  }

  if (sub === 'create') {
    if (ctx.args[1] !== 'cluster') { ctx.err('usage: kubectl create cluster <name> <node> [node...]'); return; }
    const name = ctx.args[2];
    let ids = ctx.args.slice(3).flatMap(a => a.split(',')).filter(Boolean);
    if (!ids.length) ids = ownedServers(g).map(s => s.id);
    if (!ids.length) { ctx.err('No nodes. Provision servers first: cloud launch cloud-small'); return; }
    const r = createCluster(g, { name, nodeIds: ids });
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`cluster/${r.cluster.name} created with ${r.nodes.length} node(s).`);
    ctx.dim(`Version ${r.cluster.version} · control plane on ${r.nodes[0].host}`);
    addFeed(g, `Created Kubernetes-style cluster ${r.cluster.name}.`, 'good');
    ctx.app.refreshUI?.();
    return;
  }

  if (sub === 'get') {
    const what = (ctx.args[1] || 'pods').toLowerCase();
    const cl = findCluster(g, ctx.args[2]) || clusters[0];
    if (what === 'nodes' || what === 'node') {
      ctx.head('NODES');
      if (!clusters.length) { ctx.dim('No clusters. Create one with: kubectl create cluster edge'); return; }
      for (const c of clusters) {
        for (const id of c.nodeIds) {
          const s = g.servers.find(x => x.id === id);
          ctx.print(`${pad(s?.host || id, 26)} ${pad(s?.status || 'gone', 12)} ${pad(c.name, 14)} ${s?.ip || ''}`, s?.status === 'online' ? 'accent' : 'warn');
        }
      }
      return;
    }
    if (!cl) { ctx.dim('No clusters. Create one with: kubectl create cluster edge'); return; }
    if (what === 'pods' || what === 'po') {
      const pods = clusterPods(g, cl);
      ctx.head(`PODS — ${cl.name}`);
      if (!pods.length) { ctx.dim('No workloads. Apply a deployment with: kubectl apply -f deploy.yaml'); return; }
      ctx.print('NAME                READY   STATUS    RESTARTS   NODE');
      for (const p of pods) ctx.print(`${pad(p.name, 20)}${pad(p.status === 'Running' ? '1/1' : '0/1', 8)}${pad(p.status, 10)}${pad(String(p.restarts), 11)}${p.node}`, p.status === 'Running' ? 'accent' : 'warn');
      return;
    }
    if (what === 'deploy' || what === 'deployment' || what === 'deployments') {
      ctx.head(`DEPLOYMENTS — ${cl.name}`);
      if (!cl.workloads.length) { ctx.dim('No deployments.'); return; }
      for (const w of cl.workloads) ctx.print(`${pad(w.name, 22)} ${pad((w.running || 0) + '/' + w.replicas, 8)} ${pad(w.image, 28)} ${w.service}`, 'accent');
      return;
    }
    if (what === 'clusters' || what === 'cluster') {
      ctx.head('CLUSTERS');
      for (const c of clusters) ctx.print(`${pad(c.name, 18)} ${pad(c.version, 10)} ${pad(c.nodeIds.length + ' node(s)', 12)} ${pad(c.workloads.length + ' workload(s)', 14)} ${c.status}`, c.status === 'healthy' ? 'accent' : 'warn');
      return;
    }
    ctx.err(`error: the server doesn't have a resource type "${what}"`);
    return;
  }

  if (sub === 'apply') {
    const fi = ctx.args.indexOf('-f');
    const file = fi >= 0 ? ctx.args[fi + 1] : null;
    if (!file) { ctx.err('error: must specify one of -f and -k'); return; }
    const node = getNode(ctx.fs(), pathFor(ctx.term, file));
    if (!node || node.type !== 'file') { ctx.err(`error: the path "${file}" does not exist`); return; }
    const cl = findCluster(g, ctx.args[ctx.args.indexOf('--cluster') + 1]) || clusters.find(c => c.ownerType === 'player') || clusters[0];
    if (!cl) { ctx.err('error: no cluster available. Create one with: kubectl create cluster edge'); return; }
    const text = node.content;
    const manifest = {
      kind: (text.match(/kind:\s*(\w+)/) || [])[1] || 'Deployment',
      name: (text.match(/name:\s*([a-z0-9][a-z0-9-]*)/i) || [])[1],
      image: (text.match(/image:\s*([^\s]+)/) || [])[1],
      replicas: Number((text.match(/replicas:\s*(\d+)/) || [])[1] || 1)
    };
    if (!manifest.name || !manifest.image) { ctx.err('error: manifest is missing metadata.name or a container image'); return; }
    const r = applyWorkload(g, cl, manifest);
    if (!r.ok) { ctx.err(`error: ${r.error}`); return; }
    ctx.ok(`${manifest.kind.toLowerCase()}.apps/${r.workload.name} configured`);
    ctx.dim(`image ${r.workload.image} · replicas ${r.workload.replicas} · cluster ${cl.name}`);
    addFeed(g, `Applied ${r.workload.name} to ${cl.name}.`, 'info');
    ctx.app.refreshUI?.();
    return;
  }

  if (sub === 'scale') {
    const target = (ctx.args[1] || '').replace(/^deployment(\.apps)?\//, '');
    const ri = ctx.args.indexOf('--replicas');
    const replicas = ri >= 0 ? Number(ctx.args[ri + 1]) : Number(ctx.args[2]);
    const cl = clusters.find(c => c.workloads.some(w => w.name === target)) || clusters[0];
    if (!cl) { ctx.err('error: no cluster available'); return; }
    const r = scaleWorkload(cl, target, replicas);
    if (!r.ok) { ctx.err(`error: ${r.error}`); return; }
    ctx.ok(`deployment.apps/${target} scaled to ${r.workload.replicas}`);
    return;
  }

  if (sub === 'delete') {
    const target = (ctx.args[1] || '').replace(/^deployment(\.apps)?\//, '');
    const cl = clusters.find(c => c.workloads.some(w => w.name === target));
    if (!cl) { ctx.err(`Error from server (NotFound): deployments.apps "${target}" not found`); return; }
    cl.workloads = cl.workloads.filter(w => w.name !== target);
    ctx.ok(`deployment.apps "${target}" deleted`);
    return;
  }

  if (sub === 'describe') {
    const cl = findCluster(g, ctx.args[2]) || clusters[0];
    if (!cl) { ctx.err('No cluster.'); return; }
    ctx.head(`CLUSTER ${cl.name}`);
    ctx.print(`Version     ${cl.version}`);
    ctx.print(`Status      ${cl.status}`);
    ctx.print(`Nodes       ${cl.nodeIds.length}`);
    ctx.print(`Workloads   ${cl.workloads.length}`);
    ctx.print('');
    for (const w of cl.workloads) ctx.print(`  ${pad(w.name, 20)} ${w.image} · ${w.running || 0}/${w.replicas} ready`, 'accent');
    return;
  }

  ctx.err(`kubectl: '${sub}' is not a recognized subcommand.`);
};

COMMANDS.agent = (ctx) => {
  const g = ctx.game;
  const sub = (ctx.args[0] || 'list').toLowerCase();
  const { flags, rest } = parseLongFlags(ctx.args, 1);

  if (sub === 'models' || sub === 'model') {
    ctx.head('AGENT MODELS');
    for (const m of AGENT_MODELS) {
      ctx.print(`${pad(m.id, 15)} ${pad(m.vendor, 20)} ${pad('$' + m.cost + '/mo', 8)} ${pad('skill ' + m.skill, 9)} ${pad(m.context + 'k ctx', 8)} ${m.name}`, 'accent');
      ctx.dim(`  ${m.desc}`);
    }
    return;
  }
  if (sub === 'roles' || sub === 'role') {
    ctx.head('AGENT ROLES');
    for (const r of AGENT_ROLES) {
      ctx.print(`${pad(r.id, 12)} ${pad('~$' + r.revenue + '/day', 10)} ${r.name}`, 'accent');
      ctx.dim(`  ${r.desc}`);
    }
    return;
  }
  if (sub === 'list' || sub === 'ls') {
    const all = ctx.args.includes('--all');
    const list = g.agents.filter(a => all || a.ownerType === 'player').slice(0, 24);
    ctx.head(all ? 'AGENT REGISTER' : 'YOUR AGENTS');
    if (!list.length) {
      ctx.dim('You do not run any agents.');
      ctx.dim('Deploy one: agent deploy <name> --role support --model nimbus-3');
      ctx.dim('Or inspect the public register: agent list --all');
      return;
    }
    for (const a of list) {
      const model = agentModel(a.modelId), role = agentRole(a.roleId);
      ctx.print(`${pad(a.name, 16)} ${pad(role.id, 10)} ${pad(model.name, 15)} ${pad(a.ownerName, 22)} ${pad(a.status, 8)} ${fmtNum(a.tasksDone)} tasks`, a.status === 'active' ? 'accent' : a.status === 'paused' ? 'warn' : 'dim');
    }
    ctx.dim('agent inspect <name>   agent start|stop <name>   agent deploy <name> --role <role> --model <model>');
    return;
  }
  if (sub === 'deploy') {
    const name = rest[0];
    const roleId = flags.role || 'support';
    const modelId = flags.model || 'nimbus-3';
    if (!name) { ctx.err('usage: agent deploy <name> --role <role> --model <model> [--server <id>] [--site <domain>]'); return; }
    if (!AGENT_ROLES.some(r => r.id === roleId)) { ctx.err(`Unknown role '${roleId}'.`); ctx.dim('Roles: ' + AGENT_ROLES.map(r => r.id).join(', ')); return; }
    if (!AGENT_MODELS.some(m => m.id === modelId)) { ctx.err(`Unknown model '${modelId}'.`); ctx.dim('Models: ' + AGENT_MODELS.map(m => m.id).join(', ')); return; }
    let serverId = flags.server;
    if (!serverId) {
      const owned = ownedServers(g).filter(s => s.status === 'online');
      serverId = owned[0]?.id;
    }
    const r = deployAgent(g, { name, roleId, modelId, serverId, siteId: flags.site });
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`Deployed agent ${r.agent.name} on ${r.server.host}.`);
    ctx.print(`  role      ${r.role.name}`);
    ctx.print(`  model     ${r.model.name} (${fmtMoney(r.model.cost)}/mo budget)`);
    ctx.print(`  output    ~${fmtMoney(agentDailyRevenue(r.agent))}/day gross`);
    ctx.dim(`agent inspect ${r.agent.name}   ·   agent assign ${r.agent.name} <domain>`);
    addFeed(g, `Deployed agent ${r.agent.name} on ${r.server.host}.`, 'good');
    ctx.app.refreshUI?.();
    return;
  }
  if (sub === 'inspect' || sub === 'show') {
    const a = findAgent(g, rest[0]);
    if (!a) { ctx.err(`No agent matching '${rest[0] || ''}'.`); return; }
    const model = agentModel(a.modelId), role = agentRole(a.roleId);
    ctx.head(`AGENT ${a.name}`);
    ctx.print(`Owner       ${a.ownerName}${a.ownerType === 'player' ? ' (you)' : ''}`);
    ctx.print(`Role        ${role.name}`);
    ctx.print(`Model       ${model.name} · skill ${model.skill} · ${model.context}k context`);
    ctx.print(`Status      ${a.status}`, a.status === 'active' ? 'ok' : a.status === 'paused' ? 'warn' : 'dim');
    ctx.print(`Tasks       ${fmtNum(a.tasksDone)} completed`);
    ctx.print(`Budget      ${fmtMoney(a.budget)} · spent ${fmtMoney(a.spend)}`);
    if (a.serverId) ctx.print(`Host        ${g.servers.find(s => s.id === a.serverId)?.host || a.serverId}`);
    if (a.siteId) ctx.print(`Assigned    ${g.sites.find(s => s.id === a.siteId)?.domain || a.siteId}`);
    ctx.print(`Permissions ${a.permissions.join(', ')}`, 'dim');
    ctx.print(`Capabilities ${a.capabilities.join(', ')}`, 'dim');
    ctx.print('');
    ctx.print('MEMORY', 'head');
    for (const m of a.memory.slice(-8)) ctx.dim(`  ${m.world ? hhmm(m.world) : '—'}  ${m.text}`);
    return;
  }
  if (['start','stop','pause','resume'].includes(sub)) {
    const a = findAgent(g, rest[0]);
    if (!a) { ctx.err(`No agent matching '${rest[0] || ''}'.`); return; }
    if (a.ownerType !== 'player') { ctx.err('You do not control that agent.'); return; }
    const status = sub === 'stop' ? 'stopped' : sub === 'pause' ? 'paused' : 'active';
    setAgentStatus(a, status);
    ctx.ok(`${a.name} is now ${status}.`);
    ctx.app.refreshUI?.();
    return;
  }
  if (sub === 'assign') {
    const a = findAgent(g, rest[0]);
    if (!a) { ctx.err(`No agent matching '${rest[0] || ''}'.`); return; }
    if (a.ownerType !== 'player') { ctx.err('You do not control that agent.'); return; }
    const r = assignAgent(g, a, rest[1]);
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`${a.name} assigned to ${r.site.domain}.`);
    return;
  }
  if (sub === 'logs') {
    const a = findAgent(g, rest[0]);
    if (!a) { ctx.err(`No agent matching '${rest[0] || ''}'.`); return; }
    ctx.head(`${a.name} — memory`);
    for (const m of a.memory.slice(-16)) ctx.print(`${m.world ? hhmm(m.world) : '—'}  ${m.text}`, 'dim');
    return;
  }
  if (sub === 'stats') {
    const mine = g.agents.filter(a => a.ownerType === 'player');
    const gross = mine.reduce((s, a) => s + agentDailyRevenue(a), 0);
    const cost = mine.reduce((s, a) => s + agentDailyCost(a), 0);
    ctx.head('AGENT OPERATIONS');
    ctx.print(`Agents      ${mine.length}`);
    ctx.print(`Daily gross ${fmtMoney(gross)}`, 'ok');
    ctx.print(`Daily cost  ${fmtMoney(cost)}`, 'accent');
    ctx.print(`Net         ${fmtMoney(gross - cost)}/day`, gross - cost >= 0 ? 'ok' : 'warn');
    ctx.print(`Tasks       ${fmtNum(mine.reduce((s, a) => s + a.tasksDone, 0))}`);
    return;
  }
  ctx.err(`agent: '${sub}' is not a recognized subcommand.`);
};
COMMANDS.ai = COMMANDS.agent;
COMMANDS.agents = COMMANDS.agent;

COMMANDS.company = (ctx) => {
  const g = ctx.game;
  const sub = (ctx.args[0] || 'list').toLowerCase();
  const mine = playerCompany(g);

  if (sub === 'register' || sub === 'create') {
    const name = ctx.args.slice(1).join(' ').trim();
    if (!name) { ctx.err('usage: company register <name>'); return; }
    const r = registerCompany(g, name);
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`Registered ${r.company.name}.`);
    ctx.print(`  domain    ${r.company.domain}`);
    ctx.print(`  fee       ${fmtMoney(r.fee)}`);
    ctx.dim('Launch a product with: company launch <template>');
    addFeed(g, `Registered company ${r.company.name}.`, 'good');
    ctx.app.refreshUI?.();
    return;
  }

  if (sub === 'launch' || sub === 'product') {
    if (!mine) { ctx.err('Register a company first: company register <name>'); return; }
    const r = launchProduct(g, mine, ctx.args[1]);
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`Launched ${r.product.name}.`);
    ctx.print(`  price     ${fmtMoney(r.product.price)}/mo`);
    ctx.print(`  category  ${r.product.category}`);
    ctx.dim('Revenue grows with subscribers, reputation, and the sites you operate.');
    ctx.app.refreshUI?.();
    return;
  }

  if (sub === 'products' || sub === 'portfolio') {
    const products = g.products.filter(p => p.companyId === mine?.id);
    ctx.head('YOUR PRODUCTS');
    if (!products.length) { ctx.dim('No products. company launch <template>'); return; }
    for (const p of products) ctx.print(`${pad(p.name, 28)} ${pad(fmtMoney(p.price) + '/mo', 10)} ${pad(fmtNum(p.subscribers) + ' subs', 12)} ${p.rating.toFixed(1)}★ ${p.status}`, p.status === 'live' ? 'accent' : 'dim');
    return;
  }

  if (sub === 'mine' || sub === 'my') {
    if (!mine) { ctx.dim('You do not operate a company. company register <name>'); return; }
    ctx.head(mine.name);
    ctx.print(`Sector      ${mine.sector}`);
    ctx.print(`Status      ${mine.status}`, mine.status === 'operating' ? 'ok' : 'warn');
    ctx.print(`Funds       ${fmtMoney(mine.funds)}`);
    ctx.print(`MRR         ${fmtMoney(mine.revenue)}`);
    ctx.print(`Burn        ${fmtMoney(mine.burn)}/mo`);
    ctx.print(`Valuation   ${fmtMoney(companyValuation(mine))}`, 'accent');
    ctx.print(`Products    ${mine.products.length}`);
    return;
  }

  if (sub === 'inspect' || sub === 'show') {
    const co = getCompany(g, ctx.args.slice(1).join(' ')) || (ctx.args[1] ? g.companies.find(c => c.name.toLowerCase().includes(ctx.args.slice(1).join(' ').toLowerCase())) : null);
    if (!co) { ctx.err(`No company matching '${ctx.args.slice(1).join(' ')}'.`); return; }
    ctx.head(co.name);
    ctx.print(`${co.sector} · ${co.employees} employees · founded ${co.founded}`);
    ctx.print(`Status      ${co.status}`, co.status === 'operating' ? 'ok' : 'warn');
    ctx.print(`Funds       ${fmtMoney(co.funds)}`);
    ctx.print(`Revenue     ${fmtMoney(co.revenue)}/mo`);
    ctx.print(`Burn        ${fmtMoney(co.burn)}/mo`);
    ctx.print(`Morale      ${Math.round(co.morale)}%`);
    ctx.print(`Valuation   ${fmtMoney(companyValuation(co))}`, 'accent');
    const products = g.products.filter(p => p.companyId === co.id);
    if (products.length) {
      ctx.print('');
      ctx.print('PRODUCTS', 'head');
      for (const p of products) ctx.print(`  ${pad(p.name, 26)} ${pad(fmtMoney(p.price) + '/mo', 9)} ${pad(fmtNum(p.subscribers), 8)} subs ${p.status}`, 'accent');
    }
    if (co.history?.length) {
      ctx.print('');
      ctx.print('HISTORY', 'head');
      for (const h of co.history.slice(0, 6)) ctx.dim(`  ${hhmm(h.world)}  ${h.text}`);
    }
    return;
  }

  if (sub === 'list' || sub === 'all') {
    ctx.head('ORGANIZATIONS');
    const list = [...g.companies].sort((a, b) => (b.funds || 0) - (a.funds || 0));
    for (const co of list) {
      ctx.print(`${pad(co.name, 24)} ${pad(co.sector, 14)} ${pad(fmtMoney(co.revenue) + '/mo', 12)} ${pad(co.status, 12)} ${co.ownerType === 'player' ? 'you' : fmtNum(co.employees) + ' staff'}`, co.status === 'operating' ? 'accent' : co.status === 'failed' ? 'err' : 'warn');
    }
    ctx.dim('company inspect <name>   ·   company register <name>');
    return;
  }
  ctx.err(`company: '${sub}' is not a recognized subcommand.`);
};

/* ---------------- civilization ---------------- */
function fmtBigMoney(n) {
  n = Number(n) || 0;
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return fmtMoney(n);
}
function civPlace(game) {
  const city = playerCity(game);
  const country = playerCountry(game);
  return { city, country, label: `${city?.name || 'Meridian'}, ${country?.name || 'Novaria'}` };
}
function civLine(ctx, label, value, cls = '') {
  ctx.print(`${pad(label, 20)} ${value}`, cls);
}
function civStatus(ctx) {
  const g = ctx.game;
  const s = civilizationSummary(g);
  const m = s.metrics;
  const place = civPlace(g);
  ctx.head(`CIVILIZATION — ${s.year}`);
  ctx.print(`${place.label} · ${fmtDate(worldClock(g).date)} · index ${m.civilizationIndex}/100`, 'accent');
  ctx.print('');
  civLine(ctx, 'Population', fmtNum(m.population) + ' people');
  civLine(ctx, 'GDP', fmtBigMoney(m.gdp));
  civLine(ctx, 'Growth', `${m.growth.toFixed(1)}% · inflation ${m.inflation.toFixed(1)}% · unemployment ${m.unemployment.toFixed(1)}%`);
  civLine(ctx, 'Stability', `${m.stability.toFixed(1)} · internet freedom ${m.internetFreedom.toFixed(1)} · media trust ${m.mediaTrust.toFixed(1)}`);
  civLine(ctx, 'Technology', `research level ${m.researchLevel.toFixed(2)} · adoption ${m.technologyAdoption.toFixed(1)}% · innovation ${m.innovation.toFixed(1)}`);
  civLine(ctx, 'Supply', `hardware ${(m.supplyPressure * 100).toFixed(0)} / 100 · legal pressure ${m.legalPressure.toFixed(1)}`);
  civLine(ctx, 'World', `${s.civ.countries.length} countries · ${s.civ.cities.length} cities · ${s.activeLaws} laws · ${s.activeEvents} active events`);
  ctx.print('');
  if (s.civ.events.filter(e => e.status === 'active').length) {
    ctx.print('ACTIVE WORLD EVENTS', 'head');
    for (const e of s.civ.events.filter(e => e.status === 'active').slice(0, 5)) {
      ctx.print(`  ${pad(e.category, 14)} ${e.title}`, 'warn');
      ctx.dim(`    ${e.body.slice(0, 108)}`);
    }
    ctx.print('');
  }
  ctx.dim('civ countries · civ laws · civ study · civ research · civ media · civ property · civ history · civ mp');
}
function civCountries(ctx) {
  const g = ctx.game;
  const civ = civilizationSummary(g).civ;
  ctx.head('COUNTRIES AND REGIONS');
  for (const c of civ.countries) {
    const e = c.economy;
    ctx.print(`${pad(c.code, 3)} ${pad(c.name, 12)} ${padLeft(e.growth.toFixed(1) + '%', 6)} growth ${padLeft(e.inflation.toFixed(1) + '%', 6)} infl ${padLeft(c.stability.toFixed(0), 4)} stability`, e.growth >= 2 ? 'accent' : '');
    ctx.dim(`    ${c.region} · ${c.government} · ${c.leader} · net ${c.internet.penetration}% · privacy ${c.regulation.privacy} · cyber ${c.regulation.cyber}`);
  }
  ctx.dim('civ country <name|code>   ·   civ cities [country]');
}
function civCountry(ctx, query) {
  const g = ctx.game;
  const s = civilizationSummary(g);
  const c = getCivCountry(g, query);
  if (!c) { ctx.err(`civ: no country matching '${query}'`); return; }
  ctx.head(`${c.name.toUpperCase()} — ${c.formal}`);
  ctx.print(`${c.government} · capital ${c.capital} · ${c.region} · ${c.currency}`, 'accent');
  ctx.print(`Leader ${c.leader} · ${c.rulingParty} · approval ${c.approval.toFixed(0)}% · stability ${c.stability.toFixed(0)}`);
  ctx.print(`Population ${fmtNum(c.population)} · GDP ${fmtBigMoney(c.economy.gdp)} · growth ${c.economy.growth.toFixed(1)}% · inflation ${c.economy.inflation.toFixed(1)}% · unemployment ${c.economy.unemployment.toFixed(1)}%`);
  ctx.print(`Debt ${c.economy.debt.toFixed(0)}% GDP · reserves ${fmtBigMoney(c.economy.reserves)} · productivity ${c.economy.productivity}`);
  ctx.print('');
  ctx.print('INTERNET AND TAX', 'head');
  ctx.print(`  penetration ${c.internet.penetration}% · speed ${c.internet.speed} Mbps · cost ${fmtMoney(c.internet.cost)}/mo · censorship ${c.internet.censorship} · backbone ${c.internet.backbone}`);
  ctx.print(`  corporate ${c.tax.corp}% · income ${c.tax.income}% · VAT ${c.tax.vat}% · digital ${c.tax.digital}%`);
  ctx.print('');
  ctx.print('REGULATION', 'head');
  for (const d of lawDomains()) {
    const v = c.regulation[d.id] || 0;
    ctx.print(`  ${pad(d.name, 22)} ${progressBar(v, 18)} ${padLeft(Math.round(v), 3)}`, v >= 75 ? 'warn' : '');
  }
  const laws = s.civ.laws.filter(l => l.countryId === c.id && l.status === 'active').slice(0, 6);
  ctx.print('');
  ctx.print('INSTRUMENTS', 'head');
  for (const l of laws) ctx.dim(`  ${l.name} · ${l.severity} · ${l.regulator} · max fine ${fmtMoney(l.fineMax)}`);
  const cities = s.civ.cities.filter(x => x.countryId === c.id);
  ctx.print('');
  ctx.print('CITIES', 'head');
  for (const city of cities) ctx.print(`  ${pad(city.name, 14)} ${padLeft(fmtNum(city.population), 8)} people · power ${city.utilities.power} · transport ${city.utilities.transport} · data centers ${city.districts.datacenter}`);
  const rel = Object.entries(c.relations).sort((a, b) => b[1].trade - a[1].trade).slice(0, 5);
  ctx.print('');
  ctx.print('RELATIONS', 'head');
  for (const [id, r] of rel) {
    const other = s.civ.countries.find(x => x.id === id);
    ctx.print(`  ${pad(other?.name || id, 12)} trade ${padLeft(r.trade.toFixed(0), 3)} · tension ${padLeft(r.tension.toFixed(0), 3)} · trust ${padLeft(r.trust.toFixed(0), 3)} · ${r.stance}${r.treaty ? ' · treaty' : ''}${r.sanctioned ? ' · sanctions' : ''}`, r.tension > 55 ? 'warn' : '');
  }
}
function civCities(ctx, query) {
  const g = ctx.game;
  const civ = civilizationSummary(g).civ;
  const country = query ? getCivCountry(g, query) : null;
  const list = country ? civ.cities.filter(c => c.countryId === country.id) : civ.cities;
  ctx.head(`CITIES${country ? ' — ' + country.name : ''}`);
  for (const c of list) {
    ctx.print(`${pad(c.name, 14)} ${pad(c.countryId, 12)} ${padLeft(fmtNum(c.population), 8)}  power ${padLeft(c.utilities.power, 3)}  water ${padLeft(c.utilities.water, 3)}  telecom ${padLeft(c.utilities.telecom, 3)}`, 'accent');
    ctx.dim(`    housing ${fmtMoney(c.prices.housing)}/mo · energy ${fmtMoney(c.prices.energy)} · bandwidth ${fmtMoney(c.prices.bandwidth)} · congestion ${c.conditions.congestion} · ${c.character}`);
  }
}
function civLaws(ctx, query) {
  const g = ctx.game;
  const civ = civilizationSummary(g).civ;
  const q = String(query || '').toLowerCase();
  const country = q ? getCivCountry(g, q) : null;
  let laws = civ.laws;
  if (country) laws = laws.filter(l => l.countryId === country.id);
  else if (q) laws = laws.filter(l => `${l.domain} ${l.domainName} ${l.name} ${l.severity} ${l.countryId}`.toLowerCase().includes(q));
  ctx.head(`LAW AND REGULATION${country ? ' — ' + country.name : ''}`);
  const active = laws.filter(l => l.status === 'active');
  const proposed = laws.filter(l => l.status === 'proposed');
  for (const l of proposed.slice(0, 8)) {
    const c = civ.countries.find(x => x.id === l.countryId);
    ctx.print(`PROPOSED ${pad(l.name, 34)} ${pad(c?.name || l.countryId, 12)} effective in ${Math.max(0, Math.ceil((l.effectiveWorld - civ.worldMinutes) / 1440))} days`, 'warn');
  }
  for (const l of active.slice(0, 36)) {
    ctx.print(`${pad(l.countryId, 10)} ${pad(l.domainName, 22)} ${pad(l.severity, 9)} ${pad(l.regulator, 28)} ${l.name}`, l.severity === 'strict' ? 'warn' : '');
  }
  ctx.print('');
  ctx.dim(`${active.length} active instruments · ${proposed.length} proposed · courts ${civ.courts.length} · regulators ${civ.regulators.length}`);
}
function civLegal(ctx, args = []) {
  const g = ctx.game;
  const s = civilizationSummary(g);
  const c = s.country;
  const compliance = playerCompliance(g);
  const action = (args[0] || '').toLowerCase();
  if (action === 'settle' || action === 'contest') {
    if (!args[1]) { ctx.err(`usage: civ legal ${action} <case-id>`); return; }
    const r = playerLegalAction(g, args[1], action);
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(action === 'settle' ? `Settled ${r.dispute.id} for ${fmtMoney(r.amount)}.` : `Contesting ${r.dispute.id}; counsel retained for ${fmtMoney(r.fee)}.`);
    return;
  }
  const disputes = activeLegalDisputes(g).filter(d => d.subject === 'player-company' || d.subject === 'player');
  ctx.head('LEGAL STANDING');
  ctx.print(`${c.name} · ${c.cyberPolicy} cyber policy · compliance ${compliance.score}/100`, compliance.score < 50 ? 'warn' : 'ok');
  ctx.print('');
  civLine(ctx, 'Cyber regulation', String(c.regulation.cyber));
  civLine(ctx, 'Data protection', String(c.regulation.data));
  civLine(ctx, 'Privacy', String(c.regulation.privacy));
  civLine(ctx, 'Contracts', String(c.regulation.contracts));
  ctx.print('');
  if (compliance.records.length) {
    ctx.print('COMPLIANCE RECORDS', 'head');
    for (const r of compliance.records.slice(-8).reverse()) ctx.print(`  ${r.status.padEnd(10)} ${r.issue} · ${fmtMoney(r.fine || 0)}`, r.status === 'fined' ? 'err' : 'warn');
  }
  if (disputes.length) {
    ctx.print('OPEN CASES AGAINST YOU', 'head');
    for (const d of disputes.slice(0, 8)) {
      const hearing = Math.max(0, Math.ceil((d.hearingWorld - g.worldMinutes) / 1440));
      ctx.print(`  ${d.id} ${d.domainName} · ${d.issue} · ${d.status}${d.contested ? ' · represented' : ''}`, 'warn');
      ctx.dim(`      evidence ${d.evidence}/100 · claimed ${fmtMoney(d.claimedFine)} · hearing ${hearing}d · civ legal settle ${d.id} | contest ${d.id}`);
    }
  } else ctx.dim('No open cases against this operator.');
  const other = activeLegalDisputes(g).filter(d => d.subject !== 'player-company' && d.subject !== 'player');
  if (other.length) {
    ctx.print('');
    ctx.print('COURT DOCKET — OTHER PARTIES', 'head');
    for (const d of other.slice(0, 6)) ctx.print(`  ${d.id} ${pad(d.subjectName || d.subject, 22)} ${d.domainName} · ${d.status}`, 'dim');
  }
  if (g.legal.length) {
    ctx.print('');
    ctx.print('ENFORCEMENT HISTORY', 'head');
    for (const l of g.legal.slice(-6).reverse()) ctx.print(`  ${fmtDate(l.time)} · ${l.authority} · ${fmtMoney(l.fine)} · ${l.reason}`, 'err');
  }
  ctx.print('');
  ctx.dim('Regulators, courts, and fines are simulated per jurisdiction. Contest with counsel, settle, or accept the hearing outcome.');
}
function civIdentity(ctx) {
  const g = ctx.game;
  const s = civilizationSummary(g);
  const p = s.civ.player;
  const creds = playerCredentials(g);
  ctx.head(`DIGITAL IDENTITY — @${p.handle}`);
  ctx.print(`${p.name} · ${civPlace(g).label} · updated ${fmtDate(new Date(g.createdAt + Math.floor(g.worldMinutes / 1440) * 86400000))}`, 'accent');
  ctx.print('');
  const rows = [
    ['Professional', p.professional.score, p.professional.title, `endorsements ${p.professional.endorsements}${p.professional.verified ? ' · verified' : ''}`],
    ['Social', p.social.score, `${fmtNum(p.social.followers)} followers`, `controversy ${p.social.controversy} · ${p.social.communities.join(', ')}`],
    ['Security', p.security.score, `${p.security.incidents} incidents`, p.security.credentials.join(', ') || 'no hardware credentials'],
    ['Financial', p.financial.score, `credit ${p.financial.credit}`, `assets ${fmtMoney(p.financial.assets)}`],
    ['Academic', p.academic.score, `${p.academic.publications} publications`, `${p.academic.citations} citations · field ${p.academic.field || 'none'}`]
  ];
  for (const [label, score, sub, note] of rows) {
    ctx.print(`${pad(label, 14)} ${progressBar(score, 20)} ${padLeft(Math.round(score), 3)}  ${sub}`, score >= 60 ? 'ok' : '');
    ctx.dim(`              ${note}`);
  }
  ctx.print('');
  if (creds.length) {
    ctx.print('CREDENTIALS', 'head');
    for (const c of creds) ctx.print(`  ${c.name} · ${c.issuer}`, 'accent');
  } else ctx.dim('No formal credentials yet. Study and research produce verifiable credentials.');
  ctx.print('');
  ctx.dim('Reputation is contextual: professional, social, financial, academic and security standing are separate.');
}
function civStudy(ctx, args) {
  const g = ctx.game;
  const fields = educationFields();
  if (!args.length) {
    const knowledge = civKnowledge(g);
    const civ = civilizationSummary(g).civ;
    ctx.head('EDUCATION AND INDEPENDENT STUDY');
    for (const f of fields) {
      const v = knowledge[f.id] || 0;
      ctx.print(`${pad(f.id, 14)} ${pad(f.name, 24)} ${progressBar(v, 16)} ${padLeft(Math.round(v), 3)}`, v >= 35 ? 'ok' : '');
      ctx.dim(`    ${f.blurb}`);
    }
    ctx.print('');
    ctx.print(`Study hours ${civ.education.player.studyHours || 0} · courses ${civ.education.courses.length} · credentials ${civ.education.player.credentials.length}`);
    ctx.dim('civ study <field> [hours] [--course <id>]   ·   civ courses [field]');
    return;
  }
  const field = args[0];
  let hours = 2;
  let courseId = null;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--course' && args[i + 1]) courseId = args[++i];
    else if (/^\d+$/.test(args[i])) hours = Number(args[i]);
  }
  const r = playerStudy(g, field, { hours, courseId });
  if (!r.ok) { ctx.err(r.error); return; }
  ctx.ok(`Studied ${r.field.name} for ${r.hours}h${r.cost ? ' · ' + fmtMoney(r.cost) : ''}.`);
  ctx.print(`  knowledge ${progressBar(r.knowledge, 24)} ${Math.round(r.knowledge)}/100`, 'accent');
  ctx.print(`  gain +${r.gain.toFixed(1)} · operator skill now ${getPlayerSkill(g)}/10`);
  if (g.civ.education.player.credentials.some(c => c.field === r.field.id)) ctx.dim(`Credential: ${r.field.cert}`);
  ctx.print('');
  ctx.dim('Knowledge raises practical skill and research capability. Course tuition buys higher-quality instruction.');
}
function civCourses(ctx, query) {
  const g = ctx.game;
  const civ = civilizationSummary(g).civ;
  const q = String(query || '').toLowerCase();
  const courses = q ? civ.education.courses.filter(c => `${c.field} ${c.fieldName} ${c.institutionName} ${c.level}`.toLowerCase().includes(q)) : civ.education.courses;
  ctx.head(`COURSES${q ? ' — ' + query : ''}`);
  for (const c of courses.slice(0, 30)) {
    ctx.print(`${pad(c.id, 11)} ${pad(c.fieldName, 20)} ${pad(c.level, 12)} ${padLeft(fmtMoney(c.tuition), 9)} ${padLeft(c.weeks + 'w', 4)} ${pad(c.institutionName, 28)} q${c.quality}`, 'accent');
  }
  ctx.dim('civ study <field> 4 --course <id>   ·   Online courses are cheaper; universities carry more prestige.');
}
function civResearch(ctx, args) {
  const g = ctx.game;
  const civ = civilizationSummary(g).civ;
  if (args.length && (args[0] === 'start' || args[0] === 'fund')) {
    if (args[0] === 'start') {
      const field = args[1];
      if (!field) { ctx.err('usage: civ research start <field> [funding]'); return; }
      const funding = args[2] && /^\d+$/.test(args[2]) ? Number(args[2]) : undefined;
      const r = playerStartResearch(g, field, { funding });
      if (!r.ok) { ctx.err(r.error); return; }
      ctx.ok(`Independent research started: ${r.project.fieldName} (${r.project.id})`);
      ctx.print(`  committed ${fmtMoney(r.funding)} · tier ${r.project.tier} · target ${r.project.targetName}`);
      ctx.dim('Fund it with: civ research fund <project> <amount>');
      return;
    }
    const project = args[1];
    const amount = Number(args[2] || 500);
    if (!project) { ctx.err('usage: civ research fund <project> <amount>'); return; }
    const r = playerFundResearch(g, project, amount);
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`Committed ${fmtMoney(r.amount)} to ${r.project.title}.`);
    ctx.print(`  progress ${progressBar(r.project.progress, 24)} ${Math.round(r.project.progress)}% · status ${r.project.status}`);
    return;
  }
  const query = args.join(' ').toLowerCase();
  const fieldMatch = query ? researchField(g, query) : null;
  if (fieldMatch) {
    const state = civ.research.fields.find(f => f.id === fieldMatch.id);
    ctx.head(`${fieldMatch.name.toUpperCase()} — ${fieldMatch.code}`);
    ctx.print(`Level ${state?.level || 1} · progress ${progressBar(state?.progress || 0, 22)} ${Math.round(state?.progress || 0)}% · funding ${fmtBigMoney(state?.funding || 0)}`, 'accent');
    ctx.print('');
    ctx.print('KNOWN RESULTS', 'head');
    const found = civ.research.discoveries.filter(d => d.field === fieldMatch.id);
    if (!found.length) ctx.dim('  No published results in this field yet.');
    for (const d of found.slice(-8)) ctx.print(`  ${d.year} · tier ${d.tier} · ${d.name}${d.replicated ? ' · replicated' : ''}`, 'accent');
    ctx.print('');
    ctx.print('ACTIVE PROJECTS', 'head');
    for (const p of civ.research.projects.filter(p => p.field === fieldMatch.id && p.status === 'active')) {
      ctx.print(`  ${p.id} ${pad(p.title, 32)} ${progressBar(p.progress, 16)} ${Math.round(p.progress)}% ${p.labName}`, 'warn');
    }
    ctx.dim('civ research start ' + fieldMatch.id + ' [funding]');
    return;
  }
  ctx.head('SCIENTIFIC RESEARCH');
  for (const f of civ.research.fields) {
    const active = civ.research.projects.filter(p => p.field === f.id && p.status === 'active').length;
    ctx.print(`${pad(f.id, 14)} ${pad(f.name, 24)} level ${f.level} ${progressBar(f.progress || 0, 14)} ${padLeft(active + ' active', 9)}`, f.level >= 3 ? 'ok' : '');
  }
  ctx.print('');
  ctx.print('ACTIVE PROJECTS', 'head');
  for (const p of civ.research.projects.filter(p => p.status === 'active').slice(0, 10)) {
    ctx.print(`  ${p.id} ${pad(p.fieldName, 20)} ${progressBar(p.progress, 14)} ${padLeft(Math.round(p.progress) + '%', 4)}  ${p.labName}`, 'accent');
  }
  ctx.print('');
  ctx.print(`Published discoveries ${civ.research.discoveries.length} · labs ${civ.research.labs.length} · dataset is persistent.`, 'dim');
  ctx.dim('civ research <field>   ·   civ research start <field> [funding]   ·   civ research fund <project> <amount>');
}
function civMedia(ctx, args) {
  const g = ctx.game;
  const civ = civilizationSummary(g).civ;
  if (args[0] === 'publish') {
    const headline = args.slice(1).filter(a => !a.startsWith('--')).join(' ').trim();
    if (!headline) { ctx.err('usage: civ publish <headline> [--outlet <name>] [--investigation] [--evidence]'); return; }
    const outlet = args.includes('--outlet') ? outletFor(g, args[args.indexOf('--outlet') + 1]) : null;
    const r = playerPublish(g, headline, {
      outletId: outlet?.id,
      investigation: args.includes('--investigation'),
      evidence: args.includes('--evidence')
    });
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`Published in ${r.outlet.name}: ${r.content.headline}`);
    ctx.print(`  reach ${fmtNum(r.reach)} · trust delta ${r.content.trustDelta} · followers ${fmtNum(g.civ.player.social.followers)}`);
    ctx.dim('Investigations with evidence travel further. Every piece is attributed and persistent.');
    return;
  }
  const query = args.join(' ').toLowerCase();
  if (query) {
    const outlet = outletFor(g, query);
    if (outlet) {
      ctx.head(`${outlet.name.toUpperCase()} — ${outlet.type}`);
      ctx.print(`${outlet.ownerName} · ${outlet.focus} · trust ${outlet.trust} · audience ${fmtNum(outlet.audience)} · reach ${fmtNum(outlet.reach)}`, 'accent');
      ctx.print(`Bias ${outlet.bias} · staff ${outlet.staff} · corrections ${outlet.corrections} · retractions ${outlet.retractions}`);
      const items = civ.media.content.filter(c => c.outletId === outlet.id).slice(-6).reverse();
      for (const c of items) ctx.print(`  ${c.headline} · reach ${fmtNum(c.reach)}`, 'dim');
      return;
    }
  }
  ctx.head('MEDIA AND INFORMATION');
  for (const o of civ.media.outlets.slice(0, 20)) {
    ctx.print(`${pad(o.name, 26)} ${pad(o.type, 11)} trust ${padLeft(o.trust, 3)} audience ${padLeft(fmtNum(o.audience), 7)} ${o.focus}`, o.trust >= 70 ? 'ok' : '');
  }
  ctx.print('');
  ctx.print('LATEST REPORTING', 'head');
  for (const c of civ.media.content.slice(-8).reverse()) ctx.print(`  ${pad(c.outletName, 22)} ${c.headline}`, 'accent');
  ctx.print('');
  ctx.print('TRENDS', 'head');
  ctx.print('  ' + civ.media.trends.map(t => `${t.topic} (${t.volume})`).join(' · '), 'dim');
  ctx.dim('civ media <outlet>   ·   civ publish <headline> [--outlet <name>] [--investigation] [--evidence]');
}
function civTech(ctx, args) {
  const g = ctx.game;
  const civ = civilizationSummary(g).civ;
  if (args[0] === 'adopt') {
    if (!args[1]) { ctx.err('usage: civ tech adopt <name|id>'); return; }
    const r = playerAdoptTech(g, args.slice(1).join(' '));
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`Adopted ${r.tech.name} ${r.tech.version} from ${r.tech.vendorName} for ${fmtMoney(r.cost)}.`);
    ctx.print(`  category ${r.tech.category} · license ${r.tech.license} · adoption ${r.tech.adoption.toFixed(1)}%`);
    return;
  }
  const q = args.join(' ').toLowerCase();
  const list = q ? civ.tech.technologies.filter(t => `${t.name} ${t.category} ${t.vendorName} ${t.license}`.toLowerCase().includes(q)) : civ.tech.technologies;
  ctx.head('TECHNOLOGY ECOSYSTEM');
  for (const t of list.slice(0, 28)) {
    ctx.print(`${pad(t.name, 28)} ${pad(t.category, 12)} ${pad(t.license, 16)} ${padLeft(t.version, 6)} adoption ${padLeft(t.adoption.toFixed(1) + '%', 6)}${t.standard ? ' STANDARD' : ''}`, t.standard ? 'ok' : 'accent');
    ctx.dim(`    ${t.vendorName} · docs ${t.documentation} · security ${t.security} · ecosystem ${t.ecosystem} · ${t.compatibility.join(', ')}`);
  }
  ctx.dim('civ tech adopt <name>   ·   standards emerge from adoption, not from a script.');
}
function civSupply(ctx) {
  const g = ctx.game;
  const civ = civilizationSummary(g).civ;
  const s = civ.supply;
  ctx.head('GLOBAL SUPPLY CHAIN');
  ctx.print(`Hardware index ${s.hardwareIndex} / 100 · energy index ${s.energyIndex} / 100 · factories ${s.factories.length} · warehouses ${s.warehouses.length}`, 'accent');
  ctx.print('');
  ctx.print('MATERIALS', 'head');
  for (const m of Object.values(s.materials)) {
    ctx.print(`  ${pad(m.name, 20)} ${padLeft(fmtMoney(Math.round(m.price)), 8)}/${m.unit}  availability ${padLeft(m.availability.toFixed(0), 3)}  demand ${padLeft(m.demand.toFixed(0), 3)}`, m.availability < 40 ? 'warn' : '');
  }
  ctx.print('');
  ctx.print('COMPONENTS', 'head');
  for (const c of Object.values(s.components)) {
    ctx.print(`  ${pad(c.name, 20)} ${padLeft(fmtMoney(c.price), 8)}  availability ${padLeft(c.availability.toFixed(0), 3)}  stock ${padLeft(fmtNum(c.stock), 7)}`, c.availability < 35 ? 'warn' : '');
  }
  ctx.print('');
  ctx.print('SHIPMENTS IN TRANSIT', 'head');
  const moving = s.shipments.filter(x => x.status !== 'delivered').slice(0, 8);
  if (!moving.length) ctx.dim('  None in transit.');
  for (const x of moving) {
    const eta = Math.max(0, Math.ceil((x.etaWorld - civ.worldMinutes) / 60));
    ctx.print(`  ${pad(x.cargo, 18)} ${padLeft(fmtNum(x.quantity), 6)} units · ${x.status} · eta ${eta}h`, x.status === 'delayed' ? 'warn' : 'accent');
  }
}
function civProperty(ctx, args) {
  const g = ctx.game;
  const civ = civilizationSummary(g).civ;
  const sub = (args[0] || '').toLowerCase();
  if (sub === 'buy' || sub === 'sell' || sub === 'insure') {
    const id = args[1];
    if (!id) { ctx.err(`usage: civ property ${sub} <property-id>`); return; }
    const r = sub === 'buy'
      ? playerBuyProperty(g, id, { rented: args.includes('--rented'), mortgage: args.includes('--mortgage'), insure: args.includes('--insure') })
      : sub === 'sell' ? playerSellProperty(g, id) : playerInsureProperty(g, id);
    if (!r.ok) { ctx.err(r.error); return; }
    if (sub === 'buy') {
      ctx.ok(`Acquired ${r.property.label} for ${fmtMoney(r.downPayment)}${r.mortgage ? ' down' : ''}.`);
      ctx.print(`  ${r.property.cityId} · occupancy ${r.property.occupancy} · rent ${fmtMoney(r.property.rent)}/mo · maintenance ${fmtMoney(r.property.maintenance)}/mo`);
      if (r.mortgage) ctx.print(`  mortgage ${fmtMoney(r.mortgage.principal)} at ${(r.mortgage.rate * 100).toFixed(1)}% · ${fmtMoney(r.mortgage.payment)}/mo`, 'accent');
      if (r.property.insurance) ctx.print(`  insured at ${fmtMoney(r.property.insurance)}/mo`, 'accent');
      ctx.dim('Property charges, mortgage payments and rental income settle as world days pass.');
    } else if (sub === 'sell') {
      ctx.ok(`Sold ${r.property.label} for ${fmtMoney(r.sale)}${r.payoff ? ` after ${fmtMoney(r.payoff)} mortgage payoff` : ''}.`);
    } else {
      ctx.ok(`${r.already ? 'Already insured' : 'Insured'}: ${r.property.label} at ${fmtMoney(r.property.insurance)}/mo.`);
    }
    return;
  }
  if (sub === 'available' || sub === 'list') {
    const q = args.slice(1).join(' ').toLowerCase();
    const listings = civ.property.listings.filter(p => p.status === 'available' && (!q || `${p.type} ${p.label} ${p.cityId}`.toLowerCase().includes(q)));
    ctx.head('PROPERTY MARKET — AVAILABLE');
    for (const p of listings.slice(0, 20)) {
      const city = civ.cities.find(c => c.id === p.cityId);
      ctx.print(`${pad(p.id, 10)} ${pad(p.label, 22)} ${pad(city?.name || p.cityId, 13)} ${padLeft(fmtMoney(p.price), 12)}  rent ${padLeft(fmtMoney(p.rent), 7)}/mo  q${p.quality}`, 'accent');
    }
    ctx.dim('Market index ' + civ.property.market.index.toFixed(1) + ' · vacancy ' + civ.property.market.vacancy.toFixed(1) + '% · civ property buy <id> [--rented]');
    return;
  }
  const owned = playerProperties(g);
  ctx.head('PROPERTY AND REAL ESTATE');
  ctx.print(`Market index ${civ.property.market.index.toFixed(1)} · rent index ${civ.property.market.rentIndex.toFixed(1)} · vacancy ${civ.property.market.vacancy.toFixed(1)}%`, 'accent');
  ctx.print(`Listed ${civ.property.listings.filter(p => p.status === 'available').length} · owned locally ${civ.property.owned.length} · yours ${owned.length}`);
  ctx.print('');
  if (!owned.length) ctx.dim('You own no property. civ property available');
  for (const p of owned) {
    const city = civ.cities.find(c => c.id === p.cityId);
    ctx.print(`  ${p.id} ${pad(p.label, 22)} ${pad(city?.name || p.cityId, 13)} value ${fmtMoney(p.price)} · ${p.occupancy}${p.occupancy === 'rented' ? ' · rent ' + fmtMoney(p.rent) + '/mo' : ''}`, 'ok');
  }
  ctx.print('');
  ctx.dim('civ property available   ·   civ property buy <id> [--rented]   ·   civ property sell <id>');
}
function civSociety(ctx) {
  const g = ctx.game;
  const civ = civilizationSummary(g).civ;
  const society = civ.society;
  ctx.head('SOCIETY — HOUSEHOLDS AND INDIVIDUALS');
  if (!society || !society.households.length) {
    ctx.dim('No households have formed in this world yet.');
    return;
  }
  const households = society.households;
  const avg = key => households.reduce((s, h) => s + (h[key] || 0), 0) / households.length;
  const owned = households.filter(h => h.tenure === 'own').length;
  const negative = households.filter(h => h.savings < 0).length;
  ctx.print(`${households.length} households · ${society.moves || 0} moves recorded · ${society.decisions.length} recent individual decisions`, 'accent');
  ctx.print(`Average morale ${Math.round(avg('morale'))}/100 · home ownership ${Math.round(owned / households.length * 100)}% · households in arrears ${negative}`);
  ctx.print('');
  const city = playerCity(g);
  const local = households.filter(h => h.cityId === city?.id).slice(0, 6);
  if (local.length) {
    ctx.print(`HOUSEHOLDS IN ${city.name.toUpperCase()}`, 'head');
    for (const h of local) {
      const members = h.memberIds.map(id => civ.identities.find(i => i.id === id)).filter(Boolean);
      ctx.print(`  ${pad(h.id, 12)} ${pad(h.tenure, 5)} income ${fmtMoney(h.income)}/mo · housing ${fmtMoney(h.housingCost)} · morale ${Math.round(h.morale)}`, h.morale < 40 ? 'warn' : 'accent');
      ctx.dim(`      ${members.map(m => '@' + m.handle).join(' ') || 'no recorded members'} · savings ${fmtMoney(h.savings)}`);
    }
  }
  const recent = society.decisions.slice(-8).reverse();
  if (recent.length) {
    ctx.print('');
    ctx.print('RECENT INDIVIDUAL DECISIONS', 'head');
    for (const d of recent) {
      const identity = civ.identities.find(i => i.id === d.agentId);
      ctx.print(`  @${identity?.handle || d.agentId} ${d.action} · ${d.detail}`);
    }
  }
  ctx.print('');
  ctx.dim('Households respond to income, rent, employment and opportunity. They move, buy homes and change morale without the player.');
}
function civDiplomacy(ctx) {
  const g = ctx.game;
  const civ = civilizationSummary(g).civ;
  const relations = civ.relations;
  const pairs = [];
  for (const a of civ.countries) {
    for (const b of civ.countries) {
      if (a.id >= b.id) continue;
      const rel = a.relations[b.id];
      if (rel) pairs.push({ a, b, rel });
    }
  }
  pairs.sort((x, y) => (y.rel.tension - y.rel.trust) - (x.rel.tension - x.rel.trust));
  ctx.head('GEOPOLITICS AND DIPLOMACY');
  for (const { a, b, rel } of pairs.slice(0, 8)) {
    ctx.print(`${pad(a.name, 16)} ${pad(b.name, 16)} ${pad(rel.stance || 'neutral', 12)} trade ${padLeft(Math.round(rel.trade), 3)} tension ${padLeft(Math.round(rel.tension), 3)}${rel.sanctioned ? ' SANCTIONED' : ''}`, rel.stance === 'hostile' ? 'warn' : 'accent');
  }
  ctx.print('');
  const talks = relations.negotiations.filter(n => n.status === 'active');
  if (talks.length) {
    ctx.print('ACTIVE NEGOTIATIONS', 'head');
    for (const n of talks) {
      const a = civ.countries.find(c => c.id === n.a), b = civ.countries.find(c => c.id === n.b);
      ctx.print(`  ${pad(n.topic, 32)} ${a?.name || n.a} — ${b?.name || n.b} · ${n.stage} ${Math.round(n.progress)}%`, 'accent');
    }
  } else ctx.dim('No active negotiations.');
  const sanctions = relations.sanctions.filter(s => s.status === 'active');
  if (sanctions.length) {
    ctx.print('');
    ctx.print('SANCTIONS IN FORCE', 'head');
    for (const s of sanctions.slice(0, 6)) {
      const a = civ.countries.find(c => c.id === s.a), b = civ.countries.find(c => c.id === s.b);
      ctx.print(`  ${a?.name || s.a} → ${b?.name || s.b} · ${s.scope}`);
    }
  }
  if (relations.blocs.length) {
    ctx.print('');
    ctx.print('REGIONAL BLOCS', 'head');
    for (const bloc of relations.blocs) ctx.print(`  ${pad(bloc.name, 32)} cohesion ${Math.round(bloc.cohesion)} · ${bloc.focus} · ${bloc.members.length} members`);
  }
  ctx.print('');
  ctx.dim(`${relations.treaties.length} treaties · ${sanctions.length} sanctions · ${talks.length} negotiations. Diplomacy continues while you are offline.`);
}
function civRelease(ctx, args) {
  const g = ctx.game;
  const kind = (args[0] || '').toLowerCase();
  const titleParts = [];
  let price = null;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--price' && args[i + 1]) price = Number(args[++i]);
    else titleParts.push(args[i]);
  }
  const title = titleParts.join(' ').trim();
  if (!['game', 'music', 'event'].includes(kind) || !title) {
    ctx.err('usage: civ release <game|music|event> <title> [--price <amount>]');
    return;
  }
  const r = playerRelease(g, kind, title, price == null ? {} : { price });
  if (!r.ok) { ctx.err(r.error); return; }
  ctx.ok(`Released ${kind} "${title}" through ${r.studio.name}.`);
  ctx.print(`  quality ${Math.round(r.quality)}/100 · production ${fmtMoney(r.cost)} · title ${r.work.id}`, r.quality >= 65 ? 'ok' : 'accent');
  ctx.dim('Audience, revenue and reputation evolve with the simulation.');
}
function civJobs(ctx, query) {
  const g = ctx.game;
  const snap = careerSnapshot(g);
  const q = String(query || '').trim().toLowerCase();
  const jobs = snap.jobs.filter(j => !q || `${j.title} ${j.companyName} ${j.field} ${j.level} ${j.remote ? 'remote' : ''}`.toLowerCase().includes(q));
  ctx.head('GLOBAL JOB MARKET');
  const prof = snap.professional;
  if (prof.employerId) {
    ctx.print(`Employed: ${prof.role} at ${prof.employerName} · ${fmtMoney(prof.salary)}/yr · performance ${Math.round(prof.performance)}/100`, 'ok');
    ctx.dim('civ quit ends the role. You can apply after leaving.');
  } else {
    ctx.print(`Independent · professional score ${Math.round(prof.score)}/100 · ${snap.applications.length} active application(s)`, 'accent');
  }
  ctx.print('');
  if (!jobs.length) ctx.dim('No open roles match. The market refreshes as companies hire.');
  for (const j of jobs.slice(0, 24)) {
    const match = jobMatch(g, j);
    const country = getCivCountry(g, j.countryId);
    const city = j.cityId ? g.civ.cities.find(c => c.id === j.cityId) : null;
    const closes = Math.max(1, Math.ceil((j.expiresWorld - g.worldMinutes) / 1440));
    ctx.print(`${pad(j.id, 8)} ${pad(j.title, 24)} ${pad(j.companyName, 20)} ${padLeft(fmtMoney(j.salary) + '/yr', 12)} ${j.remote ? 'remote' : pad(city?.name || country?.name || '', 12)} match ${padLeft(match, 3)}%`, match >= 55 ? 'ok' : match >= 30 ? 'accent' : '');
    ctx.dim(`    ${j.levelName} · ${country?.name || j.countryId} · needs professional ${j.requirements.professional} / ${j.field} knowledge ${j.requirements.knowledge} · closes in ${closes}d`);
  }
  ctx.print('');
  ctx.dim('civ apply <job>  ·  civ interview <job>  ·  civ accept <job>  ·  civ negotiate <job> <salary>  ·  civ career');
}
function civCareer(ctx) {
  const g = ctx.game;
  const snap = careerSnapshot(g);
  const prof = snap.professional;
  ctx.head(`CAREER — ${prof.employerId ? prof.role : 'INDEPENDENT'}`);
  if (prof.employerId) {
    ctx.print(`${prof.employerName} · ${fmtMoney(prof.salary)}/yr · since ${fmtDate(new Date(g.createdAt + Math.floor((prof.sinceWorld || g.worldMinutes) / 1440) * 86400000))}`, 'ok');
    ctx.print(`Professional score ${Math.round(prof.score)}/100 · performance ${Math.round(prof.performance)}/100 · endorsements ${prof.endorsements}`, 'accent');
  } else {
    ctx.print(`Not employed · professional score ${Math.round(prof.score)}/100 · ${prof.employmentHistory.length} prior role(s)`, 'accent');
    ctx.dim('Use civ jobs to find work. Interviews weigh field knowledge, reputation, and credentials.');
  }
  ctx.print('');
  if (snap.applications.length) {
    ctx.print('APPLICATIONS', 'head');
    for (const a of snap.applications) {
      const j = a.job;
      ctx.print(`  ${pad(a.status, 11)} ${pad(j?.title || a.jobId, 24)} ${pad(j?.companyName || '', 20)} match ${padLeft(a.match ?? jobMatch(g, j), 3)}%${a.offerSalary ? ' · offer ' + fmtMoney(a.offerSalary) : ''}`, a.status === 'offered' ? 'ok' : a.status === 'rejected' ? 'err' : 'accent');
    }
  } else ctx.dim('No active applications.');
  ctx.print('');
  if (prof.employmentHistory.length) {
    ctx.print('EMPLOYMENT HISTORY', 'head');
    for (const h of prof.employmentHistory.slice().reverse().slice(0, 8)) {
      const end = h.untilWorld ? fmtDate(new Date(g.createdAt + Math.floor(h.untilWorld / 1440) * 86400000)) : 'present';
      ctx.print(`  ${pad(h.role || 'role', 24)} ${pad(h.employerName || h.companyId || '', 20)} ${fmtMoney(h.salary || 0)}/yr · ${h.sinceWorld ? fmtDate(new Date(g.createdAt + Math.floor(h.sinceWorld / 1440) * 86400000)) : '—'} → ${end}${h.reason ? ' · ' + h.reason : ''}`);
    }
  } else ctx.dim('No employment history yet.');
  ctx.print('');
  ctx.dim('civ jobs · civ apply <job> · civ interview <job> · civ negotiate <job> <salary> · civ accept <job> · civ quit');
}
function civHistoryCmd(ctx) {
  const g = ctx.game;
  const q = ctx.args.join(' ').trim();
  const rows = civHistory(g, { query: q, limit: 30 });
  ctx.head(`WORLD HISTORY${q ? ' — ' + q : ''}`);
  for (const t of rows) {
    ctx.print(`${t.year}  ${pad(t.category, 14)} ${t.title}`, t.major ? 'accent' : '');
    ctx.dim(`      ${t.body.slice(0, 120)}`);
  }
  ctx.print('');
  ctx.dim(`${civilizationSummary(g).timeline} recorded entries. History is generated by the simulation, not authored cutscenes.`);
}
function civEvents(ctx) {
  const g = ctx.game;
  const activeOnly = (ctx.args[0] || 'active') !== 'all';
  const rows = civEventList(g, activeOnly);
  const civ = civilizationSummary(g).civ;
  ctx.head(`DYNAMIC WORLD EVENTS${activeOnly ? ' — ACTIVE' : ' — ALL'}`);
  for (const e of rows.slice(0, 24)) {
    const c = civ.countries.find(x => x.id === e.countryId);
    const left = e.status === 'active' ? Math.max(0, Math.ceil((e.startedWorld + e.durationWorld - civ.worldMinutes) / 1440)) : 0;
    ctx.print(`${pad(e.status, 9)} ${pad(e.category, 14)} ${pad(e.severity, 9)} ${e.title}`, e.status === 'active' ? 'warn' : 'dim');
    ctx.dim(`      ${c?.name || 'global'} · ${e.status === 'active' ? left + ' days remaining' : 'resolved'} · ${e.body.slice(0, 100)}`);
  }
  ctx.print('');
  ctx.dim('civ events active   ·   civ events all');
}
function civMultiplayer(ctx, args) {
  const g = ctx.game;
  const civ = civilizationSummary(g).civ;
  const sub = (args[0] || 'status').toLowerCase();
  if (sub === 'join') {
    const handle = args[1];
    if (!handle) { ctx.err('usage: civ mp join <handle>'); return; }
    const r = joinSharedWorld(g, { handle, name: args.slice(2).join(' ') || handle, role: 'operator' });
    ctx.ok(`@${r.player.handle} joined shared world ${r.worldId} as ${r.player.role}.`);
    ctx.dim('Local authority records the player and ledger entry. A network transport can relay this to an authoritative server.');
    return;
  }
  if (sub === 'leave') {
    const handle = args[1];
    if (!handle) { ctx.err('usage: civ mp leave <handle>'); return; }
    const r = disconnectSharedPlayer(g, handle);
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`@${r.player.handle} disconnected. The world continues without them.`);
    return;
  }
  if (sub === 'action') {
    const [handle, action, amount, ...memo] = args.slice(1);
    if (!handle || !action) { ctx.err('usage: civ mp action <handle> <trade|property|contracts|company|research|publish|sync> [amount] [memo]'); return; }
    const r = applyRemoteAction(g, handle, action, { amount: Number(amount) || 0, memo: memo.join(' ') || action });
    if (!r.ok) { ctx.err(r.error); return; }
    if (r.duplicate) ctx.warn(`Duplicate request replayed; ledger entry ${r.accepted.id} was not applied twice.`);
    else ctx.ok(`${action} accepted for @${handle}${r.accepted?.amount ? ' · ' + fmtMoney(r.accepted.amount) : ''} · ledger ${r.accepted?.id || ''}`);
    if (typeof r.balance === 'number') ctx.dim(`Authoritative balance: ${fmtMoney(r.balance)}`);
    return;
  }
  if (sub === 'validate') {
    const r = validateLedger(g);
    if (r.ok) ctx.ok(`Ledger valid · ${r.entries} entries · head ${r.head}`);
    else ctx.err(`Ledger broken at ${r.brokenAt}: expected ${r.expected}, found ${r.found}`);
    return;
  }
  if (sub === 'snapshot') {
    ctx.head('SHARED WORLD SNAPSHOT');
    ctx.print(JSON.stringify(sharedSnapshot(g), null, 2), 'accent');
    return;
  }
  const snap = sharedSnapshot(g);
  const ledger = validateLedger(g);
  ctx.head('MULTIPLAYER / SHARED CIVILIZATION');
  ctx.print(`World ${snap.worldId} · authority ${civ.multiplayer.authority} · transport ${civ.multiplayer.transport}`, 'accent');
  ctx.print(`Year ${snap.year} · ${snap.countries.length} countries · ledger ${snap.ledgerHead} (${ledger.ok ? 'valid' : 'BROKEN'})`, ledger.ok ? 'ok' : 'err');
  ctx.print('');
  for (const p of civ.multiplayer.players) {
    ctx.print(`  ${pad(p.handle, 18)} ${pad(p.role, 10)} ${p.connected ? 'connected' : 'offline'} · ${p.lastSeen ? fmtDate(p.lastSeen) : 'unknown'}`, p.connected ? 'ok' : 'dim');
  }
  ctx.print('');
  ctx.print(`Anti-cheat rejected ${civ.multiplayer.antiCheat.rejected} action(s) · permissions are role-scoped.`, 'dim');
  ctx.dim('civ mp join <handle> · civ mp leave <handle> · civ mp action <handle> trade 100 · civ mp validate · civ mp snapshot');
}
COMMANDS.civ = (ctx) => {
  const g = ctx.game;
  const sub = (ctx.args[0] || 'status').toLowerCase();
  const rest = ctx.args.slice(1);
  if (sub === 'status' || sub === 'overview') return civStatus(ctx);
  if (sub === 'countries' || sub === 'country') return rest.length ? civCountry(ctx, rest.join(' ')) : civCountries(ctx);
  if (sub === 'cities' || sub === 'city') return civCities(ctx, rest.join(' '));
  if (sub === 'laws' || sub === 'law' || sub === 'regulation') return civLaws(ctx, rest.join(' '));
  if (sub === 'legal' || sub === 'court' || sub === 'courts') return civLegal(ctx, rest);
  if (sub === 'identity' || sub === 'id') return civIdentity(ctx);
  if (sub === 'study' || sub === 'learn') return civStudy(ctx, rest);
  if (sub === 'courses' || sub === 'course') return civCourses(ctx, rest.join(' '));
  if (sub === 'research' || sub === 'science') return civResearch(ctx, rest);
  if (sub === 'media' || sub === 'news') return civMedia(ctx, rest);
  if (sub === 'tech' || sub === 'technology') return civTech(ctx, rest);
  if (sub === 'supply' || sub === 'logistics') return civSupply(ctx);
  if (sub === 'property' || sub === 'properties' || sub === 'realestate') return civProperty(ctx, rest);
  if (sub === 'jobs' || sub === 'jobmarket' || sub === 'hiring') return civJobs(ctx, rest.join(' '));
  if (sub === 'career' || sub === 'employment' || sub === 'work') return civCareer(ctx);
  if (sub === 'society' || sub === 'households' || sub === 'population') return civSociety(ctx);
  if (sub === 'diplomacy' || sub === 'relations' || sub === 'geopolitics') return civDiplomacy(ctx);
  if (sub === 'release' || sub === 'publishwork') return civRelease(ctx, rest);
  if (sub === 'apply') {
    if (!rest.length) { ctx.err('usage: civ apply <job>'); return; }
    const r = playerApplyJob(g, rest.join(' '));
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`Applied to ${r.job.title} at ${r.job.companyName} · match ${r.match}%.`);
    ctx.dim(`Interview with: civ interview ${r.job.id}`);
    return;
  }
  if (sub === 'interview') {
    if (!rest.length) { ctx.err('usage: civ interview <job>'); return; }
    const r = playerInterviewJob(g, rest.join(' '));
    if (!r.ok) { ctx.err(r.error); return; }
    if (r.offered) {
      ctx.ok(`Offer: ${r.job.title} at ${r.job.companyName} · ${fmtMoney(r.offer)}/yr.`);
      ctx.dim(`Accept: civ accept ${r.job.id} · negotiate: civ negotiate ${r.job.id} <salary>`);
    } else ctx.warn(`${r.job.companyName} declined your application. Build experience or study the required field and try again.`);
    return;
  }
  if (sub === 'negotiate') {
    if (rest.length < 2) { ctx.err('usage: civ negotiate <job> <salary>'); return; }
    const amount = Number(rest[rest.length - 1]);
    const r = playerNegotiateJob(g, rest.slice(0, -1).join(' '), amount);
    if (!r.ok) { ctx.err(r.error); return; }
    if (r.accepted) ctx.ok(`${r.job.companyName} agreed to ${fmtMoney(r.offer)}/yr.`);
    else ctx.warn(`${r.job.companyName} withdrew the offer. The role is open again.`);
    return;
  }
  if (sub === 'accept') {
    if (!rest.length) { ctx.err('usage: civ accept <job>'); return; }
    const r = playerAcceptJob(g, rest.join(' '));
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`You now work at ${r.job.companyName} as ${r.job.title} (${fmtMoney(r.salary)}/yr).`);
    ctx.dim('Salary is paid monthly in world time, net of income tax. Use civ career to review the record.');
    return;
  }
  if (sub === 'decline') {
    if (!rest.length) { ctx.err('usage: civ decline <job>'); return; }
    const r = playerDeclineJob(g, rest.join(' '));
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`Declined ${r.job?.title || 'the role'}.`);
    return;
  }
  if (sub === 'quit' || sub === 'resign') {
    const r = playerQuitJob(g);
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`Left ${r.employer} after ${Math.max(1, Math.round(r.tenure / 1440))} world days.`);
    ctx.dim('A short tenure can affect reputation. Future employers see the record.');
    return;
  }
  if (sub === 'history' || sub === 'timeline') return civHistoryCmd(ctx);
  if (sub === 'events' || sub === 'event') return civEvents(ctx);
  if (sub === 'mp' || sub === 'multiplayer' || sub === 'shared') return civMultiplayer(ctx, rest);
  if (sub === 'relocate' || sub === 'move') {
    const country = rest[0], city = rest[1];
    if (!country) { ctx.err('usage: civ relocate <country> [city]'); return; }
    const r = playerRelocate(g, country, city);
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`Relocated to ${r.city?.name || r.country.name}, ${r.country.name} for ${fmtMoney(r.cost)}.`);
    ctx.dim('Location changes which regulations, taxes, prices and opportunities apply to you.');
    return;
  }
  if (sub === 'lobby' || sub === 'policy') {
    const country = rest[0], domain = rest[1];
    if (!country) { ctx.err('usage: civ lobby <country> [domain]'); return; }
    const r = playerLobby(g, country, domain);
    if (!r.ok) { ctx.err(r.error); return; }
    ctx.ok(`Policy meeting in ${r.country.name} for ${fmtMoney(r.cost)}.`);
    ctx.print(`  ${r.domain.name} proposal support now ${Math.round(r.support)}% · ${r.policy.name}`, 'accent');
    ctx.dim('Lobbying changes support. It does not guarantee passage.');
    return;
  }
  if (sub === 'help' || sub === '?') {
    ctx.head('CIVILIZATION COMMANDS');
    ctx.print('  civ                             world overview and metrics');
    ctx.print('  civ countries | civ country <name|code>');
    ctx.print('  civ cities [country]');
    ctx.print('  civ laws [country|domain]       active and proposed instruments');
    ctx.print('  civ legal | civ legal settle <case> | civ legal contest <case>');
    ctx.print('  civ identity                    contextual professional/social/financial record');
    ctx.print('  civ study [field] [hours] [--course id]');
    ctx.print('  civ courses [field]');
    ctx.print('  civ research [field] | civ research start <field> [funding] | civ research fund <project> <amount>');
    ctx.print('  civ media [outlet] | civ publish <headline> [--outlet name] [--investigation] [--evidence]');
    ctx.print('  civ tech [query] | civ tech adopt <name>');
    ctx.print('  civ supply                      materials, components and shipments');
    ctx.print('  civ property [available|buy id [--rented|--mortgage|--insure]|sell id|insure id]');
    ctx.print('  civ society                     households, morale, migration and individual decisions');
    ctx.print('  civ diplomacy                   relations, negotiations, sanctions and blocs');
    ctx.print('  civ release <game|music|event> <title> [--price n]');
    ctx.print('  civ jobs [query] | civ career');
    ctx.print('  civ apply <job> | civ interview <job> | civ negotiate <job> <salary> | civ accept <job> | civ decline <job> | civ quit');
    ctx.print('  civ history [query] | civ events [active|all]');
    ctx.print('  civ mp [status|join handle|leave handle|action handle action amount|validate|snapshot]');
    ctx.print('  civ relocate <country> [city] | civ lobby <country> [domain]');
    return;
  }
  ctx.err(`civ: '${sub}' is not a recognized subcommand.`);
  ctx.dim('Try: civ help');
};
COMMANDS.civilization = COMMANDS.civ;
COMMANDS.study = (ctx) => civStudy(ctx, ctx.args);
COMMANDS.research = (ctx) => civResearch(ctx, ctx.args);
COMMANDS.publish = (ctx) => civMedia(ctx, ['publish', ...ctx.args]);
COMMANDS.country = (ctx) => ctx.args.length ? civCountry(ctx, ctx.args.join(' ')) : civCountries(ctx);

COMMANDS.save = (ctx) => {
  if (typeof ctx.app.saveGame === 'function') {
    ctx.app.saveGame(true);
    ctx.ok('Persistent world saved locally.');
  } else ctx.err('save: persistence layer unavailable');
};

COMMANDS.reset = (ctx) => {
  ctx.warn('This will erase the persistent world and start over.');
  ctx.print('Type "yes" to confirm, or anything else to cancel.', 'dim');
  ctx.term.pending = { kind: 'confirm-reset' };
};

/* Export the command names for tab completion and the help surface. */
export function commandNames() {
  return Object.keys(COMMANDS).sort();
}
