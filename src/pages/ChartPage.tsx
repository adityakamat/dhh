import { useState } from "react";
import { ChartRow } from "../components/ChartRow";
import { ExportPanel } from "../components/ExportPanel";
import { SampleBanner } from "../components/SampleBanner";
import { GENRES } from "../data/genres";
import { rankedTracks, useChart } from "../lib/chart";
import type { GenreId } from "../lib/types";

export function ChartPage() {
  const { chart, error } = useChart();
  const [genre, setGenre] = useState<GenreId | "all">("all");
  const rows = rankedTracks(chart, genre === "all" ? undefined : [genre]).filter((r) => r.entry);
  const label = genre === "all" ? "DHH Top 40" : `DHH Top 40: ${GENRES.find((g) => g.id === genre)!.name}`;

  return (
    <section>
      <h1>
        The DHH Chart {chart && <small>Week {chart.week}</small>}
      </h1>
      <SampleBanner chart={chart} />
      {error && <p className="err">{error}</p>}
      <div className="chips" role="tablist">
        <button className={`chip ${genre === "all" ? "chip--on" : ""}`} onClick={() => setGenre("all")}>
          All
        </button>
        {GENRES.map((g) => (
          <button key={g.id} className={`chip ${genre === g.id ? "chip--on" : ""}`} onClick={() => setGenre(g.id)}>
            {g.name}
          </button>
        ))}
      </div>
      <ExportPanel name={`${label} · ${chart?.week ?? ""}`.trim()} description="The weekly Desi Hip Hop chart, made with DHH." tracks={rows} />
      <ol className="rows">
        {rows.map((r) => (
          <ChartRow key={r.track.id} item={r} />
        ))}
      </ol>
      {!rows.length && chart && <p className="hint">No charting tracks in this genre this week.</p>}
    </section>
  );
}
