/* Digital civilization layer: countries, law, education, research, media,
   infrastructure, property, supply chains, technology, culture, identity,
   world events, history and shared-world authority.

   This module deliberately does not import world.js. The world tick owns
   simulation ordering and applies feed/news/mail descriptors returned here.
   All state is plain JSON so it survives the existing v4 save format. */
import { makeRng, clamp, hash32, fmtMoney, fmtNum, fmtDate } from './util.js';

export const CIV_VERSION = 1;
export const DAY = 1440;
export const YEAR = 365 * DAY;

const CAPS = Object.freeze({
  laws: 150, courts: 60, regulators: 60, disputes: 80, projects: 36,
  discoveries: 160, media: 140, outlets: 48, listings: 72, owned: 120,
  factories: 60, warehouses: 60, shipments: 48, tech: 110, games: 80,
  music: 80, communities: 80, esports: 40, cultureEvents: 60, events: 220,
  timeline: 280, ledger: 400, identities: 480, outages: 40, policies: 60,
  treaties: 80, sanctions: 60, content: 180
});

const REGION_LABEL = {
  'north-america': 'North America', 'europe': 'Europe', 'asia-pacific': 'Asia-Pacific',
  'south-asia': 'South Asia', 'africa': 'Africa', 'south-america': 'South America',
  'oceania': 'Oceania'
};

/* ============================================================
   STATIC DEFINITIONS
   ============================================================ */
const COUNTRY_DEFS = [
  {
    id: 'novaria', name: 'Novaria', formal: 'Federal Republic of Novaria', code: 'NV',
    region: 'north-america', capital: 'Meridian', currency: 'NVC', language: 'English',
    population: 218000000, government: 'federal republic', leader: 'Adrian Vale',
    parties: ['Civic Union', 'Progress Alliance', 'Liberty Front'],
    gdp: 14200000000000, growth: 2.1, inflation: 2.7, unemployment: 4.1, debt: 96,
    tax: { corp: 21, income: 24, vat: 7, digital: 3 },
    internet: { penetration: 93, speed: 220, cost: 58, censorship: 14, backbone: 'tier-1' },
    regulation: { privacy: 62, ip: 58, copyright: 61, licensing: 57, business: 55, labor: 52, finance: 66, consumer: 60, cyber: 70, data: 64, crypto: 46, contracts: 60 },
    sectors: ['software', 'finance', 'cloud', 'media', 'semiconductors'],
    universities: ['Meridian Institute of Technology', 'North Coast University'],
    telecoms: ['Asterlink', 'Continuum Fiber'], banks: ['First Meridian', 'Northstar Capital'],
    cyberPolicy: 'deterrence', stability: 74, approval: 51, costIndex: 1.00
  },
  {
    id: 'albion', name: 'Albion', formal: 'Albion Commonwealth', code: 'AL',
    region: 'europe', capital: 'Greyhaven', currency: 'ALB', language: 'English',
    population: 69000000, government: 'parliamentary monarchy', leader: 'Prime Minister Iona Clare',
    parties: ['Union Party', 'Labour Alliance', 'Coastal Reform'],
    gdp: 3600000000000, growth: 1.5, inflation: 3.2, unemployment: 4.6, debt: 101,
    tax: { corp: 25, income: 27, vat: 20, digital: 2 },
    internet: { penetration: 95, speed: 180, cost: 44, censorship: 9, backbone: 'tier-1' },
    regulation: { privacy: 71, ip: 66, copyright: 69, licensing: 63, business: 62, labor: 64, finance: 79, consumer: 68, cyber: 73, data: 72, crypto: 52, contracts: 68 },
    sectors: ['finance', 'consulting', 'media', 'software', 'shipping'],
    universities: ['Greyhaven School of Economics', 'Albion Polytechnic'],
    telecoms: ['Crown Fibre', 'North Sea Telecom'], banks: ['Greyhaven Clearing', 'Albion Mutual'],
    cyberPolicy: 'regulated', stability: 70, approval: 44, costIndex: 1.04
  },
  {
    id: 'rhine', name: 'Rhine', formal: 'Rhine Federation', code: 'RH',
    region: 'europe', capital: 'Rheinholt', currency: 'RHC', language: 'German',
    population: 84000000, government: 'federal parliamentary republic', leader: 'Chancellor Marta Klein',
    parties: ['Social Democrats', 'Union of Industry', 'Green Compact'],
    gdp: 4100000000000, growth: 1.2, inflation: 2.4, unemployment: 3.5, debt: 66,
    tax: { corp: 30, income: 42, vat: 19, digital: 4 },
    internet: { penetration: 94, speed: 195, cost: 39, censorship: 8, backbone: 'tier-1' },
    regulation: { privacy: 84, ip: 72, copyright: 74, licensing: 70, business: 68, labor: 78, finance: 71, consumer: 78, cyber: 76, data: 84, crypto: 44, contracts: 76 },
    sectors: ['manufacturing', 'automotive', 'robotics', 'software', 'energy'],
    universities: ['Rheinholt Technical University', 'Hagenwerke Institute'],
    telecoms: ['RheinNet', 'Federation Fiber'], banks: ['Rheinholt Bank', 'Industrial Credit Union'],
    cyberPolicy: 'strict', stability: 79, approval: 55, costIndex: 0.98
  },
  {
    id: 'nordhavn', name: 'Nordhavn', formal: 'Nordhavn Council', code: 'NH',
    region: 'europe', capital: 'Nordhavn', currency: 'NHC', language: 'Nordic',
    population: 28000000, government: 'parliamentary council', leader: 'Premier Elin Sorensen',
    parties: ['Civic Green', 'Liberal Union', 'Workers Bloc'],
    gdp: 1800000000000, growth: 2.4, inflation: 1.9, unemployment: 3.1, debt: 41,
    tax: { corp: 22, income: 38, vat: 25, digital: 5 },
    internet: { penetration: 97, speed: 310, cost: 31, censorship: 5, backbone: 'tier-1' },
    regulation: { privacy: 92, ip: 64, copyright: 66, licensing: 74, business: 71, labor: 82, finance: 74, consumer: 84, cyber: 82, data: 91, crypto: 61, contracts: 78 },
    sectors: ['energy', 'privacy', 'software', 'shipping', 'research'],
    universities: ['Nordhavn Institute', 'Fjordhavn Design School'],
    telecoms: ['Nordic Loop', 'Fjord Light'], banks: ['Nordhavn Cooperative', 'Baltic Trust'],
    cyberPolicy: 'rights-based', stability: 86, approval: 61, costIndex: 1.08
  },
  {
    id: 'sakura', name: 'Sakura', formal: 'Sakura Compact', code: 'SK',
    region: 'asia-pacific', capital: 'Kiyosu', currency: 'SKY', language: 'Sakuran',
    population: 124000000, government: 'constitutional monarchy', leader: 'Prime Minister Hana Mori',
    parties: ['Compact Party', 'Renewal Front', 'Civic Network'],
    gdp: 5200000000000, growth: 1.1, inflation: 1.6, unemployment: 2.9, debt: 188,
    tax: { corp: 29, income: 33, vat: 10, digital: 3 },
    internet: { penetration: 96, speed: 260, cost: 47, censorship: 18, backbone: 'tier-1' },
    regulation: { privacy: 74, ip: 82, copyright: 86, licensing: 72, business: 66, labor: 70, finance: 72, consumer: 76, cyber: 78, data: 73, crypto: 55, contracts: 74 },
    sectors: ['electronics', 'robotics', 'gaming', 'manufacturing', 'media'],
    universities: ['Kiyosu Institute of Advanced Systems', 'Hoshino Arts and Technology'],
    telecoms: ['Sakura Wave', 'Kiyosu Backbone'], banks: ['Kiyosu Trust', 'Compact Savings'],
    cyberPolicy: 'resilience', stability: 82, approval: 48, costIndex: 1.05
  },
  {
    id: 'sundara', name: 'Sundara', formal: 'Sundara Union', code: 'SD',
    region: 'south-asia', capital: 'Sundar', currency: 'SDR', language: 'Sundari',
    population: 612000000, government: 'federal republic', leader: 'President Ravi Menon',
    parties: ['Union Progress', "People's Assembly", 'Digital Futures'],
    gdp: 2900000000000, growth: 5.6, inflation: 5.1, unemployment: 7.8, debt: 82,
    tax: { corp: 26, income: 18, vat: 12, digital: 2 },
    internet: { penetration: 71, speed: 95, cost: 22, censorship: 27, backbone: 'regional' },
    regulation: { privacy: 48, ip: 44, copyright: 47, licensing: 45, business: 51, labor: 42, finance: 53, consumer: 49, cyber: 56, data: 46, crypto: 58, contracts: 50 },
    sectors: ['software', 'services', 'telecoms', 'pharma', 'logistics'],
    universities: ['Sundar Institute of Science', 'Vanara Polytechnic'],
    telecoms: ['Sundara Mobile', 'Vanara Fibre'], banks: ['Union Bank of Sundara', 'Southline Credit'],
    cyberPolicy: 'development', stability: 61, approval: 57, costIndex: 0.62
  },
  {
    id: 'atlas', name: 'Atlas', formal: 'Atlas Republic', code: 'AT',
    region: 'africa', capital: 'Atlasia', currency: 'ATL', language: 'Atlasian',
    population: 96000000, government: 'republic', leader: 'President Nadia El Mansour',
    parties: ['Atlas Renewal', 'Coastal Alliance', 'Workers Congress'],
    gdp: 760000000000, growth: 4.3, inflation: 6.4, unemployment: 10.2, debt: 74,
    tax: { corp: 24, income: 21, vat: 14, digital: 2 },
    internet: { penetration: 63, speed: 78, cost: 27, censorship: 31, backbone: 'regional' },
    regulation: { privacy: 41, ip: 38, copyright: 42, licensing: 40, business: 47, labor: 39, finance: 45, consumer: 44, cyber: 49, data: 40, crypto: 63, contracts: 46 },
    sectors: ['telecoms', 'energy', 'agriculture', 'logistics', 'fintech'],
    universities: ['Atlasia National University', 'Sahelport Technical College'],
    telecoms: ['Atlas Connect', 'Sahel Mobile'], banks: ['Atlas Development Bank', 'Coastal Credit'],
    cyberPolicy: 'sovereign', stability: 56, approval: 49, costIndex: 0.58
  },
  {
    id: 'pampas', name: 'Pampas', formal: 'Pampas Confederation', code: 'PM',
    region: 'south-america', capital: 'Puerto Claro', currency: 'PMC', language: 'Pampan',
    population: 138000000, government: 'federal republic', leader: 'President Lucia Ferrer',
    parties: ['Federal Alliance', 'Southern Front', 'Green Horizon'],
    gdp: 1100000000000, growth: 3.4, inflation: 7.2, unemployment: 8.4, debt: 87,
    tax: { corp: 27, income: 22, vat: 16, digital: 2 },
    internet: { penetration: 78, speed: 110, cost: 29, censorship: 19, backbone: 'regional' },
    regulation: { privacy: 54, ip: 49, copyright: 51, licensing: 48, business: 53, labor: 51, finance: 54, consumer: 57, cyber: 52, data: 52, crypto: 66, contracts: 55 },
    sectors: ['agriculture', 'energy', 'software', 'logistics', 'media'],
    universities: ['Puerto Claro University', 'Llanura Institute of Technology'],
    telecoms: ['Pampas Link', 'Claro Sur Fibre'], banks: ['Banco del Sur', 'Pampas Cooperative'],
    cyberPolicy: 'mixed', stability: 63, approval: 41, costIndex: 0.66
  },
  {
    id: 'coral', name: 'Coral', formal: 'Coral States', code: 'CR',
    region: 'oceania', capital: 'Harborview', currency: 'CRC', language: 'English',
    population: 31000000, government: 'federal democracy', leader: 'Prime Minister Owen Rangi',
    parties: ['Coral United', 'Oceanic Greens', 'Frontier Party'],
    gdp: 1600000000000, growth: 2.6, inflation: 3.0, unemployment: 4.0, debt: 58,
    tax: { corp: 23, income: 28, vat: 11, digital: 4 },
    internet: { penetration: 91, speed: 205, cost: 52, censorship: 11, backbone: 'tier-2' },
    regulation: { privacy: 68, ip: 61, copyright: 64, licensing: 60, business: 59, labor: 61, finance: 64, consumer: 71, cyber: 69, data: 66, crypto: 57, contracts: 63 },
    sectors: ['cloud', 'media', 'tourism', 'energy', 'research'],
    universities: ['Harborview University', 'Reefside Institute'],
    telecoms: ['Coral Cable', 'Reef Wireless'], banks: ['Harborview Bank', 'Southern Pacific Trust'],
    cyberPolicy: 'resilience', stability: 78, approval: 53, costIndex: 0.98
  }
];

const CITY_DEFS = [
  ['meridian', 'novaria', 'Meridian', 6200000, 'us-east', 1.00, 'capital'],
  ['port-astra', 'novaria', 'Port Astra', 3100000, 'us-west', 0.92, 'technology'],
  ['greyhaven', 'albion', 'Greyhaven', 5400000, 'eu-west', 1.02, 'finance'],
  ['northbridge', 'albion', 'Northbridge', 1100000, 'eu-west', 0.88, 'industry'],
  ['rheinholt', 'rhine', 'Rheinholt', 4800000, 'eu-west', 0.96, 'industry'],
  ['hagenwerke', 'rhine', 'Hagenwerke', 1900000, 'eu-west', 0.90, 'manufacturing'],
  ['nordhavn', 'nordhavn', 'Nordhavn', 2600000, 'eu-north', 1.08, 'capital'],
  ['fjordhavn', 'nordhavn', 'Fjordhavn', 700000, 'eu-north', 0.95, 'research'],
  ['kiyosu', 'sakura', 'Kiyosu', 8900000, 'ap-south', 1.05, 'capital'],
  ['hoshino', 'sakura', 'Hoshino', 2200000, 'ap-south', 0.94, 'culture'],
  ['sundar', 'sundara', 'Sundar', 11200000, 'ap-south', 0.62, 'capital'],
  ['vanara', 'sundara', 'Vanara', 4400000, 'ap-south', 0.55, 'services'],
  ['atlasia', 'atlas', 'Atlasia', 3700000, 'af-south', 0.58, 'capital'],
  ['sahelport', 'atlas', 'Sahelport', 1600000, 'af-south', 0.50, 'logistics'],
  ['puerto-claro', 'pampas', 'Puerto Claro', 5100000, 'sa-east', 0.66, 'capital'],
  ['llanura', 'pampas', 'Llanura', 1200000, 'sa-east', 0.54, 'agriculture'],
  ['harborview', 'coral', 'Harborview', 4200000, 'ap-south', 0.98, 'capital'],
  ['reefside', 'coral', 'Reefside', 1400000, 'ap-south', 0.86, 'tourism']
];

const LAW_DOMAINS = [
  { id: 'privacy', name: 'Digital privacy', instruments: ['Personal Data Protection Act', 'Privacy Shield Amendment', 'Data Minimization Rules'], regulator: 'Data Protection Authority' },
  { id: 'ip', name: 'Intellectual property', instruments: ['Innovation and Invention Act', 'Patent Examination Rules', 'Trade Secret Protection Act'], regulator: 'Intellectual Property Office' },
  { id: 'copyright', name: 'Copyright', instruments: ['Digital Copyright Act', 'Fair Use and Remixing Rules', 'Orphan Works Regulation'], regulator: 'Copyright Tribunal' },
  { id: 'licensing', name: 'Software licensing', instruments: ['Software Licensing Act', 'Open Source Procurement Rules', 'License Audit Regulation'], regulator: 'Software Standards Board' },
  { id: 'business', name: 'Business registration', instruments: ['Corporate Registration Act', 'Foreign Ownership Rules', 'Beneficial Ownership Register'], regulator: 'Companies Registry' },
  { id: 'labor', name: 'Employment', instruments: ['Digital Labor Act', 'Remote Work Regulation', 'Worker Classification Rules'], regulator: 'Labor Relations Board' },
  { id: 'finance', name: 'Financial regulation', instruments: ['Payment Systems Act', 'Capital Adequacy Rules', 'Consumer Credit Regulation'], regulator: 'Financial Conduct Authority' },
  { id: 'consumer', name: 'Consumer protection', instruments: ['Digital Consumer Act', 'Automatic Renewal Rules', 'Platform Accountability Act'], regulator: 'Consumer Protection Bureau' },
  { id: 'cyber', name: 'Cybercrime', instruments: ['Computer Misuse Act', 'Critical Infrastructure Protection Act', 'Incident Reporting Rules'], regulator: 'CyberNet Authority' },
  { id: 'data', name: 'Data protection', instruments: ['Data Localization Act', 'Breach Notification Rules', 'Cross-Border Transfer Regulation'], regulator: 'Data Governance Office' },
  { id: 'crypto', name: 'Cryptocurrency', instruments: ['Digital Asset Act', 'Virtual Asset Service Provider Rules', 'Token Disclosure Regulation'], regulator: 'Digital Assets Commission' },
  { id: 'contracts', name: 'Digital contracts', instruments: ['Electronic Transactions Act', 'Smart Contract Recognition Rules', 'Digital Signature Regulation'], regulator: 'Electronic Commerce Board' }
];

const EDU_FIELDS = [
  { id: 'programming', name: 'Programming', research: 'cs', cert: 'Certified Developer', cost: 90, difficulty: 1, blurb: 'Algorithms, data structures, debugging, and the discipline of finishing software.' },
  { id: 'cybersecurity', name: 'Cybersecurity', research: 'cryptography', cert: 'Security Practitioner', cost: 160, difficulty: 3, blurb: 'Threat models, access control, incident response, and evidence handling.' },
  { id: 'networks', name: 'Networking', research: 'telecom', cert: 'Network Associate', cost: 120, difficulty: 2, blurb: 'Routing, switching, DNS, and the physical path a packet actually takes.' },
  { id: 'finance', name: 'Finance', research: 'cs', cert: 'Financial Analyst', cost: 180, difficulty: 3, blurb: 'Markets, credit, risk, and the accounting behind a balance sheet.' },
  { id: 'mathematics', name: 'Mathematics', research: 'quantum', cert: 'Applied Mathematics', cost: 100, difficulty: 3, blurb: 'Proof, probability, linear algebra, and numerical methods.' },
  { id: 'ai', name: 'Artificial intelligence', research: 'ai', cert: 'Machine Learning Engineer', cost: 240, difficulty: 4, blurb: 'Optimization, evaluation, model behavior, and the limits of inference.' },
  { id: 'cryptography', name: 'Cryptography', research: 'cryptography', cert: 'Applied Cryptographer', cost: 220, difficulty: 4, blurb: 'Protocols, key management, signatures, and formal assumptions.' },
  { id: 'design', name: 'Product design', research: 'cs', cert: 'Product Designer', cost: 110, difficulty: 1, blurb: 'Interfaces, accessibility, research, and the craft of making systems legible.' },
  { id: 'media', name: 'Journalism and media', research: 'cs', cert: 'Media Practitioner', cost: 95, difficulty: 2, blurb: 'Verification, sourcing, narrative, and publishing under pressure.' },
  { id: 'law', name: 'Technology law', research: 'cs', cert: 'Compliance Analyst', cost: 200, difficulty: 3, blurb: 'Jurisdiction, contracts, privacy, liability, and regulatory procedure.' },
  { id: 'operations', name: 'Operations', research: 'cs', cert: 'Operations Manager', cost: 130, difficulty: 2, blurb: 'Logistics, capacity planning, procurement, and organizational reliability.' },
  { id: 'economics', name: 'Economics', research: 'cs', cert: 'Policy Economist', cost: 170, difficulty: 3, blurb: 'Incentives, trade, public finance, and the structure of markets.' },
  { id: 'hardware', name: 'Hardware engineering', research: 'semiconductors', cert: 'Hardware Engineer', cost: 210, difficulty: 4, blurb: 'Circuits, fabrication constraints, thermal design, and supply reality.' },
  { id: 'biotech', name: 'Biotechnology', research: 'biotech', cert: 'Computational Biologist', cost: 230, difficulty: 4, blurb: 'Biological data, laboratory practice, ethics, and reproducible experiments.' }
];

