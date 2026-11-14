import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rngFor(seed, salt = '') { return mulberry32((hashString(String(seed) + salt) >>> 0) || 1); }
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
export const chance = (rng, p) => rng() < p;
export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export const FIRST_NAMES_M = ['Arthur','Dale','Emmett','Frank','Gideon','Harold','Isaiah','Jasper','Lowell','Miles','Nolan','Otis','Porter','Quentin','Ray','Silas','Tobias','Vernon','Walter','Wendell','Abel','Calvin','Desmond','Edgar','Felix','Grant','Hollis','Ira','Julius','Levi'];
export const FIRST_NAMES_F = ['Ada','Beatrice','Celia','Doris','Edith','Faye','Greta','Hazel','Irene','Judith','Karen','Lorraine','Mabel','Nora','Opal','Pearl','Ruth','Sylvia','Tess','Vera','Willa','Agnes','Blythe','Constance','Delia','Estelle','Florence','Gloria','Harriet','Imogen'];
export const LAST_NAMES = ['Abbott','Barlow','Calder','Doyle','Ellery','Frost','Grady','Hale','Ives','Jarvis','Keller','Lowell','Mercer','Nash','Osborne','Pike','Quinn','Rourke','Sawyer','Thorne','Underwood','Vane','Ward','Yates','Ash','Bell','Crane','Dunn','Elder','Fenn','Holt','Marsh','Voss','Reeve','Stroud','Tamsin','Vale'];
export const EYES = ['grey','brown','hazel','pale blue','green','dark'];
export const HAIR = ['black','dark brown','auburn','sandy','grey','white','red','chestnut'];
export const PERSONALITIES = ['guarded','anxious','warm','abrasive','curious','devout','cynical','grieving','secretive','eager','tired','suspicious'];
export const SECRETS = [
  'owes money to the Rourke family','is having an affair with a councilman\'s spouse','has been sober for only three weeks',
  'saw something in the cemetery and has told no one','is not actually licensed to practise','has a brother who vanished nine years ago',
  'attends the chapel but does not believe','has been stealing from the collection plate','wants to leave town but cannot sell the house',
  'was paid to keep quiet about the mine survey','has been forging prescriptions at the hospital','is the one who called in the first body',
];

export function generateCitizens(rng, n = 620) {
  const list = [];
  const used = new Set();
  for (let i = 0; i < n; i++) {
    const sex = rng() < 0.49 ? 'f' : 'm';
    let name = '';
    for (let tries = 0; tries < 12; tries++) {
      const first = sex === 'f' ? pick(rng, FIRST_NAMES_F) : pick(rng, FIRST_NAMES_M);
      const last = pick(rng, LAST_NAMES);
      name = `${first} ${last}`;
      if (!used.has(name)) break;
    }
    used.add(name);
    const age = randInt(rng, 18, 78);
    const job = pick(rng, ['Machinist','Nurse','Teacher','Clerk','Welder','Mechanic','Cook','Bus driver','Accountant','Carpenter','Pharmacist','Janitor','Farmer','Shop owner','Bank teller','Electrician','Plumber','Sawmill worker','Dispatcher','Security guard','Retired','Unemployed']);
    const personality = pick(rng, PERSONALITIES);
    const belief = rng() < 0.32 ? 'Ninth Hour (believer)' : rng() < 0.1 ? 'Ninth Hour (Awakened)' : rng() < 0.4 ? 'lapsed' : rng() < 0.5 ? 'none' : 'Protestant';
    const sectRank = belief.startsWith('Ninth Hour') ? pick(rng, ['lay', 'lay', 'lay', 'choir', 'deacon']) : 'none';
    list.push({
      id: `c${i}`, name, sex, age, job, personality, belief, sectRank,
      secret: pick(rng, SECRETS), trust: randInt(rng, 35, 65),
      fear: randInt(rng, 10, 80), grief: randInt(rng, 0, 30),
      home: pick(rng, ['1st Street','2nd Street','Mill Row','Cedar Lane','Chapel Row','Foundry Hill','Riverside','Elm Court']),
      memory: [], interviewed: false, alive: true, missing: false,
    });
  }
  return list;
}

