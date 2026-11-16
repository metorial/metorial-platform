import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { createAuditScope, type AuditActor, type AuditScope } from '@metorial/audit-scope';
import type { Context } from '@metorial/context';
import type { Instance, Project, ResourceActor } from '@metorial/db';
import { db } from '@metorial/db';
import {
  createResourceAuthorization,
  type AccessTagSelector,
  type AnyAccessTagSelector
} from '@metorial/module-access';
import type { AssistantAccess, AssistantStorePermission } from './implementation';

export type AssistantAccessClaims = {
  restricted: boolean;
  resourceActorId: string;
  accessTagOids: string[];
  defaultPermissions?: AssistantStorePermission[];
  overridePermissions?: boolean;
  audit?: {
    actor: AuditActor;
    organizationActorOid?: string;
    context: Context;
  };
};

let getAccessTagOid = (selector: AccessTagSelector) => {
  if (typeof selector === 'bigint') return selector;
  if ('oid' in selector) return selector.oid;
  return selector.accessTagOid;
};

let serializeAccessTags = (accessTags?: AnyAccessTagSelector) => {
  if (!accessTags) return [];

  let selectors = Array.isArray(accessTags) ? accessTags : [accessTags];
  return selectors.map(selector => getAccessTagOid(selector).toString());
};

let serializeAuditScope = (auditScope?: AuditScope) =>
  auditScope
    ? {
        actor: auditScope.actor,
        organizationActorOid: auditScope.organizationActorOid?.toString(),
        context: { ip: auditScope.context.ip, ua: auditScope.context.ua ?? null }
      }
    : undefined;

let forbidden = () =>
  new ServiceError(
    forbiddenError({
      message: 'The assistant no longer has access on behalf of this actor.'
    })
  );

export let serializeAssistantAccess = (d: {
  actor: ResourceActor;
  access: AssistantAccess;
}): AssistantAccessClaims => ({
  restricted: d.access.authorization.type == 'restricted',
  resourceActorId: d.actor.id,
  accessTagOids: serializeAccessTags(d.access.accessTags),
  defaultPermissions: d.access.defaultPermissions,
  overridePermissions: d.access.overridePermissions,
  audit: serializeAuditScope(d.access.auditScope)
});

let restoreAuditScope = (d: {
  instance: Instance;
  actor: ResourceActor;
  claims: AssistantAccessClaims;
}) =>
  createAuditScope({
    organization: { oid: d.instance.organizationOid },
    instance: d.instance,
    organizationActor: d.claims.audit?.organizationActorOid
      ? { oid: BigInt(d.claims.audit.organizationActorOid) }
      : null,
    actor: d.claims.audit?.actor ?? { type: 'resource_actor', id: d.actor.id },
    context: d.claims.audit?.context ?? { ip: '0.0.0.0' }
  });

export let restoreAssistantAccess = async (d: {
  project: Project;
  instance: Instance;
  claims: AssistantAccessClaims;
}): Promise<AssistantAccess & { actor: ResourceActor; auditScope: AuditScope }> => {
  let actor = await db.resourceActor.findFirst({
    where: {
      id: d.claims.resourceActorId,
      projectOid: d.project.oid
    }
  });
  if (!actor) throw forbidden();

  let auditScope = restoreAuditScope({ instance: d.instance, actor, claims: d.claims });

  if (!d.claims.restricted) {
    return {
      actor,
      auditScope,
      authorization: createResourceAuthorization({
        restricted: false,
        resourceActor: actor
      }),
      defaultPermissions: d.claims.defaultPermissions,
      overridePermissions: d.claims.overridePermissions
    };
  }

  if (actor.consumerProfileOid == null) throw forbidden();

  let consumerProfile = await db.consumerProfile.findFirst({
    where: {
      oid: actor.consumerProfileOid,
      instanceOid: d.instance.oid,
      status: 'active'
    },
    select: {
      oid: true,
      instanceOid: true
    }
  });
  if (!consumerProfile) throw forbidden();

  let accessTags = d.claims.accessTagOids.map(oid => BigInt(oid));

  return {
    actor,
    auditScope,
    accessTags,
    authorization: createResourceAuthorization({
      restricted: true,
      resourceActor: actor,
      accessTags,
      project: d.project,
      instance: d.instance,
      consumerProfile
    })
  };
};
