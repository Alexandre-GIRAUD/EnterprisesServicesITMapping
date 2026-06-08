# Enterprise IT Mapping Platform

Production-ready SaaS monorepo for mapping enterprise applications, their dependencies, and internal structure, with year-based filtering and scalability to thousands of nodes.

## Tech Stack

| Layer        | Technology                          |
|-------------|--------------------------------------|
| Backend     | Java 21, Spring Boot 3.2             |
| Database    | Neo4j 5 (graph), PostgreSQL (users / auth) |
| Frontend    | React 18, TypeScript, Vite 5         |
| Visualization | Cytoscape.js                       |
| Auth        | Spring Security, JWT, JPA + Flyway   |
| Runtime     | Docker, Docker Compose               |

## Repository Structure

```
├── apps/
│   ├── backend/          # Spring Boot API
│   │   ├── src/main/java/com/enterprise/itmapping/
│   │   │   ├── config/           # Global config (Neo4j, Web, Security stub)
│   │   │   ├── common/           # Shared types, exceptions
│   │   │   └── feature/          # Feature-based modules
│   │   │       ├── applications/ # Applications (nodes) CRUD & domain
│   │   │       ├── dependencies/# Dependencies (edges) CRUD & domain
│   │   │       ├── graph/        # Graph export for visualization
│   │   │       └── auth/         # JWT auth placeholder
│   │   └── src/main/resources/
│   │       └── application.yml
│   └── frontend/         # React + Vite SPA
│       ├── src/
│       │   ├── config/           # API base, auth headers
│       │   ├── layouts/         # App shell
│       │   ├── features/        # Feature-based UI
│       │   │   ├── map/         # Graph canvas (Cytoscape), map page
│       │   │   ├── applications/
│       │   │   └── auth/
│       │   └── types/           # Shared TS types
│       └── vite.config.ts
├── packages/             # Optional shared packages (e.g. API contracts)
├── docker-compose.yml
├── package.json          # Root workspace scripts
└── README.md
```

## Architecture Decisions

### Monorepo

- Single repo for backend, frontend, and shared config keeps versioning and refactors in sync and simplifies CI and Docker builds.

### Clean Architecture (Backend)

- **Domain**: Entities and repository ports (no framework dependencies).
- **Application**: Use cases and application services; orchestrate domain and call out to ports.
- **Infrastructure**: Adapters (Neo4j repositories, external APIs); implements domain ports.
- **Presentation**: REST controllers and DTOs; thin layer that delegates to application services.

Dependencies point inward: presentation → application → domain; infrastructure implements domain ports.

### Feature-Based Structure

- Features are vertical slices: **applications**, **dependencies**, **graph**, **auth**.
- Each feature owns its domain, application, infrastructure, and presentation packages (backend) or components/pages/api (frontend).
- This keeps changes localized, improves discoverability, and scales with more teams/features.

### Neo4j for Graph Data

- Applications and dependencies map naturally to nodes and relationships.
- Cypher supports complex traversals and aggregations for drill-down and “subgraph” views.
- A single integer `year` property on `Application` and `Module` nodes enables simple year-based filtering.

### Year filtering (`year`)

- `Application` and `Module` nodes carry an optional integer `year` (e.g. `2025`).
- `GET /api/graph?year=2025` returns only the applications whose `year == 2025` (and the edges between them); omitting `year` returns the full graph.
- The `year` filter combines (AND) with the existing `applicationIds` / `businessUnitIds` / `regionCodes` filters.

### Scalability (Thousands of Nodes)

- **Backend**: Pagination and bounded graph queries (e.g. by application id, depth, or time window); avoid “load entire graph” APIs; use Neo4j indexes and projection for hot paths.
- **Frontend**: Cytoscape.js supports large graphs with layout options and filtering; use viewport-based or level-of-detail loading where applicable (e.g. load neighborhood of selected node).

### Authentification (SQL + JWT)

