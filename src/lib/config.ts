import type { Rng, SimConfig } from "./types";

/** Dimensões lógicas fixas do canvas (física determinística). */
export const WORLD_WIDTH = 480;
export const WORLD_HEIGHT = 640;
export const GROUND_HEIGHT = 80;
export const BIRD_X = 80;
export const BIRD_RADIUS = 10;
export const BIRD_START_Y = 300;

/** Limite de ticks por geração: ~56 canos a 2.5px/tick. Evita geração infinita. */
export const MAX_TICKS_PER_GENERATION = 5000;

/** Cenário: margens do centro do gap e variação máxima entre canos consecutivos. */
export const GAP_MARGIN = 80;
export const MAX_GAP_DELTA = 200;

/**
 * Intervalo do CENTRO do gap (constantes exatas, sem prosa):
 * MIN = GAP_MARGIN + gapH/2 = 80 + 75 = 155
 * MAX = (WORLD_HEIGHT - GROUND_HEIGHT) - GAP_MARGIN - gapH/2 = 560 - 80 - 75 = 405
 * (gapH default = 150; a Simulation calcula a partir de config.gapH se mudar.)
 */
export const GAP_CENTER_MIN = 155;
export const GAP_CENTER_MAX = 405;

/** Limites do genoma. */
export const GENE_MIN = -10;
export const GENE_MAX = 10;
/** Faixa de inicialização da geração 0. */
export const GENE_INIT_MIN = -1;
export const GENE_INIT_MAX = 1;
/** Amplitude do ruído de mutação: gene += (rng() * 0.4 - 0.2). */
export const MUTATION_NOISE = 0.2;

/** GA. */
export const TOURNAMENT_SIZE = 3;
export const IMMIGRANT_COUNT = 2;
export const MIN_MUTATION_RATE = 0.01;
export const MAX_MUTATION_RATE = 0.2;
export const MIN_SPEED = 1;
export const MAX_SPEED = 20;

/** Game loop (render): passo lógico fixo e teto anti-espiral por frame. */
export const STEP_MS = 1000 / 60;
export const MAX_TICKS_PER_FRAME = 60;

/** Janela do histórico exposto em getStats() para a sparkline (limita cópia por frame). */
export const HISTORY_WINDOW = 200;

/**
 * PRNG com seed (mulberry32) para testes headless reproduzíveis.
 * No browser a Simulation usa Math.random por padrão.
 */
export function mulberry32(seed: number): Rng {
  let state: number = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t: number = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_CONFIG: SimConfig = {
  population: 100,
  gravity: 0.5,
  jumpVelocity: -8,
  maxFallSpeed: 10,
  pipeSpeed: 2.5,
  pipeWidth: 60,
  gapH: 150,
  pipeSpacingPx: 220,
  mutationRate: 0.15,
  speedMultiplier: 1,
  eliteCount: 1,
  maxTicksPerGeneration: MAX_TICKS_PER_GENERATION,
  immigrantCount: IMMIGRANT_COUNT,
};
