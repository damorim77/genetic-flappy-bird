"use client";

import type { SimStats } from "@/lib/types";

interface ControlPanelProps {
  stats: SimStats;
  paused: boolean;
  mutationPct: number;
  speed: number;
  onTogglePause: () => void;
  onReset: () => void;
  onMutationChange: (pct: number) => void;
  onSpeedChange: (value: number) => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800/70 px-3 py-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-slate-100">{value}</div>
    </div>
  );
}

function Sparkline({ data }: { data: readonly number[] }) {
  const visible = data.slice(-200);
  if (visible.length < 2) {
    return (
      <div className="grid h-16 w-full place-items-center rounded-lg bg-slate-800/70 text-xs text-slate-500">
        Aguardando gerações…
      </div>
    );
  }
  const w = 288;
  const h = 64;
  const max = Math.max(...visible);
  const safeMax = max > 0 ? max : 1;
  const points = visible
    .map((v, i) => `${(i / (visible.length - 1)) * w},${h - 2 - (v / safeMax) * (h - 6)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-16 w-full rounded-lg bg-slate-800/70"
      role="img"
      aria-label="Melhor fitness por geração"
    >
      <polyline points={points} fill="none" stroke="#34d399" strokeWidth="2" />
    </svg>
  );
}

export default function ControlPanel({
  stats,
  paused,
  mutationPct,
  speed,
  onTogglePause,
  onReset,
  onMutationChange,
  onSpeedChange,
}: ControlPanelProps) {
  return (
    <aside className="flex w-full flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 lg:w-80">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Geração" value={String(stats.generation)} />
        <Stat label="Vivos" value={`${stats.alive}/${stats.population}`} />
        <Stat label="Melhor (geração)" value={String(Math.floor(stats.bestCurrent))} />
        <Stat label="Recorde" value={String(Math.floor(stats.bestAllTime))} />
      </div>

      {stats.solvedGeneration !== null && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">
          Resolvido na geração {stats.solvedGeneration} — evolução continua
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">Fitness por geração</span>
          <span className="text-xs text-slate-500">{stats.history.length} gens</span>
        </div>
        <Sparkline data={stats.history} />
      </div>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        <span className="flex justify-between">
          Taxa de mutação
          <span className="font-semibold tabular-nums">{mutationPct}%</span>
        </span>
        <input
          type="range"
          min={1}
          max={20}
          step={0.5}
          value={mutationPct}
          onChange={(e) => onMutationChange(parseFloat(e.target.value))}
          className="accent-emerald-400"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        <span className="flex justify-between">
          Velocidade
          <span className="font-semibold tabular-nums">{speed}x</span>
        </span>
        <input
          type="range"
          min={1}
          max={20}
          step={1}
          value={speed}
          onChange={(e) => onSpeedChange(parseInt(e.target.value, 10))}
          className="accent-emerald-400"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onTogglePause}
          className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          {paused ? "Retomar" : "Pausar"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-red-500 hover:text-red-400"
        >
          Reiniciar do Zero
        </button>
      </div>
    </aside>
  );
}
