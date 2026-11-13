import type { RecordBilling } from '@metorial/groundstation-spec';
import { nativeLabel, normalizeProvider, own } from './values';

let claudeCodeProviders: Record<string, string> = { firstparty: 'anthropic' };

let label = (value: string | undefined) => nativeLabel(value)?.toLowerCase();

let compact = (value: string | undefined) => value?.toLowerCase().replace(/[^a-z0-9]/g, '');

export let claudeCodeProvider = (raw: string | undefined) => {
  let provider = label(raw);
  if (!provider) return undefined;

  return own(claudeCodeProviders, provider) ?? normalizeProvider(provider);
};

// Claude Code only sends anthropic.plan for subscription (OAuth) logins. Without a plan, any
// provider except a gateway means the requests are paid per token on an API key or cloud account.
export let claudeCodeBilling = (account: {
  provider?: string;
  plan?: string;
  seat?: string;
}): RecordBilling | undefined => {
  let plan = label(account.plan);
  let seat = label(account.seat);

  if (plan) {
    return {
      mode: compact(seat) == 'usagebased' ? 'api' : 'included',
      plan,
      ...(seat ? { seat } : {})
    };
  }

  let provider = label(account.provider);
  if (!provider || provider == 'gateway') return undefined;

  return { mode: 'api' };
};

export let codexBilling = (authMode: string | undefined): RecordBilling | undefined => {
  let mode = compact(authMode);

  if (mode?.startsWith('chatgpt')) return { mode: 'included' };
  if (mode == 'apikey') return { mode: 'api' };

  return undefined;
};

export let genAiBilling = (provider: string | undefined): RecordBilling | undefined =>
  provider == 'github' ? { mode: 'included' } : undefined;
