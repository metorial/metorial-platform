import { createServer } from 'node:http';
import { installProcessMetrics } from './process';
import { registry } from './registry';

let started = false;

let contentType = 'text/plain; version=0.0.4; charset=utf-8';

export let renderMetrics = () => registry.render();

export let startMetrics = async (opts: { service?: string } = {}) => {
  if (started || process.env.METRICS_ENABLED !== 'true') return;
  started = true;

  let service = process.env.METRICS_SERVICE_NAME ?? opts.service ?? 'unknown';
  let port = Number(process.env.METRICS_PORT ?? 9464);

  installProcessMetrics({ service });

  // Queue metrics only exist where the queue library is installed; most services have it.
  try {
    let { installQueueMetrics } = await import('./queue');
    installQueueMetrics();
  } catch {}

  let handle = async (path: string) => {
    if (path === '/metrics') {
      return { status: 200, body: await renderMetrics() };
    }
    if (path === '/' || path === '/ping') return { status: 200, body: 'OK' };
    return { status: 404, body: 'Not Found' };
  };

  let bun = (globalThis as any).Bun;

  try {
    if (bun?.serve) {
      bun.serve({
        port,
        hostname: '0.0.0.0',
        fetch: async (req: Request) => {
          let result = await handle(new URL(req.url).pathname);
          return new Response(result.body, {
            status: result.status,
            headers: { 'content-type': contentType }
          });
        }
      });
    } else {
      createServer(async (req, res) => {
        let result = await handle(new URL(req.url ?? '/', 'http://localhost').pathname);
        res.writeHead(result.status, { 'content-type': contentType });
        res.end(result.body);
      }).listen(port, '0.0.0.0');
    }

    console.log(`[metrics] ${service} exposing Prometheus metrics on :${port}/metrics`);
  } catch (error) {
    console.error('[metrics] failed to start the metrics server', error);
  }
};
