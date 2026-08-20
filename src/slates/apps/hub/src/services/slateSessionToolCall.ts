import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { SlatesParticipant } from '@slates/proto';
import { addDays, differenceInMinutes } from 'date-fns';
import { PublicUrlPurpose } from 'object-storage-client';
import { randomUUID } from 'node:crypto';
import type { SlateInvocation, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId, ID } from '../id';
import { getStoredAttachmentsStorageKey } from '../lib/invocation/store';
import {
  assertCanonicalStoredSlateConfigSchema,
  projectSlateConfigPresence,
  resolveStoredSlateConfigFieldDescriptors
} from '../lib/configPatch';
import { invocationsBucketRecord, storage } from '../storage';
import { slateErrorService } from './slateError';
import { slateAuthHandlerService } from './slateInstanceAuthHandler';
import { slateInvocationService } from './slateInvocation';
import { slateSessionService } from './slateSession';
import { slateTriggerReceiverProductionSecurity } from './slateTriggerReceiverSecurity';

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

let throwStoredConfigError = (d: { errorCode: string; errorMessage?: string | null }) => {
  throw new ServiceError(
    badRequestError({
      code: 'invalid_provider_configuration',
      message: `Provider instance configuration has an error: ${d.errorMessage ?? d.errorCode}`
    })
  );
};

