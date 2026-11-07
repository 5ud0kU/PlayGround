import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./style.css";

import * as THREE from "three";
import { World } from "./world.js";
import { CreatureSystem } from "./creature.js";
import { AudioEngine } from "./audio.js";
import { analyzeGenome } from "./dna.js";
import {
  CLIMATE,
  FORAGE,
  PREDATION,
  TRAIT_ROWS,
  GENE_META,
  GENE_KEYS,
  breedPopulation,
  conditionOf,
  describeChange,
  diversity,
  evaluate,
  mulberry32,
  mutateGene,
  nameCreature,
  pressureOutlook,
  randomGenome,
  rankPopulation,
  traitDisplay,
  traitTargets,
} from "./genetics.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const pad = (n) => String(n).padStart(2, "0");
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const state = {
  generation: 1,
  stage: "cellular",
  env: { climate: 1, food: 1, predators: 1 },
  population: [],
  history: [],
  mutagen: 3,
  auto: false,
  speed: 1,
  autoTimer: 0,
  selectedIndex: 0,
  sound: false,
  transitioning: false,
  logs: [],
  milestoneShown: false,
};

const SPAWN_POSITIONS = [
  { x: 0.05, z: 0.2 },
  { x: -2.7, z: -3.9 },
  { x: 2.7, z: -3.1 },
  { x: -3.1, z: 0.9 },
  { x: 3.2, z: -0.7 },
  { x: 0.2, z: -4.3 },
];

const FOUNDERS = [
  {
    bodySize: 0.55, neck: 0.56, legs: 0.52, tail: 0.62, armor: 0.43,
    speed: 0.53, fat: 0.4, crest: 0.66, hue: 0.54, pattern: 0.62,
  },
  {
    bodySize: 0.38, neck: 0.7, legs: 0.6, tail: 0.5, armor: 0.25,
    speed: 0.62, fat: 0.3, crest: 0.32, hue: 0.38, pattern: 0.48,
  },
  {
    bodySize: 0.66, neck: 0.35, legs: 0.46, tail: 0.38, armor: 0.64,
    speed: 0.36, fat: 0.57, crest: 0.4, hue: 0.72, pattern: 0.7,
  },
  {
    bodySize: 0.48, neck: 0.44, legs: 0.66, tail: 0.72, armor: 0.31,
    speed: 0.7, fat: 0.29, crest: 0.48, hue: 0.62, pattern: 0.42,
  },
  {
    bodySize: 0.72, neck: 0.52, legs: 0.37, tail: 0.45, armor: 0.5,
    speed: 0.4, fat: 0.66, crest: 0.26, hue: 0.47, pattern: 0.55,
  },
  {
    bodySize: 0.43, neck: 0.31, legs: 0.55, tail: 0.34, armor: 0.72,
    speed: 0.56, fat: 0.34, crest: 0.58, hue: 0.83, pattern: 0.66,
  },
];

let organismId = 1;
let random = mulberry32(48271);
const audio = new AudioEngine();

const world = new World($("#scene"));
const creatures = new CreatureSystem(world);

const els = {
  generation: $("#stat-generation"),
  population: $("#stat-population"),
  fitness: $("#stat-fitness"),
  diversity: $("#stat-diversity"),
  specimenId: $("#specimen-id"),
  specimenName: $("#specimen-name"),
  specimenLatin: $("#specimen-latin"),
  specimenGlyph: $("#specimen-glyph"),
  stageNote: $("#stage-note"),
  dossierHeading: $("#dossier-heading"),
  traitHeading: $("#trait-heading"),
  panel: $("#specimen-panel"),
  diet: $("#tag-diet"),
  plan: $("#tag-plan"),
  status: $("#tag-status"),
  fitnessRing: $("#fitness-ring"),
  specimenFitness: $("#specimen-fitness"),
  fitThermal: $("#fit-thermal"),
  fitForage: $("#fit-forage"),
  fitDefense: $("#fit-defense"),
  fitEnergy: $("#fit-energy"),
  traitList: $("#trait-list"),
  dnaPairCount: $("#dna-pair-count"),
  dnaGcContent: $("#dna-gc-content"),
  dnaSequence: $("#dna-sequence"),
  dnaSystems: $("#dna-systems"),
  mutagenPips: $("#mutagen-pips"),
  btnMutate: $("#btn-mutate"),
  btnEvolve: $("#btn-evolve"),
  btnAuto: $("#btn-auto"),
  autoLabel: $("#auto-label"),
  popDots: $("#pop-dots"),
  logList: $("#log-list"),
  chart: $("#fitness-chart"),
  chartCurrent: $("#chart-current"),
  chartDelta: $("#chart-delta"),
  chartEnd: $("#chart-end"),
  climateReadout: $("#climate-readout"),
  foodReadout: $("#food-readout"),
  predatorReadout: $("#predator-readout"),
  outlookText: $("#outlook-text"),
  outlookIcon: $("#outlook-icon"),
  weights: {
    thermal: [$("#weight-thermal"), $("#weight-thermal-value")],
    foraging: [$("#weight-forage"), $("#weight-forage-value")],
    defense: [$("#weight-defense"), $("#weight-defense-value")],
    energy: [$("#weight-energy"), $("#weight-energy-value")],
  },
  toast: $("#toast"),
  toastTitle: $("#toast-title"),
  toastText: $("#toast-text"),
  toastMark: $("#toast-mark"),
  hint: $("#hint"),
  modal: $("#help-modal"),
  dnaModal: $("#dna-modal"),
  dnaList: $("#dna-list"),
  btnDnaBank: $("#btn-dna-bank"),
  btnDnaClose: $("#btn-dna-close"),
  btnDnaSave: $("#btn-dna-save"),
  dnaCount: $("#dna-count"),
  scrim: $("#sheet-scrim"),
  specimenPanel: $("#specimen-panel"),
  ecologyPanel: $("#ecology-panel"),
  btnSound: $("#btn-sound"),
  btnHelp: $("#btn-help"),
  btnOrbit: $("#btn-orbit"),
  creatureTag: $("#creature-tag"),
  creatureTagName: $("#creature-tag-name"),
  creatureTagMeta: $("#creature-tag-meta"),
};

