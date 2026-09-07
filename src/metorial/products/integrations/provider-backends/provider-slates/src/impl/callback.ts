import { db, snowflake, type Provider, type Tenant } from '@metorial-subspace/db';
import {
  IProviderCallbacks,
  type CallbackCreateParam,
  type CallbackCreateRes,
  type CallbackDeleteParam,
  type CallbackDeleteRes,
  type CallbackEventGetManyParam,
  type CallbackEventGetManyRes,
  type CallbackInstanceCreateParam,
  type CallbackInstanceCreateRes,
  type CallbackInstanceDeleteParam,
  type CallbackInstanceDeleteRes,
  type CallbackUpdateParam,
  type CallbackUpdateRes,
  type CallbackWebhookEventGetManyParam,
  type CallbackWebhookEventGetManyRes,
  type ProviderWebhookEvent,
  type WebhookEventGetParam,
  type WebhookEventListParam,
  type WebhookEventListRes,
  type WebhookRegistrationCreateParam,
  type WebhookRegistrationCreateRes,
  type WebhookRegistrationDeleteParam,
  type WebhookRegistrationDeleteRes,
  type WebhookRegistrationSetupFinishParam,
  type WebhookRegistrationSetupFinishRes,
  type WebhookRegistrationUpdateParam,
  type WebhookRegistrationUpdateRes
} from '@metorial-subspace/provider-utils';
import { getTenantForSlates, slates } from '../client';

type SlateWebhookEventRecord = Awaited<ReturnType<typeof slates.slateWebhookEvent.get>>;

let resolveSubspaceRefs = async (d: { tenant: Tenant; events: SlateWebhookEventRecord[] }) => {
  let slateIds = [...new Set(d.events.map(e => e.slateId))];
  let slatesRegistrationIds = [...new Set(d.events.map(e => e.webhookRegistrationId))];

  let [variants, mirrors] = await Promise.all([
    db.providerVariant.findMany({
      where: { slate: { id: { in: slateIds } } },
      select: { provider: true, slate: { select: { id: true } } },
      // A slate is expected to back a single variant; prefer the default if that stops holding.
      orderBy: { isDefault: 'desc' }
    }),
    db.slateWebhookRegistration.findMany({
      where: {
        id: { in: slatesRegistrationIds },
        tenantOid: d.tenant.oid,
        webhookRegistrationOid: { not: null }
      },
      select: { id: true, webhookRegistrationOid: true }
    })
  ]);

  let providerBySlateId = new Map<string, Provider>();
  for (let variant of variants) {
    if (!variant.slate || providerBySlateId.has(variant.slate.id)) continue;
    providerBySlateId.set(variant.slate.id, variant.provider);
  }

  return {
    providerBySlateId,
    webhookRegistrationOidById: new Map(
      mirrors.map(m => [m.id, m.webhookRegistrationOid!] as const)
    )
  };
};

let presentSlateWebhookEvent = (
  event: SlateWebhookEventRecord,
  refs: Awaited<ReturnType<typeof resolveSubspaceRefs>>
): ProviderWebhookEvent => {
  let provider = refs.providerBySlateId.get(event.slateId);
  if (!provider) {
    throw new Error(`No provider variant is backed by slate ${event.slateId}`);
  }

  return {
    id: event.id,

    status: event.status,
    attemptCount: event.attemptCount,

    request: event.request,

    provider,
    webhookRegistrationOid:
      refs.webhookRegistrationOidById.get(event.webhookRegistrationId) ?? null,

    receivedAt: event.createdAt
  };
};

