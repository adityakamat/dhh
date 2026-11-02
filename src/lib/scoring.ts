import type { Chart, ChartEntry, ListKey, ResolvedIds, TrackStats } from "./types";

/**
 * DHH chart score. Spotify removed `popularity` from its Web API in Feb 2026,
 * so the score is built from signals we can still measure:
 *   - velocity:   YouTube views gained since last week's snapshot
 *   - growth:     those weekly views as a share of the views it already had, so a small track
 *                 that doubles can beat a giant that adds 1%
 *   - reach:      lifetime YouTube views (staying power)
 *   - engagement: (likes + 2·comments) / views
 *   - votes:      community votes cast in the app this week
 * Counts (velocity, reach, votes) are log-scaled and min-max normalised across the catalog.
 * Ratios (growth, engagement) are heavy-tailed, so they're normalised by percentile rank
 * instead: one +1000% debut can't flatten everyone else's growth to zero. Ratios are also
 * ignored below MIN_VIEWS to keep a 200-view upload from topping the chart on two likes.
 * A signal nobody has data for is dropped and its weight shared among the rest.
 */
export type Signal = "velocity" | "growth" | "reach" | "engagement" | "votes";
export type Weights = Record<Signal, number>;

/** The Top 40 (and Bubbling Under). */
export const WEIGHTS: Weights = { velocity: 0.35, growth: 0.15, reach: 0.05, engagement: 0.2, votes: 0.25 };
/** The Underground 20: rewards momentum and a loyal audience rather than size. */
export const UNDERGROUND_WEIGHTS: Weights = { velocity: 0.25, growth: 0.35, reach: 0, engagement: 0.2, votes: 0.2 };
const RANKED: ReadonlySet<Signal> = new Set(["growth", "engagement"]);

export const MIN_VIEWS = 1_000;
/** Growth is capped at +1000%/week so a debut doesn't flatten every other track to zero. */
const MAX_GROWTH = 10;
/** Untagged tracks under this many lifetime views can enter the Underground 20, unless credited to mainstream artists. */
export const UNDERGROUND_MAX_VIEWS = 10_000_000;
const FRESH_DAYS = 56;

export interface ScoreInput {
  trackId: string;
  stats: TrackStats;
  prevViews?: number;
  ids: ResolvedIds;
  /** From the catalog: tagged underground or credited to an underground artist/label. */
  underground?: boolean;
  /** From the catalog: credited only to artists marked mainstream. Keeps their smaller videos out of the Underground 20. */
  mainstream?: boolean;
}

const DAY = 86_400_000;

export function weeklyViews(stats: TrackStats, prevViews: number | undefined, now: Date): number | undefined {
  if (stats.views == null) return undefined;
  if (prevViews != null && stats.views >= prevViews) return stats.views - prevViews;
  // No previous snapshot: approximate with the lifetime weekly average.
  if (!stats.publishedAt) return undefined;
  const days = Math.max(7, (now.getTime() - new Date(stats.publishedAt).getTime()) / DAY);
  return (stats.views / days) * 7;
}

/** Weekly views as a fraction of the views the track had a week ago (0.5 = +50%/wk). */
export function weeklyGrowth(stats: TrackStats, prevViews: number | undefined, now: Date): number | undefined {
  const wv = weeklyViews(stats, prevViews, now);
  if (wv == null || stats.views == null || stats.views < MIN_VIEWS) return undefined;
  return Math.min(MAX_GROWTH, wv / Math.max(stats.views - wv, MIN_VIEWS));
}

function rawSignals(input: ScoreInput, now: Date): Partial<Record<Signal, number>> {
  const { stats } = input;
  const out: Partial<Record<Signal, number>> = {};
  const wv = weeklyViews(stats, input.prevViews, now);
  if (wv != null) out.velocity = Math.log1p(wv);
  const growth = weeklyGrowth(stats, input.prevViews, now);
  if (growth != null) out.growth = Math.log1p(growth);
  if (stats.views != null) out.reach = Math.log1p(stats.views);
  if (stats.views && stats.views >= MIN_VIEWS && (stats.likes != null || stats.comments != null)) {
    out.engagement = ((stats.likes ?? 0) + 2 * (stats.comments ?? 0)) / stats.views;
  }
  if (stats.votes != null) out.votes = Math.log1p(stats.votes);
  return out;
}

export function scoreTracks(inputs: ScoreInput[], now = new Date(), weights: Weights = WEIGHTS): Map<string, number> {
  const raw = inputs.map((i) => rawSignals(i, now));
  const signals = (Object.keys(weights) as Signal[]).filter((s) => weights[s] > 0 && raw.some((r) => r[s] != null));
  const totalWeight = signals.reduce((sum, s) => sum + weights[s], 0);

  const normalisers = Object.fromEntries(
    signals.map((s) => {
      const vals = raw.map((r) => r[s]).filter((v): v is number => v != null);
      return [s, RANKED.has(s) ? percentile(vals) : minMax(vals)];
    }),
  ) as Record<Signal, (v: number) => number>;

  const scores = new Map<string, number>();
  inputs.forEach((input, i) => {
    let score = 0;
    for (const s of signals) {
      const v = raw[i][s];
      if (v == null) continue;
      score += (weights[s] / totalWeight) * normalisers[s](v);
    }
    scores.set(input.trackId, Math.round(score * 1000) / 10); // 0–100, one decimal
  });
  return scores;
}

