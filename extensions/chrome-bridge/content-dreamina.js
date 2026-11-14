/**
 * Open-DreamFlow Chrome Bridge — Dreamina / Seedance Live Session Driver (`content-dreamina.js`)
 *
 * Supports BOTH Dreamina AI Canvas (`https://dreamina.capcut.com/ai-tool/ai-canvas/*`)
 * AND standalone Dreamina Image/Video generators:
 *   1. Auto-opens the floating Prompt Dock on Dreamina Canvas by selecting an existing
 *      `Images` / `Videos` node or clicking the Left Dock `Image` / `Video` button when
 *      `.tiptap.ProseMirror` is not yet mounted.
 *   2. Injects `job.prompt` into `.tiptap.ProseMirror` (`div[contenteditable="true"]`) via
 *      `selectAll` + `insertText` (with `<p>` + `InputEvent` fallback) or `<textarea>`.
 *   3. Waits for `button[aria-label="Generate"]` / `form button.rounded-full:not([disabled])`
 *      to become enabled and triggers generation.
 *   4. Polls every 2000ms (plus `MutationObserver`) up to 180s for NEW high-res canvas images
 *      (`naturalWidth >= 512` or Dreamina/ByteImg CDN `>= 384`, ignoring avatars/icons `< 256px`)
 *      or NEW `<video>` streams, extracts Base64 `dataUrl` inside page context, and reports
 *      `TARGET_JOB_COMPLETE` back to the Open-DreamFlow background relay.
 */

