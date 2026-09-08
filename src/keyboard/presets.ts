export type PresetId = 'studio' | 'dark' | 'glass' | 'neon';

export type MaterialPreset = {
  color: string;
  roughness: number;
  metalness: number;
  transmission?: number;
  thickness?: number;
  clearcoat?: number;
  ior?: number;
};

export interface KeyboardPreset {
  id: PresetId;
  name: string;
  shortName: string;
  background: string;
  ui: { ink: string; muted: string; subtle: string; line: string; selection: string; controlSurface: string; controlActive: string };
  lighting: {
    sky: string;
    ground: string;
    ambient: number;
    key: { color: string; intensity: number; position: [number, number, number] };
    fill: { color: string; intensity: number; position: [number, number, number] };
    rim: { color: string; intensity: number; position: [number, number, number] };
    exposure: number;
  };
  housing: { body: MaterialPreset; edge: MaterialPreset; plate: MaterialPreset };
  keycaps: Record<'ivory' | 'gray' | 'orange', { top: MaterialPreset; side: MaterialPreset; legend: string }>;
  accent: string;
  effect: { colors: readonly string[]; idleOpacity: number; holdOpacity: number; pulseOpacity: number; ringOpacity: number; duration: number; spread: number };
  mood: { environmentIntensity: number; shadowOpacity: number; contactOpacity: number; legendGlow: number };
}

