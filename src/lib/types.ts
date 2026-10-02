/**
 * Contratos centrais da simulação Genetic Flappy Bird.
 * Tipos puros — sem dependência de React, Canvas ou Next.js —
 * para que a engine possa ser testada em Node e o build da Vercel
 * permaneça com tipagem rigorosa (zero `any`, zero casts de escape).
 */

/** Fonte de aleatoriedade injetável: Math.random no browser, PRNG com seed nos testes. */
export type Rng = () => number;

/** DNA de um pássaro: coeficientes da equação linear de decisão. */
export interface Genome {
  /** Peso da distância X (normalizada) até o próximo cano. */
  geneA: number;
  /** Peso da distância Y relativa (normalizada) ao centro do gap. */
  geneB: number;
  /** Peso da velocidade Y normalizada. */
  geneC: number;
  /** Limiar de ativação do pulo. */
  geneT: number;
}

/** Estado mutável de um pássaro na simulação. */
export interface BirdState {
  x: number;
  y: number;
  vy: number;
  alive: boolean;
  /** Ticks sobrevividos + tiebreak fracionário [0, 0.5] na morte. */
  fitness: number;
  genome: Genome;
}

/** Estado mutável de um cano (obstáculo). */
export interface PipeState {
  id: number;
  x: number;
  /** CENTRO vertical do gap — convenção única p/ colisão, render e margens. */
  gapCenterY: number;
  /** Altura do gap (fixa por config). */
  gapH: number;
  width: number;
}

/** Snapshot somente-leitura para a UI React (atualizado com throttle). */
export interface SimStats {
  generation: number;
  alive: number;
  population: number;
  bestCurrent: number;
  bestAllTime: number;
  /** Sempre um CLONE — estado React nunca segura referência viva. */
  bestGenome: Genome;
  /** Ticks da geração ATUAL (reset no evolve); compara com maxTicksPerGeneration. */
  ticksThisGeneration: number;
  /** Por geração: true quando atingiu maxTicksPerGeneration (nome honesto; UI diz "resolvido"). */
  maxTicksReached: boolean;
  /** Primeira geração que atingiu o teto, ou null. */
  solvedGeneration: number | null;
  /** Melhor fitness de cada geração (sparkline no painel). */
  history: readonly number[];
}

/** Parâmetros de física + GA controláveis pela UI. */
export interface SimConfig {
  population: number;
  gravity: number;
  jumpVelocity: number;
  maxFallSpeed: number;
  pipeSpeed: number;
  pipeWidth: number;
  gapH: number;
  pipeSpacingPx: number;
  /** 0.01 .. 0.20 (slider 1%–20%, default 15%). */
  mutationRate: number;
  /** 1 .. 20 (ticks lógicos por STEP de 1/60s). */
  speedMultiplier: number;
  /** Quantos melhores passam intactos (clone, sem mutação). */
  eliteCount: number;
  /** Teto de ticks por geração: evita pássaro perfeito nunca morrer. */
  maxTicksPerGeneration: number;
  /** Genomas aleatórios por geração para manter diversidade. */
  immigrantCount: number;
}

/** Chaves dos genes, útil para crossover/mutação genéricos. */
export type GeneKey = keyof Genome;
