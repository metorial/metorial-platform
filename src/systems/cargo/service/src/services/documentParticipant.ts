import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma } from '../../prisma/generated/client';
import { db } from '../db';
import type { CargoTenantEnvironment } from './filePurpose';

export let documentParticipantInclude = {
  document: true,
  tenantActor: true
} satisfies Prisma.DocumentParticipantInclude;

class DocumentParticipantServiceImpl {
  async getDocumentParticipantById(
    d: CargoTenantEnvironment & {
      documentParticipantId: string;
    }
  ) {
    let participant = await db.documentParticipant.findFirst({
      where: {
        document: {
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          file: {
            status: 'active'
          }
        },
        id: d.documentParticipantId
      },
      include: documentParticipantInclude
    });

    if (!participant) {
      throw new ServiceError(notFoundError('documentParticipant', d.documentParticipantId));
    }

    return participant;
  }

  async listDocumentParticipants(
    d: CargoTenantEnvironment & {
      documentId: string;
    }
  ) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        await db.documentParticipant.findMany({
          ...opts,
          where: {
            document: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              id: d.documentId,
              file: {
                status: 'active'
              }
            }
          },
          include: documentParticipantInclude,
          orderBy: {
            createdAt: 'asc'
          }
        })
      )
    );
  }
}

export let documentParticipantService = Service.create(
  'cargoDocumentParticipantService',
  () => new DocumentParticipantServiceImpl()
).build();
