# AGENTS.md

## Fontes da verdade

- `docs/PLAN.md` — decisões fechadas com o usuário (contratos TS, constantes, ciclos, regras Next/Vercel). Ler antes de mexer em `engine.ts`/`genetics.ts`/`renderer.ts`/loop.
- `README.md` — padrão olist-mcp, em PT-BR. Documentação, UI e mensagens de commit são em **PT-BR** (prefixos `feat:`/`fix:`/`docs:`).

## Comandos

```powershell
npm run typecheck     # tsc --noEmit
npm test              # vitest run — 15 testes, ~6s
npm run lint          # eslint .   (Next 16 não tem `next lint`)
npm run build         # derruba com erro de tipo, não roda lint
```

- Ordem antes de commit: `typecheck → test → lint → build`.
- Teste único: `npx vitest run tests/genetics.test.ts`.

## Git / deploy

- **Nunca commitar, push ou deploy sem pedido explícito do usuário.**
- Push para o GitHub **não deploya**: `vercel --prod --yes` é manual e o alias é `https://genetic-flappy-bird.vercel.app`.
- `.playwright-mcp/` é scratch de gravação (gitignored).

## Restrições que nunca afrouxar

- `tsconfig.json`: `strict` + `noUncheckedIndexedAccess` desde o scaffold; zero `any`, zero cast de escape (`as X`) — só guard de `undefined` explícito.
- `src/lib/*` é 100% puro (sem React/DOM); RNG **injetado** (`type Rng = () => number`) — nunca `Math.random` direto em `genetics.ts`/`Simulation` (testes dependem de seed).
- `Simulation.tick()` calcula `nextPipe` **1× por tick** e reusa nos 100 cérebros — não refazer `find()` por pássaro.
- `page.tsx` (Server Component) com import direto do simulador — **nunca** `next/dynamic(..., { ssr: false })` (quebra o build).
- `Simulation` é instanciada **dentro** do `useEffect` com cleanup sobre a instância local (StrictMode monta 2× em dev); nada de `window`/`document` fora de `useEffect`.
- Loop: rAF único + acumulador (`STEP_MS`, teto `MAX_TICKS_PER_FRAME`), pausa não acumula `acc`; constantes só em `src/lib/config.ts`.

## Sprites e renderer

- Assets MIT (`@samuelcust/flappy-bird-assets`) fixos em `public/sprites` e `public/audio` — não remover nem trocar; créditos/licença em `public/LICENSE`.
- Métricas do `pipe-green.png` (52×320) vivem em `renderer.ts` (`PIPE_CAP_SRC_H`, `PIPE_BODY_SRC_X=2`, `PIPE_BODY_SRC_Y=24`): corpo+largura da tampa = 60px = largura de colisão.
- Flip do cano de baixo é `translate(0, y1)` — `translate(0, y1 + y0)` já foi bug (cano fora do canvas, morte "no nada").
- Cor do pássaro: `colorIndex` sorteado 1× no nascimento (imutável), **sem** destaque de elite.
- `renderer.ts` e áudio não têm teste — validar manualmente no browser após mudar desenho.

## Testes

- Só `tests/**/*.test.ts` (Vitest, `environment: node`).
- `tests/simulation.test.ts` = integração 50 gerações × 5 seeds (≥4 com tendência). Mudança no GA precisa mantê-lo verde.
- `renderer`/`assets`/`audio` são client-only e não entram nos testes.

## Gotchas

- `docs/` não é servido pelo Next: `/docs/assets/demo.gif` dá 404 no site (esperado — GIF só renderiza no README do GitHub).
- Fundo dia/noite é sorteado por reload; áudio começa mudo (autoplay) e só toca após o toggle do usuário.
