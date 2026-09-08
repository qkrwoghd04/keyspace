import * as THREE from 'three';
import { KEYS, type KeyDefinition } from './layout';

const CELL = 256;
const COLUMNS = 10;

/** All legends share one locally generated texture. No fonts or assets are fetched. */
export function createLegendAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = CELL * COLUMNS;
  canvas.height = CELL * Math.ceil(KEYS.length / COLUMNS);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas text rendering is unavailable.');
  context.textBaseline = 'middle';
  KEYS.forEach((key, index) => {
    const x = (index % COLUMNS) * CELL;
    const y = Math.floor(index / COLUMNS) * CELL;
    context.save();
    context.translate(x, y);
    // Wide caps use a wide physical decal: compensate for its stretching.
    const stretch = Math.max(1, (key.width - 0.32) / 0.68);
    context.scale(1 / stretch, 1);
    context.fillStyle = '#ffffff';
    const isLetter = /^Key[A-Z]$/.test(key.code);
    const isArrow = key.code.startsWith('Arrow');
    context.font = `${isLetter ? 500 : 500} ${isLetter ? 68 : isArrow ? 78 : key.label.length > 3 ? 43 : 49}px "Helvetica Neue", Helvetica, sans-serif`;
    const left = 48;
    if (key.code === 'Space') {
      // A tiny maker's dash, deliberately quiet on the spacebar.
      context.globalAlpha = 0.4;
      context.fillRect(CELL * stretch / 2 - 23, 166, 46, 3);
    } else if (key.secondary) {
      context.font = '500 48px "Helvetica Neue", Helvetica, sans-serif';
      context.fillText(key.secondary, left, 76);
      context.fillText(key.label, left, 171);
    } else if (isArrow) {
      context.textAlign = 'center';
      context.fillText(key.label, CELL * stretch / 2, 123);
    } else {
      context.fillText(key.label, left, isLetter ? 98 : 117);
    }
    context.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { texture };
}

export function legendGeometry(key: KeyDefinition, index: number) {
  const geometry = new THREE.PlaneGeometry(key.width - 0.32, 0.59, 1, 8);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const rows = Math.ceil(KEYS.length / COLUMNS);
  for (let i = 0; i < position.count; i++) {
    const oldY = position.getY(i);
    position.setXYZ(i, position.getX(i), 0.443 - 0.025 * (1 - (oldY / 0.333) ** 2), -oldY);
    uv.setXY(i, ((index % COLUMNS) + uv.getX(i)) / COLUMNS, 1 - (Math.floor(index / COLUMNS) + 1 - uv.getY(i)) / rows);
  }
  geometry.computeVertexNormals();
  return geometry;
}
