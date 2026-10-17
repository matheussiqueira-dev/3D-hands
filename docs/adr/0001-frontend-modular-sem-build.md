# ADR-0001: Front-end modular sem build, com tipagem por JSDoc

**Status:** Substituído em parte pelo [ADR-0003](0003-dependencias-self-hosted-com-build.md): o código da aplicação continua sem build, mas as dependências de terceiros passam por uma etapa de build
**Data:** 2026-10-15
**Decisores:** Matheus Siqueira

## Contexto

A versão web tem cerca de 2.300 linhas de JavaScript estático servidas pela Vercel, sem etapa de build. Até a v1.1.0, quase toda a orquestração estava em `app.js` (455 linhas, 25 métodos), misturando DOM, estado da câmera e regras de negócio; só o reconhecedor de gestos tinha testes unitários. Havia pedido para "padrão corporativo" (Clean Architecture, injeção de dependências, tipagem estrita), e o `AGENTS.md` do repositório proíbe refatorações amplas sem necessidade.

## Decisão

Manter ES modules sem build e separar a lógica em módulos puros (sem DOM) com fronteiras explícitas: `gesture-recognizer`, `scene-actions`, `camera-state`, `model-file`, `utils`, `format` e `config`. `app.js` só liga esses módulos ao DOM. A tipagem é feita com JSDoc e conferida pelo `tsc --checkJs` em modo estrito no CI; as dependências externas (relógio, cena) entram por parâmetro onde os testes precisam.

## Opções consideradas

### Opção A: módulos puros + JSDoc + `tsc` (escolhida)
| Dimensão | Avaliação |
|---|---|
| Complexidade | Baixa |
| Custo | Uma devDependency (`typescript`), sem build |
| Escalabilidade | Boa para o tamanho atual; módulos novos seguem o mesmo padrão |
| Familiaridade | JavaScript padrão |

**Prós:** testes unitários rápidos (`node --test`), tipos verificados sem transpilar, deploy continua sendo cópia de arquivos.
**Contras:** JSDoc é mais verboso que TypeScript; `scene-3d.js`, `hand-tracker.js` e `app.js` ficam fora do `tsc` (dependem de DOM e de globais do MediaPipe).

### Opção B: Clean Architecture com camadas e contêiner de injeção de dependências
| Dimensão | Avaliação |
|---|---|
| Complexidade | Alta para ~2.300 linhas |
| Custo | Mais arquivos e indireção do que código de domínio |
| Escalabilidade | Útil com vários times e domínios, não é o caso |
| Familiaridade | Exige convenções próprias |

**Prós:** separação formal de camadas.
**Contras:** cerimônia desproporcional; dificulta a leitura de uma demo pequena, que é exatamente o que um avaliador técnico faz.

### Opção C: migrar para TypeScript + Vite (ou um framework)
**Prós:** tipos nativos e ecossistema de build.
**Contras:** introduz build, lockfile maior e mudança de deploy sem ganho funcional para a demo.

## Análise de trade-offs

O risco real era o acoplamento de `app.js`, não a falta de camadas. Extrair a lógica para funções puras resolve a testabilidade com o menor custo; o `tsc --checkJs` entrega a "tipagem estrita" pedida sem build.

## Consequências

- Mais fácil: testar regras de câmera, ações e validação sem navegador; revisar mudanças pequenas.
- Mais difícil: tipar os módulos que tocam o DOM e os globais do MediaPipe.
- Revisitar: se a interface crescer (vários painéis com estado compartilhado), avaliar TypeScript com build.

## Itens de ação

1. [x] Extrair `scene-actions.js` e `camera-state.js` de `app.js`.
2. [x] `npm run typecheck` no CI.
3. [ ] Incluir `hand-tracker.js` no `tsc` com declarações para o MediaPipe ao migrar para Tasks Vision.
