import {
  getId,
  type MagicMcpServerProviderStatus,
  withTransaction
} from '@metorial-subspace/db';
import { getMagicMcpOwnerType } from '../../services/magicMcpBacking/shared';

type ProviderRowTarget = {
  status: MagicMcpServerProviderStatus;
  integrationInstanceProviderOid: bigint | null;
  archivedAt?: Date | null;
};

let unique = (values: (bigint | null | undefined)[]) => [
  ...new Set(values.filter((value): value is bigint => value != null))
];

let isClosedStatus = (status: MagicMcpServerProviderStatus) =>
  status === 'archived' || status === 'deleted';

let resolveOwnerIntegrationOid = (backing: {
  ownerType: Parameters<typeof getMagicMcpOwnerType>[0]['ownerType'];
  providerTemplateBackingOid: bigint | null;
  ownerIntegrationOid: bigint | null;
  integrationOid: bigint | null;
  providerTemplateBacking: { integrationOid: bigint } | null;
}) => {
  let ownerType = getMagicMcpOwnerType(backing);
  if (ownerType === 'provider_template') {
    return backing.providerTemplateBacking?.integrationOid ?? null;
  }
  if (ownerType === 'integration') return backing.ownerIntegrationOid;

  return backing.integrationOid;
};

let getClosedBackingStatus = (backing: {
  integrationInstance: { status: string };
  sessionTemplate: { status: string };
}) => {
  if (backing.integrationInstance.status === 'deleted') return 'deleted' as const;
  if (
    backing.integrationInstance.status === 'archived' ||
    backing.sessionTemplate.status === 'archived' ||
    backing.sessionTemplate.status === 'deleted'
  ) {
    return 'archived' as const;
  }

  return null;
};

