/**
 * Three.js 3D Scene Manager
 * Manages WebGL scene, object lifecycle, and gesture-driven transforms.
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev>
 * @module  scene-3d
 */

import * as THREE from 'three';
import { COLOR_TOKENS, OBJECT_COLORS, SCENE_CONFIG } from './config.js';

/** @param {string} name CSS custom property defined in ms-tokens.css */
function readToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Frees GPU memory held by every mesh, material and texture under `root`. @param {THREE.Object3D} root */
function disposeObject(root) {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    /** @type {THREE.Material[]} */
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

/** @typedef {typeof SCENE_CONFIG} SceneConfig */
/** @typedef {{ x: number, y: number, z: number }} Vec3 */
/**
 * @typedef {object} ScenePose
 * @property {string} shape 'custom' when the loaded model is shown
 * @property {string | null} modelName
 * @property {number | null} colorIndex null for a loaded model (it keeps its own materials)
 * @property {Vec3} position
 * @property {Vec3} rotation radians
 * @property {number} scale
 */

const SHAPE_REGISTRY = [
  { name: 'cube',         factory: () => new THREE.BoxGeometry(1.5, 1.5, 1.5) },
  { name: 'sphere',       factory: () => new THREE.SphereGeometry(0.9, 32, 32) },
  { name: 'cone',         factory: () => new THREE.ConeGeometry(0.9, 1.8, 32) },
  { name: 'torus',        factory: () => new THREE.TorusGeometry(0.7, 0.3, 16, 100) },
  { name: 'dodecahedron', factory: () => new THREE.DodecahedronGeometry(0.9) },
];

export class Scene3D {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Partial<SceneConfig>} [cfg]
   */
  constructor(canvas, cfg = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('canvas must be an HTMLCanvasElement');
    this._canvas  = canvas;
    /** @type {SceneConfig} */
    this._cfg     = { ...SCENE_CONFIG, ...cfg };
    // Scene graph and camera need no GPU; only the renderer depends on WebGL.
    this._scene   = new THREE.Scene();
    this._camera  = new THREE.PerspectiveCamera(this._cfg.FOV, 1, this._cfg.NEAR, this._cfg.FAR);
    /** @type {THREE.WebGLRenderer | null} */
    this._renderer = null;
    /** @type {THREE.Object3D | null} the object on stage: a built-in shape or `_customModel` */
    this._mesh    = null;
    this._shapeIndex = 0; this._colorIndex = 0;
    this._autoRotate = true;
    /** @type {number | null} */
    this._rafHandle = null;
    /** @type {Vec3} */
    this._position = { x: 0, y: 0, z: 0 };
    /** @type {Vec3} */
    this._rotation = { x: 0, y: 0, z: 0 };
    this._scale    = 1.0;
    /** @type {THREE.Color[]} */
    this._colors   = [];
    /** @type {THREE.Group | null} wraps a loaded glTF, kept while cycling shapes */
    this._customModel = null;
    /** @type {string | null} */
    this._modelName   = null;
  }

  init() {
    if (!this._isWebGLSupported()) throw new Error('WebGL is not supported in this browser or context.');
    this._colors = OBJECT_COLORS.map(({ token }) => new THREE.Color(readToken(token)));
    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._spawnMesh();
    this._initResizeObserver();
  }

  animate() {
    const loop = () => { this._rafHandle = requestAnimationFrame(loop); this._tick(); };
    loop();
  }

  dispose() {
    if (this._rafHandle !== null) { cancelAnimationFrame(this._rafHandle); this._rafHandle = null; }
    if (this._mesh && this._mesh !== this._customModel) disposeObject(this._mesh);
    if (this._customModel) disposeObject(this._customModel);
    this._renderer?.dispose();
  }

  /** @param {{ x: number, y: number } | null | undefined} delta normalized hand movement */
  translate(delta) {
    if (!delta || !this._mesh) return;
    this._position.x = this._clampPos(this._position.x + delta.x * this._cfg.TRANSLATE_SPEED);
    this._position.y = this._clampPos(this._position.y - delta.y * this._cfg.TRANSLATE_SPEED);
  }

  /** @param {number} angleDelta radians */
  rotate(angleDelta) {
    if (typeof angleDelta !== 'number' || !isFinite(angleDelta)) return;
    this._rotation.y += angleDelta * this._cfg.ROTATE_SPEED;
    this._rotation.x += angleDelta * this._cfg.ROTATE_SPEED * 0.5;
  }

  /** @param {number} delta */
  zoom(delta) {
    if (typeof delta !== 'number' || !isFinite(delta)) return;
    this._scale = Math.max(this._cfg.MIN_SCALE, Math.min(this._cfg.MAX_SCALE, this._scale + delta * this._cfg.ZOOM_SPEED));
  }

  reset() {
    this._position = { x: 0, y: 0, z: 0 };
    this._rotation = { x: 0, y: 0, z: 0 };
    this._scale    = 1.0;
    this._autoRotate = true;
  }

  /** Cycles the built-in shapes, plus the loaded model when there is one. */
  nextShape() {
    const slots = SHAPE_REGISTRY.length + (this._customModel ? 1 : 0);
    this._shapeIndex = (this._shapeIndex + 1) % slots;
    this._spawnMesh();
  }

  /** @returns {boolean} false when a loaded model is shown (it keeps its own materials) */
  nextColor() {
    if (this._showingCustom()) return false;
    this._colorIndex = (this._colorIndex + 1) % OBJECT_COLORS.length;
    const material = this._mesh instanceof THREE.Mesh ? this._mesh.material : null;
    if (material instanceof THREE.MeshStandardMaterial) {
      material.color.copy(this._colors[this._colorIndex]);
      material.emissive.copy(this._colors[this._colorIndex]);
    }
    return true;
  }

  /**
   * Parses a validated .glb in the browser, centres it, scales it to fit the
   * stage and shows it. The previous loaded model, if any, is disposed.
   * @param {ArrayBuffer} buffer
   * @param {string} name display name
   */
  async loadModel(buffer, name) {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    const content = gltf.scene;
    const box = new THREE.Box3().setFromObject(content);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(maxDim) || maxDim <= 0) {
      disposeObject(content);
      throw new Error('The model has no visible geometry.');
    }
    content.position.sub(box.getCenter(new THREE.Vector3()));
    const fit = new THREE.Group();
    fit.scale.setScalar(this._cfg.MODEL_FIT_SIZE / maxDim);
    fit.add(content);
    const pivot = new THREE.Group();
    pivot.add(fit);

    const previous = this._customModel;
    this._customModel = pivot;
    this._modelName = name;
    this._shapeIndex = SHAPE_REGISTRY.length;
    this._spawnMesh();
    if (previous) disposeObject(previous);
    this.reset();
  }

  /** @param {boolean} value */
  setAutoRotate(value) { this._autoRotate = Boolean(value); }
  get currentShape()   { return this._showingCustom() ? 'custom' : SHAPE_REGISTRY[this._shapeIndex].name; }
  get currentScale()   { return this._scale; }

  /** Snapshot of the transform shown to the user. @returns {ScenePose} */
  getPose() {
    const custom = this._showingCustom();
    return {
      shape: this.currentShape,
      modelName: custom ? this._modelName : null,
      colorIndex: custom ? null : this._colorIndex,
      position: { ...this._position },
      rotation: { ...this._rotation },
      scale: this._scale,
    };
  }

  _showingCustom() {
    return this._customModel !== null && this._shapeIndex === SHAPE_REGISTRY.length;
  }

  _initRenderer() {
    this._renderer = new THREE.WebGLRenderer({ canvas: this._canvas, antialias: true, alpha: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // `false`: CSS owns the canvas box; only the drawing buffer is resized.
    this._renderer.setSize(this._canvas.clientWidth, this._canvas.clientHeight, false);
    this._renderer.shadowMap.enabled = true;
  }

  _initScene() {
    const bg = new THREE.Color(readToken(COLOR_TOKENS.SCENE_BG));
    this._scene.background = bg;
    this._scene.fog = new THREE.Fog(bg, this._cfg.FOG_NEAR, this._cfg.FOG_FAR);
  }

  _initCamera() {
    const { clientWidth: w, clientHeight: h } = this._canvas;
    if (w && h) this._camera.aspect = w / h;
    this._camera.position.z = this._cfg.CAMERA_Z;
    this._camera.updateProjectionMatrix();
  }

  _initLights() {
    const light = new THREE.Color(readToken(COLOR_TOKENS.LIGHT));
    this._scene.add(new THREE.AmbientLight(light, this._cfg.AMBIENT_INTENSITY));
    // Sky/ground fill so dark or metallic parts of loaded models stay readable.
    this._scene.add(new THREE.HemisphereLight(light, new THREE.Color(readToken(COLOR_TOKENS.SCENE_BG)), this._cfg.HEMISPHERE_INTENSITY));
    const dir = new THREE.DirectionalLight(light, this._cfg.DIRECTIONAL_INTENSITY);
    dir.position.set(5, 5, 5); dir.castShadow = true;
    this._scene.add(dir);
    const pt = new THREE.PointLight(light, this._cfg.POINT_INTENSITY, 10);
    pt.position.set(-3, 3, 3);
    this._scene.add(pt);
  }

  _spawnMesh() {
    if (this._mesh) {
      this._scene.remove(this._mesh);
      // Built-in shapes are rebuilt on demand; the loaded model is kept for cycling back.
      if (this._mesh !== this._customModel) disposeObject(this._mesh);
    }
    if (this._customModel && this._showingCustom()) {
      this._mesh = this._customModel;
      this._scene.add(this._customModel);
      return;
    }
    const shape    = SHAPE_REGISTRY[this._shapeIndex];
    const color    = this._colors[this._colorIndex];
    const geometry = shape.factory();
    const material = new THREE.MeshStandardMaterial({
      color, emissive: color,
      emissiveIntensity: this._cfg.EMISSIVE_INTENSITY,
      roughness: this._cfg.ROUGHNESS, metalness: this._cfg.METALNESS,
    });
    this._mesh = new THREE.Mesh(geometry, material);
    this._mesh.castShadow = true; this._mesh.receiveShadow = true;
    this._scene.add(this._mesh);
  }

  _tick() {
    if (!this._mesh || !this._renderer) return;
    if (this._autoRotate) {
      this._rotation.x += this._cfg.AUTO_ROTATE_X;
      this._rotation.y += this._cfg.AUTO_ROTATE_Y;
    }
    this._mesh.position.set(this._position.x, this._position.y, this._position.z);
    this._mesh.rotation.set(this._rotation.x, this._rotation.y, this._rotation.z);
    this._mesh.scale.setScalar(this._scale);
    this._renderer.render(this._scene, this._camera);
  }

  _initResizeObserver() {
    const observer = new ResizeObserver(() => this._onResize());
    observer.observe(this._canvas.parentElement ?? this._canvas);
  }

  _onResize() {
    if (!this._camera || !this._renderer) return;
    const w = this._canvas.clientWidth, h = this._canvas.clientHeight;
    if (!w || !h) return;
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(w, h, false);
  }

  /** @param {number} v */
  _clampPos(v) { return Math.max(-this._cfg.POSITION_LIMIT, Math.min(this._cfg.POSITION_LIMIT, v)); }

  _isWebGLSupported() {
    try {
      const t = document.createElement('canvas');
      return !!(t.getContext('webgl') || t.getContext('experimental-webgl'));
    } catch { return false; }
  }
}
