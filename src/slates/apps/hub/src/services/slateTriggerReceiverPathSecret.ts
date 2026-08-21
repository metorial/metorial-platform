import { createHash, randomBytes } from 'node:crypto';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { Prisma, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { secretService } from './secret';

type HubTransaction = Prisma.TransactionClient;

export type CallbackReceiverOwnerAuthority = {
  callbackId: string;
  callbackInstanceId: string;
  expectedOwnerVersion: number;
  mutationId: string;
};

let pathHash = (value: string) => createHash('sha256').update(value).digest('hex');
let mutationHash = (
  operation: 'create' | 'rotate',
  authority: CallbackReceiverOwnerAuthority
) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        operation,
        callbackId: authority.callbackId,
        callbackInstanceId: authority.callbackInstanceId,
        expectedOwnerVersion: authority.expectedOwnerVersion
      })
    )
    .digest('hex');
let newPathValue = () => `metorial_whpath_${randomBytes(32).toString('base64url')}`;

let ownerConflict = () =>
  new ServiceError(
    badRequestError({
      code: 'callback_owner_conflict',
      message: 'Callback receiver owner authority is stale or does not match.'
    })
  );

let secretAlreadyIssued = () =>
  new ServiceError(
    badRequestError({
      code: 'callback_path_secret_plaintext_already_issued',
      message: 'This path-secret mutation was already applied; rotate with a new mutation ID.'
    })
  );

let validateAuthority = (authority: CallbackReceiverOwnerAuthority) => {
  if (
    !authority.callbackId ||
    !authority.callbackInstanceId ||
    !Number.isInteger(authority.expectedOwnerVersion) ||
    authority.expectedOwnerVersion < 1 ||
    !authority.mutationId ||
    authority.mutationId.length > 200
  ) {
    throw ownerConflict();
  }
};

let receiverBinding = async (
  client: HubTransaction | typeof db,
  tenant: Tenant,
  receiverId: string,
  authority?: CallbackReceiverOwnerAuthority
) => {
  if (authority) validateAuthority(authority);
  let receiver = await client.slateTriggerReceiver.findFirst({
    where: {
      id: receiverId,
      tenantOid: tenant.oid,
      ...(authority
        ? {
            callbackId: authority.callbackId,
            callbackInstanceId: authority.callbackInstanceId,
            callbackOwnerVersion: authority.expectedOwnerVersion,
            tombstonedAt: null
          }
        : {})
    },
    include: { slateInstance: true }
  });
  if (!receiver) throw ownerConflict();
  return receiver;
};

let pathSecretMetadata = (binding: {
  id: string;
  generation: number;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: binding.id,
  generation: binding.generation,
  createdAt: binding.createdAt,
  updatedAt: binding.updatedAt
});

export let provisionInitialCallbackReceiverPathSecretInTransaction = async (d: {
  tx: HubTransaction;
  tenant: Tenant;
  receiverId: string;
  actor?: { actorId: string; requestId: string };
  now?: Date;
}) => {
  let receiver = await receiverBinding(d.tx, d.tenant, d.receiverId);
  let existing = await d.tx.slateTriggerReceiverPathSecret.findUnique({
    where: { receiverOid: receiver.oid }
  });
  if (existing) return { binding: existing };

  let plaintext = newPathValue();
  let secret = await secretService.createSecret({
    tenant: d.tenant,
    purpose: 'slate_callback_path',
    secretData: { value: plaintext },
    db: d.tx
  });
  let binding = await d.tx.slateTriggerReceiverPathSecret.create({
    data: {
      ...getId('secret'),
      tenantOid: d.tenant.oid,
      slateInstanceOid: receiver.slateInstanceOid,
      receiverOid: receiver.oid,
      secretOid: secret.oid,
      lookupHash: pathHash(plaintext),
      generation: 1
    }
  });
  return { binding };
};

let resolvePathSecret = async (d: { tenant: Tenant; receiverId: string }) => {
  let binding = await db.slateTriggerReceiverPathSecret.findFirst({
    where: { receiver: { id: d.receiverId, tenantOid: d.tenant.oid } },
    include: { secret: true }
  });
  if (!binding) return null;
  let material = await secretService.DANGEROUSLY_decryptSecret({
    tenant: d.tenant,
    secret: binding.secret,
    purpose: 'slate_callback_path',
    note: `Use callback receiver path for ${d.receiverId}`
  });
  if (pathHash(material.value) !== binding.lookupHash) {
    throw new Error('Callback receiver path secret hash mismatch');
  }
  return { binding, plaintext: material.value };
};

