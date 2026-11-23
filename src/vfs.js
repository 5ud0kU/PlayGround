/* A serializable in-memory Unix-like filesystem. */

export const HOME = '/home/operator';

export function newDir(children = {}, opts = {}) {
  return { type: 'dir', mode: opts.mode || '755', owner: opts.owner || 'operator', mtime: opts.mtime || Date.now(), children };
}
export function newFile(content = '', opts = {}) {
  return {
    type: 'file', mode: opts.mode || '644', owner: opts.owner || 'operator',
    mtime: opts.mtime || Date.now(), content: String(content), exec: !!opts.exec,
    ...(opts.db ? { db: opts.db } : {}),
    ...(opts.meta ? { meta: opts.meta } : {})
  };
}

export function normalize(p) {
  const abs = p.startsWith('/');
  const parts = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') { if (parts.length) parts.pop(); }
    else parts.push(seg);
  }
  return (abs ? '/' : '') + parts.join('/');
}

export function resolvePath(cwd, input, home = HOME) {
  let p = String(input || '.').trim();
  if (!p) p = '.';
  if (p === '~') p = home;
  else if (p.startsWith('~/')) p = home + p.slice(1);
  if (p.startsWith('/')) return normalize(p);
  return normalize(cwd + '/' + p);
}
export function joinPath(...parts) { return normalize(parts.join('/')); }
export function basename(p) { const n = normalize(p); return n === '/' ? '/' : n.split('/').pop(); }
export function dirname(p) {
  const n = normalize(p);
  if (n === '/') return '/';
  const parts = n.split('/');
  parts.pop();
  return parts.length ? parts.join('/') || '/' : '/';
}
export function splitPath(p) { return normalize(p).split('/').filter(Boolean); }

export function getNode(root, abs) {
  const parts = splitPath(abs);
  let node = root;
  for (const part of parts) {
    if (!node || node.type !== 'dir' || !node.children[part]) return null;
    node = node.children[part];
  }
  return node;
}

export function exists(root, abs) { return !!getNode(root, abs); }
export function isDir(root, abs) { const n = getNode(root, abs); return !!n && n.type === 'dir'; }

export function ensureDir(root, abs, owner = 'operator') {
  const parts = splitPath(abs);
  let node = root;
  for (const part of parts) {
    if (!node.children[part]) node.children[part] = newDir({}, { owner });
    node = node.children[part];
    if (node.type !== 'dir') return null;
  }
  return node;
}

export function writeFile(root, abs, content, opts = {}) {
  const dir = ensureDir(root, dirname(abs), opts.owner || 'operator');
  if (!dir) return null;
  const name = basename(abs);
  const old = dir.children[name];
  if (old && old.type === 'dir') return null;
  const file = newFile(content, { owner: opts.owner || old?.owner || 'operator', mode: opts.mode || old?.mode || '644', exec: opts.exec ?? old?.exec, db: opts.db || old?.db, meta: opts.meta || old?.meta });
  if (opts.mtime) file.mtime = opts.mtime;
  dir.children[name] = file;
  return file;
}

export function readFile(root, abs) {
  const n = getNode(root, abs);
  return n && n.type === 'file' ? n.content : null;
}

export function listDir(root, abs) {
  const n = getNode(root, abs);
  if (!n || n.type !== 'dir') return null;
  return Object.entries(n.children)
    .map(([name, node]) => ({ name, node, isDir: node.type === 'dir' }))
    .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
}

export function removeNode(root, abs, recursive = false) {
  if (abs === '/') return { ok: false, error: 'cannot remove root' };
  const parent = getNode(root, dirname(abs));
  const name = basename(abs);
  if (!parent || parent.type !== 'dir' || !parent.children[name]) return { ok: false, error: 'No such file or directory' };
  const node = parent.children[name];
  if (node.type === 'dir' && Object.keys(node.children).length && !recursive) return { ok: false, error: 'Is a directory (use -r)' };
  delete parent.children[name];
  return { ok: true, node };
}

export function moveNode(root, from, to) {
  const src = getNode(root, from);
  if (!src) return { ok: false, error: 'No such file or directory' };
  if (from === '/') return { ok: false, error: 'cannot move root' };
  let target = to;
  if (isDir(root, to)) target = joinPath(to, basename(from));
  if (target === from) return { ok: true };
  if (target.startsWith(from + '/')) return { ok: false, error: 'cannot move a directory into itself' };
  const dstParent = ensureDir(root, dirname(target));
  if (!dstParent) return { ok: false, error: 'Not a directory' };
  const name = basename(target);
  if (dstParent.children[name]) return { ok: false, error: 'File exists' };
  removeNode(root, from, true);
  dstParent.children[name] = src;
  return { ok: true, target };
}

