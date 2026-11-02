import type { CatalogTrack, GenreId } from "../lib/types";

/**
 * Seed catalog. Genre tags are editorial — review and extend freely.
 * Platform IDs are resolved by `npm run charts` and cached in data/resolved.json.
 */
type Seed = [title: string, artists: string[], genres: GenreId[], year?: number, language?: string];

const SEEDS: Seed[] = [
  ["Mere Gully Mein", ["DIVINE", "Naezy"], ["gully", "underground"], 2015, "Hindi"],
  ["Aafat!", ["Naezy"], ["gully", "underground"], 2014, "Hindi"],
  ["Jungli Sher", ["DIVINE"], ["gully"], 2016, "Hindi"],
  ["Kaam 25", ["DIVINE"], ["gully", "trap"], 2018, "Hindi"],
  ["Sher Aaya Sher", ["DIVINE"], ["gully"], 2019, "Hindi"],
  ["Azadi", ["DIVINE", "Dub Sharma"], ["conscious", "gully"], 2019, "Hindi"],
  ["Apna Time Aayega", ["Ranveer Singh", "DIVINE", "Dub Sharma"], ["pop-rap", "gully"], 2019, "Hindi"],
  ["India 91", ["MC Altaf", "MC TodFod", "100 RBH", "Maharya"], ["gully", "underground"], 2019, "Hindi"],
  ["Asli Hip Hop", ["Ranveer Singh", "Spitfire"], ["gully", "pop-rap"], 2019, "Hindi"],
  ["Kaam Bhaari", ["Kaam Bhaari", "Spitfire", "Rap Demon"], ["gully", "underground"], 2019, "Hindi"],
  ["Mirchi", ["DIVINE", "Stylo G", "MC Altaf", "Phenom"], ["pop-rap", "trap"], 2022, "Hindi"],
  ["Shaktimaan", ["Seedhe Maut"], ["boom-bap", "underground"], undefined, "Hindi"],
  ["Nanchaku", ["Seedhe Maut", "MC STAN"], ["trap", "underground"], 2021, "Hindi"],
  ["Khatta Flow", ["Seedhe Maut", "KR$NA"], ["boom-bap", "conscious"], 2022, "Hindi"],
  ["Class-Sikh Maut, Vol. II", ["Prabh Deep", "Seedhe Maut"], ["boom-bap", "underground", "punjabi"], 2019, "Hindi/Punjabi"],
  ["Kodak", ["King", "Seedhe Maut"], ["trap", "pop-rap"], 2023, "Hindi"],
  ["Vyanjan", ["KR$NA"], ["conscious", "boom-bap"], undefined, "Hindi"],
  ["Saza-E-Maut", ["KR$NA", "Raftaar"], ["conscious", "trap"], 2023, "Hindi"],
  ["Basti Ka Hasti", ["MC STAN"], ["gully", "trap"], 2022, "Hindi"],
  ["Ek Din Pyaar", ["MC STAN"], ["lofi", "underground"], undefined, "Hindi"],
  ["Machayenge", ["Emiway Bantai"], ["pop-rap", "trap"], 2019, "Hindi"],
  ["Firse Machayenge", ["Emiway Bantai"], ["pop-rap", "trap"], 2020, "Hindi"],
  ["Giraftaar", ["Emiway Bantai"], ["diss"], 2020, "Hindi"],
  ["Sheikh Chilli", ["Raftaar"], ["diss"], 2020, "Hindi"],
  ["Dhaakad", ["Raftaar"], ["pop-rap"], 2016, "Hindi"],
  ["Baby Marvake Maanegi", ["Raftaar"], ["pop-rap"], 2016, "Hindi"],
  ["Loser", ["Dino James"], ["conscious", "lofi"], undefined, "Hindi"],
  ["DJ Waley Babu", ["Badshah"], ["pop-rap"], 2015, "Hindi"],
  ["Players", ["Badshah", "Karan Aujla"], ["pop-rap", "punjabi"], 2023, "Punjabi"],
  ["Brown Rang", ["Yo Yo Honey Singh"], ["pop-rap", "punjabi"], 2011, "Punjabi"],
  ["Tu Aake Dekhle", ["King"], ["pop-rap", "lofi"], 2020, "Hindi"],
  ["So High", ["Sidhu Moose Wala"], ["punjabi"], 2017, "Punjabi"],
  ["295", ["Sidhu Moose Wala"], ["punjabi", "conscious"], 2022, "Punjabi"],
  ["The Last Ride", ["Sidhu Moose Wala"], ["punjabi"], 2022, "Punjabi"],
  ["Bambiha Bole", ["Amrit Maan", "Sidhu Moose Wala"], ["punjabi", "drill"], 2020, "Punjabi"],
  ["Kali Denali", ["Bohemia"], ["punjabi"], undefined, "Punjabi"],
  ["Big Dawgs", ["Hanumankind", "Kalmi"], ["trap", "drill", "regional"], 2024, "English"],
  ["Voice of the Voiceless", ["Vedan"], ["regional", "conscious", "underground"], 2020, "Malayalam"],
  ["Manavalan Thug", ["Dabzee"], ["regional", "trap"], undefined, "Malayalam"],
  ["Enjoy Enjaami", ["Dhee", "Arivu"], ["regional", "conscious"], 2021, "Tamil"],
  ["Aathma Rama", ["Brodha V"], ["regional", "conscious"], undefined, "Kannada/English"],
];

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\$/g, "s")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const CATALOG: CatalogTrack[] = SEEDS.map(([title, artists, genres, year, language]) => ({
  id: slugify(`${artists[0]} ${title}`),
  title,
  artists,
  genres,
  year,
  language,
}));

export const trackById = new Map(CATALOG.map((t) => [t.id, t]));
