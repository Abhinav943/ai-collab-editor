# NEXUS — AI Collaborative Code Editor

A real-time, AI-native collaborative code editor: multiple people edit the same
workspace with live cursors and presence, an AI assistant streams answers and can
apply edits straight into the editor, and code can be run locally.

- **Client** — React 19 + Vite + Tailwind v4 + Zustand + Monaco + Yjs (`y-monaco`)
- **Server** — Node.js (ESM) + Express + Socket.IO + Mongoose (MongoDB)
- **AI** — pluggable providers: `mock` (no key needed), `gemini`, `openai`

---

## Quick start

You need **Node.js 18+** and a **MongoDB** database (a local `mongod`, or a free
MongoDB Atlas cluster). Then:

```bash
# 1. Install dependencies (once)
npm install

# 2. Create your environment file
cp .env.example .env      # then edit .env (see below)

# 3. Run the client + server together
npm run dev
```

Then open **http://localhost:5173**, register an account, create a workspace and
start coding. The API/socket server runs on **http://localhost:5000**.

### What to put in `.env`

`.env.example` ships with safe defaults, so the app runs out of the box with the
**mock AI provider** — no API key required. The only value you really need to set
for a real setup is `MONGODB_URI`.

| Variable | What it does |
| --- | --- |
| `MONGODB_URI` | Your database. Local: `mongodb://127.0.0.1:27017/ai-collab-editor`. Or paste a MongoDB Atlas connection string. |
| `JWT_SECRET` | **Must be at least 32 characters.** Used to sign auth tokens. Change it from the placeholder. |
| `PORT` | API/socket server port (default `5000`). |
| `CLIENT_URL` | The client origin, for CORS (default `http://localhost:5173`). |
| `AI_PROVIDER` | `mock` (default, works offline), `gemini`, `openai`, or `disabled`. |
| `GEMINI_API_KEY` | Get one at <https://aistudio.google.com/apikey>. Accepts both `AQ.Ab…` (new auth keys) and `AIza…` (older standard keys). |
| `GEMINI_MODEL` | Defaults to `gemini-2.5-flash`. (`gemini-2.0-flash` was shut down in June 2026.) |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Required when `AI_PROVIDER=openai`. |
| `JUDGE0_URL` | Set this to run code remotely via Judge0 (e.g. `https://judge0-ce.p.rapidapi.com` or `http://localhost:2358`). Empty = run locally. |
| `JUDGE0_API_KEY` | Only if your Judge0 instance needs auth (RapidAPI key or Judge0 auth token). |
| `EXECUTION_MODE` | Only used when Judge0 is not configured: `local` to run code here, or `disabled`. |

> **Getting real AI answers (instead of the "Mock Mode" reply):** you need all
> three of these, and then a **server restart** (`.env` is read once at startup):
> - `AI_PROVIDER=gemini` — if it is left at `mock`, you always get the canned reply.
> - A valid `GEMINI_API_KEY` from <https://aistudio.google.com/apikey>. Keys are
>   either the newer `AQ.Ab…` auth keys (what AI Studio issues now) or the older
>   `AIza…` standard keys — **both work**, so paste whatever you were given.
>   `GOOGLE_API_KEY` also works and takes precedence if both are set.
> - `GEMINI_MODEL=gemini-2.5-flash`. `gemini-2.0-flash` was shut down on
>   2026-06-01 and will error.
>
> If the key or model is wrong, the AI panel now shows the provider's actual error
> (e.g. "API key not valid") instead of a generic failure. The panel header also
> carries a badge — green (`gemini · gemini-2.5-flash`) when a real model is live,
> amber (`mock`) when replies are canned — so you can always see which one you're
> talking to. **Click the badge** to run a live connection test: it makes one tiny
> request and tells you whether your key actually works, rather than guessing from
> its format.
> With `AI_PROVIDER=mock` (the default), the assistant replies with canned but
> complete answers so you can exercise the whole UI without any key.

> **No MongoDB yet?** The server still boots and answers `/health`, but sign-in,
> workspaces, chat and AI all need the database. Set `MONGODB_URI` to a running
> MongoDB (or Atlas) before you log in.

---

## Using the editor

1. **Register / log in** on the landing page.
2. **Create a workspace** from the dashboard, or **Join** one by pasting a room ID
   (or a full workspace URL).
3. **Invite people** with the **SHARE** button — it copies the workspace URL.
   Public workspaces are joinable by link: a teammate who opens the link is added
   as a member and immediately sees your edits, cursor and chat.
4. **Edit together** — open the same file in two browsers and type. Edits merge
   via Yjs; remote cursors and selections appear in each user's colour.
5. **Ask the AI** in the right-hand panel. Answers stream in token by token.
   Use the quick actions (Generate / Explain / Detect Bugs / Review / Gen Tests /
   Fix Error / Refactor / Optimize / Document), or just chat. Click **Apply** on a
   code block to stage it, then **Accept** to write it into the file (synced to
   everyone).
6. **Run code** with **EXECUTE** in the terminal panel. Pick the language, add
   optional `stdin`, and see stdout/stderr. If it fails, the AI can suggest a fix.

Keyboard: `Enter` sends an AI/chat message, `Shift+Enter` adds a newline.

---

## Project structure

