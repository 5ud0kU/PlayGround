/* Static definitions for the persistent digital civilization layer.
   All countries, institutions, technologies and people here are fictional. */

export const COUNTRY_DEFS = [
  {
    id: 'northreach', name: 'Northreach', code: 'NR', capital: 'Halcyon', region: 'north-atlantic',
    government: 'federal democracy', leader: 'Chancellor Mara Venn', currency: { code: 'NRC', name: 'Northreach Credit', usd: 1 },
    population: 148000000, gdp: 5800000000000, growth: .021, inflation: .024, approval: 54,
    internet: 94, broadband: 87, tax: .22, corporateTax: .19, privacy: 82, liberty: 84, stability: 78, energy: 86,
    digitalPolicy: 'privacy-first, disclosure-oriented', cyberPolicy: 'critical infrastructure reporting within 72 hours',
    techFocus: ['artificial intelligence', 'semiconductors', 'cloud infrastructure'],
    telecoms: ['Northline Fiber', 'Halcyon Transit', 'Reach Mobile'],
    universities: ['Halcyon Institute of Technology', 'Northreach School of Law', 'Venn Computational College'],
    financialInstitutions: ['Northreach Reserve', 'Halcyon Clearing Union', 'Meridian Mutual'],
    techIndustries: ['AI research', 'cloud platforms', 'developer tools']
  },
  {
    id: 'meridia', name: 'Meridia', code: 'MR', capital: 'Aurelia', region: 'central-europe',
    government: 'social democracy', leader: 'Premier Ilse Dorn', currency: { code: 'MRC', name: 'Meridian Crown', usd: 1.12 },
    population: 94000000, gdp: 3900000000000, growth: .016, inflation: .019, approval: 61,
    internet: 91, broadband: 84, tax: .31, corporateTax: .25, privacy: 88, liberty: 82, stability: 84, energy: 74,
    digitalPolicy: 'strong labor and consumer protection', cyberPolicy: 'mandatory incident logs and worker consultation',
    techFocus: ['industrial automation', 'robotics', 'energy systems'],
    telecoms: ['Crownlink', 'Aurelia Broadband', 'Meridian Mobile'],
    universities: ['Aurelia Polytechnic', 'Dorn Institute for Labor', 'Meridian Materials Academy'],
    financialInstitutions: ['Bank of Meridia', 'Crown Savings', 'Aurelia Cooperative Credit'],
    techIndustries: ['robotics', 'manufacturing software', 'energy technology']
  },
  {
    id: 'vantia', name: 'Vantia', code: 'VN', capital: 'Cinder Gate', region: 'east-asia',
    government: 'technocratic state', leader: 'Directorate of Systems', currency: { code: 'VNC', name: 'Vantian Yuan', usd: .43 },
    population: 410000000, gdp: 7200000000000, growth: .043, inflation: .031, approval: 47,
    internet: 88, broadband: 79, tax: .18, corporateTax: .21, privacy: 34, liberty: 22, stability: 73, energy: 92,
    digitalPolicy: 'state-coordinated infrastructure and identity', cyberPolicy: 'licensing and mandatory local data custody',
    techFocus: ['semiconductors', 'consumer electronics', 'network equipment'],
    telecoms: ['Vantia Telecom', 'Cinder Optical', 'Red Basin Networks'],
    universities: ['Cinder Gate Technical University', 'Vantia Semiconductor Academy', 'Red Basin Institute'],
    financialInstitutions: ['Vantia Development Bank', 'Cinder Gate Exchange', 'Basin Credit Authority'],
    techIndustries: ['semiconductors', 'consumer hardware', 'telecommunications']
  },
  {
    id: 'solace', name: 'Solace', code: 'SL', capital: 'Port Amaranth', region: 'island-pacific',
    government: 'parliamentary republic', leader: 'First Minister Ren Ito', currency: { code: 'SLC', name: 'Solace Dollar', usd: 1.04 },
    population: 28000000, gdp: 1180000000000, growth: .027, inflation: .028, approval: 58,
    internet: 97, broadband: 90, tax: .15, corporateTax: .12, privacy: 63, liberty: 79, stability: 81, energy: 69,
    digitalPolicy: 'light-touch, cross-border commercial', cyberPolicy: 'baseline security and rapid disclosure',
    techFocus: ['digital finance', 'media platforms', 'maritime logistics'],
    telecoms: ['Amaranth Cable', 'Solace Mobile', 'Port Signal'],
    universities: ['Port Amaranth University', 'Solace Media School', 'Amaranth Finance Institute'],
    financialInstitutions: ['Solace Monetary Authority', 'Amaranth Free Bank', 'Pacific Settlement House'],
    techIndustries: ['fintech', 'media platforms', 'logistics software']
  },
  {
    id: 'norveld', name: 'Norveld', code: 'NV', capital: 'Frosthold', region: 'north-europe',
    government: 'constitutional monarchy', leader: 'Queen Astrid IV', currency: { code: 'NVC', name: 'Norveld Krone', usd: .58 },
    population: 19000000, gdp: 860000000000, growth: .014, inflation: .017, approval: 66,
    internet: 89, broadband: 82, tax: .36, corporateTax: .22, privacy: 85, liberty: 88, stability: 89, energy: 95,
    digitalPolicy: 'public-interest infrastructure', cyberPolicy: 'strict utility and grid resilience rules',
    techFocus: ['energy technology', 'materials science', 'cold-climate systems'],
    telecoms: ['Frosthold State Fiber', 'Norveld Mobile', 'North Grid Telecom'],
    universities: ['Frosthold University', 'Norveld Energy Institute', 'Astrid Materials Laboratory'],
    financialInstitutions: ['Norveld Central Bank', 'Frosthold Pension Fund', 'North Grid Credit'],
    techIndustries: ['energy systems', 'materials', 'industrial sensors']
  },
  {
    id: 'qamara', name: 'Qamara', code: 'QM', capital: 'Nadir', region: 'south-asia',
    government: 'federal republic', leader: 'President Anika Rao', currency: { code: 'QMC', name: 'Qamara Credit', usd: .12 },
    population: 620000000, gdp: 3100000000000, growth: .061, inflation: .047, approval: 52,
    internet: 63, broadband: 38, tax: .12, corporateTax: .17, privacy: 48, liberty: 61, stability: 63, energy: 57,
    digitalPolicy: 'mobile-first inclusion and local language access', cyberPolicy: 'central CERT with sector reporting',
    techFocus: ['mobile services', 'software outsourcing', 'satellite communications'],
    telecoms: ['Nadir Mobile', 'Qamara Fiber Grid', 'Indus Satellite'],
    universities: ['Nadir Institute of Science', 'Qamara Open University', 'Rao Engineering College'],
    financialInstitutions: ['Qamara Reserve', 'Nadir Payments Network', 'Rural Credit Cooperative'],
    techIndustries: ['mobile software', 'outsourcing', 'satellite services']
  },
  {
    id: 'tarsis', name: 'Tarsis', code: 'TR', capital: 'Bellwether', region: 'north-america',
    government: 'federal republic', leader: 'President Owen Pike', currency: { code: 'TRD', name: 'Tarsian Dollar', usd: 1.08 },
    population: 262000000, gdp: 8100000000000, growth: .018, inflation: .026, approval: 45,
    internet: 90, broadband: 78, tax: .19, corporateTax: .23, privacy: 58, liberty: 72, stability: 69, energy: 82,
    digitalPolicy: 'market-led with sectoral antitrust', cyberPolicy: 'breach notification and critical vendor review',
    techFocus: ['cloud platforms', 'defense electronics', 'biotechnology'],
    telecoms: ['Bellwether Longline', 'Tarsis Wireless', 'Pike Metro Fiber'],
    universities: ['Bellwether University', 'Tarsis Applied Sciences', 'Pike School of Economics'],
    financialInstitutions: ['Tarsis Federal Reserve', 'Bellwether Capital', 'Pike Insurance Group'],
    techIndustries: ['cloud', 'defense software', 'biotech']
  },
  {
    id: 'kaimana', name: 'Kaimana', code: 'KM', capital: 'Lāhui', region: 'oceania',
    government: 'island federation', leader: 'Chief Minister Tala Moana', currency: { code: 'KMD', name: 'Kaimana Dollar', usd: .71 },
    population: 34000000, gdp: 720000000000, growth: .033, inflation: .023, approval: 64,
    internet: 86, broadband: 71, tax: .21, corporateTax: .18, privacy: 72, liberty: 81, stability: 83, energy: 63,
    digitalPolicy: 'community ownership and cultural IP protection', cyberPolicy: 'regional mutual aid and disclosure',
    techFocus: ['marine technology', 'digital culture', 'distributed energy'],
    telecoms: ['Lāhui Cable', 'Kaimana Mobile', 'Moana Satellite'],
    universities: ['Lāhui Oceanic University', 'Kaimana Arts Institute', 'Moana Climate School'],
    financialInstitutions: ['Kaimana Development Bank', 'Lāhui Credit Union', 'Moana Insurance'],
    techIndustries: ['marine systems', 'digital media', 'distributed energy']
  }
];

