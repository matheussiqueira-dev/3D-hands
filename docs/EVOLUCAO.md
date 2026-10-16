# 3D Hands: documento master de evolução

Roteiro da transição do 3D Hands de demo de portfólio para um produto de demonstração com padrão de engenharia profissional. Cobre o que foi feito nas versões 1.1.0 e 1.2.0 e o que vem depois, com guias de implementação e o código de referência.

Convenção: **feito** = está no código e coberto por testes; **roteiro** = proposta, com código de referência **não executado** neste repositório.

## 1. Sumário executivo

### Ponto de partida (v1.0.0, junho de 2026)

O site estava no ar, mas:
- o `vercel.json` legado (`builds`/`routes`) fazia a Vercel ignorar os headers de segurança e não publicar a função `api/gesture.js`, para a qual a página enviava cada gesto (sempre 404);
- a interface mostrava gestos que não existiam (polegar para cima/baixo), porcentagens de confiança constantes (90%, 85%, 95%) e um painel de pose que nunca mudava;
- havia um telefone pessoal na página e cinco documentos redundantes;
- não havia CI, e só o reconhecedor de gestos tinha testes.

### Onde está agora (v1.2.0)

| Dimensão | v1.0.0 | v1.2.0 |
|---|---|---|
| Segurança HTTP | só HSTS | CSP sem `unsafe-inline` (import map por hash), `Permissions-Policy`, `nosniff`, `Referrer-Policy`, `X-Frame-Options` |
| Dependências de CDN | sem versão, sem SRI | versão fixa e SRI em tudo (import map com `integrity`, `hands.js` injetado com SRI) |
| Honestidade da UI | gestos inexistentes, confiança fixa, pose congelada | guia gerado do catálogo do reconhecedor, progresso medido da retenção, pose real |
| Arquitetura web | `app.js` com 455 linhas fazendo tudo | 7 módulos puros + controladores finos (`app.js` com 395 linhas, `model-panel.js`) |
| Tipagem | nenhuma | JSDoc conferido por `tsc --checkJs` em modo estrito no CI |
| Testes web | 0 unitários de UI, 0 e2e | 53 unitários (`node --test`, 99% de linhas nos módulos de lógica), 25 e2e (Playwright + axe) |
| CI | nenhum | pytest (Python 3.12), pip-audit, npm audit, cobertura, typecheck, e2e |
| Produto | cubo, esfera, cone, toro, dodecaedro | modelo `.glb` próprio por arquivo ou arrastar e soltar, com exemplo original |
| Carregamento | MediaPipe baixado sempre | MediaPipe só após "Ativar câmera", com tempo limite de 30 s |
| Design | tema "Tron" com 3 fontes do Google | design system `ms-tokens` v1.0, IBM Plex Sans self-hosted, WCAG 2.2 AA (axe sem serious/critical) |

Medições locais (Windows 11, Edge headless, WebGL por software; números de referência, não de laboratório):
- Lighthouse mobile na v1.1.0: Performance 92, Accessibility 100, Best Practices 100, SEO 100. Na v1.2.0 o launcher do Lighthouse falhou nesta máquina e a medição não foi repetida.
- JavaScript baixado no carregamento da página: cerca de 233 KB na v1.2.0 (Three.js minificado como ES module), sem nenhum byte do MediaPipe antes do clique.

### Reposicionamento de produto

O 3D Hands passa a ser apresentado como **visualizador de produto 3D controlado sem toque**: a pessoa carrega o modelo do próprio produto e o manipula com a mão, sem tocar em tela nem mouse. Isso aponta para casos de uso concretos (vitrines e totens em varejo e feiras, apresentações comerciais, ambientes onde tocar em tela é indesejado) e deixa a demo avaliável por quem não tem interesse em "um cubo que gira". O projeto continua sendo uma demonstração: não tem usuários, contas nem coleta de dados, e o documento não afirma o contrário.

## 2. Skills ativadas e racional

