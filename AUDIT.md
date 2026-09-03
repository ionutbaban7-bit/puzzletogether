# PuzzleTogether — Audit radical de produs

**Data:** 2026-09-03
**Ramură analizată:** `arena/01a06670-puzzletogether` @ `eacd70b`
**Scop:** evaluare sinceră a aplicației ca joc colaborativ **și** ca platformă B2B de team coaching / workshop facilitation / brainstorming.
**Regulă:** acest document este doar analiză + roadmap. Nicio implementare de produs.

---

## Verdict executiv

PuzzleTogether este un **MVP tehnic foarte bun** de jigsaw multiplayer realtime, cu o **vopsea B2B** recentă (landing, Word World, podium, 40 de puzzle-uri) și un **nucleu de coaching incomplet și, pe alocuri, greșit conceput**.

Dacă îl judecăm ca **joc de puzzle colaborativ pentru 2–8 prieteni**, e aproape de un produs plăcut: camere fără cont, sync live, piese jigsaw reale, zoom/pan, podium. Asta e partea bună.

Dacă îl judecăm ca **platformă B2B de workshop / team coaching / facilitare vizuală**, **nu este gata**. Nu e Miro. Nu e FigJam. Nu e Kahoot. Nu e un tool de facilitator. Este un joc de puzzle cu 4 exerciții de coaching lipite deasupra, dintre care ranking-ul — piesa de rezistență a „team coaching”-ului — **nu permite echipei să-și exprime propriul ranking**.

Propoziția care trebuie să rămână pe perete:

> **Astăzi PuzzleTogether vinde „workshop B2B”, dar livrează „jigsaw party cu 4 activități extra”.**

Asta nu e o insultă. E o oportunitate clară: motorul realtime + board-ul infinit + host flow-ul sunt o fundație rară. Lipsește stratul de **facilitare, outcomes și persistence**. Fără el, nu poți factura un L&D lead, un coach independent sau un People Ops manager.

### Scoruri de maturitate (1–10)

| Domeniu | Scor | Comentariu |
| --- | ---: | --- |
| Jigsaw colaborativ (fun) | 7.5 | Motorul e serios. Lipsește claim, grupare, reconnect UX. |
| Realtime engineering | 6.5 | Corect pentru un singur proces. Fragil la scară. |
| Word World ca game mode | 2.5 | Cosmetizare de piese, nu joc de cuvinte. |
| Team coaching | 3.5 | Conținut bun, mecanică de ranking greșită. |
| Facilitare workshop | 2.0 | Nu există lobby, agenda, lock, timer, export. |
| Colaborare tip Miro/FigJam | 1.0 | Zero obiecte de board în afara pieselor. |
| Mobile | 5.0 | Gesturi există; densitate și safe-area nu. |
| B2B / enterprise | 1.5 | Landing B2B, produs consumer. |
| Testing | 5.5 | Sim-testele sunt bune; E2E-ul e depășit. |
| Monetizare / ICP | 2.0 | LICENSE blochează comercialul; nu există pachete. |

---

## 0. Inventar tehnic al repo-ului (ce există, concret)

**Stack:** React 18 + TypeScript + Vite + Tailwind · Node/Express + `ws` · totul într-un singur proces · state in-memory · zero DB · zero auth.

**Dimensiune:** ~6.200 linii de frontend/backend/tests · 40 puzzle-uri · 6 categorii vizuale · 4 activități coaching · 4 dificultăți (25/64/100/144).

**Fișiere-cheie:**

| Zonă | Fișiere |
| --- | --- |
| Backend realtime + REST | `src/server.js` (~997 linii, tot serverul) |
| Store client | `src/store.ts` |
| Board canvas | `src/puzzle/Board.tsx`, `jigsaw.ts`, `useViewport.ts` |
| Coaching UI | `RankingActivity.tsx`, `QuestionnaireActivity.tsx` |
| Pagini | `LandingPage`, `CreateRoom`, `JoinRoom`, `RoomRoute`, `GamePage` |
| Catalog | `shared/puzzles.json`, `shared/coaching.json` |
| Teste | `scripts/sim-test.mjs`, `coaching-test.mjs`, `browser-test.mjs`, `coaching-browser-test.mjs` |

**Catalog real (nu marketing):**

- Word World: 4 puzzle-uri (`agile-words`, `innovation-grid`, `scrabble-anagrams`, `team-motto`)
- Paintings: 10 · Landscapes: 6 · Landmarks: 9 · Nature: 5 · Cities: 6
- Coaching (separat de catalogul vizual): 3 ranking-uri + 1 chestionar

**Ce e deja bine (să nu uităm):**

1. WebSocket pe same-origin, hello/init, heartbeat, reconnect cu backoff.
2. Access code (alfabet fără 0/O/1/I) + link UUID, fără leak al codului pe GET public.
3. Host poate schimba puzzle-ul în aceeași cameră (`POST /puzzle` + broadcast `t:"puzzle"`).
4. Cut jigsaw determinist pe seed de server — toți văd aceleași tabs.
5. Canvas 60fps cu sprite cache, pinch, pan, wheel zoom, ghost slot.
6. Conținut coaching bilingv de calitate (scenarii, rationale expert, 16 profiluri).
7. Podium + scoring pe piese plasate, Level Up, Replay.
8. Cap 20 jucători, TTL 24h, pending seat 60s.
9. Sim-test protocolar serios (access code, lock, completion, cap 20).

Astea sunt **active**. Restul auditului e despre cum le irosim sau le ocolim.

---

## 1. Inventar funcțional complet

Legendă maturitate: **P0-găuri** = strică experiența acum · **MVP** = merge, dar e subțire · **Solid** = poate rămâne · **Premium** = nivel produs plătit.

### 1.1 Onboarding

| Funcționalitate | Stare | Maturitate | Riscuri | Impact utilizatori |
| --- | --- | --- | --- | --- |
| Landing B2B bilingv (RO/EN) | **Există** | MVP polish | Copy-ul promite „workshop suite” pe care produsul nu o livrează. CTA „Creează Cameră B2B” e marketing, nu produs. | Primul 10 secunde arată premium; următoarele 3 minute dezamăgesc un buyer B2B. |
| Toggle limbă | **Parțial** | MVP | Nu persistă (`useState("en")`). Default EN, indiferent de browser. Create/Join aproape numai EN. | Facilitatorul RO trece pe landing în RO, apoi cade în EN pe create. Friction + lipsă de seriozitate. |
| „No account” | **Există** | Solid pentru consumer | Fatal pentru B2B: nu poți avea istoric, SSO, facturare, ownership de sesiune. | Zero friction la joacă. Zero stickiness la business. |
| Display name (max 24) | **Există** | Solid | Fără validare de duplicate, fără avatar, fără rol. | OK pentru party. Insuficient pentru workshop (Facilitator vs Participant). |
| Prefetch catalog pe landing | **Există** | Solid | — | Create se simte mai rapid. |
| Empty/error states la catalog | **Parțial** | MVP | Un singur string EN: „Could not load the puzzle library.” | Fail silențios pe rețea proastă. |
| Onboarding facilitator (ce faci în 5 min) | **Lipsește** | — | Un coach nou nu știe ordinea: lobby → brief → play → debrief → export. | Abandon după prima sesiune. |
| Waiting room / lobby | **Lipsește** | — | Jocul pornește imediat. Timer-ul include timpul de așteptare. Piesele sunt deja împrăștiate. | Workshop-ul începe haotic. „Nu am început încă” nu există. |

### 1.2 Room lifecycle

| Funcționalitate | Stare | Maturitate | Riscuri | Impact |
| --- | --- | --- | --- | --- |
| Create room (nume + categorie + puzzle + dificultate) | **Există** | Solid consumer | Fără nume de sesiune, fără durată, fără agendă, fără rol. Coaching ascunde dificultatea (corect). | Flow scurt. Nu e „creează un workshop”. |
| Join via cod 6 caractere | **Există** | Solid | JoinRoom e EN. Codul e suficient ca proof. | Bun pentru verbal share („codul e K7F2MX”). |
| Join via link UUID + access code | **Există** | Solid | Access gate e bilingv. Share-ul nu include codul în URL (intenționat). | Siguranță OK. Friction: trebuie două lucruri (link + cod). Pentru workshop e corect. Pentru party e un pic greu. |
| Share modal (link, copy, link+cod) | **Parțial** | MVP | **Ascuns pe camerele de coaching** (`!isCoaching` în `GamePage`). Reset/share pentru coaching nu e în HUD. | Facilitatorul de ranking nu poate invita din HUD. Bug de produs, nu de gust. |
| Host = creator | **Există** | MVP | Dacă host-ul pleacă, UI-ul dă putere primului din listă, dar `hostId` se actualizează doar la `changePuzzle`. | Ambiguu cine e facilitatorul. |
| Change puzzle in-room (host) | **Există** | Solid | Orice `knownPlayer` poate schimba dacă host-ul nu e conectat. Nu există confirmare „ești sigur?”. | Putere bună. Lipsă de control de scenă. |
| Reset board | **Există** | MVP **periculos** | `POST /reset` **fără autentificare, fără host check**. Oricine cu room id resetează sesiunea. | Un participant (sau un bot) poate distruge un workshop. |
| Cap 20 jucători | **Există** | Solid | Pending seats consumă cap-ul 60s. | OK. 20 e prea mult pentru ranking (vezi coaching). |
| Expiry 24h inactivitate | **Există** | MVP | Empty room e ștearsă după **60s** fără jucători (`PENDING_TTL_MS`). Refresh lung / tab background = cameră moartă. | „Am ieșit 2 minute, camera a dispărut.” |
| Reconnect same-tab (`sessionStorage`) | **Există** | MVP | Tab nou = jucător nou, decât dacă știi codul. Fără `localStorage`. | Refresh merge. „Am deschis pe al doilea monitor” rupe identitatea. |
| Room name / topic | **Lipsește** | — | Camera e UUID. Facilitatorul nu poate zice „Retro Sprint 24”. | Zero identitate de sesiune. |
| Close room / kick / mute | **Lipsește** | — | Nu există moderare. | Un troll rămâne. Un participant care a plecat rămâne „ghost” până cade WS. |

### 1.3 Puzzle gameplay

