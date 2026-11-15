import { Service } from '@lowerdeck/service';
import type {
  AuditResource,
  AuditResourceNames,
  ResourceSetItemActionNames,
  ResourceSetItemPayload
} from '@metorial/audit-schema';
import { auditResources } from '@metorial/audit-schema';
import type { AuditScope } from '@metorial/audit-scope';
import {
  createAuditRecorder,
  type AuditEventInput as StashAuditEventInput
} from '@metorial/audit-stash';

export type AuditEventInput<
  Resource extends AuditResourceNames = AuditResourceNames,
  Action extends ResourceSetItemActionNames<AuditResource, Resource> = any
> = StashAuditEventInput<AuditResource, Resource, Action>;

let recorder = createAuditRecorder(auditResources);

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
      previousPayload?: ResourceSetItemPayload<AuditResource, Resource, Action>;
      recordedAt?: Date;
    }
  ) {
    await recorder.recordEvent(scope, resource, action, event);
  }

  async recordEvents(events: AuditEventInput<any, any>[]) {
    await recorder.recordEvents(events);
  }
}

export let auditTrackerService = Service.create(
  'auditTrackerService',
  () => new AuditTrackerServiceImpl()
).build();
