import { v } from '@lowerdeck/validation';
import type { GatewayLimit, PlatformLimit } from './limits';
import type { ResolvedInstanceSettings } from './settings';
import type { GatewayTokenLimits, GatewayTokenMetadata } from './token';

export let projectRestrictionSchema = v.nullable(
  v.object({ reason: v.nullable(v.string({ modifiers: [v.maxLength(1000)] })) })
);

export type ProjectRestriction = { reason: string | null } | null;

export type GatewayPrincipal = {
  token: {
    id: string;
    consumerRef: string | null;
    allowedModels: string[];
    limits: GatewayTokenLimits;
    metadata: GatewayTokenMetadata;
  };

  organization: { id: string; ref: string };
  project: {
    id: string;
    ref: string;
    platformLimits: PlatformLimit[];
    disabled: ProjectRestriction;
    billingRestriction: ProjectRestriction;
  };
  instance: {
    id: string;
    ref: string;
    logRetentionDays: number;
    settings: ResolvedInstanceSettings;
    limits: GatewayLimit[];
  };
};
