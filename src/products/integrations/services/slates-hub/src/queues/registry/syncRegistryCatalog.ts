import type { Registry } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getRegistryQuery } from '../../registry';
import { syncSlateQueue } from './syncSlate';

type RegistryClient = Awaited<
  ReturnType<typeof import('../../registry').getRegistryClient>
>;

type RegistrySlateListItem = {
  id: string;
  fullIdentifier: string;
  currentVersion: {
    id: string;
    version: string;
  } | null;
};

let versionNeedsSync = (status: string) =>
  ['unavailable', 'pending', 'deployment_failed', 'discovery_failed'].includes(status);

export let syncRegistrySlatesFromCatalog = async (d: {
  reg: Registry;
  client: RegistryClient;
}) => {
  let cursor: string | undefined;
  let registryFullIdentifiers = new Set<string>();

  while (true) {
    let res = await d.client.slates.$get({
      query: {
        limit: '100',
        after: cursor,
        order: 'asc',
        ...getRegistryQuery()
      }
    });
    if (res.status !== 200) {
      console.warn(`Failed to list registry slates - status ${res.status} for ${d.reg.id}`);
      return;
    }

    let body = (await res.json()) as {
      items: RegistrySlateListItem[];
      pagination: { has_more_after: boolean };
    };

    let ops = [];

    for (let item of body.items) {
      registryFullIdentifiers.add(item.fullIdentifier);

      if (!item.currentVersion) continue;

      let hubSlate = await db.slate.findFirst({
        where: {
          registryOid: d.reg.oid,
          OR: [
            { slateFullIdentifierOnRegistry: item.fullIdentifier },
            { slateIdOnRegistry: item.id }
          ]
        },
        select: {
          slateVersions: {
            where: { version: item.currentVersion.version },
            select: { id: true, status: true }
          }
        }
      });

      let hubVersion = hubSlate?.slateVersions[0];
      if (hubVersion && !versionNeedsSync(hubVersion.status)) continue;

      ops.push({
        data: {
          id: item.fullIdentifier,
          version: item.currentVersion.id,
          registryId: d.reg.id
        },
        opts: {
          id: `catalog-${d.reg.id}-${item.currentVersion.id}`
        }
      });
    }

    if (ops.length > 0) {
      console.log(`Catalog sync enqueued ${ops.length} slate versions for registry ${d.reg.id}`);
      await syncSlateQueue.addManyWithOps(ops);
    }

    if (!body.pagination.has_more_after || body.items.length === 0) break;
    cursor = body.items[body.items.length - 1]?.id;
  }

  let hubSlates = await db.slate.findMany({
    where: {
      registryOid: d.reg.oid,
      status: 'active'
    },
    select: {
      id: true,
      slateFullIdentifierOnRegistry: true
    }
  });

  let orphanedHubSlates = hubSlates.filter(
    slate => !registryFullIdentifiers.has(slate.slateFullIdentifierOnRegistry)
  );

  if (orphanedHubSlates.length > 0) {
    console.warn(
      `Catalog sync found ${orphanedHubSlates.length} hub slates missing from registry ${d.reg.id}`
    );
  }
};
