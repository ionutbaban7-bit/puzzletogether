# CARTOGRAF — Plan complet pentru zona de emoții din PuzzleTogether

**Data:** 2026-09-13 · **Status:** plan + prompt de execuție (vezi `02-PROMPT-EXECUTARE.md`) + plan de testare (vezi `03-PLAN-TESTARE-ECHIPA.md`)

---

## 1. Ce avem deja (contextul contează)

PuzzleTogether nu e o aplicație de self-help. E un **joc de workshop în timp real pentru echipe**:
jigsaw colaborativ, ranking liber, Team Compass, Team Coaching, cu flow de facilitator
`lobby → brief → play → reveal → debrief → harvest`, board de insights
(Observed / Learned / Try Next), action items cu owner și dată, export JSON + PDF,
room codes, host-facilitator, fără conturi, React 18 + TS + Vite + Tailwind,
Express + ws pe un singur origin, RO/EN.

Asta schimbă tot: **zona de emoții nu se face ca încă o aplicație de roată a emoțiilor**
(există zeci, toate identice). Se face ca **a doua față a produsului** — ceea ce nimeni altcineva nu are:

> **PuzzleTogether = "joci împreună, pleci cu o decizie."
> CARTOGRAF = "simți împreună, pleci cu o hartă."**

### Decizia strategică (cea mai importantă din plan)

Zona are **două moduri, cu aceeași identitate**:

1. **Solo — „Atlasul tău"** (pagina dedicată `/emotii`): roata, meteo-ul emoțional,
   expediții, frontiera fricilor, muzeul dovezilor, locuitori (desen), curtea interioară (arhetipuri), atlas final.
   Date doar locale (localStorage), export personal, fără conturi — coerent cu produsul.
2. **Echipă — „Camera Mare"** (reutilizând infrastructura de room existentă):
   facilitatorul citește o situație, fiecare participant votează **privat** emoția + intensitatea + arhetipul,
   ecranul mare arată **distribuția anonimă** — „Aceeași situație. 8 ceruri diferite."
   Reveal → debrief → harvest (Observed/Learned/Try Next) — exact DNA-ul PuzzleTogether.

Această a doua față e **diferențiatorul absolut**: niciun self-help app nu are room mode cu facilitator,
reveal anonim și harvest de acțiuni. Și e exact lucrul pentru care echipele care plătesc
pentru PuzzleTogether vor vrea și zona de emoții.

---

## 2. Nume și identitate

### Propunere principală: **CARTOGRAF**

- *CARTOGRAF* — „hărtuiește-ți lumea interioară."
- Tagline RO: **„Simți. Numesc. Alege."** · EN: **„Feel it. Name it. Choose."**
- De ce: un singur cuvânt, brandabil, RO/EN, spune exact ce face produsul (transformă
  o experiență difuză într-o hartă), și extinde natural metafora care unifică toate mecanicile.
- Alternatives dacă nu convine: *Atlasul Interior* (mai explicit) · *Meteo Interior* (mai lejer, pe meteo).

### Sistemul de metaforă cartografică (nu e decor — e arhitectura de UX)

| Metafora | Mecanica reală |
|---|---|
| **Lumea interioară / teritorii** | Roata emoțiilor: cele 8 familii Plutchik sunt teritorii |
| **Cer / meteo** | Starea emoțională zilnică: 1 tap = cer (emoție) + intensitate + corp |
| **Burla (busola)** | Orientare valență × arousal (circumplexul Russell): calm↔turbulent / negativ↔pozitiv |
| **Isobare** | Intensitatea 0–10 (inelele roții Plutchik) |
| **Expediție** | Un scenariu/jucătură completă din core loop (3–5 min) |
| **Jurnal de expediție** | Jurnalul de reflecție (câmpuri structurate, nu text liber forțat) |
| **Frontieră** | Fricile + scara curajului (graded exposure) |
| **Cotă cucerită / marcaj pe hartă** | Pas completat pe frontiera |
| **Muzeu** | Dosarul dovezilor (self-efficacy) — „Muzeul Supraviețuirii" |
| **Locuitori** | Emoțiile desenate ca personaje (externalizare) |
| **Curtea interioară** | Zona de arhetipuri |
| **Atlasul final** | Harta emoțională personală, exportabilă (PDF printabil, ca exportul existent) |
| **Instrumente de cartograf** | Sistemul de progres (fără XP) — vezi §11 |

Tot UI-ul vorbește această limbă. Un utilizator care termină o sesiune are senzația
că a **hărtuit un teritoriu**, nu că a „făcut un test de psihologie".

---

## 3. Arhitectura științifică (alegere explicită + de ce)

### Modele comparate

| Model | Ce oferă | Problema pentru joc |
|---|---|---|
| **Ekman** (emoții de bază + expresie facială) | Listă familiară (6–10) | Universalitatea expresiilor faciale e contestată puternic în 2024 (studii mari de replicare; chiar Ekman a migrat către framework „Dynamic Facial Action"). Fără dimensiune de intensitate. |
| **Plutchik** (8 emoții de bază + inele de intensitate + amestecuri) | Structură 2D nativă: 8 familii × 8 niveluri de intensitate + blend-urile vecine | „Psychoevolutionary" — o parte din fundamentare e disputată, dar **structura e excelentă pentru joc** |
| **Russell — circumplexul afectiv** (valență × arousal) | Orientare continuă, bine susținut empiric | Nu e un inventar de emoții, e un spațiu |
| **Barrett — emoții construite / granularity** | Cadrul epistemic corect: nu „descoperi" o emoție ascunsă, construiești descrierea experienței; precizia lexicală (granularity) se corelează cu reglare mai bună | E filosofie/model, nu inventar |
| **Panksepp — sisteme afective** (SEEKING, RAGE, FEAR, LUST, CARE, PANIC/GRIEF, PLAY) | Ancoră neuroștiințifică pentru „funcțiile" emoțiilor | Abstracț, dar perfect pentru arhetipuri |
| **IFS / „parts"** (Schwartz) | Limbajul personajelor („partea care te protejează") | E un model terapeutic; se folosește **strict ca metafora etichetată**, nu ca tehnică |