| Funcționalitate | Stare | Maturitate | Riscuri | Impact |
| --- | --- | --- | --- | --- |
| Drag piese + snap + lock | **Există** | Solid | Fără ownership. Last-write-wins. Doi jucători trag aceeași piesă. | Haos la 8+ oameni. „Mi-ai furat piesa.” |
| Cut jigsaw seeded | **Există** | **Premium** | — | Unul dintre cele mai bune lucruri din app. Merită păstrat. |
| Zoom / pan / pinch / keyboard | **Există** | Solid | `fit()` rezervă 880px jos pentru scatter — pe telefon board-ul e minuscul. | Desktop bun. Mobile „văd tot, nu pot lucra”. |
| Ghost slot când ești aproape | **Există** | Solid | — | Feedback excelent. |
| Reference image overlay | **Există** | MVP | Pe mobil e la `top:148px`, se ciocnește cu HUD. Toggle-ul e sub acțiuni. | Util, dar overlapping. |
| Progress + timer | **Există** | MVP | Timer-ul = `now - createdAt`. Include lobby + pauze. Nu e pauzabil. | Timpul de „am terminat în 04:12” e mincinos dacă ați așteptat colegi. |
| Completion modal + confetti | **Există** | Solid vizual | Modal `dismissable={false}` — nu poți vedea puzzle-ul terminat fără să închizi prin Replay. | Sărbătoare OK. Nu poți fotografia board-ul. |
| Level Up / Replay / alt puzzle | **Există** | Solid | Doar host-ul. Restul văd „gazda pregătește”. | Bun pentru party. |
| Rotație piese | **Lipsește** (câmp `rotation` e mereu 0) | — | Tipul există, serverul trimite 0. | Expert 144 fără rotație e mai ușor decât un jigsaw real. Nu e musai de adăugat. |
| Group / cluster piese | **Lipsește** | — | Nu poți lipi 2 piese între ele înainte de lock pe board. | La 100+ piese, experiența e inferioară Jigsaw Explorer / Puzzle Together clasic. |
| Claim / lock-while-dragging server-side | **Lipsește** | — | `piece.drag` e un flag, nu un owner. | Race conditions vizibile. |
| Hint / edge pieces filter | **Lipsește** | — | — | Nice-to-have, nu critic. |

### 1.4 Word World

| Funcționalitate | Stare | Maturitate | Riscuri | Impact |
| --- | --- | --- | --- | --- |
| Categorie + 4 cover SVG | **Există** | MVP vizual | Cover-urile sunt fundal de jigsaw, nu un board de cuvinte. | Arată „altfel”. Nu se joacă altfel. |
| Tile-uri cu literă + puncte Scrabble + culoare | **Există** | Cosmetizare | `letterPoints` **nu intră în scor**. Scorul rămâne „piese plasate”. | Jucătorul crede că e Scrabble. Este jigsaw cu stickere. |
| Pool de litere din 12 cuvinte hardcodate | **Există** | Fragil | `buildWordLetters` concatenează cuvintele, repetă pool-ul până umple 25/64/100/144. La Easy 25 piese nu încap cuvintele. La Expert ai litere duplicate fără sens. | Dificultatea jigsaw e lipită pe un joc care nu e jigsaw. |
| Validare cuvinte | **Lipsește** | — | Nu există dicționar, nu există „submit word”. | Nu e un joc de cuvinte. |
| Grid / board de formare | **Lipsește** | — | Snap-ul e pe poziția din imagine, nu pe o grilă lexică. | Nu poți forma MOTTO / TRUST ca echipă. |
| Misiuni, runde, bonus, wildcards | **Lipsește** | — | — | Landing minte când zice „Word World & Brainstorming”. |
| Mod colaborativ vs competitiv | **Lipsește** | — | Există doar podiumul de piese. | Confuzie de gen. |

**Stare reală Word World:** un skin de piese pe motorul de jigsaw. Asta e tot.

### 1.5 Coaching

| Funcționalitate | Stare | Maturitate | Riscuri | Impact |
| --- | --- | --- | --- | --- |
| 3 scenarii ranking (Himalaya, Pacific, Lună) | **Există conținut** | Conținut **premium**, mecanică **greșită** | Vezi bug-ul critic de mai jos. | Conținutul merită vândut. Mecanica îl anulează. |
| Snap items pe sloturi 1–12 | **Există, dar inversat** | **Defect de design** | Itemele se lock-uiesc doar pe slotul lor precalculat (`correctX/Y` = index în JSON). JSON-ul e deja în ordinea expert. Echipa **nu-și poate pune propriul ranking**. | Exercițiul clasic NASA/Lost-at-Sea e invalidat. E un matching puzzle, nu un ranking de echipă. |
| Rank de echipă calculat | **Defect** | — | `teamRanks.set(p.id, p.id + 1)` — rangul = id-ul itemului, nu slotul pe care a fost pus. | Scorul de deviere e tautologic dacă lock = expert slot. |
| Buton „Vezi rankingul experților” oricând | **Există** | Dăunător | Spoilerează exercițiul înainte de debrief. | Un participant curios strică sesiunea. |
| Debrief prompts (5/activitate) | **Există** | Solid conținut | Doar text în modal. Fără capture de răspunsuri, fără vot, fără timer. | Coach-ul trebuie să țină debrief-ul pe Zoom/Miro separat. |
| Reset ranking | **Există** | Periculos | Orice client apelează reset. Itemele lock-uite **nu pot fi reordonate** fără reset total. | Discuția de echipă moare în momentul primului snap. |
| Team Compass 20Q / 4 dim / 16 profiluri | **Există** | Solid pentru un instrument free | Nu e validat psihometric. Nu e DISC/MBTI licențiat — bine (evită risc legal), dar nici nu trebuie vândut ca assessment. Start **nesincronizat**. Restart-ul e local (îți șterge ție rating-ul). | Fun icebreaker. Nu e instrument L&D. |
| Sumar echipă live | **Există** | MVP | Îl vezi abia în ecranul de rezultate. Cine e pe intro nu vede progresul celorlalți. | Facilitatorul nu știe cine a terminat. |
| Lock board / reveal phase | **Lipsește** | — | — | Nu poți zice „stop, discutăm”. |
| Export rezultate | **Lipsește** | — | Totul moare cu procesul Node. | Zero outcomes. Zero follow-up. |
| Share din HUD pe coaching | **Lipsește** | Bug | Vezi 1.2. | Friction la invitarea echipei. |

#### Bug critic — ranking (citit din cod)

În `src/server.js`, la setup ranking:

```js
coachingActivity.items.forEach((_item, i) => {
  // correctX/Y = slotul de index i, NU un slot liber
});
```

La drop, serverul lock-uiește doar dacă distanța până la `correctX/Y` ≤ snapDistance.

În `RankingActivity.tsx`:

```js
ranks.set(p.id, p.id + 1); // slot order = reading order = rank
```

Instrucțiunea UI zice: *„Trageți fiecare obiect pe poziția corespunzătoare rangului (1–12)”* — dar snap-ul forțează rangul **expert**, nu rangul **echipei**.

**Asta e cea mai gravă problemă de produs din tot repo-ul.** Un facilitator profesionist care a mai rulat Lost at Sea / NASA Moon Survival va simți imediat că tool-ul e stricat. Nu e un polish. E un eșec de game design pe use-case-ul pe care îl vinzi.

### 1.6 Gamification

| Funcționalitate | Stare | Maturitate | Riscuri | Impact |
| --- | --- | --- | --- | --- |
| Scor piese plasate per jucător | **Există** | MVP | Credit la drop-ul care lock-uiește. Cine a mutat piesa 90% nu primește nimic. | Injust. Creează competiție unde vrei colaborare. |
| HUD live 🧩 N | **Există** | MVP | Pe coaching e ascuns (bine). | OK în party. |
| Podium top 3 + MVP + clasament | **Există** | Solid vizual | „Collaborative podium” e oxymoron. Celebrează indivizi. | Energizează un icebreaker. Otrăvește un workshop de încredere. |
| Level Up dificultate | **Există** | Solid party | Nu are sens pe Word World / coaching. | Fun. |
| Achievements / badges / streaks | **Lipsește** | — | Nu le adăuga înainte să rezolvi scoring-ul injust. | — |
| Team score vs individual | **Lipsește** | — | — | Pentru B2B vrei team time + quality, nu MVP. |

### 1.7 Collaboration

| Funcționalitate | Stare | Maturitate | Riscuri | Impact |
| --- | --- | --- | --- | --- |
| Cursoare live + name chips | **Există** | Solid | Expiră vizual la 4s. Throttle ~30fps. Nu se văd pe questionnaire (nu e board). | Magia „suntem împreună”. |
| Chat | **Lipsește** | — | Remote fără Zoom = mut. | Deal-breaker workshop remote. |
| Sticky notes / text / săgeți | **Lipsește** | — | — | Nu e spațiu de lucru, e un joc. |
| Reactions / vote dots | **Lipsește** | — | — | — |
| Follow facilitator camera | **Lipsește** | — | Fiecare are viewport propriu. | „Uitați-vă aici” nu există. |
| Presence reală (idle, typing, dragging X) | **Parțial** | MVP | `drag` e pe piesă, nu „Ionut trage piesa 12”. | Nu știi cine ține ce. |
| Private notes | **Lipsește** | — | — | — |

### 1.8 Mobile

| Funcționalitate | Stare | Maturitate | Riscuri | Impact |
| --- | --- | --- | --- | --- |
| Pointer events + pinch + touch hit-margin 20px | **Există** | Solid bază | Hit-test e pe rect, nu pe path-ul jigsaw. | Degetul prinde piesa, dar și piesa de lângă. |
| HUD colapsat sub 640px | **Există** | MVP | Ranking are **panel 340px fixed right** + HUD left + zoom bottom. Pe iPhone e acoperit tot board-ul. | Ranking pe telefon e aproape de nefolosit. |
| `user-scalable=no` în `index.html` | **Există (dăunător)** | Anti-a11y | Blochează pinch nativ al paginii. Board-ul își face pinch-ul lui, dar Create/Join/Questionnaire nu au zoom de accesibilitate. | WCAG fail. Enterprise fail. |
| Safe area (notch, home indicator) | **Lipsește** | — | Zoom controls `bottom-4` pot intra sub home bar. | iPhone 14+ tăiat. |
| Thumb reach | **Parțial** | — | Acțiuni top-right (Share/Leave/New) sunt greu de atins. | Leave accidental e greu; Share e greu intenționat. |
| Landscape lock / orientation | **Lipsește** | — | — | Ranking landscape ar ajuta și nu e ghidat. |
| PWA / add to home | **Lipsește** | — | — | — |

### 1.9 Technical architecture

