import type { BillingMode, BillingSource } from '@mtsrc/agent-tracking-spec';
import type { RequestTokens } from '@mtsrc/agent-tracking-model-resolver';
import { matchDeclaration, type MatchableDeclaration } from './match';

export type Billing = { mode: BillingMode; source?: BillingSource; plan?: string };

export type DeclarationLookup = (d: {
  at: Date;
  userId?: string;
  agentId?: string;
}) => MatchableDeclaration | undefined;

export type BillingEntry = {
  occurredAt: Date;
  type: string;
  purpose?: string;
  tokens?: RequestTokens;
  billing: Billing;
};

let unknown: Billing = { mode: 'unknown' };

let reportedModes = new Set<BillingMode>(['included', 'overage', 'api']);

// Legacy records carry only `client.authMode`; Codex reports its ChatGPT sign-in as `Chatgpt`.
let authModeBilling = (authMode: string | undefined): Billing | undefined => {
  let normalized = authMode?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normalized) return undefined;

  if (normalized == 'subscription' || normalized.startsWith('chatgpt')) {
    return { mode: 'included', source: 'reported' };
  }
  if (normalized == 'apikey') return { mode: 'api', source: 'reported' };

  return undefined;
};

let text = (value: unknown) => (typeof value == 'string' && value ? value : undefined);

export let reportedBilling = (d: { billing: unknown; authMode?: string }): Billing => {
  let billing =
    typeof d.billing == 'object' && d.billing !== null
      ? (d.billing as Record<string, unknown>)
      : undefined;
  let mode = text(billing?.mode) as BillingMode | undefined;

  if (mode && reportedModes.has(mode)) {
    let plan = text(billing?.plan);
    return { mode, source: 'reported', ...(plan ? { plan } : {}) };
  }

  return authModeBilling(d.authMode) ?? unknown;
};

// Families whose session-level provider says where requests go, whatever the sign-in: Codex
// reports `auth_mode` from the login, but a configured Azure or Bedrock provider bills per token.
let firstPartyProviders: Record<string, string> = { codex: 'openai' };

export let sessionProviderBilling = (d: {
  family: string;
  provider: string | undefined;
}): Billing | undefined => {
  let firstParty = Object.hasOwn(firstPartyProviders, d.family)
    ? firstPartyProviders[d.family]
    : undefined;
  if (!firstParty || !d.provider || d.provider == firstParty) return undefined;

  return { mode: 'api', source: 'client' };
};

// Clients sold only as a subscription.
let subscriptionOnlyFamilies = new Set(['kiro']);

export let defaultBillingOf = (family: string): Billing | undefined =>
  subscriptionOnlyFamilies.has(family) ? { mode: 'included', source: 'default' } : undefined;

export let isSubscriptionBilling = (billing: Billing) =>
  billing.mode == 'included' || billing.mode == 'overage';

let mainThreadTtl = (entry: BillingEntry): '1h' | '5m' | undefined => {
  if (entry.type != 'model.request' || entry.purpose != 'main' || !entry.tokens)
    return undefined;
  if (entry.tokens.cacheWrite1h) return '1h';
  if (entry.tokens.cacheWrite5m) return '5m';

  return undefined;
};

// Claude Code caches its own turns for an hour on a subscription and drops to the five-minute TTL
// while drawing on usage credits (08 §9.4). A session that showed the 1-hour TTL on its main thread
// and later writes only 5-minute entries there is on overage until the 1-hour TTL returns; every
// plan request in between, subagents included, is flagged. Sessions that never show the 1-hour
// TTL (forced TTL, or already on overage at the start) aren't flagged.
export let inferClaudeCodeOverage = (entries: BillingEntry[]) => {
  let ordered = entries
    .filter(entry => entry.billing.mode == 'included' && entry.billing.source == 'reported')
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  if (!ordered.some(entry => mainThreadTtl(entry) == '1h')) return 0;

  let overage = false;
  let flagged = 0;

  for (let entry of ordered) {
    let ttl = mainThreadTtl(entry);
    if (ttl) overage = ttl == '5m';

    if (overage) {
      entry.billing = { ...entry.billing, mode: 'overage', source: 'inferred' };
      flagged++;
    }
  }

  return flagged;
};

export let declaredBilling = (
  declaration: MatchableDeclaration | undefined
): Billing | undefined =>
  declaration
    ? {
        mode: declaration.mode,
        source: 'declared',
        ...(declaration.plan ? { plan: declaration.plan } : {})
      }
    : undefined;

export let createDeclarationLookup = (d: {
  declarations: MatchableDeclaration[];
  organizationId: string;
  projectId: string;
}): DeclarationLookup | null => {
  if (!d.declarations.length) return null;

  return request =>
    matchDeclaration(d.declarations, {
      at: request.at,
      organizationId: d.organizationId,
      projectId: d.projectId,
      ...(request.userId ? { userId: request.userId } : {}),
      ...(request.agentId ? { agentId: request.agentId } : {})
    });
};

// Settle's order (08 §9.4): what the request reported, then the session's client signals, then the
// inferred overage switch, then an admin declaration, then the agent's default.
export let resolveBillings = (d: {
  family: string;
  agentId?: string;
  sessionProvider?: string;
  entries: (BillingEntry & { userId?: string })[];
  declarations?: DeclarationLookup | null;
  defaultBilling?: Billing;
}) => {
  let client = sessionProviderBilling({ family: d.family, provider: d.sessionProvider });

  for (let entry of d.entries) {
    if (client) entry.billing = client;
  }

  if (d.family == 'claude-code') inferClaudeCodeOverage(d.entries);

  for (let entry of d.entries) {
    if (entry.billing.mode != 'unknown') continue;

    let declared = declaredBilling(
      d.declarations?.({ at: entry.occurredAt, userId: entry.userId, agentId: d.agentId })
    );

    entry.billing = declared ?? d.defaultBilling ?? unknown;
  }
};
