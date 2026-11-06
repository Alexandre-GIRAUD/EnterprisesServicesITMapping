# Authentification (SQL + JWT)

## Prérequis

- **PostgreSQL** : base `itmapping`, utilisateur/mot de passe alignés sur `DATABASE_*`.
- **JWT_SECRET** : chaîne UTF-8 d’au moins **32 caractères** (signatures HS256). Ne jamais committer cette valeur.

## Premier administrateur

Lorsque la table `users` est **vide** au démarrage, le backend peut créer un compte admin si les variables suivantes sont définies (binding Spring `app.security.bootstrap-admin`) :

| Variable | Rôle |
|----------|------|
| `ADMIN_BOOTSTRAP_USERNAME` | Nom d’utilisateur admin (stocké en minuscules) |
| `ADMIN_BOOTSTRAP_PASSWORD` | Mot de passe en clair **uniquement** pour ce premier bootstrap ; à faire tourner / remplacer après déploiement |

Si la table n’est pas vide, ces variables sont ignorées.

## Workspaces

Chaque utilisateur appartient à un seul workspace et ne voit que ses données (graphe, Data Model, sources, règles, historique, vues). L’admin bootstrap et toutes les données d’avant les workspaces sont dans le workspace **Default**. Un admin crée des utilisateurs dans son propre workspace, et le partage ne vise que des utilisateurs du même workspace.

## API

- `POST /api/auth/login` — corps JSON `{ "username", "password" }` — réponse `{ "token", "username", "roles" }`.
- `POST /api/admin/users` — **ADMIN uniquement** — `{ "username", "password" }` (mot de passe ≥ 8 caractères).
- `GET /api/admin/users` — **ADMIN uniquement** — liste des utilisateurs (sans hash).

## CORS

Variable `APP_CORS_ALLOWED_ORIGINS` : origines navigateur séparées par des virgules (schéma + hôte + port, **sans** slash final).

| Contexte | Exemple |
|----------|---------|
| Dev local | `http://localhost:*,http://127.0.0.1:*` (défaut backend hors Docker — couvre tous les ports) |
| Docker / VPS | `*` (défaut Compose) ou `http://IP:3000,https://mondomaine.fr` |

`http://localhost:3000` et `http://127.0.0.1:3000` sont deux origines **différentes**. Si tu ouvres l’URL avec `127.0.0.1` alors que CORS n’autorise que `localhost`, tu as un 403.

`Invalid CORS request` (403) au login signifie que `Origin` du navigateur n’est pas dans cette liste. Même si nginx proxifie `/api` (même site), Spring lit l’en-tête `Origin` (`http://IP:3000`, `https://domaine`, etc.) et refuse tout ce qui n’est pas listé. `localhost` ne couvre pas l’IP ni le nom de domaine du VPS.

Le joker `*` est accepté (patterns Spring) : l’API renvoie l’origine réelle, pas `*`.

## Docker Compose

Le service `postgres` expose le port hôte `5432` par défaut (`POSTGRES_HOST_PORT` pour le modifier). Le service `backend` attend Postgres **et** Neo4j healthy avant de démarrer.

## Connexions GitHub et Bitbucket

Le token GitHub et le token Bitbucket appartiennent au workspace : un admin les colle dans Paramètres, ils sont chiffrés en base avec une clé dérivée de `JWT_SECRET`. Changer `JWT_SECRET` rend ces tokens (et les secrets de webhook) illisibles : il faut alors les coller de nouveau. `GITHUB_TOKEN` et `BITBUCKET_TOKEN` ne sont plus utilisés (un avertissement s’affiche au démarrage s’ils sont définis).

Chaque workspace reçoit les pushes GitHub sur sa propre URL (`/api/webhooks/github/{workspaceId}`) avec son propre secret, visibles par les admins dans Paramètres. L’ancienne URL `/api/webhooks/github` ne sert plus que le workspace Default, tant que `GITHUB_WEBHOOK_SECRET` est défini.
