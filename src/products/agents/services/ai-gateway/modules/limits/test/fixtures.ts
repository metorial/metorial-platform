import type { Dialect } from '@mtsrc/ai-gateway-dialects';
import type {
  GatewayLimit,
  GatewayPrincipal,
  GatewayUsage,
  PlatformLimit
} from '@mtsrc/ai-gateway-spec';
import { createLimitEventRecorder } from '../src/lib/events';
import { createGatewayLimiter } from '../src/lib/limiter';
import { createMemoryLimitStore, type LimitStore } from '../src/lib/store';

export let noon = Date.UTC(2026, 10, 20, 12, 0, 0);

export let createClock = (start = noon) => {
  let time = start;

  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
    set: (at: number) => {
      time = at;
    }
  };
};

export let principalWith = (
  d: {
    token?: GatewayLimit[];
    instance?: GatewayLimit[];
    platform?: PlatformLimit[];
    tokenId?: string;
    instanceId?: string;
    projectId?: string;
  } = {}
): GatewayPrincipal => ({
  token: {
    id: d.tokenId ?? 'agtk_1',
    consumerRef: null,
    allowedModels: [],
    limits: d.token ?? [],
    metadata: {}
  },
  organization: { id: 'agor_1', ref: 'org' },
  project: {
    id: d.projectId ?? 'agpr_1',
    ref: 'project',
    platformLimits: d.platform ?? [],
    disabled: null,
    billingRestriction: null
  },
  instance: {
    id: d.instanceId ?? 'agin_1',
    ref: 'instance',
    logRetentionDays: 30,
    limits: d.instance ?? [],
    settings: {
      contentLogging: { enabled: false, retentionDays: 7 },
      metorialProviderEnabled: true,
      fallbacksEnabled: true,
      zdrRequired: false
    }
  }
});

export let usageOf = (input: number, output: number): GatewayUsage => ({
  input: { total: input, noCache: input, cacheRead: 0, cacheWrite: 0 },
  output: { total: output, text: output, reasoning: 0 }
});

export let setupLimiter = (d: { store?: LimitStore; start?: number } = {}) => {
  let clock = createClock(d.start);
  let store = d.store ?? createMemoryLimitStore({ now: clock.now });
  let events = createLimitEventRecorder({ store, now: clock.now });
  let limiter = createGatewayLimiter({ store, events, now: clock.now });

  let constant = (value: number) => () => value;

  let acquire = (
    principal: GatewayPrincipal,
    opts: { dialect?: Dialect; estimate?: number | (() => number) } = {}
  ) =>
    limiter.acquire({
      principal,
      dialect: opts.dialect ?? 'openai_chat',
      estimateInputTokens:
        typeof opts.estimate == 'function' ? opts.estimate : constant(opts.estimate ?? 10)
    });

  let settle = (
    principal: GatewayPrincipal,
    opts: { input?: number; output?: number; costUsd?: number; metorialBilled?: boolean } = {}
  ) =>
    limiter.settle({
      principal,
      usage: usageOf(opts.input ?? 0, opts.output ?? 0),
      billedCostUsd: opts.costUsd ?? 0,
      metorialBilled: opts.metorialBilled ?? false
    });

  let drain = () =>
    events.drain({
      tripsBefore: Number.MAX_SAFE_INTEGER,
      usageBefore: Number.MAX_SAFE_INTEGER
    });

  return { clock, store, events, limiter, acquire, settle, drain };
};
