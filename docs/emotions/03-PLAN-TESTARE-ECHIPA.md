# PLAN DE TESTARE — CARTOGRAF cu echipă de 5–15 oameni

**Obiectiv:** validăm (1) core loop-ul solo (meteo + expediție), (2) **reveal-ul Camera Mare**
 („aceeași situație, ceruri diferite" — aha-momentul produsului), (3) **tonul** (sigur vs. cringe vs.
 „clasă de psihologie"), (4) stratul de siguranță (skip/pauză/Calm reale, nu decorative).
Nu testăm „dacă le place în general" — testăm 4 lucruri, cu reguli de decizie pre-registrate.

---

## 1. Echipa de test (țintă: 12; minim 8; maxim 15)

| Rol | Nr. | Profil / criteriu |
|---|---|---|
| Participanți regulari | 6–8 | mix vârstă 25–55, mix gen, 2–3 introverti declarați, 2 „skeptici de self-help" **invitați intenționat** (ei sunt cel mai bun test anti-cringe) |
| Psiholog / psihoterapeut | 1–2 | **doar observator**, nu participant; nu comentează în sesiune; ia note structurizate |
| Facilitator (rulează Camera Mare) | 1 | om de workshop (ideal din comunitatea PuzzleTogether); urmează scriptul fix, fără improvizație |
| „Bug logger" | 1 | notează orice fricțiune UI / bug / copy ciudat, fără a-i afecta pe participanți |

Recrutare: 2–3 din comunitatea PuzzleTogether (folosesc deja room-uri), 3–5 voluntari (prieteni/colegi),
1–2 studenți la psihologie (observatori), 1 „sceptic". **Regulă:** nimeni din echipa de producție nu e participant.

## 2. Materiale

**Pentru Camera Mare live (variantă web, din MVP):** un laptop/proiector (room-ul de emoții),
un telefon per participant (vot privat), camera cu 8–12 scaune.
**Backup pe hârtie (fallback dacă web-ul pică sau pentru MVP-ul rapid):**
- 8 foi A0 lipite pe pereți (zonele: culoare + iconiță + nume + 1 linie funcție — ex. FRICĂ: „adesea semnalează pericol");
- 20 cartonașe A6 cu situații (din `situations.json`, mode room);
- stickere (10 per persoană, 2 culori), cronometru, flipchart pentru harvest (Observed/Learned/Try Next).

## 3. Sesiunea — 90 de minute (script fix)

| Timp | Bloc | Ce se întâmplă |
|---|---|---|
| 0–5 min | Welcome | Facilitatorul: ce e, ce NU e („nu e test de psihologie, nu e terapie, poți sări oricând"), regulile (privat, fără obligația de a participa — „Pas" e valid), cuvântul de siguranță |
| 5–15 min | **A. Demo + Meteo solo** | Facilitatorul arată live pe laptop: 1 carte de emoție + 1 expediție completă (10 min). Fiecare participant, pe telefon: înregistrează **meteo-ul de azi** + face **1 expediție** |
| 15–45 min | **B. Expediții solo** | Fiecare face încă **2 expediții** în ritmul lui (total 3). Bug logger-ul notează fricțiunile. La final: „ce m-a surprins" — 1 propoziție pe voce, opțional |
| 45–80 min | **C. Camera Mare live** | Room pe ecran mare. Facilitatorul: brief (2 min) → **meteo de pornire** (1 tap) → **3–4 situații** (vot privat 1–3 emoții + intensitate + arhetip opțional → **reveal anonim pe ecran** → 2 min debrief cu promptul din card) → **muzeul anonim** (opțional, opt-in) → **meteo de final** → **harvest** Observed/Learned/Try Next (5 min) |
| 80–90 min | **D. Feedback** | Structurat, pe telefon/papir (formularul de mai jos); 3 minute de întrebări libere; mulțumesc |

**Reguli dure ale sesiunii:**
1. Facilitatorul rulează **exact scriptul**; orice deviere se notează, nu se improvizează (altfel nu mai știm ce am testat).
2. Psihologul **nu vorbește** în sesiune (risc de ancorare / autoritate); notează în fereastra lui.
3. **Nu se repară nimic live**; orice bug = în log, continuăm (sau fallback hârtie).
4. Participanții nu văd feedbackul unii al altora (evităm conformismul).
5. Orice participant poate ieși oricând; „Pas" la orice pas se respectă fără comentarii.

## 4. Framework-ul de feedback (formularul)

**A. Scoruri rapide (1–5) pe module:**
Roata / Cartea emoției · Meteo-ul · Expediția (loop-ul) · Frontiera + prediction tracker · Muzeul ·
Dovezi vs. Povestea · Reveal-ul Camera Mare · Meteo de pornire/final · Muzeul anonim · Tonul & copy-ul ·
Controalele de siguranță (skip/pauză/Calm).

**B. Cele 3 coloane (calitativ, minim 2 răspunsuri la fiecare):**
- **Aș reveni pentru:** (ce ți s-a părut util/frumos?)
- **A fost mid:** (ce a fost „ok, dar nu mai mult"?)
- **Aș evita / m-a deranjat:** (ce a fost degeaba, suprasolicitant, confuz?)

**C. Metricile-killer (întrebările care decid produsul):**
1. **Aha:** „În timpul sesiunii, a apărut ceva despre tine pe care nu îl observai? Spune." (open + da/nu)
2. **Cringe-meter:** „Momentul în care te-ai simțit cel mai judecat / ca la o clasă de psihologie / ca la un chestionar corporate? Ce a fost?" (țintă: „niciunul")
3. **Reveal:** „Când ecranul a arătat distribuția camerei, s-a schimbat ceva în cum vezi grupul / situația? Cum?" (doar Camera Mare)
4. **Siguranța:** „Butoanele skip/pauză/Calm ți s-au părut reale sau decorative? A existat un moment greu?" + „Ai fi vrut altceva în acel moment?"
5. **Arhetipurile:** „Care arhetip „a vorbit" în tine azi? Te-ai simțit **înțeles** sau **etichetat**?" + „Ce arhetip ai evitat și de ce?"
6. **Granularitatea:** „Momentul în care un cuvânt a fost exact, în loc de generic? Ce cuvânt a fost?" (validează bătăia 4 a loop-ului)
7. **Frontiera:** „Cardul cu gap-ul (ai prezis X, a fost Y) — ți s-a părut util, ridicol sau nimic?"
8. **Recomandare:** 0–10 „recomanzi Camera Mare unei echipe cu care lucrezi?" + „Cărei echipe NU i-ai recomanda-o și de ce?"

**D. SUS** — 10 itemi standard (System Usability Scale), pentru scor de usabilitate comparabil.

**E. 2 întrebări de „10x":** „Ce ar face asta un 10 pentru tine?" + „Ce ți-ai fi dorit să poată face produsul, dar nu a putut?"

## 5. Testul arhetipurilor în sesiune (zona dedicată)

- În blocul B (solo): un mini-quiz de 2 minute — „Cine vorbește în tine săptămâna asta?" (1–2 dominanțe + 1 evitat) → notăm **coerența**: alegerea dominanta coincide cu emoțiile din meteo/expediții?
- În blocul C (Camera Mare): votul de arhetip e **opțional**; după reveal, 1 întrebare de debrief:
  „4 din voi aveau Gardianul, 3 Exploratorul. Ce vedeți diferit?" — notăm dacă arhetipurile **fac conversația mai bună** (specifică, mai puțin abstractă) sau dacă **forțează o grilă** (ridică mâna: „nu sunt Gardian, sunt…").
- Decizie: dacă ≥ 50% spun „etichetat, nu înțeles" → arhetipurile ies din v1 solo și rămân doar ca opțiune în Camera Mare (sau invers).

## 6. Ce notează psihologul-observator (fereastra lui separată)

- Limbajul utilizatorilor: apar „diagnostic" auto („eu sunt anxios")? Tonul produsului le alimentează sau le temperă?
- Momente de activare (râsete nervoase, tăieri, ieșiri) → au funcționat controalele?
- „Ce l-aș fi oprit pe un client în fața lui" — 3 max. (nu pentru redesign, ci pentru **harta riscurilor** §16 din plan).
- Orice claim din UI pe care l consideră inexact științific (checklist cu `research-sources.md`).