const tagWorld = new THREE.Vector3();

function makeOrganism(genome, details = {}) {
  const condition = details.condition ?? conditionOf(random);
  return {
    id: organismId++,
    genome,
    condition,
    evaluation: evaluate(genome, state.env, condition),
    origin: details.origin ?? "founder",
    changes: details.changes ?? [],
    parents: details.parents ?? [],
  };
}

function makeFounders() {
  random = mulberry32(48271);
  organismId = 1;
  return FOUNDERS.map((genome, index) => makeOrganism(
    index < 2 ? { ...genome } : randomGenome(mulberry32(7301 + index * 47), 0.5, 0.16),
    { origin: "founder" },
  ));
}

function meanFitness() {
  if (!state.population.length) return 0;
  return state.population.reduce((sum, org) => sum + org.evaluation.fitness, 0) / state.population.length;
}

function currentOrganism() {
  const creature = creatures.selected;
  return creature ? state.population[creatures.selectedIndex] : null;
}

const DNA_BANK_KEY = "helix-dna-bank-v1";
const DNA_BANK_LIMIT = 50;

function readDnaBank() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DNA_BANK_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.id === "string" &&
      typeof entry.name === "string" && entry.genome &&
      GENE_KEYS.every((key) => Number.isFinite(entry.genome[key]) && entry.genome[key] >= 0 && entry.genome[key] <= 1));
  } catch {
    return [];
  }
}

function writeDnaBank(entries) {
  try {
    localStorage.setItem(DNA_BANK_KEY, JSON.stringify(entries.slice(0, DNA_BANK_LIMIT)));
    return true;
  } catch {
    showToast("Archive unavailable", "Browser storage is full or disabled", "!", 3200);
    return false;
  }
}

function renderDnaBank() {
  const entries = readDnaBank();
  els.dnaCount.textContent = `${entries.length} archived genome${entries.length === 1 ? "" : "s"}`;
  els.dnaList.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "dna-empty";
    empty.textContent = "No genomes archived yet. Save the selected specimen to begin a lineage library.";
    els.dnaList.append(empty);
    return;
  }

  for (const entry of entries) {
    const card = document.createElement("article");
    card.className = "dna-entry";
    const details = document.createElement("div");
    details.className = "dna-entry-copy";
    const name = document.createElement("strong");
    name.textContent = entry.name;
    const meta = document.createElement("span");
    const date = new Date(entry.savedAt);
    meta.textContent = `${entry.latin || "Archived genome"} · G${pad(entry.generation || 1)} · ${Number.isNaN(date.getTime()) ? "saved previously" : date.toLocaleDateString()}`;
    details.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "dna-entry-actions";
    const restore = document.createElement("button");
    restore.className = "button button-quiet";
    restore.type = "button";
    restore.dataset.restoreGenome = entry.id;
    restore.textContent = "Restore";
    const remove = document.createElement("button");
    remove.className = "dna-remove";
    remove.type = "button";
    remove.dataset.removeGenome = entry.id;
    remove.setAttribute("aria-label", `Remove ${entry.name} from DNA bank`);
    remove.textContent = "×";
    actions.append(restore, remove);
    card.append(details, actions);
    els.dnaList.append(card);
  }
}

function saveSelectedGenome() {
  const org = currentOrganism();
  if (!org) return;
  const name = nameCreature(org.genome);
  const entries = readDnaBank();
  entries.unshift({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.common,
    latin: name.latin,
    generation: state.generation,
    stage: state.stage,
    savedAt: new Date().toISOString(),
    genome: Object.fromEntries(GENE_KEYS.map((key) => [key, org.genome[key]])),
  });
  if (writeDnaBank(entries)) {
    renderDnaBank();
    showToast("Genome archived", `${name.common} · generation ${pad(state.generation)}`, "◈", 2800);
  }
}

