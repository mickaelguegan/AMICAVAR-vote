import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { v } from "convex/values";
import { phaseV, roleV } from "./schema";
import { countBureau, ensureSettings, fail, newCle, requireBureau } from "./lib";
import { isEmail, PHASE_LABEL } from "./rules";

/** Liste complète des membres avec e-mails et clés : réservée au bureau. */
export const members = query({
  args: { cle: v.string() },
  handler: async (ctx, { cle }) => {
    await requireBureau(ctx, cle);
    const all: any[] = await ctx.db.query("members").collect();
    const votes: any[] = await ctx.db.query("votes").collect();
    return all
      .map((m) => ({
        id: m._id as string,
        prenom: m.prenom as string,
        nom: m.nom as string,
        email: m.email as string,
        role: m.role as "membre" | "bureau",
        cle: m.cle as string,
        voteCount: votes.filter((x) => x.memberId === m._id).length,
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr"));
  },
});

export const setPhase = mutation({
  args: { cle: v.string(), phase: phaseV },
  handler: async (ctx, { cle, phase }) => {
    await requireBureau(ctx, cle);
    const settings = await ensureSettings(ctx);
    if (phase === "vote") {
      const proposals: any[] = await ctx.db.query("proposals").collect();
      if (proposals.length === 0) fail("Il n'y a aucune proposition à soumettre au vote.");
      const missing = proposals.filter((p) => p.cost == null).length;
      if (missing > 0)
        fail(
          `Validez le coût de ${missing} proposition${missing > 1 ? "s" : ""} avant d'ouvrir le vote.`,
        );
    }
    await ctx.db.patch(settings._id, { phase });
    return PHASE_LABEL[phase as keyof typeof PHASE_LABEL];
  },
});

export const setTieBreak = mutation({
  args: { cle: v.string(), proposalId: v.id("proposals"), value: v.number() },
  handler: async (ctx, { cle, proposalId, value }) => {
    await requireBureau(ctx, cle);
    await ctx.db.patch(proposalId, { tieBreak: value });
  },
});

/** Ajoute ou met à jour des membres (rapprochement par e-mail). Les liens existants sont conservés. */
export const importMembers = mutation({
  args: {
    cle: v.string(),
    rows: v.array(v.object({ prenom: v.string(), nom: v.string(), email: v.string(), role: roleV })),
  },
  handler: async (ctx, { cle, rows }) => {
    const me = await requireBureau(ctx, cle);
    let added = 0;
    let updated = 0;
    for (const r of rows) {
      const email = r.email.trim().toLowerCase();
      if (!isEmail(email)) fail(`Adresse e-mail invalide : ${r.email}`);
      const prenom = r.prenom.trim();
      const nom = r.nom.trim();
      if (!prenom || !nom) fail(`Prénom ou nom manquant pour ${email}.`);
      const existing: any = await ctx.db
        .query("members")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .first();
      if (existing) {
        // On ne se retire jamais soi-même le rôle bureau par un import.
        const role = existing._id === me._id ? "bureau" : r.role;
        await ctx.db.patch(existing._id, { prenom, nom, role });
        updated++;
      } else {
        await ctx.db.insert("members", { prenom, nom, email, role: r.role, cle: newCle() });
        added++;
      }
    }
    return { added, updated };
  },
});

export const setRole = mutation({
  args: { cle: v.string(), id: v.id("members"), role: roleV },
  handler: async (ctx, { cle, id, role }) => {
    const me = await requireBureau(ctx, cle);
    if (id === me._id && role !== "bureau") fail("Vous ne pouvez pas retirer votre propre rôle bureau.");
    await ctx.db.patch(id, { role });
  },
});

export const updateMember = mutation({
  args: { cle: v.string(), id: v.id("members"), prenom: v.string(), nom: v.string(), email: v.string() },
  handler: async (ctx, { cle, id, prenom, nom, email }) => {
    await requireBureau(ctx, cle);
    const mail = email.trim().toLowerCase();
    if (!isEmail(mail)) fail("Adresse e-mail invalide.");
    if (!prenom.trim() || !nom.trim()) fail("Prénom et nom obligatoires.");
    const other: any = await ctx.db
      .query("members")
      .withIndex("by_email", (q: any) => q.eq("email", mail))
      .first();
    if (other && other._id !== id) fail("Cette adresse est déjà utilisée par un autre membre.");
    await ctx.db.patch(id, { prenom: prenom.trim(), nom: nom.trim(), email: mail });
  },
});

/** Supprime un membre et ses votes. Ses propositions restent, signées de son nom. */
export const removeMember = mutation({
  args: { cle: v.string(), id: v.id("members") },
  handler: async (ctx, { cle, id }) => {
    const me = await requireBureau(ctx, cle);
    if (id === me._id) fail("Vous ne pouvez pas vous supprimer vous-même.");
    const votes: any[] = await ctx.db
      .query("votes")
      .withIndex("by_member", (q: any) => q.eq("memberId", id))
      .collect();
    for (const x of votes) await ctx.db.delete(x._id);
    await ctx.db.delete(id);
  },
});

/** Remplace le lien personnel d'un membre : l'ancien cesse immédiatement de fonctionner. */
export const regenerateCle = mutation({
  args: { cle: v.string(), id: v.id("members") },
  handler: async (ctx, { cle, id }) => {
    const me = await requireBureau(ctx, cle);
    const fresh = newCle();
    await ctx.db.patch(id, { cle: fresh });
    // Si un membre du bureau régénère son propre lien, l'interface doit basculer sur le nouveau.
    return id === me._id ? fresh : null;
  },
});

/** Vide propositions et votes, et revient en phase de propositions. Les membres sont conservés. */
export const resetCampaign = mutation({
  args: { cle: v.string(), confirmation: v.string() },
  handler: async (ctx, { cle, confirmation }) => {
    await requireBureau(ctx, cle);
    if (confirmation.trim().toUpperCase() !== "REINITIALISER")
      fail("Tapez REINITIALISER pour confirmer.");
    for (const x of await ctx.db.query("votes").collect()) await ctx.db.delete(x._id);
    for (const p of await ctx.db.query("proposals").collect()) await ctx.db.delete(p._id);
    const settings = await ensureSettings(ctx);
    await ctx.db.patch(settings._id, { phase: "propositions" });
  },
});

/** Compteur utilisé par l'interface pour éviter de retirer le dernier membre du bureau. */
export const bureauCount = query({
  args: { cle: v.string() },
  handler: async (ctx, { cle }) => {
    await requireBureau(ctx, cle);
    return await countBureau(ctx);
  },
});
