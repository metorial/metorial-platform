import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Slate } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  slateVersion: {
    include: {
      specification: true,
      activeDeployment: {
        include: {
          slateVersion: {
            include: {
              specification: true
            }
          }
        }
      },
      slateVersionDiscoveries: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        include: {
          slateVersion: {
            include: {
              specification: true
            }
          }
        }
      }
    }
  },
  slate: {
    include: {
      registry: true,
      currentVersion: {
        include: {
          specification: true
        }
      }
    }
  }
};

class slateEventServiceImpl {
  async getSlateEventById(d: { slate: Slate; id: string }) {
    let slateEvent = await db.slateEvent.findFirst({
      where: {
        slateOid: d.slate.oid,
        id: d.id
      },
      include
    });
    if (!slateEvent) throw new ServiceError(notFoundError('slate.event'));
    return slateEvent;
  }

  async listSlateEvents(d: { slate?: Slate; versionIds?: string[]; type?: string }) {
    let versions =
      d.slate || d.versionIds
        ? await db.slateVersion.findMany({
            where: {
              slateOid: d.slate?.oid,
              OR: d.versionIds
                ? [{ id: { in: d.versionIds } }, { version: { in: d.versionIds } }]
                : undefined
            },
            select: { oid: true }
          })
        : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateEvent.findMany({
            ...opts,
            where: {
              slateOid: d.slate?.oid,
              slateVersion: versions ? { oid: { in: versions.map(v => v.oid) } } : undefined,
              type: d.type as any
            },
            include
          })
      )
    );
  }
}

export let slateEventService = Service.create(
  'slateEventService',
  () => new slateEventServiceImpl()
).build();
