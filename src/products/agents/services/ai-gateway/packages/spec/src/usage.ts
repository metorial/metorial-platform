// Mirrors the AI SDK LanguageModelV4 usage shape, with missing counts already filled in, so the
// gateway logs and prices one normalized form regardless of which provider reported it.
export type GatewayUsage = {
  input: {
    total: number;
    noCache: number;
    cacheRead: number;
    cacheWrite: number;
  };
  output: {
    total: number;
    text: number;
    reasoning: number;
  };
};

export type GatewayCostComponent =
  'input' | 'cacheRead' | 'cacheWrite' | 'output' | 'reasoning';

export type GatewayCost = {
  currency: 'USD';
  priced: boolean;
  components: Record<GatewayCostComponent, number>;
  totalUsd: number;
};

export let emptyUsage = (): GatewayUsage => ({
  input: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  output: { total: 0, text: 0, reasoning: 0 }
});
