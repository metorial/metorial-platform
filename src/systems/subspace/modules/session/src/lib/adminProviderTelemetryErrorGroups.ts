import type { PaginatorInput } from '@lowerdeck/pagination';

export let adminProviderTelemetryErrorGroupTypes = [
  'message_processing_timeout',
  'message_processing_provider_error',
  'message_processing_system_error',
  'provider_discovery_failed'
] as const;

export type AdminProviderTelemetryErrorGroupListInput = PaginatorInput & {
  providerId?: string;
  tenantId?: string;
  tenantIds?: string[];
  tenantSearch?: string;
  environmentId?: string;
  environmentIds?: string[];
  range?: { from?: Date; to?: Date };
  types?: (typeof adminProviderTelemetryErrorGroupTypes)[number][];
};
