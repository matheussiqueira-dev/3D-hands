// scene-3d.js - Three.js 3D scene management

export class Scene3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75, 
            canvas.width / canvas.height, 
            0.1, 
            1000
        );
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true,
            alpha: true
        });
        
        this.currentObject = null;
        this.objectType = 'cube';
        this.objectColor = 0x667eea;
        this.colors = [0x667eea, 0xf56565, 0x48bb78, 0xecc94b, 0x9f7aea];
        this.colorIndex = 0;
        
        this.rotation = { x: 0, y: 0, z: 0 };
        this.position = { x: 0, y: 0, z: 0 };
        this.scale = 1.0;
        
        this.autoRotate = false;
        this.paused = false;
        
        this.setupScene();
        this.createObject();
        this.animate();
    }

    setupScene() {
        // Set renderer size
        this.updateSize();
        
        // Camera position
        this.camera.position.z = 5;
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);
        
        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-5, -5, 5);
        this.scene.add(pointLight);
        
        // Background
        this.scene.background = new THREE.Color(0x1a202c);
        
        // Fog for depth
        this.scene.fog = new THREE.Fog(0x1a202c, 1, 15);
    }

    createObject() {
        // Remove old object
        if (this.currentObject) {
            this.scene.remove(this.currentObject);
        }
        
        let geometry;
        
        switch (this.objectType) {
            case 'cube':
                geometry = new THREE.BoxGeometry(2, 2, 2);
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(1.2, 32, 32);
                break;
            case 'cone':
                geometry = new THREE.ConeGeometry(1, 2, 32);
                break;
            case 'torus':
                geometry = new THREE.TorusGeometry(1, 0.4, 16, 100);
                break;
            case 'dodecahedron':
                geometry = new THREE.DodecahedronGeometry(1.2);
                break;
            default:
                geometry = new THREE.BoxGeometry(2, 2, 2);
        }
        
        const material = new THREE.MeshStandardMaterial({
            color: this.objectColor,
            metalness: 0.5,
            roughness: 0.3,
            flatShading: false
        });
        
        this.currentObject = new THREE.Mesh(geometry, material);
        this.scene.add(this.currentObject);
        
        // Apply current transformations
        this.applyTransformations();
    }

    applyTransformations() {
        if (!this.currentObject) return;
        
        this.currentObject.position.set(this.position.x, this.position.y, this.position.z);
        this.currentObject.rotation.set(
            this.rotation.x * Math.PI / 180,
            this.rotation.y * Math.PI / 180,
            this.rotation.z * Math.PI / 180
        );
        this.currentObject.scale.set(this.scale, this.scale, this.scale);
    }

    updateSize() {
        const rect = this.canvas.getBoundingClientRect();
        this.renderer.setSize(rect.width, rect.height);
        this.camera.aspect = rect.width / rect.height;
        this.camera.updateProjectionMatrix();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (!this.paused) {
            // Auto rotation
            if (this.autoRotate && this.currentObject) {
                this.rotation.y += 2;
                if (this.rotation.y >= 360) this.rotation.y -= 360;
                this.applyTransformations();
            }
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    // Gesture control methods
    translate(dx, dy, dz) {
        if (this.paused) return;
        
        this.position.x += dx * 5;
        this.position.y -= dy * 5; // Invert Y for natural movement
        this.position.z += dz * 10;
        
        // Clamp positions
        this.position.x = Math.max(-10, Math.min(10, this.position.x));
        this.position.y = Math.max(-10, Math.min(10, this.position.y));
        this.position.z = Math.max(-10, Math.min(10, this.position.z));
        
        this.applyTransformations();
    }

    rotate(dx, dy, dz = 0) {
        if (this.paused) return;
        
        this.rotation.x += dy * 180;
        this.rotation.y += dx * 180;
        this.rotation.z += dz * 180;
        
        // Keep rotations in 0-360 range
        this.rotation.x = this.rotation.x % 360;
        this.rotation.y = this.rotation.y % 360;
        this.rotation.z = this.rotation.z % 360;
        
        this.applyTransformations();
    }

    zoom(delta) {
        if (this.paused) return;
        
        this.scale += delta * 2;
        this.scale = Math.max(0.1, Math.min(5, this.scale));
        this.applyTransformations();
    }

    reset() {
        this.position = { x: 0, y: 0, z: 0 };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.scale = 1.0;
        this.applyTransformations();
    }

    changeObjectType() {
        const types = ['cube', 'sphere', 'cone', 'torus', 'dodecahedron'];
        const currentIndex = types.indexOf(this.objectType);
        this.objectType = types[(currentIndex + 1) % types.length];
        this.createObject();
    }

    changeColor() {
        this.colorIndex = (this.colorIndex + 1) % this.colors.length;
        this.objectColor = this.colors[this.colorIndex];
        
        if (this.currentObject && this.currentObject.material) {
            this.currentObject.material.color.setHex(this.objectColor);
        }
    }

    toggleAutoRotate() {
        this.autoRotate = !this.autoRotate;
    }

    togglePause() {
        this.paused = !this.paused;
    }

    getState() {
        return {
            type: this.objectType,
            position: { ...this.position },
            rotation: { ...this.rotation },
            scale: this.scale,
            autoRotate: this.autoRotate,
            paused: this.paused
        };
    }
}
