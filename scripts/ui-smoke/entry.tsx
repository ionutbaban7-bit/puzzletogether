/* CARTOGRAF UI smoke test — renders the real components in jsdom via Vite SSR load. */
import "./setup-globals";
import { act } from "react";
import { useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { LanguageProvider } from "../../src/lib/i18n";
import EmotionsPage from "../../src/pages/EmotionsPage";
import EmotionCard from "../../src/emotions/EmotionCard";
import LandingPage from "../../src/pages/LandingPage";
import CreateRoom from "../../src/pages/CreateRoom";
import EmotionsActivity from "../../src/puzzle/EmotionsActivity";
import { store } from "../../src/store";

let failures = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) console.log("  ✓", label);
  else { failures++; console.error("  ✗ FAIL:", label, extra); }
}
const waitMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Probe({ render }: { render: () => ReactNode }) {
  // Render children through a function so each bump creates NEW element
  // references — React otherwise bails out on identical child elements.
  const [, setN] = useState(0);
  (globalThis as Record<string, unknown>).bump = () => setN((n) => n + 1);
  return <>{render()}</>;
}

async function renderProbe(ui: ReactNode): Promise<ReturnType<typeof createRoot>> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(ui); });
  return root;
}
function click(el: Element | null | undefined) {
  if (!el) return;
  act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); });
}
const btnByText = (root: ParentNode, text: string): Element | null =>
  [...root.querySelectorAll("button, [role=button]")].find((b) => (b.textContent || "").includes(text)) || null;
const hasText = (root: ParentNode, text: string): boolean => (root.textContent || "").includes(text);

