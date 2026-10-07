// Tests des règles de vote et d'attribution. Lancer : npm test
import assert from "node:assert/strict";
import { allocate, cleanProposal, decideVote, parseMembers, RuleError, type MyVote } from "../convex/rules";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log("ok  -", name);
  } catch (e) {
    console.error("ÉCHEC -", name);
    throw e;
  }
}

const base = {
  phase: "vote" as const,
  proposalId: "x",
  proposalSeasons: ["P", "A"] as ("P" | "E" | "A")[],
  proposalCost: 2,
  season: "P" as const,
  myVotes: [] as MyVote[],
  budget: 12,
  perSeason: 2,
};

test("vote accepté quand tout est en règle", () => {
  assert.deepEqual(decideVote(base), { kind: "add" });
});

test("vote refusé hors phase de vote", () => {
  assert.equal(decideVote({ ...base, phase: "propositions" }).kind, "refuse");
});

test("une seule voix par activité, toutes saisons confondues", () => {
  const d = decideVote({ ...base, season: "A", myVotes: [{ proposalId: "x", season: "P", cost: 2 }] });
  assert.equal(d.kind, "refuse");
});

test("recliquer dans la même saison retire la voix", () => {
  const d = decideVote({ ...base, myVotes: [{ proposalId: "x", season: "P", cost: 2 }] });
  assert.deepEqual(d, { kind: "remove" });
});

test("2 voix maximum par saison", () => {
  const myVotes: MyVote[] = [
    { proposalId: "a", season: "P", cost: 1 },
    { proposalId: "b", season: "P", cost: 1 },
  ];
  assert.equal(decideVote({ ...base, myVotes }).kind, "refuse");
  assert.equal(decideVote({ ...base, season: "A", myVotes }).kind, "add");
});

test("budget de 12 respecté", () => {
  const myVotes: MyVote[] = [
    { proposalId: "a", season: "E", cost: 3 },
    { proposalId: "b", season: "E", cost: 3 },
    { proposalId: "c", season: "A", cost: 3 },
    { proposalId: "d", season: "P", cost: 2 },
  ]; // 11 dépensés
  assert.equal(decideVote({ ...base, myVotes }).kind, "refuse"); // 11 + 2 > 12
  assert.equal(decideVote({ ...base, proposalCost: 1, myVotes }).kind, "add"); // 11 + 1 = 12
});

test("coût non validé : vote impossible", () => {
  assert.equal(decideVote({ ...base, proposalCost: null }).kind, "refuse");
});

test("saison non proposée : vote impossible", () => {
  assert.equal(decideVote({ ...base, season: "E" }).kind, "refuse");
});

test("attribution : multi-saisons placée une seule fois, dans sa saison préférée", () => {
  const P = (id: string, seasons: ("P" | "E" | "A")[]) => ({ id, title: id, seasons, cost: 1, tieBreak: 0 });
  const proposals = [P("monument", ["P", "A"]), P("accro", ["P"]), P("kayak", ["E"]), P("vendanges", ["A"])];
  const votes = [
    ...Array(18).fill({ proposalId: "monument", season: "P" }),
    ...Array(12).fill({ proposalId: "monument", season: "A" }),
    ...Array(22).fill({ proposalId: "accro", season: "P" }),
    ...Array(10).fill({ proposalId: "kayak", season: "E" }),
    ...Array(8).fill({ proposalId: "vendanges", season: "A" }),
  ];
  const { slots, rows } = allocate(proposals, votes);
  assert.equal(slots.P.A?.proposal.id, "monument");
  assert.equal(slots.P.B?.proposal.id, "accro");
  assert.equal(slots.A.A?.proposal.id, "vendanges");
  assert.equal(slots.E.A?.proposal.id, "kayak");
  assert.equal(rows.filter((r) => r.proposal.id === "monument" && r.placed).length, 1);
});

test("attribution : saison préférée prise, l'activité va dans son autre saison", () => {
  const P = (id: string, seasons: ("P" | "E" | "A")[]) => ({ id, title: id, seasons, cost: 1, tieBreak: 0 });
  const proposals = [P("a", ["P"]), P("b", ["P", "A"])];
  const votes = [
    ...Array(10).fill({ proposalId: "a", season: "P" }),
    ...Array(6).fill({ proposalId: "b", season: "P" }),
    ...Array(2).fill({ proposalId: "b", season: "A" }),
  ];
  const { slots } = allocate(proposals, votes);
  assert.equal(slots.P.A?.proposal.id, "a");
  assert.equal(slots.A.A?.proposal.id, "b");
  assert.equal(slots.P.B, null);
});

test("égalités signalées puis tranchées par l'arbitrage", () => {
  const P = (id: string, tieBreak = 0) => ({ id, title: id, seasons: ["E"] as ("E")[], cost: 1, tieBreak });
  const votes = [
    ...Array(5).fill({ proposalId: "a", season: "E" }),
    ...Array(5).fill({ proposalId: "b", season: "E" }),
  ];
  const open = allocate([P("a"), P("b")], votes);
  assert.equal(open.rows[0].tie, "open");
  const settled = allocate([P("a"), P("b", 1)], votes);
  assert.equal(settled.slots.E.A?.proposal.id, "b");
  assert.equal(settled.rows[0].tie, "settled");
});

test("égalité avec la première activité non retenue", () => {
  const P = (id: string) => ({ id, title: id, seasons: ["E"] as ("E")[], cost: 1, tieBreak: 0 });
  const votes = [
    ...Array(9).fill({ proposalId: "a", season: "E" }),
    ...Array(4).fill({ proposalId: "b", season: "E" }),
    ...Array(4).fill({ proposalId: "c", season: "E" }),
  ];
  const { rows } = allocate([P("a"), P("b"), P("c")], votes);
  const b = rows.find((r) => r.placed?.plan === "B")!;
  assert.equal(b.tie, "open");
});

test("proposition : validation et nettoyage", () => {
  const ok = cleanProposal({ title: "  Kayak   Verdon ", description: "", seasons: ["E", "Z"], suggestedCost: 2 });
  assert.equal(ok.title, "Kayak Verdon");
  assert.deepEqual(ok.seasons, ["E"]);
  assert.throws(() => cleanProposal({ title: "Ka", description: "", seasons: ["E"], suggestedCost: 2 }), RuleError);
  assert.throws(() => cleanProposal({ title: "Kayak", description: "", seasons: [], suggestedCost: 2 }), RuleError);
  assert.throws(() => cleanProposal({ title: "Kayak", description: "", seasons: ["E"], suggestedCost: 4 }), RuleError);
});

test("import des membres depuis Excel", () => {
  const { rows, errors } = parseMembers(
    "Prénom\tNom\tE-mail\tRôle\nSophie\tMartin\tSophie.Martin@exemple.fr\tBureau\nKarim\tBenali\tkarim@exemple.fr\t\nX\tY\tpas-un-mail\tmembre",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].email, "sophie.martin@exemple.fr");
  assert.equal(rows[0].role, "bureau");
  assert.equal(rows[1].role, "membre");
  assert.equal(errors.length, 1);
});

console.log(`\n${passed} tests réussis.`);
