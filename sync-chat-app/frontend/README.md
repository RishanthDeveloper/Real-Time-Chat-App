# sync-chat-app

React + Tailwind frontend for a real-time chat app, built to talk to a STOMP/WebSocket
backend (Redis-backed pub/sub, JWT-over-STOMP auth) and to deploy on Vercel with zero
extra config.

## Structure

```
src/
├── components/
│   ├── ChatRoom.jsx          # Main chat UI
│   ├── MessageBubble.jsx     # Individual message rendering
│   ├── AvatarCanvas.jsx      # Canvas-rendered user avatars
│   └── ConnectionMonitor.jsx # Live WebSocket connection status
├── hooks/
│   └── useChatWebSocket.js   # WebSocket/STOMP connection + message streaming
├── store/
│   └── chatStore.js          # Zustand chat state
├── utils/
│   └── sanitize.js           # XSS-safe input sanitization (DOMPurify)
├── styles/
│   └── tokens.css            # Design tokens (CSS custom properties)
└── index.css                 # Global styles + Tailwind directives
```

## Local setup

```bash
npm install
cp .env.example .env.local   # then set REACT_APP_WS_URL to your backend's /ws endpoint
npm start
```

## Build

```bash
npm run build
```

Outputs a static bundle to `build/`.

## Deploying on Vercel

1. Push this repo to GitHub **with `package.json` and `public/` at the repository root**
   (not nested inside a subfolder) — Vercel's auto-detection for Create React App looks
   for `package.json` at the root it's told to build from.
2. Import the repo at vercel.com. Vercel will detect Create React App automatically
   (this repo also ships a `vercel.json` pinning `buildCommand`, `outputDirectory`, and
   `framework` explicitly, so detection isn't required).
3. Add an environment variable in **Settings → Environment Variables**:
   - `REACT_APP_WS_URL` = your backend's public WebSocket endpoint, e.g.
     `https://api.yourdomain.com/ws`
4. Deploy. Every push to the default branch redeploys automatically.

Vercel runs builds with `CI=true`, which makes Create React App treat ESLint
**warnings** as build-breaking **errors** — something that only shows up on Vercel,
not in a normal local `npm start`. Keep the build warning-free (`CI=true npm run build`
locally is a good pre-push check).