export function copyNode(root, from, to) {
  const src = getNode(root, from);
  if (!src) return { ok: false, error: 'No such file or directory' };
  let target = to;
  if (isDir(root, to)) target = joinPath(to, basename(from));
  if (target === from) return { ok: false, error: 'source and destination are the same file' };
  if (target.startsWith(from + '/')) return { ok: false, error: 'cannot copy a directory into itself' };
  const dstParent = ensureDir(root, dirname(target));
  if (!dstParent) return { ok: false, error: 'Not a directory' };
  const name = basename(target);
  if (dstParent.children[name]) return { ok: false, error: 'File exists' };
  dstParent.children[name] = cloneNode(src);
  return { ok: true, target };
}

export function cloneNode(node) {
  const copy = { ...node, children: node.children ? {} : undefined };
  if (node.children) for (const [k, v] of Object.entries(node.children)) copy.children[k] = cloneNode(v);
  return copy;
}

export function walk(root, abs, fn, depth = 0) {
  const n = getNode(root, abs);
  if (!n) return;
  fn(abs, n, depth);
  if (n.type === 'dir') for (const name of Object.keys(n.children).sort()) walk(root, joinPath(abs, name), fn, depth + 1);
}

export function allFiles(root, abs = '/') {
  const out = [];
  walk(root, abs, (p, n) => { if (n.type === 'file') out.push({ path: p, node: n }); });
  return out;
}

export function findFiles(root, start, pattern, nameOnly = false) {
  const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
  const out = [];
  walk(root, start, (p, n) => { if (re.test(nameOnly ? basename(p) : p)) out.push({ path: p, node: n }); });
  return out;
}

export function treeLines(root, abs, opts = {}) {
  const maxDepth = opts.depth ?? 4;
  const lines = [abs === '/' ? '/' : basename(abs)];
  function rec(path, prefix, depth) {
    if (depth > maxDepth) return;
    const list = listDir(root, path) || [];
    list.forEach((e, i) => {
      const last = i === list.length - 1;
      lines.push(prefix + (last ? '└── ' : '├── ') + e.name + (e.isDir ? '/' : ''));
      if (e.isDir) rec(joinPath(path, e.name), prefix + (last ? '    ' : '│   '), depth + 1);
    });
  }
  rec(abs, '', 0);
  return lines.join('\n');
}

export function sizeOf(node) {
  if (node.type === 'file') return new TextEncoder().encode(node.content || '').length;
  return Object.values(node.children || {}).reduce((s, n) => s + sizeOf(n), 0);
}

export function diskUsage(root, abs = '/') {
  const n = getNode(root, abs);
  return n ? sizeOf(n) : 0;
}

export function modeString(node) {
  const m = node.mode || '644';
  const type = node.type === 'dir' ? 'd' : node.exec ? '-' : '-';
  const chars = ['r', 'w', 'x'];
  let out = type;
  for (let i = 0; i < 3; i++) {
    const d = parseInt(m[i] || '0', 10);
    out += (d & 4 ? 'r' : '-') + (d & 2 ? 'w' : '-') + (d & 1 ? 'x' : '-');
  }
  return out;
}