```
client/          React app
  src/components  editor, AI panel, file explorer, terminal, team chat
  src/stores      Zustand stores (auth, workspace, chat)
  src/hooks       useSocket (Socket.IO), usePresence
server/          Express + Socket.IO API
  src/routes      auth, workspaces (+ nested chat), ai, execute
  src/controllers request handlers
  src/services    ai/ (providers + prompt builder), execution/
  src/sockets     realtime: Yjs sync, presence, cursors, chat, AI messages
  src/models      User, Workspace, File, ChatMessage
shared/          shared constants
docs/            architecture, API and local-development notes
docker/          Dockerfiles + docker-compose
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run client and server together (recommended). |
| `npm run client` / `npm run server` | Run one side only. |
| `npm run build` | Production build of all workspaces. |
| `npm test` | Server test suite. |
| `npm run lint` | Lint all workspaces. |

## Running with Docker

```bash
docker compose up --build -d
```

This uses the production Docker images: Nginx serves the built client, Node runs
the server, and MongoDB is private to the Compose network. Before starting,
create a production `.env` with at least:

```env
CLIENT_URL=https://your-app.example.com
JWT_SECRET=use-a-long-random-secret
AI_PROVIDER=gemini
GEMINI_API_KEY=your-key
EXECUTION_MODE=disabled
```

The client is available on port `8080`. Put HTTPS and your domain in front of
that port, and keep port `5000` private if the frontend proxy is the only route
to the API. The frontend proxy forwards both `/api` and `/socket.io`, so
collaboration features continue to work through one origin.

Check the liveness and readiness endpoints after startup:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/readyz
```

## Running code (C, C++, Java, Python, Go, JavaScript)

There are two ways code gets run, and **Judge0 is used automatically as soon as
you set `JUDGE0_URL`**:

1. **Judge0 (recommended).** All six languages run remotely, so you need no
   compilers installed anywhere. Set `JUDGE0_URL` and, if your instance needs it,
   `JUDGE0_API_KEY`:

   ```env
   # RapidAPI-hosted
   JUDGE0_URL=https://judge0-ce.p.rapidapi.com
   JUDGE0_API_KEY=your-rapidapi-key
   # ...or self-hosted (no key needed)
   JUDGE0_URL=http://localhost:2358
   ```

   The terminal shows a **Judge0** badge when this is active.

   **Easiest — Judge0's public instance.** No account, no key, no Docker:

   ```env
   JUDGE0_URL=https://ce.judge0.com
   ```

   It is shared and rate limited, so it is fine for trying things out but not for
   heavy use. Verify it with `npm run judge0:check`.

   Other options, all free unless noted:

   | Option | `JUDGE0_URL` | `JUDGE0_API_KEY` | Needs |
   | --- | --- | --- | --- |
   | **Public CE instance** | `https://ce.judge0.com` | leave empty | nothing |
   | **Self-host in Docker** | `http://localhost:2358` | leave empty | Docker |
   | **Local toolchains** | leave empty | leave empty | compilers installed |
   | **RapidAPI** | `https://judge0-ce.p.rapidapi.com` | your RapidAPI key | an account + card |
   | **Judge0 cloud** | your instance URL | your auth token | a paid plan |

   **Self-hosting** is one command:

   ```bash
   npm run judge0:up        # starts Judge0 CE on http://localhost:2358
   npm run judge0:down      # to stop it later
   ```

   Give it ~30 seconds on first boot, then run `npm run judge0:check` to confirm
   it is up, and press the refresh icon next to the language dropdown in the editor.

   > **App on Windows, Docker in WSL?** You do not need Node inside WSL. Judge0
   > publishes port 2358 to `localhost`, which the Windows Node process can reach
   > at `http://localhost:2358`. Run `npm run judge0:up` from Windows if Docker
   > Desktop is installed, or run the `docker compose` command inside WSL — the
   > URL stays the same.

   **RapidAPI setup, step by step:**
   1. Open <https://rapidapi.com/judge0-official/api/judge0-ce> and click
      **Subscribe to Test** (the free **Basic** plan). RapidAPI may ask for a
      payment method even on the free tier.
   2. On the same page, open the **Endpoints** tab and copy the value of
      `X-RapidAPI-Key` from the header list (it is also shown in the code snippet).
      Note the host: `judge0-ce.p.rapidapi.com`.
   3. Put both into `.env`:
      ```env
      JUDGE0_URL=https://judge0-ce.p.rapidapi.com
      JUDGE0_API_KEY=your-x-rapidapi-key
      ```
   4. **Restart the backend** (`.env` is read once at startup), then press the
      refresh icon next to the language dropdown. The terminal should show a
      **Judge0** badge. If it shows **Judge0 unreachable**, the URL or key is wrong.

   Self-hosted Judge0 needs no key unless the operator turned auth on.

2. **Local (fallback).** If `JUDGE0_URL` is empty, code runs with the toolchains on
   the machine hosting the backend. Python and JavaScript work out of the box;
   **C, C++, Java and Go need their compilers installed and on `PATH`** — the usual
   reason "C++ doesn't run". The language dropdown marks anything missing with
   "(not installed)" and EXECUTE explains what to install. See
   `docs/local-development.md` for per-OS commands.

Either way it is authenticated-only. `GET /api/execute/status` reports which
languages are available and which provider is in use.

See `docs/` for more detail.

---

## Security notes

- `.env` is git-ignored. Never commit real keys — use `.env.example` as the
  template. If you ever committed a real `.env`, rotate those credentials.
- All API routes (except register/login and `/health`) and all socket connections
  require a valid JWT. AI and execute endpoints are rate-limited per user.
