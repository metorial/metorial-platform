import type { ValidationType, ValidationTypeValue } from '@lowerdeck/validation';
import type { AuditLog } from '@metorial/module-audit-log';

export type AuditLogDestinationEvent = AuditLog;

export type AuditLogDestinationDefinition<ProviderData extends ValidationType<any>> = {
  providerData: ProviderData;
  sanitizeProviderData: (
    providerData: ValidationTypeValue<ProviderData>
  ) => Record<string, string>;
  deliver: (d: {
    providerData: ValidationTypeValue<ProviderData>;
    events: AuditLogDestinationEvent[];
  }) => Promise<void>;
};

export type InferAuditLogDestinationProviderData<Destination> =
  Destination extends AuditLogDestinationDefinition<infer ProviderData>
    ? ValidationTypeValue<ProviderData>
    : never;

export let destination = <ProviderData extends ValidationType<any>>(
  definition: AuditLogDestinationDefinition<ProviderData>
) => definition;
