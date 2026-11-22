/* Pools of fictional people, organizations, infrastructure and narrative texture. */

export const FIRST = ['Mira','Dante','Sana','Ilya','Noor','Jonas','Elena','Rin','Sam','Aya','Tomas','Priya','Kofi','Lena','Oscar','Yuki','Nadia','Emil','Zara','Mateo','Iris','Felix','Hana','Dmitri','Amara','Theo','Lucia','Ravi','Sofia','Kenji','Maeve','Andre','Talia','Bruno','Ines','Viktor','Chloe','Omar','Freya','Nico'];
export const LAST = ['Chen','Ruiz','Okafor','Petrov','Haddad','Berg','Voss','Tanaka','Osei','Nakamura','Silva','Sharma','Mensah','Weber','Lindqvist','Mori','Rahman','Novak','Haddad','Costa','Kaur','Holm','Ibrahim','Volkov','Diallo','Marchetti','Singh','Moreau','Sato','Byrne','Ferreira','Klein','Aziz','Rossi','Ivanova','Dubois','Hughes','Farouk','Larsen','Mendes'];
export const HANDLES = ['hex','v0id','lumen','ghost','mirage','atlas','cipher','pixel','relay','n0va','tessera','fable','kernel','sable','onyx','wire','moth','kestrel','echo','delta','rune','glimmer','basalt','quill','nomad','sparrow','vector','flint','halo','proxy','quartz','drift','ember','fjord','garnet','heron','ivory','juniper','kiln','lattice'];
export const ROLES = [
  ['software developer', 'dev'], ['systems administrator', 'ops'], ['security researcher', 'sec'],
  ['network engineer', 'net'], ['entrepreneur', 'biz'], ['journalist', 'media'],
  ['data engineer', 'data'], ['site reliability engineer', 'ops'], ['penetration tester', 'sec'],
  ['technical writer', 'media'], ['product designer', 'design'], ['quantitative trader', 'biz'],
  ['student', 'student'], ['independent consultant', 'biz'], ['malware analyst', 'sec'],
  ['database administrator', 'data'], ['open-source maintainer', 'dev'], ['infrastructure broker', 'biz']
];
export const PERSONALITIES = ['precise','restless','guarded','generous','sarcastic','methodical','impulsive','idealistic','pragmatic','secretive','curious','blunt','patient','ambitious','cautious','chaotic','loyal','skeptical'];
export const BIOS = [
  'Builds small tools for people who do not have time to read documentation.',
  'Believes every outage is a communication problem wearing a costume.',
  'Keeps a notebook of every strange packet seen on the edge.',
  'Left a large cloud provider to find out what ownership feels like.',
  'Runs a private lab composed mostly of rescued hardware.',
  'Writes postmortems nobody asked for, and everyone reads.',
  'Has strong opinions about DNS and stronger opinions about coffee.',
  'Makes a living translating regulatory language into firewall rules.',
  'Maintains three packages that half the network silently depends on.',
  'Learned security by breaking their own things first.',
  'Collects abandoned domains and gives them small, strange lives.',
  'Says they are retired from consulting. Still answers the phone.',
  'Interested in systems that fail gracefully and people who do not.',
  'Treats uptime as a moral position.',
  'Runs a reading group on protocol design and organizational failure.',
  'Former incident responder. Now sells calm to nervous founders.',
  'Keeps every server they have ever owned. Most still answer.',
  'Builds interfaces for machines that cannot ask for them.'
];
export const ACTIVITIES = [
  'reviewing a pull request', 'chasing a memory leak', 'rotating credentials', 'writing a postmortem',
  'reading packet captures', 'arguing about DNS', 'deploying to staging', 'rolling back production',
  'auditing an access policy', 'updating a runbook', 'answering a support ticket', 'patching a kernel',
  'sketching a network diagram', 'testing a backup restore', 'reviewing a contract', 'reading a security advisory',
  'benchmarking a database', 'cleaning up old cron jobs', 'documenting an undocumented API', 'drinking coffee',
  'responding to an alert', 'migrating a legacy service', 'negotiating a hosting bill', 'writing tests',
  'investigating a strange login', 'mentoring a junior engineer', 'refactoring a parser', 'watching a dashboard'
];

