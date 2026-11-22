/* Persistent digital civilization: countries, cities, law, education, research,
   media, infrastructure, property, supply chains, technology, culture, identity,
   shared-world authority and the historical timeline.

   This module is deliberately independent of world.js. It mutates the shared game
   state and returns plain event descriptors for the world tick to publish. */
import { makeRng, clamp, hash32, fmtMoney } from './util.js';
import {
  COUNTRY_DEFS, CITY_DEFS, LAW_DOMAINS, SUBJECTS, RESEARCH_FIELDS, TECH_SECTORS,
  RESOURCE_DEFS, COMPONENT_DEFS, PROPERTY_DEFS, MEDIA_OUTLET_DEFS, CONTENT_TYPES,
  CULTURE_DEFS, COMPLIANCE_ACTIONS, HISTORY_EPOCHS
} from './civ-data.js';

export const CIVILIZATION_VERSION = 1;
const DAY = 1440;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const CAPS = Object.freeze({
  history: 2400, stories: 320, research: 90, listings: 420, disputes: 160,
  releases: 180, transactions: 2400, events: 80
});
const REGION_FOR_COUNTRY = {
  northreach: 'us-east', meridia: 'eu-west', vantia: 'ap-south', solace: 'ap-south',
  norveld: 'eu-north', qamara: 'ap-south', tarsis: 'us-west', kaimana: 'sa-east'
};
const STANCE_RANK = { permissive: 1, balanced: 2, strict: 3 };
const clone = v => JSON.parse(JSON.stringify(v));
const norm = v => String(v || '').toLowerCase().trim();
const now = () => Date.now();
const money = n => Math.round(Number(n) || 0);

function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
function asArray(v) { return Array.isArray(v) ? v : []; }
function nextSeq(civ, key) {
  if (!civ.seq) civ.seq = {};
  if (typeof civ.seq[key] !== 'number') civ.seq[key] = 1;
  return civ.seq[key]++;
}
function addHistory(game, entry) {
  const civ = game.civ;
  if (!civ) return null;
  const item = {
    id: `hist-${String(nextSeq(civ, 'history')).padStart(5, '0')}`,
    world: entry.world ?? game.worldMinutes ?? 0,
    time: entry.time || now(),
    type: entry.type || 'event',
    title: String(entry.title || 'Untitled event'),
    detail: String(entry.detail || ''),
    countryId: entry.countryId || null,
    cityId: entry.cityId || null,
    importance: clamp(Number(entry.importance) || 2, 1, 5),
    tags: asArray(entry.tags)
  };
  civ.history.unshift(item);
  if (civ.history.length > CAPS.history) {
    // Preserve the largest events and the most recent record.
    const major = civ.history.filter(h => h.importance >= 4);
    const recent = civ.history.slice(0, CAPS.history - major.length);
    civ.history = [...major, ...recent]
      .filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i)
      .sort((a, b) => b.world - a.world || b.time - a.time)
      .slice(0, CAPS.history);
  }
  return item;
}
function pub(civ, key, value) {
  if (!civ[key]) civ[key] = value;
  return civ[key];
}
function addEvent(game, ev) {
  const civ = game.civ;
  const item = {
    id: `evt-${String(nextSeq(civ, 'event')).padStart(4, '0')}`,
    type: ev.type || 'global', title: ev.title, detail: ev.detail || '',
    countryId: ev.countryId || null, cityId: ev.cityId || null,
    severity: clamp(Number(ev.severity) || 2, 1, 5),
    startedWorld: game.worldMinutes, endsWorld: game.worldMinutes + (ev.days || 20) * DAY,
    status: 'active', effects: ev.effects || {}
  };
  civ.events.unshift(item);
  if (civ.events.length > CAPS.events) civ.events.length = CAPS.events;
  return item;
}
function pct(v) { return clamp(Math.round(Number(v) || 0), 0, 100); }

/* ============================================================
   GENERATION
   ============================================================ */
export function buildCivilization(game, rng = null) {
  if (game.civ && game.civ.version) return game.civ;
  rng = rng || makeRng((game.seed ^ 0xc1c1) >>> 0);
  game.seq = game.seq || {};
  game.civ = {
    version: CIVILIZATION_VERSION,
    worldId: `world-${game.seed.toString(16).padStart(8, '0')}`,
    foundedWorld: game.worldMinutes - 14 * 365 * DAY,
    countries: [], cities: [], laws: [], institutions: [],
    relations: [], agreements: [], sanctions: [],
    education: { institutions: [], courses: [], player: { subjects: {}, credentials: [], totalLevels: 0, cooldowns: {}, sessions: 0 } },
    research: { projects: [], discoveries: [] },
    tech: { sectors: [], products: [], standards: [] },
    media: { outlets: [], platforms: [], stories: [], opinion: {} },
    infrastructure: { grids: [], fiber: [], incidents: [] },
    property: { listings: [], owned: [], market: { mortgageRate: .061, vacancy: .07, avgRent: 0 } },
    supply: { resources: [], components: [], manufacturers: [], logistics: [], player: {} },
    culture: { organizations: [], releases: [], communities: [], tournaments: [] },
    identities: {},
    legal: { courts: [], disputes: [], cases: [] },
    events: [],
    history: [],
    metrics: { literacy: 0, internetAccess: 0, researchOutput: 0, mediaTrust: 0, inequality: 0, stability: 0 },
    authority: {
      mode: 'local-authority', revision: 0, worldId: '', members: [], permissions: {},
      ledger: [], lastMutation: 0, checksum: '', antiCheat: { rejected: 0, lastCheck: 0 }
    },
    cadence: { lastDay: 0, lastWeek: 0, lastMonth: 0, lastStory: 0, lastRelease: 0 },
    seq: { story: 1, project: 1, discovery: 1, tech: 1, listing: 1, dispute: 1, release: 1, history: 1, event: 1, transaction: 1, culture: 1 }
  };
  const civ = game.civ;
  civ.authority.worldId = civ.worldId;

  buildCountries(game, rng);
  buildCities(game, rng);
  buildLaws(game, rng);
  buildEducation(game, rng);
  buildResearch(game, rng);
  buildTechnology(game, rng);
  buildMedia(game, rng);
  buildSupply(game, rng);
  buildProperty(game, rng);
  buildCulture(game, rng);
  buildIdentities(game, rng);
  seedHistory(game, rng);
  seedGlobalEvents(game, rng);
  civ.history.sort((a, b) => (b.time || 0) - (a.time || 0) || (b.world || 0) - (a.world || 0));
  ensureAuthority(game);
  recalcMetrics(game);
  return civ;
}

function buildCountries(game, rng) {
  const civ = game.civ;
  for (const def of COUNTRY_DEFS) {
    const country = clone(def);
    country.gdpReal = def.gdp;
    country.treasury = Math.round(def.gdp * rng.float(.018, .04));
    country.debt = Math.round(def.gdp * rng.float(.18, .62));
    country.approval = def.approval;
    country.stability = def.stability;
    country.internet = def.internet;
    country.relations = {};
    country.cityIds = [];
    country.lawIds = [];
    country.institutionIds = [];
    country.educationIndex = Math.round((def.broadband * .55 + def.liberty * .2 + def.gdp / def.population * .0000008) + rng.int(-5, 5));
    country.metrics = { innovation: rng.int(38, 88), inequality: rng.int(21, 68), trust: rng.int(38, 78), pressFreedom: clamp(def.liberty + rng.int(-12, 10), 8, 96) };
    country.institutions = [
      { kind: 'central bank', name: def.financialInstitutions[0], integrity: rng.int(68, 96) },
      { kind: 'data authority', name: `${def.name} Data Authority`, integrity: rng.int(48, 90) },
      { kind: 'competition authority', name: `${def.name} Competition Office`, integrity: rng.int(42, 88) },
      { kind: 'cyber response', name: `${def.code}-CERT`, integrity: rng.int(45, 92) },
      { kind: 'high court', name: `${def.capital} High Court`, integrity: rng.int(55, 95) }
    ].map((inst, i) => {
      const item = {
        id: `inst-${country.id}-${i + 1}`, countryId: country.id, kind: inst.kind,
        name: inst.name, integrity: inst.integrity, capacity: rng.int(34, 92),
        budget: Math.round(def.gdp * rng.float(.0008, .0035)), status: 'operational'
      };
      civ.institutions.push(item);
      country.institutionIds.push(item.id);
      return item;
    });
    civ.countries.push(country);
  }
  // Bilateral relationships, agreements and a small number of sanctions.
  for (let i = 0; i < civ.countries.length; i++) {
    for (let j = i + 1; j < civ.countries.length; j++) {
      const a = civ.countries[i], b = civ.countries[j];
      const ideological = Math.abs(a.liberty - b.liberty) * .22 + Math.abs(a.privacy - b.privacy) * .14;
      const trade = rng.chance(.7) ? rng.int(35, 88) : rng.int(8, 42);
      const rel = {
        trade: clamp(trade - Math.round(ideological * .2), 0, 100),
        diplomacy: clamp(72 - Math.round(ideological) + rng.int(-18, 18), 0, 100),
        tension: clamp(Math.round(ideological) + rng.int(-10, 26), 0, 100),
        cyber: clamp(rng.int(20, 86) - Math.round(ideological * .25), 0, 100),
        treaty: rng.chance(.42)
      };
      a.relations[b.id] = rel;
      b.relations[a.id] = { ...rel };
      civ.relations.push({ a: a.id, b: b.id, ...rel });
      if (rel.trade > 62 && rng.chance(.6)) {
        civ.agreements.push({
          id: `agr-${a.code}-${b.code}`,
          name: `${a.name}–${b.name} digital trade accord`,
          parties: [a.id, b.id], kind: 'trade', status: 'active',
          signedWorld: game.worldMinutes - rng.int(300, 2800) * DAY,
          provisions: ['cross-border data', 'mutual recognition of e-signatures', 'tariff schedule']
        });
      }
    }
  }
  const hostile = civ.countries.find(c => c.id === 'vantia');
  const rival = civ.countries.find(c => c.id === 'tarsis');
  if (hostile && rival) {
    civ.sanctions.push({
      id: 'san-1', from: rival.id, against: hostile.id, kind: 'export controls',
      scope: ['advanced semiconductors', 'chip design tools'], status: 'active',
      sinceWorld: game.worldMinutes - 240 * DAY, severity: 3
    });
  }
}

function buildCities(game, rng) {
  const civ = game.civ;
  for (const def of CITY_DEFS) {
    const country = civ.countries.find(c => c.id === def.countryId);
    if (!country) continue;
    const city = clone(def);
    city.countryId = country.id;
    city.region = REGION_FOR_COUNTRY[country.id] || 'us-east';
    city.status = 'operational';
    city.shock = null;
    city.infra = {
      power: def.power, fiber: def.fiber, water: def.water, transport: def.transport,
      latency: Math.round(clamp(140 - def.fiber * .7 + rng.int(-10, 24), 8, 180)),
      energyPrice: Math.round(60 + (100 - def.power) * 1.2 + rng.int(-8, 18))
    };
    city.economy = {
      gdp: Math.round(country.gdp / 12 * (def.population / Math.max(1, country.population)) * rng.float(.8, 1.2)),
      employment: clamp(rng.int(76, 96) - Math.round((100 - def.transport) * .08), 45, 98),
      wages: def.wages, rentIndex: def.rentIndex, vacancy: clamp(rng.float(.03, .14), .01, .3)
    };
    city.districtsDetailed = (def.districts || []).map((name, i) => ({
      id: `${city.id}-d${i + 1}`, name, kind: name, density: rng.int(35, 96),
      propertyValue: Math.round((def.rentIndex || 1) * rng.int(180000, 1800000)),
      condition: rng.int(58, 96)
    }));
    city.dataCenters = [];
    city.universities = [];
    city.propertyIds = [];
    country.cityIds.push(city.id);
    civ.cities.push(city);
  }
  for (const city of civ.cities) {
    const country = civ.countries.find(c => c.id === city.countryId);
    const count = city.districts.includes('data') || city.capital ? 2 : 1;
    for (let i = 0; i < count; i++) {
      city.dataCenters.push({
        id: `dc-${city.id}-${i + 1}`, name: `${city.name} ${i ? 'North' : 'Core'} Data Center`,
        capacity: rng.int(40, 180), load: rng.int(22, 82), power: city.infra.power,
        cooling: rng.int(54, 94), tier: rng.pick(['II', 'III', 'III', 'IV']), status: 'operational'
      });
    }
    city.universities = country ? country.universities.map((name, i) => ({
      id: `uni-${city.id}-${i + 1}`, name: i === 0 ? `${name}` : `${name} — ${city.name}`, cityId: city.id, countryId: city.countryId
    })) : [];
  }
}

