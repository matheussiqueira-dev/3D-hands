# Contributing to 3D Hands

## Commit Convention

All commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

Author: Matheus Siqueira <https://www.matheussiqueira.dev/>
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready |
| `feat/*` | New features |
| `fix/*` | Bug fixes |
| `refactor/*` | Code quality |

---

## Code Standards

- **Python**: PEP 8, type hints on all public functions, docstrings on all classes
- **JavaScript**: JSDoc on all exports, no `var`, no `console.log` in production paths
- **Tests**: every new Python module must have a `tests/test_<module>.py` counterpart

---

## Adding a New Gesture (Python)

1. Add a private `_detect_<name>` method in `gestures/gesture_recognizer.py`
2. Call it from `recognize()` and add the name to the state map in `core/constants.py`
3. Add at least one test in `tests/test_gesture_recognizer.py`

## Adding a New Gesture (Web)

1. Add a `_detect<Name>()` method in `public/js/gesture-recognizer.js`
2. Call it from `recognize()` and add the name to `VALID_GESTURES` in `api/gesture.js`
3. Map the gesture to a scene action in `_applyToScene()` in `public/js/app.js`
4. Add the gesture to the guide table in `public/index.html`

---

<p align="center"><a href="https://www.matheussiqueira.dev/">Matheus Siqueira</a></p>
