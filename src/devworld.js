/* Autonomous software development and cybersecurity ecosystem.
 *
 * NPC developers plan, write, test, release and maintain real procedural source
 * code. Security researchers discover defects in that code, publish advisories
 * and force patches. All state is JSON-compatible and bounded; no timers, no
 * real execution, and no imports from world.js.
 */
import { makeRng, clamp, hash32, slugify } from './util.js';
import { lint, languageFor } from './coding.js';

export const DEVWORLD_VERSION = 1;
const DAY = 1440;

export const DEV_CAPS = Object.freeze({
  developers: 120, projects: 140, vulns: 220, advisories: 160, events: 260,
  labs: 20, contributions: 160, reviews: 200, reports: 160, history: 300
});

const LANGS = [
  { id: 'python', ext: 'py', weight: 26, kinds: ['cli', 'api', 'web', 'library', 'tool', 'ai'] },
  { id: 'javascript', ext: 'js', weight: 24, kinds: ['cli', 'web', 'api', 'library', 'game'] },
  { id: 'typescript', ext: 'ts', weight: 10, kinds: ['web', 'api', 'library'] },
  { id: 'c', ext: 'c', weight: 8, kinds: ['cli', 'tool', 'system'] },
  { id: 'cpp', ext: 'cpp', weight: 5, kinds: ['cli', 'tool', 'game', 'system'] },
  { id: 'rust', ext: 'rs', weight: 6, kinds: ['cli', 'tool', 'system', 'library'] },
  { id: 'go', ext: 'go', weight: 7, kinds: ['cli', 'api', 'tool', 'system'] },
  { id: 'sql', ext: 'sql', weight: 4, kinds: ['data'] },
  { id: 'bash', ext: 'sh', weight: 5, kinds: ['tool', 'cli', 'system'] },
  { id: 'html', ext: 'html', weight: 5, kinds: ['web', 'game'] }
];

const PROJECT_KINDS = [
  ['cli', 'command-line tool', ['python','javascript','go','rust','c','bash']],
  ['web', 'web application', ['javascript','typescript','python','html']],
  ['api', 'JSON API service', ['javascript','typescript','python','go']],
  ['library', 'reusable library', ['javascript','typescript','python','rust','go']],
  ['tool', 'network utility', ['python','c','go','rust','bash']],
  ['data', 'database toolkit', ['sql','python']],
  ['game', 'small game prototype', ['javascript','cpp','html']],
  ['system', 'systems utility', ['c','rust','go','bash']],
  ['security', 'security auditing utility', ['python','bash','go']],
  ['ai', 'AI service', ['python','javascript']]
];

const VULN_CATEGORIES = [
  ['incorrect access control', 'An endpoint trusts a client-supplied identity without checking the session owner.', 'critical', 'auth'],
  ['weak authentication', 'Credentials are accepted without rate limiting or a second factor.', 'high', 'auth'],
  ['insecure configuration', 'A development default survives into the production deployment.', 'medium', 'config'],
  ['injection', 'Untrusted input is concatenated into an interpreted query.', 'high', 'input'],
  ['cross-site scripting', 'User content is rendered as markup instead of escaped text.', 'medium', 'input'],
  ['server-side request forgery', 'A fetch endpoint accepts arbitrary internal addresses.', 'high', 'input'],
  ['insecure deserialization', 'Serialized objects are reconstructed without validation.', 'high', 'input'],
  ['memory corruption', 'A fixed-size buffer is written without a bounds check.', 'critical', 'memory'],
  ['dependency vulnerability', 'A pinned dependency has a published advisory.', 'high', 'dependency'],
  ['exposed administrative interface', 'The admin console binds to a public interface.', 'critical', 'config'],
  ['incorrect permissions', 'A writable directory is world-accessible.', 'medium', 'config'],
  ['weak cryptography', 'A legacy digest is used for password storage.', 'high', 'crypto'],
  ['unpatched software', 'A known upstream flaw was never applied.', 'high', 'dependency'],
  ['information disclosure', 'Error responses include stack traces and internal paths.', 'low', 'config']
];

const SECURITY_ROLES = ['security researcher', 'penetration tester', 'malware analyst', 'SOC analyst', 'incident responder', 'reverse engineer', 'network defender', 'security consultant'];

const COMMIT_MESSAGES = [
  'initial import', 'add input validation', 'fix off-by-one in parser', 'handle empty response',
  'document public API', 'replace unsafe default', 'tighten error handling', 'reduce allocations in hot path',
  'add regression test', 'update dependency pins', 'refactor configuration loader', 'correct access check',
  'improve log messages', 'simplify retry loop', 'close resource on failure', 'bump patch version'
];

const PROJECT_WORDS = ['atlas','cinder','drift','ember','field','granite','harbor','ivory','kestrel','lattice','meridian','nomad','orbit','paper','quartz','relay','signal','tessera','vector','willow','basalt','quiet','hollow','static','foundry'];

function devRng(game, salt = 0) {
  return makeRng((game.seed ^ Math.floor((game.worldMinutes || 0) * 2654435761) ^ ((game.tickCount || 0) * 97) ^ salt) >>> 0);
}
function nextId(dw, prefix) {
  dw.seq = dw.seq || {};
  dw.seq[prefix] = (dw.seq[prefix] || 1) + 1;
  return `${prefix}-${String(dw.seq[prefix]).padStart(4, '0')}`;
}
function bounded(arr, cap) { if (Array.isArray(arr) && arr.length > cap) arr.splice(0, arr.length - cap); return arr; }
function clampv(n, a = 0, b = 100) { return clamp(Number(n) || 0, a, b); }
function worldYear(game) { return 2026 + Math.floor(((game.worldMinutes || 0) - 552) / (365 * DAY)); }
function age(world, now) { return Math.max(0, Math.round(((now || 0) - (world || 0)) / DAY)); }
function cap(str, n = 80) { return String(str ?? '').slice(0, n); }

function pushEvent(dw, opts) {
  dw.events.push({
    id: nextId(dw, 'devevent'), world: opts.world || 0, year: opts.year || worldYear({ worldMinutes: opts.world || 0 }),
    category: opts.category || 'development', title: cap(opts.title || 'Development note', 140),
    body: cap(opts.body || '', 320), actors: (opts.actors || []).slice(0, 6),
    severity: opts.severity || 'minor', targetId: opts.targetId || null,
    major: !!opts.major, resolved: false
  });
  bounded(dw.events, DEV_CAPS.events);
}
function remember(developer, world, text) {
  if (!developer) return;
  developer.memory.push({ world, text: cap(text, 180) });
  bounded(developer.memory, 40);
}
function chooseWeighted(rng, entries, weight) {
  if (!entries.length) return null;
  const total = entries.reduce((s, e) => s + Math.max(0.0001, weight(e)), 0);
  let roll = rng.next() * total;
  for (const entry of entries) { roll -= Math.max(0.0001, weight(entry)); if (roll <= 0) return entry; }
  return entries[entries.length - 1];
}
function defaultQuality() {
  return { naming: 50, organization: 50, documentation: 50, complexity: 50, performance: 50, memory: 50, errorHandling: 50, security: 50, testing: 50, maintainability: 50, debt: 20 };
}
function defaultProjectMetrics() {
  return { files: 0, lines: 0, coverage: 0, bugsOpen: 0, bugsFixed: 0, builds: 0, releases: 0, downloads: 0, stars: 0, forks: 0, contributions: 0 };
}

/* ---------------- construction ---------------- */
export function ensureDevWorld(game) {
  if (!game.devworld || typeof game.devworld !== 'object' || !Array.isArray(game.devworld.developers) || !game.devworld.developers.length) {
    game.devworld = buildDevWorld(game, devRng(game, 0x5eed));
    return game.devworld;
  }
  const dw = game.devworld;
  dw.version = DEVWORLD_VERSION;
  dw.seq = dw.seq || {};
  for (const key of ['developer','project','vuln','adv','lab','contrib','review','report','devevent']) if (typeof dw.seq[key] !== 'number') dw.seq[key] = 1;
  for (const key of ['developers','projects','vulns','advisories','events','labs','contributions','reviews','reports','history']) if (!Array.isArray(dw[key])) dw[key] = [];
  dw.cadence = dw.cadence || {};
  dw.metrics = dw.metrics || {};
  const caps = { developers: DEV_CAPS.developers, projects: DEV_CAPS.projects, vulns: DEV_CAPS.vulns, advisories: DEV_CAPS.advisories, events: DEV_CAPS.events, labs: DEV_CAPS.labs, contributions: DEV_CAPS.contributions, reviews: DEV_CAPS.reviews, reports: DEV_CAPS.reports, history: DEV_CAPS.history };
  for (const [key, maximum] of Object.entries(caps)) bounded(dw[key], maximum);
  for (const project of dw.projects) {
    if (!project.files || typeof project.files !== 'object' || Array.isArray(project.files)) project.files = {};
    if (!project.git || typeof project.git !== 'object') project.git = { branch: 'main', commits: [], tags: [], prs: [] };
    if (!Array.isArray(project.git.commits)) project.git.commits = [];
    if (!Array.isArray(project.git.prs)) project.git.prs = [];
    if (!Array.isArray(project.issues)) project.issues = [];
    if (!Array.isArray(project.releases)) project.releases = [];
    if (!project.quality || typeof project.quality !== 'object') project.quality = defaultQuality();
    if (!project.metrics || typeof project.metrics !== 'object') project.metrics = defaultProjectMetrics();
  }
  recomputeDevMetrics(game, dw);
  return dw;
}

