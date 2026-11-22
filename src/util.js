/* Small deterministic helpers shared across the simulation. */

export function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const fn = mulberry32(typeof seed === 'string' ? hash32(seed) : seed >>> 0);
  return {
    next: fn,
    int(a, b) { return a + Math.floor(fn() * (b - a + 1)); },
    float(a, b) { return a + fn() * (b - a); },
    chance(p) { return fn() < p; },
    pick(arr) { return arr[Math.floor(fn() * arr.length)]; },
    picks(arr, n) {
      const copy = arr.slice();
      const out = [];
      while (copy.length && out.length < n) out.push(copy.splice(Math.floor(fn() * copy.length), 1)[0]);
      return out;
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(fn() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    hex(n = 8) {
      let s = '';
      for (let i = 0; i < n; i++) s += Math.floor(fn() * 16).toString(16);
      return s;
    },
    weighted(pairs) {
      const total = pairs.reduce((s, p) => s + p[1], 0);
      let r = fn() * total;
      for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
      return pairs[pairs.length - 1][0];
    }
  };
}

export function pick(arr, rng = Math.random) { return arr[Math.floor(rng() * arr.length)]; }
export function randInt(a, b, rng = Math.random) { return a + Math.floor(rng() * (b - a + 1)); }
export function chance(p, rng = Math.random) { return rng() < p; }
export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
export function uid(prefix = '') { return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

export function fmtMoney(n, sign = false) {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toLocaleString('en-US');
  if (v < 0) return '-$' + s;
  return (sign && v > 0 ? '+$' : '$') + s;
}
export function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.round(n).toLocaleString('en-US');
}
export function fmtBytes(n) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return (i === 0 ? Math.round(n) : n.toFixed(1)) + units[i];
}
export function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}
export function timeAgo(ts, now = Date.now()) {
  const d = Math.max(0, now - ts);
  if (d < 60000) return Math.floor(d / 1000) + 's';
  if (d < 3600000) return Math.floor(d / 60000) + 'm';
  if (d < 86400000) return Math.floor(d / 3600000) + 'h';
  return Math.floor(d / 86400000) + 'd';
}
export function pad(s, n, ch = ' ') { s = String(s); return s.length >= n ? s : s + ch.repeat(n - s.length); }
export function padLeft(s, n, ch = ' ') { s = String(s); return s.length >= n ? s : ch.repeat(n - s.length) + s; }
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function titleCase(s) { return String(s).replace(/\b\w/g, c => c.toUpperCase()); }
export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export function lineWrap(text, width) {
  const out = [];
  for (const para of String(text).split('\n')) {
    if (!para) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(' ')) {
      if ((line + ' ' + word).trim().length > width) { if (line) out.push(line); line = word; }
      else line = (line ? line + ' ' : '') + word;
    }
    out.push(line);
  }
  return out;
}
export function table(rows, gap = 2) {
  if (!rows.length) return '';
  const widths = [];
  for (const row of rows) row.forEach((cell, i) => { widths[i] = Math.max(widths[i] || 0, String(cell).length); });
  return rows.map(row => row.map((cell, i) => pad(String(cell), widths[i])).join(' '.repeat(gap)).trimEnd()).join('\n');
}
export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
export function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
export function randomSeed() { return Math.floor(Math.random() * 0xffffffff) >>> 0; }
export function hexSeed(n) { return n.toString(16).padStart(8, '0').toUpperCase(); }
export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}
export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
export function fmtDateTime(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function progressBar(pct, width = 14, fill = '█', empty = '░') {
  pct = clamp(pct, 0, 100);
  const n = Math.round(width * pct / 100);
  return fill.repeat(n) + empty.repeat(width - n);
}
