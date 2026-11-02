import { Link, useParams } from "react-router-dom";
import { ChartRow } from "../components/ChartRow";
import { ExportPanel } from "../components/ExportPanel";
import { SUGGEST_URL } from "../data/artists";
import { genreById } from "../data/genres";
import { rankedTracks, useChart } from "../lib/chart";
import type { GenreId } from "../lib/types";

export function GenrePage() {
  const { id } = useParams();
  const genre = genreById[id as GenreId];
  const { chart } = useChart();
  if (!genre) return <p>Unknown genre. <Link to="/">Go home</Link></p>;
  const rows = rankedTracks(chart, [genre.id]);

  return (
    <section>
      <h1 style={{ color: genre.color }}>{genre.name}</h1>
      <p className="lede">{genre.blurb}</p>
      {rows.length ? (
        <>
          <ExportPanel name={`DHH · ${genre.name}`} description={`${genre.blurb} Curated by DHH.`} tracks={rows} />
          <ol className="rows">
            {rows.map((r) => (
              <ChartRow key={r.track.id} item={r} showStats={false} />
            ))}
          </ol>
        </>
      ) : (
        <p className="hint">
          No tracks tagged {genre.name} yet.{" "}
          <a href={SUGGEST_URL} target="_blank" rel="noreferrer">
            Suggest an artist
          </a>
        </p>
      )}
    </section>
  );
}
