import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BOARD_WIDTH, KEYS } from './layout';
import { keycapGeometry } from './geometry';
import { createLegendAtlas } from './legends';
import { Keycap } from './Keycap';
import { createGlowTexture, createRingGeometry } from './effects';
import { DEFAULT_PRESET, type KeyboardPreset, type MaterialPreset } from './presets';
import type { KeyboardInput } from '../input/KeyboardInput';

const TONES = ['ivory', 'gray', 'orange'] as const;
const pair = () => [new THREE.MeshPhysicalMaterial(), new THREE.MeshPhysicalMaterial()] as const;

export class KeyboardModel {
  readonly group = new THREE.Group();
  readonly keys: Keycap[] = [];
  readonly hitTargets: THREE.Mesh[] = [];
  readonly bounds: THREE.Box3;
  private readonly caseMaterials = {body: new THREE.MeshPhysicalMaterial(), edge: new THREE.MeshPhysicalMaterial(), plate: new THREE.MeshPhysicalMaterial()};
  private readonly capMaterials = {ivory: [...pair()], gray: [...pair()], orange: [...pair()]};
  private readonly legendMaterials: Record<typeof TONES[number], THREE.MeshPhysicalMaterial>;
  private readonly indicatorMaterial = new THREE.MeshStandardMaterial({emissiveIntensity: 0.35, roughness: 0.6});
  private readonly color = new THREE.Color();

  constructor() {
    this.group.name = 'KEYSPACE / 01';
    const {body: housingMaterial, edge: edgeMaterial, plate: plateMaterial} = this.caseMaterials;
    const width = BOARD_WIDTH + 0.65;
    const depth = 6.96;
    const addBox = (w: number, h: number, d: number, y: number, radius: number, material: THREE.Material) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material);
      mesh.position.y = y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    addBox(width - 0.045, 0.43, depth - 0.045, 0.34, 0.16, housingMaterial);
    // A fine machined seam catches the softbox just above the bottom case.
    addBox(width - 0.015, 0.034, depth - 0.015, 0.546, 0.014, edgeMaterial);
    addBox(width, 0.30, depth, 0.706, 0.135, housingMaterial);
    addBox(BOARD_WIDTH + 0.115, 0.055, 6.43, 0.837, 0.025, plateMaterial);

    const materials = this.capMaterials;
    const geometries = new Map<number, THREE.BufferGeometry>();
    const atlas = createLegendAtlas();
    // Matte ink stays readable beneath the glass preset's softbox reflections.
    const legendMaterial = () => new THREE.MeshPhysicalMaterial({
      map: atlas.texture, emissiveMap: atlas.texture, transparent: true, roughness: 1,
      specularIntensity: 0, envMapIntensity: 0,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
    });
    this.legendMaterials = {ivory: legendMaterial(), gray: legendMaterial(), orange: legendMaterial()};
    const glowTexture = createGlowTexture();
    const glowGeometry = new THREE.PlaneGeometry(1, 1);
    const ringGeometry = createRingGeometry();
    KEYS.forEach((definition, index) => {
      if (!geometries.has(definition.width)) geometries.set(definition.width, keycapGeometry(definition.width));
      const key = new Keycap(definition, index, geometries.get(definition.width)!, materials[definition.tone], this.legendMaterials[definition.tone], BOARD_WIDTH / 2, 2.625, glowTexture, glowGeometry, ringGeometry);
      this.keys.push(key);
      this.hitTargets.push(key.mesh);
      this.group.add(key.group, key.glow);
    });