function stanceFor(country, domain, rng) {
  if (domain === 'privacy' || domain === 'data') return country.privacy >= 76 ? 'strict' : country.privacy < 52 ? 'permissive' : 'balanced';
  if (domain === 'labor' || domain === 'consumer') return country.liberty >= 70 ? 'strict' : country.liberty < 42 ? 'permissive' : 'balanced';
  if (domain === 'cybercrime') return country.cyberPolicy.startsWith('licensing') ? 'strict' : country.liberty > 80 ? 'balanced' : 'strict';
  if (domain === 'crypto') return country.digitalPolicy.includes('commercial') ? 'permissive' : country.liberty < 35 ? 'strict' : 'balanced';
  if (domain === 'ip') return country.techFocus.some(x => /semiconductor|media|biotech/.test(x)) ? 'strict' : 'balanced';
  if (domain === 'business') return country.corporateTax < .18 ? 'permissive' : 'balanced';
  return rng.chance(.45) ? 'balanced' : rng.chance(.5) ? 'strict' : 'permissive';
}
function buildLaws(game, rng) {
  const civ = game.civ;
  for (const country of civ.countries) {
    for (const domain of LAW_DOMAINS) {
      const stance = stanceFor(country, domain.id, rng);
      const law = {
        id: `law-${country.code}-${domain.id}`, countryId: country.id, domain: domain.id,
        name: domain.name, short: domain.short, stance,
        severity: stance === 'strict' ? rng.int(6, 9) : stance === 'balanced' ? rng.int(3, 6) : rng.int(1, 3),
        summary: domain.desc, regulatorId: country.institutionIds[domain.id === 'privacy' || domain.id === 'data' ? 1 : domain.id === 'finance' ? 0 : 2] || null,
        status: 'in force', enactedWorld: game.worldMinutes - rng.int(60, 2600) * DAY,
        lastChangedWorld: game.worldMinutes - rng.int(10, 900) * DAY
      };
      civ.laws.push(law);
      country.lawIds.push(law.id);
    }
    country.courts = country.institutionIds.filter(id => civ.institutions.find(i => i.id === id)?.kind === 'high court').length;
  }
  const courts = civ.countries.map(c => ({
    id: `court-${c.id}`, countryId: c.id, name: `${c.capital} Digital Court`,
    integrity: c.institutions?.[4]?.integrity || 70, backlog: rng.int(12, 380), status: 'sitting'
  }));
  civ.legal.courts = courts;
  for (let i = 0; i < 5; i++) {
    const country = rng.pick(civ.countries);
    const company = rng.pick(game.companies || []);
    if (!company) break;
    civ.legal.disputes.push({
      id: `disp-${nextSeq(civ, 'dispute')}`, countryId: country.id,
      courtId: `court-${country.id}`, subjectId: company.id, subjectType: 'company',
      subjectName: company.name, domain: rng.pick(LAW_DOMAINS).id,
      title: rng.pick(['data transfer complaint', 'licensing dispute', 'consumer refund claim', 'competition review', 'worker classification challenge']),
      status: rng.pick(['filed', 'hearing', 'settled']), filedWorld: game.worldMinutes - rng.int(5, 120) * DAY,
      severity: rng.int(1, 4), exposure: Math.round(company.revenue * .02) || rng.int(1200, 9000)
    });
  }
}

function buildEducation(game, rng) {
  const civ = game.civ;
  for (const country of civ.countries) {
    const city = civ.cities.find(c => c.countryId === country.id && c.capital) || civ.cities.find(c => c.countryId === country.id);
    const names = [...(country.universities || []), `${country.name} Open College`];
    for (let i = 0; i < names.length; i++) {
      const inst = {
        id: `edu-${country.id}-${i + 1}`, name: names[i], countryId: country.id,
        cityId: city?.id || null, kind: i === 0 ? 'university' : i === 1 ? 'college' : 'online academy',
        quality: rng.int(48, 94), tuition: i === 0 ? rng.int(2800, 14000) : rng.int(180, 2600),
        subjects: rng.picks(SUBJECTS.map(s => s.id), rng.int(4, 8)),
        research: i === 0 ? rng.int(42, 94) : rng.int(20, 68), students: rng.int(420, 24000)
      };
      civ.education.institutions.push(inst);
    }
  }
  civ.education.institutions.push({
    id: 'edu-open', name: 'Open Signal Academy', countryId: null, cityId: null,
    kind: 'online platform', quality: 72, tuition: 0, subjects: SUBJECTS.map(s => s.id),
    research: 35, students: 184000
  });
  for (const subject of SUBJECTS) {
    const providers = civ.education.institutions.filter(i => i.subjects.includes(subject.id));
    for (let i = 0; i < Math.min(3, Math.max(1, providers.length)); i++) {
      const provider = providers[i];
      if (!provider) continue;
      civ.education.courses.push({
        id: `course-${subject.id}-${i + 1}`, subjectId: subject.id, providerId: provider.id,
        name: `${subject.name}${i ? ' II' : ''}`, level: i + 1,
        tuition: Math.round(provider.tuition * (.45 + i * .2)), quality: clamp(provider.quality - i * 4, 20, 98),
        durationDays: 18 + i * 14, description: subject.desc, credential: subject.credential
      });
    }
  }
}

function buildResearch(game, rng) {
  const civ = game.civ;
  const companies = (game.companies || []).filter(c => c.status !== 'failed');
  const owners = civ.education.institutions.filter(i => i.kind === 'university').slice(0, 8);
  for (let i = 0; i < 14; i++) {
    const field = rng.pick(RESEARCH_FIELDS);
    const company = rng.chance(.58) ? rng.pick(companies) : null;
    const university = rng.pick(owners);
    const lead = rng.pick(game.npcs || []);
    const project = {
      id: `res-${String(nextSeq(civ, 'project')).padStart(4, '0')}`,
      title: `${field.name} ${rng.pick(['benchmark', 'prototype', 'materials study', 'field trial', 'open specification', 'pilot program'])}`,
      field: field.id, ownerType: company ? 'company' : 'university',
      ownerId: company?.id || university?.id || null,
      ownerName: company?.name || university?.name || 'Independent lab',
      countryId: company ? (civ.cities.find(c => c.id === 'halcyon')?.countryId || null) : university?.countryId || null,
      leadNpcId: lead?.id || null, progress: rng.int(4, 82), quality: rng.int(35, 85),
      funding: Math.round(field.baseCost * rng.float(.7, 2.6)), spent: 0,
      required: field.baseCost, stage: 'experimental', status: 'active',
      startedWorld: game.worldMinutes - rng.int(8, 300) * DAY,
      durationDays: Math.round(field.baseCost / rng.int(45, 105)),
      equipment: field.equipment, dependencies: []
    };
    civ.research.projects.push(project);
  }
  const discoveryNames = [
    ['Low-power inference scheduling', 'artificial-intelligence'],
    ['Fault-tolerant optical routing', 'telecommunications'],
    ['Cryogenic memory interface', 'quantum-computing'],
    ['Recyclable battery electrolyte', 'energy-technology'],
    ['Formal verification for access policy', 'cryptography'],
    ['Adaptive warehouse manipulation', 'robotics'],
    ['Thin-film transistor process', 'materials-science'],
    ['Low-latency consensus protocol', 'computer-science']
  ];
  for (const [title, field] of discoveryNames) {
    civ.research.discoveries.push({
      id: `disc-${String(nextSeq(civ, 'discovery')).padStart(4, '0')}`,
      title, field, year: 2026 - rng.int(1, 9), ownerType: rng.chance(.5) ? 'university' : 'company',
      ownerName: rng.chance(.5) ? rng.pick(civ.education.institutions).name : rng.pick(companies)?.name || 'Independent lab',
      status: 'published', citations: rng.int(3, 820), commercialized: rng.chance(.32)
    });
  }
}

function buildTechnology(game, rng) {
  const civ = game.civ;
  const companies = (game.companies || []).filter(c => c.status !== 'failed');
  for (const sector of TECH_SECTORS) {
    civ.tech.sectors.push({
      id: sector.id, name: sector.name, license: sector.license,
      adoption: clamp(sector.adoptionBase * rng.float(.6, 1.5), .02, .92),
      maturity: rng.int(22, 88), competition: rng.int(28, 94),
      standards: [], leaders: []
    });
    const count = sector.id === 'cloud-platforms' || sector.id === 'ai-models' ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const company = rng.pick(companies);
      if (!company) break;
      const version = `${rng.int(1, 9)}.${rng.int(0, 9)}`;
      const product = {
        id: `tech-${String(nextSeq(civ, 'tech')).padStart(4, '0')}`,
        name: `${company.name.split(' ')[0]} ${rng.pick(['Core', 'Stack', 'Runtime', 'Node', 'Works', 'Fabric'])}`,
        companyId: company.id, companyName: company.name, sector: sector.id,
        version, license: sector.license, adoption: clamp(rng.float(.01, .28), 0, .4),
        compatibility: rng.picks(TECH_SECTORS.map(s => s.id), rng.int(2, 5)),
        documentation: rng.int(34, 96), releasedWorld: game.worldMinutes - rng.int(20, 1300) * DAY,
        status: 'released', standards: []
      };
      civ.tech.products.push(product);
      const sec = civ.tech.sectors.find(s => s.id === sector.id);
      if (sec) sec.leaders.push(product.id);
    }
  }
  civ.tech.standards.push(
    { id: 'std-1', name: 'Open Packet Interchange', domain: 'networking', adoption: .74, owner: 'Kaimana Standards Forum', status: 'widely adopted' },
    { id: 'std-2', name: 'Portable Identity Envelope', domain: 'security-software', adoption: .41, owner: 'Meridia Digital Council', status: 'contested' },
    { id: 'std-3', name: 'Common Compute Runtime', domain: 'cloud-platforms', adoption: .63, owner: 'Northreach Cloud Alliance', status: 'industry standard' }
  );
  for (const sec of civ.tech.sectors) {
    const standard = civ.tech.standards.find(s => s.domain === sec.id);
    if (standard) sec.standards.push(standard.id);
  }
}

function storyHeadline(rng, civ, country, company, npc) {
  const templates = [
    '{country} opens consultation on {topic}',
    '{company} reports {n}% rise in platform usage',
    'Regulators question {company} over {topic}',
    'Independent researchers publish {topic} findings',
    '{city} data center outage raises resilience questions',
    'Workers at {company} seek clarity on automation',
    'A small open-source project becomes {topic} standard',
    '{country} proposes new rules for {topic}',
    'Media coalition challenges {country} transparency record',
    'Supply pressure reaches {city} hardware market'
  ];
  return rng.pick(templates)
    .replace('{country}', country?.name || 'Regional authority')
    .replace('{city}', rng.pick(civ.cities)?.name || 'the network')
    .replace('{company}', company?.name || 'Independent operators')
    .replace('{npc}', npc?.name || 'a researcher')
    .replace('{topic}', rng.pick(['cross-border data', 'chip supply', 'platform liability', 'digital identity', 'spectrum allocation', 'AI disclosure', 'copyright', 'cloud concentration', 'fiber access']))
    .replace('{n}', String(rng.int(4, 48)));
}
function buildMedia(game, rng) {
  const civ = game.civ;
  const countries = civ.countries;
  let k = 0;
  for (const def of MEDIA_OUTLET_DEFS) {
    for (const name of def.names.slice(0, 2)) {
      const country = countries[k % countries.length];
      civ.media.outlets.push({
        id: `media-${String(k + 1).padStart(3, '0')}`, name, kind: def.kind,
        countryId: country.id, trust: clamp(rng.int(38, 86) - (def.kind === 'platform' ? 12 : 0), 12, 94),
        audience: rng.int(12000, 4200000), reach: rng.float(.35, 1.6),
        funding: rng.chance(.35) ? 'public' : rng.chance(.5) ? 'subscription' : 'advertising',
        status: 'active', corrections: 0
      });
      k++;
    }
  }
  civ.media.platforms = [
    { id: 'platform-circle', name: 'Circle', audience: 68000000, trust: 54, moderation: 'mixed' },
    { id: 'platform-threadline', name: 'Threadline', audience: 42000000, trust: 61, moderation: 'strict' },
    { id: 'platform-commons', name: 'Lāhui Commons', audience: 9400000, trust: 72, moderation: 'community' }
  ];
  for (const country of countries) {
    civ.media.opinion[country.id] = {
      trustMedia: clamp(rng.int(32, 74), 5, 95), techOptimism: rng.int(34, 82),
      privacyConcern: rng.int(24, 86), governmentApproval: country.approval
    };
  }
  for (let i = 0; i < 22; i++) {
    const outlet = rng.pick(civ.media.outlets);
    const country = rng.pick(countries);
    const company = rng.pick(game.companies || []);
    const npc = rng.pick(game.npcs || []);
    const type = rng.pick(CONTENT_TYPES);
    civ.media.stories.push({
      id: `story-${String(nextSeq(civ, 'story')).padStart(4, '0')}`,
      outletId: outlet.id, outletName: outlet.name, countryId: country.id,
      title: storyHeadline(rng, civ, country, company, npc), type: type.id,
      trust: clamp(outlet.trust + type.trust + rng.int(-8, 8), 1, 99),
      reach: Math.round(outlet.audience * rng.float(.02, .22) * type.reach),
      status: 'published', publishedWorld: game.worldMinutes - rng.int(1, 240) * DAY,
      time: now() - rng.int(1, 120) * 3600000, corrections: 0,
      tags: rng.picks(['policy', 'market', 'security', 'labor', 'culture', 'research', 'infrastructure'], 3)
    });
  }
  civ.media.stories.sort((a, b) => b.publishedWorld - a.publishedWorld);
}