function minMax(vals: number[]): (v: number) => number {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return (v) => (max === min ? 1 : (v - min) / (max - min));
}

/** Percentile rank among `vals`, ties sharing the average rank: 0 for the lowest, 1 for the highest. */
function percentile(vals: number[]): (v: number) => number {
  const sorted = [...vals].sort((a, b) => a - b);
  const n = sorted.length;
  // Index of the first element that is >= v (strict) or > v (!strict).
  const bound = (v: number, strict: boolean) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (strict ? sorted[mid] < v : sorted[mid] <= v) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return (v) => {
    if (sorted[0] === sorted[n - 1]) return 1;
    const lower = bound(v, true);
    return (lower + (bound(v, false) - lower - 1) / 2) / (n - 1);
  };
}

export function isUndergroundEligible(input: ScoreInput): boolean {
  if (input.underground) return true;
  return !input.mainstream && input.stats.views != null && input.stats.views < UNDERGROUND_MAX_VIEWS;
}

export function isFresh(input: ScoreInput, now: Date): boolean {
  const at = input.stats.publishedAt;
  return !!at && now.getTime() - new Date(at).getTime() <= FRESH_DAYS * DAY;
}

/**
 * Ranks `ids` by score into chart entries numbered from `offset + 1`, carrying last week,
 * peak and weeks on chart over from `previous` (the same list's entries last week).
 */
function rankList(
  ids: string[],
  scores: Map<string, number>,
  byId: Map<string, ScoreInput>,
  previous: ChartEntry[] | undefined,
  now: Date,
  size: number,
  offset = 0,
): ChartEntry[] {
  const prevByTrack = new Map(previous?.map((e) => [e.trackId, e]) ?? []);
  return ids
    .map((id) => [id, scores.get(id) ?? 0] as const)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(offset, offset + size)
    .map(([trackId, score], idx) => {
      const rank = offset + idx + 1;
      const prev = prevByTrack.get(trackId);
      const input = byId.get(trackId)!;
      const growth = weeklyGrowth(input.stats, input.prevViews, now);
      return {
        rank,
        trackId,
        score,
        lastWeek: prev?.rank ?? null,
        peak: Math.min(rank, prev?.peak ?? rank),
        weeksOnChart: (prev?.weeksOnChart ?? 0) + 1,
        stats: {
          ...input.stats,
          weeklyViews: roundOrUndef(weeklyViews(input.stats, input.prevViews, now)),
          growthPct: growth == null ? undefined : Math.round(growth * 100),
        },
        ids: input.ids,
      };
    });
}

/**
 * Builds the Top `size` plus three lists:
 *   bubbling     main-score ranks size+1 … size+20
 *   underground  the Underground 20: underground-credited, or < 10M lifetime views and not by a mainstream act;
 *                scored with UNDERGROUND_WEIGHTS
 *   fresh        Fresh Drops: published in the last 8 weeks, by main score
 */
export function buildChart(
  inputs: ScoreInput[],
  previous: Chart | null,
  now = new Date(),
  size = 40,
): Chart {
  const byId = new Map(inputs.map((i) => [i.trackId, i]));
  const all = inputs.map((i) => i.trackId);
  const main = scoreTracks(inputs, now);
  // Top 40 and Bubbling Under are one ranking split in two, so a track's history follows it across the line.
  const prevMain = [...(previous?.entries ?? []), ...(previous?.lists?.bubbling ?? [])];
  const ugInputs = inputs.filter(isUndergroundEligible);
  const ug = scoreTracks(ugInputs, now, UNDERGROUND_WEIGHTS);
  const lists: Record<ListKey, ChartEntry[]> = {
    bubbling: rankList(all, main, byId, prevMain, now, 20, size),
    underground: rankList(ugInputs.map((i) => i.trackId), ug, byId, previous?.lists?.underground, now, 20),
    fresh: rankList(inputs.filter((i) => isFresh(i, now)).map((i) => i.trackId), main, byId, previous?.lists?.fresh, now, 20),
  };
  return {
    generatedAt: now.toISOString(),
    week: isoWeek(now),
    sample: false,
    entries: rankList(all, main, byId, prevMain, now, size),
    lists,
  };
}

function roundOrUndef(n: number | undefined) {
  return n == null ? undefined : Math.round(n);
}

export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export type Movement = { kind: "new" } | { kind: "up" | "down"; by: number } | { kind: "same" };

export function movement(entry: Pick<ChartEntry, "rank" | "lastWeek">): Movement {
  if (entry.lastWeek == null) return { kind: "new" };
  const diff = entry.lastWeek - entry.rank;
  if (diff > 0) return { kind: "up", by: diff };
  if (diff < 0) return { kind: "down", by: -diff };
  return { kind: "same" };
}
