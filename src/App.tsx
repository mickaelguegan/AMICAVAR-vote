import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api, type AppState } from "./api";
import { clearCle, initialCle } from "./session";
import { ConfirmButton, useRun } from "./ui";
import { PHASE_LABEL, PHASES, type Phase } from "../convex/rules";
import ProposalsView from "./views/ProposalsView";
import VoteView from "./views/VoteView";
import ResultsView from "./views/ResultsView";
import BureauView from "./views/BureauView";
import Privacy from "./Privacy";

type Tab = "props" | "vote" | "res" | "bureau";
const TAB_FOR_PHASE: Record<Phase, Tab> = { propositions: "props", vote: "vote", resultats: "res" };

export default function App() {
  const [cle, setCle] = useState<string | null>(initialCle);
  const state = useQuery(api.app.state, cle ? { cle } : "skip") as AppState | null | undefined;

  if (!cle) return <Gate title="Accès réservé aux membres de l'Amicavar" />;
  if (state === undefined)
    return (
      <div className="wrap">
        <p className="muted loading">Chargement…</p>
      </div>
    );
  if (state === null)
    return (
      <Gate
        title="Lien non reconnu"
        extra={
          <button
            className="btn"
            onClick={() => {
              clearCle();
              setCle(null);
            }}
          >
            Oublier ce lien sur cet appareil
          </button>
        }
      />
    );
  return <Main state={state} cle={cle} onCleChange={setCle} />;
}

function Gate({ title, extra }: { title: string; extra?: ReactNode }) {
  return (
    <div className="wrap">
      <div className="gate">
        <div className="label">Amicavar</div>
        <h1>{title}</h1>
        <p className="muted">
          Pour participer, ouvrez le lien personnel que vous avez reçu par e-mail. Ce lien vous identifie : ne le
          transférez pas. Si vous l'avez perdu, demandez-en un nouveau à un membre du bureau.
        </p>
        {extra}
      </div>
      <Privacy />
    </div>
  );
}

function Main({ state, cle, onCleChange }: { state: AppState; cle: string; onCleChange: (c: string | null) => void }) {
  const { me, settings } = state;
  const isBureau = me.role === "bureau";
  const [tab, setTab] = useState<Tab>(TAB_FOR_PHASE[settings.phase]);

  // Quand le bureau change de phase, chacun bascule sur l'écran correspondant.
  useEffect(() => {
    setTab(TAB_FOR_PHASE[settings.phase]);
  }, [settings.phase]);

  const showResults = isBureau || settings.phase === "resultats";
  const tabs: { k: Tab; label: string }[] = [
    { k: "props", label: "Propositions" },
    { k: "vote", label: "Mon vote" },
    ...(showResults ? [{ k: "res" as Tab, label: "Résultats" }] : []),
    ...(isBureau ? [{ k: "bureau" as Tab, label: "Bureau" }] : []),
  ];
  const current = tabs.some((t) => t.k === tab) ? tab : "props";

  return (
    <div className="wrap">
      <header className="head">
        <div>
          <div className="label">Amicavar · Préparation de l'AG</div>
          <h1>Activités de l'année</h1>
        </div>
        <div className="who">
          <span>
            <strong>
              {me.prenom} {me.nom}
            </strong>{" "}
            {isBureau && <span className="tag-admin">Bureau</span>}
          </span>
          <button
            className="linkbtn"
            onClick={() => {
              clearCle();
              onCleChange(null);
            }}
          >
            Se déconnecter de cet appareil
          </button>
        </div>
      </header>

      <PhaseBar phase={settings.phase} isBureau={isBureau} cle={cle} />

      <nav className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.k}
            className="tab"
            role="tab"
            aria-selected={current === t.k}
            onClick={() => setTab(t.k)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {current === "props" && <ProposalsView state={state} cle={cle} />}
        {current === "vote" && <VoteView state={state} cle={cle} />}
        {current === "res" && <ResultsView state={state} cle={cle} />}
        {current === "bureau" && <BureauView state={state} cle={cle} onCleChange={onCleChange} />}
      </main>

      <section className="fixed" aria-label="Activités hors vote">
        <div className="panel">
          <div className="label">Hors vote · format fixe</div>
          <p>
            <strong>Repas d'AG</strong>
          </p>
        </div>
        <div className="panel">
          <div className="label">Hors vote · format fixe</div>
          <p>
            <strong>Sortie d'hiver des enfants</strong>
          </p>
        </div>
      </section>

      <Privacy contact={settings.contactEmail} />
    </div>
  );
}

function PhaseBar({ phase, isBureau, cle }: { phase: Phase; isBureau: boolean; cle: string }) {
  const setPhase = useMutation(api.admin.setPhase);
  const run = useRun();
  const i = PHASES.indexOf(phase);
  const next = PHASES[i + 1];
  const prev = PHASES[i - 1];
  const nextLabel: Record<Phase, string> = {
    propositions: "",
    vote: "Clore les propositions et ouvrir le vote",
    resultats: "Clore le vote et publier les résultats",
  };

  return (
    <section className="phasebar" aria-label="Phase de la campagne">
      <div className="steps">
        {PHASES.map((p, k) => (
          <div key={p} className={`step ${k === i ? "on" : k < i ? "done" : ""}`}>
            <span className="dot">{k + 1}</span>
            {PHASE_LABEL[p]}
            {k === i ? (p === "resultats" ? " · publiés" : " · ouverte") : ""}
          </div>
        ))}
      </div>
      {isBureau && (
        <div className="admin-ctl">
          {prev && (
            <ConfirmButton
              className="btn ghost"
              label="← Revenir en arrière"
              confirmLabel={`Rouvrir : ${PHASE_LABEL[prev]}`}
              onConfirm={() => run(() => setPhase({ cle, phase: prev }), `Phase rouverte : ${PHASE_LABEL[prev]}`)}
            />
          )}
          {next && (
            <ConfirmButton
              className="btn primary"
              label={nextLabel[next] + " →"}
              confirmLabel="Confirmer"
              onConfirm={() => run(() => setPhase({ cle, phase: next }), `Phase ouverte : ${PHASE_LABEL[next]}`)}
            />
          )}
        </div>
      )}
    </section>
  );
}
