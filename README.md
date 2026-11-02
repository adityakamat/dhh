# DHH: The Ultimate Desi Hip Hop Playlist

A hybrid app (web + iOS + Android via Capacitor) that:

- builds **genre playlists** of Desi Hip Hop and saves them to **Spotify** or **YouTube Music**
- publishes a weekly **DHH Chart**: a Billboard-style Top 40 with last week, peak and weeks on chart
- lets fans **vote** (🔥) on tracks

Genres: Gully Rap · Boom Bap · Trap · Drill · Conscious/Lyrical · Punjabi · Regional · Lo-fi/Chill · Battle/Diss · Pop-rap/Commercial · Underground/Indie

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in client IDs (see below)
npm run dev                  # http://127.0.0.1:5173
npm test
```

Without any keys the app still runs, using a **sample chart** (catalog order).

## How the chart is ranked

Spotify removed `popularity` from its Web API in February 2026, so the score uses signals we can still measure (`src/lib/scoring.ts`):

| Signal | Weight | Source |
|---|---|---|
| Velocity: views gained this week | 50% | YouTube, diffed against last week's snapshot |
| Reach: lifetime views | 10% | YouTube |
| Engagement: (likes + 2·comments) / views | 15% | YouTube |
| Community votes this week | 25% | In-app 🔥 |

Each signal is log-scaled and normalised across the catalog. If no track has data for a signal, that signal's weight is shared among the others.
`npm run charts` (also a GitHub Action every Monday 09:00 IST) writes `public/charts/latest.json` and `public/charts/history/<week>.json`.

## Setup: API credentials

### 1. Spotify (playlist export)
1. Go to https://developer.spotify.com/dashboard → Create app → select **Web API**.
2. Add the redirect URIs `http://127.0.0.1:5173/` (dev) and `com.adityakamat.dhh://callback` (native). Spotify does not accept `localhost`; use `127.0.0.1`.
3. Copy the Client ID into `VITE_SPOTIFY_CLIENT_ID`. No secret is needed because the app uses PKCE.
4. ⚠️ **Development Mode allows only 5 users**, and the app owner needs Premium. Add testers under *User Management*. To open the app to the public, apply for Extended Quota.
5. Optional: put the Client ID and Secret in the repo secrets `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` so the chart builder can pre-match Spotify track IDs.

### 2. Google / YouTube (chart data + YouTube Music export)
1. In https://console.cloud.google.com, create a project and enable **YouTube Data API v3**.
2. **API key**: put it in `YOUTUBE_API_KEY` (GitHub repo secret + `.env.local` for local runs). The chart builder uses it.
3. **OAuth client ID** (type *Web application*): add the authorised JavaScript origin `http://127.0.0.1:5173` and the redirect URI `http://127.0.0.1:5173/`, then put the ID in `VITE_GOOGLE_CLIENT_ID`. Configure the OAuth consent screen with the `youtube` scope, and add yourself as a test user.
4. Quota is 10,000 units/day **per project, shared by all users**. A 25-track export costs about 1,300 units, so exports are capped at 25 tracks. The "Play on YouTube (no login)" link costs nothing.

### 3. GitHub Action
Add `YOUTUBE_API_KEY` (and optionally the Spotify pair) under *Settings → Secrets → Actions*, then run **Weekly DHH chart** manually once. The first run uses YouTube search to match a video for each track (100 units each). The results are cached in `data/resolved.json`, so later runs cost about 1 unit.

### Fixing a wrong YouTube match
The chart builder only accepts a search result whose title names the track, and it prefers the most-viewed one. Every run re-checks cached matches, which is cheap. If a track still maps to the wrong video, or to none, pin the right one in `data/overrides.json`:

```json
{ "bohemia-kali-denali": { "youtubeVideoId": "VIDEO_ID_HERE" } }
```

To redo every match, run the workflow with **reresolve** ticked. That costs about 100 units per track.

Note that the first chart has no previous week to compare against, so "velocity" is estimated from lifetime views per week, which favours recent uploads. Real week-over-week velocity starts with the second weekly run.

## Web deploy (GitHub Pages)

The site is live at https://adityakamat.github.io/dhh/. It's deployed by `.github/workflows/deploy.yml` on every push to `main` and after every chart run.

- Add the repository **variables** (not secrets; these are public IDs) `VITE_SPOTIFY_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`.
- Add the redirect URI `https://adityakamat.github.io/dhh/` in the Spotify dashboard and in the Google OAuth client. Also add `https://adityakamat.github.io` as an authorised JavaScript origin in Google.

## Native apps (Capacitor)

```bash
npx cap add ios && npx cap add android   # once
npm run cap:sync
npm run cap:ios      # or cap:android
```

Then register the `com.adityakamat.dhh` URL scheme so OAuth redirects come back into the app:
- **iOS**: in `ios/App/App/Info.plist`, add a `CFBundleURLTypes` entry with scheme `com.adityakamat.dhh`.
- **Android**: in `android/app/src/main/AndroidManifest.xml`, add an intent-filter for `<data android:scheme="com.adityakamat.dhh" />` to `MainActivity`.

Spotify login works natively. **Google blocks OAuth in embedded webviews**, so on native the app offers "Play on YouTube (no login)" instead of saving to YouTube Music. Adding a native Google Sign-In plugin is on the roadmap.

## Project layout

```
src/data/catalog.ts     curated tracks + genre tags (edit me)
src/data/genres.ts      genre definitions
src/lib/scoring.ts      chart score + Billboard movement (unit-tested)
src/lib/oauth.ts        Spotify PKCE / Google token flow, web + native redirects
src/lib/spotify.ts      playlist export (Feb-2026 endpoints: /me/playlists, /playlists/{id}/items)
src/lib/youtube.ts      YouTube Music export + no-login fallback
src/lib/votes.ts        votes (device-local for now)
scripts/build-charts.ts weekly chart builder
```

## Roadmap
- [ ] Shared votes backend (e.g. Supabase), exported weekly into `data/votes.json` so votes count on the chart
- [ ] Native Google Sign-In for YouTube Music export on iOS/Android
- [ ] Community track submissions + editorial review for the catalog
- [ ] Artist pages and chart history graphs
