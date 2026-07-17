# ⚡ RealtimeChat — React Frontend

A modern, dark-mode, glassmorphic chat interface built with React 18, Tailwind CSS, Zustand, and STOMP-over-SockJS — the client half of a horizontally scalable real-time chat platform.

<p align="left">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Zustand-4.5-orange?style=flat-square" alt="Zustand" />
  <img src="https://img.shields.io/badge/WebSocket-STOMP%20%2F%20SockJS-6366F1?style=flat-square" alt="WebSocket" />
  <img src="https://img.shields.io/badge/DOMPurify-XSS%20safe-10B981?style=flat-square" alt="DOMPurify" />
  <img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome" />
  <a href="https://github.com/RishanthDeveloper/"><img src="https://img.shields.io/badge/GitHub-RishanthDeveloper-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub: RishanthDeveloper" /></a>
</p>

> This repository contains **only the frontend**. It talks to a Spring Boot + STOMP + Redis Pub/Sub backend over WebSocket — see [Architecture](#-architecture) for how the two fit together, and swap in your own backend's URL via one environment variable.

---

## ✨ Overview

RealtimeChat's frontend is a single-page chat client designed to feel like a real product, not a demo: grouped message threads, live typing indicators, presence-aware avatars, unread badges, and a connection-health widget that shows real round-trip latency — all built on a STOMP-over-SockJS connection that survives network drops without the user noticing.

It's built to be read, not just run. Every non-trivial piece of logic — reconnection backoff, room-switch resubscription, XSS sanitization — is commented with *why*, not just *what*.

## 🚀 Features

- **Live messaging over STOMP/SockJS** — subscribes to per-room topics and updates instantly as messages arrive
- **Auto-reconnect with backoff** — network drops, tab sleep, and backend restarts are recovered from automatically, with a capped retry count and a visible status indicator
- **Presence & typing indicators** — animated `<canvas>`-rendered avatar status rings (online / typing / offline), rendered per-frame, not as static CSS
- **Unread badges & channel/DM sidebar** — Discord-style workspace navigation with per-room unread counts
- **Grouped message threads** — consecutive messages from the same sender within a short window collapse into one block, with date dividers between days
- **Fenced code block rendering** — chat messages support ```` ```code``` ```` blocks, rendered in a monospace panel
- **XSS-safe by construction** — message content never touches `dangerouslySetInnerHTML`; rendering goes through [DOMPurify](https://github.com/cure53/DOMPurify) and plain React text nodes only
- **Real connection diagnostics** — a live latency sparkline and backend-instance readout, driven by an actual ping/pong round trip (not simulated)
- **Global state via Zustand** — a single lightweight store for auth, connection state, rooms, presence, and messages, with no prop-drilling
- **Dark-mode glassmorphic UI** — a full design-token system (CSS variables) in the spirit of Discord/Linear, built entirely with Tailwind CSS utility classes

## 🏗 Architecture

```
┌─────────────────────────────┐        STOMP over SockJS         ┌──────────────────────────┐
│   React Frontend (this repo) │ ───────────────────────────────▶ │  Spring Boot Backend      │
│                              │      wss:// via /ws endpoint     │  (STOMP + Redis Pub/Sub)  │
│  useChatWebSocket.js         │ ◀─────────────────────────────── │                           │
│    ├─ connects w/ JWT in     │      /topic/room.{id}            └──────────────────────────┘
│    │  STOMP connectHeaders   │      /topic/presence
│    ├─ subscribes per room    │      /user/queue/pong
│    └─ auto-reconnect logic   │
│                              │
│  chatStore.js (Zustand)      │  ← single source of truth for connection/room/presence state
│  ChatRoom.jsx                │  ← reads from the store, calls hook's sendMessage/sendTyping
└─────────────────────────────┘
```

The frontend never talks HTTP to the backend for chat traffic — everything after the initial SockJS handshake rides the same persistent WebSocket connection as STOMP frames. The JWT is passed inside the STOMP `CONNECT` frame's headers (`connectHeaders`), not as a URL param or custom HTTP header, because browsers don't let JavaScript attach arbitrary headers to a WebSocket handshake. Your backend needs a matching `ChannelInterceptor` that reads that header — this repo assumes one exists but doesn't include it (frontend-only, by design).

Point the client at any compatible backend by setting one environment variable — see [Configuration](#%EF%B8%8F-configuration) below.

## 📁 Project Structure

```
src/
├── components/
│   ├── ChatRoom.jsx          # Main chat UI — sidebar, message stream, composer
│   ├── MessageBubble.jsx     # Individual message rendering, grouping, code blocks
│   ├── AvatarCanvas.jsx      # Canvas-rendered avatar with animated status ring
│   └── ConnectionMonitor.jsx # Live latency sparkline + connection status
├── hooks/
│   └── useChatWebSocket.js   # STOMP/SockJS connection, reconnection, pub/sub
├── store/
│   └── chatStore.js          # Zustand store — single source of truth
├── utils/
│   └── sanitize.js           # DOMPurify wrapper + safe code-block parsing
└── styles/
    └── tokens.css            # Design system CSS variables
```

## 🛠 Tech Stack

| Layer            | Technology                          |
|-------------------|--------------------------------------|
| UI                | React 18 (functional components, hooks) |
| Styling           | Tailwind CSS, CSS custom properties  |
| State             | Zustand                              |
| Realtime protocol | STOMP over SockJS (`@stomp/stompjs`) |
| Security          | DOMPurify                            |
| Build tool        | Create React App (`react-scripts`)   |

## ⚙️ Configuration

Create a `.env.local` in the project root:

```bash
REACT_APP_WS_URL=http://localhost:8080/ws
```

Point this at your backend's STOMP endpoint. In production, this is typically your backend's public URL, e.g. `https://api.yourdomain.com/ws`.

## 💻 Local Setup

**Prerequisites:** Node.js 18+ and npm.

```bash
# 1. Clone the repository
git clone https://github.com/RishanthDeveloper/realtime-chat-frontend.git
cd realtime-chat-frontend

# 2. Install dependencies
npm install

# 3. Configure your backend URL
cp .env.example .env.local
# then edit .env.local and set REACT_APP_WS_URL

# 4. Run the dev server
npm run dev
```

> This project uses Create React App under the hood. If your `package.json` still has the CRA default script names, `npm run dev` maps to `npm start` — either works. To build for production locally:
> ```bash
> npm run build
> ```
> Output is generated in `/build`.

The app expects a JWT in `localStorage` under the key `chat_jwt` (see `App.jsx`) — swap this for your actual login flow when wiring up a real backend.

## 🌐 Frontend Deployment

This section covers **frontend-only** deployment. Your backend (Spring Boot + Redis + Postgres) is deployed separately, on infrastructure that supports long-lived WebSocket connections — see your backend repo's own deployment docs.

### Option A — Deploy to Vercel (recommended)

Vercel is the fastest path for a Create React App project and handles HTTPS, CDN, and preview deployments automatically.

1. **Push this repo to GitHub** if you haven't already.
2. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account.
3. Click **"Add New… → Project"** and import this repository.
4. Vercel auto-detects a Create React App project. Confirm the settings:
   - **Framework Preset:** Create React App
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`
5. Add your environment variable before deploying:
   - Go to **Settings → Environment Variables**
   - Add `REACT_APP_WS_URL` = `https://your-backend-domain.com/ws` (your deployed backend's WebSocket endpoint, using `https://` — Vercel serves over TLS, and mixed-content rules mean your backend needs a secure `wss://` endpoint too)
6. Click **Deploy**. Vercel builds and deploys automatically — every subsequent push to your default branch triggers a new production deployment, and every pull request gets its own preview URL.

That's it — no server config, no Dockerfile needed for the frontend.

### Option B — Deploy to GitHub Pages

GitHub Pages works for a static CRA build, with one extra step since it doesn't natively support environment variables at build time.

1. Install the deploy helper:
   ```bash
   npm install --save-dev gh-pages
   ```
2. Add to `package.json`:
   ```json
   {
     "homepage": "https://RishanthDeveloper.github.io/realtime-chat-frontend",
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d build"
     }
   }
   ```
3. Since GitHub Pages serves a static build with no server-side env injection, bake your backend URL in at build time instead:
   ```bash
   REACT_APP_WS_URL=https://your-backend-domain.com/ws npm run deploy
   ```
4. In your repo's **Settings → Pages**, set the source to the `gh-pages` branch (created automatically by the command above).

Your app will be live at `https://RishanthDeveloper.github.io/realtime-chat-frontend`.

> **Note:** GitHub Pages serves everything over HTTPS on a subpath, which is fine for a client-only WebSocket consumer — just make sure your backend's CORS/allowed-origins configuration includes your Pages URL.

## 🔒 Security Notes

- All rendered message content passes through [`sanitize.js`](./src/utils/sanitize.js) before touching the DOM — no raw HTML from another user is ever trusted.
- JWTs live in `localStorage` for this reference implementation; for production, weigh that against `httpOnly` cookie storage depending on your threat model.
- The WebSocket URL and any tokens are never hardcoded — always injected via environment variables.

## 👤 Author

**Rishanth P** — [github.com/RishanthDeveloper](https://github.com/RishanthDeveloper/)

## 📄 License

MIT — free to use, modify, and build on for your own projects or portfolio.

---

<p align="center">Built by <a href="https://github.com/RishanthDeveloper/">RishanthDeveloper</a> as a demonstration of production-grade real-time frontend architecture.</p>
