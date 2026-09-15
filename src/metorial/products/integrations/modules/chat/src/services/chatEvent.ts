import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import { type DateFilter, normalizeDateFilter } from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { resolveChatEventPayload } from '../lib/resolveChatEventPayload';

export let chatEventInclude = {
  chatConnection: true,
  chat: true,
  channel: true,
  thread: true,
  message: true,
  author: true
} as const;

export type ListChatEventsParams = {
  chatIds?: string[];
  chatConnectionIds?: string[];
  chatInstanceIds?: string[];
  types?: string[];
  createdAt?: DateFilter;
  occurredAt?: DateFilter;
};

export type GetChatEventByIdParams = {
  chatEventId: string;
};

class chatEventServiceImpl {
  async listChatEvents(d: MetorialFacing<ListChatEventsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatEventsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatEventsInternal(
    d: { tenant: Tenant; environment: Environment } & ListChatEventsParams
  ) {
    let solution = await getMetorialSolution();

    let paginator = Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.chatEvent.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              AND: [
                d.chatIds ? { chat: { id: { in: d.chatIds } } } : undefined!,
                d.chatConnectionIds
                  ? { chatConnection: { id: { in: d.chatConnectionIds } } }
                  : undefined!,
                d.chatInstanceIds
                  ? { chatInstance: { id: { in: d.chatInstanceIds } } }
                  : undefined!,
                d.types ? { type: { in: d.types } } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.occurredAt ? { occurredAt: normalizeDateFilter(d.occurredAt) } : undefined!
              ].filter(Boolean)
            },
            orderBy: { occurredAt: 'desc' },
            include: chatEventInclude
          })
      )
    );

    return paginator.mapAll(chatEvents => this.hydrateChatEvents(chatEvents));
  }

  async getChatEventById(d: MetorialFacing<GetChatEventByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatEventByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatEventByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatEventByIdParams
  ) {
    let solution = await getMetorialSolution();

    let chatEvent = await db.chatEvent.findFirst({
      where: {
        id: d.chatEventId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid
      },
      include: chatEventInclude
    });
    if (!chatEvent) {
      throw new ServiceError(notFoundError('chat.event', d.chatEventId));
    }

    return { chatEvent, payload: await resolveChatEventPayload(chatEvent) };
  }

  async getManyChatEventPayloads(d: { chatEventIds: string[] }) {
    let payloads = new Map<string, Record<string, any> | null>();
    if (d.chatEventIds.length === 0) return payloads;

    let chatEvents = await db.chatEvent.findMany({
      where: { id: { in: d.chatEventIds } },
      select: { id: true, payload: true, payloadStorageKey: true }
    });

    for (let chatEvent of chatEvents) {
      payloads.set(chatEvent.id, await resolveChatEventPayload(chatEvent));
    }

    return payloads;
  }

  private async hydrateChatEvents<T extends { id: string }>(chatEvents: T[]) {
    if (!chatEvents.length) return [];

    let payloads = await this.getManyChatEventPayloads({
      chatEventIds: chatEvents.map(chatEvent => chatEvent.id)
    });

    return chatEvents.map(chatEvent => ({
      chatEvent,
      payload: payloads.get(chatEvent.id) ?? null
    }));
  }
}

export let chatEventService = Service.create(
  'chatEventService',
  () => new chatEventServiceImpl()
).build();
