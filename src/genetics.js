export const GENE_KEYS = [
  "bodySize",
  "neck",
  "legs",
  "tail",
  "armor",
  "speed",
  "fat",
  "crest",
  "hue",
  "pattern",
];

export const GENE_META = {
  bodySize: { label: "Body mass", code: "HX-01", unit: "kg" },
  neck: { label: "Neck reach", code: "HX-02", unit: "m" },
  legs: { label: "Limb length", code: "HX-03", unit: "m" },
  tail: { label: "Caudal length", code: "HX-04", unit: "m" },
  armor: { label: "Dermal armor", code: "HX-05", unit: "%" },
  speed: { label: "Sprint capacity", code: "HX-06", unit: "m/s" },
  fat: { label: "Adipose layer", code: "HX-07", unit: "cm" },
  crest: { label: "Display crest", code: "HX-08", unit: "%" },
  hue: { label: "Pigment hue", code: "HX-09", unit: "°" },
  pattern: { label: "Pattern density", code: "HX-10", unit: "%" },
};

export const TRAIT_ROWS = ["bodySize", "neck", "legs", "armor", "speed", "fat", "tail"];

export const CLIMATE = ["Frigid", "Temperate", "Arid"];
export const FORAGE = ["Sparse", "Balanced", "Lush"];
export const PREDATION = ["Absent", "Stalking", "Rampant"];

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng) {
  const u = Math.max(1e-9, rng());
  const v = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function randomGenome(rng = Math.random, center = 0.5, spread = 0.13) {
  const genome = {};
  for (const key of GENE_KEYS) {
    let lo = center - spread;
    let hi = center + spread;
    if (key === "hue") {
      lo = 0.28;
      hi = 0.74;
    }
    if (key === "pattern") {
      lo = 0.25;
      hi = 0.8;
    }
    genome[key] = Math.min(1, Math.max(0, lo + rng() * (hi - lo)));
  }
  return genome;
}

const LINKAGE_GROUPS = [
  ["bodySize", "fat", "speed", "legs"],
  ["neck", "tail", "crest", "armor"],
  ["hue", "pattern"],
];

export function crossover(a, b, rng = Math.random) {
  const child = {};
  for (const chromosome of LINKAGE_GROUPS) {
    // A chromosome is inherited as a linked block, with occasional crossovers
    // between loci. This creates realistic inherited trait combinations.
    let source = rng() < 0.5 ? a : b;
    for (const key of chromosome) {
      if (rng() < 0.22) source = source === a ? b : a;
      const value = source[key];
      child[key] = clamp01(value + gaussian(rng) * 0.012);
    }
  }
  return child;
}

export function mutate(genome, rng = Math.random, rate = 0.2, power = 0.115) {
  const result = { ...genome };
  const changes = [];
  for (const key of GENE_KEYS) {
    if (rng() < rate) {
      const before = result[key];
      const step = gaussian(rng) * power;
      result[key] = clamp01(before + step);
      if (Math.abs(result[key] - before) > 0.004) {
        changes.push({
          gene: key,
          code: GENE_META[key].code,
          before,
          after: result[key],
          delta: result[key] - before,
        });
      }
    }
  }
  return { genome: result, changes };
}

export function mutateGene(genome, key, rng = Math.random, power = 0.16) {
  const next = { ...genome };
  const before = next[key];
  next[key] = clamp01(before + gaussian(rng) * power);
  return {
    genome: next,
    changes: [{ gene: key, code: GENE_META[key].code, before, after: next[key], delta: next[key] - before }],
  };
}

export function evaluate(genome, env, condition = 1) {
  const g = genome;
  const sizeTarget = [0.76, 0.49, 0.26][env.climate];
  const fatTarget = [0.72, 0.34, 0.1][env.climate];
  const legTarget = [0.36, 0.5, 0.73][env.climate];

  let thermal =
    1 -
    Math.abs(g.bodySize - sizeTarget) * 1.28 -
    Math.abs(g.fat - fatTarget) * 1.06 -
    Math.abs(g.legs - legTarget) * 0.34;
  if (env.climate === 0) thermal += g.armor * 0.025;
  thermal = clamp01(thermal + 0.04);

  let foraging;
  if (env.food === 0) {
    foraging = 0.08 + g.neck * 0.58 + g.legs * 0.21 + (1 - g.bodySize) * 0.12;
  } else if (env.food === 1) {
    foraging = 0.48 + (1 - Math.abs(g.neck - 0.44)) * 0.2 + (1 - Math.abs(g.bodySize - 0.5)) * 0.16 + g.legs * 0.1;
  } else {
    foraging = 0.58 + g.bodySize * 0.2 + g.fat * 0.08 + (1 - Math.abs(g.neck - 0.35)) * 0.12;
  }
  foraging = clamp01(foraging);

  const evasion = clamp01(0.08 + g.legs * 0.38 + g.speed * 0.42 + g.tail * 0.07);
  const defense = clamp01(g.armor * 0.58 + g.bodySize * 0.16 + g.fat * 0.09 + g.crest * 0.08 + evasion * 0.15);
  const protection = clamp01(defense * 0.57 + evasion * 0.57);
  // A simple whole-organism energy budget: intake scales with forage access,
  // while maintenance follows sublinear (allometric) body-mass costs plus
  // locomotion, armor, insulation, and thermal-stress expenses.
  const resourceAvailability = [0.46, 0.72, 0.92][env.food];
  const intake = foraging * resourceAvailability;
  const metabolicMass = 0.2 + g.bodySize * 0.8;
  const thermalCost = Math.abs(g.bodySize - sizeTarget) * 0.025 + Math.abs(g.fat - fatTarget) * 0.018;
  const maintenance =
    0.22 +
    Math.pow(metabolicMass, 0.75) * 0.25 +
    g.speed * 0.08 +
    g.legs * 0.035 +
    g.armor * 0.05 +
    g.fat * 0.035 +
    thermalCost;
  const reserve = g.fat * (env.food === 0 ? 0.14 : 0.045);
  const energyBalance = clamp01(0.56 + (intake + reserve - maintenance) * 1.6);

  const weights = {
    thermal: 0.18 + (env.climate === 1 ? 0.035 : 0.17),
    foraging: 0.17 + (env.food === 1 ? 0.035 : 0.15),
    defense: 0.1 + [0.02, 0.14, 0.22][env.predators],
    energy: 0.18 + (env.food === 0 ? 0.07 : 0),
  };
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const weighted =
    (thermal * weights.thermal +
      foraging * weights.foraging +
      protection * weights.defense +
      energyBalance * weights.energy) /
    total;

  return {
    fitness: Math.max(1, Math.min(99, weighted * 100 * condition)),
    components: {
      thermal: thermal * 100,
      foraging: foraging * 100,
      defense: protection * 100,
      energy: energyBalance * 100,
    },
    energyBudget: {
      intake: intake * 100,
      maintenance: maintenance * 100,
      reserve: reserve * 100,
    },
    weights,
  };
}

export function traitTargets(env) {
  return {
    bodySize: [0.76, 0.49, 0.26][env.climate],
    fat: [0.72, 0.34, 0.1][env.climate],
    legs: Math.max([0.36, 0.5, 0.73][env.climate], [0.36, 0.48, 0.67][env.predators]),
    neck: [0.79, 0.44, 0.3][env.food],
    armor: [0.18, 0.56, 0.82][env.predators],
    speed: [0.25, 0.52, 0.82][env.predators],
    tail: [0.36, 0.54, 0.67][env.predators],
  };
}

export function traitDisplay(key, value) {
  switch (key) {
    case "bodySize":
      return `${Math.round(9 + Math.pow(value, 1.7) * 340)} kg`;
    case "neck":
      return `${(0.12 + value * 1.15).toFixed(2)} m`;
    case "legs":
      return `${(0.22 + value * 1.16).toFixed(2)} m`;
    case "tail":
      return `${(0.18 + value * 1.26).toFixed(2)} m`;
    case "armor":
      return `${Math.round(value * 100)}%`;
    case "speed":
      return `${(1.1 + value * 8.6).toFixed(1)} m/s`;
    case "fat":
      return `${(0.4 + value * 8.4).toFixed(1)} cm`;
    case "crest":
      return `${Math.round(value * 100)}%`;
    case "hue":
      return `${Math.round(48 + value * 102)}°`;
    case "pattern":
      return `${Math.round(value * 100)}%`;
    default:
      return value.toFixed(2);
  }
}

export function traitValueForDisplay(key, raw) {
  switch (key) {
    case "bodySize":
      return Math.round(9 + Math.pow(raw, 1.7) * 340);
    case "neck":
      return +(0.12 + raw * 1.15).toFixed(2);
    case "legs":
      return +(0.22 + raw * 1.16).toFixed(2);
    default:
      return raw;
  }
}

export function conditionOf(rng) {
  return 0.965 + rng() * 0.07;
}

export function nameCreature(genome) {
  const hue = 48 + genome.hue * 102;
  let prefix = "Moss";
  if (hue < 66) prefix = "Sun";
  else if (hue < 84) prefix = "Reed";
  else if (hue < 104) prefix = "Moss";
  else if (hue < 126) prefix = "Fern";
  else prefix = "Tide";

  const candidates = [
    { score: genome.legs, name: "Strider" },
    { score: genome.neck, name: "Reacher" },
    { score: genome.armor, name: "Warden" },
    { score: genome.speed, name: "Darter" },
    { score: genome.bodySize, name: "Grazer" },
    { score: genome.tail, name: "Whisker" },
    { score: genome.crest, name: "Crest" },
    { score: genome.fat, name: "Drifter" },
  ].sort((a, b) => b.score - a.score);
  const suffix = candidates[0].score > 0.58 ? candidates[0].name : "Walker";

  let genus = "Aurelia";
  if (genome.armor > 0.62) genus = "Thoracis";
  else if (genome.neck > 0.68) genus = "Longicollis";
  else if (genome.legs > 0.7) genus = "Cursor";
  else if (genome.bodySize > 0.72) genus = "Titanus";
  else if (genome.speed > 0.72) genus = "Velox";
  else if (genome.bodySize < 0.3) genus = "Pygmaeus";

  const hueName = hue < 70 ? "flavus" : hue < 95 ? "viridis" : hue < 125 ? "prasinus" : "caeruleus";

  return {
    common: `${prefix} ${suffix}`,
    latin: `${genus} ${hueName}`,
  };
}

export function diversity(population) {
  if (population.length < 2) return 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < population.length; i += 1) {
    for (let j = i + 1; j < population.length; j += 1) {
      let d = 0;
      for (const key of GENE_KEYS) {
        d += Math.abs(population[i].genome[key] - population[j].genome[key]);
      }
      sum += d / GENE_KEYS.length;
      count += 1;
    }
  }
  return sum / count;
}

