# 3D Hands - Real-Time Hand Gestures

Aplicacao profissional de visao computacional para controle de objetos 2D/3D por gestos das maos em tempo real. O sistema combina MediaPipe Hands, OpenCV e um renderizador 3D em OpenGL para permitir translacao, rotacao, escala, zoom e eventos por gestos.

Autor: Matheus Siqueira

## Destaques

- Rastreamento de 21 landmarks por mao (MediaPipe).
- Reconhecimento de gestos por regras e latches temporais (debounce).
- Controle 3D com translacao, rotacao, escala e zoom.
- Suavizacao de movimento e deadzone para reduzir tremores.
- Suporte a duas maos (modo avancado).
- Overlay de debug com FPS, gesto, escala e rotacao.
- Pipeline modular: captura, analise, gestos e renderizacao.

## Arquitetura

```
app/
core/
vision/
gestures/
interaction/
ui/
models/saved_models/
data/
utils/
```

## Mapeamento de Gestos 3D (padrao)

- Mao aberta: mover em X/Y e profundidade.
- Pinch (polegar + indicador): zoom in/out.
- Dois dedos (indicador + medio): rotacao em X/Y e roll em Z.
- Punho fechado por 2s: reset de posicao/rotacao.
- V por 1s: alternar tipo de objeto.
- Tres dedos por 0.6s: alternar cor.
- Duas maos abertas: escala global.
- Polegar para cima: giro continuo enquanto segurar.
- Polegar para baixo: pausar/retomar movimentos.

## Requisitos

- Python 3.10+
- Webcam (Brio 305 ou similar)

Dependencias principais (ver [requirements.txt](requirements.txt)):
- `opencv-python`
- `mediapipe`
- `numpy`
- `pygame`
- `PyOpenGL`

## Instalacao

```bash
pip install -r requirements.txt
```

## Execucao

Modo classico (2D + classificador):

```bash
python app/main.py
```

Modo 3D (OpenGL):

```bash
python app/gesture_3d_main.py
```

Versao simplificada (uma mao):

```bash
python app/gesture_3d_main.py --simple
```

## Configuracoes (variaveis de ambiente)

Basicas:

- `GESTURE_FRAME_WIDTH`
- `GESTURE_FRAME_HEIGHT`
- `GESTURE_TARGET_FPS`
- `GESTURE_PREDICTION_THRESHOLD`
- `GESTURE_CLASSIFIER` (`random_forest`, `svm`, `mlp`)
- `GESTURE_DEBUG`
- `GESTURE_MODEL_PATH`
- `GESTURE_DATASET_PATH`
- `GESTURE_RESOLUTION_SCALE`

3D:

- `GESTURE_RENDER_WIDTH`
- `GESTURE_RENDER_HEIGHT`
- `GESTURE_DOMINANT_HAND`
- `GESTURE_DEADZONE_PX`
- `GESTURE_TRANSLATION_SENS`
- `GESTURE_ROTATION_SENS`
- `GESTURE_DEPTH_SENS`
- `GESTURE_PINCH_SCALE_SENS`
- `GESTURE_TWO_HAND_SCALE_SENS`
- `GESTURE_CALIBRATION_SEC`
- `GESTURE_RESET_HOLD_SEC`
- `GESTURE_SWAP_HOLD_SEC`
- `GESTURE_SPIN_HOLD_SEC`
- `GESTURE_COLOR_HOLD_SEC`
- `GESTURE_PAUSE_COOLDOWN_SEC`

## Treinamento (opcional)

1. Execute `python app/main.py`.
2. Pressione `T` para iniciar a coleta.
3. Informe o nome do gesto.
4. Aguarde a coleta (200 amostras por padrao).
5. Pressione `R` para treinar e salvar o modelo.

## Solucao de problemas

- Se abrir a camera errada, defina `GESTURE_CAMERA_INDEX` com o indice correto.
- Se o OpenGL nao abrir, atualize o driver de video e reinstale `pygame`/`PyOpenGL`.
- Se o gesto estiver instavel, aumente `GESTURE_DEADZONE_PX` ou a suavizacao.

## Roadmap

- Fisica basica e colisao.
- Suporte multi-objetos e persistencia de estado.
- Integracao VR e multiplos modos de renderizacao.

## Licenca

Defina a licenca apropriada (ex.: MIT) conforme a distribuicao desejada.

## Autoria

Matheus Siqueira
