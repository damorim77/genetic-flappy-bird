import GeneticFlappySimulator from "@/components/GeneticFlappySimulator";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-8 px-4 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Genetic Flappy Bird</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">
          100 pássaros aprendem a jogar por evolução. O cérebro de cada um é uma equação linear com
          4 genes — distância, altura relativa, velocidade e limiar — refinada por torneio,
          crossover e mutação. Sem redes neurais, sem bibliotecas de física.
        </p>
      </header>
      <GeneticFlappySimulator />
    </main>
  );
}
