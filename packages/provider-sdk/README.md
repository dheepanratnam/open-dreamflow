# `@open-dreamflow/provider-sdk` (`v1.1.0`)

Universal 12-Platform Creator Catalog & Zero-Markup TypeScript BYOK / Local GPU Provider SDK for **Open-DreamFlow**.

All requests go straight from your browser or local Node runtime to the target platform with **0% wrapper markup** and **zero runtime dependencies**.

## 12-Platform Catalog (`PLATFORM_CATALOG` in `src/platforms.ts`)
Covers **Higgsfield**, **Kling AI**, **Dreamina**, **Google Flow**, **OpenArt**, **ImagineArt**, **ElevenLabs**, **OpenAI**, **Fal.ai**, **Replicate**, **ComfyUI (Local)**, and **Custom External MCP Servers**, with modality-filtered image, video, and audio models and cross-platform reference forwarding.

## Zero-Markup Direct Adapters
1. **`KlingClient` (`src/providers/kling.ts`)** — Official Kling API (`api.klingai.com/v1`) with HS256 JWT signing (`accessKey` + `secretKey`) or Bearer auth (`kling-4.0`, `kling-3.0-master`, `kling-2.6-pro`, `kling-elements`, `kolors-2.0`, `kling-image-o1`).
2. **`ElevenLabsClient` (`src/providers/elevenlabs.ts`)** — Multilingual v2 TTS, Flash v2.5, and Text-to-Sound Effects v2 (`eleven_multilingual_v2`, `eleven_text_to_sound_v2`, `eleven_flash_v2_5`) returning raw MP3 bytes.
3. **`OpenAIClient` (`src/providers/openai.ts`)** — `gpt-image-1` (generation + reference image edits) and `sora-2` video generation.
4. **`HiggsfieldClient` (`src/providers/higgsfield.ts`)** — Direct Higgsfield Cloud API client (`chatgpt-image-2.6`, `higgsfield-soul`, `flux-1-pro`, `seedream-5.0`, `higgsfield-dop-i2v`, `wan-2.6`, `kling-4.0-hf`).
5. **`GeminiOmniClient` (`src/gemini-omni.ts`)** — Google Gemini / Flow (`imagen-4.0-generate-001`, `gemini-3.1-flash-image-preview`, `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview`, `gemini-omni-1.2-flash`).
6. **`SeedanceClient` (`src/seedance.ts`)** — BytePlus Seedream (`seedream-5.0-pro`, `seedream-5.0-lite`, `seedream-4.5`) & Seedance (`seedance-2.5`, `seedance-2.0`).
7. **`FalClient` & `ReplicateClient` (`src/fal-replicate.ts`)** — Zero-markup pass-through adapters for Flux, Recraft v3, Kling v2 Master, Veo 3, Wan, and BiRefNet.
8. **`ComfyUIClient` (`src/comfyui.ts`)** — Local GPU execution (`http://127.0.0.1:8188`) at **$0.00** API cost.
