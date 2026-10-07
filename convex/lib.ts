import type { GenericDataModel, GenericMutationCtx, GenericQueryCtx } from "convex/server";
import { ConvexError } from "convex/values";
import { DEFAULT_BUDGET, DEFAULT_PER_SEASON, RuleError, type Phase } from "./rules";

export type QCtx = GenericQueryCtx<GenericDataModel>;
export type MCtx = GenericMutationCtx<GenericDataModel>;

export type Member = {
  _id: any;
  prenom: string;
  nom: string;
  email: string;
  role: "membre" | "bureau";
  cle: string;
};

export type Settings = { _id?: any; phase: Phase; budget: number; perSeason: number };

export function fail(message: string): never {
  throw new ConvexError(message);
}

/** Exécute une règle métier et transforme ses erreurs en message lisible côté client. */
export function rule<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof RuleError) fail(e.message);
    throw e;
  }
}

export async function memberFromCle(ctx: QCtx, cle: string): Promise<Member | null> {
  if (!cle || cle.length < 16) return null;
  const m = await ctx.db
    .query("members")
    .withIndex("by_cle", (q: any) => q.eq("cle", cle))
    .unique();
  return (m as Member | null) ?? null;
}

export async function requireMember(ctx: QCtx, cle: string): Promise<Member> {
  const m = await memberFromCle(ctx, cle);
  if (!m) fail("Lien non reconnu. Utilisez le lien personnel reçu par e-mail.");
  return m;
}

export async function requireBureau(ctx: QCtx, cle: string): Promise<Member> {
  const m = await requireMember(ctx, cle);
  if (m.role !== "bureau") fail("Action réservée au bureau.");
  return m;
}

export async function getSettings(ctx: QCtx): Promise<Settings> {
  const s = await ctx.db.query("settings").first();
  return (s as Settings | null) ?? { phase: "propositions", budget: DEFAULT_BUDGET, perSeason: DEFAULT_PER_SEASON };
}

export async function ensureSettings(ctx: MCtx): Promise<Settings & { _id: any }> {
  const s = await ctx.db.query("settings").first();
  if (s) return s as Settings & { _id: any };
  const doc = { phase: "propositions" as Phase, budget: DEFAULT_BUDGET, perSeason: DEFAULT_PER_SEASON };
  const _id = await ctx.db.insert("settings", doc);
  return { _id, ...doc };
}

export function fullName(m: { prenom: string; nom: string }): string {
  return `${m.prenom} ${m.nom}`.trim();
}

/** Clé secrète de 32 caractères, impossible à deviner. */
export function newCle(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  for (const b of bytes) out += alphabet[b & 63];
  // 24 octets × 6 bits = 144 bits d'entropie ; on complète pour une longueur fixe.
  const extra = new Uint8Array(8);
  crypto.getRandomValues(extra);
  for (const b of extra) out += alphabet[b & 63];
  return out;
}

export async function deleteVotesOf(ctx: MCtx, proposalId: any, onlySeasons?: string[]) {
  const votes = await ctx.db
    .query("votes")
    .withIndex("by_proposal", (q: any) => q.eq("proposalId", proposalId))
    .collect();
  for (const v of votes) {
    if (!onlySeasons || onlySeasons.includes((v as any).season)) await ctx.db.delete(v._id);
  }
}

export async function countBureau(ctx: QCtx): Promise<number> {
  const all = await ctx.db.query("members").collect();
  return all.filter((m: any) => m.role === "bureau").length;
}
