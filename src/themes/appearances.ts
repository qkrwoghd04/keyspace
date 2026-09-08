import type { AnimationThemeId, SceneAppearance, ThemeId } from './types';

const lightUi = (ink: string, muted: string, line: string, surface: string, active: string): SceneAppearance['ui'] => ({
  ink, muted, subtle: muted, line, selection: `${ink}25`, controlSurface: surface, controlActive: active,
});

export const APPEARANCES: Record<Exclude<ThemeId, 'studio' | 'dark' | 'glass' | 'neon' | AnimationThemeId>, SceneAppearance> = {
  inferno: {
    background: '#1b1513', accent: '#ec925f',
    ui: lightUi('#f0dcd0', '#ac9285', '#43312a', '#271d19', '#3a2922'),
    lighting: {
      sky: '#efbea0', ground: '#43120b', ambient: .65,
      key: { color: '#ffe3c6', intensity: 2.5, position: [-6, 10, 5] },
      fill: { color: '#ff521b', intensity: 1.6, position: [5, 3, 0] },
      rim: { color: '#ffb35e', intensity: 2, position: [-4, 5, -7] }, exposure: 1,
    },
    mood: { environmentIntensity: .4, shadowOpacity: .35, contactOpacity: .85, legendGlow: 0 },
  },
  glacier: {
    background: '#e4edf0', accent: '#497889',
    ui: lightUi('#304c58', '#657e88', '#c2d3d9', '#d6e3e8', '#f3f8f8'),
    lighting: {
      sky: '#e6faff', ground: '#819ba8', ambient: .6,
      key: { color: '#f3fcff', intensity: 1.65, position: [-7, 8, 4] },
      fill: { color: '#a1cfe5', intensity: .7, position: [8, 4, -6] },
      rim: { color: '#e6f4ff', intensity: 1.5, position: [1, 5, -9] }, exposure: .84,
    },
    mood: { environmentIntensity: 1, shadowOpacity: .12, contactOpacity: .32, legendGlow: 0 },
  },
  jelly: {
    background: '#f7ebde', accent: '#b66948',
    ui: lightUi('#5e4437', '#927768', '#e0cab9', '#efddcd', '#fff5ea'),
    lighting: {
      sky: '#fff4db', ground: '#d5ad8d', ambient: 1.3,
      key: { color: '#fff6e7', intensity: 2.8, position: [-6, 11, 4] },
      fill: { color: '#ffddd1', intensity: 1, position: [8, 6, -6] },
      rim: { color: '#ffffe5', intensity: 1.4, position: [-4, 6, -8] }, exposure: .97,
    },
    mood: { environmentIntensity: .9, shadowOpacity: .08, contactOpacity: .42, legendGlow: 0 },
  },
  grove: {
    background: '#e8eadb', accent: '#66774b',
    ui: lightUi('#3f4835', '#7a8168', '#cbd0ba', '#dce0cb', '#f3f4e8'),
    lighting: {
      sky: '#faf3d5', ground: '#71834f', ambient: 1.1,
      key: { color: '#fff1c8', intensity: 2.4, position: [-6, 10, 6] },
      fill: { color: '#bdd9a4', intensity: .75, position: [8, 5, -7] },
      rim: { color: '#ffeba7', intensity: 1.5, position: [-3, 7, -8] }, exposure: 1.02,
    },
    mood: { environmentIntensity: .3, shadowOpacity: .16, contactOpacity: .35, legendGlow: 0 },
  },
  orbit: {
    background: '#0c1220', accent: '#adbbdf',
    ui: lightUi('#e0e6f3', '#8994b2', '#263049', '#161e31', '#26304a'),
    lighting: {
      sky: '#b6c6f0', ground: '#171831', ambient: .8,
      key: { color: '#d9e5ff', intensity: 2.1, position: [-7, 9, 6] },
      fill: { color: '#779bd8', intensity: .9, position: [8, 4, -7] },
      rim: { color: '#dac5ff', intensity: 2.3, position: [-4, 5, -8] }, exposure: 1.02,
    },
    mood: { environmentIntensity: .6, shadowOpacity: .06, contactOpacity: 0, legendGlow: 0 },
  },
};
