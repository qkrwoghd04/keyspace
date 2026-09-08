import * as THREE from 'three';
import type { KeyboardInput } from '../input/KeyboardInput';
import { disposeObject } from './KeyboardModel';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DEFAULT_PRESET } from './presets';
import { createLegendAtlas } from './legends';
import { createClassic } from '../themes/classic';
import { DEFAULT_THEME } from '../themes/registry';
import { LOW_QUALITY, STANDARD_QUALITY, type QualitySettings, type SceneAppearance, type ThemeDefinition, type ThemeRuntime } from '../themes/types';
import type { ChallengeChannel, ChallengePresentation, PresentationEvent } from '../challenge/ChallengeChannel';
import { ChallengeRewards } from '../themes/shared/ChallengeRewards';

declare global {
  interface Window {
    __keyspace?: {
      state: () => ReturnType<Studio['diagnostics']>;
      keyPoint: (code: string) => { x: number; y: number } | null;
    };
  }
}

export class Studio {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-10, 10, 5, -5, 0.1, 80);
  private readonly renderer: THREE.WebGLRenderer;
  private model: ThemeRuntime;
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
  private theme: ThemeDefinition = DEFAULT_THEME;
  private requestVersion = 0;
  private quality: QualitySettings = window.matchMedia('(max-width: 1023px), (pointer: coarse)').matches ? LOW_QUALITY : STANDARD_QUALITY;
  private slowFrames = 0;
  private frameDurations: number[] = [];
  private renderedFrames = 0;
  private readonly legendTexture = createLegendAtlas().texture;
  private transitionRemaining = 0;
  private inputResetVersion = 0;
  private readonly ambient = new THREE.HemisphereLight();
  private readonly keyLight = new THREE.DirectionalLight();
  private readonly fillLight = new THREE.DirectionalLight();
  private readonly rimLight = new THREE.DirectionalLight();
  private readonly shadowMaterial = new THREE.ShadowMaterial();
  private contactMaterial!: THREE.MeshBasicMaterial;
  private readonly environment: THREE.WebGLRenderTarget;
  private readonly color = new THREE.Color();
  private readonly lightPosition = new THREE.Vector3();
  private challengeState: ChallengePresentation = { enabled: false, racing: false, intensity: 'low' };
  private rewards: ChallengeRewards | null = null;
  private disconnectChallenge: (() => void) | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly input: KeyboardInput,
    private readonly virtualKey: (code: string) => void,
    private readonly onUnavailable: () => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: 'low-power'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.dpr));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.transmissionResolutionScale = this.quality.transmissionScale;
    this.camera.position.set(2.1, 15.8, 20);
    this.camera.lookAt(0, 0.50, 0);
    this.camera.updateMatrixWorld();

    const ambient = this.ambient;
    const keyLight = this.keyLight;
    keyLight.position.set(-7, 12, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
    keyLight.shadow.camera.left = -13;
    keyLight.shadow.camera.right = 13;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 40;
    keyLight.shadow.normalBias = 0.018;
    keyLight.shadow.bias = -0.0003;
    keyLight.shadow.radius = 4;
    const fill = this.fillLight;
    fill.position.set(7, 5, -8);
    this.scene.add(ambient, keyLight, fill, this.rimLight);
    this.model = createClassic(DEFAULT_PRESET, { legendTexture: this.legendTexture, quality: this.quality });
    this.scene.add(this.model.group);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), this.shadowMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.015;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.addContactShadow();
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(this.renderer);
    this.environment = generator.fromScene(room, 0.04, 0.1, 100, {size: 128});
    this.scene.environment = this.environment.texture;
    room.dispose();
    generator.dispose();
    this.applyAppearance(1);
    this.inputResetVersion = input.resetVersion;
    this.model.reset(input);

    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas.parentElement!);
    this.disconnectInput = input.subscribe(() => {
      if (input.resetVersion !== this.inputResetVersion) {
        this.inputResetVersion = input.resetVersion;
        this.model.reset(input);
      }
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
    if (import.meta.env.DEV) window.__keyspace = { state: () => this.diagnostics(), keyPoint: code => this.keyPoint(code) };
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced;
    if (reduced) {
      this.targetX = this.targetY = 0;
      this.model.group.rotation.set(0, 0, 0);
      this.transitionRemaining = 0;
      this.applyAppearance(1);
      this.rewards?.clear();
      this.model.onChallengeEvent?.({ type: 'reset' });
    }
    this.wake();
  }

  connectChallenge(channel: ChallengeChannel) {
    this.disconnectChallenge?.();
    const handle = (event: PresentationEvent) => {
      if (event.type === 'presentation') {
        this.challengeState = event.value;
        this.model.setChallengeActive?.(event.value.enabled);
        if (!event.value.enabled) { this.rewards?.dispose(); this.rewards = null; }
        else {
          this.rewards ??= new ChallengeRewards(this.theme.id, this.model, this.quality);
          this.rewards.setIntensity(event.value.intensity);
          if (event.value.intensity === 'off') this.model.onChallengeEvent?.({ type: 'reset' });
        }
        this.resize();
      } else if (this.challengeState.enabled) {
        if (event.type === 'reset' || event.type === 'error' || (!this.reducedMotion && this.challengeState.intensity !== 'off')) {
          const admitted = this.rewards?.receive(event);
          if (admitted) this.model.onChallengeEvent?.(event);
        }
      }
      this.wake();
    };
    handle({ type: 'presentation', value: channel.state });
    const unsubscribe = channel.subscribe(handle);
    this.disconnectChallenge = unsubscribe;
    return () => { unsubscribe(); if (this.disconnectChallenge === unsubscribe) this.disconnectChallenge = null; };
  }

  async setTheme(theme: ThemeDefinition): Promise<boolean> {
    const request = ++this.requestVersion;
    if (theme.id === this.theme.id) return true;
    let next: ThemeRuntime | undefined;
    let committed = false;
    try {
      const create = await theme.load();
      if (this.disposed || request !== this.requestVersion) return false;
      next = create({ legendTexture: this.legendTexture, quality: this.quality });
      await this.renderer.compileAsync(next.group, this.camera, this.scene);
      if (this.disposed || request !== this.requestVersion) return false;
      this.resetPointers();
      // A resize or adaptive downgrade can happen while shaders are compiling.
      next.setQuality(this.quality);
      next.reset(this.input);
      next.setChallengeActive?.(this.challengeState.enabled);
      const previous = this.model;
      this.rewards?.dispose(); this.rewards = null;
      this.scene.remove(previous.group);
      this.model = next;
      this.theme = theme;
      this.input.setSoundProfile(theme.id);
      this.frameDurations = [];
      this.slowFrames = 0;
      this.scene.add(next.group);
      if (this.challengeState.enabled) { this.rewards = new ChallengeRewards(theme.id, next, this.quality); this.rewards.setIntensity(this.challengeState.intensity); }
      previous.dispose();
      this.transitionRemaining = this.reducedMotion ? 0 : 0.2;
      if (!this.transitionRemaining) this.applyAppearance(1);
      this.resize();
      committed = true;
      return true;
    } catch (error) {
      if (this.disposed || request !== this.requestVersion) return false;
      throw error;
    } finally {
      if (next && !committed) next.dispose();
    }
  }

  private applyAppearance(blend: number) {
    const {lighting, mood} = this.theme.appearance;
    this.ambient.color.lerp(this.color.set(lighting.sky), blend);
    this.ambient.groundColor.lerp(this.color.set(lighting.ground), blend);
    this.ambient.intensity = THREE.MathUtils.lerp(this.ambient.intensity, lighting.ambient, blend);
    this.mixLight(this.keyLight, lighting.key, blend);
    this.mixLight(this.fillLight, lighting.fill, blend);
    this.mixLight(this.rimLight, lighting.rim, blend);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(this.renderer.toneMappingExposure, lighting.exposure, blend);
    this.shadowMaterial.opacity = THREE.MathUtils.lerp(this.shadowMaterial.opacity, mood.shadowOpacity, blend);
    this.contactMaterial.opacity = THREE.MathUtils.lerp(this.contactMaterial.opacity, mood.contactOpacity, blend);
  }

  private mixLight(light: THREE.DirectionalLight, target: SceneAppearance['lighting']['key'], blend: number) {
    light.color.lerp(this.color.set(target.color), blend);
    light.intensity = THREE.MathUtils.lerp(light.intensity, target.intensity, blend);
    light.position.lerp(this.lightPosition.fromArray(target.position), blend);
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
    this.contactMaterial = new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, opacity: 0.78});
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(20.1, 10.2), this.contactMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.002, 0.16);
    this.scene.add(mesh);
  }

  private resize = () => {
    const {width, height} = this.canvas.parentElement!.getBoundingClientRect();
    if (width <= 0 || height <= 0 || this.disposed) return;
    if (this.quality.level === 'standard' && window.matchMedia('(max-width: 1023px), (pointer: coarse)').matches) { this.lowerQuality(); return; }
    this.renderer.setSize(width, height, false);
    // Fit all eight case corners in camera space; narrow screens cannot crop it.
    const box = this.challengeState.enabled ? this.model.bounds.clone().expandByVector(new THREE.Vector3(.3, .35, .3)) : this.model.bounds;
    const projected = new THREE.Box3();
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      projected.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(this.camera.matrixWorldInverse));
    }
    const aspect = width / height;
    const contentWidth = projected.max.x - projected.min.x;
    const contentHeight = projected.max.y - projected.min.y;
    const frustumHeight = Math.max(contentHeight * 1.21, contentWidth * 1.115 / aspect);
    const middleY = (projected.max.y + projected.min.y) / 2 - 0.2;
    const middleX = (projected.max.x + projected.min.x) / 2;
    this.camera.left = -frustumHeight * aspect / 2 + middleX;
    this.camera.right = frustumHeight * aspect / 2 + middleX;
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
    const pointers = [...this.pressedPointers.entries()];
    this.pressedPointers.clear();
    for (const [id, held] of pointers) {
      this.input.releaseSource(held.source);
      if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    }
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
    const elapsed = (now - this.previousFrame) / 1000;
    const delta = Math.min(elapsed, 0.04);
    this.previousFrame = now;
    this.frameDurations.push(elapsed * 1000);
    if (this.frameDurations.length > 240) this.frameDurations.shift();
    this.slowFrames = elapsed > 0.025 ? this.slowFrames + delta : Math.max(0, this.slowFrames - delta);
    if (this.slowFrames > 3 && this.quality.level === 'standard') this.lowerQuality();
    if (this.transitionRemaining > 0) {
      this.applyAppearance(Math.min(delta / this.transitionRemaining, 1));
      this.transitionRemaining = Math.max(0, this.transitionRemaining - delta);
    }
    const rewardMoving = this.rewards?.update(delta, this.reducedMotion) ?? false;
    let moving = this.model.update(delta, this.input, this.reducedMotion) || this.transitionRemaining > 0 || rewardMoving;
    if (!this.reducedMotion && !this.input.pressed.size && now - this.lastTyping > 750) {
      const rotation = this.model.group.rotation;
      const blend = 1 - Math.exp(-7 * delta);
      rotation.x += (this.targetX - rotation.x) * blend;
      rotation.y += (this.targetY - rotation.y) * blend;
      moving = moving || Math.abs(rotation.x - this.targetX) + Math.abs(rotation.y - this.targetY) > 0.00008;
    }
    this.renderer.render(this.scene, this.camera);
    this.renderedFrames++;
    if (moving) this.frame = requestAnimationFrame(this.animate);
  };

  private lowerQuality() {
    this.quality = LOW_QUALITY;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.dpr));
    this.renderer.transmissionResolutionScale = this.quality.transmissionScale;
    this.keyLight.shadow.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
    this.keyLight.shadow.map?.dispose();
    this.keyLight.shadow.map = null;
    this.model.setQuality(this.quality);
    this.rewards?.setQuality(this.quality);
    this.resize();
  }

  private keyPoint(code: string) {
    const mesh = this.model.hitTargets.find(target => target.userData.code === code);
    if (!mesh) return null;
    mesh.geometry.computeBoundingBox();
    const point = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
    mesh.localToWorld(point).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
  }

  diagnostics() {
    const times = [...this.frameDurations].sort((a, b) => a - b);
    const projected = new THREE.Box3();
    const box = this.model.bounds;
    this.model.group.updateMatrixWorld(true);
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      projected.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(this.model.group.matrixWorld).project(this.camera));
    }
    return {
      theme: this.theme.id, quality: this.quality.level, frames: this.renderedFrames,
      frameP95: times[Math.floor(times.length * 0.95)] ?? 0,
      memory: { ...this.renderer.info.memory }, programs: this.renderer.info.programs?.length ?? 0,
      drawCalls: this.renderer.info.render.calls, input: this.input.getSnapshot(),
      effects: this.model.diagnostics(), audio: this.input.audioDiagnostics(),
      challenge: this.challengeState, rewards: this.rewards?.diagnostics() ?? null,
      fits: projected.min.x >= -1 && projected.max.x <= 1 && projected.min.y >= -1 && projected.max.y <= 1,
      keys: this.model.hitTargets.map(mesh => ({ code: mesh.userData.code as string, position: mesh.getWorldPosition(new THREE.Vector3()).toArray(), scale: mesh.getWorldScale(new THREE.Vector3()).toArray() })),
    };
  }

  dispose() {
    this.disposed = true;
    this.requestVersion++;
    cancelAnimationFrame(this.frame);
    this.resetPointers();
    this.disconnectInput();
    this.disconnectChallenge?.(); this.rewards?.dispose(); this.rewards = null;
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
    this.scene.remove(this.model.group);
    this.model.dispose();
    disposeObject(this.scene);
    this.legendTexture.dispose();
    this.environment.dispose();
    this.renderer.dispose();
    if (import.meta.env.DEV) delete window.__keyspace;
  }
}
