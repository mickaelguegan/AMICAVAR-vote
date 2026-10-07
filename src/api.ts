import { anyApi } from "convex/server";
import type { Phase, Role, Season } from "../convex/rules";

// Références non typées vers les fonctions Convex : pas besoin du code généré pour construire le site.
export const api: any = anyApi;

export type Proposal = {
  id: string;
  title: string;
  description: string;
  seasons: Season[];
  suggestedCost: number;
  cost: number | null;
  authorId: string;
  authorName: string;
  tieBreak: number;
  createdAt: number;
};

export type Vote = { proposalId: string; season: Season; memberId: string; memberName: string };

export type AppState = {
  me: { id: string; prenom: string; nom: string; role: Role };
  settings: { phase: Phase; budget: number; perSeason: number };
  memberCount: number;
  proposals: Proposal[];
  votes: Vote[];
};

export type MemberAdmin = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  role: Role;
  cle: string;
  voteCount: number;
};