function restoreGenome(id) {
  const entry = readDnaBank().find((item) => item.id === id);
  const org = currentOrganism();
  if (!entry || !org) return;
  org.genome = Object.fromEntries(GENE_KEYS.map((key) => [key, entry.genome[key]]));
  org.evaluation = evaluate(org.genome, state.env, org.condition);
  org.origin = "DNA bank";
  org.changes = [];
  org.parents = [];
  creatures.replace(creatures.selectedIndex, org);
  updateAll();
  addLog(`Archived genome <b>${entry.name}</b> restored to specimen K-${pad(creatures.selectedIndex + 1)}.`, true);
  showToast("Genome restored", `${entry.name} now occupies the selected specimen`, "◈", 3000);
  audio.select();
}

function meanGenome() {
  const mean = {};
  for (const key of Object.keys(state.population[0].genome)) {
    mean[key] = state.population.reduce((sum, org) => sum + org.genome[key], 0) / state.population.length;
  }
  return mean;
}

function addLog(text, accent = false) {
  state.logs.unshift({
    text,
    accent,
    gen: state.generation,
  });
  state.logs = state.logs.slice(0, 3);
  renderLogs();
}

function renderLogs() {
  els.logList.innerHTML = state.logs
    .map((entry) => `<div class="log-entry${entry.accent ? " accent" : ""}"><em>G${pad(entry.gen)}</em><span>${entry.text}</span></div>`)
    .join("");
}

let toastTimer = null;
let hintTimer = null;

function hideHint() {
  els.hint.classList.add('hidden');
  clearTimeout(hintTimer);
}

function showToast(title, text, mark = "✦", duration = 3600) {
  clearTimeout(toastTimer);
  els.toastTitle.textContent = title;
  els.toastText.textContent = text;
  els.toastMark.textContent = mark;
  els.toast.classList.add("visible");
  toastTimer = setTimeout(() => els.toast.classList.remove("visible"), duration);
}

function fitnessColor(fitness) {
  if (fitness >= 72) return "#caff72";
  if (fitness >= 58) return "#58f0c0";
  if (fitness >= 44) return "#ffcf72";
  return "#ff8a6d";
}

function creatureColorHex(creature) {
  return `#${creature?.themeColor?.getHexString?.() ?? "caff72"}`;
}

function buildTraitRows() {
  els.traitList.innerHTML = TRAIT_ROWS.map((key) => {
    const meta = GENE_META[key];
    return `
      <div class="trait" data-gene="${key}" title="Click to direct a mutation in ${meta.label.toLowerCase()}">
        <div class="trait-top">
          <span>${meta.label}</span>
          <span><b data-value>0</b> <em>${meta.code}</em></span>
        </div>
        <div class="trait-track">
          <div class="trait-fill" data-fill></div>
          <i class="trait-optimum" data-optimum></i>
        </div>
      </div>`;
  }).join("");
}

function renderPopDots() {
  els.popDots.innerHTML = state.population
    .map((org, index) => {
      const color = org.creature ? creatureColorHex(org.creature) : "#7d9c8e";
      return `<button class="pop-dot${index === creatures.selectedIndex ? " active" : ""}" data-index="${index}" style="--dot-color:${color}" aria-label="Select specimen ${index + 1}"></button>`;
    })
    .join("");
}

function updateDNAAnalyser(genome) {
  const analysis = analyzeGenome(genome);
  els.dnaPairCount.textContent = `${analysis.basePairs} bp`;
  els.dnaGcContent.textContent = `${analysis.gcContent.toFixed(1)}%`;
  els.dnaSequence.innerHTML = analysis.genes.map((gene) => `
    <div class="dna-gene" title="${gene.label}: ${gene.value.toFixed(3)}">
      <span class="dna-gene-code">${gene.code}</span>
      <span class="dna-gene-bases">${[...gene.sequence].map((base) => `<i class="base-${base}">${base}</i>`).join("")}</span>
    </div>`).join("");

  const labels = {
    muscle: "Muscle", bones: "Bones", neurons: "Neurons",
    fat: "Adipose", nerves: "Nerves", ears: "Ears",
  };
  els.dnaSystems.innerHTML = Object.entries(analysis.systems).map(([system, value]) => `
    <div class="dna-system" title="${labels[system]} expression ${Math.round(value * 100)}%">
      <span>${labels[system]}</span>
      <div class="dna-system-track"><i style="width:${Math.round(value * 100)}%"></i></div>
      <b>${Math.round(value * 100)}</b>
    </div>`).join("");
}

