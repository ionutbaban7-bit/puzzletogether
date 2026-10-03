# Gamification pentru PuzzleTogether

Analiză și implementare: 2026-10-03. Scope: jocul jigsaw existent, până la 25 de jucători simultan și un facilitator care observă.

## Repere relevante

Am comparat produse din categoria jigsaw. Descărcările mobile, recenziile Steam și utilizarea în browser măsoară lucruri diferite; lista este o selecție de repere, nu un clasament global verificat.

| Produs / sursă primară | Ce documentează | Ce folosim la noi |
| --- | --- | --- |
| [Jigsaw Puzzles — Easybrain, Google Play](https://play.google.com/store/apps/details?id=com.easybrain.jigsaw.puzzles) | 100M+ descărcări; alegerea imaginii, dificultate prin numărul de piese, ajutor la nevoie. | Imaginea și dificultatea alese înainte de joc; instrumentele de ajutor existente. |
| [Jigsaw Explorer — multiplayer](https://www.jigsawexplorer.com/multiplayer-jigsaw-puzzle-games/) | Link + nume, tablă comună, intrare într-un joc început, salvare/reconectare; maximum 20 de persoane active. | Acces simplu, progres comun și reluare sigură. Capacitatea noastră: 25 de jucători + un observator. |
| [JigsawPuzzles.io — changelog oficial](https://jigsawpuzzles.io/change-log) | Regula documentată în martie 2020: un punct pentru o piesă fixată pe tablă; scorurile pot fi ascunse. În 2023 documentează scor actualizat în timp real și îmbunătățiri pentru reconectare și consum de resurse. | Scor simplu verificat de server; podium opțional doar la final. Nu tratăm limitele istorice din changelog ca limite curente. |
| [Puzzle Together — IronZog, Steam](https://store.steampowered.com/app/1478220/Puzzle_Together/) | Puzzle în cooperare, fotografii proprii și sortarea pieselor după margini/culoare. Este un produs diferit de proiectul nostru. | Fotografii proprii și ajutor la sortare. Sunt deja disponibile în V2. |

Acestea sunt mecanici observate, nu dovezi că fiecare mecanică provoacă retenție sau că un produs este bun în toate privințele. De exemplu, pagina Steam are recenzii generale favorabile și recenzii recente negative la data verificării; folosim funcțiile relevante, nu un scor de popularitate ca verdict de calitate.

## Decizia de produs

Bucla de bază: **alege → invită → construiește împreună → vezi rezultatul → joacă din nou**. Obiectivul este terminarea aceleiași imagini. Progresul, timpul și finalul aparțin grupului.

| Funcție implementată | Regula |
| --- | --- |
| 25 de jucători + facilitator | Observatorul are un loc separat și nu mută piese. Gazda care joacă ocupă unul dintre cele 25 de locuri. Rezervările de intrare și reconectările respectă aceeași limită. |
| Progres imediat | Contor și bară comună pentru piesele corect fixate. Interacțiunea existentă arată imediat potrivirea piesei. |
| Timpul echipei | Calculat pe server; pauzele nu se numără. Interfața interpolează cu un ceas monoton, fără a depinde de ora setată pe telefon. Timpul final se oprește. |
| Facilitare | Start în lobby, pauză/continuare pentru toți, invitație și participanți, eliminare/revocare și preluarea gazdei după plecare. Pauza este direct în bara jocului. |
| Podium opțional | Dezactivat implicit; ales la creare și anunțat înainte de rundă. Apare după finalul comun. Nu există clasament vizibil care concurează cu tabla în timpul jocului. |
| Scor | O piesă nou fixată corect = un punct pentru persoana care o fixează. Mișcarea, anularea, repetarea unei plasări și intrările observatorului nu dau puncte. |
| Egalități | Ranguri de competiție: 1, 1, 3. Toți cei cu același scor primesc același loc; 0 piese nu acordă loc pe podium. Lista tuturor contribuțiilor include și participanții cu 0 piese. |
| Continuitate | Intrarea în timpul rundei este permisă. Contribuția și numele unui participant nu dispar la deconectare. Modul, progresul și contribuțiile supraviețuiesc unui restart pe același disc. |
| Rundă nouă | Replay păstrează camera, grupul conectat, imaginea și opțiunea de podium; reinițializează tabla, scorul și timpul. Schimbarea imaginii revine în lobby. Deadline-ul fotografiei nu se prelungește. |
| Dificultate | 12/25 pentru jocuri scurte, 64/100 pentru mai multă muncă, 144/192 pentru grupuri mai mari. Formularul explică ultimele două opțiuni. Durata potrivită se validează cu grupuri reale. |

Podiumul măsoară piese fixate, nu ajutorul dat altora, comunicarea sau calitatea colaborării. Este potrivit pentru o provocare amicală; protocolul nu este un sistem de anti-cheat pentru turnee. Pentru o sesiune facilitată, gazda explică scopul și alege de la început dacă dorește podium.

Nu adăugăm economii cu monede, streak-uri, conturi, misiuni zilnice sau badge-uri pentru fiecare acțiune. Nu sunt necesare pentru această buclă. Eventuale runde cronometrate cu limită sau puzzle-uri de peste 192 de piese se decid după pilot, când știm durata și blocajele reale ale unei sesiuni cu 25 de persoane.

## Verificare

- `npm run test:gamification`: opțiune implicită, puncte valide, egalități, excluderea observatorului, pauză/timp, participanți intrați târziu/deconectați, replay și autorizare.
- `npm run test:load`: 25 de clienți autentificați + observator, 192 de piese, 1.500 cadre de mișcare + 500 mesaje cursor; verifică starea finală identică, punctele, timpul, coliziunile și capacitatea inclusiv la reconectare.
- `npm run test:restart`: include modul de podium și contribuțiile după un restart real.
- `npm run test:e2e`: include creare cu facilitator/podium, 25 de participanți vizibili, două browsere și 24 de clienți protocol, egalități la final, lista contribuțiilor, RO/EN și ecrane înguste; ora telefonului este decalată cu 3h pentru verificarea ceasului.

Măsurătorile sunt locale. Nu certifică 25 de telefoane fizice, rețele de internet diferite, latența hostingului sau durata unei sesiuni de echipă. Acestea rămân în verificarea de lansare.