export function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function labelTexture(text, opts = {}) {
  const w = opts.w || 512, h = opts.h || 128;
  return makeCanvas(w, h, (ctx) => {
    ctx.fillStyle = opts.bg || 'rgba(12,14,14,0.92)';
    ctx.fillRect(0, 0, w, h);
    if (opts.border !== false) {
      ctx.strokeStyle = opts.borderColor || 'rgba(200,188,160,0.45)';
      ctx.lineWidth = 4; ctx.strokeRect(5, 5, w - 10, h - 10);
    }
    ctx.fillStyle = opts.color || '#ddd4bf';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = opts.font || `600 ${Math.floor(h * 0.42)}px "IBM Plex Mono", monospace`;
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

export function sigilTexture(inverted = false, color = '#8f2a1e') {
  return makeCanvas(512, 512, (ctx) => {
    ctx.clearRect(0, 0, 512, 512);
    ctx.save();
    ctx.translate(256, 256);
    if (inverted) ctx.rotate(Math.PI);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, 0, 205, 0.28, Math.PI * 2 - 0.28); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 180, 0, Math.PI * 2); ctx.setLineDash([4, 12]); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, -150); ctx.lineTo(-26, -190); ctx.lineTo(26, -190); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // stylised lamb skull
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-62, -52); ctx.bezierCurveTo(-62, -140, 62, -140, 62, -52);
    ctx.bezierCurveTo(62, 12, 30, 42, 0, 62); ctx.bezierCurveTo(-30, 42, -62, 12, -62, -52);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(-28, -48, 16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(28, -48, 16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-11, 20); ctx.lineTo(11, 20); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-50, -100); ctx.lineTo(-115, -145); ctx.moveTo(50, -100); ctx.lineTo(115, -145); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 380; i++) {
      const x = Math.random() * 512, y = Math.random() * 512;
      ctx.fillStyle = color; ctx.fillRect(x, y, 2 + Math.random() * 8, 2 + Math.random() * 5);
    }
  });
}

export function clockText(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = Math.floor(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
export function dayText(minutes) {
  const day = Math.floor(minutes / 1440) + 1;
  return `DAY ${day} — ${clockText(minutes)}`;
}
export function periodText(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  if (m < 300) return 'NIGHT';
  if (m < 420) return 'DAWN';
  if (m < 720) return 'MORNING';
  if (m < 1020) return 'AFTERNOON';
  if (m < 1140) return 'DUSK';
  if (m < 1350) return 'EVENING';
  return 'NIGHT';
}
export function timeAgo(fromMinutes, toMinutes) {
  const d = Math.max(0, Math.round(toMinutes - fromMinutes));
  if (d < 60) return `${d}m ago`;
  const h = Math.floor(d / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
export function degreesToRadians(d) { return d * Math.PI / 180; }
export function dist2D(x1, z1, x2, z2) { return Math.hypot(x1 - x2, z1 - z2); }

export function svgIcon(name, color = 'currentColor') {
  const paths = {
    police: '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" fill="none" stroke="COL" stroke-width="1.4"/><path d="M12 7v8M8 11h8" stroke="COL" stroke-width="1.4"/>',
    chapel: '<path d="M12 2v20M8 8h8M5 22V12l7-5 7 5v10" fill="none" stroke="COL" stroke-width="1.4"/>',
    library: '<path d="M4 4h7v16H4zM13 4h7v16h-7z" fill="none" stroke="COL" stroke-width="1.4"/><path d="M7 7v10M16 7v10" stroke="COL" stroke-width="1"/>',
    hospital: '<path d="M12 4v16M4 12h16" stroke="COL" stroke-width="2"/><rect x="3" y="3" width="18" height="18" fill="none" stroke="COL" stroke-width="1.2"/>',
    diner: '<path d="M5 4v7a3 3 0 006 0V4M8 4v16M16 4v16M16 4c3 1 3 6 0 7" fill="none" stroke="COL" stroke-width="1.3"/>',
    bar: '<path d="M6 3h12l-2 8H8L6 3zM12 11v9M8 21h8" fill="none" stroke="COL" stroke-width="1.3"/>',
    motel: '<path d="M3 20V9l9-5 9 5v11M7 20v-6h10v6" fill="none" stroke="COL" stroke-width="1.3"/><circle cx="9" cy="11" r="1" fill="COL"/>',
    scene: '<circle cx="12" cy="12" r="8" fill="none" stroke="COL" stroke-width="1.2" stroke-dasharray="3 3"/><path d="M12 8v8M8 12h8" stroke="COL" stroke-width="1.6"/>',
    home: '<path d="M4 11l8-7 8 7v9H4z" fill="none" stroke="COL" stroke-width="1.3"/>',
  };
  return (paths[name] || paths.scene).replaceAll('COL', color);
}
