import { eventually, useOrganization } from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import type { Session } from '@metorial-subspace/db';
import { describe, expect, it } from 'vitest';
import { tenantLogRetentionCleanupQueue } from '../src/queues/retention/cleanup';
import {
  countSessionRecords,
  daysAgo,
  loadScope,
  seedSession,
  seedSessionError,
  seedSessionRecords,
  updateTenant
} from './_fixtures';

let loadSession = (session: Session) =>
  subspaceDb.session.findUniqueOrThrow({ where: { oid: session.oid } });

describe('module-tenant retention queues', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it("deletes session records older than each tenant's retention period", async () => {
    let mine = await loadScope(org.ids.instanceId);
    let theirs = await loadScope(otherOrg.ids.instanceId);

    await updateTenant(mine.tenant, { logRetentionInDays: 7 });
    expect(theirs.tenant.logRetentionInDays).toBe(30);

    let mySession = await seedSession(mine);
    let theirSession = await seedSession(theirs);

    let expired = await seedSessionRecords(mine, mySession, daysAgo(10));
    let fresh = await seedSessionRecords(mine, mySession, daysAgo(3));
    let stillProcessing = await seedSessionError(mine, mySession, {
      createdAt: daysAgo(10),
      isProcessing: true
    });

    let theirsWithinRetention = await seedSessionRecords(theirs, theirSession, daysAgo(10));
    let theirsExpired = await seedSessionRecords(theirs, theirSession, daysAgo(40));

    await tenantLogRetentionCleanupQueue.add({ tenantId: mine.tenant.id });
    await tenantLogRetentionCleanupQueue.add({ tenantId: theirs.tenant.id });

    let deleted = { events: 0, warnings: 0, errors: 0 };
    let kept = { events: 1, warnings: 1, errors: 1 };

    await eventually(
      async () => {
        expect(await countSessionRecords(expired)).toEqual(deleted);
        expect(await countSessionRecords(theirsExpired)).toEqual(deleted);
      },
      { timeoutMs: 60_000, intervalMs: 500 }
    );

    expect(await countSessionRecords(fresh)).toEqual(kept);
    expect(await countSessionRecords(theirsWithinRetention)).toEqual(kept);
    expect(await subspaceDb.sessionError.count({ where: { oid: stillProcessing.oid } })).toBe(
      1
    );
    expect(
      await subspaceDb.session.count({
        where: { oid: { in: [mySession.oid, theirSession.oid] } }
      })
    ).toBe(2);
  });

  it('ratchets only the active sessions of the tenant to a stricter retention setting', async () => {
    let mine = await loadScope(org.ids.instanceId);
    let theirs = await loadScope(otherOrg.ids.instanceId);
    expect(mine.tenant).toMatchObject({ dataRetentionLevel: 'full', collectErrors: true });

    let active = await seedSession(mine, {
      dataRetentionLevel: 'full',
      collectErrors: true,
      storeToolCallAttachments: true
    });
    let alreadyStricter = await seedSession(mine, {
      dataRetentionLevel: 'none',
      collectErrors: true
    });
    let archived = await seedSession(mine, {
      status: 'archived',
      dataRetentionLevel: 'full',
      collectErrors: true
    });
    let foreign = await seedSession(theirs, {
      dataRetentionLevel: 'full',
      collectErrors: true
    });

    let updated = await updateTenant(mine.tenant, {
      dataRetentionLevel: 'intent_only',
      collectErrors: false
    });
    expect(updated).toMatchObject({ dataRetentionLevel: 'intent_only', collectErrors: false });

    await eventually(
      async () => {
        expect(await loadSession(active)).toMatchObject({
          dataRetentionLevel: 'intent_only',
          collectErrors: false,
          storeToolCallAttachments: true
        });
      },
      { timeoutMs: 30_000, intervalMs: 500 }
    );

    expect(await loadSession(alreadyStricter)).toMatchObject({
      dataRetentionLevel: 'none',
      collectErrors: false
    });
    expect(await loadSession(archived)).toMatchObject({
      dataRetentionLevel: 'full',
      collectErrors: true
    });
    expect(await loadSession(foreign)).toMatchObject({
      dataRetentionLevel: 'full',
      collectErrors: true
    });
  });
});
