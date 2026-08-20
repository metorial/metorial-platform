import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardCallbackRegistrationStatus =
  | 'pending'
  | 'registering'
  | 'registered'
  | 'renewing'
  | 'failed'
  | 'unregistering'
  | 'unregistered';

export type DashboardCallbackVerificationEvidence = {
  kind:
    | 'contract_test'
    | 'fixture'
    | 'registration'
    | 'projection'
    | 'cutover'
    | 'shadow_interval'
    | 'capability_probe';
  id: string;
  digest: string;
  observedAt: string;
};

export type DashboardCallbackVerificationReadiness = {
  status: 'ready' | 'blocked';
  reason?:
    | 'missing_declaration'
    | 'invalid_ingress_combination'
    | 'capability_unavailable'
    | 'secret_unavailable'
    | 'registration_not_ready'
    | 'route_projection_not_ready'
    | 'spec_or_generation_mismatch'
    | 'secured_url_not_cut_over'
    | 'lifecycle_evidence_missing'
    | 'fixture_evidence_missing'
    | 'shadow_window_incomplete'
    | 'shadow_mismatch'
    | 'fallback_expired'
    | 'external_decision_pending'
    | 'evidence_stale';
  evidence: DashboardCallbackVerificationEvidence[];
};

export type DashboardCallbackVerificationObservations = {
  candidateAccepted: number;
  candidateRejected: number;
  candidateNotEvaluated: number;
  compatibilityDispatched: number;
  verifiedDispatched: number;
  suppressedDisabled: number;
  suppressedRejection: number;
  syncOnly: number;
};

export type DashboardCallbackRegistrationFields = {
  registrationStatus: DashboardCallbackRegistrationStatus;
  registrationGeneration: number;
  registrationTransitionVersion: number;
  registrationError: {
    code: string;
    message: string | null;
    metadata: Record<string, unknown> | null;
    at: Date | null;
  } | null;
};

export type DashboardCallbackVerificationFields = {
  verificationMechanism: 'path_secret_only' | 'hub' | 'provider';
  verificationEnforcement: 'disabled' | 'shadow' | 'enforced';
  verificationReadiness: DashboardCallbackVerificationReadiness;
  verificationPolicyVersion: number;
  verificationSpecHash: string | null;
  verificationEvidenceIntervalId: string | null;
  verificationLastRejectionAt: Date | null;
  verificationLastRejectionReason: string | null;
  verificationSevenDayCandidateCount: number;
  verificationSevenDayDeliveryCount: number;
  verificationSevenDayObservations: DashboardCallbackVerificationObservations;
};

export type DashboardCallbackInstanceSecurityFields = DashboardCallbackRegistrationFields &
  Omit<
    DashboardCallbackVerificationFields,
    'verificationMechanism' | 'verificationEnforcement' | 'verificationReadiness'
  > & {
    lastRegistrationSyncError: {
      code: string;
      message: string | null;
      at: Date | null;
    } | null;
    verificationMechanism: DashboardCallbackVerificationFields['verificationMechanism'] | null;
    verificationEnforcement:
      | DashboardCallbackVerificationFields['verificationEnforcement']
      | null;
    verificationReadiness: DashboardCallbackVerificationReadiness | null;
    security: {
      receiverId: string | null;
      receiverUrl: string | null;
      pathSecrets: {
        id: string;
        status: 'active' | 'retiring';
        secretVersion: number;
        validFrom: Date;
        validUntil: Date | null;
        rotatedAt: Date | null;
      }[];
      provisionedApps: {
        id: string;
        generation: number;
        vendor: string;
        credentialOwnerType: 'managed' | 'byo';
        status: string;
        externalAppId: string | null;
        githubManifestStateExpiresAt: Date | null;
        githubManifestCompletedAt: Date | null;
        githubInstallationCompletedAt: Date | null;
      }[];
    };
  };

let mapRegistrationError = mtMap.object({
  code: mtMap.objectField('code', mtMap.passthrough()),
  message: mtMap.objectField('message', mtMap.passthrough()),
  metadata: mtMap.objectField('metadata', mtMap.passthrough()),
  at: mtMap.objectField('at', mtMap.date())
});