const RESEARCH_FIELDS = [
  {
    id: 'cs', name: 'Computer Science', code: 'CS', discoveries: [
      { tier: 1, name: 'Incremental build graph', summary: 'A deterministic dependency graph lets large codebases rebuild in seconds without trusting stale artifacts.', impact: { software: 3, security: 1 } },
      { tier: 2, name: 'Composable verification toolkit', summary: 'Small verified components can be composed without re-proving the whole system, lowering the cost of trustworthy software.', impact: { software: 4, research: 2 } },
      { tier: 3, name: 'Self-describing distributed protocol', summary: 'Services negotiate capabilities and failure modes at runtime, reducing integration work across heterogeneous networks.', impact: { cloud: 3, telecom: 2 } }
    ]
  },
  {
    id: 'ai', name: 'Artificial Intelligence', code: 'AI', discoveries: [
      { tier: 1, name: 'Sparse attention scheduler', summary: 'A scheduling method cuts inference cost on long contexts without changing model outputs beyond a measured tolerance.', impact: { ai: 4, cloud: 2 } },
      { tier: 2, name: 'Grounded evaluation harness', summary: 'Tool use is scored against verifiable environment state rather than human preference alone, exposing silent failure modes.', impact: { ai: 3, software: 2 } },
      { tier: 3, name: 'Local continual learner', summary: 'On-device adaptation preserves privacy while remaining stable under distribution shift. Compute requirements keep it out of cheap hardware.', impact: { ai: 4, privacy: 3 } }
    ]
  },
  {
    id: 'robotics', name: 'Robotics', code: 'RB', discoveries: [
      { tier: 1, name: 'Compliant gripper control', summary: 'Low-cost force sensing makes delicate manipulation reliable enough for small-batch manufacturing.', impact: { manufacturing: 3, logistics: 2 } },
      { tier: 2, name: 'Fleet task arbitration', summary: 'Warehouse robots negotiate shared space and task priority without a central scheduler, improving uptime.', impact: { logistics: 4, manufacturing: 2 } },
      { tier: 3, name: 'Field-repairable actuator', summary: 'A modular actuator can be serviced by a technician rather than replaced, changing the economics of remote robotics.', impact: { robotics: 4, energy: 1 } }
    ]
  },
  {
    id: 'semiconductors', name: 'Semiconductor Engineering', code: 'SC', discoveries: [
      { tier: 1, name: 'Advanced packaging process', summary: 'Chiplets from mixed process nodes are packaged with acceptable yield, easing pressure on leading-edge capacity.', impact: { hardware: 4, manufacturing: 3 } },
      { tier: 2, name: 'Low-power memory controller', summary: 'A new controller reduces idle power in edge devices without sacrificing peak bandwidth.', impact: { hardware: 3, energy: 2 } },
      { tier: 3, name: 'Maskless prototype line', summary: 'Small-volume fabrication becomes economical for research teams, shortening the path from design to silicon.', impact: { hardware: 5, research: 3 } }
    ]
  },
  {
    id: 'cryptography', name: 'Cryptography', code: 'CY', discoveries: [
      { tier: 1, name: 'Post-quantum key exchange', summary: 'A hybrid key exchange is standardized for constrained networks, preserving compatibility with existing certificate chains.', impact: { security: 4, telecom: 2 } },
      { tier: 2, name: 'Threshold signing service', summary: 'Distributed key custody becomes practical for small organizations, reducing single-point compromise risk.', impact: { finance: 3, security: 3 } },
      { tier: 3, name: 'Verifiable delay primitive', summary: 'A practical delay function enables new coordination protocols, with unresolved questions about side channels.', impact: { security: 4, contracts: 2 } }
    ]
  },
  {
    id: 'quantum', name: 'Quantum Computing', code: 'QC', discoveries: [
      { tier: 1, name: 'Surface-code error budget', summary: 'Error rates are characterized well enough to plan small logical-qubit experiments, not to break real cryptography.', impact: { research: 3, security: 1 } },
      { tier: 2, name: 'Cryogenic control multiplexer', summary: 'Control wiring shrinks dramatically, allowing more qubits inside a practical dilution refrigerator.', impact: { quantum: 4, hardware: 2 } },
      { tier: 3, name: 'Logical qubit milestone', summary: 'A small logical qubit outperforms its physical components for a narrow class of problems. General-purpose advantage remains distant.', impact: { quantum: 5, research: 3 } }
    ]
  },
  {
    id: 'telecom', name: 'Telecommunications', code: 'TC', discoveries: [
      { tier: 1, name: 'Coherent edge transceiver', summary: 'Cheaper coherent optics raise long-haul capacity without replacing the installed fiber plant.', impact: { telecom: 4, cloud: 2 } },
      { tier: 2, name: 'Resilient mesh routing', summary: 'Networks reroute around correlated failures faster than legacy control planes, at the cost of more telemetry.', impact: { telecom: 4, infrastructure: 3 } },
      { tier: 3, name: 'Submarine cable monitoring', summary: 'Distributed acoustic sensing locates cable damage before customers report outages.', impact: { telecom: 3, infrastructure: 4 } }
    ]
  },
  {
    id: 'materials', name: 'Materials Science', code: 'MS', discoveries: [
      { tier: 1, name: 'Low-temperature solder alloy', summary: 'A reliable lead-free alloy reduces thermal stress in dense circuit assemblies.', impact: { hardware: 3, manufacturing: 2 } },
      { tier: 2, name: 'Recyclable battery cathode', summary: 'Cathode chemistry recovers most critical metals at commercial purity, reducing supply exposure.', impact: { energy: 4, hardware: 2 } },
      { tier: 3, name: 'Self-healing dielectric', summary: 'Thin-film insulation recovers from micro-cracks, extending the life of high-density power systems.', impact: { energy: 4, infrastructure: 3 } }
    ]
  },
  {
    id: 'energy', name: 'Energy Technology', code: 'EN', discoveries: [
      { tier: 1, name: 'Grid-scale flow battery', summary: 'A durable electrolyte chemistry makes four-hour storage economical in regions with volatile generation.', impact: { energy: 4, infrastructure: 3 } },
      { tier: 2, name: 'Data-center heat reuse', summary: 'Liquid cooling integrates with district heating without compromising rack density.', impact: { energy: 3, cloud: 2 } },
      { tier: 3, name: 'High-voltage DC breaker', summary: 'Reliable DC interruption enables meshed high-voltage grids and reduces conversion losses.', impact: { energy: 5, infrastructure: 4 } }
    ]
  },
  {
    id: 'biotech', name: 'Biotechnology', code: 'BT', discoveries: [
      { tier: 1, name: 'Reproducible assay pipeline', summary: 'Standardized lab automation cuts batch variance and makes published results easier to replicate.', impact: { research: 3, biotech: 3 } },
      { tier: 2, name: 'Protein folding screening', summary: 'A screening method narrows candidate structures before expensive wet-lab work, shortening early discovery.', impact: { biotech: 4, health: 2 } },
      { tier: 3, name: 'Programmable microbial chassis', summary: 'A stable chassis organism simplifies industrial biosynthesis, with strict containment requirements.', impact: { biotech: 5, manufacturing: 2 } }
    ]
  }
];

const TECH_SEEDS = [
  ['AsterOS', 'os', 'Novaria Systems', 'proprietary', '7.4', 44, ['x86', 'arm']],
  ['Northwind Toolchain', 'devtools', 'Northwind Devtools', 'open-source', '3.2', 31, ['js', 'wasm']],
  ['Kestrel Runtime', 'ai', 'Kestrel Analytics', 'proprietary', '2.8', 27, ['x86', 'arm', 'gpu']],
  ['Helix Model Mesh', 'ai', 'Helix Labs', 'source-available', '1.6', 18, ['gpu', 'tpu']],
  ['FinWise Ledger', 'database', 'FinWise', 'proprietary', '9.1', 38, ['x86']],
  ['StaticWave Edge', 'cloud', 'StaticWave', 'proprietary', '5.0', 24, ['global']],
  ['Orbital Compute', 'cloud', 'Orbital Cloud', 'proprietary', '8.3', 41, ['global']],
  ['Vanta Guard', 'security', 'Vanta Security', 'proprietary', '4.7', 22, ['linux', 'windows']],
  ['Basalt Transit', 'networking', 'Basalt Infrastructure', 'proprietary', '6.2', 29, ['ipv4', 'ipv6']],
  ['Rhine CNC Suite', 'devtools', 'Rhine Industrial', 'proprietary', '11.4', 33, ['windows']],
  ['Sakura Arcade Engine', 'framework', 'Kiyosu Games', 'open-source', '2.3', 26, ['pc', 'console']],
  ['Coral Stream', 'cloud', 'Coral Media', 'proprietary', '3.9', 19, ['global']],
  ['Sundara Pay', 'security', 'Sundara Mobile', 'proprietary', '5.5', 35, ['android']],
  ['Atlas Mesh', 'networking', 'Atlas Connect', 'proprietary', '2.1', 14, ['lte', '5g']],
  ['Pampas Agrisense', 'devtools', 'Pampas Cooperative', 'open-source', '1.9', 12, ['lora']],
  ['Meridian Standard Library', 'language', 'Meridian Institute', 'open-source', '4.0', 28, ['portable']],
  ['Nordhavn Privacy Stack', 'security', 'Nordhavn Institute', 'open-source', '3.1', 21, ['linux']],
  ['Cinder Freight OS', 'os', 'Cinder Freight', 'proprietary', '4.4', 9, ['arm']],
  ['Lattice Bio Pipeline', 'devtools', 'Lattice Biotech', 'source-available', '2.7', 11, ['linux']],
  ['Acme Control Plane', 'framework', 'Acme Industries', 'proprietary', '12.0', 30, ['x86']],
  ['NullNet Shell', 'os', 'NullNet Collective', 'open-source', '0.9', 7, ['linux']],
  ['Greyhaven Ledger', 'database', 'Greyhaven Clearing', 'proprietary', '6.8', 25, ['x86', 'arm']],
  ['Kiyosu Silicon', 'cpu', 'Sakura Semiconductor', 'proprietary', '3.3', 20, ['arm']],
  ['Atlas Solar Grid', 'networking', 'Atlas Energy', 'proprietary', '1.4', 13, ['grid']]
];

const MEDIA_SEEDS = [
  ['Signal Review', 'online', 'Signal Review', 620000, 74, -8, 'infrastructure and digital labor'],
  ['Byte Ledger', 'newspaper', 'Byte Ledger', 940000, 69, 6, 'markets and technology'],
  ['The Packet', 'online', 'The Packet', 310000, 66, -3, 'networks and outages'],
  ['Greyhaven Record', 'newspaper', 'Greyhaven Record', 1800000, 61, 4, 'national affairs'],
  ['Rheinholt Post', 'newspaper', 'Rheinholt Post', 2100000, 68, -2, 'industry and policy'],
  ['Kiyosu Culture Wire', 'magazine', 'Kiyosu Culture Wire', 1400000, 72, -5, 'games, music and design'],
  ['Sundar Daily', 'newspaper', 'Sundar Daily', 4800000, 54, 3, 'national and regional news'],
  ['Atlas Voice', 'tv', 'Atlas Broadcasting', 2600000, 49, 8, 'public affairs'],
  ['Pampas Signal', 'online', 'Pampas Signal', 890000, 58, -6, 'regional politics and labor'],
  ['Coral Current', 'tv', 'Coral Current', 1200000, 65, -1, 'climate and infrastructure'],
  ['Nordhavn Ledger', 'online', 'Nordhavn Ledger', 540000, 81, -4, 'privacy and public policy'],
  ['The Quiet Wire', 'podcast', 'independent', 180000, 77, -9, 'investigations and interviews'],
  ['Stack Notes', 'newsletter', 'independent', 240000, 73, 2, 'software engineering'],
  ['After Hours', 'streaming', 'Coral Media', 3100000, 57, 5, 'entertainment'],
  ['Cinder Log', 'online', 'Cinder Freight', 76000, 64, 1, 'logistics and supply'],
  ['Meridian Business Daily', 'newspaper', 'Meridian Business Daily', 3600000, 60, 7, 'finance and markets'],
  ['Open Bench', 'magazine', 'independent', 130000, 79, -7, 'open source and research'],
  ['Harborview Local', 'online', 'Harborview Local', 210000, 70, -2, 'cities and community'],
  ['The Standards Desk', 'newsletter', 'independent', 98000, 82, 0, 'protocols and compatibility'],
  ['Public Record', 'online', 'independent', 410000, 75, -5, 'courts and accountability']
];

const SUPPLY_MATERIALS = [
  ['silicon', 'Silicon wafers', 'kg', 42], ['copper', 'Copper', 'tonne', 9200],
  ['lithium', 'Lithium carbonate', 'tonne', 14800], ['rare-earth', 'Rare earth oxides', 'tonne', 31000],
  ['steel', 'Structural steel', 'tonne', 780], ['polymer', 'Technical polymers', 'tonne', 1450],
  ['energy', 'Industrial energy', 'MWh', 88], ['water', 'Process water', 'm3', 3]
];

const SUPPLY_COMPONENTS = [
  ['semiconductor', 'Semiconductor', 0.22, ['silicon', 'rare-earth', 'energy']],
  ['circuit-board', 'Circuit board', 0.10, ['copper', 'polymer', 'energy']],
  ['battery', 'Battery pack', 0.14, ['lithium', 'copper', 'energy']],
  ['network-chip', 'Networking chip', 0.12, ['semiconductor', 'copper']],
  ['display', 'Display panel', 0.09, ['rare-earth', 'polymer', 'energy']],
  ['cooling', 'Cooling assembly', 0.07, ['copper', 'steel', 'water']]
];

const PROPERTY_TYPES = [
  ['apartment', 'Apartment', 145000, 0.004, 0.0022],
  ['house', 'House', 340000, 0.0035, 0.0018],
  ['office', 'Office', 760000, 0.005, 0.003],
  ['commercial', 'Commercial building', 1250000, 0.0055, 0.0034],
  ['industrial', 'Industrial facility', 2100000, 0.0042, 0.0026],
  ['datacenter', 'Data center', 4800000, 0.006, 0.0038],
  ['warehouse', 'Warehouse', 980000, 0.0045, 0.0028],
  ['land', 'Development land', 540000, 0.002, 0.0012]
];

const CULTURE_SEEDS = [
  ['Kiyosu Games', 'studio', 'sakura', 'Kiyosu', 'Arcade and narrative games with a strong modding scene.'],
  ['Moth & Co', 'studio', 'novaria', 'Meridian', 'Small design studio that publishes experimental interactive work.'],
  ['Coral Media', 'streaming', 'coral', 'Harborview', 'Streaming and live events with a regional focus.'],
  ['Open Bench Records', 'music', 'nordhavn', 'Nordhavn', 'Independent label for ambient and experimental music.'],
  ['Sundar Play', 'esports', 'sundara', 'Sundar', 'Competitive gaming organization with regional teams.'],
  ['Pampas Community Radio', 'community', 'pampas', 'Puerto Claro', 'Community-run audio and local reporting.'],
  ['Atlas Game Works', 'studio', 'atlas', 'Atlasia', 'Mobile-first studio building games for low-bandwidth devices.'],
  ['Rhine Simulation League', 'esports', 'rhine', 'Rheinholt', 'Industrial simulation competitions and training.'],
  ['Greyhaven Stage', 'venue', 'albion', 'Greyhaven', 'Venue and streaming space for digital theatre.'],
  ['NullNet Salon', 'community', 'novaria', 'Port Astra', 'A volunteer community for writers, operators and researchers.']
];

const EVENT_ARCHETYPES = [
  { id: 'recession', category: 'economy', weight: 8, duration: 90, title: 'Global demand contracts', body: 'Order books weaken across several regions. Credit tightens and hiring slows.' },
  { id: 'boom', category: 'economy', weight: 7, duration: 60, title: 'Investment cycle accelerates', body: 'Capital moves into infrastructure and software as margins recover.' },
  { id: 'energy-crisis', category: 'infrastructure', weight: 9, duration: 24, title: 'Regional energy prices spike', body: 'Generation shortfalls and maintenance overlap, pushing industrial power costs upward.' },
  { id: 'fiber-cut', category: 'infrastructure', weight: 11, duration: 12, title: 'Fibre route severed', body: 'A construction incident damages a major route. Traffic reroutes through congested alternatives.' },
  { id: 'semiconductor-shortage', category: 'supply', weight: 8, duration: 120, title: 'Semiconductor allocation tightens', body: 'Foundry capacity is committed months ahead. Hardware lead times extend.' },
  { id: 'cyber-incident', category: 'security', weight: 10, duration: 24, title: 'Coordinated intrusion campaign detected', body: 'Several organizations report similar access patterns. Regulators open a joint inquiry.' },
  { id: 'monopoly-inquiry', category: 'law', weight: 6, duration: 150, title: 'Competition authority opens inquiry', body: 'A dominant platform is examined for self-preferencing and acquisition strategy.' },
  { id: 'tech-breakthrough', category: 'research', weight: 7, duration: 1, title: 'Research consortium announces breakthrough', body: 'A peer-reviewed result moves a field forward, with commercial effects expected slowly.' },
  { id: 'standards-war', category: 'technology', weight: 6, duration: 180, title: 'Rival standards split the market', body: 'Two compatibility camps form. Procurement decisions become political.' },
  { id: 'infrastructure-project', category: 'infrastructure', weight: 7, duration: 300, title: 'National network project approved', body: 'A multi-year build begins. Coverage and latency should improve after completion.' },
  { id: 'social-movement', category: 'society', weight: 7, duration: 60, title: 'Digital rights movement grows', body: 'Organizers demand transparency and stronger privacy safeguards.' },
  { id: 'sanctions', category: 'geopolitics', weight: 6, duration: 180, title: 'Trade restrictions announced', body: 'Export controls target advanced components. Supply chains begin to re-route.' },
  { id: 'diplomatic-summit', category: 'geopolitics', weight: 7, duration: 1, title: 'Ministerial summit convenes', body: 'Delegations agree on a narrow framework for cross-border data and incident response.' },
  { id: 'election', category: 'politics', weight: 5, duration: 1, title: 'National election changes the balance', body: 'A new governing coalition takes office with a different regulatory agenda.' },
  { id: 'media-scandal', category: 'media', weight: 6, duration: 30, title: 'Publication retracts a major story', body: 'An investigation finds insufficient sourcing. Trust in the outlet falls.' },
  { id: 'cable-landing', category: 'infrastructure', weight: 5, duration: 200, title: 'New cable landing station opens', body: 'Additional international capacity is commissioned, improving regional resilience.' }
];

const HISTORY_SEEDS = [
  [2016, 'infrastructure', 'NullNet opens its public shell', 'A volunteer network begins offering shared mail, git and a contract board to independent operators.'],
  [2017, 'technology', 'AsterOS 5 ships with signed updates', 'The first mainstream operating system to require signed boot and update paths reaches broad adoption.'],
  [2018, 'economy', 'Meridian exchange introduces digital-asset reporting', 'Custodians must disclose reserve practices after a prolonged audit dispute.'],
  [2019, 'research', 'Helix Labs publishes sparse-model inference work', 'The result lowers serving costs but is initially dismissed as an engineering curiosity.'],
  [2020, 'society', 'Remote work reshapes city infrastructure', 'Demand shifts from central offices toward residential bandwidth and distributed logistics.'],
  [2021, 'law', 'Nordhavn passes the Data Dignity Act', 'The law establishes purpose limitation and a right to explanation for automated decisions.'],
  [2022, 'supply', 'Semiconductor allocation enters a second year', 'Hardware lead times stretch. Regional governments begin subsidizing packaging capacity.'],
  [2023, 'security', 'OldCo migration collapses', 'A former hosting provider switches off most of its estate. Some customer data and systems remain online.'],
  [2024, 'technology', 'On-device model runtimes reach consumer hardware', 'Quantized inference makes local assistants practical, though quality varies widely.'],
  [2025, 'geopolitics', 'Atlas and Sundara sign the Southline fibre accord', 'The agreement funds a new route and establishes shared incident reporting.'],
  [2026, 'infrastructure', 'Basalt commissions a resilient eu-west ring', 'The new ring reduces correlated failures but raises transit costs for small networks.']
];

/* ============================================================
   SMALL HELPERS
   ============================================================ */
function civRng(game, salt = 0) {
  return makeRng((game.seed ^ Math.floor(game.worldMinutes * 2654435761) ^ (game.tickCount * 97) ^ salt) >>> 0);
}
function nextId(civ, prefix) {
  civ.seq[prefix] = (civ.seq[prefix] || 0) + 1;
  return `${prefix}-${String(civ.seq[prefix]).padStart(4, '0')}`;
}
function bounded(arr, cap) { if (arr.length > cap) arr.splice(0, arr.length - cap); return arr; }
function money(n) { return Math.round(Number(n) || 0); }
function clampPct(n) { return clamp(Number(n) || 0, 0, 100); }
function regionLabel(id) { return REGION_LABEL[id] || id; }
function yearOf(game, world = game.worldMinutes) {
  return 2026 + Math.floor((world - 552) / YEAR);
}
function dateLabel(game, world = game.worldMinutes) {
  const day = Math.floor(world / DAY);
  return fmtDate(new Date((game.createdAt || Date.now()) + day * 86400000));
}
function pickWeighted(rng, items, weightFn) {
  const total = items.reduce((s, x) => s + Math.max(0, weightFn(x)), 0);
  if (total <= 0) return rng.pick(items);
  let r = rng.next() * total;
  for (const x of items) { r -= Math.max(0, weightFn(x)); if (r <= 0) return x; }
  return items[items.length - 1];
}

/* ============================================================
   BUILD: COUNTRIES, CITIES, LAW
   ============================================================ */
function makeCountry(def, rng) {
  const regulation = { ...def.regulation };
  const internet = { ...def.internet };
  for (const key of Object.keys(regulation)) regulation[key] = clamp(regulation[key] + rng.int(-4, 4), 0, 100);
  internet.penetration = clamp(internet.penetration + rng.int(-2, 2), 20, 99);
  const stability = clamp(def.stability + rng.int(-3, 3), 20, 95);
  return {
    id: def.id, name: def.name, formal: def.formal, code: def.code,
    region: def.region, capital: def.capital, currency: def.currency, language: def.language,
    population: def.population, government: def.government, leader: def.leader,
    parties: def.parties.slice(), rulingParty: def.parties[0],
    economy: {
      gdp: def.gdp, growth: def.growth, inflation: def.inflation, unemployment: def.unemployment,
      debt: def.debt, reserves: Math.round(def.gdp * rng.float(.04, .12)),
      tax: { ...def.tax }, budget: Math.round(def.gdp * rng.float(.18, .28)),
      tradeBalance: Math.round(def.gdp * rng.float(-.04, .05)), productivity: rng.int(45, 88)
    },
    internet, regulation,
    tax: { ...def.tax }, sectors: def.sectors.slice(),
    universities: def.universities.slice(), telecoms: def.telecoms.slice(), banks: def.banks.slice(),
    cyberPolicy: def.cyberPolicy, stability, approval: def.approval + rng.int(-3, 3),
    unrest: clamp(100 - stability + rng.int(-8, 8), 0, 100),
    costIndex: def.costIndex,
    institutions: [], relations: {}, nextElection: 0,
    policyAgenda: [], lastBudgetWorld: 0, internetFreedom: 0,
    historyStart: -Math.round(rng.int(8, 40) * YEAR)
  };
}

