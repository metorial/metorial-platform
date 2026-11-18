import { check, probes, type CheckDefinition, type CheckSeverity } from '@lowerdeck/doctor';
import { attempt } from '../resolutions';
import { idPart } from './ids';

let defaultPorts: Record<string, number> = {
  'http:': 80,
  'https:': 443,
  'ws:': 80,
  'wss:': 443
};

export let tcpAddress = (address: string) => {
  let url = new URL(address.includes('://') ? address : `tcp://${address}`);
  let port = url.port ? Number(url.port) : defaultPorts[url.protocol];
  if (!port) throw new Error(`${address} has no port`);

  return { host: url.hostname, port };
};

export let dependencyCheck = (
  options: {
    name: string;
    severity?: CheckSeverity;
    title?: string;
  } & (
    | { run: (signal: AbortSignal) => Promise<unknown> }
    | { url: string; headers?: Record<string, string> }
    | { tcp: string }
  )
): CheckDefinition =>
  check({
    id: `dependencies.${idPart(options.name)}`,
    title: options.title ?? `${options.name} is reachable`,
    category: 'dependency',
    severity: options.severity ?? 'critical',
    target: options.name,
    run: ctx =>
      attempt(
        ctx,
        'dependency',
        async () => {
          if ('url' in options) {
            return probes.http({ url: options.url, headers: options.headers })(ctx);
          }

          if ('tcp' in options) return probes.tcp(tcpAddress(options.tcp))(ctx);

          let started = performance.now();
          await options.run(ctx.signal);
          let latencyMs = Math.round(performance.now() - started);

          return ctx.pass(`${options.name} answered in ${latencyMs}ms.`, { latencyMs });
        },
        { dependency: options.name }
      )
  });
