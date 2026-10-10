import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const seasonV = v.union(v.literal("P"), v.literal("E"), v.literal("A"));
export const phaseV = v.union(v.literal("propositions"), v.literal("vote"), v.literal("resultats"));
// « admin » = gestion des membres (e-mails, liens personnels) : à réserver à une ou deux personnes.
export const roleV = v.union(v.literal("membre"), v.literal("bureau"), v.literal("admin"));

export default defineSchema({
  // Un seul document : la campagne en cours.
  settings: defineTable({
    phase: phaseV,
    budget: v.number(),
    perSeason: v.number(),
    // Adresse de contact affichée dans la note « Traitement des données ».
    contactEmail: v.optional(v.string()),
  }),

  // Liste blanche des membres. `cle` est le secret du lien personnel.
  members: defineTable({
    prenom: v.string(),
    nom: v.string(),
    email: v.string(),
    role: roleV,
    cle: v.string(),
  })
    .index("by_cle", ["cle"])
    .index("by_email", ["email"]),

  proposals: defineTable({
    title: v.string(),
    description: v.string(),
    seasons: v.array(seasonV),
    suggestedCost: v.number(),
    // Niveau de coût en jetons (1 à 3). Anciennes données : null tant que non validé.
    cost: v.union(v.number(), v.null()),
    // Contrôle du bureau effectué (coût vérifié, doublons traités).
    validated: v.optional(v.boolean()),
    authorId: v.id("members"),
    authorName: v.string(),
    // Arbitrage des égalités par le bureau : plus grand = classé devant.
    tieBreak: v.number(),
  }),

  votes: defineTable({
    memberId: v.id("members"),
    proposalId: v.id("proposals"),
    season: seasonV,
  })
    .index("by_member", ["memberId"])
    .index("by_proposal", ["proposalId"]),
});
