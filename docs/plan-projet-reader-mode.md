# Reader Mode — Plan projet & journal des décisions

> Extension Chrome (Manifest V3) : confort de lecture, nettoyage des interfaces, persistance de la position de lecture.
> Module 1 de la suite (Module 2 — Résumeur IA — viendra après stabilisation).

---

## 1. Journal des décisions (ADR condensé)

| # | Décision | Choix acté | Justification courte |
|---|----------|-----------|----------------------|
| D1 | Architecture du reader | **Overlay en Shadow DOM** sur la page (pas de page custom `chrome-extension://`) | Conserve l'URL réelle, l'historique, le partage ; cohérent avec la persistance de position ; bascule instantanée reader/natif |
| D2 | Shadow DOM | `attachShadow({ mode: 'closed' })`, monté sur `documentElement`, `all: initial` sur le host, z-index max, `inert` + `overflow: hidden` sur le body pendant l'overlay | Isolation CSS bidirectionnelle + accessibilité correcte |
| D3 | Activation du cleanup | **Permanent par étages** : É1 règles perDomain vérifiées (toujours actif) → É2 sélecteurs génériques conservateurs (toujours actif) → É3 heuristiques MutationObserver (**opt-in**, "mode agressif") | UX maximale sans risque de casser des sites légitimes |
| D4 | Réversibilité du cleanup | Chaque masquage visible (badge "N éléments masqués") et restaurable en 1 clic → crée une exception locale par domaine | Désamorce les faux positifs + génère des données de correction des règles |
| D5 | Sites sensibles | Allowlist par défaut dans le bundle (banques, gouvernement, santé) : pas de cleanup, pas de sauvegarde de position | Gain faible, risque réputationnel maximal |
| D6 | Persistance de position | **Auto sur toutes les pages à contenu substantiel** (> 2000 chars de contenu principal), **TTL 7 jours**, local uniquement. Pages épinglées ("reprendre plus tard") : **TTL 90 jours** + liste "Lectures en cours" | Magie sans friction + argument privacy honnête + quota maîtrisé |
| D7 | Conditions de sauvegarde | Uniquement si scroll réel ET > 15 s sur la page ; jamais en navigation privée ; jamais sur l'allowlist sensible ; bouton "tout effacer" | Évite le bruit, respecte la vie privée |
| D8 | Méthode de masquage | `display: none !important` via style inline (jamais `remove()`) | `remove()` casse les scripts du site et coûte cher |
| D9 | Injection CSS étages 1-2 | Déclarée dans le **manifest** (`content_scripts.css`, `run_at: document_start`) — jamais via JS | Seule façon d'appliquer avant le premier paint (pas de flash) |
| D10 | Pipeline d'extraction (MVP) | Readability.js **dans le content script** via `requestIdleCallback` (déclenchement à la demande). Offscreen Document = optimisation différée, à introduire sur mesure réelle | < 100 ms sur 90 % des pages, latence tolérée (action explicite) ; évite la complexité de messaging tant qu'elle n'est pas nécessaire |
| D11 | Reader auto vs à la demande | **Opt-in par domaine, mémorisé** (pas d'auto-détection globale) | Économise le CPU sur toutes les pages |
| D12 | Règles de filtrage | JSON distant (CDN/GitHub raw), fetch au démarrage + toutes les 24 h (`chrome.alarms`), ETag, fallback bundle local, jamais bloquant à l'init. Champs `version` + `minExtensionVersion` dès le v1 du schéma | Mise à jour sans redéploiement ; conforme CWS (données, pas de code distant) ; migrations futures sans crash |
| D13 | Modèle d'ancrage | **3 ancres textuelles** (above / center / below, espacées de 2 blocs), `exactText` 60-80 chars + prefix/suffix ~30 chars, `blockIndex` ordinal en fallback, `intraBlockOffset`, `contentFingerprint` | Dégradation gracieuse ; aligné sur le standard Text Fragments ; résiste aux pubs insérées et micro-éditions |
| D14 | Point de référence viewport | **40 %** de la hauteur (pas 50 %) | C'est la ligne de lecture réelle de l'œil |
| D15 | Normalisation du texte | NFKC + espaces exotiques + quotes courbes + tirems em/en + collapse whitespace + lowercase. **Identique capture/restauration**, dans `core`, testée isolément | Différence entre 85 % et 98 % de taux de match (smart quotes, `&nbsp;`…) |
| D16 | Cascade de matching | `exact` (≥ 2/3 ancres + cohérence ordre/distance) → `fuzzy` (trigrammes + Jaccard, seuil **0.8**, scan fenêtré ±30 blocs) → `ordinal` (si drift structurel < **0.15**) → `percent` → `abort` (fingerprint < 0.3) | Un match incohérent est pire qu'un échec ; jamais de scroll vers un faux positif |
| D17 | Algorithme fuzzy | Shingles de **trigrammes + Jaccard** (pas Levenshtein) | O(n) en pratique, < 5 ms sur 500 blocs |
| D18 | Exécution du scroll | **Instantané** (jamais smooth) ; toast discret si confiance `ordinal`/`percent` ; silence total si `abort` | La page doit sembler s'être *ouverte* là |
| D19 | Timing de restauration | Restauration au DOM ready + **fenêtre de stabilisation 3 s** (ResizeObserver, re-corrige les layout shifts) + **retry unique à +1,5 s** si ancres introuvables (lazy load). Flag `userHasScrolled` sacré : on ne se bat jamais contre un scroll utilisateur | Robustesse face aux images sans dimensions, fonts, lazy loading |
| D20 | Capture | Throttle scroll → écriture storage max ~2 s ; capture finale sur `visibilitychange → hidden` (pas `beforeunload`) | Fiabilité fermeture d'onglet + pas de jank |
| D21 | Normalisation d'URL | Strip des paramètres de tracking (`utm_*`, `fbclid`, …), clé = hash de l'URL normalisée. GC des entrées expirées | Match entre visites ; liste réutilisable pour une future feature "URL propre" |
| D22 | SPAs | Observer `history.pushState` / `popstate` → re-keying par URL, re-déclenchement de la logique | Twitter, YouTube, Notion… |
| D23 | Structure du repo | **Monorepo** : `packages/core` (ancrage, extraction, moteur de règles — TS pur, testable en Node) + `packages/extension` (wiring Chrome) | 80 % de la logique critique testable en CI sur fixtures HTML |
| D24 | Stack | React + Vite + TypeScript, Tailwind (injecté dans le shadow root), Zustand (popup/options), CRXJS, `chrome.storage.local` source de vérité + `onChanged` pour l'hydratation inter-contextes | Conforme au doc d'architecture initial |
| D25 | Ordre de build | **La persistance de position d'abord** (le composant au plus fort risque technique et au moins de dépendances), puis cleanup É1-É2, puis reader overlay, puis É3, puis publication | Savoir en semaine 1 — pas en semaine 8 — si l'ancrage atteint > 95 % de restauration correcte |
| D26 | Analytics | PostHog, anonymisé : distribution des niveaux de confiance de restauration, sélecteurs restaurés par domaine | Pilotage des seuils (0.8 / 0.15) et correction des règles distantes |

**Paramètres marqués "à ajuster sur mesure réelle"** (paris, pas certitudes) : TTL 7 jours (→ 30 j si plaintes), seuil fuzzy 0.8, drift 0.15, `BLOCK_SELECTOR` vs approche par nœuds texte (cas des sites en "div soup").

---

## 2. Découpage en épics

### EPIC 0 — Fondations du projet
*Objectif : un squelette qui build, se charge dans Chrome, et teste en CI.*

- [ ] Monorepo (pnpm workspaces) : `packages/core`, `packages/extension`
- [ ] `extension` : Vite + CRXJS + React + TS + Tailwind, manifest V3 minimal (SW + content script hello-world + popup)
- [ ] `core` : TS pur, vitest + happy-dom, zéro dépendance Chrome
- [ ] CI : lint, typecheck, tests core, build extension
- [ ] Script de fixtures : téléchargement + snapshot du HTML d'une vingtaine de vrais sites (presse FR/US, blogs, docs techniques, Wikipedia) dans `fixtures/`

**Done quand** : `pnpm build` produit une extension chargeable, `pnpm test` passe en CI, fixtures versionnées.

---

### EPIC 1 — Moteur d'ancrage textuel (core uniquement) 🎯 *Le de-risking*
*Objectif : valider que l'ancrage atteint > 95 % de restauration correcte sur de vraies pages, avant tout investissement ailleurs.*

- [ ] `normalizeText` + tests unitaires dédiés (NFKC, quotes, espaces, tirets)
- [ ] `collectBlocks` (BLOCK_SELECTOR, filtres visibilité/longueur/zones exclues)
- [ ] Types `TextAnchor`, `PositionRecord` ; capture des 3 ancres (40 % viewport, espacement 2 blocs)
- [ ] `contentFingerprint`
- [ ] Cascade de restauration : `findExact` (+ désambiguïsation prefix/suffix + `areConsistent`), `findFuzzy` (trigrammes/Jaccard, scan fenêtré), ordinal (drift), percent, abort
- [ ] Normalisation d'URL (strip tracking params) + hashing
- [ ] **Harnais de tests paramétriques** : 8 fonctions de mutation (`insertAd`, `fixTypo`, `removeParagraph`, `rewriteAll`, `smartQuotes`, `duplicateText`, `divSoup`, `truncatePaywall`) × 20 fixtures = 160 cas
- [ ] Familles de tests A (identité), B (mutations contenu), C (mutations structure) — voir matrice
- [ ] Budgets perf en CI : capture < 10 ms / 1000 blocs, restauration pire cas < 30 ms / 500 blocs, record sérialisé < 2 KB

**Done quand** : famille A à 100 %, familles B-C aux comportements documentés, budgets perf verts. **Gate : si le taux de match exact+fuzzy < 95 % sur les fixtures, on revoit le design (approche nœuds texte) avant de continuer.**

---

### EPIC 2 — Persistance de position dans l'extension
*Objectif : la feature vivante de bout en bout sur des pages normales (sans reader, sans cleanup).*

- [ ] Content script : `IntersectionObserver` sur les blocs, capture throttlée (dirty flag + tick 2 s), conditions d'engagement (> 15 s + scroll réel)
- [ ] Capture finale sur `visibilitychange → hidden`
- [ ] Restauration au chargement : `restoreWithStabilization` (DOM ready → match → scroll instantané → fenêtre ResizeObserver 3 s → retry +1,5 s), flag `userHasScrolled`
- [ ] Toast discret pour confiance `ordinal`/`percent`
- [ ] Storage : clés par urlHash, TTL auto 7 j, GC périodique (`chrome.alarms`)
- [ ] Exclusions : navigation privée, allowlist sensible (bundle initial)
- [ ] Support SPA : hooks `pushState`/`popstate` → re-keying
- [ ] Popup v1 : toggle global, toggle par domaine, "tout effacer"
- [ ] Épinglage "reprendre plus tard" (TTL 90 j) + liste "Lectures en cours" dans la popup
- [ ] Tests d'intégration Playwright : famille D (lazy load, layout shift, scroll utilisateur pendant stabilisation, navigation SPA)

**Done quand** : dogfooding quotidien sur 50+ sites réels pendant 2 semaines, taux de restauration perçu correct, zéro vol de scroll utilisateur.

---

### EPIC 3 — Moteur de règles & cleanup (étages 1-2)
*Objectif : les popups/cookie banners connus disparaissent avant le premier paint, sans flash et sans faux positifs.*

- [ ] Schéma JSON v1 : `version`, `minExtensionVersion`, `global.cssSelectors`, `global.heuristics`, `perDomain.{hide, readerSelector, removeBeforeExtract}` + validation (zod) dans `core`
- [ ] CSS étages 1-2 générée du JSON, déclarée dans le manifest à `document_start`
- [ ] Bundle local de règles initiales : top 50 sites FR/US vérifiés à la main (étage 1) + sélecteurs génériques conservateurs (étage 2)
- [ ] SW : fetch distant (CDN/GitHub raw) au démarrage + alarme 24 h, ETag, fallback cache, jamais bloquant
- [ ] Badge "N éléments masqués" + panneau de restauration 1 clic → exception locale par domaine
- [ ] Allowlist sensible complète (banques, gouv, santé) appliquée au cleanup ET à la persistance
- [ ] Télémétrie PostHog (anonyme) : restaurations par sélecteur × domaine

**Done quand** : zéro flash visible sur les sites de l'étage 1, exceptions locales fonctionnelles, pipeline de mise à jour distante testé (bump de version → propagation < 24 h).

---

### EPIC 4 — Reader Mode (overlay)
*Objectif : la vue lecture épurée, isolée, qui partage le même système d'ancres que le mode natif.*

- [ ] Root Shadow DOM (`closed`, sur `documentElement`, `all: initial`, z-index max)
- [ ] Tailwind injecté dans le shadow root (config Vite dédiée)
- [ ] Body : `overflow: hidden` + `inert` pendant l'overlay ; restauration propre à la fermeture
- [ ] Extraction : Readability.js en content script via `requestIdleCallback` ; `removeBeforeExtract` et `readerSelector` des règles perDomain appliqués en amont
- [ ] UI lecture : typographie, thèmes clair/sombre/sépia, taille de police, largeur de colonne, métadonnées (titre, auteur, temps de lecture)
- [ ] **Continuité d'ancrage** : à l'ouverture du reader, restauration de la position courante dans la vue reader ; à la fermeture, retour à la même position en natif (les deux modes produisent la même séquence de blocs)
- [ ] Opt-in "toujours ouvrir en mode lecture sur ce domaine", mémorisé
- [ ] Gestion des échecs d'extraction (page non-article) : message propre, pas d'overlay vide
- [ ] Tests : extraction sur les 20 fixtures, bascule reader↔natif avec conservation de position (extension de la famille A2)

**Done quand** : bascule fluide dans les deux sens avec position conservée, lisible sur les 20 fixtures, CSP stricts gérés (injection par classes, pas de style inline bloquant).

---

### EPIC 5 — Mode agressif (étage 3) & boucle de feedback
*Objectif : attraper les popups dynamiques inconnus, en opt-in, sans jamais casser silencieusement.*

- [ ] MutationObserver heuristique : `position: fixed` + z-index ≥ seuil + couverture viewport ≥ 40 % + insertion > 2 s après load
- [ ] Masquage via style inline `display: none !important` (jamais remove)
- [ ] Opt-in global et par domaine dans la popup
- [ ] Intégration au badge/panneau de restauration (mêmes mécanismes que É1-É2)
- [ ] Garde-fous : jamais sur l'allowlist sensible, désactivation auto sur un domaine après N restaurations utilisateur
- [ ] Boucle de correction : dashboard interne PostHog → promotion des heuristiques fiables en règles perDomain (étage 1) via le JSON distant

**Done quand** : taux de faux positifs mesuré < 2 % sur le panel de dogfooding, désactivation auto fonctionnelle.

---

### EPIC 6 — Publication & industrialisation
*Objectif : sur le Chrome Web Store, avec un pipeline de release et des règles qui vivent.*

- [ ] Revue de conformité CWS : permissions minimales justifiées, privacy policy (traitement local, TTL, PostHog anonyme), règles distantes = données pas code
- [ ] Page d'options complète : gestion des exceptions, export/purge des données, allowlist
- [ ] Onboarding première installation (3 écrans max : ce que ça fait, le badge, l'épinglage)
- [ ] Pipeline de release : versioning, changelog, build reproductible, soumission CWS
- [ ] Hébergement des règles : CDN + workflow de publication (PR → validation → bump version)
- [ ] Beta fermée (20-50 utilisateurs) → ajustement des seuils (fuzzy 0.8, drift 0.15, TTL 7 j) sur données PostHog → publication publique

**Done quand** : extension publiée, première mise à jour de règles distantes livrée sans redéploiement, métriques de confiance de restauration en place.

---

### EPIC 7 — Post-MVP (backlog, non engagé)
- Module 2 : Résumeur intelligent (couche API IA, "réponds à ma question sur cette page")
- Bibliothèque d'articles sauvegardés / lecture offline (le cas où une page custom redevient pertinente)
- Feature "URL propre" au partage (réutilise la normalisation D21)
- Firefox / Edge (WebExtensions)
- Sync multi-appareils des positions épinglées (`chrome.storage.sync`, opt-in — implications privacy à réévaluer)
- Approche par nœuds texte si la "div soup" (cas C1) s'avère fréquente

---

## 3. Dépendances & jalons

```
EPIC 0 ──► EPIC 1 ──► EPIC 2 ──► EPIC 4 ──► EPIC 6
              │            └──────►  ▲
              │                      │
              └──(schéma JSON)─► EPIC 3 ──► EPIC 5 ──► EPIC 6
```

- **Jalon M1 (fin Epic 1)** : GO/NO-GO technique — l'ancrage tient-il > 95 % ?
- **Jalon M2 (fin Epic 2)** : la killer feature est dogfoodable au quotidien.
- **Jalon M3 (fin Epic 4)** : produit complet en interne (persistance + cleanup + reader).
- **Jalon M4 (fin Epic 6)** : public sur le Chrome Web Store.

## 4. Risques suivis

| Risque | Impact | Mitigation |
|---|---|---|
| Taux de match ancrage insuffisant sur le web réel | Fatal pour le produit | Epic 1 en premier + gate explicite à M1 |
| Faux positifs du cleanup → reviews négatives | Réputation | Étages conservateurs, badge réversible, désactivation auto, allowlist sensible |
| Rejet / délais Chrome Web Store (remote code, permissions) | Lancement | Règles = JSON données uniquement, permissions minimales, revue de conformité dédiée (Epic 6) |
| Flash de popup avant masquage | Perception qualité | CSS manifest `document_start` exclusivement (D9), test visuel par fixture |
| Layout shift / lazy load cassant la restauration | Qualité perçue | Stabilisation 3 s + retry + flag userHasScrolled (D19), famille D en CI |
| "Div soup" hors BLOCK_SELECTOR | Couverture | Mesure sur fixtures, bascule éventuelle vers nœuds texte (backlog) |
