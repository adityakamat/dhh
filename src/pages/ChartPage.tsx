import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChartRow } from "../components/ChartRow";
import { ExportPanel } from "../components/ExportPanel";
import { SampleBanner } from "../components/SampleBanner";
import { SUGGEST_URL } from "../data/artists";
import { GENRES } from "../data/genres";
import { listTracks, useChart, type ChartList } from "../lib/chart";
import type { GenreId } from "../lib/types";

const TABS: { id: Exclude<ChartList, "bubbling">; name: string; blurb: string }[] = [
  { id: "top", name: "Top 40", blurb: "The biggest movers in Desi Hip Hop this week." },
  {
    id: "underground",
    name: "Underground 20",
    blurb: "Independent artists and tracks under 10M views, ranked by growth and how hard fans engage, not by size.",
  },
  { id: "fresh", name: "Fresh Drops", blurb: "The best releases from the last 8 weeks." },
];

export function ChartPage() {
  const { chart, error } = useChart();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get("list")) ?? TABS[0];
  const [genre, setGenre] = useState<GenreId | "all">("all");
  const genres = genre === "all" ? undefined : [genre];
  const rows = listTracks(chart, tab.id, genres);
  const bubbling = tab.id === "top" ? listTracks(chart, "bubbling", genres) : [];
  const label = `DHH ${tab.name}${genre === "all" ? "" : `: ${GENRES.find((g) => g.id === genre)!.name}`}`;

  return (
    <section>
      <h1>
        The DHH Chart {chart && <small>Week {chart.week}</small>}
      </h1>
      <SampleBanner chart={chart} />
      {error && <p className="err">{error}</p>}
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tab.id}
            className={`tab ${t.id === tab.id ? "tab--on" : ""}`}
            onClick={() => setParams(t.id === "top" ? {} : { list: t.id }, { replace: true })}
          >
            {t.name}
          </button>
        ))}
      </div>
      <p className="lede">{tab.blurb}</p>
      <div className="chips">
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
      {!rows.length && chart && (
        <p className="hint">
          {tab.id !== "top" && !chart.lists ? "This list starts with the next weekly chart run." : "Nothing charting here this week."}
        </p>
      )}
      {bubbling.length > 0 && (
        <>
          <h2>
            Bubbling Under <small>41–60</small>
          </h2>
          <ol className="rows">
            {bubbling.map((r) => (
              <ChartRow key={r.track.id} item={r} />
            ))}
          </ol>
        </>
      )}
      <p className="hint">
        Missing an artist? <Link to="/artists">See who we track</Link> or{" "}
        <a href={SUGGEST_URL} target="_blank" rel="noreferrer">
          suggest one
        </a>
        .
      </p>
    </section>
  );
}