| Skill / prática | Como foi usada | Impacto na entrega |
|---|---|---|
| `engineering:architecture` (carregada) | Formato e análise de trade-offs dos ADRs 0001 e 0002 | Decisões estruturais registradas com alternativas rejeitadas e consequências |
| Testes primeiro (prática de `testing-tdd`) | Cada correção e módulo novo nasceu de um teste que falhava (fixtures de mão sintéticas, relógio injetável) | Os bugs de sobreposição de gestos e de disparo repetido foram provados antes de corrigidos |
| JavaScript tipado (prática de `javascript-best-practices` / `type-safety`) | União discriminada `GestureResult`, `@typedef` nos módulos, `tsc` estrito | Erros de tipo encontrados no `format.js` e no `camera-state.js` antes de chegar ao navegador |
| Acessibilidade (`design:accessibility-review`, aplicada via axe) | axe em 320/768/1280 px a cada mudança de UI; anúncios só para mudanças discretas | 0 problemas serious/critical; leitor de tela informa forma, cor e câmera sem inundar com movimento contínuo |
| Performance (medição com Playwright e Lighthouse) | MediaPipe sob demanda, Three.js minificado, medição de bytes e tarefas longas | Detectou a regressão do `three.module.js` não minificado (319 KB → 233 KB após a troca) |
| Revisão de código e segurança | Revisão manual do diff, com testes de regressão para cada achado | Achou o conflito punho/pinça e falhas de I/O nos scripts; `/code-review` e `/security-review` automáticos **não foram executados** |

## 3. Melhorias propostas

### 3.1 Arquitetura

| # | Melhoria | Estado |
|---|---|---|
| A1 | Separar a lógica do `app.js` em módulos puros (`scene-actions`, `camera-state`) | feito |
| A2 | Tipagem por JSDoc + `tsc` estrito no CI | feito |
| A3 | Suavização de landmarks com identidade por mão | feito |
| A4 | Tempo limite e nova tentativa no carregamento do modelo | feito |
| A5 | Three.js por import map; `GLTFLoader` e MediaPipe sob demanda | feito |
| A6 | Migrar MediaPipe Hands (legado) para `@mediapipe/tasks-vision` | roteiro |
| A7 | Tipar `hand-tracker.js`, `scene-3d.js` e `app.js` (declarações para Three.js e MediaPipe) | roteiro |
| A8 | Contrato único de gestos entre o reconhecedor JS e o Python (catálogo em JSON gerado) | roteiro |

### 3.2 Visual e experiência

| # | Melhoria | Estado |
|---|---|---|
| V1 | Design system `ms-tokens`, IBM Plex Sans self-hosted, layout com a cena em destaque | feito |
| V2 | Painel de comando de gestos com barra de retenção | feito |
| V3 | Mensagens de erro de câmera e de modelo em PT-BR, com ação de recuperação | feito |
| V4 | Calibração da mão em 3 segundos (limiares proporcionais ao tamanho da palma) | roteiro |
| V5 | Modo apresentação/totem (tela cheia, interface mínima, volta ao início sem mãos) | roteiro |

### 3.3 Produto

| # | Melhoria | Estado |
|---|---|---|
| P1 | Visualizador de produto `.glb` (arquivo, arrastar e soltar, exemplo) | feito |
| P2 | Suporte a `.glb` com Draco e KTX2 (modelos de catálogo reais costumam usar) | roteiro |
| P3 | Painel de métricas da sessão, medidas no navegador e rotuladas | roteiro |
| P4 | API de incorporação (iframe + `postMessage`) para integrar em sites de terceiros | roteiro |
| P5 | Gestos personalizados com o classificador do app Python exportado para o navegador (ONNX) | roteiro |

## 4. Guias táticos de implementação

### A6. Migrar para `@mediapipe/tasks-vision`

- **O quê:** trocar a solução legada `Hands` pela `HandLandmarker` da Tasks API, em modo `VIDEO`, com delegate GPU e fallback para CPU.
- **Como:** novo adaptador em `hand-tracker.js` que entrega o mesmo formato `{ hands: [{ landmarks, handedness }] }`; o resto da aplicação não muda. O WASM vem do pacote `@mediapipe/tasks-vision` (versão fixa, SRI no módulo) e o modelo `hand_landmarker.task` (`float16/1`, o mesmo do app Python) é versionado em `public/mediapipe/`.
- **Bibliotecas:** `@mediapipe/tasks-vision` (versão fixa).
- **CSP:** manter `'wasm-unsafe-eval'`; `connect-src` passa a incluir o próprio site para o `.task`.
- **Negócio:** modelo mantido pelo Google, mais preciso e com melhor desempenho; alinha web e desktop no mesmo modelo.
- **Teste:** o e2e de câmera falsa continua válido; acrescentar um teste de contrato do adaptador com resultados gravados.

### A7. Tipar os módulos com DOM

- **Como:** declarar os globais e os tipos do MediaPipe num `types/mediapipe.d.ts`, instalar `@types/three@0.160` (mesma versão do runtime) e incluir os três arquivos no `tsconfig.json`.
- **Negócio:** fecha a última área sem verificação estática.

### V4. Calibração da mão

