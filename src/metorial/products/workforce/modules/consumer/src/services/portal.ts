import { delay } from '@lowerdeck/delay';
import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import { getConfig } from '@metorial/config';
import { Context } from '@metorial/context';
import { db, ID, Instance, Organization, Portal, Prisma, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  namespaceService,
  type NamespacePropertyWithNamespace
} from '@metorial/module-organization';
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

let buildPortalUrlFromId = (portalId: string) => {
  return buildPortalUrlFromTemplate(env.portal.PORTAL_HOST_TEMPLATE, portalId);
};

let toOrigin = (value: string | null | undefined) => {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
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

    let portal = await withTransaction(async db => {
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

    await delay(2000);

    portal = await db.portal.findUniqueOrThrow({
      where: { oid: portal.oid },
      include
    });

    return await this.enrichPortal({
      instance: d.instance,
      portal
    });
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

  getPortalUrls(d: {
    portal: Pick<Portal, 'slug'>;
    namespaces: NamespacePropertyWithNamespace[];
  }) {
    let urls: { type: 'default' | 'namespace'; url: string }[] = [];
    let seen = new Set<string>();

    let add = (type: 'default' | 'namespace', url: string) => {
      if (seen.has(url)) return;
      seen.add(url);
      urls.push({ type, url });
    };

    if (getConfig().env == 'development') {
      add('default', `${getConfig().urls.portalsUrl.replace(/\/+$/, '')}/p/${d.portal.slug}`);
    }

    // Shared namespaces (cloud tenant, etc.) stay ahead of the dedicated portal hostname so the
    // primary URL prefers the family hostname; compartment priority still applies within each group.
    let namespaces = [...d.namespaces].sort((a, b) => {
      let aSingle = a.namespace.purposes.includes('metorial_portal_single') ? 1 : 0;
      let bSingle = b.namespace.purposes.includes('metorial_portal_single') ? 1 : 0;
      return aSingle - bSingle;
    });

    for (let { namespace } of namespaces) {
      let origin = `https://${namespace.value}.${namespace.compartment.value}`;

      add(
        'namespace',
        namespace.purposes.includes('metorial_portal_single')
          ? origin
          : `${origin}/p/${d.portal.slug}`
      );
    }

    if (!urls.length) add('default', this.getPortalHost({ portal: d.portal }).host);

    return urls;
  }

  async getPrimaryPortalUrls(d: { portals: Pick<Portal, 'oid' | 'slug'>[] }) {
    let namespacesByPortalOid = await namespaceService.getNamespacePropertiesByPortalOid({
      portals: d.portals
    });

    return new Map(
      d.portals.map(portal => {
        let [primary] = this.getPortalUrls({
          portal,
          namespaces: namespacesByPortalOid.get(portal.oid) ?? []
        });

        return [portal.oid, primary?.url ?? this.getPortalHost({ portal }).host] as const;
      })
    );
  }

  async getPrimaryPortalUrl(d: { portal: Pick<Portal, 'oid' | 'slug'> }) {
    let urls = await this.getPrimaryPortalUrls({ portals: [d.portal] });

    return urls.get(d.portal.oid) ?? this.getPortalHost({ portal: d.portal }).host;
  }

  async getPortalUrlForOrigin(d: {
    portal: Pick<Portal, 'oid' | 'slug'>;
    origin?: string | null;
  }) {
    let namespacesByPortalOid = await namespaceService.getNamespacePropertiesByPortalOid({
      portals: [d.portal]
    });
    let urls = this.getPortalUrls({
      portal: d.portal,
      namespaces: namespacesByPortalOid.get(d.portal.oid) ?? []
    });

    let requestOrigin = toOrigin(d.origin);
    let match = requestOrigin
      ? urls.find(({ url }) => toOrigin(url) == requestOrigin)
      : undefined;

    return match?.url ?? urls[0]?.url ?? this.getPortalHost({ portal: d.portal }).host;
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
