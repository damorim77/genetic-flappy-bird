# Plano de Implementação — Genetic Flappy Bird

> Stack: Next.js (App Router, TypeScript strict) + Tailwind + Canvas 2D nativo. Sem libs de física/ML. Testes com Vitest.

## 0. Decisões fechadas com o usuário

- **Seleção: Torneio k=3** (em vez de Roleta).
- **Velocidade máxima: 20x** com passo fixo via **acumulador de tempo** (nunca acelerar o rAF; velocidade independe do monitor). **Pausa não acumula `acc`** (sem fast-forward ao despausar).
- **Entradas normalizadas** em ~[-1, 1] — sem isso `geneT` é irrelevante.
- **Mutação default: 15%** + **2 imigrantes aleatórios/geração** (com 5%, 0,95⁴ ≈ 81% dos filhos nasceriam sem mutação).
- **`MAX_TICKS_PER_GENERATION = 5000`** + `maxTicksReached` **por geração** (evolução continua) + `solvedGeneration` guardando a 1ª ocorrência (UI: "resolvido na geração N").
- **PRNG com seed** injetado em `genetics.ts`/`Simulation` (`type Rng = () => number`) — zero `Math.random` direto no domínio.
- **Layout de pastas: tudo em `src/`** (`src/app`, `src/components`, `src/lib`), alias `@/* → ./src/*`.
- **`page.tsx` faz import direto** do simulador (sem `next/dynamic ssr:false`, que quebra build em Server Component no App Router).
- **Lint via `eslint .`** (Next 16 removeu `next lint`; `next build` não roda mais lint, mas erros de tipo ainda derrubam o build).
- **TypeScript com `"strict": true` + `"noUncheckedIndexedAccess": true`** ligados no scaffold e nunca desligados; zero `any`, zero casts de escape (guards de `undefined` explícitos).
- **Canvas responsivo por CSS** (`w-full max-w-[480px] aspect-[3/4]`); resolução lógica fixa 480×640, dPR só no render.

## 1. Contexto e Objetivo

Componente React (Next.js) que renderiza uma simulação interativa de Algoritmo Genético aprendendo a jogar um clone de Flappy Bird. Renderização via Canvas API nativa. Física + GA em TypeScript puro. O aprendizado emerge da evolução de uma equação linear simples (4 genes).

## 2. Arquitetura geral

- **Engine + GA 100% isolados do React** em classes/funções puras em `src/lib/`.
- React apenas: instancia a simulação, desenha via `renderer`, espelha stats com throttle, envia comandos (mutação, velocidade, pausar, reiniciar).
- Resolução lógica fixa: `480x640` (física determinística). dPR tratado só no render.
- Client-only na prática (Canvas + rAF só dentro de `useEffect`); **sem `next/dynamic`**.
- **StrictMode (dev) monta o efeito 2×:** a `Simulation` é construída dentro do `useEffect` e o cleanup cancela o rAF — o ciclo do loop fecha sobre a instância **local do efeito**, não sobre `simRef`, garantindo que o 2º mount use instância nova e o 1º morra limpo.

```
src/app/page.tsx                          -> Server Component, import DIRETO do simulador (sem dynamic)
src/components/GeneticFlappySimulator.tsx -> 'use client', canvasRef + loop acumulador + throttle useState
src/components/ControlPanel.tsx           -> sliders + botões + stats + sparkline + aviso (presentational)
src/lib/types.ts                          -> Genome, BirdState, PipeState, SimStats, SimConfig, Rng, GeneKey
src/lib/config.ts                         -> física + GA + cenário + limites de genes (todos os valores definidos)
src/lib/genetics.ts                       -> randomGenome, clampGene, torneio, crossover, mutate, reproduce (rng injetado)
src/lib/engine.ts                         -> classe Simulation(rng): birds, pipes, tick(), evolve(), history
src/lib/renderer.ts                       -> draw(ctx, simulation) puro, sem estado React
tests/genetics.test.ts                    -> unit: clamp, crossover com seed, torneio, mutação
tests/simulation.test.ts                  -> integração: 50 gerações × 5 seeds, tendência em ≥4
```

## 3. Contratos TypeScript (build da Vercel não pode falhar)

