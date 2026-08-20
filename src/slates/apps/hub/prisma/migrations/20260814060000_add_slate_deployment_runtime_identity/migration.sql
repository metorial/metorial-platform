ALTER TABLE "SlateDeployment"
  ADD COLUMN "runtimeIdentityId" TEXT,
  ADD COLUMN "runtimeIdentityGeneration" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "runtimeIdentityRevokedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "SlateDeployment_runtimeIdentityId_key"
  ON "SlateDeployment"("runtimeIdentityId");
