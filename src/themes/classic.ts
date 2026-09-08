import type { KeyboardPreset } from '../keyboard/presets';
import { KeyboardModel, disposeObject } from '../keyboard/KeyboardModel';
import type { ThemeContext, ThemeRuntime } from './types';

/** The original product, adapted without changing its geometry or motion. */
export function createClassic(preset: KeyboardPreset, context: ThemeContext): ThemeRuntime {
  const model = new KeyboardModel(context.legendTexture);
  model.updateAppearance(preset, 1);
  return {
    group: model.group,
    hitTargets: model.hitTargets,
    bounds: model.bounds,
    update: (delta, input, reduced) => model.update(delta, input, reduced),
    reset: input => model.clearEffects(input),
    setQuality: () => {},
    diagnostics: () => ({ particles: 0, flames: 0, waves: 0 }),
    dispose: () => disposeObject(model.group, new Set([context.legendTexture])),
  };
}
