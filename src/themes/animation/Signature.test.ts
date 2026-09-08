import { describe, expect, it } from 'vitest';
import { Signature } from './Signature';

describe('non-queued signature choreography', () => {
  it('ignores repeated triggers without restarting or extending the active gesture', () => {
    const signature = new Signature(1, .2);
    expect(signature.start('Enter', false)).toBe(true);
    signature.update(.4, false);
    for (let i = 0; i < 2000; i++) expect(signature.start('Space', false)).toBe(false);
    expect(signature.progress).toBe(.4);
    expect(signature.diagnostics()).toMatchObject({ starts: 1, queued: 0, kind: 'enter' });
    signature.update(.7, false);
    expect(signature.active).toBe(false);
    expect(signature.start('Enter', false)).toBe(false);
    signature.update(.11, false);
    expect(signature.start('Space', false)).toBe(true);
  });
  it('does not choreograph ordinary keys, reduced motion or reset holds', () => {
    const signature = new Signature();
    expect(signature.start('KeyA', false)).toBe(false);
    expect(signature.start('Enter', true)).toBe(false);
    signature.start('Enter', false);
    signature.update(.01, true);
    expect(signature.active).toBe(false);
    signature.start('Space', false);
    signature.reset();
    expect(signature.active).toBe(false);
  });
});
