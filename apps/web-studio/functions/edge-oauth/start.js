const DEFAULT_ENDPOINTS = {
  higgsfield: 'https://mcp.higgsfield.ai/mcp',
  kling: 'https://kling.ai/mcp',
  fal: 'https://mcp.fal.ai/mcp',
  replicate: 'https://mcp.replicate.com/mcp',
  elevenlabs: 'https://api.elevenlabs.io/v1/mcp',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function base64UrlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function generatePkcePair() {
  const rand = new Uint8Array(32);
  crypto.getRandomValues(rand);
  const verifier = base64UrlEncode(rand);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

function randomHex(byteLen) {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function safeJson(url) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const platformId = String(body.platformId || '').trim().toLowerCase();
    const mcpUrl = String(body.mcpUrl || DEFAULT_ENDPOINTS[platformId] || '').trim();
    if (!mcpUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: `Missing MCP endpoint URL for ${platformId || 'provider'}` }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const reqOrigin = new URL(context.request.url).origin;
    const redirectUri = String(body.redirectUri || `${reqOrigin}/edge-oauth/callback`);
    const parsedMcp = new URL(mcpUrl);
    const mcpOrigin = `${parsedMcp.protocol}//${parsedMcp.host}`;
    const trimmedPath = parsedMcp.pathname.replace(/\/+$/, '');

    const prCandidates = [
      ...(trimmedPath ? [`${mcpOrigin}/.well-known/oauth-protected-resource${trimmedPath}`] : []),
      `${mcpOrigin}/.well-known/oauth-protected-resource`,
    ];

    let prMeta = null;
    for (const u of prCandidates) {
      prMeta = await safeJson(u);
      if (prMeta) break;
    }

    const rawIssuers = Array.isArray(prMeta?.authorization_servers) && prMeta.authorization_servers.length > 0
      ? prMeta.authorization_servers
      : [mcpOrigin];

    const asCandidates = [];
    for (const iss of rawIssuers) {
      try {
        const u = new URL(iss);
        const orig = `${u.protocol}//${u.host}`;
        const p = u.pathname.replace(/\/+$/, '');
        if (p) {
          asCandidates.push(`${orig}/.well-known/oauth-authorization-server${p}`);
          asCandidates.push(`${orig}/.well-known/openid-configuration${p}`);
          asCandidates.push(`${orig}${p}/.well-known/oauth-authorization-server`);
          asCandidates.push(`${orig}${p}/.well-known/openid-configuration`);
        }
        asCandidates.push(`${orig}/.well-known/oauth-authorization-server`);
        asCandidates.push(`${orig}/.well-known/openid-configuration`);
      } catch {
        // ignore invalid issuer
      }
    }

    let asMeta = null;
    for (const u of asCandidates) {
      const candidate = await safeJson(u);
      if (candidate?.authorization_endpoint && candidate?.token_endpoint) {
        asMeta = candidate;
        break;
      }
    }

    const authorizationEndpoint = asMeta?.authorization_endpoint || `${mcpOrigin}/oauth/authorize`;
    const tokenEndpoint = asMeta?.token_endpoint || `${mcpOrigin}/oauth/token`;
    const registrationEndpoint = asMeta?.registration_endpoint;
    const cimdSupported = Boolean(asMeta?.client_id_metadata_document_supported);

    const mergedScopes = new Set(['openid', 'profile', 'email', 'offline_access']);
    for (const list of [prMeta?.scopes_supported, asMeta?.scopes_supported]) {
      if (Array.isArray(list)) {
        for (const s of list) {
          if (typeof s === 'string' && s.trim()) mergedScopes.add(s.trim());
        }
      }
    }
    const supportedSet = Array.isArray(asMeta?.scopes_supported) && asMeta.scopes_supported.length > 0
      ? new Set(asMeta.scopes_supported)
      : null;
    const finalScopes = supportedSet
      ? Array.from(mergedScopes).filter((s) => supportedSet.has(s))
      : Array.from(mergedScopes);
    const scopeStr = finalScopes.join(' ');

    let clientId = '';
    let clientSecret;
    if (registrationEndpoint) {
      try {
        const regRes = await fetch(registrationEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            client_name: 'Open-DreamFlow Studio',
            redirect_uris: [redirectUri],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
            ...(scopeStr ? { scope: scopeStr } : {}),
          }),
        });
        if (regRes.ok) {
          const regJson = await regRes.json().catch(() => ({}));
          if (regJson?.client_id) {
            clientId = String(regJson.client_id);
            if (regJson.client_secret) clientSecret = String(regJson.client_secret);
          }
        }
      } catch {
        // fall through
      }
    }
    if (!clientId && cimdSupported) {
      clientId = `${reqOrigin}/oauth-client-metadata.json`;
    }
    if (!clientId) {
      clientId = 'open-dreamflow-studio';
    }

    const { verifier, challenge } = await generatePkcePair();
    const state = `edge_${randomHex(16)}`;
    const sessionId = `edge_oauth_${randomHex(10)}`;
    const resource = prMeta?.resource || mcpUrl;

    const authUrl = new URL(authorizationEndpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);
    if (scopeStr) authUrl.searchParams.set('scope', scopeStr);
    if (resource && !mcpUrl.includes('kling.ai')) {
      authUrl.searchParams.set('resource', resource);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        edgeFallback: true,
        sessionId,
        state,
        platformId,
        mcpUrl,
        authorizeUrl: authUrl.toString(),
        step: 'awaiting_login',
        pkceBundle: {
          sessionId,
          state,
          platformId,
          mcpUrl,
          redirectUri,
          codeVerifier: verifier,
          clientId,
          clientSecret,
          authorizationEndpoint,
          tokenEndpoint,
          registrationEndpoint,
          scope: scopeStr,
          resource,
        },
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}
