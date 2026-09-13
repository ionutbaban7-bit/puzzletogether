# PROMPT DE EXECUTARE — CARTOGRAF (zona de emoții)

> Prompt auto-suficient pentru sesiunea de implementare. Context complet în
> `docs/emotions/01-PLAN-COMPLET.md`. Rulează **Fazele 0–4** (MVP); fazele 5–8 vin după testarea cu echipa.

---

## Rol și context

Ești echipa de implementare pentru **PuzzleTogether** (repo localizat în rădăcina workspace-ului).
Produsul existent: joc de workshop realtime pentru echipe — React 18 + TypeScript + Vite + Tailwind,
Node/Express + `ws` pe un singur origin, room codes, host-facilitator, etape
`lobby → brief → play → reveal → debrief → harvest`, board Observed/Learned/Try Next,
action items, export JSON + PDF, i18n RO/EN (`Bilingual { ro, en }`), **fără conturi**, fără servicii externe.
Convenții existente de studiat înainte de cod: `shared/coaching.json` (date de activitate servite prin API),
`src/lib/router.ts`, `src/lib/i18n.tsx`, `src/pages/GamePage.tsx`, `src/puzzle/QuestionnaireActivity.tsx`
(vot privat până la reveal — model pentru voturile de emoții), `src/components/FacilitatorPanel.tsx`,
`docs/qa-report.md` (formatul QA gate).

**Sarcina:** construiește zona nouă **CARTOGRAF** — o categorie de top pe lângă PuzzleTogether,
cu pagină dedicată solo (`/emotii`) + un modul de echipă (Camera Mare) ca activitate nouă de room.

## Non-negotiables (reguli dure)

1. **Nu se inventează studii.** Orice afirmație din UI care derivă din cercetare trebuie să existe în
   `docs/emotions/research-sources.md` cu sursă reală (autor, an, jurnal/URL, status: `verified` | `to-verify`).
   Afirmațiile `to-verify` NU apar în UI ca fapte — apar cu hedging („adesea", „multe persoane raportează")
   sau deloc.
2. **Nu se diagnostichează, nu se interpretează, nu se spun utilizatorului ce simte.**
   Zero limbi de tip „tu simți X", „subconștientul tău", „profilul tău". Toate outputurile = oglindă a datelor
   utilizatorului, formulate ca întrebări.
3. **Siguranța e produs, nu copy:** buton „Calm" permanent (resurse: 112, TelVerde anti-suicid ARPS
   0800 801 200 vin–dum 19:00–07:00 — **verifică numărul actual pe antisuicid.ro înainte de commit**,
   altfel pune doar „verifică pe antisuicid.ro"); skip/pauză/oprire la fiecare exercițiu; avertizare blândă
   la intensitate 8–10 + teme sensibile (o dată, nu insistent); declarația de non-terapie vizibilă.
4. **Camera Mare = vot privat, reveal anonim agregat (numere, niciodată nume), „Pas" = buton valid.**
5. **Fără AI/LLM la runtime.** Conversațiile cu personajele = scripturi deterministe (4 runde),
   coerent cu produsul (fără servicii externe).
6. **Datele utilizatorului = local-only** (localStorage versionat), fără conturi, fără tracking.
   Export = fișierul utilizatorului (JSON + PDF printabil).
7. **RO/EN pentru tot** (`Bilingual`). Culoare niciodată singurul indicator (iconiță + text), contrast AA,
   navigare cu tastatura pe roată.
8. **Calitatea repo-ului:** `npm run typecheck` și `npm run build` curate; `npm run test:protocol` 100% verde
   (testele existente NU se strică); commit-uri logice, commit message pe scurt în engleză.

## Identitate (fixă, nu o reinventa)

- Nume: **CARTOGRAF** · Tagline: „Simți. Numesc. Alege." / „Feel it. Name it. Choose."
- Metafora: hărțuirea lumii interioare — teritorii (emoții), cer/meteo (stare), burla (valență×arousal),
  isobare (intensitate), expediții (scenarii), frontiera (frici), muzeu (dovezi), locuitori (desene),
  curtea interioară (arhetipuri), atlas (hartă finală), instrumente (progres fără XP).
- Ton copy: scurt, pe întrebări, al doilea persoană, fără toxic positivity, fără „crede în tine".
  Fiecare card de emoție se încheie cu: „Aceasta e o hartă a teritoriului, nu teritoriul însuși."

