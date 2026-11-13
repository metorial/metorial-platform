import { Service } from '@lowerdeck/service';
import type { Entity, Organization } from '@mtsrc/agent-tracking-db';
import type { EntityAttributes } from '@mtsrc/agent-tracking-spec';
import {
  findEntityByIdentifier,
  findOrCreateDiscovered,
  followMerged,
  touchLastSeen
} from '../lib/resolve';
import type { IdentifierInput } from '../lib/normalize';

class EntityResolutionServiceImpl {
  async findByIdentifier(d: {
    organizationOid: bigint;
    kind: string;
    type: string;
    value: string;
  }) {
    return await findEntityByIdentifier(d);
  }

  async findOrCreateDiscovered(d: {
    organization: Pick<Organization, 'oid'>;
    kind: string;
    identifiers: IdentifierInput[];
    name?: string | null;
    attributes?: EntityAttributes;
    needsReview?: boolean;
  }) {
    return await findOrCreateDiscovered(d);
  }

  async followMerged(d: { entity: Entity }) {
    return await followMerged(d.entity);
  }

  async touchLastSeen(d: { entityIds: string[]; at?: Date }) {
    await touchLastSeen(d.entityIds, d.at);
  }
}

export let entityResolutionService = Service.create(
  'entityResolutionService',
  () => new EntityResolutionServiceImpl()
).build();
