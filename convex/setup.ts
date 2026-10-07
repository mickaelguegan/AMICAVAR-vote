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
    if (all.some((m) => m.role === "bureau"))
      fail("Un membre du bureau existe déjà. Les autres membres se gèrent depuis l'espace Bureau du site.");
    const mail = email.trim().toLowerCase();
    if (!isEmail(mail)) fail("Adresse e-mail invalide.");
    await ensureSettings(ctx);
    const cle = newCle();
    await ctx.db.insert("members", { prenom: prenom.trim(), nom: nom.trim(), email: mail, role: "bureau", cle });
    return {
      cle,
      consigne: `Ouvrez l'adresse du site suivie de ?cle=${cle}`,
    };
  },
});
