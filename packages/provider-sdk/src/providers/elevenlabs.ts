/**
 * @open-dreamflow/provider-sdk — Official ElevenLabs Zero-Markup REST & OAuth Client
 * Supports:
 *  - `POST /v1/text-to-dialogue` (`eleven_v4` flagship expressive speech & multi-speaker dialogue)
 *  - `POST /v1/text-to-speech/{voiceId}` (`eleven_v3`, `eleven_multilingual_v2`, `eleven_flash_v2_5`, `eleven_turbo_v2_5`)
 *  - `POST /v1/sound-generation` (`eleven_text_to_sound_v3`, `eleven_text_to_sound_v2`)
 *  - `POST /v1/music` (`music_v2_5`, `music_v2`)
 *  - `GET /v1/voices` & `GET /v1/user/subscription`
 * Authenticates via either `Authorization: Bearer <oauthAccessToken>` (1-Click MCP OAuth) or `xi-api-key`.
 */

export const ELEVENLABS_DEFAULT_BASE_URL = 'https://api.elevenlabs.io';
export const ELEVENLABS_DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // George

export interface ElevenLabsClientConfig {
  apiKey?: string;
  oauthAccessToken?: string;
  baseUrl?: string;
  defaultVoiceId?: string;
  fetchImpl?: typeof fetch;
}

export interface ElevenLabsDialogueTurn {
  text: string;
  voiceId: string;
}

export interface ElevenLabsTtsRequest {
  text: string;
  voiceId?: string;
  dialogueInputs?: ElevenLabsDialogueTurn[];
  modelId?: string;
  outputFormat?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
  useSpeakerBoost?: boolean;
  languageCode?: string;
  applyTextNormalization?: 'auto' | 'on' | 'off';
  seed?: number;
  signal?: AbortSignal;
}

export interface ElevenLabsSfxRequest {
  prompt: string;
  modelId?: 'eleven_text_to_sound_v3' | 'eleven_text_to_sound_v2' | string;
  durationSeconds?: number;
  promptInfluence?: number;
  loop?: boolean;
  outputFormat?: string;
  signal?: AbortSignal;
}

export interface ElevenLabsMusicRequest {
  prompt: string;
  modelId?: 'music_v2_5' | 'music_v2' | string;
  durationSeconds?: number;
  forceInstrumental?: boolean;
  outputFormat?: string;
  signal?: AbortSignal;
}

export interface ElevenLabsVoiceSummary {
  id: string;
  name: string;
  shortName: string;
  subtitle: string;
  category: string;
  accent: string;
  gender: string;
  age: string;
  useCase: string;
  description: string;
  previewUrl: string;
}