/** Complete art directions; switching a preset never reconstructs the keyboard. */
export const PRESETS: readonly KeyboardPreset[] = [
  {
    id: 'studio', name: 'Minimal Studio', shortName: 'Studio', background: '#f1efe9',
    ui: { ink: '#343633', muted: '#78776f', subtle: '#8a877d', line: '#d8d5cc', selection: '#d8996d55', controlSurface: '#e8e5dc', controlActive: '#faf8f2' },
    lighting: {
      sky: '#fff9ec', ground: '#b3b1a8', ambient: 1.9,
      key: { color: '#fff5e5', intensity: 2.8, position: [-7, 12, 5] },
      fill: { color: '#f1f5ed', intensity: 1.15, position: [7, 5, -8] },
      rim: { color: '#fff8ed', intensity: 0, position: [0, 7, -9] },
      exposure: 1.12,
    },
    housing: {
      body: { color: '#30322f', roughness: 0.69, metalness: 0.48 },
      edge: { color: '#565750', roughness: 0.48, metalness: 0.7 },
      plate: { color: '#242622', roughness: 0.9, metalness: 0.12 },
    },
    keycaps: {
      ivory: { top: { color: '#eeebdd', roughness: 0.77, metalness: 0 }, side: { color: '#c6c2b4', roughness: 0.82, metalness: 0 }, legend: '#383a35' },
      gray: { top: { color: '#aaa598', roughness: 0.76, metalness: 0 }, side: { color: '#858276', roughness: 0.82, metalness: 0 }, legend: '#383a35' },
      orange: { top: { color: '#db6935', roughness: 0.74, metalness: 0 }, side: { color: '#ac4a22', roughness: 0.72, metalness: 0 }, legend: '#fff1dc' },
    },
    accent: '#bd5732',
    effect: { colors: ['#e9974c'], idleOpacity: 0, holdOpacity: 0.2, pulseOpacity: 0.4, ringOpacity: 0.18, duration: 0.24, spread: 0.12 },
    mood: { environmentIntensity: 0, shadowOpacity: 0.09, contactOpacity: 0.78, legendGlow: 0 },
  },
  {
    id: 'dark', name: 'Dark Focus', shortName: 'Dark', background: '#141820',
    ui: { ink: '#e2e7ef', muted: '#a0a9bb', subtle: '#8792a6', line: '#2c3443', selection: '#8bbaff40', controlSurface: '#1e2531', controlActive: '#343f51' },
    lighting: {
      sky: '#cadbfa', ground: '#222839', ambient: 0.7,
      key: { color: '#e4edff', intensity: 1.5, position: [-5, 9, 6] },
      fill: { color: '#83a7e7', intensity: 0.7, position: [8, 5, -7] },
      rim: { color: '#b7d6ff', intensity: 1.7, position: [-3, 5, -9] },
      exposure: 0.95,
    },
    housing: {
      body: { color: '#171d27', roughness: 0.46, metalness: 0.62 },
      edge: { color: '#64748d', roughness: 0.3, metalness: 0.85 },
      plate: { color: '#121722', roughness: 0.74, metalness: 0.2 },
    },
    keycaps: {
      ivory: { top: { color: '#394353', roughness: 0.67, metalness: 0.1 }, side: { color: '#1f2733', roughness: 0.73, metalness: 0.05 }, legend: '#d9e8ff' },
      gray: { top: { color: '#252e3e', roughness: 0.61, metalness: 0.15 }, side: { color: '#171e2a', roughness: 0.7, metalness: 0.08 }, legend: '#d9e8ff' },
      orange: { top: { color: '#6388b1', roughness: 0.48, metalness: 0.18 }, side: { color: '#354d6d', roughness: 0.6, metalness: 0.15 }, legend: '#edf4ff' },
    },
    accent: '#a8c9f3',
    effect: { colors: ['#bfdfff'], idleOpacity: 0.06, holdOpacity: 0.2, pulseOpacity: 0.4, ringOpacity: 0.23, duration: 0.24, spread: 0.13 },
    mood: { environmentIntensity: 0.26, shadowOpacity: 0.2, contactOpacity: 0.8, legendGlow: 0.4 },
  },
  {
    id: 'glass', name: 'Frosted Glass / Future Soft', shortName: 'Glass', background: '#eaf1f5',
    ui: { ink: '#334b60', muted: '#647e91', subtle: '#738b9b', line: '#cad9e2', selection: '#7fbadd4a', controlSurface: '#dce7ee', controlActive: '#f5fafc' },
    lighting: {
      sky: '#f4fcff', ground: '#b2cddd', ambient: 1.05,
      key: { color: '#f7fcff', intensity: 1.8, position: [-6, 10, 6] },
      fill: { color: '#b2dbff', intensity: 0.85, position: [8, 5, -6] },
      rim: { color: '#e6f6ff', intensity: 1.1, position: [-4, 6, -8] },
      exposure: 0.94,
    },
    housing: {
      body: { color: '#c8e4f1', roughness: 0.25, metalness: 0, transmission: 0.6, thickness: 0.85, clearcoat: 0.65, ior: 1.45 },
      edge: { color: '#c2d4e0', roughness: 0.2, metalness: 0.88, clearcoat: 0.45 },
      plate: { color: '#93b4c9', roughness: 0.34, metalness: 0.35, clearcoat: 0.5 },
    },
    keycaps: {
      ivory: { top: { color: '#e7f4fa', roughness: 0.28, metalness: 0.04, transmission: 0.03, thickness: 0.3, clearcoat: 0.75, ior: 1.4 }, side: { color: '#b0d2e5', roughness: 0.35, metalness: 0, transmission: 0.18, thickness: 0.35, clearcoat: 0.5, ior: 1.4 }, legend: '#375c74' },
      gray: { top: { color: '#c2dbe9', roughness: 0.28, metalness: 0.09, transmission: 0.03, thickness: 0.3, clearcoat: 0.65, ior: 1.4 }, side: { color: '#8eafc6', roughness: 0.35, metalness: 0, transmission: 0.15, thickness: 0.35, clearcoat: 0.5, ior: 1.4 }, legend: '#375c74' },
      orange: { top: { color: '#8cbedb', roughness: 0.22, metalness: 0.14, transmission: 0.03, thickness: 0.3, clearcoat: 0.8, ior: 1.4 }, side: { color: '#6893b4', roughness: 0.3, metalness: 0, transmission: 0.12, thickness: 0.35, clearcoat: 0.5, ior: 1.4 }, legend: '#254a67' },
    },
    accent: '#487c9b',
    effect: { colors: ['#95ddfa'], idleOpacity: 0.025, holdOpacity: 0.18, pulseOpacity: 0.36, ringOpacity: 0.15, duration: 0.26, spread: 0.16 },
    mood: { environmentIntensity: 0.65, shadowOpacity: 0.08, contactOpacity: 0.58, legendGlow: 0 },
  },
  {
    id: 'neon', name: 'Playful Neon', shortName: 'Neon', background: '#201a2c',
    ui: { ink: '#eae2f4', muted: '#b2a4c5', subtle: '#a093b4', line: '#40344e', selection: '#d796ef40', controlSurface: '#2c243b', controlActive: '#4a375d' },
    lighting: {
      sky: '#e4d7f3', ground: '#392541', ambient: 0.85,
      key: { color: '#f4e9ff', intensity: 1.8, position: [-5, 10, 6] },
      fill: { color: '#85edd6', intensity: 1.25, position: [8, 5, -7] },
      rim: { color: '#f58bc9', intensity: 2.4, position: [-6, 6, -7] },
      exposure: 1.05,
    },
    housing: {
      body: { color: '#3e2e50', roughness: 0.35, metalness: 0.62, clearcoat: 0.38 },
      edge: { color: '#9878ba', roughness: 0.22, metalness: 0.82, clearcoat: 0.55 },
      plate: { color: '#241c32', roughness: 0.62, metalness: 0.16 },
    },
    keycaps: {
      ivory: { top: { color: '#b4a8d0', roughness: 0.48, metalness: 0.08, clearcoat: 0.3 }, side: { color: '#716083', roughness: 0.58, metalness: 0.12 }, legend: '#30243e' },
      gray: { top: { color: '#514668', roughness: 0.47, metalness: 0.14, clearcoat: 0.3 }, side: { color: '#352a48', roughness: 0.58, metalness: 0.12 }, legend: '#e5d8f3' },
      orange: { top: { color: '#be689e', roughness: 0.38, metalness: 0.16, clearcoat: 0.5 }, side: { color: '#783966', roughness: 0.48, metalness: 0.16 }, legend: '#ffebf8' },
    },
    accent: '#e6a0d7',
    effect: { colors: ['#80efd3', '#f591cd', '#93b9ff'], idleOpacity: 0.04, holdOpacity: 0.22, pulseOpacity: 0.48, ringOpacity: 0.3, duration: 0.24, spread: 0.16 },
    mood: { environmentIntensity: 0.5, shadowOpacity: 0.17, contactOpacity: 0.75, legendGlow: 0.08 },
  },
];

export const DEFAULT_PRESET = PRESETS[0];
