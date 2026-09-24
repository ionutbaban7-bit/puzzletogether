import { useLang } from "../lib/i18n";
import { downloadText, workshopGuide } from "../lib/workshopTools";
export default function WorkshopGuide({ puzzleId }: { puzzleId: string }) {
  const { lang } = useLang(); const ro = lang === "ro"; const guide = workshopGuide(puzzleId,lang);
  const title = ro ? "Fișa facilitatorului" : "Facilitator guide";
  return <details className="rounded-xl border border-brand-300/25 bg-white/[.035] p-4"><summary className="cursor-pointer font-display text-xl text-brand-200">{title}</summary><p className="mt-3 text-sm leading-relaxed text-ink-100">{guide.intent}</p><ol className="mt-4 space-y-4">{guide.steps.map(([name,body]) => <li key={name}><h3 className="text-xs font-bold text-brand-200">{name}</h3><p className="mt-1 text-xs leading-relaxed text-ink-200">{body}</p></li>)}</ol><button className="btn-dark btn-sm mt-4" onClick={()=>downloadText([title,guide.intent,...guide.steps.map(([a,b])=>`\n${a}\n${b}`)].join("\n"),"coachinghub-fisa-facilitator.txt")}>{ro ? "Descarcă fișa" : "Download guide"}</button></details>;
}
