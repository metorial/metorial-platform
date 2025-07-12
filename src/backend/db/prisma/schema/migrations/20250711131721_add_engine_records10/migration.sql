/*
  Warnings:

  - Added the required column `engineSessionId` to the `EngineRun` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EngineRun" ADD COLUMN     "engineSessionId" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "EngineRun" ADD CONSTRAINT "EngineRun_engineSessionId_fkey" FOREIGN KEY ("engineSessionId") REFERENCES "EngineSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