function buildSupply(game, rng) {
  const civ = game.civ;
  for (const def of RESOURCE_DEFS) {
    civ.supply.resources.push({
      id: def.id, name: def.name, unit: def.unit, category: def.category,
      price: def.base, basePrice: def.base, stock: rng.int(2000, 24000),
      production: rng.int(180, 1800), consumption: rng.int(140, 1600),
      shortage: 0, sourceCountries: def.countryBias,
      status: 'normal'
    });
  }
  for (const def of COMPONENT_DEFS) {
    civ.supply.components.push({
      id: def.id, name: def.name, price: def.base, basePrice: def.base,
      stock: rng.int(300, 9000), production: rng.int(30, 520), demand: rng.int(24, 500),
      shortage: 0, inputs: def.inputs, field: def.field,
      status: 'normal', leadTimeDays: rng.int(4, 38)
    });
  }
  for (const company of game.companies || []) {
    if (company.status === 'failed') continue;
    const component = rng.pick(civ.supply.components);
    company.supply = {
      componentId: component.id, inventory: rng.int(40, 900), capacity: rng.int(40, 800),
      supplierId: null, logisticsCityId: rng.pick(civ.cities).id, disruption: 0
    };
    civ.supply.manufacturers.push({
      id: `mfg-${company.id}`, companyId: company.id, name: company.name,
      componentId: component.id, capacity: company.supply.capacity,
      inventory: company.supply.inventory, reliability: rng.int(48, 94),
      cityId: company.supply.logisticsCityId, status: 'operating'
    });
  }
  civ.supply.logistics = civ.cities.map(city => ({
    cityId: city.id, port: city.ports > 0, airport: city.airports > 0,
    road: city.infra.transport, rail: rng.int(24, 86), capacity: rng.int(30, 100),
    congestion: rng.int(8, 54), status: 'normal'
  }));
  civ.supply.player = {};
}

function propertyTypeFor(city, index) {
  if (city.districts.includes('industrial') && index % 3 === 0) return 'industrial';
  if (city.districts.includes('logistics') && index % 3 === 1) return 'warehouse';
  if (city.districts.includes('financial') && index % 3 === 0) return 'office';
  if (city.districts.includes('data') && index % 3 === 2) return 'data-center';
  if (index % 3 === 2) return 'land';
  return index % 2 === 0 ? 'apartment' : 'house';
}
function buildProperty(game, rng) {
  const civ = game.civ;
  for (const city of civ.cities) {
    const country = civ.countries.find(c => c.id === city.countryId);
    for (let i = 0; i < 3; i++) {
      const typeId = propertyTypeFor(city, i);
      const def = PROPERTY_DEFS.find(p => p.id === typeId) || PROPERTY_DEFS[0];
      const marketFactor = rng.float(.78, 1.32) * city.economy.rentIndex;
      const asking = Math.round(def.base * marketFactor * (1 + (country?.inflation || .02) * 4));
      const listing = {
        id: `prop-${String(nextSeq(civ, 'listing')).padStart(4, '0')}`,
        cityId: city.id, countryId: country?.id || null, type: def.id, name: `${city.name} ${def.name} ${i + 1}`,
        domain: def.domain, asking, rent: Math.round(asking * def.rent / 1200),
        maintenance: Math.round(asking * def.maintenance / 12), tax: Math.round(asking * def.tax / 12),
        condition: rng.int(46, 96), occupancy: rng.float(.55, .98),
        ownerType: rng.chance(.55) ? 'company' : 'npc', ownerId: null,
        status: 'listed', listedWorld: game.worldMinutes - rng.int(1, 200) * DAY,
        districtId: city.districtsDetailed[i % city.districtsDetailed.length]?.id || null
      };
      civ.property.listings.push(listing);
      city.propertyIds.push(listing.id);
    }
  }
  civ.property.market.avgRent = Math.round(civ.property.listings.reduce((s, l) => s + l.rent, 0) / Math.max(1, civ.property.listings.length));
}

function buildCulture(game, rng) {
  const civ = game.civ;
  const npcs = game.npcs || [];
  for (const def of CULTURE_DEFS) {
    for (let i = 0; i < 2; i++) {
      const npc = rng.pick(npcs);
      const city = rng.pick(civ.cities);
      civ.culture.organizations.push({
        id: `cult-${String(nextSeq(civ, 'culture')).padStart(4, '0')}`,
        name: `${npc?.name?.split(' ')[0] || 'Independent'} ${rng.pick(['Collective', 'Studio', 'Union', 'Works', 'Circle'])}`,
        type: def.id, kind: def.kind, field: def.field, cityId: city.id,
        founderNpcId: npc?.id || null, audience: rng.int(900, 620000),
        quality: rng.int(34, 92), revenue: rng.int(100, 86000), status: 'active',
        createdWorld: game.worldMinutes - rng.int(20, 1200) * DAY
      });
    }
  }
  civ.culture.communities = civ.media.platforms.map((p, i) => ({
    id: `community-${i + 1}`, name: `${p.name} ${rng.pick(['Developers', 'Night Shift', 'Makers', 'Field Notes'])}`,
    platformId: p.id, members: rng.int(12000, 1800000), trust: rng.int(32, 86),
    topic: rng.pick(['open source', 'retro hardware', 'digital art', 'independent media', 'distributed systems'])
  }));
  civ.culture.tournaments = [
    { id: 'tour-1', name: 'Open Signal Cup', game: 'Packet Run', region: 'global', prize: 82000, status: 'qualifiers', nextWorld: game.worldMinutes + 12 * DAY },
    { id: 'tour-2', name: 'Cinder Invitational', game: 'Gridbreak', region: 'ap-south', prize: 46000, status: 'scheduled', nextWorld: game.worldMinutes + 24 * DAY }
  ];
  for (let i = 0; i < 10; i++) {
    const org = rng.pick(civ.culture.organizations);
    civ.culture.releases.push({
      id: `release-${String(nextSeq(civ, 'release')).padStart(4, '0')}`,
      title: rng.pick(['Quiet Circuits', 'Low Orbit', 'The Long Migration', 'Fieldwork', 'Glasshouse', 'Afterimage', 'Packet Run', 'Northbound']),
      type: org.type, orgId: org.id, orgName: org.name, quality: rng.int(28, 94),
      audience: rng.int(400, 98000), revenue: rng.int(50, 18000), status: 'published',
      releasedWorld: game.worldMinutes - rng.int(1, 160) * DAY
    });
  }
}

function identityForNpc(game, npc, rng) {
  const skill = npc.skill || rng.int(20, 90);
  return {
    id: `identity-${npc.id}`, npcId: npc.id, handle: npc.handle, name: npc.name,
    contexts: {
      professional: clamp(Math.round(skill * .72 + (npc.rep || 0) * .3), 0, 100),
      community: clamp(Math.round((npc.rep || 0) * .7 + rng.int(-14, 24)), 0, 100),
      public: clamp(Math.round(skill * .35 + (npc.rep || 0) * .45), 0, 100)
    },
    credentials: skill > 72 ? [rng.pick(SUBJECTS).credential] : [],
    employment: npc.companyId ? [{ companyId: npc.companyId, role: npc.role || 'staff', sinceWorld: game.worldMinutes - rng.int(30, 900) * DAY }] : [],
    published: [], finance: { income: rng.int(1200, 14000), credit: rng.int(420, 860) },
    security: { incidents: rng.chance(.1) ? rng.int(1, 3) : 0, trust: rng.int(32, 96) },
    privacy: { publicProfile: rng.chance(.55), contactable: rng.chance(.7) }
  };
}
function buildIdentities(game, rng) {
  const civ = game.civ;
  for (const npc of game.npcs || []) civ.identities[npc.handle] = identityForNpc(game, npc, rng);
  const p = game.player;
  civ.identities[p.handle] = {
    id: 'identity-player', npcId: null, handle: p.handle, name: p.name,
    contexts: { professional: p.reputation, community: p.reputation, public: Math.round(p.reputation * .7) },
    credentials: [], employment: [], published: [],
    finance: { income: 0, credit: 620 },
    security: { incidents: game.legal.length, trust: 70 },
    privacy: { publicProfile: true, contactable: true }
  };
  if (!p.education) p.education = { subjects: {}, credentials: [], totalLevels: 0, cooldowns: {}, sessions: 0 };
}

function seedHistory(game, rng) {
  const seeds = [
    { type: 'infrastructure', title: 'The first NullNet exchange opens', detail: 'A volunteer transit exchange begins announcing routes. The network stops being a single machine.', yearsAgo: 14, importance: 5, tags: ['network'] },
    { type: 'technology', title: 'Common Compute Runtime ratified', detail: 'A small coalition publishes an interoperable runtime. Cloud vendors adopt it unevenly.', yearsAgo: 11, importance: 4, tags: ['standard'] },
    { type: 'economy', title: 'Aurelia market correction', detail: 'Automation valuations fall sharply. Hiring freezes spread through the technology sector.', yearsAgo: 8, importance: 4, tags: ['market'] },
    { type: 'law', title: 'Northreach Digital Privacy Act', detail: 'Retention limits and subject access rights become enforceable for platforms above a size threshold.', yearsAgo: 6, importance: 4, tags: ['policy'] },
    { type: 'infrastructure', title: 'Pacific fiber ring completed', detail: 'A cooperative cable project lowers latency between Kaimana and Solace.', yearsAgo: 4, importance: 3, tags: ['fiber'] },
    { type: 'research', title: 'First public reasoning model released', detail: 'Helix Labs publishes a bounded model and an unusually detailed evaluation report.', yearsAgo: 3, importance: 4, tags: ['research'] },
    { type: 'supply', title: 'Semiconductor allocation crisis', detail: 'A fabrication fire and a trade dispute combine into a two-year shortage.', yearsAgo: 2, importance: 5, tags: ['supply'] },
    { type: 'culture', title: 'Community platform boom', detail: 'Smaller platforms absorb audiences leaving the largest networks. Moderation becomes a local craft.', yearsAgo: 1, importance: 3, tags: ['culture'] }
  ];
  for (const seed of seeds) {
    const country = rng.pick(game.civ.countries);
    addHistory(game, {
      type: seed.type, title: seed.title, detail: seed.detail,
      importance: seed.importance, tags: seed.tags, countryId: country?.id || null,
      world: Math.max(0, game.worldMinutes - seed.yearsAgo * 365 * DAY),
      time: now() - seed.yearsAgo * 365 * 86400000
    });
  }
  for (const epoch of HISTORY_EPOCHS) {
    if (seeds.some(s => s.title.includes(epoch.label))) continue;
    addHistory(game, { type: epoch.tone, title: epoch.label, detail: 'A historical marker in the public timeline.', importance: 2, world: Math.max(0, game.worldMinutes - epoch.yearsAgo * 365 * DAY), time: now() - epoch.yearsAgo * 365 * 86400000 });
  }
}

function seedGlobalEvents(game, rng) {
  const civ = game.civ;
  addEvent(game, {
    type: 'supply', title: 'Semiconductor allocation pressure', severity: 3,
    detail: 'Lead times remain elevated. Hardware-dependent projects are paying a premium.',
    days: rng.int(40, 180), effects: { componentPrice: 1.18, hardwareDelay: 1.12 }
  });
  const country = rng.pick(civ.countries);
  addEvent(game, {
    type: 'infrastructure', title: `${rng.pick(civ.cities).name} grid reliability review`, severity: 2,
    detail: `Regulators in ${country.name} are reviewing data-center power contracts after repeated voltage events.`,
    days: rng.int(20, 90), effects: { energyPrice: 1.08 }
  });
  addEvent(game, {
    type: 'law', title: 'Cross-border identity consultation', severity: 2,
    detail: 'A coalition of regulators is drafting mutual recognition rules for digital credentials.',
    days: rng.int(30, 120), effects: { complianceCost: 1.05 }
  });
}

/* ============================================================
   RESTORE / REPAIR
   ============================================================ */
