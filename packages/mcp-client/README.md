# `@open-dreamflow/mcp-client` (`v1.1.0`)

Universal Model Context Protocol (MCP) Client, **External Multi-Server MCP Host** (`stdio` + `Streamable HTTP`), **12-Platform Unified Node Router** (`POST /api/generate-node`), **7-Platform Chrome Credit Bridge Relay**, and Local **FFmpeg 8.0 + 12-Tool MCP Server** (`http://localhost:3001`).

## Stage 7 Universal Multi-Platform & External MCP Endpoints
- **`GET /api/platforms`** — Returns the 12-platform catalog (`PLATFORM_CATALOG`) enriched with live connection status (`mcpConnected`, `browserBridgeActive`, `serverEnvConfigured`) and dynamically discovered `custom-mcp` tools.
- **`POST /api/generate-node`** — Unified per-node generation router (`connectionMode: 'auto' | 'mcp' | 'browser-bridge' | 'api-key'`) with automatic cross-platform reference resolution (`resolveReferenceToPublicOrDataUrl`) so upstream `/media/*` outputs chain directly into downstream nodes (e.g. Higgsfield `chatgpt-image-2.6` → Kling `kling-4.0` → ElevenLabs `eleven_multilingual_v2`).
- **`GET / POST /api/mcp/servers`, `POST /api/mcp/servers/:id/refresh`, `DELETE /api/mcp/servers/:id`, `POST /api/mcp/call`** — Spawns and manages real external `stdio` & `http` MCP servers (persisted in `.dreamflow-data.nosync/mcp-servers.json` with `"***"` secret redaction on `GET`) and ingests returned media into `/media/*`.
- **`POST /api/verify-provider`** — Live verification across Google, OpenAI, ElevenLabs, Kling (HS256 JWT), Higgsfield, Seedance, Fal, Replicate, ComfyUI, External MCP servers, and Browser Credit Bridge sessions.

## 12 Built-in MCP Tools (`/mcp`) & Local Media Engine
`generate_image`, `generate_video`, `keyframe_bridge`, `generate_audio`, `inpaint_frame`, `outpaint_expand`, `remove_background`, `upscale_4k`, `extract_style_dna`, `flow_scene_builder`, `slice_contact_sheet`, `extract_last_frame`, and `save_project`.
