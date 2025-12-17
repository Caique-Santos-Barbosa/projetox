# 🔐 Face Access - Sistema de Reconhecimento Facial

Sistema completo de controle de acesso por reconhecimento facial com verificação de vivacidade (liveness detection).

## 📦 Componentes

- **Backend (Python/FastAPI)** - API de reconhecimento facial
- **Frontend (HTML/JS)** - Painel web para cadastro de usuários
- **Mobile App (React Native/Expo)** - APK para verificação de acesso

## 🚀 Deploy no EasyPanel

### 1. Crie um repositório no GitHub e faça push:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/seu-usuario/face-access.git
git push -u origin main
```

### 2. No EasyPanel:

#### Backend (API):
1. Clique em "Create Service" → "App"
2. Conecte seu GitHub e selecione o repositório
3. Configure:
   - **Name**: `face-api`
   - **Build Path**: `backend`
   - **Port**: `8000`
4. Ative "Dockerfile" como build method
5. Em "Domains", adicione um domínio (ex: `face-api.seudominio.com`)

#### Frontend (Web):
1. Crie outro serviço "App"
2. Configure:
   - **Name**: `face-web`
   - **Build Path**: `frontend`
   - **Port**: `80`
3. Em "Domains", adicione um domínio (ex: `face.seudominio.com`)

### 3. Atualize a URL da API no Frontend:
Edite `frontend/index.html` e altere o valor padrão do input da API para sua URL do EasyPanel.

## 📱 Gerando o APK

### Pré-requisitos:
- Node.js 18+
- Expo CLI: `npm install -g expo-cli eas-cli`
- Conta Expo: https://expo.dev

### Passos:

```bash
cd mobile-app

# Instalar dependências
npm install

# Login no Expo
eas login

# Configurar o projeto (primeira vez)
eas build:configure

# ⚠️ IMPORTANTE: Edite App.js e configure a URL do seu servidor
# Altere: const API_URL = 'https://face-api.seudominio.com';

# Gerar APK
eas build --platform android --profile preview
```

O APK será gerado na nuvem do Expo e você receberá um link para download.

### Assets necessários:
Crie a pasta `mobile-app/assets/` com:
- `icon.png` (1024x1024)
- `splash.png` (1284x2778)
- `adaptive-icon.png` (1024x1024)

## 🔧 Desenvolvimento Local

```bash
# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload

# Frontend (apenas abra index.html no navegador)

# Mobile
cd mobile-app
npm install
npx expo start
```

## 📋 Funcionalidades

### Web (Cadastro):
- ✅ Cadastrar usuários com foto
- ✅ Listar usuários cadastrados
- ✅ Bloquear/desbloquear acesso
- ✅ Remover usuários

### App (Verificação):
- ✅ Detecção facial em tempo real
- ✅ Verificação de vivacidade (liveness)
- ✅ Reconhecimento facial
- ✅ Feedback visual de acesso

## 🛡️ Segurança

- Liveness detection previne ataques com fotos
- Múltiplos frames analisados para verificação
- Tolerância configurável para matching facial

