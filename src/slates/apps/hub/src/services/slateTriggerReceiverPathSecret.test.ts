import { beforeEach, describe, expect, it } from 'vitest';
import { fixtures } from '../test/fixtures';
import { cleanDatabase, testDb } from '../test/setup';
import { slateTriggerReceiverPathSecretMethods } from './slateTriggerReceiverPathSecret';

describe('callback receiver path secret lifecycle', () => {
  let f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('issues plaintext once, rotates immediately, and revokes the opaque binding', async () => {
    let { receiver, tenant } = await f.slateTriggerReceiver.complete({
      receiverOverrides: {
        callbackId: 'callback-1',
        callbackInstanceId: 'callback-instance-1',
        callbackOwnerVersion: 1
      }
    });
    let owner = {
      callbackId: 'callback-1',
      callbackInstanceId: 'callback-instance-1',
      expectedOwnerVersion: 1,
      mutationId: 'create-path-1'
    };

    let created = await slateTriggerReceiverPathSecretMethods.createInitialPathSecret({
      tenant,
      receiverId: receiver.id,
      owner
    });
    expect(created.plaintext).toMatch(/^metorial_whpath_/);
    expect(created.pathSecret).toMatchObject({ generation: 1 });
    await expect(
      slateTriggerReceiverPathSecretMethods.createInitialPathSecret({
        tenant,
        receiverId: receiver.id,
        owner
      })
    ).rejects.toThrow();

    let previous = await testDb.slateTriggerReceiverPathSecret.findUniqueOrThrow({
      where: { id: created.pathSecret.id },
      include: { secret: true }
    });
    let rotated = await slateTriggerReceiverPathSecretMethods.rotatePathSecret({
      tenant,
      receiverId: receiver.id,
      owner: { ...owner, mutationId: 'rotate-path-1' }
    });
    expect(rotated.pathSecret).toMatchObject({ id: created.pathSecret.id, generation: 2 });
    expect(rotated.plaintext).not.toBe(created.plaintext);
    expect(
      await testDb.secret.findUniqueOrThrow({ where: { oid: previous.secretOid } })
    ).toMatchObject({ status: 'deleted', encryptedSecret: '' });
    expect(
      await slateTriggerReceiverPathSecretMethods.resolvePathSecret({
        tenant,
        receiverId: receiver.id
      })
    ).toMatchObject({ plaintext: rotated.plaintext, binding: { generation: 2 } });

    expect(
      await slateTriggerReceiverPathSecretMethods.revokeAllPathSecrets({
        tenant,
        receiverId: receiver.id,
        owner: { ...owner, mutationId: 'revoke-path-1' }
      })
    ).toEqual({ revoked: true });
    expect(
      await slateTriggerReceiverPathSecretMethods.resolvePathSecret({
        tenant,
        receiverId: receiver.id
      })
    ).toBeNull();
  });

  it('fails closed when callback ownership is stale', async () => {
    let { receiver, tenant } = await f.slateTriggerReceiver.complete({
      receiverOverrides: {
        callbackId: 'callback-1',
        callbackInstanceId: 'callback-instance-1',
        callbackOwnerVersion: 2
      }
    });

    await expect(
      slateTriggerReceiverPathSecretMethods.createInitialPathSecret({
        tenant,
        receiverId: receiver.id,
        owner: {
          callbackId: 'callback-1',
          callbackInstanceId: 'callback-instance-1',
          expectedOwnerVersion: 1,
          mutationId: 'stale-owner'
        }
      })
    ).rejects.toThrow();
    expect(
      await testDb.slateTriggerReceiverPathSecret.count({
        where: { receiverOid: receiver.oid }
      })
    ).toBe(0);
  });
});
