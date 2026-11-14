import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Organization } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import {
  builtInKinds,
  isBuiltInKind,
  isCustomKindKey,
  mergeKindDefinitions,
  resolveKindDefinition,
  type EntityCardinality
} from '../lib/kinds';
import { reattributionWindowSince } from '../lib/linkRules';
import { getId } from '@mtsrc/agent-tracking-db';
import type { TagOrigin } from '@mtsrc/agent-tracking-spec';
import { Events } from '@mtsrc/agent-tracking-events';

class EntityKindServiceImpl {
  async listKinds(d: { organization: Organization }) {
    let records = await db.entityKind.findMany({
      where: { organizationOid: d.organization.oid }
    });

    return mergeKindDefinitions(records);
  }

  async getKind(d: { organization: Organization; key: string }) {
    let record = await db.entityKind.findUnique({
      where: { organizationOid_key: { organizationOid: d.organization.oid, key: d.key } }
    });

    let kind = resolveKindDefinition(d.key, record);
    if (!kind) throw new ServiceError(notFoundError('entity_kind', d.key));

    return kind;
  }

  async upsertKind(d: {
    organization: Organization;
    input: {
      key: string;
      name?: string;
      cardinality?: EntityCardinality;
      attributes?: {
        description?: string | null;
        tagOrigins?: TagOrigin[];
        queryableAttributes?: string[];
      };
    };
  }) {
    let key = d.input.key.trim().toLowerCase();
    let builtIn = builtInKinds.find(kind => kind.key == key);

    if (!builtIn && !isCustomKindKey(key)) {
      throw new ServiceError(
        badRequestError({
          message: `Unknown kind "${d.input.key}": use a built-in kind or "custom:<slug>".`
        })
      );
    }

    if (builtIn && !builtIn.cardinalityConfigurable && d.input.cardinality) {
      throw new ServiceError(
        badRequestError({ message: `The cardinality of "${key}" cannot be changed.` })
      );
    }

    if (builtIn && !builtIn.taggable && d.input.attributes?.tagOrigins) {
      throw new ServiceError(
        badRequestError({
          message: `Entities of kind "${key}" cannot be assigned through tags.`
        })
      );
    }

    let existing = await db.entityKind.findUnique({
      where: { organizationOid_key: { organizationOid: d.organization.oid, key } }
    });

    if (!existing && !builtIn && !d.input.name) {
      throw new ServiceError(badRequestError({ message: 'A custom kind needs a name.' }));
    }

    let before = resolveKindDefinition(
      key,
      existing && !existing.archivedAt ? existing : null
    );

    let attributes = { ...existing?.attributes };
    if (d.input.attributes?.description !== undefined) {
      attributes.description = d.input.attributes.description ?? undefined;
    }
    if (d.input.attributes?.tagOrigins) {
      attributes.tagOrigins = [...new Set(d.input.attributes.tagOrigins)];
    }
    if (d.input.attributes?.queryableAttributes) {
      attributes.queryableAttributes = [...new Set(d.input.attributes.queryableAttributes)];
    }

    let name = d.input.name ?? existing?.name ?? builtIn?.name ?? key;
    let cardinality = d.input.cardinality ?? existing?.cardinality ?? builtIn?.cardinality;

    let record = await db.entityKind.upsert({
      where: { organizationOid_key: { organizationOid: d.organization.oid, key } },
      create: {
        ...getId('entityKind'),
        key,
        name,
        cardinality,
        attributes,
        organizationOid: d.organization.oid
      },
      update: { name, cardinality, attributes, archivedAt: null }
    });

    let kind = resolveKindDefinition(key, record)!;

    let tagOriginsChanged =
      !!before && [...before.tagOrigins].sort().join() != [...kind.tagOrigins].sort().join();

    if (tagOriginsChanged) {
      await Events.fire('entities.kind.changed:after', {
        organizationId: d.organization.id,
        since: reattributionWindowSince()
      });
    }

    return kind;
  }

  async assertKindExists(d: { organization: Organization; key: string }) {
    if (isBuiltInKind(d.key)) return;

    await this.getKind(d);
  }
}

export let entityKindService = Service.create(
  'entityKindService',
  () => new EntityKindServiceImpl()
).build();