function updateSelectionUI() {
  const org = currentOrganism();
  const creature = creatures.selected;
  if (!org || !creature) return;
  updateDNAAnalyser(org.genome);

  const name = nameCreature(org.genome);
  const color = creatureColorHex(creature);
  els.panel.style.setProperty("--specimen-color", color);
  els.specimenGlyph.style.setProperty("--specimen-color", color);
  const hslColor = new THREE.Color(color);
  const hsl = {};
  hslColor.getHSL(hsl);
  els.specimenLatin.style.color = `hsl(${Math.round(hsl.h * 360)}, 28%, 58%)`;

  const cellular = state.stage === "cellular";
  els.specimenId.textContent = `${cellular ? "CELL" : "SPECIMEN"} K-${pad(creatures.selectedIndex + 1)}`;
  els.specimenName.textContent = name.common;
  els.specimenLatin.textContent = cellular ? `cellular lineage · ${name.latin}` : name.latin;
  els.dossierHeading.textContent = cellular ? "Cell dossier" : "Specimen dossier";
  els.traitHeading.textContent = cellular ? "Cellular gene expression" : "Trait expression";
  els.stageNote.textContent = cellular
    ? "Cellular stage · membrane-bound cell with nucleus, nucleolus, mitochondria & ribosomes"
    : "Organism stage · multicellular form with differentiated body systems";
  els.diet.textContent = cellular ? "Eukaryote" : org.genome.armor > 0.66 ? "Omnivore" : org.genome.neck > 0.62 ? "Browser" : "Grazer";
  els.plan.textContent = cellular ? "Single cell" : org.genome.legs > 0.66 ? "Cursorial" : "Quadruped";
  els.creatureTagName.textContent = name.common;
  els.creatureTagMeta.textContent = `${cellular ? "cell" : "specimen"} K-${pad(creatures.selectedIndex + 1)} · fitness ${Math.round(org.evaluation.fitness)}`;

  const fitness = org.evaluation.fitness;
  const ringColor = fitnessColor(fitness);
  const deg = fitness * 3.6;
  els.fitnessRing.style.background = `conic-gradient(${ringColor} 0deg ${deg}deg, rgba(255,255,255,0.07) ${deg}deg 360deg)`;
  els.fitnessRing.style.setProperty("--ring-color", ringColor);
  els.specimenFitness.textContent = Math.round(fitness);
  els.specimenFitness.style.color = ringColor;
  els.fitThermal.textContent = Math.round(org.evaluation.components.thermal);
  els.fitForage.textContent = Math.round(org.evaluation.components.foraging);
  els.fitDefense.textContent = Math.round(org.evaluation.components.defense);
  els.fitEnergy.textContent = Math.round(org.evaluation.components.energy);

  const status = fitness >= 72 ? "Thriving" : fitness >= 56 ? "Stable" : "Stressed";
  els.status.textContent = status;
  els.status.style.color = fitness >= 56 ? "var(--mint)" : "var(--coral)";
  const weightValues = org.evaluation.weights;
  const weightTotal = Object.values(weightValues).reduce((sum, value) => sum + value, 0);
  for (const key of ["thermal", "foraging", "defense", "energy"]) {
    const percentage = (weightValues[key] / weightTotal) * 100;
    els.weights[key][0].style.width = `${percentage}%`;
    els.weights[key][1].textContent = `${Math.round(percentage)}%`;
  }

  const targets = traitTargets(state.env);
  const rows = [...els.traitList.querySelectorAll(".trait")];
  for (const row of rows) {
    const key = row.dataset.gene;
    const raw = org.genome[key];
    row.querySelector("[data-value]").textContent = traitDisplay(key, raw);
    row.querySelector("[data-fill]").style.width = `${clamp(raw, 0, 1) * 100}%`;
    const optimum = row.querySelector("[data-optimum]");
    optimum.style.left = `${clamp(targets[key] ?? 0.5, 0.02, 0.98) * 100}%`;
  }

  els.mutagenPips.innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < state.mutagen ? "full" : ""}"></i>`).join("");
  els.btnMutate.disabled = state.mutagen <= 0;
  renderPopDots();
}

function updateStats() {
  const mean = meanFitness();
  els.generation.textContent = pad(state.generation);
  els.population.textContent = pad(state.population.length);
  els.fitness.textContent = mean.toFixed(1);
  els.diversity.textContent = diversity(state.population).toFixed(2);
  els.chartCurrent.textContent = mean.toFixed(1);
  els.chartEnd.textContent = `G${pad(state.generation)}`;
}

function updateEnvironmentUI() {
  els.climateReadout.textContent = CLIMATE[state.env.climate];
  els.foodReadout.textContent = FORAGE[state.env.food];
  els.predatorReadout.textContent = PREDATION[state.env.predators];
  els.outlookText.textContent = pressureOutlook(state.env);

  const colors = ["#84cfff", "#90e5c3", "#ffb26c"];
  els.outlookIcon.style.color = colors[state.env.climate];

  const groups = [
    ["#climate-control", state.env.climate],
    ["#food-control", state.env.food],
    ["#predator-control", state.env.predators],
  ];
  for (const [selector, value] of groups) {
    $$(`${selector} button`).forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.value) === value);
    });
  }
}