| Funcționalitate | Stare | Maturitate | Riscuri | Impact |
| --- | --- | --- | --- | --- |
| Single Node process, in-memory `Map` | **Există** | MVP | Restart = toate camerele mor. 2 instance = 2 lumi. | Nu poți face HA, nu poți face deploy fără downtime de sesiuni. |
| REST: health, puzzles, rooms CRUD, join, puzzle, reset | **Există** | Solid mic | Reset/puzzle fără auth real (puzzle cere `pid` cunoscut). | Suficient pentru demo. |
| WS protocol: hello, piece, cursor, rating, ping | **Există** | Solid mic | Nu e versionat. Nu există event log. | Extensia la sticky notes cere redesenarea protocolului. |
| Reconnect 15 încercări, backoff max 8s | **Există** | MVP | După 15, tace. `connected` în store **nu e afișat în HUD**. | User crede că mută piese; serverul nu mai ascultă. |
| Observability | **Lipsește** | — | `console.log` la start. Fără metrics, fără request id, fără WS error rates. | Nu știi de ce „n-a mers workshop-ul de ieri”. |
| Analytics hooks | **Lipsește** | — | Zero. | Nu poți învăța ce puzzle-uri se joacă, unde se abandonează. |
| Roles / moderation | **Parțial** | hostId only | — | — |
| Extensibility obiecte board | **Lipsește** | — | Modelul e `pieces[]` cu x/y/locked. Sticky notes nu încap natural. | Big bet de arhitectură. |

### 1.10 Testing

| Funcționalitate | Stare | Maturitate | Riscuri | Impact |
| --- | --- | --- | --- | --- |
| `sim-test.mjs` protocol | **Există** | Solid | Nu acoperă Word World, change-puzzle, reconnect, reset auth, ranking logic. | Prinde regresii de sync. |
| `coaching-test.mjs` | **Există** | Solid parțial | **Nu verifică** că ranking-ul e liber vs expert. Testează snap-ul pe `correctX` — deci **blindează bug-ul**. | False confidence. |
| `browser-test.mjs` | **Există, stricat** | — | Caută textul vechi *„Solve beautiful puzzles”* și *„Create a Room”*. Landing-ul actual zice altceva. | CI roșu sau test sărit. |
| `coaching-browser-test.mjs` | **Există, fragil** | — | Caută *coachinghub* pe landing (badge-ul nu mai e folosit). Caută *„Vezi clasamentul expertului”* dar butonul e *„Vezi rankingul experților”*. | E2E mincinos. |
| Unit tests (jigsaw, ranking score, i18n) | **Lipsește** | — | — | Bug-ul `p.id+1` n-ar fi trăit. |
| Load test 20 clienți / 144 piese | **Lipsește** | — | — | Nu știi dacă 20×144×20msg/s ține. |

---

## 2. Gap analysis radical

Fără menajamente.

### 2.1 Ce pare încă MVP

**Aproape tot ce nu e canvas-ul de jigsaw.**

- Un singur fișier de server de 1000 de linii ține camere, scoring, coaching, housekeeping.
- State-ul e un `let state` global + `useSyncExternalStore`. Merge. Nu e un store cu undo, presence, CRDT.
- i18n e un context de 60 de linii, aplicat inegal.
- „B2B landing” e o pagină. Nu e un produs B2B.
- Word World e 40 de linii de paletă + litere în `server.js`.
- Podium-ul e un modal frumos peste același eveniment `completion`.
- Session = 3 chei în `sessionStorage`.
- Testele E2E n-au fost actualizate după redesign. Semn clasic de MVP care aleargă înaintea igienei.

Un reviewer senior zice: *„Frumos demo. Nu aș pune 12 oameni dintr-o bancă pe el luni dimineață.”*

### 2.2 Ce nu e B2B-ready

B2B-ready înseamnă că un buyer (L&D, People Ops, coach plătit) poate:

1. Crea un spațiu al organizației
2. Programa o sesiune
3. Invită cu control
4. Rula un flux cu roluri
5. Ieși cu artefacte
6. Plăti și reveni

PuzzleTogether are **0 din 6**.

| Cerință B2B | Realitate |
| --- | --- |
| Conturi / org / SSO | Nu |
| Admin de workspace | Nu |
| Istoric sesiuni | Nu (RAM, 60s empty reap) |
| Template de workshop | Nu |
| SLA, uptime, multi-instance | Nu (un proces) |
| GDPR: export, delete, DPA | Nu |
| Audit log | Nu |
| Facturare, planuri, seats | Nu |
| LICENSE comercial | **Interzis fără permisiune scrisă** — ironic pentru un landing „B2B” |
| Branding white-label | Nu |
| Privacy: cine vede ce | Ratings-urile chestionarului sunt broadcast la toată camera, inclusiv răspunsurile item-by-item | 

Landing-ul zice „Professional facilitation suite”. Un procurement officer care deschide Network tab-ul vede un Node gol. Deal mort.

### 2.3 Ce nu e workshop-ready

Un workshop are **timp, scenă, rol, artefact**.

Azi:

- Nu există **Start**. Camera = jocul a început.
- Nu există **etape** (brief → individual → team → reveal → debrief).
- Nu există **timer de facilitator** (countdown 5:00 pentru discuție).
- Nu există **lock board**.
- Nu există **parking lot** / **action items**.
- Nu există **export PDF/CSV**.
- Debrief-ul e 5 întrebări statice. Răspunsurile se pierd în aer (sau în Zoom).
- Ranking-ul nu e ranking.
- Share-ul e ascuns pe coaching.
- Timer-ul de joc include așteptarea.

Un facilitator care a lucrat în SessionLab / Miro / Mentimeter se întoarce în 10 minute.

### 2.4 Ce nu e Miro / FigJam-like

Miro/FigJam sunt **infinite canvas + obiecte + multiplayer + templates**.

PuzzleTogether e **infinite camera + un singur tip de obiect (piesa) + lock la snap**.

Lipsește tot stratul de obiecte: sticky, text, forme, conectori, frame-uri, vot, cursor follow, comments, pages, timer, voting session, private mode, outline.

Nu e o diferență de polish. E o diferență de **ontologie**. Board-ul nu știe decât `Piece`.

**Nu încercați să deveniți Miro.** O să pierdeți. Deveniți „Miro nu poate face asta”: un **joc care se transformă în artefact de echipă**. Asta e fereastra.

### 2.5 Ce nu e bun pentru echipe reale de 3–20

| Mărime | Ce se întâmplă azi | Ce ar trebui |
| --- | --- | --- |
| 2–4 | Jigsaw-ul e plăcut. Ranking-ul e stricat, dar 4 oameni se descurcă vocal. | Sweet spot actual. |
| 5–8 | Cursoarele se aglomerează. Claim lipsă = conflicte pe piese. Ranking cu 8 pe același board e haos (toți trag aceleași 12 carduri). | Jigsaw OK cu claim. Ranking: un board, 12 carduri, **un singur set** — 8 e deja mult; trebuie roluri (scribe vs voices) sau breakouts. |
| 9–20 | Cap-ul tehnic ține. Experiența nu. 20 de cursoare, 144 piese, last-write-wins = război. Questionnaire merge (e individual). Ranking e catastrofă. | 20 are sens la icebreaker jigsaw Easy 25 (haos vesel) sau la Compass. Nu la ranking, nu la Word World serios. |

**Recomandare dură de product:** nu vindeți „up to 20” ca workshop. Vindeți **3–8 pentru coaching, 4–12 pentru jigsaw party, 8–20 doar pentru Compass / icebreaker**. Cap-ul tehnic 20 e un plafon, nu o promisiune pedagogică.

### 2.6 Ce nu e bun pentru facilitatori profesioniști

Un facilitator bun vrea:

1. Să vadă cine e în sală și cine e pe telefon
2. Să țină agenda pe ecran
3. Să blocheze board-ul când vorbește
4. Să dea 3 minute și să se audă un gong
5. Să nu lase participanții să vadă răspunsul expert înainte de vreme
6. Să scoată un PDF cu ranking-ul echipei, Δ vs expert, debrief notes, action items
7. Să nu depindă de faptul că nimeni nu apasă Reset
8. Să poată rula aceeași sesiune mâine cu alt grup, dintr-un template

Azi: are un picker de puzzle și un modal cu 5 întrebări. Atât.

**„See expert ranking” disponibil din prima secundă** e ceva ce un facilitator ar considera neglijență pedagogică.

---

## 3. Analiză colaborare tip Miro / FigJam

### 3.1 Principiu de produs (înainte de feature list)

Nu construiți un clone Miro. Veți arăta săraci.

Construiți **trei straturi pe același canvas**:

1. **Play layer** — piese / tile-uri / carduri de activitate (există)
2. **Talk layer** — sticky, vot, cluster, parking lot (nu există)
3. **Harvest layer** — insights, agreements, actions, export (nu există)

Jocul aduce energia. Talk layer-ul face sensemaking. Harvest-ul vinde contractul de coaching.

### 3.2 Evaluare item-cu-item

| Idee | Verdict | De ce | Prioritate |
| --- | --- | --- | --- |
| **Sticky notes / post-its** | **MUST-HAVE** (Faza 2, nu 1) | Fără ele nu există brainstorm, retro, debrief capturat. Dar dacă le bagi înainte să repari ranking + facilitator basics, devii un Miro prost. | P1 (după P0-urile de joc/facilitare) |
| **Text boxes** | Nice-to-have | Titluri de zonă. Frame-urile le acoperă parțial. | P2 |
| **Freeform notes** | Overkill acum | E sticky + text. Nu e nevoie de un al treilea tip. | P3 |
| **Board annotations** (pen) | **Riscant / overkill** | Drawing realtime e un proiect separat (ink, pressure, sync). Facilitatorii vor obiecte, nu whiteboard de școală. | P3, nu înainte de persistence |
| **Arrows / connectors** | Nice-to-have | Util la clustering („cauză → efect”). Scump de făcut bine (routing, attach points). | P2 |
| **Frames / workshop zones** | **MUST-HAVE** conceptual | „Zona de joc / zona de debrief / parking lot” e nativ în facilitare. Poate începe ca **preset de layout**, nu ca editor liber. | P1 ca template, P2 ca editor |
| **Private notes vs public** | **MUST-HAVE** pentru coaching serios | Silent brainstorm. Compass e deja semi-privat (vezi propriul profil), dar answers se broadcast-uiesc brute. | P1 pe questionnaire, P2 pe stickies |
| **Vote dots / prioritization** | **MUST-HAVE** Faza 2 | Dot-voting e limba facilitatorilor. 3 voturi / persoană pe stickies. | P1 |
| **Clustering de idei** | Nice-to-have apoi must | Poate începe manual (trage stickies). Auto-cluster e ML, nu vă trebuie. | P2 manual, P3 auto |
| **Parking lot** | **MUST-HAVE** ușor | Un frame predefinit „Parking lot”. Nu e o feature, e un template. | P1 (template) |
| **Action items** | **MUST-HAVE** Faza 2 | Fără owner + due date nu există follow-up. Asta facturează coach-ul. | P1 |
| **Retrospective boards** | Strategic | Start/Stop/Continue, 4Ls, Mad/Sad/Glad ca **template pe play+talk layers**. Nu ca produs separat. | P2 |
| **Brainstorming canvases** | Strategic | Word World *ar trebui* să fie asta, nu un jigsaw de litere. | P1 pe Word World redesenat |
| **Insights board după joc** | **MUST-HAVE** | Tranziție automată: joc terminat → board cu 3 coloane (Ce-am observat / Ce-am învățat / Ce facem). | P1 |
| **Facilitator notes panel** | **MUST-HAVE** | Notes private ale coach-ului, invizibile echipei. Fără asta, coach-ul ține notițe în Notion. | P1 |

