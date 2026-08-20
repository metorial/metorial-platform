import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbacksDestinationsSecretMutationOutput = {
  object: 'callback.secret_mutation';
  auditCorrelationId: string;
  secret: {
    id: string;
    status: 'active' | 'retiring' | 'revoked';
    secretVersion: number;
    validFrom: Date;
    validUntil: Date | null;
  };
  secretIssuanceReceipt: {
    id: string;
    token: string;
    expiresAt: Date;
  } | null;
  graceExpiresAt: Date | null;
};

export type DashboardInstanceCallbacksDestinationsRotateSigningSecretBody = {
  gracePeriodSeconds?: number;
};

export let mapDashboardInstanceCallbacksDestinationsSecretMutationOutput =
  mtMap.object<DashboardInstanceCallbacksDestinationsSecretMutationOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    auditCorrelationId: mtMap.objectField('audit_correlation_id', mtMap.passthrough()),
    secret: mtMap.objectField(
      'secret',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        secretVersion: mtMap.objectField('secret_version', mtMap.passthrough()),
        validFrom: mtMap.objectField('valid_from', mtMap.date()),
        validUntil: mtMap.objectField('valid_until', mtMap.date())
      })
    ),
    secretIssuanceReceipt: mtMap.objectField(
      'secret_issuance_receipt',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        token: mtMap.objectField('token', mtMap.passthrough()),
        expiresAt: mtMap.objectField('expires_at', mtMap.date())
      })
    ),
    graceExpiresAt: mtMap.objectField('grace_expires_at', mtMap.date())
  });

export let mapDashboardInstanceCallbacksDestinationsRotateSigningSecretBody =
  mtMap.object<DashboardInstanceCallbacksDestinationsRotateSigningSecretBody>({
    gracePeriodSeconds: mtMap.objectField('grace_period_seconds', mtMap.passthrough())
  });
