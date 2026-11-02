/**
 * Loose title check so a search hit for "Kali Hoodie" can't stand in for "Kali Denali",
 * while tolerating transliteration variants ("Manavaalan" / "Manavalan", "Raama" / "Rama")
 * and a dropped "the".
 */
export function titleMatches(videoTitle: string, trackTitle: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\bthe\b/g, "")
      .replace(/[^a-z0-9]/g, "")
      .replace(/(.)\1+/g, "$1");
  return norm(videoTitle).includes(norm(trackTitle));
}

/** Uploads that aren't songs: promos, behind-the-scenes, live sets, full-album jukeboxes. */
const NOT_A_SONG =
  /\b(teaser|trailer|snippet|bts|behind the scenes?|making of|footnotes|vlog|interview|reaction|jukebox|listening session|live|aftermovie|out now|otw|podcast|announcement|full (?:album|ep|mixtape))\b|#shorts/i;

/** A real track: not a promo by title, and between 75 seconds and 12 minutes long. */
export function isSongUpload(videoTitle: string, durationSec: number | undefined): boolean {
  if (NOT_A_SONG.test(videoTitle)) return false;
  return durationSec == null || (durationSec >= 75 && durationSec <= 720);
}

/** ISO 8601 duration ("PT3M41S") → seconds. */
export function parseDuration(iso: string | undefined): number | undefined {
  const m = iso?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return undefined;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return ((d * 24 + h) * 60 + min) * 60 + s;
}

/** An upload that calls itself a release; required before trusting a title with no "Artist - Title" dash. */
const RELEASE = /\b(official|visuali[sz]er|lyrics?|music video|mv|audio)\b/i;
export const looksLikeRelease = (videoTitle: string) => RELEASE.test(videoTitle);
const DECORATION = /\b(official|video|audio|lyrics?|visuali[sz]er|music|mv|prod|dir|directed|explicit|hd|4k)\b/i;
const FEAT = /\s*\(?\b(?:feat\.|ft\.|feat\b|ft\b|featuring\b)\s*([^()]+?)\)?\s*$/i;
const splitArtists = (s: string) =>
  s
    .split(/\s*(?:,|&|\band\b|\s[xX×]\s)\s*/)
    // "@nishantmuktaofficial" → "nishantmukta"
    .map((a) => (a.startsWith("@") ? a.slice(1).replace(/(?<=\w{3})(official|music|ofc)$/i, "") : a).trim())
    .filter(Boolean);
const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const titleCase = (s: string) =>
  s === s.toUpperCase() && /[A-Z]{2}/.test(s) ? s.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase()) : s;

export interface ParsedTitle {
  title: string;
  artists: string[];
}

/**
 * Turns a YouTube upload title into a track title and artist credits.
 * Handles "Artist x Artist - Title (feat. X) (Official Video) | Label", "Title - Artist",
 * "Title- Artist" and "Title Official Music Video | …". `isArtist` says whether a name
 * belongs to a known artist, which decides which side of the dash is the title.
 * Returns null when no artist can be credited (e.g. an undashed title on a label channel).
 */
export function parseVideoTitle(raw: string, isArtist: (name: string) => boolean, channelArtist?: string): ParsedTitle | null {
  const segments = decode(raw).split(/\s*[|│]+\s*/).map((x) => x.trim()).filter(Boolean);
  let head = segments[0] ?? "";
  const isCredit = (x: string) => splitArtists(x).some(isArtist) || (!!channelArtist && same(x, channelArtist));
  // `Artist "Title"` → `Artist - Title`
  head = head.replace(/^([^"“]+?)\s*["“]\s*([^"”]+?)\s*["”].*$/, "$1 - $2");
  // `Artist | Title | …` or `Title | Artist | …` → `Artist - Title`
  if (!DASH.test(head) && segments[1]) {
    if (isCredit(head)) head = `${head} - ${segments[1]}`;
    else if (isCredit(segments[1])) head = `${segments[1]} - ${head}`;
  }
  // Drop bracketed decoration: "(Official Music Video)", "[Prod. by X]".
  head = head.replace(/\s*[([][^)\]]*[)\]]/g, (m) => (DECORATION.test(m) && !FEAT.test(m) ? "" : m));
  head = head.replace(/\s+(?:official\s+)?(?:music\s+)?(?:video|audio|visuali[sz]er)\s*$/i, "");
  head = head.replace(/\s*\bprod\.?\s*(?:by\s+)?[^-–—]*$/i, "").trim();

  const feats: string[] = [];
  const takeFeat = (x: string) => x.replace(FEAT, (_, names: string) => (feats.push(...splitArtists(names)), "")).trim();

  const parts = head.split(DASH);
  let title: string;
  let artists: string[];
  if (parts.length >= 2) {
    const [rawLeft, rawRight] = [parts[0], parts.slice(1).join(" - ")];
    // Which side credits artists? A known name, then a list of names, then the side that isn't SHOUTING
    // (titles are often all caps: "GALI - Parimal Shais", "Zorba - BRUHM"), else the left side.
    const credits = (x: string) => {
      const names = splitArtists(x.replace(FEAT, ""));
      return names.some(isArtist) ? 2 : names.length > 1 ? 1 : 0;
    };
    const shouting = (x: string) => /\p{Lu}{2}/u.test(x) && x === x.toUpperCase();
    const [cl, cr] = [credits(rawLeft), credits(rawRight)];
    const rightIsArtist = cr > cl || (cr === cl && shouting(rawLeft.replace(FEAT, "")) && !shouting(rawRight.replace(FEAT, "")));
    const [left, right] = [rawLeft, rawRight].map(takeFeat);
    [artists, title] = rightIsArtist ? [splitArtists(right), left] : [splitArtists(left), right];
    // "Hanumankind, Kalmi - Hanumankind – Big Dawgs": drop a repeated artist name from the title.
    for (const a of artists) title = title.replace(new RegExp(`^${escapeRe(a)}\\s*[-–—]\\s*`, "i"), "");
  } else {
    if (!channelArtist || !RELEASE.test(raw)) return null;
    title = takeFeat(head);
    artists = [channelArtist];
  }
  title = titleCase(title.replace(/^["'“‘]+|["'”’]+$/g, "").trim());
  // Captions, not titles: hashtags, emoji, or a sentence that keeps going ("Going Strong! We half way through!").
  if (!title || !artists.length || /[#@]|[!?]\s+\S|\p{Extended_Pictographic}/u.test(title) || title.length > 60) return null;
  if (channelArtist && !artists.some((a) => same(a, channelArtist))) artists.unshift(channelArtist);
  const seen = new Set<string>();
  const credits = [...artists, ...feats].filter((a) => !seen.has(a.toLowerCase()) && seen.add(a.toLowerCase()));
  return { title, artists: credits };
}

/** A spaced dash, or a dash with a space on one side ("Title- Artist"); never the hyphen in "Class-Sikh". */
const DASH = /\s+[-–—]\s*|\s*[-–—]\s+/;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const same = (a: string, b: string) => a.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") === b.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
