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

export interface ChartEntry {
  rank: number;
  trackId: string;
  score: number;
  lastWeek: number | null;
  peak: number;
  weeksOnChart: number;
  stats: TrackStats & { weeklyViews?: number };
  ids: ResolvedIds;
}

export interface Chart {
  generatedAt: string;
  week: string; // ISO week, e.g. "2026-W45"
  /** True when no real stats were available and the chart is a placeholder. */
  sample: boolean;
  entries: ChartEntry[];
}
