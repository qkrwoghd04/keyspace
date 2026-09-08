import * as THREE from 'three';

/** One soft footprint shared by all keys; no full-screen bloom pass. */
export function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.filter = 'blur(8px)';
  context.strokeStyle = '#ffffff';
  context.lineWidth = 12;
  context.beginPath();
  context.roundRect(21, 21, 86, 86, 15);
  context.stroke();
  return new THREE.CanvasTexture(canvas);
}

export function createRingGeometry() {
  const shape = new THREE.Shape();
  const rounded = (path: THREE.Path, inset: number) => {
    const min = -0.5 + inset, max = 0.5 - inset, r = 0.12;
    path.moveTo(min + r, min);
    path.lineTo(max - r, min); path.quadraticCurveTo(max, min, max, min + r);
    path.lineTo(max, max - r); path.quadraticCurveTo(max, max, max - r, max);
    path.lineTo(min + r, max); path.quadraticCurveTo(min, max, min, max - r);
    path.lineTo(min, min + r); path.quadraticCurveTo(min, min, min + r, min);
  };
  rounded(shape, 0);
  const hole = new THREE.Path();
  rounded(hole, 0.018);
  shape.holes.push(hole);
  return new THREE.ShapeGeometry(shape, 6);
}
