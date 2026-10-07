import { queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { fullName, getSettings, memberFromCle } from "./lib";

/**
 * Tout ce dont l'interface a besoin, en une requête temps réel.
 * Renvoie null si la clé n'est pas reconnue. Les e-mails et les clés des autres
 * membres ne sont jamais renvoyés ici (voir admin.members, réservé au bureau).
 */
export const state = query({
  args: { cle: v.string() },
  handler: async (ctx, { cle }) => {
    const me = await memberFromCle(ctx, cle);
    if (!me) return null;
    const settings = await getSettings(ctx);
    const members = await ctx.db.query("members").collect();
    const proposals = await ctx.db.query("proposals").collect();
    const votes = await ctx.db.query("votes").collect();
    const names = new Map<string, string>(members.map((m: any) => [m._id, fullName(m)]));

    return {
      me: { id: me._id as string, prenom: me.prenom, nom: me.nom, role: me.role },
      settings: { phase: settings.phase, budget: settings.budget, perSeason: settings.perSeason },
      memberCount: members.length,
      proposals: proposals
        .map((p: any) => ({
          id: p._id as string,
          title: p.title as string,
          description: p.description as string,
          seasons: p.seasons as ("P" | "E" | "A")[],
          suggestedCost: p.suggestedCost as number,
          cost: p.cost as number | null,
          authorId: p.authorId as string,
          authorName: p.authorName as string,
          tieBreak: p.tieBreak as number,
          createdAt: p._creationTime as number,
        }))
        .sort((a, b) => b.createdAt - a.createdAt),
      votes: votes.map((x: any) => ({
        proposalId: x.proposalId as string,
        season: x.season as "P" | "E" | "A",
        memberId: x.memberId as string,
        memberName: names.get(x.memberId) ?? "Membre supprimé",
      })),
    };
  },
});