export let slateTriggerReceiverPathSecretMethods = {
  async createInitialPathSecret(d: {
    tenant: Tenant;
    receiverId: string;
    owner: CallbackReceiverOwnerAuthority;
  }) {
    let digest = mutationHash('create', d.owner);
    let plaintext = newPathValue();
    let result = await db.$transaction(async tx => {
      let receiver = await receiverBinding(tx, d.tenant, d.receiverId, d.owner);
      let current = await tx.slateTriggerReceiverPathSecret.findUnique({
        where: { receiverOid: receiver.oid },
        include: { secret: true }
      });
      if (!current) {
        let secret = await secretService.createSecret({
          tenant: d.tenant,
          purpose: 'slate_callback_path',
          secretData: { value: plaintext },
          db: tx
        });
        return await tx.slateTriggerReceiverPathSecret.create({
          data: {
            ...getId('secret'),
            tenantOid: d.tenant.oid,
            slateInstanceOid: receiver.slateInstanceOid,
            receiverOid: receiver.oid,
            secretOid: secret.oid,
            lookupHash: pathHash(plaintext),
            generation: 1,
            plaintextIssuedAt: new Date(),
            lastMutationId: d.owner.mutationId,
            lastMutationDigest: digest
          }
        });
      }
      if (current.lastMutationId === d.owner.mutationId) {
        if (current.lastMutationDigest !== digest) throw ownerConflict();
        throw secretAlreadyIssued();
      }
      if (current.plaintextIssuedAt) {
        throw new ServiceError(
          badRequestError({
            code: 'callback_path_secret_already_created',
            message: 'The receiver path secret already exists; rotate it instead.'
          })
        );
      }
      await secretService.DANGEROUSLY_updateSecret({
        tenant: d.tenant,
        secret: current.secret,
        purpose: 'slate_callback_path',
        secretData: { value: plaintext },
        db: tx
      });
      return await tx.slateTriggerReceiverPathSecret.update({
        where: { oid: current.oid },
        data: {
          lookupHash: pathHash(plaintext),
          plaintextIssuedAt: new Date(),
          lastMutationId: d.owner.mutationId,
          lastMutationDigest: digest
        }
      });
    });
    return { pathSecret: pathSecretMetadata(result), plaintext };
  },

  async rotatePathSecret(d: {
    tenant: Tenant;
    receiverId: string;
    owner: CallbackReceiverOwnerAuthority;
  }) {
    let digest = mutationHash('rotate', d.owner);
    let plaintext = newPathValue();
    let result = await db.$transaction(async tx => {
      let receiver = await receiverBinding(tx, d.tenant, d.receiverId, d.owner);
      let current = await tx.slateTriggerReceiverPathSecret.findUnique({
        where: { receiverOid: receiver.oid },
        include: { secret: true }
      });
      if (!current || !current.plaintextIssuedAt) {
        throw new ServiceError(
          badRequestError({
            code: 'callback_path_secret_not_created',
            message: 'Create the initial receiver path secret before rotating it.'
          })
        );
      }
      if (current.lastMutationId === d.owner.mutationId) {
        if (current.lastMutationDigest !== digest) throw ownerConflict();
        throw secretAlreadyIssued();
      }
      let nextSecret = await secretService.createSecret({
        tenant: d.tenant,
        purpose: 'slate_callback_path',
        secretData: { value: plaintext },
        db: tx
      });
      let binding = await tx.slateTriggerReceiverPathSecret.update({
        where: { oid: current.oid, generation: current.generation },
        data: {
          secretOid: nextSecret.oid,
          lookupHash: pathHash(plaintext),
          generation: { increment: 1 },
          plaintextIssuedAt: new Date(),
          lastMutationId: d.owner.mutationId,
          lastMutationDigest: digest
        }
      });
      await secretService.DANGEROUSLY_deleteSecret({
        tenant: d.tenant,
        secret: current.secret,
        db: tx
      });
      return binding;
    });
    return { pathSecret: pathSecretMetadata(result), plaintext };
  },

  async revokeAllPathSecrets(d: {
    tenant: Tenant;
    receiverId: string;
    owner?: CallbackReceiverOwnerAuthority;
  }) {
    return await db.$transaction(async tx => {
      let receiver = await receiverBinding(tx, d.tenant, d.receiverId, d.owner);
      let current = await tx.slateTriggerReceiverPathSecret.findUnique({
        where: { receiverOid: receiver.oid },
        include: { secret: true }
      });
      if (!current) return { revoked: false };
      await tx.slateTriggerReceiverPathSecret.delete({ where: { oid: current.oid } });
      await secretService.DANGEROUSLY_deleteSecret({
        tenant: d.tenant,
        secret: current.secret,
        db: tx
      });
      return { revoked: true };
    });
  },

  async cleanupExpiredPathSecrets() {
    return { deletedCount: 0 };
  },

  async resolvePathSecret(d: { tenant: Tenant; receiverId: string }) {
    return await resolvePathSecret(d);
  },

  async resolvePathActiveAndRetiring(d: { tenant: Tenant; receiverId: string }) {
    let resolved = await resolvePathSecret(d);
    return resolved ? [resolved] : [];
  }
};
