# Contributing to Open-DreamFlow

Thank you for helping build **Open-DreamFlow** — the MIT-licensed, zero-markup spatial AI filmmaking studio combining **Dreamina 2.0 Smart Canvas** + **Google Flow (`gemini-omni-1.2-flash`)** with direct BYOK adapters, Model Context Protocol (MCP) canvas nodes, and consumer subscription browser bridges.

---

## Development Setup

### Prerequisites
- **Node.js** `>= 20.0.0` (tested on Node 20, 22, and 24)
- **npm** `>= 10.0.0`
- Optional: Google Chrome / Brave / Arc (for testing `extensions/chrome-bridge`)

### Bootstrap & Verify

```bash
# 1. Install workspace dependencies from repo root
npm install

# 2. Compile TypeScript SDK & MCP packages
npm run build:sdk
npm run build:mcp

# 3. Build Web Studio (TypeScript check + Vite production bundle)
npm run build

# 4. Run the full automated verification suite
npm test
```

### Running Live Dev Stack (Web Studio + MCP Bridge)

```bash
# Terminal 1 — Start Universal MCP HTTP/WS/SSE Bridge on :3001
npm run mcp:bridge

# Terminal 2 — Start Spatial Canvas Web Studio on :8789
npm run dev
```

---

## 1. Adding a Zero-Markup BYOK Provider

Open-DreamFlow enforces a strict **$0 middleman markup** rule: every adapter talks directly from the user's runtime to the upstream model API or local GPU endpoint without proxy telemetry or credit wrappers.

1. **Create or extend an adapter in `packages/provider-sdk/src/`:**
   - Implement a typed client class (see `src/gemini-omni.ts`, `src/seedance.ts`, `src/fal-replicate.ts`, or `src/comfyui.ts`).
   - Support standard spatial filmmaking primitives where applicable:
     - Aspect ratios (`16:9`, `9:16`, `21:9`, `1:1`)
     - `@Element` reference images (up to 6 `inline_data` or image URLs)
     - First/Last keyframe anchoring (`firstFrame`, `lastFrame`)
     - Stateful multi-turn continuity (`previous_interaction_id` or seed lock)
2. **Register in `DreamFlowProviderRouter` (`packages/provider-sdk/src/index.ts`):**
   - Add the new `ProviderId` union member.
   - Update `estimateZeroMarkupCost()` with transparent raw upstream per-second / per-image pricing.
3. **Wire into Web Studio (`apps/web-studio/`):**
   - Add credential fields to `BYOKCredentials` in `src/types/studio.ts`.
   - Add execution dispatch in `src/services/executionRouter.ts` with graceful local procedural preview fallback when offline.
   - Surface the key input in `src/components/ProviderModal.tsx`.

---

## 2. Adding a Dreamina `/` Slash Skill

Slash skills in the Prompt Dock (`apps/web-studio/src/components/PromptDock.tsx` & `src/presets/studioPresets.ts`) package multi-node camera choreography, prompt grammar, and aspect/duration presets into 1-click filmmaking recipes.

1. Open `apps/web-studio/src/presets/studioPresets.ts` and add an entry to `DREAMINA_SKILLS`:
   ```ts
   {
     id: 'skill-anamorphic-chase',
     command: '/Anamorphic Chase',
     category: 'Camera',
     description: 'Low-slung Russian arm tracking shot at 60fps with 2.39:1 anamorphic flare',
     promptTemplate: 'Low-angle Russian arm pursuit tracking @Hero_Kael, 40mm Atlas Orion anamorphic lens, horizontal cyan streak flare, rain-slick asphalt reflections',
     recommendedAspect: '21:9',
     recommendedDurationSec: 10,
     mode: 'video',
   }
   ```
2. Typing `/` in `PromptDock.tsx` will automatically index, filter, and render your new skill pill.

---

## 3. Adding Custom MCP Server Tools & Canvas Node Schemas

Any standard **Model Context Protocol (MCP)** server exposing JSON-RPC 2.0 `tools/list` and `tools/call` over WebSocket (`ws://`), Streamable HTTP (`http://`), SSE, or STDIO (via `dreamflow-mcp-bridge`) automatically converts its tools into interactive **Spatial Canvas Nodes**.

1. **Tool Input Schema Mapping (`packages/mcp-client/src/client.ts`):**
   - `mcpToolToCanvasNodeSchema(tool)` inspects `tool.inputSchema.properties` and maps:
     - `prompt` / `text` → Primary prompt socket
     - `first_frame` / `last_frame` / `source_frame` / `reference_images` → Image frame input ports
     - `mask_image` → Non-destructive Inpaint Mask port
     - `previous_interaction_id` → Multi-turn video branch input port
     - `enum` / `number` / `boolean` properties → Typed inspector controls
2. **Built-in STDIO Bridge Tools (`packages/mcp-client/src/server-bridge.ts`):**
   - To add a built-in local tool when no external STDIO binary is passed, append its JSON Schema definition to `BUILTIN_DREAMFLOW_MCP_TOOLS` and handle execution in `McpStdioBridgeServer`.
3. **Verify Live Discovery:**
   - Run `npm test` (executes `scripts/verify-all.mjs`) to verify live HTTP/WS JSON-RPC `initialize` → `tools/list` → `tools/call` roundtrips and Canvas Node schema conversion.

---

## Pull Request Checklist

- [ ] `npm run build:sdk && npm run build:mcp && npm run build` succeed with **0 TypeScript or Vite errors**.
- [ ] `npm test` passes all 4 verification stages (`provider-sdk`, `mcp-client`, `chrome-bridge`, `web-studio`).
- [ ] Conventional Commit message (`feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`).
- [ ] Zero hardcoded secrets, telemetry beacons, or proxy markups.