## Arhitectura emoțională (fixă, din plan)

- Schelet: **Plutchik** — 8 familii (bucurie, trust, frică, surprindere, tristețe, dispreț, furie, anticipare)
  × 3 niveluri de intensitate jucabile (nuanță / emoție / extrem) = **24 de carduri** (8×3) + **11 blend-uri**, fiecare card cu spectru complet de 8 trepte
  (amestecuri dintre vecine). Ex. frică: neliniște → frică → groază.
- Orientare: **circumplex valență × arousal (Russell)** — fiecare emoție are coordonate
  `valence` (−5…+5), `arousal` (−5…5); afișate pe burlă.
- Epistemă: **constructivism (Barrett)** — produsul etichetează, nu descoperă; granularitatea (alegerea
  etichetei precise în loc de generic) e o metrică reală de progres.
- Ancore pentru arhetipuri: **Panksepp** (sisteme afective) + IFS ca **metaforă etichetată**
  (UI trebuie să spună explicit că e metaforă, nu tipologie validată).

## Faze și criterii de acceptanță

### Faza 0 — Fundația (date, nu UI)

Livrabil: `shared/emotions-taxonomy.json`, `shared/emotions-situations.json`,
`shared/emotions-archetypes.json`, `docs/emotions/research-sources.md`.

Schema `emotions-taxonomy.json` (array de obiecte):

```jsonc
{
  "id": "frica-n2",                    // stable, slug
  "family": "fear",                     // joy|trust|fear|surprise|sadness|disgust|anger|anticipation
  "level": 2,                           // 1=nuanță, 2=emoție, 3=extrem
  "name": { "ro": "Frică", "en": "Fear" },
  "def": { "ro": "…", "en": "…" },                    // 1–2 rânduri, clar
  "body": { "ro": "…", "en": "…" },                    // semnale tipice în corp, 2–4 puncte
  "thoughts": { "ro": "…", "en": "…" },                // 2–3 exemple de gânduri, etichetate ca exemple
  "impulse": { "ro": "…", "en": "…" },                 // impulsul comportamental tipic
  "function": { "ro": "…", "en": "…" },                // „adesea semnalează…" (hedging obligatoriu)
  "usefulWhen": { "ro": "…", "en": "…" },
  "heavyWhen": { "ro": "…", "en": "…" },               // + când e momentul pentru specialist
  "near": ["neliniste", "ingrijorare"],                 // id-uri emoții apropiate
  "notSameAs": { "ro": "…", "en": "…" },                // diferențiere explicită (ex. frică vs. anxietate)
  "triggers": { "ro": ["…"], "en": ["…"] },             // „frecvent raportat"
  "valence": -3, "arousal": 3,
  "microExercise": { "ro": "…", "en": "…" },            // exercițiu de 60 s
  "research": [ { "title": "…", "year": 2014, "source": "…", "url": "…", "status": "verified" } ],
  "caveat": { "ro": "…", "en": "…" }                    // onestitate: ce nu știm
}
```

