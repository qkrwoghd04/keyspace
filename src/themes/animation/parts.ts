import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { surfaceMaterial } from '../shared/material';

export function part(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function box(parent: THREE.Object3D, size: [number, number, number], material: THREE.Material, position: [number, number, number], round = .03) {
  return part(parent, round ? new RoundedBoxGeometry(...size, 2, Math.min(round, ...size.map(value => value / 2))) : new THREE.BoxGeometry(...size), material, ...position);
}
export function ellipsoid(parent: THREE.Object3D, radius: number, scale: [number, number, number], material: THREE.Material, position: [number, number, number]) {
  const mesh = part(parent, new THREE.SphereGeometry(radius, 20, 12), material, ...position);
  mesh.scale.set(...scale); return mesh;
}
export function rod(parent: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material) {
  const offset = to.clone().sub(from);
  const mesh = part(parent, new THREE.CylinderGeometry(radius, radius, offset.length(), 10), material);
  mesh.position.copy(from).add(to).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), offset.normalize());
  return mesh;
}
export function gearGeometry(radius: number, teeth = 14) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= teeth * 4; i++) {
    const angle = i / (teeth * 4) * Math.PI * 2;
    const r = radius * (i % 4 === 1 || i % 4 === 2 ? 1 : .8);
    const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
    if (!i) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, radius * .23, 0, Math.PI * 2, true); shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape, { depth: .13, bevelEnabled: true, bevelSize: .025, bevelThickness: .02, bevelSegments: 1, steps: 1, curveSegments: 16 });
}
export function celGradient() {
  const data = new Uint8Array([62, 126, 195, 255]);
  const texture = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false; texture.needsUpdate = true;
  return texture;
}
export function cel(color: THREE.ColorRepresentation, gradientMap: THREE.Texture) { return new THREE.MeshToonMaterial({ color, gradientMap }); }
export function outline(mesh: THREE.Mesh, material: THREE.Material, scale = 1.035) {
  const ink = new THREE.Mesh(mesh.geometry, material);
  ink.scale.setScalar(scale); mesh.add(ink); return ink;
}
export function painted(color: string, wood = false) {
  return surfaceMaterial({ color, roughness: .83, metalness: .08, envMapIntensity: .25 }, wood ? 'painted-wood' : 'painted-metal',
    `float grain=ksFbm(vKsPosition*vec3(${wood ? '1.5,18.,8.' : '4.,10.,5.'})); diffuseColor.rgb*=.78+grain*.35; roughnessFactor=.72+grain*.23;`);
}
export function easeWindow(progress: number, start: number, end: number) {
  const t = THREE.MathUtils.clamp((progress - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}