export function buildDevWorld(game, rng = null) {
  rng = rng || devRng(game, 0x5eed);
  const dw = {
    version: DEVWORLD_VERSION,
    seq: { developer: 1, project: 1, vuln: 1, adv: 1, lab: 1, contrib: 1, review: 1, report: 1, devevent: 1 },
    developers: [], projects: [], vulns: [], advisories: [], events: [], labs: [],
    contributions: [], reviews: [], reports: [], history: [], cadence: {}, metrics: {},
    builtWorld: game.worldMinutes || 0
  };
  const candidates = (game.npcs || []).filter(n => /develop|program|engineer|research|admin|maintainer|analyst|consultant/i.test(n.role || '') || (n.interests || []).some(i => /oss|web|cloud|security|research|linux|automation/i.test(i)));
  const pool = candidates.length ? candidates : (game.npcs || []).slice(0, 40);
  for (const npc of pool.slice(0, 34)) dw.developers.push(makeDeveloper(dw, game, rng, npc));
  for (let i = 0; dw.developers.length < 16 && i < (game.npcs || []).length; i++) {
    const npc = game.npcs[i];
    if (!dw.developers.some(d => d.npcId === npc.id)) dw.developers.push(makeDeveloper(dw, game, rng, npc, true));
  }
  bounded(dw.developers, DEV_CAPS.developers);
  for (const dev of dw.developers.filter(d => d.status === 'active').slice(0, 12)) {
    const project = createProject(game, dw, dev, rng, { detailed: true });
    if (project) { seedFiles(project, dev, rng); publishProject(game, dw, project); }
  }
  for (const dev of dw.developers.filter(d => d.status !== 'active').slice(0, 6)) {
    const project = createProject(game, dw, dev, rng, { detailed: false });
    if (project) { seedFiles(project, dev, rng); publishProject(game, dw, project); }
  }
  buildLabs(game, dw, rng);
  seedInitialVulns(game, dw, rng);
  pushEvent(dw, { world: game.worldMinutes || 0, category: 'development', title: 'Developer economy seeded', body: `${dw.developers.length} developers maintain ${dw.projects.length} repositories across the simulated internet.`, major: false });
  recomputeDevMetrics(game, dw);
  return dw;
}

function makeDeveloper(dw, game, rng, npc, forceSecurity = false) {
  const security = forceSecurity || SECURITY_ROLES.some(r => (npc.role || '').toLowerCase().includes(r.split(' ')[0])) || /security|malware|pentest/i.test((npc.role || '') + (npc.tag || ''));
  const skillBase = clamp(Math.round((npc.skill || 50) * .7 + rng.int(10, 40)), 12, 98);
  const languagePool = rng.picks(LANGS, rng.int(1, 3)).map(l => l.id);
  if (!languagePool.length) languagePool.push('python');
  const langs = {};
  for (const id of languagePool) langs[id] = clampv(Math.round(skillBase + rng.int(-12, 12)), 5, 99);
  const style = {
    naming: rng.pick(['snake_case','camelCase','kebab-case']),
    indent: rng.pick([2, 2, 4, 4]),
    comments: clampv(Math.round(rng.float(.05, .7) * 100)),
    documentation: clampv(Math.round(skillBase * .6 + rng.int(5, 40))),
    errorHandling: clampv(Math.round(skillBase * .7 + rng.int(-10, 20))),
    security: clampv(Math.round(skillBase * .55 + rng.int(-5, 30))),
    minimalism: clampv(rng.int(10, 90))
  };
  const dev = {
    id: nextId(dw, 'developer'), npcId: npc.id, handle: npc.handle, name: npc.name,
    role: security ? rng.pick(SECURITY_ROLES) : ((npc.role || '').toLowerCase().includes('develop') ? 'software developer' : 'open-source maintainer'),
    employment: 'independent', employerId: npc.companyId || null, employerName: npc.company || null,
    languages: langs, specialties: rng.picks(['web','systems','networking','databases','security','AI','games','tooling','documentation'], rng.int(1, 3)),
    style, skill: skillBase, reputation: clampv(npc.rep || 40), xp: 0,
    status: rng.chance(.68) ? 'active' : rng.chance(.5) ? 'inactive' : 'between-projects',
    objectives: [rng.pick(['ship a useful tool','improve an existing library','publish a security report','win a contract','build a small product'])],
    collaborators: [], projects: [], memory: [], createdWorld: game.worldMinutes || 0,
    lastActiveWorld: game.worldMinutes || 0, decisions: 0, bugsFound: 0, bugsFixed: 0
  };
  remember(dev, game.worldMinutes || 0, `${dev.name} began work as ${dev.role}.`);
  if (dev.employerId && game.companies && game.companies.some(c => c.id === dev.employerId)) dev.employment = 'employed';
  return dev;
}

function pickLanguage(rng, dev, kind) {
  const fitting = Object.keys(dev.languages || {}).filter(id => (LANGS.find(l => l.id === id)?.kinds || []).includes(kind));
  const options = fitting.length ? fitting : Object.keys(dev.languages || {});
  if (!options.length) return 'python';
  return chooseWeighted(rng, options, id => (dev.languages[id] || 20) + (LANGS.find(l => l.id === id)?.weight || 0));
}

function createProject(game, dw, dev, rng, opts = {}) {
  if (dw.projects.length >= DEV_CAPS.projects) return null;
  const kindDef = chooseWeighted(rng, PROJECT_KINDS, d => d[0] === 'security' && dev.role.includes('security') ? 4 : 1);
  const kind = opts.kind || kindDef[0];
  const language = pickLanguage(rng, dev, kind);
  const baseName = rng.pick(PROJECT_WORDS) + (rng.chance(.45) ? '-' + rng.pick(PROJECT_WORDS) : '');
  const name = `${baseName}${kind === 'cli' || kind === 'tool' ? '' : rng.chance(.3) ? '-' + kind : ''}`;
  let slug = slugify(name) || 'project';
  if (dw.projects.some(p => p.slug === slug)) slug = `${slug}-${rng.int(2, 99)}`;
  const project = {
    id: nextId(dw, 'project'), name, slug, ownerId: dev.id, ownerHandle: dev.handle,
    ownerName: dev.name, orgId: dev.employerId || null,
    kind, language, description: `${rng.pick(['A small','A focused','A pragmatic','An experimental'])} ${kindDef[1]} for ${rng.pick(['daily use','small teams','operators','developers','researchers','hobbyists'])}.`,
    status: opts.detailed === false ? 'maintenance' : 'planning',
    phase: 0, phaseProgress: 0, detailed: opts.detailed !== false,
    architecture: {
      modules: [], dependencies: [], database: null, auth: null, api: null,
      style: dev.style.naming, target: rng.pick(['local workstation','small server','browser','edge node'])
    },
    requirements: [
      `must ${rng.pick(['run without a database','survive empty input','remain readable','stay dependency-free','publish metrics'])}`,
      `must expose ${rng.pick(['a documented CLI','a small JSON API','a testable library','a static site'])}`,
      `should ${rng.pick(['log useful errors','support configuration files','avoid unsafe defaults','be easy to fork'])}`
    ],
    quality: computeQuality(dev, rng, opts.detailed !== false), metrics: defaultProjectMetrics(),
    files: {}, git: { branch: 'main', commits: [], tags: [], prs: [] },
    issues: [], releases: [], bugs: [], collaborators: [],
    dependencies: [], createdWorld: game.worldMinutes || 0, updatedWorld: game.worldMinutes || 0,
    lastTestWorld: 0, lastBuildWorld: 0, nextCycleWorld: (game.worldMinutes || 0) + rng.int(120, 900),
    repoPath: `/srv/git/${dev.handle}/${slug}.git`, published: false, license: rng.pick(['MIT','Apache-2.0','BSD-3-Clause','GPL-3.0'])
  };
  project.architecture.auth = rng.chance(.4) ? 'token' : null;
  project.architecture.api = ['api','web','ai'].includes(kind) ? rng.pick(['rest','graphql','none']) : null;
  if (['api','web','data'].includes(kind) && rng.chance(.55)) project.architecture.database = rng.pick(['SQLite','PostgreSQL','in-memory']);
  project.dependencies = chooseDependencies(game, rng, language);
  project.architecture.dependencies = project.dependencies.map(d => d.name);
  dw.projects.push(project);
  dev.projects.push(project.id);
  if (dev.status === 'between-projects') dev.status = 'active';
  remember(dev, game.worldMinutes || 0, `Planned ${project.name} (${language}, ${kind}).`);
  pushEvent(dw, { world: game.worldMinutes || 0, category: 'development', title: `${dev.handle} planned ${project.name}`, body: `${project.description} Target: ${project.architecture.target}.`, actors: [dev.handle], targetId: project.id });
  return project;
}

function computeQuality(dev, rng, detailed) {
  const s = dev.skill || 40;
  const q = {
    naming: clampv(Math.round(s * .7 + (dev.style.naming === 'snake_case' ? 8 : 3) + rng.int(-8, 8))),
    organization: clampv(Math.round(s * .75 + rng.int(-12, 12))),
    documentation: clampv(dev.style.documentation + rng.int(-8, 8)),
    complexity: clampv(Math.round(100 - s * .55 + rng.int(-10, 16))),
    performance: clampv(Math.round(s * .6 + rng.int(-12, 18))),
    memory: clampv(Math.round(s * .55 + rng.int(-12, 18))),
    errorHandling: clampv(dev.style.errorHandling + rng.int(-8, 8)),
    security: clampv(dev.style.security + rng.int(-10, 10)),
    testing: clampv(Math.round(s * .6 + rng.int(-16, 22))),
    maintainability: clampv(Math.round(s * .65 + rng.int(-14, 16))),
    debt: clampv(Math.round(100 - s * .6 + rng.int(-8, 20)), 0, 100)
  };
  if (!detailed) { q.documentation = Math.round(q.documentation * .6); q.testing = Math.round(q.testing * .5); }
  return q;
}