```ts
export type Rng = () => number; // injetado em genetics/Simulation (Math.random no browser, seed nos testes)

export interface Genome { geneA: number; geneB: number; geneC: number; geneT: number; }

export interface BirdState { x: number; y: number; vy: number; alive: boolean; fitness: number; genome: Genome; }

/** gapCenterY = CENTRO vertical do gap (convenção única p/ colisão, render e margens). */
export interface PipeState { id: number; x: number; gapCenterY: number; gapH: number; width: number; }

export interface SimStats {
  generation: number;
  alive: number;
  population: number;
  bestCurrent: number;
  bestAllTime: number;
  bestGenome: Genome; // sempre um CLONE (estado React nunca segura referência viva)
  /** Ticks da geração ATUAL (reset no evolve); compara com maxTicksPerGeneration. */
  ticksThisGeneration: number;
  /** Por geração: true quando atingiu maxTicksPerGeneration (nome honesto; UI diz "resolvido"). */
  maxTicksReached: boolean;
  /** Primeira geração que atingiu o teto, ou null (sobrevive a re-renders; fica na Simulation). */
  solvedGeneration: number | null;
  /** Melhor fitness de cada geração (sparkline no painel). */
  history: readonly number[];
}

export interface SimConfig {
  population: number; gravity: number; jumpVelocity: number; maxFallSpeed: number;
  pipeSpeed: number; pipeWidth: number; gapH: number; pipeSpacingPx: number;
  mutationRate: number; speedMultiplier: number; eliteCount: number;
  maxTicksPerGeneration: number; immigrantCount: number;
}

export type GeneKey = keyof Genome;
```

Regras: zero `any`; zero casts de escape (`as PipeState`) — guards de nulidade; `noUncheckedIndexedAccess` ligado; `canvas.getContext('2d')` com null-check; `useRef<HTMLCanvasElement | null>(null)`, `useRef<Simulation | null>(null)`, `useRef<number>(0)` p/ rAF; `useState<SimStats>` inicializado com **`INITIAL_STATS` constante** (primeiro render SSR determinístico — sem hydration error).

## 4. Física e Ambiente (Engine no Canvas)

Constantes (todas definidas em `src/lib/config.ts` — nada implícito, sem prosa ambígua):

| Parâmetro | Valor |
|---|---|
| `WORLD_WIDTH` | `480` |
| `WORLD_HEIGHT` | `640` |
| `GROUND_HEIGHT` | `80` |
| `BIRD_X` | `80` (posição X fixa de todos os pássaros) |
| `BIRD_RADIUS` | `10` |
| `BIRD_START_Y` | `300` |
| `gravity` | `0.5` |
| `jumpVelocity` | `-8` |
| `maxFallSpeed` | `10` |
| `pipeSpeed` | `2.5` px/tick |
| `pipeWidth` | `60` |
| `gapH` (fixo) | `150` |
| `pipeSpacingPx` | `220` |
| `population` | `100` |
| `mutationRate` inicial | `0.15` (15%) |
| `eliteCount` | `1` (autoritativo — vale o `SimConfig`) |
| `immigrantCount` | `2` genomas aleatórios/geração |
| `maxTicksPerGeneration` | `5000` (~56 canos; ao atingir, força `evolve()` + `maxTicksReached = true`) |
| `GAP_MARGIN` | `80` |
| `MAX_GAP_DELTA` | `200` de variação máxima do centro entre canos consecutivos |
| **`GAP_CENTER_MIN`** | **`155`** (`GAP_MARGIN + gapH/2 = 80 + 75`) — constante, não prosa |
| **`GAP_CENTER_MAX`** | **`405`** (`(H - GROUND_HEIGHT) - GAP_MARGIN - gapH/2 = 560 - 80 - 75`) |

