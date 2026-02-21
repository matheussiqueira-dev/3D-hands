// utils.js - Utility functions

export class FPSCounter {
    constructor() {
        this.frames = [];
        this.lastTime = performance.now();
    }

    update() {
        const now = performance.now();
        this.frames.push(now);
        
        // Keep only last second of frames
        while (this.frames.length > 0 && this.frames[0] <= now - 1000) {
            this.frames.shift();
        }
        
        this.lastTime = now;
        return this.frames.length;
    }

    getFPS() {
        return this.frames.length;
    }
}

export class Smoother {
    constructor(windowSize = 5) {
        this.windowSize = windowSize;
        this.values = [];
    }

    smooth(value) {
        if (typeof value === 'number') {
            this.values.push(value);
            if (this.values.length > this.windowSize) {
                this.values.shift();
            }
            return this.values.reduce((a, b) => a + b, 0) / this.values.length;
        } else if (value && typeof value === 'object') {
            // Smooth object properties
            const smoothed = {};
            for (let key in value) {
                if (!this.values[key]) this.values[key] = [];
                this.values[key].push(value[key]);
                if (this.values[key].length > this.windowSize) {
                    this.values[key].shift();
                }
                smoothed[key] = this.values[key].reduce((a, b) => a + b, 0) / this.values[key].length;
            }
            return smoothed;
        }
        return value;
    }

    reset() {
        this.values = [];
    }
}

export function calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = (point1.z || 0) - (point2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function calculateAngle(point1, point2, point3) {
    const vector1 = {
        x: point1.x - point2.x,
        y: point1.y - point2.y,
        z: (point1.z || 0) - (point2.z || 0)
    };
    
    const vector2 = {
        x: point3.x - point2.x,
        y: point3.y - point2.y,
        z: (point3.z || 0) - (point2.z || 0)
    };
    
    const dot = vector1.x * vector2.x + vector1.y * vector2.y + vector1.z * vector2.z;
    const mag1 = Math.sqrt(vector1.x ** 2 + vector1.y ** 2 + vector1.z ** 2);
    const mag2 = Math.sqrt(vector2.x ** 2 + vector2.y ** 2 + vector2.z ** 2);
    
    return Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
}

export function lerp(start, end, t) {
    return start + (end - start) * t;
}

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function mapRange(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}
