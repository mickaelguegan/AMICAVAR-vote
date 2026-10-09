// Règles métier pures, partagées entre le serveur Convex et l'interface.
// Aucune dépendance : ce fichier est testé directement (voir tests/rules.test.ts).

export type Season = "P" | "E" | "A";
export type Phase = "propositions" | "vote" | "resultats";
export type Role = "membre" | "bureau";

export const SEASONS: Season[] = ["P", "E", "A"];
export const SEASON_LABEL: Record<Season, string> = { P: "Printemps", E: "Été", A: "Automne" };
export const PHASES: Phase[] = ["propositions", "vote", "resultats"];
export const PHASE_LABEL: Record<Phase, string> = {
  propositions: "Propositions",
  vote: "Vote",
  resultats: "Résultats",
};
export const DEFAULT_BUDGET = 12;
export const DEFAULT_PER_SEASON = 2;
export const COST_LABEL: Record<number, string> = { 1: "moins de 15 €", 2: "15 à 30 €", 3: "plus de 30 €" };

/** « 1 jeton », « 3 jetons » : l'unité du budget de vote. */
export function jetons(n: number): string {
  return `${n} jeton${n > 1 ? "s" : ""}`;
}

/* ---------- Propositions ---------- */

export type ProposalInput = {
  title: string;
  description: string;
  seasons: string[];
  suggestedCost: number;
};

/** Nettoie et valide une proposition. Renvoie la version propre ou lève une erreur lisible. */
export function cleanProposal(input: ProposalInput): {
  title: string;
  description: string;
  seasons: Season[];
  suggestedCost: number;
} {
  const title = input.title.trim().replace(/\s+/g, " ");
  const description = input.description.trim();
  const seasons = SEASONS.filter((s) => input.seasons.includes(s));
  if (title.length < 3) throw new RuleError("Donnez un nom à l'activité (3 caractères minimum).");
  if (title.length > 120) throw new RuleError("Le nom de l'activité est trop long (120 caractères maximum).");
  if (description.length > 1000) throw new RuleError("Les détails sont trop longs (1000 caractères maximum).");
  if (seasons.length === 0) throw new RuleError("Cochez au moins une saison.");
  if (![1, 2, 3].includes(input.suggestedCost)) throw new RuleError("Indiquez un coût estimé.");
  return { title, description, seasons, suggestedCost: input.suggestedCost };
}

export class RuleError extends Error {}

/* ---------- Vote ---------- */

export type MyVote = { proposalId: string; season: Season; cost: number };

export type VoteDecision =
  | { kind: "add" }
  | { kind: "remove" }
  | { kind: "refuse"; reason: string };

/**
 * Décide ce que donne un clic « Voter » d'un membre sur une activité dans une saison.
 * Règles : 1 voix par activité toutes saisons confondues, `perSeason` voix par saison,
 * budget total plafonné, coût validé obligatoire.
 */
export function decideVote(args: {
  phase: Phase;
  proposalId: string;
  proposalSeasons: Season[];
  proposalCost: number | null;
  season: Season;
  myVotes: MyVote[];
  budget: number;
  perSeason: number;
}): VoteDecision {
  const { phase, proposalId, proposalSeasons, proposalCost, season, myVotes, budget, perSeason } = args;
  if (phase !== "vote") return { kind: "refuse", reason: "Le vote n'est pas ouvert." };
  if (!proposalSeasons.includes(season))
    return { kind: "refuse", reason: `Cette activité n'est pas proposée en ${SEASON_LABEL[season]}.` };

  const existing = myVotes.find((v) => v.proposalId === proposalId);
  if (existing) {
    if (existing.season === season) return { kind: "remove" };
    return { kind: "refuse", reason: `Votre voix est déjà en ${SEASON_LABEL[existing.season]}.` };
  }
  if (proposalCost == null) return { kind: "refuse", reason: "Proposition pas encore validée par le bureau." };

  const inSeason = myVotes.filter((v) => v.season === season).length;
  if (inSeason >= perSeason)
    return { kind: "refuse", reason: `${perSeason} voix déjà utilisées en ${SEASON_LABEL[season]}.` };

  const spent = myVotes.reduce((t, v) => t + v.cost, 0);
  if (spent + proposalCost > budget)
    return { kind: "refuse", reason: `Il vous reste ${jetons(budget - spent)}, il en faut ${proposalCost}.` };

  return { kind: "add" };
}

