# Amicavar · vote des activités

Outil interne de l'Amicavar pour proposer des activités et voter avant l'AG.

- **Interface** : React (Vite), hébergée sur GitHub Pages.
- **Base de données et règles** : Convex. Toutes les règles (2 voix par saison, une voix par activité, budget, droits du bureau) sont vérifiées côté serveur.
- **Accès** : chaque membre a un lien personnel (`?cle=…`) généré par l'outil et envoyé par publipostage. Pas de mot de passe.

## Déploiement

Chaque `push` sur `main` lance `.github/workflows/deploy.yml` :

1. tests des règles de vote (`npm test`) ;
2. publication des fonctions Convex et construction du site (`npx convex deploy`) ;
3. mise en ligne sur GitHub Pages.

Prérequis côté dépôt :
- secret `CONVEX_DEPLOY_KEY` (clé de déploiement **Production** de Convex, permission `deployment:deploy`) ;
- Settings → Pages → Source : **GitHub Actions**.

## Créer le premier accès (une seule fois)

1. Tableau de bord Convex, base **Production** → **Functions** → `setup:createFirstBureau`.
2. Arguments : `{ "prenom": "…", "nom": "…", "email": "…" }` → **Run**.
3. Le résultat contient une `cle`. Ouvrez l'adresse du site suivie de `?cle=` et de cette clé.

Ce premier compte a le rôle **Gestion** (accès aux e-mails et aux liens). Les autres membres s'ajoutent ensuite depuis l'onglet **Gestion** du site (copier-coller depuis Excel). Rôles : *membre* ; *bureau* (modération, phases, arbitrages) ; *gestion* (en plus : membres, e-mails, liens personnels), à réserver à une ou deux personnes.

## Déroulé d'une campagne

| Phase | Membres | Bureau |
|---|---|---|
| Propositions | proposent, modifient et suppriment leurs propositions | renomme, fusionne les doublons, valide le coût en jetons (1 jeton : moins de 15 €, 2 : 15 à 30 €, 3 : 30 à 50 €, 4 : plus de 50 € par personne) |
| Vote | 2 voix par saison, 1 voix par activité, budget de 12 jetons ; bulletin modifiable jusqu'à la clôture | suit la participation |
| Résultats | consultent plans A et B | tranche les égalités (« Classer devant ») selon la décision de la Présidente |

Le vote ne peut s'ouvrir que lorsque tous les coûts sont validés. « Réinitialiser la campagne » (onglet Bureau) efface propositions et votes et conserve les membres.

## Développement local

```bash
npm install
npx convex dev      # base de développement, dans un terminal
npm run dev         # site, dans un autre terminal
npm test            # règles de vote
```
