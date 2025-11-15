import { ConsumerSurface, db, ID, Organization, Portal, withTransaction } from '@metorial/db';
import { badRequestError, notFoundError, ServiceError } from '@metorial/error';
import { consumerSurfaceService } from '@metorial/module-consumer';
import { Service } from '@metorial/service';
import { createSlugGenerator } from '@metorial/slugify';
import { Paginator } from '../../../../../packages/server/pagination/src';
import { getPortalHost } from '../env';

let include = {
  surface: true
};

let getPortalSlug = createSlugGenerator(
  async slug => !(await db.portal.findFirst({ where: { slug } }))
);

class portalServiceImpl {
  async getPortalById(d: { organization: Organization; portalId: string }) {
    let portal = await db.portal.findFirst({
      where: { id: d.portalId, organizationOid: d.organization.oid },
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
      include
    });
    if (!portal) throw new ServiceError(notFoundError('portal'));
    return portal;
  }

  async listPortals(d: { organization: Organization }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.portal.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: 'active'
            },
            include
          })
      )
    );
  }

  async createPortal(d: {
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
        organization: d.organization
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
          surfaceOid: surface.oid
        },
        include
      });
    });
  }

  async updatePortal(d: {
    portal: Portal;
    input: {
      name?: string;
      description?: string;
      brandImage?: PrismaJson.EntityImage;
      brandName?: string;
    };
  }) {
    if (d.portal.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update an inactive portal.'
        })
      );
    }

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

      await db.portal.updateMany({
        where: { oid: d.portal.oid },
        data: { status: 'inactive' }
      });
    });
  }

  async getPortalHost(d: { portal: Portal }) {
    return getPortalHost({
      portal: d.portal
    });
  }
}

export let portalService = Service.create(
  'portalService',
  () => new portalServiceImpl()
).build();
