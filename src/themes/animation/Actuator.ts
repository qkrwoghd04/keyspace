const smooth = (time: number, from: number, to: number) => {
  const t = Math.max(0, Math.min(1, (time - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

export function actuatorPose(age: number) {
  if (!Number.isFinite(age) || age < 0 || age >= .68) return { latch: 0, piston: 0, armor: 0 };
  return {
    latch: smooth(age, 0, .09) * (1 - smooth(age, .56, .68)),
    piston: smooth(age, .1, .23) * (1 - smooth(age, .43, .56)),
    armor: smooth(age, .24, .35) * (1 - smooth(age, .35, .43)),
  };
}

export class Actuator {
  age = Infinity;
  start() { if (this.age < .68) return false; this.age = 0; return true; }
  update(delta: number) { this.age += delta; }
  reset() { this.age = Infinity; }
  get active() { return this.age < .68; }
}