class slateSessionToolCallServiceImpl {
  async createSlateToolCall(d: {
    input: {
      tenantId: string;
      sessionId: string;

      toolId: string;
      authConfigId?: string;
      enclaveId?: string;
      egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList;
      input: Record<string, any>;
      receiverCallbackSelector?: string;
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
        slateInstance: {
          include: { currentConfig: { include: { schema: true, secrets: true } } }
        },
        slateVersion: { include: { specification: true } },
        instanceConfiguration: true,
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
    if (session.slateInstance.currentConfig.errorCode) {
      throwStoredConfigError({
        errorCode: session.slateInstance.currentConfig.errorCode,
        errorMessage: session.slateInstance.currentConfig.errorMessage
      });
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
      !version.providerDeploymentInfo ||
      !version.activeDeploymentOid
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

    let authConfigMetadata = d.input.authConfigId
      ? await slateAuthHandlerService.getSlateInstanceAuthMetadata({
          tenant: session.tenant,
          slateInstance: session.slateInstance,
          authConfigId: d.input.authConfigId
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

    let actionCapabilities =
      typeof action.spec === 'object' && action.spec !== null && !Array.isArray(action.spec)
        ? (action.spec as Record<string, any>).capabilities
        : undefined;
    let receiverCapability = actionCapabilities?.receiverBoundToolContextV1 as
      | { secretNames?: unknown }
      | undefined;
    let receiverSecretNames = Array.isArray(receiverCapability?.secretNames)
      ? receiverCapability.secretNames.filter(
          (name): name is string => typeof name === 'string' && name.length > 0
        )
      : [];
    if (
      receiverCapability &&
      (!Array.isArray(receiverCapability.secretNames) ||
        receiverSecretNames.length !== receiverCapability.secretNames.length)
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'receiver_bound_tool_capability_invalid',
          message: 'The tool receiver-bound capability declaration is invalid.'
        })
      );
    }
    if (receiverCapability && !d.input.receiverCallbackSelector) {
      throw new ServiceError(
        badRequestError({
          code: 'receiver_bound_tool_selector_required',
          message: 'The tool requires an authoritative callback receiver binding.'
        })
      );
    }
    if (!receiverCapability && d.input.receiverCallbackSelector) {
      throw new ServiceError(
        badRequestError({
          code: 'receiver_bound_tool_selector_unexpected',
          message: 'The selected tool does not accept a callback receiver binding.'
        })
      );
    }

    let receiverCallbackBinding:
      | {
          receiverId: string;
          receiverTriggerId: string;
          triggerActionId: string;
          specHash: string;
          registrationGeneration: number;
          registrationVersion: number;
          projectedSecretVersions: Record<string, number>;
        }
      | undefined;
    if (receiverCapability) {
      let receivers = await db.slateTriggerReceiver.findMany({
        where: {
          id: d.input.receiverCallbackSelector,
          tenantOid: session.tenantOid,
          slateInstanceOid: session.slateInstanceOid,
          slateOid: session.slateOid,
          status: 'active',
          tombstonedAt: null
        },
        include: {
          triggers: {
            where: {
              action: { key: 'agent_status_change' },
              registrationStatus: 'registered',
              tombstonedAt: null,
              ingressDisabledAt: null
            },
            include: { action: true, boundSecrets: true }
          }
        },
        take: 2
      });
      if (receivers.length !== 1 || receivers[0]!.triggers.length !== 1) {
        throw new ServiceError(
          badRequestError({
            code: 'receiver_bound_tool_selector_ineligible',
            message: 'The callback receiver binding is missing, ambiguous, or ineligible.'
          })
        );
      }
      let receiver = receivers[0]!;
      let trigger = receiver.triggers[0]!;
      let triggerSpec = trigger.action.spec as Record<string, unknown>;
      let specHash = triggerSpec.specHash;
      if (typeof specHash !== 'string' || trigger.verificationSpecHash !== specHash) {
        throw new ServiceError(
          badRequestError({
            code: 'receiver_bound_tool_selector_stale',
            message: 'The callback receiver specification or generation is stale.'
          })
        );
      }
      let projectedSecretVersions: Record<string, number> = {};
      for (let name of receiverSecretNames) {
        let matches = trigger.boundSecrets.filter(
          secret =>
            secret.name === name && secret.specHash === specHash && secret.status === 'active'
        );
        if (matches.length !== 1) {
          throw new ServiceError(
            badRequestError({
              code: 'receiver_bound_tool_secret_unavailable',
              message: 'The callback receiver secret projection is unavailable.'
            })
          );
        }
        projectedSecretVersions[name] = matches[0]!.secretVersion;
      }
      receiverCallbackBinding = {
        receiverId: receiver.id,
        receiverTriggerId: trigger.id,
        triggerActionId: trigger.action.key,
        specHash,
        registrationGeneration: trigger.registrationGeneration,
        registrationVersion: trigger.registrationVersion,
        projectedSecretVersions
      };
    }

    let startTime = Date.now();

    let currentConfig = session.slateInstance.currentConfig;
    let canonicalConfigSchema =
      currentConfig.schema.version === 2
        ? assertCanonicalStoredSlateConfigSchema(currentConfig.schema)
        : undefined;
    let fields = resolveStoredSlateConfigFieldDescriptors({
      schemaVersion: currentConfig.schema.version,
      fields: currentConfig.schema.fields,
      value: currentConfig.value
    });
    let configuredSecretKeys = Object.entries(fields)
      .filter(
        ([key, descriptor]) =>
          descriptor.visibility === 'secret' &&
          typeof currentConfig.value === 'object' &&
          currentConfig.value !== null &&
          !Array.isArray(currentConfig.value) &&
          key in currentConfig.value
      )
      .map(([key]) => key);
    let hasClassifiedValues =
      configuredSecretKeys.length > 0 ||
      authConfigMetadata !== undefined ||
      receiverCallbackBinding !== undefined;
    let capabilities =
      typeof version.specification.providerInfo === 'object' &&
      version.specification.providerInfo !== null &&
      !Array.isArray(version.specification.providerInfo)
        ? (version.specification.providerInfo as Record<string, any>).capabilities
        : undefined;
    if (receiverCallbackBinding && capabilities?.receiverBoundToolContextV1 !== true) {
      throw new ServiceError(
        badRequestError({
          code: 'receiver_bound_tool_capability_unavailable',
          message: 'The provider does not support receiver-bound tool context.'
        })
      );
    }
    if (
      hasClassifiedValues &&
      (currentConfig.schema.version !== 2 ||
        !currentConfig.schema.descriptorHash ||
        capabilities?.configSchemaV2 !== true ||
        capabilities?.scopedInvocationGrantV1 !== true)
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'scoped_config_invocation_unavailable',
          message:
            'Secret-bearing provider invocation requires config schema v2 and a scoped invocation grant.'
        })
      );
    }
    let runtimeDeployment = hasClassifiedValues
      ? await db.slateDeployment.findFirst({
          where: {
            oid: version.activeDeploymentOid,
            status: 'succeeded',
            runtimeIdentityRevokedAt: null
          },
          select: {
            id: true,
            runtimeIdentityId: true,
            runtimeIdentityGeneration: true
          }
        })
      : null;
    if (hasClassifiedValues && !runtimeDeployment?.runtimeIdentityId) {
      throw new ServiceError(
        badRequestError({
          code: 'scoped_runtime_identity_unavailable',
          message: 'The active provider deployment does not have a valid runtime identity.'
        })
      );
    }

