/**
 * Open-DreamFlow Chrome Bridge — Dreamina / Seedance Session Driver (`content-dreamina.js`)
 *
 * Automates zero-API-cost multi-frame keyframe sequences (2–10 frames), `@Element`
 * reference image uploads, and 9-grid contact sheet / `<video>` capture on
 * `https://dreamina.capcut.com/*` via `MutationObserver`.
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

  async function sourceToFile(item, index, prefix = 'keyframe') {
    const rawUrl =
      typeof item === 'string'
        ? item
        : item?.imageUrl || item?.dataUrl || item?.image || item?.url || '';
    if (!rawUrl) return null;

    try {
      const response = await fetch(rawUrl);
      const blob = await response.blob();
      const ext = (blob.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
      return new File([blob], `${prefix}_${index + 1}.${ext}`, {
        type: blob.type || 'image/png',
      });
    } catch {
      return null;
    }
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

  function injectDreaminaPrompt(promptText) {
    const textarea = /** @type {HTMLTextAreaElement | null} */ (
      document.querySelector(
        'textarea[placeholder*="Describe"], textarea[placeholder*="prompt"], textarea'
      )
    );
    if (textarea) {
      textarea.focus();
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      if (setter) {
        setter.call(textarea, promptText);
      } else {
        textarea.value = promptText;
      }
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    const editable = /** @type {HTMLElement | null} */ (
      document.querySelector('[contenteditable="true"]')
    );
    if (editable) {
      editable.focus();
      editable.textContent = promptText;
      editable.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
      return true;
    }

    return false;
  }

  function triggerDreaminaGenerate() {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    const submitBtn = buttons.find((el) => {
      const text = (
        (el.textContent || '') +
        ' ' +
        (el.getAttribute('aria-label') || '')
      ).toLowerCase();
      const disabled =
        el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
      return (
        !disabled &&
        (text.includes('generate') || text.includes('create') || text.includes('生成'))
      );
    });
    if (submitBtn instanceof HTMLElement) {
      submitBtn.click();
      return true;
    }
    return false;
  }

  function snapshotExistingMedia() {
    const videos = new Set();
    for (const v of document.querySelectorAll('video')) {
      if (v.currentSrc) videos.add(v.currentSrc);
      if (v.src) videos.add(v.src);
    }
    const images = new Set();
    for (const img of document.querySelectorAll('img')) {
      if (img.currentSrc) images.add(img.currentSrc);
      if (img.src) images.add(img.src);
    }
    return { videos, images };
  }

  function waitForDreaminaMedia(jobId, baseline, timeoutMs = 180000) {
    return new Promise((resolve, reject) => {
      let done = false;

      const scan = () => {
        if (done) return;

        for (const video of document.querySelectorAll('video')) {
          const url = video.currentSrc || video.src || video.querySelector('source')?.src || '';
          if (url && !baseline.videos.has(url)) {
            done = true;
            observer.disconnect();
            clearInterval(poller);
            clearTimeout(timer);
            resolve({ videoUrl: url, imageUrl: null });
            return;
          }
        }

        // Also capture high-res Seedream 9-grid / 4-angle contact sheet images when operating in image mode
        for (const img of document.querySelectorAll('img')) {
          const url = img.currentSrc || img.src || '';
          if (
            url &&
            !baseline.images.has(url) &&
            img.naturalWidth >= 512 &&
            img.naturalHeight >= 512
          ) {
            done = true;
            observer.disconnect();
            clearInterval(poller);
            clearTimeout(timer);
            resolve({ videoUrl: null, imageUrl: url });
            return;
          }
        }
      };

      const observer = new MutationObserver(scan);
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
            progress: 0.65,
            message: 'Synthesizing Seedance / Seedream output on Dreamina...',
          },
        });
        scan();
      }, 3000);

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
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
        const baseline = snapshotExistingMedia();
        await injectDreaminaFrames(job);
        await new Promise((r) => setTimeout(r, 500));

        const okPrompt = injectDreaminaPrompt(job.prompt || '');
        if (!okPrompt) {
          throw new Error(
            'Dreamina prompt input not found. Sign in at dreamina.capcut.com and open the Video/Image generator.'
          );
        }

        await new Promise((r) => setTimeout(r, 350));
        const clicked = triggerDreaminaGenerate();
        if (!clicked) {
          throw new Error('Could not locate an active Generate button on Dreamina.');
        }

        const media = await waitForDreaminaMedia(job.jobId, baseline);
        chrome.runtime.sendMessage({
          type: 'TARGET_JOB_COMPLETE',
          payload: {
            jobId: job.jobId,
            target: TARGET,
            status: 'succeeded',
            videoUrl: media.videoUrl,
            imageUrl: media.imageUrl,
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