export function rankPopulation(population) {
  return [...population].sort((a, b) => b.evaluation.fitness - a.evaluation.fitness);
}

export function breedPopulation(population, env, rng = Math.random) {
  const ranked = rankPopulation(population);
  const eliteCount = Math.max(2, Math.round(population.length * 0.34));
  const parents = ranked.slice(0, Math.max(3, eliteCount));
  const next = [];

  // A true survivor keeps its exact alleles and becomes the first hatchling.
  next.push({ genome: { ...parents[0].genome }, origin: "elite", changes: [] });

  while (next.length < population.length) {
    const a = weightedParent(parents, rng);
    let b = weightedParent(parents, rng);
    if (parents.length > 1) {
      let guard = 0;
      while (b === a && guard < 8) {
        b = weightedParent(parents, rng);
        guard += 1;
      }
    }
    let genome = a === b ? { ...a.genome } : crossover(a.genome, b.genome, rng);
    const mutation = mutate(genome, rng, next.length === 1 ? 0.08 : 0.18, 0.1);
    genome = mutation.genome;
    next.push({
      genome,
      origin: next.length === 1 ? "elite-mutant" : "offspring",
      changes: mutation.changes,
      parents: [a.id, b.id],
    });
  }

  return next;
}

function weightedParent(parents, rng) {
  const weights = parents.map((p) => Math.pow(Math.max(1, p.evaluation.fitness), 2.4));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < parents.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return parents[i];
  }
  return parents[parents.length - 1];
}

