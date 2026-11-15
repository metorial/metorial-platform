import { branding } from '@metorial/branding';
import { perEdition } from '@metorial/editions';

let assetOrigins = () =>
  [
    ...new Set(
      [branding.assetsBaseUrl, branding.avatarUrl('image'), branding.logoUrl].flatMap(url => {
        try {
          return [new URL(url).origin];
        } catch {
          return [];
        }
      })
    )
  ].join(' ');

let buildCspDirectives = () => [
  `default-src 'self'`,
  perEdition({
    cloud: `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com`,
    'on-prem': `script-src 'self' 'unsafe-inline'`
  }),
  `style-src 'self' 'unsafe-inline'`,
  perEdition({
    cloud: `img-src 'self' data: *.metorial-cdn.com metorial.com *.metorial.com *.metorial.net *.metorial.dev *.metorial-files.com metorial-files.com *.metorial-staging.com`,
    'on-prem': `img-src 'self' data: ${assetOrigins()}`
  }),
  perEdition({
    cloud: `font-src 'self' *.metorial-cdn.com`,
    'on-prem': `font-src 'self'`
  }),
  perEdition({
    cloud: `connect-src 'self' *.metorial.com *.metorial.net *.metorial.dev`,
    'on-prem': `connect-src 'self'`
  }),
  perEdition({
    cloud: `frame-src https://challenges.cloudflare.com`,
    'on-prem': `frame-src 'none'`
  }),
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`
];

let cspDirectives: string[] | undefined;
let getCsp = () => (cspDirectives ??= buildCspDirectives()).join('; ');

let getHeaders = (): Record<string, string> =>
  process.env.NODE_ENV === 'production'
    ? {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': getCsp(),
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
      for (let [key, value] of Object.entries(getHeaders())) patched.headers.set(key, value);
    }

    if (
      url.pathname.startsWith('/two-factor') ||
      url.pathname.startsWith('/metorial-ares/auth-api')
    ) {
      patched.headers.set('Cache-Control', 'no-store');
      patched.headers.set('Referrer-Policy', 'no-referrer');
    }

    return patched;
  };
};