function drawChart() {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const values = state.history.slice(-20);
  const min = 28;
  const max = 96;
  const padX = 5;
  const padY = 13;

  ctx.save();
  ctx.strokeStyle = "rgba(180, 255, 220, 0.08)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 7]);
  for (let i = 0; i < 4; i += 1) {
    const y = padY + ((height - padY * 2) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  if (!values.length) return;

  const graphValues = values.length === 1 ? [values[0], values[0]] : values;
  const getY = (value) => padY + (1 - (clamp(value, min, max) - min) / (max - min)) * (height - padY * 2);
  const getX = (index) => padX + (index / (graphValues.length - 1)) * (width - padX * 2);

  const points = graphValues.map((value, index) => ({ x: getX(index), y: getY(value) }));

  ctx.beginPath();
  ctx.moveTo(points[0].x, height);
  ctx.lineTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const point = points[i];
    const midX = (prev.x + point.x) / 2;
    ctx.bezierCurveTo(midX, prev.y, midX, point.y, point.x, point.y);
  }
  ctx.lineTo(points[points.length - 1].x, height);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, 0, 0, height);
  fill.addColorStop(0, "rgba(201, 255, 102, 0.2)");
  fill.addColorStop(1, "rgba(201, 255, 102, 0)");
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const point = points[i];
    const midX = (prev.x + point.x) / 2;
    ctx.bezierCurveTo(midX, prev.y, midX, point.y, point.x, point.y);
  }
  const stroke = ctx.createLinearGradient(0, 0, width, 0);
  stroke.addColorStop(0, "#58f0c0");
  stroke.addColorStop(1, "#caff72");
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(140, 255, 164, 0.48)";
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const last = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(202, 255, 114, 0.18)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = "#d8ff86";
  ctx.fill();

  const previous = values.length > 1 ? values[values.length - 2] : values[values.length - 1];
  const delta = (values[values.length - 1] || 0) - previous;
  els.chartDelta.textContent = `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}`;
  els.chartDelta.style.color = delta >= 0 ? "var(--mint)" : "var(--coral)";
}

function updateAll() {
  updateStats();
  updateSelectionUI();
  updateEnvironmentUI();
  drawChart();
}

function recordHistory() {
  state.history.push(meanFitness());
  if (state.history.length > 40) state.history.shift();
}

function pickDominantPressure(org) {
  const weights = org.evaluation.weights;
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  const labels = {
    thermal: "thermoregulation",
    foraging: "forage access",
    defense: "predator defense",
    energy: "energy balance",
  };
  return labels[entries[0][0]];
}

function advanceGeneration({ automatic = false } = {}) {
  if (state.transitioning) return;
  hideHint();
  state.transitioning = true;
  const before = meanFitness();
  const parents = rankPopulation(state.population);
  const seeded = breedPopulation(state.population, state.env, random);
  const nextOrganisms = seeded.map((item) => makeOrganism(item.genome, {
    origin: item.origin,
    changes: item.changes,
    parents: item.parents,
  }));

  state.population = nextOrganisms;
  const previousStage = state.stage;
  state.generation += 1;
  state.stage = state.generation >= 4 ? "organism" : "cellular";
  state.mutagen = Math.min(5, state.mutagen + 2);
  state.autoTimer = 0;
  creatures.selectedIndex = 0;
  creatures.spawnPopulation(state.population, SPAWN_POSITIONS, state.stage);
  creatures.select(0, true);

  recordHistory();
  const mean = meanFitness();
  const top = rankPopulation(state.population)[0];
  const pressure = pickDominantPressure(top);
  const changes = nextOrganisms.flatMap((org) => org.changes || []);
  const strongest = changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

  els.btnAuto.classList.toggle("paused", !state.auto);

  addLog(
    `Generation ${pad(state.generation)} ${state.stage === "organism" && previousStage === "cellular" ? "developed into multicellular organisms" : "hatched"}. Mean fitness <b>${mean.toFixed(1)}</b>; ${pressure} led selection.`,
    true,
  );
  if (strongest) {
    const desc = describeChange(strongest);
    addLog(`Dominant mutation: ${desc.detail.toLowerCase()} — ${desc.title}.`);
  } else {
    addLog(`The leading genome was preserved intact. ${parents.length ? "Stability can be a strategy." : ""}`);
  }

  const selectedCreature = creatures.selected;
  if (selectedCreature) {
    world.burst(selectedCreature.position, selectedCreature.accentColor ?? 0xcaff72, 1.15);
  }

  const gain = mean - before;
  showToast(
    previousStage !== state.stage ? "Organism stage reached" : `Generation ${pad(state.generation)} hatched`,
    previousStage !== state.stage
      ? `Cell lineages now develop into multicellular organisms · ${gain >= 0 ? "+" : "−"}${Math.abs(gain).toFixed(1)} fitness`
      : `${gain >= 0 ? "+" : "−"}${Math.abs(gain).toFixed(1)} fitness · ${state.population.filter((o) => o.changes.length).length} new alleles`,
    strongest ? "◈" : "✦",
    3600,
  );
  if (automatic) addLog("Automatic selection advanced the lineage.");
  updateAll();
  audio.evolve();

  if (!state.milestoneShown && state.generation >= 5 && mean >= 72) {
    state.milestoneShown = true;
    setTimeout(() => {
      showToast("Stable lineage established", `${mean.toFixed(1)} mean fitness · the basin is adapting around your creatures`, "❖", 5200);
      addLog("Milestone: a stable lineage now occupies the basin.", true);
    }, 900);
  }

  setTimeout(() => {
    state.transitioning = false;
  }, 360);
}

