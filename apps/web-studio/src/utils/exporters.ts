import type {
  CanvasEdge,
  CanvasNode,
  MultiframeBridge,
  MultiframeCard,
  TimelineClip,
} from '../types/studio';
import { drawCinemaShotFrame } from './proceduralMedia';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function secondsToFcpxmlTime(sec: number): string {
  const frames30 = Math.max(1, Math.round(sec * 30));
  return `${frames30 * 100}/3000s`;
}

export function generateFcpxmlDocument(
  projectTitle: string,
  clips: TimelineClip[]
): string {
  const videoClips = clips
    .filter((c) => c.track === 'video')
    .sort((a, b) => a.startSec - b.startSec);
  const voiceClips = clips
    .filter((c) => c.track === 'voice')
    .sort((a, b) => a.startSec - b.startSec);
  const sfxClips = clips
    .filter((c) => c.track === 'sfx')
    .sort((a, b) => a.startSec - b.startSec);

  const totalSec = Math.max(
    5,
    ...clips.map((c) => c.startSec + c.durationSec)
  );

  const resourceLines: string[] = [
    `    <format id="r1" name="FFVideoFormat1080p30" frameDuration="100/3000s" width="1920" height="1080" colorSpace="1-1-1 (Rec. 709)"/>`,
  ];

  clips.forEach((clip, idx) => {
    const assetId = `r_asset_${idx + 1}`;
    const ext = clip.track === 'video' ? 'mp4' : 'wav';
    const hasVideo = clip.track === 'video' ? '1' : '0';
    const hasAudio = '1';
    resourceLines.push(
      `    <asset id="${assetId}" name="${escapeXml(clip.title)}" src="file://./media/${escapeXml(
        clip.id
      )}.${ext}" start="0s" duration="${secondsToFcpxmlTime(
        clip.durationSec
      )}" hasVideo="${hasVideo}" hasAudio="${hasAudio}" format="r1" audioSources="1" audioChannels="2" audioRate="48000"/>`
    );
  });

  const assetMap = new Map<string, string>();
  clips.forEach((c, idx) => assetMap.set(c.id, `r_asset_${idx + 1}`));

  const attachedAudioXml = [
    ...voiceClips.map(
      (vc) =>
        `              <asset-clip name="${escapeXml(
          vc.title
        )} [Voice/LipSync]" lane="-1" offset="${secondsToFcpxmlTime(
          vc.startSec
        )}" ref="${assetMap.get(vc.id)}" duration="${secondsToFcpxmlTime(
          vc.durationSec
        )}" audioRole="dialogue"/>`
    ),
    ...sfxClips.map(
      (sc) =>
        `              <asset-clip name="${escapeXml(
          sc.title
        )} [SFX]" lane="-2" offset="${secondsToFcpxmlTime(
          sc.startSec
        )}" ref="${assetMap.get(sc.id)}" duration="${secondsToFcpxmlTime(
          sc.durationSec
        )}" audioRole="effects"/>`
    ),
  ].join('\n');

  let spineContent = '';
  if (videoClips.length === 0) {
    spineContent = `            <gap name="Empty Spine" offset="0s" duration="${secondsToFcpxmlTime(
      totalSec
    )}" start="0s">\n${attachedAudioXml}\n            </gap>`;
  } else {
    spineContent = videoClips
      .map((vc, idx) => {
        const ref = assetMap.get(vc.id);
        const note = `<note>${escapeXml(vc.promptOrDialogue)}</note>`;
        if (idx === 0 && attachedAudioXml) {
          return `            <asset-clip name="${escapeXml(
            vc.title
          )}" offset="${secondsToFcpxmlTime(vc.startSec)}" ref="${ref}" duration="${secondsToFcpxmlTime(
            vc.durationSec
          )}" format="r1">\n              ${note}\n${attachedAudioXml}\n            </asset-clip>`;
        }
        return `            <asset-clip name="${escapeXml(
          vc.title
        )}" offset="${secondsToFcpxmlTime(vc.startSec)}" ref="${ref}" duration="${secondsToFcpxmlTime(
          vc.durationSec
        )}" format="r1">\n              ${note}\n            </asset-clip>`;
      })
      .join('\n');
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
${resourceLines.join('\n')}
  </resources>
  <library>
    <event name="Open-DreamFlow Rough Cut">
      <project name="${escapeXml(projectTitle)}">
        <sequence format="r1" duration="${secondsToFcpxmlTime(totalSec)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${spineContent}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function compileTimelineToWebm(
  clips: TimelineClip[],
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const width = 1280;
  const height = 720;
  const fps = 30;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context for .webm export.');
  }

  const videoClips = clips
    .filter((c) => c.track === 'video')
    .sort((a, b) => a.startSec - b.startSec);
  const voiceClips = clips.filter((c) => c.track === 'voice');
  const sfxClips = clips.filter((c) => c.track === 'sfx');

  const rawTotalSec = Math.max(
    4,
    ...clips.map((c) => c.startSec + c.durationSec)
  );
  const timeCompression = rawTotalSec > 6 ? rawTotalSec / 5.0 : 1.0;
  const renderDurationSec = rawTotalSec / timeCompression;

  const videoStream = canvas.captureStream(fps);

  let audioCtx: AudioContext | null = null;
  const combinedTracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

  try {
    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextCtor();
    const dest = audioCtx.createMediaStreamDestination();

    const droneOsc = audioCtx.createOscillator();
    const droneGain = audioCtx.createGain();
    droneOsc.type = 'sine';
    droneOsc.frequency.value = 65.41;
    droneGain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    droneOsc.connect(droneGain);
    droneGain.connect(dest);
    droneOsc.start();
    droneOsc.stop(audioCtx.currentTime + renderDurationSec);

    sfxClips.forEach((sc) => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'triangle';
      const t0 = audioCtx.currentTime + sc.startSec / timeCompression;
      const dur = Math.max(0.2, sc.durationSec / timeCompression);
      osc.frequency.setValueAtTime(110, t0);
      osc.frequency.exponentialRampToValueAtTime(220, t0 + dur);
      g.gain.setValueAtTime(0.04, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + dur);
    });

    voiceClips.forEach((vc) => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'sawtooth';
      const t0 = audioCtx.currentTime + vc.startSec / timeCompression;
      const dur = Math.max(0.2, vc.durationSec / timeCompression);
      osc.frequency.setValueAtTime(vc.audioFreqHz || 196, t0);
      g.gain.setValueAtTime(0.025, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + dur);
    });

    dest.stream.getAudioTracks().forEach((t) => combinedTracks.push(t));
  } catch {
    // Fallback to video-only stream
  }

  const combinedStream = new MediaStream(combinedTracks);
  const mimeCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const supportedMime =
    mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';

  const recorder = supportedMime
    ? new MediaRecorder(combinedStream, { mimeType: supportedMime, videoBitsPerSecond: 4_500_000 })
    : new MediaRecorder(combinedStream);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onerror = (err) => reject(err);
    recorder.onstop = () => {
      if (audioCtx) {
        audioCtx.close().catch(() => undefined);
      }
      const blob = new Blob(chunks, { type: supportedMime || 'video/webm' });
      resolve(blob);
    };

    recorder.start(100);
    const startWall = performance.now();

    const step = () => {
      const elapsedReal = (performance.now() - startWall) / 1000;
      const timelineSec = Math.min(rawTotalSec, elapsedReal * timeCompression);
      const pct = Math.min(100, Math.round((elapsedReal / renderDurationSec) * 100));
      onProgress?.(pct);

      const activeVideo =
        videoClips.find(
          (c) => timelineSec >= c.startSec && timelineSec <= c.startSec + c.durationSec
        ) || videoClips[videoClips.length - 1];

      const activeVoice = voiceClips.find(
        (c) => timelineSec >= c.startSec && timelineSec <= c.startSec + c.durationSec
      );

      if (activeVideo) {
        const localTime = Math.max(0, timelineSec - activeVideo.startSec);
        drawCinemaShotFrame(ctx, width, height, localTime, {
          prompt: activeVideo.promptOrDialogue || activeVideo.title,
          seed: activeVideo.seed || 101,
          theme: activeVideo.videoTheme,
          cameraLabel: `${activeVideo.title} · TC ${timelineSec.toFixed(1)}s`,
          hudBadge: 'OPEN-DREAMFLOW 720P MASTER',
        });
      } else {
        ctx.fillStyle = '#07080C';
        ctx.fillRect(0, 0, width, height);
      }

      if (activeVoice) {
        ctx.save();
        const sub = `${activeVoice.lipSyncCharacter || 'VOICE'}: "${activeVoice.promptOrDialogue}"`;
        ctx.font = '600 22px Inter, sans-serif';
        const tw = ctx.measureText(sub).width;
        ctx.fillStyle = 'rgba(7, 8, 12, 0.78)';
        ctx.fillRect((width - tw) / 2 - 20, height - 74, tw + 40, 42);
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(sub, (width - tw) / 2, height - 46);
        ctx.restore();
      }

      if (elapsedReal < renderDurationSec) {
        requestAnimationFrame(step);
      } else {
        onProgress?.(100);
        recorder.stop();
      }
    };

    requestAnimationFrame(step);
  });
}

