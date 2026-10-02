/**
 * Carregamento dos sprites (client-only, nunca no SSR).
 *
 * Assets: https://github.com/samuelcust/flappy-bird-assets (MIT, © 2019 Samuel Custodio).
 * Cópia verbatim da licença em /public/LICENSE.
 *
 * Nada aqui é importado pela engine: se o carregamento falhar, o renderer
 * cai no modo formas-planas e a simulação continua funcionando.
 */

export interface SpriteSheet {
  /** Cenário escolhido por reload (day ou night). */
  background: HTMLImageElement;
  /** Faixa de chão com scroll. */
  base: HTMLImageElement;
  /** Cano verde (tampa no TOPO do sprite — ver PIPE_CAP_* no renderer). */
  pipe: HTMLImageElement;
  /** 3 frames de batida, na ordem up -> mid -> down. */
  yellowBird: readonly [HTMLImageElement, HTMLImageElement, HTMLImageElement];
  blueBird: readonly [HTMLImageElement, HTMLImageElement, HTMLImageElement];
  redBird: readonly [HTMLImageElement, HTMLImageElement, HTMLImageElement];
}

const SPRITE_DIR = "/sprites";

const BACKGROUND_DAY = `${SPRITE_DIR}/background-day.png`;
const BACKGROUND_NIGHT = `${SPRITE_DIR}/background-night.png`;
const BASE = `${SPRITE_DIR}/base.png`;
const PIPE = `${SPRITE_DIR}/pipe-green.png`;
const YELLOW = [
  `${SPRITE_DIR}/yellowbird-upflap.png`,
  `${SPRITE_DIR}/yellowbird-midflap.png`,
  `${SPRITE_DIR}/yellowbird-downflap.png`,
] as const;
const BLUE = [
  `${SPRITE_DIR}/bluebird-upflap.png`,
  `${SPRITE_DIR}/bluebird-midflap.png`,
  `${SPRITE_DIR}/bluebird-downflap.png`,
] as const;
const RED = [
  `${SPRITE_DIR}/redbird-upflap.png`,
  `${SPRITE_DIR}/redbird-midflap.png`,
  `${SPRITE_DIR}/redbird-downflap.png`,
] as const;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar sprite: ${src}`));
    img.src = src;
  });
}

/**
 * Pré-carrega todos os sprites. O cenário é sorteado a cada reload
 * (injetável para teste determinístico).
 * Rejeita se qualquer imagem falhar — o chamador decide o fallback.
 */
export function loadSprites(rng: () => number = Math.random): Promise<SpriteSheet> {
  const background = rng() < 0.5 ? BACKGROUND_DAY : BACKGROUND_NIGHT;
  return Promise.all([
    loadImage(background),
    loadImage(BASE),
    loadImage(PIPE),
    loadImage(YELLOW[0]),
    loadImage(YELLOW[1]),
    loadImage(YELLOW[2]),
    loadImage(BLUE[0]),
    loadImage(BLUE[1]),
    loadImage(BLUE[2]),
    loadImage(RED[0]),
    loadImage(RED[1]),
    loadImage(RED[2]),
  ]).then(([bg, base, pipe, yUp, yMid, yDown, bUp, bMid, bDown, rUp, rMid, rDown]) => ({
    background: bg,
    base,
    pipe,
    yellowBird: [yUp, yMid, yDown],
    blueBird: [bUp, bMid, bDown],
    redBird: [rUp, rMid, rDown],
  }));
}