export function ensureCivilization(game) {
  if (!game.civ || typeof game.civ !== 'object') return buildCivilization(game, makeRng((game.seed ^ 0xc1c1) >>> 0));
  const civ = game.civ;
  civ.version = CIVILIZATION_VERSION;
  civ.worldId = civ.worldId || `world-${String(game.seed || 1).toString(16).padStart(8, '0')}`;
  civ.countries = asArray(civ.countries);
  civ.cities = asArray(civ.cities);
  civ.laws = asArray(civ.laws);
  civ.institutions = asArray(civ.institutions);
  civ.relations = asArray(civ.relations);
  civ.agreements = asArray(civ.agreements);
  civ.sanctions = asArray(civ.sanctions);
  civ.education = civ.education || {};
  for (const key of ['institutions', 'courses']) civ.education[key] = asArray(civ.education[key]);
  if (!civ.education.player) civ.education.player = { subjects: {}, credentials: [], totalLevels: 0, cooldowns: {}, sessions: 0 };
  const per = civ.education.player;
  per.subjects = per.subjects || {};
  per.credentials = asArray(per.credentials);
  per.cooldowns = per.cooldowns || {};
  per.totalLevels = Number(per.totalLevels) || 0;
  per.sessions = Number(per.sessions) || 0;
  civ.research = civ.research || {};
  civ.research.projects = asArray(civ.research.projects);
  civ.research.discoveries = asArray(civ.research.discoveries);
  civ.tech = civ.tech || {};
  for (const key of ['sectors', 'products', 'standards']) civ.tech[key] = asArray(civ.tech[key]);
  civ.media = civ.media || {};
  for (const key of ['outlets', 'platforms', 'stories']) civ.media[key] = asArray(civ.media[key]);
  civ.media.opinion = civ.media.opinion || {};
  civ.infrastructure = civ.infrastructure || { grids: [], fiber: [], incidents: [] };
  for (const key of ['grids', 'fiber', 'incidents']) civ.infrastructure[key] = asArray(civ.infrastructure[key]);
  civ.property = civ.property || { listings: [], owned: [], market: {} };
  civ.property.listings = asArray(civ.property.listings);
  civ.property.owned = asArray(civ.property.owned);
  civ.property.market = civ.property.market || { mortgageRate: .061, vacancy: .07, avgRent: 0 };
  if (typeof civ.property.market.mortgageRate !== 'number') civ.property.market.mortgageRate = .061;
  civ.supply = civ.supply || {};
  for (const key of ['resources', 'components', 'manufacturers', 'logistics']) civ.supply[key] = asArray(civ.supply[key]);
  civ.supply.player = civ.supply.player || {};
  civ.culture = civ.culture || {};
  for (const key of ['organizations', 'releases', 'communities', 'tournaments']) civ.culture[key] = asArray(civ.culture[key]);
  civ.identities = civ.identities || {};
  civ.legal = civ.legal || { courts: [], disputes: [], cases: [] };
  for (const key of ['courts', 'disputes', 'cases']) civ.legal[key] = asArray(civ.legal[key]);
  civ.events = asArray(civ.events);
  civ.history = asArray(civ.history);
  civ.metrics = civ.metrics || {};
  civ.cadence = civ.cadence || { lastDay: 0, lastWeek: 0, lastMonth: 0, lastStory: 0, lastRelease: 0 };
  civ.seq = civ.seq || {};
  for (const key of ['story', 'project', 'discovery', 'tech', 'listing', 'dispute', 'release', 'history', 'event', 'transaction', 'culture']) {
    if (typeof civ.seq[key] !== 'number') civ.seq[key] = 1;
  }
  if (!game.player.education) game.player.education = { subjects: {}, credentials: [], totalLevels: 0, cooldowns: {}, sessions: 0 };
  for (const npc of game.npcs || []) {
    if (!civ.identities[npc.handle]) civ.identities[npc.handle] = identityForNpc(game, npc, makeRng((game.seed ^ hash32(npc.handle) ^ game.tickCount) >>> 0));
  }
  if (!civ.identities[game.player.handle]) {
    civ.identities[game.player.handle] = {
      id: 'identity-player', handle: game.player.handle, name: game.player.name,
      contexts: { professional: game.player.reputation, community: game.player.reputation, public: Math.round(game.player.reputation * .7) },
      credentials: [], employment: [], published: [], finance: { income: 0, credit: 620 },
      security: { incidents: game.legal.length, trust: 70 }, privacy: { publicProfile: true, contactable: true }
    };
  }
  ensureAuthority(game);
  recalcMetrics(game);
  return civ;
}

function ensureAuthority(game) {
  const civ = game.civ;
  civ.authority = civ.authority || {};
  const a = civ.authority;
  a.mode = a.mode || 'local-authority';
  a.worldId = civ.worldId;
  a.revision = Number(a.revision) || 0;
  a.members = asArray(a.members);
  a.permissions = a.permissions || {};
  a.ledger = asArray(a.ledger);
  a.antiCheat = a.antiCheat || { rejected: 0, lastCheck: 0 };
  if (!a.checksum) a.checksum = ledgerChecksum(a.ledger);
  const playerMember = a.members.find(m => m.id === 'player');
  if (!playerMember) {
    a.members.push({
      id: 'player', handle: game.player.handle, role: 'operator', kind: 'human',
      status: 'online', joinedWorld: game.worldMinutes, permissions: ['trade', 'company:create', 'property:buy', 'research:start', 'media:publish', 'asset:transfer']
    });
  }
  a.permissions.player = asArray(a.permissions.player).length ? a.permissions.player : asArray(playerMember?.permissions);
  return a;
}

/* ============================================================
   TICK
   ============================================================ */