export const COMPANY_DEFS = [
  { name: 'Helix Labs', domain: 'helixlabs.io', sector: 'research', size: 180, security: 74, funds: 8200000, desc: 'Applied research in distributed systems and machine learning. Publishes more than it ships.' },
  { name: 'Acme Industries', domain: 'acme-industries.com', sector: 'manufacturing', size: 2400, security: 58, funds: 42000000, desc: 'Industrial automation and logistics software. Old systems, new promises.' },
  { name: 'FinWise', domain: 'finwise.net', sector: 'finance', size: 640, security: 88, funds: 96000000, desc: 'Consumer banking infrastructure. Regulated, audited, and perpetually hiring.' },
  { name: 'Northwind Devtools', domain: 'northwind.dev', sector: 'software', size: 74, security: 61, funds: 2100000, desc: 'Developer tooling for small teams. Growing faster than its documentation.' },
  { name: 'PixelBazaar', domain: 'pixelbazaar.com', sector: 'commerce', size: 310, security: 64, funds: 5400000, desc: 'An independent marketplace for digital goods and strange commissions.' },
  { name: 'StaticWave', domain: 'staticwave.net', sector: 'hosting', size: 220, security: 77, funds: 12800000, desc: 'Edge hosting and CDN capacity for the long tail of the network.' },
  { name: 'Meridian Consulting', domain: 'meridian.corp', sector: 'consulting', size: 1200, security: 79, funds: 18000000, desc: 'Security and infrastructure consulting for organizations that wait too long.' },
  { name: 'OldCo Systems', domain: 'oldco.net', sector: 'legacy', size: 12, security: 21, funds: 180000, desc: 'A former hosting company. Most of it was switched off. Some of it was not.' },
  { name: 'NullNet Collective', domain: 'nullnet', sector: 'community', size: 40, security: 69, funds: 240000, desc: 'A volunteer-run community network: boards, mail, git, and a public shell.' },
  { name: 'CyberNet Authority', domain: 'cybernet.gov', sector: 'government', size: 5200, security: 94, funds: 240000000, desc: 'The network regulator. Publishes advisories. Watches the edges.' },
  { name: 'Vanta Security', domain: 'vanta.security', sector: 'security', size: 290, security: 91, funds: 15600000, desc: 'Incident response and defensive engineering. Expensive, discreet, effective.' },
  { name: 'Orbital Cloud', domain: 'orbital.cloud', sector: 'cloud', size: 1900, security: 84, funds: 78000000, desc: 'Compute and storage with a global footprint and an opaque pricing page.' },
  { name: 'Redwood Hosting', domain: 'redwood.host', sector: 'hosting', size: 96, security: 55, funds: 890000, desc: 'Cheap VPS capacity, honest support, occasional maintenance windows.' },
  { name: 'Signal Review', domain: 'signalreview.media', sector: 'media', size: 48, security: 70, funds: 1200000, desc: 'Independent reporting on infrastructure, privacy, and digital labor.' },
  { name: 'Byte Ledger', domain: 'byteledger.news', sector: 'media', size: 65, security: 66, funds: 1700000, desc: 'Markets, technology, and the people who move both.' },
  { name: 'Kestrel Analytics', domain: 'kestrel.ai', sector: 'data', size: 140, security: 72, funds: 6400000, desc: 'Data pipelines and forecasting for organizations that cannot afford surprises.' },
  { name: 'Moth & Co', domain: 'moth.co', sector: 'design', size: 22, security: 49, funds: 420000, desc: 'A small design studio with a large collection of unfinished domains.' },
  { name: 'Cinder Freight', domain: 'cinderfreight.com', sector: 'logistics', size: 880, security: 63, funds: 22000000, desc: 'Freight routing and warehouse telemetry. Runs on a surprising amount of Perl.' },
  { name: 'Lattice Biotech', domain: 'latticebio.org', sector: 'research', size: 260, security: 81, funds: 34000000, desc: 'Computational biology and a very careful approach to access control.' },
  { name: 'Basalt Infrastructure', domain: 'basalt.net', sector: 'infrastructure', size: 410, security: 76, funds: 19200000, desc: 'Fiber, transit, and rack space for the networks nobody notices until they fail.' }
];

