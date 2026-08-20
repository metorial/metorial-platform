import { createHash } from 'node:crypto';
import type { Tenant } from '../../prisma/generated/client';
import { verifyReceiverPathSecret } from '../lib/webhookVerification';
import {
  isTrustedSharedAppBoundary,
  type SharedAppAuthenticatedBoundary
} from '../lib/sharedAppRouting';
import { slateTriggerReceiverSecretService } from './slateTriggerReceiverSecret';

let trustedReceiverRouteBoundaries = new WeakSet<object>();

export type TrustedReceiverRouteBoundary = {
  readonly kind: 'receiver_route';
  readonly tenantId: string;
  readonly receiverId: string;
  readonly authenticatedAt: Date;
  readonly bindingHash: string;
};

export let authenticateReceiverRouteBoundary = async (d: {
  tenant: Tenant;
  receiverId: string;
  supplied: string;
  now?: Date;
}): Promise<TrustedReceiverRouteBoundary | null> => {
  let now = d.now ?? new Date();
  let resolved = await slateTriggerReceiverSecretService.resolvePathActiveAndRetiring({
    tenant: d.tenant,
    receiverId: d.receiverId,
    now
  });
  if (
    !verifyReceiverPathSecret({
      supplied: d.supplied,
      activeAndRetiring: resolved.map(item => item.plaintext)
    })
  ) {
    return null;
  }
  let boundary: TrustedReceiverRouteBoundary = Object.freeze({
    kind: 'receiver_route',
    tenantId: d.tenant.id,
    receiverId: d.receiverId,
    authenticatedAt: now,
    bindingHash: createHash('sha256')
      .update('metorial.webhook-authenticated-boundary\0v1\0')
      .update(
        JSON.stringify({
          tenantId: d.tenant.id,
          receiverId: d.receiverId,
          authorities: resolved
            .map(item => [item.secret.id, item.secret.secretVersion])
            .sort(([first], [second]) => String(first).localeCompare(String(second)))
        })
      )
      .digest('hex')
  });
  trustedReceiverRouteBoundaries.add(boundary);
  return boundary;
};

export let persistableAuthenticatedBoundary = (d: {
  boundary: TrustedReceiverRouteBoundary | SharedAppAuthenticatedBoundary;
  tenantId: string;
  receiverId: string;
}) => {
  if (d.boundary.kind === 'shared_provisioned_app') {
    if (
      !isTrustedSharedAppBoundary(d.boundary) ||
      d.boundary.tenantId !== d.tenantId ||
      d.boundary.receiverId !== d.receiverId
    ) {
      throw new Error('Webhook authentication boundary is untrusted or owner-mismatched');
    }
    return {
      authenticatedBoundaryKind: d.boundary.kind,
      authenticatedBoundaryAt: d.boundary.authenticatedAt,
      authenticatedBindingHash: d.boundary.bindingHash
    };
  }
  if (
    !trustedReceiverRouteBoundaries.has(d.boundary) ||
    d.boundary.kind !== 'receiver_route' ||
    d.boundary.tenantId !== d.tenantId ||
    d.boundary.receiverId !== d.receiverId
  ) {
    throw new Error('Webhook authentication boundary is untrusted or owner-mismatched');
  }
  return {
    authenticatedBoundaryKind: d.boundary.kind,
    authenticatedBoundaryAt: d.boundary.authenticatedAt,
    authenticatedBindingHash: d.boundary.bindingHash
  };
};
