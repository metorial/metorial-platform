import { notFoundError } from '@metorial/error';

export let apiMux = (
  services: {
    domains?: string[];
    endpoint: { path: string | string[]; fetch: (req: any) => Promise<any> };
  }[],
  fallback?: (req: any, server: any) => Promise<any>
) => {
  let servicesWithRegex = services.flatMap(({ domains, endpoint }) => {
    if (endpoint.path == '/') {
      return [
        {
          path: '/',
          domains,
          endpoint,
          regex: undefined as RegExp | undefined
        }
      ];
    } else {
      return (Array.isArray(endpoint.path) ? endpoint.path : [endpoint.path]).map(path => {
        let regPath = path.replace(/\//g, '\\/').replace(/\{[^}]*\}/g, '([^/]*)');

        return {
          path,
          domains,
          endpoint,
          regex: new RegExp(`^${regPath}$`)
        };
      });
    }
  });

  return (req: Request, server: any) => {
    let url = new URL(req.url);
    let host = (req.headers.get('x-host') ?? req.headers.get('host') ?? url.hostname).split(
      ':'
    )[0];
    url.host = host;

    if (url.pathname == '/ping') {
      return new Response('OK') as any;
    }

    for (let { domains, endpoint, path } of servicesWithRegex) {
      if (domains && !domains.includes(host)) continue;

      if (url.pathname == path || url.pathname.startsWith(`${path}/`)) {
        return endpoint.fetch(req);
      }
    }

    if (fallback) return fallback(req, server);

    return new Response(JSON.stringify(notFoundError('route').toResponse()), {
      status: 404,
      headers: {
        'Content-Type': 'application/json'
      }
    }) as any;
  };
};
