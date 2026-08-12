import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { ProductAssistant, ResourceTenant } from '@metorial/db';
import { db, ID, Prisma } from '@metorial/db';
import { assistants } from '../definitions/assistants';
import {
  implementationModelInclude,
  type ImplementationModelWithProvider
} from '../lib/definitions';

export let productAssistantModelInclude = implementationModelInclude;
export type ProductAssistantModelWithProvider = ImplementationModelWithProvider;

export let productAssistantInclude = {
  implementation: true,
  resourceTenant: true
} satisfies Prisma.ProductAssistantInclude;

export type ProductAssistantWithRelations = Prisma.ProductAssistantGetPayload<{
  include: typeof productAssistantInclude;
}>;

export type AvailableProductAssistant = ProductAssistantWithRelations & {
  defaultModel: ProductAssistantModelWithProvider | null;
  availableModels: ProductAssistantModelWithProvider[];
};

export let productAssistantInstanceInclude = {
  assistant: {
    include: productAssistantInclude
  },
  resourceTenant: true
} satisfies Prisma.ProductAssistantInstanceInclude;

export type ProductAssistantInstanceWithRelations = Prisma.ProductAssistantInstanceGetPayload<{
  include: typeof productAssistantInstanceInclude;
}>;

type AssistantDefinition = Awaited<(typeof assistants)[keyof typeof assistants]>;

type PersistedImplementationDefinition = {
  definition: AssistantDefinition;
  defaultModel: ProductAssistantModelWithProvider | null;
  availableModels: ProductAssistantModelWithProvider[];
};

class ProductAssistantServiceImpl {
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

  private async enrichAssistants(assistants: ProductAssistantWithRelations[]) {
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

  private availableAssistantWhere(d: { tenant: ResourceTenant; assistantId?: string }) {
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
            { ownerType: 'tenant' as const, resourceTenantOid: d.tenant.oid }
          ]
        }
      ]
    } satisfies Prisma.ProductAssistantWhereInput;
  }

  async get(d: { tenant: ResourceTenant; assistantId: string }) {
    await this.syncSystemAssistants();

    let assistant = await db.productAssistant.findFirst({
      where: this.availableAssistantWhere(d),
      include: productAssistantInclude
    });
    if (!assistant) throw new ServiceError(notFoundError('assistant', d.assistantId));

    return (await this.enrichAssistants([assistant]))[0]!;
  }

  async getMany(d: { tenant: ResourceTenant; assistantIds: string[] }) {
    await this.syncSystemAssistants();

    let assistantIds = Array.from(new Set(d.assistantIds));
    if (!assistantIds.length) return [];

    let assistants = await db.productAssistant.findMany({
      where: {
        AND: [
          this.availableAssistantWhere({ tenant: d.tenant }),
          {
            id: { in: assistantIds }
          }
        ]
      },
      include: productAssistantInclude
    });
    let enriched = await this.enrichAssistants(assistants);
    let assistantById = new Map(enriched.map(assistant => [assistant.id, assistant]));

    return assistantIds.flatMap(assistantId => {
      let assistant = assistantById.get(assistantId);
      return assistant ? [assistant] : [];
    });
  }

  async list(d: { tenant: ResourceTenant }) {
    await this.syncSystemAssistants();

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let list = await db.productAssistant.findMany({
          ...opts,
          where: this.availableAssistantWhere(d),
          include: productAssistantInclude
        });

        return await this.enrichAssistants(list);
      })
    );
  }

  async getOrCreateAssistantInstance(d: {
    assistant: ProductAssistant;
    tenant: ResourceTenant;
  }): Promise<ProductAssistantInstanceWithRelations> {
    return await db.productAssistantInstance.upsert({
      where: {
        assistantOid_resourceTenantOid: {
          assistantOid: d.assistant.oid,
          resourceTenantOid: d.tenant.oid
        }
      },
      update: {},
      create: {
        id: await ID.generateId('productAssistantInstance'),
        assistantOid: d.assistant.oid,
        resourceTenantOid: d.tenant.oid
      },
      include: productAssistantInstanceInclude
    });
  }
}

export let productAssistantService = Service.create(
  'productAssistantService',
  () => new ProductAssistantServiceImpl()
).build();