export const CITY_DEFS = [
  { id: 'halcyon', name: 'Halcyon', countryId: 'northreach', capital: true, population: 7800000, x: 24, y: 34, districts: ['civic','financial','university','harbor'], power: 91, fiber: 94, water: 89, transport: 88, rentIndex: 1.42, wages: 1.36, ports: 1, airports: 1 },
  { id: 'ironvale', name: 'Ironvale', countryId: 'northreach', capital: false, population: 3100000, x: 18, y: 42, districts: ['industrial','logistics','residential','data'], power: 84, fiber: 78, water: 81, transport: 82, rentIndex: .92, wages: .98, ports: 1, airports: 0 },
  { id: 'aurelia', name: 'Aurelia', countryId: 'meridia', capital: true, population: 5400000, x: 48, y: 31, districts: ['civic','university','commercial','residential'], power: 89, fiber: 90, water: 92, transport: 91, rentIndex: 1.28, wages: 1.22, ports: 0, airports: 1 },
  { id: 'steelhaven', name: 'Steelhaven', countryId: 'meridia', capital: false, population: 2600000, x: 52, y: 36, districts: ['industrial','port','logistics','residential'], power: 86, fiber: 74, water: 87, transport: 84, rentIndex: .78, wages: .94, ports: 1, airports: 0 },
  { id: 'cinder-gate', name: 'Cinder Gate', countryId: 'vantia', capital: true, population: 14200000, x: 76, y: 38, districts: ['civic','technology','industrial','residential'], power: 94, fiber: 91, water: 88, transport: 93, rentIndex: 1.51, wages: 1.32, ports: 1, airports: 1 },
  { id: 'red-basin', name: 'Red Basin', countryId: 'vantia', capital: false, population: 6900000, x: 72, y: 44, districts: ['semiconductor','logistics','residential','power'], power: 96, fiber: 84, water: 83, transport: 87, rentIndex: 1.02, wages: 1.12, ports: 0, airports: 1 },
  { id: 'port-amaranth', name: 'Port Amaranth', countryId: 'solace', capital: true, population: 2400000, x: 88, y: 62, districts: ['harbor','financial','media','civic'], power: 84, fiber: 96, water: 85, transport: 86, rentIndex: 1.64, wages: 1.24, ports: 1, airports: 1 },
  { id: 'coral-quay', name: 'Coral Quay', countryId: 'solace', capital: false, population: 860000, x: 91, y: 66, districts: ['tourism','residential','logistics','media'], power: 77, fiber: 88, water: 79, transport: 73, rentIndex: 1.31, wages: 1.05, ports: 1, airports: 0 },
  { id: 'frosthold', name: 'Frosthold', countryId: 'norveld', capital: true, population: 1800000, x: 45, y: 13, districts: ['civic','university','energy','residential'], power: 98, fiber: 92, water: 94, transport: 88, rentIndex: 1.18, wages: 1.31, ports: 1, airports: 1 },
  { id: 'north-grid', name: 'North Grid', countryId: 'norveld', capital: false, population: 620000, x: 41, y: 9, districts: ['energy','industrial','residential','research'], power: 99, fiber: 81, water: 91, transport: 72, rentIndex: .84, wages: 1.16, ports: 1, airports: 0 },
  { id: 'nadir', name: 'Nadir', countryId: 'qamara', capital: true, population: 11800000, x: 65, y: 55, districts: ['civic','technology','residential','logistics'], power: 64, fiber: 69, water: 61, transport: 67, rentIndex: .68, wages: .58, ports: 1, airports: 1 },
  { id: 'indus-crossing', name: 'Indus Crossing', countryId: 'qamara', capital: false, population: 4300000, x: 61, y: 61, districts: ['industrial','residential','agriculture','logistics'], power: 57, fiber: 48, water: 55, transport: 58, rentIndex: .44, wages: .47, ports: 0, airports: 0 },
  { id: 'bellwether', name: 'Bellwether', countryId: 'tarsis', capital: true, population: 9200000, x: 14, y: 58, districts: ['civic','financial','defense','residential'], power: 87, fiber: 90, water: 84, transport: 89, rentIndex: 1.47, wages: 1.39, ports: 1, airports: 1 },
  { id: 'dust-ridge', name: 'Dust Ridge', countryId: 'tarsis', capital: false, population: 2900000, x: 9, y: 64, districts: ['energy','industrial','data','residential'], power: 79, fiber: 72, water: 58, transport: 71, rentIndex: .72, wages: .93, ports: 0, airports: 1 },
  { id: 'lahui', name: 'Lāhui', countryId: 'kaimana', capital: true, population: 1400000, x: 94, y: 78, districts: ['civic','university','harbor','media'], power: 72, fiber: 84, water: 81, transport: 69, rentIndex: .97, wages: .82, ports: 1, airports: 1 },
  { id: 'moana-reef', name: 'Moana Reef', countryId: 'kaimana', capital: false, population: 410000, x: 89, y: 83, districts: ['marine','tourism','research','residential'], power: 66, fiber: 72, water: 78, transport: 57, rentIndex: .61, wages: .74, ports: 1, airports: 0 }
];

