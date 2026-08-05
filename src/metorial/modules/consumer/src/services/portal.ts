import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import { Context } from '@metorial/context';
import { db, ID, Instance, Organization, Portal, Prisma, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import type { NamespacePropertyWithNamespace } from '@metorial/module-organization';
import { env } from '../env';
import {
  getPortalAllowedRedirectUrlFilters,
  portalAllowedRedirectUrlFiltersEqual,
  validatePortalAllowedRedirectUrlFilters,
  type PortalAllowedRedirectUrlFilter
} from '../lib/oauth';
import { buildPortalUrlFromTemplate, parsePortalIdFromTemplate } from '../portalUrlTemplate';
import {
  consumerSurfaceService,
  type ConsumerSurfaceSkillConfigurationInput,
  type ConsumerSurfaceWithPublishableApiKey,
  type EnrichedConsumerSurface
} from './consumers/consumerSurface';

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

// Portal slugs end up as a DNS label (the portal host) and as a URL path segment, so they may
// only contain lowercase alphanumerics and single interior hyphens. Slug generation can
// otherwise produce mixed case when it falls back to a random id.
let toDnsSafeSlug = (slug: string) =>
  slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 63)
    .replace(/-+$/, '');

// Normalization happens before the availability check, so the slug that gets reserved is the
// same one that ends up in the database.
let generatePortalSlug = createSlugGenerator(async candidate => {
  let slug = toDnsSafeSlug(candidate);
  if (!slug) return false;

  return (
    !(await db.portal.findFirst({ where: { slug } })) &&
    !(await db.cellPortal.findFirst({ where: { slug } }))
  );
});

let getPortalSlug = async (d: { input: string; current?: string }) =>
  toDnsSafeSlug(await generatePortalSlug(d));

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
type EnrichedPortalSurface = EnrichedConsumerSurface;
type PortalRecord = Prisma.PortalGetPayload<{
  include: typeof include;
}>;

let resolvePortalAllowedRedirectUrlFilters = (
  input?: PortalAllowedRedirectUrlFilter[] | null
) => {
  if (input == null) return null;

  validatePortalAllowedRedirectUrlFilters(input);

  if (portalAllowedRedirectUrlFiltersEqual(input, getPortalAllowedRedirectUrlFilters())) {
    return null;
  }

  return input;
};

let toNullablePortalAllowedRedirectUrlFilters = (
  value: PortalAllowedRedirectUrlFilter[] | null | undefined
) => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;

  return value;
};

class PortalServiceImpl {
  private async enrichPortals<T extends PortalRecord>(d: {
    instance: Instance;
    portals: T[];
  }): Promise<(T & { surface: EnrichedPortalSurface })[]> {
    let surfaces = await consumerSurfaceService.enrichConsumerSurfaces({
      instance: d.instance,
      consumerSurfaces: d.portals.map(portal => portal.surface)
    });
    let surfaceById = new Map(surfaces.map(surface => [surface.id, surface]));

    return d.portals.map(portal => ({
      ...portal,
      surface: surfaceById.get(portal.surface.id)!
    }));
  }

  private async enrichPortal<T extends PortalRecord>(d: {
    instance: Instance;
    portal: T;
  }): Promise<T & { surface: EnrichedPortalSurface }> {
    let [portal] = await this.enrichPortals({
      instance: d.instance,
      portals: [d.portal]
    });

    return portal!;
  }

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

    return await this.enrichPortal({
      instance: d.instance,
      portal
    });
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

