import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { Tokens } from '@lowerdeck/tokens';
import { getConfig } from '@metorial/config';
import { db, type Instance, type Organization, type User } from '@metorial/db';
import type { AccessTagSelector, AnyAccessTagSelector } from '@metorial/module-access';

let documentEditTokenTtlMs = 5 * 60 * 1000;
let documentEditTokenClockSkewMs = 5 * 1000;
let documentEditTokens = new Tokens({
  secret: `${getConfig().encryptionSecret}:document_edit`
});

export type DocumentEditToken = {
  token: string;
  documentId: string;
  expiresAt: Date;
};

export type DocumentEditAccessActor = {
  resourceActorId?: string;
  identifier?: string;
  name: string;
  organizationActorOid?: bigint;
  consumerProfileOid?: bigint;
};

export type DocumentEditStorePermission = 'content_read' | 'content_write';

type DocumentEditTokenClaims = {
  version: 2;
  documentId: string;
  instanceId: string;
  organizationId: string;
  permissions: DocumentEditStorePermission[];
  accessTagOids: string[];
  accessActor: Omit<DocumentEditAccessActor, 'organizationActorOid' | 'consumerProfileOid'> & {
    organizationActorOid?: string;
    consumerProfileOid?: string;
  };
  defaultPermissions: DocumentEditStorePermission[];
  overridePermissions: boolean;
};

let getAccessTagOid = (selector: AccessTagSelector) => {
  if (typeof selector === 'bigint') return selector;
  if ('oid' in selector) return selector.oid;
  return selector.accessTagOid;
};

let serializeAccessTags = (accessTags?: AnyAccessTagSelector) => {
  if (!accessTags) return undefined;
  let selectors = Array.isArray(accessTags) ? accessTags : [accessTags];
  return selectors.map(selector => getAccessTagOid(selector).toString());
};

let deserializeAccessTags = (accessTagOids?: string[]) =>
  accessTagOids?.map(accessTagOid => BigInt(accessTagOid));

export type DocumentEditOwner =
  | {
      type: 'instance';
      organization: Organization;
      instance: Instance;
    }
  | {
      type: 'organization';
      organization: Organization;
    }
  | {
      type: 'user';
      user: User;
    };

let invalidTokenError = () =>
  new ServiceError(forbiddenError({ message: 'Invalid document edit token' }));

let isNonEmptyString = (value: unknown): value is string =>
  typeof value == 'string' && value.trim().length > 0;

let isPermissionList = (value: unknown): value is DocumentEditStorePermission[] =>
  Array.isArray(value) &&
  value.length == new Set(value).size &&
  value.every(permission => permission == 'content_read' || permission == 'content_write');

let isOid = (value: unknown): value is string => {
  if (typeof value != 'string' || !/^[1-9][0-9]*$/.test(value)) return false;

  try {
    return BigInt(value) > 0n;
  } catch {
    return false;
  }
};

let validateClaims = (claims: unknown): DocumentEditTokenClaims => {
  if (!claims || typeof claims != 'object') throw invalidTokenError();

  let value = claims as Partial<DocumentEditTokenClaims>;
  if (
    value.version !== 2 ||
    !isNonEmptyString(value.documentId) ||
    !isNonEmptyString(value.instanceId) ||
    !isNonEmptyString(value.organizationId) ||
    !isPermissionList(value.permissions) ||
    !value.permissions.includes('content_read') ||
    !Array.isArray(value.accessTagOids) ||
    !value.accessTagOids.every(isOid) ||
    value.accessTagOids.length != new Set(value.accessTagOids).size ||
    !isPermissionList(value.defaultPermissions) ||
    typeof value.overridePermissions != 'boolean' ||
    !value.accessActor ||
    typeof value.accessActor != 'object' ||
    !isNonEmptyString(value.accessActor.name)
  ) {
    throw invalidTokenError();
  }

  let actor = value.accessActor;
  let actorSelectors = [
    isNonEmptyString(actor.resourceActorId),
    isOid(actor.organizationActorOid),
    isOid(actor.consumerProfileOid)
  ];
  if (actorSelectors.filter(Boolean).length != 1) throw invalidTokenError();
  if (actor.identifier != null && !isNonEmptyString(actor.identifier)) {
    throw invalidTokenError();
  }

  return value as DocumentEditTokenClaims;
};