### 3.3 Ce merită, ce nu

**Merită (în ordine):**
1. Insights board post-joc (template, nu editor)
2. Action items + export
3. Facilitator notes private
4. Vote dots pe obiecte
5. Sticky notes publice (apoi private mode)
6. Frames ca template (parking lot, debrief)

**Nu merită în următoarele 6 luni:**
- Pen/ink
- Mind maps
- Auto-cluster
- Video embedded
- Infinite pages
- Plugin ecosystem
- „Como Miro dar mai simplu” ca mesaj de marketing

**Riscul mare:** un fondator îndrăgostit de FigJam va arde 4 luni pe sticky notes și va livra un board gol, fără să fi reparat ranking-ul. **Nu faceți asta.** Sticky notes fără facilitator flow = jucărie.

---

## 4. Analiză specială Word World

### 4.1 Actual vs ideal

**Actual (din `server.js` + `Board.tsx`):**

- Categoria `words` are 4 iteme.
- La `buildPuzzleSetup`, dacă `puzzle.category === "words"`, fiecare piesă primește `letter`, `letterPoints` (Scrabble EN), `letterColor`.
- Literele = concatenarea a 12 cuvinte hardcodate, uppercase, fără spații, repetate până umplu N piese.
- Render: rounded rect, literă albă, badge cu puncte. **Nu se formează cuvinte.**
- Gameplay = același jigsaw: trage piesa pe `correctX/Y` din grila imaginii de 1200×800.
- Scor = piese lock-uite, nu suma punctelor, nu cuvinte.
- Completion = toate tile-urile pe locurile din cover.

Este un **jigsaw tematic**, nu Word World.

**Ideal (ce ar trebui să fie ca să merite numele):**

Un **sandbox de litere pe grilă**, în care echipa **construiește cuvinte împreună**, cu obiective de coaching, nu de asamblare a unei imagini.

### 4.2 Spec recomandată (ideal state)

| Element | Propunere concretă |
| --- | --- |
| Board | Grilă 15×15 (sau 11×11 Easy) goală, nu cover image. Zone bonus vizibile. |
| Rack comun | 7–12 tile-uri într-un pool vizibil tuturor (colaborativ) SAU rack privat (competitiv). |
| Word validation | Dicționar EN + RO (word list static, nu API). Submit evidențiază cuvântul, îl lock-uiește, scorul se adaugă. |
| Submit mechanics | Un jucător trage litere adiacente (H/V), apasă **Submit word**. Serverul validează, respinge cu motiv (not a word / not connected / overlapping). |
| Scoring | Scrabble classic (letter × bonus) + **team pot** default. Podium individual doar în mod competitiv. |
| Bonus tiles | 2×L, 3×L, 2×W, 3×W pe grilă. Asta face punctele din badge **reale**. |
| Wildcard | 1–2 blank tiles / rundă. Esențial pentru motto-uri de echipă. |
| Objectives / missions | Fiecare din cele 4 puzzle-uri devine **mod**, nu cover: |
| | `agile-words` — construiți 8 valori agile în 10 min |
| | `innovation-grid` — 5 idei de 1 cuvânt + 1 frază |
| | `scrabble-anagrams` — scor maxim colaborativ în 8 min |
| | `team-motto` — 1 motto de 2–5 cuvinte + 3 valori, apoi vot |
| Timed rounds | Timer de facilitator, nu timer de cameră. 3 runde × 4 min. |
| Collaborative vs competitive | Default **team pot**. Toggle host: *hot-seat* (unul mută, restul vorbesc) sau *free-for-all*. Competitiv e opt-in, nu default. |
| Coaching use cases | Values alignment, motto, naming, retro „un cuvânt despre sprint”, icebreaker de limbaj comun. |
| Team size | **3–5** (landing-ul deja zice asta — e singura frază onestă despre Word World). 6+ = breakout sau hot-seat. |
| Replayability | Seed de bag diferit, misiuni, dicționar, runde. Azi replay = același jigsaw. |

### 4.3 Word validation — detalii care contează

- Nu folosiți un API extern (latență, ToS, offline workshops).
- Începeți cu un wordlist de ~20k EN + 20k RO, plus un **lexicon de sesiune** (host-ul poate adăuga „OKR”, „NPS”).
- Cuvintele din cele 12 prompturi trebuie să fie **mereu valide** (whitelist).
- Feedback: tile-urile se scutură + toast „not a word”, nu fail silențios.

### 4.4 Ce NU faceți

- Nu replicați Scrabble legal (trademark). Spuneți **„letter grid” / „team words”**, nu „Scrabble”. `scrabble-anagrams` trebuie redenumit.
- Nu lăsați dificultatea 25/64/100/144 pe Word World. Dificultatea e **mărimea grilei + mărimea bag-ului + durata**, nu numărul de piese jigsaw.
- Nu adăugați chat GPT care „validează creativitatea”. E un gimmick și un risc.

### 4.5 Verdict Word World

Fără redesenare, **ștergeți-l din landing-ul B2B**. E o minciună de produs. Cu redesenare (Faza 2–3), poate deveni **diferențiatorul** față de Kahoot (prea quiz) și Miro (prea gol): *„echipa construiește literalmente un vocabular comun”*.

---

## 5. Facilitator / coaching expert review

### 5.1 Ce lipsește pentru workshop-uri reale

Un workshop de 60 min arată așa:

| Min | Scenă | PuzzleTogether azi |
| --- | --- | --- |
| 0–5 | Lobby, check-in, nume | Jocul deja rulează, timer-ul deja curge |
| 5–10 | Brief, reguli, roluri | Panel de scenariu, dar expertul e un click distanță |
| 10–25 | Activitate (ranking / words / puzzle) | Ranking-ul e matching puzzle |
| 25–35 | Reveal | Nu există. Rezultatele sar singure. |
| 35–50 | Debrief | 5 întrebări, zero capture |
| 50–60 | Agreements + actions + close | Nu există |

### 5.2 Facilitator mode — cum ar trebui să arate

**Un al doilea HUD, doar pentru host**, nu o aplicație separată.

**Facilitator dashboard (coloană dreapta, 320px, colapsabilă):**

1. **Agenda** — lista de scene, scena curentă evidențiată
2. **Start / Pause / Next scene**
3. **Timer** — set 1/3/5/10 min, vizibil de toți, sunet la 0
4. **Board lock** — nimeni nu mai mută; cursoarele rămân
5. **Reveal** — arată ranking expert / profiluri / scoruri
6. **People** — cine e in, cine e idle, cine n-a votat, kick
7. **Notes** — textarea privat, persistat în room
8. **Harvest** — 1-click „deschide insights board”
9. **Export** — PDF/JSON

Participanții văd: scenă + timer + board. Nu văd notele, nu văd expertul, nu văd butonul Reset.

### 5.3 Agenda / stage flow — propunere concretă pentru ranking

Scene hardcodate (v1, nu un editor):

1. **Lobby** — piesele invizibile sau freeze, share code mare, „waiting for 5/6”
2. **Brief** — scenariul full screen, host apasă „Am înțeles”
3. **Silent rank** (opțional, 3 min) — fiecare își notează privat (nu pe board)
4. **Team rank** — board deblocat, cardurile se pun **liber** pe sloturile 1–12, **se pot muta până la lock de facilitator**
5. **Freeze** — host lock
6. **Reveal expert** — animație Δ
7. **Debrief** — prompts + capture
8. **Harvest** — 3 agreements + 3 actions
9. **Close** — export + optional icebreaker puzzle

Asta e diferența dintre un joc și un workshop.

### 5.4 Cum capturăm concluzii

Minim viabil (nu Miro):

- După reveal, 5 prompturi. Sub fiecare, **un sticky comun** (unul, nu 50) pe care echipa îl editează.
- Host poate „pin” un citat.
- La Harvest: template **Keep / Change / Try** sau **Stop / Start / Continue**.
- Action item: text + owner (din lista de players) + dată opțională.

### 5.5 Din joc în rezultate concrete

Regula: **niciun joc nu se închide fără 3 artefacte**:

1. Scor/outcome (Δ ranking, profiluri, cuvinte construite, timp)
2. 3 insights
3. 3 action items cu owner

Dacă nu poți exporta astea, nu e coaching. E petrecere.

### 5.6 Export

v1 (o zi de lucru după data model):

- **JSON** brut (room, players, ranking, ratings, notes, actions)
- **PDF de 2 pagini**: copertă (dată, echipă, activitate) + rezultate + actions
- Copy „paste in Slack/Notion”

v2: Google Doc, CSV, email magic link (cere persistare).

### 5.7 Debrief mai puternic

- Prompturile actuale sunt bune. Păstrați-le.
- Adăugați: **1 prompt obligatoriu de acțiune** („Ce facem marțea viitoare?”).
- Adăugați: **round-robin digital** — host alege cine vorbește (spotlight name).
- Nu forțați scrisul în timpul vorbitului. Buton „scribe mode”: un participant e scribul, restul vorbesc.

### 5.8 Sensemaking + follow-up

- Mail/link de recap (cere identitate — conflict cu „no account”). Soluție: **magic link pe email opțional la export**, fără cont.
- Template „30 days later”: aceleași 3 actions, status.
- Asta e Faza 3. Nu acum.

### 5.9 Funcții cerute — verdict

