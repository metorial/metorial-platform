import { describe, expect, it } from 'vitest';
import {
  createSlateTriggerReceiverProductionSecurityAdapters,
  requireScopedInvocationExecutionControl
} from './slateTriggerReceiverProductionSecurityAdapters';

describe('production webhook security call graph', () => {
  it('passes the authoritative resolver, grants, proofs, and encrypted CAS writer into core', () => {
    let webhookAuthorityResolver = { resolve: async () => ({}) } as never;
    let scopedGrantIssuer = { issue: async () => ({}) } as never;
    let acceptedVerificationProofs = { issue: () => ({}) } as never;
    let bootstrapCaptureWriter = { compareAndSet: async () => ({}) } as never;
    let adapters = createSlateTriggerReceiverProductionSecurityAdapters({
      webhookAuthorityResolver,
      scopedGrantIssuer,
      acceptedVerificationProofs,
      bootstrapCaptureWriter
    });
    expect(adapters).toEqual({
      webhookAuthorityResolver,
      scopedGrantIssuer,
      acceptedVerificationProofs,
      bootstrapCaptureWriter
    });
    expect(adapters.scopedInvocationExecutionControl).toBeUndefined();
  });

  it('fails closed before invocation transport because production has no attested execution control', () => {
    expect(() => requireScopedInvocationExecutionControl(undefined)).toThrow(
      'Trusted scoped invocation termination control is unavailable'
    );
  });
});
