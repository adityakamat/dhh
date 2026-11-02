import { getAccessToken } from "./oauth";
import type { CatalogTrack, ResolvedIds } from "./types";

// Endpoints follow Spotify's Feb 2026 Web API changes: POST /me/playlists and /playlists/{id}/items.
const API = "https://api.spotify.com/v1";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken("spotify");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 403) throw new Error("Spotify refused the request. In Development Mode only users added in the dashboard can sign in.");
  if (!res.ok) throw new Error(`Spotify ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

async function findTrackId(track: CatalogTrack): Promise<string | undefined> {
  const q = encodeURIComponent(`track:${track.title} artist:${track.artists[0]}`);
  const body = await call<{ tracks: { items: { id: string }[] } }>(`/search?type=track&limit=1&q=${q}`);
  return body.tracks.items[0]?.id;
}

export interface ExportResult {
  url: string;
  added: number;
  missing: CatalogTrack[];
}

export async function createSpotifyPlaylist(
  name: string,
  description: string,
  tracks: { track: CatalogTrack; ids: ResolvedIds }[],
): Promise<ExportResult> {
  const uris: string[] = [];
  const missing: CatalogTrack[] = [];
  for (const { track, ids } of tracks) {
    const id = ids.spotifyId ?? (await findTrackId(track));
    if (id) uris.push(`spotify:track:${id}`);
    else missing.push(track);
  }

  const playlist = await call<{ id: string; external_urls: { spotify: string } }>("/me/playlists", {
    method: "POST",
    body: JSON.stringify({ name, description, public: false }),
  });
  for (let i = 0; i < uris.length; i += 100) {
    await call(`/playlists/${playlist.id}/items`, { method: "POST", body: JSON.stringify({ uris: uris.slice(i, i + 100) }) });
  }
  return { url: playlist.external_urls.spotify, added: uris.length, missing };
}
