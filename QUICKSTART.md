# Quick Start Guide - 3D Hands Web

## 🚀 Teste Local Rápido

### Método 1: Python (Mais Simples)

Se você tem Python instalado:

```bash
cd "C:\Users\mathe\OneDrive\Documents\portfolio-main\3D Hands"
python -m http.server 8000 --directory public
```

Abra: http://localhost:8000

### Método 2: Node.js

```bash
npx http-server public -p 8000 -o
```

### Método 3: VS Code Live Server

1. Instale a extensão "Live Server" no VS Code
2. Abra `public/index.html`
3. Clique em "Go Live" na barra de status

## 🧪 Teste de Compatibilidade

Abra `public/test.html` primeiro para verificar se seu navegador suporta todas as funcionalidades.

## 📦 Deploy no Vercel

### Opção A: Vercel CLI (Recomendado)

```bash
# Instalar Vercel CLI globalmente
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy para produção
vercel --prod
```

### Opção B: GitHub + Vercel

1. Crie um repositório no GitHub
2. Push do código:
```bash
git init
git add .
git commit -m "3D Hands Web App"
git branch -M main
git remote add origin <seu-repo-url>
git push -u origin main
```

3. Vá em https://vercel.com
4. Clique em "Import Project"
5. Conecte seu GitHub e selecione o repositório
6. Deploy automático!

### Opção C: Arrastar e Soltar

1. Acesse https://vercel.com/new
2. Arraste a pasta do projeto
3. Deploy!

## ⚙️ Configurações Importantes

O arquivo `vercel.json` já está configurado para:
- Servir arquivos estáticos de `public/`
- Habilitar CORS para MediaPipe
- Rotear APIs serverless

## 🎮 Uso

1. Permita acesso à câmera
2. Use gestos para controlar o objeto 3D
3. Veja o guia de gestos na interface

## 🐛 Problemas Comuns

### "Não consigo acessar a câmera"
- Use HTTPS ou localhost
- Verifique permissões do navegador
- Tente Chrome ou Edge

### "Three.js não carrega"
- Verifique sua conexão com internet
- Os recursos vêm de CDN

### "Porta 8000 já está em uso"
- Use outra porta: `python -m http.server 8080 --directory public`
- Ou: `npx http-server public -p 8080`

## 📝 Próximos Passos

1. Teste localmente
2. Deploy no Vercel
3. Configure domínio customizado (opcional)
4. Compartilhe sua aplicação!

## 🔗 Links Úteis

- Documentação Vercel: https://vercel.com/docs
- Three.js: https://threejs.org
- MediaPipe: https://google.github.io/mediapipe

---

**Dúvidas?** Abra uma issue no GitHub!