    let activeConfigSecrets = await db.slateInstanceConfigSecret.findMany({
      where: {
        instanceConfigOid: currentConfig.oid,
        key: { in: configuredSecretKeys },
        status: 'active'
      },
      select: { key: true, secretVersion: true }
    });
    let configSecretVersions = Object.fromEntries(
      activeConfigSecrets.map(secret => [`config:${secret.key}`, secret.secretVersion])
    );
    for (let key of configuredSecretKeys) {
      if (configSecretVersions[`config:${key}`] === undefined) {
        throw new ServiceError(
          badRequestError({
            code: 'provider_config_secret_unavailable',
            message: `Provider config secret ${key} is unavailable.`
          })
        );
      }
    }
    let authSecretVersion = authConfigMetadata
      ? Math.max(1, authConfigMetadata.authConfig.updatedAt.getTime())
      : 1;
    let authSecretVersions: Record<string, number> = authConfigMetadata
      ? { 'auth:$output': authSecretVersion }
      : {};
    let invocationId = await ID.generateId('slateInvocation');
    let requestId = randomUUID();
    let envelope = hasClassifiedValues
      ? await slateTriggerReceiverProductionSecurity.issueToolGrant({
          deploymentId: runtimeDeployment!.id,
          runtimeIdentityId: runtimeDeployment!.runtimeIdentityId!,
          runtimeIdentityGeneration: runtimeDeployment!.runtimeIdentityGeneration,
          tenantId: session.tenant.id,
          slateInstanceId: session.slateInstance.id,
          configSchemaVersion: currentConfig.schema.version,
          configSchemaHash: currentConfig.schema.descriptorHash!,
          hubInvocationId: invocationId,
          requestId,
          actionId: action.key,
          operation: 'tool_invoke',
          configSecretVersions,
          authConfigId: authConfigMetadata?.authConfig.id ?? null,
          authSecretVersions,
          ...(receiverCallbackBinding ? { receiverCallback: receiverCallbackBinding } : {})
        })
      : undefined;
    let safeConfig = projectSlateConfigPresence({
      value: currentConfig.value,
      fields
    });
    let safeAuth = authConfigMetadata ? { $output: { configured: true } } : {};

    let stack: Awaited<
      ReturnType<typeof slateInvocationService.createInvocationWithState>
    > | null = null;
    let callRes;
    try {
      stack = await slateInvocationService.createInvocationWithState({
        tenant: session.tenant,
        participants: d.input.participants,
        slateVersion: session.slateVersion,
        enclaveId: d.input.enclaveId ?? session.instanceConfiguration?.enclaveId,
        egressPolicy:
          d.input.egressPolicy ??
          (session.instanceConfiguration
            ?.egressPolicy as PrismaJson.CompiledEgressNetworkAllowList | null) ??
          undefined,

        invocationId,
        canonicalConfigSchema,
        artifactSecurity: envelope
          ? {
              redactionSentinels: [],
              forbiddenValues: [envelope.grantId, envelope.token]
            }
          : undefined,
        config: safeConfig,
        session: { id: session.id, state: {} },
        auth: authConfigMetadata
          ? {
              authenticationMethodId: authConfigMetadata.authMethod.key,
              data: safeAuth
            }
          : null
      });
      callRes = await slateInvocationService.invokeToolAction({
        stack,
        actionId: action.key,
        input: d.input.input,
        invocation: envelope
      });
    } finally {
      stack?.clearClassifiedInvocation();
      if (envelope) await slateTriggerReceiverProductionSecurity.grants.revoke(envelope);
    }

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
      slateErrorService
        .recordSlateError({
          type: 'tool_call_failed',
          errorCode: callRes.error.code,
          errorMessage: callRes.error.message,
          tenantOid: session.tenantOid,
          slateOid: session.slateOid,
          slateVersionOid: session.slateVersionOid,
          slateInstanceOid: session.slateInstanceOid,
          invocationOid: callRes.invocation.oid,
          toolCallOid: call.oid,
          sessionOid: session.oid
        })
        .catch(() => {});

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
    let digest = new Uint8Array(await crypto.subtle.digest('SHA-256', contentBuffer));
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