| Funcție | Verdict | Notă |
| --- | --- | --- |
| Facilitator dashboard | MUST P0/P1 | Fără el nu vindeți coaching. |
| Lock/unlock board | MUST P0 | Un singur mesaj WS `t:"lock"`. |
| Reveal phase | MUST P0 | Expert ranking hidden until reveal. |
| Timer | MUST P1 | Client+server, host-controlled. |
| Stage transitions | MUST P1 | Enum pe room: lobby/brief/play/reveal/debrief/harvest. |
| Debrief prompts | Există, trebuie **gated** pe scenă | Nu în același modal cu scorul, nu înainte de reveal. |
| Team agreements | MUST P1 | 3 sloturi. |
| Action tracker | MUST P1 | Mini-tabel, nu Jira. |
| Downloadable session summary | MUST P1 | PDF prost > zero. |

---

## 6. UX/UI & mobile audit

### 6.1 Landing

**Ce e bun:** contrast, grid, badge B2B, 3 module, stats 40/6/RT, CTA dublu, bilingv.

**Ce e slab:**

- Promisiune > livrare. „Workshop Modules / Professional facilitation suite” pe un joc fără facilitator mode.
- Nu există screenshot real de produs (board, ranking, podium). Un buyer B2B vrea să vadă UI-ul de sesiune.
- Nu există social proof, preț, „used by”, durată medie, sau „cum merge în 60 de secunde”.
- Footer-ul e o linie. Lipsesc Privacy, Terms, Contact — **deal-breaker enterprise**.
- `CoachingHubBadge` există în `ui.tsx` și nu e folosit. Landing-ul vechi a fost înlocuit, artefactele au rămas.
- Fonturile Google se încarcă din rețea — workshop-uri corporate cu CSP strict pot arăta urât.

**Mobile landing:** hero `text-5xl` pe ecran mic e acceptabil; grid-ul de stats 3 coloane pe 320px e înghesuit. CTA-urile sunt full-width — bine.

### 6.2 Create room

**Ce e bun:** stepper 2 pași, sticky bar de confirmare, carduri cu preview, coaching separat cu badge New, dificultate ascunsă pe coaching.

**Ce e slab:**

- **Almost entirely English** pe un produs bilingv. Șoc de limbă după landing RO.
- Nu există preview al duratei estimate pentru jigsaw (Easy ~10 min, Expert ~45).
- Nu există „pentru câte persoane e potrivit”.
- Word World arată ca un puzzle vizual (cover SVG), fără explicație că (chipurile) e alt gen.
- Numele se cere **înainte** de ales activitatea. Pentru un facilitator, e invers: întâi sesiunea, apoi „cum te cheamă”.
- Fără opțiune „eu sunt facilitatorul, nu joc”. Host-ul e jucător obligatoriu — în ranking, al 8-lea cursor e al coach-ului care n-ar trebui să mute carduri.

### 6.3 Join room

**Ce e bun:** paste link sau cod, access code condiționat, erori clare pe `bad_code` / `room_missing`.

**Ce e slab:**

- EN only.
- Nu arată **ce** se joacă înainte de join (GET public are puzzle name, UI nu-l folosește).
- Nu există preview „Maria, Ionut deja înăuntru”.
- `needsCode` detectează UUID prin `includes("-")` — funcționează, e fragil.

### 6.4 In-game HUD

**Ce e bun:** colaps pe mobil, progress, lista de jucători cu scor, clock, host-only new puzzle.

**Ce e slab:**

- **Nu există banner de reconnect** deși `connected` e în store.
- Share **ascuns pe coaching**.
- Leave e un icon 🚪 lângă Share — pe mobil, tap greșit iese din workshop.
- HUD 290px peste board. Pe ranking, **al doilea panel 340px dreapta** = 630px de UI pe un ecran de 390.
- Clock mincinos (include lobby).
- „In this room” + încă o linie „N / 20 players” = duplicat.
- Ranking: HUD-ul din GamePage încă se randerează **peste** RankingActivity (top bar), plus side panel-ul intern. Două surse de adevăr.

### 6.5 Ranking activity

**Ce e bun:** scenariu lizibil, progress, zoom, cursoare, results cu Δ și rationale.

**Ce e slab (în afară de bug-ul de mecanică):**

- Board 1400×~900. Pe telefon, `fit` îl face necitibil.
- Carduri 460×110 — text OK pe desktop, tap target bun, dar drag pe touch e greu când cardul umple ecranul scalat.
- Expert button mereu vizibil = spoil.
- Reset ↺ lângă CTA principal = reset accidental.
- `dragPos` e **singleton la nivel de modul** — miros de bug la remount.
- Auto-open results după 900ms când `allPlaced` — pe mecanica actuală, „all placed” = „ați ghicit expert ranking-ul”. Pe mecanica corectă, auto-open ar strica freeze-ul facilitatorului.

### 6.6 Questionnaire

**Ce e bun:** intro cu 4 dimensiuni, 1 întrebare pe ecran, progress, profil narativ bogat, team summary.

**Ce e slab:**

- Start individual, nu „host started”.
- Agree/Disagree dezvăluie **numele polului** sub buton (`Practical — you trust facts…`). Asta **sesizează** chestionarul. Un assessment serios nu-ți arată ce dimensiune măsoară item-ul.
- Back există, dar schimbarea unui răspuns anterior nu e evidentă.
- Restart nu e host-gated. Maria își restart-uiește, Ionut rămâne pe results.
- Lipsă „waiting for others” pe intro.
- Profile codes (IPLS etc.) sunt cute, dar fără legendă pentru echipă.
- Nu e debrief de echipă (doar listă de profiluri). Un coach vrea: „avem 5 Comandanți și 0 Mentori — ce înseamnă?”

### 6.7 Completion modal

**Ce e bun:** confetti, podium vizual, full ranking, Replay/Level Up/Picker, wait-for-host pentru non-host.

**Ce e slab:**

- Prea înalt (`max-h-[92vh]` + tabel) pe laptop 768px — scroll în modal de sărbătoare.
- Celebrează indivizi. Pentru coaching, greșit.
- Nu poți închide ca să vezi puzzle-ul asamblat.
- Butoanele podium sunt `<button>` fără acțiune.
- Copy „Collaborative podium” + „MVP 👑” = mesaj dublu.

### 6.8 Share flow

**Ce e bun:** code mare tracking-wide, copy link, copy link+code, explicație că trebuie ambele.

**Ce e slab:**

- Nu e pe coaching HUD.
- Nu există QR code (workshop in-room: proiectezi QR pe ecran).
- Invite URL nu conține hint de cod (corect pentru securitate), dar lipsește **un slide de proiecție** „intrați cu K7F2MX”.
- Copied state zice „Copiat” și pe butonul principal **înainte** de copy (label-ul e mereu Copied/Copiat + check opțional) — nitpick, dar arată grăbit.

### 6.9 Picker flow

**Ce e bun:** in-room, toată lumea rămâne, categorii, coaching cards, start for everyone.

**Ce e slab:**

- Nu avertizează „se pierde progresul curent”.
- Nu e filtrat „recommended for N players”.
- EN/RO mix (titluri de categorie din JSON sunt EN).

### 6.10 Word World flow

Nu există flow separat. E Board-ul normal cu piese colorate. Utilizatorul nu primește misiune, nu știe că punctele nu contează, nu are submit. **Discoverability: zero.** Landing-ul promite, picker-ul tace, board-ul minte vizual.

### 6.11 Heuristici transversale

| Heuristică | Notă |
| --- | --- |
| Mobile-first | Nu. Mobile-adapted. HUD collapse e singurul gest real. |
| Thumb reach | Acțiuni critice sus-dreapta. Zoom jos-stânga (bun). Reset view jos-centru (OK). |
| Responsive | Breakpoints sm/lg folosite. Ranking și podium nu au layout telefon dedicat. |
| Safe areas | Zero `env(safe-area-inset-*)`. |
| Density | Desktop HUD e OK. Ranking e dens. Podium e aerisit până la greață (760px). |
| Readability | Inter/Sora, contrast bun pe dark. Create e light, Game e dark — OK. Card ranking text 15px bun. |
| Empty states | Picker: „Pick a category”. Create fără catalog: spinner. Fără „0 players waiting”. |
| Friction | Access code e friction bun. Lipsa lobby-ului e friction rău. i18n rupt e friction. |
| Discoverability | Host tools invizibile pentru non-host (OK). Word World fără tutorial. Expert ranking prea discoverable. |
| Facilitator clarity | Nu există. Host-ul arată ca un jucător cu un buton în plus. |
| Perceived polish | Landing 8/10. Board jigsaw 8/10. Create 6/10. Ranking 5/10. Word World 3/10. B2B substance 2/10. |

---

## 7. Realtime / multiplayer / engineering audit

### 7.1 Modelul WebSocket

Protocol ad-hoc, câmp `t` ca discriminator. Same-origin, `maxPayload` 64kb. Cursor relay pe interval 33ms per room. Piece-urile se broadcast imediat.

**Ce e bine:** simplu, debuggable, sim-testabil, fără Redis pentru demo.

**Ce e rău:**

- Protocol **never versionat**. Un client vechi + server nou = fail silențios (`default: break` în store).
- Nu există ack / seq no. Un drop de frame = piesă desincronizată până la următorul move.
- Broadcast-ul de `pieces` e „listă de 1”. Nu e delta-compressed, dar e OK la 144.
- `hello` e singurul auth. `playerId` e UUID ținut în `sessionStorage`. Cine are pid-ul e jucătorul. Nu e furt greu dacă cineva citește storage, dar e OK pentru party.

### 7.2 Conflict handling / ownership

**Nu există.** Serverul aplică ultimul `piece` pe un id nelocked. Două `drag:true` concurrent = piesa sare între clienți.

`drag` e un boolean, nu `{by: playerId}`. Clientul local mută optimist. Celălalt client primește poziții 50ms.

**Fix minim (P0):** `piece.heldBy`. Dacă e ținut de altcineva, reject + echo. Timeout 8s dacă nu vine drop. UI: outline în culoarea owner-ului + „Maria ține piesa”.

Fără asta, 8+ jucători pe Expert e un bug raportat, nu o feature.

### 7.3 Race conditions cunoscute

