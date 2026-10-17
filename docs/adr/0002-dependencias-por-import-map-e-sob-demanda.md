# ADR-0002: Three.js por import map com SRI e MediaPipe sob demanda

**Status:** Substituído pelo [ADR-0003](0003-dependencias-self-hosted-com-build.md) (dependências self-hosted em `public/vendor/`)
**Data:** 2026-10-15
**Decisores:** Matheus Siqueira

## Contexto

A página carregava o Three.js como `three.min.js` (formato UMD, obsoleto desde o r150, com aviso no console) e o `hands.js` do MediaPipe no carregamento, mesmo para quem nunca ativa a câmera. O visualizador de modelos `.glb` precisa do `GLTFLoader`, que só é publicado como ES module e importa o especificador `three`. A CSP não permite scripts inline sem hash.

## Decisão

1. Carregar o Three.js como ES module por um import map inline (`three` → `three.module.min.js`, `three/addons/` → `examples/jsm/`), com versão fixa e o campo `integrity` (SRI) para cada módulo usado.
2. Autorizar o import map na CSP pelo hash SHA-256 do seu conteúdo, sem `unsafe-inline`; um teste unitário recalcula o hash e falha se o HTML e o `vercel.json` divergirem.
3. Importar o `GLTFLoader` dinamicamente, só quando um modelo é carregado.
4. Injetar o `hands.js` (com SRI) só no primeiro clique em "Ativar câmera", com tempo limite de 30 s na inicialização do modelo.

## Opções consideradas

### Opção A: import map + carregamento sob demanda (escolhida)
**Prós:** um único Three.js compartilhado pela cena e pelos addons; SRI em todos os módulos mapeados; nenhum byte do MediaPipe para quem só usa o teclado; console limpo.
**Contras:** o import map precisa de hash na CSP (mantido por teste); `integrity` em import maps não é suportado por navegadores antigos (nesse caso o módulo carrega sem verificação).

### Opção B: endpoints `+esm` do jsDelivr
**Prós:** sem import map.
**Contras:** o CDN reescreve os imports e pode resolver outra versão do `three`, gerando duas cópias da biblioteca (quebra `instanceof`); sem SRI estável.

### Opção C: self-host dos módulos em `public/vendor/`
**Prós:** CSP poderia ficar só em `'self'`.
**Contras:** mais arquivos versionados e atualização manual; o padrão do portfólio aceita CDN com versão fixa e SRI.

## Consequências

- Mais fácil: adicionar outros addons do Three.js (basta mapear e acrescentar o SRI); medir o custo real da câmera, que agora só existe depois do clique.
- Mais difícil: qualquer edição no import map exige atualizar o hash da CSP (o teste aponta).
- Revisitar: migrar de MediaPipe Hands (legado) para `@mediapipe/tasks-vision`, mantendo o carregamento sob demanda.

## Itens de ação

1. [x] Import map com SRI e hash na CSP, com teste.
2. [x] `hands.js` sob demanda com SRI e tempo limite.
3. [ ] Migrar para `@mediapipe/tasks-vision` (ver `docs/EVOLUCAO.md`).
