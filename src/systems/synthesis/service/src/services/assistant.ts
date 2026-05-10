import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { Prisma, db } from '../db';
import type { Assistant, Tenant } from '../db';
import { assistants } from '../definitions/assistants';
import { getId } from '../id';
import {
  implementationModelInclude,
  type ImplementationModelWithProvider
} from '../lib/definitions';

export let assistantModelInclude = implementationModelInclude;
export type AssistantModelWithProvider = ImplementationModelWithProvider;

export let assistantInclude = {
  implementation: true,
  tenant: true
} satisfies Prisma.AssistantInclude;

export type AssistantWithRelations = Prisma.AssistantGetPayload<{
  include: typeof assistantInclude;
}>;

export type AvailableAssistant = AssistantWithRelations & {
  defaultModel: AssistantModelWithProvider | null;
  availableModels: AssistantModelWithProvider[];
};

export let assistantInstanceInclude = {
  assistant: {
    include: assistantInclude
  },
  tenant: true
} satisfies Prisma.AssistantInstanceInclude;

export type AssistantInstanceWithRelations = Prisma.AssistantInstanceGetPayload<{
  include: typeof assistantInstanceInclude;
}>;

type AssistantDefinition = Awaited<(typeof assistants)[keyof typeof assistants]>;

type PersistedImplementationDefinition = {
  definition: AssistantDefinition;
  defaultModel: AssistantModelWithProvider | null;
  availableModels: AssistantModelWithProvider[];
};

class AssistantServiceImpl {
  private systemAssistantDefinitions = async () =>
    await Promise.all(Object.values(assistants));

  private async syncSystemAssistants() {
    let definitions = await this.systemAssistantDefinitions();

    return new Map(
      definitions.map(d => [
        d.implementation.slug,
        {
          definition: d,
          defaultModel: d.implementation.persistedDefaultModel,
          availableModels: d.implementation.persistedAvailableModels
        } satisfies PersistedImplementationDefinition
      ])
    );
  }

  private async enrichAssistants(assistants: AssistantWithRelations[]) {
    let implementations = await this.syncSystemAssistants();

    return assistants.map(assistant => {
      let implementation = implementations.get(assistant.implementation.slug);

      return {
        ...assistant,
        defaultModel: implementation?.defaultModel ?? null,
        availableModels: implementation?.availableModels ?? []
      };
    });
  }

  private availableAssistantWhere(d: { tenant: Tenant; assistantId?: string }) {
    return {
      AND: [
        d.assistantId
          ? {
              OR: [
                { id: d.assistantId },
                { slug: d.assistantId },
                { systemIdentifier: d.assistantId }
              ]
            }
          : {},
        {
          OR: [
            { ownerType: 'metorial' as const },
            { ownerType: 'tenant' as const, tenantOid: d.tenant.oid }
          ]
        }
      ]
    } satisfies Prisma.AssistantWhereInput;
  }

  async getAvailableAssistant(d: { tenant: Tenant; assistantId: string }) {
    await this.syncSystemAssistants();

    let assistant = await db.assistant.findFirst({
      where: this.availableAssistantWhere(d),
      include: assistantInclude
    });
    if (!assistant) throw new ServiceError(notFoundError('assistant', d.assistantId));

    return (await this.enrichAssistants([assistant]))[0]!;
  }

  async getAvailableAssistantsByIds(d: {
    tenant: Tenant;
    assistantIds: string[];
  }) {
    await this.syncSystemAssistants();

    let assistantIds = Array.from(new Set(d.assistantIds));
    if (!assistantIds.length) return new Map<string, AvailableAssistant>();

    let assistants = await db.assistant.findMany({
      where: {
        AND: [
          this.availableAssistantWhere({ tenant: d.tenant }),
          {
            id: { in: assistantIds }
          }
        ]
      },
      include: assistantInclude
    });
    let enriched = await this.enrichAssistants(assistants);

    return new Map(enriched.map(assistant => [assistant.id, assistant]));
  }

  async listAvailableAssistants(d: { tenant: Tenant }) {
    await this.syncSystemAssistants();

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let list = await db.assistant.findMany({
          ...opts,
          where: this.availableAssistantWhere(d),
          include: assistantInclude
        });

        return await this.enrichAssistants(list);
      })
    );
  }

  async getOrCreateAssistantInstance(d: {
    assistant: Assistant;
    tenant: Tenant;
  }): Promise<AssistantInstanceWithRelations> {
    return await db.assistantInstance.upsert({
      where: {
        assistantOid_tenantOid: {
          assistantOid: d.assistant.oid,
          tenantOid: d.tenant.oid
        }
      },
      update: {},
      create: {
        ...getId('assistantInstance'),
        assistantOid: d.assistant.oid,
        tenantOid: d.tenant.oid
      },
      include: assistantInstanceInclude
    });
  }
}

export let assistantService = Service.create(
  'assistantService',
  () => new AssistantServiceImpl()
).build();
