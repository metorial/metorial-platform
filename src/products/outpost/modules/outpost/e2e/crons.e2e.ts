import { eventually, uniqueId, useOrganization } from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { describe, expect, it } from 'vitest';
import { registerOutpostCacheInvalidation } from '../src/listeners/cacheInvalidation';
import { outpostCredentialService, outpostInstanceService } from '../src/services';
import {
  afterInvalidation,
  createConnectionVerifier,
  createOutpostWithCredential,
  createTestOutpostServer,
  importCredential,
  MCP_CONNECTION_PROXY_SERVICE,
  registerInstance,
  requestChallenge,
  sendSigned,
  signedRequest,
  type RegisteredInstance
} from './_fixtures';

let CRON_TIMEOUT_MS = 150_000;
let TEST_TIMEOUT_MS = 240_000;
let DAY_MS = 24 * 60 * 60 * 1000;

// The module's queues aren't exported, so this file must not load ../src (whose index defines
// them) to be able to enqueue the stack's cleanup fan-outs by name.
registerOutpostCacheInvalidation();

let cleanupInstancesQueue = createQueue<{ cursor?: string }>({
  name: 'outp/instance/cleanupMany'
});
let cleanupInstanceLogsQueue = createQueue<{ cursor?: string }>({
  name: 'outp/instance/cleanupLogsMany'
});