### Arhitectura aleasă (coerentă, documentată, defensibilă)

**„Teritorii + Busolă + Granularitate"** =

1. **Teritoriile** = cele 8 emoții de bază Plutchik: BUCURIE (joy), TRUST, FRICĂ (fear),
   SURPRINDERE (surprise), TRISTEȚE (sadness), DISPREȚ (disgust), FURIE (anger), ANTICIPARE (anticipation).
2. **Isobarele** = inelele de intensitate Plutchik: fiecare familie are 3 niveluri jucabile
   (nuanță → emoție → extrem; ex. frică: neliniște → frică → groază/teroare) = **24 de carduri**
   (8 × 3), fiecare card cu **spectru complet de 8 trepte** Plutchik vizibil în carte.
   (Refinere din execuție: 8×3=24 carduri profunde + spectru de 8 trepte/card bate 64 de carduri superficiale —
   roata rămâne 8 sectoare × 3 inele = 24 ținte, fiecare bine detaliată, cerința explicită a utilizatorului.)
3. **Burla** = circumplexul valență × arousal (Russell) ca 2D-orientare: fiecare emoție are
   coordonate (valență −5…+5, arousal −5…+5) afișate pe hartă; „cerul" săptămânii e norul de puncte al utilizatorului.
4. **Cadrul epistemic** = constructivismul lui Barrett: produsul nu spune niciodată
   „tu simți X"; spune „ia-ți instrumentul și etichetează mai precis". Fiecare card de emoție
   se încheie cu: *„Aceasta e o hartă a teritoriului, nu teritoriul însuși."*
5. **Amestecurile (mixed emotions)** = blend-urile Plutchik (vecine pe roată) + **multi-select 1–3 emoții
   ca regulă implicită** în tot ce înregistrează utilizatorul — experiențele reale sunt mixte.

De ce Plutchik ca schelet: e singurul model cu **intensitate + combinații** codificate nativ
(structură de joc), iar limitele lui se declară onest în secțiunea „Cercetare" din fiecare card.

### Ce spune cercetarea pentru fiecare mecanică cheie (rezumat; surse complete în `research-sources.md`)

| Mecanică | Cercetare | Forța dovezii | Limită de onestitate |
|---|---|---|---|
| Etichetarea emoției reduce reactivitatea | Lieberman et al. 2007 (Psychological Science) — affect labeling diminuează activitatea amigdalei | Medie–puternică (efecte mici–medii, eșantioane fMI) | Nu e „remediu"; e un mecanism de reglare modest |
| Unde simți în corp | Nummenmaa et al. 2014 (PNAS) + 2018 — body maps discrete, parțial suprapuse, stabile cross-cultural | Puternică ca fenomen | E „model tipic", nu predicție per persoană |
| Numirea precisă = reglare mai bună | Barrett — emotional granularity; precizia lexicală se asociază cu reglare mai flexibilă | Medie–puternică | Corelațional în mare parte |
| Expunerea ca **learning** nu ca „ștergere" | Craske et al. 2008 + 2014 (BRT) — inhibitory learning: ceea ce contează e **învațarea nouă** (așteptări încălcate), nu habituation/fear reduction | Puternică în context clinic | Aplicarea non-clinică la „frici obișnuite" e extrapolare — se declară |
| Evitarea întreține frica | Negative reinforcement: scăderea pe termen scurt → menținere pe termen lung (Rachman 1979; nivel manual) | Puternică (clasic) | E model, nu lege individuală |
| Încrederea se construiește pe dovezile de mastery | Bandura 1977 — 4 surse de self-efficacy, mastery e cea mai puternică | Puternică | E un construct, nu o scorizare |
| Impostor | Clance & Imes 1978; experiența subiectivă vs. dovezi externe | Medie | Frecvența e supradimensionată în media; nu e diagnostic |
| Rușine vs. vinovăție | Tangney & Dearing — rușine („sunt rău") vs. vinovăție („am făcut rău") au funcții diferite | Medie–puternică | |
| Suprimarea emoțiilor e costisitoare | Wegner 1987 — ironic process (suprimarea rebound-uită); literatura pe thought suppression | Medie–puternică | |
| Flexibilitatea > eliminarea disconfortului | Hayes — ACT / psychological flexibility | Medie–puternică în clinic; extrapolare non-clinică se declară | |
| Desenul ca externalizare | Art therapy — meta-analize eterogene, efecte moderate, calități variabile | Slabă–moderată | **Se prezintă strict ca externalizare/reflecție, niciodată ca interpretare a subconștientului** |
| Funcțiile emoțiilor „nu e o singură meserie" | Panksepp (sisteme) + constructivism: funcție e hipotereză contextuală | Medie | Fiecare formulare de tip „meseria emoției" e etichetată „adesea semnalează" |

