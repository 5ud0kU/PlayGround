/* INTERNET — Persistent World: browser shell, windows, apps and simulation loop. */
import {
  fmtMoney, fmtNum, fmtBytes, fmtDate, fmtTime, fmtDateTime, fmtDuration,
  esc, titleCase, timeAgo, clamp, progressBar, hash32
} from './util.js';
import {
  createGame, SAVE_KEY, WORLD_VERSION, tickWorld, simulateOffline, worldClock, threatInfo,
  reviveGame,
  marketIndex, onlineCount, unreadMail, getPlayerSkill, skillTitle, playerTitle, netWorth,
  ownedServers, playerSites, getServer, getSite, getNpc, getCompany, getContract,
  buyShopItem, registerDomain, deploySite, acceptContract, submitContract, objectiveSatisfied,
  patchServer, generateContract, updateDerived, sendPlayerMail, addFeed, contractStatusClass,
  mailPartners, randomEventLine, MINUTES_PER_DAY
} from './world.js';
import {
  findProvider, findPlan, cloudPrice, cloudLaunchItem, attachCloudInstance, findCloudInstance,
  removeCloudInstance, playerCloudServers, imageInfo, findContainer, runContainer, stopContainer,
  startContainer, removeContainer, createCluster, findCluster, applyWorkload, scaleWorkload,
  clusterPods, agentModel, agentRole, findAgent, deployAgent, setAgentStatus, assignAgent,
  agentDailyRevenue, agentDailyCost, playerCompany, registerCompany, launchProduct, companyValuation
} from './systems.js';
import {
  HOME, resolvePath, getNode, listDir, readFile, writeFile, ensureDir, removeNode,
  allFiles, sizeOf, modeString, basename, dirname, joinPath, isDir, exists
} from './vfs.js';
import {
  SHOP_ITEMS, ACHIEVEMENTS, CLOUD_PROVIDERS, CLOUD_PLANS, CONTAINER_IMAGES, AGENT_MODELS,
  AGENT_ROLES, PRODUCT_TEMPLATES
} from './data.js';
import {
  civilizationSummary, civHistory, civEventList, playerCountry, playerCity, activeLegalDisputes,
  playerProperties, playerBuyProperty, playerSellProperty, playerInsureProperty, playerRelease,
  playerLegalAction, educationFields, researchFields
} from './civilization.js';
import {
  languageFor, highlight, lint, formatCode, outline, completions, snippetsFor,
  analyzeProject, findInProject, projectTemplates, scaffoldProject, runCommandFor,
  testCommandFor, codingSummary, recordCoding, recordEdit
} from './coding.js';
import {
  internetSummary, networkOverview, devEcosystem, aiEcosystem, securityOverview, socialOverview,
  internetHistory, resolveDomain, webRecord, playerHardenWebsite, playerRenewCertificate, playerAttachApi,
  playerPublishPackage, playerTrainModel, playerDeployEndpoint, playerSecurityScan,
  playerMitigateIncident
} from './internet.js';
import { devOverview, playerPublishTool, playerLabSession, playerInspectSource } from './devworld.js';
import {
  societyOverview, citizenProfile, contentDetail, playerPurchaseContent, playerPublishContent
} from './society.js';
import {
  itOverview, componentCatalog, assembleRig, selectRig, setBios, stressTest, installOS,
  bootRig, createNetwork, addNetworkNode, connectNodes, configNode, testNetwork, testCircuit,
  createStudio, hireDeveloper, createGameProject, testGame, publishGame,
  createAIExperiment, benchmarkAI, diagnoseTicket, resolveTicket, attemptChallenge,
  marketplace, buyCollectible, skillOverview, takeCertification
} from './ituniverse.js';
import {
  interactionOverview, hardwareSummary, upgradeHardware, maintainHardware, HARDWARE_TIERS,
  cancelOperation, contactNpc, relationshipSummary, serverAdmin, issueInvoice, payInvoice,
  collectInvoice, placeOrder, cancelOrder, startOperation
} from './interaction.js';
import { execute, commandNames } from './shell.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const pad2 = n => String(n).padStart(2, '0');

const app = {
  game: null,
  windows: new Map(),
  zTop: 20,
  focused: null,
  saveTimer: null,
  lastTick: Date.now(),
  tickNo: 0,
  lastUnread: 0,
  knownAch: new Set(),
  lastLegal: 0,
  offlineReport: null,
  notifOpen: false,
  booted: false
};
window.INTERNET = app;

const layer = $('#windowLayer');
const monitor = $('#monitor');

/* ---------------- small helpers ---------------- */
function ic(name) { return `<svg class="ico"><use href="#i-${name}"/></svg>`; }
function tag(text, cls = '') { return `<span class="tag ${cls}">${esc(text)}</span>`; }
function pct(n) { return `${Math.round(clamp(Number(n) || 0, 0, 100))}%`; }
function relTime(ts) { return timeAgo(ts, Date.now()); }
function worldHHMM(minutes) {
  const m = ((Math.floor(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}
function statusTag(status) {
  const cls = status === 'online' ? 'g' : status === 'degraded' || status === 'maintenance' ? 'a' : 'r';
  return tag(status, cls);
}
function kindClass(kind) {
  return kind === 'good' ? 'g' : kind === 'bad' || kind === 'legal' ? 'r' : kind === 'work' || kind === 'warn' ? 'a' : kind === 'news' ? 'b' : '';
}
function siteForServer(server) {
  if (!server) return null;
  return app.game.sites.find(s => s.serverId === server.id) || null;
}
function serverOfSite(site) {
  if (!site || !site.serverId) return null;
  return app.game.servers.find(s => s.id === site.serverId) || null;
}
function safe(fn, fallback = '') {
  try { return fn(); } catch (e) { console.error(e); return fallback; }
}
function setText(sel, text) {
  const el = $(sel);
  if (el) el.textContent = text;
}

/* ---------------- persistence ---------------- */
function readSave() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { console.warn('localStorage unavailable', e); }
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (data && data.version === WORLD_VERSION && data.player && data.fs && data.servers) return { game: data, loaded: true };
    } catch (e) { console.warn('save parse failed', e); }
  }
  return { game: createGame(), loaded: false };
}

function trimWorld() {
  const g = app.game;
  if (!g) return;
  const open = g.contracts.filter(c => c.status === 'open');
  if (open.length > 60) {
    const keep = new Set(open.slice(-60).map(c => c.id));
    for (const c of open) if (!keep.has(c.id)) c.status = 'expired';
  }
  if (g.contracts.length > 150) {
    const active = g.contracts.filter(c => c.status === 'active');
    const open = g.contracts.filter(c => c.status === 'open').slice(-55);
    const closed = g.contracts.filter(c => c.status !== 'active' && c.status !== 'open').slice(-45);
    const keep = new Set([...active, ...open, ...closed].map(c => c.id));
    g.contracts = g.contracts.filter(c => keep.has(c.id));
  }
  if (g.feed.length > 80) g.feed.length = 80;
  if (g.mail.length > 120) g.mail = g.mail.slice(-120);
  if (g.news.length > 70) g.news.length = 70;
}

function saveGame(manual = false) {
  if (!app.game) return;
  clearTimeout(app.saveTimer);
  app.game.lastSaved = Date.now();
  app.game.lastActive = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(app.game));
    const st = $('#saveState');
    if (st) st.textContent = manual ? 'saved' : 'autosaved';
  } catch (e) {
    console.error(e);
    toast('Save failed', 'Local storage is full or unavailable.', 'r');
  }
  if (manual) toast('World saved', 'Persistent state written to local storage.', 'g');
}

function scheduleSave() {
  clearTimeout(app.saveTimer);
  app.saveTimer = setTimeout(() => saveGame(false), 1400);
}

function resetWorld() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { console.warn(e); }
  for (const win of app.windows.values()) {
    if (win.cleanup) safe(win.cleanup);
    win.el.remove();
  }
  app.windows.clear();
  app.focused = null;
  app.game = createGame();
  app.lastUnread = unreadMail(app.game);
  app.knownAch = new Set(Object.keys(app.game.achievements));
  app.lastLegal = app.game.legal.length;
  app.lastTick = Date.now();
  app.offlineReport = null;
  updateAll();
  openWindow('terminal');
  saveGame(true);
  toast('World reset', 'A new network has been generated.', 'a');
}

/* ---------------- toasts, modals, notifications ---------------- */
function toast(title, text, kind = '') {
  const root = $('#toastRoot');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<b>${esc(title)}</b>${esc(text)}`;
  root.appendChild(el);
  while (root.children.length > 4) root.firstElementChild.remove();
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(12px)'; }, 4800);
  setTimeout(() => el.remove(), 5100);
}

function closeModal() {
  const root = $('#modalRoot');
  if (!root) return;
  root.classList.remove('on');
  root.innerHTML = '';
  root.onclick = null;
}

function showModal({ title, eyebrow = '', body = '', actions = [], onMount = null }) {
  const root = $('#modalRoot');
  if (!root) return null;
  root.classList.add('on');
  root.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h3>${esc(title)}</h3><span class="eyebrow">${esc(eyebrow)}</span>
      <button class="tbtn small" data-modal-close="1" title="Close" style="margin-left:8px">${ic('close')}</button></div>
    <div class="modal-body">${body}</div>
    <div class="modal-foot"></div>
  </div>`;
  const modal = root.querySelector('.modal');
  const foot = root.querySelector('.modal-foot');
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = `tbtn ${a.kind === 'primary' ? 'primary' : a.kind === 'danger' ? 'danger' : ''}`;
    b.textContent = a.label;
    b.addEventListener('click', () => {
      let result = true;
      if (a.onClick) result = a.onClick(modal);
      if (result !== false && !a.keepOpen) closeModal();
    });
    foot.appendChild(b);
  }
  root.querySelector('[data-modal-close]').addEventListener('click', closeModal);
  root.onclick = e => { if (e.target === root) closeModal(); };
  if (onMount) onMount(modal, closeModal);
  const first = modal.querySelector('input,textarea,select');
  if (first) setTimeout(() => first.focus(), 50);
  return { modal, close: closeModal };
}

