import type * as THREE from 'three';
import type { KeyboardInput } from '../input/KeyboardInput';
import type { KeyboardPreset } from '../keyboard/presets';
import type { JudgmentEvent } from '../challenge/types';

export type AnimationThemeId = 'demon-slayer' | 'pokemon' | 'spider-verse' | 'howl' | 'evangelion';
export type ThemeId = 'studio' | 'dark' | 'glass' | 'neon' | 'inferno' | 'glacier' | 'jelly' | 'grove' | 'orbit' | AnimationThemeId;
export type ThemeCategory = 'CLASSIC' | 'EXPERIMENTAL' | 'ANIMATION';
export type SceneAppearance = Pick<KeyboardPreset, 'background' | 'ui' | 'lighting' | 'accent' | 'mood'>;

export interface QualitySettings {
  level: 'standard' | 'low';
  dpr: number;
  shadowSize: number;
  transmissionScale: number;
  particles: number;
  flames: number;
  waves: number;
}

export const STANDARD_QUALITY: QualitySettings = {
  level: 'standard', dpr: 2, shadowSize: 2048, transmissionScale: 0.5, particles: 128, flames: 48, waves: 12,
};
export const LOW_QUALITY: QualitySettings = {
  level: 'low', dpr: 1.25, shadowSize: 1024, transmissionScale: 0.35, particles: 48, flames: 20, waves: 4,
};

export interface ThemeContext {
  legendTexture: THREE.Texture;
  quality: QualitySettings;
}

export interface ThemeRuntime {
  readonly group: THREE.Group;
  readonly hitTargets: THREE.Mesh[];
  /** Conservative hero bounds, including maximum motion, but not the background. */
  readonly bounds: THREE.Box3;
  update(delta: number, input: KeyboardInput, reducedMotion: boolean): boolean;
  reset(input: KeyboardInput): void;
  setQuality(quality: QualitySettings): void;
  diagnostics(): ThemeDiagnostics;
  setChallengeActive?(active: boolean): void;
  onChallengeEvent?(event: JudgmentEvent): void;
  dispose(): void;
}

export interface ThemeDiagnostics {
  particles: number;
  flames: number;
  waves: number;
  signature?: { active: boolean; kind: 'enter' | 'space'; progress: number; starts: number; queued: 0 };
  strikes?: number;
  recentKeys?: string[];
  mechanism?: Record<string, number | string | boolean>;
}

export type ThemeFactory = (context: ThemeContext) => ThemeRuntime;

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  category: ThemeCategory;
  material: string;
  thumbnail: string;
  colorScheme: 'light' | 'dark';
  swatches: readonly [string, string, string];
  appearance: SceneAppearance;
  load: () => Promise<ThemeFactory>;
}
