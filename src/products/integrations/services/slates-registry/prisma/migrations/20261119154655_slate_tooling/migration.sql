-- CreateEnum
CREATE TYPE "SlateToolingArtifactOrigin" AS ENUM ('upload', 'upstream', 'pack');

-- CreateTable
CREATE TABLE "SlateToolingArtifact" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "origin" "SlateToolingArtifactOrigin" NOT NULL,
    "metadata" JSONB NOT NULL,
    "artifactOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateToolingArtifact_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateToolingArtifactSignature" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "toolingArtifactOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateToolingArtifactSignature_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlateToolingArtifact_id_key" ON "SlateToolingArtifact"("id");

-- CreateIndex
CREATE INDEX "SlateToolingArtifact_kind_protocol_idx" ON "SlateToolingArtifact"("kind", "protocol");

-- CreateIndex
CREATE UNIQUE INDEX "SlateToolingArtifact_kind_version_key" ON "SlateToolingArtifact"("kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SlateToolingArtifactSignature_id_key" ON "SlateToolingArtifactSignature"("id");

-- CreateIndex
CREATE INDEX "SlateToolingArtifactSignature_kid_idx" ON "SlateToolingArtifactSignature"("kid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateToolingArtifactSignature_toolingArtifactOid_kid_key" ON "SlateToolingArtifactSignature"("toolingArtifactOid", "kid");

-- AddForeignKey
ALTER TABLE "SlateToolingArtifact" ADD CONSTRAINT "SlateToolingArtifact_artifactOid_fkey" FOREIGN KEY ("artifactOid") REFERENCES "Artifact"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateToolingArtifactSignature" ADD CONSTRAINT "SlateToolingArtifactSignature_toolingArtifactOid_fkey" FOREIGN KEY ("toolingArtifactOid") REFERENCES "SlateToolingArtifact"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
