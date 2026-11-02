import { describe, expect, it } from "vitest";
import { isSongUpload, parseDuration, parseVideoTitle, titleMatches } from "./match";

it("accepts official uploads with extra decoration", () => {
  expect(titleMatches("MC STAN - Basti Ka Hasti (Official Video) | INSAAN | 2023", "Basti Ka Hasti")).toBe(true);
  expect(titleMatches("Seedhe Maut x Prabh Deep - Class Sikh Maut Vol. II", "Class-Sikh Maut, Vol. II")).toBe(true);
  expect(titleMatches("NAEZY - AAFAT (Official Video)", "Aafat!")).toBe(true);
});

it("rejects a different song by the same artist", () => {
  expect(titleMatches("Kali Hoodie - BOHEMIA New Song | Music Video", "Kali Denali")).toBe(false);
});

it("tolerates transliteration variants", () => {
  expect(titleMatches("Manavaalan Thug |Thallumaala| Dabzee", "Manavalan Thug")).toBe(true);
  expect(titleMatches("Brodha V - Aathma Raama [Music Video]", "Aathma Rama")).toBe(true);
  expect(titleMatches('"Voice of voiceless" (Lyric Video) - Vedan', "Voice of the Voiceless")).toBe(true);
});

describe("parseVideoTitle", () => {
  const known = new Set(["vichaar", "naam sujal", "siyaahi", "dhanji", "uziii", "naezy", "divine", "hanumankind", "king"]);
  const isArtist = (n: string) => known.has(n.toLowerCase());
  const parse = (t: string, ch?: string) => parseVideoTitle(t, isArtist, ch);

  it("reads Artist - Title (feat.) | Label", () => {
    expect(parse("Naam Sujal - It's About Time feat. Siyaahi &amp; Dhanji (Official Music Video) | Def Jam India", "Naam Sujal")).toEqual({
      title: "It's About Time",
      artists: ["Naam Sujal", "Siyaahi", "Dhanji"],
    });
  });
  it("reads multiple lead artists and title-cases shouting titles", () => {
    expect(parse("Vichaar x Karan Kanchan - UNDERDOG SHIT (Official Video) | Red Bull 64 Bars | Def Jam India", "Vichaar")).toEqual({
      title: "Underdog Shit",
      artists: ["Vichaar", "Karan Kanchan"],
    });
  });
  it("reads Title- Artist when the right side is a known artist", () => {
    expect(parse("AABHAARI HOON- Vichaar", "Vichaar")).toEqual({ title: "Aabhaari Hoon", artists: ["Vichaar"] });
    expect(parse("Chandeliers - Siyaahi x  UZIII | Sultanate | video by Ray.", "Siyaahi")).toEqual({
      title: "Chandeliers",
      artists: ["Siyaahi", "UZIII"],
    });
  });
  it("uses the channel artist for undashed titles", () => {
    expect(parse("Tata Indica Official Music Video | SULTANATE | Directed by Bibtya x Siyaahi", "Siyaahi")).toEqual({
      title: "Tata Indica",
      artists: ["Siyaahi"],
    });
  });
  it("credits label uploads from the title, and gives up without a dash", () => {
    expect(parse("GALI - Parimal Shais ft.Killa K, ThirumaLi, Rudy | Azadi Records (Official Music Video)")).toEqual({
      title: "Gali",
      artists: ["Parimal Shais", "Killa K", "ThirumaLi", "Rudy"],
    });
    expect(parse("Azadi Records 8th Anniversary")).toBeNull();
  });
  it("reads pipe-separated and quoted titles", () => {
    expect(parse('Naezy | Shot pe Shot | prod.by @yeardown', "Naezy")).toEqual({ title: "Shot pe Shot", artists: ["Naezy"] });
    expect(parse('Naezy &quot; Bambai &quot; Prod. by Ae Zed En (Official Music Video)', "Naezy")).toEqual({ title: "Bambai", artists: ["Naezy"] });
  });
  it("cleans @handle credits", () => {
    expect(parse("Enamorado | King, @nishantmuktaofficial, Zero Chill | Official Music Video", "King")?.artists).toEqual([
      "King",
      "nishantmukta",
      "Zero Chill",
    ]);
  });
  it("treats the shouting side as the title when neither side is a known artist", () => {
    expect(parse("Zorba - BRUHM Feat. Skoll")).toEqual({ title: "Bruhm", artists: ["Zorba", "Skoll"] });
  });
  it("drops a repeated artist name from the title", () => {
    expect(parse("Hanumankind, Kalmi - Hanumankind – Big Dawgs | Prod. Kalmi (Official Music Video) | Def Jam India")?.title).toBe("Big Dawgs");
  });
  it("rejects captions and promos posing as titles", () => {
    expect(parse("Tu sirf mujhpe jachti 🔥", "DIVINE")).toBeNull();
    expect(parse("Birthday drop 🎉Tequila Dance ft. @hanumankind 🍹MV out 2.10 🗺️", "DIVINE")).toBeNull();
    expect(parse("Bolna hee tha! #azadi  ✊🇮🇳", "MC Altaf")).toBeNull();
    expect(parse("SMX | 10 YEARS OF SEEDHE MAUT | @SeedheMaut", "Seedhe Maut")).toBeNull();
    expect(parse("Bless - Project Santali Going Strong! We half way through!", "Prabh Deep")).toBeNull();
    expect(parse("Prabh Deep - Bless | Project Santali | 23/47 | Lyric Video", "Prabh Deep")?.title).toBe("Bless");
    expect(parse("Naezy - Aafat! (Official Video)", "Naezy")?.title).toBe("Aafat!");
  });
  it("strips producer credits and keeps hyphenated titles whole", () => {
    expect(parse("Dhanji - Kadipatti (Prod. by dox) | Official Music Video")).toEqual({ title: "Kadipatti", artists: ["Dhanji"] });
    expect(parse("Seedhe Maut x Prabh Deep - Class-Sikh Maut Vol. II")?.title).toBe("Class-Sikh Maut Vol. II");
  });
});

describe("isSongUpload", () => {
  it("drops promos, shorts and long sets", () => {
    expect(isSongUpload("AABHAARI HOON (Official Teaser)", 60)).toBe(false);
    expect(isSongUpload("Aabhaari Hoon MV out now! #vvvv", 30)).toBe(false);
    expect(isSongUpload("Naam Sujal - MAMAFICATION Live Jukebox | Def Jam India", 2400)).toBe(false);
    expect(isSongUpload("AABHAARI HOON- Vichaar", 40)).toBe(false);
    expect(isSongUpload("AABHAARI HOON- Vichaar", 201)).toBe(true);
  });
  it("parses ISO durations", () => {
    expect(parseDuration("PT3M41S")).toBe(221);
    expect(parseDuration("PT1H2M")).toBe(3720);
    expect(parseDuration("P0D")).toBe(0);
  });
});
