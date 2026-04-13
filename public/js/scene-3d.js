/**
 * Three.js 3D Scene Manager
 * Manages WebGL scene, object lifecycle, and gesture-driven transforms.
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev/>
 * @module  scene-3d
 */

import { SCENE_CONFIG, COLOR_PALETTE } from './config.js';

const SHAPE_REGISTRY = [
  { name: 'cube',         factory: () => new THREE.BoxGeometry(1.5, 1.5, 1.5) },
  { name: 'sphere',       factory: () => new THREE.SphereGeometry(0.9, 32, 32) },
  { name: 'cone',         factory: () => new THREE.ConeGeometry(0.9, 1.8, 32) },
  { name: 'torus',        factory: () => new THREE.TorusGeometry(0.7, 0.3, 16, 100) },
  { name: 'dodecahedron', factory: () => new THREE.DodecahedronGeometry(0.9) },
];

const COLOR_CYCLE = [
  COLOR_PALETTE.CYAN, COLOR_PALETTE.ORANGE, COLOR_PALETTE.GREEN,
  COLOR_PALETTE.PURPLE, COLOR_PALETTE.BLUE,
];

export class Scene3D {
  constructor(canvas, cfg = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('canvas must be an HTMLCanvasElement');
    this._canvas  = canvas;
    this._cfg     = { ...SCENE_CONFIG, ...cfg };
    this._scene   = null; this._camera  = null;
    this._renderer = null; this._mesh    = null;
    this._shapeIndex = 0; this._colorIndex = 0;
    this._autoRotate = true; this._rafHandle = null;
    this._position = { x: 0, y: 0, z: 0 };
    this._rotation = { x: 0, y: 0, z: 0 };
    this._scale    = 1.0;
  }

  init() {
    if (!this._isWebGLSupported()) throw new Error('WebGL is not supported in this browser or context.');
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
    this._mesh?.geometry.dispose();
    this._mesh?.material.dispose();
    this._renderer?.dispose();
  }

  translate(delta) {
    if (!delta || !this._mesh) return;
    this._position.x = this._clampPos(this._position.x + delta.x * this._cfg.TRANSLATE_SPEED);
    this._position.y = this._clampPos(this._position.y - delta.y * this._cfg.TRANSLATE_SPEED);
  }

  rotate(angleDelta) {
    if (typeof angleDelta !== 'number' || !isFinite(angleDelta)) return;
    this._rotation.y += angleDelta * this._cfg.ROTATE_SPEED;
    this._rotation.x += angleDelta * this._cfg.ROTATE_SPEED * 0.5;
  }

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

  nextShape() {
    this._shapeIndex = (this._shapeIndex + 1) % SHAPE_REGISTRY.length;
    this._spawnMesh();
  }

  nextColor() {
    this._colorIndex = (this._colorIndex + 1) % COLOR_CYCLE.length;
    if (this._mesh?.material) {
      this._mesh.material.color.setHex(COLOR_CYCLE[this._colorIndex]);
      this._mesh.material.emissive.setHex(COLOR_CYCLE[this._colorIndex]);
    }
  }

  setAutoRotate(value) { this._autoRotate = Boolean(value); }
  get currentShape()   { return SHAPE_REGISTRY[this._shapeIndex].name; }
  get currentScale()   { return this._scale; }

  _initRenderer() {
    this._renderer = new THREE.WebGLRenderer({ canvas: this._canvas, antialias: true, alpha: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setSize(this._canvas.clientWidth, this._canvas.clientHeight);
    this._renderer.shadowMap.enabled = true;
  }

  _initScene() {
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(this._cfg.BG_COLOR);
    this._scene.fog = new THREE.Fog(this._cfg.BG_COLOR, this._cfg.FOG_NEAR, this._cfg.FOG_FAR);
  }

  _initCamera() {
    const aspect = this._canvas.clientWidth / this._canvas.clientHeight;
    this._camera = new THREE.PerspectiveCamera(this._cfg.FOV, aspect, this._cfg.NEAR, this._cfg.FAR);
    this._camera.position.z = this._cfg.CAMERA_Z;
  }

  _initLights() {
    this._scene.add(new THREE.AmbientLight(0xffffff, this._cfg.AMBIENT_INTENSITY));
    const dir = new THREE.DirectionalLight(0xffffff, this._cfg.DIRECTIONAL_INTENSITY);
    dir.position.set(5, 5, 5); dir.castShadow = true;
    this._scene.add(dir);
    const pt = new THREE.PointLight(COLOR_PALETTE.CYAN, this._cfg.POINT_INTENSITY, 10);
    pt.position.set(-3, 3, 3);
    this._scene.add(pt);
  }

  _spawnMesh() {
    if (this._mesh) { this._scene.remove(this._mesh); this._mesh.geometry.dispose(); }
    const shape    = SHAPE_REGISTRY[this._shapeIndex];
    const color    = COLOR_CYCLE[this._colorIndex];
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
    observer.observe(this._canvas);
  }

  _onResize() {
    if (!this._camera || !this._renderer) return;
    const w = this._canvas.clientWidth, h = this._canvas.clientHeight;
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(w, h);
  }

  _clampPos(v) { return Math.max(-this._cfg.POSITION_LIMIT, Math.min(this._cfg.POSITION_LIMIT, v)); }

  _isWebGLSupported() {
    try {
      const t = document.createElement('canvas');
      return !!(t.getContext('webgl') || t.getContext('experimental-webgl'));
    } catch { return false; }
  }
}
