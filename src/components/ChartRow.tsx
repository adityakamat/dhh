import { useState } from "react";
import { Link } from "react-router-dom";
import { genreById } from "../data/genres";
import type { RankedTrack } from "../lib/chart";
import { movement } from "../lib/scoring";
import { localVotes } from "../lib/votes";

const fmt = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export function ChartRow({ item, showStats = true }: { item: RankedTrack; showStats?: boolean }) {
  const { track, entry } = item;
  const [voted, setVoted] = useState(() => localVotes.hasVoted(track.id));
  // Sample charts have weeksOnChart 0: there is no real movement to show.
  const mv = entry && entry.weeksOnChart > 0 ? movement(entry) : null;

  return (
    <li className="row">
      <div className="row__rank">{entry?.rank ?? "–"}</div>
      <div className="row__move">
        {mv?.kind === "new" && <span className="mv mv--new">NEW</span>}
        {mv?.kind === "up" && <span className="mv mv--up">▲{mv.by}</span>}
        {mv?.kind === "down" && <span className="mv mv--down">▼{mv.by}</span>}
        {mv?.kind === "same" && <span className="mv">=</span>}
      </div>
      <div className="row__main">
        <div className="row__title">{track.title}</div>
        <div className="row__artist">{track.artists.join(", ")}</div>
        <div className="row__tags">
          {track.genres.map((g) => (
            <Link key={g} to={`/genre/${g}`} className="tag" style={{ borderColor: genreById[g].color }}>
              {genreById[g].name}
            </Link>
          ))}
        </div>
      </div>
      {showStats && entry && entry.weeksOnChart > 0 && (
        <dl className="row__stats">
          <div>
            <dt>Last wk</dt>
            <dd>{entry.lastWeek ?? "–"}</dd>
          </div>
          <div>
            <dt>Peak</dt>
            <dd>{entry.peak}</dd>
          </div>
          <div>
            <dt>Wks</dt>
            <dd>{entry.weeksOnChart}</dd>
          </div>
          {entry.stats.weeklyViews != null && (
            <div>
              <dt>Views/wk</dt>
              <dd>{fmt.format(entry.stats.weeklyViews)}</dd>
            </div>
          )}
          <div>
            <dt>Score</dt>
            <dd>{entry.score}</dd>
          </div>
        </dl>
      )}
      <button
        className={`vote ${voted ? "vote--on" : ""}`}
        aria-pressed={voted}
        onClick={() => setVoted(localVotes.toggle(track.id))}
        title="Vote for this week's chart"
      >
        🔥
      </button>
    </li>
  );
}
