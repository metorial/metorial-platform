import { Counter, Gauge, Histogram, registry } from './registry';

let idSegment =
  /^(?:[a-z]{1,10}_[A-Za-z0-9]{6,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{16,}|\d+|[A-Za-z0-9_-]{22,})$/;

// Collapses identifiers so the route label stays low-cardinality.
export let normalizeRoute = (pathname: string) => {
  let segments = pathname
    .split('/')
    .map(segment => (idSegment.test(segment) ? ':id' : segment));
  let route = segments.slice(0, 6).join('/') || '/';
  return route.length > 80 ? route.slice(0, 80) : route;
};

export let statusClass = (status: number) => `${Math.floor(status / 100)}xx`;

let httpDuration: Histogram | undefined;
let httpInFlight: Gauge | undefined;
let httpRequests: Counter | undefined;

let ensureHttp = () => {
  httpDuration ??= registry.histogram({
    name: 'metorial_http_server_request_duration_seconds',
    help: 'Time to produce an HTTP response, by method, route and status class.',
    labelNames: ['method', 'route', 'status_class']
  });
  httpInFlight ??= registry.gauge({
    name: 'metorial_http_server_requests_in_flight',
    help: 'HTTP requests currently being handled.'
  });
  httpRequests ??= registry.counter({
    name: 'metorial_http_server_requests_total',
    help: 'HTTP requests by method, route and status class.',
    labelNames: ['method', 'route', 'status_class']
  });
};

export let metricsEnabled = () => process.env.METRICS_ENABLED === 'true';

let ignoredRoutes = new Set(['/ping', '/', '/metrics']);

export let observeHttpRequest = async <T extends Response | undefined | void>(
  req: Request,
  handle: () => Promise<T>
): Promise<T> => {
  if (!metricsEnabled()) return await handle();

  ensureHttp();

  let url = new URL(req.url);
  if (ignoredRoutes.has(url.pathname)) return await handle();

  let start = performance.now();
  httpInFlight!.inc();

  let status = 500;
  try {
    let response = await handle();
    status = response instanceof Response ? response.status : 200;
    return response;
  } finally {
    httpInFlight!.dec();
    let labels = {
      method: req.method,
      route: normalizeRoute(url.pathname),
      status_class: statusClass(status)
    };
    httpDuration!.observe(labels, (performance.now() - start) / 1000);
    httpRequests!.inc(labels);
  }
};
