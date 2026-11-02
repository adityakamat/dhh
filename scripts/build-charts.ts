/**
 * Builds the weekly DHH chart.
 *
 *   npm run charts
 *
 * Env: YOUTUBE_API_KEY (required for real data), SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET (optional,
 * used only to resolve Spotify track IDs so playlist export is instant).
 *
 * Reads/writes:
 *   data/resolved.json         cached platform IDs per track (commit this — YouTube search costs 100 quota units)
 *   data/snapshots/latest.json lifetime view counts from the previous run, for weekly velocity
 *   data/votes.json            optional { trackId: votesThisWeek } until a votes backend exists
 *   public/charts/latest.json  the chart the app reads
 *   public/charts/history/<week>.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CATALOG } from "../src/data/catalog";
import { buildChart, isoWeek, type ScoreInput } from "../src/lib/scoring";
import type { CatalogTrack, Chart, ResolvedIds, TrackStats } from "../src/lib/types";

const RESOLVED = "data/resolved.json";
const SNAPSHOT = "data/snapshots/latest.json";
const VOTES = "data/votes.json";
const LATEST = "public/charts/latest.json";

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}
function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

const YT = "https://www.googleapis.com/youtube/v3";

async function ytSearch(track: CatalogTrack, key: string): Promise<string | undefined> {
  const q = `${track.artists.join(" ")} ${track.title}`;
  const url = `${YT}/search?part=snippet&type=video&videoCategoryId=10&maxResults=1&q=${encodeURIComponent(q)}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube search failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { items?: { id: { videoId: string } }[] };
  return body.items?.[0]?.id.videoId;
}

async function ytStats(videoIds: string[], key: string): Promise<Map<string, TrackStats>> {
  const out = new Map<string, TrackStats>();
  for (let i = 0; i < videoIds.length; i += 50) {
    const ids = videoIds.slice(i, i + 50).join(",");
    const res = await fetch(`${YT}/videos?part=statistics,snippet&id=${ids}&key=${key}`);
    if (!res.ok) throw new Error(`YouTube videos.list failed (${res.status}): ${await res.text()}`);
    const body = (await res.json()) as {
      items: { id: string; statistics: Record<string, string>; snippet: { publishedAt: string } }[];
    };
    for (const v of body.items) {
      out.set(v.id, {
        views: num(v.statistics.viewCount),
        likes: num(v.statistics.likeCount),
        comments: num(v.statistics.commentCount),
        publishedAt: v.snippet.publishedAt,
      });
    }
  }
  return out;
}
const num = (s?: string) => (s == null ? undefined : Number(s));

async function spotifyToken(id: string, secret: string): Promise<string> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token failed (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function spotifySearch(track: CatalogTrack, token: string): Promise<string | undefined> {
  const q = `track:${track.title} artist:${track.artists[0]}`;
  const res = await fetch(`https://api.spotify.com/v1/search?type=track&limit=1&q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify search failed (${res.status})`);
  const body = (await res.json()) as { tracks: { items: { id: string }[] } };
  return body.tracks.items[0]?.id;
}

async function main() {
  const now = new Date();
  const resolved = readJson<Record<string, ResolvedIds>>(RESOLVED, {});
  const snapshot = readJson<Record<string, number>>(SNAPSHOT, {});
  const votes = readJson<Record<string, number>>(VOTES, {});
  const previous = readJson<Chart | null>(LATEST, null);
  const ytKey = process.env.YOUTUBE_API_KEY;

  if (!ytKey) {
    console.warn("YOUTUBE_API_KEY not set — writing a SAMPLE chart (catalog order, no stats).");
    const chart: Chart = {
      generatedAt: now.toISOString(),
      week: isoWeek(now),
      sample: true,
      entries: CATALOG.map((t, i) => ({
        rank: i + 1,
        trackId: t.id,
        score: 0,
        lastWeek: null,
        peak: i + 1,
        weeksOnChart: 0,
        stats: {},
        ids: resolved[t.id] ?? {},
      })),
    };
    writeJson(LATEST, chart);
    return;
  }

  // 1. Resolve missing platform IDs (cached forever once found).
  const sp = process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
    ? await spotifyToken(process.env.SPOTIFY_CLIENT_ID, process.env.SPOTIFY_CLIENT_SECRET)
    : null;
  const misses: string[] = [];
  for (const track of CATALOG) {
    const ids = (resolved[track.id] ??= {});
    if (!ids.youtubeVideoId) ids.youtubeVideoId = await ytSearch(track, ytKey);
    if (!ids.spotifyId && sp) ids.spotifyId = await spotifySearch(track, sp);
    if (!ids.youtubeVideoId) misses.push(track.id);
  }
  writeJson(RESOLVED, resolved);
  if (misses.length) console.warn(`No YouTube match for: ${misses.join(", ")}`);

  // 2. Fetch stats and score.
  const videoIds = CATALOG.map((t) => resolved[t.id]?.youtubeVideoId).filter((v): v is string => !!v);
  const stats = await ytStats(videoIds, ytKey);
  const inputs: ScoreInput[] = CATALOG.map((t) => {
    const ids = resolved[t.id] ?? {};
    const s = (ids.youtubeVideoId && stats.get(ids.youtubeVideoId)) || {};
    return { trackId: t.id, ids, prevViews: snapshot[t.id], stats: { ...s, votes: votes[t.id] } };
  });

  const chart = buildChart(inputs, previous?.sample ? null : previous, now);
  writeJson(LATEST, chart);
  writeJson(`public/charts/history/${chart.week}.json`, chart);
  writeJson(SNAPSHOT, Object.fromEntries(inputs.filter((i) => i.stats.views != null).map((i) => [i.trackId, i.stats.views])));
  console.log(`Chart ${chart.week}: ${chart.entries.length} entries. #1 = ${chart.entries[0]?.trackId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