function chooseDependencies(game, rng, language) {
  const packages = (game.internet?.packages || []).filter(p => p.language === language || p.registry === 'system');
  if (!packages.length || !rng.chance(.72)) return [];
  return rng.picks(packages, rng.int(1, Math.min(3, packages.length))).map(p => ({ name: p.name, version: p.version, vulnerable: (p.vulnerabilityCount || 0) > 0 }));
}

/* ---------------- source generation ---------------- */
function fnName(style, word) {
  if (style.naming === 'camelCase') return word.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  if (style.naming === 'kebab-case') return word.replace(/_/g, '-');
  return word;
}

function pythonSource(project, dev) {
  const st = dev.style;
  const indent = ' '.repeat(st.indent || 4);
  const safe = project.quality.security > 55;
  const validate = fnName(st, 'validate_input');
  const process = fnName(st, 'process_items');
  const fmt = fnName(st, 'format_result');
  const lines = [
    `"""${project.name} — ${project.description}"""`,
    '', 'from __future__ import annotations', '',
    'import argparse', 'import json', 'from typing import Any', '', ''
  ];
  if (st.comments >= 24) lines.push('# public interface');
  lines.push(`def ${validate}(value: Any) -> Any:`);
  if (safe) {
    lines.push(`${indent}if value is None:`, `${indent}${indent}raise ValueError("value is required")`,
      `${indent}if isinstance(value, str) and len(value) > 4096:`, `${indent}${indent}raise ValueError("value is too long")`, `${indent}return value`);
  } else lines.push(`${indent}return value`);
  lines.push('', '', `def ${process}(items: list[Any]) -> list[Any]:`, `${indent}result = []`, `${indent}for item in items:`);
  lines.push(safe ? `${indent}${indent}result.append(${validate}(item))` : `${indent}${indent}result.append(item)`);
  if (project.quality.errorHandling > 60) {
    lines.push(`${indent}try:`, `${indent}${indent}return ${fmt}(result)`, `${indent}except (TypeError, ValueError) as exc:`, `${indent}${indent}raise RuntimeError("processing failed") from exc`);
  } else lines.push(`${indent}return ${fmt}(result)`);
  lines.push('', '', `def ${fmt}(items: list[Any]) -> str:`, `${indent}return json.dumps({"count": len(items), "items": items}, sort_keys=True)`);
  lines.push('', '', 'def main() -> int:', `${indent}parser = argparse.ArgumentParser(description=${JSON.stringify(project.name)})`,
    `${indent}parser.add_argument("items", nargs="*", default=["alpha", "beta"])`, `${indent}args = parser.parse_args()`,
    `${indent}print(${process}(args.items))`, `${indent}return 0`, '', '', 'if __name__ == "__main__":', `${indent}raise SystemExit(main())`, '');
  return lines.join('\n');
}

function pythonTest(project, dev) {
  const st = dev.style;
  const validate = fnName(st, 'validate_input');
  const module = project.slug.replace(/-/g, '_');
  return [
    'import unittest', '', `from ${module} import ${validate}`, '', '', 'class BasicTests(unittest.TestCase):',
    `${' '.repeat(st.indent)}def test_accepts_value(self):`, `${' '.repeat(st.indent * 2)}self.assertEqual(${validate}("ok"), "ok")`, '',
    `${' '.repeat(st.indent)}def test_empty_input(self):`, `${' '.repeat(st.indent * 2)}self.assertIsNotNone(${validate}(""))`, '', '',
    'if __name__ == "__main__":', `${' '.repeat(st.indent)}unittest.main()`, ''
  ].join('\n');
}

function jsSource(project, dev) {
  const st = dev.style;
  const indent = ' '.repeat(st.indent || 2);
  const safe = project.quality.security > 55;
  const validate = fnName(st, 'validate_input');
  const run = fnName(st, 'run_task');
  const lines = [
    `/** ${project.name} — ${project.description} */`, '', `export const VERSION = '0.1.0';`, '',
    `export function ${validate}(value) {`,
    `${indent}if (value === undefined || value === null) throw new Error('value is required');`,
    safe ? `${indent}if (String(value).length > 4096) throw new Error('value is too long');` : '',
    `${indent}return value;`, '}', '',
    `export function ${run}(items = []) {`, `${indent}const clean = items.map(item => ${validate}(item));`,
    `${indent}return { count: clean.length, items: clean };`, '}', '',
    `if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('index.js')) {`,
    `${indent}console.log(JSON.stringify(${run}(['alpha', 'beta'])));`, '}', ''
  ];
  return lines.join('\n');
}

function jsTest(project, dev) {
  const run = fnName(dev.style, 'run_task');
  return [
    `import test from 'node:test';`, `import assert from 'node:assert/strict';`, `import { ${run} } from './index.js';`, '',
    `test('processes a list', () => {`, `  assert.deepEqual(${run}(['a', 'b']).count, 2);`, '});', ''
  ].join('\n');
}

function cSource(project, dev) {
  const safe = project.quality.security > 58;
  const indent = ' '.repeat(dev.style.indent || 4);
  const lines = [
    '#include <stdio.h>', safe ? '#include <string.h>' : '', '#include <stdlib.h>', '',
    `/* ${project.name}: ${cap(project.description, 90)} */`, `#define MAX_INPUT ${safe ? '256' : '4096'}`, '',
    `int ${fnName(dev.style, 'validate_input')}(const char *value) {`, `${indent}if (value == NULL) return 0;`,
    safe ? `${indent}if (strlen(value) >= MAX_INPUT) return 0;` : '', `${indent}return 1;`, '}', '',
    `int main(int argc, char **argv) {`, `${indent}const char *value = argc > 1 ? argv[1] : "world";`,
    safe ? `${indent}if (!${fnName(dev.style, 'validate_input')}(value)) {` : '',
    safe ? `${indent}${indent}fprintf(stderr, "invalid input\\n");` : '',
    safe ? `${indent}${indent}return 1;` : '', safe ? `${indent}}` : '',
    `${indent}printf("${project.name}: %s\\n", value);`, `${indent}return 0;`, '}', ''
  ];
  return lines.filter(l => l !== '').join('\n');
}

function cTest() { return ['#include <stdio.h>', '', 'int main(void) {', '    printf("ok\\n");', '    return 0;', '}', ''].join('\n'); }

function goSource(project, dev) {
  const fn = fnName(dev.style, 'RunTask').replace(/-/g, '');
  return [
    'package main', '', 'import (', '\t"fmt"', '\t"strings"', ')', '',
    `// ${project.name}: ${cap(project.description, 88)}`,
    `func ${fn}(items []string) map[string]int {`, '\tclean := make([]string, 0, len(items))', '\tfor _, item := range items {',
    project.quality.security > 55 ? '\t\tif strings.TrimSpace(item) == "" { continue }' : '',
    '\t\tclean = append(clean, item)', '\t}', '\treturn map[string]int{"count": len(clean)}', '}', '',
    'func main() {', `\tfmt.Println(${fn}([]string{"alpha", "beta"}))`, '}', ''
  ].filter(l => l !== '').join('\n');
}

function rustSource(project, dev) {
  const fn = fnName(dev.style, 'run_task').replace(/-/g, '_');
  return [
    `//! ${project.name}: ${cap(project.description, 88)}`, 'use std::collections::HashMap;', '',
    `pub fn ${fn}(items: &[&str]) -> HashMap<&str, usize> {`, '    let mut result = HashMap::new();',
    '    let clean: Vec<&str> = items.iter().copied().filter(|s| !s.trim().is_empty()).collect();',
    '    result.insert("count", clean.len());', '    result', '}', '',
    'fn main() {', `    let result = ${fn}(&["alpha", "beta"]);`, '    println!("{:?}", result);', '}', ''
  ].join('\n');
}

function bashSource(project, dev) {
  const safe = project.quality.security > 55;
  return [
    '#!/usr/bin/env bash', 'set -euo pipefail', '', `# ${project.name}: ${cap(project.description, 88)}`,
    `name="${project.slug}"`, '', 'main() {', '  local value="${1:-world}"',
    safe ? '  if [ "${#value}" -gt 256 ]; then echo "invalid input" >&2; return 1; fi' : '',
    '  printf "%s: %s\\n" "$name" "$value"', '}', '', 'main "$@"', ''
  ].filter(l => l !== '').join('\n');
}

function htmlSource(project) {
  return [
    '<!doctype html>', '<html lang="en">', '<head>', '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${cap(project.name, 60)}</title>`, '  <link rel="stylesheet" href="styles.css">', '</head>', '<body>', '  <main>',
    `    <h1>${cap(project.name, 60)}</h1>`, `    <p>${cap(project.description, 140)}</p>`,
    '    <button id="action">Run</button>', '    <pre id="output"></pre>', '  </main>',
    '  <script src="app.js"></script>', '</body>', '</html>', ''
  ].join('\n');
}

function sqlSource(project, dev) {
  const table = fnName(dev.style, 'item_record').replace(/-/g, '_');
  return [
    `-- ${project.name}: ${cap(project.description, 88)}`, `CREATE TABLE IF NOT EXISTS ${table} (`,
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,', '  name TEXT NOT NULL,',
    '  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP', ');', '',
    `INSERT INTO ${table} (name) VALUES ('alpha'), ('beta');`, '',
    `SELECT id, name FROM ${table} ORDER BY id;`, ''
  ].join('\n');
}

