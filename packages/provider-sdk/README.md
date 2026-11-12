# `@open-dreamflow/provider-sdk`

Zero-Markup TypeScript BYOK & Local GPU Provider SDK for **Open-DreamFlow**.

All requests go straight from your browser or local Node runtime to the model endpoint with **0% wrapper markup** and **zero runtime dependencies**.

## Included Adapters

1. **`GeminiOmniClient` (`src/gemini-omni.ts`)**
   - Full client for `POST https://generativelanguage.googleapis.com/v1beta/interactions` (`gemini-omni-1.2-flash`)
   - **3s–15s** variable shot duration, **360p draft → stateful 4K upscale**, up to **6 `@Element` reference images** (`inline_data`), **First/Last Frame keyframing**, **10-second prior context window**, and **stateful multi-turn video editing** (`previous_interaction_id`).
2. **`SeedanceClient` (`src/seedance.ts`)**
   - Multi-frame (**2–10 keyframes**) sequence synthesis, **Smart Inpainting**, **Smart Outpainting**, and **9-Grid Contact Sheet (`3x3`) & 4-Angle Coverage (`2x2`)** with normalized crop boxes.
3. **`FalClient` & `ReplicateClient` (`src/fal-replicate.ts`)**
   - Zero-markup pass-through adapters for **Wan 2.1**, **LTX-Video**, **HunyuanVideo**, and **BiRefNet v2**.
4. **`ComfyUIClient` (`src/comfyui.ts`)**
   - Local GPU execution (`http://127.0.0.1:8188` + WS progress) for **Wan 2.1**, **LTX-Video**, and **HunyuanVideo** at **$0.00** API cost.
