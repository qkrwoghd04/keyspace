import type { AnimationThemeId, SceneAppearance } from '../types';

function scene(background: string, ink: string, muted: string, accent: string, surface: string, key: string, ground: string, exposure = 1): SceneAppearance {
  return {
    background, accent,
    ui: { ink, muted, subtle: muted, line: surface, selection: `${accent}35`, controlSurface: surface, controlActive: surface },
    lighting: {
      sky: key, ground, ambient: 1.1,
      key: { color: key, intensity: 2.1, position: [-7, 10, 6] },
      fill: { color: key, intensity: .75, position: [8, 5, -5] },
      rim: { color: accent, intensity: 1.15, position: [-4, 7, -8] }, exposure,
    },
    mood: { environmentIntensity: .5, shadowOpacity: .15, contactOpacity: .32, legendGlow: 0 },
  };
}
export const ANIMATION_APPEARANCES: Record<AnimationThemeId, SceneAppearance> = {
  'demon-slayer': scene('#e8eee8', '#203d37', '#607a70', '#318b8f', '#ceded5', '#e2f4f0', '#1c4441', .95),
  pokemon: scene('#f4eddc', '#383e40', '#797769', '#c95142', '#e4d8be', '#fff3d8', '#c5bd91', 1),
  'spider-verse': scene('#eac9b2', '#292031', '#71515f', '#a32356', '#dab296', '#fff0d9', '#754369', .97),
  howl: scene('#e4e8db', '#374a49', '#71807a', '#996947', '#ccd5c5', '#fff2cf', '#819b8c', .95),
  evangelion: scene('#1e2227', '#e5e3d3', '#969c93', '#a1c960', '#363d38', '#e7eddc', '#343448', .95),
};