function generateFiles(project, dev) {
  const files = {};
  const license = project.license === 'MIT'
    ? 'MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software to use, copy, modify, and distribute it, provided this notice is included.\n'
    : `${project.license} License\n\nSee the project documentation for the full licence text.\n`;
  const usage = project.language === 'python' ? '```sh\npython3 main.py\n```' :
    ['javascript','typescript'].includes(project.language) ? '```sh\nnode index.js\n```' :
      ['c','cpp'].includes(project.language) ? '```sh\nmake && ./app\n```' :
        project.language === 'go' ? '```sh\ngo run .\n```' :
          project.language === 'rust' ? '```sh\ncargo run\n```' :
            project.language === 'html' ? 'Open index.html in a browser.' : 'Run the script with the matching runtime.';
  files['README.md'] = [
    `# ${project.name}`, '', project.description, '',
    `Language: ${project.language} · Kind: ${project.kind} · Maintainer: @${dev.handle}`, '',
    '## Requirements', ...project.requirements.map(r => `- ${r}`), '', '## Usage', usage, '',
    '## Testing', '```sh\nmake test\n```', '', `License: ${project.license}`, ''
  ].join('\n');
  files['LICENSE'] = license;
  files['.gitignore'] = ['*.pyc', '__pycache__/', 'node_modules/', 'build/', 'dist/', 'target/', '*.o', ''].join('\n');
  switch (project.language) {
    case 'python': {
      const mod = project.slug.replace(/-/g, '_');
      const source = pythonSource(project, dev);
      files[`${mod}.py`] = source;
      files['main.py'] = source.replace('from __future__ import annotations', `from __future__ import annotations\nfrom ${mod} import *`);
      files['test_main.py'] = pythonTest(project, dev);
      files['requirements.txt'] = (project.dependencies.map(d => `${d.name}==${d.version}`).join('\n') || '') + (project.dependencies.length ? '\n' : '');
      files['Makefile'] = 'run:\n\tpython3 main.py\n\ntest:\n\tpython3 -m unittest -v\n\n.PHONY: run test\n';
      break;
    }
    case 'javascript': {
      files['index.js'] = jsSource(project, dev);
      files['test.js'] = jsTest(project, dev);
      files['package.json'] = JSON.stringify({ name: project.slug, version: '0.1.0', type: 'module', main: 'index.js', license: project.license, scripts: { start: 'node index.js', test: 'node --test test.js' }, dependencies: Object.fromEntries(project.dependencies.map(d => [d.name, `^${d.version}`])) }, null, 2) + '\n';
      break;
    }
    case 'typescript': {
      files['index.ts'] = jsSource(project, dev).replace('(value)', '(value: unknown)').replace('(items = [])', '(items: unknown[] = [])');
      files['index.test.ts'] = jsTest(project, dev).replace('./index.js', './index.ts');
      files['tsconfig.json'] = JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', strict: true, outDir: 'dist' }, include: ['*.ts'] }, null, 2) + '\n';
      files['package.json'] = JSON.stringify({ name: project.slug, version: '0.1.0', type: 'module', scripts: { test: 'node --test dist/index.test.js' } }, null, 2) + '\n';
      break;
    }
    case 'c': {
      files['main.c'] = cSource(project, dev);
      files['test.c'] = cTest();
      files['Makefile'] = 'CC=cc\nCFLAGS=-Wall -Wextra -O2\n\nall: app\n\napp: main.c\n\t$(CC) $(CFLAGS) -o app main.c\n\ntest: app\n\t./app test\n\nclean:\n\trm -f app\n\n.PHONY: all test clean\n';
      break;
    }
    case 'cpp': {
      files['main.cpp'] = cSource(project, dev)
        .replace('#include <string.h>\n', '')
        .replace(`printf("${project.name}: %s\\n", value);`, `std::cout << "${project.name}: " << value << "\\n";`)
        .replace('#include <stdio.h>', '#include <iostream>');
      files['test.cpp'] = cTest().replace('#include <stdio.h>', '#include <iostream>').replace('printf("ok\\n");', 'std::cout << "ok\\n";');
      files['Makefile'] = 'CXX=g++\nCXXFLAGS=-std=c++17 -Wall -O2\n\nall: app\n\napp: main.cpp\n\t$(CXX) $(CXXFLAGS) -o app main.cpp\n\ntest: app\n\t./app test\n\n.PHONY: all test clean\n';
      break;
    }
    case 'go': {
      files['main.go'] = goSource(project, dev);
      files['main_test.go'] = ['package main', '', 'import "testing"', '', 'func TestRunTask(t *testing.T) {', `\tresult := ${fnName(dev.style, 'RunTask').replace(/-/g, '')}([]string{"a", "b"})`, '\tif result["count"] != 2 { t.Fatal("unexpected count") }', '}', ''].join('\n');
      files['go.mod'] = `module ${project.slug}\n\ngo 1.24\n`;
      break;
    }
    case 'rust': {
      files['Cargo.toml'] = `[package]\nname = "${project.slug}"\nversion = "0.1.0"\nedition = "2021"\nlicense = "${project.license}"\n`;
      files['src/main.rs'] = rustSource(project, dev);
      files['tests/basic.rs'] = ['#[test]', 'fn basic() {', '    assert_eq!(1 + 1, 2);', '}', ''].join('\n');
      break;
    }
    case 'bash': {
      files[`${project.slug}.sh`] = bashSource(project, dev);
      files['test.sh'] = ['#!/usr/bin/env bash', 'set -euo pipefail', `bash ./${project.slug}.sh test`, ''].join('\n');
      break;
    }
    case 'html': {
      files['index.html'] = htmlSource(project);
      files['styles.css'] = 'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1013;color:#d7e2e8;font-family:system-ui,sans-serif}\nmain{max-width:40rem;padding:2rem}\nbutton{padding:.5rem 1rem;background:#79e6a3;border:0;border-radius:4px}\npre{white-space:pre-wrap}\n';
      files['app.js'] = `document.getElementById('action').addEventListener('click', () => {\n  document.getElementById('output').textContent = ${JSON.stringify(project.name)} + ' is running.';\n});\n`;
      break;
    }
    case 'sql': {
      files[`${project.slug}.sql`] = sqlSource(project, dev);
      files['test.sql'] = `-- smoke test for ${project.name}\nSELECT 1 AS ok;\n`;
      break;
    }
    default: files['main.txt'] = `${project.name}\n${project.description}\n`;
  }
  if (!Object.keys(files).some(f => /test/i.test(f))) {
    files['SMOKE_TEST.md'] = [`# Smoke test for ${project.name}`, '', '1. Start the project with the command in README.md.', '2. Confirm the documented entry point responds without an error.', '3. Record the result in an issue if it does not.', ''].join('\n');
  }
  if (project.quality.documentation > 72) {
    files['ARCHITECTURE.md'] = [
      `# ${project.name} architecture`, '', `This project follows a ${project.quality.organization > 70 ? 'layered' : 'flat'} layout.`, '',
      '- entry point and command handling', '- core processing module', '- persistence and configuration boundary',
      '- automated smoke tests', '', `Known technical debt: ${Math.round(project.quality.debt)}/100.`, ''
    ].join('\n');
  }
  if (project.dependencies.length) {
    files['DEPENDENCIES.md'] = ['# Dependencies', '', ...project.dependencies.map(d => `- ${d.name} ${d.version}${d.vulnerable ? ' (advisory published)' : ''}`), ''].join('\n');
  }
  return files;
}

function seedFiles(project, dev, rng) {
  project.files = generateFiles(project, dev);
  const errors = validateFiles(project.files);
  if (errors) {
    project.files['SAFETY.md'] = `Generated source failed ${errors} static check(s); a minimal scaffold is published until the maintainer fixes it.\n`;
    project.quality.testing = clampv(project.quality.testing - 12);
  }
  project.metrics.files = Object.keys(project.files).length;
  project.metrics.lines = Object.values(project.files).reduce((s, c) => s + String(c).split('\n').length, 0);
  project.status = 'writing';
  project.phase = 1;
  project.releases.push({ version: '0.1.0', world: project.createdWorld || 0, notes: 'Initial source import.', signed: project.quality.security > 62, vulnerabilities: 0 });
  project.metrics.releases = 1;
  commit(project, 'initial import', Object.keys(project.files), rng);
  remember(dev, project.createdWorld || 0, `Wrote ${project.metrics.files} source files for ${project.name}.`);
  return project;
}

function validateFiles(files) {
  let errors = 0;
  for (const [path, content] of Object.entries(files)) {
    if (!/\.(py|js|ts|c|cpp|go|rs|sh|sql|html|css|json)$/.test(path)) continue;
    const id = languageFor(path, content).id;
    for (const p of lint(content, id, path)) if (p.severity === 'error') errors++;
  }
  return errors;
}

function commit(project, message, filesChanged, rng) {
  const hash = Math.abs(hash32(`${project.id}-${message}-${project.git.commits.length}-${rng.int(0, 99999)}`)).toString(16).padStart(8, '0').slice(0, 8);
  project.git.commits.push({ id: hash, message: cap(message, 120), world: project.updatedWorld, files: (filesChanged || Object.keys(project.files)).slice(0, 30) });
  bounded(project.git.commits, 80);
}

function publishProject(game, dw, project) {
  if (!game.repos) game.repos = [];
  let repo = game.repos.find(r => r.name === project.slug);
  if (!repo) {
    repo = { name: project.slug, domain: 'git.nullnet', owner: project.ownerHandle, stars: 0, lang: project.language, desc: project.description, files: {} };
    game.repos.push(repo);
  }
  repo.files = { ...project.files };
  repo.lang = project.language;
  repo.desc = project.description;
  repo.owner = project.ownerHandle;
  repo.projectId = project.id;
  repo.developerId = project.ownerId;
  repo.version = project.releases.length ? project.releases[project.releases.length - 1].version : '0.1.0';
  project.published = true;
  project.repo = repo;
  if (game.repos.length > 160) game.repos.splice(0, game.repos.length - 160);
  return repo;
}

