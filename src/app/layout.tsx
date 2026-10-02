import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Genetic Flappy Bird — Algoritmo Genético",
  description:
    "Simulação interativa de um Algoritmo Genético aprendendo a jogar Flappy Bird com uma equação linear de 4 genes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
