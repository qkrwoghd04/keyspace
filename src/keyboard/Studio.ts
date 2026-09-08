import * as THREE from 'three';
import type { KeyboardInput } from '../input/KeyboardInput';
import { KeyboardModel, disposeObject } from './KeyboardModel';

export class Studio {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-10, 10, 5, -5, 0.1, 80);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly model: KeyboardModel;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly observer: ResizeObserver;
  private readonly disconnectInput: () => void;
  private readonly pressedPointers = new Map<number, {code: string; at: number; source: string}>();
  private readonly releaseTimers = new Map<ReturnType<typeof setTimeout>, string>();
  private pointerSequence = 0;
  private frame = 0;
  private previousFrame = 0;
  private lastTyping = -Infinity;
  private targetX = 0;
  private targetY = 0;
  private disposed = false;
  private reducedMotion = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly input: KeyboardInput,
    private readonly virtualKey: (code: string) => void,
    private readonly onUnavailable: () => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: 'low-power'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera.position.set(2.1, 15.8, 20);
    this.camera.lookAt(0, 0.50, 0);
    this.camera.updateMatrixWorld();

    const ambient = new THREE.HemisphereLight('#fff9ec', '#b3b1a8', 1.9);
    const keyLight = new THREE.DirectionalLight('#fff5e5', 2.8);
    keyLight.position.set(-7, 12, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -13;
    keyLight.shadow.camera.right = 13;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 40;
    keyLight.shadow.normalBias = 0.018;
    keyLight.shadow.bias = -0.0003;
    keyLight.shadow.radius = 4;
    const fill = new THREE.DirectionalLight('#f1f5ed', 1.15);
    fill.position.set(7, 5, -8);
    this.scene.add(ambient, keyLight, fill);
    this.model = new KeyboardModel();
    this.scene.add(this.model.group);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({opacity: 0.09}));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.015;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.addContactShadow();

    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas.parentElement!);
    this.disconnectInput = input.subscribe(() => {
      if (input.pressed.size) this.lastTyping = performance.now();
      this.wake();
    });
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointercancel', this.pointerCancel);
    canvas.addEventListener('lostpointercapture', this.pointerCancel);
    canvas.addEventListener('pointerleave', this.pointerLeave);
    canvas.addEventListener('webglcontextlost', this.contextLost);
    window.addEventListener('blur', this.resetPointers);
    document.addEventListener('visibilitychange', this.visibilityChange);
    this.resize();
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced;
    if (reduced) {
      this.targetX = this.targetY = 0;
      this.model.group.rotation.set(0, 0, 0);
    }
    this.wake();
  }

  private addContactShadow() {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 1024;
    textureCanvas.height = 512;
    const context = textureCanvas.getContext('2d')!;
    context.filter = 'blur(28px)';
    context.fillStyle = 'rgba(45, 41, 29, 0.28)';
    context.beginPath();
    context.roundRect(94, 100, 836, 310, 55);
    context.fill();
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(20.1, 10.2), new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, opacity: 0.78}));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.002, 0.16);
    this.scene.add(mesh);
  }

  private resize = () => {
    const {width, height} = this.canvas.parentElement!.getBoundingClientRect();
    if (width <= 0 || height <= 0 || this.disposed) return;
    this.renderer.setSize(width, height, false);
    // Fit all eight case corners in camera space; narrow screens cannot crop it.
    const box = this.model.bounds;
    const projected = new THREE.Box3();
    for (const x of [box.min.x, box.max.x]) for (const y of [0, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      projected.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(this.camera.matrixWorldInverse));
    }
    const aspect = width / height;
    const contentWidth = projected.max.x - projected.min.x;
    const contentHeight = projected.max.y - projected.min.y;
    const frustumHeight = Math.max(contentHeight * 1.21, contentWidth * 1.115 / aspect);
    const middleY = (projected.max.y + projected.min.y) / 2 - 0.2;
    this.camera.left = -frustumHeight * aspect / 2;
    this.camera.right = frustumHeight * aspect / 2;
    this.camera.top = frustumHeight / 2 + middleY;
    this.camera.bottom = -frustumHeight / 2 + middleY;
    this.camera.updateProjectionMatrix();
    this.wake();
  };

  private keyAt(event: PointerEvent) {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(this.model.hitTargets, false)[0]?.object.userData.code as string | undefined;
  }

  private pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const code = this.keyAt(event);
    if (!code) return;
    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    const source = `pointer:${event.pointerId}:${++this.pointerSequence}`;
    this.pressedPointers.set(event.pointerId, {code, at: performance.now(), source});
    this.input.press(code, source);
    this.virtualKey(code);
  };

  private pointerUp = (event: PointerEvent) => {
    const held = this.pressedPointers.get(event.pointerId);
    if (!held) return;
    this.pressedPointers.delete(event.pointerId);
    const timer = setTimeout(() => {
      this.input.release(held.code, held.source);
      this.releaseTimers.delete(timer);
    }, Math.max(0, 85 - (performance.now() - held.at)));
    this.releaseTimers.set(timer, held.source);
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  };

  private pointerCancel = (event: PointerEvent) => {
    const held = this.pressedPointers.get(event.pointerId);
    if (!held) return;
    this.pressedPointers.delete(event.pointerId);
    this.input.release(held.code, held.source);
  };

  private pointerMove = (event: PointerEvent) => {
    this.canvas.style.cursor = this.keyAt(event) ? 'pointer' : 'default';
    if (this.reducedMotion || event.pointerType !== 'mouse' || this.input.pressed.size || performance.now() - this.lastTyping < 750) return;
    this.targetY = this.pointer.x * 0.014;
    this.targetX = this.pointer.y * 0.007;
    this.wake();
  };

  private pointerLeave = () => {
    if (this.input.pressed.size || performance.now() - this.lastTyping < 750) return;
    this.targetX = this.targetY = 0;
    this.wake();
  };

  private resetPointers = () => {
    this.releaseTimers.forEach((source, timer) => {
      clearTimeout(timer);
      this.input.releaseSource(source);
    });
    this.releaseTimers.clear();
    for (const held of this.pressedPointers.values()) this.input.releaseSource(held.source);
    this.pressedPointers.clear();
    this.targetX = this.targetY = 0;
    this.wake();
  };

  private visibilityChange = () => {
    if (document.hidden) {
      this.resetPointers();
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    } else this.wake();
  };

  private contextLost = (event: Event) => {
    event.preventDefault();
    this.input.releaseAll();
    this.onUnavailable();
  };

  private wake = () => {
    if (!this.frame && !this.disposed && !document.hidden) {
      this.previousFrame = performance.now() - 16.67;
      this.frame = requestAnimationFrame(this.animate);
    }
  };

  private animate = (now: number) => {
    this.frame = 0;
    if (this.disposed) return;
    const delta = Math.min((now - this.previousFrame) / 1000, 0.04);
    this.previousFrame = now;
    let moving = this.model.update(delta, this.input.pressed, this.reducedMotion);
    if (!this.reducedMotion && !this.input.pressed.size && now - this.lastTyping > 750) {
      const rotation = this.model.group.rotation;
      const blend = 1 - Math.exp(-7 * delta);
      rotation.x += (this.targetX - rotation.x) * blend;
      rotation.y += (this.targetY - rotation.y) * blend;
      moving = moving || Math.abs(rotation.x - this.targetX) + Math.abs(rotation.y - this.targetY) > 0.00008;
    }
    this.renderer.render(this.scene, this.camera);
    if (moving) this.frame = requestAnimationFrame(this.animate);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resetPointers();
    this.disconnectInput();
    this.observer.disconnect();
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerup', this.pointerUp);
    this.canvas.removeEventListener('pointercancel', this.pointerCancel);
    this.canvas.removeEventListener('lostpointercapture', this.pointerCancel);
    this.canvas.removeEventListener('pointerleave', this.pointerLeave);
    this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    window.removeEventListener('blur', this.resetPointers);
    document.removeEventListener('visibilitychange', this.visibilityChange);
    this.scene.traverse(object => { if (object instanceof THREE.DirectionalLight) object.shadow.dispose(); });
    disposeObject(this.scene);
    this.renderer.dispose();
  }
}
