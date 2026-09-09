import type { Point3 } from './SlashGeometry';

export interface TrailPoint extends Point3 { code: string; at: number; s: number }
export interface TrailChain { points: TrailPoint[]; support?: TrailPoint; head: number }
const empty = (): TrailChain => ({ points: [], head: 0 });

/** Input memory, not a particle admission queue. Distances remain absolute when the tail expires. */
export class TrailPath {
  current = empty();
  retiring = empty();
  limit = 10;
  life = 1000;
  links = 0;
  append(code: string, point: Point3, at: number) {
    let last = this.current.points.at(-1);
    if (last && at - last.at > 700) { this.retiring = this.current; this.current = empty(); last = undefined; }
    if (last && Math.hypot(last.x - point.x, last.z - point.z) < .08) { last.at = at; return; }
    const s = last ? last.s + Math.hypot(last.x - point.x, last.z - point.z) : 0;
    this.current.points.push({ ...point, code, at, s });
    if (last) this.links++;
    this.trim(this.current, at);
  }
  private trim(chain: TrailChain, now: number) {
    if (chain.points.length && now - chain.points.at(-1)!.at >= this.life) { chain.points.length = 0; chain.support = undefined; return; }
    while (chain.points.length > this.limit || (chain.points.length > 2 && now - chain.points[1].at >= this.life)) chain.support = chain.points.shift();
  }
  update(now: number, delta: number) {
    for (const chain of [this.current, this.retiring]) {
      this.trim(chain, now);
      const last = chain.points.at(-1);
      if (!last) continue;
      chain.head += (last.s - chain.head) * (1 - Math.exp(-35 * delta));
      if (now - last.at >= 120) chain.head = last.s;
      chain.head = Math.max(chain.head, chain.points[0].s);
    }
  }
  setLow(low: boolean) { this.limit = low ? 6 : 10; this.life = low ? 700 : 1000; }
  clear() { this.current = empty(); this.retiring = empty(); }
}

/** Non-uniform Catmull-Rom (alpha .5). No global curl displaces the key anchors. */
export function trailPoint(chain: TrailChain, segment: number, t: number, now: number, sun: boolean, out: Point3): Point3 {
  const points = chain.points, a = points[segment], b = points[segment + 1];
  const previous = points[segment - 1] ?? chain.support;
  const future = points[segment + 2];
  const blend = future ? Math.min(1, Math.max(0, (now - future.at) / 100)) : 0;
  const x0 = previous?.x ?? 2 * a.x - b.x, y0 = previous?.y ?? 2 * a.y - b.y, z0 = previous?.z ?? 2 * a.z - b.z;
  const x3 = 2 * b.x - a.x + ((future?.x ?? 2 * b.x - a.x) - (2 * b.x - a.x)) * blend;
  const y3 = 2 * b.y - a.y + ((future?.y ?? 2 * b.y - a.y) - (2 * b.y - a.y)) * blend;
  const z3 = 2 * b.z - a.z + ((future?.z ?? 2 * b.z - a.z) - (2 * b.z - a.z)) * blend;
  const dt0 = Math.max(.01, Math.sqrt(Math.hypot(a.x - x0, a.y - y0, a.z - z0)));
  const dt1 = Math.max(.01, Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)));
  const dt2 = Math.max(.01, Math.sqrt(Math.hypot(x3 - b.x, y3 - b.y, z3 - b.z)));
  const cubic = (p0: number, p1: number, p2: number, p3: number) => {
    const m1 = ((p1 - p0) / dt0 - (p2 - p0) / (dt0 + dt1) + (p2 - p1) / dt1) * dt1;
    const m2 = ((p2 - p1) / dt1 - (p3 - p1) / (dt1 + dt2) + (p3 - p2) / dt2) * dt1;
    return (2 * t ** 3 - 3 * t * t + 1) * p1 + (t ** 3 - 2 * t * t + t) * m1 + (-2 * t ** 3 + 3 * t * t) * p2 + (t ** 3 - t * t) * m2;
  };
  const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz) || 1;
  const envelope = Math.sin(Math.PI * t) ** 2;
  // One advancing flame curl, not a bead or complete loop repeated at every key.
  const thrust = .06 + .94 * Math.exp(-(((b.s - chain.head) / .7) ** 2));
  const curl = sun ? Math.sin(t * Math.PI * 2) * envelope * Math.min(.9, length * .65) * thrust : 0;
  const side = sun ? (1 - Math.cos(t * Math.PI * 2)) * envelope * .58 * thrust : 0;
  out.x = cubic(x0, a.x, b.x, x3) + dx / length * curl - dz / length * side;
  out.z = cubic(z0, a.z, b.z, z3) + dz / length * curl + dx / length * side;
  out.y = cubic(y0, a.y, b.y, y3) + envelope * (sun ? .62 * thrust : .04);
  return out;
}
