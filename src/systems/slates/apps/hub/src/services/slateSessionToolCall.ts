import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { SlatesParticipant } from '@slates/proto';
import { addDays, differenceInMinutes } from 'date-fns';
import { PublicUrlPurpose } from 'object-storage-client';
import type { SlateInvocation, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { getStoredAttachmentsStorageKey } from '../lib/invocation/store';
import { invocationsBucketRecord, storage } from '../storage';
import { slateAuthHandlerService } from './slateInstanceAuthHandler';
import { slateInvocationService } from './slateInvocation';
import { slateSessionService } from './slateSession';

let include = {
  action: true,
  invocation: {
    include: {
      slateInvocationAttachment: {
        include: {
          attachments: true
        }
      }
    }
  },
  session: true,
  slateVersion: true
};

type SlateToolCallAttachment = {
  content:
    | {
        type: 'url';
        url: string;
      }
    | {
        type: 'content';
        encoding: 'base64' | 'utf-8';
        content: string;
      };
  mimeType?: string;
};

let ATTACHMENT_EXPIRATION_DAYS = 7;

class slateSessionToolCallServiceImpl {
  async createSlateToolCall(d: {
    input: {
      tenantId: string;
      sessionId: string;

      toolId: string;
      authConfigId?: string;
      input: Record<string, any>;
      participants: SlatesParticipant[];
    };
  }) {
    let session = await db.slateSession.findFirst({
      where: {
        tenant: { OR: [{ id: d.input.tenantId }, { identifier: d.input.tenantId }] },
        id: d.input.sessionId
      },
      include: {
        slate: true,
        slateInstance: { include: { currentConfig: true } },
        slateVersion: { include: { specification: true } },
        tenant: true
      }
    });
    if (!session) throw new ServiceError(notFoundError('slate.session'));
    if (!session.slate.currentVersionOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider does not have a current version set.'
        })
      );
    }
    if (!session.slateInstance.currentConfig) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider instance does not have a current configuration set.'
        })
      );
    }

    let lastActiveOrCreatedAt = session.lastActiveAt ?? session.createdAt;
    if (Math.abs(differenceInMinutes(new Date(), lastActiveOrCreatedAt)) > 5) {
      let version = await slateSessionService.getSessionVersion({
        slate: session.slate,
        slateInstance: session.slateInstance
      });

      if (version.oid !== session.slateVersionOid) {
        session.slateVersion = version;
        await db.slateSession.updateMany({
          where: { oid: session.oid },
          data: { slateVersionOid: version.oid }
        });
      }
    }

    let version = session.slateVersion;
    if (
      version.status !== 'active' ||
      !version.specification ||
      !version.providerDeploymentInfo
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider is not active or does not have an active deployment.'
        })
      );
    }

    if (d.input.authConfigId && !version.specification.authMethods.length) {
      throw new ServiceError(
        badRequestError({
          code: 'authentication_not_supported',
          message: 'Provider does not have any authentication methods configured.'
        })
      );
    }
    if (!d.input.authConfigId && version.specification.authMethods.length) {
      throw new ServiceError(
        badRequestError({
          code: 'authentication_required',
          message: 'Authentication method is required for this provider.'
        })
      );
    }

    let authConfig = d.input.authConfigId
      ? await slateAuthHandlerService.getSlateInstanceAuth({
          tenant: session.tenant,
          slateInstance: session.slateInstance,
          authConfigId: d.input.authConfigId,
          minExpirationBuffer: 30 * 1000
        })
      : undefined;

    let action = await db.slateAction.findFirst({
      where: {
        type: 'tool',
        slateOid: session.slate.oid,
        slateSpecifications: { some: { specificationOid: version.specification.oid } },
        OR: [{ id: d.input.toolId }, { key: d.input.toolId }, { identifier: d.input.toolId }]
      }
    });
    if (!action) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_tool_action',
          message: 'Tool action not found for this provider.'
        })
      );
    }

    let startTime = Date.now();

    let stack = await slateInvocationService.createInvocationWithState({
      participants: d.input.participants,
      slateVersion: session.slateVersion,

      config: session.slateInstance.currentConfig.value ?? {},
      session: { id: session.id, state: {} },
      auth: authConfig
        ? {
            authenticationMethodId: authConfig.authMethod.key,
            data: authConfig.output ?? {}
          }
        : null
    });
    let callRes = await slateInvocationService.invokeToolAction({
      stack,
      actionId: action.key,
      input: d.input.input
    });

    let durationMs = Date.now() - startTime;

    let call = await db.slateSessionToolCall.create({
      data: {
        ...getId('slateToolCall'),

        status: callRes.status === 'success' ? 'succeeded' : 'failed',
        errorCode: callRes.status === 'error' ? callRes.error.code : null,
        errorMessage: callRes.status === 'error' ? callRes.error.message : null,
        durationMs,

        actionOid: action.oid,
        sessionOid: session.oid,
        invocationOid: callRes.invocation.oid,
        slateVersionOid: session.slateVersion.oid
      }
    });

    await db.slateSession.updateMany({
      where: { oid: session.oid },
      data: { lastActiveAt: new Date() }
    });

    if (callRes.status === 'error') {
      return {
        status: 'error' as const,
        call,
        invocationId: callRes.invocation.id,
        error: callRes.error
      };
    }

    let attachments = await Promise.all(
      (callRes.data.attachments ?? []).map(attachment =>
        this.ensureAttachment({
          content: attachment.content,
          mimeType: attachment.mimeType,
          invocation: callRes.invocation
        })
      )
    );

    return {
      call,
      invocationId: callRes.invocation.id,
      status: 'success' as const,

      output: callRes.data.output,
      message: callRes.data.message,
      attachments
    };
  }

  private async ensureAttachment(d: {
    content: SlateToolCallAttachment['content'];
    mimeType?: string | undefined;
    invocation: SlateInvocation;
  }) {
    if (d.content.type === 'url') {
      return {
        type: 'url' as const,
        url: d.content.url,
        mimeType: d.mimeType
      };
    }

    let contentBuffer = Buffer.from(d.content.content, d.content.encoding);
    let digest = new Uint8Array(new Bun.CryptoHasher('sha256').update(contentBuffer).digest());
    let digestString = Buffer.from(digest).toString('hex');
    let storageKey = getStoredAttachmentsStorageKey(digestString);

    let attachment = await db.slateAttachment.findFirst({
      where: { digest }
    });
    if (!attachment) {
      await storage.putObject(
        invocationsBucketRecord.bucket,
        storageKey,
        contentBuffer,
        d.mimeType ?? 'application/octet-stream'
      );
    }

    let expiresAt = addDays(new Date(), ATTACHMENT_EXPIRATION_DAYS);
    let inner = {
      digest,
      expiresAt,
      lastCreatedAt: new Date()
    };

    attachment = await db.slateAttachment.upsert({
      where: { digest },
      create: {
        ...getId('slateAttachment'),
        ...inner
      },
      update: inner
    });

    await db.slateInvocationAttachment.createMany({
      data: {
        ...getId('slateInvocationAttachment'),
        invocationOid: d.invocation.oid,
        attachmentsOid: attachment.oid
      }
    });

    let url = await storage.getPublicURL(
      invocationsBucketRecord.bucket,
      storageKey,
      ATTACHMENT_EXPIRATION_DAYS * 24 * 60 * 60,
      PublicUrlPurpose.Retrieve
    );

    return {
      type: 'url' as const,
      url: url.url,
      mimeType: d.mimeType,
      urlExpiresAt: addDays(new Date(), ATTACHMENT_EXPIRATION_DAYS)
    };
  }

  async getSlateToolCallById(d: { tenant: Tenant; id: string }) {
    let slateSessionToolCall = await db.slateSessionToolCall.findFirst({
      where: {
        session: { tenantOid: d.tenant.oid },
        id: d.id
      },
      include
    });
    if (!slateSessionToolCall)
      throw new ServiceError(notFoundError('slate.session.tool_call'));
    return slateSessionToolCall;
  }

  async listSlateToolCalls(d: {
    tenant: Tenant;
    slateIds?: string[];
    slateInstanceIds?: string[];
    slateVersionIds?: string[];
    sessionIds?: string[];
    toolIds?: string[];
  }) {
    let slateInstances = d.slateInstanceIds
      ? await db.slateInstance.findMany({
          where: { id: { in: d.slateInstanceIds }, tenantOid: d.tenant.oid }
        })
      : undefined;
    let slates = d.slateIds
      ? await db.slate.findMany({
          where: { id: { in: d.slateIds } }
        })
      : undefined;
    let slateVersions = d.slateVersionIds
      ? await db.slateVersion.findMany({
          where: { id: { in: d.slateVersionIds } }
        })
      : undefined;
    let tools = d.toolIds
      ? await db.slateAction.findMany({
          where: { id: { in: d.toolIds } }
        })
      : undefined;
    let sessions = d.sessionIds
      ? await db.slateSession.findMany({
          where: { id: { in: d.sessionIds }, tenantOid: d.tenant.oid }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateSessionToolCall.findMany({
            ...opts,
            where: {
              session: { tenantOid: d.tenant.oid },

              AND: [
                ...(tools ? [{ actionOid: { in: tools.map(t => t.oid) } }] : []),

                ...(slateVersions
                  ? [{ slateVersionOid: { in: slateVersions.map(sv => sv.oid) } }]
                  : []),

                ...(slateInstances
                  ? [
                      {
                        session: { slateInstanceOid: { in: slateInstances.map(si => si.oid) } }
                      }
                    ]
                  : []),

                ...(slates ? [{ session: { slateOid: { in: slates.map(s => s.oid) } } }] : []),

                ...(sessions ? [{ sessionOid: { in: sessions.map(s => s.oid) } }] : [])
              ]
            },
            include
          })
      )
    );
  }

  async getManySlateToolCallsByIds(d: { ids: string[]; tenant: Tenant }) {
    return db.slateSessionToolCall.findMany({
      where: {
        session: { tenantOid: d.tenant.oid },
        id: { in: d.ids }
      },
      include
    });
  }
}

export let slateSessionToolCallService = Service.create(
  'slateSessionToolCallService',
  () => new slateSessionToolCallServiceImpl()
).build();
