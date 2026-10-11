# 3D Hands

Gire, mova e troque a forma de um objeto 3D com gestos da mão, pela webcam ou pelo teclado, direto no navegador.

[![Portfólio](https://img.shields.io/badge/Portf%C3%B3lio-Projetos-000000?style=for-the-badge&logo=googlechrome&logoColor=white)](https://www.matheussiqueira.dev/pt-BR/projects)
[![Código](https://img.shields.io/badge/C%C3%B3digo-GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/matheussiqueira-dev/3D-hands)

Demo: https://3-d-hands.vercel.app

## O que é

O repositório tem duas partes:

| Parte | Stack | Onde |
|---|---|---|
| Web (principal) | HTML e JavaScript (ES modules) sem build, Three.js 0.160.0 e MediaPipe Hands 0.4.1675469240 por CDN com SRI | `public/` |
| Desktop (referência) | Python, OpenCV, MediaPipe Tasks, pygame-ce e PyOpenGL, com classificador de gestos treinável (scikit-learn) | `app/`, `core/`, `gestures/`, `interaction/`, `ui/`, `utils/`, `vision/` |

Na versão web, o MediaPipe encontra até duas mãos no vídeo da webcam, um reconhecedor por regras (`public/js/gesture-recognizer.js`) transforma os 21 pontos de cada mão em gestos, e a cena Three.js aplica a ação. O painel de gestos mostra qual gesto foi reconhecido e, nos gestos com retenção, uma barra com o tempo que falta.

## Privacidade

O vídeo é processado no seu navegador e não é enviado a nenhum servidor. A página não tem backend nem telemetria; o Three.js e o MediaPipe são baixados do jsDelivr com versão fixa.

## Gestos

A tabela abaixo é conferida por teste contra `GESTURE_CATALOG` em `public/js/config.js`, a mesma lista que monta o painel na tela.

| Gesto | Retenção | Ação |
|---|---|---|
| Mão aberta | — | move o objeto na horizontal e na vertical |
| Pinça | — | muda a escala: quase fechada reduz, entreaberta amplia |
| Dois dedos juntos | — | gira o objeto |
| Punho fechado | 2 s | redefine o objeto |
| Sinal de V | 1 s | troca a forma |
| Três dedos | 0,8 s | troca a cor |
| Duas mãos | — | muda a escala ao afastar ou aproximar as mãos |

Um gesto com retenção dispara uma vez por retenção: para repetir, abra a mão e faça o gesto de novo. "Dois dedos juntos" e "Sinal de V" usam os mesmos dedos; o que separa os dois é a abertura entre as pontas do indicador e do médio (`V_SIGN_MIN_SPREAD_RATIO`).

## Teclado

Funciona sem câmera.

| Tecla | Ação |
|---|---|
| `↑` `↓` `←` `→` | move o objeto |
| `N` | troca a forma |
| `C` | troca a cor |
| `R` | redefine o objeto |
| `+` `−` | muda a escala |
| `Espaço` | volta a girar sozinho |
| `Esc` | desliga a câmera |

## Limitações

- Reconhece até duas mãos ao mesmo tempo.
- Luz forte atrás da pessoa e mãos muito perto da câmera atrapalham o reconhecimento.
- Gestos com retenção exigem a mão parada durante todo o tempo indicado.
- Os limiares do reconhecedor foram ajustados com landmarks sintéticos nos testes; com mãos e câmeras reais, podem precisar de calibração.
- A câmera exige HTTPS (ou `localhost`) e um navegador com WebGL e `getUserMedia`.

## Rodar a versão web

Requisitos: Node 22 ou mais recente.

```bash
npm ci
npm run build    # gera public/version.json (versão e commit do rodapé)
npm run serve    # http://127.0.0.1:3000 com os mesmos headers do vercel.json
```

Testes:

```bash
npm test             # testes unitários (node --test) do reconhecedor, formatação, catálogo e metadados
npm run check        # sintaxe de todos os módulos
npm run test:e2e     # Playwright: teclado, câmera falsa, câmera negada, overflow e axe
```

No Windows, o Playwright usa o Microsoft Edge instalado (`channel: "msedge"`); no CI, o Chromium do Playwright.

## App desktop (Python)

Requisitos: Python 3.12 (versão do CI; 3.13 também foi testado), webcam e GPU com OpenGL.

```bash
python -m venv .venv
.venv\Scripts\activate          # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python -m app.gesture_3d_main   # cena 3D controlada por gestos (--simple para a versão simplificada)
python -m app.main              # modo de depuração com coleta de amostras e treino do classificador
```

No modo de depuração, `T` inicia a coleta de amostras de um gesto (o nome é digitado no terminal), `R` treina o classificador com as amostras coletadas e `Esc` sai.

A configuração vem de variáveis de ambiente `GESTURE_*`, lidas em `core/config.py`; o app não carrega arquivos `.env` sozinho. O `.env.example` lista as principais.

O modelo `models/mediapipe/hand_landmarker.task` é o Hand Landmarker do MediaPipe, variante `float16/1`, baixado de `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task` (licença Apache-2.0). Só o app desktop usa esse arquivo.

Testes do Python:

```bash
pip install -r requirements-dev.txt
pytest
pip-audit -r requirements.txt
```

## Estrutura

```
public/            site estático servido pela Vercel
  index.html       página única
  ms-tokens.css    design system compartilhado (v1.0, conferido por hash)
  css/style.css    estilos do app, só com tokens
  js/              app, reconhecedor, cena 3D, rastreador de mãos, formatação PT-BR
  fonts/           IBM Plex Sans variável (OFL-1.1)
scripts/           servidor local, checagem de sintaxe, version.json e geração do favicon e da imagem OG
tests-web/         testes unitários (node --test)
tests-e2e/         testes Playwright
app/ core/ gestures/ interaction/ ui/ utils/ vision/   app desktop em Python
tests/             testes pytest do app desktop
```

## Deploy

O projeto Vercel `3-d-hands` publica `public/` (`outputDirectory` no `vercel.json`) e roda `npm run build` para gerar o `version.json`. Não há funções serverless nem variáveis de ambiente obrigatórias. O `vercel.json` define CSP, `Permissions-Policy: camera=(self)`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` e cache imutável para `/fonts/`.

O favicon e a imagem OG são gerados por `python scripts/generate_brand_assets.py` (dependências em `requirements-dev.txt`).

## Licença

MIT. Veja [LICENSE](LICENSE). A fonte IBM Plex Sans é distribuída sob a SIL Open Font License 1.1 (`public/fonts/LICENSE-OFL.txt`) e os ícones vêm do Lucide (ISC).

---

### Desenvolvido por Matheus Siqueira

**Analista de Dados & BI | Power BI • SQL • Python • DAX | ETL, Modelagem de Dados, KPIs e Automação**

Conecte-se e acesse meus projetos:

[![Portfólio](https://img.shields.io/badge/Portf%C3%B3lio-matheussiqueira.dev-000000?style=for-the-badge&logo=googlechrome&logoColor=white)](https://www.matheussiqueira.dev)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Matheus_Siqueira-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/matheussiqueira-dev)
[![GitHub](https://img.shields.io/badge/GitHub-matheussiqueira--dev-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/matheussiqueira-dev)
[![E-mail](https://img.shields.io/badge/E--mail-hellomatheusdev%40gmail.com-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:hellomatheusdev@gmail.com)
