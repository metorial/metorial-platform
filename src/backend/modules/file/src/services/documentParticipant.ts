import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type {
  Consumer,
  ConsumerProfile,
  ConsumerSurface,
  InstanceConsumer,
  Organization,
  OrganizationActor,
  OrganizationMember
} from '@metorial/db';
import { db } from '@metorial/db';
import { consumerService } from '@metorial/module-consumer';
import { cargo, type CargoActor, type CargoDocumentParticipant } from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import type { FileOwner } from './file';

let organizationActorInclude = {
  organization: true,
  teams: {
    include: {
      team: true
    }
  }
} as const;

type EnrichedOrganizationActor = OrganizationActor & {
  organization: Organization;
};

type EnrichedConsumer = InstanceConsumer & {
  consumer: Consumer & {
    organizationMember: OrganizationMember | null;
    profiles: (ConsumerProfile & {
      surface: ConsumerSurface;
    })[];
  };
};

export type EnrichedCargoDocumentActor = {
  name: string;
  organizationActor: EnrichedOrganizationActor | null;
  consumer: EnrichedConsumer | null;
};

export type EnrichedCargoDocumentParticipant = Omit<CargoDocumentParticipant, 'actor'> & {
  actor: EnrichedCargoDocumentActor;
};

class DocumentParticipantServiceImpl {
  async enrichActors(d: {
    owner: FileOwner;
    actors: CargoActor[];
  }): Promise<EnrichedCargoDocumentActor[]> {
    if (!d.actors.length) {
      return [];
    }

    let organizationActorIds = Array.from(
      new Set(
        d.actors.flatMap(actor =>
          actor.organizationActorId ? [actor.organizationActorId] : []
        )
      )
    );
    let consumerIds = Array.from(
      new Set(
        d.actors.flatMap(actor =>
          !actor.organizationActorId && actor.consumerId ? [actor.consumerId] : []
        )
      )
    );

    let organizationActors =
      d.owner.type === 'organization' || d.owner.type === 'instance'
        ? await db.organizationActor.findMany({
            where: {
              organizationOid: d.owner.organization.oid,
              id: {
                in: organizationActorIds
              }
            },
            include: organizationActorInclude
          })
        : [];

    let consumers =
      d.owner.type === 'instance'
        ? await consumerService.findConsumersById({
            instance: d.owner.instance,
            consumerIds
          })
        : [];

    let organizationActorById = new Map(
      organizationActors.map(organizationActor => [organizationActor.id, organizationActor])
    );
    let consumerById = new Map(consumers.map(consumer => [consumer.consumer.id, consumer]));

    return d.actors.map(actor => {
      let organizationActor = actor.organizationActorId
        ? (organizationActorById.get(actor.organizationActorId) ?? null)
        : null;
      let consumer =
        !organizationActor && actor.consumerId
          ? (consumerById.get(actor.consumerId) ?? null)
          : null;

      return {
        name: organizationActor?.name ?? consumer?.name ?? actor.name,
        organizationActor,
        consumer
      };
    });
  }

  async enrichParticipants(d: {
    owner: FileOwner;
    participants: CargoDocumentParticipant[];
  }): Promise<EnrichedCargoDocumentParticipant[]> {
    let actors = await this.enrichActors({
      owner: d.owner,
      actors: d.participants.map(participant => participant.actor)
    });

    return d.participants.map((participant, index) => ({
      ...participant,
      actor: actors[index]!
    }));
  }

  async listDocumentParticipants(d: {
    owner: FileOwner;
    documentId: string;
    ids?: string[];
    createdAt?: { gt?: Date; lt?: Date };
    updatedAt?: { gt?: Date; lt?: Date };
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.documentParticipant.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        documentId: d.documentId,
        documentParticipantIds: d.ids,
        createdAt: d.createdAt,
        lastEditedAt: d.updatedAt,
        actorId,
        defaultPermissions,
        overridePermissions,
        ...input
      });

      return {
        items: await this.enrichParticipants({
          owner: d.owner,
          participants: result.items
        }),
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getDocumentParticipantById(d: {
    owner: FileOwner;
    documentParticipantId: string;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);
    let participant = await cargo.documentParticipant.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentParticipantId: d.documentParticipantId,
      actorId,
      defaultPermissions,
      overridePermissions
    });

    return (
      await this.enrichParticipants({
        owner: d.owner,
        participants: [participant]
      })
    )[0]!;
  }
}

export let documentParticipantService = Service.create(
  'fileDocumentParticipant',
  () => new DocumentParticipantServiceImpl()
).build();
