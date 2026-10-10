# API Documentation

## Auth
- `POST /api/auth/register`
- `POST /api/auth/login`

## Workspaces
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/:id`
- `POST /api/workspaces/:id/join`

## AI
- `POST /api/ai/chat`
- `POST /api/ai/chat/stream` (authenticated SSE; emits `status`, `token`, and `done` events)
- `POST /api/ai/generate`
- `POST /api/ai/review`
- `POST /api/ai/fix`

## Execution
- `POST /api/execute` (authenticated; body: `{ code, language, stdin }`)
- `GET /api/execute/status` (authenticated)