export class ProviderCallbacks extends IProviderCallbacks {
  override async createCallback(data: CallbackCreateParam): Promise<CallbackCreateRes> {
    if (!data.providerVariant.slateOid) {
      throw new Error('Provider variant does not have a slate associated with it');
    }

    // Retried after a partial failure: the slates-side callback already exists.
    let mirror = await db.slateCallback.findUnique({
      where: { callbackOid: data.callback.oid }
    });
    if (mirror) return {};

    let slate = await db.slate.findUniqueOrThrow({
      where: { oid: data.providerVariant.slateOid }
    });

    let tenant = await getTenantForSlates(data.tenant);

    let res = await slates.callback.create({
      tenantId: tenant.id,
      slateId: slate.id,
      name: data.callback.name,
      description: data.callback.description ?? undefined
    });

    await db.slateCallback.create({
      data: {
        oid: snowflake.nextId(),
        id: res.id,

        slateOid: slate.oid,
        tenantOid: data.tenant.oid,
        projectOid: data.tenant.projectOid,
        callbackOid: data.callback.oid
      }
    });

    return {};
  }

  override async updateCallback(data: CallbackUpdateParam): Promise<CallbackUpdateRes> {
    let slateCallback = await db.slateCallback.findUnique({
      where: { callbackOid: data.callback.oid }
    });
    if (!slateCallback) return {};

    let tenant = await getTenantForSlates(data.tenant);

    await slates.callback.update({
      tenantId: tenant.id,
      callbackId: slateCallback.id,
      name: data.input.name,
      description: data.input.description ?? undefined
    });

    return {};
  }

  override async deleteCallback(data: CallbackDeleteParam): Promise<CallbackDeleteRes> {
    let slateCallback = await db.slateCallback.findUnique({
      where: { callbackOid: data.callback.oid }
    });
    if (!slateCallback) return {};

    let tenant = await getTenantForSlates(data.tenant);

    await slates.callback.delete({
      tenantId: tenant.id,
      callbackId: slateCallback.id
    });

    return {};
  }

  override async createCallbackInstance(
    data: CallbackInstanceCreateParam
  ): Promise<CallbackInstanceCreateRes> {
    // Retried after a partial failure: the slates-side instance already exists.
    let mirror = await db.slateCallbackInstance.findUnique({
      where: { callbackInstanceOid: data.callbackInstance.oid }
    });
    if (mirror) return {};

    let slateCallback = await db.slateCallback.findUniqueOrThrow({
      where: { callbackOid: data.callback.oid }
    });

    if (!data.configVersion.slateInstanceOid) {
      throw new Error('Provider config version does not have a slate instance');
    }

    let slateInstance = await db.slateInstance.findUniqueOrThrow({
      where: { oid: data.configVersion.slateInstanceOid }
    });

    let slateAuthConfig = data.authConfigVersion?.slateAuthConfigOid
      ? await db.slateAuthConfig.findUnique({
          where: { oid: data.authConfigVersion.slateAuthConfigOid }
        })
      : null;

    let tenant = await getTenantForSlates(data.tenant);

    let res = await slates.callbackInstance.create({
      tenantId: tenant.id,
      callbackId: slateCallback.id,
      slateInstanceId: slateInstance.id,
      authConfigId: slateAuthConfig?.id
    });

    await db.slateCallbackInstance.create({
      data: {
        oid: snowflake.nextId(),
        id: res.id,

        triggerRegistrationId: res.triggerRegistration.id,

        slateCallbackOid: slateCallback.oid,
        slateInstanceOid: slateInstance.oid,

        tenantOid: data.tenant.oid,
        projectOid: data.tenant.projectOid,
        callbackInstanceOid: data.callbackInstance.oid
      }
    });

    return {};
  }

  override async deleteCallbackInstance(
    data: CallbackInstanceDeleteParam
  ): Promise<CallbackInstanceDeleteRes> {
    let slateCallbackInstance = await db.slateCallbackInstance.findUnique({
      where: { callbackInstanceOid: data.callbackInstance.oid },
      include: { slateCallback: true }
    });
    if (!slateCallbackInstance) return {};

    let tenant = await getTenantForSlates(data.tenant);

    await slates.callbackInstance.delete({
      tenantId: tenant.id,
      callbackId: slateCallbackInstance.slateCallback.id,
      callbackInstanceId: slateCallbackInstance.id
    });

    return {};
  }

