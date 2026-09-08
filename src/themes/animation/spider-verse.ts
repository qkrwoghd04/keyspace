import * as THREE from 'three';
import { KEYS } from '../../keyboard/layout';
import type { QualitySettings, ThemeContext } from '../types';
import type { KeyBody } from '../shared/BaseRuntime';
import { lineSegments, puddingSolid } from '../shared/geometry';
import { AnimationRuntime } from './AnimationRuntime';
import { RibbonPool } from './RibbonPool';
import { box, celGradient, outline, part } from './parts';

/** Inverted hull ink, cel bands and object-space print dots: no screen-space image filter. */
function printed(color: string, gradient: THREE.Texture) {
  const material = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPrint;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPrint=position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPrint;').replace('#include <opaque_fragment>', `
      vec2 screen=fract(vPrint.xz*11.+vPrint.y*vec2(3.,7.))-.5;
      float dots=1.-smoothstep(.18,.23,length(screen));
      float shade=clamp(1.-dot(outgoingLight,vec3(.3,.6,.1))*.7,0.,1.);
      outgoingLight*=1.-dots*(.22+shade*.43);
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'keyspace:spider-verse-print';
  return material;
}

export default class SpiderVerse extends AnimationRuntime {
  private readonly ghosts: { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; age: number; x: number; y: number; z: number; side: number }[] = [];
  private ghostCursor = 0;
  private readonly lines: RibbonPool;
  private readonly burst = new THREE.Group();
  private readonly sheets: THREE.Mesh[] = [];
  private readonly heroLines: RibbonPool;
  private frame = 0;