export interface ElevenLabsSubscriptionSummary {
  tier?: string;
  status?: string;
  characterCount?: number;
  characterLimit?: number;
  remainingCharacters?: number;
  nextResetUnix?: number;
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
  private readonly oauthAccessToken: string;
  private readonly baseUrl: string;
  private readonly defaultVoiceId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ElevenLabsClientConfig) {
    const apiKey = (config.apiKey || '').trim();
    const oauthAccessToken = (config.oauthAccessToken || '').trim();
    if (!apiKey && !oauthAccessToken) {
      throw new ElevenLabsApiError(
        'ElevenLabsClient requires either a non-empty xi-api-key or OAuth Bearer token.'
      );
    }
    this.apiKey = apiKey;
    this.oauthAccessToken = oauthAccessToken;
    this.baseUrl = (config.baseUrl || ELEVENLABS_DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.defaultVoiceId = config.defaultVoiceId || ELEVENLABS_DEFAULT_VOICE_ID;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
    const auth: Record<string, string> = this.oauthAccessToken
      ? { Authorization: `Bearer ${this.oauthAccessToken}` }
      : { 'xi-api-key': this.apiKey };
    return {
      ...auth,
      ...(extra || {}),
    };
  }

  public async verifyAccount(
    signal?: AbortSignal
  ): Promise<{ ok: boolean; voicesCount: number; sampleVoices: Array<{ id: string; name: string }> }> {
    const voices = await this.listVoices(signal);
    return {
      ok: true,
      voicesCount: voices.length,
      sampleVoices: voices.slice(0, 8).map((v) => ({
        id: v.id,
        name: v.shortName || v.name,
      })),
    };
  }

  public async getSubscription(signal?: AbortSignal): Promise<ElevenLabsSubscriptionSummary> {
    const res = await this.fetchImpl(`${this.baseUrl}/v1/user/subscription`, {
      method: 'GET',
      headers: this.buildAuthHeaders({ Accept: 'application/json' }),
      signal,
    });
    if (!res.ok) {
      const errBody = await this.readErrorBody(res);
      throw new ElevenLabsApiError(
        `ElevenLabs subscription check failed (${res.status}): ${errBody.message}`,
        res.status,
        errBody.raw
      );
    }
    const parsed = (await res.json()) as Record<string, unknown>;
    const used = Number(parsed.character_count);
    const limit = Number(parsed.character_limit);
    return {
      tier: typeof parsed.tier === 'string' ? parsed.tier : undefined,
      status: typeof parsed.status === 'string' ? parsed.status : undefined,
      characterCount: Number.isFinite(used) ? used : undefined,
      characterLimit: Number.isFinite(limit) ? limit : undefined,
      remainingCharacters:
        Number.isFinite(used) && Number.isFinite(limit) ? Math.max(0, limit - used) : undefined,
      nextResetUnix:
        typeof parsed.next_character_count_reset_unix === 'number'
          ? parsed.next_character_count_reset_unix
          : undefined,
    };
  }

  public async listVoices(signal?: AbortSignal): Promise<ElevenLabsVoiceSummary[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/v1/voices`, {
      method: 'GET',
      headers: this.buildAuthHeaders({ Accept: 'application/json' }),
      signal,
    });

    if (!res.ok) {
      const errBody = await this.readErrorBody(res);
      throw new ElevenLabsApiError(
        `ElevenLabs voices lookup failed (${res.status}): ${errBody.message}`,
        res.status,
        errBody.raw
      );
    }

    const parsed = (await res.json()) as {
      voices?: Array<{
        voice_id?: string;
        name?: string;
        category?: string;
        description?: string;
        preview_url?: string;
        labels?: Record<string, string>;
      }>;
    };
    const rawVoices = Array.isArray(parsed.voices) ? parsed.voices : [];
    return rawVoices
      .filter((v) => typeof v.voice_id === 'string' && v.voice_id.trim())
      .map((v) => {
        const fullName = String(v.name || 'Voice').trim();
        const dashIdx = fullName.indexOf(' - ');
        const shortName = dashIdx > 0 ? fullName.slice(0, dashIdx).trim() : fullName;
        const subtitle = dashIdx > 0 ? fullName.slice(dashIdx + 3).trim() : '';
        const labels = v.labels || {};
        return {
          id: String(v.voice_id).trim(),
          name: fullName,
          shortName,
          subtitle,
          category: String(v.category || 'premade'),
          accent: String(labels.accent || ''),
          gender: String(labels.gender || ''),
          age: String(labels.age || ''),
          useCase: String(labels.use_case || ''),
          description: String(v.description || subtitle || ''),
          previewUrl: String(v.preview_url || ''),
        };
      });
  }

  public async generateSpeech(req: ElevenLabsTtsRequest): Promise<ElevenLabsAudioResult> {
    const text = String(req.text || '').trim();
    if (!text && (!req.dialogueInputs || req.dialogueInputs.length === 0)) {
      throw new ElevenLabsApiError('Text is required for ElevenLabs speech synthesis.');
    }

    const voiceId = (req.voiceId || this.defaultVoiceId).trim();
    const modelId = (req.modelId || 'eleven_v4').trim();
    const outputFormat = req.outputFormat || 'mp3_44100_128';
    const cleanLang =
      req.languageCode && req.languageCode.trim().toLowerCase() !== 'auto'
        ? req.languageCode.trim().toLowerCase()
        : undefined;
    const validSeed =
      typeof req.seed === 'number' && Number.isFinite(req.seed) && req.seed >= 0
        ? Math.min(4294967295, Math.round(req.seed))
        : undefined;
    const normMode =
      req.applyTextNormalization === 'on' ||
      req.applyTextNormalization === 'off' ||
      req.applyTextNormalization === 'auto'
        ? req.applyTextNormalization
        : undefined;

    // Official Eleven v4 runs via `POST /v1/text-to-dialogue`
    const isDialogueEndpointModel =
      modelId === 'eleven_v4' ||
      modelId === 'eleven_v4_turbo' ||
      Boolean(req.dialogueInputs && req.dialogueInputs.length > 0);

    if (isDialogueEndpointModel) {
      const inputs =
        req.dialogueInputs && req.dialogueInputs.length > 0
          ? req.dialogueInputs.map((turn) => ({
              text: turn.text,
              voice_id: (turn.voiceId || voiceId).trim(),
            }))
          : [{ text, voice_id: voiceId }];

      const settingsObj: Record<string, unknown> = {};
      if (typeof req.stability === 'number' && Number.isFinite(req.stability)) {
        settingsObj.stability = Math.max(0, Math.min(1, req.stability));
      }
      if (typeof req.similarityBoost === 'number' && Number.isFinite(req.similarityBoost)) {
        settingsObj.similarity = Math.max(0, Math.min(1, req.similarityBoost));
      }

      const dialogueUrl = `${this.baseUrl}/v1/text-to-dialogue?output_format=${encodeURIComponent(outputFormat)}`;
      const buildDialogueBody = (includeSimilarity: boolean) => {
        const effectiveSettings = { ...settingsObj };
        if (!includeSimilarity) delete effectiveSettings.similarity;
        return {
          inputs,
          model_id: modelId,
          ...(cleanLang ? { language_code: cleanLang } : {}),
          ...(Object.keys(effectiveSettings).length > 0 ? { settings: effectiveSettings } : {}),
          ...(validSeed !== undefined ? { seed: validSeed } : {}),
          ...(normMode ? { apply_text_normalization: normMode } : {}),
        };
      };

      let res = await this.fetchImpl(dialogueUrl, {
        method: 'POST',
        headers: this.buildAuthHeaders({
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        }),
        body: JSON.stringify(buildDialogueBody(true)),
        signal: req.signal,
      });

      if (!res.ok && res.status === 422 && 'similarity' in settingsObj) {
        res = await this.fetchImpl(dialogueUrl, {
          method: 'POST',
          headers: this.buildAuthHeaders({
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          }),
          body: JSON.stringify(buildDialogueBody(false)),
          signal: req.signal,
        });
      }

      if (!res.ok) {
        const errBody = await this.readErrorBody(res);
        throw new ElevenLabsApiError(
          `ElevenLabs Dialogue TTS (${modelId}) failed (${res.status}): ${errBody.message}`,
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

    // Standard Speech Synthesis (`eleven_v3`, `eleven_multilingual_v2`, `eleven_flash_v2_5`, `eleven_turbo_v2_5`)
    // Per `tts_convert.md:39`: `language_code` is NOT supported for `eleven_multilingual_v2`!
    const supportsLanguageCode = !/multilingual_v2/i.test(modelId);
    const clampedSpeed =
      typeof req.speed === 'number' && Number.isFinite(req.speed)
        ? Math.max(0.7, Math.min(1.2, Math.round(req.speed * 100) / 100))
        : undefined;

    const voiceSettings: Record<string, unknown> = {
      stability:
        typeof req.stability === 'number' && Number.isFinite(req.stability)
          ? Math.max(0, Math.min(1, req.stability))
          : 0.5,
      similarity_boost:
        typeof req.similarityBoost === 'number' && Number.isFinite(req.similarityBoost)
          ? Math.max(0, Math.min(1, req.similarityBoost))
          : 0.75,
      ...(typeof req.style === 'number' && Number.isFinite(req.style)
        ? { style: Math.max(0, Math.min(1, req.style)) }
        : {}),
      ...(clampedSpeed !== undefined ? { speed: clampedSpeed } : {}),
      ...(typeof req.useSpeakerBoost === 'boolean'
        ? { use_speaker_boost: req.useSpeakerBoost }
        : {}),
    };

    const url = `${this.baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: this.buildAuthHeaders({
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      }),
      body: JSON.stringify({
        text,
        model_id: modelId,
        ...(supportsLanguageCode && cleanLang ? { language_code: cleanLang } : {}),
        voice_settings: voiceSettings,
        ...(validSeed !== undefined ? { seed: validSeed } : {}),
        ...(normMode ? { apply_text_normalization: normMode } : {}),
      }),
      signal: req.signal,
    });

    if (!res.ok) {
      const errBody = await this.readErrorBody(res);
      throw new ElevenLabsApiError(
        `ElevenLabs TTS (${modelId}) failed (${res.status}): ${errBody.message}`,
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

    const modelId =
      req.modelId === 'eleven_text_to_sound_v2'
        ? 'eleven_text_to_sound_v2'
        : 'eleven_text_to_sound_v3';
    const outputFormat = req.outputFormat || 'mp3_44100_128';
    const durationSeconds =
      typeof req.durationSeconds === 'number' &&
      Number.isFinite(req.durationSeconds) &&
      req.durationSeconds > 0
        ? Math.max(0.5, Math.min(30, Number(req.durationSeconds)))
        : undefined;
    const promptInfluence =
      typeof req.promptInfluence === 'number' && Number.isFinite(req.promptInfluence)
        ? Math.max(0, Math.min(1, req.promptInfluence))
        : 0.35;

    const res = await this.fetchImpl(
      `${this.baseUrl}/v1/sound-generation?output_format=${encodeURIComponent(outputFormat)}`,
      {
        method: 'POST',
        headers: this.buildAuthHeaders({
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        }),
        body: JSON.stringify({
          text: prompt,
          model_id: modelId,
          loop: Boolean(req.loop),
          ...(durationSeconds !== undefined ? { duration_seconds: durationSeconds } : {}),
          prompt_influence: promptInfluence,
        }),
        signal: req.signal,
      }
    );

    if (!res.ok) {
      const errBody = await this.readErrorBody(res);
      throw new ElevenLabsApiError(
        `ElevenLabs Sound Effects (${modelId}) failed (${res.status}): ${errBody.message}`,
        res.status,
        errBody.raw
      );
    }

    const audioBytes = new Uint8Array(await res.arrayBuffer());
    return {
      provider: 'elevenlabs',
      modelId,
      audioBytes,
      mimeType: res.headers.get('content-type')?.split(';')[0]?.trim() || 'audio/mpeg',
    };
  }

  public async generateMusic(req: ElevenLabsMusicRequest): Promise<ElevenLabsAudioResult> {
    const prompt = String(req.prompt || '').trim();
    if (!prompt) {
      throw new ElevenLabsApiError('Prompt is required for ElevenLabs music generation.');
    }

    const modelId = req.modelId === 'music_v2' ? 'music_v2' : 'music_v2_5';
    const outputFormat =
      req.outputFormat && req.outputFormat !== 'auto' ? req.outputFormat : 'mp3_44100_128';
    const musicLengthMs =
      typeof req.durationSeconds === 'number' &&
      Number.isFinite(req.durationSeconds) &&
      req.durationSeconds >= 3
        ? Math.round(Math.max(3, Math.min(600, req.durationSeconds)) * 1000)
        : undefined;

    // Per `music_compose.md:37`: `seed` CANNOT be used in conjunction with `prompt`!
    const res = await this.fetchImpl(
      `${this.baseUrl}/v1/music?output_format=${encodeURIComponent(outputFormat)}`,
      {
        method: 'POST',
        headers: this.buildAuthHeaders({
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        }),
        body: JSON.stringify({
          prompt,
          model_id: modelId,
          force_instrumental: Boolean(req.forceInstrumental),
          ...(musicLengthMs !== undefined ? { music_length_ms: musicLengthMs } : {}),
        }),
        signal: req.signal,
      }
    );

    if (!res.ok) {
      const errBody = await this.readErrorBody(res);
      throw new ElevenLabsApiError(
        `ElevenLabs Music (${modelId}) failed (${res.status}): ${errBody.message}`,
        res.status,
        errBody.raw
      );
    }

    const audioBytes = new Uint8Array(await res.arrayBuffer());
    return {
      provider: 'elevenlabs',
      modelId,
      audioBytes,
      mimeType: res.headers.get('content-type')?.split(';')[0]?.trim() || 'audio/mpeg',
    };
  }

  private async readErrorBody(res: Response): Promise<{ message: string; raw: unknown }> {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const detail = parsed.detail as Record<string, unknown> | Array<Record<string, unknown>> | string | undefined;
      const msg =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail) && detail.length > 0
            ? detail
                .map((d) =>
                  typeof d?.msg === 'string'
                    ? `${Array.isArray(d.loc) ? d.loc.join('.') + ': ' : ''}${d.msg}`
                    : JSON.stringify(d)
                )
                .join('; ')
            : typeof (detail as Record<string, unknown> | undefined)?.message === 'string'
              ? String((detail as Record<string, unknown>).message)
              : typeof parsed.message === 'string'
                ? parsed.message
                : text.slice(0, 300);
      return { message: msg, raw: parsed };
    } catch {
      return { message: text.slice(0, 300) || `HTTP ${res.status}`, raw: text };
    }
  }
}
