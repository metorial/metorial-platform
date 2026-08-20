import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type Callback,
  type CallbackInstance,
  CallbackDestinationStatus,
  db,
  type Environment,
  getId,
  type Provider,
  type ProviderDeployment,
  type ProviderType,
  snowflake,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderDeployments
} from '@metorial-subspace/list-utils';
import { providerDeploymentInternalService } from '@metorial-subspace/module-provider-internal';
import { callbackRegistrationService } from './callbackRegistration';
import { getInternalSignal, getTenantForSignal } from '../signal';
import { callbackSecurityAuditService } from './callbackSecurityAudit';
import {
  getCallbackReceiverSecretAuthority,
  type CallbackReceiverAuthority,
  type CallbackSecretAuditContext
} from './callbackReceiverSecret';

const MAX_DESTINATIONS_PER_CALLBACK = 100;
const MAX_TRIGGERS_PER_CALLBACK = 100;

let callbackInclude = {
  providerDeployment: {
    include: {
      provider: {
        include: {
          type: true
        }
      },
      currentVersion: true
    }
  },
  callbackProviderTriggers: {
    include: {
      providerTrigger: true
    }
  },
  callbackDestinationLinks: {
    include: {
      callbackDestination: true
    }
  }
};

class callbackServiceImpl {
  private async getCallbackSecretOwner(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    callbackInstanceId: string;
  }) {
    let callback = await this.getCallbackById(d);
    let callbackInstance = await db.callbackInstance.findFirst({
      where: {
        id: d.callbackInstanceId,
        callbackOid: callback.oid,
        status: 'attached',
        isParentDeleted: false
      }
    });
    if (!callbackInstance) {
      throw new ServiceError(notFoundError('callback.instance', d.callbackInstanceId));
    }
    if (
      !callbackInstance.slateTriggerReceiverId ||
      callbackInstance.registrationReceiverAuthorityVersion < 1
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_receiver_binding_unavailable',
          message: 'The authoritative callback receiver binding is not ready.'
        })
      );
    }
    let { getTenantForSlates } = await import('@metorial-subspace/provider-slates/src/client');
    let hubTenant = await getTenantForSlates(d.tenant);
    return {
      callback,
      callbackInstance,
      hubTenantId: hubTenant.id,
      authority: {
        tenantId: hubTenant.id,
        receiverId: callbackInstance.slateTriggerReceiverId,
        callbackId: callback.id,
        callbackInstanceId: callbackInstance.id,
        receiverAuthorityVersion: callbackInstance.registrationReceiverAuthorityVersion
      } satisfies CallbackReceiverAuthority
    };
  }

  private normalizeAuditContext(d: {
    trustedActorId: string;
    requestContext: { requestId: string; ip?: string | null; ua?: string | null };
  }): CallbackSecretAuditContext {
    let trustedActorId = d.trustedActorId.trim();
    let requestId = d.requestContext.requestId.trim();
    let requestIp = d.requestContext.ip?.trim() || undefined;
    let requestUserAgent = d.requestContext.ua?.trim() || undefined;
    if (
      !trustedActorId ||
      trustedActorId.length > 160 ||
      !requestId ||
      requestId.length > 160 ||
      (requestIp?.length ?? 0) > 128 ||
      (requestUserAgent?.length ?? 0) > 512
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_security_audit_context_invalid',
          message: 'The trusted callback security request context is invalid.'
        })
      );
    }
    return { trustedActorId, requestId, requestIp, requestUserAgent };
  }

  private async linkHubSecurityAudit(d: {
    tenant: Tenant;
    callback: Callback;
    callbackInstance: CallbackInstance;
    hubTenantId: string;
    authority: CallbackReceiverAuthority;
    auditContext: CallbackSecretAuditContext;
    auditCorrelationId: string;
  }) {
    try {
      let client = getCallbackReceiverSecretAuthority();
      let hubAudit = await client.getReceiverSecretAuditByCorrelation({
        ...d.authority,
        ...d.auditContext,
        auditCorrelationId: d.auditCorrelationId
      });
      return await callbackSecurityAuditService.appendLinked({
        tenant: d.tenant,
        callback: d.callback,
        callbackInstance: d.callbackInstance,
        ownerSnapshot: {
          tenantId: d.tenant.id,
          callbackId: d.callback.id,
          callbackInstanceId: d.callbackInstance.id,
          receiverId: d.authority.receiverId,
          receiverAuthorityVersion: d.authority.receiverAuthorityVersion
        },
        expectedHubTenantId: d.hubTenantId,
        hubAudit,
        expectedContext: d.auditContext
      });
    } catch (error) {
      let { enqueueCallbackSecurityAuditRepair } = await import('../queues/securityAudit');
      await enqueueCallbackSecurityAuditRepair({
        tenantId: d.tenant.id,
        hubTenantId: d.hubTenantId,
        callbackId: d.callback.id,
        callbackInstanceId: d.callbackInstance.id,
        receiverId: d.authority.receiverId,
        receiverAuthorityVersion: d.authority.receiverAuthorityVersion,
        auditCorrelationId: d.auditCorrelationId,
        auditContext: d.auditContext
      });
      return null;
    }
  }

  private async runReceiverSecretMutation<T extends { auditCorrelationId: string }>(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    callbackInstanceId: string;
    trustedActorId: string;
    requestContext: { requestId: string; ip?: string | null; ua?: string | null };
    mutate: (
      authority: CallbackReceiverAuthority,
      auditContext: CallbackSecretAuditContext
    ) => Promise<T>;
  }) {
    let auditContext = this.normalizeAuditContext(d);
    let owner = await this.getCallbackSecretOwner(d);
    let result = await d.mutate(owner.authority, auditContext);
    await this.linkHubSecurityAudit({
      tenant: d.tenant,
      ...owner,
      auditContext,
      auditCorrelationId: result.auditCorrelationId
    });
    return result;
  }

  private normalizePollInterval(value?: number | null) {
    if (value === undefined || value === null) return value;
    if (!Number.isInteger(value) || value < 1) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_poll_interval',
          message: 'pollIntervalSecondsOverride must be a positive integer.'
        })
      );
    }

    return value;
  }

  async listCallbacks(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    status?: ('active' | 'archived' | 'deleted')[];
    allowDeleted?: boolean;
    ids?: string[];
    providerDeploymentIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.callback.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            ...normalizeStatusForList(d).noParent,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              deployments ? { providerDeploymentOid: deployments.in } : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          },
          include: callbackInclude
        })
      )
    );
  }

  async getCallbackById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    allowDeleted?: boolean;
  }) {
    let callback = await db.callback.findFirst({
      where: {
        id: d.callbackId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: callbackInclude
    });
    if (!callback) {
      throw new ServiceError(notFoundError('callback', d.callbackId));
    }

    return callback;
  }

  private async getDeploymentAndValidate(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerDeployment: {
      id: string;
    };
  }) {
    let providerDeployment = await db.providerDeployment.findFirst({
      where: {
        id: d.providerDeployment.id,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      },
      include: {
        provider: {
          include: {
            type: true,
            defaultVariant: true
          }
        },
        currentVersion: {
          include: {
            lockedVersion: true
          }
        }
      }
    });
    if (!providerDeployment) {
      throw new ServiceError(notFoundError('provider.deployment', d.providerDeployment.id));
    }

    if (
      providerDeployment.provider.type.attributes.backend !== 'slates' ||
      providerDeployment.provider.type.attributes.triggers.status !== 'enabled'
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_not_supported',
          message: 'Callbacks are not supported for the provider of the specified deployment.'
        })
      );
    }

    return providerDeployment;
  }

  private async resolveTriggerDefs(d: {
    environment: Environment;
    deployment: ProviderDeployment;
    inputTriggers: { triggerId: string; eventTypes?: string[] }[];
  }) {
    let deployment = await db.providerDeployment.findFirstOrThrow({
      where: { oid: d.deployment.oid },
      include: {
        provider: {
          include: {
            defaultVariant: {
              include: {
                currentVersion: true
              }
            }
          }
        },
        currentVersion: {
          include: {
            lockedVersion: true
          }
        }
      }
    });

    let version = await providerDeploymentInternalService.getCurrentVersion({
      provider: deployment.provider,
      environment: d.environment,
      deployment
    });
    if (!version?.specificationOid) {
      throw new ServiceError(
        badRequestError({
          code: 'missing_specification',
          message: 'Deployment has no discovered specification with triggers.'
        })
      );
    }

    let providerTriggers = await db.providerTrigger.findMany({
      where: { specificationOid: version.specificationOid }
    });

    let byMatcher = new Map<string, (typeof providerTriggers)[number]>();
    for (let trigger of providerTriggers) {
      byMatcher.set(trigger.key, trigger);
      byMatcher.set(trigger.specId, trigger);
      byMatcher.set(trigger.callableId, trigger);
      if (trigger.specUniqueIdentifier) {
        byMatcher.set(trigger.specUniqueIdentifier, trigger);
      }
    }

    return d.inputTriggers.map(item => {
      let trigger = byMatcher.get(item.triggerId);
      if (!trigger) {
        throw new ServiceError(
          badRequestError({
            code: 'invalid_callback_trigger',
            message: `Trigger not found in provider specification: ${item.triggerId}`
          })
        );
      }

      return {
        providerTriggerOid: trigger.oid,
        eventTypes: item.eventTypes?.length ? item.eventTypes : []
      };
    });
  }

  async createCallback(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerDeployment: {
      id: string;
    };
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      pollIntervalSecondsOverride?: number | null;
      triggers: { triggerId: string; eventTypes?: string[] }[];
      destinationIds: string[];
    };
  }) {
    let providerDeployment = await this.getDeploymentAndValidate({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      providerDeployment: d.providerDeployment
    });

    if (d.input.triggers.length > MAX_TRIGGERS_PER_CALLBACK) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_trigger_limit_exceeded',
          message: `A callback can reference at most ${MAX_TRIGGERS_PER_CALLBACK} triggers.`
        })
      );
    }

    let providerTriggers = await this.resolveTriggerDefs({
      environment: d.environment,
      deployment: providerDeployment,
      inputTriggers: d.input.triggers
    });
    let destinationIds = [...new Set(d.input.destinationIds)];
    if (destinationIds.length > MAX_DESTINATIONS_PER_CALLBACK) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_destination_limit_exceeded',
          message: `A callback can reference at most ${MAX_DESTINATIONS_PER_CALLBACK} destinations.`
        })
      );
    }
    let pollIntervalSecondsOverride = this.normalizePollInterval(
      d.input.pollIntervalSecondsOverride
    );

    let destinations = await db.callbackDestination.findMany({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        id: { in: destinationIds },
        status: CallbackDestinationStatus.active
      }
    });
    if (destinations.length !== destinationIds.length) {
      throw new ServiceError(
        badRequestError({ message: 'One or more callback destinations were not found.' })
      );
    }

    let callback = await db.callback.create({
      data: {
        ...getId('callback'),
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        providerDeploymentOid: providerDeployment.oid,
        status: 'active',
        mode: 'manual',
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,
        pollIntervalSecondsOverride,
        callbackProviderTriggers: {
          create: providerTriggers.map(trigger => ({
            ...getId('callbackProviderTrigger'),
            providerTriggerOid: trigger.providerTriggerOid,
            eventTypes: trigger.eventTypes
          }))
        },
        callbackDestinationLinks: {
          create: destinations.map(destination => ({
            oid: snowflake.nextId(),
            callbackDestinationOid: destination.oid
          }))
        }
      }
    });

    await callbackRegistrationService.syncCallback({ callbackId: callback.id });

    return await this.getCallbackById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      callbackId: callback.id
    });
  }

  async updateCallback(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callback: Callback & {
      providerDeployment: ProviderDeployment & {
        provider: Provider & {
          type: ProviderType;
        };
        currentVersion: unknown;
      };
    };
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      pollIntervalSecondsOverride?: number | null;
      triggers?: { triggerId: string; eventTypes?: string[] }[];
      destinationIds?: string[];
    };
  }) {
    let pollIntervalSecondsOverride =
      d.input.pollIntervalSecondsOverride !== undefined
        ? this.normalizePollInterval(d.input.pollIntervalSecondsOverride)
        : undefined;

    let destinationOids: bigint[] | undefined;
    if (d.input.destinationIds) {
      let destinationIds = [...new Set(d.input.destinationIds)];
      if (destinationIds.length > MAX_DESTINATIONS_PER_CALLBACK) {
        throw new ServiceError(
          badRequestError({
            code: 'callback_destination_limit_exceeded',
            message: `A callback can reference at most ${MAX_DESTINATIONS_PER_CALLBACK} destinations.`
          })
        );
      }
      let destinations = await db.callbackDestination.findMany({
        where: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          id: { in: destinationIds },
          status: CallbackDestinationStatus.active
        }
      });
      if (destinations.length !== destinationIds.length) {
        throw new ServiceError(
          badRequestError({ message: 'One or more callback destinations were not found.' })
        );
      }
      destinationOids = destinations.map(dest => dest.oid);
    }

    if (d.input.triggers && d.input.triggers.length > MAX_TRIGGERS_PER_CALLBACK) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_trigger_limit_exceeded',
          message: `A callback can reference at most ${MAX_TRIGGERS_PER_CALLBACK} triggers.`
        })
      );
    }

    let triggerDefs =
      d.input.triggers !== undefined
        ? await this.resolveTriggerDefs({
            environment: d.environment,
            deployment: d.callback.providerDeployment,
            inputTriggers: d.input.triggers
          })
        : undefined;

    await db.$transaction(async tx => {
      await tx.callback.update({
        where: { oid: d.callback.oid },
        data: {
          mode: 'manual',
          name: d.input.name ?? undefined,
          description: d.input.description ?? undefined,
          metadata: d.input.metadata ?? undefined,
          pollIntervalSecondsOverride: pollIntervalSecondsOverride ?? undefined
        }
      });

      if (destinationOids) {
        await tx.callbackDestinationLink.deleteMany({
          where: { callbackOid: d.callback.oid }
        });
        if (destinationOids.length) {
          await tx.callbackDestinationLink.createMany({
            data: destinationOids.map(destinationOid => ({
              oid: snowflake.nextId(),
              callbackOid: d.callback.oid,
              callbackDestinationOid: destinationOid
            }))
          });
        }
      }

      if (triggerDefs) {
        await tx.callbackProviderTrigger.deleteMany({
          where: { callbackOid: d.callback.oid }
        });

        if (triggerDefs.length) {
          await tx.callbackProviderTrigger.createMany({
            data: triggerDefs.map(trigger => ({
              ...getId('callbackProviderTrigger'),
              callbackOid: d.callback.oid,
              providerTriggerOid: trigger.providerTriggerOid,
              eventTypes: trigger.eventTypes
            }))
          });
        }
      }
    });

    // Signal is reactivated only after every receiver has reconciled, including
    // metadata-only updates after an earlier failed reconciliation.
    await callbackRegistrationService.syncCallback({ callbackId: d.callback.id });

    return await this.getCallbackById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      callbackId: d.callback.id
    });
  }

  async sendDashboardTestEvent(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    callbackInstanceId: string;
    eventId: string;
    input: {
      eventType: string;
      payloadJson: string;
    };
  }) {
    let eventType = d.input.eventType.trim();
    if (!eventType) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_test_event_type_required',
          message: 'A callback test event type is required.'
        })
      );
    }

    if (!d.eventId.startsWith('dashboard_test:') || d.eventId.length <= 15) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_test_event_id_invalid',
          message: 'The callback test event ID is invalid.'
        })
      );
    }

    let callback = await this.getCallbackById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      callbackId: d.callbackId
    });
    if (callback.status !== 'active' || !callback.isCallbacksV2) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_test_event_unavailable',
          message: 'Synthetic events are unavailable for this callback.'
        })
      );
    }

    let callbackInstance = await db.callbackInstance.findFirst({
      where: {
        id: d.callbackInstanceId,
        callbackOid: callback.oid,
        status: 'attached',
        isParentDeleted: false
      },
      select: { id: true }
    });
    if (!callbackInstance) {
      throw new ServiceError(notFoundError('callback.instance', d.callbackInstanceId));
    }

    try {
      let payload = JSON.parse(d.input.payloadJson);
      if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
        throw new Error('not an object');
      }
    } catch {
      throw new ServiceError(
        badRequestError({
          code: 'callback_test_payload_invalid',
          message: 'The callback test payload must be a JSON object.'
        })
      );
    }

    let signalTenant = await getTenantForSignal(d.tenant);
    let callbackEvent = await getInternalSignal().callback.recordDashboardTestEvent({
      tenantId: signalTenant.id,
      callbackId: callback.id,
      eventId: d.eventId,
      callbackInstanceId: callbackInstance.id,
      eventType,
      payloadJson: d.input.payloadJson
    });
    let deliveryStatus: 'pending' | 'failed' | 'sent' | 'skipped' =
      callbackEvent.deliveryStatus === 'sent' ||
      callbackEvent.deliveryStatus === 'failed' ||
      callbackEvent.deliveryStatus === 'pending' ||
      callbackEvent.deliveryStatus === 'skipped'
        ? callbackEvent.deliveryStatus
        : 'pending';

    return {
      ...callbackEvent,
      sourceId: 'dashboard_test' as const,
      triggerKey: 'dashboard_test' as const,
      deliveryStatus
    };
  }

  async createReceiverPathSecret(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    callbackInstanceId: string;
    trustedActorId: string;
    requestContext: { requestId: string; ip?: string | null; ua?: string | null };
  }) {
    return await this.runReceiverSecretMutation({
      ...d,
      mutate: async (authority, auditContext) =>
        await getCallbackReceiverSecretAuthority().createReceiverPath({
          ...authority,
          ...auditContext
        })
    });
  }

  async rotateReceiverPathSecret(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    callbackInstanceId: string;
    trustedActorId: string;
    requestContext: { requestId: string; ip?: string | null; ua?: string | null };
    graceMs?: number;
  }) {
    if (
      d.graceMs !== undefined &&
      (!Number.isInteger(d.graceMs) ||
        (d.graceMs !== 0 && (d.graceMs < 60_000 || d.graceMs > 7 * 86_400_000)))
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_secret_grace_invalid',
          message:
            'The receiver secret grace period must be zero (revoke the previous secret immediately) or between one minute and seven days.'
        })
      );
    }
    return await this.runReceiverSecretMutation({
      ...d,
      mutate: async (authority, auditContext) =>
        await getCallbackReceiverSecretAuthority().rotateReceiverPath({
          ...authority,
          ...auditContext,
          graceMs: d.graceMs
        })
    });
  }

  async revokeReceiverPathSecret(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    callbackInstanceId: string;
    trustedActorId: string;
    requestContext: { requestId: string; ip?: string | null; ua?: string | null };
    secretId: string;
  }) {
    return await this.runReceiverSecretMutation({
      ...d,
      mutate: async (authority, auditContext) =>
        await getCallbackReceiverSecretAuthority().revokeReceiverPath({
          ...authority,
          ...auditContext,
          secretId: d.secretId
        })
    });
  }

  async revokeAllReceiverPathSecrets(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    callbackInstanceId: string;
    trustedActorId: string;
    requestContext: { requestId: string; ip?: string | null; ua?: string | null };
  }) {
    return await this.runReceiverSecretMutation({
      ...d,
      mutate: async (authority, auditContext) =>
        await getCallbackReceiverSecretAuthority().revokeAllReceiverPath({
          ...authority,
          ...auditContext
        })
    });
  }

  async consumeReceiverPathSecretReceipt(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    callbackInstanceId: string;
    trustedActorId: string;
    requestContext: { requestId: string; ip?: string | null; ua?: string | null };
    receiptId: string;
    receiptToken: string;
  }) {
    let result = await this.runReceiverSecretMutation({
      ...d,
      mutate: async (authority, auditContext) =>
        await getCallbackReceiverSecretAuthority().consumeReceiverPathReceipt({
          ...authority,
          ...auditContext,
          receiptId: d.receiptId,
          receiptToken: d.receiptToken
        })
    });
    if (result.outcome === 'denied') {
      throw new ServiceError(
        badRequestError({
          code: 'secret_issuance_receipt_denied',
          message: 'The one-time secret receipt is invalid, expired, or already consumed.'
        })
      );
    }
    return {
      plaintext: result.plaintext,
      auditCorrelationId: result.auditCorrelationId
    };
  }

  async archiveCallback(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callback: Callback;
  }) {
    let archivedAt = new Date();

    let archived = await withTransaction(async db => {
      let archived = await db.callback.update({
        where: { oid: d.callback.oid },
        data: {
          status: 'archived',
          archivedAt
        },
        include: callbackInclude
      });

      await db.callbackInstance.updateMany({
        where: { callbackOid: d.callback.oid },
        data: { isParentDeleted: true }
      });

      return archived;
    });

    // The archive is already committed; a failed teardown is retried by the
    // lifecycle sweep cron.
    try {
      await callbackRegistrationService.syncCallback({ callbackId: archived.id });
    } catch {}

    return archived;
  }
}

export let callbackService = Service.create(
  'callbackService',
  () => new callbackServiceImpl()
).build();
