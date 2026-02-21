# 3D Hands - Web Version (Vercel)

🎉 **Aplicação Web convertida para rodar no Vercel!**

Esta é a versão web do aplicativo 3D Hands, totalmente compatível com o Vercel usando:
- **Frontend**: HTML5, CSS3, JavaScript (ES6 Modules)
- **3D Rendering**: Three.js
- **Hand Tracking**: MediaPipe Web (via CDN)
- **Backend**: Vercel Serverless Functions (opcional)

## 🚀 Deploy no Vercel

### Opção 1: Deploy via CLI (Recomendado)

1. **Instale o Vercel CLI**:
```bash
npm install -g vercel
```

2. **Login no Vercel**:
```bash
vercel login
```

3. **Deploy**:
```bash
vercel
```

4. **Deploy para produção**:
```bash
vercel --prod
```

### Opção 2: Deploy via GitHub

1. Crie um repositório no GitHub
2. Faça push do código:
```bash
git init
git add .
git commit -m "Initial commit - 3D Hands Web"
git remote add origin <seu-repo-url>
git push -u origin main
```

3. Acesse [vercel.com](https://vercel.com)
4. Clique em "Import Project"
5. Selecione seu repositório GitHub
6. Vercel detectará automaticamente as configurações
7. Clique em "Deploy"

### Opção 3: Deploy via Vercel Dashboard

1. Comprima a pasta do projeto em `.zip`
2. Acesse [vercel.com/new](https://vercel.com/new)
3. Faça upload do arquivo `.zip`
4. Configure e deploy

## ⚙️ Configuração

### Variáveis de Ambiente (Opcional)

Se você quiser adicionar variáveis de ambiente:

1. No dashboard do Vercel, vá em "Settings" → "Environment Variables"
2. Adicione suas variáveis:
   - `MEDIAPIPE_VERSION`: Versão do MediaPipe (padrão: 0.4.1675469404)
   - `THREEJS_VERSION`: Versão do Three.js (padrão: 0.160.0)

### Personalização

Edite os arquivos conforme necessário:

- **HTML**: [public/index.html](public/index.html)
- **CSS**: [public/css/style.css](public/css/style.css)
- **JavaScript**: [public/js/*.js](public/js/)
- **API**: [api/gesture.js](api/gesture.js)

## 📦 Estrutura do Projeto

```
3D Hands/
├── public/                     # Frontend estático
│   ├── index.html             # Página principal
│   ├── css/
│   │   └── style.css          # Estilos
│   └── js/
│       ├── app.js             # Lógica principal
│       ├── hand-tracker.js    # MediaPipe tracking
│       ├── gesture-recognizer.js  # Reconhecimento de gestos
│       ├── scene-3d.js        # Renderização 3D
│       └── utils.js           # Utilitários
├── api/                       # Serverless functions
│   └── gesture.js             # API de gestos (opcional)
├── vercel.json                # Configuração Vercel
├── package.json               # Dependências Node
└── README-VERCEL.md          # Esta documentação
```

## 🎮 Como Usar

1. Acesse a URL do seu deploy Vercel
2. Clique em "Iniciar Câmera"
3. Permita o acesso à câmera quando solicitado
4. Use os gestos para controlar o objeto 3D:
   - ✋ **Mão aberta**: Mover objeto
   - 🤏 **Pinch**: Zoom
   - ✌️ **Dois dedos**: Rotação
   - ✊ **Punho (2s)**: Reset
   - 🖖 **Três dedos (0.6s)**: Mudar cor
   - 👍 **Polegar para cima**: Rotação automática
   - 👎 **Polegar para baixo**: Pausar

## 🔒 Segurança e HTTPS

O Vercel fornece HTTPS automaticamente. Isso é **essencial** porque:
- A API de câmera do navegador requer HTTPS
- MediaPipe Web funciona melhor com HTTPS

## 🐛 Troubleshooting

### Câmera não funciona

1. Verifique se você está usando HTTPS (Vercel fornece automaticamente)
2. Verifique as permissões do navegador
3. Teste em navegadores diferentes (Chrome/Edge recomendados)

### MediaPipe não carrega

1. Verifique sua conexão com internet
2. Os recursos são carregados via CDN
3. Verifique o console do navegador para erros

### Performance lenta

1. Use um navegador moderno (Chrome 90+, Edge 90+)
2. Feche outras abas/programas pesados
3. Reduza a resolução da câmera editando [hand-tracker.js](public/js/hand-tracker.js):
```javascript
video: {
    width: { ideal: 640 },  // Era 1280
    height: { ideal: 480 }, // Era 720
    facingMode: 'user'
}
```

## 📊 Analytics e Logging (Opcional)

A função serverless em [api/gesture.js](api/gesture.js) pode ser usada para:
- Registrar eventos de gestos
- Coletar analytics
- Processar dados de sessão

Para usar, faça uma chamada POST de [app.js](public/js/app.js):

```javascript
fetch('/api/gesture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        gesture: gestureData,
        timestamp: Date.now(),
        sessionId: sessionId
    })
});
```

## 🔄 Atualizações

Para atualizar o deploy:

```bash
# Faça suas alterações
git add .
git commit -m "Sua mensagem de commit"
git push

# Ou, se usando CLI:
vercel --prod
```

## 📈 Monitoramento

Acesse o dashboard do Vercel para:
- Ver analytics de uso
- Monitorar performance
- Ver logs de erros
- Configurar domínio customizado

## 🌐 Domínio Customizado

1. No dashboard Vercel, vá em "Settings" → "Domains"
2. Adicione seu domínio
3. Configure os registros DNS conforme instruído
4. Aguarde propagação (pode levar até 48h)

## 💡 Melhorias Futuras

- [ ] Adicionar suporte PWA (Progressive Web App)
- [ ] Implementar gravação de sessões
- [ ] Adicionar mais objetos 3D
- [ ] Implementar gestos customizáveis
- [ ] Adicionar tutorial interativo
- [ ] Suporte offline com Service Workers

## 📝 Licença

MIT - Matheus Siqueira

## 🆘 Suporte

- **Issues**: Abra uma issue no GitHub
- **Documentação Vercel**: [vercel.com/docs](https://vercel.com/docs)
- **Three.js Docs**: [threejs.org/docs](https://threejs.org/docs)
- **MediaPipe Web**: [google.github.io/mediapipe](https://google.github.io/mediapipe)

---

**Desenvolvido com ❤️ por Matheus Siqueira**