- **Como:** passo opcional "Calibrar" que pede a mão aberta por 3 s, mede o comprimento da palma (punho → nó do dedo médio) e escala `PINCH_THRESHOLD` e `TRANSLATION_DEADZONE` por esse fator; `V_SIGN_MIN_SPREAD_RATIO` já é relativo à palma. Guardar o fator em `localStorage` (conveniência local, com fallback para o padrão).
- **Negócio:** reduz falsos positivos com mãos pequenas, grandes ou longe da câmera, que são a principal fonte de frustração numa demo ao vivo.

### V5. Modo apresentação

- **Como:** botão "Modo apresentação" que chama `requestFullscreen()`, esconde painéis secundários e liga um temporizador de inatividade: sem mãos por 60 s, a cena volta ao estado inicial e mostra uma dica para começar. A lógica do temporizador é pura e testável.
- **Negócio:** caso de uso B2B direto (totem em loja ou feira) sem mudar a arquitetura.

### P2. Draco e KTX2

- **Como:** registrar `DRACOLoader` e `KTX2Loader` de `three/addons` no `GLTFLoader`, com decodificadores com versão fixa no jsDelivr; acrescentar os módulos ao import map com SRI e permitir `worker-src blob:` (já presente) e o caminho dos decodificadores em `connect-src`.
- **Negócio:** modelos exportados por ferramentas de e-commerce (e pelo próprio glTF Pipeline) costumam vir comprimidos; sem isso, o visualizador recusa arquivos reais.

### P3. Painel de métricas da sessão

- **Como:** medir no navegador a latência por quadro (tempo entre o envio do quadro ao modelo e o resultado), o FPS, gestos por minuto e o tempo até o primeiro gesto; exibir com rótulo "medido nesta sessão, nada é enviado". Nada de valores simulados.
- **Negócio:** mostra a avaliadores técnicos que o desempenho é medido, e serve de base para comparar a migração A6.

### P4. API de incorporação

- **Como:** página `/embed` (só cena e câmera) que emite eventos de gesto por `postMessage` para uma lista de origens permitidas configurada por parâmetro e validada; documentação com exemplo de integração. Exige revisar a CSP (`frame-ancestors` passa a listar as origens autorizadas apenas nessa rota).
- **Negócio:** integração B2B real e verificável: um site de catálogo pode incorporar o controle por gestos sem reescrever nada.

### P5. Gestos personalizados no navegador

- **Como:** exportar o classificador scikit-learn do app desktop para ONNX (`skl2onnx`) e executá-lo com `onnxruntime-web` sobre as features já calculadas; os gestos por regras continuam como fallback.
- **Negócio:** permite que um cliente treine gestos próprios no app desktop e os use na web.

## 5. Blocos de código críticos

### 5.1 Feito: ações da cena (um vocabulário para gestos, teclado e botões)

`public/js/scene-actions.js`. Gestos e teclas viram ações; só mudanças discretas geram anúncio para leitor de tela.

```js
export function actionForGesture(gesture) {
  if (!gesture?.active) return null;
  switch (gesture.name) {
    case 'open_palm': return { type: 'move', delta: gesture.data.delta, stopAutoRotate: true };
    case 'pinch': return { type: 'zoom', amount: gesture.data.distance < PINCH_SHRINK_BELOW ? -1 : 1 };
    case 'two_fingers': return { type: 'rotate', amount: gesture.data.angle * ROTATE_GAIN };
    case 'fist': return { type: 'reset' };
    case 'v_sign': return { type: 'nextShape' };
    case 'three_fingers': return { type: 'nextColor' };
    case 'dual_hands':
      return gesture.data.scaleDelta ? { type: 'zoom', amount: gesture.data.scaleDelta * DUAL_HAND_ZOOM_GAIN } : null;
    default: return null;
  }
}
```

### 5.2 Feito: retenção que dispara uma vez por gesto

`public/js/gesture-recognizer.js`. O progresso é o tempo medido; o disparo acontece em um único quadro até a pose ser desfeita.

```js
_holdResult(key, durationMs) {
  const now = this._now();
  const start = this._holdTimers.get(key) ?? now;
  this._holdTimers.set(key, start);
  const progress = Math.min(1, (now - start) / durationMs);
  const fires = progress >= 1 && !this._firedHolds.has(key);
  if (fires) this._firedHolds.add(key);
  return { name: key, active: fires, progress, holdMs: durationMs, data: null };
}
```

### 5.3 Feito: validação de `.glb` antes do parser

`public/js/model-file.js`.

