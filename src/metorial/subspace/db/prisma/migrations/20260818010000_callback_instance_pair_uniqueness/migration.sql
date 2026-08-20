BEGIN;

LOCK TABLE "CallbackInstance" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "CallbackInstance"
     GROUP BY "callbackOid", "providerDeploymentConfigPairOid"
    HAVING COUNT(*) > 1
     LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Callback instance pair uniqueness blocked: duplicate callback/config/auth pairs require explicit reconciliation';
  END IF;
END $$;

ALTER TABLE "CallbackInstance"
  ADD CONSTRAINT "sub_callback_instance_pair_key"
  UNIQUE ("callbackOid", "providerDeploymentConfigPairOid");

COMMIT;
