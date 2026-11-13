/**
 * Open-DreamFlow Chrome Bridge — Google Flow Live Session Driver (`content-flow.js`)
 *
 * Automates zero-API-cost prompt + `@Element` Ingredient injection across
 * `https://labs.google/*` (`labs.google/fx/tools/flow`) and `https://flow.google.com/*`,
 * capturing newly synthesized `<video>` streams AND high-res `<img>` frames (`>= 512px`)
 * as authenticated Base64 `dataUrl` payloads back to Open-DreamFlow Studio.
 */

(function initGoogleFlowBridge() {
  const TARGET = 'google-flow';

  function registerSession() {
    try {
      chrome.runtime.sendMessage({
        type: 'TARGET_REGISTER',
        target: TARGET,
        url: window.location.href,
      });
    } catch {
      // Ignore transient service worker wake-up delays
    }
  }

  registerSession();
  setInterval(registerSession, 25000);

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
    return new File([bytes], filename || `element.${ext}`, { type: mimeType });
  }

  async function referenceToFile(ref, index) {
    const rawSource =
      typeof ref === 'string'
        ? ref
        : ref?.dataUrl || ref?.image || ref?.url || '';
    if (!rawSource) return null;

    const defaultName =
      (typeof ref === 'object' && ref?.name) || `element_${index + 1}.png`;

    if (rawSource.startsWith('data:')) {
      const direct = dataUrlToFile(rawSource, defaultName);
      if (direct) return direct;
    }

    try {
      const response = await fetch(rawSource);
      if (response.ok) {
        const blob = await response.blob();
        const ext = (blob.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
        const filename =
          (typeof ref === 'object' && ref?.name) || `element_${index + 1}.${ext}`;
        return new File([blob], filename, { type: blob.type || 'image/png' });
      }
    } catch {
      // Fallback to MV3 background fetch when page CSP blocks localhost/cross-origin URLs
    }

    try {
      const bgRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'FETCH_REFERENCE_DATA_URL', url: rawSource },
          (res) => resolve(chrome.runtime.lastError ? null : res)
        );
      });
      if (bgRes && bgRes.ok && typeof bgRes.dataUrl === 'string') {
        return dataUrlToFile(bgRes.dataUrl, defaultName);
      }
    } catch {
      // Ignore
    }

    return null;
  }

  async function injectElementReferences(referenceImages) {
    if (!Array.isArray(referenceImages) || referenceImages.length === 0) return 0;

    const files = [];
    for (let i = 0; i < Math.min(referenceImages.length, 6); i += 1) {
      const file = await referenceToFile(referenceImages[i], i);
      if (file) files.push(file);
    }
    if (files.length === 0) return 0;

    const dt = new DataTransfer();
    for (const file of files) {
      dt.items.add(file);
    }

    const fileInput = /** @type {HTMLInputElement | null} */ (
      document.querySelector('input[type="file"][accept*="image"], input[type="file"]')
    );
    if (fileInput) {
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      return files.length;
    }

    const dropTarget =
      document.querySelector(
        '[data-testid*="ingredient"], [aria-label*="Ingredient"], [role="textbox"]'
      ) || document.body;
    dropTarget.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      })
    );
    return files.length;
  }

  function injectPromptText(promptText) {
    const textareaCandidates = Array.from(
      document.querySelectorAll(
        'textarea[placeholder*="Generate" i], textarea[placeholder*="prompt" i], textarea[aria-label*="prompt" i], textarea:not([disabled])'
      )
    );
    const textarea = textareaCandidates.find(isVisible);
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.focus();
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(textarea, promptText);
      } else {
        textarea.value = promptText;
      }
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    const editableCandidates = Array.from(
      document.querySelectorAll(
        '.ProseMirror[contenteditable="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"]'
      )
    );
    const editable = editableCandidates.find(isVisible);
    if (editable instanceof HTMLElement) {
      editable.focus();
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editable);
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        document.execCommand('selectAll', false);
        document.execCommand('insertText', false, promptText);
      } catch {
        // Fallback below
      }
      if (!String(editable.textContent || '').trim()) {
        editable.textContent = promptText;
        editable.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
      }
      return true;
    }

    return false;
  }

  function clickGenerateButton() {
    const candidates = Array.from(
      document.querySelectorAll('button, [role="button"]')
    ).filter(isVisible);

    const generateBtn = candidates.find((el) => {
      const label = (
        (el.textContent || '') +
        ' ' +
        (el.getAttribute('aria-label') || '') +
        ' ' +
        (el.getAttribute('data-testid') || '')
      ).toLowerCase();
      const isDisabled =
        el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
      return (
        !isDisabled &&
        (label.includes('generate') ||
          label.includes('create') ||
          label.includes('send') ||
          label.includes('arrow_upward'))
      );
    });

    if (generateBtn instanceof HTMLElement) {
      generateBtn.click();
      return true;
    }
    return false;
  }

  function snapshotExistingMedia() {
    const videos = new Set();
    for (const video of document.querySelectorAll('video')) {
      if (video.currentSrc) videos.add(video.currentSrc);
      if (video.src) videos.add(video.src);
      for (const source of video.querySelectorAll('source')) {
        if (source.src) videos.add(source.src);
      }
    }
    const images = new Set();
    for (const img of document.querySelectorAll('img')) {
      if (img.currentSrc) images.add(img.currentSrc);
      if (img.src) images.add(img.src);
    }
    return { videos, images };
  }

  async function extractFlowMediaDataUrl(element, rawUrl) {
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

  function waitForFlowMedia(job, baseline, timeoutMs = 180000) {
    const jobId = job.jobId;
    const mode = String(job.mode || '').toLowerCase();

    return new Promise((resolve, reject) => {
      let settled = false;
      let scanning = false;

      const checkMedia = async () => {
        if (settled || scanning) return;
        scanning = true;
        try {
          const videos = Array.from(document.querySelectorAll('video'));
          for (const video of videos) {
            const candidate =
              video.currentSrc ||
              video.src ||
              video.querySelector('source')?.src ||
              '';
            if (
              candidate &&
              !baseline.videos.has(candidate) &&
              (video.readyState >= 2 || video.videoWidth > 0 || candidate.startsWith('http'))
            ) {
              settled = true;
              observer.disconnect();
              clearInterval(poller);
              clearTimeout(timer);
              const dataUrl = await extractFlowMediaDataUrl(video, candidate);
              resolve({
                videoUrl: candidate.startsWith('http') ? candidate : null,
                imageUrl: null,
                dataUrl,
              });
              return;
            }
          }

          if (mode !== 'video') {
            for (const img of document.querySelectorAll('img')) {
              const candidate = img.currentSrc || img.src || '';
              if (
                candidate &&
                !baseline.images.has(candidate) &&
                img.complete &&
                img.naturalWidth >= 512 &&
                img.naturalHeight >= 384
              ) {
                settled = true;
                observer.disconnect();
                clearInterval(poller);
                clearTimeout(timer);
                const dataUrl = await extractFlowMediaDataUrl(img, candidate);
                resolve({
                  videoUrl: null,
                  imageUrl: candidate.startsWith('http') ? candidate : null,
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
        void checkMedia();
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
              progress: 0.6,
              message: 'Waiting for Google Flow synthesis output...',
            },
          });
        } catch {
          // Ignore service worker sleep
        }
        void checkMedia();
      }, 2000);

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearInterval(poller);
        reject(new Error('Timed out waiting for Google Flow synthesis output (180s).'));
      }, timeoutMs);
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'EXECUTE_CONSUMER_JOB') return false;

    const job = message.job || {};
    sendResponse({ ok: true, acceptedJobId: job.jobId });

    (async () => {
      try {
        if (Array.isArray(job.referenceImages) && job.referenceImages.length > 0) {
          await injectElementReferences(job.referenceImages);
          await sleep(650);
        }

        const baseline = snapshotExistingMedia();

        const promptOk = injectPromptText(job.prompt || '');
        if (!promptOk) {
          throw new Error(
            'Google Flow prompt composer not found. Sign in on labs.google/fx/tools/flow inside an active project.'
          );
        }

        await sleep(400);
        let clicked = false;
        for (let attempt = 0; attempt < 10; attempt += 1) {
          clicked = clickGenerateButton();
          if (clicked) break;
          await sleep(250);
        }
        if (!clicked) {
          throw new Error('Could not locate an enabled Generate button on Google Flow.');
        }

        const media = await waitForFlowMedia(job, baseline);
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
