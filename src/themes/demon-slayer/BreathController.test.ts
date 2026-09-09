import { describe, expect, it, vi } from 'vitest';
import { BreathController } from './BreathController';
import { ChallengeChannel } from '../../challenge/ChallengeChannel';
import { KeyboardInput } from '../../input/KeyboardInput';

describe('breath subscription and composition boundary', () => {
  it('judges committed free text once and never creates a physical press', () => {
    const input = new KeyboardInput(), controller = new BreathController(input, () => 100);
    controller.setActive(true); controller.beginComposition(); controller.observeText('ㅎ', 'insertCompositionText', true);
    expect(controller.softwareSequence).toBe(0);
    controller.endComposition('한'); controller.observeText('한', 'insertText');
    expect(controller.softwareSequence).toBe(1); expect(controller.performance.read(100).combo).toBe(1);
    expect(input.getSnapshot().pressCount).toBe(0);
    controller.beginComposition(); controller.observeText('한ㄱ', 'insertCompositionText', true); controller.endComposition('한');
    expect(controller.softwareSequence).toBe(1); input.dispose();
  });
  it('uses all Challenge judgments even when visual intensity is off, and disconnects cleanly', () => {
    vi.useFakeTimers();
    const input = new KeyboardInput(), channel = new ChallengeChannel(); let now = 0;
    const controller = new BreathController(input, () => now), disconnect = controller.connect(channel);
    controller.setActive(true); channel.configure({ enabled: true, intensity: 'off' });
    for (let i = 0; i < 70; i++) { now = i * 100; channel.send({ type: 'correct', count: 1, position: i + 1, combo: i + 1, tier: 3 }); }
    expect(controller.state.phase).toBe('sun'); expect(controller.getSnapshot().challenge).toBe(true);
    expect(input.audioDiagnostics()).toMatchObject({ enabled: false, state: 'not-created', breath: 'sun' });
    disconnect(); expect(vi.getTimerCount()).toBe(0);
    const before = controller.performance.read(now).combo; channel.send({ type: 'error', count: 20, position: 0 });
    expect(controller.performance.read(now).combo).toBe(before); input.dispose(); vi.useRealTimers();
  });
  it('resets telemetry across theme changes, retains manual preference and avoids transition audio replay', () => {
    const input = new KeyboardInput(), transition = vi.spyOn(input, 'playBreathTransition'); let now = 0;
    const controller = new BreathController(input, () => now); controller.setActive(true); controller.select('sun'); controller.select('sun');
    expect(transition).toHaveBeenCalledTimes(1); now = 1000; controller.tick(); expect(controller.state.phase).toBe('sun');
    controller.setActive(false); controller.setActive(true);
    expect(controller.state.phase).toBe('sun'); expect(input.audioDiagnostics().breath).toBe('sun');
    expect(transition).toHaveBeenCalledTimes(1); controller.select('auto'); controller.reset();
    expect(controller.state.phase).toBe('water'); expect(controller.performance.read(now).combo).toBe(0); input.dispose();
  });
});
