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

## API

- `POST /api/auth/login` — corps JSON `{ "username", "password" }` — réponse `{ "token", "username", "roles" }`.
- `POST /api/admin/users` — **ADMIN uniquement** — `{ "username", "password" }` (mot de passe ≥ 8 caractères).
- `GET /api/admin/users` — **ADMIN uniquement** — liste des utilisateurs (sans hash).

## CORS

Variable `APP_CORS_ALLOWED_ORIGINS` : origines séparées par des virgules (ex. `http://localhost:3000,http://localhost:5173`).

## Docker Compose

Le service `postgres` expose le port hôte `5432` par défaut (`POSTGRES_HOST_PORT` pour le modifier). Le service `backend` attend Postgres **et** Neo4j healthy avant de démarrer.
