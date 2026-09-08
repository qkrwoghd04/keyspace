import type { KeyboardInput } from '../../input/KeyboardInput';

/** An input-independent spring. Each material interprets its displacement differently. */
export class KeyState {
  displacement = 0;
  velocity = 0;
  heat = 0;
  age = Infinity;
  down = false;
  fresh = false;
  released = false;
  private version = 0;

  constructor(readonly code: string) {}

  reset(input: KeyboardInput) {
    this.version = input.getPressVersion(this.code);
    this.down = input.pressed.has(this.code);
    this.displacement = this.down ? 1 : 0;
    this.velocity = this.heat = 0;
    this.age = Infinity;
    this.fresh = this.released = false;
  }

  update(delta: number, input: KeyboardInput, reduced: boolean, stiffness = 760, damping = 39) {
    const nextDown = input.pressed.has(this.code);
    const version = input.getPressVersion(this.code);
    this.fresh = version !== this.version;
    this.released = (this.down && !nextDown) || (this.fresh && !nextDown);
    this.down = nextDown;
    this.version = version;
    if (this.fresh) { this.age = 0; this.heat = 1; this.displacement = Math.max(this.displacement, .66); this.velocity = 0; }
    const target = this.down ? 1 : 0;
    if (reduced) { this.displacement = target; this.velocity = 0; }
    else if (this.down) { this.displacement += (1 - this.displacement) * (1 - Math.exp(-75 * delta)); this.velocity = 0; }
    else {
      const steps = Math.max(1, Math.ceil(delta * 120));
      for (let i = 0; i < steps; i++) {
        const dt = delta / steps;
        this.velocity += (-stiffness * this.displacement - damping * this.velocity) * dt;
        this.displacement += this.velocity * dt;
      }
      if (Math.abs(this.displacement) < .0001 && Math.abs(this.velocity) < .001) this.displacement = this.velocity = 0;
    }
    this.age += delta;
    this.heat *= Math.exp(-6.5 * delta);
    return Math.abs(this.displacement - target) > .0001 || Math.abs(this.velocity) > .001 || this.heat > .003;
  }
}
