/* Modern internet architecture layer.

   Models autonomous systems, exchange points, submarine/terrestrial links,
   data centers, protocol adoption, the web (DNS/TLS/CDN/APIs), developer
   ecosystems, AI infrastructure, security advisories and social platforms.

   This module is deterministic and bounded. It never imports world.js; the
   world tick applies the feed/news/mail descriptors returned by tickInternet. */
import { makeRng, clamp, fmtMoney, fmtNum, hash32 } from './util.js';
import { AGENT_MODELS, VULN_TYPES } from './data.js';

export const INTERNET_VERSION = 1;
const DAY = 1440;
const YEAR = 365 * DAY;

export const NET_CAPS = Object.freeze({
  asns: 96, ixps: 28, cables: 32, datacenters: 90, protocols: 80, web: 260,
  apis: 280, certs: 280, packages: 280, builds: 120, ci: 90, releases: 140,
  deployments: 140, models: 110, endpoints: 140, training: 48, advisories: 180,
  incidents: 140, platforms: 48, history: 280, events: 200
});

const PROTOCOL_SEEDS = [
  ['fiber', 'Fiber transport', 'physical', 'ITU-T G.652', 'standard', 96, 88, 96, 'Single-mode fibre carrying the majority of long-haul traffic.'],
  ['submarine', 'Submarine cable systems', 'physical', 'SDM / repeatered', 'standard', 88, 74, 90, 'Repeatered submarine links connect continents; faults take days to repair.'],
  ['cellular-5g', '5G cellular', 'physical', '3GPP Release 17', 'standard', 82, 71, 84, 'Mobile access with network slicing and lower last-mile latency.'],
  ['wifi-6e', 'Wi-Fi 6E', 'physical', 'IEEE 802.11ax', 'standard', 76, 67, 80, '6 GHz access for homes and offices.'],
  ['satellite', 'Satellite access', 'physical', 'LEO Ka/Ku', 'emerging', 42, 58, 54, 'Low-earth-orbit access where fibre is uneconomic.'],
  ['ipv4', 'IPv4', 'network', 'RFC 791', 'legacy', 100, 72, 74, 'Still universal, increasingly carried through NAT and transition mechanisms.'],
  ['ipv6', 'IPv6', 'network', 'RFC 8200', 'standard', 54, 82, 86, 'Native addressing and simpler routing; adoption remains uneven.'],
  ['tcp', 'TCP', 'transport', 'RFC 9293', 'standard', 98, 80, 82, 'Reliable ordered transport for most application protocols.'],
  ['udp', 'UDP', 'transport', 'RFC 768', 'standard', 94, 66, 94, 'Connectionless datagrams; modern transports build reliability on top.'],
  ['quic', 'QUIC', 'transport', 'RFC 9000', 'standard', 61, 86, 92, 'Encrypted multiplexed transport with faster connection setup.'],
  ['bgp', 'BGP-4', 'routing', 'RFC 4271', 'standard', 100, 57, 76, 'Policy routing between autonomous systems.'],
  ['rpki', 'RPKI', 'routing', 'RFC 6480', 'standard', 47, 84, 70, 'Cryptographic origin validation for BGP announcements.'],
  ['dns', 'DNS', 'naming', 'RFC 1035', 'standard', 100, 74, 88, 'The global name system; every web request depends on it.'],
  ['dnssec', 'DNSSEC', 'naming', 'RFC 4033', 'standard', 38, 90, 74, 'Signed DNS zones reduce cache poisoning and spoofing.'],
  ['dhcp', 'DHCP', 'network', 'RFC 2131', 'standard', 92, 61, 76, 'Automatic address assignment for local networks.'],
  ['nat', 'NAT', 'network', 'RFC 3022', 'standard', 97, 54, 68, 'Address translation conserves IPv4 but complicates peer-to-peer traffic.'],
  ['vpn', 'VPN tunnels', 'network', 'WireGuard / IPsec', 'standard', 66, 86, 78, 'Encrypted overlays for remote access and site links.'],
  ['anycast', 'Anycast routing', 'network', 'BGP anycast', 'standard', 72, 80, 92, 'The same address served from many locations for resilience and low latency.'],
  ['http1', 'HTTP/1.1', 'web', 'RFC 9112', 'legacy', 88, 58, 62, 'Request/response text protocol; still common on older origins.'],
  ['http2', 'HTTP/2', 'web', 'RFC 9113', 'standard', 79, 78, 84, 'Binary multiplexed HTTP with header compression.'],
  ['http3', 'HTTP/3', 'web', 'RFC 9114', 'standard', 48, 88, 94, 'HTTP over QUIC; avoids head-of-line blocking on lossy links.'],
  ['tls12', 'TLS 1.2', 'security', 'RFC 5246', 'legacy', 74, 72, 70, 'Still widely deployed; increasingly treated as a compatibility floor.'],
  ['tls13', 'TLS 1.3', 'security', 'RFC 8446', 'standard', 84, 94, 92, 'Modern TLS with a smaller handshake and fewer legacy options.'],
  ['websocket', 'WebSocket', 'web', 'RFC 6455', 'standard', 73, 68, 84, 'Persistent bidirectional channels for interactive services.'],
  ['webrtc', 'WebRTC', 'web', 'W3C / IETF', 'standard', 58, 82, 86, 'Real-time audio, video and data channels between peers.'],
  ['webtransport', 'WebTransport', 'web', 'W3C / IETF', 'emerging', 19, 84, 89, 'QUIC-based transport for browser applications.'],
  ['rest', 'REST APIs', 'api', 'Fielding / HTTP', 'standard', 91, 70, 80, 'Resource-oriented HTTP interfaces with broad tooling.'],
  ['graphql', 'GraphQL', 'api', 'GraphQL spec', 'standard', 46, 64, 76, 'Typed query language; flexible clients, harder caching.'],
  ['grpc', 'gRPC', 'api', 'HTTP/2 + protobuf', 'standard', 38, 78, 90, 'Contract-first RPC with streaming and efficient encoding.'],
  ['oauth2', 'OAuth 2.1', 'identity', 'RFC 6749 / extensions', 'standard', 79, 81, 74, 'Delegated authorization for third-party clients.'],
  ['oidc', 'OpenID Connect', 'identity', 'OpenID Connect 1.0', 'standard', 64, 84, 78, 'Identity layer on OAuth with signed ID tokens.'],
  ['webauthn', 'WebAuthn / passkeys', 'identity', 'W3C WebAuthn L3', 'emerging', 33, 94, 82, 'Phishing-resistant authentication bound to devices.'],
  ['smtp', 'SMTP', 'mail', 'RFC 5321', 'standard', 96, 50, 66, 'Store-and-forward mail transfer; still the global email backbone.'],
  ['imap', 'IMAP', 'mail', 'RFC 9051', 'standard', 82, 58, 64, 'Synchronized mailbox access for mail clients.'],
  ['activitypub', 'ActivityPub', 'social', 'W3C Recommendation', 'emerging', 27, 66, 72, 'Federated social networking between independent servers.'],
  ['matrix', 'Matrix', 'social', 'Matrix spec', 'emerging', 22, 79, 74, 'Federated real-time messaging and state.'],
  ['git', 'Git protocol', 'development', 'git v2', 'standard', 92, 77, 78, 'Distributed version control over dumb and smart transports.'],
  ['wasm', 'WebAssembly', 'development', 'W3C core spec', 'standard', 44, 83, 94, 'Portable compilation target for browser and edge runtimes.'],
  ['containers', 'OCI containers', 'development', 'OCI runtime spec', 'standard', 81, 78, 82, 'Standardized images and isolation for deployment.'],
  ['kubernetes', 'Kubernetes API', 'development', 'CNCF', 'standard', 56, 72, 72, 'Declarative container orchestration at scale.'],
  ['rag', 'Retrieval-augmented generation', 'ai', 'application pattern', 'emerging', 41, 68, 70, 'Grounds model output in retrieved documents and vectors.'],
  ['vector-db', 'Vector databases', 'ai', 'HNSW / IVF indexes', 'emerging', 38, 72, 78, 'Approximate nearest-neighbour search over embeddings.'],
  ['mcp', 'Model Context Protocol', 'ai', 'open specification', 'emerging', 17, 70, 76, 'Structured tool and context access for AI clients.']
];

const PACKAGE_SEEDS = [
  ['express','javascript','npm','4.21.2','Minimal HTTP web framework.',48200000,'MIT',['http']],
  ['react','javascript','npm','19.1.0','Component library for user interfaces.',39100000,'MIT',[]],
  ['vue','javascript','npm','3.5.13','Progressive frontend framework.',11800000,'MIT',[]],
  ['vite','javascript','npm','6.2.0','Fast frontend build tool.',14300000,'MIT',['esbuild','rollup']],
  ['typescript','typescript','npm','5.8.2','Typed superset of JavaScript.',27400000,'Apache-2.0',[]],
  ['eslint','javascript','npm','9.22.0','Static analysis for JavaScript.',18900000,'MIT',[]],
  ['zod','typescript','npm','3.24.2','TypeScript-first schema validation.',9800000,'MIT',[]],
  ['fastify','javascript','npm','5.2.1','Low-overhead Node web framework.',4200000,'MIT',[]],
  ['better-sqlite3','javascript','npm','11.8.1','Synchronous SQLite bindings.',3100000,'MIT',['sqlite']],
  ['requests','python','pypi','2.32.3','HTTP library for Python.',228000000,'Apache-2.0',['urllib3']],
  ['flask','python','pypi','3.1.0','Small WSGI web application framework.',71000000,'BSD-3-Clause',['werkzeug']],
  ['django','python','pypi','5.1.6','Batteries-included web framework.',28400000,'BSD-3-Clause',['asgiref']],
  ['numpy','python','pypi','2.2.3','Array and numerical computing.',198000000,'BSD-3-Clause',[]],
  ['pandas','python','pypi','2.2.3','Tabular data analysis.',164000000,'BSD-3-Clause',['numpy']],
  ['pytest','python','pypi','8.3.5','Testing framework for Python.',96000000,'MIT',[]],
  ['sqlalchemy','python','pypi','2.0.38','SQL toolkit and ORM.',64000000,'MIT',[]],
  ['pydantic','python','pypi','2.10.6','Data validation using type hints.',71000000,'MIT',[]],
  ['cryptography','python','pypi','44.0.1','Cryptographic primitives for Python.',48000000,'Apache-2.0',[]],
  ['tokio','rust','crates.io','1.43.0','Asynchronous runtime for Rust.',31000000,'MIT',[]],
  ['serde','rust','crates.io','1.0.218','Serialization framework for Rust.',42000000,'MIT',['serde_derive']],
  ['axum','rust','crates.io','0.8.1','Ergonomic Rust web framework.',12400000,'MIT',['tokio']],
  ['clap','rust','crates.io','4.5.31','Command-line argument parser.',27000000,'MIT',[]],
  ['gin','go','go.dev','1.10.0','HTTP web framework for Go.',18800000,'MIT',[]],
  ['cobra','go','go.dev','1.9.1','CLI framework for Go.',14000000,'Apache-2.0',[]],
  ['pq','go','go.dev','1.10.9','PostgreSQL driver for Go.',9200000,'MIT',[]],
  ['openssl','c','system','3.4.1','TLS and cryptography toolkit.',0,'Apache-2.0',[]],
  ['sqlite','c','system','3.49.1','Embedded relational database.',0,'Public Domain',[]],
  ['curl','c','system','8.12.1','Command-line URL transfer tool.',0,'curl',['openssl']],
  ['zlib','c','system','1.3.1','Compression library.',0,'Zlib',[]],
  ['nginx','c','system','1.27.4','HTTP server and reverse proxy.',0,'BSD-2-Clause',['openssl','zlib']],
  ['docker','go','system','27.5.1','Container runtime and image tooling.',0,'Apache-2.0',[]],
  ['postgresql','c','system','17.4','Relational database server.',0,'PostgreSQL',[]],
  ['redis','c','system','7.4.2','In-memory data store.',0,'BSD-3-Clause',[]],
  ['git','c','system','2.48.1','Distributed version control.',0,'GPL-2.0',['zlib']],
  ['llama-cpp','cpp','system','0.4.7','Local LLM inference runtime.',0,'MIT',[]],
  ['onnx-runtime','cpp','system','1.21.0','Cross-platform inference runtime.',0,'MIT',[]],
  ['tensorflow','python','pypi','2.18.0','Machine learning platform.',31000000,'Apache-2.0',['numpy']],
  ['pytorch','python','pypi','2.6.0','Tensor and neural network library.',44000000,'BSD-3-Clause',[]],
  ['transformers','python','pypi','4.49.0','Pretrained model toolkit.',52000000,'Apache-2.0',['pytorch']],
  ['pgvector','c','system','0.8.0','Vector similarity extension for PostgreSQL.',0,'PostgreSQL',['postgresql']],
  ['qdrant','rust','crates.io','1.13.4','Vector search engine.',0,'Apache-2.0',['tokio']],
  ['prometheus','go','go.dev','3.2.1','Metrics collection and alerting.',0,'Apache-2.0',[]],
  ['grafana','go','system','11.5.2','Observability dashboards.',0,'AGPL-3.0',[]]
];