export const KEY_NPCS = [
  { handle: 'hex', name: 'Mira Chen', role: 'security researcher', company: 'Helix Labs', personality: 'precise', skill: 88, rep: 76, funds: 52000, bio: 'Publishes careful writeups. Pays promptly for clean audit work. Hates sloppy reports.', interests: ['appsec','protocols','formal methods'] },
  { handle: 'v0id', name: 'Dante Ruiz', role: 'infrastructure broker', company: 'independent', personality: 'secretive', skill: 79, rep: 38, funds: 148000, bio: 'Moves access, data, and hardware. Never asks where a thing came from.', interests: ['access','markets','opsec'] },
  { handle: 'lumen', name: 'Sana Okafor', role: 'systems administrator', company: 'Acme Industries', personality: 'methodical', skill: 71, rep: 54, funds: 9800, bio: 'Keeps a 20-year-old industrial estate alive. Would like fewer surprises.', interests: ['legacy','networking','backups'] },
  { handle: 'ghost', name: 'Ilya Petrov', role: 'penetration tester', company: 'Vanta Security', personality: 'guarded', skill: 84, rep: 61, funds: 37000, bio: 'Professional adversary. Suspicious of anyone who calls themselves a hacker.', interests: ['red team','windows','detection'] },
  { handle: 'mirage', name: 'Noor Haddad', role: 'journalist', company: 'Signal Review', personality: 'curious', skill: 48, rep: 67, funds: 6400, bio: 'Covers infrastructure failures and the companies that cause them. Protects sources.', interests: ['privacy','policy','leaks'] },
  { handle: 'atlas', name: 'Jonas Berg', role: 'entrepreneur', company: 'Northwind Devtools', personality: 'ambitious', skill: 57, rep: 49, funds: 210000, bio: 'Building developer tools at a pace that alarms his own engineers.', interests: ['product','growth','hiring'] },
  { handle: 'cipher', name: 'Elena Voss', role: 'security lead', company: 'FinWise', personality: 'pragmatic', skill: 90, rep: 82, funds: 88000, bio: 'Runs a tight ship. Will pay for evidence, not drama. Reports go to legal.', interests: ['compliance','crypto','incident response'] },
  { handle: 'pixel', name: 'Rin Tanaka', role: 'product designer', company: 'Moth & Co', personality: 'idealistic', skill: 52, rep: 43, funds: 5200, bio: 'Designs interfaces for small businesses and occasionally for machines.', interests: ['design','accessibility','web'] },
  { handle: 'relay', name: 'Sam Osei', role: 'network engineer', company: 'Basalt Infrastructure', personality: 'patient', skill: 73, rep: 58, funds: 14200, bio: 'Knows where the fiber goes. Will explain BGP to anyone who asks twice.', interests: ['bgp','fiber','routing'] },
  { handle: 'n0va', name: 'Aya Nakamura', role: 'data engineer', company: 'Kestrel Analytics', personality: 'restless', skill: 69, rep: 46, funds: 11800, bio: 'Builds pipelines that survive bad input and worse management.', interests: ['data','streaming','privacy'] },
  { handle: 'onyx', name: 'Tomas Weber', role: 'independent consultant', company: 'independent', personality: 'blunt', skill: 76, rep: 51, funds: 19400, bio: 'Fixes broken deployments. Charges by the hour. Does not do meetings.', interests: ['devops','cloud','cost'] },
  { handle: 'kestrel', name: 'Priya Sharma', role: 'malware analyst', company: 'Vanta Security', personality: 'cautious', skill: 82, rep: 63, funds: 26500, bio: 'Spends her days in sandboxes. Prefers systems that tell the truth.', interests: ['malware','forensics','reverse engineering'] },
  { handle: 'fable', name: 'Maeve Byrne', role: 'open-source maintainer', company: 'independent', personality: 'generous', skill: 67, rep: 72, funds: 4300, bio: 'Maintains a small library used by half the network. Lives on donations.', interests: ['oss','docs','community'] },
  { handle: 'kernel', name: 'Dmitri Volkov', role: 'site reliability engineer', company: 'Orbital Cloud', personality: 'skeptical', skill: 80, rep: 56, funds: 31000, bio: 'Has seen the inside of too many incident channels. Still answers the page.', interests: ['reliability','observability','chaos'] }
];

