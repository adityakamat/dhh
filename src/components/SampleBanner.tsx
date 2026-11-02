import type { Chart } from "../lib/types";

export function SampleBanner({ chart }: { chart: Chart | null }) {
  if (!chart?.sample) return null;
  return (
    <div className="banner">
      Sample chart: tracks are in catalog order. Add <code>YOUTUBE_API_KEY</code> and run <code>npm run charts</code> for
      real rankings.
    </div>
  );
}
