import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { ProductAssistant, Project } from '@metorial/db';
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
  project: true
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
  project: true
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

  private availableAssistantWhere(d: { project: Project; assistantId?: string }) {
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
            { ownerType: 'tenant' as const, projectOid: d.project.oid }
          ]
        }
      ]
    } satisfies Prisma.ProductAssistantWhereInput;
  }

  async get(d: { project: Project; assistantId: string }) {
    await this.syncSystemAssistants();

    let assistant = await db.productAssistant.findFirst({
      where: this.availableAssistantWhere(d),
      include: productAssistantInclude
    });
    if (!assistant) throw new ServiceError(notFoundError('assistant', d.assistantId));

    return (await this.enrichAssistants([assistant]))[0]!;
  }

  async getMany(d: { project: Project; assistantIds: string[] }) {
    await this.syncSystemAssistants();

    let assistantIds = Array.from(new Set(d.assistantIds));
    if (!assistantIds.length) return [];

    let assistants = await db.productAssistant.findMany({
      where: {
        AND: [
          this.availableAssistantWhere({ project: d.project }),
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

  async list(d: { project: Project }) {
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
    project: Project;
  }): Promise<ProductAssistantInstanceWithRelations> {
    return await db.productAssistantInstance.upsert({
      where: {
        assistantOid_projectOid: {
          assistantOid: d.assistant.oid,
          projectOid: d.project.oid
        }
      },
      update: {},
      create: {
        id: await ID.generateId('productAssistantInstance'),
        assistantOid: d.assistant.oid,
        projectOid: d.project.oid
      },
      include: productAssistantInstanceInclude
    });
  }
}

export let productAssistantService = Service.create(
  'productAssistantService',
  () => new ProductAssistantServiceImpl()
).build();
