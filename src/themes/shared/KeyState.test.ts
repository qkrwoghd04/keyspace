import { describe, expect, it } from 'vitest';
import type { KeyboardInput } from '../../input/KeyboardInput';
import { KeyState } from './KeyState';

function source() {
  let version = 0;
  const pressed = new Set<string>();
  return {
    input: { pressed, getPressVersion: () => version } as unknown as KeyboardInput,
    press: () => { pressed.add('KeyA'); version++; },
    release: () => pressed.clear(),
  };
}

describe('material motion state', () => {
  it('holds squash and immediately interrupts its spring return', () => {
    const control = source(), state = new KeyState('KeyA');
    control.press();
    for (let i = 0; i < 30; i++) state.update(1 / 60, control.input, false, 300, 18);
    expect(state.displacement).toBeCloseTo(1);
    control.release();
    for (let i = 0; i < 9; i++) state.update(1 / 60, control.input, false, 300, 18);
    expect(state.displacement).toBeLessThan(.1);
    control.press(); state.update(1 / 60, control.input, false, 300, 18);
    expect(state.fresh).toBe(true);
    expect(state.displacement).toBeGreaterThan(.8);
  });

  it('preserves both edges of a tap completed between frames', () => {
    const control = source(), state = new KeyState('KeyA');
    control.press(); control.release(); state.update(1 / 60, control.input, false);
    expect(state.fresh).toBe(true); expect(state.released).toBe(true);
    expect(state.heat).toBeGreaterThan(0);
  });

  it('synchronizes a held key into a new theme without another impact', () => {
    const control = source(), state = new KeyState('KeyA');
    control.press(); state.reset(control.input); state.update(1 / 60, control.input, false);
    expect(state.fresh).toBe(false); expect(state.down).toBe(true); expect(state.heat).toBe(0);
  });

  it('removes overshoot with reduced motion', () => {
    const control = source(), state = new KeyState('KeyA');
    control.press(); state.update(1 / 60, control.input, true);
    expect(state.displacement).toBe(1);
    control.release(); state.update(1 / 60, control.input, true);
    expect(state.displacement).toBe(0); expect(state.velocity).toBe(0);
  });
});