export interface CompactRecipePayload {
  v: 1;
  title: string;
  nodes: Array<{
    id: string;
    kind: CanvasNode['kind'];
    title: string;
    prompt: string;
    x: number;
    y: number;
    aspectRatio: CanvasNode['aspectRatio'];
    status?: CanvasNode['status'];
    platformId?: CanvasNode['platformId'];
    connectionMode?: CanvasNode['connectionMode'];
    modelId?: string;
    batchCount?: 1 | 2 | 4;
    negativePrompt?: string;
    audioEnabled?: boolean;
    audioMode?: CanvasNode['audioMode'];
    voiceId?: string;
    seed: number;
    resolution: CanvasNode['resolution'];
    durationSec?: number;
    interactionId?: string;
    previousInteractionId?: string;
    elementHandles: string[];
    styleDna?: CanvasNode['styleDna'];
  }>;
  edges: CanvasEdge[];
  multiframes?: Array<{
    id: string;
    order: number;
    title: string;
    prompt: string;
    aspectRatio: MultiframeCard['aspectRatio'];
  }>;
  bridges?: MultiframeBridge[];
}

export function encodeRecipeToUrlParam(payload: CompactRecipePayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeRecipeFromUrlParam(encoded: string): CompactRecipePayload | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as CompactRecipePayload;
    if (parsed && parsed.v === 1 && Array.isArray(parsed.nodes)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
