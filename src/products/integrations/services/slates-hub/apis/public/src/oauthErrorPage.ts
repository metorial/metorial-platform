import { isServiceError } from '@lowerdeck/error';
import type { MiddlewareHandler } from 'hono';

let escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

let renderOAuthErrorPage = (message: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Unable to continue setup</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#f6f6f7;color:#111;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:32px;max-width:440px;width:100%;box-sizing:border-box}
h1{font-size:20px;margin:0 0 12px}
p{color:#52525b;line-height:1.5;margin:0}
</style>
</head>
<body><main><h1>Unable to continue setup</h1><p>${escapeHtml(message)}</p></main></body>
</html>`;

// The OAuth routes are opened by a browser, so their service errors render as a page instead
// of the JSON the app error handler produces.
export let oauthErrorPage: MiddlewareHandler = async (c, next) => {
  await next();

  if (!isServiceError(c.error)) return;

  c.res = new Response(renderOAuthErrorPage(c.error.data.message), {
    status: c.error.data.status,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      'X-Frame-Options': 'DENY'
    }
  });
};
