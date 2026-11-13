# Competitive Reverse-Engineering Teardown & Product Blueprint: `sume.com` vs. `higgsfield.ai` vs. `Open-DreamFlow Next`

> **Document Scope & Evidence Basis:** Technical, UX, pricing, and systems teardown conducted via read-only inspection of public HTTP/CDN headers, SSR/RSC HTML documents, public CSS variable sheets, Next.js / TanStack Start client chunk manifests (`128` Sume JS chunks / `25` CSS sheets, `421` Higgsfield JS chunks / `38` CSS sheets, `137` `open.higgsfield.ai` JS chunks), `llms.txt` / `llms-full.txt` / Enterprise Help Center documentation, and live browser inspection of `https://www.sume.com`, `https://higgsfield.ai`, and `https://open.higgsfield.ai`. All routes, hex tokens, API schemas, feature flags, and dollar figures cited below reflect direct observations on `2026-11-13` (with Sume & `open.higgsfield.ai` live pricing pages stamped `2026-09-16` / `2026-10-21` / `2026-10-27` in their own source catalogs).
>
> **Companion Documents in `open-dreamflow/docs/`:**
> - **Scale Infrastructure, GPU Cluster & Zero-Egress R2 Blueprint:** [scale-infrastructure-blueprint.md](file:///Users/seba/Documents/antigravity/clever-mendel/open-dreamflow/docs/scale-infrastructure-blueprint.md)
> - **Interactive Figma UI Teardown & FigJam Architecture Boards:** [figma-design-links.md](file:///Users/seba/Documents/antigravity/clever-mendel/open-dreamflow/docs/figma-design-links.md)

---

## 1. Executive Strategic Matrix (`Sume.com` vs. `Higgsfield.ai` vs. `Open-DreamFlow Next`)

### 1.1 The Core Thesis: Two Half-Finished Wrappers Leaving a Wide-Open Wedge

Both **Higgsfield.ai** and **Sume.com** are fundamentally **multi-model orchestration & workflow wrappers** wrapped around the same underlying foundation models (`Seedance 2.0/2.5`, `Seedream 5.0/5.5`, `Kling 3.0/4.0`, `Wan 3.0`, `Veo 3.1`, `GPT Image 2/2.5/2.6`, `Nano Banana Pro/2.1`, `MiniMax H3`, `Flux Kontext/2.0`, `Ideogram`, `Recraft`, `ElevenLabs`, `Topaz`), layered with thin directorial/identity/motion abstractions. Yet each optimizes for opposite halves of the market—and **both create fatal friction** that leaves an asymmetric opening for **Open-DreamFlow Next**:

1. **Higgsfield.ai — The Subscription-Trapped Feature Powerhouse:**
   Higgsfield built genuine product differentiation in **aesthetic presets (`Soul 2.0` / `Soul ID`)**, **cinematographic optical controls (`Cinema Studio 4.0` + `DoP` presets + `3D Jutsu` / SparkJS scene blocking)**, **reality-recasting video edits (`Genjutsu`)**, and **multiplayer `Canvas`**, backed by aggressive GrowthBook AB-tested funnels, Churnkey cancel-save deflection loops, and a loss-leader developer API (`open.higgsfield.ai`) pricing raw models **25–44.1% below Fal.ai**. However, its consumer product monetizes through **$15–$249/mo non-rollover subscriptions**, **10-minute / 24-hour timed countdown upgrade traps**, **90-to-180 day expiring Credit Packs gated behind active subscriptions**, and an **unbridged dual-wallet split** where consumer credits cannot fund API workloads and vice-versa.

2. **Sume.com — The `0% Markup` Higgsfield Fast-Follower Stuck in Single-Turn Forms:**
   Sume explicitly attacked Higgsfield's subscription and markup psychology: **`$0` required monthly plan, `$5` minimum pay-as-you-go top-up, 365-day rollover, `0%` markup over upstream model provider list prices, absorbed Stripe card fees, instant penny-accurate cost quotes right on the `Generate $0.42` CTA, and automatic refunds on failed jobs.**
   Forensic inspection of Sume's bundles proves Sume is a deliberate feature-parity clone/fast-follower of Higgsfield's exact surface map:
   - Sume mirrors Higgsfield's top navigation bar almost one-for-one (`Explore | Image | Video | Audio | MCP | API | Director Studio | Remix | Talking Avatars | AI Influencer | Caption | Face swap | Lipsync | Language swap`).
   - Sume reuses Higgsfield's dark CSS surface tokens verbatim (`#1c1e20`, `#23262a`, `#898a8b`, `#131517`, `#ffffff0d`, `#ffffff1a`, `#ff005b`) while swapping Higgsfield's acid lime `#d1fe17` for sky cyan `#00afff` (`--sume-sky`).
   - Sume even preserves Higgsfield's internal feature naming inside its codebase: its Remix route is literally `/videos/genjutsu`, and its `Director Studio 1.0` bundle (`0i9kr0zjvar-k.js`) literally exports `HIGGSFIELD_CINEMA_STUDIO_COLOR_PALETTES` (all 50 palette slugs from `static-noon` to `gasoline-sunset`) and `HIGGSFIELD_CINEMA_STUDIO_CONTROL_KEYS`.
   - Sume's `open.higgsfield.ai` parity goes down to the **exact same 28-day concurrency ladder** (`2` concurrent at `$0` -> `10` at `>=$25` -> `20` at `>=$100` -> `40` at `>=$1,000`).

   **Where Sume falls short:** Outside its AI agency chat (`/agents`, `/projects`), Sume's creative Studio (`/images`, `/videos`, `/audio`, `/videos/genjutsu`, `/generate`) remains a set of **disconnected single-turn web forms** dumping assets into a flat `History` grid. It has **zero spatial node-to-node multi-shot continuity (`Frame A -> Video -> Last Frame Extract -> Shot B -> Audio -> Timeline`)**, **zero local 3D optical camera orbit gizmo**, and **zero support for Bring-Your-Own-Key (BYOK) or external subscription pass-through**—you still have to prepay `$5+` into Sume's wallet even if you already pay for Kling, Google AI Studio / Flow, Dreamina, ElevenLabs, Fal, or Higgsfield.

3. **Open-DreamFlow Next — The "Beat Both" Wedge:**
   Open-DreamFlow wins by combining **what Sume refuses to build** (a unified, multi-shot **Spatial Continuity DAG + 3D Optical DoP Rig + Soul ID `@Element` Locker + Native Timeline**) with **what neither Higgsfield nor Sume can offer cleanly** (a **Zero-Trap Hybrid Credit Engine**: **100% Free BYOK / Local GPU / External MCP / 1-Click Pre-Bridged Chrome Session pass-through** across existing creator accounts *alongside* an optional **`$5` No-Expiry Cloud Wallet** powered by wholesale BytePlus/Kling/Vertex routing and self-hosted H100 `PuLID-FLUX` / `CameraCtrl` rigs).

---

### 1.2 Head-to-Head Strategic Matrix

| Dimension | `Sume.com` (2026) | `Higgsfield.ai` + `open.higgsfield.ai` (2026) | `Open-DreamFlow Next` (Target Wedge) |
| :--- | :--- | :--- | :--- |
| **Core Positioning** | **Zero-markup multi-model utility + AI Marketing Agent team** (`Scrapy`, `Remixy`, `Edity`, `Posty`, `Roasie`) | **Cinematic AI studio + social-viral generator + loss-leader developer API** | **Local-first & Cloud-scalable Spatial Filmmaking IDE + Universal Credit Router** |
| **Consumer Monetization** | `$0` sub PAYG (`$5` min top-up, 365-day expiry, Stripe fee absorbed) + optional `Pro $20` / `Startup $120` / `Scale $200` plans (`Pro` = `$20` included balance + `4` concurrent) | `$15–$19` Starter (`200–270` cr), `$49–$59` Plus (`1,000–1,200` cr), `$129` Ultra (`3,000` cr), Max up to `$249/mo` (`6,000` cr); **non-rollover** + GrowthBook countdown upsells + Churnkey save-wall + 90–180d Credit Packs | **$0 Subscription Mandatory.** Free Forever for BYOK, Local GPU, MCP & Chrome Session Bridge **OR** optional **`$5` Zero-Trap Cloud Wallet** (never expires while active, 0 lock-in, auto-refunds on errors) |
| **Markup & Price Transparency** | **0% markup** over upstream maker price; exact dollar price shown on `Generate $0.42` CTA + `/sume-api/pricing` (`319` rows) | Consumer credits opaque (`$0.04–$0.06/cr` implied) + "Unlimited" asterisk rules; Developer API **25–44% below Fal** (e.g. `Kling 3.0 Pro $0.0962/s`) + `100% cashback` promo wallet | **Wholesale pass-through (`0%` fee on BYOK/Bridge)** + **Transparent per-shot Cloud Wallet quote (`$0.008` Soul keyframe, `$0.06` DoP clip)** routing automatically to cheapest wholesale or self-hosted H100 path |
| **Concurrency Limits** | PAYG 28-day ladder: `$0 -> 2` (`4` w/ API key), `$25 -> 10`, `$100 -> 20`, `$1,000 -> 40` (`Pro 4`, `Startup 8`, `Scale 20`) | App gated by tier (up to `6 Videos / 8 Images` on Ultra); Open API shares **identical** 28-day ladder: `2 -> 10 ($25) -> 20 ($100) -> 40 ($1,000)` | **Client-federated parallelism**: Unlimited across user's BYOK/Bridge accounts (`1` job per connected tab + API concurrency) + pooled Cloud tier scaling cleanly without subscription gates |
| **Workflow Architecture** | **Vertical Studio forms** (`/images`, `/videos`, `/generate`) + Agent tile board (`/projects` Figma-style comments) | Vertical mini-apps (`Cinema Studio`, `Soul`, `Genjutsu`, `Speak`, `Marketing Studio`) **plus** multiplayer **Higgsfield Canvas** (`wss://canvas-worker`) + `3D Jutsu` | **Unified Matte Charcoal Spatial DAG (`#0E0E0E`)**: multi-shot nodes wired visually with `#20D5EC` cyan splines (`Text -> Keyframe -> DoP Video -> Last Frame -> Shot 2 -> Audio -> Timeline`) |
| **Character & Style Continuity** | `@Element` upload + `Director Cast 1.0` (`$0.154–$0.304/img`) & `Director Locations` (`$0.036–$0.103/img`); **no user face-LoRA trainer** | **Soul 2.0 + Soul ID** (`>=20` photos, `~3m` LoRA training, `$2.50/req` in API, `custom_reference_strength`, **Soul HEX**, **Soul Moodboard**) | **Soul ID Continuity Vault**: Instant `<7s` **`PuLID-FLUX` (`~$0.008/img`)** for 1–3 photos **OR** **`ai-toolkit` fast LoRA (`~$0.16/run`, `2–4m` H100)** bound to reusable `@Actor`/`@Prop`/`@LUT` chips across *all* providers |
| **Camera & DoP Rigging** | **`Director Studio 1.0`** (`/generate`): `4` bodies, `5` lenses, `3` apertures, `33` `#tag` moves, `50` HF palettes; **wraps Seedance 2.5 & Seedream 5.5** with no 3D stage | **`Cinema Studio 4.0`**: Bodies/Lenses/Focal Lengths/Apertures, `50+` `#tag` moves, `6` genres, `1960–2020` era dial, **2-light Video Lighting Console**, **Acting Console** (`6×3`), `Mr. Higgs`, `3D Jutsu` (`SparkJS`) | **3D Optical DoP Console**: Interactive WebGL/Canvas stage (`azimuth`, `elevation`, `16–85mm`, `f/1.4–f/11`, `ARRI/RED/35mm`, `Anamorphic/Helios`), compiling **both** prompt `#tags` AND raw **`[R\|t]` Plucker extrinsics** -> `CameraCtrl`/`Wan 2.6` |
| **Motion Transfer / Lip-Sync** | `/videos/genjutsu` (`Remix` wrapping `Motion Transfer / Object Swap / Restyle` `$0.123–$0.680/s`) + `/videos/lipsync` (`VEED Fabric`, `Kling`, `LatentSync`, `OmniHuman 2`, `Sync 3`) | **Genjutsu** (`$0.154–$0.835/s`) & **Genjutsu Light** (`$0.05–$0.20/s`, up to `30` refs), **Speak / Lipsync Studio / Intone**, **Marketing Studio** (`6` formats + layered posters) | **Node-chained Motion/Swap/LipSync**: `DepthCrafter + DWPose + SAM 2 + Wan-VACE` & `LatentSync` (`$0.006–$0.015/s` self-hosted or ElevenLabs + Kling pass-through) directly on canvas clips |
| **Frontend Stack** | Vercel Edge + **Next.js App Router (RSC)** + Radix UI + Clerk + `media.sume.com` (R2) + `SSE` (`EventSource`) | Cloudflare Workers + **TanStack Start / Router** + Tailwind v4 + Clerk + DataDome + GrowthBook + Churnkey + Grafana Faro + `wss://` workers + **W3C WebMCP (`document.modelContext`)** | **Vite + React 19 + TypeScript + Tailwind v4** + `CanvasBoard` + local/edge WS/SSE (`:3001`) + Manifest V3 Chrome Bridge (`8` creator domains incl. `higgsfield.ai` & `sume.com`) + Native MCP Server |
| **Open Ecosystem & Portability** | Closed hosted workspace (`media.sume.com`); offers **MCP (`mcp.sume.com/mcp`)**, CLI & REST API, no BYOK | Closed app + separate `open.higgsfield.ai` API + MCP (`mcp.higgsfield.ai/mcp`) + Adobe/Figma/Blender plugins; **actually registers W3C WebMCP tools in DOM** | **100% Portable `.dreamflow.json` DAGs**, Shareable Recipe Apps (`?recipe=`), **MCP Client & Server**, **1-Click Pre-Bridged Chrome Profile**, local file media (`206` faststart MP4) + R2 `$0`-egress scale path |

---

## 2. Complete Frontend & UI/UX Anatomy of `sume.com`

### 2.1 Full Route Map & Information Architecture

Extracted directly from `sume_js/1mj-d405hg_y7.js`, `sume_js/1g1f3u5zw79lc.js`, `sume_js/23edj3sa3bsfb.js`, `sume_robots.txt`, and `sume_llms.txt`:

| Surface Group | Observed Routes | Purpose & UX Behavior |
| :--- | :--- | :--- |
| **Root & Explore** | `/` (`308` -> `https://www.sume.com/`), `/assets`, `/assets/explore`, `/assets/liked`, `/assets/mcp`, `/models`, `/models/avatar`, `/pricing`, `/pricing/api`, `/compare`, `/about`, `/enterprise`, `/affiliate` | Public bento/masonry showcase gallery (`Filter`, `View`, `Made here`) displaying community/featured generations with model tags; `/compare` explicitly targets competitors (`vs Higgsfield`, `vs Genjutsu`, `vs HeyGen`, `no-subscription`). |
| **Image Studio** | `/images`, `/images/inpaint`, `/images/relight`, `/images/face-swap`, `/images/character-swap`, `/images/layers` | **Single-turn image workstation.** `/images/relight` adds an interactive drag-to-aim 3D sphere lighting widget (`Top`, `Front`, `Right`, `Left`, `Back`, `Bottom`, `Soft`/`Hard`, `Brightness 50%`, `Color #FFFFFF`). `/images/layers` wraps `Qwen Image Layered` / `Seedream 5.5 Layers` for RGBA/PSD separation. |
| **Video & Remix Studio** | `/videos`, `/videos/genjutsu`, `/videos/lipsync`, `/videos/face-swap`, `/videos/dubbing`, `/videos/caption`, `/videos/effects`, `/videos/motion`, `/videos/talking-avatars`, `/avatars`, `/avatars/influencer` | `/videos` splits into `Create Video`, `Edit Video` (`extend`, `upscale` Topaz `4K`, `sdr-to-hdr` HDR10/H.265-10bit, `fps-boost` `60fps`), and `Motion Control` (`kling/3.0/motion-control` with likeness consent modal). `/videos/genjutsu` is branded **"Remix"** in nav! |
| **Audio & Voice** | `/audio`, `/audio/music`, `/bgm`, `/voices` | Script block editor (CSS `audio-module__otHzAa__page`: flexible `1fr 550px` split panel) with multi-speaker voice chips (`min-height: 160px` field-sizing editor), live char counter, and `Generate` bar (`ElevenLabs` / music). |
| **Director Studio 1.0** | `/generate`, `/generate/all`, `/generate/elements`, `/generate/favorites`, `/generate?view=projects`, `/generate/:projectId`, `/generate/:projectId/settings` | Sume's **answer to Higgsfield Cinema Studio**. Has dedicated left sidebar (`w-64`: `Home`, `My generations`, `My elements`, `My favorites`, `Community`, `Projects`, `Pricing From $5`), multi-ref rail (`0/50`), and directorial pills above composer. |
| **Sume Agent / Brand OS / Projects** | `/agents`, `/agents/chat`, `/agents/projects`, `/agents/project/:id`, `/agents/ads`, `/agents/ad-library`, `/agents/avatars`, `/agents/automations`, `/agents/scheduled`, `/agents/format`, `/agents/skills`, `/agents/plugins`, `/projects`, `/brands` | **Light-mode agency canvas** (`#fff` / `#f5f5f5`, `--agent-selection: #0d99ff`) powered by specialist agents: `Scrapy` (ad library miner), `Remixy` (video remaker), `Edity` (cuts/captions), `Posty` (TikTok/IG/YT/Meta/Google Ads), `Roasie` (analytics). Tiles on `/projects` are auto-grouped by agent with Figma-style pin comments (`#098de0`). |
| **Developer API & Docs** | `/sume-api`, `/sume-api/pricing` (alias `/app/api/*`), `/mcp`, `/docs`, `/docs/{quickstart,authentication,architecture,images,video,models,uploads,jobs,billing,webhooks,client,errors,limits}` | Self-serve API hub (`dashboard.sume.com` / `api.sume.com`) with 94+ models, 319 live SKU price rows (`/sume-api/pricing`), playground, API keys, usage charts, and remote OAuth MCP (`/mcp`). |
| **Billing, Org & Admin** | `/billing`, `/dashboard/{billing,concurrency,api-keys,usage,webhooks,members,memory,rules}`, `/settings/*`, `/org/*`, `/cli/login` | Clerk org switcher (`personal` vs `team` wallet targets), Stripe quick-buy & auto-topup (`quick-buy`, `auto-topup/setup-session`), concurrency bar, and 9-locale URL prefixing (`/ko-KR`, `ja-JP`, `zh-CN`, `zh-TW`, `es`, `fr-FR`, `pt-BR`, `de`). |

---

### 2.2 Navigation Layout, Typography, Color Palette & Card Density

#### Navigation Hierarchy
Live inspection (`final_step_41.png`) and extracted header markup confirm a **two-layer horizontal bar** on consumer studio routes:
- **Primary Header Ribbon:** `Explore | Image | Video | Audio | MCP | API | Director Studio [Hot] | Remix | Talking Avatars | AI Influencer | Caption | Face swap | Lipsync | Language swap` on the left; `Search ⌘K | Affiliate | Upgrade | From $5 | Enterprise | Assets` on the right.
- **3-Pillar Product Switcher Strip (`Studio 1 | MCP 2 | API 3`):** Appears consistently across marketing/studio views (`1/2/3` numbered badges) to remind creators that the **same `$5` wallet** powers web UI, AI coding/agent MCPs, and REST/CLI workflows.
- **Workspace Sidebars:**
  - **Director Studio (`/generate`):** Fixed `w-64` (`256px`) dark left rail (`Home`, `My generations`, `My elements`, `My favorites`, `Community`, `Projects`, `Pricing From $5`).
  - **Sume Agent (`/agents`):** Resizable panel `--agent-sidebar-width: min(var(--sume-panel-width, 288px), max(238px, 100vw - 480px))` alongside `--agent-chat-min-width: 360px`.
  - **Developer API (`/sume-api/*`):** Compact collapsible doc/console sidebar (`⌘B` toggle) with `Dashboard`, `Explore models`, `Quick start`, `Documentation`, `Pricing`, `Playground`, `API keys`, `Analytics`, `Billing`.

#### Typography & Localization Stack (`sume_css`, `css_report.txt`)
Sume invests heavily in typographic polish and CJK readiness across 9 locales:
- **UI & Studio Sans:** `'GeistSans'`, `'Geist, Geist Sans, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif'` (with `Pretendard Variable` covering `ko-KR`, `ja-JP`, `zh-CN`, `zh-TW`).
- **Marketing & Editorial Display:** `'SuisseIntl'` (`landingSuisse`), `'Landing Diatype'`, `'Essay Diatype'`, `'Essay Suisse'`.
- **Code & Price Tabular Alignment:** `'JetBrains Mono'`, `'Geist Mono'` (`--agent-font-mono`, `font-variant-numeric: tabular-nums` enforced on all `$0.01` price chips, character counters, and API tables).

#### Color Palette & Surface Tokens (`sume_css`, `css_report.txt`)
Sume uniquely runs **two completely distinct theme grammars**:
1. **Dark Media Studio & Director Theme** (directly echoing Higgsfield's charcoal palette while replacing acid lime `#d1fe17` with electric sky cyan):
   - Background / Void / Chrome: `#0d0d0d` (`--settings-primary-bg`), `#0e0e0e` (`--redeem-bg`), `#141414` (Studio canvas), `#17191c` (`--p-surface`), `#191919` (`--ds-menu-bg`), `#1c1e20` (`--popup-card`, `--settings-field-bg`), `#23262a` (`--settings-badge-bg`)
   - Brand & Interactive Accents: **`#00afff` / `#00bfff`** (`--studio-accent-fill`, `--sume-sky`, `--remix-accent`), `#0a86e6` (`--remix-accent-deep`), `#3a83f7` (`--settings-accent`), `#ff6764` (`--sume-like`), `#c4201c` (`--sume-like` alt), **`#ff005b`** (`--agent-attention`, shared identically with Higgsfield!)
2. **Light Agency & Projects Canvas Theme** (`/agents`, `/projects`, `/audio`):
   - Surfaces: `#fff` (`--agent-bg-chrome`, `--agent-bg-content`, `--agent-berd-card`), `#f5f5f5` (`--agent-bg-raised`, `--agent-berd-canvas`, `--project-canvas-field`), `#f0f0f0` (`--agent-paper-bg-hover`), `#e8e8ea` (`--agent-empty-card-bg`)
   - Figma-Inspired Canvas & Comments: `--agent-selection: #0d99ff`, `--agent-comment-blue: #098de0`, `--agent-chat-toggle: #f4511e`, `--agent-cyan: #3d8a9c`, `--agent-danger: #e74c3c`, `--agent-danger-text: #cf3e30`
   - Glass & Blur Materials: `--agent-berd-backdrop: blur(18px) saturate(160%) brightness(1.08)`, `--agent-material-backdrop: blur(24px) saturate(170%)`

#### Layout Density, Radii & Shadows
- Floating pill composer: `--ds-radius-composer: 40px`
- Cards / Dialogs / Menus: `--ds-radius-lg: 24px`, `--ds-radius-md: 18px`, `--ds-radius-sm: 12px`, `--ds-radius-menu: 10px`, `--ds-radius-xs: 6px`
- Shadows: `--ds-shadow-card: 0 2px 8px #0006`, `--agent-dialog-shadow: 0 25px 50px -12px #00000040, 0 12px 24px -8px #00000026`
- Type ramp: `11px` (`--ds-text-2xs`) -> `12px` (`xs`) -> `14px` (`sm`) -> `16px` (`base`) -> `18px` (`lg`) -> `20px` (`xl`) -> `24px` (`2xl`)
- Gallery Grid (`studio-influencer-module`, `sume_images`, `sume_relight`): `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))` with `16px` gaps (`aspect-ratio: 16/9` cards + clean zoom-in lightbox + `Made here / Filter / View` toggles).

---

### 2.3 Prompt Composer, Model Switcher, Director Studio 1.0 & Credit UX

#### Single-Turn Composer Anatomy (`/images`, `/videos`)
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  [ Start Frame (opt/req) ]  [ End Frame ]  [ @Elements (up to N refs) ]          │
│  Prompt textarea: "Describe scene, insert @Element1 tokens..."                    │
│──────────────────────────────────────────────────────────────────────────────────│
│ [Model: Seedance 2.5 ▾] [Aspect: 16:9 ▾] [Res: 720p ▾] [8s ▾] [🔊] [High Bitrate]│
│                                                  [ Draft 480p ] [ Generate $1.85 ]│
└──────────────────────────────────────────────────────────────────────────────────┘
```
- **Model Switcher (`02loy-qbbhkuh.js`, `1stix-ya_8flq.js`):** Divided into **Featured** and **All** groups with per-model brand icons and live capability filtering (`applyServedVideoCapabilities` automatically hides unsupported aspect ratios, durations, `edit` modes, or `4K` tiers):
  - **27 UI Image Models:** *Featured:* `GPT Image 2.6 Sunburst/Flare`, `Seedream 5.5`, `Soul 2.0` (`higgsfield-soul`), `GPT Image 2.5 Flare/Sunburst`, `ChatGPT Image 2`, `Seedream 5.0 Lite`, `Seedream 4.5`, `Nano Banana 2.1`, `Nano Banana Pro`, `Grok Imagine`. *All:* `Seedream 4.0`, `Ideogram 4.5/V3`, `Recraft V4/V4.1/V4.1 Utility`, `Nano Banana`, `Flux Kontext Max`, `Z-Image Turbo`, `Seedream 5.0 Pro`, `Kling O1`, `Kling Image 3.0 Omni`, `Soul Standard`, `Soul Cinema`, `Grok Imagine 2.0`.
  - **37 UI Video Models:** `Seedance 2.5` (`4–30s`), **`Seedance 2.5 Draft`** (`480p` rapid preview + 1-click **`Finish in 1080p`** upgrade!), `Seedance 2.5 Edit`, `Seedance 2.0 / Fast / Mini`, `Veo 3.1 / Fast / Lite`, `Gemini Omni Flash 1.1 / 1.2`, `Kling 4.0 / 4.0 Omni / Motion Control`, `Vidu Q3 / Pro / Turbo / Mix / v4`, `PixVerse C1 / V6`, `Wan 3.0 / Prime`, `MiniMax H3 / Max`, `Hailuo H3 Regen`, `WAND-Vega 1.5 Pro / 1.0`, `Mingmou 1`, `Grok Imagine Video 1.5`.
- **Directorial Preflight & Validation (`3emoecq8hpf59.js`):** Client enforces `requiresLiveStartFrame` (e.g., `vidu-q4`), `createNeedsReferenceImages`, clip-plus-output reference duration caps (`combinedMaxSeconds: 30`), and displays explicit `(required)` / `(optional)` slot badges before hitting `/api/...` so invalid jobs never debit funds.

#### Forensic Bombshell: `Director Studio 1.0` (`/generate`) & Sume Remix (`/videos/genjutsu`)
Inside `sume_js/0i9kr0zjvar-k.js`, `sume_js/13mbo_hdsu935.js`, and `sume_api_pricing_text.txt`, we uncovered **two smoking guns** proving how Sume mirrors Higgsfield's flagship UX while routing underneath to cheaper upstream engines:
1. **Verbatim Control Parity (`HIGGSFIELD_CINEMA_STUDIO_COLOR_PALETTES`):** Sume's browser bundle literally defines an exported constant named `HIGGSFIELD_CINEMA_STUDIO_COLOR_PALETTES` containing all 50 exact color grade slugs (`"static-noon"`, `"twilight-fable"`, `"back-row-kissing-seats"`, `"neon-rain-at-midnight"`, `"gasoline-sunset"`, etc.), plus `genre` (`epic, drama, noir, comedy, horror, action`), `era` (`1960s, 1980s, 1990s, 2000s, 2020s`), `pacing` (`chaotic, dynamic, calm, single-shot`), `light` (`silhouette, practicals, window, overhead-fall, contre-jour, soft-cross`), `camera_model` (`modern, 35mm-film, 8mm-film, dv-camcorder`), `camera_lens` (`clean-sharp, anamorphic, vintage-anamorphic, warm-vintage, halation-vintage`), `camera_aperture` (`f14-wide-open, f4-moderate, f11-deep-focus`), custom 2–15 hex palettes, `References (0/50)` drag-and-drop tray, and **33 stackable `#tag` camera movements** (`#snorricam`, `#robot-arm`, `#dolly-zoom`, `#bullet-time`, `#whip-pan`, `#crush-zoom`, `#helicopter-shot`, etc.).
2. **Identical Cent-for-Cent Wrapper Routing:** Compare `/sume-api/pricing` rates (`sume_api_pricing_text.txt` lines 17–72):
   - `Director Studio 1.0`: `1080p = $0.5686/s`, `720p = $0.23115/s`, `480p = $0.10285/s` -> matches **`Seedance 2.5`** (`1080p = $0.56862/s`, `720p = $0.23112/s`, `480p = $0.1028/s`) to **4 decimal places**!
   - `Director Cinema 1.0` (`1.5K = $0.020/img`, `2K = $0.035/img`) -> matches **`Seedream 5.5`** (`$0.020 / $0.035/img`) identically!
   - Meanwhile, Sume lists **`Soul 2.0`, `Soul Standard`, `Soul Cinema`, `Director Cast 1.0` (`$0.154–$0.304/img`), and `Remix Motion Transfer / Object Swap / Restyle`** (`/videos/genjutsu`, priced `$0.123 / $0.2765 / $0.6804/s` matching `Genjutsu`'s upstream list prices minus Higgsfield's max-discount markup!).

#### Credit Wallet, Billing UX & Live Generation Feedback
- **Top-Up & Quick-Buy UX (`269qbcuf2ey4b.js`, `17ajlbw9qirgt.js`):**
  - `$5.00` minimum (`MIN_TOPUP_USD_CENTS: 500`), **`365`-day expiration** (`TOPUP_CREDIT_LIFETIME_DAYS: 365`).
  - Sume **absorbs Stripe processing fees**, so a `$50` charge credits `$50.00` into `personal` or `team` wallets.
  - Shows a live **"What `$X` buys"** converter (`topUpBuys`: e.g., count of `Seedance 2.5` clips and `Nano Banana 2.1` images).
  - Supports 1-click saved-card charging (`POST /api/billing/org/top-ups/quick-buy`) and configurable **Auto Top-Up** (`/api/billing/org/auto-topup/setup-session`, minimum `$5` threshold floor, `$10` min reload -> up to `$10,000`).
- **Concurrency & Hybrid Tiering (`0a7spvjly9kcg.js`, `1j-euc9uri_6q.js`):**
  - PAYG rolling **28-day top-up ladder**: `$0 -> 2` concurrent jobs (`4` once API key is created) -> `>=$25 -> 10` -> `>=$100 -> 20` -> `>=$1,000 -> 40`.
  - Optional Monthly Plans for Agent/Social teams (`SUME_COM_PLAN_CATALOG`): `Free` (`$0`, `$1` included credits, `1` job), `Pro` (`$20/mo` or `$216/yr`, `$20` included generation credit, `4` jobs, `2` social accounts, full Agent + API + CLI + MCP), `Startup` (`$120/mo` or `$1,260/yr`, **`$140` generation credit**, `8` jobs), `Scale` (`$200/mo` or `$2,160/yr`, `$200` generation credit, `20` jobs, `10` social accounts). Notice `includedAgentUsdCents: 0` across tiers — Agent LLM orchestration overhead is effectively subsidized while generation spends exact USD lots!
- **Real-Time State & Error Handling (`0nlrwq2ngzcp0.js`, `1bli8g3s894sd.js`):**
  - Uses **`EventSource` SSE** (`subscribeAssetLedgerEvents` -> `asset-terminal` event) alongside job polling (`queued/pending -> running -> completed | failed | canceled`).
  - Pre-flight reserves estimated USD cost at submission, settles exact charge on completion, and **refunds 100% automatically** on failure or cancellation.
  - **`Seedance 2.5 Draft -> Finish` Pipeline:** Generate `480p` draft (`$0.1028/s`) -> inspect card in History -> 1-click **"Finish at 1080p"** calls `POST /v1/video-router/generate` with `{ model: "seedance-2.5", draft_job_id, resolution: "1080p" }` within the valid draft window.

---

### 2.4 Detected `sume.com` Tech Stack & Domain Map

| Layer | Detected Implementation (Observed Headers & JS Chunks) |
| :--- | :--- |
| **Hosting & Edge Routing** | **Vercel** (`server: Vercel`, `x-vercel-id: lhr1::...`, `strict-transport-security`, locale prefix rewrites & RSC streaming) |
| **Frontend Framework & UI** | **Next.js App Router (React Server Components)** (`/_next/static/chunks/*`, `vary: rsc, next-router-state-tree`, `x-matched-path`), **Radix UI** primitives, **CSS Modules + Tailwind utility classes** (`bg-muted-element`, `rounded-2xl`) |
| **Authentication & Orgs** | **Clerk** (`https://clerk.sume.com`, publishable key prefix `pk_live_Y2xlcmsuc3VtZS5jb20k`, `x-clerk-auth-status`, Clerk Organizations for `personal` vs `team` wallets) |
| **Media Storage & Upload** | **`https://media.sume.com`** backed by **Cloudflare R2 (`r2.dev`)** (`POST /api/studio/agent/attachments/presign`, `/multipart/{create,complete,abort}`) |
| **Payments & Billing** | **Stripe Checkout + Saved Payment Methods** (`/api/billing/org/top-ups/quick-buy`, `/api/billing/org/auto-topup/setup-session`, `USDC` invoice terms for Enterprise) |
| **API, MCP & Webhooks** | `https://api.sume.com/v1/{image,video}-router/generate`, `/v1/director-studio/{images,videos}`, `https://mcp.sume.com/mcp` (OAuth remote MCP), `dry_run` pre-pricing flag, HMAC-SHA256 webhook headers (`x-sume-webhook-signature: sume-v1=...`) |
| **Observability** | PostHog (`captureCreditsTopup...`, `posthogSentryLink`) + Sentry |

---

### 2.5 Where Sume Gets It Right vs. Where Sume Is Weak

- **What Sume Gets Right:**
  1. **Radical Price Honesty:** Displaying exact `$0.01`, `$0.42`, `$1.85` right inside the `Generate` button kills "how many credits is a 1080p render?" anxiety instantly.
  2. **Zero-Markup & Fee Absorption:** `$50` paid = `$50` spendable balance for 365 days; failed jobs auto-refund; `Seedance 2.5` 480p Draft -> 1080p Finish saves ~82% on bad takes (`$0.1028/s` vs `$0.5686/s`).
  3. **API + CLI + Remote MCP Parity:** Single wallet across studio UI, `mcp.sume.com`, CLI, and REST routers.

- **Where Sume Is Weak / Early-Stage:**
  1. **Flat Single-Turn Form Silos:** Generating an image on `/images`, animating it in `/videos`, extracting the last frame to shoot Shot 2, applying lip-sync in `/videos/lipsync`, and cutting with audio requires jumping across 4–5 disconnected pages and re-picking assets from `History`.
  2. **Projects Canvas Is Agent-Grouped, Not Filmmaker-DAG Wired:** `/projects` places outputs on a light-mode board grouped by AI marketing bot (`Scrapy`, `Remixy`, `Edity`)—there is **no deterministic spatial spline wiring (`Shot 1 [last frame] -> Shot 2 [start frame] + Audio Track -> Multi-Track Timeline`)**.
  3. **Imitative Director Controls Without Real 3D Camera Geometry:** `Director Studio 1.0` copies Higgsfield's exact 50 color palettes and `#tag` motion text tokens to wrap Seedance/Seedream, with **zero 3D camera viewport (`azimuth / elevation / focal frustum`)** and **no custom face/identity LoRA training vault**.
  4. **Mandatory Prepaid Lock-In & 2-Job Free Gate:** Users cannot plug in their existing OpenAI, Google Veo, Kling, Fal, Dreamina, or Higgsfield credits/subscriptions—every job forces hosted Stripe prepayment, throttled to just 2 concurrent jobs unless `$25+` is loaded every 28 days.

---

## 3. Complete Frontend & Feature Anatomy of `higgsfield.ai` & `open.higgsfield.ai`

### 3.1 Detected Tech Stack, Security Posture & Monetization Infrastructure

Inspected from `higgsfield.html`, `cloud_higgsfield.html`, `hf_js/*`, `open_hf_js/*`, `css_report.txt`, and HTTP/CSP headers:

| Layer | Detected Implementation |
| :--- | :--- |
| **Edge, Compute & SSR** | **Cloudflare Workers** (`x-hf-worker: tanstack`) running **TanStack Start / TanStack Router** (`/_serverFn/`, Vite ESM chunk graph `./ad332bb9-*.js` on `https://assets.higgsfield.ai/tanstack/`) |
| **Styling & Design System** | **Tailwind CSS v4** semantic tokens; Dark Void/Charcoal surfaces (`#0b0b0b`, `#0f1113` `--color-surface-tertiary`, `#131517` reverted font, `#18191c` section, `#1c1e20` `--color-surface-primary`, `#23262a` secondary, `#2a2d32` hover), muted text `#898a8b`, **Signature Acid Lime** (`#d1fe17` `--color-surface-brand` / `--color-lime`), **Secondary Hot Pink** (`#ff005b` `--color-surface-brand-secondary`), `Inter`, `Inter Display`, `Space Grotesk`, `IBM Plex Mono` / `Geist Mono` |
| **Auth & Bot Defense** | **Clerk** (`*.clerk.accounts.dev`, `api.clerk.com`, `*.protect.clerk.com`, session token injection via custom `xc()` transport layer) + **DataDome** (`js.datadome.co`, `/403` auto-recovery hook `maybeRecoverFromProtectionBlock`) |
| **Experimentation & Churn Defense** | **GrowthBook** (`cdn.growthbook.io`, feature key `pricing-ab-test` toggling `pricing_v1` vs `pricing_v2`, `canvas_table_v1`) + **Churnkey** (`api.churnkey.co` cancel-flow save offers!) + FirstPromoter affiliates |
| **Media CDN & Realtime Workers** | **Cloudflare R2** (`*.r2.cloudflarestorage.com`) + CloudFront (`images.higgs.ai`, `static.higgsfield.ai`, `assets.higgsfield.ai`), dedicated WebSockets **`wss://canvas-worker.higgsfield.ai`** (multiplayer Canvas), **`wss://3d-scene-builder.higgsfield.ai`** + **`sparkjs.dev`** (3D Gaussian Splat / Blender blocking for **3D Jutsu**), **`wss://dam-editor-worker.higgsfield.ai`**, `fnf-api-gw.higgsfield.ai` microservices (`fnf-campaign-api`, `fnf-aitys`, `fnf-higgsclaw-cron`, `fnf-score`, `fnf-meet`, `fnf-series`, `fnf-apps-marketplace`) |
| **Surprise Discovery: Built-In W3C WebMCP!** | `hf_js/ad332bb9-A80chU7euROWGiaH.js` implements **`document.modelContext.registerTool`** inside Chrome! Registers **17+ browser-native agent tools** (`get_image_draft`, `configure_image_draft`, `submit_image_generation`, `get_video_draft`, `configure_video_draft`, `get_cinema_image_draft`, `configure_cinema_image`, `submit_cinema_image`, `get_cinema_video_draft`, `configure_cinema_video`, `submit_cinema_video`, `get_cinema_video_options`, `create_generate_project`, `select_video_workflow`, etc.) with strict approval-gate telemetry! |
| **Developer API Domain Split** | Consumer App (`higgsfield.ai` — monthly credits) is **strictly separated** from Developer Cloud API (`open.higgsfield.ai` + `api.higgsfield.ai` + `cloud.higgsfield.ai` — USD prepaid wallet, `Authorization: Key <api-key>`) |

---

### 3.2 Soul & Soul ID (`Soul 2.0`, `Soul Cinema`, `Soul Cast`, `Soul HEX`, `Soul Moodboard`)

#### Frontend UX Flow
1. **Training / Persona Lock (`/soul-intro` -> Character Creator):** Creator uploads **`>= 20` photos** of a person/subject across varied angles and lighting (`POST /custom-references/photo-dump` with `version: "v2"`). A vision helper can auto-name the character from an image (`POST /custom-references/name`). Training runs asynchronously in **~3 minutes** and registers a reusable `custom_reference_id`.
2. **Aesthetic Preset & Color Control:** Instead of prompt engineering, creators select **20+ cultural/editorial presets** (`Editorial`, `Subtle flash`, `Old smartphone`, `Frutiger Aero`, `Y2K`, etc. fetched via `/soul-v2/presets/...`), apply **Soul HEX** (extract palette from any reference photo), or compose a **Soul Moodboard**.
3. **Production Binding (`Soul Cinema` & `Soul Cast`):** Inside Cinema Studio, `Soul Cast` and `Soul Location` let directors define reusable actors (`ethnicity`, `gender`, `age`, `archetype`, `physique`, `hair`, `facial_hair`, `details`, `outfit`) and environments locked across shots via `custom_reference_id` + `custom_reference_strength` (`0.0–1.0`).

#### What Powers It Under the Hood (`hf_js/ad332bb9-FDYhl1_0FBE-8pnp.js`)
Inspecting the frontend API client proves Soul is **not** simple prompt-concatenation or zero-shot IP-Adapter alone:
- Client dispatches versioned training jobs (`OW` map: `"soul-v1": "/custom-references"`, `"soul-v2": "/custom-references/soul-v2"`, `"soul-v2-preset": "/custom-references/soul-v2-preset"`, `"soul-cinematic": "/custom-references/soul-cinematic"`, plus `/custom-references/retrain`).
- Advanced training payload explicitly configures **diffusion LoRA / DreamBooth-style parameters**:
  ```json
  {
    "learning_rate": "...",
    "face_loss_weight": "...",
    "warmup_steps": "...",
    "total_steps": "...",
    "target_area": "targetArea ** 2"
  }
  ```
- Under the hood, this matches a **fast FLUX / SDXL subject-LoRA trainer** (`face_loss_weight` weighting masked face-region reconstruction + InstantID/PuLID-style identity embeddings during generation, controllable via `custom_reference_strength`).
- **Pricing Arbitrage Note:** In Higgsfield Cloud API (`open.higgsfield.ai` / `hf_llms_full.txt`), **Soul ID creation costs `$2.50 / request`**, whereas **Soul 2.0 image generation** is priced at **`$0.0032` (720p) / `$0.0057` (1080p)** vs `Soul Standard` `$0.0938–$0.1875` (`open.higgsfield.ai` uses fast quantized FLUX/Seedream-class inference once the adapter is hot).

---

### 3.3 DoP & Cinema Studio (incl. 4.0) + `3D Jutsu`

Higgsfield's single strongest product moat is turning abstract video diffusion models into a **virtual camera department** (`hf_camera_controls.html`, `hf_cinema_landing.html`, `ad332bb9-DHoC_PfrKYzIty3i.js`, `ad332bb9-s5ma-3QaDDX0WVB1.js`):

#### Exact Camera & Directorial Rig Parameters Exposed in UI & Payload
1. **Camera Rig Quad (`cinematic_studio_image` & `v3.5/v4.0` schemas):**
   - `camera_model_id`: Camera bodies & film stocks (**ARRI Alexa**, **RED V-Raptor**, **Sony Venice**, plus stock modes `modern`, `35mm Film`, `8mm Film`, `DV Camcorder`).
   - `camera_lens_id`: Optical glass profiles (**Panavision Anamorphic / C-Series**, **Helios-44**, **Cooke/Zeiss-style Modern Primes**, **Halation Vintage**, **Warm Vintage**).
   - `camera_focal_length_id`: Discrete prime focal lengths spanning **`14mm` / `18mm` – `35mm` (wide) -> `50mm` – `85mm` (portrait) -> `100mm–135mm+` (telephoto compression)**.
   - `camera_aperture_id`: Depth-of-field stops (**`f/1.4` Wide Open bokeh**, **`f/4` Moderate**, **`f/11` Deep Focus**).
2. **50+ Camera Motion Presets (`hf_camera_controls.html`):**
   Every move is injected as a stackable **`#tag` inside the prompt** so multiple moves execute in sequence within one shot:
   - *Dollies & Zooms:* `Dolly In`, `Dolly Out`, `Dolly Left`, `Dolly Right`, `Super Dolly In`, `Super Dolly Out`, `Double Dolly`, `Dolly Zoom In`, `Dolly Zoom Out`, `Zoom In`, `Zoom Out`, `Crash Zoom In`, `Crash Zoom Out`, `Rapid Zoom In`, `Rapid Zoom Out`, `YoYo Zoom`, `Eating Zoom`
   - *Cranes, Arcs & Orbits:* `Crane Up`, `Crane Down`, `Crane Over The Head`, `Jib up`, `Jib down`, `Arc Left`, `Arc Right`, `360 Orbit`, `3D Rotation`, `Bullet Time`, `Lazy Susan`, `Robo Arm`
   - *POV, Handheld & Dynamic Rigs:* `Snorricam`, `FPV Drone`, `Aerial Pullback`, `Car Chasing`, `Car Grip`, `Road Rush`, `Handheld`, `Head Tracking`, `Hero Cam`, `Object POV`, `Dutch Angle`, `Overhead`, `Pan Left/Right`, `Tilt up/Down`, `Whip Pan`, `Wiggle`, `Focus Change`, `Fisheye`, `Incline`, `Static`
   - *Time & Surreal Effects:* `Hyperlapse`, `Low Shutter`, `Timelapse Glam`, `Timelapse Human`, `Timelapse Landscape`, `Eyes In`, `Mouth In`, `Through Object In`, `Through Object Out`, `Flying Cam Transition`, `BTS`, `Glam`, `Buckle Up`
3. **Cinema Studio 4.0 Layer (Multi-Model Directorial Wrapper):**
   - **6 Story Genres:** `General`, `Action`, `Epic`, `Drama`, `Comedy`, `Horror` (auto-injects genre pacing/physics cues).
   - **Decade Era Scrubber:** Interactive timeline scrubbing `1960`, `1980`, `1990`, `2000`, `2020` to switch stock grain, halation, and color science globally.
   - **Montage Pacing:** `Chaotic`, `Dynamic`, `Calm`, `Single Shot` + `multishot_mode`.
   - **Video Lighting Console & Color Grading:** Dual interactive light setup (`2` lights) + **50+ curated color palettes** + fine color/temperature/contrast tuning.
   - **Acting Console:** **6 emotions × 3 intensity levels** controlling facial performance without rewriting text prompts.
   - **50-Reference & `Elements` Drawer + `Mr. Higgs` Assistant + Real-Time Co-Directing:** Up to 50 asset/element references (IP-checked), `Start/End` frame locking, `Video Extend`, native 4K up to `60s`, engine picker inside Cinema Studio 4.0 (wrapping **`Seedance`** + Higgsfield proprietary DoP models), and `Mr. Higgs` chat copilot for script-to-shot breakdown.
   - **`3D Jutsu` (`wss://3d-scene-builder.higgsfield.ai` + `sparkjs.dev`):** Companion interactive 3D Gaussian-splat / scene-blocking workspace where directors place characters/props in 3D space before rendering consistent multi-angle shots.
   - **Cloud API Token Formula (`higgsfield/cinema-studio/4.0`):** Billed per token: `ceil((input_seconds + gen_seconds) * width * height * 24 / 1024)` at `$0.0214 / 1K` tokens (`480p`/`720p`, `0.6×` discounted when video input is provided -> `$0.01284 / 1K`), equating to `$0.1234–$0.2774/sec`.

---

### 3.4 Genjutsu, Speak (Lip-Sync), Marketing/UGC Studio & Higgsfield Canvas

#### 1. `Higgsfield Genjutsu` & `Genjutsu Light` (`/genjutsu`, `hf_genjutsu_landing.html`)
- **Step-by-Step UX Flow:**
  1. Choose workflow mode: **`Motion Transfer`** (keep camera + subject motion/timing, swap character & world), **`Object Swap`** (replace a specific person, product, or on-screen text while keeping everything else frozen), or **`Restyle`** (re-skin clip aesthetic/wardrobe/grade).
  2. Upload source clip (`1–30s`; `Genjutsu Light` processes up to `15–30s` at `720p/1080p` faster/cheaper).
  3. Attach **up to `30` reference images** (characters, outfits, props, locations) + prompt or preset style.
  4. Generate single pass or **Batch variations** with an interactive before/after split scrubber (`Same take, two realities`).
- **Underlying Architecture & Pricing:** Combines optical flow / pose / depth conditioning + video-to-video mask propagation (`Wan`, `Kling Motion Control`, `Seedance Edit`, SAM segmentation). Priced on `open.higgsfield.ai` at **`$0.154/s` (480p), `$0.3446/s` (720p), `$0.8346/s` (1080p)** (`Genjutsu Light`: **`$0.050–$0.200/s`**).

#### 2. `Speak` / `Lipsync Studio` / `Intone` (`/lipsync-studio`)
- **Step-by-Step UX Flow:** Select or upload portrait/clip -> choose **Voice** (`ElevenLabs v4` / `v4 Turbo` TTS, cloned voice, or upload WAV/MP3) + **Intone / Emotion** preset -> generate frame-accurate lip-sync, video voice-change (`VIDEO_VOICE_CHANGE`), or multi-language video dubbing (`VIDEO_TRANSLATION`). Wraps `ElevenLabs`, `Kling Lipsync`, `VEED Fabric`, `InfiniteTalk`, and `Seedance` audio-video pipes.

#### 3. `Marketing Studio` / `Ads Studio` / `Ad Multiplier` (`/marketing-studio-intro`, `/ads-studio-intro`)
- **Step-by-Step UX Flow:** Paste a **product URL** (`/marketing-studio?tool=url-to-ad`) or upload SKU photos -> auto-scrapes product images/brand copy -> select from **6 commercial formats** (`UGC`, `Product Shot`, `Ads`, `Marketplace`, `Motion`, `Posters`) + **`40+` UGC AI avatars** + **Poster Layers editor** (editable headline, CTA badge, background, and product cutout via `layer-worker.higgsfield.ai`) -> run **`Ad Multiplier`** to blast dozens of creative A/B test variants into campaign folders.

#### 4. `Higgsfield Canvas` (`wss://canvas-worker.higgsfield.ai`) & `Supercomputer`
- **Multiplayer Node Architecture (`ad332bb9-pwY68qsFbGmCKC7N.js`):**
  - **Node Types:** `text`, `prompt`, `stickyNote`, `shape`, `generate` (`image_generation` / `video_generation`), `media` (`image`/`video`/`audio`), `file`, and `table` (`canvas_table_v1` feature flag) + `llm`/`llm_text` & `text2speech_v2`.
  - **Typed Port Graph:** Every node validates `dataType`, `mimeTypes`, and `maxConnections` across `target` (`input`) and `source` (`output`) handles, with real-time WebSocket CRDT/JSON sync (`authSurface: "claudesfield"`!), inline pin comments, and **94+ one-click viral preset recipes**.
  - **Pricing Mechanics:** Editing and dragging nodes is free; clicking `Execute` bills **credits per node run** against the user's monthly credit subscription (never BYOK, never wholesale PAYG).
- **Supercomputer (`/supercomputer`):** Chat/workspace agent backed by `/v1/agent/sessions`, connecting Adobe Photoshop/Premiere, Figma, Blender, DaVinci Resolve plugins, and **Playable** interactive web experiences.

---

### 3.5 `open.higgsfield.ai` (`cloud.higgsfield.ai`) Developer API vs. Consumer Pricing Traps

#### A. Consumer Subscription Traps (`hf_js/ad332bb9-1srxyRlVv3IYfdCq.js`)
Forensic code inside Higgsfield's pricing module exposes the exact consumer retention & upsell playbook:
- **Standard Monthly Tiers (AB-tested via GrowthBook `pricing-ab-test`):**
  - **Starter / Basic:** `$15–$19/mo` (`200–270` credits/mo, selected models)
  - **Plus / Ultimate:** `$49–$59/mo` (`1,000–1,200` credits/mo, all models)
  - **Ultra / Creator:** `$129/mo` (`3,000` credits/mo, up to `6` parallel videos / `8` images + Marketplace "Unlimited" promos)
  - **Max / Scaling Tiers:** Up to `$249/mo` (`6,000` credits/mo) & Enterprise seats.
- **Confirmed Code-Level Traps:**
  1. **Zero Monthly Rollover:** Unused subscription credits vanish on cycle reset.
  2. **Post-Signup Timed Chase Countdown (`offer-config-OhURIzIP`):** `localStorage` keys (`hf:post-subscription-offer:primary-timer`, `last-chance-timer`, `24h` / `10m` urgency windows) immediately push `starter_200_monthly_to_plus_v49_upgrade_bundle`, `plus_1000_monthly_to_ultra_3k_upgrade_bundle`, and `ultra_3k_to_9k_monthly_upgrade`.
  3. **Expiring Credit Packs Gated by Active Plan:** Adjustable credit sliders (`2k -> 32k` credits) carry explicit `expire_days` (typically `90–180` days) and require maintaining an active subscription or grace-period state (`grace_period_modal_viewed`).
  4. **Churnkey Interception:** Clicking Cancel triggers `api.churnkey.co` discount/pause deflection walls before Stripe cancellation completes.

#### B. Open Higgsfield Cloud API (`open.higgsfield.ai` / `api.higgsfield.ai`) — Aggressive Loss-Leader Wrapper
Simultaneously, Higgsfield runs `open.higgsfield.ai` (`34+` video/image endpoints) as a **Fal.ai & Replicate developer wedge**:
- **REST & Auth Spec (`quick-start-DrV7bolT.js`):**
  - **Auth:** `Authorization: Key <api-key>` (no prefix duplication in UI field; separate **USD wallet**, 1-year expiration, **separate from consumer credits!**).
  - **Lifecycle:**
    1. Upload ref: `POST https://api.higgsfield.ai/files/generate-upload-url` (`{"content_type": "image/png"}`) -> browser `PUT`s directly to R2/S3 `upload_url` using returned `upload_headers` -> gets `public_url`.
    2. Submit: `POST https://api.higgsfield.ai/<model-path>` (optional `hf_webhook` URL + secret) -> returns `{ request_id, status_url, cancel_url }`.
    3. Poll: `GET https://api.higgsfield.ai/requests/<request_id>/status` -> states: `queued`, `in_progress`, terminal `completed` (`images[].url` / `video.url`), `failed`, `nsfw`, `canceled`.
    4. Cancel: `POST https://api.higgsfield.ai/requests/<request_id>/cancel` (server cancel required; closing client doesn't stop billing).
- **Verified Model Catalog Pricing vs. Fal.ai & Sume (Observed `open_hf_pricing.html` [as of Sep 16, 2026] & `sume_api_pricing_text.txt`):**

| Model & Mode | Higgsfield API (`open.higgsfield.ai`) | Fal.ai Benchmark (on HF page) | Sume API (`0% Markup`) | Analysis / Takeaway |
| :--- | :--- | :--- | :--- | :--- |
| **Kling 3.0 Standard (I2V)** | **`$0.0714 / s`** (`-43.3%`) | `$0.126 / s` | N/A (`3.0 Pro` `$0.112–$0.168/s`) | HF subsidizes or has volume rebate below Fal list |
| **Kling 3.0 Pro (T2V / I2V)** | **`$0.0962 / s`** (`-42.7%`) | `$0.168 / s` | `$0.112–$0.168 / s` (`v3 Pro`) | Major HF loss-leader + up to `50%` cashback/discount promos |
| **Kling 3.0 Turbo (1080p)** | **`$0.105 / s`** (`-25.1%`) | `$0.140 / s` | `$0.140 / s` (`$0.112` `720p`) | Sume tracks standard list; HF undercuts via promos |
| **Kling 3.0 4K (T2V / I2V)** | **`$0.3151 / s`** (`-25.0%`) | `$0.420 / s` | — | Same 25% promo undercut |
| **Seedance 2.5 (480p T2V/I2V)** | **`$0.118 / s`** (`-43.1%`) | `$0.207 / s` | **`$0.1028 / s`** (`$0.231` `720p`, `$0.569` `1080p`) | **Sume actually beats HF on Seedance 2.5 (`$0.1028` vs `$0.118`)!** |
| **Seedance 2.5 (480p Ref/Edit/Ext)** | **`$0.139 / s`** (`-44.1%`) | `$0.248 / s` | `$0.1028 / s` base | HF beats Fal heavily via `30%` max discount / `100% cashback` |
| **Seedance 2.0 (480p T2V/I2V)** | **`$0.080 / s`** (`-42.9%`) | `$0.141 / s` | **`$0.070308 / s`** | Again Sume tracks raw ByteDance maker rate below HF! |
| **Wan 3.0 / Wan 3.0 Prime** | `from $0.038 / s` / `$0.051 / s` | — | `$0.050–$0.200 / s` / `$0.068–$0.280 / s` | Both aggressive on Wan 3.0 |
| **MiniMax H3 (2K) / Happy Horse 1.1 (1080p)** | `$0.130 / s` / `$0.180 / s` | `$0.130 / s` / `$0.180 / s` | `$0.130 / s` / `$0.180 / s` | All three converge identically at maker rate |
| **Genjutsu / Remix (480p / 720p / 1080p)** | **`$0.154 / $0.345 / $0.835 / s`** (or `50%` off promos) | Proprietary to HF | **`$0.123 / $0.2765 / $0.6804 / s`** (Lite `$0.10–$0.40/s`) | Sume undercuts HF API list by ~20% on Remix! |
| **Cinema Studio 4.0 / Director Studio 1.0** | `$0.1234–$0.2774/s` (`$0.0214/1K` tok) | Proprietary to HF | `$0.10285 / $0.23115 / $0.5686 / s` (Seedance 2.5) | Completely different underlying billing models |
| **Soul ID Creation / Soul 2.0** | `$2.50 / train req`; `$0.0032–$0.0057 / img` | Proprietary to HF | `Director Cast $0.154–$0.304/img` (no custom LoRA) | Self-hosted `ai-toolkit` H100 LoRA costs `~$0.16` (`15×` cheaper) |

> **Cashback Hook (`billing-C7yeVWil.js`):** Note how `open.higgsfield.ai` tracks two separate sub-balances: `credit_balance` and `cashback_balance` (`100% cashback` welcome offer). Cashback promo dollars carry their own `expiration` transaction (`tx_usage_cashback` vs `expiration`) to drive rapid API volume before reverting users to list rates or `credit_balance` top-ups!

---

## 4. The "Beat Both" Product & UX Blueprint for `Open-DreamFlow Next`

Open-DreamFlow already possesses a high-craft foundation observed directly in [App.tsx](file:///Users/seba/Documents/antigravity/clever-mendel/open-dreamflow/apps/web-studio/src/App.tsx), [index.css](file:///Users/seba/Documents/antigravity/clever-mendel/open-dreamflow/apps/web-studio/src/index.css), [DreaminaFloatingChrome.tsx](file:///Users/seba/Documents/antigravity/clever-mendel/open-dreamflow/apps/web-studio/src/components/DreaminaFloatingChrome.tsx), [ContextualNodeOverlay.tsx](file:///Users/seba/Documents/antigravity/clever-mendel/open-dreamflow/apps/web-studio/src/components/ContextualNodeOverlay.tsx), [ProviderModal.tsx](file:///Users/seba/Documents/antigravity/clever-mendel/open-dreamflow/apps/web-studio/src/components/ProviderModal.tsx), [studio.ts](file:///Users/seba/Documents/antigravity/clever-mendel/open-dreamflow/apps/web-studio/src/types/studio.ts), [platforms.ts](file:///Users/seba/Documents/antigravity/clever-mendel/open-dreamflow/packages/provider-sdk/src/platforms.ts), and [higgsfield.ts](file:///Users/seba/Documents/antigravity/clever-mendel/open-dreamflow/packages/provider-sdk/src/providers/higgsfield.ts).

To **decisively obsolete both Higgsfield's expiring-subscription silo wrapper AND Sume's flat single-turn prepaid wrapper**, **Open-DreamFlow Next** elevates five concrete UX & product pillars:

---

### 4.1 Pillar 1: Unified Matte Charcoal Spatial DAG (`#0E0E0E` + `#20D5EC` Continuity)

Whereas Sume breaks workflows into 6 single-turn tabs (`/images`, `/videos`, `/audio`, `/images/relight`, `/videos/genjutsu`, `/generate`) and Higgsfield forces you to switch between `Cinema Studio`, `Soul`, `Genjutsu`, `Speak`, and `Canvas`, **Open-DreamFlow Next** executes everything on **one continuous spatial canvas**:

```
┌─────────────────────────── Open-DreamFlow Next Spatial Studio (#0E0E0E) ───────────────────────────┐
│ Top Chrome: [Project Switcher ▾] [Search ⌘K]  │  [9-Grid] [Timeline] [Connections: 8 Live] [Share] │
├─────┬──────────────────────────────────────────────────────────────────────────────────────────────┤
│ L   │   ┌───────────────────────┐        #20D5EC        ┌───────────────────────────────────┐      │
│ e   │   │ @Element: Hero Actor  │──────────────────────▶│ Shot 1 Keyframe (Soul / Seedream) │      │
│ f   │   │ PuLID-FLUX / LoRA ID  │                       │  ↑ Hover Bar: Save@Ref | Relight  │      │
│ t   │   └───────────────────────┘                       │    | Inpaint | Cutout | → Video   │      │
│     │                                                   └─────────────────┬─────────────────┘      │
│ D   │   ┌───────────────────────┐                                         │ #20D5EC Frame Port      │
│ o   │   │ 3D Optical DoP Rig    │─────────────────────────────────────────┼─────────────────┐      │
│ c   │   │ ARRI 35mm · f/1.4     │                                         ▼                 ▼      │
│ k   │   │ Az 32° El 18° #dolly  │                       ┌───────────────────────────────────────┐  │
│     │   └───────────────────────┘                       │ Shot 1 Video (Seedance / Kling / Wan) │  │
│ T   │                                                   │ [480p Draft $0.10/s] -> [1080p Finish]│  │
│ e   │   ┌───────────────────────┐                       │  Action: [Last Frame → Next Shot] ───┐│  │
│ x   │   │ Audio / LipSync Node  │──────────────────────▶└──────────────────────────────────────┼┘  │
│ t   │   │ ElevenLabs / LatentS. │                                                              ▼   │
│ Img │   └───────────────────────┘                       ┌───────────────────────────────────────┐  │
│ Vid │                                                   │ Shot 2 Video (Connected Last Frame)   │  │
│ Aud │                                                   └──────────────────┬────────────────────┘  │
│ Ref │                                                                      ▼                       │
│ DoP │   ╔═══════════════════════════════════════════════════════════════════════════════════════╗  │
│     │   ║ Unified Bottom Creation Dock (688px, ContextualNodeOverlay):                          ║  │
│ Tim │   ║ [Where: Open-DreamFlow Cloud | Higgsfield | Sume | Kling | Dreamina ▾] [Model ▾]     ║  │
│     │   ║ [Aspect] [Res] [Dur] [Camera Motion DoP ▾] [Draft 480p] [⚡ Generate · ~$0.41 / BYOK] ║  │
│     │   ╚═══════════════════════════════════════════════════════════════════════════════════════╝  │
└─────┴──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Why this beats both:**
- **Over Sume:** Keeps Sume's instant penny quote on the CTA (`Generate ~$0.41` or `FREE via Kling Bridge`), keeps the `480p Draft -> 1080p Finish` saver, *and* lets every output node chain straight into `Inpaint`, `Expand`, `Relight`, `→ Create Video`, `Last Frame → Next Shot`, `Genjutsu Swap`, `LipSync`, and multi-track `Timeline` (`FFmpeg` MP4 compile) without leaving the shot context.
- **Over Higgsfield:** Eliminates paywalled silo navigation while upgrading Canvas with **one-click `Last Frame → Next Shot`** and **Shareable Recipe Apps (`?recipe=`)** so any DAG becomes an interactive end-user form in 1 click.

---

### 4.2 Pillar 2: 1-Click Guided Connections Hub (`Stage 8+`) & WebMCP Piggybacking

In `ProviderModal.tsx`, manual instructions (`chrome://extensions`, Developer Mode toggles, copying disk paths, pasting `import(...)` into DevTools) stop non-technical creators cold. **Open-DreamFlow Next** replaces setup friction with a **3-tier zero-friction onboarding flow**:

1. **Tier A — 1-Click Pre-Bridged Creator Browser (0 API Keys Required):**
   - Hero button **`Launch Connected Creator Browser`** (`POST /api/connections/launch-browser` on `:3001`) launches an isolated Chromium/Chrome profile pre-loaded with `--load-extension=extensions/chrome-bridge` (`v1.2.0`) across **8 supported domains** (`higgsfield.ai`, `sume.com`, `dreamina.capcut.com`, `flow.google`, `app.klingai.com`, `elevenlabs.io`, `openart.ai`, `imagine.art`).
   - **Per-Platform Live Status Cards:** Shows live `✓ Signed In` / `Sign In Now →` pill + `Re-check` polling (`GET /api/connections/status`).
   - **WebMCP Zero-Fragility Discovery (`higgsfield.ai` insight!):** Because our JS reverse-engineering discovered that Higgsfield itself registers **W3C `document.modelContext.registerTool` (`get_cinema_video_draft`, `configure_cinema_video`, `submit_cinema_video`, etc.)** right in the page DOM, our Chrome Bridge can prefer **official WebMCP tool calls** on supported tabs instead of fragile CSS DOM scraping!
2. **Tier B — `$0` Markup Official API Key Cards (BYOK):**
   - Clean step-by-step cards with direct **`Get <Platform> API Key ↗`** links, 1-click `Paste`, `Save & Verify` (encrypted via AWS KMS envelope encryption in cloud mode or local vault in desktop mode), supporting `Higgsfield Cloud`, `Sume`, `Google Gemini/Veo`, `BytePlus Seedance/Seedream`, `Kling`, `OpenAI`, `ElevenLabs`, `Fal`, `Replicate`, `ComfyUI`.
3. **Tier C — 1-Click MCP Presets + Cloud Wallet Fallback:**
   - Instant presets (`ElevenLabs Voice & SFX MCP`, `Playwright Browser MCP`, `Fal / Replicate MCP`) hiding raw `stdio` args behind `"Advanced Config"`, plus a 1-click **`$5` Cloud Wallet Top-Up** for users with zero external accounts.

---

### 4.3 Pillar 3: Soul ID Continuity Vault (`@Element` -> Multi-Provider Identity Locker)

Instead of locking identity inside Higgsfield's `$2.50/train` proprietary endpoint or lacking face-LoRA altogether like Sume, Open-DreamFlow unifies identity as **portable canvas objects**:

| Feature | Instant Zero-Wait Mode (`PuLID-FLUX` / `FLUX Kontext`) | Fast Studio LoRA Mode (`ai-toolkit` on H100) |
| :--- | :--- | :--- |
| **Input & Latency** | `1–4` photos · **Zero training wait (`<7s` inference)** | `10–20` photos · **`2–4 min` background training** (H100 FP8) |
| **Unit Economics** | **`~$0.008 / keyframe`** (vs HF Soul Standard `$0.094+`) | **`~$0.16 / training run`** (vs HF Cloud API **`$2.50`**, `15.6×` cheaper!) |
| **UX Controls** | `@ActorName` drag-into-prompt chip + Identity Strength slider (`0.4–1.0`) + **Hex LUT Extractor** (Soul HEX clone) + **Moodboard Board** | Same `@ActorName` token + Character Sheet `9-Grid` auto-generator (front/3-4/profile/back + 3 outfits) + IP/Face-consistency Drift Score |
| **Portability** | Works identically across **Seedream 5.5, GPT Image 2.6, Nano Banana 2.1, Kling 4.0, Seedance 2.5, Wan 3.0, and Veo 3.1** (as multi-ref image lock or LoRA checkpoint) | Exports weights or renders multi-angle keyframe plates usable inside *any* downstream video provider (even BYOK Kling / Dreamina / Flow!) |

---

### 4.4 Pillar 4: True 3D Optical DoP Camera Rig (`CameraDirector3DModal` Next)

Upgrading Open-DreamFlow's existing interactive Canvas 3D Camera Director ([DreaminaFloatingChrome.tsx#L1314-L1567](file:///Users/seba/Documents/antigravity/clever-mendel/open-dreamflow/apps/web-studio/src/components/DreaminaFloatingChrome.tsx#L1314-L1567)) from a text-prompt injector into a **dual-output physical camera engine**:

1. **Interactive 3D Stage (`WebGL` / `Canvas2D` Orbit + Path Keyframes):**
   - Drag to orbit **`Azimuth (-180°..+180°)`**, **`Elevation (-35°..+70°)`**, **`Roll (Dutch)`**, and **Camera Start -> Camera End Path Spline** (`Dolly`, `Arc`, `Crane`, `FPV`, `Orbit`, `Bullet Time`).
   - **Virtual Cinema Gear Picker (Parity + Expansion):**
     - **Body / Stock:** `ARRI Alexa 35`, `RED V-Raptor`, `Sony Venice 2`, `35mm Kodak Vision3`, `8mm Film`, `DV Camcorder`.
     - **Optical Glass:** `Clean Cinema Prime`, `Panavision C-Series Anamorphic`, `Vintage Anamorphic`, `Helios-44 Swirly`, `Halation Bloom`.
     - **Focal Length & Aperture:** `14mm / 16mm / 24mm / 35mm / 50mm / 85mm / 135mm` + `f/1.4`, `f/4.0`, `f/11` (live DoF frustum preview in the 3D stage!).
     - **Environmental & Performance Sub-Rails:** Decade LUT (`1960s–2020s`), **2-Point Relight Spherical Control** (merging Sume `/images/relight` & HF Video Lighting Console), and **Acting Emotion × Intensity** chips.
2. **Dual Compiler Output (Why Open-DreamFlow Beats Prompt-Only Wrappers):**
   - **Path A (Proprietary Cloud Models — `Seedance 2.5`, `Kling 4.0`, `Veo 3.1`, `Higgsfield`, `Sume`):** Automatically compiles calibrated optical descriptors + sequential `#tags` (`#super-dolly-in #rack-focus #35mm-anamorphic-f1.4`) into the target node's prompt/API fields.
   - **Path B (Self-Hosted GPU / `CameraCtrl` + `Wan 2.2/2.6 14B FP8`):** Exports exact **4×4 extrinsic `[R|t]` trajectory matrices -> Plucker coordinate embeddings** (`~$0.06` / 5s 720p clip on H100!) giving **true geometric 3D camera obedience** rather than stochastic prompt guessing.

---

### 4.5 Pillar 5: Hybrid Dual-Credit Engine & Anti-Lock-In FinTech Design

| Credit Mode | Target User | Fee / Pricing Structure | Concurrency & Rollover | Stripe & Ledger Mechanics |
| :--- | :--- | :--- | :--- | :--- |
| **Mode 1: Free BYOK / Chrome Bridge / MCP** | Power users, agencies with existing subs (Higgsfield, Dreamina, Kling, Flow, OpenAI, ElevenLabs), local ComfyUI rigs | **$0/mo · 0% Open-DreamFlow markup** (billed directly by your connected provider or existing subscription) | **Multi-provider pooled concurrency** across every linked Chrome tab, MCP server & API key | Zero wallet deposit needed; BYOK secrets protected via AWS KMS envelope encryption |
| **Mode 2: 1-Click `$5` Zero-Trap Cloud Wallet** | Instant-start creators, API/team buyers who want 1-click zero-API-key generation across `50+` models + self-hosted Soul/DoP GPUs | **`$5` min top-up, `$0` subscription**, wholesale-pass-through or **`15–35%` blended wholesale/H100 spread** while still **under-cutting HF consumer plans & matching/beating Sume on H100 workflows** | **No predatory 2-job cripple** on starter loads; seamless `HOLD -> CAPTURE / RELEASE` microcent (`BIGINT`) atomic wallet; auto-refund 100% on provider fail/cancel | Absorb Stripe fees cleanly on `$15+` reloads (or show net/zero-trap fee disclosure); **no 90-day traps, no Churnkey cancel maze, no fake countdown bundles** |
| **Smart Cost Arbitrage Router** | Automatic on all Cloud nodes (opt-in on BYOK) | Live **`Draft 480p` -> `Finish 1080p`** toggle + **Live Button Price (`Generate $0.08` vs `Free via Bridge`)** | Picks lowest-cost healthy route across **BytePlus ModelArk, Vertex AI, Kling Direct, Fal/OpenHF, or Modal/CoreWeave H100** | Real-time SSE (`EventSource`) status + Cloudflare R2 **`$0.00` egress** (`94%` bandwidth savings vs S3 per [scale-infrastructure-blueprint.md](file:///Users/seba/Documents/antigravity/clever-mendel/open-dreamflow/docs/scale-infrastructure-blueprint.md)) |

---

### 4.6 Strategic Execution Summary: How Open-DreamFlow Wins

1. **Steal Sume's Trust Weapons (Day 1):** Zero monthly lock-in, `$5` pay-as-you-go Cloud entry, exact penny quote right on the `Generate` button, automatic failed-job refunds, and `480p Draft -> 1080p Finish` previewing.
2. **Match & Deepen Higgsfield's Directorial Magic (Week 1–3):** Full **3D Optical DoP Console** (real `[R|t]` Plucker extrinsics + `#tag` compiler), **Soul ID Continuity Vault** (`<7s` `PuLID-FLUX` `$0.008` + `2–4m` H100 LoRA `$0.16`), node-wired **Genjutsu / Relight / LipSync / Poster Layers**, and **WebMCP browser tool execution**.
3. **Win on What Neither Competitor Can Ship:** **One unified Spatial Continuity DAG** where *every* user's **existing external credits (BYOK + Chrome Session + MCP)** run free at **0% fee** alongside an optional **Zero-Trap Cloud Wallet**—turning `Higgsfield.ai` and `Sume.com` from competitors into **connectable worker nodes** inside Open-DreamFlow.
