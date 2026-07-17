# ⚡ RealtimeChat — Enterprise React Chat Client

A production-grade, dark-mode, glassmorphic real-time chat interface built with React 18, Zustand, and Tailwind CSS — engineered to consume a horizontally scalable STOMP/WebSocket backend without dropping a single message during a network hiccup, a backend redeploy, or a room switch.

<p align="left">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Zustand-4.5-orange?style=flat-square" alt="Zustand" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/WebSocket-STOMP%20%2F%20SockJS-6366F1?style=flat-square" alt="WebSocket / STOMP" />
  <img src="https://img.shields.io/badge/a11y-WAI--ARIA-10B981?style=flat-square" alt="Accessibility" />
  <img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" alt="License" />
  <a href="https://github.com/RishanthDeveloper/"><img src="https://img.shields.io/badge/GitHub-RishanthDeveloper-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub: RishanthDeveloper" /></a>
</p>

> **This repository is the frontend only.** It's designed to talk to a Spring Boot 3.2 + Redis Pub/Sub backend over STOMP/WebSocket — see [Architecture](#-architecture-context) for how the client and server responsibilities are split, and swap in any compatible backend URL via a single environment variable.

---

## ✨ Overview

Most "real-time chat demo" frontends fall over the moment the network gets unreliable: a dropped WebSocket either hangs silently or spins forever reconnecting to a stale subscription. This client is built to survive that — reconnection backoff is capped and deliberate, room subscriptions never go stale across a reconnect, and every timer and listener is cleaned up correctly even under rapid mount/unmount cycles (React StrictMode's double-invoke included).

It's also built to be *read*, not just run. Every non-obvious line — why the JWT rides in STOMP `connectHeaders` instead of an HTTP header, why the textarea collapses to `0px` before measuring, why a `ref` (not a closure variable) tracks the active room — is commented with the reasoning, not just the code.

## 🚀 Features

- **Live messaging over STOMP/SockJS**, subscribed per-room, with instant UI updates
- **Deliberate reconnection strategy** — capped exponential-ish backoff, no duplicate timers or intervals stacking across repeated drops, and a visible connection-health widget with real (not simulated) round-trip latency
- **Correct behavior across reconnects** — the active room is tracked via a ref, not a stale closure, so a reconnect after switching rooms resubscribes to the *right* room every time
- **Presence & typing indicators** — animated canvas-rendered avatar status rings
- **Unread badges & channel/DM sidebar navigation**, Discord-style
- **Grouped message threads** with date dividers, and fenced-code-block rendering
- **XSS-safe by construction** — message content never touches `dangerouslySetInnerHTML`
- **Full WAI-ARIA support** — `role="log"` + `aria-live="polite"` on the message stream so screen readers announce new messages automatically, `aria-label`s on every icon-only control, `aria-current` on active navigation items, and keyboard-dismissible overlays
- **Zustand for global state** — one small store for auth, connection status, rooms, presence, and messages; no prop-drilling, no Context boilerplate

## 🏗 Architecture Context

This client is intentionally backend-agnostic in shape but was designed against a specific reference architecture: a **Spring Boot 3.2 backend using STOMP over SockJS, Redis Pub/Sub for multi-instance message fan-out, and JWT authentication carried in the STOMP `CONNECT` frame** (not an HTTP header — browsers don't allow custom headers on a WebSocket handshake, so the token has to travel inside the STOMP protocol itself).

```
┌──────────────────────────┐   STOMP over SockJS   ┌────────────────────────────┐
│  React Frontend (here)   │ ─────────────────────▶ │  Spring Boot 3.2 Backend    │
│  useChatWebSocket.js      │  /topic/room.{id}      │  STOMP + Redis Pub/Sub      │
│  chatStore.js (Zustand)   │◀─────────────────────  │  (horizontally scalable)    │
│  ChatRoom.jsx             │  /topic/presence        └────────────────────────────┘
└──────────────────────────┘  /user/queue/pong
```

This same client/server split is the pattern behind larger systems in this portfolio — for example **ShelfWise**, an AI-based retail ERP with a Java/Spring Boot backend implementing ML algorithms from scratch. This chat frontend is built to the same standard: a thin, correct, well-documented client that assumes nothing about scale on the backend and is happy to sit in front of a single instance or a Redis-backed cluster of them without any code changes — just an environment variable.

## 📁 Project Structure

```
src/
├── components/
│   ├── ChatRoom.jsx          # Main chat UI — sidebar, message stream, composer
│   ├── MessageBubble.jsx     # Message rendering, grouping, code blocks
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

| Layer             | Technology                              |
|--------------------|------------------------------------------|
| UI                 | React 18 (functional components, hooks) |
| Styling            | Tailwind CSS, CSS custom properties     |
| State              | Zustand                                 |
| Realtime protocol  | STOMP over SockJS (`@stomp/stompjs`)    |
| Security           | DOMPurify                               |
| Accessibility      | WAI-ARIA live regions, labeled controls |
| Build tool         | Create React App (`react-scripts`)      |

## ⚙️ Configuration

Create a `.env.local` in the project root:

```bash
REACT_APP_WS_URL=http://localhost:8080/ws
```

Point this at your backend's STOMP endpoint. In production this is your backend's public URL, e.g. `https://api.yourdomain.com/ws`.

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

> Built on Create React App — if your `package.json` still has the CRA default script names, `npm run dev` maps to `npm start`; either works. To build for production locally:
> ```bash
> npm run build
> ```
> Output lands in `/build`.

The app expects a JWT in `localStorage` under the key `chat_jwt` (see `App.jsx`) — swap this for your real login flow when wiring up an actual backend.

## 🌐 Frontend Deployment Guide

**This section covers frontend-only deployment.** The Spring Boot + Redis backend is a separate service and must be deployed on infrastructure that supports long-lived WebSocket connections — platforms like **Render** or **Railway** are good fits for that half. Vercel and GitHub Pages, described below, are strictly for this React application. Neither one runs your Spring Boot backend; they only serve the compiled static frontend, which then connects out to wherever your backend actually lives via `REACT_APP_WS_URL`.

### ✅ Option A — Vercel (highly recommended)

Vercel is the fastest path for a Create React App project: it builds and hosts directly from GitHub pushes, with zero server config on your end.

1. **Push this repo to GitHub.**
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
3. Click **"Add New… → Project"** and import this repository.
4. Vercel auto-detects Create React App. Confirm:
   - **Framework Preset:** Create React App
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`
5. Before deploying, add your environment variable under **Settings → Environment Variables**:
   - `REACT_APP_WS_URL` = `https://your-backend-domain.com/ws` — your deployed backend's WebSocket endpoint, over `https://`/`wss://` (Vercel serves over TLS, and mixed-content rules require a secure endpoint on the backend side too).
6. Click **Deploy**. From here on, every push to your default branch triggers a new production deployment automatically, and every pull request gets its own preview URL — no manual redeploy step, ever.

### ✅ Option B — GitHub Pages

Works for a static CRA build, with one extra step since Pages has no server-side environment variable injection.

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
3. Since Pages serves a static build with no server-side env injection, bake the backend URL in at build time instead:
   ```bash
   REACT_APP_WS_URL=https://your-backend-domain.com/ws npm run deploy
   ```
4. In **Settings → Pages**, set the source to the `gh-pages` branch (created automatically by the command above).

Your app will be live at `https://RishanthDeveloper.github.io/realtime-chat-frontend`.

> **Note:** make sure your backend's CORS/allowed-origins configuration includes whichever of these two URLs you end up using — Vercel's `*.vercel.app` domain or your GitHub Pages URL.

## 🔒 Security Notes

- All rendered message content passes through [`sanitize.js`](./src/utils/sanitize.js) before touching the DOM — no raw HTML from another user is ever trusted.
- JWTs live in `localStorage` for this reference implementation; weigh that against `httpOnly` cookie storage depending on your production threat model.
- The WebSocket URL and any tokens are always injected via environment variables — never hardcoded.

## 👤 Author

**Rishanth P** — [github.com/RishanthDeveloper](https://github.com/RishanthDeveloper/)

## 📄 License

MIT — free to use, modify, and build on for your own projects or portfolio.

---

<p align="center">Built by <a href="https://github.com/RishanthDeveloper/">RishanthDeveloper</a> as a demonstration of production-grade real-time frontend architecture.</p>
