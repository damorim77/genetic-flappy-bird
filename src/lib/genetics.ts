import {
  GENE_INIT_MAX,
  GENE_INIT_MIN,
  GENE_MAX,
  GENE_MIN,
  MUTATION_NOISE,
  TOURNAMENT_SIZE,
} from "./config";
import type { BirdState, GeneKey, Genome, Rng } from "./types";

const GENE_KEYS: readonly GeneKey[] = ["geneA", "geneB", "geneC", "geneT"];

/** Garante que um coeficiente nunca saia do intervalo seguro [-10, 10]. */
export function clampGene(value: number, min: number = GENE_MIN, max: number = GENE_MAX): number {
  return Math.min(max, Math.max(min, value));
}

/** Valor aleatório em [min, max) via rng injetado. */
function randomInRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Genoma aleatório da geração 0 (genes em -1..1). */
export function randomGenome(rng: Rng): Genome {
  return {
    geneA: randomInRange(rng, GENE_INIT_MIN, GENE_INIT_MAX),
    geneB: randomInRange(rng, GENE_INIT_MIN, GENE_INIT_MAX),
    geneC: randomInRange(rng, GENE_INIT_MIN, GENE_INIT_MAX),
    geneT: randomInRange(rng, GENE_INIT_MIN, GENE_INIT_MAX),
  };
}

/** Cópia profunda de um genoma (evita compartilhar referência entre elite/filhos). */
export function cloneGenome(genome: Genome): Genome {
  return { geneA: genome.geneA, geneB: genome.geneB, geneC: genome.geneC, geneT: genome.geneT };
}

/**
 * Seleção por Torneio: sorteia k candidatos (via rng) e retorna o de maior fitness.
 * Robusto a fitness zerado na geração 0 (sem divisão por zero como na roleta).
 */
export function selectParentTorneio(
  population: BirdState[],
  rng: Rng,
  k: number = TOURNAMENT_SIZE,
): BirdState {
  if (population.length === 0) {
    throw new Error("selectParentTorneio: população vazia.");
  }
  let best: BirdState | undefined = population[Math.floor(rng() * population.length)];
  for (let i = 1; i < k; i++) {
    const candidate: BirdState | undefined = population[Math.floor(rng() * population.length)];
    if (candidate !== undefined && (best === undefined || candidate.fitness > best.fitness)) {
      best = candidate;
    }
  }
  if (best === undefined) {
    throw new Error("selectParentTorneio: falha ao amostrar a população.");
  }
  return best;
}

/** Crossover uniforme: cada gene do filho vem aleatoriamente (rng) do pai1 ou pai2. */
export function crossoverUniform(parent1: Genome, parent2: Genome, rng: Rng): Genome {
  const child: Genome = cloneGenome(parent1);
  for (const key of GENE_KEYS) {
    child[key] = rng() < 0.5 ? parent1[key] : parent2[key];
  }
  return child;
}

/**
 * Mutação por gene: com probabilidade `mutationRate` por gene (via rng),
 * soma ruído uniforme em [-MUTATION_NOISE, +MUTATION_NOISE] e aplica
 * clamp em [GENE_MIN, GENE_MAX] para impedir explosão dos coeficientes.
 */
export function mutate(genome: Genome, mutationRate: number, rng: Rng): Genome {
  const result: Genome = cloneGenome(genome);
  for (const key of GENE_KEYS) {
    if (rng() < mutationRate) {
      const noise: number = rng() * (MUTATION_NOISE * 2) - MUTATION_NOISE;
      result[key] = clampGene(result[key] + noise);
    }
  }
  return result;
}

/** Cria um filho: torneio x2 + crossover + mutação com clamp (tudo via rng). */
export function reproduce(population: BirdState[], mutationRate: number, rng: Rng): Genome {
  const parent1: BirdState = selectParentTorneio(population, rng);
  const parent2: BirdState = selectParentTorneio(population, rng);
  const child: Genome = crossoverUniform(parent1.genome, parent2.genome, rng);
  return mutate(child, mutationRate, rng);
}
