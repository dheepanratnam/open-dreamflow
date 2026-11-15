const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const code = String(body.code || '').trim();
    const tokenEndpoint = String(body.tokenEndpoint || '').trim();
    const clientId = String(body.clientId || '').trim();
    const clientSecret = body.clientSecret ? String(body.clientSecret) : undefined;
    const redirectUri = String(body.redirectUri || '').trim();
    const codeVerifier = String(body.codeVerifier || '').trim();

    if (!code || !tokenEndpoint || !clientId || !redirectUri || !codeVerifier) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing required PKCE token exchange fields' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('code', code);
    params.set('redirect_uri', redirectUri);
    params.set('client_id', clientId);
    params.set('code_verifier', codeVerifier);
    if (clientSecret) params.set('client_secret', clientSecret);

    const tokenRes = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            tokenJson?.error_description ||
            tokenJson?.error ||
            `Token exchange failed (HTTP ${tokenRes.status})`,
        }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const expiresInSec = Number(tokenJson.expires_in || 3600);
    return new Response(
      JSON.stringify({
        ok: true,
        oauth: {
          accessToken: String(tokenJson.access_token),
          refreshToken: tokenJson.refresh_token ? String(tokenJson.refresh_token) : undefined,
          tokenType: tokenJson.token_type ? String(tokenJson.token_type) : 'Bearer',
          expiresAt: Date.now() + expiresInSec * 1000,
          scope: tokenJson.scope ? String(tokenJson.scope) : body.scope,
          clientId,
          clientSecret,
          tokenEndpoint,
          authorizationEndpoint: body.authorizationEndpoint,
          registrationEndpoint: body.registrationEndpoint,
          resource: body.resource,
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
