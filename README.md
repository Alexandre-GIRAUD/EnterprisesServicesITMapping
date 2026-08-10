# Enterprise IT Mapping Platform

Production-ready SaaS monorepo for mapping enterprise applications, their dependencies, and internal structure, with Data Model driven filtering and scalability to thousands of nodes.

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
- Flat business attributes are properties on `Application` nodes (`Data Model` `target=NODE`).
- Catalogue classifications are `:DataModelRef` nodes linked with `CLASSIFIED_AS` (`target=NODE_REF`). There is **no** seed of business fields (region, BU, …): admins declare NODE_REF fields and values in `/data-model` when needed.
- Connection attributes are dynamic properties on `DEPENDS_ON` relationships (`Data Model` `target=EDGE`).

### Graph filtering (Data Model driven)

- `GET /api/graph` filter axes:
  - `applicationIds` (repeatable; singular `applicationId` also accepted): OR on application ids;
  - `attr.<key>` (repeatable per key): flat NODE props — OR inside a key, AND across keys;
  - `ref.<key>` (repeatable per key): NODE_REF catalogue **ids** via `(:Application)-[:CLASSIFIED_AS {fieldKey}]->(:DataModelRef)`;
  - `edge.<key>` (repeatable per key): flat EDGE props on `DEPENDS_ON` — OR inside a key, AND across keys. Edge filters shrink relationships only (**Option A**: applications from the node filter set stay, even if isolated).
  Keys absent from the Data Model (or failing `KEY_PATTERN`) are ignored. Axes combine with AND.
- `GET /api/graph/node-filters` returns NODE + NODE_REF + EDGE dimensions (`kind`, `multiple`, and for NODE_REF `options: [{id,name}]`). Historical path name kept; EDGE facets use `allowedValues` when set, otherwise distinct Neo4j values on `DEPENDS_ON`.
- `PATCH /api/applications/{id}/node-attributes` edits flat NODE props; `PATCH /api/applications/{id}/node-refs` replaces CLASSIFIED_AS links by ref ids (no free-text catalogue create).
- Saving the Data Model upserts `:DataModelRef` for each NODE_REF `allowedValues` entry and soft-retires removed values (`active=false`).
- Graph snapshots store `{applicationIds, nodeAttributes, nodeRefs, edgeAttributes}`. Flat attributes use Data Model `target=NODE` (`year` is reserved — use e.g. `reference_year`). Catalogue dimensions use `target=NODE_REF`. Edge dimensions use `target=EDGE` (reserved technical keys such as `connection_kind` / `channel` stay non-filterable via DM).

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

### Application attributes (application detail)

- **Application detail:** `GET /api/applications/{id}` includes **`nodeAttributes`** (flat NODE props) and **`nodeRefs`** (CLASSIFIED_AS links) when non-empty; the list endpoint omits them.
- The details drawer renders one input per Data Model `target=NODE` field and a select / multi-select per `target=NODE_REF` field (options = synced catalogue). Saves go through `PATCH .../node-attributes` and `PATCH .../node-refs`.

## What’s Not Included (By Design)

- No JWT implementation: only auth-ready layout and stubs.
- Further enterprise rules (governance, RBAC) are left to product iterations.

## License

Proprietary / MIT as needed.
