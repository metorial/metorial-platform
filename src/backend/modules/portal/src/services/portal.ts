import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import { Context } from '@metorial/context';
import { db, getOrganizationBrand, ID, Instance, Organization, Portal } from '@metorial/db';
import {
  consumerSurfaceService,
  type ConsumerSurfaceWithPublishableApiKey
} from '@metorial/module-consumer';
import { env } from '../env';
import {
  getPortalAllowedRedirectUrlFilters,
  type PortalAllowedRedirectUrlFilter,
  validatePortalAllowedRedirectUrlFilters
} from '../lib/oauth';
import { buildPortalUrlFromTemplate, parsePortalIdFromTemplate } from '../portalUrlTemplate';

let include = {
  surface: {
    include: {
      consumerAuthTenant: true,
      publishableApiKey: {
        include: {
          secrets: true
        }
      }
    }
  },
  organization: true,
  instance: {
    include: {
      project: true,
      organization: true
    }
  }
} as const;

let getPortalSlug = createSlugGenerator(async slug => {
  return !(await db.portal.findFirst({ where: { slug } }));
});

let getPortalRedirectDomains = () => {
  return env.portal.PORTAL_REDIRECT_DOMAINS.split(',')
    .map(domain => domain.trim())
    .filter(domain => domain.length > 0);
};

let buildPortalUrlFromId = (portalId: string) => {
  return buildPortalUrlFromTemplate(env.portal.PORTAL_HOST_TEMPLATE, portalId);
};

let buildPortalAresRedirectUrl = (d: { portalId: string; portalUrl: string }) => {
  let url = new URL(d.portalUrl);
  url.searchParams.set('__metorial_portal_action__', 'sso_callback');
  url.searchParams.set('portal_id', d.portalId);

  return url.toString();
};

let buildPortalAresAppSlug = (portalId: string) => {
  return `metorial-portal-${portalId}`;
};

type PortalSurface = ConsumerSurfaceWithPublishableApiKey;

let resolvePortalAllowedRedirectUrlFilters = (
  input?: PortalAllowedRedirectUrlFilter[] | null
) => {
  let allowedRedirectUrlFilters = getPortalAllowedRedirectUrlFilters(input);
  validatePortalAllowedRedirectUrlFilters(allowedRedirectUrlFilters);

  return allowedRedirectUrlFilters;
};

class PortalServiceImpl {
  private async configurePortalAres(d: {
    portalId: string;
    portalSlug: string;
    surface: PortalSurface;
  }): Promise<PortalSurface> {
    if (d.surface.status != 'active') {
      return d.surface;
    }

    return await consumerSurfaceService.configureConsumerSurfaceAres({
      consumerSurface: d.surface,
      aresApp: {
        slug: buildPortalAresAppSlug(d.portalId),
        defaultRedirectUrl: buildPortalAresRedirectUrl({
          portalId: d.portalId,
          portalUrl: buildPortalUrlFromId(d.portalSlug)
        }),
        redirectDomains: getPortalRedirectDomains()
      }
    });
  }

  async getPortalById(d: { instance: Instance; portalId: string }) {
    let portal = await db.portal.findFirst({
      where: {
        instanceOid: d.instance.oid,
        OR: [{ id: d.portalId }, { slug: d.portalId }]
      },
      include
    });
    if (!portal) {
      throw new ServiceError(notFoundError('portal'));
    }

    return portal;
  }

  async getPortalPublic(d: { portalId: string }) {
    let portal = await db.portal.findFirst({
      where: {
        status: 'active',
        surface: {
          status: 'active'
        },
        OR: [{ id: d.portalId }, { slug: d.portalId }]
      },
      include
    });
    if (!portal) {
      throw new ServiceError(notFoundError('portal'));
    }

    return portal;
  }

