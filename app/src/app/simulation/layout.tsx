import type { Metadata } from "next";

// Unlisted: reachable by URL, not linked from the app or indexed.
export const metadata: Metadata = { title: "Simulation", robots: { index: false, follow: false } };

export default function SimulationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
