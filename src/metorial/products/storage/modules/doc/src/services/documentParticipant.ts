import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { storeAccessService, storeReadPermission } from '@metorial/module-store';
import type { Instance, Prisma, Project, StoreParticipantPermissions } from '@metorial/db';
import { db } from '@metorial/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveDocumentParticipants,
  resolveDocuments,
  resolveResourceActors
} from '@metorial/list-utils';
import type { ResourceAuthorization } from '@metorial/module-access';
import {
  exposedParticipantResourceActorWhere,
  resourceActorPresentationInclude
} from '@metorial/module-resource-actor';
import { internalDocumentParticipantService } from '../internal/documentParticipant';

export let documentParticipantInclude = {
  document: true,
  resourceActor: {
    include: resourceActorPresentationInclude
  }
} satisfies Prisma.DocumentParticipantInclude;

export let dedupedDocumentParticipantInclude = {
  ...documentParticipantInclude,
  storeParticipant: {
    include: {
      primaryResourceActor: { include: resourceActorPresentationInclude }
    }
  }
} satisfies Prisma.DocumentParticipantInclude;

type DedupedDocumentParticipant = Prisma.DocumentParticipantGetPayload<{
  include: typeof dedupedDocumentParticipantInclude;
}>;

let maxDate = (left: Date | null, right: Date | null) =>
  !left ? right : !right ? left : left > right ? left : right;

let mergeDocumentParticipants = (participants: DedupedDocumentParticipant[]) => {
  let [first, ...rest] = participants;

  return rest.reduce(
    (merged, participant) => ({
      ...merged,
      role: merged.role == 'editor' || participant.role == 'editor' ? 'editor' : 'viewer',
      editCount: merged.editCount + participant.editCount,
      lastEditedAt: maxDate(merged.lastEditedAt, participant.lastEditedAt),
      lastViewedAt: maxDate(merged.lastViewedAt, participant.lastViewedAt),
      createdAt:
        participant.createdAt < merged.createdAt ? participant.createdAt : merged.createdAt
    }),
    first!
  );
};

class DocumentParticipantServiceImpl {
  async getDocumentParticipantById(d: {
    project: Project;
    instance: Instance;
    documentParticipantId: string;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
    dedupeByStoreParticipant?: boolean;
  }) {
    let participant = await db.documentParticipant.findFirst({
      where: {
        document: {
          projectOid: d.project.oid,
          instanceOid: d.instance.oid,
          file: {
            status: 'active'
          }
        },
        id: d.documentParticipantId,
        resourceActor: exposedParticipantResourceActorWhere
      },
      include: d.dedupeByStoreParticipant
        ? dedupedDocumentParticipantInclude
        : documentParticipantInclude
    });

    if (!participant) {
      throw new ServiceError(notFoundError('documentParticipant', d.documentParticipantId));
    }

    await storeAccessService.assertStoreAccessForDocument({
      project: d.project,
      instance: d.instance,
      document: participant.document,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return participant;
  }

  async listDocumentParticipants(d: {
    project: Project;
    instance: Instance;
    documentId: string;
    ids?: string[];
    actorIds?: string[];
    createdAt?: DateFilter;
    lastEditedAt?: DateFilter;
    lastViewedAt?: DateFilter;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
    dedupeByStoreParticipant?: boolean;
  }) {
    let document = await db.document.findFirst({
      where: {
        projectOid: d.project.oid,
        instanceOid: d.instance.oid,
        id: d.documentId,
        file: {
          status: 'active'
        }
      }
    });

    if (!document) throw new ServiceError(notFoundError('document', d.documentId));

    await storeAccessService.assertStoreAccessForDocument({
      project: d.project,
      instance: d.instance,
      document,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    await internalDocumentParticipantService.materializeDocumentParticipantsFromStores({
      document
    });
    let participants = await resolveDocumentParticipants(d, d.ids);
    let documents = await resolveDocuments(d, [d.documentId]);
    let actors = await resolveResourceActors(d, d.actorIds);

    let where = {
      oid: participants ? participants.in : undefined,
      document: {
        projectOid: d.project.oid,
        instanceOid: d.instance.oid,
        oid: documents ? documents.in : undefined,
        file: {
          status: 'active'
        }
      },
      resourceActorOid: actors ? actors.in : undefined,
      resourceActor: exposedParticipantResourceActorWhere,
      createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined,
      lastEditedAt: d.lastEditedAt ? normalizeDateFilter(d.lastEditedAt) : undefined,
      lastViewedAt: d.lastViewedAt ? normalizeDateFilter(d.lastViewedAt) : undefined
    } satisfies Prisma.DocumentParticipantWhereInput;

    if (!d.dedupeByStoreParticipant) {
      return Paginator.create(({ prisma }) =>
        prisma(
          async opts =>
            await db.documentParticipant.findMany({
              ...opts,
              where,
              include: documentParticipantInclude
            })
        )
      );
    }

    let linkedWhere = {
      documentOid: document.oid,
      resourceActor: exposedParticipantResourceActorWhere,
      storeParticipantOid: { not: null }
    } satisfies Prisma.DocumentParticipantWhereInput;

    let groups = await db.documentParticipant.groupBy({
      by: ['storeParticipantOid'],
      where: linkedWhere,
      _min: { oid: true }
    });
    let representativeOids = groups
      .map(group => group._min.oid)
      .filter((oid): oid is bigint => oid != null);

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let page = await db.documentParticipant.findMany({
          ...opts,
          where: {
            ...where,
            OR: [{ storeParticipantOid: null }, { oid: { in: representativeOids } }]
          },
          include: dedupedDocumentParticipantInclude
        });

        let storeParticipantOids = page
          .map(participant => participant.storeParticipantOid)
          .filter((oid): oid is bigint => oid != null);
        if (!storeParticipantOids.length) return page;

        let siblings = await db.documentParticipant.findMany({
          where: { ...linkedWhere, storeParticipantOid: { in: storeParticipantOids } },
          include: dedupedDocumentParticipantInclude,
          orderBy: { oid: 'asc' }
        });

        return page.map(participant =>
          participant.storeParticipantOid
            ? mergeDocumentParticipants([
                participant,
                ...siblings.filter(
                  sibling =>
                    sibling.storeParticipantOid == participant.storeParticipantOid &&
                    sibling.oid != participant.oid
                )
              ])
            : participant
        );
      })
    );
  }
}

export let documentParticipantService = Service.create(
  'cargoDocumentParticipantService',
  () => new DocumentParticipantServiceImpl()
).build();