## 7. Ce notează bug logger-ul

- Fricțiuni UI (tap-uri ratate, copy confuz, load > 2 s, erori), fiecare cu: ecran, acțiune, așteptare, realitate.
- Orice moment în care un participant întreabă „ce ar trebui să răspund?" (semn de design greșit — nu există răspuns corect, dar UI-ul trebuie să-l facă simțit).

## 8. Deciziile pre-registrate (puse pe hârtie ÎNAINTE de sesiune)

| Semnal | Regula | Acțiunea |
|---|---|---|
| SUS < 68 | Usabilitate sub prag | Fix de usability **înainte** de orice conținut nou |
| ≥ 50% raportează „judecat / clasă de psihologie" (cringe) | Ton greșit | Rewrite copy & ton, re-test cu altă cohortă înainte de v1 |
| < 2 aha-uri per sesiune (pe toată grupa) | Loop-ul e subțire | Profundă bătăia 6 (jurnal) + cardurile de emoție; re-test |
| Orice flag de siguranță (moment greu fără control funcțional) | Safety fail | **Block release**; reparăm stratul, re-testăm |
| Reveal < 70% „s-a schimbat ceva" | Mecanica-killer nu funcționează | Re-design reveal (mai puțin chart, mai mult „ce spune camera despre ea") |
| ≥ 50% arhetipuri „etichetat, nu înțeles" | Grila forțează | Arhetipurile opționale doar în Camera Mare |
| Top-3 „mid" repetate (≥ 3 voci la fel) | Modul sub așteptări | Intră în lista de quick wins sau se taie din v1 |

