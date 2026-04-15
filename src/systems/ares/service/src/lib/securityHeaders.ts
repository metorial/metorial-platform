let cspDirectives = [
  `default-src 'self'`,
  `script-src 'self' unsafe-inline https://challenges.cloudflare.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' *.metorial-cdn.com *.metorial.com *.metorial.net *.metorial.dev *.metorial-files.com metorial-files.com`,
  `font-src 'self' *.metorial-cdn.com`,
  `connect-src 'self' *.metorial.com *.metorial.net *.metorial.dev`,
  `frame-src https://challenges.cloudflare.com`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`
];

let headers: Record<string, string> =
  process.env.NODE_ENV === 'production'
    ? {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': cspDirectives.join('; '),
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-XSS-Protection': '0',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
      }
    : {};

export let withSecurityHeaders = (
  fetch: (req: Request, server: any) => Response | Promise<Response>
): ((req: Request, server: any) => Promise<Response>) => {
  return async (req, server) => {
    let url = new URL(req.url);
    let res = await fetch(req, server);
    let patched = new Response(res.body, res);

    if (url.hostname.includes('.')) {
      for (let [key, value] of Object.entries(headers)) patched.headers.set(key, value);
    }

    return patched;
  };
};
