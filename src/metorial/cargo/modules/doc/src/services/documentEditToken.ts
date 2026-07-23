import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { Tokens } from '@lowerdeck/tokens';
import { getConfig } from '@metorial/config';
import { db, type Instance, type Organization, type User } from '@metorial/db';
import type { AccessTagSelector, AnyAccessTagSelector } from '@metorial/module-access';

let documentEditTokenTtlMs = 15 * 60 * 1000;
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
  documentId: string;
  instanceId: string;
  organizationId: string;
  accessTagOids?: string[];
  accessActor?: Omit<
    DocumentEditAccessActor,
    'organizationActorOid' | 'consumerProfileOid'
  > & {
    organizationActorOid?: string;
    consumerProfileOid?: string;
  };
  defaultPermissions?: DocumentEditStorePermission[];
  overridePermissions?: boolean;
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

class DocumentEditTokenServiceImpl {
  async issueDocumentEditToken(d: {
    documentId: string;
    instanceId: string;
    organizationId: string;
    accessTags?: AnyAccessTagSelector;
    accessActor?: DocumentEditAccessActor;
    defaultPermissions?: DocumentEditStorePermission[];
    overridePermissions?: boolean;
  }): Promise<DocumentEditToken> {
    let expiresAt = new Date(Date.now() + documentEditTokenTtlMs);
    let token = await documentEditTokens.sign({
      type: 'document_edit',
      data: {
        documentId: d.documentId,
        instanceId: d.instanceId,
        organizationId: d.organizationId,
        accessTagOids: serializeAccessTags(d.accessTags),
        accessActor: d.accessActor
          ? {
              identifier: d.accessActor.identifier,
              name: d.accessActor.name,
              resourceActorId: d.accessActor.resourceActorId,
              organizationActorOid: d.accessActor.organizationActorOid?.toString(),
              consumerProfileOid: d.accessActor.consumerProfileOid?.toString()
            }
          : undefined,
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions
      } satisfies DocumentEditTokenClaims,
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
  }): Promise<{
    owner: DocumentEditOwner;
    accessTags?: AnyAccessTagSelector;
    accessActor?: DocumentEditAccessActor;
    defaultPermissions?: DocumentEditStorePermission[];
    overridePermissions?: boolean;
  }> {
    let payload = await documentEditTokens.verify({
      token: d.token,
      expectedType: 'document_edit'
    });

    if (!payload.verified) throw invalidTokenError();

    let claims = payload.data as Partial<DocumentEditTokenClaims>;
    if (
      !claims.instanceId ||
      !claims.organizationId ||
      claims.documentId !== d.documentId ||
      (d.instanceId && claims.instanceId !== d.instanceId)
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
      owner: {
        type: 'instance',
        organization: instance.organization,
        instance
      },
      accessTags: deserializeAccessTags(claims.accessTagOids),
      accessActor: claims.accessActor
        ? {
            identifier: claims.accessActor.identifier,
            name: claims.accessActor.name,
            resourceActorId: claims.accessActor.resourceActorId,
            organizationActorOid: claims.accessActor.organizationActorOid
              ? BigInt(claims.accessActor.organizationActorOid)
              : undefined,
            consumerProfileOid: claims.accessActor.consumerProfileOid
              ? BigInt(claims.accessActor.consumerProfileOid)
              : undefined
          }
        : undefined,
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
        documentId: 'doc_123',
        instanceId: 'inst_123',
        organizationId: 'org_123',
        ...d.claims
      },
      expiresAt: d.expiresAt ?? new Date(Date.now() + documentEditTokenTtlMs)
    })
};
