import { Link } from "react-router-dom";
import { ChartRow } from "../components/ChartRow";
import { SampleBanner } from "../components/SampleBanner";
import { GENRES } from "../data/genres";
import { listTracks, useChart } from "../lib/chart";

export function HomePage() {
  const { chart, error } = useChart();
  const top = listTracks(chart, "top").slice(0, 10);
  const underground = listTracks(chart, "underground").slice(0, 5);
  const fresh = listTracks(chart, "fresh").slice(0, 5);

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

      {underground.length > 0 && (
        <section className="spotlight">
          <div className="section-head">
            <h2>Underground Spotlight</h2>
            <Link to="/chart?list=underground">Underground 20 →</Link>
          </div>
          <p className="hint">Independent artists ranked by momentum and fan engagement, not view counts.</p>
          <ol className="rows">
            {underground.map((r) => (
              <ChartRow key={r.track.id} item={r} showStats={false} />
            ))}
          </ol>
        </section>
      )}

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

      {fresh.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Fresh Drops</h2>
            <Link to="/chart?list=fresh">All fresh drops →</Link>
          </div>
          <ol className="rows">
            {fresh.map((r) => (
              <ChartRow key={r.track.id} item={r} showStats={false} />
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
