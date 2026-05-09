import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  ConsumerGroup,
  ConsumerProfile,
  ConsumerProfileGroup,
  ConsumerSurface,
  InstanceConsumer,
  Organization,
  OrganizationActor,
  Team,
  TeamMember
} from '@metorial/db';
import { consumerService } from '@metorial/module-consumer';
import { db } from '@metorial/db';
import { resolveCargoAccess, type CargoAccessActor, type CargoStorePermission } from './access';
import {
  cargo,
  type CargoActor,
  type CargoDocumentParticipant
} from '../cargo';
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
  teams: (TeamMember & {
    team: Team;
  })[];
};

type EnrichedConsumerProfile = ConsumerProfile & {
  consumer: Awaited<
    ReturnType<typeof consumerService.getConsumerById>
  >['consumer'];
  surface: ConsumerSurface;
  groups: (ConsumerProfileGroup & {
    group: ConsumerGroup;
  })[];
  instanceConsumer: InstanceConsumer | null;
};

export type EnrichedCargoDocumentActor = {
  name: string;
  organizationActor: EnrichedOrganizationActor | null;
  consumerProfile: EnrichedConsumerProfile | null;
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
      new Set(d.actors.flatMap(actor => (actor.organizationActorId ? [actor.organizationActorId] : [])))
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
    let consumerProfileByConsumerId = new Map(
      consumers.flatMap(instanceConsumer => {
        let profiles = instanceConsumer.consumer.profiles;
        let selectedProfile = profiles[0];
        return selectedProfile
          ? [
              [
                instanceConsumer.consumer.id,
                {
                  ...selectedProfile,
                  consumer: instanceConsumer.consumer,
                  groups: [],
                  instanceConsumer
                } satisfies EnrichedConsumerProfile
              ]
            ]
          : [];
      })
    );

    return d.actors.map(actor => {
      let organizationActor =
        actor.organizationActorId
          ? (organizationActorById.get(actor.organizationActorId) ?? null)
          : null;
      let consumerProfile =
        !organizationActor && actor.consumerId
          ? (consumerProfileByConsumerId.get(actor.consumerId) ?? null)
          : null;

      return {
        name: organizationActor?.name ?? consumerProfile?.name ?? actor.name,
        organizationActor,
        consumerProfile
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
    documentId: string[];
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.documentParticipant.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        documentId: d.documentId,
        actorId,
        defaultPermissions,
        overridePermissions,
        ...input
      } as any);

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
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);
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
