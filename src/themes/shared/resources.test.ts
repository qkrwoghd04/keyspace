import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeObject } from '../../keyboard/KeyboardModel';

describe('theme resource ownership', () => {
  it('disposes shared GPU objects once and includes instanced buffers, lines, points and uniforms', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const texture = new THREE.Texture(), atlas = new THREE.Texture();
    const material = new THREE.ShaderMaterial({ uniforms: { image: { value: texture }, legends: { value: atlas } } });
    const instance = new THREE.InstancedMesh(geometry, material, 8);
    root.add(instance, new THREE.Mesh(geometry, material), new THREE.LineSegments(geometry, material), new THREE.Points(geometry, material));
    const geometryDispose = vi.spyOn(geometry, 'dispose'), materialDispose = vi.spyOn(material, 'dispose');
    const instanceDispose = vi.spyOn(instance, 'dispose'), textureDispose = vi.spyOn(texture, 'dispose'), atlasDispose = vi.spyOn(atlas, 'dispose');
    disposeObject(root, new Set([atlas]));
    expect(geometryDispose).toHaveBeenCalledTimes(1); expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(instanceDispose).toHaveBeenCalledTimes(1); expect(textureDispose).toHaveBeenCalledTimes(1); expect(atlasDispose).not.toHaveBeenCalled();
  });
});
