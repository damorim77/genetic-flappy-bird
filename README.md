# Genetic Flappy Bird

Simulação interativa de um Algoritmo Genético aprendendo a jogar Flappy Bird — Next.js (App Router) + Canvas 2D + TypeScript puro. Sem bibliotecas de física, sem redes neurais.

## Como o pássaro "pensa"

Cada pássaro decide pular avaliando uma **equação linear** cujos 4 coeficientes são seus genes (iniciados em `[-1, 1]`, clampados em `[-10, 10]`):

```text
inputX    = (distância X até o próximo cano) / largura do mundo
inputY    = (altura do pássaro - centro do gap) / altura do mundo
inputVel = velocidade Y / velocidade terminal

resultado = inputX·geneA + inputY·geneB + inputVel·geneC
pula se resultado > geneT
```

## Evolução

- **Fitness** = ticks sobrevividos (+ tiebreak fracionário ≤ 0,5 pela proximidade do gap na morte)
- **Seleção** por torneio k=3, **elitismo** top-1, **2 imigrantes** aleatórios por geração
- **Crossover** uniforme por gene, **mutação** default 15% por gene (ruído ±0,2, com clamp)
- Geração termina quando todos morrem **ou** em 5000 ticks (`maxTicksPerGeneration`)

## Controles

- Taxa de mutação (1–20%), Velocidade (1–20x, acumulador de passo fixo independente do monitor)
- Pausar/Retomar (sem fast-forward ao despausar), Reiniciar do Zero
- Som (desligado por padrão — o clique no botão é o gesto que libera o áudio)
- Sparkline do melhor fitness por geração

## Visual e áudio

- Sprites (pássaros amarelo/azul, cano, chão e cenário) e efeitos sonoros (wing, hit, point, die) do repositório [`samuelcust/flappy-bird-assets`](https://github.com/samuelcust/flappy-bird-assets), sob licença **MIT** — © 2019 Samuel Custódio. Cópia verbatim da licença em [`public/LICENSE`](public/LICENSE).
- O cenário (dia/noite) é sorteado a cada reload. O pássaro drawing usa o sprite nativo 34x24, com rotação proporcional à velocidade Y.
- Se os sprites não carregarem, o renderer cai automaticamente no modo formas-planas — a simulação nunca depende dos assets.

## Nota de comportamento

Depois que a evolução **resolve** (uma geração atinge o teto de 5000 ticks), cada geração seguinte em que o elite sobrevive consome os 5000 ticks — ~83s a 1x, ~4s a 20x. Comportamento esperado, não bug.

## Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest (unit + integração 50 gerações × 5 seeds)
npm run lint       # eslint .
npm run typecheck  # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm run build      # next build (deploy: Vercel)
```

O plano completo de implementação está em [`docs/PLAN.md`](docs/PLAN.md).
