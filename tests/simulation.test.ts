import { describe, expect, it } from "vitest";
import { Simulation } from "../src/lib/engine";
import {
  DEFAULT_CONFIG,
  GAP_CENTER_MAX,
  GAP_CENTER_MIN,
  mulberry32,
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