/* ---------------- labs and authorization ---------------- */
function buildLabs(game, dw, rng) {
  const defs = [
    ['sandbox.nullnet', 'Public cyber range', 'public', 'isolated lab for authorized practice'],
    ['campus.meridian', 'University security laboratory', 'university-lab', 'supervised academic testing environment'],
    ['range.harbor', 'Harbor defensive range', 'cyber-range', 'incident response and forensics drills']
  ];
  for (const [domain, name, kind, desc] of defs) {
    dw.labs.push({
      id: nextId(dw, 'lab'), domain, name, kind, desc, status: 'online',
      targets: ['range-gw', 'range-web', 'range-db', 'range-edge'], authorizedHandles: [],
      openWorld: game.worldMinutes || 0, expiresWorld: null, sessions: 0, exploitsPracticed: 0,
      createdWorld: game.worldMinutes || 0
    });
  }
  for (const server of (game.servers || []).slice(0, 220)) {
    if (server.authz) continue;
    const uni = /university|institute|college|academ|laboratory/i.test(server.org || '');
    const lab = /lab|range|test|stage|sandbox/i.test((server.tags || []).join(' ') + ' ' + (server.role || ''));
    server.authz = {
      classification: lab ? 'cyber-range' : uni ? 'university-lab' : server.owned ? 'player' : 'npc',
      authorizedHandles: server.owned ? [game.player.handle] : [],
      monitoring: clampv(Math.round((server.security || 50) * .9 + rng.int(-10, 12))),
      logging: rng.chance(.72), lastReviewWorld: 0
    };
  }
}

export function assetClassification(game, asset) {
  if (!asset) return 'unknown';
  if (asset.authz?.classification) return asset.authz.classification;
  if (asset.owned || asset.ownerType === 'player' || asset.ownerId === 'player') return 'player';
  if (asset.kind === 'lab' || asset.domain?.includes('range') || asset.domain?.includes('sandbox')) return 'cyber-range';
  if (/university|institute|college|academ|laboratory/i.test(asset.org || asset.name || '')) return 'university-lab';
  if (asset.companyId || asset.ownerType === 'company') return 'company';
  if (asset.public === true || asset.ownerType === 'npc') return 'public';
  return 'npc';
}

export function evaluateAuthorization(game, opts = {}) {
  const asset = opts.asset || null;
  const classification = opts.classification || assetClassification(game, asset);
  const action = opts.action || 'scan';
  const handle = opts.handle || game.player?.handle || 'operator';
  const scope = opts.scope || (asset?.authz?.authorizedHandles || []);
  const lab = classification === 'cyber-range' || classification === 'university-lab';
  const owned = classification === 'player' || scope.includes(handle);
  const publicRead = ['scan','inspect','dns','http','trace'].includes(action) && classification === 'public';
  const allowed = owned || lab || publicRead;
  const monitoring = clampv(asset?.authz?.monitoring ?? (asset?.security || 50) * .9);
  const roll = typeof opts.roll === 'number' ? opts.roll : 0;
  const detected = !allowed && monitoring > 0 && roll < monitoring / 100;
  const consequences = [];
  if (!allowed) consequences.push({ type: 'heat', amount: action === 'exploit' ? 14 : 6, reason: `${action} against ${classification} asset without authorization` });
  if (detected) consequences.push({ type: 'investigation', reason: `intrusion detection on ${asset?.host || asset?.domain || classification}` });
  return { allowed, classification, action, monitoring, detected, consequences, reason: allowed ? (owned ? 'owner or named tester' : lab ? 'authorized laboratory' : 'public read') : 'no authorization record' };
}

/* ---------------- vulnerability lifecycle ---------------- */
function vulnerabilityFromProject(game, dw, project, rng, discoveredBy) {
  if (dw.vulns.length >= DEV_CAPS.vulns) return null;
  const candidates = VULN_CATEGORIES.filter(c => {
    if (c[3] === 'dependency') return project.dependencies.some(d => d.vulnerable);
    if (c[3] === 'memory') return ['c','cpp','rust'].includes(project.language);
    if (c[3] === 'crypto') return !!project.architecture.auth || project.language !== 'html';
    return c[3] === 'config' || project.quality.security < 78;
  });
  if (!candidates.length) return null;
  const cat = chooseWeighted(rng, candidates, c => (c[2] === 'critical' ? 2 : 1) * (project.quality.security < 45 ? 2 : 1));
  const file = Object.keys(project.files).find(f => /\.(py|js|ts|c|cpp|go|rs|sh|sql|html)$/.test(f)) || 'README.md';
  const lines = (project.files[file] || '').split('\n');
  const line = Math.max(1, rng.int(1, Math.max(2, Math.min(80, lines.length))));
  const cvss = cat[2] === 'critical' ? rng.float(9, 10) : cat[2] === 'high' ? rng.float(7, 8.9) : cat[2] === 'medium' ? rng.float(4, 6.9) : rng.float(1, 3.9);
  const vuln = {
    id: `DV-${String(dw.seq.vuln++).padStart(4, '0')}`,
    cve: `CVE-${worldYear(game)}-${rng.int(1000, 99999)}`,
    projectId: project.id, projectName: project.name, file, line,
    category: cat[0], technical: cat[1], severity: cat[2], cvss: Math.round(cvss * 10) / 10,
    affectedVersion: project.releases.length ? project.releases[project.releases.length - 1].version : '0.1.0',
    discoveredWorld: game.worldMinutes || 0, discoveredBy,
    preconditions: rng.pick(['network reachability to the service','an authenticated low-privilege account','a crafted request reaching the public endpoint','a user opening a prepared document']),
    impact: rng.pick(['unauthorized data access','service disruption','credential exposure','remote code execution in the simulated process']),
    detection: rng.pick(['static analysis of the input handling path','a targeted request that returns an unexpected response','review of the generated configuration','dependency manifest cross-reference']),
    remediation: rng.pick(['validate and encode all input before use','apply the upstream patch and bump the pinned version','remove the unsafe default and require explicit configuration','add an authorization check before the handler']),
    patchAvailable: false, patchWorld: null, exploitability: clampv(Math.round(cvss * 8 + rng.int(-8, 8))),
    status: 'open', introducedBy: project.ownerHandle, introducedWorld: project.createdWorld,
    exploitCount: 0, reports: 0, confirmed: true
  };
  dw.vulns.push(vuln);
  bounded(dw.vulns, DEV_CAPS.vulns);
  project.issues.push({ id: nextId(dw, 'report'), title: `${vuln.category} in ${file}`, severity: vuln.severity, status: 'open', openedWorld: game.worldMinutes || 0, openedBy: discoveredBy, vulnId: vuln.id });
  bounded(project.issues, 40);
  pushEvent(dw, { world: game.worldMinutes || 0, category: 'security', title: `${vuln.cve}: ${vuln.category} in ${project.name}`, body: `${vuln.technical} Reported by ${discoveredBy}. Severity ${vuln.severity}.`, actors: [discoveredBy, project.ownerHandle], severity: vuln.severity, targetId: project.id, major: vuln.severity === 'critical' });
  return vuln;
}

function publishAdvisory(game, dw, vuln) {
  if (dw.advisories.length >= DEV_CAPS.advisories) return;
  const advisory = {
    id: nextId(dw, 'adv'), vulnId: vuln.id, cve: vuln.cve, title: `${vuln.category} in ${vuln.projectName}`,
    severity: vuln.severity, publishedWorld: game.worldMinutes || 0, publishedBy: vuln.discoveredBy,
    affectedVersion: vuln.affectedVersion, summary: vuln.technical, remediation: vuln.remediation,
    patchAvailable: false, status: 'published'
  };
  dw.advisories.push(advisory);
  bounded(dw.advisories, DEV_CAPS.advisories);
  if (game.internet?.security?.advisories && game.internet.security.advisories.length < 180) {
    game.internet.security.advisories.push({
      id: advisory.id, cve: vuln.cve, title: advisory.title, product: vuln.projectName,
      severity: vuln.severity, affected: vuln.file, status: 'published',
      publishedWorld: game.worldMinutes || 0, patchedWorld: null, cvss: vuln.cvss,
      exploited: false, advisoryBy: vuln.discoveredBy
    });
  }
}

function patchVulnerability(game, dw, project, vuln, dev, rng) {
  if (vuln.status === 'patched') return;
  vuln.status = 'patched';
  vuln.patchWorld = game.worldMinutes || 0;
  vuln.patchAvailable = true;
  const issue = project.issues.find(i => i.vulnId === vuln.id);
  if (issue) issue.status = 'resolved';
  const version = bumpVersion(project.releases.length ? project.releases[project.releases.length - 1].version : '0.1.0');
  const notes = `Fix ${vuln.category} reported as ${vuln.cve}.`;
  project.releases.push({ version, world: game.worldMinutes || 0, notes, signed: project.quality.security > 62, vulnerabilities: 0 });
  bounded(project.releases, 40);
  const first = Object.keys(project.files)[0];
  if (first && /\.(py|js|ts|c|cpp|go|rs|sh|html)$/.test(first)) {
    const prefix = ['py','sh','sql'].includes(first.split('.').pop()) ? `# SECURITY: ${vuln.category} patched in ${version}\n` : `// SECURITY: ${vuln.category} patched in ${version}\n`;
    if (!project.files[first].includes('SECURITY:')) project.files[first] = prefix + project.files[first];
  }
  commit(project, `patch ${vuln.cve}: ${vuln.category}`, [first].filter(Boolean), rng);
  publishProject(game, dw, project);
  for (const a of dw.advisories) if (a.vulnId === vuln.id) { a.patchAvailable = true; a.status = 'patched'; }
  const ext = game.internet?.security?.advisories?.find(a => a.cve === vuln.cve);
  if (ext) { ext.status = 'patched'; ext.patchedWorld = game.worldMinutes || 0; }
  project.metrics.bugsFixed++;
  if (dev) { dev.bugsFixed++; dev.reputation = clampv(dev.reputation + 2); remember(dev, game.worldMinutes || 0, `Patched ${vuln.cve} in ${project.name} (${version}).`); }
  pushEvent(dw, { world: game.worldMinutes || 0, category: 'security', title: `${project.name} ${version} released`, body: notes, actors: [dev?.handle || project.ownerHandle], targetId: project.id, major: vuln.severity === 'critical' });
}

