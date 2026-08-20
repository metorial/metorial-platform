ALTER TYPE "CallbackInstanceRegistrationStatus" ADD VALUE IF NOT EXISTS 'registering';
ALTER TYPE "CallbackInstanceRegistrationStatus" ADD VALUE IF NOT EXISTS 'renewing';
ALTER TYPE "CallbackInstanceRegistrationStatus" ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE "CallbackInstanceRegistrationStatus" ADD VALUE IF NOT EXISTS 'unregistering';
ALTER TYPE "CallbackInstanceRegistrationStatus" ADD VALUE IF NOT EXISTS 'unregistered';

ALTER TABLE "CallbackInstance"
  ADD COLUMN "registrationGeneration" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "registrationTransitionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "registrationErrorCode" TEXT,
  ADD COLUMN "registrationErrorMessage" TEXT,
  ADD COLUMN "registrationErrorMetadata" JSONB,
  ADD COLUMN "registrationErrorAt" TIMESTAMP(3),
  ADD COLUMN "registrationPublicSnapshot" JSONB,
  ADD COLUMN "registrationMirrorVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "registrationReceiverAuthorityVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastRegistrationSyncErrorCode" TEXT,
  ADD COLUMN "lastRegistrationSyncErrorMessage" TEXT,
  ADD COLUMN "lastRegistrationSyncErrorAt" TIMESTAMP(3),
  ADD COLUMN "verificationMechanism" TEXT,
  ADD COLUMN "verificationSpecHash" TEXT;

ALTER TABLE "CallbackReceiverRegistration"
  ADD COLUMN "registrationStatus" "CallbackInstanceRegistrationStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "registrationGeneration" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "registrationTransitionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "registrationErrorCode" TEXT,
  ADD COLUMN "registrationErrorMessage" TEXT,
  ADD COLUMN "registrationErrorMetadata" JSONB,
  ADD COLUMN "registrationErrorAt" TIMESTAMP(3);

ALTER TABLE "CallbackInstance"
  ADD CONSTRAINT "callback_instance_registration_tuple_check" CHECK (
    "registrationGeneration" >= 0
    AND "registrationTransitionVersion" >= 0
    AND "registrationMirrorVersion" >= 0
    AND "registrationReceiverAuthorityVersion" >= 0
  ),
  ADD CONSTRAINT "callback_instance_registration_error_pair_check" CHECK (
    ("registrationErrorCode" IS NULL AND "registrationErrorMessage" IS NULL AND "registrationErrorAt" IS NULL)
    OR
    ("registrationErrorCode" IS NOT NULL AND "registrationErrorMessage" IS NOT NULL AND "registrationErrorAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "callback_instance_registration_error_code_check" CHECK (
    "registrationErrorCode" IS NULL OR "registrationErrorCode" IN (
      'provider_rejected',
      'provider_timeout',
      'provider_transport_error',
      'invalid_provider_result',
      'registration_capability_unavailable',
      'cleanup_failed',
      'registration_capture_conflict'
    )
  );

ALTER TABLE "CallbackReceiverRegistration"
  ADD CONSTRAINT "callback_registration_error_code_check" CHECK (
    "registrationErrorCode" IS NULL OR "registrationErrorCode" IN (
      'provider_rejected',
      'provider_timeout',
      'provider_transport_error',
      'invalid_provider_result',
      'registration_capability_unavailable',
      'cleanup_failed',
      'registration_capture_conflict'
    )
  );