function crossed(civ, key, interval, game) {
  const current = Math.floor((game.worldMinutes || 0) / interval);
  if (current <= (civ.cadence[key] || 0)) return false;
  civ.cadence[key] = current;
  return true;
}
function expertiseFor(game, fieldId) {
  const subject = SUBJECTS.find(s => s.field === fieldId);
  const player = game.player.education?.subjects?.[subject?.id];
  const level = Number(player?.level) || 0;
  const skill = Number(game.player.bonusSkill) || 0;
  return clamp(.45 + level * .055 + skill * .08, .3, 1.65);
}
function playerIdentity(game) {
  const civ = game.civ;
  const p = game.player;
  return civ.identities[p.handle] || null;
}
function syncPlayerIdentity(game) {
  const id = playerIdentity(game);
  if (!id) return;
  const p = game.player;
  id.contexts.professional = clamp(Math.round(p.reputation * .72 + (p.education?.totalLevels || 0) * 1.6), 0, 100);
  id.contexts.community = clamp(Math.round(p.reputation * .62 + (p.education?.sessions || 0) * .15), 0, 100);
  id.contexts.public = clamp(Math.round(p.reputation * .48 + (id.published?.length || 0) * 1.8), 0, 100);
  id.credentials = [...new Set([...(id.credentials || []), ...(p.education?.credentials || [])])];
  id.finance.income = Math.round((p.transactions || []).slice(0, 30).filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0) / 30);
  id.security.incidents = game.legal.length;
  id.security.trust = clamp(100 - p.heat, 0, 100);
}
function finishResearch(game, project, rng, events) {
  const civ = game.civ;
  project.status = 'completed';
  project.completedWorld = game.worldMinutes;
  project.progress = 100;
  const field = RESEARCH_FIELDS.find(f => f.id === project.field);
  const discovery = {
    id: `disc-${String(nextSeq(civ, 'discovery')).padStart(4, '0')}`,
    title: project.title.replace(/ (prototype|benchmark|field trial|pilot program|materials study|open specification)$/i, '') + ` — ${rng.pick(['validated', 'published', 'demonstrated', 'replicated'])}`,
    field: project.field, year: Math.floor(game.worldMinutes / 365 / DAY) + 2026,
    ownerType: project.ownerType, ownerName: project.ownerName, status: 'published',
    citations: 0, commercialized: false, projectId: project.id
  };
  civ.research.discoveries.unshift(discovery);
  if (civ.research.discoveries.length > 600) civ.research.discoveries.length = 600;
  const sector = TECH_SECTORS.find(s => s.field === project.field);
  let tech = null;
  if (sector && project.quality > 48) {
    tech = {
      id: `tech-${String(nextSeq(civ, 'tech')).padStart(4, '0')}`,
      name: `${project.ownerName.split(' ')[0]} ${rng.pick(['Core', 'Forge', 'Signal', 'Lattice', 'Relay'])} ${project.title.split(' ')[0] || 'System'}`,
      companyId: project.ownerType === 'company' ? project.ownerId : null,
      companyName: project.ownerName, sector: sector.id, version: '1.0',
      license: rng.pick(['open-source', 'proprietary', 'source-available']),
      adoption: .01, compatibility: rng.picks(TECH_SECTORS.map(s => s.id), 3),
      documentation: Math.round(project.quality), releasedWorld: game.worldMinutes,
      status: 'released', standards: [], fromProject: project.id
    };
    civ.tech.products.push(tech);
    const sec = civ.tech.sectors.find(s => s.id === sector.id);
    if (sec) { sec.adoption = clamp(sec.adoption + .015, 0, .98); sec.leaders.push(tech.id); }
  }
  addHistory(game, {
    type: 'research', title: `Discovery: ${discovery.title}`,
    detail: `${project.ownerName} completed a ${field?.name || project.field} project. ${tech ? `A related technology was released as ${tech.name} ${tech.version}.` : 'The result was published without a product release.'}`,
    importance: 4, tags: ['research', project.field], countryId: project.countryId
  });
  events.push({ type: 'news', headline: `Research milestone: ${discovery.title}`, body: `${project.ownerName} reports a completed ${field?.name || project.field} program. The work is being reviewed by independent labs. ${tech ? `A technology release, ${tech.name}, is expected to enter limited adoption.` : ''}`, source: rng.pick(['Signal Review', 'Byte Ledger', 'The Packet']) });
  if (project.ownerType === 'player') {
    game.player.reputation = clamp(game.player.reputation + 4, 0, 100);
    const id = playerIdentity(game);
    if (id) { id.published.push({ title: discovery.title, world: game.worldMinutes, kind: 'research' }); id.published = id.published.slice(-30); }
    game.player.education.credentials = [...new Set([...(game.player.education.credentials || []), `${field?.name || project.field} researcher`])];
    events.push({ type: 'rep', amount: 4, reason: `completed ${discovery.title}` });
    events.push({ type: 'feed', text: `Your research project completed: ${discovery.title}`, kind: 'good' });
  } else {
    events.push({ type: 'feed', text: `${project.ownerName} completed ${discovery.title}.`, kind: 'info' });
  }
  return { discovery, tech };
}
function publishStory(game, rng, events, opts = {}) {
  const civ = game.civ;
  const outlet = opts.outlet || rng.pick(civ.media.outlets);
  if (!outlet) return null;
  const country = opts.countryId ? civ.countries.find(c => c.id === opts.countryId) : rng.pick(civ.countries);
  const company = rng.pick((game.companies || []).filter(c => c.status !== 'failed')) || null;
  const type = CONTENT_TYPES.find(t => t.id === opts.type) || rng.pick(CONTENT_TYPES);
  const title = opts.title || storyHeadline(rng, civ, country, company, rng.pick(game.npcs || []));
  const trust = clamp((outlet.trust || 55) + type.trust + rng.int(-8, 8) - (opts.misinformation ? 22 : 0), 1, 99);
  const story = {
    id: `story-${String(nextSeq(civ, 'story')).padStart(4, '0')}`,
    outletId: outlet.id, outletName: outlet.name, countryId: country?.id || null,
    title, type: type.id, trust, reach: Math.round((outlet.audience || 10000) * rng.float(.01, .14) * type.reach),
    status: 'published', publishedWorld: game.worldMinutes, time: now(), corrections: 0,
    misinformation: !!opts.misinformation, tags: opts.tags || rng.picks(['policy', 'market', 'security', 'labor', 'culture', 'research'], 2),
    body: opts.body || `${title}. The report is based on public records and interviews with people close to the work.`
  };
  civ.media.stories.unshift(story);
  if (civ.media.stories.length > CAPS.stories) civ.media.stories.length = CAPS.stories;
  const opinion = country ? civ.media.opinion[country.id] : null;
  if (opinion) {
    const delta = Math.round((trust - 50) / 16);
    opinion.trustMedia = pct(opinion.trustMedia + delta);
    opinion.privacyConcern = pct(opinion.privacyConcern + (type.id === 'investigation' ? 2 : 0) - (opts.correction ? 1 : 0));
  }
  if (!opts.silent) events.push({ type: 'news', headline: title, body: story.body, source: outlet.name });
  return story;
}
function infrastructureIncident(game, rng, events) {
  const civ = game.civ;
  const city = rng.pick(civ.cities);
  if (!city) return;
  const kinds = [
    { key: 'power', label: 'substation failure', severity: 3, text: `Power instability in ${city.name}. Data centers are running on reserve capacity.` },
    { key: 'fiber', label: 'fiber cut', severity: 2, text: `A fiber cut near ${city.name} is raising latency across the region.` },
    { key: 'water', label: 'water restriction', severity: 2, text: `Water restrictions in ${city.name} affect cooling capacity.` },
    { key: 'transport', label: 'port congestion', severity: 2, text: `Transport congestion in ${city.name} is delaying hardware deliveries.` }
  ];
  const kind = rng.pick(kinds);
  city.infra[kind.key] = pct((city.infra[kind.key] || 80) - rng.int(8, 28));
  city.shock = { kind: kind.key, label: kind.label, severity: kind.severity, sinceWorld: game.worldMinutes, endsWorld: game.worldMinutes + rng.int(4, 36) * 60 };
  city.status = kind.severity >= 3 ? 'degraded' : 'stressed';
  for (const dc of city.dataCenters) { if (kind.key === 'power' || kind.key === 'water') dc.status = 'degraded'; }
  const regionServers = (game.servers || []).filter(s => s.region === city.region && !s.owned);
  for (const s of regionServers.slice(0, 8)) {
    if (rng.chance(.3)) {
      s.status = kind.severity >= 3 ? 'degraded' : 'maintenance';
      s.notes.unshift(`${kind.label} in ${city.name}.`);
      if (s.notes.length > 8) s.notes.length = 8;
    }
  }
  const event = addEvent(game, {
    type: 'infrastructure', title: kind.label, countryId: city.countryId, cityId: city.id,
    detail: kind.text, severity: kind.severity, days: rng.int(1, 4),
    effects: { [kind.key]: .8, latency: 1.15 }
  });
  civ.infrastructure.incidents.unshift({ id: event.id, cityId: city.id, ...city.shock, status: 'active' });
  if (civ.infrastructure.incidents.length > 80) civ.infrastructure.incidents.length = 80;
  addHistory(game, { type: 'infrastructure', title: `${kind.label} in ${city.name}`, detail: kind.text, importance: kind.severity, countryId: city.countryId, cityId: city.id });
  events.push({ type: 'news', headline: kind.text, body: `The incident is being monitored by ${civ.countries.find(c => c.id === city.countryId)?.name || 'regional'} authorities. Digital services in the area may experience elevated latency.`, source: 'NullNet Wire' });
}
function legalEnforcement(game, rng, events) {
  const civ = game.civ;
  const player = game.player;
  const activity = rng.pick(['company', 'media', 'research', 'property']);
  const risk = complianceRisk(game, activity);
  if (rng.chance(risk * .08)) {
    const country = civ.countries.find(c => c.id === 'northreach') || rng.pick(civ.countries);
    const fine = Math.min(Math.max(120, Math.round(player.money * .07)), 2800);
    const dispute = {
      id: `disp-${nextSeq(civ, 'dispute')}`, countryId: country.id, courtId: `court-${country.id}`,
      subjectId: 'player', subjectType: 'player', subjectName: player.handle,
      domain: activity === 'media' ? 'media' : activity === 'property' ? 'consumer' : 'data',
      title: `${country.name} compliance review`, status: 'filed', filedWorld: game.worldMinutes,
      severity: 2, exposure: fine, activity
    };
    civ.legal.disputes.unshift(dispute);
    if (civ.legal.disputes.length > CAPS.disputes) civ.legal.disputes.length = CAPS.disputes;
    addHistory(game, { type: 'law', title: `Compliance review opened against @${player.handle}`, detail: `${country.name} opened a review concerning ${activity} activity. Exposure: ${fmtMoney(fine)}.`, importance: 3, countryId: country.id });
    events.push({ type: 'legal', fine: 0, reason: `${country.name} compliance review (${dispute.id})`, authority: `${country.name} Data Authority` });
    events.push({ type: 'mail', from: 'notice', subject: `Compliance review ${dispute.id}`,
      body: `A review has been opened under ${country.name} law concerning your ${activity} activity.\n\nCase: ${dispute.id}\nPotential exposure: ${fmtMoney(fine)}\n\nYou may continue operating. Legal study and a clean record reduce the risk.` });
    events.push({ type: 'feed', text: `Compliance review opened in ${country.name}: ${dispute.id}`, kind: 'warn' });
  }
  if (rng.chance(.22)) {
    const dispute = rng.pick(civ.legal.disputes.filter(d => d.status === 'filed' || d.status === 'hearing'));
    if (dispute) {
      dispute.status = rng.pick(['hearing', 'settled', 'decided']);
      if (dispute.status === 'settled') dispute.resolution = 'settlement';
    }
  }
}
function tickEconomies(game, rng, events, days = 1) {
  const civ = game.civ;
  const span = clamp(days, 1, 30);
  for (const country of civ.countries) {
    const growthShock = civ.events.some(e => e.status === 'active' && e.countryId === country.id) ? -.002 * span : 0;
    const drift = rng.float(-.0003, .0003) * span;
    country.gdpReal = Math.round(country.gdpReal * (1 + (country.growth / 365) * span + growthShock + drift));
    country.inflation = clamp(country.inflation + rng.float(-.0008, .0009) * span, -.01, .14);
    country.treasury += Math.round(country.gdpReal * country.tax / 365 * span);
    country.approval = pct(country.approval + Math.round(rng.float(-1, 1) * Math.min(span, 5)));
    country.stability = pct(country.stability + Math.round(rng.float(-1, 1) * Math.min(span, 5)));
    country.internet = pct(country.internet + rng.float(-.1, .08) * span);
    country.currency.usd = Math.max(.02, country.currency.usd * (1 + rng.float(-.0015, .0015) * span));
    country.metrics.innovation = pct(country.metrics.innovation + rng.float(-.3, .25) * span);
    country.metrics.inequality = pct(country.metrics.inequality + rng.float(-.25, .25) * span);
    country.metrics.trust = pct(country.metrics.trust + rng.float(-.3, .2) * span);
  }
  for (const city of civ.cities) {
    const country = civ.countries.find(c => c.id === city.countryId);
    const infra = city.infra;
    for (const key of ['power', 'fiber', 'water', 'transport']) {
      const drift = (rng.float(-.35, .28) + (country?.stability > 75 ? .12 : 0)) * Math.min(span, 7);
      infra[key] = pct(infra[key] + drift);
    }
    if (city.shock && game.worldMinutes >= city.shock.endsWorld) {
      city.shock = null;
      city.status = 'operational';
      for (const dc of city.dataCenters) dc.status = 'operational';
      events.push({ type: 'feed', text: `${city.name} infrastructure has stabilized.`, kind: 'good' });
    }
    city.economy.employment = pct(city.economy.employment + Math.round(rng.float(-1, 1) * Math.min(span, 5)));
    city.economy.vacancy = clamp(city.economy.vacancy + rng.float(-.002, .002) * span, .01, .3);
    city.economy.rentIndex = Math.max(.2, city.economy.rentIndex * (1 + rng.float(-.001, .0015) * span));
    for (const dc of city.dataCenters) {
      dc.load = pct(dc.load + rng.int(-2, 2) * Math.min(span, 7));
      dc.power = pct(city.infra.power + rng.int(-5, 3));
      dc.cooling = pct(dc.cooling + rng.int(-1, 1) * Math.min(span, 7));
      if (dc.power < 28) dc.status = 'degraded';
    }
  }
  if (rng.chance(Math.min(.6, .12 * span))) infrastructureIncident(game, rng, events);
}
function tickSupply(game, rng, events, days = 1) {
  const civ = game.civ;
  const span = clamp(days, 1, 30);
  const multiplier = civ.events.some(e => e.status === 'active' && e.type === 'supply') ? 1.31 : 1;
  for (const resource of civ.supply.resources) {
    resource.production = Math.max(0, Math.round(resource.production * rng.float(.96, 1.04)));
    resource.consumption = Math.max(0, Math.round(resource.consumption * rng.float(.97, 1.03)));
    resource.stock = Math.max(0, resource.stock + (resource.production - resource.consumption) * span);
    const scarcity = resource.stock < resource.consumption * 4 ? .018 * span : 0;
    resource.price = Math.max(.5, resource.price * (1 + rng.float(-.006, .006) * span + scarcity));
    resource.shortage = resource.stock < resource.consumption * 2 ? clamp(1 - resource.stock / Math.max(1, resource.consumption * 2), 0, 1) : 0;
    resource.status = resource.shortage > .45 ? 'shortage' : resource.shortage > .15 ? 'tight' : 'normal';
    if (resource.status === 'shortage' && rng.chance(.07)) {
      events.push({ type: 'feed', text: `${resource.name} supply is tight; spot prices are rising.`, kind: 'warn' });
    }
  }
  for (const component of civ.supply.components) {
    let inputCost = 0, constrained = false;
    for (const [rid, qty] of Object.entries(component.inputs || {})) {
      const res = civ.supply.resources.find(r => r.id === rid);
      if (!res) continue;
      inputCost += res.price * qty;
      if (res.shortage > .3) constrained = true;
      res.consumption += Math.round(component.production * qty * .15);
    }
    const target = Math.round(component.basePrice * (1 + inputCost / Math.max(1, component.basePrice) * .12) * multiplier);
    component.price = Math.max(1, component.price * .99 + target * .01);
    component.production = Math.max(0, Math.round(component.production * (constrained ? rng.float(.86, .98) : rng.float(.98, 1.03))));
    component.stock = Math.max(0, component.stock + (component.production - component.demand) * span);
    component.shortage = component.stock < component.demand * 3 ? clamp(1 - component.stock / Math.max(1, component.demand * 3), 0, 1) : 0;
    component.status = component.shortage > .5 ? 'shortage' : component.shortage > .18 ? 'tight' : 'normal';
  }
  for (const mfg of civ.supply.manufacturers) {
    const component = civ.supply.components.find(c => c.id === mfg.componentId);
    const company = (game.companies || []).find(c => c.id === mfg.companyId);
    if (!component || !company) { mfg.status = 'closed'; continue; }
    const flow = Math.round(mfg.capacity * rng.float(.05, .16)) - Math.round(component.demand / Math.max(1, civ.supply.manufacturers.length));
    mfg.inventory = Math.max(0, mfg.inventory + flow * span);
    mfg.status = component.shortage > .45 ? 'constrained' : 'operating';
    if (company.supply) company.supply.inventory = mfg.inventory;
    if (mfg.status === 'constrained' && rng.chance(Math.min(.5, .04 * span))) events.push({ type: 'feed', text: `${mfg.name} reports constrained ${component.name} output.`, kind: 'warn' });
  }
  for (const hub of civ.supply.logistics) {
    hub.congestion = pct(hub.congestion + Math.round(rng.float(-2, 2) * Math.min(span, 7)));
    hub.status = hub.congestion > 72 ? 'congested' : hub.congestion > 50 ? 'busy' : 'normal';
  }
}
function tickProperty(game, rng, events, minutes = 1) {
  const civ = game.civ;
  const p = civ.property;
  const monthBoundary = Math.floor(game.worldMinutes / MONTH) > Math.floor((game.worldMinutes - minutes) / MONTH);
  p.market.mortgageRate = clamp(p.market.mortgageRate + rng.float(-.0004, .0004), .025, .12);
  p.market.vacancy = clamp(p.market.vacancy + rng.float(-.003, .003), .01, .3);
  for (const listing of p.listings) {
    const city = civ.cities.find(c => c.id === listing.cityId);
    const drift = rng.float(-.002, .002) + (city?.economy.rentIndex > 1 ? .001 : 0);
    listing.asking = Math.max(10000, Math.round(listing.asking * (1 + drift)));
    listing.rent = Math.max(20, Math.round(listing.asking * (PROPERTY_DEFS.find(t => t.id === listing.type)?.rent || 2) / 1200));
    listing.condition = pct(listing.condition + rng.int(-1, 1));
    listing.occupancy = clamp(listing.occupancy + rng.float(-.01, .01), .2, 1);
  }
  for (const owned of p.owned) {
    owned.condition = pct(owned.condition + rng.int(-1, 0));
    owned.marketValue = Math.round(owned.purchasePrice * (1 + rng.float(-.004, .006)));
    if (monthBoundary && owned.mortgage?.balance > 0) {
      owned.mortgage.balance = Math.max(0, owned.mortgage.balance - Math.round(owned.mortgage.payment * .28));
    }
    const monthlyDue = monthBoundary ? Math.round(owned.maintenance + owned.tax) : 0;
    if (monthlyDue > 0) events.push({ type: 'money', amount: -monthlyDue, memo: `property costs / ${owned.name}` });
    if (monthBoundary && owned.rent > 0) {
      const income = Math.round(owned.rent * owned.occupancy * .88);
      if (income > 0) events.push({ type: 'money', amount: income, memo: `rent / ${owned.name}` });
    }
  }
  p.market.avgRent = Math.round(p.listings.reduce((s, l) => s + l.rent, 0) / Math.max(1, p.listings.length));
  // A small number of NPC households move when rents and wages diverge.
  if (rng.chance(.18)) {
    const city = rng.pick(civ.cities);
    const npc = rng.pick((game.npcs || []).filter(n => !n.key));
    if (npc) {
      npc.cityId = city.id;
      npc.housing = rng.chance(.55) ? 'renter' : 'owner';
    }
  }
}
function tickMedia(game, rng, events) {
  const civ = game.civ;
  if (crossed(civ, 'lastMediaDrift', DAY, game)) {
    for (const story of civ.media.stories.slice(0, 30)) {
      story.reach = Math.round(story.reach * (1 + rng.float(-.01, .02)));
    }
  }
  if (crossed(civ, 'lastStory', 6 * 60, game)) {
    const misinformation = rng.chance(.12);
    const story = publishStory(game, rng, events, { misinformation, silent: rng.chance(.55) });
    if (misinformation && story && rng.chance(.32)) {
      story.corrections = 1;
      story.correctionWorld = game.worldMinutes + rng.int(2, 14) * 60;
      story.correction = 'The outlet later corrected the central claim.';
      addHistory(game, { type: 'media', title: `Correction issued for “${story.title}”`, detail: 'The original report contained an unverified claim. The correction was appended to the public record.', importance: 2, countryId: story.countryId });
    }
  }
  for (const story of civ.media.stories) {
    if (story.correctionWorld && game.worldMinutes >= story.correctionWorld && story.status !== 'corrected') {
      story.status = 'corrected';
      story.trust = pct(story.trust + 4);
    }
  }
}
function tickResearch(game, rng, events, minutes = 1) {
  const civ = game.civ;
  const span = Math.max(1, Number(minutes) || 1);
  for (const project of civ.research.projects) {
    if (project.status !== 'active') continue;
    const field = RESEARCH_FIELDS.find(f => f.id === project.field);
    const expertise = project.ownerType === 'player' ? expertiseFor(game, project.field) : clamp((project.quality || 50) / 65, .4, 1.4);
    const funding = clamp((project.funding || 0) / Math.max(1, project.required || 1), .2, 2.2);
    const rate = (100 / Math.max(1, project.durationDays * DAY)) * expertise * funding;
    project.progress = clamp(project.progress + rate * span, 0, 100);
    project.spent = (project.spent || 0) + Math.round((field?.baseCost || 1000) / Math.max(1, project.durationDays) * .025 * span);
    if (project.progress >= 100) finishResearch(game, project, rng, events);
  }
  if (civ.research.projects.length > CAPS.research) {
    const active = civ.research.projects.filter(p => p.status === 'active');
    const done = civ.research.projects.filter(p => p.status !== 'active').slice(-20);
    civ.research.projects = [...active, ...done];
  }
}
function tickTech(game, rng, events) {
  const civ = game.civ;
  if (!crossed(civ, 'lastTechDay', DAY, game)) return;
  for (const sector of civ.tech.sectors) {
    sector.adoption = clamp(sector.adoption * (1 + rng.float(-.002, .004)) + .0008, .01, .98);
    sector.competition = pct(sector.competition + rng.int(-1, 1));
    if (rng.chance(.08)) {
      const product = rng.pick(civ.tech.products.filter(p => p.sector === sector.id));
      if (product) {
        product.adoption = clamp(product.adoption + rng.float(.001, .006), 0, .7);
        product.documentation = pct(product.documentation + rng.int(-1, 1));
      }
    }
  }
  for (const product of civ.tech.products) {
    product.adoption = clamp(product.adoption * (1 + rng.float(-.001, .002)) + .0004, 0, .8);
  }
  if (rng.chance(.06)) {
    const product = rng.pick(civ.tech.products);
    if (product) {
      const old = product.version;
      product.version = `${parseInt(product.version, 10) + 1}.0`;
      product.releasedWorld = game.worldMinutes;
      events.push({ type: 'feed', text: `${product.name} ${product.version} released (was ${old}).`, kind: 'info' });
    }
  }
}
function tickLaw(game, rng, events) {
  const civ = game.civ;
  if (crossed(civ, 'lastMonth', MONTH, game)) {
    const country = rng.pick(civ.countries);
    const law = rng.pick(civ.laws.filter(l => l.countryId === country.id));
    if (law && rng.chance(.34)) {
      const old = law.stance;
      law.stance = rng.pick(['permissive', 'balanced', 'strict']);
      law.severity = law.stance === 'strict' ? rng.int(5, 9) : law.stance === 'balanced' ? rng.int(3, 6) : rng.int(1, 3);
      law.lastChangedWorld = game.worldMinutes;
      addHistory(game, { type: 'law', title: `${country.name} changes ${law.name} stance`, detail: `The ${law.name.toLowerCase()} posture moved from ${old} to ${law.stance}. Regulated organizations have one cycle to adapt.`, importance: 3, countryId: country.id });
      events.push({ type: 'news', headline: `${country.name} shifts ${law.name.toLowerCase()} rules`, body: `The new ${law.stance} posture changes compliance expectations for platforms, employers, and independent operators.`, source: 'Global Packet' });
    }
    // Diplomatic and trade events.
    if (rng.chance(.22)) {
      const a = rng.pick(civ.countries);
      const b = rng.pick(civ.countries.filter(c => c.id !== a.id));
      const rel = a.relations[b.id];
      if (rel) {
        rel.diplomacy = pct(rel.diplomacy + rng.int(-6, 5));
        rel.tension = pct(rel.tension + rng.int(-4, 6));
        rel.trade = pct(rel.trade + rng.int(-3, 4));
        addHistory(game, { type: 'diplomacy', title: `${a.name} and ${b.name} open a new negotiation`, detail: 'The agenda covers data transfer, spectrum access, and export licensing.', importance: 3, countryId: a.id });
        events.push({ type: 'feed', text: `${a.name} and ${b.name} opened trade negotiations.`, kind: 'info' });
      }
    }
  }
  // Companies face periodic compliance reviews.
  if (crossed(civ, 'lastCompliance', DAY, game) && rng.chance(.12)) {
    const company = rng.pick((game.companies || []).filter(c => c.status !== 'failed'));
    const country = rng.pick(civ.countries);
    if (company) {
      const domain = rng.pick(LAW_DOMAINS);
      const law = civ.laws.find(l => l.countryId === country.id && l.domain === domain.id);
      const severity = law?.severity || 3;
      civ.legal.disputes.unshift({
        id: `disp-${nextSeq(civ, 'dispute')}`, countryId: country.id, courtId: `court-${country.id}`,
        subjectId: company.id, subjectType: 'company', subjectName: company.name,
        domain: domain.id, title: `${country.name} ${domain.short} compliance review`,
        status: rng.chance(.4) ? 'hearing' : 'filed', filedWorld: game.worldMinutes,
        severity, exposure: Math.round((company.revenue || 1000) * .03 * severity)
      });
      if (civ.legal.disputes.length > CAPS.disputes) civ.legal.disputes.length = CAPS.disputes;
      company.complianceRisk = clamp((company.complianceRisk || 0) + severity * .02, 0, 1);
      if (rng.chance(.3)) {
        addHistory(game, { type: 'law', title: `${company.name} faces ${domain.short} review`, detail: `${country.name} regulators opened a review under its ${law?.stance || 'current'} ${domain.name.toLowerCase()} framework.`, importance: 2, countryId: country.id });
      }
    }
  }
  if (crossed(civ, 'lastEnforcement', DAY, game)) legalEnforcement(game, rng, events);
}
function tickCulture(game, rng, events) {
  const civ = game.civ;
  if (crossed(civ, 'lastCultureDrift', DAY, game)) {
    for (const org of civ.culture.organizations) {
      org.audience = Math.max(0, Math.round(org.audience * (1 + rng.float(-.006, .009))));
      org.revenue = Math.max(0, Math.round(org.revenue * (1 + rng.float(-.004, .006))));
    }
  }
  if (crossed(civ, 'lastRelease', 2 * DAY, game)) {
    const org = rng.pick(civ.culture.organizations);
    if (org) {
      const release = {
        id: `release-${String(nextSeq(civ, 'release')).padStart(4, '0')}`,
        title: rng.pick(['Signal Drift', 'Common Ground', 'Night Ledger', 'Paper City', 'Second Contact', 'Low Frequency', 'Field Notes', 'The Quiet Year']),
        type: org.type, orgId: org.id, orgName: org.name, quality: rng.int(30, 96),
        audience: Math.round(org.audience * rng.float(.01, .08)) + rng.int(50, 900),
        revenue: rng.int(50, 14000), status: 'published', releasedWorld: game.worldMinutes
      };
      civ.culture.releases.unshift(release);
      if (civ.culture.releases.length > CAPS.releases) civ.culture.releases.length = CAPS.releases;
      org.audience += Math.round(release.audience * .2);
      if (rng.chance(.18)) addHistory(game, { type: 'culture', title: `${org.name} publishes ${release.title}`, detail: `A ${org.kind} release reached an estimated ${release.audience.toLocaleString()} people in its first cycle.`, importance: 2 });
      if (rng.chance(.18)) events.push({ type: 'feed', text: `${org.name} published “${release.title}”.`, kind: 'info' });
    }
  }
  for (const t of civ.culture.tournaments) {
    if (t.status !== 'complete' && game.worldMinutes >= t.nextWorld) {
      t.status = 'complete';
      t.winner = rng.pick(civ.culture.organizations)?.name || 'an independent team';
      addHistory(game, { type: 'culture', title: `${t.winner} wins ${t.name}`, detail: `The ${t.game} final concluded with a prize pool of ${fmtMoney(t.prize)}.`, importance: 2 });
    }
  }
}
function tickEvents(game, rng, events) {
  const civ = game.civ;
  for (const ev of civ.events) {
    if (ev.status !== 'active') continue;
    if (game.worldMinutes >= ev.endsWorld) {
      ev.status = 'resolved';
      ev.resolvedWorld = game.worldMinutes;
      events.push({ type: 'feed', text: `Global event resolved: ${ev.title}`, kind: 'good' });
    }
  }
  if (crossed(civ, 'lastGlobalEvent', DAY, game) && rng.chance(.035) && civ.events.filter(e => e.status === 'active').length < 10) {
    const kinds = [
      { type: 'economy', title: 'Currency volatility', detail: 'A sharp move in cross-border settlement is forcing treasury desks to reprice risk.' },
      { type: 'technology', title: 'Open standard coalition forms', detail: 'Competing vendors agree to a compatibility profile for cloud runtimes.' },
      { type: 'law', title: 'Data transfer case reaches high court', detail: 'The outcome could change how platforms move personal records between jurisdictions.' },
      { type: 'supply', title: 'Port labor dispute', detail: 'A logistics hub slowdown is delaying component shipments.' },
      { type: 'cyber', title: 'Coordinated credential attack', detail: 'A credential-stuffing campaign is targeting shared infrastructure providers.' },
      { type: 'research', title: 'Public lab announces breakthrough', detail: 'Independent replication is still pending, but the result is already moving capital.' }
    ];
    const kind = rng.pick(kinds);
    const country = rng.pick(civ.countries);
    const event = addEvent(game, { ...kind, countryId: country.id, severity: rng.int(2, 5), days: rng.int(10, 120), effects: {} });
    addHistory(game, { type: event.type, title: event.title, detail: event.detail, importance: event.severity, countryId: country.id });
    events.push({ type: 'news', headline: event.title, body: event.detail, source: rng.pick(['Global Packet', 'Signal Review', 'NullNet Wire']) });
  }
}
function recalcMetrics(game) {
  const civ = game.civ;
  if (!civ) return;
  const countries = civ.countries || [];
  const cities = civ.cities || [];
  if (!countries.length) return;
  civ.metrics = {
    literacy: Math.round(countries.reduce((s, c) => s + (c.educationIndex || 62), 0) / countries.length),
    internetAccess: Math.round(countries.reduce((s, c) => s + c.internet, 0) / countries.length),
    researchOutput: (civ.research?.discoveries?.length || 0) + (civ.tech?.products?.length || 0),
    mediaTrust: Math.round(Object.values(civ.media?.opinion || {}).reduce((s, o) => s + (o.trustMedia || 0), 0) / Math.max(1, Object.keys(civ.media?.opinion || {}).length)),
    inequality: Math.round(countries.reduce((s, c) => s + (c.metrics?.inequality || 40), 0) / countries.length),
    stability: Math.round(countries.reduce((s, c) => s + c.stability, 0) / countries.length),
    urbanization: Math.round(cities.reduce((s, c) => s + c.population, 0) / Math.max(1, countries.reduce((s, c) => s + c.population, 0)) * 100),
    activeEvents: (civ.events || []).filter(e => e.status === 'active').length,
    population: countries.reduce((s, c) => s + c.population, 0)
  };
}
export function tickCivilization(game, minutes, rng = null) {
  const civ = ensureCivilization(game);
  rng = rng || makeRng((game.seed ^ Math.floor(game.worldMinutes * 2654435761) ^ 0xc1c1) >>> 0);
  const events = [];
  const days = Math.max(0, Math.floor(game.worldMinutes / DAY) - Math.floor((game.worldMinutes - minutes) / DAY));
  if (days > 0) {
    tickEconomies(game, rng, events, days);
    tickSupply(game, rng, events, days);
    tickProperty(game, rng, events, minutes);
    tickLaw(game, rng, events);
    tickCulture(game, rng, events);
    tickEvents(game, rng, events);
  }
  tickResearch(game, rng, events, minutes);
  tickMedia(game, rng, events);
  tickTech(game, rng, events);
  recalcMetrics(game);
  syncPlayerIdentity(game);
  game.player.skill = clamp(game.player.skill || 1, 1, 10);
  if (civ.authority?.antiCheat) civ.authority.antiCheat.lastCheck = now();
  return events;
}

