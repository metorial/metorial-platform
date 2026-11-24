import { lookup } from 'node:dns/promises';
import { connect as connectTcp } from 'node:net';
import { connect as connectTls, type PeerCertificate } from 'node:tls';
import { abortable } from './abortable';
import type { CheckContext, CheckOutcome } from './check';
import { httpStatusKinds } from './errors';

let defaultWarnLatencyMs = {
  sql: 250,
  redis: 50,
  mongo: 250,
  nats: 100,
  http: 1_000,
  tcp: 250
};

let latencyAttempts = 3;

let dayMs = 24 * 60 * 60 * 1000;

export type ProbeRun = (ctx: CheckContext) => Promise<CheckOutcome>;

export interface LatencyProbeOptions {
  warnLatencyMs?: number;
}

interface LatencySample {
  latencyMs: number;
  attemptsMs: number[];
}

let measure = async <T>(fn: () => Promise<T>) => {
  let started = performance.now();
  let value = await fn();

  return { value, latencyMs: Math.round(performance.now() - started) };
};

// Every replica runs its checks at the same moment, so one request can land in a transient
// stall (a packet retransmit, a busy event loop) that says nothing about the dependency. A slow
// answer is retried and only the fastest attempt counts, so a warning means it stayed slow.
let measureFastest = async (
  fn: () => Promise<unknown>,
  warnLatencyMs: number,
  signal: AbortSignal
): Promise<LatencySample> => {
  let attemptsMs: number[] = [];

  while (attemptsMs.length < latencyAttempts) {
    let { latencyMs } = await measure(fn);
    attemptsMs.push(latencyMs);

    if (latencyMs <= warnLatencyMs || signal.aborted) break;
  }

  return { latencyMs: Math.min(...attemptsMs), attemptsMs };
};

let latencyOutcome = (
  label: string,
  { latencyMs, attemptsMs }: LatencySample,
  warnLatencyMs: number,
  extra: Record<string, unknown> = {}
): CheckOutcome => {
  let details =
    attemptsMs.length > 1 ? { ...extra, latencyMs, attemptsMs } : { ...extra, latencyMs };

  if (latencyMs <= warnLatencyMs) {
    return { status: 'pass', message: `${label} answered in ${latencyMs}ms.`, details };
  }

  let attempts = attemptsMs.length > 1 ? ` (fastest of ${attemptsMs.length} attempts)` : '';

  return {
    status: 'warn',
    message: `${label} answered in ${latencyMs}ms, slower than ${warnLatencyMs}ms${attempts}.`,
    details: { ...details, thresholdMs: warnLatencyMs }
  };
};

let call =
  (
    label: string,
    run: (signal: AbortSignal) => Promise<unknown>,
    warnLatencyMs: number
  ): ProbeRun =>
  async ctx => {
    let sample = await measureFastest(() => run(ctx.signal), warnLatencyMs, ctx.signal);
    return latencyOutcome(label, sample, warnLatencyMs);
  };

let sql = (opts: { query: (signal: AbortSignal) => Promise<unknown> } & LatencyProbeOptions) =>
  call('The database', opts.query, opts.warnLatencyMs ?? defaultWarnLatencyMs.sql);

let redis = (
  opts: { client: { ping: () => Promise<unknown> } } & LatencyProbeOptions
): ProbeRun => {
  let warnLatencyMs = opts.warnLatencyMs ?? defaultWarnLatencyMs.redis;

  return async ctx => {
    let { latencyMs: connectMs } = await measure(() => opts.client.ping());
    let sample = await measureFastest(() => opts.client.ping(), warnLatencyMs, ctx.signal);

    return latencyOutcome('Redis', sample, warnLatencyMs, { connectMs });
  };
};

let mongo = (
  opts: { ping: (signal: AbortSignal) => Promise<unknown> } & LatencyProbeOptions
) => call('MongoDB', opts.ping, opts.warnLatencyMs ?? defaultWarnLatencyMs.mongo);

let nats = (opts: { connection: { flush: () => Promise<void> } } & LatencyProbeOptions) =>
  call('NATS', () => opts.connection.flush(), opts.warnLatencyMs ?? defaultWarnLatencyMs.nats);