export function makeLocalFS() {
  const root = newDir();
  for (const d of ['bin', 'boot', 'dev', 'etc', 'home', 'lib', 'media', 'mnt', 'opt', 'proc', 'root', 'run', 'sbin', 'srv', 'sys', 'tmp', 'usr', 'var']) {
    root.children[d] = newDir({}, { owner: 'root', mode: d === 'tmp' ? '1777' : '755' });
  }
  ensureDir(root, '/usr/bin', 'root');
  ensureDir(root, '/usr/local/bin', 'root');
  ensureDir(root, '/usr/share', 'root');
  ensureDir(root, '/var/log', 'root');
  ensureDir(root, '/var/www', 'root');
  ensureDir(root, '/var/lib', 'root');
  ensureDir(root, '/etc/ssh', 'root');
  ensureDir(root, '/etc/apt', 'root');
  ensureDir(root, '/home/operator', 'operator');
  ensureDir(root, '/home/operator/.config', 'operator');
  ensureDir(root, '/home/operator/.ssh', 'operator');
  ensureDir(root, '/home/operator/projects', 'operator');
  ensureDir(root, '/home/operator/notes', 'operator');
  ensureDir(root, '/home/operator/scripts', 'operator');
  ensureDir(root, '/home/operator/downloads', 'operator');
  ensureDir(root, '/home/operator/.local/bin', 'operator');

  writeFile(root, '/etc/hostname', 'voidbox\n', { owner: 'root', mode: '644' });
  writeFile(root, '/etc/hosts', '127.0.0.1\tlocalhost\n127.0.1.1\tvoidbox\n10.0.0.42\tvoidbox.lan voidbox\n', { owner: 'root' });
  writeFile(root, '/etc/os-release', 'PRETTY_NAME="Parrot Security 6.2 (lorikeet)"\nNAME="Parrot Security"\nVERSION_ID="6.2"\nVERSION_CODENAME=lorikeet\nID=parrot\nID_LIKE=debian\nHOME_URL="https://parrotsec.org/"\n', { owner: 'root' });
  writeFile(root, '/etc/resolv.conf', 'nameserver 10.0.0.1\nnameserver 203.0.113.10\nsearch nullnet\n', { owner: 'root' });
  writeFile(root, '/etc/apt/sources.list', 'deb https://deb.parrot.sh/parrot lorikeet main contrib non-free non-free-firmware\ndeb https://deb.debian.org/debian bookworm main contrib non-free\n', { owner: 'root' });
  writeFile(root, '/etc/ssh/ssh_config', 'Host *\n    HashKnownHosts yes\n    GSSAPIAuthentication yes\n', { owner: 'root' });
  writeFile(root, '/etc/motd', 'The network is not a place. It is a population.\n', { owner: 'root' });
  writeFile(root, '/var/log/syslog', 'Nov 22 09:14:02 voidbox systemd[1]: Started Daily apt download activities.\nNov 22 09:14:11 voidbox NetworkManager[611]: <info>  [device] state change: activated -> activated\n', { owner: 'root' });
  writeFile(root, '/var/log/auth.log', 'Nov 22 09:13:58 voidbox sshd[922]: Server listening on 0.0.0.0 port 22.\n', { owner: 'root' });
  writeFile(root, '/proc/cpuinfo', 'processor\t: 0\nvendor_id\t: AuthenticAMD\nmodel name\t: AMD Ryzen 5 5600 6-Core Processor\ncpu MHz\t\t: 3693.000\ncache size\t: 32768 KB\n', { owner: 'root' });
  writeFile(root, '/proc/meminfo', 'MemTotal:       16316344 kB\nMemFree:         6218744 kB\nMemAvailable:   11204312 kB\nSwapTotal:       2097148 kB\n', { owner: 'root' });
  writeFile(root, '/proc/version', 'Linux version 6.8.11-amd64 (debian-kernel@lists.debian.org) (gcc 12.2.0) #1 SMP PREEMPT_DYNAMIC\n', { owner: 'root' });

  writeFile(root, '/home/operator/README.txt', `WELCOME TO THE PERSISTENT NET
=============================

You are operator@voidbox. This machine is yours. The network beyond it
is not a game board: it is a population of systems and people that keep
working while you sleep.

Start here:
  help                 command index
  news                 what the network is talking about
  map                  inspect the live topology
  nmap -sV <host>      probe a machine
  contracts            look at the open contract board
  mail                 read your inbox
  cat notes/start.txt  a few practical notes

Everything is simulated. All companies, people, addresses and
vulnerabilities are fictional. No real network is reachable from here.

Your first month's rent is covered. After that, the world expects you
to participate.`, { owner: 'operator' });

  writeFile(root, '/home/operator/notes/start.txt', `FIELD NOTES / 01
----------------
The residential gateway at 10.0.0.1 is a good place to learn. It is
old, it is loud, and it belongs to you.

A contract is only a promise until someone does the work. Read the
objective. Deliver the artifact. Get paid.

Heat is real. A clean audit can be loud, but an intrusion leaves traces.
High heat attracts investigators, and investigators cost money.

Useful addresses:
  203.0.113.10   portal.nullnet     community hub / boards
  203.0.113.20   mail.nullnet       public mail relay
  203.0.113.30   market.nullnet     contract board
  203.0.113.40   git.nullnet        public repositories
  192.0.2.13     legacy.oldco.net   abandoned, reportedly
`, { owner: 'operator' });

  writeFile(root, '/home/operator/notes/leaked.txt', `Credential fragment recovered from an old paste. Treat as unverified.

host: 192.0.2.13 (legacy.oldco.net)
user: guest
pass: guest

host: 203.0.113.10 (portal.nullnet)
user: guest
pass: guest

The oldco box was decommissioned years ago. Nobody patched it.
`, { owner: 'operator', mode: '600' });

  writeFile(root, '/home/operator/projects/hello.py', `#!/usr/bin/env python3
# First contact with the simulated runtime.
name = "operator"
print("hello, " + name)
print("the network is alive")

total = 0
for i in range(1, 6):
    total = total + i
    print("tick", i, "sum", total)
`, { owner: 'operator', exec: true });

  writeFile(root, '/home/operator/projects/scan.py', `#!/usr/bin/env python3
# A tiny inventory checker. Run: python3 scan.py
hosts = ["10.0.0.1", "203.0.113.10", "192.0.2.13"]
for host in hosts:
    print("checking", host)
print("inventory complete:", len(hosts), "hosts")
`, { owner: 'operator', exec: true });

  writeFile(root, '/home/operator/projects/hello.c', `#include <stdio.h>

int main(void) {
    printf("hello from the machine\\n");
    for (int i = 0; i < 3; i++) {
        printf("iteration %d\\n", i);
    }
    return 0;
}
`, { owner: 'operator' });

  writeFile(root, '/home/operator/projects/notes.md', `# project notes

- [ ] finish the local inventory script
- [ ] find a first contract
- [ ] register a domain
- [ ] put something real online
`, { owner: 'operator' });

  writeFile(root, '/home/operator/scripts/motd.sh', `#!/usr/bin/env bash
echo "voidbox // $(date)"
echo "uptime: $(uptime -p)"
echo "keep the lights on."
`, { owner: 'operator', exec: true, mode: '755' });

  writeFile(root, '/home/operator/.bashrc', `# ~/.bashrc
export PS1='\\u@\\h:\\w\\$ '
export EDITOR=nano
alias ll='ls -la'
alias ports='ss -tulnp'
`, { owner: 'operator' });

  writeFile(root, '/home/operator/.ssh/known_hosts', '203.0.113.10 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINullNetPortalKeyFiction\n', { owner: 'operator', mode: '600' });
  writeFile(root, '/home/operator/.ssh/id_ed25519', '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\nQyNTUxOQAAACBpbnRlcm5ldC1wZXJzaXN0ZW50LXdvcmxkLWZpY3Rpb25hbC1rZXk=\n-----END OPENSSH PRIVATE KEY-----\n', { owner: 'operator', mode: '600' });
  writeFile(root, '/home/operator/.ssh/id_ed25519.pub', 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGludGVybmV0LXBlcnNpc3RlbnQtd29ybGQtZmljdGlvbmFsLWtleQ== operator@voidbox\n', { owner: 'operator', mode: '644' });

  return root;
}

export function makeRemoteFS(host, opts = {}) {
  const root = newDir();
  for (const d of ['bin', 'etc', 'home', 'opt', 'srv', 'tmp', 'usr', 'var']) root.children[d] = newDir({}, { owner: 'root' });
  ensureDir(root, '/etc', 'root');
  ensureDir(root, '/var/www', 'root');
  ensureDir(root, '/var/log', 'root');
  ensureDir(root, '/var/lib', 'root');
  ensureDir(root, '/opt', 'root');
  ensureDir(root, '/srv', 'root');
  ensureDir(root, `/home/${opts.user || 'admin'}`, opts.user || 'admin');
  writeFile(root, '/etc/hostname', host + '\n', { owner: 'root' });
  writeFile(root, '/etc/os-release', `PRETTY_NAME="${opts.os || 'Debian GNU/Linux 12 (bookworm)'}"\nID=debian\nVERSION_ID="12"\n`, { owner: 'root' });
  writeFile(root, '/etc/passwd', `root:x:0:0:root:/root:/bin/bash\n${opts.user || 'admin'}:x:1000:1000:${opts.user || 'admin'}:/home/${opts.user || 'admin'}:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\n`, { owner: 'root' });
  writeFile(root, '/etc/motd', opts.motd || `${host} — authorized access only.\n`, { owner: 'root' });
  writeFile(root, '/var/log/auth.log', `sshd[411]: Accepted publickey for ${opts.user || 'admin'} from 10.0.0.42 port 51022\n`, { owner: 'root' });
  writeFile(root, '/var/log/syslog', `${new Date().toUTCString()} ${host} systemd[1]: Reached target Multi-User System.\n`, { owner: 'root' });
  if (opts.webroot) {
    writeFile(root, '/var/www/html/index.html', opts.webroot, { owner: 'www-data' });
  }
  return root;
}
