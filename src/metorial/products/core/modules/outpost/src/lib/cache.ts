import { createCachedFunction } from '@metorial/cache';
import { db, OutpostService } from '@metorial/db';
import { base64url } from '@metorial-outpost/crypto';
import type { OutpostManifest } from '@metorial-outpost/server';
import { outpostInstanceService } from '../services/outpostInstance';
import { outpostTokenKeyPairService } from '../services/outpostTokenKeyPair';
import { OUTPOST_CACHE_TTL_SECONDS } from './constants';
import type { OutpostServiceName } from './services';

export let outpostTag = (outpostId: string) => `outpost:${outpostId}`;
export let outpostCredentialTag = (credentialId: string) =>
  `outpost_credential:${credentialId}`;
export let outpostInstanceTag = (outpostId: string, identifier: string) =>
  `outpost_instance:${outpostId}:${identifier}`;
export let outpostAccessTag = (outpostId: string) => `outpost_access:${outpostId}`;
export let outpostTokenKeyPairTag = (kid: string) => `outpost_token_key_pair:${kid}`;

export type CachedCredentialLookup =
  | { status: 'ok'; publicKey: string }
  | { status: 'unknown' }
  | { status: 'revoked' }
  | { status: 'registration_disabled'; publicKey: string };

export let cachedCredentialLookup = createCachedFunction<
  { outpostId: string; credentialId: string },
  CachedCredentialLookup
>({
  name: 'outpost/credentialLookup',
  ttlSeconds: OUTPOST_CACHE_TTL_SECONDS,
  getHash: i => `${i.outpostId}:${i.credentialId}`,
  getTags: (_, i) => [outpostTag(i.outpostId), outpostCredentialTag(i.credentialId)],
  provider: async i => {
    let credential = await db.outpostCredential.findFirst({
      where: { id: i.credentialId, outpost: { id: i.outpostId } },
      include: { outpost: true }
    });
    if (!credential) return { status: 'unknown' };

    if (credential.status != 'active') return { status: 'revoked' };

    let publicKey = base64url.encode(new Uint8Array(credential.publicKey));

    if (credential.outpost.status != 'active') {
      return { status: 'registration_disabled', publicKey };
    }

    return { status: 'ok', publicKey };
  }
});

export let cachedInstanceAuthorization = createCachedFunction<
  { outpostId: string; instanceId: string; credentialId: string },
  { status: 'active' | 'unknown' | 'instance_disabled' | 'outpost_disabled' }
>({
  name: 'outpost/instanceAuthorization',
  ttlSeconds: OUTPOST_CACHE_TTL_SECONDS,
  getHash: i => `${i.outpostId}:${i.instanceId}:${i.credentialId}`,
  getTags: (_, i) => [
    outpostTag(i.outpostId),
    outpostCredentialTag(i.credentialId),
    outpostInstanceTag(i.outpostId, i.instanceId)
  ],
  provider: async i => ({
    status: await outpostInstanceService.getInstanceAuthorization(i)
  })
});

export let cachedManifest = createCachedFunction<
  { outpostId: string },
  { status: 'ok'; manifest: OutpostManifest } | { status: 'unknown' }
>({
  name: 'outpost/manifest',
  ttlSeconds: OUTPOST_CACHE_TTL_SECONDS,
  getHash: i => i.outpostId,
  getTags: (_, i) => [outpostTag(i.outpostId), outpostAccessTag(i.outpostId)],
  provider: async i => {
    let outpost = await db.outpost.findFirst({
      where: { id: i.outpostId, status: 'active' },
      include: {
        access: { include: { organization: true, project: true, instance: true } }
      }
    });
    if (!outpost) return { status: 'unknown' };

    return {
      status: 'ok',
      manifest: {
        outpost: { id: outpost.id, name: outpost.name },
        access: outpost.access.map(entry => ({
          compartment: {
            organizationId: entry.organization.id,
            projectId: entry.project.id,
            instanceId: entry.instance.id
          },
          services: entry.services.map(service => ({ id: service }))
        }))
      }
    };
  }
});

export let cachedInstanceAccessGrant = createCachedFunction<
  {
    outpostId: string;
    projectOid: bigint;
    instanceOid: bigint;
    service: OutpostServiceName;
  },
  { granted: boolean }
>({
  name: 'outpost/instanceAccessGrant',
  ttlSeconds: OUTPOST_CACHE_TTL_SECONDS,
  getHash: i => `${i.outpostId}:${i.projectOid}:${i.instanceOid}:${i.service}`,
  getTags: (_, i) => [outpostTag(i.outpostId), outpostAccessTag(i.outpostId)],
  provider: async i => {
    let access = await db.outpostAccess.findFirst({
      where: {
        outpost: { id: i.outpostId, status: 'active' },
        projectOid: i.projectOid,
        instanceOid: i.instanceOid,
        services: { has: i.service as unknown as OutpostService }
      },
      select: { oid: true }
    });

    return { granted: !!access };
  }
});

export let cachedVerificationKey = createCachedFunction<
  { kid: string },
  { publicKey: string | null }
>({
  name: 'outpost/verificationKey',
  ttlSeconds: OUTPOST_CACHE_TTL_SECONDS,
  getHash: i => i.kid,
  getTags: (_, i) => [outpostTokenKeyPairTag(i.kid)],
  provider: async i => ({
    publicKey: (await outpostTokenKeyPairService.getVerificationPublicKey(i)) ?? null
  })
});
