import { BIRD_RADIUS, BIRD_X, GROUND_HEIGHT, WORLD_HEIGHT, WORLD_WIDTH } from "./config";
import type { Simulation } from "./engine";
import type { SpriteSheet } from "./assets";
import type { BirdState } from "./types";

/** Tamanho nativo do sprite do pássaro (34x24) — mantido 1:1 por decisão de design. */
const BIRD_W = 34;
const BIRD_H = 24;
/** Ticks por frame de batida de asa (o original cicla ~a cada 5 frames). */
const FLAP_TICKS = 5;
/** Inclinação máxima por velocidade extrema (±40°). */
const MAX_TILT = 0.7;

/**
 * Métricas medidas do sprite pipe-green.png (52x320):
 * tampa nas linhas 0..23 (52 de largura) e corpo nas linhas 24..319 (48 de largura).
 * Slicing por fonte mantém a escala — nada de cano esticado.
 */
const PIPE_CAP_SRC_H = 24;
const PIPE_BODY_SRC_Y = 24;
const PIPE_BODY_SRC_W = 48;
const PIPE_BODY_SRC_H = 296;

/**
 * Render de 1 frame. Lê a Simulation, nunca muta. Resolução lógica fixa
 * 480x640 — o dPR é aplicado via setTransform no componente, antes do loop.
 * `sprites === null` (assets indisponíveis) cai no modo formas-planas.
 */
export function draw(
  ctx: CanvasRenderingContext2D,
  sim: Simulation,
  sprites: SpriteSheet | null = null,
): void {
  const floorY = WORLD_HEIGHT - GROUND_HEIGHT;

  const alive: BirdState[] = [];
  for (const bird of sim.birds) {
    if (bird.alive) alive.push(bird);
  }
  let best: BirdState | undefined;
  for (const bird of alive) {
    if (best === undefined || bird.fitness > best.fitness) best = bird;
  }

  if (sprites === null) {
    drawFlatWorld(ctx, sim, floorY);
    drawFlatBirds(ctx, alive, best, sim);
  } else {
    drawSpriteWorld(ctx, sprites, sim, floorY);
    drawSpriteBirds(ctx, sprites, alive, best, sim);
  }

  ctx.font = "bold 13px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
  ctx.fillText(
    `Gen ${sim.generation}  |  Vivos ${alive.length}/${sim.config.population}  |  Ticks ${sim.ticksThisGeneration}`,
    8,
    20,
  );
}

/* ---------------------------------------------------------------- sprites */