class DocumentEditTokenServiceImpl {
  async issueDocumentEditToken(d: {
    documentId: string;
    instanceId: string;
    organizationId: string;
    accessTags?: AnyAccessTagSelector;
    accessActor: DocumentEditAccessActor;
    permissions: DocumentEditStorePermission[];
    defaultPermissions?: DocumentEditStorePermission[];
    overridePermissions?: boolean;
  }): Promise<DocumentEditToken> {
    if (!isPermissionList(d.permissions) || !d.permissions.includes('content_read')) {
      throw new ServiceError(
        forbiddenError({ message: 'Document edit tokens require read access' })
      );
    }

    let claims = validateClaims({
      version: 2,
      documentId: d.documentId,
      instanceId: d.instanceId,
      organizationId: d.organizationId,
      permissions: d.permissions,
      accessTagOids: serializeAccessTags(d.accessTags) ?? [],
      accessActor: {
        identifier: d.accessActor.identifier,
        name: d.accessActor.name,
        resourceActorId: d.accessActor.resourceActorId,
        organizationActorOid: d.accessActor.organizationActorOid?.toString(),
        consumerProfileOid: d.accessActor.consumerProfileOid?.toString()
      },
      defaultPermissions: d.defaultPermissions ?? [],
      overridePermissions: d.overridePermissions ?? false
    } satisfies DocumentEditTokenClaims);
    let expiresAt = new Date(Date.now() + documentEditTokenTtlMs);
    let token = await documentEditTokens.sign({
      type: 'document_edit',
      data: claims,
      expiresAt
    });

    return {
      token,
      documentId: d.documentId,
      expiresAt
    };
  }

  async verifyDocumentEditToken(d: {
    token: string;
    documentId: string;
    instanceId?: string | null;
    organizationId?: string | null;
  }): Promise<{
    owner: Extract<DocumentEditOwner, { type: 'instance' }>;
    documentId: string;
    instanceId: string;
    organizationId: string;
    expiresAt: Date;
    permissions: DocumentEditStorePermission[];
    accessTags: AnyAccessTagSelector;
    accessActor: DocumentEditAccessActor;
    defaultPermissions: DocumentEditStorePermission[];
    overridePermissions: boolean;
  }> {
    let payload: Awaited<ReturnType<(typeof documentEditTokens)['verify']>>;
    try {
      payload = await documentEditTokens.verify({
        token: d.token,
        expectedType: 'document_edit'
      });
    } catch {
      throw invalidTokenError();
    }

    if (!payload.verified || !payload.expiresAt || Number.isNaN(payload.createdAt.getTime())) {
      throw invalidTokenError();
    }
    if (
      payload.expiresAt.getTime() <= payload.createdAt.getTime() ||
      payload.expiresAt.getTime() - payload.createdAt.getTime() >
        documentEditTokenTtlMs + documentEditTokenClockSkewMs ||
      payload.createdAt.getTime() > Date.now() + documentEditTokenClockSkewMs
    ) {
      throw invalidTokenError();
    }

    let claims = validateClaims(payload.data);
    if (
      claims.documentId !== d.documentId ||
      (d.instanceId && claims.instanceId !== d.instanceId) ||
      (d.organizationId && claims.organizationId !== d.organizationId)
    ) {
      throw invalidTokenError();
    }

    let instance = await db.instance.findFirst({
      where: {
        id: claims.instanceId,
        organization: {
          id: claims.organizationId
        }
      },
      include: {
        organization: true
      }
    });

    if (!instance) {
      throw new ServiceError(
        badRequestError({
          message: 'Document edit token references an unknown instance'
        })
      );
    }

    return {
      documentId: claims.documentId,
      instanceId: claims.instanceId,
      organizationId: claims.organizationId,
      expiresAt: payload.expiresAt,
      permissions: claims.permissions,
      owner: {
        type: 'instance',
        organization: instance.organization,
        instance
      },
      accessTags: deserializeAccessTags(claims.accessTagOids) ?? [],
      accessActor: {
        identifier: claims.accessActor.identifier,
        name: claims.accessActor.name,
        resourceActorId: claims.accessActor.resourceActorId,
        organizationActorOid: claims.accessActor.organizationActorOid
          ? BigInt(claims.accessActor.organizationActorOid)
          : undefined,
        consumerProfileOid: claims.accessActor.consumerProfileOid
          ? BigInt(claims.accessActor.consumerProfileOid)
          : undefined
      },
      defaultPermissions: claims.defaultPermissions,
      overridePermissions: claims.overridePermissions
    };
  }
}

export let documentEditTokenService = Service.create(
  'documentEditTokenService',
  () => new DocumentEditTokenServiceImpl()
).build();

export let __documentEditTokenTestUtils = {
  serializeAccessTags,
  deserializeAccessTags,
  readTokenClaims: async (token: string) => {
    let payload = await documentEditTokens.verify({
      token,
      expectedType: 'document_edit'
    });
    if (!payload.verified) throw invalidTokenError();
    return payload.data as Partial<DocumentEditTokenClaims>;
  },
  createToken: async (d: {
    claims?: Partial<DocumentEditTokenClaims>;
    type?: string;
    expiresAt?: Date;
  }) =>
    await documentEditTokens.sign({
      type: d.type ?? 'document_edit',
      data: {
        version: 2,
        documentId: 'doc_123',
        instanceId: 'inst_123',
        organizationId: 'org_123',
        permissions: ['content_read', 'content_write'],
        accessTagOids: [],
        accessActor: {
          name: 'Test actor',
          resourceActorId: 'rac_123'
        },
        defaultPermissions: [],
        overridePermissions: false,
        ...d.claims
      },
      expiresAt: d.expiresAt ?? new Date(Date.now() + documentEditTokenTtlMs)
    })
};