function makeCity(def, country, rng) {
  const [id, countryId, name, population, region, cost, character] = def;
  const districts = {
    residential: rng.int(28, 62), commercial: rng.int(12, 34), industrial: rng.int(6, 28),
    education: rng.int(3, 14), medical: rng.int(2, 12), datacenter: rng.int(1, 10),
    logistics: rng.int(3, 18), leisure: rng.int(4, 20)
  };
  return {
    id, countryId, name, population, region, costIndex: cost, character,
    districts,
    utilities: {
      power: clamp(rng.int(66, 97) - Math.round((1 - cost) * 6), 30, 99),
      water: clamp(rng.int(70, 99), 30, 99),
      telecom: clamp(country.internet.penetration - rng.int(0, 8), 25, 99),
      transport: clamp(rng.int(48, 94), 25, 99)
    },
    prices: {
      housing: Math.round(1200 * cost * rng.float(.8, 1.3)),
      energy: Math.round(country.economy.inflation * 9 * cost + rng.int(8, 26)),
      bandwidth: Math.round(country.internet.cost * rng.float(.7, 1.3)),
      labor: Math.round(28 * cost * rng.float(.8, 1.2))
    },
    conditions: { congestion: rng.int(18, 72), pollution: rng.int(8, 58), resilience: rng.int(40, 92) },
    buildings: [], dataCenterIds: [], createdAtWorld: 0
  };
}

function makeLaw(civ, country, domain, rng, status = 'active') {
  const strictness = clamp((country.regulation[domain.id] || 50) + rng.int(-6, 6), 0, 100);
  const instrument = rng.pick(domain.instruments);
  const severity = strictness >= 78 ? 'strict' : strictness >= 58 ? 'moderate' : 'light';
  const fineBase = severity === 'strict' ? rng.int(1800, 12000) : severity === 'moderate' ? rng.int(500, 4200) : rng.int(80, 900);
  return {
    id: nextId(civ, 'law'), countryId: country.id, domain: domain.id,
    domainName: domain.name, name: instrument, status, severity, strictness,
    regulator: domain.regulator, summary: lawSummary(domain.id, severity, country),
    fineMax: fineBase, complianceCost: Math.round(fineBase * rng.float(.08, .22)),
    enactedWorld: status === 'active' ? -Math.round(rng.int(1, 9) * YEAR) : null,
    effectiveWorld: status === 'active' ? -Math.round(rng.int(1, 9) * YEAR) : civ.worldMinutes + rng.int(30, 180) * DAY,
    publicSupport: clamp(40 + strictness * .35 + rng.int(-12, 12), 0, 100),
    enforcement: clamp(strictness + rng.int(-15, 10), 0, 100)
  };
}

function lawSummary(domainId, severity, country) {
  const level = severity === 'strict' ? 'strict compliance and proactive reporting' : severity === 'moderate' ? 'registration, disclosure and proportionate controls' : 'baseline disclosure with complaint-driven enforcement';
  const map = {
    privacy: `Personal data must be collected for stated purposes and retained no longer than necessary. ${level}.`,
    ip: `Patents, trademarks and trade secrets are recognized. ${level}.`,
    copyright: `Copyright applies to software, media and datasets. ${level}.`,
    licensing: `Software licenses must be disclosed in procurement. ${level}.`,
    business: `Organizations must register ownership and file annual accounts. ${level}.`,
    labor: `Employment classification, working time and remote-work duties are defined. ${level}.`,
    finance: `Payment, lending and custody activities require authorization. ${level}.`,
    consumer: `Automatic renewal, refunds and platform conduct are regulated. ${level}.`,
    cyber: `Unauthorized access and failure to report incidents are offences. ${level}.`,
    data: `Cross-border transfers and breach notification are controlled. ${level}.`,
    crypto: `Digital-asset issuance, custody and marketing are regulated. ${level}.`,
    contracts: `Electronic signatures and automated contracts are recognized with evidentiary rules. ${level}.`
  };
  const domain = LAW_DOMAINS.find(d => d.id === domainId);
  return `${map[domainId] || 'The activity is regulated.'} Enforced by the ${country.name} ${domain?.regulator || 'Digital Services Office'}.`;
}

function makeInstitution(civ, country, kind, name, rng) {
  return {
    id: nextId(civ, 'inst'), countryId: country.id, kind, name,
    budget: Math.round(country.economy.gdp * rng.float(.0004, .003)),
    staff: rng.int(40, 4200), independence: rng.int(38, 92), integrity: rng.int(42, 94),
    activeCases: rng.int(0, 60), backlog: rng.int(4, 240), status: 'operational'
  };
}

/* ============================================================
   BUILD: EDUCATION + RESEARCH
   ============================================================ */
function makeCourse(civ, field, institution, country, rng) {
  const online = institution.type === 'online';
  const quality = institution.quality;
  const weeks = field.difficulty * rng.int(3, 7);
  return {
    id: nextId(civ, 'course'), field: field.id, fieldName: field.name,
    institutionId: institution.id, institutionName: institution.name,
    countryId: country?.id || null, level: rng.pick(['introductory', 'applied', 'advanced']),
    weeks, hours: weeks * rng.int(3, 8), tuition: online ? Math.round(field.cost * rng.float(.2, .6)) : Math.round(field.cost * rng.float(.8, 2.2)),
    certification: field.cert, quality, capacity: rng.int(30, 900),
    enrolled: rng.int(10, 400), completionRate: clamp(quality - rng.int(5, 25), 20, 96),
    blurb: field.blurb, status: 'open'
  };
}

function makeInstitutionFromCountry(civ, country, name, rng) {
  return {
    id: nextId(civ, 'edu'), name, type: 'university', countryId: country.id,
    cityId: rng.pick(civ.cities.filter(c => c.countryId === country.id)).id,
    quality: rng.int(58, 94), capacity: rng.int(4000, 42000), tuition: Math.round(3200 * country.costIndex * rng.float(.7, 1.9)),
    researchOutput: rng.int(18, 92), endowment: Math.round(country.economy.gdp * rng.float(.00002, .0002)),
    fields: rng.picks(EDU_FIELDS, rng.int(4, 8)).map(f => f.id), status: 'open'
  };
}

function makeDiscovery(civ, field, template, rng, opts = {}) {
  return {
    id: nextId(civ, 'disc'), field: field.id, fieldName: field.name,
    name: template.name, tier: template.tier, summary: template.summary,
    year: opts.year ?? yearOf({ worldMinutes: opts.world ?? civ.worldMinutes }, opts.world ?? civ.worldMinutes),
    world: opts.world ?? civ.worldMinutes, labId: opts.labId || null,
    leadNpcId: opts.leadNpcId || null, countryId: opts.countryId || null,
    impact: { ...template.impact }, replicated: opts.replicated ?? rng.chance(.6),
    citations: opts.citations ?? rng.int(0, 240), status: 'published'
  };
}

function makeProject(civ, field, lab, country, rng, opts = {}) {
  const tier = opts.tier || 1;
  const template = field.discoveries.find(d => d.tier === tier) || field.discoveries[0];
  return {
    id: nextId(civ, 'proj'), field: field.id, fieldName: field.name,
    title: opts.title || `Advance ${field.name.toLowerCase()} (tier ${tier})`,
    labId: lab?.id || null, labName: lab?.name || 'Independent lab',
    countryId: country?.id || null, leadNpcId: opts.leadNpcId || null,
    tier, targetName: template.name, progress: opts.progress ?? rng.int(0, 60),
    funding: opts.funding ?? Math.round(rng.int(40000, 420000)), fundingNeeded: opts.fundingNeeded ?? Math.round(rng.int(120000, 900000)),
    equipment: opts.equipment ?? rng.int(30, 92), expertise: opts.expertise ?? rng.int(35, 96),
    difficulty: clamp(28 + tier * 18 + rng.int(-8, 12), 20, 95),
    startedWorld: opts.startedWorld ?? civ.worldMinutes - rng.int(10, 240) * DAY,
    etaWorld: opts.etaWorld ?? civ.worldMinutes + Math.round(rng.int(20, 180) * DAY),
    status: opts.status || 'active', notes: [], discoveryId: null
  };
}

function makeLab(civ, name, type, countryId, rng, ownerId = null) {
  return {
    id: nextId(civ, 'lab'), name, type, countryId, ownerId,
    equipment: rng.int(28, 96), funding: Math.round(rng.int(90000, 2400000)),
    staff: rng.int(4, 380), specialties: rng.picks(RESEARCH_FIELDS, rng.int(2, 5)).map(f => f.id),
    reputation: rng.int(18, 92), status: 'active'
  };
}

/* ============================================================
   BUILD: MEDIA, INFRASTRUCTURE, PROPERTY, SUPPLY, TECH, CULTURE
   ============================================================ */
function makeOutlet(civ, seed, rng) {
  const [name, type, owner, audience, trust, bias, focus] = seed;
  return {
    id: nextId(civ, 'outlet'), name, type, ownerName: owner, countryId: rng.pick(civ.countries).id,
    audience, trust, bias, focus, reach: Math.round(audience * rng.float(.4, 1.4)),
    funding: Math.round(audience * rng.float(1.4, 8)), staff: rng.int(3, 900),
    corrections: 0, retractions: 0, status: 'active'
  };
}

function makeContent(civ, outlet, rng, opts = {}) {
  const topics = ['infrastructure', 'security', 'markets', 'labor', 'policy', 'science', 'culture', 'games', 'privacy', 'supply'];
  const topic = opts.topic || rng.pick(topics);
  const headline = opts.headline || contentHeadline(topic, rng);
  return {
    id: nextId(civ, 'content'), outletId: outlet.id, outletName: outlet.name,
    authorId: opts.authorId || (gameNpcIds(civ).length ? rng.pick(gameNpcIds(civ)).id : null),
    topic, headline, type: opts.type || 'report', reach: opts.reach ?? rng.int(200, 90000),
    trustDelta: opts.trustDelta ?? rng.int(-2, 3), sentiment: opts.sentiment ?? rng.int(-40, 40),
    world: opts.world ?? civ.worldMinutes, corrections: 0, status: 'published',
    body: opts.body || `${headline} The reporting is based on public records and interviews. Some details remain unverified.`
  };
}

function gameNpcIds(civ) {
  if (!civ._npcIds || civ._npcIds.length === 0) {
    civ._npcIds = (civ.identities || []).filter(x => x.kind === 'npc').map(x => ({ id: x.id }));
  }
  return civ._npcIds;
}

function contentHeadline(topic, rng) {
  const map = {
    infrastructure: ['Regional network upgrade slips past deadline', 'Fibre route restored after construction damage', 'Data center cooling retrofit cuts power use'],
    security: ['Regulator publishes incident reporting guidance', 'Credential leak exposes a mid-sized hosting provider', 'Researchers question a widely used update mechanism'],
    markets: ['Infrastructure spending lifts hardware orders', 'Investors rotate toward cash-generating software', 'Currency volatility complicates cloud contracts'],
    labor: ['Remote work rules tighten in two jurisdictions', 'Engineers organize around on-call compensation', 'Skills shortage persists despite training subsidies'],
    policy: ['Privacy amendment advances to committee', 'Digital market bill draws industry objections', 'Cross-border data talks resume'],
    science: ['Consortium reports reproducible battery result', 'Peer review finds gaps in a high-profile AI paper', 'University lab opens shared fabrication line'],
    culture: ['Independent studio finds an audience with a small game', 'Streaming platform changes revenue split', 'Community archive preserves early network art'],
    games: ['Modding community keeps a decade-old game alive', 'Esports league adopts a regional format', 'Engine release focuses on compatibility'],
    privacy: ['Court narrows bulk data retention', 'Users challenge automatic profiling', 'Privacy regulator opens a probe into adtech'],
    supply: ['Semiconductor lead times improve slightly', 'Warehouse automation spreads to smaller operators', 'Energy costs pressure fabrication margins']
  };
  return rng.pick(map[topic] || map.infrastructure);
}

function makeInfrastructure(civ, rng) {
  const grids = civ.cities.map(city => ({
    id: nextId(civ, 'grid'), cityId: city.id, countryId: city.countryId,
    capacity: Math.round(city.population * rng.float(.0008, .0016)),
    load: rng.int(38, 86), reliability: city.utilities.power,
    status: 'nominal', lastIncidentWorld: 0
  }));
  const fiber = civ.countries.map(country => ({
    id: nextId(civ, 'fiber'), countryId: country.id, name: `${country.name} backbone`,
    capacity: Math.round(country.internet.penetration * rng.float(8, 30)),
    utilization: rng.int(22, 78), latency: Math.round(80 - country.internet.speed / 8 + rng.int(2, 20)),
    redundancy: rng.int(24, 92), status: 'nominal', lastIncidentWorld: 0
  }));
  const dataCenters = [];
  for (const city of civ.cities) {
    const count = Math.max(1, Math.round(city.districts.datacenter / 3));
    for (let i = 0; i < count; i++) {
      dataCenters.push({
        id: nextId(civ, 'dc'), cityId: city.id, countryId: city.countryId, region: city.region,
        name: `${city.name} ${['North', 'South', 'Harbor', 'Central'][i % 4]} DC`,
        capacity: rng.int(40, 900), utilization: rng.int(18, 84),
        power: city.utilities.power, cooling: rng.int(40, 96), tier: rng.pick(['II', 'III', 'III', 'IV']),
        operatorId: rng.chance(.55) ? rng.pick(civ._companies).id : null,
        status: 'operational'
      });
    }
  }
  const logistics = civ.cities.filter(c => c.districts.logistics > 8).slice(0, 12).map(city => ({
    id: nextId(civ, 'logi'), cityId: city.id, countryId: city.countryId,
    name: `${city.name} freight hub`, capacity: rng.int(40, 480),
    throughput: rng.int(20, 90), congestion: rng.int(8, 72), status: 'nominal'
  }));
  return { grids, fiber, dataCenters, logistics, outages: [] };
}

function makePropertyListings(civ, rng) {
  const listings = [];
  for (const city of civ.cities) {
    const types = rng.picks(PROPERTY_TYPES, rng.int(3, 5));
    for (const [type, label, base, rentYield, appreciation] of types) {
      const market = civ.property.market.index / 100;
      const price = Math.round(base * city.costIndex * market * rng.float(.8, 1.3) / 1000) * 1000;
      listings.push({
        id: nextId(civ, 'prop'), type, label, cityId: city.id, countryId: city.countryId,
        price, rent: Math.round(price * rentYield / 12), maintenance: Math.round(price * .008 / 12),
        taxRate: civ.countries.find(c => c.id === city.countryId).tax.vat / 100,
        ownerId: null, ownerName: 'market', status: 'available', quality: rng.int(35, 96),
        built: 2026 - rng.int(0, 70), listedWorld: civ.worldMinutes - rng.int(0, 40) * DAY
      });
    }
  }
  return listings;
}

function makeSupply(civ, rng) {
  const materials = {};
  for (const [id, name, unit, base] of SUPPLY_MATERIALS) {
    materials[id] = { id, name, unit, base, price: base, availability: rng.int(58, 98), demand: rng.int(40, 90), stock: Math.round(rng.int(400, 9000)) };
  }
  const components = {};
  for (const [id, name, costShare, inputs] of SUPPLY_COMPONENTS) {
    components[id] = { id, name, costShare, inputs, price: 0, availability: rng.int(48, 96), demand: rng.int(38, 92), stock: Math.round(rng.int(200, 4000)) };
  }
  const factories = rng.picks(civ._companies, 10).map(co => ({
    id: nextId(civ, 'factory'), companyId: co.id, companyName: co.name,
    cityId: rng.pick(civ.cities.filter(c => c.countryId === 'rhine' || c.countryId === 'sakura' || c.countryId === 'novaria' || c.countryId === 'sundara')).id,
    output: rng.pick(['semiconductor', 'circuit-board', 'battery', 'network-chip', 'display', 'cooling']),
    capacity: rng.int(40, 960), utilization: rng.int(30, 92), efficiency: rng.int(45, 94),
    energyUse: rng.int(20, 90), status: 'operating'
  }));
  const warehouses = rng.picks(civ.cities, 12).map(city => ({
    id: nextId(civ, 'warehouse'), cityId: city.id, countryId: city.countryId,
    name: `${city.name} distribution`, capacity: rng.int(100, 1400), inventory: rng.int(40, 900),
    utilization: rng.int(20, 88), status: 'operational'
  }));
  const shipments = [];
  for (let i = 0; i < 8; i++) {
    const from = rng.pick(warehouses), to = rng.pick(warehouses.filter(w => w.id !== from.id)) || from;
    shipments.push({
      id: nextId(civ, 'ship'), fromId: from.id, toId: to.id,
      cargo: rng.pick(Object.keys(components)), quantity: rng.int(20, 400),
      departedWorld: civ.worldMinutes, etaWorld: civ.worldMinutes + rng.int(6, 96) * 60,
      status: rng.pick(['in-transit', 'in-transit', 'delayed']), delayHours: 0
    });
  }
  return { materials, components, factories, warehouses, shipments, hardwareIndex: 100, energyIndex: 100, lastProductionWorld: civ.worldMinutes };
}

function makeTech(civ, seed, rng) {
  const [name, category, vendor, license, version, adoption, compatibility] = seed;
  return {
    id: nextId(civ, 'tech'), name, category, vendorName: vendor, license, version,
    adoption, compatibility: compatibility.slice(),
    releasedWorld: civ.worldMinutes - rng.int(1, 12) * YEAR,
    documentation: rng.int(35, 96), security: rng.int(32, 96), ecosystem: rng.int(20, 94),
    priceIndex: rng.int(40, 160), status: 'active', standard: false,
    originDiscoveryId: null, competitors: []
  };
}

function makeCulture(civ, seed, rng) {
  const [name, kind, countryId, cityName, desc] = seed;
  return {
    id: nextId(civ, 'culture'), name, kind, countryId, cityName, desc,
    audience: rng.int(4000, 2800000), reputation: rng.int(18, 92),
    revenue: Math.round(rng.int(4000, 4200000)), staff: rng.int(2, 260),
    status: 'active', works: []
  };
}

function makeIdentity(game, civ, npc, rng) {
  const company = npc.companyId ? civ._companies.find(c => c.id === npc.companyId) : null;
  const country = countryForCompany(civ, company) || civ.countries.find(c => c.id === 'novaria');
  const professional = clamp((npc.skill || 50) + rng.int(-8, 10), 5, 99);
  const social = clamp((npc.rep || 40) + rng.int(-18, 22), 3, 99);
  return {
    id: npc.id, kind: 'npc', handle: npc.handle, name: npc.name, countryId: country?.id || null,
    professional: {
      score: professional, title: npc.role || 'operator', employerId: npc.companyId || null,
      endorsements: rng.int(0, 120), employmentHistory: company ? [{ companyId: company.id, role: npc.role, since: yearOf(game) - rng.int(1, 12) }] : [],
      verified: professional > 72
    },
    social: {
      score: social, followers: rng.int(20, 90000), controversy: clamp(rng.int(0, 40) - Math.round(social / 4), 0, 100),
      communities: rng.picks(['open-source', 'security', 'design', 'gaming', 'policy', 'local'], rng.int(1, 3))
    },
    security: {
      score: clamp(40 + (npc.skill || 50) * .4 - rng.int(0, 18), 5, 99),
      incidents: rng.chance(.12) ? rng.int(1, 4) : 0, credentials: rng.chance(.4) ? ['hardware-key'] : []
    },
    financial: {
      score: clamp(30 + Math.log10(Math.max(100, npc.funds || 1000)) * 9 + rng.int(-8, 8), 5, 99),
      credit: rng.int(420, 820), assets: Math.round((npc.funds || 0) * rng.float(.1, .8))
    },
    academic: {
      score: clamp(20 + (npc.skill || 50) * .5 + rng.int(-10, 20), 3, 99),
      publications: rng.chance(.35) ? rng.int(1, 24) : 0, citations: rng.int(0, 800),
      field: rng.pick(['cs', 'ai', 'security', 'networks', 'economics', 'design'])
    },
    credentials: [], published: [], updatedWorld: civ.worldMinutes
  };
}

function countryForCompany(civ, company) {
  if (!company) return null;
  return civ.countries.find(c => c.id === company.hqCountryId) || civ.countries.find(c => c.hq && c.capital === company.hq) || civ.countries[0];
}

function assignCompanyJurisdictions(civ, game, rng = null) {
  const byRegion = {
    'us-east': ['novaria'], 'us-west': ['novaria'], 'eu-west': ['albion', 'rhine'],
    'eu-north': ['nordhavn'], 'ap-south': ['sakura', 'sundara', 'coral'],
    'sa-east': ['pampas'], 'af-south': ['atlas']
  };
  for (const co of game.companies || []) {
    if (co.hqCountryId && civ.countries.some(c => c.id === co.hqCountryId)) continue;
    const candidates = byRegion[co.hq] || [];
    const countryId = candidates.length ? (rng ? rng.pick(candidates) : candidates[0]) : 'novaria';
    co.hqCountryId = countryId;
    co.jurisdiction = civ.countries.find(c => c.id === countryId)?.name || 'Novaria';
  }
}

/* ============================================================
   BUILD ROOT
   ============================================================ */
