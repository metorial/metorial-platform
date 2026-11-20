import { v } from '@lowerdeck/validation';
import { gatewayLimitsSchema, type GatewayLimit } from './limits';

export let maxTokenMetadataEntries = 20;

export let gatewayTokenLimitsSchema = gatewayLimitsSchema;

export type GatewayTokenLimits = GatewayLimit[];

export let defaultGatewayTokenLimits: GatewayTokenLimits = [];

export let gatewayTokenMetadataSchema = v.record(v.string({ modifiers: [v.maxLength(256)] }));

export type GatewayTokenMetadata = Record<string, string>;
