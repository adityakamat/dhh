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
 *   data/overrides.json        optional { trackId: { youtubeVideoId?, spotifyId? } } — hand-picked IDs that always win
 *   data/snapshots/<week>.json lifetime view counts per ISO week, for weekly velocity
 *
 * Re-running within the same week is safe: last week's chart and snapshot are always the newest ones
 * from a *previous* week. Set RERESOLVE=1 to throw away cached YouTube matches and search again.
 *   data/votes.json            optional { trackId: votesThisWeek } until a votes backend exists
 *   public/charts/latest.json  the chart the app reads
 *   public/charts/history/<week>.json
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CATALOG } from "../src/data/catalog";
import { titleMatches } from "../src/lib/match";
import { buildChart, isoWeek, type ScoreInput } from "../src/lib/scoring";
import type { CatalogTrack, Chart, ResolvedIds, TrackStats } from "../src/lib/types";

const RESOLVED = "data/resolved.json";
const OVERRIDES = "data/overrides.json";
const SNAPSHOTS = "data/snapshots";
const HISTORY = "public/charts/history";
const VOTES = "data/votes.json";
const LATEST = "public/charts/latest.json";
const WEEK_MS = 7 * 86_400_000;

interface Snapshot {
  takenAt: string;
  views: Record<string, number>;
}

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}
function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

/** Newest `<week>.json` in `dir` from a week strictly before `week` (ISO week labels sort lexically). */
function latestBefore<T>(dir: string, week: string): T | null {
  if (!existsSync(dir)) return null;
  const prev = readdirSync(dir)
    .filter((f) => /^\d{4}-W\d{2}\.json$/.test(f) && f.slice(0, -5) < week)
    .sort()
    .pop();
  return prev ? readJson<T | null>(`${dir}/${prev}`, null) : null;
}

const YT = "https://www.googleapis.com/youtube/v3";

interface VideoInfo {
  title: string;
  stats: TrackStats;
}

async function ytVideos(videoIds: string[], key: string): Promise<Map<string, VideoInfo>> {
  const out = new Map<string, VideoInfo>();
  for (let i = 0; i < videoIds.length; i += 50) {
    const ids = videoIds.slice(i, i + 50).join(",");
    const res = await fetch(`${YT}/videos?part=statistics,snippet&id=${ids}&key=${key}`);
    if (!res.ok) throw new Error(`YouTube videos.list failed (${res.status}): ${await res.text()}`);
    const body = (await res.json()) as {
      items: { id: string; statistics: Record<string, string>; snippet: { title: string; publishedAt: string } }[];
    };
    for (const v of body.items) {
      out.set(v.id, {
        title: v.snippet.title,
        stats: {
          views: num(v.statistics.viewCount),
          likes: num(v.statistics.likeCount),
          comments: num(v.statistics.commentCount),
          publishedAt: v.snippet.publishedAt,
        },
      });
    }
  }
  return out;
}

/** Search (100 units), then pick the most-viewed result whose title actually names the track. */
async function ytFind(track: CatalogTrack, key: string): Promise<string | undefined> {
  const q = `${track.artists[0]} ${track.title}`;
  const url = `${YT}/search?part=id&type=video&videoCategoryId=10&maxResults=5&q=${encodeURIComponent(q)}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube search failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { items?: { id: { videoId: string } }[] };
  const candidates = await ytVideos(body.items?.map((i) => i.id.videoId) ?? [], key);
  return [...candidates.entries()]
    .filter(([, v]) => titleMatches(v.title, track.title))
    .sort((a, b) => (b[1].stats.views ?? 0) - (a[1].stats.views ?? 0))[0]?.[0];
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
  const week = isoWeek(now);
  const resolved = readJson<Record<string, ResolvedIds>>(RESOLVED, {});
  const overrides = readJson<Record<string, ResolvedIds>>(OVERRIDES, {});
  const votes = readJson<Record<string, number>>(VOTES, {});
  const previous = latestBefore<Chart>(HISTORY, week);
  const snapshot = latestBefore<Snapshot>(SNAPSHOTS, week);
  const ytKey = process.env.YOUTUBE_API_KEY;
  if (!ytKey) {
    if (readJson<Chart | null>(LATEST, null)?.sample === false) {
      console.warn("YOUTUBE_API_KEY not set — keeping the existing real chart untouched.");
      return;
    }
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

  // 1. Resolve platform IDs. Overrides win; cached YouTube matches are re-checked (1 unit per 50)
  //    and only searched again (100 units each) if missing or the title doesn't match.
  const sp = process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
    ? await spotifyToken(process.env.SPOTIFY_CLIENT_ID, process.env.SPOTIFY_CLIENT_SECRET)
    : null;
  if (process.env.RERESOLVE) for (const ids of Object.values(resolved)) delete ids.youtubeVideoId;
  const cached = await ytVideos(
    CATALOG.map((t) => resolved[t.id]?.youtubeVideoId).filter((v): v is string => !!v),
    ytKey,
  );
  const misses: string[] = [];
  for (const track of CATALOG) {
    const ids = (resolved[track.id] ??= {});
    const override = overrides[track.id] ?? {};
    if (override.youtubeVideoId) ids.youtubeVideoId = override.youtubeVideoId;
    else {
      const hit = ids.youtubeVideoId && cached.get(ids.youtubeVideoId);
      if (!hit || !titleMatches(hit.title, track.title)) {
        if (hit) console.warn(`Re-matching ${track.id}: "${hit.title}" doesn't look like "${track.title}"`);
        ids.youtubeVideoId = await ytFind(track, ytKey);
      }
    }
    if (override.spotifyId) ids.spotifyId = override.spotifyId;
    else if (!ids.spotifyId && sp) ids.spotifyId = await spotifySearch(track, sp);
    if (!ids.youtubeVideoId) {
      delete ids.youtubeVideoId;
      misses.push(track.id);
    }
  }
  writeJson(RESOLVED, resolved);
  if (misses.length) console.warn(`No YouTube match for: ${misses.join(", ")} — add one to ${OVERRIDES}`);

  // 2. Fetch stats and score. Velocity is normalised to one week even if a week was skipped.
  const videoIds = CATALOG.map((t) => resolved[t.id]?.youtubeVideoId).filter((v): v is string => !!v);
  const videos = await ytVideos(videoIds, ytKey);
  const weeksSince = snapshot ? Math.max(1, (now.getTime() - new Date(snapshot.takenAt).getTime()) / WEEK_MS) : 1;
  const inputs: ScoreInput[] = CATALOG.map((t) => {
    const ids = resolved[t.id] ?? {};
    const stats = (ids.youtubeVideoId && videos.get(ids.youtubeVideoId)?.stats) || {};
    const prev = snapshot?.views[t.id];
    const prevViews = prev != null && stats.views != null ? stats.views - (stats.views - prev) / weeksSince : undefined;
    return { trackId: t.id, ids, prevViews, stats: { ...stats, votes: votes[t.id] } };
  });

  const chart = buildChart(inputs, previous, now);
  writeJson(LATEST, chart);
  writeJson(`${HISTORY}/${chart.week}.json`, chart);
  writeJson(`${SNAPSHOTS}/${week}.json`, {
    takenAt: now.toISOString(),
    views: Object.fromEntries(inputs.flatMap((i) => (i.stats.views != null ? [[i.trackId, i.stats.views]] : []))),
  } satisfies Snapshot);
  console.log(`Chart ${chart.week}: ${chart.entries.length} entries. #1 = ${chart.entries[0]?.trackId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
