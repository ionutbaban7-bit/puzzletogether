const ro: Record<string, string> = {
  easy: "Ușor", medium: "Mediu", hard: "Greu", expert: "Expert", master: "Maestru",
  quick: "Rapid", standard: "Standard", extended: "Extins", sandbox: "Liber",
};

export function difficultyName(id: string, fallback: string, lang: "ro" | "en") {
  return lang === "ro" ? ro[id] || fallback : fallback;
}