/* ============================================================
   PLAYER ACTIONS
   ============================================================ */
function spend(game, amount, memo) {
  amount = money(amount);
  if (amount > game.player.money) return false;
  game.player.money -= amount;
  game.stats.spent += amount;
  game.player.transactions.unshift({ time: now(), amount: -amount, memo, balance: game.player.money });
  if (game.player.transactions.length > 120) game.player.transactions.length = 120;
  return true;
}
function credit(game, amount, memo) {
  amount = money(amount);
  game.player.money += amount;
  game.stats.earned += Math.max(0, amount);
  game.player.transactions.unshift({ time: now(), amount, memo, balance: game.player.money });
  if (game.player.transactions.length > 120) game.player.transactions.length = 120;
}
function recordAuthority(game, kind, payload) {
  const civ = ensureCivilization(game);
  const a = civ.authority;
  const entry = {
    id: `tx-${String(nextSeq(civ, 'transaction')).padStart(6, '0')}`,
    revision: ++a.revision, kind, actor: payload.actor || 'player',
    amount: payload.amount || 0, memo: payload.memo || '', world: game.worldMinutes,
    time: now(), key: payload.key || null
  };
  a.ledger.unshift(entry);
  if (a.ledger.length > CAPS.transactions) a.ledger.length = CAPS.transactions;
  a.lastMutation = entry.time;
  a.checksum = ledgerChecksum(a.ledger);
  return entry;
}
export function findSubject(query) {
  const q = norm(query);
  return SUBJECTS.find(s => s.id === q || norm(s.name) === q || norm(s.name).startsWith(q) || norm(s.credential) === q) || null;
}
export function findField(query) {
  const q = norm(query);
  return RESEARCH_FIELDS.find(f => f.id === q || norm(f.name) === q || norm(f.name).startsWith(q)) || null;
}
export function findCountry(query) {
  const q = norm(query);
  return COUNTRY_DEFS.find(c => c.id === q || c.code.toLowerCase() === q || norm(c.name) === q || norm(c.capital) === q) || null;
}
export function findCity(query) {
  const q = norm(query);
  return CITY_DEFS.find(c => c.id === q || norm(c.name) === q) || null;
}
export function study(game, query, hours = 1) {
  const civ = ensureCivilization(game);
  const subject = findSubject(query);
  if (!subject) return { ok: false, error: `Unknown subject. Try: ${SUBJECTS.map(s => s.id).join(', ')}` };
  const p = game.player.education;
  const state = p.subjects[subject.id] = p.subjects[subject.id] || { level: 0, progress: 0, sessions: 0 };
  if ((p.cooldowns[subject.id] || 0) > game.worldMinutes) return { ok: false, error: `You just studied ${subject.name}. Return in ${Math.ceil((p.cooldowns[subject.id] - game.worldMinutes) / 60)}h.` };
  const course = civ.education.courses.find(c => c.subjectId === subject.id) || null;
  const cost = Math.max(0, Math.round((course?.tuition || 0) * .08 + hours * 18));
  if (!spend(game, cost, `study / ${subject.name}`)) return { ok: false, error: `You need ${fmtMoney(cost)} for materials and course access.` };
  const prior = state.progress || 0;
  state.progress = Math.min(100, prior + 12 + hours * 9 + (course?.quality || 40) * .08);
  state.sessions += 1;
  p.sessions += 1;
  let leveled = 0;
  while (state.progress >= 100 && state.level < 10) {
    state.progress -= 100;
    state.level += 1;
    leveled++;
    p.totalLevels += 1;
  }
  p.cooldowns[subject.id] = game.worldMinutes + Math.max(20, 30 * hours);
  let credential = null;
  if (state.level >= 3 && !p.credentials.includes(subject.credential)) {
    p.credentials.push(subject.credential);
    credential = subject.credential;
  }
  game.player.bonusSkill = clamp((p.totalLevels || 0) * .075 + (game.player.bonusSkill || 0) * .92, 0, 3.2);
  const id = playerIdentity(game);
  if (id && credential) id.credentials = [...new Set([...id.credentials, credential])];
  addHistory(game, { type: 'education', title: `@${game.player.handle} studied ${subject.name}`, detail: `Level ${state.level}. ${credential ? `Earned the ${credential} credential.` : ''}`, importance: 1 });
  recordAuthority(game, 'study', { amount: -cost, memo: subject.name, actor: 'player' });
  return { ok: true, subject, state, cost, leveled, credential, course };
}
export function startResearch(game, query) {
  const civ = ensureCivilization(game);
  const field = findField(query);
  if (!field) return { ok: false, error: `Unknown field. Try: ${RESEARCH_FIELDS.map(f => f.id).join(', ')}` };
  const active = civ.research.projects.filter(p => p.ownerType === 'player' && p.status === 'active');
  if (active.length >= 3) return { ok: false, error: 'You already have three active research programs.' };
  const subject = SUBJECTS.find(s => s.field === field.id);
  const level = game.player.education.subjects[subject?.id]?.level || 0;
  if (level < 2 && game.player.reputation < 18) return { ok: false, error: `You need ${subject?.name || field.name} level 2 or a stronger reputation before starting this program.` };
  const cost = Math.round(field.baseCost * (1 - Math.min(.3, level * .025)));
  if (!spend(game, cost, `research / ${field.name}`)) return { ok: false, error: `This program needs ${fmtMoney(cost)} in equipment and funding.` };
  const project = {
    id: `res-${String(nextSeq(civ, 'project')).padStart(4, '0')}`,
    title: `${field.name} ${['independent study', 'applied prototype', 'replication study'][active.length % 3]}`,
    field: field.id, ownerType: 'player', ownerId: 'player', ownerName: `@${game.player.handle}`,
    countryId: 'northreach', leadNpcId: null, progress: 0, quality: clamp(38 + level * 6, 20, 94),
    funding: cost, spent: 0, required: field.baseCost, stage: 'experimental', status: 'active',
    startedWorld: game.worldMinutes, durationDays: Math.max(6, Math.round(field.baseCost / 70)), equipment: field.equipment, dependencies: []
  };
  civ.research.projects.push(project);
  addHistory(game, { type: 'research', title: `New research program: ${project.title}`, detail: `@${game.player.handle} funded a ${field.name} program with ${fmtMoney(cost)}.`, importance: 2, countryId: 'northreach' });
  recordAuthority(game, 'research.start', { amount: -cost, memo: field.name });
  return { ok: true, project, cost };
}
export function fundResearch(game, query, amount) {
  const civ = ensureCivilization(game);
  const q = norm(query);
  const project = civ.research.projects.find(p => p.ownerType === 'player' && (p.id === q || norm(p.title).includes(q)));
  if (!project || project.status !== 'active') return { ok: false, error: 'No active player research program matches that.' };
  const value = Math.max(100, money(amount) || 500);
  if (!spend(game, value, `research funding / ${project.id}`)) return { ok: false, error: `You need ${fmtMoney(value)}.` };
  project.funding += value;
  project.quality = clamp(project.quality + Math.round(value / 500), 0, 99);
  recordAuthority(game, 'research.fund', { amount: -value, memo: project.id });
  return { ok: true, project, amount: value };
}
export function publishContent(game, title) {
  const civ = ensureCivilization(game);
  const clean = String(title || '').trim().slice(0, 90) || 'Untitled dispatch';
  const mediaLevel = game.player.education.subjects.media?.level || 0;
  const cost = Math.max(20, 90 - mediaLevel * 5);
  if (!spend(game, cost, 'media / publication')) return { ok: false, error: `Publishing costs ${fmtMoney(cost)} in tools and distribution.` };
  const outlet = civ.media.outlets.find(o => o.kind === 'independent creator') || civ.media.outlets[0];
  const story = publishStory(game, makeRng((game.seed ^ hash32(clean) ^ game.worldMinutes) >>> 0), [], {
    outlet, title: clean, type: mediaLevel >= 3 ? 'analysis' : 'news', countryId: 'northreach',
    body: `${clean}. Published independently by @${game.player.handle}.`, silent: true, tags: ['independent', 'operator']
  });
  if (story) {
    story.author = game.player.handle;
    story.playerOwned = true;
    const id = playerIdentity(game);
    if (id) { id.published.push({ title: clean, world: game.worldMinutes, kind: 'media' }); id.published = id.published.slice(-30); }
    game.player.reputation = clamp(game.player.reputation + 1, 0, 100);
    addHistory(game, { type: 'media', title: `@${game.player.handle} publishes “${clean}”`, detail: `An independent dispatch distributed through ${outlet.name}.`, importance: 2 });
    recordAuthority(game, 'media.publish', { amount: -cost, memo: clean, key: `story-${clean}` });
  }
  return { ok: true, story, cost, outlet };
}
export function buyProperty(game, query, cash = true) {
  const civ = ensureCivilization(game);
  const q = norm(query);
  const listing = civ.property.listings.find(l => l.status === 'listed' && (l.id === q || norm(l.name).includes(q) || norm(l.type) === q));
  if (!listing) return { ok: false, error: 'No matching property listing. Try: property list' };
  const down = cash ? listing.asking : Math.round(listing.asking * .2);
  if (!spend(game, down, `property / ${listing.name}`)) return { ok: false, error: `You need ${fmtMoney(down)} for ${cash ? 'the purchase' : 'the down payment'}.` };
  const owned = {
    id: `owned-${civ.property.owned.length + 1}`, listingId: listing.id, cityId: listing.cityId,
    countryId: listing.countryId, name: listing.name, type: listing.type, domain: listing.domain,
    purchasePrice: listing.asking, purchaseWorld: game.worldMinutes, marketValue: listing.asking,
    rent: listing.rent, maintenance: listing.maintenance, tax: listing.tax,
    condition: listing.condition, occupancy: listing.occupancy, ownerType: 'player',
    mortgage: cash ? null : { principal: listing.asking - down, balance: listing.asking - down, rate: civ.property.market.mortgageRate, payment: Math.round((listing.asking - down) * (civ.property.market.mortgageRate / 12) / (1 - Math.pow(1 + civ.property.market.mortgageRate / 12, -240))) }
  };
  civ.property.owned.push(owned);
  listing.status = 'owned';
  listing.ownerType = 'player';
  const id = playerIdentity(game);
  if (id) id.finance.income += Math.round(owned.rent * .5);
  addHistory(game, { type: 'property', title: `@${game.player.handle} acquired ${listing.name}`, detail: `${cash ? 'Purchased outright' : 'Financed with a mortgage'} for ${fmtMoney(listing.asking)} in ${civ.cities.find(c => c.id === listing.cityId)?.name || 'the region'}.`, importance: 2, countryId: listing.countryId, cityId: listing.cityId });
  recordAuthority(game, 'property.buy', { amount: -down, memo: listing.id, key: `property-${listing.id}` });
  return { ok: true, property: owned, listing, down, cash };
}
export function sellProperty(game, query) {
  const civ = ensureCivilization(game);
  const q = norm(query);
  const owned = civ.property.owned.find(p => p.id === q || norm(p.name).includes(q));
  if (!owned) return { ok: false, error: 'No owned property matches that.' };
  const gross = Math.round((owned.marketValue || owned.purchasePrice) * .94);
  const payoff = owned.mortgage?.balance || 0;
  const net = Math.max(0, gross - payoff);
  credit(game, net, `property sale / ${owned.name}`);
  civ.property.owned = civ.property.owned.filter(p => p !== owned);
  const listing = civ.property.listings.find(l => l.id === owned.listingId);
  if (listing) { listing.status = 'listed'; listing.ownerType = 'npc'; }
  addHistory(game, { type: 'property', title: `${owned.name} sold`, detail: `@${game.player.handle} sold the property for ${fmtMoney(gross)} after ${fmtMoney(payoff)} in mortgage payoff.`, importance: 1 });
  recordAuthority(game, 'property.sell', { amount: net, memo: owned.id });
  return { ok: true, property: owned, gross, payoff, net };
}
export function investCompany(game, query, amount) {
  const civ = ensureCivilization(game);
  const q = norm(query);
  const company = (game.companies || []).find(c => norm(c.name) === q || c.id === q || norm(c.name).includes(q));
  if (!company) return { ok: false, error: 'No company matches that name.' };
  const value = Math.max(1000, money(amount) || 1000);
  if (!spend(game, value, `investment / ${company.name}`)) return { ok: false, error: `You need ${fmtMoney(value)} to invest.` };
  const valuation = Math.max(50000, (company.revenue || 0) * 12 + (company.funds || 0) + (company.employees || 10) * 18000);
  const stake = Math.min(.35, value / valuation);
  company.funds = (company.funds || 0) + value;
  company.shareholders = asArray(company.shareholders);
  company.shareholders.push({ id: 'player', handle: game.player.handle, stake, invested: value, sinceWorld: game.worldMinutes });
  const investment = civ.investments = asArray(civ.investments);
  const existing = investment.find(x => x.companyId === company.id);
  if (existing) { existing.invested += value; existing.stake = clamp(existing.stake + stake, 0, .4); }
  else investment.push({ companyId: company.id, companyName: company.name, invested: value, stake, sinceWorld: game.worldMinutes });
  addHistory(game, { type: 'economy', title: `@${game.player.handle} invests in ${company.name}`, detail: `${fmtMoney(value)} for an estimated ${Math.round(stake * 1000) / 10}% stake.`, importance: 2 });
  recordAuthority(game, 'company.invest', { amount: -value, memo: company.id, key: `invest-${company.id}-${game.worldMinutes}` });
  return { ok: true, company, stake, value };
}
export function tradeCommodity(game, query, quantity = 1, side = 'buy') {
  const civ = ensureCivilization(game);
  const q = norm(query);
  const resource = civ.supply.resources.find(r => r.id === q || norm(r.name) === q || norm(r.name).startsWith(q));
  if (!resource) return { ok: false, error: 'No commodity matches that name.' };
  const qty = Math.max(1, Math.round(Number(quantity) || 1));
  const unit = side === 'sell' ? resource.price * .95 : resource.price * 1.03;
  const total = Math.max(1, Math.round(unit * qty));
  const inventory = civ.supply.player[resource.id] || 0;
  if (side === 'sell') {
    if (inventory < qty) return { ok: false, error: `You only hold ${inventory} ${resource.unit} of ${resource.name}.` };
    civ.supply.player[resource.id] = inventory - qty;
    credit(game, total, `commodity sale / ${resource.name}`);
  } else {
    if (!spend(game, total, `commodity purchase / ${resource.name}`)) return { ok: false, error: `You need ${fmtMoney(total)}.` };
    civ.supply.player[resource.id] = inventory + qty;
    resource.stock = Math.max(0, resource.stock - qty);
  }
  recordAuthority(game, `commodity.${side}`, { amount: side === 'sell' ? total : -total, memo: resource.id });
  return { ok: true, resource, qty, total, unit, side, inventory: civ.supply.player[resource.id] };
}
export function createCulture(game, title, typeQuery = 'game') {
  const civ = ensureCivilization(game);
  const def = CULTURE_DEFS.find(c => c.id === norm(typeQuery) || norm(c.name).includes(norm(typeQuery))) || CULTURE_DEFS[0];
  const clean = String(title || '').trim().slice(0, 80) || 'Untitled release';
  const cost = 240;
  if (!spend(game, cost, `culture / ${def.name}`)) return { ok: false, error: `A release needs ${fmtMoney(cost)} in production costs.` };
  const skill = game.player.education.subjects[def.field]?.level || 0;
  let org = civ.culture.organizations.find(o => o.founderNpcId === 'player' && o.type === def.id);
  if (!org) {
    org = {
      id: `cult-${String(nextSeq(civ, 'culture')).padStart(4, '0')}`,
      name: `${game.player.handle.replace(/^./, c => c.toUpperCase())} ${def.name}`, type: def.id,
      kind: def.kind, field: def.field, cityId: 'halcyon', founderNpcId: 'player',
      audience: 120, quality: 44 + skill * 5, revenue: 0, status: 'active', createdWorld: game.worldMinutes
    };
    civ.culture.organizations.push(org);
  }
  const release = {
    id: `release-${String(nextSeq(civ, 'release')).padStart(4, '0')}`, title: clean,
    type: def.id, orgId: org.id, orgName: org.name, quality: clamp(42 + skill * 6 + (game.player.reputation || 0) * .2, 20, 98),
    audience: Math.round(80 + skill * 90 + (game.player.reputation || 0) * 12), revenue: 0,
    status: 'published', releasedWorld: game.worldMinutes, playerOwned: true
  };
  release.revenue = Math.round(release.audience * .08);
  org.audience += release.audience;
  org.revenue += release.revenue;
  civ.culture.releases.unshift(release);
  game.player.reputation = clamp(game.player.reputation + 1, 0, 100);
  const id = playerIdentity(game);
  if (id) { id.published.push({ title: clean, world: game.worldMinutes, kind: def.id }); id.published = id.published.slice(-30); }
  addHistory(game, { type: 'culture', title: `@${game.player.handle} releases ${clean}`, detail: `A ${def.kind} release with an initial audience of ${release.audience.toLocaleString()}.`, importance: 2 });
  recordAuthority(game, 'culture.publish', { amount: -cost, memo: release.id });
  return { ok: true, release, org, cost };
}
export function complianceRisk(game, activity, countryId = 'northreach') {
  const civ = ensureCivilization(game);
  const country = civ.countries.find(c => c.id === countryId) || civ.countries[0];
  const action = COMPLIANCE_ACTIONS[activity] || { baseRisk: .04, label: activity };
  if (!country) return action.baseRisk;
  const laws = civ.laws.filter(l => l.countryId === country.id);
  let risk = action.baseRisk;
  for (const law of laws) {
    if (law.domain === activity || (activity === 'company' && ['business', 'labor', 'consumer', 'finance'].includes(law.domain)) ||
      (activity === 'media' && ['privacy', 'ip', 'consumer'].includes(law.domain)) ||
      (activity === 'research' && ['ip', 'data', 'cybercrime'].includes(law.domain)) ||
      (activity === 'property' && ['consumer', 'finance', 'business'].includes(law.domain))) {
      risk += (STANCE_RANK[law.stance] || 2) * .012;
    }
  }
  const lawLevel = game.player.education.subjects.law?.level || 0;
  risk -= lawLevel * .007;
  risk -= (game.player.reputation || 0) * .0008;
  return clamp(risk, .005, .28);
}
export function complianceReport(game, activity = 'company', countryId = 'northreach') {
  const civ = ensureCivilization(game);
  const country = civ.countries.find(c => c.id === countryId) || civ.countries[0];
  const risk = complianceRisk(game, activity, country?.id);
  const relevant = civ.laws.filter(l => l.countryId === country?.id && ['privacy', 'data', 'business', 'labor', 'consumer', 'finance', 'cybercrime', 'crypto', 'contracts', 'ip', 'software'].includes(l.domain));
  return { country, activity, risk, relevant, disputes: civ.legal.disputes.filter(d => d.subjectId === 'player' || d.subjectId === country?.id).slice(0, 8) };
}
export function defendDispute(game, query) {
  const civ = ensureCivilization(game);
  const q = norm(query);
  const dispute = civ.legal.disputes.find(d => d.subjectId === 'player' && (d.id === q || norm(d.title).includes(q)) && d.status !== 'closed' && d.status !== 'decided');
  if (!dispute) return { ok: false, error: 'No open player dispute matches that.' };
  const lawLevel = game.player.education.subjects.law?.level || 0;
  const cost = 120 + dispute.severity * 80;
  if (!spend(game, cost, `legal defense / ${dispute.id}`)) return { ok: false, error: `Legal representation costs ${fmtMoney(cost)}.` };
  const chance = clamp(.34 + lawLevel * .06 + (game.player.reputation || 0) * .002, .15, .9);
  const rng = makeRng((game.seed ^ hash32(dispute.id) ^ game.worldMinutes) >>> 0);
  if (rng.chance(chance)) {
    dispute.status = 'settled';
    dispute.resolution = 'dismissed after review';
    game.player.reputation = clamp(game.player.reputation + 1, 0, 100);
    addHistory(game, { type: 'law', title: `${dispute.id} resolved in your favor`, detail: 'The regulator accepted the compliance file and closed the review without a penalty.', importance: 2, countryId: dispute.countryId });
    return { ok: true, dispute, cost, outcome: 'dismissed' };
  }
  const fine = Math.min(Math.max(80, Math.round(dispute.exposure * .22)), 2400);
  game.player.money = Math.max(0, game.player.money - fine);
  game.legal.push({ time: now(), fine, reason: dispute.title, authority: `${civ.countries.find(c => c.id === dispute.countryId)?.name || 'Regional'} court` });
  dispute.status = 'decided';
  dispute.resolution = `penalty ${fmtMoney(fine)}`;
  addHistory(game, { type: 'law', title: `${dispute.id} decided`, detail: `The court imposed a ${fmtMoney(fine)} penalty.`, importance: 2, countryId: dispute.countryId });
  return { ok: true, dispute, cost, outcome: 'penalty', fine };
}

