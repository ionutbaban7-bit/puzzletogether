import type { PlayerView, RoomView } from "../types";
import type { Lang } from "./i18n";

export function workshopGuide(puzzleId: string, lang: Lang) {
  const ro = lang === "ro";
  const emotions = puzzleId.startsWith("emotions-");
  const canvas = /canvas/.test(puzzleId);
  const ranking = /himalaya|moon|desert/.test(puzzleId);
  const intent = emotions
    ? (ro ? "Să înțelegem cum intrăm în întâlnire, fără interpretări despre colegi." : "Understand how we arrive at the meeting, without interpreting teammates.")
    : canvas ? (ro ? "Să construim o idee comună și să observăm cum includem contribuțiile." : "Build a shared idea and notice how we include contributions.")
    : ranking ? (ro ? "Să observăm cum luăm decizii când perspectivele diferă." : "Notice how we decide when perspectives differ.")
    : (ro ? "Să observăm cum ne coordonăm și cum cerem ajutor." : "Notice how we coordinate and ask for help.");
  return {
    intent,
    steps: ro ? [
      ["2 min · Acord", "Spune intenția. Confirmați că fiecare poate spune «pas» și că discutăm comportamente, nu etichete despre oameni."],
      ["3 min · Instrucțiuni", "Verifică accesul tuturor. Invită întrebări și alegeți împreună ce vreți să observați."],
      ["10–20 min · Joc", "Urmărește cine propune, cine cere ajutor și ce idei nu se aud. Interval orientativ; adaptează-l activității."],
      ["7 min · Reflecție", "Ce s-a întâmplat concret? Ce am presupus? Cum apare acest tipar în munca noastră?"],
      ["3 min · Transfer", "Alegeți un experiment, un responsabil și o dată. Descărcați rezumatul și acțiunile în calendar."],
    ] : [
      ["2 min · Agreement", "Share the intention. Agree that everyone may pass and that we discuss behaviour, not labels for people."],
      ["3 min · Brief", "Check everyone's access. Invite questions and agree what you want to notice."],
      ["10–20 min · Play", "Notice who proposes, who asks for help and which ideas go unheard. Timing is a guide; adapt to the activity."],
      ["7 min · Reflect", "What actually happened? What did we assume? Where does this pattern appear at work?"],
      ["3 min · Transfer", "Choose one experiment, an owner and a date. Download the summary and calendar actions."],
    ],
  };
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function datedActions(room: RoomView) { return room.actions.filter(a => a.text.trim() && validDate(a.due)); }
function icalText(text: string) { return text.replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,"); }
// RFC 5545 folds at 75 octets without splitting Romanian Unicode characters.
function fold(line: string) {
  const rows: string[] = []; let current = ""; let bytes = 0;
  for (const c of line) { const n = new TextEncoder().encode(c).length; if (bytes + n > 75) { rows.push(current); current = " "; bytes = 1; } current += c; bytes += n; }
  rows.push(current); return rows.join("\r\n");
}
export function actionCalendar(room: RoomView, players: PlayerView[], lang: Lang, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CoachingHub//PuzzleTogether//RO", "CALSCALE:GREGORIAN"];
  for (const action of datedActions(room)) {
    const next = new Date(action.due + "T00:00:00Z"); next.setUTCDate(next.getUTCDate()+1);
    const owner = players.find(p=>p.id===action.ownerId)?.name || (lang === "ro" ? "Responsabil de confirmat" : "Confirm owner");
    lines.push("BEGIN:VEVENT", `UID:${icalText(action.id)}@puzzletogether.coachinghub.ro`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${action.due.replace(/-/g,"")}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0,10).replace(/-/g,"")}`, `SUMMARY:${icalText(action.text)}`, `DESCRIPTION:${icalText(`${room.sessionName}\n${owner}\nCoachingHub · PuzzleTogether`)}`, "TRANSP:TRANSPARENT", "END:VEVENT");
  }
  lines.push("END:VCALENDAR"); return lines.map(fold).join("\r\n") + "\r\n";
}
export function downloadText(text: string, filename: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a"); link.href=url; link.download=filename; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
