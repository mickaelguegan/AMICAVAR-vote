import { useMutation } from "convex/react";
import { api, type AppState } from "../api";
import { Chips, Cost, Jetons, SeasonBand, useRun } from "../ui";
import { allocate, SEASON_LABEL, SEASONS, type ResultRow, type Season } from "../../convex/rules";

export default function ResultsView({ state, cle }: { state: AppState; cle: string }) {
  const { me, settings, proposals, votes, memberCount } = state;
  const isBureau = me.role !== "membre";
  const setTieBreak = useMutation(api.admin.setTieBreak);
  const run = useRun();

  const { rows, slots } = allocate(
    proposals.map((p) => ({ id: p.id, title: p.title, seasons: p.seasons, cost: p.cost, tieBreak: p.tieBreak })),
    votes.map((v) => ({ proposalId: v.proposalId, season: v.season })),
  );
  const voters = new Set(votes.map((v) => v.memberId)).size;
  const planA = SEASONS.map((s) => slots[s].A).filter((r): r is ResultRow => !!r);
  const costA = planA.reduce((t, r) => t + (r.proposal.cost ?? 0), 0);
  const max = Math.max(1, ...rows.map((r) => r.total));
  const openTies = rows.filter((r) => r.tie === "open").length;

  function putFirst(r: ResultRow) {
    const group = rows.filter((o) => o.total === r.total);
    const top = Math.max(...group.map((o) => o.proposal.tieBreak));
    return run(() => setTieBreak({ cle, proposalId: r.proposal.id, value: top + 1 }), "Arbitrage enregistré.");
  }
  async function clearTie(r: ResultRow) {
    const group = rows.filter((o) => o.total === r.total && o.proposal.tieBreak !== 0);
    for (const o of group) await run(() => setTieBreak({ cle, proposalId: o.proposal.id, value: 0 }));
  }

  const slot = (s: Season, plan: "A" | "B") => {
    const r = slots[s][plan];
    return (
      <div className="slotres" key={plan}>
        <span className={`badge ${plan === "A" ? "a" : ""}`}>{plan}</span>
        <div>
          {r ? (
            <>
              <strong>{r.proposal.title}</strong>
              <div className="small muted">
                {r.total} voix · dont {r.per[s]} pour {SEASON_LABEL[s]} · <Cost cost={r.proposal.cost} />
              </div>
              {r.tie === "open" && <span className="tie">Égalité : à trancher par la Présidente</span>}
              {r.tie === "settled" && <span className="tie settled">Égalité tranchée</span>}
            </>
          ) : (
            <span className="muted">Aucune activité</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {settings.phase !== "resultats" && (
        <div className="notice">
          Aperçu réservé au bureau. Les résultats sont visibles par tous à la clôture du vote.
        </div>
      )}
      {isBureau && openTies > 0 && (
        <div className="notice warn">
          Égalité à trancher : utilisez « Classer devant » dans le classement ci-dessous, selon la décision de la
          Présidente.
        </div>
      )}

      <div className="summary">
        <div className="panel">
          <div className="label">Participation</div>
          <div className="big">
            {voters} / {memberCount}
          </div>
          <p className="small muted">membres ayant voté au moins une fois</p>
        </div>
        <div className="panel">
          <div className="label">Coût des 3 plans A</div>
          <div className="big">{costA ? <Jetons n={costA} size={26} /> : "–"}</div>
          <p className="small muted">{costA} jetons sur {3 * 4} possibles · indicateur pour le bureau</p>
        </div>
      </div>

      <div className="plans">
        {SEASONS.map((s) => (
          <section key={s} className={`postcard plan s-${s}`}>
            <SeasonBand season={s} />
            <div className="plan-body">
              {slot(s, "A")}
              {slot(s, "B")}
            </div>
          </section>
        ))}
      </div>

      <h2>Classement complet</h2>
      <p className="small muted rules">
        Les activités sont placées dans l'ordre du classement. Chacune va dans la saison où elle a reçu le plus de
        voix si le plan A y est libre, sinon dans son autre saison, sinon en plan B. Une activité n'occupe qu'un seul
        créneau.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Activité</th>
              <th>Coût</th>
              <th>Voix par saison</th>
              <th>Total</th>
              <th>Placement</th>
              {isBureau && <th>Arbitrage</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.proposal.id}>
                <td>{i + 1}</td>
                <td>
                  <strong>{r.proposal.title}</strong>
                  <div className="meta">
                    <Chips seasons={r.proposal.seasons} />
                  </div>
                </td>
                <td>
                  <Cost cost={r.proposal.cost} />
                </td>
                <td>
                  <div
                    className="bar"
                    title={`Printemps ${r.per.P} · Été ${r.per.E} · Automne ${r.per.A}`}
                    style={{ width: Math.max(8, (140 * r.total) / max) }}
                  >
                    {SEASONS.map((s) =>
                      r.per[s] ? (
                        <span key={s} className={`b${s}`} style={{ width: `${(100 * r.per[s]) / r.total}%` }} />
                      ) : null,
                    )}
                  </div>
                  <span className="small muted">
                    {r.per.P} · {r.per.E} · {r.per.A}
                  </span>
                </td>
                <td>
                  <strong>{r.total}</strong>
                </td>
                <td>
                  {r.placed ? (
                    <span className={`chip s-${r.placed.season}`}>
                      Plan {r.placed.plan} · {SEASON_LABEL[r.placed.season]}
                    </span>
                  ) : (
                    <span className="small muted">Non retenue</span>
                  )}
                  {r.tie === "open" && <span className="tie">Égalité</span>}
                </td>
                {isBureau && (
                  <td>
                    {r.tie !== "none" && (
                      <span className="row">
                        <button className="btn small-btn" onClick={() => putFirst(r)}>
                          Classer devant
                        </button>
                        {r.tie === "settled" && (
                          <button className="btn ghost small-btn" onClick={() => clearTie(r)}>
                            Annuler
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend">
        <span>
          <i className="lP" />
          Printemps
        </span>
        <span>
          <i className="lE" />
          Été
        </span>
        <span>
          <i className="lA" />
          Automne
        </span>
      </div>
    </>
  );
}