(function initDreaminaBridge() {
  const TARGET = 'dreamina';

  function registerSession() {
    try {
      chrome.runtime.sendMessage({
        type: 'TARGET_REGISTER',
        target: TARGET,
        url: window.location.href,
      });
    } catch {
      // Ignore service worker sleep transitions
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
    return new File([bytes], filename || `keyframe.${ext}`, { type: mimeType });
  }

  async function sourceToFile(item, index, prefix = 'keyframe') {
    const rawUrl =
      typeof item === 'string'
        ? item
        : item?.imageUrl || item?.dataUrl || item?.image || item?.url || '';
    if (!rawUrl) return null;

    if (rawUrl.startsWith('data:')) {
      const direct = dataUrlToFile(rawUrl, `${prefix}_${index + 1}.png`);
      if (direct) return direct;
    }

    try {
      const response = await fetch(rawUrl);
      if (response.ok) {
        const blob = await response.blob();
        const ext = (blob.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
        return new File([blob], `${prefix}_${index + 1}.${ext}`, {
          type: blob.type || 'image/png',
        });
      }
    } catch {
      // Fallback to MV3 background fetch when page CSP blocks localhost/cross-origin URLs
    }

    try {
      const bgRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'FETCH_REFERENCE_DATA_URL', url: rawUrl },
          (res) => resolve(chrome.runtime.lastError ? null : res)
        );
      });
      if (bgRes && bgRes.ok && typeof bgRes.dataUrl === 'string') {
        return dataUrlToFile(bgRes.dataUrl, `${prefix}_${index + 1}.png`);
      }
    } catch {
      // Ignore
    }

    return null;
  }

  /**
   * Injects 2–10 sequence keyframes or `@Element` reference images into Dreamina's
   * multi-frame / reference `<input type="file">` controls via `DataTransfer`.
   */
  async function injectDreaminaFrames(job) {
    const combinedSources = [
      ...(Array.isArray(job.keyframes) ? job.keyframes : []),
      ...(Array.isArray(job.referenceImages) ? job.referenceImages : []),
    ].slice(0, 10);

    if (combinedSources.length === 0) return 0;

    const files = [];
    for (let i = 0; i < combinedSources.length; i += 1) {
      const f = await sourceToFile(combinedSources[i], i);
      if (f) files.push(f);
    }
    if (files.length === 0) return 0;

    const dt = new DataTransfer();
    for (const file of files) {
      dt.items.add(file);
    }

    const fileInput = /** @type {HTMLInputElement | null} */ (
      document.querySelector('input[type="file"][multiple], input[type="file"]')
    );
    if (fileInput) {
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      return files.length;
    }

    const dropArea =
      document.querySelector('[class*="upload"], [class*="keyframe"], [role="textbox"]') ||
      document.body;
    dropArea.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      })
    );
    return files.length;
  }

  function findDreaminaPromptEditor() {
    const selectors = [
      'textarea.prompt-textarea-nsnNXw',
      'textarea[class*="prompt-textarea"]',
      '.tiptap.ProseMirror[contenteditable="true"]',
      'div.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea[placeholder*="Describe" i]',
      'textarea[placeholder*="prompt" i]',
      'textarea[placeholder*="描述" i]',
      'textarea:not([disabled])',
      'div[contenteditable="true"]',
    ];
    for (const sel of selectors) {
      const candidates = Array.from(document.querySelectorAll(sel));
      const visible = candidates.find(isVisible);
      if (visible instanceof HTMLElement) {
        return visible;
      }
    }
    return null;
  }

  /**
   * Ensures the floating Prompt Dock is mounted on Dreamina AI Canvas (`ai-canvas/*`).
   * Clicks a matching `Images` / `Videos` canvas generator node or the 48px Left Dock button.
   */
  async function ensureDreaminaPromptMounted(mode) {
    let editor = findDreaminaPromptEditor();
    if (editor) return editor;

    const wantVideo = String(mode || '').toLowerCase() === 'video';
    const nodeLabelPattern = wantVideo ? /^(videos?|视频)$/i : /^(images?|图片)$/i;

    const interactive = Array.from(
      document.querySelectorAll('button, [role="button"], div[class*="node"], span')
    );
    for (const el of interactive) {
      if (!(el instanceof HTMLElement) || !isVisible(el)) continue;
      const label = (
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        el.textContent ||
        ''
      ).trim();
      if (nodeLabelPattern.test(label)) {
        el.click();
        await sleep(650);
        editor = findDreaminaPromptEditor();
        if (editor) return editor;
      }
    }

    // Fallback: click 48px Left Dock Image / Video tool icon on Dreamina AI Canvas
    const leftDockButtons = Array.from(
      document.querySelectorAll('button, [role="button"]')
    ).filter((btn) => {
      if (!(btn instanceof HTMLElement) || !isVisible(btn)) return false;
      const rect = btn.getBoundingClientRect();
      return rect.left >= 0 && rect.left < 88 && rect.top > 80 && rect.width <= 64 && rect.height <= 64;
    });

    if (leftDockButtons.length > 0) {
      const targetBtn =
        wantVideo && leftDockButtons[1] instanceof HTMLElement
          ? leftDockButtons[1]
          : leftDockButtons[0];
      if (targetBtn instanceof HTMLElement) {
        targetBtn.click();
        await sleep(700);
        editor = findDreaminaPromptEditor();
      }
    }

    return editor;
  }

  function injectDreaminaPrompt(editor, promptText) {
    if (!editor) return false;
    editor.focus();

    if (editor instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      if (setter) {
        setter.call(editor, promptText);
      } else {
        editor.value = promptText;
      }
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    // TipTap / ProseMirror contenteditable injection
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      document.execCommand('selectAll', false);
      document.execCommand('insertText', false, promptText);
    } catch {
      // Fallback below if execCommand is restricted
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

  function findActiveDreaminaGenerateButton(editor) {
    const isEnabled = (el) =>
      el instanceof HTMLElement &&
      isVisible(el) &&
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-disabled') !== 'true';

    const ariaExact = Array.from(
      document.querySelectorAll(
        'button[aria-label="Generate"], button[aria-label*="Generate" i]'
      )
    ).find(isEnabled);
    if (ariaExact instanceof HTMLElement) return ariaExact;

    const parentForm = editor?.closest('form');
    if (parentForm) {
      const roundedSubmit = Array.from(
        parentForm.querySelectorAll('button.rounded-full, button[type="submit"], button')
      ).filter(isEnabled);
      if (roundedSubmit.length > 0) {
        const lastBtn = roundedSubmit[roundedSubmit.length - 1];
        if (lastBtn instanceof HTMLElement) return lastBtn;
      }
    }

    const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).filter(
      isEnabled
    );
    const matched = buttons.find((el) => {
      const text = (
        (el.getAttribute('aria-label') || '') +
        ' ' +
        (el.textContent || '')
      )
        .trim()
        .toLowerCase();
      return text.includes('generate') || text.includes('create') || text.includes('生成');
    });
    return matched instanceof HTMLElement ? matched : null;
  }

  function snapshotExistingMedia() {
    const videos = new Set();
    for (const v of document.querySelectorAll('video')) {
      if (v.currentSrc) videos.add(v.currentSrc);
      if (v.src) videos.add(v.src);
      const sourceEl = v.querySelector('source');
      if (sourceEl?.src) videos.add(sourceEl.src);
    }
    const images = new Set();
    for (const img of document.querySelectorAll('img')) {
      if (img.currentSrc) images.add(img.currentSrc);
      if (img.src) images.add(img.src);
    }
    return { videos, images };
  }

  /**
   * Fetches a rendered Dreamina image/video inside the authenticated page context
   * into a Base64 `dataUrl` so localhost `:3001` receives exact bytes even when
   * ByteImg / CapCut CDNs require cookies or `blob:` URLs.
   */
  async function extractMediaDataUrl(element, rawUrl) {
    if (!rawUrl) return null;
    if (rawUrl.startsWith('data:')) return rawUrl;

    try {
      const res = await fetch(rawUrl, { credentials: 'include' });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 64 && blob.size <= 48 * 1024 * 1024) {
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
      // Fallback to offscreen canvas for cross-origin <img> elements
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

  function waitForDreaminaMedia(job, baseline, timeoutMs = 180000) {
    const jobId = job.jobId;
    const mode = String(job.mode || '').toLowerCase();

    return new Promise((resolve, reject) => {
      let settled = false;
      let scanning = false;

      const scan = async () => {
        if (settled || scanning) return;
        scanning = true;
        try {
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
              const dataUrl = await extractMediaDataUrl(video, url);
              resolve({
                videoUrl: url.startsWith('http') ? url : null,
                imageUrl: null,
                dataUrl,
              });
              return;
            }
          }

          if (mode !== 'video') {
            for (const img of document.querySelectorAll('img')) {
              const url = img.currentSrc || img.src || '';
              if (!url || baseline.images.has(url) || !img.complete) continue;

              // Ignore tiny icons, toolbar glyphs, and user avatars (< 256px)
              if (img.naturalWidth < 256 || img.naturalHeight < 256) continue;

              const isDreaminaCdn = /byteimg|ibytedtos|capcut|dreamina|jimeng/i.test(url);
              const qualifies =
                (img.naturalWidth >= 512 && img.naturalHeight >= 384) ||
                (isDreaminaCdn && img.naturalWidth >= 384 && img.naturalHeight >= 384);

              if (qualifies) {
                settled = true;
                observer.disconnect();
                clearInterval(poller);
                clearTimeout(timer);
                const dataUrl = await extractMediaDataUrl(img, url);
                resolve({
                  videoUrl: null,
                  imageUrl: url.startsWith('http') ? url : null,
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
              message: 'Synthesizing Seedance / Seedream output on Dreamina...',
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
        reject(new Error('Timed out waiting for Dreamina synthesis output (180s).'));
      }, timeoutMs);
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'EXECUTE_CONSUMER_JOB') return false;

    const job = message.job || {};
    sendResponse({ ok: true, acceptedJobId: job.jobId });

    (async () => {
      try {
        const editor = await ensureDreaminaPromptMounted(job.mode);
        if (!editor) {
          throw new Error(
            'Dreamina prompt input (textarea.prompt-textarea-nsnNXw or .tiptap.ProseMirror) not found. Sign in at dreamina.capcut.com/ai-tool/home or /ai-tool/ai-canvas.'
          );
        }

        const injectedFrames = await injectDreaminaFrames(job);
        if (injectedFrames > 0) {
          await sleep(600);
        }
        const baseline = snapshotExistingMedia();

        const okPrompt = injectDreaminaPrompt(editor, job.prompt || '');
        if (!okPrompt) {
          throw new Error('Failed to inject prompt into Dreamina editor.');
        }

        await sleep(400);
        let genBtn = null;
        for (let attempt = 0; attempt < 12; attempt += 1) {
          genBtn = findActiveDreaminaGenerateButton(editor);
          if (genBtn) break;
          await sleep(250);
        }

        if (!genBtn) {
          throw new Error(
            'Could not locate an enabled Generate button on Dreamina. Verify you are signed in and have available credits.'
          );
        }

        genBtn.click();

        const media = await waitForDreaminaMedia(job, baseline);
        chrome.runtime.sendMessage({
          type: 'TARGET_JOB_COMPLETE',
          payload: {
            jobId: job.jobId,
            target: TARGET,
            status: 'succeeded',
            videoUrl: media.videoUrl,
            imageUrl: media.imageUrl,
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