function formModal({ title, eyebrow = '', body = '', fields = [], submit = 'Save', onSubmit }) {
  const fieldsHtml = fields.map(f => {
    const label = `<label>${esc(f.label)}</label>`;
    if (f.type === 'select') {
      const opts = (f.options || []).map(o => `<option value="${esc(o.value)}"${String(o.value) === String(f.value) ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
      return `<div class="field">${label}<select class="input" name="${esc(f.name)}">${opts}</select></div>`;
    }
    if (f.type === 'textarea') {
      return `<div class="field">${label}<textarea class="input" name="${esc(f.name)}" rows="${f.rows || 5}" placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea></div>`;
    }
    return `<div class="field">${label}<input class="input" name="${esc(f.name)}" type="${f.type || 'text'}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}"></div>`;
  }).join('');
  return showModal({
    title, eyebrow, body: `${body}<div style="display:flex;flex-direction:column;gap:9px">${fieldsHtml}</div>`,
    actions: [
      { label: 'Cancel' },
      {
        label: submit, kind: 'primary', onClick: (modal) => {
          const vals = {};
          for (const f of fields) {
            const el = modal.querySelector(`[name="${f.name}"]`);
            vals[f.name] = el ? el.value.trim() : '';
          }
          return onSubmit(vals, modal);
        }
      }
    ]
  });
}

function buildNotifPanel() {
  let panel = $('#notifPanel');
  if (panel) return panel;
  panel = document.createElement('div');
  panel.id = 'notifPanel';
  panel.className = 'notif-panel';
  document.body.appendChild(panel);
  panel.addEventListener('click', e => {
    const mail = e.target.closest('[data-notif-mail]');
    if (mail) {
      closeNotif();
      openWindow('mail', { selectedId: Number(mail.dataset.notifMail) });
    }
    const work = e.target.closest('[data-notif-work]');
    if (work) { closeNotif(); openWindow('market'); }
  });
  return panel;
}

function closeNotif() {
  app.notifOpen = false;
  const panel = $('#notifPanel');
  if (panel) panel.classList.remove('on');
}

function toggleNotif() {
  const panel = buildNotifPanel();
  app.notifOpen = !app.notifOpen;
  if (!app.notifOpen) { panel.classList.remove('on'); return; }
  const g = app.game;
  const unread = g.mail.filter(m => !m.outbound && !m.read).slice(-8).reverse();
  const active = g.contracts.filter(c => c.status === 'active').slice(0, 4);
  const feed = g.feed.slice(0, 6);
  const parts = [];
  if (unread.length) {
    parts.push(`<div class="notif-item" style="font-family:var(--mono);font-size:8px;letter-spacing:.12em;color:var(--faint)">UNREAD MAIL</div>`);
    for (const m of unread) parts.push(`<div class="notif-item" data-notif-mail="${m.id}" style="cursor:pointer"><span class="tag g">MAIL</span><div><b style="color:var(--text2);font-weight:500">@${esc(m.from)}</b><small>${esc(m.subject)}</small></div></div>`);
  }
  if (active.length) {
    parts.push(`<div class="notif-item" style="font-family:var(--mono);font-size:8px;letter-spacing:.12em;color:var(--faint)">ACTIVE WORK</div>`);
    for (const c of active) parts.push(`<div class="notif-item" data-notif-work="1" style="cursor:pointer"><span class="tag a">JOB</span><div><b style="color:var(--text2);font-weight:500">${esc(c.id)}</b><small>${esc(c.title)}</small></div></div>`);
  }
  parts.push(`<div class="notif-item" style="font-family:var(--mono);font-size:8px;letter-spacing:.12em;color:var(--faint)">WORLD FEED</div>`);
  for (const f of feed) parts.push(`<div class="notif-item"><span class="tag ${kindClass(f.kind)}">${esc(f.kind)}</span><div>${esc(f.text)}<small>${worldHHMM(f.world)}</small></div></div>`);
  if (parts.length <= 1) parts.push('<div class="notif-item"><div>Nothing new. The network is quiet.</div></div>');
  panel.innerHTML = parts.join('');
  panel.classList.add('on');
}

function showOfflineReport(r) {
  if (!r) return;
  const hours = Math.round(r.worldMinutes / 60);
  const mailLines = (r.newMails || []).slice(0, 4).map(m => `<li><b>@${esc(m.from)}</b> — ${esc(m.subject)}</li>`).join('');
  const headlines = (r.headlines || []).slice(0, 3).map(h => `<li>${esc(h)}</li>`).join('');
  const incidents = (r.incidents || []).slice(0, 5).map(i => `<li>${esc(i.text)}</li>`).join('');
  const body = `<p>The network kept running while you were away. Here is what changed.</p>
    <div class="report-grid">
      <div class="report-cell"><span>WORLD TIME</span><b>${hours}h advanced</b></div>
      <div class="report-cell"><span>BALANCE</span><b>${fmtMoney(r.moneyDelta, true)}</b></div>
      <div class="report-cell"><span>NEW MAIL</span><b>${r.newMail} (${r.unread} unread)</b></div>
      <div class="report-cell"><span>NEW CONTRACTS</span><b>${r.newContracts}</b></div>
      <div class="report-cell"><span>NEW SITES</span><b>${r.newSites}</b></div>
      <div class="report-cell"><span>HEAT</span><b>${r.heatDelta >= 0 ? '+' : ''}${r.heatDelta}%</b></div>
    </div>
    ${headlines ? `<h4>Headlines</h4><ul>${headlines}</ul>` : ''}
    ${mailLines ? `<h4>New mail</h4><ul>${mailLines}</ul>` : ''}
    ${incidents ? `<h4>Incidents</h4><ul>${incidents}</ul>` : ''}
    <p class="dim" style="font-size:10px">The world continues in real time. Save often, or let autosave handle it.</p>`;
  showModal({
    title: 'While you were away', eyebrow: 'OFFLINE ACTIVITY REPORT', body,
    actions: [{ label: 'Enter the world', kind: 'primary' }]
  });
}

/* ---------------- clock + monitor ---------------- */
function updateClock() {
  if (!app.game) return;
  const g = app.game;
  const wc = worldClock(g);
  setText('#worldCycle', `CYCLE ${String(wc.cycle).padStart(3, '0')}`);
  setText('#worldClock', `${wc.hh}:${wc.mm}:${pad2(new Date().getSeconds())}`);
  setText('#worldDate', fmtDate(wc.date));
  setText('#worldLoad', `LOAD ${(onlineCount(g) / Math.max(1, g.servers.length)).toFixed(2)}`);
}

function updateMonitor() {
  if (!app.game) return;
  const g = app.game;
  const p = g.player;
  const th = threatInfo(g);
  const unread = unreadMail(g);
  const owned = ownedServers(g);
  const sites = playerSites(g);

  setText('#statNodes', fmtNum(g.servers.length));
  setText('#statNodesSub', `${g.servers.filter(s => s.status === 'online').length} online`);
  setText('#statUsers', fmtNum(onlineCount(g)));
  setText('#statMarket', fmtNum(marketIndex(g)));
  setText('#statMarketSub', g.market.sentiment);
  setText('#statThreat', th.label);
  const threatEl = $('#statThreat');
  if (threatEl) threatEl.style.color = th.color === 'red' ? 'var(--red)' : th.color === 'amber' ? 'var(--amber)' : 'var(--green)';
  setText('#statThreatSub', `heat ${Math.round(p.heat)}%`);

  const netLabel = $('#netLabel');
  const onlineRatio = g.servers.filter(s => s.status === 'online').length / Math.max(1, g.servers.length);
  if (netLabel) netLabel.textContent = th.level >= 4 ? 'UNSTABLE' : onlineRatio < .7 ? 'DEGRADED' : 'ONLINE';

  setText('#btnBalance', fmtMoney(p.money));
  setText('#userHandle', p.handle);
  setText('#userHost', p.host);
  setText('#opHandle', p.handle);
  setText('#opTitle', playerTitle(g));
  setText('#opRep', String(p.reputation));
  setText('#opMoney', fmtMoney(p.money));
  setText('#opContracts', String(g.stats.contracts));
  setText('#opMail', String(unread));
  setText('#heatVal', pct(p.heat));
  setText('#dockHeat', `heat ${Math.round(p.heat)}%`);
  const heatBar = $('#heatBar');
  if (heatBar) {
    heatBar.style.width = pct(p.heat);
    heatBar.style.background = p.heat >= 62 ? 'var(--red)' : p.heat >= 35 ? 'var(--amber)' : 'linear-gradient(90deg,var(--green2),var(--green))';
  }
  setText('#monFooter', `${onlineCount(g)} operators · ${owned.length} owned node${owned.length === 1 ? '' : 's'} · ${sites.length} site${sites.length === 1 ? '' : 's'}`);

  const feed = $('#feedList');
  if (feed) {
    feed.innerHTML = g.feed.slice(0, 5).map(f => `<div class="feed-item"><time>${worldHHMM(f.world)}</time><div><span class="tag ${kindClass(f.kind)}">${esc(f.kind)}</span>${esc(f.text)}</div></div>`).join('') || '<div class="empty-state">The wire is quiet.</div>';
  }
  const mini = $('#miniContracts');
  if (mini) {
    const jobs = g.contracts.filter(c => c.status === 'open' || c.status === 'active')
      .sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1) || b.pay - a.pay).slice(0, 4);
    mini.innerHTML = jobs.map(c => `<div class="mini-contract" data-open="market"><div><b>${esc(c.title)}</b><small>${esc(c.id)} · ${esc(c.clientHandle)}</small></div><span class="pay">${fmtMoney(c.pay)}</span></div>`).join('') || '<div class="empty-state" style="padding:8px">No open contracts.</div>';
  }
  const spark = $('#sparkNow');
  if (spark) spark.textContent = `${fmtNum(marketIndex(g))} ${g.market.sentiment}`;
  updateBadges();
  drawSparkline();
}

function updateBadges() {
  if (!app.game) return;
  const unread = unreadMail(app.game);
  const menu = $('#menuMailBadge');
  if (menu) menu.classList.toggle('on', unread > 0);
  const dock = $('#dockMailBadge');
  if (dock) { dock.textContent = String(unread); dock.classList.toggle('zero', unread === 0); }
  const notif = $('#notifCount');
  if (notif) { notif.textContent = String(unread); notif.classList.toggle('zero', unread === 0); }
}

function drawSparkline() {
  const canvas = $('#sparkline');
  if (!canvas || !app.game) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(60, Math.round(rect.width || 240));
  const h = Math.max(30, canvas.height || 58);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
  if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const data = app.game.market.history.slice(-70);
  if (data.length < 2) return;
  const min = Math.min(...data), max = Math.max(...data);
  const span = Math.max(1, max - min);
  const up = data[data.length - 1] >= data[0];
  const color = up ? '#79e6a3' : '#e06c75';
  ctx.strokeStyle = 'rgba(255,255,255,.045)';
  ctx.lineWidth = 1;
  for (let y = 0; y <= h; y += 14) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); ctx.stroke(); }
  const pt = i => [i / (data.length - 1) * w, h - 4 - (data[i] - min) / span * (h - 10)];
  ctx.beginPath();
  data.forEach((_, i) => { const [x, y] = pt(i); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, up ? 'rgba(121,230,163,.18)' : 'rgba(224,108,117,.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fill();
}

/* ---------------- global UI bindings ---------------- */
function bindGlobalUI() {
  $('#brandHome')?.addEventListener('click', () => openWindow('terminal'));
  $('#btnNetwork')?.addEventListener('click', () => openWindow('map'));
  $('#btnBalance')?.addEventListener('click', () => openWindow('profile'));
  $('#btnNotif')?.addEventListener('click', e => { e.stopPropagation(); toggleNotif(); });
  $('#userChip')?.addEventListener('click', () => openWindow('profile'));
  $('#btnSave')?.addEventListener('click', () => saveGame(true));

  document.addEventListener('click', e => {
    const opener = e.target.closest('[data-open]');
    if (opener) {
      e.preventDefault();
      openWindow(opener.dataset.open);
      return;
    }
    if (!e.target.closest('#btnNotif') && !e.target.closest('#notifPanel')) closeNotif();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const modal = $('#modalRoot');
      if (modal?.classList.contains('on')) { closeModal(); return; }
      if (app.notifOpen) closeNotif();
    }
    if (e.altKey && /^[1-9]$/.test(e.key)) {
      const items = $$('.dock-item');
      const item = items[Number(e.key) - 1];
      if (item) { e.preventDefault(); openWindow(item.dataset.open); }
    }
    if (e.altKey && e.key === '0') {
      const items = $$('.dock-item');
      const item = items[9];
      if (item) { e.preventDefault(); openWindow(item.dataset.open); }
    }
  });

  window.addEventListener('resize', () => {
    for (const win of app.windows.values()) win.el.classList.toggle('mobile-sheet', window.innerWidth <= 860);
    drawSparkline();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { saveGame(false); return; }
    const now = Date.now();
    const elapsed = now - app.lastTick;
    app.lastTick = now;
    if (elapsed > 30000 && app.game) {
      const mins = Math.min(240, Math.max(1, Math.round(elapsed / 2000)));
      tickWorld(app.game, mins);
      trimWorld();
      toast('World advanced', `${mins} world minutes passed while the tab was inactive.`, 'b');
      updateAll();
      scheduleSave();
    }
  });
  window.addEventListener('pagehide', () => saveGame(false));
  window.addEventListener('beforeunload', () => saveGame(false));
}

function updateAll() {
  updateClock();
  updateMonitor();
  updateDock();
  updateBadges();
}

/* ---------------- simulation loop ---------------- */
function tickLoop() {
  if (!app.game) return;
  const now = Date.now();
  let mins = 1;
  if (now - app.lastTick > 5000) mins = Math.min(120, Math.round((now - app.lastTick) / 2000));
  app.lastTick = now;
  app.tickNo++;
  try { tickWorld(app.game, mins); } catch (e) { console.error('tick failed', e); }
  trimWorld();

  const g = app.game;
  const unread = unreadMail(g);
  if (unread > app.lastUnread) {
    const latest = [...g.mail].reverse().find(m => !m.outbound && !m.read);
    if (latest) toast('New mail', `@${latest.from} — ${latest.subject}`, 'b');
  }
  app.lastUnread = unread;

  const newAch = Object.keys(g.achievements).filter(id => !app.knownAch.has(id));
  for (const id of newAch) {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (a) toast('Achievement unlocked', a.name, 'g');
    app.knownAch.add(id);
  }
  if (g.legal.length > app.lastLegal) {
    const ev = g.legal[g.legal.length - 1];
    if (ev) toast('Enforcement notice', `${fmtMoney(ev.fine)} fine — ${ev.reason}`, 'r');
    app.lastLegal = g.legal.length;
  }

  updateAll();
  if (app.tickNo % 3 === 0) softRefresh();
  if (app.tickNo % 9 === 0) saveGame(false);
}

function softRefresh() {
  updateClock();
  updateMonitor();
  for (const kind of ['market', 'servers', 'cloud', 'agents', 'processes', 'profile', 'map', 'dev', 'internet', 'workstation', 'society', 'itlab']) {
    const win = app.windows.get(kind);
    if (win && !win.minimized && win.render) safe(() => win.render());
  }
}

/* ---------------- window manager ---------------- */
const WINDOW_META = {
  terminal: { title: 'Terminal', sub: 'operator@voidbox', w: 760, h: 450 },
  terminal2: { title: 'Terminal 2', sub: 'operator@voidbox', w: 760, h: 450 },
  terminal3: { title: 'Terminal 3', sub: 'operator@voidbox', w: 760, h: 450 },
  terminal4: { title: 'Terminal 4', sub: 'operator@voidbox', w: 760, h: 450 },
  files: { title: 'Files', sub: '~/', w: 730, h: 480 },
  editor: { title: 'Editor', sub: 'untitled', w: 750, h: 510 },
  map: { title: 'Network', sub: 'live topology', w: 840, h: 530 },
  browser: { title: 'Browser', sub: 'portal.nullnet', w: 810, h: 550 },
  mail: { title: 'Mail', sub: 'inbox', w: 850, h: 530 },
  market: { title: 'Market', sub: 'contracts + infrastructure', w: 850, h: 550 },
  servers: { title: 'Servers', sub: 'network inventory', w: 850, h: 550 },
  cloud: { title: 'Cloud', sub: 'instances + orchestration', w: 880, h: 570 },
  agents: { title: 'Agents', sub: 'AI operations', w: 860, h: 570 },
  processes: { title: 'System', sub: 'processes', w: 770, h: 490 },
  profile: { title: 'Profile', sub: 'operator', w: 750, h: 570 },
  civ: { title: 'Civilization', sub: 'persistent world', w: 900, h: 600 },
  dev: { title: 'Developers', sub: 'autonomous software economy', w: 900, h: 600 },
  internet: { title: 'Internet', sub: 'architecture + ecosystem', w: 900, h: 600 },
  workstation: { title: 'Workstation', sub: 'hardware + operations + finance', w: 900, h: 600 },
  settings: { title: 'Settings', sub: 'system preferences', w: 620, h: 480 },
  society: { title: 'Society', sub: 'autonomous inhabitants', w: 920, h: 620 },
  itlab: { title: 'IT Universe', sub: 'builders, labs and challenges', w: 940, h: 640 },
  help: { title: 'Manual', sub: 'field guide', w: 810, h: 550 }
};

function setWindowMeta(win, title, sub) {
  const t = win.el.querySelector('.win-title b');
  if (t) t.textContent = title;
  const s = win.el.querySelector('.win-sub');
  if (s) s.textContent = sub || '';
}

function openWindow(kind, params = {}) {
  if (!WINDOW_META[kind]) return null;
  let win = app.windows.get(kind);
  if (win) {
    win.params = { ...win.params, ...params };
    if (win.minimized) { win.minimized = false; win.el.classList.remove('minimized'); }
    focusWindow(win);
    if (win.onParams) safe(() => win.onParams(params));
    if (win.render) safe(() => win.render());
    updateDock();
    return win;
  }

  const meta = WINDOW_META[kind];
  const rect = layer.getBoundingClientRect();
  const mobile = window.innerWidth <= 860;
  const width = Math.max(320, Math.min(meta.w, rect.width - 18));
  const height = Math.max(220, Math.min(meta.h, rect.height - 18));
  const idx = app.windows.size;
  const left = mobile ? 6 : Math.min(Math.max(8, 20 + (idx % 6) * 24), Math.max(8, rect.width - width - 12));
  const top = mobile ? 6 : Math.min(Math.max(8, 14 + (idx % 6) * 22), Math.max(8, rect.height - height - 12));

  const el = document.createElement('div');
  el.className = `window${mobile ? ' mobile-sheet' : ''}`;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.innerHTML = `<div class="win-head">
      <span class="win-mark"></span>
      <span class="win-title"><b>${esc(meta.title)}</b></span>
      <span class="win-sub">${esc(meta.sub)}</span>
      <div class="win-actions">
        <button data-win="min" title="Minimize">${ic('min')}</button>
        <button data-win="max" title="Maximize">${ic('max')}</button>
        <button data-win="close" class="close" title="Close">${ic('close')}</button>
      </div>
    </div>
    <div class="win-body"></div>
    <div class="win-status"></div>
    <div class="resize-handle"></div>`;
  layer.appendChild(el);

  win = {
    kind, el, params, minimized: false,
    body: el.querySelector('.win-body'),
    status: el.querySelector('.win-status'),
    title: meta.title, sub: meta.sub,
    render: null, onParams: null, onClose: null, cleanup: null
  };
  app.windows.set(kind, win);

  el.addEventListener('pointerdown', () => focusWindow(win), true);
  const head = el.querySelector('.win-head');
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    focusWindow(win);
    if (window.innerWidth > 860 && el.dataset.max !== '1') startDrag(win, e);
  });
  head.addEventListener('dblclick', e => { if (!e.target.closest('button')) toggleMax(win); });
  el.querySelector('[data-win="min"]').addEventListener('click', () => minimizeWindow(win));
  el.querySelector('[data-win="max"]').addEventListener('click', () => toggleMax(win));
  el.querySelector('[data-win="close"]').addEventListener('click', () => closeWindow(win));
  el.querySelector('.resize-handle').addEventListener('pointerdown', e => {
    if (window.innerWidth <= 860 || el.dataset.max === '1') return;
    startResize(win, e);
  });

  const mount = MOUNTS[kind];
  if (mount) safe(() => mount(win));
  focusWindow(win);
  updateDock();
  return win;
}

function focusWindow(win) {
  if (!win || !app.windows.has(win.kind)) return;
  win.el.style.zIndex = String(++app.zTop);
  for (const w of app.windows.values()) w.el.classList.toggle('focused', w === win);
  app.focused = win.kind;
  updateDock();
}

function minimizeWindow(win) {
  win.minimized = true;
  win.el.classList.add('minimized');
  if (app.focused === win.kind) {
    const next = [...app.windows.values()].filter(w => !w.minimized).sort((a, b) => Number(b.el.style.zIndex) - Number(a.el.style.zIndex))[0];
    if (next) focusWindow(next); else app.focused = null;
  }
  updateDock();
}

function closeWindow(win) {
  if (win.onClose && win.onClose() === false) return;
  if (win.cleanup) safe(win.cleanup);
  win.el.remove();
  app.windows.delete(win.kind);
  if (app.focused === win.kind) {
    app.focused = null;
    const next = [...app.windows.values()].filter(w => !w.minimized).sort((a, b) => Number(b.el.style.zIndex) - Number(a.el.style.zIndex))[0];
    if (next) focusWindow(next);
  }
  updateDock();
}

function toggleMax(win) {
  const el = win.el;
  if (el.dataset.max === '1') {
    const r = win.prevRect || {};
    el.style.left = r.left || '24px';
    el.style.top = r.top || '20px';
    el.style.width = r.width || `${WINDOW_META[win.kind].w}px`;
    el.style.height = r.height || `${WINDOW_META[win.kind].h}px`;
    el.dataset.max = '0';
  } else {
    win.prevRect = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
    el.style.left = '8px';
    el.style.top = '8px';
    el.style.width = 'calc(100% - 16px)';
    el.style.height = 'calc(100% - 16px)';
    el.dataset.max = '1';
  }
  if (win.render) safe(() => win.render());
}

function startDrag(win, e) {
  if (e.button !== 0) return;
  const startX = e.clientX, startY = e.clientY;
  const el = win.el;
  const parent = layer.getBoundingClientRect();
  const left = el.offsetLeft, top = el.offsetTop;
  const width = el.offsetWidth;
  const move = ev => {
    el.style.left = `${clamp(left + ev.clientX - startX, -width + 90, parent.width - 90)}px`;
    el.style.top = `${clamp(top + ev.clientY - startY, 0, parent.height - 34)}px`;
  };
  const up = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  e.preventDefault();
}

function startResize(win, e) {
  if (e.button !== 0) return;
  const startX = e.clientX, startY = e.clientY;
  const el = win.el;
  const parent = layer.getBoundingClientRect();
  const w0 = el.offsetWidth, h0 = el.offsetHeight;
  const move = ev => {
    el.style.width = `${clamp(w0 + ev.clientX - startX, 320, parent.width - el.offsetLeft - 4)}px`;
    el.style.height = `${clamp(h0 + ev.clientY - startY, 190, parent.height - el.offsetTop - 4)}px`;
  };
  const up = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    if (win.render) safe(() => win.render());
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  e.preventDefault();
}

function updateDock() {
  const active = new Set([...app.windows.values()].filter(w => !w.minimized).map(w => w.kind));
  for (const b of $$('.dock-item')) b.classList.toggle('active', active.has(b.dataset.open));
}

function refreshUI() {
  updateAll();
  for (const win of app.windows.values()) {
    if (win.render && !win.minimized) safe(() => win.render());
  }
  scheduleSave();
}

app.afterCommand = () => {
  updateAll();
  const termWin = app.windows.get('terminal');
  if (termWin?.term) updateTerminalChrome(termWin);
  refreshUI();
};

app.openWindow = openWindow;
app.saveGame = saveGame;
app.resetWorld = resetWorld;
app.refreshUI = refreshUI;
app.toast = toast;
app.showModal = showModal;

/* MOUNTS is populated below by each app. */
const MOUNTS = {};

/* ============================================================
   TERMINAL
   ============================================================ */
MOUNTS.terminal = function mountTerminal(win) {
  win.body.innerHTML = `<div class="term-toolbar">
      <button class="tbtn" data-term-cmd="help">help</button>
      <button class="tbtn" data-term-cmd="news">news</button>
      <button class="tbtn" data-term-cmd="contracts">contracts</button>
      <button class="tbtn" data-term-cmd="mail">mail</button>
      <button class="tbtn" data-term-cmd="map">map</button>
      <button class="tbtn" data-term-cmd="clear">clear</button>
      <div class="right"><span class="conn" data-term-conn>local</span><span data-term-cwd>~</span><span>bash</span><span data-term-hist>0 cmd</span></div>
    </div>
    <div class="term-body">
      <div class="term-scroll" data-term-scroll></div>
      <div class="term-input-row">
        <span class="term-prompt" data-term-prompt></span>
        <div class="term-input-wrap"><input class="term-input" data-term-input autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Terminal input"></div>
      </div>
    </div>`;

  const scroll = win.el.querySelector('[data-term-scroll]');
  const input = win.el.querySelector('[data-term-input]');
  const term = {
    localFS: app.game.fs,
    cwd: HOME,
    prevCwd: HOME,
    history: [],
    histIndex: 0,
    pending: null,
    remote: null,
    user: 'operator',
    host: 'voidbox',
    env: {},
    queue: [],
    busy: false,
    scroll,
    input,
    print(text = '', cls = '') { appendTermLine(scroll, text, cls); },
    clear() { scroll.innerHTML = ''; }
  };
  win.term = term;
  win.render = () => updateTerminalChrome(win);
  win.onFocus = () => setTimeout(() => input.focus(), 10);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const line = input.value;
      input.value = '';
      submitLine(term, line);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (term.histIndex > 0) {
        term.histIndex--;
        input.value = term.history[term.histIndex] || '';
        setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (term.histIndex < term.history.length - 1) {
        term.histIndex++;
        input.value = term.history[term.histIndex] || '';
      } else {
        term.histIndex = term.history.length;
        input.value = '';
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      completeInput(term);
      return;
    }
    if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      term.clear();
      updateTerminalChrome(win);
      return;
    }
    if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      if (term.pending) term.pending = null;
      appendTermLine(scroll, '^C', 'dim');
      input.value = '';
    }
  });

  scroll.addEventListener('click', () => input.focus());
  win.el.addEventListener('click', e => {
    const b = e.target.closest('[data-term-cmd]');
    if (b) submitLine(term, b.dataset.termCmd);
  });

  printBanner(term);
  updateTerminalChrome(win);
  setTimeout(() => input.focus(), 80);
};
MOUNTS.terminal2 = MOUNTS.terminal;
MOUNTS.terminal3 = MOUNTS.terminal;
MOUNTS.terminal4 = MOUNTS.terminal;

function appendTermLine(scroll, text, cls = '') {
  const nearBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 48;
  const lines = String(text ?? '').split('\n');
  for (const line of lines) {
    const div = document.createElement('div');
    div.className = `tline${cls ? ' ' + cls : ''}`;
    div.textContent = line;
    scroll.appendChild(div);
  }
  while (scroll.children.length > 2200) scroll.firstElementChild.remove();
  if (nearBottom) scroll.scrollTop = scroll.scrollHeight;
}

function promptHTML(term) {
  const cwd = term.cwd || HOME;
  const display = cwd === HOME ? '~' : cwd.startsWith(HOME + '/') ? '~' + cwd.slice(HOME.length) : cwd;
  const root = term.user === 'root';
  const userCls = root ? 'root' : 'u';
  return `<span class="${userCls}">${esc(term.user)}</span><span class="s">@</span><span class="h">${esc(term.host)}</span><span class="s">:</span><span class="p">${esc(display)}</span><span class="${userCls}">${root ? '#' : '$'}</span> `;
}

function appendEcho(term, line, mask = false) {
  const div = document.createElement('div');
  div.className = 'tline';
  div.innerHTML = promptHTML(term) + esc(mask ? '•'.repeat(Math.max(1, line.length)) : line);
  term.scroll.appendChild(div);
  term.scroll.scrollTop = term.scroll.scrollHeight;
}

function updateTerminalChrome(win) {
  if (!win || !win.term) return;
  const term = win.term;
  const prompt = win.el.querySelector('[data-term-prompt]');
  if (prompt) prompt.innerHTML = promptHTML(term);
  const conn = win.el.querySelector('[data-term-conn]');
  if (conn) {
    conn.textContent = term.remote ? `ssh ${term.remote.server.host}` : 'local';
    conn.classList.toggle('remote', !!term.remote);
  }
  const cwd = win.el.querySelector('[data-term-cwd]');
  if (cwd) cwd.textContent = term.cwd === HOME ? '~' : term.cwd;
  const hist = win.el.querySelector('[data-term-hist]');
  if (hist) hist.textContent = `${term.history.length} cmd`;
  const sub = term.remote ? `${term.user}@${term.remote.server.host}` : 'operator@voidbox';
  setWindowMeta(win, 'Terminal', sub);
  win.status.innerHTML = `<span>${term.remote ? 'remote session' : 'local session'}</span><span>${esc(term.cwd)}</span>
    <span class="st-right"><b>bash</b><span>${term.history.length} history</span><span>${term.remote ? esc(term.remote.server.ip) : '10.0.0.42'}</span></span>`;
}

async function submitLine(term, line) {
  term.queue.push(String(line ?? ''));
  if (term.busy) return;
  term.busy = true;
  if (term.input) term.input.disabled = true;
  while (term.queue.length) {
    const current = term.queue.shift();
    const mask = term.pending?.kind === 'ssh-password';
    appendEcho(term, current, mask);
    try {
      await execute(app, term, current);
    } catch (e) {
      console.error(e);
      term.print(`internal simulation error: ${e.message}`, 'err');
    }
    term.histIndex = term.history.length;
    const win = app.windows.get('terminal');
    if (win) updateTerminalChrome(win);
    if (term.input) term.input.value = '';
  }
  term.busy = false;
  if (term.input) {
    term.input.disabled = false;
    term.input.focus();
    term.scroll.scrollTop = term.scroll.scrollHeight;
  }
}

function completeInput(term) {
  const input = term.input;
  const value = input.value;
  const parts = value.split(/\s+/);
  const token = parts[parts.length - 1] || '';
  const atStart = parts.length === 1;
  let matches = [];
  if (atStart) {
    matches = commandNames().filter(c => c.startsWith(token));
  } else {
    const slash = token.lastIndexOf('/');
    const dirPart = slash >= 0 ? token.slice(0, slash + 1) : '';
    const base = slash >= 0 ? token.slice(slash + 1) : token;
    const abs = resolvePath(term.cwd, dirPart || '.', HOME);
    const entries = listDir(term.remote ? term.remote.server.fs : term.localFS, abs) || [];
    matches = entries.filter(e => e.name.startsWith(base)).map(e => dirPart + e.name + (e.isDir ? '/' : ''));
  }
  if (!matches.length) return;
  if (matches.length === 1) {
    parts[parts.length - 1] = matches[0];
    input.value = parts.join(' ') + (matches[0].endsWith('/') ? '' : ' ');
    return;
  }
  appendTermLine(term.scroll, matches.join('   '), 'dim');
  term.scroll.scrollTop = term.scroll.scrollHeight;
}

function printBanner(term) {
  const g = app.game;
  const wc = worldClock(g);
  term.print('INTERNET // PERSISTENT WORLD', 'head');
  term.print(`operator@voidbox — cycle ${String(wc.cycle).padStart(3, '0')}, ${wc.hh}:${wc.mm}`, 'dim');
  term.print('');
  term.print('The network is not a place. It is a population.', 'accent');
  term.print('It has been running without you.', 'dim');
  term.print('');
  term.print(`Balance ${fmtMoney(g.player.money)} · Reputation ${g.player.reputation} · Heat ${Math.round(g.player.heat)}% · Skill ${getPlayerSkill(g)} (${skillTitle(g)})`, 'info');
  term.print(`Type 'help' for the command index. 'mail' for your inbox. 'contracts' for work.`, 'dim');
  if (g.offline) term.print('The world advanced while you were away. Type news, or open the activity report from the bell.', 'warn');
  term.print('');
}

function runCommand(cmd, options = {}) {
  const win = openWindow('terminal');
  if (!win?.term) return;
  const term = win.term;
  if (options.clear) term.clear();
  submitLine(term, cmd);
  setTimeout(() => term.input?.focus(), 30);
}

/* ============================================================
   FILES
   ============================================================ */
MOUNTS.files = function mountFiles(win) {
  win.state = { cwd: win.params.path || HOME, selected: null };
  win.render = () => renderFiles(win);
  renderFiles(win);
  win.onParams = params => { if (params.path) { win.state.cwd = params.path; win.state.selected = null; renderFiles(win); } };
};

function fileIcon(entry) {
  if (entry.isDir) return ic('files');
  if (/\.(py|js|ts|html|css|c|sh|md|txt)$/.test(entry.name)) return ic('code');
  if (/\.(db|sqlite)$/.test(entry.name)) return ic('db');
  return ic('term');
}

function renderFiles(win) {
  const g = app.game;
  const st = win.state;
  if (!getNode(g.fs, st.cwd)) st.cwd = HOME;
  const entries = listDir(g.fs, st.cwd) || [];
  const quick = [
    ['Home', HOME, 'term'],
    ['Projects', `${HOME}/projects`, 'code'],
    ['Notes', `${HOME}/notes`, 'files'],
    ['Downloads', `${HOME}/downloads`, 'files'],
    ['/etc', '/etc', 'server'],
    ['/var/log', '/var/log', 'db'],
    ['/tmp', '/tmp', 'files'],
    ['/', '/', 'server']
  ];
  const side = quick.map(([label, path, icon]) => `<div class="side-item ${path === st.cwd ? 'on' : ''}" data-files-path="${esc(path)}">${ic(icon)}${esc(label)}</div>`).join('');
  const crumbs = [];
  const bits = st.cwd.split('/').filter(Boolean);
  crumbs.push(`<span class="crumb" data-files-path="/">/</span>`);
  let acc = '';
  for (const b of bits) {
    acc += '/' + b;
    crumbs.push(`<span class="crumb-sep">/</span><span class="crumb" data-files-path="${esc(acc)}">${esc(b)}</span>`);
  }

  const rows = [];
  if (st.cwd !== '/') rows.push(`<div class="file-row dir" data-files-name=".." data-files-dir="1"><span>${ic('arrow')}</span><span class="name">..</span><span class="size">—</span><span class="mode">—</span><span class="date">—</span></div>`);
  for (const e of entries) {
    const node = e.node;
    const sel = st.selected === e.name;
    rows.push(`<div class="file-row ${e.isDir ? 'dir' : ''} ${sel ? 'sel' : ''}" data-files-name="${esc(e.name)}" data-files-dir="${e.isDir ? 1 : 0}">
      <span>${fileIcon(e)}</span>
      <span class="name">${esc(e.name)}${e.isDir ? '/' : ''}</span>
      <span class="size">${e.isDir ? '—' : fmtBytes(sizeOf(node))}</span>
      <span class="mode">${esc(modeString(node))}</span>
      <span class="date">${fmtDate(node.mtime)}</span>
    </div>`);
  }

  win.body.innerHTML = `<div class="files-layout">
    <div class="files-side">${side}</div>
    <div class="files-main">
      <div class="app-toolbar">
        <button class="tbtn small" data-files-action="up" title="Parent">${ic('arrow')}</button>
        <button class="tbtn small" data-files-action="home">Home</button>
        <button class="tbtn small" data-files-action="open">Open</button>
        <span class="spacer"></span>
        <button class="tbtn small" data-files-action="newfile">${ic('plus')} File</button>
        <button class="tbtn small" data-files-action="newdir">${ic('plus')} Folder</button>
        <button class="tbtn small danger" data-files-action="delete">Delete</button>
        <button class="tbtn small" data-files-action="terminal">Terminal</button>
      </div>
      <div class="files-path">${crumbs.join('')}</div>
      <div class="file-head"><span></span><span>NAME</span><span>SIZE</span><span>MODE</span><span>MODIFIED</span></div>
      <div class="file-list">${rows.join('') || '<div class="empty-state"><b>Empty directory</b>Nothing here yet.</div>'}</div>
    </div>
  </div>`;

  for (const item of $$('[data-files-path]', win.body)) {
    item.addEventListener('click', () => {
      st.cwd = item.dataset.filesPath;
      st.selected = null;
      renderFiles(win);
    });
  }
  for (const row of $$('.file-row', win.body)) {
    row.addEventListener('click', () => {
      st.selected = row.dataset.filesName;
      for (const r of $$('.file-row', win.body)) r.classList.toggle('sel', r === row);
      updateFileStatus(win);
    });
    row.addEventListener('dblclick', () => openFileRow(win, row));
  }
  for (const b of $$('[data-files-action]', win.body)) {
    b.addEventListener('click', () => filesAction(win, b.dataset.filesAction));
  }
  updateFileStatus(win);
}

function updateFileStatus(win) {
  const st = win.state;
  const g = app.game;
  const entries = listDir(g.fs, st.cwd) || [];
  const selected = st.selected && st.selected !== '..' ? entries.find(e => e.name === st.selected) : null;
  win.status.innerHTML = `<span>${esc(st.cwd)}</span><span>${entries.length} item${entries.length === 1 ? '' : 's'}</span>
    <span class="st-right"><b>${selected ? esc(selected.name) : 'no selection'}</b><span>${selected ? (selected.isDir ? 'directory' : fmtBytes(sizeOf(selected.node))) : ''}</span></span>`;
}

function openFileRow(win, row) {
  const st = win.state;
  const name = row.dataset.filesName;
  if (name === '..') {
    st.cwd = dirname(st.cwd);
    st.selected = null;
    renderFiles(win);
    return;
  }
  const path = joinPath(st.cwd, name);
  if (row.dataset.filesDir === '1') {
    st.cwd = path;
    st.selected = null;
    renderFiles(win);
  } else {
    openWindow('editor', { path });
  }
}

function filesAction(win, action) {
  const st = win.state;
  const g = app.game;
  if (action === 'up') { st.cwd = dirname(st.cwd); st.selected = null; renderFiles(win); return; }
  if (action === 'home') { st.cwd = HOME; st.selected = null; renderFiles(win); return; }
  if (action === 'terminal') { runCommand(`cd "${st.cwd}"`); return; }
  if (action === 'open') {
    const row = $$('.file-row', win.body).find(r => r.dataset.filesName === st.selected);
    if (row) openFileRow(win, row);
    else toast('Files', 'Select a file or directory first.', 'a');
    return;
  }
  if (action === 'newfile' || action === 'newdir') {
    formModal({
      title: action === 'newfile' ? 'New file' : 'New directory',
      eyebrow: esc(st.cwd),
      fields: [{ name: 'name', label: 'Name', value: '', placeholder: action === 'newfile' ? 'notes.txt' : 'archive' }],
      submit: 'Create',
      onSubmit: vals => {
        const name = vals.name.trim();
        if (!name || name.includes('/')) { toast('Invalid name', 'Use a simple name without slashes.', 'r'); return false; }
        const path = joinPath(st.cwd, name);
        if (exists(g.fs, path)) { toast('Already exists', path, 'a'); return false; }
        if (action === 'newfile') writeFile(g.fs, path, '', { owner: 'operator' });
        else ensureDir(g.fs, path, 'operator');
        st.selected = name;
        renderFiles(win);
        refreshUI();
        toast(action === 'newfile' ? 'File created' : 'Directory created', path, 'g');
      }
    });
    return;
  }
  if (action === 'delete') {
    if (!st.selected || st.selected === '..') { toast('Files', 'Select something to delete.', 'a'); return; }
    const path = joinPath(st.cwd, st.selected);
    showModal({
      title: 'Delete item', eyebrow: 'IRREVERSIBLE',
      body: `<p>Remove <code>${esc(path)}</code>? This cannot be undone.</p>`,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Delete', kind: 'danger', onClick: () => {
            const res = removeNode(g.fs, path, true);
            if (!res.ok) toast('Delete failed', res.error, 'r');
            else { toast('Deleted', path, 'a'); st.selected = null; renderFiles(win); refreshUI(); }
          }
        }
      ]
    });
  }
}

/* ============================================================
   EDITOR
   ============================================================ */
MOUNTS.editor = function mountEditor(win) {
  win.state = { files: [], active: null, sideTab: 'outline', outline: [], problems: [] };
  win.render = () => renderEditor(win);
  win.onParams = params => { if (params.path) openEditorPath(win, params.path); else renderEditor(win); };
  win.onClose = () => {
    const dirty = win.state.files.filter(f => f.dirty);
    if (!dirty.length) return true;
    showModal({
      title: 'Unsaved changes', eyebrow: 'EDITOR',
      body: `<p>${dirty.length} buffer${dirty.length === 1 ? '' : 's'} contain unsaved changes.</p><p class="dim">${dirty.map(f => esc(f.path)).join('<br>')}</p>`,
      actions: [{ label: 'Stay' }, { label: 'Discard and close', kind: 'danger', onClick: () => { win.state.files.forEach(f => { f.dirty = false; }); closeWindow(win); } }]
    });
    return false;
  };
  if (win.params.path) openEditorPath(win, win.params.path);
  else renderEditor(win);
};

function openEditorPath(win, path) {
  const abs = path.startsWith('/') ? path : resolvePath(HOME, path);
  let file = win.state.files.find(f => f.path === abs);
  if (!file) {
    const content = readFile(app.game.fs, abs);
    file = { path: abs, content: content == null ? '' : content, dirty: content == null };
    win.state.files.push(file);
  }
  win.state.active = abs;
  renderEditor(win);
}

function renderEditor(win) {
  const st = win.state;
  if (!st.files.length) {
    win.body.innerHTML = `<div class="empty-state" style="margin:auto"><b>No file open</b>Open a file from Files, or create a new buffer.<br><br><button class="tbtn primary" data-ed-new="1">${ic('plus')} New buffer</button></div>`;
    win.body.querySelector('[data-ed-new]').addEventListener('click', () => newEditorBuffer(win));
    win.status.innerHTML = '<span>no buffer</span>';
    return;
  }
  if (!st.active || !st.files.some(f => f.path === st.active)) st.active = st.files[0].path;
  const active = st.files.find(f => f.path === st.active);

  if (!win.ed) {
    win.body.innerHTML = `<div class="editor-layout">
      <div class="editor-tabs" data-ed-tabs></div>
      <div class="app-toolbar ed-toolbar">
        <button class="tbtn small" data-ed-action="new">${ic('plus')} New</button>
        <button class="tbtn small primary" data-ed-action="save">${ic('save')} Save</button>
        <button class="tbtn small" data-ed-action="saveas">Save As</button>
        <button class="tbtn small" data-ed-action="format">Format</button>
        <button class="tbtn small" data-ed-action="lint">Lint</button>
        <button class="tbtn small" data-ed-action="run">Run</button>
        <button class="tbtn small" data-ed-action="test">Test</button>
        <span class="spacer"></span>
        <button class="tbtn small" data-ed-action="project">Project</button>
        <button class="tbtn small" data-ed-action="terminal">Terminal</button>
        <button class="tbtn small danger" data-ed-action="close">Close buffer</button>
      </div>
      <div class="editor-main">
        <div class="line-nums" data-ed-lines></div>
        <div class="editor-area"><pre class="editor-highlight" data-ed-highlight aria-hidden="true"></pre><textarea data-ed-area spellcheck="false" wrap="off"></textarea></div>
        <aside class="editor-side" data-ed-side></aside>
      </div>
    </div>`;
    const ed = {
      tabs: win.body.querySelector('[data-ed-tabs]'),
      area: win.body.querySelector('[data-ed-area]'),
      lines: win.body.querySelector('[data-ed-lines]'),
      highlight: win.body.querySelector('[data-ed-highlight]'),
      side: win.body.querySelector('[data-ed-side]')
    };
    win.ed = ed;
    ed.area.addEventListener('input', () => {
      const f = st.files.find(x => x.path === st.active);
      if (!f) return;
      f.content = ed.area.value;
      f.dirty = true;
      syncEditorLines(win);
      syncEditorOverlay(win);
      refreshEditorAnalysis(win);
      renderEditorTabs(win);
      updateEditorStatus(win);
    });
    ed.area.addEventListener('scroll', () => {
      ed.highlight.scrollTop = ed.area.scrollTop;
      ed.highlight.scrollLeft = ed.area.scrollLeft;
      ed.lines.scrollTop = ed.area.scrollTop;
    });
    ed.side.addEventListener('click', e => {
      const tab = e.target.closest('[data-ed-side-tab]');
      if (tab) { st.sideTab = tab.dataset.edSideTab; renderEditorSide(win); return; }
      const jump = e.target.closest('[data-ed-jump]');
      if (jump) {
        const line = Number(jump.dataset.edJump) || 1;
        const lines = ed.area.value.split('\n');
        const pos = lines.slice(0, line - 1).reduce((s, l) => s + l.length + 1, 0);
        ed.area.focus();
        ed.area.setSelectionRange(pos, pos);
        const lineHeight = parseFloat(getComputedStyle(ed.area).lineHeight) || 18;
        ed.area.scrollTop = Math.max(0, (line - 6) * lineHeight);
        ed.highlight.scrollTop = ed.area.scrollTop;
        ed.lines.scrollTop = ed.area.scrollTop;
        updateEditorStatus(win);
        return;
      }
      const snip = e.target.closest('[data-ed-snippet]');
      if (snip) { applyEditorSnippet(win, snip.dataset.edSnippet); }
    });
    ed.area.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = ed.area.selectionStart, end = ed.area.selectionEnd;
        ed.area.setRangeText('    ', start, end, 'end');
        ed.area.dispatchEvent(new Event('input'));
      }
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveActiveBuffer(win); }
    });
    ed.area.addEventListener('click', () => updateEditorStatus(win));
    ed.area.addEventListener('keyup', () => updateEditorStatus(win));
    for (const b of $$('[data-ed-action]', win.body)) b.addEventListener('click', () => editorAction(win, b.dataset.edAction));
  }

  if (win.ed.area.dataset.path !== active.path) {
    win.ed.area.value = active.content;
    win.ed.area.dataset.path = active.path;
    win.ed.area.scrollTop = 0;
  } else if (document.activeElement !== win.ed.area && win.ed.area.value !== active.content) {
    win.ed.area.value = active.content;
  }
  renderEditorTabs(win);
  syncEditorLines(win);
  syncEditorOverlay(win);
  refreshEditorAnalysis(win);
  updateEditorStatus(win);
  setWindowMeta(win, 'Editor', basename(active.path));
}

function activeEditorFile(win) {
  return (win.state.files || []).find(f => f.path === win.state.active) || null;
}
function editorLanguage(file) {
  return file ? languageFor(file.path, file.content) : languageFor('text');
}

function syncEditorOverlay(win) {
  const f = activeEditorFile(win);
  if (!f || !win.ed?.highlight) return;
  const lang = editorLanguage(f);
  win.ed.highlight.innerHTML = highlight(f.content, lang.id) + '\n';
  win.ed.highlight.scrollTop = win.ed.area.scrollTop;
  win.ed.highlight.scrollLeft = win.ed.area.scrollLeft;
}

function refreshEditorAnalysis(win) {
  const f = activeEditorFile(win);
  if (!f) return;
  const lang = editorLanguage(f);
  win.state.outline = outline(f.content, lang.id);
  win.state.problems = f.content.length > 180000 ? [] : lint(f.content, lang.id, f.path);
  renderEditorSide(win);
}

function renderEditorSide(win) {
  if (!win.ed?.side) return;
  const st = win.state;
  const f = activeEditorFile(win);
  const lang = f ? editorLanguage(f) : null;
  const tabs = [['outline','Outline'],['problems','Problems'],['snippets','Snippets'],['project','Project']];
  let body = '';
  if (!f) body = '<div class="ed-side-empty">Open a file to see its structure.</div>';
  else if (st.sideTab === 'outline') {
    body = st.outline.length
      ? st.outline.slice(0, 160).map(s => `<button class="ed-symbol" data-ed-jump="${s.line}" title="${esc(s.kind)} · line ${s.line}"><span class="ed-kind">${esc(s.kind)}</span><span>${esc(s.name)}</span><small>${s.line}</small></button>`).join('')
      : '<div class="ed-side-empty">No symbols detected in this file.</div>';
  } else if (st.sideTab === 'problems') {
    const errors = st.problems.filter(p => p.severity === 'error').length;
    const warnings = st.problems.filter(p => p.severity === 'warning').length;
    body = `<div class="ed-problem-summary">${errors} errors · ${warnings} warnings · ${st.problems.length} total</div>` +
      (st.problems.length ? st.problems.slice(0, 120).map(p => `<button class="ed-problem ${esc(p.severity)}" data-ed-jump="${p.line}" title="${esc(p.rule)}"><span>${esc(p.severity === 'error' ? '✕' : p.severity === 'warning' ? '!' : 'i')}</span><b>${esc(p.message)}</b><small>${p.line}:${p.col}</small></button>`).join('') : '<div class="ed-side-empty">No static findings. The source parses cleanly.</div>');
  } else if (st.sideTab === 'snippets') {
    body = snippetsFor(lang?.id || 'text').map(s => `<button class="ed-snippet" data-ed-snippet="${esc(s.body)}" title="Insert ${esc(s.label)}"><b>${esc(s.label)}</b><span>${esc(s.detail)}</span></button>`).join('') || '<div class="ed-side-empty">No snippets for this language.</div>';
  } else {
    const root = editorProjectRoot(f.path);
    const report = analyzeProject(app.game.fs, root);
    const level = codingSummary(app.game);
    body = `<div class="ed-project-head"><b>${esc(basename(root))}</b><span>${report.files} files · ${fmtNum(report.lines)} lines</span></div>
      <div class="ed-project-health"><span>Project health</span><b>${report.health}/100</b><div class="bar ${report.health < 45 ? 'red' : report.health < 70 ? 'amber' : ''}"><i style="width:${report.health}%"></i></div></div>
      <div class="ed-project-meta"><span>Languages</span>${report.languages.slice(0, 4).map(l => `<span>${esc(l.name)} ${l.files}</span>`).join('') || '<span>none</span>'}</div>
      <div class="ed-project-meta"><span>Tests</span><b>${report.hasTests ? 'yes' : 'no'}</b><span>Git</span><b>${report.hasGit ? 'yes' : 'no'}</b><span>TODO</span><b>${report.todos}</b></div>
      <div class="ed-project-checks">${report.checks.slice(0, 5).map(c => `<div>· ${esc(c)}</div>`).join('') || '<div>No immediate recommendations.</div>'}</div>
      <div class="ed-project-level">Coding level ${level.level} · ${level.xp} XP · streak ${level.streak}</div>`;
  }
  win.ed.side.innerHTML = `<div class="ed-side-tabs">${tabs.map(([id, label]) => `<button data-ed-side-tab="${id}" class="${st.sideTab === id ? 'on' : ''}">${label}</button>`).join('')}</div><div class="ed-side-body">${body}</div>`;
}

function editorProjectRoot(path) {
  let dir = dirname(path);
  for (let i = 0; i < 5 && dir && dir !== '/'; i++) {
    if (getNode(app.game.fs, joinPath(dir, '.git/repo.json')) || getNode(app.game.fs, joinPath(dir, 'package.json')) || getNode(app.game.fs, joinPath(dir, 'Makefile')) || getNode(app.game.fs, joinPath(dir, 'requirements.txt'))) return dir;
    dir = dirname(dir);
  }
  return dirname(path) || HOME;
}

function applyEditorSnippet(win, body) {
  const ed = win.ed;
  if (!ed) return;
  const text = String(body || '');
  const pos = ed.area.selectionStart;
  const end = ed.area.selectionEnd;
  const caret = text.indexOf('|');
  const insert = caret >= 0 ? text.slice(0, caret) + text.slice(caret + 1) : text;
  ed.area.setRangeText(insert, pos, end, 'end');
  ed.area.dispatchEvent(new Event('input'));
  if (caret >= 0) ed.area.setSelectionRange(pos + caret, pos + caret);
  ed.area.focus();
}

function renderEditorTabs(win) {
  if (!win.ed) return;
  const st = win.state;
  win.ed.tabs.innerHTML = st.files.map(f => `<div class="editor-tab ${f.path === st.active ? 'on' : ''}" data-ed-path="${esc(f.path)}" title="${esc(f.path)}">${f.dirty ? '<span class="dot"></span>' : ''}${esc(basename(f.path))}</div>`).join('');
  for (const tab of $$('[data-ed-path]', win.ed.tabs)) {
    tab.addEventListener('click', () => { st.active = tab.dataset.edPath; renderEditor(win); });
    tab.addEventListener('dblclick', () => closeEditorBuffer(win, tab.dataset.edPath));
  }
}

function syncEditorLines(win) {
  if (!win.ed) return;
  const f = win.state.files.find(x => x.path === win.state.active);
  if (!f) return;
  const count = Math.max(1, f.content.split('\n').length);
  win.ed.lines.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
  win.ed.lines.scrollTop = win.ed.area.scrollTop;
}

function updateEditorStatus(win) {
  const f = win.state.files.find(x => x.path === win.state.active);
  if (!f) { win.status.innerHTML = '<span>no buffer</span>'; return; }
  const area = win.ed?.area;
  let ln = 1, col = 1;
  if (area) {
    const upto = area.value.slice(0, area.selectionStart);
    const lines = upto.split('\n');
    ln = lines.length;
    col = lines[lines.length - 1].length + 1;
  }
  const lines = f.content.split('\n').length;
  const lang = editorLanguage(f);
  const problems = win.state.problems || [];
  const errors = problems.filter(p => p.severity === 'error').length;
  win.status.innerHTML = `<span>${esc(f.path)}</span><span>${esc(lang.name)} · ${lines} lines · ${f.content.length} chars</span>
    <span class="st-right"><span class="${errors ? 'status-err' : ''}">${errors ? errors + ' errors' : problems.length + ' findings'}</span><b>Ln ${ln}, Col ${col}</b><span>${f.dirty ? 'unsaved' : 'saved'}</span><span>UTF-8</span></span>`;
}

function editorAction(win, action) {
  const st = win.state;
  const f = st.files.find(x => x.path === st.active);
  if (action === 'new') { newEditorBuffer(win); return; }
  if (action === 'save') { saveActiveBuffer(win); return; }
  if (action === 'saveas') {
    if (!f) return;
    formModal({
      title: 'Save buffer as', fields: [{ name: 'path', label: 'Path', value: f.path }], submit: 'Save',
      onSubmit: vals => {
        const abs = vals.path.startsWith('/') ? vals.path : resolvePath(HOME, vals.path);
        const old = readFile(app.game.fs, abs);
        writeFile(app.game.fs, abs, f.content, { owner: 'operator' });
        recordEdit(app.game, abs, old || '', f.content);
        const delta = Math.max(0, f.content.split('\n').length - (old == null ? 0 : old.split('\n').length));
        app.game.stats.codeLines += delta;
        f.path = abs; f.dirty = false; st.active = abs;
        renderEditor(win); refreshUI();
        toast('Saved', abs, 'g');
      }
    });
    return;
  }
  if (action === 'close') { closeEditorBuffer(win, st.active); return; }
  if (action === 'terminal') { runCommand(`cd "${dirname(st.active || HOME)}"`); return; }
  if (action === 'format') {
    if (!f) return;
    const formatted = formatCode(f.content, editorLanguage(f).id);
    if (formatted === f.content) { toast('Formatted', 'Already in canonical form.', 'b'); return; }
    recordEdit(app.game, f.path, f.content, formatted);
    f.content = formatted; f.dirty = true;
    if (win.ed.area.dataset.path === f.path) win.ed.area.value = formatted;
    syncEditorLines(win); syncEditorOverlay(win); refreshEditorAnalysis(win); updateEditorStatus(win);
    toast('Formatted', basename(f.path), 'g');
    return;
  }
  if (action === 'lint') { st.sideTab = 'problems'; refreshEditorAnalysis(win); return; }
  if (action === 'outline') { st.sideTab = 'outline'; renderEditorSide(win); return; }
  if (action === 'snippets') { st.sideTab = 'snippets'; renderEditorSide(win); return; }
  if (action === 'project') { st.sideTab = 'project'; renderEditorSide(win); return; }
  if (action === 'test') {
    if (!f) return;
    const cmd = testCommandFor(f.path, editorLanguage(f).id);
    if (!cmd) { toast('No test runner', 'This language has no simulated test command.', 'a'); return; }
    recordCoding(app.game, 'test', 1, f.path);
    runCommand(cmd);
    return;
  }
  if (action === 'run') {
    if (!f) return;
    const spec = runCommandFor(f.path, editorLanguage(f).id);
    recordCoding(app.game, spec.kind === 'build' ? 'compile' : 'run', 1, f.path);
    if (spec.kind === 'preview') openWindow('browser', { url: 'home' });
    else if (spec.command) runCommand(spec.command);
    else toast('No runtime', 'This file type has no simulated runtime.', 'a');
  }
}

function newEditorBuffer(win) {
  const n = win.state.files.length + 1;
  let path = `${HOME}/untitled-${n}.txt`;
  let i = n;
  while (win.state.files.some(f => f.path === path)) path = `${HOME}/untitled-${++i}.txt`;
  win.state.files.push({ path, content: '', dirty: true });
  win.state.active = path;
  renderEditor(win);
  setTimeout(() => win.ed?.area.focus(), 40);
}

function saveActiveBuffer(win) {
  const f = win.state.files.find(x => x.path === win.state.active);
  if (!f) return;
  const old = readFile(app.game.fs, f.path);
  writeFile(app.game.fs, f.path, f.content, { owner: 'operator' });
  recordEdit(app.game, f.path, old || '', f.content);
  const delta = Math.max(0, f.content.split('\n').length - (old == null ? 0 : old.split('\n').length));
  app.game.stats.codeLines += delta;
  f.dirty = false;
  renderEditorTabs(win);
  updateEditorStatus(win);
  refreshUI();
  toast('Saved', f.path, 'g');
}

function closeEditorBuffer(win, path) {
  const f = win.state.files.find(x => x.path === path);
  if (!f) return;
  const remove = () => {
    win.state.files = win.state.files.filter(x => x.path !== path);
    if (win.state.active === path) win.state.active = win.state.files[0]?.path || null;
    renderEditor(win);
  };
  if (!f.dirty) { remove(); return; }
  showModal({
    title: 'Discard changes?', eyebrow: 'EDITOR', body: `<p>Close <code>${esc(path)}</code> without saving?</p>`,
    actions: [{ label: 'Cancel' }, { label: 'Discard', kind: 'danger', onClick: remove }]
  });
}

/* ============================================================
   NETWORK MAP
   ============================================================ */
const MAP_COLORS = { online: '#79e6a3', degraded: '#e0b15a', maintenance: '#6ea8ff', offline: '#e06c75' };

MOUNTS.map = function mountMap(win) {
  win.state = { selected: null };
  win.body.innerHTML = `<div class="map-layout">
    <canvas id="mapCanvas"></canvas>
    <div class="map-side" data-map-side></div>
    <div class="map-tip" data-map-tip>click a node to inspect</div>
  </div>`;
  const canvas = win.body.querySelector('canvas');
  const side = win.body.querySelector('[data-map-side]');
  const tip = win.body.querySelector('[data-map-tip]');
  const map = { canvas, ctx: canvas.getContext('2d'), nodes: [], selected: null, hover: null, raf: 0, w: 0, h: 0, side, tip };
  win.map = map;
  win.render = () => { layoutMap(win); renderMapSide(win); };
  layoutMap(win);
  renderMapSide(win);

  const ro = new ResizeObserver(() => layoutMap(win));
  ro.observe(win.body.querySelector('.map-layout'));
  win.cleanup = () => { ro.disconnect(); cancelAnimationFrame(map.raf); };

  canvas.addEventListener('click', e => {
    const n = nearestNode(win, e);
    map.selected = n ? n.s.id : null;
    renderMapSide(win);
  });
  canvas.addEventListener('mousemove', e => {
    const n = nearestNode(win, e);
    map.hover = n ? n.s.id : null;
    canvas.style.cursor = n ? 'pointer' : 'crosshair';
    tip.textContent = n ? `${n.s.host} · ${n.s.ip} · ${n.s.status}` : 'click a node to inspect';
  });
  canvas.addEventListener('mouseleave', () => { map.hover = null; tip.textContent = 'click a node to inspect'; });
  side.addEventListener('click', e => {
    const b = e.target.closest('[data-map-action]');
    if (!b) return;
    const s = app.game.servers.find(x => x.id === b.dataset.host);
    if (!s) return;
    const action = b.dataset.mapAction;
    if (action === 'browser') {
      const site = siteForServer(s);
      if (site) openWindow('browser', { url: site.domain });
      else toast('No site', `${s.host} has no public site indexed.`, 'a');
      return;
    }
    if (action === 'inspect') { map.selected = s.id; renderMapSide(win); return; }
    const cmds = { nmap: `nmap -sV ${s.host}`, ssh: `ssh ${s.host}`, audit: `audit ${s.host}`, patch: `patch ${s.host}` };
    if (cmds[action]) runCommand(cmds[action]);
  });

  const loop = () => {
    if (!win.el.isConnected) return;
    drawMap(win);
    map.raf = requestAnimationFrame(loop);
  };
  map.raf = requestAnimationFrame(loop);
};

function layoutMap(win) {
  const m = win.map;
  if (!m) return;
  const canvas = m.canvas;
  const w = Math.max(120, canvas.clientWidth || 400);
  const h = Math.max(120, canvas.clientHeight || 300);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (m.w !== w || m.h !== h || canvas.width !== Math.round(w * dpr)) {
    m.w = w; m.h = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    m.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const servers = app.game.servers;
  const cols = Math.max(10, Math.ceil(Math.sqrt(servers.length * 1.85)));
  const rows = Math.ceil(servers.length / cols);
  const padX = 26, padY = 24;
  const cellW = (w - padX * 2) / Math.max(1, cols - 1);
  const cellH = (h - padY * 2) / Math.max(1, rows - 1);
  m.nodes = servers.map((s, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const jx = ((hash32(s.id) % 1000) / 1000 - .5) * cellW * .22;
    const jy = ((hash32(s.id + 'y') % 1000) / 1000 - .5) * cellH * .22;
    return {
      s,
      x: padX + col * cellW + jx,
      y: padY + row * cellH + jy,
      r: s.owned ? 6.5 : s.host === 'home-gw' ? 6 : s.host === 'cybernet' ? 5 : 3
    };
  });
}

function nearestNode(win, e) {
  const m = win.map;
  const rect = m.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  let best = null, bestD = 16;
  for (const n of m.nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

function drawMap(win) {
  const m = win.map;
  if (!m) return;
  const { ctx, w, h, nodes } = m;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#080c0f';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,.028)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 28) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); ctx.stroke(); }

  const gateway = nodes.find(n => n.s.host === 'home-gw');
  if (gateway) {
    for (const n of nodes) {
      if (n === gateway) continue;
      ctx.beginPath();
      ctx.moveTo(gateway.x, gateway.y);
      ctx.lineTo(n.x, n.y);
      ctx.strokeStyle = m.selected === n.s.id ? 'rgba(99,200,232,.32)' : 'rgba(121,230,163,.045)';
      ctx.lineWidth = m.selected === n.s.id ? 1.1 : .6;
      ctx.stroke();
    }
  }

  for (const n of nodes) {
    const s = n.s;
    const color = MAP_COLORS[s.status] || '#8a99a3';
    const selected = m.selected === s.id;
    const hover = m.hover === s.id;
    if (selected || hover) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + 5, 0, Math.PI * 2);
      ctx.fillStyle = selected ? 'rgba(99,200,232,.13)' : 'rgba(255,255,255,.06)';
      ctx.fill();
    }
    if (s.owned) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + 2.4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(99,200,232,.72)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = s.status === 'offline' ? .55 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (s.compromised) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, Math.max(1.2, n.r * .4), 0, Math.PI * 2);
      ctx.fillStyle = '#e06c75';
      ctx.fill();
    }
    if (selected) {
      const pulse = 2 + (Math.sin(performance.now() / 320) + 1) * 1.4;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + pulse + 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(99,200,232,.65)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  ctx.font = '7px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  for (const n of nodes) {
    const s = n.s;
    const label = s.owned || s.host === 'home-gw' || s.host === 'cybernet' || m.selected === s.id || m.hover === s.id;
    if (!label) continue;
    ctx.fillStyle = m.selected === s.id ? '#cfeef8' : 'rgba(200,220,228,.62)';
    ctx.fillText(s.host, n.x + n.r + 4, n.y);
  }

  ctx.font = '7px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(120,140,150,.55)';
  ctx.fillText(`${app.game.servers.length} nodes · ${app.game.servers.filter(s => s.status === 'online').length} online · ${ownedServers(app.game).length} owned`, 10, h - 9);
}

function renderMapSide(win) {
  const m = win.map;
  if (!m) return;
  const side = m.side;
  const g = app.game;
  if (!m.selected) {
    const th = threatInfo(g);
    side.innerHTML = `<h3>NETWORK PULSE</h3>
      <div class="kv">
        <dt>nodes</dt><dd>${g.servers.length} indexed</dd>
        <dt>online</dt><dd>${g.servers.filter(s => s.status === 'online').length}</dd>
        <dt>owned</dt><dd>${ownedServers(g).length}</dd>
        <dt>operators</dt><dd>${onlineCount(g)}</dd>
        <dt>threat</dt><dd style="color:${th.color === 'red' ? 'var(--red)' : th.color === 'amber' ? 'var(--amber)' : 'var(--green)'}">${th.label}</dd>
      </div>
      <div class="map-legend">
        ${Object.entries(MAP_COLORS).map(([k, c]) => `<div class="legend-item"><span class="legend-dot" style="background:${c}"></span>${k}</div>`).join('')}
        <div class="legend-item"><span class="legend-dot" style="border:1px solid #63c8e8;background:transparent"></span>owned</div>
      </div>
      <p style="font-size:9.5px;color:var(--dim);line-height:1.6">Click any node to inspect it. The map reflects the live simulation: hosts fail, recover, and occasionally change hands.</p>
      <div class="section-label" style="margin-top:10px">SHORTCUTS</div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button class="tbtn small" data-map-action="nmap" data-host="${esc(g.servers.find(s => s.host === 'portal')?.id || '')}">nmap portal</button>
        <button class="tbtn small" data-map-action="audit" data-host="${esc(g.servers.find(s => s.host === 'oldco')?.id || '')}">audit oldco</button>
        <button class="tbtn small" data-map-action="browser" data-host="${esc(g.servers.find(s => s.host === 'portal')?.id || '')}">open portal</button>
      </div>`;
    return;
  }
  const s = g.servers.find(x => x.id === m.selected);
  if (!s) { m.selected = null; renderMapSide(win); return; }
  const site = siteForServer(s);
  const vulns = s.vulns.filter(v => !v.patched);
  const open = s.services.filter(x => x.state === 'open');
  side.innerHTML = `<h3>${esc(s.host)}</h3>
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:7px">${statusTag(s.status)}${s.owned ? tag('owned', 'b') : ''}${s.compromised ? tag('compromised', 'r') : ''}</div>
    <div class="kv">
      <dt>address</dt><dd>${esc(s.ip)}</dd>
      <dt>domain</dt><dd>${esc(s.domain)}</dd>
      <dt>org</dt><dd>${esc(s.org)}</dd>
      <dt>role</dt><dd>${esc(s.role)}</dd>
      <dt>os</dt><dd>${esc(s.os)}</dd>
      <dt>region</dt><dd>${esc(s.region)} · ${esc(s.asn)}</dd>
    </div>
    <div class="section-label" style="margin-top:10px">SECURITY <b>${s.security}</b></div>
    <div class="bar-row"><div class="bar ${s.security < 50 ? 'red' : s.security < 70 ? 'amber' : ''}"><i style="width:${s.security}%"></i></div><span>${s.security}/99</span></div>
    <div class="section-label" style="margin-top:10px">SERVICES <b>${open.length}</b></div>
    <div class="svc-list">${open.map(x => tag(`${x.port} ${x.name}`, 'b')).join('') || '<span class="dim">none exposed</span>'}</div>
    <div class="section-label" style="margin-top:10px">FINDINGS <b>${vulns.length}</b></div>
    <div style="display:flex;flex-direction:column;gap:3px">${vulns.slice(0, 4).map(v => `<div style="font-size:8.5px;color:${v.severity === 'critical' ? 'var(--red)' : v.severity === 'high' ? 'var(--amber)' : 'var(--dim)'}">${esc(v.severity)} · ${esc(v.name)}</div>`).join('') || '<span class="dim" style="font-size:9px">No known open findings.</span>'}</div>
    <div class="section-label" style="margin-top:10px">ACTIONS</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      <button class="tbtn small" data-map-action="nmap" data-host="${esc(s.id)}">nmap</button>
      <button class="tbtn small" data-map-action="ssh" data-host="${esc(s.id)}">ssh</button>
      <button class="tbtn small" data-map-action="audit" data-host="${esc(s.id)}">audit</button>
      ${s.owned ? `<button class="tbtn small" data-map-action="patch" data-host="${esc(s.id)}">patch</button>` : ''}
      ${site ? `<button class="tbtn small" data-map-action="browser" data-host="${esc(s.id)}">site</button>` : ''}
    </div>`;
}

/* ============================================================
   BROWSER
   ============================================================ */
MOUNTS.browser = function mountBrowser(win) {
  if (!app.game.browser) app.game.browser = { bookmarks: [], history: [], cookies: {} };
  const start = win.params.url || 'portal.nullnet';
  win.state = { url: start, history: [], index: -1, query: '', tabs: [{ url: start }], activeTab: 0, showSource: false, devtools: false };
  win.body.innerHTML = `<div class="browser-layout">
    <div class="browser-bar">
      <button class="tbtn small" data-browser="back" title="Back">←</button>
      <button class="tbtn small" data-browser="forward" title="Forward">→</button>
      <button class="tbtn small" data-browser="reload" title="Reload">⟳</button>
      <button class="tbtn small" data-browser="newtab" title="New tab">+</button>
      <div class="browser-url">${ic('globe')}<input data-browser-url autocomplete="off" spellcheck="false" aria-label="Address"></div>
      <button class="tbtn small" data-browser="go">Go</button>
      <button class="tbtn small" data-browser="bookmark" title="Bookmark this page">★</button>
      <button class="tbtn small" data-browser="source" title="View page source">&lt;/&gt;</button>
      <button class="tbtn small" data-browser="devtools" title="Developer tools">{ }</button>
      <button class="tbtn small" data-browser="home">Home</button>
    </div>
    <div class="browser-tabs" data-browser-tabs></div>
    <div class="browser-view" data-browser-view></div>
  </div>`;
  const input = win.body.querySelector('[data-browser-url]');
  const view = win.body.querySelector('[data-browser-view]');
  win.browser = { input, view, tabs: win.body.querySelector('[data-browser-tabs]') };
  win.render = () => { if (win.browser) { win.browser.input.value = win.state.url === 'home' ? '' : win.state.url; renderBrowser(win); } };
  win.onParams = params => { if (params.url) navigateBrowser(win, params.url, true); };
  win.body.querySelector('.browser-bar').addEventListener('click', e => {
    const b = e.target.closest('[data-browser]');
    if (!b) return;
    const a = b.dataset.browser;
    if (a === 'back') { if (win.state.index > 0) { win.state.index--; win.state.url = win.state.history[win.state.index]; switchTabUrl(win, win.state.url); renderBrowser(win); } }
    else if (a === 'forward') { if (win.state.index < win.state.history.length - 1) { win.state.index++; win.state.url = win.state.history[win.state.index]; switchTabUrl(win, win.state.url); renderBrowser(win); } }
    else if (a === 'reload') renderBrowser(win);
    else if (a === 'newtab') { win.state.tabs.push({ url: 'home' }); win.state.activeTab = win.state.tabs.length - 1; win.state.url = 'home'; win.state.showSource = false; renderBrowser(win); }
    else if (a === 'bookmark') {
      const bookmarks = app.game.browser.bookmarks;
      if (!bookmarks.includes(win.state.url)) { bookmarks.push(win.state.url); toast('Bookmark added', win.state.url, 'g'); }
      else { app.game.browser.bookmarks = bookmarks.filter(bm => bm !== win.state.url); toast('Bookmark removed', win.state.url, 'a'); }
      renderBrowser(win);
    } else if (a === 'source') { win.state.showSource = !win.state.showSource; renderBrowser(win); }
    else if (a === 'devtools') { win.state.devtools = !win.state.devtools; renderBrowser(win); }
    else if (a === 'home') navigateBrowser(win, 'home', true);
    else if (a === 'go') navigateBrowser(win, input.value, true);
  });
  win.browser.tabs.addEventListener('click', e => {
    const tab = e.target.closest('[data-browser-tab]');
    if (!tab) return;
    const idx = Number(tab.dataset.browserTab);
    const close = e.target.closest('[data-browser-close]');
    if (close) {
      if (win.state.tabs.length <= 1) return;
      win.state.tabs.splice(idx, 1);
      if (win.state.activeTab >= win.state.tabs.length) win.state.activeTab = win.state.tabs.length - 1;
    } else win.state.activeTab = idx;
    win.state.url = win.state.tabs[win.state.activeTab]?.url || 'home';
    win.state.showSource = false;
    renderBrowser(win);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); navigateBrowser(win, input.value, true); }
  });
  view.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if (nav) { e.preventDefault(); navigateBrowser(win, nav.dataset.nav, true); return; }
    const accept = e.target.closest('[data-accept]');
    if (accept) {
      const c = getContract(app.game, accept.dataset.accept);
      const res = acceptContract(app.game, c);
      if (res.ok) toast('Contract accepted', `${c.id} — ${c.title}`, 'g');
      else toast('Cannot accept', res.error, 'a');
      refreshUI();
      renderBrowser(win);
      return;
    }
    const thread = e.target.closest('[data-thread]');
    if (thread) { showThread(thread.dataset.thread); return; }
    const clone = e.target.closest('[data-clone]');
    if (clone) { runCommand(`git clone https://git.nullnet/${clone.dataset.clone}`); return; }
    const run = e.target.closest('[data-run]');
    if (run) { runCommand(run.dataset.run); return; }
    const go = e.target.closest('[data-search-go]');
    if (go) {
      const q = win.body.querySelector('[data-search-input]')?.value || '';
      win.state.query = q.trim();
      renderBrowser(win);
    }
  });
  view.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('[data-search-input]')) {
      e.preventDefault();
      win.state.query = e.target.value.trim();
      renderBrowser(win);
    }
  });
  navigateBrowser(win, win.state.url, true);
};

