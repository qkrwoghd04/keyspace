export interface Point3 { x: number; y: number; z: number }
export type SlashForm = 'water' | 'sun';
export const SLASH_SEGMENTS = 64;
export const SLASH_LANES = 8;

/** A flowing S-cut versus a returning, 250-degree flame sweep. Both touch the two keys. */
export function slashPoint(t: number, from: Point3, to: Point3, form: SlashForm, energy = 0, anchors?: readonly Point3[]): Point3 {
  const dx = to.x - from.x, dz = to.z - from.z, length = Math.hypot(dx, dz) || 1;
  const nx = -dz / length, nz = dx / length, arc = Math.sin(Math.PI * t);
  let along = t, sideways: number, lift: number;
  if (form === 'water') {
    sideways = arc * (.72 + Math.sin(t * Math.PI * 2 - .5) * .66);
    along += Math.sin(t * Math.PI * 2) * .08;
    lift = arc * (.48 + .2 * Math.sin(t * Math.PI));
  } else {
    const sweep = Math.PI * 1.39, angle = (t - .5) * sweep;
    // A returning crescent with an open center, instead of a widened water S-curve.
    along = .5 + Math.sin(angle) / (2 * Math.sin(sweep / 2));
    sideways = (Math.cos(angle) - Math.cos(sweep / 2)) * (Math.min(1.4, Math.max(.95, length * .44)) + energy * .1);
    lift = arc * (.68 + .14 * energy);
  }
  if (anchors && anchors.length > 2) {
    const index = Math.min(anchors.length - 2, Math.floor(t * (anchors.length - 1))), f = t * (anchors.length - 1) - index;
    const p0 = anchors[Math.max(0, index - 1)], p1 = anchors[index], p2 = anchors[index + 1], p3 = anchors[Math.min(anchors.length - 1, index + 2)];
    const catmull = (axis: keyof Point3) => .5 * (2 * p1[axis] + (-p0[axis] + p2[axis]) * f + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * f * f + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * f * f * f);
    const offset = form === 'water' ? .65 : 1;
    const curl = form === 'sun' ? (along - t) * Math.min(1, 3.5 / length) : 0;
    return { x: catmull('x') + nx * sideways * offset + dx * curl, y: catmull('y') + lift, z: catmull('z') + nz * sideways * offset + dz * curl };
  }
  return { x: from.x + dx * along + nx * sideways, y: from.y + (to.y - from.y) * t + lift, z: from.z + dz * along + nz * sideways };
}

/** Fill fixed geometry in place. Width, rolling face and teeth are real 3D vertices. */
export function writeSlash(target: Float32Array, from: Point3, to: Point3, form: SlashForm, width: number, energy: number, anchors?: readonly Point3[]) {
  for (let i = 0; i <= SLASH_SEGMENTS; i++) {
    const t = i / SLASH_SEGMENTS, p = slashPoint(t, from, to, form, energy, anchors);
    const before = slashPoint(Math.max(0, t - .005), from, to, form, energy, anchors), after = slashPoint(Math.min(1, t + .005), from, to, form, energy, anchors);
    const dx = after.x - before.x, dz = after.z - before.z, length = Math.hypot(dx, dz) || 1;
    const taper = Math.sin(Math.PI * t) ** .48;
    const roll = form === 'water' ? .64 + Math.sin(t * Math.PI * 2) * .18 : .72 + Math.sin(t * Math.PI * 1.4) * .2;
    const teeth = form === 'sun' ? Math.max(0, Math.sin(t * 91)) ** 7 * .47 + Math.max(0, Math.sin(t * 47 + 1)) ** 5 * .25 : Math.sin(t * 54) * .025;
    for (let lane = 0; lane <= SLASH_LANES; lane++) {
      const v = lane / SLASH_LANES, side = v * 2 - 1;
      const w = width * taper * side * (1 + (side > 0 ? teeth : teeth * .18));
      const offset = (i * (SLASH_LANES + 1) + lane) * 3;
      target[offset] = p.x - dz / length * w;
      target[offset + 1] = p.y - w * (dx / length) * roll + Math.sin(v * Math.PI) * width * .1;
      target[offset + 2] = p.z + dx / length * w;
    }
  }
}
