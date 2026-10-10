import { internalMutationGeneric as internalMutation } from "convex/server";
import { v } from "convex/values";
import { ensureSettings, fail, newCle } from "./lib";
import { isEmail } from "./rules";

/**
 * Crée le premier membre du bureau. À lancer une seule fois depuis le tableau de bord Convex
 * (Functions → setup:createFirstBureau → Run). Refusé dès qu'un membre du bureau existe.
 */
export const createFirstBureau = internalMutation({
  args: { prenom: v.string(), nom: v.string(), email: v.string() },
  handler: async (ctx, { prenom, nom, email }) => {
    const all: any[] = await ctx.db.query("members").collect();
    if (all.some((m) => m.role === "admin"))
      fail("Un gestionnaire existe déjà. Les autres membres se gèrent depuis l'onglet Gestion du site.");
    const mail = email.trim().toLowerCase();
    if (!isEmail(mail)) fail("Adresse e-mail invalide.");
    await ensureSettings(ctx);
    const cle = newCle();
    await ctx.db.insert("members", { prenom: prenom.trim(), nom: nom.trim(), email: mail, role: "admin", cle });
    return {
      cle,
      consigne: `Ouvrez l'adresse du site suivie de ?cle=${cle}`,
    };
  },
});

/**
 * Donne le rôle « Gestion » (accès aux e-mails et aux liens) à un membre existant.
 * À lancer depuis le tableau de bord Convex (Functions → setup:makeAdmin).
 */
export const makeAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const mail = email.trim().toLowerCase();
    const m: any = await ctx.db
      .query("members")
      .withIndex("by_email", (q: any) => q.eq("email", mail))
      .first();
    if (!m) fail("Aucun membre avec cette adresse.");
    await ctx.db.patch(m._id, { role: "admin" });
    return `${m.prenom} ${m.nom} a maintenant le rôle Gestion.`;
  },
});
