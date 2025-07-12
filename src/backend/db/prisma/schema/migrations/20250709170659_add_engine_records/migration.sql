-- CreateEnum
CREATE TYPE "EngineRunType" AS ENUM ('remote', 'container', 'unknown');

-- CreateEnum
CREATE TYPE "EngineSessionType" AS ENUM ('remote', 'container', 'unknown');

-- AlterTable
ALTER TABLE "ServerRunError" ADD COLUMN     "engineErrorId" UUID,
ADD COLUMN     "engineRunId" UUID;

-- AlterTable
ALTER TABLE "SessionMessage" ADD COLUMN     "engineMessageId" UUID;

-- CreateTable
CREATE TABLE "EngineRun" (
    "id" UUID NOT NULL,
    "type" "EngineRunType" NOT NULL,
    "hasEnded" BOOLEAN NOT NULL DEFAULT false,
    "serverRunOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineSession" (
    "id" UUID NOT NULL,
    "type" "EngineSessionType" NOT NULL,
    "hasEnded" BOOLEAN NOT NULL DEFAULT false,
    "serverSessionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngineSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EngineRun_serverRunOid_key" ON "EngineRun"("serverRunOid");

-- AddForeignKey
ALTER TABLE "EngineRun" ADD CONSTRAINT "EngineRun_serverRunOid_fkey" FOREIGN KEY ("serverRunOid") REFERENCES "ServerRun"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngineSession" ADD CONSTRAINT "EngineSession_serverSessionOid_fkey" FOREIGN KEY ("serverSessionOid") REFERENCES "ServerSession"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
