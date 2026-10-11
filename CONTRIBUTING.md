# Como contribuir com o 3D Hands

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) em inglês, uma linha, sem corpo nem rodapé:

```
fix: align gesture guide with recognizer
```

Tipos usados: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `build`, `ci`, `chore`.

## Branches

| Branch | Uso |
|---|---|
| `main` | produção (cada merge publica na Vercel) |
| `feat/*`, `fix/*`, `update/*` | trabalho em andamento, com PR para `main` |

## Antes do PR

```bash
npm test && npm run check && npm run test:e2e
pytest
```

## Adicionar um gesto na versão web

1. Crie o método `_detect<Nome>()` em `public/js/gesture-recognizer.js`, chame-o em `recognize()` e inclua o nome em `GESTURE_NAMES`.
2. Acrescente a entrada em `GESTURE_CATALOG` (`public/js/config.js`), com rótulo, ícone, tempo de retenção e ação em PT-BR. O painel na tela é montado a partir dessa lista.
3. Aplique a ação em `_applyToScene()` (`public/js/app.js`).
4. Escreva o teste com landmarks sintéticos em `tests-web/` (veja `hand-fixtures.mjs`) e atualize a tabela de gestos do README; `tests-web/readme.test.mjs` confere as duas listas.

## Adicionar um gesto no app desktop

1. Crie o método `_detect_<nome>` em `gestures/gesture_recognizer.py` e chame-o em `recognize()`.
2. Registre o nome em `core/constants.py`, se o estado for exibido.
3. Acrescente ao menos um teste em `tests/test_gesture_recognizer.py`.