export const LAW_DOMAINS = [
  { id: 'privacy', name: 'Digital privacy', short: 'privacy', desc: 'Collection limits, retention, and subject access rights.' },
  { id: 'data', name: 'Data protection', short: 'data', desc: 'Cross-border transfer, breach notice, and data custody rules.' },
  { id: 'ip', name: 'Intellectual property', short: 'IP', desc: 'Copyright term, fair use, patent scope, and moral rights.' },
  { id: 'software', name: 'Software licensing', short: 'licensing', desc: 'Liability, interoperability, and source disclosure requirements.' },
  { id: 'business', name: 'Business registration', short: 'business', desc: 'Incorporation, ownership disclosure, and foreign control.' },
  { id: 'labor', name: 'Employment', short: 'labor', desc: 'Worker classification, consultation, and dismissal rules.' },
  { id: 'finance', name: 'Financial regulation', short: 'finance', desc: 'Capital rules, audits, consumer lending, and market conduct.' },
  { id: 'consumer', name: 'Consumer protection', short: 'consumer', desc: 'Refunds, dark-pattern limits, and platform accountability.' },
  { id: 'cybercrime', name: 'Cybercrime', short: 'cyber', desc: 'Unauthorized access, disclosure duties, and investigation powers.' },
  { id: 'crypto', name: 'Cryptocurrency', short: 'crypto', desc: 'Custody, securities treatment, and anti-money-laundering duties.' },
  { id: 'contracts', name: 'Digital contracts', short: 'contracts', desc: 'Electronic signature, automated terms, and dispute remedies.' }
];

