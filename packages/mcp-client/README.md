# `@open-dreamflow/mcp-client`

Universal Model Context Protocol (MCP) Client (`WebSocket`, `Streamable HTTP`, and `HTTP+SSE`), Canvas Node Schema Mapper, and Stage 4 Local **FFmpeg 8.0 + Inline Editor + Project Persistence + Bridge Relay + 10-Tool MCP Server** (`ws://localhost:3001/mcp`, `ws://localhost:3001/bridge`, `http://localhost:3001`).

## 10 Built-in MCP Tools & REST Endpoints
1. `generate_video` (`POST /api/render-video`) — Zero-markup BYOK pass-through OR local FFmpeg 1280x720 24fps H.264 + stereo AAC synthesis.
2. `inpaint_frame` (`POST /api/inpaint`) — Masked brush composite (`maskedmerge` + prompt relight/detail synthesis or BYOK cloud inpaint).
3. `outpaint_expand` (`POST /api/outpaint`) — Aspect expansion (`16:9` 1920x1080, `9:16` 1080x1920, `21:9` 2520x1080, `1:1` 1440x1440).
4. `remove_background` (`POST /api/remove-bg`) — RGBA `colorkey` alpha-channel cutout PNG.
5. `upscale_4k` (`POST /api/upscale`) — 3840px Lanczos 4K super-sharpen PNG.
6. `extract_style_dna` — Extracts palette, lens, lighting, and film stock Style DNA tokens.
7. `flow_scene_builder` (`POST /api/compile-timeline`) — Multi-clip H.264 + stereo AAC timeline stitcher (`+faststart`).
8. `slice_contact_sheet` (`POST /api/slice-grid`) — Single-pass FFmpeg `3x3` / `2x2` contact sheet PNG slicer.
9. `extract_last_frame` (`POST /api/extract-last-frame`) — Exact final-frame PNG extractor (`ffmpeg -sseof -0.1`).
10. `save_project` (`POST /api/projects`) — Atomic disk project + snapshot persistence in `.dreamflow-data.nosync/projects/`.

## Upload, Project Bundle & Live Chrome Bridge Relay
- `POST /api/upload-media` — Device base64 upload persisted to `/media/upload_<ts>_<safeName>`.
- `GET /api/projects`, `GET /api/projects/:id`, `POST /api/projects`, `DELETE /api/projects/:id`, `GET /api/projects/:id/export`, `POST /api/projects/import`.
- `ws://localhost:3001/bridge`, `POST /api/bridge/push`, `GET /api/bridge/events` — Real-time Chrome Extension capture relay persisted in `.dreamflow-data.nosync/bridge-inbox.json`.