function switchTabUrl(win, url) {
  if (win.state.tabs[win.state.activeTab]) win.state.tabs[win.state.activeTab].url = url;
}
function navigateBrowser(win, url, push = true) {
  let u = String(url || '').trim().toLowerCase();
  u = u.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!u || u === 'about:home' || u === 'start') u = 'home';
  win.state.url = u;
  switchTabUrl(win, u);
  win.state.showSource = false;
  if (push) {
    win.state.history = win.state.history.slice(0, win.state.index + 1);
    if (win.state.history[win.state.history.length - 1] !== u) win.state.history.push(u);
    win.state.index = win.state.history.length - 1;
  }
  if (u !== 'home' && app.game.browser) {
    if (!app.game.browser.history.includes(u)) app.game.browser.history.push(u);
    if (app.game.browser.history.length > 120) app.game.browser.history.shift();
    app.game.browser.cookies[u] = { visits: (app.game.browser.cookies[u]?.visits || 0) + 1, lastWorld: app.game.worldMinutes };
    const site = getSite(app.game, u);
    if (site) site.visits = (site.visits || 0) + 1;
  }
  if (win.browser) win.browser.input.value = u === 'home' ? '' : u;
  renderBrowser(win);
}

function renderBrowser(win) {
  if (!win.browser) return;
  if (win.browser.tabs) {
    win.browser.tabs.innerHTML = win.state.tabs.map((tab, i) => `<button class="browser-tab ${i === win.state.activeTab ? 'on' : ''}" data-browser-tab="${i}"><span>${esc(tab.url === 'home' ? 'home' : tab.url)}</span><b data-browser-close="1">×</b></button>`).join('');
  }
  const view = win.browser.view;
  view.innerHTML = renderBrowserPage(win) + (win.state.devtools ? browserDevtools(win) : '');
  updateBrowserStatus(win);
}

function updateBrowserStatus(win) {
  const u = win.state.url;
  if (u === 'home') { win.status.innerHTML = `<span>about:home</span><span>local index</span><span class="st-right"><b>${app.game.sites.length} sites indexed</b></span>`; return; }
  const site = getSite(app.game, u);
  const server = serverOfSite(site);
  win.status.innerHTML = `<span>${site ? 'HTTP 200' : 'HTTP 404'}</span><span>${esc(u)}</span><span>${server ? esc(server.ip) : 'unresolved'}</span>
    <span class="st-right"><b>${site ? esc(site.tech) : 'no route'}</b><span>${site ? fmtNum(site.visits) + ' visits' : ''}</span></span>`;
}

function renderBrowserPage(win) {
  const g = app.game;
  const u = win.state.url;
  if (u === 'home') return browserHome();
  const site = getSite(g, u);
  if (win.state.showSource) {
    const source = site
      ? `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>${esc(site.title)}</title>\n  <link rel="stylesheet" href="/styles.css">\n</head>\n<body>\n  <main data-site="${esc(site.domain)}">\n    <h1>${esc(site.title)}</h1>\n    <p>${esc(site.desc)}</p>\n${(site.sections || []).map(s => `    <section><h2>${esc(s.h)}</h2><p>${esc(s.p)}</p></section>`).join('\n')}\n  </main>\n  <script src="/app.js"></script>\n</body>\n</html>`
      : `<!doctype html>\n<html><head><title>404</title></head><body><h1>No such site</h1></body></html>`;
    return `<div class="browser-source"><div class="devtools-head">PAGE SOURCE <span>${esc(u)}</span></div><pre>${esc(source)}</pre></div>`;
  }
  const forum = g.forums.find(f => f.domain === u);
  if (!site && forum) return browserForum(win, forum, null);
  if (!site) return browserError(u, 'The domain does not resolve to an indexed site. The network is not the web; not everything is public.');
  const server = serverOfSite(site);
  if (server && server.status === 'offline') return browserError(u, `${server.host} is offline. The last known address was ${server.ip}.`);
  const body = [];
  const widget = browserWidget(win, site);
  body.push(`<div class="site-top"><div class="site-brand">${esc(site.title)}<span> / ${esc(site.category)}</span></div><div>${esc(site.domain)} · ${site.status}</div></div>`);
  body.push(`<div class="site-hero"><div class="site-kicker">${esc(site.kind)} · ${esc(site.tech)}</div><h1>${esc(site.title)}</h1><p>${esc(site.desc)}</p></div>`);
  if (site.kind === 'player') body.push(`<div class="site-alert">This site is operated by you. ${site.sections?.[0]?.p ? esc(site.sections[0].p) : ''}</div>`);
  const cards = (site.sections || []).map(s => `<div class="site-card"><div class="mini">${esc(s.h)}</div><p>${esc(s.p).replace(/\n/g, '<br>')}</p></div>`).join('');
  body.push(`<div class="site-grid">${cards}</div>`);
  if (widget) body.push(widget);
  const links = (site.links || []).map((l, i) => `<div class="site-list-item"><span class="n">${pad2(i + 1)}</span><div><b><a href="#" data-nav="${esc(l)}">${esc(l)}</a></b><small>public link</small></div></div>`).join('');
  body.push(`<div class="site-list">${links}</div>`);
  body.push(`<div class="site-footer"><span>${esc(site.domain)}</span><span>served from ${server ? esc(server.ip) : 'unknown'} · ${fmtNum(site.visits)} visits</span></div>`);
  return `<div class="site-page">${body.join('')}</div>`;
}

function browserDevtools(win) {
  const g = app.game;
  const u = win.state.url;
  const site = getSite(g, u);
  const server = site ? serverOfSite(site) : null;
  const record = site ? webRecord(g, u)?.record : null;
  const cert = site ? (g.internet?.certs || []).find(c => c.siteId === site.id) : null;
  return `<div class="browser-devtools">
    <div class="devtools-head">DEVELOPER TOOLS <span>${esc(u)}</span></div>
    <div class="devtools-grid">
      <div><b>DNS</b><span>${record?.dns?.a?.join(', ') || (server ? server.ip : 'unresolved')}</span></div>
      <div><b>TLS</b><span>${record?.tls?.enabled ? `${esc(record.tls.version)} · ${esc(record.tls.issuer)}` : 'none'}</span></div>
      <div><b>Server</b><span>${server ? `${esc(server.host)} (${esc(server.ip)})` : '—'}</span></div>
      <div><b>Stack</b><span>${record?.stack?.join(', ') || esc(site?.tech || '—')}</span></div>
      <div><b>Status</b><span>${record?.status || (site ? site.status : '—')} · ${Math.round(record?.availability || 100)}% uptime</span></div>
      <div><b>Certificate</b><span>${cert ? `${esc(cert.status)} · ${esc(cert.tlsVersion)}` : '—'}</span></div>
      <div><b>Cookies</b><span>${g.browser?.cookies?.[u]?.visits || 0} visits recorded</span></div>
      <div><b>Bookmarked</b><span>${g.browser?.bookmarks?.includes(u) ? 'yes' : 'no'}</span></div>
    </div>
  </div>`;
}

function browserHome() {
  const g = app.game;
  const links = [
    ['portal.nullnet', 'NullNet', 'Community hub, boards, and public shell.'],
    ['news.nullnet', 'NullNet Wire', 'The network wire. Incidents, labor, infrastructure.'],
    ['market.nullnet', 'Contract board', 'Work, rates, and reputation.'],
    ['search.nullnet', 'NullSearch', 'A small index of the public network.'],
    ['git.nullnet', 'git.nullnet', 'Public repositories and abandoned projects.'],
    ['orbital.cloud', 'Orbital Cloud', 'Compute, storage, and a pricing page that rewards patience.'],
    ['kestrel.ai', 'Kestrel Inference', 'Hosted models, agent runtimes, and usage dashboards.'],
    ['agents.nullnet', 'Agent Directory', 'A public register of autonomous agents.'],
    ['blackmarket.onion', '0x00', 'Access, data, and things better left buried.']
  ];
  return `<div class="site-page">
    <div class="site-top"><div class="site-brand">NULLNET<span> / directory</span></div><div>${g.sites.length} indexed sites · ${g.servers.length} hosts</div></div>
    <div class="site-hero"><div class="site-kicker">PUBLIC NETWORK</div><h1>The network is a population.</h1>
      <p>Not a search engine. A directory of places that still answer. Type a domain above, or start with one of these.</p></div>
    <div class="site-grid">${links.map(([u, t, d]) => `<div class="site-card"><div class="mini">${esc(u)}</div><h3><a href="#" data-nav="${esc(u)}">${esc(t)}</a></h3><p>${esc(d)}</p></div>`).join('')}</div>
    ${(g.browser?.bookmarks || []).length ? `<div class="site-card" style="margin-bottom:10px"><div class="mini">BOOKMARKS</div><div class="site-list">${g.browser.bookmarks.map(bm => `<div class="site-list-item"><span class="n">★</span><div><b><a href="#" data-nav="${esc(bm)}">${esc(bm)}</a></b></div></div>`).join('')}</div></div>` : ''}
    ${(g.browser?.history || []).length ? `<div class="site-card" style="margin-bottom:10px"><div class="mini">RECENT HISTORY</div><div class="site-list">${g.browser.history.slice(-8).reverse().map(h => `<div class="site-list-item"><span class="n">→</span><div><b><a href="#" data-nav="${esc(h)}">${esc(h)}</a></b></div></div>`).join('')}</div></div>` : ''}
    <div class="site-list">
      <div class="site-list-item"><span class="n">01</span><div><b>Tip</b><small>Use the terminal for nmap, whois, curl, and ssh. The browser is for what the network chooses to publish.</small></div></div>
      <div class="site-list-item"><span class="n">02</span><div><b>Warning</b><small>Everything here is fictional and simulated. No real network is reachable.</small></div></div>
    </div>
    <div class="site-footer"><span>about:home</span><span>${onlineCount(g)} operators online</span></div>
  </div>`;
}

function browserWidget(win, site) {
  const g = app.game;
  if (site.domain === 'search.nullnet' || site.kind === 'search') {
    const q = win.state.query || '';
    const results = q ? g.sites.filter(s => [s.domain, s.title, s.desc, s.category].join(' ').toLowerCase().includes(q.toLowerCase())).slice(0, 12) : [];
    return `<div class="site-search"><input data-search-input value="${esc(q)}" placeholder="domain, phrase, or name"><button data-search-go="1">Search</button></div>
      ${q ? `<div class="site-list">${results.map((s, i) => `<div class="site-list-item"><span class="n">${pad2(i + 1)}</span><div><b><a href="#" data-nav="${esc(s.domain)}">${esc(s.title)}</a></b><small>${esc(s.domain)} · ${esc(s.category)} · ${esc(s.desc)}</small></div></div>`).join('') || '<div class="site-list-item"><span class="n">—</span><div><b>No results</b><small>The index is incomplete by design.</small></div></div>'}</div>` : ''}`;
  }
  if (site.domain === 'news.nullnet' || site.kind === 'news') {
    return `<div class="site-list">${g.news.slice(0, 8).map((n, i) => `<div class="site-list-item"><span class="n">${pad2(i + 1)}</span><div><b>${esc(n.headline)}</b><small>${esc(n.source)} · ${worldHHMM(n.world)} · ${esc(n.body)}</small></div></div>`).join('')}</div>`;
  }
  if (site.domain === 'market.nullnet' || site.kind === 'market') {
    const jobs = g.contracts.filter(c => c.status === 'open').sort((a, b) => b.pay - a.pay).slice(0, 7);
    return `<div class="site-list">${jobs.map((c, i) => `<div class="site-list-item"><span class="n">${pad2(i + 1)}</span><div style="flex:1"><b>${esc(c.title)} · ${fmtMoney(c.pay)}</b><small>${esc(c.id)} · @${esc(c.clientHandle)} · difficulty ${c.difficulty} · ${esc(c.objective.label)}</small></div><button class="tbtn small" data-accept="${esc(c.id)}">Accept</button></div>`).join('')}</div>
      <div style="margin-top:12px"><button class="tbtn" data-open="market">Open contract board</button></div>`;
  }
  if (site.domain === 'portal.nullnet' || site.kind === 'portal') {
    const forums = g.forums.filter(f => f.status === 'live');
    return `<h3 style="font-size:14px;margin:18px 0 6px">Boards</h3><div class="site-list">${forums.map((f, i) => `<div class="site-list-item"><span class="n">${pad2(i + 1)}</span><div><b>${esc(f.name)}</b><small>${esc(f.desc)} · ${fmtNum(f.members)} members</small>${f.threads.slice(0, 3).map(t => `<div style="margin-top:5px"><a href="#" data-thread="${esc(t.id)}">${esc(t.title)}</a> <span style="color:#8a938f;font-size:10px">— @${esc(t.author)}, ${t.posts.length} posts</span></div>`).join('')}</div></div>`).join('')}</div>`;
  }
  if (site.domain === 'git.nullnet' || site.kind === 'git') {
    return `<div class="site-list">${g.repos.map((r, i) => `<div class="site-list-item"><span class="n">${pad2(i + 1)}</span><div style="flex:1"><b>${esc(r.name)} <span style="font-weight:400;color:#6b767c">· ${esc(r.lang)} · ★ ${r.stars}</span></b><small>${esc(r.desc)}</small></div><button class="tbtn small" data-clone="${esc(r.name)}">clone</button></div>`).join('')}</div>`;
  }
  if (site.domain === 'orbital.cloud' || site.kind === 'cloud') {
    const owned = playerCloudServers(g);
    return `<div class="site-list">
      ${g.cloud.providers.slice(0, 4).map((p, i) => `<div class="site-list-item"><span class="n">${pad2(i + 1)}</span><div style="flex:1"><b>${esc(p.name)} <span style="font-weight:400;color:#6b767c">· ${p.factor}× base · ${p.reliability}%</span></b><small>${esc(p.desc)} · ${p.regions.join(', ')}</small></div><button class="tbtn small" data-run="cloud plans ${esc(p.id)}">pricing</button></div>`).join('')}
    </div>
    <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
      <button class="tbtn" data-run="cloud plans">View plans</button>
      <button class="tbtn" data-run="cloud instances">My instances (${owned.length})</button>
      <button class="tbtn" data-open="cloud">Open cloud console</button>
    </div>`;
  }
  if (site.domain === 'kestrel.ai' || site.kind === 'ai') {
    return `<div class="site-list">
      ${AGENT_MODELS.map((m, i) => `<div class="site-list-item"><span class="n">${pad2(i + 1)}</span><div style="flex:1"><b>${esc(m.name)} <span style="font-weight:400;color:#6b767c">· ${esc(m.vendor)} · $${m.cost}/mo</span></b><small>${esc(m.desc)} · skill ${m.skill} · ${m.context}k context</small></div><button class="tbtn small" data-run="agent models">inspect</button></div>`).join('')}
    </div>
    <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
      <button class="tbtn" data-run="agent roles">Agent roles</button>
      <button class="tbtn" data-run="agent list">My agents</button>
      <button class="tbtn" data-open="agents">Open agent console</button>
    </div>`;
  }
  if (site.domain === 'agents.nullnet' || site.kind === 'agents') {
    const agents = g.agents.slice(0, 12);
    return `<div class="site-list">
      ${agents.map((a, i) => `<div class="site-list-item"><span class="n">${pad2(i + 1)}</span><div style="flex:1"><b>${esc(a.name)} <span style="font-weight:400;color:#6b767c">· ${esc(agentRole(a.roleId).name)} · ${esc(agentModel(a.modelId).name)}</span></b><small>${esc(a.ownerName)} · ${a.status} · ${fmtNum(a.tasksDone)} tasks</small></div><button class="tbtn small" data-run="agent inspect ${esc(a.name)}">inspect</button></div>`).join('')}
    </div>
    <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap"><button class="tbtn" data-run="agent list --all">Full register</button><button class="tbtn" data-open="agents">Open agent console</button></div>`;
  }
  return '';
}

