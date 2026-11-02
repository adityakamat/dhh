import { Link } from "react-router-dom";
import { ChartRow } from "../components/ChartRow";
import { SampleBanner } from "../components/SampleBanner";
import { GENRES } from "../data/genres";
import { rankedTracks, useChart } from "../lib/chart";

export function HomePage() {
  const { chart, error } = useChart();
  const top = rankedTracks(chart).filter((r) => r.entry).slice(0, 10);

  return (
    <>
      <section className="hero">
        <h1>
          The Ultimate <em>Desi Hip Hop</em> Playlist
        </h1>
        <p>Pick a vibe, from gully to drill to regional, and send it to Spotify or YouTube Music in one tap. Vote on the weekly DHH chart.</p>
        <div className="hero__cta">
          <Link to="/build" className="btn btn--primary">Build a playlist</Link>
          <Link to="/chart" className="btn btn--ghost">See the chart</Link>
        </div>
      </section>

      <section>
        <h2>Genres</h2>
        <div className="genres">
          {GENRES.map((g) => (
            <Link key={g.id} to={`/genre/${g.id}`} className="genre" style={{ ["--c" as string]: g.color }}>
              <strong>{g.name}</strong>
              <span>{g.blurb}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>DHH Top 10 {chart && <small>{chart.week}</small>}</h2>
          <Link to="/chart">Full chart →</Link>
        </div>
        <SampleBanner chart={chart} />
        {error && <p className="err">{error}</p>}
        <ol className="rows">
          {top.map((r) => (
            <ChartRow key={r.track.id} item={r} showStats={false} />
          ))}
        </ol>
      </section>
    </>
  );
}
