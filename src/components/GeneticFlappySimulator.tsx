"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ControlPanel from "@/components/ControlPanel";
import { Simulation } from "@/lib/engine";
import { draw } from "@/lib/renderer";
import { INITIAL_STATS } from "@/lib/initialStats";
import { loadSprites, type SpriteSheet } from "@/lib/assets";
import { AudioManager } from "@/lib/audio";
import {
  DEFAULT_CONFIG,
  MAX_TICKS_PER_FRAME,
  STEP_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@/lib/config";
import type { SimStats } from "@/lib/types";

export default function GeneticFlappySimulator() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<Simulation | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const pausedRef = useRef(false);
  const [stats, setStats] = useState<SimStats>(INITIAL_STATS);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [mutationPct, setMutationPct] = useState(Math.round(DEFAULT_CONFIG.mutationRate * 100));
  const [speed, setSpeed] = useState(DEFAULT_CONFIG.speedMultiplier);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = WORLD_WIDTH * dpr;
    canvas.height = WORLD_HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sim = new Simulation(Math.random);
    simRef.current = sim;
    const audio = new AudioManager();
    audioRef.current = audio;

    let disposed = false;
    let raf = 0;
    let frame = 0;
    let acc = 0;

    const start = (sprites: SpriteSheet | null) => {
      if (disposed) return;
      let last = performance.now();

      const loop = (now: number) => {
        const dt = Math.min(now - last, 100);
        last = now;
        if (!pausedRef.current) acc += dt * sim.getSpeedMultiplier();
        let n = 0;
        while (acc >= STEP_MS && n < MAX_TICKS_PER_FRAME) {
          sim.tick();
          acc -= STEP_MS;
          n++;
        }
        if (n === MAX_TICKS_PER_FRAME) acc = 0;

        const events = sim.drainEvents();
        audio.play("wing", events.jumps);
        audio.play("hit", events.deaths);
        audio.play("point", events.pipesPassed);
        audio.play("die", events.generations);

        draw(ctx, sim, sprites);
        if (++frame % 10 === 0) setStats(sim.getStats());
        raf = requestAnimationFrame(loop);
      };

      raf = requestAnimationFrame(loop);
    };

    // Cenário sorteado por reload; se os sprites falharem, roda em formas-planas.
    loadSprites()
      .then(start)
      .catch(() => start(null));

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      audioRef.current = null;
    };
  }, []);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      audioRef.current?.setEnabled(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    simRef.current?.reset();
    setStats(INITIAL_STATS);
  }, []);

  const changeMutation = useCallback((pct: number) => {
    setMutationPct(pct);
    simRef.current?.setMutationRate(pct / 100);
  }, []);

  const changeSpeed = useCallback((value: number) => {
    setSpeed(value);
    simRef.current?.setSpeedMultiplier(value);
  }, []);

  return (
    <div className="flex w-full flex-col items-start gap-6 lg:flex-row">
      <canvas
        ref={canvasRef}
        aria-label="Canvas da simulação do algoritmo genético jogando Flappy Bird"
        className="aspect-[3/4] w-full max-w-[480px] rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
      />
      <ControlPanel
        stats={stats}
        paused={paused}
        soundOn={soundOn}
        mutationPct={mutationPct}
        speed={speed}
        onTogglePause={togglePause}
        onToggleSound={toggleSound}
        onReset={reset}
        onMutationChange={changeMutation}
        onSpeedChange={changeSpeed}
      />
    </div>
  );
}
