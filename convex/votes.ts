import { mutationGeneric as mutation } from "convex/server";
import { v } from "convex/values";
import { seasonV } from "./schema";
import { fail, getSettings, requireMember } from "./lib";
import { decideVote, type MyVote } from "./rules";

/** Ajoute ou retire la voix du membre pour une activité dans une saison. */
export const toggle = mutation({
  args: { cle: v.string(), proposalId: v.id("proposals"), season: seasonV },
  handler: async (ctx, { cle, proposalId, season }) => {
    const me = await requireMember(ctx, cle);
    const settings = await getSettings(ctx);
    const proposal: any = await ctx.db.get(proposalId);
    if (!proposal) fail("Cette activité n'existe plus.");

    const mine: any[] = await ctx.db
      .query("votes")
      .withIndex("by_member", (q: any) => q.eq("memberId", me._id))
      .collect();
    const myVotes: MyVote[] = [];
    for (const vote of mine) {
      const p: any = await ctx.db.get(vote.proposalId);
      myVotes.push({ proposalId: vote.proposalId, season: vote.season, cost: p?.cost ?? p?.suggestedCost ?? 0 });
    }

    const decision = decideVote({
      phase: settings.phase,
      proposalId,
      proposalSeasons: proposal.seasons,
      proposalCost: (proposal.validated ?? proposal.cost != null) ? (proposal.cost ?? proposal.suggestedCost) : null,
      season,
      myVotes,
      budget: settings.budget,
      perSeason: settings.perSeason,
    });

    if (decision.kind === "refuse") fail(decision.reason);
    if (decision.kind === "remove") {
      const existing = mine.find((x) => x.proposalId === proposalId);
      if (existing) await ctx.db.delete(existing._id);
      return "removed";
    }
    await ctx.db.insert("votes", { memberId: me._id, proposalId, season });
    return "added";
  },
});