- **Pássaros:** círculos com `vy += gravity` clampado em `maxFallSpeed`; `pular()` = `vy = jumpVelocity`.
- **Canos:** retângulos que andam `x -= pipeSpeed`; `gapCenterY = clamp(prev ± rng() * MAX_GAP_DELTA, GAP_CENTER_MIN, GAP_CENTER_MAX)` (1º cano: uniforme em `[GAP_CENTER_MIN, GAP_CENTER_MAX]`); `gapH` fixo. Spawna novo quando `lastPipe.x < W - spacing`; remove quando `x < -width`. `reset()` garante **um cano inicial em `x = W`** para nunca haver tick sem alvo.
- **Colisão (tudo com raio, por consistência):** teto = `y - BIRD_RADIUS < 0`; chão = `y + BIRD_RADIUS > H - GROUND_HEIGHT`; canos = AABB do bounding box do círculo vs rects acima/abaixo de `gapCenterY ± gapH/2` → `alive = false`.
- **Fitness:** `fitness++` por tick **sobrevivido** (mortos no tick não pontuam). **Tiebreak na morte:** `+ Math.max(0, 1 - Math.abs(bird.y - gapCenterYNaMorte) / WORLD_HEIGHT) + ...`, mais precisamente:
  ```ts
  const deathBonus = killRef.gapCenterY === undefined ? 0
    : Math.max(0, 1 - Math.abs(bird.y - killRef.gapCenterY) / WORLD_HEIGHT) * 0.5;
  ```
  Referência: **`nextPipe.gapCenterY` no tick da morte** (mesmo alvo do cérebro); se não houver cano (morte no teto/chão sem cano), bônus = 0. Clamp obrigatório — sem ele a fração fica negativa em mortes longe do gap. Desempata a geração 0; fração ∈ [0, 0,5].

## 5. Cérebro do Agente (DNA — equação linear, sem rede neural)

Genoma: 4 floats; geração 0 em `rng() * 2 - 1` (−1..1 — **apenas `rng`, nunca `Math.random` direto**).

- `geneA`: peso da distância X normalizada.
- `geneB`: peso da distância Y relativa normalizada.
- `geneC`: peso da velocidade Y normalizada.
- `geneT`: limiar de ativação.

**`nextPipe` computado 1x por tick** (todos os pássaros em `BIRD_X` → alvo idêntico; o `tick()` resolve uma vez, centraliza o guard e passa a referência aos cérebros — remove 99 `find()` por tick):

```ts
// dentro de Simulation.tick(), antes dos cérebros:
const nextPipe = this.pipes.find(p => p.x + p.width + BIRD_RADIUS > BIRD_X);
if (!nextPipe) return; // guarda strict — reset garante cano inicial, isto é defesa
// por pássaro vivo:
const inputX = (nextPipe.x - BIRD_X) / WORLD_WIDTH;   // ~[-0.15, 0.83]: negativo dentro do cano
const inputY = (bird.y - nextPipe.gapCenterY) / WORLD_HEIGHT; // ~[-1, 1]
const inputVel = bird.vy / maxFallSpeed;              // ~[-0.8, 1]
const result = inputX * geneA + inputY * geneB + inputVel * geneC;
if (result > geneT) bird.vy = JUMP_VELOCITY;
```

**Definição de `nextPipe`:** primeiro cano com `x + width + BIRD_RADIUS > bird.x`. Sem o `BIRD_RADIUS`, o alvo troca quando o *centro* passa da borda enquanto o corpo ainda toca o cano por ~5 ticks — o pássaro raspa ao perseguir o próximo gap. (Obs.: o máximo ~0,83, não 1, porque o cano nasce em `x = W = 480` e o pássaro está em 80: `(480-80)/480 ≈ 0.83`.)

## 6. Algoritmo Genético (ciclo evolutivo) — Torneio

Local: `src/lib/genetics.ts` (funções puras, todas recebendo `rng: Rng`, retornando objetos novos — genomas imutáveis na prática) + `Simulation.evolve()`.

- **Fim de geração:** quando `alive === 0` **OU** `ticksThisGeneration >= maxTicksPerGeneration`. No segundo caso: `maxTicksReached = true` para a geração e, se for a 1ª ocorrência, `solvedGeneration = generation`. A evolução **continua** (documentado: após resolver, cada geração com elite vivo consome 5000 ticks — ~83s a 1x, ~4s a 20x).
- **Elitismo:** top-`eliteCount` por fitness passam intactos (clone, sem mutação) — `eliteCount` do `SimConfig` (default 1).
- **Imigrantes:** `immigrantCount` (default 2) genomas aleatórios por geração.
- **Seleção (Torneio k=3):**

