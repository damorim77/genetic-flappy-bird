import { cloneGenome, randomGenome, reproduce } from "./genetics";
import {
  BIRD_RADIUS,
  BIRD_START_Y,
  BIRD_X,
  CORPSE_MAX_FALL,
  DEFAULT_CONFIG,
  GAP_MARGIN,
  GROUND_HEIGHT,
  HISTORY_WINDOW,
  MAX_GAP_DELTA,
  MAX_MUTATION_RATE,
  MAX_SPEED,
  MIN_MUTATION_RATE,
  MIN_SPEED,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./config";
import type { BirdState, CorpseState, Genome, PipeState, Rng, SimConfig, SimEvents, SimStats } from "./types";

export class Simulation {
  readonly rng: Rng;
  readonly config: SimConfig;
  generation = 1;
  ticksThisGeneration = 0;
  bestAllTime = 0;
  bestGenome: Genome = { geneA: 0, geneB: 0, geneC: 0, geneT: 0 };
  solvedGeneration: number | null = null;
  maxTicksReached = false;
  history: number[] = [];
  /** Pixels percorridos pelos canos desde o reset — só render (scroll do chão). */
  distance = 0;
  birds: BirdState[] = [];
  /** Cadáveres em queda (animação da morte): fora do GA, limpos no evolve/reset. */
  corpses: CorpseState[] = [];
  pipes: PipeState[] = [];
  private mutationRate: number;
  private speedMultiplier: number;
  private nextPipeId = 0;
  private events: SimEvents = { jumps: 0, deaths: 0, pipesPassed: 0, generations: 0 };

  constructor(rng: Rng = Math.random, config: SimConfig = DEFAULT_CONFIG) {
    this.rng = rng;
    this.config = { ...config };
    this.mutationRate = config.mutationRate;
    this.speedMultiplier = config.speedMultiplier;
    this.reset();
  }

  reset(): void {
    this.generation = 1;
    this.ticksThisGeneration = 0;
    this.bestAllTime = 0;
    this.bestGenome = { geneA: 0, geneB: 0, geneC: 0, geneT: 0 };
    this.solvedGeneration = null;
    this.maxTicksReached = false;
    this.history = [];
    this.distance = 0;
    this.corpses = [];
    this.events = { jumps: 0, deaths: 0, pipesPassed: 0, generations: 0 };
    const genomes: Genome[] = [];
    for (let i = 0; i < this.config.population; i++) {
      genomes.push(randomGenome(this.rng));
    }
    this.initBirds(genomes);
    this.initPipes();
  }

  setMutationRate(rate: number): void {
    this.mutationRate = Math.min(MAX_MUTATION_RATE, Math.max(MIN_MUTATION_RATE, rate));
  }

  setSpeedMultiplier(speed: number): void {
    this.speedMultiplier = Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(speed)));
  }

  getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  /**
   * Um tick lógico (1/60s). Ordem pinada: cérebro -> física (pássaros,
   * cadáveres + canos) -> colisão -> fitness. Mortos no tick não pontuam;
   * recebem apenas o tiebreak.
   */
  tick(): void {
    const nextPipe = this.pipes.find((p) => p.x + p.width + BIRD_RADIUS > BIRD_X);
    if (!nextPipe) return;

    const { gravity, jumpVelocity, maxFallSpeed, pipeSpeed, pipeSpacingPx } = this.config;

    for (const bird of this.birds) {
      if (!bird.alive) continue;
      const inputX = (nextPipe.x - BIRD_X) / WORLD_WIDTH;
      const inputY = (bird.y - nextPipe.gapCenterY) / WORLD_HEIGHT;
      const inputVel = bird.vy / maxFallSpeed;
      const result =
        inputX * bird.genome.geneA +
        inputY * bird.genome.geneB +
        inputVel * bird.genome.geneC;
      if (result > bird.genome.geneT) {
        bird.vy = jumpVelocity;
        this.events.jumps += 1;
      }
    }

    for (const bird of this.birds) {
      if (!bird.alive) continue;
      bird.vy = Math.min(bird.vy + gravity, maxFallSpeed);
      bird.y += bird.vy;
    }

    this.updateCorpses();

    this.distance += pipeSpeed;
    for (const pipe of this.pipes) {
      pipe.x -= pipeSpeed;
    }
    const lastPipe = this.pipes[this.pipes.length - 1];
    if (lastPipe !== undefined && lastPipe.x < WORLD_WIDTH - pipeSpacingPx) {
      this.pipes.push(this.makePipe(WORLD_WIDTH, lastPipe.gapCenterY));
    }
    this.pipes = this.pipes.filter((p) => {
      // Cano que já saiu inteiro da tela = um "ponto" do flock (1x por cano).
      if (p.x + p.width <= 0) this.events.pipesPassed += 1;
      return p.x + p.width > 0;
    });

    const floorY = WORLD_HEIGHT - GROUND_HEIGHT;
    let aliveCount = 0;
    for (const bird of this.birds) {
      if (!bird.alive) continue;
      const birdTop = bird.y - BIRD_RADIUS;
      const birdBottom = bird.y + BIRD_RADIUS;
      let dead = birdTop < 0 || birdBottom > floorY;
      if (!dead) {
        for (const pipe of this.pipes) {
          if (BIRD_X + BIRD_RADIUS > pipe.x && BIRD_X - BIRD_RADIUS < pipe.x + pipe.width) {
            const gapTop = pipe.gapCenterY - pipe.gapH / 2;
            const gapBottom = pipe.gapCenterY + pipe.gapH / 2;
            if (birdTop < gapTop || birdBottom > gapBottom) {
              dead = true;
              break;
            }
          }
        }
      }
      if (dead) {
        bird.alive = false;
        this.events.deaths += 1;
        bird.fitness +=
          Math.max(0, 1 - Math.abs(bird.y - nextPipe.gapCenterY) / WORLD_HEIGHT) * 0.5;
        this.corpses.push({
          y: bird.y,
          vy: bird.vy,
          colorIndex: bird.colorIndex,
          fallTicks: 0,
        });
      } else {
        bird.fitness += 1;
        aliveCount += 1;
      }
    }

    this.ticksThisGeneration += 1;
    if (aliveCount === 0 || this.ticksThisGeneration >= this.config.maxTicksPerGeneration) {
      this.evolve();
    }
  }

  /** Snapshot somente-leitura para a UI (bestGenome clonado, history limitado à janela). */
  getStats(): SimStats {
    let alive = 0;
    let bestCurrent = 0;
    for (const bird of this.birds) {
      if (bird.alive) alive += 1;
      if (bird.fitness > bestCurrent) bestCurrent = bird.fitness;
    }
    return {
      generation: this.generation,
      alive,
      population: this.config.population,
      bestCurrent,
      bestAllTime: this.bestAllTime,
      bestGenome: cloneGenome(this.bestGenome),
      ticksThisGeneration: this.ticksThisGeneration,
      maxTicksReached: this.maxTicksReached,
      solvedGeneration: this.solvedGeneration,
      history: this.history.slice(-HISTORY_WINDOW),
    };
  }

  /**
   * Lê e zera os contadores de eventos. A UI drena 1x por frame; a engine
   * permanece pura (nada de DOM/áudio aqui dentro).
   */
  drainEvents(): SimEvents {
    const drained = this.events;
    this.events = { jumps: 0, deaths: 0, pipesPassed: 0, generations: 0 };
    return drained;
  }

  /**
   * Física dos cadáveres: queda com gravidade até sair inteiro da tela.
   * Não consome rng nem toca fitness/eventos — determinismo do GA intacto.
   */
  private updateCorpses(): void {
    const { gravity } = this.config;
    const exitY = WORLD_HEIGHT + BIRD_RADIUS * 2;
    for (const corpse of this.corpses) {
      corpse.vy = Math.min(corpse.vy + gravity, CORPSE_MAX_FALL);
      corpse.y += corpse.vy;
      corpse.fallTicks += 1;
    }
    this.corpses = this.corpses.filter((c) => c.y <= exitY);
  }

  private evolve(): void {
    const endedByMaxTicks = this.ticksThisGeneration >= this.config.maxTicksPerGeneration;
    const endedGeneration = this.generation;

    let bestBird: BirdState | undefined;
    for (const bird of this.birds) {
      if (bestBird === undefined || bird.fitness > bestBird.fitness) bestBird = bird;
    }
    const best = bestBird !== undefined ? bestBird.fitness : 0;
    this.history.push(best);
    if (best > this.bestAllTime) {
      this.bestAllTime = best;
      if (bestBird !== undefined) this.bestGenome = cloneGenome(bestBird.genome);
    }

    const sorted = [...this.birds].sort((a, b) => b.fitness - a.fitness);
    const genomes: Genome[] = [];
    for (let i = 0; i < this.config.eliteCount && i < sorted.length; i++) {
      const elite = sorted[i];
      if (elite !== undefined) genomes.push(cloneGenome(elite.genome));
    }
    for (let i = 0; i < this.config.immigrantCount && genomes.length < this.config.population; i++) {
      genomes.push(randomGenome(this.rng));
    }
    while (genomes.length < this.config.population) {
      genomes.push(reproduce(sorted, this.mutationRate, this.rng));
    }

    this.generation += 1;
    this.ticksThisGeneration = 0;
    this.corpses = [];
    this.events.generations += 1;
    this.maxTicksReached = endedByMaxTicks;
    if (endedByMaxTicks && this.solvedGeneration === null) {
      this.solvedGeneration = endedGeneration;
    }
    this.initBirds(genomes);
    this.initPipes();
  }

  private initBirds(genomes: Genome[]): void {
    this.birds = genomes.map((genome) => ({
      x: BIRD_X,
      y: BIRD_START_Y,
      vy: 0,
      alive: true,
      colorIndex: Math.floor(this.rng() * 3),
      fitness: 0,
      genome,
    }));
  }

  private initPipes(): void {
    this.pipes = [this.makePipe(WORLD_WIDTH)];
  }

  private makePipe(x: number, prevCenter?: number): PipeState {
    const min = GAP_MARGIN + this.config.gapH / 2;
    const max = WORLD_HEIGHT - GROUND_HEIGHT - GAP_MARGIN - this.config.gapH / 2;
    const center =
      prevCenter === undefined
        ? min + this.rng() * (max - min)
        : Math.min(max, Math.max(min, prevCenter + (this.rng() * 2 - 1) * MAX_GAP_DELTA));
    return {
      id: this.nextPipeId++,
      x,
      gapCenterY: center,
      gapH: this.config.gapH,
      width: this.config.pipeWidth,
    };
  }
}
