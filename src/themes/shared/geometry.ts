import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { random } from './random';

/** Closed, irregular beveled solid. Its upper center stays legible and touchable. */
export function fracturedSolid(width: number, depth: number, height: number, seed: number, jagged = 0.1, count = 20, roundedness = .36) {
  const rng = random(seed);
  const outline = Array.from({ length: count }, (_, i) => {
    const angle = i / count * Math.PI * 2;
    const x = Math.sign(Math.cos(angle)) * Math.abs(Math.cos(angle)) ** roundedness;
    const z = Math.sign(Math.sin(angle)) * Math.abs(Math.sin(angle)) ** roundedness;
    const cut = 1 - rng() * jagged;
    return [x * width / 2 * cut, z * depth / 2 * cut] as const;
  });
  const positions: number[] = [];
  const indices: number[] = [];
  const layers = [{ s: .86, y: 0 }, { s: 1, y: height * .17 }, { s: .97, y: height * .69 }, { s: .79, y: height }];
  layers.forEach((layer, j) => {
    outline.forEach(([x, z]) => positions.push(x * layer.s, layer.y + (j === 1 || j === 2 ? (rng() - .5) * height * .13 : 0), z * layer.s));
    if (j > 0) for (let i = 0; i < count; i++) {
      const a = (j - 1) * count + i, b = (j - 1) * count + (i + 1) % count;
      const c = j * count + i, d = j * count + (i + 1) % count;
      indices.push(a, c, b, b, c, d);
    }
  });
  const bottom = positions.length / 3; positions.push(0, 0, 0);
  const top = positions.length / 3; positions.push(0, height, 0);
  for (let i = 0; i < count; i++) {
    indices.push(i, (i + 1) % count, bottom);
    indices.push((layers.length - 1) * count + i, top, (layers.length - 1) * count + (i + 1) % count);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  flat.computeVertexNormals();
  return flat;
}

/** Pudding has a genuinely curved shoulder and a closed underside. */
export function puddingSolid(width: number, depth = .9, height = .66, roundness = .26) {
  const geometry = new RoundedBoxGeometry(width, height, depth, 5, Math.min(roundness, depth / 2, height / 2));
  geometry.translate(0, height / 2, 0);
  return geometry;
}

export function curvedTube(points: THREE.Vector3[], radius: number, radialSegments = 7) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, Math.max(12, points.length * 5), radius, radialSegments, false);
}

export function lineSegments(points: number[], color: THREE.ColorRepresentation, opacity = 1) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false }));
}