- Comptes utilisateurs en **PostgreSQL** (Flyway `V1__create_users.sql`), mots de passe **BCrypt**, API **JWT**.
- Connexion SPA : `/login` ; création de comptes : page **`/admin/users`** (rôle **ADMIN** uniquement).
- Variables d’environnement, bootstrap du premier admin, CORS : voir **[docs/AUTH.md](docs/AUTH.md)**.

### Docker

- **docker-compose** lance **Postgres**, Neo4j, backend et frontend (nginx pour le build SPA ; `/api` proxifié vers le backend).
- Backend Dockerfile uses Maven in Alpine; frontend uses multi-stage build (Node for build, nginx for serve).
- Neo4j has a healthcheck so the backend starts only when the DB is ready.

## Getting Started

### Prerequisites

- Node.js 18+
- Java 21
- Maven (or generate wrapper: `cd apps/backend && mvn -N wrapper:wrapper`)
- Docker & Docker Compose (optional)

### Local development

1. **Neo4j** (required for backend):
   ```bash
   docker run -d --name neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:5-community
   ```
   Or start the full stack: `docker-compose up -d neo4j`.

2. **PostgreSQL** (requis pour les comptes / JWT) : par ex. `docker run -d --name postgres -e POSTGRES_DB=itmapping -e POSTGRES_USER=itmapping -e POSTGRES_PASSWORD=itmapping -p 5432:5432 postgres:16-alpine`

3. **Backend** — définir au minimum `JWT_SECRET` (≥ 32 caractères UTF-8), `DATABASE_*` si besoin, puis :
   ```bash
   cd apps/backend && ./mvnw spring-boot:run
   # Or: mvn spring-boot:run
   ```
   API base: `http://localhost:8080/api`.

4. **Frontend**
   ```bash
   npm install
   npm run dev:frontend
   ```
   App: `http://localhost:3000` (Vite proxies `/api` to the backend).

### Docker (full stack)

```bash
docker-compose up -d
```

- Neo4j: `http://localhost:7474`
- Backend (depuis l’hôte, port mappé pour éviter le conflit avec 8080): `http://localhost:8081/api` (variable `BACKEND_HOST_PORT` dans `docker-compose.yml`)
- Frontend: `http://localhost:3000` (le proxy `/api` vers le backend est interne au réseau Docker)

### Root scripts (from repo root)

| Script            | Description                |
|-------------------|----------------------------|
| `npm run dev:frontend` | Start Vite dev server     |
| `npm run build:frontend` | Build frontend SPA      |
| `npm run dev:backend`   | Run Spring Boot (from backend dir) |
| `npm run build:backend` | Package backend JAR (from backend dir) |
| `npm run docker:up`     | Start all services        |
| `npm run docker:down`   | Stop all services         |

### Module graph (drill-down)

- On the main map, **click an Application node** to open `/map/apps/{applicationId}`: Cytoscape shows the **Module** tree (`CONTAINS` edges) for that app.
- API: `GET /api/applications/{id}/module-graph`. Same JSON shape as `GET /api/graph` (`GraphResponseDto`). **404** if the application is unknown; **200** with the application root only if there are no modules.
- Optional env (backend): **`APP_MODULE_GRAPH_MAX_DEPTH`** (default **10**) — max `CONTAINS` hops in Cypher (hard-capped at 50 in code).

### Regions (application detail)

- Neo4j: `(:Application)-[:IS_USED_IN]->(:Region)`. Main map graph can be filtered with **`GET /api/graph?regionCode=...`** (regions are not nodes in that JSON).
- **Catalogue:** `GET /api/regions` (sorted by `code`) for UI pickers.
- **Application detail:** `GET /api/applications/{id}` includes **`regions`** (`id`, `code`, `name`) when non-empty.
- **Edit links (replace all):** `PATCH /api/applications/{id}/regions` with body `{"regionCodes":["EMEA","APAC"]}`; `[]` clears. Unknown codes → **400**.

## What’s Not Included (By Design)

- No JWT implementation: only auth-ready layout and stubs.
- Further enterprise rules (governance, RBAC) are left to product iterations.

## License

Proprietary / MIT as needed.
