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
