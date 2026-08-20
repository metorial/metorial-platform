import type { ScopedInvocationExecutionControl } from '../lib/invocation/types';
import type { SlateTriggerReceiverSecurityAdapters } from './slateTriggerReceiverCore';

export let createSlateTriggerReceiverProductionSecurityAdapters = (d: {
  webhookAuthorityResolver: NonNullable<
    SlateTriggerReceiverSecurityAdapters['webhookAuthorityResolver']
  >;
  scopedGrantIssuer: NonNullable<SlateTriggerReceiverSecurityAdapters['scopedGrantIssuer']>;
  acceptedVerificationProofs: NonNullable<
    SlateTriggerReceiverSecurityAdapters['acceptedVerificationProofs']
  >;
  bootstrapCaptureWriter: NonNullable<
    SlateTriggerReceiverSecurityAdapters['bootstrapCaptureWriter']
  >;
}): SlateTriggerReceiverSecurityAdapters => ({ ...d });

export let requireScopedInvocationExecutionControl = (
  control: ScopedInvocationExecutionControl | undefined
) => {
  if (!control)
    throw new Error('Trusted scoped invocation termination control is unavailable');
  return control;
};