  override async createWebhookRegistration(
    data: WebhookRegistrationCreateParam
  ): Promise<WebhookRegistrationCreateRes> {
    if (!data.providerVariant.slateOid) {
      throw new Error('Provider variant does not have a slate associated with it');
    }

    let slate = await db.slate.findUniqueOrThrow({
      where: { oid: data.providerVariant.slateOid }
    });

    let tenant = await getTenantForSlates(data.tenant);

    let res = await slates.slateWebhookRegistration.create({
      tenantId: tenant.id,
      slateId: slate.id,

      name: data.webhookRegistration.name,
      description: data.webhookRegistration.description ?? undefined,
      metadata: (data.webhookRegistration.metadata as Record<string, any>) ?? undefined
    });

    await db.slateWebhookRegistration.create({
      data: {
        oid: snowflake.nextId(),
        id: res.webhookRegistration.id,

        triggerGroupKey: res.webhookRegistration.triggerGroupKey,
        urlKey: res.webhookRegistration.urlKey,

        slateOid: slate.oid,
        tenantOid: data.tenant.oid,
        projectOid: data.tenant.projectOid,
        webhookRegistrationOid: data.webhookRegistration.oid
      }
    });

    return {
      receiveUrl: res.webhookRegistration.receiveUrl,
      setup: { document: res.webhookSetupDocument }
    };
  }

  override async finishWebhookRegistrationSetup(
    data: WebhookRegistrationSetupFinishParam
  ): Promise<WebhookRegistrationSetupFinishRes> {
    let slateWebhookRegistration = await db.slateWebhookRegistration.findUniqueOrThrow({
      where: { webhookRegistrationOid: data.webhookRegistration.oid }
    });

    let tenant = await getTenantForSlates(data.tenant);

    let res = await slates.slateWebhookRegistration.setup({
      tenantId: tenant.id,
      webhookRegistrationId: slateWebhookRegistration.id,
      userConfig: data.userConfig
    });

    return { receiveUrl: res.receiveUrl };
  }

  override async updateWebhookRegistration(
    data: WebhookRegistrationUpdateParam
  ): Promise<WebhookRegistrationUpdateRes> {
    let slateWebhookRegistration = await db.slateWebhookRegistration.findUniqueOrThrow({
      where: { webhookRegistrationOid: data.webhookRegistration.oid }
    });

    let tenant = await getTenantForSlates(data.tenant);

    await slates.slateWebhookRegistration.update({
      tenantId: tenant.id,
      webhookRegistrationId: slateWebhookRegistration.id,

      name: data.input.name,
      description: data.input.description ?? undefined,
      metadata: data.input.metadata ?? undefined
    });

    return {};
  }

  override async listWebhookEvents(data: WebhookEventListParam): Promise<WebhookEventListRes> {
    let slatesRegistrationIds: string[] | undefined;

    if (data.webhookRegistrations) {
      let mirrors = await db.slateWebhookRegistration.findMany({
        where: { webhookRegistrationOid: { in: data.webhookRegistrations.map(r => r.oid) } },
        select: { id: true }
      });
      if (mirrors.length === 0)
        return { items: [], hasMoreAfter: false, hasMoreBefore: false };

      slatesRegistrationIds = mirrors.map(m => m.id);
    }

    let tenant = await getTenantForSlates(data.tenant);

    let list = await slates.slateWebhookEvent.list({
      tenantId: tenant.id,
      webhookRegistrationIds: slatesRegistrationIds,

      limit: data.input.limit,
      after: data.input.after,
      before: data.input.before,
      order: data.input.order
    });

    let refs = await resolveSubspaceRefs({ tenant: data.tenant, events: list.items });

    return {
      items: list.items.map(event => presentSlateWebhookEvent(event, refs)),
      hasMoreAfter: list.pagination.has_more_after,
      hasMoreBefore: list.pagination.has_more_before
    };
  }

