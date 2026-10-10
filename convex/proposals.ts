import { mutationGeneric as mutation } from "convex/server";
import { v } from "convex/values";
import { deleteVotesOf, fail, fullName, getSettings, isBureauRole, requireBureau, requireMember, rule } from "./lib";
import { cleanProposal, SEASONS } from "./rules";

const proposalArgs = {
  title: v.string(),
  description: v.string(),
  seasons: v.array(v.string()),
  suggestedCost: v.number(),
};

export const create = mutation({
  args: { cle: v.string(), ...proposalArgs },
  handler: async (ctx, { cle, ...input }) => {
    const me = await requireMember(ctx, cle);
    const { phase } = await getSettings(ctx);
    if (phase !== "propositions") fail("La phase de propositions est close.");
    const p = rule(() => cleanProposal(input));
    return await ctx.db.insert("proposals", {
      ...p,
      cost: p.suggestedCost,
      validated: false,
      authorId: me._id,
      authorName: fullName(me),
      tieBreak: 0,
    });
  },
});

/**
 * Pendant les propositions : l'auteur ou le bureau modifie tout.
 * Ensuite : seul le bureau peut renommer (titre et détails).
 */
export const update = mutation({
  args: { cle: v.string(), id: v.id("proposals"), ...proposalArgs },
  handler: async (ctx, { cle, id, ...input }) => {
    const me = await requireMember(ctx, cle);
    const p: any = await ctx.db.get(id);
    if (!p) fail("Cette proposition n'existe plus.");
    const { phase } = await getSettings(ctx);
    const isBureau = isBureauRole(me.role);
    const isAuthor = p.authorId === me._id;
    const clean = rule(() => cleanProposal(input));

    if (phase !== "propositions") {
      if (!isBureau) fail("La phase de propositions est close.");
      await ctx.db.patch(id, { title: clean.title, description: clean.description });
      return;
    }
    if (!isAuthor && !isBureau) fail("Vous ne pouvez modifier que vos propres propositions.");

    const patch: Record<string, unknown> = { ...clean };
    // Une modification par l'auteur repasse la proposition « à vérifier » par le bureau.
    if (!isBureau) {
      patch.validated = false;
      if (clean.suggestedCost !== p.suggestedCost) patch.cost = clean.suggestedCost;
    }
    await ctx.db.patch(id, patch);

    const removed = SEASONS.filter((s) => p.seasons.includes(s) && !clean.seasons.includes(s));
    if (removed.length) await deleteVotesOf(ctx, id, removed);
  },
});

export const remove = mutation({
  args: { cle: v.string(), id: v.id("proposals") },
  handler: async (ctx, { cle, id }) => {
    const me = await requireMember(ctx, cle);
    const p: any = await ctx.db.get(id);
    if (!p) return;
    const { phase } = await getSettings(ctx);
    if (phase !== "propositions") fail("La phase de propositions est close.");
    if (p.authorId !== me._id && !isBureauRole(me.role))
      fail("Vous ne pouvez supprimer que vos propres propositions.");
    await deleteVotesOf(ctx, id);
    await ctx.db.delete(id);
  },
});

export const setCost = mutation({
  args: { cle: v.string(), id: v.id("proposals"), cost: v.number() },
  handler: async (ctx, { cle, id, cost }) => {
    await requireBureau(ctx, cle);
    const { phase } = await getSettings(ctx);
    if (phase !== "propositions") fail("Le coût se règle pendant la phase de propositions.");
    if (![1, 2, 3].includes(cost)) fail("Niveau de coût invalide.");
    await ctx.db.patch(id, { cost });
  },
});

/** Le bureau acte (ou annule) son contrôle d'une proposition. */
export const setValidated = mutation({
  args: { cle: v.string(), id: v.id("proposals"), validated: v.boolean() },
  handler: async (ctx, { cle, id, validated }) => {
    await requireBureau(ctx, cle);
    const { phase } = await getSettings(ctx);
    if (phase !== "propositions") fail("La validation se fait pendant la phase de propositions.");
    const p: any = await ctx.db.get(id);
    if (!p) fail("Cette proposition n'existe plus.");
    await ctx.db.patch(id, { validated, cost: p.cost ?? p.suggestedCost });
  },
});

/** Fusionne un doublon dans une autre proposition : saisons réunies, détails conservés. */
export const merge = mutation({
  args: { cle: v.string(), sourceId: v.id("proposals"), targetId: v.id("proposals") },
  handler: async (ctx, { cle, sourceId, targetId }) => {
    await requireBureau(ctx, cle);
    if (sourceId === targetId) fail("Choisissez une autre proposition.");
    const { phase } = await getSettings(ctx);
    if (phase !== "propositions") fail("La fusion se fait pendant la phase de propositions.");
    const src: any = await ctx.db.get(sourceId);
    const tgt: any = await ctx.db.get(targetId);
    if (!src || !tgt) fail("Une des propositions n'existe plus.");

    const seasons = SEASONS.filter((s) => src.seasons.includes(s) || tgt.seasons.includes(s));
    const note = `Fusionné avec « ${src.title} » (${src.authorName})${src.description ? " : " + src.description : ""}`;
    const description = (tgt.description ? tgt.description + "\n\n" : "") + note;
    await ctx.db.patch(targetId, { seasons, description: description.slice(0, 1000) });

    // Les votes n'existent normalement pas encore à ce stade ; par sécurité on les reporte.
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_proposal", (q: any) => q.eq("proposalId", sourceId))
      .collect();
    for (const vote of votes as any[]) {
      const already = await ctx.db
        .query("votes")
        .withIndex("by_member", (q: any) => q.eq("memberId", vote.memberId))
        .collect();
      if (!already.some((x: any) => x.proposalId === targetId)) {
        await ctx.db.insert("votes", { memberId: vote.memberId, proposalId: targetId, season: vote.season });
      }
      await ctx.db.delete(vote._id);
    }
    await ctx.db.delete(sourceId);
  },
});
