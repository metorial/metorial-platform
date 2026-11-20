import type { ResolvedInstanceSettings } from './settings';
import type { GatewayTokenLimits, GatewayTokenMetadata } from './token';

export type GatewayPrincipal = {
  token: {
    id: string;
    consumerRef: string | null;
    allowedModels: string[];
    limits: GatewayTokenLimits;
    metadata: GatewayTokenMetadata;
  };

  organization: { id: string; ref: string };
  project: { id: string; ref: string };
  instance: {
    id: string;
    ref: string;
    logRetentionDays: number;
    settings: ResolvedInstanceSettings;
  };
};
