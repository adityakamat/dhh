import type { Chart, ChartEntry, ResolvedIds, TrackStats } from "./types";

/**
 * DHH chart score. Spotify removed `popularity` from its Web API in Feb 2026,
 * so the score is built from signals we can still measure:
 *   - velocity:   YouTube views gained since last week's snapshot (heaviest weight)
 *   - reach:      lifetime YouTube views (staying power)
 *   - engagement: (likes + 2·comments) / views
 *   - votes:      community votes cast in the app this week
 * Each signal is log-scaled and min-max normalised across the catalog. A signal
 * nobody has data for is dropped and its weight shared among the rest.
 */
export const WEIGHTS = { velocity: 0.5, reach: 0.1, engagement: 0.15, votes: 0.25 } as const;
type Signal = keyof typeof WEIGHTS;

export interface ScoreInput {
  trackId: string;
  stats: TrackStats;
  prevViews?: number;
  ids: ResolvedIds;
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

function rawSignals(input: ScoreInput, now: Date): Partial<Record<Signal, number>> {
  const { stats } = input;
  const out: Partial<Record<Signal, number>> = {};
  const wv = weeklyViews(stats, input.prevViews, now);
  if (wv != null) out.velocity = Math.log1p(wv);
  if (stats.views != null) out.reach = Math.log1p(stats.views);
  if (stats.views && (stats.likes != null || stats.comments != null)) {
    out.engagement = ((stats.likes ?? 0) + 2 * (stats.comments ?? 0)) / stats.views;
  }
  if (stats.votes != null) out.votes = Math.log1p(stats.votes);
  return out;
}

export function scoreTracks(inputs: ScoreInput[], now = new Date()): Map<string, number> {
  const raw = inputs.map((i) => rawSignals(i, now));
  const signals = (Object.keys(WEIGHTS) as Signal[]).filter((s) => raw.some((r) => r[s] != null));
  const totalWeight = signals.reduce((sum, s) => sum + WEIGHTS[s], 0);

  const ranges = Object.fromEntries(
    signals.map((s) => {
      const vals = raw.map((r) => r[s]).filter((v): v is number => v != null);
      return [s, { min: Math.min(...vals), max: Math.max(...vals) }];
    }),
  ) as Record<Signal, { min: number; max: number }>;

  const scores = new Map<string, number>();
  inputs.forEach((input, i) => {
    let score = 0;
    for (const s of signals) {
      const v = raw[i][s];
      if (v == null) continue;
      const { min, max } = ranges[s];
      const norm = max === min ? 1 : (v - min) / (max - min);
      score += (WEIGHTS[s] / totalWeight) * norm;
    }
    scores.set(input.trackId, Math.round(score * 1000) / 10); // 0–100, one decimal
  });
  return scores;
}

export function buildChart(
  inputs: ScoreInput[],
  previous: Chart | null,
  now = new Date(),
  size = 40,
): Chart {
  const scores = scoreTracks(inputs, now);
  const prevByTrack = new Map(previous?.entries.map((e) => [e.trackId, e]) ?? []);
  const byId = new Map(inputs.map((i) => [i.trackId, i]));

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, size);

  const entries: ChartEntry[] = ranked.map(([trackId, score], idx) => {
    const rank = idx + 1;
    const prev = prevByTrack.get(trackId);
    const input = byId.get(trackId)!;
    return {
      rank,
      trackId,
      score,
      lastWeek: prev?.rank ?? null,
      peak: Math.min(rank, prev?.peak ?? rank),
      weeksOnChart: (prev?.weeksOnChart ?? 0) + 1,
      stats: { ...input.stats, weeklyViews: roundOrUndef(weeklyViews(input.stats, input.prevViews, now)) },
      ids: input.ids,
    };
  });

  return { generatedAt: now.toISOString(), week: isoWeek(now), sample: false, entries };
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
