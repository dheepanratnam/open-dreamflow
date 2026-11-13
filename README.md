# Open-DreamFlow Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-252525.svg)](./LICENSE)
[![Zero-Markup Credits](https://img.shields.io/badge/Credits-%240%20Wrapper%20Markup-10B981.svg)](#3-connect-your-platform-credits-mcp--browser-bridge--api-keys)
[![MCP Client + Server](https://img.shields.io/badge/MCP-Stdio%20%2B%20HTTP%20Client%20%26%20Server-20D5EC.svg)](#4-external-mcp-credit-routing--built-in-mcp-server)
[![Single-Port CLI](https://img.shields.io/badge/CLI-npx%20open--dreamflow%20start-F5F5F5.svg)](#1-one-command-unified-launch-recommended)
[![Docker Ready](https://img.shields.io/badge/Docker-Compose%20Ready-252525.svg)](#2-docker-one-command-launch)

**Open-DreamFlow** is an MIT-licensed, zero-markup multi-platform spatial canvas studio that unifies your existing AI creator credits—**Higgsfield, Kling AI, Dreamina, Google Flow, OpenArt, ImagineArt, ElevenLabs, OpenAI, Fal.ai, Replicate, ComfyUI, and any MCP server**—into one node-based workflow without SaaS wrapper fees or credit markups.

Design reusable cross-platform pipelines on a **95%-open `#0e0e0e` matte charcoal spatial canvas**: generate a base frame with **ChatGPT Image 2.6 on Higgsfield**, wire that generated image directly into **Kling 4.0** for image-to-video motion, add **ElevenLabs Multilingual v2** voiceover or SFX, and share the workflow (`?recipe=` URL or `.dreamflow.json` bundle) so anyone can run it using **their own** MCP connections, logged-in browser credits, or API keys.

---

## System Architecture

```mermaid
flowchart TD
  subgraph Studio["apps/web-studio (Matte Charcoal Multi-Credit Canvas · React 18 + TS + Zustand)"]
    CB["Clean Blank Canvas + Per-Node Platform & Model Picker (Where + Model + Settings)"]
    DAG["Topological DAG Chaining (▶ Run Workflow: Stage 1 Image → Stage 2 Video → Audio)"]
    REF["Real Reference Nodes (@Ref_1..N Upload / Save Output as Reference)"]
    TL["Timelines 1 Dual-Lane (V1 + A1) + .mp4 Compiler + .fcpxml Export"]
  end

  subgraph Engine["packages/mcp-client (:3001 Single-Port Router + External MCP Client + WS Bridge)"]
    GEN["POST /api/generate-node & GET /api/platforms (Zero-Fallback Multi-Platform Router)"]
    MCPR["External MCP Registry (/api/mcp/servers · stdio npx/uvx & Streamable HTTP)"]
    WS["7-Platform Browser Credit Bridge (ws://localhost:3001/bridge)"]
    PRJ["Credential-Free Project Store (.dreamflow-data.nosync/projects + .dreamflow.json)"]
  end

  subgraph Credits["User's Own Credits ($0 Wrapper Markup)"]
    SDK["@open-dreamflow/provider-sdk (Higgsfield · Kling 4.0 · Dreamina · Google Flow/Veo · OpenArt · ImagineArt · ElevenLabs · OpenAI · Fal · Replicate · ComfyUI)"]
    EXT["extensions/chrome-bridge v1.1.0 (Logged-in Web Credits Across 7 Creator Platforms)"]
    EMCP["External MCP Servers (@elevenlabs/elevenlabs-mcp, @playwright/mcp, Custom HTTP)"]
  end

  CB & DAG & REF & TL --> GEN & MCPR & PRJ
  GEN --> SDK & MCPR & WS
  MCPR <--> EMCP
  WS <--> EXT
```

---

## Multi-Platform Credit & Workflow Capabilities

| Capability | Supported Platforms & Models | How It Works on the Canvas |
| :--- | :--- | :--- |
| **Clean Blank Canvas & Honest Empty Nodes** | All 12 Platforms | Clicking **`+ New Blank Canvas`** starts 100% empty (`0` demo tags, `0` pre-filled stock shots). Spawning **Image**, **Video**, **Audio**, or **Reference (`@Element`)** creates a clean `idle` card with `[Where (Platform)] + [Model] + [Settings]`. |
| **Per-Node Platform, Model & Settings** | **Higgsfield** (`ChatGPT Image 2.6`, `Soul`, `DoP I2V`), **Kling AI** (`Kling 4.0`, `Kling 3.0 Master`), **Dreamina** (`Seedream 5.0 Pro`, `Seedance 2.5`), **Google Flow** (`Imagen 4`, `Nano Banana 2`, `Veo 3.1`), **OpenArt**, **ImagineArt**, **ElevenLabs**, **OpenAI**, **Fal**, **Replicate**, **ComfyUI** | Every node remembers its own `platformId`, `modelId`, aspect ratio (`16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `21:9`), resolution (`1K`/`2K`/`4K`/`720p`/`1080p`), batch size (`1x`–`4x`), duration (`4s`–`15s`), audio toggle, and voice ID. |
| **Cross-Platform Chaining (`Image → Video`)** | e.g. `Higgsfield · ChatGPT Image 2.6` → `Kling AI · Kling 4.0` | Drag from a generated (or `idle`) Image node's `(+)` handle and pick **Create Video**, or click **`▶ Run Workflow`** in the top bar. Stage 1 generates on Platform A and automatically passes its real output image as `referenceImages[0]` into Stage 2 on Platform B. |
| **Real Reference Creation (`@Ref_1`)** | Upload from disk or save any generated node | Upload product/character photos directly into a **Reference (`@Element`)** node, or click **`Save @Ref`** on any generated canvas frame to lock it as a reusable reference across downstream prompts and wires. |
| **MCP Credit Routing (`stdio` & `http`)** | `@elevenlabs/elevenlabs-mcp`, `@playwright/mcp@latest`, `mcp-fal-server`, or any custom MCP server | Register external MCP servers in **`Connections · Credits → MCP Servers`**. Discovered tools auto-bind to canvas platforms and execute with zero wrapper fees. |
| **7-Platform Browser Subscription Bridge** | `higgsfield.ai`, `app.klingai.com`, `dreamina.capcut.com`, `labs.google/fx/tools/flow`, `openart.ai`, `imagine.art`, `elevenlabs.io` | Use your existing monthly web subscriptions directly from canvas nodes over `ws://localhost:3001/bridge` via `extensions/chrome-bridge` v1.1.0. |
| **Credential-Free Workflow Sharing** | `?recipe=` URL & `.dreamflow.json` | Exported workflows preserve every node's platform, model, settings, prompts, and wires while **never** serializing API keys—recipients plug in their own credits and click **Run Workflow**. |

---

## Quickstart

### 1. One-Command Unified Launch (Recommended)

```bash
cd open-dreamflow
npm install
npm run build

# Verify local environment (Node, FFmpeg, ffprobe, built SPA & packages)
npx open-dreamflow doctor

# Launch unified single-port Open-DreamFlow Studio on http://localhost:3001
npx open-dreamflow start --port 3001 --no-open
```

Open **`http://localhost:3001`**:
1. Open the top-left project menu and click **`+ New Blank Canvas`** (or load **`Workflow Blueprint · Multi-Credit`** for a pre-wired `Higgsfield ChatGPT 2.6 → Kling 4.0 → ElevenLabs` graph).
2. Click **`Connections · Credits`** in the top-right header to connect an MCP server, Browser Credit Bridge tab, or direct API key.
3. Select any node, pick **Where** (platform) + **Model** + **Settings**, type your prompt, and click **Generate** (or **`▶ Run Workflow`** to run the full connected graph).

---

### 2. Docker One-Command Launch

```bash
docker compose up --build
```

Open **`http://localhost:3001`**. Projects and generated media persist in `.dreamflow-data.nosync`.

Run the automated end-to-end verification suite across all packages:

```bash
npm test
```

---

### 3. Connect Your Platform Credits (MCP · Browser Bridge · API Keys)

Click **`Connections · Credits`** in the top-right header:

- **Tab 1 — Creator Platforms & API Keys (`$0 Markup`):**
  Connect direct keys for **Higgsfield**, **Kling AI** (`AK/SK` JWT or Bearer token), **Dreamina / BytePlus Ark**, **Google AI Studio (Gemini / Imagen 4 / Veo 3.1)**, **ElevenLabs**, **OpenArt**, **ImagineArt**, **OpenAI Direct**, **Fal.ai**, **Replicate**, or **ComfyUI Local GPU (`:8188`)**. Keys remain strictly in browser `localStorage` (`open_dreamflow_byok_v1`).
- **Tab 2 — MCP Servers (`stdio` & Streamable HTTP):**
  Load 1-click templates (**ElevenLabs Official MCP**, **Playwright Creator Credits MCP**, **Fal Media MCP**, or **Custom HTTP MCP**) via `POST /api/mcp/servers`. Any discovered MCP tool can be bound to a platform model picker or spawned directly onto the canvas.
- **Tab 3 — Browser Credit Bridge (`7 Platforms`):**
  Load the unpacked Chrome Extension (`open-dreamflow/extensions/chrome-bridge`) at `chrome://extensions` (or paste the 1-line console connector `import('http://localhost:3001/bridge-connector.js')`) on any signed-in **Higgsfield**, **Kling**, **Dreamina**, **Google Flow**, **OpenArt**, **ImagineArt**, or **ElevenLabs** tab to spend your web subscription credits directly from canvas nodes.

---

### 4. External MCP Credit Routing & Built-In MCP Server

`packages/mcp-client` acts as **both**:
1. **An External MCP Client Host (`/api/mcp/servers` & `/api/mcp/call`)** capable of spawning local `stdio` MCP servers (`npx`, `uvx`, `node`, `python`) and connecting to remote JSON-RPC / Streamable HTTP MCP endpoints.
2. **A 14-Tool JSON-RPC 2.0 MCP Server (`http://localhost:3001/mcp`)** exposing `generate_node`, `list_platforms`, `generate_video`, `keyframe_bridge`, `generate_audio`, `flow_scene_builder`, `slice_contact_sheet`, `extract_last_frame`, `inpaint_frame`, `outpaint_expand`, `remove_background`, `upscale_4k`, `extract_style_dna`, and `save_project`.

---

## License

Released under the [MIT License](./LICENSE).
