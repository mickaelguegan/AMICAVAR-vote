import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api, type AppState, type MemberAdmin } from "../api";
import { personalLink, saveCle } from "../session";
import { ConfirmButton, copyText, useRun, useToast } from "../ui";
import { parseMembers, type Role } from "../../convex/rules";

export default function BureauView({
  state,
  cle,
  onCleChange,
}: {
  state: AppState;
  cle: string;
  onCleChange: (c: string) => void;
}) {
  const members = useQuery(api.admin.members, { cle }) as MemberAdmin[] | undefined;
  const importMembers = useMutation(api.admin.importMembers);
  const setRole = useMutation(api.admin.setRole);
  const removeMember = useMutation(api.admin.removeMember);
  const regenerate = useMutation(api.admin.regenerateCle);
  const updateMember = useMutation(api.admin.updateMember);
  const resetCampaign = useMutation(api.admin.resetCampaign);
  const run = useRun();
  const toast = useToast();

  const [paste, setPaste] = useState("");
  const [fallback, setFallback] = useState("");
  const [confirmReset, setConfirmReset] = useState("");
  const [edit, setEdit] = useState<{ id: string; prenom: string; nom: string; email: string } | null>(null);

  const parsed = paste.trim() ? parseMembers(paste) : null;

  async function doImport() {
    if (!parsed || parsed.rows.length === 0) return;
    let result: { added: number; updated: number } | null = null;
    const ok = await run(async () => {
      result = await importMembers({ cle, rows: parsed.rows });
    });
    if (ok && result) {
      const r = result as { added: number; updated: number };
      toast({ text: `${r.added} membre(s) ajouté(s), ${r.updated} mis à jour.`, kind: "ok" });
      setPaste("");
    }
  }

  async function copy(text: string, what: string) {
    if (await copyText(text)) {
      toast({ text: `${what} copié.`, kind: "ok" });
      setFallback("");
    } else {
      setFallback(text);
      toast({ text: "Copie automatique refusée : sélectionnez le texte affiché et copiez-le.", kind: "error" });
    }
  }

  function mailMergeTable(list: MemberAdmin[]) {
    const lines = ["Prénom\tNom\tEmail\tRôle\tLien"];
    for (const m of list) lines.push([m.prenom, m.nom, m.email, m.role, personalLink(m.cle)].join("\t"));
    return lines.join("\n");
  }

  const voted = members?.filter((m) => m.voteCount > 0).length ?? 0;

  return (
    <div className="stack">
      <section className="panel">
        <h2>Ajouter des membres</h2>
        <p className="small muted rules">
          Collez un tableau Excel de 4 colonnes : <strong>Prénom, Nom, E-mail, Rôle</strong> (« membre » ou
          « bureau » ; vide = membre). Une ligne d'en-tête est ignorée. Une adresse déjà connue met à jour le membre
          sans changer son lien.
        </p>
        <textarea
          id="import-paste"
          className="mono"
          rows={6}
          placeholder={"Prénom\tNom\tE-mail\tRôle\nSophie\tMartin\tsophie.martin@exemple.fr\tbureau\nKarim\tBenali\tkarim.benali@exemple.fr\tmembre"}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        {parsed && (
          <div className="small">
            <p>
              <strong>{parsed.rows.length}</strong> membre(s) prêt(s) à importer, dont{" "}
              {parsed.rows.filter((r) => r.role === "bureau").length} au bureau.
            </p>
            {parsed.errors.map((e) => (
              <p key={e} className="err">
                {e}
              </p>
            ))}
          </div>
        )}
        <button className="btn primary" disabled={!parsed || parsed.rows.length === 0} onClick={doImport}>
          Importer
        </button>
      </section>

      <section className="panel">
        <div className="listhead">
          <h2>Membres et liens personnels</h2>
          {members && members.length > 0 && (
            <button className="btn" onClick={() => copy(mailMergeTable(members), "Tableau pour le publipostage")}>
              Copier le tableau pour le publipostage
            </button>
          )}
        </div>
        <p className="small muted rules">
          Collez le tableau copié dans Excel, puis utilisez-le comme source d'un publipostage Word vers Outlook. Chaque
          lien est personnel : régénérez-le s'il a été transféré ou perdu, l'ancien cesse alors de fonctionner.
        </p>
        {members && (
          <p className="small">
            <strong>
              {voted} / {members.length}
            </strong>{" "}
            membres ont voté au moins une fois.
          </p>
        )}
        {fallback && (
          <textarea
            className="mono"
            rows={5}
            readOnly
            value={fallback}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Texte à copier"
          />
        )}
        {members === undefined ? (
          <p className="muted">Chargement…</p>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Membre</th>
                  <th>E-mail</th>
                  <th>Rôle</th>
                  <th>Voix</th>
                  <th>Lien personnel</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isMe = m.id === state.me.id;
                  const ed = edit && edit.id === m.id ? edit : null;
                  return (
                    <tr key={m.id}>
                      <td>
                        {ed ? (
                          <span className="row">
                            <input
                              type="text"
                              aria-label="Prénom"
                              value={ed.prenom}
                              onChange={(e) => setEdit({ ...ed, prenom: e.target.value })}
                            />
                            <input
                              type="text"
                              aria-label="Nom"
                              value={ed.nom}
                              onChange={(e) => setEdit({ ...ed, nom: e.target.value })}
                            />
                          </span>
                        ) : (
                          <>
                            {m.prenom} {m.nom} {isMe && <span className="small muted">(vous)</span>}
                          </>
                        )}
                      </td>
                      <td>
                        {ed ? (
                          <input
                            type="text"
                            aria-label="E-mail"
                            value={ed.email}
                            onChange={(e) => setEdit({ ...ed, email: e.target.value })}
                          />
                        ) : (
                          <span className="small">{m.email}</span>
                        )}
                      </td>
                      <td>
                        <select
                          aria-label={`Rôle de ${m.prenom} ${m.nom}`}
                          value={m.role}
                          disabled={isMe}
                          onChange={(e) => run(() => setRole({ cle, id: m.id, role: e.target.value as Role }))}
                        >
                          <option value="membre">Membre</option>
                          <option value="bureau">Bureau</option>
                        </select>
                      </td>
                      <td>{m.voteCount}</td>
                      <td>
                        <button className="btn small-btn" onClick={() => copy(personalLink(m.cle), "Lien")}>
                          Copier le lien
                        </button>
                      </td>
                      <td>
                        <span className="row">
                          {ed ? (
                            <>
                              <button
                                className="btn primary small-btn"
                                onClick={async () => {
                                  const ok = await run(
                                    () => updateMember({ cle, ...ed }),
                                    "Membre mis à jour.",
                                  );
                                  if (ok) setEdit(null);
                                }}
                              >
                                Enregistrer
                              </button>
                              <button className="btn ghost small-btn" onClick={() => setEdit(null)}>
                                Annuler
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn ghost small-btn"
                              onClick={() => setEdit({ id: m.id, prenom: m.prenom, nom: m.nom, email: m.email })}
                            >
                              Modifier
                            </button>
                          )}
                          <ConfirmButton
                            className="btn ghost small-btn"
                            label="Nouveau lien"
                            confirmLabel="Remplacer le lien"
                            onConfirm={() =>
                              run(async () => {
                                const fresh = (await regenerate({ cle, id: m.id })) as string | null;
                                if (fresh) {
                                  saveCle(fresh);
                                  onCleChange(fresh);
                                }
                              }, "Nouveau lien créé. Pensez à l'envoyer.")
                            }
                          />
                          {!isMe && (
                            <ConfirmButton
                              className="btn ghost danger small-btn"
                              label="Retirer"
                              confirmLabel="Retirer ce membre"
                              onConfirm={() => run(() => removeMember({ cle, id: m.id }), "Membre retiré.")}
                            />
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel danger-zone">
        <h2>Réinitialiser la campagne</h2>
        <p className="small muted rules">
          Supprime toutes les propositions et tous les votes, puis rouvre la phase de propositions. Les membres et leurs
          liens sont conservés. À utiliser après la campagne de test, ou pour préparer l'année suivante.
        </p>
        <div className="row">
          <input
            type="text"
            id="reset-confirm"
            placeholder="Tapez REINITIALISER"
            value={confirmReset}
            onChange={(e) => setConfirmReset(e.target.value)}
          />
          <button
            className="btn danger"
            disabled={confirmReset.trim().toUpperCase() !== "REINITIALISER"}
            onClick={async () => {
              const ok = await run(
                () => resetCampaign({ cle, confirmation: confirmReset }),
                "Campagne réinitialisée.",
              );
              if (ok) setConfirmReset("");
            }}
          >
            Tout effacer
          </button>
        </div>
      </section>
    </div>
  );
}
