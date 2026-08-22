import type { SlateTriggerReceiverSecurityAdapters } from './slateTriggerReceiverCore';

export let createSlateTriggerReceiverProductionSecurityAdapters = (d: {
  webhookAuthorityResolver: NonNullable<
    SlateTriggerReceiverSecurityAdapters['webhookAuthorityResolver']
  >;
  scopedGrantIssuer: NonNullable<SlateTriggerReceiverSecurityAdapters['scopedGrantIssuer']>;
  scopedGrantRedeemer: NonNullable<
    SlateTriggerReceiverSecurityAdapters['scopedGrantRedeemer']
  >;
  acceptedVerificationProofs: NonNullable<
    SlateTriggerReceiverSecurityAdapters['acceptedVerificationProofs']
  >;
  bootstrapCaptureWriter: NonNullable<
    SlateTriggerReceiverSecurityAdapters['bootstrapCaptureWriter']
  >;
}): SlateTriggerReceiverSecurityAdapters => ({ ...d });
