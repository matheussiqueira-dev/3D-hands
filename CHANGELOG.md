# Changelog

Todas as mudanças relevantes deste projeto. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), com versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Corrigido
- "Tentar novamente" não fazia nada depois de um erro de câmera ou de modelo durante o uso: a sessão ficava marcada como ativa. Todo erro de câmera agora passa por um único caminho que encerra a sessão.
- Uma falha do modelo de mãos durante o uso repetia o erro a cada quadro; agora a câmera para uma vez e mostra a mensagem.
- Câmera desconectada ou com acesso retirado durante o uso deixava o vídeo congelado sem aviso; agora aparece "A câmera parou de enviar imagem", com "Tentar novamente".
- A segunda tentativa de abrir a câmera (sem restrições de resolução) não traduzia o erro e mostrava a mensagem genérica em vez de "A câmera foi bloqueada".
- Parar e reiniciar a câmera enquanto um quadro estava em processamento podia deixar dois laços de quadros rodando.
- Soltar um arquivo fora da área da cena fazia o navegador abrir ou baixar o arquivo.

### Alterado
- Reconhecimento de mãos migrado do MediaPipe Hands legado (0.4.1675469240) para o `HandLandmarker` do `@mediapipe/tasks-vision` 1.1.1, em modo vídeo, com delegate GPU e fallback para CPU. O modelo é o mesmo `hand_landmarker.task` (`float16/1`) do app desktop.
- Three.js atualizado de 0.160.0 para 0.186.1, com `@types/three` 0.186.0.
- Three.js, MediaPipe (código, WASM e modelo) passam a ser servidos pelo próprio site: `npm run build` gera `public/vendor/` com esbuild (módulos minificados, com tree-shaking e hash no nome) e escreve o import map e o hash da CSP. A pasta é gerada no deploy e não é versionada ([ADR-0003](docs/adr/0003-dependencias-self-hosted-com-build.md), que substitui o ADR-0002).
- CSP só com `'self'`: sai `https://cdn.jsdelivr.net` de `script-src` e `connect-src`, e `blob:` de `worker-src` e `media-src`. `/vendor/` ganha cache imutável.
- Three.js baixado na abertura da página: de 135 KB para 119 KB com brotli; `GLTFLoader`: de 25 KB para 12 KB.
- `app.js`, `scene-3d.js` e `hand-tracker.js` passam a ser conferidos pelo `tsc` em modo estrito, como os demais módulos; os elementos da página são procurados por uma tabela tipada que confere a classe de cada um. Os tipos do Three.js vêm de `@types/three` (só desenvolvimento).
- Dependências de desenvolvimento: `@playwright/test` 1.64.1 e `@axe-core/playwright` 4.14.0.
- App desktop: `numpy` 2.5.4, `scikit-learn` 1.9.1, `joblib` 1.6.0, `pandas` 3.0.6, `pygame-ce` 2.5.8 e `fonttools` 4.67.0. Versões maiores (`mediapipe` 1.x, `opencv-contrib-python` 5.x) ficam para uma mudança própria.

## [1.2.0] - 2026-10-15

### Adicionado
- Visualizador de produto: carregue um modelo `.glb` próprio (botão, arrastar e soltar na cena ou a luminária de exemplo) e controle-o com os mesmos gestos e atalhos. O arquivo é validado (extensão, até 25 MB, cabeçalho glTF 2.0) e lido só no navegador.
- Luminária de exemplo original (`public/models/luminaria.glb`), gerada por `scripts/generate_sample_model.mjs`.
- Suavização dos landmarks por média móvel, com identidade por mão.
- Tempo limite de 30 s na inicialização do modelo de mãos, com mensagem e "Tentar novamente".
- Verificação de tipos com JSDoc e `tsc --checkJs` em modo estrito no CI (`npm run typecheck`).
- ADRs em `docs/adr/` e o roteiro de evolução em `docs/EVOLUCAO.md`.

### Alterado
- Three.js carregado como ES module minificado por import map com SRI; o import map entra na CSP por hash, sem `unsafe-inline`.
- MediaPipe Hands baixado só depois de "Ativar câmera".
- Lógica do `app.js` separada em `scene-actions.js`, `camera-state.js` e `model-panel.js`.
- Atalhos de letra (N, C, R, +/−) funcionam mesmo com um botão em foco; Espaço, Enter e setas continuam com o controle focado.
- Luz de preenchimento na cena, para modelos escuros ou metálicos.