```ts
export function selectParentTorneio(population: BirdState[], rng: Rng, k: number = TOURNAMENT_SIZE): BirdState {
  if (population.length === 0) throw new Error("população vazia");
  let best: BirdState | undefined = population[Math.floor(rng() * population.length)];
  for (let i = 1; i < k; i++) {
    const candidate = population[Math.floor(rng() * population.length)];
    if (candidate !== undefined && (best === undefined || candidate.fitness > best.fitness)) best = candidate;
  }
  if (best === undefined) throw new Error("falha ao amostrar");
  return best;
}
```

Guards explícitos (compatível com `noUncheckedIndexedAccess`, zero casts).

- **Crossover uniforme por gene:** `crossoverUniform(pai1, pai2, rng)`. Permite `pai1 === pai2`.
- **Mutação por gene:** `mutate(genome, mutationRate, rng)` — com prob. `mutationRate` (slider 1–20%, default 15%): `gene += (rng() * 0.4 - 0.2)` **seguido de clamp em `[-10, 10]`** via `clampGene()` (anti-explosão de coeficientes).
- Após evoluir: `history.push(bestCurrent)`; reseta birds/pipes (cano inicial garantido), `ticksThisGeneration = 0`, `maxTicksReached = false`, `generation++`, atualiza `bestAllTime`.

## 7. Game Loop — 20x com passo fixo e render separado

Acumulador de tempo com passo fixo (independe do monitor). **Pausa não acumula** `acc` (bug de fast-forward ao despausar — corrigido no scaffold). `draw` 1x por frame sempre:

```ts
const STEP = STEP_MS; // 1000/60 — 1 tick lógico = 1/60s
let acc = 0; let last = performance.now();
const loop = (now: number) => {
  const dt = Math.min(now - last, 100); // clamp anti-espiral
  last = now;
  if (!pausedRef.current) acc += dt * sim.speedMultiplier; // PAUSADO: não acumula
  let n = 0;
  while (acc >= STEP && n < MAX_TICKS_PER_FRAME) { sim.tick(); acc -= STEP; n++; } // teto: 60
  if (n === MAX_TICKS_PER_FRAME) acc = 0; // descarta atraso excedente
  draw(ctx, sim); // 1x por frame, sempre
  if (++frame % 10 === 0) setStats(sim.getStats()); // throttle React
  raf = requestAnimationFrame(loop);
};
```

Garantias:

- `Simulation.tick()` sem `ctx` (puro, testável em Node com seed).
- `renderer.draw(ctx, sim)` só lê e desenha.
- Carga a 20x: 100 pássaros × 20 ticks = 2.000 updates/frame — folga.
- `setSpeedMultiplier`/`setMutationRate` via `simRef` (sem recriar sim, sem `useState` por tick).
- `Pausar` = `pausedRef.current = true`. `Reiniciar` = `sim.reset()` (genes aleatórios, `generation = 0`, `history = []`, `solvedGeneration = null`).

## 8. Interface React (Tailwind)

`ControlPanel` presentational recebe `stats: SimStats` (estado inicial: `INITIAL_STATS`) + callbacks:

- **Stats (throttled):** Geração, Vivos/Total, Melhor da geração, Recorde histórico, mini-viz dos 4 genes do campeão. **Aviso "Resolvido na geração N"** a partir de `solvedGeneration`.
- **Sparkline de fitness** (`history`) em SVG inline, sem lib — o recibo visual da evolução.
- **Sliders:** Mutação 1–20% (step 0.5%, default 15%), Velocidade 1–20x (step 1x).
- **Botões:** Pausar/Retomar, Reiniciar.
- **Layout:** `flex-col lg:flex-row`; canvas com `className="w-full max-w-[480px] aspect-[3/4]"` (responsivo — viewport de 375px não estoura); painel `w-full lg:w-80`. HUD no Canvas (sem re-render).
- **Isolamento React:** sim mutável em `useRef`; `useState` só para stats a cada 10 frames, com `INITIAL_STATS`; `getStats()` devolve `bestGenome` **clonado**.