function toggleAuto() {
  hideHint();
  state.auto = !state.auto;
  state.autoTimer = 0;
  els.btnAuto.classList.toggle("paused", !state.auto);
  els.autoLabel.textContent = state.auto ? "Auto-evolving" : "Start auto-run";
  if (state.auto) {
    addLog(`Automatic selection engaged at ${state.speed}×.`, true);
    showToast("Evolution running", `A new generation every ${(6 / state.speed).toFixed(1)} seconds`, "▶", 2300);
  } else {
    addLog("Automatic selection paused. The basin is still alive.");
  }
  audio.click();
}

function directMutation(gene = null) {
  if (state.transitioning) return;
  hideHint();
  const org = currentOrganism();
  const creature = creatures.selected;
  if (!org || !creature) return;
  if (state.mutagen <= 0) {
    showToast("Mutagen reserve depleted", "Advance a generation to replenish the reserve", "!", 3000);
    audio.error();
    return;
  }

  const key = gene || TRAIT_ROWS[Math.floor(random() * TRAIT_ROWS.length)];
  const result = mutateGene(org.genome, key, random, 0.17);
  org.genome = result.genome;
  org.evaluation = evaluate(org.genome, state.env, org.condition);
  org.changes = result.changes;
  state.mutagen -= 1;
  creatures.replace(creatures.selectedIndex, org);
  const mutated = creatures.selected;
  world.burst(mutated.position, mutated.accentColor ?? 0xcaff72, 0.75);

  const change = result.changes[0];
  const info = describeChange(change);
  showToast(info.title, `${info.detail} · directed mutation expressed`, "⌁", 3300);
  addLog(`Directed mutation: <b>${info.title}</b> in specimen K-${pad(creatures.selectedIndex + 1)}.`, true);
  if (state.history.length) state.history[state.history.length - 1] = meanFitness();
  updateAll();
  audio.mutate();
}

function selectIndex(index, announce = true) {
  if (!state.population.length) return;
  creatures.select(index, true);
  state.selectedIndex = index;
  updateSelectionUI();
  if (announce) audio.select();
}

function setEnvironment(key, value) {
  hideHint();
  state.env[key] = value;
  updateEnvironmentUI();
  world.applyEnvironment(state.env);
  for (const org of state.population) {
    org.evaluation = evaluate(org.genome, state.env, org.condition);
  }
  if (state.history.length) state.history[state.history.length - 1] = meanFitness();
  updateAll();
  audio.click();

  const label = key === "climate" ? CLIMATE[value] : key === "food" ? FORAGE[value] : PREDATION[value];
  const pressureName = key === "climate" ? "climate" : key === "food" ? "forage" : "predation";
  addLog(`${label} ${pressureName} established. Selection targets have shifted.`);
}

function resetStudy() {
  state.generation = 1;
  state.stage = "cellular";
  state.env = { climate: 1, food: 1, predators: 1 };
  state.mutagen = 3;
  state.auto = false;
  state.speed = 1;
  state.autoTimer = 0;
  state.history = [];
  state.logs = [];
  state.milestoneShown = false;
  state.transitioning = false;
  state.population = makeFounders();
  creatures.selectedIndex = 0;
  creatures.spawnPopulation(state.population, SPAWN_POSITIONS, state.stage);
  world.applyEnvironment(state.env, true);
  recordHistory();
  updateAll();
  els.btnAuto.classList.add("paused");
  els.autoLabel.textContent = "Start auto-run";
  $$("#speed-control button").forEach((button) => button.classList.toggle("active", button.dataset.speed === "1"));
  addLog("Fresh founder population introduced. Six genomes, one uncertain future.", true);
  addLog("Basin stabilized: temperate climate, balanced forage, stalking predators.");
  showToast("Study reset", "A new founder population is under observation", "↺", 3200);
  audio.click();
}

