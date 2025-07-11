/*
  Warnings:

  - You are about to drop the column `serverRunOid` on the `EngineRun` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "EngineRun" DROP CONSTRAINT "EngineRun_serverRunOid_fkey";

-- DropIndex
DROP INDEX "EngineRun_serverRunOid_key";

-- AlterTable
ALTER TABLE "EngineRun" DROP COLUMN "serverRunOid";

-- AlterTable
ALTER TABLE "ServerRun" ADD COLUMN     "engineRunId" UUID;

-- AddForeignKey
ALTER TABLE "ServerRun" ADD CONSTRAINT "ServerRun_engineRunId_fkey" FOREIGN KEY ("engineRunId") REFERENCES "EngineRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
