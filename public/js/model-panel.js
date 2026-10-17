/**
 * "Modelo 3D" panel: file picker, sample model and drag-and-drop onto the
 * stage. Validates with model-file.js and hands the bytes to the scene;
 * nothing leaves the browser.
 * @module model-panel
 */

import { MODEL_FILE_MESSAGES, checkModelFile, modelDisplayName } from './model-file.js';

const SAMPLE_MODEL = Object.freeze({ url: '/models/luminaria.glb', name: 'luminaria.glb' });

/**
 * @typedef {object} ModelPanelElements
 * @property {HTMLButtonElement | null} modelBtn
 * @property {HTMLButtonElement | null} sampleBtn
 * @property {HTMLInputElement | null} modelInput
 * @property {HTMLElement | null} modelStatus
 * @property {HTMLElement | null} modelError
 * @property {HTMLElement | null} dropZone
 * @property {HTMLElement | null} dropHint
 */

export class ModelPanel {
  /**
   * @param {ModelPanelElements} dom
   * @param {{ loadModel(buffer: ArrayBuffer, name: string): Promise<void> } | null} scene
   * @param {() => void} onLoaded called after a model is shown (e.g. to refresh the pose)
   */
  constructor(dom, scene, onLoaded) {
    this._dom = dom;
    this._scene = scene;
    this._onLoaded = onLoaded;
    this._loading = false;
  }

  bind() {
    const { modelBtn, sampleBtn, modelInput, dropZone } = this._dom;
    if (!this._scene) {
      for (const button of [modelBtn, sampleBtn]) if (button) button.disabled = true;
      this._setMessage('', 'Sem WebGL não é possível exibir modelos 3D neste navegador.');
      return;
    }
    modelBtn?.addEventListener('click', () => modelInput?.click());
    modelInput?.addEventListener('change', () => {
      const file = modelInput.files?.[0];
      modelInput.value = ''; // choosing the same file again still fires "change"
      if (file) this.load(file);
    });
    sampleBtn?.addEventListener('click', () => this.loadSample());
    if (dropZone) this._bindDrop(dropZone);
    // A file dropped anywhere else would make the browser open or download it.
    for (const type of ['dragover', 'drop']) {
      window.addEventListener(type, (event) => {
        if (event instanceof DragEvent && event.dataTransfer?.types.includes('Files')) event.preventDefault();
      });
    }
  }

  async loadSample() {
    try {
      const response = await fetch(SAMPLE_MODEL.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      await this.load(new File([blob], SAMPLE_MODEL.name, { type: 'model/gltf-binary' }));
    } catch (error) {
      console.warn('[ModelPanel] sample model:', error instanceof Error ? error.message : error);
      this._setMessage('', 'Não foi possível baixar o modelo de exemplo. Verifique a conexão e tente de novo.');
    }
  }

  /** Validates, parses and shows a user-supplied .glb. @param {File} file */
  async load(file) {
    if (this._loading || !this._scene) return;
    const check = checkModelFile(file, await file.slice(0, 12).arrayBuffer());
    if (!check.ok) {
      this._setMessage('', MODEL_FILE_MESSAGES[check.problem]);
      return;
    }
    const name = modelDisplayName(file.name);
    this._loading = true;
    this._setBusy(true);
    this._setMessage(`Carregando ${name}…`, '');
    try {
      await this._scene.loadModel(await file.arrayBuffer(), name);
      this._setMessage(`Modelo carregado: ${name}. Use o sinal de V ou a tecla N para alternar entre ele e as formas.`, '');
      this._onLoaded();
    } catch (error) {
      console.warn('[ModelPanel] model:', error instanceof Error ? error.message : error);
      this._setMessage('', 'Não foi possível ler este modelo. Confira se o arquivo .glb não está corrompido.');
    } finally {
      this._loading = false;
      this._setBusy(false);
    }
  }

  /** @param {HTMLElement} zone */
  _bindDrop(zone) {
    let depth = 0; // dragenter/dragleave also fire for child elements
    /** @param {boolean} on */
    const showHint = (on) => { if (this._dom.dropHint) this._dom.dropHint.hidden = !on; };
    zone.addEventListener('dragenter', (event) => { event.preventDefault(); depth += 1; showHint(true); });
    zone.addEventListener('dragover', (event) => event.preventDefault());
    zone.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (depth === 0) showHint(false); });
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      depth = 0;
      showHint(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) this.load(file);
    });
  }

  /** @param {boolean} busy */
  _setBusy(busy) {
    for (const button of [this._dom.modelBtn, this._dom.sampleBtn]) button?.setAttribute('aria-busy', String(busy));
  }

  /** Shows either a status (polite) or an error (alert); the other is cleared. @param {string} status @param {string} error */
  _setMessage(status, error) {
    if (this._dom.modelStatus) this._dom.modelStatus.textContent = status;
    if (this._dom.modelError) {
      this._dom.modelError.textContent = error;
      this._dom.modelError.hidden = error === '';
    }
  }
}