function speedChange(speed) {
  state.speed = speed;
  state.autoTimer = 0;
  $$("#speed-control button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.speed) === speed);
  });
  addLog(`Simulation speed set to ${speed}×.`);
  audio.click();
}

function openSheet(which) {
  closeSheets();
  const panel = which === "ecology" ? els.ecologyPanel : els.specimenPanel;
  panel.classList.add("sheet-open");
  els.scrim.classList.add("visible");
  els.hint.classList.add("hidden");
  audio.click();
}

function closeSheets() {
  els.specimenPanel.classList.remove("sheet-open");
  els.ecologyPanel.classList.remove("sheet-open");
  els.scrim.classList.remove("visible");
}

function openHelp() {
  hideHint();
  closeSheets();
  els.modal.classList.add("open");
  els.modal.setAttribute("aria-hidden", "false");
  audio.click();
}

function closeHelp() {
  els.modal.classList.remove("open");
  els.modal.setAttribute("aria-hidden", "true");
}

function openDnaBank() {
  hideHint();
  closeSheets();
  renderDnaBank();
  els.dnaModal.classList.add("open");
  els.dnaModal.setAttribute("aria-hidden", "false");
  audio.click();
}

function closeDnaBank() {
  els.dnaModal.classList.remove("open");
  els.dnaModal.setAttribute("aria-hidden", "true");
}

function removeGenome(id) {
  const entries = readDnaBank();
  const removed = entries.find((entry) => entry.id === id);
  if (!removed) return;
  if (writeDnaBank(entries.filter((entry) => entry.id !== id))) {
    renderDnaBank();
    showToast("Genome removed", `${removed.name} was removed from the DNA bank`, "×", 2600);
  }
}

function toggleSound() {
  state.sound = !state.sound;
  const success = audio.setEnabled(state.sound);
  if (!success) {
    state.sound = false;
    showToast("Audio unavailable", "This browser could not start the audio system", "!", 2600);
    return;
  }
  els.btnSound.classList.toggle("muted", !state.sound);
  els.btnSound.setAttribute("aria-label", state.sound ? "Mute ambient sound" : "Enable ambient sound");
  if (state.sound) {
    audio.select();
    showToast("Ambient audio on", "Synthetic field recordings and UI tones enabled", "◉", 2400);
  }
}

function bindEvents() {
  els.btnEvolve.addEventListener("click", () => advanceGeneration());
  els.btnAuto.addEventListener("click", toggleAuto);
  els.btnMutate.addEventListener("click", () => directMutation());
  els.btnHelp.addEventListener("click", openHelp);
  $("#btn-help-close").addEventListener("click", closeHelp);
  els.btnDnaBank.addEventListener("click", openDnaBank);
  els.btnDnaClose.addEventListener("click", closeDnaBank);
  els.btnDnaSave.addEventListener("click", saveSelectedGenome);
  els.dnaModal.addEventListener("click", (event) => {
    if (event.target === els.dnaModal) closeDnaBank();
  });
  els.dnaList.addEventListener("click", (event) => {
    const restoreButton = event.target.closest("[data-restore-genome]");
    if (restoreButton) {
      restoreGenome(restoreButton.dataset.restoreGenome);
      return;
    }
    const removeButton = event.target.closest("[data-remove-genome]");
    if (removeButton) removeGenome(removeButton.dataset.removeGenome);
  });
  els.modal.addEventListener("click", (event) => {
    if (event.target === els.modal) closeHelp();
  });
  els.btnSound.addEventListener("click", toggleSound);
  $("#btn-reset").addEventListener("click", () => {
    resetStudy();
    closeHelp();
  });
  $("#hint-dismiss").addEventListener("click", () => els.hint.classList.add("hidden"));
  $("#btn-prev-specimen").addEventListener("click", () => {
    const next = creatures.previous();
    if (next) {
      state.selectedIndex = creatures.selectedIndex;
      updateSelectionUI();
      audio.select();
    }
  });

  els.popDots.addEventListener("click", (event) => {
    const dot = event.target.closest(".pop-dot");
    if (!dot) return;
    selectIndex(Number(dot.dataset.index));
  });

  els.traitList.addEventListener("click", (event) => {
    const row = event.target.closest(".trait");
    if (!row) return;
    directMutation(row.dataset.gene);
  });

  $$("#climate-control button").forEach((button) => {
    button.addEventListener("click", () => setEnvironment("climate", Number(button.dataset.value)));
  });
  $$("#food-control button").forEach((button) => {
    button.addEventListener("click", () => setEnvironment("food", Number(button.dataset.value)));
  });
  $$("#predator-control button").forEach((button) => {
    button.addEventListener("click", () => setEnvironment("predators", Number(button.dataset.value)));
  });
  $$("#speed-control button").forEach((button) => {
    button.addEventListener("click", () => speedChange(Number(button.dataset.speed)));
  });

  els.btnOrbit.addEventListener("click", () => {
    const enabled = !world.controls.autoRotate;
    world.setOrbit(enabled);
    els.btnOrbit.classList.toggle("active", enabled);
    audio.click();
  });
  els.btnOrbit.classList.add("active");

  $("#btn-sheet-specimen").addEventListener("click", () => openSheet("specimen"));
  $("#btn-sheet-eco").addEventListener("click", () => openSheet("ecology"));
  $$("[data-close-sheet]").forEach((button) => {
    button.addEventListener("click", () => {
      closeSheets();
      audio.click();
    });
  });
  els.scrim.addEventListener("click", closeSheets);

  const canvas = world.renderer.domElement;
  let downX = 0;
  let downY = 0;
  let downTime = 0;
  let lastHover = 0;
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const now = performance.now();
    if (now - lastHover < 90) return;
    lastHover = now;
    canvas.style.cursor = creatures.hitTest(event) !== null ? "pointer" : "grab";
  });
  canvas.addEventListener("pointerdown", (event) => {
    downX = event.clientX;
    downY = event.clientY;
    downTime = performance.now();
  });
  canvas.addEventListener("pointerup", (event) => {
    const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
    if (moved > 6 || performance.now() - downTime > 650) return;
    if (els.modal.classList.contains("open")) return;
    const index = creatures.pick(event);
    if (index !== null) {
      state.selectedIndex = index;
      updateSelectionUI();
      audio.select();
      if (window.innerWidth <= 900) openSheet("specimen");
    }
  });

  window.addEventListener("keydown", (event) => {
    const tag = event.target?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (event.code === "Space") {
      event.preventDefault();
      toggleAuto();
    } else if (event.key.toLowerCase() === "e") {
      advanceGeneration();
    } else if (event.key.toLowerCase() === "m") {
      directMutation();
    } else if (event.key.toLowerCase() === "r" && event.shiftKey) {
      resetStudy();
    } else if (event.key === "Escape") {
      closeHelp();
      closeDnaBank();
      closeSheets();
    }
  });

  window.addEventListener("resize", () => {
    drawChart();
  });
}

