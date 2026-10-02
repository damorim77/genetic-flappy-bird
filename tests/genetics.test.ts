import { describe, expect, it } from "vitest";
import {
  clampGene,
  cloneGenome,
  crossoverUniform,
  mutate,
  randomGenome,
  reproduce,
  selectParentTorneio,
} from "../src/lib/genetics";
import { GENE_MAX, GENE_MIN, mulberry32 } from "../src/lib/config";
import type { BirdState, Genome } from "../src/lib/types";

function fakeBird(fitness: number): BirdState {
  return {
    x: 80,
    y: 300,
    vy: 0,
    alive: true,
    fitness,
    genome: randomGenome(mulberry32(fitness + 1)),
  };
}

describe("clampGene", () => {
  it("mantém valores dentro do intervalo [-10, 10]", () => {
    expect(clampGene(5)).toBe(5);
    expect(clampGene(999)).toBe(GENE_MAX);
    expect(clampGene(-999)).toBe(GENE_MIN);
  });
});

describe("randomGenome", () => {
  it("gera 4 genes finitos em [-1, 1]", () => {
    const genome = randomGenome(mulberry32(42));
    for (const v of [genome.geneA, genome.geneB, genome.geneC, genome.geneT]) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe("cloneGenome", () => {
  it("retorna objeto novo com os mesmos valores", () => {
    const genome = randomGenome(mulberry32(9));
    const clone = cloneGenome(genome);
    expect(clone).not.toBe(genome);
    expect(clone).toEqual(genome);
  });
});

describe("mutate", () => {
  it("respeita o clamp [-10, 10] com taxa 100% após 500 mutações", () => {
    const rng = mulberry32(42);
    let genome: Genome = { geneA: 9.9, geneB: -9.9, geneC: 0, geneT: 0 };
    for (let i = 0; i < 500; i++) {
      genome = mutate(genome, 1, rng);
    }
    for (const v of [genome.geneA, genome.geneB, genome.geneC, genome.geneT]) {
      expect(v).toBeLessThanOrEqual(GENE_MAX);
      expect(v).toBeGreaterThanOrEqual(GENE_MIN);
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("com taxa 0 retorna valores idênticos em objeto novo", () => {
    const genome = randomGenome(mulberry32(7));
    const result = mutate(genome, 0, mulberry32(7));
    expect(result).not.toBe(genome);
    expect(result).toEqual(genome);
  });
});

describe("crossoverUniform", () => {
  it("é determinístico com o mesmo seed", () => {
    const p1 = randomGenome(mulberry32(1));
    const p2 = randomGenome(mulberry32(2));
    const a = crossoverUniform(p1, p2, mulberry32(99));
    const b = crossoverUniform(p1, p2, mulberry32(99));
    expect(a).toEqual(b);
  });

  it("herda genes apenas dos pais", () => {
    const p1: Genome = { geneA: 1, geneB: 1, geneC: 1, geneT: 1 };
    const p2: Genome = { geneA: -1, geneB: -1, geneC: -1, geneT: -1 };
    const child = crossoverUniform(p1, p2, mulberry32(5));
    for (const v of [child.geneA, child.geneB, child.geneC, child.geneT]) {
      expect(Math.abs(v)).toBe(1);
    }
  });
});

describe("selectParentTorneio", () => {
  it("retorna um membro da população", () => {
    const pop = [fakeBird(1), fakeBird(5), fakeBird(3)];
    const parent = selectParentTorneio(pop, mulberry32(3));
    expect(pop).toContain(parent);
  });

  it("funciona com população de 1", () => {
    const only = fakeBird(10);
    expect(selectParentTorneio([only], mulberry32(1))).toBe(only);
  });

  it("lança erro com população vazia", () => {
    expect(() => selectParentTorneio([], mulberry32(1))).toThrow();
  });
});

describe("reproduce", () => {
  it("produz genoma válido com 4 genes finitos dentro do clamp", () => {
    const pop = [fakeBird(10), fakeBird(20), fakeBird(30)];
    const child = reproduce(pop, 0.15, mulberry32(11));
    for (const v of [child.geneA, child.geneB, child.geneC, child.geneT]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeLessThanOrEqual(GENE_MAX);
      expect(v).toBeGreaterThanOrEqual(GENE_MIN);
    }
  });
});
