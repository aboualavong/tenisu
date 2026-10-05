# Consignes du projet — Test technique Backend L’Atelier

## Contexte

Ce dépôt correspond au projet **tenisu**, un test technique de recrutement pour L’Atelier. L’objectif est de réaliser, dans des conditions proches d’une mission client, une API qui expose des statistiques sur des joueurs de tennis.

## Stack et langue

- Utiliser **Node.js**, **TypeScript** et **Express** pour l’API backend.
- Écrire le code, les commentaires et la documentation du projet en **anglais** (y compris le README).
- Utiliser **PostgreSQL** si le projet nécessite une base de données ; ne pas en ajouter si les besoins peuvent être satisfaits proprement sans persistance.

## Mission

- Créer une API simple permettant de consulter les statistiques des joueurs.
- Compléter les tâches avec les technologies demandées par le recruteur. La stack définie pour le projet est Node.js, TypeScript et Express ; vérifier toute autre contrainte technique communiquée par le recruteur avant de démarrer l’implémentation.
- Créer le projet à partir de zéro.
- Déployer l’application sur un service cloud.
- Fournir un README expliquant comment installer, lancer et tester l’application.
- Préparer les liens vers le dépôt public et l’application déployée pour les transmettre au recruteur.
- Des fonctionnalités supplémentaires pertinentes peuvent être ajoutées si elles restent cohérentes avec le périmètre et les contraintes du test.

## Critères de qualité

- Code propre, lisible et cohérent avec les conventions de la stack choisie.
- Architecture applicative simple et claire, sans complexité inutile.
- Respect des principes REST pour les routes, les méthodes HTTP, les statuts et les formats de réponse.
- Gestion explicite et cohérente des erreurs et des cas limites.
- Tests unitaires couvrant la logique importante et les cas d’erreur.
- Documentation suffisante pour qu’une autre personne puisse installer et utiliser le projet.
- Keep the API documentation in sync with the implementation: whenever an endpoint is added, changed, or removed, update `docs/api/openapi.yaml`, which powers Swagger UI at `/api-docs/`, including its parameters, status codes, responses, and errors. Update the README whenever the documented routes or instructions for accessing and testing the API change.
- Suivre autant que possible les bonnes pratiques reconnues pour Node.js, Express, TypeScript, les API REST, la sécurité et la maintenabilité, en restant proportionné au périmètre du test.

## Développement guidé par les tests

- Utiliser le TDD pour développer les fonctionnalités : **Red → Green → Refactor**.
- Commencer par écrire un test qui échoue et exprime le comportement attendu, puis écrire le minimum de code pour le faire passer, et enfin refactoriser en gardant les tests au vert.
- Conserver des tests lisibles et ciblés, et exécuter les tests pertinents après les changements.

## Git et commits

- Utiliser Git pour suivre l’historique du projet et vérifier l’état du dépôt avant et après les changements.
- Garder les changements ciblés et cohérents ; examiner le diff et ne pas inclure de fichiers générés, secrets ou changements sans rapport.
- Rédiger les messages de commit en anglais, de façon courte et descriptive, selon le format Conventional Commits : `<type>(<scope>): <summary>` (par exemple `feat(players): add ranked player list endpoint`).
- Utiliser un type adapté (`feat`, `fix`, `test`, `docs`, `refactor`, `chore`) et un résumé à l’impératif, sans point final.
- Préférer des commits petits et atomiques qui représentent chacun une seule intention cohérente.
- Ne pas réécrire l’historique partagé et ne pas pousser de changements sans demande explicite.

## Données

- `headtohead.json` contient les données initiales des joueurs fournies pour le test.
- Préserver la structure et les valeurs de cette source, sauf demande explicite ou nécessité documentée.
- Le fichier `headtohead.json.txt` est un fichier préexistant vide ; ne pas l’utiliser comme source de données à la place de `headtohead.json`.

## Façon de travailler

- Vérifier les consignes du recruteur et les outils déjà présents avant de choisir une stack ou une architecture.
- Ne pas supposer une technologie imposée qui n’a pas été communiquée.
- Garder le périmètre adapté à un test technique et expliquer les choix qui influencent l’utilisation ou le déploiement.
- Ne pas publier le dépôt ni déployer l’application sans demande explicite de l’utilisateur.
