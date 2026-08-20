CREATE TYPE "SlateScopedInvocationGrantStatus" AS ENUM ('active', 'consumed', 'revoked');

CREATE TABLE "SlateScopedInvocationGrant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "SlateScopedInvocationGrantStatus" NOT NULL DEFAULT 'active',
    "bindings" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateScopedInvocationGrant_pkey" PRIMARY KEY ("oid")
);

CREATE UNIQUE INDEX "SlateScopedInvocationGrant_id_key" ON "SlateScopedInvocationGrant"("id");
CREATE UNIQUE INDEX "SlateScopedInvocationGrant_tokenHash_key" ON "SlateScopedInvocationGrant"("tokenHash");
CREATE INDEX "SlateScopedInvocationGrant_status_expiresAt_idx" ON "SlateScopedInvocationGrant"("status", "expiresAt");