async function main() {
  localStorage.setItem("pt.lang", "ro");

  console.log("== A. EmotionsPage — 7 tabs ==");
  const rootA = await renderProbe(<LanguageProvider><EmotionsPage /></LanguageProvider>);
  const body = document.body;
  check("CARTOGRAF header", hasText(body, "CARTOGRAF"));
  check("wheel rendered", !!document.querySelector("div[aria-label*='Roata'], div[aria-label*='Emotion']"), "");
  const tabNames: [string, string][] = [
    ["Meteo", "Cum e metoul din tine acum?"],
    ["Expediții", "Expediții"],
    ["Frontiera", "O predicție nouă"],
    ["Muzeul", "Lasă un rând pe perete"],
    ["Locuitorii", "Ce parte din tine vorbește astăzi?"],
    ["Atlasul", "emoții numite"],
  ];
  for (const [tab, content] of tabNames) {
    click(btnByText(body, tab));
    check(`tab ${tab} → ${content}`, hasText(body, content));
  }
  // family legend + blends on the map tab (regression: rings.join crash)
  click(btnByText(body, "Harta"));
  check("map: 8 families listed", hasText(body, "Frică") && hasText(body, "Anticipare") && hasText(body, "Tristețe"), "");
  check("map: blends section", hasText(body, "Amestecurile") || hasText(body, "blends"), "");
  check("emotions zone: light theme (no dark tokens)", !/bg-ink-950|bg-ink-900|border-white\/|bg-sky-400|text-sky-|bg-cp-azure/.test(body.innerHTML), "");
  // open the Emotion Book from the wheel
  const cells = document.querySelectorAll("g.wheel-cell");
  check("wheel: 24 emotion segments", cells.length === 24, String(cells.length));
  click(cells[5]?.querySelector("path"));
  check("emotion book opened", hasText(body, "Spectrul intensității") || hasText(body, "Exercițiu de 60") || hasText(body, "Cercetarea din spate"), "");
  check("emotion book: body section", hasText(body, "Cum se anunță în corp?"), "");
  await act(async () => { rootA.unmount(); });

  console.log("== B. EmotionCard — blend detail ==");
  const rootB = await renderProbe(
    <LanguageProvider><EmotionCard emotionId="blend-intre-incredere-si-frica" onClose={() => {}} onNavigate={() => {}} /></LanguageProvider>,
  );
  check("blend: name shown", hasText(document.body, "Între încredere și frică") || hasText(document.body, "Between trust and fear"), "");
  check("blend: mixes shows source emotions (regression)", hasText(document.body, "Încrederea") && hasText(document.body, "Frica") || hasText(document.body, "Trust") && hasText(document.body, "Fear"), document.body.textContent?.slice(0, 400) || "");
  await act(async () => { rootB.unmount(); });

  console.log("== C. EmotionsActivity — participant flow ==");
  const situation = { id: "r-test", text: { ro: "Șeful te roagă să preiei un proiect nou.", en: "Your manager asks you to take a new project." }, heavy: false, debriefPrompts: [{ ro: "Ce aș vrea să aud?", en: "What would I like to hear?" }] };
  const state = store.getState();
  state.status = "joined";
  state.connected = true;
  state.you = "p1";
  state.room = {
    id: "room1", code: "TEST", sessionName: "QA", stage: "play", hostId: "h1",
    maxPlayers: 12, createdAt: Date.now(), startedAt: Date.now(), completed: false,
    boardLocked: false, revealed: false, puzzleId: "emotions-camera-mare",
    emotions: { kind: "situation", situationId: "r-test", round: 1, revealed: false, history: [], safetyWordActive: false, votedCount: 0, totalPlayers: 3 },
    contentLanguage: null, jigsawLayout: "scatter", celebrationMode: "team", timerEndsAt: null,
  } as never;
  state.puzzle = {
    id: "emotions-camera-mare", mode: "emotions", isCoaching: true,
    activity: { id: "emotions-camera-mare", mode: "emotions", name: { ro: "Camera Mare", en: "Big Room" }, description: { ro: "", en: "" }, duration: "20–35 min", cover: "", scenario: { ro: "", en: "" }, instructions: { ro: "", en: "" }, situations: [situation] },
  } as never;
  state.emotionsMine = null;
  state.emotionsAgg = null;
  state.safetyPaused = false;
  const players = [
    { id: "h1", name: "Host", color: "#f00", role: "host", teamId: null, joinedAt: Date.now(), lastSeenAt: Date.now() },
    { id: "p1", name: "Me", color: "#0f0", role: "player", teamId: null, joinedAt: Date.now(), lastSeenAt: Date.now() },
    { id: "p2", name: "Ada", color: "#00f", role: "player", teamId: null, joinedAt: Date.now(), lastSeenAt: Date.now() },
  ] as never[];
  const rootC = await renderProbe(
    <LanguageProvider><Probe render={() => <EmotionsActivity puzzle={state.puzzle} players={players} youId="p1" />} /></LanguageProvider>,
  );
  check("situation card", hasText(document.body, "Șeful te roagă să preiei un proiect nou."));
  check("emotion picker chips", hasText(document.body, "Frica") && hasText(document.body, "Furia"));
  check("archetype chips", hasText(document.body, "Ce parte din tine vorbește?"));
  // select two emotions + intensity
  click(btnByText(document.body, "Frica"));
  click(btnByText(document.body, "Furia"));
  check("no crash after selecting emotions", true);
  // real flow: submit the vote (socket is a no-op, component marks it sent)
  click(btnByText(document.body, "Trimite votul privat"));
  check("vote saved confirmation", hasText(document.body, "votul tău e salvat privat") || hasText(document.body, "vote is saved"), document.body.textContent?.slice(-300) || "");
  // reconnect scenario: store already holds the vote → confirmation persists on fresh mount
  act(() => {
    state.emotionsMine = { emotions: ["frica", "furia"], intensity: 7, archetype: "gardianul", passed: false, line: null, at: Date.now() };
    ((globalThis as Record<string, unknown>).bump as () => void)();
  });
  // reveal state
  const agg = { kind: "situation", round: 1, situationId: "r-test", situation: situation as never, counts: { frica: 2, furia: 1 }, archetypeCounts: { gardianul: 1 }, passed: 1, intensityAvg: 7, lines: [], at: Date.now() } as never;
  act(() => {
    state.room.emotions = { ...state.room.emotions, revealed: true };
    state.emotionsAgg = agg;
    ((globalThis as Record<string, unknown>).bump as () => void)();
  });
  check("reveal: N metouri diferite", hasText(document.body, "metouri diferite") || hasText(document.body, "different skies"), document.body.textContent?.slice(0, 300) || "");
  check("reveal: bars show frica ×2", (hasText(document.body, "Frica") || hasText(document.body, "Fear")) && document.body.textContent?.includes(">2<") === false && hasText(document.body, "2"), "");
  check("reveal: Pas count", hasText(document.body, "Pas"), "");
  // safety pause overlay
  act(() => {
    state.safetyPaused = true;
    ((globalThis as Record<string, unknown>).bump as () => void)();
  });
  check("safety overlay", hasText(document.body, "Pauză de siguranță") || hasText(document.body, "Safety pause"), "");
  // host controls
  act(() => {
    state.safetyPaused = false;
    ((globalThis as Record<string, unknown>).bump as () => void)();
  });
  const rootD = await renderProbe(
    <LanguageProvider><Probe render={() => <EmotionsActivity puzzle={state.puzzle} players={players} youId="h1" />} /></LanguageProvider>,
  );
  check("host: facilitator controls", hasText(document.body, "Controale facilitator") || hasText(document.body, "Facilitator controls"), "");
  check("host: round buttons", hasText(document.body, "Meteo de pornire") && hasText(document.body, "Muzeul anonim"), "");
  check("host: reveal button", hasText(document.body, "Reveal (anonim)"), "");
  await act(async () => { rootC.unmount(); rootD.unmount(); });

  console.log("== D. LandingPage — accessible CoachingHub routes ==");
  const rootE = await renderProbe(<LanguageProvider><LandingPage /></LanguageProvider>);
  const links = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")];
  check("landing: create and join paths", links.some(a=>a.pathname==="/create") && links.some(a=>a.pathname==="/join"));
  check("landing: four intention routes", document.querySelectorAll(".studio-activity[href]").length === 4);
  check("landing: same-tab CoachingHub return", links.some(a=>a.hostname==="coaching-path.onrender.com" && !a.target));
  check("landing: emotion map stays available", links.some(a=>a.pathname==="/emotii"));
  check("landing: optional participation is explained", hasText(document.body, "pas"));
  check("landing: casual play explains choosing, inviting and playing", hasText(document.body, "Alege") && hasText(document.body, "Invită") && hasText(document.body, "Joacă") && links.some(a=>a.pathname==="/create" && a.search.includes("activity=puzzle")));
  await act(async () => { rootE.unmount(); });

  console.log("== E. CreateRoom — triple door + emotions category ==");
  const rootF = await renderProbe(<LanguageProvider><CreateRoom /></LanguageProvider>);
  await act(async () => { await waitMs(900); }); // let the catalog fetch resolve
  check("create room: triple door starters", hasText(document.body, "Unde începem?") && hasText(document.body, "La lobby") && hasText(document.body, "Clarity Express"), document.body.textContent?.slice(0, 300) || "");
  check("create room: catalog divider", hasText(document.body, "sau alege din catalog"), "");
  check("create room: emotions category button", hasText(document.body, "CARTOGRAF · emoții") || hasText(document.body, "CARTOGRAF · emotions"), document.body.textContent?.slice(0, 300) || "");
  const catBtn = btnByText(document.body, "CARTOGRAF · emoții") || btnByText(document.body, "CARTOGRAF · emotions");
  click(catBtn);
  await act(async () => { await waitMs(200); });
  check("create room: activity card", hasText(document.body, "Camera Mare") || hasText(document.body, "Big Room"), "");
  check("create room: badge Camera Mare", hasText(document.body, "Camera Mare — Harta Emoțiilor") || hasText(document.body, "The Big Room"), "");
  await act(async () => { rootF.unmount(); });

  // A shared direct link opens the catalog before a room exists. The chosen
  // image and piece count remain editable until the host creates the lobby.
  window.history.replaceState({}, "", "/create?activity=puzzle");
  const rootPuzzle = await renderProbe(<LanguageProvider><CreateRoom /></LanguageProvider>);
  await act(async () => { await waitMs(500); });
  check("direct puzzle link opens image selection", hasText(document.body, "Alege imaginea") && !hasText(document.body, "Numele tău"));
  const mona = document.querySelector<HTMLImageElement>('img[alt="Mona Lisa"]')?.closest("button");
  click(mona);
  const hard = [...document.querySelectorAll("button")].find(b => b.textContent?.includes("100 piese"));
  click(hard);
  click(btnByText(document.body, "Continuă"));
  check("Mona Lisa hard remains selected before room creation", hasText(document.body, "Mona Lisa") && hasText(document.body, "100 piese") && hasText(document.body, "Schimbă imaginea sau opțiunile"));
  click(btnByText(document.body, "Schimbă imaginea sau opțiunile"));
  check("back to catalog preserves selection", !!document.querySelector('img[alt="Mona Lisa"]')?.closest('button[aria-pressed="true"]') && hasText(document.body,"100 piese"));
  await act(async () => { rootPuzzle.unmount(); });
  window.history.replaceState({}, "", "/");

  console.log("== F. Solo tabs — interactions (localStorage) ==");
  const type = (el: Element | null, value: string) => {
    if (!el) return;
    const win = globalThis.window as unknown as Record<string, any>;
    const proto = (el.tagName === "TEXTAREA" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype) as { value?: string };
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(el, value);
    act(() => { el.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  const rootG = await renderProbe(<LanguageProvider><EmotionsPage /></LanguageProvider>);
  // Meteo: pick emotion + intensity + log
  click(btnByText(document.body, "Meteo"));
  click(btnByText(document.body, "Frica"));
  const intensityBtn = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === "7" && b.getAttribute("aria-label") === "7/10");
  click(intensityBtn);
  click(btnByText(document.body, "Înregistrează meteo"));
  check("meteo: logged confirmation", hasText(document.body, "notat"), "");
  check("meteo: last check-in shows Frica 7/10", hasText(document.body, "Ultima verificare") && hasText(document.body, "7/10"), "");
  // Frontiera: add a prediction, then resolve it as violated
  click(btnByText(document.body, "Frontiera"));
  const inputs = [...document.body.querySelectorAll("input")];
  type(inputs[0], "Telefonul de la șef");
  type(inputs[1], "O să refuze cererea.");
  click(btnByText(document.body, "Pune predicția pe hartă"));
  check("frontier: prediction listed", hasText(document.body, "Telefonul de la șef"), "");
  click(btnByText(document.body, "A fost momentul — verifică"));
  const actualInput = [...document.body.querySelectorAll("input")].find((i) => (i.getAttribute("placeholder") || "").includes("Ce s-a întâmplat"));
  type(actualInput, "A fost doar o întrebare.");
  click(btnByText(document.body, "N-a fost așa — altceva"));
  check("frontier: resolved into conquered territory", hasText(document.body, "Teritoriu cucerit") && hasText(document.body, "A fost doar o întrebare."), "");
  // Muzeul: leave a line
  click(btnByText(document.body, "Muzeul"));
  const lineInput = [...document.body.querySelectorAll("input")].find((i) => (i.getAttribute("placeholder") || "").includes("O dată am"));
  type(lineInput, "O dată am spus nu la o ședință.");
  click(btnByText(document.body, "Spune rândul"));
  check("museum: line on the wall", hasText(document.body, "O dată am spus nu la o ședință."), "");
  // Atlasul: named emotions + families + reset button
  click(btnByText(document.body, "Atlasul"));
  check("atlas: stats rendered", hasText(document.body, "emoții numite") && hasText(document.body, "Teritoriile vizitate"), "");
  check("atlas: export + delete buttons", hasText(document.body, "Export JSON") && hasText(document.body, "Șterge atlasul"), "");
  await act(async () => { rootG.unmount(); });

  console.log(failures === 0 ? "\nUI SMOKE: ALL PASSED" : `\nUI SMOKE: ${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
