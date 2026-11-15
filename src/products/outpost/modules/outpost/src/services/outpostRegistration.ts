import { Service } from '@lowerdeck/service';
import { db } from '@metorial/db';
import { base64url } from '@metorial-outpost/crypto';
import type {
  AuthenticatedOutpostRequest,
  InstanceRegistrationResult,
  OutpostRegistrationResolver,
  RequestedService,
  ResolvedEnrollmentCredential,
  ResolvedInstanceAuthorization,
  ResolvedOutpostManifest
} from '@metorial-outpost/server';
import { rootAccountOidOf } from '../lib/accountFamily';
import {
  cachedCredentialLookup,
  cachedInstanceAuthorization,
  cachedManifest
} from '../lib/cache';
import { outpostInstanceService } from './outpostInstance';

class OutpostRegistrationService {
  // Lookups are cached for minutes, so a credential's expiry is checked on every use instead.
  private hasExpired(expiresAt: number | null | undefined) {
    return expiresAt != null && expiresAt <= Date.now();
  }

  private async isInRequesterFamily(d: {
    requestedBy: AuthenticatedOutpostRequest;
    outpostId: string;
  }) {
    if (d.requestedBy.outpostId == d.outpostId) return true;

    let outposts = await db.outpost.findMany({
      where: { id: { in: [d.requestedBy.outpostId, d.outpostId] } },
      include: { account: true }
    });

    let requester = outposts.find(outpost => outpost.id == d.requestedBy.outpostId);
    let target = outposts.find(outpost => outpost.id == d.outpostId);
    if (!requester || !target) return false;

    return rootAccountOidOf(requester.account) == rootAccountOidOf(target.account);
  }

  async resolveEnrollmentCredential(d: {
    outpostId: string;
    credentialId: string;
    requestedBy?: AuthenticatedOutpostRequest;
  }): Promise<ResolvedEnrollmentCredential> {
    if (
      d.requestedBy &&
      !(await this.isInRequesterFamily({
        requestedBy: d.requestedBy,
        outpostId: d.outpostId
      }))
    ) {
      return { status: 'unknown' };
    }

    let cached = await cachedCredentialLookup({
      outpostId: d.outpostId,
      credentialId: d.credentialId
    });

    if (cached.status == 'unknown' || cached.status == 'revoked')
      return { status: cached.status };
    if (this.hasExpired(cached.expiresAt)) return { status: 'revoked' };

    return { status: cached.status, publicKey: base64url.decode(cached.publicKey) };
  }

  async resolveManifest(d: {
    outpostId: string;
    requestedBy?: AuthenticatedOutpostRequest;
  }): Promise<ResolvedOutpostManifest> {
    if (
      d.requestedBy &&
      !(await this.isInRequesterFamily({
        requestedBy: d.requestedBy,
        outpostId: d.outpostId
      }))
    ) {
      return { status: 'unknown' };
    }

    return await cachedManifest({ outpostId: d.outpostId });
  }

  async resolveInstanceAuthorization(d: {
    outpostId: string;
    instanceId: string;
    credentialId: string;
    instancePublicKey: Uint8Array;
  }): Promise<ResolvedInstanceAuthorization> {
    let authorization = await cachedInstanceAuthorization({
      outpostId: d.outpostId,
      instanceId: d.instanceId,
      credentialId: d.credentialId,
      instancePublicKey: base64url.encode(d.instancePublicKey)
    });

    if (
      authorization.status == 'active' &&
      this.hasExpired(authorization.credentialExpiresAt)
    ) {
      return { status: 'instance_disabled' };
    }

    return { status: authorization.status };
  }

  async onInstanceRegistered(d: {
    outpostId: string;
    credentialId: string;
    instanceId: string;
    instancePublicKey: Uint8Array;
    requestedServices: RequestedService[];
    context?: { ip?: string };
  }): Promise<InstanceRegistrationResult> {
    let credential = await db.outpostCredential.findFirstOrThrow({
      where: { id: d.credentialId, outpost: { id: d.outpostId } },
      include: { outpost: { include: { organization: true } } }
    });

    let { services, instanceTokenExpiresAt } = await outpostInstanceService.registerInstance({
      outpost: credential.outpost,
      credential,
      organization: credential.outpost.organization,
      input: {
        identifier: d.instanceId,
        publicKey: d.instancePublicKey,
        requestedServices: d.requestedServices
      },
      context: d.context
    });

    return { services, instanceTokenExpiresAt };
  }
}

export let outpostRegistrationService = Service.create(
  'outpostRegistrationService',
  () => new OutpostRegistrationService()
).build();

export let metorialOutpostResolver: OutpostRegistrationResolver = {
  resolveEnrollmentCredential: d => outpostRegistrationService.resolveEnrollmentCredential(d),
  resolveManifest: d => outpostRegistrationService.resolveManifest(d),
  resolveInstanceAuthorization: d =>
    outpostRegistrationService.resolveInstanceAuthorization(d),
  onInstanceRegistered: d => outpostRegistrationService.onInstanceRegistered(d)
};
