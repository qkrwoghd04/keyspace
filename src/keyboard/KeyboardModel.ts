import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BOARD_WIDTH, KEYS } from './layout';
import { keycapGeometry } from './geometry';
import { createLegendAtlas } from './legends';
import { Keycap } from './Keycap';

export class KeyboardModel {
  readonly group = new THREE.Group();
  readonly keys: Keycap[] = [];
  readonly hitTargets: THREE.Mesh[] = [];
  readonly bounds: THREE.Box3;

  constructor() {
    this.group.name = 'KEYSPACE / 01';
    const housingMaterial = new THREE.MeshStandardMaterial({color: '#30322f', roughness: 0.69, metalness: 0.48});
    const edgeMaterial = new THREE.MeshStandardMaterial({color: '#565750', roughness: 0.48, metalness: 0.7});
    const plateMaterial = new THREE.MeshStandardMaterial({color: '#242622', roughness: 0.9, metalness: 0.12});
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

    const ivorySide = new THREE.MeshStandardMaterial({color: '#c6c2b4', roughness: 0.82});
    const ivoryTop = new THREE.MeshStandardMaterial({color: '#eeebdd', roughness: 0.77});
    const graySide = new THREE.MeshStandardMaterial({color: '#858276', roughness: 0.82});
    const grayTop = new THREE.MeshStandardMaterial({color: '#aaa598', roughness: 0.76});
    const orangeSide = new THREE.MeshStandardMaterial({color: '#ac4a22', roughness: 0.72});
    const orangeTop = new THREE.MeshStandardMaterial({color: '#db6935', roughness: 0.74});
    const materials = {ivory: [ivorySide, ivoryTop], gray: [graySide, grayTop], orange: [orangeSide, orangeTop]};
    const geometries = new Map<number, THREE.BufferGeometry>();
    const atlas = createLegendAtlas();
    KEYS.forEach((definition, index) => {
      if (!geometries.has(definition.width)) geometries.set(definition.width, keycapGeometry(definition.width));
      const key = new Keycap(definition, index, geometries.get(definition.width)!, materials[definition.tone], atlas.material, BOARD_WIDTH / 2, 2.625);
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
    const indicator = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.15, 4, 8), new THREE.MeshStandardMaterial({color: '#d88a50', emissive: '#e88a40', emissiveIntensity: 0.35, roughness: 0.6}));
    indicator.rotation.z = Math.PI / 2;
    indicator.position.set(width / 2 - 0.61, 0.711, depth / 2 + 0.002);
    this.group.add(indicator);
    this.bounds = new THREE.Box3().setFromObject(this.group);
  }

  update(delta: number, pressed: ReadonlySet<string>, reducedMotion: boolean) {
    let moving = false;
    for (const key of this.keys) moving = key.update(delta, pressed.has(key.definition.code), reducedMotion) || moving;
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
