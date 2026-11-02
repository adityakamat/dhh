import { describe, expect, it } from "vitest";
import { buildChart, isoWeek, movement, scoreTracks, UNDERGROUND_WEIGHTS, weeklyGrowth, weeklyViews } from "./scoring";
import type { ScoreInput } from "./scoring";

const now = new Date("2026-11-02T00:00:00Z");
const input = (trackId: string, views: number, prevViews?: number, extra: Partial<ScoreInput["stats"]> = {}): ScoreInput => ({
  trackId,
  stats: { views, likes: views / 50, comments: views / 1000, publishedAt: "2024-01-01T00:00:00Z", ...extra },
  prevViews,
  ids: {},
});

describe("weeklyViews", () => {
  it("uses the snapshot delta when available", () => {
    expect(weeklyViews({ views: 1500 }, 1000, now)).toBe(500);
  });
  it("falls back to lifetime weekly average", () => {
    expect(weeklyViews({ views: 700, publishedAt: "2026-10-26T00:00:00Z" }, undefined, now)).toBeCloseTo(700);
  });
  it("is undefined without views", () => {
    expect(weeklyViews({}, undefined, now)).toBeUndefined();
  });
});

describe("scoreTracks", () => {
  it("ranks the fastest-growing track first", () => {
    const s = scoreTracks([input("big-but-flat", 10_000_000, 9_999_000), input("rising", 2_000_000, 1_500_000)], now);
    expect(s.get("rising")!).toBeGreaterThan(s.get("big-but-flat")!);
  });
  it("redistributes weight when a signal is missing for everyone", () => {
    // No votes for anyone: a leads every remaining signal, so it must still score a full 100.
    const s = scoreTracks([input("a", 100, 0), input("b", 50, 0)], now);
    expect(s.get("a")).toBe(100);
    expect(s.get("b")!).toBeLessThan(100);
  });
  it("lets votes move the needle", () => {
    const base = [input("a", 1000, 900, { votes: 0 }), input("b", 1000, 900, { votes: 50 })];
    const s = scoreTracks(base, now);
    expect(s.get("b")!).toBeGreaterThan(s.get("a")!);
  });
});

describe("growth", () => {
  it("measures weekly views against last week's total", () => {
    expect(weeklyGrowth({ views: 15_000 }, 10_000, now)).toBeCloseTo(0.5);
  });
  it("ignores tracks below the view floor", () => {
    expect(weeklyGrowth({ views: 600 }, 100, now)).toBeUndefined();
    const s = scoreTracks([input("tiny", 300, 10, { likes: 200 }), input("real", 50_000, 40_000)], now);
    expect(s.get("real")!).toBeGreaterThan(s.get("tiny")!);
  });
  it("lets a fast-growing underground track beat a flat giant on the underground weights", () => {
    const giant = input("giant", 500_000_000, 499_000_000);
    const ug = input("ug", 120_000, 60_000);
    const s = scoreTracks([giant, ug], now, UNDERGROUND_WEIGHTS);
    expect(s.get("ug")!).toBeGreaterThan(s.get("giant")!);
  });
});

describe("ratio signals", () => {
  it("rank by percentile, so one huge debut doesn't flatten everyone else", () => {
    const tracks = [
      input("debut", 2_000_000, 200_000), // +900%/wk
      input("steady", 500_000, 440_000), // +14%/wk
      input("old-loyal", 100_000, 98_500, { likes: 10_000 }), // +1.5%/wk but 10% like ratio
    ];
    const s = scoreTracks(tracks, now, UNDERGROUND_WEIGHTS);
    expect(s.get("steady")!).toBeGreaterThan(s.get("old-loyal")!);
  });
});

describe("buildChart", () => {
  it("tracks last week, peak and weeks on chart", () => {
    const w1 = buildChart([input("a", 2000, 1000), input("b", 1500, 1400)], null, now);
    expect(w1.entries.map((e) => e.trackId)).toEqual(["a", "b"]);
    const w2 = buildChart([input("a", 2100, 2000), input("b", 3000, 1500)], w1, now);
    const b = w2.entries.find((e) => e.trackId === "b")!;
    expect(b).toMatchObject({ rank: 1, lastWeek: 2, peak: 1, weeksOnChart: 2 });
    expect(movement(b)).toEqual({ kind: "up", by: 1 });
  });
});

describe("isoWeek", () => {
  it("handles year boundaries", () => {
    expect(isoWeek(new Date("2026-11-02T00:00:00Z"))).toBe("2026-W45");
    expect(isoWeek(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
  });
});

describe("chart lists", () => {
  const recent = "2026-10-20T00:00:00Z";
  const catalog = (views: (i: number) => number, prev: (i: number) => number) =>
    Array.from({ length: 70 }, (_, i) =>
      input(`t${String(i).padStart(2, "0")}`, views(i), prev(i), i % 10 === 0 ? { publishedAt: recent } : {}),
    );

  it("splits the main ranking into Top 40 and Bubbling Under", () => {
    const c = buildChart(catalog((i) => 100_000_000 - i * 1_000_000, (i) => 99_000_000 - i * 1_000_000), null, now);
    expect(c.entries).toHaveLength(40);
    expect(c.lists!.bubbling!.map((e) => e.rank)).toEqual(Array.from({ length: 20 }, (_, i) => 41 + i));
  });

  it("only admits underground-credited or sub-10M tracks to the Underground 20", () => {
    const big = input("big", 900_000_000, 890_000_000);
    const small = input("small", 50_000, 30_000);
    const tagged = { ...input("tagged", 40_000_000, 39_000_000), underground: true };
    const majorDeepCut = { ...input("major", 300_000, 200_000), mainstream: true };
    const ids = buildChart([big, small, tagged, majorDeepCut], null, now).lists!.underground!.map((e) => e.trackId);
    expect(ids).toContain("small");
    expect(ids).toContain("tagged");
    expect(ids).not.toContain("big");
    expect(ids).not.toContain("major");
  });

  it("puts only recent releases in Fresh Drops", () => {
    const c = buildChart(catalog(() => 2_000_000, () => 1_000_000), null, now);
    expect(c.lists!.fresh!.map((e) => e.trackId)).toEqual(["t00", "t10", "t20", "t30", "t40", "t50", "t60"]);
  });

  it("tracks each list's history separately, across the Top 40 / Bubbling Under line", () => {
    const small = (v: number, p: number) => ({ ...input("ug", v, p), underground: true });
    const field = Array.from({ length: 45 }, (_, i) => input(`m${String(i).padStart(2, "0")}`, 1e9 - i * 1e7, 1e9 - i * 1e7 - 5e6));
    const w1 = buildChart([...field, small(20_000, 19_000)], null, now);
    const w1ug = w1.lists!.underground!.find((e) => e.trackId === "ug")!;
    expect(w1.entries.find((e) => e.trackId === "ug")).toBeUndefined();
    const w2 = buildChart([...field, small(400_000, 20_000)], w1, now);
    const w2ug = w2.lists!.underground!.find((e) => e.trackId === "ug")!;
    expect(w2ug).toMatchObject({ lastWeek: w1ug.rank, weeksOnChart: 2 });
    expect(w2ug.stats.growthPct).toBe(1000);
  });
});