## 9. Compatibilidade Next.js + Vercel (regras rígidas)

1. Componente simulador com `'use client'`.
2. Instanciar simulação e acessar `canvasRef` **só dentro de `useEffect`** (StrictMode instancia 2× em dev: loop fecha sobre a instância local do efeito; cleanup mata a 1ª).
3. `src/app/page.tsx` (Server Component) com **import direto** — **NÃO usar `next/dynamic(..., { ssr: false })`** (quebra o build: "`ssr: false` is not allowed"). Canvas/rAF só no `useEffect` + `INITIAL_STATS` ⇒ SSR determinístico, `dynamic` desnecessário.
4. Cleanup obrigatório: `return () => cancelAnimationFrame(raf)`.
5. Nenhum acesso a `window`/`document` fora de `useEffect`/handlers.
6. `tsc --noEmit` + `eslint .` + `next build` antes do push. Next 16: `next lint` não existe; `next build` não roda lint; type-check ainda derruba o build.
7. `tsconfig`: `"strict": true` + `"noUncheckedIndexedAccess": true` desde o scaffold.

## 10. Fases de execução

1. Scaffold: `create-next-app` **com diretório `src/`** (TS + Tailwind + App Router + ESLint), tsconfig com `noUncheckedIndexedAccess`, script `"lint": "eslint ."`, `next build` baseline.
2. `types.ts + config.ts + genetics.ts` (rng injetado, `gapCenterY`, `GAP_CENTER_MIN/MAX`, defaults 15%/5000/2 imigrantes). ✅ feito.
3. `engine.ts (Simulation)` + **Vitest**: unit de `genetics.ts` (clamp, crossover determinístico com seed, torneio, mutação) + integração **50 gerações × 5 seeds, ≥ 4 com tendência** (média do best das últimas 10 > primeira 10). Só `bestAllTime` é monotônico. Custo trivial (1ªs gerações morrem em dezenas de ticks).
4. `renderer.ts` (fundo, pipes, birds vivos + elite destacado, chão/teto).
5. `GeneticFlappySimulator.tsx + ControlPanel.tsx + page.tsx` (import direto; sparkline SVG).
6. Validação: `vitest run`, `tsc --noEmit`, `eslint .`, `next build`, 100 birds @20x estável a 60Hz e 144Hz, pausar/retomar sem fast-forward, troca de rota sem leak.
7. README (equação linear explicada + GIF da evolução) e deploy Vercel.

## 11. Critérios de aceite

- [ ] 100 pássaros, genes −1..1 na geração 0 (via `rng`), equação linear com entradas normalizadas decide o pulo; `nextPipe` computado 1x por tick com guarda strict.
- [ ] Colisão com cano/teto/chão usando `gapCenterY` e raio em todos os limites; fitness = ticks sobrevividos + tiebreak clampado [0, 0,5] referenciado em `nextPipe.gapCenterY` no tick da morte.
- [ ] Elitismo via `eliteCount` + Torneio k=3 + crossover uniforme + mutação (default 15%, clamp [-10, 10]) + 2 imigrantes/geração.
- [ ] Fim de geração por `alive === 0` ou 5000 ticks; `maxTicksReached` por geração; `solvedGeneration` persistido; evolução continua; "resolvido na geração N" na UI.
- [ ] Slider 1–20x via acumulador (`STEP = 1000/60`, teto 60 ticks/frame) + 1 `draw` por frame; **pausa não acumula `acc`**; rAF único com cleanup; independente do monitor.
- [ ] Stats com `INITIAL_STATS` + throttle; `bestGenome` clonado; sparkline `history` no painel.
- [ ] Vitest: unit de genetics verde + integração 50×5 com ≥4 seeds em tendência.
- [ ] `tsc --strict --noUncheckedIndexedAccess` + `eslint .` + `next build` verdes; zero `any`/casts; sem hydration error (StrictMode ok); sem leak de rAF.
- [ ] Layout `src/` consistente (nenhum import `@/src/...`); canvas responsivo (`aspect-[3/4]`, `max-w-[480px]`).
- [ ] README documenta pós-solve lento a 1x (~5000 ticks/geração) como comportamento esperado.
