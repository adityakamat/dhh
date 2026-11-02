import { describe, expect, it } from "vitest";
import { buildChart, isoWeek, movement, scoreTracks, weeklyViews } from "./scoring";
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
