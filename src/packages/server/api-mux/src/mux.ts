import { notFoundError } from '@metorial/error';

export let apiMux = (
  services: {
    domains?: string[];
    methods?: string[];
    endpoint: { path: string | string[]; fetch: (req: any) => Promise<any>; exact?: boolean };
  }[],
  fallback?: (req: any, server: any) => Promise<any>
) => {
  let servicesWithRegex = services.flatMap(({ domains, endpoint, methods }) =>
    (Array.isArray(endpoint.path) ? endpoint.path : [endpoint.path]).map(path => {
      return {
        path,
        domains,
        endpoint,
        exact: endpoint.exact,
        methods: methods?.map(m => m.toUpperCase())
      };
    })
  );

  return (req: Request, server: any) => {
    let url = new URL(req.url);
    let host = (req.headers.get('x-host') ?? req.headers.get('host') ?? url.hostname).split(
      ':'
    )[0];
    url.host = host;

    if (url.pathname == '/ping') {
      return new Response('OK') as any;
    }

    for (let { domains, endpoint, path, methods, exact } of servicesWithRegex) {
      if (domains && !domains.includes(host)) continue;

      if (
        (url.pathname == path || (!exact && url.pathname.startsWith(`${path}/`))) &&
        (!methods || methods.includes(req.method))
      ) {
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