// MagicMcpServerProvider rows are derived from the owner integration's providers and the
// backing instance's providers. Every writer of those calls this in the same transaction, so
// the rows never need to be reconciled on read.
export let syncMagicMcpServerProviderRows = async (d: {
  magicMcpServerBackingOids?: bigint[];
  integrationOids?: bigint[];
  integrationProviderOids?: bigint[];
  integrationInstanceOids?: bigint[];
}) =>
  await withTransaction(async db => {
    let integrationOids = unique(d.integrationOids ?? []);
    if (d.integrationProviderOids?.length) {
      let integrationProviders = await db.integrationProvider.findMany({
        where: { oid: { in: d.integrationProviderOids } },
        select: { integrationOid: true }
      });
      integrationOids = unique([
        ...integrationOids,
        ...integrationProviders.map(provider => provider.integrationOid)
      ]);
    }

    let or = [
      d.magicMcpServerBackingOids?.length
        ? { oid: { in: d.magicMcpServerBackingOids } }
        : null,
      d.integrationInstanceOids?.length
        ? { integrationInstanceOid: { in: d.integrationInstanceOids } }
        : null,
      integrationOids.length ? { integrationOid: { in: integrationOids } } : null,
      integrationOids.length ? { ownerIntegrationOid: { in: integrationOids } } : null,
      integrationOids.length
        ? { providerTemplateBacking: { integrationOid: { in: integrationOids } } }
        : null
    ].filter(condition => condition !== null);
    if (!or.length) return;

    let backings = await db.magicMcpServerBacking.findMany({
      where: { OR: or },
      select: {
        oid: true,
        ownerType: true,
        providerTemplateBackingOid: true,
        ownerIntegrationOid: true,
        integrationOid: true,
        integrationInstanceOid: true,
        providerTemplateBacking: { select: { integrationOid: true } },
        integrationInstance: { select: { status: true } },
        sessionTemplate: { select: { status: true } }
      }
    });
    if (!backings.length) return;

    let backingOids = backings.map(backing => backing.oid);
    let ownerIntegrationOidByBackingOid = new Map(
      backings.map(backing => [backing.oid, resolveOwnerIntegrationOid(backing)])
    );
    let closedStatusByBackingOid = new Map(
      backings.map(backing => [backing.oid, getClosedBackingStatus(backing)])
    );

    let [activeIntegrationProviders, activeInstanceProviders, existingRows] =
      await Promise.all([
        db.integrationProvider.findMany({
          where: {
            integrationOid: { in: unique([...ownerIntegrationOidByBackingOid.values()]) },
            status: 'active'
          },
          select: { oid: true, integrationOid: true }
        }),
        db.integrationInstanceProvider.findMany({
          where: {
            integrationInstanceOid: {
              in: unique(backings.map(backing => backing.integrationInstanceOid))
            },
            status: 'active',
            isParentDeleted: false
          },
          select: { oid: true, integrationInstanceOid: true, integrationProviderOid: true }
        }),
        db.magicMcpServerProvider.findMany({
          where: { magicMcpServerBackingOid: { in: backingOids } },
          select: {
            oid: true,
            status: true,
            archivedAt: true,
            magicMcpServerBackingOid: true,
            integrationProviderOid: true,
            integrationInstanceProviderOid: true,
            integrationProvider: { select: { status: true } }
          }
        })
      ]);

    let activeIntegrationProviderOidsByIntegrationOid = new Map<bigint, bigint[]>();
    for (let provider of activeIntegrationProviders) {
      let oids =
        activeIntegrationProviderOidsByIntegrationOid.get(provider.integrationOid) ?? [];
      oids.push(provider.oid);
      activeIntegrationProviderOidsByIntegrationOid.set(provider.integrationOid, oids);
    }

    let activeInstanceProviderOidByKey = new Map(
      activeInstanceProviders.map(provider => [
        `${provider.integrationInstanceOid}:${provider.integrationProviderOid}`,
        provider.oid
      ])
    );
    let existingRowByKey = new Map(
      existingRows.map(row => [
        `${row.magicMcpServerBackingOid}:${row.integrationProviderOid}`,
        row
      ])
    );

    let creates: {
      magicMcpServerBackingOid: bigint;
      integrationProviderOid: bigint;
      target: ProviderRowTarget;
    }[] = [];
    let updates = new Map<string, { target: ProviderRowTarget; oids: bigint[] }>();
    let touchedRowOids = new Set<bigint>();
    let now = new Date();

    let queueUpdate = (
      row: (typeof existingRows)[number],
      target: Omit<ProviderRowTarget, 'archivedAt'>
    ) => {
      let archivedAt = isClosedStatus(target.status)
        ? row.archivedAt
          ? undefined
          : now
        : row.archivedAt
          ? null
          : undefined;
      let isUnchanged =
        row.status === target.status &&
        row.integrationInstanceProviderOid === target.integrationInstanceProviderOid &&
        archivedAt === undefined;
      if (isUnchanged) return;

      let fullTarget = { ...target, archivedAt };
      let key = `${fullTarget.status}:${fullTarget.integrationInstanceProviderOid}:${archivedAt === undefined ? 'keep' : archivedAt === null ? 'clear' : 'set'}`;
      let group = updates.get(key) ?? { target: fullTarget, oids: [] };
      group.oids.push(row.oid);
      updates.set(key, group);
    };

    for (let backing of backings) {
      if (closedStatusByBackingOid.get(backing.oid)) continue;

      let ownerIntegrationOid = ownerIntegrationOidByBackingOid.get(backing.oid);
      let ownerIntegrationProviderOids = ownerIntegrationOid
        ? (activeIntegrationProviderOidsByIntegrationOid.get(ownerIntegrationOid) ?? [])
        : [];

      for (let integrationProviderOid of ownerIntegrationProviderOids) {
        let integrationInstanceProviderOid =
          activeInstanceProviderOidByKey.get(
            `${backing.integrationInstanceOid}:${integrationProviderOid}`
          ) ?? null;
        let target = {
          status: integrationInstanceProviderOid ? ('active' as const) : ('pending' as const),
          integrationInstanceProviderOid
        };

        let existingRow = existingRowByKey.get(`${backing.oid}:${integrationProviderOid}`);
        if (!existingRow) {
          creates.push({
            magicMcpServerBackingOid: backing.oid,
            integrationProviderOid,
            target: { ...target, archivedAt: null }
          });
          continue;
        }

        touchedRowOids.add(existingRow.oid);
        queueUpdate(existingRow, target);
      }
    }

    for (let row of existingRows) {
      if (touchedRowOids.has(row.oid)) continue;

      let isDeleted =
        row.integrationProvider.status === 'deleted' ||
        closedStatusByBackingOid.get(row.magicMcpServerBackingOid) === 'deleted';

      queueUpdate(row, {
        status: isDeleted ? 'deleted' : 'archived',
        integrationInstanceProviderOid: row.integrationInstanceProviderOid
      });
    }

    if (creates.length) {
      await db.magicMcpServerProvider.createMany({
        data: creates.map(create => ({
          ...getId('magicMcpServerProvider'),
          magicMcpServerBackingOid: create.magicMcpServerBackingOid,
          integrationProviderOid: create.integrationProviderOid,
          integrationInstanceProviderOid: create.target.integrationInstanceProviderOid,
          status: create.target.status
        })),
        skipDuplicates: true
      });
    }

    for (let { target, oids } of updates.values()) {
      await db.magicMcpServerProvider.updateMany({
        where: { oid: { in: oids } },
        data: target
      });
    }
  });
