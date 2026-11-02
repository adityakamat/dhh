import registry from "../../data/artists.json";
import type { Artist, Label } from "../lib/types";

/**
 * Artist & label registry (data/artists.json). Entries with a YouTube channel ID are scanned by
 * `npm run charts` for new uploads, which is how new underground releases reach the chart.
 */
export const ARTISTS = registry.artists as Artist[];
export const LABELS = registry.labels as Label[];

export const artistById = new Map(ARTISTS.map((a) => [a.id, a]));

/** Lowercase, accents and punctuation stripped: "KR$NA" → "krsna", "MC STAN" → "mcstan". */
export const nameKey = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/\$/g, "s").replace(/[^a-z0-9]/g, "");

const byName = new Map(ARTISTS.flatMap((a) => [a.name, ...(a.aliases ?? [])].map((n) => [nameKey(n), a] as const)));

export function findArtist(name: string): Artist | undefined {
  return byName.get(nameKey(name));
}

/** Prefilled GitHub issue form (.github/ISSUE_TEMPLATE/suggest-artist.yml). */
export const SUGGEST_URL = "https://github.com/adityakamat/dhh/issues/new?template=suggest-artist.yml";
