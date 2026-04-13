<h1 align="center">3D Hands</h1>
<p align="center">Real-time hand gesture recognition for 3D object control</p>
<p align="center">Desktop (Python · OpenGL) &nbsp;|&nbsp; Web (Three.js · MediaPipe)</p>

---

## Overview

**3D Hands** is a dual-platform computer vision application that lets you manipulate 3D objects using only your hands. It detects 21 hand landmarks per hand in real time and maps gestures to translation, rotation, scale, shape-switching, and color-cycling of virtual 3D objects.

| Target | Stack | Entry point |
|--------|-------|-------------|
| Desktop | Python · OpenCV · MediaPipe · PyOpenGL | `python -m app.gesture_3d_main` |
| Web | JavaScript · Three.js · MediaPipe Web SDK · Vercel | `public/index.html` |

---

## Features

- **21-landmark detection** per hand via MediaPipe (up to 2 hands simultaneously)
- **8 gesture commands**: open palm, pinch, two-finger, fist, V-sign, three-finger, dual-hand, thumb
- **Temporal debouncing** — gestures require sustained hold before triggering
- **Exponential motion smoothing** — eliminates jitter from raw landmark noise
- **3D manipulation**: translate XY, zoom Z, rotate, reset, shape-cycle, color-cycle, dual-hand scale
- **Keyboard accessibility** — all gestures have keyboard equivalents
- **Gesture history panel** — last 12 gestures with confidence and timestamp
- **ML classifier** (Python) — optional Random Forest / SVM / MLP model for custom gesture sets
- **Serverless API** with rate limiting, input validation, and CORS control

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Input Layer                          │
│    ThreadedCamera (Python)  │  getUserMedia (Web)           │
└───────────────┬─────────────┴──────────────────┬────────────┘
                │                                │
┌───────────────▼─────────────────────────────────▼───────────┐
│                     Vision / Tracking                        │
│   HandTracker (MediaPipe)  ·  LandmarkProcessor              │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│                   Gesture Recognition                        │
│   GestureRecognizer (rule-based, temporal debounce)          │
│   GesturePredictor  (optional ML, confidence threshold)      │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│                   Interaction Engine                         │
│   ObjectManager  ·  FloatingObject  ·  InteractionEngine     │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│                      Rendering                               │
│   Renderer3D (PyOpenGL)  │  Scene3D (Three.js / WebGL)       │
└─────────────────────────────────────────────────────────────┘
```

---

## Gesture Reference

| Gesture | Action | Hold required |
|---------|--------|:---:|
| Open palm | Move object (XY) | — |
| Pinch | Zoom in / out | — |
| Two fingers | Rotate | — |
| Fist | Reset all transforms | 2 s |
| V-sign | Cycle shape | 1 s |
| Three fingers | Cycle color | 0.8 s |
| Dual hands | Scale (spread / pinch) | — |
| Thumb up / down | Rotate / pause | — |

---

## Keyboard Shortcuts (Web)

| Key | Action |
|-----|--------|
| `↑ ↓ ← →` | Move object |
| `N` | Next shape |
| `C` | Cycle color |
| `R` | Reset |
| `+ / −` | Scale |
| `Space` | Toggle auto-rotate |
| `Esc` | Stop tracking |

---

## Installation

### Web (Vercel)

```bash
npm install
npm run dev       # local dev server
npm run deploy    # deploy to Vercel
```

Requires Chrome 90+ or Edge 90+ (WebGL + getUserMedia).

### Desktop (Python)

```bash
# 1. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate

# 2. Install pinned dependencies
pip install -r requirements.txt

# 3. Run
python -m app.gesture_3d_main
```

Requires Python 3.10+, a webcam, and an OpenGL-capable GPU.

---

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `CAMERA_INDEX` | `0` | Webcam device index |
| `MIN_DETECTION_CONFIDENCE` | `0.7` | MediaPipe detection threshold |
| `PINCH_THRESHOLD` | `0.05` | Normalized distance to trigger pinch |
| `FIST_HOLD_MS` | `2000` | Hold duration (ms) for fist reset |
| `DEBUG_MODE` | `false` | Enable verbose logging and overlay |

---

## Running Tests

```bash
pip install pytest numpy
pytest tests/ -v
```

---

## Training a Custom Gesture Classifier

```bash
# Collect samples
python -m gestures.gesture_dataset --collect

# Train and evaluate
python -m gestures.gesture_trainer --model random_forest

# Output: models/gesture_classifier.joblib + accuracy report
```

Minimum 20 samples per class and 2 classes required.

---

## Project Structure

```
3D-hands/
├── app/          Entry points and top-level controllers
├── core/         Config, constants, logger
├── gestures/     Recognizer, classifier, trainer, dataset
├── interaction/  Object state and scene manager
├── ui/           OpenGL renderers and debug overlay
├── utils/        FPS counter, math utilities, smoothing
├── vision/       Camera capture, hand tracker, landmark processor
├── public/       Web frontend (HTML, CSS, JS)
├── api/          Vercel serverless functions
└── tests/        pytest test suite
```

---

## License

MIT License — see [LICENSE](LICENSE).

---

<p align="center">
  Built by <a href="https://www.matheussiqueira.dev/">Matheus Siqueira</a>
</p>