Cereri de conținut:
- **24 carduri** (8 familii × 3 niveluri), fiecare cu toate câmpurile populate, bilingv + spectru de 8 trepte.
- **10 blend-uri** (id `blend-*`, câmp `blendOf: [id, id]`, def + „când stau alături").
- **60+ situații solo**: `shared/emotions-situations.json` —
  `{ id, mode: "solo", category, text: {ro,en}, heavy: bool }`; 8 categorii × ~8; neutre, fără răspuns corect;
  marcează `heavy: true` pe cele care pot activa (pierdere, respingere, eșec, conflict, singurătate).
- **30+ situații de grup**: `mode: "room"`, orientate pe echipă/loc de muncă + 6 neutre; fiecare cu
  `debriefPrompts: [{ro,en}]` (2–3 prompturi).
- **8 arhetipuri** în `emotions-archetypes.json`: Gardianul, Apărătorul, Plângătorul, Sărbătoritorul,
  Ținătorul de apartenență, Exploratorul, Criticul, Observatorul — fiecare cu: `claim` (1 linie),
  `system` (ancora Panksepp + familia Plutchik), `usefulWhen`, `overreachesWhen`, `itsFear`,
  `whatToSay`, `reflectionQuestion`, toate bilingve + câmpul fix `disclaimer` (metaforă, nu tipologie).
- `research-sources.md`: tabel per mecanică — afirmație din UI → sursă (autor, an, jurnal, DOI/URL) →
  status. Minim: Lieberman 2007; Nummenmaa 2014; Craske 2008 și 2014; Bandura 1977; Clance & Imes 1978;
  Tangney & Dearing; Neff 2003; Hayes (ACT); Barrett (granularity/constructivism); Plutchik 1980;
  Russell 1980; Panksepp 1998; Wegner 1987; Rachman 1979 (verifică-le pe toate; orice nuanță de dată/nume
  corectă se bazează pe sursă, nu pe memorie).

**Acceptanță Faza 0:** `node -e "JSON.parse(...)"` pe cele 3 fișiere; script `scripts/emotions-audit.mjs`
(nou) care validează schema + completitudinea + bilingvitatea → rulat cu `npm run emotions:audit`
(adaugat în `package.json`), 0 erori.

### Faza 1 — Harta + Cartea

Livrabil: ruta `/emotii` (tabul **HARTA**) + landing section.

- `src/lib/router.ts`: `{ name: "emotions" }` → `/emotii`; `src/App.tsx`: case nou.
- `src/pages/EmotionsPage.tsx`: shell-ul zonei (header CARTOGRAF + nav sticky cu 7 taburi; taburile 3–7
  afișează placeholder „urmează" peste faza 4; buton **Calm** permanent).
- `src/emotions/Wheel.tsx`: roata interactivă — 8 segmente, 3 inele per segment (24 de ținte),
  tap → `EmotionCard`; navigare tastatură (săgeți/enter), aria-labels; culorile familiilor + iconițe +
  nume (niciodată doar culoare).
- `src/emotions/EmotionCard.tsx`: cartea emoției cu cele 12 secțiuni din plan (incl. secțiunea „Cercetare"
  cu sursele din JSON și `caveat`; încheiere cu fraza fixă).
- `src/emotions/Compass.tsx`: burla valență×arousal; emoția selectată se plasează pe ea;
  etichetă „orientare, nu verdict".
- Landing (`LandingPage.tsx`): secțiune nouă pe lângă features — „CARTOGRAF — zona de emoții", 2 CTA-uri:
  „Începe atlasul tău" → `/emotii`, „Jocul în cameră" → create room (activitate emotions, activ din faza 4;
  până atunci link-ul e deghizat/ascuns în funcție de feature flag).
- Buton **Calm** (`src/emotions/CalmScreen.tsx`): respirație 4-4-4 (ghid vizual simplu), „poți închide
  oricând", resurse (112 + TelVerde cu avertisment de verificare + „vorbește cu cineva de încredere").

**Acceptanță Faza 1:** tap pe orice țintă a roții → cardul complet în RO și EN; burla plasează emoția;
Calm accesibil în 1 tap din orice ecran al zonei; `typecheck` + `build` curate; screenshot desktop + mobil
în `docs/screenshots/` (convenția existentă).

### Faza 2 — Meteo + Expediții

Livrabil: taburile **METEO** și **EXPEDIȚII** funcționale + store local.

- `src/emotions-store.ts` (sau `src/emotions/store.ts`): state versionat în localStorage:
  `{ version, weather: [{date, emotions: [id], intensity, bodyZones: []}], expeditions: [{id, situationId,
    emotions: [id], intensity, bodyZones, label, thought, reaction, journal, createdAt}],
    fears: [], ladder: [], museum: [], court: {}, settings: { heavyThemesEnabled } }` —
  cu `migrate()` și `exportJSON()`.
- **METEO:** „Ce cer e în tine azi?" — 1–3 emoții (multi-select de pe roată), intensitate 0–10 (slider/segmente),
  corp (opțional, `BodyMap` — siluetă simplă cu 8 zone tapabile: cap, gât, piept, burtă, umeri, mâini, spate, picioare).
  Istoric: graf simplu (bară/heatmap ultimele 14 zile, fără librării externe — SVG inline).
  „Raportul săptămânii" generat din date: frecvențe, intensitate medie, co-ocurențe, zile tipice,
  „ceruri pe care rar le arăți" (emoții selectate dar intensitate mare = „ascunse" — formulat ca întrebare).