function drawSpriteWorld(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteSheet,
  sim: Simulation,
  floorY: number,
): void {
  ctx.drawImage(sprites.background, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  for (const pipe of sim.pipes) {
    const gapTop = pipe.gapCenterY - pipe.gapH / 2;
    const gapBottom = pipe.gapCenterY + pipe.gapH / 2;
    // A tampa (a parte mais larga) fica no TOPO da imagem:
    // - cano de BAIXO: tampa virada para o gap (no y0) → desenha sem flip (flip=false);
    // - cano de CIMA: tampa junto ao gap (no y1) → espelha vertical (flip=true).
    drawPipeSegment(ctx, sprites.pipe, pipe.x, 0, gapTop, pipe.width, true);
    drawPipeSegment(ctx, sprites.pipe, pipe.x, gapBottom, floorY, pipe.width, false);
  }

  const base = sprites.base;
  const scaleY = GROUND_HEIGHT / base.naturalHeight;
  const tileW = base.naturalWidth * scaleY;
  const offset = sim.distance % tileW;
  for (let x = -offset; x < WORLD_WIDTH; x += tileW) {
    ctx.drawImage(base, x, floorY, tileW, GROUND_HEIGHT);
  }
}

/**
 * Desenha um trecho vertical de cano em [y0, y1). Em coords locais a tampa
 * sai sempre no topo do trecho; `flip` espelha para que a tampa vá ao y1
 * (cano de cima). Corpo e tampa ocupam a largura TOTAL (`width`) — mesma
 * coluna da física: nada de borda "invisível" em volta do cano.
 */
function drawPipeSegment(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y0: number,
  y1: number,
  width: number,
  flip: boolean,
): void {
  const height = y1 - y0;
  if (height <= 0) return;

  // Escala vertical de referência: corpo 48 -> width (60).
  const scaleY = width / PIPE_BODY_SRC_W;
  const capH = Math.min(height, PIPE_CAP_SRC_H * scaleY);
  const bodyChunk = PIPE_BODY_SRC_H * scaleY;

  ctx.save();
  if (flip) {
    // OK: y_local ∈ [0, height] -> y_canvas ∈ [y1, y0] (espelhado dentro do trecho).
    ctx.translate(0, y1);
    ctx.scale(1, -1);
  } else {
    ctx.translate(0, y0);
  }

  ctx.drawImage(img, 0, 0, img.naturalWidth, PIPE_CAP_SRC_H, x, 0, width, capH);

  let filled = capH;
  while (filled < height) {
    const destChunk = Math.min(bodyChunk, height - filled);
    ctx.drawImage(
      img,
      0,
      PIPE_BODY_SRC_Y,
      PIPE_BODY_SRC_W,
      destChunk / scaleY,
      x,
      filled,
      width,
      destChunk,
    );
    filled += destChunk;
  }
  ctx.restore();
}

function drawSpriteBirds(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteSheet,
  alive: BirdState[],
  best: BirdState | undefined,
  sim: Simulation,
): void {
  const frame = Math.floor(sim.ticksThisGeneration / FLAP_TICKS) % 3;
  const maxFall = sim.config.maxFallSpeed;

  for (const bird of alive) {
    const isBest = bird === best;
    if (isBest) {
      // Halo para o campeão da geração se achar no meio dos 100.
      ctx.beginPath();
      ctx.arc(BIRD_X, bird.y, BIRD_RADIUS + 7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(253, 224, 71, 0.35)";
      ctx.fill();
    }
    const img = (isBest ? sprites.blueBird[frame] : sprites.yellowBird[frame]) ?? undefined;
    const tilt = Math.max(-1, Math.min(1, bird.vy / maxFall)) * MAX_TILT;
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(tilt);
    if (img !== undefined) {
      ctx.drawImage(img, -BIRD_W / 2, -BIRD_H / 2, BIRD_W, BIRD_H);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = isBest ? "#60a5fa" : "#fde047";
      ctx.fill();
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------- modo formas-planas */

function drawFlatWorld(ctx: CanvasRenderingContext2D, sim: Simulation, floorY: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, "#075985");
  sky.addColorStop(1, "#38bdf8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.fillStyle = "#22c55e";
  ctx.strokeStyle = "#166534";
  ctx.lineWidth = 2;
  for (const pipe of sim.pipes) {
    const gapTop = pipe.gapCenterY - pipe.gapH / 2;
    const gapBottom = pipe.gapCenterY + pipe.gapH / 2;
    ctx.fillRect(pipe.x, 0, pipe.width, gapTop);
    ctx.strokeRect(pipe.x + 1, 1, pipe.width - 2, gapTop - 2);
    ctx.fillRect(pipe.x, gapBottom, pipe.width, floorY - gapBottom);
    ctx.strokeRect(pipe.x + 1, gapBottom + 1, pipe.width - 2, floorY - gapBottom - 2);
  }

  ctx.fillStyle = "#78350f";
  ctx.fillRect(0, floorY, WORLD_WIDTH, GROUND_HEIGHT);
  ctx.fillStyle = "#854d0e";
  ctx.fillRect(0, floorY, WORLD_WIDTH, 8);
}

function drawFlatBirds(
  ctx: CanvasRenderingContext2D,
  alive: BirdState[],
  best: BirdState | undefined,
  sim: Simulation,
): void {
  const maxFall = sim.config.maxFallSpeed;
  for (const bird of alive) {
    const tilt = Math.max(-1, Math.min(1, bird.vy / maxFall)) * MAX_TILT;
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = bird === best ? "#fb923c" : "#fde047";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#422006";
    ctx.stroke();
    ctx.restore();
  }
}
