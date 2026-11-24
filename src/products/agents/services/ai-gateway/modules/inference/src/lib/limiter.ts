import type { Dialect, GatewayError } from '@mtsrc/ai-gateway-dialects';
import type { GatewayPrincipal, GatewayUsage } from '@mtsrc/ai-gateway-spec';

export type LimitDecision =
  | {
      allowed: true;
      headers: Record<string, string>;
      // Set when the plan's Metorial-billed allowance is used up: the request may still be
      // served over the customer's own connections, never over Metorial's.
      metorialBillingLimit?: { error: GatewayError; onEnforced: () => void };
    }
  | { allowed: false; error: GatewayError; headers: Record<string, string> };

// `acquire` runs before routing and counts the request; `settle` runs once a response finished
// and charges what it actually used. Requests that fail upstream are counted but never charged.
export type InferenceLimiter = {
  acquire: (d: {
    principal: GatewayPrincipal;
    dialect: Dialect;
    estimateInputTokens: () => number;
  }) => Promise<LimitDecision>;
  settle: (d: {
    principal: GatewayPrincipal;
    usage: GatewayUsage;
    billedCostUsd: number;
    metorialBilled: boolean;
  }) => Promise<void>;
};

export let unlimitedLimiter: InferenceLimiter = {
  acquire: async () => ({ allowed: true, headers: {} }),
  settle: async () => {}
};