export const SUBJECTS = [
  { id: 'programming', name: 'Programming', category: 'computing', field: 'computer-science', credential: 'certified developer', desc: 'Algorithms, data structures, testing, and maintainable software.', practical: 'Code contracts and product quality.' },
  { id: 'cybersecurity', name: 'Cybersecurity', category: 'computing', field: 'cryptography', credential: 'security practitioner', desc: 'Threat modeling, incident response, access control, and forensics.', practical: 'Audits, hardening, and exploit reliability.' },
  { id: 'networking', name: 'Networks', category: 'computing', field: 'telecommunications', credential: 'network engineer', desc: 'Routing, DNS, congestion, fiber, and resilient topology.', practical: 'Infrastructure reliability and cloud placement.' },
  { id: 'mathematics', name: 'Mathematics', category: 'science', field: 'quantum-computing', credential: 'applied mathematician', desc: 'Discrete math, probability, optimization, and proof.', practical: 'Research speed and quantitative finance.' },
  { id: 'ai', name: 'Artificial intelligence', category: 'computing', field: 'artificial-intelligence', credential: 'AI researcher', desc: 'Models, evaluation, data governance, and safe deployment.', practical: 'Agent quality and research discovery.' },
  { id: 'finance', name: 'Finance', category: 'commerce', field: 'computer-science', credential: 'financial analyst', desc: 'Valuation, risk, markets, audits, and capital allocation.', practical: 'Investments, dividends, and property finance.' },
  { id: 'law', name: 'Digital law', category: 'law', field: 'cryptography', credential: 'compliance specialist', desc: 'Jurisdiction, contracts, privacy, IP, and regulatory strategy.', practical: 'Lower compliance risk and stronger disputes.' },
  { id: 'media', name: 'Media practice', category: 'culture', field: 'telecommunications', credential: 'published journalist', desc: 'Research, verification, interviewing, and audience trust.', practical: 'Media reach, corrections, and public opinion.' },
  { id: 'design', name: 'Product design', category: 'culture', field: 'computer-science', credential: 'product designer', desc: 'Interaction, accessibility, systems thinking, and visual craft.', practical: 'Product adoption and culture releases.' },
  { id: 'materials', name: 'Materials science', category: 'science', field: 'materials-science', credential: 'materials researcher', desc: 'Semiconductors, batteries, composites, and fabrication limits.', practical: 'Supply efficiency and hardware research.' },
  { id: 'energy', name: 'Energy systems', category: 'engineering', field: 'energy-technology', credential: 'energy engineer', desc: 'Generation, storage, grid stability, and efficiency.', practical: 'Infrastructure resilience and energy costs.' },
  { id: 'biotech', name: 'Biotechnology', category: 'science', field: 'biotechnology', credential: 'biotech researcher', desc: 'Biology, instrumentation, ethics, and translational research.', practical: 'Biotech research and medical supply.' }
];