1. Doi drop-uri aproape de snap: ambele pot trece `!locked` înainte ca lock-ul să se aplice — în Node e single-thread, deci **pe server e serial**. OK. Pe client, optimistic lock poate diverga până la echo.
2. `applyLocalDrop` vs broadcast: sender-ul nu e exclus din broadcast (`broadcast` fără except pe drop). Sender primește propria piesă înapoi. De obicei OK.
3. Host leave + doi jucători apasă „new puzzle”: `hostPresent` e fals, amândoi trec, ultimul câștigă. Rar.
4. `pending` expire 60s: join HTTP reușit, WS întârziat (rețea mobilă) → deny „Session lost”.
5. Empty room reap 60s: toți au dat refresh simultan → cameră ștearsă.
6. Completion check ignoră coaching — bine. Dar ranking `allPlaced` e client-side.

### 7.4 Reconnect UX

`RoomSocket` reconectează. `onStatus(false)` setează `connected:false`. **Niciun UI nu citește `connected` în GamePage.** Utilizatorul mută piese local (`piecesRef` se actualizează), `send()` tace dacă WS nu e OPEN, la reconnect `init` **suprascrie** piesele — mutările din offline se pierd.

**Fix:** banner „Reconnecting…”, freeze input, la `init` reconciliere.

După 15 încercări, rămâne `status:"joined"` cu `connected:false`. Zombie.

### 7.5 Persistence / session recovery

RAM only. Process restart = genocid de camere. Fără snapshot. Fără replay log.

Empty-room 60s e agresiv pentru un facilitator care „iau o pauză de cafea”.

**Minim Faza 3:** snapshot JSON pe disk la fiecare lock/rating/stage change. Restore la boot. TTL 24h rămâne.

**Nu începeți cu Postgres** până nu aveți un buyer. File snapshot e suficient pentru 100 de camere.

### 7.6 Scaling

Un proces, un Map. Cursor timer per room. 50 de camere × 10 jucători × 30 cursor msg/s = 15k msg/s — Node poate, rețeaua poate, dar **nu poți avea 2 servere**.

Sticky WS + Redis pub/sub e Faza 3. Nu acum. **Nu replicați premature.** Optimizați un singur box (cap conexiuni, backpressure).

144 piese × 20 jucători × drag 20 msg/s = 400 msg/s/cameră. OK.

Canvas 144 sprites e OK (cache). Word World 144 rounded rects e OK.

### 7.7 Event logs / analytics

Zero. Nu știți:

- cât durează Easy vs Expert
- drop-off la access gate
- dacă ranking-ul e abandonat
- câte camere au 1 jucător (solo)

**P0 de o oră:** `console.info` JSON pe evenimente `room_create`, `join`, `complete`, `rating_done`. Redirect către stdout, cules de orice host. Nu Mixpanel încă.

### 7.8 Moderation / roles

`hostId` + takeover implicit. Lipsește: co-host, spectator, kick, lock name, report.

Spectator e important pentru **facilitatorul care nu joacă**. Un bit `role: "host"|"player"|"spectator"`.

### 7.9 Observability

`/api/health` dă `{ok, rooms}`. Atât. Adăugați: players total, ws connections, uptime, heap. Gata.

Fără stack traces pe WS parse fail (e swallow). OK pentru security, rău pentru debug.

### 7.10 Extensibility pentru sticky notes

Azi `room.pieces` e un array indexat numeric, specializat pe snap-to-slot.

Pentru obiecte generice trebuie:

```
room.objects: Map<id, {type, x, y, w, h, rot, data, locked, heldBy}>
```

Piesele devin `type:"piece"`. Stickies `type:"sticky"`. Nu le amestecați în `pieces[]`.

**Nu faceți CRDT în Faza 1.** Last-write-wins pe obiect + hold lock e suficient pentru 20 de oameni pe sticky-uri scurte.

Protocol: `t:"obj"` generic, nu încă 15 tipuri de mesaje.

### 7.11 Alte mine

- `POST /reset` neautentificat.
- `GET /api/rooms/:id` leak-uiește numele jucătorilor activi (fără cod). Acceptabil, dar notați-l.
- Ratings broadcast include **toate răspunsurile**, nu doar `done` + profile code. Privacy fail pentru un „assessment”.
- `window.__ptStore` expus — util la teste, inutil de lăsat nemascat dacă vreodată apare un secret.
- LICENSE vs landing B2B: conflict legal de poziționare.
- Imagini cu `credit: ""`, `license: ""`, `source: "Web"` — **risc de copyright** pe 10+ fișiere. Un buyer enterprise va întreba. Un DMCA vă ia site-ul.

---

## 8. Business / product strategy

### 8.1 Cine NU e ICP-ul

- Consumer mass-market „jucați puzzle cu bunicii” — Jigsaw Explorer, Puzzle iT există. Lupta e pe SEO și catalog. Nu câștigați.
- „Miro killer” — sinucidere.
- Enterprise 10k seats cu SSO SAML în 2026 Q4 — prea devreme, arhitectura nu ține.

### 8.2 Cine POATE fi ICP (în ordine de credibilitate)

| Segment | De ce da | De ce nu încă | Prioritate |
| --- | --- | --- | --- |
| **Facilitatori independenți / team coaches** (RO + EU, 1–20 oameni/sesiune) | Durere reală: Lost at Sea se face pe flipchart sau pe Miro stângaci. Plătesc 20–50€/sesiune ușor. | Produsul nu exportă outcomes. Ranking-ul e stricat. | **ICP #1** |
| **Agile coaches / Scrum Masters** | Retro + values + icebreaker în sprint. Word World (dacă e real) + ranking. | Competiție: TeamRetro, EasyRetro, Kahoot. Trebuie unghiul „play → harvest”. | ICP #2 |
| **L&D / People Ops, companii 50–500** | Buget de team building. Vor „ceva altfel decât bowling”. | Cer vendor, invoice, GDPR, istoric. | ICP #3 după persistence + PDF |
| **Remote teams (icebreaker de 15 min)** | No-account e un avantaj uriaș vs Mural. | Retention zero. | Canal de acquisition, nu ICP plătitor |
| **Innovation / offsites** | Word World motto + puzzle frumos pe ecran mare. | Prea vag până avem template-uri. | Faza 3 |
| **HR enterprise 5000+** | Bani | Compliance, SSO, procurement 9 luni. | Nu acum |

**ICP #1 scris ca persoană:**

> Ana, 38 de ani, team coach independent în București/Cluj. Ține 6–10 workshop-uri/lună, 8–12 oameni, 90 de minute. Azi folosește Miro + un PDF cu NASA exercise + un timer pe telefon. Urăște să copieze sticky-urile în Notion după. Ar plăti 29€/lună dacă iese din sală cu un PDF de 2 pagini și dacă exercițiul de ranking e corect pedagogic.

Dacă Ana nu e fericită, L&D-ul nu va fi.

### 8.3 Poziționare clară (propunere)

**Nu:** „Miro, but everyone is solving the same beautiful puzzle.” (README-ul actual — compară cu un gigant și pierde.)

**Nu:** „B2B collaboration suite” (landing-ul actual — minte).

**Da:**

> **PuzzleTogether is how a team warms up with their hands and leaves with decisions on paper.**
> Play together (puzzle, ranking, words) → freeze → debrief → actions. In one room. No account for players.

Tagline scurt:

> **Play together. Leave with a decision.**

Categorie: **Team workshop game**, nu whiteboard, nu jigsaw app, nu LMS.

### 8.4 Diferențiere

| Competitor | Ei sunt | Voi sunteți (dacă livrați roadmap-ul) |
| --- | --- | --- |
| Miro / FigJam | Canvas infinit generic | Joc cu reguli + harvest. 10× mai puțin setup. |
| Kahoot | Quiz competitiv | Colaborare, nu puncte pe răspuns corect (decât opt-in). |
| Team building (escape room, skribbl) | Fun, zero artefact | Fun **cu** artefact. |
| EasyRetro / TeamRetro | Outcomes, zero play | Play **apoi** outcomes. |
| Jigsaw party apps | Play, zero B2B | Play ca **warmup de workshop**, nu ca destinație. |

**Nu vă luptați pe catalogul de 10.000 de puzzle-uri.** 40 de imagini bune ajung. Luptați pe **cele 4 activități de coaching făcute impecabil** + harvest.

### 8.5 Pachete de funcționalități (când veți monetiza)