- **EXPEDIȚII:** loop-ul de 6 bătăi (situație → meteo → corp → nume+gând → reacție → câmp de jurnal):
  - card de situație din `situations.json` (`mode: "solo"`, `heavy` respectă `settings.heavyThemesEnabled`);
  - la bătăia 4: lista de 5–7 etichete apropiate (din `near`) + „varianta precisă" vs. generic —
    alegerea variantei precise contează pentru metrica de granularitate;
  - la bătăia 5: 5 reacții (urmez impulsul / rămân și observ / fac altceva / vorbesc / evit) +
    consecințe formulate neutru (2 rânduri: „ce se întâmplă de obicei" + „ce înveți din asta"), fără moral;
  - la bătăia 6: „Ce m-a surprins la mine?" (liber, opțional) + „Un pas mic pentru data viitoare" (opțional);
  - butoane **Skip / Pauză** vizibile la fiecare bătăe; la intensitate 8–10 sau situație `heavy`:
    întrebarea blândă o singură dată (pauză / skip / rămân).
- Câmpurile de jurnal se scriu în store → vizibile în lista „jurnal de expediții" (sub, cu data).

**Acceptanță Faza 2:** 3 expediții complete consecutive fără erori; meteo-ul se înregistrează și se vede
în istoric; skip-ul nu pierde date; raportul săptămânii corect pe datele testate; unități de test pentru
store (migrate + export) în `scripts/` (convenția repo-ului) rulate în `npm run test:protocol`.

### Faza 3 — Frontiera + Muzeul

Livrabil: taburile **FRONTERA** și **MUZEUL**.

- **FRONTERA:** adaugă frici (preseturi: vorbit în public, respingere, eșec, critică, conflict, evaluare,
  greșeală, necunoscut + liber); pentru fiecare frică: lanțul
  `situație → predicție (text) → emoție+intensitate → senzație → impuls → evitare → consecință pe moment →
  consecință pe termen lung` (umplut o dată, editabil) + **explicarea negative reinforcement** (2–3 rânduri,
  hedging, sursă în `research-sources.md`).
- **Scara curajului:** utilizatorul plasează situații specifice pe 0–10; **prediction tracker** per pas:
  1) predicție: „frica va fi X/10" + „ce cred că se întâmplă" (text); 2) acțiune: „am făcut" /
  „am ales să nu fac (și de ce)" — ambele valide; 3) rezultat: frica a fost Y/10 + ce s-a întâmplat (text);
  4) **evidence card**: sistemul calculează gap-ul și afișează: „Ai prezis X. A fost Y. Asta e învățarea
  nouă: predicția ta a greșit cu |X−Y| puncte." (Craske 2008/2014, etichetat „principiul din literatura
  pe expunere, adaptat; nu e tratament").
- **Limita clinică** (text fix, vizibil la primul pas de ladder): „Pentru fobii sau anxietate care
  interferează cu viața, lucrul cu un psiholog/psihoterapeut e calea. Aceasta e practică, nu tratament."
