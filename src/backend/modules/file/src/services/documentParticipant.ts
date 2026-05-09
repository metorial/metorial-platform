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
import { consumerProfileService } from '@metorial/module-consumer';
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
    ReturnType<typeof consumerProfileService.getConsumerProfileByIdForInstance>
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
    let consumerProfileIds = Array.from(
      new Set(
        d.actors.flatMap(actor =>
          !actor.organizationActorId && actor.consumerProfileId ? [actor.consumerProfileId] : []
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

    let consumerProfiles =
      d.owner.type === 'instance'
        ? await consumerProfileService.findConsumerProfilesByIdForInstance({
            instance: d.owner.instance,
            consumerProfileIds
          })
        : [];

    let organizationActorById = new Map(
      organizationActors.map(organizationActor => [organizationActor.id, organizationActor])
    );
    let consumerProfileById = new Map(
      consumerProfiles.map(consumerProfile => [consumerProfile.id, consumerProfile])
    );

    return d.actors.map(actor => {
      let organizationActor =
        actor.organizationActorId
          ? (organizationActorById.get(actor.organizationActorId) ?? null)
          : null;
      let consumerProfile =
        !organizationActor && actor.consumerProfileId
          ? (consumerProfileById.get(actor.consumerProfileId) ?? null)
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
