import { Link, useParams } from "react-router-dom";
import { ChartRow } from "../components/ChartRow";
import { ExportPanel } from "../components/ExportPanel";
import { artistById, ARTISTS, findArtist, SUGGEST_URL } from "../data/artists";
import { genreById } from "../data/genres";
import { listEntries, rankedTracks, useChart } from "../lib/chart";

const LIST_NAMES = { top: "Top 40", bubbling: "Bubbling Under", underground: "Underground 20", fresh: "Fresh Drops" } as const;

export function ArtistPage() {
  const { id } = useParams();
  const artist = artistById.get(id ?? "");
  const { chart } = useChart();
  if (!artist) return <p>Unknown artist. <Link to="/artists">All artists</Link></p>;

  const rows = rankedTracks(chart).filter((r) => r.track.artists.some((a) => findArtist(a)?.id === artist.id));
  const mine = new Set(rows.map((r) => r.track.id));
  const positions = (Object.keys(LIST_NAMES) as (keyof typeof LIST_NAMES)[]).flatMap((list) =>
    listEntries(chart, list)
      .filter((e) => mine.has(e.trackId))
      .map((e) => ({ list, rank: e.rank, title: rows.find((r) => r.track.id === e.trackId)!.track.title })),
  );

  return (
    <section>
      <h1>
        {artist.name}
        {artist.underground && <span className="badge">UG</span>}
      </h1>
      <div className="facts">
        {artist.city && <span>{artist.city}</span>}
        {artist.language && <span>{artist.language}</span>}
        <span>{artist.genres.map((g) => genreById[g].name).join(" · ")}</span>
        {artist.youtubeChannelId && (
          <a href={`https://www.youtube.com/channel/${artist.youtubeChannelId}`} target="_blank" rel="noreferrer">
            YouTube channel →
          </a>
        )}
      </div>
      {positions.length > 0 && (
        <p className="lede">
          Charting this week:{" "}
          {positions.map((p, i) => (
            <span key={`${p.list}-${p.title}`}>
              {i > 0 && " · "}
              <Link to={p.list === "top" || p.list === "bubbling" ? "/chart" : `/chart?list=${p.list}`}>
                #{p.rank} {LIST_NAMES[p.list]}
              </Link>{" "}
              ({p.title})
            </span>
          ))}
        </p>
      )}
      {rows.length ? (
        <>
          <ExportPanel name={`DHH · ${artist.name}`} description={`${artist.name} on DHH.`} tracks={rows} />
          <ol className="rows">
            {rows.map((r) => (
              <ChartRow key={r.track.id} item={r} showStats={false} />
            ))}
          </ol>
        </>
      ) : (
        <p className="hint">
          No tracks yet.{" "}
          {artist.youtubeChannelId
            ? "New uploads are picked up at the next weekly chart run."
            : "We don't have this artist's YouTube channel yet; their features on other artists' tracks still show up here."}
        </p>
      )}
    </section>
  );
}

export function ArtistsPage() {
  const sorted = [...ARTISTS].sort((a, b) => Number(b.underground) - Number(a.underground) || a.name.localeCompare(b.name));
  return (
    <section>
      <h1>Artists</h1>
      <p className="lede">
        New releases from these artists are added to the chart automatically every week. Underground artists also compete in
        the <Link to="/chart?list=underground">Underground 20</Link>. Missing someone?{" "}
        <a href={SUGGEST_URL} target="_blank" rel="noreferrer">
          Suggest an artist
        </a>
        .
      </p>
      <div className="artists">
        {sorted.map((a) => (
          <Link key={a.id} to={`/artist/${a.id}`} className="artist">
            <strong>
              {a.name}
              {a.underground && <span className="badge">UG</span>}
            </strong>
            <span>{[a.city, a.language].filter(Boolean).join(" · ")}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
