import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma, SlateActivationMode } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { getEffectiveCurrentSlateVersion } from '../lib/slateVersion/current';
import { isMirrorMode } from '../mode';

let catalogInclude = {
  scope: true,
  tenant: true,
  unbuiltCurrentVersion: true,
  builtOrUnbuiltCurrentVersion: true,
  activation: { include: { pinnedVersion: true } },
  _count: { select: { slateVersions: true } }
} satisfies Prisma.SlateInclude;

let versionInclude = {
  _count: { select: { signatures: true } },
  originUpstream: true,
  originPackImport: true
} satisfies Prisma.SlateVersionInclude;

let buildSlateLookup = (id: string): Prisma.SlateWhereInput => {
  let normalized = id.replace(/^@/, '');
  return { status: 'active', OR: [{ id: normalized }, { fullIdentifier: normalized }] };
};

class activationServiceImpl {
  async listCatalog(d: { search?: string; activation?: 'activated' | 'available' }) {
    let search = d.search?.trim();

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slate.findMany({
            ...opts,
            where: {
              status: 'active',
              ...(d.activation === 'activated' ? { activation: { isNot: null } } : {}),
              ...(d.activation === 'available' ? { activation: { is: null } } : {}),
              ...(search
                ? {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { fullIdentifier: { contains: search, mode: 'insensitive' } }
                    ]
                  }
                : {})
            },
            include: catalogInclude
          })
      )
    );
  }

  async getCatalogSlate(d: { slateId: string }) {
    let slate = await db.slate.findFirst({
      where: buildSlateLookup(d.slateId),
      include: catalogInclude
    });
    if (!slate) throw new ServiceError(notFoundError('slate'));

    return slate;
  }

  async listCatalogVersions(d: { slateId: string }) {
    let slate = await this.getCatalogSlate(d);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateVersion.findMany({
            ...opts,
            where: { slateOid: slate.oid },
            include: versionInclude
          })
      )
    );
  }

  async setActivation(d: {
    slateId: string;
    mode: SlateActivationMode;
    pinnedVersionId?: string | null;
  }) {
    if (!isMirrorMode()) {
      throw new ServiceError(
        badRequestError({
          message: 'Integrations can only be activated on a mirror registry.'
        })
      );
    }

    let slate = await this.getCatalogSlate({ slateId: d.slateId });

    let pinnedVersion = null;
    if (d.mode === 'pinned') {
      if (!d.pinnedVersionId) {
        throw new ServiceError(
          badRequestError({ message: 'Pinning requires a version to pin.' })
        );
      }

      pinnedVersion = await db.slateVersion.findFirst({
        where: {
          slateOid: slate.oid,
          OR: [{ id: d.pinnedVersionId }, { version: d.pinnedVersionId }]
        }
      });
      if (!pinnedVersion) throw new ServiceError(notFoundError('slate.version'));
    }

    let activation = await db.slateActivation.upsert({
      where: { slateOid: slate.oid },
      create: {
        ...getId('slateActivation'),
        slateOid: slate.oid,
        mode: d.mode,
        pinnedVersionOid: pinnedVersion?.oid ?? null
      },
      update: { mode: d.mode, pinnedVersionOid: pinnedVersion?.oid ?? null },
      include: { pinnedVersion: true }
    });

    await this.notifyActivation({ slate: { ...slate, activation } });

    return this.getCatalogSlate({ slateId: slate.id });
  }

  // The hub resolves the current version per its own prebuilt support, so announce the
  // candidate for both views; it deploys whichever one its view reports as current.
  private async notifyActivation(d: {
    slate: Awaited<ReturnType<activationServiceImpl['getCatalogSlate']>>;
  }) {
    let candidates = [true, false].map(supportsBuilt =>
      getEffectiveCurrentSlateVersion({
        supportsBuilt,
        unbuiltCurrentVersion: d.slate.unbuiltCurrentVersion,
        builtOrUnbuiltCurrentVersion: d.slate.builtOrUnbuiltCurrentVersion,
        activation: d.slate.activation
      })
    );

    let versions = [
      ...new Map(
        candidates.flatMap(version => (version ? [[version.oid, version] as const] : []))
      ).values()
    ];
    if (!versions.length) return;

    await db.changeNotification.createMany({
      data: versions.map(version => ({
        ...getId('changeNotification'),
        type: 'slate_activated' as const,
        slateOid: d.slate.oid,
        slateId: d.slate.id,
        slateIdentifier: d.slate.identifier,
        slateFullIdentifier: d.slate.fullIdentifier,
        slateVersionOid: version.oid,
        slateVersionId: version.id,
        slateVersionIdentifier: version.version,
        tenantOid: d.slate.tenantOid
      }))
    });
  }
}

export let activationService = Service.create(
  'activationService',
  () => new activationServiceImpl()
).build();
