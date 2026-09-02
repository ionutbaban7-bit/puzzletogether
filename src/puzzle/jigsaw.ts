/**
 * Jigsaw geometry: deterministic, seeded edge map + classic "tab & blank"
 * piece outlines built from cubic beziers (mushroom-shaped tabs with a
 * narrow neck and gentle shoulder dips — like a real die-cut puzzle).
 *
 * The seed comes from the server, so every player sees the exact same cut.
 */

export interface EdgeSpec {
  /** Absolute bulge direction: +1 = towards +y (h edges) / +x (v edges). */
  sign: 1 | -1;
  /** Tab center along the edge, 0..1 (jittered around the middle). */
  pos: number;
  /** Tab size multiplier (0.9..1.15) for an organic, hand-cut feel. */
  size: number;
}

export interface PieceEdges {
  top: EdgeSpec | null;
  right: EdgeSpec | null;
  bottom: EdgeSpec | null;
  left: EdgeSpec | null;
}

export interface EdgeMap {
  cols: number;
  rows: number;
  /** h[r][c] — horizontal edge between piece (r-1,c) and (r,c). Null on borders. */
  h: (EdgeSpec | null)[][];
  /** v[r][c] — vertical edge between piece (r,c-1) and (r,c). Null on borders. */
  v: (EdgeSpec | null)[][];
}

/** Small fast seeded PRNG (mulberry32). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSpec(rnd: () => number): EdgeSpec {
  return {
    sign: rnd() < 0.5 ? 1 : -1,
    pos: 0.5 + (rnd() - 0.5) * 0.24, // 0.38 .. 0.62
    size: 0.9 + rnd() * 0.25, // 0.9 .. 1.15
  };
}

export function buildEdgeMap(cols: number, rows: number, seed: number): EdgeMap {
  const rnd = mulberry32(seed || cols * 73856093 + rows * 19349663);
  const h: (EdgeSpec | null)[][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: (EdgeSpec | null)[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(r === 0 || r === rows ? null : makeSpec(rnd));
    }
    h.push(row);
  }
  const v: (EdgeSpec | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: (EdgeSpec | null)[] = [];
    for (let c = 0; c <= cols; c++) {
      row.push(c === 0 || c === cols ? null : makeSpec(rnd));
    }
    v.push(row);
  }
  return { cols, rows, h, v };
}

export function pieceEdges(map: EdgeMap, col: number, row: number): PieceEdges {
  return {
    top: map.h[row][col],
    bottom: map.h[row + 1][col],
    left: map.v[row][col],
    right: map.v[row][col + 1],
  };
}

/** Max distance (px) any tab can stick out beyond the piece rectangle. */
export function tabBulge(pieceW: number, pieceH: number): number {
  return 0.26 * Math.min(pieceW, pieceH) * 1.15;
}

/** Sprite padding needed around the piece rect (tabs + stroke bleed). */
export function spritePad(pieceW: number, pieceH: number): number {
  return Math.ceil(tabBulge(pieceW, pieceH) + 4);
}

/** Half-width of the tab neck, as a fraction of the edge length. */
const NECK = 0.09;

/**
 * Appends one edge to the path. S→E is the traversal direction; N is the unit
 * normal pointing in the spec's ABSOLUTE +bulge direction.
 */
function addEdge(
  path: Path2D,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  nx: number,
  ny: number,
  spec: EdgeSpec | null,
  bulgeBase: number,
  reverse: boolean,
) {
  if (!spec) {
    path.lineTo(ex, ey);
    return;
  }
  const dx = ex - sx;
  const dy = ey - sy;
  const b = spec.sign * bulgeBase * spec.size; // signed bulge in px along N
  const t = reverse ? 1 - spec.pos : spec.pos;
  const w = NECK;
  // Point at fraction u along the edge, offset vf (in bulge units) along N.
  const P = (u: number, vf: number): [number, number] => [
    sx + dx * u + nx * b * vf,
    sy + dy * u + ny * b * vf,
  ];
  const bez = (c1: [number, number], c2: [number, number], e: [number, number]) =>
    path.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);

  // Shoulder → neck (gentle dip away from the tab)
  bez(P(0.3 * (t - w), 0), P(t - w - 0.06, -0.09), P(t - w, 0));
  // Neck → head apex (mushroom overhang: control points swing wide)
  bez(P(t - w, 0.55), P(t - 2.3 * w, 0.95), P(t, 1.0));
  // Head apex → neck
  bez(P(t + 2.3 * w, 0.95), P(t + w, 0.55), P(t + w, 0));
  // Neck → far shoulder
  bez(P(t + w + 0.06, -0.09), P(1 - 0.3 * (1 - t - w), 0), [ex, ey]);
}

/**
 * Builds the full outline of one piece as a Path2D in piece-local coordinates:
 * the body occupies (0,0)..(w,h); tabs may extend outside by up to tabBulge().
 */
export function buildPiecePath(w: number, h: number, edges: PieceEdges): Path2D {
  const bulge = 0.26 * Math.min(w, h);
  const path = new Path2D();
  path.moveTo(0, 0);
  // Top: left → right, absolute bulge +1 = +y (down)
  addEdge(path, 0, 0, w, 0, 0, 1, edges.top, bulge, false);
  // Right: top → bottom, absolute bulge +1 = +x (right)
  addEdge(path, w, 0, w, h, 1, 0, edges.right, bulge, false);
  // Bottom: right → left (reversed), absolute bulge +1 = +y (down)
  addEdge(path, w, h, 0, h, 0, 1, edges.bottom, bulge, true);
  // Left: bottom → top (reversed), absolute bulge +1 = +x (right)
  addEdge(path, 0, h, 0, 0, 1, 0, edges.left, bulge, true);
  path.closePath();
  return path;
}
