import {
  ConsumerSurface,
  db,
  ID,
  Instance,
  Organization,
  Portal,
  ServerListingCollection,
  withTransaction
} from '@metorial/db';
import { badRequestError, notFoundError, ServiceError } from '@metorial/error';
import { generateCustomId } from '@metorial/id';
import { consumerSurfaceService } from '@metorial/module-consumer';
import { Service } from '@metorial/service';
import { createSlugGenerator } from '@metorial/slugify';
import { Paginator } from '../../../../../packages/server/pagination/src';
import { getPortalHost, parsePortalIdFromHost } from '../env';

let include = {
  surface: {
    include: {
      publishableApiKey: {
        include: {
          secrets: true
        }
      }
    }
  },
  organization: true,
  featuredServersCollection: true
};

let getPortalSlug = createSlugGenerator(
  async slug => !(await db.portal.findFirst({ where: { slug } }))
);

class portalServiceImpl {
  async getPortalById(d: { instance: Instance; portalId: string }) {
    let portal = await db.portal.findFirst({
      where: { id: d.portalId, instanceOid: d.instance.oid },
      include
    });
    if (!portal) throw new ServiceError(notFoundError('portal'));
    return portal;
  }

  async getPortalPublic(d: { portalId: string }) {
    let portal = await db.portal.findFirst({
      where: {
        OR: [{ id: d.portalId }, { slug: d.portalId }],
        status: 'active'
      },
      include: {
        ...include,
        instance: true
      }
    });
    if (!portal) throw new ServiceError(notFoundError('portal'));
    return portal;
  }

  async listPortals(d: { instance: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.portal.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,
              status: 'active'
            },
            include
          })
      )
    );
  }

  async createPortal(d: {
    instance: Instance;
    organization: Organization;
    input: {
      name: string;
      description?: string;
    };
  }) {
    let slug = await getPortalSlug({
      input: d.input.name
    });

    return withTransaction(async db => {
      let surface = await consumerSurfaceService.createConsumerSurface({
        input: {
          name: d.input.name,
          description: d.input.description,
          sessionExpiryTimeInSeconds: 3600 * 24 * 7
        },
        organization: d.organization,
        instance: d.instance
      });

      await consumerSurfaceService.updateConsumerSurface({
        consumerSurface: surface,
        input: {
          factors: [{ type: 'email_code' }]
        }
      });

      return await db.portal.create({
        data: {
          id: await ID.generateId('portal'),
          status: 'active',

          name: d.input.name,
          description: d.input.description,
          slug,

          brandImage: d.organization.image,
          brandName: d.organization.name,

          organizationOid: d.organization.oid,
          instanceOid: d.instance.oid,
          surfaceOid: surface.oid
        },
        include
      });
    });
  }

  async ensureSurfaceFeaturedServersCollection(d: {
    portal: Portal & { featuredServersCollection: ServerListingCollection | null };
  }) {
    if (d.portal.featuredServersCollection) {
      return d.portal.featuredServersCollection;
    }

    let collection = await db.serverListingCollection.create({
      data: {
        id: await ID.generateId('serverListingCollection'),
        name: `${d.portal.name} Featured Servers`,
        description: ``,
        slug: generateCustomId('pfeat_', 20),
        instanceOid: d.portal.instanceOid,
        isPublic: false
      }
    });

    await db.portal.update({
      where: { oid: d.portal.oid },
      data: { featuredServersCollectionOid: collection.oid }
    });

    return collection;
  }

  async updatePortal(d: {
    portal: Portal & {
      surface: ConsumerSurface;
    };
    input: {
      name?: string;
      description?: string;
      brandImage?: PrismaJson.EntityImage;
      brandName?: string;
      sessionExpiryTimeInSeconds?: number;
    };
  }) {
    if (d.portal.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update an inactive portal.'
        })
      );
    }

    return await withTransaction(async db => {
      await consumerSurfaceService.updateConsumerSurface({
        consumerSurface: d.portal.surface,
        input: {
          name: d.input.name,
          description: d.input.description,
          sessionExpiryTimeInSeconds: d.input.sessionExpiryTimeInSeconds
        }
      });

      return await db.portal.update({
        where: { oid: d.portal.oid },
        data: {
          name: d.input.name ?? d.portal.name,
          description: d.input.description ?? d.portal.description,
          brandImage: d.input.brandImage ?? d.portal.brandImage,
          brandName: d.input.brandName
        },
        include
      });
    });
  }

  async deletePortal(d: {
    portal: Portal & {
      surface: ConsumerSurface;
    };
  }) {
    if (d.portal.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Portal is already deleted.'
        })
      );
    }

    return withTransaction(async db => {
      await consumerSurfaceService.deleteConsumerSurface({
        consumerSurface: d.portal.surface
      });

      return await db.portal.update({
        where: { oid: d.portal.oid },
        data: { status: 'inactive' },
        include
      });
    });
  }

  async getPortalHost(d: { portal: Portal }) {
    return getPortalHost({
      portal: d.portal
    });
  }

  async parsePortalIdFromHost(d: { url: string }) {
    return parsePortalIdFromHost({
      url: d.url
    });
  }
}

export let portalService = Service.create(
  'portalService',
  () => new portalServiceImpl()
).build();
