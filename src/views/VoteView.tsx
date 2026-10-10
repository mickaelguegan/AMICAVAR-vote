import { useState } from "react";
import { useMutation } from "convex/react";
import { api, type AppState } from "../api";
import { Cost, initials, Jeton, SeasonBand, useRun } from "../ui";
import { decideVote, SEASON_LABEL, SEASONS, type MyVote, type Season } from "../../convex/rules";

export default function VoteView({ state, cle }: { state: AppState; cle: string }) {
  const { me, settings, proposals, votes } = state;
  const { phase, budget, perSeason } = settings;
  const open = phase === "vote";
  const toggle = useMutation(api.votes.toggle);
  const run = useRun();
  const [busy, setBusy] = useState<string | null>(null);

  const costOf = new Map(proposals.map((p) => [p.id, p.cost]));
  const myVotes: MyVote[] = votes
    .filter((v) => v.memberId === me.id)
    .map((v) => ({ proposalId: v.proposalId, season: v.season, cost: costOf.get(v.proposalId) ?? 0 }));
  const spent = myVotes.reduce((t, v) => t + v.cost, 0);
  const left = budget - spent;
  const mine = new Map(myVotes.map((v) => [v.proposalId, v.season]));

  async function click(proposalId: string, season: Season) {
    setBusy(proposalId + season);
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
            {perSeason} voix au plus par saison. Une sortie possible sur plusieurs saisons ne reçoit qu'une voix de votre
            part : placez-la dans la saison que vous préférez. Chaque voix coûte des jetons selon le prix de la sortie.
            Vous pouvez changer d'avis jusqu'à la clôture. Votre vote est visible des autres membres, comme à main levée.
          </p>
        </div>
        <div className="purse" aria-label={`Il vous reste ${left} jetons sur ${budget}`}>
          <div className="purse-count">
            Il vous reste <strong>{left}</strong> / {budget}
          </div>
          <div className="purse-row" aria-hidden="true">
            {Array.from({ length: budget }, (_, i) => (
              <Jeton key={i} size={24} faded={i >= left} />
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
            <section key={s} className={`postcard s-${s}`}>
              <SeasonBand season={s} right={`${n} voix sur ${perSeason}`} />
              <div className="postcard-body">
                {items.length === 0 && <p className="small muted pad">Aucune sortie proposée pour cette saison.</p>}
                {items.map((p) => {
                  const myS = mine.get(p.id);
                  const voters = votes.filter((v) => v.proposalId === p.id && v.season === s);
                  const total = votes.filter((v) => v.proposalId === p.id).length;
                  const others = p.seasons.filter((x) => x !== s).map((x) => SEASON_LABEL[x].toLowerCase());
                  const d = decideVote({
                    phase,
                    proposalId: p.id,
                    proposalSeasons: p.seasons,
                    proposalCost: p.validated ? p.cost : null,
                    season: s,
                    myVotes,
                    budget,
                    perSeason,
                  });

                  if (myS && myS !== s)
                    return (
                      <div key={p.id} className="vcard elsewhere">
                        <strong>{p.title}</strong>
                        <span className="small">Votre voix est déjà {myS === "E" ? "en" : "au"} {SEASON_LABEL[myS].toLowerCase()}</span>
                      </div>
                    );

                  const voted = myS === s;
                  const why = d.kind === "refuse" && open ? d.reason : "";
                  return (
                    <div key={p.id} className={`vcard ${voted ? "voted" : ""}`}>
                      <div className="vrow">
                        <div className="vtext">
                          <strong>{p.title}</strong>
                          <span className="small sub">
                            {voted ? "Votre vote · " : ""}
                            {total} voix{others.length && !voted ? ` · aussi possible en ${others.join(", ")}` : voted ? " au total" : ""}
                          </span>
                        </div>
                        <Cost cost={p.cost} />
                      </div>
                      {(voters.length > 0 || open) && (
                        <div className="vrow">
                          <div className="voters" aria-label={`${voters.length} voix en ${SEASON_LABEL[s]}`}>
                            {voters.map((v) => (
                              <span key={v.memberId} className={`av ${v.memberId === me.id ? "me" : ""}`} title={v.memberName}>
                                {initials(v.memberName)}
                              </span>
                            ))}
                          </div>
                          {open && (
                            <button
                              className={`vbtn ${voted ? "on" : ""}`}
                              disabled={d.kind === "refuse" || busy === p.id + s}
                              onClick={() => click(p.id, s)}
                            >
                              {voted ? "Retirer mon vote" : "Voter"}
                            </button>
                          )}
                        </div>
                      )}
                      {why && <div className="why">{why}</div>}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
