# `@open-dreamflow/mcp-client`

Universal Model Context Protocol (MCP) Client (`WebSocket`, `Streamable HTTP`, and `HTTP+SSE`), Canvas Node Schema Mapper, and Local **FFmpeg + Zero-Markup BYOK Media Engine** (`ws://localhost:3001/mcp` & `http://localhost:3001`).

## Built-in MCP Tools (6 Tools)
- `generate_video` (`POST /api/render-video`) — Zero-markup BYOK pass-through OR local FFmpeg 1280x720 24fps H.264 + stereo AAC synthesis (`zoompan` camera motion + Multi-Turn LUT + rain/sub-bass soundtrack + First/Last frame `xfade` bridge).
- `slice_contact_sheet` (`POST /api/slice-grid`) — Single-pass FFmpeg `3x3` (9-grid) or `2x2` (4-grid) contact sheet PNG slicer.
- `extract_last_frame` (`POST /api/extract-last-frame`) — Exact final-frame PNG extractor (`ffmpeg -sseof -0.1`) for continuous multi-shot chains.
- `flow_scene_builder` (`POST /api/compile-timeline`) — Multi-clip H.264 + stereo AAC timeline stitcher (`+faststart`).
- `inpaint_frame` — Non-destructive frame redraw / grade pass.
- `extract_style_dna` — Extracts palette, lens, lighting, and film stock Style DNA tokens.

## Static Media & Health
- `GET /media/*` — Byte-range (`206 Partial Content`, `Accept-Ranges: bytes`, `CORS: *`) static server for `apps/web-studio/public/media/`.
- `GET /api/health` — Live FFmpeg status, 6 MCP tool names, and available `/media/*` asset manifest.
