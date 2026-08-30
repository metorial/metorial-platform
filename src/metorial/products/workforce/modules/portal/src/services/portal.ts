import { delay } from '@lowerdeck/delay';
import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import type { AuditScope } from '@metorial/audit-scope';
import {
  getPortalAllowedRedirectUrlFilters,
  portalAllowedRedirectUrlFiltersEqual,
  validatePortalAllowedRedirectUrlFilters,
  type PortalAllowedRedirectUrlFilter
} from '@metorial/consumer-oauth-utils';
import { Context } from '@metorial/context';
import { db, ID, Instance, Organization, Portal, Prisma, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  consumerSurfaceService,
  type ConsumerSurfaceSkillConfigurationInput,
  type ConsumerSurfaceWithPublishableApiKey,
  type EnrichedConsumerSurface
} from '@metorial/module-consumer-core';
import { type NamespacePropertyWithNamespace } from '@metorial/module-organization';
import {
  getPortalHost as resolvePortalHost,
  parsePortalIdFromHost as resolvePortalIdFromHost,
  getPortalUrlForOrigin as resolvePortalUrlForOrigin,
  getPortalUrls as resolvePortalUrls,
  getPrimaryPortalConnectUrl as resolvePrimaryPortalConnectUrl,
  getPrimaryPortalUrl as resolvePrimaryPortalUrl,
  getPrimaryPortalUrls as resolvePrimaryPortalUrls
} from '@metorial/portal-url';

let include = {
  surface: {
    include: {
      consumerAuthTenant: true,
      managedEveryoneGroup: true,
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

  async getPortalPublic(d: {
    portalId: string;
    namespace?: { value: string; compartmentValue: string };
  }) {
    let portal = await db.portal.findFirst({
      where: {
        status: 'active',
        surface: {
          status: 'active'
        },
        ...(d.namespace
          ? {
              slug: d.portalId,
              namespaceProperties: {
                some: {
                  type: 'portal' as const,
                  namespace: {
                    value: d.namespace.value,
                    purposes: {
                      hasSome: ['metorial_portal', 'metorial_portal_single'] as const
                    },
                    compartment: { value: d.namespace.compartmentValue }
                  }
                }
              }
            }
          : { OR: [{ id: d.portalId }, { slug: d.portalId }] })
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
    auditScope: AuditScope;
    input: {
      name: string;
      description?: string;
      sessionExpiryTimeInSeconds?: number;
      allowedRedirectUrlFilters?: PortalAllowedRedirectUrlFilter[];
      allowConsumerSkillAuthoring?: boolean;
      allowConsumerSkillPublishing?: boolean;
    };
    isDefaultPortal?: boolean;
    automatic?: boolean;
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
        auditScope: d.auditScope,
        input: {
          name: d.input.name,
          description: d.input.description,
          sessionExpiryTimeInSeconds: d.input.sessionExpiryTimeInSeconds ?? 60 * 60 * 24 * 7,
          allowConsumerSkillAuthoring: d.input.allowConsumerSkillAuthoring,
          allowConsumerSkillPublishing: d.input.allowConsumerSkillPublishing
        },
        type: 'portal'
      });

      await Fabric.fire('portal.created:before', {
        ...d,
        isDefaultPortal: !!d.isDefaultPortal,
        automatic: !!d.automatic
      });

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
          instanceOid: d.instance.oid,
          isDefaultPortal: !!d.isDefaultPortal
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
    auditScope: AuditScope;
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
      auditScope: d.auditScope,
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
        portal,
        previousPortal: d.portal
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
    auditScope: AuditScope;
  }) {
    if (d.portal.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Portal is already archived or deleted.'
        })
      );
    }

    await consumerSurfaceService.archiveConsumerSurface({
      consumerSurface: d.portal.surface,
      auditScope: d.auditScope
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
        portal,
        auditScope: d.auditScope
      });

      return portal;
    });

    return await this.enrichPortal({
      instance: portal.instance,
      portal
    });
  }

  getPortalHost(d: { portal: Pick<Portal, 'slug'> }) {
    return resolvePortalHost(d);
  }

  getPortalUrls(d: {
    portal: Pick<Portal, 'slug'>;
    namespaces: NamespacePropertyWithNamespace[];
  }) {
    return resolvePortalUrls(d);
  }

  async getPrimaryPortalUrls(d: { portals: Pick<Portal, 'oid' | 'slug'>[] }) {
    return await resolvePrimaryPortalUrls(d);
  }

  async getPrimaryPortalUrl(d: { portal: Pick<Portal, 'oid' | 'slug'> }) {
    return await resolvePrimaryPortalUrl(d);
  }

  async getPrimaryPortalConnectUrl(d: { portal: Pick<Portal, 'oid' | 'slug'> }) {
    return await resolvePrimaryPortalConnectUrl(d);
  }

  async getPortalUrlForOrigin(d: {
    portal: Pick<Portal, 'oid' | 'slug'>;
    origin?: string | null;
  }) {
    return await resolvePortalUrlForOrigin(d);
  }

  parsePortalIdFromHost(d: { url: string }) {
    return resolvePortalIdFromHost(d);
  }
}

export let portalService = Service.create(
  'portalService',
  () => new PortalServiceImpl()
).build();
