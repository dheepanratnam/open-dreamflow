/**
 * Open-DreamFlow Chrome Bridge — Multi-Platform Universal Credit Driver (`content-universal.js`)
 *
 * Drives live consumer browser sessions across 5 creator platforms (alongside
 * `content-dreamina.js` and `content-flow.js` for all 7 platforms):
 *   - Higgsfield (`higgsfield.ai`) — ChatGPT Image 2.6, Soul, Flux.1 Pro, Seedream 5.0, DoP I2V, Wan 2.6, Kling 4.0
 *   - Kling AI (`app.klingai.com`, `klingai.com`) — Kling 4.0, 3.0 Master, 2.6 Pro, Multi-Element, Kolors 2.0
 *   - OpenArt (`openart.ai`) — ChatGPT Image 2.6, Photoreal, Flux Dev, Kling 4.0, Wan 2.6
 *   - ImagineArt (`imagine.art`) — Imagine v2, Flux Realism, Ideogram 3, Hailuo 02
 *   - ElevenLabs (`elevenlabs.io`) — Multilingual v2 TTS, Sound Effects v2, Flash v2.5
 *
 * Supports cross-platform Chained Reference Image Injection (`job.referenceImages` ->
 * `DataTransfer` -> `<input type="file">`), turning upstream canvas outputs (e.g. a
 * Higgsfield `chatgpt-image-2.6` render) into authentic `File` uploads on downstream
 * platforms (e.g. Kling AI `kling-4.0` Start Frame / Multi-Element input).
 */