let http =
  (
    opts: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      expectStatus?: (status: number) => boolean;
      fetch?: typeof fetch;
    } & LatencyProbeOptions
  ): ProbeRun =>
  async ctx => {
    let fetchImpl = opts.fetch ?? fetch;
    let method = opts.method ?? 'GET';
    let expectStatus = opts.expectStatus ?? (status => status < 400);

    let { value: response, latencyMs } = await measure(() =>
      fetchImpl(opts.url, {
        method,
        headers: opts.headers,
        signal: ctx.signal,
        redirect: 'manual'
      })
    );
    await response.body?.cancel().catch(() => {});

    if (!expectStatus(response.status)) {
      return {
        status: 'fail',
        message: `${method} ${opts.url} answered ${response.status}.`,
        details: {
          url: opts.url,
          status: response.status,
          kind: httpStatusKinds[String(response.status)] ?? 'unknown',
          latencyMs
        }
      };
    }

    return latencyOutcome(
      `${method} ${opts.url}`,
      { latencyMs, attemptsMs: [latencyMs] },
      opts.warnLatencyMs ?? defaultWarnLatencyMs.http,
      { url: opts.url, status: response.status }
    );
  };

let tcp =
  (opts: { host: string; port: number } & LatencyProbeOptions): ProbeRun =>
  async ctx => {
    let warnLatencyMs = opts.warnLatencyMs ?? defaultWarnLatencyMs.tcp;
    let sample = await measureFastest(
      () =>
        new Promise<void>((resolve, reject) => {
          let socket = connectTcp({ host: opts.host, port: opts.port });
          let onAbort = () => socket.destroy(ctx.signal.reason);

          ctx.signal.addEventListener('abort', onAbort, { once: true });
          socket.once('connect', () => {
            ctx.signal.removeEventListener('abort', onAbort);
            socket.end();
            resolve();
          });
          socket.once('error', error => {
            ctx.signal.removeEventListener('abort', onAbort);
            reject(error);
          });
        }),
      warnLatencyMs,
      ctx.signal
    );

    return latencyOutcome(`${opts.host}:${opts.port}`, sample, warnLatencyMs, {
      host: opts.host,
      port: opts.port
    });
  };

let dns =
  (opts: { hostname: string }): ProbeRun =>
  async ctx => {
    let addresses = await abortable(lookup(opts.hostname, { all: true }), ctx.signal);

    return {
      status: 'pass',
      message: `${opts.hostname} resolves to ${addresses.map(item => item.address).join(', ')}.`,
      details: { hostname: opts.hostname, addresses: addresses.map(item => item.address) }
    };
  };

let readCertificate = (
  opts: { host: string; port: number; servername: string },
  signal: AbortSignal
) =>
  new Promise<{ certificate: PeerCertificate; authorizationError: string | null }>(
    (resolve, reject) => {
      let socket = connectTls({
        host: opts.host,
        port: opts.port,
        servername: opts.servername,
        rejectUnauthorized: false
      });
      let onAbort = () => socket.destroy(signal.reason);

      signal.addEventListener('abort', onAbort, { once: true });
      socket.once('secureConnect', () => {
        signal.removeEventListener('abort', onAbort);

        let certificate = socket.getPeerCertificate();
        let authorizationError = socket.authorized
          ? null
          : String(socket.authorizationError ?? 'UNKNOWN');

        socket.end();
        resolve({ certificate, authorizationError });
      });
      socket.once('error', (error: Error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      });
    }
  );

let tlsCertificate =
  (opts: { host: string; port?: number; servername?: string; warnDays?: number }): ProbeRun =>
  async ctx => {
    let port = opts.port ?? 443;
    let warnDays = opts.warnDays ?? 14;
    let { certificate, authorizationError } = await readCertificate(
      { host: opts.host, port, servername: opts.servername ?? opts.host },
      ctx.signal
    );

    let validTo = certificate.valid_to ? Date.parse(certificate.valid_to) : NaN;
    let daysLeft = Number.isNaN(validTo) ? null : Math.floor((validTo - Date.now()) / dayMs);
    let details = {
      host: opts.host,
      port,
      subject: certificate.subject?.CN ?? null,
      issuer: certificate.issuer?.CN ?? null,
      validTo: Number.isNaN(validTo) ? null : new Date(validTo).toISOString(),
      daysLeft
    };

    if (authorizationError) {
      return {
        status: 'fail',
        message: `The certificate of ${opts.host}:${port} is not trusted (${authorizationError}).`,
        details: { ...details, code: authorizationError }
      };
    }

    if (daysLeft !== null && daysLeft < warnDays) {
      return {
        status: 'warn',
        message: `The certificate of ${opts.host}:${port} expires in ${daysLeft} days.`,
        details
      };
    }

    return {
      status: 'pass',
      message: `The certificate of ${opts.host}:${port} is valid for ${daysLeft ?? '?'} more days.`,
      details
    };
  };

export let probes = { sql, redis, mongo, nats, http, tcp, dns, tlsCertificate };