export const OSES = [
  'Debian GNU/Linux 12 (bookworm)', 'Ubuntu 22.04.4 LTS', 'Ubuntu 24.04 LTS', 'Parrot Security 6.2',
  'Alpine Linux 3.19', 'Rocky Linux 9.3', 'Fedora Server 40', 'FreeBSD 14.0-RELEASE',
  'OpenBSD 7.5', 'Windows Server 2019', 'Windows Server 2022', 'Arch Linux (rolling)',
  'CentOS Stream 9', 'Raspberry Pi OS 12', 'OpenWrt 23.05'
];
export const SERVICES = [
  { port: 22, name: 'ssh', product: 'OpenSSH', versions: ['8.4p1','8.9p1','9.3p1','9.6p1'] },
  { port: 80, name: 'http', product: 'nginx', versions: ['1.18.0','1.22.1','1.24.0'] },
  { port: 443, name: 'https', product: 'nginx', versions: ['1.18.0','1.22.1','1.24.0'] },
  { port: 21, name: 'ftp', product: 'vsftpd', versions: ['3.0.3','3.0.5'] },
  { port: 25, name: 'smtp', product: 'Postfix', versions: ['3.5.6','3.7.4'] },
  { port: 53, name: 'domain', product: 'BIND', versions: ['9.16.44','9.18.24'] },
  { port: 143, name: 'imap', product: 'Dovecot', versions: ['2.3.16','2.3.21'] },
  { port: 993, name: 'imaps', product: 'Dovecot', versions: ['2.3.16','2.3.21'] },
  { port: 3306, name: 'mysql', product: 'MySQL', versions: ['8.0.32','8.0.36'] },
  { port: 5432, name: 'postgresql', product: 'PostgreSQL', versions: ['14.5','16.2'] },
  { port: 6379, name: 'redis', product: 'Redis', versions: ['6.0.9','7.2.4'] },
  { port: 8080, name: 'http-alt', product: 'Apache Tomcat', versions: ['9.0.71','10.1.18'] },
  { port: 27017, name: 'mongodb', product: 'MongoDB', versions: ['5.0.14','7.0.5'] },
  { port: 9200, name: 'elasticsearch', product: 'Elasticsearch', versions: ['7.17.9','8.12.0'] },
  { port: 3389, name: 'ms-wbt-server', product: 'Microsoft Terminal Services', versions: ['10.0'] },
  { port: 5900, name: 'vnc', product: 'TightVNC', versions: ['1.3.10'] },
  { port: 11211, name: 'memcache', product: 'memcached', versions: ['1.6.18'] },
  { port: 8443, name: 'https-alt', product: 'Caddy', versions: ['2.7.6'] }
];
export const VULN_TYPES = [
  { name: 'SQL injection', service: 'http', severity: 'high', desc: 'Unsanitized query parameter reaches the primary database.' },
  { name: 'Reflected XSS', service: 'http', severity: 'medium', desc: 'Search parameter is rendered without encoding.' },
  { name: 'Outdated TLS stack', service: 'https', severity: 'medium', desc: 'Legacy cipher suites remain enabled.' },
  { name: 'Weak SSH credentials', service: 'ssh', severity: 'high', desc: 'Service account password appears in an old deployment script.' },
  { name: 'Exposed .git directory', service: 'http', severity: 'high', desc: 'Repository metadata is served from the web root.' },
  { name: 'Default admin credentials', service: 'http', severity: 'critical', desc: 'Management console still uses the vendor default.' },
  { name: 'Unauthenticated Redis', service: 'redis', severity: 'critical', desc: 'Cache accepts commands from any reachable interface.' },
  { name: 'Directory traversal', service: 'http', severity: 'high', desc: 'Static file handler does not normalize encoded paths.' },
  { name: 'Outdated CMS plugin', service: 'http', severity: 'medium', desc: 'A third-party plugin has a known file upload flaw.' },
  { name: 'Open SMTP relay', service: 'smtp', severity: 'medium', desc: 'Mail server forwards unauthenticated external mail.' },
  { name: 'Anonymous FTP write', service: 'ftp', severity: 'high', desc: 'Anonymous user can write to the public upload directory.' },
  { name: 'Leaked API token', service: 'http', severity: 'high', desc: 'Token embedded in a client bundle still has write scope.' },
  { name: 'Unpatched OpenSSH', service: 'ssh', severity: 'high', desc: 'Version is affected by a pre-auth memory flaw.' },
  { name: 'Verbose error disclosure', service: 'http', severity: 'low', desc: 'Stack traces reveal internal paths and library versions.' },
  { name: 'Missing rate limiting', service: 'http', severity: 'medium', desc: 'Authentication endpoint permits unlimited attempts.' },
  { name: 'S3-style bucket listing', service: 'https', severity: 'high', desc: 'Object storage bucket permits anonymous listing.' },
  { name: 'Exposed database port', service: 'mysql', severity: 'high', desc: 'Database accepts connections from the public interface.' },
  { name: 'Stale DNS zone transfer', service: 'domain', severity: 'medium', desc: 'AXFR is permitted from arbitrary clients.' },
  { name: 'Weak session tokens', service: 'http', severity: 'medium', desc: 'Session identifiers are sequential and long-lived.' },
  { name: 'Unrestricted VNC', service: 'vnc', severity: 'critical', desc: 'Remote desktop has no authentication layer.' }
];
export const DOMAIN_WORDS = ['north','quiet','hollow','amber','signal','lattice','cinder','harbor','drift','paper','copper','violet','static','meridian','orbit','willow','granite','tidal','mosaic','ember','glass','nomad','field','cobalt','harbor','pale','sable','river','atlas','lumen','basalt','moth','syntax','relay','delta','vertex','foundry','kite','spool','tessera'];
export const TLDS = ['.net','.io','.dev','.com','.org','.cloud','.host','.media','.studio','.ai'];
export const SITE_CATEGORIES = ['personal blog','company','community','news','marketplace','documentation','portfolio','forum','tool','research'];
export const FORUM_DEFS = [
  {
    name: 'NullNet /general', domain: 'portal.nullnet', kind: 'community', members: 8420,
    desc: 'The public square of the community network. Slow, strange, occasionally useful.',
    threads: [
      { title: 'Welcome to NullNet — read this first', author: 'relay', pinned: true, posts: [
        'The network is a shared resource. Do not make it worse.',
        'Rules: no real-world targeting, no doxxing, no automated abuse. Everything here is simulated; keep it that way.',
        'If you find something broken, report it. If you find something interesting, write it up.'
      ]},
      { title: 'What is your lab setup right now?', author: 'kernel', posts: [
        'Two rescued thinkcentres, a managed switch with noisy fans, and a UPS that complains every storm.',
        'One laptop and a lot of confidence. Mostly the laptop.',
        'A single VPS and a spreadsheet of things I keep meaning to self-host.'
      ]},
      { title: 'Contract board etiquette', author: 'hex', posts: [
        'Read the objective before accepting. A contract is a promise, not a vibe.',
        'Also: if you cannot deliver, say so early. Reputation compounds in both directions.',
        'And do not accept work you intend to complete with someone else\'s credentials.'
      ]}
    ]
  },
  {
    name: '0x00 / underground', domain: 'blackmarket.onion', kind: 'underground', members: 2310,
    desc: 'Access, data, and things that should probably stay buried.',
    threads: [
      { title: 'Anyone tested the Acme customer portal?', author: 'v0id', posts: [
        'Heard the staging host is reachable from the edge. No idea if it is still alive.',
        'It answers. Make of that what you will.',
        'Do not post coordinates in the open. Some of us have contracts.'
      ]},
      { title: 'Selling access: legacy.oldco.net', author: 'ghost', posts: [
        'Old box, low security, probably nothing valuable. Starting price is a joke.',
        'Nothing valuable is how they get you.',
        'If it is still up next week I will take it for the archive alone.'
      ]},
      { title: 'OPSEC thread / 2026', author: 'onyx', posts: [
        'Assume every log is retained. Assume every proxy is watched. Assume the person buying is also selling.',
        'The only reliable opsec is not needing the money.',
        'That is a luxury, not a strategy.'
      ]}
    ]
  },
  {
    name: 'Sysadmin / field notes', domain: 'portal.nullnet', kind: 'professional', members: 5140,
    desc: 'Operational reality, postmortems, and requests for help at 03:00.',
    threads: [
      { title: 'Legacy migration without a maintenance window', author: 'lumen', posts: [
        'We have a 20-year-old industrial controller that cannot be rebooted. Ever. Suggestions welcome.',
        'Wrap it. Monitor it. Do not touch it. Build the replacement around it.',
        'This is the correct answer and I hate it.'
      ]},
      { title: 'Backups that have never been restored', author: 'relay', posts: [
        'A backup is a hypothesis. A restore is the experiment.',
        'We test quarterly. It has caught two broken jobs and one expired certificate.',
        'Add the certificate to the runbook. It is always the certificate.'
      ]}
    ]
  },
  {
    name: 'Signal / sources', domain: 'signalreview.media', kind: 'media', members: 1830,
    desc: 'Tips, documents, and conversations about infrastructure accountability.',
    threads: [
      { title: 'What happened at OldCo?', author: 'mirage', posts: [
        'Customers were migrated. Some data was not. The company says the matter is closed.',
        'The old status page is still up, which is either negligence or a clue.',
        'If you have documentation, use the encrypted drop. Do not email me from a work account.'
      ]},
      { title: 'The quiet market for uptime', author: 'mirage', posts: [
        'Everyone sells reliability until reliability becomes expensive.',
        'The interesting question is who pays for the difference.'
      ]}
    ]
  },
  {
    name: 'Helix / research', domain: 'helixlabs.io', kind: 'research', members: 960,
    desc: 'Preprints, replication attempts, and careful arguments.',
    threads: [
      { title: 'Project Icarus: replication notes', author: 'hex', posts: [
        'The paper is out. The artifact is not, for reasons that are mostly legal.',
        'I reproduced the first two experiments. The third depends on data we no longer have.',
        'That is not a failure. That is a finding.'
      ]},
      { title: 'Peer review is a distributed system', author: 'n0va', posts: [
        'It has Byzantine failures, unbounded latency, and no clear owner.',
        'And yet it is still better than nothing.'
      ]}
    ]
  },
  {
    name: 'Market / contractors', domain: 'market.nullnet', kind: 'market', members: 3610,
    desc: 'Work, rates, and the occasional warning about a client.',
    threads: [
      { title: 'Rate check: security audit, mid-size SaaS', author: 'onyx', posts: [
        'Scope is a two-week review, one web app, no physical. What are people charging?',
        'Depends on whether the report needs to survive a regulator. Double it if it does.',
        'I quoted 6k and lost it to someone quoting 2k. The report was worth 2k.'
      ]},
      { title: 'Client did not pay — what now?', author: 'pixel', posts: [
        'Small contract, clear deliverable, invoice ignored for 40 days.',
        'Public reputation is the only leverage most of us have. Use it precisely.',
        'Also: milestone payments. Always milestone payments.'
      ]}
    ]
  },
  {
    name: 'Cinder / internal', domain: 'cinderfreight.com', kind: 'corporate', members: 420,
    desc: 'Staff forum. Access is scoped to Cinder employees.',
    threads: [
      { title: 'Warehouse telemetry latency', author: 'lumen', posts: [
        'The new collectors are batching too aggressively. Dashboards are 90 seconds behind.',
        'Ninety seconds is fine for management and useless for operations.',
        'Agreed. Tuning the flush interval today.'
      ]}
    ]
  },
  {
    name: 'Archive / dead links', domain: 'oldco.net', kind: 'archive', members: 290,
    desc: 'A read-only board left running after the company moved on.',
    threads: [
      { title: 'Migration status (2019)', author: 'admin', posts: [
        'All customer accounts have been notified. Remaining infrastructure will be decommissioned by Q3.',
        'Update: decommission delayed. See ticket OPS-114.',
        'Update: see you on the other side.'
      ]}
    ]
  }
];

