/**
 * @open-dreamflow/provider-sdk — Official ElevenLabs Zero-Markup REST Client
 * Supports `/v1/text-to-speech/{voiceId}` (`eleven_multilingual_v2`, `eleven_flash_v2_5`)
 * and `/v1/sound-generation` (`eleven_text_to_sound_v2`), returning raw MP3 bytes.
 */

export const ELEVENLABS_DEFAULT_BASE_URL = 'https://api.elevenlabs.io';
export const ELEVENLABS_DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // George

export interface ElevenLabsClientConfig {
  apiKey: string;
  baseUrl?: string;
  defaultVoiceId?: string;
  fetchImpl?: typeof fetch;
}

export interface ElevenLabsTtsRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  outputFormat?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  signal?: AbortSignal;
}

export interface ElevenLabsSfxRequest {
  prompt: string;
  durationSeconds?: number;
  promptInfluence?: number;
  signal?: AbortSignal;
}

export interface ElevenLabsAudioResult {
  provider: 'elevenlabs';
  modelId: string;
  voiceId?: string;
  audioBytes: Uint8Array;
  mimeType: string;
}

export class ElevenLabsApiError extends Error {
  public readonly statusCode?: number;
  public readonly errorBody?: unknown;

  constructor(message: string, statusCode?: number, errorBody?: unknown) {
    super(message);
    this.name = 'ElevenLabsApiError';
    this.statusCode = statusCode;
    this.errorBody = errorBody;
  }
}

export class ElevenLabsClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultVoiceId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ElevenLabsClientConfig) {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new ElevenLabsApiError('ElevenLabsClient requires a non-empty xi-api-key.');
    }
    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl || ELEVENLABS_DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.defaultVoiceId = config.defaultVoiceId || ELEVENLABS_DEFAULT_VOICE_ID;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  public async verifyAccount(
    signal?: AbortSignal
  ): Promise<{ ok: boolean; voicesCount: number; sampleVoices: Array<{ id: string; name: string }> }> {
    const res = await this.fetchImpl(`${this.baseUrl}/v1/voices`, {
      method: 'GET',
      headers: {
        'xi-api-key': this.apiKey,
        Accept: 'application/json',
      },
      signal,
    });

    if (!res.ok) {
      const errBody = await this.readErrorBody(res);
      throw new ElevenLabsApiError(
        `ElevenLabs API verification failed (${res.status}): ${errBody.message}`,
        res.status,
        errBody.raw
      );
    }

    const parsed = (await res.json()) as { voices?: Array<{ voice_id?: string; name?: string }> };
    const voices = Array.isArray(parsed.voices) ? parsed.voices : [];
    return {
      ok: true,
      voicesCount: voices.length,
      sampleVoices: voices.slice(0, 8).map((v) => ({
        id: String(v.voice_id || ''),
        name: String(v.name || 'Voice'),
      })),
    };
  }

  public async generateSpeech(req: ElevenLabsTtsRequest): Promise<ElevenLabsAudioResult> {
    const text = String(req.text || '').trim();
    if (!text) {
      throw new ElevenLabsApiError('Text is required for ElevenLabs speech synthesis.');
    }

    const voiceId = (req.voiceId || this.defaultVoiceId).trim();
    const modelId = (req.modelId || 'eleven_multilingual_v2').trim();
    const outputFormat = req.outputFormat || 'mp3_44100_128';

    const url = `${this.baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: req.stability ?? 0.5,
          similarity_boost: req.similarityBoost ?? 0.78,
          ...(typeof req.style === 'number' ? { style: req.style } : {}),
        },
      }),
      signal: req.signal,
    });

    if (!res.ok) {
      const errBody = await this.readErrorBody(res);
      throw new ElevenLabsApiError(
        `ElevenLabs TTS failed (${res.status}): ${errBody.message}`,
        res.status,
        errBody.raw
      );
    }

    const audioBytes = new Uint8Array(await res.arrayBuffer());
    return {
      provider: 'elevenlabs',
      modelId,
      voiceId,
      audioBytes,
      mimeType: res.headers.get('content-type')?.split(';')[0]?.trim() || 'audio/mpeg',
    };
  }

  public async generateSoundEffect(req: ElevenLabsSfxRequest): Promise<ElevenLabsAudioResult> {
    const prompt = String(req.prompt || '').trim();
    if (!prompt) {
      throw new ElevenLabsApiError('Prompt is required for ElevenLabs sound generation.');
    }

    const durationSeconds = req.durationSeconds
      ? Math.max(0.5, Math.min(22, Number(req.durationSeconds)))
      : undefined;

    const res = await this.fetchImpl(`${this.baseUrl}/v1/sound-generation`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: prompt,
        ...(durationSeconds ? { duration_seconds: durationSeconds } : {}),
        prompt_influence: req.promptInfluence ?? 0.35,
      }),
      signal: req.signal,
    });

    if (!res.ok) {
      const errBody = await this.readErrorBody(res);
      throw new ElevenLabsApiError(
        `ElevenLabs Sound Effects failed (${res.status}): ${errBody.message}`,
        res.status,
        errBody.raw
      );
    }

    const audioBytes = new Uint8Array(await res.arrayBuffer());
    return {
      provider: 'elevenlabs',
      modelId: 'eleven_text_to_sound_v2',
      audioBytes,
      mimeType: res.headers.get('content-type')?.split(';')[0]?.trim() || 'audio/mpeg',
    };
  }

  private async readErrorBody(res: Response): Promise<{ message: string; raw: unknown }> {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const detail = parsed.detail as Record<string, unknown> | string | undefined;
      const msg =
        typeof detail === 'string'
          ? detail
          : typeof detail?.message === 'string'
            ? detail.message
            : typeof parsed.message === 'string'
              ? parsed.message
              : text.slice(0, 300);
      return { message: msg, raw: parsed };
    } catch {
      return { message: text.slice(0, 300) || `HTTP ${res.status}`, raw: text };
    }
  }
}
