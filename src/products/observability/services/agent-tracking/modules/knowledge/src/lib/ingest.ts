import { createHash } from 'node:crypto';
import { badRequestError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import type { Catalog } from '@metorial/model-catalog/src/types';
import type { KnowledgeSnapshot, KnowledgeSource } from '@mtsrc/agent-tracking-db';
import { db, withTransaction } from '@mtsrc/agent-tracking-db';
import { env } from '../env';
import { getId, snowflake } from '@mtsrc/agent-tracking-db';
import { queueKnowledgeImpact } from '../queues/knowledgeImpact';
import { expireKnowledgeCheck } from './cache';
import {
  collectAnomalies,
  evaluateGuardrails,
  findDanglingReferences,
  type GuardrailVerdict
} from './guardrails';
import { parseArchive } from './parse';
import { planPriceChanges, type OpenPricePeriod, type PricePlan } from './prices';
import { buildEntityRows, type EntityDiff } from './rows';
import { fetchArchive, fetchFingerprint, readFingerprint } from './source';
import { loadStoredData, loadStoredState, markRemoved, upsertRows } from './store';
import type { KnowledgeSnapshotCounts } from '@mtsrc/agent-tracking-db';
import { currentSnapshot, publishKnowledgeVersion } from './version';

let ingestTimeoutMs = 5 * 60 * 1000;
export let ingestLockKey = 730_122_501;
let changeChunkSize = 1000;
let periodChunkSize = 1000;
let archivesKept = 20;
let importSourceUrl = 'import://snapshots';

// Bun collects lazily; without explicit collections between ingest stages the parsed catalog's
// garbage piles up and a first ingest peaks near 700 MB instead of under 400 MB.
let collectGarbage = () => globalThis.Bun?.gc(true);

export class KnowledgeFingerprintMovedError extends Error {
  constructor() {
    super('The model knowledge fingerprint changed while the archive was downloading.');
  }
}

export type IngestResult =
  | { status: 'unchanged'; snapshotId?: string }
  | { status: 'rejected'; snapshotId: string; reason: string }
  | { status: 'applied'; snapshotId: string; counts: KnowledgeSnapshotCounts };

export let ensureKnowledgeSource = async (url: string) =>
  await db.knowledgeSource.upsert({
    where: { url },
    create: { ...getId('knowledgeSource'), url },
    update: {}
  });

export let pollKnowledge = async (d: { url?: string } = {}) => {
  let url = d.url ?? env.knowledge.url;
  let source = await ensureKnowledgeSource(url);

  let result = await fetchFingerprint({ baseUrl: url, etag: source.etag });
  if (result.status == 'unchanged') return { changed: false as const };

  if (result.fingerprint == source.lastFingerprint) {
    if (result.etag != source.etag) {
      await db.knowledgeSource.update({
        where: { oid: source.oid },
        data: { etag: result.etag, lastCheckedAt: new Date() }
      });
    }

    return { changed: false as const };
  }

  return { changed: true as const, fingerprint: result.fingerprint };
};

let countsOf = (diffs: EntityDiff[]): KnowledgeSnapshotCounts =>
  Object.fromEntries(
    diffs.map(diff => [
      diff.spec.entity,
      {
        total: diff.rows.size,
        added: diff.added.length,
        changed: diff.changed.length,
        removed: diff.removed.length
      }
    ])
  );

type PendingChange = {
  entity: EntityDiff['spec']['entity'];
  entityId: string;
  change: 'added' | 'changed' | 'removed';
  before?: unknown;
  after?: unknown;
};

// Must run before the rows are written: `before` is read from the stored data.
let collectChanges = async (diffs: EntityDiff[]) => {
  let changes: PendingChange[] = [];

  for (let diff of diffs) {
    let entity = diff.spec.entity;
    let before = await loadStoredData({
      spec: diff.spec,
      ids: [...diff.changed.map(row => row.id), ...diff.removed]
    });

    for (let row of diff.added) {
      changes.push({ entity, entityId: row.id, change: 'added', after: row.data });
    }

    for (let row of diff.changed) {
      changes.push({
        entity,
        entityId: row.id,
        change: 'changed',
        before: before.get(row.id),
        after: row.data
      });
    }

    for (let id of diff.removed) {
      changes.push({ entity, entityId: id, change: 'removed', before: before.get(id) });
    }
  }

  return changes;
};

let writeChanges = async (d: { changes: PendingChange[]; snapshotOid: bigint }) =>
  withTransaction(async tdb => {
    for (let start = 0; start < d.changes.length; start += changeChunkSize) {
      await tdb.knowledgeChange.createMany({
        data: d.changes.slice(start, start + changeChunkSize).map(change => ({
          ...getId('knowledgeChange'),
          entity: change.entity,
          entityId: change.entityId,
          change: change.change,
          before: change.before as never,
          after: change.after as never,
          snapshotOid: d.snapshotOid
        }))
      });
    }
  });

let loadOpenPeriods = async () =>
  withTransaction(async tdb => {
    let periods = await tdb.knowledgePricePeriod.findMany({
      where: { openOfferingOid: { not: null } },
      select: {
        oid: true,
        offeringOid: true,
        pricingHash: true,
        validFrom: true,
        confirmedAt: true
      }
    });

    return new Map<bigint, OpenPricePeriod>(
      periods.map(period => [period.offeringOid, period])
    );
  });

let writePricePlan = async (d: { plan: PricePlan; snapshotOid: bigint; generatedAt: Date }) =>
  withTransaction(async tdb => {
    let closedAt = new Map<number, bigint[]>();

    for (let period of d.plan.close) {
      let time = period.validTo.getTime();
      closedAt.set(time, [...(closedAt.get(time) ?? []), period.oid]);
    }

    for (let [time, oids] of closedAt) {
      await tdb.knowledgePricePeriod.updateMany({
        where: { oid: { in: oids } },
        data: { validTo: new Date(time), closeReason: 'changed', openOfferingOid: null }
      });
    }

    for (let start = 0; start < d.plan.open.length; start += periodChunkSize) {
      await tdb.knowledgePricePeriod.createMany({
        data: d.plan.open.slice(start, start + periodChunkSize).map(period => ({
          ...getId('knowledgePricePeriod'),
          vendorId: period.vendorId,
          modelId: period.modelId,
          pricing: period.pricing,
          pricingHash: period.pricingHash,
          origin: period.origin,
          validFrom: period.validFrom,
          confirmedAt: d.generatedAt,
          offeringOid: period.offeringOid,
          openOfferingOid: period.offeringOid,
          openedBySnapshotOid: d.snapshotOid
        }))
      });
    }

    if (d.plan.confirm.length) {
      await tdb.knowledgePricePeriod.updateMany({
        where: { oid: { in: d.plan.confirm } },
        data: { confirmedAt: d.generatedAt }
      });
    }
  });

let reportRejection = (d: { fingerprint: string; reason: string; url: string }) => {
  console.warn('[agent-tracking] model knowledge snapshot rejected', d);
  getSentry().captureMessage('Model knowledge snapshot rejected', {
    level: 'warning',
    extra: d
  });
};

let pruneArchives = async () => {
  await db.$executeRawUnsafe(
    `UPDATE "KnowledgeSnapshot" SET archive = NULL
     WHERE archive IS NOT NULL AND oid NOT IN (
       SELECT oid FROM "KnowledgeSnapshot" WHERE archive IS NOT NULL ORDER BY "createdAt" DESC LIMIT ${archivesKept}
     )`
  );
};

type ApplyOutcome =
  | { status: 'unchanged'; snapshot: KnowledgeSnapshot }
  | { status: 'rejected'; snapshot: KnowledgeSnapshot; reason: string }
  | { status: 'applied'; snapshot: KnowledgeSnapshot; counts: KnowledgeSnapshotCounts };

let applyCatalog = async (d: {
  source: KnowledgeSource;
  fingerprint: string;
  etag?: string | null;
  archive: Buffer;
  catalog: Catalog;
  guardrails: boolean;
}): Promise<ApplyOutcome> =>
  withTransaction(
    async tdb => {
      await tdb.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${ingestLockKey})`);

      let now = new Date();
      let generatedAt = new Date(d.catalog.generatedAt);
      let existing = await tdb.knowledgeSnapshot.findUnique({
        where: {
          sourceOid_fingerprint: { sourceOid: d.source.oid, fingerprint: d.fingerprint }
        }
      });

      let markSource = () =>
        tdb.knowledgeSource.update({
          where: { oid: d.source.oid },
          data: {
            lastFingerprint: d.fingerprint,
            lastCheckedAt: now,
            lastError: null,
            ...(d.etag !== undefined ? { etag: d.etag } : {})
          }
        });

      if (existing && existing.status != 'rejected') {
        await markSource();
        return { status: 'unchanged', snapshot: existing };
      }

      collectGarbage();
      let stored = await loadStoredState();
      let { diffs, regressions } = buildEntityRows({ catalog: d.catalog, stored });
      let dangling = findDanglingReferences(d.catalog);
      let anomalies = collectAnomalies({ stored, diffs, regressions, dangling });
      let counts = countsOf(diffs);
      collectGarbage();

      let verdict: GuardrailVerdict = d.guardrails
        ? evaluateGuardrails({ catalog: d.catalog, stored, diffs, regressions, dangling })
        : { accepted: true };

      let snapshotFields = {
        schemaVersion: d.catalog.schemaVersion,
        counts,
        anomalies,
        generatedAt
      };

      if (!verdict.accepted) {
        let snapshot = existing
          ? await tdb.knowledgeSnapshot.update({
              where: { oid: existing.oid },
              data: { ...snapshotFields, rejectedReason: verdict.reason }
            })
          : await tdb.knowledgeSnapshot.create({
              data: {
                ...getId('knowledgeSnapshot'),
                ...snapshotFields,
                fingerprint: d.fingerprint,
                status: 'rejected',
                rejectedReason: verdict.reason,
                archive: new Uint8Array(d.archive),
                sourceOid: d.source.oid
              }
            });

        await markSource();
        return { status: 'rejected', snapshot, reason: verdict.reason };
      }

      let previous = await tdb.knowledgeSnapshot.findFirst({ where: { status: 'current' } });
      let bootstrap = !previous;
      let changes = bootstrap ? [] : await collectChanges(diffs);

      await tdb.knowledgeSnapshot.updateMany({
        where: { status: 'current' },
        data: { status: 'superseded' }
      });

      let snapshot = existing
        ? await tdb.knowledgeSnapshot.update({
            where: { oid: existing.oid },
            data: {
              ...snapshotFields,
              status: 'current',
              rejectedReason: null,
              acceptedAt: now
            }
          })
        : await tdb.knowledgeSnapshot.create({
            data: {
              ...getId('knowledgeSnapshot'),
              ...snapshotFields,
              fingerprint: d.fingerprint,
              status: 'current',
              archive: new Uint8Array(d.archive),
              acceptedAt: now,
              sourceOid: d.source.oid
            }
          });

      let offeringOids = new Map<string, bigint>();

      for (let diff of diffs) {
        let oids = new Map<string, bigint>();

        for (let row of diff.rows.values()) {
          oids.set(row.id, stored[diff.spec.entity].get(row.id)?.oid ?? snowflake.nextId());
        }

        await upsertRows({ spec: diff.spec, rows: [...diff.added, ...diff.changed], oids });
        await markRemoved({ spec: diff.spec, ids: diff.removed, at: now });

        if (diff.spec.entity == 'offering') offeringOids = oids;
      }

      collectGarbage();
      await writeChanges({ changes, snapshotOid: snapshot.oid });

      let offerings = diffs.find(diff => diff.spec.entity == 'offering')!;
      let plan = planPriceChanges({
        offerings: offerings.rows.values(),
        offeringOids,
        addedIds: new Set(offerings.added.map(row => row.id)),
        storedOfferings: stored.offering,
        openPeriods: await loadOpenPeriods(),
        generatedAt,
        bootstrap
      });

      await writePricePlan({ plan, snapshotOid: snapshot.oid, generatedAt });
      await tdb.knowledgeSource.update({
        where: { oid: d.source.oid },
        data: { lastChangedAt: now }
      });
      await markSource();

      return { status: 'applied', snapshot, counts };
    },
    { timeoutMs: ingestTimeoutMs }
  );

let finish = async (d: { outcome: ApplyOutcome; fingerprint: string; url: string }) => {
  let { outcome } = d;

  if (outcome.status == 'rejected') {
    reportRejection({ fingerprint: d.fingerprint, reason: outcome.reason, url: d.url });
    return {
      status: 'rejected',
      snapshotId: outcome.snapshot.id,
      reason: outcome.reason
    } as const;
  }

  if (outcome.status == 'unchanged') {
    return { status: 'unchanged', snapshotId: outcome.snapshot.id } as const;
  }

  await publishKnowledgeVersion(outcome.snapshot);
  expireKnowledgeCheck();
  await pruneArchives();
  await queueKnowledgeImpact({ type: 'snapshot', snapshotId: outcome.snapshot.id });

  return {
    status: 'applied',
    snapshotId: outcome.snapshot.id,
    counts: outcome.counts
  } as const;
};

export let syncKnowledge = async (
  d: { url?: string; guardrails?: boolean } = {}
): Promise<IngestResult> => {
  let url = d.url ?? env.knowledge.url;
  let guardrails = d.guardrails ?? env.knowledge.guardrails == 'strict';
  let source = await ensureKnowledgeSource(url);

  try {
    let fingerprint = await fetchFingerprint({ baseUrl: url });
    if (fingerprint.status != 'changed') {
      throw new Error('Unconditional fingerprint read returned 304.');
    }

    let existing = await db.knowledgeSnapshot.findUnique({
      where: {
        sourceOid_fingerprint: { sourceOid: source.oid, fingerprint: fingerprint.fingerprint }
      }
    });
    if (existing?.status == 'current' || existing?.status == 'superseded') {
      return { status: 'unchanged', snapshotId: existing.id };
    }
    if (existing?.status == 'rejected' && guardrails) {
      return {
        status: 'rejected',
        snapshotId: existing.id,
        reason: existing.rejectedReason ?? 'rejected'
      };
    }

    let archive = await fetchArchive(url);
    if ((await readFingerprint(url)) != fingerprint.fingerprint) {
      throw new KnowledgeFingerprintMovedError();
    }

    let outcome = await applyCatalog({
      source,
      fingerprint: fingerprint.fingerprint,
      etag: fingerprint.etag,
      archive,
      catalog: await parseArchive(archive),
      guardrails
    });

    return await finish({ outcome, fingerprint: fingerprint.fingerprint, url });
  } catch (error) {
    await db.knowledgeSource.update({
      where: { oid: source.oid },
      data: {
        lastError: error instanceof Error ? error.message : String(error),
        lastCheckedAt: new Date()
      }
    });

    throw error;
  }
};

let ensureNotOlderThanCurrent = async (generatedAt: Date) => {
  let current = await currentSnapshot();
  if (current && current.generatedAt > generatedAt) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'A newer model knowledge snapshot is already current.'
      })
    );
  }
};

export let acceptKnowledgeSnapshot = async (d: {
  snapshotId: string;
}): Promise<IngestResult> => {
  let snapshot = await db.knowledgeSnapshot.findUniqueOrThrow({
    where: { id: d.snapshotId },
    include: { source: true }
  });
  if (snapshot.status != 'rejected') {
    return { status: 'unchanged', snapshotId: snapshot.id };
  }
  if (!snapshot.archive) throw new Error('The rejected snapshot no longer has its archive.');

  await ensureNotOlderThanCurrent(snapshot.generatedAt);

  let archive = Buffer.from(snapshot.archive);
  let outcome = await applyCatalog({
    source: snapshot.source,
    fingerprint: snapshot.fingerprint,
    archive,
    catalog: await parseArchive(archive),
    guardrails: false
  });

  return await finish({
    outcome,
    fingerprint: snapshot.fingerprint,
    url: snapshot.source.url
  });
};

export let importKnowledgeSnapshot = async (d: {
  archive: Buffer;
  guardrails?: boolean;
}): Promise<IngestResult> => {
  let catalog = await parseArchive(d.archive).catch(() => {
    throw new ServiceError(
      badRequestError({ message: 'The archive is not a gzipped model knowledge catalog.' })
    );
  });

  await ensureNotOlderThanCurrent(new Date(catalog.generatedAt));

  let source = await ensureKnowledgeSource(importSourceUrl);
  let fingerprint = `import-${createHash('sha256').update(d.archive).digest('base64url')}`;

  let outcome = await applyCatalog({
    source,
    fingerprint,
    archive: d.archive,
    catalog,
    guardrails: d.guardrails ?? env.knowledge.guardrails == 'strict'
  });

  return await finish({ outcome, fingerprint, url: importSourceUrl });
};