export const RESEARCH_FIELDS = [
  { id: 'computer-science', name: 'Computer science', risk: .08, baseCost: 2400, difficulty: 2, equipment: 'compute cluster', output: 'software' },
  { id: 'artificial-intelligence', name: 'Artificial intelligence', risk: .16, baseCost: 5400, difficulty: 4, equipment: 'GPU cluster', output: 'ai model' },
  { id: 'robotics', name: 'Robotics', risk: .14, baseCost: 4200, difficulty: 3, equipment: 'robotics lab', output: 'automation' },
  { id: 'semiconductor-engineering', name: 'Semiconductor engineering', risk: .19, baseCost: 8800, difficulty: 5, equipment: 'clean room', output: 'chip' },
  { id: 'cryptography', name: 'Cryptography', risk: .07, baseCost: 3000, difficulty: 3, equipment: 'secure lab', output: 'protocol' },
  { id: 'quantum-computing', name: 'Quantum computing', risk: .24, baseCost: 12500, difficulty: 6, equipment: 'cryogenic lab', output: 'quantum system' },
  { id: 'telecommunications', name: 'Telecommunications', risk: .11, baseCost: 3600, difficulty: 3, equipment: 'RF test range', output: 'network technology' },
  { id: 'materials-science', name: 'Materials science', risk: .15, baseCost: 5200, difficulty: 4, equipment: 'materials lab', output: 'material' },
  { id: 'energy-technology', name: 'Energy technology', risk: .13, baseCost: 4700, difficulty: 4, equipment: 'grid testbed', output: 'energy system' },
  { id: 'biotechnology', name: 'Biotechnology', risk: .21, baseCost: 6800, difficulty: 5, equipment: 'biosafety lab', output: 'biotech process' }
];

export const TECH_SECTORS = [
  { id: 'operating-systems', name: 'Operating systems', license: 'mixed', adoptionBase: .22, field: 'computer-science' },
  { id: 'programming-languages', name: 'Programming languages', license: 'open-source', adoptionBase: .18, field: 'computer-science' },
  { id: 'devtools', name: 'Development tools', license: 'mixed', adoptionBase: .26, field: 'computer-science' },
  { id: 'ai-models', name: 'AI models', license: 'proprietary', adoptionBase: .15, field: 'artificial-intelligence' },
  { id: 'cpus', name: 'CPUs', license: 'proprietary', adoptionBase: .31, field: 'semiconductor-engineering' },
  { id: 'gpus', name: 'GPUs', license: 'proprietary', adoptionBase: .24, field: 'semiconductor-engineering' },
  { id: 'networking', name: 'Network equipment', license: 'mixed', adoptionBase: .28, field: 'telecommunications' },
  { id: 'smartphones', name: 'Smartphones', license: 'proprietary', adoptionBase: .34, field: 'semiconductor-engineering' },
  { id: 'cloud-platforms', name: 'Cloud platforms', license: 'proprietary', adoptionBase: .21, field: 'computer-science' },
  { id: 'databases', name: 'Databases', license: 'open-source', adoptionBase: .19, field: 'computer-science' },
  { id: 'security-software', name: 'Security software', license: 'mixed', adoptionBase: .17, field: 'cryptography' },
  { id: 'frameworks', name: 'Developer frameworks', license: 'open-source', adoptionBase: .23, field: 'computer-science' }
];

