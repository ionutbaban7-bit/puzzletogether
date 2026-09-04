import type { CanvasLane, CanvasTile } from "../types";

/**
 * Client mirror of the server's reconstructCanvasText() (src/server.js).
 * Tiles are grouped into rows by y-proximity, sorted by x, punctuation
 * attaches without a space, and large gaps become spaces.
 */
export function reconstructCanvasText(tiles: CanvasTile[], opts: { bigGapFactor?: number } = {}): string {
  const { bigGapFactor = 1.8 } = opts;
  if (!tiles.length) return "";
  // Mirror the server: a fully lane-based v2 composition has an intentional
  // sequence, so letter tiles become words rather than an arbitrary spatial row.
  if (tiles.every((tile) => tile.laneId)) {
    const groups = new Map<string, { x: number; y: number; items: CanvasTile[] }>();
    for (const tile of tiles) {
      const group = groups.get(tile.laneId!) || { x: tile.x, y: tile.y, items: [] };
      group.x = Math.min(group.x, tile.x);
      group.y = Math.min(group.y, tile.y);
      group.items.push(tile);
      groups.set(tile.laneId!, group);
    }
    return [...groups.values()]
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((group) => {
        const items = group.items.sort((a, b) => (a.laneIndex ?? 0) - (b.laneIndex ?? 0) || a.id - b.id);
        const letters = items.every((tile) => ["letter", "wildcard", "punctuation"].includes(tile.kind));
        let line = "";
        for (let index = 0; index < items.length; index++) {
          const tile = items[index];
          if (!letters && index > 0 && tile.kind !== "punctuation") line += " ";
          line += tile.text;
        }
        return line.trim();
      })
      .filter(Boolean)
      .join("\n");
  }
  const list = [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: { y: number; n: number; items: CanvasTile[] }[] = [];
  for (const t of list) {
    const row = rows.find((r) => Math.abs(r.y - t.y) < t.h * 0.55);
    if (row) {
      row.items.push(t);
      row.y = (row.y * row.n + t.y) / (row.n + 1);
      row.n++;
    } else {
      rows.push({ y: t.y, n: 1, items: [t] });
    }
  }
  const lines = rows.map((row) => {
    row.items.sort((a, b) => a.x - b.x);
    let line = "";
    for (let i = 0; i < row.items.length; i++) {
      const t = row.items[i];
      if (i > 0) {
        const prev = row.items[i - 1];
        const gap = t.x - (prev.x + prev.w);
        const eitherPunct = t.kind === "punctuation" || prev.kind === "punctuation";
        if (!eitherPunct) line += gap > prev.w * bigGapFactor ? "  " : " ";
      }
      line += t.text;
    }
    return line.trim();
  });
  return lines.filter(Boolean).join("\n");
}

/** Deterministic word-tile width — must match canvasWordWidth() in src/server.js. */
export function canvasWordWidth(text: string, kind: string): number {
  if (kind === "punctuation") return 64;
  const len = [...text.normalize("NFC")].length;
  return Math.max(96, Math.min(720, 40 + len * 19));
}

export function downloadTextFile(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadJsonFile(filename: string, payload: unknown) {
  downloadTextFile(filename, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
}

/** Renders the blank sheet + tiles into an offscreen canvas and downloads it as PNG. */
export function exportCanvasPng(opts: {
  sheetW: number;
  sheetH: number;
  tiles: CanvasTile[];
  lanes?: CanvasLane[];
  isLetter: boolean;
  filename: string;
  drawTile: (ctx: CanvasRenderingContext2D, tile: CanvasTile, x: number, y: number, w: number, h: number) => void;
}) {
  const scale = 2;
  const margin = 60;
  const canvas = document.createElement("canvas");
  canvas.width = (opts.sheetW + margin * 2) * scale;
  canvas.height = (opts.sheetH + margin * 2) * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  // Export the same dark game surface rather than a generic white worksheet.
  ctx.fillStyle = "#080b14";
  ctx.fillRect(0, 0, opts.sheetW + margin * 2, opts.sheetH + margin * 2);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#12192b";
  roundRectPath(ctx, margin, margin, opts.sheetW, opts.sheetH, 18);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(148,163,184,.36)";
  ctx.lineWidth = 2;
  roundRectPath(ctx, margin, margin, opts.sheetW, opts.sheetH, 18);
  ctx.stroke();
  for (const lane of opts.lanes || []) {
    const accent: Record<string, string> = { red: "#f87171", yellow: "#facc15", green: "#4ade80", blue: "#60a5fa", purple: "#c084fc", orange: "#fb923c" };
    const color = accent[lane.teamColor || "blue"] || "#60a5fa";
    ctx.fillStyle = `${color}20`;
    roundRectPath(ctx, margin + lane.x, margin + lane.y, lane.w, lane.h, 16);
    ctx.fill();
    ctx.strokeStyle = `${color}aa`;
    ctx.lineWidth = 2;
    roundRectPath(ctx, margin + lane.x, margin + lane.y, lane.w, lane.h, 16);
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 17px Inter, system-ui, sans-serif";
    ctx.fillText(`${lane.teamMarker ? `${lane.teamMarker} ${lane.teamName || ""} · ` : ""}${lane.label.en}`, margin + lane.x + 16, margin + lane.y + 25);
  }
  const tiles = [...opts.tiles].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const tile of tiles) {
    opts.drawTile(ctx, tile, margin + tile.x, margin + tile.y, tile.w, tile.h);
  }
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = opts.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, "image/png");
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