function browserForum(win, forum, site) {
  const posts = forum.threads.map((t, i) => `<div class="site-list-item"><span class="n">${pad2(i + 1)}</span><div><b><a href="#" data-thread="${esc(t.id)}">${esc(t.title)}</a> ${t.pinned ? '<span style="color:#0e7490;font-size:9px">PINNED</span>' : ''}</b><small>@${esc(t.author)} · ${t.posts.length} posts</small></div></div>`).join('');
  return `<div class="site-page">
    <div class="site-top"><div class="site-brand">${esc(forum.name)}<span> / board</span></div><div>${esc(forum.domain)}</div></div>
    <div class="site-hero"><div class="site-kicker">${esc(forum.kind)} board</div><h1>${esc(forum.name)}</h1><p>${esc(forum.desc)}</p></div>
    <div class="site-grid"><div class="site-card"><div class="mini">MEMBERS</div><p>${fmtNum(forum.members)} registered · ${forum.threads.length} visible threads</p></div>
    <div class="site-card"><div class="mini">CONDUCT</div><p>Read before posting. Report breakage. Do not make the network worse.</p></div></div>
    <div class="site-list">${posts}</div>
    <div class="site-footer"><span>${esc(forum.domain)}</span><span>${forum.status}</span></div>
  </div>`;
}

function browserError(url, reason) {
  return `<div class="site-page">
    <div class="site-top"><div class="site-brand">NULLNET<span> / error</span></div><div>${esc(url)}</div></div>
    <div class="site-hero"><div class="site-kicker">NO ROUTE</div><h1>This page did not answer.</h1><p>${esc(reason)}</p></div>
    <div class="site-terminal"><span class="dim">$</span> dig ${esc(url)}<br><span class="dim">;; status: NXDOMAIN or host unreachable</span><br><span class="dim">$</span> curl -I http://${esc(url)}<br><span class="dim">curl: (6) Could not resolve host</span></div>
    <div class="site-list">
      <div class="site-list-item"><span class="n">01</span><div><b><a href="#" data-nav="home">Return to the directory</a></b><small>Start from the public index.</small></div></div>
      <div class="site-list-item"><span class="n">02</span><div><b><a href="#" data-nav="search.nullnet">Search NullSearch</a></b><small>The index may know a different name.</small></div></div>
      <div class="site-list-item"><span class="n">03</span><div><b>Use the terminal</b><small>nmap, whois, and dig can tell you whether the host exists at all.</small></div></div>
    </div>
    <div class="site-footer"><span>about:error</span><span>simulated network</span></div>
  </div>`;
}

function showThread(id) {
  let found = null;
  for (const f of app.game.forums) {
    const t = f.threads.find(x => x.id === id);
    if (t) { found = { forum: f, thread: t }; break; }
  }
  if (!found) return;
  const { forum, thread } = found;
  const posts = thread.posts.map(p => `<div style="border-top:1px solid #202a32;padding:8px 0"><div style="font-family:var(--mono);font-size:8px;color:var(--faint)">@${esc(p.author)} · ${worldHHMM(p.world)}</div><div style="white-space:pre-wrap">${esc(p.body)}</div></div>`).join('');
  showModal({
    title: thread.title, eyebrow: forum.name,
    body: `<p class="dim">${esc(forum.desc)}</p>${posts}`,
    actions: [{ label: 'Close' }, { label: 'Open board', kind: 'primary', onClick: () => openWindow('browser', { url: forum.domain }) }]
  });
}

/* ============================================================
   MAIL
   ============================================================ */
MOUNTS.mail = function mountMail(win) {
  win.state = {
    selectedId: win.params.selectedId || null, composing: !!win.params.composeTo,
    composeTo: win.params.composeTo || '', composeSubject: '', composeBody: '', composeError: ''
  };
  win.render = () => renderMail(win);
  win.onParams = params => {
    if (params.selectedId) { win.state.selectedId = params.selectedId; win.state.composing = false; }
    if (params.composeTo) { win.state.composing = true; win.state.composeTo = params.composeTo; }
    renderMail(win);
  };
  renderMail(win);
};

function renderMail(win) {
  const st = win.state;
  const g = app.game;
  const toEl = win.body.querySelector('[data-mail-to]');
  if (toEl) {
    st.composeTo = toEl.value;
    st.composeSubject = win.body.querySelector('[data-mail-subject]')?.value || '';
    st.composeBody = win.body.querySelector('[data-mail-body]')?.value || '';
  }
  const mail = [...g.mail].sort((a, b) => b.time - a.time);
  const unread = g.mail.filter(m => !m.outbound && !m.read).length;
  const selected = mail.find(m => m.id === st.selectedId);
  const partners = mailPartners(g).size;
  win.body.innerHTML = `<div class="mail-layout">
    <div class="mail-side">
      <div class="app-toolbar"><button class="tbtn small primary" data-mail-action="compose">${ic('mail')} Compose</button><span class="spacer"></span><button class="tbtn small" data-mail-action="readall">Read all</button></div>
      <div class="mail-list">${mail.map(m => {
        const who = m.outbound ? `to @${m.to}` : `@${m.from}`;
        const preview = String(m.body || '').replace(/\s+/g, ' ').slice(0, 90);
        return `<div class="mail-item ${m.read || m.outbound ? '' : 'unread'} ${m.id === st.selectedId ? 'on' : ''}" data-mail-id="${m.id}">
          <div class="from"><span>${esc(who)}</span><time>${relTime(m.time)}</time></div>
          <div class="subj">${esc(m.subject)}</div>
          <div class="prev">${esc(preview)}</div>
        </div>`;
      }).join('') || '<div class="empty-state"><b>Inbox empty</b>The network has not written to you yet.</div>'}</div>
    </div>
    <div class="mail-main">${st.composing ? mailComposeHTML(st) : selected ? mailReadHTML(selected) : `<div class="empty-state" style="margin:auto"><b>No message selected</b>Choose a message, or compose a new one.<br><br><button class="tbtn primary" data-mail-action="compose">Compose</button></div>`}</div>
  </div>`;

  for (const item of $$('[data-mail-id]', win.body)) {
    item.addEventListener('click', () => {
      st.selectedId = Number(item.dataset.mailId);
      st.composing = false;
      const m = g.mail.find(x => x.id === st.selectedId);
      if (m && !m.outbound) m.read = true;
      renderMail(win);
      updateAll();
      scheduleSave();
    });
  }
  for (const b of $$('[data-mail-action]', win.body)) {
    b.addEventListener('click', () => mailAction(win, b.dataset.mailAction));
  }
  win.status.innerHTML = `<span>${unread} unread</span><span>${g.mail.length} messages</span><span>${partners} correspondent${partners === 1 ? '' : 's'}</span>
    <span class="st-right"><b>${selected ? esc(selected.subject) : st.composing ? 'compose' : 'inbox'}</b><span>local relay</span></span>`;
}

function mailReadHTML(m) {
  return `<div class="mail-read">
    <h2>${esc(m.subject)}</h2>
    <div class="mail-meta"><span>${m.outbound ? 'to' : 'from'} @${esc(m.outbound ? m.to : m.from)}</span><span>${fmtDateTime(m.time)}</span><span>${m.outbound ? 'outbound' : 'inbound'}</span></div>
    <div class="mail-body">${esc(m.body)}</div>
    <div style="margin-top:18px;display:flex;gap:6px"><button class="tbtn primary" data-mail-action="reply">${ic('mail')} Reply</button><button class="tbtn" data-mail-action="terminal">Terminal</button></div>
  </div>`;
}

function mailComposeHTML(st) {
  return `<div class="mail-compose">
    ${st.composeError ? `<div style="color:var(--red);font-size:10px">${esc(st.composeError)}</div>` : ''}
    <div class="field"><label>TO / HANDLE</label><input class="input" data-mail-to value="${esc(st.composeTo || '')}" placeholder="hex" autocomplete="off"></div>
    <div class="field"><label>SUBJECT</label><input class="input" data-mail-subject value="${esc(st.composeSubject || '')}" placeholder="short and specific" autocomplete="off"></div>
    <div class="field"><label>MESSAGE</label><textarea class="input" data-mail-body rows="10" placeholder="Write plainly. Attachments are not trusted here.">${esc(st.composeBody || '')}</textarea></div>
    <div style="display:flex;gap:6px;justify-content:flex-end"><button class="tbtn" data-mail-action="cancel">Cancel</button><button class="tbtn primary" data-mail-action="send">Send message</button></div>
  </div>`;
}

function mailAction(win, action) {
  const st = win.state;
  const g = app.game;
  if (action === 'compose') { st.composing = true; st.selectedId = null; st.composeError = ''; renderMail(win); return; }
  if (action === 'cancel') { st.composing = false; st.composeError = ''; renderMail(win); return; }
  if (action === 'readall') {
    let n = 0;
    for (const m of g.mail) if (!m.outbound && !m.read) { m.read = true; n++; }
    toast('Mail', n ? `${n} message${n === 1 ? '' : 's'} marked read.` : 'Inbox already read.', 'b');
    renderMail(win); updateAll(); scheduleSave();
    return;
  }
  if (action === 'terminal') { runCommand('mail'); return; }
  if (action === 'reply') {
    const m = g.mail.find(x => x.id === st.selectedId);
    if (!m) return;
    st.composing = true;
    st.composeTo = m.outbound ? m.to : m.from;
    st.composeSubject = `re: ${m.subject}`;
    st.composeBody = '\n\n---\n';
    renderMail(win);
    return;
  }
  if (action === 'send') {
    const to = win.body.querySelector('[data-mail-to]')?.value.trim().replace(/^@/, '') || '';
    const subject = win.body.querySelector('[data-mail-subject]')?.value.trim() || '';
    const body = win.body.querySelector('[data-mail-body]')?.value.trim() || '';
    if (!to) { st.composeError = 'A recipient handle is required.'; st.composeTo = to; st.composeSubject = subject; st.composeBody = body; renderMail(win); return; }
    if (!subject) { st.composeError = 'A subject is required.'; st.composeTo = to; st.composeSubject = subject; st.composeBody = body; renderMail(win); return; }
    if (!body) { st.composeError = 'The message body is empty.'; st.composeTo = to; st.composeSubject = subject; st.composeBody = body; renderMail(win); return; }
    const res = sendPlayerMail(g, to, subject, body);
    if (!res.ok) { st.composeError = res.error; st.composeTo = to; st.composeSubject = subject; st.composeBody = body; renderMail(win); return; }
    st.composing = false; st.composeTo = ''; st.composeSubject = ''; st.composeBody = ''; st.composeError = '';
    toast('Message sent', `@${res.npc.handle} will reply when the world allows it.`, 'g');
    refreshUI();
    renderMail(win);
  }
}

/* ============================================================
   MARKET
   ============================================================ */
MOUNTS.market = function mountMarket(win) {
  win.state = { tab: 'contracts', filter: 'open' };
  win.render = () => renderMarket(win);
  renderMarket(win);
};

function renderMarket(win) {
  const g = app.game;
  const st = win.state;
  const tabs = [['contracts', 'Contracts'], ['shop', 'Shop'], ['infra', 'Infrastructure']];
  win.body.innerHTML = `<div class="market-layout">
    <div class="market-tabs">${tabs.map(([id, label]) => `<button class="market-tab ${st.tab === id ? 'on' : ''}" data-market-tab="${id}">${label}</button>`).join('')}<span style="margin-left:auto;font-family:var(--mono);font-size:9px;color:var(--green);padding:5px 8px">${fmtMoney(g.player.money)}</span></div>
    <div class="market-note"><span><b>${g.contracts.filter(c => c.status === 'open').length}</b> open contracts · <b>${g.contracts.filter(c => c.status === 'active').length}</b> active · reputation <b>${g.player.reputation}</b></span><span>escrow is manual</span></div>
    <div class="market-scroll" data-market-body></div>
  </div>`;
  for (const b of $$('[data-market-tab]', win.body)) b.addEventListener('click', () => { st.tab = b.dataset.marketTab; renderMarket(win); });
  const body = win.body.querySelector('[data-market-body]');
  if (st.tab === 'contracts') renderContracts(win, body);
  else if (st.tab === 'shop') renderShop(win, body);
  else renderInfra(win, body);
  win.status.innerHTML = `<span>market.nullnet</span><span>${SHOP_ITEMS.length} products</span><span class="st-right"><b>${fmtMoney(g.player.money)}</b><span>${ownedServers(g).length} servers · ${playerSites(g).length} sites</span></span>`;
}

function renderContracts(win, body) {
  const g = app.game;
  const st = win.state;
  const filters = [['open', 'Open'], ['active', 'Active'], ['done', 'Delivered'], ['all', 'All']];
  const jobs = g.contracts.filter(c => st.filter === 'all' ? true : st.filter === 'open' ? c.status === 'open' : st.filter === 'active' ? c.status === 'active' : c.status === 'done')
    .sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1) || b.pay - a.pay);
  body.innerHTML = `<div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap">${filters.map(([id, label]) => `<button class="tbtn small ${st.filter === id ? 'primary' : ''}" data-market-filter="${id}">${label}</button>`).join('')}<span class="spacer" style="flex:1"></span><button class="tbtn small" data-market-action="refresh">${ic('arrow')} Refresh</button></div>
    <div class="market-grid">${jobs.map(c => contractCard(g, c)).join('') || '<div class="empty-state"><b>No contracts here</b>The board changes as the world runs. Try another filter.</div>'}</div>`;
  for (const b of $$('[data-market-filter]', body)) b.addEventListener('click', () => { st.filter = b.dataset.marketFilter; renderMarket(win); });
  for (const b of $$('[data-market-action]', body)) b.addEventListener('click', () => marketAction(win, b.dataset.marketAction, b.dataset.id));
}

function contractCard(g, c) {
  const satisfied = c.status === 'active' && objectiveSatisfied(g, c);
  const client = getNpc(g, c.clientHandle);
  const daysLeft = Math.ceil((c.deadlineWorld - g.worldMinutes) / MINUTES_PER_DAY);
  return `<div class="mcard">
    <div class="top"><h3>${esc(c.title)}</h3>${tag(c.status, contractStatusClass(c.status))}</div>
    <p>${esc(c.desc)}</p>
    <div class="meta">${tag(c.id)}${tag(`diff ${c.difficulty}`, c.difficulty >= 4 ? 'a' : '')}${(c.tags || []).map(t => tag(t)).join('')}</div>
    <div style="font-family:var(--mono);font-size:8px;color:var(--faint);line-height:1.5">
      ${esc(c.objective.label)}<br>
      client @${esc(c.clientHandle)}${client ? ` · ${esc(client.name)}` : ''} · ${daysLeft > 0 ? daysLeft + 'd left' : 'deadline passed'}
    </div>
    <div class="bottom"><span class="price">${fmtMoney(c.pay)}${c.bonus ? `<small> +${fmtMoney(c.bonus)} bonus</small>` : ''}</span>
      ${c.status === 'open' ? `<button class="tbtn small primary" data-market-action="accept" data-id="${esc(c.id)}">Accept</button>` : ''}
      ${c.status === 'active' ? `<button class="tbtn small ${satisfied ? 'primary' : ''}" data-market-action="submit" data-id="${esc(c.id)}">${satisfied ? 'Submit' : 'Objective pending'}</button>` : ''}
      ${c.status === 'done' ? `<span class="tag g">paid</span>` : ''}
      ${c.status === 'failed' || c.status === 'expired' ? `<span class="tag r">${esc(c.status)}</span>` : ''}
    </div>
  </div>`;
}

function renderShop(win, body) {
  const g = app.game;
  body.innerHTML = `<div class="market-grid">${SHOP_ITEMS.map(item => {
    const count = g.player.inventory[item.id] || 0;
    const owned = item.kind === 'infra' && item.server ? ownedServers(g).filter(s => s.plan === (item.id === 'vps-dedicated' ? 'dedicated' : item.id === 'vps-std' ? 'standard' : 'micro')).length : 0;
    return `<div class="mcard">
      <div class="top"><h3>${esc(item.name)}</h3>${tag(item.kind, 'b')}</div>
      <p>${esc(item.desc)}</p>
      <div class="meta">${tag(item.specs)}${item.recurring ? tag('recurring', 'a') : tag('one-time', 'g')}${count ? tag(`owned ${count}`, 'g') : ''}${owned ? tag(`${owned} node${owned === 1 ? '' : 's'}`, 'b') : ''}</div>
      <div class="bottom"><span class="price">${fmtMoney(item.price)}<small>${item.recurring ? ' / 30d' : ''}</small></span>
        <button class="tbtn small primary" data-market-action="buy" data-id="${esc(item.id)}">${item.id === 'domain' ? 'Register' : 'Buy'}</button>
      </div>
    </div>`;
  }).join('')}</div>
  <div class="section-label" style="margin-top:14px">INVENTORY</div>
  <div style="display:flex;flex-wrap:wrap;gap:4px">${Object.entries(g.player.inventory).filter(([, n]) => n > 0).map(([id, n]) => tag(`${id} ×${n}`, 'g')).join('') || '<span class="dim" style="font-size:9px">No tools or services owned.</span>'}</div>`;
  for (const b of $$('[data-market-action]', body)) b.addEventListener('click', () => marketAction(win, b.dataset.marketAction, b.dataset.id));
}

function renderInfra(win, body) {
  const g = app.game;
  const servers = ownedServers(g);
  const sites = playerSites(g);
  body.innerHTML = `<div class="app-toolbar" style="padding:0 0 9px;border:0;background:transparent">
      <button class="tbtn small primary" data-market-action="deploy">${ic('plus')} Deploy site</button>
      <button class="tbtn small" data-market-action="register">Register domain</button>
      <button class="tbtn small" data-market-action="open-market">Contract board</button>
    </div>
    <div class="section-label">YOUR SERVERS <b>${servers.length}</b></div>
    <div class="server-grid">${servers.map(s => `<div class="scard"><div class="top"><div><h3>${esc(s.host)}</h3><div class="ip">${esc(s.ip)} · ${esc(s.region)}</div></div>${statusTag(s.status)}</div>
      <div class="stats"><div class="stat"><span>SECURITY</span><b>${s.security}/99</b></div><div class="stat"><span>PLAN</span><b>${esc(s.plan || 'micro')}</b></div><div class="stat"><span>TRAFFIC</span><b>${fmtNum(s.traffic)}</b></div><div class="stat"><span>UPTIME</span><b>${s.uptimePct.toFixed(1)}%</b></div></div>
      <div class="svc-list">${s.services.map(x => tag(`${x.port}/${x.name}`, 'b')).join('')}</div>
      <div class="actions"><button class="tbtn small" data-market-action="server" data-id="${esc(s.id)}">ssh</button><button class="tbtn small" data-market-action="patch" data-id="${esc(s.id)}">patch</button></div></div>`).join('') || '<div class="empty-state"><b>No infrastructure</b>Buy a VPS from the shop. A micro node costs $28 and is enough to start.</div>'}</div>
    <div class="section-label" style="margin-top:14px">YOUR SITES <b>${sites.length}</b></div>
    <div class="market-grid">${sites.map(s => `<div class="mcard"><div class="top"><h3>${esc(s.domain)}</h3>${statusTag(s.status)}</div><p>${esc(s.title)} · ${fmtNum(s.visits)} visits · ${fmtMoney(s.revenue)} revenue</p><div class="meta">${tag(s.tech, 'b')}${tag('player', 'g')}</div><div class="bottom"><span class="price">${fmtNum(s.visits)}<small> visits</small></span><button class="tbtn small" data-market-action="visit" data-id="${esc(s.domain)}">Open</button></div></div>`).join('') || '<div class="empty-state"><b>Nothing published</b>Write an index.html, buy a server, and deploy it to a domain you own.</div>'}</div>
    <div class="section-label" style="margin-top:14px">DOMAINS</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">${g.player.domains.map(d => tag(d, 'b')).join('') || '<span class="dim" style="font-size:9px">No domains registered.</span>'}</div>`;
  for (const b of $$('[data-market-action]', body)) b.addEventListener('click', () => marketAction(win, b.dataset.marketAction, b.dataset.id));
}

function marketAction(win, action, id) {
  const g = app.game;
  if (action === 'refresh') { renderMarket(win); return; }
  if (action === 'open-market') { openWindow('browser', { url: 'market.nullnet' }); return; }
  if (action === 'accept') {
    const c = getContract(g, id);
    const res = acceptContract(g, c);
    if (res.ok) toast('Contract accepted', `${c.id} — ${c.title}`, 'g');
    else toast('Cannot accept', res.error, 'a');
    refreshUI();
    return;
  }
  if (action === 'submit') {
    const c = getContract(g, id);
    const res = submitContract(g, c);
    if (res.ok) toast('Contract delivered', `${c.id} · ${fmtMoney(res.pay)} · +${res.rep} reputation`, 'g');
    else toast('Not ready', res.error, 'a');
    refreshUI();
    return;
  }
  if (action === 'buy') {
    const item = SHOP_ITEMS.find(x => x.id === id);
    if (!item) return;
    if (item.id === 'domain') { registerDomainDialog(win); return; }
    const res = buyShopItem(g, item);
    if (res.ok) toast('Purchased', item.name, 'g');
    else toast('Purchase failed', res.error, 'r');
    refreshUI();
    return;
  }
  if (action === 'register') { registerDomainDialog(win); return; }
  if (action === 'deploy') { deployDialog(win); return; }
  if (action === 'visit') { openWindow('browser', { url: id }); return; }
  if (action === 'server') { runCommand(`ssh ${id}`); return; }
  if (action === 'patch') {
    const server = g.servers.find(s => s.id === id);
    const res = patchServer(g, server);
    if (res.ok) toast('Patched', `${res.count} finding${res.count === 1 ? '' : 's'} closed on ${server.host}.`, 'g');
    else toast('Patch failed', res.error, 'a');
    refreshUI();
  }
}

function registerDomainDialog(win) {
  formModal({
    title: 'Register a domain', eyebrow: '$18 / YEAR',
    body: '<p>Choose a name that sounds like a place. The registration is simulated; the cost is not.</p>',
    fields: [{ name: 'domain', label: 'Domain', value: '', placeholder: 'quietfield.net' }],
    submit: 'Register',
    onSubmit: vals => {
      const res = registerDomain(app.game, vals.domain);
      if (!res.ok) { toast('Registration failed', res.error, 'r'); return false; }
      toast('Domain registered', res.domain, 'g');
      refreshUI();
      renderMarket(win);
    }
  });
}

function deployDialog(win) {
  const g = app.game;
  const servers = ownedServers(g);
  if (!servers.length) { toast('No server', 'Buy a VPS before deploying a site.', 'a'); return; }
  const domains = g.player.domains.length ? g.player.domains : ['quietfield.net'];
  formModal({
    title: 'Deploy a site', eyebrow: 'INFRASTRUCTURE',
    body: '<p>The source directory must contain an <code>index.html</code> or the deploy will use a placeholder. Register a domain first if you need one.</p>',
    fields: [
      { name: 'domain', label: 'Domain', value: domains[0], placeholder: 'quietfield.net' },
      { name: 'dir', label: 'Source directory', value: `${HOME}/projects`, placeholder: `${HOME}/projects` },
      { name: 'server', label: 'Server', type: 'select', value: servers[0].id, options: servers.map(s => ({ value: s.id, label: `${s.host} · ${s.ip} · ${s.plan || 'micro'}` })) }
    ],
    submit: 'Deploy',
    onSubmit: vals => {
      const res = deploySite(g, { domain: vals.domain, dir: vals.dir, serverId: vals.server });
      if (!res.ok) { toast('Deploy failed', res.error, 'r'); return false; }
      toast('Site deployed', `${res.site.domain} → ${res.server.ip} (${res.files} files)`, 'g');
      refreshUI();
      renderMarket(win);
    }
  });
}

/* ============================================================
   SERVERS
   ============================================================ */
MOUNTS.servers = function mountServers(win) {
  win.state = { query: '', filter: 'all' };
  win.render = () => renderServers(win);
  renderServers(win);
};

