import { DEFAULT_CONFIG } from "./config";
import type { SimStats } from "./types";

/**
 * Estado inicial estável para o useState<SimStats> do componente:
 * a Simulation só existe após o useEffect, então o primeiro render (SSR/client)
 * precisa de um snapshot determinístico — sem isso, hydration error.
 */
export const INITIAL_STATS: SimStats = {
  generation: 1,
  alive: DEFAULT_CONFIG.population,
  population: DEFAULT_CONFIG.population,
  bestCurrent: 0,
  bestAllTime: 0,
  bestGenome: { geneA: 0, geneB: 0, geneC: 0, geneT: 0 },
  ticksThisGeneration: 0,
  maxTicksReached: false,
  solvedGeneration: null,
  history: [],
};