## 9. Livrabilul post-sesiune (în 48h)

1. **Matricea feedback:** module × participanți (scoruri 1–5 + taguri place/mid/evită).
2. **Top 5 iubit + Top 5 evitat**, cu citate (parafrazate, anonime).
3. **SUS** (medie) + NPS-recomandare + numărul de aha-uri + cringe-incidents (0 = țintă).
4. **Safety report:** flaguri + verificarea controalelor (funcționau? erau descoperibile?).
5. **Arhetipuri:** înțeles vs. etichetat (raport) + decizia de v1.
6. **3 quick wins** (≤ 1 zi de muncă fiecare) + **3 mize mari** (fazele 5–8 prioritate reordonată) + **ce se taie** din v1.
7. **Decizia de go/no-go pentru v1** (MVP faze 0–4 + Camera Mare) — scrisă, semnată de facilitator + 1 participant voluntar + psiholog.

## 10. Follow-up la 1 săptămână (5 minute, pe email/telefon)

- „Ai mai deschis / ai mai făcut un meteo? De ce / de ce nu?" (reținere reală)
- „A rămas ceva de la sesiune (o frază, o hartă, un gap)?" (aha durabil vs. moment de sesiune)
- „I-ai arăta lui cineva? Cui și de ce?" (recomandare naturală)

## 11. Logistica și riscurile sesiunii

- **Risc: participant activat emocional.** Mitigare: scriptul de siguranță din brief, „Pas" valid,
  ecran Calm cu resurse (112 + linia anti-suicid actualizată + „vorbește cu cineva de încredere"),
  facilitatorul antrenat pe 15 min înainte (run-through), camera fără ferestre/priviri din exterior.
- **Risc: grup omogen.** Mitigare: criteriile de mix din §1 verificate la înscriere.
- **Risc: web-ul pică în sesiune.** Mitigare: fallback hârtie pregătit și testat o dată înainte (8×A0 + 20 cartonașe).
- **Risc: facilitatorul improvizează.** Mitigare: scriptul tipărit + 15 min run-through + regula „deviere = notă".
- **Anonimitatea datelor de feedback:** se colectează pe nume (ca să putem urca quality bar-ul),
  dar rapoartele externe citate sunt parafrazate și anonime.

## 12. MVP pe hârtie (varianta rapidă — 60 min, doar Camera Mare, fără web)

Dacă nu e timp de MVP web: aceeași sesiune C pe hârtie — 4 situații × (citește → fiecare merge în zona
emoției de pe perete, 1–2 zone = mixt, „pas" permis → 1 întrebare: „de ce ai ales zona asta?") →
meteo de final pe stickere → harvest pe flipchart. **Măsoară exact aceleași 4 lucruri** (loop, reveal —
aici = „ați văzut 4 oameni în 4 zone diferite pentru aceeași situație", ton, siguranță).
Materialele din §2, total: 8×A0, 20 cartonașe, 10 stickere/persoană, flipchart, cronometru.
Cost: < 200 lei. Timp de pregătire: 45 min.