export const NEWS_SOURCES = ['NullNet Wire', 'The Packet', 'Signal Review', 'Byte Ledger', 'Dark Fiber', 'Basalt Status'];
export const NEWS_TEMPLATES = [
  '{company} reports a {pct}% increase in edge traffic after a routing change.',
  'A maintenance window at {company} overran by {mins} minutes; no customer data was affected, the company says.',
  'Researchers at {company} published a note on {topic}. The artifact is not public.',
  '{npc} is asking for help tracing an unexpected authentication spike.',
  'A stale DNS record briefly redirected traffic for {domain} to an unrelated host.',
  '{company} has acquired the remnants of a smaller hosting provider for an undisclosed sum.',
  'The contract board at market.nullnet lists {n} new openings this cycle.',
  'An abandoned server at {ip} is still answering requests. Its owner has not commented.',
  'A leaked configuration file appears to belong to {company}. The company says it is investigating.',
  '{npc} published a short writeup on {topic}. It is being passed around quietly.',
  'Transit latency between two major regions rose sharply for {mins} minutes before recovering.',
  'A domain registrar suspended {n} names after a wave of automated abuse reports.',
  '{company} is hiring for a {role}. The listing emphasizes "calm under pressure."',
  'A public git repository was found to contain a deployment token. It has since been rotated.',
  'The market index moved {pct}% this cycle, driven mostly by hosting and security contracts.',
  'A small community network reported an unusual burst of port scans from a single residential address.',
  '{npc} says the hardest part of incident response is convincing people to stop typing.',
  'An old backup tape was found in a data center. Nobody knows what is on it.',
  'A security advisory warns of a flaw in a widely used file upload library. Patches are available.',
  '{company} says its new status page is "more honest." Customers remain skeptical.'
];
export const TOPICS = ['protocol design','supply chain risk','rate limiting','DNS hygiene','incident communication','data retention','backup verification','access control','latency budgets','passwordless auth','observability','legacy migration'];
export const CONTRACT_TEMPLATES = [
  { title: 'Perimeter scan and inventory', type: 'scan', desc: 'Enumerate exposed services on the target host and return a clean inventory.', tags: ['recon','network'], difficulty: 1, base: 260 },
  { title: 'Vulnerability audit', type: 'audit', desc: 'Audit the target for exploitable issues. Evidence beats speculation.', tags: ['audit','security'], difficulty: 3, base: 900 },
  { title: 'Harden exposed services', type: 'patch', desc: 'Close the known exposure on the target and verify the fix from outside.', tags: ['defense','ops'], difficulty: 3, base: 1200 },
  { title: 'Build a landing page', type: 'code', desc: 'Deliver a small, fast static site in the provided project directory.', tags: ['web','code'], difficulty: 2, base: 620 },
  { title: 'Write an automation script', type: 'code', desc: 'Automate the client workflow with a documented script that runs cleanly.', tags: ['python','automation'], difficulty: 2, base: 540 },
  { title: 'Deploy a public mirror', type: 'deploy', desc: 'Publish a site on your own infrastructure and keep it reachable for a cycle.', tags: ['hosting','deploy'], difficulty: 1, base: 380 },
  { title: 'Incident triage', type: 'audit', desc: 'Review the target for signs of unauthorized access and produce a timeline.', tags: ['forensics','security'], difficulty: 4, base: 1600 },
  { title: 'Recover legacy data', type: 'exploit', desc: 'Retrieve the named archive from the abandoned host. Handle it carefully.', tags: ['recovery','access'], difficulty: 3, base: 1100 },
  { title: 'Database performance review', type: 'audit', desc: 'Profile the database, identify the slow query, and recommend an index.', tags: ['database','ops'], difficulty: 3, base: 880 },
  { title: 'Network monitor prototype', type: 'code', desc: 'Build a small monitor that checks a host list and reports reachability.', tags: ['python','network'], difficulty: 3, base: 760 },
  { title: 'Phishing campaign analysis', type: 'audit', desc: 'Trace the campaign infrastructure and identify the hosting provider.', tags: ['security','analysis'], difficulty: 4, base: 1450 },
  { title: 'DNS migration', type: 'patch', desc: 'Move the client zone to a new provider without dropping resolution.', tags: ['dns','ops'], difficulty: 3, base: 950 },
  { title: 'API authentication review', type: 'audit', desc: 'Review token handling and session lifecycle on the target API.', tags: ['appsec','api'], difficulty: 4, base: 1320 },
  { title: 'Community infrastructure help', type: 'patch', desc: 'Help the collective recover a degraded public service.', tags: ['community','ops'], difficulty: 2, base: 420 }
];
export const SHOP_ITEMS = [
  { id: 'vps-micro', name: 'VPS / micro', price: 28, kind: 'infra', desc: '1 vCPU, 1 GB RAM, 20 GB SSD. A small place to put something real.', specs: '1 vCPU · 1GB · 20GB', recurring: true, server: { cpu: 1, ram: 1, disk: 20, ip: '198.51.100.210' } },
  { id: 'vps-std', name: 'VPS / standard', price: 75, kind: 'infra', desc: '2 vCPU, 4 GB RAM, 80 GB SSD. Comfortable for a small service.', specs: '2 vCPU · 4GB · 80GB', recurring: true, server: { cpu: 2, ram: 4, disk: 80, ip: '198.51.100.211' } },
  { id: 'vps-dedicated', name: 'Dedicated node', price: 220, kind: 'infra', desc: '8 vCPU, 32 GB RAM, 480 GB NVMe. Own the whole machine.', specs: '8 vCPU · 32GB · 480GB', recurring: true, server: { cpu: 8, ram: 32, disk: 480, ip: '198.51.100.212' } },
  { id: 'domain', name: 'Domain registration', price: 18, kind: 'infra', desc: 'Register a .net or .dev name for one year. DNS is included.', specs: '1 year · DNS', recurring: false },
  { id: 'proxy', name: 'Rotating proxy', price: 45, kind: 'tool', desc: 'Reduces trace exposure on noisy operations. Not a license to be careless.', specs: '30 days · 5 exits', recurring: true },
  { id: 'vpn', name: 'Privacy VPN', price: 12, kind: 'tool', desc: 'Encrypts your local egress and lowers passive heat gain.', specs: '30 days · 12 regions', recurring: true },
  { id: 'ids', name: 'IDS appliance', price: 340, kind: 'tool', desc: 'Adds intrusion detection to an owned server. Raises defense permanently.', specs: '+12 security', recurring: false },
  { id: 'course', name: 'Advanced offensive lab', price: 260, kind: 'training', desc: 'Structured practice. Raises technical skill by 1.', specs: '+1 skill', recurring: false },
  { id: 'forensics', name: 'Forensics toolkit', price: 190, kind: 'tool', desc: 'Disk and memory analysis utilities. Improves audit and incident work.', specs: '+audit quality', recurring: false },
  { id: 'gpu', name: 'Cracking rig (shared)', price: 900, kind: 'tool', desc: 'Borrowed compute for password recovery. Faster brute force, more heat.', specs: 'brute force+', recurring: false },
  { id: 'backup', name: 'Offsite backup', price: 22, kind: 'service', desc: 'Daily encrypted snapshots for your infrastructure.', specs: '30 days · 100GB', recurring: true },
  { id: 'monitor', name: 'Uptime monitor', price: 16, kind: 'service', desc: 'External checks every minute. Alerts you before clients do.', specs: '5 checks · 30 days', recurring: true }
];
export const ACHIEVEMENTS = [
  { id: 'boot', name: 'First Light', desc: 'Boot the workstation and enter the network.' },
  { id: 'scan', name: 'Cartographer', desc: 'Complete your first network scan.' },
  { id: 'shell', name: 'Remote Hands', desc: 'Obtain a shell on a remote system.' },
  { id: 'contract', name: 'Delivered', desc: 'Complete your first contract.' },
  { id: 'deploy', name: 'Landlord', desc: 'Publish a site on infrastructure you own.' },
  { id: 'paid', name: 'First Thousand', desc: 'Earn $1,000 from your digital work.' },
  { id: 'patch', name: 'Defender', desc: 'Patch a known vulnerability on a live system.' },
  { id: 'reputation', name: 'Known Quantity', desc: 'Reach 50 reputation.' },
  { id: 'network', name: 'Builder', desc: 'Own three or more servers.' },
  { id: 'clean', name: 'Ghost', desc: 'Complete a contract with zero heat.' },
  { id: 'reader', name: 'Correspondent', desc: 'Exchange mail with five different people.' },
  { id: 'news', name: 'Chronicler', desc: 'Read the network news ten times.' }
];
export const EMAIL_SUBJECTS = [
  'quick question about the deployment', 'following up on the audit', 'strange login attempts',
  'can you take a look at this?', 'contract scope clarification', 'a small favor',
  're: the oldco box', 'infrastructure quote', 'hello from the contract board',
  'something is wrong with our DNS', 're: your post on the forum', 'availability next cycle'
];
export const EMAIL_BODIES = [
  'I saw your profile on the contract board. Are you available for a short engagement? Scope is small, but the timeline is real.\n\n— {name}',
  'The issue is reproducible from outside the network. I have attached nothing because I do not trust attachments.\n\nCan you take a look?\n\n— {name}',
  'We are seeing authentication attempts from an address we do not recognize. Probably nothing. Probably.\n\nIf you have time, I would value a second opinion.\n\n— {name}',
  'Your name came up in a conversation about careful work. I need careful work.\n\nReply with your rate and availability.\n\n— {name}',
  'The oldco migration left more behind than the status page admits. I am trying to find out what.\n\nOff the record, for now.\n\n— {name}',
  'I read your note. It was useful. I have a follow-up question that is better asked in person, or at least in a terminal.\n\n— {name}'
];
export const SERVICE_NAMES = [
  'web frontend', 'customer portal', 'internal wiki', 'mail relay', 'backup target', 'CI runner',
  'staging API', 'metrics collector', 'database primary', 'database replica', 'asset store', 'status page',
  'VPN concentrator', 'DNS resolver', 'jump host', 'build cache', 'log archive', 'payment worker'
];
export const MAINT_NOTES = [
  'Scheduled kernel update completed. Reboot deferred to the next window.',
  'Certificate renewed. Old certificate revoked.',
  'Disk usage crossed 80%; log rotation adjusted.',
  'A stale cron job was removed after it began mailing errors every minute.',
  'Backup verification passed. Restore test remains outstanding.',
  'Anomalous login blocked by rate limiting. Source reported to the provider.',
  'Upstream package mirror changed. APT sources updated.',
  'Memory pressure resolved after a worker was restarted.',
  'Firewall rule tightened after an unexpected scan.',
  'A decommissioned service was finally removed from DNS.'
];
