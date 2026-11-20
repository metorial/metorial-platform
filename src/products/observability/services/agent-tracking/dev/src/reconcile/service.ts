import type { AgentTrackingClient } from '@mtsrc/agent-tracking-api-internal';
import type { Tokens } from '@mtsrc/agent-tracking-cost';
import { createOrganizationKeyDeriver, sessionKey } from '@mtsrc/agent-tracking-crypto';
import type { ServiceModel, ServiceSession } from './compare';
import { count, isRecord, timestampOf, tokenComponents } from './tokens';

let sessionPageSize = 100;

let usdUnits: Record<string, number> = { usd: 1, cents: 100 };

export type RemoteSession = Awaited<ReturnType<AgentTrackingClient['session']['get']>>;

type ServiceOrganization = { id: string; hashKeyVersion: number };

let serviceTokens = (tokens: unknown) => {
  let value = isRecord(tokens) ? tokens : {};

  return Object.fromEntries(
    tokenComponents.map(component => [component, count(value[component])])
  ) as Tokens;
};

let amount = (value: unknown) => {
  let parsed = typeof value == 'string' ? Number(value) : value;
  return typeof parsed == 'number' && Number.isFinite(parsed) ? parsed : null;
};

let clientEstimateUsd = (reported: unknown) => {
  if (!Array.isArray(reported)) return null;

  let total: number | null = null;
  for (let entry of reported) {
    if (!isRecord(entry) || entry.basis != 'client_estimate') continue;

    let divisor = usdUnits[String(entry.unit)];
    let value = amount(entry.amount);
    if (!divisor || value === null) continue;

    total = (total ?? 0) + value / divisor;
  }

  return total;
};

export let toServiceSession = (session: RemoteSession): ServiceSession => {
  let summary = isRecord(session.summary) ? session.summary : null;
  let models: ServiceModel[] = (Array.isArray(summary?.models) ? summary.models : []).map(
    (model: Record<string, any>) => ({
      modelId: typeof model.modelId == 'string' ? model.modelId : null,
      rawIds: Array.isArray(model.rawIds)
        ? model.rawIds.filter((id: unknown) => typeof id == 'string')
        : [],
      requests: count(model.requests),
      tokens: serviceTokens(model.tokens),
      reportedCostUsd: clientEstimateUsd(model.costReported),
      computedCostUsd: amount(model.costComputedUsd),
      hasOffering: typeof model.offeringId == 'string',
      pricePeriods: Array.isArray(model.pricePeriodIds) ? model.pricePeriodIds.length : 0
    })
  );

  return {
    sessionKey: session.sessionKey,
    family: session.client.family,
    instanceId: session.instanceId,
    startedAt: timestampOf(session.startedAt),
    summaryStale: !!session.summaryStale,
    requests: count(summary?.requests),
    toolCalls: count(summary?.toolCalls),
    tokens: serviceTokens(summary?.tokens),
    reportedCostUsd: clientEstimateUsd(summary?.costReported),
    computedCostUsd: amount(summary?.costComputedUsd),
    models
  };
};

export let createSessionKeyer = (d: {
  hashSecret: string;
  organization: ServiceOrganization;
}) => {
  let organizationKey = createOrganizationKeyDeriver(d.hashSecret).forOrganization(
    d.organization
  );

  return (d2: { instanceId: string; family: string; sessionId: string }) =>
    sessionKey(organizationKey, d2.instanceId, d2.family, d2.sessionId);
};

export let fetchOrganization = async (
  agentTracking: AgentTrackingClient,
  organizationId: string
): Promise<ServiceOrganization> => {
  let organization = await agentTracking.organization.get({ organizationId });

  return { id: organization.id, hashKeyVersion: organization.hashKeyVersion };
};

export let fetchSessions = async (
  agentTracking: AgentTrackingClient,
  d: { organizationId: string; instanceIds?: string[]; from?: Date }
) => {
  let items: RemoteSession[] = [];
  let after: string | undefined;

  do {
    let page = await agentTracking.session.list({
      organizationId: d.organizationId,
      ...(d.instanceIds ? { instanceIds: d.instanceIds } : {}),
      ...(d.from ? { from: d.from } : {}),
      limit: sessionPageSize,
      ...(after ? { after } : {})
    });

    items.push(...(page.items as RemoteSession[]));
    after = page.pagination.hasMoreAfter ? page.pagination.after : undefined;
  } while (after);

  return items;
};

type SettleOptions = {
  timeoutMs: number;
  intervalMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<unknown>;
};

// A session's summary settles some 30 seconds after its last request; one read straight after
// a session would compare a summary that is still behind. Stale summaries are read again in
// rounds until they settle or the time is up, and the ones still stale are left out.
export let waitForSettled = async <T extends { summaryStale?: boolean | null }>(
  keys: string[],
  fetch: (key: string) => Promise<T>,
  options: SettleOptions
) => {
  let now = options.now ?? Date.now;
  let sleep =
    options.sleep ?? ((ms: number) => new Promise(resolve => setTimeout(resolve, ms)));
  let deadline = now() + options.timeoutMs;

  let settled = new Map<string, T>();
  let pending = [...keys];

  while (true) {
    let stillStale: string[] = [];

    for (let key of pending) {
      let session = await fetch(key);
      if (session.summaryStale) stillStale.push(key);
      else settled.set(key, session);
    }

    pending = stillStale;
    if (!pending.length || now() >= deadline) break;

    await sleep(options.intervalMs);
  }

  return settled;
};