export const RESOURCE_DEFS = [
  { id: 'silicon', name: 'Silicon', unit: 'kg', base: 42, countryBias: ['vantia','northreach'], category: 'raw' },
  { id: 'copper', name: 'Copper', unit: 'kg', base: 9, countryBias: ['norveld','tarsis'], category: 'raw' },
  { id: 'lithium', name: 'Lithium', unit: 'kg', base: 74, countryBias: ['qamara','norveld'], category: 'raw' },
  { id: 'rare-earth', name: 'Rare earths', unit: 'kg', base: 118, countryBias: ['vantia','qamara'], category: 'raw' },
  { id: 'steel', name: 'Steel', unit: 'tonne', base: 640, countryBias: ['meridia','tarsis'], category: 'material' },
  { id: 'fiber', name: 'Optical fiber', unit: 'km', base: 210, countryBias: ['solace','norveld'], category: 'material' },
  { id: 'energy', name: 'Energy', unit: 'MWh', base: 88, countryBias: ['norveld','tarsis'], category: 'utility' },
  { id: 'water', name: 'Industrial water', unit: 'm3', base: 6, countryBias: ['meridia','kaimana'], category: 'utility' }
];

export const COMPONENT_DEFS = [
  { id: 'semiconductors', name: 'Semiconductors', inputs: { silicon: .8, 'rare-earth': .12, energy: .4 }, base: 180, field: 'semiconductor-engineering' },
  { id: 'pcbs', name: 'Circuit boards', inputs: { copper: .3, steel: .01, energy: .08 }, base: 64, field: 'semiconductor-engineering' },
  { id: 'batteries', name: 'Batteries', inputs: { lithium: .5, copper: .15, energy: .12 }, base: 96, field: 'energy-technology' },
  { id: 'optics', name: 'Optical modules', inputs: { fiber: .2, 'rare-earth': .05, energy: .06 }, base: 132, field: 'telecommunications' },
  { id: 'servers', name: 'Servers', inputs: { semiconductors: .6, pcbs: .4, steel: .02, energy: .3 }, base: 920, field: 'computer-science' },
  { id: 'routers', name: 'Routers', inputs: { semiconductors: .25, pcbs: .2, optics: .15 }, base: 410, field: 'telecommunications' },
  { id: 'handsets', name: 'Handsets', inputs: { semiconductors: .2, pcbs: .15, batteries: .1 }, base: 260, field: 'semiconductor-engineering' },
  { id: 'gpu-units', name: 'GPU units', inputs: { semiconductors: .9, pcbs: .3, energy: .5 }, base: 1680, field: 'semiconductor-engineering' }
];

export const PROPERTY_DEFS = [
  { id: 'apartment', name: 'Apartment', domain: 'residential', base: 210000, rent: 1.9, maintenance: .008, tax: .006 },
  { id: 'house', name: 'House', domain: 'residential', base: 390000, rent: 2.1, maintenance: .012, tax: .007 },
  { id: 'office', name: 'Office', domain: 'commercial', base: 820000, rent: 2.7, maintenance: .015, tax: .009 },
  { id: 'commercial', name: 'Commercial building', domain: 'commercial', base: 1400000, rent: 3.1, maintenance: .018, tax: .011 },
  { id: 'warehouse', name: 'Warehouse', domain: 'industrial', base: 960000, rent: 2.4, maintenance: .014, tax: .008 },
  { id: 'industrial', name: 'Industrial facility', domain: 'industrial', base: 2400000, rent: 2.8, maintenance: .022, tax: .012 },
  { id: 'data-center', name: 'Data center', domain: 'infrastructure', base: 5200000, rent: 3.4, maintenance: .028, tax: .014 },
  { id: 'land', name: 'Development land', domain: 'land', base: 180000, rent: .4, maintenance: .002, tax: .004 }
];

