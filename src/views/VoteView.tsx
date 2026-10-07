import { useState } from "react";
import { useMutation } from "convex/react";
import { api, type AppState } from "../api";
import { Chips, Cost, initials, useRun } from "../ui";
import { decideVote, euros, SEASON_LABEL, SEASONS, type MyVote, type Season } from "../../convex/rules";

export default function VoteView({ state, cle }: { state: AppState; cle: string }) {
  const { me, settings, proposals, votes } = state;
  const { phase, budget, perSeason } = settings;
  const open = phase === "vote";
  const toggle = useMutation(api.votes.toggle);
  const run = useRun();
  const [busy, setBusy] = useState<string | null>(null);

  const costOf = new Map(proposals.map((p) => [p.id, p.cost ?? 0]));
  const myVotes: MyVote[] = votes
    .filter((v) => v.memberId === me.id)
    .map((v) => ({ proposalId: v.proposalId, season: v.season, cost: costOf.get(v.proposalId) ?? 0 }));
  const spent = myVotes.reduce((t, v) => t + v.cost, 0);
  const mine = new Map(myVotes.map((v) => [v.proposalId, v.season]));

  async function click(proposalId: string, season: Season) {
    const key = proposalId + season;
    setBusy(key);
    await run(() => toggle({ cle, proposalId, season }));
    setBusy(null);
  }

  return (
    <>
      {!open && (
        <div className="notice">
          {phase === "propositions"
            ? "Le vote n'est pas encore ouvert. Voici les propositions classées par saison."
            : "Le vote est clos. Consultez l'onglet Résultats."}
        </div>
      )}
      <div className="ballot-head">
        <div>
          <h2>Mon bulletin</h2>
          <p className="muted small rules">
            {perSeason} voix maximum par saison. Une activité possible sur plusieurs saisons ne reçoit qu'une voix de
            votre part : placez-la dans la saison que vous préférez, elle compte pour son total. Chaque voix coûte le
            niveau de prix de l'activité. Vous pouvez modifier votre bulletin jusqu'à la clôture.
          </p>
        </div>
        <div className="budget" aria-label={`Budget utilisé : ${spent} sur ${budget}`}>
          <div className="label">Budget utilisé</div>
          <div className="big">
            {spent} / {budget} €
          </div>
          <div className="coins" aria-hidden="true">
            {Array.from({ length: budget }, (_, i) => (
              <span key={i} className={`coin ${i < spent ? "used" : ""}`}>
                €
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="cols">
        {SEASONS.map((s) => {
          const items = proposals
            .filter((p) => p.seasons.includes(s))
            .sort((a, b) => a.title.localeCompare(b.title, "fr"));
          const n = myVotes.filter((v) => v.season === s).length;
          return (
            <section key={s} className={`col s-${s}`}>
              <div className="col-head">
                <h3>{SEASON_LABEL[s]}</h3>
                <div className="slots" title={`${n} voix sur ${perSeason}`}>
                  {Array.from({ length: perSeason }, (_, i) => (
                    <span key={i} className={`slot ${i < n ? "full" : ""}`} />
                  ))}
                </div>
              </div>
              {items.length === 0 && <p className="small muted">Aucune activité proposée pour cette saison.</p>}
              {items.map((p) => {
                const myS = mine.get(p.id);
                const voters = votes.filter((v) => v.proposalId === p.id && v.season === s);
                const total = votes.filter((v) => v.proposalId === p.id).length;
                const d = decideVote({
                  phase,
                  proposalId: p.id,
                  proposalSeasons: p.seasons,
                  proposalCost: p.cost,
                  season: s,
                  myVotes,
                  budget,
                  perSeason,
                });
                const cls = myS === s ? "mine" : myS ? "elsewhere" : "";
                const why = d.kind === "refuse" && open ? d.reason : "";
                return (
                  <div key={p.id} className={`vcard ${cls}`}>
                    <div className="vrow">
                      <strong>{p.title}</strong>
                      <Cost cost={p.cost} />
                    </div>
                    {p.seasons.length > 1 && (
                      <div className="meta">
                        <Chips seasons={p.seasons} />
                        <span className="small muted">
                          {total} voix au total
                        </span>
                      </div>
                    )}
                    <div className="vrow">
                      <div className="voters" aria-label={`${voters.length} voix en ${SEASON_LABEL[s]}`}>
                        {voters.length === 0 ? (
                          <span className="small muted">Aucune voix</span>
                        ) : (
                          voters.map((v) => (
                            <span
                              key={v.memberId}
                              className={`av ${v.memberId === me.id ? "me" : ""}`}
                              title={v.memberName}
                            >
                              {initials(v.memberName)}
                            </span>
                          ))
                        )}
                      </div>
                      {open && (
                        <button
                          className={`vbtn ${myS === s ? "on" : ""}`}
                          disabled={d.kind === "refuse" || busy === p.id + s}
                          onClick={() => click(p.id, s)}
                        >
                          {myS === s ? "Voté · retirer" : `Voter · ${p.cost ? euros(p.cost) : "?"}`}
                        </button>
                      )}
                    </div>
                    {why && <div className="why">{why}</div>}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}
