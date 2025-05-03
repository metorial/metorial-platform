import { notFoundError } from '@metorial/error';

export let apiMux = (
  services: {
    domains?: string[];
    endpoint: { path: string; fetch: (req: any) => Promise<any> };
  }[],
  fallback?: (req: any) => Promise<any>
) => {
  let servicesWithRegex = services.map(({ domains, endpoint }) => {
    if (endpoint.path == '/') {
      return {
        path: '/',
        domains,
        endpoint,
        regex: undefined
      };
    } else {
      let path = endpoint.path.replace(/\//g, '\\/').replace(/\{[^}]*\}/g, '([^/]*)');

      return {
        path: endpoint.path,
        domains,
        endpoint,
        regex: new RegExp(`^${path}$`)
      };
    }
  });

  return (req: Request) => {
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

    if (fallback) return fallback(req);

    return new Response(JSON.stringify(notFoundError('route').toResponse()), {
      status: 404,
      headers: {
        'Content-Type': 'application/json'
      }
    }) as any;
  };
};
