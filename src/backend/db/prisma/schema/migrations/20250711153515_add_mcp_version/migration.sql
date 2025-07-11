-- AlterTable
ALTER TABLE "ServerVariant" ADD COLUMN     "mcpVersion" TEXT NOT NULL DEFAULT '2024-11-05';

-- AlterTable
ALTER TABLE "ServerVersion" ADD COLUMN     "mcpVersion" TEXT NOT NULL DEFAULT '2024-11-05';