(function initUniversalCreatorBridge() {
  const host = window.location.hostname.toLowerCase();

  function detectPlatform() {
    if (host === 'higgsfield.ai' || host.endsWith('.higgsfield.ai')) return 'higgsfield';
    if (host === 'klingai.com' || host.endsWith('.klingai.com')) return 'kling';
    if (host === 'openart.ai' || host.endsWith('.openart.ai')) return 'openart';
    if (host === 'imagine.art' || host.endsWith('.imagine.art')) return 'imagineart';
    if (host === 'elevenlabs.io' || host.endsWith('.elevenlabs.io')) return 'elevenlabs';
    return null;
  }

  const TARGET = detectPlatform();
  if (!TARGET) return;

  const PLATFORM_CONFIG = {
    higgsfield: {
      label: 'Higgsfield',
      cdnRegex: /higgsfield|cloudfront|r2\.dev|amazonaws|supabase|replicate|fal\.media/i,
      promptSelectors: [
        'textarea[placeholder*="Describe" i]',
        'textarea[placeholder*="prompt" i]',
        'textarea[placeholder*="imagine" i]',
        '.ProseMirror[contenteditable="true"]',
        '[contenteditable="true"][role="textbox"]',
        'textarea:not([disabled])',
      ],
      uploadTriggerRegex: /upload|reference|start frame|first frame|image|character/i,
      generateRegex: /generate|create|animate|render/i,
    },
    kling: {
      label: 'Kling AI',
      cdnRegex: /kwaicdn|klingai|kwai|yximgs|ksyun|cloudfront|alicdn/i,
      promptSelectors: [
        'textarea[placeholder*="prompt" i]',
        'textarea[placeholder*="Describe" i]',
        'textarea[placeholder*="创意" i]',
        'textarea[placeholder*="描述" i]',
        '.ProseMirror[contenteditable="true"]',
        '[contenteditable="true"][role="textbox"]',
        'textarea:not([disabled])',
      ],
      uploadTriggerRegex: /upload|frame|reference|element|image|上传|首帧|参考/i,
      generateRegex: /generate|create|立即生成|生成/i,
    },
    openart: {
      label: 'OpenArt',
      cdnRegex: /openart|cloudfront|amazonaws|r2\.dev|googleapis/i,
      promptSelectors: [
        'textarea[placeholder*="prompt" i]',
        'textarea[placeholder*="Describe" i]',
        'textarea[placeholder*="create" i]',
        '.ProseMirror[contenteditable="true"]',
        '[contenteditable="true"][role="textbox"]',
        'textarea:not([disabled])',
      ],
      uploadTriggerRegex: /upload|reference|image|start frame/i,
      generateRegex: /create|generate|render/i,
    },
    imagineart: {
      label: 'ImagineArt',
      cdnRegex: /imagine\.art|vyro|cloudfront|amazonaws|r2\.dev|googleapis/i,
      promptSelectors: [
        'textarea[placeholder*="Describe" i]',
        'textarea[placeholder*="prompt" i]',
        'textarea[placeholder*="imagine" i]',
        '.ProseMirror[contenteditable="true"]',
        '[contenteditable="true"][role="textbox"]',
        'textarea:not([disabled])',
      ],
      uploadTriggerRegex: /upload|reference|image|frame/i,
      generateRegex: /generate|create/i,
    },
    elevenlabs: {
      label: 'ElevenLabs',
      cdnRegex: /elevenlabs|googleapis|cloudfront|blob:/i,
      promptSelectors: [
        'textarea[placeholder*="Start typing" i]',
        'textarea[placeholder*="Describe" i]',
        'textarea[placeholder*="sound" i]',
        'textarea[placeholder*="text" i]',
        '.ProseMirror[contenteditable="true"]',
        '[contenteditable="true"][role="textbox"]',
        'textarea:not([disabled])',
      ],
      uploadTriggerRegex: /upload|sample|reference/i,
      generateRegex: /generate|create|speak|synthesize/i,
    },
  }[TARGET];

  function registerSession() {
    try {
      chrome.runtime.sendMessage({
        type: 'TARGET_REGISTER',
        target: TARGET,
        url: window.location.href,
      });
    } catch {
      // Ignore service worker wake-up transitions
    }
  }

  registerSession();
  setInterval(registerSession, 25000);

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function escapeHtml(raw) {
    return String(raw)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function isVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number(style.opacity) === 0
    ) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 8 && rect.height > 8;
  }

  function dataUrlToFile(dataUrl, filename) {
    const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/i.exec(dataUrl);
    if (!match) return null;
    const mimeType = (match[1] || 'image/png').trim();
    const byteChars = atob(match[2]);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i += 1) {
      bytes[i] = byteChars.charCodeAt(i);
    }
    const ext = (mimeType.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
    const finalName = filename || `reference.${ext}`;
    return new File([bytes], finalName, { type: mimeType });
  }

  async function resolveReferenceFile(refItem, index) {
    const rawSource =
      typeof refItem === 'string'
        ? refItem
        : refItem?.dataUrl || refItem?.imageUrl || refItem?.image || refItem?.url || '';
    if (!rawSource) return null;

    if (rawSource.startsWith('data:')) {
      const parsed = dataUrlToFile(rawSource, `reference_${index + 1}.png`);
      if (parsed) return parsed;
    }

    try {
      const response = await fetch(rawSource);
      if (response.ok) {
        const blob = await response.blob();
        const ext = (blob.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
        return new File([blob], `reference_${index + 1}.${ext}`, {
          type: blob.type || 'image/png',
        });
      }
    } catch {
      // Fallback to MV3 background fetch when page CSP blocks localhost or cross-origin URLs
    }

    try {
      const bgResult = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'FETCH_REFERENCE_DATA_URL', url: rawSource },
          (res) => {
            if (chrome.runtime.lastError) {
              resolve(null);
              return;
            }
            resolve(res);
          }
        );
      });
      if (bgResult && bgResult.ok && typeof bgResult.dataUrl === 'string') {
        return dataUrlToFile(bgResult.dataUrl, `reference_${index + 1}.png`);
      }
    } catch {
      // Ignore
    }

    return null;
  }

  /**
   * Injects upstream reference images / keyframes into `<input type="file">` via `DataTransfer`.
   */
  async function injectReferenceImages(job) {
    const combined = [
      ...(Array.isArray(job.keyframes) ? job.keyframes : []),
      ...(Array.isArray(job.referenceImages) ? job.referenceImages : []),
    ].slice(0, 8);

    if (combined.length === 0) return 0;

    const files = [];
    for (let i = 0; i < combined.length; i += 1) {
      const file = await resolveReferenceFile(combined[i], i);
      if (file) files.push(file);
    }
    if (files.length === 0) return 0;

    let fileInput = /** @type {HTMLInputElement | null} */ (
      document.querySelector(
        'input[type="file"][accept*="image"], input[type="file"][multiple], input[type="file"]'
      )
    );

    // Some creator UIs lazily mount `<input type="file">` after clicking a frame/reference slot
    if (!fileInput) {
      const triggerCandidates = Array.from(
        document.querySelectorAll('button, [role="button"], label, div[class*="upload" i]')
      ).filter(isVisible);
      const trigger = triggerCandidates.find((el) => {
        const text = `${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`.trim();
        return PLATFORM_CONFIG.uploadTriggerRegex.test(text);
      });
      if (trigger instanceof HTMLElement) {
        trigger.click();
        await sleep(450);
        fileInput = /** @type {HTMLInputElement | null} */ (
          document.querySelector(
            'input[type="file"][accept*="image"], input[type="file"][multiple], input[type="file"]'
          )
        );
      }
    }

    const dt = new DataTransfer();
    for (const file of files) {
      dt.items.add(file);
    }

    if (fileInput) {
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('input', { bubbles: true }));
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      return files.length;
    }

    const dropZone =
      document.querySelector(
        '[class*="upload" i], [class*="drop" i], [class*="frame" i], [role="textbox"]'
      ) || document.body;
    dropZone.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      })
    );
    return files.length;
  }

  function findPromptComposer() {
    for (const selector of PLATFORM_CONFIG.promptSelectors) {
      const matches = Array.from(document.querySelectorAll(selector));
      const visible = matches.find(isVisible);
      if (visible instanceof HTMLElement) return visible;
    }
    const fallbackEditable = Array.from(
      document.querySelectorAll('div[contenteditable="true"]')
    ).find(isVisible);
    return fallbackEditable instanceof HTMLElement ? fallbackEditable : null;
  }

  function injectPrompt(editor, promptText) {
    if (!editor) return false;
    editor.focus();

    if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
      const proto =
        editor instanceof HTMLTextAreaElement
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(editor, promptText);
      } else {
        editor.value = promptText;
      }
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      document.execCommand('selectAll', false);
      document.execCommand('insertText', false, promptText);
    } catch {
      // Fallback below
    }

    if (!String(editor.textContent || '').trim()) {
      editor.innerHTML = `<p>${escapeHtml(promptText)}</p>`;
      editor.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: promptText,
        })
      );
      editor.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  function findEnabledGenerateButton(editor) {
    const isEnabled = (el) =>
      el instanceof HTMLElement &&
      isVisible(el) &&
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-disabled') !== 'true';

    const allButtons = Array.from(
      document.querySelectorAll('button, [role="button"]')
    ).filter(isEnabled);

    const matched = allButtons.find((el) => {
      const label = (
        (el.getAttribute('aria-label') || '') +
        ' ' +
        (el.getAttribute('data-testid') || '') +
        ' ' +
        (el.textContent || '')
      ).trim();
      return PLATFORM_CONFIG.generateRegex.test(label);
    });
    if (matched instanceof HTMLElement) return matched;

    const form = editor?.closest('form');
    if (form) {
      const submits = Array.from(
        form.querySelectorAll('button[type="submit"], button')
      ).filter(isEnabled);
      if (submits.length > 0) {
        return submits[submits.length - 1];
      }
    }
    return null;
  }

  function snapshotExistingMedia() {
    const videos = new Set();
    for (const v of document.querySelectorAll('video')) {
      if (v.currentSrc) videos.add(v.currentSrc);
      if (v.src) videos.add(v.src);
      for (const s of v.querySelectorAll('source')) {
        if (s.src) videos.add(s.src);
      }
    }
    const audios = new Set();
    for (const a of document.querySelectorAll('audio')) {
      if (a.currentSrc) audios.add(a.currentSrc);
      if (a.src) audios.add(a.src);
      for (const s of a.querySelectorAll('source')) {
        if (s.src) audios.add(s.src);
      }
    }
    const images = new Set();
    for (const img of document.querySelectorAll('img')) {
      if (img.currentSrc) images.add(img.currentSrc);
      if (img.src) images.add(img.src);
    }
    return { videos, audios, images };
  }

  async function extractAuthenticatedDataUrl(element, rawUrl) {
    if (!rawUrl) return null;
    if (rawUrl.startsWith('data:')) return rawUrl;

    try {
      const res = await fetch(rawUrl, { credentials: 'include' });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 64 && blob.size <= 64 * 1024 * 1024) {
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () =>
              resolve(typeof reader.result === 'string' ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
          if (dataUrl) return dataUrl;
        }
      }
    } catch {
      // Fallback to offscreen canvas for cross-origin <img>
    }

    if (
      element instanceof HTMLImageElement &&
      element.naturalWidth > 0 &&
      element.naturalHeight > 0
    ) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = element.naturalWidth;
        canvas.height = element.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(element, 0, 0);
          return canvas.toDataURL('image/png');
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  function waitForSynthesizedMedia(job, baseline, timeoutMs = 180000) {
    const jobId = job.jobId;
    const mode = String(job.mode || '').toLowerCase();

    return new Promise((resolve, reject) => {
      let settled = false;
      let scanning = false;

      const scan = async () => {
        if (settled || scanning) return;
        scanning = true;
        try {
          if (mode === 'audio' || TARGET === 'elevenlabs') {
            for (const audio of document.querySelectorAll('audio')) {
              const url =
                audio.currentSrc || audio.src || audio.querySelector('source')?.src || '';
              if (url && !baseline.audios.has(url)) {
                settled = true;
                observer.disconnect();
                clearInterval(poller);
                clearTimeout(timer);
                const dataUrl = await extractAuthenticatedDataUrl(audio, url);
                resolve({
                  videoUrl: null,
                  imageUrl: null,
                  audioUrl: url.startsWith('http') ? url : null,
                  dataUrl,
                });
                return;
              }
            }
          }

          for (const video of document.querySelectorAll('video')) {
            const url =
              video.currentSrc || video.src || video.querySelector('source')?.src || '';
            if (
              url &&
              !baseline.videos.has(url) &&
              (video.readyState >= 2 || video.videoWidth > 0 || url.startsWith('http'))
            ) {
              settled = true;
              observer.disconnect();
              clearInterval(poller);
              clearTimeout(timer);
              const dataUrl = await extractAuthenticatedDataUrl(video, url);
              resolve({
                videoUrl: url.startsWith('http') ? url : null,
                imageUrl: null,
                audioUrl: null,
                dataUrl,
              });
              return;
            }
          }

          if (mode !== 'video' && mode !== 'audio') {
            for (const img of document.querySelectorAll('img')) {
              const url = img.currentSrc || img.src || '';
              if (!url || baseline.images.has(url) || !img.complete) continue;
              if (img.naturalWidth < 256 || img.naturalHeight < 256) continue;

              const matchesCdn = PLATFORM_CONFIG.cdnRegex.test(url);
              const qualifies =
                (img.naturalWidth >= 512 && img.naturalHeight >= 384) ||
                (matchesCdn && img.naturalWidth >= 384 && img.naturalHeight >= 384);

              if (qualifies) {
                settled = true;
                observer.disconnect();
                clearInterval(poller);
                clearTimeout(timer);
                const dataUrl = await extractAuthenticatedDataUrl(img, url);
                resolve({
                  videoUrl: null,
                  imageUrl: url.startsWith('http') ? url : null,
                  audioUrl: null,
                  dataUrl,
                });
                return;
              }
            }
          }
        } finally {
          scanning = false;
        }
      };

      const observer = new MutationObserver(() => {
        void scan();
      });
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src'],
      });

      const poller = setInterval(() => {
        try {
          chrome.runtime.sendMessage({
            type: 'TARGET_JOB_PROGRESS',
            payload: {
              jobId,
              target: TARGET,
              status: 'generating',
              progress: 0.65,
              message: `Synthesizing ${job.modelId || mode || 'media'} on ${PLATFORM_CONFIG.label}...`,
            },
          });
        } catch {
          // Ignore service worker sleep
        }
        void scan();
      }, 2000);

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearInterval(poller);
        reject(new Error(`Timed out waiting for ${PLATFORM_CONFIG.label} output (180s).`));
      }, timeoutMs);
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'EXECUTE_CONSUMER_JOB') return false;

    const job = message.job || {};
    sendResponse({ ok: true, acceptedJobId: job.jobId });

    (async () => {
      try {
        // Inject upstream reference images BEFORE snapshotting baseline so the uploaded
        // reference thumbnail itself is included in `baseline.images` and never mistaken for the output!
        const injectedCount = await injectReferenceImages(job);
        if (injectedCount > 0) {
          await sleep(800);
        }

        const baseline = snapshotExistingMedia();
        const composer = findPromptComposer();
        if (!composer) {
          throw new Error(
            `${PLATFORM_CONFIG.label} prompt composer not found. Open the generator workspace and verify you are signed in.`
          );
        }

        const promptOk = injectPrompt(composer, job.prompt || '');
        if (!promptOk) {
          throw new Error(`Failed to inject prompt into ${PLATFORM_CONFIG.label} composer.`);
        }

        await sleep(450);
        let genBtn = null;
        for (let attempt = 0; attempt < 12; attempt += 1) {
          genBtn = findEnabledGenerateButton(composer);
          if (genBtn) break;
          await sleep(250);
        }

        if (!genBtn) {
          throw new Error(
            `Enabled Generate button not found on ${PLATFORM_CONFIG.label}. Verify you are signed in and have available credits.`
          );
        }

        genBtn.click();

        const media = await waitForSynthesizedMedia(job, baseline);
        chrome.runtime.sendMessage({
          type: 'TARGET_JOB_COMPLETE',
          payload: {
            jobId: job.jobId,
            target: TARGET,
            status: 'succeeded',
            videoUrl: media.videoUrl,
            imageUrl: media.imageUrl,
            audioUrl: media.audioUrl,
            dataUrl: media.dataUrl,
          },
        });
      } catch (err) {
        chrome.runtime.sendMessage({
          type: 'TARGET_JOB_COMPLETE',
          payload: {
            jobId: job.jobId,
            target: TARGET,
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    })();

    return false;
  });
})();
