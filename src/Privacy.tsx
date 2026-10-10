import { useRef } from "react";

/** Lien de bas de page qui ouvre la note « Traitement des données ». */
export default function Privacy({ contact }: { contact?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const mail = contact ? <a href={`mailto:${contact}`}>{contact}</a> : null;
  const contactLine = mail ?? "le bureau de l'Amicavar";
  const how = mail ? <>en écrivant à {mail}</> : "en vous adressant au bureau";

  return (
    <>
      <footer className="foot">
        <button type="button" className="linkbtn" onClick={() => ref.current?.showModal()}>
          Traitement des données
        </button>
      </footer>
      <dialog ref={ref} className="privacy" aria-labelledby="privacy-title" onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <div className="privacy-body">
          <div className="privacy-head">
            <h2 id="privacy-title">Traitement des données</h2>
            <button type="button" className="iconbtn" aria-label="Fermer" onClick={() => ref.current?.close()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <dl>
            <dt>Qui traite vos données</dt>
            <dd>L'Amicavar, association du personnel. Contact : {contactLine}.</dd>

            <dt>Pourquoi</dt>
            <dd>Recueillir les propositions de sorties et organiser le vote qui prépare le programme présenté en assemblée générale.</dd>

            <dt>Quelles données</dt>
            <dd>Vos prénom, nom et adresse e-mail, votre rôle (membre ou bureau), vos propositions et vos votes.</dd>

            <dt>Qui les voit</dt>
            <dd>
              Les propositions et les votes sont visibles par tous les membres connectés, avec le nom de leur auteur, comme un vote à
              main levée. Les adresses e-mail ne sont visibles que du bureau.
            </dd>

            <dt>Base légale</dt>
            <dd>L'intérêt légitime de l'association à organiser ses activités avec ses membres.</dd>

            <dt>Combien de temps</dt>
            <dd>
              Les propositions et les votes sont supprimés au plus tard deux mois après l'assemblée générale. La liste des membres est
              mise à jour à chaque campagne.
            </dd>

            <dt>Où sont-elles hébergées</dt>
            <dd>
              Dans une base de données Convex située en Europe (Irlande). Le site lui-même est servi par GitHub Pages, qui ne stocke aucune
              de ces données mais peut enregistrer l'adresse IP des visiteurs pour la sécurité de son service.
            </dd>

            <dt>Cookies</dt>
            <dd>
              Aucun cookie. Votre navigateur garde seulement votre clé d'accès pour vous éviter de recliquer sur le lien reçu par e-mail.
              « Se déconnecter de cet appareil » l'efface.
            </dd>

            <dt>Vos droits</dt>
            <dd>
              Vous pouvez demander l'accès à vos données, leur correction ou leur suppression, ou vous opposer à leur traitement, {how}. Vous
              pouvez aussi adresser une réclamation à la CNIL (cnil.fr).
            </dd>
          </dl>
        </div>
      </dialog>
    </>
  );
}