    return await this.enrichPortal({
      instance: portal.instance,
      portal
    });
  }

  listPortals(d: { instance: Instance; search?: string }) {
    let normalizedSearch = d.search?.trim();
    if (!normalizedSearch?.length) normalizedSearch = undefined;

    let paginator = Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.portal.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            status: 'active',
            surface: {
              status: 'active'
            },
            OR: normalizedSearch
              ? [
                  { id: { contains: normalizedSearch, mode: 'insensitive' } },
                  { slug: { contains: normalizedSearch, mode: 'insensitive' } },
                  { name: { contains: normalizedSearch, mode: 'insensitive' } },
                  { description: { contains: normalizedSearch, mode: 'insensitive' } }
                ]
              : undefined
          },
          include
        });
      })
    );

    return Paginator.create(() => async input => {
      let list = await paginator.run(input);

      return {
        ...list,
        items: await this.enrichPortals({
          instance: d.instance,
          portals: list.items
        })
      };
    });
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
      allowConsumerSkillAuthoring?: boolean;
      allowConsumerSkillPublishing?: boolean;
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
        sessionExpiryTimeInSeconds: d.input.sessionExpiryTimeInSeconds ?? 60 * 60 * 24 * 7,
        allowConsumerSkillAuthoring: d.input.allowConsumerSkillAuthoring,
        allowConsumerSkillPublishing: d.input.allowConsumerSkillPublishing
      }
    });

    try {
      surface = await this.configurePortalAres({
        portalId,
        portalSlug: slug,
        surface
      });

      let portal = await withTransaction(async db => {
        await Fabric.fire('portal.created:before', d);

        let portal = await db.portal.create({
          data: {
            id: portalId,
            status: 'active',
            name: d.input.name,
            description: d.input.description,
            slug,
            allowedRedirectUrlFilters: toNullablePortalAllowedRedirectUrlFilters(
              resolvePortalAllowedRedirectUrlFilters(d.input.allowedRedirectUrlFilters)
            ),
            organizationOid: d.organization.oid,
            surfaceOid: surface.oid,
            instanceOid: d.instance.oid
          },
          include
        });

        await Fabric.fire('portal.created:after', {
          ...d,
          portal
        });

        return portal;
      });

      return await this.enrichPortal({
        instance: d.instance,
        portal
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
      allowConsumerSkillAuthoring?: boolean;
      allowConsumerSkillPublishing?: boolean;
      skillConfiguration?: ConsumerSurfaceSkillConfigurationInput;
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
        sessionExpiryTimeInSeconds: d.input.sessionExpiryTimeInSeconds,
        allowConsumerSkillAuthoring: d.input.allowConsumerSkillAuthoring,
        allowConsumerSkillPublishing: d.input.allowConsumerSkillPublishing,
        skillConfiguration: d.input.skillConfiguration
      }
    });

    let portal = await withTransaction(async db => {
      await Fabric.fire('portal.updated:before', d);

      let portal = await db.portal.update({
        where: {
          oid: d.portal.oid
        },
        data: {
          name: d.input.name,
          description: d.input.description,
          allowedRedirectUrlFilters:
            d.input.allowedRedirectUrlFilters !== undefined
              ? toNullablePortalAllowedRedirectUrlFilters(
                  resolvePortalAllowedRedirectUrlFilters(d.input.allowedRedirectUrlFilters)
                )
              : undefined
        },
        include
      });

      await Fabric.fire('portal.updated:after', {
        ...d,
        portal
      });

      return portal;
    });

    let surfaceRes = await this.configurePortalAres({
      portalId: portal.id,
      portalSlug: portal.slug,
      surface
    });

    surface = {
      ...surface,
      ...surfaceRes
    };

    return await this.enrichPortal({
      instance: portal.instance,
      portal: {
        ...portal,
        surface
      }
    });
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

    let portal = await withTransaction(async db => {
      await Fabric.fire('portal.archived:before', d);

      let portal = await db.portal.update({
        where: {
          oid: d.portal.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        },
        include
      });

      await Fabric.fire('portal.archived:after', {
        portal
      });

      return portal;
    });

    return await this.enrichPortal({
      instance: portal.instance,
      portal
    });
  }

  getPortalHost(d: { portal: Pick<Portal, 'slug'> }) {
    return {
      host: buildPortalUrlFromId(d.portal.slug)
    };
  }

  /**
   * All URLs a portal can be reached under. When namespaces are attached, those are the only
   * entries (ordered by compartment priority). Otherwise fall back to the configured host so
   * callers still get a usable URL before namespaces exist. A namespace dedicated to this
   * portal serves it at the root; shared namespaces need the slug to disambiguate.
   */
  getPortalUrls(d: {
    portal: Pick<Portal, 'slug'>;
    namespaces: NamespacePropertyWithNamespace[];
  }) {
    if (!d.namespaces.length) {
      return [{ type: 'default' as const, url: this.getPortalHost({ portal: d.portal }).host }];
    }

    let urls: { type: 'namespace'; url: string }[] = [];
    let seen = new Set<string>();

    for (let { namespace } of d.namespaces) {
      let origin = `https://${namespace.value}.${namespace.compartment.value}`;
      let url = namespace.purposes.includes('metorial_portal_single')
        ? origin
        : `${origin}/p/${d.portal.slug}`;

      if (seen.has(url)) continue;
      seen.add(url);
      urls.push({ type: 'namespace', url });
    }

    return urls;
  }

  parsePortalIdFromHost(d: { url: string }) {
    return parsePortalIdFromTemplate({
      template: env.portal.PORTAL_HOST_TEMPLATE,
      url: d.url
    });
  }
}

export let portalService = Service.create(
  'portalService',
  () => new PortalServiceImpl()
).build();