function renderServers(win) {
  const g = app.game;
  const st = win.state;
  const filters = [['all', 'All'], ['owned', 'Mine'], ['online', 'Online'], ['compromised', 'Compromised']];
  win.body.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;min-height:0">
    <div class="app-toolbar">
      <input class="input" data-server-search placeholder="filter host, ip, org, role…" value="${esc(st.query)}" style="flex:1">
      ${filters.map(([id, label]) => `<button class="tbtn small ${st.filter === id ? 'primary' : ''}" data-server-filter="${id}">${label}</button>`).join('')}
      <button class="tbtn small" data-server-action="refresh">${ic('arrow')}</button>
    </div>
    <div class="market-scroll" data-server-cards></div>
  </div>`;
  const input = win.body.querySelector('[data-server-search]');
  input.addEventListener('input', () => { st.query = input.value; renderServerCards(win); });
  for (const b of $$('[data-server-filter]', win.body)) {
    b.addEventListener('click', () => { st.filter = b.dataset.serverFilter; renderServers(win); });
  }
  const cards = win.body.querySelector('[data-server-cards]');
  cards.addEventListener('click', e => {
    const b = e.target.closest('[data-server-action]');
    if (!b) return;
    const s = g.servers.find(x => x.id === b.dataset.serverId);
    if (!s) return;
    const a = b.dataset.serverAction;
    if (a === 'refresh') { renderServers(win); return; }
    if (a === 'nmap') { runCommand(`nmap -sV ${s.host}`); return; }
    if (a === 'ssh') { runCommand(`ssh ${s.host}`); return; }
    if (a === 'audit') { runCommand(`audit ${s.host}`); return; }
    if (a === 'patch') {
      const res = patchServer(g, s);
      if (res.ok) toast('Patched', `${res.count} finding${res.count === 1 ? '' : 's'} closed on ${s.host}.`, 'g');
      else toast('Patch failed', res.error, 'a');
      refreshUI();
      return;
    }
    if (a === 'site') { const site = siteForServer(s); if (site) openWindow('browser', { url: site.domain }); else toast('No site', `${s.host} has no public site.`, 'a'); return; }
    if (a === 'map') {
      const mw = openWindow('map');
      setTimeout(() => { if (mw?.map) { mw.map.selected = s.id; renderMapSide(mw); } }, 60);
    }
  });
  renderServerCards(win);
}

function renderServerCards(win) {
  const g = app.game;
  const st = win.state;
  const q = st.query.trim().toLowerCase();
  let servers = g.servers.filter(s => {
    if (st.filter === 'owned' && !s.owned) return false;
    if (st.filter === 'online' && s.status !== 'online') return false;
    if (st.filter === 'compromised' && !s.compromised) return false;
    if (!q) return true;
    return [s.host, s.ip, s.domain, s.org, s.role, s.os, ...(s.tags || [])].join(' ').toLowerCase().includes(q);
  });
  servers = servers.sort((a, b) => (a.owned === b.owned ? 0 : a.owned ? -1 : 1) || a.host.localeCompare(b.host));
  const total = servers.length;
  const shown = servers.slice(0, 120);
  const cards = shown.map(s => {
    const site = siteForServer(s);
    const open = s.vulns.filter(v => !v.patched).length;
    return `<div class="scard">
      <div class="top"><div><h3>${esc(s.host)}</h3><div class="ip">${esc(s.ip)} · ${esc(s.domain)}</div></div>${statusTag(s.status)}</div>
      <div style="font-size:9px;color:var(--dim);line-height:1.5">${esc(s.org)} · ${esc(s.role)}<br>${esc(s.os)}</div>
      <div class="stats">
        <div class="stat"><span>SECURITY</span><b>${s.security}/99</b></div>
        <div class="stat"><span>FINDINGS</span><b style="color:${open ? 'var(--amber)' : 'var(--green)'}">${open}</b></div>
        <div class="stat"><span>REGION</span><b>${esc(s.region)}</b></div>
        <div class="stat"><span>UPTIME</span><b>${s.uptimePct.toFixed(1)}%</b></div>
      </div>
      <div class="svc-list">${s.services.slice(0, 6).map(x => tag(`${x.port}/${x.name}`, 'b')).join('')}</div>
      <div class="actions">
        <button class="tbtn small" data-server-action="nmap" data-server-id="${esc(s.id)}">nmap</button>
        <button class="tbtn small" data-server-action="ssh" data-server-id="${esc(s.id)}">ssh</button>
        <button class="tbtn small" data-server-action="audit" data-server-id="${esc(s.id)}">audit</button>
        ${s.owned ? `<button class="tbtn small" data-server-action="patch" data-server-id="${esc(s.id)}">patch</button>` : ''}
        ${site ? `<button class="tbtn small" data-server-action="site" data-server-id="${esc(s.id)}">site</button>` : ''}
        <button class="tbtn small" data-server-action="map" data-server-id="${esc(s.id)}">map</button>
      </div>
      ${s.owned ? `<div class="meta">${tag('owned', 'b')}${s.compromised ? tag('compromised', 'r') : ''}</div>` : ''}
    </div>`;
  }).join('');
  const owned = g.servers.filter(s => s.owned).length;
  win.body.querySelector('[data-server-cards]').innerHTML = `<div class="section-label" style="margin:2px 0 8px">NETWORK INVENTORY <b>${total}${total > shown.length ? ` / showing ${shown.length}` : ''}</b></div>
    <div class="server-grid">${cards || '<div class="empty-state"><b>No hosts match</b>Try a different filter or search term.</div>'}</div>`;
  win.status.innerHTML = `<span>${total} host${total === 1 ? '' : 's'} matched</span><span>${g.servers.filter(s => s.status === 'online').length} online</span><span class="st-right"><b>${owned} owned</b><span>${g.servers.filter(s => s.compromised).length} compromised</span></span>`;
}

/* ============================================================
   CLOUD
   ============================================================ */
MOUNTS.cloud = function mountCloud(win) {
  win.state = { tab: 'overview', plan: 'cloud-small', provider: 'orbital', region: 'us-east' };
  win.render = () => renderCloud(win);
  renderCloud(win);
};

function renderCloud(win) {
  const g = app.game;
  const st = win.state;
  const tabs = [['overview','Overview'],['instances','Instances'],['containers','Containers'],['clusters','Clusters'],['providers','Providers']];
  const monthly = g.cloud.instances.reduce((s, i) => s + i.monthly, 0);
  win.body.innerHTML = `<div class="market-layout">
    <div class="market-tabs">${tabs.map(([id, label]) => `<button class="market-tab ${st.tab === id ? 'on' : ''}" data-cloud-tab="${id}">${label}</button>`).join('')}<span style="margin-left:auto;font-family:var(--mono);font-size:9px;color:var(--green);padding:5px 8px">${fmtMoney(monthly)}/mo</span></div>
    <div class="market-note"><span><b>${g.cloud.instances.length}</b> instances · <b>${g.cloud.containers.filter(c => c.status === 'running').length}</b> containers running · <b>${g.cloud.clusters.length}</b> clusters</span><span>${g.cloud.containers.length} total containers</span></div>
    <div class="market-scroll" data-cloud-body></div>
  </div>`;
  for (const b of $$('[data-cloud-tab]', win.body)) b.addEventListener('click', () => { st.tab = b.dataset.cloudTab; renderCloud(win); });
  const body = win.body.querySelector('[data-cloud-body]');
  if (st.tab === 'overview') renderCloudOverview(win, body);
  else if (st.tab === 'instances') renderCloudInstances(win, body);
  else if (st.tab === 'containers') renderCloudContainers(win, body);
  else if (st.tab === 'clusters') renderCloudClusters(win, body);
  else renderCloudProviders(win, body);
  win.status.innerHTML = `<span>cloud</span><span>${g.cloud.instances.length} instances</span><span class="st-right"><b>${fmtMoney(monthly)}/mo</b><span>${g.cloud.containers.filter(c => c.status === 'running').length} running</span></span>`;
}

function renderCloudOverview(win, body) {
  const g = app.game;
  const owned = playerCloudServers(g);
  const agents = g.agents.filter(a => a.ownerType === 'player');
  const sites = playerSites(g);
  body.innerHTML = `<div class="section-label" style="margin:2px 0 8px">PROVISION <b>new capacity</b></div>
    <div class="cloud-launch">
      <select data-cloud-plan>${CLOUD_PLANS.map(p => `<option value="${p.id}" ${win.state.plan === p.id ? 'selected' : ''}>${p.name} · ${p.cpu} vCPU · ${p.ram} GB · ${p.disk} GB${p.gpu ? ' · GPU' : ''}</option>`).join('')}</select>
      <select data-cloud-provider>${g.cloud.providers.map(p => `<option value="${p.id}" ${win.state.provider === p.id ? 'selected' : ''}>${p.name} (${p.factor}×)</option>`).join('')}</select>
      <input class="input" data-cloud-region value="${esc(win.state.region)}" placeholder="region">
      <button class="tbtn primary" data-cloud-launch>Launch instance</button>
    </div>
    <div class="cloud-grid">
      <div class="scard"><div class="top"><h3>Instances</h3>${tag(String(g.cloud.instances.length), 'b')}</div><div style="font-size:9px;color:var(--dim)">${owned.length} server(s) provisioned through a provider.</div><button class="tbtn small" data-cloud-tab="instances">Inspect</button></div>
      <div class="scard"><div class="top"><h3>Containers</h3>${tag(String(g.cloud.containers.length), 'b')}</div><div style="font-size:9px;color:var(--dim)">${g.cloud.containers.filter(c => c.status === 'running').length} running on your hosts.</div><button class="tbtn small" data-cloud-tab="containers">Inspect</button></div>
      <div class="scard"><div class="top"><h3>Clusters</h3>${tag(String(g.cloud.clusters.length), 'b')}</div><div style="font-size:9px;color:var(--dim)">${g.cloud.clusters.reduce((s, c) => s + c.workloads.length, 0)} workloads scheduled.</div><button class="tbtn small" data-cloud-tab="clusters">Inspect</button></div>
      <div class="scard"><div class="top"><h3>Agents</h3>${tag(String(agents.length), 'b')}</div><div style="font-size:9px;color:var(--dim)">${agents.filter(a => a.status === 'active').length} active on your infrastructure.</div><button class="tbtn small" data-open="agents">Inspect</button></div>
    </div>
    <div class="section-label" style="margin:16px 0 8px">OPERATIONS <b>quick commands</b></div>
    <div class="cmd-chips">
      <button class="tbtn small" data-run="cloud providers">cloud providers</button>
      <button class="tbtn small" data-run="cloud plans">cloud plans</button>
      <button class="tbtn small" data-run="docker ps -a">docker ps -a</button>
      <button class="tbtn small" data-run="kubectl get pods">kubectl get pods</button>
      <button class="tbtn small" data-run="agent list">agent list</button>
    </div>
    <div class="section-label" style="margin:16px 0 8px">RECENT <b>cloud activity</b></div>
    <div class="site-list">${g.feed.filter(f => /cloud|container|cluster|agent|instance/i.test(f.text)).slice(0, 6).map(f => `<div class="site-list-item"><span class="n">${worldHHMM(f.world)}</span><div><b>${esc(f.text)}</b><small>${f.kind}</small></div></div>`).join('') || '<div class="site-list-item"><span class="n">—</span><div><b>Quiet</b><small>No cloud events yet.</small></div></div>'}</div>`;
  const planSel = body.querySelector('[data-cloud-plan]');
  const provSel = body.querySelector('[data-cloud-provider]');
  const regionIn = body.querySelector('[data-cloud-region]');
  planSel.addEventListener('change', () => { win.state.plan = planSel.value; });
  provSel.addEventListener('change', () => { win.state.provider = provSel.value; const p = findProvider(g, provSel.value); if (p) { win.state.region = p.regions[0]; regionIn.value = p.regions[0]; } });
  body.querySelector('[data-cloud-launch]').addEventListener('click', () => {
    win.state.plan = planSel.value; win.state.provider = provSel.value; win.state.region = regionIn.value.trim() || 'us-east';
    runCommand(`cloud launch ${win.state.plan} ${win.state.provider} ${win.state.region}`);
    setTimeout(() => renderCloud(win), 120);
  });
  for (const b of $$('[data-cloud-tab]', body)) b.addEventListener('click', () => { win.state.tab = b.dataset.cloudTab; renderCloud(win); });
  for (const b of $$('[data-run]', body)) b.addEventListener('click', () => runCommand(b.dataset.run));
}

function renderCloudInstances(win, body) {
  const g = app.game;
  const list = g.cloud.instances;
  body.innerHTML = `<div style="display:flex;gap:4px;margin-bottom:10px"><button class="tbtn small" data-run="cloud launch cloud-small">Launch</button><button class="tbtn small" data-run="cloud instances">Refresh</button></div>
    <div class="server-grid">${list.map(i => {
      const s = g.servers.find(x => x.id === i.serverId);
      const p = findProvider(g, i.providerId);
      const plan = CLOUD_PLANS.find(x => x.id === i.planId);
      return `<div class="scard"><div class="top"><div><h3>${esc(s?.host || i.serverId)}</h3><div class="ip">${esc(s?.ip || '—')} · ${esc(i.region)}</div></div>${statusTag(s?.status || 'offline')}</div>
        <div style="font-size:9px;color:var(--dim)">${esc(p?.name || i.providerId)} · ${esc(plan?.name || i.planId)}<br>${plan ? `${plan.cpu} vCPU · ${plan.ram} GB RAM · ${plan.disk} GB disk` : ''}</div>
        <div class="stats"><div class="stat"><span>MONTHLY</span><b>${fmtMoney(i.monthly)}</b></div><div class="stat"><span>CONTAINERS</span><b>${g.cloud.containers.filter(c => c.serverId === i.serverId).length}</b></div><div class="stat"><span>CREATED</span><b>${worldHHMM(i.createdAt)}</b></div><div class="stat"><span>GPU</span><b>${i.gpu ? 'yes' : 'no'}</b></div></div>
        <div class="actions"><button class="tbtn small" data-run="ssh ${esc(s?.host || i.serverId)}">ssh</button><button class="tbtn small" data-run="docker ps">docker ps</button><button class="tbtn small danger" data-cloud-destroy="${esc(i.id)}">destroy</button></div>
      </div>`;
    }).join('') || '<div class="empty-state"><b>No cloud instances</b>Launch one from the Overview tab or with: cloud launch cloud-small</div>'}</div>`;
  for (const b of $$('[data-run]', body)) b.addEventListener('click', () => runCommand(b.dataset.run));
  for (const b of $$('[data-cloud-destroy]', body)) b.addEventListener('click', () => { runCommand(`cloud destroy ${b.dataset.cloudDestroy}`); setTimeout(() => renderCloud(win), 120); });
}

function renderCloudContainers(win, body) {
  const g = app.game;
  const list = g.cloud.containers;
  body.innerHTML = `<div style="display:flex;gap:4px;margin-bottom:10px"><button class="tbtn small" data-run="docker run -d nginx:alpine">Run nginx</button><button class="tbtn small" data-run="docker ps -a">Refresh</button><button class="tbtn small" data-run="cloud images">Images</button></div>
    <div class="cloud-table">
      <div class="cloud-row head"><span>NAME</span><span>IMAGE</span><span>HOST</span><span>STATUS</span><span>PORT</span><span></span></div>
      ${list.map(c => `<div class="cloud-row"><span><b>${esc(c.name)}</b><small>${esc(c.id)}</small></span><span>${esc(c.image)}</span><span>${esc(g.servers.find(s => s.id === c.serverId)?.host || 'gone')}</span><span>${c.status === 'running' ? tag('running','g') : tag(c.status,'r')}<small>${c.restarts} restarts</small></span><span>${c.port}/tcp</span><span class="row-actions"><button class="tbtn small" data-run="docker ${c.status === 'running' ? 'stop' : 'start'} ${esc(c.id)}">${c.status === 'running' ? 'stop' : 'start'}</button><button class="tbtn small" data-run="docker logs ${esc(c.id)}">logs</button><button class="tbtn small danger" data-run="docker rm ${esc(c.id)}">rm</button></span></div>`).join('') || '<div class="empty-state"><b>No containers</b>Run one with: docker run -d nginx:alpine</div>'}
    </div>`;
  for (const b of $$('[data-run]', body)) b.addEventListener('click', () => { runCommand(b.dataset.run); setTimeout(() => renderCloud(win), 120); });
}

function renderCloudClusters(win, body) {
  const g = app.game;
  body.innerHTML = `<div style="display:flex;gap:4px;margin-bottom:10px"><button class="tbtn small" data-run="kubectl create cluster edge">Create cluster</button><button class="tbtn small" data-run="kubectl get pods">Pods</button><button class="tbtn small" data-run="kubectl get nodes">Nodes</button></div>
    <div class="server-grid">${g.cloud.clusters.map(c => `<div class="scard"><div class="top"><div><h3>${esc(c.name)}</h3><div class="ip">${esc(c.id)} · ${esc(c.version)}</div></div>${statusTag(c.status === 'healthy' ? 'online' : c.status === 'offline' ? 'offline' : 'degraded')}</div>
      <div class="stats"><div class="stat"><span>NODES</span><b>${c.nodeIds.length}</b></div><div class="stat"><span>WORKLOADS</span><b>${c.workloads.length}</b></div><div class="stat"><span>READY</span><b>${c.workloads.reduce((s, w) => s + (w.running || 0), 0)}/${c.workloads.reduce((s, w) => s + w.replicas, 0)}</b></div><div class="stat"><span>STATUS</span><b>${esc(c.status)}</b></div></div>
      <div class="svc-list">${c.workloads.map(w => tag(`${w.name} ${w.running || 0}/${w.replicas}`, 'b')).join('') || tag('no workloads')}</div>
      <div class="actions"><button class="tbtn small" data-run="kubectl get pods ${esc(c.name)}">pods</button><button class="tbtn small" data-run="kubectl describe cluster ${esc(c.name)}">describe</button></div></div>`).join('') || '<div class="empty-state"><b>No clusters</b>Create one with: kubectl create cluster edge</div>'}</div>
    <div class="section-label" style="margin:16px 0 8px">MANIFEST <b>example</b></div>
    <pre class="mini-code">apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: web
          image: nginx:alpine</pre>
    <div class="dim" style="font-size:9px">Write it to deploy.yaml, then run: kubectl apply -f deploy.yaml</div>`;
  for (const b of $$('[data-run]', body)) b.addEventListener('click', () => { runCommand(b.dataset.run); setTimeout(() => renderCloud(win), 120); });
}

function renderCloudProviders(win, body) {
  const g = app.game;
  body.innerHTML = `<div class="cloud-table">
    <div class="cloud-row head"><span>PROVIDER</span><span>REGIONS</span><span>FACTOR</span><span>RELIABILITY</span><span>STATUS</span><span></span></div>
    ${g.cloud.providers.map(p => `<div class="cloud-row"><span><b>${esc(p.name)}</b><small>${esc(p.id)} · ${esc(p.asn)}</small></span><span>${p.regions.join(', ')}</span><span>${p.factor}×</span><span>${p.reliability}%</span><span>${p.status === 'operational' ? tag('operational','g') : tag('degraded','a')}</span><span class="row-actions"><button class="tbtn small" data-run="cloud plans ${esc(p.id)}">plans</button></span></div>`).join('')}
  </div>
  <div class="section-label" style="margin:16px 0 8px">PLAN <b>pricing at base factor</b></div>
  <div class="cloud-table">
    <div class="cloud-row head"><span>PLAN</span><span>CPU</span><span>RAM</span><span>DISK</span><span>BASE</span><span>NOTE</span></div>
    ${CLOUD_PLANS.map(p => `<div class="cloud-row"><span><b>${esc(p.name)}</b><small>${esc(p.id)}</small></span><span>${p.cpu} vCPU</span><span>${p.ram} GB</span><span>${p.disk} GB</span><span>${fmtMoney(p.price)}/mo</span><span>${esc(p.desc)}</span></div>`).join('')}
  </div>`;
  for (const b of $$('[data-run]', body)) b.addEventListener('click', () => runCommand(b.dataset.run));
}

/* ============================================================
   AI AGENTS
   ============================================================ */
MOUNTS.agents = function mountAgents(win) {
  win.state = { tab: 'roster', showAll: false };
  win.render = () => renderAgents(win);
  renderAgents(win);
};

function renderAgents(win) {
  const g = app.game;
  const st = win.state;
  const mine = g.agents.filter(a => a.ownerType === 'player');
  const tabs = [['roster','Roster'],['models','Models'],['orgs','Organizations'],['register','Public register']];
  win.body.innerHTML = `<div class="market-layout">
    <div class="market-tabs">${tabs.map(([id, label]) => `<button class="market-tab ${st.tab === id ? 'on' : ''}" data-agent-tab="${id}">${label}</button>`).join('')}<span style="margin-left:auto;font-family:var(--mono);font-size:9px;color:var(--green);padding:5px 8px">${mine.length} yours · ${g.agents.length} known</span></div>
    <div class="market-note"><span><b>${mine.filter(a => a.status === 'active').length}</b> active · <b>${mine.reduce((s, a) => s + a.tasksDone, 0)}</b> tasks completed · daily net <b>${fmtMoney(mine.reduce((s, a) => s + agentDailyRevenue(a) - agentDailyCost(a), 0))}</b></span><span>agents are bounded by permissions</span></div>
    <div class="market-scroll" data-agent-body></div>
  </div>`;
  for (const b of $$('[data-agent-tab]', win.body)) b.addEventListener('click', () => { st.tab = b.dataset.agentTab; renderAgents(win); });
  const body = win.body.querySelector('[data-agent-body]');
  if (st.tab === 'roster') renderAgentRoster(win, body);
  else if (st.tab === 'models') renderAgentModels(win, body);
  else if (st.tab === 'orgs') renderAgentOrgs(win, body);
  else renderAgentRegister(win, body);
  win.status.innerHTML = `<span>agents</span><span>${mine.length} deployed</span><span class="st-right"><b>${mine.filter(a => a.status === 'active').length} active</b><span>${fmtMoney(mine.reduce((s, a) => s + agentDailyRevenue(a), 0))}/day gross</span></span>`;
}

function renderAgentRoster(win, body) {
  const g = app.game;
  const mine = g.agents.filter(a => a.ownerType === 'player');
  const servers = ownedServers(g).filter(s => s.status === 'online');
  body.innerHTML = `<div class="section-label" style="margin:2px 0 8px">DEPLOY <b>a new agent</b></div>
    <div class="cloud-launch">
      <input class="input" data-agent-name placeholder="agent name" value="assistant">
      <select data-agent-role>${AGENT_ROLES.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}</select>
      <select data-agent-model>${AGENT_MODELS.map(m => `<option value="${m.id}">${m.name} · $${m.cost}/mo</option>`).join('')}</select>
      <select data-agent-server>${servers.map(s => `<option value="${s.id}">${s.host}</option>`).join('') || '<option value="">no online server</option>'}</select>
      <button class="tbtn primary" data-agent-deploy>Deploy</button>
    </div>
    <div class="section-label" style="margin:14px 0 8px">YOUR AGENTS <b>${mine.length}</b></div>
    <div class="server-grid">${mine.map(a => {
      const model = agentModel(a.modelId), role = agentRole(a.roleId);
      const server = g.servers.find(s => s.id === a.serverId);
      return `<div class="scard"><div class="top"><div><h3>${esc(a.name)}</h3><div class="ip">${esc(role.name)} · ${esc(model.name)}</div></div>${a.status === 'active' ? tag('active','g') : a.status === 'paused' ? tag('paused','a') : tag(a.status,'r')}</div>
        <div style="font-size:9px;color:var(--dim)">${esc(server?.host || 'no host')} · ${fmtNum(a.tasksDone)} tasks<br>${esc(a.memory[a.memory.length - 1]?.text || '')}</div>
        <div class="stats"><div class="stat"><span>GROSS</span><b>${fmtMoney(agentDailyRevenue(a))}/day</b></div><div class="stat"><span>MODEL</span><b>${fmtMoney(agentDailyCost(a))}/day</b></div><div class="stat"><span>SPENT</span><b>${fmtMoney(a.spend)}</b></div><div class="stat"><span>EFF</span><b>${(a.efficiency * 100).toFixed(0)}%</b></div></div>
        <div class="actions"><button class="tbtn small" data-run="agent inspect ${esc(a.name)}">inspect</button>${a.status === 'active' ? `<button class="tbtn small" data-run="agent pause ${esc(a.name)}">pause</button>` : `<button class="tbtn small" data-run="agent start ${esc(a.name)}">start</button>`}<button class="tbtn small danger" data-run="agent stop ${esc(a.name)}">stop</button></div>
      </div>`;
    }).join('') || '<div class="empty-state"><b>No agents deployed</b>Choose a role, a model, and an online host above. Deployment costs $45.</div>'}</div>`;
  const nameIn = body.querySelector('[data-agent-name]');
  const roleSel = body.querySelector('[data-agent-role]');
  const modelSel = body.querySelector('[data-agent-model]');
  const serverSel = body.querySelector('[data-agent-server]');
  body.querySelector('[data-agent-deploy]').addEventListener('click', () => {
    const name = nameIn.value.trim() || 'assistant';
    if (!serverSel.value) { toast('No host', 'Provision a server before deploying an agent.', 'a'); return; }
    runCommand(`agent deploy ${name} --role ${roleSel.value} --model ${modelSel.value} --server ${serverSel.value}`);
    setTimeout(() => renderAgents(win), 160);
  });
  for (const b of $$('[data-run]', body)) b.addEventListener('click', () => { runCommand(b.dataset.run); setTimeout(() => renderAgents(win), 140); });
}

function renderAgentModels(win, body) {
  body.innerHTML = `<div class="cloud-table">
    <div class="cloud-row head"><span>MODEL</span><span>VENDOR</span><span>COST</span><span>SKILL</span><span>CONTEXT</span><span>NOTE</span></div>
    ${AGENT_MODELS.map(m => `<div class="cloud-row"><span><b>${esc(m.name)}</b><small>${esc(m.id)}</small></span><span>${esc(m.vendor)}</span><span>$${m.cost}/mo</span><span>${m.skill}</span><span>${m.context}k</span><span>${esc(m.desc)}</span></div>`).join('')}
  </div>
  <div class="section-label" style="margin:16px 0 8px">ROLES <b>expected output</b></div>
  <div class="cloud-table">
    <div class="cloud-row head"><span>ROLE</span><span>GROSS</span><span>RISK</span><span>PERMISSIONS</span><span></span><span>NOTE</span></div>
    ${AGENT_ROLES.map(r => `<div class="cloud-row"><span><b>${esc(r.name)}</b><small>${esc(r.id)}</small></span><span>~$${r.revenue}/day</span><span>${(r.risk * 100).toFixed(0)}%</span><span>human review</span><span></span><span>${esc(r.desc)}</span></div>`).join('')}
  </div>`;
}

function renderAgentOrgs(win, body) {
  const g = app.game;
  const mine = playerCompany(g);
  const list = [...g.companies].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  body.innerHTML = `<div style="display:flex;gap:4px;margin-bottom:10px"><button class="tbtn small" data-run="company list">Refresh</button>${mine ? `<button class="tbtn small" data-run="company mine">My company</button>` : `<button class="tbtn small" data-run="company register">Register company</button>`}</div>
    <div class="cloud-table">
      <div class="cloud-row head"><span>ORGANIZATION</span><span>SECTOR</span><span>REVENUE</span><span>FUNDS</span><span>STATUS</span><span></span></div>
      ${list.map(co => `<div class="cloud-row"><span><b>${esc(co.name)}</b><small>${esc(co.domain)} · ${fmtNum(co.employees)} staff</small></span><span>${esc(co.sector)}</span><span>${fmtMoney(co.revenue)}/mo</span><span>${fmtMoney(co.funds)}</span><span>${co.status === 'operating' ? tag('operating','g') : co.status === 'failed' ? tag('failed','r') : tag(co.status,'a')}</span><span class="row-actions"><button class="tbtn small" data-run="company inspect ${esc(co.name)}">inspect</button></span></div>`).join('')}
    </div>
    <div class="section-label" style="margin:16px 0 8px">YOUR COMPANY <b>${mine ? esc(mine.name) : 'none'}</b></div>
    ${mine ? `<div class="scard"><div class="top"><div><h3>${esc(mine.name)}</h3><div class="ip">${esc(mine.status)} · ${fmtMoney(mine.revenue)}/mo</div></div>${tag('operator','b')}</div><div class="stats"><div class="stat"><span>FUNDS</span><b>${fmtMoney(mine.funds)}</b></div><div class="stat"><span>BURN</span><b>${fmtMoney(mine.burn)}/mo</b></div><div class="stat"><span>PRODUCTS</span><b>${mine.products.length}</b></div><div class="stat"><span>VALUATION</span><b>${fmtMoney(companyValuation(mine))}</b></div></div><div class="actions"><button class="tbtn small" data-run="company launch">Launch product</button><button class="tbtn small" data-run="company products">Products</button></div></div>` : '<div class="empty-state"><b>No company</b>Register one for $250, then launch products that earn recurring revenue.</div>'}`;
  for (const b of $$('[data-run]', body)) b.addEventListener('click', () => { runCommand(b.dataset.run); setTimeout(() => renderAgents(win), 160); });
}

function renderAgentRegister(win, body) {
  const g = app.game;
  const list = g.agents.slice(0, 40);
  body.innerHTML = `<div class="cloud-table">
    <div class="cloud-row head"><span>AGENT</span><span>OWNER</span><span>ROLE</span><span>MODEL</span><span>STATUS</span><span>TASKS</span></div>
    ${list.map(a => `<div class="cloud-row"><span><b>${esc(a.name)}</b><small>${esc(a.id)}</small></span><span>${esc(a.ownerName)}</span><span>${esc(agentRole(a.roleId).name)}</span><span>${esc(agentModel(a.modelId).name)}</span><span>${a.status === 'active' ? tag('active','g') : tag(a.status,'a')}</span><span>${fmtNum(a.tasksDone)}</span></div>`).join('')}
  </div>
  <div class="dim" style="font-size:9px;margin-top:8px">The register lists known public agents. Private agents and agent memory are not exposed.</div>`;
}

/* ============================================================
   PROCESSES
   ============================================================ */
MOUNTS.processes = function mountProcesses(win) {
  win.render = () => renderProcesses(win);
  renderProcesses(win);
};

function renderProcesses(win) {
  const g = app.game;
  const procs = [...g.processes].sort((a, b) => b.cpu - a.cpu);
  const cpu = procs.reduce((s, p) => s + p.cpu, 0);
  const mem = procs.reduce((s, p) => s + p.mem, 0);
  const load = 0.22 + (cpu / 100) + (g.tickCount % 7) * .03;
  const metrics = [
    ['CPU', `${cpu.toFixed(1)}%`, clamp(cpu, 0, 100), cpu > 70 ? 'red' : ''],
    ['MEMORY', `${mem.toFixed(1)}%`, clamp(mem, 0, 100), mem > 70 ? 'amber' : ''],
    ['LOAD', load.toFixed(2), clamp(load * 33, 0, 100), load > 2 ? 'red' : ''],
    ['PROCESSES', String(procs.length), clamp(procs.length * 2, 0, 100), '']
  ];
  win.body.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;min-height:0">
    <div class="proc-top">${metrics.map(([label, val, p, cls]) => `<div class="proc-metric"><span>${label}</span><b>${val}</b><div class="bar ${cls}"><i style="width:${p}%"></i></div></div>`).join('')}</div>
    <div class="app-toolbar"><span style="font-family:var(--mono);font-size:8px;color:var(--faint)">voidbox · kernel 6.8.11-amd64</span><span class="spacer"></span><button class="tbtn small" data-proc-action="refresh">${ic('arrow')} Refresh</button></div>
    <div class="proc-table">
      <div class="proc-head"><span>PID</span><span>COMMAND</span><span>USER</span><span>CPU%</span><span>MEM%</span><span>STATE</span></div>
      ${procs.map(p => `<div class="proc-row"><span class="pid">${p.pid}</span><span class="cmd" title="${esc(p.command)}">${esc(p.command)}</span><span>${esc(p.user)}</span><span class="num">${p.cpu.toFixed(1)}</span><span class="num">${p.mem.toFixed(1)}</span><span>${esc(p.state || 'S')} <span class="kill" data-kill="${p.pid}">kill</span></span></div>`).join('')}
    </div>
  </div>`;
  win.body.querySelector('[data-proc-action="refresh"]').addEventListener('click', () => renderProcesses(win));
  for (const k of $$('[data-kill]', win.body)) {
    k.addEventListener('click', () => {
      const pid = Number(k.dataset.kill);
      const proc = g.processes.find(p => p.pid === pid);
      if (!proc) return;
      if (proc.pid === 1) { toast('Kill refused', 'init is protected by the simulation.', 'r'); return; }
      g.processes = g.processes.filter(p => p.pid !== pid);
      toast('Process killed', `${pid} · ${proc.command}`, 'a');
      renderProcesses(win);
      refreshUI();
    });
  }
  win.status.innerHTML = `<span>${procs.length} processes</span><span>load ${load.toFixed(2)} ${load.toFixed(2)} ${(load * .9).toFixed(2)}</span>
    <span class="st-right"><b>${cpu.toFixed(1)}% cpu</b><span>${mem.toFixed(1)}% mem</span></span>`;
}

/* ============================================================
   PROFILE
   ============================================================ */
MOUNTS.profile = function mountProfile(win) {
  win.render = () => renderProfile(win);
  renderProfile(win);
};

