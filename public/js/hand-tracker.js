// hand-tracker.js - MediaPipe hand tracking

export class HandTracker {
    constructor(videoElement, canvasElement, onResults) {
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        this.onResults = onResults;
        this.hands = null;
        this.camera = null;
        this.isRunning = false;
    }

    async initialize() {
        try {
            // Initialize MediaPipe Hands
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469404/${file}`;
                }
            });

            this.hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            });

            this.hands.onResults((results) => this.handleResults(results));

            console.log('MediaPipe Hands initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing MediaPipe:', error);
            return false;
        }
    }

    async start() {
        if (this.isRunning) {
            console.warn('Hand tracker already running');
            return;
        }

        try {
            // Get camera stream
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });

            this.videoElement.srcObject = stream;
            
            // Wait for video to load
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    resolve();
                };
            });

            await this.videoElement.play();

            // Setup canvas size
            this.canvasElement.width = this.videoElement.videoWidth;
            this.canvasElement.height = this.videoElement.videoHeight;

            // Start camera utils
            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    if (this.hands) {
                        await this.hands.send({ image: this.videoElement });
                    }
                },
                width: 1280,
                height: 720
            });

            await this.camera.start();
            this.isRunning = true;

            console.log('Hand tracking started');
            return true;
        } catch (error) {
            console.error('Error starting camera:', error);
            alert('Erro ao acessar a câmera. Verifique as permissões.');
            return false;
        }
    }

    stop() {
        if (!this.isRunning) return;

        // Stop camera
        if (this.camera) {
            this.camera.stop();
            this.camera = null;
        }

        // Stop video stream
        if (this.videoElement.srcObject) {
            const tracks = this.videoElement.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }

        this.isRunning = false;
        console.log('Hand tracking stopped');
    }

    handleResults(results) {
        // Clear canvas
        const ctx = this.canvasElement.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

        // Draw video frame
        ctx.drawImage(
            results.image,
            0, 0,
            this.canvasElement.width,
            this.canvasElement.height
        );

        // Draw hand landmarks
        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                this.drawLandmarks(ctx, landmarks);
                this.drawConnections(ctx, landmarks);
            }
        }

        ctx.restore();

        // Call callback with results
        if (this.onResults) {
            this.onResults(results);
        }
    }

    drawLandmarks(ctx, landmarks) {
        ctx.fillStyle = '#00FF00';
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;

        for (const landmark of landmarks) {
            const x = landmark.x * this.canvasElement.width;
            const y = landmark.y * this.canvasElement.height;

            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    drawConnections(ctx, landmarks) {
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],        // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],        // Index
            [0, 9], [9, 10], [10, 11], [11, 12],   // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17]              // Palm
        ];

        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;

        for (const [start, end] of connections) {
            const startLandmark = landmarks[start];
            const endLandmark = landmarks[end];

            const startX = startLandmark.x * this.canvasElement.width;
            const startY = startLandmark.y * this.canvasElement.height;
            const endX = endLandmark.x * this.canvasElement.width;
            const endY = endLandmark.y * this.canvasElement.height;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }

    setMaxHands(num) {
        if (this.hands) {
            this.hands.setOptions({ maxNumHands: num });
        }
    }
}
