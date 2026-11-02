import { isoWeek } from "./scoring";

/**
 * Community votes. This first version stores votes on the device only, so they
 * don't feed the shared chart yet. To make them count, implement VoteStore against
 * a backend (e.g. Supabase) and export weekly totals to data/votes.json for the chart builder.
 */
export interface VoteStore {
  hasVoted(trackId: string): boolean;
  toggle(trackId: string): boolean;
}

const KEY = () => `dhh.votes.${isoWeek(new Date())}`;

export const localVotes: VoteStore = {
  hasVoted(trackId) {
    return read().includes(trackId);
  },
  toggle(trackId) {
    const votes = read();
    const next = votes.includes(trackId) ? votes.filter((v) => v !== trackId) : [...votes, trackId];
    localStorage.setItem(KEY(), JSON.stringify(next));
    return next.includes(trackId);
  },
};

function read(): string[] {
  return JSON.parse(localStorage.getItem(KEY()) ?? "[]") as string[];
}