function updateCreatureTag() {
  const creature = creatures.selected;
  if (!creature || !els.creatureTag) return;
  const dims = creature.dimensions;
  tagWorld.set(
    creature.position.x,
    creature.position.y + (dims.bodyY + dims.neckLen * 0.55 + 0.32) * creature.sizeScale,
    creature.position.z,
  );
  tagWorld.project(world.camera);
  if (tagWorld.z > 1 || tagWorld.z < -1) {
    els.creatureTag.style.opacity = "0";
    return;
  }
  const x = (tagWorld.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-tagWorld.y * 0.5 + 0.5) * window.innerHeight;
  const covered = window.innerWidth > 900 && (x < 345 || x > window.innerWidth - 345);
  els.creatureTag.style.opacity = covered ? "0" : "1";
  els.creatureTag.style.left = `${x}px`;
  els.creatureTag.style.top = `${y}px`;
}

function gameLoop(now) {
  const rawDt = Math.min(1, (now - (gameLoop.last || now)) / 1000);
  const dt = Math.min(0.05, rawDt);
  gameLoop.last = now;
  creatures.update(dt);
  updateCreatureTag();

  if (state.auto) {
    // Auto-evolution runs on wall-clock time so software rendering or a
    // slow frame never stretches "one generation every N seconds".
    state.autoTimer += rawDt * state.speed;
    if (state.autoTimer >= 6 && !state.transitioning) {
      state.autoTimer = 0;
      advanceGeneration({ automatic: true });
    }
  }

  requestAnimationFrame(gameLoop);
}

function initialize() {
  buildTraitRows();
  bindEvents();
  els.btnSound.classList.add("muted");
  els.btnAuto.classList.add("paused");
  els.autoLabel.textContent = "Start auto-run";
  state.population = makeFounders();
  creatures.selectedIndex = 0;
  creatures.spawnPopulation(state.population, SPAWN_POSITIONS, state.stage);
  creatures.select(0, true);
  state.selectedIndex = 0;
  recordHistory();
  updateAll();
  world.applyEnvironment(state.env, true);

  addLog("Founder population introduced: six genomes under observation.", true);
  addLog("Basin stabilized: temperate climate, balanced forage, stalking predators.");
  addLog("Tip: click a creature to read its dossier.");

  world.setOrbit(true);
  requestAnimationFrame(gameLoop);
  hintTimer = setTimeout(() => els.hint.classList.add('hidden'), 11000);

  // A subtle first-load reveal for the HUD.
  requestAnimationFrame(() => {
    document.body.classList.add("ready");
  });

  window.__helix = {
    state,
    advanceGeneration,
    directMutation,
    setEnvironment,
    selectIndex,
    resetStudy,
    creatures,
    world,
  };
}

initialize();