### Corrigido
- Modelos `.glb` com texturas embutidas apareciam sem textura: a CSP bloqueava o `fetch` das URLs `blob:` que o `GLTFLoader` cria para as imagens. `connect-src` passa a aceitar `blob:`.

### Removido
- Funções e chaves de configuração sem uso (`lerp`, `Smoother`, `debounce`, `throttle`, `PALM_HOLD_MS` e outras).
- Script UMD `three.min.js`, obsoleto desde o r150.

## [1.1.0] - 2026-10-11

### Adicionado
- Painel de comando de gestos: uma linha por gesto suportado, com a ação e uma barra que mostra o tempo real de retenção do punho (2 s), do sinal de V (1 s) e dos três dedos (0,8 s).
- Leitura textual da pose (forma, cor, posição, rotação e escala) ligada ao estado real da cena, e anúncios para leitor de tela quando a forma, a cor ou a câmera mudam.
- Mensagens de erro de câmera em PT-BR na tela (bloqueada, ausente, em uso, sem suporte, falha do modelo), com "Tentar novamente".
- Botão "Redefinir objeto", link "Usar só o teclado" e chips de estado da câmera, das mãos e do FPS medido.
- Testes unitários do reconhecedor com landmarks sintéticos (`node --test`), testes Playwright (teclado, câmera falsa sob a CSP, câmera negada, overflow de 320 a 1440 px, axe) e CI no GitHub Actions com pytest, pip-audit, npm audit e cobertura mínima de 80%.
- Favicon com o monograma 3D, ícones, imagem Open Graph, metadados de autoria, JSON-LD e rodapé padrão com versão e commit.

### Alterado
- Interface refeita sobre o design system `ms-tokens.css` v1.0, com IBM Plex Sans self-hosted, layout com a cena 3D em destaque e textos em PT-BR.
- `vercel.json` migrado de `builds`/`routes` para `outputDirectory`, com CSP, `Permissions-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` e cache imutável para fontes.
- Three.js e MediaPipe Hands com versão fixa e SRI; `camera_utils` e `drawing_utils`, que não eram usados, saíram.
- Cores do objeto, do fundo e dos landmarks lidas dos tokens.
- Títulos das janelas do app desktop passam a "3D Hands" e "3D Hands - Debug".
- README único em PT-BR; `.env.example` agora lista as variáveis `GESTURE_*` que o app desktop realmente lê.

### Corrigido
- O guia de gestos prometia "polegar para cima/baixo", que não existem, e "três dedos por 0,6 s" (o código usa 0,8 s); agora ele é gerado da mesma lista que o reconhecedor usa.
- A interface mostrava porcentagens de confiança constantes (90%, 85%, 95%); foram trocadas pelo progresso medido da retenção.
- O gesto de girar disparava durante o sinal de V e os três dedos, e a pinça podia mudar a escala durante o punho.
- O punho mantido redefinia o objeto a cada quadro; gestos com retenção agora disparam uma vez por retenção.
- O painel de pose mostrava valores fixos ("Cubo", "0, 0, 0") que nunca mudavam.
- O canvas 3D não acompanhava o tamanho do palco.
- Overflow horizontal em telas de 320 px.

### Removido
- Link de WhatsApp com telefone pessoal.
- Função `api/gesture.js`, que nunca foi publicada (404), e o envio de cada gesto para ela.
- `CONVERSION-SUMMARY.md`, `README-VERCEL.md`, `QUICKSTART.md`, `DEPLOY-CHECKLIST.md`, `RELEASE.md` e `public/test.html`.

## [1.0.0] - 2026-06-05

- Versão inicial publicada: cena Three.js controlada por gestos no navegador e app desktop em Python.

[1.2.0]: https://github.com/matheussiqueira-dev/3D-hands/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/matheussiqueira-dev/3D-hands/compare/f481529...v1.1.0
[1.0.0]: https://github.com/matheussiqueira-dev/3D-hands/tree/f481529