let mapEvidence = mtMap.object({
  kind: mtMap.objectField('kind', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  digest: mtMap.objectField('digest', mtMap.passthrough()),
  observedAt: mtMap.objectField('observedAt', mtMap.passthrough())
});

let mapReadiness = mtMap.object({
  status: mtMap.objectField('status', mtMap.passthrough()),
  reason: mtMap.objectField('reason', mtMap.passthrough()),
  evidence: mtMap.objectField('evidence', mtMap.array(mapEvidence))
});

let mapObservations = mtMap.object({
  candidateAccepted: mtMap.objectField('candidate_accepted', mtMap.passthrough()),
  candidateRejected: mtMap.objectField('candidate_rejected', mtMap.passthrough()),
  candidateNotEvaluated: mtMap.objectField('candidate_not_evaluated', mtMap.passthrough()),
  compatibilityDispatched: mtMap.objectField('compatibility_dispatched', mtMap.passthrough()),
  verifiedDispatched: mtMap.objectField('verified_dispatched', mtMap.passthrough()),
  suppressedDisabled: mtMap.objectField('suppressed_disabled', mtMap.passthrough()),
  suppressedRejection: mtMap.objectField('suppressed_rejection', mtMap.passthrough()),
  syncOnly: mtMap.objectField('sync_only', mtMap.passthrough())
});

export let mapDashboardCallbackRegistrationFields: Record<string, any> = {
  registrationStatus: mtMap.objectField('registration_status', mtMap.passthrough()),
  registrationGeneration: mtMap.objectField('registration_generation', mtMap.passthrough()),
  registrationTransitionVersion: mtMap.objectField(
    'registration_transition_version',
    mtMap.passthrough()
  ),
  registrationError: mtMap.objectField('registration_error', mapRegistrationError)
};

export let mapDashboardCallbackVerificationFields: Record<string, any> = {
  verificationMechanism: mtMap.objectField('verification_mechanism', mtMap.passthrough()),
  verificationEnforcement: mtMap.objectField('verification_enforcement', mtMap.passthrough()),
  verificationReadiness: mtMap.objectField('verification_readiness', mapReadiness),
  verificationPolicyVersion: mtMap.objectField(
    'verification_policy_version',
    mtMap.passthrough()
  ),
  verificationSpecHash: mtMap.objectField('verification_spec_hash', mtMap.passthrough()),
  verificationEvidenceIntervalId: mtMap.objectField(
    'verification_evidence_interval_id',
    mtMap.passthrough()
  ),
  verificationLastRejectionAt: mtMap.objectField(
    'verification_last_rejection_at',
    mtMap.date()
  ),
  verificationLastRejectionReason: mtMap.objectField(
    'verification_last_rejection_reason',
    mtMap.passthrough()
  ),
  verificationSevenDayCandidateCount: mtMap.objectField(
    'verification_seven_day_candidate_count',
    mtMap.passthrough()
  ),
  verificationSevenDayDeliveryCount: mtMap.objectField(
    'verification_seven_day_delivery_count',
    mtMap.passthrough()
  ),
  verificationSevenDayObservations: mtMap.objectField(
    'verification_seven_day_observations',
    mapObservations
  )
};

export let mapDashboardCallbackInstanceSecurityFields: Record<string, any> = {
  ...mapDashboardCallbackRegistrationFields,
  ...mapDashboardCallbackVerificationFields,
  lastRegistrationSyncError: mtMap.objectField(
    'last_registration_sync_error',
    mtMap.object({
      code: mtMap.objectField('code', mtMap.passthrough()),
      message: mtMap.objectField('message', mtMap.passthrough()),
      at: mtMap.objectField('at', mtMap.date())
    })
  ),
  security: mtMap.objectField(
    'security',
    mtMap.object({
      receiverId: mtMap.objectField('receiver_id', mtMap.passthrough()),
      receiverUrl: mtMap.objectField('receiver_url', mtMap.passthrough()),
      pathSecrets: mtMap.objectField(
        'path_secrets',
        mtMap.array(
          mtMap.object({
            id: mtMap.objectField('id', mtMap.passthrough()),
            generation: mtMap.objectField('generation', mtMap.passthrough()),
            status: mtMap.objectField('status', mtMap.passthrough()),
            secretVersion: mtMap.objectField('secret_version', mtMap.passthrough()),
            validFrom: mtMap.objectField('valid_from', mtMap.date()),
            validUntil: mtMap.objectField('valid_until', mtMap.date()),
            rotatedAt: mtMap.objectField('rotated_at', mtMap.date())
          })
        )
      ),
      provisionedApps: mtMap.objectField(
        'provisioned_apps',
        mtMap.array(
          mtMap.object({
            id: mtMap.objectField('id', mtMap.passthrough()),
            vendor: mtMap.objectField('vendor', mtMap.passthrough()),
            credentialOwnerType: mtMap.objectField(
              'credential_owner_type',
              mtMap.passthrough()
            ),
            status: mtMap.objectField('status', mtMap.passthrough()),
            externalAppId: mtMap.objectField('external_app_id', mtMap.passthrough()),
            githubManifestStateExpiresAt: mtMap.objectField(
              'github_manifest_state_expires_at',
              mtMap.date()
            ),
            githubManifestCompletedAt: mtMap.objectField(
              'github_manifest_completed_at',
              mtMap.date()
            ),
            githubInstallationCompletedAt: mtMap.objectField(
              'github_installation_completed_at',
              mtMap.date()
            )
          })
        )
      )
    })
  )
};
