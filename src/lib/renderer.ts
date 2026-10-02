import { BIRD_RADIUS, BIRD_X, GROUND_HEIGHT, WORLD_HEIGHT, WORLD_WIDTH } from "./config";
import type { Simulation } from "./engine";
import type { BirdState } from "./types";

/**
 * Render de 1 frame. Lê a Simulation, nunca muta. Resolução lógica fixa
 * 480x640 — o dPR é aplicado via setTransform no componente, antes do loop.
 */
export function draw(ctx: CanvasRenderingContext2D, sim: Simulation): void {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, "#075985");
  sky.addColorStop(1, "#38bdf8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const floorY = WORLD_HEIGHT - GROUND_HEIGHT;

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

  const alive: BirdState[] = [];
  for (const bird of sim.birds) {
    if (bird.alive) alive.push(bird);
  }
  let best: BirdState | undefined;
  for (const bird of alive) {
    if (best === undefined || bird.fitness > best.fitness) best = bird;
  }

  for (const bird of alive) {
    ctx.beginPath();
    ctx.arc(BIRD_X, bird.y, BIRD_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = bird === best ? "#fb923c" : "#fde047";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#422006";
    ctx.stroke();
  }

  ctx.font = "bold 13px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
  ctx.fillText(
    `Gen ${sim.generation}  |  Vivos ${alive.length}/${sim.config.population}  |  Ticks ${sim.ticksThisGeneration}`,
    8,
    20,
  );
}
