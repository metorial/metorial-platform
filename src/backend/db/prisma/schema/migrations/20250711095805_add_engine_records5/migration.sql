-- AlterTable
ALTER TABLE "EngineRun" ADD COLUMN     "isFinalized" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EngineSession" ADD COLUMN     "isFinalized" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "hasEnded" DROP DEFAULT;