const SOCIAL_SEEDS = [
  ['nullnet', 'NullNet Boards', 'forum', 184000, 61, 'http', 'The oldest public technical board in the simulation.'],
  ['wire', 'The Wire', 'microblog', 12400000, 48, 'activitypub', 'Fast, argumentative public timeline.'],
  ['signal-review', 'Signal Review', 'news', 2400000, 69, 'http', 'Investigative technology reporting with a corrections desk.'],
  ['devhub', 'DevHub', 'professional', 6900000, 66, 'http', 'Professional profiles, repositories and hiring.'],
  ['packet', 'Packet', 'messaging', 21000000, 71, 'matrix', 'Federated messaging with end-to-end encryption.'],
  ['local-loop', 'Local Loop', 'community', 980000, 64, 'activitypub', 'Neighbourhood and municipal infrastructure discussions.'],
  ['bench', 'The Bench', 'developer', 1300000, 73, 'http', 'Code review, benchmarks and long-form technical threads.'],
  ['afterimage', 'Afterimage', 'video', 18800000, 43, 'http', 'Short and long video with algorithmic distribution.'],
  ['quiet', 'Quiet', 'private', 420000, 78, 'matrix', 'Invite-only rooms for small teams and collectives.'],
  ['commons', 'Commons', 'federated', 7600000, 59, 'activitypub', 'Federated publishing, communities and shared archives.'],
  ['market-wire', 'Market Wire', 'finance', 3100000, 55, 'http', 'Markets, filings and infrastructure finance.'],
  ['civic', 'Civic Record', 'government', 1200000, 74, 'http', 'Public notices, procurement and regulatory filings.']
];

const HISTORY_SEEDS = [
  [1969, 'infrastructure', 'ARPANET carries its first host-to-host message', 'A two-node experiment becomes the ancestor of a global network.'],
  [1983, 'infrastructure', 'TCP/IP becomes the common internet protocol', 'Independent networks begin to interoperate under one address family.'],
  [1985, 'infrastructure', 'The domain name system is deployed', 'Names become stable, hierarchical and independent of host files.'],
  [1991, 'web', 'The World Wide Web enters public use', 'Hypertext, URLs and browsers turn the network into a publishing platform.'],
  [1998, 'business', 'Search becomes an industry', 'Indexing the open web creates one of the largest advertising markets.'],
  [2008, 'cloud', 'Public cloud infrastructure reaches general availability', 'Compute becomes a metered utility rather than owned hardware.'],
  [2013, 'security', 'TLS deployment accelerates after disclosure of mass interception', 'Encrypted transport becomes the default expectation for public services.'],
  [2015, 'development', 'Container images standardize deployment', 'Applications ship with their runtime, reducing environment drift.'],
  [2018, 'security', 'Coordinated vulnerability disclosure becomes routine', 'Security advisories, SBOMs and patch windows enter normal operations.'],
  [2020, 'society', 'Remote work reshapes network demand', 'Traffic shifts from central offices to residential access networks.'],
  [2022, 'development', 'WebAssembly leaves the browser', 'The same compiled modules run at the edge and in serverless runtimes.'],
  [2024, 'ai', 'Retrieval-augmented applications become mainstream', 'Vector search and tool use make model output more grounded.'],
  [2025, 'security', 'Passkeys reach broad consumer adoption', 'Phishing-resistant authentication begins replacing shared secrets.']
];

const MODEL_SEEDS = [
  ['lumen-8b','Lumen','open','8B','text',32768,74,0,'apache-2.0'],
  ['lumen-70b','Lumen','open','70B','text',65536,84,0,'apache-2.0'],
  ['atlas-4','Atlas','hosted','400B','text',200000,91,7,'proprietary'],
  ['atlas-4-mini','Atlas','hosted','24B','text',128000,82,1,'proprietary'],
  ['northwind-coder','Northwind','hosted','32B','code',131072,87,3,'proprietary'],
  ['kestrel-7b','Kestrel','open','7B','text',32768,68,0,'mit'],
  ['orion-vision','Orion','hosted','18B','multimodal',65536,79,4,'proprietary'],
  ['sable-embed','Sable','open','0.6B','embedding',8192,72,0,'mit'],
  ['quiet-whisper','Quiet','open','1.5B','audio',4096,66,0,'mit'],
  ['forge-image','Forge','hosted','12B','image',2048,76,5,'proprietary']
];

const ISSUERS = ['Harbor PKI', 'NullNet Trust', 'Meridian Certificate Authority', 'Open Roots', 'Civic Signing Service'];
const REGISTRIES = ['npm', 'pypi', 'crates.io', 'go.dev', 'system'];
const TLS_VERSIONS = ['TLS 1.2', 'TLS 1.3', 'TLS 1.3', 'TLS 1.3'];

function netRng(game, salt = 0) {
  return makeRng((game.seed ^ Math.floor((game.worldMinutes || 0) * 2246822519) ^ ((game.tickCount || 0) * 97) ^ salt) >>> 0);
}
function nextId(net, prefix) {
  net.seq = net.seq || {};
  net.seq[prefix] = (net.seq[prefix] || 0) + 1;
  return `${prefix}-${String(net.seq[prefix]).padStart(4, '0')}`;
}
function bounded(arr, cap) { if (Array.isArray(arr) && arr.length > cap) arr.splice(0, arr.length - cap); return arr; }
function pickWeighted(rng, items, weightFn) {
  if (!items.length) return null;
  const weights = items.map(x => Math.max(0.0001, weightFn(x)));
  let roll = rng.next() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < items.length; i++) { roll -= weights[i]; if (roll <= 0) return items[i]; }
  return items[items.length - 1];
}
function netYear(net) { return 2026 + Math.floor(((net.worldMinutes || 0) - 552) / YEAR); }
function money(n) { return Math.round(Number(n) || 0); }
function charge(game, amount, memo) {
  const cost = Math.max(0, Math.round(amount));
  if (cost > game.player.money) return false;
  game.player.money -= cost;
  game.stats.spent += cost;
  game.player.transactions.unshift({ time: Date.now(), amount: -cost, memo, balance: game.player.money });
  return true;
}
function emitPlayerFeed(game, text, kind = 'info') {
  if (typeof game.playerFeed === 'function') game.playerFeed(text, kind);
}
function recordHistory(net, category, title, body, opts = {}) {
  net.history.push({
    id: nextId(net, 'nethist'), world: net.worldMinutes, year: opts.year || netYear(net),
    category, title, body, actors: opts.actors || [], countryId: opts.countryId || null,
    major: !!opts.major
  });
  bounded(net.history, NET_CAPS.history);
}
function event(net, category, title, body, opts = {}) {
  net.events.push({
    id: nextId(net, 'netevent'), category, title, body,
    severity: opts.severity || 'minor', status: 'active',
    startedWorld: net.worldMinutes, resolvedWorld: null,
    targetId: opts.targetId || null, countryId: opts.countryId || null
  });
  bounded(net.events, NET_CAPS.events);
}
function advanceBucket(net, key, interval, world, max = 8) {
  if (!net.cadence) net.cadence = {};
  const bucket = Math.floor(world / interval);
  const prev = net.cadence[key] || 0;
  if (bucket <= prev) return 0;
  const steps = Math.min(max, bucket - prev);
  net.cadence[key] = prev + steps;
  return steps;
}

/* ---------------- build ---------------- */
export function ensureInternet(game) {
  if (!game.internet || typeof game.internet !== 'object' || !Array.isArray(game.internet.asns) || !game.internet.asns.length) {
    game.internet = buildInternet(game, makeRng((game.seed ^ 0x7e2026) >>> 0));
    return game.internet;
  }
  const net = game.internet;
  net.version = INTERNET_VERSION;
  net.worldMinutes = game.worldMinutes || 0;
  net.seq = net.seq || {};
  for (const key of ['asn','ixp','cable','dc','proto','web','api','cert','pkg','build','ci','release','deploy','model','endpoint','train','adv','incident','platform','nethist','netevent']) {
    if (typeof net.seq[key] !== 'number') net.seq[key] = 1;
  }
  for (const key of ['asns','ixps','cables','datacenters','protocols','apis','certs','packages','builds','ci','releases','deployments','advisories','incidents','platforms','history','events']) {
    if (!Array.isArray(net[key])) net[key] = [];
  }
  net.web = net.web && typeof net.web === 'object' ? net.web : { records: {}, lastCheckWorld: net.worldMinutes };
  net.web.records = net.web.records && typeof net.web.records === 'object' ? net.web.records : {};
  net.dev = net.dev || { languages: [], projects: [], registries: REGISTRIES.slice(), lastReleaseWorld: net.worldMinutes };
  for (const key of ['languages','projects']) if (!Array.isArray(net.dev[key])) net.dev[key] = [];
  net.dev.registries = Array.isArray(net.dev.registries) && net.dev.registries.length ? net.dev.registries : REGISTRIES.slice();
  net.ai = net.ai || { models: [], endpoints: [], training: [], vectorDbs: [], rag: [] };
  for (const key of ['models','endpoints','training','vectorDbs','rag']) if (!Array.isArray(net.ai[key])) net.ai[key] = [];
  net.security = net.security || { advisories: [], incidents: [], sboms: [], zeroTrust: { identity: 52, device: 46, network: 48, workload: 44, data: 50 } };
  net.security.advisories = net.security.advisories || [];
  net.security.incidents = net.security.incidents || [];
  net.security.sboms = net.security.sboms || [];
  net.security.zeroTrust = net.security.zeroTrust || { identity: 52, device: 46, network: 48, workload: 44, data: 50 };
  net.social = net.social || { platforms: [], lastGrowthWorld: net.worldMinutes };
  net.social.platforms = net.social.platforms || [];
  net.cadence = net.cadence || {};
  net.metrics = net.metrics || {};
  net.os = net.os || defaultOS(game);
  // Backfill web records for sites that appeared through growth or deployment.
  for (const site of game.sites || []) {
    if (!net.web.records[site.id]) net.web.records[site.id] = makeWebRecord(game, net, site, makeRng((game.seed ^ hash32(site.id)) >>> 0));
  }
  // Keep protocol and model registries current without replacing live values.
  const protocolIds = new Set(net.protocols.map(p => p.id));
  for (const seed of PROTOCOL_SEEDS) if (!protocolIds.has(seed[0])) net.protocols.push(makeProtocol(seed, makeRng((game.seed ^ hash32(seed[0])) >>> 0)));
  const packageNames = new Set(net.packages.map(p => `${p.registry}:${p.name}`));
  for (const seed of PACKAGE_SEEDS) if (!packageNames.has(`${seed[2]}:${seed[0]}`)) net.packages.push(makePackage(seed, makeRng((game.seed ^ hash32(seed[0])) >>> 0)));
  const modelIds = new Set(net.ai.models.map(m => m.id));
  for (const seed of MODEL_SEEDS) if (!modelIds.has(seed[0])) net.ai.models.push(makeModel(seed));
  for (const key of ['asns','ixps','cables','datacenters','protocols','apis','certs','packages','builds','ci','releases','deployments','advisories','incidents','platforms','history','events']) bounded(net[key], NET_CAPS[key] || 200);
  recomputeMetrics(game, net);
  return net;
}