  override async getWebhookEvent(data: WebhookEventGetParam): Promise<ProviderWebhookEvent> {
    let tenant = await getTenantForSlates(data.tenant);

    // Deliberately unscoped by registration: slates decides whether this tenant may see the event,
    // which includes events it only reached through a callback event of its own.
    let event = await slates.slateWebhookEvent.get({
      tenantId: tenant.id,
      webhookEventId: data.webhookEventId
    });

    let refs = await resolveSubspaceRefs({ tenant: data.tenant, events: [event] });

    return presentSlateWebhookEvent(event, refs);
  }

  override async deleteWebhookRegistration(
    data: WebhookRegistrationDeleteParam
  ): Promise<WebhookRegistrationDeleteRes> {
    let slateWebhookRegistration = await db.slateWebhookRegistration.findUnique({
      where: { webhookRegistrationOid: data.webhookRegistration.oid }
    });
    if (!slateWebhookRegistration) return {};

    let tenant = await getTenantForSlates(data.tenant);

    await slates.slateWebhookRegistration.delete({
      tenantId: tenant.id,
      webhookRegistrationId: slateWebhookRegistration.id
    });

    return {};
  }

  override async getManyEvents(
    data: CallbackEventGetManyParam
  ): Promise<CallbackEventGetManyRes> {
    if (data.callbackEvents.length === 0) return { events: [] };

    let slateTriggerEvents = await db.slateTriggerEvent.findMany({
      where: { callbackEventOid: { in: data.callbackEvents.map(e => e.oid) } }
    });
    if (slateTriggerEvents.length === 0) return { events: [] };

    let tenant = await getTenantForSlates(data.tenant);

    let events = await slates.triggerEvent.getMany({
      tenantId: tenant.id,
      triggerEventIds: slateTriggerEvents.map(e => e.id)
    });

    let eventsById = new Map(events.map(e => [e.id, e]));

    return {
      events: slateTriggerEvents.flatMap(mirror => {
        let event = eventsById.get(mirror.id);
        if (!event || !mirror.callbackEventOid) return [];

        return [
          {
            callbackEventOid: mirror.callbackEventOid,

            status: event.status,
            payload: (event.payload as Record<string, any> | null) ?? null,
            attemptCount: event.attemptCount,
            error: event.errorCode
              ? { code: event.errorCode, message: event.errorMessage ?? '' }
              : null,

            hasWebhookEvent: !!mirror.slateWebhookEventId
          }
        ];
      })
    };
  }

  override async getManyWebhookEvents(
    data: CallbackWebhookEventGetManyParam
  ): Promise<CallbackWebhookEventGetManyRes> {
    if (data.callbackEvents.length === 0) return { webhookEvents: [] };

    let slateTriggerEvents = await db.slateTriggerEvent.findMany({
      where: {
        callbackEventOid: { in: data.callbackEvents.map(e => e.oid) },
        slateWebhookEventId: { not: null }
      }
    });
    if (slateTriggerEvents.length === 0) return { webhookEvents: [] };

    let tenant = await getTenantForSlates(data.tenant);

    let webhookEvents = await slates.slateWebhookEvent.getMany({
      tenantId: tenant.id,
      webhookEventIds: slateTriggerEvents.map(e => e.slateWebhookEventId!)
    });

    let webhookEventsById = new Map(webhookEvents.map(e => [e.id, e]));

    return {
      webhookEvents: slateTriggerEvents.flatMap(mirror => {
        let webhookEvent = webhookEventsById.get(mirror.slateWebhookEventId!);
        if (!webhookEvent || !mirror.callbackEventOid) return [];

        return [
          {
            callbackEventOid: mirror.callbackEventOid,

            status: webhookEvent.status,
            attemptCount: webhookEvent.attemptCount,
            request: webhookEvent.request,

            receivedAt: webhookEvent.createdAt
          }
        ];
      })
    };
  }
}
