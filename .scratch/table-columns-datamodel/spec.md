# Spec — Table columns from Data Model + column picker

**Slug:** `table-columns-datamodel`  
**Surface:** Vue Table (Apps / Flows) — Production + Sandbox  
**Backend:** aucun endpoint nouveau (réutilise Data Model + facets existants)  
**Status:** frozen (D1–D5 accepted)

---

## 1. Problème

Aujourd’hui :

| Table | Colonnes |
|---|---|
| **Apps** | `Name` / `ID` / `Description` hardcodés + extras via `nodeFilters` (mélange NODE / NODE_REF / **EDGE**) |
| **Flows** | 6 colonnes hardcodées (`Source`, `Target`, `ID`, `data`, `connection_kind`, `Type`) — pas liées au Data Model EDGE |

Objectif : **source + valeurs** des colonnes attributs = Data Model ; **choix / ordre** des colonnes visibles via le burger en vue Table.

---

## 2. Modèle de colonnes

### 2.1 Deux familles

1. **Colonnes structurelles** (graphe / identité) — pas des champs Data Model (clés réservées côté validator : `id`, `name`, `description`, …).
2. **Colonnes attribut** — strictement les champs Data Model du bon `target`.

### 2.2 Apps (`tableContent === 'apps'`)

| Kind | Keys / source | Label | Valeur cellule |
|---|---|---|---|
| Structural | `name` | Name | `node.label` |
| Structural | `id` | ID | `node.id` |
| Structural | `description` | Description | `node.description` / catalogue |
| Attribut | Data Model `target = NODE` | `field.label` | `node.properties[key]` |
| Attribut | Data Model `target = NODE_REF` | `field.label` | noms des refs `CLASSIFIED_AS` (comme ailleurs UI) ; fallback id |

**Ne pas** afficher les dimensions `kind === 'EDGE'` dans la table Apps (bug actuel si on mappe tout `nodeFilters`).

### 2.3 Flows (`tableContent === 'flows'`)

| Kind | Keys / source | Label | Valeur cellule |
|---|---|---|---|
| Structural | `source` | Source | label nœud source |
| Structural | `target` | Target | label nœud target |
| Structural | `id` | ID | `edge.id` |
| Structural | `type` | Type | `edge.type` (ex. `DEPENDS_ON`) |
| Attribut | Data Model `target = EDGE` | `field.label` | `edge.properties[key]` (+ résolution label légende / allowedValues si déjà utilisée ailleurs) |

**Rupture volontaire v1 :** plus de colonnes hardcodées `Exchanged data` / `Integration kind` sauf si ces clés existent comme champs EDGE dans le Data Model.

Note : `connection_kind` est **réservé** côté validator → ne peut pas être un champ DM aujourd’hui. Hors scope v1 (pas de colonne système dédiée).

### 2.4 Catalogue colonnes (dérivé)

```ts
type TableColumnDef = {
  id: string;           // stable: 'structural:name' | 'attr:domain' | …
  kind: 'structural' | 'attribute';
  key: string;          // name | id | data | …
  label: string;        // UI header
  table: 'apps' | 'flows';
};
```

Construit côté frontend à partir de :

- liste fixe structurale (ci-dessus)
- Data Model / `GET /api/graph/node-filters` filtré par `kind` (`NODE`+`NODE_REF` vs `EDGE`)

Ordre catalogue par défaut = structural d’abord (ordre fixe), puis attributs dans l’ordre Data Model.

---

## 3. Visibilité & ordre (picker)

### 3.1 État

Deux listes ordonnées **par table** (`apps` / `flows`) :

- `displayColumnIds: string[]` — visibles, **ordre = ordre des `<th>`**
- colonnes absentes de `display` = masquées (zone « available / hidden »)

**Défaut :** toutes les colonnes du catalogue courant sont dans `display` (rien de masqué au premier usage).

Quand le Data Model gagne un champ : l’ajouter **en fin de `display`** (visible par défaut).  
Quand un champ disparaît : le retirer des deux listes (pas de fantôme).

### 3.2 Persistance

- `localStorage` clés du type `graph.table.columns.apps` / `graph.table.columns.flows`
- Scope : navigateur / utilisateur machine (pas Neo4j, pas snapshot « My views » en v1)
- Sandbox et Production **partagent** la préférence colonnes (même UI table)

### 3.3 UX burger en vue Table

Quand `displayMode === 'table'` :

1. Ouvrir le burger ouvre le panneau latéral en mode **Columns** uniquement.
2. La barre d’outils habituelle (Filters / Search / Corrections / Chat / …) **n’est pas proposée** dans ce mode (remplacée entièrement — pas un onglet de plus).
3. Contenu du panneau :
   - Titre : `Columns` (+ sous-titre Apps ou Flows selon le toggle table)
   - Zone **Display** (droppable) : chips/rows des colonnes visibles, réordonnables
   - Zone **Hidden** (ou « Available ») : colonnes non affichées
   - Drag-and-drop entre zones + reorder dans Display
4. Feedback immédiat : la table se met à jour sans bouton Save.
5. En quittant la vue Table → comportement burger actuel restauré (Filters, Toolkit, etc.).

Toggle Apps / Flows (existant) change la table **et** le catalogue / listes du picker (préférence indépendante par table).

---

## 4. Rendu table

- Headers = labels des colonnes `display` dans l’ordre.
- Cellules = résolution §2 ; valeur vide → `—` (comportement actuel).
- Clic ligne inchangé (détails app / edge).
- Pas de tri multi-colonnes / resize colonnes en v1.
- Accessibilité : zones DnD avec labels ; alternative clavier minimale (boutons « Show / Hide / Move up / down » acceptables si DnD seul trop lourd).

---

## 5. Hors scope v1

- Persistance colonnes dans « My views » / snapshots
- Export CSV / Excel
- Filtres depuis les headers
- Colonnes calculées / jointes hors DM
- Rich formatting
- Modifier le Data Model depuis la table
- Conserver `connection_kind` / `data` hardcodés sans entrée DM
- Colonne système dédiée pour `connection_kind`

---

## 6. Critères d’acceptation

1. **Apps** : colonnes attribut = uniquement champs DM `NODE` + `NODE_REF` ; labels = labels DM ; valeurs = props / refs réelles.
2. **Flows** : colonnes attribut = uniquement champs DM `EDGE` ; plus de trio hardcodé `data` / `connection_kind` sauf s’ils sont dans le DM.
3. Aucune colonne EDGE dans Apps ; aucune NODE dans Flows.
4. Au premier chargement, **toutes** les colonnes (structural + attribut) sont visibles.
5. En vue Table, burger = picker Display / Hidden ; drag change visibilité + ordre ; table suit immédiatement.
6. Préférence survivante reload (localStorage) ; nouveaux champs DM apparaissent en Display.
7. Production et Sandbox : même logique colonnes ; sandbox ids restent stylés comme aujourd’hui.
8. Hors vue Table, le menu burger retrouve ses outils actuels.

---

## 7. Décisions figées

| # | Décision | Choix |
|---|---|---|
| D1 | Colonnes structurelles gardées en plus du DM | **Oui** (Name/ID/Description ; Source/Target/ID/Type) |
| D2 | Anciennes colonnes Flows `data` / `connection_kind` | **Drop** sauf si présentes en DM EDGE ; sinon hors v1 |
| D3 | Pref colonnes | **localStorage**, pas My views |
| D4 | Burger en table | **Remplace entièrement** la tool rail (pas un onglet de plus) |
| D5 | NODE_REF | Colonne attribut avec **labels humains** |
