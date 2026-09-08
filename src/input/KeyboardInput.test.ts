import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { KeyboardInput } from './KeyboardInput';

vi.mock('./SwitchSound', () => ({ SwitchSound: class {
  setEnabled = vi.fn(); setVolume = vi.fn(); setHidden = vi.fn(); setProfile = vi.fn(); stopAll = vi.fn(); diagnostics = vi.fn(); play = vi.fn(); dispose = vi.fn();
} }));

describe('shared physical input', () => {
  let input: KeyboardInput;
  beforeEach(() => { input = new KeyboardInput(); document.body.innerHTML = '<textarea id="typing-space"></textarea><button>Theme</button><input type="range">'; });
  afterEach(() => { input.dispose(); });

  it('coalesces repeated holds but retains a short tap between frames', () => {
    input.press('KeyA'); input.press('KeyA'); input.release('KeyA');
    expect(input.getPressVersion('KeyA')).toBe(1);
    expect(input.getSnapshot().pressCount).toBe(1);
    expect(input.pressed.size).toBe(0);
    input.press('KeyA');
    expect(input.getPressVersion('KeyA')).toBe(2);
  });

  it('tracks physical and multiple pointer sources independently', () => {
    input.press('Space'); input.press('Space', 'pointer:1'); input.press('Space', 'pointer:2'); input.press('KeyA');
    input.release('Space'); input.releaseSource('pointer:1');
    expect([...input.pressed]).toEqual(['Space', 'KeyA']);
    input.releaseSource('pointer:2');
    expect([...input.pressed]).toEqual(['KeyA']);
    expect(input.getSnapshot().pressCount).toBe(2);
  });

  it('ignores repeats without preventing native editing', () => {
    input.connect();
    const editor = document.querySelector('textarea')!;
    const first = new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true, cancelable: true });
    const repeat = new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true, repeat: true, cancelable: true });
    editor.dispatchEvent(first); editor.dispatchEvent(repeat);
    expect(first.defaultPrevented).toBe(false);
    expect(repeat.defaultPrevented).toBe(false);
    expect(input.getPressVersion('KeyA')).toBe(1);
  });

  it('excludes controls but always accepts a release after focus changes', () => {
    input.connect();
    const editor = document.querySelector('textarea')!;
    const button = document.querySelector('button')!;
    editor.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
    button.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', bubbles: true }));
    button.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    document.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
    expect(input.pressed.size).toBe(0);
    expect(input.getSnapshot().pressCount).toBe(1);
  });

  it('clears all held sources and advances the reset generation on blur', () => {
    input.connect(); input.press('KeyA'); input.press('KeyB', 'pointer:1');
    const generation = input.resetVersion;
    window.dispatchEvent(new Event('blur'));
    expect(input.pressed.size).toBe(0);
    expect(input.resetVersion).toBe(generation + 1);
  });

  it('preserves sound preferences through input resets and clamps volume', () => {
    input.setSoundEnabled(true); input.setVolume(0.27); input.releaseAll();
    expect(input.getSnapshot()).toMatchObject({ soundEnabled: true, volume: 0.27 });
    input.setVolume(8); expect(input.getSnapshot().volume).toBe(1);
    input.setVolume(Number.NaN); expect(input.getSnapshot().volume).toBe(0);
  });

  it('does not accumulate listeners during reconnects', () => {
    const disconnect = input.connect(); disconnect(); input.connect();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));
    expect(input.getSnapshot().pressCount).toBe(1);
  });

  it('retains real strike order including repeated characters with bounded history', () => {
    for (const code of ['KeyJ', 'KeyA', 'KeyJ']) { input.press(code); input.release(code); }
    expect(input.recentPresses.map(event => event.code)).toEqual(['KeyJ', 'KeyA', 'KeyJ']);
    for (let i = 0; i < 1000; i++) { input.press('KeyS'); input.release('KeyS'); }
    expect(input.recentPresses).toHaveLength(64);
    expect(input.recentPresses.at(-1)?.sequence).toBe(1003);
    input.releaseAll(); expect(input.recentPresses).toEqual([]);
  });
});
