export type GenreId =
  | "gully"
  | "boom-bap"
  | "trap"
  | "drill"
  | "conscious"
  | "punjabi"
  | "regional"
  | "lofi"
  | "diss"
  | "pop-rap"
  | "underground";

export interface Genre {
  id: GenreId;
  name: string;
  blurb: string;
  color: string;
}

/** A track in the curated catalog. Platform IDs are filled in by the chart builder. */
export interface CatalogTrack {
  id: string; // stable slug, e.g. "divine-naezy-mere-gully-mein"
  title: string;
  artists: string[];
  genres: GenreId[];
  year?: number;
  language?: string;
  /** True when tagged underground or credited to an underground artist/label in data/artists.json. */
  underground: boolean;
  /** True when every credited artist we know of is marked mainstream (`underground: false`) in data/artists.json. */
  mainstream?: boolean;
  /** Set for tracks found automatically on an artist or label channel. */
  discoveredAt?: string;
}

/** An entry in data/artists.json. A channel ID makes the chart builder pick up new uploads. */
export interface Artist {
  id: string;
  name: string;
  aliases?: string[];
  city?: string;
  language?: string;
  genres: GenreId[];
  underground: boolean;
  youtubeChannelId?: string;
}

/** A label channel: uploads are credited to the artists named in each video title. */
export interface Label {
  id: string;
  name: string;
  genres: GenreId[];
  underground: boolean;
  youtubeChannelId: string;
}

/** A track found by the chart builder on an artist/label channel (data/discovered.json). */
export interface DiscoveredTrack {
  title: string;
  artists: string[];
  genres: GenreId[];
  year?: number;
  language?: string;
  underground: boolean;
  youtubeVideoId: string;
  discoveredAt: string;
}

export interface ResolvedIds {
  spotifyId?: string;
  youtubeVideoId?: string;
}

export interface TrackStats {
  views?: number;
  likes?: number;
  comments?: number;
  publishedAt?: string;
  votes?: number;
}

export type ListKey = "bubbling" | "underground" | "fresh";

export interface ChartEntry {
  rank: number;
  trackId: string;
  score: number;
  lastWeek: number | null;
  peak: number;
  weeksOnChart: number;
  stats: TrackStats & { weeklyViews?: number; growthPct?: number };
  ids: ResolvedIds;
}

export interface Chart {
  generatedAt: string;
  week: string; // ISO week, e.g. "2026-W45"
  /** True when no real stats were available and the chart is a placeholder. */
  sample: boolean;
  /** The Top 40. */
  entries: ChartEntry[];
  /** Bubbling Under (41–60), Underground 20 and Fresh Drops. Absent in charts built before they existed. */
  lists?: Partial<Record<ListKey, ChartEntry[]>>;
  /** Platform IDs for every catalog track, charted or not, so any genre playlist can be exported. */
  ids?: Record<string, ResolvedIds>;
}