/* ============================================================
   QUERIES + UI SNAPSHOTS
   ============================================================ */
function ledgerChecksum(ledger) {
  return asArray(ledger).slice(0, 200).map(e => `${e.id}:${e.actor}:${e.amount}:${e.kind}`).join('|');
}
export function verifyAuthority(game) {
  const a = ensureCivilization(game).authority;
  const expected = ledgerChecksum(a.ledger);
  return { ok: expected === a.checksum, revision: a.revision, checksum: expected, members: a.members.length, rejected: a.antiCheat?.rejected || 0 };
}
export function civSummary(game) {
  const civ = ensureCivilization(game);
  const activeEvents = civ.events.filter(e => e.status === 'active');
  return {
    worldId: civ.worldId, countries: civ.countries.length, cities: civ.cities.length,
    population: civ.metrics.population, internet: civ.metrics.internetAccess,
    literacy: civ.metrics.literacy, stability: civ.metrics.stability,
    research: civ.research.projects.filter(p => p.status === 'active').length,
    discoveries: civ.research.discoveries.length, stories: civ.media.stories.length,
    listings: civ.property.listings.filter(l => l.status === 'listed').length,
    ownedProperty: civ.property.owned.length, products: civ.tech.products.length,
    activeEvents, history: civ.history.length, authority: civ.authority.revision,
    playerEducation: game.player.education.totalLevels || 0,
    playerCredentials: (game.player.education.credentials || []).length
  };
}
export function filteredHistory(game, { countryId = null, type = null, limit = 80 } = {}) {
  const civ = ensureCivilization(game);
  return civ.history.filter(h => (!countryId || h.countryId === countryId) && (!type || h.type === type)).slice(0, limit);
}
export function identityFor(game, handle) {
  const civ = ensureCivilization(game);
  return civ.identities[String(handle || '').replace(/^@/, '')] || null;
}
export function contextualReputation(game, handle, context = 'professional') {
  const id = identityFor(game, handle);
  if (!id) return 0;
  return id.contexts?.[context] ?? id.contexts?.public ?? 0;
}
export function topCountries(game) {
  const civ = ensureCivilization(game);
  return [...civ.countries].sort((a, b) => b.gdpReal - a.gdpReal);
}
export function playerPropertyIncome(game) {
  const civ = ensureCivilization(game);
  return civ.property.owned.reduce((s, p) => s + (p.rent || 0) * (p.occupancy || .8), 0);
}