/* ---------- Résultats ---------- */

export type ResultProposal = {
  id: string;
  title: string;
  seasons: Season[];
  cost: number | null;
  tieBreak: number;
};
export type ResultVote = { proposalId: string; season: Season };

export type ResultRow = {
  proposal: ResultProposal;
  per: Record<Season, number>;
  total: number;
  placed: { season: Season; plan: "A" | "B" } | null;
  /** "none" : pas d'égalité ; "open" : égalité à trancher ; "settled" : égalité tranchée par le bureau. */
  tie: "none" | "open" | "settled";
};

export type Allocation = {
  rows: ResultRow[];
  slots: Record<Season, { A: ResultRow | null; B: ResultRow | null }>;
};

/**
 * Attribution gloutonne : activités triées par total de voix (puis arbitrage du bureau),
 * chacune placée dans la saison où elle a reçu le plus de voix si le plan A y est libre,
 * sinon dans une autre de ses saisons, sinon en plan B. Une activité n'occupe qu'un créneau.
 */
export function allocate(proposals: ResultProposal[], votes: ResultVote[]): Allocation {
  const rows: ResultRow[] = proposals.map((p) => {
    const per: Record<Season, number> = { P: 0, E: 0, A: 0 };
    for (const v of votes) if (v.proposalId === p.id) per[v.season]++;
    return { proposal: p, per, total: per.P + per.E + per.A, placed: null, tie: "none" };
  });
  rows.sort(
    (a, b) =>
      b.total - a.total ||
      b.proposal.tieBreak - a.proposal.tieBreak ||
      a.proposal.title.localeCompare(b.proposal.title, "fr"),
  );

  const slots: Allocation["slots"] = {
    P: { A: null, B: null },
    E: { A: null, B: null },
    A: { A: null, B: null },
  };
  for (const r of rows) {
    if (r.total === 0) continue;
    const pref = SEASONS.filter((s) => r.proposal.seasons.includes(s)).sort(
      (x, y) => r.per[y] - r.per[x] || SEASONS.indexOf(x) - SEASONS.indexOf(y),
    );
    for (const plan of ["A", "B"] as const) {
      const s = pref.find((s) => !slots[s][plan]);
      if (s) {
        slots[s][plan] = r;
        r.placed = { season: s, plan };
        break;
      }
    }
  }

  // Une égalité compte si une activité retenue partage son total avec une autre en lice
  // (une autre retenue, ou la première non retenue).
  const firstOut = rows.find((r) => r.total > 0 && !r.placed);
  const contenders = rows.filter((r) => r.placed).concat(firstOut ? [firstOut] : []);
  for (const r of contenders) {
    const same = contenders.filter((o) => o.total === r.total);
    if (same.length < 2) continue;
    const breaks = new Set(same.map((o) => o.proposal.tieBreak));
    r.tie = breaks.size === same.length ? "settled" : "open";
  }
  return { rows, slots };
}

/* ---------- Import des membres ---------- */

export type MemberRow = { prenom: string; nom: string; email: string; role: Role };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lit un collage depuis Excel (tabulations) ou un CSV (; ou ,). Colonnes : Prénom, Nom, E-mail, Rôle. */
export function parseMembers(text: string): { rows: MemberRow[]; errors: string[] } {
  const rows: MemberRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const email = (cells[2] ?? "").toLowerCase();
    if (i === 0 && !email.includes("@")) return; // ligne d'en-tête
    if (!EMAIL_RE.test(email)) {
      errors.push(`Ligne ${i + 1} : adresse e-mail invalide (« ${cells[2] ?? ""} »).`);
      return;
    }
    if (!cells[0] || !cells[1]) {
      errors.push(`Ligne ${i + 1} : prénom ou nom manquant.`);
      return;
    }
    const roleCell = (cells[3] ?? "").toLowerCase();
    rows.push({ prenom: cells[0], nom: cells[1], email, role: roleCell.startsWith("bur") ? "bureau" : "membre" });
  });
  return { rows, errors };
}

export function isEmail(s: string): boolean {
  return EMAIL_RE.test(s);
}
