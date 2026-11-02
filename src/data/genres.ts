import type { Genre } from "../lib/types";

export const GENRES: Genre[] = [
  { id: "gully", name: "Gully Rap", blurb: "Street stories from the galis of Mumbai and beyond.", color: "#f5b700" },
  { id: "boom-bap", name: "Boom Bap", blurb: "Dusty drums, sample chops, bars first.", color: "#c97b3c" },
  { id: "trap", name: "Trap", blurb: "808s, hi-hats and flex.", color: "#e4572e" },
  { id: "drill", name: "Drill", blurb: "Sliding 808s and menacing energy.", color: "#8e3b46" },
  { id: "conscious", name: "Conscious / Lyrical", blurb: "Message music and pen-game heavyweights.", color: "#2a9d8f" },
  { id: "punjabi", name: "Punjabi Hip Hop", blurb: "From Bohemia to the new wave.", color: "#e9c46a" },
  { id: "regional", name: "Regional", blurb: "Malayalam, Tamil, Kannada, Marathi, Bengali and more.", color: "#43aa8b" },
  { id: "lofi", name: "Lo-fi / Chill", blurb: "Late-night, laid-back desi rap.", color: "#577590" },
  { id: "diss", name: "Battle / Diss", blurb: "Beef, clapbacks and cyphers.", color: "#d62828" },
  { id: "pop-rap", name: "Pop-rap / Commercial", blurb: "Chartbusters and Bollywood crossovers.", color: "#f72585" },
  { id: "underground", name: "Underground / Indie", blurb: "Independent labels and emerging voices.", color: "#7b2cbf" },
];

export const genreById = Object.fromEntries(GENRES.map((g) => [g.id, g])) as Record<Genre["id"], Genre>;