  constructor(context: ThemeContext) {
    super(context);
    this.group.name = 'SPIDER-VERSE / printed motion laboratory';
    const gradient = celGradient();
    const ink = new THREE.MeshBasicMaterial({ color: '#241b2d', side: THREE.BackSide });
    const magenta = new THREE.MeshBasicMaterial({ color: '#c83970' }), cyan = new THREE.MeshBasicMaterial({ color: '#2e929d' });
    const panel = new THREE.Shape();
    panel.moveTo(-8.8, -3.45); panel.lineTo(7.6, -3.7); panel.lineTo(9.05, -2.8); panel.lineTo(8.9, 3.3); panel.lineTo(-7.9, 3.6); panel.lineTo(-9.1, 2.5); panel.closePath();
    const panelGeometry = new THREE.ExtrudeGeometry(panel, { depth: .24, bevelEnabled: false }); panelGeometry.rotateX(-Math.PI / 2);
    const underneath = part(this.group, panelGeometry, cyan, -.18, .27, .2); underneath.rotation.y = -.026;
    const misprint = part(this.group, panelGeometry, magenta, .19, .5, -.12); misprint.rotation.y = .02; this.sheets.push(underneath, misprint);
    const top = part(this.group, panelGeometry, printed('#cf685d', gradient), 0, .74, 0); outline(top, ink, 1.018);
    box(this.group, [16.75, .12, 6.47], printed('#332d40', gradient), [0, 1.01, 0], .07);
    const web: number[] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) web.push(side * 8.9, .97, -3.4, side * (6.1 + i * .43), .98, 3.35);
      for (let i = 0; i < 4; i++) web.push(side * 8.85, 1.0, -1.6 + i * 1.15, side * (7.3 - i * .4), 1.0, 3.4);
    }
    this.group.add(lineSegments(web, '#251f30'));
    const materials = [printed('#e8d9a3', gradient), printed('#3f3c52', gradient), printed('#c44263', gradient)];
    const geometries = new Map<number, THREE.BufferGeometry>();
    KEYS.forEach((definition, i) => {
      if (!geometries.has(definition.width)) geometries.set(definition.width, puddingSolid(definition.width - .13, .85, .41, .045));
      const dark = definition.tone === 'gray';
      const key = this.addKey(definition, i, geometries.get(definition.width)!, materials[definition.tone === 'orange' ? 2 : dark ? 1 : 0], 1.09, .41, dark ? '#e8dcae' : '#292034');
      outline(key.mesh, ink, 1.045);
    });
    for (let i = 0; i < 6; i++) {
      const material = new THREE.MeshBasicMaterial({ color: i % 2 ? '#208b9f' : '#d1266b', transparent: true, opacity: 0, wireframe: true, depthWrite: false, toneMapped: false });
      const mesh = new THREE.Mesh(geometries.get(1)!, material); mesh.visible = false; this.group.add(mesh);
      this.ghosts.push({ mesh, age: 2, x: 0, y: 0, z: 0, side: i % 2 ? 1 : -1 });
    }
    this.lines = new RibbonPool(this.group, Math.max(2, context.quality.waves - 2));
    this.heroLines = new RibbonPool(this.group, 2);
    const burstShape = new THREE.Shape();
    for (let i = 0; i <= 32; i++) {
      const angle = i / 32 * Math.PI * 2, radius = i % 2 ? 1.03 : 1.55;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      if (!i) burstShape.moveTo(x, y); else burstShape.lineTo(x, y);
    }
    const burstMesh = part(this.burst, new THREE.ExtrudeGeometry(burstShape, { depth: .035, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: '#f1d570', side: THREE.DoubleSide }));
    outline(burstMesh, ink, 1.06);
    this.burst.rotation.x = -Math.PI / 2; this.burst.position.set(6.5, 1.88, 1.6); this.burst.visible = false; this.group.add(this.burst);
    this.bounds.set(new THREE.Vector3(-9.7, 0, -4.25), new THREE.Vector3(9.8, 3.1, 4.65));
  }
  protected override onStrike(key: KeyBody, reduced: boolean) {
    if (!reduced) {
      for (let i = 0; i < 2; i++) {
        const ghost = this.ghosts[this.ghostCursor++ % (this.quality.level === 'low' ? 4 : 6)];
        ghost.mesh.geometry = key.mesh.geometry; ghost.age = 0;
        ghost.x = key.x; ghost.y = key.restY; ghost.z = key.z;
      }
      for (const side of [-1, 1]) this.lines.emit({ x: key.x + side * .35, y: 1.6, z: key.z + .35 }, { x: key.x + side * .7, y: 2.05, z: key.z + .55 }, '#35203b', .024, .06, .26, true);
    }
    if (this.signature.start(key.definition.code, reduced)) {
      if (this.signature.kind === 'space') {
        this.heroLines.emit({ x: -8.5, y: 1.5, z: 3.6 }, { x: 8.6, y: 1.5, z: 2.9 }, '#d33368', .12, .3, 1, true, -.4);
        this.heroLines.emit({ x: 8.4, y: 1.55, z: -3.1 }, { x: -8.4, y: 1.55, z: -3.5 }, '#278d9a', .1, .25, 1, true, .2);
      } else {
        this.heroLines.emit({ x: 4.5, y: 2.1, z: 1.5 }, { x: 7.8, y: 2.5, z: 2.1 }, '#272136', .08, .12, .55, true);
      }
    }
  }
  protected override tick(delta: number, reduced: boolean) {
    this.frame = Math.floor(this.time * 12);
    // Only decorative ink and afterimages use held frames. KeyState/pose is full-rate.
    for (const ghost of this.ghosts) {
      ghost.age += delta;
      const step = Math.floor(ghost.age * 12) / 12;
      ghost.mesh.visible = !reduced && ghost.age < .42;
      ghost.mesh.position.set(ghost.x + ghost.side * (.08 + step * .9), ghost.y + .07 + step * .9, ghost.z - step * .38);
      ghost.mesh.material.opacity = Math.max(0, .48 - step);
      ghost.mesh.scale.setScalar(1 + step * .1);
    }
    this.sheets.forEach((mesh, i) => { mesh.position.x = (i ? 1 : -1) * (.18 + (reduced ? 0 : Math.sin(this.frame / 12 * 1.1) * .018)); });
    this.burst.visible = !reduced && this.signature.active && this.signature.kind === 'enter';
    const stepped = Math.floor(this.signature.progress * 9) / 9;
    this.burst.scale.setScalar(.2 + Math.sin(stepped * Math.PI) * .85);
    this.burst.rotation.z = stepped * .25;
    const lines = this.lines.update(delta, reduced), hero = this.heroLines.update(delta, reduced);
    return !reduced || lines || hero;
  }
  protected override clear() { for (const ghost of this.ghosts) { ghost.age = 2; ghost.mesh.visible = false; } this.lines.clear(); this.heroLines.clear(); this.burst.visible = false; }
  override setQuality(quality: QualitySettings) { super.setQuality(quality); this.lines.setLimit(Math.max(2, quality.waves - 2)); }
  override diagnostics() { return { ...super.diagnostics(), waves: this.lines.active + this.heroLines.active, mechanism: { renderStyle: 'toon-halftone-outline', decorativeFrame: this.frame, ghosts: this.ghosts.filter(ghost => ghost.mesh.visible).length, burst: this.burst.visible } }; }
}