function defaultOS(game) {
  const name = game.player?.host || 'voidbox';
  return {
    distro: 'NullNet Linux 4.2', kernel: '6.11.8-null', arch: 'x86_64',
    hostname: name, uptimeWorld: game.worldMinutes || 0, bootWorld: game.worldMinutes || 0,
    users: [{ name: 'operator', uid: 1000, groups: ['operator','sudo'], shell: '/bin/bash' }, { name: 'root', uid: 0, groups: ['root'], shell: '/bin/bash' }],
    services: [
      { name: 'sshd', status: 'running', enabled: true, port: 22, memoryMb: 12 },
      { name: 'systemd-resolved', status: 'running', enabled: true, port: 53, memoryMb: 9 },
      { name: 'chronyd', status: 'running', enabled: true, port: 123, memoryMb: 4 },
      { name: 'docker', status: 'stopped', enabled: false, port: null, memoryMb: 0 },
      { name: 'nullnet-agent', status: 'running', enabled: true, port: null, memoryMb: 18 }
    ],
    cron: [{ schedule: '0 3 * * *', command: '/usr/local/bin/backup-home', status: 'enabled' }],
    interfaces: [{ name: 'lo', address: '127.0.0.1/8', state: 'up' }, { name: 'eth0', address: `${game.player?.ip || '10.0.0.42'}/24`, state: 'up', gateway: game.player?.gateway || '10.0.0.1' }],
    limits: { cpu: 8, memoryMb: 16384, diskGb: 512 },
    packages: ['bash','coreutils','python3','gcc','git','curl','sqlite3','nginx','docker','nodejs'],
    logs: [{ world: game.worldMinutes || 0, level: 'info', unit: 'systemd', text: 'Boot completed.' }]
  };
}

