# Open-DreamFlow Figma & FigJam Architecture & UI Teardown Links

**Authenticated Figma Team:** `Dheepan Ratnam` (`planKey: "team::1477604640266908624"`, `specs_enabled: true`, `code_layers_enabled: true`)

---

## 1. Live Figma & FigJam Boards

| Artifact | Type | Live URL | Source / Spec |
| --- | --- | --- | --- |
| **Sume vs Higgsfield vs Open-DreamFlow Interactive UI Teardown & Super-Studio Prototype** | Figma Make (`status: imported`) | [Open Figma Make Board](https://www.figma.com/make/D0V4yoorRyvVqaEqQivF8b) ([Full Import Node](https://www.figma.com/make/D0V4yoorRyvVqaEqQivF8b?code-import-attempt-id=a0c96deb55b297706ecebdf4b6b327ea5714c35e144d5114d9fc4d6edccf5d3b&code-import-node-id=1-6&code-import-surface=standalone)) | [`docs/figma-capture-board/index.html`](./figma-capture-board/index.html) |
| **Product Map & Chained DAG + Atomic Wallet Sequence (2 Diagrams Side-by-Side)** | FigJam (`flowchart LR` + `sequenceDiagram`) | [Open FigJam Product & Sequence Board](https://www.figma.com/board/JxHcOVFvTmdAQNhadt9h6v) | [`docs/figma-diagrams.json`](./figma-diagrams.json) (`board1_product_teardown`, `board3_dag_wallet_sequence`) |
| **Scale-Up Cloud, GPU Cluster & R2 Infrastructure Architecture** | FigJam Architecture (`FIGMA_DIAGRAM_2026`) | [Open FigJam Cloud & GPU Infra Board](https://www.figma.com/board/TQc8MQapnTZiSbZIjRS4Xh) | [`docs/figma-diagrams.json`](./figma-diagrams.json) (`board2_cloud_gpu_r2_infra`) |

---

## 2. Board Contents & Architectural Coverage

### A. Figma Make Board (`D0V4yoorRyvVqaEqQivF8b`)
Imported from [`docs/figma-capture-board/index.html`](./figma-capture-board/index.html) as a self-contained interactive 3-tab prototype:
1. **UI Teardown Board (3-Column Side-by-Side Comparison):**
   - **Sume.com:** Reconstructs Sume's dark Geist UI (`--sume-sky: #00AFFF` / `#00bfff` cyan accent, `#141414` background, `$5` minimum top-up, 365-day rollover, `0%` list-price markup on public API/MCP, `Director Studio 1.0` `/generate`, `Motion Transfer` / `Object Swap` `"Recreate"` cards) and highlights its structural gap (flat single-turn composer with no spatial multi-shot DAG or existing-subscription browser bridge).
   - **Higgsfield.ai:** Reconstructs Higgsfield's `#030304` void + `#D1FE17` acid-lime + `#0F1113` Cinema Studio layout (`Soul ID` character lock, `DoP` camera presets, `Genjutsu`, promo banners) and highlights its `$19–$129/mo` non-rollover credit lock-in and separate `api.higgsfield.ai` billing friction.
   - **Open-DreamFlow Commercial Edition ("Beat Both"):** Reconstructs our Dreamina matte charcoal spatial canvas (`#0E0E0E` dot grid, `#191919` levitation chrome, `#20D5EC` cyan Bezier wires) uniting `@Soul` continuity, per-node multi-platform routing, 3D DoP camera rig, `Timelines 1` multi-track NLE, and zero-lock-in hybrid credits (`Chrome Browser Bridge` + `$0` BYOK + `MCP` + `$5` non-expiring wholesale wallet).
2. **Stage 8 `1-Click Connections Hub` Wireframe:**
   - Interactive platform switcher (`Higgsfield AI`, `Sume.com`, `Kling AI`, `Dreamina`, `Google Flow / Veo 3.1`, `ElevenLabs`) showing the 1-click pre-bridged Chrome launcher alongside Option A (`1-Click Guided Browser Sign-In`) and Option B (`$0 Markup Official API Key`).
3. **Scale Infrastructure & Unit Economics Dashboard:**
   - Summarizes Cloudflare Pages + SQLite Durable Objects (`$0.15/M` reqs), Trigger.dev v3 Pro -> Temporal Cloud DAG orchestration, Cloudflare R2 (`$0.00` egress, `~94%` egress savings at `50 TB/mo` vs S3), `imgproxy` WebP LOD tiles, FFmpeg 8.0 NVENC fleet, and H100 `PuLID-FLUX` (`~$0.008/img`) + `ostris/ai-toolkit` LoRA (`~$0.16`) + `Wan 2.2/2.6 14B FP8 + CameraCtrl` (`~$0.06/5s 720p`) economics (`~$495/mo` MVP -> `~$8,020/mo` at 10K creators `~35%` GM -> `~$64,500/mo` at 100K creators `>41%` GM).

### B. FigJam Product & Chained DAG Sequence Board (`JxHcOVFvTmdAQNhadt9h6v`)
1. **`board1_product_teardown` (`flowchart LR`):** Side-by-side product & monetization comparison (`sumeFlow`, `higgsFlow`, `dreamFlow`) showing how Open-DreamFlow's Spatial DAG and 1-click hybrid routing solve both Sume's flat single-turn gap and Higgsfield's expiring credit wall.
2. **`board3_dag_wallet_sequence` (`sequenceDiagram`):** 13-step request lifecycle across `CreatorCanvas` -> `APIGateway` -> `CreditLedger` -> `DAGOrchestrator` -> `KlingOrGPU` -> `CloudflareR2` demonstrating atomic `HOLD -> CAPTURE` settlement and multi-node Image-to-Video artifact chaining.

### C. FigJam Scale-Up Cloud, GPU & R2 Infrastructure Board (`TQc8MQapnTZiSbZIjRS4Xh`)
Rendered with `useArchitectureLayoutCode: "FIGMA_DIAGRAM_2026"` across all 6 canonical architecture lanes:
- **Client (`client`):** `Spatial WebGL Canvas`, `Chrome Credit Bridge`
- **Edge & Realtime (`gateway`):** `Cloudflare Pages API`, `Durable Objects Sync`
- **Core Control Plane (`service`):** `Fastify API Router`, `Double-Entry Wallet`, `Temporal DAG Worker`, `H100 GPU Cluster`, `FFmpeg NVENC Proxy`
- **Job Queues (`async`):** `Temporal Task Queue`
- **Storage & State (`datastore`):** `Postgres Ledger DB`, `BYOK KMS Vault`, `Cloudflare R2 CDN`
- **Tier-1 Model APIs (`external`):** `Stripe Checkout`, `Kling Seedream Veo APIs`, `ElevenLabs Sync APIs`

---

## 3. Related Architecture & Teardown Docs
- [`docs/scale-infrastructure-blueprint.md`](./scale-infrastructure-blueprint.md) — Principal Cloud, GPU, Media Hosting & FinTech Infrastructure Blueprint (`@infra`)
- [`docs/teardown-sume-vs-higgsfield.md`](./teardown-sume-vs-higgsfield.md) — Frontend, UX & Product Reverse-Engineering Teardown (`@teardown`)
