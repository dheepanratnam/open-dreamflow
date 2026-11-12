# `@open-dreamflow/mcp-client`

Universal **Model Context Protocol (MCP)** Client, **Spatial Canvas Node Schema Converter**, and **Zero-Dependency Local STDIO Bridge** for **Open-DreamFlow**.

## Features

- **Multi-Transport Browser & Node Client (`src/client.ts`):**
  - Connects over **WebSocket** (`ws://localhost:3001/mcp`), **Streamable HTTP** (`http://localhost:3001/mcp`), or **HTTP+SSE** (`http://localhost:3001/mcp/sse`).
- **Automatic MCP Tool → Spatial Canvas Node Schema (`mcpToolToCanvasNodeSchema`):**
  - Maps `generate_video`, `inpaint_frame`, `extract_style_dna`, `flow_scene_builder`, and arbitrary JSON-Schema MCP tools into typed Open-DreamFlow Canvas Nodes.
- **Local STDIO → WebSocket/HTTP/SSE Bridge (`src/server-bridge.ts`):**
  ```bash
  npx dreamflow-mcp-bridge --port 3001 -- npx -y flow-mcp
  ```