**Regulă de aur a conținutului:** orice afirmație din UI care derivă din cercetare apare cu
hedging onest („adesea", „la multe persoane") + sursa în secțiunea „Cercetare" din card.
Nu se inventează studii. Ce nu se poate verifica, nu se publică.

---

## 4. Structura paginii dedicate `/emotii`

Pagină separată, dedicată total zonei de emoții (nu room — room-ul e pentru modul echipă).
Layout: header scurt (CARTOGRAF + metafora hărții) + **nav sticky cu 7 taburi** +
**buton „Calm" întotdeauna vizibil** (strat de siguranță — vezi §10).

1. **HARTA** — hub-ul: roata interactivă (8 teritorii × 3 inele de intensitate) + burla valență×arousal.
2. **METEO** — starea de azi (1 tap) + istoric + „raportul de meteo al săptămânii" (frecvențe, intensitate, unde în corp, ceruri mixte, ce se ascunde).
3. **EXPEDIȚII** — core loop-ul (scenariu → meteo → corp → nume → reacție → câmp de jurnal) + lista jurnalelor.
4. **FRONTERA** — fricile mele + scara curajului cu **prediction tracker** (vezi §6.4).
5. **MUZEUL** — dovezile că pot face față + jocul „Dovezi vs. Povestea" (impostor).
6. **LOCUITORII** — desen + personaje + **Curtea interioară (arhetipuri)**.
7. **ATLASUL** — harta emoțională finală + instrumentele de cartograf + export PDF.

IA per tab = un mod, nu 7 aplicații. Toate taburile scriu în același store local (vezi §12).

---

## 5. Roata + Cartea emoției

### Roata (mecanică)
- 8 segmente (teritorii), fiecare cu 3 inele concentrice (nuanță / emoție / extrem) = 24 de ținte.
- Tap pe oricare → **Cartea emoției** (modal/panou lateral pe desktop, fullscreen pe mobil).
- Segmentele vecine = amestecuri: o secțiune „Când stau alături" arată blend-urile
  (bucurie + trust = dragoste; frică + anticipare = îngrijorare etc.).
- Pe burla (coordonate valență/arousal) roata e proiectată; utilizatorul vede „de ce stau aici".

### Cartea emoției (structură fixă, 12 secțiuni)

Exemplu: **FRICĂ**

