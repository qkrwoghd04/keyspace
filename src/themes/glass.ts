import * as THREE from 'three';
import { KEYS } from '../keyboard/layout';
import { BaseRuntime, type KeyBody } from './shared/BaseRuntime';
import { puddingSolid, lineSegments } from './shared/geometry';
import { surfaceMaterial } from './shared/material';
import type { ThemeContext } from './types';

/** Optical glass: closed volumes around opaque, genuinely modeled mechanisms. */
export default class Glass extends BaseRuntime {
  private readonly pulses: THREE.IUniform<number>[] = [];
  private readonly springs: THREE.InstancedMesh;
  private readonly springPose = new THREE.Object3D();

  constructor(context: ThemeContext) {
    super(context);
    this.group.name = 'GLASS / precision optical assembly';
    const optical: THREE.MeshPhysicalMaterialParameters = {
      color: '#e1f2f0', transmission: .94, opacity: 1, thickness: .6, ior: 1.52,
      roughness: .028, metalness: 0, envMapIntensity: .72, attenuationColor: '#a6cecd', attenuationDistance: 7,
    };
    const housing = new THREE.Mesh(puddingSolid(17.4, 7.2, .71, .12), new THREE.MeshPhysicalMaterial({ ...optical, thickness: .9, roughness: .04 }));
    housing.position.y = .13; housing.castShadow = housing.receiveShadow = true; this.group.add(housing);
    const pcb = new THREE.Mesh(puddingSolid(16.65, 6.55, .075, .03), new THREE.MeshStandardMaterial({ color: '#669294', roughness: .5, metalness: .3 }));
    pcb.position.y = .44; this.group.add(pcb);
    const traces: number[] = [];
    for (let row = 0; row < 6; row++) {
      const z = -2.6 + row * 1.03;
      traces.push(-7.9, .518, z, 7.9, .518, z, -7.6, .518, z + .12, 7.5, .518, z + .12);
    }
    this.group.add(lineSegments(traces, '#bfc4a5', .7));
    const railMaterial = new THREE.MeshStandardMaterial({ color: '#b4cdcb', metalness: .8, roughness: .24 });
    const railGeometry = new THREE.CylinderGeometry(.045, .045, 15.9, 8);
    for (const z of [-3.05, 3.05]) {
      const rail = new THREE.Mesh(railGeometry, railMaterial); rail.rotation.z = Math.PI / 2; rail.position.set(0, .3, z); this.group.add(rail);
    }

    const springPoints = Array.from({ length: 49 }, (_, i) => {
      const t = i / 48; return new THREE.Vector3(Math.cos(t * Math.PI * 8) * .11, t * .38, Math.sin(t * Math.PI * 8) * .11);
    });
    const springGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPoints), 48, .011, 4, false);
    const springMaterial = new THREE.MeshStandardMaterial({ color: '#6b7a80', metalness: .65, roughness: .2 });
    const socketGeometry = new THREE.BoxGeometry(.35, .13, .35);
    const socketMaterial = new THREE.MeshStandardMaterial({ color: '#354a52', roughness: .4, metalness: .4 });
    this.springs = new THREE.InstancedMesh(springGeometry, springMaterial, KEYS.length);
    this.springs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const sockets = new THREE.InstancedMesh(socketGeometry, socketMaterial, KEYS.length);
    const matrix = new THREE.Matrix4();
    this.group.add(this.springs, sockets);
    const geometries = new Map<number, THREE.BufferGeometry>();
    KEYS.forEach((definition, i) => {
      if (!geometries.has(definition.width)) geometries.set(definition.width, puddingSolid(definition.width - .095, .91, .58, .065));
      const pulse = { value: -1 }; this.pulses.push(pulse);
      const material = surfaceMaterial({ ...optical, color: definition.tone === 'orange' ? '#bdd7d4' : '#e1f2f0' }, 'optical-glass', `
        float edge=pow(clamp(max(abs(vKsPosition.x)/uHalfWidth,abs(vKsPosition.z)/.455),0.,1.),24.);
        float angle=atan(vKsPosition.z/.455,vKsPosition.x/uHalfWidth)/6.28318+.5;
        float d=abs(angle-uPulse); d=min(d,1.-d);
        float light=exp(-d*d*180.)*step(0.,uPulse);
        totalEmissiveRadiance+=vec3(.28,.8,.88)*edge*light*.9;
      `, { uPulse: pulse, uHalfWidth: { value: (definition.width - .095) / 2 } }, 'uniform float uPulse; uniform float uHalfWidth;');
      const key = this.addKey(definition, i, geometries.get(definition.width)!, material, .88 + (5.25 - definition.z) * .014, .58, '#46666c');
      matrix.makeTranslation(key.x, .71, key.z); sockets.setMatrixAt(i, matrix);
      matrix.makeTranslation(key.x, .75, key.z); this.springs.setMatrixAt(i, matrix);
    });
    this.bounds.set(new THREE.Vector3(-8.9, 0, -3.75), new THREE.Vector3(8.9, 1.8, 3.75));
  }
  protected override pose(key: KeyBody, reduced: boolean) {
    super.pose(key, reduced);
    this.pulses[key.index].value = key.state.age < .34 ? key.state.age / .34 : -1;
    this.springPose.position.set(key.x, .75, key.z);
    this.springPose.scale.set(1, 1 - key.state.displacement * .45, 1);
    this.springPose.updateMatrix();
    this.springs.setMatrixAt(key.index, this.springPose.matrix);
    this.springs.instanceMatrix.needsUpdate = true;
  }
}