export function describeChange(change) {
  const meta = GENE_META[change.gene];
  const direction = change.delta > 0 ? "+" : "−";
  const value = Math.abs(change.delta);
  let phrase = `${meta.code} shift`;
  if (value > 0.16) phrase = `${meta.code} regulatory leap`;
  else if (value < 0.05) phrase = `${meta.code} micro-variant`;
  return {
    title: `${meta.label} ${direction}${Math.round(value * 100)}%`,
    detail: phrase,
    direction: change.delta > 0 ? "up" : "down",
  };
}

export function pressureOutlook(env) {
  if (env.climate === 0 && env.food === 0) {
    return "Cold and hunger together reward compact, well-insulated bodies with reach. Efficiency is everything.";
  }
  if (env.climate === 2 && env.food === 0) {
    return "Heat and scarcity favor long limbs, light bodies, and low metabolic waste. Small survivors win.";
  }
  if (env.predators === 2) {
    return "Rampant predation makes armor and acceleration decisive. Display structures become liabilities.";
  }
  if (env.food === 0) {
    return "Sparse forage rewards longer necks and longer strides. Heavy bodies must work harder for every calorie.";
  }
  if (env.climate === 0) {
    return "Frigid nights favor bulk and insulation. Long, exposed limbs leak precious heat.";
  }
  if (env.climate === 2) {
    return "Arid air favors small bodies and long limbs that shed heat. Insulation becomes a burden.";
  }
  if (env.food === 2) {
    return "Lush growth supports larger bodies. Competition shifts from reach toward display and defense.";
  }
  if (env.predators === 0) {
    return "Without predators, costly armor and sprinting fade. Selection favors efficient foragers.";
  }
  return "Stable temperatures reward generalists. Predators favor speed and armor.";
}
