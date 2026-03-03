import { db, Instance } from '@metorial/db';
import { forbiddenError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Scope } from '../definitions';

export type AccessTagSelector = bigint | { oid: bigint } | { accessTagOid: bigint };
export type AccessTagSelectorList = AccessTagSelector[];
export type AnyAccessTagSelector = AccessTagSelector | AccessTagSelectorList;

let getAccessTagSelectorOid = (selector: AccessTagSelector) => {
  if (typeof selector === 'bigint') return selector;
  if ('oid' in selector) return selector.oid;
  return selector.accessTagOid;
};
let getAccessTagSelectorListOids = (selectors: AnyAccessTagSelector) => {
  if (Array.isArray(selectors)) {
    return selectors.map(getAccessTagSelectorOid);
  } else {
    return [getAccessTagSelectorOid(selectors)];
  }
};

class accessTagServiceImpl {
  async createAccessTag(d: { instance: Instance } | { instanceOid: bigint }) {
    let instanceOid = 'instanceOid' in d ? d.instanceOid : d.instance.oid;

    return await db.accessTag.create({
      data: { instanceOid }
    });
  }

  async getAccessTagOids(d: { tags: AnyAccessTagSelector }) {
    return getAccessTagSelectorListOids(d.tags);
  }

  async linkAccessTagToEntity(d: {
    tags: AnyAccessTagSelector;
    accessTagPolicyOid: bigint;
    subspaceSessionId?: string | null;
  }) {
    let oids = getAccessTagSelectorListOids(d.tags);

    return {
      create: oids.map(accessTagOid => ({
        accessTagPolicyOid: d.accessTagPolicyOid,
        subspaceSessionId: d.subspaceSessionId ?? null,
        accessTagOid
      }))
    };
  }

  async getAccessTagFilter(d: {
    tags: AnyAccessTagSelector | undefined;
    roles: Scope[];
    subspaceSessionId?: string;
  }) {
    if (!d.tags) return undefined;

    let oids = getAccessTagSelectorListOids(d.tags);

    return {
      some: {
        accessTagOid: { in: oids },
        accessTagPolicy: {
          roles: { hasSome: d.roles }
        },
        ...(d.subspaceSessionId ? { subspaceSessionId: d.subspaceSessionId } : {})
      }
    };
  }

  async checkResourceAccess(d: {
    tags?: AnyAccessTagSelector;
    roles: Scope[];
    subspaceSessionId?: string;
    checker: (filter: {
      some: {
        accessTagOid: { in: bigint[] };
        accessTagPolicy: {
          roles: { hasSome: Scope[] };
        };
        subspaceSessionId?: string;
      };
    }) => Promise<any>;
  }) {
    let filter = await this.getAccessTagFilter({
      tags: d.tags,
      roles: d.roles,
      subspaceSessionId: d.subspaceSessionId
    });
    if (!filter) return;

    let ok = await d.checker({
      some: filter.some
    });
    if (!ok) {
      throw new ServiceError(
        forbiddenError({
          message: 'You do not have the required access level to perform this action'
        })
      );
    }
  }
}

export let accessTagService = Service.create(
  'accessTagService',
  () => new accessTagServiceImpl()
).build();
