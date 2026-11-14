import { env } from './env';
import { isIntegrationsCorsOriginAllowed } from './cors';

export let integrationsCors = async (c: any, next: () => Promise<void>) => {
  let origin = c.req.header('Origin');
  let isAllowed =
    !!origin &&
    isIntegrationsCorsOriginAllowed({
      origin,
      integrationsUiUrl: env.service.INTEGRATIONS_UI_URL,
      corsDomains: env.service.CORS_DOMAINS,
      allowCors: env.service.ALLOW_CORS,
      isDevelopment: process.env.NODE_ENV !== 'production'
    });

  let applyHeaders = (response: Response) => {
    if (!origin || !isAllowed) return response;

    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, baggage, sentry-trace'
    );
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
    return response;
  };

  if (c.req.method === 'OPTIONS') {
    if (!isAllowed) {
      return origin ? c.text('', 403) : new Response(null, { status: 204 });
    }
    return applyHeaders(new Response(null, { status: 204 }));
  }

  await next();
  applyHeaders(c.res);
};
