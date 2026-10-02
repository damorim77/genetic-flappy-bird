"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ControlPanel from "@/components/ControlPanel";
import { Simulation } from "@/lib/engine";
import { draw } from "@/lib/renderer";
import { INITIAL_STATS } from "@/lib/initialStats";
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
  const pausedRef = useRef(false);
  const [stats, setStats] = useState<SimStats>(INITIAL_STATS);
  const [paused, setPaused] = useState(false);
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

    let raf = 0;
    let frame = 0;
    let acc = 0;
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
      draw(ctx, sim);
      if (++frame % 10 === 0) setStats(sim.getStats());
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
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
        mutationPct={mutationPct}
        speed={speed}
        onTogglePause={togglePause}
        onReset={reset}
        onMutationChange={changeMutation}
        onSpeedChange={changeSpeed}
      />
    </div>
  );
}