export function buildCivilization(game, rng = null) {
  rng = rng || makeRng((game.seed ^ 0x1c1b1a19) >>> 0);
  const civ = {
    version: CIV_VERSION, builtWorld: game.worldMinutes, seq: {},
    countries: [], cities: [], institutions: [], laws: [], courts: [], regulators: [],
    disputes: [], compliance: [], policies: [],
    relations: { treaties: [], sanctions: [], negotiations: [], blocs: [] },
    education: { institutions: [], courses: [], certifications: [], enrollments: [], player: { knowledge: {}, credentials: [], studyHours: 0, enrolled: null } },
    research: { fields: RESEARCH_FIELDS.map(f => ({ id: f.id, name: f.name, code: f.code, level: 1, progress: rng.int(0, 40), funding: rng.int(100000, 4000000), discoveries: [] })), labs: [], projects: [], discoveries: [] },
    media: { outlets: [], content: [], publicOpinion: {}, trends: [], playerPublished: [] },
    infrastructure: null, property: { listings: [], owned: [], market: { index: 100, rentIndex: 100, vacancy: 7, lastUpdateWorld: game.worldMinutes } },
    supply: null, tech: { technologies: [], standards: [], lastReleaseWorld: game.worldMinutes },
    culture: { organizations: [], games: [], music: [], communities: [], esports: [], events: [] },
    identities: [], player: null,
    events: [], timeline: [], cadence: { continuous: 0, politics: 0, economy: 0, supply: 0, media: 0, research: 0, events: 0, history: 0, property: 0, education: 0, infrastructure: 0 },
    metrics: {}, multiplayer: null, _companies: (game.companies || []).slice(), _npcIds: []
  };
  civ.worldMinutes = game.worldMinutes;

  civ.countries = COUNTRY_DEFS.map(def => makeCountry(def, rng));
  civ.cities = CITY_DEFS.map(def => makeCity(def, civ.countries.find(c => c.id === def[1]), rng));
  assignCompanyJurisdictions(civ, game, rng);

  // Institutions and legal architecture.
  for (const country of civ.countries) {
    country.institutions = [
      makeInstitution(civ, country, 'legislature', `${country.name} National Assembly`, rng),
      makeInstitution(civ, country, 'court', `${country.name} High Court`, rng),
      makeInstitution(civ, country, 'regulator', `${country.name} ${country.cyberPolicy === 'strict' ? 'Cyber Oversight Board' : 'Digital Services Office'}`, rng)
    ];
    civ.institutions.push(...country.institutions);
    civ.courts.push({ ...country.institutions[1], jurisdiction: country.id, type: 'high', cases: rng.int(20, 320) });
    civ.regulators.push({ ...country.institutions[2], domain: 'digital', investigations: rng.int(2, 80) });
    for (const domain of LAW_DOMAINS) {
      civ.laws.push(makeLaw(civ, country, domain, rng));
    }
    // A live amendment in selected jurisdictions.
    if (rng.chance(.55)) {
      const domain = rng.pick(LAW_DOMAINS);
      const proposal = makeLaw(civ, country, domain, rng, 'proposed');
      proposal.effectiveWorld = game.worldMinutes + rng.int(20, 160) * DAY;
      civ.laws.push(proposal);
      civ.policies.push({ id: nextId(civ, 'policy'), countryId: country.id, domain: domain.id, name: `Amendment to the ${domain.name.toLowerCase()} framework`, status: 'proposed', support: rng.int(28, 72), introducedWorld: game.worldMinutes, effectiveWorld: proposal.effectiveWorld, effect: 'regulatory tightening' });
    }
    country.nextElection = game.worldMinutes + rng.int(60, 900) * DAY;
    country.internetFreedom = clamp(100 - country.internet.censorship * 1.3 + country.regulation.privacy * .25, 0, 100);
  }

  // Relations before the player arrives.
  for (const a of civ.countries) {
    for (const b of civ.countries) {
      if (a.id === b.id) continue;
      const shared = a.region === b.region ? 12 : 0;
      a.relations[b.id] = {
        trade: clamp(rng.int(24, 78) + shared, 0, 100),
        tension: clamp(rng.int(4, 38) - shared / 2, 0, 100),
        trust: clamp(rng.int(28, 78) + shared, 0, 100),
        stance: rng.pick(['cooperative', 'neutral', 'cautious', 'competitive']),
        treaty: rng.chance(.22), sanctioned: false
      };
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = rng.pick(civ.countries), b = rng.pick(civ.countries.filter(c => c.id !== a.id));
    civ.relations.treaties.push({
      id: nextId(civ, 'treaty'), a: a.id, b: b.id, name: rng.pick(['Cross-border Data Accord', 'Mutual Incident Notification Pact', 'Critical Infrastructure Convention', 'Technology Trade Framework']),
      signedWorld: game.worldMinutes - rng.int(1, 16) * YEAR, status: 'active', compliance: rng.int(42, 94)
    });
    a.relations[b.id].treaty = true; b.relations[a.id].treaty = true;
  }

  // Education.
  for (const country of civ.countries) {
    for (const name of country.universities) civ.education.institutions.push(makeInstitutionFromCountry(civ, country, name, rng));
  }
  const onlineEd = [
    ['Open Bench Academy', 'global', 'online', 78], ['Night Shift Labs', 'global', 'online', 71],
    ['Meridian Extension', 'novaria', 'online', 84], ['Sundar Skills Network', 'sundara', 'online', 62],
    ['Harborview Field School', 'coral', 'training', 74]
  ];
  for (const [name, scope, type, quality] of onlineEd) {
    const country = scope === 'global' ? rng.pick(civ.countries) : civ.countries.find(c => c.id === scope);
    civ.education.institutions.push({
      id: nextId(civ, 'edu'), name, type, countryId: country?.id || null, cityId: type === 'online' ? null : rng.pick(civ.cities).id,
      quality, capacity: rng.int(5000, 120000), tuition: type === 'online' ? 0 : Math.round(900 * country.costIndex),
      researchOutput: rng.int(20, 82), endowment: type === 'online' ? 0 : Math.round(country.economy.gdp * .00005),
      fields: rng.picks(EDU_FIELDS, rng.int(5, 10)).map(f => f.id), status: 'open'
    });
  }
  for (const field of EDU_FIELDS) {
    const eligible = civ.education.institutions.filter(i => i.fields.includes(field.id));
    for (const inst of rng.picks(eligible.length ? eligible : civ.education.institutions, Math.min(4, eligible.length || 3))) {
      civ.education.courses.push(makeCourse(civ, field, inst, civ.countries.find(c => c.id === inst.countryId), rng));
    }
    civ.education.certifications.push({ id: nextId(civ, 'cert'), field: field.id, name: field.cert, provider: rng.pick(eligible.length ? eligible : civ.education.institutions).name, cost: Math.round(field.cost * 1.8), status: 'available' });
  }

  // Research labs and history.
  const labOwners = civ._companies.filter(c => ['research', 'software', 'data', 'security', 'infrastructure', 'cloud', 'manufacturing', 'biotech'].includes(c.sector));
  for (const country of civ.countries) {
    for (const inst of civ.education.institutions.filter(i => i.countryId === country.id).slice(0, 2)) {
      civ.research.labs.push(makeLab(civ, `${inst.name} Research Group`, 'university', country.id, rng, inst.id));
    }
  }
  for (const co of labOwners.slice(0, 10)) {
    const country = countryForCompany(civ, co);
    civ.research.labs.push(makeLab(civ, `${co.name} Research`, 'corporate', country?.id || null, rng, co.id));
  }
  civ.research.labs.push(makeLab(civ, 'Independent Field Lab', 'independent', rng.pick(civ.countries).id, rng));
  for (const field of RESEARCH_FIELDS) {
    const discovered = field.discoveries.filter(d => d.tier === 1 && rng.chance(.55));
    for (const template of discovered) {
      const lab = rng.pick(civ.research.labs);
      const discovery = makeDiscovery(civ, field, template, rng, {
        world: game.worldMinutes - rng.int(2, 14) * YEAR,
        labId: lab.id, countryId: lab.countryId, replicated: rng.chance(.7)
      });
      civ.research.discoveries.push(discovery);
      civ.research.fields.find(f => f.id === field.id).discoveries.push(discovery.id);
      civ.research.fields.find(f => f.id === field.id).level = Math.max(1, template.tier + 1);
    }
  }
  for (let i = 0; i < 14; i++) {
    const field = rng.pick(RESEARCH_FIELDS);
    const lab = rng.pick(civ.research.labs);
    const tier = Math.min(3, (civ.research.fields.find(f => f.id === field.id).level || 1));
    civ.research.projects.push(makeProject(civ, field, lab, civ.countries.find(c => c.id === lab.countryId), rng, { tier }));
  }

  // Media.
  for (const seed of MEDIA_SEEDS) civ.media.outlets.push(makeOutlet(civ, seed, rng));
  for (const country of civ.countries) {
    civ.media.publicOpinion[country.id] = {
      government: clamp(country.approval + rng.int(-10, 10), 0, 100),
      technology: rng.int(38, 78), privacy: clamp(country.regulation.privacy + rng.int(-12, 12), 0, 100),
      mediaTrust: rng.int(28, 72), optimism: rng.int(30, 74), polarization: rng.int(20, 76)
    };
  }
  for (let i = 0; i < 24; i++) {
    const outlet = rng.pick(civ.media.outlets);
    civ.media.content.push(makeContent(civ, outlet, rng, { world: game.worldMinutes - rng.int(1, 48) * 60 }));
  }
  civ.media.trends = rng.picks(['infrastructure costs', 'AI regulation', 'privacy', 'semiconductor supply', 'remote work', 'platform accountability', 'open source', 'gaming', 'digital identity', 'energy prices'], 6)
    .map(topic => ({ topic, volume: rng.int(20, 100), sentiment: rng.int(-50, 50), updatedWorld: game.worldMinutes }));

  // Physical infrastructure.
  civ.infrastructure = makeInfrastructure(civ, rng);
  civ.property.listings = makePropertyListings(civ, rng);
  civ.supply = makeSupply(civ, rng);
  for (const seed of TECH_SEEDS) civ.tech.technologies.push(makeTech(civ, seed, rng));
  civ.tech.technologies.sort((a, b) => b.adoption - a.adoption);
  for (const tech of civ.tech.technologies.slice(0, 4)) if (tech.license.includes('open') && tech.adoption > 25) tech.standard = true;

  // Culture.
  for (const seed of CULTURE_SEEDS) civ.culture.organizations.push(makeCulture(civ, seed, rng));
  for (let i = 0; i < 12; i++) {
    const org = rng.pick(civ.culture.organizations);
    const country = civ.countries.find(c => c.id === org.countryId);
    civ.culture.games.push({ id: nextId(civ, 'game'), title: `${rng.pick(['Null', 'Signal', 'Harbor', 'Static', 'Open', 'Quiet', 'Cinder', 'Atlas'])} ${rng.pick(['Drift', 'Circuit', 'Garden', 'Protocol', 'Season', 'Machine', 'Shore', 'Archive'])}`, studioId: org.id, genre: rng.pick(['simulation', 'strategy', 'puzzle', 'narrative', 'sandbox', 'racing']), price: rng.int(0, 40), players: rng.int(200, 900000), rating: rng.float(2.6, 4.9), status: 'released', releasedWorld: game.worldMinutes - rng.int(30, 900) * DAY });
    civ.culture.music.push({ id: nextId(civ, 'music'), title: rng.pick(['Low Orbit', 'Paper Machines', 'Night Bus', 'Signal Lost', 'Quiet Infrastructure', 'Static Bloom']), artist: rng.pick(game.npcs)?.name || 'independent', countryId: country?.id || null, streams: rng.int(1000, 4200000), revenue: rng.int(40, 180000), releasedWorld: game.worldMinutes - rng.int(10, 500) * DAY });
  }
  for (const seed of rng.picks(['open-source', 'privacy', 'gaming', 'local news', 'digital labor', 'retro computing'], 5)) {
    civ.culture.communities.push({ id: nextId(civ, 'comm'), name: `${seed.replace(/\b\w/g, c => c.toUpperCase())} Circle`, topic: seed, members: rng.int(400, 280000), trust: rng.int(30, 90), countryId: rng.pick(civ.countries).id, status: 'active' });
  }
  for (let i = 0; i < 4; i++) civ.culture.esports.push({ id: nextId(civ, 'esport'), name: rng.pick(['Kiyosu Arc League', 'Rhine Simulation Cup', 'Sundar Open', 'Coral Invitational']), game: rng.pick(civ.culture.games).title, teams: rng.int(4, 32), prizePool: rng.int(20000, 2400000), audience: rng.int(12000, 1800000), status: 'active' });
  for (let i = 0; i < 4; i++) civ.culture.events.push({ id: nextId(civ, 'cevent'), name: rng.pick(['Open Bench Summit', 'Harborview Games Week', 'Greyhaven Digital Stage', 'Nordhavn Privacy Forum']), type: rng.pick(['conference', 'festival', 'tournament', 'exhibition']), cityId: rng.pick(civ.cities).id, attendance: rng.int(400, 90000), world: game.worldMinutes + rng.int(2, 120) * DAY, status: 'scheduled' });

  // Identities for every existing person.
  for (const npc of game.npcs || []) civ.identities.push(makeIdentity(game, civ, npc, rng));
  civ.player = {
    id: 'player', kind: 'player', handle: game.player.handle, name: game.player.name,
    countryId: 'novaria', cityId: 'meridian',
    professional: { score: 12, title: 'unproven', employerId: null, endorsements: 0, employmentHistory: [], verified: false },
    social: { score: clamp(game.player.reputation, 0, 100), followers: 0, controversy: 0, communities: ['nullnet'] },
    security: { score: 45, incidents: 0, credentials: [] },
    financial: { score: 35, credit: 620, assets: Math.max(0, game.player.money) },
    academic: { score: 8, publications: 0, citations: 0, field: null },
    credentials: [], published: [], compliance: 82, updatedWorld: game.worldMinutes
  };

  // Historical timeline before the player.
  for (const [year, category, title, body] of HISTORY_SEEDS) {
    civ.timeline.push({ id: nextId(civ, 'hist'), year, world: game.worldMinutes - (2026 - year) * YEAR, category, title, body, actors: [], countryId: null, major: true });
  }
  for (let i = 0; i < 18; i++) {
    const country = rng.pick(civ.countries);
    const year = rng.int(2015, 2025);
    const fields = [['technology', 'A regional standards body updates its procurement rules'], ['economy', 'A mid-sized manufacturer restructures its supply chain'], ['law', 'A court clarifies liability for automated decisions'], ['culture', 'An independent studio finds an unexpected audience'], ['infrastructure', 'A city expands its fibre footprint']];
    const [category, title] = rng.pick(fields);
    civ.timeline.push({ id: nextId(civ, 'hist'), year, world: game.worldMinutes - (2026 - year) * YEAR, category, title, body: `${title} in ${country.name}. The effects were gradual and uneven.`, actors: [country.id], countryId: country.id, major: false });
  }
  civ.timeline.sort((a, b) => a.world - b.world);
  bounded(civ.timeline, CAPS.timeline);

  civ.multiplayer = makeMultiplayer(game, civ);

  // A world already in motion.
  const oldco = (game.companies || []).find(c => c.name === 'OldCo Systems');
  if (oldco) {
    civ.events.push({
      id: nextId(civ, 'event'), category: 'infrastructure', title: 'OldCo migration remains incomplete',
      body: 'The former hosting provider still answers on a small number of addresses. Regulators describe the estate as contained but unresolved.',
      severity: 'moderate', status: 'active', startedWorld: game.worldMinutes - 90 * DAY,
      durationWorld: 365 * DAY, countryId: 'novaria', actors: [oldco.id], effects: { cyberRisk: 4, mediaAttention: 2 },
      headline: 'OldCo estate still partially online', resolved: null
    });
  }
  civ.events.push({
    id: nextId(civ, 'event'), category: 'supply', title: 'Semiconductor allocation remains tight',
    body: 'Packaging capacity is improving, but advanced components are still allocated months ahead.',
    severity: 'moderate', status: 'active', startedWorld: game.worldMinutes - 180 * DAY,
    durationWorld: 240 * DAY, countryId: 'sakura', actors: [], effects: { hardwareIndex: 8, growth: -0.1 },
    headline: 'Chip allocation still constrains hardware', resolved: null
  });

  recomputeMetrics(civ, game);
  game.civ = civ;
  return civ;
}

/* Ensure saved worlds gain the layer without replacing existing state. */
export function ensureCivilization(game) {
  if (!game.civ || typeof game.civ !== 'object' || !Array.isArray(game.civ.countries) || !game.civ.countries.length) {
    game.civ = buildCivilization(game, makeRng((game.seed ^ 0x51c1) >>> 0));
    return game.civ;
  }
  const civ = game.civ;
  civ.version = CIV_VERSION;
  civ.worldMinutes = game.worldMinutes;
  civ._companies = game.companies || [];
  civ._npcIds = [];
  assignCompanyJurisdictions(civ, game, makeRng((game.seed ^ 0x6d21) >>> 0));
  const defaults = {
    countries: [], cities: [], institutions: [], laws: [], courts: [], regulators: [], disputes: [], compliance: [], policies: [],
    identities: [], events: [], timeline: []
  };
  for (const [key, value] of Object.entries(defaults)) if (!Array.isArray(civ[key])) civ[key] = value;
  civ.relations = civ.relations || { treaties: [], sanctions: [], negotiations: [], blocs: [] };
  for (const key of ['treaties', 'sanctions', 'negotiations', 'blocs']) if (!Array.isArray(civ.relations[key])) civ.relations[key] = [];
  civ.education = civ.education || { institutions: [], courses: [], certifications: [], enrollments: [], player: { knowledge: {}, credentials: [], studyHours: 0, enrolled: null } };
  civ.education.player = civ.education.player || { knowledge: {}, credentials: [], studyHours: 0, enrolled: null };
  civ.education.player.knowledge = civ.education.player.knowledge || {};
  civ.education.player.credentials = civ.education.player.credentials || [];
  civ.research = civ.research || { fields: RESEARCH_FIELDS.map(f => ({ id: f.id, name: f.name, code: f.code, level: 1, progress: 0, funding: 0, discoveries: [] })), labs: [], projects: [], discoveries: [] };
  civ.research.fields = civ.research.fields || [];
  civ.media = civ.media || { outlets: [], content: [], publicOpinion: {}, trends: [], playerPublished: [] };
  civ.media.outlets = civ.media.outlets || [];
  civ.media.content = civ.media.content || [];
  civ.media.publicOpinion = civ.media.publicOpinion || {};
  civ.media.trends = civ.media.trends || [];
  civ.infrastructure = civ.infrastructure || { grids: [], fiber: [], dataCenters: [], logistics: [], outages: [] };
  for (const key of ['grids', 'fiber', 'dataCenters', 'logistics', 'outages']) if (!Array.isArray(civ.infrastructure[key])) civ.infrastructure[key] = [];
  civ.property = civ.property || { listings: [], owned: [], market: { index: 100, rentIndex: 100, vacancy: 7, lastUpdateWorld: game.worldMinutes } };
  civ.property.listings = civ.property.listings || [];
  civ.property.owned = civ.property.owned || [];
  civ.supply = civ.supply || { materials: {}, components: {}, factories: [], warehouses: [], shipments: [], hardwareIndex: 100, energyIndex: 100, lastProductionWorld: game.worldMinutes };
  civ.tech = civ.tech || { technologies: [], standards: [], lastReleaseWorld: game.worldMinutes };
  civ.tech.technologies = civ.tech.technologies || [];
  civ.culture = civ.culture || { organizations: [], games: [], music: [], communities: [], esports: [], events: [] };
  for (const key of ['organizations', 'games', 'music', 'communities', 'esports', 'events']) if (!Array.isArray(civ.culture[key])) civ.culture[key] = [];
  civ.player = civ.player || {
    id: 'player', kind: 'player', handle: game.player.handle, name: game.player.name, countryId: 'novaria', cityId: 'meridian',
    professional: { score: 12, title: 'unproven', employerId: null, endorsements: 0, employmentHistory: [], verified: false },
    social: { score: 0, followers: 0, controversy: 0, communities: ['nullnet'] },
    security: { score: 45, incidents: 0, credentials: [] }, financial: { score: 35, credit: 620, assets: 0 },
    academic: { score: 8, publications: 0, citations: 0, field: null }, credentials: [], published: [], compliance: 82, updatedWorld: game.worldMinutes
  };
  civ.player.compliance = typeof civ.player.compliance === 'number' ? civ.player.compliance : 82;
  civ.player.credentials = civ.player.credentials || [];
  civ.player.published = civ.player.published || [];
  civ.cadence = civ.cadence || {};
  for (const key of ['continuous', 'politics', 'economy', 'supply', 'media', 'research', 'events', 'history', 'property', 'education', 'infrastructure']) if (typeof civ.cadence[key] !== 'number') civ.cadence[key] = Math.floor((game.worldMinutes || 0) / (key === 'continuous' ? 30 : key === 'media' || key === 'research' ? 360 : DAY));
  civ.seq = civ.seq || {};
  for (const key of ['law', 'inst', 'course', 'disc', 'proj', 'lab', 'outlet', 'content', 'grid', 'fiber', 'dc', 'logi', 'prop', 'factory', 'warehouse', 'ship', 'tech', 'culture', 'game', 'music', 'comm', 'esport', 'cevent', 'event', 'hist', 'policy', 'treaty', 'dispute', 'ledger', 'player']) if (typeof civ.seq[key] !== 'number') civ.seq[key] = 1;
  const knownIdentities = new Set(civ.identities.map(i => i.id));
  for (const npc of game.npcs || []) {
    if (knownIdentities.has(npc.id)) continue;
    civ.identities.push(makeIdentity(game, civ, npc, makeRng((game.seed ^ hash32(npc.id)) >>> 0)));
  }
  for (const server of game.servers || []) {
    if (typeof server.latency !== 'number') server.latency = 6 + (hash32(server.id) % 54);
    if (!server.civStatus) server.civStatus = 'nominal';
  }
  civ.player.countryId = civ.countries.some(c => c.id === civ.player.countryId) ? civ.player.countryId : 'novaria';
  civ.player.cityId = civ.cities.some(c => c.id === civ.player.cityId) ? civ.player.cityId : 'meridian';
  civ.multiplayer = civ.multiplayer || makeMultiplayer(game, civ);
  civ.multiplayer.players = civ.multiplayer.players || [];
  civ.multiplayer.ledger = civ.multiplayer.ledger || [];
  civ.multiplayer.antiCheat = civ.multiplayer.antiCheat || { rejected: 0, flagged: [], rate: {}, lastAuditWorld: game.worldMinutes };
  recomputeMetrics(civ, game);
  return civ;
}

/* ============================================================
   MULTIPLAYER / AUTHORITY SKELETON
   ============================================================ */
/* ============================================================
   TICK: BOUNDED EVENT-DRIVEN SIMULATION
   ============================================================ */
function advanceBucket(civ, key, interval, world, max = 8) {
  const bucket = Math.floor(world / interval);
  const prev = civ.cadence[key] || 0;
  if (bucket <= prev) return 0;
  const steps = Math.min(max, bucket - prev);
  civ.cadence[key] = prev + steps;
  return steps;
}

function worldYear(civ) { return 2026 + Math.floor(((civ.worldMinutes || 0) - 552) / YEAR); }

function trimCiv(civ) {
  bounded(civ.laws, CAPS.laws);
  bounded(civ.institutions, CAPS.courts + CAPS.regulators);
  bounded(civ.courts, CAPS.courts);
  bounded(civ.regulators, CAPS.regulators);
  bounded(civ.disputes, CAPS.disputes);
  bounded(civ.compliance, CAPS.disputes);
  bounded(civ.policies, CAPS.policies);
  bounded(civ.relations.treaties, CAPS.treaties);
  bounded(civ.relations.sanctions, CAPS.sanctions);
  bounded(civ.research.projects, CAPS.projects);
  bounded(civ.research.discoveries, CAPS.discoveries);
  bounded(civ.education.courses, 80);
  bounded(civ.education.enrollments, 120);
  bounded(civ.media.outlets, CAPS.outlets);
  bounded(civ.media.content, CAPS.content);
  bounded(civ.infrastructure.outages, CAPS.outages);
  bounded(civ.property.listings, CAPS.listings);
  bounded(civ.property.owned, CAPS.owned);
  bounded(civ.supply.factories, CAPS.factories);
  bounded(civ.supply.warehouses, CAPS.warehouses);
  bounded(civ.supply.shipments, CAPS.shipments);
  bounded(civ.tech.technologies, CAPS.tech);
  bounded(civ.culture.games, CAPS.games);
  bounded(civ.culture.music, CAPS.music);
  bounded(civ.culture.communities, CAPS.communities);
  bounded(civ.culture.esports, CAPS.esports);
  bounded(civ.culture.events, CAPS.cultureEvents);
  bounded(civ.events, CAPS.events);
  bounded(civ.timeline, CAPS.timeline);
  bounded(civ.multiplayer.ledger, CAPS.ledger);
  bounded(civ.identities, CAPS.identities);
}

function recordTimeline(civ, category, title, body, opts = {}) {
  const entry = {
    id: nextId(civ, 'hist'), year: worldYear(civ), world: civ.worldMinutes,
    category, title, body, actors: opts.actors || [], countryId: opts.countryId || null,
    major: !!opts.major
  };
  civ.timeline.push(entry);
  bounded(civ.timeline, CAPS.timeline);
  return entry;
}

function emit(events, type, text, extra = {}) { events.push({ type, text, ...extra }); }

function activeEffects(civ, key) {
  let total = 0;
  for (const e of civ.events) {
    if (e.status !== 'active') continue;
    const value = e.effects?.[key];
    if (typeof value === 'number') total += value;
  }
  return total;
}

/* -------- continuous drift (30-minute cadence) -------- */
function advanceContinuous(game, civ, minutes, rng, events) {
  const hours = minutes / 60;
  const years = hours / (24 * 365);
  const growthShock = activeEffects(civ, 'growth');
  const riskShock = activeEffects(civ, 'cyberRisk');
  const energyShock = activeEffects(civ, 'energy');

  for (const country of civ.countries) {
    const e = country.economy;
    const cycle = (rng.next() - .5) * .18 + growthShock * .01;
    e.growth = clamp(e.growth + cycle * Math.min(1, hours / 24), -5, 9);
    e.inflation = clamp(e.inflation + (rng.next() - .5) * .08 * Math.min(3, hours / 24), -1, 18);
    e.unemployment = clamp(e.unemployment + (rng.next() - .5) * .04 * Math.min(3, hours / 24), 1.2, 24);
    e.gdp = Math.max(1e9, e.gdp * (1 + e.growth / 100 * years));
    country.population = Math.max(100000, Math.round(country.population * (1 + e.growth / 500 * years)));
    e.debt = clamp(e.debt + (rng.next() - .45) * .12 * Math.min(2, hours / 24), 8, 260);
    e.reserves = Math.max(0, e.reserves + e.gdp * (e.growth / 100) * years * .04);
    country.stability = clamp(country.stability + (rng.next() - .5) * .16 * Math.min(2, hours / 24) - country.unrest * .0006 * hours / 24, 10, 98);
    country.unrest = clamp(country.unrest + (100 - country.stability) * .0008 * hours / 24 - e.growth * .002 * hours / 24, 0, 100);
    country.approval = clamp(country.approval + (e.growth - e.inflation - e.unemployment * .5) * .006 * Math.min(4, hours / 24) + (rng.next() - .5) * .08, 5, 96);
    country.internetFreedom = clamp(100 - country.internet.censorship * 1.25 + country.regulation.privacy * .22 - riskShock * .3, 0, 100);
    country.internet.penetration = clamp(country.internet.penetration + (rng.next() - .35) * .02 * Math.min(2, hours / 24), 8, 99.5);
    country.internet.speed = Math.max(8, country.internet.speed * (1 + (rng.next() - .48) * .0007 * Math.min(3, hours / 24)));
  }

  for (const city of civ.cities) {
    const country = civ.countries.find(c => c.id === city.countryId);
    city.utilities.power = clamp(city.utilities.power + (rng.next() - .5) * .05 * Math.min(3, hours / 24) - energyShock * .02, 12, 99);
    city.utilities.telecom = clamp(city.utilities.telecom + (rng.next() - .5) * .04 * Math.min(3, hours / 24), 10, 99);
    city.utilities.transport = clamp(city.utilities.transport + (rng.next() - .5) * .04 * Math.min(3, hours / 24), 10, 99);
    city.conditions.congestion = clamp(city.conditions.congestion + (rng.next() - .5) * .08 * Math.min(3, hours / 24), 1, 100);
    city.prices.housing = Math.max(80, Math.round(city.prices.housing * (1 + (country.economy.growth - country.economy.inflation) / 100 * years)));
    city.prices.energy = Math.max(4, city.prices.energy * (1 + (energyShock * .002 + (rng.next() - .48) * .002) * Math.min(4, hours / 24)));
    city.prices.bandwidth = Math.max(2, city.prices.bandwidth * (1 - .0004 * Math.min(4, hours / 24)));
  }

  for (const grid of civ.infrastructure.grids) {
    grid.load = clamp(grid.load + (rng.next() - .5) * .1 * Math.min(3, hours / 24) + energyShock * .02, 5, 100);
    grid.reliability = clamp(grid.reliability + (rng.next() - .5) * .04 * Math.min(2, hours / 24), 10, 99.8);
  }
  for (const fiber of civ.infrastructure.fiber) {
    fiber.utilization = clamp(fiber.utilization + (rng.next() - .46) * .08 * Math.min(3, hours / 24), 1, 100);
    fiber.latency = clamp(fiber.latency + (rng.next() - .5) * .02 * Math.min(3, hours / 24), 2, 220);
  }
  for (const dc of civ.infrastructure.dataCenters) {
    dc.utilization = clamp(dc.utilization + (rng.next() - .5) * .12 * Math.min(3, hours / 24), 1, 99);
    dc.power = clamp(dc.power + (rng.next() - .5) * .06 * Math.min(3, hours / 24), 5, 100);
    dc.status = dc.utilization > 97 ? 'constrained' : 'operational';
  }
  for (const hub of civ.infrastructure.logistics) {
    hub.congestion = clamp(hub.congestion + (rng.next() - .5) * .1 * Math.min(3, hours / 24), 0, 100);
  }

  // Research progresses on elapsed time, bounded by funding and equipment.
  for (const project of civ.research.projects) {
    if (project.status !== 'active') continue;
    const rate = clamp((project.expertise + project.equipment) / 2 - project.difficulty * .55, 2, 70);
    const funding = clamp(project.funding / Math.max(1, project.fundingNeeded) * 1.8, .15, 1.4);
    project.progress = clamp(project.progress + rate * funding * hours / 220, 0, 100);
  }

  // Media reach and public attention move continuously, then settle.
  for (const item of civ.media.content) {
    if (item.status !== 'published') continue;
    item.reach = Math.round(item.reach * (1 + (rng.next() - .48) * .0009 * Math.min(6, hours / 6)));
  }
  for (const outlet of civ.media.outlets) {
    outlet.trust = clamp(outlet.trust + (rng.next() - .5) * .02 * Math.min(4, hours / 12), 3, 98);
    outlet.reach = Math.round(outlet.reach * (1 + (rng.next() - .49) * .0006 * Math.min(6, hours / 6)));
  }
  for (const opinion of Object.values(civ.media.publicOpinion)) {
    opinion.government = clamp(opinion.government + (rng.next() - .5) * .05, 0, 100);
    opinion.technology = clamp(opinion.technology + (rng.next() - .5) * .04, 0, 100);
    opinion.privacy = clamp(opinion.privacy + (rng.next() - .5) * .04, 0, 100);
    opinion.mediaTrust = clamp(opinion.mediaTrust + (rng.next() - .5) * .04, 0, 100);
    opinion.polarization = clamp(opinion.polarization + (rng.next() - .49) * .04, 0, 100);
  }

  // Property market and supply prices.
  const property = civ.property.market;
  property.index = clamp(property.index * (1 + (rng.next() - .48) * .0007 * Math.min(4, hours / 12)), 55, 210);
  property.rentIndex = clamp(property.rentIndex + (rng.next() - .5) * .05 * Math.min(4, hours / 12), 45, 230);
  property.vacancy = clamp(property.vacancy + (rng.next() - .5) * .02, 1, 28);

  for (const material of Object.values(civ.supply.materials)) {
    material.availability = clamp(material.availability + (rng.next() - .48) * .08 * Math.min(4, hours / 12), 3, 100);
    material.demand = clamp(material.demand + (rng.next() - .5) * .06, 1, 100);
    material.price = Math.max(1, material.price + (material.base - material.price) * .002 * Math.min(4, hours / 12) + (material.demand - material.availability) * material.base * .00008);
  }
  for (const component of Object.values(civ.supply.components)) {
    component.availability = clamp(component.availability + (rng.next() - .47) * .07 * Math.min(4, hours / 12), 2, 100);
    component.demand = clamp(component.demand + (rng.next() - .5) * .05, 1, 100);
    const inputCost = (component.inputs || []).reduce((sum, id) => sum + (civ.supply.materials[id]?.price || 0), 0);
    const scarcity = 1 + (100 - component.availability) / 100 * .9;
    component.price = Math.max(1, Math.round((inputCost * component.costShare * 4 + 12) * scarcity));
  }
  civ.supply.hardwareIndex = Math.round(Object.values(civ.supply.components).reduce((s, c) => s + c.price, 0) / 9);
  civ.supply.energyIndex = Math.round((civ.supply.materials.energy?.price || 88) / 88 * 100);

  for (const tech of civ.tech.technologies) {
    if (tech.status !== 'active') continue;
    const pull = (tech.ecosystem + tech.documentation + tech.security) / 3;
    tech.adoption = clamp(tech.adoption + (pull - tech.adoption) * .00018 * Math.min(8, hours / 6), 0, 100);
    if (tech.adoption > 58 && tech.license.includes('open') && !tech.standard) {
      tech.standard = true;
      recordTimeline(civ, 'technology', `${tech.name} becomes a de facto standard`, `${tech.name} reaches broad adoption and is treated as a compatibility baseline.`, { actors: [tech.vendorName] });
    }
  }

  for (const org of civ.culture.organizations) {
    org.audience = Math.max(0, Math.round(org.audience * (1 + (rng.next() - .49) * .0005 * Math.min(6, hours / 6))));
    org.revenue = Math.max(0, Math.round(org.revenue * (1 + (rng.next() - .5) * .0008 * Math.min(6, hours / 6))));
  }

  // Contextual identity evolves slowly; it is not a single global score.
  for (const identity of civ.identities) {
    identity.professional.score = clamp(identity.professional.score + (rng.next() - .5) * .02, 0, 100);
    identity.social.score = clamp(identity.social.score + (rng.next() - .5) * .025, 0, 100);
    identity.security.score = clamp(identity.security.score + (rng.next() - .5) * .012, 0, 100);
    identity.financial.score = clamp(identity.financial.score + (rng.next() - .5) * .012, 0, 100);
  }
  civ.player.social.score = clamp((game.player.reputation || 0) * .7 + civ.player.social.followers / 5000, 0, 100);
}

/* -------- daily economy and company propagation -------- */
function dailyEconomy(game, civ, rng, events) {
  const playerCountry = civ.countries.find(c => c.id === civ.player.countryId) || civ.countries[0];
  for (const country of civ.countries) {
    const e = country.economy;
    const taxRevenue = e.gdp * (e.tax.corp + e.tax.income + e.tax.vat) / 100 * .21 / 365;
    e.budget = Math.max(0, e.budget + taxRevenue * .82 - e.gdp * .00022);
    e.debt = clamp(e.debt + (e.budget < e.gdp * .02 ? .004 : -.002), 5, 280);
    country.approval = clamp(country.approval + (e.growth - e.inflation) * .04 - (e.unemployment - 5) * .025 + (rng.next() - .5) * .4, 2, 97);
    country.stability = clamp(country.stability + (country.approval - 50) * .008 - country.unrest * .004 + (rng.next() - .5) * .3, 10, 98);
    country.unrest = clamp(country.unrest + (45 - country.approval) * .012 + (100 - country.stability) * .006 - e.growth * .02, 0, 100);
    country.internetFreedom = clamp(100 - country.internet.censorship * 1.25 + country.regulation.privacy * .22, 0, 100);
  }

  // Sector demand responds to connectivity, regulation and the business cycle.
  const companies = game.companies || [];
  for (const co of companies) {
    const country = civ.countries.find(c => c.id === co.hqCountryId) || playerCountry;
    const sector = String(co.sector || '').toLowerCase();
    const digital = ['software', 'cloud', 'hosting', 'data', 'security', 'media', 'consulting', 'finance', 'commerce', 'design'].includes(sector);
    const connectivity = country.internet.penetration / 100;
    const regulatoryDrag = (country.regulation.data + country.regulation.business) / 200;
    const cycle = country.economy.growth - country.economy.inflation * .35;
    co.civDemand = clamp((digital ? connectivity * 1.2 : .85) + cycle * .02 - regulatoryDrag * .06, .35, 1.6);
    if (co.ownerType !== 'player' && rng.chance(.06)) {
      const delta = Math.round(co.revenue * (co.civDemand - 1) * .04);
      if (delta) co.funds += delta;
    }
    for (const id of co.products || []) {
      const product = game.products.find(p => p.id === id);
      if (!product) continue;
      const techBoost = 1 + (civ.metrics?.technologyAdoption || 40) / 500;
      product.growth = clamp((product.growth || 0) + (co.civDemand - 1) * .0008 * techBoost, -.02, .03);
      if (rng.chance(.025)) product.price = Math.max(1, Math.round(product.price * (1 + (country.economy.inflation / 100) * .08)));
    }
  }

  // Corporate tax and compliance for the player's company.
  const playerCompany = companies.find(c => c.ownerType === 'player');
  if (playerCompany) {
    const country = civ.countries.find(c => c.id === playerCompany.hqCountryId) || playerCountry;
    const tax = Math.max(0, Math.round((playerCompany.revenue || 0) * country.tax.corp / 100 / 30));
    if (tax > 0) {
      playerCompany.funds -= tax;
      playerCompany.taxPaid = (playerCompany.taxPaid || 0) + tax;
      if (playerCompany.funds < 0) playerCompany.funds = 0;
      game.player.transactions.unshift({ time: Date.now(), amount: -tax, memo: `corporate tax · ${country.name}`, balance: game.player.money });
      if (game.player.transactions.length > 120) game.player.transactions.length = 120;
      if (rng.chance(.04)) emit(events, 'feed', `Corporate tax of ${fmtMoney(tax)} assessed in ${country.name}.`, { kind: 'info' });
    }
    const complianceChance = country.regulation.data / 100 * .006 + country.regulation.privacy / 100 * .004;
    if (rng.chance(complianceChance) && (playerCompany.revenue > 0 || game.stats.sites > 0)) {
      const issue = rng.pick(['data retention evidence', 'license disclosure', 'breach notification timing', 'consumer renewal terms']);
      civ.player.compliance = clamp(civ.player.compliance - rng.int(4, 14), 0, 100);
      civ.compliance.push({ id: nextId(civ, 'comp'), countryId: country.id, subject: 'player-company', issue, status: civ.player.compliance < 45 ? 'escalated' : 'warning', world: civ.worldMinutes, fine: 0 });
      if (civ.player.compliance < 45) {
        const fine = Math.max(80, Math.round((country.regulation.data + country.regulation.privacy) * 1.8 + rng.int(40, 320)));
        game.player.money = Math.max(0, game.player.money - fine);
        game.stats.spent += fine;
        game.player.transactions.unshift({ time: Date.now(), amount: -fine, memo: `compliance fine · ${country.name}`, balance: game.player.money });
        civ.compliance[civ.compliance.length - 1].fine = fine;
        civ.compliance[civ.compliance.length - 1].status = 'fined';
        pushMail(game, 'notice', 'Regulatory compliance notice', `A ${country.name} review found unresolved issues with ${issue}.\n\nFine: ${fmtMoney(fine)}\nAuthority: ${country.name} ${LAW_DOMAINS.find(d => d.id === 'data')?.regulator || 'Data Governance Office'}\n\nThis notice is recorded in your compliance history. Corrective evidence may reduce future penalties.`);
        emit(events, 'feed', `Compliance fine in ${country.name}: ${fmtMoney(fine)} (${issue}).`, { kind: 'bad' });
        recordTimeline(civ, 'law', `Compliance action against operator in ${country.name}`, `A regulator resolved a ${issue} case with a ${fmtMoney(fine)} penalty.`, { countryId: country.id, major: false });
      }
    }
  }

  // Market and currency pressure flow into the existing market index.
  const avgGrowth = civ.countries.reduce((s, c) => s + c.economy.growth, 0) / civ.countries.length;
  const avgStability = civ.countries.reduce((s, c) => s + c.stability, 0) / civ.countries.length;
  civ.metrics.marketBias = clamp((avgGrowth - 2) * .00012 + (avgStability - 60) * .000004 + activeEffects(civ, 'growth') * .0002, -.0025, .0025);
  game.market.index = clamp(game.market.index * (1 + civ.metrics.marketBias), 620, 1680);
}

/* -------- politics, regulation, diplomacy -------- */
function dailyPolitics(game, civ, rng, events) {
  // Policy proposals become law after their effective date.
  for (const policy of civ.policies) {
    if (policy.status !== 'proposed' || civ.worldMinutes < policy.effectiveWorld) continue;
    const country = civ.countries.find(c => c.id === policy.countryId);
    if (!country) { policy.status = 'withdrawn'; continue; }
    const passChance = clamp(.32 + policy.support / 180 + country.stability / 300, .12, .92);
    if (rng.chance(passChance)) {
      policy.status = 'enacted';
      country.regulation[policy.domain] = clamp((country.regulation[policy.domain] || 50) + rng.int(3, 10), 0, 100);
      const domain = LAW_DOMAINS.find(d => d.id === policy.domain);
      if (domain) civ.laws.push(makeLaw(civ, country, domain, rng, 'active'));
      country.approval = clamp(country.approval + rng.int(-2, 3), 0, 100);
      recordTimeline(civ, 'law', `${country.name} enacts ${policy.name}`, `The measure takes effect after a ${policy.support}% support vote. Regulated organizations have a compliance window.`, { countryId: country.id, actors: [country.id], major: true });
      emit(events, 'news', `${country.name} enacts ${policy.name}`, { body: 'The new framework changes compliance obligations for digital services and data handling.', source: 'Public Record' });
    } else {
      policy.status = 'withdrawn';
      recordTimeline(civ, 'law', `${policy.name} fails in ${country.name}`, 'The proposal did not secure enough support and was withdrawn.', { countryId: country.id });
    }
  }
  if (civ.policies.filter(p => p.status === 'proposed').length < 4 && rng.chance(.22)) {
    const country = rng.pick(civ.countries);
    const domain = rng.pick(LAW_DOMAINS);
    const support = clamp(country.approval + rng.int(-25, 25), 8, 92);
    civ.policies.push({
      id: nextId(civ, 'policy'), countryId: country.id, domain: domain.id,
      name: `${rng.pick(['Digital Accountability', 'Fair Access', 'Data Stewardship', 'Open Procurement', 'Platform Transparency'])} Act`,
      status: 'proposed', support, introducedWorld: civ.worldMinutes,
      effectiveWorld: civ.worldMinutes + rng.int(20, 140) * DAY, effect: rng.pick(['tighten', 'clarify', 'liberalize'])
    });
  }

  // Elections and coalition change.
  for (const country of civ.countries) {
    if (civ.worldMinutes < country.nextElection) continue;
    const oldParty = country.rulingParty;
    const shift = rng.int(-18, 18);
    country.approval = clamp(country.approval + shift, 8, 88);
    country.rulingParty = rng.pick(country.parties.filter(p => p !== oldParty)) || oldParty;
    country.leader = randomLeaderName(game, rng);
    country.stability = clamp(country.stability + rng.int(-5, 6), 15, 96);
    country.nextElection = civ.worldMinutes + rng.int(3, 5) * YEAR;
    const domain = rng.pick(LAW_DOMAINS);
    country.regulation[domain.id] = clamp((country.regulation[domain.id] || 50) + rng.int(-8, 10), 0, 100);
    recordTimeline(civ, 'politics', `${country.name} elects a new government`, `${country.rulingParty} takes office. The previous coalition's digital agenda is revised, with immediate changes to ${domain.name.toLowerCase()} policy.`, { countryId: country.id, actors: [country.id], major: true });
    emit(events, 'news', `${country.name} election shifts digital policy`, { body: `${country.rulingParty} forms a government after a close contest. Regulators expect revised priorities.`, source: 'Greyhaven Record' });
  }

  // International relations drift and agreements.
  for (const a of civ.countries) {
    for (const b of civ.countries) {
      if (a.id === b.id) continue;
      const rel = a.relations[b.id];
      if (!rel) continue;
      rel.trade = clamp(rel.trade + (rng.next() - .5) * .8, 0, 100);
      rel.tension = clamp(rel.tension + (rng.next() - .51) * .7 + (rel.sanctioned ? .4 : 0), 0, 100);
      rel.trust = clamp(rel.trust + (rel.trade - rel.tension) * .004 + (rng.next() - .5) * .5, 0, 100);
      rel.stance = rel.tension > 65 ? 'hostile' : rel.tension > 45 ? 'cautious' : rel.trade > 62 && rel.trust > 58 ? 'cooperative' : rel.trade < 28 ? 'distant' : 'neutral';
    }
  }
  if (rng.chance(.18)) {
    const a = rng.pick(civ.countries);
    const b = rng.pick(civ.countries.filter(c => c.id !== a.id));
    const rel = a.relations[b.id];
    if (rel && rel.tension > 52 && !rel.sanctioned && rng.chance(.35)) {
      rel.sanctioned = true;
      civ.relations.sanctions.push({ id: nextId(civ, 'sanction'), a: a.id, b: b.id, scope: rng.pick(['advanced components', 'financial services', 'cloud infrastructure']), startedWorld: civ.worldMinutes, status: 'active' });
      a.economy.growth = clamp(a.economy.growth - .3, -5, 9);
      b.economy.growth = clamp(b.economy.growth - .35, -5, 9);
      recordTimeline(civ, 'geopolitics', `${a.name} imposes restrictions on ${b.name}`, `Export controls cover ${civ.relations.sanctions[civ.relations.sanctions.length - 1].scope}. Firms begin rerouting supply and contracts.`, { countryId: a.id, actors: [a.id, b.id], major: true });
      emit(events, 'news', `${a.name} announces trade restrictions on ${b.name}`, { body: 'The measures target advanced technology exports and require new licenses for affected transactions.', source: 'Meridian Business Daily' });
    } else if (rel && rel.tension < 30 && !rel.treaty && rng.chance(.3)) {
      rel.treaty = true;
      civ.relations.treaties.push({ id: nextId(civ, 'treaty'), a: a.id, b: b.id, name: rng.pick(['Cross-border Data Accord', 'Mutual Incident Notification Pact', 'Technology Trade Framework']), signedWorld: civ.worldMinutes, status: 'active', compliance: rng.int(45, 88) });
      rel.trade = clamp(rel.trade + 7, 0, 100);
      recordTimeline(civ, 'geopolitics', `${a.name} and ${b.name} sign a digital accord`, 'The agreement lowers barriers for cross-border services and establishes incident notification channels.', { countryId: a.id, actors: [a.id, b.id], major: true });
    }
  }
}

function randomLeaderName(game, rng) {
  const npcs = game.npcs || [];
  if (!npcs.length) return 'Interim Council';
  const n = rng.pick(npcs);
  return n.name;
}

/* -------- supply chains -------- */
function dailySupply(game, civ, rng, events) {
  const supply = civ.supply;
  const shortage = activeEffects(civ, 'hardwareIndex');
  for (const factory of supply.factories) {
    const component = supply.components[factory.output];
    if (!component) continue;
    const materialAvailability = (component.inputs || []).reduce((s, id) => Math.min(s, supply.materials[id]?.availability || 60), 100);
    const power = civ.cities.find(c => c.id === factory.cityId)?.utilities.power || 70;
    const effective = clamp((materialAvailability * .5 + power * .3 + factory.efficiency * .2) - shortage * .2, 5, 100);
    factory.utilization = clamp(factory.utilization + (effective - factory.utilization) * .05, 5, 100);
    const output = Math.max(0, Math.round(factory.capacity * factory.utilization / 100 * .02));
    component.stock = Math.min(100000, (component.stock || 0) + output);
    component.availability = clamp(component.availability + output / 260 - component.demand / 180, 2, 100);
    if (rng.chance(.015)) {
      factory.status = rng.chance(.7) ? 'maintenance' : 'operating';
      if (factory.status === 'maintenance') emit(events, 'feed', `${factory.companyName} pauses ${factory.output} production for maintenance.`, { kind: 'warn' });
    } else factory.status = 'operating';
  }

  // Shipments physically move between warehouses.
  for (const shipment of supply.shipments) {
    if (shipment.status === 'delivered') continue;
    const progress = clamp((civ.worldMinutes - shipment.departedWorld) / Math.max(1, shipment.etaWorld - shipment.departedWorld), 0, 1);
    if (progress >= 1) {
      shipment.status = 'delivered';
      const destination = supply.warehouses.find(w => w.id === shipment.toId);
      if (destination) {
        destination.inventory = Math.min(destination.capacity * 2, destination.inventory + shipment.quantity);
        const component = supply.components[shipment.cargo];
        if (component) component.stock += shipment.quantity;
      }
      emit(events, 'feed', `Shipment of ${shipment.cargo} reached ${destination?.name || 'its destination'}.`, { kind: 'info' });
    } else if (rng.chance(.008)) {
      shipment.status = 'delayed';
      shipment.delayHours += rng.int(2, 16);
      shipment.etaWorld += rng.int(2, 16) * 60;
    }
  }
  if (supply.shipments.filter(s => s.status !== 'delivered').length < 6 && rng.chance(.18)) {
    const from = rng.pick(supply.warehouses), to = rng.pick(supply.warehouses.filter(w => w.id !== from?.id)) || from;
    if (from && to) supply.shipments.push({ id: nextId(civ, 'ship'), fromId: from.id, toId: to.id, cargo: rng.pick(Object.keys(supply.components)), quantity: rng.int(20, 300), departedWorld: civ.worldMinutes, etaWorld: civ.worldMinutes + rng.int(8, 96) * 60, status: 'in-transit', delayHours: 0 });
  }
  for (const warehouse of supply.warehouses) {
    warehouse.utilization = clamp(warehouse.inventory / Math.max(1, warehouse.capacity) * 100, 0, 100);
    warehouse.status = warehouse.utilization > 94 ? 'constrained' : 'operational';
  }
  const avgAvailability = Object.values(supply.components).reduce((s, c) => s + c.availability, 0) / Math.max(1, Object.keys(supply.components).length);
  if (avgAvailability < 38 && rng.chance(.035)) {
    spawnWorldEvent(game, civ, rng, 'semiconductor-shortage', events, { force: true });
  }
}

/* -------- media, information and public opinion -------- */
function mediaCadence(game, civ, rng, events) {
  const count = 1 + (rng.chance(.35) ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const outlet = pickWeighted(rng, civ.media.outlets, o => o.audience / 1000 + o.trust);
    if (!outlet) continue;
    const topic = rng.pick(['infrastructure', 'security', 'markets', 'labor', 'policy', 'science', 'culture', 'games', 'privacy', 'supply']);
    const item = makeContent(civ, outlet, rng, { topic });
    civ.media.content.push(item);
    const opinion = civ.media.publicOpinion[outlet.countryId];
    if (opinion) {
      opinion.mediaTrust = clamp(opinion.mediaTrust + item.trustDelta * .2, 0, 100);
      if (topic === 'privacy') opinion.privacy = clamp(opinion.privacy + item.sentiment * .01, 0, 100);
      if (topic === 'science' || topic === 'games') opinion.technology = clamp(opinion.technology + item.sentiment * .008, 0, 100);
    }
    outlet.reach = Math.round(outlet.reach + item.reach * .015);
    if (rng.chance(.035 + outlet.bias / 600)) {
      item.corrections++;
      outlet.corrections++;
      outlet.trust = clamp(outlet.trust - rng.int(1, 4), 0, 100);
      recordTimeline(civ, 'media', `${outlet.name} issues a correction`, `A report on ${topic} was corrected after an internal review. The outlet says the underlying story remains partly supported.`, { actors: [outlet.id], major: false });
    }
    if (rng.chance(.02) && outlet.trust > 55 && topic === 'security') {
      const subject = rng.pick(game.companies || []);
      if (subject) {
        subject.rep = clamp((subject.rep || 50) - rng.int(1, 4), 0, 100);
        emit(events, 'feed', `${outlet.name} publishes an investigation into ${subject.name}.`, { kind: 'news' });
      }
    }
  }
  // Player-published work continues to find an audience.
  for (const pub of civ.media.playerPublished) {
    if (pub.status !== 'published') continue;
    pub.reach = Math.round(pub.reach * (1 + rng.float(.002, .02)));
    pub.revenue += Math.round(pub.reach * .00008);
    civ.player.social.followers += Math.round(pub.reach * .0004);
  }
  for (const trend of civ.media.trends) {
    trend.volume = clamp(trend.volume + rng.int(-3, 4), 0, 100);
    trend.sentiment = clamp(trend.sentiment + rng.int(-2, 2), -100, 100);
    trend.updatedWorld = civ.worldMinutes;
  }
  civ.media.trends.sort((a, b) => b.volume - a.volume);
  bounded(civ.media.content, CAPS.content);
}

/* -------- research completion and new projects -------- */
function researchCadence(game, civ, rng, events) {
  for (const project of [...civ.research.projects]) {
    if (project.status !== 'active') continue;
    if (project.progress < 100 && civ.worldMinutes < project.etaWorld) continue;
    if (project.progress < 55) {
      project.status = rng.chance(.6) ? 'stalled' : 'active';
      if (project.status === 'stalled') {
        project.notes.push(`Progress stalled at ${Math.round(project.progress)}% after funding and equipment constraints.`);
        emit(events, 'feed', `${project.labName} pauses ${project.fieldName} work.`, { kind: 'warn' });
      }
      continue;
    }
    const fieldDef = RESEARCH_FIELDS.find(f => f.id === project.field);
    const already = new Set(civ.research.discoveries.filter(d => d.field === project.field).map(d => d.name));
    const template = fieldDef?.discoveries.find(d => d.tier === project.tier && !already.has(d.name));
    if (!template) {
      project.status = 'completed';
      continue;
    }
    const lab = civ.research.labs.find(l => l.id === project.labId);
    const country = civ.countries.find(c => c.id === project.countryId);
    const discovery = makeDiscovery(civ, fieldDef, template, rng, {
      world: civ.worldMinutes, labId: project.labId, leadNpcId: project.leadNpcId,
      countryId: project.countryId, replicated: rng.chance(.55)
    });
    civ.research.discoveries.push(discovery);
    project.status = 'completed';
    project.discoveryId = discovery.id;
    project.progress = 100;
    const field = civ.research.fields.find(f => f.id === project.field);
    if (field) {
      field.level = Math.max(field.level || 1, template.tier + 1);
      field.discoveries.push(discovery.id);
      field.progress = Math.min(100, (field.progress || 0) + 12);
    }
    if (lab) {
      lab.reputation = clamp(lab.reputation + rng.int(2, 9), 0, 100);
      lab.funding += rng.int(20000, 180000);
    }
    recordTimeline(civ, 'research', `${discovery.name} published`, discovery.summary, { countryId: project.countryId, actors: [project.labId], major: template.tier >= 2 });
    emit(events, 'news', `${project.labName} publishes ${discovery.name}`, { body: discovery.summary, source: 'The Standards Desk' });
    applyDiscovery(game, civ, discovery, rng, events);
    bounded(civ.research.discoveries, CAPS.discoveries);
  }

  // Labs start new work when capacity allows and funding exists.
  const active = civ.research.projects.filter(p => p.status === 'active').length;
  if (active < 10 && rng.chance(.45)) {
    const lab = rng.pick(civ.research.labs);
    if (lab) {
      const fieldId = rng.pick(lab.specialties.length ? lab.specialties : RESEARCH_FIELDS.map(f => f.id));
      const field = RESEARCH_FIELDS.find(f => f.id === fieldId);
      const fieldState = civ.research.fields.find(f => f.id === fieldId);
      const tier = Math.min(3, Math.max(1, fieldState?.level || 1));
      const project = makeProject(civ, field, lab, civ.countries.find(c => c.id === lab.countryId), rng, {
        tier, progress: rng.int(0, 10), funding: Math.round(lab.funding * .3), fundingNeeded: Math.round(rng.int(120000, 900000))
      });
      civ.research.projects.push(project);
    }
  }
  bounded(civ.research.projects, CAPS.projects);
  // Existing projects can be revived by renewed funding.
  for (const project of civ.research.projects) {
    if (project.status === 'stalled' && project.funding >= project.fundingNeeded * .6 && rng.chance(.06)) {
      project.status = 'active';
      project.progress = Math.max(project.progress, 58);
      emit(events, 'feed', `${project.labName} resumes ${project.fieldName} work after renewed funding.`, { kind: 'good' });
    }
  }
}

function applyDiscovery(game, civ, discovery, rng, events) {
  const fieldState = civ.research.fields.find(f => f.id === discovery.field);
  if (fieldState) fieldState.funding += rng.int(20000, 220000);
  for (const [sector, weight] of Object.entries(discovery.impact || {})) {
    const companies = (game.companies || []).filter(c => String(c.sector).toLowerCase().includes(sector) || sector === 'manufacturing' && c.sector === 'manufacturing');
    for (const co of companies.slice(0, 4)) {
      co.rep = clamp((co.rep || 50) + Math.round(weight / 2), 0, 100);
      co.funds += Math.round(co.revenue * weight * .01);
    }
  }
  // Tiers 2 and 3 can produce a new technology, never an impossible one.
  if (discovery.tier >= 2) {
    const categoryByField = { cs: 'devtools', ai: 'ai', robotics: 'framework', semiconductors: 'cpu', cryptography: 'security', quantum: 'devtools', telecom: 'networking', materials: 'cpu', energy: 'networking', biotech: 'devtools' };
    const category = categoryByField[discovery.field] || 'devtools';
    const lab = civ.research.labs.find(l => l.id === discovery.labId);
    const country = civ.countries.find(c => c.id === discovery.countryId);
    const tech = {
      id: nextId(civ, 'tech'), name: discovery.name, category,
      vendorName: lab?.name || country?.name || 'Independent consortium', license: rng.chance(.35) ? 'open-source' : 'source-available',
      version: '1.0', adoption: rng.int(2, 12), compatibility: rng.pick([['x86', 'arm'], ['linux'], ['cloud'], ['portable']]),
      releasedWorld: civ.worldMinutes, documentation: rng.int(20, 62), security: rng.int(35, 78), ecosystem: rng.int(8, 42),
      priceIndex: rng.int(45, 130), status: 'active', standard: false,
      originDiscoveryId: discovery.id, competitors: []
    };
    civ.tech.technologies.push(tech);
    civilRecordTech(civ, tech, events);
  }
}

function civilRecordTech(civ, tech, events) {
  civ.tech.technologies.sort((a, b) => b.adoption - a.adoption);
  bounded(civ.tech.technologies, CAPS.tech);
  emit(events, 'feed', `New technology released: ${tech.name} (${tech.vendorName}).`, { kind: 'good' });
}

/* -------- property market and daily rent -------- */
function propertyCadence(game, civ, rng, events) {
  const market = civ.property.market;
  market.index = clamp(market.index + (rng.next() - .48) * .7 + (civ.metrics.growth - civ.metrics.inflation) * .03, 55, 220);
  market.rentIndex = clamp(market.rentIndex + (rng.next() - .5) * .6 + (civ.metrics.growth - 2) * .03, 45, 240);
  market.vacancy = clamp(market.vacancy + (rng.next() - .52) * .3, 1, 32);
  market.lastUpdateWorld = civ.worldMinutes;

  for (const listing of civ.property.listings) {
    if (listing.status !== 'available') continue;
    const city = civ.cities.find(c => c.id === listing.cityId);
    if (!city) continue;
    const target = Math.round(listing.price * (1 + (market.index / 100 - 1) * .04 + (rng.next() - .5) * .01));
    listing.price = Math.max(1000, target);
    listing.rent = Math.max(20, Math.round(listing.price * (market.rentIndex / 100) * .004 / 12));
  }

  // NPCs move when they can afford local housing and employment is stable.
  if (civ.property.owned.length < CAPS.owned && rng.chance(.22)) {
    const city = pickWeighted(rng, civ.cities, c => Math.max(1, c.population / 100000));
    const buyer = rng.pick(game.npcs || []);
    if (buyer && city) {
      const listing = civ.property.listings.find(l => l.cityId === city.id && l.status === 'available' && l.type === 'apartment');
      if (listing) {
        listing.status = 'owned';
        listing.ownerId = buyer.id;
        listing.ownerName = buyer.handle;
        civ.property.owned.push({ ...listing, purchasedWorld: civ.worldMinutes, occupancy: 'owner', rentPaid: 0 });
      }
    }
  }

  // Player property costs and income are part of the persistent economy.
  for (const property of civ.property.owned.filter(p => p.ownerId === 'player')) {
    const city = civ.cities.find(c => c.id === property.cityId);
    const country = civ.countries.find(c => c.id === property.countryId);
    const maintenance = Math.max(0, Math.round((property.maintenance || property.price * .008 / 12) / 30));
    const tax = Math.max(0, Math.round(property.price * (country?.tax.vat || 8) / 100 / 365));
    const rentIncome = property.occupancy === 'rented' ? Math.round((property.rent || 0) / 30) : 0;
    const net = rentIncome - maintenance - tax;
    if (net !== 0) {
      game.player.money += net;
      game.player.transactions.unshift({ time: Date.now(), amount: net, memo: `property ${property.label} · ${city?.name || property.cityId}`, balance: game.player.money });
      if (game.player.transactions.length > 120) game.player.transactions.length = 120;
      if (net > 0) game.stats.earned += net; else game.stats.spent += Math.abs(net);
    }
    if (game.player.money < 0 && rng.chance(.08)) {
      game.player.heat = clamp(game.player.heat + 1, 0, 100);
      pushMail(game, 'notice', 'Property charge unpaid', `A property charge for ${property.label} could not be settled. Repeated arrears may affect your standing with the ${country?.name || 'local'} property registry.`);
    }
  }

  // New construction appears slowly.
  if (civ.property.listings.filter(l => l.status === 'available').length < 30 && rng.chance(.18)) {
    const city = rng.pick(civ.cities);
    const [type, label, base, rentYield] = rng.pick(PROPERTY_TYPES);
    civ.property.listings.push({
      id: nextId(civ, 'prop'), type, label, cityId: city.id, countryId: city.countryId,
      price: Math.round(base * city.costIndex * (market.index / 100) * rng.float(.8, 1.2) / 1000) * 1000,
      rent: Math.round(base * city.costIndex * (market.rentIndex / 100) * rentYield / 12),
      maintenance: Math.round(base * city.costIndex * .008 / 12),
      taxRate: (civ.countries.find(c => c.id === city.countryId)?.tax.vat || 8) / 100,
      ownerId: null, ownerName: 'market', status: 'available', quality: rng.int(35, 96),
      built: worldYear(civ), listedWorld: civ.worldMinutes
    });
  }
  bounded(civ.property.listings, CAPS.listings);
  bounded(civ.property.owned, CAPS.owned);
}

/* -------- education cadence -------- */
function educationCadence(game, civ, rng, events) {
  for (const inst of civ.education.institutions) {
    if (rng.chance(.12)) inst.quality = clamp(inst.quality + rng.int(-1, 1), 20, 98);
    if (rng.chance(.08)) inst.enrolled = (inst.enrolled || 0) + rng.int(10, 200);
    inst.researchOutput = clamp(inst.researchOutput + rng.int(-1, 1), 5, 98);
  }
  // A bounded number of NPCs enroll and complete courses.
  if (civ.education.enrollments.filter(e => e.status === 'studying').length < 24 && rng.chance(.35)) {
    const npc = rng.pick(game.npcs || []);
    const course = rng.pick(civ.education.courses);
    if (npc && course) {
      civ.education.enrollments.push({ id: nextId(civ, 'enroll'), npcId: npc.id, handle: npc.handle, courseId: course.id, courseName: `${course.fieldName} · ${course.level}`, startedWorld: civ.worldMinutes, progress: rng.int(0, 35), status: 'studying' });
    }
  }
  for (const enrollment of civ.education.enrollments) {
    if (enrollment.status !== 'studying') continue;
    const course = civ.education.courses.find(c => c.id === enrollment.courseId);
    enrollment.progress = clamp(enrollment.progress + rng.int(1, 6), 0, 100);
    if (enrollment.progress >= 100) {
      enrollment.status = 'completed';
      const npc = game.npcs.find(n => n.id === enrollment.npcId);
      if (npc) {
        npc.skill = clamp((npc.skill || 50) + rng.int(1, 4), 0, 99);
        npc.rep = clamp((npc.rep || 40) + (course?.quality > 70 ? 1 : 0), 0, 100);
        const identity = civ.identities.find(i => i.id === npc.id);
        if (identity) {
          identity.professional.score = clamp(identity.professional.score + rng.int(1, 4), 0, 100);
          identity.credentials.push({ name: course?.certification || 'Course certificate', issuer: course?.institutionName || 'online provider', world: civ.worldMinutes });
          bounded(identity.credentials, 12);
        }
      }
      emit(events, 'feed', `@${enrollment.handle} completed ${enrollment.courseName}.`, { kind: 'info' });
    }
  }
  bounded(civ.education.enrollments, 120);
  // Keep a rotating catalog without unbounded growth.
  if (civ.education.courses.length < 36 && rng.chance(.12)) {
    const field = rng.pick(EDU_FIELDS);
    const inst = rng.pick(civ.education.institutions);
    civ.education.courses.push(makeCourse(civ, field, inst, civ.countries.find(c => c.id === inst.countryId), rng));
  }
}

/* -------- physical infrastructure and world effects -------- */
function infrastructureCadence(game, civ, rng, events) {
  const outageChance = .035;
  for (const grid of civ.infrastructure.grids) {
    if (rng.chance(outageChance * (1 + (100 - grid.reliability) / 180))) {
      const duration = rng.int(20, 240);
      const outage = { id: nextId(civ, 'outage'), kind: 'power', targetId: grid.id, cityId: grid.cityId, countryId: grid.countryId, startedWorld: civ.worldMinutes, endsWorld: civ.worldMinutes + duration, severity: rng.pick(['minor', 'major']), status: 'active' };
      civ.infrastructure.outages.push(outage);
      grid.status = 'degraded';
      const city = civ.cities.find(c => c.id === grid.cityId);
      if (city) city.utilities.power = clamp(city.utilities.power - rng.int(8, 25), 5, 99);
      applyOutageToServers(game, civ, outage, events);
      emit(events, 'feed', `Power disruption in ${city?.name || grid.cityId}. Data center operators are switching to backup capacity.`, { kind: 'warn' });
      recordTimeline(civ, 'infrastructure', `Power disruption in ${city?.name || grid.cityId}`, 'A grid fault interrupted industrial and data-center load. Backup systems covered part of the demand.', { countryId: grid.countryId, major: false });
    }
  }
  for (const fiber of civ.infrastructure.fiber) {
    if (rng.chance(.018 * (1 + (100 - fiber.redundancy) / 220))) {
      const duration = rng.int(30, 360);
      const outage = { id: nextId(civ, 'outage'), kind: 'fiber', targetId: fiber.id, cityId: null, countryId: fiber.countryId, startedWorld: civ.worldMinutes, endsWorld: civ.worldMinutes + duration, severity: 'major', status: 'active' };
      civ.infrastructure.outages.push(outage);
      fiber.status = 'degraded';
      fiber.latency = clamp(fiber.latency + rng.int(12, 70), 2, 260);
      applyOutageToServers(game, civ, outage, events);
      const country = civ.countries.find(c => c.id === fiber.countryId);
      emit(events, 'news', `Fibre disruption raises latency in ${country?.name || fiber.countryId}`, { body: 'A damaged route is forcing traffic through alternatives. Operators report elevated latency and intermittent packet loss.', source: 'The Packet' });
    }
  }
  for (const outage of civ.infrastructure.outages) {
    if (outage.status !== 'active' || civ.worldMinutes < outage.endsWorld) continue;
    outage.status = 'resolved';
    const grid = civ.infrastructure.grids.find(g => g.id === outage.targetId);
    if (grid) grid.status = 'nominal';
    const fiber = civ.infrastructure.fiber.find(f => f.id === outage.targetId);
    if (fiber) { fiber.status = 'nominal'; fiber.latency = Math.max(2, fiber.latency - 18); }
    restoreServersAfterOutage(game, civ, outage, events);
    emit(events, 'feed', `Infrastructure incident resolved (${outage.kind}).`, { kind: 'good' });
  }
  bounded(civ.infrastructure.outages, CAPS.outages);
}

function applyOutageToServers(game, civ, outage, events) {
  const affected = (game.servers || []).filter(s => {
    if (outage.kind === 'power') {
      const dc = civ.infrastructure.dataCenters.find(d => d.cityId === outage.cityId);
      return dc && (s.region === dc.region || s.id === dc.id);
    }
    return s.region === outage.countryId || civ.cities.find(c => c.id === outage.cityId)?.region === s.region;
  });
  for (const server of affected.slice(0, 40)) {
    server.civOutage = outage.id;
    server.civLatency = clamp((server.latency || 20) + (outage.severity === 'major' ? rngLatency(outage) : 8), 2, 400);
    if (outage.kind === 'power' && outage.severity === 'major') server.status = 'degraded';
    server.traffic = Math.max(0, Math.round((server.traffic || 0) * .82));
    if (server.owned) emit(events, 'feed', `${server.host} is affected by a ${outage.kind} incident.`, { kind: 'warn' });
  }
}

function rngLatency(outage) {
  return 20 + (hash32(outage.id) % 90);
}

function restoreServersAfterOutage(game, civ, outage, events) {
  for (const server of game.servers || []) {
    if (server.civOutage !== outage.id) continue;
    server.civOutage = null;
    server.civLatency = Math.max(4, Math.round((server.civLatency || 20) * .55));
    if (server.status === 'degraded' && !server.civHold) server.status = 'online';
    if (server.owned) emit(events, 'feed', `${server.host} recovered after the ${outage.kind} incident.`, { kind: 'good' });
  }
}

/* -------- dynamic events -------- */
function tickActiveEvents(game, civ, rng, events) {
  for (const event of civ.events) {
    if (event.status !== 'active') continue;
    if (civ.worldMinutes < event.startedWorld + event.durationWorld) continue;
    event.status = 'resolved';
    event.resolved = civ.worldMinutes;
    resolveWorldEvent(game, civ, event, rng, events);
  }
}

function resolveWorldEvent(game, civ, event, rng, events) {
  if (event.id === 'infrastructure-project' || event.category === 'infrastructure' && event.title.includes('cable')) {
    for (const country of civ.countries) country.internet.speed = Math.round(country.internet.speed * 1.02);
    emit(events, 'feed', 'A long-running infrastructure project reaches completion. Regional capacity improves.', { kind: 'good' });
  }
  if (event.category === 'economy') {
    for (const country of civ.countries) country.economy.growth = clamp(country.economy.growth + .3, -5, 9);
  }
  if (event.category === 'supply') {
    for (const component of Object.values(civ.supply.components)) component.availability = clamp(component.availability + 8, 2, 100);
  }
  if (event.category === 'infrastructure') {
    for (const fiber of civ.infrastructure.fiber) fiber.status = 'nominal';
  }
  recordTimeline(civ, event.category, `${event.title} — resolved`, event.body, { countryId: event.countryId, actors: event.actors, major: false });
  emit(events, 'feed', `${event.title} has resolved.`, { kind: 'info' });
}

function spawnWorldEvent(game, civ, rng, kindId, events, opts = {}) {
  if (!opts.force && civ.events.filter(e => e.status === 'active').length >= 8) return null;
  const archetype = EVENT_ARCHETYPES.find(e => e.id === kindId) || rng.pick(EVENT_ARCHETYPES);
  const country = opts.country || rng.pick(civ.countries);
  const severity = opts.severity || rng.pick(['minor', 'moderate', 'moderate', 'major']);
  const event = {
    id: nextId(civ, 'event'), category: archetype.category, title: archetype.title,
    body: archetype.body, severity, status: 'active', startedWorld: civ.worldMinutes,
    durationWorld: Math.max(1, Math.round(archetype.duration * (severity === 'major' ? 1.6 : severity === 'minor' ? .6 : 1))) * DAY,
    countryId: country?.id || null, actors: opts.actors || [], effects: {},
    headline: opts.headline || archetype.title, resolved: null
  };
  switch (archetype.id) {
    case 'recession':
      for (const c of civ.countries) { c.economy.growth = clamp(c.economy.growth - 1.2, -5, 9); c.economy.unemployment = clamp(c.economy.unemployment + .6, 1, 24); }
      event.effects = { growth: -.8, market: -.002, unrest: 4 };
      break;
    case 'boom':
      for (const c of civ.countries) c.economy.growth = clamp(c.economy.growth + .8, -5, 9);
      event.effects = { growth: .5, market: .0015 };
      break;
    case 'energy-crisis':
      civ.supply.energyIndex = Math.round(civ.supply.energyIndex * 1.35);
      for (const city of civ.cities) city.utilities.power = clamp(city.utilities.power - 8, 8, 99);
      event.effects = { energy: 6, growth: -.2 };
      break;
    case 'fiber-cut':
      for (const fiber of civ.infrastructure.fiber) fiber.latency = clamp(fiber.latency + (severity === 'major' ? 46 : 18), 2, 260);
      event.effects = { telecom: 5, growth: -.1 };
      break;
    case 'semiconductor-shortage':
      for (const component of Object.values(civ.supply.components)) component.availability = clamp(component.availability - 12, 2, 100);
      event.effects = { hardwareIndex: 20, growth: -.2 };
      break;
    case 'cyber-incident': {
      const targets = (game.servers || []).filter(s => !s.owned && s.status === 'online' && s.vulns?.some(v => !v.patched)).slice(0, 6);
      for (const server of targets) { server.compromised = true; server.security = clamp((server.security || 50) - rng.int(2, 8), 0, 99); }
      event.actors = targets.map(s => s.id);
      event.effects = { cyberRisk: 5, growth: -.1 };
      break;
    }
    case 'monopoly-inquiry': {
      const company = (game.companies || []).slice().sort((a, b) => (b.funds || 0) - (a.funds || 0))[0];
      event.actors = company ? [company.id] : [];
      event.effects = { growth: -.1, regulation: 2 };
      break;
    }
    case 'tech-breakthrough': {
      const field = rng.pick(civ.research.fields);
      field.level = Math.min(4, (field.level || 1) + 1);
      event.effects = { innovation: 4 };
      break;
    }
    case 'standards-war':
      event.effects = { telecom: 2, growth: -.05 };
      break;
    case 'infrastructure-project':
      event.effects = { telecom: -2, growth: .1 };
      break;
    case 'social-movement':
      country.unrest = clamp(country.unrest + 10, 0, 100);
      country.approval = clamp(country.approval - 4, 0, 100);
      event.effects = { unrest: 4 };
      break;
    case 'sanctions': {
      const b = rng.pick(civ.countries.filter(c => c.id !== country.id));
      if (b) {
        country.relations[b.id].sanctioned = true;
        country.relations[b.id].tension = clamp(country.relations[b.id].tension + 16, 0, 100);
        civ.relations.sanctions.push({ id: nextId(civ, 'sanction'), a: country.id, b: b.id, scope: rng.pick(['advanced components', 'financial services', 'cloud infrastructure']), startedWorld: civ.worldMinutes, status: 'active' });
        event.actors = [b.id];
      }
      event.effects = { growth: -.15 };
      break;
    }
    case 'diplomatic-summit': {
      const b = rng.pick(civ.countries.filter(c => c.id !== country.id));
      if (b) { country.relations[b.id].trust = clamp(country.relations[b.id].trust + 12, 0, 100); country.relations[b.id].tension = clamp(country.relations[b.id].tension - 10, 0, 100); }
      event.effects = { growth: .1 };
      break;
    }
    case 'media-scandal': {
      const outlet = rng.pick(civ.media.outlets);
      if (outlet) { outlet.trust = clamp(outlet.trust - 12, 0, 100); outlet.retractions++; event.actors = [outlet.id]; }
      event.effects = { mediaTrust: -4 };
      break;
    }
    case 'cable-landing':
      country.internet.speed = Math.round(country.internet.speed * 1.06);
      event.effects = { telecom: -2 };
      break;
  }
  civ.events.push(event);
  bounded(civ.events, CAPS.events);
  recordTimeline(civ, event.category, event.title, `${event.body} Severity: ${severity}.`, { countryId: event.countryId, actors: event.actors, major: severity === 'major' });
  emit(events, 'news', event.headline, { body: event.body, source: 'Signal Review' });
  return event;
}

function eventCadence(game, civ, rng, events) {
  const active = civ.events.filter(e => e.status === 'active');
  if (active.length >= 8) return;
  const avgGrowth = civ.countries.reduce((s, c) => s + c.economy.growth, 0) / civ.countries.length;
  const avgStability = civ.countries.reduce((s, c) => s + c.stability, 0) / civ.countries.length;
  const compromised = (game.servers || []).filter(s => s.compromised).length;
  const supplyPressure = civ.supply.hardwareIndex;
  const conditions = [
    ['recession', avgGrowth < 1.2 ? 20 : 3],
    ['boom', avgGrowth > 4.2 ? 18 : 3],
    ['energy-crisis', civ.supply.energyIndex > 120 ? 18 : 4],
    ['fiber-cut', rng.chance(.05) ? 12 : 3],
    ['semiconductor-shortage', supplyPressure > 130 ? 20 : 3],
    ['cyber-incident', compromised > 8 ? 18 : 5],
    ['monopoly-inquiry', 6],
    ['tech-breakthrough', 6],
    ['standards-war', 5],
    ['infrastructure-project', avgStability > 55 ? 7 : 2],
    ['social-movement', avgStability < 58 ? 14 : 3],
    ['sanctions', 5],
    ['diplomatic-summit', 6],
    ['election', 3],
    ['media-scandal', 5],
    ['cable-landing', 4]
  ];
  const chosen = pickWeighted(rng, conditions, x => x[1]);
  if (rng.chance(.22)) spawnWorldEvent(game, civ, rng, chosen[0], events);
}

/* -------- timeline summaries -------- */
function historyCadence(game, civ, rng, events) {
  if (civ.worldMinutes % YEAR > DAY) return;
  const year = worldYear(civ);
  const count = civ.timeline.filter(t => t.year === year - 1).length;
  if (count) {
    recordTimeline(civ, 'history', `${year - 1} in review`, `${count} recorded developments shaped the network, including regulatory changes, research results and infrastructure work. The world enters ${year} with ${civ.countries.length} major economies and ${civ.metrics.civilizationIndex}% civilization index.`, { major: true });
  }
}

/* ============================================================
   PUBLIC TICK
   ============================================================ */
export function tickCivilization(game, minutes = 1, rng = null) {
  const civ = ensureCivilization(game);
  rng = rng || civRng(game, 0x7f4a);
  const events = [];
  const elapsed = Math.max(0, Number(minutes) || 0);
  civ.worldMinutes = game.worldMinutes;

  const continuous = advanceBucket(civ, 'continuous', 30, civ.worldMinutes, 96);
  if (continuous) advanceContinuous(game, civ, continuous * 30, rng, events);

  const eco = advanceBucket(civ, 'economy', DAY, civ.worldMinutes, 30);
  for (let i = 0; i < eco; i++) dailyEconomy(game, civ, rng, events);

  const politics = advanceBucket(civ, 'politics', DAY, civ.worldMinutes, 20);
  for (let i = 0; i < politics; i++) dailyPolitics(game, civ, rng, events);

  const supply = advanceBucket(civ, 'supply', DAY, civ.worldMinutes, 20);
  for (let i = 0; i < supply; i++) dailySupply(game, civ, rng, events);

  const media = advanceBucket(civ, 'media', 360, civ.worldMinutes, 12);
  for (let i = 0; i < media; i++) mediaCadence(game, civ, rng, events);

  const research = advanceBucket(civ, 'research', 360, civ.worldMinutes, 12);
  for (let i = 0; i < research; i++) researchCadence(game, civ, rng, events);

  const property = advanceBucket(civ, 'property', DAY, civ.worldMinutes, 20);
  for (let i = 0; i < property; i++) propertyCadence(game, civ, rng, events);

  const education = advanceBucket(civ, 'education', 720, civ.worldMinutes, 10);
  for (let i = 0; i < education; i++) educationCadence(game, civ, rng, events);

  const infra = advanceBucket(civ, 'infrastructure', 180, civ.worldMinutes, 12);
  for (let i = 0; i < infra; i++) infrastructureCadence(game, civ, rng, events);

  const worldEvents = advanceBucket(civ, 'events', DAY * 3, civ.worldMinutes, 8);
  for (let i = 0; i < worldEvents; i++) eventCadence(game, civ, rng, events);

  tickActiveEvents(game, civ, rng, events);
  const history = advanceBucket(civ, 'history', YEAR, civ.worldMinutes, 2);
  for (let i = 0; i < history; i++) historyCadence(game, civ, rng, events);

  recomputeMetrics(civ, game);
  refreshPlayerIdentity(game, civ);
  trimCiv(civ);
  return events;
}

export function recomputeMetrics(civ, game = null) {
  const countries = civ.countries || [];
  const avg = (fn) => countries.length ? countries.reduce((s, c) => s + fn(c), 0) / countries.length : 0;
  const population = countries.reduce((s, c) => s + (c.population || 0), 0);
  const gdp = countries.reduce((s, c) => s + (c.economy?.gdp || 0), 0);
  const growth = avg(c => c.economy?.growth || 0);
  const inflation = avg(c => c.economy?.inflation || 0);
  const unemployment = avg(c => c.economy?.unemployment || 0);
  const stability = avg(c => c.stability || 0);
  const internetFreedom = avg(c => c.internetFreedom || 0);
  const mediaTrust = Object.values(civ.media?.publicOpinion || {}).length
    ? Object.values(civ.media.publicOpinion).reduce((s, o) => s + o.mediaTrust, 0) / Object.values(civ.media.publicOpinion).length : 50;
  const researchLevel = civ.research?.fields?.length ? civ.research.fields.reduce((s, f) => s + (f.level || 1), 0) / civ.research.fields.length : 1;
  const technologyAdoption = civ.tech?.technologies?.length ? civ.tech.technologies.slice(0, 20).reduce((s, t) => s + t.adoption, 0) / Math.min(20, civ.tech.technologies.length) : 30;
  const activeCount = civ.events?.filter(e => e.status === 'active').length || 0;
  const supplyPressure = (civ.supply?.hardwareIndex || 100) / 100;
  const legalPressure = avg(c => (c.regulation?.data + c.regulation?.cyber + c.regulation?.privacy) / 3) || 50;
  const inequality = clamp(88 - avg(c => c.internet.penetration) * .35 - avg(c => c.stability) * .25 + avg(c => c.unrest) * .15, 5, 95);
  const innovation = clamp(researchLevel * 12 + technologyAdoption * .45 + (civ.research?.discoveries?.length || 0) * .35, 0, 100);
  const civilizationIndex = clamp(
    stability * .22 + internetFreedom * .16 + mediaTrust * .12 + technologyAdoption * .18 +
    (100 - inequality) * .14 + clamp(50 + growth * 4 - inflation * 2, 0, 100) * .18,
    0, 100
  );
  civ.metrics = {
    population, gdp, growth, inflation, unemployment, stability, internetFreedom, mediaTrust,
    researchLevel, technologyAdoption, supplyPressure, legalPressure, inequality, innovation,
    civilizationIndex: Math.round(civilizationIndex * 10) / 10,
    activeEvents: activeCount, year: worldYear(civ),
    marketBias: civ.metrics?.marketBias || 0,
    updatedWorld: civ.worldMinutes
  };
  return civ.metrics;
}

function refreshPlayerIdentity(game, civ) {
  const p = civ.player;
  if (!p) return;
  p.handle = game.player.handle;
  p.name = game.player.name;
  p.social.score = clamp((game.player.reputation || 0) * .72 + p.social.followers / 7000, 0, 100);
  p.professional.score = clamp(8 + (game.stats.contracts || 0) * 1.4 + (game.stats.audits || 0) * .8 + (game.stats.exploits || 0) * .4, 0, 100);
  p.security.score = clamp(42 + (game.stats.patches || 0) * .6 + (game.stats.audits || 0) * .4 - (game.player.heat || 0) * .35, 0, 100);
  p.financial.score = clamp(24 + Math.log10(Math.max(100, netWorthLocal(game))) * 11, 0, 100);
  p.financial.assets = Math.max(0, netWorthLocal(game));
  p.academic.score = clamp(8 + Object.values(civ.education.player.knowledge).reduce((s, v) => s + v, 0) * .18 + (civ.education.player.credentials.length || 0) * 3, 0, 100);
  p.updatedWorld = civ.worldMinutes;
}

function netWorthLocal(game) {
  const owned = (game.servers || []).filter(s => s.owned).length;
  const sites = (game.sites || []).filter(s => s.ownerType === 'player').length;
  return (game.player.money || 0) + owned * 420 + sites * 180 + (game.player.domains || []).length * 18;
}

function pushMail(game, from, subject, body) {
  if (!game.mail) game.mail = [];
  const id = game.seq?.mail ? game.seq.mail++ : game.mail.length + 1;
  game.mail.push({ id, from, to: 'operator', subject, body, time: Date.now(), read: false, outbound: false, npcId: null, threadId: `th-${id}` });
  if (game.mail.length > 120) game.mail = game.mail.slice(-120);
}

/* ============================================================
   PLAYER ACTIONS
   ============================================================ */
export function playerStudy(game, fieldId, opts = {}) {
  const civ = ensureCivilization(game);
  const field = EDU_FIELDS.find(f => f.id === fieldId || f.name.toLowerCase() === String(fieldId || '').toLowerCase());
  if (!field) return { ok: false, error: `Unknown field. Try: ${EDU_FIELDS.map(f => f.id).join(', ')}` };
  const course = opts.courseId ? civ.education.courses.find(c => c.id === opts.courseId) : null;
  const hours = clamp(Math.round(opts.hours || 2), 1, 12);
  const cost = course ? Math.max(0, Math.round(course.tuition)) : 0;
  if (cost > game.player.money) return { ok: false, error: `Course costs ${fmtMoney(cost)}; you have ${fmtMoney(game.player.money)}.` };
  if (cost) {
    game.player.money -= cost;
    game.stats.spent += cost;
    game.player.transactions.unshift({ time: Date.now(), amount: -cost, memo: `course · ${course.institutionName}`, balance: game.player.money });
  }
  const knowledge = civ.education.player.knowledge;
  const base = course ? (course.quality / 100) * 2.2 : 1.1;
  const gain = clamp(base * hours * (1 + (civ.metrics.innovation || 30) / 300), .4, 12);
  knowledge[field.id] = clamp((knowledge[field.id] || 0) + gain, 0, 100);
  civ.education.player.studyHours = (civ.education.player.studyHours || 0) + hours;
  civ.player.academic.field = field.id;
  if (knowledge[field.id] >= 35 && !civ.education.player.credentials.some(c => c.field === field.id)) {
    civ.education.player.credentials.push({ field: field.id, name: field.cert, issuer: course?.institutionName || 'independent study', world: civ.worldMinutes });
    civ.player.credentials.push({ name: field.cert, issuer: course?.institutionName || 'independent study', world: civ.worldMinutes });
  }
  game.player.bonusSkill = (game.player.bonusSkill || 0) + gain * .02;
  recordTimeline(civ, 'education', `${game.player.handle} completed a study session in ${field.name}`, `Knowledge advanced to ${Math.round(knowledge[field.id])}/100. Practical skill transfers to relevant work.`, { major: false });
  return { ok: true, field, gain, knowledge: knowledge[field.id], cost, hours, course: course?.id || null };
}

export function playerStartResearch(game, fieldId, opts = {}) {
  const civ = ensureCivilization(game);
  const field = RESEARCH_FIELDS.find(f => f.id === fieldId || f.name.toLowerCase() === String(fieldId || '').toLowerCase());
  if (!field) return { ok: false, error: `Unknown field. Try: ${RESEARCH_FIELDS.map(f => f.id).join(', ')}` };
  const knowledge = civ.education.player.knowledge[field.id] || 0;
  if (knowledge < 8 && (game.player.skill || 1) < 3) return { ok: false, error: `You need more background in ${field.name}. Study first: civ study ${field.id}` };
  const funding = Math.max(200, Math.round(opts.funding || Math.min(game.player.money * .4, 4000)));
  if (funding > game.player.money) return { ok: false, error: `Funding commitment exceeds your balance (${fmtMoney(game.player.money)}).` };
  game.player.money -= funding;
  game.stats.spent += funding;
  game.player.transactions.unshift({ time: Date.now(), amount: -funding, memo: `independent research · ${field.name}`, balance: game.player.money });
  const fieldState = civ.research.fields.find(f => f.id === field.id);
  const tier = Math.min(3, Math.max(1, fieldState?.level || 1));
  const project = makeProject(civ, field, null, civ.countries.find(c => c.id === civ.player.countryId), makeRng((game.seed ^ game.worldMinutes ^ 0x2f1) >>> 0), {
    tier, progress: 4, funding, fundingNeeded: Math.max(1200, funding * 2.4), equipment: 20 + knowledge * .5,
    expertise: 18 + knowledge * .8 + (game.player.skill || 1) * 3, status: 'active', title: `Independent ${field.name.toLowerCase()} study`
  });
  project.ownerType = 'player';
  civ.research.projects.push(project);
  emitPlayerFeed(game, `Started independent research: ${field.name}.`, 'info');
  return { ok: true, project, funding };
}

export function playerFundResearch(game, projectId, amount) {
  const civ = ensureCivilization(game);
  const project = civ.research.projects.find(p => p.id === projectId || p.field === projectId);
  if (!project) return { ok: false, error: 'No such research project.' };
  const value = Math.max(50, Math.round(amount || 500));
  if (value > game.player.money) return { ok: false, error: `You only have ${fmtMoney(game.player.money)}.` };
  game.player.money -= value;
  game.stats.spent += value;
  game.player.transactions.unshift({ time: Date.now(), amount: -value, memo: `research funding · ${project.fieldName}`, balance: game.player.money });
  project.funding += value;
  project.expertise = clamp(project.expertise + value / 900, 0, 100);
  if (project.status === 'stalled' && project.funding >= project.fundingNeeded * .45) project.status = 'active';
  emitPlayerFeed(game, `Committed ${fmtMoney(value)} to ${project.title}.`, 'good');
  return { ok: true, project, amount: value };
}

export function playerPublish(game, headline, opts = {}) {
  const civ = ensureCivilization(game);
  const outlet = civ.media.outlets.find(o => o.id === opts.outletId) || pickWeighted(makeRng((game.seed ^ game.worldMinutes ^ 0x77) >>> 0), civ.media.outlets.filter(o => o.type !== 'social'), o => o.trust);
  if (!outlet) return { ok: false, error: 'No publication will accept the piece.' };
  const text = String(headline || '').trim();
  if (text.length < 12) return { ok: false, error: 'Headline is too short. Write at least 12 characters.' };
  const quality = clamp((civ.player.professional.score + civ.player.academic.score + (game.player.reputation || 0)) / 3 + (opts.evidence ? 15 : 0), 5, 95);
  const reach = Math.round((outlet.audience / 1000) * (quality / 60) * (1 + (game.player.reputation || 0) / 150) * (opts.investigation ? 1.4 : 1));
  const published = {
    id: nextId(civ, 'content'), outletId: outlet.id, outletName: outlet.name,
    authorId: 'player', topic: opts.topic || 'policy', headline: text, type: opts.investigation ? 'investigation' : 'commentary',
    reach, trustDelta: Math.round(quality / 35), sentiment: clamp(Math.round((game.player.reputation || 0) - 35), -60, 60),
    world: civ.worldMinutes, corrections: 0, status: 'published', revenue: 0,
    body: opts.body || `${text} Published through ${outlet.name}. The operator's record and cited evidence are part of the public attribution.`
  };
  civ.media.content.push(published);
  civ.media.playerPublished.push(published);
  civ.player.social.followers += Math.round(reach * .002);
  civ.player.professional.score = clamp(civ.player.professional.score + (quality > 60 ? 2 : .5), 0, 100);
  game.player.reputation = clamp((game.player.reputation || 0) + (quality > 60 ? 1 : 0), 0, 100);
  recordTimeline(civ, 'media', `${game.player.handle} publishes "${text}"`, `The piece appeared in ${outlet.name} and reached approximately ${fmtNum(reach)} readers.`, { actors: ['player', outlet.id], major: quality > 72 });
  emitPlayerFeed(game, `Published in ${outlet.name}: ${text}`, 'news');
  return { ok: true, content: published, outlet, reach };
}

export function playerBuyProperty(game, listingId, opts = {}) {
  const civ = ensureCivilization(game);
  const listing = civ.property.listings.find(p => p.id === listingId);
  if (!listing || listing.status !== 'available') return { ok: false, error: 'That property is not available.' };
  const price = Math.round(listing.price * (opts.rented ? 1 : 1));
  if (price > game.player.money) return { ok: false, error: `Property costs ${fmtMoney(price)}; you have ${fmtMoney(game.player.money)}.` };
  game.player.money -= price;
  game.stats.spent += price;
  game.player.transactions.unshift({ time: Date.now(), amount: -price, memo: `property purchase · ${listing.label}`, balance: game.player.money });
  listing.status = 'owned';
  listing.ownerId = 'player';
  listing.ownerName = game.player.handle;
  const owned = { ...listing, purchasedWorld: civ.worldMinutes, occupancy: opts.rented ? 'rented' : 'owner', rentPaid: 0 };
  civ.property.owned.push(owned);
  civ.player.financial.assets += price;
  recordTimeline(civ, 'property', `${game.player.handle} acquires ${listing.label} in ${civ.cities.find(c => c.id === listing.cityId)?.name}`, `Purchase price ${fmtMoney(price)}. The property enters the persistent local tax and maintenance system.`, { actors: ['player'], major: false });
  emitPlayerFeed(game, `Acquired ${listing.label} for ${fmtMoney(price)}.`, 'good');
  return { ok: true, property: owned, price };
}

export function playerSellProperty(game, propertyId) {
  const civ = ensureCivilization(game);
  const property = civ.property.owned.find(p => p.id === propertyId && p.ownerId === 'player');
  if (!property) return { ok: false, error: 'You do not own that property.' };
  const sale = Math.round(property.price * (civ.property.market.index / 100) * .94);
  game.player.money += sale;
  game.stats.earned += sale;
  game.player.transactions.unshift({ time: Date.now(), amount: sale, memo: `property sale · ${property.label}`, balance: game.player.money });
  civ.property.owned = civ.property.owned.filter(p => p.id !== propertyId);
  const listing = civ.property.listings.find(p => p.id === propertyId);
  if (listing) { listing.status = 'available'; listing.ownerId = null; listing.ownerName = 'market'; }
  civ.player.financial.assets = Math.max(0, civ.player.financial.assets - property.price);
  emitPlayerFeed(game, `Sold ${property.label} for ${fmtMoney(sale)}.`, 'good');
  return { ok: true, sale, property };
}

export function playerLobby(game, countryId, domainId) {
  const civ = ensureCivilization(game);
  const country = civ.countries.find(c => c.id === countryId || c.name.toLowerCase() === String(countryId || '').toLowerCase());
  if (!country) return { ok: false, error: 'No such country.' };
  const domain = LAW_DOMAINS.find(d => d.id === domainId) || LAW_DOMAINS[0];
  const cost = Math.max(120, Math.round(country.economy.gdp * .000000002 + 180));
  if (cost > game.player.money) return { ok: false, error: `Lobbying costs ${fmtMoney(cost)}.` };
  game.player.money -= cost;
  game.stats.spent += cost;
  game.player.transactions.unshift({ time: Date.now(), amount: -cost, memo: `policy meeting · ${country.name}`, balance: game.player.money });
  const support = clamp(28 + (game.player.reputation || 0) * .45 + (civ.player.professional.score || 0) * .3 + (civ.player.financial.score || 0) * .2, 5, 92);
  const policy = civ.policies.find(p => p.countryId === country.id && p.status === 'proposed') || { id: nextId(civ, 'policy'), countryId: country.id, domain: domain.id, name: `${domain.name} Amendment`, status: 'proposed', support: 0, introducedWorld: civ.worldMinutes, effectiveWorld: civ.worldMinutes + rngInt(game, 40, 160) * DAY, effect: 'clarify' };
  if (!civ.policies.includes(policy)) civ.policies.push(policy);
  policy.support = clamp(policy.support + support * .18, 0, 96);
  recordTimeline(civ, 'law', `${game.player.handle} meets regulators in ${country.name}`, `A policy meeting on ${domain.name.toLowerCase()} raised the proposal's support to ${Math.round(policy.support)}%.`, { countryId: country.id, actors: ['player'], major: false });
  emitPlayerFeed(game, `Policy meeting in ${country.name}; ${domain.name} proposal support now ${Math.round(policy.support)}%.`, 'info');
  return { ok: true, country, domain, policy, cost, support: policy.support };
}

function rngInt(game, a, b) {
  const rng = makeRng((game.seed ^ game.worldMinutes ^ 0x3a7) >>> 0);
  return rng.int(a, b);
}

export function playerRelocate(game, countryId, cityId) {
  const civ = ensureCivilization(game);
  const country = civ.countries.find(c => c.id === countryId || c.name.toLowerCase() === String(countryId || '').toLowerCase());
  if (!country) return { ok: false, error: 'No such country.' };
  const city = civ.cities.find(c => c.id === cityId && c.countryId === country.id) || civ.cities.find(c => c.countryId === country.id);
  const cost = Math.max(80, Math.round(country.costIndex * 420));
  if (cost > game.player.money) return { ok: false, error: `Relocation costs ${fmtMoney(cost)}.` };
  game.player.money -= cost;
  game.stats.spent += cost;
  game.player.transactions.unshift({ time: Date.now(), amount: -cost, memo: `relocation · ${city?.name || country.name}`, balance: game.player.money });
  civ.player.countryId = country.id;
  civ.player.cityId = city?.id || null;
  emitPlayerFeed(game, `Relocated to ${city?.name || country.name}, ${country.name}.`, 'info');
  return { ok: true, country, city, cost };
}

export function playerAdoptTech(game, techId) {
  const civ = ensureCivilization(game);
  const tech = civ.tech.technologies.find(t => t.id === techId || t.name.toLowerCase().includes(String(techId || '').toLowerCase()));
  if (!tech) return { ok: false, error: 'No such technology.' };
  const cost = Math.max(0, Math.round(tech.priceIndex * 2.4));
  if (cost > game.player.money) return { ok: false, error: `Adoption costs ${fmtMoney(cost)}.` };
  game.player.money -= cost;
  game.stats.spent += cost;
  game.player.transactions.unshift({ time: Date.now(), amount: -cost, memo: `technology adoption · ${tech.name}`, balance: game.player.money });
  tech.adoption = clamp(tech.adoption + 1.2, 0, 100);
  game.player.bonusSkill = (game.player.bonusSkill || 0) + .18;
  civ.player.professional.score = clamp(civ.player.professional.score + 1, 0, 100);
  emitPlayerFeed(game, `Adopted ${tech.name} (${tech.vendorName}).`, 'good');
  return { ok: true, tech, cost };
}

function emitPlayerFeed(game, text, kind = 'info') {
  if (!game.feed) game.feed = [];
  game.feed.unshift({ id: game.seq?.feed ? game.seq.feed++ : game.feed.length + 1, time: Date.now(), world: game.worldMinutes, text, kind });
  if (game.feed.length > 80) game.feed.length = 80;
}

/* ============================================================
   MULTIPLAYER AUTHORITY HELPERS
   ============================================================ */
export function makeMultiplayer(game, civ) {
  const worldId = `world-${hash32(`${game.seed}:${game.createdAt}`).toString(16).padStart(8, '0')}`;
  return {
    worldId, authority: 'local', transport: 'local-persistence', createdAt: Date.now(),
    players: [{
      id: 'player', handle: game.player.handle, name: game.player.name, role: 'owner',
      connected: true, lastSeen: Date.now(), permissions: ['trade', 'company', 'research', 'publish', 'property', 'contracts']
    }],
    ledger: [],
    ledgerHead: 'genesis',
    permissions: {
      owner: ['trade', 'company', 'research', 'publish', 'property', 'contracts', 'admin'],
      operator: ['trade', 'research', 'publish', 'contracts'],
      employee: ['research', 'publish', 'contracts'],
      auditor: ['audit']
    },
    antiCheat: { rejected: 0, flagged: [], rate: {}, lastAuditWorld: game.worldMinutes },
    lastSync: Date.now()
  };
}

export function recordLedger(game, entry) {
  const civ = ensureCivilization(game);
  const mp = civ.multiplayer;
  const body = JSON.stringify({ actor: entry.actor || 'player', action: entry.action || 'unknown', amount: Math.round(entry.amount || 0), memo: entry.memo || '', world: civ.worldMinutes });
  const prev = mp.ledgerHead || 'genesis';
  const hash = hash32(prev + body).toString(16).padStart(8, '0');
  const row = { id: nextId(civ, 'ledger'), seq: mp.ledger.length + 1, actor: entry.actor || 'player', action: entry.action || 'unknown', amount: Math.round(entry.amount || 0), memo: entry.memo || '', world: civ.worldMinutes, prev, hash, at: Date.now() };
  mp.ledger.push(row);
  mp.ledgerHead = hash;
  bounded(mp.ledger, CAPS.ledger);
  return row;
}

export function authorizeAction(game, actorId, action) {
  const civ = ensureCivilization(game);
  const mp = civ.multiplayer;
  const actor = mp.players.find(p => p.id === actorId || p.handle === actorId);
  if (!actor) return { ok: false, error: 'unknown actor' };
  if (!actor.connected && action !== 'sync') return { ok: false, error: 'actor is disconnected' };
  const allowed = mp.permissions[actor.role] || [];
  if (!allowed.includes(action) && !allowed.includes('admin')) return { ok: false, error: `role ${actor.role} may not perform ${action}` };
  const now = Date.now();
  const key = `${actor.id}:${action}`;
  mp.antiCheat.rate[key] = (mp.antiCheat.rate[key] || 0) + 1;
  if (mp.antiCheat.rate[key] > 90) {
    mp.antiCheat.rejected++;
    return { ok: false, error: 'rate limit exceeded' };
  }
  return { ok: true, actor };
}

export function validateLedger(game) {
  const civ = ensureCivilization(game);
  const mp = civ.multiplayer;
  let prev = 'genesis';
  for (const row of mp.ledger) {
    const body = JSON.stringify({ actor: row.actor, action: row.action, amount: row.amount, memo: row.memo, world: row.world });
    const expected = hash32(prev + body).toString(16).padStart(8, '0');
    if (row.prev !== prev || row.hash !== expected) return { ok: false, brokenAt: row.id, expected, found: row.hash };
    prev = row.hash;
  }
  return { ok: true, head: mp.ledgerHead, entries: mp.ledger.length, checked: mp.ledger.length };
}

export function joinSharedWorld(game, profile = {}) {
  const civ = ensureCivilization(game);
  const mp = civ.multiplayer;
  const id = profile.id || `remote-${hash32(`${profile.handle || ''}:${Date.now()}`).toString(16).slice(0, 8)}`;
  let player = mp.players.find(p => p.id === id || p.handle === profile.handle);
  if (!player) {
    player = { id, handle: profile.handle || 'remote-operator', name: profile.name || 'Remote Operator', role: profile.role || 'operator', connected: true, lastSeen: Date.now(), permissions: [...(mp.permissions[profile.role || 'operator'] || [])] };
    mp.players.push(player);
  } else {
    player.connected = true;
    player.lastSeen = Date.now();
  }
  mp.lastSync = Date.now();
  return { ok: true, worldId: mp.worldId, player, authority: mp.authority };
}

export function disconnectSharedPlayer(game, actorId) {
  const civ = ensureCivilization(game);
  const player = civ.multiplayer.players.find(p => p.id === actorId || p.handle === actorId);
  if (!player) return { ok: false, error: 'unknown actor' };
  player.connected = false;
  player.lastSeen = Date.now();
  civ.multiplayer.lastSync = Date.now();
  return { ok: true, player };
}

export function applyRemoteAction(game, actorId, action, payload = {}) {
  const auth = authorizeAction(game, actorId, action);
  if (!auth.ok) return auth;
  const civ = ensureCivilization(game);
  if (action === 'sync') {
    civ.multiplayer.lastSync = Date.now();
    return { ok: true, metrics: civ.metrics, snapshot: sharedSnapshot(game) };
  }
  if (action === 'trade' || action === 'property' || action === 'contracts' || action === 'company' || action === 'research' || action === 'publish') {
    const row = recordLedger(game, { actor: auth.actor.handle, action, amount: payload.amount || 0, memo: payload.memo || action });
    civ.multiplayer.lastSync = Date.now();
    return { ok: true, accepted: row, authoritative: true, note: 'Action recorded. Transport adapters can relay this ledger entry to a shared server.' };
  }
  return { ok: false, error: `unsupported action ${action}` };
}

export function sharedSnapshot(game) {
  const civ = ensureCivilization(game);
  return {
    worldId: civ.multiplayer.worldId, worldMinutes: game.worldMinutes, year: worldYear(civ),
    metrics: civ.metrics, countries: civ.countries.map(c => ({ id: c.id, name: c.name, growth: c.economy.growth, stability: c.stability })),
    players: civ.multiplayer.players.map(p => ({ id: p.id, handle: p.handle, role: p.role, connected: p.connected })),
    ledgerHead: civ.multiplayer.ledgerHead
  };
}

/* ============================================================
   QUERIES / FORMAT HELPERS FOR SHELL + UI
   ============================================================ */
export function getCivCountry(game, query) {
  const civ = ensureCivilization(game);
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;
  return civ.countries.find(c => c.id === q || c.code.toLowerCase() === q || c.name.toLowerCase() === q || c.formal.toLowerCase().includes(q)) || null;
}
export function getCivCity(game, query) {
  const civ = ensureCivilization(game);
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;
  return civ.cities.find(c => c.id === q || c.name.toLowerCase() === q) || null;
}
export function playerCountry(game) {
  const civ = ensureCivilization(game);
  return civ.countries.find(c => c.id === civ.player.countryId) || civ.countries[0];
}
export function playerCity(game) {
  const civ = ensureCivilization(game);
  return civ.cities.find(c => c.id === civ.player.cityId) || civ.cities.find(c => c.countryId === civ.player.countryId) || civ.cities[0];
}
export function legalPenaltyMultiplier(game, countryId = null) {
  const civ = ensureCivilization(game);
  const country = countryId ? civ.countries.find(c => c.id === countryId) : playerCountry(game);
  if (!country) return 1;
  const strict = ((country.regulation.cyber || 50) + (country.regulation.data || 50) + (country.regulation.privacy || 50)) / 150;
  const war = civ.events.some(e => e.status === 'active' && e.category === 'security') ? .15 : 0;
  return clamp(.7 + strict * .9 + war, .65, 2.2);
}
export function activeLegalDisputes(game) {
  const civ = ensureCivilization(game);
  return civ.disputes.filter(d => d.status === 'open' || d.status === 'hearing');
}
export function civilizationSummary(game) {
  const civ = ensureCivilization(game);
  const m = recomputeMetrics(civ, game);
  const country = playerCountry(game);
  return {
    civ, metrics: m, country, city: playerCity(game),
    year: m.year, courts: civ.courts.length, regulators: civ.regulators.length,
    activeLaws: civ.laws.filter(l => l.status === 'active').length,
    proposedLaws: civ.laws.filter(l => l.status === 'proposed').length,
    institutions: civ.education.institutions.length,
    courses: civ.education.courses.length,
    researchProjects: civ.research.projects.filter(p => p.status === 'active').length,
    discoveries: civ.research.discoveries.length,
    outlets: civ.media.outlets.length,
    datacenters: civ.infrastructure.dataCenters.length,
    properties: civ.property.owned.length,
    listed: civ.property.listings.filter(l => l.status === 'available').length,
    technologies: civ.tech.technologies.length,
    activeEvents: civ.events.filter(e => e.status === 'active').length,
    timeline: civ.timeline.length,
    playerDisputes: civ.disputes.filter(d => d.subject === 'player' || d.subject === 'player-company').length
  };
}
export function civKnowledge(game) {
  const civ = ensureCivilization(game);
  return civ.education.player.knowledge || {};
}
export function knowledgeBonus(game) {
  const civ = ensureCivilization(game);
  const values = Object.values(civ.education.player.knowledge || {});
  if (!values.length) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return clamp(avg / 75, 0, 1.4);
}
export function civHistory(game, opts = {}) {
  const civ = ensureCivilization(game);
  const q = String(opts.query || '').toLowerCase();
  let rows = civ.timeline.slice().reverse();
  if (q) rows = rows.filter(t => `${t.title} ${t.body} ${t.category}`.toLowerCase().includes(q));
  return rows.slice(0, Math.max(1, Math.min(100, opts.limit || 30)));
}
export function civEventList(game, activeOnly = false) {
  const civ = ensureCivilization(game);
  return civ.events.filter(e => !activeOnly || e.status === 'active').slice().sort((a, b) => b.startedWorld - a.startedWorld);
}
export function playerProperties(game) {
  const civ = ensureCivilization(game);
  return civ.property.owned.filter(p => p.ownerId === 'player');
}
export function playerCredentials(game) {
  const civ = ensureCivilization(game);
  return civ.education.player.credentials || [];
}
export function playerCompliance(game) {
  const civ = ensureCivilization(game);
  return { score: civ.player.compliance, records: civ.compliance.filter(c => c.subject === 'player' || c.subject === 'player-company') };
}
export function outletFor(game, name) {
  const civ = ensureCivilization(game);
  const q = String(name || '').toLowerCase();
  return civ.media.outlets.find(o => o.id === q || o.name.toLowerCase().includes(q)) || null;
}
export function researchField(game, id) {
  const civ = ensureCivilization(game);
  return RESEARCH_FIELDS.find(f => f.id === id || f.name.toLowerCase() === String(id || '').toLowerCase()) || null;
}
export function educationFields() { return EDU_FIELDS.map(f => ({ ...f })); }
export function researchFields() { return RESEARCH_FIELDS.map(f => ({ id: f.id, name: f.name, code: f.code, discoveries: f.discoveries.map(d => ({ tier: d.tier, name: d.name })) })); }
export function lawDomains() { return LAW_DOMAINS.map(d => ({ ...d })); }
