// app.js - Main application logic

import { FPSCounter, Smoother } from './utils.js';
import { GestureRecognizer } from './gesture-recognizer.js';
import { Scene3D } from './scene-3d.js';
import { HandTracker } from './hand-tracker.js';

class App {
    constructor() {
        // DOM elements
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.webcamVideo = document.getElementById('webcam');
        this.outputCanvas = document.getElementById('output-canvas');
        this.sceneCanvas = document.getElementById('scene-canvas');
        
        // Status displays
        this.fpsCounter = document.getElementById('fps-counter');
        this.gestureStatus = document.getElementById('gesture-status');
        this.cameraStatus = document.getElementById('camera-status');
        this.objectType = document.getElementById('object-type');
        this.objectPosition = document.getElementById('object-position');
        this.objectRotation = document.getElementById('object-rotation');
        this.objectScale = document.getElementById('object-scale');
        
        // Components
        this.handTracker = null;
        this.gestureRecognizer = new GestureRecognizer();
        this.scene3d = new Scene3D(this.sceneCanvas);
        this.fpsCounterUtil = new FPSCounter();
        this.positionSmoother = new Smoother(3);
        
        // State
        this.lastHandData = null;
        this.lastGesture = 'none';
        this.gestureActions = {
            'fist': () => this.scene3d.reset(),
            'three_fingers': () => this.scene3d.changeColor(),
            'v_sign': () => this.scene3d.changeObjectType(),
            'thumbs_up': () => this.scene3d.toggleAutoRotate(),
            'thumbs_down': () => this.scene3d.togglePause()
        };
        
        this.initialize();
    }

    async initialize() {
        console.log('Initializing 3D Hands application...');
        
        // Setup event listeners
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.scene3d.updateSize();
        });
        
        // Initialize hand tracker
        this.handTracker = new HandTracker(
            this.webcamVideo,
            this.outputCanvas,
            (results) => this.onHandResults(results)
        );
        
        const initialized = await this.handTracker.initialize();
        if (!initialized) {
            alert('Erro ao inicializar MediaPipe. Verifique sua conexão.');
        }
        
        // Start render loop
        this.render();
        
        console.log('Application initialized');
    }

    async start() {
        console.log('Starting application...');
        
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        
        const started = await this.handTracker.start();
        
        if (started) {
            this.updateCameraStatus(true);
        } else {
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
        }
    }

    stop() {
        console.log('Stopping application...');
        
        this.handTracker.stop();
        
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        
        this.updateCameraStatus(false);
    }

    onHandResults(results) {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            this.lastHandData = null;
            return;
        }
        
        // Recognize gesture
        const gesture = this.gestureRecognizer.recognize(results.multiHandLandmarks);
        
        // Execute gesture actions
        if (gesture !== this.lastGesture && gesture !== 'none') {
            console.log('Gesture detected:', gesture);
            
            if (this.gestureActions[gesture]) {
                this.gestureActions[gesture]();
            }
        }
        
        this.lastGesture = gesture;
        
        // Get gesture data for object control
        const hand = results.multiHandLandmarks[0];
        const gestureData = this.gestureRecognizer.getGestureData(hand);
        
        // Control 3D object based on gesture
        this.controlObject(gesture, gestureData);
        
        // Store hand data
        this.lastHandData = {
            gesture,
            data: gestureData
        };
    }

    controlObject(gesture, data) {
        if (!data) return;
        
        const scene = this.scene3d;
        
        switch (gesture) {
            case 'open_palm':
                // Move object with palm
                if (this.lastHandData) {
                    const dx = data.palmCenter.x - this.lastHandData.data.palmCenter.x;
                    const dy = data.palmCenter.y - this.lastHandData.data.palmCenter.y;
                    const dz = data.palmCenter.z - this.lastHandData.data.palmCenter.z;
                    
                    const smoothed = this.positionSmoother.smooth({ x: dx, y: dy, z: dz });
                    scene.translate(smoothed.x, smoothed.y, smoothed.z);
                }
                break;
                
            case 'pinch':
                // Zoom with pinch
                if (this.lastHandData) {
                    const currentDist = data.pinchDistance;
                    const lastDist = this.lastHandData.data.pinchDistance;
                    const delta = (currentDist - lastDist) * 2;
                    scene.zoom(delta);
                }
                break;
                
            case 'two_fingers':
                // Rotate with two fingers
                if (this.lastHandData) {
                    const dx = data.twoFingerMidpoint.x - this.lastHandData.data.twoFingerMidpoint.x;
                    const dy = data.twoFingerMidpoint.y - this.lastHandData.data.twoFingerMidpoint.y;
                    scene.rotate(dx, dy);
                }
                break;
        }
    }

    render() {
        requestAnimationFrame(() => this.render());
        
        // Update FPS
        const fps = this.fpsCounterUtil.update();
        this.fpsCounter.textContent = `FPS: ${fps}`;
        
        // Update gesture status
        if (this.lastHandData) {
            this.gestureStatus.textContent = `Gesto: ${this.formatGestureName(this.lastHandData.gesture)}`;
        } else {
            this.gestureStatus.textContent = 'Gesto: Nenhum';
        }
        
        // Update object info
        const state = this.scene3d.getState();
        this.objectType.textContent = this.formatObjectType(state.type);
        this.objectPosition.textContent = `${state.position.x.toFixed(2)}, ${state.position.y.toFixed(2)}, ${state.position.z.toFixed(2)}`;
        this.objectRotation.textContent = `${state.rotation.x.toFixed(0)}°, ${state.rotation.y.toFixed(0)}°, ${state.rotation.z.toFixed(0)}°`;
        this.objectScale.textContent = state.scale.toFixed(2);
    }

    updateCameraStatus(online) {
        if (online) {
            this.cameraStatus.textContent = '📷 Câmera: Online';
            this.cameraStatus.classList.remove('status-offline');
            this.cameraStatus.classList.add('status-online');
        } else {
            this.cameraStatus.textContent = '📷 Câmera: Offline';
            this.cameraStatus.classList.remove('status-online');
            this.cameraStatus.classList.add('status-offline');
        }
    }

    formatGestureName(gesture) {
        const names = {
            'none': 'Nenhum',
            'open_palm': 'Mão Aberta',
            'pinch': 'Pinch (Zoom)',
            'two_fingers': 'Dois Dedos (Rotação)',
            'fist': 'Punho (Reset)',
            'three_fingers': 'Três Dedos (Cor)',
            'v_sign': 'Sinal V (Objeto)',
            'thumbs_up': 'Polegar para Cima',
            'thumbs_down': 'Polegar para Baixo'
        };
        return names[gesture] || gesture;
    }

    formatObjectType(type) {
        const types = {
            'cube': 'Cubo',
            'sphere': 'Esfera',
            'cone': 'Cone',
            'torus': 'Toroide',
            'dodecahedron': 'Dodecaedro'
        };
        return types[type] || type;
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new App();
    });
} else {
    window.app = new App();
}