| Plan | Preț orientativ | Ce include | Pentru cine |
| --- | --- | --- | --- |
| **Play** | 0€ | Jigsaw + 20 players + 24h rooms + podium | Icebreakers, acquisition |
| **Facilitate** | 29€/lună sau 4€/sesiune | Ranking corect, Compass, timer, lock, reveal, notes, PDF, Word World real | Ana (ICP #1) |
| **Team** | 99€/lună | Template-uri, istoric 90 zile, 3 co-hosts, branding (logo), 3 workspace seats | Agile org mic |
| **Org** | custom | SSO, DPA, retention 1 an, invoice, private images | L&D 500+ |

Free trebuie să rămână **complet jucabil**. Paywall-ul e pe **facilitare și memorie**, nu pe piese.

### 8.6 Ce trebuie construit ca să fie monetizabil și enterprise-friendly

Ordine de blocaj:

1. Ranking pedagogic corect (altfel un coach plătește o dată, cere refund)
2. Facilitator controls + PDF
3. Persistence > 60s
4. LICENSE / entitate comercială — **acum landing-ul B2B + LICENSE non-commercial e o capcană**
5. Privacy policy + cine vede ratings
6. Imagini cu licență clară (ștergeți `source: "Web"`)
7. Istoric sesiuni
8. Invoice / Stripe
9. SSO — abia când un logo din Fortune 500 întreabă

### 8.7 Moat posibil

Nu e tehnologia WS. E **biblioteca de activități + fluxul play→harvest**, dacă o faceți profundă. Un coach care și-a salvat 10 debrief-uri nu pleacă pe Miro.

Al doilea moat: **„hands on the table”**. Majoritatea tool-urilor de workshop sunt vorbit + sticky. Puzzle-ul forțează corpul. Asta e rar și merită păstrat ca identitate, nu diluat într-un whiteboard generic.

---

## 9. Backlog prioritzat

Estimări de efort: **S** < 1 zi · **M** 2–5 zile · **L** 1–2 săptămâni · **XL** > 2 săptămâni.
Complexitate tehnică: 1–5.

### P0 — must-have next (fără astea nu mai adăugați features)

| Nume | De ce contează | Impact produs | Impact business | Efort | Tech | Dependențe | Risc | Tip |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Ranking liber + lock de facilitator** | Exercițiul de coaching e invalid azi | Transformă „team coaching” din fake în real | Deblochează ICP #1 | M | 3 | protocol piece (slot, nu correct-expert); UI fără auto-snap expert | Mediu (migrare logică) | **Big bet scurt** |
| **Hide expert until Reveal** | Spoil = sesiune moartă | Pedagogie de bază | Credibilitate coach | S | 1 | host + flag `revealed` | Mic | Quick win |
| **Piece claiming (`heldBy`)** | 5+ jucători se calcă | Jigsaw-ul devine jucabil în echipă reală | Review-uri, retenție party | M | 3 | WS piece + UI outline | Mediu | Quick-ish |
| **Auth pe Reset + Change puzzle** | Un participant poate distruge workshop-ul | Siguranță | Trust | S | 2 | pid=host | Mic | Quick win |
| **Share button pe coaching** | Host-ul nu poate invita | Friction absurd | Prima sesiune eșuează | S | 1 | GamePage | Mic | **Quick win** |
| **Reconnect banner + freeze** | Mutări pierdute, zombie state | Încredere realtime | „App-ul e stricat” | S | 2 | store.connected | Mic | Quick win |
| **Nu reap empty room în 60s** | Cafea = cameră moartă | Sesiuni reale | Rage | S | 1 | TTL empty ≥ 15–30 min | Mic | Quick win |
| **i18n Create/Join + persist lang** | Landing RO → Create EN | Polish, RO market | ICP e RO-heavy | S | 1 | i18n | Mic | Quick win |
| **Ratings privacy** | Broadcast de răspunsuri brute | Etică assessment | GDPR even light | S | 2 | WS ratings | Mic | Quick win |
| **Copyright audit imagini** | `source: Web` | Legal | Enterprise blocker | S | 1 | catalog | Legal, nu tehnic | Quick win |
| **Fix E2E selectors** | Testele mint | Calitate | Viteză de livrare | S | 1 | browser tests | Mic | Quick win |

### P1 — high impact

| Nume | De ce | Produs | Business | Efort | Tech | Deps | Risc | Tip |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Facilitator dashboard v1 (lock, timer, reveal, people) | Fără el nu e workshop | Categorie nouă de produs | Monetizare Facilitate | L | 3 | host role, WS | Mediu | Big bet |
| Lobby + Start | Timer onest, control de scenă | Workshop feel | Perceived value | M | 2 | room.stage | Mic | Quick-ish |
| Spectator / host nu joacă | Coach-ul nu trebuie să tragă piese | Pedagogie | ICP #1 | S | 2 | role | Mic | Quick win |
| Insights board post-joc (3 coloane) | Artefact | Outcomes | De ce plătești | M | 2 | objects v1 sau formă simplă | Mic | Big-ish |
| Action items + owner | Follow-up | Outcomes | Re-contractare | M | 2 | players list | Mic | Quick-ish |
| Export PDF/JSON | Memorie | B2B minimum | „Vă trimit recap-ul” | M | 3 | data model | Mediu | Big-ish |
| Debrief gated pe scenă + capture | Debrief-ul e produsul | Coaching | — | M | 2 | stages | Mic | — |
| Claim + presence „X drags Y” | Claritate | Multiplayer | — | S | 2 | heldBy | Mic | — |
| Mobile ranking layout | 340px panel e inutil pe telefon | Coaching pe hybrid rooms | — | M | 2 | CSS | Mic | — |
| Safe-area + scoate `user-scalable=no` | A11y, iPhone | Polish | Enterprise a11y | S | 1 | — | Mic | Quick win |
| Word World: copy onest SAU scoate din B2B hero | Nu minți | Trust | — | S | 1 | landing | Mic | Quick win |
| Questionnaire: sync start + nu arăta polul pe buton | Assessment mai curat | Credibilitate | — | M | 2 | — | Mic | — |
| HUD reconnect + leave confirm | Mis-tap 🚪 | — | — | S | 1 | — | Mic | Quick win |
| Event log stdout | Învățare | Product | — | S | 1 | — | Mic | Quick win |

### P2 — strategic

| Nume | De ce | Efort | Tech | Tip |
| --- | --- | --- | --- | --- |
| Word World real (grid, validate, missions) | Diferențiator sau ștergere | XL | 4 | **Big bet** |
| Sticky notes + vote dots | Talk layer | L–XL | 4 | Big bet |
| Frames template (parking lot, debrief) | Facilitare | M | 3 | — |
| Persistence disk snapshot | Camere care supraviețuiesc deploy | M | 3 | — |
| Session history pentru host (magic link email) | Retention | L | 3 | — |
| Templates (retro, values, offsite 90 min) | Time-to-value | M | 2 | — |
| QR invite + projector view | In-room workshops | S | 2 | Quick win întârziat |
| Co-host | Ana + un intern | S | 2 | — |
| Team score default, podium individual opt-in | Aliniere coaching vs party | S | 1 | — |
| Breakout: 2 board-uri de ranking per subechipă | 12–20 oameni | L | 4 | — |
| Chat scurt sau reactions | Remote fără Zoom | M | 3 | — |
| Follow facilitator viewport | „Uitați-vă aici” | M | 3 | — |

### P3 — optional / experimental

| Nume | Notă |
| --- | --- |
| Pen/ink annotations | Overkill |
| Rotație piese jigsaw | Purist, nu B2B |
| Group/merge piese | Nice pentru Expert, scump |
| Auto-cluster ML | Nu |
| Achievements / XP | După ce scoring-ul e just |
| Video in-app | Folosiți Zoom |
| SSO / SAML | Când un buyer o cere în scris |
| Marketplace de activități | După 10 activități interne bune |
| AI debrief summary | Periculos pedagogic, util mai târziu |
| PWA | Nice |
| 10.000 puzzle-uri user-upload | Copyright iad |

---

## 10. Top 20 recomandări concrete (din *acest* repo)

Nu generice. Fiecare țintește un fișier sau un comportament real.

1. **Rescrieți ranking-ul în `server.js` + `RankingActivity.tsx`.** Sloturile 1–12 sunt ancore libere. Orice card poate sta pe orice slot. `locked` devine `placedOnSlot` și e reversibil până la `room.lockedByHost`. Ștergeți `ranks.set(p.id, p.id + 1)`. Calculați rangul din slot. Asta e recomandarea #1, nu e negociabilă dacă vindeți coaching.

2. **Mutati `expertRank` / rationale / debrief în spatele `room.revealed`.** Butonul „Vezi rankingul experților” dispare pentru non-host. Host: „Reveal expert”. `coaching-test.mjs` trebuie să testeze că un client **nu** primește expertRank înainte de reveal (azi testul blindează inversul).

3. **Adăugați `heldBy` pe `piece`.** Reject la `t:"piece"` dacă `heldBy && heldBy !== playerId`. Outline colorat în `Board.tsx`. Timeout 8s.

4. **`POST /reset` și `POST /puzzle` cer `pid === hostId`** (cu takeover explicit). Azi reset e deschis.

5. **Scoateți `!isCoaching &&` de pe butonul Share din `GamePage.tsx`.** Un rând. Un bug de produs.

6. **Citiți `connected` în HUD.** Banner galben „Reconnecting…”. Disable pointer pe canvas.

7. **Empty-room reap: 60s → 30 min.** În `src/server.js` housekeeping. Păstrați 24h TTL pe inactivitate reală.

8. **Persist `lang` în `localStorage`.** Traduceți `CreateRoom.tsx` și `JoinRoom.tsx`. Default `navigator.language`.

9. **Broadcast de ratings: trimiteți `{done, profileCode}`, nu `answers`.** Profilul se calculează pe server. Questionnaire-ul nu mai e un leak.

10. **Pe butoanele Agree/Disagree, ștergeți numele polului.** Rămâne „De acord / Nu chiar”. Dimensiunea rămâne în header doar dacă acceptați un assessment „educativ”, nu „orb”.

11. **Lobby stage.** `room.stage = "lobby"|"play"|...`. Piesele nu se împrăștie vizibil (sau board freeze) până host-ul apasă Start. `createdAt` pentru timer se setează la Start, nu la create.

12. **Confirm pe Leave** și pe Reset. Iconița 🚪 e un accident de workshop.

13. **Layout mobil ranking:** side panel devine bottom sheet. Board full width. Azi `w-[340px] absolute right-4 top-4` e de desktop.

14. **`index.html`:** scoateți `user-scalable=no`. Adăugați `viewport-fit=cover` + safe-area pe zoom controls.

15. **Word World pe landing:** fie un disclaimer onest („letter-tile jigsaw — full word mode coming”), fie scoateți-l din hero până există grid+validate. Redenumiți `scrabble-anagrams` (trademark).

16. **Podium: default off pe camerele de coaching; pe jigsaw, adăugați toggle host „celebrate team only”.** Afișați timpul echipei mai mare decât MVP-ul.

17. **Copyright:** umpleți sau scoateți puzzle-urile cu `source: "Web"` și credit gol (`grand-canyon`, `mount-fuji`, `plitvice-lakes`, `big-ben`, `pyramids-giza`, `neuschwanstein`, `cherry-blossom`, `lavender-field`, `new-york`, `prague`, etc.).

18. **Fix `browser-test.mjs` + `coaching-browser-test.mjs`** pe copy-ul actual (landing B2B, butoane RO/EN reale, fără `coachinghub` pe landing). Altfel nu aveți plasă.

19. **Stdout analytics:** un `logEvent({t, roomId, puzzleId, players})` pe create/join/complete. Fără asta, roadmap-ul e opinie.

20. **Facilitator dashboard v1 înainte de sticky notes.** Lock, timer, reveal, people, notes. Dacă construiți stickies acum, ați ales să deveniți un Miro slab.

---

## 11. Roadmap în 3 faze

### Faza 1 — Polish & must-have collaboration *(3–5 săptămâni)*

**Obiectiv:** Ana poate ține un ranking **corect** cu 6 oameni, pe laptop, fără să i se șteargă camera, fără spoil, fără reset din greșeală. Jigsaw-ul cu 8 oameni nu se mai calcă pe piese.

**Features:**
- Ranking liber + reveal + lock
- heldBy claim
- Share pe coaching, reset auth, empty-room TTL, reconnect UI
- i18n complet pe flow-ul critic
- Lobby + Start + timer onest
- Spectator host
- Privacy ratings
- Image license cleanup
- Teste E2E actualizate + test de ranking **liber**
- Copy Word World onest
- Safe-area, leave confirm, mobile ranking sheet

**Impact:** produsul minte mai puțin. Coaching-ul devine demonstrabil. Party-ul scalează la 8.

**Ce trebuie validat:**
- 3 sesiuni reale (nu prieteni din dev) de ranking Himalaya, 5–8 oameni, 40 min.
- Un jigsaw Medium cu 6 oameni: număr de conflicte de piese înainte/după claim.
- Access gate: % drop-off (analytics stdout).

**Cum testăm:**
- `coaching-test.mjs`: item 0 lock pe slot 5, teamRank=5, expert încă hidden.
- Sim: doi clienți trag aceeași piesă → al doilea primește reject.
- Browser: reconnect (kill WS) arată banner, nu pierde camera 5 min.
- Manual: iPhone ranking bottom sheet, share din HUD.

**Nu intra în Faza 1:** stickies, Word World real, PDF, persistence disk, billing.

### Faza 2 — Facilitator suite & workshop outcomes *(6–8 săptămâni)*

**Obiectiv:** Ana iese din sală cu un PDF. Debrief-ul e în app. Poate vinde planul Facilitate.

**Features:**
- Dashboard facilitator (timer, lock, reveal, stages, notes)
- Insights board (3 coloane) + action items
- Export PDF/JSON
- Questionnaire sync start + team debrief (distribuție profiluri)
- Word World v1 real **sau** tăiat din ofertă
- Vote dots (chiar dacă doar pe insights, nu pe stickies încă)
- QR + projector „join code”
- Team-only celebration vs podium opt-in
- Templates: „90 min team offsite” (jigsaw icebreaker → ranking → compass → harvest)

**Impact:** prima dată puteți cere bani fără rușine.

**Ce trebuie validat:**
- 5 workshop-uri plătite sau barter, ICP #1.
- Întrebare: „Ai mai avea nevoie de Miro în paralel?” Dacă da, n-ați terminat harvest-ul.
- Timpul de setup < 3 min.

**Cum testăm:**
- Script de sesiune: create → lobby 4 clienți → start → rank → lock → reveal → 3 actions → export JSON schema valid.
- PDF snapshot test (hash nu, dar conține names + Δ + actions).
- Mobile: participant only (nu host) pe telefon, host pe laptop.

### Faza 3 — Persistence, templates, B2B scale *(trimestru)*

**Obiectiv:** sesiunea supraviețuiește unui deploy. Ana are istoric. Un L&D poate cumpăra Team.

**Features:**
- Snapshot pe disk / sqlite
- Magic link host (istoric 90 zile)
- Sticky notes + frames + vote (talk layer)
- Word World missions complete
- Billing Stripe, planuri Play/Facilitate/Team
- LICENSE comercial clar, Privacy, DPA light
- Observability (health extins, error tracking)
- Orgs, co-host, branding logo
- Abia apoi: Redis/HA, SSO dacă e cerut

**Impact:** business, nu demo.

**Ce trebuie validat:**
- Paid conversion Facilitator → 29€.
- Retention 4 săptămâni (a ținut a 2-a sesiune?).
- Restore după restart < 5s, camere active intacte.

**Cum testăm:**
- Chaos: kill -9 node, restart, WS reconnect, board identic.
- Load: 20 camere × 10 players smoke.
- Billing sandbox + downgrade.

---

## 12. QA / validare

### 12.1 Funcționale

- [ ] Create room fiecare categorie, fiecare dificultate
- [ ] Create fiecare din 4 activități coaching
- [ ] Join pe cod, pe link+cod, pe link fără cod (403), pe cod greșit (403)
- [ ] Cap 20 → 409
- [ ] Host change puzzle: toți primesc `t:"puzzle"`, epoch++, piese noi
- [ ] Non-host nu poate change/reset (după P0)
- [ ] Reset scatter + scores 0 + ratings []
- [ ] Completion la total locked, podium sumează total piese
- [ ] Level Up schimbă dificultatea, același puzzleId
- [ ] Ranking: orice item pe orice slot; mutabil până la lock; reveal gated
- [ ] Questionnaire: 20 răspunsuri → unul din 16 coduri; al doilea jucător vede `done` fără answers brute
- [ ] Word World (azi): 25 tile-uri cu literă; (mâine): submit word
- [ ] Leave + rejoin same tab (session pid)
- [ ] Tab nou fără pid cere cod

### 12.2 UX

- [ ] Limbă RO persistă Create → Join → Game → Picker → Completion
- [ ] Empty catalog, room expired, room full: copy uman, bilingv
- [ ] Leave confirm
- [ ] Expert ranking invizibil pre-reveal
- [ ] Completion nu blochează vederea puzzle-ului (după fix)
- [ ] Share pe coaching
- [ ] Lobby copy: câți au intrat

### 12.3 Mobile

- [ ] iPhone SE 375×667: create, join, jigsaw Easy, ranking, questionnaire
- [ ] iPhone 14 safe-area: zoom buttons vizibile
- [ ] Pinch nu e furat de browser (fără user-scalable=no, board `touch-action:none` rămâne)
- [ ] Ranking bottom sheet, nu panel 340px
- [ ] Thumb: Start/Share accesibile; Leave nu e lângă Share fără confirm
- [ ] Landscape ranking
- [ ] Questionnaire butoane Agree 44px min height

### 12.4 Performance

- [ ] Expert 144, 8 jucători, drag 10s: ≥50fps pe M1 / ≥30fps pe un Android mediu
- [ ] Sprite cache nu explodează memoria la change puzzle × 10
- [ ] Cursor relay 10 jucători: CPU server < 5% pe un room
- [ ] Landing LCP < 2.5s pe 4G (fonturi!)

### 12.5 Realtime

- [ ] 2 clienți, drag sync < 100ms LAN
- [ ] Claim: al doilea nu fură
- [ ] Lock server-side ține la spam
- [ ] Reconnect mid-drag: piesa se eliberează
- [ ] 15 reconnect apoi UI de „room lost”, nu zombie
- [ ] Host disconnect 10s: takeover previzibil
- [ ] Clock skew: timer de pe server, nu `Date.now() - createdAt` pe fiecare client (azi e client-side — deriva)

### 12.6 Coaching outcomes

- [ ] Δ ranking = sumă (teamSlot - expertRank)², nu (id+1 - expert)
- [ ] Debrief nu e vizibil în play
- [ ] Export conține: participanți, ranking echipă, expert, Δ, profiluri (cod + nume, nu răspunsuri), actions
- [ ] Facilitator notes nu apar la participanți
- [ ] Compass: distribuție echipă (câți pe fiecare pol)

### 12.7 Regression risks (minele voastre)

| Mină | De ce explodează |
| --- | --- |
| Ranking snap pe `correctX` | Orice „fix rapid” care păstrează snap-ul expert |
| `coaching-test` care așteaptă lock pe correctX | Testul va eșua la fix-ul corect — **trebuie rescris odată cu fix-ul** |
| browser-test pe copy vechi | Roșu după orice landing tweak |
| `dragPos` global în RankingActivity | Remount / StrictMode |
| Empty reap 60s | „Fix de memorie” care ucide sesiuni |
| Broadcast pieces către sender + optimistic drop | Loop vizual dacă introduceți interpolare |
| `hostId` null după leave | Nimeni nu mai poate Level Up |
| Word letters `slice(0, total)` | Easy 25 taie cuvinte; testele nu văd |
| LogoMark `id="lg"` duplicat | Gradient stricat când HUD + landing coexistă (rar) |
| `window.__ptStore` | Testele depind de el — nu-l ștergeți fără a muta testele |

### 12.8 Test coverage gaps

| Gap | Gravitate |
| --- | --- |
| Ranking logic (slot vs expert) | Critică — zero teste corecte |
| heldBy / conflicts | Critică — n-aveți feature-ul, n-aveți testul |
| Reconnect / empty reap | Înaltă |
| changePuzzle + host takeover | Medie (sim nu acoperă) |
| Word World | Zero |
| i18n | Zero |
| Mobile / safe-area | Zero automat |
| Reset auth | Zero (și e deschis) |
| Load 20×144 | Zero |
| Visual regression | Zero (screenshot-uri manuale în test-artifacts gitignored) |

**Nu introduceți Jest ca religie.** Extindeți `sim-test.mjs` + `coaching-test.mjs` — stilul actual e sănătos. Adăugați 10 assert-uri pe ranking liber. Asta valorează mai mult decât un framework.

---

## Ce aș face mâine

Dacă am o zi, nu o lună:

1. **Share pe coaching** (10 min) — `GamePage.tsx`
2. **Reset/puzzle host-only** (1h) — `server.js`
3. **Empty room 30 min** (10 min)
4. **Reconnect banner** (2h)
5. **Hide expert + șterge spoil button pentru participanți** (2h) — chiar înainte de ranking-ul liber, ca să nu mai stricați sesiunile de azi
6. **Spec + schelet ranking liber** (restul zilei): slot ca destinație, nu `correctX` expert; test în `coaching-test.mjs` scris **întâi**, ca să nu mai blindați bug-ul
7. **O linie de copy pe landing** care nu mai pretinde Word World ca brainstorming suite

Mâine nu se fac stickies. Mâine nu se face Stripe. Mâine se oprește hemoragia de credibilitate.

## Ce aș amâna

- Sticky notes, pen, arrows, frames editor
- Word World „Scrabble real” (până după ranking + facilitator v1)
- Persistence Postgres / Redis / HA
- SSO, orgs, white-label
- Catalog de 200 de puzzle-uri
- Rotație piese, merge groups
- AI anything
- Podium mai și mai animat
- Landing și mai „B2B” fără substanță — **opriți copy-ul care minte**

## Ce poate deveni diferențiatorul major al PuzzleTogether

Nu canvas-ul. Nu 40 de imagini. Nu podiumul.

**Diferențiatorul: un workshop în care echipa se joacă cu mâinile (puzzle / ranking / cuvinte) și iese cu o decizie scrisă, în aceeași cameră, fără să deschidă Miro.**

Cele trei piese ale moat-ului, dacă le construiți în ordinea asta:

1. **Play care e adevărat** — ranking pedagogic, jigsaw cu claim, cuvinte care sunt cuvinte
2. **Facilitate care e discret** — lock, reveal, timer, spectator; coach-ul dirijează, nu luptă cu UI-ul
3. **Harvest care e exportabil** — 3 insights, 3 actions, PDF, gata

Dacă săriți la (un clone de) Miro, deveniți slabi la tot. Dacă rămâneți jigsaw party, vă bateți cu aplicații gratuite. Dacă lipiți play → freeze → debrief → paper, **nimeni din tool-urile de mai sus nu face asta într-un flow singur**.

Asta e miza. Restul e vopsea.

---

*Audit bazat pe citirea integrală a repo-ului (server, store, Board, Ranking, Questionnaire, pagini, catalog, teste, LICENSE). Fără modificări de produs în această livrare.*
