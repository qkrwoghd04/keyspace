import * as THREE from 'three';

/** Rounded perimeter, clockwise when viewed from above. */
function perimeter(width: number, depth: number, radius: number) {
  const points: [number, number][] = [];
  const corners = [
    [width / 2 - radius, depth / 2 - radius, 0],
    [-width / 2 + radius, depth / 2 - radius, Math.PI / 2],
    [-width / 2 + radius, -depth / 2 + radius, Math.PI],
    [width / 2 - radius, -depth / 2 + radius, Math.PI * 1.5],
  ];
  for (const [x, z, start] of corners) {
    for (let i = 0; i <= 6; i++) {
      const angle = start + i / 6 * Math.PI / 2;
      points.push([x + Math.cos(angle) * radius, z + Math.sin(angle) * radius]);
    }
  }
  return points;
}

/** A tapered cap with a rolled shoulder and shallow cylindrical dish. */
export function keycapGeometry(units: number) {
  const width = units - 0.075;
  const rings = [
    { w: width - 0.03, d: 0.87, r: 0.085, y: 0 },
    { w: width, d: 0.91, r: 0.095, y: 0.035 },
    { w: width - 0.12, d: 0.79, r: 0.11, y: 0.32 },
    { w: width - 0.19, d: 0.72, r: 0.105, y: 0.408 },
    { w: width - 0.245, d: 0.665, r: 0.09, y: 0.44 },
    { w: width - 0.31, d: 0.60, r: 0.075, y: 0.441 },
    { w: (width - 0.31) * 0.64, d: 0.384, r: 0.048, y: 0.441 },
    { w: (width - 0.31) * 0.25, d: 0.15, r: 0.019, y: 0.441 },
  ];
  const positions: number[] = [];
  const indices: number[] = [];
  const count = 28;
  for (let j = 0; j < rings.length; j++) {
    const ring = rings[j];
    for (const [x, z] of perimeter(ring.w, ring.d, ring.r)) {
      const dish = j >= 4 ? 0.025 * (1 - (z / 0.333) ** 2) : 0;
      positions.push(x, ring.y - dish, z);
    }
    if (j === 0) continue;
    for (let i = 0; i < count; i++) {
      const a = (j - 1) * count + i;
      const b = (j - 1) * count + (i + 1) % count;
      const c = j * count + i;
      const d = j * count + (i + 1) % count;
      indices.push(a, c, b, b, c, d);
    }
  }
  const center = positions.length / 3;
  positions.push(0, 0.416, 0);
  for (let i = 0; i < count; i++) {
    indices.push((rings.length - 1) * count + i, center, (rings.length - 1) * count + (i + 1) % count);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.addGroup(0, count * 6 * 3, 0);
  geometry.addGroup(count * 6 * 3, indices.length - count * 6 * 3, 1);
  geometry.computeVertexNormals();
  return geometry;
}

export function roundedPlate(width: number, height: number, radius = 0.1) {
  const shape = new THREE.Shape();
  const x = -width / 2, y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return new THREE.ShapeGeometry(shape, 10);
}
