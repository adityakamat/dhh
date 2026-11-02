import { useState } from "react";
import type { RankedTrack } from "../lib/chart";
import { AuthRequired, canSignIn, isConfigured, isSignedIn, signIn, type Provider } from "../lib/oauth";
import { createSpotifyPlaylist, type ExportResult } from "../lib/spotify";
import { createYouTubePlaylist, quickPlayUrl, YT_MAX_TRACKS } from "../lib/youtube";

type Status = { kind: "idle" } | { kind: "busy"; p: Provider } | { kind: "done"; p: Provider; res: ExportResult } | { kind: "error"; msg: string };

export function ExportPanel({ name, description, tracks }: { name: string; description: string; tracks: RankedTrack[] }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const quick = quickPlayUrl(tracks);

  async function run(p: Provider) {
    if (!isSignedIn(p)) return signIn(p);
    setStatus({ kind: "busy", p });
    try {
      const fn = p === "spotify" ? createSpotifyPlaylist : createYouTubePlaylist;
      setStatus({ kind: "done", p, res: await fn(name, description, tracks) });
    } catch (e) {
      if (e instanceof AuthRequired) return signIn(p);
      setStatus({ kind: "error", msg: (e as Error).message });
    }
  }

  const busy = status.kind === "busy";
  return (
    <div className="export">
      <div className="export__buttons">
        <button className="btn btn--spotify" disabled={busy || !tracks.length || !isConfigured("spotify")} onClick={() => run("spotify")}>
          {status.kind === "busy" && status.p === "spotify" ? "Creating…" : "Save to Spotify"}
        </button>
        {canSignIn("google") && (
          <button className="btn btn--yt" disabled={busy || !tracks.length} onClick={() => run("google")}>
            {status.kind === "busy" && status.p === "google" ? "Creating…" : "Save to YouTube Music"}
          </button>
        )}
        {quick && (
          <a className="btn btn--ghost" href={quick} target="_blank" rel="noreferrer">
            Play on YouTube (no login)
          </a>
        )}
      </div>
      {!isConfigured("spotify") && <p className="hint">Spotify isn't configured yet. Set VITE_SPOTIFY_CLIENT_ID.</p>}
      {canSignIn("google") && tracks.length > YT_MAX_TRACKS && (
        <p className="hint">YouTube Music saves the first {YT_MAX_TRACKS} tracks (API quota).</p>
      )}
      {!quick && <p className="hint">YouTube links appear after the chart builder has matched videos.</p>}
      {status.kind === "done" && (
        <p className="ok">
          Added {status.res.added} tracks.{" "}
          <a href={status.res.url} target="_blank" rel="noreferrer">
            Open playlist →
          </a>
          {status.res.missing.length > 0 && (
            <span className="hint"> Couldn't find: {status.res.missing.map((t) => t.title).join(", ")}</span>
          )}
        </p>
      )}
      {status.kind === "error" && <p className="err">{status.msg}</p>}
    </div>
  );
}