1. **Ce este?** — definiție clară, 1–2 rânduri, pe înțelesul tuturor.
2. **Cum se anunță în corp?** — semnale tipice (tensiune, ritm cardiac, vigilență, impuls de retragere) + **body map** interactiv (tap pe zone: piept, gât, stomac, mâini, umeri) — „multe persoane raportează…".
3. **Ce gânduri vin cu ea** — exemple („Nu voi putea face față."), etichetate ca exemple, nu ca adevăr.
4. **Ce impuls apare** — fug / evit / mă protejez / cer ajutor.
5. **Ce încearcă să facă pentru tine** — funcția (pregătire pentru pericol), formulată „adesea semnalează".
6. **Când e aliată** — ex. frică de drum = atenție; deadline = mobilizare.
7. **Când devine prea grea** — semnale practice (interferează cu viața, durată, intensitate crescută) + „aici e momentul pentru un specialist".
8. **Emoții vecine** (din roată) + **Nu e același lucru cu** — diferențiere explicită
   (frică ≠ anxietate: frică = prezent/clar, anxietate = anticipat/difuz; frică ≠ panică: intensitate + senzație de pierdere a controlului).
9. **Declanșatoare frecvente** — liste scurte, marcate „frecvent raportat".
10. **O reacție posibilă** — 1 micro-exercițiu de 60 s (ex. „respiră 4-4-4 de 3 ori și observă unde se așază frica în corp").
11. **Întrebare pentru tine** — „De ce crezi că apare acum?" (niciodată „ce simți tu de fapt").
12. **Cercetare** — 2–4 surse reale + 1 rând de onestitate („ce știm / ce nu știm").

Reguli de copy: **nu se spune utilizatorului ce simte**; nu se interpretează; nu se diagnostichează;
metoforele sunt etichetate; fiecare card se încheie cu *„Aceasta e o hartă a teritoriului, nu teritoriul însuși."*

---

## 6. Modulurile solo

### 6.1 METEO — „Ce cer e în tine azi?" (mecanica de 10 secunde)
Un tap de bază: **cer** (1–3 emoții de pe roată) + **forța** (0–10) + **unde în corp** (opțional, body map).
Istoric zilnic → „raport de meteo" al săptămânii, construit automat:
- cele mai frecvente ceruri; intensitatea medie; patternul zilelor (luni vs. vineri);
- ce emoții se amestecă (mixed); ce emoții apar rar sau niciodată (evitate/ascunse);
- **discrepanța etichetă vs. corp**: utilizatorul a scris „mă simt ok" dar a tapat piept/gât tensionat → întrebare blândă, nu constatare.
Fără note, fără scor, fără „fericități câștigate". Doar hărți.

### 6.2 EXPEDIȚII — core loop-ul (6 bătăi, 3–5 minute)

```
1. SITUAȚIA      card neutru, fără răspuns corect (60+ situații: job, relații, bani, corp, viitor, grup)
2. METEUL         1–3 emoții + intensitate 0–10 (mixed ca regulă implicită)
3. CORPUL         body map: unde se așază? (1 tap, opțional dar încurajat)
4. NUMELE + GÂNDUL  alegi eticheta precisă din listă de 5–7 vecine + „ce ți-a trecut prin cap?" (preseturi + liber)
5. REACȚIA        alegi 1 din 5 răspunsuri (impuls / rămân și observ / fac altceva / vorbesc / evit)
                   → arătăm consecințele tipice, formulate neutru: „ce se întâmplă de obicei" + „ce înveți din asta"
6. CÂMP DE JURNAL  1 minut: „Ce m-a surprins la mine?" + opțional „Un pas mic pentru data viitoare"
```

De ce 6 bătăi și nu 10 (din notițe): fiecare pas în plus scade completarea cu ~15–20%;
6 bătăi păstrează tot ce contează (observ → numesc → localizez → înțeleg → aleg → reflectez).
Situatiile sunt **replayable**: biblioteca e mare, iar „următoarea expediție" e 1 tap.

### 6.3 MUZEUL DOVEZILOR + „Dovezi vs. Povestea"
- **Muzeul Supraviețuirii**: fiecare lucru dificil făcut (încercat ceva greu, am suportat disconfortul,
  am cerut ajutor, am reparat o greșeală, am spus nu, am avut o conversație grea, am făcut ceva deși mi-era frică)
  devine un **artefact** cu etichetă: dată, situație, frica 0–10, ce am făcut. Muzeul nu arată eșecuri.
- **Dovezi vs. Povestea** (impostor): stânga = ce s-a întâmplat obiectiv; dreapta = ce poveste spun eu.
  Mecanică de tip detectiv: utilizatorul pune 2–3 perechi (dovede / poveste), iar sistemul sugerează
  **numele distorsiunii** din literatură (filtru, citire în gând, predicție, personalizare, catastrofizare)
  ca întrebare, nu ca verdict: „Aceasta seamănă cu *filtru*. Recunoști patternul altundeva?"
- Ancorare: Bandura (mastery = sursa #1 de self-efficacy) + Clance & Imes (impostor) + Beck (distorsiuni).

### 6.4 FRONTERA — fricile + scara curajului + **prediction tracker** (mecanica-killer)

Harta fricilor: utilizatorul introduce/selectează frici (vorbit în public, respingere, eșec, critică,
conflict, evaluare, necunoscut…). Fiecare frică devine un **lanț** pe care îl completează o dată:

```
SITUAȚIE → PREDICȚIE („O să mă fac de râs.") → EMOȚIE + INTENSITATE → SENZAȚIE → IMPULS → EVITARE → CONSECINȚĂ pe moment → CONSECINȚĂ pe termen lung
```

Sistemul explică **negative reinforcement** (evitarea reduce disconfortul imediat → întreține frica),
cu hedging onest, apoi:

**Scara curajului** (0–10, utilizatorul plasează situațiile) + mecanismul cheie, care înlocuiește
„a fi curajos" cu **learning real** (Craske 2008/2014):

```
PASUL: „Să trimit un email dificil" (cota 4/10)
1. PREDICT: frica 7/10 · „Ce cred că se va întâmpla?" (scrie)
2. ACȚIUNE: face pasul (sau alege conștient să nu-l facă — și notează de ce)
3. ÎNTREABĂ-TE: frica a fost… (0–10) · Ce s-a întâmplat de fapt?
4. SISTEMUL ARAȚĂ GAP-UL: „Ai prezis 7/10. A fost 4/10. Predicția ta a greșit cu 3 puncte —
   asta e învățarea nouă, nu curajul."
```

**Regula produsului:** „Pot să simt frica și să rămân prezent." — niciodată „Trebuie să scap de frică."
+ **limita clinică explicită**: pentru fobii/anxietate clinică → „aici e terenul unui psiholog/psihoterapeut";
nu pretindem tratament nicăieri.

### 6.5 LOCUITORII — desenul + personajele

**„Dacă emoția ta ar fi o creatură, cum ar arăta?"** — canvas simplu (traseu liber, culori, ștergere,
salvare PNG local, fără filtre). Post-desen: 8 întrebări structurate (formă? culoare? unde stă? cât de mare?
se apropie sau se îndepărtează? ce vrea? de ce se teme? ce protejează?).

**Regula absolută:** desenul NU e interpretat automat. Nu există niciun text de tip „monstrul tău înseamnă…".
Desenul e **externalizare** — un obiect cu care poți vorbi. Fiecare desen salvat devine un **locuitor**
(galerie: creaturile mele).

**Conversația cu personajul** — fără AI, determinist, în 3 runde (coerent cu produsul, fără servicii externe):
1. Personajul (script, ex. FRICA: „Eu încerc să te protejez.")
2. Utilizatorul răspunde liber la „De ce crezi că ai apărut?"
3. Personajul: „Ce s-ar întâmpla dacă ai face lucrul de care te temi?" → utilizatorul răspunde →
4. Închidere: „Ce alegi să faci cu ce ți-am spus?" (emoție ≠ comandă — secțiune explicită:
   „Poți să simți ceva fără să acționezi conform impulsului. Emoția ≠ comandă.")

Formulările personajelor sunt etichetate: *„Aceasta e o metaforă, nu un mecanism universal al minții."*

### 6.6 ATLASUL FINAL — „Harta mea emoțională"

Generat din tot ce s-a înregistrat, ca **instrument de reflecție** (nu profil psihologic):
- Cerurile mele frecvente · Cerurile pe care le arat ușor · Ce identific greu
- Situațiile care mă activează · Cum evit, de obicei · Ce îmi e frică
- **Dovezile că pot face față** (muzeul) · Gap-ul predicție→realitate (frontiera)
- **Următoarea mea acțiune** (1 pas mic, scris de utilizator, cu dată opțională)
Export: **PDF printabil** + JSON personal (ca exportul existent de room) + „imprimă-te pe un A3" (variantă hârtie).

### 6.7 EMOȚII MIXTE — mecanică transversală

Nu un modul separat — **regula implicită a produsului**: orice înregistrare acceptă 1–3 emoții.
Harta mixturilor: o vizualizare dedicată în Atlas — „Când simt X, apare de obicei și Y"
(matrice de co-ocurență din datele proprii). Exemplu ghidat: „Plec dintr-un job" →
frică + ușurare + tristețe + entuziasm + vinovăție — afișate împreună ca o compoziție, nu ierarhizate.

---

## 7. CAMERA MARE — modul echipă (diferențiatorul)

Reutilizează roomurile existente (code, host, etape) cu o **activitate nouă: `emotions`**.

### Fluxul de sesiune (facilitator controlează, ca la Coaching)

```
LOBBY → BRIEF (reguli + siguranța camerei) →
  METEO DE PORNIRE: „Ce cer e în tine chiar acum?" (fiecare votează privat, 1 tap)
  → ecranul arată METEUL CAMEREI la start (bară per emoție + valență medie)
→ PLAY: facilitatorul alege situații din bibliotecă de grup (30+, orientate pe locul de muncă:
   feedback dur, promovarea colegului, conflict, lăudat în public, eșec vizibil, sarcină nouă,
   ședință tensionată, recunoaștere, limită încălcată…)
  Fiecare rundă:
    1. Facilitatorul citește situația (text pe ecran, opțional citit tare)
    2. Fiecare participant: 1–3 emoții + intensitate 0–10 + (opțional) „Cine vorbește în tine?" = arhetip
    3. PRIVATE until reveal (ca Team Compass)
  → REVEAL: ecranul mare arată distribuția anonimă:
       „SITUAȚIE: Un coleg primește promovarea pe care ți-o doreai."
       frică 2 · tristețe 3 · invidie 1 · bucurie pentru el 4 · ușurare 1 · dezamăgire 1
       „Aceeași situație. 6 ceruri diferite."
  → DEBRIEF: prompturi ghidate („De ce crezi că doi colegi simt opusul?
       Ce ar ajuta pe cel care simte X? Ce ai spus cu voce tare vs. ce simțeați?")
→ (opțional) MUZEUL ANONIM AL CAMEREI: fiecare poate lăsa 1 rând:
   „O dată am…" (o dovadă scurtă, anonimă, opt-in, host-ul poate filtra)
   → sursa vicarious-efficacy (Bandura sursa #2)
→ METEO DE FINAL: „Ce cer e în tine acum?" → ecranul arată **delta** (start vs. final)
→ HARVEST: Observed / Learned / Try Next + action items (board-ul existent, fără modificări)
→ EXPORT: raport de meteo al camerei (anonim, agregat, PDF/JSON)
```

### Ce faceCamera Mare special (vs. orice app de emoții)
- **Reveal-ul anonim agregat** = lecția centrală: interpretare, context, diferențe individuale —
  aceeași situație produce ceruri diferite, vizibil live, fără nimeni expus.
- **Meteo de pornire vs. final** = echipea își vede propria mișcare în 2 secunde.
- **Muzeul anonim** = dovezile altora, fără expunere.
- **Harvest existent** = „pleci cu o decizie", exact promisiunea produsului.

### Siguranța camerei (hard)
- În BRIEF: regulile camerei (privat până la reveal, fără obligația de a participa — „Pas" e un buton valid,
  anonim, numărat ca mișcare legală; fără obligația de a explica de ce ai ales ce ai ales).
- Facilitatorul: poate **dezactiva teme grele** din bibliotecă, **pauză de cameră**, **schimbă situația**,
  **„cuvânt de siguranță"** opțional (orice participant îl apasă → pauză + ecran cald),
  resursele de criză vizibile pe ecranul de pauză.
- Revealul arată **numere, nu nume**. Intotdeauna.

---

## 8. CURTEA INTERIOARĂ — zona de arhetipuri

8 arhetipuri, fiecare ancorat într-un sistem emoțional (Panksepp) și într-o familie Plutchik.
**Etichetare obligatorie în UI:** *„Arhetipurile sunt o metaforă pentru sistemele emoționale
și pentru „partea" care vorbește în tine — un instrument de reflecție, nu o tipologie validată."*

| Arhetipul | Sistem / familie | Afirmarea (1 linie) | Când e util | Când preia prea mult |
|---|---|---|---|---|
| **Gardianul** (protectorul) | FEAR / frică | „Încerc să te protejez de pericol." | atenție, pregătire, limite | catastrofizare, paralizie |
| **Apărătorul** | RAGE / furie | „Nu las să-ți fie încălcat ce contează." | limite, dreptate, energie | explozii, răzbunare |
| **Plângătorul** | PANIC/GRIEF / tristețe | „Te ajut să accepti ce s-a pierdut." | procesare, încremenire, adâncime | izolare, renunțare |
| **Sărbătoritorul** | PLAY / bucurie | „Marchez ce merită repetat." | energie, conexiune, motiv | neglijare a riscurilor |
| **Ținătorul de apartenență** | CARE / trust | „Te țin aproape de grup." | relații, cooperare | plăcătoare, da-automat |
| **Exploratorul** | SEEKING / anticipare | „Te împing spre necunoscut." | curaj, învățare, dorință | impulsivitate, plictis cronic |
| **Criticul** | (meta) rușine | „Te avertizez să nu fii văzut imperfect." | standard, grijă la detalii | impostor, ascundere, auto-sabotare |
| **Observatorul** | (meta) surprindere | „Te opresc și deschid o ușă nouă." | re-orientare, atenție | șoc, pierdere a firului |

Fiecare arhetip are card: afirmare, funcție („adesea semnalează"), corp tipic, frica lui,
„ce i-ai spune", întrebare de reflecție. Mecanicile:

- **Solo:** „Cine vorbește în tine săptămâna asta?" — utilizatorul alege 1–2 arhetipuri dominante
  + 1 pe care l-ar evita → apare în Atlas („Curtea mea").
- **Echipă (Camera Mare):** la fiecare situație, votul include (opțional) arhetipul →
  revealul arată și **Curtea camerei**: „În această situație, în 4 din voi vorbea Gardianul,
  în 3 Exploratorul, în 1 Criticul." — lecție despre interpretare, la nivel de „parte", nu doar de emoție.

De ce arhetipurile țin în produs: (1) leagă desenul/personajele de o grilă structurală;
(2) fac debrief-ul de echipă concret („nu discuți despre „emoții", discuți despre Cine a vorbit");
(3) dau o limbă comună facilitatorilor — exact publicul produsului.

---

## 9. Situații și exerciții (volumul v1)

- **60+ situații solo** (expediții): 8 categorii × ~8 (loc de muncă, relații apropiate, bani, corp/sănătate,
  viitor, grup/social, recunoaștere/evalutare, limită/conflict) — neutre, RO/EN, fără răspuns corect.
- **30+ situații de grup** (Camera Mare): orientate pe echipă/loc de muncă + 6 „neutre" pentru orice grup.
- **20+ micro-exerciții** de 60 s (încorporați în carduri: respirație, body scan, 1 pas mic,
  re-etichetare, scris de 3 rânduri, „ce i-aș spune unui prieten" — self-compassion Neff, fără jargon).
- **8 arhetipuri** cu carduri complete.
- **24 de carduri de emoții** (8 familii × 3 niveluri, fiecare cu spectru de 8 trepte) + **11 blend-uri** (mixturile principale).

---

## 11. Progres FĂRĂ XP: „Instrumentele de cartograf"

Niciun punct, nicio medalie, niciun „ai câștigat bucurie". Progresul e **calitativ + măsurabil onest**:

**Instrumente deblocate prin completarea adevărată a funcțiilor** (o dată, persistent):
| Instrumentul | Se deblochează când | Ce face |
|---|---|---|
| Busola | prima expediție completă | afișează valență/arousal pe hartă |
| Barometrul | 5 meteo înregistrate | intensitate + istoric |
| Caietul de teren | 3 câmpuri de jurnal | jurnalul complet |
| Telescopul | 10 expediții | patternuri (frecvențe, co-ocurențe, zile) |
| Teodolitul | 5 etichetări fine (granularity: ai ales varianta specifică, nu generică, de 5 ori) | „precizia ta lexicală" |
| Cheia de muzeu | 3 artefacte în muzeu | muzeul + dovezile |
| Marcatorul de frontiere | 1 pas completat pe frontiera (cu gap) | prediction tracker |

**3 „precizii" afișate în Atlas (date ale utilizatorului, nu scoruri):**
- **Granularitate:** „Ai folosit 23 de etichete diferite. Preferința ta: *dezamăgire* în loc de *mă simt prost*."
- **Gap predicție→realitate:** „De 4 ori ai prezis frica mai mare decât a fost. De 1 dată — mai mică."
- **Prezență:** „De 3 ori ai rămas cu disconfortul în loc să eviți."

Tonul: instrumente, nu recompense. Utilizatorul devine **mai precis hărțuitor**, nu **mai punctat**.

---

## 10. Stratul de siguranță (hard requirement, nu copy)

1. **Butonul „Calm"** vizibil permanent pe tot `/emotii` (1 tap): ecran cald — respirație 4-4-4 (ghid vizual),
   „poți închide oricând", resurse: „vorbește cu cineva de încredere / psiholog / 112 / TelVerde anti-suicid ARPS 0800 801 200 (vin–dum 19:00–07:00 — verifică numărul actual pe antisuicid.ro înainte de release)".
2. **Skip / Pauză / Oprire** la fiecare expediție, la fiecare pas de frontiera, la fiecare desen.
   Skip nu e pedepsit nicăieri (nu există scor).
3. **Avertizare la intensitate 8–10** + teme sensibile (pierdere, singurătate, conflict sever, auto-critică severă):
   întrebare blândă, o dată, nu insistent: „Aici poate fi greu. Vrei o pauză, vrei să sari, sau rămâi?"
4. **Declarația de non-terapie** — vizibilă pe landing-ul zonei + în footer + la primul pas de frontiera:
   „CARTOGRAF e un instrument de reflecție. Nu diagnostichează, nu tratează, nu înlocuiește psihoterapia.
   Pentru frici intense sau suferință persistență, lucrul cu un psiholog/psihoterapeut e calea."
5. **Camera Mare:** reguli de confidentialitate + „Pas" valid + pauză de cameră + cuvânt de siguranță +
   resurse pe ecranul de pauză + tema „grele" dezactivabilă de host.
6. **Date:** local-only (localStorage), fără conturi, fără tracking; export = fișierul utilizatorului.
7. **Copy:** niciodată „simți X", „subconștientul tău", „diagnostic", „tu ești Y"; întotdeauna întrebări.

---

## 12. Integrarea concretă în aplicație

**Landing:** secțiune nouă (pe lângă features existente), card „CARTOGRAF — zona de emoții",
2 CTA-uri: „Începe atlasul tău" (→ `/emotii`) + „Jocul în cameră" (→ create room cu activitate `emotions`).
Fotografie/branding în paleta existentă (azure/pink/purple, suprafețe dark navy).

**Router** (`src/lib/router.ts`): adaugă `{ name: "emotions" }` pentru `/emotii`.

**Date noi** (pattern-ul `shared/*.json` + endpoint, ca `coaching.json`):
- `shared/emotions-taxonomy.json` — 24 carduri + 11 blend-uri; schema:
  `{ id, family, level (1|2|3), name: {ro,en}, def: {ro,en}, body: string[], thoughts: string[],
    impulses: string[], function: {ro,en}, usefulWhen: {ro,en}, heavyWhen: {ro,en},
    near: string[], notSameAs: {ro,en}, triggers: string[], valence: -5..5, arousal: -5..5,
    microExercise: {ro,en}, research: [{title, year, source, note}], caveat: {ro,en} }`
- `shared/emotions-situations.json` — `{ id, mode: "solo"|"room", category, text: {ro,en},
  heavy: bool, debriefPrompts?: [{ro,en}] }`
- `shared/emotions-archetypes.json` — 8 arhetipuri cu cardul complet.
- `GET /api/emotions` → servește toate (ca `GET /api/coaching`).

**Room mode:** activitate nouă `emotions` în room (etape existente; voturi private server-authoritative
până la reveal, ca Team Compass; reveal = agregat anonim; host poate face skip/pauză/teme).
Snapshot de room include voturile emoțiilor.

**Frontend nou:** `src/pages/EmotionsPage.tsx` + `src/emotions/*`
(Wheel, EmotionCard, Compass, WeatherStation, BodyMap, Expedition, Frontier, PredictionTracker,
Museum, ImpostorGame, DrawingCanvas, Inhabitants, Court, AtlasView, CalmScreen) + componenta room
`src/puzzle/EmotionsActivity.tsx` + buton „Calm" global în pagina de emoții.

**Store:** `src/emotions-store.ts` (localStorage, versionat, exportabil JSON).

**i18n:** tot RO/EN (pattern-ul `Bilingual` existent). **A11y:** culoare niciodată singurul indicator
(icon + text, ca la team colors existente), keyboard navigare pe roată, contrast AA, text minim 14px.

**Teste (convențiile repo-ului):** protocol tests pentru room mode emotions (vot privat/reveal anonim/skip/pauză/reconnect),
typecheck + build curate, `npm run test:protocol` complet verde, Playwright unde e runtime disponibil.

---

## 13. Testarea critică a ideilor inițiale (ce se corectează și de ce)

1. **„Scara curajului = scap de frică"** → înlocuit cu **prediction tracker** (inhibitory learning,
   Craske): ținta e **învațarea nouă** (gap predicție→realitate) și prezența, nu eliminarea fricii.
2. **„Toate modelele emoțiilor sunt echivalente"** → nu sunt. Arhitectură hibridă explicită
   (Plutchik schelet + Russell orientare + Barrett epistemă), justificată în plan, limite declarate.
3. **„XP"** → înlocuit cu **instrumente + precizii** (granularitate, gap, prezență). Punctele gamifică lucrul greșit.
4. **„Desenul = detector al subconștientului"** → (în notițe ai dreptate să-l excluzi) → desenul e
   **externalizare**; zero interpretare automată în UI.
5. **„Vreau mai puțină frică, nu mai multă încredere"** → parțial corect, dar mecanismul real e
   **tolerare + apropiere flexibilă** (ACT). Jocul A/B/C/D se păstrează; B = „suprimare",
   etichetat cu dovada ironic-process (Wegner) — experiența demonstrează, nu morala.
6. **„Fiecare emoție are o meserie"** → păstrat, dar formulat ca **hipotereză funcțională**
   („adesea semnalează"), nu ca lege universală; arhetipurile sunt metaforă etichetată.
7. **10 pași de game loop** → comprimat la **6 bătăi** (completare reală vs. profunzime aparentă);
   profunzimea rămâne în cardurile de emoție și în Atlas, nu în fiecare rundă.
8. **Lipsa mare din notițe: „together"** → adăugată Camera Mare (reveal anonim, meteo de cameră,
   muzeu anonim, harvest) — e exact locul unde PuzzleTogether câștigă diferențiere.

---

## 14. Faze de livrare (MVP → complet)

| Faza | Conținut | Acceptanță (măsurabil) |
|---|---|---|
| **0 — Fundație** | Taxonomie 24+11, 60+30 situații, 8 arhetipuri, `research-sources.md` | JSON valid, bilingv, fiecare emoție cu ≥10 câmpuri populate; 0 afirmații fără sursă |
| **1 — Harta + Cartea** | Roata interactivă + 24 carduri + burla | Tap pe orice emoție → cardul complet, RO/EN, offline |
| **2 — Meteo + Expediții** | Meteo zilnic + loop 6 bătăi + body map + 20 expediții | 3 expediții consecutive fără fricțiune; Atlas se actualizează |
| **3 — Frontiera + Muzeul** | Frici + ladder + prediction tracker + muzeu + Dovezi vs. Povestea | 1 ciclu complet de ladder (predict→act→record→gap); 1 artefact; 1 pereche dovede/poveste |
| **4 — Camera Mare** | Activitate `emotions` în room: vot privat, reveal agregat, meteo start/final, debrief prompts, muzeu anonim, harvest, panel facilitator + siguranță | 2-client test verde; reveal fără nume; host poate skip/pauză; resurse vizibile |
| **5 — Atlasul + Instrumentele** | Atlas final + 7 instrumente + 3 precizii + export PDF/JSON | PDF printabil cu ≥6 secțiuni; export JSON valid |
| **6 — Desenele + Locuitorii** | Canvas desen + 8 întrebări + galerie + conversația în 4 runde (script) | Desen salvat local + 5 răspunsuri; zero texte de „interpretare" |
| **7 — Curtea interioară** | 8 arhetipuri solo (quiz „cine vorbește") + vot arhetip în Camera Mare | Solo: 1–2 dominanțe; Room: reveal arhetipuri agregat |
| **8 — Polish** | A11y, copy RO/EN, perf, QA gate (convenția `docs/qa-report.md`) | Typecheck+build+protocol 100%; a11y checklist; 0 P0/P1 |

**MVP-ul testabil (faze 0–4)** = tot ce trebuie pentru sesiunea cu echipa de testare + Camera Mare live.

---

## 15. MVP pe hârtie (10 oameni, fără aplicație)

Pentru testare în cameră (detaliul complet în `03-PLAN-TESTARE-ECHIPA.md`):
- **Materiale:** 8 foi A0 (zonele emoțiilor: culoare + iconiță + nume + 1 linie funcție),
  20 cartonașe cu situații, 10 stickere colorate per persoană, flipchart, timer, foaie de „harvest".
- **Flux (60 min):** brief + reguli (5 min) → 4 situații × (citește → mergi în zona ta → 1 întrebare) (32 min)
  → meteo de final pe stickere (3 min) → debrief + harvest Observed/Learned/Try Next (20 min).
- **Reguli:** fiecare poate merge în 1–2 zone (mixte), „pas" e permis, nimeni nu e obligat să explice,
  facilitatorul nu interpretează, nu există răspuns corect.
- **Obiectiv:** validăm reveal-ul („aceeași situație, ceruri diferite") și tonul — înainte să scriem o linie de cod de front-end.

---

## 16. Riscuri, limite, efecte adverse

| Riscul | Mitigare |
|---|---|
| Utilizatorul se simte **diagnosticat** | zero limbaj de profil; toate outputurile „oglindă, nu verdict"; test explicit în sesiune |
| **Cringe** / ton de self-help | copy scurt, pe întrebări, fără „crede în tine"; cringe-meter în testare (țintă 0) |
| Activare a amintirilor greu | strat de siguranță §10; temele „grele" marcate + skipabil; Camera Mare: temele grele dezactivabile |
| Extrapolare clinic → non-clinic | fiecare mecanică cu „limite" explicite; declarația de non-terapie; trimiterea la specialist la intensitate 8–10 |
| Datele emotionale sunt private | local-only, fără conturi, fără tracking, export = utilizatorului |
| Conținut științific greșit | `research-sources.md` cu status per afirmație; ce nu e verificat, nu publicăm |
| Supraîncărcare cognitivă (7 taburi) | onboarding în 2 minute; fiecare tab are un „pas de start" unic; instrumentele deblochează treptat |
| Room mode: expunerea în fața colegilor | vot privat, reveal anonim agregat, „Pas" valid, cuvânt de siguranță, confidențialitate în brief |

---

## 17. KPI-uri v1 (măsurate în sesiunea de testare + 1 săptămână după)

- ≥ 3 expediții completate de utilizatorul solo, într-o sesiune.
- ≥ 1 „aha" per utilizator: „a apărut ceva despre mine ce nu observam" (self-report).
- **0** utilizatori care raportă „m-am simțit diagnosticat/judecat".
- SUS ≥ 70 (usabilitate).
- Camera Mare: ≥ 70% concordă cu „aceeași situație a produs emoții diferite".
- Siguranța: butoanele skip/pauză/calm accesibile în ≤1 tap din orice ecran; testate în sesiune.
- Readmitere (1 săptămână): „ai revenit? de ce / de ce nu?" — calitativ.

---

## 18. Ce se livrează acum (acest set de documente)

1. **Acest plan** (`01-PLAN-COMPLET.md`) — concept, arhitectură, module, integrare, faze, riscuri.
2. **Promptul de execuție** (`02-PROMPT-EXECUTARE.md`) — gata de rulat; faze 0–4 = MVP.
3. **Planul de testare cu echipa de 5–15 oameni** (`03-PLAN-TESTARE-ECHIPA.md`) — script de sesiune,
   framework de feedback (mi place / nu mi place / e mid), arhetipurile în test, reguli de decizie.

**Următorul pas:** rulează `02-PROMPT-EXECUTARE.md` (fazele 0–4), apoi rulează sesiunea de testare
cu echipa înainte de fazele 5–8.
