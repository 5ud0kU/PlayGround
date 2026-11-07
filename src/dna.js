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
  const combine = (base, terms) => Math.max(0, Math.min(1, base + terms.reduce((sum, [key, weight]) => sum + g[key] * weight, 0)));
  return {
    muscle: combine(0.08, [["speed", 0.58], ["bodySize", 0.34]]),
    bones: combine(0.12, [["bodySize", 0.34], ["legs", 0.24], ["armor", 0.30]]),
    neurons: combine(0.12, [["speed", 0.34], ["neck", 0.26], ["crest", 0.28]]),
    fat: combine(0.06, [["fat", 0.78], ["bodySize", 0.16]]),
    nerves: combine(0.08, [["speed", 0.34], ["neck", 0.24], ["pattern", 0.22], ["crest", 0.20]]),
    ears: combine(0.08, [["neck", 0.36], ["crest", 0.34], ["pattern", 0.22]]),
  };
}

export function analyzeGenome(genome) {
  const encoded = encodeGenome(genome);
  const gcCount = [...encoded.sequence].filter((base) => base === "G" || base === "C").length;
  const systems = expressSystems(genome);
  return {
    ...encoded,
    basePairs: encoded.sequence.length,
    gcContent: encoded.sequence.length ? (gcCount / encoded.sequence.length) * 100 : 0,
    systems,
  };
}
