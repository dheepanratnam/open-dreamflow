# Open-DreamFlow Universal Creator Credit Bridge (`v1.1.0`, Manifest V3)

Zero-markup Chrome Extension bridging **Open-DreamFlow Studio** (`http://localhost:8789` & `ws://localhost:3001/bridge`) directly to your signed-in creator subscriptions across **7 platforms**:

1. **Higgsfield** (`https://higgsfield.ai/*`) — ChatGPT Image 2.6, Higgsfield Soul, Flux.1 Pro, Seedream 5.0, DoP I2V, Wan 2.6, Kling 4.0.
2. **Kling AI** (`https://app.klingai.com/*`, `https://klingai.com/*`) — Kling 4.0, Kling 3.0 Master, Kling 2.6 Pro, Multi-Element Ref, Kolors 2.0.
3. **Dreamina / Seedance** (`https://dreamina.capcut.com/*`, `https://jimeng.jianying.com/*`) — Seedream 5.0 Pro/Lite, Seedance 2.5/2.0, 2–10 Multi-Frame keyframes.
4. **Google Flow** (`https://labs.google/*`, `https://flow.google.com/*`) — Veo 3.1, Imagen 4, Nano Banana 2 (`@Element` Ingredient injection).
5. **OpenArt** (`https://openart.ai/*`) — ChatGPT Image 2.6, Photoreal, Flux Dev, Kling 4.0, Wan 2.6.
6. **ImagineArt** (`https://imagine.art/*`) — Imagine v2, Flux Realism, Ideogram 3, Hailuo 02.
7. **ElevenLabs** (`https://elevenlabs.io/*`) — Multilingual v2 TTS, Sound Effects v2, Flash v2.5 `<audio>` capture.

Supports **Cross-Platform Chained Reference Forwarding**: upstream canvas images (`/media/*` or `data:image/...`) are automatically converted into `File` objects via `DataTransfer` and injected into `<input type="file">` on the target creator platform.

## Installation (Developer Mode)
1. Open `chrome://extensions` in Chrome, Arc, Brave, or Edge.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select `extensions/chrome-bridge/`.
4. Sign in to any of the 7 creator platforms in normal browser tabs and select **Browser Credits** on your Open-DreamFlow canvas nodes!