function makeProtocol(seed, rng) {
  const [id, name, layer, spec, status, adoption, security, performance, notes] = seed;
  return {
    id, name, layer, spec, status, adoption, security, performance,
    baselineAdoption: adoption, baselineSecurity: security,
    implementations: rng.picks(['open-source reference','vendor stack','browser engine','operating system','edge appliance','cloud gateway'], rng.int(2, 4)),
    notes, updatedWorld: 0, version: spec
  };
}
function makePackage(seed, rng) {
  const [name, language, registry, version, desc, downloads, license, dependencies] = seed;
  const [maj, min, patch] = String(version).split('.').map(Number);
  return {
    id: `pkg-${registry}-${name}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
    name, language, registry, version, desc, license,
    downloads: Math.round(downloads), weeklyDownloads: Math.max(10, Math.round(downloads / 52)),
    stars: rng.int(20, 88000), maintainers: rng.int(1, 12), dependencies: dependencies.slice(),
    vulnerabilityCount: rng.chance(.22) ? rng.int(1, 3) : 0,
    deprecated: rng.chance(.035), updatedWorld: 0,
    versions: [`${maj}.${Math.max(0, min - 2)}.0`, `${maj}.${Math.max(0, min - 1)}.${patch}`, version].filter((v, i, a) => a.indexOf(v) === i)
  };
}
function makeModel(seed) {
  const [id, name, vendor, params, modality, context, quality, costPerM, license] = seed;
  return {
    id, name, vendor, params, modality, context, quality, costPerM, license,
    hosted: vendor !== 'open', openWeights: vendor === 'open', status: 'available',
    releaseWorld: 0, adoption: vendor === 'open' ? 28 : 46,
    safety: vendor === 'open' ? 62 : 78, latencyMs: vendor === 'open' ? 260 : 120
  };
}

export function buildInternet(game, rng = null) {
  rng = rng || makeRng((game.seed ^ 0x7e2026) >>> 0);
  const civ = game.civ || {};
  const countries = Array.isArray(civ.countries) && civ.countries.length ? civ.countries : [
    { id: 'novaria', name: 'Novaria', region: 'north', hq: 'Meridian', internet: { penetration: 86 }, economy: { gdp: 1e12 } },
    { id: 'rhine', name: 'Rhine', region: 'west', hq: 'Rheinholt', internet: { penetration: 84 }, economy: { gdp: 1.4e12 } },
    { id: 'sakura', name: 'Sakura', region: 'east', hq: 'Sakura City', internet: { penetration: 90 }, economy: { gdp: 1.1e12 } }
  ];
  const cities = Array.isArray(civ.cities) && civ.cities.length ? civ.cities : countries.map(c => ({ id: `${c.id}-capital`, name: c.hq || c.name, countryId: c.id, region: c.region, population: 1000000, utilities: { power: 82, telecom: 84 }, prices: { energy: 90 } }));
  const net = {
    version: INTERNET_VERSION, builtWorld: game.worldMinutes, worldMinutes: game.worldMinutes,
    seq: { asn: 1, ixp: 1, cable: 1, dc: 1, proto: 1, web: 1, api: 1, cert: 1, pkg: 1, build: 1, ci: 1, release: 1, deploy: 1, model: 1, endpoint: 1, train: 1, adv: 1, incident: 1, platform: 1, nethist: 1, netevent: 1 },
    asns: [], ixps: [], cables: [], datacenters: [], protocols: [], web: { records: {}, lastCheckWorld: game.worldMinutes },
    apis: [], certs: [], packages: [], builds: [], ci: [], releases: [], deployments: [],
    dev: { languages: [], projects: [], registries: REGISTRIES.slice(), lastReleaseWorld: game.worldMinutes },
    ai: { models: [], endpoints: [], training: [], vectorDbs: [], rag: [] },
    security: { advisories: [], incidents: [], sboms: [], zeroTrust: { identity: 52, device: 46, network: 48, workload: 44, data: 50 } },
    social: { platforms: [], lastGrowthWorld: game.worldMinutes },
    os: defaultOS(game), events: [], history: [], cadence: {}, metrics: {}
  };

  // Autonomous systems: organizations plus per-country access networks.
  const companies = (game.companies || []).slice(0, 54);
  for (const co of companies) {
    const country = countries.find(c => c.id === co.hqCountryId) || rng.pick(countries);
    const type = /cloud|hosting|infrastructure/i.test(co.sector || '') ? 'cloud'
      : /media|news/i.test(co.sector || '') ? 'content'
        : /security|software|research/i.test(co.sector || '') ? 'content' : 'enterprise';
    net.asns.push(makeASN(net, rng, { name: co.name, orgId: co.id, countryId: country.id, type, traffic: rng.float(2, 240), reliability: clamp((co.security || 50) / 100 * 70 + 20, 40, 99) }));
  }
  for (const country of countries) {
    net.asns.push(makeASN(net, rng, {
      name: `${country.name} Access`, countryId: country.id, type: 'access',
      traffic: rng.float(20, 420), reliability: rng.float(76, 98)
    }));
  }
  net.asns.push(makeASN(net, rng, { name: 'Meridian Backbone', countryId: countries[0]?.id, type: 'transit', traffic: 620, reliability: 96 }));
  net.asns.push(makeASN(net, rng, { name: 'Harbor Transit', countryId: countries[Math.min(1, countries.length - 1)]?.id, type: 'transit', traffic: 480, reliability: 94 }));
  // Peering relationships: prefer same country and a couple of transit uplinks.
  const transits = net.asns.filter(a => a.type === 'transit');
  for (const asn of net.asns) {
    const local = net.asns.filter(a => a.id !== asn.id && a.countryId === asn.countryId);
    asn.peers = rng.picks(local, Math.min(3, local.length)).map(a => a.id);
    asn.upstreams = asn.type === 'transit' ? [] : rng.picks(transits, Math.min(2, transits.length)).map(a => a.id);
    asn.prefixes = [`${rng.pick(['198.51','203.0','192.0','100.64'])}.${rng.int(0,255)}.0/${rng.pick([22,23,24])}`];
  }
  bounded(net.asns, NET_CAPS.asns);

  // Exchange points in the largest cities.
  const ixpCities = cities.slice().sort((a, b) => (b.population || 0) - (a.population || 0)).slice(0, 18);
  for (const city of ixpCities) {
    const members = net.asns.filter(a => a.countryId === city.countryId).slice(0, 10).map(a => a.id);
    net.ixps.push({
      id: nextId(net, 'ixp'), name: `${city.name} Internet Exchange`, cityId: city.id, countryId: city.countryId,
      members, trafficGbps: rng.float(12, 480), status: 'operational', routeServer: rng.chance(.7), foundedYear: 2026 - rng.int(3, 24)
    });
  }
  bounded(net.ixps, NET_CAPS.ixps);

  // Long-haul links between regions and neighbouring countries.
  const cablePairs = [];
  for (let i = 0; i < countries.length; i++) for (let j = i + 1; j < countries.length; j++) cablePairs.push([countries[i], countries[j]]);
  for (const [a, b] of rng.picks(cablePairs, Math.min(24, cablePairs.length))) {
    const fromCity = cities.find(c => c.countryId === a.id) || cities[0];
    const toCity = cities.find(c => c.countryId === b.id && c.id !== fromCity.id) || cities[Math.min(1, cities.length - 1)];
    net.cables.push({
      id: nextId(net, 'cable'), name: `${a.name}–${b.name} ${rng.pick(['Trunk','Link','Cable','Route'])}`,
      fromCityId: fromCity.id, toCityId: toCity.id, fromCountryId: a.id, toCountryId: b.id,
      capacityTbps: rng.float(8, 240), utilization: rng.float(28, 78), latencyMs: rng.int(6, 160),
      status: rng.chance(.06) ? 'degraded' : 'up', kind: a.region === b.region ? 'terrestrial' : 'submarine',
      repairWorld: 0, owner: rng.pick(['consortium', 'carrier', 'cloud provider', 'public-private partnership'])
    });
  }
  bounded(net.cables, NET_CAPS.cables);

  // Data centers reuse the civilization's physical infrastructure where available.
  const civDCs = civ.infrastructure?.dataCenters || [];
  for (const dc of civDCs.slice(0, 60)) {
    const city = cities.find(c => c.id === dc.cityId) || cities[0];
    const asn = rng.pick(net.asns.filter(a => a.countryId === dc.countryId)) || net.asns[0];
    net.datacenters.push({
      id: nextId(net, 'dc'), sourceId: dc.id, name: dc.name, cityId: dc.cityId, countryId: dc.countryId,
      region: city.region, operatorId: dc.operatorId || null, asnId: asn?.id || null,
      racks: Math.round((dc.capacity || 100) * rng.float(1.4, 4.2)), utilization: dc.utilization || rng.int(20, 80),
      powerMw: rng.float(2, 80), pue: rng.float(1.15, 1.62), renewable: rng.int(12, 92),
      tier: dc.tier || 'III', latencyMs: rng.int(3, 40), status: 'operational'
    });
  }
  bounded(net.datacenters, NET_CAPS.datacenters);

  // Protocols.
  for (const seed of PROTOCOL_SEEDS) {
    const p = makeProtocol(seed, rng);
    p.updatedWorld = game.worldMinutes - rng.int(30, 1400) * DAY;
    net.protocols.push(p);
  }
  bounded(net.protocols, NET_CAPS.protocols);

  // Web records, certificates and APIs for every existing site.
  for (const site of game.sites || []) {
    const record = makeWebRecord(game, net, site, rng);
    net.web.records[site.id] = record;
    net.certs.push(makeCert(site, record, rng, net.worldMinutes));
    if (['corp','git','news','community','generic'].includes(site.kind) && rng.chance(.55)) {
      const count = rng.int(1, 2);
      for (let i = 0; i < count && net.apis.length < NET_CAPS.apis; i++) net.apis.push(makeApi(site, rng, i));
    }
  }
  bounded(net.certs, NET_CAPS.certs);
  bounded(net.apis, NET_CAPS.apis);

  // Developer ecosystem.
  net.dev.languages = [
    { id: 'javascript', name: 'JavaScript', version: 'ES2025', adoption: 91, runtime: 'Node 22 / browsers', status: 'standard' },
    { id: 'typescript', name: 'TypeScript', version: '5.8', adoption: 64, runtime: 'Node / browser toolchain', status: 'standard' },
    { id: 'python', name: 'Python', version: '3.13', adoption: 82, runtime: 'CPython 3.13', status: 'standard' },
    { id: 'c', name: 'C', version: 'C17', adoption: 44, runtime: 'GCC 12 / Clang 18', status: 'standard' },
    { id: 'cpp', name: 'C++', version: 'C++23', adoption: 37, runtime: 'GCC 12 / Clang 18', status: 'standard' },
    { id: 'rust', name: 'Rust', version: '1.85', adoption: 28, runtime: 'rustc / cargo', status: 'growing' },
    { id: 'go', name: 'Go', version: '1.24', adoption: 34, runtime: 'gc toolchain', status: 'standard' },
    { id: 'sql', name: 'SQL', version: 'SQL:2023', adoption: 76, runtime: 'SQLite / PostgreSQL', status: 'standard' },
    { id: 'html', name: 'HTML', version: 'Living Standard', adoption: 100, runtime: 'browser engines', status: 'standard' },
    { id: 'css', name: 'CSS', version: '2025', adoption: 99, runtime: 'browser engines', status: 'standard' },
    { id: 'bash', name: 'Bash', version: '5.2', adoption: 68, runtime: 'GNU Bash', status: 'standard' },
    { id: 'wasm', name: 'WebAssembly', version: '2.0', adoption: 31, runtime: 'browser / WASI', status: 'growing' }
  ];
  for (const seed of PACKAGE_SEEDS) {
    const pkg = makePackage(seed, rng);
    pkg.updatedWorld = game.worldMinutes - rng.int(1, 500) * DAY;
    net.packages.push(pkg);
  }
  bounded(net.packages, NET_CAPS.packages);
  net.releases.push({
    id: nextId(net, 'release'), name: 'nullnet-cli', version: '0.9.4', project: '/home/operator/projects/nullnet-cli',
    channel: 'stable', status: 'published', publishedWorld: game.worldMinutes - 40 * DAY,
    notes: 'Small shell helpers and board shortcuts.', downloads: rng.int(120, 9000)
  });
  bounded(net.releases, NET_CAPS.releases);

  // AI ecosystem.
  for (const seed of MODEL_SEEDS) {
    const model = makeModel(seed);
    model.releaseWorld = game.worldMinutes - rng.int(30, 700) * DAY;
    net.ai.models.push(model);
  }
  for (const data of AGENT_MODELS || []) {
    if (net.ai.models.some(m => m.id === data.id)) continue;
    net.ai.models.push({
      id: data.id, name: data.name || data.id, vendor: 'local', params: data.params || '—', modality: 'text',
      context: data.context || 8192, quality: data.skill || 55, costPerM: data.cost || 0,
      license: 'local', hosted: false, openWeights: true, status: 'available', releaseWorld: game.worldMinutes - 120 * DAY,
      adoption: 12, safety: 60, latencyMs: 340
    });
  }
  bounded(net.ai.models, NET_CAPS.models);
  const aiCompanies = (game.companies || []).filter(c => /ai|cloud|software|research/i.test(c.sector || '')).slice(0, 16);
  for (const co of aiCompanies) {
    net.ai.endpoints.push({
      id: nextId(net, 'endpoint'), modelId: rng.pick(net.ai.models).id, ownerId: co.id, ownerName: co.name,
      region: co.hqCountryId || countries[0].id, pricePerM: rng.int(1, 12), latencyMs: rng.int(40, 220),
      throughput: rng.int(80, 4800), uptime: rng.float(97.2, 99.99), requests: rng.int(10000, 98000000), status: 'live'
    });
  }
  bounded(net.ai.endpoints, NET_CAPS.endpoints);
  for (let i = 0; i < 5; i++) {
    const model = rng.pick(net.ai.models);
    net.ai.training.push({
      id: nextId(net, 'train'), modelName: `${model.name}-next`, baseModel: model.id,
      orgId: rng.chance(.5) ? rng.pick(game.companies || [])?.id || null : null,
      computeHours: rng.int(400, 90000), progress: rng.int(10, 88),
      status: 'training', startedWorld: game.worldMinutes - rng.int(2, 80) * DAY, resultQuality: null
    });
  }
  const vectorOwners = (game.companies || []).filter(c => /cloud|data|software|ai/i.test(c.sector || '')).slice(0, 8);
  for (const co of vectorOwners) {
    net.ai.vectorDbs.push({ id: nextId(net, 'vdb'), name: `${co.name} Vector`, ownerId: co.id, vectors: rng.int(10000, 90000000), dimensions: rng.pick([384,768,1536,3072]), latencyMs: rng.int(2, 30), status: 'online' });
  }
  if (net.ai.vectorDbs.length) {
    net.ai.rag.push({ id: nextId(net, 'rag'), name: 'Knowledge retrieval pipeline', vectorDbId: net.ai.vectorDbs[0].id, documents: rng.int(2000, 800000), freshnessDays: rng.int(1, 30), status: 'online' });
  }

  // Security advisories, incidents and SBOMs.
  for (const vuln of (VULN_TYPES || []).slice(0, 16)) {
    net.security.advisories.push(makeAdvisory(net, rng, vuln.name, vuln.severity, net.worldMinutes - rng.int(2, 600) * DAY));
  }
  for (let i = 0; i < 6; i++) {
    const target = rng.pick(game.sites || []);
    if (!target) break;
    net.security.incidents.push({
      id: nextId(net, 'incident'), kind: rng.pick(['credential leak','availability attack','misconfiguration','supply-chain compromise','data exposure']),
      severity: rng.pick(['low','moderate','high','critical']), targetId: target.id, targetName: target.domain,
      startedWorld: game.worldMinutes - rng.int(1, 20) * DAY, resolvedWorld: null, status: 'open',
      impact: rng.pick(['degraded service','temporary outage','data exposure risk','credential rotation required']),
      handledBy: null
    });
  }
  net.security.sboms = (game.sites || []).slice(0, 30).map(site => ({
    id: nextId(net, 'sbom'), siteId: site.id, domain: site.domain,
    components: rng.int(8, 240), licenses: rng.int(2, 18), critical: 0,
    lastScanWorld: game.worldMinutes - rng.int(1, 90) * DAY, score: rng.int(56, 96)
  }));

  // Social platforms.
  for (const [id, name, kind, users, trust, protocol, desc] of SOCIAL_SEEDS) {
    net.social.platforms.push({ id, name, kind, users, trust, protocol, desc, growth: rng.float(-.002, .006), status: 'online', foundedYear: 2026 - rng.int(1, 22) });
  }
  bounded(net.social.platforms, NET_CAPS.platforms);

  // Historical timeline.
  for (const [year, category, title, body] of HISTORY_SEEDS) {
    net.history.push({ id: nextId(net, 'nethist'), world: game.worldMinutes - (2026 - year) * YEAR, year, category, title, body, actors: [], countryId: null, major: true });
  }
  for (let i = 0; i < 14; i++) {
    const country = rng.pick(countries);
    const year = rng.int(2012, 2025);
    net.history.push({
      id: nextId(net, 'nethist'), world: game.worldMinutes - (2026 - year) * YEAR, year,
      category: rng.pick(['web','infrastructure','security','business','society','development','ai']),
      title: rng.pick(['A regional exchange adds a route server','A community fibre project reaches a new district','A source registry adopts signed releases','A small provider collapses after a billing failure','A browser ships a privacy default','A city publishes open network data']),
      body: `${country.name} recorded a gradual network change. Its effects were uneven and mostly local.`,
      actors: [country.id], countryId: country.id, major: false
    });
  }
  net.history.sort((a, b) => a.world - b.world);
  bounded(net.history, NET_CAPS.history);

  recomputeMetrics(game, net);
  return net;
}

function makeASN(net, rng, opts) {
  return {
    id: nextId(net, 'asn'), asn: 64500 + net.seq.asn, name: opts.name, orgId: opts.orgId || null,
    countryId: opts.countryId || null, type: opts.type || 'enterprise',
    prefixes: opts.prefixes || [], peers: [], upstreams: [],
    trafficGbps: opts.traffic || rng.float(1, 120), latencyMs: rng.int(3, 120),
    reliability: opts.reliability || rng.float(70, 98), status: 'operational',
    routePolicy: opts.type === 'transit' ? 'carrier' : 'customer', createdWorld: net.worldMinutes - rng.int(200, 9000) * DAY
  };
}

function makeWebRecord(game, net, site, rng) {
  const hasTls = rng.chance(.88);
  const cdn = rng.chance(.52);
  const protocols = ['rest','graphql','websocket','grpc'];
  const apiCount = ['corp','git','news'].includes(site.kind) ? rng.int(1, 3) : rng.chance(.3) ? 1 : 0;
  return {
    siteId: site.id, domain: site.domain, title: site.title, kind: site.kind,
    ownerType: site.ownerType || 'npc', status: site.status === 'live' ? 'live' : 'offline',
    tls: hasTls ? { enabled: true, version: rng.pick(TLS_VERSIONS), hsts: rng.chance(.62), issuer: rng.pick(ISSUERS) } : { enabled: false, version: null, hsts: false, issuer: null },
    dns: {
      a: [`${rng.pick(['198.51','203.0','192.0'])}.${rng.int(2, 250)}.${rng.int(2, 250)}`],
      aaaa: rng.chance(.42) ? [`2001:db8::${(rng.int(1, 999)).toString(16)}`] : [],
      mx: rng.chance(.55) ? [`mail.${site.domain}`] : [],
      ns: [`ns1.${site.domain}`, `ns2.${site.domain}`],
      txt: ['v=spf1 include:_spf.nullnet ~all'], ttl: rng.pick([300, 900, 3600, 7200]),
      dnssec: rng.chance(.34), lastChangeWorld: net.worldMinutes - rng.int(1, 500) * DAY
    },
    cdn: cdn ? { provider: rng.pick(['Harbor Edge','Meridian CDN','Northwind Edge','Open Cache']), cacheHit: rng.int(52, 96), pops: rng.int(4, 80) } : null,
    stack: rng.picks(['nginx','Caddy','static','Next.js','Rails','Go','Flask','Apache','Node'], rng.int(2, 4)),
    backend: rng.pick(['static files','Node service','Python service','Go service','Ruby service']),
    database: rng.chance(.34) ? rng.pick(['PostgreSQL','SQLite','Redis','MySQL','vector store']) : null,
    apis: rng.picks(protocols, Math.min(apiCount, protocols.length)),
    availability: rng.float(93, 99.99), latencyMs: rng.int(28, 420), requestsPerMin: rng.int(10, 90000),
    errorRate: rng.float(.0001, .02), securityHeaders: rng.int(28, 94), accessibility: rng.int(32, 96),
    seo: rng.int(30, 96), seoIndexed: rng.chance(.82), lastCheckWorld: net.worldMinutes,
    uptimeHistory: Array.from({ length: 12 }, () => rng.int(90, 100))
  };
}

function makeCert(site, record, rng, world) {
  return {
    id: `cert-${String(site.id || site.domain).replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`, domain: site.domain, siteId: site.id,
    issuer: record.tls.issuer || rng.pick(ISSUERS), tlsVersion: record.tls.version || 'TLS 1.2',
    validFromWorld: world - rng.int(1, 300) * DAY, validToWorld: world + rng.int(4, 390) * DAY,
    autoRenew: rng.chance(.72), status: 'valid', keyType: rng.pick(['ECDSA P-256','RSA 2048','RSA 4096'])
  };
}

function makeApi(site, rng, index) {
  const protocol = rng.pick(['rest','graphql','websocket','grpc']);
  return {
    id: `api-${String(site.id || site.domain).replace(/[^a-z0-9-]/gi, '-').toLowerCase()}-${index + 1}`, siteId: site.id, domain: site.domain,
    protocol, path: protocol === 'graphql' ? '/graphql' : protocol === 'websocket' ? '/ws' : '/api/v1',
    version: `v${rng.int(1, 3)}`, auth: rng.pick(['none','api-key','oauth2','webauthn']),
    rateLimit: rng.pick([60, 300, 1200, 6000]), latencyMs: rng.int(8, 220),
    uptime: rng.float(95, 99.99), requests: rng.int(1000, 90000000), errors: rng.int(0, 90000),
    status: 'live', docs: rng.chance(.58), createdAtWorld: Date.now() - rng.int(10, 800) * 86400000
  };
}

function makeAdvisory(net, rng, product, severity, publishedWorld) {
  const sev = ['low','medium','high','critical'].includes(severity) ? severity : rng.pick(['low','medium','high']);
  return {
    id: nextId(net, 'adv'), cve: `CVE-${netYear(net)}-${rng.int(1000, 89999)}`,
    title: `${product} vulnerability requires coordinated patching`,
    product, severity: sev, affected: rng.pick(['web frontend','API gateway','container runtime','TLS stack','package registry','identity provider']),
    status: rng.chance(.35) ? 'patched' : 'published', publishedWorld,
    patchedWorld: null, cvss: sev === 'critical' ? rng.float(9, 10) : sev === 'high' ? rng.float(7, 9) : sev === 'medium' ? rng.float(4, 7) : rng.float(1, 4),
    exploited: sev === 'critical' && rng.chance(.25), advisoryBy: rng.pick(['CERT-Null','Vendor Security','Independent Researcher'])
  };
}

/* ---------------- metrics ---------------- */
export function recomputeMetrics(game, net = ensureInternet(game), rng = null) {
  rng = rng || makeRng((game.seed ^ 0x51ee7) >>> 0);
  const records = Object.values(net.web.records);
  const live = records.filter(r => r.status === 'live');
  const totalTraffic = net.asns.reduce((s, a) => s + (a.trafficGbps || 0), 0);
  const avgLatency = net.asns.length ? net.asns.reduce((s, a) => s + (a.latencyMs || 0), 0) / net.asns.length : 0;
  const avgAvailability = live.length ? live.reduce((s, r) => s + (r.availability || 0), 0) / live.length : 0;
  const openIncidents = net.security.incidents.filter(i => i.status !== 'resolved').length;
  const protocolAdoption = net.protocols.length ? net.protocols.reduce((s, p) => s + (p.adoption || 0), 0) / net.protocols.length : 0;
  const tls13 = net.certs.filter(c => c.tlsVersion === 'TLS 1.3').length;
  const ipv6 = net.protocols.find(p => p.id === 'ipv6')?.adoption || 0;
  const quic = net.protocols.find(p => p.id === 'quic')?.adoption || 0;
  const http3 = net.protocols.find(p => p.id === 'http3')?.adoption || 0;
  const buildSuccess = net.ci.length ? net.ci.reduce((s, c) => s + (c.successRate || 0), 0) / net.ci.length : 92;
  const socialUsers = net.social.platforms.reduce((s, p) => s + (p.users || 0), 0);
  const socialTrust = net.social.platforms.length ? net.social.platforms.reduce((s, p) => s + (p.trust || 0), 0) / net.social.platforms.length : 50;
  const z = net.security.zeroTrust;
  const zeroTrustScore = Math.round(((z.identity || 0) + (z.device || 0) + (z.network || 0) + (z.workload || 0) + (z.data || 0)) / 5);
  const health = clamp(Math.round(
    avgAvailability * .32 + (100 - Math.min(80, avgLatency / 5)) * .16 +
    protocolAdoption * .14 + buildSuccess * .12 + socialTrust * .12 +
    (100 - Math.min(100, openIncidents * 8)) * .14
  ), 0, 100);
  net.metrics = {
    health, trafficTbps: Math.round(totalTraffic * 10) / 10, avgLatencyMs: Math.round(avgLatency),
    availability: Math.round(avgAvailability * 100) / 100,
    asnCount: net.asns.length, ixpCount: net.ixps.length, cableCount: net.cables.length,
    datacenterCount: net.datacenters.length, siteCount: records.length, apiCount: net.apis.length,
    certCount: net.certs.length, packageCount: net.packages.length,
    protocolAdoption: Math.round(protocolAdoption), tls13Share: net.certs.length ? Math.round(tls13 / net.certs.length * 100) : 0,
    ipv6Adoption: Math.round(ipv6), quicAdoption: Math.round(quic), http3Adoption: Math.round(http3),
    devHealth: Math.round(buildSuccess), buildSuccessRate: Math.round(buildSuccess),
    ciRuns: net.ci.reduce((s, c) => s + (c.runs || 0), 0), releaseCount: net.releases.length,
    aiModelCount: net.ai.models.length, aiEndpointCount: net.ai.endpoints.length,
    trainingRuns: net.ai.training.filter(t => t.status === 'training').length,
    advisoryCount: net.security.advisories.length, openIncidents,
    zeroTrustScore, socialUsers, socialTrust: Math.round(socialTrust),
    year: netYear(net), updatedWorld: net.worldMinutes
  };
  return net.metrics;
}

/* ---------------- tick ---------------- */
export function tickInternet(game, minutes = 1, rng = null) {
  const net = ensureInternet(game);
  rng = rng || netRng(game, 0x2026);
  net.worldMinutes = game.worldMinutes;
  const events = [];
  const day = Math.max(0.0001, (Number(minutes) || 1) / DAY);
  const worldMinute = ((game.worldMinutes % DAY) + DAY) % DAY;
  const diurnal = .55 + .45 * Math.sin((worldMinute / DAY) * Math.PI * 2 - Math.PI / 2);

  // Network conditions, every 15 simulated minutes.
  const networkSteps = advanceBucket(net, 'network', 15, game.worldMinutes, 96);
  for (let step = 0; step < networkSteps; step++) networkCadence(game, net, rng, events, diurnal);

  // Web, certificates and APIs, every two hours.
  const webSteps = advanceBucket(net, 'web', 120, game.worldMinutes, 24);
  for (let step = 0; step < webSteps; step++) webCadence(game, net, rng, events);

  // Protocol adoption and standards, every six hours.
  const protocolSteps = advanceBucket(net, 'protocol', 360, game.worldMinutes, 16);
  for (let step = 0; step < protocolSteps; step++) protocolCadence(game, net, rng, events);

  // Package and build ecosystem, every four hours.
  const devSteps = advanceBucket(net, 'dev', 240, game.worldMinutes, 20);
  for (let step = 0; step < devSteps; step++) devCadence(game, net, rng, events);

  // AI, security and social conditions, once per day.
  const dailySteps = advanceBucket(net, 'daily', DAY, game.worldMinutes, 30);
  for (let step = 0; step < dailySteps; step++) {
    aiCadence(game, net, rng, events, day);
    securityCadence(game, net, rng, events, day);
    socialCadence(game, net, rng, events, day);
    osCadence(game, net, rng, events);
  }

  // Expire resolved incidents and events.
  for (const incident of net.security.incidents) {
    if (incident.status !== 'resolved' && incident.resolvedWorld && game.worldMinutes >= incident.resolvedWorld) {
      incident.status = 'resolved';
      events.push({ type: 'feed', text: `Incident ${incident.id} at ${incident.targetName || 'a provider'} resolved.`, kind: 'info' });
    }
  }
  for (const e of net.events) {
    if (e.status === 'active' && e.startedWorld + DAY * 30 < game.worldMinutes && rng.chance(.08)) {
      e.status = 'resolved'; e.resolvedWorld = game.worldMinutes;
    }
  }

  recomputeMetrics(game, net, rng);
  bounded(net.events, NET_CAPS.events);
  bounded(net.history, NET_CAPS.history);
  return events;
}

function networkCadence(game, net, rng, events, diurnal) {
  for (const asn of net.asns) {
    const target = asn.type === 'transit' ? rng.float(180, 900) : asn.type === 'cloud' ? rng.float(20, 300) : rng.float(2, 120);
    asn.trafficGbps = Math.max(.1, asn.trafficGbps * .86 + target * diurnal * rng.float(.72, 1.16));
    asn.latencyMs = clamp(asn.latencyMs + (asn.reliability > 90 ? -0.05 : 0.08) + rng.float(-.4, .4), 2, 320);
    if (asn.status === 'degraded' && rng.chance(.24)) asn.status = 'operational';
    else if (asn.status === 'operational' && rng.chance(.006)) {
      asn.status = 'degraded';
      events.push({ type: 'feed', text: `${asn.name} reports intermittent routing instability.`, kind: 'warn' });
    }
  }
  for (const ixp of net.ixps) {
    const members = ixp.members.map(id => net.asns.find(a => a.id === id)).filter(Boolean);
    ixp.trafficGbps = Math.max(1, members.reduce((s, a) => s + a.trafficGbps, 0) * rng.float(.15, .34));
    if (ixp.status === 'degraded' && rng.chance(.2)) ixp.status = 'operational';
    else if (ixp.status === 'operational' && rng.chance(.004)) ixp.status = 'degraded';
  }
  for (const cable of net.cables) {
    cable.utilization = clamp(cable.utilization + rng.float(-.7, .7) + diurnal * .18, 5, 100);
    if (cable.status === 'degraded') {
      if (cable.repairWorld && game.worldMinutes >= cable.repairWorld) {
        cable.status = 'up'; cable.repairWorld = 0;
        events.push({ type: 'feed', text: `${cable.name} repaired and returned to service.`, kind: 'info' });
        recordHistory(net, 'infrastructure', `${cable.name} restored`, 'A degraded long-haul link returned to service after repair.', { major: false });
      } else if (rng.chance(.012)) {
        cable.status = 'up'; cable.repairWorld = 0;
      }
    } else if (rng.chance(.0035)) {
      cable.status = 'degraded'; cable.repairWorld = game.worldMinutes + rng.int(4, 48) * 3600;
      events.push({ type: 'news', headline: `${cable.name} degraded`, body: `Capacity is reduced while operators reroute traffic. Repair crews are dispatched.`, source: 'Network Operations' });
    }
  }
  for (const dc of net.datacenters) {
    dc.utilization = clamp(dc.utilization + rng.float(-.5, .5), 8, 99);
    const cityOutage = (game.civ?.infrastructure?.outages || []).find(o => o.status === 'active' && o.cityId === dc.cityId && game.worldMinutes < o.endsWorld);
    if (cityOutage) {
      dc.status = cityOutage.severity === 'major' ? 'degraded' : 'constrained';
    } else if (dc.status !== 'operational' && rng.chance(.2)) {
      dc.status = 'operational';
    } else if (dc.status === 'operational' && rng.chance(.002)) {
      dc.status = 'degraded';
    }
  }
}

function webCadence(game, net, rng, events) {
  net.web.lastCheckWorld = game.worldMinutes;
  const records = Object.values(net.web.records);
  for (const record of records) {
    const site = (game.sites || []).find(s => s.id === record.siteId);
    if (site && site.status !== 'live') record.status = 'offline';
    else if (record.status === 'offline' && rng.chance(.16)) record.status = 'live';
    else if (record.status === 'live' && rng.chance(.003)) record.status = 'degraded';
    else if (record.status === 'degraded' && rng.chance(.18)) record.status = 'live';
    if (record.status === 'live') {
      const server = site ? (game.servers || []).find(s => s.id === site.serverId) : null;
      const badHost = server && server.status !== 'online';
      const availabilityTarget = badHost ? 62 : record.tls.enabled ? 98.6 : 94;
      record.availability = clamp(record.availability + (availabilityTarget - record.availability) * .18 + rng.float(-.12, .12), 30, 99.999);
      record.latencyMs = clamp(record.latencyMs + rng.float(-8, 8) + (badHost ? 40 : 0), 12, 900);
      // Traffic changes only through recorded visits and deployments, never a random counter.
      record.errorRate = clamp(record.errorRate + (badHost ? .002 : -.0004) + rng.float(-.0004, .0004), .00005, .25);
      record.securityHeaders = clamp(record.securityHeaders + (rng.chance(.1) ? rng.int(-1, 1) : 0), 5, 100);
      if (rng.chance(.01)) record.availability = clamp(record.availability - rng.float(.2, 2.5), 30, 99.999);
    }
    const cert = net.certs.find(c => c.siteId === record.siteId);
    if (cert) {
      if (game.worldMinutes > cert.validToWorld) {
        if (cert.autoRenew) {
          cert.validFromWorld = game.worldMinutes;
          cert.validToWorld = game.worldMinutes + rng.int(180, 398) * DAY;
          cert.status = 'valid';
          record.tls.enabled = true;
        } else {
          cert.status = 'expired';
          record.tls.enabled = false;
          if (record.ownerType === 'player') events.push({ type: 'mail', from: 'certificates', subject: `Certificate expired for ${record.domain}`, body: `TLS was disabled for ${record.domain}. Renew the certificate from the developer panel.` });
        }
      } else {
        cert.status = 'valid';
      }
    }
  }
  for (const api of net.apis) {
    const record = records.find(r => r.siteId === api.siteId);
    const online = record && record.status === 'live';
    api.uptime = clamp(api.uptime + (online ? .002 : -.05), 40, 100);
    api.latencyMs = clamp(api.latencyMs + rng.float(-4, 4), 5, 800);
    // API request totals are advanced only by real recorded consumers elsewhere.
    if (online && rng.chance(.01)) api.errors += rng.int(1, 20);
    api.status = online ? (api.uptime > 92 ? 'live' : 'degraded') : 'offline';
  }
}

function protocolCadence(game, net, rng, events) {
  for (const protocol of net.protocols) {
    const target = protocol.status === 'legacy' ? Math.max(12, protocol.baselineAdoption * .72)
      : protocol.status === 'deprecated' ? Math.max(4, protocol.baselineAdoption * .35)
        : protocol.status === 'emerging' ? Math.min(94, protocol.baselineAdoption + 18)
          : Math.min(99, protocol.baselineAdoption + 6);
    protocol.adoption = clamp(protocol.adoption + (target - protocol.adoption) * .006 + rng.float(-.12, .12), 1, 100);
    protocol.security = clamp(protocol.security + rng.float(-.06, .1), 10, 100);
    protocol.performance = clamp(protocol.performance + rng.float(-.05, .08), 10, 100);
    if (protocol.status === 'emerging' && protocol.adoption > 52) {
      protocol.status = 'standard';
      recordHistory(net, 'infrastructure', `${protocol.name} reaches mainstream adoption`, `${protocol.name} crossed the threshold where it is treated as a normal deployment target.`, { major: true });
      events.push({ type: 'feed', text: `${protocol.name} is now considered mainstream.`, kind: 'info' });
    }
    if (protocol.status === 'legacy' && protocol.adoption < 18) protocol.status = 'deprecated';
    if (rng.chance(.0015)) {
      protocol.version = bumpVersion(protocol.version);
      protocol.updatedWorld = game.worldMinutes;
      protocol.adoption = clamp(protocol.adoption + rng.float(1, 5), 1, 100);
      recordHistory(net, 'infrastructure', `${protocol.name} ${protocol.version} published`, `The updated specification adds clarifications and closes implementation gaps.`, { major: false });
    }
  }
}

function bumpVersion(version) {
  const m = String(version).match(/(\d+)(?:\.(\d+))?/);
  if (!m) return version;
  const major = Number(m[1]), minor = Number(m[2] || 0);
  return Number.isFinite(minor) && m[2] != null ? `${major}.${minor + 1}` : `${major + 1}`;
}

function devCadence(game, net, rng, events) {
  for (const pkg of net.packages) {
    // Registry totals remain stable unless a simulated install is recorded.
    if (rng.chance(.006)) {
      pkg.version = bumpPackageVersion(pkg.version, rng);
      pkg.updatedWorld = game.worldMinutes;
      pkg.versions.push(pkg.version);
      bounded(pkg.versions, 12);
      if (pkg.stars > 2000 && rng.chance(.22)) events.push({ type: 'feed', text: `${pkg.name} ${pkg.version} published to ${pkg.registry}.`, kind: 'info' });
    }
    if (rng.chance(.001)) pkg.vulnerabilityCount = Math.min(8, (pkg.vulnerabilityCount || 0) + 1);
    if (pkg.vulnerabilityCount > 0 && rng.chance(.004)) pkg.vulnerabilityCount--;
  }
  // Scheduled CI runs on existing pipelines.
  for (const ci of net.ci) {
    if (!ci.nextRunWorld || game.worldMinutes >= ci.nextRunWorld) {
      ci.runs = (ci.runs || 0) + 1;
      const success = rng.chance(clamp((ci.successRate || 90) / 100 + (ci.flaky ? -.12 : 0), .1, .99));
      ci.lastRunWorld = game.worldMinutes;
      ci.lastStatus = success ? 'passed' : 'failed';
      ci.successRate = clamp((ci.successRate || 90) * .92 + (success ? 100 : 0) * .08, 20, 100);
      ci.nextRunWorld = game.worldMinutes + rng.int(4, 20) * 3600;
      if (!success && rng.chance(.05)) events.push({ type: 'feed', text: `CI failed on ${ci.name} (${ci.branch}).`, kind: 'warn' });
    }
  }
  // World software releases.
  if (rng.chance(.02)) {
    const protocol = rng.pick(net.protocols.filter(p => ['standard','emerging'].includes(p.status)));
    const release = {
      id: nextId(net, 'release'), name: rng.pick(['Harbor Edge','Meridian Toolkit','NullNet Runtime','Atlas SDK','Open Cache']),
      version: `${rng.int(1, 9)}.${rng.int(0, 20)}.${rng.int(0, 9)}`, project: null, channel: rng.pick(['stable','beta']),
      status: 'published', publishedWorld: game.worldMinutes, notes: `Compatibility update for ${protocol?.name || 'the runtime'}.`, downloads: rng.int(10, 800)
    };
    net.releases.push(release); bounded(net.releases, NET_CAPS.releases);
  }
  net.dev.lastReleaseWorld = game.worldMinutes;
}

function bumpPackageVersion(version, rng) {
  const [maj, min, patch] = String(version).split('.').map(Number);
  if (rng.chance(.12)) return `${maj + 1}.0.0`;
  if (rng.chance(.4)) return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${(patch || 0) + 1}`;
}

function aiCadence(game, net, rng, events, day) {
  for (const model of net.ai.models) {
    model.adoption = clamp(model.adoption * (1 + rng.float(-.001, .0025)), 1, 100);
    model.quality = clamp(model.quality + rng.float(-.04, .06), 10, 99);
    model.latencyMs = clamp(model.latencyMs + rng.float(-2, 2), 30, 900);
  }
  for (const endpoint of net.ai.endpoints) {
    if (endpoint.status === 'live') {
      endpoint.requests = Math.round(endpoint.requests * (1 + rng.float(-.004, .008)) + rng.int(0, 800));
      endpoint.latencyMs = clamp(endpoint.latencyMs + rng.float(-4, 4), 12, 900);
      endpoint.uptime = clamp(endpoint.uptime + (rng.chance(.02) ? -rng.float(.01, .2) : rng.float(0, .02)), 70, 100);
    }
  }
  for (const run of net.ai.training) {
    if (run.status !== 'training') continue;
    run.progress = clamp(run.progress + rng.float(1.2, 4.6) * Math.min(4, day), 0, 100);
    if (run.progress >= 100) {
      run.status = 'completed';
      const quality = clamp(52 + Math.log10(Math.max(10, run.computeHours)) * 8 + rng.float(-4, 8), 40, 97);
      run.resultQuality = Math.round(quality * 10) / 10;
      net.ai.models.push({
        id: nextId(net, 'model'), name: run.modelName, vendor: run.orgId ? 'hosted' : 'open', params: rng.pick(['7B','13B','32B','70B','120B']),
        modality: 'text', context: rng.pick([32768, 65536, 131072, 200000]), quality: Math.round(quality), costPerM: rng.int(0, 8),
        license: run.orgId ? 'proprietary' : 'open', hosted: true, openWeights: !run.orgId, status: 'available',
        releaseWorld: game.worldMinutes, adoption: 2, safety: rng.int(52, 86), latencyMs: rng.int(60, 260)
      });
      bounded(net.ai.models, NET_CAPS.models);
      recordHistory(net, 'ai', `${run.modelName} released`, `A model trained for ${Math.round(run.computeHours)} compute hours reached quality ${Math.round(quality)}/100.`, { major: quality > 80 });
      events.push({ type: 'news', headline: `${run.modelName} model released`, body: `The completed training run is available for hosted inference.`, source: 'AI Wire' });
    }
  }
  if (rng.chance(.018) && net.ai.models.length < NET_CAPS.models) {
    const base = rng.pick(net.ai.models);
    const model = {
      id: nextId(net, 'model'), name: `${base.name.split('-')[0]}-${rng.int(3, 9)}`, vendor: base.vendor,
      params: base.params, modality: rng.pick(['text','text','multimodal','code']), context: base.context,
      quality: clamp(base.quality + rng.int(-2, 7), 30, 98), costPerM: Math.max(0, base.costPerM + rng.int(-2, 2)),
      license: base.license, hosted: true, openWeights: false, status: 'available',
      releaseWorld: game.worldMinutes, adoption: 1, safety: clamp((base.safety || 60) + rng.int(-6, 8), 10, 99),
      latencyMs: rng.int(60, 300)
    };
    net.ai.models.push(model); bounded(net.ai.models, NET_CAPS.models);
    events.push({ type: 'feed', text: `${model.name} enters the model market.`, kind: 'info' });
  }
  for (const vdb of net.ai.vectorDbs) vdb.latencyMs = clamp(vdb.latencyMs + rng.float(-.5, .5), 1, 90);
  for (const rag of net.ai.rag) rag.freshnessDays = clamp((rag.freshnessDays || 0) + day, 0, 365);
}

function securityCadence(game, net, rng, events, day) {
  for (const advisory of net.security.advisories) {
    if (advisory.status === 'published' && rng.chance(.035 * Math.min(4, day) + .008)) {
      advisory.status = 'patched';
      advisory.patchedWorld = game.worldMinutes;
    }
    if (advisory.severity === 'critical' && !advisory.exploited && rng.chance(.004)) advisory.exploited = true;
  }
  if (rng.chance(.02) && net.security.advisories.length < NET_CAPS.advisories) {
    const advisory = makeAdvisory(net, rng, rng.pick(['package registry','TLS stack','web framework','identity provider','container runtime']), rng.pick(['low','medium','high','critical']), game.worldMinutes);
    net.security.advisories.push(advisory);
    events.push({ type: 'news', headline: `${advisory.cve} published`, body: `${advisory.title} Affected: ${advisory.affected}.`, source: 'CERT-Null' });
  }
  bounded(net.security.advisories, NET_CAPS.advisories);
  for (const incident of net.security.incidents) {
    if (incident.status === 'resolved') continue;
    if (incident.resolvedWorld && game.worldMinutes >= incident.resolvedWorld) {
      incident.status = 'resolved';
      continue;
    }
    if (rng.chance(.06 * Math.min(5, day))) {
      incident.status = 'resolved';
      incident.resolvedWorld = game.worldMinutes;
      recordHistory(net, 'security', `Incident at ${incident.targetName || 'service'} resolved`, incident.impact, { major: incident.severity === 'critical' });
    }
  }
  if (rng.chance(.012) && net.security.incidents.length < NET_CAPS.incidents) {
    const site = rng.pick(game.sites || []);
    if (site) {
      const incident = {
        id: nextId(net, 'incident'), kind: rng.pick(['availability attack','misconfiguration','credential leak','supply-chain compromise','data exposure']),
        severity: rng.pick(['low','moderate','high','critical']), targetId: site.id, targetName: site.domain,
        startedWorld: game.worldMinutes, resolvedWorld: null, status: 'open',
        impact: rng.pick(['degraded service','temporary outage','data exposure risk','credential rotation required']), handledBy: null
      };
      net.security.incidents.push(incident); bounded(net.security.incidents, NET_CAPS.incidents);
      events.push({ type: 'news', headline: `Security incident at ${site.domain}`, body: `${incident.kind}: ${incident.impact}.`, source: 'Incident Wire' });
    }
  }
  for (const sbom of net.security.sboms) {
    if (rng.chance(.03)) {
      sbom.lastScanWorld = game.worldMinutes;
      sbom.critical = rng.chance(.12) ? rng.int(1, 3) : 0;
      sbom.score = clamp(sbom.score + rng.int(-2, 2) - sbom.critical * 2, 20, 100);
    }
  }
  const z = net.security.zeroTrust;
  for (const key of Object.keys(z)) z[key] = clamp(z[key] + rng.float(-.2, .3), 10, 99);
}

function socialCadence(game, net, rng, events, day) {
  const trend = game.civ?.media?.trends?.[0]?.topic || null;
  for (const platform of net.social.platforms) {
    platform.users = Math.max(1000, Math.round(platform.users * (1 + (platform.growth || 0) * Math.min(5, day))));
    platform.trust = clamp(platform.trust + rng.float(-.18, .18), 10, 99);
    if (rng.chance(.008)) {
      platform.trust = clamp(platform.trust + rng.int(-5, 5), 10, 99);
      platform.growth = clamp((platform.growth || 0) + rng.float(-.001, .001), -.01, .01);
    }
  }
  if (trend && rng.chance(.12)) {
    const platform = rng.pick(net.social.platforms);
    events.push({ type: 'feed', text: `"${trend}" is trending on ${platform.name}.`, kind: 'info' });
  }
}

function osCadence(game, net, rng, events) {
  const os = net.os;
  os.uptimeWorld = Math.max(0, (game.worldMinutes || 0) - (os.bootWorld || 0));
  if (rng.chance(.04)) {
    const services = os.services.filter(s => s.enabled);
    const service = rng.pick(services);
    if (service) {
      service.status = service.status === 'running' ? 'degraded' : 'running';
      os.logs.unshift({ world: game.worldMinutes, level: service.status === 'running' ? 'info' : 'warn', unit: service.name, text: `${service.name} ${service.status === 'running' ? 'recovered' : 'entered a degraded state'}.` });
    }
  }
  if (rng.chance(.05)) {
    os.logs.unshift({ world: game.worldMinutes, level: 'info', unit: 'kernel', text: rng.pick(['TCP receive buffer autotuned.','Interface eth0 link state changed.','Scheduled TRIM completed.','Route cache flushed.']) });
  }
  bounded(os.logs, 120);
}

/* ---------------- public reads and actions ---------------- */
export function internetSummary(game) {
  const net = ensureInternet(game);
  const metrics = recomputeMetrics(game, net);
  return {
    net, metrics,
    protocols: net.protocols.slice().sort((a, b) => b.adoption - a.adoption),
    asns: net.asns.slice().sort((a, b) => b.trafficGbps - a.trafficGbps),
    ixps: net.ixps.slice().sort((a, b) => b.trafficGbps - a.trafficGbps),
    cables: net.cables.slice().sort((a, b) => b.capacityTbps - a.capacityTbps),
    datacenters: net.datacenters.slice().sort((a, b) => b.racks - a.racks),
    web: Object.values(net.web.records),
    apis: net.apis.slice().sort((a, b) => b.requests - a.requests),
    packages: net.packages.slice().sort((a, b) => b.weeklyDownloads - a.weeklyDownloads),
    models: net.ai.models.slice().sort((a, b) => b.quality - a.quality),
    endpoints: net.ai.endpoints.slice().sort((a, b) => b.requests - a.requests),
    advisories: net.security.advisories.slice().sort((a, b) => b.publishedWorld - a.publishedWorld),
    incidents: net.security.incidents.slice().sort((a, b) => b.startedWorld - a.startedWorld),
    platforms: net.social.platforms.slice().sort((a, b) => b.users - a.users),
    history: net.history.slice().reverse()
  };
}

export function protocolList(game) {
  return ensureInternet(game).protocols.slice().sort((a, b) => b.adoption - a.adoption);
}
export function networkOverview(game) {
  const net = ensureInternet(game);
  return {
    metrics: recomputeMetrics(game, net), asns: net.asns, ixps: net.ixps, cables: net.cables,
    datacenters: net.datacenters, protocols: net.protocols
  };
}
export function webList(game) {
  const net = ensureInternet(game);
  return Object.values(net.web.records).sort((a, b) => b.requestsPerMin - a.requestsPerMin);
}
export function webRecord(game, query) {
  const net = ensureInternet(game);
  const q = String(query || '').toLowerCase();
  const site = (game.sites || []).find(s => s.id === q || s.domain.toLowerCase() === q);
  if (site) return { site, record: net.web.records[site.id] || null };
  const record = Object.values(net.web.records).find(r => r.domain.toLowerCase() === q || r.siteId === q);
  return record ? { site: (game.sites || []).find(s => s.id === record.siteId) || null, record } : null;
}
export function resolveDomain(game, domain) {
  const hit = webRecord(game, domain);
  if (!hit) return { ok: false, error: `No record for ${domain}` };
  const cert = ensureInternet(game).certs.find(c => c.siteId === hit.site?.id);
  const apis = ensureInternet(game).apis.filter(a => a.siteId === hit.site?.id);
  return { ok: true, ...hit, cert, apis };
}
export function devEcosystem(game) {
  const net = ensureInternet(game);
  return {
    languages: net.dev.languages.slice().sort((a, b) => b.adoption - a.adoption),
    packages: net.packages.slice().sort((a, b) => b.weeklyDownloads - a.weeklyDownloads),
    ci: net.ci.slice(), builds: net.builds.slice(), releases: net.releases.slice().reverse(),
    deployments: net.deployments.slice().reverse(), registries: net.dev.registries
  };
}
export function aiEcosystem(game) {
  const net = ensureInternet(game);
  return {
    models: net.ai.models.slice().sort((a, b) => b.quality - a.quality),
    endpoints: net.ai.endpoints.slice().sort((a, b) => b.requests - a.requests),
    training: net.ai.training.slice().reverse(),
    vectorDbs: net.ai.vectorDbs.slice(), rag: net.ai.rag.slice()
  };
}
export function securityOverview(game) {
  const net = ensureInternet(game);
  const z = net.security.zeroTrust;
  return {
    advisories: net.security.advisories.slice().sort((a, b) => b.publishedWorld - a.publishedWorld),
    incidents: net.security.incidents.slice().sort((a, b) => b.startedWorld - a.startedWorld),
    sboms: net.security.sboms.slice(),
    zeroTrust: { ...z, score: Math.round((z.identity + z.device + z.network + z.workload + z.data) / 5) }
  };
}
export function socialOverview(game) {
  const net = ensureInternet(game);
  return { platforms: net.social.platforms.slice().sort((a, b) => b.users - a.users) };
}
export function internetHistory(game, opts = {}) {
  const net = ensureInternet(game);
  const q = String(opts.query || '').toLowerCase();
  let rows = net.history.slice().reverse();
  if (q) rows = rows.filter(h => `${h.title} ${h.body} ${h.category}`.toLowerCase().includes(q));
  return rows.slice(0, Math.max(1, Math.min(120, opts.limit || 40)));
}

function ownedSite(game, siteId) {
  const site = (game.sites || []).find(s => s.id === siteId || s.domain === siteId);
  if (!site) return { ok: false, error: 'No such site.' };
  if (site.ownerType !== 'player') return { ok: false, error: 'You do not control that site.' };
  return { ok: true, site };
}

export function playerHardenWebsite(game, siteId) {
  const net = ensureInternet(game);
  const own = ownedSite(game, siteId);
  if (!own.ok) return own;
  const record = net.web.records[own.site.id] || (net.web.records[own.site.id] = makeWebRecord(game, net, own.site, netRng(game, 0x33)));
  const cost = 180;
  if (!charge(game, cost, `web hardening · ${own.site.domain}`)) return { ok: false, error: `Hardening costs ${fmtMoney(cost)}.` };
  record.tls.enabled = true;
  record.tls.hsts = true;
  record.tls.version = 'TLS 1.3';
  record.securityHeaders = clamp(record.securityHeaders + 18, 0, 100);
  record.availability = clamp(record.availability + 1.2, 0, 99.999);
  record.errorRate = clamp(record.errorRate * .6, .00001, .25);
  record.accessibility = clamp(record.accessibility + 4, 0, 100);
  const z = net.security.zeroTrust;
  z.identity = clamp(z.identity + 1.2, 0, 99); z.network = clamp(z.network + 1.4, 0, 99); z.data = clamp(z.data + 1.2, 0, 99);
  recordHistory(net, 'security', `${game.player.handle} hardens ${own.site.domain}`, 'TLS, headers and error handling were tightened. Availability and trust improved.', { actors: ['player'], major: false });
  emitPlayerFeed(game, `Hardened ${own.site.domain}. Security headers ${Math.round(record.securityHeaders)}/100.`, 'good');
  return { ok: true, site: own.site, record, cost };
}

export function playerRenewCertificate(game, siteId) {
  const net = ensureInternet(game);
  const own = ownedSite(game, siteId);
  if (!own.ok) return own;
  let cert = net.certs.find(c => c.siteId === own.site.id);
  const cost = 40;
  if (!charge(game, cost, `certificate renewal · ${own.site.domain}`)) return { ok: false, error: `Renewal costs ${fmtMoney(cost)}.` };
  if (!cert) {
    cert = makeCert(own.site, net.web.records[own.site.id] || makeWebRecord(game, net, own.site, netRng(game, 0x44)), netRng(game, 0x45), game.worldMinutes);
    net.certs.push(cert); bounded(net.certs, NET_CAPS.certs);
  }
  cert.status = 'valid'; cert.validFromWorld = game.worldMinutes; cert.validToWorld = game.worldMinutes + 365 * DAY;
  cert.tlsVersion = 'TLS 1.3'; cert.autoRenew = true;
  const record = net.web.records[own.site.id];
  if (record) record.tls.enabled = true;
  recordHistory(net, 'security', `Certificate renewed for ${own.site.domain}`, 'A new TLS 1.3 certificate was issued and installed.', { actors: ['player'], major: false });
  return { ok: true, cert, site: own.site, cost };
}

export function playerAttachApi(game, siteId, opts = {}) {
  const net = ensureInternet(game);
  const own = ownedSite(game, siteId);
  if (!own.ok) return own;
  if (net.apis.length >= NET_CAPS.apis) return { ok: false, error: 'The API registry is full.' };
  const protocol = ['rest','graphql','websocket','grpc'].includes(opts.protocol) ? opts.protocol : 'rest';
  const cost = 120;
  if (!charge(game, cost, `api endpoint · ${own.site.domain}`)) return { ok: false, error: `Publishing an API costs ${fmtMoney(cost)}.` };
  const api = makeApi(own.site, netRng(game, 0x61), net.apis.length);
  api.protocol = protocol;
  api.path = opts.path || (protocol === 'graphql' ? '/graphql' : protocol === 'websocket' ? '/ws' : '/api/v1');
  api.version = opts.version || 'v1';
  api.auth = opts.auth || 'api-key';
  api.uptime = 99.9;
  api.requests = 0;
  net.apis.push(api);
  const record = net.web.records[own.site.id];
  if (record && !record.apis.includes(protocol)) record.apis.push(protocol);
  recordHistory(net, 'web', `${own.site.domain} publishes ${protocol.toUpperCase()} API`, `The endpoint ${api.path} is documented at ${api.version}.`, { actors: ['player'], major: false });
  return { ok: true, api, site: own.site, cost };
}

export function playerPublishPackage(game, name, version, language = 'javascript') {
  const net = ensureInternet(game);
  const clean = String(name || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 60);
  if (clean.length < 2) return { ok: false, error: 'Package name must be at least two characters.' };
  const registry = /python/.test(language) ? 'pypi' : /rust/.test(language) ? 'crates.io' : /go/.test(language) ? 'go.dev' : 'npm';
  if (net.packages.some(p => p.registry === registry && p.name === clean)) return { ok: false, error: `${registry} already has a package named ${clean}.` };
  if (net.packages.length >= NET_CAPS.packages) return { ok: false, error: 'The package registry is full.' };
  const cost = 60;
  if (!charge(game, cost, `package publish · ${clean}`)) return { ok: false, error: `Publishing costs ${fmtMoney(cost)}.` };
  const pkg = {
    id: nextId(net, 'pkg'), name: clean, language, registry, version: String(version || '0.1.0'),
    desc: 'Published from an operator workspace.', license: 'MIT', downloads: 0, weeklyDownloads: 0,
    stars: 0, maintainers: 1, dependencies: [], vulnerabilityCount: 0, deprecated: false,
    updatedWorld: game.worldMinutes, versions: [String(version || '0.1.0')]
  };
  net.packages.push(pkg);
  recordHistory(net, 'development', `${game.player.handle} publishes ${clean}`, `Version ${pkg.version} entered the ${registry} registry.`, { actors: ['player'], major: false });
  emitPlayerFeed(game, `Published ${clean}@${pkg.version} to ${registry}.`, 'good');
  return { ok: true, package: pkg, cost };
}

export function playerDeploySite(game, siteId, projectPath, opts = {}) {
  const net = ensureInternet(game);
  const own = ownedSite(game, siteId);
  if (!own.ok) return own;
  const cost = 90;
  if (!charge(game, cost, `deployment · ${own.site.domain}`)) return { ok: false, error: `Deployment costs ${fmtMoney(cost)}.` };
  const record = net.web.records[own.site.id] || (net.web.records[own.site.id] = makeWebRecord(game, net, own.site, netRng(game, 0x71)));
  const releaseId = nextId(net, 'release');
  const release = {
    id: releaseId, name: own.site.domain, version: opts.version || `2026.${String(net.releases.length + 1).padStart(2, '0')}`,
    project: projectPath || null, channel: 'production', status: 'deployed', publishedWorld: game.worldMinutes,
    notes: opts.notes || 'Operator deployment.', downloads: 0
  };
  net.releases.push(release); bounded(net.releases, NET_CAPS.releases);
  net.deployments.push({ id: nextId(net, 'deploy'), siteId: own.site.id, domain: own.site.domain, releaseId, project: projectPath || null, status: 'live', deployedWorld: game.worldMinutes, rollbackOf: null });
  bounded(net.deployments, NET_CAPS.deployments);
  record.status = 'live';
  record.stack = opts.stack || ['static'];
  record.availability = clamp(record.availability + 1.5, 0, 99.999);
  record.lastCheckWorld = game.worldMinutes;
  if (own.site) { own.site.status = 'live'; own.site.tech = opts.tech || own.site.tech; }
  recordHistory(net, 'development', `${own.site.domain} deployed`, `${projectPath || 'A workspace'} was published as release ${release.version}.`, { actors: ['player'], major: false });
  emitPlayerFeed(game, `Deployed ${own.site.domain} (${release.version}).`, 'good');
  return { ok: true, site: own.site, record, release, deployment: net.deployments[net.deployments.length - 1], cost };
}

export function playerTrainModel(game, name, baseModelId, computeHours = 200) {
  const net = ensureInternet(game);
  const base = net.ai.models.find(m => m.id === baseModelId) || net.ai.models[0];
  if (!base) return { ok: false, error: 'No base model available.' };
  if (net.ai.training.filter(t => t.status === 'training').length >= 12) return { ok: false, error: 'Too many active training runs.' };
  const hours = clamp(Number(computeHours) || 200, 10, 50000);
  const cost = Math.round(40 + hours * .9);
  if (!charge(game, cost, `model training · ${name}`)) return { ok: false, error: `Training costs ${fmtMoney(cost)}.` };
  const run = {
    id: nextId(net, 'train'), modelName: String(name || 'operator-model').slice(0, 40), baseModel: base.id,
    orgId: null, computeHours: hours, progress: 0, status: 'training', startedWorld: game.worldMinutes, resultQuality: null
  };
  net.ai.training.push(run); bounded(net.ai.training, NET_CAPS.training);
  recordHistory(net, 'ai', `${game.player.handle} starts training ${run.modelName}`, `A ${hours}-hour run is based on ${base.name}.`, { actors: ['player'], major: false });
  return { ok: true, run, base, cost };
}

export function playerDeployEndpoint(game, modelId, siteId, pricePerM = 2) {
  const net = ensureInternet(game);
  const own = ownedSite(game, siteId);
  if (!own.ok) return own;
  const model = net.ai.models.find(m => m.id === modelId || m.name.toLowerCase() === String(modelId).toLowerCase());
  if (!model) return { ok: false, error: 'No such model.' };
  if (net.ai.endpoints.length >= NET_CAPS.endpoints) return { ok: false, error: 'The endpoint registry is full.' };
  const cost = 150;
  if (!charge(game, cost, `AI endpoint · ${model.name}`)) return { ok: false, error: `Deployment costs ${fmtMoney(cost)}.` };
  const endpoint = {
    id: nextId(net, 'endpoint'), modelId: model.id, ownerId: 'player', ownerName: game.player.handle,
    region: own.site.countryId || 'novaria', pricePerM: clamp(Number(pricePerM) || 2, 0, 60),
    latencyMs: clamp(model.latencyMs || 160, 20, 900), throughput: 120, uptime: 99.9, requests: 0, status: 'live'
  };
  net.ai.endpoints.push(endpoint);
  recordHistory(net, 'ai', `${game.player.handle} serves ${model.name}`, `An inference endpoint was attached to ${own.site.domain}.`, { actors: ['player'], major: false });
  return { ok: true, endpoint, model, site: own.site, cost };
}

export function playerSecurityScan(game, target) {
  const net = ensureInternet(game);
  const q = String(target || '').toLowerCase();
  const site = (game.sites || []).find(s => s.id === q || s.domain.toLowerCase() === q);
  if (!site) return { ok: false, error: 'No such site.' };
  if (site.ownerType !== 'player') return { ok: false, error: 'Scan your own sites; scanning others is a security-testing action, not a deployment check.' };
  const cost = 25;
  if (!charge(game, cost, `security scan · ${site.domain}`)) return { ok: false, error: `A scan costs ${fmtMoney(cost)}.` };
  const record = net.web.records[site.id] || (net.web.records[site.id] = makeWebRecord(game, net, site, netRng(game, 0x81)));
  const findings = [];
  if (!record.tls.enabled) findings.push({ severity: 'high', text: 'TLS is disabled; certificates and transport are unencrypted.' });
  else if (record.tls.version === 'TLS 1.2' && !record.tls.hsts) findings.push({ severity: 'medium', text: 'TLS 1.2 without HSTS; consider TLS 1.3 and a strict transport policy.' });
  if (record.securityHeaders < 60) findings.push({ severity: 'medium', text: 'Security headers are incomplete (CSP, HSTS, frame ancestors).' });
  if (record.errorRate > .01) findings.push({ severity: 'medium', text: 'Error rate is elevated; stack traces may be exposed.' });
  if (record.accessibility < 55) findings.push({ severity: 'low', text: 'Accessibility checks fail on labels, contrast or focus order.' });
  const sbom = net.security.sboms.find(s => s.siteId === site.id) || (() => {
    const entry = { id: nextId(net, 'sbom'), siteId: site.id, domain: site.domain, components: 42, licenses: 8, critical: 0, lastScanWorld: game.worldMinutes, score: 70 };
    net.security.sboms.push(entry); return entry;
  })();
  sbom.lastScanWorld = game.worldMinutes;
  sbom.critical = findings.filter(f => f.severity === 'high').length;
  sbom.score = clamp(100 - findings.reduce((s, f) => s + (f.severity === 'high' ? 18 : f.severity === 'medium' ? 7 : 2), 0), 20, 100);
  recordHistory(net, 'security', `Security scan of ${site.domain}`, findings.length ? `${findings.length} finding(s) recorded.` : 'No material findings.', { actors: ['player'], major: false });
  return { ok: true, site, record, findings, sbom, cost };
}

export function playerMitigateIncident(game, incidentId) {
  const net = ensureInternet(game);
  const incident = net.security.incidents.find(i => i.id === incidentId);
  if (!incident) return { ok: false, error: 'No such incident.' };
  if (incident.status === 'resolved') return { ok: false, error: 'That incident is already resolved.' };
  const cost = incident.severity === 'critical' ? 900 : incident.severity === 'high' ? 520 : 220;
  if (!charge(game, cost, `incident response · ${incident.id}`)) return { ok: false, error: `Response costs ${fmtMoney(cost)}.` };
  incident.status = 'resolved'; incident.resolvedWorld = game.worldMinutes; incident.handledBy = game.player.handle;
  const record = net.web.records[incident.targetId];
  if (record) {
    record.availability = clamp(record.availability + 2, 0, 99.999);
    record.errorRate = clamp(record.errorRate * .5, .00001, .25);
  }
  const z = net.security.zeroTrust; z.workload = clamp(z.workload + 1.6, 0, 99); z.data = clamp(z.data + 1.2, 0, 99);
  game.player.reputation = clamp((game.player.reputation || 0) + 2, 0, 100);
  recordHistory(net, 'security', `${game.player.handle} resolves ${incident.id}`, `${incident.kind} at ${incident.targetName}: ${incident.impact}.`, { actors: ['player'], major: incident.severity === 'critical' });
  emitPlayerFeed(game, `Resolved incident ${incident.id}.`, 'good');
  return { ok: true, incident, cost };
}
