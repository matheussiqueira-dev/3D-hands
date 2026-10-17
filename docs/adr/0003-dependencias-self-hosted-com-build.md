# ADR-0003: Three.js e MediaPipe Tasks Vision self-hosted, com etapa de build só para dependências

**Status:** Aceito
**Data:** 2026-10-17
**Decisores:** Matheus Siqueira
**Substitui:** [ADR-0002](0002-dependencias-por-import-map-e-sob-demanda.md) e, em parte, [ADR-0001](0001-frontend-modular-sem-build.md) (o código da aplicação continua sem build)

## Contexto

A página carregava o Three.js 0.160.0 do jsDelivr por import map com SRI e injetava o `hands.js` do MediaPipe Hands 0.4.1675469240 (solução legada, sem manutenção) com SRI. Duas mudanças tornaram esse modelo insustentável:

1. A partir do r17x o pacote `three` não publica mais `*.min.js`; só `three.module.js` e `three.core.js` (cerca de 313 KB com brotli, sem minificar, contra 135 KB do `three.module.min.js` 0.160). Os `.min.js` que o jsDelivr gera na hora não têm conteúdo garantido entre requisições, então não podem levar SRI.
2. A migração para `@mediapipe/tasks-vision` (`HandLandmarker`) precisa de um módulo ES, de um par WASM e do modelo `hand_landmarker.task`, que o pacote npm não traz e que já está no repositório (`models/mediapipe/`, o mesmo do app Python).

## Decisão

1. `three` 0.186.1 e `@mediapipe/tasks-vision` 1.1.1 viram dependências npm com versão exata; `esbuild` e `@types/three` 0.186 (mesma versão menor do runtime) são dependências de desenvolvimento.
2. `npm run build` roda `scripts/build-vendor.mjs`, que:
   - gera em `public/vendor/` módulos ES minificados e com hash de conteúdo no nome: `three` só com os `THREE.*` que o código usa (tree-shaking), o `GLTFLoader` (continua sob demanda e compartilha o chunk do Three.js) e `vendor/hand-landmarker` (`FilesetResolver`, `HandLandmarker` e as URLs do WASM e do modelo);
   - copia o WASM do tasks-vision (com e sem SIMD) para `public/vendor/tasks-vision-<versão>/` e o modelo para `public/vendor/hand_landmarker-<hash>.task`;
   - escreve o import map no `index.html` e o hash SHA-256 dele na CSP do `vercel.json`.
3. A saída de `public/vendor/` **não é versionada**: a Vercel a gera no deploy a partir do `package-lock.json`. O `index.html` e o `vercel.json` são versionados, e no CI e na Vercel (`CI`/`VERCEL` definidos, ou `--check`) o build só confere que os dois batem com o que gerou e falha se não baterem.
4. A CSP passa a ser só `'self'`: sai `https://cdn.jsdelivr.net` de `script-src` e `connect-src`, ficam `'wasm-unsafe-eval'` (WASM do MediaPipe) e `blob:` em `connect-src` (texturas embutidas em `.glb`); `worker-src` e `media-src` perdem o `blob:`, que só a solução legada usava.
5. `/vendor/` é servido com `Cache-Control: public, max-age=31536000, immutable`; todo nome ali é versionado ou tem hash de conteúdo.
6. `hand-tracker.js` usa `HandLandmarker` em modo `VIDEO`, com delegate GPU e fallback para CPU, mantendo o contrato público (`onResults`/`onError`, códigos de `CameraError`, formato de `TrackingResult`, suavização, laço protegido por run id e tratamento de trilha encerrada).

## Opções consideradas

### Opção A: self-host com build só das dependências, saída gerada na Vercel (escolhida)
**Prós:** nenhum código de terceiros vem de outra origem; a integridade vem do `package-lock.json` (sha512 conferido pelo `npm ci`), sem SRI de CDN; Three.js menor que o 0.160 minificado; cache imutável; repositório sem binários gerados.
**Contras:** o deploy depende do `npm ci` e do esbuild; qualquer mudança que altere os bundles (nova versão, um `THREE.*` novo no código, outro modelo) exige rodar `npm run build` e versionar o `index.html` e o `vercel.json` (o CI aponta).

### Opção B: self-host com a saída versionada no repositório
**Prós:** o deploy vira cópia de arquivos, como antes.
**Contras:** cerca de 27 MB de WASM e 8 MB de modelo duplicados a cada atualização no histórico do Git; arquivos gerados podem divergir do lockfile sem ninguém perceber.

### Opção C: continuar no jsDelivr
**Prós:** sem build.
**Contras:** Three.js r17x+ sem minificar (mais que o dobro do 0.160) ou `.min.js` gerado na hora sem SRI; `HandLandmarker` exigiria um segundo domínio para o modelo (Google Storage) na CSP.

### Opção D: bundler para a aplicação inteira (Vite)
**Prós:** um bundle só, minificação do código próprio.
**Contras:** troca o modelo de módulos sem build do ADR-0001 sem necessidade; o código próprio é pequeno (cerca de 25 KB com brotli) e o ganho não paga a mudança.

## Consequências

- Mais fácil: atualizar Three.js ou tasks-vision (mudar a versão no `package.json`, `npm run build`, versionar o `index.html` e o `vercel.json`); acrescentar addons, como Draco e KTX2, como novas entradas do `build-vendor.mjs`.
- Mais difícil: rodar a página sem `npm ci && npm run build` (o `public/vendor/` não existe num clone novo).
- O WASM do tasks-vision é maior que o da solução legada (2,8 MB contra 1,3 MB com brotli), compensado pelo modelo menor; o total baixado ao ativar a câmera fica parecido, e as visitas seguintes usam o cache imutável. Os números medidos estão no PR desta mudança.
- Revisitar: se a Vercel passar a ler a CSP depois do build, o hash poderia ser gerado só no deploy; se o tasks-vision publicar um WASM só com as tarefas de mão, trocar por ele.

## Itens de ação

1. [x] `scripts/build-vendor.mjs`, com conferência no CI e na Vercel.
2. [x] `hand-tracker.js` sobre `HandLandmarker`, com testes e2e que trocam o módulo por um falso.
3. [x] CSP só com `'self'` e cache imutável para `/vendor/`.
