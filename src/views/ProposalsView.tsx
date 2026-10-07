import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api, type AppState, type Proposal } from "../api";
import { Chips, ConfirmButton, Cost, useRun } from "../ui";
import { COST_LABEL, euros, SEASON_LABEL, SEASONS, type Season } from "../../convex/rules";

type Draft = { title: string; description: string; seasons: Season[]; suggestedCost: number | null };
const EMPTY: Draft = { title: "", description: "", seasons: [], suggestedCost: null };

export default function ProposalsView({ state, cle }: { state: AppState; cle: string }) {
  const { me, settings, proposals } = state;
  const open = settings.phase === "propositions";
  const isBureau = me.role === "bureau";
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);

  const create = useMutation(api.proposals.create);
  const update = useMutation(api.proposals.update);
  const run = useRun();

  const canEditAll = open;
  const formDisabled = editing ? false : !open;
  const pendingCosts = proposals.filter((p) => p.cost == null).length;
  const list = onlyMine ? proposals.filter((p) => p.authorId === me.id) : proposals;

  function startEdit(p: Proposal) {
    setEditing(p.id);
    setDraft({ title: p.title, description: p.description, seasons: p.seasons, suggestedCost: p.suggestedCost });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function reset() {
    setEditing(null);
    setDraft(EMPTY);
    setError("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (draft.title.trim().length < 3) return setError("Donnez un nom à l'activité.");
    if (draft.seasons.length === 0) return setError("Cochez au moins une saison.");
    if (!draft.suggestedCost) return setError("Indiquez un coût estimé.");
    setError("");
    const payload = {
      cle,
      title: draft.title,
      description: draft.description,
      seasons: draft.seasons,
      suggestedCost: draft.suggestedCost,
    };
    const ok = editing
      ? await run(() => update({ ...payload, id: editing }), "Proposition modifiée.")
      : await run(() => create(payload), "Proposition publiée.");
    if (ok) reset();
  }

  const toggleSeason = (s: Season) =>
    setDraft((d) => ({ ...d, seasons: d.seasons.includes(s) ? d.seasons.filter((x) => x !== s) : [...d.seasons, s] }));

  return (
    <>
      {open ? (
        <div className="notice">
          La phase de propositions est ouverte. Parcourez la liste avant de proposer pour éviter les doublons. Vous
          pouvez modifier ou supprimer vos propositions jusqu'à l'ouverture du vote.
        </div>
      ) : (
        <div className="notice">
          Les propositions sont closes.{" "}
          {isBureau ? "Le bureau peut encore corriger un titre ou des détails." : "Rendez-vous dans « Mon vote »."}
        </div>
      )}
      {isBureau && open && pendingCosts > 0 && (
        <div className="notice warn">
          {pendingCosts} proposition{pendingCosts > 1 ? "s attendent" : " attend"} la validation du coût. Le vote ne
          pourra pas s'ouvrir avant.
        </div>
      )}

      <div className="grid2">
        <form className="panel" onSubmit={submit} noValidate>
          <h2>{editing ? "Modifier la proposition" : "Proposer une activité"}</h2>
          <div className="field">
            <label htmlFor="f-title" className="label">
              Activité
            </label>
            <input
              type="text"
              id="f-title"
              maxLength={120}
              placeholder="Ex. Visite du domaine du Rayol"
              value={draft.title}
              disabled={formDisabled}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="f-desc" className="label">
              Détails (facultatif)
            </label>
            <textarea
              id="f-desc"
              maxLength={1000}
              placeholder="Lieu, déroulé, transport…"
              value={draft.description}
              disabled={formDisabled}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <fieldset className="field" disabled={formDisabled || !canEditAll}>
            <legend className="label">Saisons possibles</legend>
            <div className="opts">
              {SEASONS.map((s) => (
                <label key={s} className="opt">
                  <input
                    type="checkbox"
                    id={`f-s-${s}`}
                    checked={draft.seasons.includes(s)}
                    onChange={() => toggleSeason(s)}
                  />{" "}
                  {SEASON_LABEL[s]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="field" disabled={formDisabled || !canEditAll}>
            <legend className="label">Coût estimé par personne</legend>
            <div className="opts">
              {[1, 2, 3].map((c) => (
                <label key={c} className="opt">
                  <input
                    type="radio"
                    name="fc"
                    id={`f-c-${c}`}
                    checked={draft.suggestedCost === c}
                    onChange={() => setDraft({ ...draft, suggestedCost: c })}
                  />{" "}
                  {euros(c)} <span className="small muted">{COST_LABEL[c]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="small muted">Le bureau valide le niveau de coût avant le vote.</p>
          <p className="err" role="alert">
            {error}
          </p>
          <div className="row">
            <button className="btn primary" type="submit" disabled={formDisabled}>
              {editing ? "Enregistrer les modifications" : "Publier la proposition"}
            </button>
            {editing && (
              <button className="btn ghost" type="button" onClick={reset}>
                Annuler
              </button>
            )}
          </div>
        </form>

        <div>
          <div className="listhead">
            <span className="label">
              {proposals.length} proposition{proposals.length > 1 ? "s" : ""} visibles par tous
            </span>
            <label className="small">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Mes
              propositions uniquement
            </label>
          </div>
          {list.length === 0 && (
            <div className="empty">
              {onlyMine
                ? "Vous n'avez encore rien proposé."
                : "Aucune proposition pour l'instant. Lancez la première idée avec le formulaire."}
            </div>
          )}
          <div className="plist">
            {list.map((p) => (
              <ProposalCard
                key={p.id}
                p={p}
                state={state}
                cle={cle}
                onEdit={() => startEdit(p)}
                isEditing={editing === p.id}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ProposalCard({
  p,
  state,
  cle,
  onEdit,
  isEditing,
}: {
  p: Proposal;
  state: AppState;
  cle: string;
  onEdit: () => void;
  isEditing: boolean;
}) {
  const { me, settings, proposals } = state;
  const open = settings.phase === "propositions";
  const isBureau = me.role === "bureau";
  const isAuthor = p.authorId === me.id;
  const [mergeTarget, setMergeTarget] = useState("");

  const remove = useMutation(api.proposals.remove);
  const setCost = useMutation(api.proposals.setCost);
  const merge = useMutation(api.proposals.merge);
  const run = useRun();

  const canEdit = (open && isAuthor) || isBureau;
  const canDelete = open && (isAuthor || isBureau);

  return (
    <article className={`prop ${isEditing ? "editing" : ""}`}>
      <div className="prop-top">
        <div>
          <h3>{p.title}</h3>
          {p.description && <p className="small muted desc">{p.description}</p>}
        </div>
        <Cost cost={p.cost} suggested={p.suggestedCost} />
      </div>
      <div className="meta">
        <Chips seasons={p.seasons} />
        <span className="small muted">
          Proposé par {isAuthor ? "vous" : p.authorName}
        </span>
      </div>

      {(canEdit || canDelete) && (
        <div className="actions">
          {canEdit && (
            <button className="btn" onClick={onEdit}>
              {open ? "Modifier" : "Renommer"}
            </button>
          )}
          {canDelete && (
            <ConfirmButton
              label="Supprimer"
              confirmLabel="Confirmer la suppression"
              onConfirm={() => run(() => remove({ cle, id: p.id }), "Proposition supprimée.")}
            />
          )}
        </div>
      )}

      {isBureau && open && (
        <div className="adminrow">
          <span className="tag-admin">Bureau</span>
          <label className="small">
            Coût validé{" "}
            <select
              id={`cost-${p.id}`}
              value={p.cost ?? ""}
              onChange={(e) =>
                run(() => setCost({ cle, id: p.id, cost: e.target.value ? Number(e.target.value) : null }))
              }
            >
              <option value="">À valider</option>
              {[1, 2, 3].map((c) => (
                <option key={c} value={c}>
                  {euros(c)} · {COST_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <span className="mergebox">
            <select
              id={`merge-${p.id}`}
              aria-label="Fusionner ce doublon dans"
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
            >
              <option value="">Fusionner ce doublon dans…</option>
              {proposals
                .filter((o) => o.id !== p.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
            </select>
            <ConfirmButton
              className="btn"
              label="Fusionner"
              confirmLabel="Confirmer la fusion"
              disabled={!mergeTarget}
              onConfirm={() =>
                run(() => merge({ cle, sourceId: p.id, targetId: mergeTarget }), "Doublon fusionné.")
              }
            />
          </span>
        </div>
      )}
    </article>
  );
}
