import { GENE_KEYS, GENE_META } from "./genetics.js";

const BASES = ["A", "C", "G", "T"];
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

// Each normalized allele becomes one byte, represented by four two-bit bases.
// This fixed-width encoding keeps archived numeric genomes fully compatible.
export function encodeGenome(genome) {
  const genes = GENE_KEYS.map((key) => {
    const value = clamp01(genome?.[key]);
    const byte = Math.round(value * 255);
    const sequence = [6, 4, 2, 0].map((shift) => BASES[(byte >> shift) & 3]).join("");
    return { key, label: GENE_META[key].label, code: GENE_META[key].code, value, byte, sequence };
  });
  return { genes, sequence: genes.map((gene) => gene.sequence).join("") };
}

export function expressSystems(genome) {
  const g = Object.fromEntries(GENE_KEYS.map((key) => [key, clamp01(genome?.[key])]));
  const combine = (base, terms, interaction = 0) => Math.max(0, Math.min(1,
    base + terms.reduce((sum, [key, weight]) => sum + g[key] * weight, 0) + interaction,
  ));
  return {
    muscle: combine(0.08, [["speed", 0.50], ["bodySize", 0.30]], g.speed * g.bodySize * 0.12),
    bones: combine(0.12, [["bodySize", 0.30], ["legs", 0.20], ["armor", 0.26]], g.bodySize * g.armor * 0.12),
    neurons: combine(0.12, [["speed", 0.30], ["neck", 0.24], ["crest", 0.22]], g.speed * g.neck * 0.08),
    fat: combine(0.06, [["fat", 0.72], ["bodySize", 0.14]], g.fat * g.bodySize * 0.08),
    nerves: combine(0.08, [["speed", 0.30], ["neck", 0.22], ["pattern", 0.18], ["crest", 0.16]]),
    ears: combine(0.08, [["neck", 0.32], ["crest", 0.30], ["pattern", 0.18]]),
    armor: combine(0.04, [["armor", 0.78], ["bodySize", 0.08]], g.armor * g.bodySize * 0.1),
  };
}

// Alleles are regulatory potentials, not literal measurements. Shared pathways,
// allometric scaling, and interactions turn them into a coherent body plan.
export function expressMorphology(genome) {
  const g = Object.fromEntries(GENE_KEYS.map((key) => [key, clamp01(genome?.[key])]));
  const systems = expressSystems(g);
  const size = g.bodySize;
  const sizeScale = 0.82 + size * 0.55;
  const bodyLen = (0.62 + size * 0.62) * (0.92 + size * 0.16);
  const bodyW = (0.19 + size * 0.12 + systems.fat * 0.15) * (0.94 + size * 0.12);
  const bodyH = (0.18 + size * 0.12 + systems.fat * 0.13) * (0.94 + size * 0.12);
  const legLen = (0.53 + g.legs * 0.8) * (0.88 + size * 0.24);
  const neckLen = (0.12 + g.neck) * (0.9 + size * 0.2);
  const tailLen = (0.2 + g.tail * 1.06) * (0.88 + size * 0.24);
  const limbThickness = (0.045 + size * 0.035 + systems.muscle * 0.035)
    * (0.9 + systems.bones * 0.12 + size * 0.08);
  const headScale = 0.14 + size * 0.12 + g.crest * 0.04;

  return {
    sizeScale,
    bodyLen,
    bodyW,
    bodyH,
    legLen,
    neckLen,
    tailLen,
    limbThickness,
    headScale,
    systems,
  };
}

export function analyzeGenome(genome) {
  const encoded = encodeGenome(genome);
  const gcCount = [...encoded.sequence].filter((base) => base === "G" || base === "C").length;
  const morphology = expressMorphology(genome);
  return {
    ...encoded,
    nucleotideCount: encoded.sequence.length,
    gcContent: encoded.sequence.length ? (gcCount / encoded.sequence.length) * 100 : 0,
    systems: morphology.systems,
    morphology,
  };
}