  listPortals(d: { instance: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.portal.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            status: 'active',
            surface: {
              status: 'active'
            }
          },
          include
        });
      })
    );
  }

  async createPortal(d: {
    organization: Organization;
    instance: Instance;
    context: Context;
    input: {
      name: string;
      description?: string;
      sessionExpiryTimeInSeconds?: number;
      allowedRedirectUrlFilters?: PortalAllowedRedirectUrlFilter[];
    };
  }) {
    let portalId = await ID.generateId('portal');
    let slug = await getPortalSlug({
      input: d.input.name
    });

    let surface = await consumerSurfaceService.createConsumerSurface({
      organization: d.organization,
      instance: d.instance,
      context: d.context,
      input: {
        name: d.input.name,
        description: d.input.description,
        sessionExpiryTimeInSeconds: d.input.sessionExpiryTimeInSeconds ?? 60 * 60 * 24 * 7
      }
    });

    try {
      surface = await this.configurePortalAres({
        portalId,
        portalSlug: slug,
        surface
      });

      return await db.portal.create({
        data: {
          id: portalId,
          status: 'active',
          name: d.input.name,
          description: d.input.description,
          slug,
          allowedRedirectUrlFilters: resolvePortalAllowedRedirectUrlFilters(
            d.input.allowedRedirectUrlFilters
          ),
          organizationOid: d.organization.oid,
          surfaceOid: surface.oid,
          instanceOid: d.instance.oid
        },
        include
      });
    } catch (error) {
      await Promise.allSettled([
        consumerSurfaceService.deleteConsumerSurface({
          consumerSurface: surface
        })
      ]);

      throw error;
    }
  }

  async updatePortal(d: {
    portal: Portal & {
      surface: PortalSurface;
    };
    input: {
      name?: string;
      description?: string;
      sessionExpiryTimeInSeconds?: number;
      allowedRedirectUrlFilters?: PortalAllowedRedirectUrlFilter[];
    };
  }) {
    if (d.portal.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a non-active portal.'
        })
      );
    }

    let surface = await consumerSurfaceService.updateConsumerSurface({
      consumerSurface: d.portal.surface,
      input: {
        name: d.input.name,
        description: d.input.description,
        sessionExpiryTimeInSeconds: d.input.sessionExpiryTimeInSeconds
      }
    });

    let portal = await db.portal.update({
      where: {
        oid: d.portal.oid
      },
      data: {
        name: d.input.name,
        description: d.input.description,
        allowedRedirectUrlFilters:
          d.input.allowedRedirectUrlFilters !== undefined
            ? resolvePortalAllowedRedirectUrlFilters(d.input.allowedRedirectUrlFilters)
            : undefined
      },
      include
    });

    surface = await this.configurePortalAres({
      portalId: portal.id,
      portalSlug: portal.slug,
      surface
    });

    return {
      ...portal,
      surface
    };
  }

  async archivePortal(d: {
    portal: Portal & {
      surface: PortalSurface;
    };
  }) {
    if (d.portal.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Portal is already archived or deleted.'
        })
      );
    }

    await consumerSurfaceService.archiveConsumerSurface({
      consumerSurface: d.portal.surface
    });

    return await db.portal.update({
      where: {
        oid: d.portal.oid
      },
      data: {
        status: 'archived',
        archivedAt: new Date()
      },
      include
    });
  }

  getPortalHost(d: { portal: Pick<Portal, 'slug'> }) {
    return {
      host: buildPortalUrlFromId(d.portal.slug)
    };
  }

  parsePortalIdFromHost(d: { url: string }) {
    return parsePortalIdFromTemplate({
      template: env.portal.PORTAL_HOST_TEMPLATE,
      url: d.url
    });
  }

  async getBrand(d: {
    portal: {
      organization: Pick<Organization, 'id' | 'name' | 'image'>;
    };
  }) {
    return await getOrganizationBrand(d.portal.organization);
  }
}

export let portalService = Service.create(
  'portalService',
  () => new PortalServiceImpl()
).build();
