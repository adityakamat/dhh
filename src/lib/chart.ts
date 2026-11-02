import { useEffect, useState } from "react";
import { CATALOG, trackById } from "../data/catalog";
import type { CatalogTrack, Chart, ChartEntry, GenreId } from "./types";

let cache: Promise<Chart> | null = null;

export function loadChart(): Promise<Chart> {
  cache ??= fetch("./charts/latest.json").then((r) => {
    if (!r.ok) throw new Error(`Couldn't load chart (${r.status})`);
    return r.json() as Promise<Chart>;
  });
  return cache;
}

export function useChart() {
  const [chart, setChart] = useState<Chart | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadChart().then(setChart, (e: Error) => setError(e.message));
  }, []);
  return { chart, error };
}

export interface RankedTrack {
  track: CatalogTrack;
  entry?: ChartEntry;
  ids: ChartEntry["ids"];
}

/** Every catalog track, in chart order (charted first, then the rest). */
export function rankedTracks(chart: Chart | null, genres?: GenreId[]): RankedTrack[] {
  const seen = new Set<string>();
  const out: RankedTrack[] = [];
  for (const entry of chart?.entries ?? []) {
    const track = trackById.get(entry.trackId);
    if (!track) continue;
    seen.add(track.id);
    out.push({ track, entry, ids: entry.ids });
  }
  for (const track of CATALOG) if (!seen.has(track.id)) out.push({ track, ids: {} });
  return genres?.length ? out.filter((r) => r.track.genres.some((g) => genres.includes(g))) : out;
}
