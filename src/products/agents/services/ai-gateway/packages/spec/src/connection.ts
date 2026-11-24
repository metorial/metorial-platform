export type ProviderConnectionConfig = Record<string, string | number | boolean>;

export type ProviderCredentials = Record<string, string>;

export let connectionCheckOutcomes = ['valid', 'invalid', 'unreachable'] as const;

export type ConnectionCheckOutcome = (typeof connectionCheckOutcomes)[number];

export type ConnectionCheckResult = {
  outcome: ConnectionCheckOutcome;
  message?: string;
  httpStatus?: number;
  modelCount?: number;
};
