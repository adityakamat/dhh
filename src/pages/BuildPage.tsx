import { useMemo, useState } from "react";
import { ChartRow } from "../components/ChartRow";
import { ExportPanel } from "../components/ExportPanel";
import { GENRES, genreById } from "../data/genres";
import { rankedTracks, useChart, type RankedTrack } from "../lib/chart";
import type { GenreId } from "../lib/types";

type Order = "chart" | "newest" | "shuffle";

function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function BuildPage() {
  const { chart } = useChart();
  const [genres, setGenres] = useState<GenreId[]>(["gully"]);
  const [order, setOrder] = useState<Order>("chart");
  const [size, setSize] = useState(25);
  const [seed, setSeed] = useState(1);

  const tracks = useMemo(() => {
    let rows: RankedTrack[] = rankedTracks(chart, genres);
    if (order === "newest") rows = [...rows].sort((a, b) => (b.track.year ?? 0) - (a.track.year ?? 0));
    if (order === "shuffle") rows = shuffle(rows, seed);
    return rows.slice(0, size);
  }, [chart, genres, order, size, seed]);

  const toggle = (g: GenreId) => setGenres((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  const name = `DHH · ${genres.map((g) => genreById[g].name).join(" + ") || "Mix"}`;

  return (
    <section>
      <h1>Build a playlist</h1>
      <h3>Genres</h3>
      <div className="chips">
        {GENRES.map((g) => (
          <button key={g.id} className={`chip ${genres.includes(g.id) ? "chip--on" : ""}`} style={{ ["--c" as string]: g.color }} onClick={() => toggle(g.id)}>
            {g.name}
          </button>
        ))}
      </div>
      <div className="controls">
        <label>
          Order
          <select value={order} onChange={(e) => setOrder(e.target.value as Order)}>
            <option value="chart">Chart rank</option>
            <option value="newest">Newest first</option>
            <option value="shuffle">Shuffle</option>
          </select>
        </label>
        {order === "shuffle" && <button className="btn btn--ghost" onClick={() => setSeed((s) => s + 1)}>Reshuffle</button>}
        <label>
          Length
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} tracks
              </option>
            ))}
          </select>
        </label>
      </div>
      <h3>
        {name} <small>({tracks.length} tracks)</small>
      </h3>
      <ExportPanel name={name} description="Desi Hip Hop playlist made with DHH." tracks={tracks} />
      <ol className="rows">
        {tracks.map((r) => (
          <ChartRow key={r.track.id} item={r} showStats={false} />
        ))}
      </ol>
      {!genres.length && <p className="hint">Pick at least one genre.</p>}
    </section>
  );
}