function bumpVersion(v) { const [a, b, c] = String(v).split('.').map(Number); return `${a}.${b}.${(c || 0) + 1}`; }
function seedInitialVulns(game, dw, rng) {
  for (const project of dw.projects.filter(p => p.published).slice(0, 5)) {
    if (project.quality.security > 82 && !project.dependencies.some(d => d.vulnerable)) continue;
    const researcher = dw.developers.find(d => /security|research/i.test(d.role)) || dw.developers[0];
    const vuln = vulnerabilityFromProject(game, dw, project, rng, researcher?.handle || 'community');
    if (vuln) publishAdvisory(game, dw, vuln);
  }
}

/* ---------------- lifecycle ---------------- */
const PHASES = ['planning','writing','testing','debugging','building','publishing','feedback','maintenance','mature'];

function advanceProject(game, dw, project, dev, rng, step) {
  const skill = (dev?.skill || 45) / 100;
  const effort = clamp(.25 + skill * .6 + (project.detailed ? .2 : 0), .2, 1.2) * step;
  project.phaseProgress += effort * rng.float(1.2, 3.4);
  project.updatedWorld = game.worldMinutes || 0;
  if (dev) dev.lastActiveWorld = game.worldMinutes || 0;
  if (project.phaseProgress >= 100 && project.phase < PHASES.length - 1) {
    project.phaseProgress = 0;
    project.phase++;
    project.status = PHASES[project.phase] || 'maintenance';
    if (dev) { dev.decisions++; remember(dev, game.worldMinutes || 0, `${project.name} moved to ${project.status}.`); }
    pushEvent(dw, { world: game.worldMinutes || 0, category: 'development', title: `${project.name} entered ${project.status}`, body: `${project.ownerHandle} advanced the project with ${Object.keys(project.files).length} files.`, actors: [project.ownerHandle], targetId: project.id });
  }
  switch (project.status) {
    case 'writing': {
      if (!Object.keys(project.files).length) {
        const fallback = { style: { indent: 4, comments: 30, naming: 'snake_case' }, skill: 50 };
        project.files = generateFiles(project, dev || fallback);
        const errors = validateFiles(project.files);
        if (errors) {
          project.files['SAFETY.md'] = `Generated source failed ${errors} static check(s); a minimal scaffold is published until the maintainer fixes it.\n`;
          project.quality.testing = clampv(project.quality.testing - 12);
          project.metrics.bugsOpen++;
        }
        project.metrics.files = Object.keys(project.files).length;
        commit(project, 'initial import', Object.keys(project.files), rng);
        if (dev) remember(dev, game.worldMinutes || 0, `Wrote ${project.metrics.files} source files for ${project.name}.`);
      } else if (project.detailed && rng.chance(.35)) {
        const patchFile = Object.keys(project.files).find(f => /\.(py|js|ts|c|go|rs|sh)$/.test(f));
        if (patchFile) {
          const note = ['py','sh'].includes(patchFile.split('.').pop()) ? `# revision: ${rng.pick(PROJECT_WORDS)}\n` : `// revision: ${rng.pick(PROJECT_WORDS)}\n`;
          if (!project.files[patchFile].includes('revision:')) project.files[patchFile] = note + project.files[patchFile];
          commit(project, rng.pick(COMMIT_MESSAGES), [patchFile], rng);
        }
      }
      break;
    }
    case 'testing': {
      if (game.worldMinutes - (project.lastTestWorld || 0) < 180) break;
      project.lastTestWorld = game.worldMinutes || 0;
      const pass = rng.chance(clamp(.35 + project.quality.testing / 160, .2, .95));
      project.metrics.builds++;
      if (!pass) {
        project.metrics.bugsOpen++;
        project.bugs.push({ id: nextId(dw, 'review'), title: rng.pick(['empty input crashes the parser','retry loop never exits','configuration default is unsafe','memory grows with each request']), status: 'open', openedWorld: game.worldMinutes || 0 });
        bounded(project.bugs, 30);
        if (dev) { dev.bugsFound++; remember(dev, game.worldMinutes || 0, `A test failed in ${project.name}.`); }
        pushEvent(dw, { world: game.worldMinutes || 0, category: 'development', title: `${project.name} test failure`, body: 'The test suite exposed a defect. The maintainer opened an issue.', actors: [project.ownerHandle], targetId: project.id });
      } else project.metrics.coverage = clampv(project.metrics.coverage + rng.int(2, 9));
      break;
    }
    case 'debugging': {
      if (!project.bugs.length) break;
      if (rng.chance(clamp(.2 + skill * .5, .1, .85))) {
        const bug = project.bugs.shift();
        bug.status = 'fixed';
        project.metrics.bugsOpen = Math.max(0, project.metrics.bugsOpen - 1);
        project.metrics.bugsFixed++;
        commit(project, `fix: ${bug.title}`, [Object.keys(project.files)[0]].filter(Boolean), rng);
        if (dev) { dev.bugsFixed++; remember(dev, game.worldMinutes || 0, `Fixed "${bug.title}" in ${project.name}.`); }
      }
      break;
    }
    case 'building': {
      if (rng.chance(.4)) {
        const version = project.releases.length ? bumpVersion(project.releases[project.releases.length - 1].version) : '0.1.0';
        project.releases.push({ version, world: game.worldMinutes || 0, notes: rng.pick(['First public build.','Stability improvements.','Small compatibility release.']), signed: project.quality.security > 62, vulnerabilities: 0 });
        bounded(project.releases, 40);
        project.metrics.releases++;
        project.metrics.builds++;
        publishProject(game, dw, project);
        pushEvent(dw, { world: game.worldMinutes || 0, category: 'development', title: `${project.name} ${version} published`, body: `A ${project.language} build was released from ${project.repoPath}.`, actors: [project.ownerHandle], targetId: project.id });
      }
      break;
    }
    case 'publishing':
      publishProject(game, dw, project);
      project.metrics.downloads += rng.int(5, 180);
      project.metrics.stars += rng.chance(.4) ? rng.int(1, 6) : 0;
      if (rng.chance(.2) && createFork(game, dw, project, rng)) project.metrics.forks++;
      break;
    case 'feedback':
    case 'maintenance':
    case 'mature': {
      project.metrics.downloads += rng.int(2, 120);
      if (rng.chance(.06)) project.metrics.stars += rng.int(1, 4);
      if (rng.chance(.08) && dev) {
        const contributor = dw.developers.find(d => d.id !== dev.id && d.status === 'active' && Object.keys(d.languages || {}).includes(project.language));
        if (contributor) {
          const contribution = {
            id: nextId(dw, 'contrib'), projectId: project.id, contributorId: contributor.id, handle: contributor.handle,
            world: game.worldMinutes || 0, change: rng.pick(['documentation clarification','small bug fix','additional test case','dependency version bump']),
            status: rng.chance(.72) ? 'merged' : 'open', lines: rng.int(1, 34)
          };
          dw.contributions.push(contribution);
          bounded(dw.contributions, DEV_CAPS.contributions);
          project.metrics.contributions++;
          if (contribution.status === 'merged') commit(project, `merge: ${contribution.change} from @${contributor.handle}`, [Object.keys(project.files)[0]].filter(Boolean), rng);
          remember(contributor, game.worldMinutes || 0, `Submitted a ${contribution.change} to ${project.name}.`);
        }
      }
      if (project.status === 'mature' && rng.chance(.004)) {
        project.status = 'abandoned';
        pushEvent(dw, { world: game.worldMinutes || 0, category: 'development', title: `${project.name} is now unmaintained`, body: `The last commit was ${age(project.updatedWorld, game.worldMinutes)} days ago. Dependents should review their supply chain.`, actors: [project.ownerHandle], targetId: project.id });
      }
      break;
    }
    default: break;
  }
}

function createFork(game, dw, project, rng) {
  const candidates = dw.developers.filter(d => d.id !== project.ownerId && d.status === 'active');
  const forkDev = chooseWeighted(rng, candidates, d => (d.languages[project.language] || 10) + (d.role.includes('security') ? 4 : 0));
  if (!forkDev || dw.projects.length >= DEV_CAPS.projects) return null;
  const fork = {
    ...JSON.parse(JSON.stringify(project)),
    id: nextId(dw, 'project'), name: `${project.name}-fork`, slug: `${project.slug}-fork-${rng.int(2, 99)}`,
    ownerId: forkDev.id, ownerHandle: forkDev.handle, ownerName: forkDev.name,
    createdWorld: game.worldMinutes || 0, updatedWorld: game.worldMinutes || 0,
    status: 'maintenance', detailed: false, phase: 6, phaseProgress: 0,
    files: JSON.parse(JSON.stringify(project.files)),
    git: { branch: 'main', commits: [], tags: [], prs: [] },
    issues: [], releases: [], metrics: { ...defaultProjectMetrics(), downloads: 0, stars: 0 },
    nextCycleWorld: (game.worldMinutes || 0) + rng.int(200, 1000), published: false
  };
  dw.projects.push(fork);
  forkDev.projects.push(fork.id);
  commit(fork, `fork of ${project.name}@${project.slug}`, Object.keys(fork.files), rng);
  publishProject(game, dw, fork);
  remember(forkDev, game.worldMinutes || 0, `Forked ${project.name} after its ${project.releases.length} releases.`);
  return fork;
}