function renderProfile(win) {
  const g = app.game;
  const p = g.player;
  const skill = getPlayerSkill(g);
  const th = threatInfo(g);
  const owned = ownedServers(g);
  const sites = playerSites(g);
  const partners = mailPartners(g).size;
  const stats = [
    ['BALANCE', fmtMoney(p.money)],
    ['NET WORTH', fmtMoney(netWorth(g))],
    ['REPUTATION', String(p.reputation)],
    ['SKILL', `${skill} / 10`],
    ['CONTRACTS', `${g.stats.contracts} done`],
    ['FAILED', String(p.contractsFailed)],
    ['HEAT', `${Math.round(p.heat)}%`],
    ['SERVERS', String(owned.length)],
    ['SITES', String(sites.length)]
  ];
  const skills = [
    ['Reconnaissance', clamp(18 + g.stats.scans * 4, 0, 100)],
    ['Audit', clamp(14 + g.stats.audits * 7, 0, 100)],
    ['Exploitation', clamp(10 + g.stats.exploits * 9, 0, 100)],
    ['Defense', clamp(16 + g.stats.patches * 8, 0, 100)],
    ['Delivery', clamp(12 + g.stats.contracts * 6 + g.stats.deploys * 4, 0, 100)],
    ['Engineering', clamp(8 + g.stats.codeLines * .5, 0, 100)]
  ];
  const achievements = ACHIEVEMENTS.map(a => {
    const at = g.achievements[a.id];
    return `<div class="ach ${at ? '' : 'locked'}">${ic('shield')}<div><b>${esc(a.name)}</b><small>${esc(a.desc)}${at ? ` · ${fmtDate(at)}` : ''}</small></div></div>`;
  }).join('');
  const tx = p.transactions.slice(0, 10).map(t => `<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid #161e24;font-family:var(--mono);font-size:8.5px"><span style="color:var(--dim)">${fmtDateTime(t.time)}</span><span style="flex:1;color:var(--text2)">${esc(t.memo || 'transaction')}</span><b style="color:${t.amount >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtMoney(t.amount, true)}</b></div>`).join('') || '<div class="dim" style="font-size:9px">No transactions yet.</div>';
  const legal = g.legal.slice(-3).reverse().map(l => `<div style="font-size:9px;color:var(--red);padding:3px 0">${fmtDateTime(l.time)} · ${esc(l.authority)} · ${fmtMoney(l.fine)} · ${esc(l.reason)}</div>`).join('');
  win.body.innerHTML = `<div class="profile-layout">
    <div class="profile-head">
      <div class="profile-avatar">${esc((p.handle || 'op').slice(0, 2))}</div>
      <div style="flex:1"><h2>${esc(p.name)}</h2><p>@${esc(p.handle)} · ${esc(p.alias)} · ${esc(p.host)} (${esc(p.ip)})</p>
        <div class="badges">${tag(playerTitle(g), 'g')}${tag(skillTitle(g), 'b')}${tag(`rep ${p.reputation}`, 'g')}${tag(`${th.label} threat`, th.color === 'red' ? 'r' : th.color === 'amber' ? 'a' : 'g')}</div></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
        <button class="tbtn small" data-profile-action="edit">Edit handle</button>
        <button class="tbtn small" data-profile-action="save">${ic('save')} Save</button>
        <button class="tbtn small" data-profile-action="terminal">Terminal</button>
        <button class="tbtn small danger" data-profile-action="reset">Reset world</button>
      </div>
    </div>
    <div class="profile-grid">${stats.map(([k, v]) => `<div class="pstat"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
    <div class="section-label">DISCIPLINES</div>
    ${skills.map(([k, v]) => `<div class="skill-row"><span>${k}</span><div class="bar ${v < 35 ? 'amber' : ''}"><i style="width:${v}%"></i></div><b>${Math.round(v)}</b></div>`).join('')}
    <div class="section-label" style="margin-top:14px">HEAT <b>${Math.round(p.heat)}%</b></div>
    <div class="bar-row"><div class="bar ${p.heat >= 62 ? 'red' : p.heat >= 35 ? 'amber' : ''}"><i style="width:${p.heat}%"></i></div><span>${th.label}</span></div>
    <div class="section-label" style="margin-top:14px">ACHIEVEMENTS <b>${Object.keys(g.achievements).length} / ${ACHIEVEMENTS.length}</b></div>
    <div class="ach-grid">${achievements}</div>
    <div class="section-label" style="margin-top:14px">RECENT TRANSACTIONS</div>
    <div>${tx}</div>
    ${legal ? `<div class="section-label" style="margin-top:14px;color:var(--red)">ENFORCEMENT</div>${legal}` : ''}
    <div style="margin-top:14px;font-family:var(--mono);font-size:8px;color:var(--faint);line-height:1.6">
      joined ${fmtDate(p.joined)} · ${g.stats.earned ? fmtMoney(g.stats.earned) : '$0'} earned · ${g.stats.spent ? fmtMoney(g.stats.spent) : '$0'} spent · ${partners} correspondent${partners === 1 ? '' : 's'} · ${g.stats.logins} remote login${g.stats.logins === 1 ? '' : 's'}
    </div>
  </div>`;
  for (const b of $$('[data-profile-action]', win.body)) {
    b.addEventListener('click', () => profileAction(win, b.dataset.profileAction));
  }
  win.status.innerHTML = `<span>@${esc(p.handle)}</span><span>${esc(playerTitle(g))}</span><span class="st-right"><b>${fmtMoney(p.money)}</b><span>${fmtMoney(netWorth(g))} net worth</span></span>`;
}

function profileAction(win, action) {
  const g = app.game;
  if (action === 'save') { saveGame(true); return; }
  if (action === 'terminal') { openWindow('terminal'); return; }
  if (action === 'edit') {
    formModal({
      title: 'Edit handle', fields: [{ name: 'handle', label: 'Handle', value: g.player.handle }], submit: 'Update',
      onSubmit: vals => {
        const h = vals.handle.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 18);
        if (!h) { toast('Invalid handle', 'Use letters, numbers, underscore or dash.', 'r'); return false; }
        g.player.handle = h;
        refreshUI();
        toast('Handle updated', `@${h}`, 'g');
      }
    });
    return;
  }
  if (action === 'reset') {
    showModal({
      title: 'Reset the persistent world', eyebrow: 'IRREVERSIBLE',
      body: '<p>This erases the current save, including your filesystem, reputation, contracts, mail, and infrastructure. A new network will be generated.</p><p class="dim">The world will not remember you.</p>',
      actions: [{ label: 'Cancel' }, { label: 'Reset world', kind: 'danger', onClick: () => resetWorld() }]
    });
  }
}

/* ============================================================
   CIVILIZATION DASHBOARD
   ============================================================ */
const CIV_TABS = [
  ['overview', 'Overview'], ['world', 'World'], ['society', 'Society'],
  ['research', 'Research'], ['technology', 'Technology'], ['media', 'Media'],
  ['culture', 'Culture'], ['law', 'Law'], ['property', 'Property'], ['history', 'History']
];

function civStat(label, value, note = '', cls = '') {
  return `<div class="civ-stat ${cls}"><span>${esc(label)}</span><b>${esc(String(value))}</b>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
}
function civMeter(label, value, note = '') {
  const v = clamp(Number(value) || 0, 0, 100);
  return `<div class="civ-meter"><span>${esc(label)}</span><div class="bar ${v < 34 ? 'red' : v < 55 ? 'amber' : ''}"><i style="width:${v}%"></i></div><b>${Math.round(v)}</b>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
}
function civSection(title, body, note = '') {
  if (!body) return '';
  return `<section class="civ-section"><div class="civ-section-head"><h3>${esc(title)}</h3>${note ? `<span>${esc(note)}</span>` : ''}</div>${body}</section>`;
}
function civRow(left, right, cls = '') {
  return `<div class="civ-row ${cls}"><div>${left}</div><div class="civ-row-right">${right}</div></div>`;
}

function renderCiv(win) {
  const g = app.game;
  const s = civilizationSummary(g);
  const m = s.metrics;
  const civ = s.civ;
  if (!CIV_TABS.some(t => t[0] === win.civTab)) win.civTab = 'overview';
  const tab = win.civTab;
  const tabs = CIV_TABS.map(([id, label]) => `<button class="civ-tab ${id === tab ? 'on' : ''}" data-civ-tab="${id}">${label}</button>`).join('');
  let content = '';
  if (tab === 'overview') content = civOverview(g, s, m, civ);
  else if (tab === 'world') content = civWorld(civ);
  else if (tab === 'society') content = civSocietyView(g, civ);
  else if (tab === 'research') content = civResearchView(g, civ);
  else if (tab === 'technology') content = civTechView(civ);
  else if (tab === 'media') content = civMediaView(civ);
  else if (tab === 'culture') content = civCultureView(civ);
  else if (tab === 'law') content = civLawView(g, civ);
  else if (tab === 'property') content = civPropertyView(g, civ);
  else content = civHistoryView(g);
  win.body.innerHTML = `<div class="civ-app"><div class="civ-tabs">${tabs}</div><div class="civ-content">${content}</div></div>`;
  win.status.innerHTML = `<span>${esc(s.country?.name || 'world')} · ${esc(s.city?.name || '')}</span><span>year ${m.year}</span><span class="st-right"><b>${m.civilizationIndex}/100</b><span>${fmtNum(civ.countries.length)} countries · ${fmtNum(civ.society.households.length)} households</span></span>`;
}

function civOverview(g, s, m, civ) {
  const events = civ.events.filter(e => e.status === 'active').slice(0, 5);
  const eventRows = events.map(e => civRow(
    `<b>${esc(e.title)}</b><small>${esc(e.category)} · ${esc(e.severity)} · ${esc(civ.countries.find(c => c.id === e.countryId)?.name || 'global')}</small>`,
    `<span class="tag ${e.severity === 'severe' ? 'r' : 'a'}">${Math.max(0, Math.ceil((e.startedWorld + e.durationWorld - civ.worldMinutes) / 1440))}d</span>`
  )).join('');
  const identity = civ.player;
  const place = `${s.city?.name || 'unknown'}, ${s.country?.name || 'unknown'}`;
  return `
    <div class="civ-grid cols-3">
      ${civStat('Civilization index', `${m.civilizationIndex}/100`, 'stability, freedom, technology', m.civilizationIndex >= 60 ? 'ok' : '')}
      ${civStat('Population', fmtNum(m.population), `${fmtNum(civ.cities.length)} cities`)}
      ${civStat('Global GDP', `$${(m.gdp / 1e12).toFixed(1)}T`, `growth ${m.growth.toFixed(1)}%`)}
      ${civStat('Stability', `${m.stability.toFixed(0)}/100`, `unrest ${(100 - m.stability).toFixed(0)}`)}
      ${civStat('Internet freedom', `${m.internetFreedom.toFixed(0)}/100`, 'cross-country average')}
      ${civStat('Research level', m.researchLevel.toFixed(1), `${civ.research.discoveries.length} discoveries`)}
    </div>
    <div class="civ-grid cols-4">
      ${civStat('Inflation', `${m.inflation.toFixed(1)}%`)}
      ${civStat('Unemployment', `${m.unemployment.toFixed(1)}%`)}
      ${civStat('Technology adoption', `${m.technologyAdoption.toFixed(0)}/100`)}
      ${civStat('Supply pressure', `${Math.round(m.supplyPressure * 100)}%`, 'hardware index vs baseline')}
      ${civStat('Media trust', `${m.mediaTrust.toFixed(0)}/100`)}
      ${civStat('Legal pressure', `${m.legalPressure.toFixed(0)}/100`)}
      ${civStat('Inequality', `${m.inequality.toFixed(0)}/100`)}
      ${civStat('Active events', String(m.activeEvents), 'persisting consequences')}
    </div>
    ${civSection('ACTIVE WORLD EVENTS', eventRows || '<div class="civ-empty">The world is quiet for now.</div>', `${civ.events.filter(e => e.status === 'active').length} active`)}
    <div class="civ-grid cols-2">
      ${civSection('YOUR CONTEXT', `
        ${civRow(`<b>@${esc(identity.handle)}</b><small>${esc(place)}</small>`, `<span class="tag g">${esc(identity.professional.title || 'independent')}</span>`)}
        ${civMeter('Professional', identity.professional.score)}
        ${civMeter('Social', identity.social.score, `${fmtNum(identity.social.followers)} followers`)}
        ${civMeter('Financial credit', (identity.financial.credit - 300) / 5.5, `credit ${identity.financial.credit}`)}
        ${civMeter('Academic', identity.academic.score, `${identity.academic.publications} papers`)}
      `, 'contextual reputation')}
      ${civSection('WHAT TO DO NEXT', `
        ${civRow('<b>Study a field</b><small>Raise practical knowledge and credentials</small>', '<span class="tag b">civ study</span>')}
        ${civRow('<b>Find work</b><small>Apply, interview and negotiate</small>', '<span class="tag b">civ jobs</span>')}
        ${civRow('<b>Start research</b><small>Fund a project and wait for results</small>', '<span class="tag b">civ research</span>')}
        ${civRow('<b>Publish or release</b><small>Media, games, music and events</small>', '<span class="tag b">civ release</span>')}
        ${civRow('<b>Own infrastructure</b><small>Property, data centers and offices</small>', '<span class="tag b">civ property</span>')}
      `, 'the world does not require you to succeed')}
    </div>`;
}

function civWorld(civ) {
  const rows = civ.countries.slice().sort((a, b) => b.population - a.population).map(c => civRow(
    `<b>${esc(c.name)}</b> <small>${esc(c.government)} · ${esc(c.currency)} · ${esc(c.region)}</small>`,
    `<span class="tag ${c.stability < 45 ? 'r' : c.stability < 60 ? 'a' : 'g'}">stability ${Math.round(c.stability)}</span>
     <span class="tag b">growth ${c.economy.growth.toFixed(1)}%</span>
     <span class="tag">net ${Math.round(c.internet.penetration)}%</span>`
  )).join('');
  const cities = civ.cities.slice(0, 10).map(c => civRow(
    `<b>${esc(c.name)}</b><small>${esc(c.countryId)} · ${fmtNum(c.population)} residents</small>`,
    `<span class="tag b">power ${c.utilities.power}</span><span class="tag">water ${c.utilities.water}</span><span class="tag">telecom ${c.utilities.telecom}</span>`
  )).join('');
  return `
    ${civSection('COUNTRIES AND REGIONS', rows, `${civ.countries.length} sovereign simulations`)}
    ${civSection('CITIES AND INFRASTRUCTURE', cities, 'prices, utilities and congestion are interconnected')}`;
}

function civSocietyView(g, civ) {
  const society = civ.society;
  const households = society.households;
  const avg = key => households.length ? households.reduce((sum, h) => sum + (h[key] || 0), 0) / households.length : 0;
  const owned = households.filter(h => h.tenure === 'own').length;
  const arrears = households.filter(h => h.savings < 0).length;
  const local = households.filter(h => h.cityId === playerCity(g)?.id).slice(0, 8);
  const localRows = local.map(h => {
    const members = h.memberIds.map(id => civ.identities.find(i => i.id === id)).filter(Boolean);
    return civRow(
      `<b>${esc(members.map(m => '@' + m.handle).join(' ') || h.id)}</b><small>${esc(h.tenure)} · income ${fmtMoney(h.income)}/mo · housing ${fmtMoney(h.housingCost)}</small>`,
      `<span class="tag ${h.morale < 40 ? 'r' : h.morale < 55 ? 'a' : 'g'}">morale ${Math.round(h.morale)}</span><span class="tag">savings ${fmtMoney(h.savings)}</span>`
    );
  }).join('');
  const decisions = society.decisions.slice(-12).reverse().map(d => {
    const identity = civ.identities.find(i => i.id === d.agentId);
    return civRow(`<b>@${esc(identity?.handle || d.agentId)}</b> <small>${esc(d.detail)}</small>`, `<span class="tag b">${esc(d.action)}</span>`);
  }).join('');
  return `
    <div class="civ-grid cols-4">
      ${civStat('Households', fmtNum(households.length), `${society.moves || 0} relocations`)}
      ${civStat('Average morale', `${Math.round(avg('morale'))}/100`, 'household wellbeing')}
      ${civStat('Home ownership', `${Math.round(owned / Math.max(1, households.length) * 100)}%`, 'renters and owners')}
      ${civStat('In arrears', String(arrears), 'negative household savings')}
    </div>
    ${civSection('HOUSEHOLDS IN YOUR CITY', localRows || '<div class="civ-empty">No households recorded in this city.</div>', `${local.length} shown`)}
    ${civSection('RECENT INDIVIDUAL DECISIONS', decisions || '<div class="civ-empty">No decisions recorded yet.</div>', 'bounded, contextual, not continuous AI inference')}`;
}

function civResearchView(g, civ) {
  const knowledge = civ.education.player.knowledge || {};
  const fields = civ.research.fields.map(f => {
    const max = 3;
    const pct = clamp((f.progress || 0), 0, 100);
    return `<div class="civ-field">
      <div class="civ-field-head"><b>${esc(f.name)}</b><span class="tag b">level ${f.level}</span><span class="tag">funding ${fmtMoney(f.funding)}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <small>${f.discoveries.length} discoveries · next project progress ${Math.round(pct)}%</small>
    </div>`;
  }).join('');
  const learner = educationFields().map(f => civMeter(f.name, knowledge[f.id] || 0)).join('');
  const projects = civ.research.projects.filter(p => p.status === 'active').slice(0, 8).map(p => civRow(
    `<b>${esc(p.title || p.fieldName || p.field)}</b><small>${esc(p.institutionName || 'independent')} · funding ${fmtMoney(p.funding || 0)}</small>`,
    `<span class="tag b">${Math.round(p.progress || 0)}%</span>`
  )).join('');
  const discoveries = civ.research.discoveries.slice(-10).reverse().map(d => civRow(
    `<b>${esc(d.name)}</b><small>${esc(d.summary || d.fieldName || '')}</small>`,
    `<span class="tag g">${esc(d.fieldName || d.field || 'research')}</span>`
  )).join('');
  return `
    ${civSection('RESEARCH ECOSYSTEM', fields, 'time, funding, equipment and expertise')}
    ${civSection('ACTIVE PROJECTS', projects || '<div class="civ-empty">No active projects. Start one with civ research start.</div>')}
    ${civSection('RECENT DISCOVERIES', discoveries || '<div class="civ-empty">No discoveries yet.</div>')}
    ${civSection('YOUR KNOWLEDGE', learner, 'study through courses, documentation and practice')}`;
}

function civTechView(civ) {
  const techs = civ.tech.technologies.slice().sort((a, b) => b.adoption - a.adoption).slice(0, 24).map(t => civRow(
    `<b>${esc(t.name)} ${esc(t.version || '')}</b><small>${esc(t.vendorName)} · ${esc(t.category)} · ${esc(t.license)}</small>`,
    `<span class="tag ${t.standard ? 'g' : 'b'}">adoption ${Math.round(t.adoption)}</span><span class="tag">security ${Math.round(t.security)}</span><span class="tag">docs ${Math.round(t.documentation)}</span>`
  )).join('');
  return civSection('TECHNOLOGY MARKET', techs || '<div class="civ-empty">No technology releases yet.</div>', `${civ.tech.technologies.length} products · versions, licenses and adoption`);
}

function civMediaView(civ) {
  const outlets = civ.media.outlets.slice().sort((a, b) => b.audience - a.audience).slice(0, 20).map(o => civRow(
    `<b>${esc(o.name)}</b><small>${esc(o.type)} · ${esc(o.focus || 'general')} · ${esc(o.countryId)}</small>`,
    `<span class="tag ${o.trust < 45 ? 'r' : o.trust < 60 ? 'a' : 'g'}">trust ${Math.round(o.trust)}</span><span class="tag b">${fmtNum(o.audience)}</span>`
  )).join('');
  const content = civ.media.content.slice(-10).reverse().map(item => civRow(
    `<b>${esc(item.headline)}</b><small>${esc(item.outletName)} · ${esc(item.topic)} · ${fmtNum(item.reach)} reach</small>`,
    `${item.misinformation ? '<span class="tag r">unverified</span>' : item.corrected ? '<span class="tag a">corrected</span>' : '<span class="tag g">reported</span>'}<span class="tag">${fmtNum(item.shares || 0)} shares</span>`
  )).join('');
  const trends = civ.media.trends.slice(0, 10).map(t => civRow(`<b>${esc(t.topic)}</b><small>volume ${Math.round(t.volume)} · sentiment ${t.sentiment}</small>`, '')).join('');
  return `
    ${civSection('MEDIA ORGANIZATIONS', outlets || '<div class="civ-empty">No outlets yet.</div>')}
    ${civSection('INFORMATION SPREAD', content || '<div class="civ-empty">No reporting yet.</div>', 'audience, trust, relevance and sharing')}
    ${civSection('PUBLIC AGENDA', trends || '<div class="civ-empty">No trends yet.</div>')}`;
}

function civCultureView(civ) {
  const studios = civ.culture.organizations.slice(0, 12).map(o => civRow(
    `<b>${esc(o.name)}</b><small>${esc(o.kind)} · ${esc(o.cityName || o.countryId)} · ${esc(o.desc || '')}</small>`,
    `<span class="tag b">${fmtNum(o.audience || 0)} audience</span><span class="tag">rep ${Math.round(o.reputation || 0)}</span>`
  )).join('');
  const games = civ.culture.games.slice(-10).reverse().map(game => civRow(
    `<b>${esc(game.title)}</b><small>${esc(game.genre)} · quality ${Math.round(game.quality)}</small>`,
    `<span class="tag b">${fmtNum(game.players || 0)} players</span><span class="tag">${fmtMoney(game.revenue || 0)}</span>`
  )).join('');
  const music = civ.culture.music.slice(-8).reverse().map(track => civRow(
    `<b>${esc(track.title)}</b><small>${esc(track.artist)} · ${esc(track.countryId)}</small>`,
    `<span class="tag b">${fmtNum(track.streams || 0)} streams</span>`
  )).join('');
  const events = civ.culture.events.slice(-8).reverse().map(event => civRow(
    `<b>${esc(event.name)}</b><small>${esc(event.type)} · ${esc(event.status)} · ${esc(civ.cities.find(c => c.id === event.cityId)?.name || event.cityId)}</small>`,
    `<span class="tag ${event.status === 'live' ? 'g' : 'b'}">${fmtNum(event.attendance || 0)} attended</span>`
  )).join('');
  return `
    <div class="civ-actions"><button class="tbtn small" data-civ-action="release:game">Release a game</button><button class="tbtn small" data-civ-action="release:music">Release music</button><button class="tbtn small" data-civ-action="release:event">Schedule an event</button></div>
    ${civSection('STUDIOS AND COMMUNITIES', studios || '<div class="civ-empty">No cultural organizations yet.</div>')}
    ${civSection('GAMES', games || '<div class="civ-empty">No games released.</div>')}
    ${civSection('MUSIC', music || '<div class="civ-empty">No music released.</div>')}
    ${civSection('EVENTS', events || '<div class="civ-empty">No events scheduled.</div>')}`;
}

function civLawView(g, civ) {
  const disputes = activeLegalDisputes(g).filter(d => d.subject === 'player' || d.subject === 'player-company');
  const caseRows = disputes.map(d => civRow(
    `<b>${esc(d.id)} · ${esc(d.domainName)}</b><small>${esc(d.issue)} · evidence ${d.evidence}/100 · claimed ${fmtMoney(d.claimedFine)}</small>`,
    `<span class="tag ${d.contested ? 'g' : 'a'}">${esc(d.status)}${d.contested ? ' · represented' : ''}</span>
     <button class="tbtn small" data-civ-action="legal:settle:${esc(d.id)}">Settle</button>
     <button class="tbtn small" data-civ-action="legal:contest:${esc(d.id)}">Contest</button>`
  )).join('');
  const docket = activeLegalDisputes(g).filter(d => d.subject !== 'player' && d.subject !== 'player-company').slice(0, 10).map(d => civRow(
    `<b>${esc(d.subjectName || d.subject)}</b><small>${esc(d.domainName)} · ${esc(d.issue)}</small>`,
    `<span class="tag a">${esc(d.status)}</span>`
  )).join('');
  const country = playerCountry(g);
  return `
    <div class="civ-grid cols-4">
      ${civStat('Jurisdiction', country?.name || 'unknown', country?.cyberPolicy || '')}
      ${civStat('Compliance', `${Math.round(civ.player.compliance || 0)}/100`)}
      ${civStat('Courts', String(civ.courts.length), 'simulated dockets')}
      ${civStat('Regulators', String(civ.regulators.length), 'sector authorities')}
    </div>
    ${civSection('CASES AGAINST YOU', caseRows || '<div class="civ-empty">No open cases. Compliance is quiet.</div>')}
    ${civSection('COURT DOCKET', docket || '<div class="civ-empty">No other disputes active.</div>')}
    ${g.legal.length ? civSection('ENFORCEMENT HISTORY', g.legal.slice(-6).reverse().map(l => civRow(`<b>${esc(l.authority)}</b><small>${esc(l.reason)}</small>`, `<span class="tag r">${fmtMoney(l.fine)}</span>`)).join('')) : ''}`;
}

function civPropertyView(g, civ) {
  const owned = playerProperties(g);
  const ownedRows = owned.map(p => civRow(
    `<b>${esc(p.label)}</b><small>${esc(civ.cities.find(c => c.id === p.cityId)?.name || p.cityId)} · ${esc(p.occupancy)} · ${fmtMoney(p.rent)}/mo rent</small>`,
    `${p.mortgage ? `<span class="tag a">mortgage ${fmtMoney(p.mortgage.payment)}/mo</span>` : ''}${p.insurance ? `<span class="tag g">insured</span>` : ''}
     <button class="tbtn small" data-civ-action="insure:${esc(p.id)}">Insure</button>
     <button class="tbtn small danger" data-civ-action="sell:${esc(p.id)}">Sell</button>`
  )).join('');
  const available = civ.property.listings.filter(p => p.status === 'available').slice(0, 10).map(p => civRow(
    `<b>${esc(p.label)}</b><small>${esc(civ.cities.find(c => c.id === p.cityId)?.name || p.cityId)} · quality ${p.quality} · rent ${fmtMoney(p.rent)}/mo</small>`,
    `<span class="tag b">${fmtMoney(p.price)}</span>
     <button class="tbtn small" data-civ-action="buy:${esc(p.id)}">Buy</button>
     <button class="tbtn small" data-civ-action="buy-mortgage:${esc(p.id)}">Mortgage</button>`
  )).join('');
  return `
    <div class="civ-grid cols-4">
      ${civStat('Market index', civ.property.market.index.toFixed(1))}
      ${civStat('Rent index', civ.property.market.rentIndex.toFixed(1))}
      ${civStat('Vacancy', `${civ.property.market.vacancy.toFixed(1)}%`)}
      ${civStat('Construction', String(civ.property.construction.length), 'projects in progress')}
    </div>
    ${civSection('YOUR PROPERTY', ownedRows || '<div class="civ-empty">You own no property.</div>')}
    ${civSection('AVAILABLE PROPERTY', available || '<div class="civ-empty">No listings available.</div>')}`;
}

function civHistoryView(g) {
  const rows = civHistory(g, { limit: 30 }).map(t => civRow(
    `<b>${esc(t.title)}</b><small>${esc(t.body)}</small>`,
    `<span class="tag ${t.major ? 'g' : ''}">${t.year} · ${esc(t.category)}</span>`
  )).join('');
  return civSection('WORLD HISTORY', rows || '<div class="civ-empty">History is still being written.</div>', 'the world exists before you and continues after you');
}

function civReleaseFlow(win, kind) {
  const label = kind === 'game' ? 'Game' : kind === 'music' ? 'Music release' : 'Event';
  formModal({
    title: `Release ${label.toLowerCase()}`,
    eyebrow: 'INDEPENDENT WORK',
    body: '<p class="dim">Production costs are paid immediately. Quality depends on your knowledge, professional standing and reputation.</p>',
    fields: [
      { name: 'title', label: 'Title', placeholder: kind === 'event' ? 'Open Bench Meetup' : 'Signal Run' },
      { name: 'price', label: kind === 'event' ? 'Ticket price' : 'Price', value: kind === 'music' ? '0' : '12', type: 'number' }
    ],
    submit: 'Release',
    onSubmit: vals => {
      const title = String(vals.title || '').trim();
      if (!title) { toast('Title required', 'Give the work a name.', 'r'); return false; }
      const price = Number(vals.price) || 0;
      const result = playerRelease(app.game, kind, title, { price });
      if (!result.ok) { toast('Release failed', result.error, 'r'); return false; }
      toast('Released', `${title} · quality ${Math.round(result.quality)}/100`, 'g');
      win.civTab = 'culture';
      refreshUI();
    }
  });
}

function handleCivClick(win, e) {
  const tab = e.target.closest('[data-civ-tab]');
  if (tab) { win.civTab = tab.dataset.civTab; renderCiv(win); return; }
  const actionEl = e.target.closest('[data-civ-action]');
  if (!actionEl) return;
  const [action, ...rest] = actionEl.dataset.civAction.split(':');
  const id = rest.join(':');
  const g = app.game;
  if (action === 'release') { civReleaseFlow(win, id); return; }
  if (action === 'legal') {
    const [verb, caseId] = id.split(':');
    const r = playerLegalAction(g, caseId, verb);
    if (!r.ok) toast('Legal action failed', r.error, 'r');
    else toast(verb === 'settle' ? 'Case settled' : 'Case contested', `${caseId}`, verb === 'settle' ? 'a' : 'g');
    refreshUI();
    return;
  }
  if (action === 'buy' || action === 'buy-mortgage') {
    const r = playerBuyProperty(g, id, { mortgage: action === 'buy-mortgage' });
    if (!r.ok) toast('Purchase failed', r.error, 'r');
    else toast('Property acquired', `${r.property.label} · ${fmtMoney(r.downPayment)} down`, 'g');
    refreshUI();
    return;
  }
  if (action === 'sell') {
    const r = playerSellProperty(g, id);
    if (!r.ok) toast('Sale failed', r.error, 'r');
    else toast('Property sold', `${r.property.label} · ${fmtMoney(r.sale)}`, 'g');
    refreshUI();
    return;
  }
  if (action === 'insure') {
    const r = playerInsureProperty(g, id);
    if (!r.ok) toast('Insurance failed', r.error, 'r');
    else toast(r.already ? 'Already insured' : 'Property insured', `${r.property.label}`, 'g');
    refreshUI();
  }
}

MOUNTS.civ = function mountCiv(win) {
  win.civTab = win.civTab || 'overview';
  win.body.addEventListener('click', e => handleCivClick(win, e));
  win.render = () => renderCiv(win);
  renderCiv(win);
};

/* ============================================================
   AUTONOMOUS DEVELOPERS + INTERNET ARCHITECTURE
   ============================================================ */
const DEV_TABS = [['overview','Overview'],['developers','Developers'],['projects','Projects'],['advisories','Advisories'],['labs','Labs']];
const NET_TABS = [['overview','Overview'],['network','Network'],['protocols','Protocols'],['web','Web'],['developers','Developers'],['ai','AI'],['security','Security'],['history','History']];

MOUNTS.dev = function mountDev(win) {
  win.devTab = win.devTab || 'overview';
  win.body.addEventListener('click', e => handleDevClick(win, e));
  win.render = () => renderDev(win);
  renderDev(win);
};

function renderDev(win) {
  const g = app.game;
  const s = devOverview(g);
  const m = s.metrics;
  if (!DEV_TABS.some(t => t[0] === win.devTab)) win.devTab = 'overview';
  const tab = win.devTab;
  const tabs = DEV_TABS.map(([id, label]) => `<button class="civ-tab ${id === tab ? 'on' : ''}" data-dev-tab="${id}">${label}</button>`).join('');
  let content = '';
  if (tab === 'overview') {
    content = `<div class="civ-grid cols-4">
      ${civStat('Active developers', m.activeDevelopers, `${m.securityProfessionals} security professionals`, 'ok')}
      ${civStat('Published projects', m.publishedProjects, `${m.detailedProjects} detailed`, 'ok')}
      ${civStat('Generated source', fmtNum(m.lines), `${m.files} files`, 'b')}
      ${civStat('Open advisories', m.openVulns, `${m.patchedVulns} patched`, m.openVulns > 8 ? 'r' : '')}
    </div>
    ${civSection('Developer economy', `<div class="civ-row"><div><b>Software is created by inhabitants</b><small>Developers plan, write, test, release and maintain real source files</small></div><div class="civ-row-right"><button class="tbtn small" data-dev-cmd="dev developers">Developers</button><button class="tbtn small" data-dev-cmd="dev projects">Repositories</button></div></div>
      <div class="civ-row"><div><b>Supply chain security</b><small>Advisories originate in code, configuration and dependency decisions</small></div><div class="civ-row-right"><button class="tbtn small" data-dev-cmd="vuln">Advisories</button></div></div>
      <div class="civ-row"><div><b>Authorized practice</b><small>Isolated ranges for legitimate security research</small></div><div class="civ-row-right"><button class="tbtn small" data-dev-cmd="lab">Laboratories</button></div></div>
      <div class="civ-row"><div><b>Publish a tool</b><small>Release your own security utility into the shared registry</small></div><div class="civ-row-right"><button class="tbtn small primary" data-dev-action="publish">Publish</button></div></div>`, 'live state')}
    ${civSection('Development chronicle', s.events.slice(0, 12).map(e => `<div class="civ-row"><div><b>${esc(e.title)}</b><small>${esc(e.body)}</small></div><div class="civ-row-right"><span class="tag">${esc(e.category)}</span><span class="dim">${e.year}</span></div></div>`).join(''))}`;
  } else if (tab === 'developers') {
    content = civSection('Independent developers', s.developers.slice(0, 60).map(d => {
      const langs = Object.keys(d.languages || {}).sort((a, b) => (d.languages[b] || 0) - (d.languages[a] || 0)).slice(0, 5);
      return `<div class="civ-row"><div><b>@${esc(d.handle)} · ${esc(d.name)}</b><small>${esc(d.role)} · ${esc(d.employment)} · ${esc(d.objectives[0] || '')}</small></div><div class="civ-row-right">
        ${langs.map(l => `<span class="tag">${esc(l)} ${Math.round(d.languages[l] || 0)}</span>`).join('')}
        <span class="tag ${d.status === 'active' ? 'g' : 'a'}">${esc(d.status)}</span>
        <button class="tbtn small" data-dev-cmd="repo projects">${d.projects.length} repos</button>
      </div></div>`;
    }).join(''), `${s.developers.length} developers`);
  } else if (tab === 'projects') {
    content = civSection('Repositories and generated source', s.projects.slice(0, 60).map(p => `<div class="civ-row"><div><b>${esc(p.name)}</b><small>${esc(p.kind)} · ${esc(p.ownerHandle)} · ${esc(p.architecture.target || '')}</small></div><div class="civ-row-right">
      <span class="tag">${esc(p.language)}</span><span class="tag">${fmtNum(p.metrics.lines)} lines</span><span class="tag">${fmtNum(p.metrics.downloads)} dl</span>
      <span class="tag ${p.status === 'abandoned' ? 'r' : p.published ? 'g' : 'a'}">${esc(p.status)}</span>
      <button class="tbtn small" data-dev-cmd="repo show ${esc(p.slug)}">Inspect</button>
      <button class="tbtn small" data-dev-cmd="repo source ${esc(p.slug)}">Source</button>
    </div></div>`).join(''), `${s.projects.length} projects`);
  } else if (tab === 'advisories') {
    content = civSection('Security advisories', s.advisories.slice(0, 50).map(a => `<div class="civ-row"><div><b>${esc(a.cve)} · ${esc(a.title)}</b><small>${esc(a.summary)} · reported by ${esc(a.publishedBy)}</small></div><div class="civ-row-right">
      <span class="tag ${a.severity === 'critical' ? 'r' : a.severity === 'high' ? 'a' : ''}">${esc(a.severity)}</span>
      <span class="tag ${a.status === 'patched' ? 'g' : 'r'}">${esc(a.status)}</span>
      <button class="tbtn small" data-dev-cmd="vuln info ${esc(a.cve)}">Detail</button>
    </div></div>`).join('') || '<div class="empty-state">No advisories published yet.</div>', `${s.advisories.length} advisories`);
  } else {
    content = civSection('Authorized laboratories', s.labs.map(l => {
      const authorized = l.authorizedHandles.includes(g.player.handle);
      return `<div class="civ-row"><div><b>${esc(l.name)}</b><small>${esc(l.desc)} · scope ${esc(l.targets.join(', '))}</small></div><div class="civ-row-right">
        <span class="tag ${l.status === 'online' ? 'g' : 'r'}">${esc(l.status)}</span><span class="tag">${l.sessions} sessions</span>
        <button class="tbtn small ${authorized ? 'danger' : 'primary'}" data-dev-lab="${esc(l.id)}" data-dev-lab-action="${authorized ? 'leave' : 'enter'}">${authorized ? 'Leave' : 'Enter'}</button>
      </div></div>`;
    }).join(''), 'isolated fictional environments');
  }
  win.body.innerHTML = `<div class="civ-tabs">${tabs}</div><div class="win-scroll">${content}</div>`;
  win.status.innerHTML = `<span>${m.activeDevelopers} active developers</span><span>${m.publishedProjects} repositories</span><span class="st-right"><b>${m.openVulns} open advisories</b><span>year ${m.year}</span></span>`;
}

function handleDevClick(win, e) {
  const tab = e.target.closest('[data-dev-tab]');
  if (tab) { win.devTab = tab.dataset.devTab; renderDev(win); return; }
  const cmd = e.target.closest('[data-dev-cmd]');
  if (cmd) { openWindow('terminal'); runCommand(cmd.dataset.devCmd); return; }
  const action = e.target.closest('[data-dev-action]');
  if (action && action.dataset.devAction === 'publish') {
    formModal({
      title: 'Publish a security tool', eyebrow: 'DEVELOPER ECONOMY',
      fields: [
        { name: 'name', label: 'TOOL NAME', value: '' },
        { name: 'language', label: 'LANGUAGE', type: 'select', value: 'python', options: ['python','javascript','go','rust','c','bash'].map(v => ({ value: v, label: v })) }
      ],
      submit: 'Publish for $80',
      onSubmit: vals => {
        const r = playerPublishTool(app.game, vals.name, vals.language);
        if (!r.ok) { toast('Publish failed', r.error, 'r'); return false; }
        toast('Tool published', `${r.project.name} · ${Object.keys(r.project.files).length} source files`, 'g');
        refreshUI();
      }
    });
    return;
  }
  const lab = e.target.closest('[data-dev-lab]');
  if (lab) {
    const r = playerLabSession(app.game, lab.dataset.devLab, lab.dataset.devLabAction);
    toast(lab.dataset.devLabAction === 'enter' ? 'Range session' : 'Range closed', r.ok ? r.message : r.error, r.ok ? 'g' : 'r');
    refreshUI();
  }
}

MOUNTS.internet = function mountInternet(win) {
  win.netTab = win.netTab || 'overview';
  win.body.addEventListener('click', e => handleInternetClick(win, e));
  win.render = () => renderInternet(win);
  renderInternet(win);
};

function renderInternet(win) {
  const g = app.game;
  const s = internetSummary(g);
  const m = s.metrics;
  if (!NET_TABS.some(t => t[0] === win.netTab)) win.netTab = 'overview';
  const tab = win.netTab;
  const tabs = NET_TABS.map(([id, label]) => `<button class="civ-tab ${id === tab ? 'on' : ''}" data-net-tab="${id}">${label}</button>`).join('');
  let content = '';
  if (tab === 'overview') {
    content = `<div class="civ-grid cols-4">
      ${civStat('Internet health', `${m.health}/100`, `${m.year} · ${m.trafficTbps} Tbps`, m.health > 70 ? 'ok' : '')}
      ${civStat('Autonomous systems', m.asnCount, `${m.ixpCount} exchanges · ${m.cableCount} cables`, 'b')}
      ${civStat('Web + APIs', m.siteCount, `${m.apiCount} APIs · ${m.certCount} certs`, 'ok')}
      ${civStat('Open incidents', m.openIncidents, `${m.advisoryCount} advisories`, m.openIncidents > 8 ? 'r' : '')}
    </div>
    ${civSection('Protocol adoption', s.protocols.slice(0, 12).map(p => `<div class="civ-row"><div><b>${esc(p.name)}</b><small>${esc(p.layer)} · ${esc(p.spec)} · ${esc(p.status)}</small></div><div class="civ-row-right"><div class="bar" style="width:120px"><i style="width:${Math.round(p.adoption)}%"></i></div><span class="tag">${Math.round(p.adoption)}%</span></div></div>`).join(''))}
    ${civSection('Live events', g.internet.events.slice(-8).reverse().map(e => `<div class="civ-row"><div><b>${esc(e.title)}</b><small>${esc(e.body || '')}</small></div><div class="civ-row-right"><span class="tag ${e.severity === 'critical' ? 'r' : 'a'}">${esc(e.category)}</span></div></div>`).join(''))}`;
  } else if (tab === 'network') {
    content = civSection('Autonomous systems', s.asns.slice(0, 40).map(a => `<div class="civ-row"><div><b>${esc(a.name)}</b><small>AS${a.asn} · ${esc(a.type)} · ${a.peers.length} peers · ${a.upstreams.length} upstreams</small></div><div class="civ-row-right"><span class="tag">${fmtNum(a.trafficGbps)} Gbps</span><span class="tag ${a.status === 'operational' ? 'g' : 'a'}">${esc(a.status)}</span></div></div>`).join('')) +
      civSection('Exchange points', s.ixps.slice(0, 20).map(x => `<div class="civ-row"><div><b>${esc(x.name)}</b><small>${x.members.length} members · route server ${x.routeServer ? 'yes' : 'no'}</small></div><div class="civ-row-right"><span class="tag">${fmtNum(x.trafficGbps)} Gbps</span></div></div>`).join('')) +
      civSection('Long-haul links', s.cables.slice(0, 20).map(c => `<div class="civ-row"><div><b>${esc(c.name)}</b><small>${esc(c.kind)} · ${c.latencyMs} ms · ${esc(c.owner)}</small></div><div class="civ-row-right"><span class="tag">${fmtNum(c.capacityTbps)} Tbps</span><span class="tag ${c.status === 'up' ? 'g' : 'a'}">${esc(c.status)}</span></div></div>`).join(''));
  } else if (tab === 'protocols') {
    content = civSection('Protocol registry', s.protocols.map(p => `<div class="civ-row"><div><b>${esc(p.name)}</b><small>${esc(p.notes)}</small></div><div class="civ-row-right"><span class="tag">sec ${Math.round(p.security)}</span><span class="tag">perf ${Math.round(p.performance)}</span><span class="tag ${p.status === 'standard' ? 'g' : 'a'}">${esc(p.status)}</span></div></div>`).join(''));
  } else if (tab === 'web') {
    const mine = s.web.filter(r => r.ownerType === 'player');
    content = civSection('Your web properties', mine.map(r => `<div class="civ-row"><div><b>${esc(r.domain)}</b><small>${esc(r.title)} · TLS ${r.tls?.version || 'none'} · ${Math.round(r.availability)}% availability</small></div><div class="civ-row-right">
      <button class="tbtn small" data-net-cmd="web secure ${esc(r.domain)}">Harden</button>
      <button class="tbtn small" data-net-cmd="web cert ${esc(r.domain)}">Renew cert</button>
      <button class="tbtn small" data-net-cmd="web scan ${esc(r.domain)}">Scan</button>
    </div></div>`).join('') || '<div class="empty-state">Deploy a site to manage its TLS, APIs and security posture.</div>', `${mine.length} owned`) +
      civSection('Internet index', s.web.slice(0, 40).map(r => `<div class="civ-row"><div><b>${esc(r.domain)}</b><small>${esc(r.stack.join(', '))} · ${esc(r.backend)} · ${esc(r.status)}</small></div><div class="civ-row-right"><span class="tag">${fmtNum(r.requestsPerMin)}/min</span><button class="tbtn small" data-net-cmd="web ${esc(r.domain)}">Inspect</button></div></div>`).join(''));
  } else if (tab === 'developers') {
    const d = devEcosystem(g);
    content = civSection('Languages', d.languages.map(l => `<div class="civ-row"><div><b>${esc(l.name)}</b><small>${esc(l.runtime)} · ${esc(l.status)}</small></div><div class="civ-row-right"><span class="tag">${Math.round(l.adoption)}% adoption</span></div></div>`).join('')) +
      civSection('Popular packages', d.packages.slice(0, 30).map(p => `<div class="civ-row"><div><b>${esc(p.name)}@${esc(p.version)}</b><small>${esc(p.desc)} · ${esc(p.registry)} · ${esc(p.license)}</small></div><div class="civ-row-right"><span class="tag">${fmtNum(p.weeklyDownloads)}/wk</span>${p.vulnerabilityCount ? `<span class="tag r">${p.vulnerabilityCount} vuln</span>` : ''}</div></div>`).join(''));
  } else if (tab === 'ai') {
    const ai = aiEcosystem(g);
    content = civSection('Models', ai.models.slice(0, 30).map(m => `<div class="civ-row"><div><b>${esc(m.name)}</b><small>${esc(m.vendor)} · ${esc(m.params)} · ${esc(m.modality)} · ${fmtNum(m.context)} ctx</small></div><div class="civ-row-right"><span class="tag">q${Math.round(m.quality)}</span><span class="tag">${m.costPerM ? '$' + m.costPerM + '/M' : 'open'}</span></div></div>`).join('')) +
      civSection('Inference endpoints', ai.endpoints.slice(0, 20).map(e => `<div class="civ-row"><div><b>${esc(e.modelId)}</b><small>${esc(e.ownerName)} · ${esc(e.region)} · ${e.latencyMs} ms</small></div><div class="civ-row-right"><span class="tag">${fmtNum(e.requests)} req</span><span class="tag g">${e.uptime.toFixed(2)}%</span></div></div>`).join('')) +
      civSection('Training', ai.training.slice(0, 12).map(t => `<div class="civ-row"><div><b>${esc(t.modelName)}</b><small>${fmtNum(t.computeHours)} compute hours</small></div><div class="civ-row-right"><div class="bar" style="width:110px"><i style="width:${Math.round(t.progress)}%"></i></div><span class="tag">${esc(t.status)}</span></div></div>`).join(''));
  } else if (tab === 'security') {
    const sec = securityOverview(g);
    const z = sec.zeroTrust;
    content = `<div class="civ-grid cols-3">${civMeter('Identity', z.identity)}${civMeter('Devices', z.device)}${civMeter('Network', z.network)}${civMeter('Workloads', z.workload)}${civMeter('Data', z.data)}</div>` +
      civSection('Advisories', sec.advisories.slice(0, 30).map(a => `<div class="civ-row"><div><b>${esc(a.cve)} · ${esc(a.title)}</b><small>${esc(a.product)} · ${esc(a.affected)}</small></div><div class="civ-row-right"><span class="tag ${a.severity === 'critical' ? 'r' : 'a'}">${esc(a.severity)}</span><span class="tag ${a.status === 'patched' ? 'g' : 'r'}">${esc(a.status)}</span></div></div>`).join('')) +
      civSection('Incidents', sec.incidents.slice(0, 24).map(i => `<div class="civ-row"><div><b>${esc(i.id)} · ${esc(i.kind)}</b><small>${esc(i.targetName || '')} · ${esc(i.impact)}</small></div><div class="civ-row-right"><span class="tag ${i.status === 'resolved' ? 'g' : 'r'}">${esc(i.status)}</span>${i.status !== 'resolved' ? `<button class="tbtn small" data-net-cmd="sec respond ${esc(i.id)}">Respond</button>` : ''}</div></div>`).join(''));
  } else {
    content = civSection('Internet history', internetHistory(g, { limit: 60 }).map(h => `<div class="civ-row"><div><b>${esc(h.title)}</b><small>${esc(h.body)}</small></div><div class="civ-row-right"><span class="tag ${h.major ? 'g' : ''}">${h.year}</span><span class="tag">${esc(h.category)}</span></div></div>`).join(''));
  }
  win.body.innerHTML = `<div class="civ-tabs">${tabs}</div><div class="win-scroll">${content}</div>`;
  win.status.innerHTML = `<span>health ${m.health}/100</span><span>${m.asnCount} ASNs · ${m.siteCount} sites · ${m.aiModelCount} models</span><span class="st-right"><b>${m.openIncidents} open incidents</b><span>${m.year}</span></span>`;
}

function handleInternetClick(win, e) {
  const tab = e.target.closest('[data-net-tab]');
  if (tab) { win.netTab = tab.dataset.netTab; renderInternet(win); return; }
  const cmd = e.target.closest('[data-net-cmd]');
  if (cmd) { openWindow('terminal'); runCommand(cmd.dataset.netCmd); }
}

/* ============================================================
   WORKSTATION / DEEP INTERACTION
   ============================================================ */
const WORK_TABS = [['hardware','Hardware'],['operations','Operations'],['people','People'],['finance','Finance'],['servers','Servers']];

MOUNTS.workstation = function mountWork(win) {
  win.workTab = win.workTab || 'hardware';
  win.body.addEventListener('click', e => handleWorkClick(win, e));
  win.render = () => renderWork(win);
  renderWork(win);
};

function renderWork(win) {
  const g = app.game;
  const s = interactionOverview(g);
  const m = s.metrics;
  if (!WORK_TABS.some(t => t[0] === win.workTab)) win.workTab = 'hardware';
  const tab = win.workTab;
  const tabs = WORK_TABS.map(([id, label]) => `<button class="civ-tab ${id === tab ? 'on' : ''}" data-work-tab="${id}">${label}</button>`).join('');
  let content = '';
  if (tab === 'hardware') {
    const h = s.hardware;
    content = `<div class="civ-grid cols-4">
      ${civStat('Performance', h.performance, `${h.cpu.cores} cores · ${h.cpu.ghz} GHz`, 'b')}
      ${civStat('Memory / storage', `${h.memoryGb} GB`, `${Math.round(h.storageUsedGb)}/${h.storageGb} GB used`)}
      ${civStat('VM / inference', `${h.vmCapacity} / ${h.inferenceCapacity}`, `${h.gpu.vramGb} GB VRAM`)}
      ${civStat('Temperature', `${Math.round(h.temperature)}°C`, `health ${Math.round(h.health)}/100`, h.temperature > 80 ? 'r' : 'ok')}
    </div>
    ${civSection('Installed hardware', `<div class="civ-row"><div><b>${esc(h.cpu.model)}</b><small>processor</small></div><div class="civ-row-right"><button class="tbtn small primary" data-work-upgrade="cpu">Upgrade</button></div></div>
      <div class="civ-row"><div><b>${esc(h.gpu.model)}</b><small>${h.gpu.vramGb} GB VRAM · accelerator</small></div><div class="civ-row-right"><button class="tbtn small primary" data-work-upgrade="gpu">Upgrade</button></div></div>
      <div class="civ-row"><div><b>${h.memoryGb} GB memory</b><small>${h.nic} network adapter</small></div><div class="civ-row-right"><button class="tbtn small primary" data-work-upgrade="memory">Upgrade</button></div></div>
      <div class="civ-row"><div><b>${h.storageGb} GB storage</b><small>${h.motherboard} motherboard · ${h.powerW} W</small></div><div class="civ-row-right"><button class="tbtn small primary" data-work-upgrade="storage">Upgrade</button></div></div>
      <div class="civ-row"><div><b>Maintenance</b><small>Failures ${h.failures} · status ${esc(h.status)}</small></div><div class="civ-row-right"><button class="tbtn small" data-work-action="maintain">Service · $45</button></div></div>`, 'physical machine')}`;
  } else if (tab === 'operations') {
    content = civSection('Background operations', s.operations.map(o => `<div class="civ-row"><div><b>${esc(o.label)}</b><small>${esc(o.id)} · ${esc(o.kind)} · ${o.elapsed} world min · ${o.logs.length ? esc(o.logs[o.logs.length - 1].text) : ''}</small></div><div class="civ-row-right"><div class="bar" style="width:110px"><i style="width:${o.progress}%"></i></div><span class="tag">${o.progress}%</span><span class="tag ${o.status === 'done' ? 'g' : o.status === 'failed' ? 'r' : 'a'}">${esc(o.status)}</span>${o.status === 'running' ? `<button class="tbtn small danger" data-work-cancel="${esc(o.id)}">Cancel</button>` : ''}</div></div>`).join('') || '<div class="empty-state">No operations running. Use the terminal: bg install curl</div>', `${m.runningOperations} running · ${m.completedOperations} completed`) +
      civSection('Activity', s.events.slice(0, 20).map(e => `<div class="civ-row"><div><b>${esc(e.title)}</b><small>${esc(e.body)}</small></div><div class="civ-row-right"><span class="tag">${esc(e.category)}</span></div></div>`).join(''));
  } else if (tab === 'people') {
    content = civSection('Relationships', s.relationships.map(r => {
      const last = r.interactions[r.interactions.length - 1];
      return `<div class="civ-row"><div><b>@${esc(r.handle)} · ${esc(r.name)}</b><small>${esc(r.role)} · ${esc(r.personality)} · ${r.interactions.length} interactions${last ? ` · last: ${esc(last.kind)} ${esc(last.response || last.status)}` : ''}</small></div><div class="civ-row-right"><span class="tag ${r.status === 'collaborator' ? 'g' : ''}">${esc(r.status)}</span><span class="tag">trust ${Math.round(r.trust)}</span><button class="tbtn small" data-work-contact="${esc(r.handle)}">Message</button></div></div>`;
    }).join('') || '<div class="empty-state">Use: contact &lt;handle&gt; help</div>', `${s.relationships.length} people · ${m.pendingReplies} pending`) +
      civSection('New conversation', `<div class="civ-row"><div><b>Contact an indexed operator</b><small>Requests are answered by real NPC state, not scripted replies</small></div><div class="civ-row-right"><button class="tbtn small primary" data-work-action="contact">Open</button></div></div>`);
  } else if (tab === 'finance') {
    const f = s.finance;
    content = `<div class="civ-grid cols-3">${civStat('Receivable', fmtMoney(f.receivable), `${f.invoices.length} invoices`, 'ok')}${civStat('Portfolio', fmtMoney(f.portfolioValue), `${f.holdings.length} holdings`, 'b')}${civStat('Open orders', m.openOrders, `index ${fmtNum(app.game.market.index)}`)}</div>` +
      civSection('Invoices', f.invoices.slice(0, 24).map(i => `<div class="civ-row"><div><b>${esc(i.id)} · ${esc(i.client)}</b><small>${fmtMoney(i.amount)} · due ${fmtDateTime(i.dueWorld * 60000 + app.game.createdAt)}</small></div><div class="civ-row-right"><span class="tag ${i.status === 'overdue' ? 'r' : i.status === 'paid' ? 'g' : 'a'}">${esc(i.status)}</span>${i.status === 'sent' || i.status === 'overdue' ? `<button class="tbtn small" data-work-invoice="pay" data-work-id="${esc(i.id)}">Pay</button><button class="tbtn small primary" data-work-invoice="collect" data-work-id="${esc(i.id)}">Collect</button>` : ''}</div></div>`).join('') || '<div class="empty-state">No invoices yet.</div>') +
      civSection('Orders and holdings', f.orders.slice(0, 20).map(o => `<div class="civ-row"><div><b>${esc(o.id)} · ${esc(o.side)} ${o.qty} ${esc(o.asset)}</b><small>limit ${fmtNum(o.limit)} · ${o.status}</small></div><div class="civ-row-right"><span class="tag">${Math.round(o.filled / o.qty * 100)}%</span>${o.status === 'open' ? `<button class="tbtn small danger" data-work-order-cancel="${esc(o.id)}">Cancel</button>` : ''}</div></div>`).join('')) +
      `<div class="civ-row"><div><b>New activity</b><small>Issue an invoice or place a limit order</small></div><div class="civ-row-right"><button class="tbtn small" data-work-action="invoice">Invoice</button><button class="tbtn small primary" data-work-action="order">Order</button></div></div>`;
  } else {
    const mine = ownedServers(g);
    content = civSection('Your servers', mine.map(srv => {
      const web = (srv.services || []).find(v => [80,443].includes(v.port));
      return `<div class="civ-row"><div><b>${esc(srv.host)} · ${esc(srv.ip)}</b><small>${esc(srv.role)} · ${esc(srv.os)} · sec ${Math.round(srv.security)} · web ${web ? esc(web.state) : 'none'}</small></div><div class="civ-row-right">
        <button class="tbtn small" data-work-srv="${esc(srv.id)}" data-work-srv-action="service" data-work-service="${web ? esc(web.name) : ''}" data-work-state="${web?.state === 'running' ? 'stop' : 'start'}">${web?.state === 'running' ? 'Stop web' : 'Start web'}</button>
        <button class="tbtn small" data-work-srv="${esc(srv.id)}" data-work-srv-action="backup">Backup</button>
        <button class="tbtn small" data-work-srv="${esc(srv.id)}" data-work-srv-action="firewall" data-work-port="443">Firewall 443</button>
        <button class="tbtn small" data-work-srv="${esc(srv.id)}" data-work-srv-action="restart">Restart</button>
      </div></div>`;
    }).join('') || '<div class="empty-state">Buy a server with: buy vps-std</div>', `${mine.length} owned hosts`);
  }
  win.body.innerHTML = `<div class="civ-tabs">${tabs}</div><div class="win-scroll">${content}</div>`;
  win.status.innerHTML = `<span>${m.hardwareHealth}% hardware health · ${m.temperature}°C</span><span>${m.runningOperations} running ops · ${m.pendingReplies} pending replies</span><span class="st-right"><b>${fmtMoney(app.game.player.money)}</b><span>${m.openInvoices} invoices</span></span>`;
}

function handleWorkClick(win, e) {
  const tab = e.target.closest('[data-work-tab]');
  if (tab) { win.workTab = tab.dataset.workTab; renderWork(win); return; }
  const up = e.target.closest('[data-work-upgrade]');
  if (up) {
    const component = up.dataset.workUpgrade;
    const tiers = HARDWARE_TIERS[component];
    formModal({
      title: `Upgrade ${component}`, eyebrow: 'WORKSTATION',
      fields: [{ name: 'tier', label: 'OPTION', type: 'select', value: tiers[0].id, options: tiers.map(t => ({ value: t.id, label: `${t.name} · ${fmtMoney(t.cost)}` })) }],
      submit: 'Install',
      onSubmit: vals => {
        const r = upgradeHardware(app.game, component, vals.tier);
        toast(r.ok ? 'Hardware upgraded' : 'Upgrade failed', r.ok ? `${r.tier.name} installed.` : r.error, r.ok ? 'g' : 'r');
        if (r.ok) refreshUI();
      }
    });
    return;
  }
  const action = e.target.closest('[data-work-action]');
  if (action) {
    const kind = action.dataset.workAction;
    if (kind === 'maintain') {
      const r = maintainHardware(app.game);
      toast('Maintenance', r.ok ? r.message : r.error, r.ok ? 'g' : 'r');
      refreshUI();
    } else if (kind === 'contact') {
      formModal({
        title: 'Contact an operator', eyebrow: 'RELATIONSHIPS',
        fields: [
          { name: 'handle', label: 'HANDLE', placeholder: 'relay' },
          { name: 'kind', label: 'PURPOSE', type: 'select', value: 'message', options: ['message','help','collaborate','hire','negotiate','review'].map(v => ({ value: v, label: v })) },
          { name: 'message', label: 'MESSAGE', type: 'textarea', rows: 3 }
        ],
        submit: 'Send',
        onSubmit: vals => {
          const r = contactNpc(app.game, vals.handle, vals.kind, vals.message);
          toast(r.ok ? 'Message queued' : 'Cannot send', r.ok ? r.message : r.error, r.ok ? 'g' : 'r');
          if (r.ok) refreshUI();
        }
      });
    } else if (kind === 'invoice') {
      formModal({
        title: 'Issue an invoice', eyebrow: 'FINANCE',
        fields: [{ name: 'client', label: 'CLIENT' }, { name: 'amount', label: 'AMOUNT', type: 'number', value: '150' }, { name: 'days', label: 'DUE IN DAYS', type: 'number', value: '14' }],
        submit: 'Send invoice',
        onSubmit: vals => {
          const r = issueInvoice(app.game, vals.client, Number(vals.amount), Number(vals.days));
          toast(r.ok ? 'Invoice sent' : 'Cannot invoice', r.ok ? `${r.invoice.id} · ${fmtMoney(r.invoice.amount)}` : r.error, r.ok ? 'g' : 'r');
          if (r.ok) refreshUI();
        }
      });
    } else if (kind === 'order') {
      formModal({
        title: 'Place a market order', eyebrow: 'FINANCE',
        fields: [
          { name: 'side', label: 'SIDE', type: 'select', value: 'buy', options: [{ value: 'buy', label: 'buy' }, { value: 'sell', label: 'sell' }] },
          { name: 'asset', label: 'ASSET', value: 'IDX' },
          { name: 'qty', label: 'QUANTITY', type: 'number', value: '10' },
          { name: 'price', label: 'LIMIT', type: 'number', value: String(Math.round(app.game.market.index)) }
        ],
        submit: 'Place order',
        onSubmit: vals => {
          const r = placeOrder(app.game, vals.side, vals.asset, Number(vals.qty), Number(vals.price));
          toast(r.ok ? 'Order placed' : 'Cannot place order', r.ok ? `${r.order.id} · ${r.order.side} ${r.order.qty}` : r.error, r.ok ? 'g' : 'r');
          if (r.ok) refreshUI();
        }
      });
    }
    return;
  }
  const cancelOp = e.target.closest('[data-work-cancel]');
  if (cancelOp) { const r = cancelOperation(app.game, cancelOp.dataset.workCancel); toast('Operation', r.ok ? r.message || 'Cancelled' : r.error, r.ok ? 'a' : 'r'); refreshUI(); return; }
  const inv = e.target.closest('[data-work-invoice]');
  if (inv) {
    const r = inv.dataset.workInvoice === 'pay' ? payInvoice(app.game, inv.dataset.workId) : collectInvoice(app.game, inv.dataset.workId);
    toast('Invoice', r.ok ? `${r.invoice.id} settled` : r.error, r.ok ? 'g' : 'r'); refreshUI(); return;
  }
  const oc = e.target.closest('[data-work-order-cancel]');
  if (oc) { const r = cancelOrder(app.game, oc.dataset.workOrderCancel); toast('Order', r.ok ? `${r.order.id} cancelled` : r.error, r.ok ? 'a' : 'r'); refreshUI(); return; }
  const contact = e.target.closest('[data-work-contact]');
  if (contact) {
    formModal({
      title: `Message @${contact.dataset.workContact}`, eyebrow: 'RELATIONSHIPS',
      fields: [{ name: 'kind', label: 'PURPOSE', type: 'select', value: 'message', options: ['message','help','collaborate','hire','negotiate','review'].map(v => ({ value: v, label: v })) }, { name: 'message', label: 'MESSAGE', type: 'textarea', rows: 3 }],
      submit: 'Send',
      onSubmit: vals => {
        const r = contactNpc(app.game, contact.dataset.workContact, vals.kind, vals.message);
        toast(r.ok ? 'Message queued' : 'Cannot send', r.ok ? r.message : r.error, r.ok ? 'g' : 'r');
        if (r.ok) refreshUI();
      }
    });
    return;
  }
  const srv = e.target.closest('[data-work-srv]');
  if (srv) {
    const opts = { subaction: srv.dataset.workSrvAction };
    if (opts.subaction === 'service') { opts.service = srv.dataset.workService; opts.state = srv.dataset.workState; }
    if (opts.subaction === 'firewall') { opts.subaction = 'allow'; opts.port = srv.dataset.workPort; }
    const r = serverAdmin(app.game, srv.dataset.workSrv, opts.subaction, opts);
    toast('Server', r.ok ? r.message : r.error, r.ok ? 'g' : 'r'); refreshUI();
  }
}

/* ============================================================
   AUTONOMOUS SOCIETY
   ============================================================ */
const SOCIETY_TABS = [['overview','Overview'],['people','People'],['culture','Culture'],['economy','Economy'],['life','Life feed']];

MOUNTS.society = function mountSociety(win) {
  win.socTab = win.socTab || 'overview';
  win.body.addEventListener('click', e => handleSocietyClick(win, e));
  win.render = () => renderSociety(win);
  renderSociety(win);
};

function renderSociety(win) {
  const s = societyOverview(app.game);
  const m = s.metrics;
  if (!SOCIETY_TABS.some(t => t[0] === win.socTab)) win.socTab = 'overview';
  const tab = win.socTab;
  const tabs = SOCIETY_TABS.map(([id, label]) => `<button class="civ-tab ${id === tab ? 'on' : ''}" data-soc-tab="${id}">${label}</button>`).join('');
  let content = '';
  if (tab === 'overview') {
    content = `<div class="civ-grid cols-4">
      ${civStat('Population', m.population, `${m.active} detailed lives`, 'b')}
      ${civStat('Culture', m.content, `${m.tests} real tests · ${m.reviews} reviews`, 'ok')}
      ${civStat('Economy', fmtMoney(m.revenue), `${m.transactions} transactions`, 'ok')}
      ${civStat('Mood', `+${m.averageHappiness}`, `stress ${m.averageStress}`, m.averageStress > 40 ? 'r' : '')}
    </div>
    ${civSection('How this world works', `<div class="civ-row"><div><b>Lives continue without you</b><small>Identity, emotions, needs, routines and careers persist in the shared world</small></div></div>
      <div class="civ-row"><div><b>Content is real</b><small>Artifacts have creators, stored text or generated source, versions and availability</small></div></div>
      <div class="civ-row"><div><b>Nothing is counted twice</b><small>Downloads, sales and reviews require recorded consumption, transaction and test events</small></div></div>`)}
    ${civSection('Recent lives', s.events.slice(0, 12).map(e => `<div class="civ-row"><div><b>${esc(e.title)}</b><small>${esc(e.body)}</small></div><div class="civ-row-right"><span class="tag">${esc(e.category)}</span></div></div>`).join(''))}`;
  } else if (tab === 'people') {
    content = civSection('Inhabitants', s.citizens.slice(0, 80).map(i => {
      const top = Object.entries(i.needs).sort((a, b) => b[1] - a[1])[0];
      return `<div class="civ-row"><div><b>@${esc(i.handle)} · ${esc(i.name)}</b><small>${i.age} · ${esc(i.employment.role)} at ${esc(i.employment.employer)} · ${esc(i.mood)}</small></div><div class="civ-row-right">
        <span class="tag ${i.level === 'active' ? 'g' : i.level === 'known' ? 'b' : ''}">${esc(i.level)}</span><span class="tag">${fmtMoney(i.funds)}</span><span class="tag">need ${esc(top?.[0] || '—')}</span>
        <button class="tbtn small" data-soc-profile="${esc(i.handle)}">Profile</button>
      </div></div>`;
    }).join(''), `${m.population} identities`);
  } else if (tab === 'culture') {
    content = civSection('Created content', s.content.slice(0, 80).map(c => `<div class="civ-row"><div><b>${esc(c.title)}</b><small>${esc(c.type)} · @${esc(c.creatorHandle)} · ${esc(c.reason)} · ${esc(c.tags.join(', '))}</small></div><div class="civ-row-right">
      <span class="tag">${fmtMoney(c.price)}</span><span class="tag">${c.usage.views} views</span><span class="tag">${c.usage.tests} tests</span>
      <button class="tbtn small" data-soc-content="${esc(c.id)}">Open</button>
      ${c.creatorId !== 'player-identity' ? `<button class="tbtn small primary" data-soc-buy="${esc(c.id)}">Acquire</button>` : ''}
    </div></div>`).join('') || '<div class="empty-state">Nothing published yet.</div>', `${s.content.length} artifacts`);
  } else if (tab === 'economy') {
    content = civSection('Transaction ledger', s.transactions.slice(0, 60).map(t => `<div class="civ-row"><div><b>${esc(t.id)} · ${esc(t.buyerHandle)} → ${esc(t.sellerHandle)}</b><small>${esc(t.kind)} · world ${Math.round(t.world)}</small></div><div class="civ-row-right"><span class="tag ${t.amount > 0 ? 'g' : ''}">${fmtMoney(t.amount)}</span></div></div>`).join('') || '<div class="empty-state">No transactions yet.</div>', `${m.transactions} recorded`) +
      civSection('Reviews derived from tests', s.reviews.slice(0, 40).map(r => `<div class="civ-row"><div><b>${r.rating}/5 · ${esc(r.text)}</b><small>@${esc(r.handle)} · test ${esc(r.testId)}</small></div></div>`).join(''));
  } else {
    content = civSection('Life events', s.events.slice(0, 80).map(e => `<div class="civ-row"><div><b>${esc(e.title)}</b><small>${esc(e.body)}</small></div><div class="civ-row-right"><span class="tag ${e.severity === 'critical' ? 'r' : ''}">${esc(e.category)}</span><span class="tag">${e.year || Math.round(e.world / 1440)}</span></div></div>`).join(''));
  }
  win.body.innerHTML = `<div class="civ-tabs">${tabs}</div><div class="win-scroll">${content}</div>`;
  win.status.innerHTML = `<span>${m.population} inhabitants · ${m.active} active</span><span>${m.content} content items · ${m.transactions} transactions</span><span class="st-right"><b>${fmtMoney(m.revenue)} economy</b><span>happiness ${m.averageHappiness}</span></span>`;
}

function handleSocietyClick(win, e) {
  const tab = e.target.closest('[data-soc-tab]');
  if (tab) { win.socTab = tab.dataset.socTab; renderSociety(win); return; }
  const profile = e.target.closest('[data-soc-profile]');
  if (profile) { openWindow('terminal'); runCommand(`citizen ${profile.dataset.socProfile}`); return; }
  const show = e.target.closest('[data-soc-content]');
  if (show) { openWindow('terminal'); runCommand(`content show ${show.dataset.socContent}`); return; }
  const buy = e.target.closest('[data-soc-buy]');
  if (buy) {
    const r = playerPurchaseContent(app.game, buy.dataset.socBuy);
    toast(r.ok ? 'Content acquired' : 'Purchase failed', r.ok ? `${r.content.title} · transaction ${r.transaction.id}` : r.error, r.ok ? 'g' : 'r');
    refreshUI();
  }
}

/* ============================================================
   IT UNIVERSE
   ============================================================ */
const IT_TABS = [['rig','Rig'],['os','OS'],['electronics','Electronics'],['networks','Networks'],['studios','Studios'],['ai','AI'],['support','Support'],['skills','Skills']];

MOUNTS.itlab = function mountIT(win) {
  win.itTab = win.itTab || 'rig';
  win.body.addEventListener('click', e => handleITClick(win, e));
  win.render = () => renderIT(win);
  renderIT(win);
};

function renderIT(win) {
  const g = app.game;
  const s = itOverview(g);
  const m = s.metrics;
  if (!IT_TABS.some(t => t[0] === win.itTab)) win.itTab = 'rig';
  const tab = win.itTab;
  const tabs = IT_TABS.map(([id, label]) => `<button class="civ-tab ${id === tab ? 'on' : ''}" data-it-tab="${id}">${label}</button>`).join('');
  let content = '';
  if (tab === 'rig') {
    const rig = s.st.rigs.find(r => r.id === s.st.activeRigId) || s.st.rigs[0];
    content = `<div class="civ-grid cols-4">${civStat('Rigs', m.rigs, `${m.circuits} devices`, 'b')}${civStat('Performance', rig?.performance || 0, `${Math.round(rig?.powerW || 0)} W`, 'ok')}${civStat('Temperature', `${Math.round(rig?.temperature || 0)}°C`, `health ${Math.round(rig?.health || 0)}%`, (rig?.temperature || 0) > 80 ? 'r' : '')}${civStat('Hardware skill', `L${m.skills.hardware}`, 'component work')}</div>` +
      civSection('Computer rack', s.st.rigs.map(r => `<div class="civ-row"><div><b>${esc(r.name)} · ${esc(r.preset)}</b><small>${Object.keys(r.parts).length} components · boot ${r.bootCount} · ${r.status}</small></div><div class="civ-row-right"><span class="tag">${r.performance} pts</span><button class="tbtn small ${r.id === s.st.activeRigId ? 'primary' : ''}" data-it-action="select-rig" data-id="${esc(r.id)}">${r.id === s.st.activeRigId ? 'Active' : 'Select'}</button></div></div>`).join('')) +
      `<div class="civ-row"><div><b>Assemble a preset rig</b><small>Compatibility, power and cooling are checked before it boots</small></div><div class="civ-row-right">${['gaming','workstation','server','ai','compact','retro'].map(p => `<button class="tbtn small" data-it-build="${p}">${p}</button>`).join('')}</div></div>` +
      (rig ? `<div class="civ-row"><div><b>Stress test ${esc(rig.name)}</b><small>Thermal and stability validation</small></div><div class="civ-row-right"><button class="tbtn small primary" data-it-action="stress" data-id="${esc(rig.id)}">Run test</button></div></div>` : '');
  } else if (tab === 'os') {
    const rig = s.st.rigs.find(r => r.id === s.st.activeRigId) || s.st.rigs[0];
    const installs = s.st.installs.filter(i => i.rigId === rig?.id && !i.removed);
    content = civSection('Installed systems', installs.map(i => `<div class="civ-row"><div><b>${esc(i.distroName)}</b><small>${esc(i.kernel)} · ${esc(i.bootloader)} · ${esc(i.desktop)} desktop</small></div><div class="civ-row-right"><button class="tbtn small" data-it-action="boot" data-id="${esc(i.id)}">Boot</button></div></div>`).join('') || '<div class="empty-state">No OS installed.</div>') +
      `<div class="civ-row"><div><b>Install a distribution</b><small>Requires free disk space and compatible CPU/RAM</small></div><div class="civ-row-right">${['distro-nullDesktop','distro-nullServer','distro-freebsd','distro-winlike','distro-embedded','distro-security','distro-retro'].map(d => `<button class="tbtn small" data-it-os="${d}">${d.replace('distro-','')}</button>`).join('')}</div></div>`;
  } else if (tab === 'electronics') {
    content = civSection('Devices', s.st.circuits.map(c => `<div class="civ-row"><div><b>${esc(c.name)}</b><small>${esc(c.boardName)} · ${c.pinsUsed} pins · ${c.powerW}W · ${c.status}</small></div><div class="civ-row-right"><button class="tbtn small" data-it-action="circuit-test" data-id="${esc(c.id)}">Test</button></div></div>`).join('') || '<div class="empty-state">Build a device in the terminal: circuit build sensor-node board-uno sensor-temp</div>') +
      `<div class="civ-row"><div><b>Open electronics workbench</b><small>Boards, sensors, firmware and pin constraints</small></div><div class="civ-row-right"><button class="tbtn small primary" data-it-cmd="circuit list">Workbench</button></div></div>`;
  } else if (tab === 'networks') {
    content = civSection('Network designs', s.st.networks.map(n => `<div class="civ-row"><div><b>${esc(n.name)}</b><small>${n.nodes.length} nodes · ${n.links.length} links · ${n.tests.length} tests</small></div><div class="civ-row-right"><button class="tbtn small" data-it-cmd="netlab show ${esc(n.id)}">Inspect</button></div></div>`).join('') || '<div class="empty-state">Create a topology with: netlab create labnet</div>') +
      `<div class="civ-row"><div><b>Create a network sandbox</b><small>Routers, switches, VLANs, DHCP, DNS and firewall rules</small></div><div class="civ-row-right"><button class="tbtn small primary" data-it-action="new-network">Create</button></div></div>`;
  } else if (tab === 'studios') {
    content = civSection('Game studios', s.studios.map(t => `<div class="civ-row"><div><b>${esc(t.name)}</b><small>${t.staff.length} staff · ${t.projects.length} projects · rep ${t.reputation}</small></div><div class="civ-row-right"><button class="tbtn small" data-it-cmd="studio list">Open</button></div></div>`).join('') || '<div class="empty-state">No studio registered.</div>') +
      `<div class="civ-row"><div><b>Register a studio</b><small>Hire developers, build games, publish to the shared economy</small></div><div class="civ-row-right"><button class="tbtn small primary" data-it-action="new-studio">Register</button></div></div>` +
      civSection('Games', s.games.map(g => `<div class="civ-row"><div><b>${esc(g.title)}</b><small>${esc(g.engine)} · ${esc(g.genre)} · ${Math.round(g.progress)}% · ${g.status}</small></div><div class="civ-row-right"><span class="tag">${g.sales} sales</span></div></div>`).join(''));
  } else if (tab === 'ai') {
    content = civSection('Models', s.ai.map(a => `<div class="civ-row"><div><b>${esc(a.name)}</b><small>${esc(a.base)} · ${esc(a.gpu)} · ${esc(a.status)} · ${a.benchmarks.length} benchmarks</small></div><div class="civ-row-right"><span class="tag">q${a.quality}</span><button class="tbtn small" data-it-action="bench" data-id="${esc(a.id)}">Benchmark</button></div></div>`).join('') || '<div class="empty-state">Train a model with: ailab train helper lumen-8b</div>') +
      civSection('Agents', s.st.agents.map(a => `<div class="civ-row"><div><b>${esc(a.name)}</b><small>tools ${esc(a.tools.join(', '))} · budget ${fmtMoney(a.budget)}</small></div><div class="civ-row-right"><span class="tag ${a.status === 'active' ? 'g' : ''}">${esc(a.status)}</span></div></div>`).join(''));
  } else if (tab === 'support') {
    content = civSection('Support tickets', s.tickets.slice(0, 40).map(t => `<div class="civ-row"><div><b>${esc(t.title)}</b><small>${esc(t.symptom)}</small></div><div class="civ-row-right"><span class="tag ${t.status === 'open' ? 'a' : 'g'}">${esc(t.status)}</span>${t.status === 'open' ? `<button class="tbtn small" data-it-action="diagnose" data-id="${esc(t.id)}">Diagnose</button>` : ''}</div></div>`).join('') || '<div class="empty-state">No active incidents. The world is boringly healthy.</div>') +
      civSection('Challenges', s.challenges.map(c => `<div class="civ-row"><div><b>${esc(c.title)}</b><small>${esc(c.kind)} · ${fmtMoney(c.reward.money)} · ${c.reward.xp} XP</small></div><div class="civ-row-right"><button class="tbtn small primary" data-it-action="challenge" data-id="${esc(c.id)}">Attempt</button></div></div>`).join(''));
  } else {
    const sk = skillOverview(g);
    content = civSection('Skill trees', sk.skills.map(k => `<div class="civ-row"><div><b>${esc(k.key)}</b><small>${fmtNum(k.xp)} XP from real activities</small></div><div class="civ-row-right"><span class="tag">L${k.level}</span></div></div>`).join('')) +
      civSection('Certifications', sk.available.map(c => `<div class="civ-row"><div><b>${esc(c.name)}</b><small>requires ${esc(c.skill)} L${c.required} · ${fmtMoney(c.cost)}</small></div><div class="civ-row-right"><span class="tag ${c.eligible ? 'g' : ''}">${sk.certifications.some(x => x.id === c.id) ? 'HELD' : c.eligible ? 'ELIGIBLE' : 'LOCKED'}</span>${c.eligible && !sk.certifications.some(x => x.id === c.id) ? `<button class="tbtn small primary" data-it-action="cert" data-id="${esc(c.id)}">Take exam</button>` : ''}</div></div>`).join('')) +
      civSection('Collectibles', marketplace(g).slice(0, 20).map(i => `<div class="civ-row"><div><b>${esc(i.name)}</b><small>${esc(i.rarity)} · ${i.condition}% condition</small></div><div class="civ-row-right"><span class="tag">${i.owned ? 'OWNED' : fmtMoney(Math.round(i.base * i.condition / 100 * (1 + i.demand / 200)))}</span></div></div>`).join(''));
  }
  win.body.innerHTML = `<div class="civ-tabs">${tabs}</div><div class="win-scroll">${content}</div>`;
  win.status.innerHTML = `<span>${m.rigs} rigs · ${m.networks} networks · ${m.studios} studios</span><span>${m.openTickets} open tickets · ${m.openChallenges} challenges</span><span class="st-right"><b>${m.certifications} certifications</b><span>hardware L${m.skills.hardware}</span></span>`;
}

function handleITClick(win, e) {
  const tab = e.target.closest('[data-it-tab]');
  if (tab) { win.itTab = tab.dataset.itTab; renderIT(win); return; }
  const cmd = e.target.closest('[data-it-cmd]');
  if (cmd) { openWindow('terminal'); runCommand(cmd.dataset.itCmd); return; }
  const build = e.target.closest('[data-it-build]');
  if (build) {
    const r = assembleRig(app.game, `${build.dataset.itBuild}-rig`, {}, build.dataset.itBuild);
    if (r.ok) { toast('Rig assembled', `${r.rig.name} · ${r.check.ok ? 'compatible' : 'faulty'}`, r.check.ok ? 'g' : 'r'); refreshUI(); }
    else toast('Build failed', r.error, 'r');
    return;
  }
  const os = e.target.closest('[data-it-os]');
  if (os) {
    const st = app.game.it;
    const rig = st.rigs.find(r => r.id === st.activeRigId) || st.rigs[0];
    const r = installOS(app.game, rig?.id, os.dataset.itOs);
    toast(r.ok ? 'OS installed' : 'Install failed', r.ok ? `${r.install.distroName} on ${rig.name}` : r.error, r.ok ? 'g' : 'r');
    refreshUI();
    return;
  }
  const action = e.target.closest('[data-it-action]');
  if (!action) return;
  const kind = action.dataset.itAction, id = action.dataset.id;
  let r = null;
  if (kind === 'select-rig') r = selectRig(app.game, id);
  else if (kind === 'stress') r = stressTest(app.game, id, 60);
  else if (kind === 'boot') r = bootRig(app.game, id);
  else if (kind === 'circuit-test') r = testCircuit(app.game, id);
  else if (kind === 'bench') r = benchmarkAI(app.game, id);
  else if (kind === 'diagnose') r = diagnoseTicket(app.game, id);
  else if (kind === 'challenge') r = attemptChallenge(app.game, id);
  else if (kind === 'cert') r = takeCertification(app.game, id);
  else if (kind === 'new-network') { openWindow('terminal'); runCommand('netlab create labnet'); return; }
  else if (kind === 'new-studio') { openWindow('terminal'); runCommand('studio create indie-studio'); return; }
  if (r) toast(kind, r.ok ? (r.result ? `${r.result.result || r.result.passed}` : 'done') : r.error, r.ok ? 'g' : 'r');
  refreshUI();
}

/* ============================================================
   SETTINGS
   ============================================================ */
function applySettings() {
  const s = app.game?.settings || {};
  const root = document.documentElement;
  root.style.fontSize = `${clamp(Number(s.fontSize) || 10, 7, 18)}px`;
  root.classList.toggle('reduced-motion', !!s.reducedMotion);
  root.classList.toggle('compact-ui', !!s.compact);
}

MOUNTS.settings = function mountSettings(win) {
  win.body.addEventListener('click', e => {
    const b = e.target.closest('[data-setting]');
    if (!b) return;
    const key = b.dataset.setting;
    const s = app.game.settings || (app.game.settings = {});
    if (key === 'save') { saveGame(true); toast('World saved', 'Local state written.', 'g'); return; }
    if (key === 'fontSize') s.fontSize = clamp(Number(b.dataset.value) || 10, 7, 18);
    else s[key] = !s[key];
    applySettings();
    renderSettings(win);
    scheduleSave();
    toast('Setting changed', `${key}: ${s[key]}`, 'b');
  });
  win.render = () => renderSettings(win);
  renderSettings(win);
};

function renderSettings(win) {
  const s = app.game.settings || (app.game.settings = {});
  const toggle = (key, label, note) => `<div class="civ-row"><div><b>${esc(label)}</b><small>${esc(note)}</small></div><div class="civ-row-right"><button class="tbtn small ${s[key] ? 'primary' : ''}" data-setting="${key}">${s[key] ? 'enabled' : 'disabled'}</button></div></div>`;
  win.body.innerHTML = `<div class="win-scroll">
    ${civSection('Display', toggle('reducedMotion', 'Reduced motion', 'Minimise background animation and sparkline updates.') + toggle('compact', 'Compact interface', 'Tighter panels and smaller controls for small screens.'))}
    ${civSection('Text size', `<div class="civ-row"><div><b>Terminal and panel text</b><small>Applies everywhere and persists with the world save.</small></div><div class="civ-row-right">${[8,9,10,11,12,14].map(n => `<button class="tbtn small ${Number(s.fontSize || 10) === n ? 'primary' : ''}" data-setting="fontSize" data-value="${n}">${n}px</button>`).join('')}</div></div>`)}
    ${civSection('Persistence', `<div class="civ-row"><div><b>Local save</b><small>Stored in this browser under internet-persistent-world.v1. Autosave runs every few ticks.</small></div><div class="civ-row-right"><button class="tbtn small primary" data-setting="save">Save now</button></div></div>`)}
  </div>`;
  win.status.innerHTML = `<span>font ${s.fontSize || 10}px</span><span>motion ${s.reducedMotion ? 'reduced' : 'full'}</span><span class="st-right"><b>saved locally</b></span>`;
}

/* ============================================================
   HELP / MANUAL
   ============================================================ */
const CMD_HELP = {
  help: 'Command index and manual shortcuts.',
  clear: 'Clear the terminal scrollback.',
  pwd: 'Print the current working directory.',
  whoami: 'Print the current user.',
  id: 'Show user and group identity.',
  hostname: 'Print the current host name.',
  uname: 'System information.',
  date: 'Current simulated date and time.',
  uptime: 'System uptime and load.',
  echo: 'Print arguments. Supports $VARS.',
  printf: 'Print with escapes. Use \\n for newlines and redirect to write files.',
  env: 'Show environment variables.',
  export: 'Set an environment variable.',
  history: 'Show command history.',
  sleep: 'Pause for a number of seconds.',
  exit: 'Close a remote session or leave the shell.',
  sudo: 'Run a command with elevated privileges.',
  su: 'Become root in the current session.',
  which: 'Locate a command.',
  man: 'Read a command manual page.',
  neofetch: 'System summary with ASCII art.',
  banner: 'Print the network banner.',
  ls: 'List directory contents.',
  cd: 'Change directory.',
  cat: 'Print a file.',
  head: 'Print the first lines of a file.',
  tail: 'Print the last lines of a file.',
  wc: 'Count lines, words, and bytes.',
  grep: 'Search file contents.',
  find: 'Find files by name.',
  tree: 'Print a directory tree.',
  mkdir: 'Create a directory.',
  touch: 'Create an empty file.',
  rm: 'Remove files or directories.',
  cp: 'Copy files or directories.',
  mv: 'Move or rename files.',
  chmod: 'Change file permissions.',
  stat: 'Show file metadata.',
  file: 'Identify a file type.',
  du: 'Show disk usage.',
  df: 'Show filesystem usage.',
  nano: 'Open a file in the graphical editor.',
  vim: 'Open a file in the graphical editor.',
  vi: 'Open a file in the graphical editor.',
  code: 'Open a file in the graphical editor.',
  ps: 'List running processes.',
  top: 'Open the process monitor.',
  kill: 'Terminate a process.',
  free: 'Show memory usage.',
  systemctl: 'Inspect or manage services.',
  service: 'Manage a service.',
  reboot: 'Request a simulated reboot.',
  apt: 'Install or remove packages.',
  dpkg: 'Query installed packages.',
  ip: 'Show network interfaces and routes.',
  ifconfig: 'Show interface configuration.',
  arp: 'Show the ARP table.',
  route: 'Show the routing table.',
  ping: 'Check reachability.',
  traceroute: 'Trace a route to a host.',
  dig: 'Query DNS records.',
  nslookup: 'Query DNS records.',
  whois: 'Look up a domain or address.',
  curl: 'Fetch a URL or inspect headers.',
  wget: 'Download a file.',
  ssh: 'Open a remote shell.',
  scp: 'Copy a file to or from a remote host.',
  nc: 'Probe a TCP port.',
  netstat: 'Show network connections.',
  ss: 'Show listening sockets.',
  nmap: 'Enumerate services on a host.',
  vulnscan: 'Scan a host for known vulnerabilities.',
  audit: 'Audit a host and record findings.',
  exploit: 'Attempt to obtain access to a host.',
  patch: 'Close known vulnerabilities on a host.',
  hydra: 'Attempt credential recovery (simulated).',
  heat: 'Show trace exposure and recent heat events.',
  legal: 'Review enforcement notices.',
  python3: 'Run a Python script or inline code.',
  python: 'Run a Python script or inline code.',
  pip: 'Manage Python packages.',
  bash: 'Run a shell script or interactive subshell.',
  gcc: 'Compile a C program.',
  make: 'Run a Makefile target.',
  node: 'Run JavaScript in the simulated runtime.',
  npm: 'Manage Node packages.',
  git: 'Clone, inspect, or initialize repositories.',
  sqlite3: 'Query a simulated SQLite database.',
  cloud: 'Provision and inspect cloud infrastructure.',
  docker: 'Run and manage containers on your servers.',
  kubectl: 'Operate a Kubernetes-style cluster.',
  agent: 'Deploy and manage autonomous AI agents.',
  company: 'Operate a company and launch products.',
  contracts: 'List the contract board.',
  accept: 'Accept a contract by id.',
  submit: 'Submit a completed contract.',
  bank: 'Show balance, income, and transactions.',
  market: 'Open the market surface.',
  buy: 'Buy a product or register a domain.',
  deploy: 'Deploy a directory to a domain on your server.',
  domains: 'List registered domains.',
  site: 'Inspect or visit a site.',
  servers: 'List indexed servers.',
  mail: 'Open the mail client.',
  read: 'Read a message by id.',
  send: 'Compose mail to a handle.',
  forum: 'Browse community boards.',
  thread: 'Read a forum thread.',
  post: 'Post to a forum thread.',
  news: 'Read the network wire.',
  profile: 'Show the operator profile.',
  status: 'Show the world pulse.',
  map: 'Open the network topology.',
  achievements: 'List achievements.',
  search: 'Search sites, hosts, people, and work.',
  project: 'Analyse a local project and its code health.',
  init: 'Scaffold a new project from a template.',
  lint: 'Statically analyse local source files.',
  fmt: 'Format a source file in place.',
  symbols: 'List functions, classes and selectors.',
  run: 'Run a file with its simulated runtime.',
  build: 'Compile a project file.',
  test: 'Run the matching test command.',
  coding: 'Show coding level, XP and activity.',
  net: 'Inspect internet architecture and adoption.',
  web: 'Inspect DNS, TLS, APIs and web properties.',
  registry: 'Browse and publish software packages.',
  model: 'Inspect and train AI models, serve inference.',
  sec: 'Check security posture and advisories.',
  dev: 'Inspect autonomous NPC developers and projects.',
  repo: 'Read, clone, lint and contribute to generated repositories.',
  vuln: 'Investigate vulnerabilities derived from real generated code.',
  lab: 'Open authorized cyber ranges and practice safely.',
  packets: 'Capture a bounded packet trace from a simulated host.',
  forensics: 'Produce a chain-of-custody forensic report.',
  http: 'Inspect HTTP headers and site state.',
  inspect: 'Fingerprint a host from simulated configuration.',
  debug: 'Inspect symbols and static faults in local code.',
  openssl: 'Inspect a simulated TLS certificate.',
  hw: 'Inspect and upgrade workstation hardware.',
  ops: 'List background operations and their progress.',
  bg: 'Start an install, download, audit, compile or deploy job.',
  contact: 'Contact an NPC; replies depend on trust and personality.',
  friends: 'Review relationships and pending replies.',
  pcreate: 'Create a real source project in the developer economy.',
  pwrite: 'Edit a source file in one of your projects.',
  pbuild: 'Build and version your project.',
  ptest: 'Run simulated smoke tests.',
  ppublish: 'Publish your project for NPCs to discover.',
  pdeploy: 'Deploy your project to a site you control.',
  prelease: 'Release an update to your project.',
  srv: 'Administer a server you own.',
  invoice: 'Create, pay and collect invoices.',
  transfer: 'Transfer funds to another operator.',
  order: 'Place and inspect simulated market orders.',
  ln: 'Create hard or symbolic links.',
  tar: 'Create and extract virtual filesystem archives.',
  session: 'Open an additional terminal session.',
  settings: 'Read or change persistent system settings.',
  society: 'Observe autonomous inhabitants and their activity.',
  citizens: 'List the simulated population.',
  citizen: 'Inspect one inhabitant’s life and decisions.',
  culture: 'Browse content created by inhabitants.',
  content: 'Inspect, buy, test, review or publish content.',
  meet: 'Meet an inhabitant and form a relationship.',
  it: 'Overview of the interactive IT universe.',
  parts: 'Browse PC component catalog.',
  rig: 'Build, configure and boot computers.',
  circuit: 'Build and test electronic devices.',
  netlab: 'Construct and troubleshoot networks.',
  studio: 'Run a game studio and publish games.',
  ailab: 'Train, benchmark and deploy AI models.',
  tickets: 'Diagnose and repair real support incidents.',
  challenge: 'Take optional world challenges.',
  skills: 'View skill trees and certifications.',
  cert: 'Attempt a professional certification.',
  collect: 'Trade collectible technology.',
  save: 'Save the persistent world.',
  reset: 'Erase the world and start over.'
};

const HELP_SECTIONS = [
  ['start', 'Getting started'],
  ['terminal', 'Terminal'],
  ['commands', 'Command index'],
  ['network', 'Network'],
  ['security', 'Security & heat'],
  ['economy', 'Economy'],
  ['cloud', 'Cloud & AI'],
  ['persistence', 'Persistence']
];

MOUNTS.help = function mountHelp(win) {
  win.state = { section: 'start' };
  win.render = () => renderHelp(win);
  renderHelp(win);
};

function renderHelp(win) {
  const st = win.state;
  win.body.innerHTML = `<div class="help-layout">
    <div class="help-nav">${HELP_SECTIONS.map(([id, label]) => `<button class="${st.section === id ? 'on' : ''}" data-help-section="${id}">${esc(label)}</button>`).join('')}</div>
    <div class="help-main">${helpContent(st.section)}</div>
  </div>`;
  for (const b of $$('[data-help-section]', win.body)) b.addEventListener('click', () => { st.section = b.dataset.helpSection; renderHelp(win); });
  for (const c of $$('[data-help-cmd]', win.body)) {
    c.addEventListener('click', () => {
      const cmd = c.dataset.helpCmd;
      if (cmd) runCommand(cmd);
    });
  }
  win.status.innerHTML = `<span>manual</span><span>${esc(HELP_SECTIONS.find(s => s[0] === st.section)?.[1] || '')}</span><span class="st-right"><b>${commandNames().length} commands</b><span>simulation reference</span></span>`;
}

function helpContent(section) {
  if (section === 'terminal') {
    return `<h2>The terminal is the interface</h2>
      <p>The shell supports quoting, semicolons, pipes, environment variables, and output redirection. It runs against a real virtual filesystem and a fictional network.</p>
      <div class="cmd-ref">
        <code>ls -la</code><span>List files with permissions and sizes.</span>
        <code>cat notes/start.txt</code><span>Read the field notes left on your machine.</span>
        <code>cd projects</code><span>Change directory. <b>~</b> is your home.</span>
        <code>nmap -sV portal.nullnet</code><span>Enumerate services on a host.</span>
        <code>ssh portal.nullnet</code><span>Attempt a remote shell.</span>
        <code>echo "hello" &gt; notes/hello.txt</code><span>Write output to a file.</span>
        <code>ps aux | grep python</code><span>Pipe command output.</span>
        <code>python3 projects/hello.py</code><span>Run a local script.</span>
      </div>
      <p style="margin-top:14px">Use <b>Up/Down</b> for history, <b>Tab</b> for completion, <b>Ctrl+L</b> to clear, and <b>Ctrl+C</b> to cancel a pending prompt. Passwords are masked. Remote sessions have their own working directory and filesystem.</p>`;
  }
  if (section === 'commands') {
    const cmds = commandNames();
    return `<h2>Command index</h2><p>Every command below is implemented in the simulation. Click a name to run it in the terminal.</p>
      <div class="cmd-ref">${cmds.map(c => `<code data-help-cmd="${esc(c)}">${esc(c)}</code><span>${esc(CMD_HELP[c] || 'Simulation command.')}</span>`).join('')}</div>`;
  }
  if (section === 'network') {
    return `<h2>A fictional network</h2>
      <p>NullNet is a community network surrounded by companies, abandoned infrastructure, a regulator, and a lot of people who prefer terminals. Every address is fictional and isolated.</p>
      <div class="cmd-ref">
        <code>203.0.113.10</code><span>portal.nullnet — community hub, boards, public shell.</span>
        <code>203.0.113.20</code><span>mail.nullnet — public mail relay.</span>
        <code>203.0.113.30</code><span>market.nullnet — contract board.</span>
        <code>203.0.113.40</code><span>git.nullnet — public repositories.</span>
        <code>192.0.2.13</code><span>legacy.oldco.net — abandoned, reportedly.</span>
        <code>10.0.0.1</code><span>home-gw — your own residential gateway.</span>
      </div>
      <p style="margin-top:14px">Use <b>map</b> for the live topology, <b>whois</b> for ownership, <b>dig</b> for DNS, and <b>nmap</b> for services. Hosts fail, recover, and occasionally change hands while you work.</p>`;
  }
  if (section === 'security') {
    return `<h2>Consequences are modeled</h2>
      <p>Scanning is loud. Exploitation leaves traces. Heat rises with unauthorized action and decays slowly when you are quiet. High heat attracts the CyberNet Authority, which issues fines and reputation loss.</p>
      <div class="cmd-ref">
        <code>nmap -sV host</code><span>Enumerate services. Adds a small amount of heat.</span>
        <code>vulnscan host</code><span>Discover known vulnerabilities.</span>
        <code>audit host</code><span>Document findings. Small heat cost, real reputation value.</span>
        <code>patch host</code><span>Close findings and raise security.</span>
        <code>exploit host</code><span>Attempt access. Failure leaves a trace.</span>
        <code>heat</code><span>Inspect current exposure and recent events.</span>
        <code>legal</code><span>Review enforcement notices and fines.</span>
      </div>
      <p style="margin-top:14px">A proxy or VPN reduces trace exposure but does not make you invisible. The regulator's infrastructure is monitored. Do not treat a persistent session as consent.</p>`;
  }
  if (section === 'economy') {
    return `<h2>Work, infrastructure, and money</h2>
      <p>Contracts pay for delivered artifacts. Reputation compounds. Infrastructure costs money every day, and sites earn a small amount of passive revenue as they accumulate visits.</p>
      <div class="cmd-ref">
        <code>contracts</code><span>List open and active work.</span>
        <code>accept C-1000</code><span>Accept a contract by id.</span>
        <code>submit C-1000</code><span>Submit once the objective is satisfied.</span>
        <code>buy vps-micro</code><span>Provision a small server.</span>
        <code>buy domain quietfield.net</code><span>Register a domain for $18.</span>
        <code>deploy ~/projects quietfield.net</code><span>Publish a directory on your server.</span>
        <code>bank</code><span>Show balance, earnings, and transactions.</span>
      </div>
      <p style="margin-top:14px">Read the objective before accepting. Code contracts check the requested file and minimum line count. Deploy contracts require a live site on infrastructure you own.</p>`;
  }
  if (section === 'cloud') {
    return `<h2>Cloud infrastructure and autonomous agents</h2>
      <p>Cloud providers sell capacity at different prices and reliability. An instance becomes an owned server: SSH into it, deploy sites, run containers, and build a cluster.</p>
      <div class="cmd-ref">
        <code>cloud providers</code><span>Compare providers, regions, and price factors.</span>
        <code>cloud plans</code><span>See compute plans and monthly costs.</span>
        <code>cloud launch cloud-small redwood us-west</code><span>Provision an instance. Billing starts immediately.</span>
        <code>docker run -d nginx:alpine</code><span>Run a container on your first owned server.</span>
        <code>kubectl create cluster edge</code><span>Create a cluster from your owned nodes.</span>
        <code>kubectl apply -f deploy.yaml</code><span>Schedule a deployment from a manifest.</span>
        <code>agent deploy support-1 --role support --model nimbus-3</code><span>Deploy a bounded AI agent. Costs $45 plus model usage.</span>
        <code>agent inspect support-1</code><span>Read its role, permissions, budget, and memory.</span>
        <code>company register &lt;name&gt;</code><span>Register a company, then launch products for recurring revenue.</span>
      </div>
      <p style="margin-top:14px">Agents are not omniscient. They act inside permissions, consume a model budget, remember recent tasks, and pause when an action needs human review. Organizations hire, launch products, lose money, and fail while you are offline.</p>`;
  }
  if (section === 'persistence') {
    return `<h2>The world keeps running</h2>
      <p>State is stored locally under <code>internet-persistent-world.v1</code>. Autosave runs while you play and when the page is hidden. When you return, the simulation advances and produces an activity report.</p>
      <div class="cmd-ref">
        <code>save</code><span>Write the world to local storage immediately.</span>
        <code>reset</code><span>Erase the save and generate a new network.</span>
        <code>status</code><span>Show the live world pulse.</span>
        <code>news</code><span>Read what changed while you were away.</span>
      </div>
      <p style="margin-top:14px">Offline time is simulated in world minutes, capped at seven world days. Contracts can expire, mail arrives, servers fail, and the market moves. The report summarizes the changes; the world itself keeps its own history.</p>`;
  }
  return `<h2>You are operator@voidbox</h2>
    <p>This is a persistent internet life simulation. You have a machine, a filesystem, a network, and no reputation. The contract board is the fastest way to change that.</p>
    <div class="cmd-ref">
      <code>help</code><span>Command index.</span>
      <code>cat notes/start.txt</code><span>Read the notes left for you.</span>
      <code>status</code><span>See the world pulse.</span>
      <code>news</code><span>Read the network wire.</span>
      <code>contracts</code><span>Find your first job.</span>
      <code>nmap -sV 10.0.0.1</code><span>Start with your own gateway.</span>
      <code>mail</code><span>Read your inbox.</span>
      <code>map</code><span>Inspect the live topology.</span>
    </div>
    <p style="margin-top:14px">A good first loop: enumerate your gateway, take a small contract, deliver the artifact, get paid, buy a server, publish something. Then decide what kind of operator you want to be.</p>
    <p class="dim" style="font-size:10px">Everything is simulated. All companies, people, addresses, and vulnerabilities are fictional. No real network is reachable.</p>`;
}

