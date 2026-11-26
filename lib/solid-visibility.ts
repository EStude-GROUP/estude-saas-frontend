type P3 = { name: string; x: number; y: number; z?: number };
type Edge = { from: string; to: string; hidden?: boolean };

const K = 0.5 * Math.SQRT1_2;
/** Direction from the object towards the viewer for the oblique projection used by the renderer. */
export const VIEWER = [K, -1, K] as const;

const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: number[]) => Math.hypot(a[0], a[1], a[2]);

/**
 * Decides which edges of a convex solid are hidden behind its faces, so dashed lines do not depend on
 * the model's guess. Faces are the supporting planes of the vertex set; an edge shared only by faces that
 * turn away from the viewer is hidden. Segments that are not along a face (diagonals, heights inside the
 * solid) keep the flag the figure came with.
 */
export function resolveHiddenEdges(points: P3[], segments: Edge[]): boolean[] {
  const pos = new Map(points.map((p) => [p.name, [p.x, p.y, p.z ?? 0]]));
  const names = [...pos.keys()];
  const n = names.length;
  const fallback = segments.map((s) => Boolean(s.hidden));
  if (n < 4) return fallback;
  const centroid = [0, 1, 2].map((axis) => [...pos.values()].reduce((sum, p) => sum + p[axis], 0) / n);
  const scale = Math.max(...[...pos.values()].flatMap((p) => sub(p, centroid).map(Math.abs)), 1e-9);
  const eps = 1e-7 * scale * scale;
  type Face = { normal: number[]; members: Set<string> };
  const faces: Face[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const a = pos.get(names[i])!, b = pos.get(names[j])!, c = pos.get(names[k])!;
    let normal = cross(sub(b, a), sub(c, a));
    const l = len(normal);
    if (l < 1e-9 * scale * scale) continue;
    normal = normal.map((v) => v / l);
    let above = 0, below = 0;
    const members = new Set<string>();
    for (const name of names) {
      const side = dot(normal, sub(pos.get(name)!, a));
      if (Math.abs(side) <= eps / scale) members.add(name);
      else if (side > 0) above++;
      else below++;
    }
    if (above && below) continue; // not a supporting plane
    if (above) normal = normal.map((v) => -v); // outward: the rest of the solid lies behind it
    if (!above && !below) continue; // everything coplanar: a flat figure has no faces to hide behind
    if (!faces.some((f) => f.members.size === members.size && [...members].every((m) => f.members.has(m)))) faces.push({ normal, members });
  }
  if (!faces.length) return fallback;
  return segments.map((s, index) => {
    const shared = faces.filter((f) => f.members.has(s.from) && f.members.has(s.to));
    if (!shared.length) return fallback[index];
    return shared.every((f) => dot(f.normal, VIEWER) <= 1e-9);
  });
}
