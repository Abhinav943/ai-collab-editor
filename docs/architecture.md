# AI Collab Editor Architecture

## Overview
A real-time collaborative code editor built with a modern web stack and deep AI integration.

## Components
1. **Frontend (Client)**: React, Vite, Zustand, Monaco Editor, TailwindCSS.
2. **Backend (Server)**: Node.js, Express, Socket.IO.
3. **Database**: MongoDB for persisting users, workspaces, and code versions.
4. **Real-time Sync**: Socket.IO with Yjs for CRDT-based conflict-free collaborative editing.
5. **AI Services**: Pluggable AI provider architecture (Mock, OpenAI, Anthropic).
6. **Execution Engine**: authenticated local execution for trusted development.

## Data Flow
- **Collaboration**: Client (Monaco) <-> Yjs <-> Socket.IO <-> Other Clients.
- **AI Requests**: Client -> Express API -> AI Provider -> Client.
- **Code Execution**: Client -> authenticated Express API -> local execution service -> host toolchain -> Client.

Local execution is intentionally not a production sandbox. The execution
service uses a unique temporary directory, trusted language configuration,
bounded child processes, a timeout, and an output limit. A future sandboxed
runner can be added behind the same service boundary.
