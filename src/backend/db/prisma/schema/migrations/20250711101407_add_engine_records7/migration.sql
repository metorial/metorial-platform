/*
  Warnings:

  - Added the required column `serverSessionOid` to the `EngineRun` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EngineRun" ADD COLUMN     "serverSessionOid" BIGINT NOT NULL;

-- AddForeignKey
ALTER TABLE "EngineRun" ADD CONSTRAINT "EngineRun_serverSessionOid_fkey" FOREIGN KEY ("serverSessionOid") REFERENCES "ServerSession"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
