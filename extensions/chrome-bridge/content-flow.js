/**
 * Open-DreamFlow Chrome Bridge — Google Flow Consumer Session Driver (`content-flow.js`)
 *
 * Automates zero-API-cost prompt + `@Element` Ingredient injection and streams
 * newly synthesized `<video>` URLs from `https://flow.google.com/*` back to
 * Open-DreamFlow Studio via `MutationObserver`.
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

  /**
   * Converts a data URL or HTTPS image URL into a browser `File` object suitable
   * for `DataTransfer` injection into Google Flow's Ingredients uploader.
   * @param {string | { image?: string, url?: string, dataUrl?: string, name?: string }} ref
   * @param {number} index
   * @returns {Promise<File | null>}
   */
  async function referenceToFile(ref, index) {
    const rawSource =
      typeof ref === 'string'
        ? ref
        : ref?.dataUrl || ref?.image || ref?.url || '';
    if (!rawSource) return null;

    try {
      const response = await fetch(rawSource);
      const blob = await response.blob();
      const ext = (blob.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
      const filename =
        (typeof ref === 'object' && ref?.name) || `element_${index + 1}.${ext}`;
      return new File([blob], filename, { type: blob.type || 'image/png' });
    } catch {
      return null;
    }
  }

  /**
   * Injects up to 6 `@Element` Ingredient reference files into Flow's `<input type="file">`
   * or primary composer dropzone via `DataTransfer`.
   * @param {Array<any>} referenceImages
   */
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
      document.querySelector('[data-testid*="ingredient"], [aria-label*="Ingredient"], [role="textbox"]') ||
      document.body;
    dropTarget.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      })
    );
    return files.length;
  }

  /**
   * Populates Google Flow's prompt textarea or contenteditable surface in a
   * framework-compatible way (React / Lit / Angular signals).
   * @param {string} promptText
   */
  function injectPromptText(promptText) {
    const textarea = /** @type {HTMLTextAreaElement | null} */ (
      document.querySelector(
        'textarea[placeholder*="Generate"], textarea[placeholder*="prompt"], textarea[aria-label*="prompt"], textarea'
      )
    );
    if (textarea) {
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

    const editable = /** @type {HTMLElement | null} */ (
      document.querySelector('[contenteditable="true"][role="textbox"], [contenteditable="true"]')
    );
    if (editable) {
      editable.focus();
      editable.textContent = promptText;
      editable.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
      return true;
    }

    return false;
  }

  function clickGenerateButton() {
    const candidates = Array.from(
      document.querySelectorAll('button, [role="button"]')
    );
    const generateBtn = candidates.find((el) => {
      const label = (
        el.textContent +
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

  function collectExistingVideoUrls() {
    const urls = new Set();
    for (const video of document.querySelectorAll('video')) {
      if (video.currentSrc) urls.add(video.currentSrc);
      if (video.src) urls.add(video.src);
      for (const source of video.querySelectorAll('source')) {
        if (source.src) urls.add(source.src);
      }
    }
    return urls;
  }

  /**
   * Converts same-origin `blob:` URLs to Base64 data URLs when small enough so
   * localhost Web Studio can load them across origins, or returns HTTPS signed URLs directly.
   * @param {string} rawUrl
   * @returns {Promise<string>}
   */
  async function resolveTransferableVideoUrl(rawUrl) {
    if (!rawUrl.startsWith('blob:')) return rawUrl;
    try {
      const res = await fetch(rawUrl);
      const blob = await res.blob();
      if (blob.size > 45 * 1024 * 1024) return rawUrl;
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : rawUrl);
        reader.onerror = () => resolve(rawUrl);
        reader.readAsDataURL(blob);
      });
    } catch {
      return rawUrl;
    }
  }

  /**
   * Watches the DOM via `MutationObserver` until Google Flow mounts a newly synthesized `<video>`.
   * @param {string} jobId
   * @param {Set<string>} baselineUrls
   * @param {number} timeoutMs
   */
  function waitForNewVideoUrl(jobId, baselineUrls, timeoutMs = 180000) {
    return new Promise((resolve, reject) => {
      let settled = false;

      const checkVideos = async () => {
        if (settled) return;
        const videos = Array.from(document.querySelectorAll('video'));
        for (const video of videos) {
          const candidate =
            video.currentSrc ||
            video.src ||
            video.querySelector('source')?.src ||
            '';
          if (candidate && !baselineUrls.has(candidate)) {
            settled = true;
            observer.disconnect();
            clearInterval(poller);
            clearTimeout(timer);
            const transferable = await resolveTransferableVideoUrl(candidate);
            resolve(transferable);
            return;
          }
        }
      };

      const observer = new MutationObserver(() => {
        checkVideos();
      });
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src'],
      });

      const poller = setInterval(() => {
        chrome.runtime.sendMessage({
          type: 'TARGET_JOB_PROGRESS',
          payload: {
            jobId,
            target: TARGET,
            status: 'generating',
            progress: 0.6,
            message: 'Waiting for Google Flow <video> stream...',
          },
        });
        checkVideos();
      }, 3000);

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearInterval(poller);
        reject(new Error('Timed out waiting for Google Flow video synthesis (180s).'));
      }, timeoutMs);
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'EXECUTE_CONSUMER_JOB') return false;

    const job = message.job || {};
    sendResponse({ ok: true, acceptedJobId: job.jobId });

    (async () => {
      try {
        const baselineUrls = collectExistingVideoUrls();

        if (Array.isArray(job.referenceImages) && job.referenceImages.length > 0) {
          await injectElementReferences(job.referenceImages);
          await new Promise((r) => setTimeout(r, 600));
        }

        const promptOk = injectPromptText(job.prompt || '');
        if (!promptOk) {
          throw new Error(
            'Google Flow prompt composer not found. Ensure you are signed in on flow.google.com inside an active project.'
          );
        }

        await new Promise((r) => setTimeout(r, 350));
        const clicked = clickGenerateButton();
        if (!clicked) {
          throw new Error('Could not locate an enabled Generate button on Google Flow.');
        }

        const videoUrl = await waitForNewVideoUrl(job.jobId, baselineUrls);
        chrome.runtime.sendMessage({
          type: 'TARGET_JOB_COMPLETE',
          payload: {
            jobId: job.jobId,
            target: TARGET,
            status: 'succeeded',
            videoUrl,
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
