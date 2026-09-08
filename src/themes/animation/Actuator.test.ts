import { describe, expect, it } from 'vitest';
import { Actuator, actuatorPose } from './Actuator';

describe('hangar interlocks', () => {
  it('unlocks, pressurizes, opens armor and returns in reverse order', () => {
    expect(actuatorPose(.05)).toMatchObject({ piston: 0, armor: 0 });
    expect(actuatorPose(.05).latch).toBeGreaterThan(0);
    expect(actuatorPose(.17).piston).toBeGreaterThan(0);
    expect(actuatorPose(.17).armor).toBe(0);
    expect(actuatorPose(.3)).toMatchObject({ latch: 1, piston: 1 });
    expect(actuatorPose(.3).armor).toBeGreaterThan(0);
    expect(actuatorPose(.48).armor).toBe(0);
    expect(actuatorPose(.6)).toMatchObject({ piston: 0, armor: 0 });
    expect(actuatorPose(.8)).toEqual({ latch: 0, piston: 0, armor: 0 });
  });
  it('never builds a request backlog', () => {
    const actuator = new Actuator(); actuator.start(); actuator.update(.2);
    for (let i = 0; i < 1000; i++) expect(actuator.start()).toBe(false);
    expect(actuator.age).toBe(.2);
    actuator.update(.6);
    expect(actuator.active).toBe(false); expect(actuator.start()).toBe(true);
  });
});
