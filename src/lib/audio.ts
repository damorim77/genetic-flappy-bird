/**
 * Efeitos sonoros (client-only, nunca no SSR).
 *
 * Assets: https://github.com/samuelcust/flappy-bird-assets (MIT, © 2019 Samuel Custodio).
 *
 * Regras:
 * - começa DESLIGADO (browsers bloqueiam autoplay; o toggle é o gesto do usuário);
 * - pool de elementos por som, então 100 pássaros batendo as asas não corta o áudio;
 * - cooldown por som em tempo real, porque a 20x os eventos chegam em rajada.
 */

export type SoundName = "wing" | "hit" | "point" | "die";

const SOUND_FILES: Record<SoundName, string> = {
  wing: "/audio/wing.ogg",
  hit: "/audio/hit.ogg",
  point: "/audio/point.ogg",
  die: "/audio/die.ogg",
};

/** Intervalo mínimo entre duas execuções do MESMO som (ms). */
const MIN_INTERVAL_MS: Record<SoundName, number> = {
  wing: 140,
  hit: 70,
  point: 90,
  die: 250,
};

const POOL_SIZE = 3;

export class AudioManager {
  private enabled = false;
  private readonly pools = new Map<SoundName, HTMLAudioElement[]>();
  private readonly nextIndex = new Map<SoundName, number>();
  private readonly lastPlayedAt = new Map<SoundName, number>();

  constructor() {
    for (const name of Object.keys(SOUND_FILES) as SoundName[]) {
      const pool: HTMLAudioElement[] = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        const el = new Audio(SOUND_FILES[name]);
        el.preload = "auto";
        el.volume = 0.35;
        pool.push(el);
      }
      this.pools.set(name, pool);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Toca o som uma vez, respeitando o cooldown. `occurrences` só serve para
   * ignorar rajadas (ex.: 80 pulos no mesmo frame → 1 som).
   */
  play(name: SoundName, occurrences = 1): void {
    if (!this.enabled || occurrences <= 0) return;
    const now = performance.now();
    const last = this.lastPlayedAt.get(name) ?? Number.NEGATIVE_INFINITY;
    if (now - last < MIN_INTERVAL_MS[name]) return;
    this.lastPlayedAt.set(name, now);

    const pool = this.pools.get(name);
    if (pool === undefined || pool.length === 0) return;
    const index = this.nextIndex.get(name) ?? 0;
    this.nextIndex.set(name, index + 1);
    const el = pool[index % pool.length];
    if (el === undefined) return;
    el.currentTime = 0;
    el.play().catch(() => {
      // Sem gesto do usuário ou autoplay bloqueado: silencioso, sem crash.
    });
  }
}
