import {
  check,
  probes,
  type CheckContext,
  type CheckDefinition,
  type CheckSeverity
} from '@lowerdeck/doctor';
import { isServiceError } from '@lowerdeck/error';
import { createClient, getRpcRequestDiagnostics, pingRpc } from '@lowerdeck/rpc-client';
import { attempt, failFromError, resolutionFor } from '../resolutions';
import { idPart } from './ids';

let rpcPingTimeoutMs = 5_000;

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

let wrongPathResolution = {
  summary: 'Something answered at the configured URL, but not this service’s RPC endpoint.',
  steps: [
    'Check the URL configured for it, including its path.',
    'Check that no proxy in between rewrites or strips the path.'
  ],
  docs: 'datacenter/operations/doctor#dependencies'
};

let rpcPingFailure = (ctx: CheckContext, name: string, error: unknown) => {
  let details = { dependency: name };

  if (isServiceError(error)) {
    let { status, code, entity } = error.data as {
      status: number;
      code: string;
      entity?: string;
    };

    // Services built before rpc:ping existed still answer with an RPC error, which proves the
    // path and protocol are right.
    if (status == 404 && entity == 'handler') {
      return ctx.pass(`${name} answered; it runs a version without rpc:ping.`, {
        ...details,
        ping: 'unsupported'
      });
    }

    if (status == 404) {
      return ctx.fail({
        message: `${name} answered with ${code}: the URL does not point at its RPC endpoint.`,
        resolution: wrongPathResolution,
        details: { ...details, errorCode: code }
      });
    }

    if (status == 401 || status == 403) {
      return ctx.fail({
        message: `${name} rejected our credentials (${code}).`,
        resolution: resolutionFor('dependency', 'authentication'),
        details: { ...details, errorKind: 'authentication', errorCode: code }
      });
    }

    if (code == 'timeout') {
      return ctx.fail({
        message: `${name} did not answer within ${rpcPingTimeoutMs / 1000} seconds.`,
        resolution: resolutionFor('dependency', 'timeout'),
        details: { ...details, errorKind: 'timeout', errorCode: code }
      });
    }

    let cause = getRpcRequestDiagnostics(error)?.error;
    if (cause?.name == 'RpcInvalidResponseError') {
      return ctx.fail({
        message: `${name} answered with something that is not an RPC response.`,
        resolution: wrongPathResolution,
        details
      });
    }

    if (cause) return failFromError(ctx, 'dependency', cause, details);
  }

  return failFromError(ctx, 'dependency', error, details);
};

// Calls rpc:ping, which every lowerdeck RPC server answers after authenticating the request, so
// the check covers reachability, the endpoint path and credentials. Pass the service's own
// client when its calls are authenticated; an endpoint gets a plain client.
export let rpcDependencyCheck = (
  options: {
    name: string;
    severity?: CheckSeverity;
    title?: string;
  } & ({ endpoint: string } | { client: object })
): CheckDefinition =>
  check({
    id: `dependencies.${idPart(options.name)}`,
    title: options.title ?? `${options.name} is reachable`,
    category: 'dependency',
    severity: options.severity ?? 'critical',
    target: options.name,
    run: async ctx => {
      let client =
        'client' in options ? options.client : createClient({ endpoint: options.endpoint });
      let started = performance.now();

      try {
        await pingRpc(client, {
          timeoutMs: rpcPingTimeoutMs,
          signal: ctx.signal,
          retry: false,
          captureErrors: false,
          logResponses: false,
          disableBatching: true
        });
      } catch (error) {
        return rpcPingFailure(ctx, options.name, error);
      }

      let latencyMs = Math.round(performance.now() - started);
      return ctx.pass(`${options.name} answered in ${latencyMs}ms.`, { latencyMs });
    }
  });