/* ============================================================
   OPTIONAL SHARED-WORLD AUTHORITY PRIMITIVES
   ============================================================ */
export function joinSharedWorld(game, handle, kind = 'human') {
  const civ = ensureCivilization(game);
  const a = civ.authority;
  const clean = String(handle || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 18);
  if (!clean) return { ok: false, error: 'A handle is required.' };
  if (a.members.some(m => m.handle === clean && m.id !== 'player')) return { ok: false, error: 'That handle is already present in the shared world.' };
  const member = {
    id: `member-${a.members.length}`, handle: clean, role: 'operator', kind,
    status: 'online', joinedWorld: game.worldMinutes,
    permissions: ['trade', 'company:create', 'property:buy', 'research:start', 'media:publish', 'asset:transfer']
  };
  a.members.push(member);
  a.revision++;
  a.checksum = ledgerChecksum(a.ledger);
  return { ok: true, member };
}
export function leaveSharedWorld(game, handle) {
  const a = ensureCivilization(game).authority;
  const member = a.members.find(m => m.handle === handle && m.id !== 'player');
  if (!member) return { ok: false, error: 'No such member.' };
  member.status = 'offline';
  member.lastSeenWorld = game.worldMinutes;
  a.revision++;
  return { ok: true, member };
}
export function grantPermission(game, handle, permission) {
  const a = ensureCivilization(game).authority;
  const member = a.members.find(m => m.handle === handle);
  if (!member) return { ok: false, error: 'No such member.' };
  if (!['trade', 'company:create', 'property:buy', 'research:start', 'media:publish', 'asset:transfer'].includes(permission)) return { ok: false, error: 'Unknown permission.' };
  member.permissions = [...new Set([...(member.permissions || []), permission])];
  a.permissions[handle] = asArray(member.permissions);
  a.revision++;
  return { ok: true, member };
}
export function authoritativeTransfer(game, from, to, amount, key) {
  const civ = ensureCivilization(game);
  const a = civ.authority;
  const value = money(amount);
  if (!Number.isFinite(value) || value <= 0) return { ok: false, error: 'Amount must be positive.' };
  if (key && a.ledger.some(e => e.key === key)) return { ok: false, error: 'Duplicate transaction key rejected.' };
  const actor = a.members.find(m => m.handle === from || m.id === from);
  if (!actor) return { ok: false, error: 'Unknown actor.' };
  const target = a.members.find(m => m.handle === to || m.id === to);
  if (!target) { a.antiCheat.rejected++; return { ok: false, error: 'Unknown recipient.' }; }
  if (from === game.player.handle || from === 'player') {
    if (value > game.player.money) { a.antiCheat.rejected++; return { ok: false, error: 'Insufficient funds.' }; }
    game.player.money -= value;
    game.player.transactions.unshift({ time: now(), amount: -value, memo: `transfer to ${to}`, balance: game.player.money });
  }
  const entry = recordAuthority(game, 'asset.transfer', { actor: from, amount: -value, memo: `${from} -> ${to}`, key });
  return { ok: true, amount: value, from, to, entry };
}
export function recordSharedAction(game, actor, kind, amount, memo, key = null) {
  const entry = recordAuthority(game, kind, { actor, amount, memo, key });
  return { ok: true, entry };
}
