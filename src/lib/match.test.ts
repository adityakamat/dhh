import { expect, it } from "vitest";
import { titleMatches } from "./match";

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
