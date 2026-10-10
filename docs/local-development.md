# Local Development Setup

## Prerequisites
- Node.js v18+
- MongoDB
- GCC and G++ (for C and C++)
- Python (for Python)
- JDK (for Java)
- Go (for Go)

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Set `AI_PROVIDER=mock` for a no-key local smoke test, or set
   `AI_PROVIDER=gemini` and `GEMINI_API_KEY` in the server environment to enable the real AI
   provider. The key is read only by the backend and is never sent to the
   browser. For OpenAI, use `AI_PROVIDER=openai` and `OPENAI_API_KEY`.
4. Start MongoDB before signing in. The backend can answer `/health` while
   MongoDB is unavailable, but authenticated workspaces, chat, and AI requests
   require the database connection.
5. Start development servers:
   ```bash
   npm run dev
   ```

## Running with Docker
```bash
docker-compose up --build
```

## Code execution

### Public Judge0 instance (free, no account, no Docker)

The quickest way to get all six languages running — point at Judge0's shared CE
instance:

```env
JUDGE0_URL=https://ce.judge0.com
```

No API key, no Docker, no signup. It is shared and rate limited (and it disables
`wait=true`, which this client handles by polling), so use it for development and
switch to your own instance for anything heavier.

### Self-hosted Judge0 (free, no account)

Zero-cost and not shared. Needs Docker only:

```bash
npm run judge0:up      # Judge0 CE on http://localhost:2358
```

Then in `.env`:

```env
JUDGE0_URL=http://localhost:2358
```

No API key is needed — auth is off by default on your own instance. Give it ~30
seconds on first boot (it runs Postgres and Redis alongside), then press the
refresh icon next to the language dropdown. Stop it with `npm run judge0:down`.

Verify it from a terminal with `npm run judge0:check` — it reads your `.env`,
confirms the instance answers, and prints which Judge0 id each editor language
maps to.

If you run the editor on Windows and Docker inside WSL, you do **not** need Node
in WSL: Judge0 runs in a container and publishes port 2358 to `localhost`, which
the Windows Node process can reach at `http://localhost:2358`. Use Docker Desktop
and run `npm run judge0:up` from Windows, or run the `docker compose` command
inside WSL — the URL stays the same either way.

The service definition is in `docker-compose.judge0.yml`. It uses
`privileged: true` because Judge0's Isolate sandbox needs namespaces and cgroups.
Judge0 is only officially supported on Linux; on Windows use Docker Desktop with
the WSL2 backend.

### Hosted Judge0

If you would rather not run Docker, point `JUDGE0_URL` at a hosted instance:

```env
JUDGE0_URL=https://judge0-ce.p.rapidapi.com   # or http://localhost:2358
JUDGE0_API_KEY=your-key                       # only if the instance needs auth
```

Works with self-hosted Judge0 (no auth), the Judge0 cloud (`X-Auth-Token`), and
RapidAPI-hosted Judge0 (`X-RapidAPI-Key`). For RapidAPI: subscribe to Judge0 CE at
<https://rapidapi.com/judge0-official/api/judge0-ce>, copy the `X-RapidAPI-Key`,
and set `JUDGE0_URL=https://judge0-ce.p.rapidapi.com`. The header type is detected
from the URL — a `rapidapi.com` host gets `X-RapidAPI-Key`, anything else gets
`X-Auth-Token`. Optional limits: `JUDGE0_TIMEOUT_S`,
`JUDGE0_MEMORY_KB`. `GET /api/execute/status` reports `provider: "judge0"`.

The language ids are read from the instance's `/languages` endpoint, choosing the
newest build of each (so Python resolves to 3.x, never 2.x). With the standard
Judge0 CE list that is:

| Editor language | Judge0 id | Build |
| --- | --- | --- |
| C | 50 | GCC 9.2.0 |
| C++ | 54 | GCC 9.2.0 |
| Python | 71 | 3.8.1 |
| Java | 62 | OpenJDK 13.0.1 |
| Go | 60 | 1.13.5 |
| JavaScript | 63 | Node.js 12.14.0 |

**Java gotcha:** Judge0 saves Java source as `Main.java` and runs the `Main`
class, so the file must contain `public class Main`. New Java files created in the
editor are pre-filled with that skeleton. If you rename the class, compilation
fails with "class X is public, should be declared in a file named X.java".

### Local fallback

If `JUDGE0_URL` is empty, the editor runs code with the toolchains installed on the
**same machine as the Node.js backend**. Only Python and JavaScript work out of the box; C, C++, Java
and Go need their compilers installed and on `PATH`. The editor's language
dropdown marks any language it cannot find with "(not installed)", and running it
shows a clear message instead of failing silently. Install what you need:

| Language | Debian/Ubuntu | macOS (Homebrew) | Windows |
| --- | --- | --- | --- |
| C / C++ | `sudo apt install build-essential` | `xcode-select --install` | MinGW-w64 (add `bin` to PATH) |
| Java | `sudo apt install default-jdk` | `brew install openjdk` | Install a JDK (e.g. Temurin) |
| Go | `sudo apt install golang-go` | `brew install go` | Install Go and add to PATH |
| Python | `sudo apt install python3` | preinstalled | python.org installer |

After installing, restart the backend and press the refresh icon next to the
language dropdown to re-check. Set:

```env
EXECUTION_MODE=local
```

Verify the available toolchains before starting the server:

```bash
gcc --version
g++ --version
python --version
python3 --version
java --version
javac --version
go version
node --version
```

The authenticated `GET /api/execute/status` endpoint reports which supported
languages are available. Each execution uses a unique temporary directory,
pipes stdin to the child process, limits output to 1 MB, and terminates
compilation or execution after five seconds.

Local execution is intended for trusted local development only. It is not a
secure production sandbox. Never expose the local execution server directly to
untrusted users, and do not run the backend as root or administrator.
