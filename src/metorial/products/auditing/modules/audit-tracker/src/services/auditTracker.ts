import { Service } from '@lowerdeck/service';
import type { ValidationType } from '@lowerdeck/validation';
import type {
  AuditResource,
  AuditResourceNames,
  ResourceSetItemActionNames,
  ResourceSetItemPayload
} from '@metorial/audit-schema';
import { auditResources } from '@metorial/audit-schema';
import type { AuditScope } from '@metorial/audit-scope';
import { ID } from '@metorial/db';
import { stashAuditEvent } from '../lib/stash';

class AuditTrackerServiceImpl {
  async recordEvent<
    Resource extends AuditResourceNames,
    Action extends ResourceSetItemActionNames<AuditResource, Resource>
  >(
    scope: AuditScope | { auditScope: AuditScope },
    resource: Resource,
    action: Action,
    event: {
      payload: ResourceSetItemPayload<AuditResource, Resource, Action>;
      previousAttributes?: Partial<ResourceSetItemPayload<AuditResource, Resource, Action>>;
    }
  ) {
    let resourceDef = auditResources[resource];
    if (!resourceDef) throw new Error(`Unknown audit resource: ${String(resource)}`);

    let actionDef = (resourceDef.actions as any)[action] as
      | true
      | { validationType: ValidationType<any> }
      | undefined;
    if (!actionDef) {
      throw new Error(`Unknown audit action: ${String(resource)}.${String(action)}`);
    }

    let validationType =
      typeof actionDef === 'object' ? actionDef.validationType : resourceDef.payload;
    let validatedPayload = validationType.validate(event.payload);
    if (!validatedPayload.success) {
      let details = validatedPayload.errors
        .map(error => `${error.path?.join('.') || 'payload'}: ${error.message}`)
        .join(', ');
      throw new Error(`Invalid audit event payload: ${details}`);
    }

    let auditScope = 'auditScope' in scope ? scope.auditScope : scope;

    await stashAuditEvent({
      id: await ID.generateId('auditEvent'),
      resourceTenantOid: auditScope.resourceTenantOid,
      resourceGroupOid: auditScope.resourceGroupOid,
      resourceActorOid: auditScope.resourceActorOid,
      actor: auditScope.actor,
      context: auditScope.context,
      resource: String(resource),
      action: String(action),
      payload: validatedPayload.value,
      previousAttributes: event.previousAttributes,
      recordedAt: new Date()
    });
  }
}

export let auditTrackerService = Service.create(
  'auditTrackerService',
  () => new AuditTrackerServiceImpl()
).build();
