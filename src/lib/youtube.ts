import { getAccessToken } from "./oauth";
import type { CatalogTrack, ResolvedIds } from "./types";
import type { ExportResult } from "./spotify";

/**
 * YouTube Music has no public API; playlists made with the YouTube Data API show up in YT Music.
 * Quota is per Google Cloud project (10,000 units/day by default, shared by every user):
 * playlists.insert = 50 and each playlistItems.insert = 50, so we cap exports.
 */
export const YT_MAX_TRACKS = 25;
const API = "https://www.googleapis.com/youtube/v3";

async function call<T>(path: string, body: unknown): Promise<T> {
  const token = await getAccessToken("google");
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (text.includes("quotaExceeded")) throw new Error("Today's YouTube quota is used up. Try again tomorrow, or use the quick-open link.");
    throw new Error(`YouTube ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function createYouTubePlaylist(
  name: string,
  description: string,
  tracks: { track: CatalogTrack; ids: ResolvedIds }[],
): Promise<ExportResult> {
  const withVideo = tracks.filter((t) => t.ids.youtubeVideoId).slice(0, YT_MAX_TRACKS);
  const missing = tracks.filter((t) => !t.ids.youtubeVideoId).map((t) => t.track);

  const playlist = await call<{ id: string }>("/playlists?part=snippet,status", {
    snippet: { title: name, description },
    status: { privacyStatus: "private" },
  });
  for (const { ids } of withVideo) {
    await call("/playlistItems?part=snippet", {
      snippet: { playlistId: playlist.id, resourceId: { kind: "youtube#video", videoId: ids.youtubeVideoId } },
    });
  }
  return { url: `https://music.youtube.com/playlist?list=${playlist.id}`, added: withVideo.length, missing };
}

/** No-login fallback: YouTube builds a temporary playlist from up to 50 video IDs, which the user can save. */
export function quickPlayUrl(tracks: { ids: ResolvedIds }[]): string | null {
  const ids = tracks.map((t) => t.ids.youtubeVideoId).filter(Boolean).slice(0, 50);
  return ids.length ? `https://www.youtube.com/watch_videos?video_ids=${ids.join(",")}` : null;
}
