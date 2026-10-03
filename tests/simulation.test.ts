import { describe, expect, it } from "vitest";
import { Simulation } from "../src/lib/engine";
import {
  CORPSE_MAX_FALL,
  DEFAULT_CONFIG,
  GAP_CENTER_MAX,
  GAP_CENTER_MIN,
  mulberry32,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "../src/lib/config";

function avg(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

describe("Simulation — estado inicial", () => {
  it("inicia com população viva e um cano em x = W", () => {
    const sim = new Simulation(mulberry32(42));
    expect(sim.birds).toHaveLength(DEFAULT_CONFIG.population);
    expect(sim.birds.every((b) => b.alive)).toBe(true);
    expect(sim.pipes).toHaveLength(1);
    const pipe = sim.pipes[0];
    expect(pipe?.x).toBe(WORLD_WIDTH);
    if (pipe !== undefined) {
      expect(pipe.gapCenterY).toBeGreaterThanOrEqual(GAP_CENTER_MIN);
      expect(pipe.gapCenterY).toBeLessThanOrEqual(GAP_CENTER_MAX);
    }
  });

  it("reset() reinicia do zero", () => {
    const sim = new Simulation(mulberry32(3));
    for (let i = 0; i < 200; i++) sim.tick();
    sim.reset();
    expect(sim.generation).toBe(1);
    expect(sim.ticksThisGeneration).toBe(0);
    expect(sim.history).toHaveLength(0);
    expect(sim.solvedGeneration).toBeNull();
    expect(sim.maxTicksReached).toBe(false);
    expect(sim.pipes).toHaveLength(1);
    expect(sim.birds.every((b) => b.alive)).toBe(true);
  });
});

describe("Simulation — fim de geração por teto de ticks", () => {
  it("marca maxTicksReached/solvedGeneration e preserva a população", () => {
    const sim = new Simulation(mulberry32(7), {
      ...DEFAULT_CONFIG,
      maxTicksPerGeneration: 10,
    });
    for (let i = 0; i < 60; i++) sim.tick();
    expect(sim.generation).toBe(7);
    expect(sim.solvedGeneration).toBe(1);
    expect(sim.history).toHaveLength(6);
    expect(sim.maxTicksReached).toBe(true);
    expect(sim.birds).toHaveLength(DEFAULT_CONFIG.population);
    expect(sim.birds.every((b) => b.alive)).toBe(true);
  });
});

describe("Simulation — cadáveres (animação de morte)", () => {
  /** Morte forçada do pássaro 0: abaixo do chão no próximo tick. */
  function forceDeath(sim: Simulation): void {
    const bird = sim.birds[0];
    if (bird === undefined) throw new Error("população vazia");
    bird.y = WORLD_HEIGHT - 10;
    bird.vy = 5;
  }

  it("morte cria cadáver com y/vy/colorIndex do pássaro e congela o fitness", () => {
    const sim = new Simulation(mulberry32(11));
    forceDeath(sim);
    sim.tick();

    const bird = sim.birds[0];
    const corpse = sim.corpses[0];
    if (bird === undefined || corpse === undefined) throw new Error("morte não gerou cadáver");
    expect(bird.alive).toBe(false);
    expect(corpse.y).toBe(bird.y);
    expect(corpse.vy).toBe(bird.vy);
    expect(corpse.colorIndex).toBe(bird.colorIndex);
    expect(corpse.fallTicks).toBe(0);

    const fitnessFrozen = bird.fitness;
    const events = sim.drainEvents();
    expect(events.deaths).toBe(1);
    for (let i = 0; i < 3; i++) sim.tick();
    expect(bird.fitness).toBe(fitnessFrozen);
    expect(sim.getStats().alive).toBe(DEFAULT_CONFIG.population - 1);
  });

  it("cadáver acelera com gravidade (teto CORPSE_MAX_FALL) e sai da tela", () => {
    const sim = new Simulation(mulberry32(11));
    forceDeath(sim);
    sim.tick();

    const corpse = sim.corpses[0];
    if (corpse === undefined) throw new Error("morte não gerou cadáver");
    const y0 = corpse.y;
    const vy0 = corpse.vy;

    sim.tick();
    expect(corpse.vy).toBe(Math.min(vy0 + DEFAULT_CONFIG.gravity, CORPSE_MAX_FALL));
    expect(corpse.y).toBe(y0 + corpse.vy);
    expect(corpse.y).toBeGreaterThan(y0);
    expect(corpse.fallTicks).toBe(1);

    // Atravessa o fundo e é removido (nenhuma outra morte natural em ~20 ticks).
    for (let i = 0; i < 20; i++) sim.tick();
    expect(sim.corpses).toHaveLength(0);
    expect(sim.birds.filter((b) => b.alive)).toHaveLength(DEFAULT_CONFIG.population - 1);
  });

  it("evolve() limpa cadáveres ainda em queda (troca de geração)", () => {
    const sim = new Simulation(mulberry32(11), {
      ...DEFAULT_CONFIG,
      maxTicksPerGeneration: 3,
    });
    forceDeath(sim);
    sim.tick();

    const corpse = sim.corpses[0];
    if (corpse === undefined) throw new Error("morte não gerou cadáver");

    // Ainda caindo (não saiu da tela): só existe por causa da geração atual.
    sim.tick();
    expect(sim.generation).toBe(1);
    expect(sim.corpses).toContain(corpse);

    // Estoura o teto → evolve no fim do tick zera a lista.
    sim.tick();
    expect(sim.generation).toBe(2);
    expect(sim.corpses).toHaveLength(0);
  });

  it("reset() limpa cadáveres", () => {
    const sim = new Simulation(mulberry32(11));
    forceDeath(sim);
    sim.tick();
    expect(sim.corpses.length).toBeGreaterThan(0);
    sim.reset();
    expect(sim.corpses).toHaveLength(0);
  });
});

describe("Simulation — evolução (integração 50 gerações × 5 seeds)", () => {
  it(
    "mostra tendência de melhora (média últimas 10 > primeiras 10) em ≥ 4 de 5 seeds",
    () => {
      const seeds = [1, 2, 3, 4, 5];
      let improved = 0;
      for (const seed of seeds) {
        const sim = new Simulation(mulberry32(seed));
        let ticks = 0;
        while (sim.generation <= 50 && ticks < 300_000) {
          sim.tick();
          ticks++;
        }
        const history = sim.history;
        expect(history.length).toBeGreaterThanOrEqual(50);
        const first = avg(history.slice(0, 10));
        const last = avg(history.slice(-10));
        if (last > first) improved++;
      }
      expect(improved).toBeGreaterThanOrEqual(4);
    },
    120_000,
  );
});