export const MEDIA_OUTLET_DEFS = [
  { id: 'wire', kind: 'newswire', names: ['NullNet Wire', 'Global Packet', 'The Daily Route'] },
  { id: 'newspaper', kind: 'newspaper', names: ['The Halcyon Ledger', 'Aurelia Morning', 'Cinder Gate Post'] },
  { id: 'magazine', kind: 'online magazine', names: ['Signal Review', 'Byte Ledger', 'Longform Systems'] },
  { id: 'television', kind: 'television network', names: ['Northreach One', 'Meridian Public', 'Tarsis Tonight'] },
  { id: 'platform', kind: 'social platform', names: ['Circle', 'Threadline', 'Lāhui Commons'] },
  { id: 'streaming', kind: 'streaming service', names: ['Amaranth Stream', 'Cinder Play', 'Moana Wave'] },
  { id: 'podcast', kind: 'podcast network', names: ['Dense Fiber', 'The Quiet Channel', 'After the Incident'] },
  { id: 'creator', kind: 'independent creator', names: ['@fieldnotes', '@packetdiary', '@slowlab'] }
];

export const CONTENT_TYPES = [
  { id: 'investigation', name: 'investigation', trust: 9, reach: .7, risk: .08, field: 'media' },
  { id: 'analysis', name: 'analysis', trust: 7, reach: .8, risk: .03, field: 'mathematics' },
  { id: 'news', name: 'news report', trust: 5, reach: 1, risk: .02, field: 'media' },
  { id: 'tutorial', name: 'tutorial', trust: 8, reach: .6, risk: .01, field: 'programming' },
  { id: 'entertainment', name: 'entertainment', trust: 3, reach: 1.25, risk: .01, field: 'design' },
  { id: 'advertisement', name: 'advertising', trust: -2, reach: 1.1, risk: .04, field: 'media' }
];

export const CULTURE_DEFS = [
  { id: 'game', name: 'Games', kind: 'game studio', field: 'programming', desc: 'Interactive worlds, engines, and live operations.' },
  { id: 'music', name: 'Music', kind: 'music platform', field: 'media', desc: 'Distribution, licensing, and live performance.' },
  { id: 'streaming', name: 'Streaming', kind: 'streaming service', field: 'media', desc: 'Series, film, and subscription catalogs.' },
  { id: 'art', name: 'Digital art', kind: 'digital art collective', field: 'design', desc: 'Commissions, galleries, and visual culture.' },
  { id: 'community', name: 'Virtual communities', kind: 'community platform', field: 'networking', desc: 'Shared spaces with their own norms and economies.' },
  { id: 'esports', name: 'Esports', kind: 'esports organization', field: 'programming', desc: 'Teams, tournaments, and competitive circuits.' }
];

export const COMPLIANCE_ACTIONS = {
  research: { baseRisk: .035, label: 'research activity' },
  media: { baseRisk: .05, label: 'publication' },
  company: { baseRisk: .04, label: 'commercial operation' },
  property: { baseRisk: .025, label: 'property acquisition' },
  crypto: { baseRisk: .11, label: 'digital asset activity' },
  security: { baseRisk: .12, label: 'security testing' }
};

export const HISTORY_EPOCHS = [
  { id: 'founding', label: 'Network founding', yearsAgo: 14, tone: 'infrastructure' },
  { id: 'standard', label: 'Protocol standardization', yearsAgo: 11, tone: 'technology' },
  { id: 'crash', label: 'Aurelia market correction', yearsAgo: 8, tone: 'economy' },
  { id: 'privacy', label: 'Northreach privacy act', yearsAgo: 6, tone: 'law' },
  { id: 'fiber', label: 'Pacific fiber ring', yearsAgo: 4, tone: 'infrastructure' },
  { id: 'model', label: 'First public reasoning model', yearsAgo: 3, tone: 'research' },
  { id: 'shortage', label: 'Semiconductor shortage', yearsAgo: 2, tone: 'supply' },
  { id: 'culture', label: 'Community platform boom', yearsAgo: 1, tone: 'culture' }
];
