export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const error = url.searchParams.get('error') || '';
  const errorDescription = url.searchParams.get('error_description') || '';

  const payload = JSON.stringify({
    type: 'dreamflow_edge_oauth_callback',
    code,
    state,
    error: error ? `${error}${errorDescription ? `: ${errorDescription}` : ''}` : '',
  });

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Open-DreamFlow · Completing MCP Authorization</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #0e0e0e;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
    }
    .card {
      max-width: 420px;
      padding: 24px 28px;
      border-radius: 16px;
      background: #161616;
      border: 1px solid rgba(255,255,255,0.1);
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      color: #20D5EC;
      background: rgba(32,213,236,0.12);
      border: 1px solid rgba(32,213,236,0.3);
      margin-bottom: 12px;
    }
    p { font-size: 13px; color: #9ca3af; line-height: 1.5; margin: 8px 0 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Official MCP OAuth 2.1</div>
    <h3 style="margin:0;font-size:16px;">${error ? 'Authorization Cancelled' : 'Completing Connection…'}</h3>
    <p>${error ? error : 'Returning authorization token to Open-DreamFlow Studio. This window will close automatically.'}</p>
  </div>
  <script>
    (function() {
      var msg = ${payload};
      try {
        localStorage.setItem('dreamflow_edge_oauth_last', JSON.stringify(Object.assign({}, msg, { ts: Date.now() })));
      } catch (e) {}
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(msg, '*');
        }
      } catch (e) {}
      setTimeout(function() { window.close(); }, 650);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
