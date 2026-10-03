# Repere recognoscibile pentru puzzle

Actualizat: 2026-10-03. Catalogul activ are **48 de imagini**. Colecția inițială „Repere cunoscute” reunește **24 de repere**, inclusiv cele 12 adăugiri de mai jos. Celelalte categorii și toate imaginile rămân disponibile prin selector. Titlurile sunt în română și engleză.

Adăugirile sunt din domeniul public sau oferite explicit prin CC0. Nu reclasificăm imaginile existente cu licențe CC BY / CC BY-SA ca fiind în domeniul public. Sursa, autorul, licența, URL-ul politicii, data verificării și modificările tehnice sunt păstrate în `data/catalog/sources.json`; dovezile pentru acest lot sunt în `data/catalog/public-domain-anchors.json`.

| Imagine adăugată | Asociere posibilă pentru un grup | Sursă |
| --- | --- | --- |
| Floarea-soarelui — Van Gogh | Bucurie, vitalitate | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Vincent_van_Gogh_-_Sunflowers_(1888,_National_Gallery_London).jpg) |
| Crearea lui Adam — Michelangelo | Legătură, creație | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:The_Creation_of_Adam_perspective_fix.jpg) |
| Nașterea lui Venus — Botticelli | Frumusețe, început | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg) |
| Libertatea conducând poporul — Delacroix | Libertate, curaj | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Eug%C3%A8ne_Delacroix_-_La_libert%C3%A9_guidant_le_peuple.jpg) |
| Gotic american — Grant Wood | Identitate, rădăcini | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg) |
| Călător deasupra mării de ceață — Friedrich | Perspectivă, necunoscut | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg) |
| Dormitorul din Arles — Van Gogh | Acasă, odihnă | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Vincent_van_Gogh_-_Van_Gogh%27s_Bedroom_in_Arles_-_Google_Art_Project.jpg) |
| Fuji roșu — Hokusai | Natură, stabilitate | [The Met, obiect 55736](https://www.metmuseum.org/art/collection/search/55736) |
| Gânditorul — Rodin | Reflecție | [The Met, obiect 191811](https://www.metmuseum.org/art/collection/search/191811) |
| Răsăritul Pământului — Apollo 8 | Planeta comună, perspectivă | [NASA, AS08-14-2383](https://www.nasa.gov/image-article/apollo-8-earthrise/) |
| Urma pe Lună — Apollo 11 | Un pas nou, explorare | [Wikimedia Commons / NASA](https://commons.wikimedia.org/wiki/File:Apollo_11_bootprint.jpg) |
| Primul zbor — Frații Wright | Îndrăzneală, inovație | [Library of Congress, 00652085](https://www.loc.gov/item/00652085/) |

Asocierile sunt propuneri editoriale, nu semnificații universale sau rezultate psihologice demonstrate. Interfața prezintă imaginile și titlurile; grupul își poate construi propriile asocieri.

## Verificarea surselor

- Reproducerile din Commons au `Copyrighted=False` și `LicenseShortName=Public domain`; paginile indică temeiul pentru lucrare și reproducere. Imaginile de la The Met sunt marcate `isPublicDomain=true`, în politica [Open Access / CC0](https://www.metmuseum.org/hubs/open-access).
- Pentru Gotic american, API-ul curent al Art Institute of Chicago are încă `is_public_domain=false`. Nu pretindem o ofertă CC0 de la AIC: folosim reproducerea din Commons. [Duke Center for the Study of the Public Domain](https://cspd.law.duke.edu/publicdomainday/2026), care trimite și la arhiva AIC, confirmă intrarea lucrării în domeniul public în SUA în 1958 din cauza nereînnoirii. Grant Wood a murit în 1942; termenul de viață + 80 de ani a expirat.
- Earthrise este fotografia oficială NASA făcută de William Anders; am verificat imaginea și [politica NASA pentru imagini](https://www.nasa.gov/nasa-brand-center/images-and-media/). Nu extindem această regulă la toate materialele publicate de NASA, la materialele terților sau la sigle.
- Fotografia zborului din 1903 este din colecția Library of Congress, cu mențiunea „No known restrictions on publication”. [Înregistrarea Commons pentru aceeași fotografie](https://commons.wikimedia.org/wiki/File:First_flight2.jpg) confirmă publicarea înainte de 1931 și autorul John T. Daniels, 1873–1948.

## Livrare și verificare

Originalele pregătite se păstrează în afara pachetului public. Tabla primește WebP cu latura maximă 2200px, în proporția originală; selectorul folosește miniaturi de 480×360. Lucrările verticale și Crearea lui Adam au miniaturi cu întreaga compoziție, pentru a păstra reperele principale. Celelalte miniaturi folosesc punctul focal documentat. Imaginile din catalog nu au termenul de ștergere al fotografiilor personale.

- `npm run catalog:audit`: metadate, checksum, dimensiuni, dubluri și fișiere publice catalogate.
- `npm run test:catalog-serve`: descarcă și decodează toate cele 48 de imagini și 48 de miniaturi; instanțiază cele 12 adăugiri la 12/25/64/100/144/192 de piese prin API autentificat și WebSocket (72 de combinații).
- `npm run test:image-scaling`: compară sprite-urile reale cu imaginea completă pentru cele 12 adăugiri și cele patru repere existente, inclusiv geometrie veche supradimensionată (17.568 de sprite-uri / 224 de combinații).
- `npm run test:e2e`: verifică selecția colecțiilor/categoriilor, titlurile în română, miniatura decodată, telefonul și apoi jocul complet.