```js
export function checkModelFile(file, header) {
  if (!/\.glb$/i.test(file.name)) return { ok: false, problem: 'type' };
  if (file.size === 0) return { ok: false, problem: 'empty' };
  if (file.size > MAX_MODEL_BYTES) return { ok: false, problem: 'size' };
  if (header.byteLength < 12) return { ok: false, problem: 'format' };
  const view = new DataView(header);
  const magic = view.getUint32(0, true);   // ASCII "glTF"
  const version = view.getUint32(4, true);
  const length = view.getUint32(8, true);
  if (magic !== 0x46546c67 || version !== 2 || length !== file.size) return { ok: false, problem: 'format' };
  return { ok: true };
}
```

### 5.4 Feito: MediaPipe sob demanda, com SRI e tempo limite

`public/js/hand-tracker.js`.

```js
function loadHandsScript() {
  if (typeof window.Hands !== 'undefined') return Promise.resolve();
  handsScriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = MEDIAPIPE_HANDS_SCRIPT.src;
    script.integrity = MEDIAPIPE_HANDS_SCRIPT.integrity;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => {
      handsScriptPromise = null; // allow "Tentar novamente" to request it again
      script.remove();
      reject(new CameraError('model', 'Failed to load MediaPipe Hands script'));
    };
    document.head.append(script);
  });
  return handsScriptPromise;
}
```

### 5.5 Roteiro A6: adaptador para `HandLandmarker` (não executado)

Substitui `_initMediaPipe` e `_processFrame` mantendo o formato de saída. Conferir a API na versão fixada de `@mediapipe/tasks-vision` antes de usar.

```js
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export async function createLandmarker(wasmBaseUrl, modelUrl) {
  const fileset = await FilesetResolver.forVisionTasks(wasmBaseUrl);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: modelUrl, delegate },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5,
  });
  try {
    return await HandLandmarker.createFromOptions(fileset, options('GPU'));
  } catch {
    return HandLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

/** Same shape the rest of the app already consumes. */
export function detect(landmarker, video, timestampMs) {
  const result = landmarker.detectForVideo(video, timestampMs);
  return result.landmarks.map((landmarks, i) => ({
    landmarks,
    handedness: result.handedness[i]?.[0]?.categoryName ?? 'Unknown',
  }));
}
```

### 5.6 Roteiro V5: temporizador de inatividade do modo apresentação (não executado)

Puro e testável com relógio injetado, no mesmo padrão de `camera-state.js`.

```js
/** Returns true once when no hand has been seen for `idleMs`. */
export function createIdleWatch(idleMs, now = () => performance.now()) {
  let lastSeen = now();
  let fired = false;
  return {
    /** @param {number} handCount */
    update(handCount) {
      if (handCount > 0) { lastSeen = now(); fired = false; return false; }
      if (!fired && now() - lastSeen >= idleMs) { fired = true; return true; }
      return false;
    },
  };
}
```

### 5.7 Roteiro P4: ponte de `postMessage` para incorporação (não executado)

Só envia para origens permitidas e nunca usa `'*'`.

```js
/** @param {string[]} allowedOrigins exact origins, e.g. ['https://loja.example'] */
export function createEmbedBridge(allowedOrigins, target = window.parent) {
  const origins = new Set(allowedOrigins.filter((o) => /^https:\/\/[^/]+$/.test(o)));
  return {
    /** @param {{ gesture: string, detail?: string }} event */
    emit(event) {
      for (const origin of origins) target.postMessage({ source: '3d-hands', version: 1, ...event }, origin);
    },
  };
}
```

### 5.8 Roteiro P2: Draco e KTX2 no `GLTFLoader` (não executado)

Exige mapear os módulos no import map com SRI e fixar a versão dos decodificadores.

```js
const [{ GLTFLoader }, { DRACOLoader }, { KTX2Loader }] = await Promise.all([
  import('three/addons/loaders/GLTFLoader.js'),
  import('three/addons/loaders/DRACOLoader.js'),
  import('three/addons/loaders/KTX2Loader.js'),
]);
const loader = new GLTFLoader()
  .setDRACOLoader(new DRACOLoader().setDecoderPath(DRACO_DECODER_BASE_URL))
  .setKTX2Loader(new KTX2Loader().setTranscoderPath(BASIS_TRANSCODER_BASE_URL).detectSupport(renderer));
```

## Referências no repositório

- Decisões: [`docs/adr/0001-frontend-modular-sem-build.md`](adr/0001-frontend-modular-sem-build.md), [`docs/adr/0002-dependencias-por-import-map-e-sob-demanda.md`](adr/0002-dependencias-por-import-map-e-sob-demanda.md)
- Histórico de versões: [`CHANGELOG.md`](../CHANGELOG.md)
- Visão geral e comandos: [`README.md`](../README.md)