- **MUZEUL:** artefacte (preseturi: am încercat ceva dificil / am suportat disconfortul / am cerut ajutor /
  am reparat o greșeală / am spus nu / conversație grea / am făcut ceva deși mi-era frică + liber) cu
  etichetă: dată, situație, frica 0–10, ce am făcut. Vizual: raft de muzeu (carduri mici, „obiect" simplu).
- **Dovezi vs. Povestea:** 2 coloane; utilizatorul adaugă perechi (dovezi obiective / povestea mea);
  la 2–3 perechi, sistemul sugerează numele distorsiunii (filtru, citire în gând, predicție,
  catastrofizare, personalizare) ca întrebare: „Aceasta seamănă cu *X*. O mai recunoști altundeva?" —
  fără verdict, fără scor de „cât de impostor ești".

**Acceptanță Faza 3:** 1 ciclu complet de ladder (predict → act → record → gap card corect, inclusiv
gap=0 și cazul „am ales să nu fac"); 1 artefact salvat; 1 pereche dovede/poveste cu sugestia de distorsiune;
textul de limită clinică prezent; test de unitate pentru calculul gap-ului.

### Faza 4 — Camera Mare (modul echipă)

Livrabil: activitate `emotions` în room (reutilizează etapele, host controls, harvest existente).

- `POST /api/rooms` acceptă activitate `emotions` (ca la `coaching`); room state include
  `{ emotions: { situationId, votes: { [playerId]: { emotions: [id], intensity, archetype?, passed } },
    revealed: bool, weatherStart: {...}, weatherEnd: {...}, museum: [{text, at}] } }` —
  voturile sunt **server-authoritative și private până la reveal** (pattern-ul Team Compass).
- Flux facilitator: **BRIEF** (reguli de cameră: privat până la reveal, „Pas" e valid, nimeni nu e obligat
  să explice, confidențialitate) + **Meteo de pornire** (1 tap: 1–3 emoții + intensitate; host pornește)
  → **PLAY** (host alege situația din bibliotecă `mode: "room"`; vot privat; **REVEAL** = agregat anonim:
  bara per emoție + intensități medii + header fix „Aceeași situație. N ceruri diferite.") →
  **DEBRIEF** (prompturile din JSON) → (opțional, host activează) **Muzeul anonim**: 1 rând per persoană,
  opt-in, text anonim, host poate șterge înaintea afișării → **Meteo de final** → **HARVEST** (board-ul
  existent, nefițuit).
- Revealul arată **numere, niciodată nume**; „Pas" apare doar ca „N au ales Pas" (anonymizat, fără identitate).
- `FacilitatorPanel`: butoane pentru activitatea emotions — pauză de cameră, skip situație, schimbare
  situație, dezactivare teme grele, activare muzeu, **cuvânt de siguranță** opțional (setat de host;
  orice participant îl apasă → pauză + ecran cald cu resursele); resursele de criză pe ecranul de pauză.
- `src/puzzle/EmotionsActivity.tsx`: UI-ul de vot (roata compactă + intensitate + arhetip opțional + Pas).
- **Export** (endpoint existent de export extins): raport de meteo al camerei — agregat anonim, JSON +
  vizual printabil (reutilizează fluxul print existent).
- Feature flag în CreateRoom: activitatea „Emoții (Camera Mare)" apare pe listă.

**Acceptanță Faza 4:** protocol tests noi (pattern-ul `scripts/*-protocol-test.mjs`): vot privat nu e
vizibil înainte de reveal; reveal anonim (fără id-uri de player în payload-ul broadcast); „Pas" e valid și
anonymizat; host poate pauză/skip/schimbare; voturile supraviețuiesc reconnect-ului; snapshot de room le
persistă; 2-client browser test dacă runtime Playwright e disponibil, altfel protocol test + notă în QA
report (convenția existentă). `npm run test:protocol` complet verde.

### Faze 5–8 (după testarea cu echipa — nu le rulezi acum)

5 = Atlas final + instrumentele (7) + 3 precizii (granularitate, gap, prezență) + export PDF/JSON personal.
6 = Desen (canvas liber, salvat local PNG) + 8 întrebări + galerie „locuitori" + conversație script 4 runde.
7 = Curtea interioară (8 arhetipuri solo + vot arhetip în Camera Mare). 8 = Polish (a11y, copy, perf, QA gate
după formatul `docs/qa-report.md`).

## Teste și gate final (MVP = fazele 0–4)

1. `npm run typecheck` + `npm run build` — curate.
2. `npm run emotions:audit` (nou) — schema + completitudine + bilingvitate: 0 erori.
3. `npm run test:protocol` — 100% verde, inclusiv testele nouă de emotions room.
4. `docs/emotions/qa-report.md` (format ca `docs/qa-report.md` existent): decizii, comenzi, evidențe,
   limite de mediu declarate.
5. Evidențe de screenshot: `/emotii` (Harta, Meteo, Expediție, Frontiera, Muzeul) desktop + mobil;
   Camera Mare (brief, vot, reveal, harvest) desktop + mobil.

## Definiția de „gata" pentru MVP

Un utilizator poate: deschide `/emotii` → citi 5 carti de emoții → înregistra 3 meteo-uri → face 3 expediții
→ construiește 1 frontiera cu 1 pas completat (cu gap card) → pune 2 artefacte + 1 pereche dovede/poveste.
O echipă poate: crea room `emotions` → brief → meteo de pornire → 2 situații cu reveal anonim →
debrief → muzeu anonim (opțional) → meteo de final → harvest + export — cu toate controalele de siguranță
funcționale. Fără conturi. Fără date părăsind browserul (exceptând snapshot-ul de room, ca restul produsului).

## Ce NU faci

- Fazele 5–8 (vin după testare).
- Niciun cont, niciun tracking, niciun serviciu extern, niciun AI la runtime.
- Niciun claim clinic, niciun „profil psihologic", niciun scor de personalitate.
- Niciun studiu inventat; dacă o sursă nu se poate verifica în sandbox, o marchezi `to-verify` și nu o
  pui în UI ca fapt.
- Nicio modificare a mecanicilor existente de jigsaw/canvas/coaching (doar adăugări + feature flag).