    const screwGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.008, 16);
    const screwMaterial = new THREE.MeshStandardMaterial({color: '#85857b', roughness: 0.47, metalness: 0.85});
    for (const x of [-width / 2 + 0.18, width / 2 - 0.18]) {
      for (const z of [-depth / 2 + 0.18, depth / 2 - 0.18]) {
        const screw = new THREE.Mesh(screwGeometry, screwMaterial);
        screw.position.set(x, 0.854, z);
        this.group.add(screw);
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.057, 0.01, 0.013), plateMaterial);
        slot.position.copy(screw.position).y += 0.004;
        slot.rotation.y = Math.PI / 4;
        this.group.add(slot);
      }
    }
    const badge = document.createElement('canvas');
    badge.width = 1024; badge.height = 128;
    const context = badge.getContext('2d')!;
    context.fillStyle = '#b5b6a9';
    context.font = '400 44px Helvetica, sans-serif';
    context.textBaseline = 'middle';
    context.fillText('K E Y S P A C E', 20, 64);
    context.fillStyle = '#828679';
    context.font = '400 27px Helvetica, sans-serif';
    context.fillText('S T U D I O   /   0 1', 625, 64);
    const badgeTexture = new THREE.CanvasTexture(badge);
    badgeTexture.colorSpace = THREE.SRGBColorSpace;
    const badgeMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.28), new THREE.MeshStandardMaterial({map: badgeTexture, transparent: true, roughness: 0.8, depthWrite: false}));
    badgeMesh.position.set(-width / 2 + 2.45, 0.716, depth / 2 + 0.003);
    this.group.add(badgeMesh);
    const indicator = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.15, 4, 8), this.indicatorMaterial);
    indicator.rotation.z = Math.PI / 2;
    indicator.position.set(width / 2 - 0.61, 0.711, depth / 2 + 0.002);
    this.group.add(indicator);
    this.bounds = new THREE.Box3().setFromObject(this.group);
    this.updateAppearance(DEFAULT_PRESET, 1);
  }

  private mixMaterial(material: THREE.MeshPhysicalMaterial, target: MaterialPreset, blend: number, environment: number) {
    material.color.lerp(this.color.set(target.color), blend);
    material.roughness = THREE.MathUtils.lerp(material.roughness, target.roughness, blend);
    material.metalness = THREE.MathUtils.lerp(material.metalness, target.metalness, blend);
    material.transmission = THREE.MathUtils.lerp(material.transmission, target.transmission ?? 0, blend);
    material.thickness = THREE.MathUtils.lerp(material.thickness, target.thickness ?? 0, blend);
    material.clearcoat = THREE.MathUtils.lerp(material.clearcoat, target.clearcoat ?? 0, blend);
    material.clearcoatRoughness = 0.2;
    material.ior = THREE.MathUtils.lerp(material.ior, target.ior ?? 1.5, blend);
    material.envMapIntensity = THREE.MathUtils.lerp(material.envMapIntensity, environment, blend);
  }

  updateAppearance(preset: KeyboardPreset, blend: number) {
    for (const role of ['body', 'edge', 'plate'] as const) this.mixMaterial(this.caseMaterials[role], preset.housing[role], blend, preset.mood.environmentIntensity);
    for (const tone of TONES) {
      this.mixMaterial(this.capMaterials[tone][0], preset.keycaps[tone].side, blend, preset.mood.environmentIntensity);
      this.mixMaterial(this.capMaterials[tone][1], preset.keycaps[tone].top, blend, preset.mood.environmentIntensity);
      const legend = this.legendMaterials[tone];
      legend.color.lerp(this.color.set(preset.keycaps[tone].legend), blend);
      legend.emissive.copy(legend.color);
      legend.emissiveIntensity = THREE.MathUtils.lerp(legend.emissiveIntensity, preset.mood.legendGlow, blend);
    }
    this.indicatorMaterial.color.lerp(this.color.set(preset.accent), blend);
    this.indicatorMaterial.emissive.copy(this.indicatorMaterial.color);
    for (const key of this.keys) key.setEffect(preset.effect, blend);
  }

  clearEffects(input: KeyboardInput) {
    for (const key of this.keys) key.clearEffects(input.getPressVersion(key.definition.code));
  }

  update(delta: number, input: KeyboardInput, reducedMotion: boolean) {
    let moving = false;
    for (const key of this.keys) moving = key.update(delta, input.pressed.has(key.definition.code), reducedMotion, input.getPressVersion(key.definition.code)) || moving;
    return moving;
  }
}

/** Shared GPU resources are released exactly once, including generated textures. */
export function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => texture.dispose());
}
