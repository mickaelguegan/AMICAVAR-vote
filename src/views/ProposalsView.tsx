import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api, type AppState, type Proposal } from "../api";
import { Chips, Icon, Jetons, Popover, useRun } from "../ui";
import { COST_LABEL, jetons, SEASON_LABEL, SEASONS, type Season } from "../../convex/rules";

type Draft = { title: string; description: string; seasons: Season[]; suggestedCost: number | null };
const EMPTY: Draft = { title: "", description: "", seasons: [], suggestedCost: null };

export default function ProposalsView({ state, cle }: { state: AppState; cle: string }) {
  const { me, settings, proposals } = state;
  const open = settings.phase === "propositions";
  const isBureau = me.role !== "membre";
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);

  const create = useMutation(api.proposals.create);
  const update = useMutation(api.proposals.update);
  const run = useRun();

  const canEditAll = open;
  const formDisabled = editing ? false : !open;
  const pendingCosts = proposals.filter((p) => !p.validated).length;
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
          {pendingCosts} proposition{pendingCosts > 1 ? "s attendent" : " attend"} la validation du bureau. Le vote ne
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
                  <Jetons n={c} size={18} /> <span className="small muted">{COST_LABEL[c]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="small muted">Le nombre de jetons correspond à la tranche de prix. Le bureau le valide avant le vote.</p>
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
  const isBureau = me.role !== "membre";
  const isAuthor = p.authorId === me.id;

  const remove = useMutation(api.proposals.remove);
  const setCost = useMutation(api.proposals.setCost);
  const setValidated = useMutation(api.proposals.setValidated);
  const merge = useMutation(api.proposals.merge);
  const run = useRun();

  const canEdit = (open && isAuthor) || isBureau;
  const canDelete = open && (isAuthor || isBureau);
  const others = proposals.filter((o) => o.id !== p.id).sort((a, b) => a.title.localeCompare(b.title, "fr"));

  return (
    <article className={`prop ${isEditing ? "editing" : ""} ${isBureau && open && !p.validated ? "to-check" : ""}`}>
      <div className="prop-top">
        <div>
          <h3>{p.title}</h3>
          {p.description && <p className="small muted desc">{p.description}</p>}
        </div>
        <Jetons n={p.cost} />
      </div>
      <div className="prop-meta">
        <div className="meta">
          <Chips seasons={p.seasons} />
          <span className="small muted">Proposé par {isAuthor ? "vous" : p.authorName}</span>
        </div>
        {(canEdit || canDelete) && (
          <div className="iconrow">
            {canEdit && (
              <button type="button" className="iconbtn" onClick={onEdit} aria-label={open ? "Modifier" : "Renommer"} title={open ? "Modifier" : "Renommer"}>
                <Icon name="pencil" />
              </button>
            )}
            {canDelete && (
              <Popover trigger={<Icon name="trash" />} label="Supprimer" className="iconbtn danger">
                {(close) => (
                  <div className="pop-confirm">
                    <p>Supprimer cette proposition ?</p>
                    <div className="row">
                      <button className="btn danger small-btn" onClick={() => { close(); run(() => remove({ cle, id: p.id }), "Proposition supprimée."); }}>
                        Supprimer
                      </button>
                      <button className="btn ghost small-btn" onClick={close}>
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </Popover>
            )}
          </div>
        )}
      </div>

      {isBureau && open && (
        <div className="adminrow">
          <span className={`review ${p.validated ? "done" : ""}`} title={p.validated ? "Vérifiée par le bureau" : "À vérifier par le bureau"} aria-label={p.validated ? "Vérifiée par le bureau" : "À vérifier par le bureau"}>
            <Icon name="review" size={22} />
          </span>

          <Popover
            label={`Coût : ${jetons(p.cost)}. Modifier`}
            className="jetonbtn"
            trigger={<><Jetons n={p.cost} size={18} /><Icon name="chevron" size={16} /></>}
          >
            {(close) => (
              <div className="pop-list">
                {[1, 2, 3].map((c) => (
                  <button
                    key={c}
                    role="menuitemradio"
                    aria-checked={p.cost === c}
                    className={`pop-item ${p.cost === c ? "on" : ""}`}
                    onClick={() => { close(); if (c !== p.cost) run(() => setCost({ cle, id: p.id, cost: c })); }}
                  >
                    <Jetons n={c} size={18} />
                    <span className="small muted">{COST_LABEL[c]}</span>
                  </button>
                ))}
              </div>
            )}
          </Popover>

          {others.length > 0 && (
            <Popover trigger={<Icon name="merge" />} label="Fusionner ce doublon dans une autre proposition">
              {(close) => <MergeMenu others={others} onPick={(o) => { close(); run(() => merge({ cle, sourceId: p.id, targetId: o.id }), `Fusionné dans « ${o.title} ».`); }} />}
            </Popover>
          )}

          <button
            type="button"
            className={`validbtn ${p.validated ? "on" : ""}`}
            aria-pressed={p.validated}
            aria-label={p.validated ? "Validée par le bureau. Annuler la validation" : "Valider cette proposition"}
            title={p.validated ? "Validée · cliquer pour annuler" : "À valider · cliquer pour valider"}
            onClick={() => run(() => setValidated({ cle, id: p.id, validated: !p.validated }))}
          >
            <Icon name={p.validated ? "check" : "hourglass"} size={22} />
          </button>
        </div>
      )}
    </article>
  );
}

function MergeMenu({ others, onPick }: { others: Proposal[]; onPick: (o: Proposal) => void }) {
  const [pick, setPick] = useState<Proposal | null>(null);
  if (pick)
    return (
      <div className="pop-confirm">
        <p>
          Fusionner dans « {pick.title} » ? Les saisons et les détails seront regroupés.
        </p>
        <div className="row">
          <button className="btn primary small-btn" onClick={() => onPick(pick)}>
            Fusionner
          </button>
          <button className="btn ghost small-btn" onClick={() => setPick(null)}>
            Retour
          </button>
        </div>
      </div>
    );
  return (
    <div className="pop-list">
      <p className="small muted pop-head">Fusionner dans…</p>
      {others.map((o) => (
        <button key={o.id} className="pop-item" onClick={() => setPick(o)}>
          <span>{o.title}</span>
        </button>
      ))}
    </div>
  );
}
