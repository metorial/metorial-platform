import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import {
  Assistant,
  db,
  ID,
  Organization,
  OrganizationActor,
  Prisma,
  withTransaction
} from '@metorial/db';
import { organizationActorService } from '@metorial/module-organization';
import { assistants } from '../definitions/assistants';
import {
  implementationModelInclude,
  ImplementationModelWithProvider
} from '../lib/definitions';

export let assistantModelInclude = implementationModelInclude;
export type AssistantModelWithProvider = ImplementationModelWithProvider;

export let assistantInclude = {
  implementation: true,
  organization: true
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
  organization: true,
  organizationActor: true
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

  private availableAssistantWhere(d: { organization: Organization; assistantId?: string }) {
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
            { ownerType: 'organization' as const, organizationOid: d.organization.oid }
          ]
        }
      ]
    } satisfies Prisma.AssistantWhereInput;
  }

  async getAvailableAssistant(d: { organization: Organization; assistantId: string }) {
    await this.syncSystemAssistants();

    let assistant = await db.assistant.findFirst({
      where: this.availableAssistantWhere(d),
      include: assistantInclude
    });
    if (!assistant) throw new ServiceError(notFoundError('assistant', d.assistantId));

    return (await this.enrichAssistants([assistant]))[0];
  }

  async getAvailableAssistantsByIds(d: {
    organization: Organization;
    assistantIds: string[];
  }) {
    await this.syncSystemAssistants();

    let assistantIds = Array.from(new Set(d.assistantIds));
    if (!assistantIds.length) return new Map<string, AvailableAssistant>();

    let assistants = await db.assistant.findMany({
      where: {
        AND: [
          this.availableAssistantWhere({ organization: d.organization }),
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

  async listAvailableAssistants(d: { organization: Organization }) {
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
    organization: Organization;
    context?: Context;
    performedBy: OrganizationActor;
  }): Promise<AssistantInstanceWithRelations> {
    let existing = await db.assistantInstance.findUnique({
      where: {
        assistantOid_organizationOid: {
          assistantOid: d.assistant.oid,
          organizationOid: d.organization.oid
        }
      },
      include: assistantInstanceInclude
    });
    if (existing && (existing.organizationActor || d.assistant.ownerType !== 'metorial')) {
      return existing;
    }

    return await withTransaction(async db => {
      let agentActor =
        d.assistant.ownerType == 'metorial'
          ? await organizationActorService.createOrganizationActor({
              input: {
                type: 'agent',
                name: d.assistant.name,
                image: {
                  type: 'url',
                  url: 'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg'
                }
              },
              organization: d.organization,
              context: d.context,
              performedBy: {
                type: 'actor',
                actor: await organizationActorService.getSystemActor({
                  organization: d.organization
                })
              }
            })
          : null;

      return await db.assistantInstance.upsert({
        where: {
          assistantOid_organizationOid: {
            assistantOid: d.assistant.oid,
            organizationOid: d.organization.oid
          }
        },
        update: {
          organizationActorOid: agentActor?.oid
        },
        create: {
          id: await ID.generateId('assistantInstance'),
          assistantOid: d.assistant.oid,
          organizationOid: d.organization.oid,
          organizationActorOid: agentActor?.oid
        },
        include: assistantInstanceInclude
      });
    });
  }
}

export let assistantService = Service.create(
  'assistantService',
  () => new AssistantServiceImpl()
).build();
