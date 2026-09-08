import { PRESETS } from '../keyboard/presets';
import { APPEARANCES } from './appearances';
import { loadTheme } from './loadTheme';
import { createClassic } from './classic';
import { ANIMATION_APPEARANCES } from './animation/appearances';
import type { ThemeDefinition } from './types';

const CLASSICS: ThemeDefinition[] = PRESETS.map(preset => ({
  id: preset.id,
  name: preset.shortName,
  category: 'CLASSIC',
  material: ({ studio: 'Aluminum / PBT', dark: 'Anodized / dampened', glass: 'Polished / optical', neon: 'Electric / luminous' })[preset.id],
  thumbnail: `${import.meta.env.BASE_URL}themes/${preset.id}.png`,
  colorScheme: preset.id === 'dark' || preset.id === 'neon' ? 'dark' : 'light',
  swatches: [preset.housing.body.color, preset.keycaps.ivory.top.color, preset.keycaps.orange.top.color],
  appearance: preset,
  load: preset.id === 'glass' ? loadTheme(() => import('./glass')) : async () => {
    return context => createClassic(preset, context);
  },
}));

export const THEMES: readonly ThemeDefinition[] = [
  ...CLASSICS,
  {
    id: 'inferno', name: 'Inferno', category: 'EXPERIMENTAL', material: 'Volcanic rock / ember',
    thumbnail: `${import.meta.env.BASE_URL}themes/inferno.png`, colorScheme: 'dark', swatches: ['#302923', '#ad3e16', '#ffc771'], appearance: APPEARANCES.inferno,
    load: loadTheme(() => import('./inferno')),
  },
  {
    id: 'glacier', name: 'Glacier', category: 'EXPERIMENTAL', material: 'Fractured ice / frost',
    thumbnail: `${import.meta.env.BASE_URL}themes/glacier.png`, colorScheme: 'light', swatches: ['#8ab3bf', '#d5eff1', '#edf9f9'], appearance: APPEARANCES.glacier,
    load: loadTheme(() => import('./glacier')),
  },
  {
    id: 'jelly', name: 'Jelly', category: 'EXPERIMENTAL', material: 'Fruit / elastic',
    thumbnail: `${import.meta.env.BASE_URL}themes/jelly.png`, colorScheme: 'light', swatches: ['#eeb5a0', '#f4b78d', '#c2d58c'], appearance: APPEARANCES.jelly,
    load: loadTheme(() => import('./jelly')),
  },
  {
    id: 'grove', name: 'Grove', category: 'EXPERIMENTAL', material: 'Rootstock / living wood',
    thumbnail: `${import.meta.env.BASE_URL}themes/grove.png`, colorScheme: 'light', swatches: ['#765234', '#c49a65', '#84974a'], appearance: APPEARANCES.grove,
    load: loadTheme(() => import('./grove')),
  },
  {
    id: 'orbit', name: 'Orbit', category: 'EXPERIMENTAL', material: 'Mineral / zero gravity',
    thumbnail: `${import.meta.env.BASE_URL}themes/orbit.png`, colorScheme: 'dark', swatches: ['#1d2437', '#697d9f', '#c2d7ff'], appearance: APPEARANCES.orbit,
    load: loadTheme(() => import('./orbit')),
  },
  {
    id: 'demon-slayer', name: '귀멸의 칼날', category: 'ANIMATION', material: 'Water breathing / lacquer',
    thumbnail: `${import.meta.env.BASE_URL}themes/demon-slayer.png`, colorScheme: 'light', swatches: ['#244e3e', '#b9d8c7', '#26899b'], appearance: ANIMATION_APPEARANCES['demon-slayer'],
    load: loadTheme(() => import('./animation/demon-slayer')),
  },
  {
    id: 'pokemon', name: '포켓몬', category: 'ANIMATION', material: 'Field Pokédex / companion',
    thumbnail: `${import.meta.env.BASE_URL}themes/pokemon.png`, colorScheme: 'light', swatches: ['#b84235', '#eec94e', '#89b496'], appearance: ANIMATION_APPEARANCES.pokemon,
    load: loadTheme(() => import('./animation/pokemon')),
  },
  {
    id: 'spider-verse', name: '스파이더버스', category: 'ANIMATION', material: 'Ink / halftone / motion',
    thumbnail: `${import.meta.env.BASE_URL}themes/spider-verse.png`, colorScheme: 'light', swatches: ['#272337', '#cc436b', '#258b99'], appearance: ANIMATION_APPEARANCES['spider-verse'],
    load: loadTheme(() => import('./animation/spider-verse')),
  },
  {
    id: 'howl', name: '하울의 움직이는 성', category: 'ANIMATION', material: 'Walking boiler-house',
    thumbnail: `${import.meta.env.BASE_URL}themes/howl.png`, colorScheme: 'light', swatches: ['#4d6361', '#aa7550', '#d9cbb0'], appearance: ANIMATION_APPEARANCES.howl,
    load: loadTheme(() => import('./animation/howl')),
  },
  {
    id: 'evangelion', name: '에반게리온', category: 'ANIMATION', material: 'Armor / interlocked gantry',
    thumbnail: `${import.meta.env.BASE_URL}themes/evangelion.png`, colorScheme: 'dark', swatches: ['#54456c', '#a4b35b', '#333d42'], appearance: ANIMATION_APPEARANCES.evangelion,
    load: loadTheme(() => import('./animation/evangelion')),
  },
];

export const DEFAULT_THEME = THEMES[0];
