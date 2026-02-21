// gesture-recognizer.js - Gesture recognition logic

import { calculateDistance, calculateAngle } from './utils.js';

export class GestureRecognizer {
    constructor() {
        this.currentGesture = 'none';
        this.gestureHistory = [];
        this.gestureStartTime = {};
        this.debounceTime = 300; // ms
        this.requiredDuration = {
            'fist_hold': 2000,
            'v_sign': 1000,
            'three_fingers': 600
        };
    }

    recognize(landmarks) {
        if (!landmarks || landmarks.length === 0) {
            this.currentGesture = 'none';
            return this.currentGesture;
        }

        const hand = landmarks[0]; // First hand
        
        // Check various gestures
        if (this.isOpenPalm(hand)) {
            this.updateGesture('open_palm');
        } else if (this.isPinch(hand)) {
            this.updateGesture('pinch');
        } else if (this.isTwoFingers(hand)) {
            this.updateGesture('two_fingers');
        } else if (this.isFist(hand)) {
            this.updateGesture('fist', true);
        } else if (this.isThreeFingers(hand)) {
            this.updateGesture('three_fingers', true);
        } else if (this.isVSign(hand)) {
            this.updateGesture('v_sign', true);
        } else if (this.isThumbsUp(hand)) {
            this.updateGesture('thumbs_up');
        } else if (this.isThumbsDown(hand)) {
            this.updateGesture('thumbs_down');
        } else {
            this.updateGesture('none');
        }

        return this.currentGesture;
    }

    updateGesture(gesture, requireDuration = false) {
        const now = Date.now();
        
        if (requireDuration) {
            if (!this.gestureStartTime[gesture]) {
                this.gestureStartTime[gesture] = now;
            }
            
            const duration = now - this.gestureStartTime[gesture];
            if (duration >= this.requiredDuration[gesture]) {
                this.currentGesture = gesture;
            }
        } else {
            this.currentGesture = gesture;
            // Reset duration tracking for other gestures
            for (let key in this.gestureStartTime) {
                if (key !== gesture) {
                    delete this.gestureStartTime[key];
                }
            }
        }
    }

    isOpenPalm(hand) {
        // Check if all fingers are extended
        const fingers = this.getExtendedFingers(hand);
        return fingers.length >= 4;
    }

    isPinch(hand) {
        // Thumb tip and index tip close together
        const thumbTip = hand[4];
        const indexTip = hand[8];
        const distance = calculateDistance(thumbTip, indexTip);
        return distance < 0.05;
    }

    isTwoFingers(hand) {
        // Index and middle finger extended
        const fingers = this.getExtendedFingers(hand);
        return fingers.length === 2 && fingers.includes(8) && fingers.includes(12);
    }

    isFist(hand) {
        // All fingers curled
        const fingers = this.getExtendedFingers(hand);
        return fingers.length <= 1;
    }

    isThreeFingers(hand) {
        const fingers = this.getExtendedFingers(hand);
        return fingers.length === 3;
    }

    isVSign(hand) {
        // Index and middle finger extended, others closed
        const fingers = this.getExtendedFingers(hand);
        return fingers.length === 2 && 
               fingers.includes(8) && 
               fingers.includes(12) &&
               this.areFingersSeparated(hand, 8, 12);
    }

    isThumbsUp(hand) {
        const fingers = this.getExtendedFingers(hand);
        return fingers.length === 1 && fingers.includes(4);
    }

    isThumbsDown(hand) {
        // Similar to thumbs up but palm facing down
        const thumbTip = hand[4];
        const wrist = hand[0];
        return thumbTip.y > wrist.y && this.getExtendedFingers(hand).length === 1;
    }

    getExtendedFingers(hand) {
        const extended = [];
        const fingerIndices = [
            [4, 3, 2],   // Thumb
            [8, 7, 6],   // Index
            [12, 11, 10], // Middle
            [16, 15, 14], // Ring
            [20, 19, 18]  // Pinky
        ];

        fingerIndices.forEach((indices, fingerIndex) => {
            const tip = hand[indices[0]];
            const middle = hand[indices[1]];
            const base = hand[indices[2]];
            
            // Check if finger is extended
            if (fingerIndex === 0) { // Thumb (special case)
                const dist1 = calculateDistance(tip, hand[0]);
                const dist2 = calculateDistance(middle, hand[0]);
                if (dist1 > dist2) {
                    extended.push(indices[0]);
                }
            } else {
                if (tip.y < middle.y && middle.y < base.y) {
                    extended.push(indices[0]);
                }
            }
        });

        return extended;
    }

    areFingersSeparated(hand, finger1Index, finger2Index) {
        const finger1 = hand[finger1Index];
        const finger2 = hand[finger2Index];
        const distance = calculateDistance(finger1, finger2);
        return distance > 0.1;
    }

    getGestureData(hand) {
        // Calculate useful data for gesture control
        const wrist = hand[0];
        const indexTip = hand[8];
        const thumbTip = hand[4];
        const middleTip = hand[12];
        
        return {
            palmCenter: this.getPalmCenter(hand),
            indexPosition: indexTip,
            thumbPosition: thumbTip,
            pinchDistance: calculateDistance(thumbTip, indexTip),
            handDepth: wrist.z,
            twoFingerMidpoint: {
                x: (indexTip.x + middleTip.x) / 2,
                y: (indexTip.y + middleTip.y) / 2,
                z: (indexTip.z + middleTip.z) / 2
            }
        };
    }

    getPalmCenter(hand) {
        const wrist = hand[0];
        const indexBase = hand[5];
        const pinkyBase = hand[17];
        
        return {
            x: (wrist.x + indexBase.x + pinkyBase.x) / 3,
            y: (wrist.y + indexBase.y + pinkyBase.y) / 3,
            z: (wrist.z + indexBase.z + pinkyBase.z) / 3
        };
    }
}