function securityResearch(game, dw, rng) {
  const researchers = dw.developers.filter(d => /security|research|analyst/i.test(d.role) && d.status === 'active');
  if (!researchers.length) return null;
  const researcher = rng.pick(researchers);
  const targets = dw.projects.filter(p => p.published && p.status !== 'abandoned' && (p.quality.security < 70 || p.dependencies.some(d => d.vulnerable) || p.issues.length > 0));
  if (!targets.length) return null;
  const target = chooseWeighted(rng, targets, p => 1 + (100 - p.quality.security) / 60 + p.metrics.downloads / 20000);
  if (!rng.chance(clamp(.18 + researcher.skill / 500 + (100 - target.quality.security) / 400, .05, .7))) return null;
  if (dw.vulns.filter(v => v.projectId === target.id && v.status !== 'patched').length >= 2) return null;
  const vuln = vulnerabilityFromProject(game, dw, target, rng, researcher.handle);
  if (!vuln) return null;
  researcher.bugsFound++;
  researcher.reputation = clampv(researcher.reputation + 3);
  remember(researcher, game.worldMinutes || 0, `Discovered ${vuln.cve} in ${target.name} (${vuln.category}).`);
  publishAdvisory(game, dw, vuln);
  return { vuln, target, researcher };
}

function maintenancePass(game, dw, rng) {
  const open = dw.vulns.filter(v => v.status === 'open');
  if (!open.length) return;
  const vuln = chooseWeighted(rng, open, v => (v.severity === 'critical' ? 3 : v.severity === 'high' ? 2 : 1) * (1 + (dw.projects.find(p => p.id === v.projectId)?.metrics.downloads || 0) / 50000));
  const project = dw.projects.find(p => p.id === vuln.projectId);
  if (!project || project.status === 'abandoned') return;
  const dev = dw.developers.find(d => d.id === project.ownerId);
  const chance = clamp(.1 + (dev?.skill || 40) / 250 + (project.quality.maintainability || 40) / 400 + (vuln.severity === 'critical' ? .18 : 0), .05, .85);
  if (rng.chance(chance)) patchVulnerability(game, dw, project, vuln, dev, rng);
}

function dynamicEvent(game, dw, rng) {
  const projects = dw.projects.filter(p => p.published);
  if (!projects.length) return null;
  const project = rng.pick(projects);
  const dev = dw.developers.find(d => d.id === project.ownerId);
  const templates = [
    () => ({ title: `${project.name} receives a maintenance release`, body: `${dev?.handle || project.ownerHandle} published a patch with ${rng.int(1, 8)} small fixes.`, category: 'development' }),
    () => ({ title: `A dependency of ${project.name} is now unmaintained`, body: `${rng.pick(project.dependencies)?.name || 'a transitive package'} has not been updated in months. Maintainers are evaluating alternatives.`, category: 'security' }),
    () => ({ title: `A security firm recruits from ${project.name}`, body: `${dev?.name || project.ownerHandle} was approached after publishing the project's security notes.`, category: 'people' }),
    () => ({ title: `${project.name} enters an organization's toolchain`, body: `Operators at a mid-sized provider began using ${project.name} for routine checks.`, category: 'adoption' }),
    () => {
      const vuln = vulnerabilityFromProject(game, dw, project, rng, rng.pick(dw.developers)?.handle || 'community');
      if (!vuln) return null;
      publishAdvisory(game, dw, vuln);
      return { title: `${vuln.cve} disclosed in ${project.name}`, body: vuln.technical, category: 'security' };
    }
  ];
  const picked = rng.pick(templates)();
  if (!picked) return null;
  pushEvent(dw, { world: game.worldMinutes || 0, ...picked, actors: [project.ownerHandle], targetId: project.id, severity: picked.category === 'security' ? 'moderate' : 'minor' });
  return picked;
}

function advanceBucket(dw, key, interval, world, max = 8) {
  const bucket = Math.floor(world / interval);
  const prev = dw.cadence[key] || 0;
  if (bucket <= prev) return 0;
  const steps = Math.min(max, bucket - prev);
  dw.cadence[key] = prev + steps;
  return steps;
}

export function recomputeDevMetrics(game, dw = ensureDevWorld(game)) {
  const active = dw.developers.filter(d => d.status === 'active').length;
  const secure = dw.developers.filter(d => /security|research|analyst/i.test(d.role)).length;
  const published = dw.projects.filter(p => p.published).length;
  const detailed = dw.projects.filter(p => p.detailed && Object.keys(p.files).length).length;
  const openVulns = dw.vulns.filter(v => v.status === 'open').length;
  const patched = dw.vulns.filter(v => v.status === 'patched').length;
  const lines = dw.projects.reduce((s, p) => s + (p.metrics.lines || 0), 0);
  const files = dw.projects.reduce((s, p) => s + Object.keys(p.files || {}).length, 0);
  const quality = dw.projects.length ? dw.projects.reduce((s, p) => s + (p.quality.security || 0), 0) / dw.projects.length : 0;
  dw.metrics = {
    activeDevelopers: active, securityProfessionals: secure, publishedProjects: published,
    detailedProjects: detailed, files, lines, openVulns, patchedVulns: patched,
    advisories: dw.advisories.length, contributions: dw.contributions.length,
    averageSecurity: Math.round(quality), year: worldYear(game)
  };
  return dw.metrics;
}

export function tickDevWorld(game, minutes = 1, rng = null) {
  const dw = ensureDevWorld(game);
  rng = rng || devRng(game, 0xa11ce);
  const events = [];
  const world = game.worldMinutes || 0;
  const projectSteps = advanceBucket(dw, 'projects', 360, world, 6);
  for (let step = 0; step < projectSteps; step++) {
    for (const project of dw.projects.filter(p => p.detailed && p.status !== 'abandoned').slice(0, 10)) {
      const dev = dw.developers.find(d => d.id === project.ownerId);
      if (dev && (dev.status === 'active' || project.status === 'maintenance')) advanceProject(game, dw, project, dev, rng, 1);
      else advanceProject(game, dw, project, null, rng, .45);
    }
    for (const project of dw.projects.filter(p => !p.detailed && p.status !== 'abandoned').slice(0, 20)) advanceProject(game, dw, project, null, rng, .25);
  }
  for (let step = 0; step < advanceBucket(dw, 'research', 720, world, 4); step++) {
    const result = securityResearch(game, dw, rng);
    if (result) {
      events.push({ type: 'feed', text: `${result.vuln.cve} disclosed in ${result.vuln.projectName}.`, kind: 'warn' });
      events.push({ type: 'news', headline: `${result.vuln.cve}: ${result.vuln.category} in ${result.vuln.projectName}`, body: result.vuln.technical, source: 'DevSec Wire' });
    }
  }
  for (let step = 0; step < advanceBucket(dw, 'patch', 1440, world, 3); step++) {
    const before = dw.vulns.filter(v => v.status === 'open').length;
    maintenancePass(game, dw, rng);
    if (dw.vulns.filter(v => v.status === 'open').length < before) events.push({ type: 'feed', text: 'An open advisory received a maintainer patch.', kind: 'info' });
  }
  for (let step = 0; step < advanceBucket(dw, 'events', 1440, world, 3); step++) {
    const e = dynamicEvent(game, dw, rng);
    if (e) {
      events.push({ type: 'feed', text: e.title, kind: e.category === 'security' ? 'warn' : 'info' });
      if (e.category === 'security') events.push({ type: 'news', headline: e.title, body: e.body, source: 'The Packet' });
    }
  }
  for (const p of dw.projects) if (p.detailed) p.metrics.lines = Object.values(p.files).reduce((s, content) => s + String(content).split('\n').length, 0);
  recomputeDevMetrics(game, dw);
  bounded(dw.projects, DEV_CAPS.projects);
  bounded(dw.developers, DEV_CAPS.developers);
  return events;
}

/* ---------------- reads ---------------- */
export function devOverview(game) {
  const dw = ensureDevWorld(game);
  return {
    dw, metrics: recomputeDevMetrics(game, dw),
    developers: dw.developers.slice().sort((a, b) => b.reputation - a.reputation),
    projects: dw.projects.slice().sort((a, b) => b.metrics.downloads - a.metrics.downloads),
    advisories: dw.advisories.slice().reverse(), events: dw.events.slice().reverse(), labs: dw.labs.slice()
  };
}
export function developerList(game, query = '') {
  const dw = ensureDevWorld(game);
  const q = String(query || '').toLowerCase();
  return dw.developers.filter(d => !q || `${d.handle} ${d.name} ${d.role} ${Object.keys(d.languages).join(' ')}`.toLowerCase().includes(q)).sort((a, b) => b.skill - a.skill);
}
export function projectList(game, query = '') {
  const dw = ensureDevWorld(game);
  const q = String(query || '').toLowerCase();
  return dw.projects.filter(p => !q || `${p.name} ${p.slug} ${p.language} ${p.kind} ${p.ownerHandle}`.toLowerCase().includes(q)).sort((a, b) => b.metrics.downloads - a.metrics.downloads);
}
export function projectDetail(game, query) {
  const dw = ensureDevWorld(game);
  const q = String(query || '').toLowerCase();
  const p = dw.projects.find(x => x.id === q || x.slug === q || x.name.toLowerCase() === q || x.repoPath.toLowerCase().includes(q));
  if (!p) return null;
  const dev = dw.developers.find(d => d.id === p.ownerId) || null;
  const vulns = dw.vulns.filter(v => v.projectId === p.id);
  return { project: p, developer: dev, vulns, advisories: dw.advisories.filter(a => vulns.some(v => v.id === a.vulnId)) };
}
export function vulnList(game, query = '') {
  const dw = ensureDevWorld(game);
  const q = String(query || '').toLowerCase();
  return dw.vulns.filter(v => !q || `${v.id} ${v.cve} ${v.category} ${v.projectName} ${v.severity}`.toLowerCase().includes(q)).sort((a, b) => b.discoveredWorld - a.discoveredWorld);
}
export function labList(game) { return ensureDevWorld(game).labs.slice(); }
export function contributionList(game) { return ensureDevWorld(game).contributions.slice().reverse(); }