/* ============================================================
   BOOT
   ============================================================ */
function init() {
  const loaded = readSave();
  app.game = reviveGame(loaded.game);
  applySettings();
  const elapsed = Date.now() - (app.game.lastSaved || app.game.lastActive || Date.now());
  if (loaded.loaded && elapsed > 120000) {
    try {
      app.offlineReport = simulateOffline(app.game, elapsed);
    } catch (e) {
      console.error('offline simulation failed', e);
    }
  }
  app.game.lastSaved = Date.now();
  app.game.lastActive = Date.now();
  app.lastUnread = unreadMail(app.game);
  app.knownAch = new Set(Object.keys(app.game.achievements));
  app.lastLegal = app.game.legal.length;
  trimWorld();
  bindGlobalUI();
  updateAll();
  openWindow('terminal');
  app.booted = true;
  if (app.offlineReport) setTimeout(() => showOfflineReport(app.offlineReport), 550);
  saveGame(false);
  app.lastTick = Date.now();
  setInterval(tickLoop, 2000);
  setInterval(updateClock, 1000);
  window.addEventListener('error', e => {
    console.error(e.error || e.message);
    toast('Simulation error', String(e.message || 'unknown error'), 'r');
  });
  window.addEventListener('unhandledrejection', e => {
    console.error(e.reason);
    toast('Simulation error', String(e.reason?.message || e.reason || 'unhandled rejection'), 'r');
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();