describe('module-outpost crons', () => {
  let org = useOrganization();
  let server = createTestOutpostServer();
  let verifier = createConnectionVerifier();

  let callVerifier = async (instance: RegisteredInstance) =>
    sendSigned(
      verifier,
      await signedRequest(instance, {
        url: 'https://connect.test/mcp',
        service: MCP_CONNECTION_PROXY_SERVICE
      })
    );

  let instanceRow = (outpostOid: bigint, identifier: string) =>
    db.outpostInstance.findUnique({
      where: { outpostOid_identifier: { outpostOid, identifier } }
    });

  it(
    'expires credentials once their expiry passes and stops their instances',
    async () => {
      let { fixture, outpost, credential, key } = await createOutpostWithCredential(org.ids, {
        expiresAt: new Date(Date.now() + DAY_MS)
      });
      let instance = await registerInstance(server, { credential: key });

      let { credential: lasting, envelope } = await outpostCredentialService.createCredential({
        outpost,
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: { name: uniqueId('lasting'), expiresAt: new Date(Date.now() + DAY_MS) }
      });
      let lastingInstance = await registerInstance(server, {
        credential: await importCredential(envelope)
      });

      await db.outpostCredential.update({
        where: { oid: credential.oid },
        data: { expiresAt: new Date(Date.now() - 1_000) }
      });

      let expired = await eventually(
        async () => {
          let row = await db.outpostCredential.findUniqueOrThrow({
            where: { oid: credential.oid }
          });
          expect(row.status).toBe('expired');
          return row;
        },
        { timeoutMs: CRON_TIMEOUT_MS, intervalMs: 1_000 }
      );

      await eventually(async () => {
        expect(await callVerifier(instance)).toMatchObject({
          status: 403,
          body: { error: 'instance_disabled' }
        });
        expect((await requestChallenge(server, { credential: key })).response).toMatchObject({
          status: 403,
          body: { error: 'revoked_outpost_credential' }
        });
      });

      expect(
        await db.outpostCredential.findUniqueOrThrow({ where: { oid: lasting.oid } })
      ).toMatchObject({ status: 'active' });
      expect((await callVerifier(lastingInstance)).status).toBe(200);

      let deleted = await outpostCredentialService.deleteCredential({
        outpost,
        credential: expired,
        organization: fixture.organization,
        auditScope: fixture.auditScope
      });
      expect(deleted.status).toBe('deleted');
    },
    TEST_TIMEOUT_MS
  );

  it(
    'deactivates instances whose token lifetime passed and refreshes the outpost connection',
    async () => {
      let { outpost, key } = await createOutpostWithCredential(org.ids);
      let stale = await registerInstance(server, { credential: key });
      let live = await registerInstance(server, { credential: key });

      expect(
        await db.outpost.findUniqueOrThrow({ where: { oid: outpost.oid } })
      ).toMatchObject({ instanceCount: 2, connectionStatus: 'active' });

      await db.outpostInstance.update({
        where: {
          outpostOid_identifier: { outpostOid: outpost.oid, identifier: stale.instanceId }
        },
        data: { expiresAt: new Date(Date.now() - 1_000) }
      });

      await eventually(
        async () => {
          expect(await instanceRow(outpost.oid, stale.instanceId)).toMatchObject({
            status: 'inactive'
          });
        },
        { timeoutMs: CRON_TIMEOUT_MS, intervalMs: 1_000 }
      );

      expect(await instanceRow(outpost.oid, live.instanceId)).toMatchObject({
        status: 'active'
      });
      expect(
        await db.outpost.findUniqueOrThrow({ where: { oid: outpost.oid } })
      ).toMatchObject({ instanceCount: 1, connectionStatus: 'active' });

      await eventually(async () => {
        expect(await callVerifier(stale)).toMatchObject({
          status: 403,
          body: { error: 'instance_disabled' }
        });
      });
      expect((await callVerifier(live)).status).toBe(200);

      let liveRow = await db.outpostInstance.findFirstOrThrow({
        where: { outpostOid: outpost.oid, identifier: live.instanceId },
        include: { outpost: { include: { organization: true } } }
      });
      await outpostInstanceService.deleteInstance({
        instance: liveRow,
        outpost: liveRow.outpost,
        organization: liveRow.outpost.organization
      });

      expect(
        await db.outpost.findUniqueOrThrow({ where: { oid: outpost.oid } })
      ).toMatchObject({ instanceCount: 0, connectionStatus: 'inactive' });
      await afterInvalidation(async () => {
        expect(await callVerifier(live)).toMatchObject({
          status: 401,
          body: { error: 'invalid_instance_token' }
        });
      });
    },
    TEST_TIMEOUT_MS
  );

  it(
    'deletes instances that stayed inactive past the retention window',
    async () => {
      let { outpost, key } = await createOutpostWithCredential(org.ids);
      let [expiredLongAgo, neverIssued, recentlyInactive, active] = await Promise.all(
        [0, 1, 2, 3].map(() => registerInstance(server, { credential: key }))
      );
      let longAgo = new Date(Date.now() - 15 * DAY_MS);

      let age = (instance: RegisteredInstance, data: Record<string, unknown>) =>
        db.outpostInstance.update({
          where: {
            outpostOid_identifier: { outpostOid: outpost.oid, identifier: instance.instanceId }
          },
          data
        });

      await age(expiredLongAgo!, { status: 'inactive', expiresAt: longAgo });
      await age(neverIssued!, { status: 'inactive', expiresAt: null, updatedAt: longAgo });
      await age(recentlyInactive!, {
        status: 'inactive',
        expiresAt: new Date(Date.now() - DAY_MS)
      });

      await cleanupInstancesQueue.add({});

      await eventually(
        async () => {
          expect(await instanceRow(outpost.oid, expiredLongAgo!.instanceId)).toBeNull();
          expect(await instanceRow(outpost.oid, neverIssued!.instanceId)).toBeNull();
        },
        { timeoutMs: CRON_TIMEOUT_MS, intervalMs: 1_000 }
      );

      expect(await instanceRow(outpost.oid, recentlyInactive!.instanceId)).toMatchObject({
        status: 'inactive'
      });
      expect(await instanceRow(outpost.oid, active!.instanceId)).toMatchObject({
        status: 'active'
      });
    },
    TEST_TIMEOUT_MS
  );

  it(
    'prunes instance events and key rotations past the retention window',
    async () => {
      let { outpost, key } = await createOutpostWithCredential(org.ids);
      let instance = await registerInstance(server, { credential: key });
      await registerInstance(server, { credential: key, instanceId: instance.instanceId });

      let row = await instanceRow(outpost.oid, instance.instanceId);
      let longAgo = new Date(Date.now() - 15 * DAY_MS);

      let oldEvent = await db.outpostInstanceEvent.create({
        data: {
          id: await ID.generateId('outpostInstanceEvent'),
          instanceOid: row!.oid,
          logType: 'e2e',
          content: { message: 'old' },
          createdAt: longAgo
        }
      });
      let recentEvent = await db.outpostInstanceEvent.create({
        data: {
          id: await ID.generateId('outpostInstanceEvent'),
          instanceOid: row!.oid,
          logType: 'e2e',
          content: { message: 'recent' }
        }
      });

      let [recentRotation] = await db.outpostInstanceKeyRotation.findMany({
        where: { instanceOid: row!.oid }
      });
      let oldRotation = await db.outpostInstanceKeyRotation.create({
        data: {
          id: await ID.generateId('outpostInstanceKeyRotation'),
          instanceOid: row!.oid,
          publicKey: Buffer.from(new Uint8Array(32)),
          createdAt: longAgo
        }
      });

      await cleanupInstanceLogsQueue.add({});

      await eventually(
        async () => {
          expect(
            await db.outpostInstanceEvent.findUnique({ where: { oid: oldEvent.oid } })
          ).toBeNull();
          expect(
            await db.outpostInstanceKeyRotation.findUnique({ where: { oid: oldRotation.oid } })
          ).toBeNull();
        },
        { timeoutMs: CRON_TIMEOUT_MS, intervalMs: 1_000 }
      );

      expect(
        await db.outpostInstanceEvent.findUnique({ where: { oid: recentEvent.oid } })
      ).not.toBeNull();
      expect(recentRotation).toBeDefined();
      expect(
        await db.outpostInstanceKeyRotation.findUnique({ where: { oid: recentRotation!.oid } })
      ).not.toBeNull();
      expect(await instanceRow(outpost.oid, instance.instanceId)).not.toBeNull();
    },
    TEST_TIMEOUT_MS
  );
});