/* ---------------- player actions ---------------- */
function spend(game, amount, memo) {
  const cost = Math.max(0, Math.round(amount));
  if (cost > (game.player?.money || 0)) return false;
  game.player.money -= cost;
  if (game.stats) game.stats.spent += cost;
  if (game.player.transactions) game.player.transactions.unshift({ time: Date.now(), amount: -cost, memo, balance: game.player.money });
  return true;
}
function recordCodingReward(game, kind) { if (game.coding?.counts) game.coding.counts[kind] = (game.coding.counts[kind] || 0) + 1; }

export function playerCloneProject(game, query) {
  const hit = projectDetail(game, query);
  if (!hit) return { ok: false, error: `No project matching '${query || ''}'.` };
  if (!hit.project.published) return { ok: false, error: 'That project has not been published yet.' };
  return { ok: true, project: hit.project, files: JSON.parse(JSON.stringify(hit.project.files)), dest: `/home/operator/${hit.project.slug}` };
}
export function playerContribute(game, query, change, lines = 8) {
  const dw = ensureDevWorld(game);
  const hit = projectDetail(game, query);
  if (!hit) return { ok: false, error: 'No such project.' };
  if (hit.project.status === 'abandoned') return { ok: false, error: 'That project is abandoned; nobody is reviewing contributions.' };
  const contribution = {
    id: nextId(dw, 'contrib'), projectId: hit.project.id, contributorId: 'player', handle: game.player.handle,
    world: game.worldMinutes || 0, change: cap(change || 'small improvement', 90), lines: clamp(Math.round(Number(lines) || 8), 1, 120),
    status: 'open', reviewWorld: (game.worldMinutes || 0) + 240
  };
  dw.contributions.push(contribution);
  bounded(dw.contributions, DEV_CAPS.contributions);
  hit.project.metrics.contributions++;
  pushEvent(dw, { world: game.worldMinutes || 0, category: 'development', title: `${game.player.handle} contributed to ${hit.project.name}`, body: contribution.change, actors: [game.player.handle], targetId: hit.project.id });
  if (hit.developer) remember(hit.developer, game.worldMinutes || 0, `@${game.player.handle} submitted "${contribution.change}" to ${hit.project.name}.`);
  recordCodingReward(game, 'review');
  return { ok: true, contribution, project: hit.project };
}
export function playerReportVulnerability(game, query, category) {
  const dw = ensureDevWorld(game);
  const hit = projectDetail(game, query);
  if (!hit) return { ok: false, error: 'No such project.' };
  const cat = VULN_CATEGORIES.find(c => c[0] === String(category || '').toLowerCase()) || VULN_CATEGORIES[Math.abs(hash32(`${dw.vulns.length}-${dw.events.length}`)) % VULN_CATEGORIES.length];
  const existing = dw.vulns.find(v => v.projectId === hit.project.id && v.category === cat[0] && v.status !== 'patched');
  if (existing) { existing.reports++; return { ok: true, vuln: existing, duplicate: true }; }
  const vuln = vulnerabilityFromProject(game, dw, hit.project, devRng(game, 0x1234), game.player.handle);
  if (!vuln) return { ok: false, error: 'You could not substantiate a defect in that project.' };
  vuln.category = cat[0]; vuln.technical = cat[1]; vuln.severity = cat[2]; vuln.reports = 1;
  publishAdvisory(game, dw, vuln);
  recordCodingReward(game, 'review');
  if (game.player.reputation != null) game.player.reputation = clampv(game.player.reputation + 2);
  return { ok: true, vuln, duplicate: false };
}
export function playerPublishTool(game, name, language = 'python') {
  const dw = ensureDevWorld(game);
  const clean = slugify(name) || '';
  if (clean.length < 3) return { ok: false, error: 'Tool name must be at least three characters.' };
  if (dw.projects.some(p => p.slug === clean)) return { ok: false, error: 'A project with that name already exists.' };
  if (dw.projects.length >= DEV_CAPS.projects) return { ok: false, error: 'The development index is full.' };
  if (!spend(game, 80, `publish tool ${clean}`)) return { ok: false, error: 'Publishing a tool costs $80.' };
  const rng = devRng(game, 0x777);
  const fakeDev = {
    id: 'player-dev', handle: game.player.handle, name: game.player.name || game.player.handle,
    style: { indent: 4, comments: 40, naming: 'snake_case' }, skill: 55,
    reputation: game.player.reputation || 10, languages: { [language]: 60 }
  };
  const lang = LANGS.some(l => l.id === language) ? language : 'python';
  const project = {
    id: nextId(dw, 'project'), name: clean, slug: clean, ownerId: 'player-dev', ownerHandle: game.player.handle,
    ownerName: fakeDev.name, orgId: null, kind: 'security', language: lang,
    description: `A security tool published by @${game.player.handle}.`, status: 'released',
    phase: 6, phaseProgress: 0, detailed: true,
    architecture: { modules: [], dependencies: [], database: null, auth: null, api: null, style: 'snake_case', target: 'local workstation' },
    requirements: ['must be useful in an authorized assessment', 'must document its limitations'],
    quality: computeQuality(fakeDev, rng, true), metrics: defaultProjectMetrics(), files: {},
    git: { branch: 'main', commits: [], tags: [], prs: [] }, issues: [],
    releases: [{ version: '0.1.0', world: game.worldMinutes || 0, notes: 'Initial public release.', signed: false, vulnerabilities: 0 }],
    bugs: [], collaborators: [], dependencies: [], createdWorld: game.worldMinutes || 0,
    updatedWorld: game.worldMinutes || 0, lastTestWorld: 0, lastBuildWorld: 0,
    nextCycleWorld: (game.worldMinutes || 0) + 600, repoPath: `/srv/git/${game.player.handle}/${clean}.git`,
    published: false, license: 'MIT'
  };
  project.files = generateFiles(project, fakeDev);
  project.metrics.files = Object.keys(project.files).length;
  project.metrics.lines = Object.values(project.files).reduce((s, c) => s + c.split('\n').length, 0);
  commit(project, 'initial import', Object.keys(project.files), rng);
  dw.projects.push(project);
  publishProject(game, dw, project);
  pushEvent(dw, { world: game.worldMinutes || 0, category: 'development', title: `${game.player.handle} published ${clean}`, body: `A new ${lang} security tool entered the public registry.`, actors: [game.player.handle], targetId: project.id });
  recordCodingReward(game, 'publish');
  return { ok: true, project };
}
export function playerLabSession(game, labId, action = 'enter') {
  const dw = ensureDevWorld(game);
  const lab = dw.labs.find(l => l.id === labId || l.domain === labId);
  if (!lab) return { ok: false, error: 'No such laboratory.' };
  if (lab.status !== 'online') return { ok: false, error: 'That laboratory is offline.' };
  if (action === 'enter') {
    lab.sessions++;
    lab.authorizedHandles = lab.authorizedHandles.filter(h => h !== game.player.handle).concat(game.player.handle);
    return { ok: true, lab, message: `Authorized session opened on ${lab.domain}. Scope: ${lab.targets.join(', ')}.` };
  }
  if (action === 'leave') {
    lab.authorizedHandles = lab.authorizedHandles.filter(h => h !== game.player.handle);
    return { ok: true, lab, message: `Session on ${lab.domain} closed.` };
  }
  return { ok: false, error: 'Unknown lab action.' };
}
export function playerPracticeExploit(game, labId, target) {
  const dw = ensureDevWorld(game);
  const lab = dw.labs.find(l => l.id === labId || l.domain === labId);
  if (!lab) return { ok: false, error: 'No such laboratory.' };
  if (!lab.authorizedHandles.includes(game.player.handle)) return { ok: false, error: 'You need an authorized session. Use: lab enter <lab>' };
  if (!lab.targets.includes(target)) return { ok: false, error: `${target} is outside that lab's scope.` };
  lab.exploitsPracticed++;
  recordCodingReward(game, 'debug');
  if (game.player.reputation != null) game.player.reputation = clampv(game.player.reputation + 1);
  return { ok: true, lab, message: `Authorized exercise completed against ${target}. The range recorded the attempt.` };
}
export function playerInspectSource(game, query) {
  const hit = projectDetail(game, query);
  if (!hit) return { ok: false, error: 'No such project.' };
  const files = Object.entries(hit.project.files).map(([path, content]) => ({ path, content, language: languageFor(path, content).id, lines: String(content).split('\n').length }));
  const problems = [];
  for (const f of files) {
    if (f.content.length > 180000) continue;
    for (const p of lint(f.content, f.language, f.path)) problems.push({ ...p, path: f.path });
  }
  return { ok: true, ...hit, files, problems: problems.slice(0, 80) };
}
export function playerForkProject(game, query) {
  const dw = ensureDevWorld(game);
  const hit = projectDetail(game, query);
  if (!hit) return { ok: false, error: 'No such project.' };
  const fork = createFork(game, dw, hit.project, devRng(game, 0x9182));
  if (!fork) return { ok: false, error: 'Could not fork that project.' };
  recordCodingReward(game, 'scaffold');
  return { ok: true, fork, project: hit.project };
}
