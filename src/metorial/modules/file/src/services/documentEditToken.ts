import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { Tokens } from '@lowerdeck/tokens';
import { getConfig } from '@metorial/config';
import { db } from '@metorial/db';
import type { CargoAccessActor, CargoStorePermission } from './access';
import type { FileOwner } from './file';

let documentEditTokenTtlMs = 15 * 60 * 1000;
let documentEditTokens = new Tokens({
  secret: `${getConfig().encryptionSecret}:document_edit`
});

export type DocumentEditToken = {
  token: string;
  documentId: string;
  expiresAt: Date;
};

type DocumentEditTokenClaims = {
  documentId: string;
  instanceId: string;
  organizationId: string;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
};

let invalidTokenError = () =>
  new ServiceError(forbiddenError({ message: 'Invalid document edit token' }));

class DocumentEditTokenServiceImpl {
  async issueDocumentEditToken(d: {
    documentId: string;
    instanceId: string;
    organizationId: string;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }): Promise<DocumentEditToken> {
    let expiresAt = new Date(Date.now() + documentEditTokenTtlMs);
    let claims: DocumentEditTokenClaims = {
      documentId: d.documentId,
      instanceId: d.instanceId,
      organizationId: d.organizationId,
      accessActor: d.accessActor,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions
    };
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
  }): Promise<{
    owner: FileOwner;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
    actorId?: string;
  }> {
    let payload = await documentEditTokens.verify({
      token: d.token,
      expectedType: 'document_edit'
    });

    if (!payload.verified) {
      throw invalidTokenError();
    }

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
        organization: true,
        project: true
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
      accessActor: claims.accessActor,
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
